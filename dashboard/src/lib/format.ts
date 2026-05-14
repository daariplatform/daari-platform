export function iqd(amount: number) {
  return new Intl.NumberFormat('ar-IQ').format(amount) + ' د.ع';
}

export function fmtDate(d: Date | string | null | undefined) {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return new Intl.DateTimeFormat('ar-IQ', { dateStyle: 'medium' }).format(date);
}
