/* marking-preset-label-keep — 마킹 프리셋(번호 ↔ 포인트)이 ★라벨 글자의 크기·색·굵기·자리를 바꾸지 않는다 (261020 h1).
 *
 * 현빈 원문: 「번호 프리셋 글자추가해둔거에서 포인트 프리셋으로 변경하면 글자추가해둔게 크기와 색이 바뀌는 문제가 있어.
 *            유지해주고 앞에 모양과 표기들만 바껴야지?」
 * ★원인(행위로 잰 것 · 지디 가설 «폴백»을 뒤집음): 프리셋 표의 «라벨 칸»(point.set countLabel* · labelSizeRatio ·
 *   number.unset countLabel*)을 적용 함수가 그대로 썼다/지웠다 → 손댄 라벨도 덮였다.
 * ★무엇을 잠그나 — 모든 검사에 «마커는 바뀌었다» + «라벨은 같다»를 ★한 쌍으로 건다(라벨이 원래 안 바뀌는 판에서의 항등식 방지).
 *   P1 ⑴ 손 안 댄 라벨(꾸밈 키 0) — number→point · point→number 둘 다 키를 안 만들고 안 지운다
 *   P2 ⑵ 손 댄 라벨(색·크기·굵기·자리) — number→point · point→number 둘 다 값 그대로(덮지도 지우지도 않는다)
 *   P3 D2 굳힘 — 폴백으로 보이던 라벨 색이 프리셋의 배경색을 따라 바뀌려 하면 ★전환 순간 보이던 값을 적는다 ·
 *      바뀌지 않으면 키를 안 만든다 · 라벨이 없으면 안 굳힌다
 *   P4 D3 짝 — 라벨 글자가 «없는» 마커에는 포인트가 흰·굵게·0.9배·오른쪽을 깐다(1013t2B5) · 번호가 그것을 걷는다 ·
 *      같은 섹션의 라벨 있는 마커는 그대로
 * ★기대값은 «글자로» 박았다(표에서 읽어 오지 않는다). ⛔앱 0 · 네트워크 0 — js/count-sticker-tool.js 를 vm 으로 싣는다(marking-glyph 와 같은 꼴).
 * ⌘Z(히스토리 한 칸에 마커·라벨이 함께 돌아온다)는 앱이 필요해 DOM 쪽(tests/dom/marking-icon-label.dom.spec.js M9d)이 잰다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const TOOL = 'js/count-sticker-tool.js';

function load() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, TOOL), ctx);
  ctx.renderStickerBlock = () => {};
  return ctx;
}
function fakeGroup(datasets) {
  const sec = { querySelectorAll: () => blocks };
  const blocks = datasets.map((d) => ({ dataset: { ...d }, closest: () => sec, classList: { contains: () => false } }));
  return { sec, blocks };
}
const LABEL_KEYS = ['countLabelColor', 'countLabelSize', 'countLabelWeight', 'countLabelPos'];
const labelOf = (d) => [d.countLabel ?? null, ...LABEL_KEYS.map((k) => (k in d ? d[k] : null))];
const NUMBER_MARK = { count: '1', countStart: '1', countStyle: 'num', shape: 'circle', countShape: 'circle', bgColor: '#000000', textColor: '#ffffff', sizeW: '56', size: '56', text: '1' };

test('P1 ⑴ 손 안 댄 라벨 — number→point→number 에서 마커는 바뀌고 라벨 꾸밈 키는 0개 그대로', () => {
  const CS = load().CountSticker;
  const G = fakeGroup([{ ...NUMBER_MARK, countLabel: '메쉬포켓' }]);
  const d = G.blocks[0].dataset;
  assert.deepEqual(labelOf(d), ['메쉬포켓', null, null, null, null], '★전제: 라벨 글자만 있고 꾸밈 키 0');

  assert.equal(CS.applyPreset(G.sec, 'point'), 1);
  assert.deepEqual([d.countStyle, d.countShape, d.shape, d.countIcon, d.countRadius, d.text], ['icon', 'square', 'square', 'chevron-right', '25', ''], 'point: 마커는 바뀌었다');
  assert.deepEqual(labelOf(d), ['메쉬포켓', null, null, null, null], 'point: 라벨은 같다(흰·700·50·right 를 안 깐다)');

  assert.equal(CS.applyPreset(G.sec, 'number'), 1);
  assert.deepEqual([d.countStyle, d.countShape, d.shape, 'countIcon' in d, 'countRadius' in d, d.text], ['num', 'circle', 'circle', false, false, '1'], 'number: 마커는 바뀌었다');
  assert.deepEqual(labelOf(d), ['메쉬포켓', null, null, null, null], 'number: 라벨은 같다');
});

test('P2 ⑵ 손 댄 라벨 — number→point 에 덮이지 않고 point→number 에 지워지지 않는다', () => {
  const CS = load().CountSticker;
  const G = fakeGroup([{ ...NUMBER_MARK, countLabel: '메쉬포켓', countLabelColor: '#ff0000', countLabelSize: '30', countLabelWeight: '400', countLabelPos: 'left' }]);
  const d = G.blocks[0].dataset;
  const HAND = ['메쉬포켓', '#ff0000', '30', '400', 'left'];
  assert.deepEqual(labelOf(d), HAND, '★전제: 손 값');

  CS.applyPreset(G.sec, 'point');
  assert.deepEqual([d.countStyle, d.countShape, d.countRadius, d.text], ['icon', 'square', '25', ''], 'point: 마커는 바뀌었다');
  assert.deepEqual(labelOf(d), HAND, 'point: 손 값 그대로(b5148b48 은 #ffffff·50·700·right 로 덮었다)');

  CS.applyPreset(G.sec, 'number');
  assert.deepEqual([d.countStyle, d.countShape, 'countRadius' in d, 'countIcon' in d, d.text], ['num', 'circle', false, false, '1'], 'number: 마커는 바뀌었다');
  assert.deepEqual(labelOf(d), HAND, 'number: 손 값 그대로(b5148b48 은 색·크기·굵기 키를 지웠다)');

  /* 반대 방향 출발 — 포인트 꼴에서 손 값을 넣고 number 로 */
  const H = fakeGroup([{ count: '1', countStyle: 'icon', countIcon: 'chevron-right', shape: 'square', countShape: 'square', countRadius: '25', bgColor: '#000000', textColor: '#ffffff', sizeW: '56', text: '',
    countLabel: '둘째', countLabelColor: '#00ff00', countLabelSize: '22', countLabelWeight: '300', countLabelPos: 'top' }]);
  const e = H.blocks[0].dataset;
  CS.applyPreset(H.sec, 'number');
  assert.deepEqual([e.countStyle, e.countShape, 'countRadius' in e, e.text], ['num', 'circle', false, '1'], 'point 꼴→number: 마커는 바뀌었다');
  assert.deepEqual(labelOf(e), ['둘째', '#00ff00', '22', '300', 'top'], 'point 꼴→number: 손 값 그대로');
});

test('P3 D2 굳힘 — 폴백 라벨 색이 바뀌려 하면 전환 순간 보이던 값(전 배경색)을 적는다 · 안 바뀌면/라벨 없으면 안 만든다', () => {
  const ctx = load();
  /* 그리기 폴백(js/blocks/sticker-block.js _countLabelLook)의 «계약 대역» — 색 = countLabelColor || bgColor · 크기 = countLabelSize || fontSize(26) ·
     굵기 = countLabelWeight || fontWeight(700). 진짜 폴백과의 일치는 행위 탐침(work-1020t2h1 ⑶ 갈래)이 잰다. */
  ctx._stickerCountLabelLook = (b) => ({ color: b.dataset.countLabelColor || b.dataset.bgColor || '#ff3b30',
    size: parseInt(b.dataset.countLabelSize, 10) || parseInt(b.dataset.fontSize, 10) || 26,
    weight: parseInt(b.dataset.countLabelWeight, 10) || parseInt(b.dataset.fontWeight, 10) || 700, pos: b.dataset.countLabelPos || 'right' });
  const CS = ctx.CountSticker;
  const G = fakeGroup([
    { ...NUMBER_MARK, bgColor: '#ff0000', countLabel: '빨강 배경' },   // X — 폴백 색이 #ff0000 → #000000 으로 바뀌려 한다 ⇒ 굳힘
    { ...NUMBER_MARK, bgColor: '#000000', countLabel: '검정 배경' },   // Z — 폴백 색 #000000 그대로 ⇒ 키를 안 만든다
  ]);
  const [x, z] = G.blocks.map((b) => b.dataset);
  CS.applyPreset(G.sec, 'point');
  assert.deepEqual([x.bgColor, x.countShape, z.countShape], ['#000000', 'square', 'square'], 'point: 마커는 바뀌었다(X 배경 빨강→검정)');
  assert.deepEqual(labelOf(x), ['빨강 배경', '#ff0000', null, null, null], 'X: 보이던 색(#ff0000)이 라벨 색 키로 굳었다 · 크기·굵기·자리는 안 바뀌어 안 만든다');
  assert.deepEqual(labelOf(z), ['검정 배경', null, null, null, null], 'Z: 보이던 색이 안 바뀌어 키를 안 만든다');

  /* 라벨 없는 마커(Y)는 굳히지 않는다 — number 는 라벨 없는 것에 라벨 키를 «지우기»만 하므로 굳힘이 키를 지어내면 여기서 보인다 */
  const H = fakeGroup([{ ...NUMBER_MARK, countStyle: 'icon', countShape: 'square', shape: 'square', bgColor: '#ff0000' }]);
  const y = H.blocks[0].dataset;
  CS.applyPreset(H.sec, 'number');
  assert.deepEqual([y.bgColor, y.countShape], ['#000000', 'circle'], 'Y number: 마커는 바뀌었다');
  assert.deepEqual(labelOf(y), [null, null, null, null, null], 'Y: 라벨이 없으면 굳히지 않는다');
});

test('P4 D3 짝 — 라벨 없는 마커에만 포인트의 라벨 꼴(흰·700·한 변×0.9·오른쪽)을 깔고 번호가 걷는다 · 라벨 있는 이웃은 그대로', () => {
  const CS = load().CountSticker;
  const G = fakeGroup([
    { ...NUMBER_MARK },                                           // 라벨 없음
    { ...NUMBER_MARK, count: '2', sizeW: '80', countLabel: '' },  // 라벨 '' = 없음(정의: sticker-block.js _countLabelHTML has)
    { ...NUMBER_MARK, count: '3', countLabel: ' ' },              // 공백만 = 있음
  ]);
  const [a, b, c] = G.blocks.map((x) => x.dataset);
  assert.equal(CS.applyPreset(G.sec, 'point'), 3);
  assert.deepEqual([a.countShape, b.countShape, c.countShape], ['square', 'square', 'square'], 'point: 마커는 셋 다 바뀌었다');
  assert.deepEqual(labelOf(a), [null, '#ffffff', '50', '700', 'right'], '라벨 없음: 포인트 라벨 꼴이 깔린다(56×0.9=50)');
  assert.deepEqual(labelOf(b), ['', '#ffffff', '72', '700', 'right'], "라벨 '': 없음으로 친다(80×0.9=72)");
  assert.deepEqual(labelOf(c), [' ', null, null, null, null], '공백 라벨: 있음 — 안 건드린다');

  CS.applyPreset(G.sec, 'number');
  assert.deepEqual([a.countShape, a.text, c.countShape], ['circle', '1', 'circle'], 'number: 마커는 바뀌었다');
  assert.deepEqual(labelOf(a), [null, null, null, null, 'right'], '라벨 없음: 번호가 색·크기·굵기를 걷는다(자리는 표에 unset 이 없어 남는다 — 옛 동작 그대로)');
  assert.deepEqual(labelOf(c), [' ', null, null, null, null], '공백 라벨: 그대로');
});
