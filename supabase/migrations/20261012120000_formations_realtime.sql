-- Formation changes reach the rest of the technical staff right away (Supabase Realtime).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'custom_formations') THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.custom_formations;
  END IF;
END $$;
