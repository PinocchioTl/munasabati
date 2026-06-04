import { useEffect, useRef, useState } from "react";
import { Card, Button } from "@/components/ui-bits";
import { Link2, Upload, Loader2, Check, Copy, ImageIcon, Globe } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function BookingPlatformSettings() {
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [slug, setSlug] = useState("");
  const [cover, setCover] = useState<string | null>(null);
  const [tagline, setTagline] = useState("");
  const [description, setDescription] = useState("");
  const [bookingEnabled, setBookingEnabled] = useState(true);
  const [showPrices, setShowPrices] = useState(true);

  useEffect(() => {
    if (!user) return;
    supabase.from("profiles")
      .select("public_slug, cover_url, tagline, description, booking_enabled, show_prices")
      .eq("id", user.id).maybeSingle()
      .then(({ data }) => {
        if (data) {
          setSlug(data.public_slug || "");
          setCover(data.cover_url || null);
          setTagline(data.tagline || "");
          setDescription(data.description || "");
          setBookingEnabled(data.booking_enabled ?? true);
          setShowPrices(data.show_prices ?? true);
        }
        setLoading(false);
      });
  }, [user]);

  async function uploadCover(file: File) {
    if (!user) return;
    if (file.size > 4 * 1024 * 1024) return toast.error("الحجم الأقصى 4MB");
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "jpg";
      const path = `${user.id}/cover-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setCover(data.publicUrl);
      toast.success("تم رفع الصورة");
    } catch (e: any) { toast.error(e.message); } finally { setUploading(false); }
  }

  async function save() {
    if (!user) return;
    const cleanSlug = slug.trim().toLowerCase();
    if (cleanSlug && !/^[a-z0-9][a-z0-9-]{2,39}$/.test(cleanSlug)) {
      return toast.error("الرابط يجب أن يكون 3-40 حرفاً (أحرف صغيرة، أرقام، شرطة)");
    }
    setSaving(true);
    const { error } = await supabase.from("profiles").update({
      public_slug: cleanSlug || null,
      cover_url: cover,
      tagline: tagline.trim() || null,
      description: description.trim() || null,
      booking_enabled: bookingEnabled,
      show_prices: showPrices,
    }).eq("id", user.id);
    setSaving(false);
    if (error) {
      if (error.code === "23505") return toast.error("هذا الرابط مستخدم — اختر رابطاً آخر");
      return toast.error(error.message);
    }
    toast.success("تم حفظ إعدادات الحجز");
  }

  const url = slug ? `${typeof window !== "undefined" ? window.location.origin : ""}/booking/${slug}` : "";

  if (loading) return <Card className="p-8 text-center"><Loader2 className="size-6 animate-spin mx-auto" /></Card>;

  return (
    <Card className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-border/60">
        <div className="size-12 rounded-2xl bg-gradient-gold text-primary flex items-center justify-center shadow-gold">
          <Globe />
        </div>
        <div>
          <div className="text-xl font-bold">إعدادات منصة الحجز</div>
          <div className="text-sm text-muted-foreground">صفحة الحجز العامة لعملائك (Munasabati Booking)</div>
        </div>
      </div>

      <div>
        <label className="text-sm font-bold flex items-center gap-2 mb-2"><Link2 className="size-4" /> رابط الحجز الخاص بك</label>
        <div className="flex items-stretch gap-2">
          <div className="flex-1 flex items-center bg-secondary/60 rounded-xl px-3 text-sm text-muted-foreground">
            /booking/
          </div>
          <input
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="yasser-events"
            className="flex-[2] bg-secondary/60 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </div>
        {url && (
          <button
            type="button"
            onClick={() => { navigator.clipboard.writeText(url); toast.success("تم نسخ الرابط"); }}
            className="mt-2 inline-flex items-center gap-1.5 text-xs text-info hover:underline"
          >
            <Copy className="size-3" /> {url}
          </button>
        )}
        <p className="text-[11px] text-muted-foreground mt-1.5">3-40 حرفاً، أحرف لاتينية صغيرة، أرقام أو شرطة فقط</p>
      </div>

      <div>
        <label className="text-sm font-bold flex items-center gap-2 mb-2"><ImageIcon className="size-4" /> صورة الغلاف</label>
        <div className="flex items-center gap-4">
          <div className="w-40 aspect-video rounded-xl bg-secondary/60 border border-border overflow-hidden shrink-0">
            {cover ? <img src={cover} className="size-full object-cover" alt="" /> : null}
          </div>
          <div className="flex-1 space-y-2">
            <input ref={fileRef} type="file" accept="image/*" className="hidden"
              onChange={(e) => e.target.files?.[0] && uploadCover(e.target.files[0])} />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {cover ? "تغيير الغلاف" : "رفع الغلاف"}
            </Button>
            {cover && <button onClick={() => setCover(null)} className="block text-xs text-destructive">إزالة</button>}
          </div>
        </div>
      </div>

      <div>
        <label className="text-sm font-bold block mb-2">شعار قصير (Tagline)</label>
        <input value={tagline} onChange={(e) => setTagline(e.target.value)}
          placeholder="نظم مناسبتك مع الفخامة"
          className="w-full bg-secondary/60 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring" />
      </div>

      <div>
        <label className="text-sm font-bold block mb-2">نبذة / من نحن</label>
        <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={4}
          placeholder="اكتب وصفاً مختصراً عن نشاطك..."
          className="w-full bg-secondary/60 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring resize-none" />
      </div>

      <div className="space-y-3 pt-2 border-t border-border/60">
        <ToggleRow label="تفعيل صفحة الحجز" desc="عند الإيقاف، صفحة الحجز تصبح غير متاحة للعملاء"
          value={bookingEnabled} onChange={setBookingEnabled} />
        <ToggleRow label="إظهار الأسعار" desc="عرض أسعار الديكورات والمستلزمات في صفحة الحجز"
          value={showPrices} onChange={setShowPrices} />
      </div>

      <div className="pt-4 border-t border-border/60 flex justify-end">
        <Button variant="gold" onClick={save} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          حفظ الإعدادات
        </Button>
      </div>
    </Card>
  );
}

function ToggleRow({ label, desc, value, onChange }: { label: string; desc: string; value: boolean; onChange: (v: boolean) => void }) {
  return (
    <div className="flex items-center gap-3 py-2">
      <div className="flex-1">
        <div className="font-bold text-sm">{label}</div>
        <div className="text-xs text-muted-foreground mt-0.5">{desc}</div>
      </div>
      <button onClick={() => onChange(!value)}
        className={`relative w-12 h-7 rounded-full transition-colors duration-300 ${value ? "bg-gradient-gold shadow-gold" : "bg-secondary"}`}>
        <span className={`absolute top-0.5 size-6 rounded-full bg-white shadow-md transition-all duration-300 ${value ? "right-0.5" : "right-[1.375rem]"}`} />
      </button>
    </div>
  );
}