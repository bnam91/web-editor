/* ═══════════════════════════════════════════════════════════════════════════
   ICB CHILDREN (G14, 현빈 2026-10-03 안 ㉢ 「원형이 그릇이 된다」 · 지디 GO 2026-10-04)
   서클 에셋블럭 = [블럭 .icon-circle-block] > [원 .icb-circle(배경·테두리·자르기)] > [그림 자리 + ★자식 그릇 .icb-children]

   ★그릇은 «자식이 하나라도 있을 때만» 있다 — 0개면 DOM 이 G14 이전과 바이트 같다(tests/dom/icb-children K0).
     빈 그릇이 남는 갈래(마지막 자식을 지운 직후)는 CSS `.icb-children:empty{display:none}` 로 자리를 안 먹는다.
   ★자식은 원 «위»에 얹힌다 — 그림(.icb-img / MCP 배경그림)은 원의 바닥이라 같이 산다(사진 위 글자).
     그림을 넣고 빼는 길(image-handling loadImageToCircle · clearCircleImage)이 그릇을 다시 붙인다.
   ★배치는 상수다(현빈: 패널 = 배경 + 「＋ 블럭 넣기」만 — 간격 손잡이·데이터 키 없음):
     가운데 · 세로 쌓기 · 간격 8px(캔버스 — 정본은 CSS 한 곳) · 그릇 폭 = 지름 × 1/√2(내접 정사각형 — 글자가 둥근 가장자리에 덜 잘린다).
     넘친 것은 원(.icb-circle overflow:hidden · radius 50%)이 «원 모양으로» 자른다 — 지름은 사람이 정한다(자식 따라 안 커진다).
     겉모습은 css/editor-blocks.css «ICON CIRCLE · G14 자식 그릇» 절.
   ★넣는 길은 하나 — block-factory addCircleChild → _insertToFlowFrame({into}) (G19 addGridChild 와 같은 길 · 새 길 금지).
   ⛔G19 grid-children.js 와 «합치지» 않는다(아직) — 박스 찾기·비우기 10줄 남짓이 겹치지만, 막 들어간 G19 판을 흔들지 않으려는 판단.
     G19 가 안정되면 공용화 리팩터를 따로 한다(G14-DESIGN R6).
   ⛔이 파일은 import 가 없다(G19 와 같은 다리 — window 로 부른다).
═══════════════════════════════════════════════════════════════════════════ */

/** 「＋ 블럭 넣기 ▾」 종류 — 이미지는 원 자체가 그림 자리라 «안» 넣는다 · 여백은 고정 간격이 맡는다. */
export const ICB_CHILD_KINDS = ['body', 'h2', 'icon'];
const KIDS = 'icb-children';

function _circleOf(el) {
  if (!el || !el.classList) return null;
  if (el.classList.contains('icb-circle')) return el;
  if (el.classList.contains('icon-circle-block')) {
    for (const ch of el.children) if (ch.classList.contains('icb-circle')) return ch;
  }
  return null;
}
/** 서클(블럭 또는 원)의 직계 그릇 — 없으면 null. */
export function icbKidsBox(el) {
  const c = _circleOf(el);
  if (!c) return null;
  for (const ch of c.children) if (ch.classList.contains(KIDS)) return ch;
  return null;
}
/** 그릇 안 «블럭» 자식(드롭 표시선 제외). */
export function icbKids(el) {
  const box = icbKidsBox(el);
  return box ? [...box.children].filter(c => !c.classList.contains('drop-indicator')) : [];
}
/** 그릇을 «있게» 한다(없으면 원 맨 끝에 만든다). ⛔자식을 넣기 «직전»에만 — 빈 그릇을 남기지 않게. */
export function ensureIcbKidsBox(el) {
  let box = icbKidsBox(el);
  if (box) return box;
  const c = _circleOf(el);
  if (!c) return null;
  box = document.createElement('div');
  box.className = KIDS;
  c.appendChild(box);
  return box;
}
/** 빈 그릇을 걷는다(요소 자식 0개일 때만). 걷었으면 true. */
export function pruneIcbKidsBox(box) {
  if (!box || !box.classList?.contains(KIDS) || box.childElementCount > 0) return false;
  box.remove();
  return true;
}
/** el 이 서클 그릇 «안»의 자식(또는 그 후손)인가 — 그 서클 블럭을 돌려준다. */
export function circleOfKid(el) {
  const box = el?.closest?.('.' + KIDS);
  return box ? box.closest('.icon-circle-block') : null;
}

if (typeof window !== 'undefined') {
  Object.assign(window, { icbKidsBox, icbKids, ensureIcbKidsBox, pruneIcbKidsBox, circleOfKid, ICB_CHILD_KINDS });
}
