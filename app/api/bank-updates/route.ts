import { NextResponse } from "next/server";
import { authEnabled } from "@/lib/supabase/config";
import { createAdminClient } from "@/lib/supabase/server";

// Changes to the question banks made from /admin: questions hidden (e.g. after
// a copyright report) and user submissions that were approved. The app applies
// them on top of the JSON banks when it loads.
export async function GET() {
  const empty = { hidden: [], added: [] };
  if (!authEnabled) return NextResponse.json(empty);

  const db = createAdminClient();
  const [hidden, approved] = await Promise.all([
    db.from("hidden_questions").select("category, question"),
    db
      .from("question_submissions")
      .select("category, topic, question, options, correct, explanation")
      .eq("status", "approved")
      .order("reviewed_at", { ascending: true }),
  ]);
  if (hidden.error || approved.error) return NextResponse.json(empty);

  return NextResponse.json(
    {
      hidden: hidden.data,
      added: approved.data.map((s) => ({
        category: s.category,
        pregunta: s.question,
        opciones: s.options,
        correcta: s.correct,
        tema: s.topic ?? undefined,
        explicacion: s.explanation ?? undefined,
      })),
    },
    { headers: { "Cache-Control": "no-store" } },
  );
}
