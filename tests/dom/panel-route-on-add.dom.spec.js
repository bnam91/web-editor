/* panel-route-on-add.dom.spec.js — 「블럭을 넣은 «그 순간» 우측 패널이 그 블럭 것인가」. (2026-09-21 신설)
 *
 * ★왜 필요한가 — «사용자 관점 훑기»(0920) T-079
 *   현빈 페르소나: 「배너 글자크기를 40 으로 바꾸고 저장했는데 다시 열면 원래 크기로 돌아가 있어요」
 *   뿌리는 배너가 아니라 «패널 오라우팅»이었다. js/block-edit.js 의 selectBlock 이 타입표
 *   9종만 들고 마지막을 `else window.showTextProperties(block)` 로 떨어뜨렸다 ⇒ 배너를 넣자마자
 *   우측에 «Text Block» 패널이 뜨고, 거기서 만진 글자크기/색은 .bn2-label 의 «인라인 스타일»에
 *   찍힌다. banner02 의 정본은 dataset.lines 이고 renderBanner02 가 innerHTML 을 새로 그리므로
 *   저장/로드에서 그 인라인은 통째로 폐기된다 = 조용한 데이터 손실.
 *
 * ★음성대조(고치기 «전» 실측, int/0920b @29ae1cb)
 *   D-ROUTE-1 의 `.prop-block-name` = 'Text Block'  (고친 뒤 'Banner')
 *   D-ROUTE-2 의 오라우팅 타입 = banner02·modal·canvas·comparison·step·chat·laurel·zoom·
 *              vector·icon·mockup·joker·gap·icon-circle·label-group·asset 등 (고친 뒤 0건)
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(modal-resize.dom.spec.js 하네스 복제).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js panel-route-on-add
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block"><div class="section-inner" id="host" style="width:860px"></div></div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<!-- ★정본 패널 디스패치 + «진짜» selectBlock. 스텁을 쓰면 이 검사의 전제가 사라진다.
     ⚠️고치기 «전»에는 /js/panel-dispatch.js 가 없어 404 다 — 그게 곧 음성대조다. -->
<script src="/js/panel-dispatch.js"></script>
<script src="/js/block-edit.js"></script>
<script type="module">
  import { makeBanner02Block, renderBanner02 } from '/js/blocks/banner02-block.js';
  import '/js/props/prop-banner02.js';
  import '/js/props/prop-text.js';
  window.__mkBanner = makeBanner02Block;
  window.__renderBanner = renderBanner02;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ⛔«패널 제목»으로 재지 마라 — 2026-09-21 실앱(9520·줌40%) 실측 함정.
     `.prop-block-name` 은 두 패널 «모두» `dataset.layerName || 기본값` 을 찍는다
     (prop-banner02.js:253 · prop-text-template.js:50). banner02 의 layerName 은 'Banner' 라
     ★텍스트 패널이 떠도 제목은 'Banner' 로 읽힌다 = 검사처럼 생겼지만 아무것도 안 재는 문장.
     ⇒ «그 패널에만 있는 칸»으로 잰다: 배너 패널 = #bn2-variant-group(Variant) 등,
       텍스트 패널 = #txt-size-number(글자 크기). 실앱 실측도 이 축으로 다시 쟀다:
       기준 int/0920b = bn2 칸 0개 · txt-size-number 있음 / 고친 뒤 = bn2 칸 22개 · 없음. */
test('D-ROUTE-1 ★배너를 넣은 «그 순간» 열리는 패널이 «배너 패널»이다 (텍스트 패널이면 T-079 가 되살아난다)', async ({ page }) => {
  await boot(page);
  const got = await page.evaluate(() => {
    const { row, block } = window.__mkBanner({});
    document.getElementById('host').appendChild(row);
    window.__renderBanner(block);
    const pb = document.querySelector('#panel-right .panel-body');
    pb.innerHTML = '';                       // ★직전 패널이 남아 «안 열려도» 초록이 되는 일을 막는다
    // addBanner02Block 이 삽입 직후에 하는 «그 한 줄»
    window.selectBlock(block.id);
    return {
      bannerFields: pb.querySelectorAll('[id^="bn2-"]').length,
      hasVariant:   !!pb.querySelector('#bn2-variant-group'),
      hasTextSize:  !!pb.querySelector('#txt-size-number'),
      name:         pb.querySelector('.prop-block-name')?.textContent || '(패널 없음)',
    };
  });
  expect(got.hasVariant).toBe(true);
  expect(got.hasTextSize).toBe(false);
  expect(got.bannerFields).toBeGreaterThan(5);
});

test('D-ROUTE-2 ★정본 표의 «모든» 타입이 selectBlock 에서 제 패널로 간다 (전수)', async ({ page }) => {
  const errs = await boot(page);
  const bad = await page.evaluate(() => {
    /* 정본 표를 «코드에서» 읽지 않고, 패널 함수를 전부 스파이로 갈아끼워
       「어떤 타입이 어떤 함수로 갔나」를 실제 호출로 잰다. */
    const TABLE = [
      ['shape-block',       'showShapeProperties'],
      ['asset-block',       'showAssetProperties'],
      ['gap-block',         'showGapProperties'],
      ['icon-circle-block', 'showIconCircleProperties'],
      ['table-block',       'showTableProperties'],
      ['label-group-block', 'showLabelGroupProperties'],
      ['graph-block',       'showGraphProperties'],
      ['divider-block',     'showDividerProperties'],
      ['bridge-block',      'showBridgeProperties'],
      ['grid-block',        'showGridProperties'],
      ['qa-block',          'showQAProperties'],
      ['infocard-block',    'showInfoCardProperties'],
      ['innercard-block',   'showInnerCardProperties'],
      ['modal-block',       'showModalProperties'],
      ['joker-block',       'showJokerProperties'],
      ['canvas-block',      'showCanvasProperties'],
      ['banner02-block',    'showBanner02Properties'],
      ['comparison-block',  'showComparisonProperties'],
      ['vector-block',      'showVectorProperties'],
      ['icon-block',        'showIconifyProperties'],
      ['mockup-block',      'showMockupProperties'],
      ['step-block',        'showStepProperties'],
      ['chat-block',        'showChatProperties'],
      ['laurel-block',      'showLaurelProperties'],
      ['zoom-block',        'showZoomProperties'],
      ['icon-text-block',   'showTextProperties'],
      ['text-block',        'showTextProperties'],
      ['gradient-block',    '_selectGradient'],
      ['sticker-block',     '_selectSticker'],
    ];
    const NAMES = [...new Set(TABLE.map(r => r[1]))].concat(['showSimpleCardProperties']);
    let called = null;
    for (const n of NAMES) window[n] = () => { called = n; };

    const host = document.getElementById('host');
    const out = [];
    TABLE.forEach(([cls, want], i) => {
      host.innerHTML = '';
      const el = document.createElement('div');
      el.className = cls;
      el.id = 'probe' + i;
      el.dataset.type = cls.replace(/-block$/, '');
      host.appendChild(el);
      called = null;
      window.selectBlock(el.id);
      if (called !== want) out.push(`${cls}: 기대 ${want} → 실제 ${called === null ? '«아무 패널도 안 열림»' : called}`);
    });
    return out;
  });
  expect(errs).toEqual([]);
  expect(bad).toEqual([]);
});
