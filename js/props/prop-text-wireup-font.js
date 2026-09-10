/* prop-text-wireup-font.js
 * 텍스트 패널의 폰트 «적용» + font-weight 배선.
 * ★위젯(드롭다운·검색·핀·최근사용·시스템폰트 로드)은 `_font-picker.js` 로 옮겼다 —
 *   모달 패널이 같은 피커를 쓰는데 150줄을 베낄 수는 없어서다. 모듈 상태
 *   _systemFontsList 도 그리로 갔다(이 파일은 이제 안 들고 있다).
 */

import { fontChain } from './prop-text-utils.js';
import { wireFontPicker } from './_font-picker.js';

// design-system.js는 classic script라 import를 못 쓴다 → 같은 체인 규칙을 전역으로 공유(중복 정의 금지).
// 호출은 사용자 인터랙션 시점이라 모듈 로드 순서와 무관하다.
if (typeof window !== 'undefined') window.goditorFontChain = fontChain;

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
      ctx.contentEl.querySelectorAll('div').forEach(child => { child.style.removeProperty('font-family'); });
    },
  });

  /* 폰트 굵기 — selection 있으면 그 부분만 <span>, 없으면 전체 적용 */
  let _savedFwSel = null;
  const fwSel = document.getElementById('txt-font-weight');
  const saveFwSel = () => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0 && !sel.isCollapsed) {
      _savedFwSel = sel.getRangeAt(0).cloneRange();
    } else _savedFwSel = null;
  };
  fwSel.addEventListener('mousedown', saveFwSel);
  fwSel.addEventListener('focus', saveFwSel);
  fwSel.addEventListener('change', e => {
    const v = e.target.value;
    if (_savedFwSel) {
      // 부분 적용 — selection을 <span style="font-weight:V">로 wrap
      const r = _savedFwSel.cloneRange();
      const frag = r.extractContents();
      const span = document.createElement('span');
      span.style.fontWeight = v;
      span.appendChild(frag);
      r.insertNode(span);
      _savedFwSel = null;
    } else {
      ctx.contentEl.style.fontWeight = v;
    }
    window.pushHistory();
  });
}
