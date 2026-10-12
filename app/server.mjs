// SEO GEO Test : petit serveur local (aucune dépendance, Node 18+). Écoute uniquement sur 127.0.0.1.
import http from 'node:http';
import { readFileSync, existsSync, statSync } from 'node:fs';
import { join, dirname, extname, normalize, sep } from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomUUID } from 'node:crypto';
import { spawn } from 'node:child_process';
import { runAudit, siteSlug, today, VERSION } from './lib/audit.mjs';
import * as store from './lib/store.mjs';
import { HELP } from './lib/help.mjs';
import { readConfig, saveConfig, publicConfig } from './lib/config.mjs';
import { runBrowserTasks, prepareLogins, findChrome, findBrowser, SERP_ENGINES, AI_ENGINES } from './lib/browser.mjs';
import { braveRank, geminiAsk, parseGscCsv, hostOf, wait } from './lib/providers.mjs';
import { scores, checkList, aiStats, serpMap, diff, history, catalog, byId } from './lib/engine.mjs';
import { actionList, fixPrompt, completePrompt, measurePrompt, A, adviceFor } from './lib/advice.mjs';
import { init as initEn, trDeep } from './lib/en.mjs';
initEn(catalog, HELP, A);

const here = dirname(fileURLToPath(import.meta.url));
const TIPS = JSON.parse(readFileSync(join(here, 'data', 'tips.json'), 'utf8'));
const PUB = join(here, 'public');
const MIME = { '.html': 'text/html; charset=utf-8', '.css': 'text/css; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.svg': 'image/svg+xml', '.ico': 'image/x-icon', '.png': 'image/png' };
const jobs = new Map();
let PORT = 4177;

const send = (res, code, data, type = 'application/json; charset=utf-8') => {
  if (res.lang === 'en' && data && typeof data === 'object' && !Buffer.isBuffer(data) && !data.noTranslate) data = trDeep(data);
  res.writeHead(code, { 'content-type': type, 'cache-control': 'no-store', 'x-content-type-options': 'nosniff', 'content-security-policy': "default-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; frame-ancestors 'none'" });
  res.end(typeof data === 'string' || Buffer.isBuffer(data) ? data : JSON.stringify(data));
};
const fail = (res, code, msg) => send(res, code, { error: msg });
const body = (req, max = 200_000) => new Promise((ok, ko) => {
  let b = ''; req.on('data', (c) => { b += c; if (b.length > max) { ko(new Error('Requête trop grande')); req.destroy(); } });
  req.on('end', () => { try { ok(b ? JSON.parse(b) : {}); } catch { ko(new Error('JSON invalide')); } });
});
const num = (v) => (v === '' || v == null ? null : Number.isFinite(+v) ? +v : null);
const str = (v, n = 200) => String(v ?? '').slice(0, n);
const ENGINE_RE = /^[a-z0-9_]{2,30}$/;

function auditView(slug, id) {
  const snap = store.readSnapshot(slug, id);
  if (!snap) return null;
  const ids = store.listAuditIds(slug);
  const i = ids.indexOf(id);
  const checks = checkList(snap);
  const decisions = store.readDecisions(slug);
  const sc = scores(snap);
  const serp = [...serpMap(snap).values()];
  return {
    slug, id, snap, version: VERSION, help: HELP,
    prevId: i > 0 ? ids[i - 1] : null, nextId: i < ids.length - 1 ? ids[i + 1] : null,
    scores: sc, checks, actions: actionList(checks, decisions), decisions,
    domains: catalog.domains,
    ai: Object.values(aiStats(snap)), serp,
    queries: store.readFrozen(slug, 'queries').items, prompts: store.readFrozen(slug, 'prompts').items,
  };
}


// Mesures automatiques : API officielles (clés de l'utilisateur) et/ou navigateur dédié (connexions de l'utilisateur).
const MAX_CALLS = 60;
const API_ENGINES = ['brave_api', 'gemini_api'];
function ensureQueries(slug, lines) {
  const cur = store.readFrozen(slug, 'queries').items, curP = store.readFrozen(slug, 'prompts').items;
  for (const l of lines.map((x) => x.trim()).filter((x) => x.length >= 3).slice(0, 8)) {
    if (!cur.some((q) => q.text.toLowerCase() === l.toLowerCase())) store.addFrozen(slug, 'queries', { text: l, kind: 'text' });
    if (!curP.some((q) => q.text.toLowerCase() === l.toLowerCase())) store.addFrozen(slug, 'prompts', { text: l });
  }
}
function buildTasks(slug, b) {
  const engines = [].concat(b.engines || []);
  const queries = store.readFrozen(slug, 'queries').items.filter((q) => q.kind !== 'voice' || engines.some((e) => ['brave', 'bing', 'brave_api'].includes(e))).filter((q) => !b.query_ids || [].concat(b.query_ids).includes(q.id));
  const prompts = store.readFrozen(slug, 'prompts').items.filter((q) => !b.prompt_ids || [].concat(b.prompt_ids).includes(q.id));
  const runs = Math.min(3, Math.max(1, +b.runs || 1));
  const tasks = [];
  for (const e of engines) {
    if (e === 'brave_api') for (const q of queries) tasks.push({ kind: 'api-serp', engine: 'brave', q });
    else if (SERP_ENGINES.includes(e)) for (const q of queries) tasks.push({ kind: 'serp', engine: e, q });
    else if (e === 'gemini_api') for (const p of prompts) for (let r = 0; r < runs; r++) tasks.push({ kind: 'api-ai', engine: 'gemini_api', p });
    else if (AI_ENGINES.includes(e)) for (const p of prompts) for (let r = 0; r < runs; r++) tasks.push({ kind: 'ai', engine: e, p });
  }
  return tasks;
}
// Exécute les mesures dans un audit déjà enregistré. Utilisé seul ou à la suite d'un audit.
async function measureInto(job, slug, id, b) {
  const snap = store.readSnapshot(slug, id), cfg = readConfig(), host = hostOf(snap.url);
  const brand = str(b.brand, 200).split(',').map((x) => x.trim()).filter(Boolean);
  const tasks = buildTasks(slug, b);
  job.total = tasks.length; job.done = 0; job.errors ??= [];
  const bump = () => { job.done++; job.pct = Math.min(99, Math.round((job.done / Math.max(1, tasks.length)) * 100)); };
  const saveSerp = (t, r, method) => store.updateSnapshot(slug, id, (s) => { s.serp ??= { runs: [] }; s.serp.runs.push({ engine: t.engine, query_id: t.q.id, position: r.position, checked_top: r.checked_top, date: today(), method, country: 'fr', lang: 'fr' }); });
  const saveAi = (t, r, method, note) => store.updateSnapshot(slug, id, (s) => {
    s.ai ??= { method, runs: [] }; if (s.ai.method === 'skipped') s.ai.method = method; else if (s.ai.method !== method) s.ai.method = 'mixed';
    const run = 1 + s.ai.runs.filter((x) => x.engine === t.engine && x.prompt_id === t.p.id).length;
    s.ai.runs.push({ prompt_id: t.p.id, engine: t.engine, run, date: today(), logged_in: method === 'browser' && t.engine !== 'perplexity', mentioned: r.mentioned, cited: r.cited, rank_in_answer: null, rank_in_sources: r.rank_in_sources ?? null, competitors: r.competitors || [], note });
  });
  // 1. API officielles
  const stopped = new Set();
  for (const t of tasks.filter((x) => x.kind.startsWith('api'))) {
    if (stopped.has(t.kind)) { bump(); continue; }
    job.step = t.kind === 'api-serp' ? `Brave (API) : « ${t.q.text} »` : `Gemini (API) : « ${t.p.text.slice(0, 50)} »`;
    try {
      if (t.kind === 'api-serp') { if (!cfg.brave_key) throw new Error('Clé Brave absente'); const r = await braveRank(t.q.text, host, cfg.brave_key); saveSerp(t, { position: r.position, checked_top: 20 }, 'api'); await wait(1100); }
      else { if (!cfg.gemini_key) throw new Error('Clé Gemini absente'); const r = await geminiAsk(t.p.text, host, brand, cfg.gemini_key, cfg.gemini_model); saveAi(t, r, 'api', `API Gemini + Google Search (${cfg.gemini_model}) : ${r.sources} source(s)`); await wait(1500); }
    } catch (e) { job.errors.push(e.message); stopped.add(t.kind); }
    bump();
  }
  // 2. Navigateur dédié
  const bt = tasks.filter((x) => !x.kind.startsWith('api'));
  if (bt.length) {
    try {
      await runBrowserTasks(bt, {
        siteHost: host, brand,
        onStep: (s) => { if (s) job.step = s; else bump(); },
        onResult: (t, r) => { if (t.kind === 'serp') saveSerp(t, r, 'browser'); else saveAi(t, r, 'browser', 'mesure navigateur'); bump(); },
        onError: (eng, m) => { job.errors.push(m); bump(); },
      });
    } catch (e) { job.errors.push(e.message); }
  }
}
function startMeasure(res, b) {
  const slug = str(b.slug, 90), id = str(b.id, 20);
  if (!store.readSnapshot(slug, id)) return fail(res, 404, 'Audit introuvable');
  const engines = [].concat(b.engines || []).filter((e) => [...API_ENGINES, ...SERP_ENGINES, ...AI_ENGINES].includes(e));
  if (!engines.length) return fail(res, 400, 'Choisis au moins un moteur.');
  const cfg = readConfig();
  if (engines.includes('brave_api') && !cfg.brave_key) return fail(res, 400, 'Clé Brave absente : ajoute-la dans Réglages.');
  if (engines.includes('gemini_api') && !cfg.gemini_key) return fail(res, 400, 'Clé Gemini absente : ajoute-la dans Réglages.');
  const n = buildTasks(slug, { ...b, engines }).length;
  if (!n) return fail(res, 400, 'Rien à mesurer : ajoute des requêtes et des questions (rubrique 1).');
  if (n > MAX_CALLS) return fail(res, 400, `Trop de mesures d'un coup (${n}, maximum ${MAX_CALLS}).`);
  const jid = randomUUID();
  const job = { id: jid, status: 'running', step: 'Démarrage', pct: 0, slug, auditId: id, error: null, errors: [], total: n, done: 0 };
  jobs.set(jid, job);
  measureInto(job, slug, id, { ...b, engines }).then(() => { job.status = 'done'; job.step = 'Terminé'; job.pct = 100; }).catch((e) => { job.status = 'error'; job.error = e.message; });
  return send(res, 202, { job: jid });
}

function tipsFor(slug, local, L) {
  const st = store.readTips(slug);
  return TIPS.tips.filter((t) => t.applies !== 'local' || local).map((t) => ({ id: t.id, group: t.group, title: t[L].title, what: t[L].what, why: t[L].why, links: t.links.map((k) => ({ label: k[L], url: k.url })), status: st[t.id]?.status || null }));
}
// Bilan d'un site : points corrigés depuis le premier audit (constatés par l'audit), reste à faire, décisions, conseils.
function bilan(slug, L) {
  const snaps = store.allSnapshots(slug); if (!snaps.length) return null;
  const first = snaps[0], last = snaps[snaps.length - 1];
  const cats = snaps.length > 1 ? diff(first, last).cats : null;
  const checks = checkList(last), dec = store.readDecisions(slug), actions = actionList(checks, dec);
  const mini = (c) => ({ id: c.id, title: adviceFor(c.id).title, label: c.label, weight: c.weight, domainLabel: c.domainLabel });
  const tips = tipsFor(slug, !!last.profile?.local, L);
  const n = (k) => tips.filter((t) => t.status === k).length;
  return {
    firstDate: first.date, lastDate: last.date, audits: snaps.length,
    fixed: (cats?.fixed || []).map(mini), regressed: (cats?.regressed || []).map(mini),
    remaining: actions.map((a) => ({ id: a.id, title: a.title, weight: a.weight, domainLabel: a.domainLabel, decision: a.decision?.status || null })),
    decisions: { validated: actions.filter((a) => a.decision?.status === 'validated').length, waiting: actions.filter((a) => a.decision?.status === 'waiting').length, refused: actions.filter((a) => a.decision?.status === 'refused').length },
    tips: { total: tips.length, done: n('done'), later: n('later'), na: n('na'), todo: tips.filter((t) => !t.status).length, doneList: tips.filter((t) => t.status === 'done').map((t) => t.title), openList: tips.filter((t) => t.status !== 'done' && t.status !== 'na').map((t) => ({ title: t.title, later: t.status === 'later' })) },
  };
}

async function api(req, res, url) {
  const p = url.pathname.split('/').filter(Boolean).slice(1).map(decodeURIComponent);
  const m = req.method;
  const lang = url.searchParams.get('lang') === 'en' ? 'en' : 'fr'; res.lang = lang;
  try {
    if (m === 'GET' && p[0] === 'sites') return send(res, 200, { sites: store.listSites().map((s) => ({ slug: s.slug, url: s.url, audits: s.audits, legacyFolders: s.legacyFolders, bilan: (() => { const b = bilan(s.slug, lang); return b ? { fixed: b.fixed.length, remaining: b.remaining.length, tipsDone: b.tips.done, tipsTotal: b.tips.total - b.tips.na } : null; })(), last: s.last ? { date: s.last.date, ...(({ all, classic, geo }) => ({ global: all.global, classic: classic.global, geo: geo.global, coverage: all.coverage }))(scores(s.last)) } : null })), root: store.ROOT });
    if (m === 'GET' && p[0] === 'site' && p[1]) {
      const snaps = store.allSnapshots(p[1]);
      return send(res, 200, { slug: p[1], bilan: bilan(p[1], lang), history: history(snaps), audits: snaps.map((s) => ({ id: s.id, date: s.date })), queries: store.readFrozen(p[1], 'queries').items, prompts: store.readFrozen(p[1], 'prompts').items });
    }
    if (m === 'GET' && p[0] === 'audit' && p[1] && p[2]) { const v = auditView(p[1], p[2]); return v ? send(res, 200, v) : fail(res, 404, 'Audit introuvable'); }
    if (m === 'GET' && p[0] === 'compare' && p.length === 4) {
      const a = store.readSnapshot(p[1], p[2]), b = store.readSnapshot(p[1], p[3]);
      if (!a || !b) return fail(res, 404, 'Audit introuvable');
      return send(res, 200, { slug: p[1], a: p[2], b: p[3], ...diff(a, b) });
    }
    if (m === 'GET' && p[0] === 'prompt' && p[1] && p[2]) {
      const snap = store.readSnapshot(p[1], p[2]); if (!snap) return fail(res, 404, 'Audit introuvable');
      const kind = url.searchParams.get('type');
      if (kind === 'measure') return send(res, 200, { text: measurePrompt(p[1], snap, p[2], store.readFrozen(p[1], 'queries').items, store.readFrozen(p[1], 'prompts').items, lang) });
      if (kind === 'complete') return send(res, 200, { text: completePrompt(p[1], snap, p[2], lang) });
      const dec = store.readDecisions(p[1]);
      const acts = actionList(checkList(snap), dec).filter((a) => dec[a.id]?.status === 'validated');
      return send(res, 200, { text: acts.length ? fixPrompt(snap, acts, lang) : '', count: acts.length });
    }
    if (m === 'GET' && p[0] === 'tips' && p[1]) {
      const tips = tipsFor(p[1], url.searchParams.get('local') === '1', lang);
      return send(res, 200, { groups: Object.entries(TIPS.groups).map(([id, g]) => ({ id, label: g[lang] })), tips, noTranslate: true });
    }
    if (m === 'GET' && p[0] === 'catalog') {
      return send(res, 200, { weights: catalog.weights, domains: Object.entries(catalog.domains).map(([id, d]) => ({ id, label: d.label, max: d.max })),
        checks: catalog.checks.map((c) => { const h = HELP[c.id] || ['', ''], a = A[c.id] || []; return { id: c.id, domain: c.domain, weight: c.weight, applies: c.applies || null, label: c.label, what: h[0], why: h[1], title: a[0] || c.label, how: a[1] || '', effort: a[2] || 2 }; }) });
    }
    if (m === 'GET' && p[0] === 'config') return send(res, 200, { ...publicConfig(), chrome: !!findChrome(), browser: findBrowser()?.name || null });
    if (m === 'GET' && p[0] === 'job' && p[1]) { const j = jobs.get(p[1]); return j ? send(res, 200, j) : fail(res, 404, 'Tâche inconnue'); }

    if (m === 'POST') {
      const b = await body(req, p[0] === 'import-gsc' ? 3_000_000 : 200_000);
      if (p[0] === 'config') { saveConfig(b); return send(res, 200, publicConfig()); }
      if (p[0] === 'import-gsc') {
        const g = parseGscCsv(String(b.csv || ''));
        store.updateSnapshot(str(b.slug, 90), str(b.id, 20), (s) => { s.search ??= {}; s.search.gsc = { period: 'export CSV', clicks: g.clicks, impressions: g.impressions, avg_position: g.avg_position, top_queries: g.top_queries, source: 'export Search Console' }; });
        return send(res, 200, auditView(b.slug, b.id));
      }
      if (p[0] === 'auto') return startMeasure(res, b);
      if (p[0] === 'browser-prepare') { await prepareLogins(); return send(res, 200, { ok: true }); }
      if (p[0] === 'audit') {
        let u = str(b.url, 300).trim(); if (!u) return fail(res, 400, 'Colle l\'adresse du site.');
        if (!/^https?:\/\//i.test(u)) u = 'https://' + u;
        let slug; try { new URL(u); slug = siteSlug(u); } catch { return fail(res, 400, 'Adresse invalide.'); }
        if (!store.SLUG_RE.test(slug)) return fail(res, 400, 'Adresse invalide.');
        const jid = randomUUID();
        const job = { id: jid, status: 'running', step: 'Démarrage', pct: 0, slug, auditId: null, error: null };
        jobs.set(jid, job);
        runAudit({ url: u, local: !!b.local, multilingual: !!b.multilingual, city: str(b.city, 80), psi: b.psi !== false }, (step, pct) => { job.step = step; job.pct = pct; })
          .then(async (snap) => {
            job.slug = snap.site; job.auditId = store.saveSnapshot(snap.site, snap);
            if (b.measure) { // mesures automatiques à la suite de l'audit
              try { job.step = 'Préparation des mesures'; ensureQueries(snap.site, str(b.queries, 1500).split(/\r?\n/)); const eng = [].concat(b.measure_engines?.length ? b.measure_engines : [...SERP_ENGINES, ...AI_ENGINES]).filter((e) => [...SERP_ENGINES, ...AI_ENGINES, ...API_ENGINES].includes(e)); await measureInto(job, snap.site, job.auditId, { engines: eng, runs: 1, brand: str(b.brand, 200) }); } catch (e) { job.errors = [...(job.errors || []), e.message]; }
            }
            job.status = 'done'; job.pct = 100; job.step = 'Terminé';
          })
          .catch((e) => { job.status = 'error'; job.error = e.message; });
        return send(res, 202, { job: jid });
      }
      if (p[0] === 'quit') { send(res, 200, { ok: true }); setTimeout(() => process.exit(0), 300); return; }
      if (p[0] === 'delete-audit') { store.trashAudit(str(b.slug, 90), str(b.id, 20)); return send(res, 200, { ok: true }); }
      if (p[0] === 'delete-site') { store.trashSite(str(b.slug, 90)); return send(res, 200, { ok: true }); }
      if (p[0] === 'tip') { return send(res, 200, { tips: store.setTip(str(b.slug, 90), str(b.id, 40), str(b.status, 10)) }); }
      if (p[0] === 'decision') {
        const dec = store.setDecision(str(b.slug, 90), str(b.checkId, 60), str(b.status, 20), b.note);
        return send(res, 200, { decisions: dec });
      }
      if (p[0] === 'query') { // requêtes / prompts figés : ajout seulement
        const kind = b.kind === 'prompts' ? 'prompts' : 'queries';
        const text = str(b.text, 200).trim(); if (text.length < 3) return fail(res, 400, 'Texte trop court.');
        const item = kind === 'queries' ? { text, kind: b.voice ? 'voice' : 'text' } : { text };
        return send(res, 200, store.addFrozen(str(b.slug, 90), kind, item));
      }
      if (p[0] === 'check') { // vérification manuelle d'un contrôle
        const st = str(b.status, 12);
        if (!byId.has(b.checkId) || !['pass', 'fail', 'na', 'unverified'].includes(st)) return fail(res, 400, 'Contrôle ou statut invalide.');
        const snap = store.updateSnapshot(str(b.slug, 90), str(b.id, 20), (s) => { s.checks[b.checkId] = { status: st, evidence: str(b.evidence, 300) || undefined, manual: true }; if (!s.checks[b.checkId].evidence) delete s.checks[b.checkId].evidence; });
        return send(res, 200, auditView(b.slug, b.id));
      }
      if (p[0] === 'measure') {
        const kind = str(b.kind, 10), d = b.data || {};
        const snap = store.updateSnapshot(str(b.slug, 90), str(b.id, 20), (s) => {
          const date = today();
          if (kind === 'serp') {
            if (!ENGINE_RE.test(d.engine || '') || !d.query_id) throw new Error('Moteur ou requête manquant.');
            const pos = num(d.position);
            s.serp ??= { runs: [] };
            s.serp.runs.push({ engine: d.engine, query_id: str(d.query_id, 10), ...(d.location ? { location: str(d.location, 80) } : {}), position: pos, checked_top: num(d.checked_top) ?? 30, date, method: 'manual', country: 'fr', lang: 'fr' });
          } else if (kind === 'ai') {
            if (!ENGINE_RE.test(d.engine || '') || !d.prompt_id) throw new Error('IA ou prompt manquant.');
            s.ai ??= { method: 'manual', runs: [] };
            if (s.ai.method === 'skipped') s.ai.method = 'manual';
            const run = 1 + s.ai.runs.filter((r) => r.engine === d.engine && r.prompt_id === d.prompt_id).length;
            s.ai.runs.push({ prompt_id: str(d.prompt_id, 10), engine: d.engine, run, date, logged_in: false, mentioned: !!d.mentioned, cited: !!d.cited, rank_in_answer: d.mentioned ? num(d.rank_in_answer) : null, rank_in_sources: d.cited ? num(d.rank_in_sources) : null, competitors: str(d.competitors, 300).split(',').map((x) => x.trim()).filter(Boolean).slice(0, 10), note: str(d.note, 300) });
          } else if (kind === 'search') {
            s.search ??= {};
            s.search.gsc = { period: str(d.period || '28j', 10), clicks: num(d.clicks), impressions: num(d.impressions), avg_position: num(d.avg_position) };
            if (num(d.indexed_pages) != null) s.search.indexed_pages = num(d.indexed_pages);
            if (num(d.bing_citations) != null) { s.ai ??= { method: 'manual', runs: [] }; s.ai.bing = { period: '30j', total_citations: num(d.bing_citations) }; }
          } else if (kind === 'local') {
            s.local_presence ??= {};
            s.local_presence.gbp = { period: str(d.period || '30j', 10), search_views: num(d.search_views), maps_views: num(d.maps_views), calls: num(d.calls), directions: num(d.directions), website_clicks: num(d.website_clicks) };
          } else throw new Error('Type de mesure inconnu.');
        });
        return send(res, 200, auditView(b.slug, b.id));
      }
    }
    return fail(res, 404, 'Route inconnue');
  } catch (e) { return fail(res, 400, e.message); }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, 'http://x');
  const host = (req.headers.host || '').split(':')[0];
  if (!['127.0.0.1', 'localhost'].includes(host)) return fail(res, 403, 'Hôte refusé');
  if (req.method === 'POST') {
    const origin = req.headers.origin;
    if (req.headers['x-seolab'] !== '1' || (origin && !/^http:\/\/(127\.0\.0\.1|localhost)(:\d+)?$/.test(origin))) return fail(res, 403, 'Requête refusée');
  }
  if (url.pathname === '/favicon.ico') return send(res, 200, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32"><rect width="32" height="32" rx="7" fill="#0B4F4A"/><path d="M6 22a10 10 0 0 1 20 0" fill="none" stroke="#fff" stroke-width="4" stroke-linecap="round"/></svg>', MIME['.svg']);
  if (url.pathname.startsWith('/api/')) return api(req, res, url);
  let rel = url.pathname === '/' ? 'index.html' : decodeURIComponent(url.pathname).replace(/^\/+/, '');
  const file = normalize(join(PUB, rel));
  if (!file.startsWith(PUB + sep) || !existsSync(file) || !statSync(file).isFile()) return fail(res, 404, 'Introuvable');
  send(res, 200, readFileSync(file), MIME[extname(file)] || 'application/octet-stream');
});

const openBrowser = (u) => { if (!process.env.SEOLAB_OPEN) return; try { spawn(process.platform === 'win32' ? 'cmd' : process.platform === 'darwin' ? 'open' : 'xdg-open', process.platform === 'win32' ? ['/c', 'start', '', u] : [u], { detached: true, stdio: 'ignore' }).unref(); } catch {} };
function listen(port, tries = 0) {
  server.once('error', async (e) => {
    if (e.code !== 'EADDRINUSE' || tries >= 10) { console.error(e.message); process.exit(1); }
    // Déjà lancé ? On ouvre simplement la page existante.
    try { const r = await fetch(`http://127.0.0.1:${port}/api/sites`); if (r.ok) { console.log('SEO GEO Test tourne déjà : ouverture de la page.'); openBrowser(`http://127.0.0.1:${port}/`); setTimeout(() => process.exit(0), 500); return; } } catch {}
    listen(port + 1, tries + 1);
  });
  server.listen(port, '127.0.0.1', () => { PORT = port; console.log(`SEO GEO Test prêt : http://127.0.0.1:${port}/  (ferme cette fenêtre pour arrêter)`); openBrowser(`http://127.0.0.1:${port}/`); });
}
if (process.argv[1] && fileURLToPathSafe(process.argv[1]) === fileURLToPath(import.meta.url)) listen(+process.env.PORT || 4177);
function fileURLToPathSafe(p) { return p; }
export { server, listen };
