export const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const zl = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN' });
export const liczba = (v: string | null | undefined) => {
  const n = parseFloat(String(v ?? '').replace(/\s/g, '').replace(',', '.'));
  return Number.isFinite(n) ? n : 0;
};
