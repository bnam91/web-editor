// mesh-corner-overlay.js — t4-03 ㉠ 섹션 메시 그라데이션의 «모서리 점»(캔버스에서 바로 고친다).
//   점 = 그 겹의 중심(끌면 이동 · −20…120%) · 고른 점의 □ = 반지름 rx·ry(10…200% · 100% = 상자 폭·높이)
//   더블클릭 = 패널의 그 모서리 색 칸 피커 · Delete = 고른 모서리 자리만 기본값 · Esc = 고른 모서리 풀기.
//   값은 prop-section.js setMeshCornerGeo 한 자리가 쓰고 그린다(data-bg-mesh-geo). 스톱은 패널 막대 그대로.
// 붙이는 자리·동기화는 gradient-line-overlay.js 와 같다: #canvas-scaler 끝의 포털(섹션 안에 붙이면 자식 블록 밑에 깔린다),
//   rAF 로 상자를 따라가고, 크기는 --inv-zoom 을 곱한다. 끌기 한 번 = ⌘Z 한 걸음(beginDragHistory).
const SQ2 = Math.SQRT2;
const BAND = 10;   // section-bottom-handle 높이(캔버스 px · css/section-bottom-handle.css) — 아래 두 점은 그 띠 위로 비켜 그린다

(function injectStyle() {
  if (document.getElementById('mesh-corner-overlay-style')) return;
  const st = document.createElement('style');
  st.id = 'mesh-corner-overlay-style';
  /* 점 = 컬러피커 스톱 썸(.goya-cp-grad-thumb) 꼴 · 색은 선택 토큰 */
  st.textContent = `
.mesh-corner-overlay{position:absolute;pointer-events:none;z-index:120;overflow:visible;}
.mesh-corner-dot{position:absolute;width:calc(14px * var(--inv-zoom,1));height:calc(14px * var(--inv-zoom,1));
  margin:calc(-7px * var(--inv-zoom,1)) 0 0 calc(-7px * var(--inv-zoom,1));box-sizing:border-box;border-radius:50%;
  border:calc(2px * var(--inv-zoom,1)) solid #fff;pointer-events:auto;cursor:grab;
  box-shadow:0 0 0 calc(1px * var(--inv-zoom,1)) rgba(0,0,0,.5),0 calc(1px * var(--inv-zoom,1)) calc(4px * var(--inv-zoom,1)) rgba(0,0,0,.5);}
.mesh-corner-dot:hover,.mesh-corner-dot.is-hover{box-shadow:0 0 0 calc(1px * var(--inv-zoom,1)) var(--sel-color),0 calc(1px * var(--inv-zoom,1)) calc(4px * var(--inv-zoom,1)) rgba(0,0,0,.5);}
.mesh-corner-dot.is-sel{border-color:var(--sel-color);transform:scale(1.2);z-index:1;}
.mesh-corner-rad{position:absolute;width:calc(9px * var(--inv-zoom,1));height:calc(9px * var(--inv-zoom,1));
  margin:calc(-4.5px * var(--inv-zoom,1)) 0 0 calc(-4.5px * var(--inv-zoom,1));box-sizing:border-box;background:#fff;
  border:calc(1.5px * var(--inv-zoom,1)) solid var(--sel-color);pointer-events:auto;cursor:nwse-resize;z-index:1;}
.mesh-corner-ring{position:absolute;box-sizing:border-box;border-radius:50%;pointer-events:none;
  border:calc(1px * var(--inv-zoom,1)) dashed var(--sel-color);}
.sec-mesh-stops.is-mesh-active,.prop-color-row.is-mesh-active{box-shadow:inset 2px 0 0 var(--sel-color);}
`;
  document.head.appendChild(st);
})();

let S = null;   // { sec, ov, dots[], rad, ring, sel, hover, raf, key, dragging }

const KEYS = ['tl', 'tr', 'br', 'bl'];   // = MESH_CORNERS 순서
function _scale(host) {
  const w = host.getBoundingClientRect().width;
  return host.offsetWidth > 0 && w > 0 ? w / host.offsetWidth : 1;
}
function _meshOn(sec) { return !!(sec && !sec.dataset.bgImg && window.meshCornersOf?.(sec.dataset.bgMesh)); }

function hideMeshCorners() {
  if (!S) return;
  cancelAnimationFrame(S.raf);
  S.ov.remove();
  _panelMark(null, 'is-mesh-active');
  S = null;
}

function _panelMark(k, cls) {
  document.querySelectorAll('[data-mesh-corner].' + cls).forEach((el) => el.classList.remove(cls));
  if (k) document.querySelectorAll(`[data-mesh-corner="${k}"]`).forEach((el) => el.classList.add(cls));
}

function _render() {
  const { sec, ov } = S;
  const host = ov.parentElement;
  const s = _scale(host), inv = 1 / s;
  const hr = host.getBoundingClientRect(), br = sec.getBoundingClientRect();
  const w = sec.offsetWidth, h = sec.offsetHeight;
  ov.style.left = (br.left - hr.left) / s + 'px';
  ov.style.top = (br.top - hr.top) / s + 'px';
  ov.style.width = w + 'px';
  ov.style.height = h + 'px';
  const geo = window.meshGeoOf(sec);
  const corners = window.meshCornersOf(sec.dataset.bgMesh);
  const r = 8 * inv;
  S.pts = geo.map((g, i) => {
    const x = g.x / 100 * w;
    let y = g.y / 100 * h;
    if (y + r > h - BAND && y - r < h) y = h - BAND - r;   // 지디 위험 대응 — 바닥 높이 손잡이 띠와 겹치지 않게 안쪽으로(값은 그대로)
    const d = S.dots[i];
    d.style.left = x + 'px';
    d.style.top = y + 'px';
    d.style.background = corners[i][0].color;
    d.classList.toggle('is-sel', S.sel === i);
    d.classList.toggle('is-hover', S.hover === i && S.sel !== i);
    return { x, y };
  });
  const i = S.sel;
  S.rad.hidden = S.ring.hidden = i == null;
  if (i != null) {
    const g = geo[i], cx = g.x / 100 * w, cy = g.y / 100 * h, rx = g.rx / 100 * w, ry = g.ry / 100 * h;
    // □ = 타원 위 45° 자리(상자 가운데 쪽) — 끌면 rx·ry 가 따로 움직인다
    S.rad.style.left = cx + (g.x <= 50 ? 1 : -1) * rx / SQ2 + 'px';
    S.rad.style.top = cy + (g.y <= 50 ? 1 : -1) * ry / SQ2 + 'px';
    Object.assign(S.ring.style, { left: cx - rx + 'px', top: cy - ry + 'px', width: 2 * rx + 'px', height: 2 * ry + 'px' });
  }
}

function _tick() {
  S.raf = 0;
  const sec = S.sec;
  if (!sec.isConnected || !sec.classList.contains('selected') || !_meshOn(sec) || !S.ov.isConnected) { hideMeshCorners(); return; }
  const br = sec.getBoundingClientRect();
  const key = [br.left, br.top, br.width, br.height, sec.offsetWidth, sec.offsetHeight, sec.dataset.bgMesh, sec.dataset.bgMeshGeo, S.sel, S.hover].join('|');
  if (key !== S.key) { S.key = key; _render(); }
  S.raf = requestAnimationFrame(_tick);
}

function _swallow(e) { e.preventDefault(); e.stopImmediatePropagation(); e.stopPropagation(); }

function _local(ev) {
  const r = S.ov.getBoundingClientRect();
  return { x: (ev.clientX - r.left) / (r.width || 1) * 100, y: (ev.clientY - r.top) / (r.height || 1) * 100 };
}

function _drag(e, onMove) {
  const sec = S.sec;
  const hist = window.beginDragHistory?.('메시 모서리');
  const x0 = e.clientX, y0 = e.clientY;
  let moved = false;
  const mv = (ev) => {
    if (!moved && Math.hypot(ev.clientX - x0, ev.clientY - y0) < 2) return;
    if (!S || S.sec !== sec) return;   // 끌기 중 ⌘Z·해제로 점이 걷혔다
    if (!moved) { moved = true; hist?.arm(ev.clientX - x0, ev.clientY - y0); }
    onMove(ev);
  };
  const up = () => {
    document.removeEventListener('mousemove', mv, true);
    document.removeEventListener('mouseup', up, true);
    if (!moved) return;
    window.swallowNextClick?.({ immediate: true, untilMousedown: true });
    if (hist?.armed) window.pushHistory?.('메시 모서리');
  };
  document.addEventListener('mousemove', mv, true);
  document.addEventListener('mouseup', up, true);
}

function _select(i) {
  S.sel = i;
  _panelMark(i == null ? null : KEYS[i], 'is-mesh-active');
  S.key = null;
}

function showMeshCorners(sec) {
  if (!_meshOn(sec) || !sec.classList.contains('selected')) { if (S?.sec === sec) hideMeshCorners(); return; }
  const host = sec.closest('#canvas-scaler');
  if (!host) return;
  if (S && S.sec === sec && S.ov.isConnected) {
    S.key = null;
    _panelMark(S.sel == null ? null : KEYS[S.sel], 'is-mesh-active');   // 패널을 다시 그렸으면 강조를 다시
    return;
  }
  hideMeshCorners();
  const ov = document.createElement('div');
  ov.className = 'mesh-corner-overlay';
  const ring = document.createElement('div'); ring.className = 'mesh-corner-ring'; ov.appendChild(ring);
  const dots = KEYS.map((k, i) => {
    const d = document.createElement('div');
    d.className = 'mesh-corner-dot';
    d.dataset.meshCorner = k;
    d.addEventListener('mousedown', (e) => {
      if (e.button !== 0) return;
      _swallow(e);
      _select(i);
      _drag(e, (ev) => { const p = _local(ev); const g = window.meshGeoOf(sec)[i]; window.setMeshCornerGeo(sec, i, { ...g, x: p.x, y: p.y }); });
    });
    d.addEventListener('mouseenter', () => { if (S) { S.hover = i; } });
    d.addEventListener('mouseleave', () => { if (S && S.hover === i) S.hover = null; });
    ov.appendChild(d);
    return d;
  });
  const rad = document.createElement('div');
  rad.className = 'mesh-corner-rad';
  rad.addEventListener('mousedown', (e) => {
    if (e.button !== 0 || S?.sel == null) return;
    _swallow(e);
    const i = S.sel;
    _drag(e, (ev) => {
      const p = _local(ev), g = window.meshGeoOf(sec)[i];
      window.setMeshCornerGeo(sec, i, { ...g, rx: Math.abs(p.x - g.x) * SQ2, ry: Math.abs(p.y - g.y) * SQ2 });
    });
  });
  ov.appendChild(rad);
  host.appendChild(ov);
  S = { sec, ov, dots, rad, ring, sel: null, hover: null, raf: 0, key: null };
  _tick();
}

// 점·□ 의 click/dblclick 이 섹션·자식 블록 선택으로 새지 않게 · 더블클릭 = 그 모서리 색 칸의 피커
document.addEventListener('click', (ev) => { if (ev.target?.closest?.('.mesh-corner-overlay')) _swallow(ev); }, true);
document.addEventListener('dblclick', (ev) => {
  const d = ev.target?.closest?.('.mesh-corner-dot');
  if (!d && !ev.target?.closest?.('.mesh-corner-overlay')) return;
  _swallow(ev);
  const sw = d && document.getElementById(`sec-mesh-${d.dataset.meshCorner}-color`)?.closest('.prop-color-swatch');
  if (sw) window.openGoyaColorPicker?.(sw);
}, true);
// 점 밖을 누르면 고른 모서리를 푼다(섹션 선택은 그대로)
document.addEventListener('mousedown', (ev) => {
  if (S?.sel != null && !ev.target?.closest?.('.mesh-corner-overlay, [data-mesh-corner], .goya-cp-popover')) _select(null);
}, true);
// 패널 모서리 줄 hover → 점 hover
document.addEventListener('mouseover', (ev) => {
  if (!S) return;
  const row = ev.target?.closest?.('[data-mesh-corner]:not(.mesh-corner-dot)');
  const i = row ? KEYS.indexOf(row.dataset.meshCorner) : -1;
  if (row || S.hoverFromPanel) { S.hover = i < 0 ? null : i; S.hoverFromPanel = !!row; }
});
function _editable(t) { return !!t && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName)); }
window.addEventListener('keydown', (ev) => {
  if (S?.sel == null || _editable(ev.target) || _editable(document.activeElement)) return;
  if (ev.key === 'Escape') { _swallow(ev); _select(null); return; }
  if (ev.key !== 'Delete' && ev.key !== 'Backspace') return;
  _swallow(ev);   // 섹션 삭제로 새지 않게 — 모서리는 지울 수 없고 자리만 기본값
  const before = S.sec.dataset.bgMeshGeo;
  window.setMeshCornerGeo(S.sec, S.sel, null);
  if (S.sec.dataset.bgMeshGeo !== before) window.pushHistory?.('메시 모서리 초기화');
}, true);

window.showMeshCorners = showMeshCorners;
window.hideMeshCorners = hideMeshCorners;
