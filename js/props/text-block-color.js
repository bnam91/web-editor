/* text-block-color.js
 * 전역 헬퍼: 텍스트 블럭 "전체 글자색" 적용 (스포이드 / 프로그램적 색 적용 공용 경로)
 *
 * prop-text-wireup-text-edit.js 의 applyColorToSel 무선택 분기(블럭 전체 색)와 동일한
 * "내부 span 색 mix 해제 → contentEl.style.color 우선" 로직을 wireup 클로저 밖에서도
 * 재사용할 수 있게 노출한다. 스포이드(editor.js i키)와 색상 피커가 같은 경로를 타도록 하는 목적.
 */

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
