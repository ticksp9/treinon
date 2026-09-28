
-- ============================================================
-- Match Rule Profiles: central source of truth for sport rules
-- ============================================================
CREATE TABLE public.match_rule_profiles (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  modality_code text NOT NULL,
  age_group_code text,
  competition_name text,
  name text NOT NULL,
  period_count integer NOT NULL DEFAULT 2,
  period_1_minutes integer NOT NULL DEFAULT 45,
  period_2_minutes integer NOT NULL DEFAULT 45,
  period_3_minutes integer,
  period_4_minutes integer,
  halftime_minutes integer NOT NULL DEFAULT 10,
  max_players_on_field integer NOT NULL,
  reentry_allowed boolean NOT NULL DEFAULT false,
  rolling_substitutions boolean NOT NULL DEFAULT false,
  is_system_default boolean NOT NULL DEFAULT false,
  is_active boolean NOT NULL DEFAULT true,
  effective_from date,
  effective_to date,
  notes text,
  created_by uuid,
  updated_by uuid,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

-- Index for fast lookups
CREATE INDEX idx_match_rule_profiles_lookup 
  ON public.match_rule_profiles (club_id, modality_code, age_group_code, is_active);

-- Updated_at trigger
CREATE TRIGGER update_match_rule_profiles_updated_at
  BEFORE UPDATE ON public.match_rule_profiles
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- RLS
ALTER TABLE public.match_rule_profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view system defaults and own club profiles"
  ON public.match_rule_profiles FOR SELECT
  TO authenticated
  USING (
    is_system_default = true
    OR club_id IS NULL
    OR public.is_club_staff_member(club_id, auth.uid())
    OR public.is_club_coach(auth.uid(), club_id)
  );

CREATE POLICY "Club admins can manage custom profiles"
  ON public.match_rule_profiles FOR INSERT
  TO authenticated
  WITH CHECK (
    club_id IS NOT NULL
    AND is_system_default = false
    AND public.is_club_staff_admin(club_id, auth.uid())
  );

CREATE POLICY "Club admins can update custom profiles"
  ON public.match_rule_profiles FOR UPDATE
  TO authenticated
  USING (
    club_id IS NOT NULL
    AND is_system_default = false
    AND public.is_club_staff_admin(club_id, auth.uid())
  );

CREATE POLICY "Club admins can delete custom profiles"
  ON public.match_rule_profiles FOR DELETE
  TO authenticated
  USING (
    club_id IS NOT NULL
    AND is_system_default = false
    AND public.is_club_staff_admin(club_id, auth.uid())
  );

-- ============================================================
-- Match Rule Snapshots: frozen rules for a specific match
-- ============================================================
CREATE TABLE public.match_rule_snapshots (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  match_id uuid NOT NULL REFERENCES public.matches(id) ON DELETE CASCADE,
  rule_profile_id uuid REFERENCES public.match_rule_profiles(id) ON DELETE SET NULL,
  modality_code text NOT NULL,
  age_group_code text,
  snapshot_data jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(match_id)
);

ALTER TABLE public.match_rule_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Match owners and club staff can view snapshots"
  ON public.match_rule_snapshots FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.matches m
      WHERE m.id = match_id AND (
        m.owner_id = auth.uid()
        OR public.is_team_coach(auth.uid(), m.team_id)
        OR EXISTS (
          SELECT 1 FROM public.teams t
          WHERE t.id = m.team_id AND (
            public.is_club_staff_member(t.club_id, auth.uid())
            OR public.is_club_coach(auth.uid(), t.club_id)
          )
        )
      )
    )
  );

CREATE POLICY "Match owners can create snapshots"
  ON public.match_rule_snapshots FOR INSERT
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

CREATE POLICY "Match owners can update snapshots"
  ON public.match_rule_snapshots FOR UPDATE
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

-- ============================================================
-- Match Rule Audit Logs
-- ============================================================
CREATE TABLE public.match_rule_audit_logs (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id uuid NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  entity_type text NOT NULL,
  entity_id uuid NOT NULL,
  action text NOT NULL,
  actor_id uuid,
  actor_role text,
  old_values jsonb,
  new_values jsonb,
  reason text,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX idx_match_rule_audit_logs_entity 
  ON public.match_rule_audit_logs (club_id, entity_type, entity_id);

ALTER TABLE public.match_rule_audit_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Club admins can view audit logs"
  ON public.match_rule_audit_logs FOR SELECT
  TO authenticated
  USING (public.is_club_staff_admin(club_id, auth.uid()));

CREATE POLICY "System can insert audit logs"
  ON public.match_rule_audit_logs FOR INSERT
  TO authenticated
  WITH CHECK (
    public.is_club_staff_member(club_id, auth.uid())
    OR public.is_club_coach(auth.uid(), club_id)
  );

-- ============================================================
-- Seed system default profiles
-- ============================================================

-- Football 11
INSERT INTO public.match_rule_profiles (club_id, modality_code, age_group_code, name, period_count, period_1_minutes, period_2_minutes, max_players_on_field, reentry_allowed, rolling_substitutions, is_system_default) VALUES
  (NULL, 'football_11', 'juniores',  'Futebol 11 - Juniores',  2, 45, 45, 11, false, false, true),
  (NULL, 'football_11', 'juvenis',   'Futebol 11 - Juvenis',   2, 40, 40, 11, false, false, true),
  (NULL, 'football_11', 'iniciados', 'Futebol 11 - Iniciados', 2, 35, 35, 11, false, false, true),
  (NULL, 'football_11', 'infantis',  'Futebol 11 - Infantis',  2, 30, 30, 11, false, false, true);

-- Football 9
INSERT INTO public.match_rule_profiles (club_id, modality_code, age_group_code, name, period_count, period_1_minutes, period_2_minutes, max_players_on_field, reentry_allowed, rolling_substitutions, is_system_default) VALUES
  (NULL, 'football_9', 'juniores',  'Futebol 9 - Juniores',  2, 45, 45, 9, true, true, true),
  (NULL, 'football_9', 'juvenis',   'Futebol 9 - Juvenis',   2, 40, 40, 9, true, true, true),
  (NULL, 'football_9', 'iniciados', 'Futebol 9 - Iniciados', 2, 35, 35, 9, true, true, true),
  (NULL, 'football_9', 'infantis',  'Futebol 9 - Infantis',  2, 30, 30, 9, true, true, true),
  (NULL, 'football_9', 'benjamins', 'Futebol 9 - Benjamins', 2, 25, 25, 9, true, true, true);

-- Football 7
INSERT INTO public.match_rule_profiles (club_id, modality_code, age_group_code, name, period_count, period_1_minutes, period_2_minutes, max_players_on_field, reentry_allowed, rolling_substitutions, is_system_default) VALUES
  (NULL, 'football_7', 'juniores',  'Futebol 7 - Juniores',  2, 45, 45, 7, true, true, true),
  (NULL, 'football_7', 'juvenis',   'Futebol 7 - Juvenis',   2, 40, 40, 7, true, true, true),
  (NULL, 'football_7', 'iniciados', 'Futebol 7 - Iniciados', 2, 35, 35, 7, true, true, true),
  (NULL, 'football_7', 'infantis',  'Futebol 7 - Infantis',  2, 30, 30, 7, true, true, true),
  (NULL, 'football_7', 'benjamins', 'Futebol 7 - Benjamins', 2, 25, 25, 7, true, true, true);

-- Football 5
INSERT INTO public.match_rule_profiles (club_id, modality_code, age_group_code, name, period_count, period_1_minutes, period_2_minutes, max_players_on_field, reentry_allowed, rolling_substitutions, is_system_default) VALUES
  (NULL, 'football_5', 'petizes',   'Futebol 5 - Petizes',   2, 15, 15, 5, true, true, true),
  (NULL, 'football_5', 'traquinas', 'Futebol 5 - Traquinas', 2, 20, 20, 5, true, true, true),
  (NULL, 'football_5', 'benjamins', 'Futebol 5 - Benjamins', 2, 20, 20, 5, true, true, true),
  (NULL, 'football_5', 'infantis',  'Futebol 5 - Infantis',  2, 25, 25, 5, true, true, true),
  (NULL, 'football_5', 'iniciados', 'Futebol 5 - Iniciados', 2, 25, 25, 5, true, true, true),
  (NULL, 'football_5', 'juvenis',   'Futebol 5 - Juvenis',   2, 25, 25, 5, true, true, true),
  (NULL, 'football_5', 'juniores',  'Futebol 5 - Juniores',  2, 25, 25, 5, true, true, true);

-- Futsal
INSERT INTO public.match_rule_profiles (club_id, modality_code, age_group_code, name, period_count, period_1_minutes, period_2_minutes, max_players_on_field, reentry_allowed, rolling_substitutions, is_system_default) VALUES
  (NULL, 'futsal', 'petizes',   'Futsal - Petizes',   2, 15, 15, 5, true, true, true),
  (NULL, 'futsal', 'traquinas', 'Futsal - Traquinas', 2, 15, 15, 5, true, true, true),
  (NULL, 'futsal', 'benjamins', 'Futsal - Benjamins', 2, 25, 25, 5, true, true, true),
  (NULL, 'futsal', 'infantis',  'Futsal - Infantis',  2, 25, 25, 5, true, true, true),
  (NULL, 'futsal', 'iniciados', 'Futsal - Iniciados', 2, 20, 20, 5, true, true, true),
  (NULL, 'futsal', 'juvenis',   'Futsal - Juvenis',   2, 20, 20, 5, true, true, true),
  (NULL, 'futsal', 'juniores',  'Futsal - Juniores',  2, 20, 20, 5, true, true, true);
