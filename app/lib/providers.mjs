// Mesures automatiques via des API officielles (clé de l'utilisateur). Aucune page Google ou IA n'est « aspirée ».
const BRAVE = process.env.SEOLAB_BRAVE_URL || 'https://api.search.brave.com/res/v1/web/search';
const GEMINI = process.env.SEOLAB_GEMINI_URL || 'https://generativelanguage.googleapis.com/v1beta/models';

export const hostOf = (u) => { try { return new URL(u).host.toLowerCase().replace(/^www\./, ''); } catch { return ''; } };
const same = (a, b) => !!a && !!b && (a === b || a.endsWith('.' + b) || b.endsWith('.' + a));
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

// Brave : position réelle du site dans les 20 premiers résultats (1 appel = 1 requête facturée sur le crédit)
export async function braveRank(query, siteHost, key, { country = 'FR', lang = 'fr', count = 20 } = {}) {
  const url = `${BRAVE}?${new URLSearchParams({ q: query, count: String(count), country, search_lang: lang })}`;
  const r = await fetch(url, { headers: { accept: 'application/json', 'x-subscription-token': key }, signal: AbortSignal.timeout(20000) });
  if (r.status === 401 || r.status === 403) throw new Error('Clé Brave refusée (vérifie la clé dans Réglages)');
  if (r.status === 429) throw new Error('Quota Brave atteint');
  if (!r.ok) throw new Error('Brave : erreur HTTP ' + r.status);
  const j = await r.json();
  const results = (j.web?.results || []).map((x) => x.url).filter(Boolean);
  const idx = results.findIndex((u) => same(hostOf(u), siteHost));
  return { position: idx >= 0 ? idx + 1 : null, checked_top: Math.max(count, results.length ? Math.min(count, results.length) : count), seen: results.length, competitors: [...new Set(results.slice(0, 5).map(hostOf).filter((h) => h && !same(h, siteHost)))] };
}

// Gemini avec « Google Search » : réponse + sources citées. Proche de ce que voient les gens, mais pas identique à l'application Gemini.
export async function geminiAsk(prompt, siteHost, brandTerms, key, model = 'gemini-2.5-flash') {
  const r = await fetch(`${GEMINI}/${encodeURIComponent(model)}:generateContent`, {
    method: 'POST', headers: { 'content-type': 'application/json', 'x-goog-api-key': key },
    body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }], tools: [{ google_search: {} }] }), signal: AbortSignal.timeout(60000),
  });
  if (r.status === 400 || r.status === 403) { const t = await r.text(); throw new Error('Gemini a refusé la requête (' + r.status + ') : ' + t.slice(0, 160)); }
  if (r.status === 429) throw new Error('Quota Gemini atteint (réessaie plus tard)');
  if (!r.ok) throw new Error('Gemini : erreur HTTP ' + r.status);
  const j = await r.json();
  const cand = j.candidates?.[0];
  const text = (cand?.content?.parts || []).map((p) => p.text || '').join(' ');
  const chunks = (cand?.groundingMetadata?.groundingChunks || []).map((c) => c.web).filter(Boolean);
  const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
  const t = norm(text);
  const terms = [siteHost, ...brandTerms].filter(Boolean).map(norm).filter((x) => x.length >= 3);
  const mentioned = terms.some((x) => t.includes(x));
  // Les liens de sources sont des redirections ; le titre porte en général le nom de domaine.
  const srcIdx = chunks.findIndex((c) => same(hostOf(/^https?:/.test(c.title || '') ? c.title : 'https://' + (c.title || '')), siteHost) || (c.title || '').toLowerCase().includes(siteHost));
  const competitors = [...new Set(chunks.map((c) => (c.title || '').toLowerCase()).filter((x) => x && !x.includes(siteHost)))].slice(0, 6);
  return { mentioned, cited: srcIdx >= 0, rank_in_sources: srcIdx >= 0 ? srcIdx + 1 : null, competitors, sources: chunks.length, answer_excerpt: text.slice(0, 280) };
}

// Export CSV Search Console (Requêtes.csv) : séparateur , ou ; ; nombres à la française acceptés.
export function parseGscCsv(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) throw new Error('Fichier vide');
  const sep = (lines[0].match(/;/g) || []).length > (lines[0].match(/,/g) || []).length ? ';' : ',';
  const split = (l) => { const out = []; let cur = '', q = false; for (const ch of l) { if (ch === '"') q = !q; else if (ch === sep && !q) { out.push(cur); cur = ''; } else cur += ch; } out.push(cur); return out.map((x) => x.trim()); };
  const head = split(lines[0]).map((h) => h.toLowerCase());
  const find = (...names) => head.findIndex((h) => names.some((n) => h.includes(n)));
  const iq = 0, ic = find('clic', 'click'), ii = find('impression'), ip = find('position');
  if (ic < 0 || ii < 0 || ip < 0) throw new Error('Colonnes Clics / Impressions / Position introuvables : exporte « Requêtes.csv » depuis Search Console.');
  const num = (s) => { const x = parseFloat(String(s).replace(/\s/g, '').replace('%', '').replace(',', '.')); return Number.isFinite(x) ? x : 0; };
  const rows = lines.slice(1).map((l) => { const c = split(l); return { q: c[iq], clicks: num(c[ic]), impressions: num(c[ii]), position: num(c[ip]) }; }).filter((r) => r.q);
  if (!rows.length) throw new Error('Aucune ligne exploitable');
  const clicks = rows.reduce((a, r) => a + r.clicks, 0), impressions = rows.reduce((a, r) => a + r.impressions, 0);
  const avg = impressions ? rows.reduce((a, r) => a + r.position * r.impressions, 0) / impressions : null;
  return { clicks, impressions, avg_position: avg == null ? null : Math.round(avg * 10) / 10, top_queries: rows.sort((a, b) => b.impressions - a.impressions).slice(0, 50), rows: rows.length };
}
export { wait };
