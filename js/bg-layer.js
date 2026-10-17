/* bg-layer.js — ★섹션/프레임 배경의 «옵트인 레이어» 판정·관리 ★한 자리 (1017t1k1·k2)
 *
 * ★왜 — 배경(.section-block/.frame-block 의 background-image)은 ★요소가 아니라 ★속성이라
 *   transform(회전)도 filter(색보정)도 못 건다(js/image-handling.js:1552 가 ★크롭 쪽에서
 *   이미 적어 둔 같은 사고: 「크롭 모델에 회전 축이 없다」). ★그래서 rotate·adj 가 ★필요할 때만
 *   진짜 요소(레이어)를 세운다. ★키(dataset.bgRotate · 레이어의 filter)가 ★없으면 ★레이어도
 *   ★없다 — 지금 저장본과 ★바이트 동일, 마이그레이션 코드 0.
 *   (선례 = js/props/prop-section.js 체커톤 「키가 없으면 ... 마이그레이션 코드 0」)
 *
 * ★이름 규약 — `sec-bg-*` 접두를 ★섹션·프레임 ★둘 다에 쓴다
 *   (tests/unit/frame-bg-edit-wiring.test.mjs B2 가 ★대리 이름을 ★이미 잠갔다 — ★같은 사다리).
 *   ⛔`frame-bg-layer` 류 ★새 접두 ★금지.
 *
 * ★구조 — `<host> > .sec-bg-clip > .sec-bg-img`
 *   .sec-bg-clip : inset:0 · overflow:hidden · border-radius:inherit · ★host의 첫 자식
 *                  (선례 = .sec-fxpart-wrap css/editor-canvas.css — 첫 자식이라 z-index 없이도
 *                   내용 아래. .sec-fxpart-wrap 이 이미 있으면 그 «앞»에 꽂아 배경이 파티클보다
 *                   더 아래가 되게 한다).
 *   .sec-bg-img  : inset:0 — background-image/size/position 은 host 의
 *                  dataset.bgImg/bgSize/bgPos 를 ★그대로 베낀다(키워드든 px든 ★좌표 수학 없이 —
 *                  background-size/position 은 'cover'·'center'·'<n>px <n>px' 어느 꼴이든
 *                  host 에 쓰던 그 문자열을 그대로 다시 써도 같은 그림이 된다) +
 *                  transform:rotate(bgRotate).
 *
 * ★filter 소유권 — layer.style.filter 는 ★image-color-adjust.js 몫이다
 *   (ADJ_TARGET_SEL 에 `.sec-bg-img` 를 더해 그 한 자리가 쓰고 지운다).
 *   ⛔이 파일은 filter 를 ★절대 쓰지도 지우지도 않는다 — paintBgLayer 가 손대는 건
 *   backgroundImage/Size/Position/transform ★뿐이다.
 *
 * ★needsBgLayer 가 ★판정의 ★한 자리 — ⛔다른 파일에서 ★제 벌로 다시 재지 마라.
 *   rot≠0 이거나, 이미 레이어가 있고 그 filter 가 비어있지 않으면(=색보정 적용 중) true.
 *   (ADJ_KEYS 를 다시 베끼지 않는다 — image-color-adjust.js 가 ★기본값이면 filter 를 ''로
 *   지우는 그 규약을 그대로 믿는다.)
 */

const CLIP_CLASS = 'sec-bg-clip';
const IMG_CLASS  = 'sec-bg-img';

/** host 의 ★유일한 레이어 자손(있으면)을 돌려준다. ⛔전수탐색 금지 — 직계 구조만 믿는다. */
export function getBgLayerImg(host) {
  if (!host || !host.querySelector) return null;
  const clip = host.querySelector(':scope > .' + CLIP_CLASS);
  return clip ? clip.querySelector(':scope > .' + IMG_CLASS) : null;
}

/** ★판정 — ★한 자리(P3 가 ★정의 자리 1개를 잠근다). */
export function needsBgLayer(host) {
  if (!host || !host.dataset) return false;
  const rot = parseFloat(host.dataset.bgRotate || 0);
  if (rot) return true;
  const img = getBgLayerImg(host);
  return !!(img && img.style.filter && img.style.filter !== 'none');
}

/** 레이어의 ★그림·크기·위치·회전을 host dataset 에서 ★그대로 베껴 그린다. ⛔filter 는 안 건드린다. */
function paintBgLayer(host, img) {
  const src = host.dataset.bgImg || '';
  img.style.backgroundImage = src ? `url(${src})` : 'none';
  img.style.backgroundSize = host.dataset.bgSize || 'cover';
  img.style.backgroundPosition = host.dataset.bgPos || 'center';
  img.style.backgroundRepeat = 'no-repeat';
  const rot = parseFloat(host.dataset.bgRotate || 0);
  img.style.transform = rot ? `rotate(${rot}deg)` : '';
}

/** ★레이어를 보장한다(없으면 짓고, 있으면 다시 칠한다) — 멱등.
 *  host 의 ★첫 자식으로 둔다(.sec-fxpart-wrap 이 있으면 그 앞에). */
export function ensureBgLayer(host) {
  if (!host) return null;
  /* ★레이어는 ★영구물이다 — 편집 세션의 `BG_EDIT_HOSTS.frame.prepare()`(position:relative)는
     편집이 끝나면 되돌려지므로(js/image-handling.js:1172 어댑터 머리말), ★흐름 프레임처럼
     기본이 position:static 인 host 는 레이어가 ★영구히 설 때 ★그 자신도 영구히 positioned
     이어야 한다. ⛔되돌리면 레이어가 조상 기준으로 붙어 자리를 잃는다. */
  if (getComputedStyle(host).position === 'static') host.style.position = 'relative';
  let clip = host.querySelector(':scope > .' + CLIP_CLASS);
  let img;
  if (!clip) {
    clip = document.createElement('div');
    clip.className = CLIP_CLASS;
    img = document.createElement('div');
    img.className = IMG_CLASS;
    clip.appendChild(img);
    const fx = host.querySelector(':scope > .sec-fxpart-wrap');
    host.insertBefore(clip, fx || host.firstChild);
  } else {
    img = clip.querySelector(':scope > .' + IMG_CLASS);
  }
  paintBgLayer(host, img);
  return img;
}

/** ★레이어를 ★완전히 치운다(필요 없어졌을 때). 요소를 지우면 filter·adj dataset 흔적도
 *  같이 지워진다(요소가 ★유일한 소지자라서 — 별도 지움 코드가 필요 없다). */
export function removeBgLayer(host) {
  if (!host || !host.querySelector) return;
  host.querySelector(':scope > .' + CLIP_CLASS)?.remove();
}

if (typeof window !== 'undefined') {
  window.needsBgLayer  = needsBgLayer;
  window.ensureBgLayer = ensureBgLayer;
  window.removeBgLayer = removeBgLayer;
  window.getBgLayerImg = getBgLayerImg;
}
