# PDF to Excel Converter - Product Requirements Document

## 1. Project Overview

### 1.1 Product Vision
A modern, AI-powered web application that converts PDF documents containing tabular data into Excel spreadsheets with high accuracy and professional user experience.

### 1.2 Key Objectives
- Provide seamless PDF to Excel conversion using AI technology
- Deliver a fast, responsive, and intuitive user interface
- Maintain user conversion history and analytics
- Ensure scalable architecture for future enhancements
- Implement robust error handling and user feedback

### 1.3 Target Audience
- **Primary**: Business professionals, accountants, data analysts
- **Secondary**: Students, researchers, administrative staff
- **Use Cases**: Financial reports, tax documents, invoices, data tables

## 2. Technical Architecture

### 2.1 Technology Stack

#### Frontend
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Components**: Shadcn/ui component library
- **State Management**: Zustand or React Context
- **File Handling**: React Dropzone
- **Animation**: Framer Motion

#### Backend & Services
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage
- **API Integration**: n8n webhook (`https://n8n-c4bluags.n8x.my.id/webhook/pdf-converter`)
- **Deployment**: Vercel

#### Third-Party Services
- **AI Processing**: OpenAI GPT-4o (via n8n)
- **Excel Generation**: Google Sheets API (via n8n)
- **File Conversion**: n8n workflow automation

### 2.2 System Architecture
```
┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐
│   Next.js 14    │    │    Supabase     │    │      n8n        │
│   Frontend      │◄──►│   Database      │    │   Workflow      │
│                 │    │   Storage       │    │                 │
│                 │    │   Auth          │    │   ┌─────────┐   │
│                 │    │                 │    │   │ OpenAI  │   │
│                 │    │                 │    │   │ Vision  │   │
│                 │◄───┼─────────────────┼────┼──►│   API   │   │
│                 │    │                 │    │   └─────────┘   │
│                 │    │                 │    │                 │
│                 │    │                 │    │   ┌─────────┐   │
│                 │    │                 │    │   │ Google  │   │
│                 │    │                 │    │   │ Sheets  │   │
│                 │    │                 │    │   │   API   │   │
│                 │    │                 │    │   └─────────┘   │
└─────────────────┘    └─────────────────┘    └─────────────────┘
```

## 3. Database Schema (Supabase)

### 3.1 Tables

#### users (extends auth.users)
```sql
-- Additional user profile data
CREATE TABLE public.user_profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  credits_remaining INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### conversions
```sql
CREATE TABLE public.conversions (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  original_filename TEXT NOT NULL,
  converted_filename TEXT,
  file_size BIGINT,
  status TEXT DEFAULT 'pending', -- pending, processing, completed, failed
  error_message TEXT,
  tables_extracted INTEGER DEFAULT 0,
  total_rows INTEGER DEFAULT 0,
  processing_time_ms INTEGER,
  google_sheet_url TEXT,
  download_url TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### usage_analytics
```sql
CREATE TABLE public.usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  conversion_id UUID REFERENCES conversions,
  event_type TEXT, -- upload, conversion_start, conversion_success, conversion_failed, download
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

#### subscription_plans
```sql
CREATE TABLE public.subscription_plans (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  description TEXT,
  price_monthly DECIMAL(10,2),
  price_yearly DECIMAL(10,2),
  credits_per_month INTEGER,
  max_file_size_mb INTEGER,
  features JSONB,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);
```

### 3.2 Storage Buckets
- **pdfs**: Store uploaded PDF files (temporary, auto-delete after 24h)
- **exports**: Store converted Excel files (temporary, auto-delete after 24h)
- **avatars**: User profile pictures

### 3.3 Row Level Security (RLS)
```sql
-- Enable RLS on all tables
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY "Users can view own conversions" ON conversions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own conversions" ON conversions
  FOR INSERT WITH CHECK (auth.uid() = user_id);
```

## 4. Frontend Implementation

### 4.1 Project Structure
```
src/
├── app/
│   ├── (auth)/
│   │   ├── login/
│   │   └── register/
│   ├── (dashboard)/
│   │   ├── dashboard/
│   │   ├── history/
│   │   └── settings/
│   ├── convert/
│   ├── pricing/
│   ├── globals.css
│   ├── layout.tsx
│   └── page.tsx
├── components/
│   ├── ui/ (shadcn components)
│   ├── converter/
│   ├── dashboard/
│   ├── auth/
│   └── shared/
├── lib/
│   ├── supabase/
│   ├── utils/
│   └── types/
├── hooks/
├── stores/
└── styles/
```

### 4.2 Key Components

#### ConversionUploader
```typescript
interface ConversionUploaderProps {
  onUploadStart: (file: File) => void;
  onUploadComplete: (conversionId: string) => void;
  onError: (error: string) => void;
  maxFileSize?: number;
  acceptedTypes?: string[];
}
```

#### ConversionStatus
```typescript
interface ConversionStatusProps {
  conversionId: string;
  onStatusChange: (status: ConversionStatus) => void;
  pollInterval?: number;
}

type ConversionStatus = 'pending' | 'processing' | 'completed' | 'failed';
```

#### HistoryTable
```typescript
interface HistoryTableProps {
  conversions: Conversion[];
  onRetry: (conversionId: string) => void;
  onDelete: (conversionId: string) => void;
  onDownload: (conversionId: string) => void;
}
```

### 4.3 Pages & Routes

#### Public Routes
- `/` - Landing page with features and demo
- `/pricing` - Subscription plans and pricing
- `/login` - User authentication
- `/register` - User registration

#### Protected Routes (require authentication)
- `/convert` - Main conversion interface
- `/dashboard` - User dashboard with analytics
- `/history` - Conversion history
- `/settings` - User preferences and billing

#### API Routes
- `/api/convert` - Handle PDF upload and n8n integration
- `/api/status/[id]` - Check conversion status
- `/api/download/[id]` - Secure file download
- `/api/webhooks/n8n` - Receive n8n completion notifications

## 5. Features & Functionality

### 5.1 Core Features

#### File Upload & Validation
- **Drag & drop interface** with visual feedback
- **File type validation** (PDF only)
- **File size limits** (5MB free, 50MB premium)
- **Multiple file upload** (premium feature)
- **Upload progress tracking**

#### AI-Powered Conversion
- **Table detection** using OpenAI Vision
- **Data extraction** with structure preservation
- **Error handling** for complex documents
- **Progress notifications** during processing

#### Download & Export
- **Excel file download** (.xlsx format)
- **Google Sheets integration** with shareable links
- **Batch download** for multiple files
- **Export expiration** (24-48 hours)

#### User Management
- **Email/password authentication**
- **OAuth providers** (Google, GitHub)
- **Profile management**
- **Usage tracking and limits**

### 5.2 Premium Features

#### Subscription Tiers
```typescript
interface SubscriptionTier {
  name: 'Free' | 'Pro' | 'Business';
  monthlyPrice: number;
  features: {
    creditsPerMonth: number;
    maxFileSize: number; // MB
    batchProcessing: boolean;
    priorityProcessing: boolean;
    apiAccess: boolean;
    customRetention: number; // days
  };
}
```

#### Advanced Features
- **Batch processing** (multiple files)
- **API access** for developers
- **Custom retention periods**
- **Priority processing queue**
- **Advanced export options**

### 5.3 Analytics & Reporting

#### User Dashboard
- **Conversion statistics** (success rate, processing time)
- **Usage graphs** (daily/monthly conversions)
- **Credit consumption** tracking
- **File size trends**

#### Admin Analytics
- **System performance** metrics
- **User engagement** tracking
- **Conversion success rates**
- **Resource utilization**

## 6. API Integration

### 6.1 n8n Webhook Integration

#### Request Format
```typescript
interface ConversionRequest {
  file: string; // base64 encoded PDF
  fileName: string;
  mimeType: string;
  fileSize: number;
  userId?: string;
  conversionId?: string;
}
```

#### Response Format
```typescript
interface ConversionResponse {
  success: boolean;
  data?: {
    downloadUrl: string;
    fileName: string;
    originalFile: string;
    expiresAt: string;
    googleSheetUrl?: string;
    statistics: {
      tablesExtracted: number;
      totalRows: number;
      processingTimeMs: number;
    };
  };
  error?: string;
}
```

#### Error Handling
```typescript
interface APIError {
  code: string;
  message: string;
  details?: Record<string, any>;
  retryable: boolean;
}
```

### 6.2 Supabase Integration

#### Client Configuration
```typescript
// lib/supabase/client.ts
import { createClientComponentClient } from '@supabase/auth-helpers-nextjs';

export const supabase = createClientComponentClient();
```

#### Database Operations
```typescript
// lib/supabase/conversions.ts
export async function createConversion(data: CreateConversionData) {
  const { data: conversion, error } = await supabase
    .from('conversions')
    .insert(data)
    .select()
    .single();
  
  if (error) throw error;
  return conversion;
}

export async function updateConversionStatus(
  id: string, 
  status: ConversionStatus,
  result?: ConversionResult
) {
  const { error } = await supabase
    .from('conversions')
    .update({ status, ...result, updated_at: new Date().toISOString() })
    .eq('id', id);
    
  if (error) throw error;
}
```

## 7. User Experience (UX)

### 7.1 User Flow

#### New User Journey
1. **Landing Page** → Learn about features
2. **Registration** → Create account (email/OAuth)
3. **Onboarding** → Quick tutorial/demo
4. **First Conversion** → Upload PDF → Download Excel
5. **Dashboard** → View history and usage

#### Returning User Journey
1. **Login** → Access dashboard
2. **Quick Convert** → Direct upload from dashboard
3. **History Review** → Previous conversions
4. **Upgrade** → Premium features if needed

### 7.2 UI/UX Requirements

#### Design System
- **Color Palette**: Professional blue/white theme
- **Typography**: Inter/Geist fonts for readability
- **Components**: Consistent shadcn/ui components
- **Responsive**: Mobile-first design approach

#### Accessibility
- **WCAG 2.1 AA compliance**
- **Keyboard navigation** support
- **Screen reader** compatibility
- **High contrast** mode support

#### Performance
- **Core Web Vitals** optimization
- **Progressive loading** for large files
- **Offline capability** for basic features
- **Error boundaries** for graceful failures

## 8. Security & Privacy

### 8.1 Data Protection
- **File encryption** during upload/storage
- **Automatic deletion** after expiration
- **GDPR compliance** for EU users
- **User data anonymization** options

### 8.2 Authentication & Authorization
- **JWT token** based authentication
- **Role-based access** control
- **Rate limiting** for API endpoints
- **CSRF protection** for forms

### 8.3 File Security
- **Virus scanning** for uploaded files
- **Content-type validation**
- **Secure file URLs** with expiration
- **Access logging** for audit trails

## 9. Performance Requirements

### 9.1 Frontend Performance
- **First Contentful Paint**: < 1.5s
- **Largest Contentful Paint**: < 2.5s
- **Cumulative Layout Shift**: < 0.1
- **First Input Delay**: < 100ms

### 9.2 Backend Performance
- **API Response Time**: < 500ms average
- **File Upload Speed**: Support up to 50MB files
- **Conversion Processing**: Status updates every 5s
- **Database Queries**: < 100ms average

### 9.3 Scalability
- **Concurrent Users**: 1000+ simultaneous
- **Daily Conversions**: 10,000+ files
- **Storage Growth**: Auto-scaling with usage
- **CDN Integration**: Global file delivery

## 10. Monitoring & Analytics

### 10.1 Application Monitoring
- **Vercel Analytics** for performance tracking
- **Sentry** for error monitoring
- **Supabase Metrics** for database performance
- **Custom dashboards** for business metrics

### 10.2 User Analytics
- **Conversion funnel** tracking
- **Feature usage** statistics
- **User retention** metrics
- **A/B testing** framework

## 11. Development Phases

### Phase 1: MVP (4-6 weeks)
- [ ] Basic Next.js setup with Supabase
- [ ] User authentication system
- [ ] File upload and conversion flow
- [ ] Basic dashboard and history
- [ ] n8n integration and error handling

### Phase 2: Enhanced Features (3-4 weeks)
- [ ] Subscription and payment system
- [ ] Advanced file handling (batch upload)
- [ ] Improved UI/UX with animations
- [ ] Analytics dashboard
- [ ] Admin panel

### Phase 3: Scale & Optimize (2-3 weeks)
- [ ] Performance optimization
- [ ] Advanced security features
- [ ] API for developers
- [ ] Mobile app considerations
- [ ] Advanced analytics and reporting

## 12. Success Metrics

### 12.1 Technical KPIs
- **Conversion Success Rate**: > 95%
- **Average Processing Time**: < 30 seconds
- **Uptime**: > 99.9%
- **Error Rate**: < 1%

### 12.2 Business KPIs
- **User Registration**: 100+ users/month
- **Conversion to Premium**: 10%+ rate
- **User Retention**: 70%+ monthly
- **Customer Satisfaction**: 4.5+ stars

### 12.3 User Experience KPIs
- **Time to First Conversion**: < 2 minutes
- **User Completion Rate**: > 80%
- **Support Ticket Volume**: < 5% of users
- **Feature Adoption**: 60%+ for key features

---

This PRD provides a comprehensive roadmap for building a production-ready PDF to Excel converter with modern architecture, excellent user experience, and scalable business model.