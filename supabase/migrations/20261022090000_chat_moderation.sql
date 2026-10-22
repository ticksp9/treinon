-- Chat moderation (App Store guideline 1.2: content with users needs a way to report and to block).
--   * Anyone who can read a message can report it. The team's managers (who can manage the group)
--     see the reports and can delete the message; the support address gets an email (send-notice).
--   * Anyone can block another person: that person's messages stop showing for them.
--   * Whoever manages a group can delete any message in it.

CREATE TABLE IF NOT EXISTS public.communication_message_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  message_id uuid REFERENCES public.communication_messages(id) ON DELETE SET NULL,
  channel_id uuid REFERENCES public.communication_channels(id) ON DELETE CASCADE,
  reporter_id uuid REFERENCES auth.users(id) ON DELETE SET NULL DEFAULT auth.uid(),
  reported_user_id uuid,
  -- copy of the message, so the report still makes sense after the message is deleted
  message_content text,
  reason text NOT NULL DEFAULT '',
  status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'resolved')),
  resolved_by uuid,
  resolved_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS communication_message_reports_channel_idx ON public.communication_message_reports (channel_id, status);

-- fill channel, author and the copy from the message itself (the client cannot fake them)
CREATE OR REPLACE FUNCTION public.fill_message_report()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE m record;
BEGIN
  SELECT channel_id, sender_id, content INTO m FROM public.communication_messages WHERE id = NEW.message_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Mensagem não encontrada'; END IF;
  NEW.channel_id := m.channel_id;
  NEW.reported_user_id := m.sender_id;
  NEW.message_content := left(m.content, 2000);
  NEW.reporter_id := auth.uid();
  NEW.status := 'open';
  NEW.resolved_by := NULL;
  NEW.resolved_at := NULL;
  RETURN NEW;
END $$;
DROP TRIGGER IF EXISTS fill_message_report ON public.communication_message_reports;
CREATE TRIGGER fill_message_report BEFORE INSERT ON public.communication_message_reports
  FOR EACH ROW EXECUTE FUNCTION public.fill_message_report();

ALTER TABLE public.communication_message_reports ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Report a message you can read" ON public.communication_message_reports;
CREATE POLICY "Report a message you can read" ON public.communication_message_reports
  FOR INSERT TO authenticated
  WITH CHECK (EXISTS (
    SELECT 1 FROM public.communication_messages m
    WHERE m.id = message_id
      AND (public.is_channel_member(m.channel_id, auth.uid()) OR public.can_manage_channel(m.channel_id, auth.uid()))
  ));

DROP POLICY IF EXISTS "See own reports and the group's" ON public.communication_message_reports;
CREATE POLICY "See own reports and the group's" ON public.communication_message_reports
  FOR SELECT TO authenticated
  USING (reporter_id = auth.uid() OR public.can_manage_channel(channel_id, auth.uid()));

DROP POLICY IF EXISTS "Managers resolve reports" ON public.communication_message_reports;
CREATE POLICY "Managers resolve reports" ON public.communication_message_reports
  FOR UPDATE TO authenticated
  USING (public.can_manage_channel(channel_id, auth.uid()))
  WITH CHECK (public.can_manage_channel(channel_id, auth.uid()));

CREATE TABLE IF NOT EXISTS public.user_blocks (
  blocker_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE DEFAULT auth.uid(),
  blocked_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id),
  CHECK (blocker_id <> blocked_id)
);
ALTER TABLE public.user_blocks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Own blocks" ON public.user_blocks;
CREATE POLICY "Own blocks" ON public.user_blocks
  FOR ALL TO authenticated
  USING (blocker_id = auth.uid())
  WITH CHECK (blocker_id = auth.uid());

-- whoever manages the group removes what breaks the rules
DROP POLICY IF EXISTS "Managers can delete messages" ON public.communication_messages;
CREATE POLICY "Managers can delete messages" ON public.communication_messages
  FOR DELETE TO authenticated
  USING (public.can_manage_channel(channel_id, auth.uid()));

GRANT SELECT, INSERT, UPDATE ON public.communication_message_reports TO authenticated;
GRANT SELECT, INSERT, DELETE ON public.user_blocks TO authenticated;
