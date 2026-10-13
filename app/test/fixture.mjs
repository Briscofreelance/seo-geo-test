// Faux site avec défauts volontaires, pour tester le moteur d'audit hors connexion.
import http from 'node:http';
const page = (title, body, head = '') => `<!doctype html><html lang="fr"><head><meta charset="utf-8"><title>${title}</title>${head}</head><body>${body}</body></html>`;
const ld = (o) => `<script type="application/ld+json">${JSON.stringify(o)}</script>`;
export function startFixture(port = 0, { blockAi = false } = {}) {
  const srv = http.createServer((req, res) => {
    const u = req.url.split('?')[0];
    if (blockAi && /OAI-SearchBot|PerplexityBot/.test(req.headers['user-agent'] || '')) { res.writeHead(403, { 'content-type': 'text/html' }); return res.end('<title>Just a moment...</title>'); }
    const send = (code, type, body, h = {}) => { res.writeHead(code, { 'content-type': type, ...h }); res.end(body); };
    const base = `http://127.0.0.1:${srv.address().port}`;
    if (u === '/') return send(200, 'text/html', page('Plomberie Martin - plombier à Saint-Étienne',
      `<h1>Plombier à Saint-Étienne</h1><h1>Deuxième titre</h1><p>Plomberie Martin, 12 rue de la Paix, 42000 Saint-Étienne. Tél 04 77 00 00 00. Dépannage rapide toute la semaine, devis gratuit et intervention en moins de deux heures sur Saint-Étienne.</p><h2>Combien coûte un dépannage de plomberie ?</h2><p>Un dépannage coûte en général entre 80 et 150 euros selon la nature de la panne et l'heure d'intervention, déplacement compris.</p><img src="/a.png"><img src="/b.png" alt="Fuite réparée"><a href="/contact">Contact</a> <a href="/cassé">cliquez ici</a> <a href="/ancien">ancien</a> <a href="/secret">secret</a>`,
      `<meta name="description" content="Plombier"><link rel="canonical" href="${base}/">${ld({ '@context': 'https://schema.org', '@type': 'Plumber', name: 'Plomberie Martin', telephone: '04 77 00 00 00', address: { '@type': 'PostalAddress', streetAddress: '12 rue de la Paix', addressLocality: 'Saint-Étienne' } })}<script src="/x.js"></script>`));
    if (u === '/contact') return send(200, 'text/html', page('Contact', '<h1>Contact</h1><p>Appelez-nous au 04 77 00 00 00 ou écrivez-nous pour une intervention rapide à Saint-Étienne et alentours, du lundi au samedi.</p><form><label for="n">Nom</label><input id="n" name="nom"><input name="mail"><label>Message <textarea name="m"></textarea></label></form>', `<link rel="canonical" href="${base}/contact">`));
    if (u === '/ancien') return send(301, 'text/plain', '', { location: '/contact' });
    if (u === '/secret') return send(200, 'text/html', page('Secret', '<h1>Secret</h1><p>Page privée.</p>', '<meta name="robots" content="noindex">'));
    if (u === '/.env') return send(200, 'text/plain', 'API_KEY=abc123\nDB=postgres://x');
    if (u === '/robots.txt') return send(200, 'text/plain', 'User-agent: *\nDisallow: /secret\nUser-agent: GPTBot\nDisallow: /\n');
    if (u === '/a.png' || u === '/b.png') return send(200, 'image/png', req.method === 'HEAD' ? '' : Buffer.alloc(2000), { 'content-length': 2000 });
    if (u === '/x.js') return send(200, 'text/javascript', 'var a=1;');
    return send(404, 'text/html', page('404', '<h1>Introuvable</h1>'));
  });
  return new Promise((r) => srv.listen(port, '127.0.0.1', () => r(srv)));
}
