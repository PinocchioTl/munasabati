import { useState, useRef, useEffect } from "react";
import { Card, Button } from "@/components/ui-bits";
import { Palette, Upload, Building2, Loader2, Crown, Check, ImageIcon } from "lucide-react";
import { toast } from "sonner";
import { useBranding } from "@/lib/branding";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/lib/auth";

export function BrandingSettings() {
  const { branding, save } = useBranding();
  const { user } = useAuth();
  const fileRef = useRef<HTMLInputElement>(null);

  const [companyName, setCompanyName] = useState(branding.companyName);
  const [logoUrl, setLogoUrl] = useState<string | null>(branding.logoUrl);
  const [primary, setPrimary] = useState(branding.primaryColor);
  const [secondary, setSecondary] = useState(branding.secondaryColor);
  const [accent, setAccent] = useState(branding.accentColor);
  const [bg, setBg] = useState(branding.backgroundColor);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setCompanyName(branding.companyName);
    setLogoUrl(branding.logoUrl);
    setPrimary(branding.primaryColor);
    setSecondary(branding.secondaryColor);
    setAccent(branding.accentColor);
    setBg(branding.backgroundColor);
  }, [branding]);

  const handleLogoUpload = async (file: File) => {
    if (!user) return;
    if (file.size > 2 * 1024 * 1024) {
      toast.error("حجم الصورة كبير جداً (الحد الأقصى 2MB)");
      return;
    }
    setUploading(true);
    try {
      const ext = file.name.split(".").pop() || "png";
      const path = `${user.id}/logo-${Date.now()}.${ext}`;
      const { error } = await supabase.storage.from("branding").upload(path, file, { upsert: true });
      if (error) throw error;
      const { data } = supabase.storage.from("branding").getPublicUrl(path);
      setLogoUrl(data.publicUrl);
      toast.success("تم رفع الشعار");
    } catch (e: any) {
      toast.error(e.message || "فشل رفع الشعار");
    } finally {
      setUploading(false);
    }
  };

  const handleSave = async () => {
    if (!companyName.trim()) {
      toast.error("اسم الشركة مطلوب");
      return;
    }
    setSaving(true);
    try {
      await save({
        companyName: companyName.trim(),
        logoUrl,
        primaryColor: primary,
        secondaryColor: secondary,
        accentColor: accent,
        backgroundColor: bg,
      });
      toast.success("تم حفظ الهوية البصرية");
    } catch (e: any) {
      toast.error(e.message || "فشل الحفظ");
    } finally {
      setSaving(false);
    }
  };

  return (
    <Card className="p-6 lg:p-8 space-y-6">
      <div className="flex items-center gap-4 pb-5 border-b border-border/60">
        <div className="size-12 rounded-2xl bg-gradient-gold text-primary flex items-center justify-center shadow-gold">
          <Palette />
        </div>
        <div>
          <div className="text-xl font-bold">إعدادات الهوية</div>
          <div className="text-sm text-muted-foreground">خصص شعار شركتك واسمها وألوانها</div>
        </div>
      </div>

      {/* Company name */}
      <div>
        <label className="text-sm font-bold flex items-center gap-2 mb-2">
          <Building2 className="size-4" /> اسم الشركة
        </label>
        <input
          value={companyName}
          onChange={(e) => setCompanyName(e.target.value)}
          placeholder="مثال: Royal Events"
          className="w-full bg-secondary/60 rounded-xl px-4 py-3 text-sm outline-none focus:ring-2 focus:ring-ring"
        />
        <p className="text-xs text-muted-foreground mt-1.5">يظهر في الشريط العلوي وعنوان التطبيق</p>
      </div>

      {/* Logo */}
      <div>
        <label className="text-sm font-bold flex items-center gap-2 mb-2">
          <ImageIcon className="size-4" /> شعار الشركة
        </label>
        <div className="flex items-center gap-4">
          <div className="size-20 rounded-2xl bg-secondary/60 border border-border flex items-center justify-center overflow-hidden shrink-0">
            {logoUrl ? (
              <img src={logoUrl} alt="logo" className="size-full object-contain" />
            ) : (
              <Crown className="size-8 text-muted-foreground" />
            )}
          </div>
          <div className="flex-1 space-y-2">
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(e) => e.target.files?.[0] && handleLogoUpload(e.target.files[0])}
            />
            <Button variant="outline" size="sm" onClick={() => fileRef.current?.click()} disabled={uploading}>
              {uploading ? <Loader2 className="size-4 animate-spin" /> : <Upload className="size-4" />}
              {logoUrl ? "تغيير الشعار" : "رفع الشعار"}
            </Button>
            {logoUrl && (
              <button onClick={() => setLogoUrl(null)} className="block text-xs text-destructive hover:underline">
                إزالة الشعار
              </button>
            )}
            <p className="text-xs text-muted-foreground">PNG / JPG / SVG — حد أقصى 2MB</p>
          </div>
        </div>
      </div>

      {/* Colors */}
      <div className="grid sm:grid-cols-2 gap-4">
        <ColorField label="اللون الأساسي" hint="الأزرار والعناصر الفاخرة" value={primary} onChange={setPrimary} />
        <ColorField label="اللون الثانوي" hint="الشريط الجانبي والعنوان" value={secondary} onChange={setSecondary} />
        <ColorField label="لون التمييز" hint="الروابط والإشعارات" value={accent} onChange={setAccent} />
        <ColorField label="لون الخلفية" hint="خلفية الصفحات" value={bg} onChange={setBg} />
      </div>

      {/* Live preview */}
      <div>
        <div className="text-sm font-bold mb-2">معاينة مباشرة</div>
        <div className="rounded-2xl p-5 border border-border" style={{ background: bg }}>
          <div className="flex items-center gap-3 mb-4">
            <div className="size-10 rounded-xl flex items-center justify-center overflow-hidden" style={{ background: primary }}>
              {logoUrl ? (
                <img src={logoUrl} alt="" className="size-full object-contain" />
              ) : (
                <Crown className="size-5" style={{ color: secondary }} />
              )}
            </div>
            <div>
              <div className="font-bold" style={{ color: secondary }}>{companyName || "اسم الشركة"}</div>
              <div className="text-xs" style={{ color: secondary, opacity: 0.6 }}>مناسبتي — نظم ديكوراتك بسهولة</div>
            </div>
          </div>
          <div className="flex gap-2">
            <button className="px-4 py-2 rounded-xl text-sm font-bold" style={{ background: primary, color: secondary }}>
              زر أساسي
            </button>
            <button className="px-4 py-2 rounded-xl text-sm font-bold text-white" style={{ background: accent }}>
              زر التمييز
            </button>
            <span className="px-3 py-2 rounded-xl text-xs font-bold border" style={{ borderColor: primary, color: primary }}>
              شارة
            </span>
          </div>
        </div>
      </div>

      <div className="pt-4 border-t border-border/60 flex justify-end">
        <Button variant="gold" onClick={handleSave} disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Check className="size-4" />}
          حفظ الهوية
        </Button>
      </div>
    </Card>
  );
}

function ColorField({ label, hint, value, onChange }: { label: string; hint: string; value: string; onChange: (v: string) => void }) {
  return (
    <div>
      <label className="text-xs font-bold block mb-1.5">{label}</label>
      <div className="flex items-center gap-2 bg-secondary/60 rounded-xl p-2">
        <input
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="size-10 rounded-lg cursor-pointer border-0 bg-transparent"
        />
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="flex-1 bg-transparent text-sm font-mono outline-none uppercase"
        />
      </div>
      <p className="text-[10px] text-muted-foreground mt-1">{hint}</p>
    </div>
  );
}
