-- The tactics of a team: the formations the coach plays with (named), per sport, and the
-- one a match starts with. { "<sport>": { "list": [{ "code": "4-1-2-1", "name": "Principal" }], "default": "4-1-2-1" } }
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS tactics jsonb NOT NULL DEFAULT '{}'::jsonb
  CHECK (jsonb_typeof(tactics) = 'object');
