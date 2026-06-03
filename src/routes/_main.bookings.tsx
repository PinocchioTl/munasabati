import { createFileRoute } from "@tanstack/react-router";
import { toast } from "sonner";
import { Card, SectionHeader, Button, LoadingState, EmptyState } from "@/components/ui-bits";
import { BookingDialog } from "@/components/BookingDialog";
import {
  useBookings, useEventTypes, useUpdateBookingStatus,
  formatSAR, statusLabels, eventTypeLabels, BookingStatus,
} from "@/lib/db";
import { Plus, Phone, Calendar, Clock, LayoutGrid, List, ChevronDown, Pencil } from "lucide-react";
import { useState, useMemo } from "react";
import { SearchBox } from "@/components/SearchBox";
import { matches } from "@/lib/search";

export const Route = createFileRoute("/_main/bookings")({
  component: BookingsPage,
});

function BookingsPage() {
  const [filter, setFilter] = useState<BookingStatus | "all">("all");
  const [eventFilter, setEventFilter] = useState<string>("all");
  const [query, setQuery] = useState("");
  const [view, setView] = useState<"cards" | "timeline">("cards");
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [dateRange, setDateRange] = useState<"all" | "today" | "week" | "month">("all");
  const { data: bookings = [], isLoading } = useBookings();
  const { data: eventTypes = [] } = useEventTypes();
  const eventTypeMap = useMemo(
    () => Object.fromEntries(eventTypes.map((t) => [t.name, t])),
    [eventTypes],
  );

  const filtered = useMemo(() => bookings.filter(b => {
    if (filter !== "all" && b.status !== filter) return false;
    if (eventFilter !== "all" && b.event_type !== eventFilter) return false;
    if (!matches(query, [
      b.customer_name,
      b.phone,
      b.event_type,
      eventTypeMap[b.event_type]?.label,
      eventTypeLabels[b.event_type],
      b.location,
      b.code,
      b.notes,
    ])) return false;
    if (dateRange !== "all") {
      const d = new Date(b.event_date + "T12:00:00");
      const now = new Date(); now.setHours(0,0,0,0);
      if (dateRange === "today") {
        const end = new Date(now); end.setDate(end.getDate()+1);
        if (d < now || d >= end) return false;
      } else if (dateRange === "week") {
        const end = new Date(now); end.setDate(end.getDate()+7);
        if (d < now || d >= end) return false;
      } else if (dateRange === "month") {
        const end = new Date(now); end.setMonth(end.getMonth()+1);
        if (d < now || d >= end) return false;
      }
    }
    return true;
  }), [bookings, filter, eventFilter, query, dateRange, eventTypeMap]);

  const stats = useMemo(() => {
    const total = bookings.reduce((s, b) => s + +b.total_price, 0);
    const paid = bookings.reduce((s, b) => s + +b.deposit, 0);
    const upcoming = bookings.filter(b => new Date(b.event_date) >= new Date() && b.status !== "cancelled").length;
    return { total, paid, upcoming };
  }, [bookings]);

  const tabs: { id: BookingStatus | "all"; label: string }[] = [
    { id: "all", label: "الكل" },
    { id: "pending", label: "قيد الانتظار" },
    { id: "confirmed", label: "مؤكد" },
    { id: "in_progress", label: "جاري التنفيذ" },
    { id: "completed", label: "مكتمل" },
    { id: "cancelled", label: "ملغي" },
  ];

  return (
    <div className="space-y-4 lg:space-y-6 animate-slide-up max-w-full">
      <div className="hidden lg:block">
      <SectionHeader
        title="الحجوزات"
        subtitle={`${bookings.length} حجز إجمالي • ${stats.upcoming} قادم • التحقق التلقائي من التعارضات مفعّل`}
        action={<Button variant="gold" onClick={() => setOpen(true)}><Plus className="size-4" />حجز جديد</Button>}
      />
      </div>

      {/* Mobile compact header */}
      <div className="lg:hidden flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight truncate">الحجوزات</h1>
          <p className="text-[11px] text-muted-foreground mt-0.5 truncate">{bookings.length} إجمالي • {stats.upcoming} قادم</p>
        </div>
        <Button variant="gold" size="sm" onClick={() => setOpen(true)} className="shrink-0"><Plus className="size-4" />جديد</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <KpiMini label="إجمالي الحجوزات" value={String(bookings.length)} />
        <KpiMini label="الحجوزات القادمة" value={String(stats.upcoming)} />
        <KpiMini label="إجمالي القيمة" value={formatSAR(stats.total)} gold />
        <KpiMini label="المدفوع" value={formatSAR(stats.paid)} />
      </div>

      <Card className="p-3 lg:p-4 sticky top-14 sm:top-16 z-20 bg-card/95 backdrop-blur supports-[backdrop-filter]:bg-card/80">
        <div className="flex flex-col gap-3">
          <div className="flex flex-col lg:flex-row gap-3">
            <SearchBox value={query} onChange={setQuery} className="flex-1"
              placeholder="ابحث باسم، هاتف، رقم حجز، نوع مناسبة، موقع..." />
            <div className="flex gap-2">
              <select value={eventFilter} onChange={(e) => setEventFilter(e.target.value as any)}
                className="flex-1 lg:flex-none bg-secondary/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring min-w-0">
                <option value="all">كل المناسبات</option>
                {eventTypes.map((t) => <option key={t.id} value={t.name}>{t.label}</option>)}
              </select>
              <div className="hidden lg:flex bg-secondary/60 rounded-xl p-1">
                <button onClick={() => setView("cards")} className={`p-2 rounded-lg transition ${view === "cards" ? "bg-card shadow-soft" : ""}`}><LayoutGrid className="size-4" /></button>
                <button onClick={() => setView("timeline")} className={`p-2 rounded-lg transition ${view === "timeline" ? "bg-card shadow-soft" : ""}`}><List className="size-4" /></button>
              </div>
            </div>
          </div>
          {/* Date quick filter */}
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
            {([
              { id: "all", label: "الكل" },
              { id: "today", label: "اليوم" },
              { id: "week", label: "هذا الأسبوع" },
              { id: "month", label: "هذا الشهر" },
            ] as const).map((r) => (
              <button key={r.id} onClick={() => setDateRange(r.id)}
                className={`px-3 py-1.5 rounded-lg text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
                  dateRange === r.id ? "bg-gold text-primary shadow-soft" : "bg-secondary/60 hover:bg-secondary"
                }`}>{r.label}</button>
            ))}
          </div>
          <div className="flex gap-1.5 overflow-x-auto -mx-1 px-1 scrollbar-none">
            {tabs.map((t) => {
              const count = t.id === "all" ? bookings.length : bookings.filter(b => b.status === t.id).length;
              return (
                <button key={t.id} onClick={() => setFilter(t.id)}
                  className={`px-3 lg:px-4 py-1.5 lg:py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition flex items-center gap-1.5 lg:gap-2 shrink-0 ${
                    filter === t.id ? "bg-primary text-primary-foreground shadow-elegant" : "bg-secondary hover:bg-secondary/70"
                  }`}>
                  {t.label}
                  <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === t.id ? "bg-primary-foreground/20" : "bg-card"}`}>{count}</span>
                </button>
              );
            })}
          </div>
        </div>
      </Card>

      {isLoading ? <LoadingState rows={4} /> : filtered.length === 0 ? (
        <EmptyState title="لا توجد حجوزات مطابقة" description="جرّب تغيير الفلاتر أو ابدأ بإنشاء حجز جديد"
          action={<Button variant="gold" onClick={() => setOpen(true)}><Plus className="size-4" />حجز جديد</Button>} />
      ) : view === "cards" ? (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-3 lg:gap-4">
          {filtered.map(b => <BookingCard key={b.id} b={b} typeMap={eventTypeMap} onEdit={() => setEditing(b)} />)}
        </div>
      ) : (
        <TimelineView bookings={filtered} typeMap={eventTypeMap} onEdit={(b) => setEditing(b)} />
      )}

      <BookingDialog open={open} onClose={() => setOpen(false)} />
      <BookingDialog open={!!editing} booking={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function KpiMini({ label, value, gold }: { label: string; value: string; gold?: boolean }) {
  return (
    <Card className="p-3 lg:p-4">
      <div className="text-[10px] lg:text-[11px] text-muted-foreground truncate">{label}</div>
      <div className={`text-base lg:text-xl font-bold mt-1 truncate ${gold ? "text-gold" : ""}`}>{value}</div>
    </Card>
  );
}

function BookingCard({ b, typeMap, onEdit }: { b: any; typeMap: Record<string, { label: string; color: string | null }>; onEdit?: () => void }) {
  const total = +b.total_price; const paid = +b.deposit;
  const paidPct = total > 0 ? Math.round((paid / total) * 100) : 0;
  const decorations = b.booking_decorations || [];
  const evt = typeMap[b.event_type];
  return (
    <Card className="p-5 hover:shadow-luxury transition-all">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div
            className="size-12 rounded-2xl bg-gradient-luxury text-gold flex flex-col items-center justify-center shrink-0"
            style={evt?.color ? { background: evt.color, color: "#fff" } : undefined}
          >
            <span className="text-[9px] opacity-70">حجز</span>
            <span className="text-[10px] font-bold">{b.code?.split("-")[1] || "•"}</span>
          </div>
          <div className="min-w-0">
            <div className="font-bold text-base truncate">{b.customer_name}</div>
            <div className="text-xs text-muted-foreground flex items-center gap-1.5 mt-1">
              <Phone className="size-3" /> {b.phone || "—"}
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {onEdit && (
            <button type="button" onClick={onEdit}
              className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
              title="تعديل الحجز">
              <Pencil className="size-4" />
            </button>
          )}
          <StatusSelector id={b.id} status={b.status} />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 mt-5">
        <Mini label="نوع المناسبة" value={evt?.label || b.event_type} />
        <Mini label="السعر الإجمالي" value={formatSAR(total)} gold />
        <Mini label="التاريخ" value={b.event_date} icon={<Calendar className="size-4 text-info" />} />
        <Mini label="الوقت" value={`${b.start_time?.slice(0,5)} — ${b.end_time?.slice(0,5)}`} icon={<Clock className="size-4 text-info" />} />
      </div>

      {decorations.length > 0 && (
        <div className="mt-4 flex flex-wrap gap-1.5">
          {decorations.map((bd: any) => (
            <span key={bd.decoration_id} className="text-[11px] bg-gold/10 text-gold border border-gold/20 px-2.5 py-1 rounded-full font-medium">
              {bd.decoration?.name}{bd.qty > 1 && ` ×${bd.qty}`}
            </span>
          ))}
        </div>
      )}

      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-muted-foreground">المدفوع</span>
          <span className="font-bold">{formatSAR(paid)} <span className="text-muted-foreground font-normal">/ {formatSAR(total)}</span></span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div className="h-full bg-success rounded-full transition-all" style={{ width: `${paidPct}%` }} />
        </div>
        {+b.remaining > 0 && (
          <div className="text-[11px] text-warning font-semibold mt-2">المتبقي: {formatSAR(+b.remaining)}</div>
        )}
      </div>
    </Card>
  );
}

function TimelineView({ bookings, typeMap, onEdit }: { bookings: any[]; typeMap: Record<string, { label: string }>; onEdit?: (b: any) => void }) {
  const grouped = useMemo(() => {
    const map: Record<string, any[]> = {};
    bookings.forEach(b => { (map[b.event_date] ||= []).push(b); });
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [bookings]);

  return (
    <Card className="p-6">
      <div className="space-y-6">
        {grouped.map(([date, items]) => (
          <div key={date} className="flex gap-4">
            <div className="flex flex-col items-center shrink-0">
              <div className="size-14 rounded-2xl bg-gradient-luxury text-gold flex flex-col items-center justify-center">
                <span className="text-[10px] opacity-70">{date.slice(5,7)}/{date.slice(8,10)}</span>
                <span className="text-[10px] font-bold">{date.slice(0,4)}</span>
              </div>
              <div className="w-px flex-1 bg-border mt-2" />
            </div>
            <div className="flex-1 space-y-2 pb-2">
              <div className="text-xs text-muted-foreground font-semibold">{date} • {items.length} حجز</div>
              {items.map(b => (
                <div key={b.id} className="bg-secondary/40 rounded-xl p-3 flex items-center justify-between gap-3 hover:bg-secondary transition">
                  <div className="min-w-0">
                    <div className="font-bold text-sm truncate">{b.customer_name}</div>
                    <div className="text-[11px] text-muted-foreground mt-0.5">
                      {typeMap[b.event_type]?.label || b.event_type} • {b.start_time?.slice(0,5)}—{b.end_time?.slice(0,5)}
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <span className="text-sm font-bold text-gold">{formatSAR(+b.total_price)}</span>
                    {onEdit && (
                      <button type="button" onClick={() => onEdit(b)}
                        className="p-1.5 rounded-lg hover:bg-card text-muted-foreground hover:text-foreground transition"
                        title="تعديل">
                        <Pencil className="size-3.5" />
                      </button>
                    )}
                    <StatusSelector id={b.id} status={b.status} />
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

function Mini({ label, value, gold, icon }: any) {
  return (
    <div className="bg-secondary/50 rounded-xl p-3 flex items-center gap-2">
      {icon}
      <div>
        <div className="text-[10px] text-muted-foreground">{label}</div>
        <div className={`text-sm font-bold mt-0.5 ${gold ? "text-gold" : ""}`}>{value}</div>
      </div>
    </div>
  );
}

const statusOrder: BookingStatus[] = ["pending", "confirmed", "in_progress", "completed", "cancelled"];
const statusClass: Record<BookingStatus, string> = {
  pending: "bg-warning/15 text-warning border-warning/30",
  confirmed: "bg-success/15 text-success border-success/30",
  in_progress: "bg-info/15 text-info border-info/30",
  completed: "bg-[oklch(0.55_0.18_295)]/15 text-[oklch(0.65_0.22_295)] border-[oklch(0.55_0.18_295)]/30",
  cancelled: "bg-destructive/15 text-destructive border-destructive/30",
};

function StatusSelector({ id, status }: { id: string; status: BookingStatus }) {
  const update = useUpdateBookingStatus();
  return (
    <div className="relative inline-flex items-center">
      <select
        value={status}
        disabled={update.isPending}
        onChange={async (e) => {
          const next = e.target.value as BookingStatus;
          if (next === status) return;
          try {
            await update.mutateAsync({ id, status: next });
            toast.success(`تم تحديث الحالة إلى: ${statusLabels[next]}`);
          } catch (err: any) {
            toast.error("تعذّر تحديث الحالة", { description: err?.message });
          }
        }}
        className={`appearance-none cursor-pointer text-[11px] font-semibold pr-7 pl-3 py-1 rounded-full border outline-none focus:ring-2 focus:ring-ring transition ${statusClass[status]}`}
      >
        {statusOrder.map((s) => (
          <option key={s} value={s} className="bg-card text-foreground">{statusLabels[s]}</option>
        ))}
      </select>
      <ChevronDown className="absolute left-2 size-3 pointer-events-none opacity-70" />
    </div>
  );
}
