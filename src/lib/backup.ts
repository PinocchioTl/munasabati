import { supabase } from "@/integrations/supabase/client";

/**
 * Structured Backup v1.0 — Munasabati
 *
 * One JSON file per owner. Relations are preserved using stable IDs.
 * - bookings[].items.decorations / supplies = [{ id, qty }]
 * - invoices[].booking_id links to a booking
 * - invoices[].items = invoice line items embedded
 *
 * Auto/computed fields (owner_id, remaining, net_profit, code, totals
 * recalculated by triggers) are stripped on export and re-derived on import.
 */

export type BackupV1 = {
  version: "1.0";
  app: "munasabati";
  owner_id: string | null;
  export_date: string;
  data: {
    event_types: any[];
    customers: any[]; // = clients
    decorations: any[];
    supplies: any[];
    bookings: any[]; // each has items.decorations[] / items.supplies[]
    invoices: any[]; // each has items[]
    profits: any[]; // = expenses
    notifications: any[];
  };
};

// Legacy v1 (integer) bundle, still importable
type LegacyBundle = {
  version: 1;
  app: "munasabati";
  exported_at: string;
  tables: Record<string, any[]>;
};

export type BackupBundle = BackupV1 | LegacyBundle;

// ---------- helpers ----------

const AUTO_FIELDS = new Set([
  "owner_id",
  "created_at",
  "updated_at",
  "remaining",
  "net_profit",
  "code",
  "events_count",
  "total_paid",
  "last_event_date",
  "booked_qty",
  "used_qty",
  "bookings_count",
  "total_revenue",
  "payment_status",
  "public_token",
]);

function clean<T extends Record<string, any>>(row: T, extra: string[] = []): any {
  const drop = new Set([...AUTO_FIELDS, ...extra]);
  const out: any = {};
  for (const k of Object.keys(row)) {
    if (drop.has(k)) continue;
    const v = row[k];
    if (v === undefined) continue;
    out[k] = v;
  }
  return out;
}

function dedupeById<T extends { id?: string }>(rows: T[] | null | undefined): T[] {
  if (!rows) return [];
  const seen = new Set<string>();
  const out: T[] = [];
  for (const r of rows) {
    const id = (r as any).id;
    if (id && seen.has(id)) continue;
    if (id) seen.add(id);
    out.push(r);
  }
  return out;
}

// ---------- EXPORT ----------

export async function exportAllData(): Promise<BackupV1> {
  const { data: userData } = await supabase.auth.getUser();
  const owner_id = userData?.user?.id ?? null;

  const [
    eventTypesRes, clientsRes, decorRes, suppRes,
    bookingsRes, bdRes, bsRes,
    invoicesRes, invItemsRes,
    expensesRes, notifsRes,
  ] = await Promise.all([
    supabase.from("event_types").select("*"),
    supabase.from("clients").select("*"),
    supabase.from("decorations").select("*"),
    supabase.from("supplies").select("*"),
    supabase.from("bookings").select("*"),
    supabase.from("booking_decorations").select("*"),
    supabase.from("booking_supplies").select("*"),
    supabase.from("invoices").select("*"),
    supabase.from("invoice_items").select("*"),
    supabase.from("expenses").select("*"),
    supabase.from("notifications").select("*"),
  ]);

  const err = [eventTypesRes, clientsRes, decorRes, suppRes, bookingsRes,
    bdRes, bsRes, invoicesRes, invItemsRes, expensesRes, notifsRes]
    .find(r => r.error)?.error;
  if (err) throw new Error(`فشل التصدير: ${err.message}`);

  const decorIds = new Set((decorRes.data || []).map((d: any) => d.id));
  const suppIds = new Set((suppRes.data || []).map((s: any) => s.id));
  const clientIds = new Set((clientsRes.data || []).map((c: any) => c.id));
  const bookingIds = new Set((bookingsRes.data || []).map((b: any) => b.id));

  // group junctions per booking, filter dangling references
  const decByBooking = new Map<string, { id: string; qty: number }[]>();
  for (const r of dedupeById(bdRes.data as any[])) {
    if (!bookingIds.has(r.booking_id) || !decorIds.has(r.decoration_id)) continue;
    const arr = decByBooking.get(r.booking_id) || [];
    arr.push({ id: r.decoration_id, qty: Number(r.qty) || 1 });
    decByBooking.set(r.booking_id, arr);
  }
  const suppByBooking = new Map<string, { id: string; qty: number }[]>();
  for (const r of dedupeById(bsRes.data as any[])) {
    if (!bookingIds.has(r.booking_id) || !suppIds.has(r.supply_id)) continue;
    const arr = suppByBooking.get(r.booking_id) || [];
    arr.push({ id: r.supply_id, qty: Number(r.qty) || 1 });
    suppByBooking.set(r.booking_id, arr);
  }

  const itemsByInvoice = new Map<string, any[]>();
  for (const it of dedupeById(invItemsRes.data as any[])) {
    const arr = itemsByInvoice.get(it.invoice_id) || [];
    arr.push({
      name: it.name,
      qty: Number(it.qty) || 1,
      unit_price: Number(it.unit_price) || 0,
      line_total: Number(it.line_total) || 0,
      position: Number(it.position) || arr.length,
    });
    itemsByInvoice.set(it.invoice_id, arr);
  }

  const bookings = dedupeById(bookingsRes.data as any[]).map((b: any) => {
    const base = clean(b);
    // drop dangling client_id
    if (base.client_id && !clientIds.has(base.client_id)) base.client_id = null;
    base.items = {
      decorations: decByBooking.get(b.id) || [],
      supplies: suppByBooking.get(b.id) || [],
    };
    base.event_type = String(b.event_type || "wedding").trim();
    return base;
  });

  const invoices = dedupeById(invoicesRes.data as any[]).map((i: any) => {
    const base = clean(i);
    if (base.client_id && !clientIds.has(base.client_id)) base.client_id = null;
    if (base.booking_id && !bookingIds.has(base.booking_id)) base.booking_id = null;
    base.items = itemsByInvoice.get(i.id) || [];
    return base;
  });

  const expenses = dedupeById(expensesRes.data as any[]).map((e: any) => {
    const base = clean(e);
    if (base.booking_id && !bookingIds.has(base.booking_id)) base.booking_id = null;
    return base;
  });

  return {
    version: "1.0",
    app: "munasabati",
    owner_id,
    export_date: new Date().toISOString(),
    data: {
      event_types: dedupeById(eventTypesRes.data as any[]).map(r => clean(r)),
      customers: dedupeById(clientsRes.data as any[]).map(r => clean(r)),
      decorations: dedupeById(decorRes.data as any[]).map(r => clean(r)),
      supplies: dedupeById(suppRes.data as any[]).map(r => clean(r)),
      bookings,
      invoices,
      profits: expenses,
      notifications: dedupeById(notifsRes.data as any[]).map(r => clean(r, ["read"])),
    },
  };
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

// ---------- IMPORT ----------

async function deleteAllOwn() {
  // children first
  await supabase.from("booking_decorations").delete().not("booking_id", "is", null);
  await supabase.from("booking_supplies").delete().not("booking_id", "is", null);
  await supabase.from("invoice_items").delete().not("invoice_id", "is", null);
  await supabase.from("expenses").delete().not("id", "is", null);
  await supabase.from("notifications").delete().not("id", "is", null);
  await supabase.from("invoices").delete().not("id", "is", null);
  await supabase.from("bookings").delete().not("id", "is", null);
  await supabase.from("decorations").delete().not("id", "is", null);
  await supabase.from("supplies").delete().not("id", "is", null);
  await supabase.from("clients").delete().not("id", "is", null);
  await supabase.from("event_types").delete().not("id", "is", null);
}

function normalize(bundle: BackupBundle): BackupV1 {
  if (!bundle || (bundle as any).app !== "munasabati") {
    throw new Error("ملف غير صالح");
  }
  if ((bundle as any).version === "1.0" && (bundle as any).data) {
    return bundle as BackupV1;
  }
  // legacy v1 → v1.0
  const legacy = bundle as LegacyBundle;
  const t = legacy.tables || {};
  const decByBooking = new Map<string, { id: string; qty: number }[]>();
  for (const r of t.booking_decorations || []) {
    const a = decByBooking.get(r.booking_id) || [];
    a.push({ id: r.decoration_id, qty: Number(r.qty) || 1 });
    decByBooking.set(r.booking_id, a);
  }
  const supByBooking = new Map<string, { id: string; qty: number }[]>();
  for (const r of t.booking_supplies || []) {
    const a = supByBooking.get(r.booking_id) || [];
    a.push({ id: r.supply_id, qty: Number(r.qty) || 1 });
    supByBooking.set(r.booking_id, a);
  }
  const bookings = (t.bookings || []).map((b: any) => ({
    ...b,
    items: { decorations: decByBooking.get(b.id) || [], supplies: supByBooking.get(b.id) || [] },
  }));
  return {
    version: "1.0",
    app: "munasabati",
    owner_id: null,
    export_date: legacy.exported_at || new Date().toISOString(),
    data: {
      event_types: t.event_types || [],
      customers: t.clients || [],
      decorations: t.decorations || [],
      supplies: t.supplies || [],
      bookings,
      invoices: [],
      profits: t.expenses || [],
      notifications: t.notifications || [],
    },
  };
}

export async function importBundle(input: BackupBundle, mode: "merge" | "replace") {
  const bundle = normalize(input);
  if (mode === "replace") await deleteAllOwn();

  const remapClient = new Map<string, string>();
  const remapDecor = new Map<string, string>();
  const remapSupp = new Map<string, string>();
  const remapBooking = new Map<string, string>();
  const remapEvent = new Map<string, string>();
  const remapInvoice = new Map<string, string>();

  const insertOne = async (
    table: string,
    row: any,
    remap?: Map<string, string>,
  ) => {
    const oldId = row.id;
    const payload = clean(row, ["id", "items"]);
    const { data, error } = await supabase
      .from(table as any)
      .insert(payload as any)
      .select("id")
      .single();
    if (error) throw new Error(`${table}: ${error.message}`);
    const newId = (data as any)?.id as string | undefined;
    if (remap && oldId && newId) remap.set(oldId, newId);
    return newId;
  };

  for (const r of bundle.data.event_types || []) await insertOne("event_types", r, remapEvent);
  for (const r of bundle.data.customers || []) await insertOne("clients", r, remapClient);
  for (const r of bundle.data.decorations || []) await insertOne("decorations", r, remapDecor);
  for (const r of bundle.data.supplies || []) await insertOne("supplies", r, remapSupp);

  for (const b of bundle.data.bookings || []) {
    const items = b.items || { decorations: [], supplies: [] };
    const row = {
      ...b,
      client_id: b.client_id ? remapClient.get(b.client_id) ?? null : null,
    };
    const newId = await insertOne("bookings", row, remapBooking);
    if (!newId) continue;
    for (const d of items.decorations || []) {
      const decoration_id = remapDecor.get(d.id);
      if (!decoration_id) continue;
      await supabase.from("booking_decorations").insert({
        booking_id: newId, decoration_id, qty: Number(d.qty) || 1,
      });
    }
    for (const s of items.supplies || []) {
      const supply_id = remapSupp.get(s.id);
      if (!supply_id) continue;
      await supabase.from("booking_supplies" as any).insert({
        booking_id: newId, supply_id, qty: Number(s.qty) || 1,
      });
    }
  }

  for (const inv of bundle.data.invoices || []) {
    const items = Array.isArray(inv.items) ? inv.items : [];
    const row = {
      ...inv,
      client_id: inv.client_id ? remapClient.get(inv.client_id) ?? null : null,
      booking_id: inv.booking_id ? remapBooking.get(inv.booking_id) ?? null : null,
    };
    const newId = await insertOne("invoices", row, remapInvoice);
    if (!newId) continue;
    for (const it of items) {
      await supabase.from("invoice_items").insert({
        invoice_id: newId,
        name: it.name,
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
        line_total: Number(it.line_total) || (Number(it.qty) || 1) * (Number(it.unit_price) || 0),
        position: Number(it.position) || 0,
      });
    }
  }

  for (const e of bundle.data.profits || []) {
    const row = {
      ...e,
      booking_id: e.booking_id ? remapBooking.get(e.booking_id) ?? null : null,
    };
    await insertOne("expenses", row);
  }

  for (const n of bundle.data.notifications || []) {
    await insertOne("notifications", n);
  }

  return {
    customers: remapClient.size,
    bookings: remapBooking.size,
    decorations: remapDecor.size,
    supplies: remapSupp.size,
    invoices: remapInvoice.size,
    event_types: remapEvent.size,
  };
}