import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicDecorations, getPublicOwner } from "@/lib/booking-public.functions";
import { Sparkles, ArrowLeft, Loader2 } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/booking/$slug/decorations")({
  component: DecorationsPage,
});

function DecorationsPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { data: owner } = useQuery({
    queryKey: ["public-owner", slug],
    queryFn: () => getPublicOwner({ data: { slug } }),
    retry: false,
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-decorations", slug],
    queryFn: () => getPublicDecorations({ data: { slug } }),
    retry: false,
  });

  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("all");

  const categories = useMemo(
    () => Array.from(new Set(items.map(i => i.category).filter(Boolean) as string[])),
    [items],
  );
  const filtered = useMemo(
    () => items.filter(i =>
      (cat === "all" || i.category === cat) &&
      (!q.trim() || (i.name + " " + (i.category ?? "")).toLowerCase().includes(q.toLowerCase()))
    ),
    [items, q, cat],
  );

  const showPrices = owner?.show_prices ?? true;

  return (
    <div className="space-y-5">
      <header className="flex items-end justify-between gap-3 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold bk-text-primary flex items-center gap-2">
            <Sparkles className="size-5 bk-text-gold" /> الديكورات
          </h1>
          <p className="text-sm text-gray-600 mt-1">{items.length} ديكور متاح للحجز</p>
        </div>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm sticky top-[105px] z-20 space-y-2">
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث عن ديكور..."
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]"
        />
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            <CatBtn label="الكل" active={cat === "all"} onClick={() => setCat("all")} />
            {categories.map(c => (
              <CatBtn key={c} label={c} active={cat === c} onClick={() => setCat(c)} />
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin bk-text-gold" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 bg-white rounded-2xl">لا توجد نتائج مطابقة</div>
      ) : (
        <div className="grid grid-cols-2 lg:grid-cols-3 gap-3 sm:gap-4">
          {filtered.map(d => (
            <Link
              key={d.id}
              to={"/booking/$slug/decorations/$id" as any}
              params={{ slug, id: d.id } as any}
              className="group bg-white rounded-2xl overflow-hidden shadow-sm hover:shadow-xl transition border border-transparent hover:bk-border-gold"
            >
              <div className="aspect-square bg-gray-100 relative overflow-hidden">
                {d.images?.[0] ? (
                  <img src={d.images[0]} alt={d.name} loading="lazy"
                    className="absolute inset-0 size-full object-cover group-hover:scale-105 transition" />
                ) : (
                  <div className="size-full flex items-center justify-center text-gray-300"><Sparkles className="size-8" /></div>
                )}
                {d.category && (
                  <span className="absolute top-2 right-2 text-[10px] font-bold px-2 py-0.5 rounded-full bg-white/90 bk-text-primary">
                    {d.category}
                  </span>
                )}
              </div>
              <div className="p-3">
                <div className="font-bold text-sm truncate bk-text-primary">{d.name}</div>
                <div className="flex items-center justify-between mt-2">
                  {showPrices ? (
                    <span className="text-sm font-bold bk-text-gold">
                      {new Intl.NumberFormat("ar-DZ").format(d.price || 0)} د.ج
                    </span>
                  ) : <span className="text-xs text-gray-500">للسعر تواصل</span>}
                  <ArrowLeft className="size-3.5 text-gray-400 group-hover:bk-text-gold transition" />
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function CatBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button onClick={onClick}
      className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 transition ${
        active ? "bk-gold shadow" : "bg-gray-100 text-gray-600"
      }`}>{label}</button>
  );
}