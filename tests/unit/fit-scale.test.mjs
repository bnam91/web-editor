/* 단위 하네스 — js/fit-scale.js (「내용을 뷰포트 안에 넣는 배율」 공식 SSOT)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는다.
 *
 * ★손으로 쓴 모델이 아니라 «실제 소스 파일»을 import 한다(frame-geometry.test.mjs 관례).
 *   렌더러 파일은 ESM .js 인데 package type=commonjs라 Node가 직접 import 못한다
 *   → 바이트 그대로 .mjs 별칭으로 복사해 import.
 *
 * ★재는 것 둘
 *   ⑴ 공식이 맞다 — 두 축 중 «작은 쪽», 즉 그 배율에서 두 축 다 상자 안에 든다(독립 유도로 검산)
 *   ⑵ 사본이 다시 늘지 않았다 — 세 호출부가 «이 함수를» 부른다. 특히 zoomFit 이
 *      다시 «가로 하나»로 돌아가지 않았다(2026-09-20 훑기에서 실제로 났던 병).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const srcPath = path.join(ROOT, 'js/fit-scale.js');
const aliasPath = path.join(os.tmpdir(), `fitscale-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const { fitScale } = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

test('FS1 어느 축이 병목이든 «두 축 다» 상자 안에 든다 (독립 유도로 검산)', () => {
  const 사례 = [
    { W: 860, H: 2080, vw: 720, vh: 520 },   // 세로 병목 — 이 앱의 정상 모양(긴 랜딩페이지)
    { W: 860, H: 120,  vw: 320, vh: 820 },   // 가로 병목 — 좁은 창
    { W: 860, H: 860,  vw: 430, vh: 430 },   // 정사각 — 두 축 동시
    { W: 280, H: 400,  vw: 280, vh: 200 },   // 템플릿 미리보기 실제 치수대
  ];
  for (const { W, H, vw, vh } of 사례) {
    const s = fitScale(W, H, vw, vh);
    const 여유 = 1e-9;
    assert.ok(W * s <= vw + 여유, `가로가 넘쳤다: ${W}×${s} > ${vw}`);
    assert.ok(H * s <= vh + 여유, `세로가 넘쳤다: ${H}×${s} > ${vh}`);
    // «필요 이상으로 줄이지도» 않는다 — 한 축은 반드시 딱 맞는다.
    assert.ok(Math.abs(W * s - vw) < 여유 || Math.abs(H * s - vh) < 여유,
      `두 축 다 남았다 — 과하게 줄였다 (${W}×${H} → ${s})`);
    assert.equal(s, Math.min(vw / W, vh / H));
  }
});

test('FS2 높이 0 은 Infinity 로 흘러 «가로 기준»이 된다 (기존 두 호출부가 기대던 동작)', () => {
  assert.equal(fitScale(860, 0, 720, 520), 720 / 860);
  assert.ok(Number.isFinite(fitScale(860, 0, 720, 520)));
});

test('FS3 ★사본이 다시 늘지 않았다 — 호출부가 이 함수를 «부른다»', () => {
  for (const f of ['js/editor.js', 'js/panels/template-system.js']) {
    const src = read(f);
    assert.match(src, /from '\.\.?\/(\.\.\/)?fit-scale\.js'/, `${f} import 누락`);
    assert.match(src, /fitScale\(/, `${f} 가 fitScale 을 안 부른다 — 사본을 다시 떴을 수 있다`);
  }
  /* ★template-browser.js 는 «일부러» import 를 안 쓴다 — tpl-popout-geometry.test.mjs G4-c 가
     그 파일 소스 «전체»를 new Function 으로 돌리기 때문에 import 한 줄이면 그 검사가 죽는다.
     대신 ⑴ 두 축을 다 본다 ⑵ 정본이 어디인지 글로 가리킨다 — 이 둘을 여기서 못박는다.
     ⛔이 예외를 늘리지 마라. 늘리려면 먼저 G4-c 를 「import 를 걷어내고 돌리는」 하네스로 고쳐라. */
  const tb = read('js/panels/template-browser.js');
  assert.match(tb, /Math\.min\(vw \/ CANVAS_W, vh \/ sh\)/,
    '★template-browser 가 두 축의 min 을 그만뒀다');
  assert.match(tb, /fit-scale\.js/,
    '★정본을 가리키는 표지가 사라졌다 — 다음 사람이 이게 사본인 줄 모른다');
  assert.doesNotMatch(tb, /^import /m,
    '★template-browser 에 import 가 생겼다 — tpl-popout-geometry G4-c 가 죽는다');
});

test('FS4 ★zoomFit 이 «세로»를 본다 — 가로 하나로 되돌아가지 않았다', () => {
  const src = read('js/editor.js');
  const m = /function zoomFit\(\)[\s\S]*?\n\}/.exec(src);
  assert.ok(m, 'zoomFit 을 못 찾았다 — 아래는 아무것도 안 잰다');
  const body = m[0];
  assert.match(body, /clientHeight/,
    '★zoomFit 이 clientHeight 를 안 본다 = 「폭 맞춤」으로 회귀했다. 세로로 긴 페이지에서 Fit 이 «확대»된다');
  assert.match(body, /scrollHeight/,
    '★콘텐츠 자연높이를 안 잰다 — 무엇에 맞추는지가 사라졌다');
  assert.match(body, /fitScale\(/, '★공식 SSOT 를 안 쓴다 — 네 번째 사본이다');
});
