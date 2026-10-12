// Audit + mesures navigateur enchaînées (fausses pages de moteurs)
import { startMocks } from './mock-engines.mjs';
import { startFixture } from './fixture.mjs';
const fx = await startFixture(); const siteHost = `127.0.0.1:${fx.address().port}`;
const m = await startMocks(siteHost); const base = `http://127.0.0.1:${m.address().port}`;
Object.assign(process.env, { SEOLAB_FAST: '1', SEOLAB_HEADLESS: '1', SEOLAB_NOSANDBOX: '1', SEOLAB_CHROME: process.env.SEOLAB_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', SEOLAB_PROFILE: (process.env.TEMP || process.env.TMPDIR || '/tmp') + '/seolab-prof-' + Date.now(), SEOLAB_CDP_PORT: '9412', SEOLAB_CONFIG: (process.env.TEMP || process.env.TMPDIR || '/tmp') + '/seolab-cfg3.json',
  SEOLAB_URL_BRAVE: base + '/brave/search', SEOLAB_URL_BING: base + '/bing/search', SEOLAB_URL_PERPLEXITY: base + '/perplexity/search', SEOLAB_URL_CHATGPT: base + '/chatgpt/', SEOLAB_URL_GEMINI: base + '/gemini/app', SEOLAB_URL_COPILOT: base + '/copilot/' });
const { server, listen } = await import('../server.mjs');
await new Promise((r) => { server.once('listening', r); listen(4194); });
const api = 'http://127.0.0.1:4194/api';
const post = (p, b) => fetch(api + p, { method: 'POST', headers: { 'content-type': 'application/json', 'x-seolab': '1' }, body: JSON.stringify(b) }).then((r) => r.json());
const { job } = await post('/audit', { url: `http://${siteHost}/`, local: true, psi: false, measure: true, queries: 'plombier Saint-Étienne\ndépannage fuite urgence', brand: 'Plomberie Martin' });
let j; do { await new Promise((r) => setTimeout(r, 500)); j = await (await fetch(api + '/job/' + job)).json(); } while (j.status === 'running');
console.log('job', j.status, j.done + '/' + j.total, j.errors);
const v = await (await fetch(`${api}/audit/${j.slug}/${j.auditId}`)).json();
console.log('requêtes :', v.queries.map((q) => q.text), '| questions :', v.prompts.length);
console.log('serp :', JSON.stringify(v.serp.map((s) => [s.engine, s.query_id, s.position])));
console.log('ia :', JSON.stringify(v.ai.map((e) => [e.engine, e.n, e.mentioned, e.cited])), v.snap.ai.method);
process.exit(0);
