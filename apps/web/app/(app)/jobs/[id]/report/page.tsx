"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoPicker } from "@/components/app-bits";
import { Button, Chip, ErrorNote, Field, Footer, Header, Notice, Page, Textarea } from "@/components/ui";
import { uploadPhoto } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { supabase } from "@/lib/supabase/client";

const REASONS = [
  { value: "no_show", label: "No-show" },
  { value: "wrong_item", label: "Wrong item" },
  { value: "damaged_item", label: "Damaged item" },
  { value: "overcharged", label: "Overcharged" },
  { value: "safety", label: "Safety concern" },
  { value: "other", label: "Something else" },
];

export default function ReportIssue() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [reason, setReason] = useState("");
  const [details, setDetails] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function submit() {
    setError(null);
    setBusy(true);
    try {
      const paths = await Promise.all(photos.map((f) => uploadPhoto("job-photos", f, id)));
      const { error } = await supabase().rpc("open_dispute", { p_job: id, p_reason: reason, p_details: details, p_photo_paths: paths });
      if (error) throw error;
      router.replace(`/jobs/${id}`);
    } catch (e) {
      setError(errorMessage(e));
      setBusy(false);
    }
  }

  return (
    <div className="flex min-h-dvh flex-col">
      <Header title="Report an issue" />
      <Page className="gap-4">
        <Notice>Reporting pauses payment on this job. An admin reviews both sides within 24 hours and refunds, releases or splits the money.</Notice>
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13.5px] font-semibold">What went wrong?</legend>
          <div className="flex flex-wrap gap-2">
            {REASONS.map((r) => <Chip key={r.value} on={reason === r.value} onClick={() => setReason(r.value)}>{r.label}</Chip>)}
          </div>
        </fieldset>
        <Field label="Details" htmlFor="details">
          <Textarea id="details" rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened, when and where?" />
        </Field>
        <Field label={<>Photos <span className="font-normal text-muted">(item, receipt, place)</span></>}>
          <PhotoPicker files={photos} onChange={setPhotos} max={3} />
        </Field>
        {reason === "safety" && <Notice tone="amber">If you are in danger, go to the nearest porters&apos; lodge or call campus security first.</Notice>}
        <ErrorNote>{error}</ErrorNote>
      </Page>
      <Footer>
        <Button loading={busy} disabled={!reason} onClick={submit}>Submit report</Button>
      </Footer>
    </div>
  );
}
