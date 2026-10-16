import "server-only";
import { SUPPORT_EMAIL } from "./sections";
import { ADMIN_EMAIL } from "./supabase/config";

// RESEND_FROM is set (e.g. "M2 Canada <support@m2canada.ca>") once m2canada.ca
// is verified in Resend. Without it Resend's test sender can only deliver to
// the Resend account owner, so notifications fall back to ADMIN_EMAIL and
// replies to users are not possible.
const VERIFIED_FROM = process.env.RESEND_FROM ?? "";
export const canEmailUsers = VERIFIED_FROM !== "";

async function send(to: string, subject: string, text: string): Promise<boolean> {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey || !to) return false;
  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: VERIFIED_FROM || "M2 Canada <onboarding@resend.dev>",
        to: [to],
        reply_to: SUPPORT_EMAIL,
        subject,
        text,
      }),
    });
    if (!res.ok) console.error("Resend error", res.status, await res.text());
    return res.ok;
  } catch (err) {
    console.error("Resend request failed", err);
    return false;
  }
}

// New accounts, reports and submitted questions. Never throws: a failed email
// must not break the action that triggered it.
export async function emailAdmin(subject: string, lines: string[]) {
  await send(canEmailUsers ? SUPPORT_EMAIL : ADMIN_EMAIL, subject, lines.join("\n"));
}

// A message to a site user (e.g. the answer to their report). Replies to it
// go to SUPPORT_EMAIL.
export async function emailUser(to: string, subject: string, text: string): Promise<boolean> {
  if (!canEmailUsers) return false;
  return send(to, subject, text);
}
