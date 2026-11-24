/* check-census.dom.spec.js — ★91 게이트(지디 261123): 시안 chku 열(현빈 261123 «온/오프 = 고디터 커스텀 체크 하나»)이 상태별로 그린 체크 수 ↔ 앱이 같은 상태에서 그리는 체크 수.
 *   상태 = handoff/rp-capture-261120/capture.js 의 75상태(같은 블럭 추가식 · 같은 고르기 길) 그대로 옮김 · 앱 = DOM 하네스(bootApp).
 *   셈: 앱 = #panel-right 안 label.ui-check «전부»(접힌 절·조건 숨김 포함 — 시안 수도 캡처 HTML 의 data-chku 전부라 같은 자) · «머리 ＋ 대응»(절 머리 ＋/− 뒤 숨은 체크)은 시안이 안 셈 ⇒ 따로 칸(대조 밖).
 *   결과 = test-results/check-census.json(상태별 시안·앱·머리＋) + 콘솔 표 · 단언 = 앱 + 머리＋ === 시안 합 · 상태별 어긋남은 표로(판정은 사람).
 *   시안 수 = 탑 261123 시안 75상태 chku 열 data-chku 실측(합 91)을 박음 — 시안이 바뀌면 다시 재서 바꿀 것.
 *   ★59 = 1(시안 gdragon 동기화 — 바로잡음 59 원형 스티커에 앱의 Content «이미지 모드» 줄을 더함 · 합 92) */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
/* ★상태 묶음 쪼갬(지디 261124 · 열차 train/0913-c 인텔 w2 재전수 C91 빨강 52.9s) — 옛 판 = 75상태를 한 test 한 장(시한 40분)에서 돌아 2 워커 전수에서 다른 spec 과 겹치면
   장면 대기(30~60초)에 걸렸다(«단독 실행 권장» 주석 = 근거 깨짐). ⇒ 상태 8개씩 test 하나(C91-01~10 · 새 앱 부팅 · 제 시한 3분) · 끝 test(C91-합)가 합 92 를 단언하고 check-census.json 을 쓴다.
   ⛔시한 늘리기·retries 로 덮지 않는다 — 묶음 하나하나가 w2 에서 초록이어야 «제품 지연 아님»이다. serial = 묶음 순서·합 모으기만 묶는다. */
test.describe.configure({ mode: 'serial' });

const MOCK = {"01": 0, "02": 0, "03": 0, "04": 0, "05": 0, "06": 1, "07": 0, "08": 0, "09": 0, "10": 0, "11": 1, "12": 2, "13": 0, "14": 3, "15": 3, "16": 3, "17": 3, "18": 3, "19": 4, "20": 2, "21": 0, "22": 1, "23": 0, "24": 0, "25": 2, "26": 0, "27": 1, "28": 2, "29": 2, "30": 5, "31": 2, "32": 6, "33": 0, "34": 0, "35": 1, "36": 6, "37": 2, "38": 0, "39": 4, "40": 5, "41": 3, "42": 2, "43": 0, "44": 1, "45": 0, "46": 2, "47": 1, "48": 2, "49": 0, "50": 0, "51": 0, "52": 0, "53": 0, "54": 0, "55": 2, "56": 0, "57": 0, "58": 0, "59": 1, "60": 2, "61": 0, "62": 1, "63": 0, "64": 0, "65": 0, "66": 1, "67": 0, "68": 3, "69": 0, "70": 1, "71": 1, "72": 0, "73": 1, "74": 1, "75": 3};
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
  /* ★그 요소에 «직접» 누름 사건을 쏜다(mousedown → mouseup → click · 그 요소 가운데 좌표) — 화면 겹침(떠 있는 스티커 등)에 안 흔들린다.
     지디 C91 2차·srv 재현: 실마우스·가린 것 걷기·섹션 숨기기 모두 상태 쌓임에 따라 남의 패널을 셌다(62 coin · 66 glow 등).
     잴 것은 «그 블럭이 골라졌을 때 패널의 체크 수»라 히트 테스트는 셈 밖이다(실마우스 고르기는 각 블럭 spec 몫). */
  const ok = await page.evaluate((e) => { const el = (0, eval)(e); if (!el) return false; el.scrollIntoView({ block: 'center', inline: 'center' }); const b = el.getBoundingClientRect();
    const o = { bubbles: true, cancelable: true, view: window, button: 0, clientX: b.left + b.width / 2, clientY: b.top + b.height / 2 };
    el.dispatchEvent(new MouseEvent('mousedown', o)); el.dispatchEvent(new MouseEvent('mouseup', o)); el.dispatchEvent(new MouseEvent('click', o)); return true; }, expr);
  if (!ok) throw new Error('no target ' + expr);
}
const newOf = (cls) => `[...document.querySelectorAll('#canvas .${cls}, .${cls}')].filter(e=>!window.__ccBefore.has(e))`;
const count = (page) => page.evaluate((HP) => {
  const pr = document.getElementById('panel-right');
  const vis = [...pr.querySelectorAll('label.ui-check')].filter((l) => !l.closest('[hidden]')).length;   // 조건 숨김 줄([hidden] · 예: 라이너 «안쪽 뒤집기» = 원·둥근/반지름 있을 때만)은 안 셈 · 접힌 절은 셈   // 접힌 절 안 것도 센다(말풍선 «발신자 이름» 이 Special 접힘에서 0 으로 셌던 것 · 지디 C91 1차)
  const head = [...pr.querySelectorAll('input[type=checkbox]')].filter((i) => !i.closest('label.ui-check') && (HP.includes(i.id) || /-stroke-on$/.test(i.id))).length;
  return { vis, head };
}, HEAD_PLUS);

/** 상태 하나 — 블럭 넣고 고르고 패널이 멈출 때까지(옛 한 장 판의 장면 코드 그대로) · 셈 행 하나 */
async function runState(page, [nn, name, add, cls]) {
      await page.evaluate(() => { if (typeof _cntMode !== 'undefined' && _cntMode) exitCountStickerMode(); window.deselectAll?.(); });
      if (add !== 'SPECIAL') {
        await page.evaluate(() => { window.addSection(); });
        await page.evaluate(() => { window.__ccBefore = new Set(document.querySelectorAll('*')); });
        await page.evaluate((a) => { (0, eval)(a); }, add.replace('${ICON_SVG}', ICON_SVG));
        await page.waitForFunction((e) => (0, eval)(e).length > 0, newOf(cls), { timeout: 60000 });
        await page.evaluate((e) => { window.__ccT = (0, eval)(e)[0]; window.deselectAll?.(); }, newOf(cls));
        await clickEl(page, 'window.__ccT');
      } else if (nn === '70' || nn === '71' || nn === '74') {
        await page.evaluate(() => { window.__ccBefore = new Set(document.querySelectorAll('*')); });
        await page.evaluate((n) => (n === '74' ? window.addYoutubeThumbSection() : window.addSection()), nn);
        await page.waitForFunction((e) => (0, eval)(e).length > 0, newOf('section-block'), { timeout: 30000 });
        await page.evaluate((e) => { window.__ccT = (0, eval)(e).pop(); window.deselectAll?.(); }, newOf('section-block'));
        await clickEl(page, "window.__ccT.querySelector('.section-label')");   // 71(몸 빈 곳)도 같은 섹션 패널 — 라벨로 연다(셈엔 같음)
      } else if (nn === '72') {
        await page.evaluate(() => { window.addSection(); window.__ccBefore = new Set(document.querySelectorAll('*')); window.addTextBlock('h2'); window.addTextBlock('body'); });   // 섹션은 «전»에 넣음(텍스트 둘만 새 것)
        await page.evaluate((e) => { const t = (0, eval)(e); window.__ccT = t[0]; window.__ccU = t[t.length - 1]; window.deselectAll?.(); }, newOf('text-block'));
        await clickEl(page, 'window.__ccT');
        const p = await page.evaluate(() => { const b = window.__ccU.getBoundingClientRect(); return [b.left + b.width / 2, b.top + b.height / 2]; });
        await page.keyboard.down('Shift'); await page.mouse.click(p[0], p[1]); await page.keyboard.up('Shift');
      } else if (nn === '73') {
        await page.evaluate(() => { window.__ccBefore = new Set(document.querySelectorAll('*')); window.addSection(); });   // ★«전» 표를 먼저(지디 C91 1차: 뒤에 떠서 새 섹션이 «새 것»이 아니었다 → no target __ccS)
        await page.evaluate((e) => { window.__ccS = (0, eval)(e).pop(); window.deselectAll?.(); window.toggleCountStickerMode(); }, newOf('section-block'));
        await page.evaluate(() => { window.__ccBefore = new Set(document.querySelectorAll('*')); });   // 마킹 스티커만 «새 것»으로
        /* ★마킹 도구는 캔버스 «진짜 누름»(좌표)만 받는다 — 사건 직접 쏘기(clickEl)로는 안 생겨 40분 매달렸다(srv cf99f3e20) ⇒ 이 장면만 실마우스 · 빈 섹션 가운데라 겹칠 것 없음 */
        /* ★누를 점 = 그 섹션이 «주인»인 점(capture.js 71 처럼 훑음) — 가운데엔 앞 상태의 떠 있는 스티커가 겹쳐 그걸 눌렀다(srv d7fc87442 30초 시한) */
        /* ★묶음 쪼갬 뒤 73 은 «새로 부팅한 판»의 첫 장면 — 부팅 배율 맞추기가 늦게 끝나 섹션이 움직이는 중에 점을 잡으면 빗나간다(srv w2 30초 시한 · memory dom-coords) ⇒ 섹션 사각형이 rAF 두 번 연속 같을 때까지 */
        await expect.poll(() => page.evaluate(() => new Promise((res) => { const s = window.__ccS; s.scrollIntoView({ block: 'center' }); const a = JSON.stringify(s.getBoundingClientRect()); requestAnimationFrame(() => requestAnimationFrame(() => res(a === JSON.stringify(s.getBoundingClientRect())))); })), { timeout: 30000, message: '73 섹션이 안 멈춘다' }).toBe(true);
        const sp = await page.evaluate(() => { const s = window.__ccS; const b = s.getBoundingClientRect();
          for (let y = b.top + 12; y < b.bottom - 12; y += 6) for (let x = b.left + 12; x < b.right - 12; x += 6) { const h = document.elementFromPoint(x, y);
            if (h && s.contains(h) && !h.closest('.sticker-block, .text-block, .asset-block, .frame-block, .shape-block')) return [x, y]; }
          return null; });
        if (!sp) throw new Error('73: 새 섹션에 빈 점이 없다');
        await page.mouse.click(sp[0], sp[1]);
        await page.waitForFunction(() => [...document.querySelectorAll('.sticker-block')].some((e) => !window.__ccBefore.has(e)), null, { timeout: 30000 });   // 문자열 eval 없이(CSP) · 한 장면이 판 전체를 못 잡게 제 시한
        await page.evaluate(() => { if (typeof _cntMode !== 'undefined' && _cntMode) exitCountStickerMode(); window.__ccT = [...document.querySelectorAll('.sticker-block')].filter((e) => !window.__ccBefore.has(e)).pop(); window.deselectAll?.(); });
        await clickEl(page, 'window.__ccT');
      } else if (nn === '75') {
        await page.evaluate(() => window.deselectAll?.());
      }
      /* ★고정 시간 대신 «조건 대기»(지디 261123 — 수지맥 16분 판에서 장면이 시간 안에 못 끝나 못 엶 4) — 패널 HTML 이 rAF 두 번 연속 같을 때까지 */
      await expect.poll(async () => { const a = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => res(document.getElementById('panel-right').innerHTML))));
        const b = await page.evaluate(() => new Promise((res) => requestAnimationFrame(() => requestAnimationFrame(() => res(document.getElementById('panel-right').innerHTML)))));
        return a === b && a.length > 0; }, { timeout: 60000, message: nn + ' 패널이 안 멈춘다' }).toBe(true);
      const c = await count(page);
      return { nn, name, mock: MOCK[nn] || 0, app: c.vis, head: c.head };
}

const ALL = STATES.filter(([nn]) => /^\d\d$/.test(nn));
const GROUP = 8;
const GROUPS = []; for (let k = 0; k < ALL.length; k += GROUP) GROUPS.push(ALL.slice(k, k + GROUP));
const ROWS = [];

GROUPS.forEach((grp, gi) => {
  test(`C91-${String(gi + 1).padStart(2, '0')} ★체크 자리 대조 — 상태 ${grp[0][0]}~${grp[grp.length - 1][0]}(시안 chku ↔ 앱)`, async ({ page }) => {
    test.setTimeout(180000);   // 묶음 하나 = 상태 8 · 장면 대기 시한(30~60초)은 그대로
    await page.setViewportSize({ width: 1500, height: 1100 });
    await bootApp(page);
    const rows = [], errs = [];
    for (const st of grp) {
      try { rows.push(await runState(page, st)); }
      catch (e) { errs.push(st[0] + ' ' + st[1] + ': ' + String(e.message).slice(0, 160)); rows.push({ nn: st[0], name: st[1], mock: MOCK[st[0]] || 0, app: null, head: null }); }
    }
    ROWS.push(...rows);
    const diff = rows.filter((r) => r.app === null || r.app !== r.mock);   // ★대조 = 시안 vs 앱(머리＋ 는 따로 칸 · 지디 C91 1차: 시안은 머리＋ 를 안 셈)
    diff.forEach((r) => console.log('  [C91 어긋남] ' + r.nn + ' ' + r.name + ' 시안 ' + r.mock + ' · 앱 ' + r.app + ' · 머리＋ ' + r.head));
    errs.forEach((e) => console.log('  [C91 못 엶] ' + e));
    expect(errs, '못 연 상태 — 장면 문제(셈 아님)').toEqual([]);
    expect(diff.map((r) => r.nn + ' ' + r.name + ' 시안 ' + r.mock + ' · 앱 ' + r.app), '★91 게이트 — 상태별 시안 chku = 앱 체크').toEqual([]);
  });
});

test('C91-합 ★91 게이트 — 묶음 전부의 앱 체크 합 = 시안 합 · check-census.json', async () => {
  const sum = (k) => ROWS.reduce((t, r) => t + (r[k] || 0), 0);
  const mockAll = ALL.reduce((t, [nn]) => t + (MOCK[nn] || 0), 0);
  const out = { mock: mockAll, app: sum('app'), head: sum('head'), diff: ROWS.filter((r) => r.app === null || r.app !== r.mock), rows: ROWS };
  fs.mkdirSync(path.join(__dirname, '..', '..', 'test-results'), { recursive: true });
  fs.writeFileSync(path.join(__dirname, '..', '..', 'test-results', 'check-census.json'), JSON.stringify(out, null, 1));
  console.log('[C91] 시안 ' + out.mock + ' · 앱 ' + out.app + ' · 머리＋ ' + out.head + ' · 잰 상태 ' + ROWS.length + '/' + ALL.length);
  expect(ROWS.length, '[전제] 모든 묶음이 돌았다(serial)').toBe(ALL.length);
  expect(out.app, '★91 게이트 — 합').toBe(out.mock);
});
