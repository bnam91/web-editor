/* U-FLOWDROP — 오버레이를 «다른 섹션»에 놓고 풀 때 들어갈 자리를 고르는 순수 함수.
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *   ⛔`node --test tests/unit`(디렉터리)로 부르지 마라 — Node 24 에서 한 개도 안 돌고 죽는다
 *     (overlay-float-wiring.test.mjs 머리말과 같은 함정).
 *
 * ★왜 이 파일이 있나 (2026-09-22, T-037 ㉗ / 현빈 결정)
 *   exitFloat 은 «다른 섹션»으로 옮긴 뒤 해제하면 target.prepend 로 «무조건 맨 위»에 넣었다.
 *   그건 설계가 아니라 2026-09-16 응급처치였다(그전엔 «처음 섹션»으로 순간이동하는 더 나쁜
 *   버그). 현빈 결정 — 「놓은 높이에 맞는 자리」로 끼운다.
 *   ⛔여백(.gap-block)은 «기준에서 뺀다» — 여백과 여백 사이에 끼면 간격이 두 배로 보인다.
 *   ⛔위쪽으로 한참 벗어나게 놓으면 «맨 위»(0) — 옛 동작이 그대로 살아남는 경계다.
 *
 * 이 파일은 «실제 소스»(js/overlay-float.js)를 import 한다 — 손으로 베낀 모델이 아니다.
 * 브라우저 ESM 이라 Node 가 CJS 로 읽는 것을 임시 폴더 type:module 로 푼다
 * (선례: bulk-align-targets.test.mjs · save-dirty-after-failure.test.mjs).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const { flowDropIndex } = await (async () => {
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-flowdrop-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  // overlay-float.js 는 같은 폴더의 두 모듈을 import 한다 — 이름 그대로 같이 옮겨야 풀린다.
  for (const f of ['overlay-float.js', 'frame-geometry.js', 'shape-frame.js']) {
    fs.copyFileSync(path.join(ROOT, 'js', f), path.join(tmp, f));
  }
  const m = await import(pathToFileURL(path.join(tmp, 'overlay-float.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();

/* ── 최소 DOM 스텁 — flowDropIndex 가 실제로 쓰는 것만 갖춘다.
   (nodeType · classList.contains · dataset · getBoundingClientRect · 부모의 children) */
function el(cls, top, h, { w = 716, ghost = false, overlay = false } = {}) {
  const classes = cls ? cls.split(/\s+/) : [];
  return {
    nodeType: 1,
    _cls: classes,
    classList: { contains: (c) => classes.includes(c) },
    dataset: overlay ? { overlayBlock: 'true' } : {},
    getBoundingClientRect: () => (ghost
      ? { top: 0, height: 0, width: 0, bottom: 0 }
      : { top, height: h, width: w, bottom: top + h }),
  };
}
const box = (children) => ({ children });

/* 실앱 섹션 본문 한 벌 — 여백이 블럭 사이에 깔린 «보통» 모양.
     0 gap-block   top   0 h  20   (중심  10)
     1 B1          top  20 h 100   (중심  70)
     2 gap-block   top 120 h  20   (중심 130)
     3 B2          top 140 h 100   (중심 190)
     4 gap-block   top 240 h  20   (중심 250)
     5 B3          top 260 h 100   (중심 310)                 children.length = 6 */
function sectionInner() {
  const g0 = el('gap-block', 0, 20);
  const b1 = el('text-block', 20, 100);
  const g1 = el('gap-block', 120, 20);
  const b2 = el('asset-block', 140, 100);
  const g2 = el('gap-block', 240, 20);
  const b3 = el('text-block', 260, 100);
  return { inner: box([g0, b1, g1, b2, g2, b3]), g0, b1, g1, b2, g2, b3 };
}

test('T0 ★입력이 살아 있다 — 실제 소스에서 함수를 가져왔다', () => {
  assert.equal(typeof flowDropIndex, 'function',
    'js/overlay-float.js 가 flowDropIndex 를 export 하지 않는다 — 자리 고르는 산식이 순수 함수로 안 빠져 있다');
});

/* ══ 세로 의도 — 위 / 중간 / 아래 ═══════════════════════════════════════════ */

test('T1 «위»에 놓으면 맨 위(0) — 첫 내용 블럭(중심 70)보다 위', () => {
  const { inner } = sectionInner();
  assert.equal(flowDropIndex(inner, 40), 0);
});

test('T2 «중간»에 놓으면 그 높이의 내용 블럭 앞 — B2(중심 190) 앞 = 3', () => {
  const { inner } = sectionInner();
  // 중심 150 : B1(70) 아래, B2(190) 위 ⇒ B2 앞
  assert.equal(flowDropIndex(inner, 150), 3);
});

test('T3 «아래»에 놓으면 맨 아래(children.length=6) — 마지막 블럭(중심 310)보다 아래', () => {
  const { inner } = sectionInner();
  assert.equal(flowDropIndex(inner, 330), 6);
});

/* ══ 경계 밖 ═══════════════════════════════════════════════════════════════ */

test('T4 [경계] 위로 «한참» 벗어나게 놓아도 맨 위(0) — 옛 동작(prepend)이 그대로 살아남는다', () => {
  const { inner } = sectionInner();
  assert.equal(flowDropIndex(inner, -5000), 0);
});

test('T5 [경계] 아래로 «한참» 벗어나게 놓으면 맨 아래(6)', () => {
  const { inner } = sectionInner();
  assert.equal(flowDropIndex(inner, 5000), 6);
});

test('T6 [경계] 첫 블럭의 위 절반에 걸치면 아직 맨 위(0), 아래 절반으로 내려가면 더 아래로 간다', () => {
  const { inner } = sectionInner();
  assert.equal(flowDropIndex(inner, 69), 0, 'B1 중심(70) 바로 위인데 맨 위가 아니다');
  assert.equal(flowDropIndex(inner, 71), 3, 'B1 중심(70) 바로 아래인데 B1 앞에 머물렀다');
});

/* ══ ★여백은 기준에서 뺀다 ════════════════════════════════════════════════ */

test('T7 ★여백(gap-block) 중심은 기준이 아니다 — 여백 한가운데에 놓아도 여백 앞뒤로 쪼개 넣지 않는다', () => {
  const { inner } = sectionInner();
  /* 중심 130 = g1(여백, 중심 130) 한복판. 여백을 기준으로 세면 「g1 앞」(인덱스 2)이 나와
     [B1, NEW, g1, B2] 처럼 여백 «밖»에 붙는다. 여백을 빼면 B2 앞(3)이라 [B1, g1, NEW, B2]. */
  assert.equal(flowDropIndex(inner, 130), 3);
});

test('T8 ★여백과 여백 사이(연달아 놓인 두 여백)로는 들어가지 않는다', () => {
  const b1 = el('text-block', 0, 100);      // 중심  50
  const ga = el('gap-block', 100, 40);      // 중심 120
  const gb = el('gap-block', 140, 40);      // 중심 160
  const b2 = el('text-block', 180, 100);    // 중심 230
  const inner = box([b1, ga, gb, b2]);
  for (const y of [110, 130, 150, 170]) {   // 두 여백 구간 전체를 훑는다
    const i = flowDropIndex(inner, y);
    assert.equal(i, 3, `centerY=${y} 에서 인덱스 ${i} — 여백(1)과 여백(2) 사이에 끼었다`);
  }
});

test('T9 여백만 있는 컨테이너 — 견줄 눈금이 없으니 자리를 지어내지 않고 맨 뒤', () => {
  const inner = box([el('gap-block', 0, 40), el('gap-block', 40, 40)]);
  assert.equal(flowDropIndex(inner, -1000), 2);
});

/* ══ 제외 규칙 — 나 자신 · 오버레이 · 0×0 유령 · 드래그 껍데기 ══════════════ */

test('T10 skipEl(나 자신)은 기준에서 뺀다 — 안 빼면 자기 중심에 걸려 제자리에 묶인다', () => {
  const me = el('text-block', 0, 100);      // 중심 50 — 컨테이너 맨 앞에 있다
  const b1 = el('text-block', 100, 100);    // 중심 150
  const b2 = el('text-block', 200, 100);    // 중심 250
  const inner = box([me, b1, b2]);
  assert.equal(flowDropIndex(inner, 220, me), 2, '나 자신을 눈금으로 세면 0 에 묶인다');
});

test('T11 오버레이(절대배치) 형제는 기준이 아니다 — 흐름에 없는 것을 흐름의 자로 쓸 수 없다', () => {
  const ov = el('text-block', 0, 100, { overlay: true });   // 중심  50 (떠 있는 놈)
  const b1 = el('text-block', 0, 100);                      // 중심  50
  const b2 = el('text-block', 100, 100);                    // 중심 150
  const inner = box([ov, b1, b2]);
  assert.equal(flowDropIndex(inner, 120), 2, '오버레이를 눈금으로 셌다');
});

test('T12 0×0 유령은 기준이 아니다', () => {
  const ghost = el('text-block', 0, 0, { ghost: true });
  const b1 = el('text-block', 0, 100);       // 중심 50
  const inner = box([ghost, b1]);
  assert.equal(flowDropIndex(inner, 10), 0, '유령을 눈금으로 세면 0 이 아닌 값이 나온다');
  assert.equal(flowDropIndex(inner, 90), 2);
});

test('T13 드래그가 잠깐 심는 껍데기(.drop-indicator)는 기준이 아니다', () => {
  const ind = el('drop-indicator', 0, 4);    // 중심 2
  const b1 = el('text-block', 10, 100);      // 중심 60
  const inner = box([ind, b1]);
  assert.equal(flowDropIndex(inner, 30), 0, 'drop-indicator 를 눈금으로 셌다');
});

/* ══ 순수함수 계약 ═════════════════════════════════════════════════════════ */

test('T14 ★순수 — 호출해도 컨테이너가 안 바뀐다(읽기만 한다)', () => {
  const { inner } = sectionInner();
  const before = inner.children.slice();
  for (const y of [-100, 0, 130, 200, 400]) flowDropIndex(inner, y);
  assert.deepEqual(inner.children, before, 'flowDropIndex 가 DOM 을 건드렸다');
});

test('T15 못 재는 값(NaN)이면 옛 동작(맨 위 0)으로 — 모르는 값으로 자리를 지어내지 않는다', () => {
  const { inner } = sectionInner();
  assert.equal(flowDropIndex(inner, NaN), 0);
  assert.equal(flowDropIndex(inner, undefined), 0);
});

test('T16 빈 컨테이너 / 없는 컨테이너 — 0', () => {
  assert.equal(flowDropIndex(box([]), 100), 0);
  assert.equal(flowDropIndex(null, 100), 0);
});

/* ══ 호출부가 실제로 이 함수를 쓰는가 (문자열 단언 — 옛 prepend 로 되돌아가면 빨강) ══ */

test('T17 ★exitFloat 의 «다른 섹션» 갈래가 무조건 prepend 하지 않는다', () => {
  const src = fs.readFileSync(path.join(ROOT, 'js/overlay-float.js'), 'utf8');
  const body = src.slice(src.indexOf('export function exitFloat'));
  assert.match(body, /flowDropIndex\(target, _centerY, posEl\)/,
    'exitFloat 이 flowDropIndex 를 안 부른다 — 자리 고르기가 다시 하드코딩됐다');
  assert.match(body, /insertBefore\(posEl, ref\)/, 'insertBefore 경로가 사라졌다');
});
