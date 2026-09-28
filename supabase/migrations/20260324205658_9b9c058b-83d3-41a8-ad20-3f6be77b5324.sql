
-- Add visibility/access control columns to communication_channels
ALTER TABLE public.communication_channels
  ADD COLUMN IF NOT EXISTS visibility_scope text NOT NULL DEFAULT 'team_based',
  ADD COLUMN IF NOT EXISTS allow_guardians boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_players boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_coaches boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS allow_staff boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS allow_coordinators boolean NOT NULL DEFAULT false;

COMMENT ON COLUMN public.communication_channels.visibility_scope IS 'private, restricted, role_based, team_based, age_group_based, official_broadcast, mixed_custom';

-- Drop the overly-permissive SELECT policy that gives all club staff/coaches access to ALL channels
DROP POLICY IF EXISTS "Users can view accessible channels" ON public.communication_channels;

-- Drop the redundant older policy too
DROP POLICY IF EXISTS "Members can view their channels" ON public.communication_channels;

-- Replace with strict membership-based policy:
-- Only admins/coordinators get broad club visibility for management.
-- Everyone else (coaches, staff, guardians, players) MUST be a channel member or creator/owner.
CREATE POLICY "Strict channel visibility"
ON public.communication_channels
FOR SELECT
TO authenticated
USING (
  created_by = auth.uid()
  OR owner_id = auth.uid()
  OR is_channel_member(id, auth.uid())
  OR (club_id IS NOT NULL AND is_club_admin(auth.uid(), club_id))
  OR (club_id IS NOT NULL AND is_youth_coordinator(club_id, auth.uid()))
);
