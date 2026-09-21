/* keys-esc-arrow.dom.spec.js — T-102 «키가 반만 듣는다 둘».
 *
 * ★무엇을 못박나
 *   ① Esc 로 뜬 메뉴가 닫힌다 — 그 닫기를 하는 진짜 함수 closeFpMenus 의 «실물 소스»를 떠내 잰다.
 *      함께: «바깥을 눌러 닫기» 규칙(자기 영역 클릭은 안 닫음)이 그대로인지 · 뜬 게 없으면 0 을
 *      돌려주는지(0 이어야 Esc 가 선택 풀기로 «흘러간다» = T-058 회귀 방지).
 *   ② 화살표키가 미는 대상 고르기 — 블럭 «종류 명부»가 아니라 성질(free-layout 직속 자식 + absolute).
 *
 * ★사본을 두지 않는다: js/editor.js 에서 소스를 떠내 평가한다. 고침을 되돌리면 여기가 빨강이 난다.
 * ⛔앱을 안 띄운다 — 빈 페이지에 소스만 얹는다(고디터 인스턴스·포트 무접촉).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'editor.js'), 'utf8');

/** 중괄호 균형으로 `function <name>(…){…}` 을 실물 소스 그대로 떠낸다. */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name + ' (editor.js)');
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

/** `const FP_FLOATING_MENUS = [ … ];` 를 대괄호 균형으로 떠낸다. */
function extractRegistry(src) {
  const k = src.indexOf('const FP_FLOATING_MENUS');
  if (k < 0) throw new Error('FP_FLOATING_MENUS 를 못 찾았다 (editor.js)');
  let i = src.indexOf('[', k), b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '[') b++;
    else if (src[i] === ']') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(k, i) + ';';
}

const BUNDLE = [
  extractRegistry(SRC),
  extractFn(SRC, '_fpVisible'),
  extractFn(SRC, 'closeFpMenus'),
  extractFn(SRC, '_deepestCanvasSelection'),
  extractFn(SRC, '_freePositionedAncestor'),
  extractFn(SRC, '_freeNudgeTargets'),
  'window.__closeFpMenus = closeFpMenus;',
  'window.__freeNudgeTargets = _freeNudgeTargets;',
  'window.__deepestCanvasSelection = _deepestCanvasSelection;',
].join('\n');

const MENU_DOM = `
  <div id="fp-component-dropdown" class="fp-dropdown open"><button id="trig">c</button><div id="inmenu">x</div></div>
  <div id="fp-plugin-panel" style="display:block"></div><button id="fp-plugin-btn" class="active"></button>
  <div id="branch-dropdown-wrap" class="open"></div>
  <div class="col-add-menu" style="display:block"></div>
  <div id="canvas"></div>`;

test('T-102-① Esc 가 부르는 closeFpMenus() 는 뜬 메뉴를 «전부» 닫는다', async ({ page }) => {
  await page.setContent(MENU_DOM);
  await page.addScriptTag({ content: BUNDLE });
  const r = await page.evaluate(() => {
    const closed = window.__closeFpMenus();
    return {
      closed,
      dd: document.querySelectorAll('.fp-dropdown.open').length,
      plugin: document.getElementById('fp-plugin-panel').style.display,
      pluginBtn: document.getElementById('fp-plugin-btn').classList.contains('active'),
      branch: document.getElementById('branch-dropdown-wrap').classList.contains('open'),
      colAdd: document.querySelector('.col-add-menu').style.display,
    };
  });
  console.log('  닫힌 메뉴 수 =', r.closed);
  expect(r.closed, '★뜬 메뉴가 하나도 안 닫혔다 = Esc 가 메뉴를 못 닫는다').toBe(4);
  expect(r.dd).toBe(0);
  expect(r.plugin).toBe('none');
  expect(r.pluginBtn).toBe(false);
  expect(r.branch).toBe(false);
  expect(r.colAdd).toBe('none');
});

test('T-102-① 뜬 게 없으면 0 → Esc 는 선택 풀기/상위로 올라가기(T-058)로 흘러간다', async ({ page }) => {
  await page.setContent('<div id="canvas"></div>');
  await page.addScriptTag({ content: BUNDLE });
  expect(await page.evaluate(() => window.__closeFpMenus())).toBe(0);
});

test('T-102-① «바깥클릭» 규칙 보존 — 자기 영역을 누르면 그 메뉴는 안 닫는다', async ({ page }) => {
  await page.setContent(MENU_DOM);
  await page.addScriptTag({ content: BUNDLE });
  const r = await page.evaluate(() => {
    const closed = window.__closeFpMenus(document.getElementById('inmenu'));
    return { closed, ddOpen: document.querySelectorAll('.fp-dropdown.open').length };
  });
  expect(r.ddOpen, '★메뉴 안을 눌렀는데 메뉴가 닫혔다').toBe(1);
  expect(r.closed).toBe(3);
});

const FREE_DOM = `<div id="canvas">
  <div class="section-block selected"><div class="section-inner">
    <div class="frame-block selected" data-free-layout style="position:relative">
      <div id="shape" class="shape-block selected" style="position:absolute;left:0;top:0"></div>
    </div>
  </div></div>
</div>`;

test('T-102-① \u2605\uc778\ub77c\uc778 style \uc5c6\uc774 CSS \ub85c\ub9cc \uc228\uc740 \uba54\ub274\ub97c \u00ab\uc5f4\ub9bc\u00bb\uc73c\ub85c \uc77d\uc9c0 \uc54a\ub294\ub2e4', async ({ page }) => {
  /* \uc774\uac78 \ub193\uce58\uba74 closeFpMenus() \uac00 \ud56d\uc0c1 >0 \uc744 \ub3cc\ub824 Esc \uac00 \ub298 \uba54\ub274 \ub2eb\uae30\ub85c \uc18c\uc9c4\ub41c\ub2e4
     = \uc120\ud0dd \ud480\uae30\uac00 \uc8fd\ub294\ub2e4(\u00ab\uc6b0\uc5f0\ud788 \uc548\uc804\u00bb \ub367\uc5d0 \uc9d3\uc9c0 \uc54a\uae30). */
  await page.setContent(`<style>.col-add-menu{display:none}</style>
    <div class="col-add-menu"></div><div class="col-add-menu"></div><div id="canvas"></div>`);
  await page.addScriptTag({ content: BUNDLE });
  expect(await page.evaluate(() => window.__closeFpMenus())).toBe(0);
});

test('T-102-② \ubbf8\ub294 \ub300\uc0c1\uc740 «성질»로 고른다 — free 프레임 직속 + absolute 하나뿐', async ({ page }) => {
  await page.setContent(FREE_DOM);
  await page.addScriptTag({ content: BUNDLE });
  const r = await page.evaluate(() => ({
    ids: window.__freeNudgeTargets().map(e => e.id || e.className),
    deepest: window.__deepestCanvasSelection().id,
  }));
  expect(r.deepest, '★가장 깊은 .selected 가 실제로 고른 것이어야 한다').toBe('shape');
  expect(r.ids, '★조상 프레임/섹션까지 밀면 블럭이 두 번 움직인다').toEqual(['shape']);
});

test('T-102-② 흐름(stack) 블럭은 밀 곳이 없다 → 대상 0 (캔버스만 안 밀리면 된다)', async ({ page }) => {
  await page.setContent(`<div id="canvas"><div class="section-block selected"><div class="section-inner">
      <div id="tb" class="text-block selected" style="position:static"></div></div></div></div>`);
  await page.addScriptTag({ content: BUNDLE });
  const r = await page.evaluate(() => ({
    targets: window.__freeNudgeTargets().length,
    deepest: window.__deepestCanvasSelection().id,
  }));
  expect(r.deepest).toBe('tb');
  expect(r.targets).toBe(0);
});

test('T-102-② 중첩 free 프레임 — 조상과 자식이 둘 다 잡히면 조상을 버린다', async ({ page }) => {
  await page.setContent(`<div id="canvas"><div class="frame-block" data-free-layout>
      <div id="outer" class="frame-block selected" data-free-layout style="position:absolute;left:5px;top:5px">
        <div id="inner" class="shape-block selected" style="position:absolute;left:1px;top:1px"></div>
      </div></div></div>`);
  await page.addScriptTag({ content: BUNDLE });
  const ids = await page.evaluate(() => window.__freeNudgeTargets().map(e => e.id));
  expect(ids).toEqual(['inner']);
});
