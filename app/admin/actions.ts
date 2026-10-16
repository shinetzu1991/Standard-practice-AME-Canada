"use server";

import { revalidatePath } from "next/cache";
import { emailUser } from "@/lib/notify";
import { isCategory } from "@/lib/sections";
import { ADMIN_EMAIL, authEnabled } from "@/lib/supabase/config";
import { createAdminClient, createClient } from "@/lib/supabase/server";

// Every action re-checks that the caller is the admin: server actions are
// public endpoints, hiding the buttons is not enough.
async function adminDb() {
  if (!authEnabled) throw new Error("Not configured");
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  if (!data.user?.email || data.user.email.toLowerCase() !== ADMIN_EMAIL) {
    throw new Error("Not allowed");
  }
  return createAdminClient();
}

const id = (form: FormData) => Number(form.get("id"));
const now = () => new Date().toISOString();

export async function reviewSubmission(form: FormData) {
  const db = await adminDb();
  const status = form.get("status") === "approved" ? "approved" : "rejected";
  await db
    .from("question_submissions")
    .update({
      status,
      admin_note: String(form.get("note") ?? "").trim().slice(0, 500) || null,
      reviewed_at: now(),
    })
    .eq("id", id(form));
  revalidatePath("/admin");
}

export async function reopenSubmission(form: FormData) {
  const db = await adminDb();
  await db
    .from("question_submissions")
    .update({ status: "pending", reviewed_at: null })
    .eq("id", id(form));
  revalidatePath("/admin");
}

export async function resolveReport(form: FormData) {
  const db = await adminDb();
  await db.from("question_reports").update({ status: "resolved", resolved_at: now() }).eq("id", id(form));
  revalidatePath("/admin");
}

export async function reopenReport(form: FormData) {
  const db = await adminDb();
  await db.from("question_reports").update({ status: "open", resolved_at: null }).eq("id", id(form));
  revalidatePath("/admin");
}

// Emails the person who sent the report and marks the report as resolved.
export async function replyToReport(form: FormData) {
  const db = await adminDb();
  const reply = String(form.get("reply") ?? "").trim().slice(0, 4000);
  if (!reply) return;
  const { data: report } = await db
    .from("question_reports")
    .select("id, email, question")
    .eq("id", id(form))
    .maybeSingle();
  if (!report?.email) return;

  const sent = await emailUser(
    report.email,
    "About the question you reported on M2 Canada",
    [
      reply,
      "",
      "—",
      `Question you reported: ${report.question}`,
      "",
      "M2 Canada support · https://m2canada.ca",
      "You can answer this email directly.",
    ].join("\n"),
  );
  if (!sent) return;

  await db
    .from("question_reports")
    .update({ reply, replied_at: now(), status: "resolved", resolved_at: now() })
    .eq("id", report.id);
  revalidatePath("/admin");
}

export async function hideQuestion(form: FormData) {
  const db = await adminDb();
  const category = form.get("category");
  const question = String(form.get("question") ?? "");
  if (!isCategory(category) || !question) return;
  await db.from("hidden_questions").upsert({
    question,
    category,
    reason: String(form.get("reason") ?? "").trim().slice(0, 300) || "Hidden by admin",
  });
  revalidatePath("/admin");
}

export async function unhideQuestion(form: FormData) {
  const db = await adminDb();
  await db.from("hidden_questions").delete().eq("question", String(form.get("question") ?? ""));
  revalidatePath("/admin");
}
