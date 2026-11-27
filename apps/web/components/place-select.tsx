"use client";

import { Select, useNotify, type CreateOption, type Option } from "@/components/ui";
import { errorMessage } from "@/lib/errors";
import { useSession } from "@/lib/session";
import type { Tables } from "@/lib/supabase/client";

// Group order in the picker: campus spots first, then around town, then the rest.
const GROUPS: [Tables<"places">["kind"], string][] = [
  ["hostel", "Hostels"], ["gate", "Gates"], ["faculty", "Faculties"], ["office", "Offices"],
  ["market", "Markets"], ["area", "Around Zaria"], ["other", "Other"],
];
const GROUP = Object.fromEntries(GROUPS.map(([k, g], i) => [k, { g, i }]));

export function placeOptions(places: Tables<"places">[], onlyHandoff = false): Option[] {
  return places
    .filter((p) => !onlyHandoff || p.is_handoff_point)
    .sort((a, b) => (GROUP[a.kind]?.i ?? 99) - (GROUP[b.kind]?.i ?? 99) || a.name.localeCompare(b.name))
    .map((p) => ({
      value: p.id, label: p.name, group: GROUP[p.kind]?.g ?? "Other",
      hint: p.is_handoff_point ? "Handoff point" : p.added_by ? "Added by a student" : undefined,
    }));
}

const CREATE: CreateOption[] = [
  { key: "campus", label: (q) => `Add “${q}” on campus`, hint: "A spot inside ABU" },
  { key: "town", label: (q) => `Add “${q}” around Zaria`, hint: "Off campus: Samaru, PZ, Zango…" },
];

/** Place picker. Unless handoff-only, students can add a place that isn't listed. */
export function PlaceSelect({ value, onChange, onlyHandoff, exclude, labelledBy, placeholder = "Choose a place" }: {
  value: string; onChange: (id: string) => void; onlyHandoff?: boolean; exclude?: string; labelledBy: string; placeholder?: string;
}) {
  const { places, addPlace } = useSession();
  const { toast } = useNotify();
  const options = placeOptions(places, onlyHandoff).map((o) => (o.value === exclude ? { ...o, disabled: true } : o));

  async function create(name: string, key: string) {
    try {
      const p = await addPlace(name, key === "town");
      if (p.id === exclude) {
        toast({ title: "Pick a different place", body: `${p.name} is already chosen.`, tone: "critical" });
        return null;
      }
      // `places` is the list from before this add: only announce genuinely new places.
      if (!places.some((x) => x.id === p.id)) toast({ title: `${p.name} added`, body: "Everyone on campus can now pick it." });
      return p.id;
    } catch (e) {
      toast({ title: "Couldn't add that place", body: errorMessage(e), tone: "critical" });
      return null;
    }
  }

  return (
    <Select aria-labelledby={labelledBy} value={value} onChange={onChange} options={options} placeholder={placeholder}
      searchPlaceholder={onlyHandoff ? "Search handoff points" : "Search or add a place"}
      createOptions={onlyHandoff ? undefined : CREATE} onCreate={onlyHandoff ? undefined : create} />
  );
}
