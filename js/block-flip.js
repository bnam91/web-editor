/* block-flip.js — 블럭 반전(좌우 · 상하) «한 자리». (패널 재설계 Q17 · 현빈 GO 261120 «시안대로»)
 *
 * ★저장 키 = 회전 host 의 dataset.flipH / dataset.flipV = '1'(켬) · 없으면 반전 없음.
 *   프레임(js/props/prop-frame.js · frame-geometry composeFrameTransformString)이 이미 쓰는 «같은 키»다 — 두 벌 만들지 않는다.
 *   옛 저장본(키 없음) = 반전 없음 · 열기만으로는 아무것도 안 쓴다(이 파일은 단추를 눌렀을 때만 쓴다).
 * ★그리기 = host 의 인라인 transform 끝에 `scale(±1, ±1)` 하나. 회전 코드들은 `rotate(...)` 만 갈아 끼우므로(이 꼴을 보존한다)
 *   회전과 «한 transform» 에 같이 산다 ⇒ outerHTML 저장 · ⌘Z 스냅샷 · 복사/붙여넣기 · 템플릿 · html2canvas PNG 가 그대로 싣는다.
 *   transform 을 «통째로» 다시 쓰는 렌더러는 쓴 뒤 applyFlip(el) 을 한 번 부른다(dataset 에서 다시 붙인다).
 * ⛔프레임 블럭(.frame-block · 비텍스트)은 이 파일을 안 탄다 — frame-geometry 가 dataset 에서 transform 을 통째로 짠다.
 */
const FLIP_RE = /\s*scale\(\s*-?1\s*,\s*-?1\s*\)/g;

/** host dataset → 반전 scale 조각('' = 반전 없음) */
export function flipScale(el) {
  const d = el?.dataset || {};
  const fx = d.flipH === '1' ? -1 : 1, fy = d.flipV === '1' ? -1 : 1;
  return fx === 1 && fy === 1 ? '' : `scale(${fx}, ${fy})`;
}

/** dataset 에 맞게 host 의 transform 끝 반전 조각을 다시 붙인다(멱등). 다른 transform(translate · rotate)은 그대로. */
export function applyFlip(el) {
  if (!el?.style) return;
  const base = (el.style.transform || '').replace(FLIP_RE, '').trim();
  const s = flipScale(el);
  const next = [base, s].filter(Boolean).join(' ');
  if (next === (el.style.transform || '')) return;
  if (next) { el.style.transform = next; if (!el.style.transformOrigin) el.style.transformOrigin = 'center center'; }
  else el.style.removeProperty('transform');
}

/** 한 축 켜고 끄기 — axis = 'flipH' | 'flipV'. 끄면 키를 지운다(옛 저장본과 같은 꼴). 돌려줌 = 켜졌나 */
export function toggleFlip(el, axis) {
  if (!el?.dataset) return false;
  const on = el.dataset[axis] !== '1';
  if (on) el.dataset[axis] = '1'; else delete el.dataset[axis];
  applyFlip(el);
  return on;
}

if (typeof window !== 'undefined') Object.assign(window, { applyFlip, toggleFlip, flipScale });
