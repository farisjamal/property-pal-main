-- Allow property owners to view tenant info for appointments on their properties
CREATE POLICY "Owners can view tenants for their appointments" 
ON public.tenant 
FOR SELECT 
USING (
  tenant_id IN (
    SELECT a.tenant_id 
    FROM public.appointment a
    JOIN public.property_owner po ON a.owner_id = po.owner_id
    WHERE po.user_id = auth.uid()
  )
);