import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { getDecorationAvailability, getPublicDecoration, getPublicOwner } from "@/lib/booking-public.functions";
import { ArrowRight, Calendar, CheckCircle2, Loader2, ShoppingBag, XCircle } from "lucide-react";
import { useState } from "react";

export const Route = createFileRoute("/booking/$slug/decorations/$id")({
  component: DecorationDetail,
});

function DecorationDetail() {
  const { slug, id } = useParams({ strict: false }) as { slug: string; id: string };
  const { data: owner } = useQuery({
    queryKey: ["public-owner", slug],
    queryFn: () => getPublicOwner({ data: { slug } }),
    retry: false,
  });
  const { data: dec, isLoading } = useQuery({
    queryKey: ["public-decoration", slug, id],
    queryFn: () => getPublicDecoration({ data: { slug, id } }),
    retry: false,
  });

  const [date, setDate] = useState<string>("");
  const { data: avail, isFetching: checking } = useQuery({
    queryKey: ["public-availability", slug, id, date],
    queryFn: () => getDecorationAvailability({ data: { slug, id, date } }),
    enabled: !!date,
    retry: false,
  });
  const [idx, setIdx] = useState(0);

  if (isLoading) return <div className="flex justify-center py-20"><Loader2 className="animate-spin bk-text-gold" /></div>;
  if (!dec) return <div className="text-center py-16 bg-white rounded-2xl">الديكور غير موجود</div>;

  const images = dec.images?.length ? dec.images : [];
  const showPrices = owner?.show_prices ?? true;

  return (
    <div className="space-y-5">
      <Link to={"/booking/$slug/decorations" as any} params={{ slug } as any}
        className="inline-flex items-center gap-1.5 text-sm bk-text-primary font-bold hover:opacity-70">
        <ArrowRight className="size-4" /> رجوع للديكورات
      </Link>

      <div className="grid lg:grid-cols-2 gap-6">
        <div className="space-y-3">
          <div className="aspect-square bg-white rounded-2xl overflow-hidden shadow-md relative">
            {images[idx] ? (
              <img src={images[idx]} alt={dec.name} className="size-full object-cover" />
            ) : (
              <div className="size-full flex items-center justify-center text-gray-300">لا توجد صورة</div>
            )}
          </div>
          {images.length > 1 && (
            <div className="flex gap-2 overflow-x-auto scrollbar-none">
              {images.map((src, i) => (
                <button key={i} onClick={() => setIdx(i)}
                  className={`size-16 shrink-0 rounded-xl overflow-hidden border-2 transition ${
                    i === idx ? "bk-border-gold" : "border-transparent"
                  }`}>
                  <img src={src} alt="" className="size-full object-cover" />
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4">
          <div>
            {dec.category && (
              <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-gray-100 bk-text-primary">
                {dec.category}
              </span>
            )}
            <h1 className="text-2xl font-bold bk-text-primary mt-2">{dec.name}</h1>
            {showPrices && (
              <div className="text-2xl font-bold bk-text-gold mt-2">
                {new Intl.NumberFormat("ar-DZ").format(dec.price || 0)} د.ج
              </div>
            )}
          </div>

          {dec.description && (
            <p className="text-sm leading-relaxed text-gray-700 whitespace-pre-line bg-white rounded-2xl p-4 shadow-sm">
              {dec.description}
            </p>
          )}

          <div className="bg-white rounded-2xl p-4 shadow-sm space-y-3">
            <div className="font-bold text-sm bk-text-primary flex items-center gap-2">
              <Calendar className="size-4 bk-text-gold" /> تحقق من التوفر
            </div>
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              min={new Date().toISOString().slice(0, 10)}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]"
            />
            {date && (
              <div className="text-sm">
                {checking ? (
                  <div className="flex items-center gap-2 text-gray-500"><Loader2 className="size-4 animate-spin" /> جاري التحقق...</div>
                ) : avail && avail.available > 0 ? (
                  <div className="flex items-center gap-2 text-green-700 font-bold">
                    <CheckCircle2 className="size-4" /> ✅ متوفر — {avail.available} من أصل {avail.total}
                  </div>
                ) : (
                  <div className="flex items-center gap-2 text-red-700 font-bold">
                    <XCircle className="size-4" /> ❌ غير متوفر في هذا التاريخ
                  </div>
                )}
              </div>
            )}
          </div>

          <Link to={"/booking/$slug/request" as any} params={{ slug } as any}
            search={{ decoration: dec.id, date } as any}
            className="bk-gold w-full inline-flex items-center justify-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg hover:opacity-95 transition">
            <ShoppingBag className="size-4" /> طلب حجز
          </Link>
        </div>
      </div>
    </div>
  );
}