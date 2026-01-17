-- Create security definer function to get tenant_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_tenant_id(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN (SELECT tenant_id FROM public.tenant WHERE user_id = _user_id LIMIT 1);
END;
$$;

-- Create security definer function to get owner_id without RLS recursion
CREATE OR REPLACE FUNCTION public.get_owner_id(_user_id uuid)
RETURNS integer
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF _user_id IS NULL THEN
    RETURN NULL;
  END IF;
  
  RETURN (SELECT owner_id FROM public.property_owner WHERE user_id = _user_id LIMIT 1);
END;
$$;

-- Drop and recreate tenant policies to use the function
DROP POLICY IF EXISTS "Tenants can view own profile" ON public.tenant;
DROP POLICY IF EXISTS "Tenants can update own profile" ON public.tenant;

CREATE POLICY "Tenants can view own profile" ON public.tenant
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY "Tenants can update own profile" ON public.tenant
  FOR UPDATE USING (user_id = auth.uid()) WITH CHECK (user_id = auth.uid());

-- Drop and recreate favorites policies to use the security definer function
DROP POLICY IF EXISTS "Tenants can view own favorites" ON public.favorites;
DROP POLICY IF EXISTS "Tenants can add favorites" ON public.favorites;
DROP POLICY IF EXISTS "Tenants can remove own favorites" ON public.favorites;

CREATE POLICY "Tenants can view own favorites" ON public.favorites
  FOR SELECT USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Tenants can add favorites" ON public.favorites
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Tenants can remove own favorites" ON public.favorites
  FOR DELETE USING (tenant_id = public.get_tenant_id(auth.uid()));

-- Drop and recreate appointment policies to use the security definer functions
DROP POLICY IF EXISTS "Tenants can view and create their appointments" ON public.appointment;
DROP POLICY IF EXISTS "Owners can manage appointments for their properties" ON public.appointment;

CREATE POLICY "Tenants can view and create their appointments" ON public.appointment
  FOR ALL USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Owners can manage appointments for their properties" ON public.appointment
  FOR ALL USING (owner_id = public.get_owner_id(auth.uid()));

-- Drop and recreate property owner policies to use direct auth.uid() comparison
DROP POLICY IF EXISTS "Owners can manage their properties" ON public.property;

CREATE POLICY "Owners can manage their properties" ON public.property
  FOR ALL USING (owner_id = public.get_owner_id(auth.uid()));