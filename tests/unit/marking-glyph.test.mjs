/* marking-glyph — 마킹 블럭(옛 카운트 스티커)의 아이콘 표기·라벨·프리셋 «값» (1013t2B5).
 *
 * ★무엇을 잠그나
 *   G0 전제 — 도구 파일이 DOM 없이 실리고 글리프 표·glyphSvg 가 있다
 *   G1 글리프 표 — 6개(chevron-right 포함) · 값은 허용 태그(polyline·line·polygon·circle·path)만 · on* / script / href 0
 *      · 감싸개는 viewBox 0 0 16 16 · 크기·색을 «숫자로» 굽는다 · 모르는 이름은 ''
 *   G2 표기 3값 — applyText: icon 이면 data-text 는 '' 이고 data-count 는 그대로 · 모르는 값은 num · setGroup 이 icon/글리프를 묶음에 쓴다
 *      · custom svg 는 거르개가 실렸을 때만, 거른 것만 쓴다(날것을 dataset 에 안 넣는다)
 *   G3 물려받기 — 다음 찍기는 아이콘·라벨 «꾸밈»(자리·색·크기)을 물려받고 라벨 «글자»는 안 물려받는다
 *   G4 프리셋 — 「번호」「포인트」의 값(글자로) · 섹션 전부에 깔고 라벨 글자·번호·자리는 안 건드린다 · 모르는 이름은 무동작
 *      ★261020 h1 — 라벨 글자가 있는 마킹엔 라벨 꾸밈(색·크기·굵기·자리)도 안 건드린다 · 라벨 없는 마킹만 표의 라벨 칸을 받는다
 *      (새 자: tests/unit/marking-preset-label-keep.test.mjs P1~P4)
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
  /* ★거절(2차 · D8) — custom 인데 쓸 svg 가 없으면 patch 를 «통째로» 안 쓴다: 0 을 돌려주고 표기(style)도 안 바꾼다 */
  const before = A.blocks.map((b) => ({ ...b.dataset }));
  assert.equal(CS.setGroup(A.sec, { style: 'icon', icon: 'custom', iconSvg: '<svg onload="x()"><path d="M0 0"/></svg>' }), 0, '거르개 없음: 0 을 돌려준다');
  assert.deepEqual(A.blocks.map((b) => ({ ...b.dataset })), before, '거르개 없음: 아무것도 안 바뀐다(표기도 num 그대로 · 날것을 dataset 에 안 넣는다)');
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countStyle, b.dataset.countIcon, 'countIconSvg' in b.dataset]), [['num', 'chevron-right', false], ['num', 'chevron-right', false]]);
  /* 거르개가 실리면 «거른 것»을 쓴다 */
  const seen = [];
  ctx._sanitizeSvgString = (s) => { seen.push(s); return '<svg><path d="M0 0"/></svg>'; };
  assert.equal(CS.setGroup(A.sec, { icon: 'custom', iconSvg: '<svg onload="x()"><path d="M0 0"/></svg>' }), 2, '쓴 블럭 수를 돌려준다');
  assert.deepEqual(seen, ['<svg onload="x()"><path d="M0 0"/></svg>'], '거르개를 한 번 부른다(묶음 수만큼이 아니라)');
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countIcon, b.dataset.countIconSvg]),
    [['custom', '<svg><path d="M0 0"/></svg>'], ['custom', '<svg><path d="M0 0"/></svg>']], '거른 문자열이 실린다');
  /* 거른 결과가 비면 아이콘을 안 바꾼다 */
  ctx._sanitizeSvgString = () => '';
  assert.equal(CS.setGroup(A.sec, { icon: 'custom', iconSvg: '<img src=x>' }), 0, '빈 결과: 거절');
  assert.deepEqual(A.blocks.map((b) => b.dataset.countIconSvg), ['<svg><path d="M0 0"/></svg>', '<svg><path d="M0 0"/></svg>'], '빈 결과: 앞의 것 그대로');
  /* 걸러 보니 «그릴 것»이 하나도 없는 svg(빈 껍데기)도 거절 */
  ctx._sanitizeSvgString = () => '<svg viewBox="0 0 8 8"><g><title>x</title></g></svg>';
  assert.equal(CS.setGroup(A.sec, { style: 'icon', icon: 'custom', iconSvg: '<svg><g/></svg>' }), 0, '그릴 것 없음: 거절');
  /* 상한(20,000자)을 넘으면 거르개를 부르지도 않고 거절 */
  let called = 0;
  ctx._sanitizeSvgString = () => { called += 1; return '<svg><path d="M0 0"/></svg>'; };
  assert.equal(CS.setGroup(A.sec, { icon: 'custom', iconSvg: '<svg>' + '<path d="M0 0"/>'.repeat(1500) + '</svg>' }), 0, '상한 초과: 거절');
  assert.equal(called, 0, '상한 초과: 거르개를 안 부른다');
  assert.deepEqual(A.blocks.map((b) => b.dataset.countIconSvg), ['<svg><path d="M0 0"/></svg>', '<svg><path d="M0 0"/></svg>'], '거절 셋 뒤에도 앞의 것 그대로');
  /* 내장 글리프로 돌아가면 custom svg 를 지운다 */
  CS.setGroup(A.sec, { icon: 'plus' });
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countIcon, 'countIconSvg' in b.dataset]), [['plus', false], ['plus', false]]);
});

test('G3 inheritFrom — 아이콘·라벨 꾸밈은 넘기고 라벨 글자는 안 넘긴다', () => {
  const { inheritFrom } = load().CountSticker;
  const last = { dataset: { count: '2', shape: 'square', size: '56', countShape: 'square', countStyle: 'icon', countIcon: 'custom', countIconSvg: '<svg><path d="M0 0"/></svg>',
    bgColor: '#f26b1f', textColor: '#ffffff', countLabel: '메쉬포켓', countLabelPos: 'left', countLabelColor: '#ffffff', countLabelSize: '30', countLabelWeight: '800', countRadius: '25' } };
  const first = { dataset: { count: '1', shape: 'circle', size: '56', countStyle: 'num', countLabel: '첫째', countLabelPos: 'top' } };
  const inh = inheritFrom({ querySelectorAll: () => [first, last] });
  assert.equal(inh.countStyle, 'icon', '표기');
  assert.equal(inh.countIcon, 'custom', '아이콘 이름');
  assert.equal(inh.countIconSvg, '<svg><path d="M0 0"/></svg>', '커스텀 svg');
  assert.deepEqual([inh.countLabelPos, inh.countLabelColor, inh.countLabelSize, inh.countLabelWeight, inh.countRadius], ['left', '#ffffff', '30', '800', '25'], '라벨의 자리·색·크기·굵기 · 모서리');
  assert.equal('countLabel' in inh, false, '라벨 «글자»는 안 넘긴다 — 새로 찍은 것은 라벨이 없다');
  /* 꾸밈 키가 없는 옛 것에서는 그 키들을 지어내지 않는다 */
  const bare = inheritFrom({ querySelectorAll: () => [{ dataset: { count: '1', shape: 'circle', size: '56' } }] });
  for (const k of ['countIcon', 'countIconSvg', 'countLabel', 'countLabelPos', 'countLabelColor', 'countLabelSize', 'countLabelWeight', 'countRadius']) {
    assert.equal(k in bare, false, `옛 것: ${k} 를 지어내지 않는다`);
  }
  /* 모르는 표기 값은 num 으로 물려받는다 */
  assert.equal(inheritFrom({ querySelectorAll: () => [{ dataset: { count: '1', countStyle: 'emoji' } }] }).countStyle, 'num');
});

test('G4 프리셋 — 값은 글자로 · 섹션 전부에 깔고 라벨(글자·꾸밈 — 라벨이 있을 때)·번호·자리는 안 건드린다', () => {
  const ctx = load();
  ctx.renderStickerBlock = () => {};
  const CS = ctx.CountSticker;
  assert.deepEqual(plain(CS.PRESET_NAMES), ['number', 'point'], '프리셋 이름');
  /* 「포인트」 — ★1017t1j2(현빈): 주황(#eb6217)·짙은 꺾쇠(#1a1a1a)를 검정 배경·흰 글자로(2차 D2 의 그림 꼴은 폐기가 아니라 대체 —
     js/count-sticker-tool.js:53~55 의 픽셀 출처 주석과 같이 읽어라). 둥근 네모(모서리 25%) · «흰» 꺾쇠는 그대로다.
   ★261021 ⒝ — 라벨은 ★«굵은»(700 · 오른쪽 · 0.9배)만 남고 ★«흰»은 걷혔다(현빈 「흰색 글자로 바뀌던 부분만 걷어내기」). */
  assert.deepEqual(plain(CS.PRESETS.point), {
    set: { countStyle: 'icon', countIcon: 'chevron-right', countShape: 'square', shape: 'square', countRadius: '25',
      bgColor: '#000000', textColor: '#ffffff', countLabelWeight: '700', countLabelPos: 'right' },
    unset: ['countIconSvg'],
    labelSizeRatio: 0.9,
  }, '「포인트」');
  /* ★1017t1j2 뒤 — textColor(꺾쇠)와 countLabelColor(라벨)가 ★값으로는 같아졌다(둘 다 #ffffff).
     그래도 ★키는 따로다 — 패널의 글자색 칸(#stk-txt-hex)과 라벨색 칸(#stk-clabel-hex)이 따로 쓴다
     (js/props/prop-sticker-count.js). 값이 아니라 «두 키가 각자 산다»를 잠근다(★항등식 아님 — 키 이름이 다르다는 사실 자체를 단언). */
  assert.ok(Object.prototype.hasOwnProperty.call(CS.PRESETS.point.set, 'textColor'), '꺾쇠 색(textColor) 키는 ★그대로 있다');
  /* ★261021 ⒝ (현빈 원문 「포인트 프리셋 흰색 글자로 바뀌던 부분만 걷어내기」) — 라벨 «색»만 걷었다.
     ★증상: 검은 사각 마커 «밖»에 놓인 흰 라벨은 흰 캔버스에서 ★안 보인다(countLabelPos 'right').
     ⛔굵기(countLabelWeight '700')와 0.9배(labelSizeRatio)는 ★안 걷었다 — 원문이 「흰색 글자로 바뀌던 부분«만»」이다.
     ★★그래서 이 줄은 이제 「키가 ★없다」를 잠근다. ★옛 판은 「★있다」를 잠갔고(261017 j2),
       그 단언이 이 고침에 ★빨강으로 울렸다 — ★그 빨강이 곧 «프리셋이 그 값을 쓰고 있었다»는 양성대조다. */
  assert.ok(!Object.prototype.hasOwnProperty.call(CS.PRESETS.point.set, 'countLabelColor'),
    '★라벨 색(countLabelColor)은 ★걷었다 — 프리셋이 라벨을 ★흰색으로 안 만든다');
  assert.ok(Object.prototype.hasOwnProperty.call(CS.PRESETS.point.set, 'countLabelWeight'),
    '⛔굵기는 ★안 걷었다 — 원문이 «흰색 글자…만»이다(★범위를 넓히면 그때 이 줄이 빨개진다)');
  assert.ok(CS.PRESETS.number.unset.includes('countLabelColor'),
    '★「번호」는 ★여전히 라벨 색을 걷는다 — ★이미 흰 라벨이 박힌 마킹을 되돌리는 ★유일한 자리다(⛔지우면 그 빚이 영구화된다)');
  assert.notEqual('textColor', 'countLabelColor', '꺾쇠와 라벨은 «다른 키»에 저장된다(값이 같아져도 독립적으로 쓴다)');
  assert.deepEqual(plain(CS.PRESETS.number), {
    set: { countStyle: 'num', countShape: 'circle', shape: 'circle', bgColor: '#000000', textColor: '#ffffff' },
    unset: ['countIcon', 'countIconSvg', 'countRadius', 'countLabelColor', 'countLabelWeight', 'countLabelSize'],
  }, '「번호」 = 기본 꼴(원 · 검정 · 흰 숫자) — 포인트가 깐 키를 걷는다');

  const A = fakeGroup([
    { count: '1', countStart: '3', countStyle: 'num', shape: 'circle', countShape: 'circle', bgColor: '#000000', textColor: '#ffffff', text: '3', x: '10', y: '20', sizeW: '56', countLabel: '메쉬포켓' },
    { count: '2', countStart: '3', countStyle: 'num', shape: 'circle', countShape: 'none', bgColor: '#123456', textColor: '#ffffff', text: '4', x: '90', y: '20', sizeW: '80', countIconSvg: '<svg/>' },
  ]);
  const B = fakeGroup([{ count: '1', countStyle: 'num', shape: 'circle', bgColor: '#000000', text: '1' }]);
  assert.equal(CS.applyPreset(A.sec, 'point'), 2, '바뀐 수');
  /* ★261020 h1 — 이 기대값은 프리셋이 라벨을 덮던 동작을 잠그고 있었다 · 현빈 «유지해주고 앞에 모양과 표기들만» ⇒ 기대값 바꿈 · 덮지 않는 것이 참.
     옛: 두 블럭 다 countLabelColor/Weight/Pos = '#ffffff'/'700'/'right' · countLabelSize ['50','72'].
     새: 라벨 글자가 있는 첫째(메쉬포켓)는 라벨 꾸밈 키를 안 받는다(undefined 그대로) · 라벨 없는 둘째만 표의 라벨 칸을 받는다(D3 · 80×0.9=72).
     마커 쪽(표기·아이콘·모양·모서리·배경·글자색·data-text·svg 걷기)은 두 블럭 다 그대로 단언한다(«마커는 바뀌었다» 짝). */
  for (const b of A.blocks) {
    const d = b.dataset;
    assert.deepEqual([d.countStyle, d.countIcon, d.countShape, d.shape, d.countRadius, d.bgColor, d.textColor, d.text, 'countIconSvg' in d],
      ['icon', 'chevron-right', 'square', 'square', '25', '#000000', '#ffffff', '', false], '마커는 두 블럭 다 포인트 꼴');
  }
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countLabelColor ?? null, b.dataset.countLabelWeight ?? null, b.dataset.countLabelPos ?? null]),
    [[null, null, null], [null, '700', 'right']], '라벨 꾸밈: 라벨 있는 첫째는 그대로(키 없음) · 라벨 없는 둘째는 ★색 없이 700·오른쪽만(261020 h1 ＋ ★261021 ⒝ 로 흰색 걷힘)');
  assert.deepEqual(A.blocks.map((b) => b.dataset.countLabelSize ?? null), [null, '72'], '라벨 크기: 라벨 있는 첫째는 안 굽는다 · 라벨 없는 둘째만 한 변 × 0.9 (80 → 72)(261020 h1)');
  assert.deepEqual(A.blocks.map((b) => [b.dataset.count, b.dataset.x, b.dataset.sizeW, b.dataset.countLabel ?? null]),
    [['1', '10', '56', '메쉬포켓'], ['2', '90', '80', null]], '번호·자리·크기·라벨 글자는 그대로');
  assert.equal(B.blocks[0].dataset.bgColor, '#000000', '다른 섹션은 그대로');

  assert.equal(CS.applyPreset(A.sec, 'number'), 2);
  assert.deepEqual(A.blocks.map((b) => [b.dataset.countStyle, b.dataset.countShape, b.dataset.bgColor, b.dataset.textColor, b.dataset.text]),
    [['num', 'circle', '#000000', '#ffffff', '3'], ['num', 'circle', '#000000', '#ffffff', '4']], '「번호」: 기본 꼴 · 번호 글자가 산다(시작 번호 3)');
  for (const k of ['countIcon', 'countRadius', 'countLabelColor', 'countLabelWeight', 'countLabelSize']) {
    assert.deepEqual(A.blocks.map((b) => k in b.dataset), [false, false], `「번호」: ${k} 를 걷는다`);
  }
  assert.equal(CS.applyPreset(A.sec, 'toString'), 0, '모르는 이름(객체 내장 이름 포함)은 무동작');
  assert.equal(CS.applyPreset(A.sec, '없는프리셋'), 0);
});

test('G5 프리셋 단추 title — 색말이 프리셋 값과 어긋나지 않는다 (1017t1j2 — 2차 D2 이후 한 번 썩었던 둘째 명부를 잠근다)', () => {
  const CS = load().CountSticker;
  const PANEL = readSrc(REPO, 'js/props/prop-sticker-count.js');
  const titleOf = (name) => {
    const m = PANEL.match(new RegExp(`data-count-preset="${name}"[^>]*title="([^"]*)"`));
    assert.ok(m, `${name} 단추의 title 을 못 찾았다(prop-sticker-count.js)`);
    return m[1];
  };
  assert.equal(CS.PRESETS.point.set.bgColor, '#000000', '★전제: 「포인트」 bgColor = 검정(1017t1j2)');
  const pointTitle = titleOf('point');
  const numberTitle = titleOf('number');
  assert.ok(!pointTitle.includes('주황'), `title 이 ★지운 값(주황 #eb6217)을 아직 말한다 — 둘째 명부가 썩었다: "${pointTitle}"`);
  assert.ok(pointTitle.includes('검정'), `title 이 지금 값(bgColor 검정)을 말하지 않는다: "${pointTitle}"`);
  assert.ok(numberTitle.includes('검정'), `「번호」title 도 bgColor(검정)를 말해야 한다: "${numberTitle}"`);
});
