/* U-TYPOSTD-REST — 남은 7 패널의 Typography 절이 정본(_typo-section.js buildTypographySectionHtml)에서 나오는가.
 *   시트 221행 DS-TYPOGRAPHY-STD-REST-01 · 탑 워커 typo 261125.
 *   ⑴ 정본을 import 하고 부른다 ⑵ 옛 손 마크업(크기 슬라이더 등)이 코드에 없다.
 *   ⛔옛 «숫자칸 id»는 여기서 안 잰다 — 패널마다 남기는지가 갈려 있다(커밋 몸 참조).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { stripComments } = _req('./_strip-comments.js');
const { readSrc } = _req('./_srcread.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* 패널 → 옛 Typography 손 마크업의 표식(걷혀야 할 id) */
const PANELS = {
  annotation: ['id="annot-font-size"'],
  graph:      ['id="grb-label-slider"', 'id="grb-pct-size-slider"'],
  infocard:   ['id="ifc-num-slider"'],
  radial:     ["_pairRow('rdl-labelsize'"],
  step:       ['id="stb-title-size-slider"', 'id="stb-desc-size-slider"'],
  sticker:    ['id="stk-fs"', 'id="stk-t-fs"', 'id="stk-t-ff"'],
  zoom:       ["_pairRow('zm-txs'"],
};

for (const [name, oldMarks] of Object.entries(PANELS)) {
  test(`TS-${name} prop-${name}.js 의 Typography 절 = 정본 buildTypographySectionHtml`, () => {
    const code = stripComments(readSrc(ROOT, `js/props/prop-${name}.js`));
    assert.match(code, /import\s*\{[^}]*\bbuildTypographySectionHtml\b[^}]*\}\s*from\s*'\.\/_typo-section\.js'/, '정본 import 가 없다');
    assert.match(code, /buildTypographySectionHtml\(\{/, '정본을 부르지 않는다');
    for (const m of oldMarks) assert.ok(!code.includes(m), `옛 손 마크업 ${m} 이 남아 있다`);
  });
}

/* 탑 게이트 W2(수지맥 @8db65fdc3) 빨강 갈래 중 «코드 탓» 재현 —
 *   ⑴ 카운트 스티커 크기 → 폰트 비례 동기가 옛 칸(stk-fs·stk-fs-num)을 적는다 ⇒ 정본 크기칸이 안 따라온다(count-sticker C14)
 *   ⑵ 옛 숫자칸은 change 에서도 값을 먹였다(apply + 이력). 바꾼 크기칸이 change 에 이력만 찍으면 change 하나로 들어온 값이 버려진다(graph-bar-settings-vpair B7-2) */
const src = (name) => stripComments(readSrc(ROOT, `js/props/${name}`));
test('TS-W2a prop-sticker-count.js 크기→폰트 동기가 정본 크기칸(stk-typo-size-number)을 적는다', () => {
  const code = src('prop-sticker-count.js');
  assert.ok(!/\$\('stk-fs(-num)?'\)/.test(code), '옛 칸 stk-fs/stk-fs-num 을 아직 적는다');
  assert.match(code, /stk-typo-size-number/);
});
const CHANGE_APPLIES = {
  'prop-graph.js 숫자 크기':   [/psNumber\.addEventListener\('change',\s*\(\)\s*=>\s*\{\s*applyPctSize\(/],
  'prop-graph.js 라벨 크기':   [/lNumber\?\.addEventListener\('change',\s*\(\)\s*=>\s*\{\s*applyLabelSize\(/],
  'prop-step.js 크기 둘':      [/number\.addEventListener\('change',\s*\(\)\s*=>\s*\{\s*apply\(\)/],
  'prop-sticker.js 숫자칸':    [/n\.addEventListener\('change',\s*\(\)\s*=>\s*\{\s*apply\(\)/],
};
for (const [what, pats] of Object.entries(CHANGE_APPLIES)) {
  test(`TS-W2b ${what} — change 도 값을 먹인다(옛 숫자칸 꼴)`, () => {
    const code = src(what.split(' ')[0]);
    for (const p of pats) assert.match(code, p);
  });
}
