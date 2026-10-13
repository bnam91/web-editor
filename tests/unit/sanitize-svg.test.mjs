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
  const b = clean('<svg viewBox="0 0 8 8"><path d="M0 0" data-x="&#106;avascript:alert(3)"/></svg>');
  assert.equal(b, '<svg viewBox="0 0 8 8"><path d="M0 0" data-x="&amp;#106;avascript:alert(3)"/></svg>', '& 를 다시 이스케이프해 실체참조가 풀리지 않는다');
});

test('S6 url( — 바깥 주소는 버리고 안쪽 url(#id) 는 남긴다 · style 의 url/expression/@import 도 버린다', () => {
  const out = clean('<svg viewBox="0 0 8 8"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>'
    + '<path d="M0 0" fill="url(#g)"/><path d="M1 1" fill="url(https://evil.example/a.svg#g)"/>'
    + '<path d="M2 2" style="fill:url(https://evil.example/b)"/><path d="M3 3" style="width:expression(alert(1))"/><path d="M4 4" style="fill:#000;stroke-width:2"/></svg>');
  assert.equal(out, '<svg viewBox="0 0 8 8"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>'
    + '<path d="M0 0" fill="url(#g)"/><path d="M1 1"/><path d="M2 2"/><path d="M3 3"/><path d="M4 4" style="fill:#000;stroke-width:2"/></svg>');
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
    const out = clean(`<svg viewBox="0 0 8 8"><${t} id="bad"><path d="M9 9"/></${t}><path d="M0 0"/></svg>`);
    assert.equal(out, '<svg viewBox="0 0 8 8"><path d="M0 0"/></svg>', `${t}: 안의 path 까지 사라지고 뒤의 path 는 남는다`);
  }
  /* 허용 태그는 전부 살아남는다(대조 — 「다 지워서 초록」이 아니다) */
  for (const t of SVG_ALLOWED_TAGS.filter((x) => x !== 'svg')) {
    const out = clean(`<svg viewBox="0 0 8 8"><${t} id="ok"></${t}></svg>`);
    assert.equal(out, `<svg viewBox="0 0 8 8"><${t} id="ok"></${t}></svg>`, `${t}: 허용 태그는 남는다`);
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
