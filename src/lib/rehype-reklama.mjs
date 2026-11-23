// Wstawia slot reklamowy „w-tresci” przed drugim nagłówkiem h2 treści (tylko gdy reklamy włączone).
import { readFileSync } from 'node:fs';

export default function rehypeReklama() {
  return (tree) => {
    const site = JSON.parse(readFileSync(new URL('../site.json', import.meta.url), 'utf8'));
    if (!site.reklamy) return;
    const idx = tree.children.reduce((acc, n, i) => (n.type === 'element' && n.tagName === 'h2' ? [...acc, i] : acc), []);
    if (idx.length < 2) return;
    tree.children.splice(idx[1], 0, {
      type: 'element', tagName: 'div',
      properties: { className: ['reklama', 'reklama-w-tresci'], dataSlot: 'w-tresci', ariaHidden: 'true' }, children: [],
    });
  };
}
