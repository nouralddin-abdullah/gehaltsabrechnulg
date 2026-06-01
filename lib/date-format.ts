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

// Whole-years age from a "ddmmyy" date of birth, as of a reference year/month
// (the payslip period). Returns 0 for an unparseable/empty DOB.
export function ageFromDob(
  dobDdmmyy: string,
  refYear: number,
  refMonth: number,
): number {
  const m = /^(\d{2})(\d{2})(\d{2})$/.exec((dobDdmmyy || "").trim());
  if (!m || !refYear) return 0;
  const birthMonth = +m[2];
  const yy = +m[3];
  const birthYear = yy < 70 ? 2000 + yy : 1900 + yy;
  let age = refYear - birthYear;
  if (refMonth && refMonth < birthMonth) age -= 1; // birthday not reached yet
  return age > 0 ? age : 0;
}
