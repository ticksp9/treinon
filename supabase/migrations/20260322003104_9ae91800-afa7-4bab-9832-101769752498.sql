
-- Phase 3: Guardian portal preferences, notification preferences, callup-communication links, engagement analytics

-- 1. Guardian notification preferences
CREATE TABLE IF NOT EXISTS public.guardian_notification_preferences (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  guardian_id UUID NOT NULL REFERENCES public.guardian_profiles(id) ON DELETE CASCADE,
  match_reminders BOOLEAN NOT NULL DEFAULT true,
  training_reminders BOOLEAN NOT NULL DEFAULT true,
  announcement_alerts BOOLEAN NOT NULL DEFAULT true,
  callup_alerts BOOLEAN NOT NULL DEFAULT true,
  unread_followup BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(guardian_id)
);
ALTER TABLE public.guardian_notification_preferences ENABLE ROW LEVEL SECURITY;

-- 2. Callup notifications - links match callups to communication
CREATE TABLE IF NOT EXISTS public.callup_notifications (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  created_by UUID NOT NULL,
  notification_type TEXT NOT NULL DEFAULT 'callup_published', -- callup_published, callup_updated, callup_reminder, confirmation_reminder
  target_audience TEXT NOT NULL DEFAULT 'convocados', -- convocados, pais_convocados, full_team, staff
  message TEXT,
  template_id UUID REFERENCES public.communication_templates(id),
  sent_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.callup_notifications ENABLE ROW LEVEL SECURITY;

-- 3. Callup confirmation status per player
CREATE TABLE IF NOT EXISTS public.callup_confirmations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  match_id UUID NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  confirmed_by UUID NOT NULL, -- guardian or athlete user_id
  status TEXT NOT NULL DEFAULT 'pending', -- pending, confirmed, declined
  comment TEXT,
  confirmation_deadline TIMESTAMPTZ,
  responded_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE(match_id, player_id)
);
ALTER TABLE public.callup_confirmations ENABLE ROW LEVEL SECURITY;

-- 4. Communication engagement snapshots (aggregated metrics for analytics)
CREATE TABLE IF NOT EXISTS public.communication_engagement_snapshots (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id UUID REFERENCES public.teams(id) ON DELETE SET NULL,
  period_start DATE NOT NULL,
  period_end DATE NOT NULL,
  metric_type TEXT NOT NULL, -- announcement_read_rate, attendance_response_rate, message_activity, guardian_engagement
  metric_value NUMERIC NOT NULL DEFAULT 0,
  details JSONB,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);
ALTER TABLE public.communication_engagement_snapshots ENABLE ROW LEVEL SECURITY;

-- RLS Policies

-- guardian_notification_preferences: guardian can manage own
CREATE POLICY "Guardians manage own prefs" ON public.guardian_notification_preferences
  FOR ALL TO authenticated
  USING (
    guardian_id IN (SELECT id FROM public.guardian_profiles WHERE user_id = auth.uid())
  )
  WITH CHECK (
    guardian_id IN (SELECT id FROM public.guardian_profiles WHERE user_id = auth.uid())
  );

-- callup_notifications: club staff and coaches can manage
CREATE POLICY "Staff manage callup notifications" ON public.callup_notifications
  FOR ALL TO authenticated
  USING (
    public.is_club_admin(auth.uid(), club_id)
    OR public.is_youth_coordinator(club_id, auth.uid())
    OR public.is_club_coach(auth.uid(), club_id)
  )
  WITH CHECK (
    public.is_club_admin(auth.uid(), club_id)
    OR public.is_youth_coordinator(club_id, auth.uid())
    OR public.is_club_coach(auth.uid(), club_id)
  );

-- callup_notifications: guardians can read notifications for their athletes' teams
CREATE POLICY "Guardians read callup notifications" ON public.callup_notifications
  FOR SELECT TO authenticated
  USING (
    team_id IN (
      SELECT p.team_id FROM public.players p
      JOIN public.player_guardians pg ON pg.player_id = p.id
      JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
      WHERE gp.user_id = auth.uid()
    )
  );

-- callup_confirmations: staff can read all for their teams
CREATE POLICY "Staff read callup confirmations" ON public.callup_confirmations
  FOR SELECT TO authenticated
  USING (
    match_id IN (
      SELECT m.id FROM public.matches m
      JOIN public.teams t ON t.id = m.team_id
      WHERE t.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
    )
  );

-- callup_confirmations: guardians can manage for their athletes
CREATE POLICY "Guardians manage callup confirmations" ON public.callup_confirmations
  FOR ALL TO authenticated
  USING (
    confirmed_by = auth.uid()
    OR player_id IN (
      SELECT pg.player_id FROM public.player_guardians pg
      JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
      WHERE gp.user_id = auth.uid()
    )
  )
  WITH CHECK (
    confirmed_by = auth.uid()
  );

-- callup_confirmations: team owners can insert/update
CREATE POLICY "Team owners manage callup confirmations" ON public.callup_confirmations
  FOR ALL TO authenticated
  USING (
    match_id IN (
      SELECT m.id FROM public.matches m
      JOIN public.teams t ON t.id = m.team_id
      WHERE t.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
    )
  )
  WITH CHECK (
    match_id IN (
      SELECT m.id FROM public.matches m
      JOIN public.teams t ON t.id = m.team_id
      WHERE t.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
    )
  );

-- engagement_snapshots: club staff can read
CREATE POLICY "Staff read engagement snapshots" ON public.communication_engagement_snapshots
  FOR SELECT TO authenticated
  USING (
    public.is_club_admin(auth.uid(), club_id)
    OR public.is_youth_coordinator(club_id, auth.uid())
    OR public.is_club_coach(auth.uid(), club_id)
  );

-- engagement_snapshots: system/staff can insert
CREATE POLICY "Staff insert engagement snapshots" ON public.communication_engagement_snapshots
  FOR INSERT TO authenticated
  WITH CHECK (
    public.is_club_admin(auth.uid(), club_id)
    OR public.is_youth_coordinator(club_id, auth.uid())
  );

-- Helper function: check if user is guardian of a player
CREATE OR REPLACE FUNCTION public.is_guardian_of_player(_user_id uuid, _player_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_guardians pg
    JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
    WHERE gp.user_id = _user_id AND pg.player_id = _player_id
  )
$$;

-- Helper function: get guardian's linked player team IDs
CREATE OR REPLACE FUNCTION public.get_guardian_team_ids(_user_id uuid)
RETURNS SETOF uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT DISTINCT p.team_id
  FROM public.players p
  JOIN public.player_guardians pg ON pg.player_id = p.id
  JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
  WHERE gp.user_id = _user_id AND p.is_active = true
$$;
