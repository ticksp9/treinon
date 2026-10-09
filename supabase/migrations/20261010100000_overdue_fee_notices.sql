-- Overdue fees, for the daily job that emails the coordinators: one row per player with
-- unpaid charges past the due date. Same rule as the "Mensalidades em atraso" list of the
-- coordinator's Alertas page (ref_key = due date of the oldest unpaid charge).
CREATE OR REPLACE FUNCTION public.overdue_fee_alerts()
RETURNS TABLE (club_id uuid, team_id uuid, team_name text, player_id uuid, player_name text, ref_key text, items integer, amount numeric, since date)
LANGUAGE sql STABLE SECURITY DEFINER SET search_path = public AS $$
  SELECT t.club_id, t.id, t.name::text, p.id, p.name::text,
         min(c.due_date)::text, count(*)::integer, sum(c.balance_due)::numeric, min(c.due_date)::date
    FROM public.charges c
    JOIN public.players p ON p.id = c.player_id
    JOIN public.teams t ON t.id = p.team_id AND t.club_id = c.club_id
   WHERE c.balance_due > 0 AND c.due_date < current_date
     AND c.status::text NOT IN ('paid', 'cancelled', 'void', 'refunded')
   GROUP BY t.club_id, t.id, t.name, p.id, p.name
$$;
REVOKE ALL ON FUNCTION public.overdue_fee_alerts() FROM PUBLIC, anon, authenticated;
