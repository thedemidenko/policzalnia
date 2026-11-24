import { describe, expect, it } from 'vitest';
import { miesiecznie, obliczMacierzynski, podstawaZasilku, rodzicielskiMaks } from '../src/lib/macierzynski';

describe('podstawa i kwoty', () => {
  it('podstawa = brutto − 13,71%', () => {
    expect(podstawaZasilku(7000)).toBe(6040.3);
    expect(podstawaZasilku(5652)).toBe(4877.11); // minimalna podstawa JDG 2026
  });
  it('100% / 81,5% / 70%', () => {
    expect(miesiecznie(6040.3, 100).brutto).toBe(6040.3);
    expect(miesiecznie(6040.3, 81.5).brutto).toBe(4922.84);
    expect(miesiecznie(6040.3, 70).brutto).toBe(4228.21);
    expect(miesiecznie(6040.3, 100).netto).toBe(6040.3 - 725);
    expect(miesiecznie(6040.3, 100, true).netto).toBe(6040.3 - 425);
  });
  it('minimum 1000 zł netto (mały ZUS)', () => {
    const m = miesiecznie(podstawaZasilku(1441.8), 81.5);
    expect(m.netto).toBe(1000);
    expect(m.podwyzszono).toBe(true);
    expect(m.brutto).toBeGreaterThanOrEqual(1136);
  });
  it('limity rodzicielskiego', () => {
    expect(rodzicielskiMaks(1)).toBe(32);
    expect(rodzicielskiMaks(2)).toBe(34);
  });
});

describe('harmonogram', () => {
  it('jedno dziecko, wniosek 81,5%, cały urlop mamy', () => {
    const w = obliczMacierzynski({ porod: '2026-12-01', dzieci: 1, wariant: '815', podstawaMamy: 6040.3 });
    expect(w.okresy.map((o) => [o.nazwa, o.od, o.do, o.tygodnie, o.procent])).toEqual([
      ['Urlop macierzyński', '2026-12-01', '2027-04-19', 20, 81.5],
      ['Urlop rodzicielski', '2027-04-20', '2027-11-29', 32, 81.5],
    ]);
    expect(w.razem).toBe(Math.round(4922.84 * 364 / 30 * 100) / 100);
    expect(w.terminy[0].data).toBe('2026-12-22');
  });
  it('100/70: macierzyński 100%, rodzicielski 70%; porównanie wariantów', () => {
    const w = obliczMacierzynski({ porod: '2026-12-01', dzieci: 1, wariant: '10070', podstawaMamy: 6040.3 });
    expect(w.okresy.map((o) => o.procent)).toEqual([100, 70]);
    expect(w.porownanie.wariant10070).toBeGreaterThan(w.porownanie.wariant815);
  });
  it('bliźnięta, 2 tygodnie przed porodem, tata 9 tygodni (70%) i część wspólna', () => {
    const w = obliczMacierzynski({ porod: '2026-12-15', dzieci: 2, przed: 2, wariant: '815', podstawaMamy: 5000, rodzicielskiMamy: 30, tataWspolne: 4, tata9: true, podstawaTaty: 6000 });
    expect(w.okresy[0]).toMatchObject({ od: '2026-12-01', tygodnie: 31 });
    expect(w.okresy.map((o) => [o.kto, o.tygodnie, o.procent])).toEqual([['mama', 31, 81.5], ['mama', 30, 81.5], ['tata', 4, 81.5], ['tata', 9, 70]]);
  });
  it('wcześniak: uzupełniający urlop 100%', () => {
    const w = obliczMacierzynski({ porod: '2026-12-01', dzieci: 1, wariant: '815', podstawaMamy: 5000, uzupelniajacy: 6 });
    expect(w.okresy[1]).toMatchObject({ nazwa: 'Uzupełniający urlop macierzyński', tygodnie: 6, procent: 100, od: '2027-04-20' });
  });
  it('bez rodzicielskiego przy wniosku 81,5% → wyrównanie do 100%', () => {
    const w = obliczMacierzynski({ porod: '2026-12-01', dzieci: 1, wariant: '815', podstawaMamy: 5000, rodzicielskiMamy: 0 });
    expect(w.okresy).toHaveLength(1);
    expect(w.okresy[0].procent).toBe(100);
  });
  it('błędy', () => {
    expect(obliczMacierzynski({ porod: '', dzieci: 1, wariant: '815', podstawaMamy: 5000 }).blad).toBeTruthy();
    expect(obliczMacierzynski({ porod: '2026-12-01', dzieci: 1, wariant: '815', podstawaMamy: 0 }).blad).toBeTruthy();
  });
});
