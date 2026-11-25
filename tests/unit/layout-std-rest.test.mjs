/* layout-std-rest — 남은 패널의 Layout 절이 표준 부품(_layout-section.js)을 쓰나(시트 223행 DS-LAYOUT-STD-REST-01 · 탑 워커 layout 261125)
 * 소스만 잰다(DOM 은 tests/dom 몫) — 부품 호출이 옛 숫자 칸 id 그대로 · 옛 슬라이더 id 0. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (f) => fs.readFileSync(path.join(ROOT, 'js', 'props', f), 'utf8');

test('S1 섹션 패딩 — 좌우 = 패딩 슬롯(sec-padx-number) · 아래 = 슬롯 숫자(sec-padb-number) · 슬라이더 0', () => {
  const s = read('prop-section.js');
  assert.match(s, /from '\.\/_layout-section\.js'/);
  assert.match(s, /layoutPadSlotHTML\(\{ xId: 'sec-padx-number'/);
  assert.match(s, /layoutSlotNumberHTML\(\{ id: 'sec-padb-number'/);
  assert.match(s, /wireLayoutSection\(/);
  assert.ok(!/sec-pad[xb]-slider/.test(s), '옛 슬라이더 id 가 남았다');
});

/* ── 부품 덧붙임(탑 261125 · 주인 = 워커 layout) — layoutSizeRowHTML 에 ① 읽기전용 칸 ② 제 끝 단추 · 옛 호출 바이트 그대로
 *    근거 FigCraft layout_panel.rs dimensions(:161~) — W/H 한 줄 + 끝 칸 단추 */
import vm from 'node:vm';
const partSrc = fs.readFileSync(path.join(ROOT, 'js', 'props', '_layout-section.js'), 'utf8')
  .replace(/^import .*$/m, 'const wireNumberScrub = () => {};').replace(/^export (const|function) /gm, '$1 ');
const L = vm.runInNewContext(`${partSrc}\n({ layoutSizeRowHTML })`, {});
const OLD_CALLS = [
  { prefix: 'mdl', chain: { on: false, blocked: null }, w: { id: 'mdl-w-number', value: 300, min: 100, max: 800 }, h: { id: 'mdl-h-number', value: 0, max: 900, auto: true }, mode: { w: { id: 'mdl-wm', value: 'fixed', options: [['full', 'Fill', 'Fill container'], ['fixed', 'Fixed', 'Fixed']] } } },
  { prefix: 'a', chain: { on: true }, w: { id: 'a-w', value: 10, max: 99 }, h: { id: 'a-h', value: 20, max: 99, mixed: true } },
  { prefix: 'o', one: { id: 'o-n', label: 'Size', value: 5, max: 50, icon: 'h' } },
];

test('L1 옛 호출 — 산출 바이트 그대로(덧붙임 전 골든 tests/fixtures/layout-size-row-golden.json)', () => {
  const gold = JSON.parse(fs.readFileSync(path.join(ROOT, 'tests', 'fixtures', 'layout-size-row-golden.json'), 'utf8'));
  assert.deepEqual(OLD_CALLS.map((c) => L.layoutSizeRowHTML(c)), gold);
});

test('L2 읽기전용 칸(w.readonly) — readonly · aria-readonly · 끌기 손잡이 없음 · 값은 보인다', () => {
  const h = L.layoutSizeRowHTML({ prefix: 's', w: { id: 'sec-width-value', value: 860, max: 860, readonly: true }, h: { id: 'sec-height-value', value: 400, min: 1, max: 20000 } });
  assert.match(h, /<input type="number" class="prop-number" id="sec-width-value"[^>]* value="860"[^>]* readonly tabindex="-1" aria-readonly="true"/);
  assert.ok(!h.includes('sec-width-value-scrub'), '읽기전용인데 끌기 손잡이가 있다');
  assert.ok(h.includes('id="sec-height-value-scrub"'), '옆 칸은 그대로 끌기');
});

test('L3 제 끝 단추(end) — 블럭 단추 id 그대로 · data-part end-slot · 비율 사슬 대신', () => {
  const h = L.layoutSizeRowHTML({ prefix: 's', w: { id: 'w', value: 1, max: 9 }, h: { id: 'h', value: 1, max: 9 }, end: { id: 'sec-pin-btn', on: false, title: '높이 고정', icon: '📌' } });
  assert.match(h, /<button type="button" class="prop-chain-btn" id="sec-pin-btn" data-part="end-slot" aria-pressed="false" aria-label="높이 고정" title="높이 고정">📌<\/button>/);
  assert.ok(!h.includes('id="s-ratio"'), '끝 단추가 있으면 사슬은 없다');
});
