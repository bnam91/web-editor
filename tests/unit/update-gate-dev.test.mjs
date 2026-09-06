/* U-D-dev — ★자동 업데이트 게이트: «개발 체크아웃»에서는 안 돈다 (별건 D)
 *
 * 옛 게이트: if (!process.argv.includes('--enable-logging')) setupAutoUpdater();
 *   ⇒ 「로그를 켰나」로 「개발인가」를 판정했다. 배포본에 그 플래그가 붙으면 자동 업데이트가
 *     «조용히» 죽는다(윈도우 실기 QA 2차 별건 D). 반대로 `npm start`(플래그 없음)는
 *     개발 체크아웃인데도 게이트를 통과했다.
 * 새 게이트: app.isPackaged — 「asar 로 포장됐나」. main.js:68 이 이미 말한 정본.
 *
 * ★이 파일은 «개발»(isPackaged=false) 쪽을 잰다. 포장 쪽은 update-gate-packaged.test.mjs.
 *   (main.js 는 프로세스당 한 번만 적재된다 — isPackaged 가 다르면 «파일»을 나눠야 한다.)
 * ★소스 정규식이 아니다: 진짜 main.js 의 진짜 setupAutoUpdater 를 부르고,
 *   electron-updater 스텁에 «무장 흔적»이 남았는지 센다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { loadMain } = require('./_ipc-harness.js');

const H = loadMain();                       // isPackaged 기본값 = false (개발 체크아웃)
const M = require(new URL('../../main.js', import.meta.url).pathname);

test('U-D1 개발 체크아웃(isPackaged=false)에서는 updater 가 «무장되지 않는다»', () => {
  assert.equal(M._autoUpdateEnabled(), false, '게이트가 개발에서 열려 있다');
  H.updater.__on.length = 0;
  const armed = M.setupAutoUpdater();
  assert.equal(armed, false, 'setupAutoUpdater 가 «켰다»고 답했다');
  assert.equal(H.updater.__on.length, 0, `⛔개발인데 updater 이벤트 ${H.updater.__on.length}건 등록됨`);
});

test('U-D2 ★`--enable-logging` 이 «있어도 없어도» 개발 판정은 안 바뀐다 (옛 게이트의 병)', () => {
  const orig = process.argv.slice();
  try {
    process.argv = [...orig, '--enable-logging'];
    assert.equal(M._autoUpdateEnabled(), false, '플래그가 판정을 바꿨다 — 아직 argv 를 보고 있다');
    process.argv = orig.filter((a) => a !== '--enable-logging');
    assert.equal(M._autoUpdateEnabled(), false, '플래그를 빼니 개발에서 updater 가 켜졌다(옛 게이트 그대로다)');
  } finally { process.argv = orig; }
});
