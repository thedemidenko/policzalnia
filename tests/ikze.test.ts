import { describe, expect, it } from 'vitest';
import { dlugoterminowo, pit, podatekSkala, zwrotPodatku } from '../src/lib/ikze';

const z = (forma: 'skala' | 'liniowy' | 'ryczalt', podstawa: number, wplata: number, extra: object = {}) =>
  zwrotPodatku({ rok: 2026, forma, podstawa, wplata, ...extra });

describe('IKZE – zwrot podatku', () => {
  it('skala 12%: pełny limit 11 304 zł → 1356,48 zł', () => {
    expect(z('skala', 80000, 11304).zwrot).toBe(1356.48);
  });
  it('skala 32%: 3617,28 zł, przedsiębiorca z limitem 16 956 zł – 5425,92 zł', () => {
    expect(z('skala', 200000, 11304).zwrot).toBe(3617.28);
    expect(z('skala', 200000, 16956, { dzialalnosc: true }).zwrot).toBe(5425.92);
  });
  it('dochód tuż nad progiem: część po 32%, część po 12%', () => {
    expect(z('skala', 125000, 11304).zwrot).toBe(2356.48);
  });
  it('dochód poniżej kwoty wolnej – brak zwrotu; częściowo nad – zwrot od nadwyżki', () => {
    expect(z('skala', 8000, 5400).zwrot).toBe(0);
    expect(z('skala', 35000, 11304).zwrot).toBe(600);
  });
  it('liniowy 19% i ryczałt wg stawki', () => {
    expect(z('liniowy', 200000, 16956).zwrot).toBe(3221.64);
    expect(z('ryczalt', 300000, 16956, { stawkaRyczaltu: 8.5 }).zwrot).toBe(1441.26);
  });
  it('wpłata ponad limit – nadwyżka bez odliczenia', () => {
    const w = z('skala', 200000, 15000);
    expect([w.odliczenie, w.nadwyzka]).toEqual([11304, 3696]);
  });
  it('2027: limit 12 039,60 zł, skala do czasu decyzji – bez zmian (flaga)', () => {
    const w = zwrotPodatku({ rok: 2027, forma: 'skala', podstawa: 200000, wplata: 12039.6 });
    expect(w.zwrot).toBe(3852.67);
    expect(pit(2027).progi[0].do).toBe(120000);
  });
  it('podatek według skali', () => {
    const p = pit(2026);
    expect([podatekSkala(30000, p), podatekSkala(120000, p), podatekSkala(130000, p)]).toEqual([0, 10800, 14000]);
  });
});

describe('IKZE – do 65 lat', () => {
  const baza = { wplata: 11304, lata: 25, stopa: 6 } as const;
  it('wydany zwrot: IKZE daje mniej niż IKE', () => {
    const w = dlugoterminowo({ ...baza, stawkaZwrotu: 0.12, zwrot: 'wydaje' });
    expect(w.razem).toBeLessThan(w.ike);
    expect(w.ikzeNetto).toBeCloseTo(w.ikze * 0.9, 6);
  });
  it('zwrot na IKE: przy 12% remis, przy 32% IKZE wygrywa', () => {
    const a = dlugoterminowo({ ...baza, stawkaZwrotu: 0.12, zwrot: 'ike' });
    expect(Math.abs(a.razem - a.ike) / a.ike).toBeLessThan(0.02);
    const b = dlugoterminowo({ ...baza, stawkaZwrotu: 0.32, zwrot: 'ike' });
    expect(b.razem).toBeGreaterThan(b.ike * 1.15);
  });
  it('zwrot inwestowany na IKE daje więcej niż na zwykłym koncie', () => {
    expect(dlugoterminowo({ ...baza, stawkaZwrotu: 0.32, zwrot: 'ike' }).razem).toBeGreaterThan(dlugoterminowo({ ...baza, stawkaZwrotu: 0.32, zwrot: 'konto' }).razem);
  });
});
