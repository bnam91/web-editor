/* ═══════════════════════════════════════════════════════════════════════════
   overlay-float.js — «오버레이(플로팅)» 공용 모듈 (텍스트 · 도형 · 에셋)
   ───────────────────────────────────────────────────────────────────────────
   «오버레이» = Figma 의 Ignore Auto Layout. 오토레이아웃(row/frame) 흐름에 속한 블록을
   흐름에서 빼서 섹션 위에 position:absolute 로 띄운다. 다시 누르면 원래 자리로 복귀한다.

   ★2026-09-20 (0920b-overlay-extend, 현빈 원문 3번 «도형 블럭과 에셋 블럭에도 오버레이
     버튼·기능», 카드 T-052) — 원래 이 코드는 js/props/prop-text-wireup-overlay.js 안에
     «텍스트 전용»으로 있었다. 도형·에셋으로 넓히면서 «베끼지 않고» 이 파일로 옮겼다.
     그 파일은 2026-09-15~16 사이 후속 P0 수정만 11커밋을 받았다(회전축 어긋남 · 클램프
     범위 · 재부모 좌표 점프 · contenteditable 가드 · 복귀 섹션 오인 …). 사본을 만들면
     그 11개를 두 번 더 만든다 ⇒ 타입 차이는 «어댑터 한 곳»(posElOf)으로만 흡수한다.

   ★타입별로 다른 것은 «위치를 쥔 요소»(posEl) 하나뿐이다.
     · 텍스트  : .frame-block[data-text-frame="true"] 래퍼 (텍스트는 항상 이 래퍼에 담긴다)
     · 도형    : 자유배치 래퍼 프레임 (shape-frame.js shapeFrameOf — 판정 SSOT, ⛔재구현 금지)
     · 에셋    : .asset-block 자신
   나머지(진입/이탈/드래그/좌표규약 dataset.offsetX·offsetY)는 «완전히 같다».

   ⛔import 는 순수 모듈만(frame-geometry.js · shape-frame.js). DOM 하네스 테스트가 이
     그래프를 그대로 서빙한다 — overlay-handles.js 처럼 무거운 모듈을 끌어들이지 마라.
═══════════════════════════════════════════════════════════════════════════ */

import { rotatedAABB, blockRotationDeg } from './frame-geometry.js';
import { shapeFrameOf } from './shape-frame.js';

function _zoom() {
  return (window.currentZoom || 40) / 100;
}

/* ★«위치를 쥔 요소» 해석 — 타입 어댑터. 이 함수가 이 파일의 유일한 타입 분기다. */
export function posElOf(block) {
  if (!block || block.nodeType !== 1 || !block.classList) return null;
  /* ⛔텍스트 판정은 «클래스 이름»이 아니라 조상 래퍼로 한다 — 옛 _posElOf 와 한 글자도 다르지
     않게. 호출부가 넘기는 것은 .text-block 일 때도 있고 그 «안쪽 글자 요소»(.tb-h2 …)일 때도
     있다(prop-text 배선·DOM 하네스 둘 다 후자를 넘긴다). 클래스로 좁히면 그 경우가 조용히
     자기 자신으로 떨어져 진입/이탈이 엉뚱한 요소에 걸린다(실측: 회귀 5건). */
  const tf = block.closest?.('.frame-block[data-text-frame="true"]');
  if (tf) return tf;
  if (block.classList.contains('shape-block')) {
    // ⛔래퍼 판정을 여기서 다시 적지 않는다 — shape-frame.js 가 SSOT.
    return shapeFrameOf(block) || block;
  }
  /* 에셋은 자기 자신이 단위다. ⚠️.col 안(img2/img3 프리셋)에 있으면 띄우는 동안 그 컬럼이
     비어 레이아웃이 재배치된다 — 복귀는 overlayReturnParent 로 정확히 되지만, 「에셋만 뺄지
     row 째 띄울지」는 현빈 미확정(0920b 보고서 notDone). 지금은 «그 블록만» 띄운다. */
  return block;
}

/* 선택 아웃라인(보라)을 받을 «선택 호스트» — selection-overlay.js _hostOf 와 같은 판정.
   텍스트는 래퍼가 호스트지만(=posEl), 도형은 «.shape-block 자신»이 호스트다(래퍼에만 심으면
   보라가 안 뜬다). 래퍼와 도형이 둘 다 .selected 가 될 수 있으므로 둘 다에 심는다. */
function _selHostsOf(posEl) {
  const out = [posEl];
  const inner = posEl.querySelector?.(':scope > .shape-block');
  if (inner) out.push(inner);
  return out;
}

function _ensureId(el) {
  if (!el.id) {
    el.id = (typeof window.genId === 'function')
      ? window.genId('anchor')
      : ('anchor_' + Math.random().toString(36).slice(2, 9));
  }
  return el.id;
}

export function isFloat(posEl) {
  return !!posEl && posEl.dataset?.overlayBlock === 'true';
}

/* ★위치를 쓰는 «단 하나의» 자리 — zoom-block.js _applyZoomPos(⑲)와 같은 규약.
   dataset.offsetX/offsetY 가 SSOT 고, style 은 그걸 되읽어 쓴다. */
function _applyOverlayPos(posEl, x, y) {
  posEl.dataset.offsetX = String(Math.round(x));
  posEl.dataset.offsetY = String(Math.round(y));
  posEl.style.left = posEl.dataset.offsetX + 'px';
  posEl.style.top  = posEl.dataset.offsetY + 'px';
}

/* ★2026-09-16k 현빈 지시 — "커맨드 눌러야만 나가는 게 필요하냐, 마그네틱/방울처럼 턱이
   있는 느낌으로 기본으로 되면 좋겠다"(나갈 때·들어올 때 둘 다 저항). 하드 클램프(옛
   window._clampToSection, 경계에서 뚝 멈춤)를 기본 드래그의 «탄성 클램프»로 바꾼다 —
   경계를 넘는 만큼(over)을 RESIST_ZONE(40px, 로컬 단위) 안에서는 RESIST_FACTOR(0.35)로
   눌러 움직임이 «무겁게» 느껴지다가, 그 구간을 다 채우면(=턱을 넘으면) 그 지점부터
   다시 1:1 로 완전히 자유롭게 움직인다(방울이 막을 뚫고 나가는 느낌 — 무한정 늘어나며
   저항만 커지는 고전 러버밴드와 다르다, 실제로 "나가진다"). 이 함수는 위치 기반 순수
   함수라 되돌아올 때도 «같은 곡선»을 그대로 반대로 타 — 들어올 때도 같은 저항이 자동으로
   생긴다(설계 요구사항).
   ⌘(Cmd)는 이 저항을 완전히 끄는 파워유저 단축키로 남긴다(기존 "자유 이동" 자리를 그대로
   재사용 — 의미만 "저항 없음"으로 좁힘).

   ★2026-09-16l 현빈 실측 — "섹션 밖으로 옮길 때 약간의 저항도 없니 지금은? 마그네틱같은"
   → 실제론 있었는데 «줌 40%»에서는 못 느껴질 정도였다: RESIST_ZONE(40)을 로컬(문서) 단위
   상수로 고정해뒀더니, 화면 픽셀로는 zoom(0.4)을 곱한 16px밖에 안 돼(마우스를 16px만
   움직여도 저항구간을 다 지나 자유로워짐) — 100% 줌에서 테스트할 땐 40px 그대로라 느껴졌지만
   낮은 줌에서는 사실상 없는 것과 같았다. ⇒ 저항의 "손맛"은 화면(스크린) 픽셀 기준으로
   일정해야 하는 촉각적 UI 효과이지 문서 공간 거리가 아니다 — 매 드래그마다 그 시점의
   zoom으로 나눠(zone = OVERLAY_RESIST_ZONE_SCREEN_PX / zoom) 로컬 단위 존 폭을 다시 구한다
   (100% 줌에서는 40 그대로라 회귀 없음, 40% 줌에서는 100 로컬px = 여전히 화면 40px).

   ★2026-09-16m 현빈 실측 — "지금도 없는거 같은데?" → 재실측(CDP)해 보니 수학적으론 정확한
   자리에서 걸리고 있었다(회전 보정된 경계 근처에서 속도가 0.35배로 뚜렷이 떨어짐). 다만
   «부드럽게 느려지기만» 하는 커브는 실제 트랙패드/마우스로 빠르게 훑을 때는 잘 안 느껴진다
   — 현빈 제안: "살짝 마그네틱 기능이 있으면 나으려나?" ⇒ 경계 바로 옆(화면 10px)은 위치가
   «경계에 딱 붙어 고정»되는 캐치 구간을 추가한다 — 커서가 그만큼 지나가도 블록은 안 움직여
   "턱에 걸린" 게 뚜렷이 느껴지고, 그 구간을 넘으면 기존 탄성 구간(0.35배 저항)이 이어서
   걸리다 완전히 자유로워진다. 캐치 폭은 저항 폭의 1/4 비율(MAGNET_FRACTION)로 둬 zoom
   변환을 따로 안 해도 된다 — 두 폭 다 같은 1/zoom을 곱하므로 비율은 zoom과 무관하다. */
const OVERLAY_RESIST_ZONE_SCREEN_PX = 40;
const OVERLAY_MAGNET_ZONE_SCREEN_PX = 10;
const OVERLAY_MAGNET_FRACTION = OVERLAY_MAGNET_ZONE_SCREEN_PX / OVERLAY_RESIST_ZONE_SCREEN_PX;
const OVERLAY_RESIST_FACTOR = 0.35;
function _elasticAxis(raw, boundMax, zone) {
  const magnet = zone * OVERLAY_MAGNET_FRACTION;
  if (raw < 0) {
    const over = -raw;
    if (over <= magnet) return 0;   // ★경계에 딱 붙어 고정 — 마그네틱 캐치
    return over <= zone
      ? -((over - magnet) * OVERLAY_RESIST_FACTOR)
      : -((zone - magnet) * OVERLAY_RESIST_FACTOR + (over - zone));
  }
  if (raw > boundMax) {
    const over = raw - boundMax;
    if (over <= magnet) return boundMax;   // ★경계에 딱 붙어 고정 — 마그네틱 캐치
    return over <= zone
      ? boundMax + (over - magnet) * OVERLAY_RESIST_FACTOR
      : boundMax + (zone - magnet) * OVERLAY_RESIST_FACTOR + (over - zone);
  }
  return raw;
}
/* window._clampToSection(x,y,sec,blockW,blockH)과 같은 시그니처 — 안만 다르다(하드→탄성).
   zone은 «화면 픽셀 기준 저항폭»을 그 순간 zoom으로 로컬 단위로 환산한 값(호출부에서 계산). */
function _elasticClampToSection(x, y, sec, blockW, blockH, zone) {
  const secW = sec.clientWidth || 0, secH = sec.clientHeight || 0;
  const maxX = Math.max(0, secW - (blockW || 0)), maxY = Math.max(0, secH - (blockH || 0));
  return [_elasticAxis(x, maxX, zone), _elasticAxis(y, maxY, zone)];
}

/* ★화면상 회전각 — 규약이 셋이다(텍스트/에셋 rotation · 도형 shapeRotation · 프레임 rotateDeg).
   ⛔`posEl.dataset.rotation` 만 읽던 옛 코드를 그대로 넓히면 도형이 조용히 빠진다: 도형은
     회전값이 래퍼가 아니라 «안쪽 .shape-block» 의 dataset.shapeRotation 에 있다
     (prop-shape.js applyShapeRotation). 래퍼 → 안쪽 도형 순으로 본다. */
function _floatRotationDeg(posEl) {
  const own = blockRotationDeg(posEl);
  if (own) return own;
  const inner = posEl.querySelector?.(':scope > .shape-block');
  return inner ? blockRotationDeg(inner) : 0;
}

/* 폭 고정 — absolute 전환 시 콘텐츠 폭으로 쪼그라들거나(텍스트), %폭이 «섹션 폭» 기준으로
   다시 풀려 커지는 것(에셋: applyAssetPadX 가 width:93.02% 같은 값을 쓴다)을 막는다.
   ⛔dataset.width 는 타입마다 «다른 뜻»이다 — 텍스트프레임은 Position 절의 수동 너비
     (prop-text-wireup-position.js), 도형 래퍼는 _extendShapeFrameToSection 이 읽는 폭.
     그래서 dataset.width 에 쓰는 건 «텍스트프레임일 때만» 이다(기존 동작 그대로 보존).
     그 밖은 style.width 만 굳히고 원래 inline 값을 overlayPrevWidth 에 적어 둔다. */
function _freezeWidth(posEl) {
  if (posEl.dataset.textFrame === 'true') {
    if (posEl.dataset.width) return;   // 원래 수동 너비가 있으면 건드리지 않는다
    const w = Math.round(posEl.offsetWidth);
    if (w > 0) {
      posEl.style.width = w + 'px';
      posEl.style.maxWidth = '100%';
      posEl.dataset.width = String(w);
      posEl.dataset.overlayIntroducedWidth = 'true';
    }
    return;
  }
  const inlineW = (posEl.style.width || '').trim();
  if (/^\d+(\.\d+)?px$/.test(inlineW)) return;   // 이미 px 로 굳어 있다(도형 래퍼 대부분)
  const w = Math.round(posEl.offsetWidth);
  if (w > 0) {
    posEl.dataset.overlayPrevWidth = inlineW;
    posEl.style.width = w + 'px';
    posEl.dataset.overlayIntroducedWidth = 'true';
  }
}
/* ★풀블리드 에셋·넓은 도형은 «음수 마진»으로 섹션 패딩을 침범한다(prop-asset.js
   applyAssetFullBleed · prop-shape.js _extendShapeFrameToSection). absolute 로 띄우면 left 가
   이미 «화면에서 보이던 자리»를 담고 있는데 그 위에 음수 마진이 «또» 걸려 좌로 한 번 더 밀린다
   — 실측(2026-09-20 라이브 9503, 줌 40%): 진입만 했는데 화면 x 가 545 → 516 으로 뛰었다
   (-29 화면px = 정확히 -72 로컬px = margin-left). ⇒ 띄우는 동안만 걷어내고 이탈할 때 되돌린다.
   ⚠️inline 이 아니라 CSS 에서 온 마진도 있으므로 computed 로 판정하고 «0px 를 명시»한다. */
function _freezeMargins(posEl) {
  const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(posEl) : null;
  const ml = parseFloat(cs?.marginLeft) || 0;
  const mr = parseFloat(cs?.marginRight) || 0;
  if (!ml && !mr) return;
  posEl.dataset.overlayPrevMarginL = posEl.style.marginLeft || '';
  posEl.dataset.overlayPrevMarginR = posEl.style.marginRight || '';
  posEl.dataset.overlayIntroducedMargin = 'true';
  posEl.style.marginLeft = '0px';
  posEl.style.marginRight = '0px';
}
function _unfreezeMargins(posEl) {
  if (posEl.dataset.overlayIntroducedMargin !== 'true') return;
  posEl.style.marginLeft  = posEl.dataset.overlayPrevMarginL || '';
  posEl.style.marginRight = posEl.dataset.overlayPrevMarginR || '';
  delete posEl.dataset.overlayPrevMarginL;
  delete posEl.dataset.overlayPrevMarginR;
  delete posEl.dataset.overlayIntroducedMargin;
}

function _unfreezeWidth(posEl) {
  if (posEl.dataset.overlayIntroducedWidth !== 'true') return;
  if (posEl.dataset.textFrame === 'true') {
    posEl.style.width = '';
    posEl.style.maxWidth = '';
    delete posEl.dataset.width;
  } else {
    posEl.style.width = posEl.dataset.overlayPrevWidth || '';
  }
  delete posEl.dataset.overlayPrevWidth;
  delete posEl.dataset.overlayIntroducedWidth;
}

// 오토레이아웃 → 오버레이(플로팅) 전환
export function enterFloat(posEl) {
  if (!posEl) return false;
  const sec = posEl.closest('.section-block');
  if (!sec) return false;
  const parent = posEl.parentElement;
  if (!parent) return false;

  // 복귀용 원위치 기억 — 부모 + 직전 형제(없으면 "맨 앞"으로 복귀)
  const parentId = _ensureId(parent);
  const prevSib  = posEl.previousElementSibling;
  posEl.dataset.overlayReturnParent = parentId;
  posEl.dataset.overlayReturnAfter  = prevSib ? _ensureId(prevSib) : '';

  _freezeWidth(posEl);

  // 현재 화면 위치 → 섹션 기준 좌표로 고정 (줌 보정, freeLayout 드래그와 같은 계산식)
  const zoom = _zoom();
  const secRect = sec.getBoundingClientRect();
  const elRect  = posEl.getBoundingClientRect();
  const x = Math.round((elRect.left - secRect.left) / zoom);
  const y = Math.round((elRect.top  - secRect.top)  / zoom);
  /* ⛔마진은 «좌표를 «재고 난 뒤»» 걷어낸다 — 지금 눈에 보이는 자리(=마진이 이미 반영된 rect)가
     우리가 유지해야 할 자리다. 먼저 걷어내고 재면 마진만큼 어긋난 자리를 «정답»으로 굳힌다. */
  _freezeMargins(posEl);

  sec.appendChild(posEl); // 섹션 직접 자식 — 스티커/확대블럭과 같은 스태킹(DOM 뒤 = 맨 위)
  posEl.style.position = 'absolute';
  _applyOverlayPos(posEl, x, y);
  posEl.dataset.overlayBlock = 'true';
  // 선택 아웃라인 보라 — js/selection-overlay.js 선언형 경로(확대블럭이 이미 쓰는 길)
  _selHostsOf(posEl).forEach(h => { h.dataset.selVariant = 'sticker'; });
  window._bindOverlayMoveDrag?.(posEl); // 보통 bindBlock 에서 이미 걸렸지만 방어적으로 한 번 더
  return true;
}

// 오버레이(플로팅) → 오토레이아웃 복귀
export function exitFloat(posEl) {
  if (!posEl) return false;
  const currentSec = posEl.closest('.section-block');
  const parentId = posEl.dataset.overlayReturnParent;
  const afterId  = posEl.dataset.overlayReturnAfter;
  const parent = parentId ? document.getElementById(parentId) : null;
  // 원래 부모가 그 사이 사라졌으면(행 정리 등) 섹션 본문 맨 앞으로 폴백
  const fallback = currentSec?.querySelector('.section-inner');
  /* ★2026-09-16o P0(현빈 실측 — "오버레이를 한 상태로 다른 섹션 위로 올려는 뒀어. 그
     상태에서 오버레이 버튼을 풀었더니 다시 처음 섹션으로 가지거든?") — overlayReturnParent
     는 «오버레이 진입 당시」의 원래 부모를 고정 기억한 값이다. 오버레이 상태로 다른
     섹션으로 드래그해 옮긴 뒤 해제하면, 원래 부모가 여전히 DOM에 살아있으니(isConnected)
     무조건 그리로 되돌아가 — 지금 눈에 보이는(옮겨간) 섹션이 아니라 «처음» 섹션 본문으로
     순간이동했다. ⇒ 원래 부모가 지금도 «같은 섹션» 소속일 때만 정확한 원위치로 복귀하고,
     오버레이 중 다른 섹션으로 옮겨졌으면 그 되돌리기를 포기하고 지금 있는 섹션 본문
     맨 앞으로 넣는다(=fallback, 사라진 부모 케이스와 같은 경로). */
  const returnParentSameSection = parent && parent.isConnected && parent.closest('.section-block') === currentSec;
  const target = returnParentSameSection ? parent : fallback;

  if (target) {
    const afterEl = afterId ? document.getElementById(afterId) : null;
    if (afterEl && afterEl.parentElement === target) afterEl.after(posEl);
    else target.prepend(posEl);
  }

  posEl.style.position = '';
  posEl.style.left = '';
  posEl.style.top  = '';
  delete posEl.dataset.offsetX;
  delete posEl.dataset.offsetY;
  delete posEl.dataset.overlayBlock;
  delete posEl.dataset.overlayReturnParent;
  delete posEl.dataset.overlayReturnAfter;
  _selHostsOf(posEl).forEach(h => { delete h.dataset.selVariant; });
  _unfreezeWidth(posEl);
  _unfreezeMargins(posEl);
  return true;
}

/* 오버레이(플로팅) 블록 — 크로스섹션 이동 드래그. zoom-block.js _bindZoomMoveDrag 와
   ★같은 패턴(재사용 아님 — 파일이 다르고 DOM 셀렉터 기반이라 옮겨적었다. 로직이 갈라지면
   여기서 따로 고친다는 뜻이다): 매 mousemove 마다 커서 아래 섹션을 hit-test 해서, 지금 담긴
   섹션과 다르면 그 섹션으로 실제로 appendChild 하고(재부모) 그 새 섹션 기준으로 좌표를 다시 잰다.
   ⛔섹션 clamp 를 안 하면(⌘ 드래그는 예외) 다음 섹션 영역을 침범해 배경 밑에 깔린다 — 그게
     이 함수가 고치는 버그다(파일 상단 주석 참고).
   posEl 자체에 건다 — block-drag.js 의 bindBlock 이 블록 1개당 1회 호출한다(그쪽 참고),
   함수 내부에서 dataset.overlayBlock 을 매번 live로 재확인하므로 오버레이가 아닌 상태에서
   걸어놔도 안전하다(그때는 그냥 조용히 빠진다). */
export function bindFloatMoveDrag(posEl) {
  if (!posEl || posEl._overlayMoveBound) return;
  posEl._overlayMoveBound = true;
  posEl.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    if (posEl.dataset.overlayBlock !== 'true') return; // 오버레이 아니면 일반 드래그(block-drag.js) 몫
    // ★T-037 P0(2026-09-16, 실측 QA 발견) — 텍스트 블록은 편집 중이 아닐 때도 항상
    //   contenteditable="false"를 달고 있다(block-factory.js 다수 자리). CSS 속성선택자
    //   [contenteditable]는 값과 무관하게 «속성 존재»만 보므로 false여도 걸려, 오버레이
    //   글자 «어디를 눌러도» 이 가드가 mousedown을 즉시 삼켜 크로스섹션 드래그가 통째로
    //   막혀 있었다(재현 100% — 실사용에서 마우스로 끌면 텍스트 네이티브 셀렉션만 되고
    //   블록은 1px도 안 움직임). 편집 중(=true로 전환된 상태)만 걸러야 하므로 값을 좁힌다.
    // ★2026-09-20 — 도형의 4코너 리사이즈 핸들(.shape-handle, block-drag.js)도 같이 뺀다.
    //   그쪽이 stopPropagation 을 하므로 지금은 여기 안 닿지만, 핸들이 «이동»으로 오인되면
    //   크기조절이 통째로 죽는 부류라 가드를 대칭으로 둔다.
    if (e.target.closest('.resize-handle, .shape-handle, .ss-resize-handle, [contenteditable="true"]')) return;
    e.stopPropagation();

    let sec = posEl.closest('.section-block');
    if (!sec) return;
    const zoom = _zoom();
    /* ★2026-09-16h P0(현빈 실측 — "90도 회전 후 좌우 이동이 안 된다") — 회전된 오버레이는
       getBoundingClientRect()가 회전 «후» 화면상 축정렬 bounding box를 돌려준다(T-026과
       같은 병 — 90°에서 폭·높이가 통째로 뒤바뀐다). 그 rect로 잡은 grabX/grabY가 실제
       style.left/top 기준과 어긋나 90°에서는 가로로만 끌어도 top이 요동쳤다(실측: 가로
       100px만 끌었는데 top이 -100 바뀜).
       ⇒ getBoundingClientRect를 아예 안 쓴다. style.left/top은 «회전 전 프레임»의 위치이고
       transform:rotate()는 그 프레임을 자기 중심으로 돌리기만 할 뿐 위치는 안 옮기므로,
       left/top을 화면 스크린 델타만큼 그대로 더하면 회전각과 «무관하게» 박스 전체가
       스크린에서 정확히 그만큼 움직인다(회전은 그 델타에 영향을 안 준다 — 처음에 회전
       행렬로 델타를 보정하려 했던 건 잘못된 접근이었다, 실측으로 되짚어 확인).
       마우스다운 시점의 로컬 left/top과 스크린좌표를 저장해두고 매 프레임 순수 델타만
       더한다 — 회전 0°에서는 기존 산식과 완전히 같다(회귀 없음). */
    let startClientX = e.clientX, startClientY = e.clientY;
    let startLeft = parseFloat(posEl.style.left) || 0;
    let startTop = parseFloat(posEl.style.top) || 0;
    let moved = false;

    /* ★2026-09-16i P0(현빈 실측 — "움직임 범위에도 한정되어 있다") — _clampToSection에
       posEl.offsetWidth/offsetHeight(회전 «전» 크기)를 그대로 넘겨서, 예를 들어 가로로
       넓고 얇은(716×83) 텍스트를 90° 돌려 화면상 33×286짜리 세로 막대로 보여도 클램프는
       여전히 "가로 716짜리"로 여겨 움직일 수 있는 가로 범위를 거의 다 깎아먹었다(섹션
       860 중 716을 예약 → 남는 건 144뿐). 회전 후 «실제 화면 폭·높이»(축정렬 bounding box)
       로 클램프해야 한다.
       ★2026-09-16j 정정(작업목록매니저 지적) — 이 계산을 처음엔 손으로 다시 적었는데,
       이미 js/frame-geometry.js의 rotatedAABB(w,h,deg)가 SSOT다(그 파일 머리말 — "복사하면
       한 곳만 고쳐도 나머지가 안 따라온다, 이 레포에서 실제로 난 사고"). 180의 배수 가드
       (Math.sin(Math.PI)=1.2e-16 오차 방지)도 거기 이미 있어 손으로 다시 짜면 놓치기 쉽다.
       그 함수를 그대로 쓴다 — 사본을 만들지 않는다.
       ★2026-09-20 — 회전각을 읽는 자리도 같은 이유로 한 곳이다(_floatRotationDeg →
       frame-geometry.js blockRotationDeg). 도형은 shapeRotation 이라 dataset.rotation 만
       읽던 옛 코드로는 45° 도형의 클램프 폭이 회전 전 폭 그대로 남는다. */
    const rotDeg = _floatRotationDeg(posEl);
    const { w: clampW, h: clampH } = rotatedAABB(posEl.offsetWidth, posEl.offsetHeight, rotDeg);

    const onMove = ev => {
      if (!moved) {
        if (Math.hypot(ev.clientX - e.clientX, ev.clientY - e.clientY) < 3) return;
        moved = true;
        window.pushHistory?.('오버레이 이동');
      }
      // ★2026-09-16k — ⌘ 드래그 = «저항 없는» 완전 자유 이동(하드 클램프였던 옛 뜻과 달리,
      //   기본 드래그도 이제 섹션 밖으로 나간다 — 다만 탄성 저항이 걸린다. ⌘는 그 저항마저
      //   끄는 파워유저용). 재부모(다른 섹션 위로 호버)는 여전히 ⌘가 아닐 때만 — ⌘는 "이
      //   섹션 좌표계에 그대로 둔 채 자유롭게"라는 기존 어휘를 그대로 지킨다.
      const trulyFree = ev.metaKey;
      const hover = (!trulyFree && window._findSectionAt) ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hover && hover !== sec) {
        // 재부모 — 지금까지의 로컬 좌표를 확정해 새 섹션 기준으로 다시 앵커를 잡는다.
        //
        // ★2026-09-16n P0(현빈 실측 — "오버레이하고 바로 밑 섹션으로 옮기려니 그 밑에
        //   섹션으로 좌표가 이동돼. 섹션 밑으로 위치되어서 가려서 잘 안보여") — 옛 섹션
        //   기준 로컬 좌표(curLeft/curTop)를 «변환 없이» 그대로 새 섹션 기준으로 썼다. 옛
        //   섹션이 새 섹션보다 훨씬 크면(여기 재현: 910px 섹션 → 283px 섹션) 옛 top값(예:
        //   909)이 새 섹션 높이를 한참 넘어 — DOM 부모는 올바른 "바로 다음 섹션"이 됐는데
        //   화면상으로는 그 섹션의 바닥을 한참 지나 «그 다음» 섹션 영역에 그려졌다(재현
        //   확정: parentId는 바로 다음 섹션인데 cy가 그 다음다음 섹션 범위에 찍힘).
        //   ⇒ 화면상 «같은 자리»를 유지한 채 새 섹션 기준으로 재앵커해야 한다 — 두 섹션의
        //   화면 좌상단 차이(screen, zoom 보정)를 옛 로컬 좌표에 더해 새 로컬 좌표로 바꾼다.
        const dxs0 = (ev.clientX - startClientX) / zoom, dys0 = (ev.clientY - startClientY) / zoom;
        const curLeft = startLeft + dxs0, curTop = startTop + dys0;
        const oldRect = sec.getBoundingClientRect();
        const newRect = hover.getBoundingClientRect();
        startLeft = curLeft + (oldRect.left - newRect.left) / zoom;
        startTop  = curTop  + (oldRect.top  - newRect.top ) / zoom;
        hover.appendChild(posEl);
        sec = hover;
        startClientX = ev.clientX; startClientY = ev.clientY;
      }
      const rawX = startLeft + (ev.clientX - startClientX) / zoom;
      const rawY = startTop  + (ev.clientY - startClientY) / zoom;
      let cx = rawX, cy = rawY;
      if (!trulyFree) {
        // ★회전 보정 — 탄성 클램프도 «화면에 실제로 보이는» 축정렬 박스(clampW×clampH)
        //   기준으로 해야 한다. 프레임 중심(회전 원점, transform-origin:center center)은
        //   회전과 무관하게 rawX+W/2, rawY+H/2 그대로다 — 그 중심에서 화면 박스의
        //   좌상단(visLeft/Top)을 구해 탄성 클램프하고, 다시 프레임 원점(left/top)으로 되돌린다.
        const cxCenter = rawX + posEl.offsetWidth / 2, cyCenter = rawY + posEl.offsetHeight / 2;
        const visLeft = cxCenter - clampW / 2, visTop = cyCenter - clampH / 2;
        const resistZone = OVERLAY_RESIST_ZONE_SCREEN_PX / zoom;
        const [clVisLeft, clVisTop] = _elasticClampToSection(visLeft, visTop, sec, clampW, clampH, resistZone);
        cx = clVisLeft + clampW / 2 - posEl.offsetWidth / 2;
        cy = clVisTop + clampH / 2 - posEl.offsetHeight / 2;
      }
      _applyOverlayPos(posEl, cx, cy);
      window.scheduleAutoSave?.();
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

/* 패널 토글 버튼 배선 — 텍스트·도형·에셋이 «같은 함수»를 쓴다.
   ⛔버튼 id 는 패널마다 다르다(텍스트 txt-overlay-toggle · 도형 shape-overlay-toggle ·
     에셋 asset-float-toggle). 에셋의 `asset-overlay-toggle` 은 «이미지 위 어두운 막+텍스트»
     (Text Overlay, prop-asset.js)가 쓰는 id 라 절대 재사용하지 않는다 — 같은 id 를 쓰면
     getElementById 가 먼저 것을 잡아 두 기능이 서로를 눌러 버린다. */
export function wireFloatToggle({ block, buttonId, rerender }) {
  const btn = document.getElementById(buttonId);
  if (!btn || !block) return;
  btn.addEventListener('click', () => {
    const posEl = posElOf(block);
    if (!posEl) return;
    const wasOverlay = isFloat(posEl);
    window.pushHistory?.(wasOverlay ? '오버레이 해제' : '오버레이로 전환');
    if (wasOverlay) exitFloat(posEl); else enterFloat(posEl);
    window.scheduleAutoSave?.();
    window.buildLayerPanel?.();
    rerender?.();   // 패널 재렌더 — 버튼 active 상태 갱신
  });
}

/* classic script / 타 모듈용 전역 — 이름은 «옛 이름 그대로» 유지한다(block-drag.js 가 부른다). */
if (typeof window !== 'undefined') {
  window._bindOverlayMoveDrag = bindFloatMoveDrag;
  window.OverlayFloat = { posElOf, isFloat, enterFloat, exitFloat, bindFloatMoveDrag, wireFloatToggle };
}
