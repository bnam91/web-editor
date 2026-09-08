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
const { GRID_COLOR_RE } = await import(pathToFileURL(alias).href);
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
