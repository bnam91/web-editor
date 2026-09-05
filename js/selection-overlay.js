/* ═══════════════════════════════════════════════════════════════════════════
   selection-overlay.js — 선택 테두리를 «오버레이 층»에서 그린다 (울트라플랜 P0)
   ───────────────────────────────────────────────────────────────────────────
   설계 정본: _context/PLAN-selection-overlay.md (A1·A2·A3)

   ★왜 옮기나 — 현빈 2026-09-06 제보 세 건이 «한 뿌리»다.
     ⑴ 맞닿은 이웃이 아웃라인을 «덮는다»       ⑵ 아웃라인이 이웃 위에 «얹힌다»
     ⑶ 맞닿은 둘을 선택하면 경계가 «2px» 이 된다(착시가 아니라 실제 2배)
   셋 다 «선택 표시가 문서 레이아웃과 같은 좌표계·같은 페인트 순서에 있기» 때문이다.
   ⑴은 z-index 로 때웠고(6461a28), ⑵·⑶은 그 방식으로 못 고친다.

   ★⛔울트라플랜의 「옮기면 셋 다 해결」은 «틀렸다» — ⑶은 페인트 층이 아니라 «기하» 문제다.
     두 상자가 «각자» 선을 가지면 옮겨도 두 줄이 붙는다. ⇒ 유일한 해법 =
     안쪽 1px + «맞닿은 변 구간»의 중복제거(dedupe). 이 요구가 도구를 결정했다:
     div/border/box-shadow 는 변의 «일부»를 못 지운다 → SVG path.

   ★이 파일이 «하지 않는» 것 (구조적 결정 — 되돌리지 마라)
     · 블록 이름 목록을 두지 않는다. `#canvas .selected` 일반 질의뿐이다.
       (「목록으로 관리되는 규칙은 새 블록이 생길 때 조용히 빠진다」 — 이 저장소에서
        오늘 하루에만 세 번 났다: 텍스트프레임 래퍼 · .cvb-card-ph · z-index 17종.)
     · 좌표를 직접 계산하지 않는다. `_cornerScreen` 을 «호출»한다. 베끼면 핸들과 갈라진다.

   ⛔P0 의 «알려진 퇴행» — 회전한 «조상» 안의 자식
     `_cornerScreen` 은 el 자신의 dataset 회전만 본다. 45° 프레임 안의 자식은 AABB 가
     나와 오늘(CSS outline, 자식과 «함께» 회전)보다 «나쁘다». P1 에서 조상 누적행렬로 푼다.
     여기서는 최소한 «감지»해서 그 상자를 dedupe 에서 빼둔다(틀린 폴리곤으로 남의 변을
     지우면 두 배로 나쁘다).
═══════════════════════════════════════════════════════════════════════════ */
import { CORNER_DIRS, _cornerScreen, _canvasScaleNow } from './overlay-handles.js';

const SVG_NS = 'http://www.w3.org/2000/svg';

/* ★오버레이가 «그리지 않는» 것 — CSS 중화 규칙의 :not() 과 «같아야» 한다.
 *   (섹션은 ::after 로 z-index 90 에 이미 자기 층을 갖고 있고, .col 은 선택 표시가 없다.)
 *   ⇒ 이 동치는 tests/unit/selection-overlay-scope.test.mjs 가 «검사로» 고정한다. */
export const SKIP_SELECTOR = '.section-block, .col';
/* 텍스트 계열은 «자기»가 아니라 부모 상자가 표시 단위다(CSS 의 .row:has / text-frame:has 판과 동일).
 *   ⚠️파리티: col 개선은 이번 범위 밖 — CSS 가 row 를 쓰므로 여기서도 row 다. */
const TEXT_SELECTOR = '.text-block, .speech-bubble-block';
const TEXT_HOST_SELECTOR = '.frame-block[data-text-frame="true"], .row';

/* 맞닿음 판정 임계(스크린 CSS px).
 * ⚠️10% 축소에서 «문서상 10px 떨어진» 두 상자가 화면상 1px 이 되어 «거짓 맞닿음»이 된다.
 *   그래도 1px 을 쓰는 이유: 그 상황에서 선을 지우든 남기든 화면상 차이가 1px 이라
 *   사람 눈에 같다. 반대로 임계를 줄이면 «진짜 맞닿음»을 100% 에서 놓친다(그건 보인다). */
const TOUCH_EPS = 1.0;

let _layer = null;
let _mo = null;
let _raf = null;
let _dirty = true;
let _targets = [];
let _active = false;

/* ── 층 ──────────────────────────────────────────────────────────────────── */
function _ensureLayer() {
  if (_layer && _layer.isConnected) return _layer;
  const ov = document.getElementById('ss-handles-overlay');
  if (!ov) return null;
  _layer = document.createElementNS(SVG_NS, 'svg');
  _layer.setAttribute('class', 'ss-sel-layer');
  _layer.setAttribute('aria-hidden', 'true');
  // 핸들(.ss-resize-handle 등 z-index:1)보다 «아래»에 오도록 맨 앞에 넣는다.
  ov.insertBefore(_layer, ov.firstChild);
  return _layer;
}

function _clear() {
  if (_layer) _layer.replaceChildren();
}

/* ── 대상 집합 ───────────────────────────────────────────────────────────── */
function _hostOf(el) {
  if (el.matches(TEXT_SELECTOR)) return el.closest(TEXT_HOST_SELECTOR) || el;
  return el;
}

/* ★색은 «호스트 조상»으로 결정한다 — 블록 이름표로 분기하지 않는다.
 *   에셋 오버레이 안(어두운 이미지 위)은 파랑이 안 보여 흰 점선이 «의도»다(editor-layout.css M57-b).
 *   ⚠️보라(스티커/그라데이션)만은 조상이 없어 클래스로 본다 — 이건 «층»이 아니라 «블록의 정체성»이라
 *     조상으로 환원할 수 없다. 그래도 목록이 아니라 «두 클래스»이고, 빠져도 파랑으로 그려질 뿐 사라지지 않는다. */
function _variantOf(host) {
  if (host.closest('.asset-overlay')) return 'overlay';
  if (host.classList.contains('sticker-block') || host.classList.contains('gradient-block')) return 'sticker';
  return '';
}

function _collect() {
  const canvas = document.getElementById('canvas');
  if (!canvas) return [];
  const out = [];
  const seen = new Set();
  // querySelectorAll 은 «문서 순서»를 돌려준다 — 아래 dedupe 의 「DOM 뒤」 판정이 이 순서에 기댄다.
  for (const el of canvas.querySelectorAll('.selected')) {
    if (el.matches(SKIP_SELECTOR)) continue;
    const host = _hostOf(el);
    if (!host || seen.has(host)) continue;
    if (!canvas.contains(host)) continue;   // closest 가 캔버스 밖으로 나갔으면 버린다
    seen.add(host);
    out.push({ el: host, variant: _variantOf(host) });
  }
  return out;
}

/* ── 기하 ────────────────────────────────────────────────────────────────── */
/** 반픽셀 스냅 — 1px 선의 «중심»을 픽셀 격자 가운데로. 회전 상자에는 쓰지 않는다. */
const _snap = v => Math.round(v - 0.5) + 0.5;

/** 상자 하나의 기하. 좌표는 «핸들과 같은 함수»(_cornerScreen)에서만 나온다. */
function _geomOf(el) {
  const [nw, ne, sw, se] = CORNER_DIRS.map(d => _cornerScreen(el, d, 0.5));
  const axis = Math.abs(nw.y - ne.y) < 0.02 && Math.abs(sw.y - se.y) < 0.02
            && Math.abs(nw.x - sw.x) < 0.02 && Math.abs(ne.x - se.x) < 0.02;
  if (!axis) return { rot: true, pts: [nw, ne, se, sw] };
  // inset 0.5 를 되돌린 «상자 자신»의 변 — 맞닿음 판정은 이 생값으로 한다
  // (스냅한 선 좌표로 재면 맞닿은 두 변이 항상 1.0 떨어져 보인다).
  const raw = { l: nw.x - 0.5, t: nw.y - 0.5, r: se.x + 0.5, b: se.y + 0.5 };
  return {
    rot: false, raw,
    L: _snap(nw.x), T: _snap(nw.y), R: _snap(se.x), B: _snap(se.y),
  };
}

/** ★위험1 감지 — 회전한 «조상» 안의 자식은 _cornerScreen 이 AABB 를 준다.
 *  미회전 상자의 화면 크기는 offsetW/H × 캔버스배율과 «정확히» 같아야 한다. 어긋나면 조상 회전이다.
 *  P0 에서는 그 상자를 dedupe 에서 «뺀다» — 틀린 폴리곤으로 이웃의 변을 지우면 두 배로 나쁘다. */
function _isNestedRotated(el, g, scale) {
  if (g.rot) return false;
  const ow = el.offsetWidth * scale, oh = el.offsetHeight * scale;
  if (!ow || !oh) return false;
  return Math.abs((g.raw.r - g.raw.l) - ow) > 1 || Math.abs((g.raw.b - g.raw.t) - oh) > 1;
}

/* ── 변 구간 산술 ────────────────────────────────────────────────────────── */
function _edgesOf(g) {
  return {
    top:    [[g.L, g.R]],
    bottom: [[g.L, g.R]],
    left:   [[g.T, g.B]],
    right:  [[g.T, g.B]],
  };
}
/** 구간 목록에서 [c,d] 를 뺀다. 부분 겹침이면 «남는 구간만» 남는다. */
export function subtractInterval(ivs, c, d) {
  const out = [];
  for (const [a, b] of ivs) {
    if (d <= a || c >= b) { out.push([a, b]); continue; }
    if (c > a) out.push([a, c]);
    if (d < b) out.push([d, b]);
  }
  return out;
}

/* ★dedupe — 맞닿은 «변 구간»의 중복 한 줄을 지운다(증상 ⑶ 의 유일한 해법).
 *   ⛔O(N²) 를 피한다: 맞닿으려면 두 변의 좌표가 1px 안이어야 하므로 round(좌표)로 버킷팅해
 *   후보를 ±1 세 칸에서만 꺼낸다(N≈200 select-all 이 사실상 O(N)).
 *   회전 상자·조상회전 상자는 참여하지 않는다. */
function _dedupe(items) {
  const byB = new Map(), byT = new Map(), byR = new Map(), byL = new Map();
  const put = (m, k, i) => { const a = m.get(k); a ? a.push(i) : m.set(k, [i]); };
  items.forEach((it, i) => {
    if (!it.dedupable) return;
    put(byB, Math.round(it.g.raw.b), i);
    put(byT, Math.round(it.g.raw.t), i);
    put(byR, Math.round(it.g.raw.r), i);
    put(byL, Math.round(it.g.raw.l), i);
  });
  const near = (m, v) => {
    const k = Math.round(v);
    return [...(m.get(k - 1) || []), ...(m.get(k) || []), ...(m.get(k + 1) || [])];
  };
  // 「DOM 뒤 상자에서 뺀다」 — q 를 돌면서 «자기보다 앞선» p 하고만 비교하면 그 규약이 그대로 성립한다.
  items.forEach((q, qi) => {
    if (!q.dedupable) return;
    const qg = q.g;
    for (const pi of near(byB, qg.raw.t)) {          // p 가 «위», q 의 윗변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.b - qg.raw.t) >= TOUCH_EPS) continue;
      const c = Math.max(pg.L, qg.L), d = Math.min(pg.R, qg.R);
      if (d > c) q.edges.top = subtractInterval(q.edges.top, c, d);
    }
    for (const pi of near(byT, qg.raw.b)) {          // p 가 «아래», q 의 아랫변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.t - qg.raw.b) >= TOUCH_EPS) continue;
      const c = Math.max(pg.L, qg.L), d = Math.min(pg.R, qg.R);
      if (d > c) q.edges.bottom = subtractInterval(q.edges.bottom, c, d);
    }
    for (const pi of near(byR, qg.raw.l)) {          // p 가 «왼쪽», q 의 왼변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.r - qg.raw.l) >= TOUCH_EPS) continue;
      const c = Math.max(pg.T, qg.T), d = Math.min(pg.B, qg.B);
      if (d > c) q.edges.left = subtractInterval(q.edges.left, c, d);
    }
    for (const pi of near(byL, qg.raw.r)) {          // p 가 «오른쪽», q 의 오른변이 중복
      if (pi >= qi) continue;
      const pg = items[pi].g;
      if (Math.abs(pg.raw.l - qg.raw.r) >= TOUCH_EPS) continue;
      const c = Math.max(pg.T, qg.T), d = Math.min(pg.B, qg.B);
      if (d > c) q.edges.right = subtractInterval(q.edges.right, c, d);
    }
  });
}

const _n = v => (Math.round(v * 100) / 100);
function _pathData(it) {
  if (it.g.rot) {
    const p = it.g.pts;
    return `M${_n(p[0].x)} ${_n(p[0].y)}L${_n(p[1].x)} ${_n(p[1].y)}L${_n(p[2].x)} ${_n(p[2].y)}L${_n(p[3].x)} ${_n(p[3].y)}Z`;
  }
  const g = it.g, e = it.edges;
  let d = '';
  for (const [a, b] of e.top)    d += `M${_n(a)} ${g.T}L${_n(b)} ${g.T}`;
  for (const [a, b] of e.bottom) d += `M${_n(a)} ${g.B}L${_n(b)} ${g.B}`;
  for (const [a, b] of e.left)   d += `M${g.L} ${_n(a)}L${g.L} ${_n(b)}`;
  for (const [a, b] of e.right)  d += `M${g.R} ${_n(a)}L${g.R} ${_n(b)}`;
  return d;
}

/* ── 프레임 ──────────────────────────────────────────────────────────────── */
function _build() {
  const scale = _canvasScaleNow();
  const items = [];
  for (const t of _targets) {
    // ★매 프레임 isConnected — undo/redo·협업 sync 가 outerHTML 을 통째로 갈아끼운다.
    //   죽은 노드를 들고 있으면 «유령 상자»가 화면에 남는다(핸들 루프와 같은 방어).
    if (!t.el.isConnected) return null;
    const g = _geomOf(t.el);
    if (!g.rot && (g.raw.r - g.raw.l < 0.5 || g.raw.b - g.raw.t < 0.5)) continue; // 접힌/숨은 상자
    const it = { el: t.el, variant: t.variant, g, edges: g.rot ? null : _edgesOf(g) };
    it.dedupable = !g.rot && !_isNestedRotated(t.el, g, scale);
    items.push(it);
  }
  if (items.length > 1) _dedupe(items);
  return items;
}

function _render(items) {
  const layer = _ensureLayer();
  if (!layer) return;
  const kids = layer.childNodes;
  for (let i = 0; i < items.length; i++) {
    let p = kids[i];
    if (!p) { p = document.createElementNS(SVG_NS, 'path'); layer.appendChild(p); }
    const cls = 'ss-sel-path'
      + (items[i].variant ? ` ss-sel-path--${items[i].variant}` : '')
      + (items[i].g.rot ? ' is-rot' : '');
    if (p.getAttribute('class') !== cls) p.setAttribute('class', cls);
    const d = _pathData(items[i]);
    if (p.getAttribute('d') !== d) p.setAttribute('d', d);
  }
  while (kids.length > items.length) layer.removeChild(layer.lastChild);
}

function _frame() {
  _raf = null;
  if (!_active) return;
  if (_dirty) { _dirty = false; _targets = _collect(); }
  let items = _build();
  if (items === null) {           // 죽은 노드를 만났다 → 집합을 다시 잡고 이 프레임에서 바로 복구
    _targets = _collect();
    items = _build() || [];
  }
  _render(items);
  if (items.length) _raf = requestAnimationFrame(_frame);   // 집합이 비면 루프 정지(MO 가 다시 깨운다)
}

function _kick() {
  if (!_active) return;
  if (_raf == null) _raf = requestAnimationFrame(_frame);
}

/* ── 수명 ────────────────────────────────────────────────────────────────── */
export function initSelectionOverlay() {
  if (_active) return true;
  if (!window.SEL_OVERLAY_ENABLED) return false;
  const canvas = document.getElementById('canvas');
  if (!canvas || !document.getElementById('ss-handles-overlay')) return false;
  if (!_ensureLayer()) return false;
  // ⛔선택 변경 «이벤트가 없다»(.selected 를 바꾸는 자리 116곳). ResizeObserver·IntersectionObserver
  //   는 스크롤·transform 을 못 본다. ⇒ MO 로 «집합이 바뀌었다»만 받고, 위치는 rAF 가 좇는다.
  _mo = new MutationObserver(() => { _dirty = true; _kick(); });
  _mo.observe(canvas, { attributes: true, attributeFilter: ['class'], childList: true, subtree: true });
  _active = true;
  // ★body 클래스는 «여기»에서 붙는다 — 초기화가 성공한 «뒤». 위에서 하나라도 실패해 돌아가면
  //   클래스가 안 붙고 CSS 중화가 안 걸려 문서 outline 이 그대로 산다(제품이 성립한다).
  document.body.classList.add('sel-ov');
  _kick();
  return true;
}

export function stopSelectionOverlay() {
  _active = false;
  if (_mo) { _mo.disconnect(); _mo = null; }
  if (_raf != null) { cancelAnimationFrame(_raf); _raf = null; }
  _targets = [];
  _clear();
  document.body.classList.remove('sel-ov');
}

try {
  const ok = initSelectionOverlay();
  // 계측·QA 진입점(창 밖 인스턴스에서 CDP 로 상태를 «재는» 자리). 제품 코드는 이걸 안 쓴다.
  window.__selOverlay = {
    init: initSelectionOverlay,
    stop: stopSelectionOverlay,
    get active() { return _active; },
    get layer() { return _layer; },
    targets: () => _targets.map(t => t.el),
    build: () => { _targets = _collect(); return _build(); },
  };
  if (!ok) console.warn('[sel-overlay] 초기화 안 함 — 문서 outline 이 그대로 쓰인다(플래그 OFF 또는 DOM 미존재)');
} catch (e) {
  // ★실패하면 «반드시» 원상복구한다. 중화 CSS 가 걸린 채 오버레이가 안 그려지면 선택 표시가 «사라진다».
  document.body.classList.remove('sel-ov');
  console.error('[sel-overlay] 초기화 실패 — 문서 outline 으로 되돌린다', e);
}
