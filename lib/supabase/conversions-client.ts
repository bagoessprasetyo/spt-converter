import { createClient } from './client'
import { Database } from './types'
import { ConversionStatus, ConversionRequest, EventType } from './types'

type Conversion = Database['public']['Tables']['conversions']['Row']
type ConversionInsert = Database['public']['Tables']['conversions']['Insert']
type ConversionUpdate = Database['public']['Tables']['conversions']['Update']

export async function createConversion(data: ConversionInsert) {
  const supabase = createClient()
  
  const { data: conversion, error } = await supabase
    .from('conversions')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return conversion
}

export async function getConversion(id: string) {
  const supabase = createClient()
  
  const { data: conversion, error } = await supabase
    .from('conversions')
    .select('*')
    .eq('id', id)
    .single()
  
  if (error) throw error
  return conversion
}

export async function updateConversionStatus(
  id: string,
  status: ConversionStatus,
  updates?: Partial<ConversionUpdate>
) {
  const supabase = createClient()
  
  const updateData: ConversionUpdate = {
    status,
    updated_at: new Date().toISOString(),
    ...updates
  }
  
  const { data: conversion, error } = await supabase
    .from('conversions')
    .update(updateData)
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return conversion
}

export async function getUserConversions(userId: string, limit = 10) {
  const supabase = createClient()
  
  const { data: conversions, error } = await supabase
    .from('conversions')
    .select('*')
    .eq('user_id', userId)
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  return conversions
}

export async function deleteExpiredConversions() {
  const supabase = createClient()
  
  const { data: deletedConversions, error } = await supabase
    .from('conversions')
    .delete()
    .lt('expires_at', new Date().toISOString())
    .select()
  
  if (error) throw error
  return deletedConversions
}

export async function getConversionStats(userId?: string) {
  const supabase = createClient()
  
  let query = supabase
    .from('conversions')
    .select('status, created_at, tables_extracted, total_rows')
  
  if (userId) {
    query = query.eq('user_id', userId)
  }
  
  const { data: conversions, error } = await query
  
  if (error) throw error
  
  const stats = {
    totalConversions: conversions.length,
    successfulConversions: conversions.filter(c => c.status === 'completed').length,
    failedConversions: conversions.filter(c => c.status === 'failed').length,
    totalFilesProcessed: conversions.length,
    averageProcessingTime: 0 // Calculate if needed
  }
  
  return stats
}

// Analytics functions
export async function trackEvent(
  userId: string,
  eventType: EventType,
  conversionId?: string,
  metadata?: Record<string, any>
) {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('usage_analytics')
    .insert({
      user_id: userId,
      conversion_id: conversionId,
      event_type: eventType,
      metadata: metadata || null
    })
  
  if (error) throw error
}

export async function getUserAnalytics(userId: string, days = 30) {
  const supabase = createClient()
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const { data: analytics, error } = await supabase
    .from('usage_analytics')
    .select('*')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: false })
  
  if (error) throw error
  return analytics
}

export async function deleteConversion(id: string) {
  const supabase = createClient()
  
  console.log(`[DELETE] Attempting to delete conversion: ${id}`)
  
  // First check if the conversion exists and get user_id for validation
  const { data: existingConversion, error: fetchError } = await supabase
    .from('conversions')
    .select('id, user_id, original_filename, status')
    .eq('id', id)
    .single()
  
  if (fetchError) {
    console.error('[DELETE] Conversion not found:', fetchError)
    if (fetchError.code === 'PGRST116') {
      throw new Error('Conversion not found - it may have already been deleted')
    }
    throw new Error(`Failed to find conversion: ${fetchError.message}`)
  }
  
  console.log(`[DELETE] Found conversion: ${existingConversion.original_filename} (${existingConversion.status})`)
  
  // Delete related analytics records first to avoid foreign key constraint issues
  console.log(`[DELETE] Cleaning up related analytics records...`)
  const { error: analyticsDeleteError } = await supabase
    .from('usage_analytics')
    .delete()
    .eq('conversion_id', id)
  
  if (analyticsDeleteError) {
    console.warn('[DELETE] Failed to delete analytics records (non-critical):', analyticsDeleteError)
    // Continue with conversion deletion even if analytics cleanup fails
  }
  
  // Perform the main conversion deletion
  const { data: deletedConversions, error: deleteError } = await supabase
    .from('conversions')
    .delete()
    .eq('id', id)
    .select()
  
  if (deleteError) {
    console.error('[DELETE] Delete operation failed:', deleteError)
    
    // Provide more specific error messages
    if (deleteError.code === 'PGRST116') {
      throw new Error('Conversion not found or already deleted')
    } else if (deleteError.code?.startsWith('23')) {
      throw new Error('Cannot delete conversion due to database constraints')
    } else {
      throw new Error(`Delete failed: ${deleteError.message}`)
    }
  }
  
  // Check if any rows were actually deleted
  if (!deletedConversions || deletedConversions.length === 0) {
    console.error('[DELETE] No rows were deleted')
    throw new Error('Conversion could not be deleted - it may not exist')
  }
  
  console.log(`[DELETE] Successfully deleted conversion and ${deletedConversions.length > 1 ? 'multiple records' : '1 record'}`)
  
  // Log the deletion for audit purposes
  try {
    await supabase
      .from('usage_analytics')
      .insert({
        user_id: existingConversion.user_id,
        event_type: 'conversion_deleted',
        metadata: {
          deleted_conversion_id: id,
          original_filename: existingConversion.original_filename,
          status_when_deleted: existingConversion.status,
          deleted_at: new Date().toISOString()
        }
      })
  } catch (logError) {
    console.warn('[DELETE] Failed to log deletion event (non-critical):', logError)
  }
  
  // Return the first deleted conversion (should only be one)
  return deletedConversions[0]
}

export async function retryConversion(id: string) {
  const supabase = createClient()
  
  console.log(`[CREDIT SYSTEM] Retrying conversion ${id}`)
  
  // Get conversion details first to check current status
  const { data: existingConversion, error: fetchError } = await supabase
    .from('conversions')
    .select('status, user_id, original_filename')
    .eq('id', id)
    .single()
  
  if (fetchError) throw fetchError
  
  // Only allow retry for failed conversions
  if (existingConversion.status !== 'failed') {
    throw new Error('Can only retry failed conversions')
  }
  
  // Validate user_id exists
  if (!existingConversion.user_id) {
    throw new Error('Conversion has no associated user')
  }
  
  // Check if user has credits before allowing retry
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('credits_remaining')
    .eq('id', existingConversion.user_id)
    .single()
  
  if (profileError) throw profileError
  
  if ((profile.credits_remaining || 0) < 1) {
    throw new Error('Insufficient credits to retry conversion')
  }
  
  // Update conversion status to pending
  const { data: conversion, error } = await supabase
    .from('conversions')
    .update({
      status: 'pending',
      error_message: null,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  
  console.log(`[CREDIT SYSTEM] Conversion ${id} queued for retry`)
  return conversion
}