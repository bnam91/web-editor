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

export function textGradientAllowed(contentEl) {
  if (!contentEl || !contentEl.classList) return false;
  if (!TEXT_GRADIENT_CLASSES.some(c => contentEl.classList.contains(c))) return false;
  const tb = contentEl.closest ? contentEl.closest('.text-block') : null;
  if (tb && (tb.classList.contains('speech-bubble-block') || tb.classList.contains('liner-block'))) return false;
  return true;
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
  st.setProperty('color', fb);
  st.setProperty('caret-color', fb);
  if (commit) window.pushHistory?.('글자 그라데이션');
  window.scheduleAutoSave?.();
  return true;
}

if (typeof window !== 'undefined') {
  window.applyTextGradient = applyTextGradient;
  window.clearTextGradient = clearTextGradient;
  window.getTextGradient = getTextGradient;
  window.textGradientAllowed = textGradientAllowed;
}
