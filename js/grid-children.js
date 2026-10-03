/* ═══════════════════════════════════════════════════════════════════════════
   GRID CHILDREN (G19, 지디 2026-10-03 설계 확정) — 그리드 «밑»에 형제 블럭을 쌓는다.
   grid-block = [격자(.grd-inner)] + [★자식 블럭 그릇(.grd-children)] — 그리드가 «스택 프레임 + 격자»가 된다.

   ★그릇은 «자식이 하나라도 있을 때만» 있다 — 0개면 DOM 이 G19 이전과 바이트 같다
     (렌더 쪽 약속은 grid-block.js replaceShellKeepChildren · 지키는 시험 grid-children-shell-bytes).
     빈 그릇이 남는 갈래(자식을 지우거나 끌어낸 직후)는 CSS `.grd-children:empty{display:none}` 로 자리를 안 먹고,
     다음 렌더(편집·로드·rebindAll)에서 걷힌다.
   ★높이는 «흐름»으로 자란다 — 그릇은 .grd-inner 뒤 일반 흐름이라 그리드 상자가 자식만큼 늘어난다(측정 M1, 세 모드).
   ★간격 「블럭 간격」 = data-child-gap(그리드 블럭 dataset · 기본 24 · 0~80 step 2).
     격자↔첫 자식(margin-top)과 자식↔자식(flex column gap)을 «같은 값» 하나로 — 블럭 자체 style 은 안 건드린다.

   ★끌어 넣기 — «사각형»으로 가른다(⛔elementFromPoint 아님: 선택 안 된 프레임 안에서는 pointer-events:none 이라
     프레임 자신이 잡힌다 — 측정 M3 E 3/3). 우선순위:
       ① 포인터가 .grd-inner 사각형 안 → «격자 자리» — 글자 블럭이면 G9(칸의 한 줄) · 아니면 종전(앞/뒤 형제)
       ② 포인터가 그리드 사각형 안이고 .grd-inner 아래(그릇 · 아래 여백 띠 · 임시 띠) → .grd-children 안으로
       ③ 그 밖 → 종전 그대로
     빈 그리드는 «끄는 동안만» 그리드 밑에 임시 띠(화면 ≈24px ÷ 배율 · 떠 있는 상자라 레이아웃을 안 민다)를 세운다. 그리드 밖으로 나가면 걷는다.
     띠를 걷는 자리: 그리드를 벗어난 dragover · 드롭(안 먹었으면) · dragend(Esc 취소 포함) · 창 밖으로 나감(dragleave 좌표가 창 밖).
   ⛔끄는 블럭이 이 그리드를 «품고» 있으면 받지 않는다(자기 안에 자기를 넣기).
   ⛔이 파일은 import 가 없다 — 섹션/프레임 드롭 처리기(section-drag.js · block-drag.js)가 window 로 부른다(G9 와 같은 다리).
═══════════════════════════════════════════════════════════════════════════ */

export const GRID_CHILD_GAP_DEFAULT = 24;
export const GRID_CHILD_GAP_MIN = 0;
export const GRID_CHILD_GAP_MAX = 80;
export const GRID_CHILD_GAP_STEP = 2;
/** 빈 그리드의 «임시 띠» 화면 높이(px) — 캔버스 px 로는 이 값 ÷ 배율(40% 줌에서 얇아지는 병 방지). */
export const GRID_CHILD_STRIP_SCREEN_PX = 24;
const KIDS = 'grd-children';
const STRIP = 'grd-child-strip';

/** 그리드의 직계 그릇(없으면 null). */
export function gridKidsBox(grid) {
  if (!grid || !grid.children) return null;
  for (const ch of grid.children) if (ch.classList.contains(KIDS)) return ch;
  return null;
}
/** 그릇 안 «블럭» 자식(드롭 표시선 제외). */
export function gridKids(grid) {
  const box = gridKidsBox(grid);
  return box ? [...box.children].filter(c => !c.classList.contains('drop-indicator')) : [];
}
/** 「블럭 간격」 값 — 숫자가 아니거나 범위 밖이면 기본값. */
export function gridChildGap(grid) {
  const raw = grid?.dataset?.childGap;
  const n = Number(raw);
  if (raw === undefined || raw === '' || !Number.isFinite(n)) return GRID_CHILD_GAP_DEFAULT;
  return Math.max(GRID_CHILD_GAP_MIN, Math.min(GRID_CHILD_GAP_MAX, Math.round(n)));
}
/** 그릇의 겉모습(간격) — 그릇이 있을 때만. 블럭 자체 style 은 안 건드린다. */
export function applyGridChildGap(grid) {
  const box = gridKidsBox(grid);
  if (!box) return;
  const g = gridChildGap(grid);
  box.style.display = 'flex';
  box.style.flexDirection = 'column';
  box.style.gap = g + 'px';
  box.style.marginTop = g + 'px';
}
/** 그릇을 «있게» 한다(없으면 .grd-inner 뒤에 만든다). ⛔자식을 넣기 «직전»에만 부른다 — 빈 그릇을 남기지 않게. */
export function ensureGridKidsBox(grid) {
  let box = gridKidsBox(grid);
  if (!box) {
    box = document.createElement('div');
    box.className = KIDS;
    grid.appendChild(box);
  }
  applyGridChildGap(grid);
  return box;
}
/** 빈 그릇을 걷는다(요소 자식 0개일 때만). 걷었으면 true. */
export function pruneGridKidsBox(box) {
  if (!box || !box.classList?.contains(KIDS) || box.childElementCount > 0) return false;
  box.remove();
  return true;
}

/* ── C5 칸 표시(끄는 동안 G9 가 받을 칸) — 클래스 하나, CSS 는 editor-blocks.css(새 토큰 0). ── */
const CELL_DROP = 'grd-cell-drop-target';
let _cellMark = null;
function _clearCellDropMark() {
  if (_cellMark) { _cellMark.classList.remove(CELL_DROP); _cellMark = null; }
}

/* ── 임시 띠 ─────────────────────────────────────────────────────────── */
let _strip = null;   // { grid, el }
function _zoom() { return (Number(window.currentZoom) || 40) / 100; }
/* ★띠는 «떠 있는» 상자다(position:absolute · 그리드 바로 밑 top:100%) — 흐름에 끼우면 그리드 행이 띠만큼 길어져
     섹션 처리기의 «행 중간선»이 내려가고, 격자 위에 놓은 비글자 블럭의 앞/뒤 판정이 바뀐다
     (실측: 1행 그리드 85% 지점 에셋이 «뒤 형제» → «앞 형제»로 뒤집혔다 — 측정 M3 D1 이 지키는 동작).
   ⇒ 띠는 자리를 안 먹고 «밑에 걸려» 있다. 그 대신 판정이 그리드 사각형 ∪ 띠 사각형을 본다(gridDropZoneAt). */
function _showStrip(grid) {
  if (_strip && _strip.grid === grid && _strip.el.isConnected) return _strip.el;
  removeGridChildStrip();
  const el = document.createElement('div');
  el.className = `${KIDS} ${STRIP}`;
  el.style.cssText = `position:absolute;left:0;right:0;top:100%;height:${GRID_CHILD_STRIP_SCREEN_PX / _zoom()}px;z-index:5;`;
  grid.appendChild(el);
  _strip = { grid, el };
  return el;
}
/** 그리드의 «잡히는» 사각형 — 띠가 서 있으면 띠까지 합친다. */
function _gridHitRect(g) {
  const r = g.getBoundingClientRect();
  if (!_strip || _strip.grid !== g || !_strip.el.isConnected) return r;
  const s = _strip.el.getBoundingClientRect();
  return { left: Math.min(r.left, s.left), right: Math.max(r.right, s.right), top: Math.min(r.top, s.top), bottom: Math.max(r.bottom, s.bottom), width: r.width, height: r.height + s.height };
}
/** 임시 띠를 걷는다(안에 블럭이 들어갔으면 그건 이미 진짜 그릇이라 안 걷는다). */
export function removeGridChildStrip() {
  if (!_strip) return;
  const { el } = _strip;
  _strip = null;
  if (el.isConnected && el.classList.contains(STRIP)) {
    el.querySelectorAll(':scope > .drop-indicator').forEach(d => d.remove());
    if (el.childElementCount === 0) el.remove();
  }
}
const _inRect = (r, x, y) => x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;

/* ── 판정(사각형) ─────────────────────────────────────────────────────── */
/** 처리기 «container»(.section-inner 또는 흐름/자유 프레임)가 맡는 그리드인가 — 사이에 다른 프레임(글자 래퍼 제외)이 끼면 그 프레임 몫. */
function _ownedBy(grid, container) {
  const owner = grid.parentElement?.closest('.frame-block:not([data-text-frame]), .section-inner');
  return owner === container;
}
/**
 * 포인터 (x,y) 가 container 안 어느 그리드의 어느 자리인가 — 가장 «안쪽» 그리드가 이긴다.
 * @returns {{grid:Element, zone:'inner'|'kids'}|null}
 */
export function gridDropZoneAt(container, x, y, src) {
  if (!container || !container.querySelectorAll) return null;
  let best = null, bestDepth = -1;
  for (const g of container.querySelectorAll('.grid-block')) {
    if (src && (src === g || src.contains(g))) continue;          // 자기 안에 자기를 넣지 않는다
    if (g.dataset.overlayBlock === 'true') continue;               // 떠 있는 그리드는 흐름 드롭 대상이 아니다
    /* 띠는 그리드 «밑»에 걸려 있어 그리드를 품은 프레임 상자 밖으로 나갈 수 있다(그리드가 프레임의 마지막 자식일 때) —
       그때 이벤트는 바깥 처리기(섹션)로 온다. 그래서 «띠 안»이면 소유 대신 «품고 있나»만 본다. */
    const _inStrip = _strip && _strip.grid === g && _strip.el.isConnected && _inRect(_strip.el.getBoundingClientRect(), x, y);
    if (!_inStrip && !_ownedBy(g, container)) continue;
    const gr = _gridHitRect(g);
    if (!gr.width || !gr.height || !_inRect(gr, x, y)) continue;
    let d = 0; for (let p = g.parentElement; p && p !== container; p = p.parentElement) d++;
    if (d <= bestDepth) continue;
    const inner = g.querySelector(':scope > .grd-inner');
    const ir = inner ? inner.getBoundingClientRect() : gr;
    let zone = null;
    if (y >= ir.top && y <= ir.bottom) zone = 'inner';
    else if (y > ir.bottom) zone = 'kids';
    if (!zone) continue;
    best = { grid: g, zone }; bestDepth = d;
  }
  return best;
}

/**
 * dragover(rAF 안, clearDropIndicators «뒤»)에서 부른다. 자식 자리면 표시선을 그릇 안에 그리고 true.
 * 빈 그리드 위면 임시 띠를 세운다(그 틱은 띠 안이 아니면 false — 처리기가 종전 표시선을 그린다).
 */
export function gridChildDragOver(container, x, y, src) {
  _clearCellDropMark();
  const hit = gridDropZoneAt(container, x, y, src);
  if (_strip && (!hit || hit.grid !== _strip.grid)) removeGridChildStrip();
  if (!hit) return false;
  /* ★C5 — 격자 자리에 G9 가 받는 글자를 끌고 있으면 «칸»을 표시하고 섹션 표시선을 안 그린다(true).
     예전엔 칸 위를 지나는 동안 표시선이 그리드 앞/뒤에 그려졌는데 놓으면 칸으로 들어갔다(측정 M3 D2·D3 — 표시가 거짓말).
     판정은 놓기와 «같은» 두 함수(grdTextDropSource · grdCellAtPoint)다. */
  if (hit.zone === 'inner' && window.grdTextDropSource?.(src)) {
    const cell = window.grdCellAtPoint?.(container, x, y, src);
    if (cell) {
      cell.classList.add(CELL_DROP);
      _cellMark = cell;
      let box0 = gridKidsBox(hit.grid);
      if (!box0 || box0.childElementCount === 0) _showStrip(hit.grid);
      return true;
    }
  }
  let box = gridKidsBox(hit.grid);
  if (!box || box.childElementCount === 0) box = _showStrip(hit.grid);
  if (hit.zone !== 'kids') return false;
  const after = window.getDragAfterElement?.(box, y) || null;
  const ind = document.createElement('div');
  ind.className = 'drop-indicator';
  if (after && after.parentElement === box) box.insertBefore(ind, after);
  else box.appendChild(ind);
  return true;
}

/**
 * drop 처리기 «맨 앞»(G9 보다 먼저)에서 부른다. 자식 자리면 넣고 true(처리기는 아무것도 안 한다).
 * 아니면 임시 띠를 걷고 false — 처리기가 종전대로 한다.
 */
export function gridChildDrop(e, container, src) {
  _clearCellDropMark();
  if (!e || !src) { removeGridChildStrip(); return false; }
  const hit = gridDropZoneAt(container, e.clientX, e.clientY, src);
  if (!hit || hit.zone !== 'kids') { removeGridChildStrip(); return false; }
  const grid = hit.grid;
  let box = gridKidsBox(grid) || (_strip && _strip.grid === grid ? _strip.el : null);
  /* ★넣을 자리 = 표시선 자리. 표시선이 없으면(rAF 가 아직 안 돌았으면) 같은 규칙으로 다시 구한다. */
  const ind = box ? box.querySelector(':scope > .drop-indicator') : null;
  let ref = ind ? ind.nextElementSibling : (box ? (window.getDragAfterElement?.(box, e.clientY) || null) : null);
  const fromBox = src.parentElement?.classList?.contains(KIDS) ? src.parentElement : null;
  /* ★이력은 «양쪽 끝»(js/CLAUDE.md) — 시작 표본은 띠·표시선을 걷은 «옛 화면»이어야 한다. */
  box?.querySelectorAll(':scope > .drop-indicator').forEach(d => d.remove());
  const wasStrip = !!(box && box.classList.contains(STRIP));
  if (wasStrip) box.remove();
  _strip = null;
  window.pushHistory?.();
  box = ensureGridKidsBox(grid);
  if (ref === src) ref = src.nextElementSibling;
  if (ref && ref.parentElement === box) box.insertBefore(src, ref);
  else box.appendChild(src);
  if (fromBox && fromBox !== box) pruneGridKidsBox(fromBox);
  window.syncAutoGridWidth?.(src);   // F3 후속 — 그리드를 옮겼으면 자동 폭을 새 자리에 맞춘다
  window.clearDropIndicators?.();
  window.buildLayerPanel?.();
  window.pushHistory?.();
  window.triggerAutoSave?.();
  return true;
}

/* ── 띠가 «끝까지 남는» 길 막기 — dragend(Esc 취소·창 밖 놓기 포함) · 창 밖으로 나감 · 그리드 밖 dragover ── */
if (typeof document !== 'undefined') {
  document.addEventListener('dragend', () => { removeGridChildStrip(); _clearCellDropMark(); }, true);
  document.addEventListener('dragover', (e) => {
    if (!_strip) return;
    if (!_strip.el.isConnected) { _strip = null; return; }
    if (!_inRect(_gridHitRect(_strip.grid), e.clientX, e.clientY)) { removeGridChildStrip(); _clearCellDropMark(); }
  }, true);
  /* 창 밖으로 나감 — ⛔relatedTarget 으로 재지 마라: Chromium 의 dragleave 는 요소 경계마다 relatedTarget=null 이라
     (실측: 그 판정으로는 띠가 세워지자마자 걷혔다) «창 안 경계»와 «창 밖»을 못 가른다. 좌표가 창 가장자리 밖이면 나간 것이다. */
  document.addEventListener('dragleave', (e) => {
    if (!_strip) return;
    if (e.clientX <= 0 || e.clientY <= 0 || e.clientX >= window.innerWidth || e.clientY >= window.innerHeight) removeGridChildStrip();
  }, true);
  document.addEventListener('drop', () => { setTimeout(removeGridChildStrip, 0); }, true);
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    gridKidsBox, gridKids, gridChildGap, applyGridChildGap, ensureGridKidsBox, pruneGridKidsBox,
    gridDropZoneAt, gridChildDragOver, gridChildDrop, removeGridChildStrip,
    GRID_CHILD_GAP_DEFAULT, GRID_CHILD_GAP_MIN, GRID_CHILD_GAP_MAX, GRID_CHILD_GAP_STEP,
  });
}
