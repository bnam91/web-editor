/* ══════════════════════════════════════════════════════════════════════
   FRAME-GEOMETRY — 프레임 «기하» SSOT (회전 AABB 높이보정 + 자식 정렬좌표)

   이 파일이 답하는 질문은 셋이다.
   ① 회전한 프레임이 «실제로 차지하는» 세로 공간은 얼마인가 (AABB)
   ② 프레임 «중앙(또는 좌/우·상/하)» 은 정확히 어느 좌표인가
   ③ 프레임 안에 «새로 만든» 텍스트의 글자정렬 기본값은 무엇인가 (2026-09-05 추가)

   ★왜 한 곳인가
   - ①은 이전까지 «어디에도 없었다» — transform 문자열만 3~4곳이 각자 조립하고
     레이아웃 박스는 회전 «전» 크기 그대로였다. 그래서 회전한 프레임이 섹션 높이를
     못 늘리고 export(섹션 offsetHeight 클립)에서 잘려나갔다.
   - ②는 props/prop-frame.js `_setAlign` 안에만 있었다. 삽입 경로(block-factory)가
     같은 계산을 «다시» 쓰면 두 벌이 된다 → 술어 하나로 묶는다.
   - ③은 「(a) 신규추가」와 「(b) 외부에서 들고 들어옴」을 «가르는 판정»이다. 이 판정이
     addTextBlock / addBlankTextBlock / 드롭 / 붙여넣기에 각자 복사되면 한 곳만 고쳐도
     나머지가 안 따라온다(이 레포에서 실제로 난 사고) → 술어 하나로 묶는다.

   ⚠️이 파일은 «순수 계산 + 얇은 DOM 어댑터» 다. 다른 모듈을 import 하지 않는다
     (단위테스트가 .mjs 별칭으로 «이 소스 그대로» 를 import 하기 때문).
══════════════════════════════════════════════════════════════════════ */

/* 회전한 사각형의 axis-aligned bounding box.
   w' = |w·cosθ| + |h·sinθ| ,  h' = |w·sinθ| + |h·cosθ| */
export function rotatedAABB(w, h, deg) {
  const W = Number(w) || 0, H = Number(h) || 0;
  const d = Number(deg) || 0;
  // ★deg 가 180의 배수면 AABB == 원본. 수식에 맡기면 Math.sin(Math.PI)=1.2e-16 때문에
  //   h' 가 h보다 «아주 조금» 커져서 ceil() 이 1px 을 만들어낸다 → 명시 분기.
  if (d % 180 === 0) return { w: W, h: H };
  const t = d * Math.PI / 180;
  const c = Math.abs(Math.cos(t)), s = Math.abs(Math.sin(t));
  return { w: W * c + H * s, h: W * s + H * c };
}

/* 회전으로 «위·아래로» 삐져나오는 양을 한쪽당 몇 px 로 메워야 하는가.
   프레임은 회전축이 중심이므로 위/아래가 같다 → ceil((h' - h) / 2).
   회전 0(또는 180의 배수)·비정상 입력이면 0. */
export function rotationMarginY(w, h, deg) {
  const H = Number(h) || 0;
  if (!H) return 0;
  const aabb = rotatedAABB(w, H, deg);
  return Math.max(0, Math.ceil((aabb.h - H) / 2));
}

/* 프레임 안에서 자식 하나를 정렬했을 때의 left/top.
   props/prop-frame.js `_setAlign`(자유배치 프레임 정렬 버튼)이 쓰던 식을 그대로 옮긴 것 —
   «프레임 중앙» 의 정의는 이 함수 하나다.
   alignX: 'flex-start' | 'center' | 'flex-end' | null(=계산 안 함)
   alignY: 'flex-start' | 'center' | 'flex-end' | null
   반환: { left, top } — 계산하지 않은 축은 null.
   ★클램프하지 않는다: 자식이 프레임보다 크면 음수가 나온다(기존 `_setAlign` 과 동일 계약). */
export function frameAlignOffset(frameW, frameH, elW, elH, alignX, alignY) {
  const fw = Number(frameW) || 0, fh = Number(frameH) || 0;
  const ew = Number(elW) || 0,    eh = Number(elH) || 0;
  const pick = (span, size, align) =>
    align === 'center'   ? Math.round((span - size) / 2)
  : align === 'flex-end' ? Math.round(span - size)
  : 0;
  return {
    left: alignX == null ? null : pick(fw, ew, alignX),
    top:  alignY == null ? null : pick(fh, eh, alignY),
  };
}

/* 같은 자리에 이미 형제가 있으면 대각선으로 비켜 놓을 좌표(붙여넣기 관례와 동일한 +20px).
   occupied: [{left, top}, …] (자기 자신 제외)
   tol: 같은 자리로 볼 오차(px) */
export function cascadeIfOccupied(left, top, occupied, step = 20, tol = 2, maxHops = 20) {
  let L = left, T = top;
  const list = Array.isArray(occupied) ? occupied : [];
  for (let i = 0; i < maxHops; i++) {
    const hit = list.some(o =>
      Math.abs((Number(o.left) || 0) - L) <= tol && Math.abs((Number(o.top) || 0) - T) <= tol);
    if (!hit) break;
    L += step; T += step;
  }
  return { left: L, top: T };
}

/* ══ ③ 프레임 «삽입» 계약 — (a) 신규추가 vs (b) 외부에서 들고 들어옴 ══
   현빈 지시(2026-09-05) 원문 계약 셋:
     (a) 프레임 안에 «새로» 텍스트 블록을 만들 때 → 글자 정렬도 중앙 + 좌표도 중앙
     (b) 외부에서 들고 들어올 때(드롭·붙여넣기·복제)  → 글자 정렬 «무접촉», 좌표만 중앙
     (c) 「중앙」의 기준 = 프레임블럭의 «보여지는» 가로너비
   ⇒ (a)/(b) 를 가르는 판정과 (c) 의 「보여지는 폭」 읽는 법을 여기 하나로 둔다. */

/* (a) 경로가 «새로 만든» 텍스트에 넣을 기본 글자정렬. */
export const FRAME_NEW_TEXT_ALIGN = 'center';

/* (a) 신규-추가 경로가 주입할 글자정렬을 판정한다.
   반환: 주입할 align 문자열 | null(= «아무것도 하지 마라», 기존 그대로)
   - explicitAlign 이 있으면 null — 호출자(MCP·API·오버레이 상속·사용자 지정)가 «이긴다».
     내가 덮으면 「align:'left' 로 넣었는데 가운데로 온다」가 된다.
   - hasExplicitCoords(opts.x/y/width 명시)면 null — 좌표를 «준» 호출은 (a)가 아니다.
     MCP·Figma 임포트가 원본 레이아웃을 «재현»하는 자리라서, 가운데정렬을 넣으면
     _clampTextFrameWidth 가 폭까지 100% 로 바꿔 임포트한 배치가 깨진다.
     P1 의 좌표 중앙배치가 쓰는 가드(hasAbsCoords)와 «같은 축»이다.
   - 자유배치(freeLayout) 프레임이 아니면 null — 섹션 «직접» 추가와 fullWidth(플로우)
     프레임은 이 지시의 대상이 아니다(둘 다 회귀 금지선).
   ⚠️(b) 경로(드롭·붙여넣기·복제)는 이 함수를 «부르지 않는다». 부르는 순간 계약 위반이다. */
export function newTextAlignInFrame(frameEl, explicitAlign, hasExplicitCoords) {
  if (explicitAlign) return null;
  if (hasExplicitCoords) return null;
  if (!frameEl || !frameEl.dataset || frameEl.dataset.freeLayout !== 'true') return null;
  return FRAME_NEW_TEXT_ALIGN;
}

/* (c) 프레임의 «보여지는» 가로/세로 — 절대배치 자식의 left/top 이 사는 좌표계.
   ★왜 clientWidth 인가 (2026-09-05 실측, tests/measure/frame-textcenter/02-axis.js)
     - getBoundingClientRect().width 는 «화면 픽셀»이다. 캔버스 줌은 #canvas-scaler 의
       transform:scale 이라 40% 줌에서 rect=344 / clientWidth=860 으로 갈린다.
       자식의 offsetWidth 는 스케일을 «안» 받으므로(200 그대로) rect 로 중앙을 내면
       left=72 (정답 330) — 258px 어긋난다. 두 축을 섞으면 안 된다.
     - dataset.width / style.width 는 «설정값»이다. max-width:100% 가 걸린 중첩 프레임에서
       dataset.width='860' 인데 실제로는 400 이었다(같은 실측). 「보여지는」이 아니다.
     - clientWidth 는 «패딩 박스» 폭이고, 절대배치 자식의 containing block 이 바로 그것이다
       (패딩40+테두리5 프레임 실측: offsetWidth 860 / clientWidth 850 ← 이쪽이 기준).
   ⇒ P1 의 좌표 중앙(_placeAtFrameCenter · _setAlign)이 쓰는 축과 «같은 축»이다. */
export function frameVisibleSize(frameEl) {
  return {
    w: (frameEl && frameEl.clientWidth) || 0,
    h: (frameEl && frameEl.clientHeight) || 0,
  };
}

/* 캐스케이드(+20 대각)가 «프레임 밖으로 밀어내지» 않게 X 를 안쪽으로 되돌린다.
   비킬 가로 여유가 0 이면(자식이 프레임 폭을 꽉 채움 — 가운데정렬 텍스트프레임의 width:100%)
   결과는 0 이 되어 X 캐스케이드가 «사라진다». 겹침 회피는 Y 캐스케이드가 계속 맡는다.
   실측 근거(2026-09-05 고치기 전): 폭 100% 텍스트프레임 둘째가 left:20px 이 되어
   오른쪽으로 20px 삐져나가고 중심이 20px 어긋났다. */
export function clampLeftIntoFrame(left, frameW, elW) {
  const maxL = Math.max(0, (Number(frameW) || 0) - (Number(elW) || 0));
  return Math.min(Number(left) || 0, maxL);
}

/* ── 얇은 DOM 어댑터 ─────────────────────────────────────────────── */

/* 회전 보정 마진을 적용/해제한다.
   ★«우리가 넣은 마진만» 걷어낸다(dataset.rotMarginY 표식).
     - 자유배치 프레임의 인라인은 `margin:0 auto` 라 style.marginTop 이 "0px"(truthy) 다.
       그걸 보고 removeProperty 하면 «회전한 적 없는» 모든 프레임의 outerHTML 이
       매 로드마다 longhand 로 재작성된다.
     - 배너 inner 프레임(blocks/banner-block.js)은 marginTop/Bottom 을 «자기 용도»로 쓴다.
       표식이 없으면 그것까지 지워버린다.
   sizeHint({w,h}) 를 주면 offset* 재측정(강제 리플로우) 없이 계산한다. */
export function applyFrameRotationMargin(ss, sizeHint) {
  if (!ss || !ss.style) return 0;
  // 절대배치 프레임(부모가 자유배치 프레임)은 마진이 레이아웃에 영향을 주지 않는다 → 보정 안 함.
  //   시각적 잘림은 CSS(.frame-block:has([data-rotation]) 등 overflow 해제)가 담당한다.
  const isAbs = ss.style.position === 'absolute';
  const deg = parseFloat(ss.dataset?.rotateDeg) || 0;
  const w = sizeHint ? (Number(sizeHint.w) || 0) : ss.offsetWidth;
  const h = sizeHint ? (Number(sizeHint.h) || 0) : ss.offsetHeight;
  const m = isAbs ? 0 : rotationMarginY(w, h, deg);
  if (m > 0) {
    ss.style.marginTop    = m + 'px';
    ss.style.marginBottom = m + 'px';
    ss.dataset.rotMarginY = String(m);
  } else if (ss.dataset && ss.dataset.rotMarginY != null) {
    ss.style.removeProperty('margin-top');
    ss.style.removeProperty('margin-bottom');
    delete ss.dataset.rotMarginY;
  }
  return m;
}

/* dataset(translateX/Y·rotateDeg·flipH/V) → transform 문자열.
   항등(아무 것도 안 걸림)이면 null. */
export function composeFrameTransformString(ss) {
  const d = (ss && ss.dataset) || {};
  const tx = parseInt(d.translateX) || 0;
  const ty = parseInt(d.translateY) || 0;
  const rd = parseFloat(d.rotateDeg) || 0;
  const fx = d.flipH === '1' ? -1 : 1;
  const fy = d.flipV === '1' ? -1 : 1;
  if (!tx && !ty && !rd && fx === 1 && fy === 1) return null;
  return `translate(${tx}px,${ty}px) rotate(${rd}deg) scale(${fx},${fy})`;
}

/* transform 합성 + 회전 마진 보정을 «한 번에». 프레임 transform 을 만지는 자리는 전부 이것만 부른다.

   ★identity(= translate0·rotate0·scale1,1) 일 때의 처리는 «호출부마다 원래 달랐다».
     세 정책을 하나로 합치면 그 자체가 회귀다 — 그래서 정책을 «인자»로 남긴다.
       'clear' — style.transform 제거      (overlay-handles.js 회전 드래그의 기존 규약)
       'write' — 항등 문자열을 그대로 기록  (props/prop-frame.js·block-factory MCP 의 기존 규약)
       'skip'  — 아무것도 안 함(기본)       (io/save-load.js 로드 경로의 기존 규약)
   ⚠️로드 경로가 'clear'/'write' 를 쓰면 안 되는 이유: transform 은 «스태킹 컨텍스트»를
     만든다. 이미 저장된 `rotate(0deg)` 잔재 프레임에서 제거/추가하면 자식 z 순서가
     전 프로젝트에서 조용히 바뀐다. 로드 경로는 «있는 그대로» 둔다.
   회전 마진 보정은 정책과 무관하게 «항상» 재계산된다(회전 0이면 no-op). */
export function applyFrameTransform(ss, opts) {
  if (!ss || !ss.style) return;
  const identity = (opts && opts.identity) || 'skip';
  const str = composeFrameTransformString(ss);
  if (str !== null) ss.style.transform = str;
  else if (identity === 'clear') ss.style.removeProperty('transform');
  else if (identity === 'write') ss.style.transform = 'translate(0px,0px) rotate(0deg) scale(1,1)';
  applyFrameRotationMargin(ss, opts && opts.sizeHint);
}
