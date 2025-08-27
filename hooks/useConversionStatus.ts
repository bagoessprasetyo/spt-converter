'use client'

import { useState, useEffect, useCallback, useRef } from 'react'
import type { ConversionStatus as Status } from '@/lib/supabase/types'

export interface ConversionData {
  id: string
  status: Status
  fileName: string
  fileSize: number
  progress: number
  currentStage?: string
  createdAt: string
  updatedAt: string
  completedAt?: string
  downloadUrl?: string
  error?: string
  estimatedTime?: number
  processingTimeMs?: number
  tablesExtracted?: number
  totalRows?: number
  canRetry?: boolean
  originalFilename: string
  convertedFilename?: string
}

export interface UseConversionStatusOptions {
  conversionId: string
  autoRefresh?: boolean
  pollingInterval?: number
  onStatusChange?: (status: Status, data: ConversionData) => void
  onComplete?: (data: ConversionData) => void
  onError?: (error: string) => void
}

export interface UseConversionStatusResult {
  // State
  conversion: ConversionData | null
  loading: boolean
  error: string | null
  isRefreshing: boolean
  retryAttempts: number
  
  // Actions
  refresh: (showLoader?: boolean) => Promise<ConversionData | undefined>
  retry: () => Promise<void>
  download: () => Promise<void>
  
  // Status helpers
  isPending: boolean
  isProcessing: boolean
  isCompleted: boolean
  isFailed: boolean
  canDownload: boolean
  
  // Progress helpers
  progressPercentage: number
  estimatedTimeRemaining: string | null
  processingDuration: string | null
}

export function useConversionStatus(options: UseConversionStatusOptions): UseConversionStatusResult {
  const {
    conversionId,
    autoRefresh = true,
    pollingInterval = 2000,
    onStatusChange,
    onComplete,
    onError
  } = options

  // State
  const [conversion, setConversion] = useState<ConversionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [retryAttempts, setRetryAttempts] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)

  // Refs
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)
  const lastStatusRef = useRef<Status | null>(null)

  // Cleanup
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
      }
    }
  }, [])

  // Smart polling interval with exponential backoff
  const getPollingInterval = useCallback((status: Status, attempts: number) => {
    if (status === 'completed' || status === 'failed') return null
    
    const baseInterval = pollingInterval
    const backoffMultiplier = Math.min(Math.pow(2, attempts), 8) // Cap at 8x
    return baseInterval * backoffMultiplier
  }, [pollingInterval])

  // Fetch conversion status
  const fetchStatus = useCallback(async (showRefreshLoader = false): Promise<ConversionData | undefined> => {
    if (!mountedRef.current) return

    try {
      if (showRefreshLoader) setIsRefreshing(true)

      const response = await fetch(`/api/status/${conversionId}`, {
        headers: {
          'Cache-Control': 'no-cache',
        },
      })

      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`)
      }

      const data: ConversionData = await response.json()

      if (!mountedRef.current) return

      setConversion(data)
      setError(null)
      setRetryAttempts(0) // Reset on success

      // Check for status changes
      if (lastStatusRef.current !== data.status) {
        lastStatusRef.current = data.status
        onStatusChange?.(data.status, data)

        // Handle completion
        if (data.status === 'completed') {
          onComplete?.(data)
        }
      }

      return data

    } catch (err) {
      if (!mountedRef.current) return

      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setRetryAttempts(prev => prev + 1)
      onError?.(errorMessage)

      console.error('Status fetch error:', errorMessage)

    } finally {
      if (mountedRef.current) {
        setLoading(false)
        if (showRefreshLoader) setIsRefreshing(false)
      }
    }
  }, [conversionId, onStatusChange, onComplete, onError])

  // Refresh action
  const refresh = useCallback(async (showLoader = false) => {
    return await fetchStatus(showLoader)
  }, [fetchStatus])

  // Retry action
  const retry = useCallback(async () => {
    setError(null)
    setRetryAttempts(0)
    await fetchStatus(true)
  }, [fetchStatus])

  // Download action
  const download = useCallback(async () => {
    if (!conversion || conversion.status !== 'completed' || isDownloading) return

    try {
      setIsDownloading(true)
      setError(null)

      const response = await fetch(`/api/download/${conversionId}`, {
        headers: {
          'Accept': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        },
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || `Download failed: ${response.status}`)
      }

      // Get filename from headers or use default
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const downloadFilename = filenameMatch?.[1]?.replace(/['"]/g, '') || 
                              conversion.fileName.replace(/\.pdf$/i, '.xlsx')

      // Create and trigger download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      
      a.href = url
      a.download = downloadFilename
      a.style.display = 'none'
      
      document.body.appendChild(a)
      a.click()

      // Cleanup
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        if (document.body.contains(a)) {
          document.body.removeChild(a)
        }
      }, 100)

    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed'
      setError(`Download error: ${errorMessage}`)
      console.error('Download error:', err)
    } finally {
      setIsDownloading(false)
    }
  }, [conversion, conversionId, isDownloading])

  // Setup polling
  useEffect(() => {
    if (!autoRefresh) return

    const startPolling = () => {
      // Always clear existing interval first
      if (intervalRef.current) {
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }

      const status = conversion?.status
      
      // Stop polling if status is completed or failed
      if (!status || status === 'completed' || status === 'failed') {
        console.log(`[POLLING] Stopping polling for ${conversionId}: status is ${status}`)
        return
      }

      const interval = getPollingInterval(status, retryAttempts)
      if (!interval) return

      console.log(`[POLLING] Starting polling for ${conversionId} with ${interval}ms interval (status: ${status})`)
      
      intervalRef.current = setInterval(async () => {
        if (!mountedRef.current) {
          if (intervalRef.current) clearInterval(intervalRef.current)
          return
        }

        const data = await fetchStatus()
        
        // Stop polling immediately when conversion is completed or failed
        if (data && (data.status === 'completed' || data.status === 'failed')) {
          console.log(`[POLLING] Conversion ${conversionId} finished with status: ${data.status}. Stopping polling.`)
          if (intervalRef.current) {
            clearInterval(intervalRef.current)
            intervalRef.current = null
          }
        }
      }, interval)
    }

    // Initial fetch
    fetchStatus().then((data) => {
      // Only start polling if conversion is not already completed
      if (data && data.status !== 'completed' && data.status !== 'failed') {
        startPolling()
      } else {
        console.log(`[POLLING] Conversion ${conversionId} already finished (${data?.status}), skipping polling setup`)
      }
    })

    return () => {
      if (intervalRef.current) {
        console.log(`[POLLING] Cleanup: clearing interval for ${conversionId}`)
        clearInterval(intervalRef.current)
        intervalRef.current = null
      }
    }
  }, [conversionId, conversion?.status, retryAttempts, autoRefresh, fetchStatus, getPollingInterval])

  // Helper functions
  const formatTimeRemaining = (ms: number): string => {
    if (ms < 30000) return 'Almost done'
    if (ms < 60000) return 'Less than 1 minute'
    const minutes = Math.ceil(ms / 60000)
    return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`
  }

  const formatDuration = (startTime: string, endTime: string): string => {
    const duration = new Date(endTime).getTime() - new Date(startTime).getTime()
    const seconds = Math.round(duration / 1000)
    if (seconds < 60) return `${seconds}s`
    const minutes = Math.floor(seconds / 60)
    const remainingSeconds = seconds % 60
    return `${minutes}m ${remainingSeconds}s`
  }

  // Computed values
  const isPending = conversion?.status === 'pending'
  const isProcessing = conversion?.status === 'processing'
  const isCompleted = conversion?.status === 'completed'
  const isFailed = conversion?.status === 'failed'
  const canDownload = Boolean(isCompleted && conversion?.downloadUrl)
  const progressPercentage = conversion?.progress || 0
  
  const estimatedTimeRemaining = conversion?.estimatedTime ? 
    formatTimeRemaining(conversion.estimatedTime) : null
  
  const processingDuration = conversion && isCompleted && conversion.createdAt ? 
    formatDuration(conversion.createdAt, conversion.completedAt || conversion.updatedAt) : null

  return {
    // State
    conversion,
    loading,
    error,
    isRefreshing,
    retryAttempts,
    
    // Actions
    refresh,
    retry,
    download,
    
    // Status helpers
    isPending,
    isProcessing,
    isCompleted,
    isFailed,
    canDownload,
    
    // Progress helpers
    progressPercentage,
    estimatedTimeRemaining,
    processingDuration
  }
}