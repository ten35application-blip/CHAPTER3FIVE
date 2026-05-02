"use client";

import { createContext, useContext, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  removeConversation,
  toggleFavorite,
  toggleMute,
} from "@/app/settings/actions";

export type SelectableKey = `${"owned" | "shared" | "group" | "together"}:${string}`;

type Ctx = {
  active: boolean;
  selected: Set<SelectableKey>;
  toggle: (key: SelectableKey) => void;
  clear: () => void;
};

const EditContext = createContext<Ctx | null>(null);

export function useEditMode() {
  const ctx = useContext(EditContext);
  // Component might be rendered outside the provider on routes that
  // don't include EditModeProvider — return a "no-op" shape.
  if (!ctx) {
    return {
      active: false,
      selected: new Set<SelectableKey>(),
      toggle: () => {},
      clear: () => {},
    };
  }
  return ctx;
}

/**
 * Wraps a list region (e.g. the dashboard rows) so child components
 * can read and mutate the edit-mode selection state. The
 * accompanying EditToolbar handles the toggle button + bulk action
 * bar; the rows themselves render an inline checkbox via
 * useEditMode().
 */
export function EditModeProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [active, setActive] = useState(false);
  const [selected, setSelected] = useState<Set<SelectableKey>>(new Set());

  return (
    <EditContext.Provider
      value={{
        active,
        selected,
        toggle: (key) => {
          setSelected((prev) => {
            const next = new Set(prev);
            if (next.has(key)) next.delete(key);
            else next.add(key);
            return next;
          });
        },
        clear: () => setSelected(new Set()),
      }}
    >
      <EditModeToggle
        active={active}
        onToggle={() => {
          setActive((v) => !v);
          if (active) setSelected(new Set());
        }}
      />
      {children}
      <EditModeBar
        active={active}
        selected={selected}
        onDone={() => {
          setActive(false);
          setSelected(new Set());
        }}
      />
    </EditContext.Provider>
  );
}

function EditModeToggle({
  active,
  onToggle,
}: {
  active: boolean;
  onToggle: () => void;
}) {
  // Renders into a portal-like fixed slot near the title. We expose
  // it via a known DOM id so the dashboard can mount us next to
  // the heading. Simpler: render a small button directly above the
  // list — works without portals.
  return (
    <div className="flex justify-end -mt-2 mb-2 px-2">
      <button
        type="button"
        onClick={onToggle}
        className="text-sm text-warm-300 hover:text-warm-100 transition-colors"
      >
        {active ? "Done" : "Edit"}
      </button>
    </div>
  );
}

function EditModeBar({
  active,
  selected,
  onDone,
}: {
  active: boolean;
  selected: Set<SelectableKey>;
  onDone: () => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const count = selected.size;
  const disabled = count === 0 || pending;

  function runForEach(
    actionLabel: string,
    fn: (kind: string, id: string) => Promise<unknown>,
  ) {
    if (disabled) return;
    if (
      actionLabel === "delete" &&
      typeof window !== "undefined" &&
      !window.confirm(
        `Delete ${count} conversation${count === 1 ? "" : "s"}? Identities go to a 30-day grace window; group rooms are gone.`,
      )
    ) {
      return;
    }
    startTransition(async () => {
      for (const key of selected) {
        const [kind, id] = key.split(":");
        try {
          await fn(kind, id);
        } catch (err) {
          console.error(`bulk ${actionLabel} failed for ${key}:`, err);
        }
      }
      router.refresh();
      onDone();
    });
  }

  function bulkPin() {
    runForEach("pin", async (kind, id) => {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("id", id);
      await toggleFavorite(fd);
    });
  }

  function bulkMute() {
    runForEach("mute", async (kind, id) => {
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("id", id);
      await toggleMute(fd);
    });
  }

  function bulkDelete() {
    runForEach("delete", async (kind, id) => {
      // beneficiary "together" rows aren't user-removable — skip.
      if (kind === "together") return;
      const fd = new FormData();
      fd.append("kind", kind);
      fd.append("id", id);
      await removeConversation(fd);
    });
  }

  // Don't render anything when edit mode is off. Previously this was
  // a translateY(100%) hide, but on iPad the parent's overflow let
  // the bar peek above the bottom safe area. Conditional render is
  // simpler and bulletproof.
  if (!active) return null;

  return (
    <div className="fixed bottom-0 inset-x-0 z-40">
      <div className="bg-ink-soft/95 backdrop-blur-md border-t border-warm-700/60 shadow-2xl">
        <div className="max-w-2xl mx-auto px-4 py-3 flex items-center justify-between gap-3">
          <span className="text-sm text-warm-200 flex-shrink-0">
            {count === 0
              ? "Tap rows to select"
              : `${count} selected`}
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={bulkPin}
              disabled={disabled}
              className="h-9 px-3 rounded-full border border-warm-400/40 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm disabled:opacity-40"
            >
              Pin
            </button>
            <button
              type="button"
              onClick={bulkMute}
              disabled={disabled}
              className="h-9 px-3 rounded-full border border-warm-400/40 text-warm-100 hover:bg-warm-700/40 transition-colors text-sm disabled:opacity-40"
            >
              Mute
            </button>
            <button
              type="button"
              onClick={bulkDelete}
              disabled={disabled}
              className="h-9 px-3 rounded-full bg-red-700 text-white font-medium hover:bg-red-600 transition-colors text-sm disabled:opacity-40"
            >
              Delete
            </button>
          </div>
        </div>
        <div className="h-[env(safe-area-inset-bottom)]" />
      </div>
    </div>
  );
}

/**
 * Inline checkbox rendered inside each ConversationRow when edit
 * mode is active. Hidden otherwise.
 */
export function EditModeCheckbox({
  selectableKey,
}: {
  selectableKey: SelectableKey;
}) {
  const { active, selected, toggle } = useEditMode();
  if (!active) return null;
  const isSel = selected.has(selectableKey);
  return (
    <button
      type="button"
      onClick={(e) => {
        // Don't navigate when tapping the checkbox itself.
        e.preventDefault();
        e.stopPropagation();
        toggle(selectableKey);
      }}
      aria-checked={isSel}
      role="checkbox"
      className={`w-5 h-5 rounded-full flex-shrink-0 border-2 flex items-center justify-center transition-colors ${
        isSel
          ? "bg-amber border-amber"
          : "bg-transparent border-warm-400/60"
      }`}
    >
      {isSel && (
        <svg
          viewBox="0 0 12 12"
          className="w-3 h-3 text-ink"
          fill="none"
          stroke="currentColor"
          strokeWidth="2.4"
          strokeLinecap="round"
          strokeLinejoin="round"
          aria-hidden
        >
          <polyline points="2 6 5 9 10 3" />
        </svg>
      )}
    </button>
  );
}
