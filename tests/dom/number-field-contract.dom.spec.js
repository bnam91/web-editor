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
        <div class="gap-block" id="gapb" style="height:120px;"></div>
        <div class="frame-block" id="fr" data-free-layout="true" style="width:300px;height:270px;" data-width="300" data-height="270">
          <div class="shape-block" id="shp" data-shape-type="rectangle"><svg class="shape-svg" viewBox="0 0 100 100"></svg></div>
        </div>
        <div class="sticker-block" id="stk" data-shape="text" data-font-size="32" data-text="Text"></div>
        <div class="chat-block" id="chat" data-font-size="32" data-messages="[]"></div>
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
         ⛔이 검사를 지우려면 먼저 그 길을 다른 데서 막았는지 보여라. */
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
