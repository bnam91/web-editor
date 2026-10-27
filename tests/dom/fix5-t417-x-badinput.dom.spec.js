/* fix5-t417-x-badinput.dom.spec.js — 숫자칸 규약 갈래 C(지디 2026-10-26): 오타(validity.badInput)는 «공용 가드 한 자리»에서 거절된다.
 *
 * ★왜 이 파일 — 소비자(공용 가드를 쓰는 숫자칸)는 수백 칸이라 칸마다 시험을 둘 수 없다. 대신 «서로 다른 모듈»의 칸 다섯에
 *   같은 오타 「1e」를 넣어 모두 거절되는지 본다 — 고친 자리가 패널마다가 아니라 가드 한 자리임을 보이는 자.
 *   ⚠️고른 칸은 전부 «빈 값 = 뜻»을 선언한 칸(placeholder)이다. 선언 «없는» 칸은 갈래 C 전에도 오타가 빈 값 갈래로 되돌려졌다
 *     (type=number 가 '' 로 주므로) ⇒ 그런 칸은 이 자의 빨강을 못 낸다. 갈래 C 가 «거동을 바꾸는» 칸은 선언된 칸뿐이다.
 * ★칸 (칸마다: 값 set 을 넣고 Enter → 「1e」 Enter → 모델 = set · 칸 = set · pushHistory 0 · badInput 풀림)
 *   B1 prop-graph  #grb-pie-name-fs  (원형 이름 글자 · placeholder = 라벨 크기)
 *   B2 prop-graph  #grb-pie-rank-fs  (원형 순위 글자)
 *   B3 prop-grid   #grd-typo-size-number (줄 글자 크기 · placeholder = 역할 기본)
 *   B4 prop-row    #row-height-number (행 높이 · placeholder="auto")
 *   B5 prop-comparison .cmp-row-h (비교표 행 높이 · placeholder = 기본)
 *   N1 음성대조 — 빈 칸 Enter 는 그대로 «칸의 뜻»(원형 이름 = 키 삭제 = 기본 복귀)
 *   N2 음성대조 — 1e3 · .5 · -0 · +5 · 빈 칸: Chromium 의 badInput 판정과 커밋 결과를 값으로 적는다(1e3·.5·-0 은 먹혀야 한다)
 *   I1 IME 근사 — insertText / composition 합성으로 「1e」 · 편집 키(Backspace)로 세션이 열린 판은 거절을 단언 ·
 *      편집 키 «없는» 판(noEditKey)은 가드의 타이핑 세션 밖이라 값만 남긴다(NUMFIELD-SESSION-NO-EDITKEY-01)
 * 변이: 가드의 isBadInput 을 false 로 ⇒ B1~B5 다섯 칸이 빨강이어야 한다(N1·N2 의 «먹혀야 하는» 칸은 초록).
 * ⛔고정 대기 0 — 조건 대기만.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-t417-x-badinput.dom.spec.js --workers=1 --retries=0
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const ROOT = process.env.GD1001_ROOT || path.join(__dirname, '..', '..');   // _root-harness 와 같은 판 바꾸기(양성대조·변이)
const ORIGIN = 'http://goditor.dom.test';
const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));

/* ── 판 A: 앱 전체(bootApp) — 원형 그래프 ── */
async function bootPie(page, extra = {}) {
  await page.setViewportSize({ width: 1400, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((extra) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="pS" data-section="1" style="background:#fff"><div class="section-hitzone"></div><div class="section-inner" style="padding-left:32px;padding-right:32px;"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'pG';
    block.dataset.chartType = 'pie';
    block.dataset.items = JSON.stringify([{ label: '가', value: 40 }, { label: '나', value: 35 }, { label: '다', value: 25 }]);
    Object.assign(block.dataset, { pieRank: '1', pieName: '1' }, extra);
    document.querySelector('#pS .section-inner').appendChild(row);
    window.renderGraph(block);
    window.deselectAll?.();
    block.classList.add('selected');
    window.showGraphProperties(block);
    /* pushHistory 를 «세기만» 한다(원래 것도 부른다) — 오타에서 0 이어야 한다 */
    const orig = window.pushHistory; window.__history = 0;
    window.pushHistory = (...a) => { window.__history++; return orig?.(...a); };
  }, extra);
  await raf2(page);
  return errs;
}

/* ── 판 B: 패널 모듈만(number-field-contract.dom.spec.js 의 HARNESS2 와 같은 꼴) — grid · row · comparison ── */
const MIME2 = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };
const HARNESS2 = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas-wrap"><div id="canvas">
  <div class="section-block"><div class="section-inner" id="host"></div></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script>
  window.__history = 0;
  window.pushHistory = () => { window.__history++; };
  window.scheduleAutoSave = () => {};
  window.showToast = () => {};
</script>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import '/js/props/prop-number-commit-guard.js';
  import { makeGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  import '/js/props/prop-row.js';
  import { showComparisonProperties } from '/js/props/prop-comparison.js';
  window.__mkGrid = makeGridBlock;
  window.__gridModel = getGridModel;
  window.__openGrid = showGridProperties;
  window.__openCmp = showComparisonProperties;
  window.__ready2 = true;
</script></body></html>`;
async function boot2(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness2.html') return route.fulfill({ contentType: 'text/html', body: HARNESS2 });
    const file = path.join(ROOT, url.pathname);
    if (!file.startsWith(ROOT) || !fs.existsSync(file) || !fs.statSync(file).isFile()) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME2[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness2.html`);
  await page.waitForFunction(() => window.__ready2 === true);
  return errs;
}

/** 칸 표 — mount 는 판 안에서 칸을 내고, read 는 «모델»을 글자로 읽는다(칸 표시와 따로). */
const FIELDS = [
  { key: 'B1', mod: 'prop-graph', sel: '#grb-pie-name-fs', set: '30', boot: 'pie',
    read: `document.getElementById('pG').dataset.pieNameFs ?? 'NONE'` },
  { key: 'B2', mod: 'prop-graph', sel: '#grb-pie-rank-fs', set: '30', boot: 'pie',
    read: `document.getElementById('pG').dataset.pieRankFs ?? 'NONE'` },
  { key: 'B3', mod: 'prop-grid', sel: '#grd-typo-size-number', set: '48', boot: 'h2',
    mount: `(() => {
      const { row, block } = window.__mkGrid({
        cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }], rows: [{ height: 'auto' }, { height: 'auto' }],
        cells: [[{ lines: [{ type: 'body', text: 'A0' }] }, { lines: [{ type: 'body', text: 'B0' }] }],
                [{ lines: [{ type: 'body', text: 'C0' }] }, { lines: [{ type: 'body', text: 'D0' }] }]] });
      document.getElementById('host').appendChild(row); block.classList.add('selected'); window.__block = block;
      window.__openGrid(block, { r: 0, c: 0, li: 0 });
    })()`,
    read: `(() => { const l = window.__gridModel(window.__block).cells[0][0].lines[0]; return (l && l.fontSize != null) ? String(l.fontSize) : 'NONE'; })()` },
  { key: 'B4', mod: 'prop-row', sel: '#row-height-number', set: '400', boot: 'h2',
    mount: `(() => {
      const row = document.createElement('div'); row.className = 'row'; row.id = 'row1'; row.dataset.layout = 'stack';
      row.innerHTML = '<div class="col"><div class="text-block" id="tb">T</div></div>';
      document.getElementById('host').appendChild(row); window.__row = row; window.showRowProperties(row);
    })()`,
    read: `(window.__row.dataset.rowHeight || 'NONE') + '|' + (window.__row.style.minHeight || '')` },
  { key: 'B5', mod: 'prop-comparison', sel: '.cmp-row-h', set: '120', boot: 'h2',
    mount: `(() => {
      const block = document.createElement('div'); block.className = 'comparison-block'; block.id = 'cmpb';
      block.dataset.cols = JSON.stringify([{ title: 'A', rows: [{ type: 'text', text: 'r0' }] }, { title: 'B', rows: [{ type: 'text', text: 'r0' }] }]);
      document.getElementById('host').appendChild(block); window.__block = block; window.__openCmp(block);
    })()`,
    read: `(() => { try { const a = JSON.parse(window.__block.dataset.rowHeights || '[]'); return a[0] == null ? 'NONE' : String(a[0]); } catch (_) { return 'ERR'; } })()` },
];
async function mount(page, f) {
  if (f.boot === 'pie') return bootPie(page);
  const errs = await boot2(page);
  await page.evaluate((src) => { new Function(src)(); }, f.mount);   // eslint-disable-line no-new-func
  return errs;
}
const state = (page, f) => page.evaluate(([readSrc, sel]) => {
  const el = document.querySelector(sel);
  return { model: String(new Function('return (' + readSrc + ')')()), shown: el?.value, bad: !!el?.validity?.badInput, hist: window.__history };   // eslint-disable-line no-new-func
}, [f.read, f.sel]);
/** 진짜 키보드 — 칸을 누르고 전부 고른 뒤(Backspace) 글자를 치고 Enter. */
async function typeEnter(page, sel, text) {
  await page.click(sel);
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Backspace');
  if (text) await page.keyboard.type(text);
  await page.keyboard.press('Enter');
  await raf2(page);
}

for (const f of FIELDS) {
  test(`${f.key} [${f.mod} ${f.sel}] 오타 「1e」 Enter → 거절 · 모델·칸 = 이전 값 · pushHistory 0`, async ({ page }) => {
    const errs = await mount(page, f);
    const ph = await page.evaluate((sel) => document.querySelector(sel)?.placeholder ?? null, f.sel);
    expect(String(ph ?? '').trim(), '전제: 이 칸은 «빈 값 = 뜻»을 선언했다(placeholder) — 선언 없는 칸은 이 자의 빨강을 못 낸다').not.toBe('');
    await typeEnter(page, f.sel, f.set);
    const a = await state(page, f);
    expect(a.model, `전제: ${f.set} 이 들어갔다(배선 살아 있음)`).toContain(f.set);
    await page.evaluate(() => { window.__history = 0; });
    await typeEnter(page, f.sel, '1e');
    const b = await state(page, f);
    expect(b.model, '오타가 모델을 바꾸지 않는다(빈 값의 뜻으로 커밋되지 않는다)').toBe(a.model);
    expect(b.shown, '칸 = 이전 표시값').toBe(a.shown);
    expect(b.hist, '오타에 pushHistory 0').toBe(0);
    expect(b.bad, '되돌린 뒤 칸에 무효 글자가 남지 않는다').toBe(false);
    expect(errs).toEqual([]);
  });
}

test('N1 음성대조 — 원형 이름 30 · 빈 칸 Enter → 키 삭제(칸의 뜻 = 기본 복귀 · 갈래 C 는 빈 칸을 안 건드린다)', async ({ page }) => {
  const errs = await bootPie(page, { pieNameFs: '30' });
  await typeEnter(page, '#grb-pie-name-fs', '');
  const s = await state(page, FIELDS[0]);
  expect(s.model).toBe('NONE');
  expect(s.shown).toBe('');
  expect(s.hist, '빈 칸 커밋은 pushHistory 1').toBe(1);
  expect(errs).toEqual([]);
});

/* N2 — Chromium 판정표. 원형 이름 칸(min 8 · max 200)에 넣고 Enter. 「먹혀야 하는」 입력(유한수)이 거절되면 결함. */
const N2 = [
  ['1e3', { bad: false, model: '200' }],   // 1000 → 클램프 200
  ['.5', { bad: false, model: '8' }],      // 0.5 → 클램프 8
  ['-0', { bad: false, model: '8' }],      // -0 → 클램프 8
  ['12', { bad: false, model: '12' }],
];
for (const [typed, want] of N2) {
  test(`N2 음성대조 「${typed}」 → badInput ${want.bad} · 먹힌다(키 ${want.model})`, async ({ page }) => {
    const errs = await bootPie(page, { pieNameFs: '30' });
    await page.click('#grb-pie-name-fs'); await page.keyboard.press('Meta+a'); await page.keyboard.press('Backspace');
    await page.keyboard.type(typed);
    const pre = await page.evaluate(() => { const e = document.getElementById('grb-pie-name-fs'); return { bad: e.validity.badInput, value: e.value }; });
    console.log(`N2 ${JSON.stringify(typed)} → badInput ${pre.bad} · value ${JSON.stringify(pre.value)}`);
    await page.keyboard.press('Enter'); await raf2(page);
    expect(pre.bad).toBe(want.bad);
    expect((await state(page, FIELDS[0])).model).toBe(want.model);
    expect(errs).toEqual([]);
  });
}
/* 「+5」 — 유한수처럼 보이지만 HTML 의 «유효한 부동소수 문자열»은 앞 + 를 안 받는다 ⇒ 판정을 값으로 남기고, 결과를 «그 판정에 맞게» 단언한다. */
test('N2+ 「+5」 — Chromium 판정을 적고 그 판정대로 처리된다(badInput 이면 거절 · 아니면 5 → 8 클램프)', async ({ page }) => {
  const errs = await bootPie(page, { pieNameFs: '30' });
  await page.click('#grb-pie-name-fs'); await page.keyboard.press('Meta+a'); await page.keyboard.press('Backspace');
  await page.keyboard.type('+5');
  const pre = await page.evaluate(() => { const e = document.getElementById('grb-pie-name-fs'); return { bad: e.validity.badInput, value: e.value }; });
  console.log(`N2 "+5" → badInput ${pre.bad} · value ${JSON.stringify(pre.value)}`);
  await page.keyboard.press('Enter'); await raf2(page);
  expect((await state(page, FIELDS[0])).model).toBe(pre.bad ? '30' : '8');
  expect(errs).toEqual([]);
});

/* I1 — IME 근사(headless 한계): 진짜 한글 조합 키는 headless 에 없다. insertText(키 없이 글자만)와 composition 이벤트 합성으로 근사한다.
   재는 것: 「1e」가 칸에 들어갔나(badInput) · Enter 뒤 키가 남나. 가드의 타이핑 세션은 keydown 으로 열린다 ⇒ 키 없는 입력은 세션 밖이다. */
for (const how of ['insertText', 'composition', 'insertText-noEditKey']) {
  test(`I1 IME 근사(${how}) 「1e」 → 판정·결과를 값으로 남긴다`, async ({ page }) => {
    const errs = await bootPie(page, { pieNameFs: '30' });
    await page.click('#grb-pie-name-fs'); await page.keyboard.press('Meta+a');
    if (how !== 'insertText-noEditKey') await page.keyboard.press('Backspace');   // noEditKey = 편집 키 «없이» 글자만(진짜 IME 처럼 keydown 이 Process 뿐인 판)
    if (how.startsWith('insertText')) await page.keyboard.insertText('1e');
    else {
      await page.evaluate(() => { const e = document.getElementById('grb-pie-name-fs'); e.dispatchEvent(new CompositionEvent('compositionstart', { bubbles: true, data: '' })); });
      await page.keyboard.insertText('1e');
      await page.evaluate(() => { const e = document.getElementById('grb-pie-name-fs'); e.dispatchEvent(new CompositionEvent('compositionend', { bubbles: true, data: '1e' })); });
    }
    const pre = await page.evaluate(() => { const e = document.getElementById('grb-pie-name-fs'); return { bad: e.validity.badInput, value: e.value }; });
    await page.keyboard.press('Enter'); await raf2(page);
    const s = await state(page, FIELDS[0]);
    console.log(`I1 ${how} → pre ${JSON.stringify(pre)} · after ${JSON.stringify(s)}`);
    expect(pre.bad, '전제: 무효 글자가 칸에 들어갔다').toBe(true);
    /* 편집 키로 타이핑 세션이 열린 뒤의 키 없는 글자(조합 확정과 같은 꼴)는 가드가 잡는다.
       ⚠️noEditKey(편집 키 0 · keydown 이 Process 뿐인 판)는 세션이 안 열려 가드 «밖»이다 — 값만 남긴다(이름: NUMFIELD-SESSION-NO-EDITKEY-01 · 실키 측정은 앱에서). */
    if (how !== 'insertText-noEditKey') expect([s.model, s.shown, s.hist], '오타 거절 · 칸 = 이전 · pushHistory 0').toEqual(['30', '30', 0]);
    expect(errs).toEqual([]);
  });
}
