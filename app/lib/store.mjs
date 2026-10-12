// Lecture/écriture des rapports dans ../reports/<site>/<date>/. Écritures atomiques.
import { readFileSync, writeFileSync, renameSync, mkdirSync, readdirSync, existsSync, statSync } from 'node:fs';
import { join, dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
export const ROOT = resolve(process.env.SEOLAB_REPORTS || join(here, '..', '..', 'reports'));
export const SLUG_RE = /^[a-z0-9][a-z0-9-]{0,80}$/;
export const AUDIT_RE = /^\d{4}-\d{2}-\d{2}(-\d{1,2})?$/;

const readJson = (p, fb = null) => { try { return JSON.parse(readFileSync(p, 'utf8')); } catch { return fb; } };
function writeJson(p, data) {
  mkdirSync(dirname(p), { recursive: true });
  const tmp = p + '.tmp-' + process.pid;
  writeFileSync(tmp, JSON.stringify(data, null, 2) + '\n', 'utf8');
  renameSync(tmp, p);
}
const siteDir = (slug) => { if (!SLUG_RE.test(slug)) throw new Error('Nom de site invalide'); return join(ROOT, slug); };
const auditDir = (slug, id) => { if (!AUDIT_RE.test(id)) throw new Error('Identifiant d\'audit invalide'); return join(siteDir(slug), id); };

export function listAuditIds(slug) {
  const d = siteDir(slug);
  if (!existsSync(d)) return [];
  return readdirSync(d).filter((n) => AUDIT_RE.test(n) && statSync(join(d, n)).isDirectory()).sort();
}
export function readSnapshot(slug, id) {
  const s = readJson(join(auditDir(slug, id), 'snapshot.json'));
  if (s) s.id = id;
  return s;
}
export function allSnapshots(slug) { return listAuditIds(slug).map((id) => readSnapshot(slug, id)).filter(Boolean); }

export function listSites() {
  if (!existsSync(ROOT)) return [];
  const out = [];
  for (const slug of readdirSync(ROOT).filter((n) => SLUG_RE.test(n) && statSync(join(ROOT, n)).isDirectory())) {
    const ids = listAuditIds(slug);
    const snaps = ids.map((id) => ({ id, snap: readSnapshot(slug, id) }));
    const withSnap = snaps.filter((x) => x.snap);
    out.push({
      slug, audits: withSnap.map((x) => ({ id: x.id, date: x.snap.date })),
      legacyFolders: snaps.length - withSnap.length, // anciens dossiers sans snapshot.json
      last: withSnap.length ? withSnap[withSnap.length - 1].snap : null,
      url: withSnap.length ? withSnap[withSnap.length - 1].snap.url : readJson(join(siteDir(slug), 'site.json'), {})?.url || null,
    });
  }
  return out;
}

export function nextAuditId(slug, date) {
  const ids = new Set(listAuditIds(slug));
  if (!ids.has(date)) return date;
  for (let i = 2; i < 100; i++) if (!ids.has(`${date}-${i}`)) return `${date}-${i}`;
  throw new Error('Trop d\'audits le même jour');
}
export function saveSnapshot(slug, snap) {
  const id = nextAuditId(slug, snap.date);
  writeJson(join(auditDir(slug, id), 'snapshot.json'), snap);
  writeJson(join(siteDir(slug), 'site.json'), { url: snap.url, profile: snap.profile, updated: new Date().toISOString() });
  return id;
}
export function updateSnapshot(slug, id, fn) {
  const snap = readSnapshot(slug, id);
  if (!snap) throw new Error('Audit introuvable');
  delete snap.id;
  const out = fn(snap) || snap;
  writeJson(join(auditDir(slug, id), 'snapshot.json'), out);
  return readSnapshot(slug, id);
}

// Requêtes / prompts figés (on ajoute, on ne modifie ni ne supprime)
export function readFrozen(slug, name) { return readJson(join(siteDir(slug), name + '.json'), { items: [] }); }
export function addFrozen(slug, name, item) {
  const cur = readFrozen(slug, name);
  const prefix = name === 'queries' ? (item.kind === 'voice' ? 'v' : 'q') : 'p';
  const n = cur.items.filter((x) => x.id.startsWith(prefix)).length + 1;
  const full = { id: `${prefix}${n}`, ...item, added: new Date().toISOString().slice(0, 10) };
  cur.items.push(full);
  writeJson(join(siteDir(slug), name + '.json'), cur);
  return full;
}

// Décisions sur les actions : { [checkId]: { status: validated|refused|waiting|done, note, date } }
export function readDecisions(slug) { return readJson(join(siteDir(slug), 'decisions.json'), {}); }
export function setDecision(slug, checkId, status, note = '') {
  if (!/^[a-z0-9]+\.[a-z0-9_]+$/.test(checkId)) throw new Error('Identifiant de contrôle invalide');
  if (!['validated', 'refused', 'waiting', 'done', 'none'].includes(status)) throw new Error('Statut invalide');
  const cur = readDecisions(slug);
  if (status === 'none') delete cur[checkId]; else cur[checkId] = { status, note: String(note).slice(0, 500), date: new Date().toISOString().slice(0, 10) };
  writeJson(join(siteDir(slug), 'decisions.json'), cur);
  return cur;
}
// Conseils « hors site » : { [tipId]: { status: done|later|na, date } } (par site, hors score)
export function readTips(slug) { return readJson(join(siteDir(slug), 'tips.json'), {}); }
export function setTip(slug, id, status) {
  if (!/^[a-z0-9_]{2,40}$/.test(id)) throw new Error('Identifiant de conseil invalide');
  if (!['done', 'later', 'na', 'none'].includes(status)) throw new Error('Statut invalide');
  const cur = readTips(slug);
  if (status === 'none') delete cur[id]; else cur[id] = { status, date: new Date().toISOString().slice(0, 10) };
  writeJson(join(siteDir(slug), 'tips.json'), cur);
  return cur;
}
export const deleteAudit = null; // volontairement absent : l'application ne supprime jamais de rapport

// Suppression = déplacement dans reports/_corbeille (récupérable à la main), jamais d'effacement définitif.
function toTrash(src, slug, id) {
  const dest = join(ROOT, '_corbeille', slug, id + '-' + Date.now());
  mkdirSync(dirname(dest), { recursive: true });
  renameSync(src, dest);
}
export function trashAudit(slug, id) {
  const d = auditDir(slug, id);
  if (!existsSync(d)) throw new Error('Audit introuvable');
  toTrash(d, slug, id);
}
export function trashSite(slug) {
  const d = siteDir(slug);
  if (!existsSync(d)) throw new Error('Site introuvable');
  toTrash(d, slug, 'site');
}
