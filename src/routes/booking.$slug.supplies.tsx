import { createFileRoute, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getPublicOwner, getPublicSupplies } from "@/lib/booking-public.functions";
import { Loader2, Package } from "lucide-react";
import { useMemo, useState } from "react";

export const Route = createFileRoute("/booking/$slug/supplies")({
  component: SuppliesPage,
});

function SuppliesPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const { data: owner } = useQuery({
    queryKey: ["public-owner", slug],
    queryFn: () => getPublicOwner({ data: { slug } }),
    retry: false,
  });
  const { data: items = [], isLoading } = useQuery({
    queryKey: ["public-supplies", slug],
    queryFn: () => getPublicSupplies({ data: { slug } }),
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
      <header>
        <h1 className="text-2xl font-bold bk-text-primary flex items-center gap-2">
          <Package className="size-5 bk-text-gold" /> المستلزمات
        </h1>
        <p className="text-sm text-gray-600 mt-1">كراسي، طاولات، إضاءة وشاشات وأكثر</p>
      </header>

      <div className="bg-white rounded-2xl p-3 shadow-sm sticky top-[105px] z-20 space-y-2">
        <input value={q} onChange={(e) => setQ(e.target.value)}
          placeholder="ابحث في المستلزمات..."
          className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]" />
        {categories.length > 0 && (
          <div className="flex gap-1.5 overflow-x-auto scrollbar-none -mx-1 px-1">
            <button onClick={() => setCat("all")}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold shrink-0 ${cat === "all" ? "bk-gold" : "bg-gray-100 text-gray-600"}`}>
              الكل
            </button>
            {categories.map(c => (
              <button key={c} onClick={() => setCat(c)}
                className={`px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0 ${cat === c ? "bk-gold" : "bg-gray-100 text-gray-600"}`}>
                {c}
              </button>
            ))}
          </div>
        )}
      </div>

      {isLoading ? (
        <div className="flex justify-center py-16"><Loader2 className="animate-spin bk-text-gold" /></div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-16 text-sm text-gray-500 bg-white rounded-2xl">لا توجد نتائج</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {filtered.map(s => (
            <div key={s.id} className="bg-white rounded-2xl p-3 shadow-sm flex gap-3">
              <div className="size-20 rounded-xl bg-gray-100 overflow-hidden shrink-0">
                {s.images?.[0] ? (
                  <img src={s.images[0]} alt={s.name} loading="lazy" className="size-full object-cover" />
                ) : (
                  <div className="size-full flex items-center justify-center text-gray-300"><Package className="size-6" /></div>
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-bold text-sm bk-text-primary truncate">{s.name}</div>
                {s.category && <div className="text-[11px] text-gray-500 mt-0.5">{s.category}</div>}
                <div className="mt-2 text-sm font-bold bk-text-gold">
                  {showPrices ? `${new Intl.NumberFormat("ar-DZ").format(s.cost || 0)} د.ج` : "للسعر تواصل"}
                </div>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}