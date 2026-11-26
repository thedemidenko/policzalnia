import { defineConfig } from 'astro/config';
import rehypeReklama from './src/lib/rehype-reklama.mjs';
import rehypeBloki from './src/lib/rehype-bloki.mjs';
import rehypeLinki from './src/lib/rehype-linki.mjs';

export default defineConfig({
  site: 'https://policzalnia.pl',
  trailingSlash: 'always',
  // zdjęcia w treści Markdown – responsywne (srcset), nie jeden duży plik
  image: { layout: 'constrained' },
  markdown: {
    // bloki ```wykres / ```liczby / ```widzet zamieniane na HTML (src/lib/rehype-bloki.mjs) – bez podświetlania składni
    syntaxHighlight: { type: 'shiki', excludeLangs: ['wykres', 'liczby', 'widzet'] },
    rehypePlugins: [rehypeBloki, rehypeLinki, rehypeReklama],
  },
});
