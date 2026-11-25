/* position-std-rest — 표준 Position 절 남은 패널 8(시트 222행 DS-POSITION-STD-REST-01 · 탑 워커 pos 261125)
 *   머리 엔드슬롯 = 부품 positionHeadToolsHTML · 몸(자리·회전이 블럭 자리인 패널) = 부품 positionSectionHTML.
 *   annotation(라벨 dx/dy)·chat(프로필 Y)·multisel(Mixed X/Y)·asset(흐름 정렬 = 제 3칸)은 부품 몸 칸이 없어 머리만 — 몸은 옛 그대로(탑 보고).
 *   소스 문자열 단언이다 — 리팩터로 빨강이면 «표준 부품을 여전히 부르는가»를 보고 패턴을 고쳐라. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const { stripComments } = require('./_strip-comments.js');
const src = (f) => stripComments(fs.readFileSync(new URL(`../../js/props/${f}.js`, import.meta.url), 'utf8'));

const HEAD = { 'prop-annotation': 'annot', 'prop-asset': 'asset', 'prop-cert': 'crt', 'prop-chat': 'chb', 'prop-joker': 'joker', 'prop-label-group': 'lg', 'prop-multisel': 'msp', 'prop-text-template': 'txt' };
const BODY = { 'prop-cert': 'crt', 'prop-joker': 'joker', 'prop-label-group': 'lg', 'prop-text-template': 'txt' };

for (const [f, p] of Object.entries(HEAD)) {
  test(`PR-H ${f} — Position 머리 = positionHeadToolsHTML({ prefix: '${p}' })`, () => {
    const s = src(f);
    assert.match(s, /sec\('position'/, '[전제] Position 절이 있다');
    assert.match(s, /from '\.\/_position-section\.js'/, '부품 import 없음');
    assert.match(s, new RegExp(`positionHeadToolsHTML\\(\\{ prefix: '${p}'`), '머리가 부품이 아니다');
  });
}
for (const [f, p] of Object.entries(BODY)) {
  test(`PR-B ${f} — Position 몸 = positionSectionHTML({ prefix: '${p}' })`, () => {
    assert.match(src(f), new RegExp(`positionSectionHTML\\(\\{ prefix: '${p}'`), '몸이 부품이 아니다');
  });
}
test('PR-W 텍스트 회전 슬라이드 = wirePositionSection(txt-rot-number)', () => {
  assert.match(src('prop-text-wireup-position'), /wirePositionSection\(\{ prefix: 'txt', numberId: 'txt-rot-number'/);
});
