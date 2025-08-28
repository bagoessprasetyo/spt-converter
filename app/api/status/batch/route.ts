import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { ConversionData } from '@/lib/stores/conversion-store'

const MAX_BATCH_SIZE = 50 // Limit batch size to prevent abuse

export async function GET(request: NextRequest) {
  try {
    const supabase = createClient()
    
    // Check authentication
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Parse conversion IDs from query params
    const { searchParams } = new URL(request.url)
    const idsParam = searchParams.get('ids')
    
    if (!idsParam) {
      return NextResponse.json(
        { error: 'Missing ids parameter' },
        { status: 400 }
      )
    }

    const conversionIds = idsParam.split(',').map(id => id.trim()).filter(Boolean)
    
    if (conversionIds.length === 0) {
      return NextResponse.json(
        { error: 'No valid conversion IDs provided' },
        { status: 400 }
      )
    }

    if (conversionIds.length > MAX_BATCH_SIZE) {
      return NextResponse.json(
        { error: `Too many conversions requested. Maximum ${MAX_BATCH_SIZE} allowed.` },
        { status: 400 }
      )
    }

    console.log(`[BATCH STATUS] Fetching status for ${conversionIds.length} conversions for user ${user.id}`)

    // Fetch conversions from database
    const { data: conversions, error } = await supabase
      .from('conversions')
      .select('*')
      .in('id', conversionIds)
      .eq('user_id', user.id) // Security: only return user's own conversions

    if (error) {
      console.error('[BATCH STATUS ERROR]', error)
      return NextResponse.json(
        { error: 'Failed to fetch conversions' },
        { status: 500 }
      )
    }

    // Calculate progress for each conversion
    const enrichedConversions: ConversionData[] = conversions.map(conversion => {
      let progress = 0
      let currentStage = 'Initializing'

      switch (conversion.status) {
        case 'pending':
          progress = 5
          currentStage = 'Queued for processing'
          break
        case 'processing':
          // Calculate progress based on processing time
          const startedAt = (conversion as any).started_at || conversion.created_at
          const processingStarted = new Date(startedAt)
          const processingTime = Date.now() - processingStarted.getTime()
          const estimatedTotalTime = Math.max(30000, (conversion.file_size || 1000000) / 1000000 * 30000) // ~30s per MB, minimum 30s
          progress = Math.min(95, Math.max(10, (processingTime / estimatedTotalTime) * 80 + 10))
          
          // Determine stage based on progress
          if (progress < 30) {
            currentStage = 'Analyzing PDF structure'
          } else if (progress < 60) {
            currentStage = 'Extracting tables'
          } else {
            currentStage = 'Generating Excel file'
          }
          break
        case 'completed':
          progress = 100
          currentStage = 'Completed'
          break
        case 'failed':
          progress = 0
          currentStage = 'Failed'
          break
      }

      return {
        ...conversion,
        progress: Math.round(progress),
        currentStage
      } as ConversionData
    })

    // Log cache headers for debugging
    const response = NextResponse.json(enrichedConversions)
    response.headers.set('Cache-Control', 'no-cache, no-store, must-revalidate')
    response.headers.set('Pragma', 'no-cache')
    response.headers.set('Expires', '0')

    console.log(`[BATCH STATUS] Returning ${enrichedConversions.length} conversions`)
    
    return response

  } catch (error) {
    console.error('[BATCH STATUS API ERROR]', error)
    
    return NextResponse.json(
      { error: 'Internal server error' },
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
      'Cache-Control': 'no-cache',
    },
  })
}