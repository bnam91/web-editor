/* number-field-contract.dom.spec.js — 숫자칸 «세 규약»을 패널 전수로 잰다 [0920b-numfield]
 *
 * 현빈/페르소나 원문(2026-09-20 사용자 관점 훑기):
 *   「빈 칸으로 Enter 하면 최소값으로 확 줄면서 칸은 빈 채다(지금 값을 모른다)」
 *   「9999 넣으면 실제로는 1000 인데 칸엔 9999 가 그대로 남는다」
 *   「Gap 높이가 0 으로 붕괴한다」
 *
 * 규약(값의 SSOT = 칸 자신의 min/max 속성):
 *   ⑴ 빈 칸·무효값 = «값 없음» → 커밋하지 않고 이전 표시값을 되돌린다
 *   ⑵ 범위 밖 = 클램프한 값을 «칸에 되써서» 표시-모델 괴리를 없앤다
 *   ⑶ 0 과 빈 칸을 가른다 (min≤0 이면 0 은 그대로 커밋)
 *
 * 여기서 재는 것(칸 6종 × C1~C7):
 *   C1 비우고 Enter    → 모델 불변 · 칸 = 이전 값 · pushHistory 0회
 *   C2 9999 + Enter    → 모델 = max · ★칸 = max
 *   C3 -5 + Enter      → 모델 = min · 칸 = min
 *   C4 0 + Enter       → min≤0 이면 0 이 그대로 적용 (C1 과 갈린다)
 *   C5 타이핑 후 Escape → 커밋 없음 (기존 가드 규약 회귀)
 *   C6 ArrowUp         → 즉시 반영 (기존 가드 규약 회귀)
 *   C7 타이핑 중(Enter 전) → 모델 불변 (= 가드가 이 칸을 덮는다는 증거)
 *   C8 ★Enter 뒤 포커스가 칸에 남는다 (BODY 로 날아가면 다음 Backspace 가 «블럭»을 지운다)
 *
 * ★양성대조: C4·C5·C6 과 shape-w-num 의 C2 는 «고치기 전에도» 초록이어야 한다.
 *   하나라도 빨강이면 계측기가 틀린 것이다 — 계측기부터 고치고 다시 잰다.
 *
 * ⚠️★이 표본(5칸)은 «전부 「빈 값 = 무효」인 칸»이다 — 결론 범위가 아니다.
 *   「빈 값이 곧 값」인 칸(grid·row·comparison·table·banner02)은 이 파일 아래쪽 M1~M5 가 잰다.
 *   ⛔C1 을 «모든 숫자칸의 보편 규약»으로 읽지 마라 — 2026-09-21 에 정확히 그 오독으로
 *     unit/DOM 이 전부 초록인 채 auto 복귀 기능이 죽었다.
 *
 * ⛔앱을 «안» 띄운다 — 패널 모듈 5개를 route-fulfill 로 단독 로드
 *   (globals.js / color-picker.js / gradient-model.js 만 스텁). shape-size-panel.dom.spec.js 부트 패턴.
 * 실행: npm run test:dom -- number-field-contract
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';

const GLOBALS_STUB = `
export const propPanel  = document.getElementById('prop-panel');
export const canvasEl   = document.getElementById('canvas');
export const canvasWrap = document.getElementById('canvas-wrap');
export const state = window.__state;
export const PAGE_LABELS = ['', 'Hook', 'Main', 'Detail', 'CTA', 'Event'];
export const COLLAB_ENABLED = false;
export const MARKET_ENABLED = false;
export const FIGMA_ENABLED = false;
export const ANIM_GIF_ENABLED = false;
`;
const COLOR_PICKER_STUB = `
export function colorFieldHTML({ idPrefix, hex }) {
  return '<input type="text" id="' + idPrefix + '-color" value="' + (hex || '') + '">'
       + '<input type="number" class="prop-number" id="' + idPrefix + '-alpha" value="100">';
}
export function wireColorField() {}
export function parseAlphaFromColor() { return 100; }
export function seedPickerFromGradient() {}
`;
const GRADIENT_MODEL_STUB = `
export function svgStopRemap() { return []; }
export function parseGradient() { return null; }
export function buildGradientCSS() { return ''; }
`;

/** 칸 표 — «패널 × 칸 × 선언된 범위 × 모델을 어디서 읽나». 새 칸은 여기 한 줄만 더한다. */
const FIELDS = [
  {
    key: 'gap', label: '갭 높이', id: 'gap-number', min: 0, max: 1000, start: 120,
    open: `window.showGapProperties(document.getElementById('gapb'))`,
    read: `(() => { const v = parseFloat(document.getElementById('gapb').style.height); return Number.isFinite(v) ? v : null; })()`,
  },
  {
    key: 'page-padx', label: '페이지 좌우패딩', id: 'page-padx-number', min: 0, max: 200, start: 72,
    open: `window.showPageProperties()`,
    read: `window.__state.pageSettings.padX`,
  },
  {
    key: 'sticker-fs', label: '텍스트 스티커 글자크기', id: 'stk-t-fs-num', min: 8, max: 400, start: 32,
    open: `window.showStickerProperties(document.getElementById('stk'))`,
    read: `document.getElementById('stk').dataset.fontSize`,
  },
  {
    key: 'chat-fs', label: '챗 글자크기(가드 밖 증거칸)', id: 'chb-fontsize', min: 10, max: 60, start: 32,
    open: `window.showChatProperties(document.getElementById('chat'))`,
    read: `document.getElementById('chat').dataset.fontSize`,
  },
  {
    key: 'shape-w', label: '도형 W(양성대조: 이미 되쓴다)', id: 'shape-w-num', min: 10, max: 860, start: 300,
    open: `window.showShapeProperties(document.getElementById('shp'))`,
    read: `(() => { const v = parseFloat(document.getElementById('fr').style.width); return Number.isFinite(v) ? v : null; })()`,
  },
];

const FIXTURE = `
  <style>
    .section-block{position:relative;width:800px;}
    .section-inner{width:740px;}
    .frame-block{position:relative;}
    .shape-block{position:absolute;width:100%;height:100%;}
  </style>
  <div id="canvas-wrap"><div id="canvas">
    <div id="canvas-scaler">
      <div class="section-block" id="sec1"><div class="section-inner">
        <div class="gap-block selected" id="gapb" style="height:120px;"></div>
        <div class="frame-block" id="fr" data-free-layout="true" style="width:300px;height:270px;" data-width="300" data-height="270">
          <div class="shape-block selected" id="shp" data-shape-type="rectangle"><svg class="shape-svg" viewBox="0 0 100 100"></svg></div>
        </div>
        <div class="sticker-block selected" id="stk" data-shape="text" data-font-size="32" data-text="Text"></div>
        <div class="chat-block selected" id="chat" data-font-size="32" data-messages="[]"></div>
      </div></div>
    </div>
  </div></div>
  <div id="prop-panel"></div>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    const js = (body) => route.fulfill({ contentType: 'application/javascript', body });
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <script>
            window.__state = {
              pageSettings: { bg:'#828282', bgAlpha:100, gap:100, padX:72, padY:0, padXExcludesAsset:true },
              pages: [], currentPageId: 'page_1', imageGallery: [], assetsTree: [],
            };
            window.__history = 0;
            window.pushHistory = () => { window.__history++; };
            window.scheduleAutoSave = () => {};
            window.getBlockBreadcrumb = () => '';
          </script>
          <script type="module">
            import '/js/props/prop-number-commit-guard.js';
            import '/js/props/prop-gap.js';
            import '/js/props/prop-page.js';
            import '/js/props/prop-sticker.js';
            import '/js/props/prop-chat.js';
            import '/js/props/prop-shape.js';
            window.__ready = true;
          </script>
          </head><body>${FIXTURE}</body></html>`,
      });
    }
    if (url.pathname === '/js/globals.js') return js(GLOBALS_STUB);
    if (url.pathname === '/js/props/color-picker.js') return js(COLOR_PICKER_STUB);
    if (url.pathname === '/js/props/gradient-model.js') return js(GRADIENT_MODEL_STUB);
    /* 나머지는 «레포 실물» — 스텁 셋만 가짜다(shape-size-panel.dom.spec.js 와 같은 규약).
       404 로 막으면 모듈 그래프가 통째로 안 떠 window.__ready 가 영영 안 켜진다. */
    const file = path.join(REPO, url.pathname);
    if (file.startsWith(REPO) && fs.existsSync(file) && fs.statSync(file).isFile()) {
      const ext = path.extname(file);
      const type = ext === '.css' ? 'text/css'
        : ext === '.js' || ext === '.mjs' ? 'application/javascript' : 'text/plain';
      return route.fulfill({ contentType: type, body: fs.readFileSync(file) });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  expect(errs, 'harness pageerror').toEqual([]);
  return errs;
}

/** 패널을 열고 «시작 상태»(모델값·칸 표시값·pushHistory 카운터)를 잡는다. */
async function openPanel(page, f) {
  return page.evaluate(([openSrc, readSrc, id]) => {
    // eslint-disable-next-line no-new-func
    new Function(openSrc)();
    window.__history = 0;
    // eslint-disable-next-line no-new-func
    const model = new Function('return (' + readSrc + ')')();
    return { model: String(model), shown: document.getElementById(id)?.value };
  }, [f.open, f.read, f.id]);
}

async function readState(page, f) {
  return page.evaluate(([readSrc, id]) => {
    // eslint-disable-next-line no-new-func
    const model = new Function('return (' + readSrc + ')')();
    return { model: String(model), shown: document.getElementById(id).value, hist: window.__history };
  }, [f.read, f.id]);
}

/** 숫자칸에 «타이핑»해서 Enter 로 커밋 — prop-number-commit-guard 경로를 그대로 탄다. */
async function typeAndCommit(page, id, value) {
  const el = page.locator('#' + id);
  await el.click({ clickCount: 3 });
  if (String(value) !== '') await el.pressSequentially(String(value));
  else await el.press('Backspace');
  await el.press('Enter');
}

test.describe('숫자칸 규약 — 패널 전수', () => {
  for (const f of FIELDS) {
    test(`C1 [${f.key}] 비우고 Enter → 모델 불변 · 칸 = 이전 값 · pushHistory 0회`, async ({ page }) => {
      await boot(page);
      const before = await openPanel(page, f);
      await typeAndCommit(page, f.id, '');
      const after = await readState(page, f);
      expect(after.model, `${f.label}: 빈 칸이 모델을 바꿨다`).toBe(before.model);
      expect(after.shown, `${f.label}: 칸이 빈 채/딴 값으로 남았다 — 「지금 값을 모른다」`).toBe(before.shown);
      expect(after.hist, `${f.label}: 커밋 안 했는데 되돌리기 기록이 쌓였다`).toBe(0);
    });

    test(`C2 [${f.key}] 9999 + Enter → 모델 = max(${f.max}) · ★칸 = max`, async ({ page }) => {
      await boot(page);
      await openPanel(page, f);
      await typeAndCommit(page, f.id, 9999);
      const after = await readState(page, f);
      expect(Number(after.model), `${f.label}: 모델이 상한을 안 지킨다`).toBe(f.max);
      expect(after.shown, `${f.label}: 칸엔 9999 가 남고 실제는 ${f.max} — 표시≠실제`).toBe(String(f.max));
    });

    test(`C3 [${f.key}] -5 + Enter → 모델 = min(${f.min}) · 칸 = min`, async ({ page }) => {
      await boot(page);
      await openPanel(page, f);
      await typeAndCommit(page, f.id, -5);
      const after = await readState(page, f);
      expect(Number(after.model), `${f.label}: 모델이 하한을 안 지킨다`).toBe(f.min);
      expect(after.shown, `${f.label}: 칸이 하한을 안 보인다`).toBe(String(f.min));
    });

    test(`C4 [${f.key}] 0 + Enter → ${f.min <= 0 ? '0 이 그대로' : `하한 ${f.min} 으로`} (C1 과 갈린다)`, async ({ page }) => {
      await boot(page);
      await openPanel(page, f);
      await typeAndCommit(page, f.id, 0);
      const after = await readState(page, f);
      const want = f.min <= 0 ? 0 : f.min;
      expect(Number(after.model), `${f.label}: 의도적 0 이 빈 칸처럼 취급됐다`).toBe(want);
      expect(after.shown).toBe(String(want));
    });

    test(`C5 [${f.key}] 타이핑 후 Escape → 커밋 없음 (가드 회귀)`, async ({ page }) => {
      await boot(page);
      const before = await openPanel(page, f);
      const el = page.locator('#' + f.id);
      await el.click({ clickCount: 3 });
      await el.pressSequentially('55');
      await el.press('Escape');
      await el.blur();
      const after = await readState(page, f);
      expect(after.model, `${f.label}: Escape 인데 커밋됐다`).toBe(before.model);
      expect(after.shown, `${f.label}: Escape 인데 칸이 안 돌아왔다`).toBe(before.shown);
    });

    test(`C6 [${f.key}] ArrowUp → 즉시 반영 (가드 회귀)`, async ({ page }) => {
      await boot(page);
      const before = await openPanel(page, f);
      const el = page.locator('#' + f.id);
      await el.click({ clickCount: 3 });
      await el.press('ArrowUp');
      const after = await readState(page, f);
      expect(Number(after.model), `${f.label}: 화살표 스텝이 즉시 반영되지 않는다`)
        .toBe(Number(before.model) + 1);
    });

    test(`C8 [${f.key}] ★Enter 뒤 포커스가 «칸에 남는다» — 다음 Backspace 가 블럭을 지우지 않게`, async ({ page }) => {
      /* 가드는 Enter 를 el.blur() 로 받아 커밋한다. 그 부작용으로 activeElement 가 BODY 가 되면,
         블럭이 .selected 인 채라 이어지는 Backspace 가 js/editor.js 의 「target 이 INPUT 이면 무시」
         가드를 못 넘겨 «선택된 블럭을 지운다».
         실앱 9522(줌 40%) 실측: 이 못을 박기 «전»에 chb-fontsize 에 40 치고 Enter → activeElement
         BODY → Backspace 한 번에 chat-block 이 통째로 사라졌다(isConnected false).
         ⛔이 검사를 지우려면 먼저 그 길을 다른 데서 막았는지 보여라.
         ★0921 픽스 — 포커스를 돌려주는 조건에 «캔버스에 지울 것이 있나»가 붙었다. 그래서 이
           픽스처의 블럭들은 .selected 를 달고 있다(실앱에서 블럭 패널은 «골라져야» 뜬다).
           ⚠️그 갈림(선택 없음 → 기준선대로 BODY)은 아래 M5 가 «둘 다» 잰다. */
      await boot(page);
      await openPanel(page, f);
      await typeAndCommit(page, f.id, f.start);
      const active = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
      expect(active, `${f.label}: Enter 뒤 포커스가 «${f.id}» 를 떠났다 — 다음 Backspace 가 캔버스로 샌다`)
        .toBe(f.id);
    });

    test(`C7 [${f.key}] 타이핑 중(Enter 전) → 모델 불변 = 가드가 이 칸을 덮는다`, async ({ page }) => {
      await boot(page);
      const before = await openPanel(page, f);
      const el = page.locator('#' + f.id);
      await el.click({ clickCount: 3 });
      await el.pressSequentially('4');   // 대부분의 칸에서 하한 미만 = 옛 코드면 즉시 클램프가 보인다
      const mid = await readState(page, f);
      expect(mid.model, `${f.label}: Enter 전인데 이미 모델이 바뀌었다 — 이 칸은 가드 밖이다`)
        .toBe(before.model);
    });
  }
});

/* ═══════════════════════════════════════════════════════════════════════════
   ★M — «빈 값이 곧 값»인 칸 (2026-09-21 픽스 라운드, 이벨류에이터 high/medium)
   ───────────────────────────────────────────────────────────────────────────
   위 C1 의 표본 5칸은 전부 「빈 값 = 무효」 칸이다. 그 표본으로 「빈 값 → 커밋 없음」을
   «보편 규약»으로 못 박았더니, «빈 값이 뜻을 갖는» 패널에서 auto/역할기본 복귀가 통째로
   죽었다(초록인 채로 샜다 — 표본이 결론 범위와 달랐다).
   ⇒ 세 번째 축(「빈 값의 뜻」)을 칸이 «선언»하고, 여기서 그 갈림을 «둘 다» 잰다.

   ★이 describe 의 부트는 위와 «다르다» — globals.js 를 스텁하지 않고 레포 실물을 쓴다
     (prop-grid 가 끌고 오는 모듈 그래프가 넓어 부분 스텁이 거짓 초록을 만든다).
   ★음성대조: 고치기 전(59c96f3)엔 M2·M3 이 세 칸 전부 빨강, M4(음성 짝)는 초록이어야 한다.
   ═══════════════════════════════════════════════════════════════════════════ */

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
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file) || !fs.statSync(file).isFile()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME2[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness2.html`);
  await page.waitForFunction(() => window.__ready2 === true);
  expect(errs, 'harness2 pageerror').toEqual([]);
  return errs;
}

/** 패널마다: 픽스처를 놓고 패널을 열어 «그 칸»을 낸다. 모델은 read 로 읽는다. */
const MEANING_FIELDS = [
  {
    key: 'grid-typo-size',
    label: '그리드 줄 글자크기 (비우면 «역할 기본»)',
    id: 'grd-typo-size-number',
    meaning: 'auto',                    // 선언 수단: placeholder="22"(역할 기본값)
    set: 48,
    mount: `(() => {
      /* ⚠️1×1 로 줄이지 마라 — makeGridBlock 이 cells 를 «안 받고» lines 를 비운 채 올린다
         (실측). tests/dom/grid-typo.dom.spec.js 와 같은 2×2 꼴을 그대로 쓴다. */
      const { row, block } = window.__mkGrid({
        cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
        rows: [{ height: 'auto' }, { height: 'auto' }],
        cells: [
          [ { lines: [ { type: 'body', text: 'A0' } ] }, { lines: [ { type: 'body', text: 'B0' } ] } ],
          [ { lines: [ { type: 'body', text: 'C0' } ] }, { lines: [ { type: 'body', text: 'D0' } ] } ],
        ],
      });
      document.getElementById('host').appendChild(row);
      block.classList.add('selected');
      window.__block = block;
      window.__open = () => window.__openGrid(block, { r: 0, c: 0, li: 0 });
      window.__open();
    })()`,
    // «명시값이 있나»가 진실 — 없으면 역할 기본(22)이 그린다
    read: `(() => { const l = window.__gridModel(window.__block).cells[0][0].lines[0];
                    return (l && l.fontSize != null) ? String(l.fontSize) : 'NONE'; })()`,
  },
  {
    key: 'row-height',
    label: '행 높이 (비우면 auto)',
    id: 'row-height-number',
    meaning: 'auto',                    // 선언 수단: placeholder="auto"
    set: 400,
    mount: `(() => {
      const row = document.createElement('div');
      row.className = 'row'; row.id = 'row1'; row.dataset.layout = 'stack';
      row.innerHTML = '<div class="col"><div class="text-block" id="tb">T</div></div>';
      document.getElementById('host').appendChild(row);
      window.__row = row;
      window.__open = () => window.showRowProperties(row);
      window.__open();
    })()`,
    read: `(window.__row.dataset.rowHeight || '') + '|' + (window.__row.style.minHeight || '')`,
  },
  {
    key: 'cmp-row-h',
    label: '비교표 행 높이 (비우면 기본)',
    id: 'cmp-row-h-first',
    meaning: 'auto',                    // 선언 수단: placeholder="${rowH || 64}"
    set: 120,
    mount: `(() => {
      const block = document.createElement('div');
      block.className = 'comparison-block'; block.id = 'cmpb';
      block.dataset.cols = JSON.stringify([
        { title: 'A', rows: [{ type: 'text', text: 'r0' }] },
        { title: 'B', rows: [{ type: 'text', text: 'r0' }] },
      ]);
      document.getElementById('host').appendChild(block);
      window.__block = block;
      window.__open = () => {
        window.__openCmp(block);
        const f = document.querySelector('.cmp-row-h');
        if (f) f.id = 'cmp-row-h-first';      // 칸에 id 가 없다 — 재는 손잡이만 붙인다
      };
      window.__open();
    })()`,
    /* ★«그 행의 높이»를 정규형으로 읽는다 — dataset 은 없음(undefined)·"[]"·"[null]" 이
       모두 「기본 64」를 뜻해서 문자열 그대로 비교하면 거짓 빨강이 난다. */
    read: `(() => { try { const a = JSON.parse(window.__block.dataset.rowHeights || '[]');
                          return (a[0] == null) ? 'NONE' : String(a[0]); } catch (_) { return 'ERR'; } })()`,
  },
];

/** ★음성 짝 — «같은 패널 파일»에 있지만 빈 값의 뜻을 선언하지 «않은» 칸.
 *  같은 fix 에서 이쪽은 계속 「빈 값 = 무효 = 되돌림」이어야 두 축이 실제로 갈린 것이다. */
const NON_MEANING_FIELD = {
  key: 'row-padx', label: '행 좌우패딩 (placeholder 없음 = 빈 값은 무효)',
  id: 'row-padx-number', set: 40,
  mount: MEANING_FIELDS[1].mount,
  read: `(window.__row.dataset.padX || 'NONE')`,
};

async function mountAndRead(page, f) {
  return page.evaluate(([mountSrc, readSrc, id]) => {
    // eslint-disable-next-line no-new-func
    new Function(mountSrc)();
    window.__history = 0;
    // eslint-disable-next-line no-new-func
    const model = new Function('return (' + readSrc + ')')();
    const el = document.getElementById(id);
    return { model: String(model), shown: el?.value, ph: el?.placeholder, found: !!el };
  }, [f.mount, f.read, f.id]);
}
async function readAfter(page, f) {
  return page.evaluate(([readSrc, id]) => {
    // eslint-disable-next-line no-new-func
    const model = new Function('return (' + readSrc + ')')();
    const el = document.getElementById(id);
    return { model: String(model), shown: el?.value, hist: window.__history };
  }, [f.read, f.id]);
}

test.describe('숫자칸 세 번째 축 — «빈 값의 뜻»', () => {
  for (const f of MEANING_FIELDS) {
    test(`M1 [${f.key}] 픽스처·칸·선언이 실제로 서 있다 (양성대조)`, async ({ page }) => {
      await boot2(page);
      const s = await mountAndRead(page, f);
      expect(s.found, `${f.label}: 칸 #${f.id} 이 패널에 없다 — 아래 측정이 전부 헛것이 된다`).toBe(true);
      expect(String(s.ph ?? '').trim(), `${f.label}: «빈 값의 뜻» 선언(placeholder)이 사라졌다`).not.toBe('');
    });

    test(`M2 [${f.key}] 값을 넣으면 들어간다 (양성대조 — 배선이 살아 있다)`, async ({ page }) => {
      await boot2(page);
      const before = await mountAndRead(page, f);
      await typeAndCommit(page, f.id, f.set);
      const after = await readAfter(page, f);
      expect(after.model, `${f.label}: ${f.set} 를 넣었는데 모델이 안 변했다`).not.toBe(before.model);
      expect(after.model).toContain(String(f.set));
    });

    test(`M3 ★[${f.key}] 비우고 Enter → «auto/역할 기본»으로 되돌아간다`, async ({ page }) => {
      /* 이 칸들에서 빈 값은 「지우는 중」이 아니라 «명시적 값»이다 — 코드에 그렇게 적혀 있다
         (prop-grid.js:643 「★비우면 undefined 를 써서 역할 기본으로 되돌린다」 ·
          prop-row.js:145 isNaN→0→minHeight'' · prop-comparison.js:251 arr[ri]=null).
         가드가 여기서 커밋을 없애면 그 기능이 죽고, 칸엔 옛 숫자가 되써져 «조용한 무시»가 된다. */
      await boot2(page);
      const before = await mountAndRead(page, f);
      await typeAndCommit(page, f.id, f.set);
      await typeAndCommit(page, f.id, '');
      const after = await readAfter(page, f);
      expect(after.model, `${f.label}: 비웠는데 ${f.set} 이 그대로다 — 되돌리기 기능이 죽었다`)
        .toBe(before.model);
      expect(after.shown, `${f.label}: 칸에 옛 숫자가 되써졌다 — 사용자는 실패한 줄도 모른다`).toBe('');
    });
  }

  test(`M4 ★음성 짝 [${NON_MEANING_FIELD.key}] 선언이 «없는» 칸은 계속 빈 값 = 무효 = 되돌림`, async ({ page }) => {
    /* 같은 파일(prop-row.js) 안에서 두 축이 갈리는지 본다. 이게 초록이어야
       「그냥 전부 통과시켰다」가 아니라 «선언으로 갈랐다»가 증명된다. */
    const f = NON_MEANING_FIELD;
    await boot2(page);
    const s0 = await mountAndRead(page, f);
    expect(String(s0.ph ?? '').trim(), '음성 짝인데 placeholder 가 생겼다 — 짝이 무효가 됐다').toBe('');
    await typeAndCommit(page, f.id, f.set);
    const mid = await readAfter(page, f);
    expect(mid.model, 'padX 배선이 죽었다(양성대조)').toBe(String(f.set));
    await typeAndCommit(page, f.id, '');
    const after = await readAfter(page, f);
    expect(after.model, '★선언 없는 칸인데 빈 값이 커밋됐다 — padX 가 0 으로 조용히 죽는다').toBe(String(f.set));
    expect(after.shown, '이전 표시값이 안 돌아왔다').toBe(String(f.set));
  });

  test('M5 ★Enter 뒤 포커스 — «캔버스에 지울 것이 있을 때만» 칸에 남는다', async ({ page }) => {
    /* 기준선(29ae1cb)은 Enter 뒤 activeElement 가 BODY 였다. 앞 라운드가 233칸 «전부»에서
       그걸 바꿨다 → 0921 이벨류에이터 low. ⇒ 위험이 실제로 있을 때(캔버스 선택 존재)만 돌려준다. */
    await boot2(page);
    const f = MEANING_FIELDS[0];            // 그리드: mount 가 block.classList.add('selected') 한다
    await mountAndRead(page, f);
    await typeAndCommit(page, f.id, 48);
    const withSel = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    expect(withSel, '선택이 있는데 포커스가 BODY 로 샜다 — 다음 Backspace 가 블럭을 지운다').toBe(f.id);

    // 선택을 걷으면 지울 것이 없다 ⇒ 기준선 그대로 BODY
    await page.evaluate(() => document.querySelectorAll('#canvas .selected').forEach(e => e.classList.remove('selected')));
    await typeAndCommit(page, f.id, 36);
    const noSel = await page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName);
    expect(noSel, '★아무것도 안 골라졌는데 포커스를 붙잡았다 — 233칸의 손버릇을 이유 없이 바꾼다').toBe('BODY');
  });
});
