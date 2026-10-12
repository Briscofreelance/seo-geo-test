// Graphiques SVG sans dépendance. Tout texte provenant des données passe par esc().
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const C = { teal: 'var(--teal)', amber: 'var(--amber)', indigo: 'var(--indigo)', rose: 'var(--rose)', ink: 'var(--ink)', line: 'var(--line)', muted: 'var(--muted)' };

// Couleur selon le niveau : rouge < 40, orange < 70, vert ensuite
const lvl = (v) => (v == null ? 'var(--muted)' : v < 40 ? 'var(--crit)' : v < 70 ? 'var(--imp)' : 'var(--pass)');
// Jauge en anneau : valeur 0-100 ou null (non mesuré)
function gauge(value, { size = 150, color } = {}) {
  const r = 56, c = 2 * Math.PI * r, v = value == null ? 0 : Math.max(0, Math.min(100, value)), col = color || lvl(value);
  return `<svg viewBox="0 0 140 140" width="${size}" role="img" aria-label="${value == null ? 'non mesuré' : value + ' sur 100'}">
    <circle cx="70" cy="70" r="${r}" fill="none" stroke="var(--line)" stroke-width="13"/>
    ${value == null ? '' : `<circle cx="70" cy="70" r="${r}" fill="none" stroke="${col}" stroke-width="13" stroke-linecap="round" stroke-dasharray="${(c * v) / 100} ${c}" transform="rotate(-90 70 70)"/>`}
    <text x="70" y="${value == null ? 76 : 78}" text-anchor="middle" font-family="var(--serif)" font-size="${value == null ? 22 : 40}" font-weight="800" fill="${value == null ? 'var(--muted)' : col}">${value == null ? 'n/m' : value}</text>
    <text x="70" y="98" text-anchor="middle" font-size="11.5" fill="var(--muted)">${value == null ? 'non mesuré' : 'sur 100'}</text></svg>`;
}

// Barres horizontales de domaines : { label, score, max, before? }
function domainBars(rows) {
  const W = 900, rowH = 34, lw = 300, bw = W - lw - 80;
  const body = rows.map((d, i) => {
    const y = i * rowH + 4;
    const w = d.score == null ? 0 : (d.score / d.max) * bw;
    const wb = d.before == null ? null : (d.before / d.max) * bw;
    return `<g transform="translate(0,${y})" data-tip="${esc(d.label)} : ${d.score == null ? 'non mesuré' : d.score + ' / ' + d.max}${d.before != null ? ' (avant : ' + d.before + ')' : ''}">
      <text x="0" y="17" font-size="15" fill="currentColor">${esc(d.label)}</text>
      <rect x="${lw}" y="6" width="${bw}" height="12" rx="3" fill="${C.line}" opacity=".6"/>
      ${wb != null ? `<line x1="${lw + wb}" x2="${lw + wb}" y1="2" y2="22" stroke="var(--ink)" stroke-width="2.5"/>` : ''}
      ${d.score == null ? '' : `<path d="M${lw} 6h${Math.max(0, w - 4)}a4 4 0 0 1 4 4v4a4 4 0 0 1-4 4h-${Math.max(0, w - 4)}z" fill="${lvl(d.score == null ? null : (d.score / d.max) * 100)}"/>`}
      <text x="${lw + bw + 8}" y="17" font-size="15" fill="currentColor" font-variant-numeric="tabular-nums">${d.score == null ? 'n/m' : d.score + '/' + d.max}</text></g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${rows.length * rowH + 8}" width="100%" role="img" aria-label="Scores par domaine">${body}</svg>`;
}

// Bandeau de position 1..top. rows : { label, sub, after, before?, top }
function rankStrips(rows) {
  const W = 900, lw = 310, bw = W - lw - 150, rowH = 40;
  const pos = (p, top) => lw + ((Math.min(p, top) - 1) / Math.max(1, top - 1)) * bw;
  const body = rows.map((r, i) => {
    const y = i * rowH;
    const top = r.top || 30;
    const x0 = lw, x1 = lw + bw;
    const out = (v) => v == null;
    const dot = (v, hollow) => out(v)
      ? `<g><path d="M${x1 + 14} 14l10 10M${x1 + 24} 14l-10 10" stroke="${C.muted}" stroke-width="2" stroke-linecap="round"/></g>`
      : `<circle cx="${pos(v, top)}" cy="19" r="7" fill="${hollow ? 'var(--surface)' : C.teal}" stroke="${hollow ? C.muted : 'var(--surface)'}" stroke-width="2"/>`;
    const link = r.before !== undefined && !out(r.before) && !out(r.after) ? `<line x1="${pos(r.before, top)}" x2="${pos(r.after, top)}" y1="19" y2="19" stroke="${C.teal}" stroke-width="2.5" opacity=".6"/>` : '';
    const txt = out(r.after) ? `hors top ${top}` : `${r.after}e`;
    const tip = `${r.label}${r.sub ? ' (' + r.sub + ')' : ''} : ${out(r.after) ? 'hors top ' + top : 'position ' + r.after}${r.before !== undefined ? ' — avant : ' + (out(r.before) ? 'hors top ' + top : r.before) : ''}`;
    return `<g transform="translate(0,${y})" data-tip="${esc(tip)}">
      <text x="0" y="17" font-size="15" fill="currentColor">${esc(r.label)}</text>${r.sub ? `<text x="0" y="31" font-size="13" fill="${C.muted}">${esc(r.sub.length > 42 ? r.sub.slice(0, 41) + '…' : r.sub)}</text>` : ''}
      <line x1="${x0}" x2="${x1}" y1="19" y2="19" stroke="${C.line}" stroke-width="3" stroke-linecap="round"/>
      <line x1="${x0}" x2="${x0}" y1="13" y2="25" stroke="${C.line}" stroke-width="2"/><line x1="${x1}" x2="${x1}" y1="13" y2="25" stroke="${C.line}" stroke-width="2"/>
      ${link}${r.before !== undefined ? dot(r.before, true) : ''}${dot(r.after, false)}
      <text x="${W}" y="23" text-anchor="end" font-size="15" font-weight="600" fill="currentColor">${esc(txt)}</text></g>`;
  }).join('');
  const scale = `<g transform="translate(0,${rows.length * rowH})"><text x="${lw}" y="14" font-size="13" fill="${C.muted}">1re place</text><text x="${lw + bw}" y="14" text-anchor="end" font-size="13" fill="${C.muted}">dernière place testée</text></g>`;
  return `<svg viewBox="0 0 ${W} ${rows.length * rowH + 22}" width="100%" role="img" aria-label="Positions dans les moteurs">${body}${scale}</svg>`;
}

// Barres IA : mention et citation en %. rows : { label, n, mention, cite, small }
function aiBars(rows) {
  const W = 900, lw = 200, bw = W - lw - 80, rowH = 50;
  const body = rows.map((r, i) => {
    const y = i * rowH + 2;
    const bar = (v, yy, col) => `<rect x="${lw}" y="${yy}" width="${bw}" height="11" rx="3" fill="${C.line}" opacity=".6"/>${v > 0 ? `<path d="M${lw} ${yy}h${Math.max(0, (v / 100) * bw - 4)}a4 4 0 0 1 4 4v3a4 4 0 0 1-4 4h-${Math.max(0, (v / 100) * bw - 4)}z" fill="${col}"/>` : ''}<text x="${lw + bw + 8}" y="${yy + 10}" font-size="14" fill="currentColor">${v}%</text>`;
    return `<g transform="translate(0,${y})" data-tip="${esc(`${r.label} : mentionné ${r.mention}%, cité ${r.cite}% sur ${r.n} réponse(s)${r.small ? ' — échantillon trop petit' : ''}`)}">
      <text x="0" y="14" font-size="15" fill="currentColor">${esc(r.label)}</text><text x="0" y="31" font-size="13" fill="${r.small ? 'var(--warn)' : C.muted}">${r.n} réponse(s)${r.small ? ' · peu fiable' : ''}</text>
      ${bar(r.mention, 4, C.teal)}${bar(r.cite, 22, C.indigo)}</g>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${rows.length * rowH + 4}" width="100%" role="img" aria-label="Visibilité dans les IA">${body}</svg>
  <div class="legend"><span><i style="background:var(--teal)"></i>mentionné dans la réponse</span><span><i style="background:var(--indigo)"></i>site cité comme source</span></div>`;
}

// Courbe d'évolution. series : [{name, color, values[]}] , dates[]
function lineChart(dates, series) {
  const W = 900, H = 240, L = 34, R = 110, T = 12, B = 30;
  const n = dates.length, X = (i) => (n === 1 ? L + (W - L - R) / 2 : L + (i / (n - 1)) * (W - L - R)), Y = (v) => T + (1 - v / 100) * (H - T - B);
  const grid = [0, 25, 50, 75, 100].map((g) => `<line x1="${L}" x2="${W - R}" y1="${Y(g)}" y2="${Y(g)}" stroke="${C.line}" stroke-width="1"/><text x="${L - 6}" y="${Y(g) + 4}" text-anchor="end" font-size="12.5" fill="${C.muted}">${g}</text>`).join('');
  const xl = dates.map((d, i) => (n <= 6 || i % Math.ceil(n / 6) === 0 || i === n - 1) ? `<text x="${X(i)}" y="${H - 8}" text-anchor="middle" font-size="12.5" fill="${C.muted}">${esc(d.slice(5))}</text>` : '').join('');
  const ends = series.map((s) => { const pts = s.values.map((v, i) => (v == null ? null : [X(i), Y(v), v, i])).filter(Boolean); return { s, pts, last: pts[pts.length - 1] }; }).filter((e) => e.pts.length);
  const ys = ends.map((e) => ({ e, y: e.last[1] + 5 })).sort((a, b) => a.y - b.y);
  for (let i = 1; i < ys.length; i++) if (ys[i].y - ys[i - 1].y < 17) ys[i].y = ys[i - 1].y + 17;
  const lines = ends.map(({ s, pts, last }) => {
    const path = pts.length > 1 ? `<polyline fill="none" stroke="${s.color}" stroke-width="2.5" stroke-linejoin="round" points="${pts.map((p) => p[0] + ',' + p[1]).join(' ')}"/>` : '';
    const dots = pts.map((p) => `<circle cx="${p[0]}" cy="${p[1]}" r="5" fill="${s.color}" stroke="var(--surface)" stroke-width="2" data-tip="${esc(s.name + ' · ' + dates[p[3]] + ' : ' + p[2])}"/>`).join('');
    const ly = ys.find((q) => q.e.s === s).y;
    return `${path}${dots}<text x="${last[0] + 12}" y="${ly}" font-size="14" font-weight="600" fill="currentColor">${esc(s.name)} ${last[2]}</text>`;
  }).join('');
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Évolution des scores">${grid}${xl}${lines}</svg>`;
}

// Info-bulle commune
(() => {
  let tip;
  document.addEventListener('mouseover', (e) => {
    const t = e.target.closest?.('[data-tip]');
    if (!t) { tip?.remove(); tip = null; return; }
    if (!tip) { tip = document.createElement('div'); tip.className = 'tip'; document.body.appendChild(tip); }
    tip.textContent = t.getAttribute('data-tip');
    const mv = (ev) => { tip.style.left = Math.min(ev.clientX + 14, innerWidth - 280) + 'px'; tip.style.top = ev.clientY + 16 + 'px'; };
    mv(e); t.onmousemove = mv;
  });
})();
