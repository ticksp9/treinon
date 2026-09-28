ALTER TABLE public.matches
  ALTER COLUMN part_starter_ids SET DEFAULT '{}'::jsonb,
  ALTER COLUMN part_real_seconds SET DEFAULT '{}'::integer[],
  ALTER COLUMN part_regulation_minutes SET DEFAULT '{}'::integer[],
  ALTER COLUMN parts_count SET DEFAULT 2;

UPDATE public.matches
SET
  part_starter_ids = COALESCE(part_starter_ids, '{}'::jsonb),
  part_real_seconds = COALESCE(part_real_seconds, '{}'::integer[]),
  part_regulation_minutes = COALESCE(part_regulation_minutes, '{}'::integer[]),
  parts_count = COALESCE(parts_count, 2)
WHERE part_starter_ids IS NULL
   OR part_real_seconds IS NULL
   OR part_regulation_minutes IS NULL
   OR parts_count IS NULL;