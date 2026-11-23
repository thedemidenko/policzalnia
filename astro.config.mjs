import { defineConfig } from 'astro/config';
import rehypeReklama from './src/lib/rehype-reklama.mjs';

export default defineConfig({
  site: 'https://policzalnia.pl',
  trailingSlash: 'always',
  markdown: { rehypePlugins: [rehypeReklama] },
});
