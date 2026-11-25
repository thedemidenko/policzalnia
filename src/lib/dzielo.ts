// Umowa o dzieło (PIT): koszty 20% albo 50% przy przeniesieniu praw autorskich (limit kosztów 50% – 120 000 zł rocznie,
// art. 22 ust. 9a), zaliczka 12% od dochodu zaokrąglonego do zł, pomniejszona o kwotę zmniejszającą z PIT-2 (art. 41 ust. 1).
// Do 200 zł od podmiotu, dla którego nie pracujesz – ryczałt 12% od przychodu (art. 30 ust. 1 pkt 5a). Bez składek ZUS
// i zdrowotnej, chyba że umowa jest z własnym pracodawcą – wtedy składki jak przy umowie o pracę. Ulga dla młodych nie obejmuje dzieła.
const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
export const LIMIT_KUP50 = 120_000;
export const PRACODAWCA_ZUS = 0.2048; // emerytalna 9,76 + rentowa 6,5 + wypadkowa 1,67 + FP 2,45 + FGŚP 0,10

export interface DaneDziela {
  brutto: number;
  /** jaka część wynagrodzenia dotyczy przeniesienia praw autorskich (0–1) */
  autorskie?: number;
  /** koszty 50% wykorzystane wcześniej w tym roku */
  wykorzystane50?: number;
  /** miesięczna kwota zmniejszająca z PIT-2: 0, 100, 150 albo 300 zł */
  pit2?: number;
  wlasnyPracodawca?: boolean;
}
export interface WynikDziela {
  brutto: number;
  skladkiSpoleczne: number;
  zdrowotna: number;
  koszty: number;
  koszty50: number;
  dochod: number;
  podatek: number;
  netto: number;
  kosztZamawiajacego: number;
  ryczalt: boolean;
  uwagi: string[];
}

export function obliczDzielo(x: DaneDziela): WynikDziela {
  const uwagi: string[] = [];
  const brutto = r2(Math.max(0, x.brutto));
  const wlasny = !!x.wlasnyPracodawca;
  if (!wlasny && brutto > 0 && brutto <= 200) {
    const podatek = Math.round(brutto * 0.12);
    uwagi.push('Do 200 zł z umowy z firmą, dla której nie pracujesz, płatnik pobiera 12% ryczałtu od całej kwoty – bez kosztów i bez PIT-2. Tej kwoty nie wykazuje się w zeznaniu rocznym.');
    return { brutto, skladkiSpoleczne: 0, zdrowotna: 0, koszty: 0, koszty50: 0, dochod: brutto, podatek, netto: r2(brutto - podatek), kosztZamawiajacego: brutto, ryczalt: true, uwagi };
  }
  const skladkiSpoleczne = wlasny ? r2(r2(brutto * 0.0976) + r2(brutto * 0.015) + r2(brutto * 0.0245)) : 0;
  const baza = r2(brutto - skladkiSpoleczne);
  const zdrowotna = wlasny ? r2(baza * 0.09) : 0;
  const aut = Math.min(1, Math.max(0, x.autorskie ?? 0));
  const pozostaly = Math.max(0, LIMIT_KUP50 - Math.max(0, x.wykorzystane50 ?? 0));
  const chce50 = r2(baza * aut * 0.5);
  const koszty50 = Math.min(chce50, pozostaly);
  if (chce50 > koszty50) uwagi.push(`Limit kosztów 50% (${LIMIT_KUP50.toLocaleString('pl-PL')} zł rocznie) wyczerpany – ponad niego koszty wynoszą 0 zł.`);
  const koszty = r2(koszty50 + baza * (1 - aut) * 0.2);
  const dochod = r2(Math.max(0, baza - koszty));
  const pit2 = Math.max(0, x.pit2 ?? 0);
  const podatek = Math.max(0, Math.round(Math.round(dochod) * 0.12 - pit2));
  const netto = r2(brutto - skladkiSpoleczne - zdrowotna - podatek);
  const kosztZamawiajacego = wlasny ? r2(brutto * (1 + PRACODAWCA_ZUS)) : brutto;
  if (wlasny) uwagi.push('Umowa o dzieło z własnym pracodawcą jest oskładkowana jak umowa o pracę – płacisz składki ZUS i zdrowotną, a firma swoją część ZUS.');
  return { brutto, skladkiSpoleczne, zdrowotna, koszty, koszty50, dochod, podatek, netto, kosztZamawiajacego, ryczalt: false, uwagi };
}

/** Brutto, przy którym netto wynosi co najmniej podaną kwotę. */
export function bruttoZNetto(netto: number, x: Omit<DaneDziela, 'brutto'>): number {
  if (!(netto > 0)) return 0;
  let lo = netto, hi = netto * 2 + 100;
  for (let i = 0; i < 60; i++) {
    const m = (lo + hi) / 2;
    if (obliczDzielo({ ...x, brutto: r2(m) }).netto >= netto) hi = m; else lo = m;
  }
  let b = Math.ceil(hi * 100) / 100;
  while (b > 0.01 && obliczDzielo({ ...x, brutto: r2(b - 0.01) }).netto >= netto) b = r2(b - 0.01);
  return r2(b);
}
