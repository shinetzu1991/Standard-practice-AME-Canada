import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { ADMIN_EMAIL, authEnabled } from "@/lib/supabase/config";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Users", robots: { index: false } };

type Profile = {
  id: string;
  email: string | null;
  name: string | null;
  provider: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
  last_login_at: string;
  login_count: number;
};

type Login = {
  id: number;
  email: string | null;
  provider: string | null;
  country: string | null;
  region: string | null;
  city: string | null;
  created_at: string;
};

const countryNames = new Intl.DisplayNames(["en"], { type: "region" });
function countryName(code: string | null) {
  if (!code) return "—";
  try {
    return countryNames.of(code) ?? code;
  } catch {
    return code;
  }
}
function place(r: { city: string | null; region: string | null; country: string | null }) {
  const local = [r.city, r.region].filter(Boolean).join(", ");
  return local ? `${local} · ${countryName(r.country)}` : countryName(r.country);
}
function when(iso: string) {
  return new Date(iso).toLocaleString("en-CA", {
    timeZone: "America/Toronto",
    dateStyle: "medium",
    timeStyle: "short",
  });
}

const TH = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const TD = "px-3 py-2 align-top";

export default async function AdminPage() {
  await connection(); // always render per request, never from a build-time copy
  if (!authEnabled) notFound();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email || data.user.email.toLowerCase() !== ADMIN_EMAIL) notFound();

  const db = createAdminClient();
  const [{ data: profiles }, { data: logins }] = await Promise.all([
    db.from("profiles").select("*").order("created_at", { ascending: false }),
    db.from("logins").select("*").order("created_at", { ascending: false }).limit(200),
  ]);
  const users = (profiles ?? []) as Profile[];
  const recent = (logins ?? []) as Login[];

  const byCountry = new Map<string, number>();
  for (const u of users) {
    const key = countryName(u.country);
    byCountry.set(key, (byCountry.get(key) ?? 0) + 1);
  }
  const countries = [...byCountry.entries()].sort((a, b) => b[1] - a[1]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-3 py-6 text-slate-900 sm:px-6 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Admin
            </p>
            <h1 className="text-3xl font-extrabold">Users</h1>
          </div>
          <Link href="/" className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
            ← Back to the app
          </Link>
        </div>

        <div className="grid gap-3 sm:grid-cols-3">
          <Stat label="Accounts" value={users.length} />
          <Stat
            label="New in the last 7 days"
            value={users.filter((u) => Date.now() - Date.parse(u.created_at) < 7 * 864e5).length}
          />
          <Stat label="Countries" value={countries.length} />
        </div>

        {countries.length > 0 && (
          <section className="rounded-2xl bg-white/90 p-4 ring-1 ring-blue-200 dark:bg-slate-900/90 dark:ring-slate-700">
            <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              Accounts by country
            </h2>
            <div className="flex flex-wrap gap-2">
              {countries.map(([name, n]) => (
                <span key={name} className="rounded-full bg-blue-50 px-3 py-1 text-sm ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-600">
                  {name} <b>{n}</b>
                </span>
              ))}
            </div>
          </section>
        )}

        <Table title={`All accounts (${users.length})`}>
          <thead>
            <tr>
              <th className={TH}>Name</th>
              <th className={TH}>Email</th>
              <th className={TH}>With</th>
              <th className={TH}>Location (last login)</th>
              <th className={TH}>Signed up</th>
              <th className={TH}>Last login</th>
              <th className={TH}>Logins</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 dark:divide-slate-800">
            {users.map((u) => (
              <tr key={u.id}>
                <td className={TD}>{u.name ?? "—"}</td>
                <td className={TD}>{u.email ?? "—"}</td>
                <td className={TD}>{u.provider ?? "—"}</td>
                <td className={TD}>{place(u)}</td>
                <td className={`${TD} whitespace-nowrap`}>{when(u.created_at)}</td>
                <td className={`${TD} whitespace-nowrap`}>{when(u.last_login_at)}</td>
                <td className={`${TD} text-right tabular-nums`}>{u.login_count}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <Table title="Recent logins (last 200)">
          <thead>
            <tr>
              <th className={TH}>When</th>
              <th className={TH}>Email</th>
              <th className={TH}>With</th>
              <th className={TH}>Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 dark:divide-slate-800">
            {recent.map((l) => (
              <tr key={l.id}>
                <td className={`${TD} whitespace-nowrap`}>{when(l.created_at)}</td>
                <td className={TD}>{l.email ?? "—"}</td>
                <td className={TD}>{l.provider ?? "—"}</td>
                <td className={TD}>{place(l)}</td>
              </tr>
            ))}
          </tbody>
        </Table>

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Times in Eastern time. Visitors who never sign in only appear in Vercel Analytics
          (Vercel dashboard → Analytics), which shows visits by country.
        </p>
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-2xl bg-white/90 p-4 ring-1 ring-blue-200 dark:bg-slate-900/90 dark:ring-slate-700">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Table({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="rounded-2xl bg-white/90 p-4 ring-1 ring-blue-200 dark:bg-slate-900/90 dark:ring-slate-700">
      <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">{title}</h2>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">{children}</table>
      </div>
    </section>
  );
}
