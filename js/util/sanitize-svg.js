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
 *   · 속성(2차 · 이벨류에이터 D3~D5 반영 — 「남길 것만 남긴다」 쪽으로 좁혔다):
 *       - 값은 먼저 실체참조를 «한 번» 풀고(&amp; &lt; &gt; &quot; &apos; · &#NN; · &#xHH;) 그 풀린 값으로 판정한 뒤 다시 이스케이프한다
 *         ⇒ 두 번 걸러도 같은 글자다(멱등 — `&amp;` 가 `&amp;amp;` 로 자라지 않는다) · `&#106;avascript:` 는 풀린 채로 걸린다
 *       - on* · href · src · srcdoc · action · formaction · `style`(통째로) · `class` · `data-*` · 이름에 `:` 가 든 것(xlink:href · xml:base · xmlns:xlink …) 제거
 *       - 값에 javascript: / vbscript: / data:text/html 이 있으면 제거 · 역슬래시(`\`)가 있으면 제거(CSS 이스케이프 `\75rl(` 길)
 *       - 괄호는 «허용한 함수»만: url(#안쪽id) · rgb · rgba · hsl · hsla · matrix · translate · scale · rotate · skewX · skewY.
 *         그 밖의 함수(바깥 주소 url( · image-set( · expression( · var( …)가 든 값은 속성째 버린다
 *       - `id` 는 url(#…) 가 가리키는 태그(linearGradient · radialGradient · clipPath · mask)에만 남긴다.
 *         ⚠️그 id 는 문서의 다른 id 와 부딪칠 수 있다(접두사를 안 붙인다 — 붙이면 url(#…) 참조를 전부 다시 써야 한다).
 *           그림 요소(path · g …)의 id · class · data-* 를 버리는 까닭이 그것이다: 에디터의 셀렉터
 *           (.sticker-block[data-count] · #stk-count-label …)에 «아이콘 안의 가짜 요소»가 잡히지 않게.
 *   · 글자 노드는 <title> 안의 것만(실체참조를 풀고 다시 이스케이프해서) 남긴다. 주석·doctype·처리 명령은 버린다.
 *   · 안 닫힌 태그는 끝에서 닫아 준다.
 *   · ★선형 시간(D1): 여는 태그를 읽다 «문자열 끝»에 닿으면 거기서 끝낸다(뒤에 `>` 가 없으면 더 읽을 태그도 없다).
 *     옛 판은 태그마다 끝까지 다시 읽어 `<g x` 가 줄지은 16KB 에 5초가 걸렸다. 입력 상한도 20,000자로 낮췄다(아이콘은 수 KB).
 *   · 뿌리 덮어쓰기(opts.root)는 «부르는 쪽이 지은 값»이라 위 속성 판정을 안 거친다(값은 이스케이프된다) — style 을 넣는 유일한 길이다.
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
/** 입력 상한 — 넘으면 ''. 아이콘 svg 는 수 KB 다(상한이 크면 손댄 저장본이 그릴 때마다 그만큼 읽힌다). */
export const SVG_MAX_LEN = 20000;

const _SVG_CANON = Object.create(null);
SVG_ALLOWED_TAGS.forEach((t) => { _SVG_CANON[t.toLowerCase()] = t; });

const _SVG_NAME_RE = /^[A-Za-z][A-Za-z0-9:_.-]*/;
const _SVG_WS_RE = /[\u0000- ]/;

function _svgEsc(s) {
  return String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

/* 실체참조를 «한 번» 푼다(되풀이 안 함 — `&amp;lt;` 는 `&lt;` 까지만). _svgEsc 의 짝이다: _svgDecode(_svgEsc(x)) === x. */
const _SVG_ENT_RE = /&(?:#(\d{1,7})|#[xX]([0-9a-fA-F]{1,6})|(amp|lt|gt|quot|apos));?/g;
const _SVG_ENT_NAMED = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" };
function _svgDecode(s) {
  if (s.indexOf('&') < 0) return s;
  return s.replace(_SVG_ENT_RE, (m, dec, hex, named) => {
    if (named) return _SVG_ENT_NAMED[named];
    const cp = dec ? parseInt(dec, 10) : parseInt(hex, 16);
    if (!(cp > 0) || cp > 0x10FFFF || (cp >= 0xD800 && cp <= 0xDFFF)) return '�';
    return String.fromCodePoint(cp);
  });
}

/* 값 안에서 «불러도 되는» 함수 이름(소문자). url 은 안쪽 참조(url(#id))일 때만 — 아래에서 따로 본다. */
const _SVG_FUNC_OK = { url: 1, rgb: 1, rgba: 1, hsl: 1, hsla: 1, matrix: 1, translate: 1, scale: 1, rotate: 1, skewx: 1, skewy: 1 };
/* id 를 남기는 태그 — url(#…) 가 가리키는 것들뿐. */
const _SVG_ID_TAGS = { linearGradient: 1, radialGradient: 1, clipPath: 1, mask: 1 };

/** 속성을 남겨도 되나. name 은 원문 그대로, value 는 «실체참조를 푼» 값, canon 은 그 태그의 정식 이름. */
function _svgAttrOk(name, value, canon) {
  if (!/^[A-Za-z][A-Za-z0-9_.-]*$/.test(name)) return false;      // 이름에 ':' 가 든 것(xlink:href · xml:base …)도 여기서 떨어진다
  const n = name.toLowerCase();
  if (n.slice(0, 2) === 'on') return false;
  if (n === 'href' || n === 'src' || n === 'srcdoc' || n === 'action' || n === 'formaction') return false;
  if (n === 'style' || n === 'class' || n.slice(0, 5) === 'data-') return false;
  if (n === 'id' && !_SVG_ID_TAGS[canon]) return false;
  const v = String(value);
  if (v.indexOf('\\') >= 0) return false;
  const probe = v.replace(/[\u0000- ]+/g, '').toLowerCase();
  if (probe.indexOf('javascript:') >= 0 || probe.indexOf('vbscript:') >= 0 || probe.indexOf('data:text/html') >= 0) return false;
  /* 괄호 — 여는 괄호마다 바로 앞의 이름이 허용 함수여야 한다. url 은 `url(#…)` 만. */
  let at = probe.indexOf('(');
  while (at >= 0) {
    let st = at;
    while (st > 0) { const c = probe.charCodeAt(st - 1); if ((c >= 97 && c <= 122) || c === 45) st--; else break; }
    const fn = probe.slice(st, at);
    if (!_SVG_FUNC_OK[fn]) return false;
    if (fn === 'url') {
      let k = at + 1;
      const q = probe.charAt(k);
      if (q === '"' || q === "'") k++;
      if (probe.charAt(k) !== '#') return false;
    }
    at = probe.indexOf('(', at + 1);
  }
  return true;
}

/** `<name …>` 한 개를 읽는다. i = '<' 다음 글자.
 *  돌려줌 = { name, attrs:[[n,v]…], selfClose, end } · null(태그가 아니다 — 이름 꼴이 아님) · _SVG_EOF(읽다가 문자열 끝에 닿았다 = 안 닫힌 태그).
 *  ★_SVG_EOF 를 받으면 부르는 쪽은 «거기서 끝낸다» — 뒤에 `>` 가 없으니 더 읽을 태그가 없다(다시 읽으면 태그 수 × 길이 = O(n²)). */
const _SVG_EOF = { eof: true };
function _svgReadTag(src, i) {
  const m = _SVG_NAME_RE.exec(src.slice(i, i + 64));
  if (!m) return null;
  const name = m[0];
  let p = i + name.length;
  const attrs = [];
  const len = src.length;
  for (;;) {
    while (p < len && _SVG_WS_RE.test(src.charAt(p))) p++;
    if (p >= len) return _SVG_EOF;
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
        if (close < 0) return _SVG_EOF;
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
 * opts.idPrefix(3차 · N2) = 남기는 id 와 그것을 가리키는 url(#…) 에 붙일 접두사([A-Za-z][A-Za-z0-9_-]* 꼴만 받는다).
 *   같은 아이콘을 든 블럭이 한 문서에 여럿이면 id 가 겹쳐 뒤 블럭의 url(#g) 가 앞 블럭 것을 가리킨다 — 그리는 쪽이 블럭마다 다른 접두사를 준다.
 *   ⚠️접두사를 준 결과는 «그 자리에서 그릴 것»이다 — dataset 에 되쓰면 걸 때마다 접두사가 자란다(쓰는 길은 이 옵션을 안 준다).
 * @param {{ root?: Record<string,string>, idPrefix?: string }} [opts]  root = 뿌리 <svg> 에 «덮어쓸» 속성(같은 이름은 바꾸고 없으면 더한다 — 값은 이스케이프된다)
 */
export function sanitizeSvgString(input, opts) {
  if (typeof input !== 'string') return '';
  if (input.length > SVG_MAX_LEN) return '';
  const src = input;
  const len = src.length;
  let lowerSrc = null;      // script/style 의 닫는 자리를 찾을 때만 한 번 만든다
  /* 뿌리 덮어쓰기 — 이름은 소문자로 견준다(원문이 WIDTH 여도 한 번만 적힌다). 이름 꼴이 아닌 것은 안 받는다. */
  const idPrefix = (opts && typeof opts.idPrefix === 'string' && /^[A-Za-z][A-Za-z0-9_-]*$/.test(opts.idPrefix)) ? opts.idPrefix : '';
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
  const openHas = Object.create(null);   // 그 이름이 open 에 몇 개 있나(같은 까닭)
  const skipHas = Object.create(null);   // 그 이름이 skip 에 몇 개 있나 — 없는 이름의 닫는 태그마다 스택을 훑지 않게(선형 시간)
  const skipPush = (nm) => { skip.push(nm); skipHas[nm] = (skipHas[nm] || 0) + 1; };
  let started = false;    // 뿌리 <svg> 를 적었다
  let i = 0;

  while (i < len) {
    const lt = src.indexOf('<', i);
    /* 글자 — <title> 바로 안의 것만 남긴다 */
    const textEnd = lt < 0 ? len : lt;
    if (textEnd > i && started && !skip.length && open.length && open[open.length - 1] === 'title') {
      out += _svgEsc(_svgDecode(src.slice(i, textEnd)));
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
        if (skipHas[lower]) {                            // 그 태그와 그 안에 안 닫힌 것들까지 걷는다
          let top;
          do { top = skip.pop(); skipHas[top] -= 1; } while (top !== lower);
        }
        continue;
      }
      const canon = _SVG_CANON[lower];
      if (!canon) continue;
      if (!openHas[canon]) continue;                     // 열린 적 없는 이름 — 스택을 훑지 않는다(선형 시간)
      let top;
      do { top = open.pop(); openHas[top] -= 1; out += '</' + top + '>'; } while (top !== canon);
      continue;
    }

    const tag = _svgReadTag(src, i);
    if (tag === _SVG_EOF) break;                         // 안 닫힌 여는 태그 — 뒤에 읽을 것이 없다(선형 시간 · D1)
    if (!tag) continue;                                  // 태그가 아니다 — '<' 한 글자를 버리고 계속
    i = tag.end;
    const lower = tag.name.toLowerCase();
    if (skip.length) {
      if (!tag.selfClose) skipPush(lower);
      continue;
    }
    const canon = _SVG_CANON[lower];
    if (!canon) {
      if (tag.selfClose) continue;
      if (lower === 'script' || lower === 'style') {     // 날글자 요소 — 안의 '<' 를 태그로 읽지 않고 닫는 자리까지 건너뛴다
        if (lowerSrc === null) lowerSrc = src.toLowerCase();
        const e = lowerSrc.indexOf('</' + lower, i);
        if (e < 0) { i = len; continue; }
        const g = src.indexOf('>', e);
        i = g < 0 ? len : g + 1;
        continue;
      }
      skipPush(lower);
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
      const av = _svgDecode(tag.attrs[a][1]);            // 실체참조를 풀어서 판정하고, 적을 때 다시 이스케이프한다(멱등 · D3)
      const key = an.toLowerCase();
      if (seen[key]) continue;                           // 같은 이름은 첫 것만(HTML 파서와 같은 규칙)
      if (isRoot && overLower && overLower[key]) continue;   // 뿌리에서 덮어쓸 속성 — 원문 것은 버리고 아래에서 새로 적는다
      if (!_svgAttrOk(an, av, canon)) continue;
      seen[key] = true;
      /* 접두사(N2) — id 자신과, 값 안의 url(#…) 참조를 같이 고친다(여기까지 온 url( 은 전부 안쪽 참조다 — _svgAttrOk 가 걸렀다) */
      let outV = av;
      if (idPrefix) {
        if (key === 'id') outV = idPrefix + av;
        else if (av.indexOf('(') >= 0) outV = av.replace(/(url\(\s*['"]?\s*#)/gi, '$1' + idPrefix);
      }
      kept.push([an, outV]);
    }
    if (isRoot && overLower) Object.keys(overLower).forEach((k) => kept.push(overLower[k]));
    out += '<' + canon;
    for (let a = 0; a < kept.length; a++) out += ' ' + kept[a][0] + '="' + _svgEsc(kept[a][1]) + '"';
    if (tag.selfClose) out += '/>';
    else { out += '>'; open.push(canon); openHas[canon] = (openHas[canon] || 0) + 1; }
    if (tag.selfClose && isRoot) break;                  // <svg/> 한 개로 끝
  }
  if (!started) return '';
  while (open.length) out += '</' + open.pop() + '>';
  return out;
}
