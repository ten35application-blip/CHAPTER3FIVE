"use client";

import { useEffect, useMemo, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { kickGroupMember, addGroupMember } from "@/app/groups/[id]/actions";

type Member = {
  oracleId: string;
  name: string;
  avatarUrl: string | null;
  left: boolean;
};

type Addable = {
  id: string;
  name: string;
  avatarUrl: string | null;
};

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  senderOracleId: string | null;
  createdAt: string;
};

type Props = {
  roomId: string;
  language: "en" | "es";
  members: Member[];
  initialMessages: Message[];
  isOwner: boolean;
  addableOracles: Addable[];
};

const COPY = {
  en: {
    placeholder: "Say something to the group…",
    send: "Send",
    sending: "…",
    error: "Couldn't send. Try again?",
    empty: "Empty room. Start the chat.",
    waiting: "…",
    left: "left the chat",
    kick: "Remove",
    kickConfirm: (name: string) => `Remove ${name} from the group?`,
    kicking: "Removing…",
    addLabel: "+ Add",
    addTitle: "Add an identity to the group",
    addCta: "Add",
    adding: "Adding…",
    addEmpty: "No more of your identities to add.",
    cancel: "Cancel",
    full: "Group is full (4 max).",
  },
  es: {
    placeholder: "Dile algo al grupo…",
    send: "Enviar",
    sending: "…",
    error: "No se pudo enviar. ¿Intentas de nuevo?",
    empty: "Cuarto vacío. Empieza el chat.",
    waiting: "…",
    left: "se fue del chat",
    kick: "Quitar",
    kickConfirm: (name: string) => `¿Quitar a ${name} del grupo?`,
    kicking: "Quitando…",
    addLabel: "+ Agregar",
    addTitle: "Agregar una identidad al grupo",
    addCta: "Agregar",
    adding: "Agregando…",
    addEmpty: "No tienes más identidades para agregar.",
    cancel: "Cancelar",
    full: "El grupo está lleno (máx. 4).",
  },
};

export function GroupRoom({
  roomId,
  language,
  members: initialMembers,
  initialMessages,
  isOwner,
  addableOracles,
}: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [messages, setMessages] = useState<Message[]>(initialMessages);
  const [members, setMembers] = useState<Member[]>(initialMembers);
  const [input, setInput] = useState("");
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [openMemberId, setOpenMemberId] = useState<string | null>(null);
  const [addOpen, setAddOpen] = useState(false);
  const [pending, startTransition] = useTransition();
  const [pendingOracleId, setPendingOracleId] = useState<string | null>(null);

  // Re-sync local state when the server props change (after add/kick
  // server actions trigger revalidation).
  useEffect(() => {
    setMembers(initialMembers);
  }, [initialMembers]);

  const activeCount = members.filter((m) => !m.left).length;

  function onKick(oracleId: string, name: string) {
    if (pending) return;
    if (!confirm(t.kickConfirm(name))) return;
    setOpenMemberId(null);
    setPendingOracleId(oracleId);
    const fd = new FormData();
    fd.append("room_id", roomId);
    fd.append("oracle_id", oracleId);
    startTransition(async () => {
      await kickGroupMember(fd);
      router.refresh();
      setPendingOracleId(null);
    });
  }

  function onAdd(oracleId: string) {
    if (pending) return;
    setPendingOracleId(oracleId);
    const fd = new FormData();
    fd.append("room_id", roomId);
    fd.append("oracle_id", oracleId);
    startTransition(async () => {
      await addGroupMember(fd);
      router.refresh();
      setPendingOracleId(null);
      setAddOpen(false);
    });
  }

  const memberById = useMemo(() => {
    const m = new Map<string, Member>();
    for (const x of members) m.set(x.oracleId, x);
    return m;
  }, [members]);

  useEffect(() => {
    scrollerRef.current?.scrollTo({
      top: scrollerRef.current.scrollHeight,
      behavior: "smooth",
    });
  }, [messages, sending]);

  // Realtime subscription so persona replies stream in as the
  // orchestration API posts them.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group_messages:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "group_messages",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            id: string;
            role: "user" | "assistant";
            content: string;
            sender_oracle_id: string | null;
            created_at: string;
          };
          if (row.role !== "assistant") return;
          setMessages((prev) => {
            if (prev.some((m) => m.id === row.id)) return prev;
            return [
              ...prev,
              {
                id: row.id,
                role: row.role,
                content: row.content,
                senderOracleId: row.sender_oracle_id,
                createdAt: row.created_at,
              },
            ];
          });
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  // Realtime: track group_room_members so the chip strip stays in
  // sync when someone walks out, gets kicked, or gets re-added.
  useEffect(() => {
    const supabase = createClient();
    const channel = supabase
      .channel(`group_members:${roomId}`)
      .on(
        "postgres_changes",
        {
          event: "UPDATE",
          schema: "public",
          table: "group_room_members",
          filter: `room_id=eq.${roomId}`,
        },
        (payload) => {
          const row = payload.new as {
            oracle_id: string;
            left_at: string | null;
          };
          setMembers((prev) =>
            prev.map((m) =>
              m.oracleId === row.oracle_id
                ? { ...m, left: !!row.left_at }
                : m,
            ),
          );
        },
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [roomId]);

  async function send(e: React.FormEvent) {
    e.preventDefault();
    const text = input.trim();
    if (!text || sending) return;

    setSending(true);
    setError(null);

    const tempId = `local-${Date.now()}`;
    setMessages((prev) => [
      ...prev,
      {
        id: tempId,
        role: "user",
        content: text,
        senderOracleId: null,
        createdAt: new Date().toISOString(),
      },
    ]);
    setInput("");

    try {
      const res = await fetch("/api/chat/group", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ room_id: roomId, message: text }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error ?? t.error);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t.error);
    } finally {
      setSending(false);
    }
  }

  return (
    <div className="w-full max-w-3xl flex flex-col flex-1 min-h-0">
      <div className="flex items-center gap-3 mb-6 flex-wrap">
        {members.map((m) => {
          const showKick =
            isOwner && !m.left && openMemberId === m.oracleId;
          const isPending = pendingOracleId === m.oracleId;
          return (
            <div key={m.oracleId} className="relative">
              <button
                type="button"
                onClick={() => {
                  if (!isOwner || m.left) return;
                  setOpenMemberId((prev) =>
                    prev === m.oracleId ? null : m.oracleId,
                  );
                }}
                disabled={!isOwner || m.left}
                className={
                  m.left
                    ? "flex items-center gap-2 opacity-40 cursor-default"
                    : isOwner
                      ? "flex items-center gap-2 hover:bg-warm-700/40 rounded-full px-2 py-1 -mx-2 -my-1 transition-colors"
                      : "flex items-center gap-2 cursor-default"
                }
                title={m.left ? `${m.name} ${t.left}` : m.name}
              >
                {m.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={m.avatarUrl}
                    alt=""
                    className="w-9 h-9 rounded-full object-cover border border-warm-300/30"
                  />
                ) : (
                  <span className="w-9 h-9 rounded-full bg-warm-700/40 border border-warm-300/30 inline-block" />
                )}
                <span className="text-sm text-warm-100">{m.name}</span>
                {m.left && (
                  <span className="text-xs text-warm-400 italic">
                    · {t.left}
                  </span>
                )}
              </button>
              {showKick && (
                <div className="absolute left-0 top-full mt-2 z-20 rounded-xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden min-w-[140px]">
                  <button
                    type="button"
                    onClick={() => onKick(m.oracleId, m.name)}
                    disabled={isPending}
                    className="block w-full text-left px-4 py-2.5 text-sm text-red-300 hover:bg-warm-700/40 transition-colors disabled:opacity-50"
                  >
                    {isPending ? t.kicking : t.kick}
                  </button>
                </div>
              )}
            </div>
          );
        })}

        {isOwner && (
          <div className="relative">
            <button
              type="button"
              onClick={() => {
                if (activeCount >= 4) return;
                if (addableOracles.length === 0) return;
                setAddOpen((v) => !v);
                setOpenMemberId(null);
              }}
              disabled={activeCount >= 4 || addableOracles.length === 0}
              className="flex items-center gap-2 px-3 py-1.5 rounded-full border border-dashed border-warm-400/50 text-warm-200 hover:border-warm-200 hover:text-warm-50 transition-colors text-sm disabled:opacity-40 disabled:cursor-not-allowed"
              title={
                activeCount >= 4
                  ? t.full
                  : addableOracles.length === 0
                    ? t.addEmpty
                    : t.addTitle
              }
            >
              {t.addLabel}
            </button>
            {addOpen && (
              <div
                className="fixed inset-0 z-[60] bg-ink/70 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
                onClick={(e) => {
                  if (e.target === e.currentTarget) setAddOpen(false);
                }}
              >
                <div className="w-full max-w-md bg-ink-soft border border-warm-300/40 rounded-2xl p-5 max-h-[70vh] overflow-y-auto">
                  <div className="flex items-center justify-between mb-4">
                    <h3 className="font-serif text-lg text-warm-50">
                      {t.addTitle}
                    </h3>
                    <button
                      type="button"
                      onClick={() => setAddOpen(false)}
                      className="text-warm-400 hover:text-warm-100 transition-colors text-xl leading-none p-1"
                      aria-label={t.cancel}
                    >
                      ×
                    </button>
                  </div>
                  {addableOracles.length === 0 ? (
                    <p className="text-sm text-warm-300 italic">
                      {t.addEmpty}
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {addableOracles.map((o) => {
                        const isPend = pendingOracleId === o.id;
                        return (
                          <button
                            key={o.id}
                            type="button"
                            onClick={() => onAdd(o.id)}
                            disabled={pending}
                            className="flex items-center gap-3 w-full px-3 py-2 rounded-xl border border-warm-400/30 bg-warm-700/20 hover:bg-warm-700/40 transition-colors disabled:opacity-50"
                          >
                            {o.avatarUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img
                                src={o.avatarUrl}
                                alt=""
                                className="w-9 h-9 rounded-full object-cover flex-shrink-0"
                              />
                            ) : (
                              <span className="w-9 h-9 rounded-full bg-warm-700/40 flex-shrink-0" />
                            )}
                            <span className="text-sm text-warm-100 truncate">
                              {o.name}
                            </span>
                            {isPend && (
                              <span className="ml-auto text-xs text-warm-300 italic">
                                {t.adding}
                              </span>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      <div className="flex flex-col flex-1 min-h-0">
        <div
          ref={scrollerRef}
          className="flex-1 min-h-0 overflow-y-auto px-1 py-2 space-y-5"
        >
          {messages.length === 0 && (
            <p className="text-center text-warm-400 text-sm font-light italic mt-8">
              {t.empty}
            </p>
          )}

          {messages.map((m) => {
            const isUser = m.role === "user";
            const sender = m.senderOracleId
              ? memberById.get(m.senderOracleId)
              : null;
            return (
              <div
                key={m.id}
                className={isUser ? "flex justify-end" : "flex justify-start"}
              >
                <div className="flex items-start gap-2 max-w-[85%]">
                  {!isUser && (
                    <>
                      {sender?.avatarUrl ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={sender.avatarUrl}
                          alt=""
                          className="w-7 h-7 rounded-full object-cover flex-shrink-0 mt-1"
                        />
                      ) : (
                        <span className="w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0 mt-1" />
                      )}
                    </>
                  )}
                  <div>
                    {!isUser && (
                      <p className="text-xs text-warm-300 mb-1 ml-1">
                        {sender?.name ?? "—"}
                      </p>
                    )}
                    <div
                      className={
                        isUser
                          ? "rounded-2xl bg-warm-700/40 text-warm-50 px-4 py-3 leading-relaxed"
                          : "text-warm-50 leading-relaxed font-serif text-lg"
                      }
                    >
                      {m.content}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}

          {sending && (
            <p className="text-xs text-warm-400 italic text-center pt-2">
              {t.waiting}
            </p>
          )}
        </div>

        {error && (
          <p className="px-1 pb-2 text-sm text-red-300/80 text-center">
            {error}
          </p>
        )}

        <form
          onSubmit={send}
          className="flex gap-2 pt-3 border-t border-warm-700/60"
        >
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.placeholder}
            aria-label={t.placeholder}
            disabled={sending}
            className="flex-1 h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors disabled:opacity-60"
          />
          <button
            type="submit"
            disabled={sending || !input.trim()}
            className="h-12 px-6 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {sending ? t.sending : t.send}
          </button>
        </form>
      </div>
    </div>
  );
}
