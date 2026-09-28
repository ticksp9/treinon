
CREATE TABLE public.match_conflict_alerts (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  alert_type text NOT NULL,
  severity text NOT NULL DEFAULT 'warning',
  message text NOT NULL,
  metadata jsonb DEFAULT '{}'::jsonb,
  resolved boolean NOT NULL DEFAULT false,
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_conflict_alerts_match ON public.match_conflict_alerts (match_id, resolved);

ALTER TABLE public.match_conflict_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match owners and coaches can view alerts"
  ON public.match_conflict_alerts FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (
        m.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
        OR EXISTS (
          SELECT 1 FROM public.teams t
          WHERE t.id = m.team_id AND public.is_club_staff_member(t.club_id, auth.uid())
        )
      )
    )
  );

CREATE POLICY "Match owners and coaches can create alerts"
  ON public.match_conflict_alerts FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (
        m.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
      )
    )
  );

CREATE POLICY "Match owners can update alerts"
  ON public.match_conflict_alerts FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (
        m.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
      )
    )
  );
