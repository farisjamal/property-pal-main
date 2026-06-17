/**
 * rate-limiter Edge Function
 *
 * Server-side rate limiting for login, password reset, and registration.
 * Uses rate_limits table (service_role only) with sliding window.
 *
 * Operations:
 * - check: Returns whether the action is allowed
 * - record: Increments attempt counter
 * - reset: Clears attempts for a key (on successful login)
 */

import { createClient } from "@supabase/supabase-js";

const ALLOWED_ORIGINS = [
  'http://localhost:8080',
  'http://localhost:5173',
  ...(Deno.env.get('PRODUCTION_URL')?.split(',').map((o) => o.trim()).filter(Boolean) ?? []),
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

interface RateLimitRequest {
  operation: 'check' | 'record' | 'reset';
  key: string;
  action: string;         // 'login', 'password_reset', 'registration'
  limit?: number;         // max attempts (default: 5)
  window_seconds?: number; // sliding window (default: 300 = 5 min)
}

Deno.serve(async (req) => {
  const CORS_HEADERS = getCorsHeaders(req);

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {
    const supabaseUrl = Deno.env.get('SUPABASE_URL') ?? '';
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    const body: RateLimitRequest = await req.json();
    const { operation, key, action } = body;
    const limit = body.limit ?? 5;
    const windowSeconds = body.window_seconds ?? 300;

    if (!operation || !key || !action) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: operation, key, action' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const windowStart = new Date(Date.now() - windowSeconds * 1000).toISOString();

    if (operation === 'check') {
      // Count attempts within the sliding window
      const { data, error } = await adminClient
        .from('rate_limits')
        .select('attempts')
        .eq('key', key)
        .eq('action', action)
        .gte('window_start', windowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;

      const attempts = data?.attempts ?? 0;
      const allowed = attempts < limit;
      const remaining = Math.max(0, limit - attempts);

      return new Response(
        JSON.stringify({ allowed, remaining, attempts, limit }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    if (operation === 'record') {
      // Check if there's an existing record in the current window
      const { data: existing, error: fetchError } = await adminClient
        .from('rate_limits')
        .select('id, attempts')
        .eq('key', key)
        .eq('action', action)
        .gte('window_start', windowStart)
        .order('window_start', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (fetchError) throw fetchError;

      if (existing) {
        // Increment existing record
        const { error: updateError } = await adminClient
          .from('rate_limits')
          .update({ attempts: existing.attempts + 1 })
          .eq('id', existing.id);

        if (updateError) throw updateError;

        return new Response(
          JSON.stringify({ recorded: true, attempts: existing.attempts + 1 }),
          { status: 200, headers: CORS_HEADERS }
        );
      } else {
        // Create new record
        const { error: insertError } = await adminClient
          .from('rate_limits')
          .insert({ key, action, attempts: 1, window_start: new Date().toISOString() });

        if (insertError) throw insertError;

        return new Response(
          JSON.stringify({ recorded: true, attempts: 1 }),
          { status: 200, headers: CORS_HEADERS }
        );
      }
    }

    if (operation === 'reset') {
      // Clear all records for this key+action (on successful login)
      const { error: deleteError } = await adminClient
        .from('rate_limits')
        .delete()
        .eq('key', key)
        .eq('action', action);

      if (deleteError) throw deleteError;

      return new Response(
        JSON.stringify({ reset: true }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({ error: 'Invalid operation. Use: check, record, reset' }),
      { status: 400, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Rate limiter error:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
