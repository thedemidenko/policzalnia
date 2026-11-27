---
slug: kalkulator-vat
sekcja: firma
title: Kalkulator VAT 2026 - netto, brutto i kwota VAT, także dla faktury
nazwa_krotka: Kalkulator VAT
meta_title: "Kalkulator VAT 2026 - netto brutto, 23% 8% 5% | Policzalnia"
meta_description: "Przelicz netto na brutto i odwrotnie, wylicz VAT z kwoty brutto. Faktura z kilkoma stawkami, VAT w walucie po kursie NBP i kwota słownie."
kalkulator: vat
lead: Wpisz kwotę netto, brutto albo samą kwotę VAT i wybierz stawkę – resztę policzymy od razu. Możesz też podliczyć całą fakturę z kilkoma stawkami, przeliczyć VAT z faktury w euro po kursie NBP i skopiować kwotę słownie.
faq:
  - pytanie: Jak obliczyć VAT od kwoty brutto?
    odpowiedz: Pomnóż brutto przez stawkę i podziel przez 100 plus stawka – przy 23% to brutto × 23/123. Z 1230 zł brutto VAT wynosi 230 zł, a netto 1000 zł. Błędem jest liczenie 23% od brutto – wyszłoby 282,90 zł.
  - pytanie: Jak obliczyć brutto z netto?
    odpowiedz: Pomnóż netto przez 1 plus stawka VAT – przy 23% przez 1,23, przy 8% przez 1,08, przy 5% przez 1,05. Z 1000 zł netto przy 23% wychodzi 1230 zł brutto.
  - pytanie: Jakie są stawki VAT w 2026 roku?
    odpowiedz: Podstawowa 23%, obniżone 8% i 5% oraz 0% (głównie eksport i dostawy do innych krajów UE). Część sprzedaży jest zwolniona z VAT (zw). W 2026 r. stawki się nie zmieniły – prezydent zawetował w listopadzie podwyżkę VAT na niektóre napoje.
  - pytanie: Ile wynosi limit zwolnienia z VAT w 2026 roku?
    odpowiedz: 240 000 zł sprzedaży w roku (do 2025 r. 200 000 zł). Przedsiębiorca, który go nie przekracza, może nie płacić VAT. Zwolnienie nie dotyczy m.in. usług prawniczych, doradczych, jubilerskich i sprzedaży niektórych towarów.
  - pytanie: Czy na fakturze trzeba podawać kwotę słownie?
    odpowiedz: Nie – od 2014 r. przepisy tego nie wymagają. Kwotę słownie wpisuje się zwykle w umowach, rachunkach, poleceniach przelewu albo dokumentach kasowych, dlatego kalkulator ją podaje.
  - pytanie: Czy VAT liczy się od każdej pozycji faktury, czy od sumy?
    odpowiedz: Ustawa wymaga podania na fakturze sumy wartości netto i kwoty VAT w podziale na stawki, dlatego najczęściej VAT liczy się od sumy w każdej stawce. Liczenie przy każdej pozycji też jest dopuszczalne – różnica wynosi najwyżej kilka groszy, ważne, by stosować jedną metodę konsekwentnie.
  - pytanie: Po jakim kursie przeliczyć VAT z faktury w euro?
    odpowiedz: Po kursie średnim NBP z ostatniego dnia roboczego przed dniem powstania obowiązku podatkowego (art. 31a ustawy o VAT). Kalkulator pobiera ten kurs automatycznie z NBP.
  - pytanie: Jak zaokrąglać VAT?
    odpowiedz: Na fakturze do pełnych groszy – końcówki poniżej pół grosza pomija się, od pół grosza zaokrągla w górę. W deklaracji (JPK_V7) kwoty podatku zaokrągla się już do pełnych złotych.
powiazane:
  - odsetki-podatkowe
  - umowa-o-dzielo
  - umowa-zlecenie
  - ryczalt
zrodla:
  - nazwa: Ustawa o podatku od towarów i usług – art. 31a, 41, 43, 106e, 113 (ISAP)
    url: https://isap.sejm.gov.pl/isap.nsf/DocDetails.xsp?id=WDU20040540535
  - nazwa: NBP – API kursów walut (kurs średni z tabeli A)
    url: https://api.nbp.pl/
  - nazwa: podatki.gov.pl – stawki VAT
    url: https://www.podatki.gov.pl/vat/
autor: redakcja
updated: 2026-11-25
draft: false
---

## Jak działa kalkulator VAT?

Kalkulator ma dwa tryby:

- **Jedna kwota** – wpisz netto, brutto albo samą **kwotę VAT** i wybierz stawkę. Pozostałe wartości policzymy z dokładnością do grosza.
- **Faktura z pozycjami** – wpisz ceny, ilości i stawki (także zw i np), a kalkulator zrobi podsumowanie według stawek, tak jak na fakturze. Możesz wybrać, czy VAT liczyć od sumy w stawce, czy przy każdej pozycji – i od razu zobaczysz, czy metody dają inny wynik.

W sekcji **„Faktura w walucie obcej”** wybierz walutę i datę obowiązku podatkowego – kurs NBP pobierze się sam, a kalkulator pokaże VAT i brutto w złotych. Pod wynikiem znajdziesz **kwotę słownie**, przydatną do umów i przelewów.

## Jakie są stawki VAT w 2026 roku?

| Stawka | Co obejmuje (przykłady) |
| --- | --- |
| **23%** | większość towarów i usług – stawka podstawowa |
| **8%** | usługi gastronomiczne i hotelowe, budownictwo mieszkaniowe objęte społecznym programem, dostawa wody, leki i wyroby medyczne, przewóz osób, część przetworzonej żywności |
| **5%** | podstawowa żywność (pieczywo, nabiał, mięso, owoce, warzywa), książki i e-booki, prasa, artykuły dla niemowląt |
| **0%** | eksport, dostawy do firm w innych krajach UE (WDT), niektóre usługi transportu międzynarodowego |
| **zw** | usługi zwolnione z VAT – m.in. medyczne, edukacyjne, finansowe, najem mieszkania na cele mieszkaniowe |
| **np** | czynności niepodlegające VAT w Polsce, np. usługi, których miejscem świadczenia jest inny kraj |

Stawki nie zmieniły się w 2026 r. Ustawa podnosząca VAT do 23% na napoje z sokiem, energetyki i piwo bezalkoholowe została zawetowana przez prezydenta 18 listopada 2026 r.

## Jak obliczyć VAT – wzory

| Znasz | Szukasz | Wzór (stawka 23%) |
| --- | --- | --- |
| netto | brutto | netto × 1,23 |
| netto | VAT | netto × 0,23 |
| brutto | netto | brutto ÷ 1,23 |
| brutto | VAT | brutto × 23 ÷ 123 |
| kwotę VAT | netto | VAT ÷ 0,23 |

Przy stawce 8% zamień 1,23 na 1,08, a 23/123 na 8/108. Przy 5% – na 1,05 i 5/105.

**Przykład 1.** Usługa za 1000 zł netto: VAT 230 zł, brutto **1230 zł**.

**Przykład 2.** Cena w sklepie 100 zł brutto przy 8%: VAT = 100 × 8 ÷ 108 = **7,41 zł**, netto 92,59 zł.

**Przykład 3.** Na paragonie widzisz tylko VAT 46 zł przy 23% – netto to 46 ÷ 0,23 = **200 zł**, a brutto 246 zł.

## VAT od sumy czy od każdej pozycji faktury?

Faktura musi zawierać **sumę wartości sprzedaży netto i kwotę podatku w podziale na stawki** (art. 106e ust. 1 pkt 14). Najczęściej VAT liczy się więc od sumy netto w każdej stawce. Dopuszczalne jest też liczenie VAT przy każdej pozycji i ich sumowanie – przez zaokrąglenia wyniki mogą się różnić o grosze.

**Przykład 4.** Trzy pozycje po 0,99 zł netto ze stawką 23%:

- VAT od sumy: 2,97 zł × 23% = 0,6831, czyli **0,68 zł**,
- VAT przy każdej pozycji: 3 × 0,23 zł = **0,69 zł**.

Obie faktury są poprawne. Ważne, by w firmie stosować jedną metodę konsekwentnie – kalkulator pokazuje różnicę między nimi.

Kwoty na fakturze zaokrągla się do **pełnych groszy** (końcówki poniżej 0,5 grosza pomija się). W deklaracji JPK_V7 kwoty VAT podaje się już w **pełnych złotych**.

## Jak przeliczyć VAT z faktury w walucie?

Jeśli faktura jest w euro, dolarach czy innej walucie, VAT przelicza się na złote po **kursie średnim NBP z ostatniego dnia roboczego przed dniem powstania obowiązku podatkowego** (art. 31a ustawy o VAT). Zwykle obowiązek podatkowy powstaje w dniu dostawy towaru albo wykonania usługi.

**Przykład 5.** Faktura na 1000 EUR netto + 23% VAT (230 EUR), usługa wykonana w czwartek. Bierzemy kurs ze środy – np. 4,2500 zł. VAT w złotych: 230 × 4,25 = **977,50 zł**. Kalkulator pobierze właściwy kurs sam, po wpisaniu daty.

## Kiedy nie trzeba płacić VAT – limit 240 000 zł

Od 1 stycznia 2026 r. **limit zwolnienia podmiotowego wynosi 240 000 zł** sprzedaży w roku (wcześniej 200 000 zł). Firma, która go nie przekracza, może być „zwolniona z VAT” – wystawia faktury bez podatku i nie składa JPK_V7. Po przekroczeniu limitu VAT trzeba naliczać już od transakcji, którą go przekroczono.

Ze zwolnienia nie mogą korzystać – bez względu na obroty – m.in. prawnicy, doradcy, jubilerzy i firmy sprzedające np. paliwa, alkohol, elektronikę czy samochody (art. 113 ust. 13).

## Co jeszcze warto wiedzieć o VAT w firmie?

- **KSeF** – od 2026 r. faktury dla firm wystawia się w Krajowym Systemie e-Faktur: najwięksi podatnicy od 1 lutego, pozostali od 1 kwietnia 2026 r. Najmniejsi (sprzedaż do 10 000 zł miesięcznie) mają czas do końca 2026 r.
- **Podzielona płatność (MPP)** – obowiązkowa przy fakturach powyżej 15 000 zł brutto na towary i usługi z załącznika nr 15 (np. elektronika, paliwa, usługi budowlane). Faktura musi mieć wtedy dopisek „mechanizm podzielonej płatności”.
- **Odliczenie VAT od samochodu** – przy aucie osobowym używanym także prywatnie odliczysz 50% VAT od zakupu, leasingu i paliwa.
- **Termin zapłaty VAT** – do 25. dnia miesiąca po okresie rozliczeniowym. Spóźnisz się – zapłacisz odsetki, które policzysz w [kalkulatorze odsetek podatkowych](/firma/odsetki-podatkowe/).
