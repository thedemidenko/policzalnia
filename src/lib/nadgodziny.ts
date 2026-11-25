// Nadgodziny (art. 151–151⁸ KP): normalne wynagrodzenie + dodatek 50% (zwykły dzień) albo 100% (noc, niedziela, święto,
// dzień wolny za niedzielę/święto, przekroczenie normy średniotygodniowej). Podstawa dodatku – stawka z osobistego
// zaszeregowania, a gdy jej nie wyodrębniono – 60% wynagrodzenia (art. 151¹ § 3). Pora nocna – dodatek 20% stawki godzinowej
// z płacy minimalnej (art. 151⁸). Czas wolny zamiast dodatku: na wniosek 1:1, bez wniosku 1,5:1 (art. 151²). Limit 150 h rocznie.
import stawki from '../data/stawki.json';
import { rokPracy } from './dni-robocze';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const placaMinimalna = (rok: number) => {
  const l = (stawki.lata as Record<string, { placa_minimalna: { wartosc: number | null } }>)[String(rok)];
  return l?.placa_minimalna.wartosc ?? stawki.lata['2026'].placa_minimalna.wartosc;
};
export const godzinyMiesiaca = (rok: number, miesiac: number) => rokPracy(rok).miesiace[miesiac - 1].godziny;

export interface DaneNadgodzin {
  rok: number;
  miesiac: number;
  /** 'miesieczna' – pensja miesięczna, 'godzinowa' – stawka za godzinę */
  tryb: 'miesieczna' | 'godzinowa';
  pensja?: number;
  /** stałe dodatki (np. stażowy, funkcyjny) – wchodzą do normalnego wynagrodzenia, nie do podstawy dodatku */
  dodatki?: number;
  stawka?: number;
  /** w umowie nie wyodrębniono stawki zaszeregowania – podstawa dodatku 60% wynagrodzenia */
  bez60?: boolean;
  etat?: number;
  h50?: number;
  h100?: number;
  /** ile z nadgodzin przypadło w porze nocnej (21–7) */
  hNoc?: number;
  wczesniejWRoku?: number;
}
export interface WynikNadgodzin {
  wymiarGodzin: number;
  stawkaNormalna: number;
  podstawaDodatku: number;
  normalne: number;
  dodatek50: number;
  dodatek100: number;
  dodatekNocny: number;
  razem: number;
  wolne1do1: number;
  wolneBezWniosku: number;
  uwagi: string[];
  blad?: string;
}

export function obliczNadgodziny(x: DaneNadgodzin): WynikNadgodzin {
  const uwagi: string[] = [];
  const pusty = (blad: string): WynikNadgodzin => ({ wymiarGodzin: 0, stawkaNormalna: 0, podstawaDodatku: 0, normalne: 0, dodatek50: 0, dodatek100: 0, dodatekNocny: 0, razem: 0, wolne1do1: 0, wolneBezWniosku: 0, uwagi, blad });
  if (!(x.miesiac >= 1 && x.miesiac <= 12) || !(x.rok > 1900)) return pusty('Wybierz miesiąc.');
  const etat = x.etat && x.etat > 0 && x.etat <= 1 ? x.etat : 1;
  const pelny = godzinyMiesiaca(x.rok, x.miesiac);
  const wymiarGodzin = r2(pelny * etat);
  const h50 = Math.max(0, x.h50 ?? 0), h100 = Math.max(0, x.h100 ?? 0), hNoc = Math.min(Math.max(0, x.hNoc ?? 0), h50 + h100);
  let stawkaNormalna: number, podstawaDodatku: number;
  if (x.tryb === 'godzinowa') {
    if (!(x.stawka! > 0)) return pusty('Podaj stawkę godzinową.');
    stawkaNormalna = podstawaDodatku = r2(x.stawka!);
  } else {
    if (!(x.pensja! > 0)) return pusty('Podaj pensję.');
    const calosc = x.pensja! + Math.max(0, x.dodatki ?? 0);
    stawkaNormalna = r2(calosc / wymiarGodzin);
    podstawaDodatku = x.bez60 ? r2((0.6 * calosc) / wymiarGodzin) : r2(x.pensja! / wymiarGodzin);
  }
  const normalne = r2(stawkaNormalna * (h50 + h100));
  const dodatek50 = r2(podstawaDodatku * 0.5 * h50), dodatek100 = r2(podstawaDodatku * h100);
  const nocnaStawka = r2((placaMinimalna(x.rok) / pelny) * 0.2);
  const dodatekNocny = r2(nocnaStawka * hNoc);
  const razem = r2(normalne + dodatek50 + dodatek100 + dodatekNocny);
  if (hNoc > 0) uwagi.push(`Za godziny nocne przysługuje osobno dodatek nocny: 20% stawki z płacy minimalnej, w tym miesiącu ${nocnaStawka.toLocaleString('pl-PL')} zł za godzinę.`);
  const wRoku = Math.max(0, x.wczesniejWRoku ?? 0) + h50 + h100;
  if (wRoku > 150) uwagi.push(`To już ${wRoku} nadgodzin w roku – ponad limit 150 godzin z Kodeksu pracy (art. 151 § 3). Wyższy limit może wynikać z regulaminu, układu zbiorowego lub umowy.`);
  if (x.tryb === 'miesieczna' && x.bez60) uwagi.push('Podstawa dodatku to 60% wynagrodzenia, bo w umowie nie wyodrębniono stawki zaszeregowania (art. 151¹ § 3).');
  return { wymiarGodzin, stawkaNormalna, podstawaDodatku, normalne, dodatek50, dodatek100, dodatekNocny, razem, wolne1do1: h50 + h100, wolneBezWniosku: r2((h50 + h100) * 1.5), uwagi };
}
