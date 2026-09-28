
-- Add retry and operational columns to invite_deliveries
ALTER TABLE public.invite_deliveries
  ADD COLUMN IF NOT EXISTS retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS max_retries integer NOT NULL DEFAULT 3,
  ADD COLUMN IF NOT EXISTS next_retry_at timestamptz,
  ADD COLUMN IF NOT EXISTS last_attempt_at timestamptz,
  ADD COLUMN IF NOT EXISTS template_id uuid,
  ADD COLUMN IF NOT EXISTS version_id uuid;

-- Add index for retry scheduling
CREATE INDEX IF NOT EXISTS idx_invite_deliveries_retry
  ON public.invite_deliveries (send_status, next_retry_at)
  WHERE send_status IN ('retry_scheduled', 'failed');

-- Add index for provider message lookup (webhooks)
CREATE INDEX IF NOT EXISTS idx_invite_deliveries_provider_msg
  ON public.invite_deliveries (provider_name, provider_message_id)
  WHERE provider_message_id IS NOT NULL;

-- Add updated_at trigger
CREATE OR REPLACE TRIGGER update_invite_deliveries_updated_at
  BEFORE UPDATE ON public.invite_deliveries
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
