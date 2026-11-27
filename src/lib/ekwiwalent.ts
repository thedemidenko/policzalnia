// Ekwiwalent za niewykorzystany urlop (art. 171 KP; rozporządzenie MPiPS z 8.01.1997, Dz.U. 1997 nr 2 poz. 14 ze zm., § 14–19).
// Podstawa: składniki stałe w wysokości z miesiąca nabycia prawa (§ 15) + zmienne miesięczne – średnia z 3 miesięcy (§ 16)
// + składniki za okresy dłuższe niż miesiąc – średnia z 12 miesięcy (§ 17). Ekwiwalent za dzień = podstawa ÷ współczynnik,
// za godzinę = za dzień ÷ dobowa norma (8 h, niżej np. 7 h), × godziny niewykorzystanego urlopu (§ 18).
// Współczynnik (§ 19): (dni w roku − niedziele, święta i dni wolne z 5-dniowego tygodnia) ÷ 12, przy niepełnym etacie proporcjonalnie.
import { czySwieto, dzienTygodnia, dodajDni } from './kalendarz';
import { obliczUrlop } from './urlop';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
const ISO = /^\d{4}-\d{2}-\d{2}$/;

/** Dni pracy w roku przy 5-dniowym tygodniu: dni robocze pon.–pt. bez świąt, minus święta w soboty (art. 130 § 2 KP). */
export function dniPracyWRoku(rok: number): number {
  let n = 0;
  for (let d = `${rok}-01-01`; d.startsWith(String(rok)); d = dodajDni(d, 1)) {
    const t = dzienTygodnia(d), s = !!czySwieto(d);
    if (t >= 1 && t <= 5 && !s) n++;
    if (t === 6 && s) n--;
  }
  return n;
}
/** Współczynnik do ekwiwalentu za urlop (2 miejsca po przecinku). */
export const wspolczynnik = (rok: number, etat = 1) => r2(r2(dniPracyWRoku(rok) / 12) * etat);

export interface DaneEkwiwalentu {
  /** dzień rozwiązania umowy (nabycia prawa do ekwiwalentu) */
  koniec: string;
  stale: number;
  /** średnia miesięczna składników zmiennych z 3 miesięcy */
  zmienne?: number;
  /** suma premii kwartalnych / rocznych wypłaconych w 12 miesiącach */
  premie12?: number;
  etat?: number;
  norma?: number;
  /** tryb: 'dni' – wpisane dni, 'policz' – z wymiaru urlopu w roku odejścia */
  tryb: 'dni' | 'policz';
  dni?: number;
  /** do trybu 'policz' */
  poczatek?: string;
  dziesiecLat?: boolean;
  wykorzystany?: number;
  zalegly?: number;
}
export interface WynikEkwiwalentu {
  rok: number;
  wspolczynnik: number;
  podstawa: number;
  zaDzien: number;
  zaGodzine: number;
  dni: number;
  godziny: number;
  ekwiwalent: number;
  wymiarWRoku?: number;
  uwagi: string[];
  blad?: string;
}

export function obliczEkwiwalent(x: DaneEkwiwalentu): WynikEkwiwalentu {
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikEkwiwalentu => ({ rok: 0, wspolczynnik: 0, podstawa: 0, zaDzien: 0, zaGodzine: 0, dni: 0, godziny: 0, ekwiwalent: 0, uwagi, blad });
  if (!ISO.test(x.koniec)) return pusty('Podaj dzień rozwiązania umowy.');
  const rok = +x.koniec.slice(0, 4);
  const etat = x.etat && x.etat > 0 && x.etat <= 1 ? x.etat : 1;
  const norma = x.norma && x.norma > 0 ? x.norma : 8;
  const podstawa = r2(Math.max(0, x.stale) + Math.max(0, x.zmienne ?? 0) + Math.max(0, x.premie12 ?? 0) / 12);
  if (!(podstawa > 0)) return pusty('Podaj wynagrodzenie.');
  const wsp = wspolczynnik(rok, etat);

  let dni = Math.max(0, x.dni ?? 0), wymiarWRoku: number | undefined;
  if (x.tryb === 'policz') {
    const u = obliczUrlop({ rok, tryb: 'proporcjonalny', od: x.poczatek, do: x.koniec, etat, dziesiecLat: x.dziesiecLat });
    if (u.blad) return pusty(u.blad);
    wymiarWRoku = u.dni;
    dni = Math.max(0, r2(u.dni + Math.max(0, x.zalegly ?? 0) - Math.max(0, x.wykorzystany ?? 0)));
    uwagi.push(`Urlop proporcjonalny za ${rok} r.: ${u.dni} dni (miesiące pracy w roku × 1/12 wymiaru, w górę).`);
    if ((x.wykorzystany ?? 0) > u.dni + (x.zalegly ?? 0)) uwagi.push('Wykorzystano więcej urlopu, niż przysługiwało – pracodawca nie może potrącić za to z pensji.');
  }
  const godziny = r2(dni * norma);
  const zaDzien = r2(podstawa / wsp), zaGodzine = r2(zaDzien / norma);
  const ekwiwalent = r2(zaGodzine * godziny);
  if (etat < 1) uwagi.push(`Przy ${etat.toLocaleString('pl-PL')} etatu współczynnik obniża się proporcjonalnie: ${wsp.toLocaleString('pl-PL')}.`);
  return { rok, wspolczynnik: wsp, podstawa, zaDzien, zaGodzine, dni, godziny, ekwiwalent, wymiarWRoku, uwagi };
}
