/* text-to-quote.dom.spec.js — 1017t1m1 「텍스트블럭에서 quato블럭으로 바꿀수도 있게 위에 type절에
 * 넣기」(현빈). 패널-only 범위(open_questions ⑴ — 단축키 typeMap 은 안 건드린다, 건드리면 ⒜ 가 빨개진다).
 *
 * ★무엇을 잠그나
 *   PRE  전제 — 실물 소스에 정의 자리가 실제로 있다(window.makeQuoteBlock·bindBlock·selectBlock·buildLayerPanel)
 *   M1-a 양성 — Quote 단추 ⇒ .quote-block 1 · .text-block 0 · 글이 옮겨졌다 ·
 *               pushHistory 가 «DOM 변경 전」에 불렸다(push-before — ⌘Z 준비) · bindBlock·selectBlock·buildLayerPanel 호출
 *   M1-b 음성대조(잃는 서식 고지) — .tgs(글자효과) 가 있던 텍스트를 바꾸면 토스트가 뜬다
 *   M1-c 음성대조(자가생존) — wireTextToQuote 를 no-op 으로 갈아끼우면 M1-a 가 실제로 빨강
 *
 * ★하네스 — prop-text-wireup-type.js 는 가벼운 import 둘뿐(text-type-class.js·label-auto-color.js)이라
 *   «진짜 모듈」을 그대로 싣는다(⛔사본 없음). makeQuoteBlock·bindBlock·selectBlock·buildLayerPanel 은
 *   ★이 레인에서 스텁이다(선례 grad-stop-alpha-commit.dom.spec.js — 「DOM 하네스에서는 스텁」).
 *   실제로 그 전역이 사는지는 PRE 가 소스에서 잰다.
 * ⛔진짜 ⌘Z(js/history.js 전체) 는 이 격리 레인 밖이다 — «pushHistory 가 변경 전에 불렸다»까지만 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-to-quote
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://texttoquote.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

const WIREUP_SRC = read('js/props/prop-text-wireup-type.js');

/* ── 음성대조본 — wireTextToQuote 를 no-op 으로 갈아끼운다 ──────────────────── */
const WIREUP_N_NOOP = (() => {
  const needle = 'export function wireTextToQuote({ tb, propPanel, ctx }) {';
  if (!WIREUP_SRC.includes(needle)) throw new Error('M1-c 변환이 늙었다 — wireTextToQuote 시그니처를 못 찾았다');
  // 함수 몸통을 빈 함수로 — 중괄호 균형을 직접 찾아 자른다.
  const start = WIREUP_SRC.indexOf(needle);
  let i = start + needle.length, depth = 1;
  for (; i < WIREUP_SRC.length; i++) {
    if (WIREUP_SRC[i] === '{') depth++;
    else if (WIREUP_SRC[i] === '}') { depth--; if (depth === 0) { i++; break; } }
  }
  return WIREUP_SRC.slice(0, start) + 'export function wireTextToQuote() { /* N: no-op */ }' + WIREUP_SRC.slice(i);
})();

function harness({ wireup = WIREUP_SRC, withTgs = true } = {}) {
  return `<!doctype html><html><head><meta charset="utf-8"><style>body{margin:0}</style></head><body>
<div id="canvas">
  <div class="section-block">
    <div class="section-inner">
      <div class="frame-block" id="wrap1" data-text-frame="true">
        <div class="text-block" id="tb1">
          <div class="tb-h1" id="content1" contenteditable="true">Hello ${withTgs ? '<span class="tgs">World</span>' : 'World'}</div>
        </div>
      </div>
    </div>
  </div>
</div>
<div id="prop-panel">
  <div class="prop-type-group"><button class="prop-type-btn" id="txt-to-quote">Quote</button></div>
</div>
<script>
  window.__hist = 0; window.__histBeforeMutation = null;
  window.pushHistory = () => {
    window.__hist++;
    // ★push-before 증명 — 이 시점에 .text-block 이 «아직」 있어야 한다(= DOM 변경 전에 불렸다).
    window.__histBeforeMutation = !!document.querySelector('.text-block');
  };
  window.triggerAutoSave = () => { window.__auto = (window.__auto||0) + 1; };
  window.buildLayerPanel = () => { window.__layer = (window.__layer||0) + 1; };
  window.showToast = (m) => { window.__toasts = (window.__toasts||[]); window.__toasts.push(m); };
  window.makeQuoteBlock = (opts) => {
    window.__madeOpts = opts;
    const block = document.createElement('div');
    block.className = 'quote-block';
    block.id = 'qt_test1';
    block.dataset.type = 'quote';
    block.dataset.text = opts.text;
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'qt_row1';
    row.appendChild(block);
    return { row, block };
  };
  window.bindBlock = (b) => { window.__bound = b && b.id; };
  window.selectBlock = (id) => { window.__selected = id; return true; };
</script>
<script type="module">
import { wireTextToQuote } from '/js/props/prop-text-wireup-type.js';
const tb = document.getElementById('tb1');
const contentEl = document.getElementById('content1');
const propPanel = document.getElementById('prop-panel');
const ctx = { contentEl };
wireTextToQuote({ tb, propPanel, ctx });
window.__ready = true;
</script>
</body></html>`;
}

async function boot(page, opts) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  const wireupBody = (opts && opts.wireup) || WIREUP_SRC;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    if (u.pathname === '/h.html') return route.fulfill({ contentType: 'text/html', body: harness(opts) });
    if (u.pathname === '/js/props/prop-text-wireup-type.js') {
      return route.fulfill({ contentType: 'text/javascript', body: wireupBody });
    }
    const file = path.join(REPO, u.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/h.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 10000 }).catch((e) => {
    throw new Error(`__ready 안 섬 — pageerror: ${JSON.stringify(errs)} / ${e.message}`);
  });
  return errs;
}

test('PRE 전제 — 실물 소스에 makeQuoteBlock·bindBlock·selectBlock·buildLayerPanel 정의 자리가 있다', () => {
  const quoteSrc = read('js/blocks/quote-block.js');
  const dragSrc = read('js/block-drag.js');
  const blockEditSrc = read('js/block-edit.js');
  expect(quoteSrc).toContain('window.makeQuoteBlock');
  expect(dragSrc).toContain('window.bindBlock');
  expect(blockEditSrc).toContain('window.selectBlock');
  // buildLayerPanel 은 이 레인에서 스텁 대상(그라데이션 레인의 같은 판정과 동일) — 정의 자리는 panels/layer-panel.js
  const layerSrc = read('js/panels/layer-panel.js');
  expect(layerSrc.includes('function buildLayerPanel') || layerSrc.includes('buildLayerPanel')).toBe(true);
});

test('M1-a 양성 — Quote 단추 ⇒ quote-block 1 · text-block 0 · 글 이동 · push-before · bind·select·layer 호출', async ({ page }) => {
  const errs = await boot(page);
  await page.click('#txt-to-quote');
  const r = await page.evaluate(() => ({
    quoteCount: document.querySelectorAll('.quote-block').length,
    textCount: document.querySelectorAll('.text-block').length,
    wrapGone: !document.getElementById('wrap1'),
    quoteText: document.querySelector('.quote-block')?.dataset.text,
    hist: window.__hist,
    histBeforeMutation: window.__histBeforeMutation,
    bound: window.__bound,
    selected: window.__selected,
    layer: window.__layer,
    auto: window.__auto,
  }));
  expect(errs).toEqual([]);
  expect(r.quoteCount).toBe(1);
  expect(r.textCount).toBe(0);
  expect(r.wrapGone).toBe(true);
  expect(r.quoteText).toBe('Hello World');
  expect(r.hist).toBe(1);
  expect(r.histBeforeMutation).toBe(true);   // ★push-before — pushHistory 가 불린 그 순간 text-block 이 아직 있었다
  expect(r.bound).toBe('qt_test1');
  expect(r.selected).toBe('qt_test1');
  expect(r.layer).toBe(1);
  expect(r.auto).toBe(1);
});

test('M1-b 음성대조(잃는 서식 고지) — .tgs 가 있던 텍스트를 바꾸면 토스트가 뜬다 · 없으면 안 뜬다', async ({ page }) => {
  const withTgs = await boot(page, { withTgs: true });
  await page.click('#txt-to-quote');
  const toastsWith = await page.evaluate(() => window.__toasts || []);
  expect(withTgs).toEqual([]);
  expect(toastsWith.length).toBe(1);

  const noTgs = await boot(page, { withTgs: false });
  await page.click('#txt-to-quote');
  const toastsWithout = await page.evaluate(() => window.__toasts || []);
  expect(noTgs).toEqual([]);
  expect(toastsWithout.length).toBe(0);   // ★음성 — 잃을 서식이 없으면 조용하다(과잉경고 방지)
});

test('M1-c 음성대조(자가생존) — wireTextToQuote 를 no-op 으로 갈아끼우면 M1-a 가 실제로 빨강', async ({ page }) => {
  const errs = await boot(page, { wireup: WIREUP_N_NOOP });
  await page.click('#txt-to-quote');
  const r = await page.evaluate(() => ({
    quoteCount: document.querySelectorAll('.quote-block').length,
    textCount: document.querySelectorAll('.text-block').length,
  }));
  expect(errs).toEqual([]);
  expect(r.quoteCount).toBe(0);   // ★무력화 판 — M1-a 의 1 기대가 깨진다
  expect(r.textCount).toBe(1);    // ★text-block 이 그대로 남아 있다
});
