// Récupération HTTP prudente : redirections suivies à la main, délai, taille limitée.
const UA = 'SeoLabAudit/1.0 (+audit local; lecture seule)';
const MAX_BYTES = 2_000_000;

export const isLocalHost = (host) => /^(localhost|127\.|0\.0\.0\.0|\[::1\])/.test(host) || /^\d+\.\d+\.\d+\.\d+$/.test(host.split(':')[0]);

export async function fetchPage(url, { method = 'GET', timeout = 12000, maxRedirects = 6, wantBody = true, userAgent } = {}) {
  const chain = [];
  let current = url;
  const t0 = Date.now();
  try {
    for (let i = 0; i <= maxRedirects; i++) {
      const res = await fetch(current, {
        method, redirect: 'manual', headers: { 'user-agent': userAgent || UA, accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.5', 'accept-language': 'fr,en;q=0.7' },
        signal: AbortSignal.timeout(timeout),
      });
      const headers = Object.fromEntries([...res.headers.entries()].map(([k, v]) => [k.toLowerCase(), v]));
      if ([301, 302, 303, 307, 308].includes(res.status) && headers.location) {
        chain.push({ url: current, status: res.status });
        try { await res.body?.cancel(); } catch {}
        current = new URL(headers.location, current).href;
        continue;
      }
      let body = '';
      const ct = headers['content-type'] || '';
      if (wantBody && method === 'GET' && /text|xml|json|html/i.test(ct)) {
        const buf = new Uint8Array(await res.arrayBuffer());
        body = new TextDecoder('utf-8').decode(buf.slice(0, MAX_BYTES));
      } else { try { await res.body?.cancel(); } catch {} }
      return { url, finalUrl: current, status: res.status, headers, body, chain, redirects: chain.length, ms: Date.now() - t0, error: null };
    }
    return { url, finalUrl: current, status: 0, headers: {}, body: '', chain, redirects: chain.length, ms: Date.now() - t0, error: 'trop de redirections' };
  } catch (e) {
    return { url, finalUrl: current, status: 0, headers: {}, body: '', chain, redirects: chain.length, ms: Date.now() - t0, error: e.cause?.code || e.name === 'TimeoutError' ? (e.cause?.code || 'délai dépassé') : e.message };
  }
}

// Statut d'une URL : HEAD d'abord, GET si le serveur refuse HEAD.
export async function statusOf(url) {
  let r = await fetchPage(url, { method: 'HEAD', wantBody: false, timeout: 9000 });
  if (r.status === 0 || r.status === 405 || r.status === 403 || r.status === 501) r = await fetchPage(url, { method: 'GET', wantBody: false, timeout: 9000 });
  return r;
}

export async function pool(items, n, fn) {
  const out = new Array(items.length);
  let i = 0;
  await Promise.all(Array.from({ length: Math.min(n, items.length) }, async () => {
    while (i < items.length) { const k = i++; out[k] = await fn(items[k], k); }
  }));
  return out;
}

// robots.txt : groupes par user-agent, règle simplifiée suffisante pour savoir si un robot est bloqué.
export function parseRobots(text) {
  const groups = [];
  let cur = null;
  const sitemaps = [];
  for (const raw of text.split(/\r?\n/)) {
    const line = raw.replace(/#.*/, '').trim();
    const m = line.match(/^([A-Za-z-]+)\s*:\s*(.*)$/);
    if (!m) continue;
    const k = m[1].toLowerCase(); const v = m[2].trim();
    if (k === 'user-agent') { if (!cur || cur.rules.length) { cur = { agents: [], rules: [] }; groups.push(cur); } cur.agents.push(v.toLowerCase()); }
    else if (k === 'sitemap') sitemaps.push(v);
    else if ((k === 'disallow' || k === 'allow') && cur) cur.rules.push({ type: k, path: v });
  }
  return { groups, sitemaps };
}
export function robotBlocked(robots, agent) {
  const a = agent.toLowerCase();
  const g = robots.groups.find((x) => x.agents.some((n) => n !== '*' && a.includes(n))) || robots.groups.find((x) => x.agents.includes('*'));
  if (!g) return false;
  const dis = g.rules.some((r) => r.type === 'disallow' && r.path === '/');
  const allow = g.rules.some((r) => r.type === 'allow' && r.path === '/');
  return dis && !allow;
}
