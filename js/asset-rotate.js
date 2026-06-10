// asset-rotate.js — asset-block 컨테이너 회전 핸들 (sticker-select.js 패턴 미러)
// .asset-block.selected 일 때 모서리 4개에 회전 핫존(.ab-rotate-zone) 부착.
// atan2 기반 자유 회전 → block.dataset.rotation 저장 + block.style.transform 적용.
//
// 주의:
//   - dataset.imgRotate 는 내부 <img> 자체 회전 (image-handling.js 편집 모드 전용).
//     이건 ab 컨테이너 전체 회전이라 별도 키(dataset.rotation) 사용.
//   - selected/deselect는 block-drag.js가 .selected 클래스로 관리 → MutationObserver로 감시.

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

// 로드/리렌더 시 dataset.rotation 복원
function _applyAbRotation(block) {
  if (!block) return;
  const deg = parseFloat(block.dataset.rotation);
  if (Number.isFinite(deg) && deg !== 0) {
    block.style.transform = `rotate(${deg}deg)`;
    block.style.transformOrigin = 'center center';
  }
}

// ── selected 클래스 변경 감시 → 핸들 추가/제거 ──
// block-drag.js가 .asset-block.selected 클래스를 토글하면 여기서 반응
const _abRotateObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    if (m.type !== 'attributes') continue;
    const target = m.target;
    if (!(target instanceof HTMLElement)) continue;
    if (!target.classList.contains('asset-block')) continue;
    if (m.attributeName === 'class') {
      if (target.classList.contains('selected')) _addAbRotateHandles(target);
      else _removeAbRotateHandles(target);
    }
  }
});

function _observeAssetBlock(block) {
  if (!block || block._abRotateObserved) return;
  block._abRotateObserved = true;
  _abRotateObserver.observe(block, { attributes: true, attributeFilter: ['class'] });
  // 이미 selected 상태로 로드됐으면 즉시 핸들 추가
  if (block.classList.contains('selected')) _addAbRotateHandles(block);
  // 저장된 rotation 복원
  _applyAbRotation(block);
}

// 기존 + 신규 asset-block 모두 observe
function _scanAssetBlocks(root = document) {
  root.querySelectorAll?.('.asset-block').forEach(_observeAssetBlock);
}

// 초기 스캔
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', () => _scanAssetBlocks());
} else {
  _scanAssetBlocks();
}

// DOM에 새 asset-block이 추가될 때마다 hook
const _abInsertObserver = new MutationObserver((mutations) => {
  for (const m of mutations) {
    m.addedNodes.forEach(node => {
      if (!(node instanceof HTMLElement)) return;
      if (node.classList?.contains('asset-block')) _observeAssetBlock(node);
      _scanAssetBlocks(node);
    });
  }
});
_abInsertObserver.observe(document.body, { childList: true, subtree: true });

window._addAbRotateHandles    = _addAbRotateHandles;
window._removeAbRotateHandles = _removeAbRotateHandles;
window._applyAbRotation       = _applyAbRotation;
