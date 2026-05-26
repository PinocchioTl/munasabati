import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, Button, LoadingState, EmptyState } from "@/components/ui-bits";
import { useSupplies, useBookings, supplyAvailableOnDate, formatSAR, type Supply } from "@/lib/db";
import { SupplyDialog } from "@/components/ItemDialog";
import { Plus, AlertTriangle, Package, Search, Pencil, CalendarClock } from "lucide-react";
import { useState, useMemo } from "react";

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
  const [checkDate, setCheckDate] = useState(() => new Date().toISOString().slice(0, 10));

  const categories = useMemo(() =>
    ["الكل", ...Array.from(new Set(supplies.map(s => s.category).filter(Boolean) as string[]))],
    [supplies]);

  const filtered = useMemo(() => supplies.filter(s => {
    if (cat !== "الكل" && s.category !== cat) return false;
    if (query && !s.name.includes(query) && !s.supplier?.includes(query)) return false;
    return true;
  }), [supplies, query, cat]);

  const stats = useMemo(() => {
    const totalUnits = supplies.reduce((sum, s) => sum + s.total_qty, 0);
    const bookedToday = supplies.reduce((sum, s) => sum + (s.total_qty - supplyAvailableOnDate(s, checkDate, bookings)), 0);
    const totalValue = supplies.reduce((sum, s) => sum + (+s.cost * s.total_qty), 0);
    const fullyBookedToday = supplies.filter(s => supplyAvailableOnDate(s, checkDate, bookings) <= 0).length;
    return { totalUnits, bookedToday, totalValue, fullyBookedToday };
  }, [supplies, bookings, checkDate]);

  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader
        title="المستلزمات"
        subtitle={`${supplies.length} عنصر — نظام كراء: تعود متوفرة تلقائياً بعد المناسبة`}
        action={<Button variant="gold" onClick={() => setOpen(true)}><Plus className="size-4" />إضافة عنصر</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiMini label="عدد العناصر" value={String(supplies.length)} />
        <KpiMini label="إجمالي الوحدات" value={String(stats.totalUnits)} />
        <KpiMini label={`محجوز يوم ${checkDate}`} value={String(stats.bookedToday)} warn={stats.bookedToday > 0} />
        <KpiMini label="قيمة المخزون" value={formatSAR(stats.totalValue)} gold />
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-3 lg:items-center">
        <div className="flex items-center gap-2 shrink-0">
          <CalendarClock className="size-4 text-gold" />
          <span className="text-xs font-semibold text-muted-foreground">عرض التوفر ليوم:</span>
          <input type="date" value={checkDate} onChange={(e) => setCheckDate(e.target.value)}
            className="bg-secondary/60 rounded-xl px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring" />
        </div>
        <div className="flex-1 relative">
          <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <input value={query} onChange={(e) => setQuery(e.target.value)}
            className="w-full bg-secondary/60 rounded-xl pr-10 pl-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring"
            placeholder="ابحث بالاسم أو المورد..." />
        </div>
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              cat === c ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
            }`}>{c}</button>
          ))}
        </div>
      </Card>

      {isLoading ? <LoadingState rows={4} /> : filtered.length === 0 ? (
        <EmptyState title="لا توجد مستلزمات مطابقة" />
      ) : (
        <Card className="overflow-hidden">
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
      )}
      <SupplyDialog open={open} onClose={() => setOpen(false)} />
      <SupplyDialog open={!!editing} supply={editing} onClose={() => setEditing(null)} />
    </div>
  );
}

function KpiMini({ label, value, warn, gold }: { label: string; value: string; warn?: boolean; gold?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${warn ? "text-warning" : gold ? "text-gold" : ""}`}>{value}</div>
    </Card>
  );
}
