"use client";

import Link from "next/link";
import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { newOracle } from "@/app/oracles/actions";
import { normalizeShareCode } from "@/lib/share";

type Oracle = { id: string; name: string; avatarUrl: string | null };

type Props = {
  language: "en" | "es";
  /** The user's own identities — needed for the create-group modal. */
  ownedOracles?: Oracle[];
};

const COPY = {
  en: {
    open: "New",
    sectionMake: "Make",
    sectionLovedOne: "A loved one",
    newIdentity: "+ New identity",
    newIdentityHint: "Start a fresh archive — yours, your dad's, anyone's.",
    newGroup: "+ New group chat",
    newGroupHint: "Put two or more of your identities in one room.",
    seeRemoved: "See removed identities",
    seeRemovedHint: "Soft-deleted identities still in their 30-day grace.",
    enterCode: "Connect with their code",
    enterCodeHint:
      "An invite code (alive) or claim link (passed). Import codes belong to a fresh account — sign up instead.",
    codePlaceholder: "XXXX-XXXX-XXXX",
    codeCta: "Connect",
    codeError: "That code doesn't look right.",
    modalTitle: "Make a group chat",
    modalIntro:
      "Pick 2–4 of your identities. Name the room. Once you say the first thing, they'll know they're together and can talk to you and to each other.",
    needTwo: "You need at least 2 identities for a group chat. Make another from + New identity.",
    namePlaceholder: 'Name the room (e.g. "family dinner")',
    pickHint: "Pick 2–4.",
    createCta: "Create",
    creating: "Creating…",
    cancel: "Cancel",
    error: "Couldn't create the group. Try again?",
  },
  es: {
    open: "Nuevo",
    sectionMake: "Crear",
    sectionLovedOne: "Un ser querido",
    newIdentity: "+ Nueva identidad",
    newIdentityHint: "Empieza un archivo nuevo — tuyo, de tu papá, de quien sea.",
    newGroup: "+ Nuevo chat grupal",
    newGroupHint: "Pon dos o más de tus identidades en un cuarto.",
    seeRemoved: "Ver identidades eliminadas",
    seeRemovedHint: "Identidades en su periodo de gracia de 30 días.",
    enterCode: "Conectar con su código",
    enterCodeHint:
      "Un código de invitación (vivo) o enlace de herencia (fallecido). Los códigos de importación son para una cuenta nueva.",
    codePlaceholder: "XXXX-XXXX-XXXX",
    codeCta: "Conectar",
    codeError: "Ese código no parece correcto.",
    modalTitle: "Crear chat grupal",
    modalIntro:
      "Elige 2–4 de tus identidades. Nombra el cuarto. Cuando digas lo primero, sabrán que están juntas y podrán hablar contigo y entre ellas.",
    needTwo: "Necesitas al menos 2 identidades. Crea otra desde + Nueva identidad.",
    namePlaceholder: 'Nombre del cuarto (p. ej. "cena familiar")',
    pickHint: "Elige 2–4.",
    createCta: "Crear",
    creating: "Creando…",
    cancel: "Cancelar",
    error: "No se pudo crear el grupo. ¿Intentas de nuevo?",
  },
};

/**
 * Dashboard-only "+ New" menu. Sits next to the page title; opens a
 * small popover with the actions you'd want from a conversation
 * list: create another identity, create a group chat, or browse
 * recently-removed identities.
 *
 * Lives separately from the global NavFab (which is for navigation
 * to top-level pages). This is for *making things* on the dashboard.
 */
export function NewConversationMenu({
  language,
  ownedOracles = [],
}: Props) {
  const t = COPY[language];
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [modalOpen, setModalOpen] = useState(false);
  const [groupName, setGroupName] = useState("");
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [creating, setCreating] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [codeInputOpen, setCodeInputOpen] = useState(false);
  const [code, setCode] = useState("");
  const [codeErr, setCodeErr] = useState<string | null>(null);
  const ref = useRef<HTMLDivElement | null>(null);

  function submitCode(e: React.FormEvent) {
    e.preventDefault();
    const normalized = normalizeShareCode(code);
    if (normalized.length === 12) {
      // Standard 12-char share/invite code → existing /invite/[code] page.
      const formatted = `${normalized.slice(0, 4)}-${normalized.slice(4, 8)}-${normalized.slice(8, 12)}`;
      router.push(`/invite/${encodeURIComponent(formatted)}`);
      setOpen(false);
      return;
    }
    if (normalized.length === 32) {
      // 32-char beneficiary claim token → /legacy page.
      router.push(`/legacy/${encodeURIComponent(normalized.toLowerCase())}`);
      setOpen(false);
      return;
    }
    setCodeErr(t.codeError);
  }

  function toggleSel(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else if (next.size < 4) next.add(id);
      return next;
    });
  }

  async function createGroup(e: React.FormEvent) {
    e.preventDefault();
    if (creating) return;
    if (selected.size < 2 || selected.size > 4 || !groupName.trim()) return;
    setCreating(true);
    setErr(null);
    try {
      const res = await fetch("/api/groups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name: groupName.trim(),
          language,
          oracle_ids: Array.from(selected),
        }),
      });
      const data = await res.json();
      if (!res.ok || !data?.id) throw new Error(data?.error ?? t.error);
      // Land in the empty room — user types the first thing, group
      // orchestration kicks in, personas respond.
      router.push(`/groups/${data.id}`);
    } catch (e2) {
      setErr(e2 instanceof Error ? e2.message : t.error);
      setCreating(false);
    }
  }

  useEffect(() => {
    if (!open) return;
    function onDocClick(e: MouseEvent) {
      if (!ref.current) return;
      if (!ref.current.contains(e.target as Node)) setOpen(false);
    }
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") setOpen(false);
    }
    document.addEventListener("mousedown", onDocClick);
    document.addEventListener("keydown", onKey);
    return () => {
      document.removeEventListener("mousedown", onDocClick);
      document.removeEventListener("keydown", onKey);
    };
  }, [open]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={t.open}
        title={t.open}
        className="w-10 h-10 rounded-full text-warm-100 hover:bg-warm-700/40 hover:text-warm-50 transition-colors flex items-center justify-center"
      >
        {/* Compose / pencil-square icon — iMessage's top-right corner. */}
        <svg
          viewBox="0 0 24 24"
          className="w-5 h-5"
          fill="none"
          stroke="currentColor"
          strokeWidth="1.8"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <path d="M4 21v-3.5L15 6.5l3.5 3.5L7.5 21z" />
          <path d="M14 7.5L17 4.5l3.5 3.5-3 3" />
        </svg>
      </button>

      {open && (
        <div className="absolute right-0 mt-2 w-80 rounded-2xl border border-warm-300/60 bg-ink-soft shadow-2xl backdrop-blur-xl overflow-hidden z-40">
          {/* Section 1 — make your own */}
          <p className="text-[10px] uppercase tracking-[0.25em] text-warm-400 px-4 pt-3 pb-1">
            {t.sectionMake}
          </p>

          <form action={newOracle}>
            <button
              type="submit"
              className="block w-full text-left px-4 py-3 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40"
            >
              <p className="text-sm font-medium text-warm-50">
                {t.newIdentity}
              </p>
              <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                {t.newIdentityHint}
              </p>
            </button>
          </form>

          <button
            type="button"
            onClick={() => {
              setOpen(false);
              setModalOpen(true);
            }}
            className="block w-full text-left px-4 py-3 hover:bg-warm-700/40 transition-colors border-b border-warm-700/40"
          >
            <p className="text-sm font-medium text-warm-50">{t.newGroup}</p>
            <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
              {t.newGroupHint}
            </p>
          </button>

          <Link
            href="/identities"
            onClick={() => setOpen(false)}
            className="block px-4 py-3 hover:bg-warm-700/40 transition-colors"
          >
            <p className="text-sm font-medium text-warm-50">{t.seeRemoved}</p>
            <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
              {t.seeRemovedHint}
            </p>
          </Link>

          {/* Section 2 — connect to a loved one */}
          <div className="border-t-2 border-warm-700/60">
            <p className="text-[10px] uppercase tracking-[0.25em] text-warm-400 px-4 pt-3 pb-1">
              {t.sectionLovedOne}
            </p>

            {!codeInputOpen ? (
              <button
                type="button"
                onClick={() => {
                  setCodeInputOpen(true);
                  setCodeErr(null);
                }}
                className="block w-full text-left px-4 py-3 hover:bg-warm-700/40 transition-colors"
              >
                <p className="text-sm font-medium text-warm-50">
                  {t.enterCode}
                </p>
                <p className="text-xs text-warm-300 mt-0.5 leading-relaxed">
                  {t.enterCodeHint}
                </p>
              </button>
            ) : (
              <form
                onSubmit={submitCode}
                className="px-4 py-3 space-y-2"
              >
                <input
                  type="text"
                  value={code}
                  onChange={(e) => {
                    setCode(e.target.value);
                    setCodeErr(null);
                  }}
                  placeholder={t.codePlaceholder}
                  autoFocus
                  spellCheck={false}
                  autoCapitalize="characters"
                  className="w-full h-11 rounded-full bg-warm-700/40 border border-warm-400/40 px-4 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm font-mono tracking-wider uppercase"
                />
                {codeErr && (
                  <p className="text-xs text-red-300/80 px-1">{codeErr}</p>
                )}
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => {
                      setCodeInputOpen(false);
                      setCode("");
                      setCodeErr(null);
                    }}
                    className="h-10 px-4 rounded-full border border-warm-400/30 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={!code.trim()}
                    className="flex-1 h-10 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {t.codeCta}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Inline create-group modal — no navigation. Pick identities,
          name the room, hit create, land in the empty room. */}
      {modalOpen && (
        <div
          className="fixed inset-0 z-[100] bg-ink/80 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="w-full max-w-md bg-ink-soft border border-warm-300/40 rounded-2xl p-5 max-h-[85vh] overflow-y-auto">
            <div className="flex items-start justify-between gap-3 mb-2">
              <h2 className="font-serif text-xl text-warm-50">
                {t.modalTitle}
              </h2>
              <button
                type="button"
                onClick={() => setModalOpen(false)}
                className="text-warm-400 hover:text-warm-100 transition-colors text-xl leading-none p-1"
                aria-label={t.cancel}
              >
                ×
              </button>
            </div>
            <p className="text-sm text-warm-300 mb-5 leading-relaxed">
              {t.modalIntro}
            </p>

            {ownedOracles.length < 2 ? (
              <p className="text-sm text-warm-200 italic">{t.needTwo}</p>
            ) : (
              <form onSubmit={createGroup} className="space-y-4">
                <input
                  type="text"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  placeholder={t.namePlaceholder}
                  maxLength={80}
                  className="w-full h-11 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors text-sm"
                />

                <div>
                  <p className="text-xs text-warm-300 mb-2">{t.pickHint}</p>
                  <div className="grid grid-cols-2 gap-2">
                    {ownedOracles.map((o) => {
                      const isSel = selected.has(o.id);
                      return (
                        <button
                          key={o.id}
                          type="button"
                          onClick={() => toggleSel(o.id)}
                          className={
                            isSel
                              ? "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-50 bg-warm-50 text-ink transition-colors"
                              : "flex items-center gap-2 px-3 py-2 rounded-xl border border-warm-400/30 bg-warm-700/20 text-warm-100 hover:bg-warm-700/40 transition-colors"
                          }
                        >
                          {o.avatarUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={o.avatarUrl}
                              alt=""
                              className="w-7 h-7 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <span
                              className={
                                isSel
                                  ? "w-7 h-7 rounded-full bg-warm-300/50 flex-shrink-0"
                                  : "w-7 h-7 rounded-full bg-warm-700/40 flex-shrink-0"
                              }
                            />
                          )}
                          <span className="text-sm truncate">{o.name}</span>
                        </button>
                      );
                    })}
                  </div>
                </div>

                {err && <p className="text-sm text-red-300/80">{err}</p>}

                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setModalOpen(false)}
                    className="h-11 px-4 rounded-full border border-warm-400/30 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm"
                  >
                    {t.cancel}
                  </button>
                  <button
                    type="submit"
                    disabled={
                      creating ||
                      selected.size < 2 ||
                      selected.size > 4 ||
                      !groupName.trim()
                    }
                    className="flex-1 h-11 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors disabled:opacity-50 disabled:cursor-not-allowed text-sm"
                  >
                    {creating ? t.creating : t.createCta}
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
