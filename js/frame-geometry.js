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

/* 블록이 «어떤 규약으로» 회전값을 갖든(프레임 rotateDeg / 에셋·텍스트 rotation /
   도형 shapeRotation) 화면상 회전각(deg)을 돌려준다. 없으면 0.
   ★2026-09-20(0920b-overlay-extend) — 원래 overlay-handles.js 안에만 있던 함수를 여기로
     옮겼다. 오버레이(플로팅) 공용 모듈(js/overlay-float.js)이 «같은 판정»을 써야 하는데,
     overlay-handles.js 는 grid-block/modal-block 까지 끌고 오는 무거운 모듈이라
     import 하면 DOM 하네스가 그 그래프를 통째로 서빙해야 한다. 이 파일은 «다른 모듈을
     import 하지 않는 순수 계산 + 얇은 DOM 어댑터»라 두 쪽 다 가볍게 쓸 수 있다.
     ⛔베끼지 마라 — 규약이 셋이라 한 곳만 고치면 도형(shapeRotation)만 조용히 빠진다. */
export function blockRotationDeg(el) {
  if (!el || el.nodeType !== 1 || !el.dataset) return 0;
  const d = el.dataset;
  let v = d.rotateDeg;
  if (v == null || v === '') v = d.rotation;
  if (v == null || v === '') v = d.shapeRotation;
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : 0;
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
export function frameAlignOffset(frameW, frameH, elW, elH, alignX, alignY, pad) {
  const fw = Number(frameW) || 0, fh = Number(frameH) || 0;
  const ew = Number(elW) || 0,    eh = Number(elH) || 0;
  const P = Object.assign({ l: 0, r: 0, t: 0, b: 0 }, pad || {});
  /* ★안쪽 여백(F5) — 자유 프레임의 자식은 절대배치라 CSS padding 이 «안 먹는다».
     left/top 의 원점은 패딩 상자 모서리이므로 여백만큼 «우리가» 안쪽으로 들인다.
     pad 를 안 주면 옛 계산 그대로(여백 0). */
  const pick = (span, size, align, lo, hi) =>
    align === 'center'   ? lo + Math.round((span - lo - hi - size) / 2)
  : align === 'flex-end' ? Math.round(span - hi - size)
  : lo;
  return {
    left: alignX == null ? null : pick(fw, ew, alignX, P.l, P.r),
    top:  alignY == null ? null : pick(fh, eh, alignY, P.t, P.b),
  };
}

/* 폭 100% 로 «들어가는» 자유 프레임 자식의 width — 안쪽 상자 폭(프레임 − 좌우 패딩).
   left 를 여백만큼 들였는데 폭이 100% 면 그만큼 오른쪽으로 «프레임 밖»에 나온다(F5 적대QA).
   여백 0 이면 '100%' 그대로(옛 계약). */
export function innerFullWidth(frameEl) {
  const p = framePadding(frameEl), n = p.l + p.r;
  return n > 0 ? `calc(100% - ${n}px)` : '100%';
}

/* 프레임 «안쪽 여백»(px) — 자유 프레임 자식 좌표 계산이 쓴다. 스택 프레임엔 필요 없다(CSS 가 먹는다). */
export function framePadding(frameEl) {
  if (!frameEl || typeof getComputedStyle !== 'function') return { l: 0, r: 0, t: 0, b: 0 };
  const cs = getComputedStyle(frameEl);
  return { l: parseFloat(cs.paddingLeft) || 0, r: parseFloat(cs.paddingRight) || 0,
           t: parseFloat(cs.paddingTop) || 0,  b: parseFloat(cs.paddingBottom) || 0 };
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

/* ══ ④-2 «끌고 다니는» 자식이 프레임 밖으로 못 나가게 죈다 (T-088, 2026-09-22) ══
   ④(아래 growFrameToFitChildren)가 «밖에서 들고 들어오는» 축이라면, 이쪽은 «이미 안에 있는
   자식을 끌어 옮기는» 축이다. 그 축에선 프레임을 키우지 않는다 — 크기는 사용자가 핸들로
   정한다(js/block-drag.js `_resizeFrameToFitChildren` 는 의도된 no-op). 대신 자식이
   overflow:hidden 너머로 못 가게 죈다. 안 그러면 자식이 «화면에서 사라진다».
   ⚠️위아래 «둘 다» 죈다 — 0 아래로도 못 간다(위로 밀어 넣어도 똑같이 잘린다).
   ⚠️자식이 프레임보다 «크면» max 가 음수가 된다 — 그땐 0(왼쪽·위 맞춤)이다.
     그래야 적어도 머리는 보인다. 음수를 그대로 쓰면 반대쪽으로 잘린다. */
/* ══ ④-3 «이 프레임이 ★정말 자르나» — ★죔을 걸 ★조건의 ★정본 한 자리 (2026-10-09) ══
   ★★왜 생겼나 — ★위 `clampChildIntoFrame` 의 머리말이 ★적은 까닭이 ★★죽었다:
     「`.frame-block` 은 `overflow:hidden`(css/editor-blocks.css:11)」 ⇒ ★★그 줄은 ★지금
     ★★`overflow: visible` 이다(2026-09-28 현빈 지시로 풀었다). ⇒ ★죔의 ★전제가 ★거짓이 됐다.
   ★★그 죽음을 ★레포가 ★★이미 ★두 자리에 적어 뒀다 —
     `js/drag-utils.js`(effectiveSectionPadX) · `js/props/prop-page.js`(assetFullBleedWidth).
     ★★세 번째 자리(`js/block-drag.js` 의 T-088 죔)만 ★안 고쳐져서 ★★현빈이 ★걸렸다
     (2026-10-09 「프레임 블럭 안에 텍스트 블럭들 넣고 ★이동하면 ★프레임 안에서만 있고
       ★★안 잘려 보인다 — ★잘려야 하는데」).
   ⇒ ★★그래서 ★판정을 ★★«여기 하나»로 모은다. ⛔부르는 쪽이 ★제 벌을 ★또 짓지 않게.

   ★★자르는 꼴은 ★★둘뿐이다 — ★`css/editor-blocks.css` 를 ★파싱해 ★전수로 셌다
     (2026-10-09 · 선택자에 frame ＋ 본문에 overflow 인 규칙 ★8건 · 양성대조 통과):
       ★`.frame-block { overflow: visible }`                        ← ★기본은 ★안 자른다
       ★`.frame-block[data-radius]:not([data-radius="0"])`  → hidden
       ★`.frame-block[data-clip-content="true"]`            → hidden !important
       ★나머지 5건은 ★visible 로 ★푸는 ★예외(도형선택·회전자식·그라데이션바·말풍선·텍스트선택)
     ⇒ ★아래 두 줄이 ★그 두 선택자를 ★«그대로» 옮긴 것이다. ★★CSS 가 바뀌면 ★여기부터 의심하라.
     ★그 쌍을 ★잠그는 자 = `tests/unit/frame-clips-predicate.test.mjs`(★CSS 를 ★읽어 ★견준다).
   ⛔computed 스타일로 ★재지 않는다 — ★이 함수는 ★검사에서 ★«가짜 DOM»으로도 불린다
     (`tests/unit/block-full-bleed.test.mjs` 의 makeEl). ★dataset 은 ★거기서도 산다.
     ★그리고 ★★위 ★예외 5건(:has(...selected) 등)은 ★★«고르는 동안만» 참이라 ★★죔의 조건으로
     ★쓰면 ★★고를 때마다 ★가둠이 ★흔들린다 — ⛔일부러 ★안 본다. */
/* ══ ★★★술어를 ★«둘»로 갈랐다 (2026-10-10 · 지디 판정) ══════════════════════════
   ★★왜 — ★예전엔 ★`frameClipsChildren` ★한 함수가 ★★«자르나(그림)»와 ★★«죄나(끌기 제한)»를
     ★★겸했다. ★★그 겸직이 ★★세 날짜가 ★서로를 ★깨 온 ★뿌리다 — ★이름이 ★하나라 ★둘을 ★따로 ★못 정했다:
       ★09-28 현빈 「밑변 너머로 나가면 ★사라진다」      ⇒ ★자르기를 ★껐다(＋죔도 같이 꺼졌다)
       ★10-09 현빈 「★안 잘려 보인다 — 잘려야 하는데」   ⇒ ★죔을 ★조건부로(＋자르기는 ★안 켰다)
       ★10-10 현빈 「프레임 밖은 ★안 보여야」            ⇒ ★자르기를 ★켠다(＋죔은 ★켜면 10-09 가 부활)
     ★★⇒ ★★«자르기 켬 ＋ 죔 끔»이 ★★셋을 ★동시에 ★세우는 ★유일한 조합이다. ★그러려면 ★이름이 ★둘이어야 한다.
   ★★⛔한 쪽을 ★다른 쪽에서 ★파생시키지 ★마라 — ★그게 ★겸직의 ★재발이다(지디 2026-10-10).
   ★잠그는 자: `tests/unit/frame-clips-predicate.test.mjs` — ★⒜는 ★CSS 와 ★견주고, ★⒝는 ★«안 죈다»를 단언한다.
   ══════════════════════════════════════════════════════════════════════════════ */

/* ⒜ ★★«그림을 ★자르나» — ★CSS 와 ★한 쌍이다(css/editor-blocks.css).
   ★★2026-10-10 부터 ★`.frame-block` ★기본이 ★`overflow: hidden` 이다 ⇒ ★★기본이 ★«자른다».
   ★★푸는 자리는 ★★하나뿐 — ★「내용 자르기」를 ★사람이 ★★끈 프레임(`data-clip-content="false"`).
     ⚠️★«속성 없음»은 ★★끔이 ★아니다(★기본=자름). ★★끔은 ★★명시 `'false'` 다 —
       ★예전엔 ★기본이 visible 이라 ★«끔 = 속성 삭제»였고, ★그 꼴을 그대로 두면 ★★토글이 ★먹통이 된다.
       ★실측(2026-10-10 · 현빈 proj_1791316848083): frame-block ★18개 중 ★`data-clip-content` ★1개 · 값 ★`"true"`
         ⇒ ★★현빈이 ★그 토글을 ★쓰고 계신다. ⇒ ★죽이지 ★않았다.
   ⛔computed 스타일로 ★재지 않는다 — ★가짜 DOM 검사에서도 불린다(이 파일 머리말의 그 까닭). */
export function frameClipsPaint(frameEl) {
  const d = frameEl && frameEl.dataset;
  if (!d) return false;
  return d.clipContent !== 'false';
}

/* ⒝ ★★«죄나» — ★★`phase` 를 ★인자로 받는다(지디 2026-10-10). ★★«언제 죄나»가 ★호출 자리에 ★드러나게.
     ★`'move'`(끌는 동안) → ★★언제나 ★거짓   ·   ★`'drop'`(놓는 순간) → ★기본 ★참
   ★★⛔«끌는 ★동안»에는 ★★누구도 ★죄지 ★않는다 — ★그 자리에 ★죔이 ★걸리면 ★★10-09 가 ★그대로 ★부활한다.
   ★★왜 ★함수로 ★두나(상수가 아니고) — ★★부르는 자리가 ★★«죔을 거는 ★유일한 문»이고,
     ★나중에 ★누군가 ★다시 ★참으로 만들려면 ★★여기 ★한 자리를 ★고쳐야 ★하게 묶어 둔다.
     ⇒ ★그 순간 ★`frame-clips-predicate` 의 ★⒝ 칸이 ★★빨개진다(★그게 ★10-09 의 ★지키는 자다).
   ★★까닭(현빈 10-09 실측): ★죔이 걸리면 ★「오른쪽 170px 끌어도 ★`style.left` 가 ★378px 에 ★물려 ★안 움직였다」
     (★프레임 폭 716 − 자식 338). ★음성대조로 ★왼쪽 150px 은 ★정확히 움직였다 ⇒ ★끌기가 죽은 게 아니라 ★죔이었다.
   ★★그래서 ★세 날짜가 ★★동시에 선다 — ★이 조합이 ★유일하다:
     ★끌는 동안 : ★안 죈다 ＋ ★CSS 가 자르기를 푼다(`:has(> .frame-child-dragging)`)  ⇒ ★★10-09 ＋ ★위치가 보인다
     ★★놓는 순간 : ★★안으로 ★되돌린다(이 술어)                                        ⇒ ★★09-28 / ★T-088
     ★놓은 뒤   : ★상시 자른다(CSS 기본 hidden)                                      ⇒ ★★10-10
   ★되돌리는 ★자리 = `js/block-drag.js` ★onUp 의 ★`if (moved)` 갈래 ★한 곳(★끌어내기 갈래는 ★★제외 — 그건 ★의도된 탈출이다).
   ★어디로 = ★★«가장 가까운 ★프레임 안 자리»(`clampChildIntoFrame` 이 ★축마다 ★최소 거리로 민다 · 지디 기본값). */
export const FRAME_DRAG_PHASES = Object.freeze(['move', 'drop']);
export function frameClampsDrag(frameEl, phase) {
  /* ★★⛔모르는 phase 는 ★★던진다(지디 2026-10-10) — ★새 호출자가 ★조용히 ★거짓을 받으면
     ★★죔이 ★안 걸린 것을 ★아무도 ★모른다. ★「영은 ★답이 아니다」의 ★그 자리. */
  if (!FRAME_DRAG_PHASES.includes(phase)) {
    throw new Error(`frameClampsDrag: 모르는 phase '${String(phase)}' — ${FRAME_DRAG_PHASES.join('|')} 중 하나여야 한다`);
  }
  /* ★★«끌는 ★동안»에는 ★★아무도 ★죄지 ★않는다 — ★현빈 10-09 「170px 끌어도 378 에 물린다」 */
  if (phase === 'move') return false;
  /* ★★★2026-10-10 ★3차 — ★★«놓는 순간»에도 ★★죄지 ★않는다. ★★★현빈 1010t1c1 이 ★그것을 ★요구했다.
   *
   * ★★현빈 원문 — 「★`ss_ts0he_7nn1lpm` … ★내용자르기가 ★활성화되어있음. ★이 상태에서 ★`tb_ts0he_lnv0uc6`
   *   이거를 ★★좌측 프레임 밖으로 ★일부 걸치게 ★이동시키려고 하는데 ★★이동이 ★안 되는 ★문제가 있다.
   *   ★드래그에서 ★프레임에 ★걸치게 두면 ★★제자리로 ★돌아오게 된다. ★내용자르기를 ★오프시키면 ★이동은 ★제대로 된다」
   *
   * ★★★«제자리»가 ★무엇인지 ★쟀다(⛔읽기만 · `proj_1791316848083` · 2026-10-10 10:31 판):
   *   그 자식의 감싸는 프레임 `ss_ts0he_tdvz1f6` 가 ★★`left: 0px` · `data-offset-x="0"` 다
   *   ⇒ ★`clampChildIntoFrame` 이 left 를 ★`[0, frameW−childW]` 로 죄니 ★★음수가 ★0 이 된다
   *   ⇒ ★★★«제자리로 ★돌아온다»의 ★«제자리»가 ★★정확히 ★그 ★0 이다 — ★글자까지 맞는다
   *
   * ★★★그리고 ★★내 ② 가 ★★회귀를 ★냈다 — ★이 줄의 ★★참 분모다:
   *   ② 전 `frameClipsChildren`: `clipContent === 'true'` ⇒ ★속성 ★없음 = ★★false(안 죔)
   *   ② 후 이 술어          : `clipContent !== 'false'` ⇒ ★속성 ★없음 = ★★true(★죔)
   *   ⇒ ★★즉 ★기본을 ★자름으로 돌릴 때 ★★죔도 ★같이 ★켰다. ★★되돌린다.
   *
   * ★★★«09-30 결정과 ★부딪치나»를 ★★먼저 쟀다 — ★★부딪치지 ★않는다(지디 조건 ㉡):
   *   ★09-30(`0e078679` · 현빈 「내용 자르기」)이 ★건드린 파일 ★9벌 중
   *     ★★`js/frame-geometry.js` · `js/block-drag.js` = ★★★0 줄 ⇒ ★★죔에 ★아무 말도 ★안 했다
   *   ★죔이 ★`clipContent` 를 ★읽게 ★된 것은 ★★`1be9cc60`(★2026-10-09) 이고,
   *     ★그 커밋의 목적은 「★안 자르면 ★넘치게 둔다」 = ★★죔을 ★줄이는 방향이었다 ⇒ ★★이번은 ★더 간다
   *   ⇒ ★판정: ★09-30 = ★★«그림» 단계(CSS ＋ 패널) · ★죔 = ★★«이동» 단계(이 파일) ⇒ ★★다른 단계다
   *
   * ★★★왜 ★죔이 ★이제 ★필요 ★없나 — ★★자름이 ★★실제로 ★섰기 때문이다:
   *   ★1009t1-① 의 불만은 ★★«밖이 ★보인다»였고, ★그때는 ★기본이 `overflow: visible` 이라
   *   ★★죔이 ★그것을 ★막는 ★유일한 수단이었다. ★★제 ② 가 ★자름을 세웠다 ⇒ ★★밖은 ★안 보인다
   *   ⇒ ★★★«자름은 ★가린다, ★밀지 ★않는다» ⇒ ★죔은 ★★남는 것이다.
   *
   * ⛔되돌리려면 ★이 한 줄을 ★`return d && d.dataset && d.dataset.clipContent !== 'false'` 로 두면 된다.
   *   ★★그 순간 ★★아래 명부가 ★★전부 ★빨개진다 — ★그게 ★★이 결정의 ★지키는 자다:
   *   ★유닛 `frame-clips-predicate` D1 · D1c
   *   ★DOM  `K2-drop` · `K2b`(값) · `K3` · `K4`(값) · `E1` · `E1c` · `E2` · `E3` · `E4` · `F6` · `F6c`
   *   ⇒ ★★11 칸(★그중 ★9 는 ★전부 뒤집히고 ★2 는 ★값만 — ★그림 단언은 ★그대로 선다) */
  return false;
}

export function clampChildIntoFrame(left, top, elW, elH, frameW, frameH, pad) {
  const P = Object.assign({ l: 0, r: 0, t: 0, b: 0 }, pad || {});
  const one = (v, extent, size, lo, hi) => {
    const max = Math.max(0, (Number(extent) || 0) - hi - (Number(size) || 0));
    return Math.max(0, lo, Math.min(max, Number(v) || 0));   // 여백(lo)이 바닥 — 자식이 더 커도 머리는 여백 자리
  };
  return { left: one(left, frameW, elW, P.l, P.r), top: one(top, frameH, elH, P.t, P.b) };
}

/* ══ ④ 프레임이 «자식을 잘라 먹지» 않는 최소 높이 (T-088, 2026-09-21) ══
   .frame-block 은 `overflow:hidden`(css/editor-blocks.css:11) 이다. 자유배치 프레임은
   높이가 «고정값»이라, 밖에서 블록을 끌어 넣으면 드롭 경로가 그 블록을 맨 아래로 쌓아
   놓고도 프레임은 그대로 둔다 ⇒ 쌓인 자리가 프레임 밑변을 넘으면 «화면에서 사라진다».
   (실측 2026-09-21: 그룹 height 120px, 끌어 넣은 제목이 top:148px → 보이지 않고
    선택 테두리만 섹션 밖에 떴다. 값은 저장본에 그대로 남아 있었다 — 소실은 아니다.)
   ★이름표로 판정하지 않는다 — 「그룹이냐/배너냐/카드냐」를 세지 않고, «절대배치 자식의
     아래끝»이라는 성질 하나로만 잰다. */

/* 절대배치 자식들이 차지하는 세로 끝(px). boxes = [{top, height}, …]. 없으면 0. */
export function absChildrenBottom(boxes) {
  return (Array.isArray(boxes) ? boxes : []).reduce(
    (m, b) => Math.max(m, (Number(b && b.top) || 0) + (Number(b && b.height) || 0)), 0);
}

/* 프레임의 «잘라 먹지 않는» 높이.
   chrome = 패딩+테두리(= offsetHeight − clientHeight). 절대배치 자식의 top 은 패딩박스
   기준이므로 그만큼 더해야 한다.
   ⚠️절대 «줄이지» 않는다 — 사용자가 핸들로 키워 둔 프레임을 드롭이 몰래 줄이면
     그건 또 다른 소실이다. 그래서 현재 높이와의 max 다. */
export function frameFitHeight(currentH, childrenBottom, chrome) {
  const cur  = Math.max(0, Number(currentH) || 0);
  const need = Math.max(0, Number(childrenBottom) || 0) + Math.max(0, Number(chrome) || 0);
  return Math.max(cur, Math.ceil(need));
}

/* ── 호스트 아래여백 — «나눠 쓰는 자»가 둘 이상인 한 자리 ──────────── */

/** ★이 자리(흐름 안 상자의 margin-bottom)를 «나눠 쓰는 자» 명부 — 하나뿐인 참값.
 *    rotMarginY = 회전 AABB 보정(이 파일)  ·  rfMarginY = 바닥 반사 여백(js/effects-reflect.js)
 *  ⛔합을 다른 파일에 «손으로» 적지 마라. 2026-10-06 조사(GD-FXMENU)에서 같은 합이 여기와
 *    js/effects-reflect.js _setHostMargin 두 곳에 적혀 있었다 — 셋째 쓰는 자가 생기면 한쪽만 늙는다.
 *  ⇒ 쓰는 자가 늘면 ★이 배열에 한 줄만 더한다(그리고 그 자는 «자기 키»만 세운다).
 *  ⛔경고 주석으로 막지 않는다 — 합을 «파생»시켜 둘째 명부가 생길 자리를 없앴다. */
export const HOST_MARGIN_Y_KEYS = ['rotMarginY', 'rfMarginY'];

/** 그 상자의 아래 여백 «합» — 명부에서 파생한다(손으로 더하지 않는다). */
export function hostMarginY(host) {
  const ds = (host && host.dataset) || {};
  let sum = 0;
  for (const k of HOST_MARGIN_Y_KEYS) { const n = Number(ds[k]); if (Number.isFinite(n) && n > 0) sum += n; }
  return sum;
}

/** 합을 style 에 민다. ★쓰는 자는 «자기 키»를 세우거나 지운 «뒤» 이것을 부른다.
 *  ⛔자기 키를 안 건드린 채로 부르지 마라 — 남이 자기 용도로 쓰는 margin-bottom(배너 inner 등)을 걷는다. */
export function applyHostMarginY(host) {
  if (!host || !host.style) return 0;
  const total = hostMarginY(host);
  if (total > 0) host.style.marginBottom = total + 'px';
  else {
    host.style.removeProperty('margin-bottom');
    /* 우리가 걷어서 style 이 «빈 속성»만 남으면 속성째 지운다 — 켜기 전과 바이트 같게. */
    if (host.getAttribute && host.getAttribute('style') === '') host.removeAttribute('style');
  }
  return total;
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
  /* ★E1 Effects(2026-10-04) — 도형 래퍼의 margin-bottom 은 «반사 여백»(dataset.rfMarginY)과 «같은 자리»다.
     ⇒ 여기선 «우리 키»(rotMarginY)만 세우거나 지우고, 합은 applyHostMarginY 가 HOST_MARGIN_Y_KEYS 에서 파생한다.
     ⛔ 표식이 없을 때는 부르지 않는다 — 배너 inner 가 «자기 용도»로 쓰는 margin-bottom 을 걷지 않게(④-c·④-d). */
  if (m > 0) {
    ss.style.marginTop    = m + 'px';
    ss.dataset.rotMarginY = String(m);
    applyHostMarginY(ss);
  } else if (ss.dataset && ss.dataset.rotMarginY != null) {
    ss.style.removeProperty('margin-top');
    delete ss.dataset.rotMarginY;
    applyHostMarginY(ss);
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

/* ④의 DOM 어댑터 — 자유배치 프레임이 절대배치 자식을 자르지 않도록 높이를 «넓힌다».
   반환: 실제로 넓힌 프레임 수(0 = 손댄 것 없음).
   ★조상까지 올라간다 — 그룹 안의 그룹이면 안쪽을 넓히는 순간 바깥이 자르기 시작한다.
     같은 성질 판정을 한 번 더 적용하는 것뿐이라 명부가 아니다.
   ★쓰는 세 값은 이 레포의 기존 프레임 리사이즈 규약 그대로다
     (block-drag.js 리사이즈 핸들·overlay-handles.js 와 같은 줄):
       style.height · style.minHeight · dataset.height
     dataset.height 를 빼면 undo/redo·재로드가 옛 높이로 되돌려 증상이 되살아난다. */
export function growFrameToFitChildren(frameEl) {
  let grown = 0;
  let el = frameEl;
  while (el && el.nodeType === 1 && el.dataset && el.dataset.freeLayout === 'true') {
    const boxes = [...el.children]
      .filter(c => c.nodeType === 1 && c.style && c.style.position === 'absolute')
      .map(c => ({ top: parseFloat(c.style.top) || 0, height: c.offsetHeight || 0 }));
    if (boxes.length) {
      const curH   = el.offsetHeight || 0;
      const chrome = Math.max(0, curH - (el.clientHeight || 0));
      const newH   = frameFitHeight(curH, absChildrenBottom(boxes), chrome);
      if (newH > curH) {
        el.style.height    = `${newH}px`;
        el.style.minHeight = `${newH}px`;
        el.dataset.height  = String(newH);
        grown++;
      }
    }
    el = el.parentElement && el.parentElement.closest
      ? el.parentElement.closest('.frame-block[data-free-layout]')
      : null;
  }
  return grown;
}

/* ── ④ 스택 프레임의 가로 정렬을 «자식 하나»에 입힌다 (E122 · 2026-10-05) ────────────────
 * ★정렬 단추(prop-frame.js _setAlign)와 «새로 넣는 길»(block-factory.js _appendFlowChild · addShapeBlock)이 같은 한 벌을 쓴다.
 *   예전엔 단추 안에만 있어서, 「왼쪽」을 누른 프레임에 새 에셋을 넣으면 그 에셋은 자기 기본값(align-self:center)으로 가운데에 섰다.
 * 규칙(F4, 2026-10-03 실측 — 단추에 있던 그대로 옮김):
 *   ① 직계 비-row 자식 → align-self 를 같은 값 ② row[stack] → row 자신(align-self·margin) + «row 안 직계 자식» align-self
 *   ③ row[flex]·레이아웃 미지정 → justify-content(사용자가 준 space-* 분배는 안 덮음) ④ row[grid] → 손대지 않음
 *   asset-block 은 dataset.align 도 맞춘다(안 맞추면 폭 바꿀 때 prop-asset 이 옛 정렬로 되돌린다). 갭·리사이즈 손잡이·absolute 는 건너뜀.
 * @param {string} alignItems 'flex-start' | 'center' | 'flex-end' */
export function applyFrameHAlignToChild(child, alignItems) {
  if (!child || !child.classList) return;
  const selfOf   = { 'flex-start': 'flex-start', 'center': 'center', 'flex-end': 'flex-end' };
  const marginOf = { 'flex-start': '0',          'center': '0 auto',  'flex-end': '0' };
  const alignKey = { 'flex-start': 'left',       'center': 'center',   'flex-end': 'right' };
  const setSelf = (el) => {
    if (el.classList.contains('gap-block') || el.classList.contains('frame-resize-handle')) return;
    if (getComputedStyle(el).position === 'absolute') return;
    el.style.alignSelf = selfOf[alignItems] || '';
    if (el.classList.contains('asset-block') && el.dataset.align) el.dataset.align = alignKey[alignItems] || el.dataset.align;
    /* ★E133 — 자기 CSS 가 `margin: 0 auto` 인 블럭(아이콘 .icon-block · 심플카드 .canvas-block 등)은 auto 마진이 align-self 를 이긴다
       (실측: 왼/오 눌러도 Icon 326/326 · Card 178/178). ⇒ «인라인 마진이 없고 계산 좌우가 같고 > 0» 이면 정렬을 인라인 마진으로 싣는다.
       이미 이 갈래가 쓴 짝(0/auto · auto/0)이면 다시 눌러도 바꾼다 · 가운데 = 비움(CSS auto 로 돌아감). 그 밖(풀블리드 음수 마진 등)은 안 건드린다. */
    const _ml = el.style.marginLeft, _mr = el.style.marginRight;
    const _ours = (_ml === '0px' && _mr === 'auto') || (_ml === 'auto' && _mr === '0px');
    let _autoCentered = false;
    if (!_ml && !_mr) { const cs = getComputedStyle(el); const l = parseFloat(cs.marginLeft) || 0, r = parseFloat(cs.marginRight) || 0; _autoCentered = l > 0 && Math.abs(l - r) < 0.5; }
    if (_ours || _autoCentered) {
      if (alignItems === 'flex-start') { el.style.marginLeft = '0px'; el.style.marginRight = 'auto'; }
      else if (alignItems === 'flex-end') { el.style.marginLeft = 'auto'; el.style.marginRight = '0px'; }
      else { el.style.marginLeft = ''; el.style.marginRight = ''; }
    }
  };
  if (child.classList.contains('row')) {
    child.style.alignSelf = selfOf[alignItems] || '';
    child.style.margin    = marginOf[alignItems] || '0';
    const lay = child.dataset.layout;
    if (lay === 'stack') [...child.children].forEach(setSelf);
    else if (lay !== 'grid' && !/^space-/.test(child.style.justifyContent)) child.style.justifyContent = alignItems === 'center' ? 'center' : (alignItems === 'flex-end' ? 'flex-end' : '');
  } else {
    setSelf(child);
  }
}

/* ── ⑤ E135(2026-10-06) — «넣어진 자리의 부모»가 정렬을 준 스택 프레임이면 그 정렬을 입힌다 ──────────────
 * ★E122 의 _followFrameHAlign(block-factory.js) 과 같은 규칙 — 부모를 «스스로» 찾는 꼴이라 넣는 길 어디서나 한 줄로 부른다.
 *   E122 공용을 안 거치던 길(코드독해 · E122 README «못 보는 꼴»): 붙여넣기(editor.js) · 템플릿 넣기(drag-utils.js insertAfterSelected 프레임 갈래) ·
 *   T▾ fullWidth(block-factory.js addTextBlock). 프레임 안으로 끌어 넣기(block-drag.js)는 그 레인 몫.
 *   dataset.alignItems 가 «있을 때만» · 자유배치·글자 프레임 제외(좌표 갈래 / 래퍼) — E122 와 같은 문. */
export function followHostFrameHAlign(el) {
  const host = el && el.parentElement;
  if (!host || !host.classList || !host.classList.contains('frame-block')) return;
  if (host.dataset.freeLayout === 'true' || host.dataset.textFrame === 'true') return;
  const ai = host.dataset.alignItems;
  if (ai === 'flex-start' || ai === 'center' || ai === 'flex-end') applyFrameHAlignToChild(el, ai);
}
if (typeof window !== 'undefined') window.followHostFrameHAlign = followHostFrameHAlign;

/* ══ ★글자틀의 «내용 폭»을 ★px 로 — ★★「1줄이 ★2줄로 바뀐다」의 ★정본 ★한 자리 (2026-10-10) ══
   ★★왜 생겼나 — ★부르는 ★두 자리가 ★«offsetWidth 를 정수로 반올림한 값» 로 쟀다. ★`offsetWidth` 는 ★★정수다:
     ★자연폭이 ★357.34 인데 ★357 을 박으면 ★★0.34px ★모자라 ★★글자가 ★한 줄에 ★안 들어간다.
   ★★실측(2026-10-10 · 표본 8×3=24 · 크로미움 ★진짜 마우스 끌기):
     ★«버린양»(자연폭 − offsetWidth)의 ★★부호가 ★★완벽히 갈랐다 — ★양수 ★6/6 → ★2줄 · ★음수 ★18/18 → ★1줄
     ★현빈 원문 「본문 내용을 입력하세요.」 ★357.34→357(+0.34) ⇒ ★2줄 · 「…입력하세요」 ★347.33→347(+0.33) ⇒ ★2줄
   ★★⛔`getBoundingClientRect().width` 로 ★소수를 재지 ★마라 — ★그 값은 ★★`#canvas-scaler` 의
     ★`transform: scale()` 이 ★★곱해진 ★뷰포트 값이다(★배율 40% 면 ★357 이 ★143 로 온다).
     ★그 길로 가려면 ★`_canvasScaleNow()`(js/overlay-handles.js)로 ★나눠야 하고 ★틀릴 자리가 ★하나 는다.
   ★★⇒ ★그래서 ★★«증상»을 ★직접 잰다 — ★정수로 ★내려 박았을 때 ★★높이가 ★늘었나(= ★줄이 ★늘었나).
     ★높이는 ★`offsetHeight`(★레이아웃 px · ★★배율 무관 · ★박스모델 무관)라 ★위 함정을 ★안 밟는다.
   ★★⇒ ★늘었을 ★때만 ★1px 더한다. ★⛔아니면 ★한 픽셀도 ★안 건드린다 — ★실측 24표본 중 ★18은 ★예전과 ★같은 값이다.
   ⚠️★이 파일의 ★다른 함수와 ★달리 ★★«진짜 DOM»이 ★필요하다(offsetWidth/offsetHeight 를 읽는다).
     ★⛔가짜 DOM 검사에서 ★부르지 마라(이 파일 머리말의 그 까닭).
   ★★부르는 자 ★둘 — `js/block-drag.js` `_fitFullWidthTextFrame` · `js/block-factory.js` `_clampTextFrameWidth`
     ★⛔세 번째 ★사본을 ★짓지 마라. ★★이 본문을 ★무력화하면 ★그 ★둘이 ★다 빨개져야 한다(검사가 그 쌍을 잠근다). */
export function fitContentWidthPx(tf) {
  if (!tf || !tf.style) return 0;
  const prev = tf.style.width;
  tf.style.width = 'fit-content';
  const w0 = Math.round(tf.offsetWidth);
  const h0 = tf.offsetHeight;                    /* ★자연폭에서의 높이 = ★줄 수의 대리자 */
  if (!(w0 > 1)) { tf.style.width = prev; return 0; }
  tf.style.width = w0 + 'px';
  const grew = tf.offsetHeight > h0;             /* ★내림 때문에 ★줄이 늘었다 */
  tf.style.width = prev;
  return grew ? w0 + 1 : w0;
}
