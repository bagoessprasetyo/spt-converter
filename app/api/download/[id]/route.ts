import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getConversion, trackEvent } from '@/lib/supabase/conversions'
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
        { code: 'UNAUTHORIZED', message: 'Please log in to download files', retryable: false } as APIError,
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
        { code: 'ACCESS_DENIED', message: 'You do not have permission to download this file', retryable: false } as APIError,
        { status: 403 }
      )
    }

    // Check if conversion is completed
    if (conversion.status !== 'completed') {
      return NextResponse.json(
        { 
          code: 'CONVERSION_NOT_READY', 
          message: `Conversion is ${conversion.status}. Please wait for completion.`,
          retryable: true 
        } as APIError,
        { status: 400 }
      )
    }

    // Check if download URL exists
    if (!conversion.download_url) {
      return NextResponse.json(
        { code: 'DOWNLOAD_NOT_AVAILABLE', message: 'Download URL not found', retryable: false } as APIError,
        { status: 404 }
      )
    }

    try {
      // For development/demo purposes, we'll create a mock Excel file
      // In production, this would fetch from Supabase Storage or the actual converted file
      
      let fileBuffer: Buffer
      let fileName: string
      let contentType: string
      
      if (conversion.download_url.startsWith('http')) {
        // External URL - fetch the file
        const fileResponse = await fetch(conversion.download_url)
        
        if (!fileResponse.ok) {
          throw new Error('Failed to fetch converted file')
        }
        
        fileBuffer = Buffer.from(await fileResponse.arrayBuffer())
        fileName = conversion.original_filename.replace('.pdf', '.xlsx')
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
      } else if (conversion.download_url.startsWith('/api/download/')) {
        // For demo purposes, create a simple Excel-like response
        // In production, this would be the actual converted file from storage
        
        const mockExcelContent = createMockExcelFile(conversion.original_filename)
        fileBuffer = Buffer.from(mockExcelContent, 'utf-8')
        fileName = conversion.original_filename.replace('.pdf', '.xlsx')
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
        
      } else {
        // Supabase Storage URL
        const { data: fileData, error: downloadError } = await supabase.storage
          .from('conversions')
          .download(conversion.download_url)
        
        if (downloadError || !fileData) {
          throw new Error('Failed to download file from storage')
        }
        
        fileBuffer = Buffer.from(await fileData.arrayBuffer())
        fileName = conversion.original_filename.replace('.pdf', '.xlsx')
        contentType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      }

      // Track download event
      await trackEvent(
        user.id,
        'download',
        conversion.id,
        {
          file_name: fileName,
          file_size: fileBuffer.length
        }
      )

      // Note: Download tracking is handled via usage_analytics table through trackEvent

      // Return file with appropriate headers
      return new NextResponse(new Uint8Array(fileBuffer), {
        status: 200,
        headers: {
          'Content-Type': contentType,
          'Content-Disposition': `attachment; filename="${fileName}"`,
          'Content-Length': fileBuffer.length.toString(),
          'Cache-Control': 'private, no-cache, no-store, must-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0'
        }
      })

    } catch (downloadError) {
      console.error('Download error:', downloadError)
      
      return NextResponse.json(
        { 
          code: 'DOWNLOAD_FAILED', 
          message: 'Failed to retrieve the converted file. Please try again or contact support.',
          retryable: true 
        } as APIError,
        { status: 500 }
      )
    }

  } catch (error) {
    console.error('Download API error:', error)
    
    return NextResponse.json(
      { 
        code: 'INTERNAL_SERVER_ERROR', 
        message: 'An unexpected error occurred during download. Please try again.',
        retryable: true 
      } as APIError,
      { status: 500 }
    )
  }
}

// Create a mock Excel file for demo purposes
// In production, this would be replaced with actual file retrieval
function createMockExcelFile(originalFileName: string): string {
  const timestamp = new Date().toISOString()
  
  // This is a simplified representation - in production you'd use a proper Excel library
  const mockData = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <sheetData>
    <row r="1">
      <c r="A1" t="inlineStr"><is><t>Converted from: ${originalFileName}</t></is></c>
    </row>
    <row r="2">
      <c r="A2" t="inlineStr"><is><t>Conversion Date: ${timestamp}</t></is></c>
    </row>
    <row r="3">
      <c r="A3" t="inlineStr"><is><t>Status: Successfully converted</t></is></c>
    </row>
    <row r="4">
      <c r="A4" t="inlineStr"><is><t>Note: This is a demo conversion</t></is></c>
    </row>
  </sheetData>
</worksheet>`
  
  return mockData
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