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

/** 회전 쓰기 «한 함수» — 회전과 반전을 «한 순서»로: [나머지 transform] rotate(θ) scale(±1, ±1). (지디 261120 · QA2 ③)
 *  회전을 쓰는 자리(패널 각도 칸 · 회전 손잡이 · 로드 복원 · MCP · 섹션 그룹 풀기 · 렌더러)는 전부 이걸 부른다 — 자리마다 문자열을 짜지 않는다.
 *  ★블럭 종류별 회전 키는 여기서: 도형(.shape-block) = dataset.shapeRotation · 그 밖 = dataset.rotation(키를 넘기면 그것).
 *  0° = rotate() 를 안 쓰고 키를 지운다(옛 판과 같은 꼴) · 다른 transform(translate 등)은 그대로 앞에 남는다. */
export function writeRotation(el, deg, { key, keepKey = false } = {}) {   // keepKey = 렌더러(저장값을 «읽어» 그리기만 — 키를 고쳐 쓰지 않는다 · 옛 저장본 열기만으로 데이터가 안 바뀐다)
  if (!el?.style) return;
  let d = parseFloat(deg) || 0;   // 반올림은 부르는 쪽(패널 칸은 정수 · 드래그는 소수 그대로 — 옛 판과 같게)
  d = ((d % 360) + 360) % 360; if (d > 180) d -= 360;   // 감싸기(자르기 아님) — 섹션 그룹 풀기처럼 합이 180 을 넘는 자리가 있다
  const k = key || (el.classList?.contains('shape-block') ? 'shapeRotation' : 'rotation');
  if (!keepKey) { if (d) el.dataset[k] = String(d); else delete el.dataset[k]; }
  const base = (el.style.transform || '').replace(/\s*rotate\([^)]*\)/g, '').replace(FLIP_RE, '').trim();
  const next = [base, d ? `rotate(${d}deg)` : '', flipScale(el)].filter(Boolean).join(' ');
  if (next) { el.style.transform = next; el.style.transformOrigin = 'center center'; }
  else { el.style.removeProperty('transform'); el.style.removeProperty('transform-origin'); }
}

if (typeof window !== 'undefined') Object.assign(window, { applyFlip, toggleFlip, flipScale, writeRotation });
