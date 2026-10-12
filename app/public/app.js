// Interface SEO GEO Test. Toutes les données affichées passent par esc().
const $ = (s, r = document) => r.querySelector(s);
const app = $('#app'), side = $('#side');
const ENG = { brave: 'Brave', bing: 'Bing', google: 'Google', google_maps: 'Google Maps', apple_maps: 'Apple Plans', duckduckgo: 'DuckDuckGo', ecosia: 'Ecosia', qwant: 'Qwant',
  chatgpt: 'ChatGPT', perplexity: 'Perplexity', gemini: 'Gemini', gemini_api: 'Gemini (API)', copilot: 'Copilot', claude: 'Claude', mistral: 'Le Chat (Mistral)', google_ai_overview: 'Google AI Overview' };
const SERP_ENG = ['brave', 'bing', 'google', 'google_maps', 'apple_maps', 'duckduckgo', 'ecosia', 'qwant'];
const AI_ENG = ['chatgpt', 'perplexity', 'gemini', 'copilot', 'claude', 'mistral', 'google_ai_overview'];
const eng = (e) => ENG[e] || e;
const ST = { pass: ['✓ Réussi', 'b-pass'], fail: ['✕ À corriger', 'b-fail'], unverified: ['? Non vérifié', 'b-unverified'], na: ['– Sans objet', 'b-na'] };
const WEIGHT = { critique: 'critique', important: 'important', bonus: 'bonus' };
let state = { tab: 'resume', view: null, filter: 'all' };

let LANG = 'fr';
try { LANG = localStorage.getItem('lang') || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en'); } catch { LANG = 'fr'; }
document.documentElement.lang = LANG;
const L = (fr, en) => (LANG === 'en' ? en : fr);
const t = (s) => (LANG === 'en' && window.trUI ? window.trUI(s) : s);
async function api(path, body) {
  if (LANG === 'en') path += (path.includes('?') ? '&' : '?') + 'lang=en';
  const r = await fetch('/api' + path, body ? { method: 'POST', headers: { 'content-type': 'application/json', 'x-seolab': '1' }, body: JSON.stringify(body) } : {});
  const j = await r.json().catch(() => ({}));
  if (!r.ok) throw new Error(j.error || t('Erreur ') + r.status);
  return j;
}
const fmtDate = (d) => { try { return new Date(d + 'T12:00:00').toLocaleDateString(LANG === 'en' ? 'en-GB' : 'fr-FR', { day: 'numeric', month: 'long', year: 'numeric' }); } catch { return d; } };
const dl = (d, unit = '') => (d == null ? '' : d === 0 ? '<span class="delta flat">=</span>' : `<span class="delta ${d > 0 ? 'up' : 'down'}">${d > 0 ? '▲ +' : '▼ '}${d}${unit}</span>`);
const dlc = (d, inv) => { const good = inv ? d < 0 : d > 0; return d === 0 ? '<span class="delta flat">=</span>' : `<span class="delta ${good ? 'up' : 'down'}">${d > 0 ? '+' : ''}${d}</span>`; };
const helpBtn = (id) => (state.view?.help?.[id] ? `<button type="button" class="help noprint" data-help="${esc(id)}" aria-label="Explication" aria-expanded="false">?</button>` : '');
const badge = (s) => `<span class="badge ${ST[s][1]}">${ST[s][0]}</span>`;
const ask = (m) => confirm(t(m));
const toast = (m0) => { const m = t(m0); const t = document.createElement('div'); t.className = 'tip'; t.style.cssText = 'left:50%;bottom:24px;top:auto;transform:translateX(-50%);font-size:14px'; t.textContent = m; document.body.appendChild(t); setTimeout(() => t.remove(), 2400); };
const copy = async (text) => { try { await navigator.clipboard.writeText(text); toast('Copié'); } catch { toast('Copie impossible : sélectionne le texte'); } };

// ---------- Barre latérale
const CREDIT_URL = 'https://briscofreelance.vercel.app/';
async function loadSide(cur) {
  const { sites } = await api('/sites');
  side.innerHTML = `<a class="site" href="#/"><b>+ Nouvel audit</b></a><h2>Mes sites</h2>` + (sites.length ? sites.map((s) => `<a class="site ${s.slug === cur ? 'on' : ''}" href="#/site/${encodeURIComponent(s.slug)}"><b>${esc(s.slug)}</b><span>${s.last ? 'Score ' + (s.last.global ?? 'n/m') + ' · ' + esc(fmtDate(s.last.date)) : s.legacyFolders ? 'ancien format' : 'aucun audit'}</span></a>`).join('') : '<span style="font-size:13px;opacity:.7">Aucun site pour l\'instant.</span>')
    + `<div class="tools"><a class="site ${cur === '__aide' ? 'on' : ''}" href="#/aide"><b>Documentation</b><span>ce qui est mesuré, et comment</span></a>
    <div class="lang" role="group" aria-label="Language"><button type="button" data-l="fr" class="${LANG === 'fr' ? 'on' : ''}">FR</button><button type="button" data-l="en" class="${LANG === 'en' ? 'on' : ''}">EN</button></div>
    <a class="site" href="#" id="quit"><b>Fermer SEO GEO Test</b><span>arrête le programme</span></a>
    <a class="credit" href="${CREDIT_URL}" target="_blank" rel="noopener noreferrer">Design by <b>Brisco Freelance</b></a></div>`;
  side.querySelectorAll('.lang button').forEach((b) => (b.onclick = () => { try { localStorage.setItem('lang', b.dataset.l); } catch {} location.reload(); }));
  $('#quit').onclick = async (e) => { e.preventDefault(); if (!ask(t('Arrêter SEO GEO Test ? Une mesure en cours serait interrompue.'))) return; try { await api('/quit', {}); } catch {} document.body.innerHTML = `<div style="font-family:sans-serif;padding:40px;background:#0A1020;color:#E8EEF7;min-height:100vh"><h1>${t('SEO GEO Test est arrêté')}</h1><p>${t('Tu peux fermer cet onglet. Pour le relancer, utilise le raccourci Lancer SEO GEO Test.')}</p></div>`; };
  return sites;
}

// ---------- Avant de commencer (confidentialité + connexions, une seule fois)
const getSetup = () => { try { return localStorage.getItem('setupDone') === '1'; } catch { return false; } };
function setupCard() {
  const done = getSetup();
  return `<details class="card setup" id="setup" ${done ? '' : 'open'} style="margin-bottom:16px"><summary>${L('Avant de commencer : ce qui reste sur ton PC, et la connexion aux IA', 'Before you start: what stays on your PC, and signing in to the AIs')}${done ? ' <span class="badge b-pass">' + L('fait', 'done') + '</span>' : ''}</summary>
  <div class="grid2" style="margin-top:12px">
    <div><h3 style="margin-top:0">🔒 ${L('Tout reste sur ton PC', 'Everything stays on your PC')}</h3>
    <ul style="margin:0;padding-left:18px">
      <li>${L('Tes rapports, tes décisions et tes réglages sont des fichiers dans le dossier <code>reports</code> de ce programme. Rien n\'est envoyé à l\'auteur de l\'outil ni à un service de suivi : il n\'y a ni compte, ni statistiques, ni publicité.', 'Your reports, decisions and settings are files in this program\'s <code>reports</code> folder. Nothing is sent to the tool\'s author or to any tracking service: no account, no analytics, no ads.')}</li>
      <li>${L('Le programme ne parle qu\'à ton propre navigateur (adresse locale 127.0.0.1) : personne d\'autre sur Internet ne peut ouvrir tes rapports.', 'The program only talks to your own browser (local address 127.0.0.1): nobody else on the Internet can open your reports.')}</li>
      <li>${L('Seules sorties, et seulement quand tu les lances : la lecture du site audité, la mesure de vitesse de Google (PageSpeed Insights) si la case est cochée, et les requêtes aux moteurs et IA que tu choisis de mesurer.', 'The only outgoing traffic, and only when you start it: reading the audited site, Google\'s speed test (PageSpeed Insights) if ticked, and the queries to the engines and AIs you choose to measure.')}</li>
      <li>${L('Tes mots de passe ne passent jamais par le programme : tu te connectes toi-même, dans la fenêtre du navigateur.', 'Your passwords never go through the program: you sign in yourself, in the browser window.')}</li></ul></div>
    <div><h3 style="margin-top:0">🔑 ${L('Se connecter aux IA (une seule fois)', 'Sign in to the AIs (once)')}</h3>
    <p style="margin-top:0">${L('Pour mesurer si ChatGPT, Gemini et Copilot citent ton site, le programme ouvre une fenêtre de navigateur à part. Tu y utilises <b>ton propre compte</b>.', 'To measure whether ChatGPT, Gemini and Copilot cite your site, the program opens a separate browser window. You use <b>your own account</b> there.')}</p>
    <ol style="margin:0 0 10px;padding-left:20px"><li>${L('Clique sur le bouton ci-dessous : une fenêtre s\'ouvre sur ChatGPT, Gemini et Copilot.', 'Click the button below: a window opens on ChatGPT, Gemini and Copilot.')}</li><li>${L('Connecte-toi à chacun, si tu as un compte (c\'est facultatif : sans connexion, ce moteur est simplement ignoré).', 'Sign in to each one if you have an account (optional: without a sign-in, that engine is simply skipped).')}</li><li>${L('Ferme la fenêtre : la connexion est mémorisée dans le dossier du programme, sur ce PC.', 'Close the window: the sign-in is remembered in the program\'s folder, on this PC.')}</li></ol>
    <p class="mini" style="margin-top:0">${L('Perplexity, Brave et Bing n\'ont pas besoin de compte. Google n\'est jamais interrogé (voir Search Console).', 'Perplexity, Brave and Bing need no account. Google is never queried (use Search Console).')}</p>
    <div class="row"><button class="btn sm" type="button" id="prep0">${L('Préparer les connexions', 'Prepare sign-ins')}</button><button class="btn sec sm" type="button" id="setupok">${done ? L('Remettre à faire', 'Mark as to do') : L('C\'est fait, masquer', 'Done, hide this')}</button></div></div></div></details>`;
}
function bindSetup() {
  $('#prep0')?.addEventListener('click', async () => { try { await api('/browser-prepare', {}); toast('Fenêtre ouverte : connecte-toi à ChatGPT, Gemini et Copilot, puis ferme-la.'); } catch (err) { toast(err.message); } });
  $('#setupok')?.addEventListener('click', (e) => { e.preventDefault(); try { localStorage.setItem('setupDone', getSetup() ? '0' : '1'); } catch {} home(); });
}

// ---------- Accueil
async function home() {
  const sites = await loadSide();
  const cat = await api('/catalog').catch(() => ({ checks: [] }));
  const nLoc = cat.checks.filter((x) => x.applies === 'local').length, nMl = cat.checks.filter((x) => x.applies === 'multilingue').length;
  app.innerHTML = `<h1>Auditer un site</h1><p class="sub">Colle l'adresse : le rapport s'affiche ici, avec ce qu'il faut corriger et la comparaison avec le dernier audit.</p>
  ${setupCard()}
  <section class="hero"><form id="f">
    <input class="big" type="url" id="u" placeholder="https://monsite.fr" required autofocus aria-label="Adresse du site">
    <div class="row"><label class="chk"><input type="checkbox" id="loc"> Site local (artisan, commerce…)</label><label class="chk"><input type="checkbox" id="ml"> Plusieurs langues</label>
    <input type="text" id="city" placeholder="Ville (sites locaux)" aria-label="Ville" style="max-width:220px"></div>
    <details class="why" open><summary>${L('À quoi servent ces cases ?', 'What are these boxes for?')}</summary><ul>
      <li><b>${L('Site local', 'Local business')}</b> : ${L(`à cocher si tes clients viennent d'un lieu précis (artisan, commerce, cabinet, restaurant…). Cela ajoute <b>${nLoc} contrôles</b> : nom, adresse et téléphone identiques partout, données LocalBusiness, fiches Google, Apple et Bing, avis, contact, plan et horaires. Cela affiche aussi les conseils sur les fiches et annuaires dans l'onglet « Conseils ». Sans la case, ces points ne sont ni jugés ni comptés dans le score. Ne la coche pas pour un site national ou en ligne uniquement.`, `tick it if your customers come from a specific place (tradesperson, shop, clinic, restaurant…). This adds <b>${nLoc} checks</b>: name, address and phone identical everywhere, LocalBusiness data, Google, Apple and Bing listings, reviews, contact, map and hours. It also shows the listings and directories tips in the "Tips" tab. Without the box, these points are neither judged nor counted in the score. Do not tick it for a national or online-only site.`)}</li>
      <li><b>${L('Ville', 'City')}</b> : ${L('vérifie que la ville apparaît dans le titre et le titre principal (H1), et dans le vocabulaire local des textes. Sans ville, ces deux contrôles restent « non vérifiés ».', 'checks that the city appears in the title and the main heading (H1), and in the local vocabulary of the texts. Without a city, these two checks stay "unverified".')}</li>
      <li><b>${L('Plusieurs langues', 'Several languages')}</b> : ${L(`à cocher si le site existe en plusieurs versions de langue. Cela ajoute <b>${nMl} contrôles</b> : balises hreflang, canonical par langue, attribut lang, sélecteur de langue, sitemap complet. Sans la case, ils ne comptent pas.`, `tick it if the site exists in several language versions. This adds <b>${nMl} checks</b>: hreflang tags, canonical per language, lang attribute, language switcher, complete sitemap. Without the box they do not count.`)}</li></ul></details>
    <label class="chk"><input type="checkbox" id="psi" checked> Mesurer la vitesse avec PageSpeed Insights (gratuit, peut être limité)</label>
    <label class="chk"><input type="checkbox" id="meas"> Mesurer aussi ma visibilité : Brave, Bing, Perplexity, ChatGPT, Gemini, Copilot (ouvre un Chrome dédié)</label>
    <div id="measbox" hidden style="display:none;gap:8px"><label>Recherches à suivre, une par ligne <span class="mini">(ce que tape un client : « plombier Saint-Étienne »). Laisse vide pour reprendre celles du site.</span><br><textarea id="mq" rows="3" style="width:100%"></textarea></label>
    <label>Nom de l'entreprise tel qu'une IA l'écrirait <input type="text" id="mb" style="width:100%"></label>
    <span class="mini">${L('ChatGPT, Gemini et Copilot demandent une connexion faite une seule fois : voir « Avant de commencer » ci-dessus.', 'ChatGPT, Gemini and Copilot need a sign-in done once: see "Before you start" above.')}</span></div>
    <div><button class="btn" type="submit">Lancer l'audit</button></div></form><div id="job"></div></section>
  <h2>Sites déjà audités</h2>
  ${sites.length ? `<div class="grid3">${sites.map((s) => `<a class="card" style="text-decoration:none;color:inherit" href="#/site/${encodeURIComponent(s.slug)}"><b style="font-family:Georgia,serif;font-size:18px">${esc(s.slug)}</b><div class="mini">${esc(s.url || '')}</div>
    ${s.last ? `<div class="kpi" style="margin-top:10px"><div><b>${s.last.global ?? 'n/m'}</b><span>SEO + IA</span></div><div><b>${s.last.classic ?? 'n/m'}</b><span>SEO</span></div><div><b>${s.last.geo ?? 'n/m'}</b><span>IA</span></div></div><div class="mini" style="margin-top:8px">${s.audits.length} audit(s) · dernier : ${esc(fmtDate(s.last.date))}</div>${s.bilan ? `<div class="mini" style="margin-top:4px">${L('✅ ' + s.bilan.fixed + ' corrigés · 🔧 ' + s.bilan.remaining + ' à faire · 💡 conseils ' + s.bilan.tipsDone + '/' + s.bilan.tipsTotal, '✅ ' + s.bilan.fixed + ' fixed · 🔧 ' + s.bilan.remaining + ' to do · 💡 tips ' + s.bilan.tipsDone + '/' + s.bilan.tipsTotal)}</div>` : ''}` : '<div class="mini" style="margin-top:10px">Ancien format de rapport : relance un audit pour démarrer le suivi.</div>'}</a>`).join('')}</div>` : '<div class="empty">Rien pour l\'instant. Colle une adresse ci-dessus pour démarrer.</div>'}
  <p class="mini" style="margin-top:28px">Les rapports sont enregistrés dans le dossier <code>reports</code> de SEO GEO Test.</p>`;
  bindSetup();
  $('#meas').onchange = (e) => { $('#measbox').style.display = e.target.checked ? 'grid' : 'none'; };
  $('#f').onsubmit = async (e) => {
    e.preventDefault();
    const btn = e.target.querySelector('button'); btn.disabled = true;
    try { const { job } = await api('/audit', { url: $('#u').value, local: $('#loc').checked, multilingual: $('#ml').checked, city: $('#city').value, psi: $('#psi').checked, measure: $('#meas').checked, queries: $('#mq').value, brand: $('#mb').value }); await followJob(job, $('#job'), btn); }
    catch (err) { $('#job').innerHTML = `<div class="note">${esc(err.message)}</div>`; btn.disabled = false; }
  };
}
async function followJob(id, box, btn) {
  for (;;) {
    const j = await api('/job/' + id);
    box.innerHTML = `<div class="progress"><i style="width:${j.pct}%"></i></div><div class="mini">${esc(j.step)}… ${j.pct}%</div>`;
    if (j.status === 'done') { state.pendingErrors = [...new Set(j.errors || [])]; location.hash = `#/audit/${encodeURIComponent(j.slug)}/${j.auditId}`; return; }
    if (j.status === 'error') { box.innerHTML = `<div class="note">L'audit a échoué : ${esc(j.error)}</div>`; if (btn) btn.disabled = false; return; }
    await new Promise((r) => setTimeout(r, 600));
  }
}

// ---------- Bilan d'un site : ce qui est corrigé, ce qui reste, les conseils
const wTag = (w) => `<span class="tag ${{ critique: 'crit', important: 'imp', bonus: 'bon' }[w] || ''}">${esc(t(w))}</span>`;
function bilanView(b, slug) {
  if (!b) return '';
  const first = fmtDate(b.firstDate), nf = b.fixed.length, nr = b.remaining.length, tp = b.tips, tpTot = tp.total - tp.na;
  const crit = b.remaining.filter((a) => a.weight === 'critique').length;
  const lst = (arr, f) => arr.length ? `<ul class="bl">${arr.map(f).join('')}</ul>` : '';
  return `<h2>${L('Bilan des ajustements', 'Adjustments report')}</h2>
  <div class="kpis"><div class="card kp ok"><b>${nf}</b><span>${L('points techniques corrigés', 'technical points fixed')}</span><i>${b.audits > 1 ? L('depuis le premier audit (' + first + ')', 'since the first audit (' + first + ')') : L('un seul audit pour l\'instant', 'only one audit so far')}</i></div>
  <div class="card kp ${crit ? 'bad' : 'warn'}"><b>${nr}</b><span>${L('restent à corriger', 'still to fix')}</span><i>${crit} ${L('critiques', 'critical')}</i></div>
  <div class="card kp"><b>${b.decisions.validated}</b><span>${L('validés, en attente de correction', 'approved, waiting to be fixed')}</span><i>${b.decisions.waiting} ${L('plus tard', 'later')} · ${b.decisions.refused} ${L('refusés', 'rejected')}</i></div>
  <div class="card kp ${tp.done ? 'ok' : ''}"><b>${tp.done}<small> / ${tpTot}</small></b><span>${L('conseils appliqués', 'tips applied')}</span><i>${tp.later} ${L('plus tard', 'later')}</i></div></div>
  <div class="grid2" style="margin-top:14px">
    <div class="card"><h3 style="margin-top:0">✅ ${L('Corrigés', 'Fixed')} (${nf})</h3>${nf ? lst(b.fixed, (x) => `<li>${esc(x.title)} ${wTag(x.weight)}<span class="mini"> ${esc(x.domainLabel)}</span></li>`) : `<div class="empty">${b.audits > 1 ? L('Aucun point corrigé entre le premier et le dernier audit.', 'No point fixed between the first and the last audit.') : L('Relance un audit après tes corrections : les points corrigés apparaîtront ici.', 'Run an audit again after your fixes: fixed points will appear here.')}</div>`}
    ${b.regressed.length ? `<h3>⚠️ ${L('Régressions', 'Regressions')} (${b.regressed.length})</h3>${lst(b.regressed, (x) => `<li>${esc(x.title)} ${wTag(x.weight)}</li>`)}` : ''}</div>
    <div class="card"><h3 style="margin-top:0">🔧 ${L('Restent à corriger', 'Still to fix')} (${nr})</h3>${nr ? lst(b.remaining.slice(0, 12), (x) => `<li>${esc(x.title)} ${wTag(x.weight)}${x.decision ? ' <span class="badge b-warn">' + esc({ validated: L('validé', 'approved'), waiting: L('plus tard', 'later'), refused: L('refusé', 'rejected') }[x.decision] || '') + '</span>' : ''}</li>`) + (nr > 12 ? `<p class="mini">+ ${nr - 12} ${L('autres : voir l\'onglet « À faire » du rapport', 'more: see the "To do" tab of the report')}</p>` : '') : `<div class="empty">${L('Plus rien en échec.', 'Nothing failing any more.')}</div>`}</div></div>
  <div class="card" style="margin-top:14px"><h3 style="margin-top:0">💡 ${L('Conseils hors site', 'Off-site tips')} : ${tp.done} / ${tpTot} ${L('appliqués', 'applied')}</h3>
    <div class="grid2"><div><b>${L('Appliqués', 'Applied')} (${tp.done})</b>${tp.done ? lst(tp.doneList, (x) => `<li>${esc(x)}</li>`) : `<p class="mini">${L('Aucun pour l\'instant.', 'None yet.')}</p>`}</div>
    <div><b>${L('Pas encore appliqués', 'Not applied yet')} (${tp.openList.length})</b>${lst(tp.openList.slice(0, 10), (x) => `<li>${esc(x.title)}${x.later ? ' <span class="badge b-warn">' + L('plus tard', 'later') + '</span>' : ''}</li>`)}${tp.openList.length > 10 ? `<p class="mini">+ ${tp.openList.length - 10} ${L('autres', 'more')}</p>` : ''}</div></div>
    <p class="mini" style="margin-bottom:0">${L('Les conseils se cochent dans l\'onglet « Conseils » d\'un rapport.', 'Tips are ticked in the "Tips" tab of a report.')}</p></div>
  <p class="mini">${L('« Corrigé » = le contrôle échouait au premier audit et réussit au dernier : c\'est constaté par l\'audit, pas déclaré. « Validé » veut seulement dire que tu as décidé de le corriger.', '"Fixed" = the check failed in the first audit and passes in the latest: it is observed by the audit, not declared. "Approved" only means you decided to fix it.')}</p>`;
}

// ---------- Page d'un site : historique
async function sitePage(slug) {
  await loadSide(slug);
  const d = await api('/site/' + encodeURIComponent(slug));
  if (!d.audits.length) { app.innerHTML = `<h1>${esc(slug)}</h1><div class="empty">Aucun audit au nouveau format. Lance un audit depuis l'accueil.</div><p><button class="btn sec sm" id="delsite">Supprimer ce site</button></p>`; $('#delsite').onclick = async () => { if (!ask('Supprimer le site ' + slug + ' ?')) return; try { await api('/delete-site', { slug }); toast('Site supprimé'); location.hash = '#/'; } catch (err) { toast(err.message); } }; return; }
  const h = d.history;
  const last = d.audits[d.audits.length - 1];
  app.innerHTML = `<h1>${esc(slug)}</h1><p class="sub">${d.audits.length} audit(s). Le dernier date du ${esc(fmtDate(last.date))}.</p>
  <div class="row noprint" style="margin-bottom:14px"><a class="btn" href="#/audit/${encodeURIComponent(slug)}/${last.id}" style="text-decoration:none">Ouvrir le dernier rapport</a>
  ${d.audits.length > 1 ? `<a class="btn sec" href="#/compare/${encodeURIComponent(slug)}/${d.audits[d.audits.length - 2].id}/${last.id}" style="text-decoration:none">Comparer avec le précédent</a>` : ''}
  <a class="btn sec" href="#/" style="text-decoration:none">Nouvel audit (autre site)</a></div>
  ${bilanView(d.bilan, slug)}
  <h2>${L('Évolution des scores', 'Score history')}</h2><div class="card"><p class="chart-title" hidden>Évolution des scores</p>${lineChart(h.map((x) => x.date), [{ name: t('Global'), color: 'var(--ink)', values: h.map((x) => x.global) }, { name: 'SEO', color: 'var(--teal)', values: h.map((x) => x.classic) }, { name: t('IA'), color: 'var(--indigo)', values: h.map((x) => x.geo) }])}
  <p class="mini">Attention : un score peut bouger parce qu'on vérifie plus de choses. Le mode comparatif compare à contrôles identiques.</p></div>
  <h2>Audits</h2><div class="card"><table><thead><tr><th>Date</th><th class="n">Global</th><th class="n">SEO</th><th class="n">IA</th><th class="n">Contrôles vérifiés</th><th></th></tr></thead><tbody>
  ${h.slice().reverse().map((x, i, arr) => { const idx = h.length - 1 - i; const prev = idx > 0 ? h[idx - 1] : null; return `<tr><td>${esc(fmtDate(x.date))}</td><td class="n">${x.global ?? 'n/m'}</td><td class="n">${x.classic ?? 'n/m'}</td><td class="n">${x.geo ?? 'n/m'}</td><td class="n">${x.coverage}%</td>
  <td class="n"><a href="#/audit/${encodeURIComponent(slug)}/${x.id}">Rapport</a>${prev ? ` · <a href="#/compare/${encodeURIComponent(slug)}/${prev.id}/${x.id}">Comparer</a>` : ''} · <a href="#" class="delaudit" data-id="${x.id}">Supprimer</a></td></tr>`; }).join('')}</tbody></table></div>
  <p class="noprint" style="margin-top:16px"><button class="btn sec sm" id="delsite">Supprimer ce site et tous ses audits</button></p><p class="mini noprint">Rien n'est effacé pour de bon : les éléments supprimés sont déplacés dans le dossier reports\\_corbeille.</p>`;
  document.querySelectorAll('.delaudit').forEach((a) => a.addEventListener('click', async (e) => { e.preventDefault(); if (!ask('Supprimer l\'audit du ' + fmtDate(h.find((x) => x.id === a.dataset.id)?.date) + ' ?')) return; try { await api('/delete-audit', { slug, id: a.dataset.id }); toast('Audit supprimé'); sitePage(slug); } catch (err) { toast(err.message); } }));
  $('#delsite').onclick = async () => { if (!ask('Supprimer le site ' + slug + ' et tous ses audits ?')) return; try { await api('/delete-site', { slug }); toast('Site supprimé'); location.hash = '#/'; } catch (err) { toast(err.message); } };
}

// ---------- Rapport
async function auditPage(slug, id, tab) {
  await loadSide(slug);
  const v = await api(`/audit/${encodeURIComponent(slug)}/${id}`);
  state.view = v; state.cfg = await api('/config'); if (tab) state.tab = tab;
  renderAudit();
}
function renderAudit() {
  const v = state.view, s = v.snap, sc = v.scores;
  const nFail = v.actions.length;
  const tabs = [['resume', 'Résumé'], ['todo', `À faire (${nFail})`], ['moteurs', 'Moteurs et IA'], ['controles', 'Tous les contrôles'], ['pages', 'Pages analysées'], ['conseils', 'Conseils']];
  app.innerHTML = `<div class="row" style="justify-content:space-between;align-items:flex-start"><div><h1>${esc(v.slug)}</h1><p class="sub"><a href="${esc(s.url)}" target="_blank" rel="noopener noreferrer">${esc(s.url)}</a> · audit du ${esc(fmtDate(s.date))}${s.legacy ? ' · reconstitué depuis un ancien rapport' : ''}</p></div>
  <div class="row noprint">${v.prevId ? `<a class="btn" style="text-decoration:none" href="#/compare/${encodeURIComponent(v.slug)}/${v.prevId}/${v.id}">Comparer avec l'audit précédent</a>` : ''}<button class="btn sec" id="rerun">Relancer un audit</button><button class="btn sec" id="prn">Enregistrer en PDF</button></div></div>
  <div id="rejob"></div>
  ${sc.all.coverage < 70 ? `<div class="note">Seuls ${sc.all.coverage} % des contrôles applicables ont pu être vérifiés. Les autres ne comptent pas dans le score : il est donc indicatif. Complète-les dans l'onglet « Tous les contrôles ».</div>` : ''}
  <div class="tabs noprint" role="tablist">${tabs.map(([k, l]) => `<button role="tab" data-t="${k}" class="${state.tab === k ? 'on' : ''}">${esc(l)}</button>`).join('')}</div><div id="panel"></div>`;
  app.querySelectorAll('.tabs button').forEach((b) => (b.onclick = () => { state.tab = b.dataset.t; renderAudit(); }));
  $('#prn').onclick = printReport;
  $('#rerun').onclick = async () => { try { const { job } = await api('/audit', { url: s.url, local: s.profile.local, multilingual: s.profile.multilingual, city: s.profile.city || '', psi: true, measure: (s.ai?.runs?.length || s.serp?.runs?.length) > 0 && !!(v.queries.length || v.prompts.length), brand: guessBrand(s) }); await followJob(job, $('#rejob')); } catch (e) { toast(e.message); } };
  ({ resume: tabResume, todo: tabTodo, moteurs: tabMoteurs, controles: tabControles, pages: tabPages, conseils: tabConseils })[state.tab]($('#panel'));
  if (state.pendingErrors?.length) { const n = document.createElement('div'); n.className = 'note'; n.innerHTML = 'Certaines mesures n\'ont pas pu être faites :<ul>' + state.pendingErrors.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>'; $('#rejob').after(n); state.pendingErrors = null; }
}

async function printReport() {
  const panel = $('#panel');
  const fns = { resume: tabResume, todo: tabTodo, moteurs: tabMoteurs, controles: tabControles, pages: tabPages, conseils: tabConseils };
  panel.innerHTML = '';
  for (const [k, l] of [['resume', 'Résumé'], ['todo', 'À faire'], ['moteurs', 'Moteurs et IA'], ['controles', 'Tous les contrôles'], ['pages', 'Pages analysées'], ['conseils', 'Conseils']]) {
    const sec = document.createElement('section'); sec.className = 'psec';
    sec.innerHTML = `<h2 class="ptitle">${esc(l)}</h2>`; const body = document.createElement('div'); sec.appendChild(body); panel.appendChild(sec);
    fns[k](body);
  }
  await new Promise((r) => setTimeout(r, 700)); // laisse finir les blocs chargés à part
  const done = () => { removeEventListener('afterprint', done); renderAudit(); };
  addEventListener('afterprint', done);
  toast('Dans la fenêtre d\'impression, choisis « Enregistrer au format PDF ».');
  setTimeout(() => print(), 400);
}

function tabResume(el) {
  const v = state.view, sc = v.scores, s = v.snap;
  const g = (label, x, hint, main) => `<div class="card gauge ${main ? 'main' : ''}"><div class="lbl">${esc(label)}</div>${gauge(x.global, { size: main ? 170 : 150 })}<div class="hint">${esc(hint)}</div></div>`;
  const nC = v.actions.filter((a) => a.weight === 'critique').length;
  el.innerHTML = `<div class="gauges">${g('Score global', sc.all, `${sc.all.verified} contrôles vérifiés sur ${sc.all.applicable}`, true)}${g('SEO classique', sc.classic, 'Google, Bing, Brave : technique, contenu, local')}${g('Lisible par les IA', sc.geo, 'ChatGPT, Gemini, Perplexity… (préparation du site)')}</div>
  <div id="bilanstrip"></div>
  <div class="row" style="justify-content:space-between;align-items:baseline"><h2 style="margin-bottom:4px">À faire, par priorité</h2><span class="mini">${nC ? 'Commence par la colonne rouge : c\'est ce qui pèse le plus.' : 'Aucune action critique : commence par les importantes.'}</span></div>
  ${v.actions.length ? prioCols(v.actions, { limit: 4 }) : '<div class="empty">Aucun contrôle en échec. Vérifie aussi les contrôles non vérifiés.</div>'}
  <h2>Par domaine</h2><div class="card">${domainBars(Object.entries(sc.all.domains).map(([k, d]) => ({ label: d.label, score: d.score, max: d.max })))}
  <p class="mini">Un domaine « n/m » n'a aucun contrôle vérifié : il ne pèse pas dans le score. Vert : 70 % et plus · orange : 40 à 69 % · rouge : moins de 40 %.</p></div>
  ${s.tools?.seo_lab_app?.speed ? `<h2>Vitesse mesurée</h2><div class="card kpi"><div><b>${s.tools.seo_lab_app.speed.lcp_ms != null ? (s.tools.seo_lab_app.speed.lcp_ms / 1000).toFixed(1) + ' s' : 'n/m'}</b><span>Affichage principal (LCP)</span></div><div><b>${s.tools.seo_lab_app.speed.cls ?? 'n/m'}</b><span>Stabilité (CLS)</span></div><div><b>${s.tools.seo_lab_app.speed.inp_ms != null ? s.tools.seo_lab_app.speed.inp_ms + ' ms' : 'n/m'}</b><span>Réactivité (INP)</span></div><div><b>${s.tools.seo_lab_app.speed.score ?? 'n/m'}</b><span>Score PageSpeed</span></div></div><p class="mini">Source : ${esc(s.tools.seo_lab_app.speed.source || '')}</p>` : ''}
  ${s.extra?.notes?.length ? `<h2>Remarques</h2><div class="card"><ul>${s.extra.notes.map((n) => `<li>${esc(n)}</li>`).join('')}</ul></div>` : ''}`;
  el.querySelectorAll('[data-go]').forEach((a) => a.addEventListener('click', (e) => { e.preventDefault(); state.tab = 'todo'; renderAudit(); }));
  bindActions(el);
  api('/site/' + encodeURIComponent(v.slug)).then((d) => { const b = d.bilan, box = $('#bilanstrip'); if (!b || !box) return; const tt = b.tips.total - b.tips.na;
    box.innerHTML = `<a class="card bstrip" href="#/site/${encodeURIComponent(v.slug)}"><span>✅ <b>${b.fixed.length}</b> ${L('corrigés', 'fixed')}${b.audits > 1 ? ' ' + L('depuis le ' + fmtDate(b.firstDate), 'since ' + fmtDate(b.firstDate)) : ''}</span><span>🔧 <b>${b.remaining.length}</b> ${L('à faire', 'to do')}</span><span>💡 <b>${b.tips.done}/${tt}</b> ${L('conseils appliqués', 'tips applied')}</span><span class="mini">${L('Voir le bilan →', 'See the report →')}</span></a>`; }).catch(() => {});
}

const COLS = [['critique', 'crit', 'Critique'], ['important', 'imp', 'Important'], ['bonus', 'bon', 'Bonus']];
const effShort = { rapide: 'effort rapide', moyen: 'effort moyen', long: 'effort long', quick: 'quick effort', medium: 'medium effort' };
function actionCard(a, full) {
  const d = a.decision?.status;
  return `<div class="ac ${d === 'refused' ? 'refused' : ''}"><h4>${esc(a.title)}${helpBtn(a.id)}</h4><div class="ev">${esc(a.evidence || a.label)}</div>${full ? `<div class="how">${esc(a.how)}</div>` : ''}
    <div class="meta"><span class="eff">${esc(effShort[a.effortLabel] || a.effortLabel)}</span><div class="seg noprint" role="group" aria-label="Décision" data-id="${esc(a.id)}"><button class="v ${d === 'validated' ? 'on' : ''}" data-s="validated">Valider</button><button class="w ${d === 'waiting' ? 'on' : ''}" data-s="waiting">Plus tard</button><button class="r ${d === 'refused' ? 'on' : ''}" data-s="refused">Refuser</button></div></div></div>`;
}
function prioCols(list, { limit = 0, full = false } = {}) {
  return `<div class="cols">${COLS.map(([w, cls, label]) => {
    const items = list.filter((a) => a.weight === w), shown = limit ? items.slice(0, limit) : items;
    return `<section class="col ${cls}" aria-label="${label}"><header><span>${label}</span><em>${items.length}</em></header><div class="body">${shown.map((a) => actionCard(a, full)).join('') || '<div class="mini" style="padding:6px 4px">Rien ici.</div>'}${limit && items.length > limit ? `<div class="more"><a href="#" data-go="todo">+ ${items.length - limit} autres</a></div>` : ''}</div></section>`;
  }).join('')}</div>`;
}
function bindActions(el) {
  el.querySelectorAll('.seg[data-id]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => (b.onclick = async () => {
    const cur = seg.querySelector('.on')?.dataset.s; const next = cur === b.dataset.s ? 'none' : b.dataset.s;
    try { await api('/decision', { slug: state.view.slug, checkId: seg.dataset.id, status: next }); state.view = await api(`/audit/${encodeURIComponent(state.view.slug)}/${state.view.id}`); renderAudit(); } catch (e) { toast(e.message); }
  })));
}

function tabTodo(el) {
  const v = state.view;
  const f = state.filter;
  const list = v.actions.filter((a) => f === 'all' || (f === 'new' ? !a.decision : a.decision?.status === f));
  const count = (k) => v.actions.filter((a) => (k === 'new' ? !a.decision : a.decision?.status === k)).length;
  el.innerHTML = `<p class="sub">Valide ce que tu veux corriger. Le prompt de corrections est construit uniquement avec les actions validées. Dans chaque colonne, les actions sont triées par rapport impact / effort.</p>
  <div class="row noprint" style="margin-bottom:12px"><div class="seg">${[['all', 'Toutes'], ['new', 'À décider'], ['validated', 'Validées'], ['waiting', 'Plus tard'], ['refused', 'Refusées']].map(([k, l]) => `<button class="${f === k ? 'on w' : ''}" data-f="${k}">${l} ${k === 'all' ? v.actions.length : count(k)}</button>`).join('')}</div></div>
  ${list.length ? prioCols(list, { full: true }) : '<div class="card"><div class="empty">Rien dans cette catégorie.</div></div>'}
  <h2>Prompt pour corriger le site</h2><div id="fixbox" class="card"><p class="mini">Chargement…</p></div>`;
  el.querySelectorAll('[data-f]').forEach((b) => (b.onclick = () => { state.filter = b.dataset.f; renderAudit(); }));
  bindActions(el);
  api(`/prompt/${encodeURIComponent(v.slug)}/${v.id}?type=fix`).then((p) => {
    $('#fixbox').innerHTML = p.count ? `<p>${p.count} action(s) validée(s). Colle ce texte dans la session Claude Code qui a construit le site.</p><textarea class="prompt" readonly id="fixtxt">${esc(p.text)}</textarea><p><button class="btn" id="cp">Copier le prompt</button></p>` : '<div class="empty">Valide au moins une action ci-dessus pour générer le prompt.</div>';
    $('#cp')?.addEventListener('click', () => copy(p.text));
    translateDom($('#fixbox'));
  });
}

function gscUrl(u) {
  try { return 'https://search.google.com/search-console/performance/search-analytics?resource_id=' + encodeURIComponent('sc-domain:' + new URL(u).hostname.replace(/^www\./, '')); } catch { return 'https://search.google.com/search-console'; }
}
function tabMoteurs(el) {
  const v = state.view, s = v.snap;
  const qmap = Object.fromEntries(v.queries.map((q) => [q.id, q]));
  const rows = v.serp.map((r) => ({ label: eng(r.engine), sub: (qmap[r.query_id]?.text || r.query_id) + (r.location ? ' · ' + t('depuis') + ' ' + r.location : ''), after: r.position, top: r.checked_top || 30 }));
  const ai = v.ai;
  const gsc = s.search?.gsc, gbp = s.local_presence?.gbp, bing = s.ai?.bing;
  el.innerHTML = `<p class="sub">Les moteurs classiques ont un vrai classement. Les IA n'en ont pas : on mesure si le site est <b>mentionné</b> ou <b>cité</b>, jamais un « rang » inventé. Les mesures viennent soit de la rubrique « Mesurer automatiquement », soit de l'export Search Console, soit de ta saisie ou de Claude dans ton Chrome.</p>
  <h2>Positions dans les moteurs</h2><div class="card">${rows.length ? rankStrips(rows) : '<div class="empty">Aucune position saisie. Ajoute une requête (par exemple « plombier Saint-Étienne »), cherche-la dans le moteur, et note ta place ci-dessous.</div>'}</div>
  <h2>Visibilité dans les IA</h2><div class="card">${ai.length ? aiBars(ai.map((e) => ({ label: eng(e.engine), n: e.n, mention: e.mentionRate, cite: e.citeRate, small: e.small }))) + `<p class="mini">Sous ${10} réponses par IA, les chiffres bougent beaucoup d'un jour à l'autre : ne conclus pas sur un écart faible.</p>` : '<div class="empty">Aucune réponse d\'IA saisie. Pose ta question à l\'IA, regarde si ton site est cité, et note-le ci-dessous. Répète au moins deux fois.</div>'}</div>
  <div class="grid2" style="margin-top:14px"><div class="card"><h3 style="margin-top:0">Google Search Console</h3><p><a class="btn sm" href="${gscUrl(s.url)}" target="_blank" rel="noopener noreferrer">Ouvrir Search Console ↗</a></p>${gsc ? `<div class="kpi"><div><b>${gsc.clicks ?? 'n/m'}</b><span>clics (${esc(gsc.period)})</span></div><div><b>${gsc.impressions ?? 'n/m'}</b><span>impressions</span></div><div><b>${gsc.avg_position ?? 'n/m'}</b><span>position moyenne</span></div></div>` : '<span class="mini">Non saisi.</span>'}${s.search?.indexed_pages != null ? `<p class="mini">${s.search.indexed_pages} page(s) indexée(s).</p>` : ''}${bing ? `<p class="mini">Bing AI Performance : ${bing.total_citations} citation(s) Copilot (${esc(bing.period)}).</p>` : ''}</div>
  ${s.profile.local ? `<div class="card"><h3 style="margin-top:0">Fiche Google Business</h3>${gbp ? `<div class="kpi"><div><b>${gbp.search_views ?? 'n/m'}</b><span>vues recherche</span></div><div><b>${gbp.calls ?? 'n/m'}</b><span>appels</span></div><div><b>${gbp.directions ?? 'n/m'}</b><span>itinéraires</span></div></div>` : '<span class="mini">Non saisi.</span>'}</div>` : ''}</div>
  <div class="noprint"><h2>Mesurer automatiquement</h2>${autoCard()}<h2>Saisir une mesure à la main</h2>${measureForms()}</div>${gscQueries(s)}`;
  bindMeasure(el); bindAuto(el);
}
const guessBrand = (s) => { const t = s.extra?.pages?.[0]?.title || ''; const first = t.split(/\s[-–—|·:]\s/)[0].trim(); return first && first.length <= 40 ? first : ''; };
const SERP_SET = ['brave', 'bing'];
function autoCard() {
  const v = state.view, cfg = state.cfg || {};
  const qs = v.queries.map((q) => `<label class="chk" style="display:flex"><input type="checkbox" name="q" value="${esc(q.id)}" checked> ${esc(q.id)} · ${esc(q.text)}</label>`).join('') || '<span class="mini">Aucune requête : ajoute-en dans la rubrique 1 plus bas.</span>';
  const ps = v.prompts.map((q) => `<label class="chk" style="display:flex"><input type="checkbox" name="p" value="${esc(q.id)}" checked> ${esc(q.id)} · ${esc(q.text)}</label>`).join('') || '<span class="mini">Aucune question : ajoute-en dans la rubrique 1 plus bas.</span>';
  const eng = (name, label, extra = '', on = true, disabled = false) => `<label class="chk" style="display:flex"><input type="checkbox" name="${name}" ${on && !disabled ? 'checked' : ''} ${disabled ? 'disabled' : ''}> ${label}${extra}</label>`;
  return `<div class="card"><form id="autof" style="display:grid;gap:14px">
    <label>Nom de l'entreprise, tel qu'une IA l'écrirait (plusieurs possibles, séparés par des virgules)<br><input type="text" name="brand" value="${esc(guessBrand(v.snap))}" style="width:100%"></label>
    <div class="grid2"><div><b>Moteurs de recherche</b> <span class="mini">(ma place dans les résultats)</span>
      ${eng('brave', 'Brave', ' <span class="mini">(20 premiers)</span>')}${eng('bing', 'Bing', ' <span class="mini">(30 premiers)</span>')}
      <div style="margin-top:6px">${qs}</div></div>
    <div><b>IA</b> <span class="mini">(mon site est-il mentionné ou cité ?)</span>
      ${eng('perplexity', 'Perplexity')}${eng('chatgpt', 'ChatGPT')}${eng('gemini', 'Gemini')}${eng('copilot', 'Copilot')}
      <div style="margin-top:6px">${ps}</div>
      <label class="chk" style="margin-top:6px">Répéter chaque question <select name="runs"><option>1</option><option selected>2</option><option>3</option></select> fois</label></div></div>
    <div class="row"><button class="btn" type="submit">Lancer les mesures</button><span class="mini" id="autoest"></span></div><div id="autojob"></div></form>
    <p class="mini">Les moteurs et les IA sont consultés dans un Chrome dédié qui s'ouvre tout seul : <b>ne touche pas à sa fenêtre pendant la mesure</b>. ${cfg.chrome === false ? '<b>Aucun navigateur compatible (Chrome, Brave ou Edge) trouvé sur ce PC.</b> ' : cfg.browser ? `Navigateur utilisé : <b>${esc(cfg.browser)}</b> (ton navigateur par défaut s'il est compatible, sinon Chrome, Brave ou Edge). ` : ''}ChatGPT, Gemini et Copilot demandent une connexion faite une fois : <button class="btn sec sm" type="button" id="prep">Préparer les connexions</button> (une fenêtre s'ouvre ; connecte-toi, puis ferme-la).</p>
    <p class="mini">Ces services interdisent les consultations automatisées dans leurs conditions d'utilisation : volume faible, lenteur volontaire, arrêt au premier captcha, aucun contournement. Tu utilises ton propre compte, à tes risques.</p></div>`;
}
function bindAuto(el) {
  const f = $('#autof'); if (f) {
    const est = () => { const fd = new FormData(f); const nq = fd.getAll('q').length, np = fd.getAll('p').length, runs = +fd.get('runs') || 1; const on = (k) => fd.get(k);
      const nS = SERP_SET.filter(on).length * nq, nA = ['perplexity', 'chatgpt', 'gemini', 'copilot'].filter(on).length * np * runs; const tot = nS + nA;
      $('#autoest').textContent = tot ? `${tot} mesure(s), environ ${Math.max(1, Math.round(tot * 0.4))} min` : ''; };
    f.addEventListener('change', est); est();
    f.onsubmit = async (e) => {
      e.preventDefault(); const fd = new FormData(f); const btn = f.querySelector('button[type=submit]'); btn.disabled = true;
      const engines = ['brave', 'bing', 'perplexity', 'chatgpt', 'gemini', 'copilot'].filter((k) => fd.get(k));
      try {
        const { job } = await api('/auto', { slug: state.view.slug, id: state.view.id, brand: fd.get('brand'), engines, query_ids: fd.getAll('q'), prompt_ids: fd.getAll('p'), runs: +fd.get('runs') });
        await followMeasure(job, $('#autojob'));
      } catch (err) { $('#autojob').innerHTML = `<div class="note">${esc(err.message)}</div>`; btn.disabled = false; }
    };
    $('#prep')?.addEventListener('click', async () => { try { await api('/browser-prepare', {}); toast('Fenêtre ouverte : connecte-toi à ChatGPT, Gemini et Copilot, puis ferme-la.'); } catch (err) { toast(err.message); } });
  }
  api(`/prompt/${encodeURIComponent(state.view.slug)}/${state.view.id}?type=measure`).then((p) => { const b = $('#mbox'); if (!b) return; b.innerHTML = `<p class="mini">Alternative : Claude peut faire les mesures à ta place dans ton propre Chrome. Ouvre une session Claude Code dans le dossier de SEO GEO Test (extension Chrome active) et colle ce texte.</p><textarea class="prompt" readonly>${esc(p.text)}</textarea><p><button class="btn sm" id="mcp">Copier</button></p>`; $('#mcp').onclick = () => copy(p.text); });
}
async function followMeasure(job, box) {
  for (;;) {
    const j = await api('/job/' + job);
    box.innerHTML = `<div class="progress"><i style="width:${j.pct}%"></i></div><div class="mini">${esc(j.step)} · ${j.done ?? 0}/${j.total ?? '?'}</div>`;
    if (j.status !== 'running') {
      state.view = await api(`/audit/${encodeURIComponent(state.view.slug)}/${state.view.id}`); renderAudit();
      const errs = [...new Set([...(j.errors || []), ...(j.error ? [j.error] : [])])];
      if (errs.length) { const n = document.createElement('div'); n.className = 'note'; n.innerHTML = 'Certaines mesures n\'ont pas pu être faites :<ul>' + errs.map((x) => `<li>${esc(x)}</li>`).join('') + '</ul>'; $('#panel').prepend(n); }
      return;
    }
    await new Promise((r) => setTimeout(r, 1000));
  }
}
function gscQueries(s) {
  const t = s.search?.gsc?.top_queries; if (!t?.length) return '';
  return `<h2>Requêtes Google (Search Console)</h2><div class="card" style="overflow:auto"><table><thead><tr><th>Requête</th><th class="n">Clics</th><th class="n">Impressions</th><th class="n">Position moy.</th></tr></thead><tbody>${t.slice(0, 20).map((r) => `<tr><td>${esc(r.q)}</td><td class="n">${r.clicks}</td><td class="n">${r.impressions}</td><td class="n">${r.position}</td></tr>`).join('')}</tbody></table><p class="mini">Source : ${esc(s.search.gsc.source || 'saisie')} · ${t.length} requête(s) conservée(s) sur les plus vues.</p></div>`;
}
function measureForms() {
  const v = state.view, s = v.snap;
  const qopt = v.queries.map((q) => `<option value="${esc(q.id)}">${esc(q.id)} · ${esc(q.text)}${q.kind === 'voice' ? ' (' + t('vocale') + ')' : ''}</option>`).join('');
  const popt = v.prompts.map((q) => `<option value="${esc(q.id)}">${esc(q.id)} · ${esc(q.text)}</option>`).join('');
  return `<div class="card"><details><summary>1. Requêtes et questions suivies (figées pour pouvoir comparer)</summary>
    <p class="mini">On peut en ajouter, jamais en retirer : c'est ce qui rend les comparaisons honnêtes. Pour une recherche vocale, écris la phrase telle qu'on la dit : « trouve-moi un plombier à Saint-Étienne ».</p>
    ${v.queries.length ? `<table><tbody>${v.queries.map((q) => `<tr><td>${esc(q.id)}</td><td>${esc(q.text)}${q.kind === 'voice' ? ' <span class="tag">vocale</span>' : ''}</td></tr>`).join('')}</tbody></table>` : ''}
    <form class="row" data-f="query"><input type="text" name="text" placeholder="Nouvelle requête" required style="flex:1;min-width:220px"><label class="chk"><input type="checkbox" name="voice"> recherche vocale</label><button class="btn sm">Ajouter</button></form>
    ${v.prompts.length ? `<table><tbody>${v.prompts.map((q) => `<tr><td>${esc(q.id)}</td><td>${esc(q.text)}</td></tr>`).join('')}</tbody></table>` : ''}
    <form class="row" data-f="prompt"><input type="text" name="text" placeholder="Nouvelle question pour les IA" required style="flex:1;min-width:220px"><button class="btn sm">Ajouter</button></form></details></div>
  <div class="card" style="margin-top:12px"><details><summary>2. Ma place dans un moteur</summary><form class="row" data-f="serp" style="margin-top:10px">
    <select name="engine">${SERP_ENG.map((e) => `<option value="${e}">${esc(eng(e))}</option>`).join('')}</select><select name="query_id" required>${qopt || '<option value="">Ajoute d\'abord une requête</option>'}</select>
    <input type="text" name="location" placeholder="Lieu (cartes)" style="max-width:160px"><input type="number" name="position" min="1" placeholder="Place (vide = hors liste)" style="max-width:190px"><input type="number" name="checked_top" min="5" value="30" title="Nombre de résultats regardés" style="max-width:90px"><button class="btn sm">Enregistrer</button></form>
    <p class="mini">Regarde les 30 premiers résultats ; si ton site n'y est pas, laisse la place vide. Pour Google, privilégie la position moyenne de Search Console (plus fiable qu'une recherche à la main).</p></details></div>
  <div class="card" style="margin-top:12px"><details><summary>3. Réponse d'une IA</summary><form data-f="ai" style="display:grid;gap:10px;margin-top:10px"><div class="row">
    <select name="engine">${AI_ENG.map((e) => `<option value="${e}">${esc(eng(e))}</option>`).join('')}</select><select name="prompt_id" required>${popt || '<option value="">Ajoute d\'abord une question</option>'}</select></div>
    <div class="row"><label class="chk"><input type="checkbox" name="mentioned"> Mon site / mon entreprise est mentionné</label><input type="number" name="rank_in_answer" min="1" placeholder="Ordre dans la réponse" style="max-width:190px"><label class="chk"><input type="checkbox" name="cited"> Mon site est cité en source</label></div>
    <input type="text" name="competitors" placeholder="Concurrents cités (séparés par des virgules)"><div><button class="btn sm">Enregistrer</button></div></form></details></div>
  <div class="card" style="margin-top:12px"><details><summary>4. Chiffres Search Console, Bing et fiche Google</summary><div style="margin-top:10px"><b>Importer l'export Search Console</b> <a class="btn sm sec" href="${gscUrl(s.url)}" target="_blank" rel="noopener noreferrer">Ouvrir Search Console ↗</a><p class="mini">Search Console > Performances > Exporter > Télécharger .csv, puis choisis le fichier « Requêtes.csv » (dans le zip). Les clics, impressions et positions réelles de Google sont repris automatiquement.</p><input type="file" id="gscfile" accept=".csv,text/csv"></div><form data-f="search" class="row" style="margin-top:10px">
    <input type="number" name="clicks" placeholder="Clics 28 j" style="max-width:120px"><input type="number" name="impressions" placeholder="Impressions" style="max-width:130px"><input type="number" step="0.1" name="avg_position" placeholder="Position moy." style="max-width:130px"><input type="number" name="indexed_pages" placeholder="Pages indexées" style="max-width:140px"><input type="number" name="bing_citations" placeholder="Citations Copilot (Bing)" style="max-width:190px"><button class="btn sm">Enregistrer</button></form>
    ${v.snap.profile.local ? `<form data-f="local" class="row" style="margin-top:10px"><input type="number" name="search_views" placeholder="Vues recherche 30 j" style="max-width:170px"><input type="number" name="maps_views" placeholder="Vues Maps" style="max-width:120px"><input type="number" name="calls" placeholder="Appels" style="max-width:100px"><input type="number" name="directions" placeholder="Itinéraires" style="max-width:110px"><input type="number" name="website_clicks" placeholder="Clics site" style="max-width:110px"><button class="btn sm">Enregistrer</button></form>` : ''}</details></div>`;
}
function bindMeasure(el) {
  $('#gscfile')?.addEventListener('change', async (e) => { const file = e.target.files[0]; if (!file) return; try { const csv = await file.text(); state.view = await api('/import-gsc', { slug: state.view.slug, id: state.view.id, csv }); toast('Export importé'); renderAudit(); } catch (err) { toast(err.message); } });
  el.querySelectorAll('form[data-f]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault();
    const fd = Object.fromEntries(new FormData(f).entries());
    const v = state.view;
    try {
      if (f.dataset.f === 'query' || f.dataset.f === 'prompt') {
        await api('/query', { slug: v.slug, kind: f.dataset.f === 'prompt' ? 'prompts' : 'queries', text: fd.text, voice: !!fd.voice });
      } else {
        const data = { ...fd, mentioned: !!fd.mentioned, cited: !!fd.cited };
        state.view = await api('/measure', { slug: v.slug, id: v.id, kind: f.dataset.f, data });
        toast('Enregistré'); renderAudit(); return;
      }
      state.view = await api(`/audit/${encodeURIComponent(v.slug)}/${v.id}`); toast('Ajouté'); renderAudit();
    } catch (err) { toast(err.message); }
  }));
}

function tabControles(el) {
  const v = state.view;
  const byDomain = {};
  v.checks.forEach((c) => (byDomain[c.domain] ??= []).push(c));
  const unv = v.checks.filter((c) => c.status === 'unverified').length;
  el.innerHTML = `<p class="sub">${unv} contrôle(s) non vérifié(s) : l'application ne peut pas les juger seule (confort au clavier, vraies photos, comptes Google…). Tu peux les valider à la main, ou demander à Claude de les vérifier dans le dossier du site.</p>
  <div class="card noprint" style="margin-bottom:14px"><details><summary>Demander à Claude de compléter les contrôles non vérifiés</summary><div id="cbox" style="margin-top:10px"><p class="mini">Chargement…</p></div></details></div>
  ${Object.entries(byDomain).map(([d, list]) => `<h3>${esc(list[0].domainLabel)}</h3><div class="card"><table><tbody>${list.map((c) => `<tr><td style="width:150px">${badge(c.status)}${state.view.snap.checks?.[c.id]?.manual ? '<div class="mini">saisi à la main</div>' : ''}</td><td><b>${esc(c.label)}</b>${helpBtn(c.id)}<div class="mini">${esc(c.evidence)}</div>
  <details class="noprint"><summary class="mini">Modifier</summary><form class="row" data-c="${esc(c.id)}" style="margin-top:6px"><select name="status"><option value="pass">Réussi</option><option value="fail">À corriger</option><option value="na">Sans objet</option><option value="unverified">Non vérifié</option></select><input type="text" name="evidence" placeholder="Preuve ou remarque" style="flex:1;min-width:180px"><button class="btn sm">Enregistrer</button></form></details></td><td class="n"><span class="tag">${esc(c.weight)}</span></td></tr>`).join('')}</tbody></table></div>`).join('')}`;
  el.querySelectorAll('form[data-c]').forEach((f) => (f.onsubmit = async (e) => {
    e.preventDefault(); const fd = Object.fromEntries(new FormData(f).entries());
    try { state.view = await api('/check', { slug: v.slug, id: v.id, checkId: f.dataset.c, status: fd.status, evidence: fd.evidence }); toast('Enregistré'); renderAudit(); } catch (err) { toast(err.message); }
  }));
  api(`/prompt/${encodeURIComponent(v.slug)}/${v.id}?type=complete`).then((p) => { $('#cbox').innerHTML = `<p class="mini">Ouvre une session Claude Code dans le dossier de SEO GEO Test et colle ce texte.</p><textarea class="prompt" readonly>${esc(p.text)}</textarea><p><button class="btn sm" id="ccp">Copier</button></p>`; $('#ccp').onclick = () => copy(p.text); });
}

function tabPages(el) {
  const pg = state.view.snap.extra?.pages || [];
  el.innerHTML = `<p class="sub">${pg.length} page(s) analysée(s) (échantillon : accueil, sitemap et liens principaux).</p><div class="card" style="overflow:auto"><table><thead><tr><th>Page</th><th class="n">HTTP</th><th>Titre</th><th>H1</th><th class="n">Mots</th><th class="n">ms</th></tr></thead><tbody>
  ${pg.map((p) => `<tr><td>${esc(p.url)}</td><td class="n">${p.status || '–'}</td><td>${esc(p.title || '')}</td><td>${esc(p.h1 || '')}</td><td class="n">${p.words ?? ''}</td><td class="n">${p.ms}</td></tr>`).join('')}</tbody></table></div>`;
}

// ---------- Conseils hors site (checklist, hors score)
async function tabConseils(el) {
  const v = state.view;
  el.innerHTML = '<p class="mini">Chargement…</p>';
  const d = await api(`/tips/${encodeURIComponent(v.slug)}?local=${v.snap.profile?.local ? 1 : 0}`);
  d.tips.forEach((x) => { v.help['tip.' + x.id] = [x.what, x.why]; });
  const done = d.tips.filter((x) => x.status === 'done').length, na = d.tips.filter((x) => x.status === 'na').length, total = d.tips.length - na;
  const pct = total ? Math.round((done / total) * 100) : 0;
  el.innerHTML = `<p class="sub">${L('Ce qui se passe en dehors du site et qui aide pourtant à être trouvé : fiches, annuaires, avis, liens, présence pour les IA. Coche au fur et à mesure ; c\'est enregistré pour ce site. Ces conseils ne comptent pas dans le score.', 'What happens outside the site yet helps you get found: listings, directories, reviews, links, presence for AIs. Tick as you go; it is saved for this site. These tips do not count in the score.')}</p>
  <div class="card"><div class="row" style="justify-content:space-between"><b>${done} / ${total} ${L('faits', 'done')}</b><span class="mini">${pct} %${na ? ' · ' + na + ' ' + L('sans objet', 'not applicable') : ''}</span></div><div class="progress"><i style="width:${pct}%"></i></div>${v.snap.profile?.local ? '' : `<p class="mini" style="margin:0">${L('Les conseils réservés aux sites locaux (fiches Google, Apple, Bing, annuaires…) sont masqués : lance un audit en cochant « Site local » pour les voir.', 'Tips for local businesses only (Google, Apple, Bing listings, directories…) are hidden: run an audit with "Local business" ticked to see them.')}</p>`}</div>
  ${d.groups.map((g) => { const list = d.tips.filter((x) => x.group === g.id); if (!list.length) return ''; const gd = list.filter((x) => x.status === 'done').length;
    return `<h2>${esc(g.label)} <span class="mini" style="font-weight:400">${gd}/${list.length}</span></h2><div class="card">${list.map((x) => `<div class="tip-row ${x.status === 'done' ? 'is-done' : ''} ${x.status === 'na' ? 'is-na' : ''}"><label class="tip-chk"><input type="checkbox" data-tip="${esc(x.id)}" ${x.status === 'done' ? 'checked' : ''}><span class="sr">${L('Fait', 'Done')}</span></label>
      <div class="tip-main"><h4>${esc(x.title)}${helpBtn('tip.' + x.id)}</h4>${x.links.length ? `<div class="tip-links">${x.links.map((k) => `<a href="${esc(k.url)}" target="_blank" rel="noopener noreferrer">${esc(k.label)} ↗</a>`).join('')}</div>` : ''}</div>
      <div class="seg noprint" role="group" aria-label="Statut" data-tid="${esc(x.id)}"><button class="w ${x.status === 'later' ? 'on' : ''}" data-s="later">Plus tard</button><button class="w ${x.status === 'na' ? 'on' : ''}" data-s="na">Sans objet</button></div></div>`).join('')}</div>`; }).join('')}`;
  const save = async (id, st) => { try { await api('/tip', { slug: v.slug, id, status: st }); tabConseils(el); } catch (e) { toast(e.message); } };
  el.querySelectorAll('input[data-tip]').forEach((c) => (c.onchange = () => save(c.dataset.tip, c.checked ? 'done' : 'none')));
  el.querySelectorAll('.seg[data-tid]').forEach((seg) => seg.querySelectorAll('button').forEach((b) => (b.onclick = () => save(seg.dataset.tid, b.classList.contains('on') ? 'none' : b.dataset.s))));
}

// ---------- Comparaison
async function comparePage(slug, a, b) {
  await loadSide(slug);
  const d = await api(`/compare/${encodeURIComponent(slug)}/${a}/${b}`);
  const site = await api('/site/' + encodeURIComponent(slug));
  const qmap = Object.fromEntries(site.queries.map((q) => [q.id, q]));
  const c = d.cats, sc = d.scores;
  const k = sc.constant;
  const verdictWord = k.delta == null ? 'Pas assez de contrôles communs pour conclure' : k.delta > 0 ? 'Le site progresse' : k.delta < 0 ? 'Le site recule' : 'Le site est stable';
  const gc = (label, x) => `<div class="card gauge"><div class="lbl">${esc(label)}</div>${gauge(x.after)}<div class="hint">avant : ${x.before ?? 'n/m'}</div><div>${dl(x.delta)}</div></div>`;
  const sel = (cur, other, isA) => `<select data-sel="${isA ? 'a' : 'b'}">${site.audits.map((x) => `<option value="${x.id}" ${x.id === cur ? 'selected' : ''}>${esc(fmtDate(x.date))}${x.id.length > 10 ? ' (' + x.id.slice(11) + ')' : ''}</option>`).join('')}</select>`;
  app.innerHTML = `<h1>${esc(slug)} : comparaison</h1><div class="row noprint" style="margin-bottom:12px">Avant ${sel(a, b, true)} Après ${sel(b, a, false)}<a href="#/audit/${encodeURIComponent(slug)}/${b}">Voir le rapport « après »</a></div>
  <div class="verdict"><h2>${esc(verdictWord)}</h2><p style="margin:0">${k.delta == null ? '' : `À contrôles identiques (${k.checks} comparables), le score passe de <b>${k.before}</b> à <b>${k.after}</b> ${dl(k.delta)} en ${d.days} jour(s). `}${c.fixed.length} point(s) corrigé(s), ${c.regressed.length} régression(s), ${c.stillFailing.length} toujours à corriger.</p></div>
  ${d.caveats.map((x) => `<div class="note">${esc(x)}</div>`).join('')}
  <h2>Scores</h2><div class="gauges">${gc('Global', sc.global)}${gc('SEO classique', sc.classic)}${gc('Lisible par les IA', sc.geo)}</div>
  <p class="mini">Le score « global » inclut les contrôles ajoutés ou perdus entre les deux dates ; l'écart à contrôles identiques ci-dessus est le plus fiable.</p>
  <h2>Par domaine (contrôles identiques)</h2><div class="card">${domainBars(Object.values(d.domains).map((x) => ({ label: x.label, score: x.after, max: x.max, before: x.before })))}<div class="legend"><span><i style="background:var(--teal)"></i>maintenant</span><span>trait noir : avant</span></div></div>
  <div class="grid2"><div><h2>Corrigé</h2><div class="card">${c.fixed.length ? c.fixed.map((x) => `<p><span class="badge b-pass">✓</span> <b>${esc(x.label)}</b><br><span class="mini">${esc(x.domainLabel)}</span></p>`).join('') : '<div class="empty">Rien de corrigé depuis l\'audit précédent.</div>'}</div></div>
  <div><h2>Régressions</h2><div class="card">${c.regressed.length ? c.regressed.map((x) => `<p><span class="badge b-fail">✕</span> <b>${esc(x.label)}</b><br><span class="mini">${esc(x.evidence)}</span></p>`).join('') : '<div class="empty">Aucune régression.</div>'}</div></div></div>
  <h2>Toujours à corriger (${c.stillFailing.length})</h2><div class="card">${c.stillFailing.length ? `<table><tbody>${c.stillFailing.map((x) => `<tr><td><b>${esc(x.label)}</b><div class="mini">${esc(x.evidence)}</div></td><td class="n"><span class="tag">${esc(x.weight)}</span></td></tr>`).join('')}</tbody></table>` : '<div class="empty">Plus rien.</div>'}</div>
  ${c.gained.length || c.lost.length ? `<p class="mini">${c.gained.length} contrôle(s) vérifié(s) en plus et ${c.lost.length} en moins entre les deux audits : ils sont exclus de l'écart à contrôles identiques.</p>` : ''}
  <h2>Positions dans les moteurs</h2><div class="card">${d.serp.length ? rankStrips(d.serp.map((r) => ({ label: eng(r.engine), sub: (qmap[r.query_id]?.text || r.query_id) + (r.location ? ' · ' + t('depuis') + ' ' + r.location : ''), before: r.before, after: r.after, top: r.checked_top || 30 }))) + '<div class="legend"><span><i style="background:var(--surface);border:2px solid var(--muted)"></i>avant</span><span><i style="background:var(--teal)"></i>maintenant</span></div>' : '<div class="empty">Aucune position comparable : il faut les mêmes requêtes et les mêmes moteurs aux deux dates.</div>'}</div>
  <h2>Visibilité dans les IA</h2><div class="card">${d.ai.length ? `<table><thead><tr><th>IA</th><th class="n">Mentionné avant → maintenant</th><th class="n">Cité avant → maintenant</th></tr></thead><tbody>${d.ai.map((x) => `<tr><td>${esc(eng(x.engine))}${x.small ? ' <span class="badge b-warn">peu fiable</span>' : ''}</td><td class="n">${x.before.mentionRate} % → ${x.after.mentionRate} % ${dl(x.dMention, ' pts')}</td><td class="n">${x.before.citeRate} % → ${x.after.citeRate} % ${dl(x.dCite, ' pts')}</td></tr>`).join('')}</tbody></table><p class="mini">Calculé sur les ${d.sharedPrompts} question(s) posées aux deux dates.</p>` : '<div class="empty">Aucune mesure IA comparable.</div>'}</div>
  <h2>Autres mesures</h2><div class="card"><table><tbody>${[['Clics Google (Search Console)', 'gsc_clicks'], ['Impressions Google', 'gsc_impressions'], ['Position moyenne Google (plus bas = mieux)', 'gsc_pos', true], ['Pages indexées', 'indexed'], ['Citations Copilot (Bing)', 'bing_citations'], ['Appels (fiche Google)', 'gbp_calls'], ['Itinéraires (fiche Google)', 'gbp_directions']].map(([l, key, inv]) => { const m = d.metrics[key]; return m.before == null && m.after == null ? '' : `<tr><td>${esc(l)}</td><td class="n">${m.before ?? 'n/m'} → ${m.after ?? 'n/m'}</td><td class="n">${m.delta == null ? '' : dlc(m.delta, inv)}</td></tr>`; }).join('') || '<tr><td class="mini">Aucune mesure commune.</td></tr>'}</tbody></table></div>`;
  app.querySelectorAll('[data-sel]').forEach((s) => (s.onchange = () => { const x = $('[data-sel=a]').value, y = $('[data-sel=b]').value; if (x !== y) location.hash = `#/compare/${encodeURIComponent(slug)}/${x}/${y}`; }));
}

// ---------- Documentation : ce qui est mesuré
async function docPage() {
  await loadSide('__aide');
  const c = await api('/catalog');
  const W = c.weights, tot = c.domains.reduce((n, d) => n + d.max, 0);
  const wl = { critique: L('Critique', 'Critical'), important: L('Important', 'Important'), bonus: 'Bonus' }, wc = { critique: 'crit', important: 'imp', bonus: 'bon' };
  const eff = { 1: L('rapide', 'quick'), 2: L('moyen', 'medium'), 3: L('long', 'long') };
  const n = c.checks.length, nl = c.checks.filter((x) => x.applies === 'local').length, nm = c.checks.filter((x) => x.applies === 'multilingue').length;
  const byD = (d) => c.checks.filter((x) => x.domain === d);
  app.innerHTML = `<div class="doc"><h1>${L('Documentation : ce qui est mesuré', 'Documentation: what is measured')}</h1>
  <p class="sub">${L('Tout ce que SEO GEO Test vérifie, comment le score est calculé, et ce qu\'il ne sait pas faire.', 'Everything SEO GEO Test checks, how the score is computed, and what it cannot do.')}</p>

  <h2>${L('SEO et GEO, en deux phrases', 'SEO and GEO in two sentences')}</h2>
  <div class="card"><p style="margin-top:0"><b>SEO</b> (Search Engine Optimization) ${L(': faire en sorte que Google, Bing ou Brave trouvent ton site et le placent haut dans leurs résultats.', ': making sure Google, Bing or Brave find your site and rank it high in their results.')}</p>
  <p style="margin-bottom:0"><b>GEO</b> (Generative Engine Optimization) ${L(': faire en sorte que ChatGPT, Gemini, Perplexity ou Copilot comprennent ton site, le citent et le recommandent dans leurs réponses.', ': making sure ChatGPT, Gemini, Perplexity or Copilot understand your site, cite it and recommend it in their answers.')}</p></div>

  <h2>${L('Les deux familles de mesures', 'The two kinds of measurements')}</h2>
  <div class="grid2"><div class="card"><h3 style="margin-top:0">1. ${L('L\'audit du site (le score)', 'The site audit (the score)')}</h3><p>${L(`L'application lit ton site comme le ferait un robot : la page d'accueil, le robots.txt, le sitemap et un échantillon d'au plus 12 pages et 40 liens. Elle en tire ${n} contrôles précis, chacun « réussi » ou « à corriger », avec la preuve trouvée. <b>C'est la seule partie qui compte dans le score.</b>`, `The app reads your site the way a robot would: the homepage, robots.txt, the sitemap and a sample of at most 12 pages and 40 links. It turns that into ${n} precise checks, each "passed" or "to fix", with the evidence found. <b>This is the only part that counts in the score.</b>`)}</p></div>
  <div class="card"><h3 style="margin-top:0">2. ${L('La visibilité réelle (hors score)', 'Real visibility (outside the score)')}</h3><p>${L('Ta place dans Brave et Bing, et la façon dont les IA te mentionnent ou te citent. C\'est de la mesure, pas du jugement : elle n\'entre pas dans le score, mais elle te dit si le travail porte ses fruits, et se compare d\'un audit à l\'autre.', 'Your place in Brave and Bing, and how the AIs mention or cite you. This is measurement, not judgement: it is not part of the score, but it tells you whether the work is paying off, and it can be compared from one audit to the next.')}</p></div></div>

  <h2>${L('Comment le score est calculé', 'How the score is computed')}</h2>
  <div class="card"><ul style="margin-top:0">
  <li>${L(`Chaque contrôle a un niveau d'importance, qui donne un poids : <span class="tag crit">Critique</span> = ${W.critique} · <span class="tag imp">Important</span> = ${W.important} · <span class="tag bon">Bonus</span> = ${W.bonus}. C'est aussi le code couleur de l'application : rouge, orange, bleu.`, `Each check has an importance level, which gives a weight: <span class="tag crit">Critical</span> = ${W.critique} · <span class="tag imp">Important</span> = ${W.important} · <span class="tag bon">Bonus</span> = ${W.bonus}. It is also the colour code of the app: red, orange, blue.`)}</li>
  <li>${L(`Les contrôles sont rangés en ${c.domains.length} domaines, chacun valant un nombre de points (total ${tot}). Dans un domaine : points obtenus = (poids des contrôles réussis ÷ poids des contrôles vérifiés) × points du domaine.`, `Checks are grouped into ${c.domains.length} domains, each worth a number of points (total ${tot}). Within a domain: points earned = (weight of passed checks ÷ weight of verified checks) × the domain's points.`)}</li>
  <li><b>${L('Seuls les contrôles vérifiés comptent.', 'Only verified checks count.')}</b> ${L('Un contrôle que l\'application ne peut pas juger seule (confort au clavier, vraies photos…) reste « non vérifié » : il ne fait ni monter ni baisser le score. Un domaine sans aucun contrôle vérifié affiche « n/m » (non mesuré).', 'A check the app cannot judge on its own (keyboard comfort, real photos…) stays "unverified": it neither raises nor lowers the score. A domain with no verified check shows "n/m" (not measured).')}</li>
  <li>${L('Trois scores : <b>global</b> (tous les domaines), <b>SEO classique</b> (tous sauf GEO) et <b>Lisible par les IA</b> (domaine GEO seul).', 'Three scores: <b>global</b> (all domains), <b>classic SEO</b> (all but GEO) and <b>AI-readable</b> (the GEO domain alone).')}</li>
  <li>${L('Couleurs des jauges : <b style="color:var(--pass)">vert</b> à partir de 70, <b style="color:var(--imp)">orange</b> de 40 à 69, <b style="color:var(--crit)">rouge</b> sous 40.', 'Gauge colours: <b style="color:var(--pass)">green</b> from 70, <b style="color:var(--imp)">orange</b> from 40 to 69, <b style="color:var(--crit)">red</b> below 40.')}</li>
  <li>${L('Si moins de 70 % des contrôles applicables sont vérifiés, un avertissement indique que le score est indicatif.', 'If fewer than 70% of the applicable checks are verified, a warning says the score is only indicative.')}</li>
  <li>${L('Comparer deux audits se fait « à contrôles identiques » : un score peut bouger simplement parce qu\'on a vérifié plus de choses, la comparaison ne retient que les contrôles vérifiés aux deux dates.', 'Comparing two audits is done "on identical checks": a score can move simply because more things were verified, so the comparison only keeps checks verified on both dates.')}</li>
  <li>${L(`Les contrôles « local » (${nl}) ne s'appliquent que si tu coches « Site local » ; les contrôles « multilingue » (${nm}) que si tu coches « Plusieurs langues ».`, `The "local" checks (${nl}) only apply if you tick "Local business"; the "multilingual" checks (${nm}) only if you tick "Several languages".`)}</li></ul>
  <table style="margin-top:8px"><thead><tr><th>${L('Domaine', 'Domain')}</th><th class="n">${L('Points', 'Points')}</th><th class="n">${L('Contrôles', 'Checks')}</th></tr></thead><tbody>${c.domains.map((d) => `<tr><td>${esc(d.label)}</td><td class="n">${d.max}</td><td class="n">${byD(d.id).length}</td></tr>`).join('')}</tbody></table></div>

  <h2>${L('La visibilité : positions et IA', 'Visibility: rankings and AI')}</h2>
  <div class="card"><ul style="margin-top:0">
  <li><b>Brave, Bing</b> ${L(': l\'application cherche tes requêtes dans un Chrome dédié et note ta place parmi les 20 (Brave) ou 30 (Bing) premiers résultats, ou « hors liste ».', ': the app searches your queries in a dedicated Chrome and notes your place among the first 20 (Brave) or 30 (Bing) results, or "not listed".')}</li>
  <li><b>Google</b> ${L(': jamais interrogé automatiquement (c\'est contraire à ses conditions). On utilise l\'export de Google Search Console (clics, impressions, position moyenne réels), importé dans l\'application, avec un bouton raccourci pour l\'ouvrir.', ': never queried automatically (it is against its terms). Use the Google Search Console export (real clicks, impressions, average position), imported into the app, with a shortcut button to open it.')}</li>
  <li><b>Perplexity, ChatGPT, Gemini, Copilot</b> ${L(': l\'application leur pose tes questions, deux fois chacune par défaut, et note si ton site est <b>mentionné</b> (nommé dans la réponse) et/ou <b>cité</b> (lien source), et quels concurrents apparaissent. <b>Une IA n\'a pas de classement</b> : on ne publie jamais un « rang » inventé, seulement des pourcentages.', ': the app asks them your questions, twice each by default, and notes whether your site is <b>mentioned</b> (named in the answer) and/or <b>cited</b> (source link), and which competitors appear. <b>An AI has no ranking</b>: we never publish an invented "rank", only percentages.')}</li>
  <li>${L('Sous 10 réponses par IA, les pourcentages sont marqués « peu fiables » : ils varient beaucoup d\'un jour à l\'autre.', 'Under 10 answers per AI, the percentages are flagged "unreliable": they vary a lot from day to day.')}</li>
  <li>${L('Les requêtes et questions suivies sont figées : on peut en ajouter, jamais en retirer, pour que les comparaisons restent honnêtes.', 'The tracked queries and questions are frozen: you can add some, never remove any, so comparisons stay honest.')}</li>
  <li><b>PageSpeed Insights</b> ${L(': mesure de vitesse (LCP, CLS, INP, score) via l\'API publique gratuite de Google, sur mobile. Si le quota gratuit est atteint, la mesure est simplement absente.', ': speed measurement (LCP, CLS, INP, score) through Google\'s free public API, on mobile. If the free quota is reached, the measurement is simply missing.')}</li>
  <li>${L('Search Console, Bing Webmaster et fiche Google Business peuvent aussi être saisis à la main dans l\'onglet « Moteurs et IA ».', 'Search Console, Bing Webmaster and Google Business figures can also be typed in by hand in the "Search engines and AI" tab.')}</li></ul></div>

  <h2>${L('Tes données restent sur ton PC', 'Your data stays on your PC')}</h2>
  <div class="card"><ul style="margin:0"><li>${L('Rapports, décisions, requêtes suivies et conseils cochés sont des fichiers dans le dossier <code>reports</code>. Les éléments supprimés vont dans <code>reports\\_corbeille</code>.', 'Reports, decisions, tracked queries and ticked tips are files in the <code>reports</code> folder. Deleted items go to <code>reports\\_corbeille</code>.')}</li>
  <li>${L('Aucun compte, aucune statistique d\'usage, aucun envoi à l\'auteur. Le programme n\'écoute que sur 127.0.0.1 (ton PC) et refuse les requêtes venant d\'ailleurs.', 'No account, no usage statistics, nothing sent to the author. The program only listens on 127.0.0.1 (your PC) and refuses requests coming from elsewhere.')}</li>
  <li>${L('Sorties réseau : lecture du site audité ; PageSpeed Insights (Google) si coché ; requêtes aux moteurs et IA que tu choisis de mesurer, depuis le navigateur dédié ; au premier lancement seulement, téléchargement d\'un composant (playwright-core) depuis le registre npm.', 'Network traffic: reading the audited site; PageSpeed Insights (Google) if ticked; queries to the engines and AIs you choose to measure, from the dedicated browser; on first launch only, download of one component (playwright-core) from the npm registry.')}</li>
  <li>${L('Les connexions aux IA sont mémorisées dans le profil du navigateur dédié (dossier <code>app\\browser-profile</code>) : ne le copie ni ne le partage jamais.', 'AI sign-ins are remembered in the dedicated browser\'s profile (folder <code>app\\browser-profile</code>): never copy or share it.')}</li></ul></div>

  <h2>${L('L\'onglet Conseils', 'The Tips tab')}</h2>
  <div class="card"><p style="margin:0">${L('Une checklist de ce qui se passe hors du site (fiches Google, Apple et Bing, annuaires, avis, liens, présence pour les IA, suivi). Tu coches au fur et à mesure ; l\'état est enregistré pour chaque site. <b>Ces conseils ne comptent pas dans le score</b> : l\'application ne peut pas les vérifier, ils servent de guide.', 'A checklist of what happens outside the site (Google, Apple and Bing listings, directories, reviews, links, presence for AIs, follow-up). Tick as you go; the state is saved per site. <b>These tips do not count in the score</b>: the app cannot verify them, they are a guide.')}</p></div>

  <h2>${L('Ce que l\'application ne fait pas', 'What the app does not do')}</h2>
  <div class="card"><ul style="margin:0"><li>${L('Elle ne modifie jamais ton site : elle lit, et te prépare un prompt de corrections à coller dans la session qui construit le site.', 'It never modifies your site: it reads, and prepares a fix prompt for you to paste into the session that builds the site.')}</li>
  <li>${L('Elle n\'invente aucune donnée : « non mesuré » est une réponse valable.', 'It invents no data: "not measured" is a valid answer.')}</li>
  <li>${L('Elle ne contourne aucun captcha et s\'arrête au premier ; aucun mot de passe n\'est saisi à ta place. Tout reste sur ton PC (dossier reports) ; rien n\'est envoyé à un service de l\'auteur.', 'It bypasses no captcha and stops at the first one; no password is typed for you. Everything stays on your PC (reports folder); nothing is sent to any service of the author.')}</li>
  <li>${L('Elle ne garantit pas de résultat : un bon score veut dire « le site est bien préparé », pas « il sera premier ».', 'It guarantees no result: a good score means "the site is well prepared", not "it will rank first".')}</li></ul></div>

  <h2>${L(`Les ${n} contrôles, un par un`, `The ${n} checks, one by one`)}</h2>
  <p class="mini">${L('Niveau, effort estimé pour corriger, ce que c\'est et pourquoi c\'est utile.', 'Level, estimated effort to fix, what it is and why it matters.')}</p>
  ${c.domains.map((d) => `<h3>${esc(d.label)} <span class="mini">· ${d.max} ${L('points', 'points')}</span></h3><div class="card">${byD(d.id).map((x) => `<div class="doc-check"><h4>${esc(x.label)} <span class="tag ${wc[x.weight]}">${esc(wl[x.weight])}</span><span class="tag">${L('effort', 'effort')} : ${esc(eff[x.effort])}</span>${x.applies ? `<span class="tag">${x.applies === 'local' ? L('sites locaux', 'local sites') : L('multilingue', 'multilingual')}</span>` : ''}</h4><p>${esc(x.what)}</p><p class="mini"><b>${L('Pourquoi', 'Why')} :</b> ${esc(x.why)}</p></div>`).join('')}</div>`).join('')}
  <p class="mini" style="margin-top:20px">${L('Une idée de contrôle en plus ? Ouvre une demande sur la page GitHub du projet.', 'Got an idea for another check? Open an issue on the project\'s GitHub page.')}</p></div>`;
}

// ---------- Routeur
async function route() {
  const p = location.hash.replace(/^#\/?/, '').split('/').map(decodeURIComponent);
  try {
    if (p[0] === 'aide') await docPage();
    else if (p[0] === 'site' && p[1]) await sitePage(p[1]);
    else if (p[0] === 'audit' && p[1] && p[2]) await auditPage(p[1], p[2], state.view?.id === p[2] ? null : 'resume');
    else if (p[0] === 'compare' && p.length === 4) await comparePage(p[1], p[2], p[3]);
    else await home();
  } catch (e) { app.innerHTML = `<h1>Oups</h1><div class="note">${esc(e.message)}</div><p><a href="#/">Retour à l'accueil</a></p>`; }
  scrollTo(0, 0);
}
addEventListener('hashchange', route);
route();

// Infobulle d'explication « ? » : survol, clic ou clavier
(() => {
  let pop = null, owner = null, pinned = false;
  const close = () => { pinned = false; pop?.remove(); pop = null; owner?.setAttribute('aria-expanded', 'false'); owner = null; };
  const open = (btn) => {
    const h = state.view?.help?.[btn.dataset.help]; if (!h) return;
    close(); owner = btn; btn.setAttribute('aria-expanded', 'true');
    pop = document.createElement('div'); pop.className = 'helppop'; pop.setAttribute('role', 'tooltip');
    pop.innerHTML = `<p><b>C'est quoi ?</b><br>${esc(h[0])}</p><p><b>Pourquoi le faire ?</b><br>${esc(h[1])}</p>`;
    document.body.appendChild(pop);
    const r = btn.getBoundingClientRect(), w = pop.offsetWidth;
    pop.style.left = Math.max(8, Math.min(innerWidth - w - 8, r.left + scrollX - 10)) + 'px';
    const below = r.bottom + pop.offsetHeight + 12 < innerHeight;
    pop.style.top = (below ? r.bottom + scrollY + 8 : r.top + scrollY - pop.offsetHeight - 8) + 'px';
  };
  document.addEventListener('click', (e) => { const b = e.target.closest?.('.help'); if (b) { e.preventDefault(); if (owner === b && pinned) close(); else { if (owner !== b) open(b); pinned = true; } } else if (!e.target.closest?.('.helppop')) close(); });
  document.addEventListener('mouseover', (e) => { const b = e.target.closest?.('.help'); if (b && owner !== b) open(b); });
  document.addEventListener('mouseout', (e) => { const b = e.target.closest?.('.help'); if (b && !pinned && !e.relatedTarget?.closest?.('.helppop')) close(); });
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape') close(); });
  addEventListener('hashchange', close);
})();
