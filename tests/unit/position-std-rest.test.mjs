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
  assert.match(src('prop-text-wireup-position'), /wirePosition(Section|Part)\(\{ prefix: 'txt', numberId: 'txt-rot-number'/);
});

/* ── 부품 칸 더하기(탑 261125 · 이번 물결 _position-section 주인 = pos) ──
 *   ① flowAlign 을 floatPositionRowHTML 로 넘긴다(에셋 = 흐름 정렬이 제 3칸) ② liveXY Mixed 칸(빈 값 + placeholder Mixed + data-empty=invalid · _appearance-section _appCell 꼴 · FigCraft number_field_mixed)
 *   옛 호출(인자 안 줌) = 바이트 그대로. 부품은 vm 에 import 를 벗겨 올리고 이웃 둘은 받은 인자를 그대로 내는 스텁. */
import vm from 'node:vm';
function loadPart() {
  const body = fs.readFileSync(new URL('../../js/props/_position-section.js', import.meta.url), 'utf8')
    .replace(/^import[^\n]*\n/gm, '').replace(/^export\s*\{[^}]*\};?[^\n]*$/gm, '').replace(/^export\s+/gm, '');
  const ctx = { overlayToggleBtnHTML: () => '', rotRowHTML: () => '', POS_FLOW_WHY: '', floatPositionRowHTML: (o) => `FPR${JSON.stringify(o)}` };
  vm.createContext(ctx); vm.runInContext(body + ';globalThis.__P = { positionSectionHTML };', ctx);
  return ctx.__P;
}
const OLD_LIVE = (x, y) => `
      <div class="prop-lhls-row">
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">X</span>
            <input type="number" class="prop-number" id="a-x" value="${x}" aria-label="X position">
          </div>
        </div>
        <div class="prop-lhls-col">
          <div class="prop-icon-input">
            <span class="prop-xy-label">Y</span>
            <input type="number" class="prop-number" id="a-y" value="${y}" aria-label="Y position">
          </div>
        </div>
      </div>`;
test('PP1 flowAlign — 안 주면 옛 호출 그대로({prefix,posEl}) · false 면 floatPositionRowHTML 로 넘긴다', () => {
  const { positionSectionHTML: P } = loadPart(), el = { id: 'e' };
  assert.equal(P({ prefix: 'a', posEl: el }), 'FPR{"prefix":"a","posEl":{"id":"e"}}', '옛 호출 바이트가 바뀌었다');
  assert.equal(P({ prefix: 'a', posEl: el, flowAlign: false }), 'FPR{"prefix":"a","posEl":{"id":"e"},"flowAlign":false}');
});
test('PP2 liveXY Mixed — 안 주면 옛 마크업 바이트 그대로 · 주면 그 칸만 빈 값 + Mixed + data-empty=invalid', () => {
  const { positionSectionHTML: P } = loadPart();
  assert.equal(P({ prefix: 'a', posEl: null, xy: false, liveXY: { xId: 'a-x', yId: 'a-y', x: 3, y: 4 } }), OLD_LIVE(3, 4), '옛 liveXY 바이트가 바뀌었다');
  const h = P({ prefix: 'a', posEl: null, xy: false, liveXY: { xId: 'a-x', yId: 'a-y', x: 3, y: 4, xMixed: true } });
  assert.match(h, /id="a-x" value="" placeholder="Mixed" data-empty="invalid" aria-label="X position"/);
  assert.match(h, /id="a-y" value="4" aria-label="Y position"/);
});
test('PP3 asset·multisel 몸 = 부품(asset flowAlign:false · multisel liveXY Mixed)', () => {
  assert.match(src('prop-asset'), /positionSectionHTML\(\{ prefix: 'asset', posEl: floatPosEl, flowAlign: false \}\)/);
  assert.match(src('prop-multisel'), /positionSectionHTML\(\{ prefix: 'msp'[^\n]*liveXY: \{ xId: 'msp-x', yId: 'msp-y'/);
});
