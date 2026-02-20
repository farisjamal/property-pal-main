/**
 * admin-create-user Edge Function
 *
 * Creates new users via the Supabase Admin API (service_role key)
 * without affecting the calling admin's session.
 *
 * Requires a valid JWT from an admin user (role_id: 1).
 */

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const CORS_HEADERS = {
  'Content-Type': 'application/json',
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

interface CreateUserRequest {
  email: string;
  password: string;
  role_id: number; // 2 = Property Owner, 3 = Tenant
  name: string;
  contact_no?: string | null;
  gender?: string | null;
  ic_no?: string | null;
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 200, headers: CORS_HEADERS });
  }

  try {
    // Verify the calling user is an admin
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
    const supabaseServiceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

    // Verify caller's JWT
    const callerClient = createClient(supabaseUrl, supabaseAnonKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
    });

    const { data: { user: callerUser }, error: authError } = await callerClient.auth.getUser(token);
    if (authError || !callerUser) {
      return new Response(
        JSON.stringify({ error: 'Invalid or expired authentication token' }),
        { status: 401, headers: CORS_HEADERS }
      );
    }

    // Verify the caller has admin role (role_id: 1)
    const { data: roleData, error: roleError } = await callerClient
      .from('user_roles')
      .select('role_id')
      .eq('user_id', callerUser.id)
      .eq('role_id', 1)
      .maybeSingle();

    if (roleError || !roleData) {
      return new Response(
        JSON.stringify({ error: 'Forbidden: admin role required' }),
        { status: 403, headers: CORS_HEADERS }
      );
    }

    // Parse request
    const body: CreateUserRequest = await req.json();

    if (!body.email || !body.password || !body.role_id || !body.name) {
      return new Response(
        JSON.stringify({ error: 'Missing required fields: email, password, role_id, name' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    if (![2, 3].includes(body.role_id)) {
      return new Response(
        JSON.stringify({ error: 'Invalid role_id. Use 2 (Property Owner) or 3 (Tenant)' }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    // Use service_role client to create user without affecting admin session
    const adminClient = createClient(supabaseUrl, supabaseServiceRoleKey);

    // Create auth user via Admin API
    const { data: newAuthUser, error: createError } = await adminClient.auth.admin.createUser({
      email: body.email,
      password: body.password,
      email_confirm: true,
    });

    if (createError) {
      return new Response(
        JSON.stringify({ error: createError.message }),
        { status: 400, headers: CORS_HEADERS }
      );
    }

    const newUserId = newAuthUser.user.id;

    // Create user record
    await adminClient.from('users').insert({
      user_id: newUserId,
      email: body.email,
      role_id: body.role_id,
    });

    // Create user_roles record
    await adminClient.from('user_roles').insert({
      user_id: newUserId,
      role_id: body.role_id,
    });

    // Create role-specific profile
    let profileData: any;
    if (body.role_id === 2) {
      // Property Owner
      const { data, error } = await adminClient
        .from('property_owner')
        .insert({
          user_id: newUserId,
          name: body.name,
          email: body.email,
          contact_no: body.contact_no || null,
          gender: body.gender || null,
          ic_no: body.ic_no || null,
        })
        .select()
        .single();

      if (error) throw error;
      profileData = data;
    } else {
      // Tenant
      const { data, error } = await adminClient
        .from('tenant')
        .insert({
          user_id: newUserId,
          name: body.name,
          email: body.email,
          contact_no: body.contact_no || null,
          gender: body.gender || null,
        })
        .select()
        .single();

      if (error) throw error;
      profileData = data;
    }

    return new Response(
      JSON.stringify({
        user_id: newUserId,
        profile: profileData,
      }),
      { status: 201, headers: CORS_HEADERS }
    );
  } catch (error) {
    console.error('Error creating user:', error);
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Internal server error' }),
      { status: 500, headers: CORS_HEADERS }
    );
  }
});
