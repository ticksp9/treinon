-- Add gender column to teams
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female'));