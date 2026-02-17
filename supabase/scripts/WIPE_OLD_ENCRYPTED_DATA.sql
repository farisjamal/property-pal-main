-- Wipe old CryptoJS-encrypted data from database
-- This is necessary because the old CryptoJS encryption format is incompatible
-- with the new Web Crypto API AES-GCM format used by the Edge Function.
--
-- SAFETY: All existing data is test data (confirmed by user)
--
-- Execute this via Supabase SQL Editor:
-- 1. Go to Supabase Dashboard → SQL Editor
-- 2. Paste and run this script
-- 3. Confirm success message

-- Clear encrypted contact and IC data from all role tables
UPDATE tenant SET contact_no = NULL, ic_no = NULL;
UPDATE property_owner SET contact_no = NULL, ic_no = NULL;
UPDATE admin SET contact_no = NULL, ic_no = NULL;

-- Verify wipe
SELECT
  'tenant' as table_name,
  COUNT(*) as total_rows,
  COUNT(contact_no) as encrypted_contact_count,
  COUNT(ic_no) as encrypted_ic_count
FROM tenant
UNION ALL
SELECT
  'property_owner' as table_name,
  COUNT(*) as total_rows,
  COUNT(contact_no) as encrypted_contact_count,
  COUNT(ic_no) as encrypted_ic_count
FROM property_owner
UNION ALL
SELECT
  'admin' as table_name,
  COUNT(*) as total_rows,
  COUNT(contact_no) as encrypted_contact_count,
  COUNT(ic_no) as encrypted_ic_count
FROM admin;

-- Expected result: encrypted_contact_count and encrypted_ic_count should all be 0
