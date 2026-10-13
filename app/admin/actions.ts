"use server";

import { revalidatePath } from "next/cache";
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
