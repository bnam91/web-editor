// gradient-line-overlay.js — MODULE 2 of "Gradient Annotator"
// 배경/채우기가 그라데이션인 블록(banner02 / comparison / shape)을 선택했을 때 캔버스 위에
// 겹쳐 그리는 «피그마식 그라데이션 바».
//
// ★0918 canvasgrad 재구성(현빈 그림 note0918_img0/img1):
//   · 흰 선 1개 + 양 끝 흰 원 손잡이 2개(data-grad-handle=start/end)
//   · 선 위 각 스탑 = 선 옆에 뜬 «네모 색칩»(선 각도만큼 회전, 꼬리가 선을 가리킴).
//     선택 칩 = 파란 테두리. 칩 드래그 중엔 칩 위에 파란 % 라벨.
//   · 칩 드래그 = 선을 따라 그 스탑 offset 변경. 끝 원 드래그 = 방향·길이·위치 자유(박스 밖 허용, 클램프 없음).
//     ★현빈 «추가 2»: 저장 스키마(각도+스탑 %)는 그대로 두고, 끈 선(view) 기준으로 각도와 스탑 %를
//     다시 계산한다(0% 미만·100% 초과 허용) → 도형 안에는 그 구간만 보인다. 원은 끈 자리에 머문다.
//   · 칩 선택 상태에서 Backspace/Delete = 스탑 삭제(3개 이상일 때). 블록 삭제로 새지 않는다.
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
const parseGradientStrict = (css) => (_gm().parseGradientStrict || _GM.parseGradientStrict)?.(css);
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
.grad-line-portal{position:absolute;left:0;top:0;pointer-events:none;z-index:120;overflow:visible;transform-origin:50% 50%;}
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
/* ★0920b textgrad-bar: 블럭이 «글자 편집 중»이면 바는 비켜선다(조작부만 통과시킨다).
   끝 원·칩은 pointer-events:auto 라 글자 위에 겹치면 그 자리의 캐럿·드래그선택을 가져간다
   (실측: tb-h1 영역의 1.23%, 가로 그라데이션에서 끝 원은 «항상» 첫 글자/끝 글자 위). 편집 중엔
   글자가 이긴다 — 보이기는 하되(옅게) 못 잡는다. 편집을 빠져나오면 바로 돌아온다. */
.grad-line-overlay.is-muted{opacity:.35;}
.grad-line-overlay.is-muted .grad-line-end,
.grad-line-overlay.is-muted .grad-stop-chip{pointer-events:none;cursor:default;}
`;
  document.head.appendChild(st);
})();

// 타겟 rect(그라데이션이 실제 칠해지는 영역: banner02=블록 전체, comparison=강조 칼럼)을
// 블록 로컬 px 박스로 환산. 캔버스 줌만 보정(블록 로컬 좌표계 = 줌 적용 전 px).
// ★0918r2(T-060) 줌 전환: window.currentZoom 은 applyZoom 이 «즉시» 새 값으로 바꾸지만 화면의
//   #canvas-scaler 는 transition .15s 동안 보간 중이다 → 그 사이에 재면 화면 px ÷ «새» 줌 = 틀린 박스.
//   그래서 «지금 실제로 적용된» 배율(_hostScale)로 나눈다. 도형(bbox)은 크기를 레이아웃 박스
//   (offsetWidth/Height = 캔버스 단위)에서 바로 쓴다 — 어댑터 rect() 는 크기를 currentZoom 으로 곱해
//   주므로 전환 중엔 실측 배율과 어긋난다(어댑터 계약 «화면 px» 는 그대로 둔다).
function _hostScale(blockEl, host) {
  const h = host || _hostFor(blockEl);
  if (h && h.offsetWidth > 0) {
    const w = h.getBoundingClientRect().width;
    if (w > 0) return w / h.offsetWidth;
  }
  const z = Number(window.currentZoom);
  return (Number.isFinite(z) && z > 0 ? z : 100) / 100;
}
function _computeBox(blockEl, t) {
  const zoom = _hostScale(blockEl);
  const cr = t?.rect?.();
  const br = blockEl.getBoundingClientRect();
  if (!cr || !cr.width || !br.width) {
    return { x: 0, y: 0, w: blockEl.offsetWidth || 1, h: blockEl.offsetHeight || 1 };
  }
  const layoutSize = t?.space === 'bbox' && blockEl.offsetWidth > 0 && blockEl.offsetHeight > 0;
  return {
    x: (cr.left - br.left) / zoom,
    y: (cr.top  - br.top)  / zoom,
    w: layoutSize ? blockEl.offsetWidth  : cr.width  / zoom,
    h: layoutSize ? blockEl.offsetHeight : cr.height / zoom,
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

// 화면 바(view) — 이 세션에서 끈 끝점을 기억한다(block._gradView, 저장 안 됨). 저장값이 바뀌었으면
// (외부 편집·undo) 기억을 버리고 저장값에서 유도(defaultView).
function _viewOf(refs) {
  const o = _geomOpts(refs);
  if (refs.model.type === 'radial') { const l = _gm().gradientLine(refs.model, o); return { p0: l.p0, p1: l.p1 }; }
  return refs.view || _gm().defaultView(refs.model, o);
}
// ★0920b textgrad-bar: «기억»의 동치 판정은 글자 비교가 아니라 «표준형 키»로 한다.
//   저장소가 dataset 문자열인 블럭(도형)은 쓴 글자가 그대로 돌아오지만, 인라인 스타일인 블럭(글자
//   그라데이션)은 브라우저가 되읽을 때 정규화한다 — `#1a1a1a`→`rgb(26, 26, 26)`,
//   `rgba(26,26,26,0.000)`→`rgba(26, 26, 26, 0)`. 글자로 견주면 텍스트에선 기억이 «절대» 안 맞아
//   블럭을 다시 고를 때마다 끈 끝점이 표준 길이로 튀었다(0920b 이벨류 실측: 끝 원 800,190 → 846,153).
//   ⇒ 모델로 풀어 색을 브라우저 표준형으로 바꿔 견준다. 값이 진짜로 달라지면(외부 편집·undo) 여전히 불일치.
const _colorProbe = typeof document !== 'undefined' ? document.createElement('span') : null;
function _canonColor(c) {
  const raw = String(c == null ? '' : c);
  if (!_colorProbe) return raw;
  try {
    _colorProbe.style.color = '';
    _colorProbe.style.color = raw;
    return _colorProbe.style.color || raw;   // 파싱 실패(var() 등)면 원문 그대로 — 최소한 옛 거동
  } catch (_) { return raw; }
}
function _viewKey(css) {
  const g = parseGradient(css);
  if (!g) return 'raw:' + String(css == null ? '' : css).replace(/\s+/g, '');
  const stops = g.stops.map(s => `${_canonColor(s.color)}@${Math.round((s.offset || 0) * 1000)}`).join(',');
  return `${g.type}|${Math.round(g.angle == null ? 180 : g.angle)}|${stops}`;
}
function _rememberView(refs, css) {
  if (refs.view) refs.block._gradView = { css, key: _viewKey(css), view: { p0: { ...refs.view.p0 }, p1: { ...refs.view.p1 } } };
}
function _recalledView(block, css) {
  const v = block._gradView;
  if (!v) return null;
  const k = v.key != null ? v.key : _viewKey(v.css);   // 옛 스냅샷(키 없음) 호환
  return k === _viewKey(css) ? { p0: { ...v.view.p0 }, p1: { ...v.view.p1 } } : null;
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
  const view = _viewOf(refs);
  refs.line = view;
  refs.map = ln.radial ? { a: 0, b: 1 } : gm.viewMap(refs.model, view, o);
  const p0 = { x: view.p0.x * W, y: view.p0.y * H };
  const p1 = { x: view.p1.x * W, y: view.p1.y * H };

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
    const tv = ((s.offset || 0) - refs.map.a) / refs.map.b; // canon offset → view 위 상대 위치
    const pl = gm.chipPlacement(p0, p1, tv, d);
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
    _setChipActive(refs, true);
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
      // view 위 위치(0~1, 끝점 사이) → 저장(canon) offset. 1% 단위(저장 CSS 와 표시값 일치).
      const tv = Math.max(0, Math.min(1, _gm().projectT(refs.line, P, _geomOpts(refs))));
      stop.offset = Math.round((refs.map.a + refs.map.b * tv) * 100) / 100;
      refs.dragIdx = refs.model.stops.indexOf(stop);
      const css = _cssFor(refs.model);
      target.set(css, false);
      _render(block);
      _emit(block, 'gradient-line:change', _changeDetail(refs, css, false));
    }, (moved) => {
      chip.classList.remove('is-dragging');
      refs.dragging = false;
      refs.portalKey = null; // 드래그 중 막아 둔 동기화를 한 번 돌린다(줌이 바뀌었을 수 있음)
      refs.dragIdx = null;
      if (moved) {
        refs.selectedIdx = _gm().sortStopsKeepSelection(refs.model.stops, refs.model.stops.indexOf(stop));
        const css = _cssFor(refs.model);
        refs.view = _viewOf(refs);
        _rememberView(refs, css);
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
    _setChipActive(refs, false);
    // 드래그 시작 시점의 view 와 각 스탑의 view 상대 위치(rel)를 고정 — 끝점만 옮기고 다시 계산한다.
    const view0 = _viewOf(refs);
    const map0 = refs.map || { a: 0, b: 1 };
    const rel = refs.model.stops.map(s => ((s.offset || 0) - map0.a) / map0.b);
    _startDrag(e, (ev) => {
      const P = _clientToLocal(block, ev); // 클램프 없음 — 박스 밖 허용
      const o = _geomOpts(refs);
      const view = which === 'end'
        ? { p0: { ...view0.p0 }, p1: { x: P.x, y: P.y } }
        : { p0: { x: P.x, y: P.y }, p1: { ...view0.p1 } };
      // 두 끝점이 거의 겹치면(방향 불정) 무시
      if (Math.hypot((view.p1.x - view.p0.x) * o.w, (view.p1.y - view.p0.y) * o.h) < 4) return;
      const res = _gm().applyView(view, rel, o);
      refs.model.angle = res.angle;
      refs.model.stops.forEach((s, i) => { s.offset = res.offsets[i]; });
      refs.view = view;
      const css = _cssFor(refs.model);
      _rememberView(refs, css);
      target.set(css, false);
      _render(block);
      _emit(block, 'gradient-line:change', _changeDetail(refs, css, false));
    }, (moved) => {
      refs.dragging = false;
      refs.portalKey = null; // 드래그 중 막아 둔 동기화를 한 번 돌린다(줌이 바뀌었을 수 있음)
      if (!moved) return;
      const css = _cssFor(refs.model);
      _rememberView(refs, css);
      target.set(css, true);
      _render(block);
      _emit(block, 'gradient-line:change', _changeDetail(refs, css, true));
    });
  });
}

// ── 포털(0918 리뷰 high — 겹침 순서) ─────────────────────────────────────────────
// 예전엔 오버레이를 블록 «안»에 붙였다. 그런데 .shape-block.selected 는 z-index:2 로 스태킹
// 컨텍스트를 만들고, 뒤에 오는 형제(텍스트 블록 = 무조건 z-index:2, 오버레이 텍스트 = 80)가
// DOM 순서로 이긴다 → 도형 밖으로 끈 선·끝 원·칩이 그 형제 «밑»에 깔려 다시 잡을 수 없었다
// (실측: elementFromPoint = tb-body). 블록 안에선 z-index 를 아무리 올려도 그 컨텍스트를 못 벗는다.
// ⇒ 캔버스 줌 래퍼(#canvas-scaler) 맨 끝의 «포털» 층에 붙이고, 블록의 레이아웃 박스(중심·크기·
//   자기 회전)를 그대로 흉내 낸다. 줌·스크롤은 래퍼가 같이 움직여 주고, 블록 이동·리사이즈는
//   rAF 동기화가 따라간다. 블록 자체의 z-index 는 건드리지 않는다(편집 중 겹침 순서가 거짓말하면 안 됨).
// ⚠️한계: 블록 «조상»의 회전·배율(줌 제외)은 흉내 내지 않는다(selection-overlay P0 와 같은 한계).
// #canvas-scaler 가 없는 문서(단위 하네스 등)는 예전처럼 블록 안에 붙인다.
const HOST_SELECTOR = '#canvas-scaler';
function _hostFor(blockEl) {
  return blockEl.closest?.(HOST_SELECTOR) || null;
}
function _blockOfOverlay(o) {
  return o?._gradBlock || o?.parentElement || null;
}
function _syncPortal(refs) {
  const portal = refs.portal;
  if (!portal) return;
  const block = refs.block;
  const host = portal.parentElement;
  if (!host) return;
  const hr = host.getBoundingClientRect();
  const s = _hostScale(block, host);
  const br = block.getBoundingClientRect();
  const bw = block.offsetWidth || br.width / s;
  const bh = block.offsetHeight || br.height / s;
  // 자기 transform 의 «선형 부분»만(평행이동은 중심 맞춤으로 이미 반영된다)
  let lin = '';
  const tf = getComputedStyle(block).transform;
  if (tf && tf !== 'none') {
    try {
      const m = new DOMMatrixReadOnly(tf);
      if (!(m.a === 1 && m.b === 0 && m.c === 0 && m.d === 1)) lin = `matrix(${m.a},${m.b},${m.c},${m.d},0,0)`;
    } catch (_) {}
  }
  const cx = (br.left + br.width / 2 - hr.left) / s;
  const cy = (br.top + br.height / 2 - hr.top) / s;
  // ★0918r2(T-060): 배율(s)도 키에 넣는다 — 줌만 바뀌면 cx·cy·bw·bh 가 캔버스 단위라 그대로여서
  //   재렌더가 안 돌고, JS 가 줌을 곱해 둔 칩-선 간격(CHIP_GAP_PX × invZoom)이 옛 줌에 멈췄다
  //   (9504 실측: ⌘0 40→100 뒤 칩 거리 40px = 16×2.5). 전환 .15s 동안은 매 프레임, 끝 프레임에서 정확값.
  const key = [cx, cy, bw, bh, lin, s.toFixed(4)].map(v => typeof v === 'number' ? v.toFixed(2) : v).join('|');
  if (refs.portalKey === key) return false;
  refs.portalKey = key;
  portal.style.left = (cx - bw / 2) + 'px';
  portal.style.top = (cy - bh / 2) + 'px';
  portal.style.width = bw + 'px';
  portal.style.height = bh + 'px';
  portal.style.transform = lin;
  return true;
}
function _boxSame(a, b) {
  return !!a && !!b
    && Math.abs(a.x - b.x) < 0.01 && Math.abs(a.y - b.y) < 0.01
    && Math.abs(a.w - b.w) < 0.01 && Math.abs(a.h - b.h) < 0.01;
}
function _startPortalLoop(refs) {
  if (!refs.portal || refs.portalRaf) return;
  const tick = () => {
    refs.portalRaf = 0;
    if (refs.block._gradLine !== refs || !refs.portal.isConnected) return;
    if (!refs.block.isConnected) { hideGradientLine(refs.block); return; }
    const moved = _syncPortal(refs);
    // ★0920b textgrad-bar: 포털 키(=블럭 기하)만 보면 «칠해지는 영역»이 블럭과 다른 타깃을 놓친다.
    //   글자 그라데이션은 contentEl 배경에 칠해지는데 좌우 패딩은 contentEl 폭만 줄이고 블럭 폭은
    //   그대로라, 블럭을 고른 채 패딩을 바꾸면 키가 안 변해 바가 «옛 폭»에 남았다(실측: L 패딩 64 →
    //   양쪽 64px 씩 삐져나옴, 끝 원이 칠 영역 밖에 서고 칩 offset 이 잘못된 폭 기준으로 계산됨).
    //   ⇒ 타깃 박스를 매 프레임 직접 재고 «달라졌을 때» 다시 그린다(드래그 중엔 자기 모델 유지).
    if (!refs.dragging) {
      const box = _computeBox(refs.block, refs.target);
      if (moved || !_boxSame(refs.box, box)) {
        refs.box = box;
        _applyBox(refs.overlay, refs.box);
        _render(refs.block);
      }
    }
    // ★0920b textgrad-bar: 글자 편집 중이면 조작부를 비활성(위 .is-muted CSS). 클래스 토글만 한다.
    const editing = refs.block.classList.contains('editing');
    if (editing !== refs.muted) {
      refs.muted = editing;
      refs.overlay.classList.toggle('is-muted', editing);
    }
    refs.portalRaf = requestAnimationFrame(tick);
  };
  refs.portalRaf = requestAnimationFrame(tick);
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
  if (refs && refs.overlay && refs.overlay.isConnected
      && (refs.portal ? refs.portal.contains(refs.overlay) : blockEl.contains(refs.overlay))) {
    // 재호출 — 드래그 중엔 자기 모델을 유지(외부 재파싱이 드래그 중인 스탑 순서를 흔들지 않게)
    if (!refs.dragging) {
      refs.model = g;
      refs.view = _recalledView(blockEl, css); // 우리가 쓴 값 그대로면 끈 끝점 유지, 아니면 유도
    }
    refs.target = t;
    if (refs.portal) { refs.portalKey = null; _syncPortal(refs); }
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
  overlay._gradBlock = blockEl;

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
  // 남은 옛 오버레이(다른 경로로 떨어진 것) 정리 후 마운트
  hideGradientLine(blockEl);
  const host = _hostFor(blockEl);
  let portal = null;
  if (host) {
    portal = document.createElement('div');
    portal.className = 'grad-line-portal';
    portal._gradBlock = blockEl;
    portal.appendChild(overlay);
    host.appendChild(portal);
  } else {
    blockEl.appendChild(overlay); // blockEl은 이미 position:relative
  }

  refs = blockEl._gradLine = {
    block: blockEl, overlay, portal, portalKey: null, portalRaf: 0, muted: false, lineEl, start, end, pct, chips: [],
    model: g, target: t, box: null, line: null, map: null, view: _recalledView(blockEl, css), chipActive: false,
    selectedIdx: Number.isFinite(opts.selectedIdx) ? opts.selectedIdx : 0,
    dragIdx: null, dragging: false,
  };
  if (portal) _syncPortal(refs);
  refs.box = _computeBox(blockEl, t);
  _applyBox(overlay, refs.box);
  _bindEndDrag(blockEl, start, 'start');
  _bindEndDrag(blockEl, end, 'end');
  _render(blockEl);
  _startPortalLoop(refs);
  _avoidPicker(blockEl);
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
    const refs = b._gradLine;
    if (refs?.portalRaf) cancelAnimationFrame(refs.portalRaf);
    refs?.portal?.remove();
    b.querySelectorAll(':scope > .grad-line-overlay').forEach(o => o.remove());
    document.querySelectorAll('.grad-line-portal').forEach(p => { if (p._gradBlock === b) p.remove(); });
    delete b._gradLine;
  };
  if (blockEl) { clear(blockEl); return; }
  document.querySelectorAll('.grad-line-overlay').forEach(o => {
    const b = _blockOfOverlay(o);
    if (b && b._gradLine) clear(b);
    o.remove();
  });
  document.querySelectorAll('.grad-line-portal').forEach(p => p.remove());
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
  // T-059 2라운드: 피커 문법이 아닌 값은 시드하지 않는다(color-picker wireColorField 와 같은 기준 — 잘못 읽힌 시드는 편집 한 번에 값을 망침)
  const g = t ? parseGradientStrict(t.get?.()) : null;
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

// ── 칩 «포커스» + Backspace/Delete = 스탑 삭제 ─────────────────────────────────────
// 칩을 누르면 그 바가 키 입력 대상이 된다. 다른 곳을 누르면 해제. 이 동안 Backspace/Delete 는
// 블록 삭제(에디터 keydown)로 새지 않고, 스탑이 3개 이상이면 선택 스탑을 지운다(2개면 무시 — 피그마와 같음).
function _setChipActive(refs, on) {
  refs.chipActive = !!on;
  refs.overlay.classList.toggle('is-chip-active', !!on);
}
document.addEventListener('mousedown', (ev) => {
  if (ev.target?.closest?.('.grad-line-overlay')) return;
  document.querySelectorAll('.grad-line-overlay.is-chip-active').forEach(o => {
    const r = _blockOfOverlay(o)?._gradLine;
    if (r) _setChipActive(r, false); else o.classList.remove('is-chip-active');
  });
}, true);
function _isEditableTarget(t) {
  if (!t || t === document.body) return false;
  if (t.isContentEditable) return true;
  const tag = t.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
}
window.addEventListener('keydown', (ev) => {
  if (ev.key !== 'Backspace' && ev.key !== 'Delete') return;
  if (_isEditableTarget(ev.target) || _isEditableTarget(document.activeElement)) return;
  const ov = document.querySelector('.grad-line-overlay.is-chip-active');
  const block = _blockOfOverlay(ov);
  const refs = block?._gradLine;
  if (!refs || !refs.chipActive) return;
  ev.preventDefault();
  ev.stopImmediatePropagation();
  ev.stopPropagation();
  if (refs.dragging || refs.model.stops.length <= 2) return;
  const i = Math.max(0, Math.min(refs.model.stops.length - 1, refs.selectedIdx | 0));
  refs.model.stops.splice(i, 1);
  refs.selectedIdx = Math.min(i, refs.model.stops.length - 1);
  const css = _cssFor(refs.model);
  refs.view = _viewOf(refs);
  _rememberView(refs, css);
  refs.target.set(css, true);
  _render(block);
  _emit(block, 'gradient-line:change', _changeDetail(refs, css, true));
}, true);

// ── 열린 컬러피커가 바(끝 원·칩)를 가리면 피커를 옆으로 비킨다 ─────────────────────────
function _avoidPicker(blockEl) {
  const refs = blockEl?._gradLine;
  const pop = document.querySelector('.goya-cp-popover');
  if (!refs || refs.dragging || !pop || pop.hidden) return false;
  const els = [refs.start, refs.end, ...refs.chips];
  let U = null;
  for (const el of els) {
    const r = el.getBoundingClientRect();
    if (!r.width && !r.height) continue;
    U = U ? { l: Math.min(U.l, r.left), t: Math.min(U.t, r.top), r: Math.max(U.r, r.right), b: Math.max(U.b, r.bottom) }
          : { l: r.left, t: r.top, r: r.right, b: r.bottom };
  }
  if (!U) return false;
  const pad = 12;
  U = { l: U.l - pad, t: U.t - pad, r: U.r + pad, b: U.b + pad };
  const P = pop.getBoundingClientRect();
  const hit = !(P.right <= U.l || P.left >= U.r || P.bottom <= U.t || P.top >= U.b);
  if (!hit) return false;
  const vw = window.innerWidth, vh = window.innerHeight, g = 8;
  const cands = [
    { x: U.r, y: P.top }, { x: U.l - P.width, y: P.top },
    { x: P.left, y: U.b }, { x: P.left, y: U.t - P.height },
  ];
  for (const c of cands) {
    const y = Math.max(g, Math.min(vh - P.height - g, c.y));
    if (c.x >= g && c.x + P.width <= vw - g && y >= g && y + P.height <= vh - g) {
      const nr = { left: c.x, right: c.x + P.width, top: y, bottom: y + P.height };
      if (nr.right <= U.l || nr.left >= U.r || nr.bottom <= U.t || nr.top >= U.b) {
        pop.style.left = c.x + 'px';
        pop.style.top = y + 'px';
        return true;
      }
    }
  }
  return false;
}
// 피커가 열릴 때(openPicker 가 goya-cp:opened 발행) — 그 피커의 대상 블록 바를 가리지 않게
document.addEventListener('goya-cp:opened', (e) => {
  const inp = e.detail?.input;
  document.querySelectorAll('.grad-line-overlay').forEach(o => {
    const b = _blockOfOverlay(o);
    if (b?._gradLine && (!inp || b._gradPickerInput === inp)) _avoidPicker(b);
  });
});

window.showGradientLine = showGradientLine;
window.hideGradientLine = hideGradientLine;
window.setGradientLineSelected = setGradientLineSelected;
window.bindGradientLinePicker = bindGradientLinePicker;
window._gradLineAvoidPicker = _avoidPicker;

export { showGradientLine, hideGradientLine, setGradientLineSelected, bindGradientLinePicker };
