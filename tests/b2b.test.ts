import { describe, expect, it } from 'vitest';
import { obliczB2B, obliczUoP, progOplacalnosci } from '../src/lib/b2b';

const pelnyBez = { rok: 2026, etap: 'pelny' as const, chorobowe: false };

describe('B2B – faktura 22 000 zł, pełny ZUS bez chorobowej, bez kosztów (porównanie z finwire.pl)', () => {
  it('liniowy: 15 569,26 zł miesięcznie (finwire: ok. 15 570 zł)', () => {
    expect(obliczB2B({ ...pelnyBez, faktura: 22000, forma: 'liniowy' }).naRekeMies).toBe(15569.26);
  });
  it('skala: 14 224,91 zł (finwire: ok. 14 225 zł)', () => {
    expect(obliczB2B({ ...pelnyBez, faktura: 22000, forma: 'skala' }).naRekeMies).toBe(14224.91);
  });
  it('ryczałt 12%: 16 988,96 zł – Funduszu Pracy nie odlicza się od przychodu (art. 11 ust. 1 ustawy o ryczałcie); finwire odlicza go i podaje 17 005 zł', () => {
    const r = obliczB2B({ ...pelnyBez, faktura: 22000, forma: 'ryczalt', stawkaRyczaltu: 12 });
    expect(r.naRekeMies).toBe(16988.96);
    // zdrowotna za rok z dopłatą: przychód po składkach przekracza 60 000 zł w marcu – rocznie 12 × 830,58 zł
    expect(r.zdrowotna).toBe(9966.96);
    expect(r.podatek).toBe(28706);
  });
});

describe('etat i próg opłacalności', () => {
  it('etat 10 000 zł brutto: 7147,39 zł na rękę, koszt pracodawcy 12 048 zł', () => {
    const u = obliczUoP({ rok: 2026, brutto: 10000 });
    expect(u.naRekeMies).toBe(7147.39);
    expect(u.kosztMies).toBe(12048);
  });
  it('próg: najniższa faktura, przy której B2B daje rocznie co najmniej tyle co etat', () => {
    const u = obliczUoP({ rok: 2026, brutto: 10000 });
    const x = { rok: 2026, forma: 'liniowy' as const, etap: 'pelny' as const, chorobowe: true, koszty: 300 };
    const k = progOplacalnosci(u.naReke, x);
    expect(obliczB2B({ ...x, faktura: k }).naReke).toBeGreaterThanOrEqual(u.naReke);
    expect(obliczB2B({ ...x, faktura: k - 1 }).naReke).toBeLessThan(u.naReke);
  });
  it('dni bez faktury zmniejszają przychód proporcjonalnie do dni roboczych (2026: 251 dni)', () => {
    const r = obliczB2B({ ...pelnyBez, faktura: 12048, forma: 'liniowy', dniBezFaktury: 26 });
    expect(r.przychod).toBe(Math.round(12048 * 12 * (1 - 26 / 251) * 100) / 100);
  });
  it('preferencyjny ZUS: bez Funduszu Pracy, emerytalna od 1441,80 zł', () => {
    const r = obliczB2B({ rok: 2026, faktura: 12000, forma: 'ryczalt', stawkaRyczaltu: 12, etap: 'pref' });
    expect(r.fp).toBe(0);
    expect(r.emerytalna).toBe(Math.round(12 * 281.44 * 100) / 100);
  });
});
