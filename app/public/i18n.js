// Traduction de l'interface (FR -> EN) au moment de l'affichage. Les rapports enregistrés restent en français.
(() => {
  const lang = (() => { try { return localStorage.getItem('lang') || ((navigator.language || 'fr').toLowerCase().startsWith('fr') ? 'fr' : 'en'); } catch { return 'fr'; } })();
  const EXACT = new Map(Object.entries(window.EN_EXACT || {}));
  const RULES = window.EN_RULES || [];
  const cache = new Map();
  function trUI(s) {
    if (typeof s !== 'string' || !s) return s;
    const hit = EXACT.get(s); if (hit !== undefined) return hit;
    if (cache.has(s)) return cache.get(s);
    let out = s;
    for (const [re, rep] of RULES) out = out.replace(re, rep);
    cache.set(s, out); return out;
  }
  window.trUI = trUI;
  const ATTRS = ['placeholder', 'title', 'aria-label', 'data-tip', 'alt'];
  const SKIP = new Set(['SCRIPT', 'STYLE', 'TEXTAREA', 'CODE']);
  function tr(root) {
    if (lang !== 'en' || !root) return;
    const w = document.createTreeWalker(root, NodeFilter.SHOW_TEXT | NodeFilter.SHOW_ELEMENT);
    for (let n = w.currentNode; n; n = w.nextNode()) {
      if (n.nodeType === 3) {
        if (SKIP.has(n.parentNode?.nodeName)) continue;
        const v = n.nodeValue, m = v.match(/^(\s*)([\s\S]*?)(\s*)$/); if (!m[2]) continue;
        const o = trUI(m[2]); if (o !== m[2]) n.nodeValue = m[1] + o + m[3];
      } else if (n.nodeType === 1) {
        for (const a of ATTRS) if (n.hasAttribute?.(a)) { const v = n.getAttribute(a), o = trUI(v); if (o !== v) n.setAttribute(a, o); }
      }
    }
  }
  window.translateDom = tr;
  if (lang === 'en') {
    document.title = trUI(document.title);
    const mo = new MutationObserver((list) => {
      mo.disconnect();
      for (const m of list) m.addedNodes.forEach((x) => { if (x.nodeType === 1 || x.nodeType === 3) tr(x.nodeType === 3 ? x.parentNode : x); });
      mo.observe(document.body, { childList: true, subtree: true });
    });
    const start = () => { tr(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
    if (document.body) start(); else addEventListener('DOMContentLoaded', start);
  }
})();
