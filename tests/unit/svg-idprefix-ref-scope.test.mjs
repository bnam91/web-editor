/* svg-idprefix-ref-scope.test.mjs — VISUAL-9-SVG-ICON-ID-TEXT-01 조건(매니저·지디 261120) · 보안 세척 경계(js/util/sanitize-svg.js)
 * ⒜ 접두사(idPrefix)를 준 세척: url(#…) 참조는 «같은 svg 안» 남는 id 만 가리킨다(접두사째) · 밖(다른 아이콘·문서) id 를 가리키는 속성은 버린다 ·
 *    href="#…" 는 접두사와 상관없이 늘 버린다(_svgAttrOk).
 *    양성대조 = 밖 참조를 든 svg 를 넣어 그 속성이 사라짐을 본다 · CTL _patches/visual5-144b-CTL-prefix-keeps-outside.patch
 *    (접두사가 밖 참조까지 고쳐 살려 두는 옛 꼴) → ⒜ 빨강.
 * ⒝ 접두사 «없는» 세척(기존 호출 전부 — 마킹 쓰기 길·벡터·라이브러리 패널·sanitizeIconMarkup 6곳 등)은 고치기 전과 «바이트 그대로».
 *    SNAP = 17b20888b(origin/dev · 이 가지 바탕)의 sanitize-svg.js 로 지은 출력(261120 태양 · 입력 5 × 옵션 4 = 20).
 *    지을 때 새 판 출력과 20/20 같음 + sanitizeIconMarkup 도 20/20 같음을 확인했다. 이 자는 새 판이 그 문자열을 그대로 내는지 잰다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const src = readSrc(REPO, 'js/util/sanitize-svg.js');
const names = [...src.matchAll(/export\s+(?:const|function)\s+([A-Za-z0-9_$]+)/g)].map((m) => m[1]);
const { sanitizeSvgString: clean, sanitizeIconMarkup: icon } = new Function(src.replace(/\bexport\s+/g, '') + `\n;return { ${names.join(', ')} };`)();

const ids = (s) => [...s.matchAll(/\sid="([^"]+)"/g)].map((m) => m[1]);
const refs = (s) => [...s.matchAll(/url\(\s*['"]?\s*#([^'")\s]+)/g)].map((m) => m[1]);

test('⒜ 접두사 세척 — 참조는 같은 svg 안 id 만(접두사째)', () => {
  const IN = '<svg viewBox="0 0 10 10"><g clip-path="url(#clip0)"><rect width="5" height="10"/></g>'
    + '<circle cx="5" cy="5" r="4" mask="url( \'#m\' )"/><defs><clipPath id="clip0"><rect width="5" height="10"/></clipPath><mask id="m"><rect width="10" height="10" fill="#fff"/></mask></defs></svg>';
  const out = clean(IN, { idPrefix: 'p1-' });
  assert.deepEqual(ids(out).sort(), ['p1-clip0', 'p1-m']);
  assert.deepEqual(refs(out).sort(), ['p1-clip0', 'p1-m'], '안쪽 참조 둘 다 남고 접두사째');
  for (const r of refs(out)) assert.ok(ids(out).includes(r), `참조 ${r} 는 같은 svg 안 id`);
});

test('⒜ 양성 — 밖 id 를 가리키는 url(#…)·href="#…" 는 접두사가 있어도 지워진다', () => {
  const IN = '<svg viewBox="0 0 10 10"><defs><linearGradient id="g"><stop offset="0" stop-color="#f00"/></linearGradient></defs>'
    + '<path d="M0 0h10" fill="url(#g)"/><rect width="2" height="2" fill="url(#otherIcon-clip0)" stroke="#000"/>'
    + '<circle cx="5" cy="5" r="1" clip-path="url(#icn-b9-clip0)" filter="url(#f)"/><g href="#g" clip-path="url(#g)"><path d="M1 1"/></g></svg>';
  const out = clean(IN, { idPrefix: 'p2-' });
  assert.match(out, /<path d="M0 0h10" fill="url\(#p2-g\)"\/>/, '안쪽 참조는 남는다(빈 그림 초록 금지)');
  assert.match(out, /<rect width="2" height="2" stroke="#000"\/>/, '밖 참조 fill 은 속성째 사라지고 나머지는 남는다');
  assert.doesNotMatch(out, /otherIcon|icn-b9|url\(#p2-f\)|url\(#f\)/, '밖(다른 아이콘·없는 id) 참조 0');
  assert.doesNotMatch(out, /href=/, 'href="#…" 는 늘 버린다');
  for (const r of refs(out)) assert.ok(ids(out).includes(r), `남은 참조 ${r} 는 같은 svg 안 id`);
});

const SNAP = { "INPUTS": [ "<svg viewBox=\"0 0 24 24\"><g clip-path=\"url(#clip0)\"><rect width=\"12\" height=\"24\"/></g><defs><clipPath id=\"clip0\"><rect width=\"12\" height=\"24\"/></clipPath></defs></svg>", "<svg viewBox=\"0 0 24 24\"><defs><linearGradient id=\"qg\"><stop offset=\"0\" stop-color=\"#f00\"/></linearGradient></defs><path d=\"M4 20h16\" fill=\"url(#qg)\"/><rect fill=\"url(#elsewhere)\" width=\"2\" height=\"2\"/></svg>", "<svg viewBox=\"0 0 24 24\" onload=\"x()\"><path d=\"M1 1h22v22H1z\"/><image href=\"data:,\"/><script>x()</script><use href=\"#a\"/><a href=\"javascript:x()\"><path d=\"M0 0\"/></a></svg>", "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" style=\"fill:red;mix-blend-mode:multiply;background:url(x)\"/><text x=\"1\" y=\"8\">AB</text><title>t &amp; t</title></svg>", "<svg viewBox=\"0 0 10 10\"><mask id=\"m\"><rect width=\"10\" height=\"10\" fill=\"#fff\"/></mask><circle cx=\"5\" cy=\"5\" r=\"4\" mask=\"url( '#m' )\" filter=\"url(#f)\"/></svg>" ], "rows": [ [ 0, 0, "<svg viewBox=\"0 0 24 24\"><g clip-path=\"url(#clip0)\"><rect width=\"12\" height=\"24\"/></g><defs><clipPath id=\"clip0\"><rect width=\"12\" height=\"24\"/></clipPath></defs></svg>" ], [ 0, 1, "<svg viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" style=\"color:#222;\"><g clip-path=\"url(#clip0)\"><rect width=\"12\" height=\"24\"/></g><defs><clipPath id=\"clip0\"><rect width=\"12\" height=\"24\"/></clipPath></defs></svg>" ], [ 0, 2, "<svg viewBox=\"0 0 24 24\"><g clip-path=\"url(#clip0)\"><rect width=\"12\" height=\"24\"/></g><defs><clipPath id=\"clip0\"><rect width=\"12\" height=\"24\"/></clipPath></defs></svg>" ], [ 0, 3, "<svg viewBox=\"0 0 24 24\"><g clip-path=\"url(#clip0)\"><rect width=\"12\" height=\"24\"/></g><defs><clipPath id=\"clip0\"><rect width=\"12\" height=\"24\"/></clipPath></defs></svg>" ], [ 1, 0, "<svg viewBox=\"0 0 24 24\"><defs><linearGradient id=\"qg\"><stop offset=\"0\" stop-color=\"#f00\"/></linearGradient></defs><path d=\"M4 20h16\" fill=\"url(#qg)\"/><rect fill=\"url(#elsewhere)\" width=\"2\" height=\"2\"/></svg>" ], [ 1, 1, "<svg viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" style=\"color:#222;\"><defs><linearGradient id=\"qg\"><stop offset=\"0\" stop-color=\"#f00\"/></linearGradient></defs><path d=\"M4 20h16\" fill=\"url(#qg)\"/><rect fill=\"url(#elsewhere)\" width=\"2\" height=\"2\"/></svg>" ], [ 1, 2, "<svg viewBox=\"0 0 24 24\"><defs><linearGradient id=\"qg\"><stop offset=\"0\" stop-color=\"#f00\"/></linearGradient></defs><path d=\"M4 20h16\" fill=\"url(#qg)\"/><rect fill=\"url(#elsewhere)\" width=\"2\" height=\"2\"/></svg>" ], [ 1, 3, "<svg viewBox=\"0 0 24 24\"><defs><linearGradient id=\"qg\"><stop offset=\"0\" stop-color=\"#f00\"/></linearGradient></defs><path d=\"M4 20h16\" fill=\"url(#qg)\"/><rect fill=\"url(#elsewhere)\" width=\"2\" height=\"2\"/></svg>" ], [ 2, 0, "<svg viewBox=\"0 0 24 24\"><path d=\"M1 1h22v22H1z\"/></svg>" ], [ 2, 1, "<svg viewBox=\"0 0 24 24\" width=\"28\" height=\"28\" style=\"color:#222;\"><path d=\"M1 1h22v22H1z\"/></svg>" ], [ 2, 2, "<svg viewBox=\"0 0 24 24\"><path d=\"M1 1h22v22H1z\"/></svg>" ], [ 2, 3, "<svg viewBox=\"0 0 24 24\"><path d=\"M1 1h22v22H1z\"/></svg>" ], [ 3, 0, "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" style=\"fill:red;mix-blend-mode:multiply\"/><title>t &amp; t</title></svg>" ], [ 3, 1, "<svg viewBox=\"0 0 10 10\" width=\"28\" height=\"28\" style=\"color:#222;\"><rect width=\"10\" height=\"10\" style=\"fill:red;mix-blend-mode:multiply\"/><title>t &amp; t</title></svg>" ], [ 3, 2, "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" style=\"fill:red;mix-blend-mode:multiply\"/><title>t &amp; t</title></svg>" ], [ 3, 3, "<svg viewBox=\"0 0 10 10\"><rect width=\"10\" height=\"10\" style=\"fill:red;mix-blend-mode:multiply\"/><title>t &amp; t</title></svg>" ], [ 4, 0, "<svg viewBox=\"0 0 10 10\"><mask id=\"m\"><rect width=\"10\" height=\"10\" fill=\"#fff\"/></mask><circle cx=\"5\" cy=\"5\" r=\"4\" mask=\"url( '#m' )\" filter=\"url(#f)\"/></svg>" ], [ 4, 1, "<svg viewBox=\"0 0 10 10\" width=\"28\" height=\"28\" style=\"color:#222;\"><mask id=\"m\"><rect width=\"10\" height=\"10\" fill=\"#fff\"/></mask><circle cx=\"5\" cy=\"5\" r=\"4\" mask=\"url( '#m' )\" filter=\"url(#f)\"/></svg>" ], [ 4, 2, "<svg viewBox=\"0 0 10 10\"><mask id=\"m\"><rect width=\"10\" height=\"10\" fill=\"#fff\"/></mask><circle cx=\"5\" cy=\"5\" r=\"4\" mask=\"url( '#m' )\" filter=\"url(#f)\"/></svg>" ], [ 4, 3, "<svg viewBox=\"0 0 10 10\"><mask id=\"m\"><rect width=\"10\" height=\"10\" fill=\"#fff\"/></mask><circle cx=\"5\" cy=\"5\" r=\"4\" mask=\"url( '#m' )\" filter=\"url(#f)\"/></svg>" ] ] };
const OPTS = [undefined, { root: { width: '28', height: '28', style: 'color:#222;' } }, { maxLen: 200000 }, { dropped: [] }];

test('⒝ 접두사 없는 세척 = 고치기 전(17b20888b) 출력과 바이트 그대로(20/20)', () => {
  assert.equal(SNAP.rows.length, SNAP.INPUTS.length * OPTS.length, '[전제] 표 크기');
  for (const [i, j, want] of SNAP.rows) {
    const o = OPTS[j] && { ...OPTS[j], dropped: OPTS[j].dropped ? [] : undefined };
    assert.equal(clean(SNAP.INPUTS[i], o), want, `입력 ${i} · 옵션 ${j}`);
    const o2 = OPTS[j] && { ...OPTS[j], dropped: OPTS[j].dropped ? [] : undefined };
    assert.equal(icon(SNAP.INPUTS[i], o2), want, `sanitizeIconMarkup 입력 ${i} · 옵션 ${j}(svg 입력 = 같은 세척)`);
  }
});
