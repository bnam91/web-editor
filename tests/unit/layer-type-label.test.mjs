/* U-LAYERLBL — 레이어 패널 «타입 라벨» 계약.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스만 읽는다(라이브 무접촉).
 *
 * ★[M55] 현빈 2026-09-05: 「여기에 컴퍼넌트라고 영어로 되어있는데 그리드라고 되어야되지 않겠니?」
 *   (data-layer-type="grid" 인 행의 .layer-item-type 이 'Component' 였다)
 *
 * ★이 검사가 «같이» 지키는 것 둘:
 *   ⑴ 라벨을 «판정»에 쓰지 않는다 — 두 자리(layer-panel.js:614·:749)가 이 값을 읽는데,
 *      aria-label 문구 조립에만 쓴다. 누가 `ty === 'Component'` 같은 분기를 넣으면
 *      라벨을 고치는 순간 «기능»이 깨진다. 그때 이 검사가 먼저 운다.
 *   ⑵ 두 맵의 «키가 같다» — labels(이름)와 typeLbls(타입)가 갈라지면 한쪽에만 있는 타입이
 *      조용히 기본값('Text')으로 떨어진다. 실제로 grid 는 개명(duo→grid) 때 두 맵에
 *      «함께» 들어왔다 — 한쪽만 들어왔으면 못 봤을 것이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');
const stripC = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

const ITEMS = stripC(read('js/panels/layer-panel-items.js'));
const PANEL = stripC(read('js/panels/layer-panel.js'));

const mapOf = name => {
  const m = ITEMS.match(new RegExp(`const\\s+${name}\\s*=\\s*\\{([\\s\\S]*?)\\};`));
  assert.ok(m, `${name} 맵을 못 찾음 — 리팩터링됐나?`);
  return Object.fromEntries(
    [...m[1].matchAll(/'?([A-Za-z0-9-]+)'?\s*:\s*'([^']*)'/g)].map(x => [x[1], x[2]]));
};
const labels  = mapOf('labels');
const typeLbls = mapOf('typeLbls');

test('★M55 — 그리드의 타입 라벨은 «Grid» 다(Component 는 10종이 공유해 뭘 가리키는지 모른다)', () => {
  assert.equal(typeLbls.grid, 'Grid',
    `그리드 타입 라벨이 '${typeLbls.grid}' 다 — 이름을 바꾼 뒤엔 이 칸만이 «그리드였음»을 알려준다`);
});

test('★두 맵의 키가 «같다» — 한쪽에만 있으면 조용히 기본값으로 떨어진다', () => {
  const a = Object.keys(labels).sort(), b = Object.keys(typeLbls).sort();
  assert.deepEqual(b, a,
    `labels 와 typeLbls 의 키가 갈라졌다 — 없는 쪽은 'Text' 로 떨어져 «틀린 라벨»이 조용히 뜬다`);
});

test('⛔라벨을 «판정»에 쓰지 마라 — 라벨을 고치는 순간 기능이 깨진다', () => {
  const bad = PANEL.split('\n')
    .map((l, i) => [i + 1, l])
    .filter(([, l]) => /layer-item-type/.test(l) === false
                    && /\bty\b\s*(===|==|!==|!=)\s*['"]/.test(l))
    .map(([n, l]) => `${n}: ${l.trim()}`);
  assert.deepEqual(bad, [],
    '타입 라벨 문자열로 분기하는 코드가 생겼다 — 라벨은 «표시»지 «판정»이 아니다');
});

test('★남은 뭉뚱그림을 «세어 둔다» — 줄어들면 이 숫자를 같이 내려라(요약이 본문보다 늦는 것 방지)', () => {
  const generic = Object.entries(typeLbls).filter(([, v]) => v === 'Component').map(([k]) => k);
  assert.ok(!generic.includes('grid'), 'grid 가 아직 Component 다');
  assert.equal(generic.length, 9,
    `'Component' 를 공유하는 타입이 ${generic.length}종이다(${generic.join(', ')}) — ` +
    '의도적으로 바꿨다면 이 숫자를 갱신하고, 아니라면 누가 라벨을 뭉갠 것이다');
});
