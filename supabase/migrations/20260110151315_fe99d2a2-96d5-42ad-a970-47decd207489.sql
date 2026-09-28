-- Add soft delete fields to matches table
ALTER TABLE public.matches 
ADD COLUMN IF NOT EXISTS is_deleted boolean NOT NULL DEFAULT false,
ADD COLUMN IF NOT EXISTS deleted_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS deleted_by uuid;

-- Add comment for documentation
COMMENT ON COLUMN public.matches.is_deleted IS 'Soft delete flag - true means match is deleted';
COMMENT ON COLUMN public.matches.deleted_at IS 'Timestamp when the match was soft deleted';
COMMENT ON COLUMN public.matches.deleted_by IS 'User ID who deleted the match';

-- Create index for faster filtering of non-deleted matches
CREATE INDEX IF NOT EXISTS idx_matches_is_deleted ON public.matches(is_deleted) WHERE is_deleted = false;