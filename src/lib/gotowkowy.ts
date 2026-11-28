// Kredyt gotówkowy (konsumencki): rata, całkowity koszt, RRSO i limity z ustawy o kredycie konsumenckim (Dz.U. 2025 poz. 1362):
// art. 36a – maksymalne pozaodsetkowe koszty: MPKK = K × 10% + K × n/R × 10%, nie więcej niż 45% K;
// art. 49 – przy wcześniejszej spłacie całkowity koszt spada o koszty za okres, o który skrócono umowę;
// art. 50 – prowizja za wcześniejszą spłatę tylko przy stałej stopie (1% / 0,5%, z dodatkowymi warunkami).
// Odsetki maksymalne: art. 359 § 2¹ Kodeksu cywilnego – dwukrotność odsetek ustawowych (stopa referencyjna NBP + 3,5 pp).
// RRSO (załącznik nr 4 do ustawy): roczna efektywna stopa zrównująca wypłaconą kwotę z ratami i innymi kosztami.
import stopy from '../data/stopy-nbp.json';
import { rataRowna } from './hipoteczny';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function odsetkiMaksymalne(data: string): number {
  const z = (stopy.zmiany as { od: string; ref: number }[]).filter((x) => x.od <= data);
  const ref = z.length ? z[z.length - 1].ref : 3.75;
  return Math.round(2 * (ref + 3.5) * 100) / 100;
}

export interface DaneGotowkowego {
  /** kwota, którą chcesz dostać na konto */
  kwota: number;
  miesiace: number;
  oprocentowanie: number;
  /** prowizja w % kwoty */
  prowizja?: number;
  /** ubezpieczenie jednorazowe w zł */
  ubezpieczenie?: number;
  /** ubezpieczenie miesięczne w zł (w racie) */
  ubezpieczenieMies?: number;
  /** czy prowizja i ubezpieczenie jednorazowe są doliczane do kredytu (kredytowane) */
  kredytowane?: boolean;
  raty?: 'rowne' | 'malejace';
}

export interface WynikGotowkowego {
  /** kapitał do spłaty (z kredytowanymi kosztami) */
  kapital: number;
  rata: number;
  ostatniaRata: number;
  odsetki: number;
  prowizja: number;
  ubezpieczenie: number;
  /** pozaodsetkowe koszty: prowizja i ubezpieczenia */
  pozaodsetkowe: number;
  koszt: number;
  doZaplaty: number;
  rrso: number;
  mpkk: number;
  ponadLimit: number;
  raty: { rata: number; odsetki: number; kapital: number; saldo: number }[];
}

export function oblicz(x: DaneGotowkowego): WynikGotowkowego {
  const n = Math.max(1, Math.round(x.miesiace));
  const K = r2(Math.max(0, x.kwota));
  const prowizja = r2(K * (x.prowizja ?? 0) / 100);
  const ubezpieczenie = r2(Math.max(0, x.ubezpieczenie ?? 0));
  const kapital = x.kredytowane ? r2(K + prowizja + ubezpieczenie) : K;
  const r = x.oprocentowanie / 100 / 12;
  const raty: WynikGotowkowego['raty'] = [];
  let saldo = kapital;
  const rataStala = r2(rataRowna(kapital, r, n));
  const kapStaly = r2(kapital / n);
  for (let m = 1; m <= n; m++) {
    const ods = r2(saldo * r);
    let kap = x.raty === 'malejace' ? kapStaly : r2(rataStala - ods);
    if (m === n || kap > saldo) kap = saldo;
    saldo = r2(saldo - kap);
    raty.push({ rata: r2(kap + ods), odsetki: ods, kapital: kap, saldo });
  }
  const odsetki = r2(raty.reduce((a, q) => a + q.odsetki, 0));
  const ubezMies = r2((x.ubezpieczenieMies ?? 0) * n);
  const pozaodsetkowe = r2(prowizja + ubezpieczenie + ubezMies);
  const koszt = r2(odsetki + pozaodsetkowe);
  // wypłata na konto: kwota (koszty kredytowane) albo kwota minus koszty płacone z góry
  const wyplata = x.kredytowane ? K : r2(K - prowizja - ubezpieczenie);
  const przeplywy = raty.map((q) => q.rata + (x.ubezpieczenieMies ?? 0));
  const npv = (i: number) => przeplywy.reduce((a, c, k) => a + c / Math.pow(1 + i, k + 1), 0) - wyplata;
  let lo = 0, hi = 0.2;
  for (let k = 0; k < 100; k++) { const mid = (lo + hi) / 2; if (npv(mid) > 0) lo = mid; else hi = mid; }
  const rrso = K > 0 ? Math.round((Math.pow(1 + (lo + hi) / 2, 12) - 1) * 10000) / 100 : 0;
  // limit pozaodsetkowych kosztów: dni okresu spłaty ≈ miesiące × 365/12
  const mpkk = r2(Math.min(K * 0.45, K * 0.1 + K * ((n * 365) / 12 / 365) * 0.1));
  return {
    kapital, rata: raty[0]?.rata ?? 0, ostatniaRata: raty.at(-1)?.rata ?? 0, odsetki, prowizja, ubezpieczenie: r2(ubezpieczenie + ubezMies), pozaodsetkowe, koszt,
    doZaplaty: r2(kapital + odsetki + ubezMies + (x.kredytowane ? 0 : prowizja + ubezpieczenie)), rrso, mpkk, ponadLimit: Math.max(0, r2(pozaodsetkowe - mpkk)), raty,
  };
}

/** Zwrot kosztów przy całkowitej spłacie po m miesiącach (art. 49) – liniowo do okresu, o który skrócono umowę. */
export function zwrotPrzySplacie(x: DaneGotowkowego, w: WynikGotowkowego, m: number): { saldo: number; zwrot: number; oszczednoscOdsetek: number } {
  const n = Math.max(1, Math.round(x.miesiace));
  const k = Math.min(n, Math.max(0, Math.round(m)));
  const saldo = k > 0 ? w.raty[k - 1].saldo : w.kapital;
  const jednorazowe = w.prowizja + r2(Math.max(0, x.ubezpieczenie ?? 0));
  const zwrot = r2(jednorazowe * (n - k) / n);
  const oszczednoscOdsetek = r2(w.raty.slice(k).reduce((a, q) => a + q.odsetki, 0));
  return { saldo, zwrot, oszczednoscOdsetek };
}
