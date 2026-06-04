import { supabase } from '@/integrations/supabase/client';
import type { Tables } from '@/integrations/supabase/types';
import { encryptData } from '@/security/encryption';

export type KycStatus = 'not_submitted' | 'pending' | 'approved' | 'rejected';
export type KycDocKind = 'ic_front' | 'ic_back' | 'selfie';

export const KYC_BUCKET = 'kyc-documents';
export const MAX_FILE_BYTES = 5 * 1024 * 1024; // 5 MB
export const ALLOWED_MIME = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];

export type KycSubmissionRow = Tables<'kyc_submission'>;

export const validateKycFile = (file: File): string | null => {
  if (!ALLOWED_MIME.includes(file.type)) {
    return 'Only JPEG, PNG, or WebP images are allowed.';
  }
  if (file.size > MAX_FILE_BYTES) {
    return 'File must be 5 MB or smaller.';
  }
  return null;
};

const buildPath = (userId: string, kind: KycDocKind, ext: string) =>
  `kyc/${userId}/${kind}-${Date.now()}.${ext.toLowerCase()}`;

export const uploadKycDocument = async (
  userId: string,
  kind: KycDocKind,
  file: File,
): Promise<string> => {
  const err = validateKycFile(file);
  if (err) throw new Error(err);

  const ext = file.name.split('.').pop() || 'jpg';
  const path = buildPath(userId, kind, ext);

  const { error } = await supabase.storage
    .from(KYC_BUCKET)
    .upload(path, file, { upsert: false, contentType: file.type });

  if (error) throw new Error(`Upload failed (${kind}): ${error.message}`);
  return path;
};

export const getSignedDocumentUrl = async (path: string, expiresInSeconds = 60) => {
  const { data, error } = await supabase.storage
    .from(KYC_BUCKET)
    .createSignedUrl(path, expiresInSeconds);
  if (error) throw error;
  return data.signedUrl;
};

export interface CreateKycSubmissionInput {
  ownerId: number;
  userId: string;
  fullName: string;
  icNo: string;
  icFrontPath: string;
  icBackPath: string;
  selfiePath: string;
  pdpaConsent: boolean;
}

export const createKycSubmission = async (input: CreateKycSubmissionInput) => {
  if (!input.pdpaConsent) throw new Error('PDPA consent is required.');

  const [fullNameEnc, icNoEnc] = await Promise.all([
    encryptData(input.fullName),
    encryptData(input.icNo),
  ]);

  const { data, error } = await supabase
    .from('kyc_submission')
    .insert({
      owner_id: input.ownerId,
      user_id: input.userId,
      status: 'pending',
      ic_front_path: input.icFrontPath,
      ic_back_path: input.icBackPath,
      selfie_path: input.selfiePath,
      full_name_enc: fullNameEnc,
      ic_no_enc: icNoEnc,
      pdpa_consent_at: new Date().toISOString(),
    })
    .select('id')
    .single();

  if (error) throw error;
  return data;
};

export const getLatestKycSubmissionForOwner = async (
  ownerId: number,
): Promise<KycSubmissionRow | null> => {
  const { data, error } = await supabase
    .from('kyc_submission')
    .select('*')
    .eq('owner_id', ownerId)
    .order('submitted_at', { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    console.error('Failed to fetch KYC submission:', error);
    return null;
  }
  return data;
};

export const getOwnerKycStatus = async (ownerId: number): Promise<KycStatus> => {
  const { data, error } = await supabase
    .from('property_owner')
    .select('kyc_status')
    .eq('owner_id', ownerId)
    .maybeSingle();

  if (error || !data) return 'not_submitted';
  return (data.kyc_status as KycStatus) || 'not_submitted';
};

export const listPendingSubmissions = async () => {
  const { data, error } = await supabase
    .from('kyc_submission')
    .select('*')
    .eq('status', 'pending')
    .order('submitted_at', { ascending: true });
  if (error) throw error;
  return data ?? [];
};

export const listAllSubmissions = async (status?: KycStatus) => {
  let q = supabase
    .from('kyc_submission')
    .select('*')
    .order('submitted_at', { ascending: false });
  if (status && status !== 'not_submitted') q = q.eq('status', status);
  const { data, error } = await q;
  if (error) throw error;
  return data ?? [];
};

export const approveSubmission = async (id: string) => {
  const { error } = await supabase
    .from('kyc_submission')
    .update({ status: 'approved', rejection_reason: null })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw error;
};

export const rejectSubmission = async (id: string, reason: string) => {
  const trimmed = reason.trim();
  if (trimmed.length < 10) throw new Error('Please provide a reason (min 10 characters).');
  const { error } = await supabase
    .from('kyc_submission')
    .update({ status: 'rejected', rejection_reason: trimmed })
    .eq('id', id)
    .eq('status', 'pending');
  if (error) throw error;
};

export const resubmitAllowed = (status: KycStatus) =>
  status === 'rejected' || status === 'not_submitted';
