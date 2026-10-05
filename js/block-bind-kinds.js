/* block-bind-kinds.js — «bindBlock 을 걸어야 하는 블록 종류» 명부 (R7b · 2026-10-05 lane-drag · 지디 ⒜)
 *
 * ★이 파일이 «정본»이다. 다시 태어난 블록(템플릿 넣기·되돌리기·붙여넣기·변형 …)에 bindBlock 을 걸 때 이 명부에서 셀렉터를 만든다.
 *   이 명부를 쓰는 곳은 아래 «쓰는 곳» 줄. 나머지 손 명부는 0.9.7 에 옮긴다 —
 *   그 동안 tests/unit/block-bind-kinds-lock.test.mjs 가 자리마다 «오늘 빠진 수»를 얼려 두어 더 벌어지면 빨강이 된다.
 * ⛔globals.js BLOCK_DELEGATE_SEL(클릭 위임)과 합치지 마라 — 역할이 다르다(그 파일 머리말).
 * 넣는 기준: js/ 안에 그 클래스로 블록을 «만드는 자리»가 있고 «bindBlock 으로» 묶이는 종류(2026-10-06 셈 28). card-block 은 만드는 자리 0 이라 뺐다(옛 꼴 · 미확인).
 * ⛔제 바인더를 따로 쓰는 종류는 넣지 않는다 — gradient-block(bindGradientSelect) · sticker-block(bindStickerSelect) · annotation(bindAnnotationSelect).
 *   rebindAll(save-load.js)이 이 셋을 따로 묶는다. gradient 를 처음 판에 넣었다가 실앱에서 «묶였는데 클릭해도 안 골라지고 끌면 움직임»을 재서 뺐다.
 * ★명부에 없다 ≠ 빠뜨림 — 제 바인더를 쓰는 종류는 «일부러» 뺀다(그 셋은 섹션 템플릿 넣기·rebindAll 이 제 바인더로 따로 묶는다).
 * ★수 맞추기(2026-10-06 실앱): 섹션 템플릿 넣기 base 13 종 안 묶임 → 고친 판 12 종 묶임 + 1 = gradient(뺌 · 제 바인더) — 수가 맞다.
 * 쓰는 곳(2026-10-06): panels/template-system.js 섹션 갈래 · section-variation.js A/B 사본 둘. 손 명부 6 곳은 잠금 시험 아래 0.9.7.
 */
export const BLOCK_BIND_KINDS = Object.freeze([
  'text-block', 'asset-block', 'gap-block', 'icon-circle-block', 'icon-block', 'table-block', 'label-group-block',
  'graph-block', 'divider-block', 'bridge-block', 'grid-block', 'infocard-block', 'innercard-block', 'modal-block',
  'icon-text-block', 'qa-block', 'shape-block', 'vector-block', 'step-block', 'chat-block', 'laurel-block', 'zoom-block',
  'joker-block', 'canvas-block', 'banner02-block', 'comparison-block', 'mockup-block', 'speech-bubble-block',
]);
export const BLOCK_BIND_SEL = BLOCK_BIND_KINDS.map(k => '.' + k).join(', ');
if (typeof window !== 'undefined') { window.BLOCK_BIND_KINDS = BLOCK_BIND_KINDS; window.BLOCK_BIND_SEL = BLOCK_BIND_SEL; }
