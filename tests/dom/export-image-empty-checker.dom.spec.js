/* export-image-empty-checker.dom.spec.js — «빈 이미지 칸 체크무늬»가 내보내기 결과물에 박히는 자리.
 *   (2026-09-20 사용자 관점 훑기 → 유닛 exportvisual)
 *
 * ★재현(고치기 전, 실측 2026-09-21 · 실앱 9525 · 860×1399 export PNG):
 *     asset-block 영역 770px 띠 → #F0F0F0 322,080px + #D8D8D8 322,060px
 *     배너 이미지칸 250×230    → #E3E3E3  19,963px + #EFEFEF  19,962px
 *   스크린샷: $SP/h0920b/ulexp-BEFORE-AB-export.png
 *
 * ★왜 안 걸러졌나 — 「체커를 CSS 클래스에 두면 자동으로 결과물에 안 나간다」는 공식
 *   (css/editor-blocks.css [M38-b] 주석)은 «단독 HTML 내보내기»에만 맞다. 그 경로는
 *   export-html.js 가 앱 CSS 를 안 싣는다. PNG 경로는 반대다 — export-image.js
 *   prepareCloneForCapture 가 클론을 document.body 에 «붙여서» 찍으므로 앱 CSS 가 다 먹는다.
 *   ⇒ CSS 로 옮기는 것만으로는 PNG 가 안 고쳐진다. 별도 걷기(neutralizeEmptyImageCheckerForCapture)가 필요하다.
 *
 * 여기서 재는 것:
 *   N0 ★음성대조 — 걷기 «전» 클론에서 체커가 실제로 computed 로 잡힌다(계측기가 뭔가를 보고 있다).
 *   T1 빈 칸 전수 — asset / cvb / icb / banner 넷 다 걷힌 뒤 체커가 0건.
 *   T2 ★양성대조 — 목업 화면의 «진짜 이미지 레이어»는 그대로 남는다(체커만 빠진다).
 *   T3 진짜 그림은 안 건드린다 — 이미지가 들어간 배너의 url(...) 이 그대로.
 *   T4 라이브 DOM 불변 — 클론만 바뀐다.
 *   T5 splitBgLayers — gradient 안의 콤마에 안 속는다(단위).
 *
 * ⛔앱을 «안» 띄운다 — index.html + 레포 파일만 크로미움에 얹는다(banner02-overflow-hint 하네스 그대로).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js export-image-empty-checker
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* 1×1 PNG — «진짜 이미지 레이어»가 살아남는지 보는 양성대조용. */
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script type="module">
  import '/js/blocks/banner02-block.js';
  import { neutralizeEmptyImageCheckerForCapture, splitBgLayers } from '/js/io/capture-safety.js';
  window.__neutralize = neutralizeEmptyImageCheckerForCapture;
  window.__split = splitBgLayers;
  window.__ready = true;
</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 섹션 하나에 «빈 칸 4종 + 목업(진짜 이미지 위에 체커 안전망) + 그림 넣은 배너»를 담는다.
   @param run 'none' = 걷지 않는다(음성대조) · 'strip' = 걷는다 */
const probe = (page, run, px) => page.evaluate(({ run, px }) => {
  const host = document.querySelector('#canvas') || document.body;
  host.innerHTML = '';
  const sec = document.createElement('div');
  sec.className = 'section-block';
  sec.id = 'sec1';
  sec.innerHTML = `
    <div class="asset-block" id="ab"></div>
    <div class="canvas-block" id="cvb"><div class="cvb-img-empty" id="cvbimg" style="width:80px;height:80px"></div></div>
    <div class="icon-circle-block" id="icb"><div class="icb-circle" id="icbc"></div></div>
    <div class="mockup-block" id="mkp"><div class="mkp-screen" id="mkps" style="width:100px;height:100px;background:url('${px}') top center / cover no-repeat, repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px"></div></div>`;
  host.appendChild(sec);

  // 진짜 배너 둘 — ⑴ 이미지 없음(체커) ⑵ 이미지 있음(양성대조)
  const mk = (withImg) => {
    const { row, block } = window.makeBanner02Block({});
    if (withImg) block.dataset.imgSrc = px;
    sec.appendChild(row);
    window.renderBanner02(block);
    return block;
  };
  const bnEmpty = mk(false); bnEmpty.id = 'bnEmpty';
  const bnImg   = mk(true);  bnImg.id   = 'bnImg';

  const clone = sec.cloneNode(true);
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:860px;';
  document.body.appendChild(clone);
  clone.getBoundingClientRect();
  let n = -1;
  if (run === 'strip') n = window.__neutralize(clone);

  const bgOf = (sel) => {
    const el = clone.querySelector(sel);
    if (!el) return '__MISSING__';
    return window.getComputedStyle(el).backgroundImage || '';
  };
  const has = (s) => /repeating-conic-gradient/i.test(s);
  const out = {
    touched: n,
    asset:  bgOf('#ab'),
    cvb:    bgOf('#cvbimg'),
    icb:    bgOf('#icbc'),
    bn2:    bgOf('#bnEmpty .bn2-img'),
    mockup: bgOf('#mkps'),
    bn2img: bgOf('#bnImg .bn2-img'),
    checkerCount: [...clone.querySelectorAll('*')].filter(el =>
      has(window.getComputedStyle(el).backgroundImage || '')).length,
    // 라이브(클론 아님) 쪽은 그대로여야 한다
    liveAsset: window.getComputedStyle(document.getElementById('ab')).backgroundImage,
    liveBn2:   window.getComputedStyle(document.querySelector('#bnEmpty .bn2-img')).backgroundImage,
  };
  out.flags = {
    asset: has(out.asset), cvb: has(out.cvb), icb: has(out.icb), bn2: has(out.bn2),
    mockup: has(out.mockup), bn2img: has(out.bn2img),
  };
  out.url = { mockup: /url\(/.test(out.mockup), bn2img: /url\(/.test(out.bn2img) };
  clone.remove();
  return out;
}, { run, px });

test('N0 ★음성대조 — 걷기 «전» 클론에서 체커가 실제로 잡힌다(계측기가 뭔가를 보고 있다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'none', PX);
  console.log('  N0:', { flags: r.flags, checkerCount: r.checkerCount });
  expect(r.flags, '★여기서 false 가 나오면 아래 T1 은 아무것도 증명하지 못한다').toEqual({
    asset: true, cvb: true, icb: true, bn2: true, mockup: true, bn2img: false,
  });
  expect(r.checkerCount, '걷기 전에는 체커를 가진 요소가 여럿 있다').toBeGreaterThanOrEqual(5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T1 빈 이미지 칸 전수 — 걷힌 뒤 클론에 체커가 한 건도 없다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'strip', PX);
  console.log('  T1:', { touched: r.touched, checkerCount: r.checkerCount, mockup: r.mockup.slice(0, 60) });
  expect({ asset: r.flags.asset, cvb: r.flags.cvb, icb: r.flags.icb, bn2: r.flags.bn2 })
    .toEqual({ asset: false, cvb: false, icb: false, bn2: false });
  expect(r.checkerCount, '어디든 체커가 남으면 그 자리가 PNG 에 찍힌다').toBe(0);
  expect(r.touched, '손댄 요소 수가 0 이면 함수가 아무 일도 안 한 것이다').toBeGreaterThanOrEqual(5);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 ★양성대조 — 목업 화면의 «진짜 이미지 레이어»는 살아남는다(체커만 뺀다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'strip', PX);
  console.log('  T2 mockup bg:', r.mockup);
  expect(r.flags.mockup, '목업의 체커 안전망은 빠져야 한다').toBe(false);
  expect(r.url.mockup,
    '★background-image 를 통째로 none 으로 박으면 실사용 목업 화면이 사라진다 — 레이어 보존 실패')
    .toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 그림이 들어간 배너는 안 건드린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'strip', PX);
  expect(r.url.bn2img, '이미지가 들어간 배너의 url(...) 이 사라졌다').toBe(true);
  expect(r.flags.bn2img).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 라이브 캔버스는 안 건드린다 — 클론만 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'strip', PX);
  expect(/repeating-conic-gradient/i.test(r.liveAsset), '라이브 에셋 블록의 체커가 사라졌다').toBe(true);
  expect(/repeating-conic-gradient/i.test(r.liveBn2), '라이브 배너의 체커가 사라졌다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T5 splitBgLayers — gradient «안»의 콤마에 안 속는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(() => ({
    two: window.__split('url("a.png"), repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px').length,
    one: window.__split('linear-gradient(90deg, rgba(1,2,3,0.5) 0%, #fff 100%)').length,
    zero: window.__split('none').length,
  }));
  expect(r, '레이어를 잘못 쪼개면 남길 것을 지우거나 지울 것을 남긴다').toEqual({ two: 2, one: 1, zero: 1 });
});
