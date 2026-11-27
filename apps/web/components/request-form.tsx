"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PhotoPicker } from "@/components/app-bits";
import { DocumentPicker } from "@/components/print";
import { Icon } from "@/components/icons";
import { PlaceSelect } from "@/components/place-select";
import { Alert, Button, ChoiceChips, Field, Footer, Header, MoneyInput, Page, Row, Textarea, TimeSelect } from "@/components/ui";
import { uploadPhoto } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { isPurchase, lagosToIso, naira, toKobo, TYPE_LABEL } from "@/lib/format";
import { DEFAULT_PRINT, estimatePrintNaira, PRINT_LABELS, printSummary, uploadDocuments, type DocDraft, type PrintOptions } from "@/lib/print";
import { useSession } from "@/lib/session";
import { supabase, type Enums, type Tables } from "@/lib/supabase/client";

type When = "hour" | "today" | "tomorrow";

export function RequestForm({ trip }: { trip?: Tables<"trips"> | null }) {
  const router = useRouter();
  const { places, wallet } = useSession();
  const allowed = trip?.job_types ?? (["buy", "print", "pick_up", "drop_off"] as Enums<"request_type">[]);
  const handoffs = useMemo(() => places.filter((p) => p.is_handoff_point), [places]);

  const [type, setType] = useState<Enums<"request_type">>(allowed[0]!);
  const [items, setItems] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [fromPick, setFrom] = useState(trip?.to_place_id ?? "");
  const [toPick, setTo] = useState("");
  const [docs, setDocs] = useState<DocDraft[]>([]);
  const [print, setPrint] = useState<PrintOptions>(DEFAULT_PRINT);
  const [budgetTouched, setBudgetTouched] = useState(false);
  const businessCentre = places.find((p) => /business cent/i.test(p.name))?.id;
  const from = fromPick || (type === "print" ? businessCentre : undefined) || (places.find((p) => p.kind === "market")?.id ?? places[0]?.id ?? "");
  const to = toPick || (handoffs[0]?.id ?? "");
  const [budget, setBudget] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [at, setAt] = useState("18:00");
  const [extra, setExtra] = useState(0);
  const [quote, setQuote] = useState<{ suggested_fee: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const pages = docs.reduce((n, d) => n + (d.pages ?? 0), 0);
  const estimate = estimatePrintNaira(pages, print);
  // Print budget follows the estimate until the requester types their own.
  const budgetText = type === "print" && !budgetTouched ? (estimate ? String(estimate) : "") : budget;
  const budgetKobo = isPurchase(type) ? (toKobo(budgetText) ?? 0) : 0;
  const urgent = when === "hour";

  useEffect(() => {
    if (!from || !to) return;
    const t = setTimeout(async () => {
      const { data } = await supabase().rpc("quote_request", { p_type: type, p_from_place: from, p_handoff_place: to, p_item_budget: budgetKobo, p_urgent: urgent });
      setQuote(data as { suggested_fee: number } | null);
    }, 250);
    return () => clearTimeout(t);
  }, [type, from, to, budgetKobo, urgent]);

  const fee = (quote?.suggested_fee ?? 0) + extra * 100;
  const total = fee + budgetKobo;
  const short = wallet ? total > wallet.available : false;

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (type === "print") {
      if (!docs.length) return setError("Add the documents to print.");
      if (docs.some((d) => !d.pages)) return setError("Enter the number of pages for each document.");
    } else if (items.trim().length < 2) return setError("Say what you need.");
    if (isPurchase(type) && !budgetKobo) return setError(type === "print" ? "Enter the print budget." : "Enter the item budget.");
    setBusy(true);
    try {
      const photo = type !== "print" && photos[0] ? await uploadPhoto("request-photos", photos[0]) : null;
      const files = type === "print" ? await uploadDocuments(docs) : null;
      const text = type === "print" ? [`Print: ${printSummary(pages, print)}`, items.trim()].filter(Boolean).join("\n") : items;
      const { data, error } = await supabase().rpc("create_request", {
        p_type: type, p_items_text: text, p_from_place: from, p_handoff_place: to,
        p_deadline: urgent ? new Date(Date.now() + 3600_000).toISOString() : lagosToIso(when === "tomorrow" ? 1 : 0, at),
        p_item_budget: budgetKobo, p_fee: fee, p_urgent: urgent, p_photo_path: photo ?? undefined, p_trip: trip?.id,
        p_files: files ?? undefined, p_print_options: type === "print" ? print : undefined,
      });
      if (error) throw error;
      router.replace(`/requests/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const fromLabel = type === "drop_off" ? "Pick it up from" : type === "buy" ? "Buy it at" : type === "print" ? "Print it at" : "Pick it up at";

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col" noValidate>
      <Header title={trip ? "Send request to trip" : "New request"} />
      <Page className="gap-4">
        <ChoiceChips aria-label="Kind of job" value={type} onChange={setType} columns={allowed.length}
          options={allowed.map((t) => ({ value: t, label: TYPE_LABEL[t] }))} />

        {type === "print" ? (
          <>
            <Field label="Documents" hint="PDF, Word, PowerPoint or photos, up to 20 MB each. Only the traveler who accepts can open them.">
              <DocumentPicker docs={docs} onChange={setDocs} />
            </Field>
            <div className="grid grid-cols-[auto_1fr] items-center gap-x-4 gap-y-3 rounded-card bg-card p-4 dark:ring-1 dark:ring-glass-border">
              <span className="text-[13.5px] font-medium">Copies</span>
              <div className="flex items-center gap-1.5 justify-self-end">
                <Button variant="surface" size="circle-sm" aria-label="Fewer copies" disabled={print.copies <= 1} onClick={() => setPrint((o) => ({ ...o, copies: o.copies - 1 }))}><Icon name="minus" /></Button>
                <span className="w-8 text-center text-[15px] font-semibold tabular" aria-live="polite">{print.copies}</span>
                <Button variant="surface" size="circle-sm" aria-label="More copies" disabled={print.copies >= 50} onClick={() => setPrint((o) => ({ ...o, copies: o.copies + 1 }))}><Icon name="plus" /></Button>
              </div>
              <span className="text-[13.5px] font-medium">Colour</span>
              <ChoiceChips aria-label="Colour" className="justify-self-end" value={print.color} onChange={(v) => setPrint((o) => ({ ...o, color: v }))}
                options={(["bw", "color"] as const).map((v) => ({ value: v, label: PRINT_LABELS.color[v] }))} />
              <span className="text-[13.5px] font-medium">Sides</span>
              <ChoiceChips aria-label="Sides" className="justify-self-end" value={print.sides} onChange={(v) => setPrint((o) => ({ ...o, sides: v }))}
                options={(["single", "double"] as const).map((v) => ({ value: v, label: v === "single" ? "Single" : "Double" }))} />
              <span className="text-[13.5px] font-medium">Binding</span>
              <ChoiceChips aria-label="Binding" className="justify-self-end" value={print.binding} onChange={(v) => setPrint((o) => ({ ...o, binding: v }))}
                options={(["none", "staple", "spiral"] as const).map((v) => ({ value: v, label: v === "none" ? "None" : v === "staple" ? "Staple" : "Spiral" }))} />
            </div>
            <Field label="Instructions" optional htmlFor="items">
              <Textarea id="items" rows={2} value={items} onChange={(e) => setItems(e.target.value)} maxLength={600}
                placeholder="Print pages 3–10 only, landscape, cover page in colour" />
            </Field>
          </>
        ) : (
          <>
            <Field label={type === "buy" ? "What should they buy?" : "What is it?"} htmlFor="items">
              <Textarea id="items" rows={3} value={items} onChange={(e) => setItems(e.target.value)} maxLength={1000}
                placeholder={type === "buy" ? "2 tins of milk, 1 carton of Indomie" : "Parcel under the name Aisha Bello"} />
            </Field>
            <Field label="Photo" optional hint="Helps the traveler find the right thing.">
              <PhotoPicker files={photos} onChange={setPhotos} max={1} capture="environment" />
            </Field>
          </>
        )}

        <Field label={fromLabel} labelId="from-l">
          <PlaceSelect labelledBy="from-l" value={from} onChange={setFrom} />
        </Field>
        <Field label="Hand it to me at" labelId="to-l" hint="Public handoff points only: gates, porters' lodges, faculty entrances.">
          <PlaceSelect labelledBy="to-l" value={to} onChange={setTo} onlyHandoff />
        </Field>

        {type === "buy" && (
          <Field label="Item budget" htmlFor="budget" hint="If it costs more, your traveler asks before buying.">
            <MoneyInput id="budget" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="3,400" />
          </Field>
        )}
        {type === "print" && (
          <Field label="Print budget" htmlFor="budget"
            hint={estimate ? <>Estimated from <span className="tabular">{pages}</span> pages at typical business-centre prices. Change it if your centre charges differently; unused money comes back.</> : "Add documents and page counts to get an estimate."}>
            <MoneyInput id="budget" value={budgetText} onChange={(e) => { setBudgetTouched(true); setBudget(e.target.value); }} placeholder="600" />
          </Field>
        )}

        <Field label="When?" labelId="when-l">
          <ChoiceChips aria-label="When" value={when} onChange={setWhen}
            options={[{ value: "hour", label: "Within 1 hour" }, { value: "today", label: "Today" }, { value: "tomorrow", label: "Tomorrow" }]} />
        </Field>
        {when === "hour"
          ? <Alert tone="signal">Urgent jobs add ₦100 to the fee.</Alert>
          : <Field label="Before" labelId="at-l" hint="Handoffs happen between 6:00am and 9:00pm.">
              <TimeSelect aria-labelledby="at-l" value={at} onChange={setAt} min="06:30" max="21:00" step={30} />
            </Field>}

        <div className="bento flex items-center justify-between gap-3 p-3 pl-4">
          <span className="flex flex-col">
            <span className="text-[14px] font-medium">Add to the fee</span>
            <span className="text-[12.5px] text-ink-2">Gets picked up faster</span>
          </span>
          <div className="flex items-center gap-1.5">
            <Button variant="surface" size="circle-sm" aria-label="Decrease fee" disabled={extra === 0} onClick={() => setExtra((x) => Math.max(0, x - 50))}><Icon name="minus" /></Button>
            <span className="w-16 text-center text-[14px] font-semibold tabular" aria-live="polite">+₦{extra}</span>
            <Button variant="surface" size="circle-sm" aria-label="Increase fee" disabled={extra >= 1000} onClick={() => setExtra((x) => Math.min(1000, x + 50))}><Icon name="plus" /></Button>
          </div>
        </div>
        <Alert tone="critical">{error}</Alert>
      </Page>

      <Footer>
        <div className="flex flex-col gap-1">
          {isPurchase(type) && <Row label={type === "print" ? "Print budget" : "Item budget"} value={naira(budgetKobo)} />}
          <Row label={extra ? "Delivery fee" : "Delivery fee (suggested)"} value={quote ? naira(fee) : "…"} />
          <Row label="Held from wallet" value={quote ? naira(total) : "…"} strong />
        </div>
        {short && <Alert tone="warn">Your wallet has {naira(wallet?.available)}. Top up before posting.</Alert>}
        <Button type="submit" loading={busy} disabled={!quote || short}>Post request</Button>
        <span className="text-center text-[12px] text-ink-2">Money is released only when you confirm with your handoff code.</span>
      </Footer>
    </form>
  );
}
