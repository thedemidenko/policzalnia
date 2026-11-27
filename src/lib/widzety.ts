// Widżety w treści poradników: <div data-widzet="nazwa" data-…> (blok ```widzet w Markdown).
// Każdy widżet buduje mały interaktywny kalkulator i korzysta z tych samych bibliotek co kalkulatory.
export type Widzet = (el: HTMLElement) => void;

const zl = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions);

export const WIDZETY: Record<string, () => Promise<Widzet>> = {
  // ryczałt czy liniowy (i skala): lib kalkulatora ryczałtu – na rękę rocznie przy tych samych przychodach, kosztach i ZUS
  'ryczalt-czy-liniowy': async () => {
    const { obliczRyczalt, STAWKI } = await import('./ryczalt');
    return (el) => {
      const stawki = STAWKI.filter((s) => s.id !== 'najem');
      el.innerHTML = `<h3>Ryczałt, liniowy czy skala – policz</h3>
        <label>Przychód miesięcznie <output data-o="p"></output><input type="range" min="3000" max="80000" step="500" value="${el.dataset.przychod ?? 20000}" data-i="p"></label>
        <label>Koszty (% przychodu) <output data-o="k"></output><input type="range" min="0" max="90" step="1" value="${el.dataset.koszty ?? 10}" data-i="k"></label>
        <label>Stawka ryczałtu<select data-i="s">${stawki.map((s) => `<option value="${s.id}"${s.id === (el.dataset.stawka ?? '12') ? ' selected' : ''}>${s.nazwa}</option>`).join('')}</select></label>
        <label>Składki ZUS<select data-i="z"><option value="pelny">pełny ZUS</option><option value="pref">preferencyjny ZUS</option><option value="start">ulga na start (bez społecznych)</option></select></label>
        <div class="wz-slupki" data-o="s"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const licz = () => {
        const p = +i('p').value, k = +i('k').value;
        o('p').textContent = zl(p); o('k').textContent = `${k}%`;
        const w = obliczRyczalt({ rok: 2026, przychody: [{ stawka: i('s').value, kwota: p * 12 }], zus: i('z').value as 'pelny' | 'pref' | 'start', koszty: (p * 12 * k) / 100 });
        const formy = (w.porownanie ?? []).map((f) => [f.nazwa.replace('Podatek liniowy 19%', 'Liniowy 19%'), f.naReke / 12, f.podatek + f.zdrowotna] as [string, number, number]);
        const max = Math.max(...formy.map((f) => f[1]), 1);
        const najl = [...formy].sort((a, b) => b[1] - a[1])[0];
        o('s').innerHTML = formy.map(([n, v], j) => `<div class="ws-wiersz"><span class="ws-et">${n}</span><span class="ws-pasek"><i style="--w:${((Math.max(v, 0) / max) * 100).toFixed(1)}%;--k:var(--w${j})"></i></span><b>${zl(v)}</b></div>`).join('');
        const drugi = [...formy].sort((a, b) => b[1] - a[1])[1];
        o('werdykt').textContent = najl ? `${najl[0]}: o ${zl((najl[1] - drugi[1]) * 12)} rocznie więcej niż ${drugi[0].toLowerCase()}` : '';
        o('opis').textContent = `Na rękę miesięcznie po podatku, zdrowotnej, ZUS i kosztach (parametry 2026: skala 12/32%, zdrowotna na ryczałcie wg progów przychodu, na liniowym 4,9% z odliczeniem). Bez ulg i wspólnego rozliczenia – przy skali z małżonkiem lub ulgą na dzieci wynik może być lepszy.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // L4 80% czy 100%: wypłata za miesiąc z L4 – pensja minus 1/30 za każdy dzień L4 + wynagrodzenie chorobowe/zasiłek (lib L4),
  // netto: składki ZUS i zdrowotna tylko od części pensji, PIT 12% (koszty 250 zł, PIT-2 300 zł) od całości
  'l4-80-czy-100': async () => {
    const { obliczL4 } = await import('./l4');
    return (el) => {
      const przyczyny: [string, string][] = [['choroba', 'choroba (80%)'], ['ciaza', 'choroba w ciąży (100%)'], ['wypadek', 'wypadek w drodze do lub z pracy (100%)'], ['dawca', 'badania i zabieg dawcy (100%)']];
      el.innerHTML = `<h3>Ile dostaniesz za miesiąc z L4?</h3>
        <label>Pensja brutto <output data-o="b"></output><input type="range" min="4800" max="20000" step="100" value="${el.dataset.pensja ?? 7000}" data-i="b"></label>
        <label>Dni L4 w miesiącu <output data-o="d"></output><input type="range" min="1" max="30" step="1" value="${el.dataset.dni ?? 30}" data-i="d"></label>
        <label>Przyczyna<select data-i="p">${przyczyny.map(([v, n]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
        <div class="wz-slupki" data-o="s"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const r2 = (n: number) => Math.round(n * 100) / 100;
      const netto = (pensja: number, l4: number) => {
        const zus = r2(pensja * 0.1371);
        const zdr = r2((pensja - zus) * 0.09); // od chorobowego i zasiłku nie ma składek ZUS ani zdrowotnej
        const pit = Math.max(0, Math.round(Math.round(pensja - zus + l4 - 250) * 0.12 - 300));
        return r2(pensja - zus + l4 - zdr - pit);
      };
      const licz = () => {
        const b = +i('b').value, d = +i('d').value, p = i('p').value as 'choroba' | 'ciaza' | 'wypadek' | 'dawca';
        o('b').textContent = zl(b); o('d').textContent = `${d} ${d === 1 ? 'dzień' : 'dni'}`;
        const l4 = obliczL4({ forma: 'uop', brutto: b, dni: d, przyczyna: p }).razem;
        const czescPensji = d >= 30 ? 0 : r2(b - r2((b / 30) * d));
        const zwykle = netto(b, 0), zL4 = netto(czescPensji, l4);
        const wiersze: [string, number, number][] = [['Zwykła wypłata na rękę', zwykle, 2], ['Wypłata z L4 na rękę', zL4, p === 'choroba' ? 1 : 0]];
        const max = Math.max(zwykle, zL4, 1);
        o('s').innerHTML = wiersze.map(([n, v, k]) => `<div class="ws-wiersz"><span class="ws-et">${n}</span><span class="ws-pasek"><i style="--w:${((v / max) * 100).toFixed(1)}%;--k:var(--w${k})"></i></span><b>${zl(v)}</b></div>`).join('');
        const roznica = zL4 - zwykle;
        o('werdykt').textContent = Math.abs(roznica) < 1 ? 'Tyle samo co zwykle' : roznica < 0 ? `O ${zl(-roznica)} mniej niż zwykle (${Math.round((zL4 / zwykle) * 100)}%)` : `O ${zl(roznica)} więcej niż zwykle (${Math.round((zL4 / zwykle) * 100)}%)`;
        o('opis').textContent = `L4 brutto: ${zl(l4)}. Od wynagrodzenia chorobowego i zasiłku nie płaci się składek ZUS ani zdrowotnej, tylko podatek – dlatego 80% brutto to ok. 90% zwykłej wypłaty netto. Założenia: stała pensja, PIT 12% z PIT-2, koszty 250 zł, pensja pomniejszona o 1/30 za dzień L4.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // urlop czy ekwiwalent przy odejściu: urlop proporcjonalny (art. 155¹, 155²ᵃ – miesiąc w górę, 155³ – dzień w górę),
  // ekwiwalent = dni × pensja ÷ współczynnik (lib ekwiwalent), netto orientacyjnie, urlop u nowego pracodawcy (łącznie ≤ wymiar)
  'urlop-czy-ekwiwalent': async () => {
    const { wspolczynnik } = await import('./ekwiwalent');
    return (el) => {
      const rok = new Date().getFullYear();
      const mies = ['styczeń', 'luty', 'marzec', 'kwiecień', 'maj', 'czerwiec', 'lipiec', 'sierpień', 'wrzesień', 'październik', 'listopad', 'grudzień'];
      el.innerHTML = `<h3>Ile urlopu zostanie i ile wyniesie ekwiwalent?</h3>
        <label>Ostatni miesiąc pracy<select data-i="m">${mies.map((n, j) => `<option value="${j + 1}"${j + 1 === +(el.dataset.miesiac ?? 8) ? ' selected' : ''}>${n} ${rok}</option>`).join('')}</select></label>
        <label>Wymiar urlopu<select data-i="w"><option value="20">20 dni (staż poniżej 10 lat)</option><option value="26" selected>26 dni (staż od 10 lat)</option></select></label>
        <label>Wykorzystane w tym roku <output data-o="u"></output><input type="range" min="0" max="26" step="1" value="${el.dataset.wykorzystane ?? 10}" data-i="u"></label>
        <label>Zaległe z poprzedniego roku <output data-o="z"></output><input type="range" min="0" max="26" step="1" value="${el.dataset.zalegle ?? 2}" data-i="z"></label>
        <label>Pensja brutto <output data-o="p"></output><input type="range" min="4800" max="20000" step="100" value="${el.dataset.pensja ?? 8000}" data-i="p"></label>
        <div class="wz-slupki" data-o="lista"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const dni = (n: number) => `${n} ${n === 1 ? 'dzień' : 'dni'}`;
      const licz = () => {
        const m = +i('m').value, w = +i('w').value, u = +i('u').value, z = +i('z').value, p = +i('p').value;
        o('u').textContent = dni(u); o('z').textContent = dni(z); o('p').textContent = zl(p);
        const prop = Math.ceil((m / 12) * w - 1e-9);
        const zostalo = Math.max(0, prop + z - u);
        const wsp = wspolczynnik(rok);
        const godz = Math.round((p / wsp / 8) * 100) / 100; // stawka za godzinę do grosza – jak w kalkulatorze ekwiwalentu
        const brutto = Math.round(zostalo * 8 * godz * 100) / 100;
        const netto = brutto * (1 - 0.1371) * (1 - 0.09 - 0.12); // składki pracownika, zdrowotna 9%, PIT 12% – bez kosztów i kwoty wolnej (zwykle już wykorzystanych w pensji)
        const nowy = m < 12 ? Math.max(0, Math.min(Math.ceil(((12 - m) / 12) * w - 1e-9), w - Math.max(prop, u))) : 0;
        const wiersze: [string, string][] = [
          ['Urlop proporcjonalny za ten rok', dni(prop)],
          ['Do wykorzystania albo wypłaty', dni(zostalo)],
          ['Ekwiwalent brutto', zl(brutto)],
          ['Na rękę (orientacyjnie, PIT 12%)', zl(netto)],
          [m < 12 ? `Urlop u nowego pracodawcy (od ${['stycznia', 'lutego', 'marca', 'kwietnia', 'maja', 'czerwca', 'lipca', 'sierpnia', 'września', 'października', 'listopada', 'grudnia'][m]})` : 'Urlop u nowego pracodawcy', m < 12 ? dni(nowy) : 'od stycznia – pełny wymiar'],
        ];
        o('lista').innerHTML = wiersze.map(([n, v]) => `<div class="ws-wiersz wz-tekst"><span class="ws-et">${n}</span><b>${v}</b></div>`).join('');
        o('werdykt').textContent = zostalo ? `${dni(zostalo)} = ok. ${zl(brutto)} brutto` : u > prop + z ? 'Wykorzystano więcej, niż przysługiwało – pracodawca nie może tego potrącić' : 'Cały urlop wykorzystany';
        o('opis').textContent = `Współczynnik ${rok}: ${wsp.toLocaleString('pl-PL')} (pełny etat, stała pensja). Pracodawca może zamiast ekwiwalentu wysłać cię na ten urlop w okresie wypowiedzenia. Premie i dodatki zmienne podwyższają ekwiwalent – policzysz je w kalkulatorze ekwiwalentu.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // układ ratalny w ZUS: odsetki narosłe do wniosku + opłata prolongacyjna (50% stawki odsetek, art. 29 ust. 4 ustawy o sus)
  // wobec spłaty w tym samym tempie bez układu (odsetki za zwłokę od malejącego długu); stawka z ostatniej stopy lombardowej NBP
  'zus-raty': async () => {
    const stopy = (await import('../data/stopy-nbp.json')).default as { zmiany: { od: string; lomb: number }[] };
    const lomb = [...stopy.zmiany].sort((a, b) => a.od.localeCompare(b.od)).at(-1)!.lomb;
    const odsetki = Math.round((2 * lomb + 2) * 100) / 100; // art. 56 Ordynacji: 200% lombardowej + 2 pp.
    return (el) => {
      el.innerHTML = `<h3>Układ ratalny w ZUS – ile kosztuje?</h3>
        <label>Zaległe składki <output data-o="d"></output><input type="range" min="500" max="100000" step="500" value="${el.dataset.dlug ?? 12000}" data-i="d"></label>
        <label>Od ilu miesięcy zalegasz (średnio) <output data-o="m"></output><input type="range" min="0" max="36" step="1" value="${el.dataset.miesiecy ?? 4}" data-i="m"></label>
        <label>Liczba rat <output data-o="n"></output><input type="range" min="2" max="60" step="1" value="${el.dataset.raty ?? 24}" data-i="n"></label>
        <div class="wz-slupki" data-o="s"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const proc = (v: number) => `${v.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`;
      const licz = () => {
        const d = +i('d').value, m = +i('m').value, n = +i('n').value;
        o('d').textContent = zl(d); o('m').textContent = `${m} mies.`; o('n').textContent = String(n);
        const doWniosku = d * (odsetki / 100) * (m / 12);
        const rata = d / n;
        let prolong = 0, bez = 0;
        for (let k = 1; k <= n; k++) { prolong += rata * (odsetki / 200) * (k / 12); bez += rata * (odsetki / 100) * (k / 12); }
        const wiersze: [string, number, number][] = [['Odsetki narosłe do dnia wniosku', doWniosku, 1], ['Opłata prolongacyjna w układzie', prolong, 0], ['Odsetki przy tej samej spłacie bez układu', bez, 2]];
        const max = Math.max(...wiersze.map((w) => w[1]), 1);
        o('s').innerHTML = wiersze.map(([nz, v, k]) => `<div class="ws-wiersz"><span class="ws-et">${nz}</span><span class="ws-pasek"><i style="--w:${((v / max) * 100).toFixed(1)}%;--k:var(--w${k})"></i></span><b>${zl(v)}</b></div>`).join('');
        o('werdykt').textContent = `Rata ok. ${zl(rata + (doWniosku + prolong) / n)} miesięcznie`;
        o('opis').textContent = `Odsetki za zwłokę ${proc(odsetki)} rocznie, opłata prolongacyjna ${proc(odsetki / 2)}. Od dnia po złożeniu wniosku ZUS nie nalicza odsetek od składek objętych układem. Rata zawiera też odsetki sprzed wniosku i opłatę – w umowie ZUS rozkłada je po swojemu. Szacunek: raty co miesiąc od miesiąca po wniosku.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // koniec umowy o pracę: okres wypowiedzenia (art. 36 KP), odprawa (art. 8 ustawy o zwolnieniach grupowych),
  // zasiłek dla bezrobotnych (ustawa o rynku pracy – kwoty od 1.06.2026, 90 dni karencji przy własnym wypowiedzeniu/porozumieniu)
  'koniec-umowy': async () => {
    const { placaMinimalna } = await import('./ppk');
    return (el) => {
      const sposoby: [string, string][] = [['wygasa', 'umowa wygasa w terminie'], ['pracodawca', 'wypowiada pracodawca'], ['porozumienie-firma', 'porozumienie – przyczyny firmy'], ['pracownik', 'wypowiada pracownik'], ['porozumienie', 'porozumienie – inne przyczyny']];
      el.innerHTML = `<h3>Kończy się umowa – co ci przysługuje?</h3>
        <label>Jak kończy się umowa<select data-i="s">${sposoby.map(([v, n]) => `<option value="${v}"${v === (el.dataset.sposob ?? 'pracodawca') ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Staż u tego pracodawcy <output data-o="u"></output><input type="range" min="1" max="180" step="1" value="${el.dataset.staz ?? 30}" data-i="u"></label>
        <label>Pensja brutto <output data-o="p"></output><input type="range" min="4800" max="20000" step="100" value="${el.dataset.pensja ?? 7000}" data-i="p"></label>
        <label>Firma zatrudnia co najmniej 20 osób<select data-i="f"><option value="1">tak</option><option value="0">nie</option></select></label>
        <label>Twój staż pracy łącznie<select data-i="z"><option value="0.8">poniżej 5 lat</option><option value="1" selected>5–20 lat</option><option value="1.2">ponad 20 lat</option></select></label>
        <div class="wz-slupki" data-o="lista"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const okres = (m: number) => `${m >= 12 ? `${Math.floor(m / 12)} ${Math.floor(m / 12) === 1 ? 'rok' : Math.floor(m / 12) < 5 ? 'lata' : 'lat'}` : ''}${m >= 12 && m % 12 ? ' ' : ''}${m % 12 ? `${m % 12} mies.` : ''}`;
      const licz = () => {
        const s = i('s').value, m = +i('u').value, p = +i('p').value, duza = i('f').value === '1', z = +i('z').value;
        o('u').textContent = okres(m); o('p').textContent = zl(p);
        const wyp = m < 6 ? '2 tygodnie' : m < 36 ? '1 miesiąc' : '3 miesiące';
        const zFirmy = s === 'pracodawca' || s === 'porozumienie-firma';
        const pm = placaMinimalna(new Date().getFullYear());
        const odprawa = zFirmy && duza ? Math.min(p * (m < 24 ? 1 : m <= 96 ? 2 : 3), 15 * pm) : 0;
        const zas1 = Math.round(1783.9 * z * 100) / 100, zas2 = Math.round(1400.9 * z * 100) / 100;
        const karencja = s === 'pracownik' || s === 'porozumienie';
        const wiersze: [string, string, number][] = [
          ['Okres wypowiedzenia', s === 'wygasa' ? 'brak – koniec w terminie' : s.startsWith('porozumienie') ? 'brak – data z porozumienia' : wyp, 0],
          ['Odprawa', odprawa ? zl(odprawa) : '0 zł', 2],
          ['Zasiłek dla bezrobotnych', karencja ? 'po 90 dniach od rejestracji' : 'od 8. dnia po rejestracji', 1],
          ['Zasiłek – pierwsze 90 dni', `${zas1.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł brutto/mies.`, 1],
          ['Zasiłek – później', `${zas2.toLocaleString('pl-PL', { minimumFractionDigits: 2 })} zł brutto/mies.`, 1],
        ];
        o('lista').innerHTML = wiersze.map(([n, v]) => `<div class="ws-wiersz wz-tekst"><span class="ws-et">${n}</span><b>${v}</b></div>`).join('');
        o('werdykt').textContent = odprawa ? `Odprawa: ${zl(odprawa)}` : zFirmy && !duza ? 'Bez odprawy – firma poniżej 20 osób' : 'Bez odprawy';
        o('opis').textContent = `${s === 'wygasa' ? 'Gdy umowa po prostu wygasa, odprawa nie przysługuje. ' : ''}Odprawa: 1, 2 albo 3 pensje (staż do 2 lat, 2–8 lat, ponad 8 lat), najwyżej 15 płac minimalnych (${zl(15 * pm)}). Zasiłek: jeśli w ostatnich 18 miesiącach przepracowano co najmniej 365 dni z co najmniej płacą minimalną; kwoty od 1 czerwca 2026 r.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // delegacja zagraniczna – szybka kalkulacja należności (lib kalkulatora diety zagranicznej), kurs NBP pobierany na żywo
  'delegacja-zagraniczna': async () => {
    const { obliczDieteZagraniczna, KRAJE } = await import('./dieta-zagraniczna');
    return (el) => {
      const kraje = [...KRAJE].sort((a, b) => a.nazwa.localeCompare(b.nazwa, 'pl'));
      const domyslny = el.dataset.kraj ?? 'niemcy';
      el.innerHTML = `<h3>Ile należy się za delegację zagraniczną?</h3>
        <label>Państwo<select data-i="k">${kraje.map((k) => `<option value="${k.id}"${k.id === domyslny ? ' selected' : ''}>${k.nazwa}</option>`).join('')}</select></label>
        <label>Pełne doby za granicą <output data-o="d"></output><input type="range" min="0" max="14" step="1" value="${el.dataset.doby ?? 2}" data-i="d"></label>
        <label>Plus godziny <output data-o="g"></output><input type="range" min="0" max="23" step="1" value="${el.dataset.godziny ?? 13}" data-i="g"></label>
        <label>Zapewnione śniadania <output data-o="s"></output><input type="range" min="0" max="14" step="1" value="${el.dataset.sniadania ?? 2}" data-i="s"></label>
        <label>Zapewnione obiady i kolacje <output data-o="o"></output><input type="range" min="0" max="28" step="1" value="${el.dataset.obiady ?? 2}" data-i="o"></label>
        <label>Nocleg<select data-i="n"><option value="rachunek">hotel z rachunkiem (zwrot do limitu)</option><option value="ryczalt">bez rachunku (ryczałt 25% limitu)</option><option value="zapewniony">zapewniony przez firmę</option></select></label>
        <label>Podróż<select data-i="t"><option value="0">samolot, pociąg albo autobus</option><option value="1">samochodem</option></select></label>
        <div class="wz-slupki" data-o="lista"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const kursy = new Map<string, Promise<number | null>>();
      const kurs = (w: string) => {
        if (!kursy.has(w)) kursy.set(w, fetch(`https://api.nbp.pl/api/exchangerates/rates/a/${w.toLowerCase()}/?format=json`).then((r) => (r.ok ? r.json() : null)).then((j) => j?.rates?.[0]?.mid ?? null).catch(() => null));
        return kursy.get(w)!;
      };
      const kw = (n: number, w: string) => `${n.toLocaleString('pl-PL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${w}`;
      const godz = (n: number) => `${n} ${n === 1 ? 'godzina' : n % 10 >= 2 && n % 10 <= 4 && (n % 100 < 10 || n % 100 >= 20) ? 'godziny' : 'godzin'}`;
      let nr = 0;
      const licz = async () => {
        const id = i('k').value, d = +i('d').value, g = +i('g').value, s = +i('s').value, ob = +i('o').value;
        o('d').textContent = String(d); o('g').textContent = godz(g); o('s').textContent = String(s); o('o').textContent = String(ob);
        const k = KRAJE.find((x) => x.id === id)!;
        const start = new Date(Date.UTC(2026, 11, 7, 8, 0));
        const koniec = new Date(start.getTime() + (d * 24 + Math.max(g, d === 0 ? 1 : 0)) * 3600e3);
        const f = (x: Date) => x.toISOString().slice(0, 16);
        const noce = d; // noc po każdej pełnej dobie
        const nocleg = i('n').value as 'rachunek' | 'ryczalt' | 'zapewniony';
        const w = obliczDieteZagraniczna({
          granica: f(start), powrotGranica: f(koniec), samochod: i('t').value === '1',
          etapy: [{ kraj: id, sniadania: s, obiady: ob, nocleg, noce, rachunek: k.limit * noce }],
        });
        const e = w.etapy[0];
        if (!e) { o('lista').innerHTML = ''; o('werdykt').textContent = w.blad ?? ''; o('opis').textContent = ''; return; }
        const max = Math.max(...e.pozycje.map((p) => Math.abs(p.kwota)), 1);
        o('lista').innerHTML = e.pozycje.map((p, j) => `<div class="ws-wiersz"><span class="ws-et">${p.nazwa}</span><span class="ws-pasek"><i style="--w:${((Math.abs(p.kwota) / max) * 100).toFixed(1)}%;--k:var(--w${p.kwota < 0 ? 1 : j === 0 ? 0 : 2})"></i></span><b>${kw(p.kwota, k.waluta)}</b></div>`).join('');
        o('werdykt').textContent = `Razem ${kw(e.razem, k.waluta)}`;
        const opisBaza = `Dieta ${kw(k.dieta, k.waluta)} za dobę, limit hotelu ${kw(k.limit, k.waluta)} za noc${nocleg === 'rachunek' ? ' – zwrot do limitu, zakładamy rachunek w tej wysokości' : ''}. Bez biletów i innych wydatków z rachunkami.`;
        o('opis').textContent = opisBaza;
        const moj = ++nr;
        const m = k.waluta === 'PLN' ? 1 : await kurs(k.waluta);
        if (moj !== nr || !m) return;
        o('opis').textContent = `ok. ${kw(e.razem * m, 'zł')} po kursie NBP ${m.toLocaleString('pl-PL', { minimumFractionDigits: 4 })}. ${opisBaza}`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // PPK – zostać czy wypisać się: koszt z własnej kieszeni vs PPK (wypłata po 60 albo zwrot) vs samodzielne odkładanie tych samych pieniędzy
  'ppk-zostac-czy-wypisac': async () => {
    const { obliczPPK } = await import('./ppk');
    return (el) => {
      const horyzonty: [string, number][] = [['do 60. roku życia', 0], ['zwrot po 1 roku', 1], ['zwrot po 4 latach', 4], ['zwrot po 10 latach', 10]];
      el.innerHTML = `<h3>Zostać w PPK czy się wypisać – policz</h3>
        <label>Pensja brutto <output data-o="b"></output><input type="range" min="3000" max="20000" step="100" value="${el.dataset.brutto ?? 8000}" data-i="b"></label>
        <label>Twój wiek <output data-o="w"></output><input type="range" min="18" max="69" step="1" value="${el.dataset.wiek ?? 35}" data-i="w"></label>
        <label>Wynik funduszu rocznie <output data-o="r"></output><input type="range" min="-10" max="8" step="0.5" value="${el.dataset.stopa ?? 5}" data-i="r"></label>
        <label>Kiedy wypłacasz<select data-i="h">${horyzonty.map(([n, v]) => `<option value="${v}">${n}</option>`).join('')}</select></label>
        <div class="wz-slupki" data-o="s"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const licz = () => {
        const b = +i('b').value, wiek = +i('w').value, r = +i('r').value, h = +i('h').value;
        o('b').textContent = zl(b); o('w').textContent = `${wiek} lat`; o('r').textContent = `${r.toLocaleString('pl-PL')}%`;
        // po 60. r.ż. wypłata bez potrąceń; wcześniej – zwrot (art. 105)
        const w = obliczPPK({ brutto: b, wiek, wiekWyplaty: h === 0 ? Math.max(60, wiek + 1) : wiek + h, stopa: r });
        const zwrotPrzed60 = !w.po60;
        const ppk = w.po60 ? w.wartosc : w.zwrot.naKonto;
        const wyniki: [string, number, number][] = [
          ['Z twojej kieszeni (wpłaty + PIT)', w.kosztTwoj, 2],
          [w.po60 ? 'PPK – wypłata po 60. r.ż.' : 'PPK – zwrot na konto', ppk, 0],
          ['Te same pieniądze odkładane samodzielnie', w.sam, 1],
        ];
        const max = Math.max(...wyniki.map((x) => x[1]), 1);
        o('s').innerHTML = wyniki.map(([n, v, k]) => `<div class="ws-wiersz"><span class="ws-et">${n}</span><span class="ws-pasek"><i style="--w:${((v / max) * 100).toFixed(1)}%;--k:var(--w${k})"></i></span><b>${zl(v)}</b></div>`).join('');
        const lat = Math.round(w.lat);
        o('werdykt').textContent = w.przewaga >= 0 ? `Zostając w PPK, masz o ${zl(w.przewaga)} więcej` : `Samodzielnie o ${zl(-w.przewaga)} więcej`;
        o('opis').textContent = `${lat} ${lat === 1 ? 'rok' : lat < 5 ? 'lata' : 'lat'} oszczędzania, wpłaty podstawowe 2% + 1,5%, płace +3% rocznie.${zwrotPrzed60 ? ' Przy zwrocie 30% wpłat pracodawcy trafia do ZUS, dopłaty państwa wracają, od zysku płacisz 19%.' : ''}${wiek >= 55 ? ' Po 55. roku życia do PPK zapisujesz się tylko na wniosek.' : ''} Samodzielnie: ten sam koszt odkładany na ten sam procent z podatkiem Belki.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // nadpłacać kredyt czy inwestować: lib kalkulatora nadpłaty (te same miesięczne wydatki w obu scenariuszach)
  'nadplata-czy-inwestycja': async () => {
    const { obliczNadplate } = await import('./nadplata');
    return (el) => {
      el.innerHTML = `<h3>Nadpłacać czy inwestować – policz</h3>
        <label>Kredyt do spłaty <output data-o="s"></output><input type="range" min="50000" max="1000000" step="10000" value="${el.dataset.saldo ?? 400000}" data-i="s"></label>
        <label>Oprocentowanie kredytu <output data-o="p"></output><input type="range" min="1" max="12" step="0.05" value="${el.dataset.stopa ?? 6}" data-i="p"></label>
        <label>Zostało lat spłaty <output data-o="n"></output><input type="range" min="2" max="35" step="1" value="${el.dataset.lata ?? 25}" data-i="n"></label>
        <label>Wolna kwota co miesiąc <output data-o="c"></output><input type="range" min="100" max="5000" step="100" value="${el.dataset.kwota ?? 1000}" data-i="c"></label>
        <label>Zysk z inwestycji rocznie <output data-o="r"></output><input type="range" min="1" max="12" step="0.25" value="${el.dataset.zysk ?? 7}" data-i="r"></label>
        <label>Gdzie inwestujesz<select data-i="b"><option value="1">zwykłe konto (podatek Belki)</option><option value="0">IKE / IKZE / OKI (bez Belki)</option></select></label>
        <div class="wz-slupki" data-o="wyk"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const proc = (v: number) => `${v.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`;
      const licz = () => {
        const s = +i('s').value, p = +i('p').value, n = +i('n').value, c = +i('c').value, r = +i('r').value, belka = i('b').value === '1';
        o('s').textContent = zl(s); o('p').textContent = proc(p); o('n').textContent = `${n} lat`; o('c').textContent = zl(c); o('r').textContent = proc(r);
        const w = obliczNadplate({ saldo: s, stopa: p, rat: n * 12, cykliczna: c }, { stopa: r, belka });
        const inw = w.inwestycja!;
        const prog = belka ? p / 0.81 : p;
        o('wyk').innerHTML = `<div class="ws-wiersz"><span class="ws-et">Oszczędność na odsetkach</span><span class="ws-pasek"><i style="--w:100%;--k:var(--w0)"></i></span><b>${zl(w.oszczednosc)}</b></div>`
          + `<div class="ws-wiersz"><span class="ws-et">Kredyt krótszy o</span><span class="ws-pasek"><i style="--w:${((w.skrocenie / (n * 12)) * 100).toFixed(1)}%;--k:var(--w2)"></i></span><b>${Math.floor(w.skrocenie / 12)} l. ${w.skrocenie % 12} mies.</b></div>`;
        o('werdykt').textContent = inw.roznica < 1 ? 'Wychodzi tak samo' : inw.lepsze === 'nadplata' ? `Nadpłata lepsza o ${zl(inw.roznica)}` : `Inwestowanie lepsze o ${zl(inw.roznica)}`;
        o('opis').textContent = `Porównanie po ${n} latach: w obu wariantach co miesiąc wydajesz tyle samo, a po spłacie kredytu ratę i nadpłatę inwestujesz. Inwestycja wygrywa, gdy daje średnio więcej niż ${proc(Math.round(prog * 100) / 100)} rocznie${belka ? ' przed podatkiem' : ''} – i nie jest to pewne, a oszczędność na odsetkach jest.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // obligacje skarbowe czy lokata: najlepsze obligacje (lib kalkulatora) vs lokata odnawiana z podatkiem Belki
  'obligacje-czy-lokata': async () => {
    const { porownaj, TYPY } = await import('./obligacje');
    return (el) => {
      const okresy: [string, number][] = [['3 miesiące', 3], ['1 rok', 12], ['2 lata', 24], ['3 lata', 36], ['4 lata', 48], ['5 lat', 60], ['10 lat', 120]];
      el.innerHTML = `<h3>Obligacje czy lokata – policz</h3>
        <label>Kwota <output data-o="k"></output><input type="range" min="1000" max="200000" step="1000" value="${el.dataset.kwota ?? 10000}" data-i="k"></label>
        <label>Na jak długo<select data-i="h">${okresy.map(([n, v]) => `<option value="${v}"${v === +(el.dataset.okres ?? 48) ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label>Oprocentowanie lokaty <output data-o="l"></output><input type="range" min="1" max="7" step="0.05" value="${el.dataset.lokata ?? 4.15}" data-i="l"></label>
        <label>Średnia inflacja <output data-o="i"></output><input type="range" min="0" max="8" step="0.5" value="${el.dataset.inflacja ?? 3}" data-i="i"></label>
        <div class="wz-slupki" data-o="s"></div>
        <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const proc = (v: number) => `${v.toLocaleString('pl-PL', { maximumFractionDigits: 2 })}%`;
      const licz = () => {
        const k = +i('k').value, H = +i('h').value, l = +i('l').value, inf = +i('i').value;
        o('k').textContent = zl(k); o('l').textContent = proc(l); o('i').textContent = proc(inf);
        const ob = (porownaj({ kwota: k, H, z: { inflacja: [inf], ref: 3.75 } }) as unknown as { sym: keyof typeof TYPY; koniec: number }[])
          .filter((x) => Number.isFinite(x.koniec)).sort((a, b) => b.koniec - a.koniec).slice(0, 3);
        // lokata: przy okresie krótszym niż rok jedna lokata, dłużej – roczne odnawianie, podatek Belki od odsetek
        const lok = H < 12 ? k * (1 + (0.81 * l / 100) * H / 12) : k * Math.pow(1 + 0.81 * l / 100, H / 12);
        const wyniki: [string, number, number][] = [...ob.map((x, j) => [`Obligacje ${x.sym}`, x.koniec, j === 0 ? 3 : 0] as [string, number, number]), [`Lokata ${proc(l)}`, lok, 1]];
        const max = Math.max(...wyniki.map((w) => w[1]));
        o('s').innerHTML = wyniki.map(([n, v, kol]) => `<div class="ws-wiersz"><span class="ws-et">${n}</span><span class="ws-pasek"><i style="--w:${((v / max) * 100).toFixed(1)}%;--k:var(--w${kol})"></i></span><b>${zl(v)}</b></div>`).join('');
        const najl = ob[0];
        const r = najl ? najl.koniec - lok : 0;
        o('werdykt').textContent = !najl ? '' : r > 0 ? `${najl.sym} lepsze o ${zl(r)}` : `Lokata lepsza o ${zl(-r)}`;
        o('opis').textContent = `Kwoty na koniec po podatku Belki (obligacje – z opłatą za wcześniejszy wykup, jeśli trzeba). Lokata przy stałym oprocentowaniu przez cały okres – w praktyce banki zmieniają stawki. Stopa NBP 3,75%.`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
  // IKE czy IKZE: ta sama wpłata z kieszeni przez N lat; IKZE – 10% przy wypłacie, zwrot podatku na IKE albo wydany
  'ike-vs-ikze': async () => (el) => {
    const stawki: [string, number][] = [['skala 12%', 12], ['skala 32%', 32], ['liniowy 19%', 19], ['ryczałt 12%', 12], ['ryczałt 8,5%', 8.5], ['ryczałt 3%', 3], ['nie płacę podatku', 0]];
    el.innerHTML = `<h3>IKE czy IKZE – policz na swoich liczbach</h3>
      <label>Twoja stawka podatku<select data-i="t">${stawki.map(([n, v], i) => `<option value="${v}"${i === 0 ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
      <label>Wpłata rocznie <output data-o="w"></output><input type="range" min="1000" max="12000" step="500" value="${el.dataset.wplata ?? 10000}" data-i="w"></label>
      <label>Lata oszczędzania <output data-o="n"></output><input type="range" min="5" max="40" step="1" value="${el.dataset.lata ?? 20}" data-i="n"></label>
      <label>Średni zysk rocznie <output data-o="r"></output><input type="range" min="0" max="10" step="0.5" value="${el.dataset.zysk ?? 6}" data-i="r"></label>
      <div class="wz-slupki" data-o="s"></div>
      <div class="wz-wynik"><b data-o="werdykt"></b><small data-o="opis"></small></div>`;
    const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
    const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
    const licz = () => {
      const t = +i('t').value / 100, w = +i('w').value, n = +i('n').value, r = +i('r').value / 100;
      o('w').textContent = zl(w); o('n').textContent = `${n} lat`; o('r').textContent = `${String(+i('r').value).replace('.', ',')}%`;
      let fv = 0; for (let k = 0; k < n; k++) fv = (fv + w) * (1 + r);
      const wyniki: [string, number][] = [
        ['IKE', fv],
        ['IKZE + zwrot podatku na IKE', fv * 0.9 + fv * t],
        ['IKZE, zwrot wydany', fv * 0.9],
        ['Zwykłe konto (19% od zysku)', w * n + (fv - w * n) * 0.81],
      ];
      const max = Math.max(...wyniki.map((x) => x[1]), 1);
      o('s').innerHTML = wyniki.map(([nz, v]) => `<div class="ws-wiersz"><span class="ws-et">${nz}</span><span class="ws-pasek"><i style="--w:${((v / max) * 100).toFixed(1)}%;--k:var(--w${nz === 'IKE' ? 0 : nz.startsWith('IKZE +') ? 3 : nz.startsWith('IKZE') ? 1 : 2})"></i></span><b>${zl(v)}</b></div>`).join('');
      const roznica = wyniki[1][1] - wyniki[0][1];
      o('werdykt').textContent = Math.abs(roznica) < 1 ? 'Wychodzi tak samo' : roznica > 0 ? `IKZE lepsze o ${zl(roznica)}` : `IKE lepsze o ${zl(-roznica)}`;
      o('opis').textContent = `Przy stawce ${String(+i('t').value).replace('.', ',')}% IKZE wygrywa tylko, gdy zwrot podatku odkładasz (np. na IKE) – i tylko przy stawce wyższej niż 10% podatku płaconego przy wypłacie. Uproszczenie: bez opłat i limitów wpłat.`;
    };
    el.addEventListener('input', licz);
    licz();
  },
  // zwrot podatku z IKZE: dochód + wpłata (suwak) + forma opodatkowania
  'ikze-zwrot': async () => {
    const { zwrotPodatku } = await import('./ikze');
    const { limit } = await import('./ike');
    return (el) => {
      const rok = +(el.dataset.rok ?? new Date().getFullYear());
      el.innerHTML = `<h3>Ile odzyskasz z IKZE?</h3>
        <label>Dochód roczny <output data-o="d"></output><input type="range" min="20000" max="300000" step="5000" value="${el.dataset.dochod ?? 90000}" data-i="d"></label>
        <label>Wpłata na IKZE <output data-o="w"></output><input type="range" min="0" max="${limit(rok, 'ikze')}" step="1" value="${el.dataset.wplata ?? limit(rok, 'ikze')}" data-i="w"></label>
        <div class="wz-wynik"><small>Zwrot podatku przy skali 12/32%</small><b data-o="z"></b><small data-o="l"></small></div>`;
      const i = (k: string) => el.querySelector<HTMLInputElement>(`[data-i="${k}"]`)!;
      const o = (k: string) => el.querySelector<HTMLElement>(`[data-o="${k}"]`)!;
      const licz = () => {
        const d = +i('d').value, w = +i('w').value;
        o('d').textContent = zl(d); o('w').textContent = zl(w);
        const s = zwrotPodatku({ rok, forma: 'skala', podstawa: d, wplata: w });
        const l = zwrotPodatku({ rok, forma: 'liniowy', podstawa: d, wplata: w });
        o('z').textContent = zl(s.zwrot);
        o('l').textContent = `Na podatku liniowym: ${zl(l.zwrot)} · pełne wyliczenie w kalkulatorze IKZE`;
      };
      el.addEventListener('input', licz);
      licz();
    };
  },
};
