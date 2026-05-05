-- ============================================
-- QR PRO v2: Database Migration Script
-- Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================

-- 1. User Profiles table (multi-tenant)
CREATE TABLE IF NOT EXISTS user_profiles (
  id TEXT PRIMARY KEY,                    -- Firebase UID
  display_name TEXT,
  institution_name TEXT,
  api_key TEXT UNIQUE NOT NULL,
  smtp_config TEXT,                       -- AES-256 encrypted JSON
  column_mapping JSONB DEFAULT '{}',      -- { name_field, email_field, fields[] }
  form_field_mapping JSONB DEFAULT '{}',  -- Google Forms field mapping
  ticket_template JSONB DEFAULT '{"type":"default","html":"","css":""}',
  default_event TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Extend existing students table with new columns
ALTER TABLE students ADD COLUMN IF NOT EXISTS token VARCHAR(64) UNIQUE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS signature VARCHAR(128);
ALTER TABLE students ADD COLUMN IF NOT EXISTS email VARCHAR(255);
ALTER TABLE students ADD COLUMN IF NOT EXISTS metadata JSONB DEFAULT '{}';
ALTER TABLE students ADD COLUMN IF NOT EXISTS source VARCHAR(20) DEFAULT 'client';
ALTER TABLE students ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email_sent BOOLEAN DEFAULT FALSE;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email_sent_at TIMESTAMPTZ;
ALTER TABLE students ADD COLUMN IF NOT EXISTS email_retries INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS scan_count INTEGER DEFAULT 0;
ALTER TABLE students ADD COLUMN IF NOT EXISTS last_scanned_at TIMESTAMPTZ;

-- 3. Upload batches table
CREATE TABLE IF NOT EXISTS upload_batches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  filename TEXT NOT NULL,
  total_records INTEGER NOT NULL,
  processed INTEGER DEFAULT 0,
  failed INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_by TEXT REFERENCES user_profiles(id),
  created_at TIMESTAMPTZ DEFAULT NOW(),
  completed_at TIMESTAMPTZ
);

-- 4. Scan logs table
CREATE TABLE IF NOT EXISTS scan_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  ticket_id UUID REFERENCES students(id),
  scanned_at TIMESTAMPTZ DEFAULT NOW(),
  ip_address TEXT,
  user_agent TEXT
);

-- 5. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_token ON students(token);
CREATE INDEX IF NOT EXISTS idx_students_user_id ON students(user_id);
CREATE INDEX IF NOT EXISTS idx_students_email_event ON students(email, event_name, user_id);
CREATE INDEX IF NOT EXISTS idx_user_profiles_api_key ON user_profiles(api_key);
CREATE INDEX IF NOT EXISTS idx_scan_logs_ticket ON scan_logs(ticket_id);

-- 6. RLS Policies

-- User profiles: service role only (backend manages this)
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON user_profiles FOR ALL USING (true);

-- Upload batches: service role only
ALTER TABLE upload_batches ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow all for service role" ON upload_batches FOR ALL USING (true);

-- Scan logs: public insert + read (for verification page)
ALTER TABLE scan_logs ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Allow public insert on scan_logs" ON scan_logs
  FOR INSERT WITH CHECK (true);
CREATE POLICY "Allow public read on scan_logs" ON scan_logs
  FOR SELECT USING (true);

-- NOTE: The existing students table already has RLS policies from setup.sql.
-- The server uses the service role key which bypasses RLS entirely.
