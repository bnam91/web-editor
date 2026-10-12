// image-redact.js — 이미지 «블러 (Redact)» 공용 모듈 (1012t1 C1 · 에셋 블럭 + D4 컴패리전 셀이 같이 쓴다).
//
// ★상태는 «호스트 요소 자신»에만 산다 — data-redact(1..100 정수) + 인라인 --redact-blur(px).
//   에셋: 그림(.asset-img / 구운 canvas) «자신»의 filter 로 흐린다 — 인라인은 writeImgFilter 한 자리(색보정과 합성),
//   인라인이 빈 때는 CSS(css/editor-layout.css)가 바닥으로 흐린다. ⛔backdrop(뒤 막)은 배율>100% 에서 가장자리가 샜다.
//   비교 칸(D4): CSS 막(::after · background:inherit + filter)이 흐린다 — 여기 합성은 칸을 안 건드린다.
//   ⇒ 상태가 호스트 속성이라 innerHTML 을 갈아 끼우는 길(이미지 교체·직렬화·undo 스냅샷·클론)이 보존한다.
// ★0/없음 = 끔 ⇒ 속성·변수를 «지운다»(옛 저장본 바이트 보존).
// ★값을 쓰는 순간 변수도 같이 쓴다 — 도형 가림막의 「인라인 변수는 패널을 열 때만 채워졌다」 결함을 피한다.
//
// D4(컴패리전)처럼 매 렌더 DOM 을 새로 그리는 호출자: 모델 값(행 필드 `redact`, 0..100 정수)을
//   normalizeRedact 로 거른 뒤 렌더 때마다 applyRedact(div, row.redact) 를 부르면 된다(멱등 · 0 이면 흔적 0).
//   html2canvas 안전실패(capture-safety.js neutralizeRedactForH2C)는 REDACT_HOST_SEL 로 호스트를 찾는다
//   ⇒ D4 는 그 선택자에 자기 호스트를 «여기서» 더한다(명부 한 자리).
//
// ⛔최상위에서 DOM 을 만지지 마라 — 노드 유닛이 import 한다.

export const REDACT_MAX_PX = 20;   // 강도 100 ⇒ 20px (도형 가림막 최대와 같다 · plan-C1 결정 D-1)
export const REDACT_HOST_SEL = '.asset-block[data-redact], .comparison-block .cmp-row.cmp-img[data-redact]';   // ★D4 컴패리전 셀 = 호스트 자신이 그림 상자

/** 무엇이 오든 0..100 정수로(모델 검증 함수 — D4 의 _sanitizeRow 가 그대로 쓴다). NaN·음수 → 0, 100 초과 → 100. */
export function normalizeRedact(v) {
  const n = Math.round(Number(v));
  if (!Number.isFinite(n) || n <= 0) return 0;
  return n > 100 ? 100 : n;
}

/** 강도(0..100) → 블러 px(소수 1자리). */
export function redactPx(v) {
  return Math.round(normalizeRedact(v) * REDACT_MAX_PX / 100 * 10) / 10;
}

/** 호스트의 현재 강도(없으면 0). */
export function readRedact(host) {
  return normalizeRedact(host?.dataset?.redact);
}

/** 멱등 칠하기 — v<=0 이면 속성·변수 둘 다 지운다, v>0 이면 둘 다 쓴다. 반환 = 실제로 건 정수. */
export function applyRedact(host, v) {
  if (!host) return 0;
  const n = normalizeRedact(v);
  if (n <= 0) {
    delete host.dataset.redact;
    host.style.removeProperty('--redact-blur');
    recomposeHost(host);
    return 0;
  }
  host.dataset.redact = String(n);
  host.style.setProperty('--redact-blur', redactPx(n) + 'px');
  recomposeHost(host);
  return n;
}

/* ═══ 그림 filter 합성 — ★인라인 filter 를 쓰는 «단 한 자리» (2026-10-13 · 이벨류에이터 누출 실측 뒤) ═══
 * 에셋 블러는 그림(.asset-img / 구운 canvas) «자신»의 filter 다. 색보정(js/image-color-adjust.js)도 같은 그림의
 * 인라인 filter 에 url(#…) 를 쓴다 ⇒ 둘이 따로 쓰면 나중 쓴 쪽이 앞의 것을 «지운다»
 *   (색보정이 블러를 지우면 = 원본 노출 · 프라이버시 실패).
 * ⇒ 둘 다 여기 writeImgFilter(el, 색보정 몫) 로만 쓴다. 블러 몫은 «호스트 상태»(data-redact)에서 매번 다시 읽는다.
 *   색보정 몫 = 호출자가 준 문자열에서 blur(…) 를 걷은 것. 블러 몫 = 에셋 호스트가 켜져 있으면 blur(Npx).
 * ⛔비교 칸(호스트 = 칸 자신, 배경그림)은 여기서 블러를 안 붙인다 — 그 칸은 CSS 막(::after)이 흐린다(D4).
 * 인라인이 비어도 CSS(css/editor-layout.css)가 바닥으로 흐린다 — 그림을 갈아 끼운 직후의 빈틈을 막는다. */
const _BLUR_TOKEN_RE = /(^|\s)blur\([^)]*\)/g;
const _ASSET_MEDIA_SEL = ':scope > .asset-img-clip > :is(.asset-img, canvas)';

/** 지금 인라인 filter 에서 «색보정 몫»만(블러를 걷은 것). */
export function adjFilterPart(el) {
  return String(el?.style?.filter || '').replace(_BLUR_TOKEN_RE, ' ').replace(/\s+/g, ' ').trim();
}

/** 이 그림을 흐릴 에셋 호스트의 강도(그림이 에셋 클립 상자 안에 있을 때만). */
function _assetRedactOf(el) {
  const clip = el?.parentElement;
  if (!clip || !clip.classList?.contains('asset-img-clip')) return 0;
  const host = clip.parentElement;
  if (!host || !host.classList?.contains('asset-block')) return 0;
  return readRedact(host);
}

/** ★합성 쓰기 — 색보정 몫 + (켜져 있으면) 블러 몫. 인라인 filter 를 쓰는 유일한 문. */
export function writeImgFilter(el, adjPart) {
  if (!el?.style) return;
  const parts = [];
  const adj = String(adjPart || '').replace(_BLUR_TOKEN_RE, ' ').replace(/\s+/g, ' ').trim();
  if (adj) parts.push(adj);
  const v = _assetRedactOf(el);
  if (v > 0) parts.push(`blur(${redactPx(v)}px)`);
  const next = parts.join(' ');
  /* 같은 값이면 안 쓴다 — 같은 값 쓰기도 MutationObserver 를 깨워 autosave 를 예약한다(save-load MUT-01 · rebindAll 이 매번 부른다) */
  if (el.style.filter !== next) el.style.filter = next;
}

/** 지금 색보정 몫을 그대로 두고 블러 몫만 다시 맞춘다. */
export function composeImgFilter(el) {
  writeImgFilter(el, adjFilterPart(el));
}

/** 에셋 호스트 안의 그림 전부를 다시 합성한다(applyRedact · 되돌리기/불러오기 뒤). 비교 칸은 할 일 없음. */
export function recomposeHost(host) {
  if (!host?.classList?.contains('asset-block') || typeof host.querySelectorAll !== 'function') return;
  host.querySelectorAll(_ASSET_MEDIA_SEL).forEach(composeImgFilter);
}

/** 패널 절 — 그레인 절과 같은 꼴(prop-section > prop-section-title + prop-row > prop-label·prop-slider·prop-number). */
export function redactSectionHTML({ idPrefix, value = 0, title = '블러 (Redact)' } = {}) {
  const v = normalizeRedact(value);
  return `
    <div class="prop-section" id="${idPrefix}-redact-section">
      <div class="prop-section-title">${title}</div>
      <div class="prop-row">
        <span class="prop-label">강도</span>
        <input type="range" class="prop-slider" id="${idPrefix}-redact-slider" min="0" max="100" step="1" value="${v}">
        <input type="number" class="prop-number" id="${idPrefix}-redact-number" min="0" max="100" value="${v}">
      </div>
    </div>`;
}

/** 패널 배선 — input=라이브 · change=커밋(값을 «바꾼 뒤» pushHistory · push-after).
 *  getHost() 로 받는 까닭: D4 셀은 재렌더로 DOM 이 바뀐다 — 그때그때 찾는다.
 *  onCommit(v) 은 D4 가 모델(row.redact)에 되쓰는 문(에셋은 안 쓴다). */
export function wireRedactSection({ idPrefix, getHost, onCommit, root } = {}) {
  const scope = root || (typeof document !== 'undefined' ? document : null);
  if (!scope) return;
  const slider = scope.querySelector(`#${idPrefix}-redact-slider`);
  const number = scope.querySelector(`#${idPrefix}-redact-number`);
  if (!slider || !number) return;
  const live = raw => {
    const v = normalizeRedact(raw);
    applyRedact(getHost?.(), v);
    return v;
  };
  const commit = v => {
    onCommit?.(v);
    window.pushHistory?.();
  };
  slider.addEventListener('input', () => {
    const v = live(slider.value);
    number.value = v;
  });
  slider.addEventListener('change', () => {
    const v = live(slider.value);
    commit(v);
  });
  number.addEventListener('change', () => {
    const v = live(number.value);
    number.value = v;
    slider.value = v;
    commit(v);
  });
}

if (typeof window !== 'undefined') {
  window.applyImageRedact = applyRedact;
  window.writeImgFilter = writeImgFilter;
  window.composeImgFilter = composeImgFilter;
  window.recomposeImageRedact = recomposeHost;
  window.readImageRedact = readRedact;
  window.normalizeImageRedact = normalizeRedact;
  window.redactPx = redactPx;
}
