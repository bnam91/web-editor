/* radial-samples.js — 방사형 프로토(Z6)의 «샘플 그림 표» (1012t1Z6 · 2026-10-13).
 * 아티팩트(브라우저판)에는 파일창이 없다 ⇒ 칸 그림은 «샘플 키»로 고른다. 그림은 전부 이 파일 안의 작은 인라인 SVG 다(외부 참조 0 · 요청 0).
 * 싣는 길은 radial-geom.js 와 같다 — 쓰는 모듈이 side-effect import 해 window.RADIAL_SAMPLES 를 받고, 유닛은 require. DOM 을 안 읽는다.
 *
 * 규약
 *   · 저장하는 것은 «키»뿐이다(dataset · items[i].img). 그리는 쪽은 has(key) 로 거른 뒤에만 svg(key) 를 innerHTML 에 넣는다.
 *   · 표 밖의 키(빈 글자 · 'constructor' 같은 상속 이름 포함)는 svg · dataUri · label 이 전부 '' 를 돌려준다.
 *   · 그림은 viewBox 0 0 64 64 의 «색면 + 흰 도형»이다. 네모로 그려 두고 칸(원 · 둥근사각)이 잘라 쓴다 — id·그라데이션 정의를 안 써서 같은 그림이 여러 번 들어가도 안 부딪힌다. */
(function (root) {
  var KEYS = Object.freeze(['leaf', 'drop', 'molecule', 'pill', 'shield', 'moon', 'bottle', 'sun']);
  var W = '#ffffff';
  /* 키 → [한글 이름, 색면 색, 흰 도형(바탕색이 필요한 자리는 {c})] */
  var TABLE = {
    leaf: ['잎', '#3fa66a',
      '<path fill="' + W + '" d="M32 11 C47 18 51 35 32 53 C13 35 17 18 32 11 Z"/>'
      + '<path fill="none" stroke="{c}" stroke-width="2" stroke-linecap="round" d="M32 20 V46 M32 30 L40 24 M32 37 L24 31"/>'],
    drop: ['물방울', '#3b8fe0',
      '<path fill="' + W + '" d="M32 10 C40 22 46 30 46 38 A14 14 0 0 1 18 38 C18 30 24 22 32 10 Z"/>'
      + '<path fill="none" stroke="{c}" stroke-width="2.5" stroke-linecap="round" d="M25 39 A7 7 0 0 0 31 45"/>'],
    molecule: ['분자', '#7a5ce0',
      '<path fill="none" stroke="' + W + '" stroke-width="3" stroke-linecap="round" d="M32 21 L21 41 M32 21 L44 40 M21 41 L44 40"/>'
      + '<circle fill="' + W + '" cx="32" cy="21" r="8"/><circle fill="' + W + '" cx="21" cy="41" r="7"/><circle fill="' + W + '" cx="44" cy="40" r="6"/>'],
    pill: ['알약', '#e0679a',
      '<g transform="rotate(-45 32 32)"><rect fill="' + W + '" x="12" y="23" width="40" height="18" rx="9"/>'
      + '<path fill="none" stroke="{c}" stroke-width="2" d="M32 23 V41"/></g>'],
    shield: ['방패', '#2bb3a3',
      '<path fill="' + W + '" d="M32 11 L48 17 V31 C48 42 41 49 32 53 C23 49 16 42 16 31 V17 Z"/>'
      + '<path fill="none" stroke="{c}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" d="M25 32 L30 37 L40 26"/>'],
    moon: ['달', '#4a55b8',
      '<path fill="' + W + '" d="M39 12 A20 20 0 1 0 52 39 A16 16 0 0 1 39 12 Z"/>'
      + '<circle fill="' + W + '" cx="47" cy="18" r="2"/><circle fill="' + W + '" cx="52" cy="27" r="1.5"/>'],
    bottle: ['병', '#e08a3b',
      '<rect fill="' + W + '" x="27" y="10" width="10" height="7" rx="1.5"/>'
      + '<path fill="' + W + '" d="M25 20 H39 V25 C43 27 45 30 45 34 V49 A4 4 0 0 1 41 53 H23 A4 4 0 0 1 19 49 V34 C19 30 21 27 25 25 Z"/>'
      + '<rect fill="{c}" x="23" y="35" width="18" height="10" rx="2"/>'],
    sun: ['해', '#f0b429',
      '<circle fill="' + W + '" cx="32" cy="32" r="9"/>'
      + '<path fill="none" stroke="' + W + '" stroke-width="3" stroke-linecap="round" d="M32 12 V17 M32 47 V52 M12 32 H17 M47 32 H52 M17.9 17.9 L21.4 21.4 M42.6 42.6 L46.1 46.1 M46.1 17.9 L42.6 21.4 M21.4 42.6 L17.9 46.1"/>'],
  };
  function has(key) { return typeof key === 'string' && KEYS.indexOf(key) !== -1; }
  function label(key) { return has(key) ? TABLE[key][0] : ''; }
  function color(key) { return has(key) ? TABLE[key][1] : ''; }
  /* 인라인 SVG 문자열 — 칸을 꽉 채운다(width·height 100% · 넘치는 쪽은 자른다). */
  function svg(key) {
    if (!has(key)) return '';
    var c = TABLE[key][1];
    return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%" preserveAspectRatio="xMidYMid slice" aria-hidden="true" data-radial-sample="' + key + '">'
      + '<rect width="64" height="64" fill="' + c + '"/>'
      + '<circle cx="50" cy="12" r="30" fill="' + W + '" opacity="0.16"/>'
      + TABLE[key][2].split('{c}').join(c)
      + '</svg>';
  }
  /* <img src> 용 data URI(CSP img-src data: 허용). */
  function dataUri(key) {
    return has(key) ? 'data:image/svg+xml;utf8,' + encodeURIComponent(svg(key)) : '';
  }
  var LABELS = {}; KEYS.forEach(function (k) { LABELS[k] = TABLE[k][0]; }); Object.freeze(LABELS);

  var RADIAL_SAMPLES = Object.freeze({ KEYS: KEYS, LABELS: LABELS, has: has, label: label, color: color, svg: svg, dataUri: dataUri });
  if (typeof module !== 'undefined' && module.exports) module.exports = RADIAL_SAMPLES;
  if (root) root.RADIAL_SAMPLES = RADIAL_SAMPLES;
})(typeof window !== 'undefined' ? window : null);
