/* U5 — _GRID_COLOR_RE 가 컬러변수 var() 를 «받는가». (2026-09-08)
 *
 * ★왜 (하루 전에 실측된 함정)
 *   _typo-section 의 Fill 절은 `${p}-color-chips` 자리를 내고 color-var-chips.js 가
 *   `var(--color-brand, #ff0000)` 바인딩을 쏜다. 렌더러의 색 검증이 그걸 «거부»하면
 *   칩이 「눌리는데 안 먹는」 상태가 된다 — modal-block.js 가 2026-09-08 정확히 같은 것에
 *   물려 고친 자국이 있고, 그리드는 그때 같이 안 고쳐졌다.
 *   ⛔안 먹는 칩은 없는 것보다 나쁘다.
 *
 * ★그리고 «좁게» 유지해야 한다 — 이 값은 style 속성에 그대로 들어간다.
 *   세미콜론·중괄호가 새면 선언을 깨고 그 뒤를 통째로 밀어낸다.
 *   되돌리면 빨강: grid-block.js 의 `|^var\(\s*--[\w-]+\s*(?:,\s*[^;{}()]*)?\)$` 를 지우면.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { pathToFileURL } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ★실제 소스의 정규식을 «그대로» 돌린다(베끼지 않는다) — grid-p1.test.js 와 같은 기법. */
const STUB = "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n";
let src = readSrc(ROOT, 'js/blocks/grid-block.js');
{
  const b = src;
  src = src.replace("import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n", STUB);
  assert.notEqual(src, b, 'drag-utils/drag-drop import 2줄을 못 찾음 — 리팩터링됐나?');
}
const gcr = path.join(os.tmpdir(), `gcr-colorre-${process.pid}.mjs`);
{
  const b = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(gcr).href));
  assert.notEqual(src, b, 'grid-cell-resize.js import 를 못 찾음');
}
const alias = path.join(os.tmpdir(), `grid-colorre-${process.pid}.mjs`);
fs.copyFileSync(path.join(ROOT, 'js/grid-cell-resize.js'), gcr);
fs.writeFileSync(alias, src);
globalThis.window = {};
globalThis.document = { createElement: () => ({ dataset: {}, style: {}, classList: { add() {}, remove() {}, contains: () => false, replace: () => false }, appendChild: (c) => c, scrollIntoView() {} }), getElementById: () => null };
const { GRID_COLOR_RE, GRID_FONT_RE, gridLineHtml } = await import(pathToFileURL(alias).href);
fs.unlinkSync(alias); fs.unlinkSync(gcr);

test('U5-0 ★양성대조 — 잣대가 살아 있다 (평범한 hex 는 통과한다)', () => {
  assert.ok(GRID_COLOR_RE instanceof RegExp, '정규식을 못 가져왔다 — 아래가 전부 자기통과한다');
  assert.equal(GRID_COLOR_RE.test('#ff0000'), true, '6자리 hex 조차 못 받는다 — 잣대가 죽었다');
});

test('U5 ★컬러변수 바인딩 var(--color-…) 를 «받는다»', () => {
  for (const ok of [
    'var(--color-brand, #ff0000)',
    'var(--color-brand)',
    'var( --color-primary , #6b9eff )',
  ]) {
    assert.equal(GRID_COLOR_RE.test(ok), true,
      `«${ok}» 를 거부한다 — 컬러변수 칩이 「눌리는데 안 먹는」 상태가 된다`);
  }
});

test('U5-b ★기존에 받던 형태는 그대로 받는다 (회귀)', () => {
  for (const ok of ['#fff', '#ff0000', '#ff0000aa', 'transparent',
                    'rgb(1,2,3)', 'rgba(1,2,3,0.5)', 'hsl(10, 20%, 30%)']) {
    assert.equal(GRID_COLOR_RE.test(ok), true, `«${ok}» 가 거부됐다 — 넓히려다 좁혔다`);
  }
});

test('U5-c ★음성대조 — 선언을 깨는 값은 «거부»한다 (넓힌 것이 구멍이 되지 않았다)', () => {
  for (const bad of [
    'javascript:alert(1)',
    'red;background:url(x)',
    '',
    'var(--x); background:red',
    'var(--x, #fff); }',
    'expression(alert(1))',
    '#ff0000; color:blue',
  ]) {
    assert.equal(GRID_COLOR_RE.test(bad), false,
      `«${bad}» 를 통과시킨다 — 이 값은 style 속성에 그대로 들어가 선언을 깨고 뒤를 밀어낸다`);
  }
});

/* ══ U10 — _GRID_FONT_RE ═══════════════════════════════════════════════
 * ★형제(_GRID_COLOR_RE)는 이 파일을 받았는데 같은 커밋의 이 가드는 «아무 검사도» 없었다.
 *   실측(적대 검수): 가드를 /^[^<>]+$/ 로 전면 개방해도 npm test 1851 · test:dom 64 «전부 초록».
 *   ⇒ 코드 옆 주석은 「세미콜론·중괄호가 새면 선언을 깨고 그 뒤를 통째로 밀어낸다」고 정확히
 *     적혀 있는데 그 문장을 무는 것이 없었다 — 「검사처럼 생긴 문장」이다.
 *
 * ★왜 이 가드가 유일한 문지기인가
 *   값은 ${ffCss} 로 style 속성에 «그대로» 들어간다. _esc 는 & < > " 만 막고 «;» 와 «:» 는 안 막는다.
 *   그리고 이 필드는 MCP update_block{patchCell} 로 «검증 없이» 들어온다(스키마가 type:'object').
 * 되돌리면 빨강: grid-block.js 의 `const _GRID_FONT_RE = /^[\w\s,'"\-().가-힣]+$/;` 를 넓히면.
 */

test('U10-0 ★양성대조 — 잣대가 살아 있다 (피커가 주는 체인은 통과한다)', () => {
  assert.ok(GRID_FONT_RE instanceof RegExp, '정규식을 못 가져왔다 — 아래가 전부 자기통과한다');
  for (const ok of ["'Inter', sans-serif", "'Noto Sans KR', sans-serif", 'Georgia, serif',
                    'sans-serif', "'프리텐다드', sans-serif"]) {
    assert.equal(GRID_FONT_RE.test(ok), true, `«${ok}» 를 거부한다 — 정상 폰트가 안 먹는다`);
  }
});

test('U10 ★음성대조 — 선언을 깨는 값을 «거부»한다 (;  와  : 를 막는 건 여기뿐이다)', () => {
  for (const bad of [
    'Arial;color:red',                        // 뒤에 선언을 하나 더 붙인다
    'Arial}#canvas{display:none',             // 중괄호로 규칙을 탈출한다
    'Arial;background-image:url(http://x/y)', // 외부 요청을 만든다
    'Arial;position:fixed;top:0;left:0',      // 레이아웃을 덮는다
    'Arial\n;color:red',
    '',
  ]) {
    assert.equal(GRID_FONT_RE.test(bad), false,
      `★«${bad}» 를 통과시킨다 — 이 값은 style 속성에 그대로 들어가고 _esc 는 «;» 을 안 막는다. ` +
      `MCP update_block{patchCell} 이 검증 없이 넣으므로 이 정규식이 유일한 문지기다.`);
  }
});

test('U10-b ★가드가 «실제 렌더»에서 그 값을 떨군다 (정규식만 맞고 렌더가 안 쓰면 소용없다)', () => {
  // 「정규식은 거부하는데 렌더러가 다른 길로 넣는다」를 막는다 — 입구가 아니라 «결과»를 잰다.
  const html = gridLineHtml({ type: 'body', text: 'X', fontFamily: 'Arial;color:red' }, 'left', 0, null);
  assert.equal(/font-family:/.test(html), false, `거부된 값이 산출에 들어갔다:\n${html}`);
  assert.equal(/color:red/.test(html), false, `★주입이 성공했다 — 선언이 깨졌다:\n${html}`);
  // 짝 — 정상 값은 «실제로» 들어간다(위 단언이 「아무것도 안 들어간다」로 통과하지 않는다).
  const ok = gridLineHtml({ type: 'body', text: 'X', fontFamily: "'Inter', sans-serif" }, 'left', 0, null);
  assert.ok(ok.includes("font-family:'Inter', sans-serif;"), `정상 폰트도 안 들어간다:\n${ok}`);
});
