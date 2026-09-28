-- Add 'physio' role to club_staff_role enum
ALTER TYPE public.club_staff_role ADD VALUE IF NOT EXISTS 'physio';