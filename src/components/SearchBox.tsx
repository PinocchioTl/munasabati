import { Search, X } from "lucide-react";

export function SearchBox({
  value, onChange, onSearch, placeholder, className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  onSearch?: (v: string) => void;
  placeholder?: string;
  className?: string;
}) {
  const submitSearch = () => {
    const next = value.trim();
    if (next !== value) onChange(next);
    onSearch?.(next);
  };

  return (
    <form
      className={`relative w-full ${className}`}
      role="search"
      onSubmit={(e) => {
        e.preventDefault();
        submitSearch();
      }}
    >
      <button
        type="submit"
        aria-label="بحث"
        className="absolute right-2 top-1/2 -translate-y-1/2 size-8 rounded-lg hover:bg-secondary flex items-center justify-center text-muted-foreground hover:text-foreground transition"
      >
        <Search className="size-4" />
      </button>
      <input
        type="search"
        inputMode="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full bg-secondary/60 rounded-xl pr-12 pl-10 py-2.5 text-sm outline-none focus:ring-2 focus:ring-ring placeholder:text-muted-foreground/70 [&::-webkit-search-cancel-button]:hidden"
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
    </form>
  );
}