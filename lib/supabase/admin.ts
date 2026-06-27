import { createClient } from "@supabase/supabase-js";

// Service-role Supabase client for trusted server-only code (the Whop webhook).
// Bypasses RLS and is authorized to call service_role-only RPCs such as
// fulfill_credit_order. NEVER import this from client components or expose the
// key — it must only ever run on the server.
export function createAdminClient() {
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!key) throw new Error("SUPABASE_SERVICE_ROLE_KEY is not set");
  return createClient(process.env.NEXT_PUBLIC_SUPABASE_URL!, key, {
    auth: { autoRefreshToken: false, persistSession: false },
  });
}
