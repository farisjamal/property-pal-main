-- Secure notifications table
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

-- Remove potentially insecure policies if they exist (based on user request)
DROP POLICY IF EXISTS "System can insert notifications" ON public.notifications;
DROP POLICY IF EXISTS "Service role can insert" ON public.notifications;

-- Restrict INSERT to service_role only (Backend/Edge functions)
CREATE POLICY "Service role can insert" ON public.notifications
  FOR INSERT WITH CHECK (auth.jwt()->>'role' = 'service_role');

-- Secure admin table
ALTER TABLE public.admin ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Block anonymous access" ON public.admin;
DROP POLICY IF EXISTS "Allow authenticated read" ON public.admin;

-- Ensure only authenticated users can read admin data (Blocks anonymous/public access)
CREATE POLICY "Block anonymous access" ON public.admin
  FOR SELECT USING (auth.uid() IS NOT NULL);
