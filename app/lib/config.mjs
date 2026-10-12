// Réglages locaux (clés d'API facultatives). Stockés uniquement dans app/config.json sur ce PC.
import { readFileSync, writeFileSync, renameSync, chmodSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const FILE = process.env.SEOLAB_CONFIG || join(here, '..', 'config.json');
const DEFAULTS = { brave_key: '', gemini_key: '', gemini_model: 'gemini-2.5-flash' };
export function readConfig() { try { return { ...DEFAULTS, ...JSON.parse(readFileSync(FILE, 'utf8')) }; } catch { return { ...DEFAULTS }; } }
export function saveConfig(patch) {
  const cur = readConfig();
  for (const k of Object.keys(DEFAULTS)) if (typeof patch[k] === 'string') cur[k] = patch[k].trim().slice(0, 200);
  const tmp = FILE + '.tmp';
  writeFileSync(tmp, JSON.stringify(cur, null, 2), { encoding: 'utf8', mode: 0o600 });
  renameSync(tmp, FILE);
  try { chmodSync(FILE, 0o600); } catch {}
  return cur;
}
// Ce que le navigateur a le droit de voir : jamais les clés elles-mêmes.
export const publicConfig = () => { const c = readConfig(); return { brave: !!c.brave_key, gemini: !!c.gemini_key, gemini_model: c.gemini_model }; };
