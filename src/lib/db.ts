import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export type BookingStatus = "pending" | "confirmed" | "in_progress" | "completed" | "cancelled";
export type EventType = "wedding" | "engagement" | "birthday" | "other";
export type PaymentStatus = "unpaid" | "partial" | "paid";
export type ItemStatus = "available" | "limited" | "unavailable";
export type NotifLevel = "info" | "warning" | "success" | "error";

export const statusLabels: Record<BookingStatus, string> = {
  pending: "قيد الانتظار",
  confirmed: "مؤكد",
  in_progress: "جاري التنفيذ",
  completed: "مكتمل",
  cancelled: "ملغي",
};
export const eventTypeLabels: Record<string, string> = {
  wedding: "عرس",
  engagement: "خطوبة",
  birthday: "عيد ميلاد",
  other: "أخرى",
};
export const itemStatusLabels: Record<ItemStatus, string> = {
  available: "متوفر",
  limited: "محدود",
  unavailable: "غير متاح",
};

export const formatSAR = (n: number) =>
  new Intl.NumberFormat("ar-DZ", { maximumFractionDigits: 0 }).format(n || 0) + " د.ج";

export interface Decoration {
  id: string; name: string; category: string | null; images: string[];
  total_qty: number; booked_qty: number; price: number; status: ItemStatus;
  bookings_count: number; total_revenue: number; description?: string | null;
}
export interface Supply {
  id: string; name: string; category: string | null;
  total_qty: number; used_qty: number; min_alert: number;
  supplier: string | null; cost: number; status: ItemStatus;
  images: string[]; notes?: string | null;
}
export interface EventTypeRow {
  id: string; name: string; label: string;
  color: string | null; icon: string | null; is_active: boolean;
}
export interface Client {
  id: string; name: string; phone: string | null; address: string | null;
  is_vip: boolean; notes: string | null; email?: string | null;
  events_count: number; total_paid: number; last_event_date: string | null;
}
export interface BookingDecoration { decoration_id: string; qty: number; decoration?: Decoration; }
export interface BookingSupply { supply_id: string; qty: number; supply?: Supply; }
export interface Booking {
  id: string; code: string | null; client_id: string | null;
  customer_name: string; phone: string | null;
  event_type: string; event_date: string; location: string | null;
  start_time: string; end_time: string;
  status: BookingStatus; deposit: number; total_price: number;
  expenses: number; transport_cost: number; remaining: number; net_profit: number;
  payment_status: PaymentStatus; notes: string | null;
  created_at: string;
  booking_decorations?: BookingDecoration[];
  booking_supplies?: BookingSupply[];
}
export interface Expense {
  id: string; expense_type: string; amount: number;
  booking_id: string | null; date: string; notes: string | null; created_at: string;
}
export interface NotificationRow {
  id: string; title: string; body: string | null;
  level: NotifLevel; is_read: boolean; kind: string | null; created_at: string;
}

// ============ QUERIES ============
export const useBookings = () =>
  useQuery({
    queryKey: ["bookings"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("bookings")
        .select("*, booking_decorations(decoration_id, qty, decoration:decorations(*)), booking_supplies(supply_id, qty, supply:supplies(*))")
        .order("event_date", { ascending: false });
      if (error) throw error;
      return data as unknown as Booking[];
    },
  });

export const useDecorations = () =>
  useQuery({
    queryKey: ["decorations"],
    queryFn: async () => {
      const { data, error } = await supabase.from("decorations").select("*").order("name");
      if (error) throw error;
      return data as Decoration[];
    },
  });

export const useSupplies = () =>
  useQuery({
    queryKey: ["supplies"],
    queryFn: async () => {
      const { data, error } = await supabase.from("supplies").select("*").order("name");
      if (error) throw error;
      return data as Supply[];
    },
  });

export const useClients = () =>
  useQuery({
    queryKey: ["clients"],
    queryFn: async () => {
      const { data, error } = await supabase.from("clients").select("*").order("name");
      if (error) throw error;
      return data as Client[];
    },
  });

export const useNotifications = () =>
  useQuery({
    queryKey: ["notifications"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("notifications").select("*")
        .order("created_at", { ascending: false }).limit(50);
      if (error) throw error;
      return data as NotificationRow[];
    },
    refetchInterval: 15000,
  });

export const useExpenses = () =>
  useQuery({
    queryKey: ["expenses"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("expenses").select("*").order("date", { ascending: false });
      if (error) throw error;
      return data as Expense[];
    },
  });

export interface NewExpenseInput {
  expense_type: string; amount: number;
  booking_id?: string | null; date: string; notes?: string;
}
export const useCreateExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewExpenseInput) => {
      const type = input.expense_type.trim();
      if (!type) throw new Error("نوع المصروف مطلوب");
      if (!input.amount || input.amount <= 0) throw new Error("المبلغ يجب أن يكون أكبر من 0");
      if (!input.date) throw new Error("التاريخ مطلوب");
      const { data, error } = await supabase.from("expenses").insert({
        expense_type: type,
        amount: input.amount,
        booking_id: input.booking_id || null,
        date: input.date,
        notes: input.notes?.trim() || null,
      }).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
};
export const useDeleteExpense = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("expenses").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["expenses"] }),
  });
};

// ============ MUTATIONS ============
export interface NewBookingInput {
  customer_name: string; phone: string;
  client_id?: string | null;
  event_type: string;
  event_date: string; start_time: string; end_time: string;
  location?: string;
  deposit: number; total_price: number; expenses: number; transport_cost?: number;
  notes?: string;
  decorations: { id: string; qty: number }[];
  supplies?: { id: string; qty: number }[];
}

export const useCreateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewBookingInput) => {
      const { data: bk, error } = await supabase.from("bookings").insert({
        customer_name: input.customer_name,
        phone: input.phone,
        client_id: input.client_id || null,
        event_type: input.event_type as any,
        event_date: input.event_date,
        start_time: input.start_time,
        end_time: input.end_time,
        location: input.location?.trim() || null,
        deposit: input.deposit,
        total_price: input.total_price,
        expenses: input.expenses,
        transport_cost: input.transport_cost || 0,
        notes: input.notes || null,
        status: "pending",
      }).select().single();
      if (error) throw error;

      if (input.decorations.length > 0) {
        const { error: e2 } = await supabase
          .from("booking_decorations")
          .insert(input.decorations.map(d => ({
            booking_id: bk.id, decoration_id: d.id, qty: d.qty,
          })));
        if (e2) {
          await supabase.from("bookings").delete().eq("id", bk.id);
          throw e2;
        }
      }
      if (input.supplies && input.supplies.length > 0) {
        const { error: e3 } = await supabase
          .from("booking_supplies" as any)
          .insert(input.supplies.map(s => ({
            booking_id: bk.id, supply_id: s.id, qty: s.qty,
          })));
        if (e3) {
          await supabase.from("bookings").delete().eq("id", bk.id);
          throw e3;
        }
      }
      return bk;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["decorations"] });
      qc.invalidateQueries({ queryKey: ["supplies"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export interface UpdateBookingInput extends NewBookingInput {
  id: string;
}

export const useUpdateBooking = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: UpdateBookingInput) => {
      const { error } = await supabase.from("bookings").update({
        customer_name: input.customer_name,
        phone: input.phone,
        client_id: input.client_id || null,
        event_type: input.event_type as any,
        event_date: input.event_date,
        start_time: input.start_time,
        end_time: input.end_time,
        location: input.location?.trim() || null,
        deposit: input.deposit,
        total_price: input.total_price,
        expenses: input.expenses,
        transport_cost: input.transport_cost || 0,
        notes: input.notes || null,
      }).eq("id", input.id);
      if (error) throw error;

      // Snapshot existing decorations + supplies so we can rollback on conflict
      const { data: prevDec } = await supabase
        .from("booking_decorations").select("*").eq("booking_id", input.id);
      const { data: prevSup } = await supabase
        .from("booking_supplies" as any).select("*").eq("booking_id", input.id);

      const { error: delErr } = await supabase
        .from("booking_decorations").delete().eq("booking_id", input.id);
      if (delErr) throw delErr;
      await supabase.from("booking_supplies" as any).delete().eq("booking_id", input.id);

      if (input.decorations.length > 0) {
        const { error: insErr } = await supabase
          .from("booking_decorations")
          .insert(input.decorations.map(d => ({
            booking_id: input.id, decoration_id: d.id, qty: d.qty,
          })));
        if (insErr) {
          if (prevDec && prevDec.length) {
            await supabase.from("booking_decorations").insert(prevDec);
          }
          if (prevSup && prevSup.length) {
            await supabase.from("booking_supplies" as any).insert(prevSup);
          }
          throw insErr;
        }
      }
      if (input.supplies && input.supplies.length > 0) {
        const { error: insErr2 } = await supabase
          .from("booking_supplies" as any)
          .insert(input.supplies.map(s => ({
            booking_id: input.id, supply_id: s.id, qty: s.qty,
          })));
        if (insErr2) {
          if (prevSup && prevSup.length) {
            await supabase.from("booking_supplies" as any).insert(prevSup);
          }
          throw insErr2;
        }
      }
      return { id: input.id };
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["decorations"] });
      qc.invalidateQueries({ queryKey: ["supplies"] });
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
    },
  });
};

export const useMarkNotificationRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useMarkNotificationUnread = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").update({ is_read: false }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useMarkAllNotificationsRead = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("notifications").update({ is_read: true }).eq("is_read", false);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

export const useDeleteNotification = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("notifications").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["notifications"] }),
  });
};

// ============ DECORATIONS UPSERT ============
export interface DecorationInput {
  name: string;
  category: string;
  price: number;
  total_qty: number;
  images?: string[];
}

export const useUpsertDecoration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecorationInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("الاسم مطلوب");
      if (input.total_qty <= 0) throw new Error("الكمية يجب أن تكون أكبر من 0");
      if (input.price < 0) throw new Error("السعر غير صحيح");
      if (!input.category.trim()) throw new Error("التصنيف مطلوب");

      // Check duplicate by name (case-insensitive)
      const { data: existing } = await supabase
        .from("decorations").select("*").ilike("name", name).maybeSingle();

      if (existing) {
        const { data, error } = await supabase.from("decorations").update({
          category: input.category.trim(),
          price: input.price,
          total_qty: input.total_qty,
          images: input.images ?? existing.images,
        }).eq("id", existing.id).select().single();
        if (error) throw error;
        return { data, updated: true };
      } else {
        const { data, error } = await supabase.from("decorations").insert({
          name,
          category: input.category.trim(),
          price: input.price,
          total_qty: input.total_qty,
          images: input.images ?? [],
        }).select().single();
        if (error) throw error;
        return { data, updated: false };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decorations"] }),
  });
};

export interface DecorationUpdateInput extends DecorationInput {
  id: string;
}

export const useUpdateDecoration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: DecorationUpdateInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("الاسم مطلوب");
      if (!input.category.trim()) throw new Error("التصنيف مطلوب");
      if (input.price < 0) throw new Error("السعر غير صحيح");
      if (input.total_qty <= 0) throw new Error("الكمية يجب أن تكون أكبر من 0");
      if (!input.images || input.images.length === 0) throw new Error("أضف صورة واحدة على الأقل");

      const { data: dupe } = await supabase
        .from("decorations").select("id").ilike("name", name).neq("id", input.id).maybeSingle();
      if (dupe) throw new Error("يوجد ديكور آخر بنفس الاسم");

      const { data: before } = await supabase.from("decorations").select("*").eq("id", input.id).single();
      if (!before) throw new Error("الديكور غير موجود");
      // Rental model: booked_qty is informational (active bookings across all dates).
      // Reducing total_qty is always allowed; per-date conflicts are checked at booking time.

      const { data, error } = await supabase.from("decorations").update({
        name,
        category: input.category.trim(),
        price: input.price,
        total_qty: input.total_qty,
        images: input.images,
      }).eq("id", input.id).select().single();
      if (error) throw error;
      return data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["decorations"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
};

export const useDeleteDecoration = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { count } = await supabase
        .from("booking_decorations")
        .select("*", { count: "exact", head: true })
        .eq("decoration_id", id);
      if ((count || 0) > 0) {
        throw new Error("لا يمكن حذف ديكور مرتبط بحجوزات. يمكنك تعديله بدلاً من ذلك.");
      }
      const { error } = await supabase.from("decorations").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["decorations"] }),
  });
};



// ============ SUPPLIES UPSERT ============
export interface SupplyInput {
  name: string;
  category: string;
  total_qty: number;
  min_alert: number;
  supplier?: string;
  cost: number;
  images?: string[];
  notes?: string;
}

export const useUpsertSupply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplyInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("الاسم مطلوب");
      if (input.total_qty < 0) throw new Error("الكمية غير صحيحة");
      if (input.min_alert < 0) throw new Error("الحد الأدنى للتنبيه غير صحيح");
      if (input.cost < 0) throw new Error("التكلفة غير صحيحة");

      const catKey = (input.category || "").trim();
      let q = supabase.from("supplies").select("*").ilike("name", name);
      q = catKey ? q.ilike("category", catKey) : q.is("category", null);
      const { data: existing } = await q.maybeSingle();

      if (existing) {
        const { data, error } = await supabase.from("supplies").update({
          category: input.category.trim() || existing.category,
          total_qty: existing.total_qty + input.total_qty,
          min_alert: input.min_alert,
          supplier: input.supplier?.trim() || existing.supplier,
          cost: input.cost,
          images: input.images && input.images.length ? input.images : (existing as any).images,
          notes: input.notes?.trim() || (existing as any).notes,
        }).eq("id", existing.id).select().single();
        if (error) throw error;
        return { data, updated: true };
      } else {
        const { data, error } = await supabase.from("supplies").insert({
          name,
          category: input.category.trim() || null,
          total_qty: input.total_qty,
          used_qty: 0,
          min_alert: input.min_alert,
          supplier: input.supplier?.trim() || null,
          cost: input.cost,
          images: input.images ?? [],
          notes: input.notes?.trim() || null,
        }).select().single();
        if (error) throw error;
        return { data, updated: false };
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplies"] }),
  });
};

export interface SupplyUpdateInput extends SupplyInput {
  id: string;
}

export const useUpdateSupply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: SupplyUpdateInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("الاسم مطلوب");
      if (input.total_qty < 0) throw new Error("الكمية غير صحيحة");
      if (input.min_alert < 0) throw new Error("الحد الأدنى للتنبيه غير صحيح");
      if (input.cost < 0) throw new Error("التكلفة غير صحيحة");

      // Prevent renaming to an existing different supply's name
      const { data: dupe } = await supabase
        .from("supplies").select("id").ilike("name", name).neq("id", input.id).maybeSingle();
      if (dupe) throw new Error("يوجد مستلزم آخر بنفس الاسم");

      const { data: before } = await supabase.from("supplies").select("*").eq("id", input.id).single();
      if (!before) throw new Error("المستلزم غير موجود");
      if (input.total_qty < (before as any).used_qty) {
        throw new Error(`لا يمكن تقليل الكمية لأقل من المحجوز حالياً (${(before as any).used_qty})`);
      }

      const payload: any = {
        name,
        category: input.category.trim() || null,
        total_qty: input.total_qty,
        min_alert: input.min_alert,
        supplier: input.supplier?.trim() || null,
        cost: input.cost,
        images: input.images ?? [],
        notes: input.notes?.trim() || null,
      };

      const { data, error } = await supabase.from("supplies").update(payload).eq("id", input.id).select().single();
      if (error) throw error;

      // Activity log (best-effort)
      try {
        const { data: u } = await supabase.auth.getUser();
        const changes: Record<string, { from: any; to: any }> = {};
        for (const k of Object.keys(payload)) {
          if (JSON.stringify((before as any)[k]) !== JSON.stringify(payload[k])) {
            changes[k] = { from: (before as any)[k], to: payload[k] };
          }
        }
        if (Object.keys(changes).length) {
          await supabase.from("audit_log").insert({
            action: "supply.update",
            entity: "supply",
            entity_id: input.id,
            user_id: u.user?.id,
            user_email: u.user?.email,
            metadata: { changes, name },
          });
        }
      } catch { /* ignore audit failure */ }

      return data;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplies"] }),
  });
};

export const useDeleteSupply = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("supplies").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["supplies"] }),
  });
};


// ============ SMART SUGGESTIONS ============
const ACTIVE_BOOKING = (s: BookingStatus) => s === "pending" || s === "confirmed" || s === "in_progress";

/** Date-based availability: total_qty minus sum of qty in active bookings on that date */
export function decorationAvailableOnDate(
  dec: Decoration, date: string, allBookings: Booking[], excludeBookingId?: string,
): number {
  if (!date) return dec.total_qty;
  const used = allBookings
    .filter(b => b.event_date === date && ACTIVE_BOOKING(b.status) && b.id !== excludeBookingId)
    .flatMap(b => b.booking_decorations || [])
    .filter(bd => bd.decoration_id === dec.id)
    .reduce((s, bd) => s + bd.qty, 0);
  return Math.max(dec.total_qty - used, 0);
}

export function supplyAvailableOnDate(
  sup: Supply, date: string, allBookings: Booking[], excludeBookingId?: string,
): number {
  if (!date) return sup.total_qty;
  const used = allBookings
    .filter(b => b.event_date === date && ACTIVE_BOOKING(b.status) && b.id !== excludeBookingId)
    .flatMap(b => b.booking_supplies || [])
    .filter(bs => bs.supply_id === sup.id)
    .reduce((s, bs) => s + bs.qty, 0);
  return Math.max(sup.total_qty - used, 0);
}

/** Return alternative decorations from same category that are available on given date */
export function suggestAlternativeDecorations(
  unavailableId: string,
  date: string,
  allDecorations: Decoration[],
  allBookings: Booking[],
): Decoration[] {
  const target = allDecorations.find(d => d.id === unavailableId);
  if (!target) return [];
  return allDecorations
    .filter(d => d.id !== unavailableId && d.category === target.category)
    .filter(d => {
      const usedThatDay = allBookings
        .filter(b => b.event_date === date && (b.status === "pending" || b.status === "confirmed"))
        .flatMap(b => b.booking_decorations || [])
        .filter(bd => bd.decoration_id === d.id)
        .reduce((s, bd) => s + bd.qty, 0);
      return usedThatDay < d.total_qty;
    })
    .slice(0, 4);
}

/** Find nearest dates where the given decoration is fully free */
export function suggestAlternativeDates(
  decorationIds: string[],
  baseDate: string,
  allDecorations: Decoration[],
  allBookings: Booking[],
  maxAhead = 30,
): string[] {
  const results: string[] = [];
  const start = new Date(baseDate);
  for (let i = 1; i <= maxAhead && results.length < 5; i++) {
    const d = new Date(start); d.setDate(d.getDate() + i);
    const ds = d.toISOString().slice(0, 10);
    const allFree = decorationIds.every(decId => {
      const dec = allDecorations.find(x => x.id === decId);
      if (!dec) return false;
      const used = allBookings
        .filter(b => b.event_date === ds && (b.status === "pending" || b.status === "confirmed"))
        .flatMap(b => b.booking_decorations || [])
        .filter(bd => bd.decoration_id === decId)
        .reduce((s, bd) => s + bd.qty, 0);
      return used < dec.total_qty;
    });
    if (allFree) results.push(ds);
  }
  return results;
}

// ============ EVENT TYPES ============
export const useEventTypes = () =>
  useQuery({
    queryKey: ["event_types"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("event_types").select("*").order("created_at");
      if (error) throw error;
      return data as EventTypeRow[];
    },
  });

export interface NewEventTypeInput {
  label: string; color?: string; icon?: string;
}
export const useCreateEventType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: NewEventTypeInput | string) => {
      const data = typeof input === "string" ? { label: input } : input;
      const label = data.label.trim();
      if (!label) throw new Error("اسم المناسبة مطلوب");
      const name = "custom_" + Date.now();
      const { data: row, error } = await supabase.from("event_types")
        .insert({
          name, label,
          color: data.color || null,
          icon: data.icon || null,
        }).select().single();
      if (error) throw error;
      return row as EventTypeRow;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_types"] }),
  });
};

export const useUpdateEventType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: { id: string; label?: string; color?: string | null; icon?: string | null; is_active?: boolean }) => {
      const { id, ...rest } = input;
      const { error } = await supabase.from("event_types").update(rest).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_types"] }),
  });
};

export const useDeleteEventType = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("event_types").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["event_types"] }),
  });
};

// ============ BOOKING STATUS UPDATE ============
export const useUpdateBookingStatus = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, status }: { id: string; status: BookingStatus }) => {
      const { error } = await supabase
        .from("bookings")
        .update({ status: status as any })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["bookings"] });
      qc.invalidateQueries({ queryKey: ["decorations"] });
      qc.invalidateQueries({ queryKey: ["notifications"] });
      qc.invalidateQueries({ queryKey: ["expenses"] });
    },
  });
};

// ============ CLIENTS CRUD ============
export interface ClientInput {
  id?: string;
  name: string;
  phone?: string;
  address?: string;
  notes?: string;
  is_vip?: boolean;
}
export const useUpsertClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (input: ClientInput) => {
      const name = input.name.trim();
      if (!name) throw new Error("الاسم مطلوب");
      const payload = {
        name,
        phone: input.phone?.trim() || null,
        address: input.address?.trim() || null,
        notes: input.notes?.trim() || null,
        ...(input.is_vip !== undefined ? { is_vip: input.is_vip } : {}),
      };
      if (input.id) {
        const { data, error } = await supabase.from("clients").update(payload).eq("id", input.id).select().single();
        if (error) throw error;
        return data as Client;
      }
      const { data, error } = await supabase.from("clients").insert(payload).select().single();
      if (error) throw error;
      return data as Client;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["clients"] }),
  });
};
export const useDeleteClient = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("clients").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["clients"] });
      qc.invalidateQueries({ queryKey: ["bookings"] });
    },
  });
};

// VIP thresholds
export const VIP_THRESHOLDS = { events: 5, paid: 500000 };
export type ClientTier = "new" | "active" | "vip" | "inactive";
export function classifyClient(c: Client): ClientTier {
  if (c.is_vip || c.events_count >= VIP_THRESHOLDS.events || +c.total_paid >= VIP_THRESHOLDS.paid) return "vip";
  if (c.events_count === 0) return "new";
  if (c.last_event_date) {
    const days = (Date.now() - new Date(c.last_event_date).getTime()) / 86400000;
    if (days > 180) return "inactive";
  }
  return "active";
}
export const tierLabels: Record<ClientTier, string> = {
  new: "جديد", active: "نشط", vip: "VIP", inactive: "غير نشط",
};

// ============ IMAGE UPLOAD ============
export async function uploadItemImages(files: File[]): Promise<string[]> {
  const urls: string[] = [];
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("يجب تسجيل الدخول لرفع الصور");
  for (const file of files) {
    const ext = file.name.split(".").pop() || "jpg";
    const path = `${user.id}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`;
    const { error } = await supabase.storage.from("item-images").upload(path, file, {
      cacheControl: "3600", upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("item-images").getPublicUrl(path);
    urls.push(data.publicUrl);
  }
  return urls;
}
