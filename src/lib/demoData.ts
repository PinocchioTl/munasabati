import { supabase } from "@/integrations/supabase/client";

export const DEMO_EMAIL = "admin@local.com";

export function isDemoUser(email?: string | null) {
  return (email || "").toLowerCase() === DEMO_EMAIL;
}

async function getOwnerId() {
  const { data } = await supabase.auth.getUser();
  if (!data.user) throw new Error("غير مسجل الدخول");
  if (!isDemoUser(data.user.email)) throw new Error("متاح فقط لحساب المطور");
  return data.user.id;
}

/** Deletes ALL data owned by the demo account. */
export async function clearDemoData() {
  const owner_id = await getOwnerId();

  // booking_decorations cascade via bookings via owner_id filter
  const { data: bookings } = await supabase.from("bookings").select("id").eq("owner_id", owner_id);
  const bookingIds = (bookings || []).map((b) => b.id);
  if (bookingIds.length) {
    await supabase.from("booking_decorations").delete().in("booking_id", bookingIds);
  }
  const { data: invs } = await supabase.from("invoices").select("id").eq("owner_id", owner_id);
  const invIds = (invs || []).map((i) => i.id);
  if (invIds.length) {
    await supabase.from("invoice_items").delete().in("invoice_id", invIds);
  }

  await supabase.from("invoices").delete().eq("owner_id", owner_id);
  await supabase.from("expenses").delete().eq("owner_id", owner_id);
  await supabase.from("bookings").delete().eq("owner_id", owner_id);
  await supabase.from("notifications").delete().eq("owner_id", owner_id);
  await supabase.from("decorations").delete().eq("owner_id", owner_id);
  await supabase.from("supplies").delete().eq("owner_id", owner_id);
  await supabase.from("clients").delete().eq("owner_id", owner_id);
}

/** Seeds rich demo data into the demo account. Idempotent: clears first. */
export async function seedDemoData() {
  const owner_id = await getOwnerId();
  await clearDemoData();

  // ---------- Decorations ----------
  const decorationsSeed = [
    { name: "Royal Wedding Stage", category: "أعراس", price: 85000, total_qty: 3 },
    { name: "Golden Hall Setup", category: "قاعات", price: 60000, total_qty: 5 },
    { name: "Luxury White Decor", category: "أعراس", price: 70000, total_qty: 4 },
    { name: "Classic VIP Setup", category: "VIP", price: 95000, total_qty: 2 },
    { name: "Engagement Floral Arch", category: "خطوبة", price: 35000, total_qty: 6 },
    { name: "Birthday Pastel Theme", category: "أعياد ميلاد", price: 25000, total_qty: 8 },
  ];
  const { data: decos, error: decoErr } = await supabase
    .from("decorations")
    .insert(decorationsSeed.map((d) => ({ ...d, owner_id, images: [] })))
    .select("id, name, price");
  if (decoErr) throw decoErr;

  // ---------- Supplies ----------
  const suppliesSeed = [
    { name: "كراسي شيافاري ذهبية", category: "كراسي", total_qty: 200, used_qty: 40, min_alert: 30, supplier: "مورد المناسبات", cost: 1200 },
    { name: "طاولات مستديرة", category: "طاولات", total_qty: 50, used_qty: 10, min_alert: 10, supplier: "أثاث برو", cost: 4500 },
    { name: "مفارش ساتان أبيض", category: "مفارش", total_qty: 80, used_qty: 75, min_alert: 20, supplier: "نسيج الفخامة", cost: 800 },
    { name: "شموع زجاجية كبيرة", category: "إضاءة", total_qty: 150, used_qty: 145, min_alert: 30, supplier: "ديكورات النور", cost: 350 },
    { name: "ورود صناعية فاخرة", category: "زهور", total_qty: 60, used_qty: 20, min_alert: 15, supplier: "زهور VIP", cost: 1500 },
  ];
  await supabase.from("supplies").insert(suppliesSeed.map((s) => ({ ...s, owner_id, images: [] })));

  // ---------- Clients ----------
  const clientsSeed = [
    { name: "أحمد بن علي", phone: "0550112233", is_vip: true, address: "الجزائر العاصمة" },
    { name: "سارة بوضياف", phone: "0661223344", is_vip: false, address: "وهران" },
    { name: "محمد العربي", phone: "0770334455", is_vip: true, address: "قسنطينة" },
    { name: "فاطمة الزهراء", phone: "0555445566", is_vip: false, address: "عنابة" },
    { name: "يوسف مرابطي", phone: "0699556677", is_vip: false, address: "البليدة" },
  ];
  const { data: clients } = await supabase
    .from("clients")
    .insert(clientsSeed.map((c) => ({ ...c, owner_id })))
    .select("id, name, phone, is_vip");

  // ---------- Bookings ----------
  const today = new Date();
  const dayOffset = (n: number) => {
    const d = new Date(today);
    d.setDate(d.getDate() + n);
    return d.toISOString().slice(0, 10);
  };
  const statuses: Array<"pending" | "confirmed" | "in_progress" | "completed" | "cancelled"> = [
    "confirmed", "completed", "in_progress", "pending", "cancelled", "completed", "confirmed", "completed",
  ];
  const events = ["wedding", "engagement", "birthday", "wedding", "other", "wedding", "engagement", "wedding"];
  const dayPlan = [-30, -20, -10, -3, 0, 5, 12, 25];
  const locations = ["قاعة الأندلس", "قاعة الياسمين", "فندق الأوراسي", "قاعة النخيل", "فيلا خاصة", "قاعة المنار", "قاعة الزهور", "قاعة الأمل"];

  const bookingsSeed = dayPlan.map((off, i) => {
    const c = clients?.[i % (clients?.length || 1)];
    const total = 60000 + (i % 5) * 25000;
    const dep = statuses[i] === "completed" ? total : statuses[i] === "cancelled" ? 0 : Math.round(total * 0.4);
    return {
      owner_id,
      client_id: c?.id ?? null,
      customer_name: c?.name ?? "زبون",
      phone: c?.phone ?? null,
      event_type: events[i],
      event_date: dayOffset(off),
      location: locations[i],
      start_time: "18:00",
      end_time: "23:30",
      status: statuses[i],
      deposit: dep,
      total_price: total,
      expenses: Math.round(total * 0.15),
      notes: null,
    };
  });
  const { data: bookings } = await supabase.from("bookings").insert(bookingsSeed).select("id, total_price, status");

  // ---------- Booking decorations ----------
  if (bookings && decos) {
    const bdRows = bookings.flatMap((b, i) => {
      const d1 = decos[i % decos.length];
      const d2 = decos[(i + 2) % decos.length];
      return [
        { booking_id: b.id, decoration_id: d1.id, qty: 1 },
        ...(i % 2 === 0 ? [{ booking_id: b.id, decoration_id: d2.id, qty: 1 }] : []),
      ];
    });
    await supabase.from("booking_decorations").insert(bdRows);
  }

  // ---------- Expenses ----------
  if (bookings) {
    const expRows = bookings.slice(0, 5).map((b, i) => ({
      owner_id,
      booking_id: b.id,
      expense_type: ["نقل", "طعام", "إضافات", "عمالة", "ديكور"][i],
      amount: 5000 + i * 2000,
      date: dayOffset(dayPlan[i]),
    }));
    await supabase.from("expenses").insert(expRows);
  }

  // ---------- Invoices ----------
  if (bookings && clients) {
    const invSeed = bookings.slice(0, 4).map((b, i) => {
      const c = clients[i % clients.length];
      const sub = Number(b.total_price);
      const tax = Math.round(sub * 0.05);
      const total = sub + tax;
      return {
        owner_id,
        booking_id: b.id,
        client_id: c.id,
        customer_name: c.name,
        customer_phone: c.phone,
        issue_date: dayOffset(dayPlan[i]),
        due_date: dayOffset(dayPlan[i] + 14),
        subtotal: sub,
        tax_rate: 5,
        tax_amount: tax,
        discount: 0,
        total,
        paid_amount: i % 2 === 0 ? total : Math.round(total / 2),
      };
    });
    const { data: invs } = await supabase.from("invoices").insert(invSeed).select("id, subtotal");
    if (invs) {
      const itemRows = invs.flatMap((inv, i) => [
        { invoice_id: inv.id, name: "إيجار ديكور", qty: 1, unit_price: Math.round(Number(inv.subtotal) * 0.7), line_total: Math.round(Number(inv.subtotal) * 0.7), position: 0 },
        { invoice_id: inv.id, name: "خدمات تنسيق", qty: 1, unit_price: Math.round(Number(inv.subtotal) * 0.3), line_total: Math.round(Number(inv.subtotal) * 0.3), position: 1 },
      ]);
      await supabase.from("invoice_items").insert(itemRows);
    }
  }

  // ---------- Notifications ----------
  const notifSeed = [
    { title: "حجز جديد", body: "تم تأكيد حجز جديد من أحمد بن علي", level: "info" as const, kind: "booking" },
    { title: "تنبيه نقص مخزون", body: "الشموع الزجاجية الكبيرة اقتربت من النفاد", level: "warning" as const, kind: "supply" },
    { title: "دفعة مستلمة", body: "تم استلام دفعة 35000 د.ج من سارة بوضياف", level: "success" as const, kind: "payment" },
    { title: "حجز ملغي", body: "تم إلغاء حجز من قاعة الأمل", level: "warning" as const, kind: "booking" },
    { title: "تحديث النظام", body: "تم تحديث النظام إلى الإصدار الأخير", level: "info" as const, kind: "system" },
  ];
  await supabase.from("notifications").insert(notifSeed.map((n) => ({ ...n, owner_id, is_read: false })));
}
