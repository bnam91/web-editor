// image-redact.js — 이미지 «블러 (Redact)» 공용 모듈 (1012t1 C1 · 에셋 블럭 + D4 컴패리전 셀이 같이 쓴다).
//
// ★상태는 «호스트 요소 자신»에만 산다 — data-redact(1..100 정수) + 인라인 --redact-blur(px).
//   그림은 CSS(css/editor-layout.css)가 호스트(또는 그 그림 상자)의 ::after 에 backdrop-filter 로 그린다(새 DOM 0).
//   ⇒ innerHTML 을 갈아 끼우는 길(이미지 교체·직렬화·undo 스냅샷·클론)이 손 안 대고 보존한다.
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
    return 0;
  }
  host.dataset.redact = String(n);
  host.style.setProperty('--redact-blur', redactPx(n) + 'px');
  return n;
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
  window.readImageRedact = readRedact;
  window.normalizeImageRedact = normalizeRedact;
  window.redactPx = redactPx;
}
