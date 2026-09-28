
-- Make club_id nullable on communication tables to support individual coach mode
ALTER TABLE public.communication_channels ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.communication_announcements ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.communication_reminders ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.communication_templates ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.communication_automation_rules ALTER COLUMN club_id DROP NOT NULL;
ALTER TABLE public.attendance_requests ALTER COLUMN club_id DROP NOT NULL;

-- Add owner_id to communication_channels for individual coach ownership
ALTER TABLE public.communication_channels ADD COLUMN IF NOT EXISTS owner_id uuid REFERENCES auth.users(id);

-- Update RLS policies for communication_channels to support individual coach mode
DROP POLICY IF EXISTS "Users can view channels they belong to or created" ON public.communication_channels;
DROP POLICY IF EXISTS "Authenticated users can view club channels" ON public.communication_channels;
DROP POLICY IF EXISTS "Club members can view channels" ON public.communication_channels;

CREATE POLICY "Users can view accessible channels"
ON public.communication_channels FOR SELECT TO authenticated
USING (
  created_by = auth.uid()
  OR owner_id = auth.uid()
  OR public.is_channel_member(id, auth.uid())
  OR (club_id IS NOT NULL AND (
    public.is_club_admin(auth.uid(), club_id)
    OR public.is_club_coach(auth.uid(), club_id)
    OR public.is_club_staff_member(club_id, auth.uid())
    OR public.is_youth_coordinator(club_id, auth.uid())
  ))
);

DROP POLICY IF EXISTS "Authorized users can create channels" ON public.communication_channels;
CREATE POLICY "Authorized users can create channels"
ON public.communication_channels FOR INSERT TO authenticated
WITH CHECK (
  created_by = auth.uid()
);

DROP POLICY IF EXISTS "Channel managers can update" ON public.communication_channels;
CREATE POLICY "Channel managers can update"
ON public.communication_channels FOR UPDATE TO authenticated
USING (
  created_by = auth.uid()
  OR owner_id = auth.uid()
  OR (club_id IS NOT NULL AND public.is_club_admin(auth.uid(), club_id))
);
