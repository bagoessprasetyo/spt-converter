import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { trackEvent } from '@/lib/supabase/conversions'
import { APIError } from '@/lib/supabase/types'
import crypto from 'crypto'

const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET

interface N8NWebhookPayload {
  conversionId: string
  status: 'completed' | 'failed'
  downloadUrl?: string
  error?: string
  metadata?: {
    processingTime?: number
    fileSize?: number
    pages?: number
    tables?: number
  }
  secret: string
}

// Verify webhook signature
function verifyWebhookSignature(payload: string, signature: string, secret: string): boolean {
  if (!signature || !secret) return false
  
  const expectedSignature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')
  
  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}

export async function POST(request: NextRequest) {
  try {
    // Get raw body for signature verification
    const rawBody = await request.text()
    const signature = request.headers.get('x-webhook-signature') || ''
    
    // Verify webhook signature if secret is configured
    if (N8N_WEBHOOK_SECRET) {
      if (!verifyWebhookSignature(rawBody, signature, N8N_WEBHOOK_SECRET)) {
        console.error('Invalid webhook signature')
        return NextResponse.json(
          { code: 'INVALID_SIGNATURE', message: 'Webhook signature verification failed', retryable: false } as APIError,
          { status: 401 }
        )
      }
    }

    // Parse payload
    let payload: N8NWebhookPayload
    try {
      payload = JSON.parse(rawBody)
    } catch (parseError) {
      console.error('Invalid JSON payload:', parseError)
      return NextResponse.json(
        { code: 'INVALID_PAYLOAD', message: 'Invalid JSON payload', retryable: false } as APIError,
        { status: 400 }
      )
    }

    // Validate required fields
    if (!payload.conversionId || !payload.status) {
      return NextResponse.json(
        { code: 'MISSING_FIELDS', message: 'conversionId and status are required', retryable: false } as APIError,
        { status: 400 }
      )
    }

    // Validate secret in payload (additional security)
    if (N8N_WEBHOOK_SECRET && payload.secret !== N8N_WEBHOOK_SECRET) {
      return NextResponse.json(
        { code: 'INVALID_SECRET', message: 'Invalid webhook secret', retryable: false } as APIError,
        { status: 401 }
      )
    }

    // Create service client (admin privileges)
    const supabase = createServiceClient()
    
    // Get conversion details
    const { data: conversion, error: fetchError } = await supabase
      .from('conversions')
      .select('*')
      .eq('id', payload.conversionId)
      .single()
    
    if (fetchError || !conversion) {
      console.error('Conversion not found:', payload.conversionId, fetchError)
      return NextResponse.json(
        { code: 'CONVERSION_NOT_FOUND', message: 'The specified conversion does not exist', retryable: false } as APIError,
        { status: 404 }
      )
    }

    // Prepare update data
    const updateData: any = {
      status: payload.status,
      completed_at: new Date().toISOString(),
      updated_at: new Date().toISOString()
    }

    if (payload.status === 'completed') {
      updateData.download_url = payload.downloadUrl || `/api/download/${payload.conversionId}`
      updateData.error_message = null
      
      // Note: metadata is stored in usage_analytics table, not conversions table
    } else if (payload.status === 'failed') {
      updateData.error_message = payload.error || 'Conversion failed during processing'
      updateData.download_url = null
    }

    // Update conversion status
    const { error: updateError } = await supabase
      .from('conversions')
      .update(updateData)
      .eq('id', payload.conversionId)
    
    if (updateError) {
      console.error('Failed to update conversion:', updateError)
      return NextResponse.json(
        { code: 'UPDATE_FAILED', message: 'Failed to update conversion status', retryable: true } as APIError,
        { status: 500 }
      )
    }

    // Track completion event
    try {
      if (conversion.user_id) {
        await trackEvent(
          conversion.user_id,
          payload.status === 'completed' ? 'conversion_success' : 'conversion_failed',
          payload.conversionId,
          {
            file_name: conversion.original_filename,
            processing_time: payload.metadata?.processingTime,
            error: payload.error,
            pages: payload.metadata?.pages,
            tables: payload.metadata?.tables
          }
        )
      }
    } catch (trackError) {
      console.error('Failed to track event:', trackError)
      // Don't fail the webhook for tracking errors
    }

    // Send notification (if user has notifications enabled)
    // This could be extended to send email notifications, push notifications, etc.
    try {
      if (payload.status === 'completed') {
        // Could integrate with email service, push notifications, etc.
        console.log(`Conversion completed for user ${conversion.user_id}: ${payload.conversionId}`)
      } else {
        console.log(`Conversion failed for user ${conversion.user_id}: ${payload.conversionId} - ${payload.error}`)
      }
    } catch (notificationError) {
      console.error('Failed to send notification:', notificationError)
      // Don't fail the webhook for notification errors
    }

    // Return success response
    return NextResponse.json(
      { 
        success: true, 
        message: 'Webhook processed successfully',
        conversionId: payload.conversionId,
        status: payload.status
      },
      { status: 200 }
    )

  } catch (error) {
    console.error('Webhook processing error:', error)
    
    return NextResponse.json(
      { 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to process webhook. Please try again.',
        retryable: true 
      } as APIError,
      { status: 500 }
    )
  }
}

// Handle GET for webhook verification (optional)
export async function GET(request: NextRequest) {
  // Some webhook services require GET endpoint verification
  const challenge = request.nextUrl.searchParams.get('challenge')
  
  if (challenge) {
    return NextResponse.json({ challenge }, { status: 200 })
  }
  
  return NextResponse.json(
    { message: 'N8N Webhook endpoint is active' },
    { status: 200 }
  )
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization, x-webhook-signature',
    },
  })
}