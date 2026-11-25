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
