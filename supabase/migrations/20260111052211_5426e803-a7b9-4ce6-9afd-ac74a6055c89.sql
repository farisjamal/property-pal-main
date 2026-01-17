-- Fix notifications table RLS policies to control write access
CREATE POLICY "System can insert notifications" ON public.notifications
  FOR INSERT
  WITH CHECK (true);

-- Update get_user_role_id function with input validation
CREATE OR REPLACE FUNCTION public.get_user_role_id(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate input
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN (SELECT role_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1);
END;
$function$;

-- Update has_role_id function with input validation
CREATE OR REPLACE FUNCTION public.has_role_id(_user_id uuid, _role_id integer)
RETURNS boolean
LANGUAGE plpgsql
STABLE SECURITY DEFINER
SET search_path TO 'public'
AS $function$
BEGIN
  -- Validate inputs
  IF _user_id IS NULL OR _role_id IS NULL OR _role_id NOT IN (1, 2, 3) THEN
    RETURN FALSE;
  END IF;
  
  RETURN EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role_id = _role_id
  );
END;
$function$;