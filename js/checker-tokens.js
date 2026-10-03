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

/* ── S1 «체커 어둡게» 토글 — 읽고 쓰고 거는 문은 «여기 하나» (2026-10-04 현빈 「켜고 끄는 단추를 두기」·지디: 전역·기본 끔) ──
 * 값의 정본은 css/editor-base.css 의 `:root[data-goya-checker-tone="dark"]` 규칙이다 — 여기서는 «속성만» 건다.
 * ★왜 :root(전역)인가 — 체커는 세 갈래로 찍힌다: CSS 규칙(조상 덮기를 따라온다) · SVG 패턴(body 에 한 벌 —
 *   var() 가 :root 에서 풀린다) · JS 인라인(_tok 이 :root 를 읽는다). :root 하나를 바꾸면 셋 다 따라온다.
 * ★왜 localStorage 인가 — 「보기」 설정이지 문서가 아니다(페이지 패널 패딩 비주얼 gdt.padHint·그리드 gdt.gridGuide 와 같은 논리).
 *   ⛔프로젝트·섹션 dataset 에 쓰지 않는다 — 저장본·배송본에 안 실리는 것이 «내보내기 0» 의 첫 겹이다.
 * ★기본은 «끔» — 키가 없거나 깨졌으면 끔(지금 화면 그대로).
 * ⚠️켠 «동안» 새로 만든 인라인 체커(목업·주석 라벨)는 그때 읽은 어두운 hex 로 굳는다 — 꺼도 안 돌아온다(넣는 줄 알고 넣는다). */
export const CHECKER_DARK_KEY = 'gdt.checkerDark';
export const CHECKER_TONE_ATTR = 'data-goya-checker-tone';

export function readCheckerDarkOn() {
  try {
    if (typeof localStorage === 'undefined') return false;
    const raw = localStorage.getItem(CHECKER_DARK_KEY);
    if (raw === null) return false;                      // 키 없음 = 아무도 안 켰다 = 끔
    const o = JSON.parse(raw);
    return !!(o && o.on === true);                       // 깨진 값도 «끔» — 지금 화면이 기본이다
  } catch (_) { return false; }
}

/** 속성만 건다/뗀다(멱등). 저장은 안 한다. */
export function applyCheckerTone(on) {
  /* ⛔모듈 최상위에서 불린다 — 실릴 때 «던지면» 이 모듈을 import 하는 저장·목업 경로가 통째로 죽는다.
     가짜 document(단위시험 스텁)·속성 API 없는 환경에서도 조용히 넘긴다(tests/unit/save-dirty-after-failure 가 잡았다). */
  try {
    const el = typeof document !== 'undefined' ? document.documentElement : null;
    if (!el || typeof el.setAttribute !== 'function' || typeof el.removeAttribute !== 'function') return;
    const cur = typeof el.getAttribute === 'function' ? el.getAttribute(CHECKER_TONE_ATTR) : null;
    if (on) { if (cur !== 'dark') el.setAttribute(CHECKER_TONE_ATTR, 'dark'); }
    else if (cur !== null) el.removeAttribute(CHECKER_TONE_ATTR);
  } catch (_) { /* 표시 설정 하나 — 앱을 막을 이유가 없다 */ }
}

/** 단추가 부르는 문 — 저장 + 즉시 적용. */
export function setCheckerDarkOn(on) {
  try { localStorage.setItem(CHECKER_DARK_KEY, JSON.stringify({ on: !!on })); } catch (_) {}
  applyCheckerTone(!!on);
}

/* ★모듈이 실릴 때 한 번 건다 — 페이지 패널을 «한 번도 안 열어도» 켠 상태가 살아야 한다.
   (이 모듈은 save-load·mockup·canvas-block 이 import 해서 부팅 때 늘 실린다.) */
if (typeof window !== 'undefined') {
  applyCheckerTone(readCheckerDarkOn());
  window.readCheckerDarkOn = readCheckerDarkOn;
  window.setCheckerDarkOn = setCheckerDarkOn;
}
