// Arabic-aware text normalization & search helpers.
// - case-insensitive
// - strips diacritics (tashkeel) and tatweel
// - unifies alef/yaa/taa-marbuta variants
// - normalizes whitespace and Arabic/Latin digits

const AR_DIACRITICS = /[\u064B-\u0652\u0670\u0640]/g;
const AR_DIGITS = /[\u0660-\u0669]/g;
const FA_DIGITS = /[\u06F0-\u06F9]/g;

export function normalize(input: unknown): string {
  if (input == null) return "";
  let s = String(input).toLowerCase().trim();
  s = s.replace(AR_DIACRITICS, "");
  s = s.replace(/[إأآا]/g, "ا");
  s = s.replace(/ى/g, "ي");
  s = s.replace(/ؤ/g, "و");
  s = s.replace(/ئ/g, "ي");
  s = s.replace(/ة/g, "ه");
  s = s.replace(AR_DIGITS, (d) => String(d.charCodeAt(0) - 0x0660));
  s = s.replace(FA_DIGITS, (d) => String(d.charCodeAt(0) - 0x06F0));
  s = s.replace(/\s+/g, " ");
  return s;
}

// Match if every whitespace-separated token in `query` appears in any field.
export function matches(query: string, fields: Array<unknown>): boolean {
  const q = normalize(query);
  if (!q) return true;
  const hay = fields.map(normalize).join(" \u0000 ");
  const tokens = q.split(" ").filter(Boolean);
  return tokens.every((t) => hay.includes(t));
}