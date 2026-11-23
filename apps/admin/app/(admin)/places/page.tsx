"use client";

import { useState } from "react";
import { PageTitle, Table } from "@/components/shell";
import { Button, Card, ErrorNote, Field, Input, Pill, Select } from "@/components/ui";
import { useAdmin } from "@/lib/admin";
import { errorMessage } from "@/lib/errors";
import { naira, toKobo } from "@/lib/format";
import { supabase, type Enums, type Tables } from "@/lib/supabase/client";

const KINDS: Enums<"place_kind">[] = ["market", "gate", "hostel", "faculty", "office", "other"];
const blank = { name: "", kind: "gate" as Enums<"place_kind">, zone: "", is_handoff_point: true };

export default function Places() {
  const { me, campus, places, reloadCampus } = useAdmin();
  const [form, setForm] = useState(blank);
  const [editing, setEditing] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function save() {
    setError(null);
    if (!form.name.trim() || !form.zone.trim()) return setError("Name and zone are required.");
    const db = supabase();
    const row = { ...form, name: form.name.trim(), zone: form.zone.trim().toLowerCase() };
    const { error } = editing
      ? await db.from("places").update(row).eq("id", editing)
      : await db.from("places").insert({ ...row, campus_id: me.campus_id });
    if (error) return setError(error.code === "23505" ? "A place with that name already exists." : errorMessage(error));
    setForm(blank);
    setEditing(null);
    void reloadCampus();
  }

  async function toggle(p: Tables<"places">) {
    const { error } = await supabase().from("places").update({ active: !p.active }).eq("id", p.id);
    if (error) return setError(errorMessage(error));
    void reloadCampus();
  }

  return (
    <>
      <PageTitle title="Places and rules" sub="Students pick from this list. Handoffs only happen at handoff points." />
      {campus && <CampusRules campus={campus} onSaved={() => void reloadCampus()} />}

      <Card className="flex flex-col gap-3 p-5">
        <h2 className="text-[15px] font-bold">{editing ? "Edit place" : "Add a place"}</h2>
        <div className="grid gap-3 md:grid-cols-4">
          <Field label="Name" htmlFor="pn"><Input id="pn" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} /></Field>
          <Field label="Kind" htmlFor="pk">
            <Select id="pk" value={form.kind} onChange={(e) => setForm({ ...form, kind: e.target.value as Enums<"place_kind"> })}>
              {KINDS.map((k) => <option key={k} value={k}>{k}</option>)}
            </Select>
          </Field>
          <Field label="Zone" htmlFor="pz" hint="Same zone = cheaper fee"><Input id="pz" value={form.zone} onChange={(e) => setForm({ ...form, zone: e.target.value })} /></Field>
          <label className="flex items-center gap-2 self-center pt-5 text-[14px] font-medium">
            <input type="checkbox" checked={form.is_handoff_point} onChange={(e) => setForm({ ...form, is_handoff_point: e.target.checked })} className="size-5 accent-navy" />
            Public handoff point
          </label>
        </div>
        <ErrorNote>{error}</ErrorNote>
        <div className="flex gap-2">
          <Button size="md" onClick={save}>{editing ? "Save changes" : "Add place"}</Button>
          {editing && <Button size="md" variant="outline" onClick={() => { setEditing(null); setForm(blank); }}>Cancel</Button>}
        </div>
      </Card>

      <Table head={["Name", "Kind", "Zone", "Handoff point", "Status", ""]}>
        {places.map((p) => (
          <tr key={p.id} className={p.active ? "" : "opacity-50"}>
            <td className="px-4 py-3 font-semibold">{p.name}</td>
            <td className="px-4 py-3">{p.kind}</td>
            <td className="px-4 py-3">{p.zone}</td>
            <td className="px-4 py-3">{p.is_handoff_point ? <Pill tone="success">Yes</Pill> : "—"}</td>
            <td className="px-4 py-3">{p.active ? "Active" : "Retired"}</td>
            <td className="flex gap-2 px-4 py-3">
              <Button size="md" variant="soft" onClick={() => { setEditing(p.id); setForm({ name: p.name, kind: p.kind, zone: p.zone, is_handoff_point: p.is_handoff_point }); }}>Edit</Button>
              <Button size="md" variant="outline" onClick={() => toggle(p)}>{p.active ? "Retire" : "Restore"}</Button>
            </td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function CampusRules({ campus, onSaved }: { campus: Tables<"campuses">; onSaved: () => void }) {
  const [curfew, setCurfew] = useState(campus.handoff_curfew.slice(0, 5));
  const [capNew, setCapNew] = useState(String(campus.item_cap_new / 100));
  const [capTrusted, setCapTrusted] = useState(String(campus.item_cap_trusted / 100));
  const [msg, setMsg] = useState<string | null>(null);

  async function save() {
    const a = toKobo(capNew), b = toKobo(capTrusted);
    if (!a || !b) return setMsg("Enter both caps.");
    const { error } = await supabase().rpc("admin_update_campus", { p_curfew: curfew, p_item_cap_new: a, p_item_cap_trusted: b });
    if (error) return setMsg(errorMessage(error));
    setMsg("Saved.");
    onSaved();
  }

  return (
    <Card className="flex flex-col gap-3 p-5">
      <h2 className="text-[15px] font-bold">{campus.name}</h2>
      <div className="grid gap-3 md:grid-cols-4">
        <Field label="No handoffs after" htmlFor="cf"><Input id="cf" type="time" value={curfew} onChange={(e) => { setCurfew(e.target.value); setMsg(null); }} /></Field>
        <Field label="Item cap, new users (₦)" htmlFor="c1" hint={`Now ${naira(campus.item_cap_new)}`}><Input id="c1" inputMode="decimal" value={capNew} onChange={(e) => { setCapNew(e.target.value); setMsg(null); }} /></Field>
        <Field label="Item cap, trusted (₦)" htmlFor="c2" hint="10+ jobs, rating ≥ 4.5"><Input id="c2" inputMode="decimal" value={capTrusted} onChange={(e) => { setCapTrusted(e.target.value); setMsg(null); }} /></Field>
        <div className="flex items-end gap-3 pb-1"><Button size="md" onClick={save}>Save rules</Button>{msg && <span className="text-[13px] text-muted">{msg}</span>}</div>
      </div>
    </Card>
  );
}
