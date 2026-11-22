"use client";

import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { PhotoPicker } from "@/components/app-bits";
import { Button, Chip, ErrorNote, Field, Footer, Header, Input, Notice, Page, Row, Select, Textarea } from "@/components/ui";
import { uploadPhoto } from "@/lib/data";
import { errorMessage } from "@/lib/errors";
import { lagosToIso, naira, toKobo, TYPE_LABEL } from "@/lib/format";
import { useSession } from "@/lib/session";
import { supabase, type Enums, type Tables } from "@/lib/supabase/client";

type When = "hour" | "today" | "tomorrow";

export function RequestForm({ trip }: { trip?: Tables<"trips"> | null }) {
  const router = useRouter();
  const { places, wallet } = useSession();
  const allowed = trip?.job_types ?? (["buy", "pick_up", "drop_off"] as Enums<"request_type">[]);
  const handoffs = useMemo(() => places.filter((p) => p.is_handoff_point), [places]);

  const [type, setType] = useState<Enums<"request_type">>(allowed[0]!);
  const [items, setItems] = useState("");
  const [photos, setPhotos] = useState<File[]>([]);
  const [fromPick, setFrom] = useState(trip?.to_place_id ?? "");
  const [toPick, setTo] = useState("");
  // Defaults until the user picks: a market to buy from, the first handoff point.
  const from = fromPick || (places.find((p) => p.kind === "market")?.id ?? places[0]?.id ?? "");
  const to = toPick || (handoffs[0]?.id ?? "");
  const [budget, setBudget] = useState("");
  const [when, setWhen] = useState<When>("today");
  const [at, setAt] = useState("18:00");
  const [extra, setExtra] = useState(0); // naira added on top of the suggested fee
  const [quote, setQuote] = useState<{ suggested_fee: number; total_hold: number } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const budgetKobo = type === "buy" ? (toKobo(budget) ?? 0) : 0;
  const urgent = when === "hour";

  useEffect(() => {
    if (!from || !to) return;
    const t = setTimeout(async () => {
      const { data } = await supabase().rpc("quote_request", {
        p_type: type, p_from_place: from, p_handoff_place: to, p_item_budget: budgetKobo, p_urgent: urgent,
      });
      setQuote(data as { suggested_fee: number; total_hold: number } | null);
    }, 250);
    return () => clearTimeout(t);
  }, [type, from, to, budgetKobo, urgent]);

  const fee = (quote?.suggested_fee ?? 0) + extra * 100;
  const total = fee + budgetKobo;
  const short = wallet ? total > wallet.available : false;

  function deadline(): string {
    if (when === "hour") return new Date(Date.now() + 60 * 60_000).toISOString();
    return lagosToIso(when === "tomorrow" ? 1 : 0, at);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (type === "buy" && !budgetKobo) return setError("Enter the item budget.");
    setBusy(true);
    try {
      const photo = photos[0] ? await uploadPhoto("request-photos", photos[0]) : null;
      const { data, error } = await supabase().rpc("create_request", {
        p_type: type,
        p_items_text: items,
        p_from_place: from,
        p_handoff_place: to,
        p_deadline: deadline(),
        p_item_budget: budgetKobo,
        p_fee: fee,
        p_urgent: urgent,
        p_photo_path: photo ?? undefined,
        p_trip: trip?.id,
      });
      if (error) throw error;
      router.replace(`/requests/${data.id}`);
    } catch (err) {
      setError(errorMessage(err));
      setBusy(false);
    }
  }

  const fromLabel = type === "drop_off" ? "Pick it up from" : type === "buy" ? "Buy it at" : "Pick it up at";

  return (
    <form onSubmit={submit} className="flex min-h-dvh flex-col">
      <Header title={trip ? "Send request to trip" : "New request"} />
      <Page className="gap-3.5">
        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13.5px] font-semibold">What kind of job?</legend>
          <div className="grid grid-cols-3 gap-2">
            {allowed.map((t) => (
              <Chip key={t} on={type === t} onClick={() => setType(t)} className="min-h-12 rounded-xl px-1.5 text-[14px]">{TYPE_LABEL[t]}</Chip>
            ))}
          </div>
        </fieldset>

        <Field label={type === "buy" ? "What should they buy?" : "What is it?"} htmlFor="items">
          <Textarea id="items" rows={2} value={items} onChange={(e) => setItems(e.target.value)} required minLength={2} maxLength={1000}
            placeholder={type === "buy" ? "2 tins of milk, 1 carton of Indomie" : "Parcel under the name Aisha Bello"} />
        </Field>

        <Field label={<>Photo <span className="font-normal text-muted">(optional, helps the traveler find it)</span></>}>
          <PhotoPicker files={photos} onChange={setPhotos} max={1} capture="environment" />
        </Field>

        <div className="grid grid-cols-2 gap-2.5">
          <Field label={fromLabel} htmlFor="from">
            <Select id="from" value={from} onChange={(e) => setFrom(e.target.value)} required>
              {places.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
          <Field label="Hand it to me at" htmlFor="to">
            <Select id="to" value={to} onChange={(e) => setTo(e.target.value)} required>
              {handoffs.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </Select>
          </Field>
        </div>

        {type === "buy" && (
          <Field label="Item budget (₦)" htmlFor="budget" hint="If it costs more, your traveler asks before buying.">
            <Input id="budget" inputMode="decimal" value={budget} onChange={(e) => setBudget(e.target.value)} placeholder="3,400" required />
          </Field>
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-[13.5px] font-semibold">When?</legend>
          <div className="flex flex-wrap gap-2">
            <Chip on={when === "hour"} onClick={() => setWhen("hour")}>Within 1 hour (+₦100)</Chip>
            <Chip on={when === "today"} onClick={() => setWhen("today")}>Today</Chip>
            <Chip on={when === "tomorrow"} onClick={() => setWhen("tomorrow")}>Tomorrow</Chip>
          </div>
          {when !== "hour" && (
            <Field label="Before" htmlFor="at" hint="Handoffs happen between 6:00am and 9:00pm.">
              <Input id="at" type="time" min="06:00" max="21:00" value={at} onChange={(e) => setAt(e.target.value)} required />
            </Field>
          )}
        </fieldset>

        <div className="flex items-center justify-between gap-3">
          <span className="text-[13.5px] font-semibold">Add to the fee <span className="font-normal text-muted">(gets picked up faster)</span></span>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="md" aria-label="Less" disabled={extra === 0} onClick={() => setExtra((x) => Math.max(0, x - 50))}>−</Button>
            <span className="w-14 text-center text-[14px] font-semibold">+₦{extra}</span>
            <Button variant="outline" size="md" aria-label="More" onClick={() => setExtra((x) => Math.min(1000, x + 50))}>+</Button>
          </div>
        </div>
        <ErrorNote>{error}</ErrorNote>
      </Page>

      <Footer>
        <div className="flex flex-col gap-1">
          {type === "buy" && <Row label="Item budget" value={naira(budgetKobo)} />}
          <Row label={extra ? "Delivery fee" : "Delivery fee (suggested)"} value={quote ? naira(fee) : "…"} />
          <Row label="Held from wallet" value={quote ? naira(total) : "…"} strong />
        </div>
        {short && <Notice tone="amber">Your wallet has {naira(wallet?.available)}. Top up before posting.</Notice>}
        <Button type="submit" loading={busy} disabled={!quote || short}>Post request</Button>
        <span className="text-center text-[12px] text-muted">Money is only released when you confirm with your handoff code.</span>
      </Footer>
    </form>
  );
}
