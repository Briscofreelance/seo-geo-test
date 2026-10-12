import { startMocks } from './mock-engines.mjs';
const siteHost = 'monsite.test';
const m = await startMocks(siteHost); const base = `http://127.0.0.1:${m.address().port}`;
Object.assign(process.env, { SEOLAB_FAST: '1', SEOLAB_HEADLESS: '1', SEOLAB_NOSANDBOX: '1', SEOLAB_CHROME: process.env.SEOLAB_CHROME || '/opt/pw-browsers/chromium-1194/chrome-linux/chrome', SEOLAB_PROFILE: (process.env.TEMP || process.env.TMPDIR || '/tmp') + '/seolab-prof-' + Date.now(), SEOLAB_CDP_PORT: '9411',
  SEOLAB_URL_BRAVE: base + '/brave/search', SEOLAB_URL_BING: base + '/bing/search', SEOLAB_URL_PERPLEXITY: base + '/perplexity/search', SEOLAB_URL_CHATGPT: base + '/chatgpt/', SEOLAB_URL_GEMINI: base + '/gemini/app', SEOLAB_URL_COPILOT: base + '/copilot/' });
const { runBrowserTasks } = await import('../lib/browser.mjs');
const q = { id: 'q1', text: 'plombier test' }, p = { id: 'p1', text: 'quel plombier ?' };
const tasks = [{ kind: 'serp', engine: 'brave', q }, { kind: 'serp', engine: 'bing', q }, ...['perplexity', 'chatgpt', 'gemini', 'copilot'].map((engine) => ({ kind: 'ai', engine, p }))];
const out = [], errs = [];
await runBrowserTasks(tasks, { siteHost, brand: ['Monsite'], onResult: (t, r) => out.push([t.engine, JSON.stringify({ ...r, excerpt: undefined })]), onError: (e, m) => errs.push([e, m]) });
console.log(out.map((x) => x.join(' ')).join('\n')); console.log('erreurs :', errs);
// captcha : arrêt du moteur sans contournement
await new Promise((r) => setTimeout(r, 3000));
process.env.SEOLAB_URL_BRAVE = base + '/captcha/search';
const { runBrowserTasks: run2 } = await import('../lib/browser.mjs?x=2');
const e2 = []; await run2([{ kind: 'serp', engine: 'brave', q }, { kind: 'serp', engine: 'brave', q: { id: 'q2', text: 'autre' } }], { siteHost, onResult: () => e2.push('RESULT?!'), onError: (e, m) => e2.push(m) });
console.log('captcha :', e2);
process.exit(0);
