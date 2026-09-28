-- Add active match tracking per user
ALTER TABLE public.profiles
ADD COLUMN IF NOT EXISTS active_match_id uuid;

-- Minimal required live match state persisted in DB
ALTER TABLE public.matches
ADD COLUMN IF NOT EXISTS part_started_at_ms bigint,
ADD COLUMN IF NOT EXISTS starter_ids uuid[],
ADD COLUMN IF NOT EXISTS bench_ids uuid[],
ADD COLUMN IF NOT EXISTS on_field_ids uuid[];
