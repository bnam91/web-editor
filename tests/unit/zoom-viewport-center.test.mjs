/* U-M62 — ⌘0 / Fit 이 캔버스를 «화면 밖»에 두고 온다.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  editor.js 에서 applyZoom 을 «원문 그대로» 잘라 가짜 DOM 에서 돌린다.
 *
 * ★[M62] 미니4호기 윈도우 QA 보고 → 현빈 2026-09-06 「고쳐라」.
 *   scrollTop 은 «화면 px» 인데 배율이 바뀌면 캔버스 총높이가 바뀐다. 200%→100% 면 절반이 되므로
 *   같은 scrollTop 이 «캔버스 아래 꼬리» 를 가리키고, 캔버스가 통째로 위로 사라진다.
 *   노치는 «가로 전용» 이라 세로로 나가면 사용자가 돌아올 길이 없다.
 *
 * [실측 260906 맥 9352, 14섹션 합성 픽스처] 세로 교집합 px:
 *     옵션 끈 것(옛 동작)  ⌘0←400%: 856 → ★0    Fit←400%: 856 → ★0    ⌘0←200%: 856 → 45
 *     패치본              전부 856 유지
 *
 * ⛔이 검사는 「scrollTop 이 얼마인가」를 안 센다 — «캔버스가 화면과 겹치는가» 라는
 *   관찰 가능한 결과로 잰다. 구현을 바꿔도(중앙보존이든 top 이동이든) 계약은 그대로다.
 * ⛔그리고 «옵션을 안 켠 호출은 scrollTop 을 건드리지 않는다» 도 같이 잠근다 —
 *   zoomStep(:648)·탭복원(tab-system.js:216)이 자기 스크롤을 이 함수 «뒤»에 세우기 때문이다.
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
const SRC = readSrc(ROOT, 'js/editor.js');

/** editor.js 에서 applyZoom «원문»을 잘라낸다 — 끝은 «균형괄호»로 찾는다. */
const sliceApplyZoom = (src) =>
  sliceBlock(src, 'function applyZoom(z, opts) {', '검사가 옛 소스를 보고 있다');

const APPLY_SRC = sliceApplyZoom(SRC);

/* 양성대조 — 보정 블록만 도려낸 «옛 동작». 없으면 이 검사는 결함을 못 보는 검사다. */
const CORRECTION_RE = /\n  if \(_anchorU !== null\) \{[\s\S]*?\n  \} else if \(_prevTr !== null\) \{[\s\S]*?\n  \}\n/;
const APPLY_SRC_OLD = (() => {
  assert.ok(CORRECTION_RE.test(APPLY_SRC), '보정 블록을 못 찾음 — 양성대조를 만들 수 없다');
  return APPLY_SRC.replace(CORRECTION_RE, '\n');
})();

/* ── 가짜 캔버스 모형 ──
 *   캔버스 자연높이 NAT, 배율 s 이면 화면상 높이 = NAT·s. 위아래로 꼬리여백 PAD.
 *   canvasRect.top = PAD − scrollTop,  뷰포트 = [0, VP]. */
const NAT = 5000, VP = 900, PAD = 200;

function makeEnv(applySrc) {
  const model = { scale: 0.4, scrollTop: 0 };
  const maxScroll = () => Math.max(0, PAD * 2 + NAT * model.scale - VP);
  const wrap = {
    clientHeight: VP,
    get scrollTop() { return model.scrollTop; },
    set scrollTop(v) { model.scrollTop = Math.max(0, Math.min(maxScroll(), v)); },
    get scrollHeight() { return PAD * 2 + NAT * model.scale; },
    getBoundingClientRect: () => ({ top: 0, bottom: VP, height: VP }),
  };
  const canvas = {
    getBoundingClientRect: () => {
      const top = PAD - model.scrollTop;
      return { top, height: NAT * model.scale, bottom: top + NAT * model.scale };
    },
  };
  const scaler = { style: {}, offsetWidth: 860, offsetHeight: 1 };
  const zoomDisplay = { textContent: '' };
  const documentEl = { style: { setProperty() {} } };
  const doc = {
    documentElement: documentEl,
    getElementById: id => (id === 'canvas-wrap' ? wrap : id === 'canvas' ? canvas : null),
  };
  const win = { resetCanvasTail: () => {}, currentZoom: 40 };

  /* currentZoom 을 «배율 모형»과 묶는다 — 실제 코드에선 _applyScalerTransformAndSync 가 하는 일이다. */
  const prelude = `
    let currentZoom = 40;
    function _applyScalerTransformAndSync() { __model.scale = currentZoom / 100; }
    function scheduleNotchUpdate() {}
    let panOffsetX = 0, panOffsetY = 0;
  `;
  const fn = new Function(
    '__model', 'document', 'window', 'scaler', 'zoomDisplay', 'requestAnimationFrame',
    `${prelude}\n${applySrc}\nreturn { applyZoom, getZoom: () => currentZoom };`
  )(model, doc, win, scaler, zoomDisplay, cb => cb());

  return { ...fn, model, wrap, canvas,
    /** 캔버스와 뷰포트의 «세로 교집합» px — 0 이면 화면 밖이다. */
    iy() { const r = canvas.getBoundingClientRect(); return Math.max(0, Math.min(r.bottom, VP) - Math.max(r.top, 0)); },
    /** 중간 지점을 화면 정중앙에 둔다. */
    centerOn(u) { const r = canvas.getBoundingClientRect(); wrap.scrollTop = model.scrollTop + (r.top + u * r.height) - VP / 2; },
  };
}

test('U-M62-1 ⌘0(keepViewportCenter) — 400%·200%·40% 어디서 눌러도 캔버스가 화면에 남는다', () => {
  for (const from of [400, 200, 100, 40, 10]) {
    const e = makeEnv(APPLY_SRC);
    e.applyZoom(from);
    e.centerOn(0.5);
    assert.ok(e.iy() > 0, `픽스처 무효: ${from}% 에서 시작부터 화면 밖`);
    e.applyZoom(100, { keepViewportCenter: true });
    assert.ok(e.iy() > 0, `⌘0 ← ${from}% 에서 캔버스가 화면 밖으로 나갔다(iy=${e.iy()})`);
  }
});

test('U-M62-2 [양성대조] 보정을 빼면 400%·200% 에서 실제로 화면 밖으로 나간다', () => {
  const 이탈 = [];
  for (const from of [400, 200, 100, 40, 10]) {
    const e = makeEnv(APPLY_SRC_OLD);
    e.applyZoom(from);
    e.centerOn(0.5);
    e.applyZoom(100, { keepViewportCenter: true });   // 옛 코드엔 opts 가 무의미하다
    if (e.iy() === 0) 이탈.push(from);
  }
  assert.ok(이탈.length > 0,
    '양성대조가 안 빨개진다 — 이 픽스처는 M62 결함을 «볼 수 없는» 검사다(모형을 고쳐라)');
});

test('U-M62-3 옵션을 «안 켠» 호출은 scrollTop 을 건드리지 않는다 (zoomStep·탭복원 보호)', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(400);
  e.centerOn(0.5);
  const before = e.model.scrollTop;
  e.applyZoom(100);                       // opts 없음 = zoomStep/탭복원/초기화 경로
  assert.equal(e.model.scrollTop, before,
    '옵션 없는 applyZoom 이 scrollTop 을 썼다 — zoomStep 의 앵커 계산과 싸운다');
});

test('U-M62-4 뷰포트 중앙의 캔버스 지점이 배율 뒤에도 중앙 근처에 남는다', () => {
  const e = makeEnv(APPLY_SRC);
  e.applyZoom(200);
  e.centerOn(0.5);
  e.applyZoom(100, { keepViewportCenter: true });
  const r = e.canvas.getBoundingClientRect();
  const u후 = (VP / 2 - r.top) / r.height;
  assert.ok(Math.abs(u후 - 0.5) < 0.02, `중앙 지점이 밀렸다: u=${u후.toFixed(3)} (기대 0.5)`);
});
