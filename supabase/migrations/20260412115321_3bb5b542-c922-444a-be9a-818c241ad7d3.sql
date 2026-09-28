ALTER TABLE public.communication_channel_members
ADD COLUMN IF NOT EXISTS last_read_at TIMESTAMPTZ DEFAULT NULL;