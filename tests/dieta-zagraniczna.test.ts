import { describe, expect, it } from 'vitest';
import { KRAJE, dietyKrajowe, dietyZagraniczne, kraj, obliczDieteZagraniczna } from '../src/lib/dieta-zagraniczna';
import { stawkaDiety } from '../src/lib/delegacja';

const kw = (w: ReturnType<typeof obliczDieteZagraniczna>, i = 0) => Object.fromEntries(w.etapy[i].pozycje.map((p) => [p.nazwa, p.kwota]));

describe('dieta zagraniczna – stawki i liczba diet', () => {
  it('tabela z Dz.U. 2022 poz. 2302: 114 państw + wyjątki', () => {
    expect(KRAJE).toHaveLength(120);
    expect([kraj('niemcy')?.dieta, kraj('niemcy')?.limit, kraj('francja')?.dieta, kraj('wielka-brytania')?.waluta, kraj('japonia')?.dieta, kraj('usa-nowy-jork')?.limit, kraj('inne')?.dieta])
      .toEqual([49, 170, 55, 'GBP', 7532, 350, 41]);
  });
  it('niepełna doba: do 8 h 1/3, ponad 8 do 12 h 50%, ponad 12 h 100% – także przy krótkim wyjeździe', () => {
    expect(dietyZagraniczne(5).diety).toBeCloseTo(1 / 3);
    expect(dietyZagraniczne(8).diety).toBeCloseTo(1 / 3);
    expect(dietyZagraniczne(10).diety).toBe(0.5);
    expect(dietyZagraniczne(12).diety).toBe(0.5);
    expect(dietyZagraniczne(12.5).diety).toBe(1);
    expect(dietyZagraniczne(32).diety).toBeCloseTo(4 / 3);
    expect(dietyZagraniczne(62).diety).toBe(3);
  });
  it('dieta krajowa za odcinki w Polsce: < 8 h nic, 8–12 h 50%, ponad 12 h 100%; 38 zł od 28.07.2022', () => {
    expect([dietyKrajowe(7.9), dietyKrajowe(8), dietyKrajowe(12), dietyKrajowe(13), dietyKrajowe(30)]).toEqual([0, 0.5, 0.5, 1, 1.5]);
    expect([stawkaDiety('2022-07-27'), stawkaDiety('2022-07-28'), stawkaDiety('2023-01-01')]).toEqual([30, 38, 45]);
  });
});

describe('rozliczenie podróży', () => {
  const baza = { granica: '2026-11-10T06:00', powrotGranica: '2026-11-12T20:00' };
  it('Niemcy 62 h, hotel 2 noce, ryczałty, kurs', () => {
    const w = obliczDieteZagraniczna({ ...baza, etapy: [{ kraj: 'niemcy', sniadania: 2, nocleg: 'rachunek', rachunek: 300 }], kursy: { EUR: 4.25 } });
    expect(kw(w)).toEqual({ Dieta: 147, 'Zapewnione posiłki': -14.7, 'Hotel (rachunek)': 300, 'Ryczałt na dojazd z i do dworca / lotniska': 49, 'Ryczałt na komunikację miejscową': 14.7 });
    expect(w.waluty).toEqual({ EUR: 496 });
    expect(w.pln).toBe(2108);
    expect(w.etapy[0].noceDomyslne).toBe(2);
  });
  it('hotel ponad limit – zwrot do limitu; bez rachunku ryczałt 25% limitu', () => {
    const a = obliczDieteZagraniczna({ ...baza, etapy: [{ kraj: 'niemcy', rachunek: 400 }], dojazdy: 'brak', komunikacja: false });
    expect(kw(a)['Hotel (rachunek)']).toBe(340);
    expect(a.uwagi.some((u) => u.includes('przekracza limit o 60,00 EUR'))).toBe(true);
    const b = obliczDieteZagraniczna({ ...baza, etapy: [{ kraj: 'niemcy', nocleg: 'ryczalt' }], dojazdy: 'brak', komunikacja: false });
    expect(kw(b)['Ryczałt za nocleg']).toBe(85);
  });
  it('samochód – bez ryczałtów na dojazdy i komunikację', () => {
    const w = obliczDieteZagraniczna({ ...baza, etapy: [{ kraj: 'czechy', nocleg: 'zapewniony' }], samochod: true });
    expect(kw(w)).toEqual({ Dieta: 123 });
  });
  it('kilka państw docelowych – Francja i Hiszpania osobno (przykład podatki.biz)', () => {
    const w = obliczDieteZagraniczna({ granica: '2026-05-27T13:00', etapy: [{ kraj: 'francja', nocleg: 'zapewniony' }, { kraj: 'hiszpania', od: '2026-05-28T14:00', nocleg: 'zapewniony' }], powrotGranica: '2026-05-29T17:00', dojazdy: 'brak', komunikacja: false });
    expect(w.etapy.map((e) => [e.godziny, kw(w, w.etapy.indexOf(e)).Dieta])).toEqual([[25, 73.33], [27, 66.67]]);
  });
  it('odcinki krajowe: osobno (stanowisko MRPiPS) albo łącznie', () => {
    const x = { wyjazd: '2026-11-10T01:00', ...baza, powrot: '2026-11-13T01:00', etapy: [{ kraj: 'niemcy', nocleg: 'zapewniony' as const }] };
    expect(obliczDieteZagraniczna(x).krajowa?.kwota).toBe(0);
    expect(obliczDieteZagraniczna({ ...x, krajoweLacznie: true }).krajowa?.kwota).toBe(22.5);
  });
  it('zaliczka w walucie – do wypłaty w euro i złotych', () => {
    const w = obliczDieteZagraniczna({ ...baza, etapy: [{ kraj: 'niemcy', nocleg: 'ryczalt' }], kursy: { EUR: 4.2 }, zaliczka: { kwota: 200, waluta: 'EUR' } });
    expect(w.doWyplatyWal).toEqual({ kwota: 95.7, waluta: 'EUR' });
    expect(w.doWyplatyPln).toBe(401.94);
  });
  it('błędy i stawki sprzed 29.11.2022', () => {
    expect(obliczDieteZagraniczna({ granica: '2022-11-20T08:00', powrotGranica: '2022-11-22T08:00', etapy: [{ kraj: 'niemcy' }] }).blad).toMatch(/29\.11\.2022/);
    expect(obliczDieteZagraniczna({ ...baza, powrotGranica: '2026-11-09T08:00', etapy: [{ kraj: 'niemcy' }] }).blad).toBeTruthy();
  });
});
