import { Search, X } from "lucide-react";

export function SearchBox({
  value, onChange, placeholder, className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`relative w-full ${className}`}>
      <Search className="absolute right-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground pointer-events-none" />
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-secondary/60 rounded-xl pr-10 pl-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          aria-label="مسح البحث"
          className="absolute left-2 top-1/2 -translate-y-1/2 size-7 rounded-full hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}