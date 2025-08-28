'use client'

import { useCallback, useState } from 'react'
import { useDropzone } from 'react-dropzone'
import { motion, AnimatePresence } from 'framer-motion'
import { Upload, FileText, AlertCircle, X, CheckCircle } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Progress } from '@/components/ui/progress'
import { Label } from '@/components/ui/label'
import { useAuth, useCredits, useSubscription } from '@/lib/auth/context'
import { cn } from '@/lib/utils'
import { DocumentType } from '@/lib/supabase/types'

interface ConversionUploaderProps {
  onUploadStart?: (file: File) => void
  onUploadComplete?: (conversionId: string) => void
  onUploadError?: (error: string) => void
  className?: string
}

interface UploadedFile {
  file: File
  preview: string
  status: 'pending' | 'uploading' | 'success' | 'error'
  progress: number
  error?: string
  conversionId?: string
}

export function ConversionUploader({
  onUploadStart,
  onUploadComplete,
  onUploadError,
  className
}: ConversionUploaderProps) {
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([])
  const [isUploading, setIsUploading] = useState(false)
  const [documentType, setDocumentType] = useState<DocumentType>('spt')
  
  const { user } = useAuth()
  const { hasCredits, creditsRemaining } = useCredits()
  const { getMaxFileSize, subscriptionTier } = useSubscription()
  
  const maxFileSize = getMaxFileSize() * 1024 * 1024 // Convert MB to bytes
  const maxFiles = subscriptionTier === 'free' ? 1 : subscriptionTier === 'pro' ? 5 : 10

  const onDrop = useCallback((acceptedFiles: File[], rejectedFiles: any[]) => {
    // Handle rejected files
    if (rejectedFiles.length > 0) {
      const errors = rejectedFiles.map(({ file, errors }) => {
        const errorMessages = errors.map((e: any) => {
          switch (e.code) {
            case 'file-too-large':
              return `File "${file.name}" is too large. Maximum size is ${getMaxFileSize()}MB.`
            case 'file-invalid-type':
              return `File "${file.name}" is not a PDF file.`
            case 'too-many-files':
              return `Too many files. Maximum ${maxFiles} files allowed.`
            default:
              return `File "${file.name}" was rejected: ${e.message}`
          }
        })
        return errorMessages.join(' ')
      })
      
      onUploadError?.(errors.join(' '))
      return
    }

    // Check credits
    if (!hasCredits(acceptedFiles.length)) {
      onUploadError?.(`Insufficient credits. You need ${acceptedFiles.length} credits but only have ${creditsRemaining}.`)
      return
    }

    // Add files to upload queue
    const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
      file,
      preview: URL.createObjectURL(file),
      status: 'pending',
      progress: 0
    }))

    setUploadedFiles(prev => [...prev, ...newFiles])
    
    // Start upload process
    uploadFiles(newFiles)
  }, [hasCredits, creditsRemaining, getMaxFileSize, maxFiles, onUploadError])

  const uploadFiles = async (files: UploadedFile[]) => {
    setIsUploading(true)
    
    for (const fileData of files) {
      try {
        // Update status to uploading
        setUploadedFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { ...f, status: 'uploading', progress: 0 }
              : f
          )
        )

        onUploadStart?.(fileData.file)

        // Create FormData
        const formData = new FormData()
        formData.append('file', fileData.file)
        formData.append('userId', user?.id || '')
        formData.append('documentType', documentType)

        // Upload with progress tracking
        const response = await fetch('/api/convert', {
          method: 'POST',
          body: formData,
          headers: {
            'Accept': 'application/json',
            'Authorization': `Bearer ${process.env.N8N_WEBHOOK_SECRET}`
          }
        })

        if (!response.ok) {
          const errorData = await response.json()
          throw new Error(errorData.error || 'Upload failed')
        }

        const result = await response.json()
        
        // Update status to success
        setUploadedFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { 
                  ...f, 
                  status: 'success', 
                  progress: 100,
                  conversionId: result.conversionId 
                }
              : f
          )
        )

        onUploadComplete?.(result.conversionId)
        
      } catch (error) {
        const errorMessage = error instanceof Error ? error.message : 'Upload failed'
        
        // Update status to error
        setUploadedFiles(prev => 
          prev.map(f => 
            f.file === fileData.file 
              ? { ...f, status: 'error', error: errorMessage }
              : f
          )
        )

        onUploadError?.(errorMessage)
      }
    }
    
    setIsUploading(false)
  }

  const removeFile = (fileToRemove: UploadedFile) => {
    setUploadedFiles(prev => {
      const updated = prev.filter(f => f.file !== fileToRemove.file)
      URL.revokeObjectURL(fileToRemove.preview)
      return updated
    })
  }

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'application/pdf': ['.pdf']
    },
    maxSize: maxFileSize,
    maxFiles: maxFiles - uploadedFiles.length,
    disabled: isUploading || uploadedFiles.length >= maxFiles
  })

  return (
    <div className={cn('space-y-4', className)}>
      {/* Document Type Selection */}
      <Card>
        <CardHeader>
          <CardTitle className="text-lg font-semibold">Document Format</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            <Label className="text-sm font-medium text-gray-700">
              Select the document format for processing:
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div 
                className={cn(
                  "flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors",
                  documentType === 'spt' 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => setDocumentType('spt')}
              >
                <input
                  type="radio"
                  id="spt-format"
                  name="documentType"
                  value="spt"
                  checked={documentType === 'spt'}
                  onChange={() => setDocumentType('spt')}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <Label htmlFor="spt-format" className="font-medium cursor-pointer">SPT Format</Label>
                  <p className="text-sm text-gray-600">Standard PDF to Excel conversion</p>
                </div>
              </div>
              
              <div 
                className={cn(
                  "flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-colors",
                  documentType === 'indomaret' 
                    ? "border-blue-500 bg-blue-50" 
                    : "border-gray-200 hover:border-gray-300"
                )}
                onClick={() => setDocumentType('indomaret')}
              >
                <input
                  type="radio"
                  id="indomaret-format"
                  name="documentType"
                  value="indomaret"
                  checked={documentType === 'indomaret'}
                  onChange={() => setDocumentType('indomaret')}
                  className="h-4 w-4 text-blue-600 border-gray-300 focus:ring-blue-500"
                />
                <div>
                  <Label htmlFor="indomaret-format" className="font-medium cursor-pointer">Indomaret Format</Label>
                  <p className="text-sm text-gray-600">Specialized format for Indomaret documents</p>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Upload Area */}
      <Card className="border-2 border-dashed transition-colors duration-200">
        <CardContent className="p-6">
          <div
            {...getRootProps()}
            className={cn(
              'flex flex-col items-center justify-center py-8 px-4 text-center cursor-pointer transition-colors duration-200',
              isDragActive && 'bg-blue-50 border-blue-300',
              isUploading && 'cursor-not-allowed opacity-50'
            )}
          >
            <input {...getInputProps()} />
            
            <motion.div
              animate={isDragActive ? { scale: 1.1 } : { scale: 1 }}
              transition={{ duration: 0.2 }}
            >
              <Upload className={cn(
                'h-12 w-12 mb-4',
                isDragActive ? 'text-blue-600' : 'text-gray-400'
              )} />
            </motion.div>
            
            <h3 className="text-lg font-semibold mb-2">
              {isDragActive ? 'Drop your PDF files here' : 'Upload PDF Files'}
            </h3>
            
            <p className="text-gray-600 mb-4">
              Drag & drop your PDF files here, or click to browse
            </p>
            
            <div className="text-sm text-gray-500 space-y-1">
              <p>Maximum file size: {getMaxFileSize()}MB</p>
              <p>Maximum files: {maxFiles} ({uploadedFiles.length} uploaded)</p>
              <p>Credits remaining: {creditsRemaining}</p>
            </div>
            
            {!isUploading && (
              <Button className="mt-4" disabled={uploadedFiles.length >= maxFiles}>
                Choose Files
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* File List */}
      <AnimatePresence>
        {uploadedFiles.length > 0 && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="space-y-2"
          >
            {uploadedFiles.map((fileData, index) => (
              <motion.div
                key={`${fileData.file.name}-${index}`}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 20 }}
                transition={{ delay: index * 0.1 }}
              >
                <Card>
                  <CardContent className="p-4">
                    <div className="flex items-center space-x-3">
                      <FileText className="h-8 w-8 text-red-600 flex-shrink-0" />
                      
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium truncate">
                          {fileData.file.name}
                        </p>
                        <p className="text-xs text-gray-500">
                          {(fileData.file.size / 1024 / 1024).toFixed(2)} MB
                        </p>
                        
                        {fileData.status === 'uploading' && (
                          <div className="mt-2">
                            <Progress value={fileData.progress} className="h-2" />
                            <p className="text-xs text-gray-500 mt-1">
                              Uploading... {fileData.progress}%
                            </p>
                          </div>
                        )}
                        
                        {fileData.status === 'error' && fileData.error && (
                          <Alert variant="destructive" className="mt-2">
                            <AlertCircle className="h-4 w-4" />
                            <AlertDescription className="text-xs">
                              {fileData.error}
                            </AlertDescription>
                          </Alert>
                        )}
                      </div>
                      
                      <div className="flex items-center space-x-2">
                        {fileData.status === 'success' && (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        )}
                        {fileData.status === 'error' && (
                          <AlertCircle className="h-5 w-5 text-red-600" />
                        )}
                        
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => removeFile(fileData)}
                          disabled={fileData.status === 'uploading'}
                        >
                          <X className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </motion.div>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}