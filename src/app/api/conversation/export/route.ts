import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";

export const runtime = "nodejs";

/**
 * Conversation export — Markdown for whatever oracle the user has
 * access to (own or beneficiary-granted).
 *
 * Returns a single .md file with: oracle name + bio, every message
 * in chronological order, dates, photos referenced as image links,
 * a small "exported on" footer. Designed to be readable as plain
 * text AND to render nicely in any markdown viewer / Notion / etc.
 *
 * Auth: any signed-in user. RLS handles the access control — the
 * messages query will return zero rows if the caller can't see the
 * conversation (own messages or, for beneficiaries, their own
 * thread on a granted oracle).
 */

function fmtDate(iso: string): string {
  return new Date(iso).toLocaleString("en-US", {
    weekday: "short",
    year: "numeric",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

function escapeMd(s: string): string {
  // Light escaping — markdown is forgiving but stray pipes / brackets
  // can break tables or links. Keep messages readable.
  return s.replace(/\|/g, "\\|");
}

export async function GET(request: NextRequest) {
  const url = new URL(request.url);
  const oracleId = url.searchParams.get("oracle_id");
  if (!oracleId) {
    return NextResponse.json(
      { error: "Missing oracle_id" },
      { status: 400 },
    );
  }

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) {
    return NextResponse.json({ error: "Not signed in" }, { status: 401 });
  }

  // Oracle metadata. RLS lets us read this if we own it OR have a grant.
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, bio, created_at, user_id")
    .eq("id", oracleId)
    .maybeSingle();

  if (!oracle) {
    return NextResponse.json(
      { error: "Conversation not found or no access" },
      { status: 404 },
    );
  }

  // Pull messages — own thread if owner, beneficiary's own thread if
  // beneficiary. RLS-respecting via the user client. Filter to this
  // user's user_id explicitly so a beneficiary doesn't get the
  // owner's full message history.
  const { data: messages } = await supabase
    .from("messages")
    .select("role, content, image_url, created_at, initiated_by_oracle")
    .eq("oracle_id", oracleId)
    .eq("user_id", user.id)
    .order("created_at", { ascending: true });

  const oracleName = oracle.name ?? "your identity";
  const isOwner = oracle.user_id === user.id;
  const exportedAt = new Date().toISOString();

  const lines: string[] = [];
  lines.push(`# Conversations with ${oracleName}`);
  lines.push("");
  if (oracle.bio) {
    lines.push(`> ${escapeMd(oracle.bio).replace(/\n/g, "\n> ")}`);
    lines.push("");
  }
  if (messages && messages.length > 0) {
    const firstAt = messages[0]?.created_at;
    const lastAt = messages[messages.length - 1]?.created_at;
    if (firstAt && lastAt) {
      lines.push(
        `*${messages.length} messages, ${fmtDate(firstAt)} — ${fmtDate(lastAt)}*`,
      );
      lines.push("");
    }
  } else {
    lines.push("*No messages exchanged yet.*");
    lines.push("");
  }

  lines.push("---");
  lines.push("");

  let lastDay = "";
  for (const m of messages ?? []) {
    const day = new Date(m.created_at).toDateString();
    if (day !== lastDay) {
      lines.push("");
      lines.push(
        `### ${new Date(m.created_at).toLocaleDateString("en-US", {
          weekday: "long",
          month: "long",
          day: "numeric",
          year: "numeric",
        })}`,
      );
      lines.push("");
      lastDay = day;
    }

    const time = new Date(m.created_at).toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
    });

    const speaker =
      m.role === "user"
        ? "**You**"
        : m.initiated_by_oracle
          ? `**${oracleName}** *(out of the blue)*`
          : `**${oracleName}**`;

    lines.push(`${speaker} *— ${time}*`);
    if (m.image_url) {
      lines.push("");
      lines.push(`![photo](${m.image_url})`);
    }
    if (m.content) {
      lines.push("");
      lines.push(escapeMd(m.content));
    }
    lines.push("");
  }

  lines.push("---");
  lines.push("");
  lines.push(
    `*Exported from chapter3five on ${fmtDate(exportedAt)}. ${
      isOwner
        ? "These are conversations between you and your identity."
        : "These are your conversations with the archive — your private thread, not anyone else's."
    } Yours to keep.*`,
  );
  lines.push("");

  const body = lines.join("\n");

  const safeName = oracleName.replace(/[^a-zA-Z0-9]+/g, "-").toLowerCase();
  const filename = `chapter3five-${safeName}-${exportedAt.slice(0, 10)}.md`;

  return new NextResponse(body, {
    headers: {
      "Content-Type": "text/markdown; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
