/* 투명 표시 «체커» 토큰 읽기 — 값의 정본은 css/editor-base.css :root 의 --goya-checker-* 하나다.
 * 왜 JS 가 «읽는가»(상수로 베끼지 않고) — 같은 색이 CSS 와 JS 두 곳에 있으면 조용히 갈라진다.
 *   그래서 JS 인라인 자리는 computed 값을 «읽어서» 같은 문자열을 만든다.
 * 왜 인라인에 var() 를 «박지 않는가» — shorthand 안의 var() 는 CSSOM 이 longhand 를 비워 돌려준다
 *   (el.style.backgroundImage === ''). 떼어낸 클론(단독 HTML)에서 capture-safety.js 의
 *   neutralizeEmptyImageCheckerForCapture 가 그 값으로 체커 서명(/repeating-conic-gradient/)을 판정하므로
 *   var() 가 박히면 «체커가 안 걷힌다». ⇒ 읽어서 «구체 값»으로 박는다(이전 문자열과 «글자까지» 같다).
 * 토큰을 못 읽는 곳(CSS 없는 문서)에선 var() 참조 문자열로 떨어진다 — hex 사본을 두지 않는다.
 * ⚠️이미 «저장된» 문서의 인라인 체커(목업·주석 라벨)는 그때 박힌 옛 hex 그대로다 — 토큰을 바꿔도 안 바뀐다.
 *   2026-10-04 현빈 결정 「새로 만드는 것만」 ⇒ 마이그레이션 없음(의도). 릴리스 노트에도 적는다. */

function _tok(name) {
  if (typeof document === 'undefined' || !document.documentElement || typeof getComputedStyle !== 'function') return `var(${name})`;
  const v = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return v || `var(${name})`;
}

/** kind: 'big'(72px) | 'small'(16px) | 'clear'(투명 쌍·small 크기). size 를 주면 격자 크기만 바꾼다. */
export function checkerBg(kind = 'big', size) {
  const k = kind === 'clear' ? 'clear' : (kind === 'small' ? 'small' : 'big');
  const a = _tok(`--goya-checker-${k}-a`), b = _tok(`--goya-checker-${k}-b`);
  const px = size || _tok(`--goya-checker-${k === 'big' ? 'big' : 'small'}-size`);
  return `repeating-conic-gradient(${a} 0% 25%, ${b} 0% 50%) 0 0 / ${px} ${px}`;
}

/** 큰 쌍 색 + 다른 격자 크기(주석 라벨 16px · 도형 스와치 10px 처럼 «색은 큰 쌍, 칸만 다른» 자리). */
export function checkerBgBigColors(size) { return checkerBg('big', size); }

/** SVG <pattern> 용 두 색 — CSS 변수 참조(style="fill:…" 에서 살아 있다). */
export function checkerSvgFills() {
  return { a: 'var(--goya-checker-svg-a)', b: 'var(--goya-checker-svg-b)' };
}

/* ── S1 «체커 어둡게» — ★섹션 배경 체커 «섹션마다» (2026-10-06 현빈 R1 확정) ─────────────────
 * ★이 파일에는 ★토글 문이 없다. 켜고 끄는 문은 js/props/prop-section.js 의 섹션 배경 절 하나다
 *   (sec.dataset.checkerTone='dark' → css/editor-base.css 의 .section-block[data-checker-tone="dark"]).
 * ⛔전역 보기설정(localStorage gdt.checkerDark · <html data-goya-checker-tone>)을 ★되살리지 마라 —
 *   2026-10-06 에 ★일부러 걷어냈다. 같은 것을 두 군데서 정하면 우선순위를 사람이 못 외운다.
 * ★왜 이 파일이 아무 톤도 안 쓰나 — 섹션 톤은 ★CSS 변수 상속만으로 선다(--goya-checker-secbg-*).
 *   아래 _tok() 은 :root 를 읽으므로 ★섹션 톤을 못 본다. 그게 ★의도다(R1: 「빈 카드는 그대로」).
 *   ⇒ 목업·주석 라벨의 인라인 체커는 톤과 무관하게 늘 라이트다. 바꾸려면 R2 가 되고 범위가 다르다. */
