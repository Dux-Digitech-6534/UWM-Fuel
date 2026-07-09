export const inr = (n: number | null | undefined) =>
  n == null ? '—' : '₹ ' + Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const lt = (n: number | null | undefined) =>
  n == null ? '0.00' : Number(n).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
export const intfmt = (n: number | null | undefined) =>
  n == null ? '—' : Math.round(Number(n)).toLocaleString('en-IN')

// today's date in Asia/Kolkata as yyyy-mm-dd (for <input type=date> + backend)
export function todayKolkata(): string {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit',
  }).format(new Date())
  return parts // en-CA gives yyyy-mm-dd
}
export const shortDate = (iso: string) => {
  if (!iso) return '—'
  try { return new Date(iso).toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: '2-digit' }) }
  catch { return iso }
}
