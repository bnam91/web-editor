/* block-bind-kinds.js — «bindBlock 을 걸어야 하는 블록 종류» 명부 (R7b · 2026-10-05 lane-drag · 지디 ⒜)
 *
 * ★이 파일이 «정본»이다. 다시 태어난 블록(템플릿 넣기·되돌리기·붙여넣기·변형 …)에 bindBlock 을 걸 때 이 명부에서 셀렉터를 만든다.
 *   지금 이 명부를 쓰는 곳 = panels/template-system.js 섹션 갈래(:609) «하나». 나머지 손 명부 8 곳은 0.9.7 에 옮긴다 —
 *   그 동안 tests/unit/block-bind-kinds-lock.test.mjs 가 자리마다 «오늘 빠진 수»를 얼려 두어 더 벌어지면 빨강이 된다.
 * ⛔globals.js BLOCK_DELEGATE_SEL(클릭 위임)과 합치지 마라 — 역할이 다르다(그 파일 머리말).
 * 넣는 기준: js/ 안에 그 클래스로 블록을 «만드는 자리»가 있는 종류(2026-10-05 셈 29). card-block 은 만드는 자리 0 이라 뺐다(옛 꼴 · 미확인).
 */
export const BLOCK_BIND_KINDS = Object.freeze([
  'text-block', 'asset-block', 'gap-block', 'icon-circle-block', 'icon-block', 'table-block', 'label-group-block',
  'graph-block', 'divider-block', 'bridge-block', 'grid-block', 'infocard-block', 'innercard-block', 'modal-block',
  'icon-text-block', 'qa-block', 'shape-block', 'vector-block', 'step-block', 'chat-block', 'laurel-block', 'zoom-block',
  'joker-block', 'canvas-block', 'banner02-block', 'comparison-block', 'mockup-block', 'gradient-block', 'speech-bubble-block',
]);
export const BLOCK_BIND_SEL = BLOCK_BIND_KINDS.map(k => '.' + k).join(', ');
if (typeof window !== 'undefined') { window.BLOCK_BIND_KINDS = BLOCK_BIND_KINDS; window.BLOCK_BIND_SEL = BLOCK_BIND_SEL; }
