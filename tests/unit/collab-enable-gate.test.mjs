/* collab-enable-gate — ★협업 킬스위치(COLLAB_ENABLED)를 «켤 수 있는 조건»을 자로 잠근다.
 *
 * ★왜 있나 (2026-10-06, 지디 발주 TWO ⒝ 판정 ②)
 *   ⒝ 에서 새로 생긴 reason(resync_required · start_failed · meta_unreadable …)은 js/collab/reasons.js 에
 *   «문장 없이»(null) 들어 있다 — 사용자가 읽는 새 문장은 현빈 검수 대상이라 지어 박지 않았다.
 *   문장이 없으면 화면에 reason «원문»(코드)이 뜬다. 스위치가 꺼져 있는 «지금»은 사용자에게 나가는 것이 0 이지만
 *   «켜는 날» 코드가 그대로 나간다 ⇒ 「문장 없는 갈래가 하나라도 있으면 켤 수 없다」.
 *   지금(false)은 통과하고, 켜는 순간 빨갛다. 켜는 조건을 «부르는 이름»으로 둔 자리다.
 * ⛔이 검사는 스위치 «값»을 고정하지 않는다 — 켜는 것은 현빈 게이트다. 켜려면 G1 이 아니라 reasons.js 의 null 을 먼저 채워라.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

function load() {
  const ctx = { console }; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, 'js/feature-flags.js'), ctx, { filename: 'js/feature-flags.js' });
  vm.runInContext(readSrc(REPO, 'js/collab/reasons.js'), ctx, { filename: 'js/collab/reasons.js' });
  return ctx;
}

test('G0 — 전제: 스위치 값을 «실제로» 읽었다(불리언) · 공용 표가 실렸다', () => {
  const w = load();
  assert.equal(typeof w.COLLAB_ENABLED, 'boolean', 'feature-flags.js 에서 COLLAB_ENABLED 를 못 읽었다 — 이 검사가 헛돈다');
  assert.equal(typeof w.CollabReasons?.missing, 'function', 'reasons.js 의 missing() 이 없다');
});

test('G1 — COLLAB_ENABLED 가 true 면 reasons 표의 «모든» 갈래에 문장이 있어야 한다', () => {
  const w = load();
  if (w.COLLAB_ENABLED !== true) return;   // 꺼져 있으면 조건이 걸리지 않는다(지금 상태)
  const miss = w.CollabReasons.missing();
  assert.deepEqual(miss, [], `★문장 없는 갈래가 있는데 협업이 켜져 있다: ${miss.join(', ')} — 사용자 화면에 코드가 그대로 뜬다. 현빈 검수 문장을 js/collab/reasons.js 에 채운 뒤 켜라`);
});
