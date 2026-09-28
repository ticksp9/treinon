-- Add username column to profiles
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS username TEXT UNIQUE;

-- Create index for faster username lookups
CREATE INDEX IF NOT EXISTS idx_profiles_username ON public.profiles(username);

-- Update the handle_new_user function to include username
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, account_type, username)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE((NEW.raw_user_meta_data ->> 'account_type')::account_type, 'individual_coach'),
    NEW.raw_user_meta_data ->> 'username'
  );
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;