/* sanitize-svg.js — «svg 문자열»을 안전한 꼴로 «다시 짓는» 순수 함수 한 벌. (1013t2B5)
 *
 * ★왜 있나
 *   마킹 블럭의 아이콘은 svg «문자열»로 dataset(data-count-icon-svg)에 실리고, 그릴 때 innerHTML 로 들어간다.
 *   로드 세척(js/io/save-load.js sanitizeCanvasHtml)은 «DOM 으로 파싱된» script·on* 만 지우고
 *   data-* 속성 «값 안의 문자열»은 안 본다 ⇒ 저장본을 손대면 `<svg onload=…>` 가 세척을 지나
 *   그리는 순간 살아난다. 그래서 «쓸 때»와 «그릴 때마다» 이 함수로 거른다.
 *
 * ★어떻게 — «걸러 내기»가 아니라 «다시 짓기»(허용목록 재구성)다.
 *   입력을 토큰으로 읽어, 허용한 태그·속성만 «새 문자열»로 다시 적는다. 그 밖은 통째로 버린다.
 *   · 뿌리는 <svg> 하나여야 한다. 아니면 ''.
 *   · 허용 태그 = SVG_ALLOWED_TAGS. 그 밖(script · style · foreignObject · use · image · a · animate* · set …)은 «안의 것까지» 버린다.
 *   · 속성: on* 제거 · href / xlink:href(그 밖 *:href) 제거 · 값에 javascript: / vbscript: / data:text/html / expression( 이 있으면 제거
 *           · url( 은 `url(#안쪽id)` 만 남긴다(바깥 주소는 제거) · style 은 url( · expression · javascript: · @import 가 있으면 제거
 *   · 값의 & < > " 는 전부 다시 이스케이프한다 ⇒ `&#106;avascript:` 같은 실체참조 우회가 «글자»로 굳는다.
 *   · 글자 노드는 <title> 안의 것만(이스케이프해서) 남긴다. 주석·doctype·처리 명령은 버린다.
 *   · 안 닫힌 태그는 끝에서 닫아 준다.
 *
 * ★DOM 을 안 쓴다 — 문자열만 다룬다. 그래서 유닛(tests/unit/sanitize-svg.test.mjs)이 Node 에서 그대로 돌린다.
 *   ⛔「위험한 것을 찾아 지우는」 정규식 치환이 아니다 — 출력에 들어가는 것은 이 파일이 «직접 적은» 꼴뿐이다.
 *   브라우저에서 실제로 아무것도 안 도는지는 tests/dom/marking-icon-label.dom.spec.js M3 이 잰다.
 *
 * ★이 파일이 사는 자리의 규약(js/util/) — 임자 없는 순수 함수만. 상태·DOM 소유·블럭 지식 없음.
 *
 * ★소비자 — 늘면 여기 적어라
 *   ⑴ js/blocks/sticker-block.js — 마킹 블럭의 커스텀 아이콘을 «그릴 때»(뿌리 속성 덮어쓰기 포함) + window._sanitizeSvgString 알리아스
 *   ⑵ js/count-sticker-tool.js(고전 스크립트 · 그 알리아스로) — dataset 에 «쓸 때»
 *   ⚠️아이콘 스티커(shape:'icon')의 data-icon-svg 는 아직 날것으로 들어간다(기존 · 이번 범위 밖 — 같은 함수 한 줄로 막을 수 있다).
 */

export const SVG_ALLOWED_TAGS = [
  'svg', 'g', 'path', 'circle', 'ellipse', 'rect', 'line', 'polyline', 'polygon',
  'defs', 'linearGradient', 'radialGradient', 'stop', 'clipPath', 'mask', 'title',
];
/** 입력 상한 — 넘으면 ''(기존 아이콘 스티커의 상한과 같은 수). */
export const SVG_MAX_LEN = 200000;

const _SVG_CANON = Object.create(null);
SVG_ALLOWED_TAGS.forEach((t) => { _SVG_CANON[t.toLowerCase()] = t; });

const _SVG_NAME_RE = /^[A-Za-z][A-Za-z0-9:_.-]*/;
const _SVG_WS_RE = /[\u0000- ]/;

function _svgEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/** 속성을 남겨도 되나. name 은 원문 그대로, value 는 따옴표를 벗긴 원문. */
function _svgAttrOk(name, value) {
  if (!/^[A-Za-z][A-Za-z0-9:_.-]*$/.test(name)) return false;
  const n = name.toLowerCase();
  if (n.slice(0, 2) === 'on') return false;
  if (n === 'href' || n.slice(-5) === ':href' || n === 'src' || n === 'srcdoc' || n === 'action' || n === 'formaction') return false;
  const probe = String(value).replace(/[\u0000- ]+/g, '').toLowerCase();
  if (probe.indexOf('javascript:') >= 0 || probe.indexOf('vbscript:') >= 0) return false;
  if (probe.indexOf('data:text/html') >= 0 || probe.indexOf('expression(') >= 0) return false;
  if (n === 'style') {
    if (probe.indexOf('url(') >= 0 || probe.indexOf('expression') >= 0 || probe.indexOf('@import') >= 0) return false;
    return true;
  }
  /* url( 은 문서 안쪽 참조(url(#id))만 — 바깥 주소는 버린다 */
  let at = probe.indexOf('url(');
  while (at >= 0) {
    const rest = probe.slice(at + 4).replace(/^['"]/, '');
    if (rest.charAt(0) !== '#') return false;
    at = probe.indexOf('url(', at + 4);
  }
  return true;
}

/** `<name …>` 한 개를 읽는다. i = '<' 다음 글자. 돌려줌 = { name, attrs:[[n,v]…], selfClose, end } 또는 null(태그가 아니다/안 닫혔다). */
function _svgReadTag(src, i) {
  const m = _SVG_NAME_RE.exec(src.slice(i, i + 64));
  if (!m) return null;
  const name = m[0];
  let p = i + name.length;
  const attrs = [];
  const len = src.length;
  for (;;) {
    while (p < len && _SVG_WS_RE.test(src.charAt(p))) p++;
    if (p >= len) return null;
    const c = src.charAt(p);
    if (c === '>') return { name, attrs, selfClose: false, end: p + 1 };
    if (c === '/') {
      if (src.charAt(p + 1) === '>') return { name, attrs, selfClose: true, end: p + 2 };
      p++; continue;
    }
    let q = p;
    while (q < len && !_SVG_WS_RE.test(src.charAt(q)) && src.charAt(q) !== '=' && src.charAt(q) !== '>' && src.charAt(q) !== '/') q++;
    if (q === p) { p++; continue; }
    const an = src.slice(p, q);
    p = q;
    while (p < len && _SVG_WS_RE.test(src.charAt(p))) p++;
    let av = '';
    if (src.charAt(p) === '=') {
      p++;
      while (p < len && _SVG_WS_RE.test(src.charAt(p))) p++;
      const quote = src.charAt(p);
      if (quote === '"' || quote === "'") {
        const close = src.indexOf(quote, p + 1);
        if (close < 0) return null;
        av = src.slice(p + 1, close);
        p = close + 1;
      } else {
        q = p;
        while (q < len && !_SVG_WS_RE.test(src.charAt(q)) && src.charAt(q) !== '>') q++;
        av = src.slice(p, q);
        p = q;
      }
    }
    attrs.push([an, av]);
  }
}

/**
 * svg 문자열을 허용목록으로 «다시 지어» 돌려준다. 뿌리가 <svg> 가 아니거나 못 읽으면 ''.
 * @param {string} input
 * @param {{ root?: Record<string,string> }} [opts]  root = 뿌리 <svg> 에 «덮어쓸» 속성(같은 이름은 바꾸고 없으면 더한다 — 값은 이스케이프된다)
 */
export function sanitizeSvgString(input, opts) {
  if (typeof input !== 'string') return '';
  if (input.length > SVG_MAX_LEN) return '';
  const src = input;
  const len = src.length;
  /* 뿌리 덮어쓰기 — 이름은 소문자로 견준다(원문이 WIDTH 여도 한 번만 적힌다). 이름 꼴이 아닌 것은 안 받는다. */
  let overLower = null;
  if (opts && opts.root) {
    overLower = Object.create(null);
    Object.keys(opts.root).forEach((an) => {
      if (/^[A-Za-z][A-Za-z0-9:_.-]*$/.test(an)) overLower[an.toLowerCase()] = [an, String(opts.root[an])];
    });
  }
  let out = '';
  const open = [];        // 지금 열려 있는 «허용» 태그(정식 이름)
  const skip = [];        // 버리는 중인 «불허» 태그(소문자) — 안의 것까지 버린다
  let started = false;    // 뿌리 <svg> 를 적었다
  let i = 0;

  while (i < len) {
    const lt = src.indexOf('<', i);
    /* 글자 — <title> 바로 안의 것만 남긴다 */
    const textEnd = lt < 0 ? len : lt;
    if (textEnd > i && started && !skip.length && open.length && open[open.length - 1] === 'title') {
      out += _svgEsc(src.slice(i, textEnd));
    }
    if (lt < 0) break;
    i = lt + 1;
    if (started && !open.length) break;                  // 뿌리가 닫힌 뒤의 것은 안 읽는다

    if (src.slice(i, i + 3) === '!--') {                 // 주석
      const e = src.indexOf('-->', i + 3);
      i = e < 0 ? len : e + 3;
      continue;
    }
    const c0 = src.charAt(i);
    if (c0 === '!' || c0 === '?') {                      // doctype · CDATA · 처리 명령
      const e = src.indexOf('>', i);
      i = e < 0 ? len : e + 1;
      continue;
    }
    if (c0 === '/') {                                    // 닫는 태그
      const m = _SVG_NAME_RE.exec(src.slice(i + 1, i + 65));
      const e = src.indexOf('>', i);
      i = e < 0 ? len : e + 1;
      if (!m) continue;
      const lower = m[0].toLowerCase();
      if (skip.length) {
        const k = skip.lastIndexOf(lower);
        if (k >= 0) skip.length = k;                     // 그 태그와 그 안에 안 닫힌 것들까지 걷는다
        continue;
      }
      const canon = _SVG_CANON[lower];
      if (!canon) continue;
      const k = open.lastIndexOf(canon);
      if (k < 0) continue;
      while (open.length > k) out += '</' + open.pop() + '>';
      continue;
    }

    const tag = _svgReadTag(src, i);
    if (!tag) continue;                                  // 태그가 아니다 — '<' 한 글자를 버리고 계속
    i = tag.end;
    const lower = tag.name.toLowerCase();
    if (skip.length) {
      if (!tag.selfClose) skip.push(lower);
      continue;
    }
    const canon = _SVG_CANON[lower];
    if (!canon) {
      if (tag.selfClose) continue;
      if (lower === 'script' || lower === 'style') {     // 날글자 요소 — 안의 '<' 를 태그로 읽지 않고 닫는 자리까지 건너뛴다
        const e = src.toLowerCase().indexOf('</' + lower, i);
        if (e < 0) { i = len; continue; }
        const g = src.indexOf('>', e);
        i = g < 0 ? len : g + 1;
        continue;
      }
      skip.push(lower);
      continue;
    }
    if (!started) {
      if (canon !== 'svg') return '';                    // 뿌리가 svg 가 아니다
      started = true;
    }
    const seen = Object.create(null);
    const kept = [];
    const isRoot = open.length === 0;
    for (let a = 0; a < tag.attrs.length; a++) {
      const an = tag.attrs[a][0];
      const av = tag.attrs[a][1];
      const key = an.toLowerCase();
      if (seen[key]) continue;                           // 같은 이름은 첫 것만(HTML 파서와 같은 규칙)
      if (isRoot && overLower && overLower[key]) continue;   // 뿌리에서 덮어쓸 속성 — 원문 것은 버리고 아래에서 새로 적는다
      if (!_svgAttrOk(an, av)) continue;
      seen[key] = true;
      kept.push([an, av]);
    }
    if (isRoot && overLower) Object.keys(overLower).forEach((k) => kept.push(overLower[k]));
    out += '<' + canon;
    for (let a = 0; a < kept.length; a++) out += ' ' + kept[a][0] + '="' + _svgEsc(kept[a][1]) + '"';
    if (tag.selfClose) out += '/>';
    else { out += '>'; open.push(canon); }
    if (tag.selfClose && isRoot) break;                  // <svg/> 한 개로 끝
  }
  if (!started) return '';
  while (open.length) out += '</' + open.pop() + '>';
  return out;
}
