DO $$
DECLARE
  v_teams_updated integer := 0;
  v_memberships_created integer := 0;
BEGIN
  -- 1) Column + index (idempotent)
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'teams' AND column_name = 'season_id'
  ) THEN
    ALTER TABLE public.teams ADD COLUMN season_id uuid REFERENCES public.seasons(id);
  END IF;

  CREATE INDEX IF NOT EXISTS teams_season_id_idx ON public.teams(season_id);

  -- 2) Back-fill teams.season_id from legacy teams.season string (same owner/club)
  WITH updated AS (
    UPDATE public.teams t
    SET season_id = s.id
    FROM public.seasons s
    WHERE t.season_id IS NULL
      AND s.name = t.season
      AND (
        s.owner_id = t.owner_id
        OR (t.club_id IS NOT NULL AND s.club_id = t.club_id)
      )
    RETURNING t.id
  )
  SELECT count(*) INTO v_teams_updated FROM updated;

  -- 3) Back-fill memberships (unique on season_id + team_id)
  WITH inserted AS (
    INSERT INTO public.season_team_memberships (season_id, team_id)
    SELECT t.season_id, t.id
    FROM public.teams t
    WHERE t.season_id IS NOT NULL
    ON CONFLICT (season_id, team_id) DO NOTHING
    RETURNING team_id
  )
  SELECT count(*) INTO v_memberships_created FROM inserted;

  RAISE NOTICE 'teams_season_id_backfilled: %', v_teams_updated;
  RAISE NOTICE 'season_team_memberships_created: %', v_memberships_created;
END $$;