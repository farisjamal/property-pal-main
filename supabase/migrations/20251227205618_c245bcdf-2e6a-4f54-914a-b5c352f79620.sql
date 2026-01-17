-- Add unique constraints on user_id for all profile tables
ALTER TABLE public.users ADD CONSTRAINT users_user_id_unique UNIQUE (user_id);
ALTER TABLE public.user_roles ADD CONSTRAINT user_roles_user_id_unique UNIQUE (user_id);
ALTER TABLE public.admin ADD CONSTRAINT admin_user_id_unique UNIQUE (user_id);
ALTER TABLE public.property_owner ADD CONSTRAINT property_owner_user_id_unique UNIQUE (user_id);
ALTER TABLE public.tenant ADD CONSTRAINT tenant_user_id_unique UNIQUE (user_id);

-- Recreate the trigger function with proper error handling
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
  -- Get role and name from metadata, default to tenant (3) if not provided
  role_id_val := COALESCE((NEW.raw_user_meta_data->>'role_id')::INTEGER, 3);
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', split_part(NEW.email, '@', 1));
  
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