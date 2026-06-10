import { supabase } from "@/integrations/supabase/client";

/**
 * Structured Backup v1.1 — Munasabati
 *
 * One JSON file per owner. Relations are preserved using stable IDs.
 * - bookings[].items.decorations / supplies = [{ id, qty }]
 * - invoices[].booking_id links to a booking
 * - invoices[].items = invoice line items embedded
 * - settings = profile/branding/booking settings for the owner
 *
 * Auto/computed fields (owner_id, remaining, net_profit, code, totals
 * recalculated by triggers) are stripped on export and re-derived on import.
 *
 * Import is RESILIENT:
 *  - unknown/missing tables are skipped with a warning
 *  - missing/extra fields are tolerated (PostgREST will reject only required ones)
 *  - per-row failures collect warnings and do NOT abort the whole import
 */

export type BackupV1 = {
  version: "1.0" | "1.1";
  app: "munasabati";
  owner_id: string | null;
  export_date: string;
  data: {
    event_types?: any[]; // legacy / deprecated
    customers: any[]; // = clients
    decorations: any[];
    supplies: any[];
    bookings: any[]; // each has items.decorations[] / items.supplies[]
    invoices: any[]; // each has items[]
    profits: any[]; // = expenses
    notifications: any[];
    settings?: any | null; // profile + branding + booking settings
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
    clientsRes, decorRes, suppRes,
    bookingsRes, bdRes, bsRes,
    invoicesRes, invItemsRes,
    expensesRes, notifsRes, profileRes,
  ] = await Promise.all([
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
    owner_id
      ? supabase.from("profiles").select("*").eq("id", owner_id).maybeSingle()
      : Promise.resolve({ data: null, error: null } as any),
  ]);

  const err = [clientsRes, decorRes, suppRes, bookingsRes,
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

  const profile = profileRes?.data
    ? clean(profileRes.data as any, ["id", "email", "phone", "phone_verified"])
    : null;

  return {
    version: "1.1",
    app: "munasabati",
    owner_id,
    export_date: new Date().toISOString(),
    data: {
      customers: dedupeById(clientsRes.data as any[]).map(r => clean(r)),
      decorations: dedupeById(decorRes.data as any[]).map(r => clean(r)),
      supplies: dedupeById(suppRes.data as any[]).map(r => clean(r)),
      bookings,
      invoices,
      profits: expenses,
      notifications: dedupeById(notifsRes.data as any[]).map(r => clean(r, ["read"])),
      settings: profile,
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
}

function normalize(bundle: BackupBundle): BackupV1 {
  if (!bundle || (bundle as any).app !== "munasabati") {
    throw new Error("ملف غير صالح");
  }
  if ((bundle as any).data && typeof (bundle as any).version === "string") {
    // v1.0 / v1.1 — already structured
    const b = bundle as BackupV1;
    b.data = b.data || ({} as any);
    b.data.customers = b.data.customers || (b.data as any).clients || [];
    b.data.decorations = b.data.decorations || [];
    b.data.supplies = b.data.supplies || [];
    b.data.bookings = b.data.bookings || [];
    b.data.invoices = b.data.invoices || [];
    b.data.profits = b.data.profits || (b.data as any).expenses || [];
    b.data.notifications = b.data.notifications || [];
    return b;
  }
  // legacy v1 → v1.0
  const legacy = bundle as LegacyBundle;
  const t = legacy.tables || {};
  const decByBooking = new Map<string, { id: string; qty: number }[]>();
  for (const r of (t.booking_decorations || []) as any[]) {
    const a = decByBooking.get(r.booking_id) || [];
    a.push({ id: r.decoration_id, qty: Number(r.qty) || 1 });
    decByBooking.set(r.booking_id, a);
  }
  const supByBooking = new Map<string, { id: string; qty: number }[]>();
  for (const r of (t.booking_supplies || []) as any[]) {
    const a = supByBooking.get(r.booking_id) || [];
    a.push({ id: r.supply_id, qty: Number(r.qty) || 1 });
    supByBooking.set(r.booking_id, a);
  }
  const bookings = (t.bookings || []).map((b: any) => ({
    ...b,
    items: { decorations: decByBooking.get(b.id) || [], supplies: supByBooking.get(b.id) || [] },
  }));
  return {
    version: "1.1",
    app: "munasabati",
    owner_id: null,
    export_date: legacy.exported_at || new Date().toISOString(),
    data: {
      customers: t.clients || [],
      decorations: t.decorations || [],
      supplies: t.supplies || [],
      bookings,
      invoices: [],
      profits: t.expenses || [],
      notifications: t.notifications || [],
      settings: null,
    },
  };
}

export type ImportReport = {
  customers: number;
  bookings: number;
  decorations: number;
  supplies: number;
  invoices: number;
  expenses: number;
  notifications: number;
  settings: boolean;
  warnings: string[];
};

export async function importBundle(input: BackupBundle, mode: "merge" | "replace"): Promise<ImportReport> {
  const bundle = normalize(input);
  const warnings: string[] = [];

  const { data: userData } = await supabase.auth.getUser();
  if (!userData?.user?.id) throw new Error("يجب تسجيل الدخول لاستيراد البيانات");

  if (mode === "replace") await deleteAllOwn();

  const remapClient = new Map<string, string>();
  const remapDecor = new Map<string, string>();
  const remapSupp = new Map<string, string>();
  const remapBooking = new Map<string, string>();
  const remapInvoice = new Map<string, string>();

  let okCustomers = 0, okDecor = 0, okSupp = 0, okBookings = 0,
      okInvoices = 0, okExpenses = 0, okNotifs = 0;

  const insertOne = async (
    table: string,
    row: any,
    remap?: Map<string, string>,
  ): Promise<string | undefined> => {
    const oldId = row.id;
    const payload = clean(row, ["id", "items"]);
    const { data, error } = await supabase
      .from(table as any)
      .insert(payload as any)
      .select("id")
      .single();
    if (error) {
      warnings.push(`${table}: ${error.message}`);
      return undefined;
    }
    const newId = (data as any)?.id as string | undefined;
    if (remap && oldId && newId) remap.set(oldId, newId);
    return newId;
  };

  // event_types is deprecated — silently skip if present in legacy bundles
  if ((bundle.data as any).event_types?.length) {
    warnings.push(`تم تجاهل جدول غير مستخدم: event_types (${(bundle.data as any).event_types.length} صف)`);
  }

  for (const r of bundle.data.customers || []) {
    if (await insertOne("clients", r, remapClient)) okCustomers++;
  }
  for (const r of bundle.data.decorations || []) {
    if (await insertOne("decorations", r, remapDecor)) okDecor++;
  }
  for (const r of bundle.data.supplies || []) {
    if (await insertOne("supplies", r, remapSupp)) okSupp++;
  }

  for (const b of bundle.data.bookings || []) {
    const items = b.items || { decorations: [], supplies: [] };
    const row = {
      ...b,
      client_id: b.client_id ? remapClient.get(b.client_id) ?? null : null,
    };
    const newId = await insertOne("bookings", row, remapBooking);
    if (!newId) continue;
    okBookings++;
    for (const d of items.decorations || []) {
      const decoration_id = remapDecor.get(d.id);
      if (!decoration_id) { warnings.push(`booking_decorations: ديكور غير موجود (${d.id})`); continue; }
      const { error } = await supabase.from("booking_decorations").insert({
        booking_id: newId, decoration_id, qty: Number(d.qty) || 1,
      });
      if (error) warnings.push(`booking_decorations: ${error.message}`);
    }
    for (const s of items.supplies || []) {
      const supply_id = remapSupp.get(s.id);
      if (!supply_id) { warnings.push(`booking_supplies: مستلزم غير موجود (${s.id})`); continue; }
      const { error } = await supabase.from("booking_supplies" as any).insert({
        booking_id: newId, supply_id, qty: Number(s.qty) || 1,
      });
      if (error) warnings.push(`booking_supplies: ${error.message}`);
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
    okInvoices++;
    for (const it of items) {
      const { error } = await supabase.from("invoice_items").insert({
        invoice_id: newId,
        name: it.name,
        qty: Number(it.qty) || 1,
        unit_price: Number(it.unit_price) || 0,
        line_total: Number(it.line_total) || (Number(it.qty) || 1) * (Number(it.unit_price) || 0),
        position: Number(it.position) || 0,
      });
      if (error) warnings.push(`invoice_items: ${error.message}`);
    }
  }

  for (const e of bundle.data.profits || []) {
    const row = {
      ...e,
      booking_id: e.booking_id ? remapBooking.get(e.booking_id) ?? null : null,
    };
    if (await insertOne("expenses", row)) okExpenses++;
  }

  for (const n of bundle.data.notifications || []) {
    if (await insertOne("notifications", n)) okNotifs++;
  }

  // Settings (profile / branding / booking settings) — UPDATE current user's profile
  let settingsOk = false;
  const settings = (bundle.data as any).settings;
  if (settings && typeof settings === "object") {
    const patch = clean(settings, ["id", "email", "phone", "phone_verified"]);
    if (Object.keys(patch).length > 0) {
      const { error } = await supabase.from("profiles").update(patch).eq("id", userData.user.id);
      if (error) warnings.push(`settings: ${error.message}`);
      else settingsOk = true;
    }
  }

  return {
    customers: okCustomers,
    bookings: okBookings,
    decorations: okDecor,
    supplies: okSupp,
    invoices: okInvoices,
    expenses: okExpenses,
    notifications: okNotifs,
    settings: settingsOk,
    warnings,
  };
}