-- Add gender field to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS gender text NOT NULL DEFAULT 'male' CHECK (gender IN ('male', 'female'));