/* keys-esc-arrow.dom.spec.js — T-102 «키가 반만 듣는다 둘».
 *
 * ★무엇을 못박나
 *   ① Esc 로 뜬 메뉴가 닫힌다 — 그 닫기를 하는 진짜 함수 closeFpMenus 의 «실물 소스»를 떠내 잰다.
 *      함께: «바깥을 눌러 닫기» 규칙(자기 영역 클릭은 안 닫음)이 그대로인지 · 뜬 게 없으면 0 을
 *      돌려주는지(0 이어야 Esc 가 선택 풀기로 «흘러간다» = T-058 회귀 방지).
 *   ② 화살표키가 미는 대상 고르기 — 블럭 «종류 명부»가 아니라 성질(free-layout 직속 자식 + absolute).
 *   ③ 화살표키 분기의 «행동» — 연타가 되돌리기 한 칸으로 묶이는지 · 캔버스 스크롤을 언제
 *      막고 언제 안 막는지. 분기 몸통을 실물 소스에서 떠내 직접 때려서 잰다.
 *      ⚠️①② 는 «함수»를 재고 배선은 tests/unit/keys-esc-arrow-wiring.test.mjs 가 잰다.
 *      그 둘 사이에 «연타 병합»을 재는 칸이 비어 있었다 — 병합을 떼도 전부 초록이었다.
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

/** 화살표키 분기의 «블록 몸통»을 떠낸다 — 바깥 중괄호가 닫히는 자리(깊이 −1)까지. */
function extractArrowBlock(src) {
  const k = src.indexOf('const _ARROW = {');
  if (k < 0) throw new Error('화살표키 분기를 못 찾았다 (editor.js)');
  let d = 0, i = k;
  for (; i < src.length; i++) {
    if (src[i] === '{') d++;
    else if (src[i] === '}') { d--; if (d < 0) break; }
  }
  if (i >= src.length) throw new Error('화살표키 분기의 끝을 못 찾았다 (editor.js)');
  return src.slice(k, i);
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

/* 화살표키 분기 몸통을 «함수 하나»로 감싸 직접 때린다.
   pushHistory 는 세는 가짜로 세운다 — 여기서 재는 건 «몇 칸 쌓이나»지 히스토리 내부가 아니다. */
const ARROW = [
  'window.__pushLog = [];',
  'function pushHistory(a) { window.__pushLog.push(a); }',
  'window.__arrowKey = function (e) {',
  extractArrowBlock(SRC),
  '};',
].join('\n');

/** 진짜 keydown 과 같은 모양의 가짜 이벤트(preventDefault 횟수를 센다). */
const FAKE_EVT = `(k, shift) => ({
  key: k, shiftKey: !!shift, metaKey: false, ctrlKey: false, altKey: false,
  isComposing: false, target: document.body,
  preventDefault() { window.__pd = (window.__pd || 0) + 1; },
})`;

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

/* ═══════════════════════════════════════════════════════════════════════════
   ③ 화살표키 분기의 «행동» — 몸통을 떠내 직접 때린다.
   ★왜 여기 칸이 필요한가: ①② 는 «대상을 제대로 고르나»만 재고, 배선 검사는 소스에
     pushHistory( 라는 «글자»가 있는지만 본다. 그 사이에 «연타가 몇 칸 쌓이나»를 재는
     칸이 없었다 — 연타 병합을 통째로 떼도 검사는 전부 초록이었다(음성대조로 확인).
   ★이 앱의 규약: 연타는 한 칸이다(js/editor.js coalesceSizeHistory 「C3: 연속 크기/간격
     조정 히스토리 병합」 — +/- 연타가 키스트로크마다 칸을 쌓던 문제를 같은 결로 푼 자리).
═══════════════════════════════════════════════════════════════════════════ */

test('T-102-③ 연타는 되돌리기 «한 칸» — 다섯 번 눌러도 히스토리는 1, 블럭은 5px 간다', async ({ page }) => {
  await page.setContent(FREE_DOM);
  await page.addScriptTag({ content: BUNDLE });
  await page.addScriptTag({ content: ARROW });
  const r = await page.evaluate(`(() => {
    const mk = ${FAKE_EVT};
    for (let i = 0; i < 5; i++) window.__arrowKey(mk('ArrowRight'));
    return { pushes: window.__pushLog.length, left: document.getElementById('shape').style.left, pd: window.__pd };
  })()`);
  console.log('  연타 5회 → 히스토리 칸 =', r.pushes, '· left =', r.left);
  expect(r.pushes, '★키 한 번에 한 칸씩 쌓인다 = ⌘Z 가 수십 번이 된다').toBe(1);
  expect(r.left, '★다섯 번 눌렀으면 5px 다').toBe('5px');
  expect(r.pd, '★누를 때마다 캔버스 스크롤을 막아야 한다').toBe(5);
});

test('T-102-③ 연타가 «끊기면» 새 칸 — 손을 뗀 뒤 다시 누른 건 따로 되돌아간다', async ({ page }) => {
  await page.setContent(FREE_DOM);
  await page.addScriptTag({ content: BUNDLE });
  await page.addScriptTag({ content: ARROW });
  const r = await page.evaluate(`(() => {
    const mk = ${FAKE_EVT};
    window.__arrowKey(mk('ArrowRight'));
    window.__arrowKey(mk('ArrowRight'));
    const after1 = window.__pushLog.length;
    window._nudgeBurstAt = Date.now() - 5000;   // 손을 뗀 셈 치고 시계를 되돌린다
    window.__arrowKey(mk('ArrowRight'));
    return { after1, after2: window.__pushLog.length, left: document.getElementById('shape').style.left };
  })()`);
  expect(r.after1).toBe(1);
  expect(r.after2, '★쉬었다 다시 민 것까지 한 칸에 묶이면 ⌘Z 가 너무 많이 되돌린다').toBe(2);
  expect(r.left).toBe('3px');
});

test('T-102-③ ⇧는 10px · 네 방향이 다 산다', async ({ page }) => {
  await page.setContent(FREE_DOM);
  await page.addScriptTag({ content: BUNDLE });
  await page.addScriptTag({ content: ARROW });
  const r = await page.evaluate(`(() => {
    const mk = ${FAKE_EVT};
    const s = document.getElementById('shape');
    window.__arrowKey(mk('ArrowDown', true));
    window.__arrowKey(mk('ArrowRight', true));
    window.__arrowKey(mk('ArrowUp'));
    window.__arrowKey(mk('ArrowLeft'));
    return { left: s.style.left, top: s.style.top, ox: s.dataset.offsetX, oy: s.dataset.offsetY };
  })()`);
  expect(r.left).toBe('9px');
  expect(r.top).toBe('9px');
  expect(r.ox, '★드래그가 읽는 dataset.offsetX 도 같이 따라가야 한다').toBe('9');
  expect(r.oy).toBe('9');
});

test('T-102-③ 고른 게 «없거나» 섹션뿐이면 예전처럼 캔버스 스크롤 — 키를 먹지 않는다', async ({ page }) => {
  await page.setContent(`<div id="canvas"><div class="section-block selected"><div class="section-inner">
      <div id="tb" class="text-block" style="position:static"></div></div></div></div>`);
  await page.addScriptTag({ content: BUNDLE });
  await page.addScriptTag({ content: ARROW });
  const sectionOnly = await page.evaluate(`(() => {
    const mk = ${FAKE_EVT};
    window.__arrowKey(mk('ArrowRight'));
    return { pd: window.__pd || 0, pushes: window.__pushLog.length };
  })()`);
  expect(sectionOnly.pd, '★섹션«만» 고른 상태에서 키를 먹으면 캔버스 스크롤이 죽는다').toBe(0);
  expect(sectionOnly.pushes).toBe(0);

  await page.setContent('<div id="canvas"></div>');
  await page.addScriptTag({ content: BUNDLE });
  await page.addScriptTag({ content: ARROW });
  const nothing = await page.evaluate(`(() => {
    const mk = ${FAKE_EVT};
    window.__arrowKey(mk('ArrowDown'));
    return { pd: window.__pd || 0, pushes: window.__pushLog.length };
  })()`);
  expect(nothing.pd, '★아무것도 안 골랐는데 키를 먹으면 캔버스가 안 스크롤된다').toBe(0);
  expect(nothing.pushes).toBe(0);
});

test('T-102-③ 흐름(stack) 블럭 — 스크롤은 막되 되돌리기 칸은 안 쌓는다(민 것이 없다)', async ({ page }) => {
  await page.setContent(`<div id="canvas"><div class="section-block selected"><div class="section-inner">
      <div id="tb" class="text-block selected" style="position:static"></div></div></div></div>`);
  await page.addScriptTag({ content: BUNDLE });
  await page.addScriptTag({ content: ARROW });
  const r = await page.evaluate(`(() => {
    const mk = ${FAKE_EVT};
    window.__arrowKey(mk('ArrowRight'));
    return { pd: window.__pd || 0, pushes: window.__pushLog.length };
  })()`);
  expect(r.pd, '★밀 곳은 없어도 방금 고른 것이 화면 밖으로 나가면 안 된다').toBe(1);
  expect(r.pushes, '★아무것도 안 움직였는데 되돌리기 칸이 생기면 ⌘Z 가 먹통 한 칸을 만든다').toBe(0);
});
