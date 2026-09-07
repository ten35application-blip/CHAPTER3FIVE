import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import PeopleEditor from "./PeopleEditor";

export const metadata = { title: "Who it's for · chapter3five" };

/** Recorder-only, like the share page: their own archive, not a copy. */
export default async function PeoplePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/auth/signin");
  const { data: oracle } = await supabase
    .from("oracles")
    .select("id, name, is_self_archive")
    .eq("id", id)
    .eq("user_id", user.id)
    .eq("is_legacy", true)
    .is("inherited_at", null)
    .is("deleted_at", null)
    .maybeSingle<{ id: string; name: string; is_self_archive: boolean | null }>();
  if (!oracle) redirect("/dashboard");
  return (
    <main className="mx-auto flex w-full max-w-xl flex-col px-5 pb-16 pt-10">
      <p className="text-sm font-semibold uppercase tracking-wider">
        <span className="text-gradient-cta">{oracle.is_self_archive ? "Your code" : `${oracle.name}'s code`}</span>
      </p>
      <h1 className="mt-3 text-3xl font-semibold tracking-tight text-warm-50">Who are you giving this to?</h1>
      <p className="mt-3 text-base leading-relaxed text-warm-300">
        List the people who&rsquo;ll have the code and who they are {oracle.is_self_archive ? "to you" : `to ${oracle.name}`}, in your own words. You can change this any time.
      </p>
      <div className="mt-8">
        <PeopleEditor oracleId={oracle.id} name={oracle.name} isSelf={!!oracle.is_self_archive} />
      </div>
    </main>
  );
}
