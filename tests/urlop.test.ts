import { describe, expect, it } from 'vitest';
import { obliczUrlop, rocznyWymiar } from '../src/lib/urlop';

describe('roczny wymiar (art. 154)', () => {
  it('etat i zaokrąglenie w górę', () => {
    expect(rocznyWymiar(20, 1)).toBe(20);
    expect(rocznyWymiar(26, 0.5)).toBe(13);
    expect(rocznyWymiar(26, 0.75)).toBe(20); // 19,5 → 20
    expect(rocznyWymiar(20, 0.25)).toBe(5);
    expect(rocznyWymiar(26, 7 / 8)).toBe(23); // 22,75 → 23
  });
});

describe('obliczUrlop', () => {
  it('cały rok', () => {
    const w = obliczUrlop({ rok: 2026, tryb: 'caly', dziesiecLat: true });
    expect(w.dni).toBe(26);
    expect(w.godziny).toBe(208);
    expect(obliczUrlop({ rok: 2026, tryb: 'caly', etat: 0.5 }).godziny).toBe(80);
  });
  it('nowy pracodawca od połowy lipca: 6/12', () => {
    expect(obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', od: '2026-07-15' }).dni).toBe(10);
  });
  it('zmiana pracodawcy w tym samym miesiącu – miesiąc zaokrągla stary pracodawca', () => {
    const w = obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', od: '2026-07-15', tenSamMiesiac: true });
    expect(w.etapy[0].miesiace).toBe(5);
    expect(w.dni).toBe(9); // 20 × 5/12 = 8,33 → 9
  });
  it('odejście w marcu przy 26 dniach: 3/12 → 6,5 → 7', () => {
    expect(obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', do: '2026-03-10', dziesiecLat: true }).dni).toBe(7);
    expect(obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', do: '2026-07-01', dziesiecLat: true }).dni).toBe(16); // 7/12 × 26 = 15,17
  });
  it('pół etatu, 5 miesięcy: 13 × 5/12 = 5,42 → 6', () => {
    expect(obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', od: '2026-08-03', etat: 0.5, dziesiecLat: true }).dni).toBe(6);
  });
  it('pierwsza praca: 1/12 po każdym miesiącu, bez zaokrągleń', () => {
    const w = obliczUrlop({ rok: 2026, tryb: 'pierwsza', od: '2026-03-15' });
    expect(w.narastanie[0]).toEqual({ po: '2026-04-14', dni: 1.67, godziny: 13.33 });
    expect(w.narastanie).toHaveLength(9);
    expect(w.dni).toBe(15);
    expect(obliczUrlop({ rok: 2026, tryb: 'pierwsza', od: '2026-07-01' }).dni).toBe(10);
    const k = obliczUrlop({ rok: 2026, tryb: 'pierwsza', od: '2026-02-01' });
    expect(k.dni).toBe(18.33);
    expect(k.godziny).toBe(146.67);
  });
  it('zmiana etatu w trakcie roku', () => {
    expect(obliczUrlop({ rok: 2026, tryb: 'caly', etat: 1, zmianaEtatu: { od: '2026-07-01', etat: 0.5 } }).dni).toBe(15);
    const w = obliczUrlop({ rok: 2026, tryb: 'caly', etat: 1, zmianaEtatu: { od: '2026-07-20', etat: 0.5 } });
    expect(w.etapy.map((e) => [e.miesiace, e.dni])).toEqual([[7, 12], [5, 5]]);
    expect(w.dni).toBe(17);
  });
  it('10 lat stażu w trakcie roku → 26 dni', () => {
    expect(obliczUrlop({ rok: 2026, tryb: 'caly', dataDziesieciu: '2026-06-10' }).dni).toBe(26);
    expect(obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', do: '2026-05-31', dataDziesieciu: '2026-06-10' }).dni).toBe(9); // 20 × 5/12
  });
  it('bilans z urlopem zaległym', () => {
    const w = obliczUrlop({ rok: 2026, tryb: 'caly', zalegly: 5, wykorzystany: 12 });
    expect(w.pozostalo).toBe(13);
    expect(w.uwagi.some((u) => u.includes('30 września'))).toBe(true);
  });
  it('błędy', () => {
    expect(obliczUrlop({ rok: 2026, tryb: 'pierwsza' }).blad).toBeTruthy();
    expect(obliczUrlop({ rok: 2026, tryb: 'pierwsza', od: '2025-05-01' }).blad).toMatch(/pełny wymiar/);
    expect(obliczUrlop({ rok: 2026, tryb: 'proporcjonalny', od: '2026-08-01', do: '2026-07-01' }).blad).toBeTruthy();
  });
});
