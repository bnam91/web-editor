// gradient-select.js — gradient 블록 선택 + 드래그 이동 (sticker 패턴 미러)
// 2026-05-21 신규. sticker-select.js와 동일한 capture-phase 분리 셀렉트.

function _selectGradient(block) {
  if (!block) return;
  document.querySelectorAll('.gradient-block.selected').forEach(b => {
    if (b !== block) { b.classList.remove('selected'); _removeGradientCornerHandles(b); }
  });
  window.deselectAll?.();
  block.classList.add('selected');
  _addGradientCornerHandles(block);
  window.showGradientProperties?.(block);
  window.setBlockAnchor?.(block);   // ★1013t2C1-g — deselectAll 이 지운 ⇧ 범위 앵커를 다시 박는다
}
window._selectGradient = _selectGradient;

function _deselectAllGradients() {
  document.querySelectorAll('.gradient-block.selected').forEach(b => {
    b.classList.remove('selected');
    _removeGradientCornerHandles(b);
  });
}
window._deselectAllGradients = _deselectAllGradients;

// ── 4모서리 리사이즈 핸들 (sticker-corner-handle 패턴 재사용) ───────────────
function _removeGradientCornerHandles(block) {
  if (!block) return;
  block.querySelectorAll(':scope > .gradient-corner-handle').forEach(h => h.remove());
}
function _addGradientCornerHandles(block) {
  _removeGradientCornerHandles(block);
  if (!block) return;
  ['tl', 'tr', 'bl', 'br'].forEach(id => {
    const el = document.createElement('div');
    el.className = 'gradient-corner-handle';
    el.dataset.corner = id;
    block.appendChild(el);
    _bindGradientCornerDrag(el, block, id);
  });
}
function _bindGradientCornerDrag(handle, block, corner) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    const zoom = (window.currentZoom || 40) / 100;
    const initW = parseInt(block.dataset.gradWidth)  || 860;
    const initH = parseInt(block.dataset.gradHeight) || 300;
    const initX = parseInt(block.dataset.x) || 0;
    const initY = parseInt(block.dataset.y) || 0;
    const aspect = initH > 0 ? initW / initH : 1;
    const startCX = e.clientX, startCY = e.clientY;
    const MIN = 20;
    // 드래그 시작 시 1회만 읽는다 — 섹션 박스는 리사이즈 중 바뀌지 않으므로,
    // 매 mousemove마다 다시 읽으면(쓰기 직후 읽기) 강제 동기 레이아웃이 걸린다.
    const sec  = block.closest('.section-block');
    const secW = sec ? sec.offsetWidth  : 0;
    const secH = sec ? sec.offsetHeight : 0;

    const _hist = window.beginDragHistory?.('그라데이션 리사이즈');
    const onMove = (ev) => {
      _hideGradSnap();
      const dx = (ev.clientX - startCX) / zoom;
      const dy = (ev.clientY - startCY) / zoom;
      /* ★«시작 상태»를 여기서 1회 찍는다 — 끝 상태는 onUp 의 pushHistory. 드래그는 «양쪽 끝»을
         다 남겨야 삽입(push-before) 뒤 첫 드래그에서 ⌘Z 가 삽입까지 먹지 않는다(js/drag-history.js). */
      _hist?.arm(dx, dy);
      const altCenter = ev.altKey;
      let dW = 0, dH = 0;
      if      (corner === 'tl') { dW = -dx; dH = -dy; }
      else if (corner === 'tr') { dW =  dx; dH = -dy; }
      else if (corner === 'bl') { dW = -dx; dH =  dy; }
      else if (corner === 'br') { dW =  dx; dH =  dy; }
      if (altCenter) { dW *= 2; dH *= 2; }
      let newW = initW + dW;
      let newH = initH + dH;
      if (ev.shiftKey) {
        const rW = newW / initW, rH = newH / initH;
        if (Math.abs(rW - 1) >= Math.abs(rH - 1)) newH = newW / aspect;
        else newW = newH * aspect;
      }
      newW = Math.max(MIN, Math.round(newW));
      newH = Math.max(MIN, Math.round(newH));
      // ── 섹션 너비 스냅 (width only) ──────────────────────────────────────
      const snapTh = GRAD_SNAP_SCREEN / zoom; // 화면 px → 섹션 로컬 px
      if (secW > 0 && Math.abs(newW - secW) <= snapTh) {
        newW = secW;
        _showGradSnapEdge(sec, 'left');
        _showGradSnapEdge(sec, 'right');
      }
      // ─────────────────────────────────────────────────────────────────────
      let newX = initX, newY = initY;
      if (altCenter) {
        newX = initX + Math.round((initW - newW) / 2);
        newY = initY + Math.round((initH - newH) / 2);
      } else if (corner === 'tl') { newX = initX + (initW - newW); newY = initY + (initH - newH); }
      else if (corner === 'tr')   { newY = initY + (initH - newH); }
      else if (corner === 'bl')   { newX = initX + (initW - newW); }
      block.dataset.gradWidth  = String(newW);
      block.dataset.gradHeight = String(newH);
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      window.renderGradientBlock?.(block, { secW, secH });
      // 우측 패널 슬라이더 동기화 (선택된 상태에서 패널이 열려있으면)
      const wSlider = document.getElementById('grad-width-slider');
      const wNum    = document.getElementById('grad-width-num');
      const hSlider = document.getElementById('grad-height-slider');
      const hNum    = document.getElementById('grad-height-num');
      if (wSlider) wSlider.value = newW;
      if (wNum)    wNum.value    = newW;
      if (hSlider) hSlider.value = newH;
      if (hNum)    hNum.value    = newH;
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      _hideGradSnap();
      window.pushHistory?.('그라데이션 리사이즈');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  });
}

// ── 엣지 맞닿기 스냅 (그라데이션 오버레이를 다른 블록 변에 약하게 끌어 붙임) ──
const GRAD_SNAP_SCREEN = 16; // 화면상 자석 끌림 거리(px) — 줌과 무관하게 일정한 체감
const _GRAD_TARGET_SEL = '.text-block,.asset-block,.card-block,.canvas-block,.banner02-block, .comparison-block,.table-block,.graph-block,.divider-block,.icon-circle-block,.label-group-block,.icon-text-block,.step-block,.chat-block,.laurel-block,.mockup-block,.shape-block,.sticker-block,.gradient-block';
let _gradSnapEls = [];

function _hideGradSnap() {
  _gradSnapEls.forEach(e => e.remove());
  _gradSnapEls = [];
}

function _showGradSnapEdge(el, side) {
  const ov = document.getElementById('ss-handles-overlay');
  if (!ov || !el) return;
  const r = el.getBoundingClientRect();
  const line = document.createElement('div');
  line.style.cssText = 'position:absolute;pointer-events:none;z-index:9999;background:var(--sel-color,#2d6fe8);box-shadow:0 0 0 0.5px rgba(255,255,255,0.4);';
  if (side === 'top')         { line.style.left = r.left+'px';        line.style.top = (r.top-1)+'px';     line.style.width = r.width+'px'; line.style.height = '2px'; }
  else if (side === 'bottom') { line.style.left = r.left+'px';        line.style.top = (r.bottom-1)+'px';  line.style.width = r.width+'px'; line.style.height = '2px'; }
  else if (side === 'left')   { line.style.left = (r.left-1)+'px';    line.style.top = r.top+'px';         line.style.width = '2px';        line.style.height = r.height+'px'; }
  else if (side === 'right')  { line.style.left = (r.right-1)+'px';   line.style.top = r.top+'px';         line.style.width = '2px';        line.style.height = r.height+'px'; }
  ov.appendChild(line);
  _gradSnapEls.push(line);
}

// 섹션 로컬 좌표(x,y)에서 형제 블록 변에 맞닿기 스냅. 적용된 좌표 + 하이라이트할 변 반환.
// bw/bh/secRect: 호출자가 드래그 시작 시 캐싱한 값(블록 크기·섹션 박스는 move 드래그 중 불변) —
// 넘기지 않으면 직접 읽는다(리사이즈 등 드래그 루프 밖 호출 대비 하위호환).
function _gradEdgeSnap(block, sec, x, y, bw, bh, secRect) {
  if (bw == null) bw = block.offsetWidth;
  if (bh == null) bh = block.offsetHeight;
  const zoom = (window.currentZoom || 40) / 100;
  const GRAD_SNAP_TH = GRAD_SNAP_SCREEN / zoom; // 화면 px → 섹션 로컬 px 환산 (줌 무관 체감)
  if (!secRect) secRect = sec.getBoundingClientRect();
  const toLocal = r => ({
    L: (r.left  - secRect.left) / zoom, R: (r.right  - secRect.left) / zoom,
    T: (r.top   - secRect.top)  / zoom, B: (r.bottom - secRect.top)  / zoom,
  });
  const targets = [...sec.querySelectorAll(_GRAD_TARGET_SEL)]
    .filter(el => el !== block && !block.contains(el) && !el.contains(block));

  const gL = x, gR = x + bw, gT = y, gB = y + bh;
  let snapX = x, snapY = y, bestX = null, bestY = null, edgeX = null, edgeY = null;

  for (const t of targets) {
    const e = toLocal(t.getBoundingClientRect());
    if (e.R - e.L < 1 || e.B - e.T < 1) continue;
    // 수직 맞닿기: 그라 아랫변↔대상 윗변 / 그라 윗변↔대상 아랫변
    let d = Math.abs(gB - e.T); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.T - bh; edgeY = { el: t, side: 'top' }; }
    d     = Math.abs(gT - e.B); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.B;      edgeY = { el: t, side: 'bottom' }; }
    // 수평 맞닿기: 그라 오른변↔대상 왼변 / 그라 왼변↔대상 오른변
    d     = Math.abs(gR - e.L); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.L - bw; edgeX = { el: t, side: 'left' }; }
    d     = Math.abs(gL - e.R); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.R;      edgeX = { el: t, side: 'right' }; }
    // 동일변 정렬: 윗변↔윗변 / 아랫변↔아랫변 (같은 쪽 변 줄맞춤)
    d     = Math.abs(gT - e.T); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.T;      edgeY = { el: t, side: 'top' }; }
    d     = Math.abs(gB - e.B); if (d <= GRAD_SNAP_TH && (bestY === null || d < bestY)) { bestY = d; snapY = e.B - bh; edgeY = { el: t, side: 'bottom' }; }
    // 동일변 정렬: 왼변↔왼변 / 오른변↔오른변
    d     = Math.abs(gL - e.L); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.L;      edgeX = { el: t, side: 'left' }; }
    d     = Math.abs(gR - e.R); if (d <= GRAD_SNAP_TH && (bestX === null || d < bestX)) { bestX = d; snapX = e.R - bw; edgeX = { el: t, side: 'right' }; }
  }
  // 섹션 자신의 네 모서리도 스냅 타깃 — 풀폭이 아닌 페이드 오버레이를 섹션 좌/우/상/하 끝에 다시 붙이기 쉽게.
  // (기존엔 형제 블록 변에만 스냅돼, 좌측 끝(x=0)에 재정렬이 어려웠음)
  const _secW = sec.clientWidth || 0, _secH = sec.clientHeight || 0;
  let ds = Math.abs(gL - 0);     if (ds <= GRAD_SNAP_TH && (bestX === null || ds < bestX)) { bestX = ds; snapX = 0;          edgeX = { el: sec, side: 'left' }; }
  ds     = Math.abs(gR - _secW); if (ds <= GRAD_SNAP_TH && (bestX === null || ds < bestX)) { bestX = ds; snapX = _secW - bw; edgeX = { el: sec, side: 'right' }; }
  ds     = Math.abs(gT - 0);     if (ds <= GRAD_SNAP_TH && (bestY === null || ds < bestY)) { bestY = ds; snapY = 0;          edgeY = { el: sec, side: 'top' }; }
  ds     = Math.abs(gB - _secH); if (ds <= GRAD_SNAP_TH && (bestY === null || ds < bestY)) { bestY = ds; snapY = _secH - bh; edgeY = { el: sec, side: 'bottom' }; }
  return { x: Math.round(snapX), y: Math.round(snapY), edgeX, edgeY };
}

/* ★1013t2C1-g — 그라데이션 복수 선택(⌘/Ctrl·⇧). js/sticker-select.js _stickerModifierClick 과 같은 꼴
   (⌘/Ctrl = toggleBlockSelect · ⇧ = rangeSelectBlocks · 3px 넘게 끈 것은 토글하지 않는다).
   ⛔공용 헬퍼로 묶지 않았다 — 두 파일(클래식 스크립트 ↔ 모듈)의 로드 순서 결합을 만들지 않으려고.
   @returns {boolean} 여기서 처리했으면 true(옛 길을 타지 않는다). */
const _GRD_CLICK_SLOP = 3;
function _grdMoved(block, e) {
  const d = block._grdDown;
  return !!d && Math.hypot(e.clientX - d.x, e.clientY - d.y) > _GRD_CLICK_SLOP;
}
function _gradientModifierClick(block, e) {
  const moved = _grdMoved(block, e);
  block._grdDown = null;
  const selected = block.classList.contains('selected');
  if (!(e.metaKey || e.ctrlKey || e.shiftKey)) {
    if (moved || !selected) return false;
    const others = [...document.querySelectorAll('#canvas .selected')].some(el => el !== block
      && !el.classList.contains('section-block') && !el.classList.contains('section-merged-part'));
    if (!others) return false;
    _selectGradient(block);                      // 여럿 중 «보통 클릭» = 그것 하나만
    return true;
  }
  if (moved) { if (!selected) _selectGradient(block); return true; }
  if (!window.toggleBlockSelect || !window.rangeSelectBlocks) return false;
  const sec = block.closest('.section-block');
  if (e.metaKey || e.ctrlKey) {
    if (selected) _removeGradientCornerHandles(block);
    window.toggleBlockSelect(block, sec);
  } else {
    window.rangeSelectBlocks(block, sec);
  }
  return true;
}

function bindGradientSelect(block) {
  if (!block || block._gradientBound) return;
  block._gradientBound = true;

  // 클릭 → 선택 (capture phase + stopImmediatePropagation)
  block.addEventListener('click', (e) => {
    e.stopPropagation();
    e.stopImmediatePropagation();
    if (_gradientModifierClick(block, e)) return;
    if (!block.classList.contains('selected')) _selectGradient(block);
  }, true);

  // 드래그 — mousedown으로 위치 이동
  block.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    // 코너 핸들 위에서 누른 경우는 핸들 자체 리사이즈 핸들러가 처리하도록 양보
    // (이 리스너는 capture+stopImmediatePropagation이라 가드 없으면 핸들 mousedown을 삼켜 리사이즈가 안 됨)
    if (e.target.closest?.('.gradient-corner-handle')) return;
    e.stopImmediatePropagation();
    e.stopPropagation();
    e.preventDefault();
    // ★1013t2C1-g — modifier 면 여기서 «하나만» 고르지 않는다(가름은 click 의 _gradientModifierClick)
    block._grdDown = { x: e.clientX, y: e.clientY };
    const _grdMod = e.metaKey || e.ctrlKey || e.shiftKey;
    if (!_grdMod && !block.classList.contains('selected')) _selectGradient(block);
    if (_grdMod && !block.classList.contains('selected')) {
      document.addEventListener('mouseup', (ev) => {
        if (_grdMoved(block, ev) && !block.classList.contains('selected')) _selectGradient(block);
      }, { capture: true, once: true });
    }

    let sec = block.closest('.section-block');
    if (!sec) return;
    const zoom = (window.currentZoom || 40) / 100;
    const startX = e.clientX;
    const startY = e.clientY;

    let origX = parseInt(block.dataset.x) || 0;
    let origY = parseInt(block.dataset.y) || 0;
    const blockRect = block.getBoundingClientRect();
    const grabOffX = (startX - blockRect.left) / zoom;
    const grabOffY = (startY - blockRect.top)  / zoom;
    // 드래그 동안 불변인 값은 1회만 읽는다 — 매 mousemove마다 다시 읽으면
    // (직전 프레임의 style 쓰기 직후 읽기가 되어) 강제 동기 레이아웃(reflow)이 걸린다.
    // 블록 크기는 move 드래그 중 안 바뀌고, 섹션 박스는 섹션이 바뀔 때만 다시 잰다.
    const blockW = block.offsetWidth  || 0;
    const blockH = block.offsetHeight || 0;
    let secRect = sec.getBoundingClientRect();
    let secW = sec.offsetWidth, secH = sec.offsetHeight;
    /* ★t5-08(b) · GRAD-DRAG-IN-GROUP-OVERSHOOT-01 — 그룹(자유배치 프레임) «안»의 그라데이션은 CSS 가 «그 프레임» 기준으로
       놓는다(left/top = dataset.x/y). 아래 식을 섹션 기준으로 세면 프레임이 섹션 안에서 떨어진 만큼 «한 번 더» 더해져
       첫 움직임에 그만큼 튄다(원 블럭 grad_pd5d6g 실측: +5px 끌기 → y 576→1064 · 이후 1:1). ⇒ 기준을 그 프레임 안쪽 상자로.
       그 안에서는 섹션 갈아타기·섹션 클램프·섹션 기준 변 스냅을 안 한다(셋 다 섹션 좌표다 — 그룹 밖으로 끌어내는 길이 아니다). */
    const _host = (block.parentElement && block.parentElement !== sec
      && block.parentElement.matches?.('.frame-block[data-free-layout]')) ? block.parentElement : null;
    if (_host) {
      const hr = _host.getBoundingClientRect();
      secRect = { left: hr.left + _host.clientLeft * zoom, top: hr.top + _host.clientTop * zoom };
    }
    const _hist = window.beginDragHistory?.('그라데이션 이동');

    const onMove = (ev) => {
      _hideGradSnap();
      /* ★«시작 상태»를 여기서 1회 찍는다 — 끝 상태는 onUp 의 pushHistory. 드래그는 «양쪽 끝»을
         다 남겨야 삽입(push-before) 뒤 첫 드래그에서 ⌘Z 가 삽입까지 먹지 않는다(js/drag-history.js). */
      _hist?.arm((ev.clientX - startX) / zoom, (ev.clientY - startY) / zoom);
      // 섹션 이동 (커서가 다른 섹션 위로 가면 부모 교체)
      const hoverSec = (!_host && window._findSectionAt) ? window._findSectionAt(ev.clientX, ev.clientY) : null;
      if (hoverSec && hoverSec !== sec) {
        hoverSec.appendChild(block);
        sec = hoverSec;
        secRect = sec.getBoundingClientRect();
        secW = sec.offsetWidth; secH = sec.offsetHeight;
        const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
        const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
        const [cx, cy] = window._clampToSection
          ? window._clampToSection(newXraw, newYraw, sec, blockW, blockH)
          : [newXraw, newYraw];
        origX = Math.round(cx);
        origY = Math.round(cy);
        block.dataset.x = String(origX);
        block.dataset.y = String(origY);
        window.renderGradientBlock?.(block, { secW, secH });
        return;
      }
      const newXraw = (ev.clientX - secRect.left) / zoom - grabOffX;
      const newYraw = (ev.clientY - secRect.top)  / zoom - grabOffY;
      const [cx, cy] = (!_host && window._clampToSection)
        ? window._clampToSection(newXraw, newYraw, sec, blockW, blockH)
        : [newXraw, newYraw];
      let newX = Math.round(cx);
      let newY = Math.round(cy);
      // 엣지 맞닿기 스냅 (약한 끌림) + 붙은 변 하이라이트 — 섹션 좌표 자라 그룹 안에선 안 건다(위 머리말)
      /* ★120 H9-SNAP ⑵(현빈 GO 261026) — ⌥(Alt) 누른 «동안»은 스냅을 건너뛴다(선례 js/scratch-pad.js:1120 「Alt 누르면 bypass」).
         매 mousemove 의 ev.altKey 로 본다 ⇒ 끄는 도중 눌렀다 떼면 바로 따라온다. ⛔세기(GRAD_SNAP_SCREEN)·clamp 무접촉 ·
         ⛔리사이즈(위 onMove)의 ⌥ = 가운데 기준은 다른 처리기라 무관. */
      if (!_host && !ev.altKey) {
        const snapped = _gradEdgeSnap(block, sec, newX, newY);
        newX = snapped.x; newY = snapped.y;
        if (snapped.edgeX) _showGradSnapEdge(snapped.edgeX.el, snapped.edgeX.side);
        if (snapped.edgeY) _showGradSnapEdge(snapped.edgeY.el, snapped.edgeY.side);
      }
      block.dataset.x = String(newX);
      block.dataset.y = String(newY);
      // fill 클리핑을 새 위치에 맞게 갱신 (outline + 핸들은 블록 요소에 있어 영향 없음)
      // renderGradientBlock이 left/top을 포함한 cssText 전체를 다시 쓰므로 별도 스타일 쓰기 불필요.
      window.renderGradientBlock?.(block, { secW, secH });
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      _hideGradSnap();
      window.pushHistory?.('그라데이션 이동');
      window.scheduleAutoSave?.();
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  }, true);
}
window.bindGradientSelect = bindGradientSelect;

// 기존 row > .gradient-block 구조 마이그레이션 — 캔버스 로드 후 호출
function migrateLegacyGradientBlocks(canvasEl) {
  const root = canvasEl || document;
  root.querySelectorAll('.gradient-block').forEach(block => {
    const parentRow = block.closest('.row');
    const sec = block.closest('.section-block');
    if (!sec) return;
    // 이미 섹션 직속 자식이면 skip
    if (block.parentElement === sec) return;
    /* ★★★`GRAD-GROUP-LOST-ON-RELOAD-01` (2026-10-25 · 지디 · 태양 t5-07 가 「지디 판정」으로 넘김)
       ★★그룹·프레임 안이면 ★★«legacy 가 아니다» — ★건드리지 않는다.
       ★병 : 아래 두 갈래가 ★`.frame-block` 안의 그라데이션까지 ★섹션 직속으로 ★꺼냈다
         ⇒ ★★`rebindAll`(⌘Z·로드·페이지 전환) ★한 번에 ★그룹이 ★풀리고,
           ★저장본에는 ★★빈 껍데기만 남아 ★사용자가 ★「그룹인 줄 알고」 ★계속 쓴다(★더 나쁘다).
       ★이 함수의 ★원래 몫은 ★「legacy ★`.row` / ★`.section-inner` 안」을 끌어올리는 것이다 —
         ★`.frame-block` 은 ★★legacy 가 ★아니라 ★★«지금 쓰는 구조»다.
       ★★선택자를 ★행위로 쟀다(`G4` · 261025) : ★그룹(`dataset.group='true'`)과 ★프레임 ★둘 다
         ★래퍼가 ★`.frame-block` 이고(block-factory.js:2170 등) ★`.section-inner` ★밖이다
         ⇒ ★★`.frame-block` ★하나로 ★둘을 ★같이 지키고 ★legacy 길은 ★안 막는다.
       ★잠그는 자 = `tests/dom/grad-group-lost-on-reload.dom.spec.js` ★`G1`·`G2`
         (⛔이 줄을 지우면 그 둘이 ★빨강으로 돌아온다 — ★무력화 대조로 재 뒀다) */
    if (block.closest('.frame-block')) return;
    // row 안에 있다면 섹션 직속으로 끌어올리고 row 삭제 (다른 자식 없을 경우)
    if (parentRow) {
      sec.appendChild(block);
      if (!parentRow.children.length) parentRow.remove();
    } else {
      // .section-inner 안에 있거나 다른 컨테이너 — 섹션 직속으로 이동
      sec.appendChild(block);
    }
    /* legacy data 정리 — ★이 delete 는 «상태 버리기»가 아니라 «읽히지 않는 잔재 치우기»다.
     *   .gradient-block 은 prop-page.js:92 의 하드 정책상 «항상» 패딩 제외라, usePadx 를
     *   읽는 곳이 0 이다(전수 확인 2026-08-28: usePadx 독자 4곳 전부 .asset-block 스코프 —
     *   prop-page getEffectiveUsePadx · save-load:716 · export-figma-json:347 · block-factory:2397).
     *   그라디언트 → 일반으로 «되돌리는» 경로도 없다(makeGradientBlock 은 새 노드를 만든다).
     *   실데이터 70개 전수: gradient-block 2개 · 그중 usePadx 보유 0개(대조군 asset-block 116개로 검출기 자기시험).
     * ⚠️★단 «그라디언트가 usePadx 를 존중하게» 정책이 바뀌면, 그 순간 이 줄은 «진짜 손실»이 된다.
     *   그때는 여기도 같이 고쳐라 — 지우지 말고 보존하는 쪽으로. */
    delete block.dataset.usePadx;
    // x/y 기본값 보장
    if (!block.dataset.x) block.dataset.x = '0';
    if (!block.dataset.y) block.dataset.y = '0';
    // 기본 width/height dataset 보장
    if (!block.dataset.gradWidth) {
      const inlineW = block.style.width && block.style.width.endsWith('px')
        ? parseInt(block.style.width)
        : 860;
      block.dataset.gradWidth = String(inlineW);
    }
    if (!block.dataset.gradHeight) {
      const inlineH = block.style.height && block.style.height.endsWith('px')
        ? parseInt(block.style.height)
        : 300;
      block.dataset.gradHeight = String(inlineH);
    }
    // legacy margin/width inline 제거
    block.style.removeProperty('margin-left');
    block.style.removeProperty('margin-right');
    window.renderGradientBlock?.(block);
  });
}
window.migrateLegacyGradientBlocks = migrateLegacyGradientBlocks;

/* ═══ t3-05 — ⌘[ / ⌘] 레이어 순서 (현빈 「그라데이션 블럭 > 커맨드 '[' , ']' 이걸로 다른 블럳 간에 레이어 순서 조절이 안되는듯?」)
 * ★층: 본문(.section-inner 안 · z 2)과 그라데이션(섹션 직속 · 인라인 z 2)은 «동점» ⇒ DOM 뒤가 위(gradient-block.js 머리 G-N0).
 *   editor.js moveSelectedBlocks 는 그라데이션을 «해당 없음»으로 지나갔다(수지맥 ca702d40: z 2 · 순서 index 4 그대로).
 * ★그 층의 형제 = 섹션 직속 .section-inner(본문 덩어리)와 그라데이션들 — 그 사이에서만 앞뒤를 바꾼다.
 *   방향 규약은 캔버스와 같다: ⌘[ = 뒤로 보내기(형제 중 앞으로) · ⌘] = 앞으로 가져오기 · ⇧ 는 무시(한 칸).
 *   ⛔오버레이(z 80 · [data-overlay-block]) 위로는 못 간다 — 층이 다르다(이 처방 밖).
 * ★editor.js 를 안 건드린 까닭 — moveSelectedBlocks 는 바이트 무변 래칫(tests/unit/scratch-layer-order U0)이 잠그고,
 *   editor.js 의 .remove() 수도 래칫(D14)이 잠근다 ⇒ 이 파일이 제 키를 «먼저»(capture) 받아 가져간다.
 *   스크래치가 골라져 있으면 그쪽 몫이다(⌘[ 의 스크래치 우선 판정과 같은 자리) ⇒ 손대지 않는다. */
function gradientLayerOrder(direction) {
  const sel = [...document.querySelectorAll('.section-block > .gradient-block.selected')];
  if (!sel.length) return false;
  const sec = sel[0].parentElement;
  if (!sel.every(g => g.parentElement === sec)) return true;          // 섹션이 섞였으면 키만 먹고 아무것도 안 한다
  const sibs = [...sec.children].filter(c => c.classList.contains('section-inner') || c.classList.contains('gradient-block'));
  sel.sort((a, b) => sibs.indexOf(a) - sibs.indexOf(b));
  if (direction === 'up') {
    const i0 = sibs.indexOf(sel[0]);
    if (i0 <= 0) return true;                                          // 이미 맨 뒤 — 키는 가져간다
    window.ensureHistoryCheckpoint?.('이동 전');
    sibs[i0 - 1].before(...sel);
  } else {
    const i1 = sibs.indexOf(sel[sel.length - 1]);
    if (i1 >= sibs.length - 1) return true;                            // 이미 맨 앞
    window.ensureHistoryCheckpoint?.('이동 전');
    sibs[i1 + 1].after(...sel);
  }
  window.pushHistory?.(direction === 'up' ? '뒤로 보내기' : '앞으로 가져오기');
  window.buildLayerPanel?.();
  sel.forEach(g => g.classList.add('selected'));
  window.scheduleAutoSave?.();
  return true;
}
window.gradientLayerOrder = gradientLayerOrder;
document.addEventListener('keydown', (e) => {
  if (!(e.metaKey || e.ctrlKey) || e.altKey || (e.code !== 'BracketLeft' && e.code !== 'BracketRight')) return;
  const t = e.target;
  if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return;
  /* 글자 편집 중이면 포커스가 contentEditable 이라 위 줄이 이미 돌려보낸다(편집 차단 명부를 늘리지 않는다 — editing-guard-roster) */
  if (typeof window._scratchHasSelection === 'function' && window._scratchHasSelection()) return;
  if (!gradientLayerOrder(e.code === 'BracketLeft' ? 'up' : 'down')) return;
  e.preventDefault(); e.stopImmediatePropagation();
}, true);

export { bindGradientSelect, migrateLegacyGradientBlocks };
