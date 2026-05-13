  -- ============================================
  -- QR PRO v3: Database Migration Script
  -- Run this in Supabase SQL Editor
  -- Dashboard → SQL Editor → New Query → Paste → Run
  -- ============================================

  -- 1. Events table (multi-event support)
  CREATE TABLE IF NOT EXISTS events (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id TEXT NOT NULL REFERENCES user_profiles(id),
    name TEXT NOT NULL,
    description TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'draft'
      CHECK (status IN ('draft', 'active', 'completed')),

    -- Dynamic fields config (host defines per event, zero defaults)
    -- Example: [{"key":"roll_no","label":"Roll Number","type":"text","required":true,"on_ticket":true,"in_email":true}]
    custom_fields JSONB DEFAULT '[]',

    -- Column mapping for CSV / Google Forms
    -- { "name_field": "Student Name", "email_field": "Email ID",
    --   "field_map": {"roll_no": "Roll No", "department": "Dept"} }
    column_mapping JSONB DEFAULT '{}',

    -- Templates (host customises per event)
    email_template JSONB DEFAULT '{}',
    ticket_template JSONB DEFAULT '{}',
    pdf_template JSONB DEFAULT '{}',

    -- Per-event email delivery config (encrypted credentials)
    -- { "provider": "gmail"|"resend",
    --   "from_name": "TechFest 2026",
    --   "resend_key": "re_...", "from_email": "tickets@yourdomain.com",
    --   "gmail_client_id": "...", "gmail_client_secret": "...",
    --   "gmail_refresh_token": "...", "gmail_email": "host@gmail.com" }
    email_config TEXT,  -- AES-256-GCM encrypted JSON

    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
  );

  -- 2. Add event_id + attendance columns to students
  ALTER TABLE students ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);
  ALTER TABLE students ADD COLUMN IF NOT EXISTS attendance_status TEXT DEFAULT 'absent'
    CHECK (attendance_status IS NULL OR attendance_status IN ('absent', 'present'));
  ALTER TABLE students ADD COLUMN IF NOT EXISTS attended_at TIMESTAMPTZ;

  -- 3. Add gmail tokens column to user_profiles (legacy — now superseded by per-event config)
  ALTER TABLE user_profiles ADD COLUMN IF NOT EXISTS gmail_tokens TEXT;

  -- 4. Per-event email delivery config (Phase 4)
  -- For existing installations, add email_config column to events
  ALTER TABLE events ADD COLUMN IF NOT EXISTS email_config TEXT;

  -- 5. Add event_id to upload_batches
  ALTER TABLE upload_batches ADD COLUMN IF NOT EXISTS event_id UUID REFERENCES events(id);

  -- 5. Indexes
  CREATE INDEX IF NOT EXISTS idx_events_user_id ON events(user_id);
  CREATE INDEX IF NOT EXISTS idx_events_status ON events(user_id, status);
  CREATE INDEX IF NOT EXISTS idx_students_event_id ON students(event_id);
  CREATE INDEX IF NOT EXISTS idx_students_attendance ON students(event_id, attendance_status);

  -- 6. RLS for events (idempotent — drop first if exists)
  ALTER TABLE events ENABLE ROW LEVEL SECURITY;
  DROP POLICY IF EXISTS "Allow all for service role" ON events;
  CREATE POLICY "Allow all for service role" ON events FOR ALL USING (true);

  -- 7. Migrate existing tickets to a "Legacy" event per user
  -- This creates one Legacy event for each user who has orphaned tickets
  DO $$
  DECLARE
    _user_id TEXT;
    _event_id UUID;
  BEGIN
    FOR _user_id IN
      SELECT DISTINCT user_id FROM students
      WHERE user_id IS NOT NULL AND event_id IS NULL
    LOOP
      INSERT INTO events (user_id, name, description, status)
      VALUES (_user_id, 'Legacy Tickets', 'Auto-migrated tickets from before the events system.', 'completed')
      RETURNING id INTO _event_id;

      UPDATE students
      SET event_id = _event_id
      WHERE user_id = _user_id AND event_id IS NULL;
    END LOOP;
  END $$;
