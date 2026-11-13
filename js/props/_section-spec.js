/* _section-spec.js — 우측 속성 패널 «절 순서·제목»의 유일한 정본. (right-panel-unify U0, 2026-11-13)
 *
 * ★모든 블록 패널은 js/props/_panel-frame.js 의 sec()/renderPanel() 로 절을 등록하고,
 *   renderPanel 이 이 순서로 줄 세운다. 해당 없는 절은 «숨김»이지 자리 이동이 아니다 ⇒ 어느 패널이든 순서는 이 표의 부분열.
 * ★테스트·문서가 이 파일을 직접 읽는다(tests/unit/panel-frame.test.mjs · tests/dom/panel-section-gate.dom.spec.js ·
 *   docs/styleguide-panel.html) — ⛔순서표를 다른 곳에 베끼지 마라(두 벌은 조용히 갈라진다).
 * ★제목 = 영어 Title Case 1~2단어(Figma 명명) · 한글·괄호·기호 없음 · 개수 접미는 「Cards 3」 꼴.
 *   (현빈 2026-11-13 Q1 정정 — 처음 확정한 «한글»을 뒤집었다.)
 *   stroke = «Stroke» 한 절 — 블록 테두리와 글자 윤곽선(text·sticker)이 같은 절 안 «행»이다(하위 제목 없음).
 * ★special 은 블록 고유 절 — 제목을 sec() 호출부가 준다(같은 규칙 · 선언순).
 * ⛔이 파일에는 색·px 리터럴 0 (scripts/check-design-tokens.sh 신규 층 하드게이트).
 */
export const SECTION_ORDER = Object.freeze([
  'kind', 'content', 'position', 'size', 'layout', 'padding', 'appearance',
  'typography', 'fill', 'stroke', 'effects', 'special', 'export', 'template',
]);

export const SECTION_TITLE = Object.freeze({
  kind: 'Type',
  content: 'Content',
  position: 'Position',
  size: 'Size',
  layout: 'Layout',
  padding: 'Padding',
  appearance: 'Appearance',
  typography: 'Typography',
  fill: 'Fill',
  stroke: 'Stroke',
  effects: 'Effects',
  export: 'Export',
  template: 'Template',
});

/** 절 제목 규칙 — Title Case 영어 1~2단어 + 선택 개수 접미(「Cards 3」). 한글·괄호·기호면 거짓. */
export function isValidSectionTitle(t) {
  return typeof t === 'string' && /^[A-Z][a-z]+( [A-Z][a-z]+)?( \d+)?$/.test(t);
}

/* ★window 로도 낸다 — 정적 import 없이 읽는 DOM 게이트·styleguide 용. Node vm 하네스에는 window 가 없다. */
if (typeof window !== 'undefined') window.__panelSectionSpec = { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle };
