// German number formatting helpers (e.g. "1.986,11" <-> 1986.11).

export function parseDE(s: string | null | undefined): number {
  if (!s) return 0;
  const n = Number(String(s).replace(/\./g, "").replace(",", ".").trim());
  return Number.isFinite(n) ? n : 0;
}

export function formatDE(n: number): string {
  const neg = n < 0;
  const [int, dec] = Math.abs(n).toFixed(2).split(".");
  const withDots = int.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
  return `${neg ? "-" : ""}${withDots},${dec}`;
}
