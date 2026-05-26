// sticker-select.js — 스티커 블록 선택 + 드래그 이동
// 어노테이션 셀렉트와 동일한 플로팅 오버레이 패턴

// ── 공유 헬퍼 (annotation-select.js와 공유) ───────────────────────────
// 마우스 client 좌표로 어떤 .section-block 위에 있는지 hit-test.
// elementsFromPoint 우선, 실패 시 모든 section-block rect 순회 fallback.
function _findSectionAt(clientX, clientY) {
  try {
    const stack = document.elementsFromPoint(clientX, clientY) || [];
    for (const el of stack) {
      const sec = el.closest && el.closest('.section-block');
      if (sec) return sec;
    }
  } catch (_) {}
  const all = document.querySelectorAll('.section-block');
  for (const sec of all) {
    const r = sec.getBoundingClientRect();
    if (clientX >= r.left && clientX <= r.right && clientY >= r.top && clientY <= r.bottom) {
      return sec;
    }
  }
  return null;
}
window._findSectionAt = _findSectionAt;

// 좌표를 섹션 안으로 clamp (블록 크기 고려).
// secW/secH는 layout 기준 (clientWidth/Height — zoom 영향 없음).
function _clampToSection(x, y, sec, blockW, blockH) {
  const secW = sec.clientWidth  || 0;
  const secH = sec.clientHeight || 0;
  const bw = blockW || 0;
  const bh = blockH || 0;
  const maxX = Math.max(0, secW - bw);
  const maxY = Math.max(0, secH - bh);
  return [
    Math.min(Math.max(0, x), maxX),
    Math.min(Math.max(0, y), maxY),
  ];
}
window._clampToSection = _clampToSection;

function _selectSticker(block) {
  if (!block) return;
  // 다른 selected 풀기 (deselectAll이 sticker-block도 처리)
  document.querySelectorAll('.sticker-block.selected').forEach(b => {
    if (b !== block) {
      b.classList.remove('selected');
      _removeHlbHandles(b);
      _removeCornerHandles(b);
    }
  });
  window.deselectAll?.();
  block.classList.add('selected');
  if (block.dataset.shape === 'highlightB') {
    _addHlbHandles(block);
  } else {
    _addCornerHandles(block);
  }
  window.showStickerProperties?.(block);
}
window._selectSticker = _selectSticker;

function _deselectAllStickers() {
  document.querySelectorAll('.sticker-block.selected').forEach(b => {
    b.classList.remove('selected');
    _removeHlbHandles(b);
    _removeCornerHandles(b);
  });
}
window._deselectAllStickers = _deselectAllStickers;

// ── HighlightB 끝점 핸들 ──
function _removeHlbHandles(block) {
  block.querySelectorAll('.hlb-handle').forEach(h => h.remove());
}
function _addHlbHandles(block) {
  _removeHlbHandles(block);
  if (block.dataset.shape !== 'highlightB') return;
  const x1 = parseFloat(block.dataset.x1) || 0;
  const y1 = parseFloat(block.dataset.y1) || 0;
  const x2 = parseFloat(block.dataset.x2) || 0;
  const y2 = parseFloat(block.dataset.y2) || 0;
  // block의 실제 left/top은 (min - pad). 따라서 핸들 left = x - blockLeftInSection
  const rect = block.getBoundingClientRect();
  const sec  = block.closest('.section-block');
  let baseLeft = 0, baseTop = 0;
  if (sec) {
    const sRect = sec.getBoundingClientRect();
    const zoom = (window.currentZoom || 40) / 100;
    baseLeft = (rect.left - sRect.left) / zoom;
    baseTop  = (rect.top  - sRect.top)  / zoom;
  } else {
    // fallback — block.style.left/top 파싱
    baseLeft = parseFloat(block.style.left) || 0;
    baseTop  = parseFloat(block.style.top)  || 0;
  }
  const mk = (endpoint, hx, hy) => {
    const h = document.createElement('div');
    h.className = 'hlb-handle';
    h.dataset.endpoint = endpoint;
    h.style.left = (hx - baseLeft) + 'px';
    h.style.top  = (hy - baseTop) + 'px';
    block.appendChild(h);
    _bindHlbHandleDrag(h, block, endpoint);
  };
  mk('start', x1, y1);
  mk('end',   x2, y2);
}
function _bindHlbHandleDrag(handle, block, endpoint) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const startCX = e.clientX, startCY = e.clientY;
    const initX = parseFloat(block.dataset['x' + (endpoint === 'start' ? '1' : '2')]) || 0;
    const initY = parseFloat(block.dataset['y' + (endpoint === 'start' ? '1' : '2')]) || 0;
    const otherX = parseFloat(block.dataset['x' + (endpoint === 'start' ? '2' : '1')]) || 0;
    const otherY = parseFloat(block.dataset['y' + (endpoint === 'start' ? '2' : '1')]) || 0;
    const onMove = (ev) => {
      let nx = initX + (ev.clientX - startCX) / zoom;
      let ny = initY + (ev.clientY - startCY) / zoom;
      // Shift+드래그 — 다른 endpoint 기준 수평/수직 snap
      if (ev.shiftKey) {
        const dx = nx - otherX;
        const dy = ny - otherY;
        if (Math.abs(dx) >= Math.abs(dy)) ny = otherY;
        else nx = otherX;
      }
      block.dataset['x' + (endpoint === 'start' ? '1' : '2')] = String(Math.round(nx));
      block.dataset['y' + (endpoint === 'start' ? '1' : '2')] = String(Math.round(ny));
      window.renderStickerBlock?.(block);
      _addHlbHandles(block); // 핸들 위치도 갱신
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('형광펜 선 끝점 이동');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
window._addHlbHandles = _addHlbHandles;
window._removeHlbHandles = _removeHlbHandles;

// ── Sticker 4모서리 리사이즈 핸들 (circle/square/highlight) ──
// highlightB는 _addHlbHandles로 처리, 여기는 호출되지 않음.
function _removeCornerHandles(block) {
  if (!block) return;
  block.querySelectorAll(':scope > .sticker-corner-handle, :scope > .sticker-rotate-zone').forEach(h => h.remove());
  block.classList.remove('tiny');
}

// 피그마식 회전 커서 (둥근 화살표)
// 피그마식 회전 커서 — 단일 SVG(흰 테두리 뒤 + 검정 화살표 앞)로 어떤 배경에서도 보이게.
// (data-URI 커서는 반드시 SVG 1개여야 함 — 이전엔 svg 2개를 이어붙여 무효→grab 폴백되던 버그)
const _STK_ROTATE_CURSOR = "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='24' height='24' viewBox='0 0 24 24' fill='none' stroke-linecap='round' stroke-linejoin='round'%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='white' stroke-width='4'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='white' stroke-width='4'/%3E%3Cpath d='M20 12a8 8 0 1 1-2.3-5.6' stroke='%23222' stroke-width='2'/%3E%3Cpolyline points='20 3 20 7 16 7' stroke='%23222' stroke-width='2'/%3E%3C/svg%3E\") 12 12, grab";

function _addCornerHandles(block) {
  _removeCornerHandles(block);
  if (!block || block.dataset.shape === 'highlightB') return;
  // 위치는 CSS의 .sticker-corner-handle[data-corner="..."]가 절대 px로 처리 (asset-handle과 동일 패턴)
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const el = document.createElement('div');
    el.className = 'sticker-corner-handle';
    el.dataset.corner = id;
    block.appendChild(el);
    _bindCornerHandleDrag(el, block, id);
  });
  // 회전 핫존 — 각 코너 바깥 대각선 영역(핸들 너머). 호버 시 회전 커서 → 드래그하면 회전
  const ROT_SZ = 24; // 화면상 핫존 크기(px) — 코너 바깥 회전 영역, 잡기 쉽게
  const neg = `calc(-${ROT_SZ}px * var(--inv-zoom, 1))`;
  const sz  = `calc(${ROT_SZ}px * var(--inv-zoom, 1))`;
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const z = document.createElement('div');
    z.className = 'sticker-rotate-zone';
    z.dataset.corner = id;
    const pos = id === 'tl' ? `top:${neg};left:${neg};`
              : id === 'tr' ? `top:${neg};right:${neg};`
              : id === 'bl' ? `bottom:${neg};left:${neg};`
              :               `bottom:${neg};right:${neg};`;
    z.style.cssText = `position:absolute;${pos}width:${sz};height:${sz};z-index:99;pointer-events:auto;cursor:${_STK_ROTATE_CURSOR};`;
    block.appendChild(z);
    _bindRotateDrag(z, block);
  });
}

// 회전 드래그 — 블록 중앙 기준 자유 회전. render(innerHTML 초기화)를 피하려고
// transform만 직접 갱신 → 핸들/핫존 유지. dataset.rotation도 갱신해 저장·리로드 반영.
function _bindRotateDrag(zone, block) {
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
      let deg = Math.round(init + (a - startA));
      deg = ((deg % 360) + 360) % 360;
      if (deg > 180) deg -= 360; // -180..180 (패널 슬라이더와 동일 범위)
      block.style.transform = `rotate(${deg}deg)`;
      block.style.transformOrigin = 'center center';
      block.dataset.rotation = String(deg);
      const rs = document.getElementById('stk-t-rot');
      const rn = document.getElementById('stk-t-rot-num');
      if (rs) rs.value = deg;
      if (rn) rn.value = deg;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('스티커 회전');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// 핸들 드래그 → width/height 변경. Shift = 비율 유지.
// shape별 데이터 모델:
//   - 'highlight' (직사각 형광펜): data-hlW / data-hlH
//   - 그 외 (circle/square 등):  data-sizeW / data-sizeH (W/H 독립, 없으면 data-size 사용)
function _bindCornerHandleDrag(handle, block, corner) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const shape = block.dataset.shape || 'circle';
    const isHighlight = shape === 'highlight';
    // 초기 W/H/위치 캐싱
    const initW = isHighlight
      ? (parseInt(block.dataset.hlW) || 160)
      : (parseInt(block.dataset.sizeW) || parseInt(block.dataset.size) || 60);
    const initH = isHighlight
      ? (parseInt(block.dataset.hlH) || 28)
      : (parseInt(block.dataset.sizeH) || parseInt(block.dataset.size) || 60);
    const initX = parseInt(block.dataset.x) || 0;
    const initY = parseInt(block.dataset.y) || 0;
    const aspect = initH > 0 ? initW / initH : 1;
    const startCX = e.clientX, startCY = e.clientY;
    const MIN = 10;

    const onMove = (ev) => {
      const dx = (ev.clientX - startCX) / zoom;
      const dy = (ev.clientY - startCY) / zoom;
      const altCenter = ev.altKey; // 중심 anchor 모드
      // corner별 W/H 변화량 (기본 anchor는 반대편 모서리)
      let dW = 0, dH = 0;
      if (corner === 'tl') { dW = -dx; dH = -dy; }
      else if (corner === 'tr') { dW =  dx; dH = -dy; }
      else if (corner === 'bl') { dW = -dx; dH =  dy; }
      else if (corner === 'br') { dW =  dx; dH =  dy; }
      // Alt = 중심 기준 → 양쪽이 동시에 늘어남 (변화량 2배)
      if (altCenter) { dW *= 2; dH *= 2; }
      let newW = initW + dW;
      let newH = initH + dH;
      // Shift = 비율 유지 (변화량 큰 축 기준)
      if (ev.shiftKey) {
        const rW = newW / initW;
        const rH = newH / initH;
        if (Math.abs(rW - 1) >= Math.abs(rH - 1)) {
          newH = newW / aspect;
        } else {
          newW = newH * aspect;
        }
      }
      newW = Math.max(MIN, Math.round(newW));
      newH = Math.max(MIN, Math.round(newH));
      // anchor 보정
      let newX = initX;
      let newY = initY;
      if (altCenter) {
        // 중심 유지 — 좌우 위아래 절반씩 보정
        newX = initX + Math.round((initW - newW) / 2);
        newY = initY + Math.round((initH - newH) / 2);
      } else if (corner === 'tl') { newX = initX + (initW - newW); newY = initY + (initH - newH); }
      else if (corner === 'tr') { newY = initY + (initH - newH); }
      else if (corner === 'bl') { newX = initX + (initW - newW); }
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      if (isHighlight) {
        block.dataset.hlW = String(newW);
        block.dataset.hlH = String(newH);
      } else {
        block.dataset.sizeW = String(newW);
        block.dataset.sizeH = String(newH);
        // data-size는 max로 동기화 (기존 단일 슬라이더 호환)
        block.dataset.size = String(Math.max(newW, newH));
      }
      window.renderStickerBlock?.(block);
      _addCornerHandles(block); // render가 innerHTML을 비워 핸들/회전존이 사라지므로 재추가 (hlb 패턴과 동일)
      // 핸들은 block 자식이라 left/top % 기준 자동 따라감.
      // tiny 클래스만 갱신
      if (newW < 40 || newH < 40) block.classList.add('tiny');
      else block.classList.remove('tiny');
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('스티커 크기 조절');
      window.scheduleAutoSave?.();
      if (block.classList.contains('selected')) {
        window.showStickerProperties?.(block);
      }
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}
window._addCornerHandles = _addCornerHandles;
window._removeCornerHandles = _removeCornerHandles;

function bindStickerSelect(block) {
  if (!block || block._stickerBound) return;
  block._stickerBound = true;

  // 클릭 → 선택 (capture + stopImmediatePropagation으로 다른 핸들러 격리)
  block.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (!block.classList.contains('selected')) _selectSticker(block);
  }, true);

  // 드래그 — mousedown으로 위치 이동
  block.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // 코너 핸들(리사이즈)·회전 핫존·hlb 끝점 위에서 누른 경우는 각자 핸들러가 처리하도록 양보
    // (이 리스너는 capture+stopImmediatePropagation이라 가드 없으면 핸들 mousedown을 삼켜 리사이즈/회전이 안 됨)
    if (e.target.closest?.('.sticker-corner-handle, .sticker-rotate-zone, .hlb-handle')) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    if (!block.classList.contains('selected')) _selectSticker(block);

    let sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const startX = e.clientX;
    const startY = e.clientY;

    // ── highlightB 전용 드래그 — 두 점을 함께 평행이동 + 섹션 내 clamp ──
    if (block.dataset.shape === 'highlightB') {
      const ox1 = parseFloat(block.dataset.x1) || 0;
      const oy1 = parseFloat(block.dataset.y1) || 0;
      const ox2 = parseFloat(block.dataset.x2) || 0;
      const oy2 = parseFloat(block.dataset.y2) || 0;
      // 두 점의 bbox로 clamp 범위 미리 계산
      const minX = Math.min(ox1, ox2);
      const maxX = Math.max(ox1, ox2);
      const minY = Math.min(oy1, oy2);
      const maxY = Math.max(oy1, oy2);
      const secW = sec.offsetWidth  || 860;
      const secH = sec.offsetHeight || 0;
      const onMoveB = (ev) => {
        let dx = (ev.clientX - startX) / zoom;
        let dy = (ev.clientY - startY) / zoom;
        // 두 점 모두 [0, secW] × [0, secH] 안에 머물도록 dx/dy clamp
        dx = Math.max(-minX, Math.min(secW - maxX, dx));
        dy = Math.max(-minY, Math.min(secH - maxY, dy));
        block.dataset.x1 = String(Math.round(ox1 + dx));
        block.dataset.y1 = String(Math.round(oy1 + dy));
        block.dataset.x2 = String(Math.round(ox2 + dx));
        block.dataset.y2 = String(Math.round(oy2 + dy));
        window.renderStickerBlock?.(block);
      };
      const onUpB = () => {
        document.removeEventListener('mousemove', onMoveB);
        document.removeEventListener('mouseup', onUpB);
        window.pushHistory?.('선 형광펜 이동');
        window.scheduleAutoSave?.();
      };
      document.addEventListener('mousemove', onMoveB);
      document.addEventListener('mouseup', onUpB);
      return;
    }

    let origX = parseInt(block.dataset.x) || 0;
    let origY = parseInt(block.dataset.y) || 0;
    // 드래그 시작 시 마우스가 블록 내부 어디를 잡았는지 (offset)
    const blockRect = block.getBoundingClientRect();
    const grabOffX = (startX - blockRect.left) / zoom;
    const grabOffY = (startY - blockRect.top)  / zoom;

    const onMove = (ev) => {
      const blockW = block.offsetWidth  || 0;
      const blockH = block.offsetHeight || 0;
      // 현재 마우스가 어떤 섹션 위에 있는지 탐지 (B 정책)
      const hoverSec = window._findSectionAt ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hoverSec && hoverSec !== sec) {
        // 부모 섹션 변경 — DOM 이동 + 좌표 reset (새 섹션 기준)
        hoverSec.appendChild(block);
        sec = hoverSec;
        const secRect = sec.getBoundingClientRect();
        const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
        const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
        const [cx, cy] = window._clampToSection(newXraw, newYraw, sec, blockW, blockH);
        origX = Math.round(cx);
        origY = Math.round(cy);
        block.dataset.x = String(origX);
        block.dataset.y = String(origY);
        block.style.left = origX + 'px';
        block.style.top  = origY + 'px';
        return;
      }
      // 같은 섹션 또는 섹션 밖 — 기존 섹션 유지 + clamp
      const secRect = sec.getBoundingClientRect();
      const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
      const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
      const [cx, cy] = window._clampToSection(newXraw, newYraw, sec, blockW, blockH);
      const newX = Math.round(cx);
      const newY = Math.round(cy);
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      block.style.left = newX + 'px';
      block.style.top  = newY + 'px';
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      window.pushHistory?.('스티커 이동');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, true);

  // 더블클릭 → 텍스트 편집 (contenteditable)
  block.addEventListener('dblclick', (e) => {
    e.stopPropagation();
    const textEl = block.querySelector('.sticker-text');
    if (!textEl) return;
    textEl.setAttribute('contenteditable', 'true');
    textEl.style.userSelect = 'text';
    textEl.style.cursor = 'text';
    textEl.focus();
    const range = document.createRange();
    range.selectNodeContents(textEl);
    const sel = window.getSelection();
    sel.removeAllRanges();
    sel.addRange(range);

    const finish = () => {
      textEl.removeAttribute('contenteditable');
      const t = (textEl.textContent || '').trim();
      const fallback = block.dataset.shape === 'text' ? 'Text' : 'NEW';
      block.dataset.text = t || fallback;
      if (!t) textEl.textContent = fallback;
      // 우측 prop 패널의 #stk-text input도 sync
      const propInp = document.querySelector('#stk-text');
      if (propInp && document.querySelector('.sticker-block.selected') === block) {
        propInp.value = block.dataset.text;
      }
      window.pushHistory?.('스티커 텍스트');
      window.scheduleAutoSave?.();
      textEl.removeEventListener('blur', finish);
      textEl.removeEventListener('keydown', onKey);
    };
    const onKey = (ev) => {
      if (ev.key === 'Enter' && !ev.shiftKey) { ev.preventDefault(); textEl.blur(); }
      else if (ev.key === 'Escape') { ev.stopPropagation(); textEl.blur(); }
    };
    textEl.addEventListener('blur', finish);
    textEl.addEventListener('keydown', onKey);
  });
}
window.bindStickerSelect = bindStickerSelect;

// ESC/v로 deselect
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' && e.key !== 'v') return;
  const sel = document.querySelector('.sticker-block.selected');
  if (!sel) return;
  if (document.activeElement && document.activeElement.getAttribute('contenteditable') === 'true') return;
  _deselectAllStickers();
});

// Delete/Backspace로 선택된 스티커 삭제
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Delete' && e.key !== 'Backspace') return;
  const tag = e.target.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || e.target.isContentEditable) return;
  const sel = document.querySelector('.sticker-block.selected');
  if (!sel) return;
  // contenteditable 텍스트 편집 중이면 default 동작 (글자 삭제) 유지
  if (sel.querySelector('[contenteditable="true"]')) return;
  e.preventDefault();
  sel.remove();
  window.pushHistory?.('스티커 삭제');
  window.scheduleAutoSave?.();
});
