// Contrôles « robots IA refusés par le CDN » et « cohérence nom / adresse / téléphone ».
import assert from 'node:assert/strict';
import { startFixture } from './fixture.mjs';
import { runAudit } from '../lib/audit.mjs';
const opts = (srv) => ({ url: `http://127.0.0.1:${srv.address().port}/`, local: true, multilingual: false, city: 'Saint-Étienne', forceAiProbe: true, psi: false });
// 1. Un CDN qui refuse OAI-SearchBot et PerplexityBot alors que robots.txt les autorise
let srv = await startFixture(0, { blockAi: true });
let snap = await runAudit(opts(srv), () => {});
srv.close();
const c = snap.checks['geo.ai_crawlers_allowed'];
assert.equal(c.status, 'fail');
assert.match(c.evidence, /CDN ou le pare-feu : OAI-SearchBot, PerplexityBot/);
assert.doesNotMatch(c.evidence, /ChatGPT-User|Claude-SearchBot/);
// 2. Sans blocage : pas d'échec dû au CDN
srv = await startFixture(0);
snap = await runAudit(opts(srv), () => {});
srv.close();
assert.doesNotMatch(snap.checks['geo.ai_crawlers_allowed'].evidence || '', /CDN ou le pare-feu/);
assert.match(snap.checks['geo.ai_crawlers_allowed'].evidence, /aucun refus du CDN/);
// 3. NAP : nom, adresse et téléphone cohérents entre la page et le balisage
const nap = snap.checks['local.nap_consistent'];
assert.equal(nap.status, 'pass');
assert.match(nap.evidence, /numéro, nom et adresse cohérents/);
console.log('cdn.test OK');
