-- Update handle_new_user function to also set display_name
CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public'
AS $function$
BEGIN
  INSERT INTO public.profiles (id, email, full_name, account_type, username, display_name)
  VALUES (
    NEW.id, 
    NEW.email, 
    NEW.raw_user_meta_data ->> 'full_name',
    COALESCE((NEW.raw_user_meta_data ->> 'account_type')::account_type, 'individual_coach'),
    NEW.raw_user_meta_data ->> 'username',
    COALESCE(NEW.raw_user_meta_data ->> 'full_name', NEW.raw_user_meta_data ->> 'username')
  );
  RETURN NEW;
END;
$function$;