import { createClient } from './client'
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
  
  // Get user profile for credits info
  const { data: profile, error: profileError } = await supabase
    .from('user_profiles')
    .select('credits_remaining, subscription_tier')
    .eq('id', userId)
    .single()
  
  if (profileError) throw profileError
  
  // Get conversion stats for this month
  const thisMonth = new Date()
  thisMonth.setDate(1)
  thisMonth.setHours(0, 0, 0, 0)
  
  const { data: conversions, error: conversionError } = await supabase
    .from('conversions')
    .select('status, created_at, file_size')
    .eq('user_id', userId)
    .gte('created_at', thisMonth.toISOString())
  
  if (conversionError) throw conversionError
  
  // Get usage analytics for credit calculation
  const { data: analytics, error: analyticsError } = await supabase
    .from('usage_analytics')
    .select('event_type, created_at')
    .eq('user_id', userId)
    .gte('created_at', thisMonth.toISOString())
    .eq('event_type', 'conversion_started')
  
  if (analyticsError) throw analyticsError
  
  // Calculate credits used based on successful conversions
  const successfulConversions = conversions.filter(c => c.status === 'completed').length
  const failedConversions = conversions.filter(c => c.status === 'failed').length
  
  // Credit cost: 1 credit per conversion attempt
  const creditsUsed = analytics.length || (successfulConversions + failedConversions)
  
  // Calculate storage used (files from last 30 days only)
  const recentConversions = await supabase
    .from('conversions')
    .select('file_size, created_at')
    .eq('user_id', userId)
    .gte('created_at', startDate.toISOString())
    .eq('status', 'completed')
  
  const storageUsed = (recentConversions.data || []).reduce((sum, c) => sum + (c.file_size || 0), 0)
  
  const stats = {
    creditsUsed,
    creditsRemaining: profile.credits_remaining || 0,
    conversionsThisMonth: conversions.length,
    storageUsed, // in bytes
    successfulConversions,
    failedConversions,
    subscriptionTier: profile.subscription_tier,
    // Additional helpful stats
    successRate: conversions.length > 0 ? Math.round((successfulConversions / conversions.length) * 100) : 0,
    averageFileSize: conversions.length > 0 ? 
      conversions.reduce((sum, c) => sum + (c.file_size || 0), 0) / conversions.length : 0
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
    .select('max_file_size_mb, features')
    .eq('name', profile.subscription_tier?.charAt(0).toUpperCase() + profile.subscription_tier?.slice(1))
    .single()
  
  if (planError) throw planError
  
  return {
    hasCredits: (profile.credits_remaining || 0) > 0,
    creditsRemaining: profile.credits_remaining || 0,
    maxFileSize: plan.max_file_size_mb || 10,
    features: plan.features as any || {},
    subscriptionTier: profile.subscription_tier as SubscriptionTier
  }
}