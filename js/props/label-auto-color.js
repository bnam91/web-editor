/* label-auto-color.js — «라벨(Tag)이 넣은 글자색» 표식 (0920r5 polish2, T-059)
 *
 * 왜: 타입을 Tag 로 바꾸면 어두운 알약 위에서 읽히라고 인라인 color(--preset-label-color, 기본 #ffffff)를
 *   넣는다(prop-text-wireup-type.js). 그런데 다른 타입으로 돌아올 때 배경·라운드만 걷어내고 «색»은 남겨서,
 *   흰 섹션에서 흰 글자가 되어 글자가 통째로 안 보였다.
 *   → 라벨이 «직접 넣은» 색에만 표식(data-label-auto-color)을 달아 두고, 라벨을 벗어날 때
 *     인라인 색이 «그 표식 값 그대로»일 때만 걷어낸다. 사용자가 그 뒤 고른 색은 값이 다르거나(표식 불일치)
 *     표식이 폐기돼 보존된다.
 * ★표식은 data 속성이라 저장(sanitizeCanvasHtml 은 on* 만 제거)·undo(HTML 스냅샷)를 그대로 따라간다.
 *   표식이 없는 옛 저장본은 «사용자 색»으로 본다(안전한 쪽 = 안 건드림).
 */

const ATTR = 'labelAutoColor';   // → data-label-auto-color

/** contentEl.style.color 에 «라벨 기본색»을 넣은 «직후» 부른다.
 *  브라우저가 정규화한 값(rgb(...))을 그대로 표식에 담아 나중에 문자열로 견줄 수 있게 한다. */
export function markLabelAutoColor(el) {
  if (!el || !el.style || !el.dataset) return;
  const v = el.style.color;
  if (v) el.dataset[ATTR] = v;
  else delete el.dataset[ATTR];
}

/** 사용자가(또는 다른 경로가) 글자색을 직접 정하면 표식을 폐기한다 — 그 색은 «라벨이 넣은 색»이 아니다. */
export function forgetLabelAutoColor(el) {
  if (el && el.dataset) delete el.dataset[ATTR];
}

/** 라벨을 벗어날 때: 라벨이 넣은 색 그대로면 인라인 color 를 걷어낸다(표식은 언제나 폐기).
 *  @returns {boolean} 실제로 걷어냈는지 */
export function dropLabelAutoColor(el) {
  if (!el || !el.style || !el.dataset) return false;
  const mark = el.dataset[ATTR];
  delete el.dataset[ATTR];
  if (!mark) return false;                 // 표식 없음 = 사용자 색(또는 옛 저장본) — 보존
  if (el.style.color !== mark) return false; // 표식 뒤에 색이 바뀌었다 — 사용자 색 보존
  el.style.color = '';                     // 라벨이 넣은 색만 걷어냄 → CSS 타입 기본색 복귀
  return true;
}

export const LABEL_AUTO_COLOR_DATA_ATTR = 'data-label-auto-color';

/* 0920r6 labeltext: 클래식 스크립트(js/block-edit.js·js/variable-binding.js 는 ES 모듈이 아니다)도
 *   표식을 폐기할 수 있게 window 로 내보낸다 — text-block-color.js 의 clearTextGradient 와 같은 규약.
 *   (node 단위 테스트에는 window 가 없다 → 가드) */
if (typeof window !== 'undefined') {
  window.markLabelAutoColor = markLabelAutoColor;
  window.forgetLabelAutoColor = forgetLabelAutoColor;
  window.dropLabelAutoColor = dropLabelAutoColor;
}
