-- Track unique tenant property views for the tenant dashboard "Recently Viewed" widget.
-- Repeat clicks of the same property by the same tenant collapse to a single row via UNIQUE (tenant_id, property_id).

CREATE TABLE IF NOT EXISTS public.property_views (
  view_id BIGSERIAL PRIMARY KEY,
  tenant_id INTEGER NOT NULL REFERENCES public.tenant(tenant_id) ON DELETE CASCADE,
  property_id INTEGER NOT NULL REFERENCES public.property(property_id) ON DELETE CASCADE,
  first_viewed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tenant_id, property_id)
);

CREATE INDEX IF NOT EXISTS idx_property_views_tenant_id ON public.property_views(tenant_id);

ALTER TABLE public.property_views ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Tenants can view own property views" ON public.property_views;
DROP POLICY IF EXISTS "Tenants can record own property views" ON public.property_views;

CREATE POLICY "Tenants can view own property views" ON public.property_views
  FOR SELECT USING (tenant_id = public.get_tenant_id(auth.uid()));

CREATE POLICY "Tenants can record own property views" ON public.property_views
  FOR INSERT WITH CHECK (tenant_id = public.get_tenant_id(auth.uid()));

-- Realtime: dashboards subscribe to live counts via postgres_changes.
-- The supabase_realtime publication exists but is empty; add the tables we subscribe to.
-- IF NOT EXISTS is not supported by ALTER PUBLICATION, so guard via DO block.
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'property_views'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.property_views;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'appointment'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.appointment;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'property'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.property;
  END IF;
END $$;
