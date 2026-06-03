import { createFileRoute } from "@tanstack/react-router";
import { Card, SectionHeader, Button, LoadingState, EmptyState } from "@/components/ui-bits";
import { useDecorations, formatSAR, itemStatusLabels, type Decoration } from "@/lib/db";
import { DecorationDialog } from "@/components/ItemDialog";
import { Plus, Flame, TrendingUp, Pencil, X } from "lucide-react";
import { useState, useMemo } from "react";
import { SearchBox } from "@/components/SearchBox";
import { matches } from "@/lib/search";

export const Route = createFileRoute("/_main/decorations")({
  component: DecorationsPage,
});

function DecorationsPage() {
  const [open, setOpen] = useState(false);
  const [editing, setEditing] = useState<Decoration | null>(null);
  const { data: decorations = [], isLoading } = useDecorations();
  const [cat, setCat] = useState("الكل");
  const [query, setQuery] = useState("");
  const [lightbox, setLightbox] = useState<{ src: string; name: string } | null>(null);

  const categories = useMemo(() =>
    ["الكل", ...Array.from(new Set(decorations.map(d => d.category).filter(Boolean) as string[]))],
    [decorations]);

  const topId = useMemo(() => {
    const sorted = [...decorations].sort((a, b) => b.bookings_count - a.bookings_count);
    return sorted[0]?.bookings_count > 0 ? sorted[0].id : null;
  }, [decorations]);

  const list = useMemo(() => decorations.filter(d => {
    if (cat !== "الكل" && d.category !== cat) return false;
    if (!matches(query, [d.name, d.description, d.category])) return false;
    return true;
  }), [decorations, cat, query]);

  const stats = useMemo(() => {
    const totalItems = decorations.reduce((s, d) => s + d.total_qty, 0);
    const booked = decorations.reduce((s, d) => s + d.booked_qty, 0);
    const lowStock = decorations.filter(d => d.status === "limited" || d.status === "unavailable").length;
    return { totalItems, booked, lowStock };
  }, [decorations]);

  return (
    <div className="space-y-6 animate-slide-up">
      <SectionHeader
        title="الديكورات"
        subtitle="معرض كامل للديكورات — المخزون يُحدّث تلقائياً بعد كل حجز"
        action={<Button variant="gold" onClick={() => setOpen(true)}><Plus className="size-4" />إضافة ديكور</Button>}
      />

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <KpiMini label="عدد الديكورات" value={String(decorations.length)} />
        <KpiMini label="الكمية الكلية" value={String(stats.totalItems)} />
        <KpiMini label="المحجوز حالياً" value={String(stats.booked)} />
        <KpiMini label="بحاجة للتزويد" value={String(stats.lowStock)} warn={stats.lowStock > 0} />
      </div>

      <Card className="p-4 flex flex-col lg:flex-row gap-3">
        <SearchBox value={query} onChange={setQuery} className="flex-1"
          placeholder="ابحث باسم الديكور أو الوصف..." />
        <div className="flex gap-2 overflow-x-auto">
          {categories.map((c) => (
            <button key={c} onClick={() => setCat(c)} className={`px-4 py-2 rounded-xl text-xs font-semibold whitespace-nowrap transition ${
              cat === c ? "bg-primary text-primary-foreground" : "bg-secondary hover:bg-secondary/70"
            }`}>{c}</button>
          ))}
        </div>
      </Card>

      {isLoading ? <LoadingState rows={3} /> : list.length === 0 ? (
        <EmptyState title="لا توجد ديكورات مطابقة" description="جرّب تغيير البحث أو التصنيف" />
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4">
          {list.map(d => {
            const available = Math.max(d.total_qty - d.booked_qty, 0);
            const pct = d.total_qty > 0 ? (available / d.total_qty) * 100 : 0;
            const statusColor = d.status === "unavailable" ? "text-destructive bg-destructive/10"
              : d.status === "limited" ? "text-warning bg-warning/10"
              : "text-success bg-success/10";
            const isTop = d.id === topId;
            const cover = d.images?.[0];
            const hasImg = !!cover && cover.startsWith("http");
            return (
              <Card key={d.id} className="p-3 sm:p-5 hover:shadow-luxury transition group relative overflow-hidden">
                {isTop && (
                  <div className="absolute top-2 left-2 z-10 bg-gradient-gold text-primary text-[10px] font-bold px-2 py-1 rounded-full flex items-center gap-1 shadow-gold pointer-events-none">
                    <Flame className="size-3" /> الأكثر طلباً
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => setEditing(d)}
                  aria-label="تعديل الديكور"
                  className="absolute top-2 right-2 z-10 size-8 sm:size-9 rounded-full bg-card/90 backdrop-blur border border-border shadow-sm flex items-center justify-center text-muted-foreground hover:text-gold hover:border-gold/50 transition sm:opacity-0 sm:group-hover:opacity-100 sm:focus:opacity-100"
                >
                  <Pencil className="size-3.5 sm:size-4" />
                </button>

                {/* Mobile: horizontal thumbnail row; Desktop: cover image */}
                <div className="flex sm:block gap-3 sm:gap-0">
                  <button
                    type="button"
                    onClick={() => hasImg && setLightbox({ src: cover!, name: d.name })}
                    className="shrink-0 size-20 sm:size-auto sm:w-full sm:aspect-square rounded-xl sm:rounded-2xl bg-gradient-to-br from-gold/10 via-secondary to-info/5 overflow-hidden sm:mb-4 sm:group-hover:scale-[1.02] transition flex items-center justify-center"
                    aria-label={hasImg ? "عرض الصورة" : d.name}
                  >
                    {hasImg ? (
                      <img src={cover} alt={d.name} className="w-full h-full object-cover" loading="lazy" decoding="async" />
                    ) : (
                      <Flame className="size-8 sm:size-10 text-gold/40" />
                    )}
                  </button>
                  <div className="min-w-0 flex-1 sm:contents">
                    <div className="flex items-start justify-between gap-2">
                      <div className="min-w-0">
                        <div className="font-bold text-sm sm:text-base truncate">{d.name}</div>
                        <div className="text-[11px] text-muted-foreground mt-0.5 truncate">{d.category}</div>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-full whitespace-nowrap shrink-0 ${statusColor}`}>{itemStatusLabels[d.status]}</span>
                    </div>
                    <div className="mt-1 sm:mt-4 text-base sm:text-lg font-bold text-gold">{formatSAR(+d.price)}</div>
                  </div>
                </div>
                <div className="mt-3 pt-3 border-t border-border space-y-1.5">
                  <div className="flex justify-between text-xs">
                    <span className="text-muted-foreground">المتوفر</span>
                    <span className="font-bold">{available} / {d.total_qty}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full transition-all ${pct < 30 ? "bg-destructive" : pct < 60 ? "bg-warning" : "bg-gradient-gold"}`} style={{ width: `${pct}%` }} />
                  </div>
                  {d.bookings_count > 0 && (
                    <div className="text-[10px] text-muted-foreground pt-1 flex items-center gap-1">
                      <TrendingUp className="size-3" />
                      {d.bookings_count} حجز • {formatSAR(+d.total_revenue)}
                    </div>
                  )}
                </div>
              </Card>
            );
          })}
        </div>
      )}
      <DecorationDialog open={open} onClose={() => setOpen(false)} />
      <DecorationDialog open={!!editing} onClose={() => setEditing(null)} decoration={editing} />
      {lightbox && (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur flex items-center justify-center p-4 animate-fade-in"
             onClick={() => setLightbox(null)} role="dialog">
          <button onClick={() => setLightbox(null)}
            className="absolute top-4 right-4 size-10 rounded-full bg-white/10 text-white flex items-center justify-center hover:bg-white/20">
            <X className="size-5" />
          </button>
          <img src={lightbox.src} alt={lightbox.name}
            className="max-w-full max-h-full object-contain rounded-xl shadow-luxury"
            onClick={(e) => e.stopPropagation()} />
          <div className="absolute bottom-6 inset-x-0 text-center text-white text-sm font-semibold drop-shadow">
            {lightbox.name}
          </div>
        </div>
      )}
    </div>
  );
}

function KpiMini({ label, value, warn }: { label: string; value: string; warn?: boolean }) {
  return (
    <Card className="p-4">
      <div className="text-[11px] text-muted-foreground">{label}</div>
      <div className={`text-xl font-bold mt-1 ${warn ? "text-warning" : ""}`}>{value}</div>
    </Card>
  );
}
