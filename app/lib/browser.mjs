// Mesure par navigateur : pilote un Chrome dédié (profil séparé, connexions faites une fois par l'utilisateur).
// Aucun contournement : au premier captcha ou à la première connexion manquante, le moteur concerné s'arrête.
import { spawn, execFileSync } from 'node:child_process';
import { existsSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { hostOf } from './providers.mjs';

const here = dirname(fileURLToPath(import.meta.url));
export const PORT = +process.env.SEOLAB_CDP_PORT || 9333;
const PROFILE = process.env.SEOLAB_PROFILE || join(here, '..', 'browser-profile');
export const SERP_ENGINES = ['brave', 'bing'];
export const AI_ENGINES = ['perplexity', 'chatgpt', 'gemini', 'copilot'];
export const LOGIN_URLS = { chatgpt: 'https://chatgpt.com/', gemini: 'https://gemini.google.com/app', copilot: 'https://copilot.microsoft.com/' };
const BASE = (k, d) => process.env['SEOLAB_URL_' + k.toUpperCase()] || d;
const FAST = !!process.env.SEOLAB_FAST;
const sleep = (ms) => new Promise((r) => setTimeout(r, FAST ? Math.min(ms, 300) : ms));
const same = (a, b) => !!a && !!b && (a === b || a.endsWith('.' + b) || b.endsWith('.' + a));

// Navigateurs de type Chromium pilotables (le navigateur par défaut est utilisé s'il en fait partie).
const PF = ['C:\\Program Files', 'C:\\Program Files (x86)', process.env.LOCALAPPDATA].filter(Boolean);
const EXES = {
  chrome: PF.map((d) => join(d, 'Google', 'Chrome', 'Application', 'chrome.exe')).concat(['/Applications/Google Chrome.app/Contents/MacOS/Google Chrome', '/usr/bin/google-chrome']),
  brave: PF.map((d) => join(d, 'BraveSoftware', 'Brave-Browser', 'Application', 'brave.exe')).concat(['/Applications/Brave Browser.app/Contents/MacOS/Brave Browser', '/usr/bin/brave-browser']),
  edge: PF.map((d) => join(d, 'Microsoft', 'Edge', 'Application', 'msedge.exe')).concat(['/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge']),
  chromium: ['/usr/bin/chromium'],
};
const NAMES = { chrome: 'Google Chrome', brave: 'Brave', edge: 'Microsoft Edge', chromium: 'Chromium' };
// Navigateur par défaut de Windows (https), si c'est un Chromium connu.
function defaultBrowser() {
  if (process.platform !== 'win32') return null;
  try {
    const out = execFileSync('reg', ['query', 'HKCU\\Software\\Microsoft\\Windows\\Shell\\Associations\\UrlAssociations\\https\\UserChoice', '/v', 'ProgId'], { encoding: 'utf8', timeout: 3000, windowsHide: true });
    const id = (out.match(/ProgId\s+REG_SZ\s+(\S+)/) || [])[1] || '';
    return /^ChromeHTML/i.test(id) ? 'chrome' : /^BraveHTML/i.test(id) ? 'brave' : /^MSEdgeHTM/i.test(id) ? 'edge' : null;
  } catch { return null; }
}
let found;
// Renvoie { exe, kind, name } : variable d'environnement, puis navigateur par défaut, puis Chrome, Brave, Edge.
export function findBrowser() {
  if (found !== undefined && !process.env.SEOLAB_CHROME) return found;
  const ok = (l) => l.find((x) => x && existsSync(x));
  let r = null;
  if (process.env.SEOLAB_CHROME && existsSync(process.env.SEOLAB_CHROME)) r = { exe: process.env.SEOLAB_CHROME, kind: 'chromium', name: 'Chromium' };
  else for (const k of [defaultBrowser(), 'chrome', 'brave', 'edge', 'chromium'].filter(Boolean)) { const exe = ok(EXES[k]); if (exe) { r = { exe, kind: k, name: NAMES[k] }; break; } }
  found = r; return r;
}
export function findChrome() { return findBrowser()?.exe || null; }
export async function cdpUp() { try { return (await fetch(`http://127.0.0.1:${PORT}/json/version`, { signal: AbortSignal.timeout(1500) })).ok; } catch { return false; } }

function launchChrome(urls = []) {
  const exe = findChrome(); if (!exe) throw new Error('Chrome introuvable : installe Google Chrome (ou Edge).');
  mkdirSync(PROFILE, { recursive: true });
  const args = [`--remote-debugging-port=${PORT}`, `--user-data-dir=${PROFILE}`, '--no-first-run', '--no-default-browser-check', '--window-size=1280,900'];
  if (process.env.SEOLAB_HEADLESS) args.push('--headless=new');
  if (process.env.SEOLAB_NOSANDBOX) args.push('--no-sandbox');
  spawn(exe, [...args, ...urls], { detached: true, stdio: 'ignore' }).unref();
}
// Ouvre le Chrome dédié sur les pages de connexion (l'utilisateur se connecte lui-même, une seule fois).
export async function prepareLogins() {
  if (await cdpUp()) throw new Error('Le navigateur dédié est déjà ouvert : connecte-toi dedans, puis ferme-le.');
  launchChrome(Object.values(LOGIN_URLS));
}

async function connect() {
  let launched = false;
  if (!(await cdpUp())) { launchChrome(); launched = true; for (let i = 0; i < 40 && !(await cdpUp()); i++) await sleep(500); if (!(await cdpUp())) throw new Error('Le navigateur dédié ne démarre pas.'); }
  let pw; try { pw = await import('playwright-core'); } catch { throw new Error('Composant manquant : relance Lancer-SEO-GEO-Test.bat (il installe playwright-core au premier lancement).'); }
  let browser, lastErr;
  for (let i = 0; i < 4 && !browser; i++) { try { browser = await pw.chromium.connectOverCDP(`http://127.0.0.1:${PORT}`); } catch (e) { lastErr = e; await sleep(1500); if (!(await cdpUp()) && launched) { launchChrome(); for (let k = 0; k < 20 && !(await cdpUp()); k++) await sleep(500); } } }
  if (!browser) throw new Error('Connexion au navigateur dédié impossible : ' + (lastErr?.message || '').split('\n')[0]);
  const close = async () => { try { if (launched) { const s = await browser.newBrowserCDPSession(); await s.send('Browser.close'); } else await browser.close(); } catch {} };
  return { browser, ctx: browser.contexts()[0] || (await browser.newContext()), close };
}

// ---------- utilitaires de page
const CAPTCHA = /captcha|v[ée]rifiez que vous [êe]tes (un )?humain|verify you are (a )?human|unusual traffic|trafic inhabituel|are you a robot|cloudflare.*(checking|v[ée]rif)/i;
async function guard(page) {
  const t = await page.evaluate(() => (document.body?.innerText || '').slice(0, 1500)).catch(() => '');
  if (CAPTCHA.test(t) || /captcha|\/sorry\//i.test(page.url())) throw new Error('CAPTCHA détecté : mesure arrêtée pour ce moteur (aucun contournement).');
}
async function settle(page, readText, { min = 4000, max = 70000, stableFor = 5 } = {}) {
  if (FAST) { min = 1200; stableFor = 2; }
  const t0 = Date.now(); let last = -1, same_ = 0;
  while (Date.now() - t0 < max) {
    await new Promise((r) => setTimeout(r, FAST ? 400 : 1000));
    const n = (await readText().catch(() => '')).length;
    if (n > 40 && n === last) same_++; else same_ = 0;
    last = n;
    if (Date.now() - t0 >= min && same_ >= stableFor) return;
  }
}
const decodeBing = (h) => { try { const u = new URL(h); if (/bing\.com$/.test(u.host) && u.pathname.startsWith('/ck/a')) { const v = u.searchParams.get('u'); if (v && v.startsWith('a1')) return Buffer.from(v.slice(2).replace(/-/g, '+').replace(/_/g, '/'), 'base64').toString('utf8'); } } catch {} return h; };

// ---------- moteurs classiques : position réelle dans les premiers résultats
async function serpDriver(page, engine, query, siteHost) {
  const pages = engine === 'bing' ? [0, 10, 20] : [0];
  const all = [];
  for (const off of pages) {
    const url = engine === 'brave'
      ? `${BASE('brave', 'https://search.brave.com/search')}?${new URLSearchParams({ q: query, source: 'web' })}`
      : `${BASE('bing', 'https://www.bing.com/search')}?${new URLSearchParams({ q: query, setlang: 'fr', cc: 'FR', ...(off ? { first: String(off + 1) } : {}) })}`;
    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(1800); await guard(page);
    const hrefs = await page.evaluate((eng) => {
      const sel = eng === 'brave' ? '#results a[href^="http"], main a[href^="http"]' : '#b_results li.b_algo h2 a';
      return [...document.querySelectorAll(sel)].map((a) => a.href);
    }, engine);
    for (const h0 of hrefs) { const h = decodeBing(h0); try { const u = new URL(h); if (/(^|\.)brave\.com$/.test(u.host) && engine === 'brave') continue; const k = u.host + u.pathname; if (!all.some((x) => x.k === k)) all.push({ k, host: hostOf(h) }); } catch {} }
    if (all.length >= 30) break; await sleep(2500);
  }
  const top = engine === 'brave' ? 20 : 30;
  const idx = all.slice(0, top).findIndex((x) => same(x.host, siteHost));
  if (!all.length) throw new Error('Aucun résultat lu : la page a peut-être changé de structure.');
  return { position: idx >= 0 ? idx + 1 : null, checked_top: top, competitors: [...new Set(all.slice(0, 5).map((x) => x.host).filter((h) => h && !same(h, siteHost)))] };
}

// ---------- IA : mentionné / cité, jamais de rang inventé
const norm = (s) => String(s).normalize('NFD').replace(/\p{M}/gu, '').toLowerCase();
function judge(text, hosts, siteHost, brand) {
  const t = norm(text); const terms = [siteHost, siteHost.split('.')[0], ...brand].filter((x) => x && x.length >= 4).map(norm);
  const mentioned = terms.some((x) => t.includes(x));
  const cited = hosts.some((h) => same(h, siteHost)) || t.includes(norm(siteHost));
  const own = (h) => same(h, siteHost);
  const inText = (String(text).match(/\b(?:[a-z0-9-]+\.)+(?:fr|com|net|org|io|eu|studio|agency|digital|co)\b/gi) || []).map((d) => d.toLowerCase().replace(/^www\./, '')).filter((d) => !/(perplexity|openai|chatgpt|google|microsoft|bing|gstatic)\./.test(d));
  return { mentioned, cited, competitors: [...new Set([...hosts, ...inText].filter((h) => h && !own(h)))].slice(0, 6) };
}
const linkHosts = (page, sel) => page.evaluate((s) => [...document.querySelectorAll(s)].map((a) => a.href), sel).then((a) => a.map(hostOf).filter(Boolean));
async function needInput(page, sel, engine) {
  try { await page.waitForSelector(sel, { timeout: 20000, state: 'attached' }); } catch { throw new Error(`${engine} : zone de saisie introuvable (connexion requise ? clique sur « Préparer les connexions »).`); }
}
async function typeAndSend(page, sel, text) {
  try { await page.click(sel, { timeout: 4000 }); } catch { await page.evaluate((s) => document.querySelector(s)?.focus(), sel); }
  await page.keyboard.type(text, { delay: 25 }); await sleep(400); await page.keyboard.press('Enter'); }
const readAll = (page, sel) => () => page.evaluate((s) => [...document.querySelectorAll(s)].map((e) => e.innerText).join('\n'), sel);

const AI = {
  async perplexity(page, q) {
    await page.goto(`${BASE('perplexity', 'https://www.perplexity.ai/search')}?${new URLSearchParams({ q })}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500); await guard(page);
    const rd = readAll(page, 'main'); await settle(page, rd, { min: 8000 });
    return { text: await rd(), hosts: (await linkHosts(page, 'main a[href^="http"]')).filter((h) => !/perplexity\.ai$/.test(h)) };
  },
  async chatgpt(page, q) {
    await page.goto(`${BASE('chatgpt', 'https://chatgpt.com/')}?${new URLSearchParams({ hints: 'search' })}`, { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2000); await guard(page);
    const box = '#prompt-textarea'; await needInput(page, box, 'ChatGPT');
    await typeAndSend(page, box, q);
    try { await page.waitForSelector('[data-message-author-role="assistant"]', { timeout: 40000 }); } catch { throw new Error('ChatGPT : pas de réponse (limite atteinte ou connexion expirée).'); }
    const rd = readAll(page, '[data-message-author-role="assistant"]'); await settle(page, rd, { min: 8000 });
    return { text: await rd(), hosts: (await linkHosts(page, '[data-message-author-role="assistant"] a[href^="http"]')).filter((h) => !/chatgpt\.com|openai\.com|google\.com|mapbox/.test(h)) };
  },
  async gemini(page, q) {
    await page.goto(BASE('gemini', 'https://gemini.google.com/app'), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(2500); await guard(page);
    const box = 'rich-textarea div[contenteditable="true"], div.ql-editor[contenteditable="true"]'; await needInput(page, box, 'Gemini');
    await typeAndSend(page, box, q);
    try { await page.waitForSelector('message-content', { timeout: 40000 }); } catch { throw new Error('Gemini : pas de réponse (connexion expirée ?).'); }
    const rd = readAll(page, 'message-content'); await settle(page, rd, { min: 8000 });
    return { text: await rd(), hosts: (await linkHosts(page, 'message-content a[href^="http"]')).filter((h) => !/google\.(com|fr)|gstatic|googleusercontent/.test(h)) };
  },
  async copilot(page, q) {
    await page.goto(BASE('copilot', 'https://copilot.microsoft.com/'), { waitUntil: 'domcontentloaded', timeout: 30000 });
    await sleep(3000); await guard(page);
    const box = '#m365-chat-editor-target-element, [role="textbox"], textarea'; await needInput(page, box, 'Copilot');
    const before = await page.evaluate(() => (document.querySelector('main')?.innerText || '').length);
    await typeAndSend(page, box, q);
    await sleep(6000);
    const rd = () => page.evaluate(() => document.querySelector('main')?.innerText || '');
    await settle(page, rd, { min: 8000 });
    const text = await rd();
    if (text.length - before < 80) throw new Error('Copilot : pas de réponse lue (structure de page changée ?).');
    return { text, hosts: (await linkHosts(page, 'main a[href^="http"]')).filter((h) => !/microsoft\.com|copilot\.com|bing\.com|live\.com/.test(h)) };
  },
};

// ---------- exécution d'une liste de tâches
// tasks : { kind:'serp'|'ai', engine, q:{id,text}|p:{id,text} } ; onResult(task, result) ; onError(engine, message)
export async function runBrowserTasks(tasks, { siteHost, brand = [], onStep = () => {}, onResult, onError }) {
  const { ctx, close } = await connect();
  const dead = new Set();
  try {
    for (const t of tasks) {
      if (dead.has(t.engine)) { onStep(null); continue; }
      const text = (t.q || t.p).text; onStep(`${t.engine} : « ${text.slice(0, 50)} »`);
      const page = await ctx.newPage();
      try {
        if (t.kind === 'serp') onResult(t, await serpDriver(page, t.engine, text, siteHost));
        else { const r = await AI[t.engine](page, text); onResult(t, { ...judge(r.text, r.hosts, siteHost, brand), excerpt: r.text.slice(0, 200) }); }
      } catch (e) { onError(t.engine, e.message); if (/CAPTCHA|connexion|zone de saisie|introuvable|Aucun résultat/i.test(e.message)) dead.add(t.engine); }
      finally { await page.close().catch(() => {}); }
      await sleep(4000 + Math.random() * 3000);
    }
  } finally { await close(); }
}
