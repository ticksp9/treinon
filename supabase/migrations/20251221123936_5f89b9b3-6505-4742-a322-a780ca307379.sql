-- Add preferred sport column to profiles
ALTER TABLE public.profiles 
ADD COLUMN preferred_sport TEXT NOT NULL DEFAULT 'football' 
CHECK (preferred_sport IN ('football', 'futsal'));