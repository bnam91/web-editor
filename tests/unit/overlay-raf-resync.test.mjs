/* U-M66 — 「비포커스 창에서 rAF 가 멈춰 오버레이 핸들이 블록을 못 따라간다」
 *   실행: node --test "tests/unit/*.test.mjs"
 *
 * ★[M66] 미니4호기 윈도우 QA 보고. ⛔결론부터: **제품 코드는 «안 고쳤다».** 고칠 결함이 아니었다.
 *   이 파일은 «왜 안 고쳤는지»를 기계로 잠근다 — 다음 사람이 없는 병을 고치지 않도록,
 *   그리고 «안 고쳐도 되게 만드는 성질»이 조용히 깨지지 않도록.
 *
 * ── 맥 실측(2026-09-06, 포트 9373, anti-throttle 플래그 3개를 «빼고» 띄운 인스턴스) ──
 *   ⚠️함정: `--disable-renderer-backgrounding` 계열을 달고 띄우면 이 병은 «재현 자체가 안 된다».
 *   ⑴ 창이 «비포커스»이기만 하면 rAF 는 안 멈춘다 — visibility=visible·hasFocus=false 에서
 *      **49.2 Hz(FULL_RATE)**. ⇒ 보고서의 「창이 뒤로 가면」은 «비포커스»가 아니라 «hidden» 이다.
 *   ⑵ macOS 가 창을 가림(occluded)으로 판정해 visibility=hidden 이 되면
 *      **rAF = 0 Hz**(1500ms 동안 0틱, rAF 30틱 체인이 30초 안에 «안 끝났다»).
 *   ⑶ 그 상태에서 캔버스를 137px 스크롤 → 거터 오버레이 어긋남 = **정확히 137.00px**.
 *   ⑷ ★그런데 «프레임을 한 장만» 만들어 주면(Page.captureScreenshot, 포커스 무접촉)
 *      틱 0→10, 어긋남 **137.00 → 0.00**. 네 장을 더 만들어도 0.00.
 *   ⇒ 루프는 «죽은» 게 아니라 «멈춰 있었다». 그리고 어긋남은 «프레임이 안 나오는 동안»에만
 *     존재한다 — 즉 사용자가 볼 수 없는 동안에만 있고, 사용자가 볼 첫 프레임에서 이미 맞다.
 *     rAF 콜백은 paint «앞»에 돌기 때문이다. ⇒ 관찰 가능한 결함이 아니다.
 *
 * ── 보고서가 든 «증거»는 다른 병이었다 ──
 *   「applyZoom 직후 getBoundingClientRect() 가 옛 배율 값을 준다」는 스로틀링이 아니다.
 *   [실측] 창이 «보이고» rAF 가 49Hz 로 도는 상태에서도 그대로 난다:
 *     100%→25% 호출 직후 즉시 읽기 = 912.0(옛 값) · 30ms = 912.0 · 150ms = 232.5 · 안정 = 228.0
 *     (기대값 228.0, `#canvas-scaler` 의 `transition: transform .15s`)
 *   ⇒ 원인은 «CSS 트랜지션»이고, applyZoom·zoomStep 은 재기 전에 transition 을 끄는 규약을
 *     이미 갖고 있다(js/editor.js 의 `_prevTr` 자리). 여기서 고칠 것이 없다.
 *
 * ── 그래서 이 파일이 «잠그는 것» ──
 *   「멈췄다 다시 돌면 스스로 따라잡는다」를 성립시키는 성질 두 개다. 이게 깨지면 그때는
 *   진짜로 visibilitychange/focus 강제 재동기가 필요해진다.
 *     ① 루프는 매 틱 «무조건» 위치를 다시 계산한다(「안 바뀌었으면 건너뛴다」 최적화 금지).
 *     ② 루프는 «자기 콜백 안에서만» 끝난다 ⇒ 프레임이 안 나오는 동안엔 죽을 수 없다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';        // ★CRLF 체크아웃 방어(윈도우 core.autocrlf=true)
import { sliceBlock } from './_slice-block.js';   // ★구간 떠내기는 «공용 부품»(_slice-block.js) 하나로 — ⛔여기서 자를 새로 만들지 마라(끝은 «균형괄호»로 찾는다)

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = readSrc(ROOT, 'js/overlay-handles.js');

/** 끝은 «균형괄호»로 찾는다 — 0열 `}` 는 `};` 로 끝나는 구간을 못 맞춘다. */
const sliceFn = (head) => sliceBlock(SRC, head, '검사가 옛 소스를 보고 있다');
const START_SRC = sliceFn('function _startGridGutterRaf() {');

test('U-M66-0 ★하네스가 «루프가 부르는 것»을 다 싣는다 — 안 실으면 검사가 조용히 통과한다', () => {
  /* 잘라 넣은 루프가 부르는 최상위 식별자를 소스에서 뽑아, 아래 makeEnv 가 다 주입하는지 센다.
     ⛔목록을 손으로 맞추면 갈라진다(U-GLOGIN-0 과 같은 이유). */
  const called = new Set([...START_SRC.matchAll(/\b([_a-zA-Z][\w]*)\s*\(/g)].map(m => m[1]));
  for (const own of ['loop', 'if', 'requestAnimationFrame', '_startGridGutterRaf']) called.delete(own);
  const INJECTED = ['hideGridGutters', '_updateGridGutterPositions'];
  const missing = [...called].filter(n => !INJECTED.includes(n) && new RegExp(`function\\s+${n}\\s*\\(`).test(SRC));
  assert.deepEqual(missing, [], `루프가 부르는데 하네스가 «안 실은» 것: ${missing.join(', ')}`);
});

/** 프레임을 «내가» 준다 — 안 주면 rAF 는 영영 안 돈다(=hidden 상태 재현). */
function makeEnv() {
  const queue = [];
  let nextId = 1;
  const log = { updates: 0, hides: 0 };
  const model = { y: 0 };            // 「블록의 진짜 위치」
  const painted = { y: null };       // 「오버레이가 그린 위치」
  const env = {
    requestAnimationFrame(cb) { queue.push({ id: nextId, cb }); return nextId++; },
    _updateGridGutterPositions() { log.updates++; painted.y = model.y; },   // 매번 «현재» 값을 읽는다
    hideGridGutters() { log.hides++; env.block = null; },
    block: { isConnected: true, classList: { contains: () => true } },
  };
  const start = new Function('env', `
    let _gridGutterBlock = env.block, _gridGutterRafId = null;
    const requestAnimationFrame = env.requestAnimationFrame;
    const hideGridGutters = () => { env.hideGridGutters(); _gridGutterBlock = env.block; };
    const _updateGridGutterPositions = env._updateGridGutterPositions;
    ${START_SRC}
    return { start: _startGridGutterRaf, setBlock: b => { _gridGutterBlock = b; }, id: () => _gridGutterRafId };
  `)(env);
  /** 프레임 n 장을 «실제로» 서비스한다. */
  const serve = (n = 1) => { for (let k = 0; k < n; k++) { const j = queue.shift(); if (j) j.cb(); } };
  return { env, start, serve, queue, log, model, painted };
}

test('U-M66-1 프레임이 «안 나오는 동안» 오버레이는 멈춘다 — 실측(hidden 1500ms 동안 0틱)과 같은 모양', () => {
  const h = makeEnv();
  h.start.start();
  assert.equal(h.log.updates, 0, '아직 프레임을 안 줬는데 갱신이 돌았다');
  h.serve(1);                       // 첫 프레임
  assert.equal(h.log.updates, 1);
  assert.equal(h.painted.y, 0);

  // ★여기서부터 «창이 숨었다» — 프레임을 «한 장도» 안 준다
  h.model.y = 137;                  // 실측과 같은 137px 스크롤
  for (let k = 0; k < 100; k++) { /* 시간만 흐른다 */ }
  assert.equal(h.log.updates, 1, '프레임을 안 줬는데 갱신이 돌았다 — 계측 모형이 틀렸다');
  assert.equal(h.painted.y, 0, '오버레이가 옛 자리에 있어야 한다(실측: 어긋남 137.00px)');
  assert.equal(Math.abs(h.model.y - h.painted.y), 137, '어긋남이 실측 137px 와 달라졌다');
});

test('U-M66-2 ★프레임이 «한 장» 나오면 곧바로 따라잡는다 — 이게 재동기 코드를 «불필요»하게 만드는 성질', () => {
  const h = makeEnv();
  h.start.start();
  h.serve(1);
  h.model.y = 137;                  // 숨은 동안 레이아웃이 바뀌었다
  assert.equal(h.painted.y, 0);
  h.serve(1);                       // ★프레임 한 장(실측: captureScreenshot 한 번)
  assert.equal(h.painted.y, 137, '한 프레임 뒤에도 안 따라잡았다 — 그렇다면 강제 재동기가 필요하다');
  assert.equal(Math.abs(h.model.y - h.painted.y), 0, '실측(137.00 → 0.00)과 다르다');
});

test('U-M66-3 ★루프는 «자기 콜백 안에서만» 끝난다 ⇒ 프레임이 없는 동안엔 죽을 수 없다', () => {
  const h = makeEnv();
  h.start.start();
  h.serve(1);
  const pendingBefore = h.queue.length;
  assert.equal(pendingBefore, 1, '다음 프레임 예약이 «안» 걸려 있다 — 멈추면 영영 안 깨어난다');

  // 프레임을 안 주는 동안 «선택이 풀려도» 루프는 스스로 못 죽는다(콜백이 안 도니까)
  h.start.setBlock({ isConnected: false, classList: { contains: () => false } });
  assert.equal(h.log.hides, 0, '프레임도 없이 hideGridGutters 가 불렸다');
  // 프레임이 오면 그때 정리된다 — 그리고 «그때는» 재예약을 안 한다(좀비 루프 금지)
  h.serve(1);
  assert.equal(h.log.hides, 1, '블록이 죽었는데 정리를 안 했다');
  assert.equal(h.queue.length, 0, '정리하고도 다음 프레임을 또 예약했다 — 좀비 루프');
});

test('U-M66-4 ★매 틱 «무조건» 다시 계산한다 — 「안 바뀌었으면 건너뛴다」 최적화가 들어오면 빨개진다', () => {
  const h = makeEnv();
  h.start.start();
  h.serve(5);
  assert.equal(h.log.updates, 5, `프레임 5장에 갱신이 ${h.log.updates}회 — 틱마다 1회여야 한다`);

  // 소스에도 «조건부 건너뛰기»가 없어야 한다: 위치 갱신 앞에 이른 return 은 생존 검사 둘뿐
  const body = START_SRC.slice(START_SRC.indexOf('function loop()'), START_SRC.indexOf('_updateGridGutterPositions()'));
  const returns = (body.match(/\breturn\b/g) || []).length;
  assert.equal(returns, 2,
    `위치 갱신 «앞»의 return 이 ${returns}개다 — 생존검사 2개(블록 없음 / 죽었거나 선택해제) 말고는 없어야 한다. ` +
    '조건부로 갱신을 건너뛰면 멈췄다 깨어날 때 «안 따라잡는다»');
});

test('U-M66-5 ★rAF id 취소는 «거터 제거»와 «한 몸»이다 — 따로 취소하면 「거터는 있는데 루프는 죽음」이 된다', () => {
  /* showGridGutters 의 조기 return 경로는 위치만 갱신하고 루프를 «다시 시작하지 않는다».
     그래서 「거터가 살아 있는데 루프만 죽은」 상태가 만들어지면 영구 어긋남이 된다.
     그런 상태가 «불가능»한 이유 = rAF 취소가 hideGridGutters 안에만 있고, 거기서 거터도 같이 지운다. */
  const cancels = [...SRC.matchAll(/cancelAnimationFrame\(_gridGutterRafId\)/g)];
  assert.equal(cancels.length, 1, `_gridGutterRafId 취소가 ${cancels.length}군데다 — 한 곳(hideGridGutters)이어야 한다`);
  const hideSrc = sliceFn('function hideGridGutters() {');
  assert.ok(/cancelAnimationFrame\(_gridGutterRafId\)/.test(hideSrc), '취소가 hideGridGutters 밖에 있다');
  assert.ok(/\.grd-gutter'\)\.forEach\(g => g\.remove\(\)\)/.test(hideSrc),
    'hideGridGutters 가 거터를 «안 지운다» — 루프만 죽고 거터가 남으면 영구 어긋남이다');
});
