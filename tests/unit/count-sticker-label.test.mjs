/* count-sticker-label — 카운트 스티커(1012t1Z4)의 «번호 → 글자»와 메뉴·스크립트 배선.
 *
 * ★무엇을 잠그나
 *   L1 숫자 표기 · L2 알파벳 표기(전단사 26진: 26=Z 다음이 AA 다 — 흔한 0-기반 26진은 여기서 「BA」나 「A@」를 낸다)
 *   L3 배선 — index.html 에 도구 스크립트가 정확히 한 번 실리고, 메뉴 단추가 스티커 패널(#fp-pen-menu) 안에 있다
 *   L5 이름(1013t2B1) — 메뉴 글자는 Marking · title 은 「마킹 블럭 — 」으로 시작 · 옛 「Count Sticker」 0건 (키·함수명은 count 그대로 — L3·L4 가 문다)
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
