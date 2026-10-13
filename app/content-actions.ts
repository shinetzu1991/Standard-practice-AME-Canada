"use server";

import { emailAdmin } from "@/lib/notify";
import { SECTION_LABELS, TOPIC_ORDER, isCategory } from "@/lib/sections";
import { authEnabled } from "@/lib/supabase/config";
import { createAdminClient, createClient } from "@/lib/supabase/server";

export type ActionResult = { ok?: boolean; error?: string };

const REASONS = ["error", "copyright", "other"] as const;

async function signedInUser() {
  if (!authEnabled) return null;
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();
  return data.user ?? null;
}

const clip = (value: unknown, max: number) => String(value ?? "").trim().slice(0, max);

export async function reportQuestion(input: {
  category: string;
  question: string;
  reason: string;
  message: string;
}): Promise<ActionResult> {
  const user = await signedInUser();
  if (!user) return { error: "Sign in to report a question." };
  if (!isCategory(input.category)) return { error: "Unknown section." };
  const reason = REASONS.find((r) => r === input.reason);
  if (!reason) return { error: "Choose a reason." };
  const question = clip(input.question, 2000);
  const message = clip(input.message, 2000);
  if (!question) return { error: "Missing question." };

  const db = createAdminClient();
  const { error } = await db.from("question_reports").insert({
    user_id: user.id,
    email: user.email ?? null,
    category: input.category,
    question,
    reason,
    message: message || null,
  });
  if (error) return { error: "Could not send the report. Try again." };

  // Takedown policy: copyright / exam-content reports hide the question right
  // away; the admin restores it from /admin if the report is not justified.
  if (reason === "copyright") {
    await db.from("hidden_questions").upsert({
      question,
      category: input.category,
      reason: `Copyright report from ${user.email ?? "a user"} (pending review)`,
    });
  }

  await emailAdmin(`M2 Canada: question reported (${reason})${reason === "copyright" ? " - hidden" : ""}`, [
    `Section: ${SECTION_LABELS[input.category]}`,
    `Reason: ${reason}`,
    `From: ${user.email ?? "-"}`,
    "",
    `Question: ${question}`,
    "",
    `Message: ${message || "-"}`,
    "",
    "Review: https://m2canada.ca/admin?tab=reports",
  ]);
  return { ok: true };
}

export async function submitQuestion(input: {
  category: string;
  topic: string;
  question: string;
  options: string[];
  correct: number;
  explanation: string;
  source: string;
}): Promise<ActionResult> {
  const user = await signedInUser();
  if (!user) return { error: "Sign in to suggest a question." };
  if (!isCategory(input.category)) return { error: "Choose a section." };
  const topic = TOPIC_ORDER[input.category].includes(input.topic) ? input.topic : null;
  const question = clip(input.question, 1000);
  const options = (Array.isArray(input.options) ? input.options : []).map((o) => clip(o, 300));
  const correct = Number(input.correct);
  if (!question) return { error: "Write the question." };
  if (options.length !== 4 || options.some((o) => !o)) return { error: "Fill in the 4 answers." };
  if (new Set(options.map((o) => o.toLowerCase())).size !== 4) {
    return { error: "The 4 answers must be different." };
  }
  if (!Number.isInteger(correct) || correct < 0 || correct > 3) {
    return { error: "Mark the correct answer." };
  }
  const explanation = clip(input.explanation, 1500);
  const source = clip(input.source, 300);

  const meta = user.user_metadata ?? {};
  const { error } = await createAdminClient().from("question_submissions").insert({
    user_id: user.id,
    email: user.email ?? null,
    name: (meta.full_name as string) || (meta.name as string) || null,
    category: input.category,
    topic,
    question,
    options,
    correct,
    explanation: explanation || null,
    source: source || null,
  });
  if (error) return { error: "Could not send the question. Try again." };

  await emailAdmin(`M2 Canada: new question to review (${SECTION_LABELS[input.category]})`, [
    `From: ${user.email ?? "-"}`,
    `Topic: ${topic ?? "-"}`,
    "",
    question,
    ...options.map((o, i) => `${"ABCD"[i]}) ${o}${i === correct ? "   <- correct" : ""}`),
    "",
    "Review: https://m2canada.ca/admin?tab=submissions",
  ]);
  return { ok: true };
}
