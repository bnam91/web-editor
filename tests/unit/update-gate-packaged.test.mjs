/* U-D-pkg — ★자동 업데이트 게이트: «배포본»에서는 --enable-logging 이 붙어도 돈다 (별건 D)
 *
 * 이게 결함의 핵심이다. 옛 게이트에서는 배포본 + `--enable-logging` = 자동 업데이트 «조용히 꺼짐».
 * ⇒ 사용자는 영영 새 버전을 못 받는데 화면에는 아무 말도 없다.
 *   (0.5.0 자동업데이트 사망과 같은 병 — main.js whenReady 주석 참조.)
 *
 * ⚠️main.js 는 프로세스당 한 번만 적재된다 ⇒ isPackaged=true 는 «별도 파일»이어야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
const require = createRequire(import.meta.url);
const { loadMain } = require('./_ipc-harness.js');

const H = loadMain({ isPackaged: true });   // ★배포본
const M = require(fileURLToPath(new URL('../../main.js', import.meta.url)));

test('U-D3 ★배포본(isPackaged=true)에서 updater 가 실제로 무장된다', () => {
  assert.equal(M._autoUpdateEnabled(), true, '배포본인데 게이트가 닫혀 있다');
  H.updater.__on.length = 0;
  const armed = M.setupAutoUpdater();
  assert.equal(armed, true, 'setupAutoUpdater 가 «안 켰다»고 답했다');
  assert.ok(H.updater.__on.includes('update-downloaded'),
    `⛔재시작 다이얼로그 핸들러가 없다 — 등록된 것: ${H.updater.__on.join(',') || '(없음)'}`);
  assert.ok(H.updater.__on.includes('update-available'), '새 버전 감지 핸들러가 없다');
});

test('U-D4 ★★배포본 + `--enable-logging` 이어도 자동 업데이트는 «산다» (별건 D 그 자체)', () => {
  const orig = process.argv.slice();
  try {
    process.argv = [...orig, '--enable-logging'];
    assert.equal(M._autoUpdateEnabled(), true,
      '⛔로깅 플래그 하나로 배포본의 자동 업데이트가 죽었다 — 옛 게이트가 살아 있다');
    H.updater.__on.length = 0;
    assert.equal(M.setupAutoUpdater(), true, '⛔플래그가 붙자 updater 가 조용히 안 켜졌다');
    assert.ok(H.updater.__on.length > 0, '⛔무장 흔적이 0건이다');
  } finally { process.argv = orig; }
});
