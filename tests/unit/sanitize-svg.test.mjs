/* sanitize-svg — svg 문자열 거르개(js/util/sanitize-svg.js · 1013t2B5)가 «위험한 것은 전부 버리고 그림은 남기는가».
 *
 * ★무엇을 잠그나
 *   S0 전제 — 모듈이 DOM 없이 실리고, 멀쩡한 svg 는 그림(태그·좌표·viewBox)이 남는다
 *   S1 script · S2 on* · S3 foreignObject(안의 것까지) · S4 href / xlink:href · S5 javascript: 값(실체참조·공백 우회 포함)
 *   S6 바깥 주소 url( … ) 은 버리고 안쪽 url(#id) 는 남긴다 · style 의 url/expression/@import
 *   S7 뿌리가 svg 가 아니면 '' · 글자·빈 값·문자열 아님·상한 초과도 ''
 *   S8 불허 태그 명부(use · image · a · animate · set · style · iframe …)가 «안의 것까지» 사라진다 — 허용목록은 «런타임 값»으로 읽는다
 *   S9 뿌리 덮어쓰기(root) — 크기·style 을 한 번만 적고, 값은 이스케이프된다
 *   S10 안 닫힌 입력·대소문자·주석·뿌리 뒤 꼬리 — 출력은 늘 닫힌 svg 하나
 *   ── 2차(이벨류에이터 D1·D3·D4·D5) ──
 *   S11 시간 상한 — 안 닫힌 여는 태그·안 닫힌 따옴표·깊은 중첩·엉뚱한 닫는 태그가 줄지어도 선형으로 끝난다(옛 판: 16KB 에 5초)
 *   S12 멱등 — 두 번 걸러도 같은 글자(실체참조가 한 겹씩 자라지 않는다)
 *   S13 style 은 통째로 · 역슬래시(CSS 이스케이프) · image-set/var 같은 함수 · 이름에 ':' 가 든 속성(xml:base …)이 사라진다
 *   S14 class · data-* 는 사라지고 id 는 url(#…) 가 가리키는 태그에만 남는다
 * ★기대값은 «글자로» 박았다. 출력 전체를 공통 술어(noDanger)로도 한 번 더 훑는다.
 * ⛔앱 0 · 네트워크 0. 이 모듈은 순수 문자열 함수라 export 만 걷어 그대로 돌린다(variant-ship-leak 과 같은 꼴 —
 *   이 레포의 js/*.js 는 package.json 이 commonjs 라 Node 가 import 하지 못한다).
 * ⚠️이 검사는 «문자열»만 본다. 브라우저에서 실제로 아무것도 안 도는지는 tests/dom/marking-icon-label.dom.spec.js M3 이 잰다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const MOD = 'js/util/sanitize-svg.js';

function load() {
  const src = readSrc(REPO, MOD);
  const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
  assert.deepEqual(names.sort(), ['SVG_ALLOWED_TAGS', 'SVG_MAX_LEN', 'sanitizeSvgString'], '★전제: 내보내는 이름 셋');
  return new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();
}
const { sanitizeSvgString: clean, SVG_ALLOWED_TAGS, SVG_MAX_LEN } = load();

/* 출력 어디에도 없어야 하는 것 — 태그 여는 꼴의 script/foreignObject, 속성 꼴의 on*, href, javascript: */
function noDanger(out, label) {
  assert.doesNotMatch(out, /<\s*script/i, `${label}: script 태그`);
  assert.doesNotMatch(out, /<\s*foreignObject/i, `${label}: foreignObject 태그`);
  assert.doesNotMatch(out, /\son[a-z]+\s*=/i, `${label}: on* 속성`);
  assert.doesNotMatch(out, /href\s*=/i, `${label}: href 속성`);
  assert.doesNotMatch(out, /javascript:/i, `${label}: javascript:`);
  assert.doesNotMatch(out, /<\s*(img|iframe|use|image|a|style|animate|set)\b/i, `${label}: 불허 태그`);
}

test('S0 전제 — DOM 없이 실리고, 멀쩡한 svg 는 그림이 남는다', () => {
  assert.equal(typeof clean, 'function');
  assert.ok(Array.isArray(SVG_ALLOWED_TAGS) && SVG_ALLOWED_TAGS.includes('svg') && SVG_ALLOWED_TAGS.includes('path'), '허용목록이 런타임 값으로 실렸다');
  const out = clean('<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 6l6 6-6 6"/><circle cx="12" cy="12" r="3"/></svg>');
  assert.equal(out, '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor"><path d="M9 6l6 6-6 6"/><circle cx="12" cy="12" r="3"/></svg>');
});

test('S1 script — 태그와 그 안의 글자가 통째로 사라진다', () => {
  const out = clean('<svg viewBox="0 0 8 8"><script>window.__pwned = 1; if (1 < 2) alert(1)</script><path d="M0 0"/></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8"><path d="M0 0"/></svg>');
  noDanger(out, 'S1');
  assert.doesNotMatch(out, /__pwned|alert/, '스크립트 본문이 글자로도 안 남는다');
});

test('S2 on* — 뿌리·자식의 이벤트 속성이 전부 사라진다(대소문자·공백 변형 포함)', () => {
  const out = clean('<svg onload="alert(1)" ONLOAD=alert(2) viewBox="0 0 8 8"><path d="M0 0" onclick="x()" OnMouseOver = "y()"/><g onfocus=z()><circle r="1"/></g></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8"><path d="M0 0"/><g><circle r="1"/></g></svg>');
  noDanger(out, 'S2');
});

test('S3 foreignObject — 그 안의 HTML 까지 통째로 사라지고 뒤의 그림은 남는다', () => {
  const out = clean('<svg viewBox="0 0 8 8"><foreignObject width="8" height="8"><img src=x onerror=alert(1)><div onclick="a()">x</div></foreignObject><rect width="2" height="2"/></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8"><rect width="2" height="2"/></svg>');
  noDanger(out, 'S3');
  assert.doesNotMatch(out, /onerror|alert/);
});

test('S4 href — href · xlink:href 속성과 그것을 쓰는 태그(a · use · image)가 사라진다', () => {
  const out = clean('<svg viewBox="0 0 8 8"><a href="https://evil.example/"><path d="M1 1"/></a><use xlink:href="https://evil.example/x.svg#i"/><image href="https://evil.example/p.png"/><path d="M2 2" href="#x" xlink:href="#y"/></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8"><path d="M2 2"/></svg>');
  noDanger(out, 'S4');
  assert.doesNotMatch(out, /evil\.example/);
});

test('S5 javascript: — 속성 값에 든 것은 버린다 · 실체참조로 가린 것은 «글자»로 굳는다', () => {
  const a = clean('<svg viewBox="0 0 8 8"><g transform="javascript:alert(1)"><path d="M0 0"/></g><path d="M1 1" fill="java\tscript:alert(2)"/></svg>');
  assert.equal(a, '<svg viewBox="0 0 8 8"><g><path d="M0 0"/></g><path d="M1 1"/></svg>');
  noDanger(a, 'S5-a');
  /* 실체참조로 가린 것 — 먼저 풀어서 판정한다(2차 · D3): 풀린 값이 javascript: 면 속성째 버린다 */
  const b = clean('<svg viewBox="0 0 8 8"><path d="M0 0" fill="&#106;avascript:alert(3)" stroke="&#x6A;avascript&colon;x" opacity="&#48;.5"/></svg>');
  assert.equal(b, '<svg viewBox="0 0 8 8"><path d="M0 0" stroke="javascript&amp;colon;x" opacity="0.5"/></svg>',
    '숫자 참조는 풀어서 걸린다 · 모르는 이름 참조(&colon;)는 안 풀고 & 를 이스케이프해 «글자»로 굳힌다 · 무해한 참조는 풀린 값으로 남는다');
});

test('S6 url( — 바깥 주소는 버리고 안쪽 url(#id) 는 남긴다 · style 의 url/expression/@import 도 버린다', () => {
  const out = clean('<svg viewBox="0 0 8 8"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>'
    + '<path d="M0 0" fill="url(#g)"/><path d="M1 1" fill="url(https://evil.example/a.svg#g)"/>'
    + '<path d="M2 2" style="fill:url(https://evil.example/b)"/><path d="M3 3" style="width:expression(alert(1))"/><path d="M4 4" style="fill:#000;stroke-width:2"/></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>'
    + '<path d="M0 0" fill="url(#g)"/><path d="M1 1"/><path d="M2 2"/><path d="M3 3"/><path d="M4 4"/></svg>');   // style 은 무해해 보여도 통째로 버린다(2차 · D4)
  assert.doesNotMatch(out, /evil\.example|expression/);
});

test('S7 뿌리 — svg 가 아니면 빈 문자열 · 글자·빈 값·문자열 아님·상한 초과도', () => {
  assert.equal(clean('<img src=x onerror=alert(1)>'), '');
  assert.equal(clean('<div><svg viewBox="0 0 8 8"><path d="M0 0"/></svg></div>'), '', '뿌리가 div');
  assert.equal(clean('<script>alert(1)</script><svg viewBox="0 0 8 8"></svg>'), '<svg viewBox="0 0 8 8"></svg>', '앞의 script 는 버리고 svg 뿌리만');
  assert.equal(clean('그냥 글자'), '');
  assert.equal(clean(''), '');
  assert.equal(clean(null), '');
  assert.equal(clean({ toString: () => '<svg/>' }), '', '문자열이 아니면 안 받는다');
  assert.equal(clean('<svg'), '', '안 닫힌 여는 태그');
  assert.ok(SVG_MAX_LEN >= 1000, '★전제: 상한이 수다');
  assert.equal(clean('<svg viewBox="0 0 8 8"><path d="' + 'M0 0 '.repeat(SVG_MAX_LEN / 4) + '"/></svg>'), '', '상한 초과');
});

test('S8 불허 태그 — 허용목록 밖은 «안의 것까지» 사라진다(명부는 런타임 값)', () => {
  const BAD = ['script', 'style', 'foreignObject', 'use', 'image', 'a', 'animate', 'animateTransform', 'set', 'iframe', 'object', 'embed', 'text', 'tspan', 'filter', 'feImage', 'symbol', 'marker', 'pattern', 'switch', 'video'];
  for (const t of BAD) {
    assert.equal(SVG_ALLOWED_TAGS.includes(t), false, `★전제: ${t} 는 허용목록에 없다`);
    const out = clean(`<svg viewBox="0 0 8 8"><${t} opacity="1"><path d="M9 9"/></${t}><path d="M0 0"/></svg>`);
    assert.equal(out, '<svg viewBox="0 0 8 8"><path d="M0 0"/></svg>', `${t}: 안의 path 까지 사라지고 뒤의 path 는 남는다`);
  }
  /* 허용 태그는 전부 살아남는다(대조 — 「다 지워서 초록」이 아니다) */
  for (const t of SVG_ALLOWED_TAGS.filter((x) => x !== 'svg')) {
    const out = clean(`<svg viewBox="0 0 8 8"><${t} opacity="1"></${t}></svg>`);
    assert.equal(out, `<svg viewBox="0 0 8 8"><${t} opacity="1"></${t}></svg>`, `${t}: 허용 태그는 남는다`);
  }
});

test('S9 뿌리 덮어쓰기 — 크기·style 을 한 번만 적고 값은 이스케이프된다', () => {
  const out = clean('<svg WIDTH="999" height="1em" style="position:fixed" viewBox="0 0 8 8"><path d="M0 0"/></svg>',
    { root: { width: '26', height: '26', style: 'color:#fff;"><script>' } });
  assert.equal(out, '<svg viewBox="0 0 8 8" width="26" height="26" style="color:#fff;&quot;&gt;&lt;script&gt;"><path d="M0 0"/></svg>');
  assert.equal((out.match(/width=/gi) || []).length, 1, 'width 는 한 번만');
  assert.doesNotMatch(out, /<\s*script/i);
  /* 자식에는 안 덮어쓴다 */
  assert.equal(clean('<svg><g width="5"><path d="M0 0"/></g></svg>', { root: { width: '26' } }), '<svg width="26"><g width="5"><path d="M0 0"/></g></svg>');
});

test('S10 꼴 — 대소문자·주석·안 닫힌 태그·뿌리 뒤 꼬리에도 출력은 닫힌 svg 하나', () => {
  assert.equal(clean('<SVG viewBox="0 0 8 8"><!-- <script>x</script> --><G><PATH d="M0 0"></svg><p onclick="x()">꼬리</p>'),
    '<svg viewBox="0 0 8 8"><g><path d="M0 0"></path></g></svg>');
  assert.equal(clean('<?xml version="1.0"?><!DOCTYPE svg><svg viewBox="0 0 8 8"><clippath id="c"><rect width="1" height="1"/></clippath></svg>'),
    '<svg viewBox="0 0 8 8"><clipPath id="c"><rect width="1" height="1"/></clipPath></svg>', '정식 이름(clipPath)으로 적는다');
  assert.equal(clean('<svg viewBox="0 0 8 8"><title>이름 <b>굵게</b> & 끝</title><path d="M0 0"/></svg>'),
    '<svg viewBox="0 0 8 8"><title>이름  &amp; 끝</title><path d="M0 0"/></svg>', 'title 안의 불허 태그는 그 안의 글자까지 사라지고, 남는 글자는 이스케이프된다');
  assert.equal(clean('<svg viewBox="0 0 8 8"><title>a < b & c</title><path d="M0 0"/></svg>'),
    '<svg viewBox="0 0 8 8"><title>a  b &amp; c</title><path d="M0 0"/></svg>', '글자는 이스케이프된다');
});

/* ── 2차 — 이벨류에이터 D1·D3·D4·D5 ─────────────────────────────────────────────────────────── */

/* 시간 상한(ms). 고친 판은 아래 입력들에 2~90ms 였다(전수 부하 측정이 도는 기계에서 node 로 직접 불러 잰 값 — 메모 2차 절).
   옛 판은 '<g x'×4000(16KB)에 5.1초 · '<g a="'×30000 은 60초를 넘겼다(이벨류에이터 실측).
   ⚠️부하가 심한 기계에서 흔들리지 않게 상한을 1초로 둔다 — 그래도 옛 판의 가장 가벼운 사례(5초)를 가른다. 안전(출력)도 같이 본다. */
const TIME_CAP_MS = 1000;
function timed(input) {
  const t0 = process.hrtime.bigint();
  const out = clean(input);
  return { out, ms: Number(process.hrtime.bigint() - t0) / 1e6 };
}

test('S11 시간 상한 — 안 닫힌 태그·따옴표·깊은 중첩이 줄지어도 선형으로 끝나고 결과가 안전하다', () => {
  assert.equal(SVG_MAX_LEN, 20000, '입력 상한(아이콘은 수 KB)');
  const CASES = [
    ['안 닫힌 여는 태그 4000개', '<svg>' + '<g x'.repeat(4000), '<svg></svg>'],
    ['안 닫힌 따옴표 3000개', '<svg>' + '<g a="'.repeat(3000), '<svg></svg>'],
    ['꺾쇠만 19000개', '<svg>' + '<'.repeat(19000), '<svg></svg>'],
    ['script 쌍 1100개', '<svg>' + '<script></script>'.repeat(1100), '<svg></svg>'],
    ['불허 태그 3000겹 + 엉뚱한 닫는 태그 2000개', '<svg>' + '<b>'.repeat(3000) + '</i>'.repeat(2000), '<svg></svg>'],
    ['허용 태그 2500겹 + 엉뚱한 닫는 태그 2000개', '<svg>' + '<g>'.repeat(2500) + '</path>'.repeat(1500), null],
    ['속성 4900개', '<svg ' + 'a=1 '.repeat(4900) + '>', '<svg a="1"></svg>'],
    ['여는 괄호 19000개', '<svg><path d="' + '('.repeat(19000) + '"/></svg>', '<svg><path/></svg>'],
  ];
  for (const [label, input, want] of CASES) {
    assert.ok(input.length <= SVG_MAX_LEN, `★전제(${label}): 입력이 상한 안이다(${input.length}) — 상한에 걸려 초록이 되면 안 된다`);
    const r = timed(input);
    assert.ok(r.ms < TIME_CAP_MS, `${label}: ${r.ms.toFixed(1)}ms — 상한 ${TIME_CAP_MS}ms`);
    if (want !== null) assert.equal(r.out, want, `${label}: 출력`);
    noDanger(r.out, label);
    assert.ok(r.out.startsWith('<svg') && r.out.endsWith('</svg>'), `${label}: 닫힌 svg 하나`);
  }
  /* 상한을 넘으면 읽지도 않고 거절 */
  const over = timed('<svg>' + '<g x'.repeat(6000));
  assert.equal(over.out, '', '상한 초과는 빈 문자열');
});

test('S12 멱등 — 두 번 걸러도 같은 글자다(실체참조가 한 겹씩 자라지 않는다)', () => {
  const INPUTS = [
    '<svg><title>A &amp; B &lt;x&gt; &amp;amp;</title><path d="M0" fill="a&quot;b" opacity="&#49;"/></svg>',
    '<svg viewBox="0 0 8 8"><path d="M0 0" transform="rotate(45 4 4)" fill="url(#g)"/><defs><linearGradient id="g"><stop offset="0" stop-color="rgb(1,2,3)"/></linearGradient></defs></svg>',
    '<SVG><G><PATH D=M0 x=\'"\'><title>a<b>c</b>&colon;d',
    '<svg><path d="M0" stroke=&amp;amp;/></svg>',
    '<svg onload="x()"><script>1</script><path d="M0 0" onclick=y() style="fill:red" class="k" data-a="1"/></svg>',
    '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="currentColor" d="M4 11h12v2H4z"/></svg>',
    '<svg><title>&amp;lt;script&amp;gt; &#38;#60; &</title></svg>',
  ];
  for (const x of INPUTS) {
    const once = clean(x), twice = clean(once), thrice = clean(twice);
    assert.ok(once.length > 0, `★전제: 빈 문자열이 아니다 — ${x}`);
    assert.equal(twice, once, `두 번째가 다르다 — 입력 ${x}`);
    assert.equal(thrice, once, `세 번째가 다르다 — 입력 ${x}`);
  }
  assert.equal(clean('<svg><title>A &amp; B</title><path d="M0" opacity="a&quot;b"/></svg>'),
    '<svg><title>A &amp; B</title><path d="M0" opacity="a&quot;b"/></svg>', '이미 이스케이프된 것은 그대로다(옛 판: &amp;amp; 로 자랐다)');
  /* 뿌리 덮어쓰기도 되풀이해서 같은 글자 */
  const R = { root: { width: '26', height: '26', style: 'color:#fff;' } };
  const a = clean('<svg viewBox="0 0 8 8" width="1em"><path d="M0"/></svg>', R);
  assert.equal(clean(a, R), a, '뿌리 덮어쓰기를 되풀이해도 같다');
});

test('S13 style 통째로 · 역슬래시 · 허용 밖 함수 · 이름에 콜론이 든 속성이 사라진다', () => {
  assert.equal(clean('<svg><g style="background-image:\\75rl(http://evil.example/a.png);mask-image:\\75 rl(http://evil.example/b)"><path d="M0" style="fill:red"/></g></svg>'),
    '<svg><g><path d="M0"/></g></svg>', 'style 은 값이 무엇이든 속성째 버린다');
  assert.equal(clean('<svg><g style="background:image-set(\'http://evil.example/a.png\' 1x)"><path d="M0"/></g></svg>'), '<svg><g><path d="M0"/></g></svg>');
  const out = clean('<svg><path d="M0" fill="\\75rl(http://evil.example/#a)" filter="URL( http://evil.example/#f )" mask="url(#m)" stroke="url(\'#s\')"'
    + ' clip-path="image-set(\'http://evil.example\' 1x)" opacity="var(--x)" stroke-width="calc(1px)"/></svg>');
  assert.equal(out, '<svg><path d="M0" mask="url(#m)" stroke="url(\'#s\')"/></svg>', '안쪽 url(#id) 만 남는다 · 역슬래시·바깥 주소·image-set·var·calc 는 속성째 사라진다');
  assert.doesNotMatch(out, /evil\.example|\\/);
  assert.equal(clean('<svg xml:base="http://evil.example/" xmlns:xlink="http://www.w3.org/1999/xlink" xmlns="http://www.w3.org/2000/svg"><path d="M0" fill="url(#a)" xml:space="preserve"/></svg>'),
    '<svg xmlns="http://www.w3.org/2000/svg"><path d="M0" fill="url(#a)"/></svg>', '이름에 콜론이 든 속성은 전부 버린다(xmlns 는 남는다)');
  /* 대조 — 그림에 쓰는 함수는 남는다(「괄호를 다 지워서 초록」이 아니다) */
  assert.equal(clean('<svg><path d="M0" transform="translate(1,2) rotate(3) scale(2) matrix(1 0 0 1 0 0) skewX(4) skewY(5)" fill="rgb(1,2,3)" stroke="rgba(0,0,0,.5)" stop-color="hsl(10,20%,30%)"/></svg>'),
    '<svg><path d="M0" transform="translate(1,2) rotate(3) scale(2) matrix(1 0 0 1 0 0) skewX(4) skewY(5)" fill="rgb(1,2,3)" stroke="rgba(0,0,0,.5)" stop-color="hsl(10,20%,30%)"/></svg>');
  /* 실체참조로 가린 url( 도 풀어서 걸린다 */
  assert.equal(clean('<svg><path d="M0" fill="&#117;rl(http://evil.example)"/></svg>'), '<svg><path d="M0"/></svg>');
});

test('S14 class · data-* 는 사라지고 id 는 url(#…) 가 가리키는 태그에만 남는다', () => {
  const out = clean('<svg id="canvas-wrap" class="section-block"><g class="sticker-block selected" data-count="99" id="stk-count-label" data-shape="circle"><path d="M0" id="p" CLASS="x" DATA-K="1"/></g>'
    + '<defs><clipPath id="c" class="x"><rect width="1"/></clipPath><linearGradient id="g"/><radialGradient id="r"/><mask id="m"/></defs></svg>');
  assert.equal(out, '<svg><g><path d="M0"/></g><defs><clipPath id="c"><rect width="1"/></clipPath><linearGradient id="g"/><radialGradient id="r"/><mask id="m"/></defs></svg>');
  assert.doesNotMatch(out, /class=|data-|sticker-block|canvas-wrap|stk-count-label/i, '에디터 셀렉터에 걸릴 것이 안 남는다');
});
