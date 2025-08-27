-- Migration to fix delete cascade issues
-- Run this in your Supabase SQL Editor

-- First, drop the existing foreign key constraint
ALTER TABLE public.usage_analytics 
DROP CONSTRAINT IF EXISTS usage_analytics_conversion_id_fkey;

-- Recreate the foreign key constraint with CASCADE delete
ALTER TABLE public.usage_analytics 
ADD CONSTRAINT usage_analytics_conversion_id_fkey 
FOREIGN KEY (conversion_id) 
REFERENCES public.conversions(id) 
ON DELETE CASCADE;

-- Add an index for better performance on conversion_id lookups
CREATE INDEX IF NOT EXISTS idx_usage_analytics_conversion_id 
ON public.usage_analytics(conversion_id);

-- Add an index for better performance on user_id + event_type lookups
CREATE INDEX IF NOT EXISTS idx_usage_analytics_user_event 
ON public.usage_analytics(user_id, event_type);

-- Add an index for better performance on created_at for time-based queries
CREATE INDEX IF NOT EXISTS idx_usage_analytics_created_at 
ON public.usage_analytics(created_at);

-- Verify the constraint was created correctly
SELECT 
  tc.table_name, 
  tc.constraint_name, 
  tc.constraint_type,
  rc.delete_rule
FROM information_schema.table_constraints tc
LEFT JOIN information_schema.referential_constraints rc 
  ON tc.constraint_name = rc.constraint_name
WHERE tc.table_name = 'usage_analytics' 
  AND tc.constraint_type = 'FOREIGN KEY'
  AND tc.constraint_name LIKE '%conversion_id%';