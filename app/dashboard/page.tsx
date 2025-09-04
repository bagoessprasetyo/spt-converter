'use client'

import { useState, useEffect, useCallback } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { 
  FileText, 
  Download, 
  Clock, 
  CheckCircle, 
  XCircle, 
  BarChart3,
  TrendingUp,
  Calendar,
  Filter,
  Search,
  Plus,
  Eye,
  Trash2,
  Loader2,
  RefreshCw,
  ArrowUpDown,
  MoreHorizontal,
  X,
  AlertTriangle,
  Table as TableIcon,
  FileOutput
} from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter } from '@/components/ui/dialog'
import { 
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Progress } from '@/components/ui/progress'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { useAuth } from '@/lib/auth/context'
import { getUserConversions, getConversionStats, deleteConversion, retryConversion } from '@/lib/supabase/conversions-client'
import { getUserUsageStats } from '@/lib/supabase/users-client'
import { redirect, useRouter } from 'next/navigation'
import { toast } from 'sonner'
import { CompanySummary, TransactionData } from '@/lib/supabase/types'

interface Conversion {
  id: string
  original_filename: string
  converted_filename?: string | null
  status: string
  created_at: string
  updated_at: string
  completed_at?: string | null
  file_size: number | null
  error_message?: string | null
  download_url?: string | null
  tables_extracted: number
  total_rows: number
  processing_time_ms?: number | null
  summaries?: CompanySummary[] | null
  transaction_data?: TransactionData[] | null
}

interface Stats {
  totalConversions: number
  successfulConversions: number
  failedConversions: number
  totalFilesProcessed: number
  averageProcessingTime: number
}

interface UsageStats {
  creditsUsed: number
  creditsRemaining: number
  conversionsThisMonth: number
  storageUsed: number
  successfulConversions: number
  failedConversions: number
  subscriptionTier: string
  successRate: number
  averageFileSize: number
}

type SortField = 'created_at' | 'original_filename' | 'status' | 'file_size'
type SortOrder = 'asc' | 'desc'

export default function DashboardPage() {
  const { user, profile, loading } = useAuth()
  const router = useRouter()
  const [conversions, setConversions] = useState<Conversion[]>([])
  const [stats, setStats] = useState<Stats | null>(null)
  const [usageStats, setUsageStats] = useState<UsageStats | null>(null)
  const [searchTerm, setSearchTerm] = useState('')
  const [statusFilter, setStatusFilter] = useState<string>('all')
  const [sortField, setSortField] = useState<SortField>('created_at')
  const [sortOrder, setSortOrder] = useState<SortOrder>('desc')
  const [isLoading, setIsLoading] = useState(true)
  const [selectedConversions, setSelectedConversions] = useState<Set<string>>(new Set())
  const [deleteConfirmModal, setDeleteConfirmModal] = useState<Conversion | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isDownloading, setIsDownloading] = useState<Set<string>>(new Set())
  const [currentPage, setCurrentPage] = useState(1)
  const [pageSize] = useState(20)

  // Redirect to login if not authenticated
  if (!loading && !user) {
    redirect('/auth/login?redirect=/dashboard')
  }

  const loadDashboardData = useCallback(async () => {
    try {
      setIsLoading(true)
      const [conversionsData, statsData, usageData] = await Promise.all([
        getUserConversions(user!.id, 100), // Get more for pagination
        getConversionStats(user!.id),
        getUserUsageStats(user!.id)
      ])
      
      // Type cast the Json fields to proper types
      const typedConversions = conversionsData.map(conv => ({
        ...conv,
        summaries: conv.summaries as CompanySummary[] | null,
        transaction_data: conv.transaction_data as TransactionData[] | null
      }))
      
      setConversions(typedConversions)
      setStats(statsData)
      setUsageStats(usageData)
    } catch (error) {
      console.error('Error loading dashboard data:', error)
      toast.error('Failed to load dashboard data')
    } finally {
      setIsLoading(false)
    }
  }, [user])

  useEffect(() => {
    if (user) {
      loadDashboardData()
    }
  }, [user, loadDashboardData])

  // Auto-refresh for processing conversions
  useEffect(() => {
    if (!conversions.length) return
    
    const hasProcessingConversions = conversions.some(c => 
      c.status === 'pending' || c.status === 'processing'
    )
    
    if (hasProcessingConversions) {
      const interval = setInterval(loadDashboardData, 5000)
      return () => clearInterval(interval)
    }
  }, [conversions, loadDashboardData])

  // Download handler
  const handleDownload = async (conversion: Conversion) => {
    if (conversion.status !== 'completed' || !conversion.download_url) {
      toast.error('File is not ready for download')
      return
    }

    setIsDownloading(prev => new Set([...prev, conversion.id]))

    try {
      const response = await fetch(`/api/download/${conversion.id}`)
      
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.message || 'Download failed')
      }

      // Get filename from headers or use default
      const contentDisposition = response.headers.get('content-disposition')
      const filenameMatch = contentDisposition?.match(/filename[^;=\n]*=((['"]).*?\2|[^;\n]*)/)
      const filename = filenameMatch?.[1]?.replace(/['"]/g, '') || 
                     conversion.original_filename.replace(/\.pdf$/i, '.xlsx')

      // Create download
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = filename
      a.style.display = 'none'
      
      document.body.appendChild(a)
      a.click()
      
      setTimeout(() => {
        window.URL.revokeObjectURL(url)
        document.body.removeChild(a)
      }, 100)

      toast.success('File downloaded successfully')
    } catch (error) {
      console.error('Download error:', error)
      toast.error(error instanceof Error ? error.message : 'Download failed')
    } finally {
      setIsDownloading(prev => {
        const next = new Set(prev)
        next.delete(conversion.id)
        return next
      })
    }
  }

  // Delete handler
  const handleDelete = async (conversion: Conversion) => {
    if (!conversion?.id) {
      toast.error('Invalid conversion selected')
      return
    }

    setIsDeleting(true)
    
    try {
      console.log(`Deleting conversion: ${conversion.id} (${conversion.original_filename})`)
      
      await deleteConversion(conversion.id)
      
      // Optimistically remove from local state
      setConversions(prev => prev.filter(c => c.id !== conversion.id))
      
      toast.success(`"${conversion.original_filename}" deleted successfully`)
      setDeleteConfirmModal(null)
      
      // Refresh stats in the background
      loadDashboardData().catch(err => {
        console.error('Failed to refresh dashboard after delete:', err)
        // Don't show error to user as the delete succeeded
      })
      
    } catch (error) {
      console.error('Delete error:', error)
      
      // Provide more specific error messages
      let errorMessage = 'Failed to delete conversion'
      if (error instanceof Error) {
        if (error.message.includes('not found')) {
          errorMessage = 'Conversion not found - it may have already been deleted'
        } else if (error.message.includes('permission')) {
          errorMessage = 'You do not have permission to delete this conversion'
        } else if (error.message.includes('network')) {
          errorMessage = 'Network error - please check your connection and try again'
        } else {
          errorMessage = `Delete failed: ${error.message}`
        }
      }
      
      toast.error(errorMessage)
      
    } finally {
      setIsDeleting(false)
    }
  }

  // Retry handler
  const handleRetry = async (conversion: Conversion) => {
    try {
      await retryConversion(conversion.id)
      toast.success('Conversion queued for retry')
      await loadDashboardData()
    } catch (error) {
      console.error('Retry error:', error)
      toast.error('Failed to retry conversion')
    }
  }

  // Sort handler
  const handleSort = (field: SortField) => {
    if (field === sortField) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')
    } else {
      setSortField(field)
      setSortOrder('desc')
    }
  }

  // Filter and sort conversions
  const filteredAndSortedConversions = conversions
    .filter(conversion => {
      const matchesSearch = conversion.original_filename.toLowerCase().includes(searchTerm.toLowerCase())
      const matchesStatus = statusFilter === 'all' || conversion.status === statusFilter
      return matchesSearch && matchesStatus
    })
    .sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortField) {
        case 'original_filename':
          aValue = a.original_filename.toLowerCase()
          bValue = b.original_filename.toLowerCase()
          break
        case 'status':
          aValue = a.status
          bValue = b.status
          break
        case 'file_size':
          aValue = a.file_size || 0
          bValue = b.file_size || 0
          break
        case 'created_at':
        default:
          aValue = new Date(a.created_at).getTime()
          bValue = new Date(b.created_at).getTime()
          break
      }
      
      if (sortOrder === 'asc') {
        return aValue < bValue ? -1 : aValue > bValue ? 1 : 0
      } else {
        return aValue > bValue ? -1 : aValue < bValue ? 1 : 0
      }
    })

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedConversions.length / pageSize)
  const paginatedConversions = filteredAndSortedConversions.slice(
    (currentPage - 1) * pageSize,
    currentPage * pageSize
  )

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="h-4 w-4 text-green-600" />
      case 'failed':
        return <XCircle className="h-4 w-4 text-red-600" />
      case 'processing':
        return <Clock className="h-4 w-4 text-blue-600 animate-spin" />
      default:
        return <Clock className="h-4 w-4 text-gray-600" />
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

  if (loading || isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PDF to Excel</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link href="/">
                <Button variant="ghost">Home</Button>
              </Link>
              <Link href="/convert">
                <Button>Convert Files</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">Settings</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="mb-8"
        >
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-3xl font-bold text-gray-900 mb-2">
                Welcome back, {profile?.full_name || user?.email}
              </h1>
              <p className="text-gray-600">
                Manage your PDF conversions and track your usage
              </p>
            </div>
            <Link href="/convert">
              <Button size="lg" className="mt-4 sm:mt-0">
                <Plus className="h-5 w-5 mr-2" />
                New Conversion
              </Button>
            </Link>
          </div>
        </motion.div>

        {/* Stats Cards */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Total Conversions</CardTitle>
              <BarChart3 className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{stats?.totalConversions || 0}</div>
              <p className="text-xs text-muted-foreground">
                {stats?.successfulConversions || 0} successful
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
              <TrendingUp className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{profile?.credits_remaining || 0}</div>
              <p className="text-xs text-muted-foreground">
                {usageStats?.creditsUsed || 0} used this month
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">Success Rate</CardTitle>
              <CheckCircle className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">
                {stats?.totalConversions ? 
                  Math.round((stats.successfulConversions / stats.totalConversions) * 100) : 0}%
              </div>
              <p className="text-xs text-muted-foreground">
                {stats?.failedConversions || 0} failed
              </p>
            </CardContent>
          </Card>
          
          <Card>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">This Month</CardTitle>
              <Calendar className="h-4 w-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold">{usageStats?.conversionsThisMonth || 0}</div>
              <p className="text-xs text-muted-foreground">
                conversions completed
              </p>
            </CardContent>
          </Card>
        </motion.div>

        {/* Conversions Table */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
        >
          <Card>
            <CardHeader>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between space-y-4 sm:space-y-0">
                <CardTitle>Recent Conversions</CardTitle>
                <div className="flex flex-col sm:flex-row space-y-2 sm:space-y-0 sm:space-x-2">
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <Input
                      placeholder="Search files..."
                      value={searchTerm}
                      onChange={(e) => setSearchTerm(e.target.value)}
                      className="pl-10 w-full sm:w-64"
                    />
                  </div>
                  <Select value={statusFilter} onValueChange={setStatusFilter}>
                    <SelectTrigger className="w-full sm:w-32">
                      <Filter className="h-4 w-4 mr-2" />
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">All Status</SelectItem>
                      <SelectItem value="completed">Completed</SelectItem>
                      <SelectItem value="processing">Processing</SelectItem>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            </CardHeader>
            <CardContent>
              {paginatedConversions.length === 0 ? (
                <div className="text-center py-12">
                  <FileText className="h-12 w-12 text-gray-400 mx-auto mb-4" />
                  <h3 className="text-lg font-medium text-gray-900 mb-2">
                    {conversions.length === 0 ? 'No conversions yet' : 'No matching conversions'}
                  </h3>
                  <p className="text-gray-600 mb-4">
                    {conversions.length === 0 
                      ? 'Start by converting your first PDF file'
                      : 'Try adjusting your search or filter criteria'
                    }
                  </p>
                  {conversions.length === 0 && (
                    <Link href="/convert">
                      <Button>
                        <Plus className="h-4 w-4 mr-2" />
                        Convert Your First File
                      </Button>
                    </Link>
                  )}
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            className="h-auto p-0 font-semibold"
                            onClick={() => handleSort('original_filename')}
                          >
                            File
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            className="h-auto p-0 font-semibold"
                            onClick={() => handleSort('status')}
                          >
                            Status
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            className="h-auto p-0 font-semibold"
                            onClick={() => handleSort('file_size')}
                          >
                            Size
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead>Tables & Rows</TableHead>
                        <TableHead>
                          <Button 
                            variant="ghost" 
                            className="h-auto p-0 font-semibold"
                            onClick={() => handleSort('created_at')}
                          >
                            Created
                            <ArrowUpDown className="ml-2 h-4 w-4" />
                          </Button>
                        </TableHead>
                        <TableHead className="text-right">Actions</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {paginatedConversions.map((conversion) => (
                        <TableRow key={conversion.id} className="hover:bg-gray-50">
                          <TableCell>
                            <div className="flex items-center space-x-3">
                              {getStatusIcon(conversion.status)}
                              <div className="min-w-0">
                                <div className="font-medium text-gray-900 truncate max-w-xs">
                                  {conversion.original_filename}
                                </div>
                                {conversion.error_message && (
                                  <div className="text-sm text-red-600 truncate max-w-xs">
                                    {conversion.error_message}
                                  </div>
                                )}
                                {conversion.status === 'processing' && (
                                  <div className="mt-1 w-32">
                                    <Progress value={Math.random() * 100} className="h-1" />
                                  </div>
                                )}
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            {getStatusBadge(conversion.status)}
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {conversion.file_size ? formatFileSize(conversion.file_size) : 'N/A'}
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="flex flex-col space-y-1">
                              <div className="flex items-center space-x-1 text-sm">
                                <TableIcon className="h-3 w-3 text-gray-400" />
                                <span>{conversion.tables_extracted || 0}</span>
                                <span className="text-gray-400">tables</span>
                              </div>
                              <div className="flex items-center space-x-1 text-sm text-gray-500">
                                <FileOutput className="h-3 w-3 text-gray-400" />
                                <span>{conversion.total_rows || 0}</span>
                                <span className="text-gray-400">rows</span>
                              </div>
                            </div>
                          </TableCell>
                          <TableCell>
                            <div className="text-sm">
                              {formatDate(conversion.created_at)}
                            </div>
                            {conversion.processing_time_ms && (
                              <div className="text-xs text-gray-500">
                                {Math.round(conversion.processing_time_ms / 1000)}s
                              </div>
                            )}
                          </TableCell>
                          <TableCell className="text-right">
                            <DropdownMenu>
                              <DropdownMenuTrigger asChild>
                                <Button variant="ghost" size="sm">
                                  <MoreHorizontal className="h-4 w-4" />
                                </Button>
                              </DropdownMenuTrigger>
                              <DropdownMenuContent align="end">
                                <DropdownMenuLabel>Actions</DropdownMenuLabel>
                                <DropdownMenuSeparator />
                                
                                <DropdownMenuItem onClick={() => router.push(`/dashboard/conversion/${conversion.id}`)}>
                                  <Eye className="mr-2 h-4 w-4" />
                                  View Details
                                </DropdownMenuItem>
                                
                                {conversion.status === 'completed' && (
                                  <DropdownMenuItem 
                                    onClick={() => handleDownload(conversion)}
                                    disabled={isDownloading.has(conversion.id)}
                                  >
                                    {isDownloading.has(conversion.id) ? (
                                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                    ) : (
                                      <Download className="mr-2 h-4 w-4" />
                                    )}
                                    Download
                                  </DropdownMenuItem>
                                )}
                                
                                {conversion.status === 'failed' && (
                                  <DropdownMenuItem onClick={() => handleRetry(conversion)}>
                                    <RefreshCw className="mr-2 h-4 w-4" />
                                    Retry
                                  </DropdownMenuItem>
                                )}
                                
                                <DropdownMenuSeparator />
                                <DropdownMenuItem 
                                  onClick={() => setDeleteConfirmModal(conversion)}
                                  className="text-red-600 focus:text-red-600"
                                >
                                  <Trash2 className="mr-2 h-4 w-4" />
                                  Delete
                                </DropdownMenuItem>
                              </DropdownMenuContent>
                            </DropdownMenu>
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
              
              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex items-center justify-between px-6 py-4 border-t">
                  <div className="flex items-center text-sm text-gray-500">
                    Showing {Math.min((currentPage - 1) * pageSize + 1, filteredAndSortedConversions.length)} to{' '}
                    {Math.min(currentPage * pageSize, filteredAndSortedConversions.length)} of{' '}
                    {filteredAndSortedConversions.length} results
                  </div>
                  <div className="flex items-center space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage === 1}
                    >
                      Previous
                    </Button>
                    
                    {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                      const page = currentPage <= 3 ? i + 1 : currentPage - 2 + i
                      if (page > totalPages) return null
                      
                      return (
                        <Button
                          key={page}
                          variant={page === currentPage ? "default" : "outline"}
                          size="sm"
                          onClick={() => setCurrentPage(page)}
                        >
                          {page}
                        </Button>
                      )
                    })}
                    
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage === totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
        
        
        {/* Delete Confirmation Modal */}
        <Dialog open={!!deleteConfirmModal} onOpenChange={() => setDeleteConfirmModal(null)}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center space-x-2">
                <AlertTriangle className="h-5 w-5 text-red-600" />
                <span>Delete Conversion</span>
              </DialogTitle>
              <DialogDescription>
                Are you sure you want to delete this conversion? This action cannot be undone.
              </DialogDescription>
            </DialogHeader>
            
            {deleteConfirmModal && (
              <div className="space-y-4">
                <div className="p-4 bg-gray-50 rounded-lg">
                  <p className="font-medium">{deleteConfirmModal.original_filename}</p>
                  <p className="text-sm text-gray-600">Created {formatDate(deleteConfirmModal.created_at)}</p>
                </div>
                
                <DialogFooter>
                  <Button 
                    variant="outline" 
                    onClick={() => setDeleteConfirmModal(null)}
                    disabled={isDeleting}
                  >
                    Cancel
                  </Button>
                  <Button 
                    variant="destructive" 
                    onClick={() => handleDelete(deleteConfirmModal)}
                    disabled={isDeleting}
                  >
                    {isDeleting ? (
                      <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                      <Trash2 className="mr-2 h-4 w-4" />
                    )}
                    Delete
                  </Button>
                </DialogFooter>
              </div>
            )}
          </DialogContent>
        </Dialog>
      </div>
    </div>
  )
}