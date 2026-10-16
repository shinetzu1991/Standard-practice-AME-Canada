import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { connection } from "next/server";
import { canEmailUsers } from "@/lib/notify";
import { SECTION_LABELS, isCategory } from "@/lib/sections";
import { ADMIN_EMAIL, authEnabled } from "@/lib/supabase/config";
import { createAdminClient, createClient } from "@/lib/supabase/server";
import {
  hideQuestion,
  reopenReport,
  reopenSubmission,
  replyToReport,
  resolveReport,
  reviewSubmission,
  unhideQuestion,
} from "./actions";

export const metadata: Metadata = { title: "Admin", robots: { index: false } };

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

type Submission = {
  id: number;
  email: string | null;
  name: string | null;
  category: string;
  topic: string | null;
  question: string;
  options: string[];
  correct: number;
  explanation: string | null;
  source: string | null;
  status: "pending" | "approved" | "rejected";
  admin_note: string | null;
  created_at: string;
  reviewed_at: string | null;
};

type Report = {
  id: number;
  email: string | null;
  category: string;
  question: string;
  reason: string;
  message: string | null;
  status: "open" | "resolved";
  reply: string | null;
  replied_at: string | null;
  created_at: string;
};

type Hidden = { question: string; category: string; reason: string | null; created_at: string };

const TABS = [
  { key: "users", label: "Users" },
  { key: "submissions", label: "Submitted questions" },
  { key: "reports", label: "Reports" },
  { key: "hidden", label: "Hidden questions" },
] as const;
type Tab = (typeof TABS)[number]["key"];

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
const section = (c: string) => (isCategory(c) ? SECTION_LABELS[c] : c);

const TH = "px-3 py-2 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500 dark:text-slate-400";
const TD = "px-3 py-2 align-top";
const CARD = "rounded-2xl bg-white/90 p-4 ring-1 ring-blue-200 dark:bg-slate-900/90 dark:ring-slate-700";
const BTN = "rounded-lg px-3 py-1.5 text-xs font-semibold transition";
const BTN_OK = `${BTN} bg-emerald-600 text-white hover:bg-emerald-700`;
const BTN_NO = `${BTN} bg-rose-600 text-white hover:bg-rose-700`;
const BTN_SOFT = `${BTN} bg-blue-50 text-blue-800 ring-1 ring-blue-200 hover:bg-blue-100 dark:bg-slate-800 dark:text-blue-200 dark:ring-slate-600`;
const CHIP = "rounded-full px-2 py-0.5 text-[11px] font-bold";

export default async function AdminPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string; status?: string }>;
}) {
  await connection(); // always render per request, never from a build-time copy
  if (!authEnabled) notFound();
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email || data.user.email.toLowerCase() !== ADMIN_EMAIL) notFound();

  const params = await searchParams;
  const tab: Tab = TABS.some((t) => t.key === params.tab) ? (params.tab as Tab) : "users";
  const db = createAdminClient();

  // Counters for the tab badges.
  const [pendingCount, openReportCount, hiddenCount] = await Promise.all([
    db.from("question_submissions").select("id", { count: "exact", head: true }).eq("status", "pending"),
    db.from("question_reports").select("id", { count: "exact", head: true }).eq("status", "open"),
    db.from("hidden_questions").select("question", { count: "exact", head: true }),
  ]);
  const badge: Partial<Record<Tab, number>> = {
    submissions: pendingCount.count ?? 0,
    reports: openReportCount.count ?? 0,
    hidden: hiddenCount.count ?? 0,
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-sky-200 via-blue-200 to-indigo-300 px-3 py-6 text-slate-900 sm:px-6 dark:from-slate-950 dark:via-slate-900 dark:to-indigo-950 dark:text-slate-100">
      <div className="mx-auto max-w-6xl space-y-6">
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
              M2 Canada
            </p>
            <h1 className="text-3xl font-extrabold">Admin</h1>
          </div>
          <Link href="/" className="text-sm font-semibold text-indigo-600 hover:underline dark:text-indigo-300">
            ← Back to the app
          </Link>
        </div>

        <nav className="flex flex-wrap gap-2">
          {TABS.map((t) => (
            <Link
              key={t.key}
              href={`/admin?tab=${t.key}`}
              className={`flex items-center gap-2 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                tab === t.key
                  ? "bg-blue-600 text-white shadow-md shadow-blue-600/30"
                  : "bg-white/90 text-slate-700 ring-1 ring-blue-200 hover:bg-white dark:bg-slate-900/90 dark:text-slate-200 dark:ring-slate-700"
              }`}
            >
              {t.label}
              {!!badge[t.key] && (
                <span
                  className={`${CHIP} ${tab === t.key ? "bg-white/25 text-white" : "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"}`}
                >
                  {badge[t.key]}
                </span>
              )}
            </Link>
          ))}
        </nav>

        {tab === "users" && <UsersTab />}
        {tab === "submissions" && <SubmissionsTab status={params.status} />}
        {tab === "reports" && <ReportsTab status={params.status} />}
        {tab === "hidden" && <HiddenTab />}

        <p className="text-xs text-slate-500 dark:text-slate-400">
          Times in Eastern time. Visitors who never sign in only appear in Vercel Analytics
          (Vercel dashboard → Analytics), which shows visits by country.
        </p>
      </div>
    </div>
  );
}

// ---------- Users ----------

async function UsersTab() {
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
    <>
      <div className="grid gap-3 sm:grid-cols-3">
        <Stat label="Accounts" value={users.length} />
        <Stat
          label="New in the last 7 days"
          value={users.filter((u) => Date.now() - Date.parse(u.created_at) < 7 * 864e5).length}
        />
        <Stat label="Countries" value={countries.length} />
      </div>

      {countries.length > 0 && (
        <section className={CARD}>
          <SectionTitle>Accounts by country</SectionTitle>
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
    </>
  );
}

// ---------- Submitted questions ----------

async function SubmissionsTab({ status }: { status?: string }) {
  const filter = status === "approved" || status === "rejected" ? status : "pending";
  const { data } = await createAdminClient()
    .from("question_submissions")
    .select("*")
    .eq("status", filter)
    .order("created_at", { ascending: filter === "pending" })
    .limit(100);
  const items = (data ?? []) as Submission[];

  return (
    <>
      <StatusFilter
        tab="submissions"
        current={filter}
        options={[
          ["pending", "To review"],
          ["approved", "Approved"],
          ["rejected", "Rejected"],
        ]}
      />
      {filter === "approved" && (
        <p className="text-sm text-slate-600 dark:text-slate-400">
          Approved questions are live in the app (without recorded audio; the browser voice
          reads them).
        </p>
      )}
      {items.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        items.map((s) => (
          <article key={s.id} className={CARD}>
            <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className={`${CHIP} bg-blue-100 text-blue-800 dark:bg-slate-800 dark:text-blue-200`}>
                {section(s.category)}
              </span>
              {s.topic && <span>{s.topic}</span>}
              <span>· from {s.name ? `${s.name} (${s.email})` : (s.email ?? "unknown")}</span>
              <span>· {when(s.created_at)}</span>
            </div>
            <p className="text-lg font-semibold">{s.question}</p>
            <ol className="mt-2 space-y-1 text-sm">
              {s.options.map((o, i) => (
                <li
                  key={i}
                  className={
                    i === s.correct
                      ? "font-semibold text-emerald-700 dark:text-emerald-400"
                      : "text-slate-700 dark:text-slate-300"
                  }
                >
                  {"ABCD"[i]}) {o} {i === s.correct && "✓"}
                </li>
              ))}
            </ol>
            {s.explanation && (
              <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">Explanation: {s.explanation}</p>
            )}
            {s.source && (
              <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">Reference: {s.source}</p>
            )}
            {s.admin_note && (
              <p className="mt-1 text-sm italic text-slate-500">Note: {s.admin_note}</p>
            )}

            {s.status === "pending" ? (
              <form action={reviewSubmission} className="mt-3 flex flex-wrap items-center gap-2">
                <input type="hidden" name="id" value={s.id} />
                <input
                  name="note"
                  placeholder="Note (optional)"
                  className="min-w-0 flex-1 rounded-lg bg-white px-3 py-1.5 text-sm ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-600"
                />
                <button name="status" value="approved" className={BTN_OK}>
                  Approve &amp; publish
                </button>
                <button name="status" value="rejected" className={BTN_NO}>
                  Reject
                </button>
              </form>
            ) : (
              <form action={reopenSubmission} className="mt-3">
                <input type="hidden" name="id" value={s.id} />
                <button className={BTN_SOFT}>
                  {s.status === "approved" ? "Unpublish (back to review)" : "Back to review"}
                </button>
              </form>
            )}
          </article>
        ))
      )}
    </>
  );
}

// ---------- Reports ----------

async function ReportsTab({ status }: { status?: string }) {
  const filter = status === "resolved" ? "resolved" : "open";
  const db = createAdminClient();
  const [{ data }, { data: hidden }] = await Promise.all([
    db
      .from("question_reports")
      .select("*")
      .eq("status", filter)
      .order("created_at", { ascending: false })
      .limit(100),
    db.from("hidden_questions").select("question"),
  ]);
  const items = (data ?? []) as Report[];
  const hiddenSet = new Set((hidden ?? []).map((h) => h.question as string));

  return (
    <>
      <StatusFilter
        tab="reports"
        current={filter}
        options={[
          ["open", "Open"],
          ["resolved", "Resolved"],
        ]}
      />
      {items.length === 0 ? (
        <Empty>Nothing here.</Empty>
      ) : (
        items.map((r) => {
          const isHidden = hiddenSet.has(r.question);
          return (
            <article key={r.id} className={CARD}>
              <div className="mb-2 flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400">
                <span
                  className={`${CHIP} ${
                    r.reason === "copyright"
                      ? "bg-rose-100 text-rose-700 dark:bg-rose-950 dark:text-rose-300"
                      : "bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300"
                  }`}
                >
                  {r.reason}
                </span>
                <span className={`${CHIP} bg-blue-100 text-blue-800 dark:bg-slate-800 dark:text-blue-200`}>
                  {section(r.category)}
                </span>
                {isHidden && (
                  <span className={`${CHIP} bg-slate-200 text-slate-700 dark:bg-slate-700 dark:text-slate-200`}>
                    hidden
                  </span>
                )}
                <span>· from {r.email ?? "unknown"}</span>
                <span>· {when(r.created_at)}</span>
              </div>
              <p className="font-semibold">{r.question}</p>
              {r.message && (
                <p className="mt-2 whitespace-pre-wrap text-sm text-slate-700 dark:text-slate-300">
                  “{r.message}”
                </p>
              )}
              {r.reply ? (
                <div className="mt-3 rounded-xl bg-emerald-50 p-3 text-sm ring-1 ring-emerald-200 dark:bg-emerald-950/30 dark:ring-emerald-900">
                  <p className="mb-1 text-[11px] font-bold uppercase tracking-wider text-emerald-700 dark:text-emerald-300">
                    Your reply{r.replied_at ? ` · ${when(r.replied_at)}` : ""}
                  </p>
                  <p className="whitespace-pre-wrap text-slate-700 dark:text-slate-300">{r.reply}</p>
                </div>
              ) : r.email && canEmailUsers ? (
                <form action={replyToReport} className="mt-3 space-y-2">
                  <input type="hidden" name="id" value={r.id} />
                  <textarea
                    name="reply"
                    required
                    rows={3}
                    maxLength={4000}
                    placeholder={`Reply to ${r.email}…`}
                    className="w-full rounded-lg bg-white px-3 py-2 text-sm ring-1 ring-blue-200 dark:bg-slate-800 dark:ring-slate-600"
                  />
                  <button className={BTN_OK}>Send reply &amp; resolve</button>
                </form>
              ) : r.email ? (
                <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
                  Replies from here turn on once m2canada.ca is verified in Resend.
                </p>
              ) : null}
              <div className="mt-3 flex flex-wrap gap-2">
                {isHidden ? (
                  <form action={unhideQuestion}>
                    <input type="hidden" name="question" value={r.question} />
                    <button className={BTN_SOFT}>Show the question again</button>
                  </form>
                ) : (
                  <form action={hideQuestion}>
                    <input type="hidden" name="question" value={r.question} />
                    <input type="hidden" name="category" value={r.category} />
                    <input type="hidden" name="reason" value={`Report #${r.id}: ${r.reason}`} />
                    <button className={BTN_NO}>Hide the question</button>
                  </form>
                )}
                <form action={r.status === "open" ? resolveReport : reopenReport}>
                  <input type="hidden" name="id" value={r.id} />
                  <button className={r.status === "open" ? BTN_OK : BTN_SOFT}>
                    {r.status === "open" ? "Mark as resolved" : "Reopen"}
                  </button>
                </form>
              </div>
            </article>
          );
        })
      )}
    </>
  );
}

// ---------- Hidden questions ----------

async function HiddenTab() {
  const { data } = await createAdminClient()
    .from("hidden_questions")
    .select("*")
    .order("created_at", { ascending: false });
  const items = (data ?? []) as Hidden[];

  return (
    <>
      <p className="text-sm text-slate-600 dark:text-slate-400">
        Hidden questions no longer appear in tests or study modes. They stay in the
        question files, so you can show them again at any time.
      </p>
      {items.length === 0 ? (
        <Empty>No hidden questions.</Empty>
      ) : (
        <Table title={`Hidden questions (${items.length})`}>
          <thead>
            <tr>
              <th className={TH}>Question</th>
              <th className={TH}>Section</th>
              <th className={TH}>Why</th>
              <th className={TH}>Since</th>
              <th className={TH} />
            </tr>
          </thead>
          <tbody className="divide-y divide-blue-100 dark:divide-slate-800">
            {items.map((h) => (
              <tr key={h.question}>
                <td className={`${TD} max-w-md`}>{h.question}</td>
                <td className={TD}>{section(h.category)}</td>
                <td className={TD}>{h.reason ?? "—"}</td>
                <td className={`${TD} whitespace-nowrap`}>{when(h.created_at)}</td>
                <td className={TD}>
                  <form action={unhideQuestion}>
                    <input type="hidden" name="question" value={h.question} />
                    <button className={BTN_SOFT}>Show again</button>
                  </form>
                </td>
              </tr>
            ))}
          </tbody>
        </Table>
      )}
    </>
  );
}

// ---------- pieces ----------

function StatusFilter({
  tab,
  current,
  options,
}: {
  tab: Tab;
  current: string;
  options: [string, string][];
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map(([value, label]) => (
        <Link
          key={value}
          href={`/admin?tab=${tab}&status=${value}`}
          className={`rounded-full px-3 py-1 text-xs font-semibold ${
            current === value
              ? "bg-indigo-600 text-white"
              : "bg-white/80 text-slate-700 ring-1 ring-blue-200 dark:bg-slate-900/80 dark:text-slate-200 dark:ring-slate-700"
          }`}
        >
          {label}
        </Link>
      ))}
    </div>
  );
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h2 className="mb-3 text-sm font-bold uppercase tracking-widest text-blue-600 dark:text-blue-300">
      {children}
    </h2>
  );
}

function Empty({ children }: { children: React.ReactNode }) {
  return <p className={`${CARD} text-sm text-slate-500 dark:text-slate-400`}>{children}</p>;
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className={CARD}>
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 dark:text-slate-400">{label}</p>
      <p className="mt-1 text-3xl font-extrabold">{value}</p>
    </div>
  );
}

function Table({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className={CARD}>
      <SectionTitle>{title}</SectionTitle>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] text-sm">{children}</table>
      </div>
    </section>
  );
}
