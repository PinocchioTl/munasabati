import { createFileRoute, Link } from "@tanstack/react-router";
import { Card, SectionHeader, Button, LoadingState, EmptyState, StatusBadge } from "@/components/ui-bits";
import {
  useClients, useBookings, useUpsertClient, useDeleteClient,
  formatSAR, eventTypeLabels, classifyClient, tierLabels, VIP_THRESHOLDS,
  type Client, type ClientTier,
} from "@/lib/db";
import {
  Phone, MapPin, Crown, Plus, MessageCircle, X, Calendar,
  Edit3, Trash2, TrendingUp, Wallet, Sparkles, UserPlus,
} from "lucide-react";
import { useState, useMemo, useEffect } from "react";
import { toast } from "sonner";
import { SearchBox } from "@/components/SearchBox";
import { matches } from "@/lib/search";

export const Route = createFileRoute("/_main/customers")({
  component: CustomersPage,
});

type FilterId = "all" | "vip" | "active" | "new" | "inactive" | "top_spend" | "top_count";

const tierStyles: Record<ClientTier, { dot: string; pill: string; ring: string }> = {
  vip: { dot: "bg-gold", pill: "bg-gradient-gold text-primary", ring: "ring-gold/40" },
  active: { dot: "bg-emerald-500", pill: "bg-emerald-500/15 text-emerald-600", ring: "ring-emerald-500/30" },
  new: { dot: "bg-blue-500", pill: "bg-blue-500/15 text-blue-600", ring: "ring-blue-500/30" },
  inactive: { dot: "bg-muted-foreground", pill: "bg-muted text-muted-foreground", ring: "ring-border" },
};

function CustomersPage() {
  const { data: customers = [], isLoading } = useClients();
  const { data: bookings = [] } = useBookings();
  const upsert = useUpsertClient();
  const del = useDeleteClient();

  const [query, setQuery] = useState("");
  const [filter, setFilter] = useState<FilterId>("all");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [editing, setEditing] = useState<Client | null>(null);
  const [showNew, setShowNew] = useState(false);

  // Auto-promote to VIP when thresholds crossed
  useEffect(() => {
    customers.forEach(c => {
      if (!c.is_vip && (c.events_count >= VIP_THRESHOLDS.events || +c.total_paid >= VIP_THRESHOLDS.paid)) {
        upsert.mutate({ id: c.id, name: c.name, phone: c.phone || "", address: c.address || "", notes: c.notes || "", is_vip: true });
      }
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers.length]);

  const enriched = useMemo(() => customers.map(c => ({ ...c, tier: classifyClient(c) })), [customers]);

  const filtered = useMemo(() => {
    let list = enriched.filter(c => {
      if (!matches(query, [c.name, c.phone, c.email, c.address, c.notes])) return false;
      if (filter === "vip" && c.tier !== "vip") return false;
      if (filter === "active" && c.tier !== "active") return false;
      if (filter === "new" && c.tier !== "new") return false;
      if (filter === "inactive" && c.tier !== "inactive") return false;
      return true;
    });
    if (filter === "top_spend") list = [...list].sort((a, b) => +b.total_paid - +a.total_paid);
    else if (filter === "top_count") list = [...list].sort((a, b) => b.events_count - a.events_count);
    return list;
  }, [enriched, query, filter]);

  const selected = selectedId ? enriched.find(c => c.id === selectedId) : null;
  const selectedBookings = selected ? bookings.filter(b => b.client_id === selected.id) : [];

  const counts = useMemo(() => ({
    all: enriched.length,
    vip: enriched.filter(c => c.tier === "vip").length,
    active: enriched.filter(c => c.tier === "active").length,
    new: enriched.filter(c => c.tier === "new").length,
    inactive: enriched.filter(c => c.tier === "inactive").length,
  }), [enriched]);

  const tabs: { id: FilterId; l: string; n?: number }[] = [
    { id: "all", l: "الكل", n: counts.all },
    { id: "vip", l: "VIP", n: counts.vip },
    { id: "active", l: "نشط", n: counts.active },
    { id: "new", l: "جديد", n: counts.new },
    { id: "inactive", l: "غير نشط", n: counts.inactive },
    { id: "top_spend", l: "الأكثر إنفاقاً" },
    { id: "top_count", l: "الأكثر حجزاً" },
  ];

  return (
    <div className="space-y-6 animate-slide-up" dir="rtl">
      <SectionHeader
        title="الزبائن"
        subtitle={`${counts.all} زبون — ${counts.vip} VIP • ${counts.active} نشط • ${counts.new} جديد`}
        action={
          <Button variant="gold" onClick={() => setShowNew(true)}>
            <UserPlus className="size-4" />زبون جديد
          </Button>
        }
      />

      <Card className="p-4 flex flex-col lg:flex-row gap-3 sticky top-14 sm:top-16 z-20 bg-card/95 backdrop-blur">
        <SearchBox value={query} onChange={setQuery} className="flex-1"
          placeholder="ابحث بالاسم، الهاتف، البريد الإلكتروني..." />
        <div className="flex gap-1.5 flex-wrap">
          {tabs.map(t => (
            <button key={t.id} onClick={() => setFilter(t.id)}
              className={`px-3 py-2 rounded-xl text-xs font-semibold transition flex items-center gap-2 ${
                filter === t.id ? "bg-primary text-primary-foreground shadow-elegant" : "bg-secondary hover:bg-secondary/70"
              }`}>
              {t.l}
              {t.n !== undefined && (
                <span className={`text-[10px] px-1.5 py-0.5 rounded-full ${filter === t.id ? "bg-primary-foreground/20" : "bg-card"}`}>{t.n}</span>
              )}
            </button>
          ))}
        </div>
      </Card>

      {isLoading ? <LoadingState rows={3} /> : filtered.length === 0 ? (
        <EmptyState title="لا يوجد زبائن مطابقون" description="جرّب تغيير الفلتر أو ابدأ بإضافة زبون"
          action={<Button variant="gold" onClick={() => setShowNew(true)}><Plus className="size-4" />إضافة زبون</Button>} />
      ) : (
        <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map(c => {
            const style = tierStyles[c.tier];
            return (
              <Card key={c.id} className={`p-5 hover:shadow-luxury transition relative overflow-hidden cursor-pointer ring-1 ${style.ring}`}>
                <div className={`absolute top-0 left-0 text-[10px] font-bold px-3 py-1 rounded-br-2xl flex items-center gap-1 ${style.pill}`}>
                  {c.tier === "vip" ? <><Crown className="size-3" /> VIP</> : <><span className={`size-1.5 rounded-full ${style.dot}`} /> {tierLabels[c.tier]}</>}
                </div>

                <div className="flex items-center gap-3 mt-4" onClick={() => setSelectedId(c.id)}>
                  <div className={`size-14 rounded-2xl flex items-center justify-center font-bold text-lg ${c.tier === "vip" ? "bg-gradient-gold text-primary" : "bg-gradient-luxury text-gold"}`}>
                    {c.name.charAt(0)}
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="font-bold truncate flex items-center gap-1.5">
                      {c.name}
                      {c.tier === "vip" && <Crown className="size-3.5 text-gold" />}
                    </div>
                    <div className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                      <Phone className="size-3" /> {c.phone || "—"}
                    </div>
                  </div>
                </div>

                {c.address && (
                  <div className="mt-3 text-xs text-muted-foreground flex items-center gap-1 truncate">
                    <MapPin className="size-3 shrink-0" /> {c.address}
                  </div>
                )}

                <div className="grid grid-cols-3 gap-2 mt-4">
                  <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
                    <div className="text-lg font-bold">{c.events_count}</div>
                    <div className="text-[10px] text-muted-foreground">مناسبة</div>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
                    <div className="text-sm font-bold text-gold">{formatSAR(+c.total_paid)}</div>
                    <div className="text-[10px] text-muted-foreground">إجمالي</div>
                  </div>
                  <div className="bg-secondary/50 rounded-xl p-2.5 text-center">
                    <div className="text-[11px] font-semibold truncate">{c.last_event_date || "—"}</div>
                    <div className="text-[10px] text-muted-foreground">آخر مناسبة</div>
                  </div>
                </div>

                <div className="flex gap-2 mt-4">
                  <a href={`tel:${c.phone}`} className="flex-1" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="w-full"><Phone className="size-3.5" />اتصال</Button>
                  </a>
                  <a href={`https://wa.me/${c.phone?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer" className="flex-1" onClick={e => e.stopPropagation()}>
                    <Button variant="outline" size="sm" className="w-full"><MessageCircle className="size-3.5" />واتساب</Button>
                  </a>
                </div>
              </Card>
            );
          })}
        </div>
      )}

      {selected && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4 animate-fade-in" onClick={() => setSelectedId(null)}>
          <div onClick={(e) => e.stopPropagation()} className="max-w-3xl w-full max-h-[88vh] overflow-y-auto animate-scale-in">
            <Card className="p-6">
              <div className="flex items-start justify-between mb-5">
                <div className="flex items-center gap-3">
                  <div className={`size-16 rounded-2xl flex items-center justify-center font-bold text-2xl ${selected.tier === "vip" ? "bg-gradient-gold text-primary" : "bg-gradient-luxury text-gold"}`}>
                    {selected.name.charAt(0)}
                  </div>
                  <div>
                    <div className="font-bold text-xl flex items-center gap-2">
                      {selected.name}
                      {selected.tier === "vip" && <Crown className="size-4 text-gold" />}
                    </div>
                    <div className="text-sm text-muted-foreground">{selected.phone || "—"}</div>
                    <div className={`inline-flex mt-1 text-[10px] font-bold px-2 py-0.5 rounded-full ${tierStyles[selected.tier].pill}`}>
                      {tierLabels[selected.tier]}
                    </div>
                  </div>
                </div>
                <button onClick={() => setSelectedId(null)} className="p-2 hover:bg-secondary rounded-lg"><X className="size-5" /></button>
              </div>

              {/* Quick actions */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mb-5">
                <a href={`tel:${selected.phone}`}><Button variant="outline" size="sm" className="w-full"><Phone className="size-3.5" />اتصال</Button></a>
                <a href={`https://wa.me/${selected.phone?.replace(/\D/g, "")}`} target="_blank" rel="noreferrer">
                  <Button variant="outline" size="sm" className="w-full"><MessageCircle className="size-3.5" />رسالة</Button>
                </a>
                <Link to="/bookings"><Button variant="primary" size="sm" className="w-full"><Plus className="size-3.5" />حجز جديد</Button></Link>
                <Button variant="outline" size="sm" onClick={() => setEditing(selected)}><Edit3 className="size-3.5" />تعديل</Button>
              </div>

              {/* Basic info */}
              <div className="bg-secondary/30 rounded-xl p-4 mb-5 grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
                <div><span className="text-muted-foreground">الاسم: </span><span className="font-semibold">{selected.name}</span></div>
                <div><span className="text-muted-foreground">الهاتف: </span><span className="font-semibold">{selected.phone || "—"}</span></div>
                <div className="md:col-span-2"><span className="text-muted-foreground">العنوان: </span><span className="font-semibold">{selected.address || "—"}</span></div>
                {selected.notes && <div className="md:col-span-2"><span className="text-muted-foreground">ملاحظات: </span>{selected.notes}</div>}
              </div>

              {/* Financial analysis */}
              <div className="grid grid-cols-3 gap-3 mb-6">
                <div className="bg-gradient-luxury rounded-xl p-3 text-center">
                  <Calendar className="size-4 mx-auto mb-1 text-gold" />
                  <div className="text-2xl font-bold">{selected.events_count}</div>
                  <div className="text-[10px] text-muted-foreground">عدد الحجوزات</div>
                </div>
                <div className="bg-gradient-luxury rounded-xl p-3 text-center">
                  <Wallet className="size-4 mx-auto mb-1 text-gold" />
                  <div className="text-lg font-bold text-gold">{formatSAR(+selected.total_paid)}</div>
                  <div className="text-[10px] text-muted-foreground">إجمالي المدفوع</div>
                </div>
                <div className="bg-gradient-luxury rounded-xl p-3 text-center">
                  <TrendingUp className="size-4 mx-auto mb-1 text-gold" />
                  <div className="text-sm font-bold">{formatSAR(selected.events_count ? +selected.total_paid / selected.events_count : 0)}</div>
                  <div className="text-[10px] text-muted-foreground">متوسط الحجز</div>
                </div>
              </div>

              {/* Booking history */}
              <div className="font-bold mb-3 flex items-center gap-2"><Calendar className="size-4" /> سجل الحجوزات ({selectedBookings.length})</div>
              {selectedBookings.length === 0 ? (
                <div className="text-sm text-muted-foreground text-center py-8 bg-secondary/30 rounded-xl">لا توجد حجوزات سابقة</div>
              ) : (
                <div className="space-y-2 mb-5">
                  {selectedBookings.map(b => (
                    <div key={b.id} className="bg-secondary/40 rounded-xl p-3">
                      <div className="flex items-center justify-between gap-3 mb-1.5">
                        <div className="font-semibold text-sm flex items-center gap-2">
                          <Sparkles className="size-3.5 text-gold" />
                          {eventTypeLabels[b.event_type] || b.event_type}
                          {b.code && <span className="text-[10px] text-muted-foreground">#{b.code}</span>}
                        </div>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-bold text-gold">{formatSAR(+b.total_price)}</span>
                          <StatusBadge status={b.status} />
                        </div>
                      </div>
                      <div className="text-[11px] text-muted-foreground flex flex-wrap gap-x-3">
                        <span>{b.event_date} • {b.start_time?.slice(0, 5)}</span>
                        {(b.booking_decorations?.length ?? 0) > 0 && (
                          <span>الديكورات: {b.booking_decorations!.map(bd => bd.decoration?.name).filter(Boolean).join("، ")}</span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              <div className="flex justify-between pt-3 border-t">
                <Button variant="outline" size="sm" onClick={() => {
                  if (!confirm("حذف هذا الزبون؟")) return;
                  del.mutate(selected.id, {
                    onSuccess: () => { toast.success("تم الحذف"); setSelectedId(null); },
                    onError: (e: any) => toast.error(e.message),
                  });
                }}>
                  <Trash2 className="size-3.5" />حذف
                </Button>
                <Button variant="primary" size="sm" onClick={() => setSelectedId(null)}>إغلاق</Button>
              </div>
            </Card>
          </div>
        </div>
      )}

      {(showNew || editing) && (
        <ClientDialog
          client={editing}
          onClose={() => { setShowNew(false); setEditing(null); }}
          onSubmit={(input) => {
            upsert.mutate(input, {
              onSuccess: () => {
                toast.success(editing ? "تم التحديث" : "تم إنشاء الزبون");
                setShowNew(false); setEditing(null);
              },
              onError: (e: any) => toast.error(e.message),
            });
          }}
          loading={upsert.isPending}
        />
      )}
    </div>
  );
}

function ClientDialog({
  client, onClose, onSubmit, loading,
}: {
  client: Client | null;
  onClose: () => void;
  onSubmit: (i: { id?: string; name: string; phone: string; address: string; notes: string; is_vip: boolean }) => void;
  loading: boolean;
}) {
  const [name, setName] = useState(client?.name || "");
  const [phone, setPhone] = useState(client?.phone || "");
  const [address, setAddress] = useState(client?.address || "");
  const [notes, setNotes] = useState(client?.notes || "");
  const [isVip, setIsVip] = useState(client?.is_vip || false);

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4 animate-fade-in" onClick={onClose} dir="rtl">
      <div onClick={(e) => e.stopPropagation()} className="max-w-md w-full animate-scale-in">
        <Card className="p-6">
          <div className="flex items-center justify-between mb-4">
            <div className="font-bold text-lg">{client ? "تعديل الزبون" : "زبون جديد"}</div>
            <button onClick={onClose} className="p-2 hover:bg-secondary rounded-lg"><X className="size-5" /></button>
          </div>
          <div className="space-y-3">
            <Field label="الاسم الكامل *"><input value={name} onChange={e => setName(e.target.value)} className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="مثال: أحمد بن علي" /></Field>
            <Field label="رقم الهاتف"><input value={phone} onChange={e => setPhone(e.target.value)} className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="0555..." /></Field>
            <Field label="العنوان"><input value={address} onChange={e => setAddress(e.target.value)} className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring" placeholder="المدينة، الحي..." /></Field>
            <Field label="ملاحظات"><textarea value={notes} onChange={e => setNotes(e.target.value)} className="w-full bg-secondary/60 rounded-xl px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring min-h-[70px]" /></Field>
            <label className="flex items-center gap-2 cursor-pointer bg-gradient-luxury rounded-xl p-3">
              <input type="checkbox" checked={isVip} onChange={e => setIsVip(e.target.checked)} className="size-4" />
              <Crown className="size-4 text-gold" />
              <span className="text-sm font-semibold">تمييز كعميل VIP</span>
            </label>
          </div>
          <div className="flex gap-2 mt-5">
            <Button variant="outline" className="flex-1" onClick={onClose}>إلغاء</Button>
            <Button
              variant="gold"
              className="flex-1"
              loading={loading}
              onClick={() => onSubmit({ id: client?.id, name, phone, address, notes, is_vip: isVip })}
            >
              {client ? "حفظ" : "إنشاء"}
            </Button>
          </div>
        </Card>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <div className="text-xs font-semibold mb-1 text-muted-foreground">{label}</div>
      {children}
    </div>
  );
}
