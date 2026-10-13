// Moteur d'audit automatique : remplit les contrôles de checks.json qu'on peut vérifier
// de façon déterministe depuis le site réel. Les contrôles qui demandent du jugement ou un compte
// (Search Console, fiches Google/Apple, qualité du contenu) restent « unverified » (non vérifiés).
import { fetchPage, statusOf, pool, isLocalHost, parseRobots, robotBlocked } from './fetcher.mjs';
import { parseHtml, normUrl, norm, typesOf, decode } from './html.mjs';
import { measureSpeed } from './psi.mjs';

export const VERSION = '1.0';
const MAX_PAGES = 12;
const LOCAL_RE = /(LocalBusiness|Business$|Store$|Shop$|Restaurant|Plumber|Electrician|Locksmith|Dentist|Physician|Attorney|Notary|Salon|Bakery|Hotel|Contractor|^[A-Za-z]*Service$|Repair$|Clinic|Hospital|Pharmacy|Veterinar|RealEstateAgent|Gym)/;
const isLocalType = (t) => t !== 'Service' && LOCAL_RE.test(t);
const ORG_RE = /(Organization|Corporation|NGO)$/;
const GENERIC_ANCHOR = /^(cliquez ici|ici|en savoir plus|lire la suite|voir plus|click here|read more|learn more|plus d.?infos?|more)$/i;
const AI_SEARCH_BOTS = ['Googlebot', 'Bingbot', 'OAI-SearchBot', 'ChatGPT-User', 'PerplexityBot', 'Claude-SearchBot'];
// Identifiants (user-agent) des robots IA de recherche, pour tester si le CDN ou le pare-feu les refuse
const AI_PROBES = [
  ['OAI-SearchBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; OAI-SearchBot/1.0; +https://openai.com/searchbot'],
  ['ChatGPT-User', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko); compatible; ChatGPT-User/1.0; +https://openai.com/bot'],
  ['PerplexityBot', 'Mozilla/5.0 AppleWebKit/537.36 (KHTML, like Gecko; compatible; PerplexityBot/1.0; +https://perplexity.ai/perplexitybot)'],
  ['Claude-SearchBot', 'Mozilla/5.0 (compatible; Claude-SearchBot/1.0; +https://www.anthropic.com)'],
];
const CHALLENGE_RE = /cf-chl|Just a moment|Attention Required|_Incapsula_|Access Denied|captcha-delivery|px-captcha/i;
const AI_TRAIN_BOTS = ['GPTBot', 'ClaudeBot', 'Google-Extended', 'CCBot', 'Applebot-Extended'];

export function siteSlug(u) {
  const x = new URL(u);
  return x.host.toLowerCase().replace(/^www\./, '').replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'site';
}
export const today = () => new Date().toLocaleDateString('sv-SE');
const short = (u) => { try { const x = new URL(u); return x.pathname + (x.search || '') || '/'; } catch { return u; } };
const list = (a, n = 3) => (a.length <= n ? a.join(', ') : `${a.slice(0, n).join(', ')} (+${a.length - n})`);
const digits = (s) => String(s || '').replace(/[^\d+]/g, '').replace(/^\+33/, '0').replace(/^0033/, '0');
const sameHost = (a, b) => a.replace(/^www\./, '') === b.replace(/^www\./, '');
const flat = (a) => [].concat(...a);

function locs(xml) { return [...xml.matchAll(/<loc>\s*([\s\S]*?)\s*<\/loc>/gi)].map((m) => decode(m[1].trim())); }

export async function runAudit(opts, progress = () => {}) {
  let input = String(opts.url || '').trim();
  if (!/^https?:\/\//i.test(input)) input = 'https://' + input;
  const start = new URL(input);
  if (!/^https?:$/.test(start.protocol)) throw new Error('Adresse invalide');
  const checks = {};
  const set = (id, status, evidence) => { checks[id] = evidence ? { status, evidence } : { status }; };
  const notes = [];

  progress('Lecture de la page d\'accueil', 5);
  const home = await fetchPage(start.href);
  if (home.status === 0) throw new Error(`Site injoignable : ${home.error}`);
  const homeFinal = home.finalUrl;
  const hu = new URL(homeFinal);
  const origin = hu.origin;
  const local = isLocalHost(hu.host);

  progress('robots.txt et sitemap', 12);
  const robotsRes = await fetchPage(origin + '/robots.txt');
  const robotsOk = robotsRes.status === 200 && !/<html/i.test(robotsRes.body.slice(0, 300));
  const robots = robotsOk ? parseRobots(robotsRes.body) : { groups: [], sitemaps: [] };
  const smUrl = robots.sitemaps[0] || origin + '/sitemap.xml';
  const smRes = await fetchPage(smUrl);
  const smOk = smRes.status === 200 && /<urlset|<sitemapindex/i.test(smRes.body);
  let smLocs = [];
  if (smOk) {
    smLocs = locs(smRes.body);
    if (/<sitemapindex/i.test(smRes.body)) {
      const kids = await pool(smLocs.slice(0, 3), 3, (u) => fetchPage(u));
      smLocs = flat(kids.filter((k) => k.status === 200).map((k) => locs(k.body)));
    }
  }

  // Échantillon de pages
  const homeParsed = parseHtml(home.body, homeFinal);
  const sameOrigin = (u) => { try { return sameHost(new URL(u).host, hu.host); } catch { return false; } };
  const isDoc = (u) => !/\.(pdf|jpe?g|png|gif|webp|avif|svg|zip|mp4|css|js|xml|ico)(\?|$)/i.test(u);
  const seen = new Set([normUrl(homeFinal)]);
  const candidates = [];
  for (const u of [...smLocs, ...homeParsed.links.map((l) => l.abs).filter(Boolean)]) {
    if (!u || !/^https?:/.test(u) || !sameOrigin(u) || !isDoc(u)) continue;
    const k = normUrl(u);
    if (seen.has(k)) continue;
    seen.add(k); candidates.push(u.split('#')[0]);
    if (candidates.length >= MAX_PAGES - 1) break;
  }
  progress(`Analyse de ${candidates.length + 1} pages`, 22);
  const fetched = await pool(candidates, 4, (u) => fetchPage(u));
  const fetchedUniq = []; const finals = new Set([normUrl(homeFinal)]);
  for (const r of fetched) { const k = normUrl(r.finalUrl); if (r.status === 200 && finals.has(k)) continue; finals.add(k); fetchedUniq.push(r); }
  const pages = [{ ...home, parsed: homeParsed }, ...fetchedUniq.map((r) => ({ ...r, parsed: r.status === 200 && /html/i.test(r.headers['content-type'] || '') ? parseHtml(r.body, r.finalUrl) : null }))];
  const html = pages.filter((p) => p.parsed && p.status === 200);
  const nodes = flat(html.map((p) => p.parsed.nodes));

  // ---------- Profil ----------
  const localNode = nodes.find((n) => typesOf(n).some(isLocalType));
  const tels = homeParsed.links.filter((l) => /^tel:/i.test(l.href));
  const hasPostal = /\b\d{5}\s+[A-ZÀ-Ý][\p{L}' -]+/u.test(homeParsed.text);
  const langs = new Set(flat(html.map((p) => p.parsed.hreflang)).map((h) => h.lang.toLowerCase()).filter((l) => l !== 'x-default'));
  const profile = {
    local: opts.local ?? Boolean(localNode || (tels.length && hasPostal)),
    multilingual: opts.multilingual ?? langs.size >= 2,
    city: opts.city || localNode?.address?.addressLocality || null,
  };

  // ---------- Technique ----------
  progress('Contrôles techniques', 38);
  if (local) set('tech.https_redirect', 'na', 'site local (http normal)');
  else if (!homeFinal.startsWith('https://')) set('tech.https_redirect', 'fail', 'la page d\'accueil reste en http');
  else {
    const r = await fetchPage(`http://${hu.host}/`, { wantBody: false });
    if (r.status === 0) set('tech.https_redirect', 'unverified', `http:// non joignable (${r.error})`);
    else if (!r.chain.length) set('tech.https_redirect', 'fail', `http:// répond ${r.status} sans redirection`);
    else if (![301, 308].includes(r.chain[0].status)) set('tech.https_redirect', 'fail', `redirection http→https temporaire (${r.chain[0].status}), il faut un 301`);
    else if (!r.finalUrl.startsWith('https://')) set('tech.https_redirect', 'fail', 'http:// ne mène pas à https');
    else set('tech.https_redirect', r.redirects > 2 ? 'fail' : 'pass', `${r.redirects} redirection(s) jusqu'à ${r.finalUrl}`);
  }
  if (local || /^\d+\.\d+\.\d+\.\d+$/.test(hu.hostname)) set('tech.canonical_host', 'na', 'hôte local ou IP');
  else {
    const alt = hu.hostname.startsWith('www.') ? hu.hostname.slice(4) : 'www.' + hu.hostname;
    const r = await fetchPage(`${hu.protocol}//${alt}/`, { wantBody: false });
    if (r.status === 0) set('tech.canonical_host', 'pass', `${alt} n'est pas servi : pas de doublon`);
    else if (new URL(r.finalUrl).hostname === hu.hostname) set('tech.canonical_host', 'pass', `${alt} redirige vers ${hu.hostname}`);
    else if (r.status < 400) set('tech.canonical_host', 'fail', `${alt} sert aussi le site sans redirection (doublon)`);
    else set('tech.canonical_host', 'pass', `${alt} répond ${r.status}`);
  }
  if (!robotsOk) set('tech.robots_ok', 'fail', `robots.txt absent (HTTP ${robotsRes.status || robotsRes.error})`);
  else if (robotBlocked(robots, '*')) set('tech.robots_ok', 'fail', 'Disallow: / pour tous les robots : le site est bloqué');
  else if (!robots.sitemaps.length) set('tech.robots_ok', 'fail', 'robots.txt sans ligne « Sitemap: »');
  else set('tech.robots_ok', 'pass');

  if (!smOk) set('tech.sitemap_ok', 'fail', `sitemap introuvable à ${smUrl} (HTTP ${smRes.status || smRes.error})`);
  else {
    const probe = smLocs.filter(sameOrigin).slice(0, 8);
    const st = await pool(probe, 4, (u) => statusOf(u));
    const bad = probe.map((u, i) => ({ u, s: st[i] })).filter((x) => x.s.status !== 200 || normUrl(x.s.finalUrl) !== normUrl(x.u)).map((x) => `${short(x.u)} → ${x.s.status || x.s.error}${x.s.redirects ? ' (redirigée)' : ''}`);
    if (!smLocs.length) set('tech.sitemap_ok', 'fail', 'sitemap vide');
    else set('tech.sitemap_ok', bad.length ? 'fail' : 'pass', bad.length ? `URLs du sitemap à corriger : ${list(bad)}` : `${smLocs.length} URL(s), échantillon valide`);
  }
  const noidx = html.filter((p) => /noindex/.test(p.parsed.metaRobots || '') || /noindex/i.test(p.headers['x-robots-tag'] || '')).map((p) => short(p.finalUrl));
  set('tech.no_noindex', noidx.length ? 'fail' : 'pass', noidx.length ? `noindex sur : ${list(noidx)}` : undefined);
  const canBad = html.filter((p) => !p.parsed.canonical || normUrl(p.parsed.canonical) !== normUrl(p.finalUrl)).map((p) => `${short(p.finalUrl)} ${p.parsed.canonical ? '→ ' + short(p.parsed.canonical) : '(absent)'}`);
  set('tech.canonical_tag', canBad.length ? 'fail' : 'pass', canBad.length ? `canonical manquant ou différent : ${list(canBad)}` : undefined);
  const chains = pages.filter((p) => p.redirects > 1).map((p) => `${short(p.url)} (${p.redirects} redirections)`);
  set('tech.no_redirect_chains', chains.length ? 'fail' : 'pass', chains.length ? list(chains) : undefined);

  progress('Vérification des liens internes', 50);
  const okPages = pages.filter((p) => p.status >= 200 && p.status < 400);
  const known = new Set(okPages.map((p) => normUrl(p.url)).concat(okPages.map((p) => normUrl(p.finalUrl))));
  const linkSet = new Map();
  for (const p of html) for (const l of p.parsed.links) {
    if (!l.abs || !/^https?:/.test(l.abs) || !sameOrigin(l.abs)) continue;
    const u = l.abs.split('#')[0]; const k = normUrl(u);
    if (!known.has(k) && !linkSet.has(k)) linkSet.set(k, u);
  }
  const toCheck = [...linkSet.values()].slice(0, 40);
  const lst = await pool(toCheck, 6, (u) => statusOf(u));
  const broken = toCheck.map((u, i) => ({ u, s: lst[i] })).filter((x) => x.s.status === 0 || x.s.status >= 400).map((x) => `${short(x.u)} → ${x.s.status || 'injoignable'}`);
  set('tech.no_broken_links', broken.length ? 'fail' : 'pass', broken.length ? `liens cassés : ${list(broken)}` : `${toCheck.length} lien(s) interne(s) testé(s)`);
  const hw = homeParsed.wordCount;
  set('tech.content_in_html', hw >= 120 && !homeParsed.rootShell ? 'pass' : 'fail', hw >= 120 && !homeParsed.rootShell ? undefined : `${hw} mots dans le HTML initial${homeParsed.rootShell ? ' (coquille vide : le contenu dépend de JavaScript)' : ''}`);

  // ---------- Contenu ----------
  progress('Contenu et balises', 60);
  const bad = (fn) => html.filter((p) => fn(p.parsed)).map((p) => short(p.finalUrl));
  const langBad = bad((q) => !q.lang || !/^[a-z]{2,3}(-[A-Za-z0-9]+)*$/.test(q.lang));
  set('content.lang_attr', langBad.length ? 'fail' : 'pass', langBad.length ? `attribut lang absent ou invalide : ${list(langBad)}` : `lang="${homeParsed.lang}"`);
  const titles = html.map((p) => ({ u: short(p.finalUrl), t: p.parsed.title || '' }));
  const tIssues = [];
  for (const x of titles) { if (!x.t) tIssues.push(`${x.u} : title absent`); else if (x.t.length < 25) tIssues.push(`${x.u} : trop court (${x.t.length})`); else if (x.t.length > 65) tIssues.push(`${x.u} : trop long (${x.t.length})`); }
  const dupT = titles.filter((x, i) => x.t && titles.findIndex((y) => norm(y.t) === norm(x.t)) !== i).map((x) => x.u);
  if (dupT.length) tIssues.push(`doublons : ${list(dupT)}`);
  set('content.title', tIssues.length ? 'fail' : 'pass', tIssues.length ? list(tIssues) : `« ${homeParsed.title} »`);
  const descs = html.map((p) => ({ u: short(p.finalUrl), d: p.parsed.metaDesc || '' }));
  const dIssues = [];
  for (const x of descs) { if (!x.d) dIssues.push(`${x.u} : absente`); else if (x.d.length < 70) dIssues.push(`${x.u} : trop courte (${x.d.length})`); else if (x.d.length > 170) dIssues.push(`${x.u} : trop longue (${x.d.length})`); }
  const dupD = descs.filter((x, i) => x.d && descs.findIndex((y) => norm(y.d) === norm(x.d)) !== i).map((x) => x.u);
  if (dupD.length) dIssues.push(`doublons : ${list(dupD)}`);
  set('content.meta_description', dIssues.length ? 'fail' : 'pass', dIssues.length ? list(dIssues) : undefined);
  const h1Bad = html.map((p) => ({ u: short(p.finalUrl), n: p.parsed.h.filter((h) => h.level === 1 && h.text).length })).filter((x) => x.n !== 1).map((x) => `${x.u} : ${x.n} H1`);
  set('content.single_h1', h1Bad.length ? 'fail' : 'pass', h1Bad.length ? list(h1Bad) : `H1 : « ${homeParsed.h.find((h) => h.level === 1)?.text || ''} »`);
  const hierBad = html.filter((p) => p.parsed.h.some((h, i, a) => i > 0 && h.level > a[i - 1].level + 1)).map((p) => short(p.finalUrl));
  set('content.heading_hierarchy', hierBad.length ? 'fail' : 'pass', hierBad.length ? `niveaux de titres sautés sur : ${list(hierBad)}` : undefined);
  const intl = html.map((p) => p.parsed.links.filter((l) => l.abs && sameOrigin(l.abs)));
  const avgLinks = intl.reduce((s, a) => s + a.length, 0) / (html.length || 1);
  const generic = intl.flat().filter((l) => GENERIC_ANCHOR.test(l.text.trim())).length;
  const gRatio = generic / (intl.flat().length || 1);
  set('content.internal_links', avgLinks >= 3 && gRatio < 0.3 ? 'pass' : 'fail', avgLinks >= 3 && gRatio < 0.3 ? `${avgLinks.toFixed(1)} liens internes par page en moyenne` : `${avgLinks.toFixed(1)} liens internes par page, ${Math.round(gRatio * 100)} % d'ancres génériques (« en savoir plus »)`);
  const allImgs = flat(html.map((p) => p.parsed.imgs));
  const noAlt = allImgs.filter((i) => !i.hasAlt);
  if (!allImgs.length) set('content.img_alt', 'na', 'aucune image');
  else set('content.img_alt', noAlt.length / allImgs.length <= 0.05 ? 'pass' : 'fail', noAlt.length ? `${noAlt.length} image(s) sur ${allImgs.length} sans attribut alt : ${list(noAlt.map((i) => short(i.src || '?')))}` : `${allImgs.length} image(s), toutes avec alt`);
  const missingOg = ['og:title', 'og:description', 'og:image', 'og:url'].filter((k) => !homeParsed.og[k]);
  set('content.open_graph', missingOg.length ? 'fail' : 'pass', missingOg.length ? `balises manquantes : ${missingOg.join(', ')}` : undefined);
  set('content.twitter_card', homeParsed.twitter['twitter:card'] ? 'pass' : 'fail', homeParsed.twitter['twitter:card'] ? undefined : 'twitter:card absent');
  const lk = homeParsed.links.map((l) => (l.href + ' ' + l.text).toLowerCase());
  const hasC = lk.some((x) => /contact/.test(x)); const hasL = lk.some((x) => /mentions|legal|légal|cgv|cgu/.test(x)); const hasP = lk.some((x) => /confidentialit|privacy|rgpd|cookies/.test(x));
  set('content.trust_pages', hasC && (hasL || hasP) ? 'pass' : 'fail', hasC && (hasL || hasP) ? undefined : `manquant sur l'accueil : ${[!hasC && 'contact', !hasL && 'mentions légales', !hasP && 'confidentialité'].filter(Boolean).join(', ')}`);
  // Doublons de contenu entre pages (échantillon)
  const sig = html.map((p) => ({ u: short(p.finalUrl), s: new Set(p.parsed.text.toLowerCase().split(/\s+/).filter((w) => w.length > 3)) })).filter((x) => x.s.size > 60);
  const dupPairs = [];
  for (let i = 0; i < sig.length; i++) for (let j = i + 1; j < sig.length; j++) {
    const inter = [...sig[i].s].filter((w) => sig[j].s.has(w)).length;
    if (inter / Math.min(sig[i].s.size, sig[j].s.size) > 0.85) dupPairs.push(`${sig[i].u} ≈ ${sig[j].u}`);
  }
  if (dupPairs.length) set('content.useful_unique', 'fail', `pages au contenu très proche : ${list(dupPairs)}`);

  // ---------- Performance ----------
  progress('Poids des images et cache', 70);
  const imgs = [...new Map(homeParsed.imgs.filter((i) => i.src).map((i) => [i.src, i])).values()].slice(0, 12);
  if (!imgs.length) set('perf.image_weight', 'na', 'aucune image sur l\'accueil');
  else {
    const st = await pool(imgs, 6, (i) => statusOf(i.src));
    const sized = imgs.map((i, k) => ({ i, len: +st[k].headers['content-length'] || null }));
    const known = sized.filter((x) => x.len);
    const heavy = known.filter((x) => x.len > 300_000 || (/\.(png|jpe?g|gif)(\?|$)/i.test(x.i.src) && x.len > 120_000)).map((x) => `${short(x.i.src)} (${Math.round(x.len / 1000)} Ko)`);
    const noDim = imgs.filter((i) => !(i.width && i.height)).length;
    if (!known.length) set('perf.image_weight', 'unverified', 'tailles d\'images non lisibles');
    else set('perf.image_weight', heavy.length || noDim / imgs.length > 0.6 ? 'fail' : 'pass', heavy.length ? `images lourdes ou en format ancien : ${list(heavy)}` : noDim / imgs.length > 0.6 ? `${noDim}/${imgs.length} images sans width/height (risque de saut de mise en page)` : undefined);
  }
  set('perf.render_blocking', homeParsed.blockingScripts <= 2 && homeParsed.stylesheets <= 5 ? 'pass' : 'fail', `${homeParsed.blockingScripts} script(s) bloquant(s) dans <head>, ${homeParsed.stylesheets} feuille(s) de style`);
  const enc = home.headers['content-encoding'] || '';
  const assets = [...new Set(homeParsed.assets.filter((u) => u && sameOrigin(u)))].slice(0, 5);
  const ast = await pool(assets, 5, (u) => statusOf(u));
  const longCache = ast.filter((r) => { const cc = r.headers['cache-control'] || ''; const m = cc.match(/max-age=(\d+)/); return /immutable/.test(cc) || (m && +m[1] >= 604800); }).length;
  const compOk = /gzip|br|zstd|deflate/.test(enc);
  const cacheOk = !assets.length || longCache >= Math.ceil(assets.length / 2);
  set('perf.compression_cache', compOk && cacheOk ? 'pass' : 'fail', `HTML compressé : ${compOk ? 'oui (' + enc + ')' : 'non'} ; fichiers statiques à cache long : ${longCache}/${assets.length}`);
  if (opts.psi !== false && !local) {
    progress('Vitesse réelle (PageSpeed Insights)', 78);
    const sp = await measureSpeed(homeFinal);
    notes.push(sp.error ? `PageSpeed Insights indisponible : ${sp.error}` : `Vitesse mesurée par PageSpeed Insights (${sp.source})`);
    if (!sp.error) {
      if (sp.lcp_ms != null) set('perf.lcp', sp.lcp_ms < 2500 ? 'pass' : 'fail', `LCP ${(sp.lcp_ms / 1000).toFixed(1)} s (${sp.source})`);
      if (sp.cls != null) set('perf.cls', sp.cls < 0.1 ? 'pass' : 'fail', `CLS ${sp.cls} (${sp.source})`);
      if (sp.inp_ms != null) set('perf.inp', sp.inp_ms < 200 ? 'pass' : 'fail', `INP ${sp.inp_ms} ms (${sp.source})`);
    }
    var psiInfo = sp;
  }

  // ---------- GEO ----------
  progress('Lisibilité pour les IA', 84);
  const robotsBlocked = robotsOk ? AI_SEARCH_BOTS.filter((b) => robotBlocked(robots, b)) : [];
  const trainBlocked = robotsOk ? AI_TRAIN_BOTS.filter((b) => robotBlocked(robots, b)) : [];
  // Test réel : le CDN ou le pare-feu peut refuser ces robots même si robots.txt les autorise
  let cdnBlocked = [], cdnTested = false;
  const baseOk = home.status >= 200 && home.status < 400 && !CHALLENGE_RE.test(home.body.slice(0, 4000));
  if ((!local || opts.forceAiProbe) && baseOk) {
    const probes = await pool(AI_PROBES, 4, async ([name, ua]) => {
      const r = await fetchPage(homeFinal, { userAgent: ua, timeout: 10000 });
      return { name, refused: [401, 403, 429, 451, 503].includes(r.status) || (r.status >= 200 && r.status < 300 && CHALLENGE_RE.test(r.body.slice(0, 4000))), unreachable: r.status === 0 };
    });
    cdnTested = probes.some((x) => !x.unreachable);
    cdnBlocked = probes.filter((x) => x.refused).map((x) => x.name);
  }
  const parts = [];
  if (robotsBlocked.length) parts.push(`robots de recherche bloqués : ${robotsBlocked.join(', ')}`);
  if (cdnBlocked.length) parts.push(`robots de recherche refusés par le CDN ou le pare-feu : ${cdnBlocked.join(', ')} (test avec leur identifiant ; à confirmer dans les réglages du CDN)`);
  if (parts.length) set('geo.ai_crawlers_allowed', 'fail', parts.join(' ; '));
  else if (!robotsOk) set('geo.ai_crawlers_allowed', 'pass', 'pas de robots.txt : aucun robot bloqué' + (cdnTested ? ' ; accès réel testé, aucun refus du CDN' : ''));
  else set('geo.ai_crawlers_allowed', 'pass', (trainBlocked.length ? `robots de recherche autorisés ; robots d'entraînement bloqués (choix possible) : ${trainBlocked.join(', ')}` : 'robots de recherche et d\'entraînement autorisés') + (cdnTested ? ' ; accès réel testé, aucun refus du CDN' : ''));
  const answerBlocks = flat(html.map((p) => p.parsed.paragraphs)).filter((q) => q.words >= 40 && q.words <= 150).length;
  set('geo.answer_blocks', answerBlocks >= 3 ? 'pass' : 'fail', `heuristique : ${answerBlocks} paragraphe(s) autonome(s) de 40 à 150 mots`);
  const hs = flat(html.map((p) => p.parsed.h.filter((h) => h.level >= 2 && h.level <= 3)));
  const qHead = hs.filter((h) => /\?$|^(comment|pourquoi|quel|quelle|quels|quelles|combien|qu'est|quand|où|que |est-ce)/i.test(h.text)).length;
  const longHead = hs.filter((h) => h.text.split(/\s+/).length >= 3).length;
  set('geo.question_headings', hs.length >= 3 && (qHead >= 1 || longHead / hs.length >= 0.6) ? 'pass' : 'fail', `heuristique : ${hs.length} titre(s) H2/H3, dont ${qHead} formulé(s) en question`);
  const org = nodes.find((n) => typesOf(n).some((t) => isLocalType(t) || ORG_RE.test(t)));
  if (org?.name) {
    const nm = norm(org.name);
    const inText = norm(homeParsed.text).includes(nm);
    const inHead = norm(homeParsed.title || '').includes(nm) || homeParsed.h.some((h) => norm(h.text).includes(nm));
    set('geo.entity_consistency', inText && inHead ? 'pass' : 'fail', inText && inHead ? `« ${org.name} » cohérent entre schema, titre et texte` : `le nom du schema (« ${org.name} ») n'apparaît pas ${!inText ? 'dans le texte' : 'dans le titre ni les H1/H2'}`);
  }
  const aboutLink = lk.some((x) => /a-propos|à propos|about|equipe|équipe|qui-sommes|notre-histoire/.test(x));
  set('geo.identifiable_author', (aboutLink || org) && hasC ? 'pass' : 'fail', (aboutLink || org) && hasC ? undefined : 'pas de page « à propos / équipe » ni de schema Organization identifiable, ou contact absent');
  const fresh = nodes.some((n) => n.dateModified || n.datePublished) || html.some((p) => p.parsed.timeTags || p.parsed.dates.length);
  set('geo.freshness', fresh ? 'pass' : 'na', fresh ? undefined : 'pas de contenu daté (page vitrine)');

  // ---------- Données structurées ----------
  progress('Données structurées', 90);
  const blocks = flat(html.map((p) => p.parsed.jsonld));
  if (!blocks.length) {
    set('data.jsonld_present', 'fail', 'aucun JSON-LD détecté');
    for (const id of ['data.jsonld_valid', 'data.matches_content']) set(id, 'na', 'pas de JSON-LD');
  } else {
    set('data.jsonld_present', 'pass', `${blocks.length} bloc(s), types : ${list([...new Set(nodes.flatMap(typesOf))], 6)}`);
    const REQ = { Organization: ['name'], WebSite: ['name', 'url'], Article: ['headline'], BlogPosting: ['headline'], Product: ['name'], BreadcrumbList: ['itemListElement'], Person: ['name'] };
    const errs = blocks.filter((b) => b.error).map((b) => `JSON invalide (${b.error})`);
    for (const n of nodes) for (const t of typesOf(n)) {
      const req = isLocalType(t) ? ['name', 'address'] : REQ[t];
      const miss = (req || []).filter((k) => !n[k]);
      if (miss.length) errs.push(`${t} : propriété(s) manquante(s) ${miss.join(', ')}`);
    }
    set('data.jsonld_valid', errs.length ? 'fail' : 'pass', errs.length ? list(errs) : undefined);
    const bn = nodes.find((n) => typesOf(n).some((t) => isLocalType(t) || ORG_RE.test(t)));
    if (bn) {
      const txt = norm(homeParsed.text); const phoneTxt = digits(homeParsed.text + ' ' + tels.map((t) => t.href).join(' '));
      const miss = [];
      if (bn.name && !txt.includes(norm(bn.name))) miss.push('nom');
      if (bn.telephone && !phoneTxt.includes(digits(bn.telephone).replace(/^\+/, ''))) miss.push('téléphone');
      const st = bn.address?.streetAddress; if (st && !txt.includes(norm(st))) miss.push('adresse');
      set('data.matches_content', miss.length ? 'fail' : 'pass', miss.length ? `le balisage annonce des informations absentes de la page : ${miss.join(', ')}` : undefined);
    } else set('data.matches_content', 'na', 'pas de schéma entreprise');
  }
  set('data.org_or_business', org ? 'pass' : 'fail', org ? `type : ${typesOf(org).join(', ')}` : 'ni Organization ni LocalBusiness');
  set('data.breadcrumb_website', nodes.some((n) => typesOf(n).some((t) => t === 'WebSite' || t === 'BreadcrumbList')) ? 'pass' : 'fail', undefined);

  // ---------- Local ----------
  if (profile.local) {
    progress('Contrôles locaux', 94);
    const pagePhones = new Set([...tels.map((t) => digits(t.href.replace(/^tel:/i, ''))), ...((homeParsed.text.match(/(?:\+33|0)\s?[1-9](?:[\s.\-]?\d{2}){4}/g)) || []).map(digits)]);
    const schemaPhone = localNode?.telephone ? digits(localNode.telephone) : null;
    const problems = [];
    const pageTxt = norm(homeParsed.text);
    if (!pagePhones.size) problems.push('aucun numéro de téléphone détecté sur l\'accueil');
    else if (schemaPhone && ![...pagePhones].some((p) => p.endsWith(schemaPhone.slice(-9)))) problems.push(`téléphone du balisage (${localNode.telephone}) absent du texte et des liens tel:`);
    else if (new Set([...pagePhones].map((p) => p.slice(-9))).size > 1) problems.push(`plusieurs numéros différents sur l'accueil : ${list([...pagePhones])}`);
    const schemaStreet = localNode?.address?.streetAddress;
    if (localNode?.name && !pageTxt.includes(norm(localNode.name))) problems.push(`nom du balisage (${localNode.name}) absent du texte de l'accueil`);
    if (schemaStreet && !pageTxt.includes(norm(schemaStreet))) problems.push(`adresse du balisage (${schemaStreet}) absente du texte de l'accueil`);
    if (problems.length) set('local.nap_consistent', 'fail', problems.join(' ; '));
    else if (localNode) set('local.nap_consistent', 'pass', `numéro, nom et adresse cohérents entre la page et le balisage : ${[...pagePhones][0]} (le contrôle avec la fiche Google reste à faire)`);
    else set('local.nap_consistent', 'pass', `numéro cohérent : ${[...pagePhones][0]} (le contrôle avec la fiche Google reste à faire)`);
    if (localNode) {
      const a = localNode.address || {};
      const miss = [];
      if (!localNode.name) miss.push('name'); if (!a.addressLocality) miss.push('addressLocality'); if (!a.postalCode) miss.push('postalCode'); if (!a.streetAddress) miss.push('streetAddress (facultatif si zone de service)');
      if (!localNode.telephone) miss.push('telephone'); if (!(localNode.openingHoursSpecification || localNode.openingHours)) miss.push('horaires'); if (!(localNode.geo || localNode.areaServed)) miss.push('geo ou areaServed');
      const hard = miss.filter((m) => !m.startsWith('streetAddress'));
      set('local.localbusiness_schema', hard.length ? 'fail' : 'pass', miss.length ? `propriétés manquantes : ${miss.join(', ')}` : undefined);
    } else set('local.localbusiness_schema', 'fail', 'pas de LocalBusiness (ou sous-type précis) dans le JSON-LD');
    if (profile.city) {
      const c = norm(profile.city);
      const inT = norm(homeParsed.title || '').includes(c); const inH = homeParsed.h.some((h) => h.level === 1 && norm(h.text).includes(c));
      set('local.keywords_title_h1', inT && inH ? 'pass' : 'fail', inT && inH ? `« ${profile.city} » présent dans le title et le H1` : `« ${profile.city} » absent ${!inT ? 'du title' : ''}${!inT && !inH ? ' et ' : ''}${!inH ? 'du H1' : ''}`);
    }
    const mapOk = homeParsed.iframes.some((s) => /google\.[a-z.]+\/maps|openstreetmap|maps\.apple|mapbox/i.test(s)) || homeParsed.links.some((l) => /maps\.google|google\.[a-z.]+\/maps|goo\.gl\/maps|maps\.app\.goo\.gl|openstreetmap|maps\.apple/i.test(l.href));
    const hoursOk = Boolean(localNode?.openingHoursSpecification || localNode?.openingHours) || /\b(lun|mar|mer|jeu|ven|sam|dim)[a-zéû]*\.?\s*[:\-–]?\s*\d{1,2}\s?[h:]/i.test(homeParsed.text) || /horaires|ouvert/i.test(homeParsed.text);
    const missing = [!tels.length && 'lien téléphone cliquable (tel:)', !mapOk && 'plan ou lien Maps', !hoursOk && 'horaires'].filter(Boolean);
    set('local.contact_map_hours', missing.length ? 'fail' : 'pass', missing.length ? `manquant : ${missing.join(', ')}` : undefined);
    const hasRating = nodes.some((n) => n.aggregateRating || n.review);
    if (!hasRating) set('local.genuine_reviews', 'na', 'aucun balisage d\'avis');
    else set('local.genuine_reviews', /avis|témoignage|review/i.test(homeParsed.text) ? 'pass' : 'fail', /avis|témoignage|review/i.test(homeParsed.text) ? 'avis visibles sur la page' : 'balisage d\'avis sans avis visibles sur la page (non conforme)');
  }

  // ---------- International ----------
  if (profile.multilingual) {
    progress('Contrôles multilingues', 96);
    const alts = homeParsed.hreflang;
    if (!alts.length) {
      for (const id of ['intl.hreflang_reciprocal', 'intl.hreflang_codes', 'intl.canonical_per_lang', 'intl.lang_per_version', 'intl.sitemap_all_langs']) set(id, 'fail', 'aucune balise hreflang sur l\'accueil');
      set('intl.switcher_links', homeParsed.links.some((l) => l.hreflang) ? 'pass' : 'fail', undefined);
    } else {
      const bad = alts.filter((a) => !/^(x-default|[a-z]{2,3}(-[A-Za-z]{2,4})?)$/.test(a.lang)).map((a) => a.lang);
      const hasDef = alts.some((a) => a.lang.toLowerCase() === 'x-default');
      set('intl.hreflang_codes', bad.length || !hasDef ? 'fail' : 'pass', bad.length ? `codes invalides : ${bad.join(', ')}` : !hasDef ? 'x-default manquant' : undefined);
      const targets = alts.filter((a) => a.lang !== 'x-default' && a.href).slice(0, 6);
      const altPages = await pool(targets, 3, async (a) => { const r = await fetchPage(a.href); return { a, r, p: r.status === 200 ? parseHtml(r.body, r.finalUrl) : null }; });
      const nonRecip = []; const canBad2 = []; const langBad2 = [];
      for (const { a, r, p } of altPages) {
        if (!p) { nonRecip.push(`${a.lang} (${short(a.href)} : HTTP ${r.status || r.error})`); continue; }
        const back = p.hreflang.map((h) => normUrl(h.href));
        if (!back.includes(normUrl(homeFinal)) || !back.includes(normUrl(r.finalUrl))) nonRecip.push(`${a.lang} ne référence pas toutes les versions`);
        if (!p.canonical || normUrl(p.canonical) !== normUrl(r.finalUrl)) canBad2.push(`${a.lang} (${short(r.finalUrl)})`);
        if (!p.lang || p.lang.toLowerCase().split('-')[0] !== a.lang.toLowerCase().split('-')[0]) langBad2.push(`${a.lang} → lang="${p.lang || 'absent'}"`);
      }
      set('intl.hreflang_reciprocal', nonRecip.length ? 'fail' : 'pass', nonRecip.length ? list(nonRecip) : undefined);
      set('intl.canonical_per_lang', canBad2.length ? 'fail' : 'pass', canBad2.length ? `canonical non auto-référent : ${list(canBad2)}` : undefined);
      set('intl.lang_per_version', langBad2.length ? 'fail' : 'pass', langBad2.length ? list(langBad2) : undefined);
      const altHrefs = new Set(alts.map((a) => normUrl(a.href)));
      set('intl.switcher_links', homeParsed.links.some((l) => l.hreflang || (l.abs && altHrefs.has(normUrl(l.abs)) && normUrl(l.abs) !== normUrl(homeFinal))) ? 'pass' : 'fail', undefined);
      const inSm = [...altHrefs].filter((u) => smLocs.map(normUrl).includes(u)).length;
      set('intl.sitemap_all_langs', smOk && (inSm === altHrefs.size || /xhtml:link/i.test(smRes.body)) ? 'pass' : 'fail', smOk ? undefined : 'sitemap introuvable');
    }
  }


  // ---------- Checklist webdesign / mise en ligne ----------
  progress('Checklist webdesign et mise en ligne', 96);
  const hasViewport = !!homeParsed.viewport && /width\s*=\s*device-width/i.test(homeParsed.viewport);
  if (!hasViewport) set('ux.responsive', 'fail', 'balise viewport « width=device-width » absente : la page ne s\'adapte pas au mobile');
  else set('ux.responsive', 'unverified', 'viewport présent ; absence de débordement et taille des cibles tactiles à vérifier sur un vrai mobile');
  // étiquettes de formulaires
  const fields = flat(html.map((p) => p.parsed.fields));
  if (!fields.length) set('ux.form_labels', 'na', 'aucun formulaire détecté dans les pages analysées');
  else {
    const bad = fields.filter((f) => !f.labelled);
    set('ux.form_labels', bad.length ? 'fail' : 'pass', bad.length ? `${bad.length}/${fields.length} champ(s) sans étiquette : ${list(bad.map((f) => f.name || f.type))}` : `${fields.length} champ(s) étiqueté(s)`);
  }
  // page 404
  const nf = await fetchPage(`${origin}/seolab-page-inexistante-${Math.random().toString(36).slice(2, 8)}`);
  if (nf.status === 200) set('ux.custom_404', 'fail', 'une adresse inexistante renvoie 200 (fausse page 404 : mauvais pour Google)');
  else if (nf.status === 404 || nf.status === 410) {
    const pn = parseHtml(nf.body || '', nf.finalUrl);
    const custom = pn.wordCount >= 8 && pn.links.length >= 1;
    set('ux.custom_404', custom ? 'pass' : 'fail', custom ? undefined : 'page 404 par défaut du serveur (sans message ni lien de retour)');
  } else set('ux.custom_404', 'unverified', `réponse inattendue sur une adresse inexistante : HTTP ${nf.status || nf.error}`);
  set('ux.favicon', homeParsed.icon || (await statusOf(origin + '/favicon.ico')).status === 200 ? 'pass' : 'fail', homeParsed.icon ? undefined : 'ni balise icon ni /favicon.ico');
  // traceurs et embeds
  const TRACK = /(googletagmanager\.com|google-analytics\.com|connect\.facebook\.net|facebook\.net\/.*fbevents|hotjar\.com|static\.ads-twitter\.com|snap\.licdn\.com|clarity\.ms|tiktok\.com\/i18n|doubleclick\.net)/i;
  const CLEAN = /(plausible\.io|umami|usefathom\.com|simpleanalytics|goatcounter|cloudflareinsights|matomo|piwik|vercel\/insights|_vercel\/insights|_vercel\/speed-insights)/i;
  const EMBED = /(youtube\.com|youtube-nocookie\.com|youtu\.be|google\.[a-z.]+\/maps|maps\.google|facebook\.com\/plugins|instagram\.com\/embed|twitter\.com|vimeo\.com|tiktok\.com)/i;
  const scripts = flat(html.map((p) => p.parsed.scripts)).filter(Boolean);
  const trackers = [...new Set(scripts.filter((u) => TRACK.test(u)).map((u) => new URL(u).host))];
  const embeds = [...new Set(flat(html.map((p) => p.parsed.iframes)).filter((u) => EMBED.test(u)).map((u) => { try { return new URL(u, origin).host; } catch { return u; } }))];
  const setCookie = home.headers['set-cookie'];
  const issues = [];
  if (trackers.length) issues.push(`traceurs : ${list(trackers)}`);
  if (embeds.length) issues.push(`embeds externes : ${list(embeds)}`);
  if (setCookie) issues.push('le serveur dépose un cookie dès la première visite');
  set('ux.no_tracking_embeds', issues.length ? 'fail' : 'pass', issues.length ? `${issues.join(' ; ')} → bannière de consentement nécessaire, ou retirer (carte = image cliquable)` : 'aucun traceur ni embed détecté (les scripts chargés dynamiquement ne sont pas vus)');
  const clean = [...new Set(scripts.filter((u) => CLEAN.test(u)).map((u) => new URL(u).host))];
  if (clean.length) set('ux.analytics', 'pass', `mesure d'audience sans cookie : ${list(clean)}`);
  else if (trackers.length) set('ux.analytics', 'pass', `mesure d'audience avec traceurs : ${list(trackers)} (bannière cookies requise)`);
  else set('ux.analytics', 'fail', 'aucune mesure d\'audience détectée dans le HTML (Plausible ou Umami recommandés)');
  const SOCIAL = /(instagram\.com|facebook\.com|linkedin\.com|tiktok\.com|youtube\.com|x\.com|twitter\.com|pinterest\.)/i;
  const socials = [...new Set(flat(html.map((p) => p.parsed.links)).filter((l) => l.abs && SOCIAL.test(l.abs) && !sameHost(new URL(l.abs).host, hu.host)).map((l) => new URL(l.abs).host.replace(/^www\./, '')))];
  if (socials.length) set('ux.social_links', 'pass', `liens vers : ${list(socials)}`);
  else set('ux.social_links', 'unverified', 'aucun lien vers un réseau social (normal si le commerce n\'en a pas)');
  if (homeParsed.metaKeywords != null) set('content.no_meta_keywords', 'fail', 'balise meta keywords présente (inutile, à retirer)'); else set('content.no_meta_keywords', 'pass');
  // fichiers sensibles exposés
  const probes = [['/.env', (b) => /^[A-Z][A-Z0-9_]+\s*=/m.test(b) && !/<html/i.test(b.slice(0, 200))], ['/.git/config', (b) => /\[core\]/.test(b)], ['/.git/HEAD', (b) => /^ref:\s*refs\//.test(b.trim())]];
  const exposed = [];
  for (const [path, test] of probes) { const r = await fetchPage(origin + path, { timeout: 8000 }); if (r.status === 200 && test(r.body || '')) exposed.push(path); }
  set('sec.no_exposed_files', exposed.length ? 'fail' : 'pass', exposed.length ? `accessible publiquement : ${exposed.join(', ')} (à retirer immédiatement et changer les clés concernées)` : undefined);
  // vocabulaire local
  if (profile.local) {
    if (!profile.city) set('local.local_vocabulary', 'unverified', 'ville non renseignée : relancer l\'audit en l\'indiquant');
    else {
      const cn = norm(profile.city);
      const counts = html.map((p) => (norm(p.parsed.text).match(new RegExp(cn.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'g')) || []).length);
      const total = counts.reduce((a, b) => a + b, 0);
      set('local.local_vocabulary', total >= 4 ? 'pass' : 'fail', `« ${profile.city} » cité ${total} fois sur ${html.length} page(s)${total >= 4 ? '' : ' : ajouter quartiers, rues, repères'}`);
    }
  }
  // Contrôles à faire à la main : ils restent « non vérifiés » tant que personne ne les valide
  const MANUAL = ['ux.contrast_aa', 'ux.keyboard_focus', 'ux.form_quality', 'ux.single_cta', 'ux.cta_sticky_mobile', 'content.real_photos', 'content.team_photo', 'content.case_studies', 'data.rich_results_test', 'setup.search_console', 'setup.backlinks_local', 'legal.cgv', 'sec.repo_secrets', 'sec.deps_audit', 'sec.server_validation'];
  for (const id of MANUAL) if (!(id in checks)) set(id, 'unverified', 'à valider à la main (ou avec Claude dans le dossier du site)');

  progress('Terminé', 100);
  const pagesInfo = pages.map((p) => ({
    url: p.finalUrl, status: p.status, redirects: p.redirects, ms: p.ms, title: p.parsed?.title || null, h1: p.parsed?.h.find((h) => h.level === 1)?.text || null,
    words: p.parsed?.wordCount ?? null, canonical: p.parsed?.canonical || null,
  }));
  return {
    site: siteSlug(homeFinal), url: homeFinal, date: today(), profile,
    tools: { seo_lab_app: { version: VERSION, pages_scanned: pages.length, speed: psiInfo || null } },
    checks, extra: { pages: pagesInfo, notes },
    ai: { method: 'skipped', runs: [] }, serp: { runs: [] }, search: {}, local_presence: {},
  };
}
