/* T-007 — 「10배율로 줄어들면 버튼들이 넘 커진다」(현빈 QA FAIL, T-007).
 *   실행: node --test "tests/unit/*.test.mjs"  ·  editor.js 에서 applyZoom 을 «원문 그대로» 잘라
 *   가짜 DOM 에서 돌리고, documentElement 에 세팅되는 --inv-zoom 값을 잰다(U-M62 픽스처와 같은 수법).
 *
 * --inv-zoom 은 css/editor-canvas.css:99,122-123,146-147,200 의 스크래치패드 버튼(닫기·자르기·
 * 연결·리사이즈, 기본 20px)뿐 아니라 editor-blocks.css 의 리사이즈 핸들·선택 아웃라인 등이 두루
 * 참조하는 «단일 계산 지점»(js/editor.js applyZoom)의 역-스케일 값이다. 캔버스를 최소 배율(10%)
 * 까지 축소하면 역-스케일이 100/10=10배까지 커져 버튼이 이미지보다 훨씬 크게 보인다.
 *
 * 상한(INV_ZOOM_CAP=2.5) 근거는 editor.js 의 해당 상수 옆 주석 참조 — 버튼 기본 20px 기준
 * ×2.5=50px 는 이 앱 기본 배율(40%)에서 보이는 크기와 같다.
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

const CAP_RE = /const INV_ZOOM_CAP = ([\d.]+);/;
const capMatch = SRC.match(CAP_RE);
assert.ok(capMatch, 'T-007: INV_ZOOM_CAP 상수를 소스에서 못 찾음 — 이름이 바뀌었으면 이 검사도 같이 옮겨라');
const INV_ZOOM_CAP = Number(capMatch[1]);

/* 양성대조 — 상한을 «도로 무제한」으로 돌린 옛 동작(현빈이 FAIL 낸 그 상태). */
const APPLY_SRC_OLD = APPLY_SRC.replace(
  /Math\.min\(INV_ZOOM_CAP, 100 \/ currentZoom\)/,
  '100 / currentZoom'
);
assert.notEqual(APPLY_SRC_OLD, APPLY_SRC, 'T-007: 양성대조 치환 앵커를 못 찾음 — 구현이 바뀌었으면 같이 고쳐라');

function makeEnv(applySrc) {
  const model = { scale: 0.4 };
  const wrap = { clientHeight: 900, scrollTop: 0, scrollHeight: 900, getBoundingClientRect: () => ({ top: 0, bottom: 900, height: 900 }) };
  const canvas = { getBoundingClientRect: () => ({ top: 0, height: 5000 * model.scale, bottom: 5000 * model.scale }) };
  const scaler = { style: {}, offsetWidth: 860, offsetHeight: 1 };
  const zoomDisplay = { textContent: '' };
  let invZoom = null;
  const documentEl = { style: { setProperty(name, v) { if (name === '--inv-zoom') invZoom = Number(v); } } };
  const doc = {
    documentElement: documentEl,
    getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas' ? canvas : null),
  };
  const win = { resetCanvasTail: () => {}, currentZoom: 40 };

  const prelude = `
    const INV_ZOOM_CAP = ${INV_ZOOM_CAP};
    let currentZoom = 40;
    function _applyScalerTransformAndSync() { __model.scale = currentZoom / 100; }
    function scheduleNotchUpdate() {}
    let panOffsetX = 0, panOffsetY = 0;
  `;
  const fn = new Function(
    '__model', 'document', 'window', 'scaler', 'zoomDisplay', 'requestAnimationFrame',
    `${prelude}\n${applySrc}\nreturn { applyZoom, getZoom: () => currentZoom };`
  )(model, doc, win, scaler, zoomDisplay, cb => cb());

  return { ...fn, getInvZoom: () => invZoom };
}

test('T-007-1 10% 줌 — --inv-zoom 이 상한(2.5) 을 넘지 않는다', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(10);
  assert.ok(e.getInvZoom() <= INV_ZOOM_CAP + 1e-9,
    `--inv-zoom=${e.getInvZoom()} 이 상한 ${INV_ZOOM_CAP} 을 넘었다`);
  assert.equal(e.getInvZoom(), INV_ZOOM_CAP, '10% 줌은 상한에 «정확히» 물려야 한다 (100/10=10 ≫ cap)');
});

test('T-007-2 [양성대조] 상한을 빼면 10% 줌에서 --inv-zoom=10 으로 실제 재현된다', () => {
  const e = makeEnv(APPLY_SRC_OLD);
  e.applyZoom(10);
  assert.equal(e.getInvZoom(), 10, '양성대조가 안 재현됨 — 이 픽스처는 T-007 결함을 «볼 수 없는» 검사다');
});

test('T-007-3 정상 줌 범위(50~200%) — 기존 계산식 그대로, 회귀 없음', () => {
  for (const z of [50, 66.67, 80, 100, 150, 200]) {
    const e = makeEnv(APPLY_SRC);
    e.applyZoom(z);
    const expected = 100 / z;
    assert.ok(expected < INV_ZOOM_CAP, `픽스처 무효: ${z}% 의 100/z=${expected} 가 이미 상한 위다`);
    assert.ok(Math.abs(e.getInvZoom() - expected) < 1e-4,
      `${z}% 줌: --inv-zoom=${e.getInvZoom()} 이 옛 계산식(100/z=${expected.toFixed(4)}) 과 달라졌다 — 정상범위 회귀`);
  }
});

test('T-007-4 400% 줌(확대 상한) — 버튼이 더 작아지는 쪽은 이미 자연스럽게 갇혀 있다(회귀 없음)', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(400);
  assert.ok(Math.abs(e.getInvZoom() - 0.25) < 1e-4,
    `400% 줌: --inv-zoom=${e.getInvZoom()} — 옛 값(0.25) 과 달라졌다(줌 자체 상한 10~400%p 가 자연 floor 역할)`);
});

test('T-007-5 상한이 걸리는 구간(줌 ≤ 40%) 은 --inv-zoom 이 «더 줄지 않고 cap 에 눌린다»', () => {
  const zooms = [40, 30, 20, 10];
  const vals = zooms.map(z => { const e = makeEnv(APPLY_SRC); e.applyZoom(z); return e.getInvZoom(); });
  /* 40% 는 100/40=2.5 로 cap 과 같아 경계 — 그 아래(30/20/10%) 는 전부 cap 에 눌려 «값이 안 변한다». */
  assert.equal(vals[0], INV_ZOOM_CAP, `40% 는 경계값(100/40=2.5=cap) 이어야 한다: ${vals[0]}`);
  for (let i = 1; i < vals.length; i++) {
    assert.equal(vals[i], INV_ZOOM_CAP,
      `${zooms[i]}% 에서 --inv-zoom=${vals[i]} — cap(${INV_ZOOM_CAP}) 에 눌리지 않고 계속 커졌다(버튼이 계속 커진다는 뜻 = 버그 재발)`);
  }
});
