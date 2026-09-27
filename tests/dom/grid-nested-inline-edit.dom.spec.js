/* grid-nested-inline-edit.dom.spec.js — 「중첩(duo) «안»의 줄을 더블클릭해서 고친다」 (T-238, 2026-09-27)
 *
 * ★왜 세우나 — 현빈 0927 실기 지적이 이 동작이었다: 「나란히 두 칸으로 두기 줄은 추가가 되는데,
 *   ★더블클릭 후 입력이 안 되네」. 고쳤고 현빈이 «손으로» 통과를 확인했다. 그런데 회귀를 잡을 자가
 *   없었다 — 기존 그물은 `tests/unit/grid-nested-inline-edit.test.mjs` 뿐이고 그것은 «소스를 읽어»
 *   형제 가지가 있는지만 잰다. ⇒ 가지를 지우면 빨개지지만, 가지가 «있는데 안 먹는» 손상
 *   (nhost 규약·np 전달·blur 커밋)은 통째로 못 본다. 그 축을 화면으로 밟는다.
 *
 * ★무엇을 잠그나
 *   N0  양성대조(먼저) — 중첩 «밖» 줄은 더블클릭으로 편집된다 (계측기가 살아 있다)
 *   N1  ★중첩 «안» 글자 줄을 더블클릭하면 «편집에 들어간다»(contenteditable + focus + 캐럿이 그 안)
 *   N2  ★★타이핑하고 blur 하면 «모델»에 반영된다 — 현빈이 못 하셨던 바로 그 동작
 *   N3  ★같은 duo 의 «옆 칸» 줄과 «품은 바깥 줄»은 안 바뀐다 (np 를 흘리면 여기가 갈린다)
 *   N4  이력이 정확히 «1개» — ⌘Z 한 번으로 돌아온다 (updateGridBlock 이 스스로 1회 쌓는다)
 *   N5  ⛔중첩 안 «gap» 줄은 편집에 안 들어간다 (nhost 가 없다 = 바깥 _gridEditable 과 같은 가름)
 *   P1  ★★양성대조 — 형제 가지(nestEl 분기)를 끄면 N1·N2 가 빨개진다
 *   P2  ★★양성대조 — 커밋에서 `np` 를 떼면 N2 가 빨개진다 (쓰기 길이 진짜 재진다는 증거)
 *
 * ⚠️이 그물이 «못» 닿는 곳(정직하게) — 깊이 2(duo 안 duo 안 줄)다. 렌더러는 depth 2 에도 줄을
 *   그리지만(npath="0.2/1.0") 여기 fixture 는 깊이 1 뿐이다. 그 축은 유닛 쪽 몫이다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- grid-nested-inline-edit
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html', '.json': 'application/json' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0;padding:40px;} #canvas{width:700px;}</style></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="ss-handles-overlay"></div>
<script>
  /* bindBlock 의 «선택» 경로가 «옵셔널체이닝 없이» 부르는 전역만 no-op 으로 세운다.
     근거 목록 = placeholder-selectall-banner-grid.dom.spec.js 와 같은 자
       (grep -o "window\\.[A-Za-z_][A-Za-z0-9_]*(" js/block-drag.js).
     ⚠️편집진입·커밋에 쓰이는 것은 하나도 대체하지 «않는다» — 재는 대상이다.
     ★pushHistory 는 no-op 이 아니라 «세는» 자로 따로 세운다(N4). */
  ['_clampTextFrameWidth','_openBlockContextMenu','applyImageTransform','buildLayerPanel','clearAssetImage',
   'clearCircleImage','deselectAll','enterCircleImageEditMode','enterImageEditMode','grdIsSoleSelected',
   'highlightBlock','loadImageToAsset','loadImageToCircle','loadVideoToAsset',
   'showAssetProperties','showCanvasProperties','showDividerProperties','showGapProperties','showGraphProperties',
   'showIconCircleProperties','showLabelGroupProperties','showSimpleCardProperties','showTableProperties',
   'showTextProperties','showVectorProperties','syncSection','toggleAssetGifPlayback','triggerAssetUpload',
   'triggerCircleUpload','selectBlock','scheduleAutoSave','triggerAutoSave','showToast']
    .forEach(k => { if (typeof window[k] !== 'function') window[k] = function () {}; });
  window.__pushLog = [];
  window.pushHistory = function (label) { window.__pushLog.push(label === undefined ? '(updateGridBlock)' : label); };
</script>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import '/js/props/prop-grid.js';           /* ★중첩 줄의 우측패널 경로(T-220 ②)도 같이 밟는다 */
  import { bindBlock } from '/js/drag-drop.js';
  window.__model = getGridModel;
  window.__put = (opts) => {
    const { row, block } = makeGridBlock(opts || {});
    document.getElementById('host').appendChild(row);
    bindBlock(block);
    block.classList.add('selected');
    window.__block = block;
    return block.id;
  };
  window.__ready = true;
</script></body></html>`;

/** ★양성대조용: 서빙하는 «소스»를 갈아친다. ⛔닻을 못 찾으면 «조용히 원본»을 주지 않는다. */
async function boot(page, mutate) {
  const muts = !mutate ? [] : (Array.isArray(mutate) ? mutate : [mutate]);
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    let body = fs.readFileSync(file);
    const mine = muts.filter(m => m.path === url.pathname);
    if (mine.length) {
      let txt = body.toString('utf8');
      for (const m of mine) {
        if (!txt.includes(m.from)) {
          return route.fulfill({ contentType: 'text/javascript', body: 'throw new Error("MUTATION_ANCHOR_MISSING");' });
        }
        txt = txt.replace(m.from, m.to);
      }
      body = Buffer.from(txt, 'utf8');
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 칸(0,0) = 바깥 줄 셋 — [0]'OUT-A' · [1]'OUT-B' · [2]중첩 duo.
   duo 안 = 왼칸['IN-A', gap] · 오른칸['IN-B'].
   ⇒ npath: 'IN-A'="0.0" · gap="0.1" · 'IN-B'="1.0" (nroot 는 셋 다 2). */
const FIXTURE = {
  cols: [
    { width: 1, lines: [
      { type: 'body', text: 'OUT-A' },
      { type: 'body', text: 'OUT-B' },
      { type: 'duo', cols: [
        { width: 1, lines: [{ type: 'body', text: 'IN-A' }, { type: 'gap', height: 24 }] },
        { width: 1, lines: [{ type: 'body', text: 'IN-B' }] },
      ] },
    ] },
    { width: 1, lines: [{ type: 'body', text: 'X' }] },
  ],
};

/** 모델에서 «중첩 안» 글자를 읽는다. ⛔화면이 아니라 모델이다 — 저장되는 것이 이것이다. */
function nestedTexts(page) {
  return page.evaluate(() => {
    const duo = window.__model(window.__block).cells[0][0].lines[2];
    return {
      inA: duo.cols[0].lines[0].text,
      inB: duo.cols[1].lines[0].text,
      outA: window.__model(window.__block).cells[0][0].lines[0].text,
      duoType: duo.type,
    };
  });
}

/** 선택/캐럿/포커스를 한 번에 — 「아무 일도 안 일어남」이 통과하는 구멍을 막는다. */
function selInfo(page, selector) {
  return page.evaluate((sel) => {
    const el = document.querySelector(sel);
    const s = window.getSelection();
    return {
      exists: !!el,
      editable: !!(el && el.isContentEditable),
      focused: !!(el && document.activeElement === el),
      anchorIn: !!(el && s && s.anchorNode && (el === s.anchorNode || el.contains(s.anchorNode))),
      ranges: s ? s.rangeCount : -1,
    };
  }, selector);
}

const IN_A = '[data-nroot="2"][data-npath="0.0"]';
const IN_B = '[data-nroot="2"][data-npath="1.0"]';
const IN_GAP = '[data-nroot="2"][data-npath="0.1"]';

/* ── 변이 닻 (P1·P2) ────────────────────────────────────────────────
   ⛔둘 다 «지금 소스에 있는 글자»다. 닻이 늙으면 boot 이 MUTATION_ANCHOR_MISSING 을 던진다. */
const KILL_BRANCH = {
  path: '/js/block-drag.js',
  from: 'if (nestEl && block.contains(nestEl)) {\n        const nr = ',
  to:   'if (false && nestEl && block.contains(nestEl)) {\n        const nr = ',
};
const DROP_NP = {
  path: '/js/block-drag.js',
  from: '? { r: addr.r, c: addr.c, lineIndex: addr.li, np: addr.np, text }',
  to:   '? { r: addr.r, c: addr.c, lineIndex: addr.li, text }',
};

test.describe('중첩(duo) 안 줄 인라인 편집 (T-238)', () => {

  test('N0 양성대조 — 중첩 «밖» 줄은 더블클릭으로 편집된다 (계측기가 살아 있다)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    const out = page.locator('[data-r="0"][data-c="0"][data-line="0"]');
    await expect(out).toHaveText('OUT-A');
    await out.dblclick();
    const info = await selInfo(page, '[data-r="0"][data-c="0"][data-line="0"]');
    expect(info).toMatchObject({ editable: true, focused: true, anchorIn: true });
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('N1 ★중첩 «안» 글자 줄을 더블클릭하면 편집에 들어간다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    const inA = page.locator(IN_A);
    await expect(inA).toHaveText('IN-A');
    await inA.dblclick();
    const info = await selInfo(page, IN_A);
    expect(info.exists).toBe(true);
    expect(info.editable).toBe(true);     // ← 고치기 전엔 false (가지가 없어 아무 일도 안 났다)
    expect(info.focused).toBe(true);
    expect(info.anchorIn).toBe(true);
    expect(info.ranges).toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('N2 ★★타이핑하고 blur 하면 «모델»에 반영된다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    const inA = page.locator(IN_A);
    await inA.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('강아지 간식');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const t = await nestedTexts(page);
    expect(t.inA).toBe('강아지 간식');     // ← 고치기 전엔 'IN-A' (편집 자체가 안 열렸다)
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('N3 ★옆 칸 줄과 «품은 바깥 줄»은 안 바뀐다 (np 를 흘리면 여기가 갈린다)', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    await page.locator(IN_A).dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('강아지 간식');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const t = await nestedTexts(page);
    expect(t.inA).toBe('강아지 간식');
    expect(t.inB).toBe('IN-B');            // 옆 칸 무변화
    expect(t.outA).toBe('OUT-A');          // 바깥 줄 무변화
    expect(t.duoType).toBe('duo');         // ★품은 줄이 글자 줄로 «둔갑»하지 않았다
    await expect(page.locator(IN_B)).toHaveText('IN-B');
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('N4 이력이 정확히 «1개» — ⌘Z 한 번으로 돌아온다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    await page.evaluate(() => { window.__pushLog.length = 0; });
    const inA = page.locator(IN_A);
    await inA.dblclick();
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('가');
    await page.keyboard.insertText('나');
    await page.keyboard.insertText('다');   // ★타이핑마다 쌓이면 안 된다
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const log = await page.evaluate(() => window.__pushLog.slice());
    expect(await nestedTexts(page).then(t => t.inA)).toBe('가나다');
    expect(log.length).toBe(1);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('N5 ⛔중첩 안 «gap» 줄은 편집에 안 들어간다', async ({ page }) => {
    const errs = await boot(page);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    const gap = page.locator(IN_GAP);
    await expect(gap).toHaveCount(1);       // ★주소는 «찍혀 있다» — 그래도 편집 대상이 아니다
    await gap.dblclick({ force: true });
    const info = await selInfo(page, IN_GAP);
    expect(info.editable).toBe(false);
    const t = await nestedTexts(page);
    expect(t.inA).toBe('IN-A');             // 이웃도 안 열렸다
    expect(await page.evaluate(() => window.__pushLog.length)).toBe(0);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('P1 ★★양성대조 — 형제 가지를 끄면 N1 이 빨개진다', async ({ page }) => {
    const errs = await boot(page, KILL_BRANCH);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    await page.locator(IN_A).dblclick();
    const info = await selInfo(page, IN_A);
    expect(info.editable).toBe(false);      // 가지가 없으면 «아무 일도» 안 난다
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test('P2 ★★양성대조 — 커밋에서 `np` 를 떼면 N2 가 빨개진다', async ({ page }) => {
    await boot(page, DROP_NP);
    await page.evaluate((fx) => window.__put(fx), FIXTURE);
    await page.locator(IN_A).dblclick();
    /* ★「아무 일도 안 나서」 통과하는 구멍을 막는다 — 편집은 «열렸다». 갈리는 곳은 커밋뿐이다. */
    expect((await selInfo(page, IN_A)).editable).toBe(true);
    await page.keyboard.press('ControlOrMeta+a');
    await page.keyboard.insertText('강아지 간식');
    await page.evaluate(() => document.activeElement && document.activeElement.blur());
    const t = await nestedTexts(page);
    expect(t.inA).not.toBe('강아지 간식');   // ★np 가 없으면 중첩 «안»에 안 닿는다
  });
});
