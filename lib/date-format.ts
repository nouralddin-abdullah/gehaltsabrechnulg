// Converts between a native <input type="date"> value ("YYYY-MM-DD") and the
// formats the slip engine stores. Pure; no Date objects (avoid TZ surprises).
export type DateFmt = "ddmmyy" | "dmy-dot";

const pad = (n: string) => n.padStart(2, "0");

export function toDateInput(stored: string, fmt: DateFmt): string {
  const s = (stored || "").trim();
  if (!s) return "";
  if (fmt === "ddmmyy") {
    const m = /^(\d{2})(\d{2})(\d{2})$/.exec(s);
    if (!m) return "";
    const [, dd, mm, yy] = m;
    const year = Number(yy) < 70 ? `20${yy}` : `19${yy}`;
    return `${year}-${mm}-${dd}`;
  }
  // dmy-dot: "TT.MM.JJJJ"
  const m = /^(\d{2})\.(\d{2})\.(\d{4})$/.exec(s);
  if (!m) return "";
  const [, dd, mm, yyyy] = m;
  return `${yyyy}-${mm}-${dd}`;
}

export function fromDateInput(iso: string, fmt: DateFmt): string {
  const s = (iso || "").trim();
  if (!s) return "";
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return s; // already in another format; leave as-is
  const [, yyyy, mm, dd] = m;
  if (fmt === "ddmmyy") return `${pad(dd)}${pad(mm)}${yyyy.slice(2)}`;
  return `${pad(dd)}.${pad(mm)}.${yyyy}`;
}
