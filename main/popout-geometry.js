/* ═══════════════════════════════════════════════════════════════════════════
   main/popout-geometry.js — 「패널을 떼어낸다」의 «기하» 계산 한 곳.
   ───────────────────────────────────────────────────────────────────────────
   ★왜 별도 파일인가
     이 계산은 main.js 안에 두면 «영원히 못 잰다» — Electron main 을 유닛테스트에서 띄울 수 없고,
     _ipc-harness 의 BrowserWindow 스텁은 옵션을 흘려버린다. 그래서 계산만 «순수 함수»로 떼어
     테스트가 진짜로 «실행»해서 재게 한다(소스 문자열 단언은 로직이 망가져도 초록이다).

   ★무엇을 지키나 — 렌더러가 보낸 값은 «믿을 수 없다»
     렌더러는 언제든 숫자가 아닌 것·NaN·음수·화면 밖 좌표를 보낼 수 있다(버그로든, 장난으로든).
     창이 화면 «밖»에 뜨면 ⛔frame:false 라 신호등이 없어서 «잡을 데가 아예 없다» — 사용자는
     그 창을 옮길 수도 닫을 수도 없다. 그래서 여기서 «작업영역 안»으로 강제로 끌어들인다.

   계약: resolvePopoutBounds(req, workArea) →
           { width, height, x, y, centered:false }   자리까지 정했다
         | { width, height, centered:true }          크기만 정했다(자리는 호출자가 center 로)
   ⛔던지지 않는다. 무엇이 들어와도 «띄울 수 있는» 값이 나온다. */
'use strict';

/* 앱 안 패널의 기본 폭(css/editor-extra.css #tpl-browser)과 짝이다. 크기를 «못 받았을 때»만 쓴다. */
const DEFAULT_W = 420;
const DEFAULT_H = 720;
/* 이보다 작으면 헤더 버튼이 서로 겹쳐 «되돌리기»조차 못 누른다 — 탈출구를 지키는 하한이다. */
const MIN_W = 320;
const MIN_H = 360;

const _fin = (v) => (typeof v === 'number' && Number.isFinite(v)) ? v : null;

/** 작업영역이 «쓸 만한가». 아니면 null — 그 경우 자리를 포기하고 중앙으로 물러난다. */
function _workArea(wa) {
  if (!wa || typeof wa !== 'object') return null;
  const x = _fin(wa.x), y = _fin(wa.y), w = _fin(wa.width), h = _fin(wa.height);
  if (x === null || y === null || w === null || h === null) return null;
  /* ★하한보다 좁은 작업영역은 «없는 셈» 친다. 그대로 쓰면 창을 MIN 아래로 찌그러뜨리게 된다. */
  if (w < MIN_W || h < MIN_H) return null;
  return { x, y, width: w, height: h };
}

/**
 * @param {any} req      렌더러가 보낸 {width,height,x,y} — ★신뢰하지 않는다
 * @param {any} workArea 화면 작업영역 {x,y,width,height} — 없으면 자리를 포기한다
 */
function resolvePopoutBounds(req, workArea) {
  const wa = _workArea(workArea);
  const rq = (req && typeof req === 'object') ? req : {};

  /* ── 크기 ── 없으면 기본값, 있으면 하한으로 «올리고» 작업영역으로 «내린다» ── */
  let w = _fin(rq.width), h = _fin(rq.height);
  w = (w === null) ? DEFAULT_W : Math.round(w);
  h = (h === null) ? DEFAULT_H : Math.round(h);
  w = Math.max(MIN_W, w);
  h = Math.max(MIN_H, h);
  if (wa) { w = Math.min(w, wa.width); h = Math.min(h, wa.height); }

  /* ── 자리 ── 하나라도 못 읽으면 «둘 다» 버린다. 반쪽 좌표는 중앙보다 나쁘다 ── */
  const x0 = _fin(rq.x), y0 = _fin(rq.y);
  if (x0 === null || y0 === null || !wa) return { width: w, height: h, centered: true };

  /* ★창 «전체»가 작업영역 안에 들어오게 민다. w ≤ wa.width 가 위에서 보장돼 있어
     아래 상한(wa.x + wa.width - w)이 하한(wa.x)보다 작아질 수 없다. */
  const x = Math.min(Math.max(Math.round(x0), wa.x), wa.x + wa.width  - w);
  const y = Math.min(Math.max(Math.round(y0), wa.y), wa.y + wa.height - h);
  return { width: w, height: h, x, y, centered: false };
}

module.exports = {
  resolvePopoutBounds,
  POPOUT_DEFAULT_W: DEFAULT_W,
  POPOUT_DEFAULT_H: DEFAULT_H,
  POPOUT_MIN_W: MIN_W,
  POPOUT_MIN_H: MIN_H,
};
