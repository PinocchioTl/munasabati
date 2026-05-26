import { useState, useEffect, FormEvent, useMemo, useRef } from "react";
import { toast } from "sonner";
import {
  X, Plus, Sparkles, AlertCircle, Calendar, Lightbulb, MapPin, PlusCircle,
  Search, Check, Trash2, ChevronDown, Minus, User, PartyPopper, Truck, Receipt, Mail, Phone, Package,
} from "lucide-react";
import { Button, Card } from "./ui-bits";
import {
  useDecorations, useBookings, useCreateBooking, useUpdateBooking, useSupplies,
  formatSAR, suggestAlternativeDecorations, suggestAlternativeDates, Decoration, Supply,
  supplyAvailableOnDate,
  useEventTypes, useCreateEventType,
  type Booking,
} from "@/lib/db";

interface Props {
  open: boolean;
  onClose: () => void;
  booking?: Booking | null;
}

export function BookingDialog({ open, onClose, booking }: Props) {
  const isEdit = !!booking?.id;
  const { data: decorations = [] } = useDecorations();
  const { data: supplies = [] } = useSupplies();
  const { data: bookings = [] } = useBookings();
  const { data: eventTypes = [] } = useEventTypes();
  const createType = useCreateEventType();
  const create = useCreateBooking();
  const update = useUpdateBooking();

  const [form, setForm] = useState({
    customer_name: "", phone: "", email: "", event_type: "",
    event_date: "", start_time: "19:00", end_time: "23:59",
    location: "", location_notes: "",
    deposit: 0, total_price: 0, expenses: 0, transport_cost: 0, notes: "",
  });
  const [newTypeLabel, setNewTypeLabel] = useState("");
  const [newTypeColor, setNewTypeColor] = useState("#D4AF37");
  const [showNewType, setShowNewType] = useState(false);
  const activeEventTypes = eventTypes.filter((t) => t.is_active !== false);

  // decoration_id -> { qty, customPrice? }
  const [selectedDecs, setSelectedDecs] = useState<Record<string, { qty: number; price?: number }>>({});
  // supply_id -> { qty }
  const [selectedSups, setSelectedSups] = useState<Record<string, { qty: number }>>({});
  // Tracks whether user manually overrode total_price (true unless auto-synced)
  const [priceTouched, setPriceTouched] = useState(false);
  const [suggestions, setSuggestions] = useState<{
    blocked?: Decoration; alternatives: Decoration[]; dates: string[];
  } | null>(null);

  // Hydrate from booking when editing
  useEffect(() => {
    if (!open) return;
    if (booking) {
      setForm({
        customer_name: booking.customer_name || "",
        phone: booking.phone || "",
        email: "",
        event_type: booking.event_type || "",
        event_date: booking.event_date || "",
        start_time: (booking.start_time || "19:00").slice(0, 5),
        end_time: (booking.end_time || "23:59").slice(0, 5),
        location: booking.location || "",
        location_notes: "",
        deposit: +booking.deposit || 0,
        total_price: +booking.total_price || 0,
        expenses: +booking.expenses || 0,
        transport_cost: +(booking as any).transport_cost || 0,
        notes: booking.notes || "",
      });
      const map: Record<string, { qty: number }> = {};
      (booking.booking_decorations || []).forEach((bd) => {
        map[bd.decoration_id] = { qty: bd.qty };
      });
      setSelectedDecs(map);
      const supMap: Record<string, { qty: number }> = {};
      ((booking as any).booking_supplies || []).forEach((bs: any) => {
        supMap[bs.supply_id] = { qty: bs.qty };
      });
      setSelectedSups(supMap);
      setPriceTouched(true); // keep existing total_price intact
    } else {
      setForm({
        customer_name: "", phone: "", email: "", event_type: "", event_date: "",
        start_time: "19:00", end_time: "23:59", location: "", location_notes: "",
        deposit: 0, total_price: 0, expenses: 0, transport_cost: 0, notes: "",
      });
      setSelectedDecs({});
      setSelectedSups({});
      setPriceTouched(false);
    }
    setSuggestions(null);
  }, [open, booking]);

  // Auto-pick first active type
  useEffect(() => {
    if (open && !form.event_type && activeEventTypes.length > 0 && !booking) {
      setForm((f) => ({ ...f, event_type: activeEventTypes[0].name }));
    }
  }, [open, activeEventTypes, form.event_type, booking]);

  // Compute decorations subtotal
  const decorationsSubtotal = useMemo(() => {
    return Object.entries(selectedDecs).reduce((sum, [id, sel]) => {
      const dec = decorations.find((d) => d.id === id);
      const unit = sel.price ?? +(dec?.price || 0);
      return sum + unit * sel.qty;
    }, 0);
  }, [selectedDecs, decorations]);

  // Compute supplies subtotal (qty * cost per rental unit)
  const suppliesSubtotal = useMemo(() => {
    return Object.entries(selectedSups).reduce((sum, [id, sel]) => {
      const sup = supplies.find((s) => s.id === id);
      return sum + +(sup?.cost || 0) * sel.qty;
    }, 0);
  }, [selectedSups, supplies]);

  const autoTotal = decorationsSubtotal + suppliesSubtotal + (+form.transport_cost || 0);

  // Auto-sync total_price from decorations + supplies + transport when user hasn't manually overridden
  useEffect(() => {
    if (!priceTouched) {
      setForm((f) => ({ ...f, total_price: autoTotal }));
    }
  }, [autoTotal, priceTouched]);

  const grandTotal = form.total_price > 0 ? form.total_price : autoTotal;

  // Live conflict detection — recomputed on every selection/date change
  const conflicts = useMemo(() => {
    if (!form.event_date) return [] as { name: string; requested: number; available: number; kind: "decoration" | "supply" }[];
    const out: { name: string; requested: number; available: number; kind: "decoration" | "supply" }[] = [];
    for (const [id, sel] of Object.entries(selectedDecs)) {
      const dec = decorations.find((d) => d.id === id);
      if (!dec) continue;
      const used = bookings
        .filter((b) => b.event_date === form.event_date
          && (b.status === "pending" || b.status === "confirmed" || b.status === "in_progress")
          && b.id !== booking?.id)
        .flatMap((b) => b.booking_decorations || [])
        .filter((bd) => bd.decoration_id === dec.id)
        .reduce((s, bd) => s + bd.qty, 0);
      const avail = Math.max(dec.total_qty - used, 0);
      if (sel.qty > avail) out.push({ name: dec.name, requested: sel.qty, available: avail, kind: "decoration" });
    }
    for (const [id, sel] of Object.entries(selectedSups)) {
      const sup = supplies.find((s) => s.id === id);
      if (!sup) continue;
      const avail = supplyAvailableOnDate(sup, form.event_date, bookings, booking?.id);
      if (sel.qty > avail) out.push({ name: sup.name, requested: sel.qty, available: avail, kind: "supply" });
    }
    return out;
  }, [selectedDecs, selectedSups, decorations, supplies, bookings, form.event_date, booking?.id]);
  const hasConflicts = conflicts.length > 0;

  if (!open) return null;

  const set = (k: keyof typeof form) => (e: any) =>
    setForm((f) => ({ ...f, [k]: e.target.type === "number" ? +e.target.value : e.target.value }));

  // Availability considering this booking's existing reservation
  const decAvailableOnDate = (dec: Decoration) => {
    if (!form.event_date) return dec.total_qty;
    const used = bookings
      .filter((b) => b.event_date === form.event_date
        && (b.status === "pending" || b.status === "confirmed" || b.status === "in_progress")
        && b.id !== booking?.id)
      .flatMap((b) => b.booking_decorations || [])
      .filter((bd) => bd.decoration_id === dec.id)
      .reduce((s, bd) => s + bd.qty, 0);
    return Math.max(dec.total_qty - used, 0);
  };

  const addDec = (dec: Decoration) => {
    setSuggestions(null);
    setSelectedDecs((prev) => ({ ...prev, [dec.id]: { qty: prev[dec.id]?.qty || 1 } }));
  };
  const removeDec = (id: string) => {
    setSelectedDecs((prev) => {
      const { [id]: _drop, ...rest } = prev;
      return rest;
    });
  };
  const setQty = (id: string, qty: number) => {
    const safe = Math.max(1, Math.floor(qty) || 1);
    setSelectedDecs((prev) => ({ ...prev, [id]: { ...prev[id], qty: safe } }));
  };
  const setPrice = (id: string, price: number) => {
    setSelectedDecs((prev) => ({ ...prev, [id]: { ...prev[id], price: Math.max(0, price) } }));
  };

  // Supplies handlers (rental — date-based availability)
  const supAvailableOnDate = (sup: Supply) =>
    supplyAvailableOnDate(sup, form.event_date, bookings, booking?.id);

  const addSup = (sup: Supply) =>
    setSelectedSups((prev) => ({ ...prev, [sup.id]: { qty: prev[sup.id]?.qty || 1 } }));
  const removeSup = (id: string) =>
    setSelectedSups((prev) => { const { [id]: _d, ...rest } = prev; return rest; });
  const setSupQty = (id: string, qty: number) => {
    const safe = Math.max(1, Math.floor(qty) || 1);
    setSelectedSups((prev) => ({ ...prev, [id]: { qty: safe } }));
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    setSuggestions(null);
    if (!form.customer_name || !form.event_date) {
      toast.error("الرجاء إكمال الحقول الأساسية");
      return;
    }
    // Pre-flight availability check — decorations
    for (const [id, sel] of Object.entries(selectedDecs)) {
      const dec = decorations.find((d) => d.id === id)!;
      const avail = decAvailableOnDate(dec);
      if (sel.qty > avail) {
        const alternatives = suggestAlternativeDecorations(id, form.event_date, decorations, bookings);
        const dates = suggestAlternativeDates(Object.keys(selectedDecs), form.event_date, decorations, bookings);
        setSuggestions({ blocked: dec, alternatives, dates });
        toast.error(`الديكور "${dec.name}" غير متوفر بهذه الكمية في ${form.event_date}`, {
          description: "اطلع على الاقتراحات الذكية أدناه",
        });
        return;
      }
    }
    // Pre-flight availability check — supplies (rental, per-date)
    for (const [id, sel] of Object.entries(selectedSups)) {
      const sup = supplies.find((s) => s.id === id)!;
      const avail = supAvailableOnDate(sup);
      if (sel.qty > avail) {
        toast.error(`المستلزم "${sup.name}" غير متوفر بهذه الكمية في ${form.event_date}`, {
          description: `المتاح في ذلك اليوم: ${avail}`,
        });
        return;
      }
    }

    const decorationsPayload = Object.entries(selectedDecs).map(([id, sel]) => ({ id, qty: sel.qty }));
    const suppliesPayload = Object.entries(selectedSups).map(([id, sel]) => ({ id, qty: sel.qty }));

    try {
      if (isEdit && booking) {
        await update.mutateAsync({ id: booking.id, ...form, decorations: decorationsPayload, supplies: suppliesPayload });
        toast.success("تم تحديث الحجز ✨", { description: "تم تحديث المخزون والأرباح تلقائياً" });
      } else {
        await create.mutateAsync({ ...form, decorations: decorationsPayload, supplies: suppliesPayload });
        toast.success("تم إنشاء الحجز ✨", { description: "تم تحديث المخزون والأرباح تلقائياً" });
      }
      onClose();
    } catch (err: any) {
      const msg: string = err?.message || "تعذر حفظ الحجز";
      if (msg.includes("تعارض")) {
        const firstSel = Object.keys(selectedDecs)[0];
        if (firstSel) {
          const dec = decorations.find((d) => d.id === firstSel)!;
          const alternatives = suggestAlternativeDecorations(firstSel, form.event_date, decorations, bookings);
          const dates = suggestAlternativeDates(Object.keys(selectedDecs), form.event_date, decorations, bookings);
          setSuggestions({ blocked: dec, alternatives, dates });
        }
      }
      toast.error("تعارض في الحجز", { description: msg });
    }
  };


  const loading = create.isPending || update.isPending;

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center sm:p-4 animate-fade-in" onClick={onClose}>
      <div className="w-full max-w-3xl max-h-[95vh] sm:max-h-[92vh] overflow-y-auto bg-card sm:rounded-2xl rounded-t-3xl border border-border shadow-luxury" onClick={(e) => e.stopPropagation()}>
        {/* Sticky header */}
        <div className="sticky top-0 z-10 bg-card/95 backdrop-blur-xl border-b border-border px-5 sm:px-7 py-4 flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2">
              <div className="size-9 rounded-xl bg-gold/15 text-gold flex items-center justify-center">
                <Sparkles className="size-5" />
              </div>
              <div>
                <h2 className="text-lg sm:text-xl font-bold">{isEdit ? `تعديل الحجز ${booking?.code || ""}` : "حجز جديد"}</h2>
                <p className="text-[11px] text-muted-foreground">
                  {isEdit ? "يمكنك تعديل الديكورات والأسعار" : "أدخل البيانات وسيتحقق النظام من التوفر"}
                </p>
              </div>
            </div>
          </div>
          <button onClick={onClose} className="size-9 rounded-xl hover:bg-secondary flex items-center justify-center">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={submit} className="p-5 sm:p-7 space-y-5">
          {/* 👤 Customer Section */}
          <Section icon={<User className="size-4" />} title="معلومات الزبون">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="اسم الزبون *">
                <input className={inputCls} value={form.customer_name} onChange={set("customer_name")} required placeholder="الاسم الكامل" />
              </Field>
              <Field label="رقم الهاتف">
                <div className="relative">
                  <Phone className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input className={inputCls + " pr-10"} value={form.phone} onChange={set("phone")} placeholder="05XX XXX XXX" />
                </div>
              </Field>
              <Field label="البريد الإلكتروني (اختياري)">
                <div className="relative">
                  <Mail className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input type="email" className={inputCls + " pr-10"} value={form.email} onChange={set("email")} placeholder="example@email.com" />
                </div>
              </Field>
            </div>
          </Section>

          {/* 🎉 Event Section */}
          <Section icon={<PartyPopper className="size-4" />} title="معلومات المناسبة">
            <div className="grid sm:grid-cols-2 gap-3">
              <Field label="نوع المناسبة">
                <div className="flex gap-2">
                  <select className={inputCls} value={form.event_type} onChange={set("event_type")}>
                    {activeEventTypes.length === 0 && <option value="">— لا يوجد —</option>}
                    {activeEventTypes.map((t) => (
                      <option key={t.id} value={t.name}>{t.label}</option>
                    ))}
                  </select>
                  <button type="button" onClick={() => setShowNewType((v) => !v)}
                    title="إضافة نوع مناسبة جديد"
                    className="shrink-0 size-10 rounded-xl bg-gold/10 text-gold hover:bg-gold/20 flex items-center justify-center">
                    <PlusCircle className="size-4" />
                  </button>
                </div>
                {showNewType && (
                  <div className="flex gap-2 mt-2">
                    <input className={inputCls} placeholder="اسم المناسبة الجديدة"
                      value={newTypeLabel} onChange={(e) => setNewTypeLabel(e.target.value)} />
                    <input type="color" value={newTypeColor} onChange={(e) => setNewTypeColor(e.target.value)}
                      title="لون النوع" className="size-10 rounded-xl border border-border bg-transparent cursor-pointer shrink-0" />
                    <Button type="button" size="sm" variant="gold" loading={createType.isPending}
                      onClick={async () => {
                        try {
                          const t = await createType.mutateAsync({ label: newTypeLabel, color: newTypeColor });
                          setForm((f) => ({ ...f, event_type: t.name }));
                          setNewTypeLabel(""); setShowNewType(false);
                          toast.success("تمت إضافة نوع المناسبة");
                        } catch (e: any) { toast.error(e.message); }
                      }}>إضافة</Button>
                  </div>
                )}
              </Field>
              <Field label="تاريخ المناسبة *">
                <input type="date" className={inputCls} value={form.event_date} onChange={set("event_date")} required />
              </Field>
              <Field label="وقت البداية"><input type="time" className={inputCls} value={form.start_time} onChange={set("start_time")} /></Field>
              <Field label="وقت النهاية"><input type="time" className={inputCls} value={form.end_time} onChange={set("end_time")} /></Field>
            </div>
          </Section>

          {/* 📍 Location Section */}
          <Section icon={<MapPin className="size-4" />} title="موقع الحفل">
            <div className="space-y-3">
              <Field label="عنوان الحفل">
                <div className="relative">
                  <MapPin className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
                  <input className={inputCls + " pr-10"} value={form.location} onChange={set("location")} placeholder="العنوان أو اسم القاعة" />
                </div>
              </Field>
              <Field label="ملاحظات الموقع (اختياري)">
                <textarea className={inputCls + " min-h-[60px]"} value={form.location_notes} onChange={set("location_notes")} placeholder="معلومات إضافية عن الوصول، الطابق، رقم البوابة..." />
              </Field>
              {form.location && (
                <a
                  href={`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(form.location)}`}
                  target="_blank" rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-semibold text-info hover:underline"
                >
                  <MapPin className="size-3.5" /> فتح الموقع في الخريطة
                </a>
              )}
            </div>
          </Section>

          {/* 🪑 Decorations Section */}
          <Section icon={<Sparkles className="size-4" />} title="الديكورات المختارة">
            <DecorationsPicker
              decorations={decorations}
              selected={selectedDecs}
              availabilityFor={decAvailableOnDate}
              onAdd={addDec}
              onRemove={removeDec}
              onQty={setQty}
              onPrice={setPrice}
              subtotal={decorationsSubtotal}
            />
          </Section>

          {/* 📦 Supplies Section (rental, per-date availability) */}
          <Section icon={<Package className="size-4" />} title="المستلزمات المختارة (كراء)">
            <SuppliesPicker
              supplies={supplies}
              selected={selectedSups}
              availabilityFor={supAvailableOnDate}
              onAdd={addSup}
              onRemove={removeSup}
              onQty={setSupQty}
              eventDate={form.event_date}
            />
          </Section>


          {/* 🚚 Transport Section */}
          <Section icon={<Truck className="size-4" />} title="تسعيرة النقل">
            <Field label="تكلفة النقل">
              <div className="relative">
                <input
                  type="number" min={0}
                  className={inputCls + " pl-16"}
                  value={form.transport_cost || ""}
                  onChange={(e) => { setPriceTouched(false); set("transport_cost")(e); }}
                  placeholder="0"
                />
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[11px] font-semibold text-muted-foreground">ر.س</span>
              </div>
            </Field>
          </Section>

          {/* 💰 Pricing Section */}
          <Section icon={<Receipt className="size-4" />} title="التسعير والدفعات">
            <div className="grid sm:grid-cols-3 gap-3">
              <Field label="السعر الإجمالي">
                <div className="relative">
                  <input
                    type="number"
                    className={inputCls}
                    value={form.total_price || ""}
                    onChange={(e) => { setPriceTouched(true); set("total_price")(e); }}
                  />
                  {priceTouched && (Object.keys(selectedDecs).length > 0 || Object.keys(selectedSups).length > 0 || form.transport_cost > 0) && (
                    <button
                      type="button"
                      onClick={() => { setPriceTouched(false); setForm((f) => ({ ...f, total_price: autoTotal })); }}
                      className="absolute left-2 top-1/2 -translate-y-1/2 text-[10px] font-semibold text-gold bg-gold/10 px-2 py-1 rounded-md hover:bg-gold/20"
                      title="مزامنة تلقائية"
                    >
                      مزامنة
                    </button>
                  )}
                </div>
              </Field>
              <Field label="العربون"><input type="number" className={inputCls} value={form.deposit || ""} onChange={set("deposit")} /></Field>
              <Field label="مصاريف أخرى"><input type="number" className={inputCls} value={form.expenses || ""} onChange={set("expenses")} /></Field>
            </div>
          </Section>

          {/* 📊 Booking Summary */}
          {(decorationsSubtotal > 0 || suppliesSubtotal > 0 || form.transport_cost > 0 || form.total_price > 0) && (
            <div className="bg-gradient-to-br from-gold/10 via-card to-info/5 border border-gold/30 rounded-2xl p-5 space-y-3">
              <div className="flex items-center gap-2 text-sm font-bold">
                <Receipt className="size-4 text-gold" /> ملخص الحجز
              </div>
              <div className="space-y-2 text-sm">
                <SummaryRow label="مجموع الديكورات" value={formatSAR(decorationsSubtotal)} />
                <SummaryRow label="مجموع المستلزمات" value={formatSAR(suppliesSubtotal)} />
                <SummaryRow label="تكلفة النقل" value={formatSAR(+form.transport_cost || 0)} />
                {form.expenses > 0 && <SummaryRow label="مصاريف أخرى" value={`- ${formatSAR(form.expenses)}`} muted />}
                <div className="h-px bg-border my-2" />
                <SummaryRow label="الإجمالي النهائي" value={formatSAR(grandTotal)} bold />
                {form.deposit > 0 && (
                  <>
                    <SummaryRow label="العربون المدفوع" value={formatSAR(form.deposit)} muted />
                    <SummaryRow label="المتبقي" value={formatSAR(Math.max(grandTotal - form.deposit, 0))} accent />
                  </>
                )}
              </div>
              {form.total_price > 0 && (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-3 border-t border-border">
                  <Pill label="الربح الصافي" value={formatSAR(form.total_price - form.expenses)} tone="success" />
                  <Pill label="حالة الدفع" value={form.deposit <= 0 ? "غير مدفوع" : form.deposit >= form.total_price ? "مدفوع" : "جزئي"} tone="info" />
                  <Pill label="عدد الديكورات" value={String(Object.keys(selectedDecs).length)} tone="warning" />
                </div>
              )}
            </div>
          )}

          <Field label="ملاحظات إضافية">
            <textarea className={inputCls + " min-h-[60px]"} value={form.notes} onChange={set("notes")} placeholder="أي تفاصيل أو طلبات خاصة..." />
          </Field>

          {/* Smart suggestions panel */}
          {suggestions && (
            <Card className="p-4 bg-warning/5 border-warning/30">
              <div className="flex items-center gap-2 text-warning font-bold text-sm">
                <AlertCircle className="size-4" /> اقتراحات ذكية
              </div>
              {suggestions.alternatives.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Lightbulb className="size-3.5" /> ديكورات بديلة متاحة:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.alternatives.map((d) => (
                      <button type="button" key={d.id} onClick={() => {
                        if (suggestions.blocked) {
                          removeDec(suggestions.blocked.id);
                        }
                        addDec(d);
                        setSuggestions(null);
                      }}
                        className="text-xs bg-card border border-border hover:border-gold rounded-lg px-3 py-1.5 font-semibold">
                        {d.name} — {formatSAR(+d.price)}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              {suggestions.dates.length > 0 && (
                <div className="mt-3">
                  <div className="text-xs text-muted-foreground flex items-center gap-1.5 mb-2">
                    <Calendar className="size-3.5" /> تواريخ متاحة قريبة:
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {suggestions.dates.map((d) => (
                      <button type="button" key={d} onClick={() => { setForm((f) => ({ ...f, event_date: d })); setSuggestions(null); }}
                        className="text-xs bg-card border border-border hover:border-gold rounded-lg px-3 py-1.5 font-semibold">
                        {d}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </Card>
          )}

          {/* Sticky footer actions */}
          <div className="sticky bottom-0 -mx-5 sm:-mx-7 -mb-5 sm:-mb-7 px-5 sm:px-7 py-4 bg-card/95 backdrop-blur-xl border-t border-border flex gap-2">
            {hasConflicts && (
              <div className="absolute -top-px left-0 right-0 -translate-y-full px-5 sm:px-7 pb-3 pointer-events-none">
                <div className="bg-destructive/10 border border-destructive/40 rounded-2xl p-3 sm:p-4 shadow-lg pointer-events-auto animate-fade-in">
                  <div className="flex items-start gap-2 text-destructive font-bold text-sm">
                    <AlertCircle className="size-5 shrink-0 mt-0.5" />
                    <div className="flex-1">
                      <div>⚠️ يوجد تعارض في الحجز — لا يمكن الحفظ</div>
                      <ul className="mt-2 space-y-1 text-xs font-semibold text-destructive/90 list-disc pr-5">
                        {conflicts.map((c, i) => (
                          <li key={i}>
                            {c.kind === "decoration" ? "الديكور" : "المستلزم"} "{c.name}" — مطلوب {c.requested}، المتاح في {form.event_date}: {c.available}
                          </li>
                        ))}
                      </ul>
                      <div className="mt-2 text-[11px] font-normal text-destructive/80">
                        💡 جرّب: تغيير التاريخ، تقليل الكمية، أو اختيار عنصر بديل.
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">إلغاء</Button>
            <Button type="submit" variant="gold" loading={loading} disabled={hasConflicts} className="flex-1">
              {hasConflicts ? <><AlertCircle className="size-4" /> يوجد تعارض</> : isEdit ? <><Check className="size-4" /> حفظ التعديلات</> : <><Plus className="size-4" /> إنشاء الحجز</>}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ============ Decorations Picker ============
function DecorationsPicker({
  decorations, selected, availabilityFor, onAdd, onRemove, onQty, onPrice, subtotal,
}: {
  decorations: Decoration[];
  selected: Record<string, { qty: number; price?: number }>;
  availabilityFor: (d: Decoration) => number;
  onAdd: (d: Decoration) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, qty: number) => void;
  onPrice: (id: string, price: number) => void;
  subtotal: number;
}) {
  const [search, setSearch] = useState("");
  const [openList, setOpenList] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpenList(false);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return decorations
      .map((d) => ({ d, avail: availabilityFor(d) }))
      .filter(({ d, avail }) => avail > 0 && !selected[d.id]
        && (!term || d.name.toLowerCase().includes(term) || (d.category || "").toLowerCase().includes(term)))
      .slice(0, 30);
  }, [decorations, search, selected, availabilityFor]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <div className="text-[11px] font-semibold text-muted-foreground">الديكورات المختارة</div>
        {subtotal > 0 && (
          <div className="text-[11px] font-bold text-gold bg-gold/10 px-2.5 py-1 rounded-full">
            مجموع الديكورات: {formatSAR(subtotal)}
          </div>
        )}
      </div>

      {/* Searchable combobox */}
      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            className={inputCls + " pr-10 pl-10"}
            placeholder="ابحث عن ديكور أو اختر من القائمة..."
            value={search}
            onFocus={() => setOpenList(true)}
            onChange={(e) => { setSearch(e.target.value); setOpenList(true); }}
          />
          <button
            type="button"
            onClick={() => setOpenList((v) => !v)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-secondary"
          >
            <ChevronDown className={`size-4 transition ${openList ? "rotate-180" : ""}`} />
          </button>
        </div>

        {openList && (
          <div className="absolute z-20 top-full mt-1 inset-x-0 max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-luxury">
            {available.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">
                لا توجد ديكورات متاحة مطابقة
              </div>
            ) : (
              available.map(({ d, avail }) => (
                <button
                  type="button"
                  key={d.id}
                  onClick={() => { onAdd(d); setSearch(""); setOpenList(false); }}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-secondary/60 text-right transition border-b border-border last:border-0"
                >
                  <div className="size-10 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                    {d.images?.[0]?.startsWith("http") ? (
                      <img src={d.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Sparkles className="size-4 text-gold/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{d.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {d.category || "—"} • متاح {avail}/{d.total_qty}
                    </div>
                  </div>
                  <div className="text-sm font-bold text-gold shrink-0">{formatSAR(+d.price)}</div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {/* Selected cards */}
      {Object.keys(selected).length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          لم تختر أي ديكور بعد. استخدم البحث بالأعلى لاختيار الديكورات.
        </div>
      ) : (
        <div className="grid gap-2">
          {Object.entries(selected).map(([id, sel]) => {
            const dec = decorations.find((d) => d.id === id);
            if (!dec) return null;
            const avail = availabilityFor(dec);
            const unitPrice = sel.price ?? +dec.price;
            const lineTotal = unitPrice * sel.qty;
            const overbooked = sel.qty > avail;
            return (
              <div key={id} className={`bg-secondary/40 border rounded-xl p-3 flex items-center gap-3 ${overbooked ? "border-destructive/40" : "border-border"}`}>
                <div className="size-12 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                  {dec.images?.[0]?.startsWith("http") ? (
                    <img src={dec.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Sparkles className="size-5 text-gold/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{dec.name}</div>
                  <div className={`text-[11px] mt-0.5 ${overbooked ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {overbooked
                      ? `الكمية المطلوبة تتجاوز المتاح (${avail})`
                      : `متاح ${avail}/${dec.total_qty}`}
                  </div>
                </div>
                {/* Qty stepper */}
                <div className="flex items-center bg-card rounded-lg border border-border overflow-hidden shrink-0">
                  <button type="button" onClick={() => onQty(id, sel.qty - 1)} disabled={sel.qty <= 1}
                    className="size-7 flex items-center justify-center hover:bg-secondary disabled:opacity-40">
                    <Minus className="size-3" />
                  </button>
                  <input
                    type="number" min={1} value={sel.qty}
                    onChange={(e) => onQty(id, +e.target.value)}
                    className="w-10 text-center text-sm font-bold bg-transparent outline-none"
                  />
                  <button type="button" onClick={() => onQty(id, sel.qty + 1)}
                    className="size-7 flex items-center justify-center hover:bg-secondary">
                    <Plus className="size-3" />
                  </button>
                </div>
                {/* Price (editable) */}
                <div className="hidden sm:flex flex-col shrink-0 w-24">
                  <input
                    type="number" min={0} value={unitPrice}
                    onChange={(e) => onPrice(id, +e.target.value)}
                    className="w-full text-sm font-bold text-gold bg-card border border-border rounded-lg px-2 py-1 text-center outline-none focus:ring-2 focus:ring-gold/40"
                    title="سعر الوحدة"
                  />
                  <div className="text-[10px] text-muted-foreground text-center mt-0.5">= {formatSAR(lineTotal)}</div>
                </div>
                <button type="button" onClick={() => onRemove(id)}
                  className="size-8 rounded-lg text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0"
                  title="إزالة">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ============ Supplies Picker (rental, date-based) ============
function SuppliesPicker({
  supplies, selected, availabilityFor, onAdd, onRemove, onQty, eventDate,
}: {
  supplies: Supply[];
  selected: Record<string, { qty: number }>;
  availabilityFor: (s: Supply) => number;
  onAdd: (s: Supply) => void;
  onRemove: (id: string) => void;
  onQty: (id: string, qty: number) => void;
  eventDate: string;
}) {
  const [search, setSearch] = useState("");
  const [openList, setOpenList] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onDoc = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) setOpenList(false);
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const available = useMemo(() => {
    const term = search.trim().toLowerCase();
    return supplies
      .map((s) => ({ s, avail: availabilityFor(s) }))
      .filter(({ s, avail }) => avail > 0 && !selected[s.id]
        && (!term || s.name.toLowerCase().includes(term) || (s.category || "").toLowerCase().includes(term)))
      .slice(0, 30);
  }, [supplies, search, selected, availabilityFor]);

  return (
    <div className="space-y-2">
      <div className="text-[11px] text-muted-foreground">
        {eventDate ? `التوفر محسوب حسب تاريخ المناسبة (${eventDate}) — يعود متوفراً تلقائياً بعد المناسبة` : "اختر تاريخ المناسبة أولاً لرؤية التوفر"}
      </div>

      <div ref={containerRef} className="relative">
        <div className="relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            className={inputCls + " pr-10 pl-10"}
            placeholder="ابحث عن مستلزم أو اختر من القائمة..."
            value={search}
            onFocus={() => setOpenList(true)}
            onChange={(e) => { setSearch(e.target.value); setOpenList(true); }}
          />
          <button type="button" onClick={() => setOpenList((v) => !v)}
            className="absolute left-2 top-1/2 -translate-y-1/2 p-1.5 rounded-lg hover:bg-secondary">
            <ChevronDown className={`size-4 transition ${openList ? "rotate-180" : ""}`} />
          </button>
        </div>

        {openList && (
          <div className="absolute z-20 top-full mt-1 inset-x-0 max-h-72 overflow-y-auto bg-card border border-border rounded-xl shadow-luxury">
            {available.length === 0 ? (
              <div className="p-4 text-xs text-muted-foreground text-center">لا توجد مستلزمات متاحة</div>
            ) : (
              available.map(({ s, avail }) => (
                <button type="button" key={s.id}
                  onClick={() => { onAdd(s); setSearch(""); setOpenList(false); }}
                  className="w-full flex items-center gap-3 p-2.5 hover:bg-secondary/60 text-right transition border-b border-border last:border-0">
                  <div className="size-10 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                    {s.images?.[0]?.startsWith("http") ? (
                      <img src={s.images[0]} alt="" className="w-full h-full object-cover" />
                    ) : (
                      <Package className="size-4 text-gold/60" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="font-semibold text-sm truncate">{s.name}</div>
                    <div className="text-[11px] text-muted-foreground">
                      {s.category || "—"} • متاح {avail}/{s.total_qty}
                    </div>
                  </div>
                </button>
              ))
            )}
          </div>
        )}
      </div>

      {Object.keys(selected).length === 0 ? (
        <div className="border-2 border-dashed border-border rounded-xl p-6 text-center text-xs text-muted-foreground">
          لم تختر أي مستلزم. سيتم حجزها فقط في تاريخ المناسبة.
        </div>
      ) : (
        <div className="grid gap-2">
          {Object.entries(selected).map(([id, sel]) => {
            const sup = supplies.find((s) => s.id === id);
            if (!sup) return null;
            const avail = availabilityFor(sup);
            const overbooked = sel.qty > avail;
            return (
              <div key={id} className={`bg-secondary/40 border rounded-xl p-3 flex items-center gap-3 ${overbooked ? "border-destructive/40" : "border-border"}`}>
                <div className="size-12 rounded-lg bg-secondary overflow-hidden shrink-0 flex items-center justify-center">
                  {sup.images?.[0]?.startsWith("http") ? (
                    <img src={sup.images[0]} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <Package className="size-5 text-gold/60" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{sup.name}</div>
                  <div className={`text-[11px] mt-0.5 ${overbooked ? "text-destructive font-semibold" : "text-muted-foreground"}`}>
                    {overbooked ? `الكمية المطلوبة تتجاوز المتاح (${avail})` : `متاح ${avail}/${sup.total_qty}`}
                  </div>
                </div>
                <div className="flex items-center bg-card rounded-lg border border-border overflow-hidden shrink-0">
                  <button type="button" onClick={() => onQty(id, sel.qty - 1)} disabled={sel.qty <= 1}
                    className="size-7 flex items-center justify-center hover:bg-secondary disabled:opacity-40">
                    <Minus className="size-3" />
                  </button>
                  <input type="number" min={1} value={sel.qty}
                    onChange={(e) => onQty(id, +e.target.value)}
                    className="w-10 text-center text-sm font-bold bg-transparent outline-none" />
                  <button type="button" onClick={() => onQty(id, sel.qty + 1)}
                    className="size-7 flex items-center justify-center hover:bg-secondary">
                    <Plus className="size-3" />
                  </button>
                </div>
                <button type="button" onClick={() => onRemove(id)}
                  className="size-8 rounded-lg text-destructive hover:bg-destructive/10 flex items-center justify-center shrink-0"
                  title="إزالة">
                  <Trash2 className="size-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

const inputCls = "w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-gold/40";

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="text-[11px] font-semibold text-muted-foreground mb-1">{label}</div>
      {children}
    </label>
  );
}

function Section({ icon, title, children }: { icon: React.ReactNode; title: string; children: React.ReactNode }) {
  return (
    <section className="bg-secondary/30 border border-border rounded-2xl p-4 sm:p-5 space-y-3">
      <div className="flex items-center gap-2">
        <div className="size-7 rounded-lg bg-gold/15 text-gold flex items-center justify-center">{icon}</div>
        <h3 className="text-sm font-bold">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function SummaryRow({ label, value, bold, muted, accent }: { label: string; value: string; bold?: boolean; muted?: boolean; accent?: boolean }) {
  return (
    <div className={`flex items-center justify-between ${bold ? "text-base font-bold text-gold" : muted ? "text-xs text-muted-foreground" : accent ? "text-sm font-bold text-warning" : ""}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}

function Pill({ label, value, tone }: { label: string; value: string; tone: "success" | "warning" | "info" }) {
  const cls = tone === "success" ? "bg-success/10 text-success" : tone === "warning" ? "bg-warning/10 text-warning" : "bg-info/10 text-info";
  return (
    <div className={`rounded-xl p-2.5 text-center ${cls}`}>
      <div className="text-[10px] text-muted-foreground">{label}</div>
      <div className="text-sm font-bold">{value}</div>
    </div>
  );
}

