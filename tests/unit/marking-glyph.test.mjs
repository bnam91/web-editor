/* marking-glyph — 마킹 블럭(옛 카운트 스티커)의 아이콘 표기·라벨·프리셋 «값» (1013t2B5).
 *
 * ★무엇을 잠그나
 *   G0 전제 — 도구 파일이 DOM 없이 실리고 글리프 표·glyphSvg 가 있다
 *   G1 글리프 표 — 6개(chevron-right 포함) · 값은 허용 태그(polyline·line·polygon·circle·path)만 · on* / script / href 0
 *      · 감싸개는 viewBox 0 0 16 16 · 크기·색을 «숫자로» 굽는다 · 모르는 이름은 ''
 *   G2 표기 3값 — applyText: icon 이면 data-text 는 '' 이고 data-count 는 그대로 · 모르는 값은 num · setGroup 이 icon/글리프를 묶음에 쓴다
 *      · custom svg 는 거르개가 실렸을 때만, 거른 것만 쓴다(날것을 dataset 에 안 넣는다)
 *   G3 물려받기 — 다음 찍기는 아이콘·라벨 «꾸밈»(자리·색·크기)을 물려받고 라벨 «글자»는 안 물려받는다
 * ★기대값은 «글자로» 박았다. ⛔앱 0 · 네트워크 0 — js/count-sticker-tool.js 를 vm 으로 그대로 싣는다(count-sticker-label 과 같은 꼴).
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
  return ctx;
}
/* 섹션·블럭 흉내 — 도구가 읽는 것만(dataset · closest · classList.contains). */
function fakeGroup(datasets) {
  const sec = { querySelectorAll: () => blocks };
  const blocks = datasets.map((d) => ({ dataset: { ...d }, closest: () => sec, classList: { contains: () => false } }));
  return { sec, blocks };
}
const plain = (o) => JSON.parse(JSON.stringify(o));   // vm 영역의 객체를 이쪽 영역 것으로(프로토타입 비교를 피한다)

const GLYPH_WANT = ['chevron-right', 'check', 'arrow-right', 'plus', 'star', 'dot'];

test('G0 전제 — 도구가 DOM 없이 실리고 글리프 표·glyphSvg·styleOf 가 있다', () => {
  const CS = load().CountSticker;
  assert.equal(typeof CS?.glyphSvg, 'function');
  assert.equal(typeof CS?.styleOf, 'function');
  assert.equal(typeof CS?.iconNameOf, 'function');
  assert.equal(typeof CS?.GLYPHS, 'object');
});

test('G1 글리프 표 — 6개 · 허용 태그만 · on*/script/href 0 · 감싸개는 16 격자에 크기·색을 숫자로 굽는다', () => {
  const CS = load().CountSticker;
  assert.deepEqual(plain(CS.GLYPH_NAMES), GLYPH_WANT, '글리프 이름(순서까지)');
  assert.equal(CS.GLYPH_DEFAULT, 'chevron-right', '기본 글리프');
  const OK = new Set(['polyline', 'line', 'polygon', 'circle', 'path']);
  for (const name of GLYPH_WANT) {
    const inner = CS.GLYPHS[name];
    assert.equal(typeof inner, 'string', `${name}: 표에 있다`);
    const tags = [...inner.matchAll(/<\s*\/?\s*([A-Za-z][A-Za-z0-9]*)/g)].map((m) => m[1]);
    assert.ok(tags.length >= 1, `★전제(${name}): 태그를 실제로 뽑았다`);
    for (const t of tags) assert.ok(OK.has(t), `${name}: 허용 밖 태그 <${t}>`);
    assert.doesNotMatch(inner, /\son[a-z]+\s*=|href|script|javascript:|url\(/i, `${name}: 위험한 꼴`);
    const nums = (inner.match(/-?\d+(?:\.\d+)?/g) || []).map(Number);
    assert.ok(nums.length >= 2 && nums.every((n) => n >= 0 && n <= 16), `${name}: 좌표가 16 격자 안이다(${nums.join(',')})`);
  }
  assert.equal(CS.glyphSvg('chevron-right', { size: 26, color: '#ffffff' }),
    '<svg viewBox="0 0 16 16" width="26" height="26" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"'
    + ' style="color:#ffffff;display:block;flex:none;pointer-events:none;"><polyline points="6 3.5 10.5 8 6 12.5"/></svg>');
  assert.equal(CS.glyphSvg('없는이름', { size: 26 }), '', '모르는 이름은 빈 문자열');
  assert.equal(CS.glyphSvg('constructor'), '', '객체 내장 이름도 글리프가 아니다');
  const poisoned = CS.glyphSvg('dot', { size: 10, color: 'red;"><script>' });
  assert.ok(poisoned.includes('style="color:redscript;display:block;'), `색 값의 따옴표·꺾쇠·세미콜론은 걷는다: ${poisoned}`);
  assert.doesNotMatch(poisoned, /<script/, '색 값으로 태그를 못 연다');
});

test('G2 표기 3값 — icon 이면 data-text 는 빈 값이고 순번은 그대로 · 모르는 값은 num · setGroup 이 아이콘을 묶음에 쓴다', () => {
  const ctx = load();
  ctx.renderStickerBlock = () => {};
  const CS = ctx.CountSticker;
  assert.deepEqual(['num', 'alpha', 'icon', 'ICON', '', undefined, 'emoji'].map((v) => CS.styleOf(v)), ['num', 'alpha', 'icon', 'num', 'num', 'num', 'num']);
  assert.deepEqual(['check', 'custom', '없는것', undefined, 'toString'].map((v) => CS.iconNameOf(v)), ['check', 'custom', 'chevron-right', 'chevron-right', 'chevron-right']);

  const A = fakeGroup([{ count: '1', countStart: '5', countStyle: 'num', text: '5' }, { count: '2', countStart: '5', countStyle: 'num', text: '6' }]);
  const B = fakeGroup([{ count: '1', countStyle: 'num', text: '1' }]);
  assert.equal(CS.setGroup(A.sec, { style: 'icon' }), 2, '바뀐 수');
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countStyle, b.dataset.countIcon, b.dataset.text, b.dataset.count]),
    [['icon', 'chevron-right', '', '1'], ['icon', 'chevron-right', '', '2']], 'icon: 글자는 비고 순번은 그대로 · 아이콘은 기본 글리프');
  assert.equal(B.blocks[0].dataset.text, '1', '다른 섹션은 그대로');

  CS.setGroup(A.sec, { icon: 'star' });
  assert.deepEqual(A.blocks.map((b) => b.dataset.countIcon), ['star', 'star'], '글리프 바꾸기도 묶음');
  CS.setGroup(A.sec, { icon: '없는글리프' });
  assert.deepEqual(A.blocks.map((b) => b.dataset.countIcon), ['chevron-right', 'chevron-right'], '모르는 글리프 이름은 기본');

  /* 번호로 돌아오면 번호가 산다(시작 번호 5) */
  CS.setGroup(A.sec, { style: 'alpha' });
  assert.deepEqual(A.blocks.map((b) => b.dataset.text), ['E', 'F']);
  CS.setGroup(A.sec, { style: 'emoji' });
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countStyle, b.dataset.text]), [['num', '5'], ['num', '6']], '모르는 표기 값은 num');

  /* custom svg — 거르개가 안 실렸으면 안 쓴다 */
  CS.setGroup(A.sec, { style: 'icon', icon: 'custom', iconSvg: '<svg onload="x()"><path d="M0 0"/></svg>' });
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countIcon, 'countIconSvg' in b.dataset]), [['chevron-right', false], ['chevron-right', false]], '거르개 없음: 날것을 dataset 에 넣지 않는다');
  /* 거르개가 실리면 «거른 것»을 쓴다 */
  const seen = [];
  ctx._sanitizeSvgString = (s) => { seen.push(s); return '<svg><path d="M0 0"/></svg>'; };
  CS.setGroup(A.sec, { icon: 'custom', iconSvg: '<svg onload="x()"><path d="M0 0"/></svg>' });
  assert.deepEqual(seen, ['<svg onload="x()"><path d="M0 0"/></svg>'], '거르개를 한 번 부른다(묶음 수만큼이 아니라)');
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countIcon, b.dataset.countIconSvg]),
    [['custom', '<svg><path d="M0 0"/></svg>'], ['custom', '<svg><path d="M0 0"/></svg>']], '거른 문자열이 실린다');
  /* 거른 결과가 비면 아이콘을 안 바꾼다 */
  ctx._sanitizeSvgString = () => '';
  CS.setGroup(A.sec, { icon: 'custom', iconSvg: '<img src=x>' });
  assert.deepEqual(A.blocks.map((b) => b.dataset.countIconSvg), ['<svg><path d="M0 0"/></svg>', '<svg><path d="M0 0"/></svg>'], '빈 결과: 앞의 것 그대로');
  /* 내장 글리프로 돌아가면 custom svg 를 지운다 */
  CS.setGroup(A.sec, { icon: 'plus' });
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countIcon, 'countIconSvg' in b.dataset]), [['plus', false], ['plus', false]]);
});

test('G3 inheritFrom — 아이콘·라벨 꾸밈은 넘기고 라벨 글자는 안 넘긴다', () => {
  const { inheritFrom } = load().CountSticker;
  const last = { dataset: { count: '2', shape: 'square', size: '56', countShape: 'square', countStyle: 'icon', countIcon: 'custom', countIconSvg: '<svg><path d="M0 0"/></svg>',
    bgColor: '#f26b1f', textColor: '#ffffff', countLabel: '메쉬포켓', countLabelPos: 'left', countLabelColor: '#ffffff', countLabelSize: '30' } };
  const first = { dataset: { count: '1', shape: 'circle', size: '56', countStyle: 'num', countLabel: '첫째', countLabelPos: 'top' } };
  const inh = inheritFrom({ querySelectorAll: () => [first, last] });
  assert.equal(inh.countStyle, 'icon', '표기');
  assert.equal(inh.countIcon, 'custom', '아이콘 이름');
  assert.equal(inh.countIconSvg, '<svg><path d="M0 0"/></svg>', '커스텀 svg');
  assert.deepEqual([inh.countLabelPos, inh.countLabelColor, inh.countLabelSize], ['left', '#ffffff', '30'], '라벨의 자리·색·크기');
  assert.equal('countLabel' in inh, false, '라벨 «글자»는 안 넘긴다 — 새로 찍은 것은 라벨이 없다');
  /* 꾸밈 키가 없는 옛 것에서는 그 키들을 지어내지 않는다 */
  const bare = inheritFrom({ querySelectorAll: () => [{ dataset: { count: '1', shape: 'circle', size: '56' } }] });
  for (const k of ['countIcon', 'countIconSvg', 'countLabel', 'countLabelPos', 'countLabelColor', 'countLabelSize']) {
    assert.equal(k in bare, false, `옛 것: ${k} 를 지어내지 않는다`);
  }
  /* 모르는 표기 값은 num 으로 물려받는다 */
  assert.equal(inheritFrom({ querySelectorAll: () => [{ dataset: { count: '1', countStyle: 'emoji' } }] }).countStyle, 'num');
});
