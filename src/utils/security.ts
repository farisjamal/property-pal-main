import { supabase } from '@/integrations/supabase/client';
import bcrypt from 'bcryptjs';

/**
 * Encrypts sensitive data via server-side Edge Function (AES-256-GCM).
 * The encryption key never leaves the server.
 */
export const encryptData = async (text: string): Promise<string> => {
  if (!text) return '';

  const MAX_RETRIES = 3;
  let lastError: any;

  for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
    const { data, error } = await supabase.functions.invoke('crypto-service', {
      body: { action: 'encrypt', data: text }
    });

    if (!error) {
      // data may be an object {ciphertext, iv} (parsed JSON) or a string – normalise to string
      if (typeof data === 'object' && data !== null) {
        return JSON.stringify(data);
      }
      return data as string;
    }

    lastError = error;
    console.warn(`Encryption attempt ${attempt} failed:`, error);

    if (attempt < MAX_RETRIES) {
      // Wait before retrying (500 ms, 1 s)
      await new Promise(res => setTimeout(res, attempt * 500));
    }
  }

  console.error('Encryption failed after retries:', lastError);
  throw new Error('Encryption service is temporarily unavailable. Please try again in a moment.');
};

/**
 * Decrypts AES-GCM ciphertext via server-side Edge Function.
 */
export const decryptData = async (ciphertext: string): Promise<string> => {
  if (!ciphertext) return '';
  try {
    const { data, error } = await supabase.functions.invoke('crypto-service', {
      body: { action: 'decrypt', data: ciphertext }
    });
    if (error) {
      console.error('Decryption failed:', error);
      return '';
    }
    return data?.data || '';
  } catch (error) {
    console.error('Decryption failed:', error);
    return '';
  }
};

/**
 * Batch decrypt multiple ciphertext values in a single request.
 * More efficient for profile pages that load multiple encrypted fields.
 */
export const batchDecrypt = async (ciphertexts: (string | null)[]): Promise<(string | null)[]> => {
  const items = ciphertexts.map(c => c || null);
  if (items.every(i => !i)) return items.map(() => null);

  try {
    const { data, error } = await supabase.functions.invoke('crypto-service', {
      body: { action: 'batch_decrypt', data: items }
    });
    if (error) {
      console.error('Batch decryption failed:', error);
      return items.map(() => null);
    }
    return data?.data || items.map(() => null);
  } catch (error) {
    console.error('Batch decryption failed:', error);
    return items.map(() => null);
  }
};

/**
 * Hashes a Security PIN using Bcrypt.
 * Uses a salt cost of 10.
 * The resulting hash is irreversible.
 */
export const hashPin = async (pin: string): Promise<string> => {
  if (!pin) return '';
  const salt = await bcrypt.genSalt(10);
  return bcrypt.hash(pin, salt);
};
