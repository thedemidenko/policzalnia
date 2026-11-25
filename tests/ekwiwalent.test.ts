import { describe, expect, it } from 'vitest';
import { dniPracyWRoku, obliczEkwiwalent, wspolczynnik } from '../src/lib/ekwiwalent';

describe('współczynnik urlopowy', () => {
  it('zgodny z publikowanymi wartościami', () => {
    expect(dniPracyWRoku(2026)).toBe(251);
    expect(wspolczynnik(2026)).toBe(20.92);
    expect(wspolczynnik(2025)).toBe(20.75);
    expect(wspolczynnik(2023)).toBe(20.83);
  });
  it('niepełny etat', () => {
    expect(wspolczynnik(2026, 0.5)).toBe(10.46);
    expect(wspolczynnik(2026, 0.75)).toBe(15.69);
    expect(wspolczynnik(2026, 0.25)).toBe(5.23);
  });
});

describe('obliczEkwiwalent', () => {
  it('płaca minimalna, 5 dni', () => {
    const w = obliczEkwiwalent({ koniec: '2026-11-30', stale: 4806, tryb: 'dni', dni: 5 });
    expect(w.zaDzien).toBe(229.73);
    expect(w.zaGodzine).toBe(28.72);
    expect(w.ekwiwalent).toBe(1148.8);
  });
  it('składniki zmienne i premia roczna', () => {
    const w = obliczEkwiwalent({ koniec: '2026-11-30', stale: 6000, zmienne: 800, premie12: 6000, tryb: 'dni', dni: 3 });
    expect(w.podstawa).toBe(7300);
    expect(w.zaDzien).toBe(348.95);
    expect(w.zaGodzine).toBe(43.62);
    expect(w.ekwiwalent).toBe(1046.88);
  });
  it('dni liczone z urlopu proporcjonalnego', () => {
    // odejście 31 sierpnia, 26 dni: 8/12 × 26 = 17,33 → 18; zaległe 2, wykorzystane 10 → 10 dni
    const w = obliczEkwiwalent({ koniec: '2026-08-31', stale: 8000, tryb: 'policz', dziesiecLat: true, zalegly: 2, wykorzystany: 10 });
    expect(w.wymiarWRoku).toBe(18);
    expect(w.dni).toBe(10);
    expect(w.godziny).toBe(80);
  });
  it('pół etatu: ta sama stawka godzinowa co pełny etat przy połowie pensji', () => {
    const p = obliczEkwiwalent({ koniec: '2026-11-30', stale: 6000, tryb: 'dni', dni: 1 });
    const h = obliczEkwiwalent({ koniec: '2026-11-30', stale: 3000, etat: 0.5, tryb: 'dni', dni: 1 });
    expect(h.zaGodzine).toBe(p.zaGodzine);
  });
  it('błędy', () => {
    expect(obliczEkwiwalent({ koniec: '', stale: 5000, tryb: 'dni' }).blad).toBeTruthy();
    expect(obliczEkwiwalent({ koniec: '2026-11-30', stale: 0, tryb: 'dni' }).blad).toBeTruthy();
  });
});
