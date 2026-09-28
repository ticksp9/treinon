-- =============================================
-- YOUTH COORDINATION MODULE - PHASE 1 (Part 1)
-- Add 'coordenador' role to enum
-- =============================================
ALTER TYPE public.club_staff_role ADD VALUE IF NOT EXISTS 'coordenador';