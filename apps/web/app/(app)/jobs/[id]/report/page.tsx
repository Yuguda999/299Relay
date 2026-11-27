"use client";

import { useParams, useRouter } from "next/navigation";
import { useState } from "react";
import { PhotoPicker } from "@/components/app-bits";
import { Alert, Button, ChoiceChips, Field, Footer, Header, Page, Textarea, useNotify } from "@/components/ui";
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
  const { toast } = useNotify();
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
      toast({ title: "Report sent", body: "Payment is paused until an admin reviews it." });
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
        <Alert tone="info">Reporting pauses payment on this job. An admin reviews both sides within 24 hours and refunds, releases or splits the money.</Alert>
        <Field label="What went wrong?" labelId="reason-l">
          <ChoiceChips aria-label="What went wrong" value={reason} onChange={setReason} options={REASONS} />
        </Field>
        {reason === "safety" && <Alert tone="critical" title="If you're in danger">Go to the nearest porters&apos; lodge or call campus security first.</Alert>}
        <Field label="Details" htmlFor="details">
          <Textarea id="details" rows={4} maxLength={2000} value={details} onChange={(e) => setDetails(e.target.value)} placeholder="What happened, when and where?" />
        </Field>
        <Field label="Photos" optional hint="The item, the receipt, the place.">
          <PhotoPicker files={photos} onChange={setPhotos} max={3} />
        </Field>
        <Alert tone="critical">{error}</Alert>
      </Page>
      <Footer>
        <Button loading={busy} disabled={!reason} onClick={submit}>Submit report</Button>
      </Footer>
    </div>
  );
}
