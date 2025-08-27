import { createClient } from './server'
import { Database } from './types'
import { SubscriptionTier } from './types'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']
type UserProfileInsert = Database['public']['Tables']['user_profiles']['Insert']
type UserProfileUpdate = Database['public']['Tables']['user_profiles']['Update']
type SubscriptionPlan = Database['public']['Tables']['subscription_plans']['Row']

export async function getUserProfile(userId: string) {
  const supabase = createClient()
  
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('*')
    .eq('id', userId)
    .single()
  
  if (error) throw error
  return profile
}

export async function updateUserProfile(userId: string, updates: UserProfileUpdate) {
  const supabase = createClient()
  
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update({
      ...updates,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()
  
  if (error) throw error
  return profile
}

export async function createUserProfile(data: UserProfileInsert) {
  const supabase = createClient()
  
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .insert(data)
    .select()
    .single()
  
  if (error) throw error
  return profile
}

export async function updateUserCredits(userId: string, creditDelta: number, reason?: string) {
  const supabase = createClient()
  
  console.log(`[CREDIT SYSTEM] Updating credits for user ${userId}: ${creditDelta > 0 ? '+' : ''}${creditDelta} (${reason || 'no reason specified'})`)
  
  // First get current credits
  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single()
  
  if (fetchError) {
    console.error('[CREDIT SYSTEM] Failed to fetch user profile:', fetchError)
    throw fetchError
  }
  
  const currentCredits = profile.credits_remaining || 0
  
  // Calculate new credits (creditDelta is positive for additions, negative for deductions)
  const newCredits = Math.max(0, currentCredits + creditDelta)
  
  console.log(`[CREDIT SYSTEM] Credit calculation: ${currentCredits} + (${creditDelta}) = ${newCredits}`)
  
  // Prevent operation if it would result in negative credits and it's a deduction
  if (creditDelta < 0 && currentCredits + creditDelta < 0) {
    const errorMsg = `Insufficient credits: user has ${currentCredits}, attempted to deduct ${Math.abs(creditDelta)}`
    console.error(`[CREDIT SYSTEM] ${errorMsg}`)
    throw new Error(errorMsg)
  }
  
  // Update credits atomically
  const { data: updatedProfile, error } = await supabase
    .from('user_profiles')
    .update({ 
      credits_remaining: newCredits,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .eq('credits_remaining', currentCredits) // Optimistic locking
    .select()
    .single()
  
  if (error) {
    console.error('[CREDIT SYSTEM] Failed to update credits:', error)
    throw error
  }
  
  if (!updatedProfile) {
    // This means the optimistic lock failed - credits were changed by another operation
    console.error('[CREDIT SYSTEM] Optimistic lock failed - credits were modified by another operation')
    throw new Error('Credit operation failed due to concurrent modification. Please retry.')
  }
  
  console.log(`[CREDIT SYSTEM] Credits updated successfully: ${currentCredits} -> ${newCredits}`)
  
  // Log the credit transaction for audit trail
  try {
    await supabase
      .from('usage_analytics')
      .insert({
        user_id: userId,
        event_type: 'credit_change',
        metadata: {
          credit_delta: creditDelta,
          credits_before: currentCredits,
          credits_after: newCredits,
          reason: reason || 'unknown',
          timestamp: new Date().toISOString()
        }
      })
  } catch (logError) {
    console.error('[CREDIT SYSTEM] Failed to log credit transaction:', logError)
    // Don't fail the operation if logging fails
  }
  
  return updatedProfile
}

export async function refillUserCredits(userId: string, subscriptionTier: SubscriptionTier) {
  const supabase = createClient()
  
  console.log(`[CREDIT SYSTEM] Refilling credits for user ${userId} with ${subscriptionTier} plan`)
  
  // Get subscription plan details
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('credits_per_month')
    .eq('name', subscriptionTier.charAt(0).toUpperCase() + subscriptionTier.slice(1))
    .single()
  
  if (planError) {
    console.error('[CREDIT SYSTEM] Failed to get subscription plan:', planError)
    throw planError
  }
  
  const creditsToAdd = plan.credits_per_month || 10
  
  // Get current credits to calculate the refill amount
  const { data: profile, error: fetchError } = await supabase
    .from('user_profiles')
    .select('credits_remaining')
    .eq('id', userId)
    .single()
  
  if (fetchError) throw fetchError
  
  const currentCredits = profile.credits_remaining || 0
  
  // Set to full monthly allocation (not additive)
  const creditDelta = creditsToAdd - currentCredits
  
  if (creditDelta !== 0) {
    return await updateUserCredits(userId, creditDelta, `monthly_refill_${subscriptionTier}`)
  }
  
  console.log(`[CREDIT SYSTEM] No refill needed - user already has ${currentCredits} credits`)
  return profile
}

export async function upgradeUserSubscription(userId: string, newTier: SubscriptionTier) {
  const supabase = createClient()
  
  // Get new subscription plan details
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('credits_per_month')
    .eq('name', newTier.charAt(0).toUpperCase() + newTier.slice(1))
    .single()
  
  if (planError) throw planError
  
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .update({ 
      subscription_tier: newTier,
      credits_remaining: plan.credits_per_month || 10,
      updated_at: new Date().toISOString()
    })
    .eq('id', userId)
    .select()
    .single()
  
  if (error) throw error
  return profile
}

export async function getSubscriptionPlans() {
  const supabase = createClient()
  
  const { data: plans, error } = await supabase
    .from('subscription_plans')
    .select('*')
    .eq('is_active', true)
    .order('price_monthly', { ascending: true })
  
  if (error) throw error
  return plans
}

export async function getUserUsageStats(userId: string, days = 30) {
  const supabase = createClient()
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  // Get conversion stats
  const { data: conversions, error: conversionError } = await supabase
    .from('conversions')
    .select('status, created_at, file_size')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
  
  if (conversionError) throw conversionError
  
  // Get analytics events
  const { data: events, error: eventsError } = await supabase
    .from('usage_analytics')
    .select('event_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
  
  if (eventsError) throw eventsError
  
  const stats = {
    totalConversions: conversions.length,
    successfulConversions: conversions.filter(c => c.status === 'completed').length,
    failedConversions: conversions.filter(c => c.status === 'failed').length,
    totalFileSize: conversions.reduce((sum, c) => sum + (c.file_size || 0), 0),
    averageFileSize: conversions.length > 0 ? 
      conversions.reduce((sum, c) => sum + (c.file_size || 0), 0) / conversions.length : 0,
    eventCounts: events.reduce((acc, event) => {
      acc[event.event_type || 'unknown'] = (acc[event.event_type || 'unknown'] || 0) + 1
      return acc
    }, {} as Record<string, number>)
  }
  
  return stats
}

export async function checkUserLimits(userId: string) {
  const supabase = createClient()
  
  const { data: profile, error } = await supabase
    .from('user_profiles')
    .select('subscription_tier, credits_remaining')
    .eq('id', userId)
    .single()
  
  if (error) throw error
  
  // Get subscription plan limits
  const { data: plan, error: planError } = await supabase
    .from('subscription_plans')
    .select('max_file_size_mb, features, credits_per_month')
    .eq('name', profile.subscription_tier?.charAt(0).toUpperCase() + profile.subscription_tier?.slice(1))
    .single()
  
  if (planError) throw planError
  
  const creditsRemaining = profile.credits_remaining || 0
  const creditsPerMonth = plan.credits_per_month || 5
  
  return {
    hasCredits: creditsRemaining > 0,
    creditsRemaining,
    maxFileSize: plan.max_file_size_mb || 10,
    features: plan.features as any || {},
    subscriptionTier: profile.subscription_tier as SubscriptionTier,
    // Credit warnings
    isLowOnCredits: creditsRemaining <= Math.ceil(creditsPerMonth * 0.2), // 20% remaining
    isCriticallyLow: creditsRemaining <= 1,
    creditsPercentRemaining: Math.round((creditsRemaining / creditsPerMonth) * 100)
  }
}

// Helper function to get credit transaction history
export async function getCreditTransactionHistory(userId: string, limit = 50) {
  const supabase = createClient()
  
  const { data: transactions, error } = await supabase
    .from('usage_analytics')
    .select('*')
    .eq('user_id', userId)
    .eq('event_type', 'credit_change')
    .order('created_at', { ascending: false })
    .limit(limit)
  
  if (error) throw error
  
  return transactions.map(t => {
    const metadata = t.metadata as any
    return {
      id: t.id,
      timestamp: t.created_at,
      creditDelta: metadata?.credit_delta || 0,
      creditsBefore: metadata?.credits_before || 0,
      creditsAfter: metadata?.credits_after || 0,
      reason: metadata?.reason || 'unknown'
    }
  })
}

// Helper function to calculate daily credit usage
export async function getDailyCreditUsage(userId: string, days = 30) {
  const supabase = createClient()
  
  const startDate = new Date()
  startDate.setDate(startDate.getDate() - days)
  
  const { data: transactions, error } = await supabase
    .from('usage_analytics')
    .select('created_at, metadata')
    .eq('user_id', userId)
    .eq('event_type', 'credit_change')
    .gte('created_at', startDate.toISOString())
    .order('created_at', { ascending: true })
  
  if (error) throw error
  
  const dailyUsage: Record<string, number> = {}
  
  transactions.forEach(transaction => {
    const date = new Date(transaction.created_at).toISOString().split('T')[0]
    const metadata = transaction.metadata as any
    const delta = metadata?.credit_delta || 0
    
    if (!dailyUsage[date]) dailyUsage[date] = 0
    if (delta < 0) { // Only count deductions (usage)
      dailyUsage[date] += Math.abs(delta)
    }
  })
  
  return dailyUsage
}