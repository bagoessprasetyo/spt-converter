export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          email: string | null
          full_name: string | null
          avatar_url: string | null
          subscription_tier: string
          credits_remaining: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: string
          credits_remaining?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          email?: string | null
          full_name?: string | null
          avatar_url?: string | null
          subscription_tier?: string
          credits_remaining?: number
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      conversions: {
        Row: {
          id: string
          user_id: string | null
          original_filename: string
          converted_filename: string | null
          file_size: number | null
          status: string
          document_type: string
          error_message: string | null
          tables_extracted: number
          total_rows: number
          processing_time_ms: number | null
          google_sheet_url: string | null
          download_url: string | null
          summaries: Json | null
          transaction_data: Json | null
          expires_at: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          original_filename: string
          converted_filename?: string | null
          file_size?: number | null
          status?: string
          document_type?: string
          error_message?: string | null
          tables_extracted?: number
          total_rows?: number
          processing_time_ms?: number | null
          google_sheet_url?: string | null
          download_url?: string | null
          summaries?: Json | null
          transaction_data?: Json | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          original_filename?: string
          converted_filename?: string | null
          file_size?: number | null
          status?: string
          document_type?: string
          error_message?: string | null
          tables_extracted?: number
          total_rows?: number
          processing_time_ms?: number | null
          google_sheet_url?: string | null
          download_url?: string | null
          summaries?: Json | null
          transaction_data?: Json | null
          expires_at?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      usage_analytics: {
        Row: {
          id: string
          user_id: string | null
          conversion_id: string | null
          event_type: string | null
          metadata: Json | null
          created_at: string
        }
        Insert: {
          id?: string
          user_id?: string | null
          conversion_id?: string | null
          event_type?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Update: {
          id?: string
          user_id?: string | null
          conversion_id?: string | null
          event_type?: string | null
          metadata?: Json | null
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: "usage_analytics_conversion_id_fkey"
            columns: ["conversion_id"]
            referencedRelation: "conversions"
            referencedColumns: ["id"]
          }
        ]
      }
      subscription_plans: {
        Row: {
          id: string
          name: string
          description: string | null
          price_monthly: number | null
          price_yearly: number | null
          credits_per_month: number | null
          max_file_size_mb: number | null
          features: Json | null
          is_active: boolean
          created_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          price_monthly?: number | null
          price_yearly?: number | null
          credits_per_month?: number | null
          max_file_size_mb?: number | null
          features?: Json | null
          is_active?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          price_monthly?: number | null
          price_yearly?: number | null
          credits_per_month?: number | null
          max_file_size_mb?: number | null
          features?: Json | null
          is_active?: boolean
          created_at?: string
        }
        Relationships: []
      }
    }
    Views: {
      [_ in never]: never
    }
    Functions: {
      [_ in never]: never
    }
    Enums: {
      [_ in never]: never
    }
    CompositeTypes: {
      [_ in never]: never
    }
  }
}

// Application Types
export type ConversionStatus = 'pending' | 'processing' | 'completed' | 'failed'

export type DocumentType = 'spt' | 'indomaret'

export type SubscriptionTier = 'free' | 'pro' | 'business'

export type EventType = 'upload' | 'conversion_start' | 'conversion_success' | 'conversion_failed' | 'download'

export interface ConversionRequest {
  file: string // base64 encoded PDF
  fileName: string
  mimeType: string
  fileSize: number
  documentType: DocumentType
  userId?: string
  conversionId?: string
}

export interface ConversionResponse {
  success: boolean
  conversionId?: string
  status?: string
  message?: string
  estimatedTime?: number
  data?: {
    downloadUrl: string
    fileName: string
    originalFile: string
    expiresAt: string
    googleSheetUrl?: string
    statistics: {
      tablesExtracted: number
      totalRows: number
      processingTimeMs: number
    }
  }
  error?: string
}

export interface APIError {
  code: string
  message: string
  details?: Record<string, any>
  retryable: boolean
}

export interface SubscriptionPlan {
  name: 'Free' | 'Pro' | 'Business'
  monthlyPrice: number
  features: {
    creditsPerMonth: number
    maxFileSize: number // MB
    batchProcessing: boolean
    priorityProcessing: boolean
    apiAccess: boolean
    customRetention: number // days
  }
}

// Conversion Detail Types
export interface CompanySummary {
  json: {
    nama: string
    totalPajak: number
    perJenis: Record<string, number>
  }
}

export interface TransactionData {
  no: number
  nama: string
  npwp: string
  jenis_penghasilan: string
  rupiah: number
  pajak_penghasilan: number
  nomor: string
  tanggal: string
}

export interface ConversionDetails {
  summaries: CompanySummary[]
  transaction_data: TransactionData[]
}