-- =============================================================================
-- Migration: Create sakhi_clinic_staff table
-- Epic A: Doctor & Staff Management System
-- Run this in your Supabase SQL Editor
-- =============================================================================

-- 1. Create the staff table
CREATE TABLE IF NOT EXISTS sakhi_clinic_staff (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  role TEXT NOT NULL DEFAULT 'doctor'
    CHECK (role IN ('doctor', 'front_desk', 'cro', 'nurse', 'admin')),
  specialty TEXT,
  department TEXT,
  contact JSONB DEFAULT '{}'::jsonb,
  availability JSONB DEFAULT '{}'::jsonb,
  leave_overrides JSONB DEFAULT '[]'::jsonb,  -- [{ "date": "2026-03-25", "reason": "Annual Leave" }]
  shift TEXT CHECK (shift IS NULL OR shift IN ('morning', 'evening', 'full_day', 'rotational')),
  is_active BOOLEAN NOT NULL DEFAULT true,
  location TEXT,
  category TEXT,
  color TEXT,
  user_id UUID REFERENCES sakhi_clinic_users(id) ON DELETE SET NULL,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- 2. Indexes for fast lookups
CREATE INDEX IF NOT EXISTS idx_staff_active ON sakhi_clinic_staff(is_active);
CREATE INDEX IF NOT EXISTS idx_staff_role ON sakhi_clinic_staff(role);
CREATE INDEX IF NOT EXISTS idx_staff_specialty ON sakhi_clinic_staff(specialty);
CREATE INDEX IF NOT EXISTS idx_staff_user_id ON sakhi_clinic_staff(user_id);

-- 3. Auto-update updated_at timestamp
CREATE OR REPLACE FUNCTION update_staff_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_staff_updated_at ON sakhi_clinic_staff;
CREATE TRIGGER trg_staff_updated_at
  BEFORE UPDATE ON sakhi_clinic_staff
  FOR EACH ROW
  EXECUTE FUNCTION update_staff_updated_at();

-- 4. Seed existing doctors from hardcoded constants
INSERT INTO sakhi_clinic_staff (name, role, specialty, location, category, color, availability) VALUES
  (
    'Dr. B. Sireesha Rani',
    'doctor',
    'Gynaecologist and Infertility specialist',
    'Visakhapatnam',
    'IVF',
    'bg-brand-primary/20 text-brand-primary border-brand-primary/30',
    '{"monday":["09:00-13:00","16:00-20:00"],"tuesday":["09:00-13:00","16:00-20:00"],"wednesday":["09:00-13:00","16:00-20:00"],"thursday":["09:00-13:00","16:00-20:00"],"friday":["09:00-13:00","16:00-20:00"],"saturday":["09:00-13:00"]}'::jsonb
  ),
  (
    'Dr. Mrudula Karri',
    'doctor',
    'Consultant Gynaecologist',
    'Srikakulam',
    'IVF',
    'bg-purple-500/20 text-purple-300 border-purple-500/30',
    '{"monday":["09:00-13:00","16:00-20:00"],"tuesday":["09:00-13:00","16:00-20:00"],"wednesday":["09:00-13:00","16:00-20:00"],"thursday":["09:00-13:00","16:00-20:00"],"friday":["09:00-13:00","16:00-20:00"],"saturday":["09:00-13:00"]}'::jsonb
  ),
  (
    'Dr. T. Raga Samhita',
    'doctor',
    'Consultant Gynaecologist',
    'Vijayawada',
    'IVF',
    'bg-emerald-500/20 text-emerald-300 border-emerald-500/30',
    '{"monday":["09:00-13:00","16:00-20:00"],"tuesday":["09:00-13:00","16:00-20:00"],"wednesday":["09:00-13:00","16:00-20:00"],"thursday":["09:00-13:00","16:00-20:00"],"friday":["09:00-13:00","16:00-20:00"],"saturday":["09:00-13:00"]}'::jsonb
  ),
  (
    'Dr. Nikitha Gogineni',
    'doctor',
    'Consultant Gynaecologist',
    'Vijayawada',
    'IVF',
    'bg-blue-500/20 text-blue-300 border-blue-500/30',
    '{"monday":["09:00-13:00","16:00-20:00"],"tuesday":["09:00-13:00","16:00-20:00"],"wednesday":["09:00-13:00","16:00-20:00"],"thursday":["09:00-13:00","16:00-20:00"],"friday":["09:00-13:00","16:00-20:00"],"saturday":["09:00-13:00"]}'::jsonb
  ),
  (
    'Dr. Swarna Kumari Konchada',
    'doctor',
    'Consultant Gynaecologist',
    'Vizianagaram',
    'IVF',
    'bg-pink-500/20 text-pink-300 border-pink-500/30',
    '{"monday":["09:00-13:00","16:00-20:00"],"tuesday":["09:00-13:00","16:00-20:00"],"wednesday":["09:00-13:00","16:00-20:00"],"thursday":["09:00-13:00","16:00-20:00"],"friday":["09:00-13:00","16:00-20:00"],"saturday":["09:00-13:00"]}'::jsonb
  ),
  (
    'Dr. Satish Kalidindi',
    'doctor',
    'NEURO SURGERY',
    'Medcy Hospitals',
    'Hospital',
    'bg-orange-500/20 text-orange-300 border-orange-500/30',
    '{"monday":["09:00-14:00"],"tuesday":["09:00-14:00"],"wednesday":["09:00-14:00"],"thursday":["09:00-14:00"],"friday":["09:00-14:00"]}'::jsonb
  ),
  (
    'Dr. K. Ramesh Raju',
    'doctor',
    'UROLOGY',
    'Medcy Hospitals',
    'Hospital',
    'bg-cyan-500/20 text-cyan-300 border-cyan-500/30',
    '{"monday":["09:00-14:00"],"tuesday":["09:00-14:00"],"wednesday":["09:00-14:00"],"thursday":["09:00-14:00"],"friday":["09:00-14:00"]}'::jsonb
  ),
  (
    'Dr. Rohith Mudadla',
    'doctor',
    'GASTROENTEROLOGY',
    'Medcy Hospitals',
    'Hospital',
    'bg-teal-500/20 text-teal-300 border-teal-500/30',
    '{"monday":["09:00-14:00"],"tuesday":["09:00-14:00"],"wednesday":["09:00-14:00"],"thursday":["09:00-14:00"],"friday":["09:00-14:00"]}'::jsonb
  ),
  (
    'Dr. V. V Rajasekhar',
    'doctor',
    'ORTHOPEDICS',
    'Medcy Hospitals',
    'Hospital',
    'bg-indigo-500/20 text-indigo-300 border-indigo-500/30',
    '{"monday":["09:00-14:00"],"tuesday":["09:00-14:00"],"wednesday":["09:00-14:00"],"thursday":["09:00-14:00"],"friday":["09:00-14:00"]}'::jsonb
  ),
  (
    'Dr. Sai Dileep Viswanadha',
    'doctor',
    'SPINE CARE',
    'Medcy Hospitals',
    'Hospital',
    'bg-rose-500/20 text-rose-300 border-rose-500/30',
    '{"monday":["09:00-14:00"],"tuesday":["09:00-14:00"],"wednesday":["09:00-14:00"],"thursday":["09:00-14:00"],"friday":["09:00-14:00"]}'::jsonb
  );

-- 5. Enable Row Level Security (optional — matches Supabase patterns)
-- ALTER TABLE sakhi_clinic_staff ENABLE ROW LEVEL SECURITY;

-- Verify
SELECT id, name, role, specialty, location, is_active FROM sakhi_clinic_staff;
