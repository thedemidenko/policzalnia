# Stawki 2026/2027 – źródła i statusy (stan na 23.11.2026)

Wartości liczbowe są w `src/data/stawki.json` i `src/data/stopy-nbp.json`. Tutaj: skąd je wzięliśmy i co jeszcze czeka.

Status: **OBOW** obowiązuje · **OGL** ogłoszone · **USTAWA** uchwalona, czeka na podpis · **PROJ** projekt · **WZOR** wyliczone ze wzoru · **NIEZNANE**.

## Płaca minimalna, prognozowane przeciętne, 30-krotność
| | 2026 | 2027 | Źródło |
|---|---|---|---|
| Płaca minimalna | 4 806 | 4 950 (OGL) | Dz.U. 2026 poz. 1213 – https://eli.gov.pl/eli/DU/2026/1213 |
| Stawka godzinowa | 31,40 | 32,30 (OGL) | jw. |
| Prognozowane przeciętne | 9 420 | 10 033 (OGL) | M.P. 2026 poz. 1098 – https://eli.gov.pl/api/acts/MP/2026/1098/text/I/M20261098.pdf |
| Podstawa ZUS JDG (60%) | 5 652,00 | 6 019,80 (WZOR) | art. 18 ust. 8 ustawy o sus |
| Limit 30-krotności | 282 600 | 300 990 (OGL) | M.P. 2026 poz. 1098 |

Duży ZUS JDG (społeczne + FP): 2026 = 1 926,76 zł; 2027 = 2 052,15 zł (bez chorobowej 1 904,66).
Preferencyjny / Mały ZUS Plus min. podstawa (30% płacy min.): 1 441,80 → 1 485,00 zł. Mały ZUS Plus max. podstawa = 60% prognozowanego. Limit przychodu 120 000 zł.

## Składki (bez zmian)
Emerytalna 9,76+9,76 · rentowa 1,5+6,5 · chorobowa 2,45 (pracownik) · wypadkowa domyślna 1,67 (IV 2026 – III 2027) · FP 2,45 · FGŚP 0,10 · zdrowotna 9% (podstawa: brutto − społeczne pracownika, nieodliczalna) · PPK 2% + 1,5%.

## Składka zdrowotna JDG
Reforma obniżająca – zawetowana (https://www.gazetaprawna.pl/podatki/artykuly/10785884). Od 2026 minimum = 9% × 100% płacy minimalnej (432,54 zł; od II 2027: 445,50 zł – WZOR). Liniowy 4,9%, limit odliczenia 2026: 14 100 zł (2027 NIEZNANE). Ryczałt: podstawa = przeciętne wynagrodzenie IV kw. poprzedniego roku – 2026: 9 228,64 zł (498,35 / 830,58 / 1 495,04 zł); od II 2027 NIEZNANE (GUS ok. 20–22.01.2027).

## PIT
2026: 12% do 120 000, 32% powyżej; kwota zmniejszająca 3 600; liniowy 19%; KUP 250/300 zł; ulga dla młodych 85 528; danina 4% > 1 mln.

**2027 – USTAWA z 5.11.2026 czeka na prezydenta (termin 27.11.2026):** 12% do 130 000, 24% 130–150 tys., 32% > 150 tys.; danina 5%; ryczałt – limit 250 tys. EUR. Przy wecie zostaje 12/32 i 120 000. W `stawki.json` oba warianty, `wariant: "do_decyzji"` – **po 27.11 ustawić**.
Źródła: https://takitax.pl/sejm-ponownie-uchwalil-pit-ryczalt-2027/ · https://spectax.pl/aktualnosci/zmiany-pit-ryczalt-2027-podpis-czy-weto/

## Odsetki
- Ustawowe kapitałowe (art. 359 § 2 KC) = ref + 3,5 pp → od 5.03.2026: 7,25%.
- Ustawowe za opóźnienie (art. 481 § 2 KC) = ref + 5,5 pp → 9,25% (M.P. 2026 poz. 367).
- Transakcje handlowe = ref z 1.01/1.07 + 10 pp (+8 pp podmiot leczniczy) → od 1.07.2026: 13,75% / 11,75%.
- Zaległości podatkowe (art. 56 OP) = 200% lombardowej + 2 pp, min. 8%; obniżona 50%, podwyższona 150% → od 5.03.2026: 10,50 / 5,25 / 15,75.
- Historia stóp: https://static.nbp.pl/dane/stopy/stopy_procentowe_archiwum.xml. RPP: posiedzenie 1–2.12.2026.

## Delegacje krajowe
Dieta 45 zł (<8 h 0; 8–12 h 50%; >12 h 100%; śniadanie −25%, obiad −50%, kolacja −25%), nocleg ryczałt 67,50, hotel limit 900, dojazdy 9 zł/doba, kilometrówka 0,89 / 1,15 / 0,69 / 0,42. **PROJ:** 60 / 90 / 12 zł od 1.01.2027 – nieogłoszone na 19.11.2026.

## Zasiłek chorobowy
80% / 100% / 70%; pracodawca 33 dni (50+: 14 dni). Od 1.01.2027 jeden okres zasiłkowy dla wszystkich tytułów (Dz.U. 2026 poz. 26).

## Staż pracy
Dz.U. 2025 poz. 1423: zlecenia, JDG, agencyjne wliczane do stażu – od 1.01.2026 sektor publiczny, od 1.05.2026 pozostali; wymagane zaświadczenie ZUS.

## Do sprawdzenia
1. PIT 2027 – decyzja prezydenta do 27.11.2026.
2. Limit 50% KUP (prawa autorskie) przy nowej skali – 120 czy 130 tys.
3. Zdrowotna ryczałt od II 2027 – GUS w styczniu.
4. Limit odliczenia zdrowotnej (liniowy) 2027 – MF w grudniu.
5. Dieta 60 zł – Dz.U. w grudniu.
6. Stawka wypadkowa od 1.04.2027.
7. RPP 1–2.12.2026.
8. Numer Dz.U. płacy minimalnej 2026 (2025 poz. 1242) – niezweryfikowany.
