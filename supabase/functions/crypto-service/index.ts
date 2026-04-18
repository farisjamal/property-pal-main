/**
 * crypto-service Edge Function
 *
 * Server-side AES-256-GCM encryption/decryption service using Web Crypto API.
 * The encryption key is stored as an Edge Function secret (ENCRYPTION_KEY)
 * and never exposed to the client.
 *
 * Supports three operations:
 * - encrypt: Encrypts plaintext string to {ciphertext, iv} JSON
 * - decrypt: Decrypts {ciphertext, iv} JSON to plaintext string
 * - batch_decrypt: Decrypts multiple ciphertexts in parallel (max 50)
 */

import { createClient } from "@supabase/supabase-js";

// Allowed origins for CORS
const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  ...(Deno.env.get('PRODUCTION_URL') ? [Deno.env.get('PRODUCTION_URL')!] : []),
];

function getCorsHeaders(req: Request) {
  const origin = req.headers.get('Origin') ?? '';
  const allowedOrigin = ALLOWED_ORIGINS.includes(origin) ? origin : ALLOWED_ORIGINS[0];
  return {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': allowedOrigin,
    'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  };
}

interface EncryptRequest {
  action: 'encrypt';
  data: string;
}

interface DecryptRequest {
  action: 'decrypt';
  data: string;
}

interface BatchDecryptRequest {
  action: 'batch_decrypt';
  data: (string | null)[];
}

type CryptoRequest = EncryptRequest | DecryptRequest | BatchDecryptRequest;

/**
 * Derives a CryptoKey from the ENCRYPTION_KEY environment variable.
 * Uses AES-GCM with 256-bit key.
 */
async function getCryptoKey(): Promise<CryptoKey> {
  const keyString = Deno.env.get('ENCRYPTION_KEY');

  if (!keyString) {
    throw new Error('ENCRYPTION_KEY environment variable is not set');
  }

  // Normalize key to exactly 32 bytes (256 bits)
  const normalized = keyString.padEnd(32, '0').slice(0, 32);
  const keyData = new TextEncoder().encode(normalized);

  return await crypto.subtle.importKey(
    'raw',
    keyData,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt']
  );
}

/**
 * Encrypts plaintext using AES-256-GCM with random IV.
 * Returns JSON string containing {ciphertext, iv} in base64.
 */
async function encryptData(plaintext: string, key: CryptoKey): Promise<string> {
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const encodedData = new TextEncoder().encode(plaintext);

  const encryptedBuffer = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv },
    key,
    encodedData
  );

  const encrypted = new Uint8Array(encryptedBuffer);

  // Convert to base64 for storage
  const ciphertextBase64 = btoa(String.fromCharCode(...encrypted));
  const ivBase64 = btoa(String.fromCharCode(...iv));

  // Return JSON string for TEXT column storage
  return JSON.stringify({
    ciphertext: ciphertextBase64,
    iv: ivBase64,
  });
}

/**
 * Decrypts {ciphertext, iv} JSON string using AES-256-GCM.
 * Returns plaintext string or null on failure.
 */
async function decryptData(ciphertextJson: string, key: CryptoKey): Promise<string | null> {
  try {
    const { ciphertext, iv } = JSON.parse(ciphertextJson);

    // Decode base64 to Uint8Array
    const ciphertextBytes = Uint8Array.from(atob(ciphertext), c => c.charCodeAt(0));
    const ivBytes = Uint8Array.from(atob(iv), c => c.charCodeAt(0));

    const decryptedBuffer = await crypto.subtle.decrypt(
      { name: 'AES-GCM', iv: ivBytes },
      key,
      ciphertextBytes
    );

    return new TextDecoder().decode(decryptedBuffer);
  } catch (error) {
    console.error('Decryption failed:', error);
    return null;
  }
}

/**
 * Batch decrypts multiple ciphertext values in parallel.
 * Returns array with plaintext or null for each item.
 */
async function batchDecryptData(
  ciphertexts: (string | null)[],
  key: CryptoKey
): Promise<(string | null)[]> {
  if (ciphertexts.length > 50) {
    throw new Error('Batch size exceeds maximum of 50 items');
  }

  return await Promise.all(
    ciphertexts.map(async (item) => {
      if (!item) return null;
      return await decryptData(item, key);
    })
  );
}

/**
 * Main request handler using modern Deno.serve pattern.
 */
Deno.serve(async (req) => {
  const CORS_HEADERS = getCorsHeaders(req);

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      status: 200,
      headers: CORS_HEADERS,
    });
  }

  try {
    // Parse request body first so we can check the action
    const body: CryptoRequest = await req.json();

    if (!body.action) {
      return new Response(
        JSON.stringify({ error: 'Missing action field' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (body.data === undefined || body.data === null) {
      return new Response(
        JSON.stringify({ error: 'Missing data field' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // decrypt and batch_decrypt expose sensitive data — require a valid JWT.
    // encrypt is allowed unauthenticated (needed during registration before session exists).
    if (body.action === 'decrypt' || body.action === 'batch_decrypt') {
      const authHeader = req.headers.get('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return new Response(
          JSON.stringify({ error: 'Missing or invalid Authorization header' }),
          { status: 401, headers: CORS_HEADERS }
        );
      }

      const token = authHeader.replace('Bearer ', '');
      const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
      const supabaseAnonKey = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

      const supabase = createClient(supabaseUrl, supabaseAnonKey, {
        global: { headers: { Authorization: `Bearer ${token}` } },
      });

      const { data: { user }, error: authError } = await supabase.auth.getUser(token);
      if (authError || !user) {
        return new Response(
          JSON.stringify({ error: 'Invalid or expired authentication token' }),
          { status: 401, headers: CORS_HEADERS }
        );
      }
    }

    // Get crypto key
    const key = await getCryptoKey();

    // Handle different actions
    switch (body.action) {
      case 'encrypt': {
        if (typeof body.data !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Encrypt action requires string data' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        const encrypted = await encryptData(body.data, key);
        return new Response(encrypted, {
          status: 200,
          headers: CORS_HEADERS,
        });
      }

      case 'decrypt': {
        if (typeof body.data !== 'string') {
          return new Response(
            JSON.stringify({ error: 'Decrypt action requires string data' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        const decrypted = await decryptData(body.data, key);
        return new Response(
          JSON.stringify({ data: decrypted }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      case 'batch_decrypt': {
        if (!Array.isArray(body.data)) {
          return new Response(
            JSON.stringify({ error: 'Batch decrypt action requires array data' }),
            { status: 400, headers: CORS_HEADERS }
          );
        }
        const decrypted = await batchDecryptData(body.data, key);
        return new Response(
          JSON.stringify({ data: decrypted }),
          { status: 200, headers: CORS_HEADERS }
        );
      }

      default:
        return new Response(
          JSON.stringify({ error: 'Invalid action. Use encrypt, decrypt, or batch_decrypt' }),
          { status: 400, headers: CORS_HEADERS }
        );
    }
  } catch (error) {
    console.error('Error processing request:', error);

    // Handle specific errors
    if (error instanceof Error && error.message.includes('ENCRYPTION_KEY')) {
      return new Response(
        JSON.stringify({ error: 'Server configuration error: Encryption key not set' }),
        { status: 500, headers: CORS_HEADERS }
      );
    }

    if (error instanceof Error && error.message.includes('Batch size exceeds')) {
      return new Response(
        JSON.stringify({ error: error.message }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
