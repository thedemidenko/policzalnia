// Bloki w treści poradników (Markdown → HTML przy budowaniu), animowane po wejściu na ekran:
//
// ```wykres                      ```wykres                         ```liczby
// typ: slupki                    typ: linia                        28 260 zł | limit wpłat na IKE w 2026 r.
// tytul: Tytuł wykresu           tytul: Tytuł                      10% | podatek przy wypłacie z IKZE
// jednostka: zł                  jednostka: zł                     ```
// zrodlo: opis źródła            os: 2026, 2030, 2035
// Etykieta | 1356                IKE | 0, 52000, 120000            ```widzet
// Druga etykieta | 3617          Konto | 0, 48000, 98000           nazwa: ikze-zwrot
// ```                            ```                               wplata: 11304
//                                                                  ```
// Liczby w danych: z kropką lub przecinkiem dziesiętnym, spacje jako separator tysięcy są pomijane.

const fmt = (n, jedn = '') => {
  const s = n.toLocaleString('pl-PL', { maximumFractionDigits: 2, useGrouping: true }).replace(/ /g, ' ');
  return jedn ? (jedn === '%' ? `${s}%` : `${s}\u00a0${jedn}`) : s;
};
const liczba = (t) => parseFloat(String(t).replace(/[\s ]/g, '').replace(',', '.'));
const esc = (t) => String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
const tekst = (node) => (node.type === 'text' ? node.value : (node.children ?? []).map(tekst).join(''));

function parsuj(src) {
  const meta = {}, wiersze = [];
  for (const l of src.split('\n').map((x) => x.trim()).filter(Boolean)) {
    const m = l.match(/^([a-ząćęłńóśźż_]+):\s*(.*)$/i);
    if (m && !l.includes('|')) meta[m[1].toLowerCase()] = m[2];
    else if (l.includes('|')) wiersze.push(l.split('|').map((x) => x.trim()));
  }
  return { meta, wiersze };
}

function slupki({ meta, wiersze }) {
  const jedn = meta.jednostka ?? '';
  const dane = wiersze.map(([e, v]) => ({ e, v: liczba(v) })).filter((d) => !Number.isNaN(d.v));
  const max = Math.max(...dane.map((d) => Math.abs(d.v)), 1);
  const rows = dane.map((d, i) => `<div class="ws-wiersz"><span class="ws-et">${esc(d.e)}</span><span class="ws-pasek"><i style="--w:${((Math.abs(d.v) / max) * 100).toFixed(1)}%;--k:var(--w${i % 6})"></i></span><b>${esc(fmt(d.v, jedn))}</b></div>`).join('');
  return `<figure class="wykres wykres-slupki" data-anim>${meta.tytul ? `<figcaption>${esc(meta.tytul)}</figcaption>` : ''}<div class="ws-dane">${rows}</div>${meta.zrodlo ? `<p class="wykres-zrodlo">${esc(meta.zrodlo)}</p>` : ''}</figure>`;
}

function linia({ meta, wiersze }) {
  const jedn = meta.jednostka ?? '';
  const os = (meta.os ?? '').split(',').map((x) => x.trim()).filter(Boolean);
  const serie = wiersze.map(([n, v]) => ({ n, v: v.split(',').map(liczba) }));
  const wszystkie = serie.flatMap((s) => s.v).filter((x) => !Number.isNaN(x));
  const max = Math.max(...wszystkie, 1);
  // oś od zera, chyba że wszystkie wartości są wysoko (np. 10 000–15 000 zł) – wtedy od „okrągłej” wartości pod minimum
  const najm = Math.min(...wszystkie);
  const kr0 = Math.pow(10, Math.floor(Math.log10(Math.max(1, max - najm))));
  const min = meta.od !== undefined ? liczba(meta.od) : najm > 0.4 * max ? Math.floor(najm / kr0) * kr0 : Math.min(0, najm);
  const W = 640, H = 300, L = 56, R = 16, T = 16, B = 34;
  const x = (i) => L + (i * (W - L - R)) / Math.max(1, os.length - 1);
  const y = (v) => T + (1 - (v - min) / (max - min || 1)) * (H - T - B);
  const krok = Math.pow(10, Math.floor(Math.log10(max - min || 1)));
  const podz = [];
  for (let v = Math.ceil(min / krok) * krok; v <= max; v += krok * (((max - min) / krok) > 5 ? 2 : 1)) podz.push(v);
  const siatka = podz.map((v) => `<line x1="${L}" x2="${W - R}" y1="${y(v).toFixed(1)}" y2="${y(v).toFixed(1)}" class="wl-siatka"/><text x="${L - 6}" y="${(y(v) + 4).toFixed(1)}" class="wl-os" text-anchor="end">${esc(fmt(v))}</text>`).join('');
  const osX = os.map((e, i) => `<text x="${x(i).toFixed(1)}" y="${H - 10}" class="wl-os" text-anchor="middle">${esc(e)}</text>`).join('');
  const linie = serie.map((s, i) => {
    const pkt = s.v.map((v, j) => `${x(j).toFixed(1)},${y(v).toFixed(1)}`).join(' ');
    return `<polyline points="${pkt}" class="wl-linia" pathLength="1" style="--k:var(--w${i % 6})"/><circle cx="${x(s.v.length - 1).toFixed(1)}" cy="${y(s.v.at(-1)).toFixed(1)}" r="4.5" class="wl-pkt" style="--k:var(--w${i % 6})"/>`;
  }).join('');
  const legenda = serie.map((s, i) => `<span style="--k:var(--w${i % 6})"><i></i>${esc(s.n)}: <b>${esc(fmt(s.v.at(-1), jedn))}</b></span>`).join('');
  const tabela = `<table class="sr-only"><thead><tr><th></th>${os.map((e) => `<th>${esc(e)}</th>`).join('')}</tr></thead><tbody>${serie.map((s) => `<tr><th>${esc(s.n)}</th>${s.v.map((v) => `<td>${esc(fmt(v, jedn))}</td>`).join('')}</tr>`).join('')}</tbody></table>`;
  return `<figure class="wykres wykres-linia" data-anim>${meta.tytul ? `<figcaption>${esc(meta.tytul)}</figcaption>` : ''}<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(meta.tytul ?? 'Wykres')}">${siatka}${osX}${linie}</svg><div class="wl-legenda">${legenda}</div>${tabela}${meta.zrodlo ? `<p class="wykres-zrodlo">${esc(meta.zrodlo)}</p>` : ''}</figure>`;
}

function liczby({ wiersze }) {
  const kafle = wiersze.map(([v, opis]) => {
    const m = String(v).match(/^([^\d-]*)(-?[\d\s ]+(?:[.,]\d+)?)(.*)$/);
    // liczba bez spacji na końcu – spacja przed jednostką („28 260 zł”) trafia do przyrostka
    if (m) { const num = m[2].replace(/[\s ]+$/, ''); m[3] = m[2].slice(num.length) + m[3]; m[2] = num; }
    const cel = m ? liczba(m[2]) : NaN;
    const dzies = m && /[.,]\d+$/.test(m[2]) ? m[2].split(/[.,]/)[1].length : 0;
    return `<div class="lk-kafel"><b${Number.isNaN(cel) ? '' : ` data-licz="${cel}" data-dzies="${dzies}" data-pre="${esc(m[1])}" data-post="${esc(m[3])}"`}>${esc(v)}</b><span>${esc(opis ?? '')}</span></div>`;
  }).join('');
  return `<div class="liczby-kafle" data-anim>${kafle}</div>`;
}

function widzet({ meta }) {
  const attrs = Object.entries(meta).map(([k, v]) => `data-${esc(k)}="${esc(v)}"`).join(' ');
  return `<div class="widzet" data-widzet="${esc(meta.nazwa ?? '')}" ${attrs}><noscript>Ten element działa z włączonym JavaScriptem.</noscript></div>`;
}

const BLOKI = { wykres: (d) => (d.meta.typ === 'linia' ? linia(d) : slupki(d)), liczby, widzet };

export default function rehypeBloki() {
  return (tree) => {
    const zamien = (parent) => {
      (parent.children ?? []).forEach((n, i) => {
        if (n.type === 'element' && n.tagName === 'pre' && n.children?.[0]?.tagName === 'code') {
          const cls = n.children[0].properties?.className ?? [];
          const jez = cls.map(String).find((c) => c.startsWith('language-'))?.slice(9) ?? n.properties?.dataLanguage;
          if (jez && BLOKI[jez]) {
            parent.children[i] = { type: 'raw', value: BLOKI[jez](parsuj(tekst(n.children[0]))) };
            return;
          }
        }
        if (n.children) zamien(n);
      });
    };
    zamien(tree);
  };
}
