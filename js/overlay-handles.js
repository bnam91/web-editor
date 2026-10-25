/* ═══════════════════════════════════
   OVERLAY HANDLE WIDGETS
   Resize / radius handles for frames, mockups, icons, assets, canvas, vectors
   Extracted from drag-drop.js (lines ~13–988)
═══════════════════════════════════ */
import { applyFrameTransform, applyFrameRotationMargin, blockRotationDeg,
         measureLocalBasis, localDeltaFromBasis } from './frame-geometry.js';

import { resizeColBoundary, resizeRowHeight, resizeGridImage,
         resizeCmpRowHeight, setCmpRowHeight } from './grid-cell-resize.js';   /* ★1017t1c4 비교 행 경계 드래그 — ★같은 모듈(새 import 간선 0) */
// ★grid-block.js → drag-drop.js → overlay-handles.js(이 파일) 로 이미 순환 임포트가 있다
//   (grid-block.js 가 drag-drop.js 의 bindBlock 을 쓰고, drag-drop.js 는 `export * from
//   './overlay-handles.js'`). 여기서 grid-block.js 를 다시 임포트해도 사이클이 «닫힐» 뿐
//   깨지지 않는다 — ESM 순환 임포트는 표준(라이브 바인딩)이고, 아래 함수들은 전부 «모듈
//   최상위가 아니라 이벤트 핸들러 안에서만»(사용자가 실제로 드래그를 시작한 뒤, 즉 전체
//   그래프가 이미 링크된 뒤) 쓰인다 — 이 셋(gridCols/gridRows/getGridModel)이 «단일 진실원»
//   이라 여기서 dataset.cols/rows 를 직접 재파싱하면 클램프/폴백 로직이 두 곳에 흩어진다
//   (이 레포의 고질 — P1 IMPL 보고서·P0 EVAL 둘 다 지적한 패턴). 재사용이 맞다.
import { getGridModel, gridCols, gridRows, gridPreviewLine,
         moveGridRow, moveGridCol, gridColLabel, gridRowLabel, getGridCellPadY } from './blocks/grid-block.js';   /* ★t3-04 U2a — 머리띠(같은 import 간선 · 새 간선 0) */
/* ★모달 핸들의 클램프는 «패널과 같은 표»를 본다 — 리터럴을 여기 다시 쓰면 갈라진다.
   (순환 임포트는 위 grid-block 과 «같은 모양»이고 같은 이유로 안전하다: 이 상수는
    모듈 최상위가 아니라 사용자가 드래그를 시작한 «뒤»의 핸들러 안에서만 읽힌다.) */
import { MODAL_LIMITS, clampModal, setModalSizeMode } from './blocks/modal-block.js';
/* ★오버레이(플로팅)의 «위치 규약·탄성 곡선»은 거기 한 벌뿐이다 — 5번째 사본을 만들지 않는다.
   2026-09-20 통합(int/0920b): T-052 가 알맹이를 prop-text-wireup-overlay.js → overlay-float.js
   로 옮겼으므로 import 자리도 그 SSOT 를 직접 가리킨다(얇은 배선 파일을 거치지 않는다).
   posElOf 는 옛 이름 _posElOf 로 받는다 — 아래 호출부 이름을 흔들지 않기 위해서다. */
import { _applyOverlayPos, posElOf as _posElOf, _elasticAxis, OVERLAY_RESIST_ZONE_SCREEN_PX }
  from './overlay-float.js';
/* ★에셋 폭 하한도 «패널과 같은 수»를 본다 — 여기 100 을 다시 적으면 패널만 60 으로 내려가고
   핸들은 100 에서 막아, 60px 블럭을 1px 만 끌어도 다시 100 으로 올라앉는다(T-075 ㉠).
   asset-width-limits.js 는 import 가 없는 «잎» 모듈이라 순환 걱정도 없다. */
import { ASSET_W_MIN } from './blocks/asset-width-limits.js';

/* ═══════════════════════════════════
   FRAME RESIZE HANDLE OVERLAY
   Figma 방식: 핸들을 #ss-handles-overlay에 렌더링하여
   frame-block이 overflow:hidden을 직접 가질 수 있게 함
═══════════════════════════════════ */
let _overlayFrame = null;  // 현재 핸들이 표시된 frame-block
let _overlayRafId = null;

function _getOverlay() {
  return document.getElementById('ss-handles-overlay');
}

/* ═══════════════════════════════════
   모서리 규약 — 네 모서리와 «바깥» 방향 부호를 «한 곳»에서 정한다.
   에셋 블록(사각)·아이콘 원형(원)이 같은 표를 쓴다. 베껴 두면 한쪽만 고쳐진다.
═══════════════════════════════════ */
export const CORNER_DIRS = ['nw', 'ne', 'sw', 'se'];

/** dir → 상자 중심에서 «바깥»으로 향하는 축별 부호. e/s 가 +, w/n 이 −. */
export function cornerSign(dir) {
  return { sx: dir.includes('e') ? 1 : -1, sy: dir.includes('s') ? 1 : -1 };
}

/** 핸들이 놓이는 «축별 거리». 상자 꼭지점 = (R, R).
 *  ★2026-09-05 현빈 확정: 「다른 거처럼 «꼭지점»에 해줘야지. 아웃라인만 원으로 해도 되지 않나?」
 *   ⇒ 핸들은 다른 모든 블록과 «같은 자리»(상자 네 꼭지점)에 두고, «원처럼 보이는 일»은 아웃라인이 한다.
 *
 *  ⚠️이 함수는 원래 `R/√2`(45° 둘레점)를 돌려줬다. 그 판단은 «그때» 옳았다 —
 *    당시엔 블록 상자가 원의 3배 폭(286×96)이라 상자 꼭지점이 원에서 한참 떨어져 있었다.
 *    그 뒤 검수에서 상자를 원과 같은 크기로 줄이자(33530d0) 전제가 사라졌는데 이 함수만 남아,
 *    «선은 네모 모서리를 그리는데 핸들은 24px 안쪽»이라는 어긋남이 생겼다(실측).
 *    ★두 수정이 각각은 옳았는데 합쳐지니 어긋난 자리다 — 전제를 바꿨으면 그 위에 선 것을 다시 재라. */
export function circumferenceOffset(R) {
  return R;
}

/* ═══════════════════════════════════
   손잡이 색 갈래 — «테두리와 한 색»으로 (현빈 2026-09-21)
   ───────────────────────────────────────────────────────────────────────────
   현빈 원문: 「오버레이 하면 아웃라인이 보라인데 모서리 핸들은 파랑이다. 스티커는 보라 핸들까지
   되어 있으니 색을 맞춰줘」. 같은 병을 이 파일은 이미 한 번 고쳤다 — 확대블럭(2026-09-08,
   css/editor-blocks.css 「앵커만 파랑이면 한 블록에 핸들 색이 둘이 된다」).
   ★판정은 «이름 목록»이 아니라 선택 오버레이가 색을 고를 때 쓰는 바로 그 표식을 본다:
     js/overlay-float.js 가 enterFloat 에서 찍고(dataset.selVariant='sticker'),
     js/selection-overlay.js _variantOf 가 읽어 선을 보라로 그린다. 손잡이도 «같은 표식»을 탄다
     ⇒ 오버레이가 아닌 블럭은 표식이 없어 종전 파랑 그대로다(비오버레이 회귀 0).
   ⛔손잡이는 #ss-handles-overlay(고정층) 안이라 블럭의 «자손»이 아니다 — CSS 자손 선택자로는
     못 닿는다. 그래서 표식을 손잡이에 «옮겨 찍고» 색 규칙은 CSS 한 곳(editor-blocks.css)에만 둔다.
   ★«매번 다시 재는 술어»다(_tfoEditing 과 같은 꼴) — 위치 갱신 루프에서 부르므로 오버레이를
     켜고 끄면 손잡이 색이 스스로 따라온다. 값이 같으면 안 쓴다(쓸데없는 스타일 무효화 방지).
═══════════════════════════════════ */
export function syncHandleSelVariant(handle, block) {
  const host = block?.closest?.('[data-sel-variant]') || block;
  const v = (host && host.dataset && host.dataset.selVariant) || '';
  if ((handle.dataset.selVariant || '') === v) return;
  if (v) handle.dataset.selVariant = v;
  else delete handle.dataset.selVariant;
}

/* ═══════════════════════════════════
   회전 인식 좌표 헬퍼 (U14 — 회전 후 리사이즈 핸들 좌표 보정)
   블록이 transform:rotate 된 상태에서 getBoundingClientRect()는 «회전된 요소의
   축정렬 바운딩박스(AABB)»를 돌려주므로, 코너 핸들을 rect 모서리에 두면
   실제 회전된 코너와 어긋난다. 회전각을 반영해 «진짜 회전된 코너»의 스크린
   좌표를 계산한다. 회전이 0이면 기존 rect 모서리 경로와 «완전 동일»(회귀 0).
═══════════════════════════════════ */
/** ★export — 선택 오버레이(js/selection-overlay.js)가 «같은 배율»을 쓴다.
 *  베끼면 갈라진다: 스케일러 transform 을 읽는 자리는 «한 곳»이어야 한다. */
export function _canvasScaleNow() {
  const s = document.getElementById('canvas-scaler');
  return s ? parseFloat(s.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
}
// 블록이 어떤 규약으로 회전값을 갖든(프레임 rotateDeg / asset rotation / shape shapeRotation)
// 화면상 회전각(deg)을 반환. 없으면 0.
// ★2026-09-20 — 본체는 js/frame-geometry.js blockRotationDeg 로 옮겼다(오버레이 공용 모듈이
//   같은 판정을 써야 하는데 이 파일은 무거워 import 할 수 없다). 여기선 이름만 유지한다.
const _blockRotationDeg = blockRotationDeg;
// 코너 dir('nw'|'ne'|'sw'|'se')의 스크린 좌표.
// inset>0 이면 코너에서 안쪽으로(코너반경 핸들), inset<0 이면 바깥쪽으로(회전 핫존).
/** ★export — 선택 오버레이가 테두리 꼭지점을 «이 함수로» 얻는다(핸들과 같은 좌표).
 *  ⛔베끼지 마라 — 베끼는 순간 「핸들은 여기, 선은 저기」로 갈라진다(M39 가 바로 그 병이었다).
 *  ⚠️한계: 회전은 el «자신»의 dataset 만 본다. 회전한 «조상» 안의 자식은 AABB 가 나온다. */
export function _cornerScreen(el, dir, inset = 0) {
  const rect = el.getBoundingClientRect();
  const deg = _blockRotationDeg(el);
  if (!deg) {
    // 회귀 0: 기존과 완전히 동일한 rect 모서리 기반 계산
    const x = dir.includes('w') ? rect.left + inset : rect.right  - inset;
    const y = dir.includes('n') ? rect.top  + inset : rect.bottom - inset;
    return { x, y };
  }
  const cx = rect.left + rect.width  / 2;   // 중심은 회전 불변
  const cy = rect.top  + rect.height / 2;
  const scale = _canvasScaleNow();
  const hw = el.offsetWidth  * scale / 2 - inset; // 미회전 반폭(스크린px) - inset
  const hh = el.offsetHeight * scale / 2 - inset;
  const sx = dir.includes('w') ? -1 : 1;
  const sy = dir.includes('n') ? -1 : 1;
  const lx = sx * hw, ly = sy * hh;
  const th = deg * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
  return { x: cx + lx * cos - ly * sin, y: cy + lx * sin + ly * cos };
}
// 스크린 델타(dx,dy)를 블록 로컬축으로 역회전 — 회전된 블록 리사이즈 시 W/H가
// 블록 자신의 축을 따라 반응하게 한다. 회전 0이면 그대로 반환.
function _unrotateDelta(el, dx, dy) {
  const deg = _blockRotationDeg(el);
  if (!deg) return { dx, dy };
  const th = -deg * Math.PI / 180, cos = Math.cos(th), sin = Math.sin(th);
  return { dx: dx * cos - dy * sin, dy: dx * sin + dy * cos };
}

function showFrameHandles(ss) {
  if (_overlayFrame === ss) return; // already showing
  hideFrameHandles();
  _overlayFrame = ss;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onHandleMouseDown(e, ss, dir));
  });

  // Figma 스타일 코너 반경 핸들 (프레임 내부 코너에 표시)
  dirs.forEach(dir => {
    const r = document.createElement('div');
    r.className = `ss-radius-handle ${dir}`;
    r.dataset.radiusDir = dir;
    r.title = '코너 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onRadiusHandleMouseDown(e, ss, dir));
  });

  // U14 회전 핫존 (코너 바깥) — 프레임 회전은 dataset.rotateDeg 규약(prop-frame과 공유)
  // 도형·텍스트 래퍼 프레임엔 부착하지 않는다(각자 전용 회전 핸들/제외 대상):
  //  - shape frame: shape-block 자체 회전(shape-rotate-zone, asset-rotate.js)
  //  - text frame : 텍스트 회전 상신 대상(보고 참조)
  const _hasShape = !!ss.querySelector(':scope > .shape-block');
  const _isTextFrame = ss.dataset.textFrame === 'true';
  if (!_hasShape && !_isTextFrame) {
    dirs.forEach(dir => {
      const z = document.createElement('div');
      z.className = `ss-rotate-handle ${dir}`;
      z.dataset.rotDir = dir;
      z.title = '회전 (Shift=15° 스냅)';
      z.style.cssText = 'position:fixed;width:20px;height:20px;z-index:98;pointer-events:auto;'
        + 'border-radius:50%;cursor:' + _FRAME_ROTATE_CURSOR + ';';
      overlay.appendChild(z);
      z.addEventListener('mousedown', e => _onFrameRotateMouseDown(e, ss));
    });
  }

  _updateHandlePositions();
  _startHandleRaf();
}

function hideFrameHandles() {
  if (_overlayRafId) { cancelAnimationFrame(_overlayRafId); _overlayRafId = null; }
  _overlayFrame = null;
  const overlay = _getOverlay();
  if (overlay) {
    overlay.querySelectorAll('.ss-resize-handle, .ss-radius-handle, .ss-rotate-handle').forEach(h => h.remove());
  }
}

// 피그마식 회전 커서 (asset-rotate.js와 동일 SVG)
const _FRAME_ROTATE_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='white' stroke-width='4'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='white' stroke-width='4'/%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='%23222' stroke-width='2'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='%23222' stroke-width='2'/%3E%3C/svg%3E\") 12 12, grab";

// 프레임 회전 드래그 — 중심 기준 atan2 자유회전, Shift=15° 스냅.
// dataset.rotateDeg + 합성 transform(translate·rotate·scale) 규약(prop-frame·save-load과 동일).
function _composeFrameTransform(ss) {
  // SSOT = js/frame-geometry.js. transform 문자열 합성 + 회전 AABB 세로 마진 보정을 함께 한다.
  // identity:'clear' 는 «이 경로의 기존 규약»(항등이면 style.transform 제거)을 그대로 유지한 것.
  applyFrameTransform(ss, { identity: 'clear' });
}
function _onFrameRotateMouseDown(e, ss) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const br = ss.getBoundingClientRect();
  const cx = br.left + br.width  / 2;
  const cy = br.top  + br.height / 2;
  const init   = parseFloat(ss.dataset.rotateDeg) || 0;
  const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
  const startX = e.clientX, startY = e.clientY;
  const _hist = window.beginDragHistory?.('프레임 회전');
  function onMove(ev) {
    const _sc = _canvasScaleNow();
    const dx = (ev.clientX - startX) / _sc;
    const dy = (ev.clientY - startY) / _sc;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    let deg = init + (a - startA);
    deg = window._snapRotate(deg, ev.shiftKey); // Shift = 45° 스냅(공유)
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360; // -180..180
    ss.dataset.rotateDeg = String(deg);
    _composeFrameTransform(ss);
    // 프로퍼티 패널 회전 입력 동기화 (열려 있으면)
    const inp = document.getElementById('ss-rotate-deg');
    if (inp) inp.value = String(deg);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.('프레임 회전');
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _startHandleRaf() {
  function loop() {
    if (!_overlayFrame) return;
    // 프레임이 DOM에서 제거됐거나 선택 해제되면 핸들 제거
    if (!_overlayFrame.isConnected || !_overlayFrame.classList.contains('selected')) {
      hideFrameHandles();
      return;
    }
    _updateHandlePositions();
    _overlayRafId = requestAnimationFrame(loop);
  }
  _overlayRafId = requestAnimationFrame(loop);
}

function _updateHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayFrame) return;
  const HALF = 3.5;
  // 회전 인식: 회전된 프레임이면 실제 회전된 코너에 핸들 배치(회전 0이면 기존과 동일)
  const handles = overlay.querySelectorAll('.ss-resize-handle');
  handles.forEach(h => {
    const c = _cornerScreen(_overlayFrame, h.dataset.dir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });

  // 코너 반경 핸들 위치 (프레임 안쪽 코너에서 INSET만큼 안쪽)
  const INSET = 10; // 코너에서 안쪽으로 떨어진 거리
  const RADIUS_HALF = 3.5; // 7px 핸들 중앙 정렬 (= 7/2)
  const rHandles = overlay.querySelectorAll('.ss-radius-handle');
  rHandles.forEach(h => {
    const c = _cornerScreen(_overlayFrame, h.dataset.radiusDir, INSET);
    h.style.top  = (c.y - RADIUS_HALF) + 'px';
    h.style.left = (c.x - RADIUS_HALF) + 'px';
  });

  // 회전 핫존 위치 (코너 리사이즈 핸들 바깥쪽) — U14 프레임 핸들 회전
  const ROT_OUT  = 16; // 코너에서 바깥으로 (스크린px)
  const ROT_HALF = 10; // 20px 핫존 중앙 정렬
  overlay.querySelectorAll('.ss-rotate-handle').forEach(h => {
    const c = _cornerScreen(_overlayFrame, h.dataset.rotDir, -ROT_OUT); // 음수 inset = 바깥
    h.style.top  = (c.y - ROT_HALF) + 'px';
    h.style.left = (c.x - ROT_HALF) + 'px';
  });
}

function _onHandleMouseDown(e, ss, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const ssRect = ss.getBoundingClientRect();
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  // 회전 시 getBoundingClientRect는 AABB(부풀림) → 미회전 layout 크기(offset*)를 기준으로.
  const _rotStart = _blockRotationDeg(ss);
  /* ★1020t1d W2B ⒝ — 회전한 «조상» 프레임 안의 자유배치 자식 프레임 (실측: 핀 a42d76d5 · 줌 40% · 화면 (+40,+20)).
     조상 rot90 이면 ⑴ 시작 크기를 화면 AABB 로 읽어 W·H 가 ★뒤바뀌고(300×200 → startW 200·startH 300)
     ⑵ 화면 Δ 를 줌으로만 나눠 ★축이 뒤바뀐다 ⇒ 화면 상자 Δ [60,0]·[20,0]·[60,−80]·[20,−80] (기대 [±40,±20]).
     조상 flipH/flipV/둘다 는 ★결함이 아니었다(4손잡이×3꼴 전부 맞음): 손잡이는 `_cornerScreen` 이 화면 AABB
     꼭지점에 두므로 data-dir 은 «화면 자리» 이름이고, Δ 부호 뒤집힘과 ★상쇄된다.
     ⇒ 고침 = frame-geometry.js 의 기저를 제스처당 1회 재서(measureLocalBasis — left/top 을 쓰는 absolute 자식만)
       ⒜ Δ 를 로컬로(localDeltaFromBasis) ⒝ 손잡이의 «화면 바깥 방향»(cornerSign)도 ★같은 기저로 로컬로 옮겨
          로컬 꼭지점(_dirL)을 정한다. ⛔Δ 만 바꾸면 flip 3꼴이 새로 깨진다(flipH: se 가 로컬 sw 라 W 가 준다).
       ⒞ 시작 크기는 회전 갈래와 같은 offsetWidth/Height(변환 무관 layout 크기).
     자기 회전이 있으면(_rotStart) 이 길을 안 탄다 — 그때 손잡이는 _cornerScreen 이 로컬 꼭지점에 두고
       _unrotateDelta 가 맞다(양성대조 tests/dom/resize-handle-rot-1020w2b ×3). 기저 null(흐름 자식·퇴화) = 옛 식.
     ⚠️무변환 판에서도 탄다(absolute 면 조상 변환이 없어도) · 제스처당 강제 레이아웃 2회 ·
       실측 ×30 중앙 1.5ms · p90 3ms · 최대 4ms (1,820 요소 · 줌 40%) · 비교 ⒜⒝ 1,724 요소 중앙 1.8 · 최대 7.5 ·
       판정선 100ms ⇒ 조건을 더하지 않았다.
       더럽힌 뒤 중앙 38ms — 이 갈래가 없어도 치를 몫으로 읽었다 · 쪼개서 재지는 않았다. */
  let _basis = (!_rotStart && ss.style.position === 'absolute') ? measureLocalBasis(ss) : null;
  let _dirL = dir;
  if (_basis) {
    const _cs = cornerSign(dir);
    const _lo = localDeltaFromBasis(_basis, _cs.sx, _cs.sy);
    if (_lo) _dirL = (_lo.dy >= 0 ? 's' : 'n') + (_lo.dx >= 0 ? 'e' : 'w');
    else _basis = null;
  }
  const _layoutStart = _rotStart || _basis;
  const startW = _layoutStart ? Math.round(ss.offsetWidth)  : Math.round(ssRect.width  / scale0);
  const startH = _layoutStart ? Math.round(ss.offsetHeight) : Math.round(ssRect.height / scale0);
  const secInner = ss.closest('.section-inner') || ss.closest('.section-block');
  const secInnerCS = secInner ? getComputedStyle(secInner) : null;
  const paddingH = secInnerCS ? parseFloat(secInnerCS.paddingLeft) + parseFloat(secInnerCS.paddingRight) : 0;
  const maxW = secInner ? Math.round(secInner.clientWidth - paddingH) : 860;

  // fullWidth 프레임(stack 모드, 자동 높이)은 핸들로 높이 조절 안 함 — 자식이 결정.
  const isFullWidth = ss.dataset.fullWidth === 'true';

  // ── 그룹 리사이즈: 자식을 비례 스케일 (피그마식). data-group 프레임에만 적용 ──
  const isGroup = ss.dataset.group === 'true';
  // 스케일 기준은 style.width/height(canvas px) — rect/scale 불일치 회피
  const groupStartW = parseInt(ss.style.width) || startW;
  const groupStartH = parseInt(ss.style.height) || startH;
  let groupSnap = null;
  if (isGroup) {
    groupSnap = [];
    const collect = (container) => {
      [...container.children].forEach(c => {
        if (c.classList.contains('frame-resize-handle')) return;
        if (getComputedStyle(c).position !== 'absolute') return;
        const isTextFrame = c.dataset.textFrame === 'true';
        const contentEl = isTextFrame ? c.querySelector('[class^="tb-"]') : null;
        groupSnap.push({
          el: c,
          left: parseInt(c.style.left) || 0,
          top: parseInt(c.style.top) || 0,
          w: parseInt(c.style.width) || c.offsetWidth,
          h: parseInt(c.style.height) || c.offsetHeight,
          isTextFrame,
          contentEl,
          fs: contentEl ? (parseFloat(getComputedStyle(contentEl).fontSize) || 0) : 0,
        });
        if (c.classList.contains('frame-block') && !isTextFrame) collect(c);
      });
    };
    collect(ss);
  }
  const _hist = window.beginDragHistory?.('프레임 크기');

  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // 회전된 프레임: 스크린 델타를 블록 로컬축으로 역회전(회전 0이면 그대로 → 회귀 0)
    //   ★1020t1d W2B ⒝ — 조상 기저가 있으면 화면 Δ → 로컬 Δ (줌 포함 · 위 _basis 주석)
    const _ld = _basis ? localDeltaFromBasis(_basis, ev.clientX - startX, ev.clientY - startY) : null;
    const _rd = _ld || _unrotateDelta(ss, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _rd.dx;
    const dy = _rd.dy;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    let newW = startW, newH = startH;
    if (_dirL.includes('e')) newW = Math.min(maxW, Math.max(60, startW + dx));
    if (_dirL.includes('w')) newW = Math.min(maxW, Math.max(60, startW - dx));
    if (!isFullWidth) {
      if (_dirL.includes('s')) newH = Math.max(40, startH + dy);
      if (_dirL.includes('n')) newH = Math.max(40, startH - dy);
    }
    newW = Math.round(newW); newH = Math.round(newH);
    ss.style.width  = `${newW}px`; ss.dataset.width  = String(newW);
    /* ★★★「패딩 제외(full-bleed)」 규약의 ★★둘째 입구 (현빈 2026-10-11 「★리사이즈하면 ★패딩제외가 ★풀린다」)
       ★★규약 = ★★«제 폭을 ★먼저 정하고», ★마지막에 ★패딩제외를 ★덮는다. ★꺼져 있으면 ★no-op 이다.
       ★★★입구가 ★★둘이다 — ★이 명부를 ★여기와 ★그쪽에 ★같이 적는다:
         ⒤ ★패널 ★폭 슬라이더 — `js/props/prop-frame.js` 의 `applyWidth`(★그 자리 주석이 ★이 병을 ★이미 적어 뒀다)
         ⒥ ★★이 자리 — ★오버레이 ★리사이즈 ★핸들의 ★`onMove`
       ★★★왜 ⒥ 가 ★빠져 있었나: ★`git log -S'applyBlockFullBleed' -- js/overlay-handles.js` 가 ★★0커밋이다
         ⇒ ★★한 번도 ★없었다. ★★같은 규약이 ★두 입구 중 ★한 곳에만 ★걸려 있었다.
       ★★실측(★고치기 전 판 `5954e4f4` · ★프레임을 ★패널에서 ★켜고 ★`se` 핸들을 ★끌었다):
         ★켠 뒤      `style.width = calc(100% + 64px)` · `marginLeft = -32px` · 그려진 폭 ★924
         ★★드래그 ★중간 `style.width = ★860px` (★★`calc(` 가 ★★사라졌다) · `marginLeft` 는 ★★-32px ★그대로
         ★up 뒤      ★같다
         ⇒ ★★★«풀린다»가 ★아니라 ★★«어긋난다»다 — ★스위치와 ★음수 마진은 ★남고 ★폭만 ★죽어
           ★블럭이 ★왼쪽으로 ★32px ★밀린 채 ★좁아진다.
       ★★★그래서 ★`onUp` 이 ★아니라 ★★`onMove` 다 — ★★사람은 ★끌면서 ★본다(★중간에 ★이미 ★어긋났다).
         ★그리고 ★`onUp` 은 ★폭을 ★★안 쓴다(★실측: ★up 뒤 값이 ★마지막 ★중간값과 ★같다)
         ⇒ ★★★이 ★한 자리가 ★★두 시점을 ★다 ★덮는다.
       ⚠️★따르는 ★결과를 ★적어 둔다: ★패딩제외가 ★★켜져 있으면 ★★가로 드래그로 ★폭이 ★안 줄어든다
         (★`applyBlockFullBleed` 가 ★폭을 ★`calc(100% + …)` 로 ★되돌린다). ★★세로는 ★그대로 ★준다.
         ★★그건 ★★패널 ★슬라이더가 ★★이미 ★그렇게 ★동작한다 ⇒ ★★두 입구가 ★★같아진다(★그게 ★이 고침의 ★뜻이다). */
    window.applyBlockFullBleed?.(ss);
    if (!isFullWidth) {
      ss.style.height = `${newH}px`; ss.style.minHeight = `${newH}px`; ss.dataset.height = String(newH);
    }
    // 회전한 프레임을 리사이즈하면 AABB 도 같이 변한다 → 세로 마진 보정 재계산.
    // sizeHint 로 넘겨 offsetWidth/Height 재측정(강제 리플로우) 없이 계산한다.
    if (_blockRotationDeg(ss)) applyFrameRotationMargin(ss, { w: newW, h: isFullWidth ? ss.offsetHeight : newH });
    // 그룹: 자식들을 좌상단(0,0) 원점 기준 비례 스케일 (기준은 style 기반 groupStartW/H)
    if (isGroup && groupSnap) {
      const sx = groupStartW ? newW / groupStartW : 1;
      const sy = (!isFullWidth && groupStartH) ? newH / groupStartH : 1;
      const fsScale = Math.min(sx, sy);
      groupSnap.forEach(s => {
        const L = Math.round(s.left * sx), T = Math.round(s.top * sy);
        s.el.style.left = L + 'px'; s.el.dataset.offsetX = String(L);
        s.el.style.top  = T + 'px'; s.el.dataset.offsetY = String(T);
        const W = Math.round(s.w * sx);
        s.el.style.width = W + 'px';
        if (s.el.dataset.width !== undefined && s.el.dataset.width !== '100%') s.el.dataset.width = String(W);
        if (s.isTextFrame) {
          // 텍스트: 높이는 폰트로 결정 → fontSize만 스케일
          if (s.contentEl && s.fs) s.contentEl.style.fontSize = (s.fs * fsScale).toFixed(1) + 'px';
        } else {
          const H = Math.round(s.h * sy);
          s.el.style.height = H + 'px';
          if (s.el.dataset.height !== undefined) s.el.dataset.height = String(H);
        }
      });
    }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    /* 버즈(1012t1Z5 D-1) — 손잡이를 놓았을 때 말풍선이 프레임 밖이면 같은 무늬번호로 안에 다시 맞춘다(안 나갔으면 무동작).
       ⛔끝 표본 «앞»이어야 한다 — 크기 변경과 다시 놓기가 히스토리 한 칸이 된다. */
    window.refitBuzzOnResize?.(ss);
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* 코너 반경 핸들 드래그 — Figma 스타일 */
function _onRadiusHandleMouseDown(e, ss, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startRadius = parseInt(ss.dataset.radius) || 0;

  // 코너 방향에 따른 드래그 방향 (안쪽으로 드래그 = 반경 증가)
  // nw: +x+y → 증가 / ne: -x+y → 증가 / sw: +x-y → 증가 / se: -x-y → 증가
  const _hist = window.beginDragHistory?.('프레임 모서리');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    // 드래그 거리 → 반경 변화 (대각선 방향 평균)
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                : (-dx - dy) / 2; // se
    const newR = Math.min(200, Math.max(0, Math.round(startRadius + delta)));
    ss.dataset.radius = String(newR);
    ss.style.borderRadius = newR + 'px';
    // 프로퍼티 패널 동기화
    const slider = document.getElementById('ss-radius-slider');
    const num    = document.getElementById('ss-radius-num');
    if (slider) slider.value = String(newR);
    if (num)    num.value    = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showFrameHandles = showFrameHandles;
window.hideFrameHandles = hideFrameHandles;

/* ═══════════════════════════════════
   MOCKUP BLOCK RESIZE HANDLES
   좌/우 중앙 핸들 — 가로 크기 조절, 세로는 비율 유지
═══════════════════════════════════ */
let _overlayMockup = null;
let _mockupRafId   = null;

function showMockupHandles(block) {
  if (_overlayMockup === block) return;
  hideMockupHandles();
  _overlayMockup = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  ['nw', 'ne', 'sw', 'se'].forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle mockup-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onMockupHandleMouseDown(e, block, dir));
  });

  _updateMockupHandlePositions();
  function loop() {
    if (!_overlayMockup) return;
    if (!_overlayMockup.isConnected || !_overlayMockup.classList.contains('selected')) {
      hideMockupHandles(); return;
    }
    _updateMockupHandlePositions();
    _mockupRafId = requestAnimationFrame(loop);
  }
  _mockupRafId = requestAnimationFrame(loop);
}

function hideMockupHandles() {
  if (_mockupRafId) { cancelAnimationFrame(_mockupRafId); _mockupRafId = null; }
  _overlayMockup = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.ss-resize-handle.mockup-handle').forEach(h => h.remove());
}

function _updateMockupHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayMockup) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.ss-resize-handle.mockup-handle').forEach(h => {
    const dir = h.dataset.dir;
    const c = _cornerScreen(_overlayMockup, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _onMockupHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX  = e.clientX;
  const startY  = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0  = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startW  = parseInt(block.dataset.width) || parseInt(block.style.width) || 280;

  const _hist = window.beginDragHistory?.('목업 크기');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale  = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로) 후 width축(dx) 사용
    const _ud = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    let newW = dir.includes('e') ? startW + dx : startW - dx;
    newW = Math.round(Math.min(860, Math.max(100, newW)));
    block.dataset.width = String(newW);
    block.style.width   = newW + 'px';
    window.renderMockupBlock?.(block);
    // 프로퍼티 패널 슬라이더 동기화
    const slider = document.getElementById('mkp-width-slider');
    const num    = document.getElementById('mkp-width-number');
    if (slider) slider.value = String(newW);
    if (num)    num.value    = String(newW);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showMockupHandles = showMockupHandles;
window.hideMockupHandles = hideMockupHandles;

/* ═══════════════════════════════════
   ICON BLOCK RESIZE HANDLES
   아이콘 블록 선택 시 4코너 핸들로 크기 조절
   아이콘은 정사각형 — size(width=height) 동시 변경
═══════════════════════════════════ */
let _overlayIcon    = null;
let _iconRafId      = null;

function showIconHandles(block) {
  if (_overlayIcon === block) return;
  hideIconHandles();
  _overlayIcon = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  ['nw', 'ne', 'sw', 'se'].forEach(dir => {
    const h = document.createElement('div');
    h.className = `ss-resize-handle icon-handle ${dir}`;
    h.dataset.dir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onIconHandleMouseDown(e, block, dir));
  });

  _updateIconHandlePositions();
  function loop() {
    if (!_overlayIcon) return;
    if (!_overlayIcon.isConnected || !_overlayIcon.classList.contains('selected')) {
      hideIconHandles(); return;
    }
    _updateIconHandlePositions();
    _iconRafId = requestAnimationFrame(loop);
  }
  _iconRafId = requestAnimationFrame(loop);
}

function hideIconHandles() {
  if (_iconRafId) { cancelAnimationFrame(_iconRafId); _iconRafId = null; }
  _overlayIcon = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.ss-resize-handle.icon-handle').forEach(h => h.remove());
}

function _updateIconHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_overlayIcon) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.ss-resize-handle.icon-handle').forEach(h => {
    const dir = h.dataset.dir;
    const c = _cornerScreen(_overlayIcon, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _onIconHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX  = e.clientX;
  const startY  = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0  = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startSize = parseInt(block.dataset.size) || parseInt(block.style.width) || 64;

  const _hist = window.beginDragHistory?.('아이콘 크기');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale  = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // 대각선 핸들 — dx/dy 중 큰 쪽으로 크기 결정.
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로) 후 판정
    const _ud = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    const delta = (Math.abs(dx) > Math.abs(dy) ? dx : dy);
    let newSize = Math.round(Math.min(512, Math.max(16,
      dir === 'nw' || dir === 'sw' ? startSize - delta : startSize + delta
    )));
    block.dataset.size = String(newSize);
    block.style.width  = newSize + 'px';
    block.style.height = newSize + 'px';
    const svg = block.querySelector('svg');
    if (svg) { svg.setAttribute('width', newSize); svg.setAttribute('height', newSize); }
    const img = block.querySelector('img');
    if (img) { img.width = newSize; img.height = newSize; }
    // 프로퍼티 패널 동기화
    const slider = document.getElementById('icn-size-slider');
    const num    = document.getElementById('icn-size-number');
    if (slider) slider.value = String(newSize);
    if (num)    num.value    = String(newSize);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showIconHandles = showIconHandles;
window.hideIconHandles = hideIconHandles;

/* ═══════════════════════════════════
   ASSET BLOCK CORNER RADIUS HANDLES
   프레임 핸들과 동일한 오버레이에 렌더링
═══════════════════════════════════ */
let _assetRadiusBlock = null;
let _assetRadiusRafId = null;

function showAssetRadiusHandles(ab) {
  if (_assetRadiusBlock === ab) return;
  hideAssetRadiusHandles();
  _assetRadiusBlock = ab;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const r = document.createElement('div');
    r.className = `asset-radius-handle ${dir}`;
    r.dataset.assetRadiusDir = dir;
    r.title = '모서리 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onAssetRadiusHandleMouseDown(e, ab, dir));
  });

  _updateAssetRadiusHandlePositions();
  _startAssetRadiusRaf();
}

function hideAssetRadiusHandles() {
  if (_assetRadiusRafId) { cancelAnimationFrame(_assetRadiusRafId); _assetRadiusRafId = null; }
  _assetRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.asset-radius-handle').forEach(h => h.remove());
}

function _updateAssetRadiusHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_assetRadiusBlock) return;
  const INSET = 10;
  const HALF  = 3.5; // 7px 핸들 중앙 정렬
  /* ★R2-b(2026-10-03) — 「이미지 지우기 ✕」를 덮는 둥글기 손잡이는 «숨긴다». ✕ 는 블럭 오른쪽 위(모델 10px·30px)라 배율 따라
     작아지고 이 손잡이는 화면 크기 고정(INSET 10)이라, 낮은 배율에서 ✕ 위에 앉았다(실측 40%: ✕ 원 113점 중 55점·가운데 포함).
     ⚠️첫 판(aaa94060)은 ne 를 ✕ 아래로 «옮겼다» — 적대QA 가 깼다: 회전 블럭은 건너뛰어 그대로 덮었고(15°·90° 54/168·51/113),
       아주 작은 블럭(높이 40px)에선 ne 가 블럭 밖으로 나가고 se 가 ✕ 를 덮었다(35/113).
     ⇒ 어느 모서리든 ✕ 의 화면 사각형(회전이면 외접 사각형)과 겹치는 손잡이는 숨긴다. 반경은 네 모서리 어느 것으로도 같은 값을
       바꾸므로(_onAssetRadiusHandleMouseDown — 블럭 borderRadius 하나) 남은 손잡이로 기능은 산다. 겹치지 않으면 지금 그대로. */
  const _clear = _assetRadiusBlock.classList.contains('has-image') ? _assetRadiusBlock.querySelector(':scope > .asset-overlay-clear') : null;
  const _cr = _clear ? _clear.getBoundingClientRect() : null;
  overlay.querySelectorAll('.asset-radius-handle').forEach(h => {
    const c = _cornerScreen(_assetRadiusBlock, h.dataset.assetRadiusDir, INSET);
    const hit = !!(_cr && _cr.width && c.x + HALF > _cr.left - 1 && c.x - HALF < _cr.right + 1 && c.y + HALF > _cr.top - 1 && c.y - HALF < _cr.bottom + 1);
    h.style.display = hit ? 'none' : '';
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
    syncHandleSelVariant(h, _assetRadiusBlock);   // 오버레이면 보라 — 테두리와 한 색
  });
}

function _startAssetRadiusRaf() {
  function loop() {
    if (!_assetRadiusBlock) return;
    if (!_assetRadiusBlock.isConnected || !_assetRadiusBlock.classList.contains('selected')) {
      hideAssetRadiusHandles();
      return;
    }
    _updateAssetRadiusHandlePositions();
    _assetRadiusRafId = requestAnimationFrame(loop);
  }
  _assetRadiusRafId = requestAnimationFrame(loop);
}

function _onAssetRadiusHandleMouseDown(e, ab, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startRadius = parseInt(ab.style.borderRadius) || 0;

  const _hist = window.beginDragHistory?.('에셋 모서리');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                : (-dx - dy) / 2;
    const newR = Math.min(120, Math.max(0, Math.round(startRadius + delta)));
    ab.style.borderRadius = newR + 'px';
    // 프로퍼티 패널 동기화
    const slider = document.getElementById('asset-r-slider');
    const num    = document.getElementById('asset-r-number');
    if (slider) slider.value = String(newR);
    if (num)    num.value    = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showAssetRadiusHandles = showAssetRadiusHandles;
window.hideAssetRadiusHandles = hideAssetRadiusHandles;

/* ═══════════════════════════════════
   ASSET BLOCK RESIZE HANDLES (overlay)
   프레임 핸들과 동일한 스타일 / 오버레이 사용
═══════════════════════════════════ */
let _assetResizeBlock = null;
let _assetResizeRafId = null;

function showAssetResizeHandles(ab) {
  /* ★1013t2A2 — 콜라보 켠 로고는 폭이 «칸 수»로 정해진다(모서리로 폭을 끌면 칸이 어긋난다) ⇒ 크기 핸들을 안 단다. 높이는 패널. */
  if (ab?.dataset?.collab) { hideAssetResizeHandles(); return; }
  if (_assetResizeBlock === ab) return;
  hideAssetResizeHandles();
  _assetResizeBlock = ab;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `asset-overlay-handle ${dir}`;
    h.dataset.assetResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onAssetResizeHandleMouseDown(e, ab, dir));
  });
  _updateAssetResizeHandlePositions();
  _startAssetResizeRaf();
}

function hideAssetResizeHandles() {
  if (_assetResizeRafId) { cancelAnimationFrame(_assetResizeRafId); _assetResizeRafId = null; }
  _assetResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.asset-overlay-handle').forEach(h => h.remove());
}

function _updateAssetResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_assetResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.asset-overlay-handle').forEach(h => {
    const c = _cornerScreen(_assetResizeBlock, h.dataset.assetResizeDir);
    const top  = c.y - HALF;
    const left = c.x - HALF;
    h.style.top  = top  + 'px';
    h.style.left = left + 'px';
    syncHandleSelVariant(h, _assetResizeBlock);   // 오버레이면 보라 — 테두리와 한 색
  });
}

function _startAssetResizeRaf() {
  function loop() {
    if (!_assetResizeBlock) return;
    if (!_assetResizeBlock.isConnected || !_assetResizeBlock.classList.contains('selected')) {
      hideAssetResizeHandles();
      return;
    }
    _updateAssetResizeHandlePositions();
    _assetResizeRafId = requestAnimationFrame(loop);
  }
  _assetResizeRafId = requestAnimationFrame(loop);
}

function _onAssetResizeHandleMouseDown(e, ab, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const rect = ab.getBoundingClientRect();
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  // 회전 시 rect는 AABB(부풀림) → 미회전 layout 크기를 기준으로 (회전 0이면 기존과 동일)
  const _rotStart = _blockRotationDeg(ab);
  const startW = _rotStart ? Math.round(ab.offsetWidth)  : Math.round(rect.width  / scale0);
  const startH = _rotStart ? Math.round(ab.offsetHeight) : Math.round(rect.height / scale0);

  const aspectRatio = startW / startH;

  const _hist = window.beginDragHistory?.('에셋 크기');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // 회전된 에셋: 스크린 델타를 로컬축으로 역회전 (회전 0이면 그대로 → 회귀 0)
    const _rd = _unrotateDelta(ab, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _rd.dx;
    const dy = _rd.dy;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    let newW = startW, newH = startH;

    if (ev.shiftKey) {
      // 비례 유지: 더 큰 델타 기준으로 종횡비 고정
      const dw = dir.includes('e') ? dx : dir.includes('w') ? -dx : 0;
      const dh = dir.includes('s') ? dy : dir.includes('n') ? -dy : 0;
      if (Math.abs(dw) >= Math.abs(dh)) {
        newW = Math.min(860, Math.max(ASSET_W_MIN, startW + dw));
        newH = Math.max(40, Math.round(newW / aspectRatio));
      } else {
        newH = Math.max(40, startH + dh);
        newW = Math.min(860, Math.max(ASSET_W_MIN, Math.round(newH * aspectRatio)));
      }
    } else {
      if (dir.includes('e')) newW = Math.min(860, Math.max(ASSET_W_MIN, startW + dx));
      if (dir.includes('w')) newW = Math.min(860, Math.max(ASSET_W_MIN, startW - dx));
      if (dir.includes('s')) newH = Math.max(40, startH + dy);
      if (dir.includes('n')) newH = Math.max(40, startH - dy);
    }
    newW = Math.round(newW); newH = Math.round(newH);
    // 최대폭 복귀 시 ''로 지우면 패딩제외(full-bleed)의 calc()가 사라진다 → 공유 헬퍼로 복원 (08-27)
    /* 폭+음수마진 «세트»로 — 양방향 다(prop-page.js applyAssetWidth). width 단독이면
       최대폭 쪽은 우측이 잘리고, 줄이는 쪽은 풀블리드 음수마진이 남는다(2026-09-20 QA). */
    if (window.applyAssetWidth) window.applyAssetWidth(ab, newW);
    else if (newW >= 860) window.applyAssetFullBleed?.(ab);
    else { ab.style.width = newW + 'px'; ab.style.marginLeft = ''; ab.style.marginRight = ''; }
    ab.style.height = newH + 'px';
    // 우측 패널 슬라이더 동기화
    const wNum = document.getElementById('asset-w-number');
    const wSl  = document.getElementById('asset-w-slider');
    const hNum = document.getElementById('asset-h-number');
    const hSl  = document.getElementById('asset-h-slider');
    if (wNum) { wNum.value = newW; if (wSl) wSl.value = newW; }
    if (hNum) { hNum.value = newH; if (hSl) hSl.value = newH; }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showAssetResizeHandles = showAssetResizeHandles;
window.hideAssetResizeHandles = hideAssetResizeHandles;

/* ═══════════════════════════════════
   MODAL BLOCK — CORNER RADIUS + RESIZE HANDLES (overlay)

   ★에셋 핸들을 «뼈대»로 삼되 코드를 베끼지 않았다 — 두 가지가 다르다.
     ⑴ ★진실이 dataset 이다. renderModalBlock 은 `block.style.cssText = …` 로 인라인 스타일을
        «통째로» 갈아끼운다 ⇒ 에셋처럼 ab.style.width/borderRadius 에 쓰면 재렌더 한 번에 증발한다.
        실측: 인라인 {w:300px, h:222px, r:33px} → renderModalBlock 1회 → {860px, 59.8px, 0px}.
        재렌더는 패널 조작·변형 전환·글자 편집(_modalEndEdit)·로드 어디서든 일어난다.
        ⇒ 드래그가 «끝나면» dataset 이 남아야 한다. 드래그 «중»의 인라인은 미리보기일 뿐이다.
     ⑵ ★클래스가 자기 것(.mdl-*)이다. `.asset-overlay-handle` 을 «빌리면»
        hideAssetResizeHandles() 의 일괄 remove 에 쓸려 나간다 — 아이콘 원형이 실제로 그렇게
        물렸다(실측: 재클릭 시 1→0개, css/editor-blocks.css:223-225 에 기록). CSS 는 «규칙»만 공유한다.
═══════════════════════════════════ */
let _modalRadiusBlock = null;
let _modalRadiusRafId = null;

function showModalRadiusHandles(block) {
  if (_modalRadiusBlock === block) return;
  hideModalRadiusHandles();
  _modalRadiusBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const r = document.createElement('div');
    r.className = `mdl-radius-handle ${dir}`;
    r.dataset.modalRadiusDir = dir;
    r.title = '모서리 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onModalRadiusHandleMouseDown(e, block, dir));
  });

  _updateModalRadiusHandlePositions();
  _startModalRadiusRaf();
}

function hideModalRadiusHandles() {
  if (_modalRadiusRafId) { cancelAnimationFrame(_modalRadiusRafId); _modalRadiusRafId = null; }
  _modalRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.mdl-radius-handle').forEach(h => h.remove());
}

/* ★INSET 을 «상자 크기에 맞춰» 좁힌다 — 에셋의 INSET=10 은 «화면px» 고정이라
   화면 높이가 20px 미만이면 위·아래 라디우스 핸들이 서로 «교차»한다.
   모달 기본 높이는 60px 이므로 줌 33% 이하에서 실제로 교차한다(실측).
   ⛔에셋 쪽 INSET 을 고치면 «에셋 모습»이 바뀐다(공용이다) — 좁히는 일은 이 함수 안에서만 한다. */
function _updateModalRadiusHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_modalRadiusBlock) return;
  const box = _modalRadiusBlock.getBoundingClientRect();   // 화면px — 줌이 이미 곱해진 값
  const INSET = Math.max(0, Math.min(10, box.width / 2 - 4, box.height / 2 - 4));
  const HALF = 3.5; // 7px 핸들 중앙 정렬
  overlay.querySelectorAll('.mdl-radius-handle').forEach(h => {
    const c = _cornerScreen(_modalRadiusBlock, h.dataset.modalRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startModalRadiusRaf() {
  function loop() {
    if (!_modalRadiusBlock) return;
    if (!_modalRadiusBlock.isConnected || !_modalRadiusBlock.classList.contains('selected')) {
      hideModalRadiusHandles();
      return;
    }
    _updateModalRadiusHandlePositions();
    _modalRadiusRafId = requestAnimationFrame(loop);
  }
  _modalRadiusRafId = requestAnimationFrame(loop);
}

function _onModalRadiusHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  /* ★시작값을 style.borderRadius 에서 읽지 «않는다»(에셋은 거기서 읽는다).
     모달은 dataset 이 진실이고, 인라인은 재렌더에 증발하는 미리보기일 뿐이다. */
  const startR = clampModal(block.dataset.radius, MODAL_LIMITS.radius);
  let moved = false;

  const _hist = window.beginDragHistory?.('모달 모서리');
  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (!moved) {
      if (Math.hypot(dx, dy) < 1) return;   // ★기존 임계 — 여기 걸리면 이 틱은 «쓰기»도 안 한다(원래 그랬다)
      // ★«시작 상태»를 1회 찍는다(끝 상태는 onUp). 임계를 넘은 첫 틱이라 쓰기 직전이 맞다.
      _hist?.arm(dx, dy);
      moved = true;
    }
    // 모서리에서 «안쪽»으로 끌면 커진다 — 네 모서리의 부호는 에셋 라디우스와 같은 규약
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                : (-dx - dy) / 2;
    const newR = clampModal(startR + delta, MODAL_LIMITS.radius);
    block.dataset.radius = String(newR);              // ★진실
    block.style.borderRadius = newR + 'px';           // 미리보기(끝나면 재렌더가 같은 값으로 굳힌다)
    /* 패널의 «두 필드»를 다 맞춘다 — 하나만 맞추면 슬라이더와 숫자가 갈라진다.
       슬라이더 step 은 1 이어야 홀수를 담는다(prop-modal.js 의 별도 줄). */
    const slider = document.getElementById('mdl-radius-slider');
    const num    = document.getElementById('mdl-radius-number');
    if (slider) slider.value = String(newR);
    if (num)    num.value    = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
    if (!moved) return;
    window.renderModalBlock?.(block);   // ★dataset 을 «그림»으로 굳힌다
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showModalRadiusHandles = showModalRadiusHandles;
window.hideModalRadiusHandles = hideModalRadiusHandles;

/* ── 모달 리사이즈 핸들 (네 모서리) ── */
let _modalResizeBlock = null;
let _modalResizeRafId = null;

function showModalResizeHandles(block) {
  if (_modalResizeBlock === block) return;
  hideModalResizeHandles();
  _modalResizeBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `mdl-overlay-handle ${dir}`;
    h.dataset.modalResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onModalResizeHandleMouseDown(e, block, dir));
  });
  _updateModalResizeHandlePositions();
  _startModalResizeRaf();
}

function hideModalResizeHandles() {
  if (_modalResizeRafId) { cancelAnimationFrame(_modalResizeRafId); _modalResizeRafId = null; }
  _modalResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.mdl-overlay-handle').forEach(h => h.remove());
}

function _updateModalResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_modalResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.mdl-overlay-handle').forEach(h => {
    const c = _cornerScreen(_modalResizeBlock, h.dataset.modalResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startModalResizeRaf() {
  function loop() {
    if (!_modalResizeBlock) return;
    if (!_modalResizeBlock.isConnected || !_modalResizeBlock.classList.contains('selected')) {
      hideModalResizeHandles();
      return;
    }
    _updateModalResizeHandlePositions();
    _modalResizeRafId = requestAnimationFrame(loop);
  }
  _modalResizeRafId = requestAnimationFrame(loop);
}

function _onModalResizeHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  const startW = Math.round(block.offsetWidth);
  const startH = Math.round(block.offsetHeight);
  const sx = dir.includes('e') ? 1 : -1;
  const sy = dir.includes('s') ? 1 : -1;
  let moved = false;
  const _hist = window.beginDragHistory?.('모달 크기');

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (!moved) {
      if (Math.hypot(dx, dy) < 1) return;   // ★기존 임계 — 여기 걸리면 이 틱은 «쓰기»도 안 한다(원래 그랬다)
      /* ★«시작 상태»를 1회 찍는다(끝 상태는 onUp). 바로 아래 setModalSizeMode 가 이 제스처의 «첫 변형»이다. */
      _hist?.arm(dx, dy);
      moved = true;
      /* ★크기를 «고정»으로 돌리는 것도, 재렌더도 여기 «한 번»뿐이다.
         full → fixed 는 margin-left/right:auto 를 같이 주므로(가운데 정렬) 상자의 기하가
         통째로 바뀐다. 그 변화를 드래그 «중»에 인라인으로 흉내 내면 손을 떼는 순간 튄다. */
      /* ★모드를 바꾸는 문은 하나다 — 「늘어나는 그 순간」의 자동 가운데정렬도 그 안에서 난다.
         여기서 dataset 을 직접 쓰면 핸들 드래그만 «그 순간»을 못 만든다. */
      setModalSizeMode(block, 'w', 'fixed');
      setModalSizeMode(block, 'h', 'fixed');
      block.dataset.width  = String(clampModal(startW, MODAL_LIMITS.width));
      block.dataset.height = String(clampModal(startH, MODAL_LIMITS.height));
      window.renderModalBlock?.(block);
    }
    /* ★★가로는 Δ = 2·dx 다. wMode:'fixed' 가 margin-left/right:auto 를 같이 주므로 상자가
       호스트 «정중앙»에 선다(실측: 폭400 이 860 호스트에서 left=230 = 정중앙).
       가운데 고정 상자는 폭이 Δ 늘 때 각 변이 Δ/2 만 움직인다 ⇒ 에셋 산식(Δ=dx)을 그대로
       쓰면 «커서 100px 에 모서리 50px» 이 된다. w·e 양쪽 다.
       ⚠️세로는 1배다 — 위 변이 흐름에 박혀 있어 상자는 아래로만 자란다. */
    const newW = clampModal(startW + sx * dx * 2, MODAL_LIMITS.width);
    const newH = clampModal(startH + sy * dy,     MODAL_LIMITS.height);
    /* ★dataset 이 진실이다 — 인라인 style 은 재렌더가 cssText 를 갈아끼울 때 증발한다. */
    block.dataset.width  = String(newW);
    block.dataset.height = String(newH);
    /* ⛔mousemove 마다 renderModalBlock 을 부르지 않는다 — innerHTML 을 통째로 갈아끼우므로
       ⑴프레임 드랍 ⑵캐럿·선택 소실 ⑶raster 아이콘의 <img src> 가 매 프레임 새로 만들어져
       깜빡인다. 드래그 «중»엔 인라인 두 줄만 얹는다(끝나면 재렌더가 같은 값으로 덮는다).
       ⚠️height 는 min-height 다 — 내용이 더 크면 상자가 내용을 따른다(안 잘린다). */
    block.style.width = newW + 'px';
    block.style.minHeight = newH + 'px';
    const wNum = document.getElementById('mdl-w-number');
    const hNum = document.getElementById('mdl-h-number');
    if (wNum) wNum.value = String(newW);
    if (hNum) hNum.value = String(newH);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
    if (!moved) return;
    window.renderModalBlock?.(block);       // ★dataset 을 «그림»으로 굳힌다
    window.showModalProperties?.(block);    // 풀폭/고정 버튼·비활성 상태가 실제와 맞게
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showModalResizeHandles = showModalResizeHandles;
window.hideModalResizeHandles = hideModalResizeHandles;

/* ═══════════════════════════════════════════════════════════════════════════
   COUPON BLOCK RESIZE HANDLES (네 모서리 · ★폭만 쓴다) — 현빈 발주 2026-10-07
   ───────────────────────────────────────────────────────────────────────────
   ★뜻 = «폭» 하나다. 높이는 ★쓰지 않고 ★따라온다 — 쿠폰은 16:9 를 스스로 지킨다
     (js/blocks/coupon-block.js `_cpnBoxH`). ⇒ dy 는 ★안 읽는다.
     ⓐ 높이를 따로 쓰면 「비율」이 두 벌이 되고(dataset.height vs cw/ch) 한쪽만 고쳐진다.
     ⓑ 그래서 네 모서리를 다 주지만 ★수평 성분만 센다 — modal 의 ★가운데 고정 산식(Δ=2·dx)을
        그대로 쓴다(쿠폰도 margin-left/right:auto 로 가운데 선다 — renderCouponBlock 의 cssText).
   ★★글자는 ★여기서 안 건드린다. ⛔dataset.slot*Size 를 쓰지 마라 —
     폭이 줄면 renderCouponBlock 이 ★읽는 자리에서 비율을 곱한다(`_cpnEffFontSize`).
     그래서 ★다시 넓히면 원래 크기가 ★되살아난다(zoom-geometry.js:392 와 같은 규약).
     ⇒ 이것이 현빈이 말한 「텍스트 스티커처럼 비율이 줄어든다」의 ★앱 쪽 구현이고,
       식·clamp 는 js/sticker-select.js:320~323 과 ★같다.
   ★이름이 `-overlay-handle` 로 끝나야 tests/unit/overlay-handle-cursor.test.mjs 의 전수
     그물에 자동 등록된다(커서 누락을 기계가 잡는다) — 작명에 이유가 있다.
   ⛔`.mdl-overlay-handle` 을 «빌리면» hideModalResizeHandles 의 일괄 remove 에 쓸려 나간다
     (아이콘원형·확대블럭이 두 번 밟은 함정).
═══════════════════════════════════════════════════════════════════════════ */
let _cpnResizeBlock = null;
let _cpnResizeRafId = null;

function showCouponResizeHandles(block) {
  if (_cpnResizeBlock === block) return;
  hideCouponResizeHandles();
  _cpnResizeBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `cpn-overlay-handle ${dir}`;
    h.dataset.couponResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onCouponResizeHandleMouseDown(e, block, dir));
  });
  _updateCouponResizeHandlePositions();
  _startCouponResizeRaf();
}

function hideCouponResizeHandles() {
  if (_cpnResizeRafId) { cancelAnimationFrame(_cpnResizeRafId); _cpnResizeRafId = null; }
  _cpnResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.cpn-overlay-handle').forEach(h => h.remove());
}

function _updateCouponResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_cpnResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.cpn-overlay-handle').forEach(h => {
    const c = _cornerScreen(_cpnResizeBlock, h.dataset.couponResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startCouponResizeRaf() {
  function loop() {
    if (!_cpnResizeBlock) return;
    if (!_cpnResizeBlock.isConnected || !_cpnResizeBlock.classList.contains('selected')) {
      hideCouponResizeHandles();
      return;
    }
    _updateCouponResizeHandlePositions();
    _cpnResizeRafId = requestAnimationFrame(loop);
  }
  _cpnResizeRafId = requestAnimationFrame(loop);
}

function _onCouponResizeHandleMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX, startY = e.clientY;
  /* ★시작 폭은 «모델»에서 읽는다 — offsetWidth 는 배율·max-width:100% 가 곱해진 화면 값이라
     좁은 호스트에서 첫 틱에 폭이 «쪼그라든다»(아이콘 스냅샷이 밟은 그 병과 같은 꼴). */
  const lim = (typeof window !== 'undefined' && window.COUPON_LIMITS) || { width: { min: 80, max: 860 } };
  const clamp = (typeof window !== 'undefined' && window.clampCoupon)
    || ((v, L) => Math.min(L.max, Math.max(L.min, Math.round(Number(v) || 0))));
  const startW = clamp(Number(block.dataset.width) || Math.round(block.offsetWidth), lim.width);
  const sx = dir.includes('e') ? 1 : -1;
  let moved = false;
  const _hist = window.beginDragHistory?.('쿠폰 크기');

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (!moved) {
      if (Math.hypot(dx, dy) < 1) return;   // ★기존 임계 — 여기 걸리면 이 틱은 «쓰기»도 안 한다
      /* ★«시작 상태»를 1회 찍는다(끝 상태는 onUp). 드래그는 «양쪽 끝»을 다 남겨야
         삽입(push-before) 뒤 첫 드래그에서 ⌘Z 가 삽입까지 먹지 않는다(js/drag-history.js). */
      _hist?.arm(dx, dy);
      moved = true;
    }
    /* ★Δ = 2·dx — 가운데 고정 상자는 폭이 Δ 늘 때 각 변이 Δ/2 만 움직인다(modal 의 그 산식).
       ⛔dy 는 ★안 쓴다 — 높이는 비율에서 나온다(이 절의 머리말 ⓐ). */
    const newW = clamp(startW + sx * dx * 2, lim.width);
    block.dataset.width = String(newW);     // ★dataset 이 진실
    /* ⛔mousemove 마다 renderCouponBlock 을 부르지 않는다 — innerHTML 을 통째로 갈아끼운다
       (프레임 드랍 · 배경 SVG 가 매 프레임 새로 만들어져 깜빡인다).
       ★드래그 «중»엔 인라인 두 줄만 얹는다 — 글자는 ★손을 뗀 뒤 재렌더가 비율로 맞춘다.
         그래서 드래그 중에는 글자가 «안 줄고» 상자만 줄어 보인다. 이것이 의도다
         (modal 도 같은 까닭으로 드래그 중 재렌더를 안 한다). */
    block.style.width = newW + 'px';
    const h = window.cpnBoxH ? window.cpnBoxH(block, newW) : null;
    if (h) block.style.height = h + 'px';
    const wNum = document.getElementById('cpn-width-number');
    const wSld = document.getElementById('cpn-width-slider');
    if (wNum) wNum.value = String(newW);
    if (wSld) wSld.value = String(newW);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다. 시작 상태는 onMove 의 arm() 이 찍는다. */
    window.pushHistory?.();
    if (!moved) return;
    window.renderCouponBlock?.(block);       // ★dataset 을 «그림»으로 굳힌다(글자 비율도 여기서)
    window.showCouponProperties?.(block);    // 폭·높이 안내·「지금 화면 크기」가 실제와 맞게
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showCouponResizeHandles = showCouponResizeHandles;
window.hideCouponResizeHandles = hideCouponResizeHandles;

/* ═══════════════════════════════════
   ICON-CIRCLE BLOCK RESIZE HANDLE (overlay, east-only, square-constrained)
═══════════════════════════════════ */
let _icbResizeBlock = null;
let _icbResizeRafId = null;

function showIconCircleResizeHandle(block) {
  if (_icbResizeBlock === block) return;
  hideIconCircleResizeHandle();
  _icbResizeBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;

  /* ★네 «모서리»에 다 단다 — 에셋 블록(.asset-block)과 개수·종류를 맞춘다.
   * 전엔 se 한 개뿐이라 「다른 에셋 블럭과 조금씩 다르다」(현빈)의 한 축이었다.
   * ⚠️클래스는 `.icb-overlay-handle` — `.asset-overlay-handle` 을 «빌려 쓰면»
   *   `hideAssetResizeHandles()` 의 일괄 제거에 같이 쓸려나간다(실측 재현: 재클릭 시 1→0). */
  const _handles = CORNER_DIRS.map(dir => {
    const h = document.createElement('div');
    h.className = `icb-overlay-handle ${dir}`;
    h.dataset.icbResize = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onIcbResizeMouseDown(e, block, dir));
    return h;
  });

  function _onIcbResizeMouseDown(e, block, dir) {
    if (e.button !== 0) return;
    e.stopPropagation(); e.preventDefault();
    const startX = e.clientX;
    const startY = e.clientY;
    const startSize = parseInt(block.dataset.size) || 240;
    const { sx, sy } = cornerSign(dir);

    const _hist = window.beginDragHistory?.('아이콘서클 크기');
    function onMove(ev) {
      const scaler = document.getElementById('canvas-scaler');
      const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
      // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
      const _ud = _unrotateDelta(block, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
      // 바깥으로 끌면 커진다 — 모서리마다 «바깥»의 부호가 달라 위 표로 뒤집는다.
      const dx = _ud.dx * sx, dy = _ud.dy * sy;
      /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라. */
      _hist?.arm(dx, dy);
      const delta = Math.abs(dx) >= Math.abs(dy) ? dx : dy;
      const newSize = Math.min(860, Math.max(40, Math.round(startSize + delta)));
      const circle = block.querySelector('.icb-circle');
      if (circle) { circle.style.width = newSize + 'px'; circle.style.height = newSize + 'px'; }
      block.dataset.size = newSize;
      // prop panel sync
      const sl = document.getElementById('icb-size-slider');
      const nb = document.getElementById('icb-size-number');
      if (sl) sl.value = newSize;
      if (nb) nb.value = newSize;
      window.scheduleAutoSave?.();
    }
    function onUp() {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
         드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
      window.pushHistory?.();
    }
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }

  function _updatePos() {
    if (!_icbResizeBlock) return;
    const circle = block.querySelector('.icb-circle');
    if (!circle) return;
    const rect = circle.getBoundingClientRect();
    /* ★핸들은 «상자 꼭지점»에 둔다 — 다른 모든 블록과 같은 자리다(현빈 확정).
     * 「원처럼 보이는 일」은 아웃라인이 맡는다(.icon-circle-block.selected 의 border-radius:50%).
     * ⇒ 잡는 자리는 앱 전체가 동일하고, 보이는 모양만 블록마다 다르다. */
    /* ★반지름은 «레이아웃 폭»에서 낸다 — rect.width 를 쓰면 회전했을 때 부푼다.
     * getBoundingClientRect 는 회전된 요소의 «축정렬 바운딩박스(AABB)» 라
     * 30° 회전 시 96px 원의 rect 가 131px 로 잡혔다(실측) → 핸들이 원 밖 17.5px 로 떠버린다.
     * 회전은 중심을 보존하므로 «중심은 rect 에서», «반지름은 offsetWidth×캔버스배율»에서 가져온다.
     * 원은 회전대칭이라 45° 화면좌표에 그대로 두면 어느 각도에서도 둘레에 밀착한다. */
    const R  = (circle.offsetWidth * _canvasScaleNow()) / 2;
    const cx = rect.left + rect.width  / 2;
    const cy = rect.top  + rect.height / 2;
    const off = circumferenceOffset(R);   // 45° 둘레점까지의 축별 거리(공용 헬퍼)
    _handles.forEach(h => {
      const { sx, sy } = cornerSign(h.dataset.icbResize);
      h.style.left = (cx + off * sx - 3.5) + 'px';
      h.style.top  = (cy + off * sy - 3.5) + 'px';
      syncHandleSelVariant(h, block);   // 띄우면 보라 — 테두리와 «한 색»(현빈 icb_k7kbb_msmevtj · 에셋 :826 과 같은 꼴)
    });
  }
  function _loop() {
    if (!_icbResizeBlock) return;
    if (!_icbResizeBlock.isConnected || !_icbResizeBlock.classList.contains('selected')) {
      hideIconCircleResizeHandle(); return;
    }
    _updatePos();
    _icbResizeRafId = requestAnimationFrame(_loop);
  }
  _updatePos();
  _icbResizeRafId = requestAnimationFrame(_loop);
}

function hideIconCircleResizeHandle() {
  if (_icbResizeRafId) { cancelAnimationFrame(_icbResizeRafId); _icbResizeRafId = null; }
  _icbResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-icb-resize]').forEach(h => h.remove());
}

window.showIconCircleResizeHandle = showIconCircleResizeHandle;
window.hideIconCircleResizeHandle = hideIconCircleResizeHandle;

/* ═══════════════════════════════════
   CANVAS BLOCK RADIUS HANDLES (overlay)
═══════════════════════════════════ */
let _canvasRadiusBlock = null;
let _canvasRadiusRafId = null;

function showCanvasRadiusHandles(cb) {
  if (_canvasRadiusBlock === cb) return;
  hideCanvasRadiusHandles();
  _canvasRadiusBlock = cb;
  const overlay = _getOverlay();
  if (!overlay) return;

  /* ★[M39] 현빈 2026-09-05: 「카드 블럭 코너라디우스 조절하는거 좌측 상단에만 핸들이 있는데」
     옛 코드는 'nw' 를 «문자열로 박아» 한 개만 만들었다. 에셋 블록(:611)은 처음부터
     CORNER_DIRS 네 개를 돈다 — 같은 표를 쓰게 맞춘다(핸들 CSS 는 방향별 규칙이 없어 그대로 쓴다). */
  CORNER_DIRS.forEach(dir => {
    const r = document.createElement('div');
    r.className = `canvas-radius-handle ${dir}`;
    r.dataset.canvasRadiusDir = dir;
    r.title = '모서리 반경 조절';
    overlay.appendChild(r);
    r.addEventListener('mousedown', e => _onCanvasRadiusHandleMouseDown(e, cb, dir));
  });

  _updateCanvasRadiusHandlePositions();
  _startCanvasRadiusRaf();
}

function hideCanvasRadiusHandles() {
  if (_canvasRadiusRafId) { cancelAnimationFrame(_canvasRadiusRafId); _canvasRadiusRafId = null; }
  _canvasRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.canvas-radius-handle').forEach(h => h.remove());
}

function _updateCanvasRadiusHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_canvasRadiusBlock) return;
  const INSET = 10;
  const HALF  = 3.5; // 7px 핸들 중앙 정렬
  /* ★[M39] 옛 코드는 rect.top/left 로 «좌상단 하나»만 계산했다. 에셋 판(:638)과 같은
     _cornerScreen(el, dir, inset) 을 쓴다 — 이건 «회전한 블록»의 모서리도 맞게 돌려준다
     (rect 기반 계산은 회전하면 어긋난다. 카드가 회전 대상이 되면 옛 식은 조용히 틀린다). */
  overlay.querySelectorAll('.canvas-radius-handle').forEach(h => {
    const c = _cornerScreen(_canvasRadiusBlock, h.dataset.canvasRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startCanvasRadiusRaf() {
  function loop() {
    if (!_canvasRadiusBlock) return;
    if (!_canvasRadiusBlock.isConnected || !_canvasRadiusBlock.classList.contains('selected')) {
      hideCanvasRadiusHandles();
      return;
    }
    _updateCanvasRadiusHandlePositions();
    _canvasRadiusRafId = requestAnimationFrame(loop);
  }
  _canvasRadiusRafId = requestAnimationFrame(loop);
}

function _onCanvasRadiusHandleMouseDown(e, cb, dir = 'nw') {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startRadius = parseInt(cb.dataset.radius) || 0;

  const _hist = window.beginDragHistory?.('카드 모서리');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    /* ★[M39] 현빈 2026-09-05: 「드래그하면 에셋블럭의 모서리 코너핸들과 라디우스 적용되는게
       반대인데 카드블럭을 고쳐줘」 — 정본은 «에셋»이라고 현빈이 지정했다.
       ⑴ 부호가 뒤집혀 있었다: 에셋은 `startRadius + delta`, 카드만 `- delta` 였다.
          같은 방향으로 끌면 에셋은 «커지고» 카드는 «작아졌다».
       ⑵ 그리고 옛 식은 방향을 안 봤다(항상 nw 판 (dx+dy)/2). 핸들이 하나뿐이라 티가 안 났을
          뿐이고, 네 개로 늘리는 순간 ne·sw·se 가 «반대로» 움직인다 — ①을 고치면 반드시
          같이 고쳐야 하는 자리다(둘은 한 결함의 두 얼굴이다).
       ⇒ 에셋(:670)과 «같은 식»을 쓴다. 안쪽으로 끌면 커진다.
       ⚠️상한 60 은 카드의 «설계 상수»라 그대로 둔다(에셋 120 과 다른 건 의도 — 카드가 더 작다). */
    const { sx, sy } = cornerSign(dir);
    const delta = (-sx * dx + -sy * dy) / 2;
    const newR = Math.min(60, Math.max(0, Math.round(startRadius + delta)));
    cb.dataset.radius = String(newR);
    window.renderCanvas(cb);
    const rSlider = document.getElementById('cvb-radius-slider');
    const rNumber = document.getElementById('cvb-radius-number');
    if (rSlider) rSlider.value = String(newR);
    if (rNumber) rNumber.value = String(newR);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showCanvasRadiusHandles = showCanvasRadiusHandles;
window.hideCanvasRadiusHandles = hideCanvasRadiusHandles;

/* ═══════════════════════════════════
   CANVAS BLOCK RESIZE HANDLES (overlay)
═══════════════════════════════════ */
let _canvasResizeBlock = null;
let _canvasResizeRafId = null;

function showCanvasResizeHandles(cb) {
  if (_canvasResizeBlock === cb) return;
  hideCanvasResizeHandles();
  _canvasResizeBlock = cb;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `canvas-overlay-handle ${dir}`;
    h.dataset.canvasResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onCanvasResizeHandleMouseDown(e, cb, dir));
  });
  _updateCanvasResizeHandlePositions();
  _startCanvasResizeRaf();
}

function hideCanvasResizeHandles() {
  if (_canvasResizeRafId) { cancelAnimationFrame(_canvasResizeRafId); _canvasResizeRafId = null; }
  _canvasResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.canvas-overlay-handle').forEach(h => h.remove());
}

function _updateCanvasResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_canvasResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.canvas-overlay-handle').forEach(h => {
    const dir = h.dataset.canvasResizeDir;
    const c = _cornerScreen(_canvasResizeBlock, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startCanvasResizeRaf() {
  function loop() {
    if (!_canvasResizeBlock) return;
    if (!_canvasResizeBlock.isConnected || !_canvasResizeBlock.classList.contains('selected')) {
      hideCanvasResizeHandles();
      return;
    }
    _updateCanvasResizeHandlePositions();
    _canvasResizeRafId = requestAnimationFrame(loop);
  }
  _canvasResizeRafId = requestAnimationFrame(loop);
}

function _onCanvasResizeHandleMouseDown(e, cb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const scaler0 = document.getElementById('canvas-scaler');
  const scale0 = scaler0 ? parseFloat(scaler0.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
  const startW = parseInt(cb.dataset.canvasW) || 360;
  const startH = parseInt(cb.dataset.canvasH) || 400;
  // 최대 폭 = 섹션 내부 콘텐츠폭(좌우 패딩 제외) — 프레임 리사이즈 로직(상단 _onResizeHandleMouseDown:110-113)과 동일.
  // 기존엔 860 하드코딩이라 우측 확대 시 섹션 우측패딩을 침범(좌측만 지켜 좌우 비대칭)했음.
  const _secInner = cb.closest('.section-inner') || cb.closest('.section-block');
  const _secCS = _secInner ? getComputedStyle(_secInner) : null;
  const _padH = _secCS ? (parseFloat(_secCS.paddingLeft) || 0) + (parseFloat(_secCS.paddingRight) || 0) : 0;
  const _innerW = _secInner ? _secInner.clientWidth : 0;
  // 레이아웃 미확정/detached 등으로 clientWidth=0(또는 NaN)이면 860 폴백 (실제 리사이즈는 렌더된 카드에서만 발생하므로 정상 경로엔 영향 없음)
  const _maxWcalc = Math.round(_innerW - _padH);
  const maxW = (_innerW > 0 && _maxWcalc > 0) ? _maxWcalc : 860;

  const _hist = window.beginDragHistory?.('카드 크기');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
    const _ud = _unrotateDelta(cb, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.min(maxW, Math.max(100, startW + dx));
    if (dir.includes('w')) newW = Math.min(maxW, Math.max(100, startW - dx));
    if (dir.includes('s')) newH = Math.max(40, startH + dy);
    if (dir.includes('n')) newH = Math.max(40, startH - dy);
    newW = Math.round(newW); newH = Math.round(newH);
    cb.dataset.canvasW = String(newW);
    cb.dataset.canvasH = String(newH);
    window.renderCanvas(cb);
    const wInput = document.getElementById('cvb-w');
    const hInput = document.getElementById('cvb-h');
    if (wInput) wInput.value = String(newW);
    if (hInput) hInput.value = String(newH);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showCanvasResizeHandles = showCanvasResizeHandles;
window.hideCanvasResizeHandles = hideCanvasResizeHandles;

// ── Vector Block overlay resize handles ──────────────────────────────────────
let _vectorResizeBlock = null;
let _vectorResizeRafId = null;

function showVectorResizeHandles(vb) {
  if (_vectorResizeBlock === vb) return;
  hideVectorResizeHandles();
  _vectorResizeBlock = vb;
  const overlay = _getOverlay();
  if (!overlay) return;

  const dirs = ['nw', 'ne', 'sw', 'se'];
  dirs.forEach(dir => {
    const h = document.createElement('div');
    h.className = `vector-overlay-handle ${dir}`;
    h.dataset.vectorResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onVectorResizeHandleMouseDown(e, vb, dir));
  });
  _updateVectorResizeHandlePositions();
  _startVectorResizeRaf();
}

function hideVectorResizeHandles() {
  if (_vectorResizeRafId) { cancelAnimationFrame(_vectorResizeRafId); _vectorResizeRafId = null; }
  _vectorResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.vector-overlay-handle').forEach(h => h.remove());
}

function _updateVectorResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_vectorResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('.vector-overlay-handle').forEach(h => {
    const dir = h.dataset.vectorResizeDir;
    const c = _cornerScreen(_vectorResizeBlock, dir); // #14b 회전 인식(회전0=rect 모서리 동일)
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startVectorResizeRaf() {
  function loop() {
    if (!_vectorResizeBlock) return;
    if (!_vectorResizeBlock.isConnected || !_vectorResizeBlock.classList.contains('selected')) {
      hideVectorResizeHandles();
      return;
    }
    _updateVectorResizeHandlePositions();
    _vectorResizeRafId = requestAnimationFrame(loop);
  }
  _vectorResizeRafId = requestAnimationFrame(loop);
}

function _onVectorResizeHandleMouseDown(e, vb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startX = e.clientX;
  const startY = e.clientY;
  const startW = parseInt(vb.dataset.w) || 120;
  const startH = parseInt(vb.dataset.h) || 120;

  const _hist = window.beginDragHistory?.('벡터 크기');
  function onMove(ev) {
    const scaler = document.getElementById('canvas-scaler');
    const scale = scaler ? parseFloat(scaler.style.transform?.match(/scale\(([^)]+)\)/)?.[1] || '1') : 1;
    // #14b 회전 인식: 스크린 델타를 블록 로컬축으로 역회전(회전0=그대로)
    const _ud = _unrotateDelta(vb, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dx = _ud.dx, dy = _ud.dy;
    /* ★«시작 상태»를 여기서 1회 찍는다(끝 상태는 onUp 의 pushHistory). ⛔반환값으로 return 하지 마라
       — 임계 미만 틱에서 쓰기까지 삼켜 줌 150% 의 1px 조정이 무동작이 된다(js/drag-history.js 규약⑵). */
    _hist?.arm(dx, dy);
    let newW = startW, newH = startH;
    if (dir.includes('e')) newW = Math.max(20, startW + dx);
    if (dir.includes('w')) newW = Math.max(20, startW - dx);
    if (dir.includes('s')) newH = Math.max(20, startH + dy);
    if (dir.includes('n')) newH = Math.max(20, startH - dy);
    newW = Math.round(newW); newH = Math.round(newH);
    vb.dataset.w = String(newW);
    vb.dataset.h = String(newH);
    window.renderVector(vb);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태를 찍는다(기존 호출 유지). 시작 상태는 onMove 의 arm() 이 찍는다 —
       드래그는 «양쪽 끝»을 다 남겨야 어느 이웃 규약을 만나도 표본이 안 빈다(js/drag-history.js). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showVectorResizeHandles = showVectorResizeHandles;
window.hideVectorResizeHandles = hideVectorResizeHandles;

/* ═══════════════════════════════════
   GRID BLOCK ROW/COLUMN GUTTER OVERLAY (P2 — 셀 경계 드래그, PLAN-gridblock.md §5)
   grid-block(사용자에게는 「그리드 블럭」)이 선택돼 있을 때 열/행 경계에 드래그 가능한
   거터(grd-gutter)를 띄운다. 여기 있는 6종 handle(frame/mockup/icon/asset/canvas/vector)은
   전부 블록 «바깥 테두리»를 px로 늘리는 핸들이라 못 쓴다(PLAN §5-A) — 대신 이 파일의
   #ss-handles-overlay 자리와 rAF 위치갱신·hide 패턴만 그대로 빌린다.
   ⛔거터 DOM 을 블록 «안»에 넣지 않는다 — #ss-handles-overlay는 #canvas-scaler 바깥(캔버스
     클론 대상 밖)이라 저장본·export 에 새지 않는다(완료조건① — section-serialize.js가
     세척하는 root 자체에 애초에 없음).
   ★열 값은 항상 «가중치»(cols[i].width, px 미사용 — 폭 계산 함정 회피). 행 값은 «px 최소높이»
     (rows[r].height) — 재분배가 아니라 «위 행 하나만» 바뀐다(P1 R2 모델, PLAN §3-A/§5-B-3).
   ★DOM 구조(2026-09-04 P1 병합) — flex `.duo-col` → CSS grid `.grd-cell[data-r][data-c]`.
     열 경계는 행0(data-r="0")의 인접 셀, 행 경계는 열0(data-c="0")의 인접 셀에서 rect를 잰다
     (grid-template-columns/rows 가 블록 전역이라 어느 행/열을 봐도 폭/높이는 같다).
═══════════════════════════════════ */
let _gridGutterBlock = null;
let _gridGutterRafId = null;

function _getGridCell(block, r, c) {
  return block.querySelector(`:scope > .grd-inner > .grd-cell[data-r="${r}"][data-c="${c}"]`);
}

function showGridGutters(block) {
  const { cols, rows } = getGridModel(block);   // 단일 진실원(grid-block.js) — 여기서 재파싱하지 않는다
  /* ★같은 블록이어도 «격자 수»가 바뀌었으면 다시 세워야 한다.
   * 전엔 `_gridGutterBlock === block` 이면 위치만 갱신하고 return 했다 —
   * 그래서 3x3 으로 바꿔도 거터가 옛 개수 그대로였다(실측: col 1개).
   * 피커 경로만 밖에서 강제로 고쳤더니 updateGridBlock→showGridProperties 경로가 그대로 남았다.
   * 고칠 자리는 «여기»다 — 개수 비교를 조기 return 조건에 넣는다. */
  /* ★«축별»로 센다. 합으로 비교하면 3x2 → 2x3 처럼 «합이 같은» 전환에서
   * 재생성이 안 돌아 row 거터가 하나 안 생긴다(적대검수 2차 지적).
   * 열 2 + 행 1 = 3 과 열 1 + 행 2 = 3 은 합이 같지만 «다른 격자»다. */
  const needCol = Math.max(0, cols.length - 1);
  const needRow = Math.max(0, rows.length - 1);
  if (_gridGutterBlock === block) {
    const ovl = _getOverlay();
    const haveCol = ovl ? ovl.querySelectorAll('.grd-gutter[data-axis="col"]').length : 0;
    const haveRow = ovl ? ovl.querySelectorAll('.grd-gutter[data-axis="row"]').length : 0;
    /* ★S11 — 중첩 거터도 «축별로» 센다. 안 세면 「줄을 나눴는데 거터가 안 선다」가 난다
       (바깥 격자 수는 그대로라 조기 return 이 걸린다 — 위 3x3 회귀와 ★같은 꼴이다). */
    const haveNcol = ovl ? ovl.querySelectorAll('.grd-gutter[data-axis="ncol"]').length : 0;
    const needNcol = _gridNestedLines(block).reduce((a, nl) => a + Math.max(0, nl.n - 1), 0);
    /* ★t3-04 U2a — 머리띠도 «축별로» 센다(거터와 ★다른 클래스라 위 셈에 안 섞인다 · 열 N 개 · 행 M 개).
       ⚠️이름은 «자리»다(A = 0번째 열) ⇒ 순서를 바꿔도 수·글자가 같다. 옮긴 «뒤»의 다시 세우기는
         끄는 손(_onGridHeadbandMouseDown)이 hide → show 로 «강제»한다(중첩 거터 옛 주소 — precheck ⑶). */
    const haveBandCol = ovl ? ovl.querySelectorAll('.grd-headband[data-axis="col"]').length : 0;
    const haveBandRow = ovl ? ovl.querySelectorAll('.grd-headband[data-axis="row"]').length : 0;
    if (haveCol === needCol && haveRow === needRow && haveNcol === needNcol
        && haveBandCol === cols.length && haveBandRow === rows.length) { _updateGridGutterPositions(); return; }
  }
  hideGridGutters();
  /* ★S11 — 중첩 줄이 있으면 바깥이 1×1 이어도 «경계»가 있다. 안 고치면 1열 그리드의
     나눈 줄에 거터가 영영 안 선다(현빈의 쓰임에 바로 걸린다).
     ★t3-04 U2a — 옛 「경계가 하나도 없으면(1×1 · 중첩 없음) return」을 ★걷었다.
       확정 ①「머리띠는 그리드를 고른 동안만 보인다」 ⇒ 1×1 도 머리띠(A · 1)가 선다(«해석» — 옮길 것은 없지만
       «고른 동안 보인다»를 판마다 다르게 하지 않는다). 그 return 이 있으면 루프가 안 서서 해제 때 머리띠가 남는다.
       ★거터 수는 그대로다 — 아래 for 들이 cols.length−1 · rows.length−1 이라 1×1 에서 0 개(옛 동작과 같다). */
  _gridGutterBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;
  for (let i = 0; i < cols.length - 1; i++) {
    const g = document.createElement('div');
    g.className = 'grd-gutter';
    g.dataset.axis = 'col';
    g.dataset.i = String(i);
    // ★position:absolute — #ss-handles-overlay 자체가 position:fixed;inset:0(css/editor-blocks.css:78)
    //   이라 자식은 absolute 로 둬도 좌표계가 뷰포트와 같다(.ss-resize-handle 등 기존 핸들과 동일 관례).
    g.style.cssText = 'position:absolute;width:8px;cursor:col-resize;z-index:97;pointer-events:auto;';
    overlay.appendChild(g);
    g.addEventListener('mousedown', e => _onGridColMouseDown(e, block, i));
    _wireGutterContextMenu(g, block);
  }
  /* ★S11 — 중첩 줄(.grd-nested) «안» 두 칸 사이에도 거터를 둔다. 열 N 개면 ★N−1 개.
     ⛔바깥 거터 수는 ★안 늘린다 — data-axis 를 'ncol' 로 ★갈라 둔다(검사가 그 수를 따로 센다). */
  for (const nl of _gridNestedLines(block)) {
    for (let i = 0; i < nl.n - 1; i++) {
      const g = document.createElement('div');
      g.className = 'grd-gutter';
      g.dataset.axis = 'ncol';
      g.dataset.r = String(nl.r); g.dataset.c = String(nl.c); g.dataset.li = String(nl.li);
      g.dataset.i = String(i);
      g.style.cssText = 'position:absolute;width:8px;cursor:col-resize;z-index:97;pointer-events:auto;';
      overlay.appendChild(g);
      g.addEventListener('mousedown', e => _onGridNestedColMouseDown(e, block, { r: nl.r, c: nl.c, li: nl.li }, i));
    }
  }
  for (let i = 0; i < rows.length - 1; i++) {
    const g = document.createElement('div');
    g.className = 'grd-gutter';
    g.dataset.axis = 'row';
    g.dataset.i = String(i);
    g.style.cssText = 'position:absolute;height:8px;cursor:row-resize;z-index:97;pointer-events:auto;';
    overlay.appendChild(g);
    g.addEventListener('mousedown', e => _onGridRowMouseDown(e, block, i));
    _wireGutterContextMenu(g, block);
  }
  _createGridHeadbands(overlay, block, cols.length, rows.length);   // ★t3-04 U2a — 머리띠(아래 절)
  _updateGridGutterPositions();
  _startGridGutterRaf();
}

/* ★거터 위 우클릭도 «블록의» 컨텍스트 메뉴로 보낸다 (2026-09-20, 0920b-grid-image).
 *   거터는 #ss-handles-overlay 의 자식 = «블록 바깥» 요소다. 그래서 여기서 우클릭하면
 *   block-drag.js 가 블록에 건 contextmenu 리스너가 «아예 안 불리고» 메뉴 자체가 안 떴다
 *   (8px 띠지만 40% 줌에선 칸 경계 대부분이 이 띠 아래로 들어온다).
 *   ⛔거터를 pointer-events:none 으로 바꾸는 식으로 풀지 마라 — 열/행 리사이즈가 죽는다. */
function _wireGutterContextMenu(g, block) {
  g.addEventListener('contextmenu', e => {
    if (window._openBlockContextMenu) window._openBlockContextMenu(e, block);
  });
}

function hideGridGutters() {
  if (_gridGutterRafId) { cancelAnimationFrame(_gridGutterRafId); _gridGutterRafId = null; }
  _gridGutterBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.grd-gutter').forEach(g => g.remove());
  /* ★t3-04 U2a — 머리띠·놓을 자리 선도 «같은 생애»에 묶는다(확정 ①: 고른 동안만). ⛔위 줄과 합치지 마라 —
     tests/unit/overlay-raf-resync U-M66-5 가 위 줄 꼴을 글자로 잰다. */
  if (overlay) overlay.querySelectorAll('.grd-headband, .grd-headband-drop').forEach(el => el.remove());
  _grdRangeReset(overlay);   /* ★t3-04 U2b — 칸 범위도 «같은 생애»(고른 동안만) · ⛔위 두 줄과 합치지 마라(U-M66-5) */
}

function _startGridGutterRaf() {
  function loop() {
    if (!_gridGutterBlock) return;
    // 블록이 DOM에서 사라졌거나 선택 해제되면 거터 제거 — showFrameHandles rAF 패턴과 동일.
    if (!_gridGutterBlock.isConnected || !_gridGutterBlock.classList.contains('selected')) {
      hideGridGutters();
      return;
    }
    _updateGridGutterPositions();
    _gridGutterRafId = requestAnimationFrame(loop);
  }
  _gridGutterRafId = requestAnimationFrame(loop);
}

/* ═══ [M64] 행 거터가 «낮은 배율에서» 칸의 편집 진입을 삼킨다 ═══════════════════════
   미니4호기 윈도우 QA 보고 → 맥 재현(2026-09-06, 9371 · 3열×4행 · 행높이 210px).
   ⛔보고서의 「거터가 21px 짜리 칸을 통째로 덮는다」는 «틀렸다» — 실측하면 거터는 칸의
     «맨 위 2.8px»만 덮는다. 문제는 덮는 «넓이»가 아니라 «자리»다:
       · 편집 가능한 표적은 칸 전체가 아니라 그 안의 글줄(`[data-line]`) «하나»다.
       · valign:top 이라 글줄은 칸의 «맨 위»에 붙는다 — 거터가 파고드는 바로 그 자리다.
       · 10% 에서 글줄 높이 = 35.2×0.1 = 3.52px, 그 중앙은 칸 위끝에서 1.76px.
         거터는 위끝에서 2.8px 까지 덮는다(4 − gap·s/2 = 4 − 1.2). 1.76 < 2.8 ⇒ 삼킨다.
   [실측 — «진짜 더블클릭»(Input.dispatchMouseEvent clickCount 1→2) 12칸 × 배율]
       10%: 편집진입 3/12 (막힘 9, 전부 거터)      13%: 3/12 (막힘 9)
       15%: 12/12                                  25%·40%: 12/12    100%: 9/9(3칸 화면밖)
     ★막히는 칸은 «위에 거터가 있는 행»(1·2·3행) 전부고, 0행은 10% 에서도 들어간다 —
       0행 위에는 경계가 없다. 이 대조가 「10% 라서 다 안 되는 것」이 아님을 증명한다.
     ★깨지는 구간은 s < 4/((gap+lineH)/2) = 4/29.6 ≈ 0.135 — 즉 «10~13%» 뿐이다(측정과 일치).
   ⛔그냥 얇게 만들면 안 된다 — 거터가 «화면 고정 8px»인 건 낮은 배율에서 «잡으라»는 뜻이다.
     8px 를 4px 로 줄이면 이번엔 거터를 못 잡는다. ⇒ «둘 다 잡히는» 자리를 찾아야 한다.
   ★답 = 거터를 경계 «중앙 정렬»에서 풀고, 위/아래 절반을 «각자» 이웃 칸의 글줄 중앙까지만
     뻗게 한다(비대칭 허용). valign:top 이면 위 칸의 «아래쪽»은 언제나 비어 있으므로
     위 절반이 4px 를 그대로 갖고, 아래 절반만 글줄을 피해 줄어든다:
       10% 실측 → 위 4.00 + 아래 2.21 = 6.21px 거터(잡을 수 있다) · 글줄 중앙은 0.75px 여유로 열림.
   ⚠️대가 ⑴ 아주 낮은 배율에서 거터가 경계보다 «살짝 위»에 앉는다(비대칭). 경계선 자체는
        위 절반 4px 가 여전히 덮으므로 「보이는 선을 누르면 잡힌다」는 유지된다.
     ⑵ 위·아래 «둘 다» 글줄이 경계에 붙은 병리적 배치(valign:bottom + 다음 칸 top)에서는
        GUT_MIN_TOTAL floor 가 이겨서 거터가 글줄을 조금 덮는다 — 「거터를 아예 못 잡는다」보다
        낫다고 판단했다. 그 경우에도 사용자는 배율을 올려 편집할 수 있다.
     ⑶ 낮은 배율에서만 글줄 rect 를 읽는다(GUT_PROBE_H 게이트) — 보통 배율에선 추가 비용 0.
   ⛔열 거터는 «안 건드린다» — 글줄은 칸 폭을 가득 채우므로 가로 중앙은 열 거터에서 11px 떨어져
     있고, 실측에서도 열 거터로 막힌 칸은 0 건이었다. 고칠 근거가 없는 것은 안 고친다.
═══════════════════════════════════════════════════════════════════════════════ */
const GUT_HALF_MAX   = 4;    // 기존 8px 거터의 «절반» — 상한(높은 배율에선 이 값 그대로)
const GUT_MIN_TOTAL  = 5;    // 거터 최소 두께(px). 이 아래로는 «못 잡는다»
const GUT_CONTENT_EPS = 0.75; // 글줄 중앙을 이만큼은 «반드시» 비워 둔다
const GUT_PROBE_H    = 64;   // 칸이 이보다 높으면 8px 거터가 글줄 중앙에 닿을 수 없다 → 조사 생략

/** 경계 중앙 cy 에서 위/아래 한계선을 받아 거터 띠([top, height])를 낸다 — 순수함수(단위검사 대상).
 *  upLimit   = 거터가 «이 y 아래»로만 갈 수 있다(위 칸 글줄 중앙 + eps). null = 제약 없음
 *  downLimit = 거터가 «이 y 위»로만 갈 수 있다(아래 칸 글줄 중앙 − eps). null = 제약 없음 */
function _rowGutterBand(cy, upLimit, downLimit) {
  let halfUp   = upLimit   == null ? GUT_HALF_MAX : Math.min(GUT_HALF_MAX, Math.max(0, cy - upLimit));
  let halfDown = downLimit == null ? GUT_HALF_MAX : Math.min(GUT_HALF_MAX, Math.max(0, downLimit - cy));
  /* ★floor — 내용이 양쪽에서 밀어붙여도 «잡을 수 있는» 두께는 남긴다.
     남는 여유가 있는 쪽(주로 위 칸의 빈 아래쪽)부터 채운다. */
  let deficit = GUT_MIN_TOTAL - (halfUp + halfDown);
  if (deficit > 0) {
    const take = Math.min(deficit, GUT_HALF_MAX - halfUp);
    halfUp += take; deficit -= take;
    if (deficit > 0) halfDown = Math.min(GUT_HALF_MAX, halfDown + deficit);
  }
  return { top: cy - halfUp, height: halfUp + halfDown };
}

/** 행 r 의 «경계쪽 글줄 중앙»(화면 y). dir='up' = 그 행이 경계 위(마지막 줄), 'down' = 아래(첫 줄).
 *  ★열을 «전부» 훑는다 — 거터는 블록 폭 전체를 덮으므로 한 열만 보면 다른 열이 계속 막힌다. */
function _rowContentEdge(block, r, dir) {
  const inner = block.querySelector(':scope > .grd-inner');
  if (!inner) return null;
  let edge = null;
  for (const cell of inner.querySelectorAll(`:scope > .grd-cell[data-r="${r}"]`)) {
    const lines = cell.querySelectorAll('[data-line]');
    if (!lines.length) continue;
    const lr = (dir === 'up' ? lines[lines.length - 1] : lines[0]).getBoundingClientRect();
    if (!(lr.height > 0)) continue;
    const mid = lr.top + lr.height / 2;
    const v = dir === 'up' ? mid + GUT_CONTENT_EPS : mid - GUT_CONTENT_EPS;
    if (edge === null || (dir === 'up' ? v > edge : v < edge)) edge = v;
  }
  return edge;
}

function _updateGridGutterPositions() {
  const overlay = _getOverlay();
  if (!overlay || !_gridGutterBlock) return;
  const block = _gridGutterBlock;
  const blockRect = block.getBoundingClientRect();
  /* ★열 경계 손잡이의 세로 범위 = 격자 껍데기(.grd-inner) — 블럭 전체가 아니다(H8 · 2026-10-05).
     블럭 전체면 G19 자식 그릇(.grd-children) 위까지 내려가, «고른» 그리드의 아래 ＋(블럭 가로 가운데 · 껍데기 바로 아래)를
     2열 그리드 가운데 경계 손잡이가 덮었다(실측 grid-plus-g15 K2: ＋ 정중앙 elementFromPoint = .grd-gutter).
     옛날엔 ＋ 가 «호버»(안 고름 = 손잡이 없음)에만 떠서 안 만났다. 자식 위에서 열 폭을 끄는 것은 뜻이 없다. */
  const shellRect = (block.querySelector(':scope > .grd-inner') || block).getBoundingClientRect();
  overlay.querySelectorAll('.grd-gutter[data-axis="col"]').forEach(g => {
    const i = +g.dataset.i;
    const a = _getGridCell(block, 0, i), b = _getGridCell(block, 0, i + 1);
    if (!a || !b) { g.style.display = 'none'; return; }
    g.style.display = '';
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const cx = (ar.right + br.left) / 2; // 두 열 사이 gap 의 중앙(스크린 좌표, 스케일 반영된 rect)
    g.style.left = (cx - 4) + 'px';      // 8px 폭 중앙 정렬
    g.style.top = shellRect.top + 'px';
    g.style.height = shellRect.height + 'px';
  });
  /* ★S11 — 중첩 거터 자리. 세로 범위는 ★그 줄(.grd-nested)만 — 바깥 칸 전체가 아니다
     (그 줄 밖에서 끄는 것은 뜻이 없고, 바깥 열 거터와 겹치면 서로 가린다). */
  overlay.querySelectorAll('.grd-gutter[data-axis="ncol"]').forEach(g => {
    const i = +g.dataset.i;
    const els = _getNestedCols(block, +g.dataset.r, +g.dataset.c, +g.dataset.li);
    const a = els[i], b = els[i + 1];
    if (!a || !b) { g.style.display = 'none'; return; }
    g.style.display = '';
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
    const cx = (ar.right + br.left) / 2;
    g.style.left = (cx - 4) + 'px';
    g.style.top = Math.min(ar.top, br.top) + 'px';
    g.style.height = Math.max(ar.height, br.height) + 'px';
  });
  overlay.querySelectorAll('.grd-gutter[data-axis="row"]').forEach(g => {
    const i = +g.dataset.i;
    const a = _getGridCell(block, i, 0), b = _getGridCell(block, i + 1, 0);
    if (!a || !b) { g.style.display = 'none'; return; }
    g.style.display = '';
    const ar = a.getBoundingClientRect();
    const br = b.getBoundingClientRect();
    const cy = (ar.bottom + br.top) / 2; // 두 행 사이 gap 의 중앙
    /* [M64] 낮은 배율에서만 이웃 글줄을 조사해 «편집 표적»을 비켜 앉는다(위 큰 주석 참조).
       칸이 충분히 크면 8px 거터가 글줄 중앙까지 닿을 수 없으므로 rect 를 읽지 않는다. */
    const probe = ar.height < GUT_PROBE_H || br.height < GUT_PROBE_H;
    const band = _rowGutterBand(
      cy,
      probe ? _rowContentEdge(block, i, 'up') : null,
      probe ? _rowContentEdge(block, i + 1, 'down') : null,
    );
    g.style.top = band.top + 'px';
    g.style.height = band.height + 'px';
    g.style.left = blockRect.left + 'px';
    g.style.width = blockRect.width + 'px';
  });
  _updateGridHeadbandPositions(overlay, block, blockRect);   // ★t3-04 U2a — 같은 틱 · 같은 사각형(새 rAF 0)
  _updateGridRangeRect(overlay, block);   // ★t3-04 U2b — 범위 사각형도 같은 틱(새 rAF 0)
}

// 열 경계 드래그 — 인접 두 열의 «가중치»만 재분배(합 보존, 다른 열 불변).
// wL0/wR0(화면 px, 스케일로 나눈 캔버스 px)와 W(가중치 합)는 mousedown 시점 1회 스냅샷 —
/* ═══ ★S11 «중첩 줄 안 두 칸»의 비율을 ★마우스로 (현빈 2026-10-07) ═══════════════════
 *   원문: 「그리드 블럭 선택후 우클릭 후 ★나란히 두칸으로 나누기를 통해서 추가되는 줄 ★간에
 *          ★칸 비율 ★마우스로 조절 가능하게 해줘」
 *   현빈 확답(지디 중계) — ① 「줄 간에」 = ★«그 줄 ★안»의 두 칸 사이  ② ★줄마다 ★따로
 *                        ③ 방법은 ★«마우스 하나» (⛔패널 숫자칸 안 만든다)
 *
 * ★이미 있던 것(실측) — ⛔새로 안 만든다
 *   · 「나란히 두 칸으로 나누기」 = `#bcm-grid-nested`(index.html:1662) ＋ block-factory.js:5759 (T-221)
 *     만드는 값 = `{type:'duo', gap:8, cols:[{width:1,lines:[…]},{width:1,lines:[…]}]}`
 *   · 비율 ★필드 = `line.cols[c].width` — ★이미 모델에 있고 `grid-block.js:2278` 이 `flex:${w}` 로 ★그린다
 *   · `cols` 는 ★이미 `GRID_LINE_FIELDS` 에 있다(런타임 import 로 센 명부) ⇒ ★새 필드 ★0
 *   ⇒ ★★없던 것은 ★«쓰는 손» 하나뿐이었다. 이 아래가 그 손이다.
 *
 * ★★조건 ① «합 보존»은 ⛔새로 짜지 않는다 — 바깥 열과 ★같은 순수함수 `resizeColBoundary`
 *   (grid-cell-resize.js)를 ★그대로 먹인다. ★minPx 도 모듈 기본값(COL_MIN_PX)을 쓴다.
 *   ⇒ 한 레인에 두 벌을 만들지 않는다.
 * ★★조건 ⑤ 쓰는 문은 ★`patchCell{r,c,lineIndex,cols}` ★하나 — ⛔dataset 직접 쓰기 금지.
 *   그래야 `_gridIntake`·`_gridInspectNested`(깊이·열 상한)·모르는 필드 거절을 ★건너뛰지 않는다.
 *   ⚠️바깥 거터는 `block.dataset.cols` 를 ★직접 쓴다 — ★그 관례를 ★따르지 «않는다».
 *     까닭: 바깥 `cols` 는 입구 검증이 따로 서 있지만, ★중첩은 `_gridInspectNested` 가
 *     ★입구에서만 잰다. 직접 쓰면 그 자를 ★통째로 건너뛴다.
 * ★★조건 ② «면적» — 거터는 `#ss-handles-overlay`(position:fixed) 위에 ★스크린 좌표로 앉는다.
 *   ⇒ 캔버스 `matrix(0.4)` 를 ★안 탄다(배율이 낮아도 8px 그대로). ★바깥 거터와 ★같은 꼴이다.
 *   ⛔이것을 ★추론으로 두지 않는다 — 검사가 `elementFromPoint` 로 ★배율 둘에서 잰다. */

/** 중첩 줄 하나의 열 DOM — `.grd-nested[data-r][data-c][data-line] > .grd-nested-col` */
function _getNestedCols(block, r, c, li) {
  const nest = block.querySelector(
    `.grd-cell[data-r="${r}"][data-c="${c}"] .grd-nested[data-r="${r}"][data-c="${c}"][data-line="${li}"]`);
  return nest ? [...nest.querySelectorAll(':scope > .grd-nested-col')] : [];
}

/** 이 블럭 안의 «중첩 줄» 전수 — [{r,c,li,n}] (n = 그 줄의 열 수). ★DOM 에서 센다(그려진 것이 참값). */
function _gridNestedLines(block) {
  const out = [];
  block.querySelectorAll('.grd-nested[data-line]').forEach(nest => {
    /* ★중첩 «안»의 중첩은 건너뛴다 — 안쪽 줄은 data-line 을 안 가지지만(naddr 만 실린다),
       혹시 바뀌어도 바깥 칸 직계만 집도록 closest 로 한 번 더 가른다. */
    const cell = nest.closest('.grd-cell');
    if (!cell) return;
    const r = cell.dataset.r, c = cell.dataset.c, li = nest.dataset.line;
    if (r === undefined || c === undefined || li === undefined) return;
    if (nest.dataset.r !== r || nest.dataset.c !== c) return;   // 바깥 칸의 «제» 줄만
    const n = nest.querySelectorAll(':scope > .grd-nested-col').length;
    if (n >= 2) out.push({ r: +r, c: +c, li: +li, n });
  });
  return out;
}

function _onGridNestedColMouseDown(e, block, addr, i) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const model = window.getGridModel?.(block);
  const line = model?.cells?.[addr.r]?.[addr.c]?.lines?.[addr.li];
  const cols = Array.isArray(line && line.cols) ? line.cols.map(x => ({ ...x })) : null;
  if (!cols || !cols[i] || !cols[i + 1]) return;
  const els = _getNestedCols(block, addr.r, addr.c, addr.li);
  const elA = els[i], elB = els[i + 1];
  if (!elA || !elB) return;

  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};
  const scale0 = _canvasScaleNow();
  const wL0 = elA.getBoundingClientRect().width / scale0;
  const wR0 = elB.getBoundingClientRect().width / scale0;
  const W = (Number(cols[i].width) || 1) + (Number(cols[i + 1].width) || 1);
  const startX = e.clientX;
  /* ★드래그 «시작 직전» 1회만 — 바깥 거터와 같은 규약. 아래 쓰기는 noHistory 로 보낸다
     (updateGridBlock 이 제 스스로 1회 쌓으므로, 안 끄면 mousemove 마다 한 칸씩 쌓인다). */
  window.pushHistory?.();

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const delta = (ev.clientX - startX) / scale;
    const r = resizeColBoundary(wL0, wR0, W, delta);   // ★바깥 열과 «같은 순수함수». ⛔제 계산 금지
    if (!r) return;
    cols[i].width = r.leftWeight;
    cols[i + 1].width = r.rightWeight;
    /* ★★쓰는 문은 ★하나 — patchCell. ⛔dataset 직접 쓰기 금지(입구 검증·중첩 상한을 건너뛴다). */
    /* ★`keepPanel:true` 가 ★없으면 — updateGridBlock 이 mousemove 마다 `showGridProperties` 를
       다시 불러 패널을 ★통째로 새로 그리고, 그 끝의 `showGridGutters` 가 ★지금 끌고 있는 거터를
       ★지웠다 다시 만든다 ⇒ ★드래그가 ★첫 픽셀에서 끊긴다.
       ⇒ ★바깥 거터가 「드래그 중 패널 재렌더 금지」라 적어 둔 ★그 규약을 ★같은 뜻으로 지킨다
         (바깥은 dataset 직접 쓰기라 애초에 패널을 안 건드리고, 나는 patchCell 을 쓰므로 ★이 깃발이 그 자리다).
       ★`noHistory:true` — 이력은 mousedown 에서 ★1회만 쌓았다(바깥과 같은 규약).
       ⛔`scheduleAutoSave` 를 ★여기서 또 부르지 않는다 — updateGridBlock 이 ★이미 부른다(두 벌 금지). */
    /* ★★`updateGridBlockRaw` 다 — ⛔`updateGridBlock` 이 아니다.
       까닭(2026-10-07 ★실측, 내 검사가 잡았다): `window.update*Block` 은 `model-update-history.js`
       가 ★전부 감싸서 ★호출마다 «끝 표본» 한 칸을 더 쌓는다. 그 래퍼는 내 `noHistory` 를 ★안 본다.
       ⇒ 끌기 한 번이 히스토리 ★10칸을 먹었고(mousemove 수만큼), ⌘Z 한 번은 ★한 걸음만 되돌렸다.
       ★Raw 는 그 래퍼를 «안 타는» 원본이고, 선언 자리가 스스로 「자기 히스토리 칸을 직접 쌓는
       호출자 전용」이라 적어 뒀다 — mousedown 에서 1회 쌓는 ★내가 바로 그 호출자다. */
    const res = window.updateGridBlockRaw?.(block.id,
      { patchCell: { r: addr.r, c: addr.c, lineIndex: addr.li, cols } },
      { noHistory: true, keepPanel: true });
    if (!res || res.ok !== true) return;   // 거절(상한 등)이면 조용히 멈춘다 — 화면도 안 바뀐다
    _updateGridGutterPositions();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// mousemove 는 여기서 튄 델타만 resizeColBoundary(순수함수, grid-cell-resize.js)에 먹인다.
function _onGridColMouseDown(e, block, i) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const cols = gridCols(block);   // 클램프·폴백까지 반영된 단일 진실원(grid-block.js)
  if (!cols[i] || !cols[i + 1]) return;
  const elA = _getGridCell(block, 0, i), elB = _getGridCell(block, 0, i + 1);
  if (!elA || !elB) return;

  // row draggable(block-drag.js)과의 충돌 방지 — 거터는 블록 밖(오버레이)이라 애초에 잘 안 맞지만,
  // 조상 체인의 dragstart 를 막는 안전망을 표 셀 선택과 «공유»한다(drag-utils.js, PLAN §5-B-4).
  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};

  const scale0 = _canvasScaleNow();
  const wL0 = elA.getBoundingClientRect().width / scale0;
  const wR0 = elB.getBoundingClientRect().width / scale0;
  const W = (Number(cols[i].width) || 1) + (Number(cols[i + 1].width) || 1);
  const startX = e.clientX;
  // ★드래그 «시작 직전» 1회만(mousedown) — mousemove 마다 쌓이면 undo 가 픽셀 단위로 끊긴다.
  window.pushHistory?.();

  function onMove(ev) {
    const scale = _canvasScaleNow(); // 드래그 중 줌이 바뀌는 경우까지 방어(매 move 재조회)
    const delta = (ev.clientX - startX) / scale;
    const r = resizeColBoundary(wL0, wR0, W, delta);   // ★minPx 는 모듈 기본값(COL_MIN_PX) — 여기서 리터럴로 덮지 않는다
    if (!r) return;
    cols[i].width = r.leftWeight;
    cols[i + 1].width = r.rightWeight;
    block.dataset.cols = JSON.stringify(cols);
    window.renderGridBlock?.(block);
    _updateGridGutterPositions();
    // 패널이 열려 있으면 비율 입력값만 갱신 — 패널 재렌더 금지(포커스/드래그 중단 방지,
    // prop-grid.js 의 «드래그 중 패널 재렌더 금지» 규약과 동일, PLAN §4 끝줄).
    const ratioInput = document.getElementById('grd-col-ratio');
    if (ratioInput) {
      ratioInput.value = cols.map(c => {
        const n = Number(c.width);
        return Number.isInteger(n) ? String(n) : String(+n.toFixed(2));
      }).join(':');
    }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
    /* ★끝 상태도 찍는다 — 시작(mousedown)만 찍으면 «다음»이 push-after 동작일 때 그 사이의
       표본이 없어 ⌘Z 한 번이 둘을 같이 먹는다(js/drag-history.js). 안 움직였으면 캔버스가
       그대로라 history.js 의 무변화 차단이 버린다 = 맨클릭 중복 항목도 같이 사라진다. */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

// 행 경계 드래그 (P1 병합 후 신설) — «가중치 재분배 없음»(PLAN §3-A/§5-B-3). 경계 i|i+1 을
// 끌면 «위» 행(rows[i])의 px 최소높이만 바뀐다 — 아래 행은 그대로. resizeRowHeight(순수함수).
function _onGridRowMouseDown(e, block, i) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const rows = gridRows(block);   // 클램프·폴백까지 반영된 단일 진실원(grid-block.js)
  if (!rows[i] || !rows[i + 1]) return;
  const elA = _getGridCell(block, i, 0);
  if (!elA) return;

  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};

  const scale0 = _canvasScaleNow();
  /* 'auto' 행도 «지금 렌더된» 높이에서 시작 — ★t4-13 「쾌적하지 않음」: 렌더된 칸 높이엔 칸 위아래 여백(cellPadY ×2)이 들어 있는데
     행 높이 값은 그 여백을 «뺀» 몫이다(트랙 최소 = H + 2×cellPadY · grid-block.js gridTrackMin 한 식). 빼지 않으면 첫 움직임에
     여백 ×2 만큼 튀었다(같은 꼴 실측: cellPadY 40 · 3px 끌기 → 칸 115→203 · 수지 원 블럭 441→584). ⇒ 같은 식의 거꾸로로 시작값을 잡는다. */
  const startH0 = Math.max(0, elA.getBoundingClientRect().height / scale0 - 2 * (getGridCellPadY(block) || 0));
  const startY = e.clientY;
  window.pushHistory?.(); // ★드래그 «시작 직전» 1회만

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const delta = (ev.clientY - startY) / scale;
    const h = resizeRowHeight(startH0, delta);   // ★min/max 는 모듈 기본값(ROW_H_MIN/ROW_H_MAX) — 여기 리터럴 2000 이 상한을 «혼자» 절반으로 깎고 있었다
    rows[i] = { height: h };
    block.dataset.rows = JSON.stringify(rows);
    window.renderGridBlock?.(block);
    _updateGridGutterPositions();
    // 패널이 열려 있으면 그 행의 입력값만 갱신 — 패널 재렌더 금지(열 경계와 동일 원칙).
    const rowInput = document.querySelector(`.grd-row-h-item[data-ri="${i}"]`);
    if (rowInput) rowInput.value = String(h);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
    /* ★끝 상태도 찍는다 — 시작(mousedown)만 찍으면 «다음»이 push-after 동작일 때 그 사이의
       표본이 없어 ⌘Z 한 번이 둘을 같이 먹는다(js/drag-history.js). 안 움직였으면 캔버스가
       그대로라 history.js 의 무변화 차단이 버린다 = 맨클릭 중복 항목도 같이 사라진다. */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ═══ ★t3-04 U2a «행·열 머리띠» ＋ «끌어서 순서 바꾸기» (S6 · 2026-10-22 · 현빈 GO msg5376 · 시안 Version 3) ═══
 *   확정 ① 머리띠는 «그리드를 고른 동안만» 보인다 → ★거터 생애(showGridGutters · _updateGridGutterPositions ·
 *          hideGridGutters)에 ★얹었다. ⛔새 rAF 0 · ⛔loop 몸통 손 0(tests/unit/overlay-raf-resync U-M66-4/5 가 꼴을 잠근다).
 *   확정 ④ 행을 옮기면 그 행의 높이도 따라간다 → ★쓰기는 grid-block.js moveGridRow/moveGridCol(U1) 하나 — 여기는 «손»만.
 *   확정 ⑤ 열 = 알파벳 · 행 = 숫자 → ★gridColLabel / gridRowLabel(U1) — ⛔여기서 글자를 셈하지 않는다(두 벌 금지).
 * ★자리(시안): 열 머리띠 = 그 열 «위» · 행 머리띠 = 그 행 «왼쪽» — ★블럭 상자 «밖»(블럭 안 클릭·줄 편집을 안 덮는다).
 *   ★#ss-handles-overlay(=#canvas-scaler 밖) ⇒ 저장본·내보내기·히스토리 직렬화에 ★안 샌다(거터와 같은 까닭 · 해-4).
 *   ★두께 = 화면 고정 px(거터 8px 와 같은 관례 — 배율이 낮아도 잡힌다). ★z 97 = 거터와 같다 · 줄 손잡이(⠿ z 98)가 이긴다.
 * ★꼴(현빈 QA 자 «디자인 일관성»): 캔버스 ＋(.grd-add-btn) 어법 — 점선 · --ui-divider · --ui-text-muted · hover --ui-accent-primary
 *   · 끄는 동안 --ui-disabled-opacity. ⛔색·두께 리터럴 0 — 전부 css/editor-blocks.css 의 토큰(그리드 ＋ 규칙 바로 아래).
 * ★끌기 = 거터 끌기(_onGridRowMouseDown)와 같은 꼴: e.button · preventDefault · stopPropagation · suppressAncestorDrag ·
 *   document mousemove/mouseup. ⛔HTML5 drag 를 안 쓴다(시안은 썼다) — 오버레이 손잡이 전부가 이 꼴이고, 조상 dragstart 와 안 부딪힌다.
 *   ★축이 고정이다(행 머리띠 = 세로만 · 열 머리띠 = 가로만) ⇒ 행·열이 «섞일» 길이 없다(시안의 거절 문구가 필요 없다).
 *   ★놓을 자리 = «삽입 자리» 0..N → _grdGripDropTarget(같은 칸 보정 · splice 꼴)로 «옮길 index» — 줄 손잡이와 ★같은 셈 한 벌.
 *   ★index 는 ★Number(정수)로만 넘긴다 — U1 이벨류: 문자열 '0' 이면 moveGrid* 가 조용히 false.
 * ★이력: moveGrid* 가 «변경 전»에 1회 쌓는다 → onUp 에서 «끝 표본» 1회(위 거터 둘과 같은 규약 · js/drag-history.js 머리말)
 *   ⇒ 다음 동작이 push-after 여도 ⌘Z 한 번 = 이 옮김 하나. 안 옮겼으면(임계 미달·제자리) ★아무것도 안 쌓는다.
 * ★옮긴 뒤: 줄 선택(_grdActiveLine/_grdLineSel)은 «옛 주소»라 비운다(U1 이벨류) → _grdAfterResize(hide → 패널 → show)
 *   로 거터·머리띠·패널을 «다시 세운다»(중첩 거터 data-r/c 옛 주소 — precheck ⑶). ⛔중첩 칸 머리띠는 없다(바깥 격자만).
 * ⚠️안 한 것(«해석» · 보고서): 시안의 ⌥/화살표 한 칸 옮기기 — 키 처리기(editor.js)는 U2b 의 파일이라 이번엔 안 건드렸다.
 * ═══════════════════════════════════════════════════════════════════════════════════════════════════ */
const GRD_BAND_T = 16;     // 머리띠 두께(화면 px) — 열 = 높이 · 행 = 폭
const GRD_BAND_GAP = 4;    // 블럭 상자와 머리띠 사이(화면 px)
const GRD_BAND_DROP_T = 2; // 놓을 자리 선 두께(화면 px)

function _createGridHeadbands(overlay, block, nCols, nRows) {
  const mk = (axis, i) => {
    const b = document.createElement('div');
    b.className = 'grd-headband';
    b.dataset.axis = axis;
    b.dataset.i = String(i);
    b.textContent = axis === 'col' ? gridColLabel(i) : gridRowLabel(i);
    b.title = axis === 'col' ? '끌어서 열 순서 바꾸기' : '끌어서 행 순서 바꾸기';   // ★현빈 «프롭힌트» 자 — title 하나만
    b.style.cssText = 'position:absolute;z-index:97;pointer-events:auto;';
    overlay.appendChild(b);
    b.addEventListener('mousedown', e => _onGridHeadbandMouseDown(e, block, axis, i));
    b.addEventListener('click', e => _grdBandForwardTap(e, b, block));   // ★U2a-fix D1 — 안 끈 누르기는 아래 이웃에게
    _wireGutterContextMenu(b, block);
  };
  for (let i = 0; i < nCols; i++) mk('col', i);
  for (let i = 0; i < nRows; i++) mk('row', i);
}

function _updateGridHeadbandPositions(overlay, block, blockRect) {
  overlay.querySelectorAll('.grd-headband').forEach(b => {
    const i = +b.dataset.i;
    const col = b.dataset.axis === 'col';
    const el = col ? _getGridCell(block, 0, i) : _getGridCell(block, i, 0);
    if (!el) { b.style.display = 'none'; return; }
    b.style.display = '';
    const r = el.getBoundingClientRect();
    if (col) {
      b.style.left = r.left + 'px'; b.style.width = r.width + 'px';
      b.style.top = (blockRect.top - GRD_BAND_GAP - GRD_BAND_T) + 'px'; b.style.height = GRD_BAND_T + 'px';
    } else {
      b.style.top = r.top + 'px'; b.style.height = r.height + 'px';
      b.style.left = (blockRect.left - GRD_BAND_GAP - GRD_BAND_T) + 'px'; b.style.width = GRD_BAND_T + 'px';
    }
  });
}

/** 포인터 좌표(축 하나) → «삽입 자리» 0..n. 그 칸의 가운데를 지났으면 그 칸 «뒤». */
function _grdBandInsertAt(block, axis, n, p) {
  let k = 0;
  for (let j = 0; j < n; j++) {
    const el = axis === 'col' ? _getGridCell(block, 0, j) : _getGridCell(block, j, 0);
    if (!el) continue;
    const r = el.getBoundingClientRect();
    if (p > (axis === 'col' ? r.left + r.width / 2 : r.top + r.height / 2)) k = j + 1;
  }
  return k;
}

/** 삽입 자리 k 의 «선» 좌표(화면) — 첫 칸 앞 끝 · 사이 gap 가운데 · 끝 칸 뒤 끝. */
function _grdBandSlotEdge(block, axis, n, k) {
  const at = (j) => {
    const el = axis === 'col' ? _getGridCell(block, 0, j) : _getGridCell(block, j, 0);
    return el ? el.getBoundingClientRect() : null;
  };
  const a = k > 0 ? at(k - 1) : null, b = k < n ? at(k) : null;
  if (axis === 'col') {
    if (a && b) return (a.right + b.left) / 2;
    return b ? b.left : a ? a.right : null;
  }
  if (a && b) return (a.bottom + b.top) / 2;
  return b ? b.top : a ? a.bottom : null;
}

/* ★U2a-fix D1 (이벨류 E1·E5) — 머리띠는 블럭 상자 «밖»(위·왼)에 떠서, 틈 0 으로 붙은 이웃 블럭(위 블럭 아랫단 ·
 *   왼쪽 이웃)의 그 띠를 덮는다 ⇒ 고른 동안 이웃을 못 골랐다. 고친 길 = «끌기 임계를 못 넘고 끝난 누르기(탭)»는
 *   그 점 «아래»(오버레이 제외) 것에 mousedown → mouseup → click 을 «그대로» 넘긴다(머리띠가 없을 때와 같은 결과).
 *   ★넘기지 않는 것: 아래가 «이 그리드 자신·그 조상»(섹션 바탕·row·프레임 — 빈 바탕)일 때 ⇒ 옛 동작(탭 = 아무 일 0 ·
 *     그리드 선택 유지)을 지킨다. 머리띠를 툭 건드렸다고 고른 그리드가 풀리면 안 된다(«해석» — 보고서).
 *   ★끈 누르기(임계 3px 넘음 · GRD_GRIP_DRAG_THRESHOLD_PX)는 종전대로 머리띠의 것 ⇒ 끌기 무변.
 *   ★탭 표지(band._grdTap)는 onUp 이 «선택이 살아 있고 안 끌었을 때만» 세운다 — Esc 취소·선택 풀림·끈 뒤엔 안 선다.
 *   ⛔새 rAF·타이머 0 — 넘기기는 진짜 click 처리기 안에서 동기로 끝난다.
 * ★U2a 재평가 R4 — 해-13 의 «조상»을 둘로 가른다(«해석»):
 *     · 캔버스 «바깥» 바탕 = editor.js 의 빈 바탕 선택 해제(#canvas-wrap click · `['canvas-wrap','canvas-scaler','canvas']`)가
 *       보는 그 셋 ⇒ ★넘긴다(진짜 빈 바탕 클릭 = 선택 해제 · 패널 Page 와 같게). 그리드는 늘 이 셋 안에 들므로 «조상»이어도.
 *     · 섹션 «안» 조상(섹션·section-inner·row·프레임) ⇒ 종전대로 안 넘긴다(해-13 유지 · 툭 건드려 고른 그리드가 안 풀린다).
 *   ⚠️이 셋은 editor.js :4381 줄의 글자를 ★옮겨 적은 것이다(그 처리기는 export 가 없다) — 그쪽이 바뀌면 여기도.
 * ★U2a 재평가 R1 — 머리띠 mousedown 이 preventDefault 라 칸 편집 포커스가 그리드에 남는다. 진짜 클릭은 누르는 순간
 *   포커스가 옮겨 가 편집이 끝난다 ⇒ 넘기기 «전»에, 포커스가 body 가 아니고 넘길 대상 안이 아니면 blur(편집 종료는
 *   그 칸의 blur 처리기가 한다 — 진짜 클릭과 같은 길). */
const GRD_BAND_PAGE_BG = ['canvas-wrap', 'canvas-scaler', 'canvas'];   // = editor.js 빈 바탕 deselect 셀렉터
function _grdBandForwardTap(e, band, block) {
  const tap = band._grdTap === true;
  band._grdTap = false;
  if (!tap) return;
  const ovl = _getOverlay();
  const under = document.elementsFromPoint(e.clientX, e.clientY).find(el => !(ovl && ovl.contains(el)));
  if (!under || under === block || block.contains(under)) return;   // 자기 = 옛 동작
  const pageBg = GRD_BAND_PAGE_BG.includes(under.id);   // R4 — 캔버스 바깥 바탕이면 조상이어도 넘긴다
  if (under.contains(block) && !pageBg) return;          // 섹션 안 조상(빈 바탕) = 옛 동작(해-13)
  const act = document.activeElement;
  if (act && act !== document.body && !under.contains(act) && typeof act.blur === 'function') act.blur();   // R1
  e.preventDefault();
  e.stopPropagation();
  const init = {
    bubbles: true, cancelable: true, composed: true, view: window, detail: 1, button: 0,
    clientX: e.clientX, clientY: e.clientY, screenX: e.screenX, screenY: e.screenY,
    shiftKey: e.shiftKey, metaKey: e.metaKey, ctrlKey: e.ctrlKey, altKey: e.altKey,
  };
  under.dispatchEvent(new MouseEvent('mousedown', { ...init, buttons: 1 }));
  under.dispatchEvent(new MouseEvent('mouseup', { ...init, buttons: 0 }));
  under.dispatchEvent(new MouseEvent('click', { ...init, buttons: 0 }));
}

function _onGridHeadbandMouseDown(e, block, axis, from) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const band = e.currentTarget;
  if (band) band._grdTap = false;
  const n = axis === 'col' ? gridCols(block).length : gridRows(block).length;
  if (!(from >= 0 && from < n)) return;
  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};
  const overlay = _getOverlay();
  const x0 = e.clientX, y0 = e.clientY;
  let armed = false;
  let insertAt = null;   // ★놓을 자리는 closure 에 든다 — onUp 에서 DOM 으로 다시 찾지 않는다(줄 손잡이와 같은 까닭)
  let line = null;

  function onMove(ev) {
    if (!armed) {
      if (Math.abs(ev.clientX - x0) < GRD_GRIP_DRAG_THRESHOLD_PX
          && Math.abs(ev.clientY - y0) < GRD_GRIP_DRAG_THRESHOLD_PX) return;
      armed = true;
      band?.classList.add('is-dragging');
    }
    const p = axis === 'col' ? ev.clientX : ev.clientY;
    insertAt = _grdBandInsertAt(block, axis, n, p);
    const edge = _grdBandSlotEdge(block, axis, n, insertAt);
    const shell = (block.querySelector(':scope > .grd-inner') || block).getBoundingClientRect();
    if (!overlay || edge === null) return;
    if (!line) {
      line = document.createElement('div');
      line.className = 'grd-headband-drop';
      line.dataset.axis = axis;
      line.style.cssText = 'position:absolute;z-index:97;pointer-events:none;';
      overlay.appendChild(line);
    }
    line.dataset.at = String(insertAt);
    if (axis === 'col') {
      line.style.left = (edge - GRD_BAND_DROP_T / 2) + 'px'; line.style.width = GRD_BAND_DROP_T + 'px';
      line.style.top = shell.top + 'px'; line.style.height = shell.height + 'px';
    } else {
      line.style.top = (edge - GRD_BAND_DROP_T / 2) + 'px'; line.style.height = GRD_BAND_DROP_T + 'px';
      line.style.left = shell.left + 'px'; line.style.width = shell.width + 'px';
    }
  }
  /* ★U2a-fix D2 — 리스너·드롭선·조상 끌기 막음을 «한 곳»에서 걷는다(놓기 · Esc 취소 둘 다 이 길 · 두 번 불러도 한 번). */
  let done = false;
  function cleanup() {
    if (done) return;
    done = true;
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    window.removeEventListener('keydown', onKey, true);
    restoreDrag();
    band?.classList.remove('is-dragging');
    line?.remove();
  }
  /* ★U2a-fix D2 — 끄는 동안 Esc = «끌기 취소»(쓰기 0 · 리스너 떼기 · suppressAncestorDrag 복원).
     ★window capture 에서 먹는다(stopImmediatePropagation) ⇒ 이 Esc 는 editor.js 의 Esc(선택 풀기)까지 안 간다 —
       T-102 «떠 있는 것이 먼저 Esc 를 먹는다»와 같은 결. ⛔editor.js 의 Esc 처리는 손 0(이 리스너는 끄는 동안만 산다). */
  function onKey(ev) {
    if (ev.key !== 'Escape') return;
    ev.preventDefault();
    ev.stopImmediatePropagation();
    cleanup();
  }
  function onUp() {
    cleanup();
    /* ★U2a-fix D2 — 끄는 사이 선택이 풀렸거나(다른 길의 Esc·deselectAll) 블럭이 지워졌으면 «쓰기 0».
       머리띠는 이미 사라졌다 — 보이지 않는 손으로 rows/cells 를 바꾸면 안 된다(이벨류 E2). */
    if (!block.isConnected || !block.classList.contains('selected')) return;
    /* ⛔안 끌었으면(임계 미달) «아무 일도 안 한다» — 머리띠를 그냥 누른 것은 클릭이다(→ 이웃 넘기기는 click 처리기 · D1). */
    if (!armed || insertAt === null) { if (!armed && band) band._grdTap = true; return; }
    const to = Number(_grdGripDropTarget(from, insertAt, true));
    if (!Number.isInteger(to) || to === from) return;   // 제자리 = 쓰기·이력 0
    const moved = axis === 'col' ? moveGridCol(block, Number(from), to) : moveGridRow(block, Number(from), to);
    if (!moved) return;
    window.grdSetActiveLine?.(block, null);   // ★옛 주소 비우기(U1 이벨류) — 자리가 바뀐 줄을 가리키면 안 된다
    window.grdClearLineSel?.(block);
    if (window._grdAfterResize) window._grdAfterResize(block);
    else { hideGridGutters(); showGridGutters(block); }
    /* ★끝 표본도 찍는다 — 위 거터 둘과 같은 규약(시작 표본은 moveGrid* 가 «변경 전»에 찍었다). */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
  window.addEventListener('keydown', onKey, true);
}

/* ═══ ★t3-04 U2b «칸 범위 선택» — 끌어서 A2:C3 (S6 · 2026-10-23 · 현빈 GO msg5376 · 설계 reports/S6-GRID/plan-u2b.md) ═══
 * ★상태 = 모듈 하나(_grdRange) — 그리드 «하나»만 범위를 가진다(고른 그리드는 늘 하나 · grdIsSoleSelected).
 *   ⛔DOM 노드로 칸을 들지 않는다 — renderGridBlock 이 innerHTML 을 갈아끼운다(줄 선택 _grdActiveLine 과 같은 까닭) ⇒ «주소»(r,c)만.
 * ★생애 = 거터와 한 몸: hideGridGutters 가 _grdRangeReset 을 부른다(deselectAll · 루프의 선택 풀림 · _grdAfterResize(머리띠 옮김) 다 덮음).
 *   첫 Esc = grdClearRange(editor.js) · ⌘Z 재렌더 = 블럭이 갈려 isConnected false ⇒ getter null(루프가 거터와 같이 걷는다).
 * ★사각형 = #ss-handles-overlay 의 .grd-range-rect 하나(z 96 · 거터 97 아래 · pointer-events none) — 저장본·히스토리에 안 샌다.
 *   자리는 _updateGridGutterPositions 꼬리(같은 틱) ＋ set 직후 동기 1회. ⛔새 rAF·타이머 0(click 삼키기 setTimeout 0 은 table 선례).
 * ★무장(_onGridRangeMouseDown · document «버블» — 탐침 u2b-probe-1: 흐름 그리드 칸 mousedown 이 버블까지 온다 · defaultPrevented false):
 *   ① 왼쪽 단추 · detail 1 · ⇧⌘⌃⌥ 없음(⇧/⌘ = 줄 복수선택 · ⌥ = 레이어 고르기) ② 바깥 격자 칸(:scope > .grd-inner > .grd-cell — 자식 그리드 배제)
 *   ③ 중첩 줄(.grd-nested) 안에서 시작 ⛔ ④ 이 그리드만 고름 ＋ «드릴 상태»(활성 줄 있음 또는 범위 있음 · 해-20)
 *   ⑤ 편집 중 아님(.editing · contentEditable 포커스 · 이미지 편집 · 팬 모드).
 *   ⛔mousedown 에서 preventDefault/stopPropagation 안 한다 — click·dblclick(줄 고르기·편집 진입)이 그대로 산다.
 *   stopPropagation 하는 쪽(자유배치 블럭 이동 · 오버레이 손잡이 · 팬)이 먼저 이긴다 ⇒ 자유배치 absolute 그리드는 범위 선택 없음(해-29).
 * ★끌기: 임계(GRD_GRIP_DRAG_THRESHOLD_PX) 넘은 뒤부터 범위 — 같은 칸 안 끌기도 1×1(해-22) · 칸 밖/오버레이 위면 마지막 칸 유지.
 *   끈 뒤 click 한 번을 삼킨다(block-drag click → deselectAll 이 방금 범위를 풀기 때문 · table-cell-select armClickSwallow 와 같은 꼴).
 *   끄는 중 범위가 풀리면(Esc · 선택 해제 · 블럭 지워짐) 끌기도 끝(해-30) — 놓을 때의 click 은 그래도 삼킨다(엉뚱한 칸 고르기 0).
 * ★보고·힌트: 새 title·힌트 DOM 0(현빈 «프롭힌트» 자) — 복사/붙이기 보고는 prop-grid.js 의 showToast 하나. */
let _grdRange = null;        // {block, ar, ac, fr, fc} — 앵커(누른 칸) · 끝(지금 칸)
let _grdRangeDragEnd = null; // 끄는 중이면 그 끌기를 끝내는 함수(범위가 풀리면 같이 끝낸다)

function _grdRangeReset(overlay) {
  _grdRange = null;
  if (_grdRangeDragEnd) _grdRangeDragEnd();
  if (overlay) overlay.querySelectorAll('.grd-range-rect').forEach(el => el.remove());
}

/** 지금 살아 있는 범위 {r0,c0,r1,c1}(정렬됨) | null. ★유효 = 같은 블럭 · 붙어 있음 · 선택됨 · 단독 선택 · 지금 R×C 안.
 *  ⛔드릴 상태(활성 줄)로 판정하지 않는다 — 붙인 뒤 활성 줄을 비워도 범위는 산다(해-25). */
function grdGetRange(block) {
  const st = _grdRange;
  if (!st || !block || st.block !== block) return null;
  if (!block.isConnected || !block.classList.contains('selected')) return null;
  if (window.grdIsSoleSelected && !window.grdIsSoleSelected(block)) return null;
  let R, C;
  try { const m = getGridModel(block); R = m.rows.length; C = m.cols.length; } catch (_) { return null; }
  const r0 = Math.min(st.ar, st.fr), r1 = Math.max(st.ar, st.fr);
  const c0 = Math.min(st.ac, st.fc), c1 = Math.max(st.ac, st.fc);
  if (r0 < 0 || c0 < 0 || r1 >= R || c1 >= C) return null;
  return { r0, c0, r1, c1 };
}

/** 범위를 세운다(붙인 뒤 «들어간 영역» 표시 · 해-25). 꼴이 틀리면 false(지어내지 않는다). */
function grdSetRange(block, rng) {
  if (!block || !rng || ![rng.r0, rng.c0, rng.r1, rng.c1].every(Number.isInteger)) return false;
  _grdRange = { block, ar: rng.r0, ac: rng.c0, fr: rng.r1, fc: rng.c1 };
  _updateGridRangeRect(_getOverlay(), block);
  return grdGetRange(block) !== null;
}

/** 범위를 푼다. ★«살아 있던» 범위가 있었으면 true — editor.js 첫 Esc 가 이것만 소진한다. */
function grdClearRange() {
  const had = !!(_grdRange && grdGetRange(_grdRange.block));
  _grdRangeReset(_getOverlay());
  return had;
}

function _updateGridRangeRect(overlay, block) {
  if (!overlay) return;
  const rng = _grdRange && _grdRange.block === block ? grdGetRange(block) : null;
  const a = rng ? _getGridCell(block, rng.r0, rng.c0) : null;
  const b = rng ? _getGridCell(block, rng.r1, rng.c1) : null;
  let el = overlay.querySelector(':scope > .grd-range-rect');
  if (!a || !b) { if (el) el.remove(); return; }
  if (!el) {
    el = document.createElement('div');
    el.className = 'grd-range-rect';
    el.style.cssText = 'position:absolute;z-index:96;pointer-events:none;';
    overlay.appendChild(el);
  }
  const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect();
  const left = Math.min(ar.left, br.left), top = Math.min(ar.top, br.top);
  el.style.left = left + 'px'; el.style.top = top + 'px';
  el.style.width = (Math.max(ar.right, br.right) - left) + 'px';
  el.style.height = (Math.max(ar.bottom, br.bottom) - top) + 'px';
  el.dataset.r0 = String(rng.r0); el.dataset.c0 = String(rng.c0);
  el.dataset.r1 = String(rng.r1); el.dataset.c1 = String(rng.c1);
  const n0 = `${gridColLabel(rng.c0)}${gridRowLabel(rng.r0)}`, n1 = `${gridColLabel(rng.c1)}${gridRowLabel(rng.r1)}`;
  el.dataset.name = n0 === n1 ? n0 : `${n0}:${n1}`;   // 한 칸 = «C2»(엑셀 이름 칸과 같게) · 여럿 = «A2:C3»
}

/** 점 아래 «이 그리드의 바깥 칸» 주소 | null(칸 밖 · 오버레이 · 자식 그리드 · 다른 블럭). 중첩 줄 위면 그 바깥 칸(해-24). */
function _grdRangeCellAt(block, x, y) {
  const hit = document.elementFromPoint(x, y);
  const cell = hit && hit.closest ? hit.closest('.grd-cell[data-r][data-c]') : null;
  if (!cell || cell.parentElement?.parentElement !== block || !cell.parentElement.classList.contains('grd-inner')) return null;
  const r = Number(cell.dataset.r), c = Number(cell.dataset.c);
  return Number.isInteger(r) && Number.isInteger(c) ? { r, c } : null;
}

function _grdRangeArmClickSwallow() {
  const swallow = (ev) => {
    ev.stopPropagation();
    ev.preventDefault();
    document.removeEventListener('click', swallow, true);
  };
  document.addEventListener('click', swallow, true);
  setTimeout(() => document.removeEventListener('click', swallow, true), 0);   // click 이 안 오면 다음 틱에 걷는다(table 선례)
}

function _onGridRangeMouseDown(e) {
  if (e.button !== 0 || e.detail !== 1) return;
  if (e.shiftKey || e.metaKey || e.ctrlKey || e.altKey) return;
  const t = e.target;
  const cell = t && t.closest ? t.closest('.grd-cell[data-r][data-c]') : null;
  const inner = cell ? cell.parentElement : null;
  const block = inner ? inner.parentElement : null;
  if (!block || !inner.classList.contains('grd-inner') || !block.classList.contains('grid-block')) return;
  const nested = t.closest('.grd-nested');
  if (nested && block.contains(nested)) return;                                  // ③ 중첩 줄 안에서 시작 ⛔
  if (!window.grdIsSoleSelected || !window.grdIsSoleSelected(block)) return;
  if (!(window.grdGetActiveLine?.(block) || grdGetRange(block))) return;         // ④ 드릴 상태만(해-20)
  if (block.classList.contains('editing') || block._grdImgEdit) return;
  if (document.activeElement && document.activeElement.isContentEditable) return;
  if (document.getElementById('canvas-wrap')?.classList.contains('pan-mode')) return;
  const ar = Number(cell.dataset.r), ac = Number(cell.dataset.c);
  if (!Number.isInteger(ar) || !Number.isInteger(ac)) return;
  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};   // 조상 .row draggable
  const overlay = _getOverlay();
  const x0 = e.clientX, y0 = e.clientY;
  let started = false;
  let ended = false;
  function endDrag() {
    if (ended) return;
    ended = true;
    document.removeEventListener('mousemove', onMove, true);
    if (_grdRangeDragEnd === endDrag) _grdRangeDragEnd = null;
    restoreDrag();
  }
  function onMove(ev) {
    if (ended) return;
    if (!block.isConnected || !block.classList.contains('selected')) { endDrag(); return; }   // U2a D2 결
    if (!started) {
      if (Math.abs(ev.clientX - x0) < GRD_GRIP_DRAG_THRESHOLD_PX
          && Math.abs(ev.clientY - y0) < GRD_GRIP_DRAG_THRESHOLD_PX) return;
      started = true;
      if (_grdRangeDragEnd) _grdRangeDragEnd();   // 앞 끌기가 남아 있으면 끝낸다(한 번에 하나)
      _grdRangeDragEnd = endDrag;
      _grdRange = { block, ar, ac, fr: ar, fc: ac };   // ★새 범위 = 교체(같은 칸 끌기도 1×1)
    }
    ev.preventDefault();
    window.getSelection?.()?.removeAllRanges?.();
    const at = _grdRangeCellAt(block, ev.clientX, ev.clientY);
    if (at && _grdRange && _grdRange.block === block) { _grdRange.fr = at.r; _grdRange.fc = at.c; }
    _updateGridRangeRect(overlay, block);
  }
  function onUp() {
    document.removeEventListener('mouseup', onUp, true);
    endDrag();
    if (started) _grdRangeArmClickSwallow();   // 끈 뒤 click → block-drag 의 deselectAll 이 범위를 풀지 않게
  }
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
}
document.addEventListener('mousedown', _onGridRangeMouseDown);   // ★버블(위 머리말 — stopPropagation 하는 쪽이 먼저 이긴다)

window.grdGetRange = grdGetRange;
window.grdSetRange = grdSetRange;
window.grdClearRange = grdClearRange;

window.showGridGutters = showGridGutters;
window.hideGridGutters = hideGridGutters;

/* ═══ ★1017t1c4 — 비교(컴패리전) 블록 «행 경계 드래그» (현빈 2026-10-20) ══════════════
 *   원문: 「칸의 높이도 그리드블럭 처럼 ⒜우측패널에서 일괄 높이 조절되게 혹은
 *          ⒝캔버스에서 특정 칸 높이를 동적으로 조절할 수 있게해줄래?」
 *   ★현빈 직접 결정 = 「c4 - 캔버스에서 끌어서」 ⇒ ⒝ ★하나만 만든다.
 *   ⛔⒜ 「패널 일괄 조절」은 ★안 만든다 — ★이미 있다(내 손으로 잰 것, 2026-10-20):
 *        · 전역 기본 높이  `#cmp-rowh` 슬라이더＋숫자칸 (prop-comparison.js:189-190 · dataset.rowH · 24~140)
 *        · ★행마다 따로    `.cmp-row-h` 숫자칸      (prop-comparison.js:33     · dataset.rowHeights[ri] · 첫 칼럼 줄에만 노출)
 *
 * ★이미 있던 것 — ⛔새 필드 0 · 새 산식 0 · 새 저장 키 0
 *   · 모델 = `block.dataset.rowHeights` (행 인덱스→px 배열 · null = 기본 · ★전 칼럼 공통)
 *     ⇒ renderComparison 의 `_baseRowH0` 가 ★이미 읽는다. 저장은 `data-*` 라 섹션 직렬화가 그대로 싣는다
 *       (⇒ 「저장/불러오기에 실린다」가 ★새 배선이 아니라 ★이미 선 것이다 — 패널 숫자칸이 같은 키를 쓴다).
 *   · 문 = `updateComparisonBlock({rowHeights})` · 바닥·천장 = `CMP_ROW_H_MIN/MAX`(grid-cell-resize.js)
 *   ⇒ ★없던 것은 «끄는 손» 하나뿐이다. 이 아래가 그 손이다.
 *
 * ★그리드 행 거터(showGridGutters · _onGridRowMouseDown)를 ★형틀로 쓴다 — 고정층(#ss-handles-overlay) ·
 *   rAF 위치갱신 · 「블록이 죽거나 선택이 풀리면 스스로 정리」 · mousedown/up 에서 pushHistory 1회씩 ·
 *   «드래그 중 패널 재렌더 금지, 그 칸만 되쓰기» · 띠 계산 `_rowGutterBand`(사본 0) · 우클릭 전달(_wireGutterContextMenu).
 *
 * ★★비교가 그리드와 ★다른 셋 — 여기만의 것이라 적어 둔다:
 *   ⑴ 비교는 `.cmp-inner` 가 ★한 번 더 scale 된다(`block._cmpScale`, renderComparison 이 심는다)
 *      ⇒ 화면 px → 설계 px 는 `_canvasScaleNow() × _cmpScale` 로 나눈다.
 *   ⑵ ★칼럼마다 행의 y 가 ★다르다 — 카드들은 «공통 중심선»에 맞춰 세로 가운데 정렬되고(renderComparison
 *      `top = … + (totalH - h)/2`) muted 칼럼엔 stagger 가 더해진다. 그리드는 grid-template-rows 라
 *      한 줄이 전 열에서 같은 y 였지만 ★여기선 아니다 ⇒ 거터를 ★칼럼마다 둔다(그 칼럼 폭만 덮는다).
 *      ⛔블럭 전폭 띠 하나로 두면 강조 칼럼에서 «경계가 아닌 자리»에 앉아 그 칸 글자를 덮는다.
 *   ⑶ ★강조(featured) 칼럼의 렌더 높이엔 featScale 이 ★이미 곱해져 있다 ⇒ 설계 높이로 되돌릴 때
 *      ★그 수를 나눠야 한다. 그 수는 ★한 자리(comparison-block.js cmpFeatScale)에서 온다 —
 *      ⛔여기서 parseFloat·클램프를 다시 적지 않는다.
 *
 * ★값을 ★쓰는 자리는 ★한 함수(setCmpRowHeight, grid-cell-resize.js)다 — 패널 `.cmp-row-h` 도 ★같은 것을 쓴다
 *   ⇒ 「행 높이를 다른 자리에서 따로 셈하지 마라」(grid-block.js:2670)를 비교에서도 지킨다.
 * ⛔`window.updateComparisonBlock` 을 ★부르지 않는다 — model-update-history.js 가 그걸 감싸 ★호출마다
 *   이력 한 칸을 쌓는다(mousemove 수만큼 = ⌘Z 가 픽셀 단위로 끊긴다). 그리드 바깥 거터·패널 숫자칸과
 *   ★같이 dataset 직접 쓰기 + renderComparison 이다(이력은 mousedown/up 에서 1회씩).
 * ⛔거터 DOM 을 블록 «안»에 넣지 않는다 — #ss-handles-overlay 는 #canvas-scaler 밖이라 저장본·export 에 안 샌다.
 */
let _cmpGutterBlock = null;
let _cmpGutterRafId = null;

/** 이 블럭의 칼럼별 «행 경계» 전수 — [{ci, ri}] (칼럼 ci 의 행 ri|ri+1 사이).
 *  ★DOM 에서 센다 — 그려진 것이 참값이다(_gridNestedLines 와 같은 규약 · 칼럼마다 행 수가 다를 수 있다). */
function _cmpRowBoundaries(block) {
  const out = [];
  block.querySelectorAll('.cmp-inner > .cmp-col[data-col-idx]').forEach(col => {
    const ci = Number(col.dataset.colIdx);
    if (!Number.isInteger(ci)) return;
    const n = col.querySelectorAll(':scope > .cmp-row[data-row-idx]').length;
    for (let ri = 0; ri < n - 1; ri++) out.push({ ci, ri });
  });
  return out;
}

/** 칼럼 ci · 행 ri 의 칸 DOM. ⛔DOM 순서 역산 금지 — 렌더러가 심은 data-* 가 정본(cmpCellAddrAt 과 같은 규약). */
function _cmpRowEl(block, ci, ri) {
  return block.querySelector(`.cmp-row[data-col-idx="${ci}"][data-row-idx="${ri}"]`);
}

/** 칼럼 ci 가 «강조»인가 — 렌더러가 정규화해 둔 `dataset.featured` 를 그대로 읽는다(⛔여기서 다시 판정하지 않는다). */
function _cmpIsFeat(block, ci) { return String(ci) === String(block.dataset.featured); }

/** 강조 배율 — comparison-block.js ★한 자리에서. 없으면 null(= 강조 칼럼엔 거터를 안 세운다 · 머리말 ⑶). */
function _cmpFeatFactor(block, ci) {
  if (!_cmpIsFeat(block, ci)) return 1;
  const f = window.cmpFeatScale ? window.cmpFeatScale(block.dataset) : NaN;
  return (Number.isFinite(f) && f > 0) ? f : null;
}

/** 화면 px → «설계 px» 나누개(캔버스 배율 × .cmp-inner 배율 × 강조 배율). 머리말 ⑴⑶. */
function _cmpPxFactor(block, featFactor) {
  const s = Number(block._cmpScale);
  return _canvasScaleNow() * (Number.isFinite(s) && s > 0 ? s : 1) * featFactor;
}

/** 칼럼 ci · 행 ri 의 «글자 중앙»(화면 y) — 비교 칸은 세로 가운데 정렬이라 칸 rect 의 중앙이 그 자리다.
 *  그리드 `_rowContentEdge` 와 ★같은 뜻·같은 eps(GUT_CONTENT_EPS) — 낮은 배율에서 거터가 더블클릭을 삼키는
 *  [M64] 와 ★같은 병을 같은 약으로 막는다. 거터가 ★그 칼럼만 덮으므로 그 칼럼의 두 칸만 본다. */
function _cmpRowContentEdge(block, ci, ri, dir) {
  const el = _cmpRowEl(block, ci, ri);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  if (!(r.height > 0)) return null;
  const mid = r.top + r.height / 2;
  return dir === 'up' ? mid + GUT_CONTENT_EPS : mid - GUT_CONTENT_EPS;
}

function showCmpGutters(block) {
  /* ★강조 배율을 못 구하는 칼럼은 ★여기서 뺀다 — ⛔「대충 1 로 두고 끌기」 금지
     (그러면 끌린 양이 featScale 배만큼 어긋나고, 사용자는 「조금 끌었는데 많이 늘었다」로 본다).
     ★빼기를 «세기 전»에 한다 — 아래 조기 return 이 「세운 수」와 「세울 수」를 견주므로,
       뺀 것을 세면 둘이 영영 안 맞아 매 호출마다 거터를 지웠다 다시 세운다(끌는 중이면 끊긴다). */
  const need = _cmpRowBoundaries(block).filter(({ ci }) => _cmpFeatFactor(block, ci) !== null);
  /* ★같은 블럭이어도 «경계 수»가 바뀌었으면 다시 세운다 — 행/칼럼을 더하거나 지우면 수가 바뀐다
     (그리드가 「3x3 으로 바꿔도 거터가 옛 개수 그대로」였던 그 회귀와 ★같은 자리다). */
  if (_cmpGutterBlock === block) {
    const ovl = _getOverlay();
    const have = ovl ? ovl.querySelectorAll('.cmp-gutter').length : 0;
    if (have === need.length) { _updateCmpGutterPositions(); return; }
  }
  hideCmpGutters();
  if (!need.length) return;            // 칼럼마다 행이 하나뿐이면 경계가 없다
  _cmpGutterBlock = block;
  const overlay = _getOverlay();
  if (!overlay) return;
  for (const { ci, ri } of need) {
    const g = document.createElement('div');
    g.className = 'cmp-gutter';
    g.dataset.axis = 'row';            // ★그리드 거터와 같은 이름 — 축이 늘면 검사가 축별로 센다
    g.dataset.ci = String(ci);
    g.dataset.i = String(ri);
    // ★position:absolute — #ss-handles-overlay 자체가 fixed;inset:0 이라 자식 좌표계가 뷰포트와 같다(.grd-gutter 와 같은 관례).
    g.style.cssText = 'position:absolute;height:8px;cursor:row-resize;z-index:97;pointer-events:auto;';
    overlay.appendChild(g);
    g.addEventListener('mousedown', e => _onCmpRowMouseDown(e, block, ci, ri));
    _wireGutterContextMenu(g, block);   // ★거터 위 우클릭도 «블록의» 메뉴로(그리드와 같은 부품)
  }
  _updateCmpGutterPositions();
  _startCmpGutterRaf();
}

function hideCmpGutters() {
  if (_cmpGutterRafId) { cancelAnimationFrame(_cmpGutterRafId); _cmpGutterRafId = null; }
  _cmpGutterBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.cmp-gutter').forEach(g => g.remove());
}

function _startCmpGutterRaf() {
  function loop() {
    if (!_cmpGutterBlock) return;
    if (!_cmpGutterBlock.isConnected || !_cmpGutterBlock.classList.contains('selected')) {
      hideCmpGutters();
      return;
    }
    _updateCmpGutterPositions();
    _cmpGutterRafId = requestAnimationFrame(loop);
  }
  _cmpGutterRafId = requestAnimationFrame(loop);
}

function _updateCmpGutterPositions() {
  const overlay = _getOverlay();
  if (!overlay || !_cmpGutterBlock) return;
  const block = _cmpGutterBlock;
  overlay.querySelectorAll('.cmp-gutter').forEach(g => {
    const ci = Number(g.dataset.ci), ri = Number(g.dataset.i);
    const a = _cmpRowEl(block, ci, ri), b = _cmpRowEl(block, ci, ri + 1);
    const col = block.querySelector(`.cmp-inner > .cmp-col[data-col-idx="${ci}"]`);
    if (!a || !b || !col) { g.style.display = 'none'; return; }
    g.style.display = '';
    const ar = a.getBoundingClientRect(), br = b.getBoundingClientRect(), cr = col.getBoundingClientRect();
    const cy = (ar.bottom + br.top) / 2;   // 두 칸 사이 gap 의 중앙
    /* [M64] 와 같은 약 — 칸이 충분히 크면 8px 거터가 글자 중앙까지 닿을 수 없어 rect 를 ★안 읽는다. */
    const probe = ar.height < GUT_PROBE_H || br.height < GUT_PROBE_H;
    const band = _rowGutterBand(
      cy,
      probe ? _cmpRowContentEdge(block, ci, ri, 'up') : null,
      probe ? _cmpRowContentEdge(block, ci, ri + 1, 'down') : null,
    );
    g.style.top = band.top + 'px';
    g.style.height = band.height + 'px';
    g.style.left = cr.left + 'px';
    g.style.width = cr.width + 'px';     // ★그 칼럼만 덮는다(머리말 ⑵)
  });
}

/* 경계 ri|ri+1 을 끌면 «위» 행(rowHeights[ri])의 높이만 바뀐다 — 아래 행은 손대지 않는다(그리드 행과 같은 모델,
   재분배 없음). ★행 높이는 ★전 칼럼 공통이라 어느 칼럼에서 끌어도 그 행 인덱스가 전 칼럼에서 같이 바뀐다
   (comparison-img-edit.js:12 가 적어 둔 그 모델 — 그래서 «칸 하나 코너»가 아니라 «행 경계»가 맞는 손잡이다). */
function _onCmpRowMouseDown(e, block, ci, ri) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const el = _cmpRowEl(block, ci, ri);
  const featFactor = _cmpFeatFactor(block, ci);
  if (!el || featFactor === null) return;
  /* ★읽는 자가 없으면 ⛔아무것도 쓰지 않는다 — 빈 배열로 떨어지면 «다른 행의 높이»를 통째로 지운다
     (「없다」를 고장난 계측기로 재지 마라 — 여기선 「못 읽었다」를 「높이가 없다」로 쓰면 소실이다). */
  const arr0 = window.cmpRowHeights ? window.cmpRowHeights(block.dataset) : null;
  if (!Array.isArray(arr0)) return;

  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};
  /* ★offsetHeight = «설계 px»(transform 영향 없음). 강조 칼럼은 round(기본높이 × featScale) 가 박혀 있어
     되돌려 나눈다 ⇒ 그 반올림만큼(≤0.5/featScale px) 시작값이 어긋날 수 있고, 결과는 다시 정수로 반올림된다. */
  const startH0 = el.offsetHeight / featFactor;
  const startY = e.clientY;
  window.pushHistory?.();   // ★드래그 «시작 직전» 1회만 — mousemove 마다 쌓이면 undo 가 픽셀 단위로 끊긴다

  function onMove(ev) {
    const f = _cmpPxFactor(block, featFactor);   // 드래그 중 줌이 바뀌는 경우까지 방어(매 move 재조회)
    if (!(f > 0)) return;
    const delta = (ev.clientY - startY) / f;
    const h = resizeCmpRowHeight(startH0, delta);   // ★바닥·천장은 모듈 기본값(CMP_ROW_H_MIN/MAX) — ⛔여기서 리터럴로 덮지 않는다
    /* ★쓰는 자리는 한 함수 — 패널 `.cmp-row-h` 와 ★같은 setCmpRowHeight(다른 행·꼬리 null 규약 포함). */
    block.dataset.rowHeights = JSON.stringify(setCmpRowHeight(arr0, ri, h));
    window.renderComparison?.(block);
    _updateCmpGutterPositions();
    /* 패널이 열려 있으면 ★그 행의 입력값만 되쓴다 — ⛔패널 재렌더 금지(포커스·드래그가 끊긴다.
       그리드 거터·prop-grid.js 의 「드래그 중 패널 재렌더 금지」와 같은 규약). */
    const inp = document.querySelector(`.cmp-row-h[data-idx="${ri}"]`);
    if (inp) inp.value = String(h);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
    /* ★끝 상태도 찍는다 — 시작만 찍으면 «다음»이 push-after 일 때 그 사이 표본이 없어 ⌘Z 한 번이 둘을
       같이 먹는다(js/drag-history.js · js/CLAUDE.md 히스토리 규약). 안 움직였으면 무변화 차단이 버린다. */
    window.pushHistory?.();
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showCmpGutters = showCmpGutters;
window.hideCmpGutters = hideCmpGutters;

/* ═══════════════════════════════════════════════════════════════════════════
   GRID 이미지/아이콘 줄 — 코너 리사이즈 핸들 (T-C, 2026-09-16)
   ───────────────────────────────────────────────────────────────────────────
   ★대상은 «지금 선택된(포커스된) 이미지 줄» 하나뿐이다 — grdGetActiveLine(block) 로
     주소를 얻고, getGridModel(block) 으로 그 줄이 type==='image' 인지 확인한다.
     빈 이미지 슬롯(.grd-img-empty)도 같은 addr·같은 필드라 그대로 포함된다.
   ★2026-09-25 — 대상이 «프레임»(.grd-img-frame)으로 옮겨갔다. 안쪽 <img class="grd-img">
     는 프레임을 100%×100% 로 채우므로 «사각형»은 전과 같고(핸들 자리 무변화), 다만
     style.width/height 를 쓰는 대상은 반드시 프레임이어야 한다 — 안쪽에 쓰면 % 의 기준이
     «셀»이 아니라 «프레임»이 되어 폭이 제자리를 맴돈다.
   ★핸들은 자산(asset) 블록 코너 핸들(_onAssetResizeHandleMouseDown)의 수학을 형틀로 쓴다 —
     이미지도 「흐름 배치」라 확대블럭(플로팅)보다 이쪽이 정확한 선례다.
   ⛔클래스는 `.grd-img-overlay-handle` — `.asset-overlay-handle` 을 빌리면
     hideAssetResizeHandles() 의 일괄 remove 에 쓸려 나간다(이 파일 위쪽 주석들이 같은 함정을
     이미 두 번 적어 뒀다: 아이콘원형·확대블럭).
   ★DOM 은 addr(data-r/data-c/data-line)로 매 프레임 재조회한다 — 재렌더로 <img> 가
     통째로 교체될 수 있어 DOM 참조를 들고 있으면 죽은 참조가 된다. */
let _gridImgResizeBlock = null;
let _gridImgResizeAddr = null;   // {r,c,li}
let _gridImgResizeRafId = null;
const GRID_IMG_HANDLE_MIN_SCREEN_PX = 24;   // 낮은 배율 방어 — 거터의 M64 대책과 같은 원칙

function _gridImgFindEl(block, addr) {
  if (!block || !addr || addr.li === null || addr.li === undefined) return null;
  /* ★중첩 안 줄(np)이면 «안 찾는다» (T-200 커밋 ②). 아래 셀렉터는 data-line 으로 재는데
     중첩 안 줄은 그 이름을 안 쓴다 ⇒ 그냥 두면 addr.li(=품은 duo 줄)로 조회하게 되고,
     그 자리에 마침 바깥 이미지 줄이 있으면 «딴 그림»에 코너 핸들이 앉는다. */
  if (addr.np) return null;
  return block.querySelector(`.grd-img-frame[data-r="${addr.r}"][data-c="${addr.c}"][data-line="${addr.li}"]`);
}

function _gridImgActiveImageLine(block) {
  const addr = window.grdGetActiveLine ? window.grdGetActiveLine(block) : null;
  if (!addr || addr.li === null || addr.li === undefined) return null;
  /* ★중첩 안 줄(np)이면 «이미지 줄로 안 친다» (T-200 커밋 ②) — 아래 모델 조회가
     lines[addr.li] 를 보는데 그건 «품은 duo 줄»이다. 크기 손잡이는 쓰는 길이라 범위 밖. */
  if (addr.np) return null;
  let line = null;
  try { line = getGridModel(block).cells[addr.r][addr.c].lines[addr.li]; } catch (_) { line = null; }
  if (!line || line.type !== 'image') return null;
  return { addr, line };
}

function showGridImageResizeHandle(block) {
  const hit = _gridImgActiveImageLine(block);
  if (!hit) { hideGridImageResizeHandle(); return; }
  const el = _gridImgFindEl(block, hit.addr);
  if (!el) { hideGridImageResizeHandle(); return; }

  const same = _gridImgResizeBlock === block && _gridImgResizeAddr
    && _gridImgResizeAddr.r === hit.addr.r && _gridImgResizeAddr.c === hit.addr.c && _gridImgResizeAddr.li === hit.addr.li;
  const overlay0 = _getOverlay();
  if (same && overlay0 && overlay0.querySelector('.grd-img-overlay-handle')) {
    _updateGridImgResizeHandlePositions();
    return;
  }
  hideGridImageResizeHandle();
  _gridImgResizeBlock = block;
  _gridImgResizeAddr = hit.addr;
  const overlay = _getOverlay();
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `grd-img-overlay-handle ${dir}`;
    h.dataset.gridImgResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onGridImageResizeHandleMouseDown(e, block, hit.addr, dir));
  });
  _updateGridImgResizeHandlePositions();
  _startGridImgResizeRaf();
}

function hideGridImageResizeHandle() {
  if (_gridImgResizeRafId) { cancelAnimationFrame(_gridImgResizeRafId); _gridImgResizeRafId = null; }
  _gridImgResizeBlock = null;
  _gridImgResizeAddr = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.grd-img-overlay-handle').forEach(h => h.remove());
}

function _updateGridImgResizeHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_gridImgResizeBlock || !_gridImgResizeAddr) return;
  const el = _gridImgFindEl(_gridImgResizeBlock, _gridImgResizeAddr);
  if (!el) { hideGridImageResizeHandle(); return; }
  const rect = el.getBoundingClientRect();
  const handles = overlay.querySelectorAll('.grd-img-overlay-handle');
  if (rect.width < GRID_IMG_HANDLE_MIN_SCREEN_PX || rect.height < GRID_IMG_HANDLE_MIN_SCREEN_PX) {
    handles.forEach(h => { h.style.display = 'none'; });
    return;
  }
  const HALF = 3.5;
  handles.forEach(h => {
    h.style.display = '';
    const c = _cornerScreen(el, h.dataset.gridImgResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startGridImgResizeRaf() {
  function loop() {
    if (!_gridImgResizeBlock) return;
    const el = _gridImgFindEl(_gridImgResizeBlock, _gridImgResizeAddr);
    if (!_gridImgResizeBlock.isConnected || !el) { hideGridImageResizeHandle(); return; }
    _updateGridImgResizeHandlePositions();
    _gridImgResizeRafId = requestAnimationFrame(loop);
  }
  _gridImgResizeRafId = requestAnimationFrame(loop);
}

function _onGridImageResizeHandleMouseDown(e, block, addr, dir) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const { r, c, li } = addr;
  const el0 = _gridImgFindEl(block, addr);
  if (!el0) return;

  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};
  const scale0 = _canvasScaleNow();
  const rect0 = el0.getBoundingClientRect();
  const startW = rect0.width / scale0;
  const startH = rect0.height / scale0;

  let line = null;
  try { line = getGridModel(block).cells[r][c].lines[li]; } catch (_) { line = null; }
  const curPctN = line ? Number(line.widthPct) : NaN;
  const curPct = Number.isFinite(curPctN) && curPctN > 0 ? curPctN : 100;
  const cellW = startW / (curPct / 100);   // widthPct=100 일 때의 «셀 콘텐츠 폭»(px) 역산
  /* ★비율의 출처 — 프레임은 <div> 라 naturalWidth 가 없다. 안쪽 <img> 에서 읽어야
     Shift-드래그(비율 고정)가 «2026-09-25 이전과 같은 값»을 쓴다. 여기서 el0 만 보면
     조용히 startW/startH(상자 비율)로 떨어져 cover 가 걸린 줄에서 답이 달라진다. */
  const natImg = el0.tagName === 'IMG' ? el0 : el0.querySelector('img');
  const aspect = (natImg && natImg.naturalWidth > 0 && natImg.naturalHeight > 0)
    ? natImg.naturalWidth / natImg.naturalHeight
    : (startH > 0 ? startW / startH : 1);

  /* ★★코너 핸들은 «프레임»만 바꾼다 — 그림은 제자리에 있고 더/덜 잘린다. (2026-09-25 커밋 ②)
   *   현빈: 「코너 핸들로 정하는 그 상자가 맞겠어. … 코너를 끌면 통째로 작아지면 안 되는 거지.」
   *
   *   ⛔그냥 두면 안 된다 — 크롭 값은 «프레임 대비 ％»라(그래야 내보내기 860→780 에서 같은
   *     그림이 된다), 프레임이 줄면 그림도 따라 줄어든다. 그게 바로 현빈이 「안 된다」고 한 것이다.
   *   ⇒ 드래그 «시작 시점의 그림 기하»(px)를 찍어 두고, 놓을 때 «새 프레임 기준 ％»로 되환산한다.
   *     그러면 두 축이 다 산다:
   *       · 코너 드래그 = 프레임만 변함 ⇒ 그림은 화면에서 «한 톨도 안 움직인다»
   *       · 내보내기 폭 축소 = 프레임이 통째로 작아짐 ⇒ ％가 그대로라 그림도 같이 줄어든다
   *   ★크롭이 «없던» 줄도 이 드래그로 크롭이 «생긴다» — 그게 맞다. 그 전엔 cover 가 알아서
   *     가운데를 잡고 있었고, 사용자가 상자를 바꾼 순간 「지금 보이던 그림」을 지켜 줘야 한다. */
  /* ⚠️★«요소 상자»가 아니라 «그려지는 그림»을 찍어야 한다 — 이 둘은 다르다.
   *   `object-fit:cover` 인 <img> 의 rect 는 «상자»(=프레임)다. 실제 그림은 그보다 크고
   *   가운데로 밀려 있다. 상자를 못으로 박으면 코너를 끄는 순간 그림이 세로로 «튄다».
   *   실측(400×250 그림, 프레임 796×200): 상자 796×200 · 그림 796×497.5(top −148.75).
   *   ⇒ cover/contain 이면 산식으로 풀고, 이미 절대배치(크롭 있음)면 rect 가 곧 그림이다.
   *   ★enterGridImageEditMode 가 편집을 열 때 쓰는 산식과 «같은 것»이다(k = max(W/nw, H/nh)). */
  let imgPin = null;
  if (natImg) {
    const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(natImg) : null;
    const fit = (cs && cs.objectFit || '').trim();
    const nw = natImg.naturalWidth, nh = natImg.naturalHeight;
    if ((fit === 'cover' || fit === 'contain') && nw > 0 && nh > 0) {
      const k = fit === 'cover' ? Math.max(startW / nw, startH / nh) : Math.min(startW / nw, startH / nh);
      const dw = nw * k, dh = nh * k;
      imgPin = { x: (startW - dw) / 2, y: (startH - dh) / 2, w: dw };
    } else {
      const ir = natImg.getBoundingClientRect();
      imgPin = { x: (ir.left - rect0.left) / scale0, y: (ir.top - rect0.top) / scale0, w: ir.width / scale0 };
    }
  }

  const startX = e.clientX, startY = e.clientY;
  let moved = false;
  let lastResult = null;

  function onMove(ev) {
    const el = _gridImgFindEl(block, addr);   // 매 프레임 addr 로 재조회(재렌더로 교체될 수 있음)
    if (!el) return;
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    if (!moved && Math.hypot(dx, dy) < 1) return;
    if (!moved) { moved = true; window.pushHistory?.('그리드 이미지 크기'); }
    const result = resizeGridImage({ startW, startH, dir, dx, dy, cellW, aspect, lockAspect: ev.shiftKey });
    lastResult = result;
    el.style.width = result.widthPct + '%';
    el.style.height = result.height + 'px';
    /* ★미리보기 = 커밋 결과. 그림을 «시작 기하»에 px 로 못박고 프레임만 자라고 줄게 한다.
       ⛔안 하면 드래그 중엔 그림이 같이 줄다가 놓는 순간 튄다 — 「보인 대로 된다」가 깨진다. */
    const innerImg = el.querySelector('img');
    if (innerImg && imgPin) {
      el.style.position = 'relative';
      el.style.overflow = 'hidden';
      innerImg.style.position = 'absolute';
      innerImg.style.left = imgPin.x + 'px';
      innerImg.style.top = imgPin.y + 'px';
      innerImg.style.width = imgPin.w + 'px';
      innerImg.style.height = 'auto';
      innerImg.style.objectFit = '';
    }
    /* 우측 패널 입력을 «직접» 갱신 — 드래그 중 패널 재렌더 금지(gutter 와 같은 원칙).
     * ★2026-09-25 — 여기 「이미지 절에는 폭 입력이 없어 높이만 동기화한다」고 적혀 있었다.
     *   그 전제가 74eb3c9(R6, 「폭(%)」 칸 신설)로 «거짓»이 됐는데 코드는 안 따라왔다 ⇒ 실기에서
     *   코너를 끌면 모델 widthPct=76 인데 패널 칸은 100 을 보여 줬다(높이는 맞았다). 저장값은
     *   옳고 «화면만» 거짓말하던 꼴 — 패널을 다시 그리면 맞는 수가 나왔다.
     * ⛔둘을 «같은 시점»에 넣는다 — 드래그 «중» 매 프레임(놓을 때만이 아니다). 높이가 원래
     *   그랬고, 둘이 다른 시점이면 그 차이가 또 어긋남이 된다. 두 수 다 같은 `result` 에서
     *   오고 둘 다 정수다(grid-cell-resize.js 가 Math.round 해서 준다) ⇒ 칸에 그대로 넣는다.
     * ★폭이 100 이어도 «비우지» 않는다 — 놓는 순간 onUp 이 widthPct:100 을 모델에 «명시로»
     *   쓰므로, 그 뒤 패널을 다시 그리면 칸에 100 이 찍힌다. 여기서 비우면 그 재렌더와 어긋난다. */
    const hNum = document.getElementById('grd-img-height');
    if (hNum) hNum.value = result.height;
    const wNum = document.getElementById('grd-img-width-pct');
    if (wNum) wNum.value = result.widthPct;
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    restoreDrag();
    if (moved && lastResult) {
      /* ★px → ％ 되환산. 기준은 «새» 프레임이다(가로는 폭, 세로는 높이 — 렌더러가 left/top 을
         그렇게 푼다). imgPin 이 없으면(그림을 못 잡았으면) 크롭은 «안» 건드린다. */
      const patch = { widthPct: lastResult.widthPct, height: lastResult.height };
      if (imgPin) {
        const newW = cellW * lastResult.widthPct / 100;
        const newH = lastResult.height;
        /* ★소수 «세» 자리 — 한 자리면 795.8 vs 796.0 처럼 0.2px 이 어긋나고, 그 어긋남이
           강한 경계선에서 눈에 보이는 재표본화 차이가 된다(grid-block.js _gridClampPct 주석). */
        const r1 = (v) => Math.round(v * 1000) / 1000;
        if (newW > 0 && newH > 0) {
          patch.imgSizePct = r1(imgPin.w / newW * 100);
          patch.imgPosX    = r1(imgPin.x / newW * 100);
          patch.imgPosY    = r1(imgPin.y / newH * 100);
        }
      }
      gridPreviewLine(block, r, c, li, patch);
      window._grdSyncLineMark?.(block, addr);   // 재렌더가 마커를 지웠다 — 다시 붙인다
      /* ★끝 상태도 찍는다 — 시작만 찍으면 «다음»이 push-after 동작일 때 그 둘 사이의
         표본이 없어 ⌘Z 한 번이 둘을 같이 먹는다(js/drag-history.js). 무변화면 history.js 가 버린다. */
      window.pushHistory?.('그리드 이미지 크기');
      window.scheduleAutoSave?.();
      showGridImageResizeHandle(block);         // 재렌더로 교체된 새 <img> 에 핸들을 다시 붙인다
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showGridImageResizeHandle = showGridImageResizeHandle;
window.hideGridImageResizeHandle = hideGridImageResizeHandle;

/* ═══════════════════════════════════
   GRID LINE DRAG GRIP — 칸 «안»의 줄을 끌어 옮긴다 (T-228, 2026-09-27 현빈 발주)
   ────────────────────────────────────────────────────────────────────────
   ★왜 여기인가 — 끄는 «손잡이»를 줄 HTML 에 넣으면 내보내기 산출 «바이트»가 바뀌어 골든
     (tests/unit/grid-gap-clamp.test.js, 기준판 55f3a1a 대조)이 빨개진다. #ss-handles-overlay 는
     #canvas-scaler «바깥»이라(위 거터 절의 그 까닭) 저장본·export 에 애초에 없다.
     ⇒ 손잡이를 여기에 얹으면 ★렌더 산출을 한 자도 안 바꾸고 손을 붙일 수 있다.
   ★대상은 «지금 고른 줄» 하나다 — 칸마다 20줄까지 되므로 전부에 손잡이를 띄우면 rAF 가
     수십 개 rect 를 매 프레임 재는 일이 된다(거터는 경계 몇 개뿐이라 사정이 달랐다).
     ⇒ 「고르고 끈다」. ⌘←/→(T-227)도 「고른 뒤」라 두 길의 말이 같아진다.
   ★표시선은 ★새로 만들지 않는다 — `.drop-indicator` 를 «칸 안»에 끼운다(카드 T-228 measured
     가 「새로 만들지 말고 그것을 쓰십시오」라 적어 둔 그 자리). 칸이 flex-direction:column 이라
     줄 사이에 끼우면 그대로 가로 띠가 된다. ★세척도 이미 있다 — section-serialize.js 가
     `.drop-indicator` 를 지운다(드래그 중 autosave 가 돌아도 저장본에 안 샌다).
   ★모델을 고쳐 «다시 그린다» — ⛔DOM 을 insertBefore 로 옮기지 않는다. renderGridBlock 이
     block.innerHTML 을 통째로 갈아끼우므로 DOM 이동은 다음 렌더에 사라진다(카드 measured 의
     경고 그대로). 쓰는 길은 prop-grid.js 의 두 함수다 — 같은 칸이면 grdMoveLineWithin(한 문),
     다른 칸이면 grdMoveLineToCell(두 문 + 이력 한 칸).
   ⛔중첩(duo) «안»의 줄은 집지도, 놓지도 않는다 — 쓰는 길이 거기로 안 내려간다(T-220 몫).
═══════════════════════════════════ */
let _grdGripBlock = null;
let _grdGripAddr = null;          // {r,c,li} — 중첩(np)은 여기 오지 않는다
let _grdGripRafId = null;
const GRD_GRIP_MIN_SCREEN_PX = 10;   // 낮은 배율 방어 — 거터·이미지 핸들과 같은 원칙
const GRD_GRIP_DRAG_THRESHOLD_PX = 3;
const GRD_GRIP_W = 12;
const GRD_GRIP_H = 18;

/** 그 주소의 «바깥 줄» DOM. ⛔중첩 안 줄(np)은 null — data-line 을 안 쓰므로 addr.li 로
 *  조회하면 «품은 duo 줄»을 집는다(_gridImgFindEl 이 같은 함정을 같은 말로 막는다). */
/* ★★BT3(2026-10-06 ⑵-B) — 아래 넷은 «주인(host)»에게 묻는다. ⛔그리드 주소를 ★여기서 직접 읽지 마라.
 *   무엇이었나 — 이 손잡이가 `[data-r][data-c][data-line]` 로 줄을 찾고 `.grd-cell` 로 칸을 찾았다.
 *     ⇒ 버블·챗 줄은 그 주소를 ★고의로 안 찍으므로(line-host.js 머리말 · 시험 T7) 손잡이가 ★못 섰다.
 *   ⇒ 묻는 길을 계약 다섯 칸(rowEl·linesBox·rowsIn·rowAt·moveLine)으로 바꿨다.
 *     ★그리드 구현은 prop-grid.js `_grdGridHost` 안에 ★옛 내부 그대로 옮겼다(산출·동작 불변).
 *   ⛔이 파일을 복사해 `showLineGrip` 을 새로 만들지 마라 — 그게 이 레포가 갈라진 까닭이다. */
function _lnGripHost(block) {
  if (!block || !block.classList) return null;
  /* ★버블·챗이면 그쪽 주인, 아니면 그리드 주인. ★하나의 문으로 모은다(명부 둘 금지). */
  const h = window.lnHostFor ? window.lnHostFor(block) : null;
  if (h) return h;
  if (!block.classList.contains('grid-block')) return null;
  return window.grdLineUi && window.grdLineUi.gridHost ? window.grdLineUi.gridHost(block) : null;
}

function _grdGripFindEl(block, addr) {
  if (!block || !addr || addr.li === null || addr.li === undefined || addr.np) return null;
  const H = _lnGripHost(block);
  return (H && H.rowEl) ? H.rowEl(addr) : null;
}

/** 지금 고른 «바깥 줄» 주소 — 없으면 null. */
function _grdGripActiveAddr(block) {
  const addr = window.grdGetActiveLine ? window.grdGetActiveLine(block) : null;
  if (!addr || addr.li === null || addr.li === undefined || addr.np) return null;
  return addr;
}

/** 이 그릇의 «바깥 줄» DOM 들. ★중첩 «안»의 줄은 그리드 구현이 걸러낸다(:scope > [data-line]). */
function _grdGripCellLines(boxEl, block) {
  const H = _lnGripHost(block);
  return (H && H.rowsIn) ? H.rowsIn(boxEl) : [];
}

/** 포인터 y 가 이 그릇의 «몇 번째 자리»인가 — 0..N (N = 줄 수 = 끝에 붙이기). */
function _grdGripInsertAt(boxEl, clientY, block) {
  const kids = _grdGripCellLines(boxEl, block);
  for (let i = 0; i < kids.length; i++) {
    const rc = kids[i].getBoundingClientRect();
    if (clientY < rc.top + rc.height / 2) return i;
  }
  return kids.length;
}

/** «삽입 자리»(0..N)를 «옮길 대상 index»로 바꾼다.
 *
 * ★★여기가 이 카드에서 제일 틀리기 쉬운 셈이다. 쓰는 함수들은 `splice(from,1)` 로 «먼저 떼고»
 *   `splice(to,0,…)` 로 넣는다. 그래서 «같은 칸»에서 아래로 옮길 때는 떼는 순간 뒤쪽 index 가
 *   하나씩 당겨진다 ⇒ 삽입 자리에서 1 을 빼야 «본 자리»에 놓인다.
 *     [A,B,C] 에서 A 를 B·C 사이(삽입 자리 2)로 → 떼면 [B,C] ⇒ to=1 ⇒ [B,A,C] ✅
 *     같은 것을 to=2 로 보내면 [B,C,A] 가 된다(한 칸 더 갔다).
 * ⛔«다른 칸»에는 이 보정을 하지 마라 — 떼는 일이 «다른 배열»에서 일어나므로 도착 칸의 index 는
 *   당겨지지 않는다. 보정하면 한 칸 앞에 놓인다.
 * @param {number} fromLi · @param {number} insertAt · @param {boolean} sameCell */
function _grdGripDropTarget(fromLi, insertAt, sameCell) {
  if (!sameCell) return insertAt;
  return insertAt > fromLi ? insertAt - 1 : insertAt;
}

function showGridLineGrip(block) {
  const addr = _grdGripActiveAddr(block);
  if (!addr) { hideGridLineGrip(); return; }
  const el = _grdGripFindEl(block, addr);
  if (!el) { hideGridLineGrip(); return; }
  const same = _grdGripBlock === block && _grdGripAddr
    && _grdGripAddr.r === addr.r && _grdGripAddr.c === addr.c && _grdGripAddr.li === addr.li;
  const overlay0 = _getOverlay();
  if (same && overlay0 && overlay0.querySelector('.grd-line-grip')) {
    _updateGridLineGripPosition();
    return;
  }
  hideGridLineGrip();
  _grdGripBlock = block;
  _grdGripAddr = { r: addr.r, c: addr.c, li: addr.li };
  const overlay = _getOverlay();
  if (!overlay) return;
  const g = document.createElement('div');
  g.className = 'grd-line-grip';
  /* ★position:absolute — #ss-handles-overlay 자체가 position:fixed;inset:0 이라 자식은
     absolute 로 둬도 좌표계가 뷰포트와 같다(거터·이미지 핸들과 같은 관례). */
  g.style.cssText = `position:absolute;width:${GRD_GRIP_W}px;height:${GRD_GRIP_H}px;`
    + 'cursor:grab;z-index:98;pointer-events:auto;border-radius:3px;'
    + 'background:var(--ui-accent-primary);opacity:.85;'
    + 'display:flex;align-items:center;justify-content:center;'
    + 'color:#fff;font-size:10px;line-height:1;user-select:none;';
  g.textContent = '⠿';
  /* ★손잡이가 «말도 한다» — ⌘↑/↓(0926)·⌘←/→(T-227)는 그때까지 화면 안내가 0건이었다.
     T-220 에서 현빈이 「중첩줄을 내가 만들려면 어떻게 해야되나?」를 물으신 그 병이다.
     ⇒ 보이는 손잡이가 생긴 이 자리에서 세 길을 «한 번에» 말한다. */
  g.title = '끌어서 줄 옮기기 · ⌘↑/↓ 같은 칸 위·아래 · ⌘←/→ 옆 칸으로';
  overlay.appendChild(g);
  g.addEventListener('mousedown', e => _onGridLineGripMouseDown(e, block, _grdGripAddr));
  /* ★거터와 같은 규약 — 손잡이 위 우클릭도 «블록의» 컨텍스트 메뉴로 보낸다(손잡이는
     오버레이 자식 = 블록 «바깥»이라 그냥 두면 메뉴가 아예 안 뜬다). */
  g.addEventListener('contextmenu', e => {
    if (window._openBlockContextMenu) window._openBlockContextMenu(e, block);
  });
  _updateGridLineGripPosition();
  _startGridLineGripRaf();
}

function hideGridLineGrip() {
  if (_grdGripRafId) { cancelAnimationFrame(_grdGripRafId); _grdGripRafId = null; }
  _grdGripBlock = null;
  _grdGripAddr = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('.grd-line-grip').forEach(g => g.remove());
}

function _updateGridLineGripPosition() {
  const overlay = _getOverlay();
  if (!overlay || !_grdGripBlock || !_grdGripAddr) return;
  const el = _grdGripFindEl(_grdGripBlock, _grdGripAddr);
  if (!el) { hideGridLineGrip(); return; }
  const g = overlay.querySelector('.grd-line-grip');
  if (!g) return;
  const rect = el.getBoundingClientRect();
  if (rect.height < GRD_GRIP_MIN_SCREEN_PX) { g.style.display = 'none'; return; }
  /* ⛔★`= ''` 로 되돌리지 마라 — 그건 inline display 를 «지운다». 이 손잡이는 display 를
     «인라인으로만» 받으므로(위 cssText 의 `display:flex`) 지우면 기본값 block 이 되고,
     그 순간 align-items·justify-content 가 «아무 일도 안 해» ⠿ 가 상자 안에서 가운데로 안 온다.
     ★2026-09-27 현빈이 그것을 「깨져 보인다」로 짚었다 — 실측: inline display «없음» · computed `block`.
     ⚠️다른 손잡이들(`.grd-img-overlay-handle` 등)이 `= ''` 를 쓰는 것은 그쪽은 display 를
       «CSS 클래스»로 받기 때문이다. 같은 줄이라고 베끼면 이 병이 되돌아온다. */
  g.style.display = 'flex';
  /* ★줄의 «왼쪽 밖»에 둔다 — 줄 위에 얹으면 글자를 가리고, 인라인 편집 클릭까지 먹는다. */
  g.style.left = (rect.left - GRD_GRIP_W - 2) + 'px';
  g.style.top = (rect.top + rect.height / 2 - GRD_GRIP_H / 2) + 'px';
}

function _startGridLineGripRaf() {
  function loop() {
    if (!_grdGripBlock) return;
    /* 블록이 사라졌거나 선택이 풀렸거나 그 줄이 없어졌으면 정리 — 거터·이미지 핸들과 같은 꼴. */
    if (!_grdGripBlock.isConnected || !_grdGripBlock.classList.contains('selected')
        || !_grdGripFindEl(_grdGripBlock, _grdGripAddr)) {
      hideGridLineGrip();
      return;
    }
    _updateGridLineGripPosition();
    _grdGripRafId = requestAnimationFrame(loop);
  }
  _grdGripRafId = requestAnimationFrame(loop);
}

function _onGridLineGripMouseDown(e, block, addr) {
  if (e.button !== 0) return;
  e.preventDefault();
  e.stopPropagation();
  const restoreDrag = window.suppressAncestorDrag ? window.suppressAncestorDrag(block) : () => {};
  const x0 = e.clientX, y0 = e.clientY;
  const prevCursor = document.body.style.cursor;
  const grip = _getOverlay()?.querySelector('.grd-line-grip') || null;
  let armed = false;
  /* ★«놓을 자리»를 closure 에 든다 — ⛔onUp 에서 DOM 으로 다시 찾지 않는다(js/CLAUDE.md 의
     「indicator.nextSibling 을 onUp 에서 저장하지 마라」와 같은 까닭: 그때는 이미 지워져 있다). */
  let dropRC = null;        // {r,c}
  let dropInsertAt = null;  // 0..N

  function onMove(ev) {
    if (!armed) {
      if (Math.abs(ev.clientX - x0) < GRD_GRIP_DRAG_THRESHOLD_PX
          && Math.abs(ev.clientY - y0) < GRD_GRIP_DRAG_THRESHOLD_PX) return;
      armed = true;
      document.body.style.cursor = 'grabbing';
      /* ★손잡이를 포인터에 «투명»하게 만든다 — 아니면 elementFromPoint 가 손잡이를 집어
         「어느 칸 위인가」를 영영 못 읽는다(손잡이는 pointer-events:auto 다). */
      if (grip) grip.style.pointerEvents = 'none';
    }
    window.clearDropIndicators?.();
    dropRC = null; dropInsertAt = null;
    const t = document.elementFromPoint(ev.clientX, ev.clientY);
    /* ★«행»을 주인에게 묻는다 — 그리드 = 칸{r,c} · 버블 = 하나{r:0} · 챗 = 메시지{r:idx}. */
    const H = _lnGripHost(block);
    const at = (H && H.rowAt) ? H.rowAt(t) : null;
    const cellEl = at ? at.box : null;
    if (!cellEl) return;
    /* ★★중첩(duo) «안»은 따로 막지 않는다 — ⛔처음엔 `cellEl.closest('.grd-nested')` 가드를
       넣었는데 그것은 ★아무것도 안 재는 문이었다. 실측: 중첩의 열은 `.grd-nested-col` 이고
       중첩 «안»에는 `.grd-cell` 이 아예 없다(grid-block.js 의 중첩 렌더 두 줄). ⇒ 중첩 위에
       포인터를 두면 closest 가 «바깥 칸»을 집는다.
       ★그리고 그것이 «맞는 동작»이다 — 중첩 줄(`.grd-nested`)은 바깥 칸의 «한 줄»로서
       data-r/data-c/data-line 을 가지므로, 아래 _grdGripCellLines 가 그것을 한 줄로 세고
       위쪽 절반이면 «그 줄 앞», 아래쪽이면 «그 줄 뒤»가 된다. 사용자가 보는 것과 같다.
       ⛔중첩 «안»으로 줄을 밀어 넣는 것은 여전히 못 한다 — 쓰는 길이 거기로 안 내려간다
         (T-220 몫). 그건 여기서 «막을» 일이 아니라 애초에 «갈 수 없는» 자리다. */
    dropRC = { r: at.r, c: at.c };
    dropInsertAt = _grdGripInsertAt(cellEl, ev.clientY, block);
    const ind = document.createElement('div');
    ind.className = 'drop-indicator';
    const kids = _grdGripCellLines(cellEl, block);
    if (dropInsertAt >= kids.length) cellEl.appendChild(ind);
    else cellEl.insertBefore(ind, kids[dropInsertAt]);
  }

  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    document.body.style.cursor = prevCursor;
    if (grip) grip.style.pointerEvents = 'auto';
    window.clearDropIndicators?.();
    restoreDrag();
    /* ⛔안 끌었으면(임계 미달) «아무 일도 안 한다» — 손잡이를 그냥 누른 것은 클릭이다. */
    if (!armed || !dropRC || dropInsertAt === null) return;
    const sameCell = dropRC.r === addr.r && dropRC.c === addr.c;
    const to = _grdGripDropTarget(addr.li, dropInsertAt, sameCell);
    /* ★쓰는 길은 «부른다» — 이력·되돌림·활성줄 옮기기는 그쪽이 들고 있다(여기서 pushHistory 를
       부르지 않는다. updateGridBlock 이 쓰기 직전에 스스로 1회 쌓는다). */
    /* ★쓰는 길도 주인이 든다 — 같은 행/다른 행 가름과 이력은 그쪽 몫이다(여기서 pushHistory 를 안 부른다). */
    const Hup = _lnGripHost(block);
    Hup?.moveLine?.({ r: addr.r, c: addr.c }, addr.li, { r: dropRC.r, c: dropRC.c }, to);
  }

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

window.showGridLineGrip = showGridLineGrip;
window.hideGridLineGrip = hideGridLineGrip;

// fix(frame-p0#5): 캔버스 클릭 핸들러 6곳(block-drag.js asset·icon-circle·canvas·vector·
// iconify·mockup)이 저마다 손으로 부르던 핸들 호출을 타입→핸들 맵 하나로 모은다.
// 진입점(레이어패널 등)이 늘어도 여기 한 곳만 맞으면 된다 — SSOT.
// (캔버스 6곳 자체는 회귀 격리를 위해 P0에서는 그대로 두고 P1에서 이 맵으로 치환한다.)
/* ═══════════════════════════════════════════════════════════════════════════
   확대블럭(zoom) 리사이즈 핸들 — 현빈 2026-09-08 「아웃라인으로 핸들로 높이와 너비 조절」
   ───────────────────────────────────────────────────────────────────────────
   ★핸들은 «블록 상자»에 붙는다 — 확대블럭은 플로팅(스티커 계열)이라 블록 상자가 곧
     도형(+테두리) 상자다. 보라 아웃라인이 그리는 상자와 «같은 상자»라 모서리가 정확히 맞는다.
   ★크기는 style.width/height 가 아니라 dataset.w / dataset.h 에 쓴다.
     확대블럭의 크기는 CSS 상자가 아니라 «SVG 안 도형»이라, 블록에 width 를 줘도 도형이 안 변한다.
     ⇒ renderZoomBlock 을 다시 불러 실루엣·그림자·뷰박스가 «같이» 따라오게 한다.
   ⚠️circle 은 정원만 그릴 수 있다(silhouetteCircle 전제) ⇒ w=h 로 묶어서 쓴다.
   ═══════════════════════════════════════════════════════════════════════════ */
const ZOOM_MIN = 20, ZOOM_MAX = 1200;
let _zoomResizeBlock = null;
let _zoomResizeRafId = null;

/** 핸들이 앉을 상자 = ★블록 «자신». 플로팅(스티커 계열)이라 블록 상자가 곧 도형(+테두리) 상자다.
 *  ⛔예전엔 보조 상자(.zoom-sel-box)를 뒀다 — 블록이 행 안에 있어 «행 전체 폭»이었기 때문이다.
 *    플로팅으로 옮기면서 그 보조 상자가 없어졌다(zoom-geometry.js blockBoxSpec 주석 참조). */
function _zoomOutlineBox(zb) {
  return zb;
}

function showZoomResizeHandles(zb) {
  const overlay = _getOverlay();
  /* ★빗장은 «지워진 상태»를 알아채야 한다 — «같은 블록»인지만 보고 early-return 하면
   *   핸들이 이미 쓸려나간 뒤에도 «다시 만들지 않는다». 실측 증상: 추가 후 재클릭에서
   *   4→0 으로 사라지고 그 뒤로는 영영 0 (MutationObserver: REMOVE 4건 / ADD 0건).
   *   deselectAll() → hideAssetResizeHandles() 가 (클래스를 공유하던 시절) 줌 핸들까지
   *   쓸어갔는데 _zoomResizeBlock 은 남의 변수가 아니라 안 지워져서 빗장이 계속 닫혀 있었다.
   * ⇒ «같은 블록»이면서 «핸들이 실제로 DOM 에 있을 때»만 건너뛴다. */
  if (_zoomResizeBlock === zb && overlay && overlay.querySelector('[data-zoom-resize-dir]')) return;
  hideZoomResizeHandles();
  _zoomResizeBlock = zb;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    /* ⚠️클래스는 `.zm-overlay-handle` — `.asset-overlay-handle` 을 «빌려 쓰면»
     *   `hideAssetResizeHandles()` 의 일괄 제거에 같이 쓸려나간다.
     *   아이콘원형(.icb-overlay-handle)이 이미 같은 함정을 밟고 이 파일에 경고를 남겼는데
     *   확대블럭이 그 경고를 그대로 밟았다(842행 부근 주석 참조).
     *   모양은 css/editor-blocks.css 에서 기존 규칙에 «얹혀» 공유한다 — 복사가 아니다. */
    h.className = `zm-overlay-handle ${dir}`;
    h.dataset.zoomResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onZoomResizeMouseDown(e, zb, dir));
  });
  _updateZoomHandlePositions();
  _startZoomResizeRaf();
}

function hideZoomResizeHandles() {
  if (_zoomResizeRafId) { cancelAnimationFrame(_zoomResizeRafId); _zoomResizeRafId = null; }
  _zoomResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-zoom-resize-dir]').forEach(h => h.remove());
}

function _updateZoomHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_zoomResizeBlock) return;
  const box = _zoomOutlineBox(_zoomResizeBlock);
  const HALF = 3.5;
  overlay.querySelectorAll('[data-zoom-resize-dir]').forEach(h => {
    const c = _cornerScreen(box, h.dataset.zoomResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startZoomResizeRaf() {
  function loop() {
    if (!_zoomResizeBlock) return;
    if (!_zoomResizeBlock.isConnected || !_zoomResizeBlock.classList.contains('selected')) {
      hideZoomResizeHandles();
      return;
    }
    _updateZoomHandlePositions();
    _zoomResizeRafId = requestAnimationFrame(loop);
  }
  _zoomResizeRafId = requestAnimationFrame(loop);
}

function _onZoomResizeMouseDown(e, zb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const st = window.readZoomState?.(zb) || {};
  const box = _zoomOutlineBox(zb);
  // 시작 크기 = «도형» 크기. 아웃라인 상자는 테두리만큼 더 크므로 그만큼 뺀다.
  const bw = (st.bd === 'on') ? Math.max(0, Number(st.bdw) || 0) : 0;
  const startW = Math.max(ZOOM_MIN, Math.round(box.offsetWidth  - bw * 2));
  const startH = Math.max(ZOOM_MIN, Math.round(box.offsetHeight - bw * 2));
  const startX = e.clientX, startY = e.clientY;
  const isCircle = st.shape === 'circle';
  /* ★④ 끄는 코너가 «손끝을 따라온다» — 예전엔 w/h 만 쓰고 x/y 를 안 건드려서 어느 코너를
     끌든 좌상단이 고정되고 오른쪽·아래로만 자랐다(실측: nw 를 (−80,−50) 끌어도 코너 Δ=(0,0),
     크기만 260×140 → 340×190. 네 코너 중 se 하나만 «우연히» 맞았다).
     ⇒ 「끄는 코너의 «맞은편» 코너를 고정한다」로 고친다. 그러면 끄는 코너가 손끝에 붙는다.
     ★수식(중심 C, 반치수 hw·hh, 회전 θ, 끄는 코너의 로컬 부호 sx·sy):
         맞은편 코너 = C + R(θ)·(−sx·hw, −sy·hh) 를 «불변»으로 두면
         ΔC = R(θ)·(sx·Δhw, sy·Δhh)   ⇒   Δ(좌상단) = ΔC − (Δhw, Δhh)
     ⚠️θ 는 «드래그 내내 안 바뀐다» — 여기서 한 번만 읽는다.
     ⚠️테두리 두께는 드래그 중 상수라 Δ 반치수는 도형과 상자가 «같다»(bw 가 상쇄된다). */
  const sx = dir.includes('e') ? 1 : -1;
  const sy = dir.includes('s') ? 1 : -1;
  const th = _blockRotationDeg(box) * Math.PI / 180;
  const cosT = Math.cos(th), sinT = Math.sin(th);
  /* ⚠️readZoomState 가 없으면 st 는 {} 다 — 그때는 dataset 을 직접 읽는다.
     ⛔둘 다 없다고 0 으로 떨어뜨리면 블록이 섹션 좌상단으로 «순간이동»한다. */
  const startPosX = Number(st.x ?? zb.dataset.x) || 0;
  const startPosY = Number(st.y ?? zb.dataset.y) || 0;
  let moved = false;

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const d = _unrotateDelta(box, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    let dw = dir.includes('e') ? d.dx : dir.includes('w') ? -d.dx : 0;
    let dh = dir.includes('s') ? d.dy : dir.includes('n') ? -d.dy : 0;
    if (!moved && Math.hypot(dw, dh) < 1) return;
    if (!moved) { moved = true; window.pushHistory?.('확대블럭 크기'); }
    let newW = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(startW + dw)));
    let newH = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(startH + dh)));
    // ⚠️원은 정원만 — 큰 쪽으로 묶는다. Shift 는 비율 고정(에셋 핸들과 같은 어휘).
    if (isCircle) { newW = newH = Math.max(newW, newH); }
    else if (ev.shiftKey && startH > 0) {
      if (Math.abs(dw) >= Math.abs(dh)) newH = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(newW * startH / startW)));
      else newW = Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, Math.round(newH * startW / startH)));
    }
    zb.dataset.w = String(newW);
    zb.dataset.h = String(newH);
    /* ★④ 맞은편 코너를 고정 — 위 수식 그대로. ⛔x/y 를 안 쓰면 좌상단이 못박혀
       「끄는 코너가 안 따라오는」 그 병으로 돌아간다(se 만 우연히 맞는다). */
    const dHW = (newW - startW) / 2, dHH = (newH - startH) / 2;
    zb.dataset.x = String(startPosX + (cosT * sx * dHW - sinT * sy * dHH) - dHW);
    zb.dataset.y = String(startPosY + (sinT * sx * dHW + cosT * sy * dHH) - dHH);
    window.renderZoomBlock?.(zb);   // ★실루엣·그림자·뷰박스가 «같이» 따라온다
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태도 찍는다(시작은 onMove 의 첫 틱). 한쪽만 찍으면 이웃 규약에 따라
       ⌘Z 가 두 동작을 같이 먹거나(before→after) 한 번 먹통이 된다(after→before). */
    if (moved) { window.pushHistory?.('확대블럭 크기'); window.showZoomProperties?.(zb); window.triggerAutoSave?.(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ═══════════════════════════════════════════════════════════════════════════
   확대블럭 — 모서리 라운드 핸들 (.zm-radius-handle)
   현빈 2026-09-09 「추가되는 사각형의 모서리 라디오도 좀 조절했으면 좋겠어.
                     다른 사각형 셋 조절할 때 뭐 그렇게 했었잖아」

   ⛔«에셋 핸들을 그대로 베끼면 안 된다». 기존 코너반경 핸들 넷(frame·asset·modal·canvas)은
     전부 `el.style.borderRadius` 로 DOM 에 «직접» 쓴다. 확대블럭은 그 길이 막혀 있다 —
     renderZoomBlock(zoom-block.js:200)이 `block.style.cssText` 를 «통째로» 덮으므로
     끌자마자 다음 렌더에서 값이 날아간다(그리고 «아무 오류도 안 난다»).
   ⇒ 베낄 대상은 «같은 파일의» _onZoomResizeMouseDown 이다: 「dataset 에 쓰고
     renderZoomBlock 을 부른다」는 규약이 거기 이미 산다. 여기도 그 규약만 쓴다.

   ⛔클래스로 `.asset-radius-handle` 을 «빌리지» 않는다 — hideAssetRadiusHandles() 의
     일괄 remove 가 같이 쓸어간다. 이 파일 1827행 주석이 «그 함정을 두 번 밟았다»고 적어 뒀다
     (아이콘원형이 한 번, 확대블럭 리사이즈 핸들이 또 한 번). 모양만 CSS 에서 «얹어» 쓴다.

   ★★상한(ZOOM_BDR_MAX)에 «잠복 결함»이 걸려 있다 — 아래 상수 주석 참조.
   ═══════════════════════════════════════════════════════════════════════════ */

/** 모서리 라운드 상한(px). ★이 숫자는 «취향»이 아니라 아래 결함의 크기에서 나왔다.
 *
 * ⚠️결함: 그림자(빛줄기)의 실루엣은 도형의 «꼭짓점»에서 잡는다(zoom-geometry.js
 *   shapeCornerPts → silhouetteFromPts). 그런데 라운드를 주면 실제 윤곽은 그 꼭짓점에서
 *   호(弧) 쪽으로 «들어간다». 어긋나는 거리는 대각선 방향으로 정확히
 *       g = bdr · (√2 − 1) ≈ 0.4142 · bdr
 *   ⇒ 빛줄기의 밑변이 도형에서 g 만큼 «떠서» 모서리 옆에 얇은 쐐기로 비어 보인다.
 *
 * ★«눈에 띄는» 치수는 g 가 아니라 둘이다(g 는 «최단»거리라 제일 작게 나온다):
 *     · 코너 극점에서 빛줄기 밑변이 도형 위로 뜨는 «높이» = bdr «그 자체»
 *     · 코너 하나당 도형 밖으로 삐져나온 «넓이» = bdr²(1 − π/4)
 *
 * ★★재서 골랐다 — 9363 포트, 배율 100%, rect 260×140, shadow on, maxop 60, 광원 12시.
 *   bdr | 최단 g  | 코너당 넓이 | 극점 높이 | 눈으로
 *     8 | 3.31px |   13.7 px² |    8px | 안 보인다
 *    16 | 6.63px |   54.9 px² |   16px | 안 보인다  ← ★여기를 상한으로 잡았다
 *    24 | 9.94px |  123.6 px² |   24px | 코너에 옅은 쐐기가 «보이기 시작»한다
 *    40 |16.57px |  343.4 px² |   40px | 확실한 «날개» — 그림자가 도형에서 떨어져 보인다
 *
 * ⛔이번에 실루엣을 «고치지 않는다» — 범위 밖이다(현빈 지시는 「모서리 조절」까지다).
 * ★★이 상한을 올리려면 «실루엣부터» 고쳐야 한다: zoom-geometry.js 의
 *   silhouetteFromPts 가 shapeCornerPts 의 «꼭짓점»이 아니라 「라운드된 윤곽의 접점」을
 *   잡도록 바꾸는 일이다. 그걸 안 하고 숫자만 키우면 위 표의 오른쪽으로 그대로 내려간다. */
const ZOOM_BDR_MAX = 16;

let _zoomRadiusBlock = null;
let _zoomRadiusRafId = null;

function showZoomRadiusHandles(zb) {
  const overlay = _getOverlay();
  /* ★빗장은 _zoomResizeBlock 과 «같은 규율» — 「같은 블록」만 보고 건너뛰면 핸들이 남의
     정리에 쓸려나간 뒤로 영영 안 돌아온다(1813행 주석의 그 사고). DOM 존재도 같이 본다. */
  if (_zoomRadiusBlock === zb && overlay && overlay.querySelector('[data-zoom-radius-dir]')) return;
  hideZoomRadiusHandles();
  _zoomRadiusBlock = zb;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `zm-radius-handle ${dir}`;
    h.dataset.zoomRadiusDir = dir;
    h.title = '모서리 반경 조절';
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onZoomRadiusMouseDown(e, zb, dir));
  });
  _updateZoomRadiusPositions();
  _startZoomRadiusRaf();
}

function hideZoomRadiusHandles() {
  if (_zoomRadiusRafId) { cancelAnimationFrame(_zoomRadiusRafId); _zoomRadiusRafId = null; }
  _zoomRadiusBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-zoom-radius-dir]').forEach(h => h.remove());
}

function _updateZoomRadiusPositions() {
  const overlay = _getOverlay();
  if (!overlay || !_zoomRadiusBlock) return;
  const box = _zoomOutlineBox(_zoomRadiusBlock);
  const INSET = 10;   // 코너에서 «안쪽»으로 — 리사이즈 핸들(inset 0)과 자리가 안 겹친다
  const HALF  = 3.5;  // 7px 핸들 중앙 정렬
  /* ★원에는 모서리가 없다 — blockBoxSpec 이 radius 를 '50%' 로 못박고 shapeEl 의 circle
     갈래는 bdr 을 «아예 안 읽는다». ⇒ 핸들을 보이면 「끌어도 아무 일도 안 나는 손잡이」가 된다.
     ⛔숨기는 자리를 show...() 로 옮기면 안 된다: 프리셋을 원↔사각으로 «선택한 채» 바꿀 때
       (prop-zoom 은 showZoomProperties 만 다시 부르고 핸들은 안 다시 만든다) 상태가 굳는다.
       매 프레임 보는 여기서 토글해야 살아 있는 채로 따라온다. */
  const isCircle = (window.readZoomState?.(_zoomRadiusBlock) || {}).shape === 'circle';
  overlay.querySelectorAll('[data-zoom-radius-dir]').forEach(h => {
    h.style.display = isCircle ? 'none' : '';
    if (isCircle) return;
    const c = _cornerScreen(box, h.dataset.zoomRadiusDir, INSET);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

function _startZoomRadiusRaf() {
  function loop() {
    if (!_zoomRadiusBlock) return;
    if (!_zoomRadiusBlock.isConnected || !_zoomRadiusBlock.classList.contains('selected')) {
      hideZoomRadiusHandles();
      return;
    }
    _updateZoomRadiusPositions();
    _zoomRadiusRafId = requestAnimationFrame(loop);
  }
  _zoomRadiusRafId = requestAnimationFrame(loop);
}

function _onZoomRadiusMouseDown(e, zb, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  /* ★시작값은 «dataset» 에서 읽는다 — ⛔`zb.style.borderRadius` 를 읽으면 안 된다.
     그 자리엔 렌더가 써 둔 «도형 반경 + 테두리 두께»(blockBoxSpec.radius)가 들어 있어
     테두리를 켠 순간 시작값이 bdw 만큼 부풀어 손끝이 튄다. */
  const startR = Math.max(0, Number(window.readZoomState?.(zb)?.bdr) || 0);
  const startX = e.clientX, startY = e.clientY;
  let moved = false;

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale;
    const dy = (ev.clientY - startY) / scale;
    // 델타 산식은 _onAssetRadiusHandleMouseDown 그대로 — 「안쪽으로 끌면 커진다」
    const delta = dir === 'nw' ? (dx + dy) / 2
                : dir === 'ne' ? (-dx + dy) / 2
                : dir === 'sw' ? (dx - dy) / 2
                :                (-dx - dy) / 2;
    if (!moved && Math.abs(delta) < 1) return;
    if (!moved) { moved = true; window.pushHistory?.('확대블럭 모서리'); }
    const newR = Math.min(ZOOM_BDR_MAX, Math.max(0, Math.round(startR + delta)));
    /* ★★규약 — dataset 에 쓰고 «재렌더»한다.
       ⛔`zb.style.borderRadius = …` 로 쓰면 다음 renderZoomBlock 의 style.cssText 통짜
         덮어쓰기에 «조용히» 날아간다. 도형(SVG rect rx)도 안 따라온다. */
    zb.dataset.bdr = String(newR);
    window.renderZoomBlock?.(zb);
    /* 프로퍼티 패널 동기 — ★지금 이 줄들은 «아무것도 못 찾는다»: 모서리 슬라이더가
       prop-zoom.js 에서 가려져 있다(현빈 「아직」). 그래도 남긴다 — 그 줄의 주석을 옮겨
       되살리는 순간 이 동기가 «같이» 살아나야 하기 때문이다(그 파일이 쓰는 id 규약은
       `zm-bdr` · `zm-bdr-num` 이다. ⛔`-slider`/`-number` 가 아니다). */
    const s = document.getElementById('zm-bdr');
    const n = document.getElementById('zm-bdr-num');
    if (s) s.value = String(newR);
    if (n) n.value = String(newR);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태도 찍는다(시작은 onMove 의 첫 틱). 한쪽만 찍으면 이웃 규약에 따라
       ⌘Z 가 두 동작을 같이 먹거나(before→after) 한 번 먹통이 된다(after→before). */
    if (moved) { window.pushHistory?.('확대블럭 모서리'); window.showZoomProperties?.(zb); window.triggerAutoSave?.(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ═══════════════════════════════════════════════════════════════════════════
   확대블럭 — 회전 핫존 (.zm-rotate-handle)
   현빈 2026-09-09 「스티커의 모서리 핸들에 마우스를 가져다주면 그게 되잖아 회전 기능이
                     되게끔. 다른 셋 블록이나. 그런데 지금은 우측 패널에 회전 슬라이드로만
                     하니까 그것 좀 고쳐줘」

   ★인프라는 이미 있다 — js/asset-rotate.js 의 _makeRotateType 팩토리에 여덟 종이 산다.
     ⛔그런데 «그 팩토리를 쓰면 안 된다». 팩토리는 host.appendChild 로 핫존을 블록의 «자식»
       으로 붙이는데, renderZoomBlock 이 innerHTML 을 통째로 덮으므로 첫 재렌더에 죽는다
       (실측: 붙인 직후 1개 → 재렌더 뒤 0개). 확대블럭에는 「자식으로 붙인다」가 안 통한다.
     ⇒ ★프레임(.ss-rotate-handle)과 «같은 길»로 간다: 오버레이 트랙(#ss-handles-overlay)에
       두고 raf 로 좌표를 따라간다. 리사이즈·라운드 핸들이 이미 그렇게 살아 있다.

   ★크기조절과 «어떻게 가르나» = 모서리 «바깥» 링이다(프레임과 같은 수: ROT_OUT 16, 20×20).
     리사이즈 핸들은 코너에 ±3.5px, 회전은 코너 바깥 6~26px ⇒ 히트영역이 안 겹친다.
     ⛔수정키(Shift/⌘)로 가르지 않는다 — 현빈은 「마우스를 가져다주면」이라 했다(hover 로
       알아야 한다). 게다가 Shift 는 비율고정·45°스냅으로 이미 포화, ⌘ 는 자유이동이다.
     ★갈라지는 실체는 «커서»다: 회전은 _FRAME_ROTATE_CURSOR, 리사이즈는 nw/ne/sw/se-resize
       (css/editor-blocks.css 의 .zm-overlay-handle.* 규칙).
   ═══════════════════════════════════════════════════════════════════════════ */
let _zoomRotateBlock = null;
let _zoomRotateRafId = null;

function showZoomRotateHandles(zb) {
  const overlay = _getOverlay();
  if (_zoomRotateBlock === zb && overlay && overlay.querySelector('[data-zoom-rot-dir]')) return;
  hideZoomRotateHandles();
  _zoomRotateBlock = zb;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const z = document.createElement('div');
    z.className = `zm-rotate-handle ${dir}`;
    z.dataset.zoomRotDir = dir;
    z.title = '회전 (Shift=45° 스냅)';
    z.style.cssText = 'position:fixed;width:20px;height:20px;z-index:98;pointer-events:auto;'
      + 'border-radius:50%;cursor:' + _FRAME_ROTATE_CURSOR + ';';
    overlay.appendChild(z);
    z.addEventListener('mousedown', e => _onZoomRotateMouseDown(e, zb));
  });
  _updateZoomRotatePositions();
  _startZoomRotateRaf();
}

function hideZoomRotateHandles() {
  if (_zoomRotateRafId) { cancelAnimationFrame(_zoomRotateRafId); _zoomRotateRafId = null; }
  _zoomRotateBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-zoom-rot-dir]').forEach(h => h.remove());
}

function _updateZoomRotatePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_zoomRotateBlock) return;
  const box = _zoomOutlineBox(_zoomRotateBlock);
  const ROT_OUT  = 16;   // 코너에서 «바깥»으로(스크린px) — 프레임과 같은 수
  const ROT_HALF = 10;   // 20px 핫존 중앙 정렬
  /* ★원은 돌려도 같은 모양이다 — blockBoxSpec 이 circle 에서 rot 을 0 으로 못박는다.
     ⇒ 핫존을 보이면 「끌어도 아무 일도 안 나는 손잡이」가 된다. 라운드 핸들과 «같은 규율»로
       여기(매 프레임)에서 토글해 프리셋을 선택한 채 바꿔도 따라오게 한다. */
  const isCircle = (window.readZoomState?.(_zoomRotateBlock) || {}).shape === 'circle';
  overlay.querySelectorAll('[data-zoom-rot-dir]').forEach(h => {
    h.style.display = isCircle ? 'none' : '';
    if (isCircle) return;
    const c = _cornerScreen(box, h.dataset.zoomRotDir, -ROT_OUT);   // 음수 inset = 바깥
    h.style.top  = (c.y - ROT_HALF) + 'px';
    h.style.left = (c.x - ROT_HALF) + 'px';
  });
}

function _startZoomRotateRaf() {
  function loop() {
    if (!_zoomRotateBlock) return;
    if (!_zoomRotateBlock.isConnected || !_zoomRotateBlock.classList.contains('selected')) {
      hideZoomRotateHandles();
      return;
    }
    _updateZoomRotatePositions();
    _zoomRotateRafId = requestAnimationFrame(loop);
  }
  _zoomRotateRafId = requestAnimationFrame(loop);
}

/** 확대블럭 프로퍼티 패널의 회전 입력 동기.
 *  ⛔asset-rotate.js 의 _syncNumSlider('zm-rot', …) 를 쓰면 «조용히 아무 일도 안 한다» —
 *    그 헬퍼는 `zm-rot-slider`·`zm-rot-number` 를 찾는데, prop-zoom.js 의 _pairRow 가 만드는
 *    id 는 `zm-rot`·`zm-rot-num` 이다. 둘 다 null 이라 오류도 안 나고 값도 안 바뀐다.
 *  ⇒ 전용으로 둔다. prop-zoom.js 의 _pairRow 규약이 바뀌면 «여기»도 같이 바뀌어야 한다. */
function _syncZoomRotUI(deg) {
  const s = document.getElementById('zm-rot');
  const n = document.getElementById('zm-rot-num');
  if (s) s.value = String(deg);
  if (n) n.value = String(deg);
}

function _onZoomRotateMouseDown(e, zb) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const box = _zoomOutlineBox(zb);
  const br = box.getBoundingClientRect();
  /* ★중심은 «회전 불변»이라 회전각과 무관하게 rect 중심이 곧 회전 중심이다.
     ⚠️확대블럭의 DOM 상자는 축정렬 그대로다 — 회전은 CSS transform 이 아니라 SVG «안»에서
       일어난다(renderZoomBlock 주석). 그래서 이 rect 는 회전해도 안 돌아간다. */
  const cx = br.left + br.width  / 2;
  const cy = br.top  + br.height / 2;
  const init   = Number(window.readZoomState?.(zb)?.rot) || 0;
  const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
  let moved = false;

  function onMove(ev) {
    const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
    let deg = init + (a - startA);
    deg = window._snapRotate ? window._snapRotate(deg, ev.shiftKey) : Math.round(deg);
    deg = ((deg % 360) + 360) % 360;
    if (deg > 180) deg -= 360;   // -180..180 = 패널 슬라이더의 범위와 «같은 어휘»
    if (!moved && deg === init) return;
    if (!moved) { moved = true; window.pushHistory?.('확대블럭 회전'); }
    /* ★★규약 — dataset 에 쓰고 재렌더.
       ⛔asset-rotate.js 의 _applyRotationDeg 를 쓰면 안 된다: 그건 host.style.transform 에
         rotate() 를 거는데, 확대블럭이 그러면 «안에 든 SVG 까지» 돌아 그림자 방향이
         세계좌표를 벗어난다(renderZoomBlock 주석이 그 이유를 적어 뒀다).
       ★renderZoomBlock 이 st.rot → dataset.rotation 을 미러링하므로 _blockRotationDeg →
         _cornerScreen·_unrotateDelta 가 «자동으로» 따라온다 = 회전 뒤 리사이즈가 안 깨진다. */
    zb.dataset.rot = String(deg);
    window.renderZoomBlock?.(zb);
    _syncZoomRotUI(deg);
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    /* ★끝 상태도 찍는다(시작은 onMove 의 첫 틱). 한쪽만 찍으면 이웃 규약에 따라
       ⌘Z 가 두 동작을 같이 먹거나(before→after) 한 번 먹통이 된다(after→before). */
    if (moved) { window.pushHistory?.('확대블럭 회전'); window.showZoomProperties?.(zb); window.triggerAutoSave?.(); }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ═══════════════════════════════════════════════════════════════════════════
   오버레이(플로팅) 텍스트 — 모서리 리사이즈 핸들 (.tfo-overlay-handle)
   현빈 2026-09-20 「오버레이 버튼 활성화 시키면 오버레이된 텍스트 블럭에 모서리 핸들이 필요하다」
   ───────────────────────────────────────────────────────────────────────────
   ★증상의 자리는 CSS 가 아니라 «호출이 없다» 였다 — showHandlesFor 에 텍스트 갈래가 없었고
     (아래 마지막 갈래로 신설), block-drag.js 의 isText 클릭 핸들러도 showHandlesFor 를
     아예 안 불렀다(zoom 은 1551행, modal 은 1912행에 있다). 선택 «테두리»만 보인 이유는
     selection-overlay.js 가 .text-block → tf 로 올려 그리기 때문이다 = 테두리는 tf 에,
     손잡이는 «아무 데도» 없었다.
   ★형틀은 «같은 파일의» _onZoomResizeMouseDown 이다 — 절대배치 플로팅 · 보라 아웃라인 ·
     네 모서리 · 회전 인식 · 맞은편 코너 고정 · pushHistory 를 첫 변경 «전»에.
   ⛔showFrameHandles(프레임 핸들) 재사용은 세 자리가 막힌다:
     ① rAF 가드가 `_overlayFrame.classList.contains('selected')` 인데 오버레이 텍스트는
        tf 가 아니라 «안의 .text-block» 이 .selected 다 ⇒ 첫 프레임에 스스로 사라진다.
     ② _onHandleMouseDown 은 left/top 을 안 건드린다 ⇒ 절대배치에서 nw/ne/sw 를 끌면
        끄는 코너가 손끝을 안 따라온다(확대블럭이 ④ 주석으로 이미 고친 병).
     ③ .ss-radius-handle 이 같이 붙는데 tf 는 배경 투명 ⇒ 눌러도 아무 일 없는 손잡이가 생긴다.
   ★리사이즈의 «뜻» = 폭 + 폰트 비례확대. 높이는 «쓰지 않고 잰다».
     ⓐ css/editor-blocks.css `.frame-block{overflow:hidden}` + text-frame 은 min-height:unset —
       tf 에 height 를 쓰면 줄이는 순간 글자가 «조용히» 잘린다(늘리면 빈 상자만 커진다).
     ⓑ 이 파일의 그룹 리사이즈(_onHandleMouseDown 의 groupSnap)가 이미 text-frame 자식을
       «width 만 스케일 + contentEl.style.fontSize *= fsScale» 로 다룬다 — 「텍스트 프레임을
       리사이즈하면 무슨 일이 나는가」의 답이 이미 한 벌 있다. 두 벌로 갈지 않는다.
     ★단, 그룹 경로는 contentEl «하나»만 키워서 Mix 텍스트(부분 span[style*="font-size"])는
       부분만 안 커지는 미비가 있다 — 여기선 그 미비를 답습하지 않는다(스냅샷에 span 포함).
   ⛔클래스 이름은 `.tfo-overlay-handle` — `.asset-overlay-handle` 을 «빌리면»
     hideAssetResizeHandles() 의 일괄 remove 에 쓸려 나간다(아이콘원형·확대블럭이 두 번 밟은 함정).
     ★이름이 `-overlay-handle` 로 «끝나야» tests/unit/overlay-handle-cursor.test.mjs 의 전수
       그물에 자동 등록된다(커서 누락을 기계가 잡는다) — 작명에 이유가 있다.
   ★z-index 를 새로 만들지 않는다 — 손잡이는 #ss-handles-overlay(z 9990) «안»에 들어간다.
     그 층이 모달 아래로 내려가면(0920b zorder) 이 손잡이도 자동으로 따라간다.
   ═══════════════════════════════════════════════════════════════════════════ */
const TFO_MIN_W = 60;
let _tfoResizeEl = null;      // 핸들이 붙은 posEl(text-frame, 없으면 tb 자신)
let _tfoResizeRafId = null;

/** 오버레이 텍스트의 «선택된 아이»(= .text-block / .speech-bubble-block).
 *  ⛔tf 자신엔 .selected 가 «안» 붙는다 — rAF 가드를 tf 로 재면 첫 프레임에 사라진다. */
function _tfoSelectedChild(posEl) {
  return posEl.querySelector(':scope > .selected')
      || (posEl.classList.contains('selected') ? posEl : null);
}

function showTextOverlayResizeHandles(posEl) {
  const overlay = _getOverlay();
  /* 빗장은 «지워진 상태»를 알아채야 한다 — 확대블럭 주석(1980행 부근)과 같은 이유. */
  if (_tfoResizeEl === posEl && overlay && overlay.querySelector('[data-tf-resize-dir]')) return;
  hideTextOverlayResizeHandles();
  _tfoResizeEl = posEl;
  if (!overlay) return;
  CORNER_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `tfo-overlay-handle ${dir}`;
    h.dataset.tfResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onTextOverlayResizeMouseDown(e, posEl, dir));
  });
  _updateTextOverlayHandlePositions();
  _startTextOverlayResizeRaf();
}

function hideTextOverlayResizeHandles() {
  if (_tfoResizeRafId) { cancelAnimationFrame(_tfoResizeRafId); _tfoResizeRafId = null; }
  _tfoResizeEl = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-tf-resize-dir]').forEach(h => h.remove());
}

function _updateTextOverlayHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_tfoResizeEl) return;
  const HALF = 3.5;
  overlay.querySelectorAll('[data-tf-resize-dir]').forEach(h => {
    const c = _cornerScreen(_tfoResizeEl, h.dataset.tfResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
  });
}

/** 지금 이 오버레이 텍스트를 «글자 편집 중»인가.
 *  ⛔`.selected` 에 기대지 않는다 — 편집 진입 경로에 따라 선택 표식이 잠깐 빠질 수 있다.
 *  ★«매번 다시 재는 술어»다(asset-rotate.js:303 「편집중 핫존 숨김」과 같은 꼴) — 그래서
 *    편집이 끝나면 저절로 false 가 되고 손잡이가 «스스로» 돌아온다. */
function _tfoEditing(posEl) {
  return !!(posEl.querySelector(':scope > .editing')
         || posEl.classList.contains('editing')
         || posEl.querySelector('[contenteditable="true"]'));
}

function _startTextOverlayResizeRaf() {
  function loop() {
    const posEl = _tfoResizeEl;
    if (!posEl) return;
    /* ★편집 중엔 «숨기기만» 한다 — 글자 선택과 손잡이가 겹치니 안 보여야 하지만,
       여기서 hide…() 로 «파괴»하면 rAF 가 멈추고 _tfoResizeEl 이 null 이 되어
       편집을 끝내도 손잡이가 영영 안 돌아온다(블럭은 여전히 .selected 인데 모서리 점만
       없는 상태 — 2026-09-20 이벨류에이터 실측). 파괴는 «진짜로 사라진» 경우만. */
    const editing = _tfoEditing(posEl);
    const sel = _tfoSelectedChild(posEl);
    /* ★오버레이를 «끄면» dataset.overlayBlock 이 사라진다 ⇒ 여기서 자동으로 걷힌다. */
    if (!posEl.isConnected || posEl.dataset.overlayBlock !== 'true' || (!sel && !editing)) {
      hideTextOverlayResizeHandles();
      return;
    }
    const overlay = _getOverlay();
    if (overlay) {
      overlay.querySelectorAll('[data-tf-resize-dir]')
        .forEach(h => { h.style.display = editing ? 'none' : ''; });
    }
    if (!editing) _updateTextOverlayHandlePositions();
    _tfoResizeRafId = requestAnimationFrame(loop);
  }
  _tfoResizeRafId = requestAnimationFrame(loop);
}

/** 폰트 스냅샷 — «글자를 담은 칸 전부» + 인라인 font-size 를 가진 자손까지 담는다.
 *  ⛔`querySelector('[class^="tb-"]')`(단수) ⛔ — 말풍선 프레임에서는 «첫 번째» tb- 요소가
 *    본문 `.tb-bubble`(28px)이 아니라 이름표 `.tb-sender-name`(16px)이다. 그걸 집으면
 *    「상자와 이름표만 커지고 말풍선 글자는 그대로」가 된다(2026-09-20 이벨류에이터 실측).
 *    본문은 인라인 font-size 가 없어 `[style*="font-size"]` 그물에도 안 걸린다 ⇒ 복수로 전수.
 *  ★`.itb-text` 를 «같이» 세는 이유 — 아이콘+텍스트 블럭의 본문 칸은 접두사가 `itb-` 라
 *    `[class^="tb-"]` 그물에 «안» 걸린다(그 선택자는 «tb-» 로 시작하는 class 만 본다).
 *    빠지면 그 블럭만 「상자는 커지는데 글자는 그대로」가 되어 현빈 결정 A안
 *    (「글자도 같이 커지는 게 맞아」)을 어긴다 — 2026-09-20 통합 라운드에서 실측·추가.
 *  ⚠️아이콘 칸(.itb-icon)은 여기 «안» 들어간다 — 그건 font-size 가 아니라 width/height 라
 *    별도 스냅샷(_tfoIconSnapshot)이 «같은 k» 로 따로 태운다. 한 그물에 섞으면 아이콘에
 *    font-size 를 쓰게 되어 아무 일도 안 일어난다(2026-09-21 현빈 결정 「같이커져야지」).
 *  ⚠️SVG(말풍선 꼬리 `.tb-bubble-tail`)는 뺀다 — font-size 를 써도 뜻이 없다.
 *  ⚠️매 프레임 «누적 곱»을 하면 표류한다 ⇒ 마우스다운 때의 값에 매번 k 를 곱한다.
 *    (부모·자식이 둘 다 들어와도 각자 «절대 px» 로 쓰므로 배율이 겹쳐 곱해지지 않는다.) */
function _tfoFontSnapshot(posEl) {
  const els = new Set();
  posEl.querySelectorAll('[class^="tb-"]').forEach(el => {
    if (el.namespaceURI === 'http://www.w3.org/2000/svg') return;
    els.add(el);
  });
  /* ★아이콘+텍스트의 본문 칸은 «한 줄 더» 잡는다 — 위 그물에 «합치지» 않는다.
     `[class^="tb-"], .itb-text` 로 합치면 tests/unit/text-overlay-resize U11 이 지키는
     「tb- 칸을 전수로 담는다」 계약의 «모양»이 달라져 그 검사가 못 읽는다(실측 red).
     한 줄을 더 두면 두 계약이 각각 읽힌다. */
  posEl.querySelectorAll('.itb-text').forEach(el => els.add(el));
  posEl.querySelectorAll('[style*="font-size"]').forEach(el => els.add(el));
  return [...els]
    .map(el => ({ el, fs: parseFloat(getComputedStyle(el).fontSize) || 0 }))
    .filter(s => s.fs > 0);
}

/** 아이콘 칸 스냅샷 — 「아이콘+텍스트를 키우면 아이콘도 같이 커진다」(현빈 2026-09-21).
 *  ★왜 폰트 스냅샷과 «따로»인가 — .itb-icon 의 크기는 font-size 가 아니라 width/height 다
 *    (css/editor-extra.css:1706~ 에서 40×40 + aspect-ratio:1/1 + flex-shrink:0 으로 못박혀
 *     있다). 같은 그물에 담아 fontSize 를 쓰면 «조용히» 아무 일도 안 일어난다.
 *  ★두 벌을 잰다 — ⑴칸 자체(.itb-icon) ⑵칸 «안»의 placeholder SVG.
 *    안쪽 그림까지 안 태우면 80px 상자에 18px 좁쌀이 남는다(그림 넣은 칸은 `.itb-icon img`
 *    가 이미 width/height:100% 라 저절로 따라온다 — 그래서 img 는 여기서 안 센다).
 *  ⚠️매 프레임 «누적 곱»은 표류한다 ⇒ 폰트 쪽과 똑같이 «마우스다운 때의 절대 px» 에
 *    매번 k 를 곱한다.
 *  ⚠️getBoundingClientRect 는 캔버스 줌(transform: scale)이 곱해진 «화면 px» 라 여기 쓰면
 *    줌 40% 에서 아이콘이 첫 프레임에 16px 로 쪼그라든다 ⇒ 레이아웃 px 인 offsetWidth 로 잰다.
 *    SVG 요소는 offsetWidth 가 없으므로(HTMLElement 전용) 그쪽만 getBBox 대신 «속성/계산값»을
 *    쓴다 — placeholder 는 width/height 속성(18)을 갖고 있고, 없으면 계산값으로 떨어진다. */
function _tfoIconSnapshot(posEl) {
  const out = [];
  posEl.querySelectorAll('.itb-icon').forEach(el => {
    const w = el.offsetWidth, h = el.offsetHeight;
    if (w > 0 && h > 0) out.push({ el, w, h });
    el.querySelectorAll('svg').forEach(sv => {
      const sw = parseFloat(sv.getAttribute('width')) || parseFloat(getComputedStyle(sv).width) || 0;
      const sh = parseFloat(sv.getAttribute('height')) || parseFloat(getComputedStyle(sv).height) || 0;
      if (sw > 0 && sh > 0) out.push({ el: sv, w: sw, h: sh });
    });
  });
  return out;
}

function _onTextOverlayResizeMouseDown(e, posEl, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startW = Math.max(1, Math.round(posEl.offsetWidth));
  const startH = Math.max(1, Math.round(posEl.offsetHeight));
  const startX = e.clientX, startY = e.clientY;
  const sec = posEl.closest('.section-block');
  const snap = _tfoFontSnapshot(posEl);
  const iconSnap = _tfoIconSnapshot(posEl);
  /* ★t7-05 — 자유변형이 걸린 글상자면 네 점·재는 폭을 «시작 값»으로 떠 둔다(아래 onMove 가 같은 k 로 곱한다 · js/effects-freetransform.js ftScaleBase). */
  const _ftTb = posEl.matches?.('.text-block[data-tf-corners]') ? posEl : posEl.querySelector?.('.text-block[data-tf-corners]');
  const _ftBase = _ftTb ? window.ftScaleBase?.(_ftTb) : null;
  /* ★맞은편 코너 고정 — 확대블럭 _onZoomResizeMouseDown ④ 의 식을 그대로 옮겨 적는다.
     ⛔공통 헬퍼로 «추출» 금지 — tests/unit/zoom-block.test.js 가 그 함수 «안에서»
       `const dHW …` / `dataset.x = ` 를 정규식으로 꺼내 실행한다. 빼내면 그 검사가 약해진다.
     대신 tests/unit/text-overlay-resize.test.mjs 가 두 구현이 «같은 답»을 내는지 못박는다. */
  const sx = dir.includes('e') ? 1 : -1;
  const sy = dir.includes('s') ? 1 : -1;
  const th = _blockRotationDeg(posEl) * Math.PI / 180;
  const cosT = Math.cos(th), sinT = Math.sin(th);
  /* 위치 SSOT = dataset.offsetX/offsetY (prop-text-wireup-overlay _applyOverlayPos). */
  const startPosX = Number(posEl.dataset.offsetX ?? parseFloat(posEl.style.left)) || 0;
  const startPosY = Number(posEl.dataset.offsetY ?? parseFloat(posEl.style.top))  || 0;
  /* ★경계(bound) = «섹션 안에 남는 폭». 넘어서면 «막지 않고» 이동 쪽과 같은 탄성을 태운다.
     ───────────────────────────────────────────────────────────────────────────
     현빈 2026-09-20 결정 — 「오버레이 텍스트의 크기조절도 섹션 폭 밖까지 나갈 수 있어야 한다」
     (이동은 2026-09-16k~m 에 이미 탄성 클램프 + 마그네틱 캐치로 나갈 수 있다).
     ⇒ 옛 하드 상한 `Math.min(secW, room)` 을 지우고, 경계를 «넘은 만큼»에만
       prop-text-wireup-overlay.js 의 _elasticAxis «그 함수»를 태운다(사본 금지 — 사본을
       두면 이동과 크기조절의 손맛이 갈라진다). 곡선은 한 벌이다:
         0~10화면px  : 마그네틱 캐치(경계에 딱 붙어 안 움직임 — 「턱」)
         10~40화면px : 0.35배 저항(무겁게)
         40화면px 초과: 1:1 자유(턱을 뚫고 나간다)
     ★경계가 «어느 폭»인가 — 맞은편 코너가 고정이므로 끄는 방향으로 갈린다.
       e 쪽(se/ne): 왼쪽이 고정 ⇒ 경계폭 = 섹션폭 − left
       w 쪽(sw/nw): 오른쪽이 고정 ⇒ 경계폭 = left + 현재폭 (왼쪽 끝이 0 에 닿는 폭)
     ★`Math.max(…, startW)` 가 붙는 이유 — 이동으로 «이미» 섹션 밖에 나가 있는 블럭이면
       room < startW 라, 경계를 그대로 쓰면 마우스를 움직이기도 전에 폭이 경계로 «툭»
       줄어든다(맞은편 코너 고정이 첫 프레임에 깨져 보인다). 이미 넘어선 블럭에겐 턱이
       «뒤에» 있는 것이므로 지금 폭을 경계로 삼는다.
     ⚠️회전한 블럭에서는 근사다 — 회전 AABB 가 아니라 «회전 전 상자»로 잰다(이동 드래그의
       탄성 클램프도 같은 근사를 쓴다).
     ★하한(TFO_MIN_W)은 «그대로 하드»다 — 현빈: 「최소 폭·높이 하한은 그대로 둔다」. */
  const secW = sec ? sec.clientWidth : 860;
  const room = sx > 0 ? (secW - startPosX) : (startPosX + startW);
  const boundW = Math.max(TFO_MIN_W, room, startW);
  let moved = false;
  /* ★드래그는 «양쪽 끝»을 찍는다 — 시작 표본은 여기(첫 실제 이동), 끝 표본은 onUp 의
     pushHistory. 형제 유닛 T-073 이 만든 규약이고 부품은 js/drag-history.js 한 곳이다.
     (2026-09-20 통합 int/0920b: T-068 은 «시작 표본만» 찍는 옛 push-before 꼴이었다. 그
      꼴이면 이 드래그 «뒤»에 push-after 동작(우측 패널 대다수)이 오는 순간 둘 사이의 표본이
      없어 ⌘Z 한 번이 그 동작과 «크기까지» 같이 먹는다 — drag-history.js 머리말 ⑴ 그대로다.) */
  const _hist = window.beginDragHistory?.('오버레이 텍스트 크기');

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const d = _unrotateDelta(posEl, (ev.clientX - startX) / scale, (ev.clientY - startY) / scale);
    const dw = sx * d.dx, dh = sy * d.dy;
    if (!moved && Math.hypot(dw, dh) < 1) return;
    moved = true;
    /* ★«시작 상태»를 첫 DOM 변경 «앞»에 한 번 — 뒤에 두면 ⌘Z 가 크기가 아니라 «블록 삽입»을
       되돌린다(형제 유닛 0920b-resize-undo 가 잡은 바로 그 병).
       ⛔arm() 의 반환값으로 쓰기를 막지 마라(drag-history.js 규약 ⑵) — 줌 150% 의 1화면px
         드래그가 통째로 죽는다. 인자는 «캔버스 좌표» 델타다(규약 ⑴ — 위 d 는 이미 ÷scale). */
    _hist?.arm(d.dx, d.dy);
    /* 폭과 글자가 «같은 비율»로 간다 ⇒ 배율 k 하나를 두 축 델타에서 뽑아야 한다.
       ★k = 1 + (dw·W + dh·H)/(W² + H²)  — 마우스 델타를 «상자 대각선»에 투영한 값
         (비율 고정 리사이즈의 표준 최소제곱해).
       ⛔`max(1+dw/W, 1+dh/H)` 로 두 축 중 «큰 쪽»을 쓰면 얇고 넓은 상자에서 터진다 —
         실측: 600×30 텍스트에서 세로로 60px 만 내려도 k=3 이 되어 글자가 세 배로 뛴다
         (텍스트는 폭≫높이가 기본이라 «항상» 이 모양이다). 투영은 그 폭발이 없고,
         가로로만 끌 때는 1+dw/W 와 사실상 같은 값을 준다(W≫H 에서 오차 <0.1%). */
    const kRaw = 1 + (dw * startW + dh * startH) / (startW * startW + startH * startH);
    /* ★저항의 «손맛»은 화면px 기준이어야 한다 — zone 을 로컬 상수로 고정하면 줌 40% 에서
       화면 16px 로 쪼그라들어 사실상 없는 것과 같아진다(이동 쪽이 2026-09-16l 에 실제로
       밟은 병). 그 파일과 «같은 환산»을 쓴다: zone = 화면px / 그 순간 배율. */
    const zone = OVERLAY_RESIST_ZONE_SCREEN_PX / (scale || 1);
    const rawW = startW * kRaw;
    /* 경계를 넘은 만큼(over)에만 곡선을 태운다 — _elasticAxis 의 «위쪽 가지»를 그대로
       쓴다(boundMax=0 으로 부르면 입력이 곧 over 다). ⛔곡선을 손으로 다시 적지 않는다. */
    const over = rawW - boundW;
    const elasticW = over > 0 ? boundW + _elasticAxis(over, 0, zone) : rawW;
    const newW = Math.max(TFO_MIN_W, Math.round(elasticW));
    const k = newW / startW;   // ★«클램프된» 폭으로 다시 구한다 — 상자와 글자가 갈라지지 않게
    posEl.style.width = newW + 'px';
    posEl.dataset.width = String(newW);
    /* ★폭의 «주인»이 사용자가 된다 — 이 도장을 안 떼면 오버레이를 해제하는 순간
       _exitOverlay 가 style.width·dataset.width 를 지워 방금 정한 폭이 증발한다. */
    delete posEl.dataset.overlayIntroducedWidth;
    /* ★같은 이유로 _enterOverlay 가 심은 maxWidth:100%(=섹션 폭 캡)도 푼다 — 안 풀면
       style.width 만 커지고 «화면은 섹션에서 잘린다»(「손잡이는 가는데 상자는 안 커진다」).
       되돌리는 자리 = _exitOverlay 의 overlayFreeWidth 갈래. 도장을 따로 두는 이유는
       바로 위에서 overlayIntroducedWidth 를 «떼고» 가기 때문이다(폭은 남겨야 하니까). */
    posEl.style.maxWidth = 'none';
    posEl.dataset.overlayFreeWidth = 'true';
    snap.forEach(s => { s.el.style.fontSize = (s.fs * k).toFixed(1) + 'px'; });
    /* ★t7-05 — 글자와 «같은 k» 로 자유변형(네 점·상자·보라 테두리·격자)을 다시 맞춘다. 높이를 «재기 전»에 둔다(상자가 글자를 감싼 뒤 잰다). */
    if (_ftBase) window.ftScaleTo?.(_ftTb, _ftBase, k);
    /* ★아이콘 칸도 «같은 k» — 현빈 2026-09-21 결정. 글자와 한 줄 차이로 붙여 두는 이유는
       배율이 갈라지지 않게 하기 위해서다(회귀: 글자·아이콘 배율 오차 <1%).
       ⚠️하한 — k 가 아주 작아도 0px 이나 음수가 되면 칸이 사라진다(줄이기 드래그).
       ⚠️flex-shrink:0 이라 좁은 상자에서도 안 찌그러진다. width/height 를 «둘 다» 써야
         aspect-ratio 만 믿다 생기는 반올림 어긋남이 없다. */
    iconSnap.forEach(s => {
      s.el.style.width  = Math.max(1, s.w * k).toFixed(1) + 'px';
      s.el.style.height = Math.max(1, s.h * k).toFixed(1) + 'px';
    });
    /* 높이는 «글자가 정한다» — 쓰지 않고 «잰다». 맞은편 코너 고정도 그 실측 높이로. */
    const newH = Math.max(1, posEl.offsetHeight);
    const dHW = (newW - startW) / 2, dHH = (newH - startH) / 2;
    const nx = startPosX + (cosT * sx * dHW - sinT * sy * dHH) - dHW;
    const ny = startPosY + (sinT * sx * dHW + cosT * sy * dHH) - dHH;
    _applyOverlayPos(posEl, nx, ny);
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (moved) {
      /* ★«끝 상태» — 시작 표본(_hist.arm)과 짝이다. 둘 다 있어야 앞뒤 어느 이웃(push-before
         삽입 · push-after 패널)을 만나도 표본이 빈 칸 없이 이어진다(js/drag-history.js). */
      window.pushHistory?.('오버레이 텍스트 크기');
      /* ★패널이 «손잡이로 바뀐 폭»을 알게 한다.
         ⛔옛 조건 `tb !== posEl` ⛔ — 그건 「래퍼(text-frame)가 있는 타입」만 통과시킨다.
           .icon-text-block 은 래퍼가 없어 posElOf() 가 블럭 «자신»을 돌려주므로 tb === posEl 이
           되어 패널이 영영 안 새로 그려졌다. 실측(2026-09-20 통합 라운드): se 를 150px 끌어
           블럭이 600→733 이 돼도 너비칸은 600 그대로였고, 그 뒤 슬라이더를 «한 칸» 미는
           순간 패널이 쥔 600 이 적용돼 폭이 601 로 도로 줄었다(래퍼 있는 텍스트는 733/733).
         ⇒ 조건을 «텍스트 패널을 쓰는 블럭인가»로 바꾼다 — showHandlesFor 의 텍스트 갈래와
           «같은 집합»이다. 프레임이 들어오는 길은 이 matches 가 애초에 막는다(옛 조건이
           막으려던 것도 그거다 — 뜻은 그대로 두고 대상만 정확히 적는다). */
      const tb = _tfoSelectedChild(posEl);
      if (tb?.matches?.('.text-block, .speech-bubble-block, .icon-text-block')) {
        window.showTextProperties?.(tb);
      }
      window.triggerAutoSave?.();
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
window.showTextOverlayResizeHandles = showTextOverlayResizeHandles;
window.hideTextOverlayResizeHandles = hideTextOverlayResizeHandles;

/* ═══════════════════════════════════════════════════════════════════════════
   오버레이(떠 있는) 그리드 — 모서리 «폭» 손잡이 (.grd-overlay-handle) · G2-b (지디 2026-10-04)
   ───────────────────────────────────────────────────────────────────────────
   ★증상(G2-b 측정 2026-10-04, 실앱 줌 40/100): 떠 있는 그리드를 골라도 모서리 손잡이가 0개 —
     showHandlesFor 에 그리드 갈래가 «없었다». 칸 경계(.grd-gutter)·줄 손잡이만 떴다.
   ★뜻 = «폭만». 높이는 칸 내용이 정한다(텍스트 갈래 주석 ⓐ와 같은 이유) — 쓰지 않고 잰다.
   ⛔텍스트 손잡이(showTextOverlayResizeHandles)를 «그대로» 쓰지 않는다 — 그건 폭 + 글자 비례확대가 뜻이라
     (_tfoFontSnapshot · .tb-/.itb- 칸 가정) 그리드에 걸면 글자가 같이 커진다. 빌린 부품은 넷뿐이다:
     CORNER_DIRS · _cornerScreen · 고정층(#ss-handles-overlay) · 크기 규칙(css 의 공유 손잡이 규칙 = 7px·--ui-handle-border-w).
   ★쓰는 문은 grid-block.js applyGridOwnWidth «하나»다(떠 있으면 굳힌 폭 + 키). 여기서 style/dataset 을 직접 만지지 않는다.
   ★맞은편 모서리 고정 — w 쪽을 끌면 오른쪽 끝이, n 쪽을 끌면 아래 끝이 제자리다(확대블럭 ④·텍스트와 같은 식, 회전 0).
   ★히트 영역은 «화면»에 고정 — 고정층은 #canvas-scaler 밖이라 7px 가 줌과 무관하게 7 화면px 다.
   ⛔클래스 이름은 `-overlay-handle` 로 끝난다 — tests/unit/overlay-handle-cursor.test.mjs 전수 그물에 자동으로 걸린다.
   ⛔`.asset-overlay-handle` 을 빌리지 않는다 — hideAssetResizeHandles() 의 일괄 remove 에 쓸려 나간다(세 번 밟은 함정). */
let _grdResizeBlock = null;
let _grdResizeRafId = null;

/** 그리드가 «편집 중»(칸 글자 인라인 편집)인가 — 그때는 숨기기만 한다(텍스트 갈래와 같은 술어 꼴). */
function _grdEditing(block) {
  return !!(block.classList.contains('editing') || block.querySelector('[contenteditable="true"]'));
}

const GRID_HANDLE_DIRS = [...CORNER_DIRS, 'n', 's', 'e', 'w'];
/* 변 가운데 = 두 모서리의 가운데(보이는 상자 — 그리드는 회전 길이 없어 평균이 곧 가운데) */
function _grdHandlePoint(box, dir) {
  if (dir.length === 2) return _cornerScreen(box, dir);
  const pair = { n: ['nw', 'ne'], s: ['sw', 'se'], e: ['ne', 'se'], w: ['nw', 'sw'] }[dir];
  const a = _cornerScreen(box, pair[0]), b = _cornerScreen(box, pair[1]);
  return { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 };
}

function showGridOverlayResizeHandles(block) {
  const overlay = _getOverlay();
  /* 빗장은 «지워진 상태»도 본다 — 확대블럭 주석(같은 파일)과 같은 이유. */
  if (_grdResizeBlock === block && overlay && overlay.querySelector('[data-grd-resize-dir]')) return;
  hideGridOverlayResizeHandles();
  _grdResizeBlock = block;
  if (!overlay) return;
  /* ★제4안(2026-10-05 현빈 확정 · lane-grid-height) — 손잡이 여덟: 모서리 넷 = 폭+높이(두 방향) · 변 가운데 넷 = 한 방향(e/w 폭 · n/s 높이).
     «높이» = 칸 위아래 여백(cellPadY · grid-block.js) — 글자·그림은 안 건드린다. */
  GRID_HANDLE_DIRS.forEach(dir => {
    const h = document.createElement('div');
    h.className = `grd-overlay-handle ${dir}`;
    h.dataset.grdResizeDir = dir;
    overlay.appendChild(h);
    h.addEventListener('mousedown', e => _onGridOverlayResizeMouseDown(e, block, dir));
  });
  _updateGridOverlayHandlePositions();
  _startGridOverlayResizeRaf();
}

function hideGridOverlayResizeHandles() {
  if (_grdResizeRafId) { cancelAnimationFrame(_grdResizeRafId); _grdResizeRafId = null; }
  _grdResizeBlock = null;
  const overlay = _getOverlay();
  if (overlay) overlay.querySelectorAll('[data-grd-resize-dir]').forEach(h => h.remove());
}

function _updateGridOverlayHandlePositions() {
  const overlay = _getOverlay();
  if (!overlay || !_grdResizeBlock) return;
  const HALF = 3.5;
  overlay.querySelectorAll('[data-grd-resize-dir]').forEach(h => {
    /* ★K3 ⒜ — 손잡이도 «보이는 상자»(grid-block.js gridVisualBox — 배경 켬 = .grd-bg) 모서리에. 선택 선(K2)과 같은 한 자리. */
    const box = typeof window.gridVisualBox === 'function' ? window.gridVisualBox(_grdResizeBlock) : _grdResizeBlock;
    const c = _grdHandlePoint(box, h.dataset.grdResizeDir);
    h.style.top  = (c.y - HALF) + 'px';
    h.style.left = (c.x - HALF) + 'px';
    /* ★P4 ⒜(2026-10-05 태양 · lane-f-grid) — 같은 그리드의 ＋(G15 · #grd-plus-layer)와 겹치는 손잡이는 «숨긴다».
       ＋ 가 먼저 있던 기능이라 자리를 양보한다(그리드가 ＋ 보다 낮으면 오른쪽 ne/se 가 열 ＋ 위에 얹혔다 — P4 실측).
       ⛔pointer-events:none 이 아니라 숨김 — 보이는데 안 잡히는 손잡이는 거짓이다. 매 rAF 위 루프가 display 를 먼저 되돌리므로 겹침이 풀리면 다시 선다. */
    const hb = { l: c.x - HALF, t: c.y - HALF, r: c.x + HALF, b: c.y + HALF };
    const overPlus = [...document.querySelectorAll(`#grd-plus-layer > .grd-add-btn[data-grd-for="${_grdResizeBlock.id}"]`)].some(p => {
      const q = p.getBoundingClientRect(); return q.width > 0 && hb.r > q.left && hb.l < q.right && hb.b > q.top && hb.t < q.bottom; });
    if (overPlus) h.style.display = 'none';
    syncHandleSelVariant(h, _grdResizeBlock);   // 떠 있으면 보라 — 테두리와 «한 색»
  });
}

function _startGridOverlayResizeRaf() {
  function loop() {
    const block = _grdResizeBlock;
    if (!block) return;
    /* ★오버레이를 «끄면» dataset.overlayBlock 이 사라진다 ⇒ 여기서 스스로 걷힌다(텍스트 갈래와 같은 규약). */
    /* ★K3 ⒜ — 흐름 그리드에도 서므로 «떠 있음» 조건은 뺐다(골라져 있고 붙어 있을 때만). */
    if (!block.isConnected || !block.classList.contains('selected')) {
      hideGridOverlayResizeHandles();
      return;
    }
    const editing = _grdEditing(block);
    const overlay = _getOverlay();
    if (overlay) overlay.querySelectorAll('[data-grd-resize-dir]').forEach(h => { h.style.display = editing ? 'none' : ''; });
    if (!editing) _updateGridOverlayHandlePositions();
    _grdResizeRafId = requestAnimationFrame(loop);
  }
  _grdResizeRafId = requestAnimationFrame(loop);
}

function _onGridOverlayResizeMouseDown(e, block, dir) {
  if (e.button !== 0) return;
  e.stopPropagation();
  e.preventDefault();
  const startW = Math.max(1, Math.round(block.offsetWidth));
  const startH = Math.max(1, Math.round(block.offsetHeight));
  const startX = e.clientX, startY = e.clientY;
  /* ★제4안 — 축마다 따로: e/w 가 든 손잡이만 폭(sx ≠ 0) · n/s 가 든 손잡이만 높이(sy ≠ 0 · 칸 위아래 여백 1:1 — 시안). */
  const sx = dir.includes('e') ? 1 : dir.includes('w') ? -1 : 0;
  const sy = dir.includes('s') ? 1 : dir.includes('n') ? -1 : 0;
  const startPad = typeof window.getGridCellPadY === 'function' ? window.getGridCellPadY(block) : 0;
  /* 위치 SSOT = dataset.offsetX/offsetY (overlay-float.js _applyOverlayPos). */
  const startPosX = Number(block.dataset.offsetX ?? parseFloat(block.style.left)) || 0;
  const startPosY = Number(block.dataset.offsetY ?? parseFloat(block.style.top))  || 0;
  let moved = false;
  /* ★드래그는 «양쪽 끝»을 찍는다 — js/drag-history.js 규약(시작 = 첫 실제 이동의 arm, 끝 = onUp pushHistory). */
  const _hist = window.beginDragHistory?.('그리드 크기');

  function onMove(ev) {
    const scale = _canvasScaleNow();
    const dx = (ev.clientX - startX) / scale, dy = (ev.clientY - startY) / scale;   // 캔버스 좌표
    const dw = sx * dx, dp = sy * dy;
    if (!moved && Math.abs(dw) < 1 && Math.abs(dp) < 1) return;
    moved = true;
    _hist?.arm(dx, dy);          // ⛔반환값으로 쓰기를 막지 않는다(drag-history.js 규약 ⑵)
    let newW = startW;
    if (sx !== 0) { newW = window.applyGridOwnWidth?.(block, startW + dw); if (newW == null) return; }
    if (sy !== 0) window.applyGridCellPadY?.(block, startPad + dp);   // 제4안 — 바닥 0 · 상한 70 은 쓰는 문이 죈다
    /* 높이는 «내용이 정한다» — 쓴 뒤 잰다. 맞은편 모서리 고정도 그 실측 높이로. */
    const newH = Math.max(1, block.offsetHeight);
    /* ★K3 ⒜ — 맞은편 모서리 고정은 «떠 있을 때만»(좌표가 있는 그리드). 흐름 그리드는 자리를 흐름이 정한다 — 폭만 쓴다. */
    if (block.dataset.overlayBlock === 'true') {
      const nx = sx >= 0 ? startPosX : startPosX - (newW - startW);
      const ny = sy >= 0 ? startPosY : startPosY - (newH - startH);
      _applyOverlayPos(block, nx, ny);
    }
    window.scheduleAutoSave?.();
  }
  function onUp() {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
    if (moved) {
      window.pushHistory?.('그리드 크기');   // ★끝 표본 — 시작(_hist.arm)과 짝
      if (block.classList.contains('selected')) window.showGridProperties?.(block);   // 패널 너비칸이 손잡이 값을 알게
      window.triggerAutoSave?.();
    }
  }
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}
window.showGridOverlayResizeHandles = showGridOverlayResizeHandles;
window.hideGridOverlayResizeHandles = hideGridOverlayResizeHandles;

/* ═══════════════════════════════════════════════════════════════════════════
   손잡이 «탈출층» — 블럭의 자식으로 남은 손잡이를 고정층으로 옮긴다 (2026-09-21)
   ───────────────────────────────────────────────────────────────────────────
   ★증상(현빈): 도형의 «아래쪽» 모서리 손잡이가 «보이는데 안 눌린다».
     실측(9515·줌 40/100 양쪽, 전수표): se 손잡이 7×7 중 위 2행만 잡히고(10/25) 아래는
     다음 블럭(.tb-h2)이 가져간다. 한가운데를 끌면 100×100 그대로, «2px 위»를 끌면 138×138.
   ★뿌리는 «손잡이의 z-index 가 낮아서»가 «아니다». 손잡이는 z-index:10 인데도 진다 —
     부모가 쌓임맥락을 만들어 그 10 이 부모 «안»에 갇히기 때문이다:
       .shape-block.selected { z-index:2 }  ·  .gradient-block(인라인 z-index:2)
     그래서 «부모의 2» 대 «이웃 블럭의 2»가 되고, 같은 값이면 DOM 뒤가 이긴다.
     손잡이는 상자 밖으로 3.5px 삐져나오는데 그 반쪽이 이웃 상자 «안»이라 거기서 진다.
   ★답 = 다른 모든 블럭 타입이 «이미» 쓰는 자리로 옮긴다(#ss-handles-overlay).
     에셋·아이콘서클·캔버스·벡터·목업·모달·확대·프레임·아이콘·오버레이텍스트는 전부 거기 있고,
     전수표에서 «덮어도» 0건이었다. 도형·그라데이션만 블럭의 자식으로 남아 있었다.
   ⛔새 z 층을 만들지 «않는다» — #ss-handles-overlay 는 #canvas-area 의 isolation «안»이라
     모달·플로팅 패널 «아래»다(2026-09-20 규약). 캔버스 안에서만 해결한다.
   ★선택 변경 «이벤트가 없다»(.selected 를 바꾸는 자리 116곳) ⇒ js/selection-overlay.js 와
     «같은 길»: MutationObserver 로 «집합이 바뀌었다»만 받고 자리는 rAF 가 좇는다.
     좌표는 _cornerScreen 을 쓴다 — 회전(도형 shapeRotation)까지 같은 함수가 안다.
   ★되돌리기 정책이 계열마다 다르다(수명이 다르기 때문):
     · 도형   = 손잡이가 bindBlock 에서 «한 번» 만들어지고 CSS 가 display 를 가른다
               ⇒ 선택이 풀리면 «집으로 돌려보낸다»(다음 선택 때 다시 탈출).
     · 그라데 = _selectGradient 가 «선택할 때마다» 새로 만들고 지운다(js/gradient-select.js)
               ⇒ 선택이 풀리면 «지운다». 돌려보내면 비선택 블럭에 손잡이가 남아 보인다.
═══════════════════════════════════════════════════════════════════════════ */
const HANDLE_ESCAPE_SPECS = [
  { block: '.shape-block',    handle: '.shape-handle',
    dirOf: h => h.dataset.dir || '', recreate: false },
  { block: '.gradient-block', handle: '.gradient-corner-handle',
    dirOf: h => ({ tl: 'nw', tr: 'ne', bl: 'sw', br: 'se' })[h.dataset.corner] || '', recreate: true },
];
const _escaped = new Map();   // handleEl → { owner, dir, recreate }
let _escRaf = null;
let _escMo = null;
const _ESC_HALF = 3.5;        // 손잡이 7px 의 절반 — 고정층은 줌 밖이라 화면 px 그대로다

/** 지금 «선택된» 블럭의 자식 손잡이를 고정층으로 옮기고, 풀린 것은 되돌린다(멱등). */
function _escapeScan() {
  const canvas = document.getElementById('canvas');
  const overlay = _getOverlay();
  if (!canvas || !overlay) return;
  for (const spec of HANDLE_ESCAPE_SPECS) {
    canvas.querySelectorAll(spec.block + '.selected').forEach(block => {
      block.querySelectorAll(':scope > ' + spec.handle).forEach(h => {
        if (_escaped.has(h)) return;
        _escaped.set(h, { owner: block, dir: spec.dirOf(h), recreate: spec.recreate });
        block.__handlesEscaped = true;   // ⚠️DOM 속성이 아니다 — 저장/복제에 안 실린다
        overlay.appendChild(h);
      });
    });
  }
  for (const [h, st] of [..._escaped]) {
    const alive = st.owner.isConnected && st.owner.classList.contains('selected');
    if (alive) continue;
    _escReturn(h, st);
  }
  /* recreate 계열 = 선택할 때마다 새로 만들어지는 손잡이(그라데이션). 선택이 아닌 블럭에
     남아 있으면 «비선택인데 손잡이가 보인다» ⇒ 원래 주인(_removeGradientCornerHandles)과
     같은 뜻으로 치운다. 탈출 중인 것은 건드리지 않는다. */
  for (const spec of HANDLE_ESCAPE_SPECS) {
    if (!spec.recreate) continue;
    canvas.querySelectorAll(spec.block + ':not(.selected)').forEach(block => {
      block.querySelectorAll(':scope > ' + spec.handle).forEach(h => { if (!_escaped.has(h)) h.remove(); });
    });
  }
  /* ★자리는 «여기서 한 번» 동기로 잡는다 — 형제들(_updateVectorResizeHandlePositions 등)과 같은 꼴.
     rAF 첫 프레임을 기다리면 손잡이가 한 틱 동안 (0,0) 에 찍히고, 무엇보다 rAF 가 멈춘 창
     (백그라운드 렌더러 스로틀링)에서는 «영영» 안 움직인다 — 검증 인스턴스에서 실제로 물렸다. */
  _escPositions();
}

function _escReturn(h, st) {
  _escaped.delete(h);
  h.style.removeProperty('left');
  h.style.removeProperty('top');
  /* ★«지우지» 않고 주인에게 돌려준다 — 주인이 DOM 에서 잠깐 떨어지는 순간(재렌더·재부모)에
     지워 버리면 주인이 돌아와도 손잡이가 «영영» 없다. 실제로 한 번 물렸다(도형은 살아 있는데
     손잡이 0개 — bindBlock 은 이미 돈 뒤라 다시 안 만든다). 주인이 정말 죽었으면 손잡이도
     주인과 «함께» 버려진다 — 따로 지울 이유가 없다.
     ⚠️recreate 계열(그라데이션)은 선택이 풀린 뒤 집에 남아 있으면 «보인다» ⇒ 아래
        _escapeScan 끝의 정리가 치운다(js/gradient-select.js _removeGradientCornerHandles 와 같은 뜻). */
  st.owner.appendChild(h);
  // 같은 주인의 손잡이가 하나도 안 남았을 때만 표식을 지운다
  let still = false;
  for (const s of _escaped.values()) if (s.owner === st.owner) { still = true; break; }
  if (!still) delete st.owner.__handlesEscaped;
}

function _escPositions() {
  for (const [h, st] of _escaped) {
    const c = _cornerScreen(st.owner, st.dir);
    h.style.left = (c.x - _ESC_HALF) + 'px';
    h.style.top  = (c.y - _ESC_HALF) + 'px';
    syncHandleSelVariant(h, st.owner);   // 오버레이면 보라 — 테두리와 «한 색»(2026-09-21)
  }
}

function _escFrame() {
  _escRaf = null;
  if (!_escaped.size) return;            // 집합이 비면 멈춘다(MO 가 다시 깨운다)
  for (const [h, st] of [..._escaped]) {
    if (!st.owner.isConnected || !st.owner.classList.contains('selected')) _escReturn(h, st);
  }
  _escPositions();
  if (_escaped.size) _escRaf = requestAnimationFrame(_escFrame);
}

function _escKick() {
  if (_escRaf == null && _escaped.size) _escRaf = requestAnimationFrame(_escFrame);
}

export function initHandleEscape() {
  if (_escMo) return true;
  const canvas = document.getElementById('canvas');
  if (!canvas || !_getOverlay()) return false;
  _escMo = new MutationObserver(() => { _escapeScan(); _escKick(); });
  _escMo.observe(canvas, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  _escapeScan(); _escKick();
  return true;
}

export function stopHandleEscape() {
  if (_escMo) { _escMo.disconnect(); _escMo = null; }
  if (_escRaf != null) { cancelAnimationFrame(_escRaf); _escRaf = null; }
  for (const [h, st] of [..._escaped]) _escReturn(h, st);
}

if (typeof document !== 'undefined') {
  if (!initHandleEscape()) document.addEventListener('DOMContentLoaded', initHandleEscape, { once: true });
  // 계측·QA 진입점(창 밖에서 CDP 로 «재는» 자리). 제품 코드는 이걸 안 쓴다.
  window.__handleEscape = {
    init: initHandleEscape, stop: stopHandleEscape,
    get size() { return _escaped.size; },
    owners: () => [..._escaped.values()].map(s => s.owner.id || s.owner.className),
  };
}


function showHandlesFor(block) {
  if (!block || !block.classList) return;
  if (block.classList.contains('zoom-block')) {
    showZoomRadiusHandles(block);
    showZoomRotateHandles(block);
    showZoomResizeHandles(block);
    return;
  }
  if (block.classList.contains('asset-block')) {
    showAssetRadiusHandles(block);
    showAssetResizeHandles(block);
  } else if (block.classList.contains('icon-circle-block')) {
    showIconCircleResizeHandle(block);
  } else if (block.classList.contains('canvas-block')) {
    showCanvasRadiusHandles(block);
    showCanvasResizeHandles(block);
  } else if (block.classList.contains('vector-block')) {
    showVectorResizeHandles(block);
  } else if (block.classList.contains('icon-block')) {
    showIconHandles(block);
  } else if (block.classList.contains('mockup-block')) {
    showMockupHandles(block);
  } else if (block.classList.contains('modal-block')) {
    showModalRadiusHandles(block);
    showModalResizeHandles(block);
  } else if (block.classList.contains('coupon-block')) {
    /* ★폭 하나다 — 모서리 라디우스 손잡이는 ★안 준다(쿠폰의 모서리는 ★배경 SVG 가
       그리므로 손잡이를 주면 CSS border-radius 와 ★두 벌이 된다. 패널 슬라이더로만). */
    showCouponResizeHandles(block);
  } else if (block.classList.contains('text-block')
          || block.classList.contains('speech-bubble-block')
          || block.classList.contains('icon-text-block')) {
    /* ★오버레이(플로팅)로 «켠» 텍스트에만 모서리 손잡이를 준다 — 흐름(오토레이아웃) 텍스트는
       폭·높이를 부모가 정하므로 손잡이의 뜻이 없다(비오버레이 회귀 0: 아래 hide 로 떨어진다).
       판정은 클래스가 아니라 posEl 의 dataset.overlayBlock 이다(prop-text.js 와 «같은 술어»).
       ⚠️★2026-09-20 통합 라운드 — 이 줄의 옛 주석은 「말풍선·아이콘텍스트도 «자동으로»
         함께 걸린다」고 적혀 있었지만 사실이 아니었다. .icon-text-block 은 .text-block 이
         «아니라» 어느 갈래에도 안 걸려 손잡이가 0개였다(QA 실측). 패널은 같은
         showTextProperties 를 쓰는데(block-drag.js isIconText) 손잡이만 빠져 있었다.
         ⇒ 「같은 패널을 쓰면 같은 손잡이」로 클래스를 명시한다. 술어는 그대로 dataset 이다. */
    const posEl = _posElOf(block);
    if (posEl.dataset.overlayBlock === 'true') showTextOverlayResizeHandles(posEl);
    else hideTextOverlayResizeHandles();
  } else if (block.classList.contains('grid-block')) {
    /* ★G2-b — 떠 있는 그리드에만 «폭» 손잡이였다(흐름 그리드는 패널 너비 줄로).
       ★K3 ⒜(2026-10-05 지디 · lane-f-grid) — 흐름 그리드에도 같은 «폭» 손잡이. 자리 = gridVisualBox(K2 선택 선과 같은 상자) · ⛔높이 안 씀. */
    showGridOverlayResizeHandles(block);
  }
}
window.showHandlesFor = showHandlesFor;

export {
  showFrameHandles,
  hideFrameHandles,
  showMockupHandles,
  hideMockupHandles,
  showIconHandles,
  hideIconHandles,
  showAssetRadiusHandles,
  hideAssetRadiusHandles,
  showAssetResizeHandles,
  hideAssetResizeHandles,
  showModalRadiusHandles,
  hideModalRadiusHandles,
  showModalResizeHandles,
  showCouponResizeHandles,
  hideCouponResizeHandles,
  hideModalResizeHandles,
  showIconCircleResizeHandle,
  hideIconCircleResizeHandle,
  showCanvasRadiusHandles,
  hideCanvasRadiusHandles,
  showCanvasResizeHandles,
  hideCanvasResizeHandles,
  showVectorResizeHandles,
  hideVectorResizeHandles,
  showGridGutters,
  hideGridGutters,
  grdGetRange,
  grdSetRange,
  grdClearRange,
  showCmpGutters,
  hideCmpGutters,
  showGridImageResizeHandle,
  hideGridImageResizeHandle,
  showGridLineGrip,
  hideGridLineGrip,
  showTextOverlayResizeHandles,
  hideTextOverlayResizeHandles,
  showGridOverlayResizeHandles,
  hideGridOverlayResizeHandles,

  showHandlesFor,
};
