import "server-only";
import { createServerClient } from "@supabase/ssr";
import { createClient as createPlainClient } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { SUPABASE_PUBLISHABLE_KEY, SUPABASE_URL } from "./config";

// Client bound to the visitor's session cookies (Server Components, Server
// Actions and Route Handlers). Create a new one for every request.
export async function createClient() {
  const cookieStore = await cookies();
  return createServerClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) =>
            cookieStore.set(name, value, options),
          );
        } catch {
          // Called from a Server Component, where cookies are read-only;
          // proxy.ts refreshes the session instead.
        }
      },
    },
  });
}

// Admin client with the secret key: bypasses row level security, so it is
// only used on the server for the login log and the /admin page.
export function createAdminClient() {
  return createPlainClient(SUPABASE_URL, process.env.SUPABASE_SECRET_KEY ?? "", {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
