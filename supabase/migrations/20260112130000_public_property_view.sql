-- Allow anyone (authenticated or anonymous) to view properties
-- This is required for the Landing Page to display "Featured Properties" without login.

CREATE POLICY "Public can view properties" ON public.property
  FOR SELECT USING (true);
