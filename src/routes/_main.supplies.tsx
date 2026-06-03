import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, Button, LoadingState, EmptyState } from "@/components/ui-bits";
import { useSupplies, useBookings, supplyAvailableOnDate, formatSAR, type Supply } from "@/lib/db";
import { SupplyDialog } from "@/components/ItemDialog";
import { Plus, AlertTriangle, Package, Pencil, CalendarClock } from "lucide-react";
import { useState, useMemo } from "react";
import { SearchBox } from "@/components/SearchBox";
import { matches } from "@/lib/search";

export const Route = createFileRoute("/_main/supplies")({
  component: SuppliesPage,
});

function SuppliesPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Supply | null>(null);
  const { data: supplies = [], isLoading } = useSupplies();
  const { data: bookings = [] } = useBookings();
  const [query, setQuery] = useState("");
  const [cat, setCat] = useState("الكل");
  const [statusFilter, setStatusFilter] = useState<"all" | "available" | "low" | "unavailable">("all");
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10));

  const categories = useMemo(() =>
    ["الكل", ...Array.from(new Set(supplies.map(s => s.category).filter(Boolean) as string[]))],
    [supplies]);

  const filtered = useMemo(() => supplies.filter(s => {
    if (cat !== "الكل" && s.category !== cat) return false;
    if (!matches(query, [s.name, s.category])) return false;
    if (statusFilter !== "all") {
      const avail = supplyAvailableOnDate(s, checkDate, bookings);
      const pct = s.total_qty > 0 ? (avail / s.total_qty) * 100 : 0;
      if (statusFilter === "unavailable" && avail > 0) return false;
      if (statusFilter === "low" && (avail <= 0 || pct >= 30)) return false;
      if (statusFilter === "available" && (avail <= 0 || pct < 30)) return false;
    }
    return true;
  }), [supplies, query, cat, statusFilter, bookings, checkDate]);

  const stats = useMemo(() => {
    const totalUnits = supplies.reduce((sum, s) => sum + s.total_qty, 0);
    const bookedToday = supplies.reduce((sum, s) => sum + (s.total_qty - supplyAvailableOnDate(s, checkDate, bookings)), 0);
    const totalValue = supplies.reduce((sum, s) => sum + (+s.cost * s.total_qty), 0);
    const fullyBookedToday = supplies.filter(s => supplyAvailableOnDate(s, checkDate, bookings) <= 0).length;
    return { totalUnits, bookedToday, totalValue, fullyBookedToday };
  }, [supplies, bookings, checkDate]);

  return (
    <div className="space-y-4 lg:space-y-6 animate-slide-up min-w-0">
      <div className="hidden lg:block">
        <SectionHeader
          title="المستلزمات"
          subtitle={`${supplies.length} عنصر — نظام كراء: تعود متوفرة تلقائياً بعد المناسبة`}
          action={<Button variant="gold" onClick={() => setOpen(true)}><Plus className="size-4" />إضافة عنصر</Button>}
        />
      </div>
      <div className="lg:hidden flex items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className="text-lg font-bold truncate">المستلزمات</h1>
          <p className="text-[11px] text-muted-foreground truncate">{supplies.length} عنصر — نظام كراء</p>
        </div>
        <Button variant="gold" onClick={() => setOpen(true)} className="shrink-0 h-9 px-3 text-xs"><Plus className="size-4" />جديد</Button>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-2 lg:gap-3">
        <KpiMini label="العناصر" value={String(supplies.length)} />
        <KpiMini label="الوحدات" value={String(stats.totalUnits)} />
        <KpiMini label={`محجوز اليوم`} value={String(stats.bookedToday)} warn={stats.bookedToday > 0} />
        <KpiMini label="قيمة المخزون" value={formatSAR(stats.totalValue)} gold />
      </div>

      <div className="sticky top-14 sm:top-16 z-20 -mx-3 sm:-mx-4 lg:mx-0 px-3 sm:px-4 lg:px-0 py-2 bg-background/95 backdrop-blur space-y-2">
      <Card className="p-3 lg:p-4 flex flex-col lg:flex-row gap-2 lg:gap-3 lg:items-center">
        <div className="flex items-center gap-2 shrink-0">
          <CalendarClock className="size-4 text-gold shrink-0" />
          <span className="text-[11px] lg:text-xs font-semibold text-muted-foreground shrink-0">توفر يوم:</span>
          <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)}
            className="bg-secondary/60 rounded-xl px-2 py-1.5 text-xs lg:text-sm outline-none focus:ring-2 focus:ring-ring min-w-0 flex-1 lg:flex-none" />
        </div>
        <SearchBox value={query} onChange={setQuery} className="flex-1 min-w-0"
          placeholder="ابحث باسم المستلزم أو التصنيف..." />
        <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-3 py-1.5 rounded-xl text-[11px] lg:text-xs font-semibold whitespace-nowrap transition ${
              cat === c ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
            }`}>{c}</button>
          ))}
        </div>
      </Card>
      <div className="flex gap-2 overflow-x-auto scrollbar-none -mx-1 px-1">
        {([
          { k: "all", l: "الكل" },
          { k: "available", l: "متوفر" },
          { k: "low", l: "منخفض" },
          { k: "unavailable", l: "غير متوفر" },
        ] as const).map(({ k, l }) => (
          <button key={k} onClick={() => setStatusFilter(k)} className={`px-3 py-1.5 rounded-xl text-[11px] font-semibold whitespace-nowrap transition shrink-0 ${
            statusFilter === k ? "bg-foreground text-background" : "bg-secondary hover:bg-secondary/70"
          }`}>{l}</button>
        ))}
      </div>
      </div>

      {isLoading ? <LoadingState rows={4} /> : filtered.length === 0 ? (
        <EmptyState title="لا توجد مستلزمات مطابقة" />
      ) : (
        <>
        {/* Mobile cards */}
        <div className="lg:hidden grid grid-cols-1 gap-2">
          {filtered.map(s => {
            const avail = supplyAvailableOnDate(s, checkDate, bookings);
            const booked = s.total_qty - avail;
            const pct = s.total_qty > 0 ? (avail / s.total_qty) * 100 : 0;
            const fullyBooked = avail <= 0;
            return (
              <div key={s.id} onClick={() => setEditing(s)} className={`p-3 flex gap-3 items-center cursor-pointer min-w-0 rounded-2xl border border-border bg-card shadow-sm ${fullyBooked ? "opacity-70" : ""}`}>
                <div className="size-14 rounded-lg bg-gradient-to-br from-gold/15 to-info/10 overflow-hidden flex items-center justify-center shrink-0">
                  {s.images?.[0]?.startsWith("http") ? (
                    <img src={s.images[0]} alt={s.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                  ) : (
                    <Package className="size-5 text-gold" />
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center justify-between gap-2">
                    <div className="font-semibold text-sm truncate">{s.name}</div>
                    {fullyBooked ? (
                      <span className="text-[10px] font-bold text-destructive bg-destructive/10 px-1.5 py-0.5 rounded-full shrink-0">محجوز</span>
                    ) : booked > 0 ? (
                      <span className="text-[10px] font-bold text-warning bg-warning/10 px-1.5 py-0.5 rounded-full shrink-0">جزئي</span>
                    ) : (
                      <span className="text-[10px] font-bold text-success bg-success/10 px-1.5 py-0.5 rounded-full shrink-0">متاح</span>
                    )}
                  </div>
                  <div className="flex justify-between items-center text-[11px] mt-1">
                    <span className="text-muted-foreground truncate">{s.category || "—"}</span>
                    <span className="text-gold font-bold shrink-0">{formatSAR(+s.cost)}</span>
                  </div>
                  <div className="mt-1.5">
                    <div className="flex justify-between text-[11px] mb-0.5">
                      <span className="font-bold">{avail} متاح</span>
                      <span className="text-muted-foreground">/ {s.total_qty}{booked > 0 ? ` • محجوز ${booked}` : ""}</span>
                    </div>
                    <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                      <div className={`h-full rounded-full transition-all ${fullyBooked ? "bg-destructive" : pct < 30 ? "bg-warning" : "bg-success"}`} style={{ width: `${Math.max(pct, fullyBooked ? 100 : 0)}%` }} />
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
        {/* Desktop table */}
        <Card className="overflow-hidden hidden lg:block">
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-secondary/50 text-xs font-bold text-muted-foreground">
                <tr>
                  <th className="text-right py-3 px-4">العنصر</th>
                  <th className="text-right py-3 px-4 hidden md:table-cell">التصنيف</th>
                  <th className="text-right py-3 px-4">المتاح في {checkDate}</th>
                  <th className="text-right py-3 px-4 hidden lg:table-cell">المورد</th>
                  <th className="text-right py-3 px-4">التكلفة</th>
                  <th className="text-right py-3 px-4">الحالة</th>
                  <th className="text-right py-3 px-4"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {filtered.map(s => {
                  const avail = supplyAvailableOnDate(s, checkDate, bookings);
                  const booked = s.total_qty - avail;
                  const pct = s.total_qty > 0 ? (avail / s.total_qty) * 100 : 0;
                  const fullyBooked = avail <= 0;
                  return (
                    <tr key={s.id} onClick={() => setEditing(s)} className="hover:bg-secondary/30 transition cursor-pointer">
                      <td className="py-4 px-4">
                        <div className="flex items-center gap-3">
                          <div className="size-10 rounded-lg bg-gradient-to-br from-gold/15 to-info/10 overflow-hidden flex items-center justify-center">
                            {s.images?.[0]?.startsWith("http") ? (
                              <img src={s.images[0]} alt={s.name} className="w-full h-full object-cover" loading="lazy" />
                            ) : (
                              <Package className="size-4 text-gold" />
                            )}
                          </div>
                          <div className="font-semibold">{s.name}</div>
                        </div>
                      </td>
                      <td className="py-4 px-4 hidden md:table-cell text-muted-foreground">{s.category}</td>
                      <td className="py-4 px-4">
                        <div className="min-w-[160px]">
                          <div className="flex justify-between text-xs mb-1">
                            <span className="font-bold">{avail}</span>
                            <span className="text-muted-foreground">/ {s.total_qty} {booked > 0 ? `(محجوز ${booked})` : ""}</span>
                          </div>
                          <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                            <div className={`h-full rounded-full transition-all ${fullyBooked ? "bg-destructive" : pct < 30 ? "bg-warning" : "bg-success"}`} style={{ width: `${pct}%` }} />
                          </div>
                        </div>
                      </td>
                      <td className="py-4 px-4 hidden lg:table-cell text-muted-foreground">{s.supplier || "—"}</td>
                      <td className="py-4 px-4 font-bold text-gold">{formatSAR(+s.cost)}</td>
                      <td className="py-4 px-4">
                        {fullyBooked ? (
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-destructive bg-destructive/10 px-2 py-1 rounded-full">
                            <AlertTriangle className="size-3" /> محجوز بالكامل
                          </span>
                        ) : booked > 0 ? (
                          <span className="text-[11px] font-bold text-warning bg-warning/10 px-2 py-1 rounded-full">محجوز جزئياً</span>
                        ) : (
                          <span className="text-[11px] font-bold text-success bg-success/10 px-2 py-1 rounded-full">متاح</span>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <button
                          onClick={(e) => { e.stopPropagation(); setEditing(s); }}
                          className="p-2 rounded-lg hover:bg-secondary text-muted-foreground hover:text-foreground transition"
                          title="تعديل"
                        >
                          <Pencil className="size-4" />
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </Card>
        </>
      )}
      <SupplyDialog open={open} onClose={() => setOpen(false)} />
      <SupplyDialog open={!!editing} supply={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function KpiMini({ label, value, warn, gold }: { label: string; value: string; warn?: boolean; gold?: boolean }) {
  return (
    <Card className="p-3 lg:p-4 min-w-0">
      <div className="text-[10px] lg:text-[11px] text-muted-foreground truncate">{label}</div>
      <div className={`text-base lg:text-xl font-bold mt-1 truncate ${warn ? "text-warning" : gold ? "text-gold" : ""}`}>{value}</div>
    </Card>
  );
}
