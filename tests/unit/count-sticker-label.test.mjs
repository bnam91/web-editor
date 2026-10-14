/* count-sticker-label — 카운트 스티커(1012t1Z4)의 «번호 → 글자»와 메뉴·스크립트 배선.
 *
 * ★무엇을 잠그나
 *   L1 숫자 표기 · L2 알파벳 표기(전단사 26진: 26=Z 다음이 AA 다 — 흔한 0-기반 26진은 여기서 「BA」나 「A@」를 낸다)
 *   L3 배선 — index.html 에 도구 스크립트가 정확히 한 번 실리고, 메뉴 단추가 스티커 패널(#fp-pen-menu) 안에 있다
 *   L5 이름(1013t2B1) — 메뉴 글자는 Marking · title 은 「마킹 블럭 — 」으로 시작 · 옛 「Count Sticker」 0건 (키·함수명은 count 그대로 — L3·L4 가 문다)
 *   L6 기본색(1013t2B4) — 마킹이 없는 섹션의 첫 찍기는 검정 배경·흰 글자 · 앞선 것이 있으면 그 색을 물려받는다
 *   L7 섹션 일괄(1013t2B3) — copyToGroup 이 키를 베끼고 · 없는 키는 지우고 · 자기 자신과 다른 섹션은 안 건드린다
 *   L4 서로 끄기 — 찍는 도구 넷(Count · Annotation · HighlightB · 벡터 펜)의 enter 가 서로를 끈다(행동은 DOM C16·C17 이 잰다)
 * ★기대값은 «글자로» 박았다(피검 함수에서 뽑으면 항등식이다).
 * ⛔앱 0 · 네트워크 0. js/count-sticker-tool.js 는 최상위에서 DOM 을 안 건드리므로 vm 으로 그대로 싣는다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { sliceBlock } = require('./_slice-block.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const TOOL = 'js/count-sticker-tool.js';

function load() {
  const ctx = {}; ctx.window = ctx; vm.createContext(ctx);
  vm.runInContext(readSrc(REPO, TOOL), ctx);
  return ctx;
}

test('L0 전제 — 도구 파일이 DOM 없이 실리고 CountSticker.label 이 함수다', () => {
  const ctx = load();
  assert.equal(typeof ctx.CountSticker?.label, 'function');
  assert.equal(typeof ctx.toggleCountStickerMode, 'function');
  assert.equal(typeof ctx.enterCountStickerMode, 'function');
  assert.equal(typeof ctx.exitCountStickerMode, 'function');
});

test('L1 숫자 표기 — 번호가 그대로 글자가 된다', () => {
  const { label } = load().CountSticker;
  assert.equal(label(1, 'num'), '1');
  assert.equal(label(12, 'num'), '12');
  assert.equal(label(999, 'num'), '999');
  assert.equal(label(3), '3', '표기를 안 주면 숫자다');
});

test('L2 알파벳 표기 — 1=A … 26=Z, 27=AA (전단사 26진)', () => {
  const { label } = load().CountSticker;
  const WANT = { 1: 'A', 2: 'B', 3: 'C', 26: 'Z', 27: 'AA', 28: 'AB', 52: 'AZ', 53: 'BA', 702: 'ZZ', 703: 'AAA' };
  for (const [n, want] of Object.entries(WANT)) {
    assert.equal(label(Number(n), 'alpha'), want, `${n} 번`);
  }
});

test('L3 배선 — 스크립트 태그 정확히 1개 · 메뉴 단추가 스티커 패널 메뉴 안에 있다', () => {
  const html = readSrc(REPO, 'index.html');
  const tags = html.match(/<script\s+src="js\/count-sticker-tool\.js"\s*><\/script>/g) || [];
  assert.equal(tags.length, 1, 'index.html 의 count-sticker-tool.js 스크립트 태그 수');
  const at = html.indexOf('id="fp-pen-menu"');
  assert.ok(at > 0, '★전제: #fp-pen-menu 가 있다');
  // 그 메뉴의 «다음 드롭다운 메뉴»가 시작하기 전까지를 메뉴 구간으로 본다
  const next = html.indexOf('class="fp-dropdown-menu"', at + 1);
  const menu = html.slice(at, next > at ? next : at + 6000);
  assert.ok(menu.length > 200, '★전제: 메뉴 구간을 실제로 떼었다');
  const calls = menu.match(/toggleCountStickerMode\(/g) || [];
  assert.equal(calls.length, 1, '#fp-pen-menu 안의 toggleCountStickerMode( 호출 수');
  assert.equal((html.match(/toggleCountStickerMode\(/g) || []).length, 1, 'index.html 전체의 호출 수(메뉴 밖에 없다)');
});

test('L4 서로 끄기 — 다른 찍는 도구 셋의 enter 가 Count 를 끄고, Count 의 enter 가 그 셋을 끈다', () => {
  const body = (file, fn) => {
    const src = readSrc(REPO, file);
    assert.ok(src.includes(`function ${fn}()`), `★전제: ${file} 에 ${fn} 가 있다`);
    return sliceBlock(src, `function ${fn}()`);
  };
  const OTHERS = [['js/annotation-tool.js', 'enterPenMode'], ['js/highlight-line-tool.js', 'enterHighlightBMode'], ['js/pen-tool.js', 'enterVectorPenMode']];
  for (const [file, fn] of OTHERS) {
    const n = (body(file, fn).match(/window\.exitCountStickerMode\?\.\(\)/g) || []).length;
    assert.equal(n, 1, `${file} ${fn} 안의 exitCountStickerMode 호출 수`);
  }
  const mine = body(TOOL, 'enterCountStickerMode');
  for (const name of ['exitPenMode', 'exitHighlightBMode', 'exitVectorPenMode']) {
    assert.equal((mine.match(new RegExp(`window\\.${name}\\?\\.\\(\\)`, 'g')) || []).length, 1, `enterCountStickerMode 안의 ${name} 호출 수`);
  }
});

test('L5 이름 — 메뉴 글자는 Marking · title 은 「마킹 블럭 — 」으로 시작 · 옛 「Count Sticker」 0건', () => {
  const html = readSrc(REPO, 'index.html');
  const at = html.indexOf('id="fp-pen-menu"');
  assert.ok(at > 0, '★전제: #fp-pen-menu 가 있다');
  const next = html.indexOf('class="fp-dropdown-menu"', at + 1);
  const menu = html.slice(at, next > at ? next : at + 6000).replace(/<!--[\s\S]*?-->/g, '');
  const items = [...menu.matchAll(/<button class="fp-menu-item" onclick="([^"]*)" title="([^"]*)">([^<]*)<\/button>/g)]
    .map((m) => ({ on: m[1], title: m[2], label: m[3] }));
  const mine = items.filter((x) => x.on.includes('toggleCountStickerMode('));
  assert.equal(mine.length, 1, '★전제: toggleCountStickerMode( 를 부르는 메뉴 단추가 정확히 하나다');
  assert.equal(mine[0].label, 'Marking', '메뉴 글자');
  assert.ok(mine[0].title.startsWith('마킹 블럭 — '), `title 이 「마킹 블럭 — 」으로 시작해야 한다: ${mine[0].title}`);
  assert.equal(items.filter((x) => x.label === 'Marking').length, 1, '「Marking」 항목은 하나뿐이다');
  assert.equal((html.match(/Count Sticker/g) || []).length, 0, 'index.html 에 옛 이름 「Count Sticker」가 남아 있다');
  assert.equal((html.match(/카운트 스티커/g) || []).length, 0, 'index.html 에 옛 이름 「카운트 스티커」가 남아 있다');
});

/* 섹션 흉내 — 도구는 sec.querySelectorAll('.sticker-block[data-count]') 만 부른다. */
const fakeSec = (blocks) => ({ querySelectorAll: () => blocks });

test('L6 기본색 — 마킹이 없는 섹션의 inheritFrom 은 #000000 / #ffffff · 앞선 것이 있으면 그 색', () => {
  const { inheritFrom } = load().CountSticker;
  const empty = inheritFrom(fakeSec([]));
  assert.equal(empty.bgColor, '#000000', '빈 섹션: 배경색');
  assert.equal(empty.textColor, '#ffffff', '빈 섹션: 글자색');
  assert.equal(empty.countStyle, 'num', '★전제: 기본 표기는 그대로다');
  assert.equal(empty.sizeW, 56, '★전제: 기본 크기는 그대로다');

  const old = { dataset: { count: '3', shape: 'circle', size: '56', bgColor: '#e74c3c', textColor: '#fffbe6' } };
  const first = { dataset: { count: '1', shape: 'circle', size: '56', bgColor: '#123456', textColor: '#654321' } };
  const inh = inheritFrom(fakeSec([first, old]));
  assert.equal(inh.bgColor, '#e74c3c', '앞선 것(순번이 가장 큰 것)의 배경색을 물려받는다');
  assert.equal(inh.textColor, '#fffbe6', '앞선 것의 글자색을 물려받는다');

  /* 색 키가 «없는» 옛 것 — 물려줄 색이 없다 ⇒ 색을 안 넘긴다(만드는 쪽의 스티커 기본 = 옛 그림과 같은 빨강) */
  const bare = inheritFrom(fakeSec([{ dataset: { count: '1', shape: 'circle', size: '56' } }]));
  assert.equal('bgColor' in bare, false, '색 키 없는 옛 것: 배경색을 지어내지 않는다');
  assert.equal('textColor' in bare, false, '색 키 없는 옛 것: 글자색을 지어내지 않는다');
});

/* 블럭 흉내 — 도구가 읽는 것만: dataset · closest('.section-block') · classList.contains. */
function fakeGroup(datasets) {
  const sec = { querySelectorAll: () => blocks };
  const blocks = datasets.map((d) => ({ dataset: { ...d }, closest: () => sec, classList: { contains: () => false } }));
  return { sec, blocks };
}

test('L7 copyToGroup — 키를 베끼고, block 에 없는 키는 지우고, 자기 자신·다른 섹션은 안 건드린다', () => {
  const ctx = load();
  const drawn = [];
  ctx.renderStickerBlock = (b) => drawn.push(b);
  const { copyToGroup } = ctx.CountSticker;
  assert.equal(typeof copyToGroup, 'function', '★전제: copyToGroup 이 실렸다');
  const A = fakeGroup([
    { count: '1', bgColor: '#111111', fontStyle: 'italic', x: '10' },
    { count: '2', bgColor: '#222222', fontStyle: 'italic', x: '20' },
    { count: '3', bgColor: '#f26b1f', x: '30' },                       // 고른 것 — fontStyle 키가 없다
  ]);
  const B = fakeGroup([{ count: '1', bgColor: '#999999', fontStyle: 'italic', x: '40' }]);
  const src = A.blocks[2];
  const n = copyToGroup(src, ['bgColor', 'fontStyle']);
  assert.equal(n, 2, '바뀐 수 = 같은 섹션의 «다른» 마킹 수');
  assert.deepEqual(A.blocks.map((b) => b.dataset.bgColor), ['#f26b1f', '#f26b1f', '#f26b1f'], '배경색이 셋 다 같아졌다');
  assert.deepEqual(A.blocks.map((b) => 'fontStyle' in b.dataset), [false, false, false], 'block 에 없는 키는 받는 쪽에서도 지운다');
  assert.deepEqual(A.blocks.map((b) => [b.dataset.count, b.dataset.x]), [['1', '10'], ['2', '20'], ['3', '30']], '번호·자리는 안 건드린다(keys 에 없는 것)');
  assert.deepEqual({ ...B.blocks[0].dataset }, { count: '1', bgColor: '#999999', fontStyle: 'italic', x: '40' }, '다른 섹션은 그대로');
  assert.deepEqual(drawn, [A.blocks[0], A.blocks[1]], '다시 그린 것 = 바뀐 둘(자기 자신은 부르는 쪽이 이미 그렸다)');
  /* 마킹이 아닌 블럭·빈 keys 는 아무것도 안 한다 */
  assert.equal(copyToGroup({ dataset: { bgColor: '#000' }, closest: () => A.sec }, ['bgColor']), 0, 'data-count 가 없는 블럭은 안 베낀다');
  assert.equal(copyToGroup(src, []), 0, '빈 keys');
});
