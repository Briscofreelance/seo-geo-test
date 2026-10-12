// Fausses versions des moteurs et des IA (même structure de page que les vrais) pour tester le pilotage du navigateur.
import http from 'node:http';
export function startMocks(siteHost) {
  const page = (body, script = '') => `<!doctype html><html lang="fr"><body>${body}<script>${script}</script></body></html>`;
  const answer = (id) => `<div id="${id}"></div>`;
  const srv = http.createServer((req, res) => {
    const u = new URL(req.url, 'http://x'); const p = u.pathname; const send = (h, c = 200) => { res.writeHead(c, { 'content-type': 'text/html; charset=utf-8' }); res.end(h); };
    const ownAt = (n) => (i) => (i === n ? `https://${siteHost}/page` : `https://autre${i}.fr/x`);
    if (p === '/brave/search') { const own = ownAt(4); return send(page(`<div id="results">${Array.from({ length: 20 }, (_, i) => `<div class="snippet"><a href="${own(i + 1)}">r${i}</a></div>`).join('')}</div>`)); }
    if (p === '/bing/search') { const first = +(u.searchParams.get('first') || 1); return send(page(`<ol id="b_results">${Array.from({ length: 10 }, (_, i) => { const n = first + i; const h = n === 13 ? `https://${siteHost}/p` : `https://site${n}.fr/`; return `<li class="b_algo"><h2><a href="${h}">t${n}</a></h2></li>`; }).join('')}</ol>`)); }
    if (p === '/perplexity/search') return send(page(`<main id="m">${'x'.repeat(60)}</main>`, `setTimeout(()=>{document.getElementById('m').innerHTML='Voici des prestataires : <a href="https://ekypia.fr">Ekypia</a> et <a href="https://${siteHost}/">${siteHost}</a> sont cités. '+'y'.repeat(200)},400)`));
    if (p === '/chatgpt/') return send(page(`<textarea id="prompt-textarea"></textarea><div id="out"></div>`, `document.getElementById('prompt-textarea').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setTimeout(()=>{document.getElementById('out').innerHTML='<div data-message-author-role="assistant">Je recommande <a href="https://ekypia.fr">Ekypia</a> et Art-Oria. '+'z'.repeat(200)+'</div>'},500)}})`));
    if (p === '/gemini/app') return send(page(`<rich-textarea><div contenteditable="true" id="e"></div></rich-textarea><div id="out"></div>`, `document.getElementById('e').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setTimeout(()=>{document.getElementById('out').innerHTML='<message-content>Options : Ekypia, Webqam. www.ekypia.fr '+'w'.repeat(200)+'</message-content>'},500)}})`));
    if (p === '/copilot/') return send(page(`<main id="m"><span id="m365-chat-editor-target-element" contenteditable="true"></span></main>`, `document.getElementById('m365-chat-editor-target-element').addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();setTimeout(()=>{const d=document.createElement('div');d.innerHTML='Réponse : <a href="https://corne-bleue.com">Corne Bleue</a> '+'v'.repeat(200);document.getElementById('m').appendChild(d)},500)}})`));
    if (p === '/captcha/search') return send(page('<h1>Vérifiez que vous êtes un humain (captcha)</h1>'));
    send('<h1>404</h1>', 404);
  });
  return new Promise((r) => srv.listen(0, '127.0.0.1', () => r(srv)));
}
