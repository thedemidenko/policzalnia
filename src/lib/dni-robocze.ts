// Dni robocze i wymiar czasu pracy (art. 130 KP): w okresie rozliczeniowym 8 h × dni pon.–pt., minus 8 h za każde święto
// przypadające w innym dniu niż niedziela (także w sobotę – art. 130 § 2). Święta: ustawa o dniach wolnych od pracy
// (src/lib/kalendarz.ts, Wigilia od 2025 r.).
import { czySwieto, dodajDni, dzienTygodnia } from './kalendarz';

const ISO = /^\d{4}-\d{2}-\d{2}$/;
export const NAZWY_MIESIECY = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];

export interface Zakres {
  dniKalendarzowe: number;
  dniRobocze: number;
  soboty: number;
  niedziele: number;
  swieta: { data: string; nazwa: string }[];
  /** święta w soboty – obniżają wymiar o 8 h */
  swietaWSoboty: number;
  /** wymiar czasu pracy pełnego etatu w godzinach */
  wymiarGodzin: number;
  blad?: string;
}

/** Statystyka dni w zakresie od–do (włącznie). */
export function zakres(od: string, doD: string, sobotyRobocze = false): Zakres {
  const pusty = (blad: string): Zakres => ({ dniKalendarzowe: 0, dniRobocze: 0, soboty: 0, niedziele: 0, swieta: [], swietaWSoboty: 0, wymiarGodzin: 0, blad });
  if (!ISO.test(od) || !ISO.test(doD)) return pusty('Podaj obie daty.');
  if (doD < od) return pusty('Data końcowa jest wcześniejsza niż początkowa.');
  if (+doD.slice(0, 4) - +od.slice(0, 4) > 20) return pusty('Zakres może mieć najwyżej 20 lat.');
  const w: Zakres = { dniKalendarzowe: 0, dniRobocze: 0, soboty: 0, niedziele: 0, swieta: [], swietaWSoboty: 0, wymiarGodzin: 0 };
  let pnPt = 0;
  for (let d = od; d <= doD; d = dodajDni(d, 1)) {
    w.dniKalendarzowe++;
    const t = dzienTygodnia(d), s = czySwieto(d);
    if (t === 0) w.niedziele++;
    if (t === 6) w.soboty++;
    if (s) w.swieta.push({ data: d, nazwa: s });
    if (s && t === 6) w.swietaWSoboty++;
    if (t >= 1 && t <= 5 && !s) pnPt++;
    if (!s && (t >= 1 && t <= 5 || (sobotyRobocze && t === 6))) w.dniRobocze++;
  }
  w.wymiarGodzin = 8 * (pnPt - w.swietaWSoboty);
  return w;
}

/** Data po dodaniu n dni roboczych (licząc od dnia następnego); n < 0 – wstecz. */
export function dodajDniRobocze(start: string, n: number, sobotyRobocze = false): string {
  const krok = n < 0 ? -1 : 1;
  let d = start, ile = Math.abs(Math.trunc(n));
  while (ile > 0) {
    d = dodajDni(d, krok);
    const t = dzienTygodnia(d);
    if (!czySwieto(d) && (t >= 1 && t <= 5 || (sobotyRobocze && t === 6))) ile--;
  }
  return d;
}

export interface Miesiac { miesiac: number; nazwa: string; dniRobocze: number; godziny: number; swieta: string[] }
/** Wymiar czasu pracy w poszczególnych miesiącach roku. */
export function rokPracy(rok: number): { miesiace: Miesiac[]; dni: number; godziny: number } {
  const miesiace: Miesiac[] = [];
  for (let m = 1; m <= 12; m++) {
    const od = `${rok}-${String(m).padStart(2, '0')}-01`;
    const ost = new Date(Date.UTC(rok, m, 0)).getUTCDate();
    const z = zakres(od, `${rok}-${String(m).padStart(2, '0')}-${ost}`);
    miesiace.push({ miesiac: m, nazwa: NAZWY_MIESIECY[m - 1], dniRobocze: z.wymiarGodzin / 8, godziny: z.wymiarGodzin, swieta: z.swieta.map((s) => `${+s.data.slice(8)} – ${s.nazwa}`) });
  }
  const godziny = miesiace.reduce((a, m) => a + m.godziny, 0);
  return { miesiace, dni: godziny / 8, godziny };
}
