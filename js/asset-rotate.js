// asset-rotate.js — asset-block 컨테이너 회전 핸들 (sticker-select.js 패턴 미러)
// .asset-block.selected 일 때 모서리 4개에 회전 핫존(.ab-rotate-zone) 부착.
// atan2 기반 자유 회전 → block.dataset.rotation 저장 + block.style.transform 적용.
//
// 주의:
//   - dataset.imgRotate 는 내부 <img> 자체 회전 (image-handling.js 편집 모드 전용).
//     이건 ab 컨테이너 전체 회전이라 별도 키(dataset.rotation) 사용.
//   - selected/deselect는 block-drag.js가 .selected 클래스로 관리 → MutationObserver로 감시.

// ── 회전 스냅(공유) ──────────────────────────────────────────────
// Shift 드래그 시 ROTATE_SNAP_STEP° 단위로 «턱턱» 스냅(기본 45°: 0/45/90/135/180/225/270/315),
// Shift 아니면 1° 반올림. 전 회전대상(asset/shape/frame/#14b 텍스트·컴포넌트/스티커)이 이 하나를 공유.
// ★15°로 되돌리려면 아래 상수만 45→15 (지디: 15°는 옵션 여지·기본 45°). 런타임(mousedown) 참조라 로드순서 무관.
window._ROTATE_SNAP_STEP = 45;
window._snapRotate = function (deg, shift) {
  const step = window._ROTATE_SNAP_STEP || 45;
  return shift ? Math.round(deg / step) * step : Math.round(deg);
};

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
      deg = window._snapRotate(deg, ev.shiftKey); // Shift = 45° 스냅(공유)
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
      deg = window._snapRotate(deg, ev.shiftKey); // Shift = 45° 스냅(공유)
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

// ══════════════════════════════════════════════════════════════
// #14b 회전 확장 — 텍스트·컴포넌트 범용 회전 인프라
//   asset(child-hotzone) 패턴을 «범용 헬퍼»로 일반화한다. 신규 대상은 전부
//   dataset.rotation 규약으로 통일(벡터만 예외 — 아래 참조). 기존 asset/shape/frame
//   3규약과 그 핸들러(_addAbRotateHandles·_addShapeRotateHandles·overlay-handles)는
//   문자 그대로 무접촉 — 여기 추가되는 코드는 신규 타입 전용 별도 경로다.
//
//   핫존 트랙 선택 근거: 신규 대상 블록(.text-block/.icon-block/.mockup-block/
//   .canvas-block/.vector-block/.icon-circle-block)은 모두 block 레벨에서
//   overflow:visible + position:relative 이고, 회전 transform 을 «블록 자신»이 받는다.
//   따라서 asset 과 동일한 «자식 핫존 트랙»(블록 자식으로 부착 → 회전 함께 돎)이
//   적용된다. overflow:hidden 오버레이 트랙(frame 전용)은 신규 타입엔 불필요.
//   (내부 .cvb-inner/.vb-inner/.mkp-screen/.icb-circle 만 overflow:hidden 이고
//    블록 자체는 자르지 않음 — CSS 확인 완료.)
// ══════════════════════════════════════════════════════════════

// 범용 각도 적용(transform-preserving, dataset.rotation) — applyShapeRotation 미러.
// 회전0이면 rotate()만 제거하고 다른 transform(translate 등)은 보존.
function _applyRotationDeg(host, deg) {
  if (!host) return;
  const d = Math.max(-180, Math.min(180, Math.round(parseFloat(deg) || 0)));
  const existing = host.style.transform || '';
  const stripped = existing.replace(/rotate\([^)]*\)\s*/g, '').trim();
  if (d === 0) {
    host.style.transform = stripped;
    if (!host.style.transform) {
      host.style.removeProperty('transform');
      host.style.removeProperty('transform-origin');
    }
    delete host.dataset.rotation;
  } else {
    host.dataset.rotation = String(d);
    host.style.transform = stripped ? `${stripped} rotate(${d}deg)` : `rotate(${d}deg)`;
    host.style.transformOrigin = 'center center';
  }
  window.scheduleAutoSave?.();
}
window.applyRotationDeg = _applyRotationDeg;

// 프로퍼티 패널 슬라이더/숫자 필드 동기(있을 때만) — id 접두사 규약(<prefix>-slider/-number)
function _syncNumSlider(prefix, deg) {
  const s = document.getElementById(`${prefix}-slider`);
  const n = document.getElementById(`${prefix}-number`);
  if (s) s.value = String(deg);
  if (n) n.value = String(deg);
}

// 범용 핫존 add/remove 팩토리. cfg:
//   zoneClass, hostFor(block)=host, guard(block)=편집중 등 스킵, readDeg(block,host),
//   applyDeg(block,host,deg), syncUI(block,host,deg), historyLabel, sz, out
function _makeRotateType(cfg) {
  const hostFor = cfg.hostFor || (b => b);
  const ROT_SZ = cfg.sz || 22;
  const OUT    = cfg.out ?? 4;
  function remove(block) {
    if (!block) return;
    const host = hostFor(block);
    if (host) host.querySelectorAll(`:scope > .${cfg.zoneClass}`).forEach(z => z.remove());
  }
  function add(block) {
    remove(block);
    if (!block) return;
    if (cfg.guard && cfg.guard(block)) return;   // 예) 텍스트 편집 중 → 핫존 숨김
    const host = hostFor(block);
    if (!host) return;
    const neg = `calc(-${ROT_SZ + OUT}px * var(--inv-zoom, 1))`;
    const sz  = `calc(${ROT_SZ}px * var(--inv-zoom, 1))`;
    ['tl', 'tr', 'bl', 'br'].forEach(id => {
      const z = document.createElement('div');
      z.className = `${cfg.zoneClass} ${id}`;
      z.dataset.corner = id;
      const pos = id === 'tl' ? `top:${neg};left:${neg};`
                : id === 'tr' ? `top:${neg};right:${neg};`
                : id === 'bl' ? `bottom:${neg};left:${neg};`
                :               `bottom:${neg};right:${neg};`;
      z.style.cssText = `position:absolute;${pos}width:${sz};height:${sz};z-index:97;pointer-events:auto;cursor:${_AB_ROTATE_CURSOR};`;
      host.appendChild(z);
      _bindGenericRotateDrag(z, block, cfg, hostFor);
    });
  }
  return { add, remove, restore: cfg.restore };
}

function _bindGenericRotateDrag(zone, block, cfg, hostFor) {
  zone.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const host = hostFor(block);
    if (!host) return;
    const br = host.getBoundingClientRect();
    const cx = br.left + br.width / 2;
    const cy = br.top  + br.height / 2;
    const init   = cfg.readDeg ? (parseFloat(cfg.readDeg(block, host)) || 0)
                               : (parseFloat(host.dataset.rotation) || 0);
    const startA = Math.atan2(e.clientY - cy, e.clientX - cx) * 180 / Math.PI;
    const onMove = (ev) => {
      const a = Math.atan2(ev.clientY - cy, ev.clientX - cx) * 180 / Math.PI;
      let deg = init + (a - startA);
      deg = window._snapRotate(deg, ev.shiftKey); // Shift = 45° 스냅(공유)
      deg = ((deg % 360) + 360) % 360;
      if (deg > 180) deg -= 360; // -180..180
      cfg.applyDeg(block, host, deg);
      cfg.syncUI?.(block, host, deg);
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.(cfg.historyLabel || '회전');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// 로드 복원(belt-and-suspenders) — 직렬화는 outerHTML로 inline transform을 보존하므로
// 대개 불필요하나, 재렌더 경로 대비 dataset.rotation → transform 을 idempotent 적용.
function _restoreDatasetRotation(block) {
  if (!block) return;
  const d = parseFloat(block.dataset.rotation);
  if (Number.isFinite(d) && d !== 0 && !/rotate\(/.test(block.style.transform || '')) {
    const existing = (block.style.transform || '').trim();
    block.style.transform = existing ? `${existing} rotate(${d}deg)` : `rotate(${d}deg)`;
    block.style.transformOrigin = 'center center';
  }
}

// ── 텍스트: 회전 host = text-frame(자유배치) 또는 text-block(플로우). 편집중 핫존 숨김.
//    dataset.rotation 규약. prop 슬라이더(txt-rot-slider/number)와 동기.
//    회전(transform)과 정렬(#10 align-self / #13 정렬)은 독립축 — transform-origin
//    center center 로 «블록 자체 중심» 회전이라 align-self 배치와 충돌하지 않는다.
const _textFrameHost = b => b.closest('.frame-block[data-text-frame="true"]') || b;
const _TEXT_ROT = _makeRotateType({
  zoneClass: 'tb-rotate-zone',
  hostFor: _textFrameHost,
  guard: b => b.classList.contains('editing'),  // contenteditable 편집 중 → 캐럿 우선
  applyDeg: (b, host, deg) => _applyRotationDeg(host, deg),
  syncUI: (b, host, deg) => _syncNumSlider('txt-rot', deg),
  historyLabel: '텍스트 회전',
  restore: b => _restoreDatasetRotation(_textFrameHost(b)),
});

// ── iconify(.icon-block): dataset.rotation. 기존 90° 프리셋 버튼(#icn-rotation-group)과
//    새 숫자필드(#icn-rot-number, 프리셋 있으면 추가)를 함께 동기.
const _ICONIFY_ROT = _makeRotateType({
  zoneClass: 'icn-rotate-zone',
  applyDeg: (b, host, deg) => _applyRotationDeg(host, deg),
  syncUI: (b, host, deg) => {
    const n = document.getElementById('icn-rot-number');
    if (n) n.value = String(deg);
    const norm = ((deg % 360) + 360) % 360;
    document.querySelectorAll('#icn-rotation-group .prop-align-btn').forEach(x =>
      x.classList.toggle('active', parseInt(x.dataset.deg) === norm));
  },
  historyLabel: '아이콘 회전',
  restore: _restoreDatasetRotation,
});

const _MOCKUP_ROT = _makeRotateType({
  zoneClass: 'mkp-rotate-zone',
  applyDeg: (b, host, deg) => _applyRotationDeg(host, deg),
  syncUI: (b, host, deg) => _syncNumSlider('mkp-rot', deg),
  historyLabel: '목업 회전',
  restore: _restoreDatasetRotation,
});
const _CANVAS_ROT = _makeRotateType({
  zoneClass: 'cvb-rotate-zone',
  applyDeg: (b, host, deg) => _applyRotationDeg(host, deg),
  syncUI: (b, host, deg) => _syncNumSlider('cvb-rot', deg),
  historyLabel: '캔버스 회전',
  restore: _restoreDatasetRotation,
});
const _ICB_ROT = _makeRotateType({
  zoneClass: 'icb-rotate-zone',
  applyDeg: (b, host, deg) => _applyRotationDeg(host, deg),
  syncUI: (b, host, deg) => _syncNumSlider('icb-rot', deg),
  historyLabel: '아이콘써클 회전',
  restore: _restoreDatasetRotation,
});

// ── vector(.vector-block): ★기존 dataset.rotateDeg + flip scale 규약 «유지»(dataset.rotation
//    으로 바꾸면 저장된 벡터의 각도가 유실 → 회귀). prop-vector 의 transform 합성
//    (rotate scale)과 동일 경로로 적용. _cornerScreen 의 _blockRotationDeg 는 rotateDeg 를
//    이미 인식하므로 회전후 리사이즈 좌표보정도 자동 커버.
const _VECTOR_ROT = _makeRotateType({
  zoneClass: 'vb-rotate-zone',
  readDeg: b => parseFloat(b.dataset.rotateDeg) || 0,
  applyDeg: (b, host, deg) => {
    b.dataset.rotateDeg = String(deg);
    const fx = b.dataset.flipH === '1' ? -1 : 1;
    const fy = b.dataset.flipV === '1' ? -1 : 1;
    b.style.transform = `rotate(${deg}deg) scale(${fx},${fy})`;
    window.scheduleAutoSave?.();
  },
  syncUI: (b, host, deg) => { const n = document.getElementById('vb-rotate-deg'); if (n) n.value = String(deg); },
  historyLabel: '벡터 회전',
});

// ── 회전 대상 타입별 핸들 add/remove 라우팅 ──
// 자유배치/독립 블록만 대상. asset·shape 확정 + #14b 텍스트·컴포넌트 확장.
// ★표(.table-block)·그래프(.graph-block)는 회전이 내부 셀/바 히트영역·레이아웃 좌표를
// 깨므로 «제외»(핫존 미부착) — registry에 항목 자체를 두지 않는다(상신 근거: 보고 참조).
// ★스티커(.sticker-block)는 sticker-select.js가 이미 회전 담당 → 여기 미등록(중복 방지).
const _ROTATE_HANDLERS = {
  'asset-block':       { add: _addAbRotateHandles,    remove: _removeAbRotateHandles },
  'shape-block':       { add: _addShapeRotateHandles, remove: _removeShapeRotateHandles },
  'text-block':        _TEXT_ROT,
  'icon-block':        _ICONIFY_ROT,
  'mockup-block':      _MOCKUP_ROT,
  'canvas-block':      _CANVAS_ROT,
  'icon-circle-block': _ICB_ROT,
  'vector-block':      _VECTOR_ROT,
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
  // 저장된 rotation 복원: asset 전용 기존 경로 유지, 신규 타입은 각 handler.restore.
  // (shape/frame은 종전대로 save-load가 복원 — 무접촉)
  if (block.classList.contains('asset-block')) _applyAbRotation(block);
  else if (typeof h.restore === 'function') h.restore(block);
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
