/* text-style-kinds — 텍스트 «효과»가 ★무엇으로 이루어지나의 ★«명부 하나». (2026-10-08)
 *
 * ★왜 이 파일이 있나
 *   현빈: 「★저장한 스타일도 ★복사할수 있게 … ★프리셋을 추가할 수 있게 ★하든 ★혹은 ★최근 스타일을 선택할 수 있게」
 *   ＋ 지디 notes T14 「★그 형광펜 스타일로 ★다른 텍스트에 하려는데 ★매번 설정을 ★복붙하기가 ★귀찮아」
 *     T15 「★최근 형광펜처럼 … ★마찬가지 ★최근 효과 뜨게」 ⇒ ★T14 와 ★같은 기계여야 한다.
 *
 * ★★이 파일이 ★유일하게 아는 것 = ★«한 벌이 ★무슨 값으로 이루어지나».
 *   ⑴ ★뜨기(capture) ⑵ ★입히기(apply) ⑶ ★미리보기 꼴(preview) ★셋이 ★같은 vars 목록을 ★읽는다.
 *   ⇒ ★셋 중 하나만 고치면 ★어긋나는 자리가 ★없다(명부가 ★하나라서).
 *   ⛔저장소(js/design-system.js)는 ★이것을 ★모른다 — 거기는 ★«꼴»(평평한 객체)만 본다.
 *     ★그래야 kind 를 늘려도 ★저장소가 ★안 바뀐다.
 *
 * ⚠️★네온글로우는 ★여기 ★없다 — ★정본 자리를 ★안 쟀다. ⛔빈 칸을 ★미리 열지 않는다
 *   (「표의 빈칸은 «없는 경우»가 아니라 «안 잰 경우»」 · 지디 판정 2026-10-08 ⒟ — ★2차로 간다).
 * ⚠️★기본 서식(폰트·크기·글자색·B/I/U/S)은 ★한 벌에 ★넣지 ★않는다.
 *   ★까닭 = 현빈이 「★그 ★형광펜 ★스타일」이라 했고, 폰트·크기를 같이 옮기면 ★받는 글의 ★역할(h1/body)이 깨진다.
 *   ★그 축은 tests/dom/text-style-recent.dom.spec.js ★C4 가 ★잠근다.
 */
/* ⚠️★★이 import 는 ★순환이다 — prop-text-wireup-text-edit.js 가 ★이 파일을 ★도로 가져온다.
   ⇒ ★★HL_CLASS·DOT_CLASS 를 ★«모듈 평가 시점»에 ★읽으면 ★TDZ 로 ★죽는다
     (그 파일이 ★평가 중일 때 ★이 파일이 ★먼저 돌고, ★그 두 const 는 ★아직 ★안 섰다).
   ⇒ ★아래 kind 표는 ★clsOf() ★함수로 ★감싸 ★«쓸 때» 읽는다.
     ⛔그 이름을 ★표에 ★곧바로 ★적는 꼴로 ★되돌리지 마라 — ★그 순간 ★앱이 ★안 뜬다.
   ⛔문자열을 ★베끼지도 마라 — ★이름의 ★정본은 ★그 파일의 ★그 두 const 다(지디 판정 2026-10-08 ⒡).
   ★이 축은 tests/dom/text-style-recent.dom.spec.js 가 ★pageerror 0건으로 ★잰다. */
import { isHighlightOn, isDotOn, HL_CLASS, DOT_CLASS } from './prop-text-wireup-text-edit.js';
import { hasTextGradient, getTextGradient } from './text-block-color.js';

/* ★미리보기 칩에 넣는 글자 — 한글 한 자. ★왜 한글인가: 이 패널의 글이 한글이고,
   ★점(글자 ★위)·★밑줄(글자 ★아래)이 ★둘 다 ★보이는 네모꼴이라 ★한 자로 셋을 다 보여 준다. */
export const PREVIEW_GLYPH = '가';

/** 미리보기 칩의 ★겉 클래스 — css/editor-layout.css 가 이 이름으로 ★장식선 규칙을 ★나눠 쓴다. */
export const PREVIEW_CLASS = 'ts-chip-prev';

/* ★한 벌의 «값»은 ★CSS 사용자 속성 ★그 자체다 — 제품이 ★그리는 데 쓰는 ★그 이름.
   ⛔다른 이름으로 ★갈아 적지 않는다(갈아 적으면 ★뜨기와 ★입히기 사이에 ★번역표가 생기고 ★그게 둘째 명부다). */
export const TEXT_STYLE_KINDS = [
  {
    k: 'hl',
    label: '형광펜',
    vars: ['--tb-hl-color', '--tb-hl-h', '--tb-hl-y'],
    clsOf: () => HL_CLASS,
    isOn: (contentEl) => isHighlightOn(contentEl),
  },
  {
    k: 'dot',
    label: '점',
    vars: ['--tb-dot-color', '--tb-dot-size', '--tb-dot-gap', '--tb-dot-x', '--tb-dot-y'],
    clsOf: () => DOT_CLASS,
    isOn: (contentEl) => isDotOn(contentEl),
  },
  {
    k: 'ul',
    label: '밑줄',
    vars: ['--tb-ul-color', '--tb-ul-thick', '--tb-ul-offset'],
    clsOf: () => null,                       // ★밑줄은 span 클래스가 아니라 ★text-decoration-line 이다
    /* ★미리보기 칩에서는 ★그 선을 ★스스로 켜야 한다 — 칩은 ★글 블럭이 아니라 ★선이 ★안 걸려 있다.
       ⛔두께·색·위치는 ★여기 ★안 적는다 — ★그 셋은 ★vars 가 들고 있고 ★css 규칙이 ★한 자리에서 읽는다
         (css/editor-layout.css 의 `.text-block *, .ts-chip-prev` ★한 선언). */
    previewCss: 'text-decoration-line:underline',
    isOn: (contentEl) => String((contentEl && (contentEl.style.textDecorationLine || contentEl.style.textDecoration)) || '').includes('underline'),
  },
  {
    k: 'grad',
    label: '그라데이션',
    vars: [],                        // ★값이 ★CSS 변수가 아니다 — ★그라데이션 css 문자열 ★하나('css')
    clsOf: () => null,
    isOn: (contentEl) => hasTextGradient(contentEl),
  },
];

const _BY_K = Object.fromEntries(TEXT_STYLE_KINDS.map(d => [d.k, d]));
export const textStyleKind = (k) => _BY_K[k] || null;

/**
 * 지금 블럭에 걸린 그 효과를 ★한 벌로 뜬다. 꺼져 있으면 ★null.
 * ★왜 computed 에서 뜨나 — 인라인이 ★없으면 ★CSS 기본값이 ★그 글의 ★진짜 모습이다.
 *   「인라인만」 뜨면 ★안 고친 칸이 ★빠져서 ★입힐 때 ★받는 글의 ★옛 값이 ★남는다(한 벌이 ★한 벌이 아니게 된다).
 * @param {string} k
 * @param {Element} tb        .text-block — ★변수의 정본이 사는 자리
 * @param {Element} contentEl 글자칸 — ★켜짐 판정이 보는 자리
 */
export function captureTextStyle(k, tb, contentEl) {
  const d = textStyleKind(k);
  if (!d || !tb || !contentEl) return null;
  if (!d.isOn(contentEl)) return null;
  if (k === 'grad') {
    const g = getTextGradient(contentEl);
    return g && g.css ? { css: g.css } : null;
  }
  const cs = window.getComputedStyle(tb);
  const v = {};
  for (const name of d.vars) {
    const raw = (cs.getPropertyValue(name) || '').trim();
    if (raw) v[name] = raw;
  }
  return Object.keys(v).length ? v : null;
}

/**
 * 한 벌을 블럭에 ★입힌다 — ★값만. ⛔«켜는 것»은 ★여기가 ★안 한다.
 *   ★까닭 = 켜기는 ★DOM 을 쪼개는 일(span 두르기)이라 ★그 배선(wireTextEditSection)이 ★가진 자다.
 *     여기까지 끌고 오면 ★그 함수들을 ★모듈 밖으로 ★꺼내야 하고, ★그건 ★이번 범위가 아니다.
 *   ⇒ ★부르는 쪽이 ★«켜고 → 입힌다». ★그 순서는 text-style-chips 의 onPick 한 곳에만 있다.
 * @returns {boolean} 입혔나
 */
export function applyTextStyleVars(k, tb, v) {
  const d = textStyleKind(k);
  if (!d || !tb || !v) return false;
  if (k === 'grad') return false;              // ★그라데이션은 applyTextGradient 가 ★제 길로 간다
  let n = 0;
  for (const name of d.vars) {
    const val = v[name];
    if (typeof val === 'string' && val) { tb.style.setProperty(name, val); n++; }
    else tb.style.removeProperty(name);        // ★안 든 칸은 ★«안 정함»으로 되돌린다(한 벌이 ★덮어쓴다)
  }
  return n > 0;
}

/** 미리보기 칩 ★속 글자의 인라인 style — ★뜨기와 ★같은 vars 를 ★같은 이름으로 쓴다(명부 하나). */
export function previewInlineStyle(k, v) {
  const d = textStyleKind(k);
  if (!d || !v) return '';
  if (k === 'grad') {
    const css = typeof v.css === 'string' ? v.css : '';
    if (!/^(linear|radial|conic)-gradient\(/i.test(css.trim())) return '';
    return `background-image:${css};-webkit-background-clip:text;background-clip:text;-webkit-text-fill-color:transparent`;
  }
  const parts = d.vars.map(name => (typeof v[name] === 'string' && v[name] ? `${name}:${v[name]}` : null)).filter(Boolean);
  if (d.previewCss) parts.push(d.previewCss);
  return parts.join(';');
}

/** 미리보기 칩 ★속 글자에 붙일 클래스 — 제품이 ★그리는 ★그 클래스 그대로(⛔문자열을 베끼지 않는다). */
export function previewClassFor(k) {
  const d = textStyleKind(k);
  if (!d) return PREVIEW_CLASS;
  const cls = d.clsOf?.();          // ★«쓸 때» 읽는다 — 머리말의 그 TDZ 때문
  return cls ? `${PREVIEW_CLASS} ${cls}` : PREVIEW_CLASS;
}
