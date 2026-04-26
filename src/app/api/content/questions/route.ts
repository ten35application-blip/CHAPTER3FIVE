import { NextResponse } from "next/server";
import { questions } from "@/content/questions";

/**
 * Public read of the question prompts. Used by the mobile app to render
 * the question flow. Answer-options are stripped — they're only relevant
 * to the randomize generator, which runs server-side.
 */
export async function GET() {
  const trimmed = questions.map((q) => ({
    id: q.id,
    category: q.category,
    depth: q.depth,
    en: q.en,
    es: q.es,
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
