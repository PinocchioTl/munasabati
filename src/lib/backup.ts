import { supabase } from "@/integrations/supabase/client";

// Tables exported in the backup (in dependency-safe order for re-insert).
// owner_id is set server-side via DB defaults/triggers — never include it.
const EXPORTABLE = [
  "event_types",
  "clients",
  "decorations",
  "supplies",
  "bookings",
  "booking_decorations",
  "booking_supplies",
  "expenses",
  "notifications",
] as const;

type TableName = (typeof EXPORTABLE)[number];
export type BackupBundle = {
  version: 1;
  exported_at: string;
  app: "munasabati";
  tables: Partial<Record<TableName, any[]>>;
};

export async function exportAllData(): Promise<BackupBundle> {
  const bundle: BackupBundle = {
    version: 1,
    exported_at: new Date().toISOString(),
    app: "munasabati",
    tables: {},
  };
  for (const t of EXPORTABLE) {
    const { data, error } = await supabase.from(t as any).select("*");
    if (error) throw new Error(`فشل تصدير ${t}: ${error.message}`);
    bundle.tables[t] = data || [];
  }
  return bundle;
}

export function downloadBundle(bundle: BackupBundle) {
  const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `munasabati-backup-${new Date().toISOString().slice(0, 10)}.json`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

function stripAuto<T extends Record<string, any>>(row: T, ...extra: string[]): Omit<T, any> {
  const drop = new Set(["owner_id", "created_at", "updated_at", "remaining", "net_profit", ...extra]);
  const out: any = {};
  for (const k of Object.keys(row)) if (!drop.has(k)) out[k] = row[k];
  return out;
}

async function deleteAllOwn() {
  // Order: children first to respect FKs
  const order = [
    "booking_decorations",
    "booking_supplies",
    "expenses",
    "notifications",
    "bookings",
    "decorations",
    "supplies",
    "clients",
    "event_types",
  ];
  for (const t of order) {
    const { error } = await supabase.from(t as any).delete().not("id", "is", null);
    // booking_decorations/booking_supplies don't have id col — fall back
    if (error && /column "id"/.test(error.message)) {
      await supabase.from(t as any).delete().not("booking_id", "is", null);
    }
  }
}

export async function importBundle(bundle: BackupBundle, mode: "merge" | "replace") {
  if (!bundle || bundle.app !== "munasabati" || !bundle.tables) {
    throw new Error("ملف غير صالح");
  }
  if (mode === "replace") await deleteAllOwn();

  const t = bundle.tables;

  // id remap tables (so junctions stay consistent and we never insert old ids)
  const remap: Record<string, Map<string, string>> = {
    event_types: new Map(),
    clients: new Map(),
    decorations: new Map(),
    supplies: new Map(),
    bookings: new Map(),
  };

  async function insertWithRemap(
    table: "event_types" | "clients" | "decorations" | "supplies" | "bookings",
    rows: any[] = [],
    mapRefs: (r: any) => any = (r) => r,
  ) {
    for (const row of rows) {
      const oldId = row.id;
      const payload = stripAuto(mapRefs(row), "id");
      const { data, error } = await supabase.from(table as any).insert(payload as any).select("id").single();
      if (error) throw new Error(`${table}: ${error.message}`);
      const newId = (data as any)?.id as string | undefined;
      if (oldId && newId) remap[table].set(oldId, newId);
    }
  }

  await insertWithRemap("event_types", t.event_types);
  await insertWithRemap("clients", t.clients);
  await insertWithRemap("decorations", t.decorations);
  await insertWithRemap("supplies", t.supplies);

  await insertWithRemap("bookings", t.bookings, (r) => ({
    ...r,
    client_id: r.client_id ? remap.clients.get(r.client_id) ?? null : null,
  }));

  // Junction tables: remap booking_id + decoration_id/supply_id
  for (const bd of t.booking_decorations || []) {
    const booking_id = remap.bookings.get(bd.booking_id);
    const decoration_id = remap.decorations.get(bd.decoration_id);
    if (!booking_id || !decoration_id) continue;
    await supabase.from("booking_decorations").insert({ booking_id, decoration_id, qty: bd.qty || 1 });
  }
  for (const bs of t.booking_supplies || []) {
    const booking_id = remap.bookings.get(bs.booking_id);
    const supply_id = remap.supplies.get(bs.supply_id);
    if (!booking_id || !supply_id) continue;
    await supabase.from("booking_supplies" as any).insert({ booking_id, supply_id, qty: bs.qty || 1 });
  }

  for (const e of t.expenses || []) {
    const payload = stripAuto(
      { ...e, booking_id: e.booking_id ? remap.bookings.get(e.booking_id) ?? null : null },
      "id",
    );
    const { error } = await supabase.from("expenses").insert(payload as any);
    if (error) throw new Error(`expenses: ${error.message}`);
  }

  for (const n of t.notifications || []) {
    const payload = stripAuto(n, "id");
    await supabase.from("notifications").insert(payload as any);
  }

  return {
    bookings: remap.bookings.size,
    clients: remap.clients.size,
    decorations: remap.decorations.size,
    supplies: remap.supplies.size,
    event_types: remap.event_types.size,
  };
}