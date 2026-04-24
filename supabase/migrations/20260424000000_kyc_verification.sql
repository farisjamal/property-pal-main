-- =============================================================
-- KYC Verification — Property Owner scope
-- =============================================================
-- Adds kyc_status to property_owner, kyc_submission table,
-- storage bucket + policies, state-machine trigger, status mirror trigger,
-- and RLS gating on property inserts until kyc_status = 'approved'.
-- Data-retention policy: documents retained 90 days post-approval
-- (manual purge for FYP; auto-purge out of scope).
-- =============================================================


-- 1. Add kyc_status to property_owner --------------------------
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name   = 'property_owner'
      AND column_name  = 'kyc_status'
  ) THEN
    ALTER TABLE public.property_owner
      ADD COLUMN kyc_status text NOT NULL DEFAULT 'not_submitted'
      CHECK (kyc_status IN ('not_submitted','pending','approved','rejected'));
  END IF;
END $$;


-- 2. kyc_submission table -------------------------------------
CREATE TABLE IF NOT EXISTS public.kyc_submission (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  owner_id          integer NOT NULL REFERENCES public.property_owner(owner_id) ON DELETE CASCADE,
  user_id           uuid    NOT NULL,
  status            text    NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending','approved','rejected')),
  ic_front_path     text    NOT NULL,
  ic_back_path      text    NOT NULL,
  selfie_path       text    NOT NULL,
  full_name_enc     text    NOT NULL,
  ic_no_enc         text    NOT NULL,
  rejection_reason  text,
  pdpa_consent_at   timestamptz NOT NULL,
  submitted_at      timestamptz NOT NULL DEFAULT now(),
  reviewed_at       timestamptz,
  reviewed_by       integer REFERENCES public.admin(admin_id),
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_kyc_submission_owner       ON public.kyc_submission(owner_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submission_user        ON public.kyc_submission(user_id);
CREATE INDEX IF NOT EXISTS idx_kyc_submission_pending     ON public.kyc_submission(status) WHERE status = 'pending';

ALTER TABLE public.kyc_submission ENABLE ROW LEVEL SECURITY;


-- 3. RLS policies ---------------------------------------------
-- Owners: SELECT own rows
DROP POLICY IF EXISTS "Owner reads own kyc submission" ON public.kyc_submission;
CREATE POLICY "Owner reads own kyc submission"
ON public.kyc_submission FOR SELECT
TO authenticated
USING (user_id = auth.uid());

-- Owners: INSERT own rows (server-side encryption assumed done client-side via crypto-service)
DROP POLICY IF EXISTS "Owner inserts own kyc submission" ON public.kyc_submission;
CREATE POLICY "Owner inserts own kyc submission"
ON public.kyc_submission FOR INSERT
TO authenticated
WITH CHECK (
  user_id = auth.uid()
  AND status = 'pending'
);

-- Owners CANNOT update their own submissions (prevents self-approval).
-- Only admin may update status / rejection_reason / reviewed_*.
DROP POLICY IF EXISTS "Admin reads all kyc submissions" ON public.kyc_submission;
CREATE POLICY "Admin reads all kyc submissions"
ON public.kyc_submission FOR SELECT
TO authenticated
USING (public.has_role_id(auth.uid(), 1));

DROP POLICY IF EXISTS "Admin updates kyc decisions" ON public.kyc_submission;
CREATE POLICY "Admin updates kyc decisions"
ON public.kyc_submission FOR UPDATE
TO authenticated
USING (public.has_role_id(auth.uid(), 1))
WITH CHECK (public.has_role_id(auth.uid(), 1));


-- 4. State-machine + status mirror trigger --------------------
CREATE OR REPLACE FUNCTION public.kyc_submission_guard()
RETURNS TRIGGER AS $$
BEGIN
  -- Only allowed transitions: pending -> approved | rejected
  IF TG_OP = 'UPDATE' THEN
    IF OLD.status = 'pending' AND NEW.status NOT IN ('pending','approved','rejected') THEN
      RAISE EXCEPTION 'Invalid KYC status transition from % to %', OLD.status, NEW.status;
    END IF;
    IF OLD.status IN ('approved','rejected') AND NEW.status <> OLD.status THEN
      RAISE EXCEPTION 'KYC submission % is already finalized', OLD.id;
    END IF;
    -- When moving to approved/rejected, stamp reviewer + reviewed_at
    IF NEW.status <> OLD.status AND NEW.status IN ('approved','rejected') THEN
      NEW.reviewed_at := now();
    END IF;
    NEW.updated_at := now();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS kyc_submission_guard_trigger ON public.kyc_submission;
CREATE TRIGGER kyc_submission_guard_trigger
BEFORE UPDATE ON public.kyc_submission
FOR EACH ROW
EXECUTE FUNCTION public.kyc_submission_guard();


-- Mirror: kyc_submission.status -> property_owner.kyc_status
CREATE OR REPLACE FUNCTION public.kyc_mirror_to_property_owner()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.property_owner
       SET kyc_status = 'pending'
     WHERE owner_id = NEW.owner_id;
  ELSIF TG_OP = 'UPDATE' AND NEW.status <> OLD.status THEN
    UPDATE public.property_owner
       SET kyc_status = NEW.status
     WHERE owner_id = NEW.owner_id;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS kyc_mirror_trigger ON public.kyc_submission;
CREATE TRIGGER kyc_mirror_trigger
AFTER INSERT OR UPDATE ON public.kyc_submission
FOR EACH ROW
EXECUTE FUNCTION public.kyc_mirror_to_property_owner();


-- updated_at maintenance
CREATE OR REPLACE FUNCTION public.kyc_set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at := now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS kyc_set_updated_at_trigger ON public.kyc_submission;
CREATE TRIGGER kyc_set_updated_at_trigger
BEFORE INSERT ON public.kyc_submission
FOR EACH ROW
EXECUTE FUNCTION public.kyc_set_updated_at();


-- 5. Block property inserts unless owner KYC approved ---------
-- Trigger-based enforcement (RLS WITH CHECK referencing another table
-- is awkward; a BEFORE INSERT trigger is clearer and authoritative).
CREATE OR REPLACE FUNCTION public.enforce_owner_kyc_on_property()
RETURNS TRIGGER AS $$
DECLARE
  v_status text;
BEGIN
  SELECT kyc_status INTO v_status
  FROM public.property_owner
  WHERE owner_id = NEW.owner_id;

  IF v_status IS NULL OR v_status <> 'approved' THEN
    RAISE EXCEPTION 'Property listing requires approved KYC. Current status: %', COALESCE(v_status,'not_submitted')
      USING ERRCODE = 'check_violation';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS enforce_owner_kyc_on_property_trigger ON public.property;
CREATE TRIGGER enforce_owner_kyc_on_property_trigger
BEFORE INSERT ON public.property
FOR EACH ROW
EXECUTE FUNCTION public.enforce_owner_kyc_on_property();


-- 6. Storage bucket + policies --------------------------------
INSERT INTO storage.buckets (id, name, public)
VALUES ('kyc-documents', 'kyc-documents', false)
ON CONFLICT (id) DO NOTHING;

-- Path convention: kyc/{auth.uid()}/{ic_front|ic_back|selfie}-{timestamp}.{ext}
-- storage.foldername(name) returns an array: {kyc, <uid>, ...}

-- Owner can INSERT into own folder
DROP POLICY IF EXISTS "Owner uploads own kyc docs" ON storage.objects;
CREATE POLICY "Owner uploads own kyc docs"
ON storage.objects FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[1] = 'kyc'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Owner can READ own docs; admin can READ all
DROP POLICY IF EXISTS "Owner or admin reads kyc docs" ON storage.objects;
CREATE POLICY "Owner or admin reads kyc docs"
ON storage.objects FOR SELECT
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (
    (storage.foldername(name))[2] = auth.uid()::text
    OR public.has_role_id(auth.uid(), 1)
  )
);

-- Owner can DELETE own docs only while no approved submission exists
-- (simpler rule: owner delete anytime from own folder; keep for resubmit flows)
DROP POLICY IF EXISTS "Owner deletes own kyc docs" ON storage.objects;
CREATE POLICY "Owner deletes own kyc docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND (storage.foldername(name))[2] = auth.uid()::text
);

-- Admin can DELETE (for retention/purge)
DROP POLICY IF EXISTS "Admin deletes any kyc docs" ON storage.objects;
CREATE POLICY "Admin deletes any kyc docs"
ON storage.objects FOR DELETE
TO authenticated
USING (
  bucket_id = 'kyc-documents'
  AND public.has_role_id(auth.uid(), 1)
);


-- 7. Comment for future maintainers ---------------------------
COMMENT ON TABLE public.kyc_submission IS
  'Property-owner KYC submissions. Retention: 90 days post-approval (manual purge).';
