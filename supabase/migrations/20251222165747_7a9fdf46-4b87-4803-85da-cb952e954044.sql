-- Create table to store security PINs for clubs/coaches
CREATE TABLE public.security_pins (
    id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
    owner_id UUID NOT NULL,
    club_id UUID REFERENCES public.clubs(id) ON DELETE CASCADE,
    pin_hash TEXT NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
    UNIQUE(owner_id),
    UNIQUE(club_id)
);

-- Enable RLS
ALTER TABLE public.security_pins ENABLE ROW LEVEL SECURITY;

-- Only owner can manage their PIN
CREATE POLICY "Users can view their own PIN hash"
ON public.security_pins
FOR SELECT
USING (auth.uid() = owner_id);

CREATE POLICY "Users can create their own PIN"
ON public.security_pins
FOR INSERT
WITH CHECK (auth.uid() = owner_id);

CREATE POLICY "Users can update their own PIN"
ON public.security_pins
FOR UPDATE
USING (auth.uid() = owner_id);

CREATE POLICY "Users can delete their own PIN"
ON public.security_pins
FOR DELETE
USING (auth.uid() = owner_id);

-- Create trigger for updated_at
CREATE TRIGGER update_security_pins_updated_at
BEFORE UPDATE ON public.security_pins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create function to verify PIN (returns true if correct)
CREATE OR REPLACE FUNCTION public.verify_security_pin(_owner_id UUID, _pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
    stored_hash TEXT;
BEGIN
    SELECT pin_hash INTO stored_hash
    FROM public.security_pins
    WHERE owner_id = _owner_id;
    
    IF stored_hash IS NULL THEN
        RETURN FALSE;
    END IF;
    
    -- Simple hash comparison (PIN should be hashed on client side)
    RETURN stored_hash = _pin;
END;
$$;

-- Create a view for "public" player data (no sensitive info)
CREATE OR REPLACE VIEW public.player_public_info AS
SELECT 
    id,
    name,
    number,
    position,
    foot,
    height_cm,
    weight_kg,
    team_id,
    is_active,
    created_at,
    updated_at,
    owner_id
FROM public.players;

-- Grant access to the view
GRANT SELECT ON public.player_public_info TO authenticated;

-- Now let's improve RLS on the players table to be more restrictive
-- First, drop existing policies
DROP POLICY IF EXISTS "Users can view own players" ON public.players;
DROP POLICY IF EXISTS "Users can insert own players" ON public.players;
DROP POLICY IF EXISTS "Users can update own players" ON public.players;
DROP POLICY IF EXISTS "Users can delete own players" ON public.players;

-- Create more restrictive policies
CREATE POLICY "Owners can fully manage their players"
ON public.players
FOR ALL
USING (auth.uid() = owner_id);

-- Team coaches can view players on their team
CREATE POLICY "Team coaches can view team players"
ON public.players
FOR SELECT
USING (
    public.is_team_coach(auth.uid(), team_id)
);

-- Club staff can view players in club teams
CREATE POLICY "Club staff can view club players"
ON public.players
FOR SELECT
USING (
    EXISTS (
        SELECT 1 FROM public.teams t
        WHERE t.id = players.team_id
        AND t.club_id IS NOT NULL
        AND public.is_club_staff_member(t.club_id, auth.uid())
    )
);