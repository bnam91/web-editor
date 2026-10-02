/* T-007 — 「10배율로 줄어들면 버튼들이 넘 커진다」(현빈 QA FAIL, T-007).
 *   실행: node --test "tests/unit/*.test.mjs"  ·  editor.js 에서 applyZoom 을 «원문 그대로» 잘라
 *   가짜 DOM 에서 돌리고, documentElement 에 세팅되는 --inv-zoom/--scratch-inv-zoom 값을 잰다
 *   (U-M62 픽스처와 같은 수법).
 *
 * ★2026-09-16f 정정(작업목록매니저 내용게이트 지적) — 처음엔 상한을 «전역» --inv-zoom 에
 * 걸었었다. 그 토큰은 스크래치패드 버튼(css/editor-canvas.css:99,122-123,146-147,200 ·
 * editor-extra.css .spl-btns)뿐 아니라 선택 아웃라인(--sel-outline-w, editor-base.css:9)·
 * 도형 리사이즈 핸들(.shape-handle, editor-blocks.css:1633)·에셋 회전 핫존(asset-rotate.js:47)
 * 도 같이 참조하는 공유 토큰이라, 거기 상한을 걸면 그 요소들이 극단 줌에서 «진짜 고정 화면크기»를
 * 잃는 회귀가 났다. ⇒ 전역 --inv-zoom 은 원래 계산식(무제한)을 유지하고, 스크래치패드 전용
 * --scratch-inv-zoom 을 별도로 둬 그 값에만 상한을 건다.
 *
 * 상한(SCRATCH_INV_ZOOM_CAP=2.5) 근거는 editor.js 의 해당 상수 옆 주석 참조 — 버튼 기본 20px
 * 기준 ×2.5=50px 는 이 앱 기본 배율(40%)에서 보이는 크기와 같다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';
import { sliceBlock } from './_slice-block.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const SRC = readSrc(ROOT, 'js/editor.js');

const APPLY_SRC = sliceBlock(SRC, 'function applyZoom(z, opts) {', 'T-007: 검사가 옛 소스를 보고 있다');

const CAP_RE = /const SCRATCH_INV_ZOOM_CAP = ([\d.]+);/;
const capMatch = SRC.match(CAP_RE);
assert.ok(capMatch, 'T-007: SCRATCH_INV_ZOOM_CAP 상수를 소스에서 못 찾음 — 이름이 바뀌었으면 이 검사도 같이 옮겨라');
const SCRATCH_INV_ZOOM_CAP = Number(capMatch[1]);

/* 전역 --inv-zoom 은 여전히 무제한(원래 계산식)이어야 한다 — 이 회귀를 못 잡으면 선택
 * 아웃라인·리사이즈 핸들이 극단 줌에서 다시 얇아진다. */
assert.match(APPLY_SRC, /setProperty\('--inv-zoom', \(100 \/ currentZoom\)\.toFixed\(4\)\)/,
  'T-007: --inv-zoom(전역) 계산식이 바뀌었다 — 상한이 도로 전역에 걸렸을 수 있다');

/* 양성대조 — 상한을 «도로 무제한」으로 돌린 옛(첫 시도) 동작. */
const APPLY_SRC_OLD = APPLY_SRC.replace(
  /setProperty\('--scratch-inv-zoom', Math\.min\(SCRATCH_INV_ZOOM_CAP, 100 \/ currentZoom\)\.toFixed\(4\)\)/,
  "setProperty('--scratch-inv-zoom', (100 / currentZoom).toFixed(4))"
);
assert.notEqual(APPLY_SRC_OLD, APPLY_SRC, 'T-007: 양성대조 치환 앵커를 못 찾음 — 구현이 바뀌었으면 같이 고쳐라');

function makeEnv(applySrc) {
  const model = { scale: 0.4 };
  const wrap = { clientHeight: 900, scrollTop: 0, scrollHeight: 900, getBoundingClientRect: () => ({ top: 0, bottom: 900, height: 900 }) };
  const canvas = { getBoundingClientRect: () => ({ top: 0, height: 5000 * model.scale, bottom: 5000 * model.scale }) };
  const scaler = { style: {}, offsetWidth: 860, offsetHeight: 1 };
  const zoomDisplay = { textContent: '' };
  let invZoom = null, scratchInvZoom = null;
  const documentEl = {
    style: {
      setProperty(name, v) {
        if (name === '--inv-zoom') invZoom = Number(v);
        if (name === '--scratch-inv-zoom') scratchInvZoom = Number(v);
      },
    },
  };
  const doc = {
    documentElement: documentEl,
    getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas' ? canvas : null),
  };
  const win = { resetCanvasTail: () => {}, currentZoom: 40 };

  const prelude = `
    const SCRATCH_INV_ZOOM_CAP = ${SCRATCH_INV_ZOOM_CAP};
    let currentZoom = 40;
    function _applyScalerTransformAndSync() { __model.scale = currentZoom / 100; }
    function scheduleNotchUpdate() {}
    let panOffsetX = 0, panOffsetY = 0;
  `;
  const fn = new Function(
    '__model', 'document', 'window', 'scaler', 'zoomDisplay', 'requestAnimationFrame',
    `${prelude}\n${applySrc}\nreturn { applyZoom, getZoom: () => currentZoom };`
  )(model, doc, win, scaler, zoomDisplay, cb => cb());

  return { ...fn, getInvZoom: () => invZoom, getScratchInvZoom: () => scratchInvZoom };
}

test('T-007-1 10% 줌 — --scratch-inv-zoom 은 상한(2.5) 을 넘지 않는다', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(10);
  assert.ok(e.getScratchInvZoom() <= SCRATCH_INV_ZOOM_CAP + 1e-9,
    `--scratch-inv-zoom=${e.getScratchInvZoom()} 이 상한 ${SCRATCH_INV_ZOOM_CAP} 을 넘었다`);
  assert.equal(e.getScratchInvZoom(), SCRATCH_INV_ZOOM_CAP, '10% 줌은 상한에 «정확히» 물려야 한다 (100/10=10 ≫ cap)');
});

test('T-007-1b ★회귀 방지 — 전역 --inv-zoom 은 10% 줌에서도 상한 없이 «진짜 10»이다', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(10);
  assert.equal(e.getInvZoom(), 10,
    '전역 --inv-zoom 이 상한에 눌렸다 — 선택 아웃라인·리사이즈 핸들·회전 핫존이 극단 줌에서 얇아지는 회귀');
});

test('T-007-2 [양성대조] 상한을 빼면 10% 줌에서 --scratch-inv-zoom=10 으로 실제 재현된다', () => {
  const e = makeEnv(APPLY_SRC_OLD);
  e.applyZoom(10);
  assert.equal(e.getScratchInvZoom(), 10, '양성대조가 안 재현됨 — 이 픽스처는 T-007 결함을 «볼 수 없는» 검사다');
});

test('T-007-3 정상 줌 범위(50~200%) — --scratch-inv-zoom 도 --inv-zoom 과 같은 값(기존 계산식), 회귀 없음', () => {
  for (const z of [50, 66.67, 80, 100, 150, 200]) {
    const e = makeEnv(APPLY_SRC);
    e.applyZoom(z);
    const expected = 100 / z;
    assert.ok(expected < SCRATCH_INV_ZOOM_CAP, `픽스처 무효: ${z}% 의 100/z=${expected} 가 이미 상한 위다`);
    assert.ok(Math.abs(e.getScratchInvZoom() - expected) < 1e-4,
      `${z}% 줌: --scratch-inv-zoom=${e.getScratchInvZoom()} 이 옛 계산식(100/z=${expected.toFixed(4)}) 과 달라졌다 — 정상범위 회귀`);
    assert.equal(e.getInvZoom(), e.getScratchInvZoom(), `${z}% 줌(상한 아래)에서는 두 토큰이 같아야 한다`);
  }
});

test('T-007-4 400% 줌(확대 상한) — 버튼이 더 작아지는 쪽은 이미 자연스럽게 갇혀 있다(회귀 없음)', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(400);
  assert.ok(Math.abs(e.getScratchInvZoom() - 0.25) < 1e-4,
    `400% 줌: --scratch-inv-zoom=${e.getScratchInvZoom()} — 옛 값(0.25) 과 달라졌다(줌 자체 상한 10~400%p 가 자연 floor 역할)`);
});

test('T-007-5 상한이 걸리는 구간(줌 ≤ 40%) 은 --scratch-inv-zoom 이 «더 줄지 않고 cap 에 눌린다» — 전역 --inv-zoom 은 계속 커진다', () => {
  const zooms = [40, 30, 20, 10];
  const vals = zooms.map(z => { const e = makeEnv(APPLY_SRC); e.applyZoom(z); return e.getScratchInvZoom(); });
  const globalVals = zooms.map(z => { const e = makeEnv(APPLY_SRC); e.applyZoom(z); return e.getInvZoom(); });
  /* 40% 는 100/40=2.5 로 cap 과 같아 경계 — 그 아래(30/20/10%) 는 전부 cap 에 눌려 «값이 안 변한다». */
  assert.equal(vals[0], SCRATCH_INV_ZOOM_CAP, `40% 는 경계값(100/40=2.5=cap) 이어야 한다: ${vals[0]}`);
  for (let i = 1; i < vals.length; i++) {
    assert.equal(vals[i], SCRATCH_INV_ZOOM_CAP,
      `${zooms[i]}% 에서 --scratch-inv-zoom=${vals[i]} — cap(${SCRATCH_INV_ZOOM_CAP}) 에 눌리지 않고 계속 커졌다(버튼이 계속 커진다는 뜻 = 버그 재발)`);
  }
  /* 전역 --inv-zoom 은 같은 구간에서 계속 커져야 한다(100/40=2.5 → 100/10=10, 상한 없음). */
  assert.deepEqual(globalVals, zooms.map(z => Number((100 / z).toFixed(4))),
    `전역 --inv-zoom 이 이 구간에서 상한에 눌렸다: ${globalVals}`);
});
