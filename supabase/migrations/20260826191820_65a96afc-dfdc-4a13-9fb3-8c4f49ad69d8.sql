DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conrelid = 'public.season_player_enrollments'::regclass
      AND contype = 'u'
      AND conname = 'season_player_enrollments_season_id_player_id_key'
  ) THEN
    ALTER TABLE public.season_player_enrollments
      DROP CONSTRAINT season_player_enrollments_season_id_player_id_key;
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS spe_season_player_team_uniq
  ON public.season_player_enrollments (
    season_id,
    player_id,
    COALESCE(team_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );

CREATE INDEX IF NOT EXISTS spe_player_season_status
  ON public.season_player_enrollments (player_id, season_id, status);