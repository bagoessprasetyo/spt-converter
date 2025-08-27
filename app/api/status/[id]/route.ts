import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConversion } from '@/lib/supabase/conversions'
import { APIError } from '@/lib/supabase/types'

interface RouteParams {
  params: {
    id: string
  }
}

export async function GET(
  request: NextRequest,
  { params }: RouteParams
) {
  try {
    const { id } = params
    
    if (!id) {
      return NextResponse.json(
        { code: 'MISSING_CONVERSION_ID', message: 'Conversion ID is required', retryable: false } as APIError,
        { status: 400 }
      )
    }

    // Create Supabase client
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Please log in to check conversion status', retryable: false } as APIError,
        { status: 401 }
      )
    }

    // Get conversion details
    const conversion = await getConversion(id)
    
    if (!conversion) {
      return NextResponse.json(
        { code: 'CONVERSION_NOT_FOUND', message: 'The requested conversion does not exist', retryable: false } as APIError,
        { status: 404 }
      )
    }

    // Check if user owns this conversion
    if (conversion.user_id !== user.id) {
      return NextResponse.json(
        { code: 'ACCESS_DENIED', message: 'You do not have permission to access this conversion', retryable: false } as APIError,
        { status: 403 }
      )
    }

    // Smart progress calculation based on processing stages and file characteristics
    let progress = 0
    let currentStage = ''
    
    if (conversion.status === 'pending') {
      progress = 0
      currentStage = 'upload'
    } else if (conversion.status === 'processing') {
      const startTime = conversion.created_at ? new Date(conversion.created_at).getTime() : Date.now()
      const elapsed = Date.now() - startTime
      
      // Calculate estimated total time based on file size and complexity
      const fileSizeMB = (conversion.file_size || 1024000) / 1024 / 1024
      const baseTime = 30000 // 30 seconds base
      const sizeMultiplier = Math.log10(fileSizeMB + 1) * 15000 // Logarithmic scaling for size
      const estimatedTotal = Math.max(baseTime, baseTime + sizeMultiplier)
      
      // Define processing stages with time allocation
      const stages = [
        { name: 'upload', duration: 0.05, label: 'File Upload' },
        { name: 'parsing', duration: 0.25, label: 'PDF Parsing' },
        { name: 'extraction', duration: 0.50, label: 'Data Extraction' },
        { name: 'formatting', duration: 0.20, label: 'Excel Formatting' }
      ]
      
      const progressRatio = Math.min(elapsed / estimatedTotal, 0.95) // Cap at 95%
      progress = Math.floor(progressRatio * 100)
      
      // Determine current stage based on progress
      let cumulativeDuration = 0
      for (const stage of stages) {
        cumulativeDuration += stage.duration
        if (progressRatio <= cumulativeDuration) {
          currentStage = stage.name
          break
        }
      }
      
      // Fallback to last stage if we're near completion
      if (!currentStage || progress > 90) {
        currentStage = 'formatting'
      }
      
    } else if (conversion.status === 'completed') {
      progress = 100
      currentStage = 'completed'
    } else if (conversion.status === 'failed') {
      progress = 0
      currentStage = 'failed'
    }

    // Calculate estimated time remaining with improved accuracy
    let estimatedTime: number | undefined
    if (conversion.status === 'processing' && conversion.created_at) {
      const startTime = new Date(conversion.created_at).getTime()
      const elapsed = Date.now() - startTime
      
      // Use the same calculation as above for consistency
      const fileSizeMB = (conversion.file_size || 1024000) / 1024 / 1024
      const baseTime = 30000
      const sizeMultiplier = Math.log10(fileSizeMB + 1) * 15000
      const estimatedTotal = Math.max(baseTime, baseTime + sizeMultiplier)
      
      estimatedTime = Math.max(0, estimatedTotal - elapsed)
    }

    // Format response with enhanced data
    const response = {
      id: conversion.id,
      status: conversion.status,
      fileName: conversion.original_filename,
      fileSize: conversion.file_size,
      progress,
      currentStage,
      createdAt: conversion.created_at,
      updatedAt: conversion.updated_at,
      completedAt: conversion.status === 'completed' ? conversion.updated_at : undefined,
      downloadUrl: conversion.status === 'completed' ? conversion.download_url : undefined,
      error: conversion.error_message,
      estimatedTime,
      // Additional metadata for better UX
      processingTimeMs: conversion.status === 'completed' && conversion.created_at ? 
        new Date(conversion.updated_at).getTime() - new Date(conversion.created_at).getTime() : undefined,
      tablesExtracted: conversion.tables_extracted,
      totalRows: conversion.total_rows,
      // Add retry information for failed conversions
      canRetry: conversion.status === 'failed' && !conversion.error_message?.includes('invalid file'),
      // File metadata
      originalFilename: conversion.original_filename,
      convertedFilename: conversion.converted_filename
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Status API error:', error)
    
    return NextResponse.json(
      { 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to retrieve conversion status. Please try again.',
        retryable: true 
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
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  })
}