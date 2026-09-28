
-- Invite templates table
CREATE TABLE public.invite_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  template_key TEXT NOT NULL,
  profile_type TEXT NOT NULL CHECK (profile_type IN ('guardian', 'player', 'coach', 'assistant_coach', 'staff')),
  delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('email', 'sms', 'whatsapp')),
  language TEXT NOT NULL DEFAULT 'pt',
  subject_template TEXT,
  body_template TEXT NOT NULL,
  is_default BOOLEAN NOT NULL DEFAULT false,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by UUID REFERENCES auth.users(id),
  updated_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (template_key, profile_type, delivery_channel, language)
);

ALTER TABLE public.invite_templates ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Authenticated users can read active templates"
  ON public.invite_templates FOR SELECT TO authenticated
  USING (is_active = true);

CREATE POLICY "Admins can manage templates"
  ON public.invite_templates FOR ALL TO authenticated
  USING (created_by = auth.uid())
  WITH CHECK (created_by = auth.uid());

-- Invite deliveries table  
CREATE TABLE public.invite_deliveries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.access_invites(id) ON DELETE CASCADE,
  delivery_channel TEXT NOT NULL CHECK (delivery_channel IN ('email', 'sms', 'whatsapp')),
  template_key TEXT,
  rendered_subject TEXT,
  rendered_message TEXT NOT NULL,
  recipient_email TEXT,
  recipient_phone TEXT,
  provider_name TEXT,
  provider_message_id TEXT,
  send_status TEXT NOT NULL DEFAULT 'queued' CHECK (send_status IN ('queued', 'sending', 'sent', 'delivered', 'failed', 'bounced', 'opened', 'clicked')),
  failure_reason TEXT,
  sent_by_user_id UUID REFERENCES auth.users(id),
  sent_at TIMESTAMPTZ,
  delivered_at TIMESTAMPTZ,
  opened_at TIMESTAMPTZ,
  clicked_at TIMESTAMPTZ,
  accepted_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_deliveries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Context managers can read deliveries"
  ON public.invite_deliveries FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.access_invites ai
      WHERE ai.id = invite_id
      AND (
        ai.created_by = auth.uid()
        OR (ai.club_id IS NOT NULL AND public.is_club_admin(auth.uid(), ai.club_id))
        OR (ai.club_id IS NOT NULL AND public.is_youth_coordinator(ai.club_id, auth.uid()))
      )
    )
  );

CREATE POLICY "Authorized users can insert deliveries"
  ON public.invite_deliveries FOR INSERT TO authenticated
  WITH CHECK (sent_by_user_id = auth.uid());

-- Invite events table
CREATE TABLE public.invite_events (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  invite_id UUID NOT NULL REFERENCES public.access_invites(id) ON DELETE CASCADE,
  delivery_id UUID REFERENCES public.invite_deliveries(id) ON DELETE SET NULL,
  event_type TEXT NOT NULL CHECK (event_type IN (
    'created', 'send_requested', 'sent', 'delivered', 'opened', 'clicked',
    'code_viewed', 'validation_started', 'accepted', 'expired', 'revoked', 'resent', 'failed'
  )),
  event_source TEXT NOT NULL DEFAULT 'system' CHECK (event_source IN ('system', 'backend', 'provider_webhook', 'user_action')),
  actor_user_id UUID REFERENCES auth.users(id),
  payload JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.invite_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Context managers can read events"
  ON public.invite_events FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.access_invites ai
      WHERE ai.id = invite_id
      AND (
        ai.created_by = auth.uid()
        OR (ai.club_id IS NOT NULL AND public.is_club_admin(auth.uid(), ai.club_id))
        OR (ai.club_id IS NOT NULL AND public.is_youth_coordinator(ai.club_id, auth.uid()))
      )
    )
  );

-- Create indexes
CREATE INDEX idx_invite_deliveries_invite_id ON public.invite_deliveries(invite_id);
CREATE INDEX idx_invite_deliveries_status ON public.invite_deliveries(send_status);
CREATE INDEX idx_invite_events_invite_id ON public.invite_events(invite_id);
CREATE INDEX idx_invite_events_type ON public.invite_events(event_type);

-- Add delivery_channels to access_invites
ALTER TABLE public.access_invites ADD COLUMN IF NOT EXISTS delivery_channels TEXT[] DEFAULT '{}';
