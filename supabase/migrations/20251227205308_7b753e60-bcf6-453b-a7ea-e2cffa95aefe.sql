-- Create a trigger function to handle new user registration
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  role_id_val INTEGER;
  user_name TEXT;
BEGIN
  -- Default role is tenant (3)
  role_id_val := COALESCE((NEW.raw_user_meta_data->>'role_id')::INTEGER, 3);
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', 'User');
  
  -- Insert into users table
  INSERT INTO public.users (user_id, email, password, role_id)
  VALUES (NEW.id, NEW.email, 'MANAGED_BY_SUPABASE_AUTH', role_id_val)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Insert into user_roles table
  INSERT INTO public.user_roles (user_id, role_id)
  VALUES (NEW.id, role_id_val)
  ON CONFLICT (user_id) DO NOTHING;
  
  -- Create profile based on role
  IF role_id_val = 1 THEN
    INSERT INTO public.admin (user_id, name, email)
    VALUES (NEW.id, user_name, NEW.email)
    ON CONFLICT (user_id) DO NOTHING;
  ELSIF role_id_val = 2 THEN
    INSERT INTO public.property_owner (user_id, name, email, contact_no)
    VALUES (NEW.id, user_name, NEW.email, NEW.raw_user_meta_data->>'contact_no')
    ON CONFLICT (user_id) DO NOTHING;
  ELSE
    INSERT INTO public.tenant (user_id, name, email, contact_no)
    VALUES (NEW.id, user_name, NEW.email, NEW.raw_user_meta_data->>'contact_no')
    ON CONFLICT (user_id) DO NOTHING;
  END IF;
  
  RETURN NEW;
END;
$$;

-- Drop existing trigger if exists
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;

-- Create trigger to run after user signup
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();