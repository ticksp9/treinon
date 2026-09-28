ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS second_half_starter_ids uuid[] DEFAULT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS second_half_starter_set_at timestamptz DEFAULT NULL;
ALTER TABLE public.matches ADD COLUMN IF NOT EXISTS second_half_starter_set_by uuid DEFAULT NULL;
COMMENT ON COLUMN public.matches.second_half_starter_ids IS 'Authoritative snapshot of who starts the 2nd half. NULL means continuity from 1H end-of-state.';