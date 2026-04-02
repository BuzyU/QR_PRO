-- ============================================
-- QR PRO: Database Setup Script
-- Run this in Supabase SQL Editor
-- Dashboard → SQL Editor → New Query → Paste → Run
-- ============================================

-- Create the students table
CREATE TABLE IF NOT EXISTS students (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  student_name TEXT NOT NULL,
  urn TEXT,
  institution_name TEXT NOT NULL,
  event_name TEXT NOT NULL,
  year TEXT,
  batch_number INTEGER NOT NULL,
  time_slot TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Enable Row Level Security
ALTER TABLE students ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read (needed for QR verification)
CREATE POLICY "Allow public read" ON students
  FOR SELECT USING (true);

-- Allow anyone to insert (needed for ticket generation)
CREATE POLICY "Allow public insert" ON students
  FOR INSERT WITH CHECK (true);
