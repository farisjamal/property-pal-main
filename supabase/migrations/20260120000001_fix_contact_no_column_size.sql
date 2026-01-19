-- =====================================================================
-- FIX: contact_no column too small for encrypted data
-- =====================================================================
-- ROOT CAUSE: contact_no is varchar(20) but encrypted data (AES-256 base64)
-- is typically 44-64+ characters
--
-- ERROR: value too long for type character varying(20) (SQLSTATE 22001)
-- =====================================================================

-- Expand contact_no column in all profile tables to accommodate encrypted data
ALTER TABLE public.tenant
  ALTER COLUMN contact_no TYPE TEXT;

ALTER TABLE public.property_owner
  ALTER COLUMN contact_no TYPE TEXT;

ALTER TABLE public.admin
  ALTER COLUMN contact_no TYPE TEXT;

-- Also ensure ic_no is TEXT for encrypted data (checking current state)
-- ic_no is already varchar(50) which might still be too small for encrypted data
ALTER TABLE public.tenant
  ALTER COLUMN ic_no TYPE TEXT;

ALTER TABLE public.property_owner
  ALTER COLUMN ic_no TYPE TEXT;

ALTER TABLE public.admin
  ALTER COLUMN ic_no TYPE TEXT;

-- =====================================================================
-- VERIFICATION
-- =====================================================================
-- After this migration:
-- 1. contact_no and ic_no columns will be TEXT type (unlimited length)
-- 2. Registration should succeed with encrypted data
-- =====================================================================
