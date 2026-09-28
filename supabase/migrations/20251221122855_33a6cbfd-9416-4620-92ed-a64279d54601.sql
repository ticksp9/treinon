-- Table to store club coach invitations
CREATE TABLE public.club_coach_invitations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  email TEXT,
  invite_code TEXT UNIQUE,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT (now() + interval '7 days'),
  created_by UUID NOT NULL
);

-- Table to link coaches to clubs
CREATE TABLE public.club_coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  club_id UUID NOT NULL REFERENCES public.clubs(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  joined_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_active BOOLEAN NOT NULL DEFAULT true,
  UNIQUE (club_id, coach_id)
);

-- Table to link coaches to specific teams they manage
CREATE TABLE public.team_coaches (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  team_id UUID NOT NULL REFERENCES public.teams(id) ON DELETE CASCADE,
  coach_id UUID NOT NULL,
  assigned_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  is_primary BOOLEAN NOT NULL DEFAULT false,
  UNIQUE (team_id, coach_id)
);

-- Enable RLS
ALTER TABLE public.club_coach_invitations ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.club_coaches ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.team_coaches ENABLE ROW LEVEL SECURITY;

-- Function to check if user is club admin
CREATE OR REPLACE FUNCTION public.is_club_admin(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.clubs
    WHERE id = _club_id AND owner_id = _user_id
  )
$$;

-- Function to check if user is coach of a club
CREATE OR REPLACE FUNCTION public.is_club_coach(_user_id uuid, _club_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.club_coaches
    WHERE coach_id = _user_id AND club_id = _club_id AND is_active = true
  )
$$;

-- Function to check if user is coach of a team
CREATE OR REPLACE FUNCTION public.is_team_coach(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.team_coaches
    WHERE coach_id = _user_id AND team_id = _team_id
  )
$$;

-- Function to get club_id for a coach
CREATE OR REPLACE FUNCTION public.get_coach_club_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT club_id FROM public.club_coaches
  WHERE coach_id = _user_id AND is_active = true
  LIMIT 1
$$;

-- RLS for club_coach_invitations
CREATE POLICY "Club admins can view their invitations"
ON public.club_coach_invitations FOR SELECT
USING (public.is_club_admin(auth.uid(), club_id));

CREATE POLICY "Club admins can create invitations"
ON public.club_coach_invitations FOR INSERT
WITH CHECK (public.is_club_admin(auth.uid(), club_id));

CREATE POLICY "Club admins can update their invitations"
ON public.club_coach_invitations FOR UPDATE
USING (public.is_club_admin(auth.uid(), club_id));

CREATE POLICY "Club admins can delete their invitations"
ON public.club_coach_invitations FOR DELETE
USING (public.is_club_admin(auth.uid(), club_id));

-- RLS for club_coaches
CREATE POLICY "Club admins can view their coaches"
ON public.club_coaches FOR SELECT
USING (public.is_club_admin(auth.uid(), club_id));

CREATE POLICY "Coaches can view their own membership"
ON public.club_coaches FOR SELECT
USING (coach_id = auth.uid());

CREATE POLICY "Club admins can add coaches"
ON public.club_coaches FOR INSERT
WITH CHECK (public.is_club_admin(auth.uid(), club_id));

CREATE POLICY "Club admins can update coaches"
ON public.club_coaches FOR UPDATE
USING (public.is_club_admin(auth.uid(), club_id));

CREATE POLICY "Club admins can remove coaches"
ON public.club_coaches FOR DELETE
USING (public.is_club_admin(auth.uid(), club_id));

-- RLS for team_coaches
CREATE POLICY "Club admins can view team coaches"
ON public.team_coaches FOR SELECT
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_id AND public.is_club_admin(auth.uid(), t.club_id)
));

CREATE POLICY "Coaches can view their team assignments"
ON public.team_coaches FOR SELECT
USING (coach_id = auth.uid());

CREATE POLICY "Club admins can assign coaches to teams"
ON public.team_coaches FOR INSERT
WITH CHECK (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_id AND public.is_club_admin(auth.uid(), t.club_id)
));

CREATE POLICY "Club admins can update team coach assignments"
ON public.team_coaches FOR UPDATE
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_id AND public.is_club_admin(auth.uid(), t.club_id)
));

CREATE POLICY "Club admins can remove coaches from teams"
ON public.team_coaches FOR DELETE
USING (EXISTS (
  SELECT 1 FROM public.teams t
  WHERE t.id = team_id AND public.is_club_admin(auth.uid(), t.club_id)
));

-- Update teams RLS to allow coaches to see their assigned teams
CREATE POLICY "Coaches can view their assigned teams"
ON public.teams FOR SELECT
USING (public.is_team_coach(auth.uid(), id));

-- Update players RLS to allow coaches to manage players in their teams
CREATE POLICY "Coaches can view players in their teams"
ON public.players FOR SELECT
USING (public.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Coaches can insert players in their teams"
ON public.players FOR INSERT
WITH CHECK (public.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Coaches can update players in their teams"
ON public.players FOR UPDATE
USING (public.is_team_coach(auth.uid(), team_id));

-- Update matches RLS for coaches
CREATE POLICY "Coaches can view matches of their teams"
ON public.matches FOR SELECT
USING (public.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Coaches can insert matches for their teams"
ON public.matches FOR INSERT
WITH CHECK (public.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Coaches can update matches of their teams"
ON public.matches FOR UPDATE
USING (public.is_team_coach(auth.uid(), team_id));

-- Update training_sessions RLS for coaches
CREATE POLICY "Coaches can view training sessions of their teams"
ON public.training_sessions FOR SELECT
USING (public.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Coaches can insert training sessions for their teams"
ON public.training_sessions FOR INSERT
WITH CHECK (public.is_team_coach(auth.uid(), team_id));

CREATE POLICY "Coaches can update training sessions of their teams"
ON public.training_sessions FOR UPDATE
USING (public.is_team_coach(auth.uid(), team_id));