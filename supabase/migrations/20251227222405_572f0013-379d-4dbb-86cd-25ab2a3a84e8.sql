-- Create favorites table for tenant property bookmarks
CREATE TABLE public.favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id INTEGER NOT NULL REFERENCES public.tenant(tenant_id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES public.property(property_id) ON DELETE CASCADE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(tenant_id, property_id)
);

-- Create indexes for performance
CREATE INDEX idx_favorites_tenant_id ON public.favorites(tenant_id);
CREATE INDEX idx_favorites_property_id ON public.favorites(property_id);

-- Enable Row Level Security
ALTER TABLE public.favorites ENABLE ROW LEVEL SECURITY;

-- Tenants can view their own favorites
CREATE POLICY "Tenants can view own favorites" 
ON public.favorites 
FOR SELECT 
USING (tenant_id = (
  SELECT t.tenant_id FROM public.tenant t WHERE t.user_id = auth.uid()
));

-- Tenants can add favorites
CREATE POLICY "Tenants can add favorites" 
ON public.favorites 
FOR INSERT 
WITH CHECK (tenant_id = (
  SELECT t.tenant_id FROM public.tenant t WHERE t.user_id = auth.uid()
));

-- Tenants can remove their own favorites
CREATE POLICY "Tenants can remove own favorites" 
ON public.favorites 
FOR DELETE 
USING (tenant_id = (
  SELECT t.tenant_id FROM public.tenant t WHERE t.user_id = auth.uid()
));