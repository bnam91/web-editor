/* text-block-color.js
 * 전역 헬퍼: 텍스트 블럭 "전체 글자색" 적용 (스포이드 / 프로그램적 색 적용 공용 경로)
 *
 * prop-text-wireup-text-edit.js 의 applyColorToSel 무선택 분기(블럭 전체 색)와 동일한
 * "내부 span 색 mix 해제 → contentEl.style.color 우선" 로직을 wireup 클로저 밖에서도
 * 재사용할 수 있게 노출한다. 스포이드(editor.js i키)와 색상 피커가 같은 경로를 타도록 하는 목적.
 *
 * ★0918r2 textgrad(T-059 확장, 현빈 결정 = 피그마 기준): 글자 그라데이션.
 *   저장소는 «contentEl 인라인 스타일 하나»다 — data 속성 사본을 두지 않는다(둘이 어긋날 일이 없게).
 *     background-image: <그라데이션 css> · (-webkit-)background-clip: text
 *     -webkit-text-fill-color: transparent · color / caret-color: 첫 스탑 불투명 hex(캐럿·대체색)
 *   인라인이라 저장(sanitizeCanvasHtml)·undo(HTML 스냅샷)·HTML 내보내기에 그대로 따라간다.
 *   ⛔단색을 쓰는 모든 경로는 먼저 clearTextGradient 를 불러야 한다 — 안 그러면 그라데이션이 단색을 가린다
 *     (tests/unit/text-gradient-solid-writers.test.mjs 가 contentEl.style.color 대입 전수를 감시).
 */
import { parseGradient } from './gradient-model.js';
import { textShadowToDropShadowFilter, parseShadowList, shadowFilterId, svgShadowFilterMarkup } from './text-shadow-filter.js';

// rgb/rgba/#rrggbb → #rrggbb (프로퍼티 UI 동기화용). 파싱 실패 시 null.
function _toHex6(c) {
  if (typeof c !== 'string') return null;
  const s = c.trim();
  if (/^#[0-9a-f]{6}$/i.test(s)) return s.toLowerCase();
  const m = s.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (m) {
    const h = n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0');
    return '#' + h(m[1]) + h(m[2]) + h(m[3]);
  }
  return null;
}

const _CONTENT_SEL = '[contenteditable],.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner';

function _resolveContentEl(blockEl) {
  if (!blockEl) return null;
  return blockEl.querySelector('[contenteditable]')
    || blockEl.querySelector('.tb-h1,.tb-h2,.tb-h3,.tb-body,.tb-caption,.tb-label,.tb-bullet,.tb-liner')
    || (blockEl.matches && blockEl.matches(_CONTENT_SEL) ? blockEl : null);
}

/**
 * 텍스트 블럭 전체 글자색을 color(hex 또는 rgb/rgba)로 적용한다.
 * @param {Element} blockEl - .text-block(또는 그 자손/contentEl)
 * @param {string} color
 * @returns {boolean} 적용 성공 여부
 */
window.applyTextBlockColor = function (blockEl, color) {
  const tb = (blockEl && blockEl.classList && blockEl.classList.contains('text-block'))
    ? blockEl
    : (blockEl && blockEl.closest ? blockEl.closest('.text-block') : null) || blockEl;
  const contentEl = _resolveContentEl(tb);
  if (!contentEl || !color) return false;

  // 글자 그라데이션이 걸려 있으면 먼저 푼다 — 안 풀면 그라데이션이 새 단색을 가린다(0918r2 textgrad)
  clearTextGradient(contentEl);

  // mix 상태(내부 span별 부분 색)를 풀어줘야 contentEl.style.color 가 우선 적용됨
  contentEl.querySelectorAll('span[style*="color"]').forEach(s => {
    s.style.color = '';
    const styleStr = s.getAttribute('style') || '';
    if (!styleStr.replace(/;|\s/g, '')) {
      const parent = s.parentNode;
      while (s.firstChild) parent.insertBefore(s.firstChild, s);
      parent.removeChild(s);
    }
  });
  contentEl.style.color = color;

  window.pushHistory?.('글자색 추출');
  window.scheduleAutoSave?.();

  // 프로퍼티 색상 UI 동기화 (해당 블럭 프로퍼티가 열려 있을 때만 존재)
  const hex = _toHex6(color);
  if (hex) {
    const cp = document.getElementById('txt-color');
    const ch = document.getElementById('txt-color-hex');
    const sw = cp && cp.closest ? cp.closest('.prop-color-swatch') : null;
    if (cp) cp.value = hex;
    if (ch) ch.value = hex.replace('#', '').toUpperCase();
    if (sw) sw.style.background = color;
  }
  return true;
};


/* ─────────────────────────────────────────────────────────────
 * 글자 그라데이션 (0918r2 textgrad)
 * ───────────────────────────────────────────────────────────── */

// 그라데이션을 받을 수 있는 글자 역할. 라벨(박스 배경이 같이 잘림)·불릿(::marker 투명)·라이너(SVG)·말풍선은 제외.
export const TEXT_GRADIENT_CLASSES = ['tb-h1', 'tb-h2', 'tb-h3', 'tb-body', 'tb-caption'];
export const TEXT_GRADIENT_BLOCKED_NOTE = '라벨·불릿·곡선·말풍선 글자는 단색만 돼요 (그라데이션 미지원)';

// 글자 효과(이스터에그 **text_) 중 «자기 배경으로 글자를 칠하는» 프리셋 — CSS 가 background … !important 라
// 사용자 그라데이션을 캔버스에서 이긴다. 둘은 함께 쓸 수 없다(캔버스·Figma 불일치 방지, 이벨류 지적).
//   규칙: 이런 효과가 걸려 있으면 그라데이션 탭은 막힌다(이유 툴팁), 효과를 새로 걸면 그라데이션은 풀린다.
//   neon 은 text-shadow 만 쓰므로 제외(그라데이션과 공존). 0919r3: 그 글로우는 syncTextGradShadow 가
//   SVG 필터(여러 겹을 따로 만들어 합침)로 옮겨 글자 «뒤»에 깐다(text-shadow-filter.js 주석).
export const TEXT_EFFECT_PAINT_CLASSES = ['tfx-metallic', 'tfx-grunge', 'tfx-vintage', 'tfx-cinematic'];
export const TEXT_GRADIENT_EFFECT_NOTE = '글자 효과(메탈릭·그런지·빈티지·시네마틱)가 글자 칠을 쓰고 있어 그라데이션을 함께 못 써요';

export function hasPaintingTextEffect(contentEl) {
  return !!(contentEl && contentEl.classList && TEXT_EFFECT_PAINT_CLASSES.some(c => contentEl.classList.contains(c)));
}

/** 그라데이션을 못 받는 이유(받을 수 있으면 ''). */
export function textGradientBlockedReason(contentEl) {
  if (!contentEl || !contentEl.classList) return TEXT_GRADIENT_BLOCKED_NOTE;
  if (!TEXT_GRADIENT_CLASSES.some(c => contentEl.classList.contains(c))) return TEXT_GRADIENT_BLOCKED_NOTE;
  const tb = contentEl.closest ? contentEl.closest('.text-block') : null;
  if (tb && (tb.classList.contains('speech-bubble-block') || tb.classList.contains('liner-block'))) return TEXT_GRADIENT_BLOCKED_NOTE;
  if (hasPaintingTextEffect(contentEl)) return TEXT_GRADIENT_EFFECT_NOTE;
  return '';
}

export function textGradientAllowed(contentEl) {
  return textGradientBlockedReason(contentEl) === '';
}

function _clipIsText(st) {
  if (!st) return false;
  const a = st.getPropertyValue('background-clip') || '';
  const b = st.getPropertyValue('-webkit-background-clip') || '';
  return /\btext\b/.test(a) || /\btext\b/.test(b);
}

/** 인라인 스타일에 글자 그라데이션이 걸려 있나(computed 아님 — 저장소 기준). */
export function hasTextGradient(contentEl) {
  const st = contentEl && contentEl.style;
  if (!st) return false;
  return _clipIsText(st) && /gradient\(/i.test(st.backgroundImage || '');
}

// rgb()/rgba()/#hex → #rrggbb (불투명 hex)
function _hexOf(c) {
  return _toHex6(c) || (typeof c === 'string' && /^#[0-9a-f]{3}$/i.test(c.trim())
    ? '#' + c.trim().slice(1).split('').map(x => x + x).join('').toLowerCase() : null);
}

/**
 * 그라데이션을 못 그리는 경로(html2canvas·design-json·Figma style.color)의 대체 단색 = 첫 스탑 불투명 hex.
 * ★인라인 color 는 «마지막 단색»을 지키는 자리라(솔리드 복귀·라벨 전환이 그 값을 쓴다) 여기서 따로 계산한다.
 */
export function textGradientFallbackColor(el) {
  const st = el && el.style;
  if (!st) return null;
  const clip = (st.getPropertyValue('background-clip') || '') + ' ' + (st.getPropertyValue('-webkit-background-clip') || '');
  if (!/\btext\b/.test(clip)) return null;
  const m = parseGradient(st.backgroundImage || '');
  if (!m || !Array.isArray(m.stops) || !m.stops.length) return null;
  const first = [...m.stops].sort((a, b) => a.offset - b.offset)[0];
  return _hexOf(first.color);
}

/** contentEl → {type, angle, stops:[{color:#hex, offset, opacity}], css} | null */
export function getTextGradient(contentEl) {
  if (!hasTextGradient(contentEl)) return null;
  const css = contentEl.style.backgroundImage;
  const m = parseGradient(css);
  if (!m || !Array.isArray(m.stops) || m.stops.length < 2) return null;
  return {
    type: m.type,
    angle: m.angle,
    stops: m.stops.map(s => ({ color: _hexOf(s.color) || '#000000', offset: s.offset, opacity: s.opacity })),
    css,
  };
}

// 부분 색 span 에 붙인 text-fill 잔재까지 걷는다(그라데이션이 없으면 color 가 곧 채움색이라 필요 없다).
function _stripSpanFill(host) {
  host.querySelectorAll('[style*="text-fill-color"]').forEach(s => {
    s.style.removeProperty('-webkit-text-fill-color');
    const styleStr = s.getAttribute('style') || '';
    if (s.tagName === 'SPAN' && !styleStr.replace(/;|\s/g, '')) {
      const parent = s.parentNode;
      while (s.firstChild) parent.insertBefore(s.firstChild, s);
      parent.removeChild(s);
    }
  });
}

/** 글자 그라데이션 해제 — 단색 쓰기 경로가 먼저 부른다. 걸려 있지 않으면 아무것도 안 한다(false). */
export function clearTextGradient(contentEl) {
  if (!contentEl || !contentEl.style) return false;
  const had = hasTextGradient(contentEl);
  if (!had) return false;
  const st = contentEl.style;
  st.removeProperty('background-image');
  st.removeProperty('background-clip');
  st.removeProperty('-webkit-background-clip');
  st.removeProperty('-webkit-text-fill-color');
  st.removeProperty('caret-color');
  _stripSpanFill(contentEl);
  syncTextGradShadow(contentEl);   // 0919r3: 그라데이션이 풀리면 원래 text-shadow 로 복귀
  return true;
}

/**
 * 블럭 전체 글자에 그라데이션을 칠한다.
 * @param {Element} blockEl  .text-block 또는 contentEl
 * @param {{css:string, stops?:Array}} g   css = 피커 _buildGradientCSS 결과
 * @param {{commit?:boolean}} opts  commit 일 때만 pushHistory 1회
 */
export function applyTextGradient(blockEl, g, { commit = false } = {}) {
  const tb = (blockEl && blockEl.classList && blockEl.classList.contains('text-block'))
    ? blockEl : (blockEl && blockEl.closest ? blockEl.closest('.text-block') : null) || blockEl;
  const contentEl = (blockEl && blockEl.matches && blockEl.matches(_CONTENT_SEL) && blockEl !== tb) ? blockEl : _resolveContentEl(tb);
  if (!contentEl || !g || typeof g.css !== 'string' || !/gradient\(/i.test(g.css)) return false;
  if (!textGradientAllowed(contentEl)) return false;
  const model = parseGradient(g.css);
  if (!model || model.stops.length < 2) return false;
  // 부분 색 span 해제 — 단색 «전체 적용»과 같은 규칙(블럭 전체만 지원, 부분 그라데이션은 범위 밖)
  contentEl.querySelectorAll('span[style*="color"]').forEach(s => {
    s.style.color = '';
    s.style.removeProperty('-webkit-text-fill-color');
    const styleStr = s.getAttribute('style') || '';
    if (!styleStr.replace(/;|\s/g, '')) {
      const parent = s.parentNode;
      while (s.firstChild) parent.insertBefore(s.firstChild, s);
      parent.removeChild(s);
    }
  });
  // 블럭 전체 형광펜은 글자 모양으로 같이 잘려 «글자 속 색»이 돼 버린다 — 함께 쓸 수 없다(버튼도 막힌다).
  if (contentEl.style.backgroundColor) contentEl.style.backgroundColor = '';
  const first = [...model.stops].sort((a, b) => a.offset - b.offset)[0];
  const fb = _hexOf(first.color) || '#000000';
  const st = contentEl.style;
  st.setProperty('background-image', g.css);
  st.setProperty('-webkit-background-clip', 'text');
  st.setProperty('background-clip', 'text');
  st.setProperty('-webkit-text-fill-color', 'transparent');
  // ★color 는 건드리지 않는다 — 인라인 color = «마지막 단색» 저장소다(이벨류 지적 ①③):
  //   재선택/재로드 뒤 솔리드 복귀가 그 값으로 돌아가고, 라벨 전환도 «원래 인라인 색이 없었음»을 그대로 본다.
  //   그라데이션을 못 그리는 경로의 대체색은 textGradientFallbackColor(첫 스탑)가 따로 계산한다.
  st.setProperty('caret-color', fb);
  syncTextGradShadow(contentEl);   // 0919r3: 그림자·네온이 있으면 글자 «뒤»로(기록 «전»에 — 스냅샷에 같이 실린다)
  if (commit) window.pushHistory?.('글자 그라데이션');
  window.scheduleAutoSave?.();
  return true;
}

/* ─────────────────────────────────────────────────────────────
 * 그라데이션 글자의 그림자를 글자 «뒤»로 (0919r3 textshadow)
 *
 * 원인: 그라데이션은 «배경» 단계, text-shadow 는 «글자» 단계에 칠해진다 → 그림자가 그라데이션 위에 덮이고
 *   채움이 transparent 라 글자 안쪽까지 그림자색이 보인다(0% 쪽 페이드가 그림자색으로 메워짐).
 * 방법: 저장 원본(일반 그림자 인라인 text-shadow + data-shadow-*, 네온 클래스·변수, 그라데이션 인라인)은
 *   «그대로» 두고, 파생값만 붙인다 —
 *     class  tgs            → css/editor-blocks.css: text-shadow:none + filter:var(--tgs-filter) (둘 다 !important)
 *     --tgs-src             = 원래 computed text-shadow 목록(Figma DROP_SHADOW 가 이걸 읽는다)
 *     --tgs-filter          = 한 겹: drop-shadow() · 여러 겹: url(#tgs-f-…) SVG 필터(text-shadow-filter.js)
 *   ⛔인라인 filter 로 두면 안 된다 — clearTextEffect 가 인라인 filter 를 지운다.
 *   클래스·변수라 저장(sanitize)·undo(HTML 스냅샷)·native PNG 클론에 그대로 따라간다.
 *   멱등: 몇 번 불러도 같은 결과. 모든 쓰기 경로 끝 + 노드 삽입(로드·undo·붙여넣기) 때 부른다.
 * ───────────────────────────────────────────────────────────── */
// 여러 겹 그림자용 SVG 필터 보관소 — 캔버스 «밖»(body 직속)이라 저장·undo 스냅샷에 안 실린다.
//   url(#id) 를 쓰는 글자가 로드·복원되면 sync 가 여기 다시 만든다(같은 목록 = 같은 id, 한 번만).
//   native PNG 는 같은 문서의 클론을 찍으므로 그대로 참조된다.
function _ensureSvgShadowFilter(id, items) {
  try {
    if (document.getElementById(id)) return true;
    let svg = document.getElementById('tgs-svg-defs');
    if (!svg) {
      svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      svg.setAttribute('id', 'tgs-svg-defs');
      svg.setAttribute('aria-hidden', 'true');
      svg.setAttribute('width', '0');
      svg.setAttribute('height', '0');
      svg.style.cssText = 'position:absolute;width:0;height:0;overflow:hidden;pointer-events:none';
      document.body.appendChild(svg);
    }
    const tpl = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    tpl.innerHTML = svgShadowFilterMarkup(id, items);
    const f = tpl.firstElementChild;
    if (!f) return false;
    svg.appendChild(f);
    return true;
  } catch (_) { return false; }
}

export function syncTextGradShadow(contentEl) {
  if (!contentEl || !contentEl.style || !contentEl.classList) return false;
  const had = contentEl.classList.contains('tgs');
  // 떨어진 노드는 computed 를 못 읽는다 — 손대지 않는다(붙는 순간 아래 관찰자가 다시 맞춘다)
  if (!contentEl.isConnected) return had;
  let src = '';
  if (hasTextGradient(contentEl)) {
    if (had) contentEl.classList.remove('tgs');
    try {
      const ts = getComputedStyle(contentEl).textShadow;
      if (ts && ts !== 'none') src = ts;
    } catch (_) {}
  }
  // 한 겹 = drop-shadow(정확) · 두 겹 이상(네온) = SVG 필터(겹이 누적되지 않게 — text-shadow-filter.js 주석)
  const items = src ? parseShadowList(src) : null;
  let filt = '';
  if (items && items.length === 1) filt = textShadowToDropShadowFilter(src);
  else if (items && items.length > 1) {
    const id = shadowFilterId(src);
    if (_ensureSvgShadowFilter(id, items)) filt = `url(#${id})`;
  }
  const st = contentEl.style;
  if (filt) {
    if (st.getPropertyValue('--tgs-src') !== src) st.setProperty('--tgs-src', src);
    if (st.getPropertyValue('--tgs-filter') !== filt) st.setProperty('--tgs-filter', filt);
    contentEl.classList.add('tgs');
    return true;
  }
  if (had) contentEl.classList.remove('tgs');
  if (st.getPropertyValue('--tgs-src')) st.removeProperty('--tgs-src');
  if (st.getPropertyValue('--tgs-filter')) st.removeProperty('--tgs-filter');
  return false;
}

/** 이 글자의 «원래» text-shadow 목록(.tgs 가 computed 를 none 으로 가려도 원본을 돌려준다). 없으면 ''. */
export function textShadowSource(el) {
  if (!el) return '';
  try {
    if (el.classList && el.classList.contains('tgs')) {
      const v = (el.style.getPropertyValue('--tgs-src') || '').trim();
      if (v) return v;
    }
    const ts = getComputedStyle(el).textShadow;
    return ts && ts !== 'none' ? ts : '';
  } catch (_) { return ''; }
}

const _TGS_SEL = '.tgs, [style*="background-clip"]';
function _syncTree(node) {
  if (!node || node.nodeType !== 1) return;
  if (node.matches && node.matches(_TGS_SEL)) syncTextGradShadow(node);
  node.querySelectorAll && node.querySelectorAll(_TGS_SEL).forEach(syncTextGradShadow);
}

if (typeof window !== 'undefined') {
  window.syncTextGradShadow = syncTextGradShadow;
  window.textShadowSource = textShadowSource;
  // 로드 정규화: 캔버스 로드·undo 복원(innerHTML)·붙여넣기로 들어온 노드를 한 번 맞춘다.
  //   이 변경 전에 저장된 «그라데이션 + 그림자» 프로젝트도 열면 글자 뒤 그림자로 보인다.
  //   (sync 는 속성만 바꾸므로 childList 관찰과 되먹임 고리가 없다)
  try {
    const _start = () => {
      _syncTree(document.body);
      new MutationObserver((muts) => {
        for (const m of muts) for (const n of m.addedNodes) _syncTree(n);
      }).observe(document.body, { childList: true, subtree: true });
    };
    if (typeof document !== 'undefined') {
      if (document.body) _start(); else document.addEventListener('DOMContentLoaded', _start, { once: true });
    }
  } catch (_) {}
  window.applyTextGradient = applyTextGradient;
  window.clearTextGradient = clearTextGradient;
  window.getTextGradient = getTextGradient;
  window.textGradientAllowed = textGradientAllowed;
  window.textGradientFallbackColor = textGradientFallbackColor;
}
