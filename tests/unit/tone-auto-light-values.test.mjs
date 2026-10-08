/* tone-auto-light-values.test.mjs — ★T6. 「어두운 배경 위 역할색」이 ★두 자리에 사는 문제의 ★«재는 자». (2026-10-07)
 *
 * ★왜 있나 — 같은 값 묶음이 ★두 곳에 산다:
 *     ⑴ js/blocks/grid-block.js `_GRID_ROLE_COLOR_ON_DARK`  — 그리드 줄(G5 · 현빈 2026-10-03)
 *     ⑵ css/editor-layout.css  `.tone-auto-light` 절        — 섹션 직속 텍스트(T6 · 현빈 2026-10-07)
 *   ★CSS 를 JS 로 들여올 길이 없고, ★거꾸로 JS 표를 CSS 로 내보낼 길도 없다 ⇒ ★합칠 수 없다.
 *   ⛔그럴 때 이 레포의 답은 ★«경고 주석»이 아니라 ★★«재는 자»다
 *     (선례: grid-patchcell-reject P6 · grid-circle-text-inset I2 — 둘 다 소스를 파싱해 맞춘다).
 *
 * ★무엇을 재나 — ★두 자리의 ★«역할 → 색» 표가 ★같은가. ⛔두 표를 이 파일에 ★손으로 적지 않는다.
 * ★양성대조: 어느 쪽이든 한 글자 바꾸면 ★빨강이다(V3 가 그걸 «변이로» 증명한다).
 * ⚠️`tb-bullet` 은 그리드 쪽 표에 ★없다 — ★body 와 같은 값을 쓴다(그 사실을 V2 가 ★이름으로 단언한다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const JS  = fs.readFileSync(path.join(ROOT, 'js/blocks/grid-block.js'), 'utf8');
const CSS = fs.readFileSync(path.join(ROOT, 'css/editor-layout.css'), 'utf8');

/** 그리드 쪽 표 — `_GRID_ROLE_COLOR_ON_DARK = { label: '#f2f2f2', h1: '#ffffff', … }` */
function gridTable(src) {
  const m = /_GRID_ROLE_COLOR_ON_DARK\s*=\s*\{([\s\S]*?)\}/.exec(src);
  if (!m) return null;
  const out = {};
  for (const mm of m[1].matchAll(/(\w+)\s*:\s*'(#[0-9a-fA-F]{3,8})'/g)) out[mm[1]] = mm[2].toLowerCase();
  return Object.keys(out).length ? out : null;
}
/** CSS 쪽 표 — `.tb-<역할>.tone-auto-light` 묶음마다 그 선언의 color. */
function cssTable(src) {
  const out = {};
  // 선택자 묶음 … { color: #xxx; }
  for (const blk of src.matchAll(/((?:#canvas[^{]*\.tone-auto-light[^{]*,?\s*)+)\{\s*color:\s*(#[0-9a-fA-F]{3,8})\s*;?\s*\}/g)) {
    const color = blk[2].toLowerCase();
    for (const r of blk[1].matchAll(/\.tb-([a-z0-9]+)\.tone-auto-light/g)) out[r[1]] = color;
  }
  return Object.keys(out).length ? out : null;
}

test('V1 ★전제 — 두 표를 «둘 다» 떴다(못 뜨면 아래 대조는 다른 이유로 초록이 된다)', () => {
  const g = gridTable(JS), c = cssTable(CSS);
  assert.ok(g, '★grid-block.js 의 _GRID_ROLE_COLOR_ON_DARK 를 못 떴다 — 이름이 바뀌었나?');
  assert.ok(c, '★css/editor-layout.css 의 .tone-auto-light 절을 못 떴다 — 그 절이 바뀌었나?');
  assert.ok(Object.keys(g).length >= 5, `★그리드 표가 ${Object.keys(g).length}개만 떴다 — 파싱이 깨졌다`);
  assert.ok(Object.keys(c).length >= 5, `★CSS 표가 ${Object.keys(c).length}개만 떴다 — 파싱이 깨졌다`);
});

test('V2 ★두 자리의 «역할 → 색»이 같다 (⚠️bullet 은 그리드 표에 없다 — body 값을 쓴다)', () => {
  const g = gridTable(JS), c = cssTable(CSS);
  /* ★그리드 표에 있는 역할만 견준다 — ★CSS 에만 있는 `bullet` 은 아래에서 따로 단언한다. */
  const shared = Object.keys(g).filter(k => k in c).sort();
  assert.ok(shared.length >= 5, `★겹치는 역할이 ${shared.length}개뿐이다 — 한쪽에서 역할이 빠졌다: grid=${Object.keys(g)} css=${Object.keys(c)}`);
  const mismatch = shared.filter(k => g[k] !== c[k]).map(k => `${k}: grid=${g[k]} css=${c[k]}`);
  assert.deepEqual(mismatch, [],
    '★같은 역할의 «어두운 배경 위 색»이 두 자리에서 갈렸다.\n' +
    '  ⇒ 한쪽만 고쳤다. 「그리드와 섹션 글자가 같은 톤」이라는 약속이 거짓이 됐다.');
  /* ★bullet — 그리드 표엔 없다. ★body 와 같아야 한다(그게 CSS 주석이 적어 둔 결). */
  assert.ok('bullet' in c, '★CSS 에 bullet 규칙이 없다 — 불릿은 어두운 체커 위에서 안 밝아진다');
  assert.equal(c.bullet, c.body, `★bullet(${c.bullet})이 body(${c.body})와 다르다 — 같은 폰트 베이스인데 톤이 갈렸다`);
});

test('V3 ★양성대조 — CSS 쪽 색을 한 글자 바꾸면 V2 가 빨개진다(이 자가 «값»을 실제로 잠근다)', () => {
  const g = gridTable(JS);
  /* ⛔파일을 쓰지 않는다 — «메모리에서» 변이를 만들어 같은 파서에 먹인다. */
  const mutated = CSS.replace(/(\.tb-body\.tone-auto-light[^{]*\{\s*color:\s*)#f2f2f2/, '$1#ff0000');
  assert.notEqual(mutated, CSS, '★변이가 «주입되지 않았다» — 이 양성대조는 아무것도 안 쟀다');
  const c2 = cssTable(mutated);
  assert.ok(c2 && c2.body, '★변이본에서 표를 못 떴다 — 파서가 깨졌다(음성대조 실패)');
  assert.notEqual(g.body, c2.body, `★변이(${c2.body})를 넣었는데도 그리드 값(${g.body})과 같다 — V2 는 이 어긋남을 못 잡는다`);
});
