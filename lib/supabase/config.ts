// Supabase settings come from environment variables (Vercel → Settings →
// Environment Variables, or .env.local for local development).
export const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
export const SUPABASE_PUBLISHABLE_KEY =
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "";

// Until Supabase is configured the site stays open, so a missing variable
// never locks everyone out.
export const authEnabled = SUPABASE_URL !== "" && SUPABASE_PUBLISHABLE_KEY !== "";

// The only account that can open /admin and the address that gets the
// "new account" emails.
export const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
