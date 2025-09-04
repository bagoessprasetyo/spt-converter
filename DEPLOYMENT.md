# Deployment Guide

## System Dependencies

For the PDF to Excel conversion to work properly, the following system dependencies are required:

### For PDF Processing (pdfjs-dist + canvas)
The application uses `pdfjs-dist` with `canvas` for PDF to image conversion. Canvas requires some system libraries:

#### Ubuntu/Debian:
```bash
sudo apt-get update
sudo apt-get install -y build-essential libcairo2-dev libpango1.0-dev libjpeg-dev libgif-dev librsvg2-dev
```

#### macOS (using Homebrew):
```bash
brew install pkg-config cairo pango libpng jpeg giflib librsvg pixman
```

#### Docker:
Add to your Dockerfile:
```dockerfile
RUN apt-get update && apt-get install -y \
    build-essential \
    libcairo2-dev \
    libpango1.0-dev \
    libjpeg-dev \
    libgif-dev \
    librsvg2-dev
```

### For Image Processing (Sharp)
Sharp is already included and should work out of the box on most systems.

## Environment Variables

Make sure to set the following environment variables:

```env
# OpenAI Configuration (Required)
OPENAI_API_KEY=your_openai_api_key

# Supabase Configuration
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
SUPABASE_SERVICE_ROLE_KEY=your_supabase_service_role_key

# Application Configuration  
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

## Database Setup

Run the database migration to add the new fields:

```sql
-- This is already in supabase/migrations/002_add_document_type.sql
-- Add document_type column to conversions table
ALTER TABLE conversions 
ADD COLUMN document_type TEXT DEFAULT 'spt' CHECK (document_type IN ('spt', 'indomaret'));

-- Add started_at column for tracking processing start time
ALTER TABLE conversions 
ADD COLUMN started_at TIMESTAMPTZ;

-- Create index for better performance on document_type queries
CREATE INDEX idx_conversions_document_type ON conversions(document_type);

-- Update existing conversions to have default document type
UPDATE conversions SET document_type = 'spt' WHERE document_type IS NULL;
```

## Supabase Storage Setup

Create a storage bucket called `converted-files` in your Supabase project:

1. Go to Storage in your Supabase dashboard
2. Create a new bucket named `converted-files`
3. Set it to private (not public)
4. The application will automatically configure the bucket policies

## Testing the Implementation

1. Start the development server: `npm run dev`
2. Navigate to `/convert`
3. Select a document type (SPT Format or Indomaret Format)
4. Upload a PDF file
5. The system should:
   - Convert PDF to images
   - Process with OpenAI Vision API
   - Generate Excel file
   - Store in Supabase Storage
   - Return download link

## Troubleshooting

### Canvas/PDF rendering errors:
- Install system dependencies as described above (cairo, pango, etc.)
- Make sure build tools are installed (build-essential on Ubuntu)
- Restart the application after installing system dependencies

### OpenAI API errors:
- Verify OPENAI_API_KEY is set correctly
- Check API key has sufficient credits
- Ensure the key has access to GPT-4o model

### Supabase errors:
- Verify all Supabase environment variables are correct
- Check that the storage bucket exists and has proper permissions
- Ensure database migrations have been applied

### Development vs Production:
- On macOS development: Make sure you have Xcode Command Line Tools installed
- In Docker/Linux production: Ensure all system dependencies are installed before npm install