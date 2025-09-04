'use client'

import { useState, useMemo } from 'react'
import { motion } from 'framer-motion'
import { 
  Building2, 
  Download, 
  Search, 
  Filter,
  ChevronDown,
  ChevronUp,
  MoreVertical,
  FileText,
  Wallet,
  Calendar,
  Hash,
  TrendingUp,
  ArrowUpDown,
  Eye,
  BarChart3,
  PieChart,
  Receipt,
  Users
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Input } from '@/components/ui/input'
import { 
  Table, 
  TableBody, 
  TableCell, 
  TableHead, 
  TableHeader, 
  TableRow 
} from '@/components/ui/table'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Progress } from '@/components/ui/progress'
import { CompanySummary, TransactionData } from '@/lib/supabase/types'
import { cn } from '@/lib/utils'

interface ConversionDetailViewProps {
  summaries: CompanySummary[]
  transactionData: TransactionData[]
  className?: string
  onExport?: (format: 'csv' | 'excel') => void
}

export function ConversionDetailView({
  summaries,
  transactionData,
  className,
  onExport
}: ConversionDetailViewProps) {
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCompany, setSelectedCompany] = useState<string | null>(null)
  const [showTransactions, setShowTransactions] = useState(false)
  const [currentPage, setCurrentPage] = useState(1)
  const [sortBy, setSortBy] = useState<'name' | 'totalTax' | 'transactionCount'>('totalTax')
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc')
  const [viewMode, setViewMode] = useState<'grid' | 'table'>('grid')
  
  const itemsPerPage = 20

  // Enhanced filtering and sorting with performance optimization
  const filteredAndSortedSummaries = useMemo(() => {
    // First, calculate transaction counts for each company
    const companiesWithCounts = summaries.map(summary => {
      const companyTransactionCount = transactionData.filter(
        tx => tx.nama === summary.json.nama
      ).length
      
      return {
        ...summary,
        transactionCount: companyTransactionCount
      }
    })
    
    // Filter based on search term
    const filtered = companiesWithCounts.filter(summary =>
      summary.json.nama.toLowerCase().includes(searchTerm.toLowerCase())
    )
    
    // Sort based on selected criteria
    return filtered.sort((a, b) => {
      let aValue: any, bValue: any
      
      switch (sortBy) {
        case 'name':
          aValue = a.json.nama.toLowerCase()
          bValue = b.json.nama.toLowerCase()
          break
        case 'totalTax':
          aValue = a.json.totalPajak
          bValue = b.json.totalPajak
          break
        case 'transactionCount':
          aValue = a.transactionCount
          bValue = b.transactionCount
          break
        default:
          aValue = a.json.totalPajak
          bValue = b.json.totalPajak
      }
      
      const modifier = sortOrder === 'asc' ? 1 : -1
      return aValue < bValue ? -modifier : aValue > bValue ? modifier : 0
    })
  }, [summaries, transactionData, searchTerm, sortBy, sortOrder])

  const filteredTransactions = transactionData.filter(transaction => {
    const matchesSearch = transaction.nama.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         transaction.npwp.includes(searchTerm) ||
                         transaction.jenis_penghasilan.toLowerCase().includes(searchTerm.toLowerCase())
    const matchesCompany = !selectedCompany || transaction.nama === selectedCompany
    return matchesSearch && matchesCompany
  })

  // Pagination
  const totalPages = Math.ceil(filteredTransactions.length / itemsPerPage)
  const startIndex = (currentPage - 1) * itemsPerPage
  const paginatedTransactions = filteredTransactions.slice(startIndex, startIndex + itemsPerPage)

  // Enhanced statistics calculations
  const stats = useMemo(() => {
    const totalTax = summaries.reduce((sum, company) => sum + company.json.totalPajak, 0)
    const totalCompanies = summaries.length
    const totalTransactions = transactionData.length
    const uniqueCategories = [...new Set(transactionData.map(t => t.jenis_penghasilan))].length
    const avgTaxPerCompany = totalCompanies > 0 ? totalTax / totalCompanies : 0
    const maxTaxCompany = summaries.reduce((max, company) => 
      company.json.totalPajak > max.json.totalPajak ? company : max, summaries[0])
    
    return {
      totalTax,
      totalCompanies,
      totalTransactions,
      uniqueCategories,
      avgTaxPerCompany,
      maxTaxCompany
    }
  }, [summaries, transactionData])

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('id-ID', {
      style: 'currency',
      currency: 'IDR',
      minimumFractionDigits: 0,
    }).format(amount)
  }

  const formatDate = (dateStr: string) => {
    const [day, month, year] = dateStr.split('/')
    const date = new Date(`${year}-${month}-${day}`)
    return date.toLocaleDateString('id-ID', {
      day: '2-digit',
      month: 'short',
      year: 'numeric'
    })
  }

  const formatCompactCurrency = (amount: number) => {
    if (amount >= 1000000000) {
      return `${(amount / 1000000000).toFixed(1)}B`
    } else if (amount >= 1000000) {
      return `${(amount / 1000000).toFixed(1)}M`
    } else if (amount >= 1000) {
      return `${(amount / 1000).toFixed(1)}K`
    }
    return amount.toString()
  }

  const getCompanyRank = (taxAmount: number) => {
    const sortedAmounts = summaries
      .map(s => s.json.totalPajak)
      .sort((a, b) => b - a)
    return sortedAmounts.indexOf(taxAmount) + 1
  }

  const getTaxPercentage = (companyTax: number) => {
    return stats.totalTax > 0 ? (companyTax / stats.totalTax) * 100 : 0
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6', className)}
    >
      {/* Enhanced Summary Statistics */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-6">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.1 }}
        >
          <Card className="relative overflow-hidden border-l-4 border-l-blue-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-blue-100 rounded-lg">
                    <Building2 className="h-6 w-6 text-blue-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalCompanies}</p>
                    <p className="text-sm font-medium text-gray-600">Total Companies</p>
                  </div>
                </div>
                <BarChart3 className="h-8 w-8 text-blue-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.2 }}
        >
          <Card className="relative overflow-hidden border-l-4 border-l-green-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-green-100 rounded-lg">
                    <Wallet className="h-6 w-6 text-green-600" />
                  </div>
                  <div>
                    <p className="text-2xl font-bold text-gray-900">
                      {formatCompactCurrency(stats.totalTax)}
                    </p>
                    <p className="text-sm font-medium text-gray-600">Total Tax</p>
                    <p className="text-xs text-green-600 font-medium">
                      Avg: {formatCompactCurrency(stats.avgTaxPerCompany)}
                    </p>
                  </div>
                </div>
                <TrendingUp className="h-8 w-8 text-green-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.3 }}
        >
          <Card className="relative overflow-hidden border-l-4 border-l-purple-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-purple-100 rounded-lg">
                    <Receipt className="h-6 w-6 text-purple-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stats.totalTransactions}</p>
                    <p className="text-sm font-medium text-gray-600">Transactions</p>
                  </div>
                </div>
                <FileText className="h-8 w-8 text-purple-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
        
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ delay: 0.4 }}
        >
          <Card className="relative overflow-hidden border-l-4 border-l-orange-500">
            <CardContent className="p-6">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-2 bg-orange-100 rounded-lg">
                    <PieChart className="h-6 w-6 text-orange-600" />
                  </div>
                  <div>
                    <p className="text-3xl font-bold text-gray-900">{stats.uniqueCategories}</p>
                    <p className="text-sm font-medium text-gray-600">Categories</p>
                  </div>
                </div>
                <Hash className="h-8 w-8 text-orange-200" />
              </div>
            </CardContent>
          </Card>
        </motion.div>
      </div>

      {/* Enhanced Action Bar */}
      <div className="flex flex-col lg:flex-row justify-between items-start lg:items-center gap-4 p-6 bg-gray-50 rounded-lg border">
        <div className="flex flex-col sm:flex-row items-start sm:items-center space-y-2 sm:space-y-0 sm:space-x-4 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10 bg-white"
            />
          </div>
          
          <div className="flex items-center space-x-2">
            <Select value={sortBy} onValueChange={(value: any) => setSortBy(value)}>
              <SelectTrigger className="w-48 bg-white">
                <ArrowUpDown className="h-4 w-4 mr-2" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="totalTax">Sort by Tax Amount</SelectItem>
                <SelectItem value="name">Sort by Company Name</SelectItem>
                <SelectItem value="transactionCount">Sort by Transactions</SelectItem>
              </SelectContent>
            </Select>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc')}
              className="bg-white"
            >
              {sortOrder === 'desc' ? '↓' : '↑'}
            </Button>
          </div>
        </div>
        
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            onClick={() => setShowTransactions(!showTransactions)}
            className="flex items-center space-x-2 bg-white"
          >
            <FileText className="h-4 w-4" />
            <span className="hidden sm:inline">{showTransactions ? 'Hide' : 'Show'} Transactions</span>
            {showTransactions ? 
              <ChevronUp className="h-4 w-4" /> : 
              <ChevronDown className="h-4 w-4" />
            }
          </Button>
          
          {onExport && (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="outline" className="flex items-center space-x-2 bg-white">
                  <Download className="h-4 w-4" />
                  <span className="hidden sm:inline">Export</span>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent>
                <DropdownMenuItem onClick={() => onExport('csv')}>
                  Export as CSV
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onExport('excel')}>
                  Export as Excel
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )}
        </div>
      </div>

      {/* Professional Company Summaries */}
      <Card className="overflow-hidden">
        <CardHeader className="bg-gradient-to-r from-blue-50 to-indigo-50 border-b">
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center space-x-3">
              <div className="p-2 bg-blue-100 rounded-lg">
                <Building2 className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">Company Portfolio</h2>
                <p className="text-sm text-gray-600">Tax summary by organization</p>
              </div>
            </CardTitle>
            <Badge variant="secondary" className="bg-blue-100 text-blue-800 border-blue-200">
              {filteredAndSortedSummaries.length} companies
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="p-6">
          <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-6">
            {filteredAndSortedSummaries.map((company, index) => {
              const companyName = company.json.nama
              const isSelected = selectedCompany === companyName
              const rank = getCompanyRank(company.json.totalPajak)
              const taxPercentage = getTaxPercentage(company.json.totalPajak)
              const transactionCount = company.transactionCount
              
              return (
                <motion.div
                  key={`company-${index}-${companyName}`}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.1 }}
                  className={cn(
                    'group relative p-6 bg-white rounded-xl border-2 transition-all duration-200 cursor-pointer hover:shadow-lg hover:border-blue-200',
                    isSelected ? 'border-blue-500 bg-blue-50 shadow-md' : 'border-gray-200 hover:border-gray-300'
                  )}
                  onClick={(e) => {
                    if (!(e.target as HTMLElement).closest('.action-button')) {
                      setSelectedCompany(isSelected ? null : companyName)
                    }
                  }}
                >
                  {/* Rank indicator */}
                  <div className="absolute -top-2 -right-2">
                    <div className={cn(
                      'w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold',
                      rank === 1 ? 'bg-yellow-100 text-yellow-800 border-2 border-yellow-300' :
                      rank <= 3 ? 'bg-green-100 text-green-800 border-2 border-green-300' :
                      'bg-gray-100 text-gray-600 border-2 border-gray-200'
                    )}>
                      #{rank}
                    </div>
                  </div>
                  
                  {/* Company Header */}
                  <div className="mb-4">
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h3 className="text-lg font-bold text-gray-900 leading-tight mb-1 pr-4" title={companyName}>
                          {companyName.length > 40 ? `${companyName.substring(0, 40)}...` : companyName}
                        </h3>
                        <div className="flex items-center space-x-2">
                          <Badge variant="outline" className="text-xs">
                            {transactionCount} transactions
                          </Badge>
                          <Badge variant="secondary" className="text-xs">
                            {taxPercentage.toFixed(1)}% of total
                          </Badge>
                        </div>
                      </div>
                    </div>
                    
                    {/* Tax amount with visual emphasis */}
                    <div className="bg-gradient-to-r from-green-50 to-emerald-50 p-4 rounded-lg border border-green-100">
                      <div className="flex items-center justify-between">
                        <div>
                          <p className="text-xs font-medium text-green-700 uppercase tracking-wide mb-1">
                            Total Tax Contribution
                          </p>
                          <p className="text-2xl font-bold text-green-800">
                            {formatCurrency(company.json.totalPajak)}
                          </p>
                          <p className="text-sm text-green-600">
                            {formatCompactCurrency(company.json.totalPajak)} IDR
                          </p>
                        </div>
                        <TrendingUp className="h-8 w-8 text-green-300" />
                      </div>
                      
                      {/* Tax distribution progress */}
                      <div className="mt-3">
                        <div className="flex justify-between items-center mb-1">
                          <span className="text-xs font-medium text-green-700">Portfolio Share</span>
                          <span className="text-xs font-bold text-green-800">{taxPercentage.toFixed(1)}%</span>
                        </div>
                        <Progress value={taxPercentage} className="h-2 bg-green-100" />
                      </div>
                    </div>
                  </div>
                  
                  {/* Categories breakdown */}
                  <div className="mb-4">
                    <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-3">
                      Tax Categories ({Object.keys(company.json.perJenis).length})
                    </p>
                    <div className="space-y-2">
                      {Object.entries(company.json.perJenis)
                        .sort(([,a], [,b]) => b - a) // Sort by amount descending
                        .slice(0, 3) // Show top 3 categories
                        .map(([type, amount], catIndex) => {
                        const percentage = (amount / company.json.totalPajak) * 100
                        return (
                          <div key={`${type}-${index}-${catIndex}`} className="flex items-center justify-between">
                            <div className="flex-1 min-w-0 mr-3">
                              <p className="text-sm font-medium text-gray-800 truncate" title={type}>
                                {type}
                              </p>
                              <div className="flex items-center space-x-2 mt-1">
                                <Progress value={percentage} className="h-1.5 flex-1" />
                                <span className="text-xs text-gray-500 font-medium">
                                  {percentage.toFixed(0)}%
                                </span>
                              </div>
                            </div>
                            <p className="text-sm font-bold text-gray-900 ml-2">
                              {formatCompactCurrency(amount)}
                            </p>
                          </div>
                        )
                      })}
                      
                      {Object.keys(company.json.perJenis).length > 3 && (
                        <div className="text-xs text-gray-500 font-medium pt-1">
                          +{Object.keys(company.json.perJenis).length - 3} more categories
                        </div>
                      )}
                    </div>
                  </div>
                  
                  {/* Action Buttons */}
                  <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                    <div className="flex items-center space-x-2 text-sm text-gray-600">
                      <Users className="h-4 w-4" />
                      <span>{transactionCount} records</span>
                    </div>
                    
                    <Button
                      variant={isSelected ? "default" : "outline"}
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        setSelectedCompany(companyName)
                        setShowTransactions(true)
                      }}
                      className="action-button"
                    >
                      <Eye className="h-4 w-4 mr-2" />
                      {isSelected ? 'Viewing' : 'View Details'}
                    </Button>
                  </div>
                  
                  {/* Selection indicator */}
                  {isSelected && (
                    <motion.div
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="absolute top-3 left-3"
                    >
                      <div className="w-3 h-3 bg-blue-500 rounded-full shadow-lg"></div>
                    </motion.div>
                  )}
                </motion.div>
              )
            })}
            
            {/* Empty state */}
            {filteredAndSortedSummaries.length === 0 && (
              <div className="col-span-full flex flex-col items-center justify-center py-12 text-center">
                <Search className="h-12 w-12 text-gray-300 mb-4" />
                <h3 className="text-lg font-medium text-gray-900 mb-2">No companies found</h3>
                <p className="text-gray-500 max-w-sm">
                  {searchTerm ? 'Try adjusting your search terms' : 'No company data available for this conversion'}
                </p>
                {searchTerm && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setSearchTerm('')}
                    className="mt-4"
                  >
                    Clear Search
                  </Button>
                )}
              </div>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Transaction Data Table */}
      {showTransactions && (
        <motion.div
          initial={{ opacity: 0, height: 0 }}
          animate={{ opacity: 1, height: 'auto' }}
          exit={{ opacity: 0, height: 0 }}
          className="space-y-4"
        >
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center space-x-2">
                <FileText className="h-5 w-5" />
                <span>Transaction Details</span>
                <Badge variant="secondary">{filteredTransactions.length} transactions</Badge>
              </CardTitle>
              {selectedCompany && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setSelectedCompany(null)}
                >
                  Show All Companies
                </Button>
              )}
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>No</TableHead>
                      <TableHead>Company</TableHead>
                      <TableHead>NPWP</TableHead>
                      <TableHead>Income Type</TableHead>
                      <TableHead className="text-right">Amount (Rupiah)</TableHead>
                      <TableHead className="text-right">Tax</TableHead>
                      <TableHead>Document No</TableHead>
                      <TableHead>Date</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {paginatedTransactions.map((transaction, index) => (
                      <TableRow 
                        key={`${transaction.nomor}-${index}`}
                        className={cn(
                          'hover:bg-gray-50',
                          selectedCompany === transaction.nama && 'bg-blue-50'
                        )}
                      >
                        <TableCell className="font-medium">{transaction.no}</TableCell>
                        <TableCell className="max-w-[200px] truncate" title={transaction.nama}>
                          {transaction.nama}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{transaction.npwp}</TableCell>
                        <TableCell className="max-w-[150px] truncate" title={transaction.jenis_penghasilan}>
                          {transaction.jenis_penghasilan}
                        </TableCell>
                        <TableCell className="text-right font-medium">
                          {formatCurrency(transaction.rupiah)}
                        </TableCell>
                        <TableCell className="text-right font-medium text-green-600">
                          {formatCurrency(transaction.pajak_penghasilan)}
                        </TableCell>
                        <TableCell className="font-mono text-sm">{transaction.nomor}</TableCell>
                        <TableCell>{formatDate(transaction.tanggal)}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>

              {/* Pagination */}
              {totalPages > 1 && (
                <div className="flex justify-between items-center mt-4">
                  <p className="text-sm text-gray-600">
                    Showing {startIndex + 1}-{Math.min(startIndex + itemsPerPage, filteredTransactions.length)} of {filteredTransactions.length} transactions
                  </p>
                  <div className="flex space-x-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === 1}
                      onClick={() => setCurrentPage(currentPage - 1)}
                    >
                      Previous
                    </Button>
                    <span className="flex items-center px-3 text-sm">
                      Page {currentPage} of {totalPages}
                    </span>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={currentPage === totalPages}
                      onClick={() => setCurrentPage(currentPage + 1)}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}
    </motion.div>
  )
}