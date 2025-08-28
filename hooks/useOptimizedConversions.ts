'use client'

import { useEffect, useCallback, useMemo } from 'react'
import { useConversionStore } from '@/lib/stores/conversion-store'
import type { ConversionData } from '@/lib/stores/conversion-store'
import type { ConversionStatus } from '@/lib/supabase/types'

interface UseOptimizedConversionsOptions {
  userId?: string
  autoRefresh?: boolean
  conversionIds?: string[]
}

interface UseOptimizedConversionsResult {
  // Data
  conversions: ConversionData[]
  conversion?: ConversionData
  activeConversions: ConversionData[]
  
  // Status
  loading: boolean
  error: string | null
  
  // Actions
  refresh: () => Promise<void>
  startPolling: (ids: string[]) => void
  stopPolling: (id?: string) => void
  
  // Individual conversion helpers
  getConversion: (id: string) => ConversionData | undefined
  isConversionLoading: (id: string) => boolean
  getConversionError: (id: string) => string | undefined
  
  // Status helpers
  hasActiveConversions: boolean
  completedCount: number
  failedCount: number
  processingCount: number
}

export function useOptimizedConversions(
  options: UseOptimizedConversionsOptions = {}
): UseOptimizedConversionsResult {
  const {
    userId,
    autoRefresh = true,
    conversionIds
  } = options

  // Get store functions directly - they are stable
  const store = useConversionStore()
  
  const {
    getConversion,
    getConversions,
    getUserConversions,
    isLoading,
    getError,
    fetchMultipleConversions,
    startPolling,
    stopPolling,
    isPollingActive,
  } = store

  // Get relevant conversions based on options - use store selector to prevent loops
  const conversions = useMemo(() => {
    if (conversionIds) {
      return conversionIds.map(id => getConversion(id)).filter(Boolean) as ConversionData[]
    } else if (userId) {
      return getUserConversions(userId)
    } else {
      return getConversions()
    }
  }, [conversionIds, userId, getConversion, getUserConversions, getConversions])

  const activeConversions = useMemo(() => {
    const filtered = conversions.filter(c => c.status === 'pending' || c.status === 'processing')
    return filtered
  }, [conversions])

  // Calculate aggregate loading state
  const loading = useMemo(() => {
    if (conversionIds) {
      return conversionIds.some(id => isLoading(id))
    }
    return conversions.some(c => isLoading(c.id))
  }, [conversionIds, conversions, isLoading])

  // Calculate aggregate error state
  const error = useMemo(() => {
    if (conversionIds) {
      const errors = conversionIds.map(id => getError(id)).filter(Boolean)
      return errors.length > 0 ? errors[0]! : null
    }
    const errors = conversions.map(c => getError(c.id)).filter(Boolean)
    return errors.length > 0 ? errors[0]! : null
  }, [conversionIds, conversions, getError])

  // Status counters
  const statusCounts = useMemo(() => {
    const counts = {
      completed: 0,
      failed: 0,
      processing: 0,
      pending: 0
    }
    
    conversions.forEach(c => {
      if (c.status in counts) {
        counts[c.status as keyof typeof counts]++
      }
    })
    
    return counts
  }, [conversions])

  // Refresh function - removed conversions dependency to prevent loops
  const refresh = useCallback(async () => {
    if (!conversionIds?.length) return

    try {
      await fetchMultipleConversions(conversionIds)
    } catch (error) {
      console.error('[useOptimizedConversions] Refresh failed:', error)
    }
  }, [conversionIds, fetchMultipleConversions])

  // Auto-refresh effect - run when conversionIds change
  useEffect(() => {
    if (!autoRefresh || !conversionIds?.length) return

    let cancelled = false
    
    fetchMultipleConversions(conversionIds).catch(error => {
      if (!cancelled) {
        console.error('[useOptimizedConversions] Initial fetch failed:', error)
      }
    })
    
    return () => {
      cancelled = true
    }
  }, [autoRefresh, conversionIds, fetchMultipleConversions])

  // Don't log conversions updates to prevent infinite loops

  // Polling management effect
  useEffect(() => {
    if (!autoRefresh) return

    const activeIds = activeConversions.map(c => c.id)
    
    if (activeIds.length > 0) {
      startPolling(activeIds)
    } else {
      // Stop all polling if no active conversions
      if (conversionIds) {
        conversionIds.forEach(id => {
          if (isPollingActive(id)) {
            stopPolling(id)
          }
        })
      }
    }

    return () => {
      // Only stop polling if we were managing it
      if (conversionIds) {
        conversionIds.forEach(id => {
          if (isPollingActive(id)) {
            stopPolling(id)
          }
        })
      }
    }
  }, [activeConversions, autoRefresh, conversionIds, startPolling, stopPolling, isPollingActive])

  // Individual conversion helper functions
  const isConversionLoading = useCallback((id: string) => {
    return isLoading(id)
  }, [isLoading])

  const getConversionError = useCallback((id: string) => {
    return getError(id)
  }, [getError])

  // Get single conversion if only one ID provided
  const singleConversion = conversionIds?.length === 1 ? getConversion(conversionIds[0]) : undefined

  return {
    // Data
    conversions,
    conversion: singleConversion,
    activeConversions,
    
    // Status
    loading,
    error,
    
    // Actions
    refresh,
    startPolling,
    stopPolling,
    
    // Individual conversion helpers
    getConversion,
    isConversionLoading,
    getConversionError,
    
    // Status helpers
    hasActiveConversions: activeConversions.length > 0,
    completedCount: statusCounts.completed,
    failedCount: statusCounts.failed,
    processingCount: statusCounts.processing + statusCounts.pending,
  }
}

// Specialized hook for single conversion
export function useOptimizedConversion(conversionId: string) {
  const result = useOptimizedConversions({
    conversionIds: [conversionId],
    autoRefresh: true
  })

  return {
    ...result,
    conversion: result.conversion,
    
    // Single conversion specific helpers
    isPending: result.conversion?.status === 'pending',
    isProcessing: result.conversion?.status === 'processing',
    isCompleted: result.conversion?.status === 'completed',
    isFailed: result.conversion?.status === 'failed',
    canDownload: result.conversion?.status === 'completed' && !!result.conversion?.download_url,
    progress: result.conversion?.progress || 0,
    currentStage: result.conversion?.currentStage || 'Initializing',
  }
}

// Hook for dashboard-style usage
export function useOptimizedDashboard(userId: string) {
  return useOptimizedConversions({
    userId,
    autoRefresh: true
  })
}