/* frame-bg.js — ★프레임 배경에 ★«값을 넣는» ★한 자리. (2026-10-10 · 현빈 1009t3-③)
 *
 * ★★왜 생겼나 — ★같은 일을 하는 ★★«빌더»가 ★★세 벌이었다. ★전수로 쟀다(★정의 자리 = 배경을 ★그리는 CSS):
 *     `js/props/prop-frame.js`  `_syncFrameBgVars`   ★7 호출
 *     `js/block-factory.js`     `_syncBgVars`        ★6 호출  ← ★주석이 ★스스로 「prop-frame ★미러」라 적었다
 *     `js/io/save-load.js`      `rebindAll` 안       ★6 호출
 *   ⇒ ★★합 ★19 호출. ★★그 19 중 ★★«크기(size)를 보내는 것» = ★★★0.
 *     ★그래서 ★프레임 배경은 ★★크기를 ★손댈 ★수단이 ★없었다(★현빈 ③ 의 ★그 증상).
 *
 * ★★그리는 자는 ★★둘이다 — ★이 파일이 ★그 ★둘을 ★모두 ★먹인다:
 *   ㉠ ★`.frame-block.has-bg-opacity::before` (css/editor-blocks.css) — ★CSS 변수로 받는다
 *   ㉡ ★본체 — ★인라인 longhand 로 ★직접 받는다
 *
 * ★★결정적 대조(지디 2026-10-10) — ★★섹션은 ★기억하고 ★프레임은 ★상수였다:
 *     `js/io/save-load.js:1161`  ★섹션 : `sec.style.backgroundSize = sec.dataset.bgSize || 'cover'`  ← ★읽는다
 *     `js/io/save-load.js:1531`  ★프레임: `ss.style.backgroundSize  = 'cover'`                       ← ★★상수
 *   ⇒ ★★같은 복원 함수 ★안에서 ★★섹션만 ★기억했다. ★이 파일이 ★그 비대칭을 ★없앤다.
 *
 * ⛔사본을 ★짓지 ★마라 — ★부르는 자가 ★늘면 ★이 파일을 ★부르게 하고,
 *   ★★`tests/unit/frame-bg-roster.test.mjs` 가 ★★«소비자 수»와 ★«제 벌로 다시 세는 자 0건»을 ★잠근다.
 * ⚠️★이름은 ★섹션과 ★★같게 썼다 — ★`dataset.bgSize`(⛔`bgFit`·`bgScale` 같은 ★새 이름 ★금지).
 *   ★값꼴도 ★섹션과 같다: ★`cover` · `contain` · `auto` · ★`<n>px <n>px`(「배경이미지 편집」 결과).
 *
 * ★1017t1k1 — `dataset.bgRotate` 도 ★같은 꼴로 ★이 파일에 둔다(⛔`bgAngle`·`bgDeg` 금지).
 *   ★rotate·색보정이 ★필요하면 그림은 ★레이어(js/bg-layer.js)가 그리고, 본체는 ★그림을 비운다
 *   (섹션의 ★같은 분기 — js/props/prop-section.js `_applySectionBg`).
 */
import { needsBgLayer, ensureBgLayer, removeBgLayer } from './bg-layer.js';   /* ★레이어 판정·관리의 ★한 자리 */

/* ★기본값 ★한 자리 — ⛔문자열 `'cover'` 를 ★부르는 자리에 ★다시 적지 ★마라 */
export const FRAME_BG_SIZE_DEFAULT = 'cover';

/** ★프레임의 ★배경 크기 — ★dataset 이 ★정본이고 ★없으면 ★기본값.
 *  ⛔computed 로 ★재지 ★않는다(★가짜 DOM 검사에서도 불린다 · frame-geometry 머리말의 그 까닭). */
export function frameBgSize(el) {
  const v = el && el.dataset && el.dataset.bgSize;
  return (typeof v === 'string' && v !== '') ? v : FRAME_BG_SIZE_DEFAULT;
}

/** ★프레임의 ★배경 위치 — ★크기와 ★한 쌍이라 ★같이 둔다(★두 벌로 갈리면 한쪽만 고쳐진다). */
export function frameBgPos(el) {
  const v = el && el.dataset && el.dataset.bgPos;
  return (typeof v === 'string' && v !== '') ? v : 'center';
}

/* ══ ㉠ ★`::before` 경로 — ★CSS 변수로 ★먹인다 ══════════════════════════════
   ★`has-bg-opacity` 프레임만 ★이 길로 그린다(★배경만 반투명하게 하려고 ★층을 쪼갠 꼴).
   ⚠️★본체 배경을 ★비우는 ★세 줄은 ★★이 함수의 ★일부다 — ⛔빼면 ★이중 배경이 된다. */
export function syncFrameBgVars(el) {
  if (!el || !el.classList || !el.classList.contains('has-bg-opacity')) return false;
  /* ★1017t1k1·k2 — rotate·색보정이 ★필요하면 그림은 ★레이어가 그린다. ⛔tint(반투명 색 물들임)는
     이 경로에 없다(has-bg-opacity 는 «색 자체»가 반투명이라 섹션의 그 열린 질문과 다른 자리). */
  if (needsBgLayer(el)) {
    ensureBgLayer(el);
    el.style.setProperty('--frame-bg', (el.dataset && el.dataset.bg) || el.style.backgroundColor || 'transparent');
    el.style.setProperty('--frame-bg-img', 'none');
    el.style.setProperty('--frame-bg-pos', frameBgPos(el));
    el.style.setProperty('--frame-bg-size', frameBgSize(el));
    el.style.backgroundColor = '';
    el.style.backgroundImage = '';
    el.style.background = '';
    return true;
  }
  removeBgLayer(el);
  const bgVal = (el.dataset && el.dataset.bg) || el.style.backgroundColor || 'transparent';
  if (/gradient\s*\(/i.test(bgVal)) {
    /* 그라데이션: 색은 비우고 이미지 슬롯에 gradient css */
    el.style.setProperty('--frame-bg', 'transparent');
    el.style.setProperty('--frame-bg-img', bgVal);
  } else {
    el.style.setProperty('--frame-bg', bgVal);
    el.style.setProperty('--frame-bg-img',
      (el.dataset && el.dataset.bgImg) ? `url("${el.dataset.bgImg}")` : 'none');
  }
  el.style.setProperty('--frame-bg-pos', frameBgPos(el));
  /* ★★2026-10-10 신설 — ★이 칸이 ★비어 있어서 ★크기를 ★못 바꿨다.
     ★CSS 쪽 짝: `css/editor-blocks.css` 의 `background-size: var(--frame-bg-size, cover)` */
  el.style.setProperty('--frame-bg-size', frameBgSize(el));
  /* 본체 배경은 ::before 가 대신 그리므로 비워 이중 배경 방지 */
  el.style.backgroundColor = '';
  el.style.backgroundImage = '';
  el.style.background = '';
  return true;
}

/* ══ ㉡ ★본체 경로 — ★인라인 longhand 로 ★먹인다 ═══════════════════════════
   ★그림이 ★있을 때만 ★크기·위치를 ★쓴다(⛔없는데 쓰면 ★빈 longhand 가 ★저장본에 남는다). */
export function applyFrameBgImageInline(el) {
  if (!el || !el.dataset || !el.dataset.bgImg) return false;
  /* ★1017t1k1·k2 — needsBgLayer 면 ★레이어가 그린다, 본체는 그림을 비운다(섹션과 같은 분기). */
  if (needsBgLayer(el)) {
    ensureBgLayer(el);
    el.style.backgroundImage = 'none';
    return true;
  }
  removeBgLayer(el);
  el.style.backgroundImage = `url("${el.dataset.bgImg}")`;
  el.style.backgroundSize = frameBgSize(el);
  el.style.backgroundPosition = frameBgPos(el);
  return true;
}

if (typeof window !== 'undefined') {
  window.frameBgSize = frameBgSize;
  window.frameBgPos = frameBgPos;
  window.syncFrameBgVars = syncFrameBgVars;
  window.applyFrameBgImageInline = applyFrameBgImageInline;
}

/** 배경 투명도(0~100) — 프레임 패널 «배경 투명도»의 몸통 한 벌(옛 prop-frame applyBgOpacity 그대로 옮김 · 슬라이드 칸 패널도 부른다 · SLIDE-CELL-PANEL-PARITY-01).
 *  dataset.bgOpacity 0~1 · --frame-bg-opacity · .has-bg-opacity(::before 층) · 100 이면 본체 배경 원복(그라데이션·이미지·단색 상호배타 I2-F1). */
export function setFrameBgOpacity(el, v) {
  const o = v / 100;
  el.dataset.bgOpacity = String(o);
  el.style.setProperty('--frame-bg-opacity', String(o));
  const active = o < 1;
  el.classList.toggle('has-bg-opacity', active);
  if (active) {
    syncFrameBgVars(el);
  } else {
    // 100%로 복귀 시 ::before 비활성 → 본체 배경 원복.
    // gradient / image / solid 상호배타 (I2-F1): gradient면 이미지로 덮지 않음.
    const bgVal = el.dataset.bg || '';
    const isGradient = /gradient\s*\(/i.test(bgVal);
    if (isGradient) {
      // background shorthand가 gradient를 backgroundImage 롱핸드에 넣고 다른 롱핸드도 초기화 →
      // 별도 backgroundImage='' 는 방금 넣은 gradient를 지우므로 제거(I2-F1 회귀 방지)
      el.style.background = bgVal;
    } else if (el.dataset.bgImg) {
      el.style.backgroundImage = `url("${el.dataset.bgImg}")`;
      el.style.backgroundSize = frameBgSize(el);
      el.style.backgroundPosition = el.dataset.bgPos || 'center';
    } else if (bgVal) {
      el.style.backgroundColor = bgVal;
    }
  }
}
