/* figma-text-ranges-332 — 받는 쪽이 범위를 플러그인 명령으로 옮긴다(실제 Figma 는 안 탄다 — 명령 꼴까지). 플러그인에 그 명령이 있고 렌더러가 부른다 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { applyTextRanges } from '../../figma-renderer/text-ranges.mjs';

const deps = (calls) => ({ run: (c, p) => { calls.push([c, p]); }, loadFontSafe: (family, style) => ({ family, style }), hex: () => ({ r: 1, g: 0, b: 0, a: 1 }) });

test('굵게·색 범위가 그 자리 명령이 된다', () => {
  const calls = [];
  applyTextRanges('n1', [{ start: 6, end: 9, bold: true }, { start: 0, end: 3, color: '#ff0000' }], 'Pretendard', deps(calls));
  assert.deepEqual(calls, [
    ['set_range_font_name', { nodeId: 'n1', start: 6, end: 9, family: 'Pretendard', style: 'Bold' }],
    ['set_range_fills', { nodeId: 'n1', start: 0, end: 3, fills: [{ type: 'SOLID', color: { r: 1, g: 0, b: 0 } }] }],
  ]);
});

test('음성 — 범위가 없으면 명령 0', () => {
  const calls = [];
  applyTextRanges('n1', undefined, 'Pretendard', deps(calls));
  assert.deepEqual(calls, []);
});

test('배선 — GENERIC 글자 뒤에 부르고 · 플러그인이 그 두 명령을 받는다', () => {
  const R = readFileSync(new URL('../../figma-renderer/sangpe_to_figma.mjs', import.meta.url), 'utf8');
  assert.match(R, /applyTextRanges\(tn\.id, t\.ranges,/);
  const P = readFileSync(new URL('../../figma-plugin/code.js', import.meta.url), 'utf8');
  for (const c of ['set_range_font_name', 'set_range_fills']) assert.ok(P.includes(`case "${c}"`), c);
});
