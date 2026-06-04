import { createFileRoute, useParams, useSearch } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  getPublicDecorations,
  getPublicOwner,
  getPublicSupplies,
  submitBookingRequest,
} from "@/lib/booking-public.functions";
import { CheckCircle2, Loader2, Minus, Plus, Send, ShoppingBag, Sparkles, Package } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/booking/$slug/request")({
  validateSearch: (s) => ({
    decoration: typeof s.decoration === "string" ? s.decoration : undefined,
    date: typeof s.date === "string" ? s.date : undefined,
  }),
  component: RequestPage,
});

function RequestPage() {
  const { slug } = useParams({ strict: false }) as { slug: string };
  const search = useSearch({ strict: false }) as { decoration?: string; date?: string };

  const { data: owner } = useQuery({
    queryKey: ["public-owner", slug],
    queryFn: () => getPublicOwner({ data: { slug } }),
    retry: false,
  });
  const { data: decorations = [] } = useQuery({
    queryKey: ["public-decorations", slug],
    queryFn: () => getPublicDecorations({ data: { slug } }),
    retry: false,
  });
  const { data: supplies = [] } = useQuery({
    queryKey: ["public-supplies", slug],
    queryFn: () => getPublicSupplies({ data: { slug } }),
    retry: false,
  });

  const [form, setForm] = useState({
    customer_name: "",
    customer_phone: "",
    event_date: search.date || "",
    event_location: "",
    event_type: "wedding",
    notes: "",
  });
  const [decQty, setDecQty] = useState<Record<string, number>>({});
  const [supQty, setSupQty] = useState<Record<string, number>>({});
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);

  // Prefill from URL
  useEffect(() => {
    if (search.decoration) setDecQty(q => ({ ...q, [search.decoration!]: q[search.decoration!] || 1 }));
  }, [search.decoration]);

  const showPrices = owner?.show_prices ?? true;

  const selectedDecorations = useMemo(
    () => Object.entries(decQty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })),
    [decQty],
  );
  const selectedSupplies = useMemo(
    () => Object.entries(supQty).filter(([, q]) => q > 0).map(([id, qty]) => ({ id, qty })),
    [supQty],
  );

  const total = useMemo(() => {
    const d = selectedDecorations.reduce((s, x) => {
      const dec = decorations.find(d => d.id === x.id);
      return s + (dec?.price || 0) * x.qty;
    }, 0);
    const su = selectedSupplies.reduce((s, x) => {
      const sp = supplies.find(d => d.id === x.id);
      return s + (sp?.cost || 0) * x.qty;
    }, 0);
    return d + su;
  }, [selectedDecorations, selectedSupplies, decorations, supplies]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (!form.customer_name.trim()) return toast.error("الاسم مطلوب");
    if (!form.customer_phone.trim()) return toast.error("رقم الهاتف مطلوب");
    if (!form.event_date) return toast.error("التاريخ مطلوب");
    if (selectedDecorations.length === 0 && selectedSupplies.length === 0) {
      return toast.error("اختر ديكور أو مستلزم واحد على الأقل");
    }
    setSubmitting(true);
    try {
      await submitBookingRequest({ data: {
        slug,
        ...form,
        decorations: selectedDecorations,
        supplies: selectedSupplies,
      } as any });
      setDone(true);
    } catch (err: any) {
      toast.error(err.message || "فشل إرسال الطلب");
    } finally {
      setSubmitting(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-md mx-auto bg-white rounded-3xl p-8 shadow-xl text-center mt-8">
        <div className="size-16 mx-auto rounded-2xl bg-green-100 text-green-600 flex items-center justify-center mb-4">
          <CheckCircle2 className="size-8" />
        </div>
        <h1 className="text-xl font-bold bk-text-primary">تم إرسال طلبك بنجاح ✅</h1>
        <p className="text-sm text-gray-600 mt-2">سيتواصل معك صاحب النشاط قريباً لتأكيد الحجز.</p>
      </div>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-5 max-w-3xl mx-auto">
      <header>
        <h1 className="text-2xl font-bold bk-text-primary flex items-center gap-2">
          <ShoppingBag className="size-5 bk-text-gold" /> طلب حجز
        </h1>
        <p className="text-sm text-gray-600 mt-1">املأ البيانات وأرسل الطلب وسيتم التواصل معك</p>
      </header>

      <section className="bg-white rounded-2xl p-5 shadow-sm space-y-3">
        <h2 className="font-bold bk-text-primary text-sm">بياناتك</h2>
        <Field label="الاسم الكامل *">
          <input required value={form.customer_name} onChange={e => setForm({ ...form, customer_name: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]" />
        </Field>
        <Field label="رقم الهاتف *">
          <input required type="tel" value={form.customer_phone} onChange={e => setForm({ ...form, customer_phone: e.target.value })}
            placeholder="0555 12 34 56"
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]" />
        </Field>
        <div className="grid sm:grid-cols-2 gap-3">
          <Field label="تاريخ المناسبة *">
            <input required type="date" min={new Date().toISOString().slice(0, 10)}
              value={form.event_date} onChange={e => setForm({ ...form, event_date: e.target.value })}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]" />
          </Field>
          <Field label="نوع المناسبة">
            <select value={form.event_type} onChange={e => setForm({ ...form, event_type: e.target.value })}
              className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)] bg-white">
              <option value="wedding">عرس</option>
              <option value="engagement">خطوبة</option>
              <option value="birthday">عيد ميلاد</option>
              <option value="other">أخرى</option>
            </select>
          </Field>
        </div>
        <Field label="موقع المناسبة">
          <input value={form.event_location} onChange={e => setForm({ ...form, event_location: e.target.value })}
            placeholder="المدينة، العنوان..."
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)]" />
        </Field>
        <Field label="ملاحظات">
          <textarea rows={3} value={form.notes} onChange={e => setForm({ ...form, notes: e.target.value })}
            className="w-full rounded-xl border border-gray-200 px-4 py-2.5 text-sm outline-none focus:border-[var(--bk-gold)] resize-none" />
        </Field>
      </section>

      {decorations.length > 0 && (
        <Section title="اختر الديكورات" icon={<Sparkles className="size-4 bk-text-gold" />}>
          {decorations.map(d => (
            <PickRow key={d.id}
              image={d.images?.[0]}
              name={d.name}
              meta={d.category || undefined}
              price={showPrices ? d.price : undefined}
              qty={decQty[d.id] || 0}
              onChange={(v) => setDecQty({ ...decQty, [d.id]: v })}
            />
          ))}
        </Section>
      )}

      {supplies.length > 0 && (
        <Section title="اختر المستلزمات" icon={<Package className="size-4 bk-text-gold" />}>
          {supplies.map(s => (
            <PickRow key={s.id}
              image={s.images?.[0]}
              name={s.name}
              meta={s.category || undefined}
              price={showPrices ? s.cost : undefined}
              qty={supQty[s.id] || 0}
              onChange={(v) => setSupQty({ ...supQty, [s.id]: v })}
              maxQty={999}
            />
          ))}
        </Section>
      )}

      <div className="sticky bottom-3 z-20 bg-white rounded-2xl p-4 shadow-2xl border bk-border-gold flex items-center justify-between gap-3">
        <div>
          <div className="text-[11px] text-gray-500">الإجمالي التقريبي</div>
          <div className="text-lg font-bold bk-text-gold">
            {showPrices ? `${new Intl.NumberFormat("ar-DZ").format(total)} د.ج` : "—"}
          </div>
        </div>
        <button type="submit" disabled={submitting}
          className="bk-gold inline-flex items-center gap-2 px-5 py-3 rounded-xl font-bold text-sm shadow-lg disabled:opacity-60">
          {submitting ? <Loader2 className="size-4 animate-spin" /> : <Send className="size-4" />}
          إرسال الطلب
        </button>
      </div>
    </form>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-bold bk-text-primary mb-1.5">{label}</label>
      {children}
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="bg-white rounded-2xl p-4 shadow-sm">
      <h2 className="font-bold bk-text-primary text-sm flex items-center gap-2 mb-3">{icon} {title}</h2>
      <div className="space-y-2 max-h-96 overflow-y-auto pr-1">
        {children}
      </div>
    </section>
  );
}

function PickRow({ image, name, meta, price, qty, onChange, maxQty = 99 }: {
  image?: string; name: string; meta?: string; price?: number;
  qty: number; onChange: (v: number) => void; maxQty?: number;
}) {
  return (
    <div className={`flex items-center gap-3 p-2 rounded-xl border ${qty > 0 ? "bk-border-gold bg-yellow-50/30" : "border-gray-100"}`}>
      <div className="size-12 rounded-lg bg-gray-100 overflow-hidden shrink-0">
        {image ? <img src={image} alt="" loading="lazy" className="size-full object-cover" /> : null}
      </div>
      <div className="flex-1 min-w-0">
        <div className="font-bold text-sm truncate bk-text-primary">{name}</div>
        <div className="flex items-center gap-2 mt-0.5">
          {meta && <span className="text-[10px] text-gray-500">{meta}</span>}
          {price !== undefined && (
            <span className="text-[11px] font-bold bk-text-gold">{new Intl.NumberFormat("ar-DZ").format(price)} د.ج</span>
          )}
        </div>
      </div>
      <div className="flex items-center gap-1 shrink-0">
        <button type="button" onClick={() => onChange(Math.max(0, qty - 1))}
          className="size-8 rounded-lg bg-gray-100 flex items-center justify-center disabled:opacity-40"
          disabled={qty === 0}>
          <Minus className="size-3.5" />
        </button>
        <span className="w-8 text-center text-sm font-bold">{qty}</span>
        <button type="button" onClick={() => onChange(Math.min(maxQty, qty + 1))}
          className="size-8 rounded-lg bk-gold flex items-center justify-center">
          <Plus className="size-3.5" />
        </button>
      </div>
    </div>
  );
}