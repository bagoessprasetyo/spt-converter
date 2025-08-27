-- PDF to Excel Converter Database Setup
-- Run these commands in your Supabase SQL Editor

-- Enable Row Level Security
ALTER DATABASE postgres SET "auth.local_dev_cookie" = 'true';

-- User Profiles Table (extends auth.users)
CREATE TABLE IF NOT EXISTS public.user_profiles (
  id UUID REFERENCES auth.users PRIMARY KEY,
  email TEXT,
  full_name TEXT,
  avatar_url TEXT,
  subscription_tier TEXT DEFAULT 'free',
  credits_remaining INTEGER DEFAULT 5,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Conversions Table
CREATE TABLE IF NOT EXISTS public.conversions (
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
  started_at TIMESTAMP WITH TIME ZONE,
  completed_at TIMESTAMP WITH TIME ZONE,
  options JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Usage Analytics Table
CREATE TABLE IF NOT EXISTS public.usage_analytics (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users,
  conversion_id UUID REFERENCES conversions,
  event_type TEXT, -- upload, conversion_start, conversion_success, conversion_failed, download
  metadata JSONB,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Subscription Plans Table
CREATE TABLE IF NOT EXISTS public.subscription_plans (
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

-- Enable Row Level Security
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE conversions ENABLE ROW LEVEL SECURITY;
ALTER TABLE usage_analytics ENABLE ROW LEVEL SECURITY;

-- Policies for user_profiles
CREATE POLICY IF NOT EXISTS "Users can view own profile" ON user_profiles
  FOR SELECT USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can update own profile" ON user_profiles
  FOR UPDATE USING (auth.uid() = id);

CREATE POLICY IF NOT EXISTS "Users can insert own profile" ON user_profiles
  FOR INSERT WITH CHECK (auth.uid() = id);

-- Policies for conversions
CREATE POLICY IF NOT EXISTS "Users can view own conversions" ON conversions
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own conversions" ON conversions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can update own conversions" ON conversions
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for usage_analytics
CREATE POLICY IF NOT EXISTS "Users can view own analytics" ON usage_analytics
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY IF NOT EXISTS "Users can insert own analytics" ON usage_analytics
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Policies for subscription_plans (public read)
CREATE POLICY IF NOT EXISTS "Anyone can view active subscription plans" ON subscription_plans
  FOR SELECT USING (is_active = true);

-- Insert default subscription plans
INSERT INTO subscription_plans (name, description, price_monthly, price_yearly, credits_per_month, max_file_size_mb, features) VALUES
('Free', 'Perfect for trying out the service', 0, 0, 5, 10, '{"batchProcessing": false, "priorityProcessing": false, "apiAccess": false, "customRetention": 1}'),
('Pro', 'For regular users and small businesses', 9.99, 99.99, 100, 50, '{"batchProcessing": true, "priorityProcessing": true, "apiAccess": false, "customRetention": 7}'),
('Business', 'For teams and high-volume users', 29.99, 299.99, 1000, 100, '{"batchProcessing": true, "priorityProcessing": true, "apiAccess": true, "customRetention": 30}')
ON CONFLICT (name) DO NOTHING;

-- Function to automatically create user profile on signup
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.user_profiles (id, email, full_name)
  VALUES (NEW.id, NEW.email, NEW.raw_user_meta_data->>'full_name');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Trigger to create user profile on signup
CREATE OR REPLACE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION public.update_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers for updated_at
CREATE OR REPLACE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

CREATE OR REPLACE TRIGGER update_conversions_updated_at
  BEFORE UPDATE ON conversions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();