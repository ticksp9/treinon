
-- Create access_invites table for guardian and player invitations
CREATE TABLE public.access_invites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  scope_type TEXT NOT NULL DEFAULT 'club' CHECK (scope_type IN ('club', 'coach')),
  club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
  owner_coach_id UUID,
  team_id UUID REFERENCES public.teams(id) ON DELETE CASCADE NOT NULL,
  player_id UUID REFERENCES public.players(id) ON DELETE CASCADE,
  invite_type TEXT NOT NULL CHECK (invite_type IN ('guardian', 'player')),
  delivery_method TEXT NOT NULL DEFAULT 'email' CHECK (delivery_method IN ('email', 'sms', 'both')),
  recipient_name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  invite_token_hash TEXT NOT NULL,
  invite_code TEXT,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired', 'revoked')),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '7 days'),
  sent_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  accepted_by_user_id UUID,
  created_by UUID NOT NULL,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Add index for token lookups
CREATE INDEX idx_access_invites_token_hash ON public.access_invites(invite_token_hash);
CREATE INDEX idx_access_invites_code ON public.access_invites(invite_code) WHERE invite_code IS NOT NULL;
CREATE INDEX idx_access_invites_status ON public.access_invites(status);

-- Enable RLS
ALTER TABLE public.access_invites ENABLE ROW LEVEL SECURITY;

-- Staff/coaches can see invites they created or for their team scope
CREATE POLICY "invite_creator_select" ON public.access_invites
FOR SELECT USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = access_invites.team_id
    AND (
      t.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
      OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  )
);

-- Staff/coaches can create invites for their teams
CREATE POLICY "invite_staff_insert" ON public.access_invites
FOR INSERT WITH CHECK (
  created_by = auth.uid()
  AND EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = access_invites.team_id
    AND (
      t.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
      OR EXISTS (SELECT 1 FROM public.team_coaches tc WHERE tc.team_id = t.id AND tc.coach_id = auth.uid())
    )
  )
);

-- Staff/coaches can update (revoke) invites they manage
CREATE POLICY "invite_staff_update" ON public.access_invites
FOR UPDATE USING (
  created_by = auth.uid()
  OR EXISTS (
    SELECT 1 FROM public.teams t
    WHERE t.id = access_invites.team_id
    AND (
      t.owner_id = auth.uid()
      OR EXISTS (SELECT 1 FROM public.clubs c WHERE c.id = t.club_id AND c.owner_id = auth.uid())
      OR EXISTS (SELECT 1 FROM public.club_staff cs WHERE cs.club_id = t.club_id AND cs.user_id = auth.uid() AND cs.is_active = true)
    )
  )
);

-- Fix player_guardians RLS: add support for individual coach (team.owner_id)
CREATE POLICY "pg_coach_owner_insert" ON public.player_guardians
FOR INSERT WITH CHECK (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.teams t ON t.id = p.team_id
    WHERE p.id = player_guardians.player_id
    AND t.owner_id = auth.uid()
    AND t.club_id IS NULL
  )
);

CREATE POLICY "pg_coach_owner_delete" ON public.player_guardians
FOR DELETE USING (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.teams t ON t.id = p.team_id
    WHERE p.id = player_guardians.player_id
    AND t.owner_id = auth.uid()
    AND t.club_id IS NULL
  )
);

-- Fix player_accounts: add individual coach support
CREATE POLICY "coach_owner_manage_player_accounts" ON public.player_accounts
FOR ALL USING (
  EXISTS (
    SELECT 1 FROM public.players p
    JOIN public.teams t ON t.id = p.team_id
    WHERE p.id = player_accounts.player_id
    AND t.owner_id = auth.uid()
    AND t.club_id IS NULL
  )
);
