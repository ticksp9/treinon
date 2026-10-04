-- Birth years that belong to each team (e.g. Sub-13 = 2013, 2014). Players born in
-- those years are placed in the team automatically when importing / distributing.
ALTER TABLE public.teams ADD COLUMN IF NOT EXISTS birth_years smallint[];
COMMENT ON COLUMN public.teams.birth_years IS 'Birth years of the players of this team (set by the club); used to distribute players automatically.';
