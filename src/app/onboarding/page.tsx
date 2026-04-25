import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Orb } from "@/components/Orb";
import { startOnboarding } from "./actions";

export const metadata = {
  title: "Welcome — chapter3five",
};

export default async function OnboardingPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  const { error } = await searchParams;

  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/auth");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("oracle_name, mode, preferred_language, onboarding_completed")
    .eq("id", user.id)
    .single();

  if (profile?.onboarding_completed) {
    redirect("/dashboard");
  }

  return (
    <main className="flex-1 flex flex-col items-center px-6 py-16 relative overflow-hidden">
      <div className="absolute top-32 left-1/2 -translate-x-1/2 pointer-events-none opacity-30">
        <Orb size={420} />
      </div>

      <div className="relative w-full max-w-2xl flex flex-col items-center text-center pt-32">
        <Link
          href="/"
          className="font-serif text-xl tracking-tight text-warm-100 hover:text-warm-50 transition-colors mb-12"
        >
          chapter3five
        </Link>

        <h1 className="font-serif text-4xl sm:text-5xl text-warm-50 mb-4 leading-tight">
          <span className="italic font-light">Begin a chapter.</span>
        </h1>
        <p className="text-warm-200 text-lg mb-16 max-w-lg leading-relaxed">
          Before we start, three small choices.
        </p>

        <form
          action={startOnboarding}
          className="w-full space-y-12 text-left"
        >
          <Field label="What will you call your oracle?" hint="Could be a name, a nickname — whatever feels right.">
            <input
              type="text"
              name="oracle_name"
              required
              maxLength={48}
              defaultValue={profile?.oracle_name ?? ""}
              placeholder="Mom · Dad · Sage · Alex"
              className="w-full h-12 rounded-full bg-warm-700/30 border border-warm-400/30 px-5 text-warm-50 placeholder:text-warm-400 focus:outline-none focus:border-warm-200 transition-colors"
            />
          </Field>

          <Field label="Who is this chapter for?" hint="You choose once — this shapes the whole experience.">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ModeRadio
                value="real"
                defaultChecked={profile?.mode !== "randomize"}
                title="Someone real"
                body="You'll answer 355 questions yourself, or with the person you love. One real answer per question, taken at your pace."
              />
              <ModeRadio
                value="randomize"
                defaultChecked={profile?.mode === "randomize"}
                title="Randomize"
                body="We'll generate a fictional persona for you in seconds. Three answer variants per question. A character you can chat with."
              />
            </div>
          </Field>

          <Field label="Language" hint="You can change it later.">
            <div className="flex gap-3">
              <LangRadio
                value="en"
                label="English"
                defaultChecked={profile?.preferred_language !== "es"}
              />
              <LangRadio
                value="es"
                label="Español"
                defaultChecked={profile?.preferred_language === "es"}
              />
            </div>
          </Field>

          {error && (
            <p className="text-sm text-red-300/80 text-center">{error}</p>
          )}

          <div className="flex justify-center pt-4">
            <button
              type="submit"
              className="h-12 px-10 rounded-full bg-warm-50 text-ink font-medium hover:bg-warm-100 transition-colors"
            >
              Continue
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-3">
      <div>
        <h2 className="font-serif text-2xl text-warm-50">{label}</h2>
        {hint && (
          <p className="text-sm text-warm-300 mt-1 leading-relaxed">{hint}</p>
        )}
      </div>
      {children}
    </div>
  );
}

function ModeRadio({
  value,
  title,
  body,
  defaultChecked,
}: {
  value: "real" | "randomize";
  title: string;
  body: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-2xl border border-warm-400/30 bg-warm-700/20 p-5 hover:bg-warm-700/40 transition-colors has-[:checked]:border-warm-200 has-[:checked]:bg-warm-700/50 block">
      <input
        type="radio"
        name="mode"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
        required
      />
      <h3 className="font-serif text-xl text-warm-50 mb-2">{title}</h3>
      <p className="text-sm text-warm-200 leading-relaxed">{body}</p>
    </label>
  );
}

function LangRadio({
  value,
  label,
  defaultChecked,
}: {
  value: "en" | "es";
  label: string;
  defaultChecked?: boolean;
}) {
  return (
    <label className="cursor-pointer rounded-full border border-warm-400/30 bg-warm-700/20 px-6 h-11 inline-flex items-center text-warm-100 hover:bg-warm-700/40 transition-colors has-[:checked]:border-warm-200 has-[:checked]:bg-warm-700/50 has-[:checked]:text-warm-50">
      <input
        type="radio"
        name="language"
        value={value}
        defaultChecked={defaultChecked}
        className="sr-only"
      />
      {label}
    </label>
  );
}
