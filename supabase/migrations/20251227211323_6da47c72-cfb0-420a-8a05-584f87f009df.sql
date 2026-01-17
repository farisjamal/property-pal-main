-- Create storage bucket for property photos
INSERT INTO storage.buckets (id, name, public)
VALUES ('property-photos', 'property-photos', true)
ON CONFLICT (id) DO NOTHING;

-- Create RLS policies for property photos bucket
CREATE POLICY "Property owners can upload photos"
ON storage.objects FOR INSERT
WITH CHECK (
  bucket_id = 'property-photos' 
  AND auth.uid() IS NOT NULL
  AND EXISTS (
    SELECT 1 FROM property_owner po
    WHERE po.user_id = auth.uid()
  )
);

CREATE POLICY "Anyone can view property photos"
ON storage.objects FOR SELECT
USING (bucket_id = 'property-photos');

CREATE POLICY "Property owners can delete their photos"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'property-photos' 
  AND auth.uid() IS NOT NULL
);

-- Add images column to property table
ALTER TABLE property ADD COLUMN IF NOT EXISTS images TEXT[] DEFAULT '{}';
