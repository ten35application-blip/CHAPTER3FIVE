import { NextResponse } from "next/server";
import { questions } from "@/content/questions";

/**
 * Public read of the question prompts. Used by the mobile app to render
 * the question flow. Answer-options are stripped — they're only relevant
 * to the randomize generator, which runs server-side.
 *
 * enOther / esOther: optional third-person variants used when the user
 * is answering for someone ELSE (mode = "other"), so "what's your
 * favorite meal" becomes "what is their favorite meal". Fields are
 * OPTIONAL during rollout — mobile falls back to en/es for any
 * question that doesn't yet have an other-variant. Once every
 * question has both variants, mobile will render mode-aware text
 * end-to-end.
 */
export async function GET() {
  const trimmed = questions.map((q) => ({
    id: q.id,
    category: q.category,
    depth: q.depth,
    en: q.en,
    es: q.es,
    ...(q.enOther ? { enOther: q.enOther } : {}),
    ...(q.esOther ? { esOther: q.esOther } : {}),
  }));
  return NextResponse.json(
    { questions: trimmed, count: trimmed.length },
    {
      headers: {
        "cache-control": "public, max-age=300, s-maxage=3600",
      },
    },
  );
}
