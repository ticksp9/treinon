-- Add sport_type column to teams table
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS sport_type TEXT NOT NULL DEFAULT 'football_11';

-- Add check constraint for valid sport types
ALTER TABLE public.teams ADD CONSTRAINT valid_sport_type CHECK (
  sport_type IN ('football_5', 'football_7', 'football_9', 'football_11', 'futsal')
);

-- Update formation defaults based on sport type
COMMENT ON COLUMN public.teams.sport_type IS 'Type of football: football_5, football_7, football_9, football_11, futsal';