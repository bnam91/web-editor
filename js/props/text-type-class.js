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
