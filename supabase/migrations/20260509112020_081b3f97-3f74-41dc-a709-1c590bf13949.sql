ALTER TABLE public.matches
  ADD COLUMN IF NOT EXISTS substitution_mode TEXT
  CHECK (substitution_mode IN ('NO_REENTRY', 'FREE_REENTRY'));

ALTER TABLE public.match_rule_snapshots
  ADD COLUMN IF NOT EXISTS substitution_mode TEXT
  CHECK (substitution_mode IN ('NO_REENTRY', 'FREE_REENTRY'));

COMMENT ON COLUMN public.matches.substitution_mode IS
  'Per-match override of substitution rules. NULL = resolve from sport format / snapshot.';
COMMENT ON COLUMN public.match_rule_snapshots.substitution_mode IS
  'Substitution mode locked into the rules snapshot for this match.';