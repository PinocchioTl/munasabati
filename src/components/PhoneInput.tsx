import { Phone, ChevronDown, Check, Search } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";

type Country = {
  code: string;
  flag: string;
  name: string;
  iso: string;
  minLen: number;
  maxLen: number;
};

const COUNTRIES: Country[] = [
  { code: "+213", flag: "🇩🇿", name: "الجزائر", iso: "DZ", minLen: 9, maxLen: 10 },
  { code: "+212", flag: "🇲🇦", name: "المغرب", iso: "MA", minLen: 9, maxLen: 10 },
  { code: "+216", flag: "🇹🇳", name: "تونس", iso: "TN", minLen: 8, maxLen: 8 },
  { code: "+966", flag: "🇸🇦", name: "السعودية", iso: "SA", minLen: 9, maxLen: 9 },
  { code: "+971", flag: "🇦🇪", name: "الإمارات", iso: "AE", minLen: 9, maxLen: 9 },
  { code: "+974", flag: "🇶🇦", name: "قطر", iso: "QA", minLen: 8, maxLen: 8 },
  { code: "+965", flag: "🇰🇼", name: "الكويت", iso: "KW", minLen: 8, maxLen: 8 },
  { code: "+973", flag: "🇧🇭", name: "البحرين", iso: "BH", minLen: 8, maxLen: 8 },
  { code: "+968", flag: "🇴🇲", name: "عُمان", iso: "OM", minLen: 8, maxLen: 8 },
  { code: "+20",  flag: "🇪🇬", name: "مصر", iso: "EG", minLen: 10, maxLen: 10 },
  { code: "+962", flag: "🇯🇴", name: "الأردن", iso: "JO", minLen: 9, maxLen: 9 },
  { code: "+961", flag: "🇱🇧", name: "لبنان", iso: "LB", minLen: 7, maxLen: 8 },
  { code: "+964", flag: "🇮🇶", name: "العراق", iso: "IQ", minLen: 10, maxLen: 10 },
  { code: "+218", flag: "🇱🇾", name: "ليبيا", iso: "LY", minLen: 9, maxLen: 10 },
  { code: "+90",  flag: "🇹🇷", name: "تركيا", iso: "TR", minLen: 10, maxLen: 10 },
  { code: "+33",  flag: "🇫🇷", name: "فرنسا", iso: "FR", minLen: 9, maxLen: 9 },
  { code: "+44",  flag: "🇬🇧", name: "المملكة المتحدة", iso: "GB", minLen: 10, maxLen: 10 },
  { code: "+1",   flag: "🇺🇸", name: "أمريكا/كندا", iso: "US", minLen: 10, maxLen: 10 },
];

function formatPhone(digits: string): string {
  // group every 3 digits with a space for readability
  return digits.replace(/(\d{3})(?=\d)/g, "$1 ").trim();
}

export function PhoneInput({
  countryCode, onCountryCodeChange, phone, onPhoneChange, disabled,
}: {
  countryCode: string;
  onCountryCodeChange: (v: string) => void;
  phone: string;
  onPhoneChange: (v: string) => void;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [touched, setTouched] = useState(false);
  const [focused, setFocused] = useState(false);
  const containerRef = useRef<HTMLDivElement>(null);

  const selected = useMemo(
    () => COUNTRIES.find((c) => c.code === countryCode) || COUNTRIES[0],
    [countryCode],
  );

  const digits = phone.replace(/\D/g, "");
  const tooShort = digits.length > 0 && digits.length < selected.minLen;
  const tooLong = digits.length > selected.maxLen;
  const error = tooShort
    ? `الرقم قصير — يجب أن يكون ${selected.minLen} أرقام على الأقل`
    : tooLong
    ? `الرقم طويل — الحد الأقصى ${selected.maxLen} أرقام`
    : "";
  const showError = touched && !!error;
  const isValid = digits.length >= selected.minLen && digits.length <= selected.maxLen;

  useEffect(() => {
    function onDoc(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  const filtered = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return COUNTRIES;
    return COUNTRIES.filter(
      (c) =>
        c.name.toLowerCase().includes(term) ||
        c.code.includes(term) ||
        c.iso.toLowerCase().includes(term),
    );
  }, [search]);

  return (
    <div className="space-y-1.5">
      <div
        ref={containerRef}
        dir="ltr"
        className={`relative flex items-stretch gap-0 rounded-2xl border transition-all bg-secondary/60 ${
          showError
            ? "border-destructive/60 ring-2 ring-destructive/20"
            : focused
            ? "border-gold/60 ring-2 ring-gold/20 bg-card"
            : "border-border hover:border-border/80"
        }`}
      >
        {/* Country picker */}
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen((v) => !v)}
          className="flex items-center gap-1.5 px-3 py-3 rounded-r-2xl border-l border-border/60 hover:bg-secondary/80 transition shrink-0 font-mono text-sm focus:outline-none"
          aria-label="اختر رمز الدولة"
        >
          <span className="text-base leading-none">{selected.flag}</span>
          <span className="font-semibold text-foreground">{selected.code}</span>
          <ChevronDown className={`size-3.5 text-muted-foreground transition-transform ${open ? "rotate-180" : ""}`} />
        </button>

        {/* Phone input */}
        <div className="relative flex-1">
          <Phone className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
          <input
            type="tel"
            inputMode="tel"
            autoComplete="tel-national"
            value={formatPhone(digits)}
            onFocus={() => setFocused(true)}
            onBlur={() => { setFocused(false); setTouched(true); }}
            onChange={(e) => onPhoneChange(e.target.value.replace(/\D/g, "").slice(0, selected.maxLen))}
            disabled={disabled}
            placeholder="555 123 456"
            className="w-full bg-transparent px-3 py-3 pl-10 text-base font-mono outline-none placeholder:text-muted-foreground/60 placeholder:font-sans"
            aria-invalid={showError}
          />
          {isValid && !showError && (
            <Check className="absolute left-10 top-1/2 -translate-y-1/2 size-4 text-success" />
          )}
        </div>

        {/* Dropdown */}
        {open && (
          <div className="absolute top-full mt-2 left-0 right-0 z-50 bg-card border border-border rounded-2xl shadow-elegant overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150" dir="rtl">
            <div className="relative border-b border-border">
              <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
              <input
                autoFocus
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="ابحث عن دولة..."
                className="w-full bg-transparent pr-10 pl-3 py-2.5 text-sm outline-none"
              />
            </div>
            <div className="max-h-64 overflow-y-auto py-1">
              {filtered.length === 0 ? (
                <div className="px-4 py-6 text-center text-xs text-muted-foreground">لا توجد نتائج</div>
              ) : (
                filtered.map((c) => {
                  const active = c.code === countryCode;
                  return (
                    <button
                      type="button"
                      key={c.iso}
                      onClick={() => { onCountryCodeChange(c.code); setOpen(false); setSearch(""); }}
                      className={`w-full flex items-center gap-3 px-3 py-2.5 text-sm hover:bg-secondary/80 transition ${
                        active ? "bg-gold/10 text-gold font-semibold" : "text-foreground"
                      }`}
                    >
                      <span className="text-lg leading-none">{c.flag}</span>
                      <span className="flex-1 text-right">{c.name}</span>
                      <span className="font-mono text-xs text-muted-foreground">{c.code}</span>
                      {active && <Check className="size-4 text-gold" />}
                    </button>
                  );
                })
              )}
            </div>
          </div>
        )}
      </div>

      {/* Error / helper */}
      {showError ? (
        <p className="text-[11px] text-destructive font-medium flex items-center gap-1 px-1">
          {error}
        </p>
      ) : (
        <p className="text-[11px] text-muted-foreground px-1">
          سيتم استخدام الرقم للتواصل وإشعارات الحجوزات
        </p>
      )}
    </div>
  );
}

export function buildE164(countryCode: string, phone: string): string {
  return `${countryCode}${phone.replace(/\D/g, "").replace(/^0+/, "")}`;
}
