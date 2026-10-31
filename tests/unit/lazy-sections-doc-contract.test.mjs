/* lazy-sections-doc-contract — ★256 LAZY-SECTIONS-DOC-CONTRADICTS-SERIALIZE-01 · 머리말 «계약»을 재는 자
 * ★왜: 머리말이 <img> 언로드·data-lazy-src 를 약속했는데 코드엔 없었다(참값 = 인라인 배경만 언로드).
 * ★자: 주석을 벗긴 코드에서 센다 — 전체에서 세면 머리말 문장이 걸린다.
 * ⚠️자 한계: Object.assign·['src'] 같은 우회 쓰기는 안 센다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const FILE = path.join(import.meta.dirname, '..', '..', 'js', 'io', 'lazy-sections.js');
const SRC_WRITES = [/\.src\s*=(?!=)/g, /setAttribute\(\s*['"`]src['"`]/g, /data-lazy-src/g];
const BG_CLEAR = /\.style\.backgroundImage\s*=\s*'none'/g;
const count = (s, re) => (s.match(re) || []).length;
const srcTouches = (s) => SRC_WRITES.reduce((n, re) => n + count(stripComments(s), re), 0);

test('L0 자가 산다 — 미끼 양성·음성(0건을 믿기 전에)', () => {
  assert.equal(srcTouches("img.src = 'x';"), 1, '양성: .src 쓰기를 못 잡는다');
  assert.equal(srcTouches("img.setAttribute('src', x);"), 1, '양성: setAttribute 를 못 잡는다');
  assert.equal(srcTouches("el.getAttribute('data-lazy-src');"), 1, '양성: data-lazy-src 를 못 잡는다');
  assert.equal(srcTouches("/* img.src = 'x' · data-lazy-src */\n// setAttribute('src', x)"), 0, '음성: 주석 안 글자를 센다');
  assert.equal(srcTouches("if (img.src === x) y();"), 0, '음성: 비교를 쓰기로 센다');
});

test('L1 양성 — 코드가 인라인 배경을 비운다', () => {
  assert.ok(count(stripComments(fs.readFileSync(FILE, 'utf8')), BG_CLEAR) > 0, "style.backgroundImage = 'none' 이 없다 — 언로드가 사라졌나");
});

test('L2 음성 — <img> src 를 건드리는 코드가 0 이다(직렬화 사고 자리)', () => {
  const s = fs.readFileSync(FILE, 'utf8'), code = stripComments(s);
  console.log('    [256] 전체/코드 — ' + SRC_WRITES.map((re) => `${re.source} ${count(s, re)}/${count(code, re)}`).join(' · '));
  assert.equal(srcTouches(s), 0, '<img> src 를 건드렸다 — clone 이 그 속성을 그대로 직렬화한다(머리말 계약)');
});
