/* bg-layer.js — ★섹션/프레임 배경의 «옵트인 레이어» 판정·관리 ★한 자리 (1017t1k1·k2)
 *
 * ★왜 — 배경(.section-block/.frame-block 의 background-image)은 ★요소가 아니라 ★속성이라
 *   transform(회전)도 filter(색보정)도 못 건다(js/image-handling.js:1552 가 ★크롭 쪽에서
 *   이미 적어 둔 같은 사고: 「크롭 모델에 회전 축이 없다」). ★그래서 rotate·adj 가 ★필요할 때만
 *   진짜 요소(레이어)를 세운다. ★키(dataset.bgRotate · 레이어의 filter · 편집 세션)가 ★없으면
 *   ★레이어도 ★없다 — 지금 저장본과 ★바이트 동일, 마이그레이션 코드 0.
 *   (편집 세션 키 `host._secBgEditing` 은 ★메모리 상태라 저장본에 안 실린다 — 커밋 때 내려간
 *    뒤 영구 자리(prop-section · frame-bg)가 ★다시 판정해 레이어를 남기거나 치운다.)
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
 *   키 셋: rot≠0 이거나, 이미 레이어가 있고 그 filter 가 비어있지 않으면(=색보정 적용 중),
 *   또는 ★배경이미지 편집 세션 중(host._secBgEditing)이면 true(has-bg-opacity 숙주 빼고 — needsBgLayer 안의
 *   조건부 예외 · HAS-BG-OPACITY-LAYER-ZERO).
 *   ★b1a — 편집 중엔 ★레이어가 ★유일한 그리는 자다. 색보정 패널(adjHost)이 진입 때 레이어를
 *   세우는데 판정이 false 면 syncBg 가 숙주에 써서 ★레이어 아래로 숨었다(화면이 굳음 ·
 *   e4bb4594 회귀). ⇒ 「레이어 있음 ⇔ needsBgLayer」 불변식을 편집 중에도 지키게 키를 더했다
 *   — ★불변식을 needs 정의를 넓혀 지킨다(깨기 아님) · :1364(adjHost)는 불변식 밖에서 지었고
 *   처방은 안으로 끌어들였다(지디 판정 j2 ③).
 *   (tests/unit/bg-layer-guard.test.mjs G8 가 부르는 자리 전수를 짝으로 센다).
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
  /* ★편집 세션 동안엔 레이어가 유일한 그리는 자 (b1a).
     ★조건부 예외(b1a 재투입 F1 · 지디 판정 f1) — has-bg-opacity 숙주는 편집 키를 안 건다.
       까닭: 그 프레임은 ::before 가 그리고(편집 중 변수 --frame-bg-size/pos 는 js/image-handling.js frame 어댑터
       writeLive 한 자리가 쓴다), 레이어는 높이 0 이다 — css/editor-blocks.css:327 `.frame-block.has-bg-opacity > *`
       (0,2,0)가 :751 `.sec-bg-clip`(0,1,0)을 이긴다 · e4bb4594 부터 · 기존 결함. 레이어엔 ::before 의 opacity 도 없다.
       결과: 그 프레임은 편집 중 스케일·위치가 ::before 변수로 따라온다. 회전·색보정은 편집 중 안 보이고,
       색보정은 adjHost 의 짝 예외로 레이어에 걸려 완료 뒤 그림이 사라진다(핀 꼴 · tests/dom R4-d).
       ⚠️그래서 이 숙주에선 편집 «진입 때부터» 레이어(높이 0)가 서고 needs 는 거짓이다 — 불변식
       「레이어 있음 ⇔ needsBgLayer」 «밖»이다(핀 꼴 · 진입 때 색보정 패널이 adjHost 를 부른다 · :473).
       화면·변수·완료 뒤 결과엔 영향 없음(S1-b1a eval3 E1 실측). 이 예외를 거둘 때 같이 닫힌다.
       이 처방은 결함을 고치는 것이 아니라 «조용한 결함»을 «시끄러운 결함»(핀 꼴 · 그림이 사라짐)으로 바꾸는 것이다 — 근본은 HAS-BG-OPACITY-LAYER-ZERO(css/editor-blocks.css:327 ↔ :751 · e4bb4594 부터 · 반투명 프레임은 어느 판에서도 회전·색보정이 제대로 안 된다).
       ★한 예외의 두 얼굴 — js/image-handling.js adjHost 의 has-bg-opacity 예외와 둘 다 있거나 둘 다 없다(G8d).
     ⇒ ★그 결함이 고쳐지면 이 예외를 거둔다(adjHost 쪽과 함께) · 별건 이름 = HAS-BG-OPACITY-LAYER-ZERO.
     묶음 HAS-BG-OPACITY-GUARD-ROSTER-01 = 같은 꼴 셋: image-handling.js:1184 근방 twoLayer · adjHost(이 예외) · frame-bg.js:88 applyFrameBgImageInline.
     ⛔CSS 로 레이어 살리기는 그 별건에서(여기서 하지 마라). 잠그는 칸: tests/dom/sec-bg-live.dom.spec.js G5b. */
  if (host._secBgEditing && !host.classList?.contains('has-bg-opacity')) return true;
  const rot = parseFloat(host.dataset.bgRotate || 0);
  if (rot) return true;
  const img = getBgLayerImg(host);
  return !!(img && img.style.filter && img.style.filter !== 'none');
}

/** 레이어의 ★그림·크기·위치·회전을 host dataset 에서 ★그대로 베껴 그린다. ⛔filter 는 안 건드린다.
 *  ★`rot` — 편집 중 회전의 한 자리(proxy.dataset.imgRotate)를 ★인자로 받는다(b1a).
 *  ⛔dataset.bgRotate 에 베끼지 않는다(명부 셋 금지) — 저장 키는 beforeCommit 한 자리가 쓴다.
 *  생략하면 저장 키(dataset.bgRotate)를 읽는다(영구 자리 셋은 그대로). */
function paintBgLayer(host, img, rot) {
  const src = host.dataset.bgImg || '';
  img.style.backgroundImage = src ? `url(${src})` : 'none';
  img.style.backgroundSize = host.dataset.bgSize || 'cover';
  img.style.backgroundPosition = host.dataset.bgPos || 'center';
  img.style.backgroundRepeat = 'no-repeat';
  const r = parseFloat(rot ?? host.dataset.bgRotate ?? 0) || 0;
  img.style.transform = r ? `rotate(${r}deg)` : '';
}

/** ★레이어를 보장한다(없으면 짓고, 있으면 다시 칠한다) — 멱등.
 *  host 의 ★첫 자식으로 둔다(.sec-fxpart-wrap 이 있으면 그 앞에). */
export function ensureBgLayer(host, { rot } = {}) {
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
  paintBgLayer(host, img, rot);
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
