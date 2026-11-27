"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Alert, Avatar, Button, ChoiceChips, Field, Footer, Header, Loading, Page, Textarea, cn, useNotify } from "@/components/ui";
import { displayName, fetchPublicProfiles, useLoad } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { naira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

const TAGS_FOR_TRAVELER = ["On time", "Friendly", "Careful with items", "Good communication", "Great value"];
const TAGS_FOR_REQUESTER = ["Clear instructions", "On time at handoff", "Friendly", "Quick to reply"];
const TIPS = [0, 5000, 10000, 20000];
const LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

export default function Rate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, wallet, refresh } = useSession();
  const { toast } = useNotify();
  const [stars, setStars] = useState(0);
  const [tags, setTags] = useState<string[]>([]);
  const [comment, setComment] = useState("");
  const [tip, setTip] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const q = useLoad(async () => {
    const { data: job } = await supabase().from("jobs").select("*").eq("id", id).single();
    const people = job ? await fetchPublicProfiles([job.requester_id, job.traveler_id]) : new Map();
    return { job, people };
  }, [id]);
  if (q.loading || !q.data?.job) return <><Header title="Rate" /><Loading /></>;
  const job = q.data.job;
  const isRequester = job.requester_id === profile?.id;
  const other = q.data.people.get(isRequester ? job.traveler_id : job.requester_id);

  async function submit() {
    setBusy(true);
    const { error } = await supabase().rpc("rate_job", { p_job: id, p_stars: stars, p_tags: tags, p_comment: comment || undefined, p_tip: tip });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    void refresh();
    toast({ title: "Thanks for rating", body: tip ? `${naira(tip)} tip sent.` : undefined });
    router.replace(`/jobs/${id}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={isRequester ? "Rate and tip" : "Rate the requester"} />
      <Page className="gap-5">
        <div className="flex flex-col items-center gap-3 pt-2 text-center">
          <Avatar name={displayName(other)} size={64} />
          <span className="font-display text-[19px] font-semibold tracking-[-0.01em]">How was {displayName(other)}?</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)}
                className={cn("grid size-12 place-items-center rounded-full outline-none transition-transform focus-visible:ring-2 focus-visible:ring-ring active:scale-90",
                  n <= stars ? "text-signal" : "text-foreground/20")}>
                <Icon name="star" className="size-8" fill={n <= stars ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
          <span className="h-4 font-mono text-[11px] tracking-[0.2em] text-ink-2 uppercase" aria-live="polite">{LABELS[stars]}</span>
        </div>
        <ChoiceChips aria-label="What stood out" className="justify-center" value={tags}
          onChange={(t) => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}
          options={(isRequester ? TAGS_FOR_TRAVELER : TAGS_FOR_REQUESTER).map((t) => ({ value: t, label: t }))} />
        <Field label="Comment" optional htmlFor="c">
          <Textarea id="c" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        {isRequester && (
          <Field label={`Add a tip · all of it goes to ${displayName(other).split(" ")[0]}`} labelId="tip-l">
            <ChoiceChips aria-label="Tip" value={tip} onChange={setTip} columns={4}
              options={TIPS.map((t) => ({ value: t, label: t ? naira(t) : "None", disabled: t > (wallet?.available ?? 0) }))} />
          </Field>
        )}
        <Alert tone="critical">{error}</Alert>
      </Page>
      <Footer>
        <Button loading={busy} disabled={!stars} onClick={submit}>Submit{tip ? ` · tip ${naira(tip)}` : ""}</Button>
      </Footer>
    </div>
  );
}
