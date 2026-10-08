/* text-type-class.js — 텍스트 «타입» 클래스(tb-h1…tb-bullet)만 갈아끼우는 단일 헬퍼 (0920r4 texttype, T-059)
 *
 * 왜: 타입 전환(패널 H1~List 버튼 · 단축키 1~4)이 `contentEl.className = cls` 로 클래스 목록을 통째로 덮어
 *   글자 효과 클래스가 같이 날아갔다 —
 *     · .tgs          → 그라데이션 글자의 그림자가 drop-shadow(글자 «뒤»)에서 text-shadow(글자 «위»)로 되돌아감
 *     · .text-effect .tfx-neon → 비그라데이션 네온 글로우가 다음 복원(재로드·undo)까지 사라짐(그 사이 Figma 내보내기도 빠짐)
 *     · .tfx-metallic 등 → 그라데이션 탭 게이트가 풀려, 칠한 그라데이션이 재로드 때 조용히 지워짐
 *   → 타입 클래스만 빼고 넣는다. 나머지 클래스는 보존.
 * ⛔ 타입 전환 자리에서 `contentEl.className =` 대입 금지 (tests/unit/text-type-class.test.mjs 정적 가드)
 */

export const TEXT_TYPE_CLASSES = ['tb-h1', 'tb-h2', 'tb-h3', 'tb-body', 'tb-caption', 'tb-label', 'tb-bullet'];

/* ═══ T7 불릿 «글머리 모양» — 현빈 2026-10-07 ═══════════════════════════════════════════
 * 원문: 「★불릿 텍스트 블럭 : 스타일 변경가능하도록 (불릿의 ★크기 및, ★모양 및 ★숫자 및 ★알파벳 등 ★프리셋 필요)」
 *
 * ★네 칸 중 ★크기는 ★이미 된다 — 실측(2026-10-07): 공용 글자 크기 손잡이(`txt-size-number`)가
 *   불릿에도 먹는다(36px → 18px · 양성대조로 body 와 나란히 확인). ⇒ ⛔크기 손잡이를 ★새로 만들지 않는다.
 * ⇒ 그래서 이 명부가 담는 것은 ★나머지 셋(모양·숫자·알파벳) ★한 축 — `list-style-type` 이다.
 *   현빈이 ★「숫자」와 「알파벳」을 ★따로 열거했고, 그 셋이 CSS 한 속성의 값들이다(지디 2026-10-07 판정 ⑶).
 *
 * ★★«지정했나»는 ★인라인으로 가른다 — `el.style.listStyleType` 이 ★비어 있으면 「안 골랐다」다.
 *   ⛔computed 로 재지 마라: CSS 기본이 `disc` 라 「사람이 disc 를 ★골랐다」와 ★구분이 안 된다.
 *   (같은 결의 판정을 이 레포가 이미 쓴다 — 그리드 G5 의 「역할 기본색이냐 / 사람이 준 값이냐」.)
 * ★값은 ★인라인 style 로 산다 — ★새 dataset 키 ★0개. 까닭:
 *   ⑴ 이 블럭의 ★크기도 인라인으로 간다(실측: `style="font-family:…; font-size:18px"`) ⇒ ★같은 관례
 *   ⑵ 저장·내보내기가 ★DOM 을 그대로 싣는다 ⇒ 왕복 경로를 ★새로 안 만든다
 * ⚠️타입 전환(`tb-bullet` ↔ 그 밖)은 ★속성을 통째로 복사한다(prop-text-wireup-type.js 의 그 가지)
 *   ⇒ `div` 로 가도 이 선언이 ★따라붙는다. ★`div` 에선 ★아무 효과가 없고(목록이 아니다),
 *     ★다시 `ul` 로 돌아오면 ★사람이 고른 모양이 ★되살아난다 — ★그게 의도다(잃지 않는다).
 * ⛔v1 범위 밖: ★커스텀 글머리(✓·★·이미지)는 `::marker content` 가 필요하고,
 *   이 레포엔 ★선행 장애가 적혀 있다 — prop-text-wireup-type.js 「라벨·불릿은 글자 그라데이션을
 *   못 받는다(★`::marker` 투명)」. ⇒ ★v2 로 가른다(지디 2026-10-07).
 * ⛔`lower-roman` 등은 ★안 넣었다 — 현빈이 ★열거하지 않았다. 「등」을 ★내 손으로 넓히지 않는다.
 * ⇒ 이 명부를 ★읽는 자 둘(패널 템플릿 · 배선)이 ★같은 하나를 본다. ⛔두 벌로 베끼지 마라. */
export const BULLET_LIST_STYLES = [
  { v: 'disc',        label: '•',  title: '점(기본)' },
  { v: 'circle',      label: '○',  title: '빈 원' },
  { v: 'square',      label: '▪',  title: '사각' },
  { v: 'decimal',     label: '1.', title: '숫자' },
  { v: 'lower-alpha', label: 'a.', title: '알파벳 소문자' },
  { v: 'upper-alpha', label: 'A.', title: '알파벳 대문자' },
];
/** 명부 밖 값은 여기서 죽는다 — 패널·배선·검사가 같은 문을 쓴다. */
export const BULLET_LIST_STYLE_VALUES = BULLET_LIST_STYLES.map(s => s.v);
/** 사람이 «고른» 모양. ⛔안 골랐으면 `''`(빈 문자열) — ⛔`'disc'` 를 돌려주지 않는다(위 ★★ 참조). */
export function bulletListStyleOf(el) {
  const v = el && el.style ? String(el.style.listStyleType || '').trim() : '';
  return BULLET_LIST_STYLE_VALUES.includes(v) ? v : '';
}

/** el 의 타입 클래스를 cls 하나로 맞춘다(다른 클래스는 순서까지 그대로).
 *  ★타입 클래스는 «맨 앞»에 둔다 — 레포 17곳이 `[class^="tb-"]`(클래스 문자열이 tb- 로 «시작») 로 글자 요소를 찾는다
 *    (block-edit.js:49 · canvas-state.js:54 · editor.js 크기 +/- · block-factory.js 다수 · overlay-handles.js …).
 *    classList.add 는 끝에 붙여 "text-effect tfx-neon tb-h2" 가 되고 그 셀렉터들이 전부 놓친다. */
export function setTextTypeClass(el, cls) {
  if (!el || !el.classList) return;
  const rest = [...el.classList].filter(c => !TEXT_TYPE_CLASSES.includes(c));
  const next = (cls ? [cls, ...rest] : rest).join(' ');
  if (el.getAttribute?.('class') !== next) el.setAttribute('class', next);
}

/** 타입 전환 뒤처리 — 타입이 바뀌면 computed text-shadow 도 바뀔 수 있다(클래스 속성 변경은 관찰자가 안 본다).
 *  그라데이션 글자의 그림자 파생값(.tgs/--tgs-*)을 다시 맞춘다. 반드시 노드가 문서에 붙은 «뒤»에 부를 것
 *  (syncTextGradShadow 는 떨어진 노드를 무시한다). window 전역으로 부르는 건 로드 순서에 묶이지 않기 위해. */
export function afterTextTypeChange(el) {
  try { if (typeof window !== 'undefined') window.syncTextGradShadow?.(el); } catch (_) {}
}
