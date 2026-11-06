import { createClient } from "@supabase/supabase-js";

// This client only ever runs on the server with the service key, so none of
// the browser session machinery (token refresh timers, storage, URL parsing)
// is wanted. Turning it off keeps a cold start lighter.
const supabaseUrl = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_SECRET_KEY ?? process.env.SUPABASE_SERVICE_ROLE_KEY;

export const supabaseAdmin = createClient(
  supabaseUrl!,
  supabaseKey!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
