// capture-safety.js — html2canvas로 캡처하는 클론에서 프라이버시 안전장치를 건다.
//
// .shape-redact(가림막)는 backdrop-filter로 밑에 깔린 콘텐츠를 흐리는데,
// html2canvas는 backdrop-filter를 지원하지 않아 배경이 근투명(rgba(255,255,255,0.001))
// 그대로 그려져 가려야 할 원본이 «그대로 노출»된다(2026-09-15 실측 확인:
// captureThumbnail·prop-mockup._captureAndApply 둘 다 재현).
//
// ⚠️ CDP 네이티브 캡처(export-image.js captureSectionCdp)는 실제 브라우저 합성을
// 그대로 스크린샷하므로 backdrop-filter가 정상 렌더링된다 — 이 함수는 «html2canvas
// 경로에서만» 호출해야 한다. 네이티브 경로의 clone에 걸면 정상 블러까지 망가진다.
import { parseGradient } from '../props/gradient-model.js';
import { stripImageMemoForCapture } from '../image-memo.js';
import { liftSvgTransformsForH2C } from './h2c-prep.js';   /* ★svg 의 CSS transform 을 감싸는 쪽으로 — h2c 는 svg 쪽을 안 그린다 */

const REDACT_OPAQUE_FILL = '#4a4a4a';

export function neutralizeRedactForH2C(root) {
  if (!root) return;
  const targets = [
    ...(root.classList?.contains('shape-redact') ? [root] : []),
    ...root.querySelectorAll('.shape-redact'),
  ];
  for (const el of targets) {
    // backdrop-filter를 안전 실패(fail-safe)로 대체: html2canvas가 못 그리든 말든
    // 이 영역은 항상 불투명한 색으로 채워져 원본이 절대 비치지 않는다.
    el.style.backdropFilter = 'none';
    el.style.webkitBackdropFilter = 'none';
    el.style.background = REDACT_OPAQUE_FILL;
    el.style.backgroundColor = REDACT_OPAQUE_FILL;
  }
}

/* 0918r2 textgrad — 글자 그라데이션(background-clip:text)의 html2canvas 대체.
 * 동봉 html2canvas 1.4.1 은 background-clip 을 border/padding/content 만 읽는다 → text 는 모른다.
 * 그대로 두면 «글자 박스 전체에 그라데이션 사각형 + 투명 글자»가 찍힌다(글자가 사라지고 네모가 생긴다).
 * ⇒ 정직한 대체: 그라데이션을 걷고 첫 스탑 단색으로 글자를 칠한다.
 *   ★인라인 color 는 «마지막 단색» 저장소라 첫 스탑이 아니다 — 여기서 bg-image 를 파싱해 계산한다.
 * ⚠️ native(CDP) 경로에선 부르지 말 것 — 브라우저가 그라데이션 글자를 제대로 그린다. */
function _firstStopHex(css) {
  const m = parseGradient(css);
  if (!m || !Array.isArray(m.stops) || !m.stops.length) return null;
  const c = String([...m.stops].sort((a, b) => a.offset - b.offset)[0].color || '').trim();
  const r = c.match(/^rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)/i);
  if (r) return '#' + [r[1], r[2], r[3]].map(n => Math.max(0, Math.min(255, +n)).toString(16).padStart(2, '0')).join('');
  if (/^#[0-9a-f]{6}$/i.test(c)) return c.toLowerCase();
  if (/^#[0-9a-f]{3}$/i.test(c)) return '#' + c.slice(1).split('').map(x => x + x).join('').toLowerCase();
  return null;
}

export function neutralizeTextGradForH2C(root) {
  if (!root) return 0;
  const sel = '[style*="background-clip: text"], [style*="background-clip:text"]';
  const targets = [
    ...(root.matches?.(sel) ? [root] : []),
    ...root.querySelectorAll(sel),
  ];
  let n = 0;
  const done = new Set();
  for (const el of targets) {
    const st = el.style;
    const clip = (st.getPropertyValue('background-clip') || '') + ' ' + (st.getPropertyValue('-webkit-background-clip') || '');
    if (!/\btext\b/.test(clip)) continue;
    const fb = _firstStopHex(st.backgroundImage || '');
    st.removeProperty('background-image');
    st.removeProperty('background-clip');
    st.removeProperty('-webkit-background-clip');
    st.removeProperty('-webkit-text-fill-color');
    if (fb) st.setProperty('color', fb);
    done.add(el);
    n++;
  }
  /* ★2026-09-21 최종통합 QA medium — 글자 그라데이션이 «CSS 클래스에서만» 오는 자리가 있다.
   *   위 선택자는 «인라인 style»만 고른다. 그런데 예컨대 css/editor-blocks.css:2929~2933
   *   `.badge-hologram-square .badge-logo` 는 배지 블록의 «기본 상태»가 곧 글자 그라데이션이다
   *   (사용자가 색을 한 번 만져야 비로소 인라인이 생겨 위에서 잡힌다).
   *   이 함수를 타는 경로(썸네일·목업 캡처)는 Electron 에서도 «항상» html2canvas 라 실제로 영향받는다.
   *   ⇒ 클론이 문서에 붙은 «뒤»에 부르는 규약(세 호출부 전부 appendChild 다음)을 이용해
   *     계산값으로 한 번 더 훑는다. ⛔클래스는 인라인으로 «지울» 수 없으니 removeProperty 가 아니라
   *     명시적 덮어쓰기다(border-box + text-fill-color 복원).
   *   ⚠️클론이 문서에 안 붙어 있으면 계산값이 비어 이 두 번째 훑기는 «아무 일도 안 한다» —
   *     그건 «조용한 실패»가 아니라 이 함수의 호출 규약(붙인 뒤에 불러라)이 깨진 것이다. */
  const all = [...(root.nodeType === 1 ? [root] : []), ...root.querySelectorAll('*')];
  for (const el of all) {
    if (done.has(el)) continue;
    let cs;
    try { cs = window.getComputedStyle(el); } catch (_) { continue; }
    if (!cs) continue;
    const clip = (cs.getPropertyValue('background-clip') || '') + ' ' + (cs.getPropertyValue('-webkit-background-clip') || '');
    if (!/\btext\b/.test(clip)) continue;
    const bgImg = cs.getPropertyValue('background-image') || '';
    const fb = _firstStopHex(bgImg) || _firstStopHex(el.style.backgroundImage || '');
    const st = el.style;
    st.setProperty('background-image', 'none');
    st.setProperty('background-clip', 'border-box');
    st.setProperty('-webkit-background-clip', 'border-box');
    // 글자를 실제로 칠하는 값 — 클래스가 걸어 둔 transparent 를 «덮어» 되살린다.
    st.setProperty('-webkit-text-fill-color', fb || cs.getPropertyValue('color') || 'currentcolor');
    if (fb) st.setProperty('color', fb);
    n++;
  }
  // 0919r3 textshadow: html2canvas 는 filter 를 못 그린다 — 단색 대체 위 그림자는 순서 문제가 없으니
  //   .tgs(drop-shadow 파생)를 걷어 원래 text-shadow 를 되살린다.
  const tgs = [...(root.matches?.('.tgs') ? [root] : []), ...root.querySelectorAll('.tgs')];
  for (const el of tgs) {
    el.classList.remove('tgs');
    el.style.removeProperty('--tgs-src');
    el.style.removeProperty('--tgs-filter');
  }
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════════
   object-fit 대체 — html2canvas 경로 전용  [2026-09-21 최종통합 QA medium]

   ★무엇이 틀렸나 (실측): 동봉한 html2canvas 1.4.1 에는 `object-fit` 이 «한 글자도» 없다
     (vendor/html2canvas/html2canvas.min.js — 문자열 0건). 그래서 이미지를 늘 상자에
     «늘려» 그린다(fill). 화면·네이티브 PNG 는 cover 로 가운데를 잘라 보여주는데
     썸네일·목업 캡처만 전체 그림을 찌그러뜨려 넣는다 ⇒ 프로젝트 목록에서 보는 그림이
     실제 상세페이지와 «다른 그림»이 된다.
     (실측: 그리드 716×300 상자에 860×540 그림 → 화면·네이티브는 위·아래 마커 띠 0행,
      썸네일만 초록 16행·주황 17행이 «나타났다». 상자 비율 = 그림 비율인 풀블리드는
      화면도 썸네일도 29행 — 같은 실행 안의 양성대조.)

   ★고치는 방법 — «규칙»이 아니라 «픽셀»로 준다.
     상자 크기대로 캔버스를 만들고 cover/contain 산식으로 직접 그려서 그 결과를 img.src 로
     갈아 끼운다. 그러면 html2canvas 가 그 그림을 상자에 늘려 그려도(=fill) 이미 잘린
     그림이라 «화면과 같은 그림»이 나온다.
   ⛔노드를 div 로 바꿔 background-size:cover 로 주는 길은 «안» 쓴다 — `.itb-icon img` 처럼
     «요소 선택자»로 크기를 주는 규칙이 있어 img 를 div 로 바꾸면 그 상자가 통째로 무너진다.
   ⚠️네이티브(CDP) 경로에선 부르지 말 것 — 브라우저가 object-fit 을 제대로 그린다.
     이 함수를 태우면 «두 번 자르기»가 되어 도리어 화면과 갈린다.
   ★비율이 이미 같으면(자를 것이 없으면) 손대지 않는다 — 재인코딩으로 화질이 상하지 않게.
   ★실패는 «조용한 통과»가 아니라 «전과 같음»이다 — tainted canvas(CORS)·디코드 실패는
     원본 img 를 그대로 두므로 고치기 전과 똑같이 동작한다(퇴행 없음).
   ★~~[정정 · 2026-09-25]~~ 「object-position 은 «center 고정»으로 계산한다 — 이 레포는 그
     속성을 한 군데도 안 쓴다(js·css 전수 0건). 쓰기 시작하면 여기도 같이 읽어야 한다.」
     ⇒ ★그 문장은 «쓰여진 날에도» 틀렸다. 지우지 않고 무엇이 틀렸는지 적는다.
       실측(js/ css/ 전수 grep, 2026-09-25): `objectPosition` 을 쓰는 자리가 «2건» 있다 —
         js/image-handling.js:31   applyImageTransform  (dataset.imgPosition 복원)
         js/image-handling.js:825  enterPosDragMode     (패널 「위치 조절」 드래그)
       `git log -S objectPosition -- js/image-handling.js` → f08bf3d **2026-03-24**.
       이 주석(f0b36a5)은 2026-09-21 이다. 즉 여섯 달 «먼저» 있던 것을 0건이라고 적었다.
     ⇒ 결과: 에셋 블록에서 「위치 조절」로 맞춘 그림이 ★썸네일·목업·html2canvas 폴백에서만
       가운데로 되돌아갔다(화면·네이티브 PNG 는 멀쩡하다 — 브라우저가 제대로 그린다).
     ⇒ 그래서 아래가 computed `object-position` 을 «읽는다». 기본값(50% 50%)이면 셈은 전과 같다.
   ⛔<video> 는 건드리지 않는다 — html2canvas 는 애초에 비디오 프레임을 못 그린다(별개 축).
   부르는 곳(html2canvas 3경로): js/io/save-load.js captureThumbnail ·
     js/props/prop-mockup.js _captureAndApply · js/io/export-image.js 의 html2canvas 폴백.
   반환 = 실제로 갈아 끼운 그림 수(검사·디버깅용).
   ══════════════════════════════════════════════════════════════════════════ */
/** computed `object-position` 한 축을 「남는 자리(free)」에 대한 px 여백으로 푼다.
 *  ⛔키워드(left/center/…)는 computed 값에서 이미 ％로 내려오는 것이 보통이지만, 브라우저가
 *    키워드를 그대로 줄 수도 있으므로 표로 받아 둔다(모르면 50% = 가운데). */
function _objPosAxis(token, free) {
  const KEY = { left: 0, top: 0, center: 50, right: 100, bottom: 100 };
  const t = String(token || '').trim().toLowerCase();
  if (KEY[t] !== undefined) return free * KEY[t] / 100;
  const m = t.match(/^(-?[\d.]+)(px|%)$/);
  if (!m) return free / 2;                       // 못 읽으면 «전과 같이» 가운데
  const v = parseFloat(m[1]);
  return m[2] === '%' ? free * v / 100 : v;
}

/** 두 축을 한꺼번에. 값이 하나뿐이면 세로는 가운데(CSS 기본 규약). */
function _objectPositionOffsets(cs, freeX, freeY) {
  const raw = String((cs && cs.objectPosition) || '').trim();
  if (!raw) return { x: freeX / 2, y: freeY / 2 };
  const parts = raw.split(/\s+/);
  const xTok = parts[0];
  const yTok = parts.length > 1 ? parts[1] : 'center';
  return { x: _objPosAxis(xTok, freeX), y: _objPosAxis(yTok, freeY) };
}

export async function neutralizeObjectFitForH2C(root) {
  if (!root) return 0;
  const imgs = [
    ...(root.matches?.('img') ? [root] : []),
    ...root.querySelectorAll('img'),
  ];
  let n = 0;
  for (const el of imgs) {
    try {
      const cs = (typeof getComputedStyle === 'function') ? getComputedStyle(el) : null;
      const fit = (cs?.objectFit || '').trim();
      if (fit !== 'cover' && fit !== 'contain') continue;
      /* 상자는 «레이아웃 px»로 잰다 — 이 클론은 body 직속(position:fixed)이라 캔버스 줌
         (transform:scale) 밖이지만, offsetWidth 는 배율에 아예 안 속는다. */
      const bw = el.offsetWidth, bh = el.offsetHeight;
      if (!(bw > 0) || !(bh > 0)) continue;
      if (!el.complete || !el.naturalWidth) { try { await el.decode(); } catch (_) { /* 못 읽으면 그대로 둔다 */ } }
      const nw = el.naturalWidth, nh = el.naturalHeight;
      if (!(nw > 0) || !(nh > 0)) continue;
      /* 비율이 같으면 cover 도 contain 도 «아무것도 안 자른다» — 건드릴 이유가 없다.
         ★«상대»오차로 잰다 — 절대값으로 재면 비율 자체가 큰 상자(가로로 긴 띠)에서는
           같은 어긋남도 크게 나오고, 400×251.16 처럼 offsetHeight 반올림(251)만으로도
           문턱을 넘어 «자를 것도 없는데» 재인코딩한다(실측: DOM T3 에서 걸렸다). */
      const boxR = bw / bh, imgR = nw / nh;
      if (Math.abs(boxR - imgR) / imgR < 0.005) continue;
      const s = fit === 'cover' ? Math.max(bw / nw, bh / nh) : Math.min(bw / nw, bh / nh);
      const dw = nw * s, dh = nh * s;
      const cvs = document.createElement('canvas');
      cvs.width  = Math.max(1, Math.round(bw));
      cvs.height = Math.max(1, Math.round(bh));
      const ctx = cvs.getContext('2d');
      if (!ctx) continue;
      ctx.imageSmoothingQuality = 'high';
      /* ★object-position 을 «실제로» 읽는다(위 정정 참조). 기본값 `50% 50%` 면 옛 셈과 같다.
         CSS 규약: ％는 「그림의 X％ 지점을 상자의 X％ 지점에 맞춘다」 ⇒ 남는 자리 × ％.
                   길이(px)는 그 값 자체가 왼쪽/위 여백이다.
         contain 이면 남는 자리는 «투명»으로 둔다(전과 같다). */
      const pos = _objectPositionOffsets(cs, cvs.width - dw, cvs.height - dh);
      ctx.drawImage(el, pos.x, pos.y, dw, dh);
      const url = cvs.toDataURL('image/png');   // tainted 면 여기서 던진다 ⇒ catch 로 «전과 같음»
      el.src = url;
      el.style.objectFit = 'fill';              // 이미 잘린 그림이다 — 두 번 자르지 않게
      try { await el.decode(); } catch (_) {}   // html2canvas 가 바로 읽을 수 있게
      n++;
    } catch (_) { /* 이 한 장만 «전과 같이» 둔다 */ }
  }
  return n;
}

/* ══════════════════════════════════════════════════════════════════════════════
   빈 이미지 칸 «체커보드» 걷기 — 캡처 클론 공용 (export PNG · truth · 썸네일)

   ★무엇이 틀렸나 (실측 2026-09-21, 사용자관점훑기 exportvisual)
     내보낸 860×1399 PNG 에 «이미지 안 넣은 칸»의 체크무늬가 그대로 찍혔다:
       asset-block 영역 770px 띠 → #F0F0F0 322,080px + #D8D8D8 322,060px
       배너 이미지칸 250×230   → #E3E3E3  19,963px + #EFEFEF  19,962px
     체커는 «투명을 표시하는 편집용 무늬»지 콘텐츠가 아니다.

   ★왜 안 걸러졌나 — 「체커를 CSS 클래스에 두면 자동으로 결과물에 안 나간다」는 공식
     (css/editor-blocks.css [M38-b] 주석)은 «어느 경로에서도 더는 맞지 않는다».
     ⑴PNG — js/io/export-image.js prepareCloneForCapture 가 클론을 document.body.appendChild 로
       «라이브 문서에 붙여» 캡처한다 ⇒ 앱 CSS 가 전부 먹어 클래스 체커도 그려진다.
     ⑵단독 HTML — 애초의 전제(「앱 CSS 를 안 싣는다」)가 2026-09-21 0180c54 에서 «깨졌다».
       js/io/export-html.js:259 가 collectCanvasCss(canvasEl) 로 앱 CSS 를 실어 보내면서,
       .asset-block{…repeating-conic-gradient…} 가 배송본 <style> 에 그대로 실린다.
       (실측 EVAL medium, 2026-09-21: 내보낸 HTML 의 .asset-block 이 실제로 체커로 그려졌다.
        banner02 는 .bn2-img-empty «클래스를 벗겨» 살았지만, .asset-block 은 블럭 «자신의»
        클래스라 벗길 대상이 없어 그대로 샜다 — 클래스 제거 목록은 이 결함군을 못 닫는다.)
     ⇒ 세 산출물(PNG·썸네일·단독 HTML)이 «같은 서명»으로 걷는다. 단독 HTML 은 두 갈래로 닫는다:
       인라인 체커는 이 함수(떼어낸 클론에서도 돈다), 클래스 체커는 CSS 수확 쪽
       (js/io/export-css-collect.js — 같은 /repeating-conic-gradient/ 서명).

   ★어떻게 잡나 — 블록 타입 셀렉터를 «나열하지 않는다»(손으로 적은 목록은 반드시 늙는다).
     렌더 결과의 computed background-image «서명»(/repeating-conic-gradient/)으로 판정한다.
     같은 판정법이 js/io/export-figma-json.js:457 에 이미 있다 — 새 발명이 아니라 재사용이다.
     이 레포에서 conic gradient 를 «사용자 데이터»로 만드는 길은 없다(그라데이션 모델은
     linear/radial 뿐 — js/props/gradient-model.js 전수 'conic' 0건). 그래서 이 서명은
     곧 「편집용 체커」와 동치다.

   ⛔background-image 를 통째로 none 으로 박지 «않는다» — 다중 레이어가 있다.
     js/blocks/mockup-block.js applyMockupScreenImage 와 js/io/save-load.js:1394 는
     `url(...) top center / cover no-repeat, <체커>` 로 «실제 화면 이미지 밑에» 체커를 깐다
     (투명 PNG 대비 안전망). 통째로 지우면 목업의 진짜 그림이 사라진다.
     ⇒ 체커 레이어«만» 골라 빼고 나머지는 순서 그대로 재조립한다.
     ★background-size/position/repeat 는 따로 손대지 않는다 — CSS 는 레이어 수를
       background-image 로 정하고 남는 값은 «버린다». 첫 레이어의 cover/top center 는 그대로 산다.

   ★남는 레이어가 없으면 'none' — 배경«색»은 안 건드린다(섹션 배경이 비쳐야 맞다).
   ★.shape-block[data-shape-fill="image"] 의 바둑판은 stripEditorOnlyForCapture 가
     «속성 제거»로 이미 처리한다 — 거기 두고 여기선 건드리지 않는다(두 벌이 되지 않게
     방식이 다르다: 저긴 편집용 «속성», 여긴 렌더된 «무늬»).

   ⚠️호출 규약 — 클론이 문서에 «붙은 뒤», 그리고 컴포넌트 재렌더(renderComponentsInClone)
     «뒤»에 불러야 한다.
       ⑴ 붙기 전이면 getComputedStyle 이 비어 클래스 기반 체커를 못 잡고 조용히 no-op 된다.
       ⑵ banner02·canvas-block 은 재렌더가 DOM 을 새로 만든다 — 앞에서 지우면 되살아난다.
   부르는 곳(3): js/io/export-image.js renderComponentsInClone(=export 와 truth 가 «같이» 쓰는
     ②단계. 한 자리라 두 그림이 갈릴 수 없다) · js/io/save-load.js captureThumbnail(재렌더가
     없는 경로라 거기서 직접 부른다) · js/io/export-html.js(단독 HTML — 클론이 문서에 «안» 붙는다).
   ★떼어낸 클론에서도 돈다 — computed 가 비면 «인라인»으로 떨어져 본다. 떼어낸 트리에서
     클래스 체커를 못 잡는 것은 한계가 아니라 분업이다(그 몫은 export-css-collect.js 가 진다).
   반환 = 실제로 손댄 요소 수(검사·디버깅용).
   ══════════════════════════════════════════════════════════════════════════ */
const _CHECKER_RE = /repeating-conic-gradient/i;

/** `a, b, c` 를 «괄호 깊이»를 세며 자른다 — gradient 안의 콤마에 속지 않는다. */
export function splitBgLayers(css) {
  const out = [];
  let depth = 0, cur = '';
  for (const ch of String(css || '')) {
    if (ch === '(') depth++;
    else if (ch === ')') depth--;
    if (ch === ',' && depth === 0) { out.push(cur.trim()); cur = ''; continue; }
    cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

export function neutralizeEmptyImageCheckerForCapture(clone) {
  if (!clone) return 0;
  const all = [...(clone.nodeType === 1 ? [clone] : []), ...clone.querySelectorAll('*')];
  let n = 0;
  for (const el of all) {
    /* 붙은 클론이면 computed 가 «클래스» 체커까지 잡는다. 떼어낸 클론(단독 HTML)은 computed 가
       비므로 «인라인»으로 떨어져 본다 — 판정식은 한 벌(_CHECKER_RE)로 같다. */
    let bg = '';
    try { bg = window.getComputedStyle(el)?.getPropertyValue('background-image') || ''; } catch (_) { bg = ''; }
    if (!bg || bg === 'none') bg = el.style?.backgroundImage || '';
    if (!_CHECKER_RE.test(bg)) continue;
    const kept = splitBgLayers(bg).filter(layer => !_CHECKER_RE.test(layer));
    // 클래스가 건 배경은 인라인으로 «지울» 수 없다 — 명시적으로 덮어쓴다.
    el.style.setProperty('background-image', kept.length ? kept.join(', ') : 'none');
    n++;
  }
  return n;
}

/* ── 미입력 안내문구 숨기기 — «두 번» 불러야 하는 한 가지 ──────────────────────
 * 미입력 placeholder 안내문구는 산출 결과에 박히면 안 된다.
 * data-is-placeholder="true"는 실제 글자가 들어가면 즉시 삭제되므로, 클론에 true로 남은
 * 요소는 미입력 placeholder가 확정 → 안내문구 «가시성만» 숨겨 자식 DOM(<li>/<span> 등)과
 * 점유 높이는 그대로 둔다. (textContent='' 는 tb-bullet의 <li> 등 자식 DOM을 통째로 제거해
 *  height가 collapse되므로 금지. visibility:hidden은 자식·list marker까지 숨기되 박스 높이 유지.)
 *
 * ★2026-09-21 사용자관점훑기 exportvisual — 이걸 «함수로 뺀 이유»:
 *   ①stripEditorOnlyForCapture 는 컴포넌트 재렌더(export-image.js renderComponentsInClone)
 *   «앞»에 돈다. banner02·canvas-block·comparison-block 은 그 재렌더가 DOM 을 통째로 다시
 *   만들어 여기서 건 visibility 를 «지운다» ⇒ 배너·카드의 안내문구가 그대로 PNG 에 찍힌다.
 *   실측(2026-09-21, 실앱 9525): 배너에 data-is-placeholder 를 붙인 «뒤»에도 export PNG 에
 *   「라벨입니다./제목을 입력합니다./캡션이 입력됩니다.」가 그대로 나왔다 — 표시는 맞았고
 *   타이밍이 틀렸다. ⇒ 재렌더 «뒤»에 한 번 더 부른다. 멱등이라 두 번 돌아도 결과가 같다.
 *   ⛔이 함수를 stripEditorOnlyForCapture 안에서 «인라인»으로 되돌리지 마라 — 되돌리는 순간
 *     재렌더 뒤 호출부가 사라져 배너·카드 안내문구가 조용히 다시 샌다. */
/* ★표식을 «믿지» 말고 글자를 재라 (2026-09-22 · T-039 「섹션 내보내기가 흰 페이지」 재현).
 *   이 함수의 전제는 위 주석의 한 줄 — 「data-is-placeholder="true" 는 실제 글자가 들어가면
 *   즉시 삭제되므로」였다. 그 전제가 «틀렸다». 글자를 쓰는 자리가 편집 경로 말고도 있고,
 *   그중 js/ai-section-fill.js applyAIReplacements 는 textContent 만 바꾸고 표식을 안 뗐다.
 *   ⇒ 화면엔 AI 가 채운 본문이 보이는데(흐릿할 뿐) 내보내기 클론에선 그 본문이 통째로
 *     visibility:hidden 이 된다. 글자만 있는 섹션이면 산출물이 «완전한 흰 페이지»가 된다.
 *   실측(2026-09-22, 실앱 9641 · 860×824 PNG · returnDataUrl):
 *     표식 남김 → 흰 픽셀 아닌 칸 0/708,640 · 표식만 제거 → 104,542 · 다시 붙이면 도로 0
 *     (바이트까지 동일 — 변수 하나가 흰 페이지를 켜고 끈다)
 *   ⇒ 쓰는 쪽(ai-section-fill.js)을 고치면서 «이 자리»도 같이 고친다. 쓰는 자리는 앞으로도
 *     늘어나는데, 읽는 자리가 표식 하나만 믿으면 다음 writer 가 생기는 날 조용히 또 샌다.
 *   ★술어는 «이미 이 레포에 있는 것»을 그대로 쓴다 — js/io/save-load.js 의 역방향 자가보정
 *     (C2/D2, `txt2 !== '' && txt2 !== (ph2||'').trim()` → 표식 제거). 같은 판단을 두 벌로
 *     쓰지 않게 뜻을 맞춘다: 「안내문구와 «다른» 글자가 들어 있으면 그건 본문이다」.
 *   ⛔data-placeholder 가 «없는» 요소는 그대로 숨긴다 — .cvb-card-ph(js/blocks/canvas-block.js)
 *     처럼 요소 자체가 안내문인 자리가 있다. 비교할 원문이 없으면 «숨기는 쪽»이 기존 동작이다. */
export function hidePlaceholderTextForCapture(clone) {
  if (!clone) return 0;
  const els = clone.querySelectorAll?.('[data-is-placeholder="true"]') || [];
  let n = 0;
  els.forEach(el => {
    if (!isStillPlaceholderText(el)) return;   // 본문이 들어와 있다 — 숨기면 그게 결함이다
    el.style.visibility = 'hidden';
    n++;
  });
  return n;
}

/* ══ 진단 한 줄 — 「내보냈더니 흰 페이지」를 «내보내는 그 순간» 가른다 (2026-09-22 · T-039) ══
 * ★왜 필요한가 — T-039 는 신고에서 원인까지 «일주일»이 걸렸다. 산출물이 백지로 나와도 앱이
 *   아무 말도 안 했기 때문이다(다운로드는 성공했고, 픽셀 게이트는 export 와 truth 를 «서로»
 *   비교하는데 둘 다 백지면 «같아서» 통과한다 — 「검출 0」을 「문제 없음」으로 읽는 그 병).
 * ★무엇으로 가르나 — 클론 «하나»만 본다. 라이브와 비교하지 않는다(섹션 라벨·툴바 같은 편집
 *   chrome 이 이미 걷혀 있어 분모가 깨끗하고, 비교 대상이 없어 경합도 없다):
 *     textContent = DOM 이 «가진» 글자 · innerText = 실제로 «그려지는» 글자
 *   (붙은 클론에서 innerText 는 display:none 도 visibility:hidden 도 «둘 다» 뺀다 — 실측 확인.)
 *   가진 글자는 있는데 그려지는 글자가 «0» 이면 그 섹션은 글자가 통째로 사라진 것이다.
 * ★원인을 안 고른다 — 안내문구든, 접힌 부모든, 아직 모르는 길이든 «증상»만 말하고 숨은
 *   요소의 표본을 같이 싣는다. 다음 신고 때 이 한 줄이 곧 재현 조건이다.
 * ⛔console.error 가 «아니다» — js/report-buffer.js 가 error 만 후킹해 링버퍼(20칸)에 담는다.
 *   전체 내보내기 22섹션이면 진단이 진짜 실패 기록을 밀어낸다(그 파일 머리말의 그 사고).
 * ⛔판정을 바꾸지 않는다 — 말만 하고 지나간다. 이 함수가 던져도 내보내기는 그대로 돈다. */
export function warnIfCaptureTextVanished(clone, ctx) {
  try {
    if (!clone) return null;
    const held = (clone.textContent || '').replace(/\s+/g, '');
    if (!held) return null;                       // 원래 글자가 없는 섹션 — 백지가 정상이다
    const shown = (clone.innerText || '').replace(/\s+/g, '');
    if (shown) return null;                       // 한 글자라도 그려지면 «통째 사라짐»이 아니다
    const hidden = [...clone.querySelectorAll('*')]
      .filter(el => el.style && el.style.visibility === 'hidden' && (el.textContent || '').trim())
      .slice(0, 5)
      .map(el => ({
        cls: (el.className && String(el.className).split(' ')[0]) || el.tagName,
        ph:  el.dataset?.placeholder ?? null,     // null 이면 안내문구가 «아닌» 것이 숨은 것이다
        txt: (el.textContent || '').trim().slice(0, 24),
      }));
    const info = { section: ctx?.sectionId || clone.id || '?', heldChars: held.length,
                   shownChars: 0, hiddenSample: hidden };
    console.warn('[export-blank] 캡처 클론에 글자가 하나도 «안 그려진다» — 산출물이 백지가 된다:', info);
    return info;
  } catch (_) { return null; }   // 진단이 내보내기를 깨뜨리면 안 된다
}

/** 이 요소가 «아직 안내문구»인가 — 표식 + 글자를 «둘 다» 본다.
 *  true  = 안내문구 그대로(또는 비었음, 또는 비교할 원문이 없음) ⇒ 산출물에서 숨긴다
 *  false = 안내문구와 다른 글자가 들어 있다 ⇒ 본문이다. 숨기면 내용이 사라진다. */
export function isStillPlaceholderText(el) {
  if (!el || el.dataset?.isPlaceholder !== 'true') return false;
  const ph = el.dataset.placeholder;
  if (ph == null || ph === '') return true;          // 비교할 원문이 없다 — 기존대로 숨긴다
  const txt = (el.textContent || '').trim();
  return txt === '' || txt === ph.trim();
}

/* ── 편집 전용 DOM·상태 걷기 (캡처 클론 공용) ────────────────────────────────────
 * ★2026-09-21 최종통합 QA medium: 「저장할 때 편집 중이던 상태가 프로젝트 목록 썸네일에
 *   그대로 박힌다」 — js/io/save-load.js captureThumbnail 은 클론에서 ⑴.section-label
 *   ⑵.section-toolbar ⑶루트의 .selected «셋»만 걷었고, 내보내기 클론이 걷는 나머지
 *   (펜 어노테이션·admin QA 블록·편집 전용 임시 DOM·미입력 placeholder 안내문구·자식
 *   블록의 .selected/.img-editing/.row-active 등)는 하나도 안 걷었다.
 *   실측(EXPORT-D): [thumb] 주석(자홍) 200px · 편집전용프록시(하늘) 100px 이 실제로 찍혔다.
 * ⇒ 명부를 «두 벌»로 두면 한쪽만 늙는다. 한 벌로 모아 두 경로가 같이 늙게 한다.
 *   ⛔여기 담는 것은 «편집 chrome 걷기»뿐 — 경로마다 다른 것(클론 위치·isolation·
 *     inset shorthand 변환·컴포넌트 재렌더)은 부르는 쪽에 남는다.
 * 부르는 곳: js/io/export-image.js prepareCloneForCapture · js/io/save-load.js captureThumbnail */
export function stripEditorOnlyForCapture(clone) {
  if (!clone) return;
  /* ★querySelector«All» 이다 — 이 명부를 단독 HTML 내보내기(js/io/export-html.js)가 같이 쓰면서
     클론이 «섹션 하나»가 아니라 «캔버스 전체»인 경우가 생겼다. 첫 하나만 지우면 나머지 섹션의
     라벨·툴바가 그대로 배송본에 실린다. 섹션 클론에서는 결과가 전과 같다(하나뿐이므로). */
  clone.querySelectorAll?.('.section-label, .section-toolbar').forEach(el => el.remove());
  clone.querySelectorAll('.variation-badge').forEach(el => el.remove());
  // C18: 펜툴 어노테이션(리뷰용 주석)과 진행중 미리보기는 리뷰 표시일 뿐 — 산출 이미지에 박히면 안 됨.
  // (대조: todo-pin은 #todo-pin-overlay로 섹션 밖이라 애초에 클론에 안 들어감)
  clone.querySelectorAll('.annotation-block, .annot-preview').forEach(el => el.remove());
  // admin QA 체크리스트 블록 — 콘텐츠가 아니라 작업 메타데이터다. 자리도 차지하면 안 되므로
  // 숨기지 않고 완전히 remove() 한다(annotation-block과 같은 원칙). 감싸는 .row 까지 지워야
  // 그 블록이 차지하던 세로 공간도 같이 사라진다.
  clone.querySelectorAll('.qa-block').forEach(el => {
    const row = el.closest('.row');
    if (row) row.remove(); else el.remove();
  });
  hidePlaceholderTextForCapture(clone);
  /* 이미지 메모(data-memo, 2026-09-30) — 빈 칸의 «제작 지시» 쪽지. 위 [data-is-placeholder] 와 같은
     성격(편집 화면에서만 보이는 안내)이다. 쪽지는 CSS 가상요소라 속성만 떼면 그림에서 사라진다.
     ★저장 경로(serializeCleanRoot)엔 이 명부가 안 쓰인다 — 메모는 프로젝트에 «남아야» 한다. */
  stripImageMemoForCapture(clone);
  // 편집 전용 임시 DOM — 캡처 클론에 새어 나가면 그림에 박힌다.
  clone.querySelectorAll('.sec-bg-proxy, .img-edit-hint, .img-boundary').forEach(el => el.remove());
  // 도형 «이미지 넣기 전» 바둑판(0918 picker) — 편집 전용 표시다. CSS 규칙이 data-shape-fill="image"
  //   (이미지 없음)에 걸리므로 클론에서 그 속성을 떼면 마지막 단색(svg color)으로 나간다. 이미지가
  //   실제로 들어간 도형(data-shape-image)은 인라인 div 라 그대로 둔다.
  clone.querySelectorAll('.shape-block[data-shape-fill="image"]:not([data-shape-image])').forEach(el => {
    el.removeAttribute('data-shape-fill');
  });
  /* 섹션 «체크 배경»(.sec-bg-empty)은 편집 전용 자리표시다. CSS 가 !important 라 인라인 지우기로는
     못 이긴다 — 클래스째 뗀다(루트·자손 둘 다). export-html.js 도 같은 클래스를 뗀다. */
  clone.classList?.remove('sec-bg-empty');
  clone.querySelectorAll?.('.sec-bg-empty').forEach(el => el.classList.remove('sec-bg-empty'));
  clone.classList?.remove('selected', 'sec-bg-editing');
  // 캔버스 전체 클론에서는 «루트»가 아니라 자식 섹션이 sec-bg-editing 을 달고 있다.
  clone.querySelectorAll?.('.sec-bg-editing').forEach(el => el.classList.remove('sec-bg-editing'));
  /* ★★.grd-cell-selected (2026-10-10 · 1009t3 A4) — ★빈 그리드 «칸» 선택 표시.
     ★증상 — ★이것이 ★★«배송본에 ★그려진» ★유일한 마커였다: 클래스가 단독 HTML 클론에 실리고
       (`js/io/export-html.js` 가 ★이 함수를 부른다), ★`css/editor-blocks.css:1799` 의
       `#canvas .grid-block .grd-cell-selected` 가 ★`export-css-collect.js` 의 ★배제 정규식을
       ★통과해 ★같이 수확되고, ★내보낸 HTML 엔 `<div id="canvas">` 래퍼가 ★있다.
       ⇒ ★배송본을 ★렌더해 잰 computed = `rgb(45,111,232) 0 0 0 2px inset`(2026-10-10 실측).
     ★★⚠️그런데 ★이 명부는 ★★«둘째 명부»다 — ★임자는 `js/io/section-serialize.js` 의
       `window.runtimeMarkers` 다. ★2026-10-10 에 ★두 명부를 ★함수 몸통으로 좁혀 견주니
       ★이 명부 ∖ 그 뿌리 = ★★3종(`col-active` · `item-selected` · `sec-bg-empty`)뿐이었다
       (`item-selected` 는 ★그 커밋에서 ★뿌리로 ★옮겼다 ⇒ 남는 것은 ★둘).
       ⇒ ★★그러니 ★여기는 ★`stripRuntimeMarkers` 위임 ＋ ★«산출물 전용 2종»으로 ★모을 수 있다.
       ★★⛔이번에 ★안 모았다. ★까닭을 ★수로 적는다: ★이 함수를 ★«실행하는» DOM 검사 ★9벌이
         ★부분 하네스(`boot`)라 ★`section-serialize.js` 를 ★안 싣는다 ⇒ `window.runtimeMarkers`
         가 ★undefined 다. ★위임하면 ★그 9벌이 ★한꺼번에 빨강이거나(명시 실패) ★★조용히
         안 씻는다(폴백을 두면). ★★둘 다 ★이번 티켓보다 ★크다.
       ★★★⛔그리고 ★모을 때 ★★«합집합»으로 ★하지 ★마라 — ★★`A ⊇ B` 는 ★★★거짓이다(2026-10-10 실측).
         ★자 = ★두 명부를 ★★«함수 몸통»으로 좁혀(⛔파일 전체가 아니다) ★주석 떼고 ★뜬 뒤
           ★`isRuntimeMarker` 를 ★실행해 물었다. ★결과:
             ★B(이 함수) ∖ A = ★3종  col-active · item-selected · sec-bg-empty
             ★C(export-html exportHTMLFile) ∖ A = ★6종  bn2-img-empty · cvb-img-empty ·
                cvb-img-empty-plain · grd-img-empty · item-selected · sec-bg-empty
             ★D(export-image renderComponentsInClone) ∖ A = ★0종
           ⇒ ★`item-selected` 를 ★A 로 옮긴 뒤 ★남는 ★«산출물 전용» 후보 = ★★6종
         ★★그 6종 중 ★★5종(`sec-bg-empty`·`bn2-img-empty`·`cvb-img-empty`·`cvb-img-empty-plain`·
           `grd-img-empty`)은 ★★«빈 이미지/배경 ★자리표시»다 ⇒ ★★★저장본에 ★남아야 한다.
           ★★A 가 그것을 ★삼키면 ★`tests/dom/grid-cell-emptied.dom.spec.js` ★E
           (「★저장·재열기 왕복에서 ★빈 칸이 ★머문다」)가 ★빨개진다 = ★★멀쩡한 것을 ★깬다.
         ★★⇒ ★★★방향은 ★하나뿐이다: ★★`B(산출물) = A(저장 뿌리) ＋ ARTIFACT_ONLY[6종]`.
           ⛔그 반대(A 가 B 를 삼키기)는 ★데이터 손실이다.
         ★★⇒ ★★교훈: ★★「명부가 둘이면 ★파생시켜 하나로」의 ★«파생»은 ★★«합집합»이 ★아니다 —
           ★★★파생시키기 ★전에 ★★«포함관계»를 ★재라.
         ★★⇒ ★그 6종 명부와 ★「그중 하나가 ★A 에 ★들어오면 ★빨강」은
           ★`tests/unit/selected-marker-census.test.mjs` 가 든다.
       ★★⇒ ★모으기는 ★지디 명부로 올렸다(2026-10-10). ★그때 ★같이 고칠 것 =
         ★그 9벌 하네스에 `js/io/section-serialize.js` 한 줄 ＋ ★`col-active` 가 ★저장에도
         ★필요한가(★안 쟀다 — `row-active` 는 뿌리에 있는데 ★그것만 없다).
     ★★⛔그 사이에 ★이 명부와 ★뿌리가 ★다시 갈리지 않게 ★`tests/_export-channels.js`
       `MARKER_TOKENS` 가 ★두 자리를 ★같은 토큰으로 ★동시에 잰다. */
  // 자식 블록의 UI 상태 클래스 전부 제거 (outline, dashed border, opacity 등 오염 방지)
  /* ★★명부는 ★«한 벌»이다 — ★선택자와 ★`remove` 인자를 ★★같은 배열에서 ★파생시킨다.
     ★★왜 (2026-10-10 · advqa 가 ★실물로 심어 증명):
       ★예전 꼴은 ★명부를 ★★«두 벌» 들었다 — ⒜어느 요소를 ★돌까(선택자) ⒝무엇을 ★벗길까(remove 인자).
       ★★둘 다 있어야 ★벗겨지는데, ★★한쪽만 지운 변이가 ★★«검사 9/9 초록 · rc 0»으로 ★지나갔다:
         ★M1 = ⒝ 에서만 뺌 ⇒ 요소는 돌지만 ★안 벗긴다 ⇒ ★누수 부활 ★★거짓초록
         ★M3 = ⒜ 에서만 뺌 ⇒ 그 요소를 ★아예 안 돈다 ⇒ ★누수 부활 ★★거짓초록
         ★M2 = ★둘 다 뺌   ⇒ ★fail 1 · rc 1 ✅ (★자는 ★죽지 않았다 — ★★반쪽을 ★못 봤을 뿐)
     ★★⇒ ★경고 주석으로는 ★못 막는다. ★★«파생시켜 ★하나로» 둔다 ⇒ ★M1·M3 은 ★★지을 수 ★없는 변이가 된다.
     ⛔이 배열을 ★★다시 ★두 벌로 ★풀지 ★마라. ★늘릴 때는 ★★여기 ★한 줄만 보탠다.
     ★row-active/col-active(2026-09-15 a1-a3 지적): editor-blocks.css 가 이 둘에 z-index:1 을
       줘서(활성 줄/칸 강조용) .row/.col 이 스태킹 컨텍스트가 된다 — 벗기기 목록에 없으면
       클론에 그대로 남아, 그 안의 redact 도형이 z-index:3 을 받아도(:has() 규칙)
       «줄 전체»가 z-index:1 에 갇혀 겹치는 다른 줄의 글자(z-index:2)보다 아래일 수 있다.
     ★grd-cell-selected(2026-10-10 · 1009t3 A4) — ★빈 그리드 «칸» 선택 표시. ★이것이 ★★«배송본에
       ★그려진» ★유일한 마커였다(실측 computed `rgb(45,111,232) 0 0 0 2px inset`).
     ★★잠그는 자 = `tests/unit/export-channel-roster.test.mjs` U6-c (★MARKER_TOKENS 4종) ＋
       `tests/dom/grid-cell-selected-leak.dom.spec.js` L4. */
  const EDITOR_STATE_CLS = [
    'selected', 'img-editing', 'editing', 'dragging',
    'group-selected', 'group-editing', 'ss-drag-over', 'drag-over',
    'item-selected', 'bn2-line-selected', 'bn2-line-empty',
    'grd-line-selected', 'grd-cell-selected', 'stb-line-selected', 'stb-step-selected',
    'row-active', 'col-active',
  ];
  clone.querySelectorAll(EDITOR_STATE_CLS.map(c => '.' + c).join(','))
    .forEach(el => el.classList.remove(...EDITOR_STATE_CLS));
  /* ★프라이버시(2026-09-15, a1-a3 지적+elementFromPoint 실측 확인 — T-027 z-index 수정
   * (editor-blocks.css .shape-block.shape-redact z-index:3)의 잔여 구멍): transform이
   * 걸린 조상은 «새 스태킹 컨텍스트»를 만든다 — 그 안의 redact 도형은 z-index:3이어도
   * «조상 밖»의 형제(.text-block 등, z-index:2)와 직접 비교되지 못한다. 조상 자신이
   * z-index:auto면 밖의 형제가 조상 전체(=속의 redact 도형까지) 위에 그려질 수 있다.
   * frame-block은 applyFrameTransform(frame-geometry.js)이 거의 항상 인라인 transform을
   * 써서 이 조건에 걸린다. ⇒ 특정 클래스를 나열하지 않고 «인라인 transform이 있는 조상
   * 전부»를 redact 도형마다 훑어 같이 z-index를 끌어올린다. 클론에만 적용 — 라이브
   * DOM·selected 상태의 실제 스태킹 동작은 안 건드린다.
   * ★썸네일 경로도 같이 받는다(2026-09-21) — 썸네일은 프로젝트 목록에 그대로 보이는 그림이라
   *   가림막이 새면 내보내기와 똑같이 새는 것이다. */
  clone.querySelectorAll('.shape-block.shape-redact').forEach(shp => {
    for (let anc = shp.parentElement; anc && anc !== clone; anc = anc.parentElement) {
      if (anc.style && anc.style.transform && anc.style.transform !== 'none') {
        const curZ = parseInt(anc.style.zIndex, 10);
        if (!Number.isFinite(curZ) || curZ < 3) anc.style.zIndex = '3';
      }
    }
  });
}

/* ══ 편집 보조(그리드 가이드·패딩 비주얼)를 «캡처 동안» 끈다 — 한 벌 (L1, 2026-10-04) ══════════════════
   html2canvas 는 문서(body 클래스 포함)를 복제해 그린다 · 네이티브 캡처는 화면을 그대로 찍는다 ⇒ 캡처 동안만 body 클래스를 뗐다 붙인다.
   ★부르는 곳 둘: js/io/export-image.js exportSection(PNG) · js/io/save-load.js captureThumbnail(썸네일).
   ⛔부르는 쪽에 같은 규칙을 다시 적지 마라 — 두 벌이면 한쪽이 늙는다(L1 전엔 썸네일 쪽에 가드가 «없었다»:
     지금까지 안 샌 것은 html2canvas 가 repeating 그라데이션을 못 그려서였다 — tests/dom/l1-guide-align L1-X).
   ★save-load.js 는 이 이름 «하나»만 안다 — 가이드 클래스 이름을 모른다(tests/unit/grid-guide.test.js G5 의 뜻). */
export async function withGuideOff(fn) {
  const b = document.body;
  const g = b.classList.contains('gdt-grid-on');
  const p = b.classList.contains('gdt-pad-on');
  if (g) b.classList.remove('gdt-grid-on');
  if (p) b.classList.remove('gdt-pad-on');
  try {
    return await fn();
  } finally {
    if (g) b.classList.add('gdt-grid-on');
    if (p) b.classList.add('gdt-pad-on');
  }
}

/* ── captureSectionImage(sec) — 섹션 하나를 그림(data URL)으로 «찍기»만 하는 공용 자리 (G11 ① · 2026-10-05) ──
   prop-mockup.js _captureAndApply 에서 «찍기» 몫을 그대로 옮겨 왔다(동작 무변 리팩터) — 붙이기(pushHistory·dataset·숨김·토스트)는
   부르는 쪽 몫이라 여기 «안» 넣는다.
   반환: { ok:true, dataUrl } | { ok:false, reason:'no-h2c' | 'degenerate' } · 그 밖 오류는 «던진다»(부르는 쪽 catch 문구 그대로).
   ⚠️옮기며 생긴 차이 하나: 클론 치우기가 «붙이기 뒤» → «붙이기 앞»(이 함수 finally). 클론은 body 의 화면 밖 노드라
     캔버스 직렬본·pushHistory 표본에 안 든다(코드독해 — G11 ① 증명 ⑷가 바이트로 잰다). */
export async function captureSectionImage(sec) {
  if (typeof html2canvas === 'undefined') return { ok: false, reason: 'no-h2c' };
  let clone = null;
  try {
    // 클론 후 오프스크린에 배치 (ignoreElements 없이 깔끔하게 찍기)
    clone = sec.cloneNode(true);
    clone.querySelector?.('.section-hitzone')?.remove();
    clone.querySelector?.('.section-toolbar')?.remove();
    clone.classList.remove('selected');
    // 선택 아웃라인 제거
    clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
    /* ★display:block 을 «같이» 건다 — 이 줄이 이 고침의 절반이다(2026-09-22).
       한 번 캡처한 섹션은 아래에서 sec.style.display='none' 으로 숨는다. 그 섹션을 «다시»
       캡처하면 cloneNode 가 그 display:none 까지 베껴 와, html2canvas 가 크기 0 짜리를 그리고
       canvas 가 0×0 이 된다. ⛔그때 toDataURL 은 «던지지 않고» 문자열 "data:," 를 «돌려준다»
       — 아래 try/catch 는 예외만 보므로 그대로 통과해 멀쩡한 PNG 를 6자로 덮고
       「캡처 완료!」라고 말했다(2026-09-21 실측: 928,378자 → 6자).
       ⛔원본 sec 의 display 를 건드리지 않는다 — 클론만 편다. 원본을 폈다 접으면 화면이
         깜빡이고, 도중에 실패하면 숨김 상태가 어긋난 채 남는다.
       ★cssText 뒤에 붙이므로 앞서 베껴 온 display:none 을 이긴다(뒤가 이긴다). */
    clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;margin:0;outline:none;box-shadow:none;display:block;';
    document.body.appendChild(clone);
    neutralizeRedactForH2C(clone); // html2canvas는 backdrop-filter 미지원 → 가림막 원본노출 방지(안전실패)
    neutralizeTextGradForH2C(clone); // html2canvas는 background-clip:text 미지원 → 글자 그라데이션은 첫 스탑 단색으로(0918r2 textgrad)
    await neutralizeObjectFitForH2C(clone); // html2canvas는 object-fit 미지원 → 상자에 «늘려» 그린다. 상자 크기대로 미리 잘라 끼운다(썸네일이 화면과 다른 그림이 되던 자리)
    if (window.finalizeMosaicForClone) { try { await window.finalizeMosaicForClone(sec, clone); } catch (_) {} }
    /* ★svg 에 닿는 CSS transform 을 «감싸는 span»으로 올린다 — html2canvas 는 svg 쪽 것을 ★안 그린다
       (월계수 오른 잎 거울이 ★썸네일에서 사라지던 자리 · 현빈 2026-10-09). ★까닭·실측은 h2c-prep.js 머리말.
       ⛔클론이 ★document 에 ★붙은 «뒤»라야 한다 — detached 면 computed transform 이 ★빈 문자열이다. */
    try { liftSvgTransformsForH2C(clone); } catch (e) { console.warn('[capture] svg transform 올리기 실패:', e); }

    const bgColor = sec.style.backgroundColor || sec.style.background || '#ffffff';
    const canvas = await html2canvas(clone, {
      scale: 2,
      useCORS: true,
      backgroundColor: bgColor || '#ffffff',
      logging: false,
    });
    const dataUrl = canvas.toDataURL('image/png');

    /* ★짝 검사 — «입구»만 막지 말고 «결과»를 재라(2026-09-22).
       위 display:block 은 «지금 아는 한 가지 원인»만 덮는다. 캔버스가 0 이 되는 길은 그것
       하나라는 보장이 없다(섹션이 0 높이·부모가 접힘·html2canvas 자체 실패 등).
       ⛔그리고 이 자리의 병은 «캔버스가 0 이 되는 것»이 아니라 «0 인 줄 모르고 덮는 것»이다.
       toDataURL 은 0×0 에서 예외를 «안» 던지고 "data:," 를 돌려주므로 try/catch 로는 못 잡는다.
       ⇒ 덮기 «전»에 결과를 재고, 빈 그림이면 가진 것을 지키고 «사실대로» 말한다. */
    /* ★판정은 js/io/image-data-url.js «한 곳»에서 한다 (T-148).
       여기 128 을 다시 적지 마라 — 2026-09-22 에 이 사본과 썸네일 사본이 «둘»로 갈렸고,
       그날 안에 모았다. tests/unit/one-empty-image-judge.test.mjs 가 셋째를 막는다.
       ⛔판정기가 없으면 «빈 그림으로 친다» — 배선이 깨졌을 때 «가진 그림을 지키는» 쪽이 안전하다.
         (조용히 덮는 것보다 「캡처 실패」라고 말하고 멈추는 것이 낫다.) */
    const _judge = window.isUsableImageDataUrl;
    const _degenerate = !canvas.width || !canvas.height || typeof _judge !== 'function' || !_judge(dataUrl);
    if (_degenerate) return { ok: false, reason: 'degenerate' };   // 문구·«가진 그림 지킴»은 부르는 쪽 몫
    return { ok: true, dataUrl };
  } finally {
    clone?.remove();
  }
}

/* ══════════════════════════════════════════════════════════════════════════════
   ★반사(-webkit-box-reflect)의 html2canvas 대체 — ★썸네일 전용 (C 버그 ② · 2026-10-08 지디 레인 gd/thumb)
   ─────────────────────────────────────────────────────────────────────────────
   ★병 — 동봉 html2canvas 1.4.1 은 `-webkit-box-reflect` 를 «모른다»(vendor 바이트 전수 0건:
     `boxReflect`·`box-reflect` 둘 다). 그래서 반사가 그림에서 ★통째로 빠진다.
   ★PNG 는 괜찮다 — 주 경로가 CDP 네이티브 캡처라 브라우저 합성이 반사를 그려 준다
     (tests/dom/effects-reflection R4 가 그 둘을 픽셀로 갈라 둔다: 주 경로 = 주황 틴트 · h2c = 흰색).
     ★그 R4 의 「의도됨」은 ★PNG 의 ★대체 경로 이야기다 — ★썸네일엔 ★대체가 ★없다.
     썸네일은 html2canvas 가 ★유일한 길이므로, 프로젝트 카드가 ★언제나 화면과 다른 그림이 된다.
   ⇒ ★클론에만 «DOM 거울»을 세운다.
     ⛔R5(effects-reflection)가 DOM 거울을 금한 것은 ★«라이브 DOM» 이야기다 — innerText/textContent
       35+459 곳이 글자를 «두 번» 읽는다. ★이 클론은 찍고 바로 removeChild 되고 ★직렬화되지 않는다.
       그래도 거울에 `aria-hidden` 을 달고 ★id 를 전부 지운다(읽는 자가 와도 두 번 세지 않게).
   ★페이드는 ★mask 로 못 한다(html2canvas 는 mask 도 모른다) ⇒ ★배경색 막(scrim)으로 «같은 그림»을 만든다.
     ★이것은 근사가 아니라 ★항등이다 — 반사가 ★단색 배경 위에 앉을 때:
        참:  bg(1−α) + M·α                      (α = 그 자리의 반사 알파)
        내:  거울을 op 로 깔고 → bg(1−op) + M·op  그 위에 rgba(bg, a) 막을 덮으면
             bg(1−op(1−a)) + M·op(1−a)         ⇒ α = op(1−a) 로 ★같다.
     ⇒ a(y) 만 맞추면 된다.
   ★α(y) 의 꼴 — effects-reflect.js 가 거는 마스크는
       `linear-gradient(to bottom, rgba(0,0,0,0) (100−len)%, rgba(0,0,0,op))` 이고
     크로미움은 그 마스크를 ★반사와 ★같이 뒤집는다(그래서 그 파일 주석의 실측이 「near 틴트 · far 흰」이다).
     ⇒ 블럭 바닥에서 아래로 d, u = d/h 라 하면
        보이는 길이 = h·len/100 · α(u) = (op/100)·(len/100 − u)/(len/100)  — ★선형, 위가 진하고 끝에서 0.
     ⇒ a(u) = 1 − α/(op/100) = u/(len/100) ⇒ 막 = ★위 rgba(bg,0) → ★아래 rgba(bg,1) 선형 ★하나.
   ★값은 ★정본에서 ★읽는다 — js/effects-reflect.js `fxReflectOf`(패널·렌더·시험이 보는 ★그 함수).
     ⛔인라인 webkitBoxReflect 문자열을 파싱하지 마라 — 그러면 명부가 ★둘이 된다.
   ⛔CDP 네이티브 경로에서 부르지 마라 — 브라우저가 반사를 ★제대로 그린다(거울이 ★두 겹이 된다).
   ★돌려주는 것 = 거울을 ★세운 수(0 이면 반사 켠 블럭이 ★없었다).
   ══════════════════════════════════════════════════════════════════════════════ */
const H2C_REFLECT_CLASS = 'h2c-reflect-mirror';

/** '#rgb'·'#rrggbb'·'rgb()'·'rgba()' → [r,g,b]. 못 읽으면 null(그러면 거울을 안 세운다 — 안전실패). */
function _rgbTriple(css) {
  const c = String(css || '').trim();
  const m = c.match(/^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)/i);
  if (m) return [m[1], m[2], m[3]].map(n => Math.max(0, Math.min(255, Math.round(+n))));
  let h = c.match(/^#([0-9a-f]{3})$/i) ? c.slice(1).split('').map(x => x + x).join('') : (c.match(/^#([0-9a-f]{6})$/i) ? c.slice(1) : null);
  if (!h) return null;
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16));
}

/** ★★«산출물»을 만들 클론에서 ★★«런타임 값»을 ★쉬는 꼴로 되돌린다 (2026-10-09 · 지디 ⑷ 판정).
 *
 *  ★★왜 ★한 겹인가 — ⛔`restParticleMotion` 을 ★날로 ★두 곳에서 ★부르면
 *    ★★«무엇을 세척해야 하나»가 ★두 자리에 ★퍼진다. ★⒟(번짐을 속도에 묶기)가 ★`stdDeviation` 을
 *    ★더하는 날 ★두 곳을 ★다 고쳐야 하고, ★한 곳을 잊으면 ★★조용히 ★반쪽이 된다.
 *    ⇒ ★★넓힐 때는 ★★이 함수 ★하나만 넓힌다.
 *
 *  ★★누가 부르나 (★2026-10-09 전수 · ★게이트 = tests/unit/artifact-clone-roster):
 *    ✅ `js/io/save-load.js` captureThumbnail  — ★썸네일 → `_meta.json`
 *    ✅ `js/io/export-html.js`                 — ★HTML 내보내기
 *    ⛔ `js/io/export-image.js`                — ★★«일부러 ★안 부른다». ★그 파일에 ★까닭을 적었다
 *
 *  ★★부르는 ★자리 — ★`stripEditorOnlyForCapture` ★바로 뒤(★«맨 앞»)에 둔다.
 *    ★까닭: ★`neutralizeBoxReflectForH2C` 가 ★뒤에서 ★`el.cloneNode(true)` 로 ★거울상을 ★또 뜬다.
 *      ⇒ ★먼저 되돌려 두면 ★거울이 ★★이미 쉬는 값을 ★베낀다.
 *      ⇒ ★★「반사가 ★섹션에도 걸리나」를 ★★몰라도 ★닫힌다(★그 답은 ★★안 쟀다 — ★순서로 ★막았다).
 *
 *  ★★⚠️«세척 명부»가 ★지금 ★★넷이다 (★지디 2026-10-09 전수 · ⛔이 커밋에서 ★안 합쳤다):
 *    ⒜ `js/io/section-serialize.js`  — ★저장 (`RUNTIME_MARKER_CLS` ＋ RE · ★4건)
 *    ⒝ `js/io/capture-safety.js:456·459` — ★PNG·썸네일 공용 걷기 (★제 명부를 ★따로 든다 · ★8건)
 *    ⒞ `js/io/export-html.js:127`    — ★HTML (`item-selected` 를 ★손으로 벗긴다 · ★2건)
 *    ⒟ `js/io/export-css-collect.js:34` — ★CSS 수집 (★또 따로 · ★3건)
 *  ★★그 넷을 ★이 겹으로 ★모으는 것이 ★★다음 커밋이다 — ★이번엔 ★파티클만 든다.
 *    ★까닭: ★넷을 ★지금 합치면 ★★PNG 가 ★섞인다(★PNG 는 ★이 겹을 ★안 부른다 ⇒ ★걷기가 ★갈린다).
 *    ⇒ ★합칠 때는 ★`window.runtimeMarkers.stripRuntimeMarkers` 를 ★여기서 ★같이 부르고,
 *      ★★그 전에 ★★«PNG 도 ★그 걷기가 ★필요한가»를 ★먼저 재야 한다.
 *  ★★이름을 ★`restRuntimeForArtifact`(⛔`restParticles…` 가 아니다)로 ★둔 까닭이 ★그것이다 —
 *    ★★넓힐 자리를 ★이름이 ★미리 ★열어 둔다.
 *
 *  ★★⛔«⒟(번짐을 속도에 묶기) 때문에 ★이 겹을 ★`stdDeviation` 까지 ★넓혀라»는 ★★지시를 받았고,
 *    ★★재어 보니 ★★«넓힐 것이 ★없다». ★★근거(2026-10-09 · 행위로 셌다):
 *      ★`setAttribute('stdDeviation'…)` 을 ★하는 자리 = ★★js/ 전수 ★★0건
 *        ★★⚠️세는 법 — ★★«주석을 ★떼고» 센다(`tests/unit/_strip-comments.js` ★공용 부품).
 *          ⛔안 떼면 ★★이 주석 ★자신이 ★세어진다: ★날것은 ★stdDeviation ★1 · transform ★3 이고
 *            ★그 ★여분이 ★전부 ★★«이 머리말」이다(2026-10-09 · 지디의 ★자가 ★그래서 ★어긋났다).
 *          ⇒ ★★「주석은 ★«소스 파싱 게이트»의 ★입력」의 ★또 한 판.
 *        ★★양성대조: ★같은 자가 ★`setAttribute('transform'…)` 는 ★★2건 ★잡는다 —
 *            `js/fx/particles-animate.js`(움직이개가 ★쓴다) ＋
 *            `js/io/section-serialize.js`(★`restParticleMotion` 이 ★되돌린다)
 *          ⚠️★처음엔 ★내가 ★★1건이라 적었다 — ★★되돌리기 쓰기를 ★안 셌다. ★참값은 ★2 다.
 *      ★까닭 = ⒟ 의 식 `blur × speed / 58` 의 ★입력이 ★★«설정»이지 ★«시각»이 ★아니다
 *        ⇒ ★`svg()` 가 ★★한 번 ★계산해 ★글자에 ★굳힌다 ⇒ ★★런타임에 ★안 바뀐다
 *        ⇒ ★★되돌릴 ★«움직인 값»이 ★애초에 ★없다.
 *    ⇒ ★★지금 넓히면 ★★«죽은 코드»가 된다 — ★무엇을 막는지 ★모르는 채 ★남는다.
 *    ★★★그러나 ★언젠가 ★`stdDeviation` 을 ★★«매 프레임» 쓰게 되면 ★★그때는 ★여기를 ★넓혀라.
 *      ★그 순서(세척이 ★거울상보다 ★앞)는 ★★이미 ★잠겨 있다 —
 *      ★★`tests/unit/artifact-clone-roster` ★★A5 가 ★그 자리를 ★잰다. ⛔새 칸을 ★또 세우지 ★마라.
 *
 *  ★★임자는 ★여기가 ★아니다 — ★되돌리는 ★법은 ★`js/io/section-serialize.js` ★`restParticleMotion`
 *    ★하나다(★꼬리표 꼴 `data-fxp="x,y,vj,dir,rot0"` 을 ★읽는 자리). ★여기는 ★★«부르는 겹»이다. */
export function restRuntimeForArtifact(clone) {
  if (!clone) return clone;
  /* ⛔없으면 ★조용히 지나간다 — ★움직이개가 ★안 실린 판에는 ★움직인 값도 ★없다
     (★그 값을 ★쓰는 자가 ★js/fx/particles-animate.js ★하나뿐이다). */
  try { (typeof window !== 'undefined' ? window.restParticleMotion : null)?.(clone); } catch (_) {}
  return clone;
}

export function neutralizeBoxReflectForH2C(root, bgColor) {
  if (!root) return 0;
  const sel = '[style*="box-reflect"]';
  const targets = [...(root.matches?.(sel) ? [root] : []), ...root.querySelectorAll(sel)];
  if (!targets.length) return 0;
  const bg = _rgbTriple(bgColor) || _rgbTriple(getComputedStyle(root).backgroundColor) || [255, 255, 255];
  let n = 0;
  for (const el of targets) {
    const raw = el.style.webkitBoxReflect || el.style.getPropertyValue('-webkit-box-reflect') || '';
    /* ⛔`below` 가 아닌 꼴은 ★우리 것이 아니다 — 걷기만 하고 거울을 안 세운다(모르는 꼴을 흉내내지 않는다). */
    if (!/^\s*below\b/i.test(raw)) { el.style.webkitBoxReflect = ''; continue; }
    const fx = _fxReflectOf(el);
    el.style.webkitBoxReflect = '';          // h2c 가 못 그리는 속성은 걷는다(의도를 분명히)
    if (!fx || fx.state !== 'on') continue;
    const h = el.offsetHeight || 0, w = el.offsetWidth || 0;
    const visH = Math.round(h * fx.len / 100);
    if (!h || !w || visH <= 0 || fx.op <= 0) continue;
    const parent = el.parentNode;
    if (!parent || !parent.insertBefore) continue;

    const mir = el.cloneNode(true);
    mir.removeAttribute('id');
    mir.querySelectorAll?.('[id]').forEach(q => q.removeAttribute('id'));
    mir.style.webkitBoxReflect = '';
    mir.style.cssText += `;position:absolute;left:0;top:0;width:${w}px;height:${h}px;margin:0;transform:scaleY(-1);opacity:${fx.op / 100};`;

    const scrim = document.createElement('div');
    scrim.style.cssText = `position:absolute;left:0;top:0;width:${w}px;height:${visH}px;`
      + `background-image:linear-gradient(to bottom, rgba(${bg[0]},${bg[1]},${bg[2]},0) 0%, rgba(${bg[0]},${bg[1]},${bg[2]},1) 100%);`;

    const box = document.createElement('div');
    box.className = H2C_REFLECT_CLASS;
    box.setAttribute('aria-hidden', 'true');
    /* ★자리 — 거울 상자를 el 의 ★형제로 넣으므로 둘의 «담는 상자»(가장 가까운 positioned 조상)가 ★같다
       ⇒ offsetTop/offsetLeft 를 그대로 absolute 좌표로 쓸 수 있다. */
    box.style.cssText = `position:absolute;left:${el.offsetLeft}px;top:${el.offsetTop + h + fx.gap}px;`
      + `width:${w}px;height:${visH}px;overflow:hidden;pointer-events:none;`;
    box.appendChild(mir);
    box.appendChild(scrim);
    parent.insertBefore(box, el.nextSibling);
    n++;
  }
  return n;
}

/* ★정본을 ★늦게 받는다 — capture-safety 는 ★io 층이고 effects-reflect 는 ★블럭 층이다.
   정적 import 로 묶으면 단위 하네스가 io 하나를 실을 때 효과 층까지 끌고 온다(PLUS_ICON_SVG 와 같은 까닭).
   ⇒ ★같은 함수를 ★window 다리로 받는다. ⛔여기에 꼴을 ★다시 적지 마라(그러면 명부가 둘이다). */
function _fxReflectOf(el) {
  const f = (typeof window !== 'undefined') && window.fxReflectOf;
  return typeof f === 'function' ? f(el) : null;
}
