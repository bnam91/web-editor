/* svg-import-size — t3-06 P1 벡터로 넣기의 처음 크기(js/util/svg-import-size.js)
 *   실행: node tests/run-unit.mjs tests/unit/svg-import-size.test.mjs */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

/* js/util 은 Node 에서 CommonJS 로 읽힌다(루트 type:commonjs · js/fx 만 module) ⇒ sanitize-svg.test.mjs 와 같은 꼴로 글자째 읽어 돌린다 */
const { readSrc } = createRequire(import.meta.url)('./_srcread.js');
const src = readSrc(path.join(path.dirname(fileURLToPath(import.meta.url)), '../../'), 'js/util/svg-import-size.js');
const { svgImportSize, SVG_IMPORT_MAX } = new Function(src.replace(/\bexport\s+/g, '') + '\n;return { svgImportSize, SVG_IMPORT_MAX };')();

test('Z1 크기 진리표', () => {
  const T = [
    ['<svg width="64" height="32"><path d="M0 0"/></svg>', { w: 64, h: 32 }, 'width·height'],
    ['<svg width="64px" height="32px">', { w: 64, h: 32 }, 'px'],
    ['<svg viewBox="0 0 24 12">', { w: 24, h: 12 }, 'viewBox 만'],
    ['<svg width="100%" height="100%" viewBox="0 0 30 60">', { w: 30, h: 60 }, '% 는 viewBox 로'],
    ['<svg width="48" viewBox="0 0 24 12">', { w: 48, h: 24 }, '한쪽만 + viewBox 비율'],
    ["<svg width='2000' height='1000'>", { w: SVG_IMPORT_MAX, h: 200 }, '큰 것 = 긴 변 400 · 비율 그대로'],
    ['<svg width="4000" height="20">', { w: 400, h: 10 }, '짧은 변 하한 10'],
    ['<svg>', { w: 120, h: 120 }, '아무것도 없음 = 120'],
    ['', { w: 120, h: 120 }, '빈 글자'],
  ];
  for (const [s, want, name] of T) assert.deepEqual(svgImportSize(s), want, name);
});
