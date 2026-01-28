import { createClient, SupabaseClient } from '@supabase/supabase-js';

type SupabaseAdminClient = SupabaseClient;

export function getSupabaseAdmin(): SupabaseAdminClient {
  const supabaseUrl = process.env.SUPABASE_URL;
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error('Supabase credentials are missing');
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
