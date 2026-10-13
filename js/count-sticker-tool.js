// count-sticker-tool.js — 카운트 스티커(번호 뱃지) «찍는 도구» (1012t1Z4)
// ★사용자 표기 = Marking(마킹 블럭) · 1013t2B1 — 저장 키(data-count*)·함수·파일명은 count 그대로다(옛 저장본 호환).
// 메뉴 「Marking」으로 켠 뒤 섹션을 누를 때마다 그 자리에 1·2·3… 번호 스티커가 찍힌다.
// 스티커는 기존 sticker-block(circle/square)의 «변형»이다 — data-count 가 붙었을 뿐 새 블록 타입이 아니다.
//   data-count        섹션 안 순번 k (1부터)
//   data-count-start  시작 번호 (기본 1)
//   data-count-style  num | alpha | icon(1013t2B5 — 번호 대신 아이콘. 순번은 그대로 센다)
//   data-count-shape  circle | square | none(투명)
//   data-count-icon      내장 글리프 이름(COUNT_STK_GLYPHS) | custom            — 표기가 icon 일 때만 읽는다
//   data-count-icon-svg  custom 일 때의 svg 문자열(쓸 때·그릴 때 js/util/sanitize-svg.js 로 거른다)
// 표시 글자 = label(start + k − 1, style) 을 data-text 에 «구워» 넣는다 ⇒ 저장·내보내기가 그대로 탄다(icon 이면 '').
// ★새 키는 전부 «더하기»다 — 없으면 옛 그림과 100% 같다. 모르는 표기 값은 num 으로 읽는다.
// 종료: Esc(패널 칸에 포커스가 있어도 · 1013t2B2) · V · 우클릭 · 메뉴 재클릭. 골격은 js/highlight-line-tool.js 와 같다.
// ⚠️최상위에서 DOM 을 건드리지 않는다(유닛이 vm 으로 이 파일을 싣는다).

let _cntMode = false;
let _cntBoundCanvas = false;
let _cntEntryAt = 0;          // 모드 진입 직후 잔여 click 무시용 타임스탬프 가드

/* 새로 찍는 마킹의 기본값. ★색(1013t2B4) = 검정 배경 · 흰 글자 — «내용» 기본값이다(UI 토큰 아님 · STICKER_DEFAULTS 와 같은 부류).
   ⚠️일반 스티커의 기본(js/blocks/sticker-block.js STICKER_DEFAULTS · 빨강)과 그리기 폴백은 안 건드린다 —
     옛 저장본은 색을 dataset 에 들고 있고(없으면 그 폴백 = 빨강), 그 그림이 바뀌면 안 된다. */
const COUNT_STK_DEFAULTS = { size: 56, fontSize: 26, fontWeight: 700, start: 1, style: 'num', shape: 'circle', bgColor: '#000000', textColor: '#ffffff' };
const COUNT_STK_START_MIN = 1;
const COUNT_STK_START_MAX = 999;

/* 내장 글리프(1013t2B5) — 네트워크 0. 값은 `viewBox 0 0 16 16` 안의 «안쪽 마크업»만이다(우측 패널의 이웃 아이콘과 같은 격자).
   감싸개(<svg …>)는 countStickerGlyphSvg 가 붙인다 — 패널 단추는 선 굵기 1.4, 캔버스 마커는 2(굵게).
   ⛔여기에 on* · href · script 를 적지 마라 — 유닛(marking-glyph G1)이 태그·속성을 잠근다. */
const COUNT_STK_GLYPHS = {
  'chevron-right': '<polyline points="6 3.5 10.5 8 6 12.5"/>',
  'check':         '<polyline points="3.5 8.5 6.5 11.5 12.5 4.5"/>',
  'arrow-right':   '<line x1="3" y1="8" x2="13" y2="8"/><polyline points="9 4 13 8 9 12"/>',
  'plus':          '<line x1="8" y1="3" x2="8" y2="13"/><line x1="3" y1="8" x2="13" y2="8"/>',
  'star':          '<polygon points="8 2.2 9.8 6 14 6.5 10.9 9.3 11.7 13.4 8 11.4 4.3 13.4 5.1 9.3 2 6.5 6.2 6"/>',
  'dot':           '<circle cx="8" cy="8" r="2.6" fill="currentColor"/>',
};
const COUNT_STK_GLYPH_NAMES = Object.keys(COUNT_STK_GLYPHS);
const COUNT_STK_GLYPH_DEFAULT = 'chevron-right';
const COUNT_STK_ICON_SVG_MAX = 200000;      // js/util/sanitize-svg.js SVG_MAX_LEN 과 같은 수

/* 표기 값 3갈래 — 모르는 값은 num(옛 저장본·손댄 값이 조용히 다른 그림이 되지 않게). */
function _cntStyle(v) {
  return v === 'alpha' ? 'alpha' : v === 'icon' ? 'icon' : 'num';
}
/* 아이콘 이름 — 내장 글리프 이름 | 'custom'. 그 밖은 기본 글리프. */
function _cntIconName(v) {
  if (v === 'custom') return 'custom';
  return Object.prototype.hasOwnProperty.call(COUNT_STK_GLYPHS, v) ? v : COUNT_STK_GLYPH_DEFAULT;
}

/* 글리프 한 개의 svg 문자열. 모르는 이름이면 ''.
   opts.size  = 한 변 px(그릴 때 폰트 크기를 «숫자로» 굽는다 — 내보내기 클론이 em·상속에 기대지 않게)
   opts.color = currentColor 가 가리킬 색(〃) · opts.stroke = 선 굵기(기본 2) */
function countStickerGlyphSvg(name, opts) {
  if (!Object.prototype.hasOwnProperty.call(COUNT_STK_GLYPHS, name)) return '';
  const o = opts || {};
  const size = Number.isFinite(+o.size) && +o.size > 0 ? +o.size : 16;
  const stroke = Number.isFinite(+o.stroke) && +o.stroke > 0 ? +o.stroke : 2;
  const color = o.color ? String(o.color).replace(/["<>;]/g, '') : '';
  return `<svg viewBox="0 0 16 16" width="${size}" height="${size}" fill="none" stroke="currentColor" stroke-width="${stroke}"`
    + ` stroke-linecap="round" stroke-linejoin="round" style="${color ? `color:${color};` : ''}display:block;flex:none;pointer-events:none;">`
    + COUNT_STK_GLYPHS[name] + '</svg>';
}

function _cntInt(v, fallback) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : fallback;
}

// 번호 → 표시 글자. alpha 는 «전단사 26진»: 1=A … 26=Z, 27=AA, 52=AZ, 53=BA, 702=ZZ, 703=AAA.
function countStickerLabel(n, style) {
  n = Math.max(1, _cntInt(n, 1));
  if (style !== 'alpha') return String(n);
  let s = '';
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

// 그 섹션의 카운트 스티커 전부(DOM 순).
function _cntListOf(sec) {
  if (!sec || !sec.querySelectorAll) return [];
  return Array.prototype.slice.call(sec.querySelectorAll('.sticker-block[data-count]'));
}

// 그 섹션에서 순번이 가장 큰 스티커(없으면 null). 동률이면 DOM 에서 뒤쪽.
function _cntLastOf(sec) {
  let best = null, bestK = -Infinity;
  _cntListOf(sec).forEach((b) => {
    const k = _cntInt(b.dataset.count, 0);
    if (k >= bestK) { bestK = k; best = b; }
  });
  return best;
}

// 다음 순번 = 그 섹션 max(k) + 1 (없으면 1). 중간이 지워져도 자동으로 메우지 않는다.
function countStickerNextOrdinal(sec) {
  let max = 0;
  _cntListOf(sec).forEach((b) => { max = Math.max(max, _cntInt(b.dataset.count, 0)); });
  return max + 1;
}

// 다음 찍기가 물려받을 값 — 그 섹션에서 순번이 가장 큰 스티커의 모양·크기·색·폰트·표기·시작.
// 없으면 기본값(색 = 검정 배경·흰 글자 · 1013t2B4). 앞선 것이 있으면 그 색을 물려받는다(옛 빨강 섹션은 빨강으로 이어진다).
function countStickerInheritFrom(sec) {
  const last = _cntLastOf(sec);
  if (!last) {
    return {
      shape: COUNT_STK_DEFAULTS.shape, countShape: COUNT_STK_DEFAULTS.shape,
      countStart: COUNT_STK_DEFAULTS.start, countStyle: COUNT_STK_DEFAULTS.style,
      size: COUNT_STK_DEFAULTS.size, sizeW: COUNT_STK_DEFAULTS.size, sizeH: COUNT_STK_DEFAULTS.size,
      fontSize: COUNT_STK_DEFAULTS.fontSize, fontWeight: COUNT_STK_DEFAULTS.fontWeight,
      bgColor: COUNT_STK_DEFAULTS.bgColor, textColor: COUNT_STK_DEFAULTS.textColor,
    };
  }
  const d = last.dataset;
  const size = _cntInt(d.size, COUNT_STK_DEFAULTS.size);
  const out = {
    shape: d.shape === 'square' ? 'square' : 'circle',
    countShape: d.countShape || (d.shape === 'square' ? 'square' : 'circle'),
    countStart: _cntInt(d.countStart, COUNT_STK_DEFAULTS.start),
    countStyle: _cntStyle(d.countStyle),
    size,
    sizeW: _cntInt(d.sizeW, size),
    sizeH: _cntInt(d.sizeH, size),
    fontSize: _cntInt(d.fontSize, COUNT_STK_DEFAULTS.fontSize),
    fontWeight: _cntInt(d.fontWeight, COUNT_STK_DEFAULTS.fontWeight),
  };
  /* 아이콘(1013t2B5)도 물려받는다 — 표기가 icon 인 섹션에 이어 찍으면 같은 아이콘이다 */
  ['bgColor', 'textColor', 'fontStyle', 'textDecoration', 'countIcon', 'countIconSvg'].forEach((k) => {
    if (d[k] !== undefined && d[k] !== '') out[k] = d[k];
  });
  return out;
}

// 그 스티커의 표시 글자를 다시 굽는다(data-text). 부분 서식(textHtml)은 번호 스티커에 없다 — 남아 있으면 지운다.
function countStickerApplyText(block) {
  if (!block || !block.dataset || block.dataset.count == null) return;
  const d = block.dataset;
  const k = Math.max(1, _cntInt(d.count, 1));
  const start = Math.min(COUNT_STK_START_MAX, Math.max(COUNT_STK_START_MIN, _cntInt(d.countStart, COUNT_STK_DEFAULTS.start)));
  /* 표기가 icon 이면 글자를 비운다(번호 글자가 내보내기에 새지 않게). 순번(data-count)은 그대로라 1/A 로 돌아오면 번호가 산다. */
  d.text = _cntStyle(d.countStyle) === 'icon' ? '' : countStickerLabel(start + k - 1, d.countStyle);
  delete d.textHtml;
}

// 다시 그린다. 그리기가 innerHTML 을 갈아 끼우므로 골라진 스티커는 모서리 핸들을 다시 단다.
function _cntRerender(block) {
  window.renderStickerBlock?.(block);
  if (block.classList.contains('selected')) window._addCornerHandles?.(block);
}

// 묶음 속성(표기·시작 번호·아이콘) — 같은 섹션의 카운트 스티커 «전부»에 쓴다. 히스토리는 부르는 쪽이 한 번 찍는다.
//   patch.icon    = 내장 글리프 이름 | 'custom'
//   patch.iconSvg = custom 의 svg 문자열 — ★쓸 때 거른다(window._sanitizeSvgString = js/util/sanitize-svg.js).
//                   거르개가 안 실렸거나 걸러서 빈 문자열이면 «안 쓴다»(날것을 dataset 에 넣지 않는다).
function countStickerSetGroup(sec, patch) {
  const list = _cntListOf(sec);
  let iconSvg = null;
  if (patch && patch.iconSvg != null) {
    const raw = String(patch.iconSvg);
    const clean = (typeof window._sanitizeSvgString === 'function' && raw.length <= COUNT_STK_ICON_SVG_MAX) ? window._sanitizeSvgString(raw) : '';
    iconSvg = clean || '';
  }
  list.forEach((b) => {
    if (patch && patch.start != null) {
      const s = _cntInt(patch.start, NaN);
      if (Number.isFinite(s)) b.dataset.countStart = String(Math.min(COUNT_STK_START_MAX, Math.max(COUNT_STK_START_MIN, s)));
    }
    if (patch && patch.style != null) b.dataset.countStyle = _cntStyle(patch.style);
    if (patch && patch.icon != null) {
      const name = _cntIconName(patch.icon);
      if (name === 'custom') {
        /* custom 은 거른 svg 가 있을 때만 — 없으면 아이콘을 안 바꾼다 */
        if (iconSvg) { b.dataset.countIcon = 'custom'; b.dataset.countIconSvg = iconSvg; }
      } else {
        b.dataset.countIcon = name;
        delete b.dataset.countIconSvg;
      }
    }
    /* 표기가 icon 인데 아이콘이 안 정해졌으면 기본 글리프 */
    if (_cntStyle(b.dataset.countStyle) === 'icon' && !b.dataset.countIcon) b.dataset.countIcon = COUNT_STK_GLYPH_DEFAULT;
    countStickerApplyText(b);
    _cntRerender(b);
  });
  return list.length;
}

/* 섹션 일괄(1013t2B3) — `block` 의 dataset 에서 `keys` 를 읽어 같은 섹션의 «다른» 마킹에 그대로 베끼고 각자 다시 그린다.
   block 에 그 키가 없으면(undefined) 받는 쪽에서도 지운다. 자기 자신·다른 섹션은 안 건드린다. 돌려줌 = 바뀐 블럭 수.
   히스토리는 부르는 쪽이 한 번 찍는다(패널의 change·onCommit — 슬라이더·색은 input 마다 쓰고 한 번 찍는다).
   ⚠️번호(data-count)·자리(x/y)·라벨 «글자»는 블럭마다의 것이다 — 부르는 쪽이 keys 에 넣지 않는다. */
function countStickerCopyToGroup(block, keys) {
  if (!block || !block.dataset || block.dataset.count == null) return 0;
  if (!keys || !keys.length || !block.closest) return 0;
  const sec = block.closest('.section-block');
  let n = 0;
  _cntListOf(sec).forEach((b) => {
    if (b === block) return;
    keys.forEach((k) => {
      const v = block.dataset[k];
      if (v === undefined) delete b.dataset[k];
      else b.dataset[k] = v;
    });
    _cntRerender(b);
    n += 1;
  });
  return n;
}

// 번호 다시 매기기 — 순번 오름차순(동률은 DOM 순)으로 1..n.
function countStickerRenumber(sec) {
  const list = _cntListOf(sec).map((b, i) => ({ b, i, k: _cntInt(b.dataset.count, 0) }));
  list.sort((p, q) => (p.k - q.k) || (p.i - q.i));
  list.forEach((it, idx) => {
    it.b.dataset.count = String(idx + 1);
    countStickerApplyText(it.b);
    _cntRerender(it.b);
  });
  return list.length;
}

// ── 도구 모드 ────────────────────────────────────────────────────────────────
function enterCountStickerMode() {
  if (_cntMode) return;
  // 다른 «찍는 도구»와 겹치지 않게 먼저 끈다
  window.exitPenMode?.();
  window.exitHighlightBMode?.();
  window.exitVectorPenMode?.();
  _cntMode = true;
  document.body.classList.add('count-stk-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.add('active');
  _cntInitCanvasListeners();
  document.addEventListener('keydown', _cntOnKeydown, true);
  // 메뉴 단추로 켠 바로 그 click 사이클이 캔버스로 흘러들어 곧바로 하나 찍는 것을 막는다
  _cntEntryAt = performance.now();
}

function exitCountStickerMode() {
  if (!_cntMode) return;
  _cntMode = false;
  document.body.classList.remove('count-stk-mode');
  const btn = document.getElementById('fp-pen-btn');
  if (btn) btn.classList.remove('active');
  document.removeEventListener('keydown', _cntOnKeydown, true);
}

function toggleCountStickerMode() {
  if (_cntMode) exitCountStickerMode();
  else enterCountStickerMode();
}

// 화면 좌표 → 섹션 로컬(레이아웃) px. 캔버스가 scale(zoom) 되어 있으므로 배율로 나눈다.
function _cntClientToSection(clientX, clientY, sec) {
  const rect = sec.getBoundingClientRect();
  const zoom = (window.currentZoom || 40) / 100;
  return {
    x: (clientX - rect.left) / zoom,
    y: (clientY - rect.top)  / zoom,
  };
}

function _cntFindSection(clientX, clientY, evTarget) {
  if (evTarget && evTarget.closest) {
    const direct = evTarget.closest('.section-block');
    if (direct) return direct;
  }
  if (typeof document.elementsFromPoint === 'function') {
    const stack = document.elementsFromPoint(clientX, clientY);
    for (const el of stack) {
      const sec = el.closest && el.closest('.section-block');
      if (sec) return sec;
    }
  }
  return null;
}

function _cntInitCanvasListeners() {
  if (_cntBoundCanvas) return;
  const wrap = document.getElementById('canvas-wrap');
  if (!wrap) return;
  wrap.addEventListener('click',       _cntOnClickCapture,       true);
  wrap.addEventListener('mousedown',   _cntOnMouseDownCapture,   true);
  wrap.addEventListener('mouseup',     _cntOnMouseUpCapture,     true);
  wrap.addEventListener('dblclick',    _cntOnDblClickCapture,    true);
  wrap.addEventListener('contextmenu', _cntOnContextMenuCapture, true);
  _cntBoundCanvas = true;
}

function _cntIsToolbar(e) {
  return !!(e.target.closest?.('#fp-pen-btn') || e.target.closest?.('.fp-dropdown'));
}

function _cntOnClickCapture(e) {
  if (!_cntMode) return;
  if (_cntIsToolbar(e)) return;
  if (performance.now() - _cntEntryAt < 50) {
    _cntEntryAt = 0;
    e.stopPropagation();
    e.preventDefault();
    return;
  }
  e.stopPropagation();
  e.preventDefault();
  _cntStamp(e);
}

function _cntOnMouseDownCapture(e) {
  if (!_cntMode) return;
  if (_cntIsToolbar(e)) return;
  if (!e.target.closest?.('#canvas-wrap')) return;
  // 도구가 켜진 동안 캔버스 mousedown 은 전부 막는다(스티커·블록 드래그 진입 방지)
  e.stopPropagation();
  e.preventDefault();
}

function _cntOnMouseUpCapture(e) {
  if (!_cntMode) return;
  if (_cntIsToolbar(e)) return;
  if (!e.target.closest?.('#canvas-wrap')) return;
  e.stopPropagation();
}

// 빠르게 두 번 찍으면 dblclick 이 난다 — 스티커 인라인 편집 등으로 새지 않게 막는다
function _cntOnDblClickCapture(e) {
  if (!_cntMode) return;
  if (_cntIsToolbar(e)) return;
  e.stopPropagation();
  e.preventDefault();
}

function _cntOnContextMenuCapture(e) {
  if (!_cntMode) return;
  e.stopPropagation();
  e.preventDefault();
  exitCountStickerMode();
}

// 누른 지점을 «중심»으로 번호 스티커 하나를 찍는다.
function _cntStamp(e) {
  const sec = _cntFindSection(e.clientX, e.clientY, e.target);
  if (!sec) return null;
  if (typeof window.makeStickerBlock !== 'function') return null;
  const p = _cntClientToSection(e.clientX, e.clientY, sec);
  const inh = countStickerInheritFrom(sec);
  const k = countStickerNextOrdinal(sec);
  const rawX = Math.round(p.x - inh.sizeW / 2);
  const rawY = Math.round(p.y - inh.sizeH / 2);
  const pos = window._clampToSection?.(rawX, rawY, sec, inh.sizeW, inh.sizeH) || [rawX, rawY];
  // ⌘Z 한 번 = 스티커 하나: 찍기 «앞»과 «뒤»를 다 찍는다(연속 찍기의 겹치는 표본은 무변화 차단이 버린다)
  try { window.pushHistory?.('마킹 추가'); } catch (err) { console.warn('[count-sticker] pushHistory failed', err); }
  const block = window.makeStickerBlock({
    ...inh,
    x: pos[0], y: pos[1],
    count: k,
    text: inh.countStyle === 'icon' ? '' : countStickerLabel(inh.countStart + k - 1, inh.countStyle),
  });
  sec.appendChild(block);   // 섹션 직속(absolute → 섹션 기준)
  try { window.bindStickerSelect?.(block); } catch (err) { console.warn('[count-sticker] bindStickerSelect failed', err); }
  try { window._selectSticker?.(block); } catch (err) { console.warn('[count-sticker] _selectSticker failed', err); }
  try { window.pushHistory?.('마킹 추가'); } catch (err) { console.warn('[count-sticker] pushHistory failed', err); }
  try { window.scheduleAutoSave?.(); } catch (err) { console.warn('[count-sticker] scheduleAutoSave failed', err); }
  return block;
}

/* 키 — Esc · V 로 도구를 끈다.
   ★Esc(1013t2B2): 포커스가 우측 패널 칸(슬라이더·숫자·색)에 있어도 «한 번에» 꺼진다.
     옛 판은 activeElement 가 INPUT/TEXTAREA/SELECT 면 아무것도 안 했다 — 캔버스 mousedown 은 도구가 켜진 동안
     preventDefault 라 포커스가 칸에서 안 빠지고, 그래서 「패널을 한 번 만진 뒤엔 Esc 가 안 먹는」 꼴이 났다.
     Esc 의 임자가 따로 있는 때는 그 임자에게 둔다(위에서부터 차례로):
       ① 한글 조합 중                              — 조합을 끝내는 Esc 다
       ② 앞선 임자가 이미 먹었다(defaultPrevented)  — 떠 있는 색 팝오버가 자기를 닫았다(js/props/color-picker.js · 같은 document capture 에 먼저 걸려 있다)
       ③ 인라인 편집 중(contenteditable)            — 그 요소가 Esc 로 편집을 끝낸다(js/sticker-select.js)
       ④ 우측 패널 «밖»의 입력 칸(모달·레이어 이름 바꾸기 등) — 그 칸의 Esc 다
     그 밖(body · 단추 · 우측 패널 안의 칸)은 칸이면 포커스를 빼고 도구를 끈다. 선택은 안 푼다(방금 찍은 것을 바로 다듬게 — 한 번 더 Esc 가 푼다).
     숫자칸의 「치던 값 되돌리기」(js/props/prop-number-commit-guard.js · document capture · 먼저 걸려 있다)는 그대로 먼저 돈다.
   ★V 는 «칸에 치는 글자»라 칸·편집 중에는 먹지 않는다(옛 가드 그대로). */
function _cntOnKeydown(e) {
  if (!_cntMode) return;
  const ae = document.activeElement;
  const tag = ae && ae.tagName;
  const inField = tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT';
  const ceAttr = ae && ae.getAttribute ? ae.getAttribute('contenteditable') : null;
  const inEdit = !!(ae && (ae.isContentEditable || ceAttr === 'true' || ceAttr === 'plaintext-only'));
  if (e.key === 'Escape') {
    if (e.isComposing) return;                                                  // ①
    if (e.defaultPrevented) return;                                             // ②
    if (inEdit) return;                                                         // ③
    if (inField && !(ae.closest && ae.closest('#panel-right'))) return;         // ④
    e.stopPropagation();
    e.preventDefault();
    if (inField && ae.blur) ae.blur();
    exitCountStickerMode();
    return;
  }
  if (inField || inEdit) return;
  // V — 선택 도구로 복귀(⌘V 붙여넣기는 그대로 둔다)
  if ((e.key === 'v' || e.key === 'V') && !e.metaKey && !e.ctrlKey && !e.altKey) {
    e.stopPropagation();
    e.preventDefault();
    exitCountStickerMode();
  }
}

window.CountSticker = {
  label: countStickerLabel,
  nextOrdinal: countStickerNextOrdinal,
  inheritFrom: countStickerInheritFrom,
  applyText: countStickerApplyText,
  setGroup: countStickerSetGroup,
  copyToGroup: countStickerCopyToGroup,
  glyphSvg: countStickerGlyphSvg,
  GLYPHS: COUNT_STK_GLYPHS,
  GLYPH_NAMES: COUNT_STK_GLYPH_NAMES,
  GLYPH_DEFAULT: COUNT_STK_GLYPH_DEFAULT,
  styleOf: _cntStyle,
  iconNameOf: _cntIconName,
  renumber: countStickerRenumber,
  START_MIN: COUNT_STK_START_MIN,
  START_MAX: COUNT_STK_START_MAX,
};
window.enterCountStickerMode  = enterCountStickerMode;
window.exitCountStickerMode   = exitCountStickerMode;
window.toggleCountStickerMode = toggleCountStickerMode;
// 상태 노출(검사·디버깅용). armed = 진입 직후 가드(50ms)가 지났다
window._countStkState = () => ({
  mode: _cntMode,
  armed: _cntMode && (performance.now() - _cntEntryAt >= 50),
});
