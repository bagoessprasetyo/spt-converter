'use client'

import { create } from 'zustand'
import { subscribeWithSelector } from 'zustand/middleware'
import type { ConversionStatus } from '@/lib/supabase/types'

export interface ConversionData {
  id: string
  status: ConversionStatus
  user_id: string
  original_filename: string
  converted_filename?: string | null
  file_size: number | null
  progress: number
  currentStage?: string
  created_at: string
  updated_at: string
  completed_at?: string | null
  download_url?: string | null
  error_message?: string | null
  processing_time_ms?: number | null
  tables_extracted: number
  total_rows: number
  started_at?: string | null
  expires_at?: string | null
  options?: Record<string, any> | null
}

interface RequestCache {
  data: ConversionData | ConversionData[]
  timestamp: number
  expires: number
}

interface ConversionStore {
  // State
  conversions: Map<string, ConversionData>
  requestCache: Map<string, RequestCache>
  activePolling: Set<string>
  pollingManager: NodeJS.Timeout | null
  lastBatchFetch: number
  loading: Map<string, boolean>
  errors: Map<string, string>

  // Getters
  getConversion: (id: string) => ConversionData | undefined
  getConversions: () => ConversionData[]
  getUserConversions: (userId: string) => ConversionData[]
  getActiveConversions: () => ConversionData[]
  isLoading: (id: string) => boolean
  getError: (id: string) => string | undefined

  // Actions
  setConversion: (conversion: ConversionData) => void
  setConversions: (conversions: ConversionData[]) => void
  updateConversion: (id: string, updates: Partial<ConversionData>) => void
  removeConversion: (id: string) => void
  setLoading: (id: string, loading: boolean) => void
  setError: (id: string, error: string | null) => void
  clearError: (id: string) => void

  // Cache management
  setCacheData: (key: string, data: any, ttl?: number) => void
  getCacheData: (key: string) => any | null
  clearCache: (key?: string) => void

  // Polling management
  startPolling: (conversionIds: string[]) => void
  stopPolling: (conversionId?: string) => void
  isPollingActive: (id: string) => boolean

  // Batch operations
  fetchMultipleConversions: (ids: string[]) => Promise<ConversionData[]>
  fetchUserConversions: (userId: string) => Promise<ConversionData[]>
  refreshActiveConversions: () => Promise<void>

  // Reset
  reset: () => void
}

const CACHE_TTL = 30000 // 30 seconds
const MAX_POLLING_INTERVAL = 10000 // 10 seconds
const MIN_POLLING_INTERVAL = 3000 // 3 seconds (as requested by user)

export const useConversionStore = create<ConversionStore>()(
  subscribeWithSelector((set, get) => ({
    // Initial state
    conversions: new Map(),
    requestCache: new Map(),
    activePolling: new Set(),
    pollingManager: null,
    lastBatchFetch: 0,
    loading: new Map(),
    errors: new Map(),

    // Getters
    getConversion: (id: string) => {
      return get().conversions.get(id)
    },

    getConversions: () => {
      return Array.from(get().conversions.values())
    },

    getUserConversions: (userId: string) => {
      return Array.from(get().conversions.values())
        .filter(c => c.user_id === userId)
        .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
    },

    getActiveConversions: () => {
      return Array.from(get().conversions.values())
        .filter(c => c.status === 'pending' || c.status === 'processing')
    },

    isLoading: (id: string) => {
      return get().loading.get(id) || false
    },

    getError: (id: string) => {
      return get().errors.get(id)
    },

    // Actions
    setConversion: (conversion: ConversionData) => {
      set((state) => {
        const newConversions = new Map(state.conversions)
        newConversions.set(conversion.id, conversion)
        return { conversions: newConversions }
      })
    },

    setConversions: (conversions: ConversionData[]) => {
      set((state) => {
        const newConversions = new Map(state.conversions)
        conversions.forEach(c => newConversions.set(c.id, c))
        return { conversions: newConversions }
      })
    },

    updateConversion: (id: string, updates: Partial<ConversionData>) => {
      set((state) => {
        const existing = state.conversions.get(id)
        if (!existing) return state

        const updated = { ...existing, ...updates, updated_at: new Date().toISOString() }
        const newConversions = new Map(state.conversions)
        newConversions.set(id, updated)
        return { conversions: newConversions }
      })
    },

    removeConversion: (id: string) => {
      set((state) => {
        const newConversions = new Map(state.conversions)
        newConversions.delete(id)
        
        const newLoading = new Map(state.loading)
        newLoading.delete(id)
        
        const newErrors = new Map(state.errors)
        newErrors.delete(id)
        
        const newActivePolling = new Set(state.activePolling)
        newActivePolling.delete(id)

        return { 
          conversions: newConversions,
          loading: newLoading,
          errors: newErrors,
          activePolling: newActivePolling
        }
      })
    },

    setLoading: (id: string, loading: boolean) => {
      set((state) => {
        const newLoading = new Map(state.loading)
        if (loading) {
          newLoading.set(id, true)
        } else {
          newLoading.delete(id)
        }
        return { loading: newLoading }
      })
    },

    setError: (id: string, error: string | null) => {
      set((state) => {
        const newErrors = new Map(state.errors)
        if (error) {
          newErrors.set(id, error)
        } else {
          newErrors.delete(id)
        }
        return { errors: newErrors }
      })
    },

    clearError: (id: string) => {
      get().setError(id, null)
    },

    // Cache management
    setCacheData: (key: string, data: any, ttl = CACHE_TTL) => {
      set((state) => {
        const newCache = new Map(state.requestCache)
        newCache.set(key, {
          data,
          timestamp: Date.now(),
          expires: Date.now() + ttl
        })
        return { requestCache: newCache }
      })
    },

    getCacheData: (key: string) => {
      const cache = get().requestCache.get(key)
      if (!cache) return null
      
      if (Date.now() > cache.expires) {
        // Cache expired
        set((state) => {
          const newCache = new Map(state.requestCache)
          newCache.delete(key)
          return { requestCache: newCache }
        })
        return null
      }
      
      return cache.data
    },

    clearCache: (key?: string) => {
      set((state) => {
        if (key) {
          const newCache = new Map(state.requestCache)
          newCache.delete(key)
          return { requestCache: newCache }
        } else {
          return { requestCache: new Map() }
        }
      })
    },

    // Polling management
    startPolling: (conversionIds: string[]) => {
      const state = get()
      
      console.log(`[POLLING MANAGER] Starting polling for IDs:`, conversionIds)
      
      // Add IDs to active polling set
      const newActivePolling = new Set(state.activePolling)
      conversionIds.forEach(id => {
        console.log(`[POLLING MANAGER] Adding ${id} to active polling`)
        newActivePolling.add(id)
      })
      
      set({ activePolling: newActivePolling })

      // Clear existing polling manager
      if (state.pollingManager) {
        console.log(`[POLLING MANAGER] Clearing existing polling manager`)
        clearInterval(state.pollingManager)
      }

      // Start new polling manager
      console.log(`[POLLING MANAGER] Setting up interval every ${MIN_POLLING_INTERVAL}ms`)
      const pollingManager = setInterval(async () => {
        console.log(`[POLLING MANAGER] Interval triggered - calling refreshActiveConversions`)
        await get().refreshActiveConversions()
      }, MIN_POLLING_INTERVAL)

      set({ pollingManager })
      
      console.log(`[POLLING MANAGER] Started polling for ${conversionIds.length} conversions`)
      
      // Trigger immediate first refresh
      setTimeout(async () => {
        console.log(`[POLLING MANAGER] Triggering immediate initial refresh`)
        await get().refreshActiveConversions()
      }, 100)
    },

    stopPolling: (conversionId?: string) => {
      set((state) => {
        const newActivePolling = new Set(state.activePolling)
        
        if (conversionId) {
          newActivePolling.delete(conversionId)
          console.log(`[POLLING MANAGER] Stopped polling for conversion ${conversionId}`)
        } else {
          newActivePolling.clear()
          console.log(`[POLLING MANAGER] Stopped all polling`)
        }

        // If no active polling, clear the manager
        if (newActivePolling.size === 0 && state.pollingManager) {
          clearInterval(state.pollingManager)
          return { 
            activePolling: newActivePolling, 
            pollingManager: null 
          }
        }

        return { activePolling: newActivePolling }
      })
    },

    isPollingActive: (id: string) => {
      return get().activePolling.has(id)
    },

    // Batch operations
    fetchMultipleConversions: async (ids: string[]) => {
      const state = get()
      const cacheKey = `batch:${ids.sort().join(',')}`
      
      // Check cache first
      const cached = state.getCacheData(cacheKey)
      if (cached) {
        console.log(`[CACHE HIT] Batch fetch for ${ids.length} conversions`)
        return cached
      }

      try {
        console.log(`[BATCH FETCH] Fetching ${ids.length} conversions`)
        
        // Mark all as loading
        ids.forEach(id => state.setLoading(id, true))
        
        const response = await fetch(`/api/status/batch?ids=${ids.join(',')}`, {
          headers: {
            'Cache-Control': 'no-cache',
          },
        })

        if (!response.ok) {
          throw new Error(`HTTP ${response.status}: ${response.statusText}`)
        }

        const conversions: ConversionData[] = await response.json()
        
        // Update store with fetched data
        state.setConversions(conversions)
        
        // Cache the result
        state.setCacheData(cacheKey, conversions)
        
        // Clear loading states and errors
        ids.forEach(id => {
          state.setLoading(id, false)
          state.clearError(id)
        })
        
        return conversions

      } catch (error) {
        console.error('[BATCH FETCH ERROR]', error)
        
        // Set error for all failed conversions
        const errorMessage = error instanceof Error ? error.message : 'Fetch failed'
        ids.forEach(id => {
          state.setLoading(id, false)
          state.setError(id, errorMessage)
        })
        
        throw error
      }
    },

    fetchUserConversions: async (userId: string) => {
      // For now, use the batch endpoint with all user conversions
      // We'll get them from getUserConversions selector once they're in the store
      const state = get()
      const existingConversions = state.getUserConversions(userId)
      
      if (existingConversions.length > 0) {
        console.log(`[USER FETCH] Using existing ${existingConversions.length} conversions for user ${userId}`)
        return existingConversions
      }
      
      // If no conversions in store, there's nothing to fetch until they upload something
      console.log(`[USER FETCH] No conversions found for user ${userId}`)
      return []
    },

    refreshActiveConversions: async () => {
      const state = get()
      const activeIds = Array.from(state.activePolling)
      
      console.log(`[POLLING MANAGER] Refresh called with ${activeIds.length} active IDs:`, activeIds)
      
      if (activeIds.length === 0) {
        console.log('[POLLING MANAGER] No active conversions to refresh')
        return
      }

      // Prevent too frequent batch fetches
      const now = Date.now()
      if (now - state.lastBatchFetch < MIN_POLLING_INTERVAL) {
        console.log(`[POLLING MANAGER] Skipping refresh - too soon (${now - state.lastBatchFetch}ms < ${MIN_POLLING_INTERVAL}ms)`)
        return
      }

      set({ lastBatchFetch: now })

      try {
        console.log(`[POLLING MANAGER] Fetching updates for conversions:`, activeIds)
        const conversions = await state.fetchMultipleConversions(activeIds)
        
        // Check if any conversions are completed and stop polling them
        conversions.forEach(conversion => {
          console.log(`[POLLING MANAGER] Conversion ${conversion.id} status: ${conversion.status}`)
          if (conversion.status === 'completed' || conversion.status === 'failed') {
            console.log(`[POLLING MANAGER] Conversion ${conversion.id} finished (${conversion.status}), stopping polling`)
            state.stopPolling(conversion.id)
          }
        })

      } catch (error) {
        console.error('[POLLING MANAGER ERROR]', error)
      }
    },

    // Reset
    reset: () => {
      const state = get()
      
      if (state.pollingManager) {
        clearInterval(state.pollingManager)
      }

      set({
        conversions: new Map(),
        requestCache: new Map(),
        activePolling: new Set(),
        pollingManager: null,
        lastBatchFetch: 0,
        loading: new Map(),
        errors: new Map(),
      })
    },
  }))
)

// Subscribe to store changes for debugging
if (process.env.NODE_ENV === 'development') {
  useConversionStore.subscribe(
    (state) => state.activePolling,
    (activePolling) => {
      console.log(`[STORE] Active polling changed: ${Array.from(activePolling).join(', ')}`)
    }
  )
}