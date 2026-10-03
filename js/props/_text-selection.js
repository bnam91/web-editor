/* _text-selection.js — 캔버스 글자 «선택영역»을 패널이 뺏지 않게 하는 공용 한 벌 (TX1 · 2026-10-03)
 *
 * 증상(현빈 2026-10-03): 텍스트 일부를 고른 뒤 우측 패널의 크기·굵기·색을 누르면 선택이 풀리고,
 *   «연달아 두 번째» 바꾸려 하면 고른 곳 밖(블럭 전체)에 먹었다.
 * 원인(PLANNER-REPORT 측정): 칸마다 따로 든 저장 장치가 «쓰고 버렸다»(_savedFwSel=null · _savedSizeSel=null ·
 *   _savedColorSel=null · _cellSel=null) + 패널 칸이 포커스를 뺏어 편집이 끝났다.
 *
 * ★이 파일 «한 곳»이 정본이다 — 패널 쪽은 아래 셋만 부른다. 칸마다 저장 변수를 다시 만들지 마라.
 *   saveTextSelection()      — 지금 캔버스 선택(비-collapsed)을 저장. 캔버스 밖 선택이면 «아무것도 안 바꾼다».
 *   restoreTextSelection()   — 저장 범위를 DOM 선택으로 되돌린다(포커스가 글자 입력칸에 있으면 «안» 한다 — 그 칸을 안 뺏는다).
 *   withTextSelection(fn)    — 저장 범위로 fn(range, host) 를 부르고, fn 이 돌려준 노드(새/고친 span)의
 *                              selectNodeContents 로 저장 범위를 «바꾼다»(⛔null 로 지우지 않는다 → 2회째가 같은 글자에 간다).
 * ⛔js/history.js 의 _captureSelection/_restoreSelection 과 합치지 마라 — 그쪽은 «어느 블럭이 선택됐나»(undo 용)이고
 *   이쪽은 «글자 범위»다. 일이 다르다(PLANNER-REPORT ⑤).
 *
 * ★포커스 지키기(지디 판정 B) — document capture mousedown 위임 «하나»:
 *   (캔버스 글자 편집 중 ∨ 저장 선택이 살아 있음) ∧ 대상이 패널 표면(PANEL_SURFACE_SEL) 안 ∧ 예외 명부 밖
 *   ⇒ preventDefault (포커스가 캔버스에 남는다 — 선례: _font-picker.js 눈누 버튼 · color-picker.js 스와치 위임)
 *   예외 칸(FOCUS_TAKING_EXCEPTIONS)은 포커스가 가야 일을 한다 → 막지 않고, pointerdown/mousedown capture 에서 «먼저» 저장한다.
 *
 * ★「패널로 가는 blur」 판정(지디 판정 C)은 isBlurIntoPanel(ev) «한 곳»이다 — 텍스트블럭 blur(block-drag.js)와
 *   그리드 줄 blur(block-drag.js _gridBeginEdit) 둘 다 이것만 본다. 패널로 가는 blur 면 편집을 끝내지 않고
 *   parkEditing(host, end) 로 «세워 둔다». 바깥(패널·팝업·그 글자칸 밖)을 누르면 그때 end() 를 부른다.
 *
 * ★보이는 선택(지디 판정 E): 포커스가 패널에 있는 동안은 DOM 선택이 그 칸에 있어 글자 선택이 안 보인다 →
 *   CSS Custom Highlight API(CSS.highlights, 이름 TEXT_SEL_HIGHLIGHT)로 칠한다. 없으면(폴백) «칠하지만 않을 뿐»
 *   저장·적용 동작은 똑같다(tests/dom/text-selection-panel.dom.spec.js 가 폴백을 잰다).
 *
 * 적용 «시점»은 바꾸지 않는다: 피그마 = 편집 나갈 때 적용 / 고디터 = Enter·blur 에 적용(커밋 가드)·Esc 되돌림.
 *   일부러 다르다(2026-10-03 지디 판정).
 */

export const TEXT_SEL_HIGHLIGHT = 'goditor-text-sel';

/** 패널 표면 — 여기를 누르는 것은 «캔버스 편집을 떠나는 것»이 아니다. */
/* ★패널 판정 선택자 «한 곳» — 「여기를 누르는 것은 캔버스 편집을 떠나는 것이 아니다」의 정본.
 *   실측한 이름(2026-10-03 — .goya-cp 는 틀린 이름이었다: 스펙트럼 클릭이 패널 밖으로 잡혀 2회째가 전체로 갔다, T3 이 잡음).
 *   색 피커 팝업의 실제 뿌리 클래스는 «.goya-cp-popover»(color-picker.js _ensurePopover — body 에 붙는다).
 *   ⛔이 셋을 다른 파일에 다시 적지 마라 — 패널 판정이 필요하면 PANEL_SURFACES / PANEL_SURFACE_SEL 를 가져다 써라. */
export const PANEL_SURFACES = Object.freeze(['#panel-right', '.goya-cp-popover', '.font-picker-dropdown']);
export const PANEL_SURFACE_SEL = PANEL_SURFACES.join(', ');

/** 예외 명부 — 포커스가 «가야» 일을 하는 칸. 여기 걸리면 mousedown 을 막지 않는다(선택은 먼저 저장된다).
 *  ⛔줄을 더하기 전에: 그 칸이 «포커스 없이»는 정말 못 하는가? (버튼·체크박스·스와치는 포커스 없이 된다) */
export const FOCUS_TAKING_EXCEPTIONS = Object.freeze([
  { sel: 'input[type=number]',        why: '숫자 타이핑 — 포커스가 있어야 글자가 들어간다(커밋 가드가 Enter·blur 에 적용)' },
  { sel: '.prop-color-hex',           why: '색 코드 타이핑' },
  { sel: '.prop-color-alpha-input',   why: '불투명도 타이핑' },
  { sel: '.goya-cp-hex',              why: '피커 팝업 색 코드 타이핑' },
  { sel: '.goya-cp-alpha-input',      why: '피커 팝업 불투명도 타이핑' },
  { sel: '.prop-input',               why: '패널 글자칸 타이핑' },
  { sel: '.font-picker-search',       why: '글꼴 검색어 타이핑' },
  { sel: 'input[type=text]',          why: '그 밖의 글자칸 타이핑' },
  { sel: 'textarea',                  why: '여러 줄 글자칸 타이핑(위와 같은 이유)' },
  { sel: '[contenteditable="true"]',  why: '패널 안 글자 편집칸(위와 같은 이유)' },
  { sel: 'select',                    why: 'mousedown 을 막으면 네이티브 목록이 안 열린다' },
  { sel: 'input[type=range]',         why: '막으면 손잡이를 끌 수 없다' },
  { sel: 'input[type=file]',          why: '파일 선택창이 안 열린다' },
  { sel: '[draggable="true"]',        why: 'mousedown 을 막으면 끌어 옮기기(HTML5 drag)가 시작되지 않는다' },
]);
const EXC_SEL = FOCUS_TAKING_EXCEPTIONS.map(e => e.sel).join(', ');
/** 포커스를 «붙잡아도 되는» 글자칸 — 진실이 DOM(인라인 스타일)이라 패널 적용이 글자칸을 다시 그리지 않는 곳.
 *  텍스트블럭(말풍선·오버레이 글 포함)의 글자칸 · 표 칸.
 *  ⛔여기 없는 칸(그리드 줄·모달 슬롯·라벨·아이콘텍스트·비교표 …)은 포커스를 붙잡지 않는다(mousedown 을 안 막는다) —
 *    진실이 dataset 이라 패널 적용이 블럭을 «통째로 다시 그리는» 곳이 섞여 있고, 붙잡은 채 다시 그리면
 *    아직 커밋 안 된 글자가 사라진다. 그곳들은 blur 가 «패널로» 가면 제 표면의 규칙대로 세우거나
 *    (그리드 — parkEditing + flush, block-drag.js) 예전대로 커밋한다(모달 — 다시 그린 뒤 저장 선택을 글자 오프셋으로 옮겨 단다).
 *  ⛔줄을 더하기 전에: 그 블럭의 패널 적용이 글자칸을 다시 그리지 않는가? */
export const KEEP_FOCUS_HOST_SEL = '.text-block [contenteditable="true"], .table-block [contenteditable="true"]';
const _el = (n) => (n && n.nodeType === 1 ? n : n && n.parentElement) || null;
export function isInPanelSurface(node) {
  const e = _el(node);
  return !!(e && e.closest && e.closest(PANEL_SURFACE_SEL));
}
export function isFocusTakingException(node) {
  const e = _el(node);
  return !!(e && e.closest && e.closest(EXC_SEL));
}
/** 캔버스(#canvas) 안의 «편집 중» 글자 칸 — 패널 안의 것은 아니다. */
function _canvasEditableHost(node) {
  const e = _el(node);
  const h = e && e.closest ? e.closest('[contenteditable="true"]') : null;
  if (!h || isInPanelSurface(h)) return null;
  return h.closest('#canvas') ? h : null;
}

/* ── 상태 ─────────────────────────────────────────────────────────── */
let _saved = null;    // { range, host, text, start, end, anchorId, path }
let _parked = null;   // { host, end, flush }
let _downTarget = null;

/* 글자 오프셋 — 다시 그려져 host 가 바뀌어도(그리드·모달은 dataset 에서 통째로 다시 그린다) 같은 글자를 찾는다. */
function _offsetsOf(range, host) {
  const pre = document.createRange();
  pre.selectNodeContents(host);
  pre.setEnd(range.startContainer, range.startOffset);
  const start = pre.toString().length;
  return { start, end: start + range.toString().length };
}
function _rangeFromOffsets(host, start, end) {
  const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT);
  let pos = 0, n, sN = null, sO = 0, eN = null, eO = 0;
  while ((n = w.nextNode())) {
    const len = n.nodeValue.length;
    if (!sN && start <= pos + len && start >= pos) { sN = n; sO = start - pos; }
    if (end <= pos + len && end >= pos) { eN = n; eO = end - pos; if (sN) break; }
    pos += len;
  }
  if (!sN || !eN) return null;
  const r = document.createRange();
  r.setStart(sN, sO); r.setEnd(eN, eO);
  return r.collapsed ? null : r;
}
/* host 를 «id 를 가진 가장 가까운 조상 + 자식 순번 경로»로 적는다 — 다시 그려진 뒤 같은 자리를 찾는 열쇠. */
function _locate(host) {
  let anchor = host.parentElement;
  while (anchor && !anchor.id) anchor = anchor.parentElement;
  if (!anchor) return { anchorId: null, path: null };
  const path = [];
  for (let n = host; n && n !== anchor; n = n.parentElement) {
    path.unshift(Array.prototype.indexOf.call(n.parentElement.children, n));
  }
  return { anchorId: anchor.id, path };
}
function _resolve(anchorId, path) {
  let n = anchorId ? document.getElementById(anchorId) : null;
  if (!n || !path) return null;
  for (const i of path) { n = n.children[i]; if (!n) return null; }
  return n;
}
function _record(range, host) {
  const { start, end } = _offsetsOf(range, host);
  const { anchorId, path } = _locate(host);
  _saved = { range: range.cloneRange(), host, text: host.textContent, start, end, anchorId, path };
}

/** 살아 있는 저장 선택 { range, host } — 없거나 죽었으면 null.
 *  host 가 다시 그려져 문서에서 떨어졌으면 «같은 자리·같은 글자»일 때만 새 host 로 옮겨 단다. */
function _alive() {
  if (!_saved) return null;
  let { range, host } = _saved;
  if (!host.isConnected) {
    const nh = _resolve(_saved.anchorId, _saved.path);
    const nr = nh && nh.textContent === _saved.text ? _rangeFromOffsets(nh, _saved.start, _saved.end) : null;
    if (!nr) { _saved = null; return null; }
    _saved.host = host = nh; _saved.range = range = nr;
  }
  if (range.collapsed || !host.contains(range.startContainer) || !host.contains(range.endContainer)) {
    // 글자가 바뀌어 범위가 접혔다 — 오프셋으로 한 번 더 찾는다(같은 글자일 때만)
    const nr = host.textContent === _saved.text ? _rangeFromOffsets(host, _saved.start, _saved.end) : null;
    if (!nr) { _saved = null; return null; }
    _saved.range = range = nr;
  }
  return _saved;
}

/** 저장 선택 { range(복사본), host } — within 을 주면 그 요소 «안»의 것만. */
export function getSavedTextSelection(within) {
  const s = _alive();
  if (!s) return null;
  if (within && !(within === s.host || within.contains(s.host))) return null;
  return { range: s.range.cloneRange(), host: s.host };
}

/** 지금 DOM 선택이 캔버스 글자칸 안의 비-collapsed 범위면 저장한다. 아니면 저장값을 «건드리지 않는다». */
export function saveTextSelection() {
  const sel = typeof window !== 'undefined' ? window.getSelection() : null;
  if (!sel || sel.rangeCount === 0 || sel.isCollapsed) return false;
  const host = _canvasEditableHost(sel.anchorNode);
  if (!host || !host.contains(sel.focusNode)) return false;
  _record(sel.getRangeAt(0), host);
  _schedulePaint();
  return true;
}

/** 저장 범위를 DOM 선택으로 되돌린다 — ★포커스가 «그 글자칸 안»에 있을 때만(버튼처럼 포커스를 안 뺏는 칸을 눌렀을 때).
 *  ⛔포커스가 패널 입력칸(숫자·색코드·select …)이나 body 에 있으면 DOM 선택을 옮기지 않는다 — 그 칸을 뺏거나
 *    (Chrome 은 contenteditable 안에 선택을 놓으면 포커스까지 옮긴다) 커밋 가드의 «칸으로 포커스 되돌리기»를 깨기 때문이다.
 *    그때는 칠하기(Custom Highlight)만 한다. */
export function restoreTextSelection() {
  const s = _alive();
  if (!s) return false;
  const a = document.activeElement;
  if (!a || !(a === s.host || s.host.contains(a))) { _schedulePaint(); return false; }
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(s.range.cloneRange());
  _schedulePaint();
  return true;
}

/** 저장 범위를 node 의 글자 전체로 바꾼다(적용 «뒤» — 2회째가 같은 글자에 가게). */
export function replaceSavedTextSelection(node) {
  if (!node || !node.isConnected) return false;
  const host = _canvasEditableHost(node) || (_saved && _saved.host && _saved.host.contains(node) ? _saved.host : null);
  if (!host) return false;
  const r = document.createRange();
  r.selectNodeContents(node);
  if (r.collapsed) return false;
  _record(r, host);
  _schedulePaint();
  return true;
}

export function clearTextSelection() {
  _saved = null;
  _schedulePaint();
}

/** 저장 범위로 fn(range|null, host|null) 를 부른다. fn 이 «요소»를 돌려주면 그 글자 전체로 저장 범위를 바꾸고
 *  DOM 선택을 되돌린다(포커스가 입력칸이면 칠하기만). 저장 선택이 없으면 fn(null, null) — 호출측이 «전체 적용» 갈래를 탄다. */
export function withTextSelection(fn, { within } = {}) {
  const s = getSavedTextSelection(within);
  const out = fn(s ? s.range : null, s ? s.host : null);
  if (s) {
    if (out && out.nodeType === 1) replaceSavedTextSelection(out);
    restoreTextSelection();
  }
  return out;
}

/** 범위가 «span 하나의 글자 전체»와 정확히 같으면 그 span — 연달아 적용할 때 span 을 겹겹이 만들지 않는다. */
export function spanExactlyCovering(range) {
  if (!range) return null;
  const c = range.startContainer;
  if (c === range.endContainer && c.nodeType === 1 && c.tagName === 'SPAN'
      && range.startOffset === 0 && range.endOffset === c.childNodes.length) return c;
  return null;
}

/** 범위에 인라인 스타일 하나를 «span 으로» 입힌다 — 크기·굵기 공용(색은 그라데이션 갈래가 있어 text-edit 의 것을 쓴다).
 *  범위가 이미 span 하나의 글자 전체면 그 span 에 값만 바꾼다(겹 span 금지). 안쪽의 같은 속성 span 은 벗기고,
 *  host 까지의 조상 span 에 남은 같은 속성도 걷는다(바깥 중첩 금지). 돌려주는 값 = 그 span(withTextSelection 이 저장 범위로 삼는다). */
export function applyStyleToRange(range, host, prop, value) {
  const strip = (root) => root.querySelectorAll('span').forEach(sp => {
    if (!sp.style || !sp.style[prop]) return;
    sp.style[prop] = '';
    if (!(sp.getAttribute('style') || '').replace(/;|\s/g, '')) {
      const par = sp.parentNode;
      while (sp.firstChild) par.insertBefore(sp.firstChild, sp);
      par.removeChild(sp);
    }
  });
  let span = spanExactlyCovering(range);
  if (span) {
    strip(span);
  } else {
    const r = range.cloneRange();
    const frag = r.extractContents();
    strip(frag);
    span = document.createElement('span');
    span.appendChild(frag);
    r.insertNode(span);
  }
  span.style[prop] = value;
  // 조상 쪽 같은 속성 평탄화(host 경계)
  let cur = span.parentNode;
  while (cur && cur !== host && cur.nodeType === 1) {
    if (cur.tagName === 'SPAN' && cur.style && cur.style[prop]) {
      cur.style[prop] = '';
      if (!(cur.getAttribute('style') || '').replace(/;|\s/g, '')) {
        const par = cur.parentNode;
        while (cur.firstChild) par.insertBefore(cur.firstChild, cur);
        par.removeChild(cur);
        cur = par;
        continue;
      }
    }
    cur = cur.parentNode;
  }
  return span;
}

/* ── 「패널로 가는 blur」 한 곳 ─────────────────────────────────────── */
/** blur/focusout 이 패널 표면으로 가는가 — relatedTarget 또는 «지금 눌리고 있는» 대상이 패널 표면 안. */
export function isBlurIntoPanel(ev) {
  if (ev && ev.relatedTarget && isInPanelSurface(ev.relatedTarget)) return true;
  return !!(_downTarget && isInPanelSurface(_downTarget));
}

/** 편집을 끝내지 않고 «세워 둔다». end 는 바깥을 누를 때(또는 키보드로 떠날 때) 한 번 불린다.
 *  flush 를 주면 패널의 input/change/click 이 핸들러에 닿기 «직전»에 그것을 부른다 — 그 표면은 적용이
 *  블럭을 통째로 다시 그려(그리드) 아직 데이터에 안 들어간 글자를 잃기 때문이다(flush = 패널은 다시 안 그리는 커밋). */
export function parkEditing(host, end, { flush = null } = {}) {
  if (_parked && _parked.host !== host) _endParked();
  _parked = { host, end, flush };
}
function _parkedAlive() {
  if (!_parked) return null;
  if (!_parked.host.isConnected || _parked.host.getAttribute('contenteditable') !== 'true') { _parked = null; return null; }
  return _parked;
}
function _endParked() {
  const p = _parked;
  _parked = null;
  if (p && typeof p.end === 'function') { try { p.end(); } catch (e) { console.error('[text-selection] parked end', e); } }
}
/** 세워 둔 편집이 있으면 지금 끝낸다(root 를 주면 그 안의 것만). */
export function flushParkedEdit(root) {
  const p = _parkedAlive();
  if (!p || (root && !root.contains(p.host))) return false;
  _endParked();
  return true;
}
export function isEditingParked() { return !!_parkedAlive(); }

/** 포커스를 붙잡아도 되는 편집 중인가 — 세워 둔 편집 또는 포커스가 든 KEEP_FOCUS_HOST_SEL 글자칸. */
function _canvasEditingActive() {
  if (_parkedAlive()) return true;
  const h = _canvasEditableHost(document.activeElement);
  return !!(h && h.matches(KEEP_FOCUS_HOST_SEL));
}

/* ── 보이는 선택(CSS Custom Highlight) ─────────────────────────────── */
let _paintQueued = false;
function _schedulePaint() {
  if (_paintQueued || typeof window === 'undefined') return;
  _paintQueued = true;
  setTimeout(() => { _paintQueued = false; _paint(); }, 0);
}
function _paint() {
  const reg = (typeof CSS !== 'undefined' && CSS.highlights) ? CSS.highlights : null;
  if (!reg || typeof Highlight === 'undefined') return;   // 폴백 — 칠하지만 않는다(동작은 같다)
  const s = _alive();
  const a = document.activeElement;
  // 포커스가 그 글자칸에 있으면 브라우저 선택이 이미 보인다 — 두 겹으로 칠하지 않는다.
  if (!s || (a && (a === s.host || s.host.contains(a)))) { reg.delete(TEXT_SEL_HIGHLIGHT); return; }
  reg.set(TEXT_SEL_HIGHLIGHT, new Highlight(s.range.cloneRange()));
}

/* ── 배선(한 번) ─────────────────────────────────────────────────── */
if (typeof document !== 'undefined' && typeof window !== 'undefined' && !window.__textSelInstalled) {
  window.__textSelInstalled = true;

  // 캔버스 글자칸 안의 선택을 늘 따라간다(키보드 ⇧화살표·드래그·⌘A 모두). 칸 밖의 선택은 무시한다.
  document.addEventListener('selectionchange', () => {
    const sel = window.getSelection();
    if (!sel || sel.rangeCount === 0) return;
    const host = _canvasEditableHost(sel.anchorNode);
    if (!host) return;
    // ★포커스가 그 칸에 있을 때만 «접힘 = 선택 해제»로 읽는다 — 적용 중 DOM 이 잠깐 접히는 것을 해제로 오인하지 않게.
    if (sel.isCollapsed) { if (document.activeElement === host || host.contains(document.activeElement)) clearTextSelection(); return; }
    if (!host.contains(sel.focusNode)) return;
    _record(sel.getRangeAt(0), host);
    _schedulePaint();
  });

  /* _downTarget 은 «이 누름의 같은 작업(task)» 동안만 산다 — mousedown 의 기본 동작(포커스 이동 → blur)은 같은 작업 안에서 난다.
     ⚠️pointerup 만으로 지우면 안 된다: select 를 누르면 네이티브 목록이 떠서 pointerup 이 문서로 안 올 수 있고,
       그러면 남은 값 때문에 나중의 Esc-blur 를 「패널로 가는 blur」로 오판한다. */
  const markDown = (t) => { _downTarget = t; setTimeout(() => { if (_downTarget === t) _downTarget = null; }, 0); };
  const onDown = (e) => {
    markDown(e.target);
    if (isInPanelSurface(e.target)) { saveTextSelection(); return; }
    // 패널 밖을 누른다 = 편집을 «떠난다». 단 세워 둔 그 칸·저장 선택의 그 칸 «안»이면 이어서 편집하는 것이다.
    const s = _saved && _saved.host;
    const p = _parked && _parked.host;
    const t = _el(e.target);
    if (p && t && (p === t || p.contains(t))) { _parked = null; return; }   // 같은 칸으로 돌아온다 → 세움만 푼다
    if (_parked) _endParked();
    if (s && t && (s === t || s.contains(t))) return;
    if (_saved) clearTextSelection();
  };
  document.addEventListener('pointerdown', onDown, true);

  // ★포커스 지키기 위임 «하나»(지디 판정 B)
  document.addEventListener('mousedown', (e) => {
    if (e.button !== 0) return;
    if (!isInPanelSurface(e.target)) { if (!_downTarget) onDown(e); return; }
    markDown(e.target);
    saveTextSelection();
    if (isFocusTakingException(e.target)) return;
    const h = _canvasEditableHost(document.activeElement);
    if (h && !h.matches(KEEP_FOCUS_HOST_SEL)) return;         // 붙잡으면 안 되는 글자칸(위 KEEP_FOCUS_HOST_SEL 머리말)
    if (!(_canvasEditingActive() || _alive())) return;
    // 포커스가 패널 글자칸에 있으면 막지 않는다 — 그 칸이 blur 돼야 커밋(change)이 난다(적용 시점 불변).
    const a = document.activeElement;
    if (a && isInPanelSurface(a) && isFocusTakingException(a)) return;
    e.preventDefault();
  }, true);

  const onUp = () => { _downTarget = null; };
  document.addEventListener('pointerup', onUp, true);
  document.addEventListener('mouseup', onUp, true);
  document.addEventListener('dragend', onUp, true);

  // 세워 둔 편집: 포커스가 패널도 아니고 그 칸도 아닌 곳으로 가면 끝낸다(키보드로 떠나는 길).
  document.addEventListener('focusin', (e) => {
    const p = _parkedAlive();
    if (p) {
      if (e.target === p.host || p.host.contains(e.target)) _parked = null;
      else if (!isInPanelSurface(e.target)) _endParked();
    }
    _schedulePaint();
  }, true);
  /* ⚠️blur(Esc 등)만으로는 저장 선택을 지우지 «않는다» — 옛 판(_lastSelRange)도 blur 뒤 선택을 들고 있었고
     화면에도 그 선택이 남아 보인다. 지우는 것은 «바깥을 누를 때»(위 onDown)와 «글자칸 안에서 접힐 때»(selectionchange)다. */
  document.addEventListener('focusout', () => _schedulePaint(), true);

  // 그리드처럼 «적용 = 다시 그리기»인 표면: 패널 값·버튼이 핸들러에 닿기 «직전»에 세워 둔 편집의 글자를 먼저 데이터로 보낸다.
  const onPanelAct = (e) => {
    // 클릭은 «포커스를 안 가져가는» 칸(버튼·항목)만 — 숫자칸 등은 값이 input/change 로 온다(클릭만으로 편집을 끝내지 않는다).
    if (isInPanelSurface(e.target) && !(e.type === 'click' && isFocusTakingException(e.target))) {
      const p = _parkedAlive();
      if (p && typeof p.flush === 'function') {
        _parked = null;
        try { p.flush(); } catch (err) { console.error('[text-selection] parked flush', err); }
      }
    }
    _schedulePaint();
  };
  document.addEventListener('input', onPanelAct, true);
  document.addEventListener('change', onPanelAct, true);
  document.addEventListener('click', onPanelAct, true);
  // 다시 그리기가 끝난 «뒤» 다시 칠한다(옮겨 단 host 를 찾는다)
  document.addEventListener('change', () => _schedulePaint(), false);
  document.addEventListener('click', () => _schedulePaint(), false);

  window.__textSelection = { getSavedTextSelection, saveTextSelection, restoreTextSelection, clearTextSelection,
    isBlurIntoPanel, isEditingParked, flushParkedEdit, FOCUS_TAKING_EXCEPTIONS };
}
