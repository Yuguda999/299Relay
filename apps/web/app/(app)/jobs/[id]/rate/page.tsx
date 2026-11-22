"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { Icon } from "@/components/icons";
import { Avatar, Button, Chip, ErrorNote, Field, Footer, Header, Loading, Page, Textarea, cx } from "@/components/ui";
import { displayName, fetchPublicProfiles, useLoad } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { naira } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase } from "@/lib/supabase/client";

const TAGS_FOR_TRAVELER = ["On time", "Friendly", "Careful with items", "Good communication", "Great value"];
const TAGS_FOR_REQUESTER = ["Clear instructions", "On time at handoff", "Friendly", "Quick to reply"];
const TIPS = [0, 5000, 10000, 20000];

export default function Rate() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const { profile, wallet, refresh } = useSession();
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
  if (q.loading || !q.data?.job) return <Loading />;
  const job = q.data.job;
  const isRequester = job.requester_id === profile?.id;
  const other = q.data.people.get(isRequester ? job.traveler_id : job.requester_id);
  const tagList = isRequester ? TAGS_FOR_TRAVELER : TAGS_FOR_REQUESTER;

  async function submit() {
    setBusy(true);
    const { error } = await supabase().rpc("rate_job", { p_job: id, p_stars: stars, p_tags: tags, p_comment: comment || undefined, p_tip: tip });
    setBusy(false);
    if (error) return setError(errorMessage(error));
    void refresh();
    router.replace(`/jobs/${id}`);
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title={isRequester ? "Rate and tip" : "Rate the requester"} />
      <Page className="items-stretch gap-5">
        <div className="flex flex-col items-center gap-2 pt-2">
          <Avatar name={displayName(other)} size={64} />
          <span className="text-[17px] font-semibold">How was {displayName(other)}?</span>
          <div className="flex gap-1" role="radiogroup" aria-label="Stars">
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} type="button" role="radio" aria-checked={stars === n} aria-label={`${n} star${n > 1 ? "s" : ""}`} onClick={() => setStars(n)}
                className={cx("flex size-12 items-center justify-center", n <= stars ? "text-orange" : "text-field")}>
                <Icon name="star" size={34} fill={n <= stars ? "currentColor" : "none"} />
              </button>
            ))}
          </div>
        </div>
        <div className="flex flex-wrap justify-center gap-2">
          {tagList.map((t) => (
            <Chip key={t} on={tags.includes(t)} onClick={() => setTags((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))}>{t}</Chip>
          ))}
        </div>
        <Field label={<>Comment <span className="font-normal text-muted">(optional)</span></>} htmlFor="c">
          <Textarea id="c" rows={2} maxLength={500} value={comment} onChange={(e) => setComment(e.target.value)} />
        </Field>
        {isRequester && (
          <fieldset className="flex flex-col gap-2">
            <legend className="mb-2 text-[13.5px] font-semibold">Add a tip <span className="font-normal text-muted">(all of it goes to {displayName(other).split(" ")[0]})</span></legend>
            <div className="grid grid-cols-4 gap-2">
              {TIPS.map((t) => (
                <Chip key={t} on={tip === t} disabled={t > (wallet?.available ?? 0)} onClick={() => setTip(t)} className="rounded-xl px-1">{t ? naira(t) : "No tip"}</Chip>
              ))}
            </div>
          </fieldset>
        )}
        <ErrorNote>{error}</ErrorNote>
      </Page>
      <Footer>
        <Button loading={busy} disabled={!stars} onClick={submit}>Submit{tip ? ` · tip ${naira(tip)}` : ""}</Button>
      </Footer>
    </div>
  );
}
