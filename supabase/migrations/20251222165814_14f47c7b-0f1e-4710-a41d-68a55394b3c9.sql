-- Fix the security definer view issue by dropping and recreating as SECURITY INVOKER
DROP VIEW IF EXISTS public.player_public_info;

-- Recreate as a regular view (SECURITY INVOKER is default)
CREATE VIEW public.player_public_info AS
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