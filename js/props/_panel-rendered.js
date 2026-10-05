/* _panel-rendered.js — 패널이 «그려진 값»을 읽는 한 자리 (E121 · 2026-10-05 · 지디 ⓐ).
 *
 * ★병: 패널이 빈 값(인라인·dataset 없음)을 `|| 기본값` 으로 그린다. 그런데 화면을 그리는 쪽(CSS·렌더러)은
 *   «다른» 기본값을 쓴다 ⇒ 기본값 명부가 두 벌이 되고, 패널은 화면과 다른 수를 보여 준다
 *   (실측 772ccadc: 라벨 알약 높이 패널 8 · 실제 22 — CSS .tb-label padding 11px).
 * ★처방: 패널은 «그 절이 다루는 요소»의 getComputedStyle 에서 읽는다 ⇒ 기본값 명부는 CSS 한 벌만 남는다.
 * 소비자(이 묶음): prop-text.js 라벨 알약 높이 · 라벨 좌우 패딩 · Tag Style 켜짐 판정. 같은 병의 나머지 자리 = 명부 E105~E120(0.9.7).
 * ⛔소비자마다 getComputedStyle 를 다시 쓰지 마라 — 그러면 이 한 자리를 무력화해도 빨강이 안 나서 «한 벌»이 잠기지 않는다.
 */

/** el 의 계산된 CSS 길이(px) — 못 읽으면 0. */
export function panelRenderedPx(el, prop) {
  if (!el) return 0;
  return parseFloat(getComputedStyle(el)[prop]) || 0;
}

/** 라벨 알약의 «지금 그려진» 모양 — Tag Style 단추 켜짐 판정용.
 *  원형만 표식(data-shape)이 있고 나머지는 형태 단추가 쓴 인라인으로만 갈린다. 맨 라벨(인라인 없음)은 CSS 기본
 *  (radius 8 · 채움 · 테두리 없음)이라 Box 와 같은 모습이다 ⇒ 'box'.
 *  어느 단추와도 안 맞으면(예: 채움 없음 + 둥근 모서리) null — «아무것도 안 켠다»(거짓 켜짐 금지). */
export function labelShapeFromRendered(el) {
  if (!el) return null;
  if (el.dataset.shape === 'circle') return 'circle';
  const cs = getComputedStyle(el);
  const radius = panelRenderedPx(el, 'borderTopLeftRadius');
  const border = panelRenderedPx(el, 'borderTopWidth');
  const bg = cs.backgroundColor;
  const filled = !!bg && bg !== 'transparent' && !/rgba\(\s*0,\s*0,\s*0,\s*0\s*\)/.test(bg);
  const h = el.offsetHeight;   // 레이아웃 px(배율 무관) — 계산된 radius 와 같은 단위
  if (border > 0) return 'outline';
  if (!filled) return radius === 0 ? 'text' : null;
  if (h > 0 && radius >= h / 2) return 'pill';
  return 'box';
}

/** el 의 계산된 색(prop = 'color' · 'backgroundColor' · 'stroke' …) — 색 칸(colorFieldHTML)이 그대로 받는 꼴
 *  ('rgb(r, g, b)' · 'rgba(r, g, b, a)' — 투명도는 parseAlphaFromColor 가 읽는다). 못 읽으면 ''.
 *  ★묶음 B(2026-10-05) — panelRenderedPx 의 «색» 형제. 같은 규약: 패널은 그리는 요소의 계산값에서 읽는다(기본값 명부 두 벌 금지).
 *  ⛔소비자마다 getComputedStyle 를 다시 쓰지 마라(이 한 자리를 비워도 빨강이 나야 한 벌이 잠긴다). */
export function panelRenderedColor(el, prop) {
  if (!el) return '';
  const v = getComputedStyle(el)[prop];
  return (typeof v === 'string' && /^rgba?\(/i.test(v.trim())) ? v.trim() : '';
}

/** el 의 계산된 굵기 — '100'~'900' 문자열(normal→'400' · bold→'700'). 못 읽으면 ''.
 *  ★묶음 B #16(2026-10-05 · 지디 승인) — 글자 패널의 굵기 칸·B 단추 켜짐·B 토글이 «그려진 굵기»를 읽는다.
 *    전엔 인라인만 읽어 새 T▾ Heading(인라인 없음 · CSS .tb-h2 600)이 「Regular 400 · B 꺼짐」으로 보였고, B 첫 클릭이 600→700 이라 «안 바뀐 듯» 했다. */
export function panelRenderedWeight(el) {
  if (!el) return '';
  const w = String(getComputedStyle(el).fontWeight || '').trim();
  if (w === 'normal') return '400';
  if (w === 'bold') return '700';
  return /^\d{3}$/.test(w) ? w : '';
}
