-- Allow tenants to update their own profile
CREATE POLICY "Tenants can update own profile" 
ON tenant 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

-- Allow owners to update their own profile
CREATE POLICY "Owners can update own profile" 
ON property_owner 
FOR UPDATE 
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());
