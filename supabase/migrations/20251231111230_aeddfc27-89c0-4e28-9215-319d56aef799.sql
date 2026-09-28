-- =============================================
-- YOUTH COORDINATION MODULE - PHASE 1 (Part 2)
-- Tables and Policies
-- =============================================

-- YOUTH AGE GROUPS (Escalões)
CREATE TABLE public.youth_age_groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  min_birth_year INTEGER NOT NULL,
  max_birth_year INTEGER NOT NULL,
  display_order INTEGER DEFAULT 0,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(club_id, name)
);

ALTER TABLE public.youth_age_groups ENABLE ROW LEVEL SECURITY;

-- YOUTH TEAMS (Equipas por escalão)
CREATE TABLE public.youth_teams (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  age_group_id UUID NOT NULL REFERENCES public.youth_age_groups(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  sport_variant TEXT NOT NULL DEFAULT 'football_11',
  season TEXT NOT NULL DEFAULT '2024/2025',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.youth_teams ENABLE ROW LEVEL SECURITY;

-- YOUTH TEAM COACHES
CREATE TABLE public.youth_team_coaches (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_team_id UUID NOT NULL REFERENCES public.youth_teams(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  role TEXT DEFAULT 'main',
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(youth_team_id, coach_id)
);

ALTER TABLE public.youth_team_coaches ENABLE ROW LEVEL SECURITY;

-- YOUTH TEAM PLAYERS
CREATE TABLE public.youth_team_players (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  youth_team_id UUID NOT NULL REFERENCES public.youth_teams(id) ON DELETE CASCADE,
  player_id UUID NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  is_from_lower_age_group BOOLEAN DEFAULT false,
  status TEXT DEFAULT 'active',
  blocked_reason TEXT,
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(youth_team_id, player_id)
);

ALTER TABLE public.youth_team_players ENABLE ROW LEVEL SECURITY;

-- YOUTH TRAINING SCHEDULES
CREATE TABLE public.youth_training_schedules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  youth_team_id UUID NOT NULL REFERENCES public.youth_teams(id) ON DELETE CASCADE,
  day_of_week INTEGER NOT NULL CHECK (day_of_week >= 1 AND day_of_week <= 7),
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  location TEXT,
  notes TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.youth_training_schedules ENABLE ROW LEVEL SECURITY;

-- YOUTH COORDINATION DOCUMENTS
CREATE TABLE public.youth_coordination_documents (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  title TEXT NOT NULL,
  document_type TEXT NOT NULL,
  description TEXT,
  file_url TEXT,
  target_audience TEXT[] DEFAULT ARRAY['parents', 'athletes'],
  version TEXT DEFAULT '1.0',
  is_active BOOLEAN DEFAULT true,
  created_by UUID NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.youth_coordination_documents ENABLE ROW LEVEL SECURITY;

-- SECURITY DEFINER FUNCTION
CREATE OR REPLACE FUNCTION public.is_youth_coordinator(_club_id UUID, _user_id UUID)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_staff
    WHERE club_id = _club_id
      AND user_id = _user_id
      AND role IN ('admin', 'coordenador')
      AND is_active = true
  ) OR EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = _club_id AND owner_id = _user_id
  )
$$;

-- RLS POLICIES
CREATE POLICY "Coordinators can manage age groups" ON public.youth_age_groups FOR ALL USING (is_youth_coordinator(club_id, auth.uid()));
CREATE POLICY "Club staff can view age groups" ON public.youth_age_groups FOR SELECT USING (is_club_staff_member(club_id, auth.uid()));

CREATE POLICY "Coordinators can manage youth teams" ON public.youth_teams FOR ALL USING (is_youth_coordinator(club_id, auth.uid()));
CREATE POLICY "Club staff can view youth teams" ON public.youth_teams FOR SELECT USING (is_club_staff_member(club_id, auth.uid()));

CREATE POLICY "Coordinators can manage team coaches" ON public.youth_team_coaches FOR ALL USING (EXISTS (SELECT 1 FROM public.youth_teams yt WHERE yt.id = youth_team_coaches.youth_team_id AND is_youth_coordinator(yt.club_id, auth.uid())));
CREATE POLICY "Coaches can view their assignments" ON public.youth_team_coaches FOR SELECT USING (coach_id = auth.uid());

CREATE POLICY "Coordinators can manage team players" ON public.youth_team_players FOR ALL USING (EXISTS (SELECT 1 FROM public.youth_teams yt WHERE yt.id = youth_team_players.youth_team_id AND is_youth_coordinator(yt.club_id, auth.uid())));
CREATE POLICY "Coaches can view their team players" ON public.youth_team_players FOR SELECT USING (EXISTS (SELECT 1 FROM public.youth_team_coaches ytc WHERE ytc.youth_team_id = youth_team_players.youth_team_id AND ytc.coach_id = auth.uid()));

CREATE POLICY "Coordinators can manage training schedules" ON public.youth_training_schedules FOR ALL USING (is_youth_coordinator(club_id, auth.uid()));
CREATE POLICY "Staff can view training schedules" ON public.youth_training_schedules FOR SELECT USING (is_club_staff_member(club_id, auth.uid()));

CREATE POLICY "Coordinators can manage documents" ON public.youth_coordination_documents FOR ALL USING (is_youth_coordinator(club_id, auth.uid()));
CREATE POLICY "Staff can view documents" ON public.youth_coordination_documents FOR SELECT USING (is_club_staff_member(club_id, auth.uid()));

-- TRIGGERS
CREATE TRIGGER update_youth_age_groups_updated_at BEFORE UPDATE ON public.youth_age_groups FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_youth_teams_updated_at BEFORE UPDATE ON public.youth_teams FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_youth_team_players_updated_at BEFORE UPDATE ON public.youth_team_players FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_youth_training_schedules_updated_at BEFORE UPDATE ON public.youth_training_schedules FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_youth_coordination_documents_updated_at BEFORE UPDATE ON public.youth_coordination_documents FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();