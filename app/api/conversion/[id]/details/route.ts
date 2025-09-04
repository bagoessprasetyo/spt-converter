import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConversion } from '@/lib/supabase/conversions'
import { APIError, CompanySummary, TransactionData } from '@/lib/supabase/types'

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

    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { code: 'UNAUTHORIZED', message: 'Please log in to view conversion details', retryable: false } as APIError,
        { status: 401 }
      )
    }

    // Get conversion details with all data
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

    // Format detailed response
    const response = {
      id: conversion.id,
      originalFilename: conversion.original_filename,
      convertedFilename: conversion.converted_filename,
      status: conversion.status,
      fileSize: conversion.file_size,
      errorMessage: conversion.error_message,
      downloadUrl: conversion.download_url,
      tablesExtracted: conversion.tables_extracted,
      totalRows: conversion.total_rows,
      processingTimeMs: conversion.processing_time_ms,
      createdAt: conversion.created_at,
      updatedAt: conversion.updated_at,
      summaries: conversion.summaries as unknown as CompanySummary[] | null,
      transactionData: conversion.transaction_data as unknown as TransactionData[] | null,
      // Additional calculated fields
      hasDetailedData: !!(conversion.summaries && conversion.transaction_data),
      totalCompanies: conversion.summaries ? (conversion.summaries as unknown as CompanySummary[]).length : 0,
      totalTax: conversion.summaries ? 
        (conversion.summaries as unknown as CompanySummary[]).reduce((sum, company: any) => 
          sum + (company.json?.totalPajak || 0), 0) : 0
    }

    return NextResponse.json(response, { status: 200 })

  } catch (error) {
    console.error('Conversion details API error:', error)
    
    return NextResponse.json(
      { 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'Failed to retrieve conversion details. Please try again.',
        retryable: true 
      } as APIError,
      { status: 500 }
    )
  }
}