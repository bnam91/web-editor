/* _section-spec.js — 우측 속성 패널 «절 순서·제목»의 유일한 정본. (right-panel-unify U0, 2026-11-13)
 *
 * ★모든 블록 패널은 js/props/_panel-frame.js 의 sec()/renderPanel() 로 절을 등록하고,
 *   renderPanel 이 이 순서로 줄 세운다. 해당 없는 절은 «숨김»이지 자리 이동이 아니다 ⇒ 어느 패널이든 순서는 이 표의 부분열.
 * ★테스트·문서가 이 파일을 직접 읽는다(tests/unit/panel-frame.test.mjs · tests/dom/panel-section-gate.dom.spec.js ·
 *   docs/styleguide-panel.html) — ⛔순서표를 다른 곳에 베끼지 마라(두 벌은 조용히 갈라진다).
 * ★제목 = 한글 명사, 괄호·영문·기호 없음(현빈 2026-11-13 Q1 확정).
 *   stroke = «테두리»(블록 테두리). 글자 윤곽선(text·sticker 의 Stroke)은 이 절 «안» 하위 줄 «외곽선»으로 둔다.
 * ★special 은 블록 고유 절 — 제목을 sec() 호출부가 준다(같은 한글 규칙 · 선언순).
 * ⛔이 파일에는 색·px 리터럴 0 (scripts/check-design-tokens.sh 신규 층 하드게이트).
 */
export const SECTION_ORDER = Object.freeze([
  'kind', 'content', 'position', 'size', 'layout', 'padding', 'appearance',
  'typography', 'fill', 'stroke', 'effects', 'special', 'export', 'template',
]);

export const SECTION_TITLE = Object.freeze({
  kind: '종류',
  content: '내용',
  position: '위치',
  size: '크기',
  layout: '배치',
  padding: '여백',
  appearance: '모양',
  typography: '글자',
  fill: '채움',
  stroke: '테두리',
  effects: '효과',
  export: '내보내기',
  template: '템플릿',
});

/** 절 제목 규칙 — 한글이 있고, 영문·괄호류가 없다. (개수 접미 「카드 3」 · 가운뎃점 「가로 · 이 줄」은 허용) */
export function isValidSectionTitle(t) {
  return typeof t === 'string' && /[가-힣]/.test(t) && !/[A-Za-z()[\]{}（）<>]/.test(t);
}

/* ★window 로도 낸다 — 정적 import 없이 읽는 DOM 게이트·styleguide 용. Node vm 하네스에는 window 가 없다. */
if (typeof window !== 'undefined') window.__panelSectionSpec = { SECTION_ORDER, SECTION_TITLE, isValidSectionTitle };
