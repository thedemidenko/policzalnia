// Dni ustawowo wolne od pracy w Polsce (ustawa z 18.01.1951 o dniach wolnych od pracy).
// Daty jako ISO YYYY-MM-DD; obliczenia w UTC (bez stref czasowych).
const DZIEN = 86_400_000;
const pad = (n: number) => String(n).padStart(2, '0');
const isoUTC = (d: Date) => d.toISOString().slice(0, 10);
const zIso = (iso: string) => new Date(Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)));

/** Niedziela Wielkanocna (algorytm Meeusa/Jonesa/Butchera). */
export function wielkanoc(rok: number): string {
  const a = rok % 19, b = Math.floor(rok / 100), c = rok % 100, d = Math.floor(b / 4), e = b % 4;
  const f = Math.floor((b + 8) / 25), g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7, m = Math.floor((a + 11 * h + 22 * l) / 451);
  const mies = Math.floor((h + l - 7 * m + 114) / 31), dz = ((h + l - 7 * m + 114) % 31) + 1;
  return `${rok}-${pad(mies)}-${pad(dz)}`;
}

const cache = new Map<number, Map<string, string>>();
/** Święta ustawowe w danym roku: data → nazwa. */
export function swieta(rok: number): Map<string, string> {
  const z = cache.get(rok);
  if (z) return z;
  const w = zIso(wielkanoc(rok)).getTime();
  const plus = (dni: number) => isoUTC(new Date(w + dni * DZIEN));
  const lista: [string, string][] = [
    [`${rok}-01-01`, 'Nowy Rok'],
    [plus(0), 'Wielkanoc'],
    [plus(1), 'Poniedziałek Wielkanocny'],
    [`${rok}-05-01`, 'Święto Pracy'],
    [`${rok}-05-03`, 'Święto Konstytucji 3 Maja'],
    [plus(49), 'Zielone Świątki'],
    [plus(60), 'Boże Ciało'],
    [`${rok}-08-15`, 'Wniebowzięcie NMP'],
    [`${rok}-11-01`, 'Wszystkich Świętych'],
    [`${rok}-11-11`, 'Narodowe Święto Niepodległości'],
    [`${rok}-12-25`, 'Boże Narodzenie (1. dzień)'],
    [`${rok}-12-26`, 'Boże Narodzenie (2. dzień)'],
  ];
  if (rok >= 2011) lista.push([`${rok}-01-06`, 'Trzech Króli']);
  if (rok >= 2025) lista.push([`${rok}-12-24`, 'Wigilia Bożego Narodzenia']);
  const m = new Map(lista.sort((a, b) => a[0].localeCompare(b[0])));
  cache.set(rok, m);
  return m;
}

export const dzienTygodnia = (iso: string) => zIso(iso).getUTCDay(); // 0 = niedziela
export const czySwieto = (iso: string) => swieta(+iso.slice(0, 4)).get(iso);
export const czyRoboczy = (iso: string) => { const t = dzienTygodnia(iso); return t !== 0 && t !== 6 && !czySwieto(iso); };
export const dodajDni = (iso: string, n: number) => isoUTC(new Date(zIso(iso).getTime() + n * DZIEN));

/** Art. 115 KC: termin przypadający w sobotę lub dzień ustawowo wolny upływa następnego dnia roboczego. */
export function terminRoboczy(iso: string): string {
  let d = iso;
  while (!czyRoboczy(d)) d = dodajDni(d, 1);
  return d;
}

export const NAZWY_DNI = ['niedziela', 'poniedziałek', 'wtorek', 'środa', 'czwartek', 'piątek', 'sobota'];
