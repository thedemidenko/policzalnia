// Widżety w treści poradników: <div data-widzet="nazwa" data-…> (blok ```widzet w Markdown).
// Każdy widżet buduje mały interaktywny kalkulator i korzysta z tych samych bibliotek co kalkulatory.
export type Widzet = (el: HTMLElement) => void;

const zl = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions);

export const WIDZETY: Record<string, () => Promise<Widzet>> = {
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
