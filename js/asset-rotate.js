// asset-rotate.js — asset-block 컨테이너 회전 핸들 (sticker-select.js 패턴 미러)
// .asset-block.selected 일 때 모서리 4개에 회전 핫존(.ab-rotate-zone) 부착.
// atan2 기반 자유 회전 → block.dataset.rotation 저장 + block.style.transform 적용.
//
// 주의:
//   - dataset.imgRotate 는 내부 <img> 자체 회전 (image-handling.js 편집 모드 전용).
//     이건 ab 컨테이너 전체 회전이라 별도 키(dataset.rotation) 사용.
//   - selected/deselect는 block-drag.js가 .selected 클래스로 관리 → MutationObserver로 감시.

// shape-rotate-zone은 «선택 중»에만 히트영역을 갖는다 — 저장 HTML에 잔존하더라도
// 선택 전에는 display:none 이라 미선택 shape의 코너 클릭을 가로채지 않는다.
(function _injectRotateZoneCSS() {
  if (typeof document === 'undefined' || document.getElementById('rotate-zone-style')) return;
  const st = document.createElement('style');
  st.id = 'rotate-zone-style';
  st.textContent =
    '.shape-rotate-zone{display:none;}' +
    '.shape-block.selected > .shape-rotate-zone{display:block;}';
  (document.head || document.documentElement).appendChild(st);
})();

// 피그마식 회전 커서 (sticker-select.js와 동일)
const _AB_ROTATE_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='white' stroke-width='4'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='white' stroke-width='4'/%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='%23222' stroke-width='2'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='%23222' stroke-width='2'/%3E%3C/svg%3E\") 12 12, grab";

function _removeAbRotateHandles(block) {
  if (!block) return;
  block.querySelectorAll(':scope > .ab-rotate-zone').forEach(h => h.remove());
}

function _addAbRotateHandles(block) {
  _removeAbRotateHandles(block);
  if (!block) return;
  // 이미지 편집 모드(.img-editing)일 땐 image-handling.js의 내부 회전이 우선 → 컨테이너 회전 핫존 숨김
  if (block.classList.contains('img-editing')) return;
  // 회전 핫존 — 각 코너 바깥 (sticker와 동일 크기 24px, --inv-zoom 보정)
  const ROT_SZ = 24;
  const neg = `calc(-${ROT_SZ}px * var(--inv-zoom, 1))`;
  const sz  = `calc(${ROT_SZ}px * var(--inv-zoom, 1))`;
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const z = document.createElement('div');
    z.className = 'ab-rotate-zone';
    z.dataset.corner = id;
    const pos = id === 'tl' ? `top:${neg};left:${neg};`
              : id === 'tr' ? `top:${neg};right:${neg};`
              : id === 'bl' ? `bottom:${neg};left:${neg};`
              :               `bottom:${neg};right:${neg};`;
    z.style.cssText = `position:absolute;${pos}width:${sz};height:${sz};z-index:99;pointer-events:auto;cursor:${_AB_ROTATE_CURSOR};`;
    block.appendChild(z);
    _bindAbRotateDrag(z, block);
  });
}

// 회전 드래그 — 블록 중앙 기준 자유 회전. transform만 직접 갱신 → 핸들 유지.
function _bindAbRotateDrag(zone, block) {
  zone.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const br = block.getBoundingClientRect();
    const cx = br.left + br.width / 2;
    const cy = br.top  + br.height / 2;
    const init   = parseFloat(block.dataset.rotation) || 0;
    const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const onMove = (ev) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
      let deg = init + (a - startA);
      // Shift = 15도 스냅
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15;
      else deg = Math.round(deg);
      deg = ((deg % 360) + 360) % 360;
      if (deg > 180) deg -= 360; // -180..180
      block.style.transform = `rotate(${deg}deg)`;
      block.style.transformOrigin = 'center center';
      block.dataset.rotation = String(deg);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('이미지 블록 회전');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ══════════════════════════════════════════════════════════════
// SHAPE BLOCK 회전 핸들 (일반화: asset 회전 핫존 패턴을 shape로 확장)
//   - shape는 frame-block > shape-block 구조. 회전 상태(dataset.shapeRotation +
//     transform:rotate)는 prop-shape.js가 소유 → 여기선 핸들 드래그만 담당하고
//     window.applyShapeRotation / syncShapeRotationUI 로 위임해 프로퍼티와 동기화.
//   - shape는 선택 시 부모 frame overflow가 해제되므로(css :has(.shape-block.selected))
//     asset과 동일하게 «자식» 핫존으로 처리 → 회전 시 핸들이 shape와 함께 돌아
//     별도 좌표 보정이 필요 없음.
//   - 핫존은 선택 중에만 존재(관찰자가 add/remove) → 저장 HTML 오염 없음.
// ══════════════════════════════════════════════════════════════
function _removeShapeRotateHandles(block) {
  if (!block) return;
  block.querySelectorAll(':scope > .shape-rotate-zone').forEach(h => h.remove());
}

function _addShapeRotateHandles(block) {
  _removeShapeRotateHandles(block);
  if (!block || !block.classList.contains('shape-block')) return;
  const ROT_SZ = 22;
  const OUT    = 4; // 코너 리사이즈 핸들 바깥쪽으로 살짝 벗어나게
  const neg = `calc(-${ROT_SZ + OUT}px * var(--inv-zoom, 1))`;
  const sz  = `calc(${ROT_SZ}px * var(--inv-zoom, 1))`;
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const z = document.createElement('div');
    z.className = `shape-rotate-zone ${id}`;
    z.dataset.corner = id;
    const pos = id === 'tl' ? `top:${neg};left:${neg};`
              : id === 'tr' ? `top:${neg};right:${neg};`
              : id === 'bl' ? `bottom:${neg};left:${neg};`
              :               `bottom:${neg};right:${neg};`;
    // z-index 9 = shape-handle(10) 아래 → 코너 리사이즈 핸들 히트영역 우선 보존
    z.style.cssText = `position:absolute;${pos}width:${sz};height:${sz};z-index:9;pointer-events:auto;cursor:${_AB_ROTATE_CURSOR};`;
    block.appendChild(z);
    _bindShapeRotateDrag(z, block);
  });
}

function _bindShapeRotateDrag(zone, block) {
  zone.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const br = block.getBoundingClientRect();
    const cx = br.left + br.width / 2;
    const cy = br.top  + br.height / 2;
    const init   = parseFloat(block.dataset.shapeRotation) || 0;
    const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const onMove = (ev) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
      let deg = init + (a - startA);
      if (ev.shiftKey) deg = Math.round(deg / 15) * 15; // Shift = 15도 스냅
      else deg = Math.round(deg);
      deg = ((deg % 360) + 360) % 360;
      if (deg > 180) deg -= 360; // -180..180 (prop-shape 슬라이더 범위와 일치)
      window.applyShapeRotation?.(block, deg);
      window.syncShapeRotationUI?.(deg);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('쉐이프 회전');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// 로드/리렌더 시 dataset.rotation 복원
function _applyAbRotation(block) {
  if (!block) return;
  const deg = parseFloat(block.dataset.rotation);
  if (Number.isFinite(deg) && deg !== 0) {
    block.style.transform = `rotate(${deg}deg)`;
    block.style.transformOrigin = 'center center';
  }
}

// ── 회전 대상 타입별 핸들 add/remove 라우팅 ──
// 자유배치/독립 블록만 대상. asset·shape 확정. ★표(.table-block)·그래프(.graph-block)는
// 회전이 내부 셀/바 히트영역·레이아웃 좌표를 깨므로 «제외»(핫존 미부착) — 아래 registry에
// 항목 자체를 두지 않는다(상신 근거: 보고 참조).
const _ROTATE_HANDLERS = {
  'asset-block': { add: _addAbRotateHandles,    remove: _removeAbRotateHandles },
  'shape-block': { add: _addShapeRotateHandles, remove: _removeShapeRotateHandles },
};
function _rotateHandlerFor(el) {
  if (!(el instanceof HTMLElement)) return null;
  for (const cls in _ROTATE_HANDLERS) {
    if (el.classList.contains(cls)) return _ROTATE_HANDLERS[cls];
  }
  return null;
}
const _ROTATE_SEL = Object.keys(_ROTATE_HANDLERS).map(c => '.' + c).join(',');

// ── selected 클래스 변경 감시 → 핸들 추가/제거 ──
// block-drag.js가 .asset-block/.shape-block.selected 클래스를 토글하면 여기서 반응
const _abRotateObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== 'attributes' || m.attributeName !== 'class') continue;
    const target = m.target;
    const h = _rotateHandlerFor(target);
    if (!h) continue;
    if (target.classList.contains('selected')) h.add(target);
    else h.remove(target);
  }
});

function _observeRotatable(block) {
  if (!block || block._abRotateObserved) return;
  const h = _rotateHandlerFor(block);
  if (!h) return;
  block._abRotateObserved = true;
  _abRotateObserver.observe(block, { attributes: true, attributeFilter: ['class'] });
  // 이미 selected 상태로 로드됐으면 즉시 핸들 추가
  if (block.classList.contains('selected')) h.add(block);
  // 저장된 rotation 복원 (asset 전용 — shape/frame은 save-load가 복원)
  if (block.classList.contains('asset-block')) _applyAbRotation(block);
}

// 기존 + 신규 회전대상 블록 모두 observe
function _scanRotatables(root = document) {
  root.querySelectorAll?.(_ROTATE_SEL).forEach(_observeRotatable);
}

// 초기 스캔
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => _scanRotatables());
} else {
  _scanRotatables();
}

// DOM에 새 회전대상 블록이 추가될 때마다 hook
const _abInsertObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (_rotateHandlerFor(node)) _observeRotatable(node);
      _scanRotatables(node);
    });
  }
});
_abInsertObserver.observe(document.body, { childList: true, subtree: true });

window._addAbRotateHandles       = _addAbRotateHandles;
window._removeAbRotateHandles    = _removeAbRotateHandles;
window._applyAbRotation          = _applyAbRotation;
window._addShapeRotateHandles    = _addShapeRotateHandles;
window._removeShapeRotateHandles = _removeShapeRotateHandles;
