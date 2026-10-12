// Mock des API Brave et Gemini + test des mesures automatiques et de l'import Search Console
import http from 'node:http';
const mock = http.createServer((req, res) => {
  const u = new URL(req.url, 'http://x'); const send = (o, c = 200) => { res.writeHead(c, { 'content-type': 'application/json' }); res.end(JSON.stringify(o)); };
  if (u.pathname === '/brave') { if (req.headers['x-subscription-token'] !== 'BK') return send({}, 401); return send({ web: { results: [{ url: 'https://concurrent.fr/a' }, { url: 'https://' + process.env.TEST_HOST + '/page' }, { url: 'https://autre.fr' }] } }); }
  if (u.pathname.includes(':generateContent')) { let b = ''; req.on('data', (c) => (b += c)); req.on('end', () => send({ candidates: [{ content: { parts: [{ text: 'Je recommande Plomberie Martin à Saint-Étienne.' }] }, groundingMetadata: { groundingChunks: [{ web: { uri: 'https://vertex/x', title: 'concurrent.fr' } }, { web: { uri: 'https://vertex/y', title: process.env.TEST_HOST } }] } }] })); return; }
  send({}, 404);
});
await new Promise((r) => mock.listen(0, '127.0.0.1', r));
const mp = mock.address().port;
process.env.SEOLAB_BRAVE_URL = `http://127.0.0.1:${mp}/brave`; process.env.SEOLAB_GEMINI_URL = `http://127.0.0.1:${mp}/models`;
process.env.SEOLAB_CONFIG = (process.env.TEMP || process.env.TMPDIR || '/tmp') + '/seolab-cfg.json';
const { startFixture } = await import('./fixture.mjs');
const fx = await startFixture(); process.env.TEST_HOST = `127.0.0.1:${fx.address().port}`;
const { server, listen } = await import('../server.mjs');
await new Promise((r) => { server.once('listening', r); listen(4196); });
const base = 'http://127.0.0.1:4196';
const post = (p, b) => fetch(base + '/api' + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-seolab': '1' }, body: JSON.stringify(b) }).then((r) => r.json());
const wj = async (job) => { let j; do { await new Promise((r) => setTimeout(r, 400)); j = await (await fetch(base + '/api/job/' + job)).json(); } while (j.status === 'running'); return j; };
const a = await wj((await post('/audit', { url: `http://127.0.0.1:${fx.address().port}/`, local: true, psi: false })).job);
const slug = a.slug, id = a.auditId;
console.log('config publique :', await post('/config', { brave_key: 'BK', gemini_key: 'GK' }));
await post('/query', { slug, kind: 'queries', text: 'plombier Saint-Étienne' });
await post('/query', { slug, kind: 'prompts', text: 'Quel plombier choisir à Saint-Étienne ?' });
const r = await post('/auto', { slug, id, brand: 'Plomberie Martin', engines: ['brave', 'gemini'], query_ids: ['q1'], prompt_ids: ['p1'], runs: 2 });
console.log('auto :', r.error || 'lancé');
const j = await wj(r.job); console.log('job :', j.status, j.done + '/' + j.total, j.errors);
const v = await (await fetch(`${base}/api/audit/${slug}/${id}`)).json();
console.log('serp :', JSON.stringify(v.serp.map((s) => [s.engine, s.position])), 'ia :', JSON.stringify(v.ai.map((e) => [e.engine, e.n, e.mentioned, e.cited])));
console.log('run gemini :', JSON.stringify(v.snap.ai.runs[0]));
console.log('mauvaise clé :', (await post('/config', { brave_key: 'MAUVAISE' })) && (await wj((await post('/auto', { slug, id, brand: '', engines: ['brave'], query_ids: ['q1'], prompt_ids: [] })).job)).errors);
console.log('trop d\'appels :', (await post('/auto', { slug, id, brand: '', engines: ['gemini'], query_ids: [], prompt_ids: ['p1'], runs: 5 })).error || 'accepté');
const csv = 'Requêtes les plus fréquentes;Clics;Impressions;CTR;Position\n"plombier saint etienne";12;"1 200";"1,0 %";"8,5"\ndepannage fuite;3;300;1 %;14,2\n';
const g = await post('/import-gsc', { slug, id, csv });
console.log('GSC :', JSON.stringify({ clicks: g.snap.search.gsc.clicks, imp: g.snap.search.gsc.impressions, pos: g.snap.search.gsc.avg_position, n: g.snap.search.gsc.top_queries.length }));
console.log('clé jamais exposée :', !JSON.stringify(await (await fetch(base + '/api/config')).json()).includes('GK'));
console.log('prompt mesure :', (await (await fetch(`${base}/api/prompt/${slug}/${id}?type=measure`)).json()).text.slice(0, 120));
console.log('SLUG', slug, id);
process.exit(0);
