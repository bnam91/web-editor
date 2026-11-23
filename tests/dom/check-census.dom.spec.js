/* check-census.dom.spec.js — ★91 게이트(지디 261123): 시안 chku 열(현빈 261123 «온/오프 = 고디터 커스텀 체크 하나»)이 상태별로 그린 체크 수 ↔ 앱이 같은 상태에서 그리는 체크 수.
 *   상태 = handoff/rp-capture-261120/capture.js 의 75상태(같은 블럭 추가식 · 같은 고르기 길) 그대로 옮김 · 앱 = DOM 하네스(bootApp).
 *   셈: 앱 = #panel-right 안 보이는 label.ui-check · «머리 ＋ 대응»(절 머리 ＋/− 뒤 숨은 체크 · 지디 판정 = 제외 맞음)은 따로 셈.
 *   결과 = test-results/check-census.json(상태별 시안·앱·머리＋) + 콘솔 표 · 단언 = 앱 + 머리＋ === 시안 합 · 상태별 어긋남은 표로(판정은 사람).
 *   시안 수 = 탑 261123 시안 75상태 chku 열 data-chku 실측(합 91)을 박음 — 시안이 바뀌면 다시 재서 바꿀 것. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const MOCK = {"01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 1, "07": 0, "08": 0, "09": 0, "10": 0, "11": 1, "12": 2, "13": 0, "14": 3, "15": 3, "16": 3, "17": 3, "18": 3, "19": 4, "20": 2, "21": 0, "22": 1, "23": 0, "24": 0, "25": 2, "26": 0, "27": 1, "28": 2, "29": 2, "30": 5, "31": 2, "32": 6, "33": 0, "34": 0, "35": 1, "36": 6, "37": 2, "38": 0, "39": 4, "40": 5, "41": 3, "42": 2, "43": 0, "44": 1, "45": 0, "46": 2, "47": 1, "48": 2, "49": 0, "50": 0, "51": 0, "52": 0, "53": 0, "54": 0, "55": 2, "56": 0, "57": 0, "58": 0, "59": 0, "60": 2, "61": 0, "62": 1, "63": 0, "64": 0, "65": 0, "66": 1, "67": 0, "68": 3, "69": 0, "70": 1, "71": 1, "72": 0, "73": 1, "74": 1, "75": 3};
const ICON_SVG = "<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><circle cx='12' cy='12' r='10' fill='currentColor'/></svg>";
const STATES = [
['01','text-h1',"addTextBlock('h1')",'text-block'],['02','text-h2-heading',"addTextBlock('h2')",'text-block'],
['03','text-h3',"addTextBlock('h3')",'text-block'],['04','text-body',"addTextBlock('body')",'text-block'],
['05','text-caption',"addTextBlock('caption')",'text-block'],['06','text-label-tag',"addTextBlock('label')",'text-block'],
['07','text-bullet-list',"addTextBlock('bullet')",'text-block'],['08','text-blank',"addBlankTextBlock()",'text-block'],
['09','label-group-tags',"addLabelGroupBlock()",'label-group-block'],['10','icon-text',"addIconTextBlock()",'icon-text-block'],
['11','speech-bubble',"addSpeechBubbleBlock('left')",'text-block'],['12','quote',"addQuoteBlock()",'quote-block'],
['13','liner',"addLinerBlock('arc-up')",'text-block'],
['14','asset-standard',"addAssetBlock('standard')",'asset-block'],['15','asset-square',"addAssetBlock('square')",'asset-block'],
['16','asset-tall',"addAssetBlock('tall')",'asset-block'],['17','asset-wide',"addAssetBlock('wide')",'asset-block'],
['18','asset-object-small',"addAssetBlock('small')",'asset-block'],['19','asset-logo',"addAssetBlock('logo')",'asset-block'],
['20','icon-circle',"addIconCircleBlock()",'icon-circle-block'],['21','iconify',"addIconifyBlock('', '', 64)",'icon-block'],
['22','shape-rectangle',"addShapeBlock('rectangle')",'shape-block'],['23','shape-line',"addShapeBlock('line')",'shape-block'],
['24','shape-arrow',"addShapeBlock('arrow')",'shape-block'],['25','shape-ellipse',"addShapeBlock('ellipse')",'shape-block'],
['26','shape-polygon',"addShapeBlock('polygon')",'shape-block'],['27','shape-star',"addShapeBlock('star')",'shape-block'],
['28','frame',"addFrameBlock()",'frame-block'],['29','grid',"addGridBlock()",'grid-block'],
['30','table',"addTableBlock()",'table-block'],['31','card-cvb',"addCanvasBlock()",'canvas-block'],
['32','graph',"addGraphBlock()",'graph-block'],['33','divider',"addDividerBlock()",'divider-block'],
['34','gap',"addGapBlock(undefined,{asSibling:true})",'gap-block'],['35','step',"addStepBlock()",'step-block'],
['36','chat',"addChatBlock()",'chat-block'],['37','infographic',"addInfographicBlock()",'grid-block'],
['38','modal',"addModalBlock()",'modal-block'],['39','buzz',"addBuzzBlock()",'frame-block'],
['40','coupon',"addCouponBlock()",'coupon-block'],['41','documents-cert',"addCertBlock()",'cert-block'],
['42','slides',"addSlideBlock()",'slide-block'],['43','comparison',"addComparisonBlock()",'comparison-block'],
['44','laurel',"addLaurelBlock()",'laurel-block'],['45','bridge',"addBridgeBlock()",'bridge-block'],
['46','radial',"addRadialBlock()",'radial-block'],['47','banner02',"addBanner02Block()",'banner02-block'],
['48','banner',"addBannerBlock()",'frame-block'],['49','info-card-simple',"addInfoCardBlock()",'infocard-block'],
['50','inner-card',"addInnerCardBlock()",'innercard-block'],['51','price-card',"addPriceCardBlock()",'infocard-block'],
['52','review-card',"addReviewCardBlock()",'infocard-block'],['53','countup',"addCountupBlock()",'infocard-block'],
['54','qa',"addQABlock()",'qa-block'],['55','duo',"addDuoBlock()",'grid-block'],['56','joker',"addJokerBlock()",'joker-block'],
['57','mockup',"addMockupBlock()",'mockup-block'],['58','device-mockup',"addDeviceMockupBlock('iphone',300)",'mockup-block'],
['59','sticker-default',"addStickerBlock()",'sticker-block'],['60','sticker-text',"addStickerBlock({shape:'text'})",'sticker-block'],
['61','sticker-icon',`addStickerBlock({shape:'icon',iconName:'mdi:circle',svg:"${ICON_SVG}",size:64})`,'sticker-block'],
['62','sticker-coin',"addStickerBlock({shape:'coin'})",'sticker-block'],['63','sticker-highlightB',"addStickerBlock({shape:'highlightB'})",'sticker-block'],
['64','sticker-highlight',"addStickerBlock({shape:'highlight'})",'sticker-block'],['65','sticker-arrow-line',"addStickerBlock({shape:'arrow'})",'sticker-block'],
['66','sticker-glow',"addStickerBlock({shape:'glow'})",'sticker-block'],['67','gradient',"addGradientBlock()",'gradient-block'],
['68','zoom',"addZoomBlock()",'zoom-block'],['69','vector',"addVectorBlock()",'vector-block'],
['70','section','SPECIAL'],['71','section-bodyclick','SPECIAL'],['72','multi-select','SPECIAL'],
['73','sticker-count-marking','SPECIAL'],['74','youtube-thumb-section','SPECIAL'],['75','no-selection','SPECIAL'],['G1','grid-cell-after-block','SPECIAL'],['G2','grid-line-after-block','SPECIAL'],['G3','grid-line-after-line-dblclick','SPECIAL'],['G4','grid-col-scope-chip','SPECIAL'],['G5','infographic-row-scope-chip','SPECIAL'],
];
const HEAD_PLUS = ['asset-stroke-on', 'txt-shadow-on'];   // + «…-stroke-on»(텍스트 계열 절 머리 ＋) — 숨은 체크

async function clickEl(page, expr) {
  const p = await page.evaluate((e) => { const el = (0, eval)(e); if (!el) return null; el.scrollIntoView({ block: 'center', inline: 'center' }); const b = el.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; }, expr);
  if (!p) throw new Error('no target ' + expr);
  await page.mouse.click(p[0], p[1]);
}
const newOf = (cls) => `[...document.querySelectorAll('#canvas .${cls}, .${cls}')].filter(e=>!window.__ccBefore.has(e))`;
const count = (page) => page.evaluate((HP) => {
  const pr = document.getElementById('panel-right');
  const vis = [...pr.querySelectorAll('label.ui-check')].filter((l) => l.getClientRects().length).length;
  const head = [...pr.querySelectorAll('input[type=checkbox]')].filter((i) => !i.closest('label.ui-check') && (HP.includes(i.id) || /-stroke-on$/.test(i.id))).length;
  return { vis, head };
}, HEAD_PLUS);

test('C91 ★체크 자리 대조 — 시안 chku 91 ↔ 앱 상태별', async ({ page }) => {
  test.setTimeout(600000);
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const rows = []; const errs = [];
  for (const [nn, name, add, cls] of STATES) {
    if (!/^\d\d$/.test(nn)) continue;
    try {
      await page.evaluate(() => { if (typeof _cntMode !== 'undefined' && _cntMode) exitCountStickerMode(); window.deselectAll?.(); });
      if (add !== 'SPECIAL') {
        await page.evaluate(() => { window.addSection(); });
        await page.evaluate(() => { window.__ccBefore = new Set(document.querySelectorAll('*')); });
        await page.evaluate((a) => { (0, eval)(a); }, add.replace('${ICON_SVG}', ICON_SVG));
        await page.waitForFunction((e) => (0, eval)(e).length > 0, newOf(cls), { timeout: 8000 });
        await page.evaluate((e) => { window.__ccT = (0, eval)(e)[0]; window.deselectAll?.(); }, newOf(cls));
        await clickEl(page, 'window.__ccT');
      } else if (nn === '70' || nn === '71' || nn === '74') {
        await page.evaluate(() => { window.__ccBefore = new Set(document.querySelectorAll('*')); });
        await page.evaluate((n) => (n === '74' ? window.addYoutubeThumbSection() : window.addSection()), nn);
        await page.waitForFunction((e) => (0, eval)(e).length > 0, newOf('section-block'));
        await page.evaluate((e) => { window.__ccT = (0, eval)(e).pop(); window.deselectAll?.(); }, newOf('section-block'));
        await clickEl(page, "window.__ccT.querySelector('.section-label')");   // 71(몸 빈 곳)도 같은 섹션 패널 — 라벨로 연다(셈엔 같음)
      } else if (nn === '72') {
        await page.evaluate(() => { window.addSection(); window.__ccBefore = new Set(document.querySelectorAll('*')); window.addTextBlock('h2'); window.addTextBlock('body'); });
        await page.evaluate((e) => { const t = (0, eval)(e); window.__ccT = t[0]; window.__ccU = t[t.length - 1]; window.deselectAll?.(); }, newOf('text-block'));
        await clickEl(page, 'window.__ccT');
        const p = await page.evaluate(() => { const b = window.__ccU.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
        await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1]); await page.keyboard.up('Shift');
      } else if (nn === '73') {
        await page.evaluate(() => { window.addSection(); window.__ccBefore = new Set(document.querySelectorAll('*')); });
        await page.evaluate((e) => { window.__ccS = (0, eval)(e).pop(); window.deselectAll?.(); window.toggleCountStickerMode(); }, newOf('section-block'));
        await clickEl(page, 'window.__ccS');
        await page.waitForFunction((e) => (0, eval)(e).length > 0, newOf('sticker-block'));
        await page.evaluate((e) => { if (typeof _cntMode !== 'undefined' && _cntMode) exitCountStickerMode(); window.__ccT = (0, eval)(e).pop(); window.deselectAll?.(); }, newOf('sticker-block'));
        await clickEl(page, 'window.__ccT');
      } else if (nn === '75') {
        await page.evaluate(() => window.deselectAll?.());
      }
      await page.waitForTimeout(250);
      const c = await count(page);
      rows.push({ nn, name, mock: MOCK[nn] || 0, app: c.vis, head: c.head });
    } catch (e) { errs.push(nn + ' ' + name + ': ' + String(e.message).slice(0, 160)); rows.push({ nn, name, mock: MOCK[nn] || 0, app: null, head: null }); }
  }
  const sum = (k) => rows.reduce((s, r) => s + (r[k] || 0), 0);
  const diff = rows.filter((r) => r.app === null || r.app + r.head !== r.mock);
  const out = { mock: sum('mock'), app: sum('app'), head: sum('head'), diff, errs, rows };
  fs.mkdirSync(path.join(__dirname, '..', '..', 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '..', 'test-results', 'check-census.json'), JSON.stringify(out, null, 1));
  console.log('[C91] 시안 ' + out.mock + ' · 앱 ' + out.app + ' · 머리＋ ' + out.head + ' · 어긋난 상태 ' + diff.length + ' · 못 연 상태 ' + errs.length);
  diff.forEach((r) => console.log('  [C91 어긋남] ' + r.nn + ' ' + r.name + ' 시안 ' + r.mock + ' · 앱 ' + r.app + ' · 머리＋ ' + r.head));
  errs.forEach((e) => console.log('  [C91 못 엶] ' + e));
  expect(errs, '못 연 상태 — 장면 문제(셈 아님)').toEqual([]);
  expect(out.app + out.head, '★91 게이트 — 앱 체크 + 머리＋ 대응 = 시안 chku 합').toBe(out.mock);
});
