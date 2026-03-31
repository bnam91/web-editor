/* ══════════════════════════════════════
   CANVAS BLOCK — Figma 프레임 유사 자유배치 컨테이너
   canvas-item은 position:absolute + data-x/y/w/h로 배치
   Penpot 참고: 타입별 통합 Shape 모델, 상대좌표(부모 기준)
══════════════════════════════════════ */

let _selItem = null; // 현재 선택된 canvas-item
let _selCb   = null; // 해당 아이템의 부모 canvas-block

/* ── Arrow key nudge 핸들러 (전역 1회 등록) ── */
function _onKeyDown(e) {
  if (!_selItem) return;
  // contenteditable 텍스트 편집 중이면 무시
  const active = document.activeElement;
  if (active && active.getAttribute('contenteditable') === 'true') return;

  // Cmd+D → canvas-item 복제
  if ((e.metaKey || e.ctrlKey) && e.key === 'd') {
    e.preventDefault();
    duplicateSelectedItem();
    return;
  }

  // Escape → canvas-item 해제 + canvas-block 선택 유지
  if (e.key === 'Escape') {
    // _selCb가 null일 수 있으므로 item의 부모에서 직접 찾기
    const cb = _selCb || _selItem?.closest('.canvas-block');
    _deselectItem();
    if (cb) {
      window.deselectAll?.();
      cb.classList.add('selected');
      window.showCanvasProperties?.(cb);
    }
    return;
  }

  const arrows = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown'];
  if (!arrows.includes(e.key)) return;

  e.preventDefault();
  e.stopPropagation();

  const step = e.shiftKey ? 10 : 1;
  let nx = parseFloat(_selItem.dataset.x) || 0;
  let ny = parseFloat(_selItem.dataset.y) || 0;

  if (e.key === 'ArrowLeft')  nx -= step;
  if (e.key === 'ArrowRight') nx += step;
  if (e.key === 'ArrowUp')    ny -= step;
  if (e.key === 'ArrowDown')  ny += step;

  _selItem.dataset.x = nx; _selItem.dataset.y = ny;
  _selItem.style.left = nx + 'px'; _selItem.style.top = ny + 'px';
  _syncHandles(_selItem);

  // 패널 입력값 동기화
  const xEl = document.getElementById('ci-x');
  const yEl = document.getElementById('ci-y');
  if (xEl) xEl.value = nx;
  if (yEl) yEl.value = ny;

  // pushHistory는 keyup 시점에 1회만
  clearTimeout(_nudgeTimer);
  _nudgeTimer = setTimeout(() => window.pushHistory?.(), 400);
}
let _nudgeTimer = null;
document.addEventListener('keydown', _onKeyDown, true);

/* ── 위치/크기 CSS 적용 ── */
function _applyPos(item) {
  item.style.left   = (parseFloat(item.dataset.x) || 0) + 'px';
  item.style.top    = (parseFloat(item.dataset.y) || 0) + 'px';
  item.style.width  = (parseFloat(item.dataset.w) || 200) + 'px';
  item.style.height = (parseFloat(item.dataset.h) || 150) + 'px';
  if (item.dataset.zIndex) item.style.zIndex = item.dataset.zIndex;
}

/* ── 핸들 위치 동기화 ── */
// 코너: 8x8px → half=4, 엣지 tc/bc: 16x4px → halfW=8,halfH=2, 엣지 lc/rc: 4x16px → halfW=2,halfH=8
const HS  = 4;   // corner handle half-size (8px / 2)
const EHH = 8;   // edge horizontal half-width  (tc/bc: 16px / 2)
const EHV = 8;   // edge vertical half-height   (lc/rc: 16px / 2)
const EHt = 2;   // edge horizontal half-height (tc/bc: 4px / 2)
const EVw = 2;   // edge vertical half-width    (lc/rc: 4px / 2)
function _syncHandles(item) {
  if (!item._ciHandles) return;
  const w = parseFloat(item.dataset.w) || item.offsetWidth;
  const h = parseFloat(item.dataset.h) || item.offsetHeight;
  // 코너: top-left 기준으로 핸들 중심이 모서리에 오도록
  // 엣지: tc/bc는 좌우 중앙 + 상단/하단 edge, lc/rc는 좌측/우측 edge + 상하 중앙
  const pos = {
    tl: [-HS,          -HS         ],
    tc: [w/2 - EHH,   -EHt        ],
    tr: [w - HS,       -HS         ],
    rc: [w - EVw,      h/2 - EHV  ],
    br: [w - HS,       h - HS      ],
    bc: [w/2 - EHH,   h - EHt     ],
    bl: [-HS,          h - HS      ],
    lc: [-EVw,         h/2 - EHV  ],
  };
  Object.entries(pos).forEach(([id, [lx, ly]]) => {
    if (item._ciHandles[id]) {
      item._ciHandles[id].style.left = lx + 'px';
      item._ciHandles[id].style.top  = ly + 'px';
    }
  });
}

/* ── 핸들 생성 ── */
function _createHandles(item) {
  _removeHandles(item);
  const defs = [
    { id: 'tl', cursor: 'nwse-resize', cls: 'ci-corner-handle' },
    { id: 'tc', cursor: 'ns-resize',   cls: 'ci-edge-handle'   },
    { id: 'tr', cursor: 'nesw-resize', cls: 'ci-corner-handle' },
    { id: 'rc', cursor: 'ew-resize',   cls: 'ci-edge-handle'   },
    { id: 'br', cursor: 'nwse-resize', cls: 'ci-corner-handle' },
    { id: 'bc', cursor: 'ns-resize',   cls: 'ci-edge-handle'   },
    { id: 'bl', cursor: 'nesw-resize', cls: 'ci-corner-handle' },
    { id: 'lc', cursor: 'ew-resize',   cls: 'ci-edge-handle'   },
  ];
  const handles = {};
  defs.forEach(({ id, cursor, cls }) => {
    const h = document.createElement('div');
    h.className = `${cls} ci-handle`;
    h.dataset.hid = id;
    h.style.cursor = cursor;
    h.draggable = false;
    h.addEventListener('dragstart', e => e.preventDefault());
    h.addEventListener('mousedown', e => {
      if (e.button !== 0) return;
      e.preventDefault(); e.stopPropagation();
      _startResize(item, id, e);
    });
    item.appendChild(h);
    handles[id] = h;
  });
  item._ciHandles = handles;
  _syncHandles(item);
}

function _removeHandles(item) {
  item.querySelectorAll('.ci-handle').forEach(h => h.remove());
  item._ciHandles = null;
}

/* ── 아이템 선택 / 해제 ── */
function _selectItem(cb, item) {
  if (_selItem === item) return;
  _deselectItem();
  _selItem = item;
  _selCb   = cb;
  item.classList.add('ci-selected');
  cb.classList.add('ci-active'); // overflow:visible for handles
  _createHandles(item);
  window.showCanvasItemProperties?.(cb, item);
  // 바깥 클릭 시 해제
  setTimeout(() => {
    document.addEventListener('mousedown', _onOutsideDown);
  }, 0);
}

function _deselectItem() {
  if (!_selItem) return;
  // 텍스트 편집 중이면 먼저 blur로 종료
  const activeTextEl = _selItem.querySelector('.ci-text[contenteditable="true"]');
  if (activeTextEl) {
    activeTextEl.contentEditable = 'false';
    activeTextEl.style.cursor = '';
    _selItem.dataset.content = activeTextEl.innerHTML;
  }
  _selItem.classList.remove('ci-selected');
  _removeHandles(_selItem);
  _selCb?.classList.remove('ci-active');
  _selItem = null;
  _selCb   = null;
  document.removeEventListener('mousedown', _onOutsideDown);
}

function _onOutsideDown(e) {
  if (_selItem && !_selItem.contains(e.target) && !e.target.closest('#panel-right')) {
    _deselectItem();
  }
}

/* ── 이동 드래그 ── */
function _startMove(cb, item, e) {
  if (e.target.classList.contains('ci-handle')) return;
  if (e.target.getAttribute('contenteditable') === 'true') return;
  e.preventDefault(); e.stopPropagation();
  const zs = (window.currentZoom || 100) / 100;
  const sx = e.clientX, sy = e.clientY;
  const ox = parseFloat(item.dataset.x) || 0;
  const oy = parseFloat(item.dataset.y) || 0;
  let _rafId = null;

  const onMove = mv => {
    const nx = Math.round(ox + (mv.clientX - sx) / zs);
    const ny = Math.round(oy + (mv.clientY - sy) / zs);
    item.style.left = nx + 'px';
    item.style.top  = ny + 'px';
    if (!_rafId) _rafId = requestAnimationFrame(() => {
      _syncHandles(item);
      _rafId = null;
    });
  };
  const onUp = () => {
    if (_rafId) cancelAnimationFrame(_rafId);
    item.dataset.x = Math.round(parseFloat(item.style.left));
    item.dataset.y = Math.round(parseFloat(item.style.top));
    _syncHandles(item);
    window.pushHistory?.();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ── 리사이즈 드래그 ── */
function _startResize(item, handle, e) {
  const zs = (window.currentZoom || 100) / 100;
  const sx = e.clientX, sy = e.clientY;
  const ox = parseFloat(item.dataset.x) || 0;
  const oy = parseFloat(item.dataset.y) || 0;
  const ow = parseFloat(item.dataset.w) || item.offsetWidth;
  const oh = parseFloat(item.dataset.h) || item.offsetHeight;
  const isLeft = ['tl','bl','lc'].includes(handle);
  const isTop  = ['tl','tr','tc'].includes(handle);
  const isH    = ['lc','rc'].includes(handle);
  const isV    = ['tc','bc'].includes(handle);
  let _rafId = null;

  const onMove = mv => {
    const dx = (mv.clientX - sx) / zs;
    const dy = (mv.clientY - sy) / zs;
    let nx = ox, ny = oy, nw = ow, nh = oh;
    if (!isV) {
      nw = Math.max(40, isLeft ? ow - dx : ow + dx);
      if (isLeft) nx = ox + (ow - nw);
    }
    if (!isH) {
      nh = Math.max(20, isTop ? oh - dy : oh + dy);
      if (isTop) ny = oy + (oh - nh);
    }
    item.style.left   = nx + 'px';
    item.style.top    = ny + 'px';
    item.style.width  = nw + 'px';
    item.style.height = nh + 'px';
    if (!_rafId) _rafId = requestAnimationFrame(() => { _syncHandles(item); _rafId = null; });
  };
  const onUp = () => {
    if (_rafId) cancelAnimationFrame(_rafId);
    item.dataset.x = Math.round(parseFloat(item.style.left));
    item.dataset.y = Math.round(parseFloat(item.style.top));
    item.dataset.w = Math.round(parseFloat(item.style.width));
    item.dataset.h = Math.round(parseFloat(item.style.height));
    _syncHandles(item);
    window.pushHistory?.();
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);
  };
  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

/* ── 타입별 바인딩 ── */
function _bindImageItem(item) {
  // src가 있으면 img 복원
  if (item.dataset.src && !item.querySelector('.ci-img')) {
    const img = document.createElement('img');
    img.className = 'ci-img';
    img.src = item.dataset.src;
    img.draggable = false;
    img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;border-radius:inherit;';
    item.appendChild(img);
  }
  // 이미지 드롭
  if (!item._imgDropBound) {
    item._imgDropBound = true;
    item.addEventListener('dragover', e => { e.preventDefault(); e.stopPropagation(); });
    item.addEventListener('drop', e => {
      e.preventDefault(); e.stopPropagation();
      const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        item.dataset.src = ev.target.result;
        let img = item.querySelector('.ci-img');
        if (!img) {
          img = document.createElement('img');
          img.className = 'ci-img'; img.draggable = false;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;border-radius:inherit;';
          item.appendChild(img);
        }
        img.src = ev.target.result;
        window.pushHistory?.();
      };
      reader.readAsDataURL(file);
    });
  }
}

function _bindTextItem(item) {
  let textEl = item.querySelector('.ci-text');
  if (!textEl) {
    textEl = document.createElement('div');
    textEl.className = 'ci-text';
    textEl.innerHTML = item.dataset.content || '텍스트를 입력하세요';
    item.appendChild(textEl);
  }
  textEl.setAttribute('contenteditable', 'false');

  // 더블클릭 → 편집 모드
  if (!item._textEditBound) {
    item._textEditBound = true;
    item.addEventListener('dblclick', e => {
      e.stopPropagation();
      textEl.contentEditable = 'true';
      textEl.style.cursor = 'text';
      textEl.focus();
      const range = document.createRange();
      range.selectNodeContents(textEl);
      const sel = window.getSelection();
      sel?.removeAllRanges(); sel?.addRange(range);
    });
    textEl.addEventListener('blur', () => {
      textEl.contentEditable = 'false';
      textEl.style.cursor = '';
      item.dataset.content = textEl.innerHTML;
      window.pushHistory?.();
    });
    textEl.addEventListener('keydown', e => {
      if (e.key === 'Escape') { textEl.blur(); }
      e.stopPropagation(); // 에디터 단축키 차단
    });
  }
}

/* ── 아이템 바인딩 ── */
function _bindItem(cb, item) {
  if (item._itemBound) return;
  item._itemBound = true;
  _applyPos(item);
  if (item.dataset.type === 'image') _bindImageItem(item);
  if (item.dataset.type === 'text')  _bindTextItem(item);

  item.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    e.stopPropagation();
    _selectItem(cb, item);
    _startMove(cb, item, e);
  });
}

/* ══════════════════════════════════════
   PUBLIC API
══════════════════════════════════════ */

export function bindCanvasBlock(cb) {
  if (cb._canvasBound) return;
  cb._canvasBound = true;

  // 배경색 복원
  if (cb.dataset.bg) cb.style.background = cb.dataset.bg;

  // 기존 아이템 바인딩 (로드/rebindAll 시)
  cb.querySelectorAll(':scope > .canvas-item').forEach(item => _bindItem(cb, item));

  // canvas-block 자체 클릭 (아이템 밖) → 아이템 해제 + canvas 속성 표시
  cb.addEventListener('click', e => {
    e.stopPropagation();
    if (!e.target.classList.contains('canvas-item') && !e.target.closest('.canvas-item')) {
      _deselectItem();
      if (e.shiftKey) {
        // Shift+클릭: 다중 선택 토글
        if (cb.classList.contains('selected')) {
          cb.classList.remove('selected');
          if (cb._layerItem) { cb._layerItem.classList.remove('active'); cb._layerItem.style.background = ''; }
        } else {
          cb.classList.add('selected');
          if (cb._layerItem) cb._layerItem.classList.add('active');
        }
        window.syncSection?.(cb.closest('.section-block'));
        return;
      }
      // canvas-block 선택: deselectAll 후 직접 .selected 추가
      window.deselectAll?.();
      cb.classList.add('selected');
      window.showCanvasProperties?.(cb);
    }
  });

  // Escape → 아이템 선택 해제 후 canvas-block 선택 유지
  cb.addEventListener('keydown', e => {
    if (e.key === 'Escape' && (_selCb === cb || _selItem?.closest('.canvas-block') === cb)) {
      e.stopPropagation();
      _deselectItem();
      window.deselectAll?.();
      cb.classList.add('selected');
      window.showCanvasProperties?.(cb);
    }
  });

  // 이미지 파일 드래그&드롭 → 드롭 위치에 이미지 canvas-item 생성
  cb.addEventListener('dragover', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    cb.classList.add('cb-drag-over');
  });
  cb.addEventListener('dragleave', e => {
    if (!cb.contains(e.relatedTarget)) cb.classList.remove('cb-drag-over');
  });
  cb.addEventListener('drop', e => {
    if (!e.dataTransfer.types.includes('Files')) return;
    e.preventDefault();
    e.stopPropagation();
    cb.classList.remove('cb-drag-over');
    const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
    if (!file) return;
    // 드롭 위치를 canvas-block 기준 좌표로 변환
    const rect = cb.getBoundingClientRect();
    const zs = (window.currentZoom || 100) / 100;
    const dropX = Math.round((e.clientX - rect.left) / zs) - 100;
    const dropY = Math.round((e.clientY - rect.top)  / zs) - 75;
    const dropXf = Math.max(0, dropX);
    const dropYf = Math.max(0, dropY);
    const reader = new FileReader();
    reader.onload = ev => {
      const src = ev.target.result;
      // 원본 크기 측정 후 item 생성
      const probe = new Image();
      probe.onload = () => {
        const cbW = cb.offsetWidth || 800;
        const cbH = parseFloat(cb.style.height) || 500;
        // 원본 크기가 캔버스보다 크면 비율 유지하며 축소
        let nw = probe.naturalWidth;
        let nh = probe.naturalHeight;
        if (nw > cbW * 0.9) { nh = Math.round(nh * (cbW * 0.9) / nw); nw = Math.round(cbW * 0.9); }
        if (nh > cbH * 0.9) { nw = Math.round(nw * (cbH * 0.9) / nh); nh = Math.round(cbH * 0.9); }
        const item = addItemToCanvas(cb, 'image', dropXf, dropYf);
        item.dataset.w = nw; item.dataset.h = nh;
        item.style.width = nw + 'px'; item.style.height = nh + 'px';
        item.dataset.src = src;
        let img = item.querySelector('.ci-img');
        if (!img) {
          img = document.createElement('img');
          img.className = 'ci-img'; img.draggable = false;
          img.style.cssText = 'width:100%;height:100%;object-fit:cover;display:block;pointer-events:none;border-radius:inherit;';
          item.appendChild(img);
        }
        img.src = src;
        window.syncCanvasItemHandles?.(item);
        window.pushHistory?.();
      };
      probe.src = src;
    };
    reader.readAsDataURL(file);
  });
}

export function addItemToCanvas(cb, type, x = 40, y = 40) {
  window.pushHistory?.();
  const item = document.createElement('div');
  item.className = 'canvas-item';
  item.id = 'ci_' + Math.random().toString(36).slice(2, 9);
  item.dataset.type = type;
  item.dataset.x = x;
  item.dataset.y = y;
  item.dataset.w = type === 'text' ? 220 : 300;
  item.dataset.h = type === 'text' ?  60 : 200;
  if (type === 'text') item.dataset.content = '텍스트를 입력하세요';
  cb.appendChild(item);
  _bindItem(cb, item);
  _selectItem(cb, item);
  window.buildLayerPanel?.();
  return item;
}

export function duplicateSelectedItem() {
  if (!_selItem || !_selCb) return;
  window.pushHistory?.();
  const src = _selItem;
  const cb  = _selCb;

  const clone = document.createElement('div');
  clone.className = 'canvas-item';
  clone.id = 'ci_' + Math.random().toString(36).slice(2, 9);
  // dataset 복사
  Object.assign(clone.dataset, src.dataset);
  // 20px 오프셋
  clone.dataset.x = (parseFloat(src.dataset.x) || 0) + 20;
  clone.dataset.y = (parseFloat(src.dataset.y) || 0) + 20;

  cb.appendChild(clone);
  _bindItem(cb, clone);
  _selectItem(cb, clone);
  window.buildLayerPanel?.();
  return clone;
}

export function removeSelectedItem() {
  if (!_selItem) return;
  window.pushHistory?.();
  const item = _selItem;
  const cb = _selCb;
  _deselectItem();
  item.remove();
  window.buildLayerPanel?.();
  if (cb) window.showCanvasProperties?.(cb);
}

export function bringForward() {
  if (!_selItem) return;
  const z = (parseInt(_selItem.dataset.zIndex) || 0) + 1;
  _selItem.dataset.zIndex = z;
  _selItem.style.zIndex = z;
  window.pushHistory?.();
}

export function sendBackward() {
  if (!_selItem) return;
  const z = Math.max(0, (parseInt(_selItem.dataset.zIndex) || 0) - 1);
  _selItem.dataset.zIndex = z;
  _selItem.style.zIndex = z;
  window.pushHistory?.();
}

export function syncCanvasItemHandles(item) { _syncHandles(item); }
export function getSelectedItem() { return _selItem; }
export function getSelectedCb()   { return _selCb; }
export function deselectCanvasItem() { _deselectItem(); }

// window 노출 (classic scripts / prop-canvas에서 접근)
window.bindCanvasBlock          = bindCanvasBlock;
window.addItemToCanvas          = addItemToCanvas;
window.removeSelectedItem       = removeSelectedItem;
window.duplicateSelectedItem    = duplicateSelectedItem;
window.bringForward             = bringForward;
window.sendBackward             = sendBackward;
window.syncCanvasItemHandles    = syncCanvasItemHandles;
window.getSelectedItem          = getSelectedItem;
window.getSelectedCb            = getSelectedCb;
window.deselectCanvasItem       = deselectCanvasItem;
