# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is a PDF to Excel converter web application built with Next.js 14 and the app router. The application allows users to upload PDF files containing tabular data and converts them to Excel spreadsheets using AI-powered processing via an n8n webhook integration.

## Development Commands

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server
npm run start

# Run linting
npm run lint
```

The development server runs on http://localhost:3000

## Technology Stack & Architecture

### Frontend Stack
- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript with strict mode enabled
- **Styling**: Tailwind CSS with CSS variables for theming
- **Components**: Shadcn/ui component library (New York style)
- **Icons**: Lucide React
- **Fonts**: Geist Sans and Geist Mono (local fonts)

### Key Dependencies
- `class-variance-authority` - For component variant management
- `clsx` + `tailwind-merge` - For conditional className handling
- `tailwindcss-animate` - For animations

### Configuration Files
- **Tailwind**: Uses CSS variables for theming with dark mode support
- **TypeScript**: Strict mode enabled with path aliases (`@/*` maps to `./`)
- **Shadcn/ui**: Configured with New York style, RSC support, neutral base color

## Project Structure

```
/
├── app/                    # Next.js app router
│   ├── fonts/             # Local Geist fonts
│   ├── globals.css        # Global styles with CSS variables
│   ├── layout.tsx         # Root layout with font configuration
│   └── page.tsx           # Landing page (currently default Next.js)
├── lib/
│   └── utils.ts           # Utility functions (cn helper)
├── components.json        # Shadcn/ui configuration
├── PRD.md                 # Comprehensive product requirements
└── README.md              # Basic Next.js documentation
```

## Architecture & Integration Points

Based on the PRD, this application follows a modern serverless architecture:

### Backend Integration
- **Database**: Supabase (PostgreSQL with RLS)
- **Authentication**: Supabase Auth
- **File Storage**: Supabase Storage with auto-deletion
- **AI Processing**: n8n webhook at `https://n8n-c4bluags.n8x.my.id/webhook/pdf-converter`
- **AI Provider**: OpenAI GPT-4o for table extraction
- **Excel Generation**: Google Sheets API

### Key Features to Implement
- File upload with drag & drop interface
- Real-time conversion status tracking
- User authentication and profile management
- Conversion history and analytics
- Subscription/credit system
- Download management with expiration

### Database Schema
The application uses several key tables:
- `user_profiles` - Extended user data
- `conversions` - Conversion tracking and status
- `usage_analytics` - User behavior tracking
- `subscription_plans` - Pricing tiers

### Component Architecture
The application should be organized with:
- `/components/ui/` - Shadcn/ui base components
- `/components/converter/` - File upload and processing components
- `/components/dashboard/` - User dashboard components
- `/components/auth/` - Authentication components
- `/components/shared/` - Reusable components

### Utilities and Helpers
- `lib/supabase/` - Database operations and client setup
- `lib/utils/` - General utility functions
- `hooks/` - Custom React hooks
- `stores/` - State management (Zustand recommended)

## Development Guidelines

### Styling
- Uses Tailwind CSS with a custom design system
- CSS variables for theming (supports dark mode)
- Consistent spacing and color tokens
- Component variants using `class-variance-authority`

### TypeScript
- Strict mode enabled
- Path aliases configured (`@/` for root)
- Type definitions should be comprehensive for API responses

### Component Development
- Follow Shadcn/ui patterns for consistency
- Use the `cn()` utility for conditional classes
- Implement proper error boundaries
- Ensure responsive design (mobile-first)

### Security Considerations
- Implement proper file validation (PDF only, size limits)
- Use Supabase RLS for data protection
- Handle file uploads securely
- Implement rate limiting for API endpoints

## API Integration Notes

### n8n Webhook
- Endpoint: `https://n8n-c4bluags.n8x.my.id/webhook/pdf-converter`
- Accepts base64 encoded PDF files
- Returns conversion status and download URLs
- Implements retry logic for failed conversions

### Supabase Integration
- Real-time subscriptions for status updates
- Row Level Security enabled
- File storage with automatic cleanup
- Authentication with social providers

## Performance Requirements

- First Contentful Paint: < 1.5s
- API responses: < 500ms average
- Support files up to 50MB (premium)
- Real-time status updates every 5s
- Core Web Vitals optimization required