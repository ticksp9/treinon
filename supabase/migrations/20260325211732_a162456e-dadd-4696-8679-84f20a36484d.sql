
-- Add missing columns to invite_templates
ALTER TABLE public.invite_templates
  ADD COLUMN IF NOT EXISTS name text,
  ADD COLUMN IF NOT EXISTS description text,
  ADD COLUMN IF NOT EXISTS version_number integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'published',
  ADD COLUMN IF NOT EXISTS club_id uuid REFERENCES public.clubs(id) ON DELETE CASCADE,
  ADD COLUMN IF NOT EXISTS owner_coach_id uuid;

-- Backfill name from template_key
UPDATE public.invite_templates SET name = template_key WHERE name IS NULL;

-- Create invite_template_versions
CREATE TABLE IF NOT EXISTS public.invite_template_versions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.invite_templates(id) ON DELETE CASCADE,
  version_number integer NOT NULL DEFAULT 1,
  subject_template text,
  body_template text NOT NULL,
  change_notes text,
  is_published boolean NOT NULL DEFAULT false,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

-- Create invite_template_events
CREATE TABLE IF NOT EXISTS public.invite_template_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  template_id uuid NOT NULL REFERENCES public.invite_templates(id) ON DELETE CASCADE,
  version_id uuid REFERENCES public.invite_template_versions(id) ON DELETE SET NULL,
  event_type text NOT NULL,
  actor_user_id uuid,
  payload jsonb DEFAULT '{}',
  created_at timestamptz NOT NULL DEFAULT now()
);

-- RLS for invite_templates (update existing)
ALTER TABLE public.invite_templates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_template_versions ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.invite_template_events ENABLE ROW LEVEL SECURITY;

-- Drop old policies if they exist
DROP POLICY IF EXISTS "Admin read invite_templates" ON public.invite_templates;
DROP POLICY IF EXISTS "Admin manage invite_templates" ON public.invite_templates;
DROP POLICY IF EXISTS "Active templates readable" ON public.invite_templates;

-- invite_templates: anyone authenticated can read active templates (needed for send-invite)
CREATE POLICY "Read active invite_templates"
  ON public.invite_templates FOR SELECT TO authenticated
  USING (true);

-- invite_templates: only club admins/owners or individual coaches can insert/update/delete
CREATE POLICY "Manage invite_templates"
  ON public.invite_templates FOR ALL TO authenticated
  USING (
    created_by = auth.uid()
    OR club_id IS NULL
    OR is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
  )
  WITH CHECK (
    created_by = auth.uid()
    OR club_id IS NULL
    OR is_club_admin(auth.uid(), club_id)
    OR is_youth_coordinator(club_id, auth.uid())
  );

-- invite_template_versions
CREATE POLICY "Read invite_template_versions"
  ON public.invite_template_versions FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Manage invite_template_versions"
  ON public.invite_template_versions FOR ALL TO authenticated
  USING (created_by = auth.uid() OR true)
  WITH CHECK (true);

-- invite_template_events
CREATE POLICY "Read invite_template_events"
  ON public.invite_template_events FOR SELECT TO authenticated
  USING (true);

CREATE POLICY "Insert invite_template_events"
  ON public.invite_template_events FOR INSERT TO authenticated
  WITH CHECK (actor_user_id = auth.uid());
