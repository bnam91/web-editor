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
