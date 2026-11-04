import { createClient } from "@supabase/supabase-js";

// This client only ever runs on the server with the service key, so none of
// the browser session machinery (token refresh timers, storage, URL parsing)
// is wanted. Turning it off keeps a cold start lighter.
export const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SECRET_KEY!,
  {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
      detectSessionInUrl: false,
    },
  }
);
