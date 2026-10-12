import { startFixture } from './fixture.mjs';
import { runAudit } from '../lib/audit.mjs';
import { score, checkList } from '../lib/engine.mjs';
const srv = await startFixture();
const url = `http://127.0.0.1:${srv.address().port}/`;
const snap = await runAudit({ url, local: true, multilingual: false, city: 'Saint-Étienne' }, (m, p) => {});
for (const [id, v] of Object.entries(snap.checks)) console.log(v.status.padEnd(10), id.padEnd(28), (v.evidence || '').slice(0, 110));
const s = score(snap); console.log('SCORE', s.global, 'couverture', s.coverage + '%', JSON.stringify(snap.extra.notes));
srv.close();
