export const GET = () => new Response('User-agent: *\nAllow: /\n\nSitemap: https://policzalnia.pl/sitemap.xml\n', { headers: { 'Content-Type': 'text/plain' } });
