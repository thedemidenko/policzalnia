import { describe, expect, it } from 'vitest';
import { noceRyczaltowe, obliczDelegacje, stawkaDiety, stawkaKm } from '../src/lib/delegacja';

const t = (s: string) => Date.UTC(+s.slice(0, 4), +s.slice(5, 7) - 1, +s.slice(8, 10), +s.slice(11, 13), +s.slice(14, 16));

describe('stawki', () => {
  it('dieta 45 zł od 2023, 38 zł od 28.07.2022, wcześniej 30 zł; projekt 60 zł nie jest stosowany', () => {
    expect(stawkaDiety('2026-11-24')).toBe(45);
    expect(stawkaDiety('2022-12-31')).toBe(38);
    expect(stawkaDiety('2022-07-27')).toBe(30);
    expect(stawkaDiety('2027-02-01')).toBe(45);
    expect(stawkaKm('pow900', '2026-11-24')).toBe(1.15);
    expect(stawkaKm('do900', '2026-11-24')).toBe(0.89);
  });
});

describe('dieta', () => {
  it('podróż do doby: < 8 h, 8–12 h, > 12 h', () => {
    expect(obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-24T15:59' }).dieta).toBe(0);
    expect(obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-24T18:00' }).dieta).toBe(22.5);
    expect(obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-24T20:01' }).dieta).toBe(45);
    expect(obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-25T08:00' }).dieta).toBe(45);
  });
  it('32 godziny ze śniadaniem: 45 + 22,50 − 11,25 = 56,25', () => {
    const w = obliczDelegacje({ wyjazd: '2026-11-24T06:00', powrot: '2026-11-25T14:00', sniadania: 1 });
    expect(w.diety).toBe(1.5);
    expect(w.dieta).toBe(56.25);
  });
  it('61 godzin: 2 doby + 13 h → 3 diety', () => {
    expect(obliczDelegacje({ wyjazd: '2026-11-23T07:00', powrot: '2026-11-25T20:00' }).dieta).toBe(135);
  });
  it('posiłki nie obniżają diety poniżej zera; potrącenie od pełnej diety', () => {
    const w = obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-24T18:00', obiady: 1, kolacje: 1 });
    expect(w.dieta).toBe(0);
  });
});

describe('noclegi i ryczałty', () => {
  it('noce z co najmniej 6 h między 21 a 7', () => {
    expect(noceRyczaltowe(t('2026-11-24T06:00'), t('2026-11-25T14:00'))).toBe(1);
    expect(noceRyczaltowe(t('2026-11-23T07:00'), t('2026-11-25T20:00'))).toBe(2);
    expect(noceRyczaltowe(t('2026-11-24T23:00'), t('2026-11-25T05:00'))).toBe(1);
    expect(noceRyczaltowe(t('2026-11-24T23:30'), t('2026-11-25T05:00'))).toBe(0);
  });
  it('ryczałt za nocleg 67,50 zł i komunikacja 9 zł za rozpoczętą dobę', () => {
    const w = obliczDelegacje({ wyjazd: '2026-11-24T06:00', powrot: '2026-11-25T14:00', nocleg: 'ryczalt', komunikacja: true });
    expect(w.pozycje.find((p) => p.nazwa === 'Ryczałt za nocleg')?.kwota).toBe(67.5);
    expect(w.pozycje.find((p) => p.nazwa.startsWith('Ryczałt na'))?.kwota).toBe(18);
    expect(w.razem).toBe(67.5 + 67.5 + 18);
  });
  it('hotel ponad limit 900 zł za dobę', () => {
    const w = obliczDelegacje({ wyjazd: '2026-11-23T07:00', powrot: '2026-11-25T20:00', nocleg: 'hotel', hotelKwota: 2000 });
    expect(w.pozycje.find((p) => p.nazwa.startsWith('Hotel'))?.kwota).toBe(1800);
    expect(w.uwagi.some((u) => u.includes('200,00 zł'))).toBe(true);
  });
});

describe('przejazd, zaliczka, regulamin firmy', () => {
  it('kilometrówka i zaliczka', () => {
    const w = obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-24T18:00', pojazd: 'pow900', km: 250, inne: 30, zaliczka: 400 });
    expect(w.pozycje.find((p) => p.nazwa === 'Samochód prywatny')?.kwota).toBe(287.5);
    expect(w.razem).toBe(22.5 + 287.5 + 30);
    expect(w.doWyplaty).toBe(-60);
  });
  it('wyższa dieta w regulaminie: nadwyżka podlega PIT i ZUS', () => {
    const w = obliczDelegacje({ wyjazd: '2026-11-23T07:00', powrot: '2026-11-25T20:00', dietaFirmy: 60 });
    expect(w.dieta).toBe(180);
    expect(w.nadwyzka).toBe(45);
  });
  it('błędy', () => {
    expect(obliczDelegacje({ wyjazd: '', powrot: '' }).blad).toBeTruthy();
    expect(obliczDelegacje({ wyjazd: '2026-11-24T08:00', powrot: '2026-11-24T07:00' }).blad).toBeTruthy();
  });
});
