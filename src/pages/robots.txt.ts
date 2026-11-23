import site from '../site.json';
export const GET = () => new Response(
  site.noindex ? 'User-agent: *\nAllow: /\n' : 'User-agent: *\nAllow: /\nSitemap: https://policzalnia.pl/sitemap.xml\n',
  { headers: { 'Content-Type': 'text/plain' } },
);
