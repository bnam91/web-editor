/* canvas-contrast.js — 링크 연결선을 «캔버스 배경 대비»로 고르는 단 하나의 자리.
 *
 * 발주(현빈) 「링크연결선이 캔버스 색때문에 잘안보여, 캔버스 색 고려해서 동적으로 계산해줄래?」
 * 계산 시점은 «배경이 바뀌는 순간» 셋뿐이다(솔리드/그라데이션 · 로드·부팅 · 테마변경).
 * ⛔rAF 루프 무접촉 — 색은 CSS 가 칠한다. 여기서 만드는 것은 CSS 변수 «하나»(--spl-edge-color).
 *
 * ⛔drag-utils.colorLuminance 를 쓰지 않는다 — «있는데 왜 안 썼나»의 답:
 *   그건 (0.2126R+0.7152G+0.0722B)/255 로 «감마 선형화가 없는» 근사다.
 *   그대로 쓰면 전수 16,777,216 배경 중 20.65% 가 다른 판정이고,
 *   그중 11.2%(1,874,696건)는 «진짜 대비 3 미만»인 색을 고른다.
 *   최악 #ff00ff: 근사는 «흰»을 고르는데 그 흰의 진짜 대비 1.957 (WCAG 는 «검» 4.725).
 *   ★그렇다고 저기를 고치지도 마라 — 블록 렌더러 5파일 12곳이 `lum < 0.45` 류
 *     «거친 명암 판정»에 쓴다. 틀린 물건이 아니라 «다른 일»을 하는 물건이다.
 */
import { parseGradient } from './props/gradient-model.js';

/* ★css/editor-extra.css 의 `.spl-edges line { … opacity }` 와 «같아야» 한다(검사 B6 이 대조).
   .55 로는 3:1 이 «불가능»하다 — 24비트 전수 최악 2.435(#ca0000). .70 에서 최악 3.126(#d40000). */
export const EDGE_ALPHA = 0.70;

/* 기본 하한 = WCAG 비텍스트 대비(3:1). */
export const MIN_CONTRAST = 3.0;

/* ── WCAG 상대휘도 ─────────────────────────────────────────── */
const _lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const _L   = ([r, g, b]) => 0.2126 * _lin(r / 255) + 0.7152 * _lin(g / 255) + 0.0722 * _lin(b / 255);
const _cr  = (a, b) => { const x = _L(a), y = _L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };

/* sRGB 감마 공간 source-over. 인자 순서 = (전경, 배경, 알파). ⛔뒤집으면 검사 A0 이 잡는다. */
const _over = (fg, bg, a) => fg.map((c, i) => a * c + (1 - a) * bg[i]);

/* ★점수는 min(선, 점) 이다 — 선(α=.70)만 보면 점(α=1)이 미달할 수 있다.
     실측: accent 임의색 스트레스 16,777,216 쌍에서 «점 < 3:1» 18,796건
           (최악 accent #ff00ee · 배경 #00ee00 → 선 3.026 «통과», 점 2.040 «미달»).
   ⛔「알파가 더 크니 점은 당연히 안전」은 정리가 아니다 — 채널이 서로 반대로
     움직이면 가중합이 단조가 아니다. 검사 A6 이 이걸 못박는다. */
const _score = (c, bg) => Math.min(_cr(_over(c, bg, EDGE_ALPHA), bg), _cr(c, bg));

/* ── 색 파싱 ───────────────────────────────────────────────── */
const _clamp255 = (n) => Math.max(0, Math.min(255, n));

/** '#rgb' · '#rrggbb' · '#rrggbbaa' · 'rgb()' · 'rgba()' → { rgb:[r,g,b], a } | null */
function _parseWithAlpha(str) {
  if (typeof str !== 'string') return null;
  const s = str.trim();
  if (!s) return null;
  let m = /^#([0-9a-f]{3,8})$/i.exec(s);
  if (m) {
    const h = m[1];
    if (h.length === 3 || h.length === 4) {
      const p = (i) => parseInt(h[i] + h[i], 16);
      return { rgb: [p(0), p(1), p(2)], a: h.length === 4 ? p(3) / 255 : 1 };
    }
    if (h.length === 6 || h.length === 8) {
      const p = (i) => parseInt(h.slice(i, i + 2), 16);
      return { rgb: [p(0), p(2), p(4)], a: h.length === 8 ? p(6) / 255 : 1 };
    }
    return null;
  }
  m = /^rgba?\(\s*([\d.]+)\s*,\s*([\d.]+)\s*,\s*([\d.]+)\s*(?:,\s*([\d.]+)\s*)?\)$/i.exec(s);
  if (m) {
    const a = m[4] === undefined ? 1 : parseFloat(m[4]);
    if (!isFinite(a)) return null;
    return { rgb: [+m[1], +m[2], +m[3]].map(_clamp255), a: Math.max(0, Math.min(1, a)) };
  }
  return null;   // 'url(...)' · 'transparent' · 이름색 · 빈 문자열 = «못 쟀다»
}
const _parse = (str) => { const c = _parseWithAlpha(str); return c ? c.rgb : null; };

const _hex = (rgb) => '#' + rgb.map(c => _clamp255(Math.round(c)).toString(16).padStart(2, '0')).join('');

/** 살아 있는 CSS 변수를 «읽는다». ⛔하드코딩 금지 — theme-system.js 가 이걸 바꾼다. */
function _cssVar(name) {
  if (typeof document === 'undefined' || typeof getComputedStyle !== 'function') return '';
  const root = document.documentElement;
  if (!root) return '';
  return (getComputedStyle(root).getPropertyValue(name) || '').trim();
}

/* ★배경 알파 < 1 이면 뒤에 비치는 것은 #canvas-wrap 의 CSS 배경(#969696)이 «아니다».
     인라인 background 가 같은 속성이라 그 선언을 대체하고, #canvas-area 는 배경 선언이 없어
     투명이다 ⇒ body 의 --ui-bg-app 이 비친다. (DOM 을 따라가 확인함. 추론 아님.) */
const SHELL_FALLBACK = [26, 26, 26];   // #1a1a1a — 변수를 못 읽을 때만 쓰는 «폴백»

/** 배경 문자열 → «불투명» RGB 배열들. 못 읽으면 null. */
function _resolveBackdrops(css, shell) {
  const sh = _parse(shell ?? _cssVar('--ui-bg-app')) ?? SHELL_FALLBACK;
  const g = parseGradient(css);                       // gradient-model.js 재사용
  if (g) {
    const out = [];
    for (const s of g.stops) {
      const c = _parse(s.color);
      if (!c) return null;                            // 한 stop 이라도 못 읽으면 «못 쟀다»
      out.push(_over(c, sh, s.opacity));
    }
    return out.length ? out : null;
  }
  const c = _parseWithAlpha(css);
  return c ? [_over(c.rgb, sh, c.a)] : null;          // null = «못 쟀다»(투명이 아니다)
}

/**
 * 캔버스 배경 CSS 문자열 하나를 받아 연결선에 쓸 «불투명» '#rrggbb' 를 고른다.
 * 못 재면 null — 그러면 호출부가 변수를 걷어 CSS 폴백(오늘 색)이 받는다.
 */
export function edgeColorFor(css, opts = {}) {
  const bds = _resolveBackdrops(css, opts.shell);
  if (!bds) return null;                              // ★「투명」이 아니라 「못 쟀다」
  const min = opts.min ?? MIN_CONTRAST;
  /* ★그라데이션은 «최악 stop» — 평균은 「어디에도 없는 값」이고, 양끝만 보면 중간 stop 을 버린다. */
  const worst = (c) => Math.min(...bds.map(bd => _score(c, bd)));
  const acc = _parse(opts.accent ?? _cssVar('--ui-accent'));
  if (acc && worst(acc) >= min) return _hex(acc);     // 브랜드색 보존
  const W = [255, 255, 255], K = [0, 0, 0];
  return _hex(worst(W) >= worst(K) ? W : K);          // 흰/검 스냅
}

/** 변수를 «칠하는 원소와 같은 원소»에 건다. ⛔documentElement 에 걸면 캔버스가 둘이 되는 날 틀린다. */
export function updateEdgeContrast(css) {
  const el = typeof document !== 'undefined' && document.getElementById('canvas-wrap');
  if (!el) return null;
  const v = edgeColorFor(css);
  if (v) el.style.setProperty('--spl-edge-color', v);
  else   el.style.removeProperty('--spl-edge-color');  // 폴백이 오늘 색으로 받는다
  return v;
}

/** ★배경 writer 가 부르는 «단 하나의 문». 직접 canvasWrap.style.background 에 대입하지 마라(B1). */
export function applyCanvasBackground(css) {
  const el = document.getElementById('canvas-wrap');
  if (el) el.style.background = css;
  updateEdgeContrast(css);
}

/* ★위생검사(A0)·회귀검사가 «같은 물건»을 잡을 수 있게 내보낸다.
   ⛔사본을 새로 만들어 내보내지 마라 — 사본을 내보내면 본체의 변이가 검사를 비껴간다.
   ⛔그리고 DOM 스펙(tests/dom)은 이걸 «import 하지 않는다» — 같은 걸 쓰면
     계산기의 버그가 검사를 통과해 «세탁»된다. 거기는 독립 구현이다. */
export { _over as compositeOver, _L as relativeLuminance, _cr as contrastRatio, _score as edgeScore };

if (typeof window !== 'undefined') {
  /* theme-system.js 는 비-ESM IIFE 라 import 를 못 한다 → window 로도 노출한다. */
  window.__updateEdgeContrast = () => updateEdgeContrast(
    (typeof document !== 'undefined' && document.getElementById('canvas-wrap')?.style.background) || ''
  );
  window.applyCanvasBackground = applyCanvasBackground;
}
