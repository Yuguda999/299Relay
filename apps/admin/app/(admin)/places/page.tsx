"use client";

import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Alert, Button, Card, Checkbox, Dialog, Field, Input, MoneyInput, Select, StatusChip, TimeSelect, useNotify } from "@/components/ui";
import { useAdmin } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { naira, toKobo } from "@/lib/format";
import { supabase, type Enums, type Tables } from "@/lib/supabase/client";

const KINDS: Enums<"place_kind">[] = ["hostel", "gate", "faculty", "office", "market", "area", "other"];
const KIND_LABEL: Record<Enums<"place_kind">, string> = {
  hostel: "Hostel", gate: "Gate", faculty: "Faculty", office: "Office", market: "Market", area: "Around Zaria", other: "Other",
};
const blank = { name: "", kind: "gate" as Enums<"place_kind">, zone: "", is_handoff_point: true };

export default function Places() {
  const { me, campus, places, reloadCampus } = useAdmin();
  const { confirm, toast } = useNotify();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Student-added places waiting for a look go first.
  const toReview = places.filter((p) => p.added_by && !p.reviewed_at && p.active);
  const sorted = [...toReview, ...places.filter((p) => !toReview.includes(p))];

  function edit(p?: Tables<"places">) {
    setError(null);
    setEditing(p?.id ?? null);
    setForm(p ? { name: p.name, kind: p.kind, zone: p.zone, is_handoff_point: p.is_handoff_point } : blank);
    setOpen(true);
  }

  async function save() {
    setError(null);
    if (!form.name.trim() || !form.zone.trim()) return setError("Name and zone are required.");
    const db = supabase();
    // Editing a student-added place counts as reviewing it.
    const row = { ...form, name: form.name.trim(), zone: form.zone.trim().toLowerCase(), ...(editing ? { reviewed_at: new Date().toISOString() } : {}) };
    const { error } = editing ? await db.from("places").update(row).eq("id", editing) : await db.from("places").insert({ ...row, campus_id: me.campus_id });
    if (error) return setError(error.code === "23505" ? "A place with that name already exists." : errorMessage(error));
    toast({ title: editing ? "Place updated" : "Place added" });
    setOpen(false);
    void reloadCampus();
  }

  async function review(p: Tables<"places">) {
    const { error } = await supabase().from("places").update({ reviewed_at: new Date().toISOString() }).eq("id", p.id);
    if (error) return toast({ title: "Not saved", body: errorMessage(error), tone: "critical" });
    toast({ title: `${p.name} kept` });
    void reloadCampus();
  }

  async function toggle(p: Tables<"places">) {
    if (p.active && !(await confirm({ title: `Retire ${p.name}?`, body: "Students won't be able to pick it. Existing jobs keep it.", confirmLabel: "Retire", tone: "danger" }))) return;
    const { error } = await supabase().from("places").update({ active: !p.active }).eq("id", p.id);
    if (error) return toast({ title: "Not saved", body: errorMessage(error), tone: "critical" });
    toast({ title: p.active ? "Place retired" : "Place restored" });
    void reloadCampus();
  }

  return (
    <>
      <PageTitle title="Places and rules" sub="Students pick from this list. Handoffs only happen at handoff points." right={<Button size="pill" onClick={() => edit()}>Add place</Button>} />
      {campus && <CampusRules key={campus.updated_at} campus={campus} onSaved={() => void reloadCampus()} />}
      {toReview.length > 0 && (
        <Alert tone="info">
          {toReview.length} {toReview.length === 1 ? "place was" : "places were"} added by students. Keep, edit or retire them below.
        </Alert>
      )}
      <Table head={["Name", "Kind", "Zone", "Handoff point", "Status", ""]}>
        {sorted.map((p) => (
          <tr key={p.id} className={p.active ? "" : "opacity-55"}>
            <td className="font-semibold">
              {p.name}
              {p.added_by && !p.reviewed_at && <StatusChip tone="warn" className="ml-2">Added by student</StatusChip>}
            </td>
            <td className="text-ink-2">{KIND_LABEL[p.kind]}</td>
            <td className="font-mono text-[12px]">{p.zone}</td>
            <td>{p.is_handoff_point ? <StatusChip tone="ok">Handoff</StatusChip> : <span className="text-ink-3">—</span>}</td>
            <td><StatusChip tone={p.active ? "live" : "muted"}>{p.active ? "Active" : "Retired"}</StatusChip></td>
            <td className="text-right whitespace-nowrap">
              {p.added_by && !p.reviewed_at && p.active && <Button size="sm" variant="ghost" onClick={() => review(p)}>Keep</Button>}
              <Button size="sm" variant="ghost" onClick={() => edit(p)}>Edit</Button>
              <Button size="sm" variant="ghost" onClick={() => toggle(p)}>{p.active ? "Retire" : "Restore"}</Button>
            </td>
          </tr>
        ))}
      </Table>

      <Dialog open={open} onClose={() => setOpen(false)} title={editing ? "Edit place" : "Add a place"} size="md"
        footer={<><Button variant="surface" size="pill" onClick={() => setOpen(false)}>Cancel</Button><Button size="pill" onClick={save}>{editing ? "Save changes" : "Add place"}</Button></>}>
        <div className="flex flex-col gap-4">
          <Field label="Name" htmlFor="pn"><Input id="pn" data-autofocus value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <div className="grid grid-cols-2 gap-3">
            <Field label="Kind" labelId="pk-l">
              <Select aria-labelledby="pk-l" value={form.kind} onChange={(v) => setForm({ ...form, kind: v })} options={KINDS.map((k) => ({ value: k, label: KIND_LABEL[k] }))} />
            </Field>
            <Field label="Zone" htmlFor="pz" hint="Same zone = cheaper fee"><Input id="pz" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></Field>
          </div>
          <Checkbox checked={form.is_handoff_point} onChange={(v) => setForm({ ...form, is_handoff_point: v })}>Public handoff point (gate, porters&apos; lodge, faculty entrance)</Checkbox>
          <Alert tone="critical">{error}</Alert>
        </div>
      </Dialog>
    </>
  );
}

function CampusRules({ campus, onSaved }: { campus: Tables<"campuses">; onSaved: () => void }) {
  const { toast } = useNotify();
  const [curfew, setCurfew] = useState(campus.handoff_curfew.slice(0, 5));
  const [capNew, setCapNew] = useState(String(campus.item_cap_new / 100));
  const [capTrusted, setCapTrusted] = useState(String(campus.item_cap_trusted / 100));
  const [error, setError] = useState<string | null>(null);

  async function save() {
    const a = toKobo(capNew), b = toKobo(capTrusted);
    if (!a || !b) return setError("Enter both caps.");
    setError(null);
    const { error } = await supabase().rpc("admin_update_campus", { p_curfew: curfew, p_item_cap_new: a, p_item_cap_trusted: b });
    if (error) return setError(errorMessage(error));
    toast({ title: "Campus rules saved" });
    onSaved();
  }

  return (
    <Card className="flex flex-col gap-4 p-5">
      <h2 className="font-display text-[17px] font-semibold tracking-[-0.01em]">{campus.name}</h2>
      <div className="grid gap-4 md:grid-cols-3">
        <Field label="No handoffs after" labelId="cf-l"><TimeSelect aria-labelledby="cf-l" value={curfew} onChange={setCurfew} min="17:00" max="23:00" step={30} /></Field>
        <Field label="Item cap, new users" htmlFor="c1" hint={<>Now <span className="tabular">{naira(campus.item_cap_new)}</span></>}><MoneyInput id="c1" value={capNew} onChange={(e) => setCapNew(e.target.value)} /></Field>
        <Field label="Item cap, trusted" htmlFor="c2" hint="10+ jobs and rating ≥ 4.5"><MoneyInput id="c2" value={capTrusted} onChange={(e) => setCapTrusted(e.target.value)} /></Field>
      </div>
      <Alert tone="critical">{error}</Alert>
      <Button size="pill" variant="inverse" className="self-end" onClick={save}>Save rules</Button>
    </Card>
  );
}
