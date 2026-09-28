-- Extend player_evaluations
ALTER TABLE public.player_evaluations
  ADD COLUMN IF NOT EXISTS season_label text,
  ADD COLUMN IF NOT EXISTS strengths_text text,
  ADD COLUMN IF NOT EXISTS improvement_text text,
  ADD COLUMN IF NOT EXISTS recommendation text;

-- player_strengths_focus
CREATE TABLE IF NOT EXISTS public.player_strengths_focus (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  kind text NOT NULL CHECK (kind IN ('strength','improvement')),
  label text NOT NULL,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_strengths_focus_player ON public.player_strengths_focus(player_id, kind);

ALTER TABLE public.player_strengths_focus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view strengths focus"
  ON public.player_strengths_focus FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_strengths_focus.player_id
        AND (
          public.is_club_staff_member(t.club_id, auth.uid())
          OR public.is_team_coach(auth.uid(), p.team_id)
          OR public.is_guardian_of_player(auth.uid(), p.id)
          OR public.get_player_account_id(auth.uid()) = p.id
        )
    )
  );

CREATE POLICY "manage strengths focus"
  ON public.player_strengths_focus FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_strengths_focus.player_id
        AND (
          public.is_club_staff_member(t.club_id, auth.uid())
          OR public.is_team_coach(auth.uid(), p.team_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_strengths_focus.player_id
        AND (
          public.is_club_staff_member(t.club_id, auth.uid())
          OR public.is_team_coach(auth.uid(), p.team_id)
        )
    )
  );

CREATE TRIGGER touch_player_strengths_focus
  BEFORE UPDATE ON public.player_strengths_focus
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- player_season_snapshots
CREATE TABLE IF NOT EXISTS public.player_season_snapshots (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  season_label text NOT NULL,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  age_group text,
  games_count integer DEFAULT 0,
  minutes_total integer DEFAULT 0,
  trainings_count integer DEFAULT 0,
  attendance_rate numeric,
  avg_overall numeric,
  strengths_summary text,
  improvements_summary text,
  summary_notes text,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id, season_label)
);

CREATE INDEX IF NOT EXISTS idx_season_snapshots_player ON public.player_season_snapshots(player_id, season_label);

ALTER TABLE public.player_season_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "view season snapshots"
  ON public.player_season_snapshots FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_season_snapshots.player_id
        AND (
          public.is_club_staff_member(t.club_id, auth.uid())
          OR public.is_team_coach(auth.uid(), p.team_id)
          OR public.is_guardian_of_player(auth.uid(), p.id)
          OR public.get_player_account_id(auth.uid()) = p.id
        )
    )
  );

CREATE POLICY "manage season snapshots"
  ON public.player_season_snapshots FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_season_snapshots.player_id
        AND (
          public.is_club_staff_member(t.club_id, auth.uid())
          OR public.is_team_coach(auth.uid(), p.team_id)
        )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.players p
      LEFT JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_season_snapshots.player_id
        AND (
          public.is_club_staff_member(t.club_id, auth.uid())
          OR public.is_team_coach(auth.uid(), p.team_id)
        )
    )
  );

CREATE TRIGGER touch_player_season_snapshots
  BEFORE UPDATE ON public.player_season_snapshots
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();