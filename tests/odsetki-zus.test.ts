import { describe, expect, it } from 'vitest';
import dane from '../src/data/odsetki-zus.json';
import stawki from '../src/data/stawki.json';
import { minimalneOdsetki, obliczOdsetkiZus, odsetkiOdSkladki, progOdsetek, terminSkladek } from '../src/lib/odsetki-zus';

const JDG = { fus: 1788.29, fuz: 432.54, fp: 138.47 }; // pełny ZUS 2026 + minimalna zdrowotna

describe('odsetki od zaległości ZUS', () => {
  it('10 000 zł od 20.02 do 16.07.2026 – dwie stawki, 422 zł (przykład CalcForLife)', () => {
    const w = obliczOdsetkiZus([{ termin: '2026-02-20', kwoty: { fus: 10000 } }], '2026-07-16');
    const o = w.pozycje[0].fundusze[0].okresy;
    expect(o.map((x) => [x.dni, x.stawka, x.odsetki])).toEqual([[12, 11, 36.16], [134, 10.5, 385.48]]);
    expect([w.odsetki, w.razem]).toEqual([422, 10422]);
  });
  it('próg 1% płacy minimalnej – w 2026 r. ZUS pobiera odsetki od 49 zł', () => {
    expect(progOdsetek('2026-11-26')).toBe(48.06);
    expect(minimalneOdsetki('2026-11-26')).toBe(49);
    expect(odsetkiOdSkladki(1788.29, '2026-08-20', '2026-11-22')).toBe(0); // 48,36 zł → 48 zł
    expect(odsetkiOdSkladki(1788.29, '2026-08-20', '2026-11-23')).toBe(49); // 48,87 zł → 49 zł
  });
  it('historia progu: 6,60 zł do 17.09.2021, potem 1% płacy minimalnej w dniu zapłaty', () => {
    expect([progOdsetek('2021-09-17'), progOdsetek('2021-09-18'), progOdsetek('2023-08-01'), progOdsetek('2027-01-04')]).toEqual([6.6, 28, 36, 49.5]);
  });
  it('płaca minimalna w danych zgodna ze stawki.json', () => {
    for (const [rok, v] of Object.entries(stawki.lata)) {
      const z = dane.placa_minimalna.find((x) => x.od === `${rok}-01-01`);
      expect(z?.kwota).toBe((v as { placa_minimalna: { wartosc: number } }).placa_minimalna.wartosc);
    }
  });
  it('odsetki osobno dla każdego funduszu – małe fundusze poniżej progu', () => {
    const w = obliczOdsetkiZus([{ okres: '2026-07', kwoty: JDG }], '2026-11-26');
    expect(w.pozycje[0].fundusze.map((f) => [f.fundusz, f.odsetkiPrzedZaokr, f.odsetki])).toEqual([['fus', 50.42, 50], ['fuz', 12.19, 0], ['fp', 3.9, 0]]);
    expect(w.pozycje[0].bezOdsetekDo).toBe('2026-11-22');
  });
  it('terminy płatności: 20./15./5. dzień, przed 2022 r. 10. dla płacących za siebie, sobota → poniedziałek', () => {
    expect(terminSkladek('2026-09', 'sam')).toBe('2026-10-20');
    expect(terminSkladek('2026-08', 'sam')).toBe('2026-09-21'); // 20.09.2026 – niedziela
    expect(terminSkladek('2021-11', 'sam')).toBe('2021-12-10');
    expect(terminSkladek('2021-11', 'pozostali')).toBe('2021-12-15');
    expect(terminSkladek('2022-01', 'sam')).toBe('2022-02-21'); // 20.02.2022 – niedziela
    expect(terminSkladek('2026-04', 'prawna')).toBe('2026-05-15');
    expect(terminSkladek('2026-12', 'budzetowa')).toBe('2027-01-05');
  });
  it('wniosek o raty – odsetki tylko do dnia złożenia wniosku', () => {
    const w = obliczOdsetkiZus([{ termin: '2026-02-20', kwoty: { fus: 10000 } }], '2026-12-31', { wniosekRaty: '2026-07-16' });
    expect([w.odsetki, w.przyrostDzienny]).toEqual([422, 0]);
  });
  it('wpłata częściowa: podział na fundusze jak w ostatniej deklaracji, odsetki poniżej progu – całość na składkę', () => {
    const w = obliczOdsetkiZus([{ okres: '2026-03', kwoty: JDG }, { okres: '2026-04', kwoty: JDG }], '2026-11-26', { wplaty: [{ data: '2026-07-01', kwota: 2000 }] });
    const p = w.pozycje[0].fundusze;
    expect(p.map((f) => f.wplaty[0].kwota)).toEqual([1515.95, 366.67, 117.38]);
    expect(p.map((f) => f.wplaty[0].naOdsetki)).toEqual([0, 0, 0]);
    expect(p[0].skladka).toBe(272.34);
    expect([w.skladki, w.odsetki]).toEqual([2718.6, 98]);
  });
  it('wpłata częściowa przy odsetkach powyżej progu – proporcjonalnie na składkę i odsetki (art. 55 § 2 OP)', () => {
    const w = obliczOdsetkiZus([{ termin: '2026-02-20', kwoty: { fus: 10000 } }], '2026-08-31', { wplaty: [{ data: '2026-07-16', kwota: 5000 }] });
    const f = w.pozycje[0].fundusze[0];
    expect([f.wplaty[0].naSkladke, f.wplaty[0].naOdsetki]).toEqual([4797.71, 202.29]);
    expect(f.skladka).toBe(5202.29);
    expect(w.odsetki).toBe(288); // 219,35 zł + 5202,29 × 46 dni × 10,5% / 365 = 68,84 zł
    expect(w.pozycje[0].fundusze[0].okresy.at(-1)!.kwota).toBe(5202.29);
  });
  it('zapłata w terminie – bez odsetek; pełna wpłata spłaca miesiąc', () => {
    expect(obliczOdsetkiZus([{ okres: '2026-09', kwoty: JDG }], '2026-10-20').odsetki).toBe(0);
    const w = obliczOdsetkiZus([{ okres: '2026-09', kwoty: JDG }], '2026-11-26', { wplaty: [{ data: '2026-10-25', kwota: 2359.3 }] });
    expect([w.skladki, w.odsetki, w.pozycje[0].splaconaWplata]).toEqual([0, 0, '2026-10-25']);
  });
});
