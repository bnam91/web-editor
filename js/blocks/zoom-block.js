// ── Zoom Block (확대블럭) ────────────────────────────────────────────────────
// ★계열 = «스티커»(플로팅). 섹션의 «직접 자식»으로 absolute 로 떠 있다 — 행(row) 안에 넣지 않는다.
//   현빈 2026-09-08: 「왜 블럭 안에 있는 거야 스티커 블럭인데. 플로팅되어야 되는 거 아냐?」
//   ⛔전에는 row.appendChild 였고, 그 탓에 블록 상자가 «행 전체 폭»이라 선택 아웃라인이 도형과
//     상관없는 네모로 떴다. 그 증상을 「보조 선택상자를 하나 더 둔다」로 우회했는데 원인은 «계열»이었다.
//     ⇒ 증상을 보면 «왜 그 상태인가»를 한 겹 더 물어라. 여기가 그 기록이다.
//
// 도형(rect/circle/square) + 그 도형에서 «광원 쪽으로» 뻗는 그림자 사다리꼴.
// ★그림자는 라디오로 끌 수 있다 — 그래서 이 «하나»가 스티커 블록 둘을 대신한다.
//     끔 = 도형 + 테두리(에셋블럭 스티커) / 켬 = 도형 + 그림자(돋보기)
// 현빈 발주: 「스티커블럭 추가. 확대블럭이라고 해줘. 들어가야 할 모양은 기본은 사각형이다.
//            그리고 프리셋으로 원, 정사각형을 넣어줘」
//
// 기하·SVG 조립은 전부 ./zoom-geometry.js(순수) — 이 파일은 dataset 읽기·DOM·이벤트만 한다.
//
// ⛔이 블록이 «아직 못 하는 것» 둘 — 조용히 빠지는 것이라 여기 적어 둔다(지디 지시 2026-09-08).
//   ① MCP 표면이 없다 — main/claude-pm 의 BLOCK_TYPES 에 zoom 이 «없다»(add_/update_ 도구 미구현).
//      ⇒ ★클로드PM 으로는 확대블럭을 «못 만들고 못 고친다». 사람이 컴포넌트 메뉴로만 넣을 수 있다.
//      (읽기 이름만 js/canvas-state.js PFX 에 zmb_ 로 줬다. grid 가 먼저 간 길이다.
//       도구를 만들면 BLOCK_TYPES 에 넣고 tests/unit/block-prefix-sync.test.js 의 known 에서 빼라.)
//   ③ bdr(테두리 모서리 라운드)이 «실루엣 계산에 안 들어간다» — 실루엣은 꼭짓점 기준이다.
//      ⇒ 라운드를 크게 주면 그림자 사다리꼴이 붙는 점이 모서리에서 살짝 뜬다.
//      (지디 판정 2026-09-08: 지금 고치지 않는다. 고치려면 zoom-geometry.js 의
//       computeZoomGeometry 가 라운드된 모서리의 «접점»을 풀어야 한다.)
//   ② Figma export 분기가 없다 — js/io/export-figma-json.js 에 zoom 항목이 «없다».
//      ⇒ ★피그마로 업로드하면 확대블럭이 «조용히 빠진다»(오류도 안 난다). laurel 처럼 전용 분기가 필요하다.
//
// 의존성:
//   - bindBlock (drag-drop.js)
//   - window._clampToSection / _findSectionAt (sticker-select.js — 플로팅 좌표 규약을 공유한다)
//   - window.getSelectedSection / showNoSelectionHint / pushHistory / buildLayerPanel /
//     selectBlock / triggerAutoSave

import { bindBlock } from '../drag-drop.js';
// ★배율은 «한 곳»에서만 읽는다 — 베끼면 핸들과 갈라진다(overlay-handles.js 주석 참조).
import { _canvasScaleNow } from '../overlay-handles.js';
import { buildZoomInner, blockBoxSpec, computeZoomGeometry, hasZoomImage, ZOOM_CHECKER } from './zoom-geometry.js';

const ZOOM_DEFAULTS = {
  shape:  'rect',   // ★기본은 사각형. 프리셋 = rect | circle | square
  /* ★12시(수직 위) — 현빈 2026-09-08 「a·b 지점은 오른쪽에 두지 말고 12시 수직 위치에」.
     ⚠️이 좌표계는 y 가 «아래»로 증가한다. 추측하지 말고 재서 골랐다:
       angle  0 → L=(170,   0)  오른쪽    ·  angle  90 → L=(0,  170)  아래
       angle 180 → L=(-170,  0)  왼쪽     ·  ★angle -90 → L=(0, -170)  «위»
       실측 a=(30.40,-170) b=(-30.40,-170) — 둘이 같은 높이로 도형 «위»에 선다. */
  angle:  -90,      // 방향(도) — ★12시
  length: 170,      // 길이(px) — 도형 중심 ~ 광원
  spread: 0,        // A·B 벌림(px)
  maxop:  30,       // ★최대 농도(%)
  curve:  100,      // 농도 곡선(= pw 1.0)
  narrow: 62,       // 좁아짐(%)
  size:   260,      // ★도형 크기(px, 가로). 260 × 140 = 6.5:3.5 (현빈 2026-09-08)
  rot:    0,        // 도형 회전(도) — silhouette 이 받는 값
  /* ★기본 배경 = 체크패턴(현빈: 「다른 이미지에셋 들어갈 때처럼」).
     fill 이 'checker' 면 «색이 아니라 무늬»다 — 무늬는 .zoom-bg 가 CSS 로 그린다. */
  fill:   ZOOM_CHECKER,
  /* ★w/h = 크기의 «덧씌우개». 없으면 size + 프리셋 비율에서 파생된다(shapeHalf 주석 참조).
     핸들로 끌면 그때만 박힌다 — a·b 의 자동/고정과 «같은 구조»다. */
  w:      null,
  h:      null,
  /* ★그림자 라디오(현빈 2026-09-08) — 이 한 값이 블록 «둘»을 하나로 합친다.
       'off'(★기본) = 「에셋블럭 스티커」(도형 + 테두리) · 'on' = 「돋보기」(도형 + 그림자)
     ★현빈 2026-09-08: 「기본적으로 그림자는 Off 인 상태로」 — 스티커가 «먼저»고 돋보기가 옵션이다.
     ⛔off 여도 angle·length·maxop 는 «지우지 않는다». 다시 켜면 그대로 돌아와야 한다. */
  shadow: 'off',
  /* ★★도형 그림자(드롭섀도) — 위 `shadow`(광원)와 «완전히 다른 것»이다. 현빈 2026-09-08
       「그리고 줌블럭에 쉐도우 온오프 기능도 별도로 있도록 해줘」.
     ⛔같은 키를 나눠 쓰면 둘이 서로를 덮는다 ⇒ 키를 «따로» 둔다:
        dataset.shadow     = 'on'|'off'          — 돋보기 «광원 사다리꼴»(SVG 폴리곤)
        dataset.dropShadow = 'none'|'soft'|'strong' — 도형 «자체»가 드리우는 그림자(CSS)
     ★값 표는 mockup-block.js 의 shadows 를 «그대로» 빌렸다(단계 이름 none/soft/strong 까지).
       실측 근거 — 260×140(줌 기본)에서 도형 아래 띠의 가장 어두운 픽셀:
         끔 255 · soft 218(Δ37) · strong 184(Δ71)   ⇒ 그대로도 «충분히 보인다».
       크기를 줄인 후보(÷2·÷3)도 재 봤지만 soft 는 Δ36~39 로 차이가 없었다.
       ⇒ 두 번째 값 표를 만들 이유가 «측정에» 없다. 선례를 그대로 쓴다.
       (mockup 의 기본 폭도 220~520 이라 줌의 260 과 «같은 자릿수»다 — 잘못 맞춘 표가 아니다.)
     ★★그리는 자리는 CSS 다(css/editor-blocks.css). ⛔여기서 style.filter 를 쓰면 «안 된다» —
       renderZoomBlock 이 block.style.cssText 를 통째로 다시 쓴다(아래). 실측: 렌더 한 번에
       인라인 filter·CSS 변수가 둘 다 null 로 날아갔다. 그래서 «attribute» 를 운반체로 쓴다. */
  dropShadow: 'none',
  /* 테두리 — 원래 스티커 블록 A-1 의 「우측에서 테두리를 넣을 수 있다」가 여기로 들어왔다.
     그림자와 배타가 아니다(둘 다 켤 수 있다). ⛔도형 «바깥»에 그린다 — 크기가 줄면 안 된다. */
  bd:     'off',
  bdw:    6,        // 두께(px)
  bdc:    '#ffffff',// 색
  /* ★㉒ 이미지 — 도형 «안»에 담긴다(현빈: 「에셋블럭처럼 도형이라는 프레임 안에서 나오니
     도형이랑 같은 거 아닌가?」). 바깥 윤곽은 여전히 도형이라 기하는 «한 줄도» 안 바뀐다.
     ⛔체크패턴과 «같은 층»(.zoom-bg)이다 — 이미지가 들어오면 체크를 끈다(Export PNG 함정). */
  imgSrc: '',
  bdr:    0,        // 모서리(px) — 도형·테두리판이 «같이» 둥글어야 링 두께가 일정하다
  /* ★플로팅 좌표 — 섹션 좌상단 기준(px). 스티커와 «같은 규약»(dataset.x/y + style.left/top). */
  x:      40,
  y:      40,
};

const ZOOM_SHAPES = ['rect', 'circle', 'square'];
/** 도형 그림자의 단계 — mockup-block.js 의 shadows 표와 «같은 이름»이다(어휘를 둘로 만들지 않는다). */
const ZOOM_DROP_SHADOWS = ['none', 'soft', 'strong'];
/** 모르는 값이 들어오면 기본으로 떨어뜨린다 — _onOff 와 «같은 규율»(저장본 변조 대비). */
function _dropShadow(v, dflt) { return ZOOM_DROP_SHADOWS.includes(v) ? v : dflt; }
/** 라디오 두 벌의 값 — 모르는 값이 들어오면 기본으로 떨어뜨린다(저장본 변조 대비). */
function _onOff(v, dflt) { return (v === 'on' || v === 'off') ? v : dflt; }

/** w/h 는 «없음»이 뜻을 갖는다(=파생) — 0 이나 NaN 을 기본값으로 삼키면 안 된다. */
function _numOrNull(v) {
  const n = parseFloat(v);
  return (Number.isFinite(n) && n > 0) ? n : null;
}

function _num(v, dflt) {
  const n = parseFloat(v);
  return Number.isFinite(n) ? n : dflt;
}

/** dataset → 상태. ★여기가 «기본값이 사는 단 한 자리»다. */
function readZoomState(block) {
  const d = block.dataset || {};
  const shape = ZOOM_SHAPES.includes(d.shape) ? d.shape : ZOOM_DEFAULTS.shape;
  return {
    shape,
    angle:  _num(d.angle,  ZOOM_DEFAULTS.angle),
    length: _num(d.length, ZOOM_DEFAULTS.length),
    spread: _num(d.spread, ZOOM_DEFAULTS.spread),
    maxop:  _num(d.maxop,  ZOOM_DEFAULTS.maxop),
    curve:  _num(d.curve,  ZOOM_DEFAULTS.curve),
    narrow: _num(d.narrow, ZOOM_DEFAULTS.narrow),
    size:   _num(d.size,   ZOOM_DEFAULTS.size),
    rot:    _num(d.rot,    ZOOM_DEFAULTS.rot),
    fill:   d.fill || ZOOM_DEFAULTS.fill,
    imgSrc: d.imgSrc || ZOOM_DEFAULTS.imgSrc,
    w:      _numOrNull(d.w),
    h:      _numOrNull(d.h),
    x:      _num(d.x, ZOOM_DEFAULTS.x),
    y:      _num(d.y, ZOOM_DEFAULTS.y),
    shadow: _onOff(d.shadow, ZOOM_DEFAULTS.shadow),
    /* ⛔`shadow`(광원)를 «안 뺏는다» — 둘은 끝까지 다른 키다. */
    dropShadow: _dropShadow(d.dropShadow, ZOOM_DEFAULTS.dropShadow),
    bd:     _onOff(d.bd,     ZOOM_DEFAULTS.bd),
    bdw:    _num(d.bdw, ZOOM_DEFAULTS.bdw),
    bdc:    d.bdc || ZOOM_DEFAULTS.bdc,
    bdr:    _num(d.bdr, ZOOM_DEFAULTS.bdr),
  };
}

/* ★a·b 는 「끌기 전까지 «언제나» 자동」이다.
   한 번 고정해 두면 방향·길이를 바꿔도 안 따라와서 광원과 그림자가 «따로» 논다
   (현빈이 실제로 잡은 결함). ⇒ dataset 에 «네 값이 다 있을 때만» 사람이 끈 것으로 본다.
   끄는 «순간»에만 박는다(_pinShortEdge). */
function readPinnedShortEdge(block) {
  const d = block.dataset || {};
  const ax = parseFloat(d.ax), ay = parseFloat(d.ay);
  const bx = parseFloat(d.bx), by = parseFloat(d.by);
  if ([ax, ay, bx, by].every(Number.isFinite)) {
    return { a: { x: ax, y: ay }, b: { x: bx, y: by } };
  }
  return null;
}

/** 네 키를 지운다 = 다시 «언제나 자동». */
function clearPinnedShortEdge(block) {
  delete block.dataset.ax; delete block.dataset.ay;
  delete block.dataset.bx; delete block.dataset.by;
}

/** ★크기 덧씌우개를 지운다 = 다시 «size + 프리셋 비율». 프리셋 변경·size 슬라이더가 부른다. */
function clearZoomSizeOverride(block) {
  delete block.dataset.w;
  delete block.dataset.h;
}

function _pinShortEdge(block, a, b) {
  block.dataset.ax = a.x.toFixed(2); block.dataset.ay = a.y.toFixed(2);
  block.dataset.bx = b.x.toFixed(2); block.dataset.by = b.y.toFixed(2);
}

function renderZoomBlock(block) {
  const st = readZoomState(block);
  const box = blockBoxSpec(st);
  /* ★블록 «자신»이 도형(+테두리) 상자다 — 그래서 선택 오버레이가 이 상자의 border-radius 를
     그대로 읽어 «원이면 원»으로 그린다. 보조 상자가 필요 없다.
     ⚠️회전은 CSS transform 이 아니라 data-rotation 이다 — _cornerScreen 이 «그것»을 읽는다.
       transform 을 걸면 안에 든 SVG 까지 돌아 그림자 방향이 세계좌표를 벗어난다. */
  block.style.cssText =
    `position:absolute;left:${st.x}px;top:${st.y}px;` +
    `width:${box.w.toFixed(2)}px;height:${box.h.toFixed(2)}px;` +
    `border-radius:${box.radius};`;
  if (box.rot) block.dataset.rotation = String(box.rot);
  else delete block.dataset.rotation;
  /* ★이미지가 들어오면 체크무늬를 «끈다» — CSS(.zoom-block.has-image .zoom-bg)가 그걸 본다.
     ⛔안 끄면 투명 PNG 의 투명부로 체크가 비쳐 Export PNG 에 박힌다(현빈 실제 경험). */
  block.classList.toggle('has-image', hasZoomImage(st));

  // ★그림은 «순수 모듈»이 만든다(zoom-geometry.js) — 검사가 실제로 나가는 마크업을 그대로 잰다.
  block.innerHTML = buildZoomInner(st, readPinnedShortEdge(block), block._zoomPicked || null);
  _bindZoomHandleDrag(block);
  _bindZoomMoveDrag(block);
  /* ★섹션 밖 크롭 — 스티커 계열의 규약(css/editor-blocks.css 「섹션 밖 크롭」)을 같이 지킨다.
     ⛔단 클립은 «블록»이 아니라 «그리는 층»(.zoom-clip)에 건다 — 이유는 zoom-geometry.js
       buildZoomInner 주석 참조(블록에 걸면 안 잘리거나, 잘리는 순간 그림자가 도형에서 끊긴다).
     레이아웃이 끝나야 offset 이 나오므로 스티커와 같이 rAF 뒤에 잰다(sticker-block.js:126). */
  _scheduleZoomSecClip(block);
}

/* ★위치를 쓰는 «단 하나의» 자리 (⑲).
   지디 실측: 섹션 간 드래그 뒤 dataset.y=114 인데 style.top=960 이었고,
   960−114 = 846 = «그 섹션의 offsetTop» 이었다 — style 에 «캔버스 절대 y» 가 들어간 것이다.
   블록은 position:absolute 이고 offsetParent 가 섹션이라 top 은 «섹션 상대»여야 한다.
   ⛔막는 법: style 을 지역 변수에서 «따로» 쓰지 않는다. dataset 에 먼저 쓰고,
     style 은 «그 dataset 을 되읽어» 쓴다 ⇒ style 이 dataset 에 없는 값을 가질 수 «없다».
   ⚠️x 도 같은 길을 탄다 — 지금은 섹션들의 offsetLeft 가 같아 x 가 «우연히» 맞았을 뿐이다.
     섹션이 가로로 어긋나는 배치가 생기면 x 도 같은 방식으로 틀린다.
   (스티커도 같은 값을 쓰지만 «지역 변수»에서 각자 쓴다 — sticker-select.js:428~431.
    그쪽은 이 브랜치 밖이라 안 건드린다. 별건.) */
function _applyZoomPos(block, x, y) {
  block.dataset.x = String(Math.round(x));
  block.dataset.y = String(Math.round(y));
  block.style.left = block.dataset.x + 'px';
  block.style.top  = block.dataset.y + 'px';
}

/** 그리는 층을 찾아 «섹션 밖 크롭»을 다시 계산한다. 계산식은 스티커와 «같은 함수»를 쓴다. */
function updateZoomSecClip(block) {
  const layer = block.querySelector?.(':scope > .zoom-clip');
  if (layer) window._updateStickerSecClip?.(layer);
}

function _scheduleZoomSecClip(block) {
  if (typeof requestAnimationFrame === 'function') requestAnimationFrame(() => updateZoomSecClip(block));
  else updateZoomSecClip(block);
}

/* 위치 드래그 — 스티커와 «같은 규약»: dataset.x/y 에 쓰고 style.left/top 을 같이 민다.
   ⛔새로 만들지 않고 sticker-select.js 의 _clampToSection / _findSectionAt 을 쓴다.
   ⚠️a·b 핸들과 리사이즈 핸들 위에서는 «안» 잡는다(그쪽이 자기 드래그를 갖는다). */
function _bindZoomMoveDrag(block) {
  if (block._zoomMoveBound) return;
  block._zoomMoveBound = true;
  block.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (e.target.closest?.('.zoom-handle, .asset-overlay-handle')) return;
    // 앵커 밖을 누르면 집은 표시를 «푼다»(일러스트와 같다).
    if (block._zoomPicked) { block._zoomPicked = null; renderZoomBlock(block); }
    let sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = _canvasScaleNow() || 1;
    const r = block.getBoundingClientRect();
    const grabX = (e.clientX - r.left) / zoom;
    const grabY = (e.clientY - r.top) / zoom;
    let moved = false;

    const onMove = ev => {
      if (!moved) {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 2) return;
        moved = true;
        window.pushHistory?.('확대블럭 이동');
      }
      // ⌘ 드래그 = 자유 이동(섹션 경계 clamp 없이). 스티커와 같은 어휘.
      const free = ev.metaKey;
      const hover = (!free && window._findSectionAt) ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hover && hover !== sec) { hover.appendChild(block); sec = hover; }
      const sr = sec.getBoundingClientRect();
      const rawX = (ev.clientX - sr.left) / zoom - grabX;
      const rawY = (ev.clientY - sr.top) / zoom - grabY;
      const [cx, cy] = free
        ? [rawX, rawY]
        : (window._clampToSection?.(rawX, rawY, sec, block.offsetWidth, block.offsetHeight) || [rawX, rawY]);
      _applyZoomPos(block, cx, cy);   // ★위치는 «한 자리»에서만 쓴다(⑲)
      // 위치가 바뀌면 섹션 경계와의 관계도 바뀐다 — 스티커와 같이 드래그 중에도 갱신한다.
      updateZoomSecClip(block);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) window.triggerAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

/* a·b 핸들 드래그 — 끄는 «순간»에만 dataset 에 박는다.
   ★한쪽만 끌어도 «둘 다» 박는다: 읽기(readPinnedShortEdge)가 네 값을 한 묶음으로 보기 때문이다.
     안 박힌 쪽을 자동으로 두면 「반은 고정·반은 따라옴」이라 축이 어긋난다.
   좌표 변환은 «도형 중심 로컬»로 한다 — 드래그 도중 bbox 가 커져 viewBox 가 움직여도
   시작점 기준 델타는 안 흔들린다. 화면 배율(캔버스 줌)은 svg 실측폭/viewBox폭으로 나눈다. */
function _bindZoomHandleDrag(block) {
  if (block._zoomHandleBound) return;
  block._zoomHandleBound = true;
  block.addEventListener('mousedown', e => {
    const h = e.target.closest?.('.zoom-handle');
    if (!h || !block.contains(h)) return;
    if (!block.classList.contains('selected')) return;
    e.preventDefault(); e.stopImmediatePropagation();
    /* ★집은 앵커 표시(일러스트 관례) — 채움이 흰색 → 파란색. 누른 «하나»만이다.
       ⛔dataset 이 아니라 JS 속성이라 저장본에 안 실린다(조작 중 상태다).
       ⛔드래그가 끝나도 유지된다 — 일러스트가 그렇다. 블록의 다른 곳을 누르면 풀린다. */
    if (block._zoomPicked !== h.dataset.pt) {
      block._zoomPicked = h.dataset.pt;
      renderZoomBlock(block);
    }

    const svg = block.querySelector('.zoom-svg');
    const vbW = parseFloat(svg?.getAttribute('viewBox')?.split(/\s+/)[2] || '0');
    const rect = svg?.getBoundingClientRect();
    const scale = (rect && rect.width > 0 && vbW > 0) ? (rect.width / vbW) : 1;

    const which = h.dataset.pt;               // 'a' | 'b'
    const st = readZoomState(block);
    const geo = computeZoomGeometry(st, readPinnedShortEdge(block));
    const start = { a: { ...geo.a }, b: { ...geo.b } };
    const x0 = e.clientX, y0 = e.clientY;
    let moved = false;

    const onMove = ev => {
      const dx = (ev.clientX - x0) / scale, dy = (ev.clientY - y0) / scale;
      if (!moved && Math.hypot(dx, dy) < 1) return;
      if (!moved) { moved = true; window.pushHistory?.('확대블럭 짧은 변'); }
      const next = { a: { ...start.a }, b: { ...start.b } };
      next[which] = { x: start[which].x + dx, y: start[which].y + dy };
      _pinShortEdge(block, next.a, next.b);
      renderZoomBlock(block);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) {
        window.showZoomProperties?.(block);
        window.triggerAutoSave?.();
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

function makeZoomBlock(opts = {}) {
  const block = document.createElement('div');
  block.className = 'zoom-block';
  block.id = 'zmb_' + Math.random().toString(36).slice(2, 8);
  block.dataset.type = 'zoom';
  /* ★선택 오버레이에 «스티커 계열»(보라)임을 «스스로» 알린다.
     selection-overlay.js 에 블록 이름을 하나 더 적는 대신 블록이 자기 갈래를 들고 간다
     (그 파일 머리의 「블록 이름 목록을 두지 않는다」를 지키는 길). */
  block.dataset.selVariant = 'sticker';
  const shape = ZOOM_SHAPES.includes(opts.shape) ? opts.shape : ZOOM_DEFAULTS.shape;
  block.dataset.shape  = shape;
  block.dataset.angle  = String(opts.angle  ?? ZOOM_DEFAULTS.angle);
  block.dataset.length = String(opts.length ?? ZOOM_DEFAULTS.length);
  block.dataset.spread = String(opts.spread ?? ZOOM_DEFAULTS.spread);
  block.dataset.maxop  = String(opts.maxop  ?? ZOOM_DEFAULTS.maxop);
  block.dataset.curve  = String(opts.curve  ?? ZOOM_DEFAULTS.curve);
  block.dataset.narrow = String(opts.narrow ?? ZOOM_DEFAULTS.narrow);
  block.dataset.size   = String(opts.size   ?? ZOOM_DEFAULTS.size);
  block.dataset.rot    = String(opts.rot    ?? ZOOM_DEFAULTS.rot);
  block.dataset.fill   = String(opts.fill   ?? ZOOM_DEFAULTS.fill);
  block.dataset.shadow = _onOff(opts.shadow, ZOOM_DEFAULTS.shadow);
  block.dataset.bd     = _onOff(opts.bd,     ZOOM_DEFAULTS.bd);
  block.dataset.bdw    = String(opts.bdw    ?? ZOOM_DEFAULTS.bdw);
  block.dataset.bdc    = String(opts.bdc    ?? ZOOM_DEFAULTS.bdc);
  block.dataset.bdr    = String(opts.bdr    ?? ZOOM_DEFAULTS.bdr);
  block.dataset.x      = String(opts.x      ?? ZOOM_DEFAULTS.x);
  block.dataset.y      = String(opts.y      ?? ZOOM_DEFAULTS.y);
  // ⛔a·b 는 신규 생성 시 «절대» 박지 않는다 — 끌기 전까지 언제나 자동.
  renderZoomBlock(block);
  return block;   // ★행(row)을 만들지 않는다 — 플로팅이라 섹션 직접 자식이 된다
}

function addZoomBlock(opts = {}) {
  const selectedAny = document.querySelector('.zoom-block.selected, .sticker-block.selected, [class*="-block"].selected');
  const sec = window.getSelectedSection?.() || selectedAny?.closest('.section-block');
  if (!sec) { window.showNoSelectionHint?.(); return; }
  // 같은 자리 겹침 방지 — 스티커의 cascade 와 같은 어휘(24px 씩, 8칸 주기).
  if (opts.x == null && opts.y == null) {
    const n = sec.querySelectorAll('.zoom-block').length;
    opts = { ...opts, x: 40 + (n % 8) * 24, y: 40 + (n % 8) * 24 };
  }
  window.pushHistory?.('확대블럭 추가');
  const block = makeZoomBlock(opts);
  sec.appendChild(block);   // ★섹션 직접 자식 (absolute → 섹션 기준). 스티커와 같은 자리.
  bindBlock(block);
  window.buildLayerPanel?.();
  /* ★선택은 «캔버스 클릭 경로와 같은 두 줄»로 끝낸다 — block-drag.js 의 줌 click 핸들러가
   *   showZoomProperties + showHandlesFor 를 둘 다 부른다. 추가 경로에만 그게 빠져 있었다.
   * ⛔window.selectBlock 만으로는 안 된다: 그건 block-edit.js 의 «MCP 진입점»이라
   *   ⑴ 타입→패널 목록에 zoom 이 없어 showTextProperties 로 새고(패널이 "Section 01" 로 남는다)
   *   ⑵ showHandlesFor 를 아예 안 부른다 ⇒ 추가 직후 모서리 핸들이 0개였다(실측).
   *   선택 클래스·레이어 하이라이트는 그대로 selectBlock 이 맡는다. */
  try { window.selectBlock?.(block.id); } catch (_) {}
  try {
    window.showZoomProperties?.(block);
    window.showHandlesFor?.(block);
  } catch (_) {}
  block.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  window.triggerAutoSave?.();
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeZoomBlock          = makeZoomBlock;
window.addZoomBlock           = addZoomBlock;
window.renderZoomBlock        = renderZoomBlock;
window.readZoomState          = readZoomState;
window.readPinnedZoomShortEdge = readPinnedShortEdge;
window.clearPinnedZoomShortEdge = clearPinnedShortEdge;
window.clearZoomSizeOverride  = clearZoomSizeOverride;
window.updateZoomSecClip      = updateZoomSecClip;
window.ZOOM_DEFAULTS          = ZOOM_DEFAULTS;
window.ZOOM_SHAPES            = ZOOM_SHAPES;

export {
  makeZoomBlock,
  addZoomBlock,
  renderZoomBlock,
  readZoomState,
  readPinnedShortEdge,
  clearPinnedShortEdge,
  clearZoomSizeOverride,
  updateZoomSecClip,
  ZOOM_DEFAULTS,
  ZOOM_SHAPES,
};
