'use client'

import { useState } from 'react'
import { motion } from 'framer-motion'
import { ArrowLeft, FileText, Zap, Download } from 'lucide-react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { ConversionUploader } from '@/components/conversion/ConversionUploader'
import { ConversionStatus } from '@/components/conversion/ConversionStatus'
import { useAuth } from '@/lib/auth/context'
import { redirect } from 'next/navigation'

interface ConversionData {
  id: string
  filename: string
  status: 'pending' | 'processing' | 'completed' | 'failed'
  documentType?: string
  progress?: number
  downloadUrl?: string
  error?: string
}

export default function ConvertPage() {
  const { user, loading } = useAuth()
  const [conversions, setConversions] = useState<ConversionData[]>([])
  const [isUploading, setIsUploading] = useState(false)

  // Redirect to login if not authenticated
  if (!loading && !user) {
    redirect('/auth/login?redirect=/convert')
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  const handleUploadStart = () => {
    setIsUploading(true)
  }

  const handleUploadComplete = (conversionId: string) => {
    // Create a new conversion entry with the ID
    const newConversion: ConversionData = {
      id: conversionId,
      filename: 'Processing...', // Will be updated by status component
      status: 'pending',
      progress: 0
    }
    setConversions(prev => [newConversion, ...prev])
    setIsUploading(false)
  }

  const handleUploadError = (error: string) => {
    setIsUploading(false)
    // Error handling is done in the ConversionUploader component
  }

  const handleStatusUpdate = (id: string, status: ConversionData['status'], progress?: number, downloadUrl?: string, error?: string) => {
    setConversions(prev => 
      prev.map(conv => 
        conv.id === id 
          ? { ...conv, status, progress: progress ?? conv.progress, downloadUrl, error }
          : conv
      )
    )
  }

  const handleRemoveConversion = (id: string) => {
    setConversions(prev => prev.filter(conv => conv.id !== id))
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-purple-50">
      {/* Navigation */}
      <nav className="sticky top-0 z-50 bg-white/80 backdrop-blur-md border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center space-x-4">
              <Link href="/" className="flex items-center space-x-2 text-gray-600 hover:text-gray-900 transition-colors">
                <ArrowLeft className="h-5 w-5" />
                <span>Back to Home</span>
              </Link>
            </div>
            
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 bg-gradient-to-r from-blue-600 to-purple-600 rounded-lg flex items-center justify-center">
                <FileText className="h-5 w-5 text-white" />
              </div>
              <span className="text-xl font-bold text-gray-900">PDF to Excel</span>
            </div>
            
            <div className="flex items-center space-x-4">
              <Link href="/dashboard">
                <Button variant="ghost">Dashboard</Button>
              </Link>
              <Link href="/settings">
                <Button variant="outline">Settings</Button>
              </Link>
            </div>
          </div>
        </div>
      </nav>

      <div className="max-w-6xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6 }}
          className="text-center mb-8"
        >
          <h1 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
            Convert PDF to Excel
          </h1>
          <p className="text-lg text-gray-600 max-w-2xl mx-auto">
            Upload your PDF files and convert them to Excel spreadsheets with our AI-powered technology.
            Preserve formatting and extract tables with high accuracy.
          </p>
        </motion.div>

        {/* How it works */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.1 }}
          className="mb-8"
        >
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center space-x-2">
                <Zap className="h-5 w-5 text-blue-600" />
                <span>How it works</span>
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                    1
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Upload PDF</h3>
                    <p className="text-sm text-gray-600">Drag & drop or click to select</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                    2
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">AI Processing</h3>
                    <p className="text-sm text-gray-600">Extract tables & data</p>
                  </div>
                </div>
                <div className="flex items-center space-x-3">
                  <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center text-blue-600 font-semibold text-sm">
                    3
                  </div>
                  <div>
                    <h3 className="font-medium text-gray-900">Download Excel</h3>
                    <p className="text-sm text-gray-600">Get formatted spreadsheet</p>
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        </motion.div>

        {/* Upload Section */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          className="mb-8"
        >
          <ConversionUploader
            onUploadStart={handleUploadStart}
            onUploadComplete={handleUploadComplete}
            onUploadError={handleUploadError}
          />
        </motion.div>

        {/* Conversions List */}
        {conversions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.3 }}
          >
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center space-x-2">
                  <Download className="h-5 w-5 text-green-600" />
                  <span>Your Conversions</span>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {conversions.map((conversion) => (
                  <ConversionStatus
                    key={conversion.id}
                    conversionId={conversion.id}
                    showDetails={true}
                    autoRefresh={true}
                    onStatusChange={(status) => 
                      handleStatusUpdate(conversion.id, status)
                    }
                    onDownload={() => {
                      // Keep conversion in list for a moment to show success, then remove
                      setTimeout(() => handleRemoveConversion(conversion.id), 2000)
                    }}
                  />
                ))}
              </CardContent>
            </Card>
          </motion.div>
        )}

        {/* Tips */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.4 }}
          className="mt-8"
        >
          <Card className="bg-blue-50 border-blue-200">
            <CardHeader>
              <CardTitle className="text-blue-900">💡 Tips for Best Results</CardTitle>
            </CardHeader>
            <CardContent className="text-blue-800">
              <ul className="space-y-2 text-sm">
                <li>• Ensure your PDF contains tables or structured data</li>
                <li>• Higher resolution PDFs produce better results</li>
                <li>• Files with clear table borders are easier to process</li>
                <li>• Maximum file size: 10MB per file</li>
                <li>• Supported format: PDF only</li>
              </ul>
            </CardContent>
          </Card>
        </motion.div>
      </div>
    </div>
  )
}