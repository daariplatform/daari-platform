/** Iraqi-dinar formatter — same one used in dashboard / mockup. */
export function iqd(amount: number): string {
  return new Intl.NumberFormat('en-US').format(amount) + ' د.ع';
}

export function iqdShort(amount: number): string {
  if (amount >= 1_000_000) return (amount / 1_000_000).toFixed(1).replace(/\.0$/, '') + 'م د.ع';
  if (amount >= 1_000) return (amount / 1_000).toFixed(0) + 'ك د.ع';
  return new Intl.NumberFormat('en-US').format(amount) + ' د.ع';
}

export function fmtArabicDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium' }).format(date);
}

export function daysBetween(a: Date | string, b: Date | string = new Date()): number {
  const da = typeof a === 'string' ? new Date(a) : a;
  const db = typeof b === 'string' ? new Date(b) : b;
  return Math.floor((db.getTime() - da.getTime()) / 86_400_000);
}
