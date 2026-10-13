import "server-only";
import type { User } from "@supabase/supabase-js";
import { headers } from "next/headers";
import { emailAdmin } from "./notify";
import { createAdminClient } from "./supabase/server";

// Vercel adds the visitor's approximate location to every request.
async function visitorLocation() {
  const h = await headers();
  const decode = (v: string | null) => {
    if (!v) return null;
    try {
      return decodeURIComponent(v);
    } catch {
      return v;
    }
  };
  return {
    country: decode(h.get("x-vercel-ip-country")),
    region: decode(h.get("x-vercel-ip-country-region")),
    city: decode(h.get("x-vercel-ip-city")),
    user_agent: h.get("user-agent"),
  };
}

function displayName(user: User): string | null {
  const meta = user.user_metadata ?? {};
  return (meta.full_name as string) || (meta.name as string) || null;
}

// Saves one row per sign-in and, the first time a person signs in, emails the
// admin. Errors are logged and swallowed so a logging problem never blocks
// someone from signing in.
export async function trackLogin(user: User) {
  try {
    const db = createAdminClient();
    const where = await visitorLocation();
    // One account can have several sign-in methods (same email via password
    // and Google); the identity used most recently is the one used now.
    const latest = [...(user.identities ?? [])].sort(
      (a, b) => Date.parse(b.last_sign_in_at ?? "") - Date.parse(a.last_sign_in_at ?? ""),
    )[0];
    const provider = latest?.provider ?? (user.app_metadata?.provider as string) ?? "email";
    const providers = (user.app_metadata?.providers as string[] | undefined) ?? [provider];
    const now = new Date().toISOString();

    const { data: existing } = await db
      .from("profiles")
      .select("id, login_count, name")
      .eq("id", user.id)
      .maybeSingle();

    const profile = {
      id: user.id,
      email: user.email ?? null,
      // Keep the name given at sign-up; Google would overwrite it with its own.
      name: existing?.name ?? displayName(user),
      provider: providers.join(", "),
      country: where.country,
      region: where.region,
      city: where.city,
      last_login_at: now,
      login_count: (existing?.login_count ?? 0) + 1,
    };

    // created_at is filled by the database default on the first insert only.
    await db.from("profiles").upsert(profile);
    await db.from("logins").insert({
      user_id: user.id,
      email: user.email ?? null,
      provider,
      ...where,
    });

    if (!existing) await notifyNewAccount(profile);
  } catch (err) {
    console.error("trackLogin failed", err);
  }
}

async function notifyNewAccount(p: {
  email: string | null;
  name: string | null;
  provider: string;
  country: string | null;
  region: string | null;
  city: string | null;
}) {
  const place = [p.city, p.region, p.country].filter(Boolean).join(", ") || "unknown";
  await emailAdmin(`New M2 Canada account: ${p.email ?? p.name ?? "unknown"}`, [
    `Name: ${p.name ?? "-"}`,
    `Email: ${p.email ?? "-"}`,
    `Signed up with: ${p.provider}`,
    `Location: ${place}`,
    `Date: ${new Date().toUTCString()}`,
    "",
    "All users: https://m2canada.ca/admin",
  ]);
}
