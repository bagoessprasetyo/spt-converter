import { createClient } from '@/lib/supabase/server'

export interface StorageResult {
  success: boolean
  downloadUrl?: string
  filePath?: string
  expiresAt?: string
  error?: string
}

export async function uploadToSupabaseStorage(
  fileBuffer: Buffer,
  fileName: string,
  conversionId: string,
  userId: string
): Promise<StorageResult> {
  try {
    console.log(`Uploading ${fileName} to Supabase Storage`)
    
    const supabase = createClient()
    
    // Create file path with user ID and conversion ID for organization
    const filePath = `conversions/${userId}/${conversionId}/${fileName}`
    
    // Upload file to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('converted-files')
      .upload(filePath, fileBuffer, {
        contentType: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        upsert: false
      })
    
    if (uploadError) {
      console.error('Supabase upload error:', uploadError)
      throw new Error(`Upload failed: ${uploadError.message}`)
    }
    
    console.log('File uploaded successfully:', uploadData.path)
    
    // Generate signed URL for download (valid for 24 hours)
    const expiresIn = 24 * 60 * 60 // 24 hours in seconds
    const { data: urlData, error: urlError } = await supabase.storage
      .from('converted-files')
      .createSignedUrl(uploadData.path, expiresIn)
    
    if (urlError) {
      console.error('Signed URL generation error:', urlError)
      throw new Error(`Download URL generation failed: ${urlError.message}`)
    }
    
    const expiresAt = new Date(Date.now() + expiresIn * 1000).toISOString()
    
    console.log(`Download URL generated, expires at: ${expiresAt}`)
    
    return {
      success: true,
      downloadUrl: urlData.signedUrl,
      filePath: uploadData.path,
      expiresAt
    }
    
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Storage upload failed'
    console.error('File storage error:', errorMessage)
    
    return {
      success: false,
      error: errorMessage
    }
  }
}

export async function setupStorageBucket(): Promise<boolean> {
  try {
    const supabase = createClient()
    
    // Check if bucket exists
    const { data: buckets, error: listError } = await supabase.storage.listBuckets()
    
    if (listError) {
      console.error('Error listing buckets:', listError)
      return false
    }
    
    const bucketExists = buckets.some(bucket => bucket.name === 'converted-files')
    
    if (!bucketExists) {
      // Create the bucket
      const { error: createError } = await supabase.storage.createBucket('converted-files', {
        public: false,
        allowedMimeTypes: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'],
        fileSizeLimit: 50 * 1024 * 1024 // 50MB limit
      })
      
      if (createError) {
        console.error('Error creating bucket:', createError)
        return false
      }
      
      console.log('Created converted-files storage bucket')
    }
    
    return true
    
  } catch (error) {
    console.error('Storage setup error:', error)
    return false
  }
}

export async function cleanupExpiredFiles(): Promise<void> {
  try {
    console.log('Starting cleanup of expired files')
    
    const supabase = createClient()
    
    // Get conversions that are completed and expired
    const { data: expiredConversions, error: fetchError } = await supabase
      .from('conversions')
      .select('id, download_url, expires_at')
      .eq('status', 'completed')
      .not('download_url', 'is', null)
      .lt('expires_at', new Date().toISOString())
    
    if (fetchError) {
      console.error('Error fetching expired conversions:', fetchError)
      return
    }
    
    if (!expiredConversions || expiredConversions.length === 0) {
      console.log('No expired files found')
      return
    }
    
    console.log(`Found ${expiredConversions.length} expired conversions`)
    
    // Delete files from storage and update database
    for (const conversion of expiredConversions) {
      try {
        // Extract file path from download URL or construct it
        // This is a simplified approach - in production you'd want to store the file path
        const filePath = `conversions/${conversion.id}` // This would need to be more specific
        
        // Delete from storage (non-critical if it fails)
        const { error: deleteError } = await supabase.storage
          .from('converted-files')
          .remove([filePath])
        
        if (deleteError) {
          console.warn(`Failed to delete file for conversion ${conversion.id}:`, deleteError)
        }
        
        // Update database to remove download URL
        await supabase
          .from('conversions')
          .update({ 
            download_url: null,
            expires_at: null 
          })
          .eq('id', conversion.id)
        
        console.log(`Cleaned up expired conversion: ${conversion.id}`)
        
      } catch (error) {
        console.error(`Error cleaning up conversion ${conversion.id}:`, error)
      }
    }
    
    console.log('Cleanup completed')
    
  } catch (error) {
    console.error('Cleanup process error:', error)
  }
}