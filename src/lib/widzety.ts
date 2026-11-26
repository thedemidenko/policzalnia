// Widżety w treści poradników: <div data-widzet="nazwa" data-…> (blok ```widzet w Markdown).
// Każdy widżet buduje mały interaktywny kalkulator i korzysta z tych samych bibliotek co kalkulatory.
export type Widzet = (el: HTMLElement) => void;

const zl = (n: number) => n.toLocaleString('pl-PL', { style: 'currency', currency: 'PLN', maximumFractionDigits: 0, useGrouping: 'always' } as Intl.NumberFormatOptions);

export const WIDZETY: Record<string, () => Promise<Widzet>> = {
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
