
-- 1. Add guardian and player to account_type enum
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'guardian';
ALTER TYPE public.account_type ADD VALUE IF NOT EXISTS 'player';

-- 2. Create player_accounts table linking auth users to player records
CREATE TABLE IF NOT EXISTS public.player_accounts (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL UNIQUE REFERENCES auth.users(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(player_id)
);
ALTER TABLE public.player_accounts ENABLE ROW LEVEL SECURITY;

-- 3. Create player_technical_content table for coach->player content
CREATE TABLE IF NOT EXISTS public.player_technical_content (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  team_id uuid REFERENCES public.teams(id) ON DELETE SET NULL,
  created_by uuid NOT NULL,
  content_type text NOT NULL DEFAULT 'note',
  target_type text NOT NULL DEFAULT 'individual',
  target_player_id uuid REFERENCES public.players(id) ON DELETE CASCADE,
  target_position text,
  target_group text,
  title text NOT NULL,
  body text,
  attachment_url text,
  attachment_name text,
  related_training_id uuid REFERENCES public.coach_trainings(id) ON DELETE SET NULL,
  related_match_id uuid REFERENCES public.matches(id) ON DELETE SET NULL,
  is_mandatory_read boolean DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.player_technical_content ENABLE ROW LEVEL SECURITY;

-- 4. Track reads on technical content
CREATE TABLE IF NOT EXISTS public.player_content_reads (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  content_id uuid NOT NULL REFERENCES public.player_technical_content(id) ON DELETE CASCADE,
  player_id uuid NOT NULL REFERENCES public.players(id) ON DELETE CASCADE,
  read_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE(content_id, player_id)
);
ALTER TABLE public.player_content_reads ENABLE ROW LEVEL SECURITY;

-- 5. RLS for player_accounts
CREATE POLICY "Users can read own player account" ON public.player_accounts
  FOR SELECT TO authenticated USING (user_id = auth.uid());

CREATE POLICY "Staff can manage player accounts" ON public.player_accounts
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.players p
      JOIN public.teams t ON t.id = p.team_id
      WHERE p.id = player_accounts.player_id
        AND t.owner_id = auth.uid()
    )
  );

-- 6. RLS for player_technical_content
CREATE POLICY "Creator can manage content" ON public.player_technical_content
  FOR ALL TO authenticated USING (created_by = auth.uid());

CREATE POLICY "Target player can read content" ON public.player_technical_content
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.player_accounts pa
      WHERE pa.user_id = auth.uid()
        AND (
          player_technical_content.target_player_id = pa.player_id
          OR player_technical_content.target_type = 'team'
          OR (player_technical_content.target_type = 'position' AND player_technical_content.target_position = (
            SELECT position FROM public.players WHERE id = pa.player_id
          ))
        )
    )
  );

CREATE POLICY "Team owner can read content" ON public.player_technical_content
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.teams t
      WHERE t.id = player_technical_content.team_id AND t.owner_id = auth.uid()
    )
  );

-- 7. RLS for player_content_reads
CREATE POLICY "Players can manage own reads" ON public.player_content_reads
  FOR ALL TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.player_accounts pa
      WHERE pa.user_id = auth.uid() AND pa.player_id = player_content_reads.player_id
    )
  );

CREATE POLICY "Content creator can view reads" ON public.player_content_reads
  FOR SELECT TO authenticated USING (
    EXISTS (
      SELECT 1 FROM public.player_technical_content ptc
      WHERE ptc.id = player_content_reads.content_id AND ptc.created_by = auth.uid()
    )
  );

-- 8. Helper function: get player_id for current user
CREATE OR REPLACE FUNCTION public.get_player_account_id(_user_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT player_id FROM public.player_accounts
  WHERE user_id = _user_id
  LIMIT 1
$$;

-- 9. Helper function: check if user is a guardian of any player in a team
CREATE OR REPLACE FUNCTION public.is_guardian_of_team_player(_user_id uuid, _team_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.player_guardians pg
    JOIN public.guardian_profiles gp ON gp.id = pg.guardian_id
    JOIN public.players p ON p.id = pg.player_id
    WHERE gp.user_id = _user_id AND p.team_id = _team_id AND p.is_active = true
  )
$$;
