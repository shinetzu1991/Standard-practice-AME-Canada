import "server-only";
import { ADMIN_EMAIL } from "./supabase/config";

// Plain-text email to the admin through Resend. Never throws: a failed email
// must not break the action that triggered it.
export async function emailAdmin(subject: string, lines: string[]) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !ADMIN_EMAIL) return;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: process.env.RESEND_FROM ?? "M2 Canada <onboarding@resend.dev>",
        to: [ADMIN_EMAIL],
        subject,
        text: lines.join("\n"),
      }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
  } catch (err) {
    console.error("Resend request failed", err);
  }
}
