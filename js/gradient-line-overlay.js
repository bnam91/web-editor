// gradient-line-overlay.js — MODULE 2 of "Gradient Annotator"
// 배경/채우기가 그라데이션인 블록(banner02 / comparison / shape)을 선택했을 때 캔버스 위에
// 겹쳐 그리는 «피그마식 그라데이션 바».
//
// ★0918 canvasgrad 재구성(현빈 그림 note0918_img0/img1):
//   · 흰 선 1개 + 양 끝 흰 원 손잡이 2개(data-grad-handle=start/end)
//   · 선 위 각 스탑 = 선 옆에 뜬 «네모 색칩»(선 각도만큼 회전, 꼬리가 선을 가리킴).
//     선택 칩 = 파란 테두리. 칩 드래그 중엔 칩 위에 파란 % 라벨.
//   · 칩 드래그 = 선을 따라 그 스탑 offset 변경. 끝 원 드래그 = 방향(각도) 변경 —
//     원은 «실제 렌더되는 끝점»으로 스냅된다(길이는 CSS 규칙이 정한다: 저장 스키마 불변 A안).
//   · 패널(컬러피커) 스탑과 양방향 동기: bindGradientLinePicker(block, inputEl).
//
// 좌표 공간은 어댑터(gradient-model.js registerGradientTarget)의 space 가 정한다:
//   'css'(banner02/comparison) = CSS 그라데이션 선(박스 밖으로 나갈 수 있음, px 공간 각도)
//   'bbox'(shape) = SVG objectBoundingBox 선(정규화 공간 각도).
//
// 공개 API(유지): showGradientLine(block[, {selectedIdx}]) / hideGradientLine(block?) /
//   'gradient-line:change' 이벤트 / .grad-line-overlay 클래스(section-serialize 가 저장 시 제거).
// 신규: setGradientLineSelected(block, idx) / bindGradientLinePicker(block, inputEl) /
//   'gradient-line:select' 이벤트.
import * as _GM from './props/gradient-model.js';

// 모델 헬퍼 해석기 — window.GradientModel 우선, 없으면 정적 import 사용.
function _gm() { return window.GradientModel || _GM || {}; }
const parseGradient = (css) => _gm().parseGradient?.(css);
const toCss         = (model) => _gm().toCss?.(model);

// 화면상 크기(px) — 전부 --inv-zoom 을 곱해 줌 불변
const CHIP_PX = 18;      // 칩 한 변
const CHIP_GAP_PX = 16;  // 선 → 칩 중심 거리
const MOVE_EPS_PX = 2;   // 이만큼 안 움직이면 «클릭»(history 안 쌓음)

// ── self-contained CSS 주입 ───────────────────────────────────────────────────
(function injectStyle() {
  if (document.getElementById('grad-line-overlay-style')) return;
  const st = document.createElement('style');
  st.id = 'grad-line-overlay-style';
  st.textContent = `
.grad-line-overlay{position:absolute;inset:0;pointer-events:none;z-index:120;overflow:visible;}
.grad-line{position:absolute;left:0;top:0;height:calc(1.5px * var(--inv-zoom,1));
  margin-top:calc(-0.75px * var(--inv-zoom,1));background:#fff;transform-origin:0 50%;
  pointer-events:none;box-shadow:0 0 calc(2px * var(--inv-zoom,1)) rgba(0,0,0,0.45);}
.grad-line-end{position:absolute;width:calc(10px * var(--inv-zoom,1));height:calc(10px * var(--inv-zoom,1));
  margin-left:calc(-5px * var(--inv-zoom,1));margin-top:calc(-5px * var(--inv-zoom,1));
  box-sizing:border-box;border-radius:50%;background:#fff;pointer-events:auto;cursor:grab;
  box-shadow:0 0 0 calc(0.5px * var(--inv-zoom,1)) rgba(0,0,0,0.25),0 calc(1px * var(--inv-zoom,1)) calc(3px * var(--inv-zoom,1)) rgba(0,0,0,0.35);
  z-index:121;}
.grad-line-end.is-static{cursor:default;}
.grad-stop-chip{position:absolute;width:calc(${CHIP_PX}px * var(--inv-zoom,1));height:calc(${CHIP_PX}px * var(--inv-zoom,1));
  margin-left:calc(-${CHIP_PX / 2}px * var(--inv-zoom,1));margin-top:calc(-${CHIP_PX / 2}px * var(--inv-zoom,1));
  box-sizing:border-box;border:calc(3px * var(--inv-zoom,1)) solid #fff;border-radius:calc(3px * var(--inv-zoom,1));
  transform-origin:50% 50%;pointer-events:auto;cursor:grab;z-index:122;
  background-color:#fff;
  background-image:linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%),
    linear-gradient(45deg,#ccc 25%,transparent 25%,transparent 75%,#ccc 75%);
  background-size:calc(6px * var(--inv-zoom,1)) calc(6px * var(--inv-zoom,1));
  background-position:0 0,calc(3px * var(--inv-zoom,1)) calc(3px * var(--inv-zoom,1));
  box-shadow:0 calc(1px * var(--inv-zoom,1)) calc(3px * var(--inv-zoom,1)) rgba(0,0,0,0.35);}
.grad-stop-chip-fill{position:absolute;inset:0;border-radius:calc(1px * var(--inv-zoom,1));pointer-events:none;}
/* 꼬리 — 칩 아래(= 선 쪽)를 가리키는 작은 삼각형. 칩 로컬 좌표에서 «아래»가 선 방향이다. */
.grad-stop-chip::after{content:'';position:absolute;left:50%;top:100%;
  margin-left:calc(-4px * var(--inv-zoom,1));margin-top:calc(1px * var(--inv-zoom,1));
  border-left:calc(4px * var(--inv-zoom,1)) solid transparent;border-right:calc(4px * var(--inv-zoom,1)) solid transparent;
  border-top:calc(4px * var(--inv-zoom,1)) solid #fff;pointer-events:none;}
.grad-stop-chip.is-selected{border-color:var(--sel-color,#2d6fe8);z-index:123;}
.grad-stop-chip.is-selected::after{border-top-color:var(--sel-color,#2d6fe8);}
.grad-stop-chip.is-dragging{cursor:grabbing;}
.grad-line-pct{position:absolute;display:none;white-space:nowrap;pointer-events:none;z-index:124;
  padding:calc(2px * var(--inv-zoom,1)) calc(6px * var(--inv-zoom,1));border-radius:calc(9px * var(--inv-zoom,1));
  background:var(--sel-color,#2d6fe8);color:#fff;font:600 calc(11px * var(--inv-zoom,1))/1.2 -apple-system,system-ui,sans-serif;
  transform-origin:50% 50%;}
.grad-line-pct.is-visible{display:block;}
`;
  document.head.appendChild(st);
})();

// 타겟 rect(그라데이션이 실제 칠해지는 영역: banner02=블록 전체, comparison=강조 칼럼)을
// 블록 로컬 px 박스로 환산. 캔버스 줌만 보정(블록 로컬 좌표계 = 줌 적용 전 px).
function _computeBox(blockEl, t) {
  const zoom = (window.currentZoom || 100) / 100;
  const cr = t?.rect?.();
  const br = blockEl.getBoundingClientRect();
  if (!cr || !cr.width || !br.width) {
    return { x: 0, y: 0, w: blockEl.offsetWidth || 1, h: blockEl.offsetHeight || 1 };
  }
  return {
    x: (cr.left - br.left) / zoom,
    y: (cr.top  - br.top)  / zoom,
    w: cr.width  / zoom,
    h: cr.height / zoom,
  };
}
function _applyBox(overlay, box) {
  overlay.style.inset = 'auto';
  overlay.style.left   = box.x + 'px';
  overlay.style.top    = box.y + 'px';
  overlay.style.width  = box.w + 'px';
  overlay.style.height = box.h + 'px';
}

function _invZoom() {
  const z = Number(window.currentZoom);
  if (Number.isFinite(z) && z > 0) return 100 / z;
  const v = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--inv-zoom'));
  return Number.isFinite(v) && v > 0 ? v : 1;
}

function _geomOpts(refs) {
  return { space: refs.target?.space || 'bbox', w: refs.box?.w || 1, h: refs.box?.h || 1 };
}
function _rotationOf(refs) {
  const r = refs.target?.rotation?.();
  return Number.isFinite(r) ? r : 0;
}

// 솔리드 배경(파싱 실패)일 때 시각적 시드용 기본 모델 — 쓰기 전엔 set하지 않는다.
function _seedModel(css) {
  let solid = '#ffffff';
  if (css && !/gradient/i.test(css) && /^#|rgb|hsl/i.test(css.trim())) solid = css.trim();
  return {
    type: 'linear', angle: 180,
    stops: [
      { color: solid, offset: 0, opacity: 1 },
      { color: '#000000', offset: 1, opacity: 1 },
    ],
  };
}

function _stopDisplayColor(s) {
  const c = s.color || '#000000';
  const op = s.opacity == null ? 1 : s.opacity;
  if (op >= 1 || /rgba|hsla/i.test(c)) return c;
  const m = /^#?([0-9a-f]{6})$/i.exec(c.trim());
  if (!m) return c;
  const h = m[1];
  return `rgba(${parseInt(h.slice(0, 2), 16)},${parseInt(h.slice(2, 4), 16)},${parseInt(h.slice(4, 6), 16)},${op})`;
}

// 정렬 사본으로 CSS — 드래그 중엔 refs.model.stops 순서를 고정하므로 쓰기만 정렬해서 한다.
function _cssFor(model) {
  const stops = model.stops.map(s => ({ ...s })).sort((a, b) => (a.offset || 0) - (b.offset || 0));
  return toCss({ ...model, stops });
}

// ── 렌더 ───────────────────────────────────────────────────────────────────────
function _ensureChips(refs) {
  const n = refs.model.stops.length;
  // 개수가 같으면 노드 재사용(childList 변이 최소화 → autosave 옵저버 자극 방지)
  while (refs.chips.length > n) refs.chips.pop().remove();
  while (refs.chips.length < n) {
    const chip = document.createElement('div');
    chip.className = 'grad-stop-chip';
    const fill = document.createElement('div');
    fill.className = 'grad-stop-chip-fill';
    chip.appendChild(fill);
    refs.overlay.insertBefore(chip, refs.pct);
    const idx = refs.chips.length;
    chip.dataset.gradStop = String(idx);
    refs.chips.push(chip);
    _bindChipDrag(refs.block, chip);
  }
}

function _render(block) {
  const refs = block._gradLine;
  if (!refs) return;
  const o = _geomOpts(refs);
  const W = o.w, H = o.h;
  const gm = _gm();
  const ln = gm.gradientLine(refs.model, o);
  refs.line = ln;
  const p0 = { x: ln.p0.x * W, y: ln.p0.y * H };
  const p1 = { x: ln.p1.x * W, y: ln.p1.y * H };

  // 선
  const dx = p1.x - p0.x, dy = p1.y - p0.y;
  const len = Math.hypot(dx, dy);
  const ang = Math.atan2(dy, dx) * 180 / Math.PI;
  refs.lineEl.style.left = p0.x + 'px';
  refs.lineEl.style.top = p0.y + 'px';
  refs.lineEl.style.width = len + 'px';
  refs.lineEl.style.transform = `rotate(${ang}deg)`;

  // 끝 원
  refs.start.style.left = p0.x + 'px';
  refs.start.style.top = p0.y + 'px';
  refs.end.style.left = p1.x + 'px';
  refs.end.style.top = p1.y + 'px';
  refs.start.classList.toggle('is-static', !!ln.radial);
  refs.end.classList.toggle('is-static', !!ln.radial);

  // 칩
  _ensureChips(refs);
  const n = refs.model.stops.length;
  if (!(refs.selectedIdx >= 0 && refs.selectedIdx < n)) refs.selectedIdx = Math.max(0, Math.min(n - 1, refs.selectedIdx | 0));
  const d = CHIP_GAP_PX * _invZoom();
  refs.model.stops.forEach((s, i) => {
    const chip = refs.chips[i];
    const pl = gm.chipPlacement(p0, p1, s.offset, d);
    chip.style.left = pl.x + 'px';
    chip.style.top = pl.y + 'px';
    chip.style.transform = `rotate(${pl.rotDeg}deg)`;
    chip.firstChild.style.background = _stopDisplayColor(s);
    chip.classList.toggle('is-selected', i === refs.selectedIdx);
    chip.dataset.gradStop = String(i);
  });
  _placePct(refs);
}

function _placePct(refs) {
  const i = refs.dragIdx;
  if (i == null || !refs.chips[i]) { refs.pct.classList.remove('is-visible'); return; }
  const chip = refs.chips[i];
  const s = refs.model.stops[i];
  refs.pct.textContent = Math.round((s.offset || 0) * 100) + '%';
  refs.pct.classList.add('is-visible');
  refs.pct.style.left = chip.style.left;
  refs.pct.style.top = chip.style.top;
  // 칩 중심에서 «화면 위쪽»으로 — 회전 도형이면 역회전해 항상 똑바로
  const rot = _rotationOf(refs);
  refs.pct.style.transform =
    `translate(-50%,-50%) rotate(${-rot}deg) translateY(calc(-${CHIP_PX / 2 + 14}px * var(--inv-zoom,1)))`;
}

// 클라이언트 좌표 → 타겟 박스 정규화 좌표. 회전 도형은 블록 중심 기준 역회전.
function _clientToLocal(block, ev) {
  const refs = block._gradLine;
  const box = refs.box;
  const rot = _rotationOf(refs);
  if (rot) {
    const bw = block.offsetWidth || box.w, bh = block.offsetHeight || box.h;
    const br = block.getBoundingClientRect();
    const rad = rot * Math.PI / 180;
    const c = Math.abs(Math.cos(rad)), s = Math.abs(Math.sin(rad));
    const aabbW = bw * c + bh * s;
    const zoom = aabbW > 0 ? br.width / aabbW : 1;
    const cx = br.left + br.width / 2, cy = br.top + br.height / 2;
    const vx = (ev.clientX - cx) / zoom, vy = (ev.clientY - cy) / zoom;
    // 역회전 R(-rot)
    const lx = vx * Math.cos(-rad) - vy * Math.sin(-rad) + bw / 2;
    const ly = vx * Math.sin(-rad) + vy * Math.cos(-rad) + bh / 2;
    return { x: (lx - box.x) / (box.w || 1), y: (ly - box.y) / (box.h || 1) };
  }
  const or = refs.overlay.getBoundingClientRect();
  return {
    x: (ev.clientX - or.left) / (or.width || 1),
    y: (ev.clientY - or.top) / (or.height || 1),
  };
}

function _emit(block, name, detail) {
  block.dispatchEvent(new CustomEvent(name, { bubbles: true, detail }));
}
function _changeDetail(refs, css, commit) {
  const sorted = refs.model.stops.map(s => ({ color: s.color, offset: s.offset, opacity: s.opacity == null ? 1 : s.opacity }))
    .sort((a, b) => a.offset - b.offset);
  const selectedIdx = _gm().sortedIndexOf(refs.model.stops, refs.selectedIdx);
  return { css, commit, source: 'canvas', type: refs.model.type, angle: refs.model.angle, stops: sorted, selectedIdx };
}

// 드래그 공통 골격 — 이동량이 MOVE_EPS_PX 미만이면 «클릭»: 쓰기도 history 도 안 한다.
function _startDrag(e, onMoveLocal, onEnd) {
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const onMove = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < MOVE_EPS_PX) return;
    moved = true;
    onMoveLocal(ev);
  };
  const onUp = () => {
    document.removeEventListener('mousemove', onMove, true);
    document.removeEventListener('mouseup', onUp, true);
    // ★드래그 뒤 브라우저가 쏘는 click(대상 = mousedown·mouseup 공통 조상 = 블록/캔버스)을 삼킨다.
    //   안 삼키면 에디터가 블록을 «다시 선택» → 속성 패널 재렌더 → 열린 피커의 대상 input 이
    //   떨어져 나가 캔버스→피커 동기가 끊긴다(9504 실앱 실측, 0918).
    if (moved) _swallowNextClick();
    onEnd(moved);
  };
  document.addEventListener('mousemove', onMove, true);
  document.addEventListener('mouseup', onUp, true);
}

function _swallowNextClick() {
  const kill = (ev) => { ev.stopImmediatePropagation(); ev.stopPropagation(); ev.preventDefault(); cleanup(); };
  const cleanup = () => { window.removeEventListener('click', kill, true); clearTimeout(tm); };
  const tm = setTimeout(cleanup, 300);
  window.addEventListener('click', kill, true);
}
// 칩·끝 원을 «클릭만» 했을 때도 click 이 블록 선택 핸들러로 새지 않게(같은 재렌더 이유).
document.addEventListener('click', (ev) => {
  if (ev.target?.closest?.('.grad-line-overlay')) { ev.stopImmediatePropagation(); ev.stopPropagation(); }
}, true);

function _swallow(e) {
  e.preventDefault();
  e.stopImmediatePropagation();
  e.stopPropagation();
}

function _bindChipDrag(block, chip) {
  chip.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    _swallow(e);
    const refs = block._gradLine;
    if (!refs) return;
    const i = Number(chip.dataset.gradStop);
    const stop = refs.model.stops[i];
    if (!stop) return;
    if (refs.selectedIdx !== i) {
      refs.selectedIdx = i;
      _render(block);
    }
    _emit(block, 'gradient-line:select', { selectedIdx: _gm().sortedIndexOf(refs.model.stops, i), source: 'canvas' });
    const target = refs.target;
    chip.classList.add('is-dragging');
    refs.dragging = true;
    _startDrag(e, (ev) => {
      const P = _clientToLocal(block, ev);
      stop.offset = _gm().offsetOnLine(refs.line, P, _geomOpts(refs));
      refs.dragIdx = refs.model.stops.indexOf(stop);
      const css = _cssFor(refs.model);
      target.set(css, false);
      _render(block);
      _emit(block, 'gradient-line:change', _changeDetail(refs, css, false));
    }, (moved) => {
      chip.classList.remove('is-dragging');
      refs.dragging = false;
      refs.dragIdx = null;
      if (moved) {
        refs.selectedIdx = _gm().sortStopsKeepSelection(refs.model.stops, refs.model.stops.indexOf(stop));
        const css = _cssFor(refs.model);
        target.set(css, true);
        _render(block);
        _emit(block, 'gradient-line:change', _changeDetail(refs, css, true));
      } else {
        _placePct(refs);
      }
    });
  });
}

function _bindEndDrag(block, handle, which) {
  handle.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    _swallow(e);
    const refs = block._gradLine;
    if (!refs || refs.model.type === 'radial') return;
    const target = refs.target;
    refs.dragging = true;
    _startDrag(e, (ev) => {
      const P = _clientToLocal(block, ev);
      let a = _gm().angleFromDrag({ x: 0.5, y: 0.5 }, P, _geomOpts(refs));
      if (which === 'start') a += 180;
      refs.model.angle = Math.round(((a % 360) + 360) % 360) % 360;
      const css = _cssFor(refs.model);
      target.set(css, false);
      _render(block);
      _emit(block, 'gradient-line:change', _changeDetail(refs, css, false));
    }, (moved) => {
      refs.dragging = false;
      if (!moved) return;
      const css = _cssFor(refs.model);
      target.set(css, true);
      _render(block);
      _emit(block, 'gradient-line:change', _changeDetail(refs, css, true));
    });
  });
}

// ── public: showGradientLine ──────────────────────────────────────────────────
function showGradientLine(blockEl, opts = {}) {
  if (!blockEl) return;
  const t = window.getGradientTarget?.(blockEl);
  if (!t) return;

  const css = t.get?.();
  let g = parseGradient(css);
  if (!g) g = _seedModel(css); // 솔리드: 시각 시드만, 쓰기 X

  let refs = blockEl._gradLine;
  if (refs && refs.overlay && refs.overlay.isConnected && blockEl.contains(refs.overlay)) {
    // 재호출 — 드래그 중엔 자기 모델을 유지(외부 재파싱이 드래그 중인 스탑 순서를 흔들지 않게)
    if (!refs.dragging) refs.model = g;
    refs.target = t;
    refs.box = _computeBox(blockEl, t);
    _applyBox(refs.overlay, refs.box);
    if (Number.isFinite(opts.selectedIdx)) refs.selectedIdx = opts.selectedIdx;
    _render(blockEl);
    return;
  }

  // 신규 마운트
  const overlay = document.createElement('div');
  overlay.className = 'grad-line-overlay';
  overlay.dataset.gradLine = '1';

  const lineEl = document.createElement('div');
  lineEl.className = 'grad-line';
  const start = document.createElement('div');
  start.className = 'grad-line-end grad-line-start';
  start.dataset.gradHandle = 'start';
  const end = document.createElement('div');
  end.className = 'grad-line-end grad-line-finish';
  end.dataset.gradHandle = 'end';
  const pct = document.createElement('div');
  pct.className = 'grad-line-pct';

  overlay.appendChild(lineEl);
  overlay.appendChild(start);
  overlay.appendChild(end);
  overlay.appendChild(pct);
  blockEl.appendChild(overlay); // blockEl은 이미 position:relative

  const box = _computeBox(blockEl, t);
  _applyBox(overlay, box);

  refs = blockEl._gradLine = {
    block: blockEl, overlay, lineEl, start, end, pct, chips: [],
    model: g, target: t, box, line: null,
    selectedIdx: Number.isFinite(opts.selectedIdx) ? opts.selectedIdx : 0,
    dragIdx: null, dragging: false,
  };
  _bindEndDrag(blockEl, start, 'start');
  _bindEndDrag(blockEl, end, 'end');
  _render(blockEl);
}

// ── public: setGradientLineSelected ─────────────────────────────────────────
// idx 는 «정렬된» 스탑 인덱스(패널/피커 관례). 드래그 중이 아니면 모델도 정렬돼 있어 같다.
function setGradientLineSelected(blockEl, idx) {
  const refs = blockEl?._gradLine;
  if (!refs || !Number.isFinite(idx)) return;
  if (refs.dragging) return;
  const n = refs.model.stops.length;
  refs.selectedIdx = Math.max(0, Math.min(n - 1, idx | 0));
  _render(blockEl);
}

// ── public: hideGradientLine ──────────────────────────────────────────────────
function hideGradientLine(blockEl) {
  const clear = (b) => {
    b.querySelectorAll(':scope > .grad-line-overlay').forEach(o => o.remove());
    delete b._gradLine;
  };
  if (blockEl) { clear(blockEl); return; }
  document.querySelectorAll('.grad-line-overlay').forEach(o => {
    const host = o.parentElement;
    o.remove();
    if (host) delete host._gradLine;
  });
}

// ── public: bindGradientLinePicker — 캔버스 바 ↔ 컬러피커 양방향 배선 한 곳 ─────────
// 캔버스→패널: inputEl.dataset.cpGradient(재오픈 시드) 갱신 + 열린 피커 UI 동기(emit 없이 → 루프 없음)
// 패널→캔버스: 피커의 선택 스탑(goya-cp:gradient / goya-cp:gradient-select detail.selectedIdx)
function _modelJson(g) {
  return JSON.stringify({ type: g.type, angle: g.angle, stops: g.stops });
}
function bindGradientLinePicker(blockEl, inputEl) {
  if (!blockEl || !inputEl) return;
  blockEl._gradPickerInput = inputEl;
  // 재오픈 시드 — 저장된 그라데이션으로(없으면 건드리지 않음)
  const t = window.getGradientTarget?.(blockEl);
  const g = t ? parseGradient(t.get?.()) : null;
  if (g) { try { inputEl.dataset.cpGradient = _modelJson(g); } catch (_) {} }

  if (inputEl._gradLinePickerWired) return;
  inputEl._gradLinePickerWired = true;
  const onSel = (e) => {
    const idx = e.detail?.selectedIdx;
    if (!Number.isFinite(idx)) return;
    const b = blockEl.isConnected ? blockEl : null;
    if (b && b._gradPickerInput === inputEl) setGradientLineSelected(b, idx);
  };
  inputEl.addEventListener('goya-cp:gradient', onSel);
  inputEl.addEventListener('goya-cp:gradient-select', onSel);
}

function _pickerInputFor(block) {
  const inp = block?._gradPickerInput;
  return inp && inp.isConnected ? inp : null;
}
document.addEventListener('gradient-line:change', (e) => {
  if (e.detail?.source !== 'canvas') return;
  const block = e.target;
  const inp = _pickerInputFor(block);
  if (!inp) return;
  const g = { type: e.detail.type, angle: e.detail.angle, stops: e.detail.stops };
  try { inp.dataset.cpGradient = _modelJson(g); } catch (_) {}
  window.syncPickerGradient?.(inp, g, { selectedIdx: e.detail.selectedIdx });
});
document.addEventListener('gradient-line:select', (e) => {
  const block = e.target;
  const inp = _pickerInputFor(block);
  if (!inp || !block._gradLine) return;
  const m = block._gradLine.model;
  const sorted = m.stops.map(s => ({ ...s })).sort((a, b) => a.offset - b.offset);
  window.syncPickerGradient?.(inp, { type: m.type, angle: m.angle, stops: sorted }, { selectedIdx: e.detail.selectedIdx });
});

window.showGradientLine = showGradientLine;
window.hideGradientLine = hideGradientLine;
window.setGradientLineSelected = setGradientLineSelected;
window.bindGradientLinePicker = bindGradientLinePicker;

export { showGradientLine, hideGradientLine, setGradientLineSelected, bindGradientLinePicker };
