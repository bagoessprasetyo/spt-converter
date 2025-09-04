import { createClient } from './server'
import { Database } from './types'
import { ConversionStatus, ConversionRequest, EventType, CompanySummary, TransactionData } from './types'

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
    total: conversions.length,
    completed: conversions.filter(c => c.status === 'completed').length,
    failed: conversions.filter(c => c.status === 'failed').length,
    processing: conversions.filter(c => c.status === 'processing').length,
    pending: conversions.filter(c => c.status === 'pending').length,
    totalTablesExtracted: conversions.reduce((sum, c) => sum + (c.tables_extracted || 0), 0),
    totalRowsProcessed: conversions.reduce((sum, c) => sum + (c.total_rows || 0), 0)
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

// Helper function to update conversion with summary and transaction data
export async function updateConversionDetails(
  id: string,
  summaries: CompanySummary[],
  transactionData: TransactionData[]
) {
  const supabase = createClient()
  
  const { data: conversion, error } = await supabase
    .from('conversions')
    .update({
      summaries: summaries as any,
      transaction_data: transactionData as any,
      updated_at: new Date().toISOString()
    })
    .eq('id', id)
    .select()
    .single()
  
  if (error) throw error
  return conversion
}