// Analyse HTML tolérante, sans dépendance. Suffisante pour les contrôles SEO courants.
const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ', eacute: 'é', egrave: 'è', agrave: 'à', ecirc: 'ê', ccedil: 'ç', rsquo: '’', laquo: '«', raquo: '»', hellip: '…', ndash: '–', mdash: '—' };
export const decode = (s = '') =>
  String(s)
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(parseInt(d, 10)))
    .replace(/&([a-z]+);/gi, (m, n) => ENT[n.toLowerCase()] ?? m);

export function parseAttrs(str = '') {
  const out = {};
  const re = /([^\s=\/>"']+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s>]+)))?/g;
  let m;
  while ((m = re.exec(str))) out[m[1].toLowerCase()] = decode(m[2] ?? m[3] ?? m[4] ?? '');
  return out;
}

const stripTags = (s) => decode(s.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
const words = (s) => (s.match(/[\p{L}\p{N}’'-]+/gu) || []).length;

export function resolveUrl(href, base) {
  try { return new URL(href, base).href; } catch { return null; }
}

export function flattenLd(data, out = []) {
  if (Array.isArray(data)) { data.forEach((d) => flattenLd(d, out)); return out; }
  if (data && typeof data === 'object') {
    if (data['@graph']) flattenLd(data['@graph'], out);
    if (data['@type']) out.push(data);
    for (const k of ['mainEntity', 'about', 'publisher', 'author', 'provider']) if (data[k] && typeof data[k] === 'object') flattenLd(data[k], out);
  }
  return out;
}
export const typesOf = (node) => [].concat(node['@type'] || []).map(String);

export function parseHtml(rawHtml, baseUrl) {
  const html = rawHtml.replace(/<!--[\s\S]*?-->/g, '');
  const headMatch = html.match(/<head\b[\s\S]*?<\/head>/i);
  const head = headMatch ? headMatch[0] : '';
  const htmlTag = (html.match(/<html\b([^>]*)>/i) || [])[1] || '';
  const p = {
    lang: parseAttrs(htmlTag).lang || null,
    title: null, metaDesc: null, metaRobots: null, canonical: null, viewport: null,
    h: [], imgs: [], links: [], og: {}, twitter: {}, jsonld: [], hreflang: [], iframes: [],
    blockingScripts: 0, stylesheets: 0, assets: [], paragraphs: [], dates: [], timeTags: 0, metaKeywords: null, icon: false, fields: [], scripts: [],
  };
  const t = head.match(/<title[^>]*>([\s\S]*?)<\/title>/i) || html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (t) p.title = stripTags(t[1]);

  for (const m of html.matchAll(/<meta\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    const name = (a.name || a.property || '').toLowerCase();
    const content = a.content ?? '';
    if (name === 'description') p.metaDesc = content;
    else if (name === 'robots') p.metaRobots = content.toLowerCase();
    else if (name === 'viewport') p.viewport = content;
    else if (name === 'keywords') p.metaKeywords = content;
    else if (name.startsWith('og:')) p.og[name] = content;
    else if (name.startsWith('twitter:')) p.twitter[name] = content;
    else if (name === 'article:modified_time' || name === 'og:updated_time') p.dates.push(content);
  }
  for (const m of html.matchAll(/<link\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    const rel = (a.rel || '').toLowerCase();
    if (rel.split(/\s+/).includes('canonical') && a.href) p.canonical = resolveUrl(a.href, baseUrl);
    else if (/(^|\s)(icon|apple-touch-icon)(\s|$)/.test(rel) && a.href) p.icon = true;
    else if (rel === 'alternate' && a.hreflang && a.href) p.hreflang.push({ lang: a.hreflang, href: resolveUrl(a.href, baseUrl) });
    else if (rel === 'stylesheet' && a.href) { p.stylesheets++; p.assets.push(resolveUrl(a.href, baseUrl)); }
  }
  for (const m of head.matchAll(/<script\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    if (a.src && !('async' in a) && !('defer' in a) && (a.type || '').toLowerCase() !== 'module') p.blockingScripts++;
  }
  for (const m of html.matchAll(/<script\b([^>]*)>/gi)) { const a = parseAttrs(m[1]); if (a.src) p.scripts.push(resolveUrl(a.src, baseUrl)); }
  for (const m of html.matchAll(/<script\b([^>]*)\bsrc\s*=\s*["']([^"']+)["'][^>]*>/gi)) p.assets.push(resolveUrl(m[2], baseUrl));
  for (const m of html.matchAll(/<script\b[^>]*type\s*=\s*["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi)) {
    try { p.jsonld.push({ data: JSON.parse(m[1].trim()), error: null }); }
    catch (e) { p.jsonld.push({ data: null, error: e.message.slice(0, 80) }); }
  }
  for (const m of html.matchAll(/<h([1-6])\b[^>]*>([\s\S]*?)<\/h\1>/gi)) p.h.push({ level: +m[1], text: stripTags(m[2]) });
  for (const m of html.matchAll(/<img\b([^>]*)>/gi)) {
    const a = parseAttrs(m[1]);
    p.imgs.push({ src: a.src || a['data-src'] ? resolveUrl(a.src || a['data-src'], baseUrl) : null, hasAlt: 'alt' in a, alt: a.alt ?? '', width: a.width, height: a.height, loading: a.loading });
  }
  for (const m of html.matchAll(/<a\b([^>]*)>([\s\S]*?)<\/a>/gi)) {
    const a = parseAttrs(m[1]);
    if (a.href) p.links.push({ href: a.href, abs: resolveUrl(a.href, baseUrl), text: stripTags(m[2]), hreflang: a.hreflang, rel: a.rel || '' });
  }
  for (const m of html.matchAll(/<iframe\b([^>]*)>/gi)) { const a = parseAttrs(m[1]); if (a.src) p.iframes.push(a.src); }
  // Champs de formulaire et leurs étiquettes
  const forId = new Set([...html.matchAll(/<label\b([^>]*)>/gi)].map((m) => parseAttrs(m[1]).for).filter(Boolean));
  const marked = html.replace(/<label\b[^>]*>[\s\S]*?<\/label>/gi, (blk) => blk.replace(/<(input|select|textarea)\b/gi, '<$1 data-wrapped="1"'));
  for (const m of marked.matchAll(/<(input|select|textarea)\b([^>]*)>/gi)) {
    const a = parseAttrs(m[2]); const type = (a.type || 'text').toLowerCase();
    if (m[1].toLowerCase() === 'input' && ['hidden', 'submit', 'button', 'image', 'reset'].includes(type)) continue;
    const named = a['data-wrapped'] || (a.id && forId.has(a.id)) || a['aria-label'] || a['aria-labelledby'] || a.title;
    p.fields.push({ tag: m[1].toLowerCase(), type, name: a.name || a.id || '', labelled: !!named });
  }
  p.timeTags = (html.match(/<time\b[^>]*datetime=/gi) || []).length;

  // Texte visible
  const bodyHtml = (html.match(/<body\b[\s\S]*<\/body>/i) || [html])[0];
  const clean = bodyHtml.replace(/<(script|style|noscript|svg|template)\b[\s\S]*?<\/\1>/gi, ' ');
  p.text = stripTags(clean);
  p.wordCount = words(p.text);
  let lastHeading = null;
  for (const m of clean.matchAll(/<(h[1-6]|p)\b[^>]*>([\s\S]*?)<\/\1>/gi)) {
    const txt = stripTags(m[2]);
    if (m[1].toLowerCase() === 'p') { const w = words(txt); if (w >= 8) p.paragraphs.push({ words: w, heading: lastHeading, text: txt.slice(0, 120) }); }
    else lastHeading = txt;
  }
  p.rootShell = /<div\b[^>]*id\s*=\s*["'](root|app|__next|__nuxt)["']/i.test(bodyHtml) && p.wordCount < 80;
  p.nodes = p.jsonld.flatMap((j) => (j.data ? flattenLd(j.data) : []));
  return p;
}

export const norm = (s = '') => s.normalize('NFD').replace(/\p{M}/gu, '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
export function normUrl(u) {
  try {
    const x = new URL(u);
    x.hash = ''; x.search = '';
    let p = x.pathname.replace(/\/index\.html?$/i, '/');
    if (p.length > 1) p = p.replace(/\/+$/, '');
    return `${x.protocol}//${x.host.toLowerCase()}${p}`;
  } catch { return u; }
}
