// Calculs purs : scores, comparaisons, agrégats. Aucune écriture, aucune donnée inventée.
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const catalog = JSON.parse(readFileSync(join(here, '..', 'data', 'checks.json'), 'utf8'));
export const byId = new Map(catalog.checks.map((c) => [c.id, c]));
export const SMALL_SAMPLE = 10;

export const applies = (c, profile = {}) => !c.applies || (c.applies === 'local' && profile.local) || (c.applies === 'multilingue' && profile.multilingual);
export const statusOf = (snap, id) => snap?.checks?.[id]?.status ?? 'unverified';
const isVerified = (s) => s === 'pass' || s === 'fail';
const r1 = (n) => Math.round(n * 10) / 10;

export function score(snap, only = null, domainsOnly = null) {
  const domains = {};
  for (const [d, meta] of Object.entries(catalog.domains)) if (!domainsOnly || domainsOnly.includes(d)) domains[d] = { label: meta.label, max: meta.max, earned: 0, possible: 0 };
  let applicable = 0, verified = 0;
  for (const c of catalog.checks) {
    if (!domains[c.domain] || !applies(c, snap.profile)) continue;
    if (only && !only.has(c.id)) continue;
    applicable++;
    const s = statusOf(snap, c.id);
    if (!isVerified(s)) continue;
    verified++;
    const w = catalog.weights[c.weight];
    domains[c.domain].possible += w;
    if (s === 'pass') domains[c.domain].earned += w;
  }
  let sum = 0, maxSum = 0;
  const out = {};
  for (const [d, v] of Object.entries(domains)) {
    if (!v.possible) { out[d] = { label: v.label, score: null, max: v.max }; continue; }
    const sc = (v.max * v.earned) / v.possible;
    out[d] = { label: v.label, score: r1(sc), max: v.max, pct: Math.round((v.earned / v.possible) * 100) };
    sum += sc; maxSum += v.max;
  }
  return { global: maxSum ? Math.round((sum / maxSum) * 100) : null, domains: out, applicable, verified, coverage: applicable ? Math.round((verified / applicable) * 100) : 0 };
}
// Deux scores séparés : SEO classique et préparation aux IA (GEO).
export const classicDomains = Object.keys(catalog.domains).filter((d) => d !== 'geo');
export function scores(snap, only = null) {
  return { all: score(snap, only), classic: score(snap, only, classicDomains), geo: score(snap, only, ['geo']) };
}

export function checkList(snap) {
  return catalog.checks.filter((c) => applies(c, snap.profile)).map((c) => ({
    id: c.id, domain: c.domain, domainLabel: catalog.domains[c.domain].label, weight: c.weight, label: c.label,
    status: statusOf(snap, c.id), evidence: snap.checks?.[c.id]?.evidence || '',
  }));
}

// --- IA : mentionné / cité, jamais de « rang » inventé
export function aiStats(snap, promptIds = null) {
  const res = {};
  for (const r of snap.ai?.runs ?? []) {
    if (promptIds && !promptIds.has(r.prompt_id)) continue;
    const e = (res[r.engine] ??= { engine: r.engine, n: 0, mentioned: 0, cited: 0, ranks: [], competitors: {} });
    e.n++;
    if (r.mentioned) e.mentioned++;
    if (r.cited) e.cited++;
    if (r.mentioned && typeof r.rank_in_answer === 'number') e.ranks.push(r.rank_in_answer);
    for (const c of r.competitors || []) e.competitors[c] = (e.competitors[c] || 0) + 1;
  }
  for (const e of Object.values(res)) {
    e.mentionRate = Math.round((e.mentioned / e.n) * 100);
    e.citeRate = Math.round((e.cited / e.n) * 100);
    e.avgRank = e.ranks.length ? r1(e.ranks.reduce((a, b) => a + b, 0) / e.ranks.length) : null;
    e.small = e.n < SMALL_SAMPLE;
  }
  return res;
}

// --- Moteurs classiques : meilleur rang observé par (moteur, requête, lieu)
export function serpMap(snap) {
  const m = new Map();
  for (const r of snap.serp?.runs ?? []) {
    const k = `${r.engine}|${r.query_id}|${r.location ?? ''}`;
    const cur = m.get(k) ?? { key: k, engine: r.engine, query_id: r.query_id, location: r.location ?? '', position: null, checked_top: r.checked_top ?? null, date: r.date };
    if (typeof r.position === 'number' && (cur.position === null || r.position < cur.position)) cur.position = r.position;
    m.set(k, cur);
  }
  return m;
}

const num = (a, b) => (typeof a === 'number' && typeof b === 'number' ? r1(b - a) : null);

export function diff(prev, curr) {
  const sp = scores(prev), sc = scores(curr);
  const common = new Set(catalog.checks.filter((c) => applies(c, prev.profile) && applies(c, curr.profile)
    && isVerified(statusOf(prev, c.id)) && isVerified(statusOf(curr, c.id))).map((c) => c.id));
  const kp = scores(prev, common), kc = scores(curr, common);
  const cats = { fixed: [], regressed: [], stillFailing: [], stillPassing: 0, gained: [], lost: [] };
  const brief = (c) => ({ id: c.id, label: c.label, weight: c.weight, domain: c.domain, domainLabel: catalog.domains[c.domain].label, evidence: curr.checks?.[c.id]?.evidence || '', prevEvidence: prev.checks?.[c.id]?.evidence || '' });
  for (const c of catalog.checks) {
    if (!applies(c, curr.profile)) continue;
    const a = statusOf(prev, c.id), b = statusOf(curr, c.id);
    if (a === 'fail' && b === 'pass') cats.fixed.push(brief(c));
    else if (a === 'pass' && b === 'fail') cats.regressed.push(brief(c));
    else if (a === 'fail' && b === 'fail') cats.stillFailing.push(brief(c));
    else if (a === 'pass' && b === 'pass') cats.stillPassing++;
    else if (!isVerified(a) && isVerified(b)) cats.gained.push({ ...brief(c), now: b });
    else if (isVerified(a) && !isVerified(b)) cats.lost.push({ ...brief(c), was: a });
  }
  // Moteurs
  const ma = serpMap(prev), mb = serpMap(curr);
  const serp = [];
  for (const [k, c] of mb) if (ma.has(k)) {
    const p = ma.get(k);
    let trend = 'absent';
    if (p.position != null && c.position != null) trend = p.position === c.position ? 'stable' : c.position < p.position ? 'up' : 'down';
    else if (p.position == null && c.position != null) trend = 'in';
    else if (p.position != null && c.position == null) trend = 'out';
    serp.push({ engine: c.engine, query_id: c.query_id, location: c.location, before: p.position, after: c.position, checked_top: c.checked_top, trend, delta: p.position != null && c.position != null ? p.position - c.position : null });
  }
  // IA
  const pa = new Set((prev.ai?.runs ?? []).map((r) => r.prompt_id)), pb = new Set((curr.ai?.runs ?? []).map((r) => r.prompt_id));
  const sharedPrompts = new Set([...pa].filter((x) => pb.has(x)));
  const aiA = aiStats(prev, sharedPrompts), aiB = aiStats(curr, sharedPrompts);
  const ai = Object.keys(aiB).filter((e) => aiA[e]).map((e) => ({
    engine: e, before: aiA[e], after: aiB[e],
    dMention: aiB[e].mentionRate - aiA[e].mentionRate, dCite: aiB[e].citeRate - aiA[e].citeRate,
    small: aiA[e].small || aiB[e].small,
  }));
  const days = Math.round((Date.parse(curr.date) - Date.parse(prev.date)) / 864e5);
  const g = (s, p) => p.split('.').reduce((o, k) => o?.[k], s);
  const metric = (p) => ({ before: g(prev, p) ?? null, after: g(curr, p) ?? null, delta: num(g(prev, p), g(curr, p)) });
  return {
    prevDate: prev.date, currDate: curr.date, days,
    scores: { global: { before: sp.all.global, after: sc.all.global, delta: num(sp.all.global, sc.all.global) },
      classic: { before: sp.classic.global, after: sc.classic.global, delta: num(sp.classic.global, sc.classic.global) },
      geo: { before: sp.geo.global, after: sc.geo.global, delta: num(sp.geo.global, sc.geo.global) },
      constant: { before: kp.all.global, after: kc.all.global, delta: num(kp.all.global, kc.all.global), checks: common.size },
      coverage: { before: sp.all.coverage, after: sc.all.coverage } },
    domains: Object.fromEntries(Object.keys(catalog.domains).map((d) => [d, { label: catalog.domains[d].label, max: catalog.domains[d].max, before: kp.all.domains[d]?.score ?? null, after: kc.all.domains[d]?.score ?? null }])),
    cats, serp, ai, sharedPrompts: sharedPrompts.size,
    metrics: { gsc_clicks: metric('search.gsc.clicks'), gsc_impressions: metric('search.gsc.impressions'), gsc_pos: metric('search.gsc.avg_position'), indexed: metric('search.indexed_pages'),
      bing_citations: metric('ai.bing.total_citations'), gbp_calls: metric('local_presence.gbp.calls'), gbp_directions: metric('local_presence.gbp.directions'), gbp_views: metric('local_presence.gbp.search_views') },
    methodChanged: (prev.ai?.method && curr.ai?.method && prev.ai.method !== curr.ai.method) || (!!prev.legacy),
    caveats: [
      days < 28 ? `Seulement ${days} jour(s) entre les deux audits : c'est court pour l'indexation et la visibilité dans les IA.` : null,
      common.size < 15 ? `Seulement ${common.size} contrôles comparables : l'écart de score est peu fiable.` : null,
      prev.legacy ? 'L\'audit précédent a été reconstitué depuis un ancien rapport : comparaison limitée aux contrôles communs.' : null,
    ].filter(Boolean),
  };
}

// Historique pour le graphique d'évolution
export function history(snaps) {
  return snaps.map((s) => { const x = scores(s); return { date: s.date, id: s.id, global: x.all.global, classic: x.classic.global, geo: x.geo.global, coverage: x.all.coverage, domains: Object.fromEntries(Object.entries(x.all.domains).map(([k, v]) => [k, v.score])) }; });
}
