/* sanitize-svg-attacks — VECTOR 거르개 ⑥(현빈 261117 · wk1/vector-svg-import): 바깥 SVG(붙여넣기·끌어 놓기·Figma) 를 벡터로 들이며 막아야 할 꼴 넷 + style 허용 목록
 *   실행: node tests/run-unit.mjs tests/unit/sanitize-svg-attacks.test.mjs
 *   A1 javascript: 링크 — <a href> · href · xlink:href 어디에도 javascript: 가 안 남는다(<a> 는 안의 것까지)
 *   A2 foreignObject — 안의 HTML(div onclick · iframe)까지 사라진다
 *   A3 바깥 참조 <use href="http…"> · xlink:href — use 째 사라진다 · 바깥 주소 0
 *   A4 style 안 url(…) — 그 선언만 버리고 허용 선언(mask-type·stroke)은 남는다 · 안쪽 url(#id) 도 style 에선 버린다
 *   A5 style 허용 목록 — mask-type·mix-blend-mode·opacity·fill(rgb) 남음 · position·behavior·background·var·calc 버림 · !important 떼고 남김 · 이스케이프면 속성째 · 남을 것 없으면 style 속성 없음
 *   A6 멱등 — 걸러 낸 것을 또 걸러도 같다(style 포함)
 * 양성대조: _patches/VEC-CTL6-sanitize-off.patch(sanitizeSvgString 이 입력을 그대로 돌려줌) → A1~A5 빨강 ·
 *           _patches/VEC-CTL7-style-passthrough.patch(style 값을 걸러지 않고 그대로) → A4·A5 빨강.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* js/util 은 Node 에서 CommonJS 로 읽힌다 ⇒ sanitize-svg.test.mjs 와 같은 꼴로 글자째 읽어 돌린다 */
const { readSrc } = createRequire(import.meta.url)('./_srcread.js');
const src = readSrc(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../'), 'js/util/sanitize-svg.js');
const { sanitizeSvgString, SVG_MAX_LEN_CEIL } = new Function(src.replace(/\bexport\s+/g, '') + '\n;return { sanitizeSvgString, SVG_MAX_LEN_CEIL };')();
const clean = (s) => sanitizeSvgString(s, { maxLen: SVG_MAX_LEN_CEIL });

test('A1 javascript: 링크 — a·href·xlink:href', () => {
  const out = clean('<svg><a href="javascript:alert(1)"><path d="M0"/></a><path d="M1" href="javascript:y" xlink:href="javascript:x"/><path d="M2" fill="javascript:z"/></svg>');
  assert.ok(out.startsWith('<svg'), '[전제] svg 로 남는다');
  assert.doesNotMatch(out, /javascript:|<a\b|href/i);
  assert.equal(out, '<svg><path d="M1"/><path d="M2"/></svg>');
});

test('A2 foreignObject — 안의 HTML 까지', () => {
  const out = clean('<svg><foreignObject width="10" height="10"><div xmlns="http://www.w3.org/1999/xhtml" onclick="x()">x<iframe src="http://evil.example/"></iframe></div></foreignObject><path d="M0"/></svg>');
  assert.doesNotMatch(out, /foreignObject|<div|iframe|evil\.example|onclick/i);
  assert.equal(out, '<svg><path d="M0"/></svg>');
});

test('A3 바깥 참조 use — href·xlink:href · use 째', () => {
  const out = clean('<svg><use href="http://evil.example/x.svg#a"/><use xlink:href="https://evil.example/y.svg#b" x="1"/><use href="#local"/><path d="M0"/></svg>');
  assert.doesNotMatch(out, /<use|evil\.example|href/i);
  assert.equal(out, '<svg><path d="M0"/></svg>');
});

test('A4 style 안 url( — 그 선언만 버림 · 안쪽 #id 도 style 에선 버림', () => {
  assert.equal(clean('<svg><path d="M0" style="fill:url(http://evil.example/a);mask-type:alpha;stroke:#f00"/></svg>'),
    '<svg><path d="M0" style="mask-type:alpha;stroke:#f00"/></svg>');
  assert.equal(clean('<svg><path d="M0" style="fill:url(#g);stroke:URL( \'http://evil.example/b\' )"/></svg>'), '<svg><path d="M0"/></svg>', '남을 선언이 없으면 style 속성째 없다');
  assert.equal(clean('<svg><path d="M0" fill="url(#g)"/></svg>'), '<svg><path d="M0" fill="url(#g)"/></svg>', '[음성] 속성 fill 의 안쪽 url(#id) 는 종전대로 남는다');
});

test('A5 style 허용 목록', () => {
  assert.equal(clean('<svg><path d="M0" style="mix-blend-mode:multiply;opacity:.5;position:fixed;behavior:url(x);fill:rgb(1,2,3);background:red"/></svg>'),
    '<svg><path d="M0" style="mix-blend-mode:multiply;opacity:.5;fill:rgb(1,2,3)"/></svg>');
  assert.equal(clean('<svg><mask id="m" style="mask-type:alpha"><path d="M0"/></mask></svg>'), '<svg><mask id="m" style="mask-type:alpha"><path d="M0"/></mask></svg>', '피그마 마스크 alpha(측정 s5)가 산다');
  assert.equal(clean('<svg><path d="M0" style="opacity:var(--x);stroke-width:calc(1px);fill:#000 !important;color:expression(alert(1))"/></svg>'),
    '<svg><path d="M0" style="fill:#000"/></svg>', 'var·calc·expression 버림 · !important 떼고 남김');
  assert.equal(clean('<svg><path d="M0" style="fill:red;/*x*/stroke:#000"/></svg>'), '<svg><path d="M0"/></svg>', '주석이 든 style 은 속성째');
  assert.equal(clean('<svg><path d="M0" style="fill:\\72 ed"/></svg>'), '<svg><path d="M0"/></svg>', '역슬래시 든 style 은 속성째');
  assert.equal(clean('<svg><path d="M0" style="fill:red&quot;><script>x</script>"/></svg>'), '<svg><path d="M0"/></svg>', '따옴표·꺾쇠 든 style 은 속성째');
});

test('A6 멱등 — style 포함', () => {
  for (const x of ['<svg><path d="M0" style="mask-type:alpha;opacity:.5;fill:url(http://e/a)"/></svg>', '<svg><path d="M0" style="fill:#000 !important"/></svg>']) {
    const once = clean(x);
    assert.equal(clean(once), once, x);
  }
});
