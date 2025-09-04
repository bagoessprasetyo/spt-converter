'use client'

import { useState } from 'react'
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
  Hash
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
  
  const itemsPerPage = 20

  // Filter functions
  const filteredSummaries = summaries.filter(summary =>
    summary.json.nama.toLowerCase().includes(searchTerm.toLowerCase())
  )

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

  // Statistics calculations
  const totalTax = summaries.reduce((sum, company) => sum + company.json.totalPajak, 0)
  const totalCompanies = summaries.length
  const totalTransactions = transactionData.length
  const uniqueCategories = [...new Set(transactionData.map(t => t.jenis_penghasilan))].length

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

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('space-y-6', className)}
    >
      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Building2 className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalCompanies}</p>
                <p className="text-sm text-gray-600">Companies</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Wallet className="h-5 w-5 text-green-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{formatCurrency(totalTax)}</p>
                <p className="text-sm text-gray-600">Total Tax</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <FileText className="h-5 w-5 text-purple-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{totalTransactions}</p>
                <p className="text-sm text-gray-600">Transactions</p>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="p-4">
            <div className="flex items-center space-x-2">
              <Hash className="h-5 w-5 text-orange-600" />
              <div>
                <p className="text-2xl font-bold text-gray-900">{uniqueCategories}</p>
                <p className="text-sm text-gray-600">Categories</p>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Action Bar */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div className="flex items-center space-x-2 flex-1">
          <div className="relative flex-1 max-w-sm">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Search companies, NPWP, or categories..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-10"
            />
          </div>
          <Button
            variant="outline"
            onClick={() => setShowTransactions(!showTransactions)}
            className="flex items-center space-x-2"
          >
            <FileText className="h-4 w-4" />
            <span>{showTransactions ? 'Hide' : 'Show'} Transactions</span>
            {showTransactions ? 
              <ChevronUp className="h-4 w-4" /> : 
              <ChevronDown className="h-4 w-4" />
            }
          </Button>
        </div>
        
        {onExport && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="outline" className="flex items-center space-x-2">
                <Download className="h-4 w-4" />
                <span>Export</span>
                <MoreVertical className="h-4 w-4" />
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

      {/* Company Summaries */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center space-x-2">
            <Building2 className="h-5 w-5" />
            <span>Company Summaries</span>
            <Badge variant="secondary">{filteredSummaries.length} companies</Badge>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {filteredSummaries.map((company, index) => {
              const companyName = company.json.nama
              const isSelected = selectedCompany === companyName
              
              return (
                <motion.div
                  key={`company-${index}-${companyName}`}
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    'p-4 border rounded-lg hover:shadow-md transition-all cursor-pointer',
                    isSelected && 'border-blue-500 bg-blue-50'
                  )}
                  onClick={(e) => {
                    // Only trigger if clicking on the card itself, not child elements
                    if (e.target === e.currentTarget || (e.target as HTMLElement).closest('.company-info')) {
                      setSelectedCompany(isSelected ? null : companyName)
                    }
                  }}
                >
                  <div className="flex justify-between items-start">
                    <div className="flex-1 company-info">
                      <h3 className="font-semibold text-gray-900 mb-1">{companyName}</h3>
                      <p className="text-sm text-gray-600 mb-2">
                        Total Tax: <span className="font-medium text-green-600">
                          {formatCurrency(company.json.totalPajak)}
                        </span>
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {Object.entries(company.json.perJenis).map(([type, amount]) => (
                          <Badge 
                            key={`${type}-${index}`}
                            variant="outline" 
                            className="text-xs"
                          >
                            {type}: {formatCurrency(amount)}
                          </Badge>
                        ))}
                      </div>
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={(e) => {
                        e.stopPropagation()
                        e.preventDefault()
                        console.log(`View details clicked for: ${companyName}`)
                        setSelectedCompany(companyName)
                        setShowTransactions(true)
                      }}
                    >
                      View Details
                    </Button>
                  </div>
                </motion.div>
              )
            })}
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