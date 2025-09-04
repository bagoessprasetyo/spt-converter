'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import { 
  ArrowLeft, 
  FileText, 
  Download, 
  RefreshCw,
  Loader2,
  AlertTriangle,
  Clock,
  CheckCircle,
  XCircle,
  Building2,
  Wallet,
  Hash
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { ConversionDetailView } from '@/components/conversion/ConversionDetailView'
import { useAuth } from '@/lib/auth/context'
import { CompanySummary, TransactionData } from '@/lib/supabase/types'
import { toast } from 'sonner'

interface ConversionDetail {
  id: string
  original_filename: string
  converted_filename?: string | null
  status: string
  created_at: string
  updated_at: string
  file_size: number | null
  error_message?: string | null
  download_url?: string | null
  tables_extracted: number
  total_rows: number
  processing_time_ms?: number | null
  summaries?: CompanySummary[] | null
  transaction_data?: TransactionData[] | null
}

export default function ConversionDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user } = useAuth()
  const [conversion, setConversion] = useState<ConversionDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDownloading, setIsDownloading] = useState(false)

  const conversionId = params.id as string

  useEffect(() => {
    if (!user || !conversionId) return

    const fetchConversionDetails = async () => {
      try {
        setLoading(true)
        const response = await fetch(`/api/conversion/${conversionId}/details`)
        
        if (!response.ok) {
          throw new Error('Failed to fetch conversion details')
        }
        
        const data = await response.json()
        
        // Map the API response to our component interface
        const typedConversion: ConversionDetail = {
          id: data.id,
          original_filename: data.originalFilename,
          converted_filename: data.convertedFilename,
          status: data.status,
          created_at: data.createdAt,
          updated_at: data.updatedAt,
          file_size: data.fileSize,
          error_message: data.errorMessage,
          download_url: data.downloadUrl,
          tables_extracted: data.tablesExtracted,
          total_rows: data.totalRows,
          processing_time_ms: data.processingTimeMs,
          summaries: data.summaries,
          transaction_data: data.transactionData
        }
        
        setConversion(typedConversion)
      } catch (err) {
        console.error('Error fetching conversion details:', err)
        setError(err instanceof Error ? err.message : 'Failed to load conversion details')
      } finally {
        setLoading(false)
      }
    }

    fetchConversionDetails()
  }, [user, conversionId])

  const handleDownload = async () => {
    if (!conversion || conversion.status !== 'completed') return

    try {
      setIsDownloading(true)
      const response = await fetch(`/api/download/${conversionId}`)
      
      if (!response.ok) {
        throw new Error('Download failed')
      }

      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = conversion.original_filename.replace(/\.pdf$/i, '.xlsx')
      a.style.display = 'none'
      
      document.body.appendChild(a)
      a.click()
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)

      toast.success('File downloaded successfully')
    } catch (err) {
      console.error('Download error:', err)
      toast.error('Download failed')
    } finally {
      setIsDownloading(false)
    }
  }

  const handleRetry = async () => {
    try {
      const response = await fetch(`/api/conversion/${conversionId}/retry`, {
        method: 'POST'
      })
      
      if (!response.ok) {
        throw new Error('Retry failed')
      }
      
      toast.success('Conversion queued for retry')
      router.push('/dashboard')
    } catch (err) {
      console.error('Retry error:', err)
      toast.error('Failed to retry conversion')
    }
  }

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-5 w-5 text-green-600" />
      case 'failed':
        return <XCircle className="h-5 w-5 text-red-600" />
      case 'processing':
        return <Clock className="h-5 w-5 text-blue-600" />
      default:
        return <Clock className="h-5 w-5 text-gray-600" />
    }
  }

  const getStatusBadge = (status: string) => {
    const variants = {
      completed: 'default',
      failed: 'destructive',
      processing: 'secondary',
      pending: 'outline'
    } as const
    
    return (
      <Badge variant={variants[status as keyof typeof variants] || 'outline'}>
        {status.charAt(0).toUpperCase() + status.slice(1)}
      </Badge>
    )
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex items-center justify-center min-h-[400px]">
            <Loader2 className="h-8 w-8 animate-spin text-blue-600" />
          </div>
        </div>
      </div>
    )
  }

  if (error || !conversion) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="flex flex-col items-center justify-center min-h-[400px] space-y-4">
            <AlertTriangle className="h-12 w-12 text-red-600" />
            <h2 className="text-xl font-semibold text-gray-900">Conversion Not Found</h2>
            <p className="text-gray-600 text-center">
              {error || 'The requested conversion could not be found.'}
            </p>
            <Link href="/dashboard">
              <Button>
                <ArrowLeft className="h-4 w-4 mr-2" />
                Back to Dashboard
              </Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Header */}
      <div className="bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost" size="sm">
                  <ArrowLeft className="h-4 w-4 mr-2" />
                  Back to Dashboard
                </Button>
              </Link>
              
              <div className="flex items-center space-x-3">
                <div className="flex items-center space-x-2">
                  {getStatusIcon(conversion.status)}
                  <h1 className="text-2xl font-bold text-gray-900 truncate max-w-md">
                    {conversion.original_filename}
                  </h1>
                </div>
                {getStatusBadge(conversion.status)}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              {conversion.status === 'completed' && (
                <Button onClick={handleDownload} disabled={isDownloading}>
                  {isDownloading ? (
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  ) : (
                    <Download className="h-4 w-4 mr-2" />
                  )}
                  Download
                </Button>
              )}
              
              {conversion.status === 'failed' && (
                <Button onClick={handleRetry} variant="outline">
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Retry
                </Button>
              )}
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* File Information */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle>File Information</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <div>
                  <label className="text-sm font-medium text-gray-500">File Size</label>
                  <p className="text-lg font-semibold">
                    {conversion.file_size ? formatFileSize(conversion.file_size) : 'N/A'}
                  </p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Tables Extracted</label>
                  <p className="text-lg font-semibold">{conversion.tables_extracted || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Total Rows</label>
                  <p className="text-lg font-semibold">{conversion.total_rows || 0}</p>
                </div>
                <div>
                  <label className="text-sm font-medium text-gray-500">Processing Time</label>
                  <p className="text-lg font-semibold">
                    {conversion.processing_time_ms 
                      ? `${Math.round(conversion.processing_time_ms / 1000)}s`
                      : 'N/A'
                    }
                  </p>
                </div>
              </div>
              
              <div className="mt-6 pt-6 border-t border-gray-200">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div>
                    <label className="text-sm font-medium text-gray-500">Created</label>
                    <p className="text-sm">{formatDate(conversion.created_at)}</p>
                  </div>
                  <div>
                    <label className="text-sm font-medium text-gray-500">Conversion ID</label>
                    <p className="text-sm font-mono">{conversion.id}</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Error Information */}
        {conversion.error_message && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-8"
          >
            <Alert variant="destructive">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>{conversion.error_message}</AlertDescription>
            </Alert>
          </motion.div>
        )}

        {/* Detailed Conversion Data */}
        {conversion.summaries && conversion.transaction_data && 
         conversion.summaries.length > 0 && conversion.transaction_data.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <ConversionDetailView
              summaries={conversion.summaries}
              transactionData={conversion.transaction_data}
              onExport={(format) => {
                toast.info(`Exporting data as ${format.toUpperCase()}...`)
              }}
            />
          </motion.div>
        ) : conversion.status === 'completed' && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card>
              <CardContent className="py-12">
                <div className="text-center">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    No Detailed Data Available
                  </h3>
                  <p className="text-gray-600 max-w-md mx-auto">
                    This conversion doesn't have detailed summary and transaction data. 
                    This may be from an older conversion before detailed data tracking was implemented.
                  </p>
                </div>
              </CardContent>
            </Card>
          </motion.div>
        )}
      </div>
    </div>
  )
}