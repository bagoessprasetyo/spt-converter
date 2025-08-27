'use client'

import { useEffect, useState, useCallback, useRef } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  Clock, 
  CheckCircle, 
  AlertCircle, 
  Download, 
  FileSpreadsheet,
  Loader2,
  RefreshCw,
  FileText,
  Search,
  Table,
  FileOutput,
  Zap
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import type { ConversionStatus as Status } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface ConversionStatusProps {
  conversionId: string
  onStatusChange?: (status: Status) => void
  onDownload?: (conversionId: string) => void
  className?: string
  showDetails?: boolean
  autoRefresh?: boolean
}

interface ProcessingStage {
  id: string
  name: string
  description: string
  icon: typeof FileText
  duration: number // estimated duration in ms
}

interface ConversionData {
  id: string
  status: Status
  fileName: string
  fileSize: number
  progress: number
  createdAt: string
  completedAt?: string
  downloadUrl?: string
  error?: string
  estimatedTime?: number
  processingTimeMs?: number
  tablesExtracted?: number
  totalRows?: number
  currentStage?: string
  retryCount?: number
}

// Processing stages for better UX feedback
const PROCESSING_STAGES: ProcessingStage[] = [
  {
    id: 'upload',
    name: 'File Upload',
    description: 'Uploading and validating PDF file',
    icon: FileText,
    duration: 2000
  },
  {
    id: 'parsing',
    name: 'PDF Parsing',
    description: 'Extracting content from PDF',
    icon: Search,
    duration: 8000
  },
  {
    id: 'extraction',
    name: 'Data Extraction',
    description: 'Identifying and extracting tables',
    icon: Table,
    duration: 15000
  },
  {
    id: 'formatting',
    name: 'Excel Formatting',
    description: 'Creating formatted spreadsheet',
    icon: FileOutput,
    duration: 5000
  }
]

const statusConfig = {
  pending: {
    icon: Clock,
    label: 'Pending',
    color: 'text-yellow-600',
    bgColor: 'bg-yellow-50',
    borderColor: 'border-yellow-200',
    badgeVariant: 'secondary' as const,
    description: 'Waiting to start processing'
  },
  processing: {
    icon: Zap,
    label: 'Processing',
    color: 'text-blue-600',
    bgColor: 'bg-blue-50',
    borderColor: 'border-blue-200',
    badgeVariant: 'default' as const,
    description: 'Converting your PDF to Excel'
  },
  completed: {
    icon: CheckCircle,
    label: 'Completed',
    color: 'text-green-600',
    bgColor: 'bg-green-50',
    borderColor: 'border-green-200',
    badgeVariant: 'default' as const,
    description: 'Conversion successful, ready for download'
  },
  failed: {
    icon: AlertCircle,
    label: 'Failed',
    color: 'text-red-600',
    bgColor: 'bg-red-50',
    borderColor: 'border-red-200',
    badgeVariant: 'destructive' as const,
    description: 'Conversion encountered an error'
  }
}

export function ConversionStatus({
  conversionId,
  onStatusChange,
  onDownload,
  className,
  showDetails = true,
  autoRefresh = true
}: ConversionStatusProps) {
  const [conversion, setConversion] = useState<ConversionData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isRefreshing, setIsRefreshing] = useState(false)
  const [currentStageIndex, setCurrentStageIndex] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [retryAttempts, setRetryAttempts] = useState(0)
  
  const intervalRef = useRef<NodeJS.Timeout | null>(null)
  const stageTimerRef = useRef<NodeJS.Timeout | null>(null)
  const mountedRef = useRef(true)

  // Cleanup function
  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (intervalRef.current) clearInterval(intervalRef.current)
      if (stageTimerRef.current) clearTimeout(stageTimerRef.current)
    }
  }, [])

  // Smart polling interval based on status and retry attempts
  const getPollingInterval = useCallback((status: Status, attempts: number) => {
    if (status === 'completed' || status === 'failed') return null
    
    // Exponential backoff for failed requests
    const baseInterval = status === 'processing' ? 2000 : 5000
    const backoffMultiplier = Math.min(Math.pow(2, attempts), 8) // Cap at 8x
    
    return baseInterval * backoffMultiplier
  }, [])

  const fetchStatus = useCallback(async (showRefreshLoader = false) => {
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
      
      const data = await response.json()
      
      if (!mountedRef.current) return
      
      setConversion(data)
      setError(null)
      setRetryAttempts(0) // Reset retry count on success
      
      // Notify parent of status change
      onStatusChange?.(data.status)
      
      return data
      
    } catch (err) {
      if (!mountedRef.current) return
      
      const errorMessage = err instanceof Error ? err.message : 'Unknown error'
      setError(errorMessage)
      setRetryAttempts(prev => prev + 1)
      
      // Don't show error immediately, allow for retries
      console.error('Status fetch error:', errorMessage)
      
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        if (showRefreshLoader) setIsRefreshing(false)
      }
    }
  }, [conversionId, onStatusChange])

  // Enhanced polling logic with smart intervals
  useEffect(() => {
    if (!autoRefresh) return

    const startPolling = () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
      
      const status = conversion?.status
      if (!status || status === 'completed' || status === 'failed') return
      
      const interval = getPollingInterval(status, retryAttempts)
      if (!interval) return
      
      intervalRef.current = setInterval(async () => {
        const data = await fetchStatus()
        if (data && (data.status === 'completed' || data.status === 'failed')) {
          if (intervalRef.current) clearInterval(intervalRef.current)
        }
      }, interval)
    }

    // Initial fetch
    fetchStatus().then(() => {
      startPolling()
    })

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [conversionId, conversion?.status, retryAttempts, autoRefresh, fetchStatus, getPollingInterval])

  // Stage progression simulation for better UX
  useEffect(() => {
    if (conversion?.status === 'processing') {
      const totalDuration = PROCESSING_STAGES.reduce((sum, stage) => sum + stage.duration, 0)
      let elapsed = 0
      
      const progressStage = () => {
        if (!mountedRef.current || conversion?.status !== 'processing') return
        
        const currentStage = PROCESSING_STAGES[currentStageIndex]
        if (!currentStage) return
        
        elapsed += 1000
        const stageProgress = Math.min((elapsed / currentStage.duration) * 100, 100)
        
        if (stageProgress >= 100 && currentStageIndex < PROCESSING_STAGES.length - 1) {
          setCurrentStageIndex(prev => prev + 1)
          elapsed = 0
        }
        
        stageTimerRef.current = setTimeout(progressStage, 1000)
      }
      
      progressStage()
      
      return () => {
        if (stageTimerRef.current) clearTimeout(stageTimerRef.current)
      }
    } else {
      setCurrentStageIndex(0)
    }
  }, [conversion?.status, currentStageIndex])

  const handleDownload = useCallback(async () => {
    if (conversion?.status !== 'completed' || isDownloading) return
    
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
        throw new Error(errorData.message || `Download failed: ${response.status} ${response.statusText}`)
      }
      
      // Get filename from content-disposition header or use default
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
        document.body.removeChild(a)
      }, 100)
      
      onDownload?.(conversionId)
      
    } catch (err) {
      const errorMessage = err instanceof Error ? err.message : 'Download failed'
      setError(`Download error: ${errorMessage}`)
      console.error('Download error:', err)
    } finally {
      setIsDownloading(false)
    }
  }, [conversion, conversionId, isDownloading, onDownload])

  const handleRetry = useCallback(async () => {
    setError(null)
    setRetryAttempts(0)
    await fetchStatus(true)
  }, [fetchStatus])

  // Helper functions
  const formatFileSize = useCallback((bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }, [])

  const formatTime = useCallback((dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }, [])

  const getEstimatedTimeRemaining = useCallback(() => {
    if (!conversion?.estimatedTime || conversion.status !== 'processing') return null
    
    const elapsed = Date.now() - new Date(conversion.createdAt).getTime()
    const remaining = Math.max(0, conversion.estimatedTime - elapsed)
    
    if (remaining < 30000) return 'Almost done'
    if (remaining < 60000) return 'Less than 1 minute'
    const minutes = Math.ceil(remaining / 60000)
    return `About ${minutes} minute${minutes > 1 ? 's' : ''} remaining`
  }, [conversion])

  const getCurrentStage = useCallback(() => {
    if (conversion?.status !== 'processing') return null
    return PROCESSING_STAGES[currentStageIndex] || PROCESSING_STAGES[0]
  }, [conversion?.status, currentStageIndex])

  // Processing stages component
  const ProcessingStages = ({ currentIndex }: { currentIndex: number }) => (
    <div className="space-y-3">
      <div className="text-sm font-medium text-gray-700 mb-2">Processing Steps:</div>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {PROCESSING_STAGES.map((stage, index) => {
          const Icon = stage.icon
          const isActive = index === currentIndex
          const isCompleted = index < currentIndex
          const isUpcoming = index > currentIndex
          
          return (
            <motion.div
              key={stage.id}
              initial={{ opacity: 0, scale: 0.8 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ delay: index * 0.1 }}
              className={cn(
                'flex flex-col items-center p-2 rounded-lg border text-center',
                isActive && 'border-blue-200 bg-blue-50',
                isCompleted && 'border-green-200 bg-green-50',
                isUpcoming && 'border-gray-200 bg-gray-50'
              )}
            >
              <Icon className={cn(
                'h-5 w-5 mb-1',
                isActive && 'text-blue-600 animate-pulse',
                isCompleted && 'text-green-600',
                isUpcoming && 'text-gray-400'
              )} />
              <span className={cn(
                'text-xs font-medium',
                isActive && 'text-blue-700',
                isCompleted && 'text-green-700',
                isUpcoming && 'text-gray-500'
              )}>
                {stage.name}
              </span>
              {isActive && (
                <div className="text-xs text-blue-600 mt-1">
                  Processing...
                </div>
              )}
              {isCompleted && (
                <CheckCircle className="h-3 w-3 text-green-600 mt-1" />
              )}
            </motion.div>
          )
        })}
      </div>
    </div>
  )

  if (loading) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={className}
      >
        <Card className="animate-pulse">
          <CardContent className="p-6">
            <div className="flex items-center space-x-3">
              <div className="h-12 w-12 bg-gray-200 rounded-full" />
              <div className="space-y-2 flex-1">
                <div className="h-4 bg-gray-200 rounded w-1/3" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-2 bg-gray-200 rounded w-full" />
              </div>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (error && !conversion && retryAttempts > 2) {
    return (
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className={className}
      >
        <Card className="border-red-200">
          <CardContent className="p-6">
            <Alert variant="destructive">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription className="flex items-center justify-between">
                <span>{error || 'Failed to load conversion status'}</span>
              </AlertDescription>
            </Alert>
            <div className="flex gap-2 mt-3">
              <Button 
                variant="outline" 
                size="sm"
                onClick={handleRetry}
                disabled={isRefreshing}
              >
                {isRefreshing ? (
                  <Loader2 className="h-4 w-4 animate-spin mr-2" />
                ) : (
                  <RefreshCw className="h-4 w-4 mr-2" />
                )}
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      </motion.div>
    )
  }

  if (!conversion) return null

  const config = statusConfig[conversion.status]
  const Icon = config.icon
  const estimatedTime = getEstimatedTimeRemaining()
  const currentStage = getCurrentStage()

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={className}
    >
      <Card className={cn('transition-all duration-200', config.borderColor)}>
        {showDetails && (
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <FileSpreadsheet className="h-5 w-5 text-gray-600" />
                <span className="truncate text-sm md:text-base">{conversion.fileName}</span>
              </div>
              <Badge variant={config.badgeVariant} className="flex items-center gap-1">
                <Icon className="h-3 w-3" />
                {config.label}
              </Badge>
            </CardTitle>
          </CardHeader>
        )}
        
        <CardContent className={cn('p-6', showDetails && 'pt-0')}>
          {/* Main status section */}
          <div className="flex items-start space-x-4">
            <div className={cn(
              'flex items-center justify-center w-12 h-12 rounded-full flex-shrink-0',
              config.bgColor
            )}>
              <Icon className={cn(
                'h-6 w-6',
                config.color,
                conversion.status === 'processing' && 'animate-pulse'
              )} />
            </div>
            
            <div className="flex-1 space-y-3 min-w-0">
              <div className="flex items-center justify-between">
                <div>
                  <h3 className="font-medium text-gray-900">{config.label}</h3>
                  <p className="text-sm text-gray-600">{config.description}</p>
                  {currentStage && (
                    <p className="text-xs text-blue-600 mt-1">
                      {currentStage.description}
                    </p>
                  )}
                </div>
                
                {conversion.status === 'completed' && (
                  <Button 
                    onClick={handleDownload}
                    size="sm"
                    disabled={isDownloading}
                    className="ml-2 flex-shrink-0"
                  >
                    {isDownloading ? (
                      <Loader2 className="h-4 w-4 animate-spin mr-2" />
                    ) : (
                      <Download className="h-4 w-4 mr-2" />
                    )}
                    Download
                  </Button>
                )}
              </div>
              
              {/* Progress section */}
              {conversion.status === 'processing' && (
                <div className="space-y-2">
                  <div className="flex justify-between items-center text-sm">
                    <span className="text-gray-600">
                      {conversion.progress}% complete
                    </span>
                    {estimatedTime && (
                      <span className="text-blue-600">{estimatedTime}</span>
                    )}
                  </div>
                  <Progress value={conversion.progress} className="h-2" />
                </div>
              )}
              
              {/* Processing stages */}
              {conversion.status === 'processing' && showDetails && (
                <ProcessingStages currentIndex={currentStageIndex} />
              )}
              
              {/* Error handling */}
              {conversion.status === 'failed' && (
                <Alert variant="destructive">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    <div className="flex items-center justify-between">
                      <span>{conversion.error || 'Conversion failed unexpectedly'}</span>
                    </div>
                  </AlertDescription>
                </Alert>
              )}
              
              {/* Conversion statistics */}
              {conversion.status === 'completed' && (
                <div className="flex gap-4 text-sm text-gray-600 bg-green-50 p-3 rounded-lg">
                  {conversion.tablesExtracted !== undefined && (
                    <span className="flex items-center gap-1">
                      <Table className="h-4 w-4" />
                      {conversion.tablesExtracted} tables
                    </span>
                  )}
                  {conversion.totalRows !== undefined && (
                    <span>{conversion.totalRows} rows</span>
                  )}
                  {conversion.processingTimeMs && (
                    <span>{Math.round(conversion.processingTimeMs / 1000)}s</span>
                  )}
                </div>
              )}
              
              {/* File details */}
              {showDetails && (
                <div className="text-xs text-gray-500 space-y-1 pt-2 border-t">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                    <span>Size: {formatFileSize(conversion.fileSize)}</span>
                    <span>Started: {formatTime(conversion.createdAt)}</span>
                    {conversion.completedAt && (
                      <span>Completed: {formatTime(conversion.completedAt)}</span>
                    )}
                  </div>
                </div>
              )}
              
              {/* Inline error display for non-critical errors */}
              {error && conversion && (
                <Alert variant="destructive" className="mt-2">
                  <AlertCircle className="h-4 w-4" />
                  <AlertDescription className="text-sm">
                    {error}
                  </AlertDescription>
                </Alert>
              )}
            </div>
            
            {/* Action buttons */}
            <div className="flex flex-col gap-2">
              {(conversion.status === 'pending' || conversion.status === 'processing') && (
                <Button 
                  variant="ghost" 
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRefreshing}
                  title="Refresh status"
                >
                  <RefreshCw className={cn(
                    'h-4 w-4',
                    isRefreshing && 'animate-spin'
                  )} />
                </Button>
              )}
              
              {conversion.status === 'failed' && (
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={handleRetry}
                  disabled={isRefreshing}
                >
                  {isRefreshing ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <RefreshCw className="h-4 w-4" />
                  )}
                  <span className="ml-2 hidden sm:inline">Retry</span>
                </Button>
              )}
            </div>
          </div>
        </CardContent>
      </Card>
      
      {/* Success animation */}
      <AnimatePresence>
        {conversion.status === 'completed' && (
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            exit={{ scale: 0 }}
            className="absolute -top-2 -right-2"
          >
            <div className="w-6 h-6 bg-green-500 rounded-full flex items-center justify-center">
              <CheckCircle className="h-4 w-4 text-white" />
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}