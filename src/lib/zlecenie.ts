// Umowa zlecenia: składki ZUS zależnie od sytuacji (ustawa o sus – zbieg tytułów), zdrowotna 9% (nieodliczana),
// koszty 20% (50% za prawa autorskie) od kwoty po składkach, zaliczka 12% (art. 41 ust. 1 PIT) minus PIT-2 (art. 31a),
// ulga dla młodych do 26 lat (art. 21 ust. 1 pkt 148), ryczałt 12% do 200 zł (art. 30 ust. 1 pkt 5a), minimalna stawka godzinowa.
import stawki from '../data/stawki.json';

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
type Lata = Record<string, { placa_minimalna: { wartosc: number | null }; stawka_godzinowa_min: { wartosc: number | null } }>;
const rokDane = (rok: number) => (stawki.lata as unknown as Lata)[String(rok)] ?? (stawki.lata as unknown as Lata)['2026'];
export const placaMinimalna = (rok: number) => rokDane(rok).placa_minimalna.wartosc ?? 4806;
export const stawkaGodzinowaMin = (rok: number) => rokDane(rok).stawka_godzinowa_min.wartosc ?? 31.4;

/**
 * brak – zlecenie to jedyny tytuł (także emeryt, JDG): emerytalna i rentowa obowiązkowe, chorobowa dobrowolna;
 * student – uczeń lub student do 26 lat: bez ZUS i zdrowotnej;
 * etat – umowa o pracę u innego pracodawcy albo inne zlecenie z ZUS od co najmniej płacy minimalnej: tylko zdrowotna;
 * pracodawca – zlecenie z własnym pracodawcą: składki jak przy umowie o pracę.
 */
export type Sytuacja = 'brak' | 'student' | 'etat' | 'pracodawca';
export interface DaneZlecenia {
  rok: number;
  brutto: number;
  sytuacja: Sytuacja;
  chorobowe?: boolean;
  ulgaMlodych?: boolean;
  autorskie?: number;
  pit2?: number;
  godziny?: number;
}
export interface WynikZlecenia {
  brutto: number;
  emerytalna: number;
  rentowa: number;
  chorobowa: number;
  spoleczne: number;
  zdrowotna: number;
  koszty: number;
  dochod: number;
  podatek: number;
  netto: number;
  kosztZleceniodawcy: number;
  skladkiZleceniodawcy: number;
  ryczalt: boolean;
  uwagi: string[];
}

export function obliczZlecenie(x: DaneZlecenia): WynikZlecenia {
  const uwagi: string[] = [];
  const brutto = r2(Math.max(0, x.brutto));
  const s = x.sytuacja;
  const min = placaMinimalna(x.rok);
  if (x.godziny && x.godziny > 0 && brutto / x.godziny < stawkaGodzinowaMin(x.rok) - 0.004)
    uwagi.push(`Stawka ${r2(brutto / x.godziny).toLocaleString('pl-PL')} zł za godzinę jest niższa niż minimalna w ${x.rok} r. – ${stawkaGodzinowaMin(x.rok).toLocaleString('pl-PL')} zł (nie dotyczy m.in. zleceń z samodzielnym wyborem miejsca i czasu i wynagrodzeniem prowizyjnym).`);

  const spoleczneObow = s === 'brak' || s === 'pracodawca';
  const emerytalna = spoleczneObow ? r2(brutto * 0.0976) : 0;
  const rentowa = spoleczneObow ? r2(brutto * 0.015) : 0;
  const chorobowa = s === 'pracodawca' || (s === 'brak' && x.chorobowe) ? r2(brutto * 0.0245) : 0;
  const spoleczne = r2(emerytalna + rentowa + chorobowa);
  const baza = r2(brutto - spoleczne);
  const zdrowotna = s === 'student' ? 0 : r2(baza * 0.09);

  // składki zleceniodawcy: emerytalna 9,76, rentowa 6,5, wypadkowa 1,67, FP 2,45 (od podstawy ≥ płacy minimalnej), FGŚP 0,10
  let skladkiZleceniodawcy = 0;
  if (spoleczneObow) {
    skladkiZleceniodawcy = r2(r2(brutto * 0.0976) + r2(brutto * 0.065) + r2(brutto * 0.0167) + r2(brutto * 0.001) + (brutto >= min || s === 'pracodawca' ? r2(brutto * 0.0245) : 0));
  }

  let koszty = 0, dochod = 0, podatek = 0, ryczalt = false;
  if (s === 'student') {
    uwagi.push('Uczeń lub student do 26 lat na zleceniu nie płaci składek ZUS ani zdrowotnej, a dzięki uldze dla młodych – także podatku (do 85 528 zł przychodu w roku).');
  } else if (s !== 'pracodawca' && brutto > 0 && brutto <= 200) {
    ryczalt = true;
    podatek = x.ulgaMlodych ? 0 : Math.round(brutto * 0.12);
    uwagi.push('Do 200 zł z umowy z firmą, dla której nie pracujesz, płatnik pobiera 12% ryczałtu od całej kwoty – bez kosztów i PIT-2.');
  } else {
    const aut = Math.min(1, Math.max(0, x.autorskie ?? 0));
    koszty = r2(baza * aut * 0.5 + baza * (1 - aut) * 0.2);
    dochod = r2(Math.max(0, baza - koszty));
    podatek = x.ulgaMlodych ? 0 : Math.max(0, Math.round(Math.round(dochod) * 0.12 - Math.max(0, x.pit2 ?? 0)));
  }
  if (x.ulgaMlodych && s !== 'student') uwagi.push('Ulga dla młodych zwalnia z PIT do 26. urodzin (do 85 528 zł przychodu w roku), ale nie ze składek ZUS i zdrowotnej.');
  if (s === 'brak' && !x.chorobowe) uwagi.push('Bez dobrowolnej składki chorobowej (2,45%) nie dostaniesz zasiłku chorobowego ani macierzyńskiego z tego zlecenia.');
  if (s === 'etat') uwagi.push('Przy etacie (albo innym zleceniu z ZUS) od co najmniej płacy minimalnej składki społeczne ze zlecenia są dobrowolne – obowiązkowa jest tylko zdrowotna.');
  if (s === 'pracodawca') uwagi.push('Zlecenie z własnym pracodawcą jest oskładkowane jak umowa o pracę.');
  const netto = r2(brutto - spoleczne - zdrowotna - podatek);
  return { brutto, emerytalna, rentowa, chorobowa, spoleczne, zdrowotna, koszty, dochod, podatek, netto, kosztZleceniodawcy: r2(brutto + skladkiZleceniodawcy), skladkiZleceniodawcy, ryczalt, uwagi };
}

export function bruttoZNettoZlecenia(netto: number, x: Omit<DaneZlecenia, 'brutto'>): number {
  if (!(netto > 0)) return 0;
  let lo = netto, hi = netto * 2 + 200;
  for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (obliczZlecenie({ ...x, brutto: r2(m) }).netto >= netto) hi = m; else lo = m; }
  let b = Math.ceil(hi * 100) / 100;
  while (b > 0.01 && obliczZlecenie({ ...x, brutto: r2(b - 0.01) }).netto >= netto) b = r2(b - 0.01);
  return r2(b);
}
