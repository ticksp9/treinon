-- Add match type and configuration fields for flexible match types
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS match_type text DEFAULT 'championship' CHECK (match_type IN ('championship', 'friendly', 'tournament')),
ADD COLUMN IF NOT EXISTS parts_count integer DEFAULT 2,
ADD COLUMN IF NOT EXISTS part_duration_minutes integer,
ADD COLUMN IF NOT EXISTS tournament_locked boolean DEFAULT false;

-- Add match state persistence fields for offline-first functionality
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS current_part integer DEFAULT 0,
ADD COLUMN IF NOT EXISTS match_phase text DEFAULT 'setup' CHECK (match_phase IN ('setup', 'playing', 'interval', 'finished')),
ADD COLUMN IF NOT EXISTS part_elapsed_seconds jsonb DEFAULT '[]'::jsonb,
ADD COLUMN IF NOT EXISTS last_timer_start timestamp with time zone,
ADD COLUMN IF NOT EXISTS last_paused_seconds integer DEFAULT 0;

COMMENT ON COLUMN public.matches.match_type IS 'Type of match: championship, friendly, or tournament';
COMMENT ON COLUMN public.matches.parts_count IS 'Number of parts/halves in the match';
COMMENT ON COLUMN public.matches.part_duration_minutes IS 'Duration of each part in minutes (null = use category default)';
COMMENT ON COLUMN public.matches.tournament_locked IS 'Whether time/parts are locked (for tournament matches)';
COMMENT ON COLUMN public.matches.current_part IS 'Current part being played (0 = not started, 1-N = playing that part)';
COMMENT ON COLUMN public.matches.match_phase IS 'Current phase: setup, playing, interval, finished';
COMMENT ON COLUMN public.matches.part_elapsed_seconds IS 'JSON array of elapsed seconds for each part';
COMMENT ON COLUMN public.matches.last_timer_start IS 'When the timer was last started (for recovery)';
COMMENT ON COLUMN public.matches.last_paused_seconds IS 'Elapsed seconds when last paused';