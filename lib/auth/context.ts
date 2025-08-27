'use client'

import React, { createContext, useContext, useEffect, useState } from 'react'
import { User, Session } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { getUserProfile } from '@/lib/supabase/users-client'
import type { Database } from '@/lib/supabase/types'

type UserProfile = Database['public']['Tables']['user_profiles']['Row']

interface AuthContextType {
  user: User | null
  profile: UserProfile | null
  session: Session | null
  loading: boolean
  signIn: (email: string, password: string) => Promise<{ error: any }>
  signUp: (email: string, password: string, fullName?: string) => Promise<{ error: any }>
  signOut: () => Promise<void>
  refreshProfile: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [profile, setProfile] = useState<UserProfile | null>(null)
  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  
  const supabase = createClient()

  const refreshProfile = async () => {
    if (user) {
      try {
        const userProfile = await getUserProfile(user.id)
        setProfile(userProfile)
      } catch (error) {
        console.error('Error fetching user profile:', error)
        setProfile(null)
      }
    } else {
      setProfile(null)
    }
  }

  useEffect(() => {
    // Get initial session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)
    })

    // Listen for auth changes
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event: string, session: Session | null) => {
      setSession(session)
      setUser(session?.user ?? null)
      setLoading(false)

      if (event === 'SIGNED_IN' || event === 'TOKEN_REFRESHED') {
        // Refresh profile when user signs in or token refreshes
        if (session?.user) {
          await refreshProfile()
        }
      } else if (event === 'SIGNED_OUT') {
        setProfile(null)
      }
    })

    return () => subscription.unsubscribe()
  }, [])

  // Fetch profile when user changes
  useEffect(() => {
    if (user && !loading) {
      refreshProfile()
    }
  }, [user, loading])

  const signIn = async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    })
    return { error }
  }

  const signUp = async (email: string, password: string, fullName?: string) => {
    const { error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: {
          full_name: fullName,
        },
      },
    })
    return { error }
  }

  const signOut = async () => {
    await supabase.auth.signOut()
  }

  const contextValue: AuthContextType = {
    user,
    profile,
    session,
    loading,
    signIn,
    signUp,
    signOut,
    refreshProfile,
  }

  return React.createElement(
    AuthContext.Provider,
    { value: contextValue },
    children
  )
}

export function useAuth() {
  const context = useContext(AuthContext)
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}

// Hook for checking if user has sufficient credits
export function useCredits() {
  const { profile, refreshProfile } = useAuth()
  
  const hasCredits = (creditsNeeded = 1) => {
    return (profile?.credits_remaining ?? 0) >= creditsNeeded
  }
  
  const getCreditsRemaining = () => {
    return profile?.credits_remaining ?? 0
  }
  
  return {
    hasCredits,
    getCreditsRemaining,
    refreshProfile,
    creditsRemaining: profile?.credits_remaining ?? 0,
    subscriptionTier: profile?.subscription_tier ?? 'free'
  }
}

// Hook for checking user subscription limits
export function useSubscription() {
  const { profile } = useAuth()
  
  const isFreeTier = profile?.subscription_tier === 'free'
  const isProTier = profile?.subscription_tier === 'pro'
  const isBusinessTier = profile?.subscription_tier === 'business'
  
  const getMaxFileSize = () => {
    switch (profile?.subscription_tier) {
      case 'pro':
        return 50 // MB
      case 'business':
        return 100 // MB
      default:
        return 10 // MB
    }
  }
  
  const hasFeature = (feature: string) => {
    switch (feature) {
      case 'batchProcessing':
        return !isFreeTier
      case 'priorityProcessing':
        return !isFreeTier
      case 'apiAccess':
        return isBusinessTier
      default:
        return false
    }
  }
  
  return {
    subscriptionTier: profile?.subscription_tier ?? 'free',
    isFreeTier,
    isProTier,
    isBusinessTier,
    getMaxFileSize,
    hasFeature
  }
}