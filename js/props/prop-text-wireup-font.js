/* prop-text-wireup-font.js
 * 텍스트 패널의 폰트 «적용» + font-weight 배선.
 * ★위젯(드롭다운·검색·핀·최근사용·시스템폰트 로드)은 `_font-picker.js` 로 옮겼다 —
 *   모달 패널이 같은 피커를 쓰는데 150줄을 베낄 수는 없어서다. 모듈 상태
 *   _systemFontsList 도 그리로 갔다(이 파일은 이제 안 들고 있다).
 */

import { fontChain, _stripInlineResidue } from './prop-text-utils.js';
import { wireFontPicker } from './_font-picker.js';
import { withTextSelection, applyStyleToRange } from './_text-selection.js';

// design-system.js는 classic script라 import를 못 쓴다 → 같은 체인 규칙을 전역으로 공유(중복 정의 금지).
// 호출은 사용자 인터랙션 시점이라 모듈 로드 순서와 무관하다.
if (typeof window !== 'undefined') window.goditorFontChain = fontChain;

// t4-16: 글꼴 «전체» 적용 때 안쪽 글꼴 잔재를 걷는다.
//   ① <font face> — face 를 떼고, 남은 속성(color·size)이 없으면 벗긴다(색은 남긴다).
//   ② span 인라인 font-family — _stripInlineResidue 규칙(그 속성만 지우고 style 이 비면 벗긴다).
//   ③ 그 밖의 자식(div 등) 인라인 font-family — 속성만 지운다(옛 판의 div 걷기를 포함한다).
// 1020t2d2 — 스타일 붙여넣기(text-style-copy.js)도 글꼴 «전체» 쓰기라 같은 걷기를 쓴다(사본 금지 · 이름만 밖으로 꺼냄).
export function clearInnerFontFamily(el) { _clearInnerFontFamily(el); }
function _clearInnerFontFamily(el) {
  if (!el) return;
  el.querySelectorAll('font[face]').forEach(f => {
    f.removeAttribute('face');
    if (!f.attributes.length) {
      const parent = f.parentNode;
      while (f.firstChild) parent.insertBefore(f.firstChild, f);
      parent.removeChild(f);
    }
  });
  _stripInlineResidue(el, null, 'font-family');
  el.querySelectorAll('[style*="font-family"]').forEach(n => {
    n.style.removeProperty('font-family');
    if (!(n.getAttribute('style') || '').replace(/;|\s/g, '')) n.removeAttribute('style');
  });
}

/* ★위젯은 `_font-picker.js` 에 산다 — 이 파일에는 «적용»만 남는다.
   텍스트블록의 진실은 DOM 인라인 스타일이다(모달은 dataset 이다 — 그래서 못 합친다). */
export function wireFontSection({ propPanel, ctx }) {
  wireFontPicker({
    root: propPanel,
    p: 'txt',
    getCurrent: () => ctx.contentEl.dataset.rawFont || ctx.contentEl.style.fontFamily || '',
    onPick: (rawVal) => {
      ctx.contentEl.style.fontFamily = rawVal;
      ctx.contentEl.dataset.rawFont  = rawVal;
      // 자식에 남은 font-family 를 걷어낸다 — 안 걷으면 부모만 바뀌고 글자는 그대로다.
      // t4-16: div 만이 아니라 안쪽 «전부»(span·<font face>·div)를 걷는다 — mix 블럭에서 글꼴이 일괄로 안 바뀌던 결함.
      _clearInnerFontFamily(ctx.contentEl);
    },
  });

  /* 폰트 굵기 — selection 있으면 그 부분만 <span>, 없으면 전체 적용.
     ★선택 저장은 js/props/_text-selection.js 한 벌이다(옛 _savedFwSel 은 적용 뒤 null 로 «버려서»
       연달아 두 번째가 BBB 밖으로 갔다 — TX1 측정). 적용한 span 으로 저장 범위를 «바꾼다». */
  const fwSel = document.getElementById('txt-font-weight');
  fwSel.addEventListener('change', e => {
    const v = e.target.value;
    withTextSelection((range, host) => {
      if (!range) {
        // t4-16: 전체 적용 전에 안쪽 굵기 잔재(<b>/<strong> · span 인라인 font-weight)를 걷는다 —
        //   굵게 B 전체 토글(prop-text-wireup-text-edit.js wireInlineStyleBtn 'b, strong' · 'font-weight')과 같은 규칙.
        //   안 걷으면 mix 블럭에서 부분 굵기가 남아 일괄로 안 바뀐다. 부분 선택 갈래(아래)는 그대로 그 범위만.
        _stripInlineResidue(ctx.contentEl, 'b, strong', 'font-weight');
        ctx.contentEl.style.fontWeight = v;
        return null;
      }
      return applyStyleToRange(range, host, 'fontWeight', v);
    }, { within: ctx.contentEl });
    window.pushHistory();
  });
}
