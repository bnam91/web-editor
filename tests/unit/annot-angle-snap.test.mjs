/* ══════════════════════════════════════════════════════════════════════════
   annot-angle-snap — ★1017t1h1 공용 벡터 스냅(window._snapVecToStep · js/asset-rotate.js)
   ──────────────────────────────────────────────────────────────────────────
   무엇을 잠그나:
     U1 ★배율(zoom) 무관 — 스냅은 «섹션-space 각도»만 본다. 화면 px 로 재지 않는다
        (화면 px 로 쟀으면 40% 줌에서 같은 ±6° 가 2.5배로 세진다 — findings h1⑸가 막으려던 결함).
     U2 음성대조 ★tolDeg:0 이면 완전히 정확한 축(0/45/90…)이 아니고서는 아무것도 안 붙는다.
     U3 ★「±6°」가 소스 «정의 자리 한 곳»(js/asset-rotate.js ANNOT_SNAP_TOL_DEG)에만 산다 —
        명부가 둘이 되면(소비자마다 리터럴 6) 드리프트가 난다. 소비자(js/annotation-tool.js ×2 ·
        js/annotation-select.js ×1)는 전부 그 상수를 읽는지 소스에서 확인한다.
   ⛔DOM 없음 — js/asset-rotate.js 의 top-level 부작용은 `typeof document === 'undefined'` 로
     스스로 막혀 있다(파일 :50 확인). vm 에 document 를 안 주면 그 가드가 거짓이 돼 안전하게 로드된다.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC_PATH = path.join(ROOT, 'js', 'asset-rotate.js');

/* ★asset-rotate.js 는 .annot-svg 등 real DOM 이 있을 때만 「행동」하는 다른 함수들(_rotateHandlerFor
   의 소비자, MutationObserver 콜백 본문 등)도 담고 있지만, top-level(모듈 로드 시 바로 도는 코드) 은
   ⑴ selected 변경 감시자 등록 ⑵ 초기 스캔 ⑶ body 삽입 감시자 등록 «뿐»이다 — 우리가 재는
   _snapVecToStep 은 그 아래 순수 함수라 이 스텁들의 행동은 전혀 안 쓴다(호출되지도 않는다).
   ⛔DOM 이 있어야 재는 것(핸들 추가/제거 등)은 여기서 ★안 잰다 — 그건 tests/dom 몫. */
class _StubMutationObserver {
  observe() {}
  disconnect() {}
}
class _StubHTMLElement {}
function _makeDocument() {
  return {
    readyState: 'complete',
    body: new _StubHTMLElement(),
    head: null,
    documentElement: { appendChild() {} },
    addEventListener() {},
    removeEventListener() {},
    getElementById() { return null; },
    querySelectorAll() { return []; },
    createElement() { return { style: {}, appendChild() {} }; },
  };
}

function loadWindow() {
  const src = fs.readFileSync(SRC_PATH, 'utf8');
  const sandbox = {
    window: {}, Math,
    MutationObserver: _StubMutationObserver,
    HTMLElement: _StubHTMLElement,
  };
  sandbox.document = _makeDocument();
  vm.createContext(sandbox);
  vm.runInContext(src, sandbox, { filename: SRC_PATH });
  return sandbox.window;
}

test('U0 ★전제 — window._snapVecToStep · _ROTATE_SNAP_STEP · ANNOT_SNAP_TOL_DEG 가 정의 자리에 실제로 있다', () => {
  const w = loadWindow();
  assert.equal(typeof w._snapVecToStep, 'function');
  assert.equal(w._ROTATE_SNAP_STEP, 45);
  assert.equal(w.ANNOT_SNAP_TOL_DEG, 6);
});

test('U1 배율 무관 — 같은 섹션-space 각이면 "화면 px" 단위와 무관하게 같은 결과(44° → 45°)', () => {
  const w = loadWindow();
  // 섹션-space 좌표는 이미 zoom 으로 나눈 뒤의 값이다(annotation-tool.js _clientToSectionCoord 와 같은 계약) —
  // 그래서 이 함수에는 zoom 인자가 «없다». 같은 모델 좌표를 넣으면 호출측이 40%든 100%든 결과가 같아야 한다.
  const ref = { x: 0, y: 0 };
  const len = 60;
  const rad = 44 * Math.PI / 180;
  const p = { x: Math.cos(rad) * len, y: Math.sin(rad) * len };
  const out = w._snapVecToStep(p, ref, { tolDeg: w.ANNOT_SNAP_TOL_DEG });
  const deg = Math.atan2(out.y - ref.y, out.x - ref.x) * 180 / Math.PI;
  assert.ok(Math.abs(deg - 45) <= 0.01, `44° 는 ±6° 안 → 45 로 스냅(실측 ${deg})`);
  // 길이도 보존된다(산식이 pen-tool.js 꼴 그대로인지 확인).
  const outLen = Math.hypot(out.x - ref.x, out.y - ref.y);
  assert.ok(Math.abs(outLen - len) < 1e-9, `길이 보존(실측 ${outLen})`);
});

test('U2(음성) tolDeg:0 — 44°(정확한 45 가 아님)는 전혀 안 붙는다', () => {
  const w = loadWindow();
  const ref = { x: 0, y: 0 };
  const rad = 44 * Math.PI / 180;
  const p = { x: Math.cos(rad) * 60, y: Math.sin(rad) * 60 };
  const out = w._snapVecToStep(p, ref, { tolDeg: 0 });
  assert.deepEqual(out, p, 'tolDeg 0 이면 완전히 축에 있지 않은 점은 原point 그대로');
});

test('U2b(음성) tolDeg 밖(20°)이면 원래 점을 그대로 돌려준다', () => {
  const w = loadWindow();
  const ref = { x: 0, y: 0 };
  const rad = 20 * Math.PI / 180;
  const p = { x: Math.cos(rad) * 60, y: Math.sin(rad) * 60 };
  const out = w._snapVecToStep(p, ref, { tolDeg: 6 });
  assert.deepEqual(out, p, '±6° 밖이면 안 붙는다');
});

test('U2c(음성) tolDeg: null = 강제(Shift 꼴) — ±6° 밖(35°, 가장 가까운 배수는 45)도 붙는다', () => {
  const w = loadWindow();
  const ref = { x: 0, y: 0 };
  const rad = 35 * Math.PI / 180;   // |35-45|=10 (★★6° 밖이라 평시엔 안 붙는다) · 가장 가까운 45 배수는 45(|35-0|=35 보다 가깝다)
  const p = { x: Math.cos(rad) * 60, y: Math.sin(rad) * 60 };
  const unforced = w._snapVecToStep(p, ref, { tolDeg: 6 });
  assert.deepEqual(unforced, p, '★전제: 평시(±6°)엔 35°가 안 붙는다(원점 그대로)');
  const out = w._snapVecToStep(p, ref, { tolDeg: null });
  const deg = Math.atan2(out.y - ref.y, out.x - ref.x) * 180 / Math.PI;
  assert.ok(Math.abs(deg - 45) <= 0.01, `tolDeg null(강제) → ±6° 밖인 35° 도 가장 가까운 45 로 붙는다(실측 ${deg})`);
});

/* U3 — ±6°(ANNOT_SNAP_TOL_DEG)가 «정의 자리 한 곳»에만 있고, 세 소비자가 전부 그 이름을 읽는지.
   ⛔사용 자리를 손으로 세지 않는다 — 정규식으로 소스를 직접 센다(정의/소비 둘 다 소스에서). */
test('U3 ANNOT_SNAP_TOL_DEG — 정의 1곳 · 소비자 3곳 전부 리터럴 6 이 아니라 그 이름을 읽는다', () => {
  const rotateSrc = fs.readFileSync(SRC_PATH, 'utf8');
  const defMatches = rotateSrc.match(/window\.ANNOT_SNAP_TOL_DEG\s*=\s*6\s*;/g) || [];
  assert.equal(defMatches.length, 1, `정의는 한 곳(js/asset-rotate.js) — 지금 ${defMatches.length}곳`);

  const toolSrc = fs.readFileSync(path.join(ROOT, 'js', 'annotation-tool.js'), 'utf8');
  const selectSrc = fs.readFileSync(path.join(ROOT, 'js', 'annotation-select.js'), 'utf8');
  const consumerRe = /tolDeg:\s*\w+\.shiftKey\s*\?\s*null\s*:\s*window\.ANNOT_SNAP_TOL_DEG/g;
  const toolHits = (toolSrc.match(consumerRe) || []).length;
  const selectHits = (selectSrc.match(consumerRe) || []).length;
  assert.equal(toolHits, 2, `js/annotation-tool.js 소비자 2곳(그리기 클릭 · mousemove) — 지금 ${toolHits}`);
  assert.equal(selectHits, 1, `js/annotation-select.js 소비자 1곳(점 손잡이 끌기) — 지금 ${selectHits}`);

  // ★계측기 자가검사 — 세 소비자 자리에 손으로 쓴 리터럴 ", 6)" 류가 하나라도 남아 있으면(=드리프트 가능) 걷어낸다.
  const rawSixRe = /tolDeg:\s*\w+\.shiftKey\s*\?\s*null\s*:\s*6\b/g;
  assert.equal((toolSrc.match(rawSixRe) || []).length, 0, 'js/annotation-tool.js 에 손으로 쓴 리터럴 6 이 없다');
  assert.equal((selectSrc.match(rawSixRe) || []).length, 0, 'js/annotation-select.js 에 손으로 쓴 리터럴 6 이 없다');
});
