import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createConversion, trackEvent } from '@/lib/supabase/conversions'
import { getUserProfile, checkUserLimits, updateUserCredits } from '@/lib/supabase/users'
import { ConversionRequest, ConversionResponse, APIError } from '@/lib/supabase/types'

const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10MB
const ALLOWED_TYPES = ['application/pdf']
const N8N_WEBHOOK_URL = process.env.N8N_WEBHOOK_URL
const N8N_WEBHOOK_SECRET = process.env.N8N_WEBHOOK_SECRET

export async function POST(request: NextRequest) {
  try {
    // Create Supabase client with server context (cookies)
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Please log in to convert files', retryable: false } as APIError,
        { status: 401 }
      )
    }

    // Get user profile and check limits
    const userProfile = await getUserProfile(user.id)
    if (!userProfile) {
      return NextResponse.json(
        { code: 'USER_PROFILE_NOT_FOUND', message: 'Please complete your profile setup', retryable: false } as APIError,
        { status: 400 }
      )
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File
    const options = formData.get('options') ? JSON.parse(formData.get('options') as string) : {}

    if (!file) {
      return NextResponse.json(
        { code: 'NO_FILE_PROVIDED', message: 'Please select a PDF file to convert', retryable: false } as APIError,
        { status: 400 }
      )
    }

    // Validate file
    if (!ALLOWED_TYPES.includes(file.type)) {
      return NextResponse.json(
        { code: 'INVALID_FILE_TYPE', message: 'Only PDF files are supported', retryable: false } as APIError,
        { status: 400 }
      )
    }

    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { code: 'FILE_TOO_LARGE', message: `File size must be less than ${MAX_FILE_SIZE / 1024 / 1024}MB`, retryable: false } as APIError,
        { status: 400 }
      )
    }

    // Check user limits
    const limitsCheck = await checkUserLimits(user.id)
    if (!limitsCheck.hasCredits) {
      return NextResponse.json(
        { 
          code: 'INSUFFICIENT_CREDITS', 
          message: 'You have insufficient credits for this conversion',
          retryable: false
        } as APIError,
        { status: 403 }
      )
    }

    // Check file size against user's plan limit
    const maxFileSizeBytes = limitsCheck.maxFileSize * 1024 * 1024
    if (file.size > maxFileSizeBytes) {
      return NextResponse.json(
        { 
          code: 'FILE_TOO_LARGE', 
          message: `File size exceeds the ${limitsCheck.maxFileSize}MB limit for your plan`,
          retryable: false
        } as APIError,
        { status: 400 }
      )
    }

    // Convert file to buffer for processing
    const fileBuffer = Buffer.from(await file.arrayBuffer())
    
    // Create conversion record
    const conversionData = {
      user_id: user.id,
      original_filename: file.name,
      file_size: file.size,
      status: 'pending' as const
    }

    const conversion = await createConversion(conversionData)
    if (!conversion) {
      return NextResponse.json(
        { code: 'CONVERSION_CREATE_FAILED', message: 'Please try again', retryable: true } as APIError,
        { status: 500 }
      )
    }

    // Track conversion start event
    await trackEvent(
      user.id,
      'conversion_start',
      conversion.id,
      {
        file_name: file.name,
        file_size: file.size,
        subscription_tier: userProfile.subscription_tier
      }
    )

    // Deduct 1 credit for conversion
    await updateUserCredits(user.id, -1, 'conversion_started')

    // Send to n8n webhook for processing
    if (N8N_WEBHOOK_URL) {
      try {
        console.log(`Sending file to n8n webhook: ${file.name} (${file.size} bytes)`)
        
        const webhookPayload = {
          conversionId: conversion.id,
          userId: user.id,
          fileName: file.name,
          fileSize: file.size,
          fileData: fileBuffer.toString('base64'),
          callbackUrl: `${process.env.NEXT_PUBLIC_APP_URL}/api/webhooks/n8n`,
          secret: N8N_WEBHOOK_SECRET
        }

        // Debug the webhook secret
        console.log('Webhook URL:', N8N_WEBHOOK_URL)
        console.log('Auth header will be:', N8N_WEBHOOK_SECRET ? '[REDACTED]' : 'NOT_SET')
        
        const webhookResponse = await fetch(N8N_WEBHOOK_URL, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `${N8N_WEBHOOK_SECRET}` // Try with Bearer
          },
          body: JSON.stringify(webhookPayload)
        })

        if (!webhookResponse.ok) {
          const errorText = await webhookResponse.text()
          console.error('Webhook response error:', webhookResponse.status, errorText)
          throw new Error(`Webhook failed: ${webhookResponse.status} ${webhookResponse.statusText}`)
        }

        // Handle webhook response - it might not be JSON
        let webhookResult;
        const responseText = await webhookResponse.text()
        console.log('Webhook raw response:', responseText)
        
        try {
          webhookResult = JSON.parse(responseText)
          console.log('Webhook parsed response:', webhookResult)
        } catch (parseError) {
          console.log('Webhook response is not JSON, treating as success')
          webhookResult = { success: true, message: responseText }
        }

        // Update conversion status to processing
        await supabase
          .from('conversions')
          .update({ 
            status: 'processing',
            started_at: new Date().toISOString()
          })
          .eq('id', conversion.id)

      } catch (webhookError) {
        console.error('Webhook error:', webhookError)
        
        // Update conversion status to failed
        await supabase
          .from('conversions')
          .update({ 
            status: 'failed',
            error_message: `Failed to start processing: ${webhookError instanceof Error ? webhookError.message : 'Unknown error'}`,
            completed_at: new Date().toISOString()
          })
          .eq('id', conversion.id)

        // Refund 1 credit due to processing failure
        await updateUserCredits(user.id, +1, 'conversion_failed_refund')

        return NextResponse.json(
          { 
            code: 'PROCESSING_FAILED', 
            message: 'Failed to start conversion. Please try again.',
            retryable: true,
            debug: process.env.NODE_ENV === 'development' ? {
              webhookUrl: N8N_WEBHOOK_URL,
              error: webhookError instanceof Error ? webhookError.message : 'Unknown error'
            } : undefined
          } as APIError,
          { status: 500 }
        )
      }
    } else {
      console.log('N8N_WEBHOOK_URL not configured, using fallback processing...')
      
      // Fallback: simulate processing for development
      await supabase
        .from('conversions')
        .update({ 
          status: 'processing',
          started_at: new Date().toISOString()
        })
        .eq('id', conversion.id)

      // Simulate completion after 5 seconds
      setTimeout(async () => {
        await supabase
          .from('conversions')
          .update({ 
            status: 'completed',
            completed_at: new Date().toISOString(),
            download_url: `/api/download/${conversion.id}`,
            tables_extracted: 2,
            total_rows: 100,
            processing_time_ms: 5000
          })
          .eq('id', conversion.id)
      }, 5000)
    }

    // Return success response
    const response: ConversionResponse = {
      success: true,
      conversionId: conversion.id,
      status: 'processing',
      message: 'File uploaded successfully. Processing started.',
      estimatedTime: Math.ceil(file.size / (1024 * 1024)) * 30000 // Rough estimate: 30s per MB
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Conversion API error:', error)
    
    // Log more detailed error information
    if (error instanceof Error) {
      console.error('Error name:', error.name)
      console.error('Error message:', error.message)
      console.error('Error stack:', error.stack)
    }
    
    return NextResponse.json(
      { 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'An unexpected error occurred. Please try again.',
        retryable: true,
        debug: process.env.NODE_ENV === 'development' ? {
          errorMessage: error instanceof Error ? error.message : 'Unknown error',
          errorName: error instanceof Error ? error.name : 'UnknownError'
        } : undefined
      } as APIError,
      { status: 500 }
    )
  }
}

// Handle OPTIONS for CORS
export async function OPTIONS(request: NextRequest) {
  return new NextResponse(null, {
    status: 200,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}