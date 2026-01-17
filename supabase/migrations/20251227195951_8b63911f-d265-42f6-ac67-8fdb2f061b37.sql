-- Enable RLS on all tables
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.property_owner ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.tenant ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Create user_roles table for proper RBAC (as per security requirements)
CREATE TABLE IF NOT EXISTS public.user_roles (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  role_id INTEGER REFERENCES public.roles(role_id) NOT NULL,
  UNIQUE (user_id, role_id)
);

ALTER TABLE public.user_roles ENABLE ROW LEVEL SECURITY;

-- Security definer function to check user role (prevents recursive RLS)
CREATE OR REPLACE FUNCTION public.get_user_role_id(_user_id UUID)
RETURNS INTEGER
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role_id FROM public.user_roles WHERE user_id = _user_id LIMIT 1
$$;

-- Function to check if user has specific role
CREATE OR REPLACE FUNCTION public.has_role_id(_user_id UUID, _role_id INTEGER)
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.user_roles
    WHERE user_id = _user_id AND role_id = _role_id
  )
$$;

-- RLS Policies for roles (public read)
CREATE POLICY "Roles are publicly readable"
ON public.roles FOR SELECT
TO authenticated
USING (true);

-- RLS Policies for user_roles
CREATE POLICY "Users can view their own role"
ON public.user_roles FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Service role can manage user_roles"
ON public.user_roles FOR ALL
TO service_role
USING (true);

-- RLS Policies for users table
CREATE POLICY "Users can view own record"
ON public.users FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all users"
ON public.users FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

CREATE POLICY "Admins can manage users"
ON public.users FOR ALL
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- RLS Policies for admin table
CREATE POLICY "Admins can view admin profiles"
ON public.admin FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

CREATE POLICY "Admin can view own profile"
ON public.admin FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- RLS Policies for property_owner table
CREATE POLICY "Owners can view own profile"
ON public.property_owner FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all owners"
ON public.property_owner FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

CREATE POLICY "Admins can manage owners"
ON public.property_owner FOR ALL
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- RLS Policies for tenant table
CREATE POLICY "Tenants can view own profile"
ON public.tenant FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE POLICY "Admins can view all tenants"
ON public.tenant FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

CREATE POLICY "Admins can manage tenants"
ON public.tenant FOR ALL
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- Update property RLS to include admin access
DROP POLICY IF EXISTS owner_properties_policy ON public.property;

CREATE POLICY "Owners can manage their properties"
ON public.property FOR ALL
TO authenticated
USING (owner_id = (
  SELECT po.owner_id FROM property_owner po WHERE po.user_id = auth.uid()
));

CREATE POLICY "Tenants can view available properties"
ON public.property FOR SELECT
TO authenticated
USING (availability_status = 'Available');

CREATE POLICY "Admins can manage all properties"
ON public.property FOR ALL
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- Update appointment RLS policies
DROP POLICY IF EXISTS owner_appointments_policy ON public.appointment;
DROP POLICY IF EXISTS tenant_appointments_policy ON public.appointment;

CREATE POLICY "Owners can manage appointments for their properties"
ON public.appointment FOR ALL
TO authenticated
USING (owner_id = (
  SELECT po.owner_id FROM property_owner po WHERE po.user_id = auth.uid()
));

CREATE POLICY "Tenants can view and create their appointments"
ON public.appointment FOR ALL
TO authenticated
USING (tenant_id = (
  SELECT t.tenant_id FROM tenant t WHERE t.user_id = auth.uid()
));

CREATE POLICY "Admins can manage all appointments"
ON public.appointment FOR ALL
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- RLS Policies for notifications
CREATE POLICY "Admins can view all notifications"
ON public.notifications FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

-- Insert default roles if not exists
INSERT INTO public.roles (role_id, role) VALUES
  (1, 'Administrator'),
  (2, 'Property Owner'),
  (3, 'Tenant')
ON CONFLICT (role_id) DO NOTHING;