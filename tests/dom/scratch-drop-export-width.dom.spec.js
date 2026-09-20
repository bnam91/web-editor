/* scratch-drop-export-width.dom.spec.js — 「스크래치로 넣은 그림이 780px(쿠팡) 내보내기에서 잘리는가」.
 *
 * ★신고 (2026-09-20 최종 통합 라운드, QA high)
 *   780px 내보내기에서 스크래치 드롭 이미지가 «좌우 40px 씩» 잘린다. 860px 에서는 멀쩡하다.
 *
 * ★기전 (이 스펙이 재는 것)
 *   내보내기는 섹션을 통째로 복제하고 «클론의 폭만» 바꾼다 —
 *     js/io/export-image.js prepareCloneForCapture: `clone.style.cssText += ';…width:' + w + 'px;…'`
 *   그래서 폭이 «상대값»(calc(100% + …) / %)인 것은 따라 줄고, «절대 px»인 것은 안 줄어든다.
 *   스크래치 드롭(canvas-scratch-drop.js applyScratchWidth)은 넘침 밴드에서도 절대 px 를 박았다:
 *     860 캔버스 · padX=p → 콘텐츠폭 860−2p · 박힌 폭 860px · 좌우 마진 −p
 *   780 클론에서 이 블록의 «바깥 크기»는 860−2p 로 그대로인데 쓸 수 있는 폭은 780−2p 라
 *     넘침 = (860−2p) − (780−2p) = 80 → align-self:center 라 좌우로 40 씩. ★padX 와 무관하게 40 이다.
 *   ⇒ 같은 자리의 «레포 관용구»는 이미 상대값이다(prop-page.js applyPadXToSection·applyAssetFullBleed,
 *     block-factory.applyExcludePadX 전부 `calc(100% + 2·padX)` + 음수마진 세트).
 *
 * ★무엇을 재나 — 「섹션 상자 밖으로 얼마나 나갔나」를 내보내기 폭 780·860 «양쪽»에서
 *   X1 860 에서는 안 잘린다 (양쪽 밴드 모두) — 신고가 「780 에서만」이라는 것의 대조
 *   X2 ★780 에서 «꽉 채운» 밴드가 좌우 40 씩 잘린다 → 고치면 0
 *   X3 ★780 에서 «중간» 밴드(콘텐츠폭 < 표시폭 < 섹션폭)도 잘린다 → 고치면 0
 *   X4 음성대조 — 작은 그림(220px, 넘침 없음)은 원래도 안 잘린다 (절대 px 가 «다 나쁜 게» 아니다)
 *   X5 가드 — 고친 뒤에도 «860 편집 화면»에서 보이던 폭은 그대로다 (스크래치 계약 불변)
 *
 * ⛔앱을 «안» 띄운다 — page.route 로 레포를 가짜 origin 에 얹어 진짜 모듈을 import 한다.
 * ⚠️내보내기 «폭 바꾸기» 한 줄은 여기서 흉내 낸다(export-image.js 는 html2canvas·CDP 를 끌고 와
 *   DOM 하네스에 못 얹는다). 그 한 줄이 실제로 그 모양인지는
 *   tests/unit/scratch-drop-export-width.test.mjs 가 소스에서 «따로» 지킨다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js scratch-drop-export-width
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"><link rel="stylesheet" href="/css/editor-layout.css">
<style>#canvas-scaler{position:relative;width:860px;min-height:900px;}#canvas{width:860px;}
.section-block{position:relative;background:#fff;}
.section-inner{padding-left:32px;padding-right:32px;min-height:400px;display:block;}</style></head><body>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="canvas-wrap"><div id="canvas-scaler">
  <div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner" data-padding-x="32"></div></div></div>
  <div class="scratch-item" id="sp" style="position:absolute;left:900px;top:0;width:220px;">
    <img src="${PX}" style="display:block;width:100%;height:auto;"></div>
</div></div>
<script type="module">
  import { commitScratchDropAt } from '/js/canvas-scratch-drop.js';
  import { showAssetProperties } from '/js/props/prop-asset.js';
  window.__commit = commitScratchDropAt;
  window.__open = showAssetProperties;
  window.getBlockBreadcrumb = () => ''; window.setRpIdBadge = () => {};
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx === 'true';
  window.pushHistory = () => {}; window.scheduleAutoSave = () => {};
  window.applyAssetFullBleed = (ab) => { ab.style.width=''; ab.style.marginLeft=''; ab.style.marginRight=''; };
  window.state = { pageSettings: { padX: 32 } };
  window.makeAssetBlock = () => {
    const row=document.createElement('div'); row.className='row'; row.dataset.layout='stack'; row.id='row_t';
    const ab=document.createElement('div'); ab.className='asset-block'; ab.id='ab_t';
    ab.dataset.align='center'; ab.dataset.overlay='false'; ab.style.alignSelf='center';
    ab.innerHTML='<div class="asset-overlay"></div>'; row.appendChild(ab); return {row,block:ab};
  };
  window.setAssetImageFromSrc = (ab,src)=>{ ab.classList.add('has-image'); ab.dataset.imgSrc=src;
    ab.innerHTML='<div class="asset-img-clip"><img class="asset-img" src="'+src+'" style="width:100%;height:100%;object-fit:cover"></div>'; };
  window.bindBlock=()=>{}; window.buildLayerPanel=()=>{}; window.triggerAutoSave=()=>{};
  window.applyPadXToSection=(inner,px)=>{ inner.style.paddingLeft=px?px+'px':''; inner.style.paddingRight=px?px+'px':''; };
  window.getDragAfterElement=()=>null;
  window.__ready=true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 스크래치 아이템을 표시폭 `want` 로 섹션에 떨어뜨린 뒤,
 *  내보내기와 «같은 방식»으로 섹션을 복제해 폭 exportW 로 두고 삐져나간 양을 잰다. */
const dropAndExport = (page, want, exportW) => page.evaluate(({ want, exportW, PX }) => {
  document.getElementById('sp').style.width = want + 'px';
  const inner = document.getElementById('inner');
  inner.innerHTML = '';
  const seed = document.createElement('div');
  seed.className = 'row'; seed.dataset.layout = 'stack';
  seed.style.height = '100px'; seed.style.background = '#eee';
  inner.appendChild(seed);
  const sr = seed.getBoundingClientRect();
  const scratchW = document.getElementById('sp').getBoundingClientRect().width;
  const ok = window.__commit(sr.left + sr.width / 2, sr.top + sr.height / 2, PX,
    { naturalWidth: 440, naturalHeight: 330, width: scratchW });
  const live = document.getElementById('ab_t');
  const liveW = live ? +live.getBoundingClientRect().width.toFixed(1) : null;

  /* ★내보내기가 하는 그 한 줄 — js/io/export-image.js prepareCloneForCapture 와 같은 꼴.
     (라벨·툴바 제거 같은 나머지는 이 측정과 무관해 생략한다.) */
  const sec = document.getElementById('sec');
  const clone = sec.cloneNode(true);
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + exportW + 'px;margin:0;';
  document.body.appendChild(clone);
  clone.getBoundingClientRect();

  const cab = clone.querySelector('#ab_t');
  const cr = cab.getBoundingClientRect();
  const sr2 = clone.getBoundingClientRect();
  const out = {
    committed: ok,
    scratchW: +scratchW.toFixed(1),
    liveW,
    inline: cab.getAttribute('style'),
    exportSecW: +sr2.width.toFixed(1),
    blockW: +cr.width.toFixed(1),
    // «섹션 상자 밖으로» 나간 양 — 내보내기 캔버스는 딱 섹션폭이라 이만큼이 그대로 잘린다
    cutLeft:  +Math.max(0, sr2.left - cr.left).toFixed(1),
    cutRight: +Math.max(0, cr.right - sr2.right).toFixed(1),
  };
  clone.remove();
  return out;
}, { want, exportW, PX });

test.describe('스크래치 드롭 이미지가 내보내기 폭을 따라가는가', () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test('X1 860 내보내기에서는 두 밴드 다 안 잘린다 (신고가 «780 에서만»이라는 것의 대조)', async ({ page }) => {
    const full = await dropAndExport(page, 860, 860);
    expect(full.committed).toBe(true);
    expect(full.cutLeft, `860 인데 좌측이 ${full.cutLeft} 잘렸다`).toBe(0);
    expect(full.cutRight, `860 인데 우측이 ${full.cutRight} 잘렸다`).toBe(0);
    const mid = await dropAndExport(page, 830, 860);
    expect(mid.cutLeft).toBe(0);
    expect(mid.cutRight).toBe(0);
  });

  test('X2 ★780 내보내기 — «꽉 채운» 밴드가 안 잘린다 (고치기 전: 좌우 40 씩)', async ({ page }) => {
    const r = await dropAndExport(page, 860, 780);
    expect(r.committed).toBe(true);
    expect(r.exportSecW, '하네스 전제 — 내보내기 폭').toBe(780);
    expect(r.cutLeft,  `좌측 ${r.cutLeft}px 잘림 (inline: ${r.inline})`).toBe(0);
    expect(r.cutRight, `우측 ${r.cutRight}px 잘림 (inline: ${r.inline})`).toBe(0);
    // 꽉 채운 밴드는 내보내기 폭을 «그대로» 채워야 한다
    expect(r.blockW, `블록 폭 ${r.blockW} vs 내보내기 폭 780`).toBeCloseTo(780, 0);
  });

  test('X3 ★780 내보내기 — «중간» 밴드(830)도 안 잘린다', async ({ page }) => {
    const r = await dropAndExport(page, 830, 780);
    expect(r.cutLeft,  `좌측 ${r.cutLeft}px 잘림 (inline: ${r.inline})`).toBe(0);
    expect(r.cutRight, `우측 ${r.cutRight}px 잘림 (inline: ${r.inline})`).toBe(0);
    /* 830 은 콘텐츠폭(796)을 17 씩 넘겨 좌우 패딩을 «17 씩» 먹은 것이다.
       780 에서도 그 뜻이 유지되면 = 좌우 여백 (32−17)=15 씩 남는다 ⇒ 폭 780−30 = 750. */
    expect(r.blockW, `블록 폭 ${r.blockW}`).toBeCloseTo(750, 0);
  });

  test('X4 음성대조 — 작은 그림(220)은 원래도 안 잘린다', async ({ page }) => {
    const r = await dropAndExport(page, 220, 780);
    expect(r.cutLeft).toBe(0);
    expect(r.cutRight).toBe(0);
    expect(r.blockW, '넘침 없는 밴드는 «보이던 폭» 그대로여야 한다').toBeCloseTo(220, 0);
  });

  test('X6 ★상대폭으로 바꿔도 우측패널은 «화면과 같은 말»을 한다 (830 을 860 이라 하지 않는다)', async ({ page }) => {
    /* ⚠️이 검사가 없으면 위 고침이 «다른 거짓말»을 만든다 —
       readW 가 calc() 를 못 읽으면 parseInt 가 NaN → 폴백 860 이라, 830 짜리 블록의 패널이
       860 을 띄우고 슬라이더를 건드리는 순간 풀블리드로 튄다. */
    for (const want of [220, 830, 860]) {
      await dropAndExport(page, want, 860);
      const v = await page.evaluate(() => {
        window.__open(document.getElementById('ab_t'));
        return { n: document.getElementById('asset-w-number').value,
                 s: document.getElementById('asset-w-slider').value,
                 real: Math.round(document.getElementById('ab_t').offsetWidth) };
      });
      expect(Number(v.n), `표시폭 ${want} — 패널 숫자칸 ${v.n} / 실제 ${v.real}`).toBe(v.real);
      expect(Number(v.s), `표시폭 ${want} — 슬라이더 ${v.s} / 실제 ${v.real}`).toBe(v.real);
    }
  });

  test('X5 가드 — 편집 화면(860)에서 보이던 폭은 그대로다 (스크래치 계약 불변)', async ({ page }) => {
    expect((await dropAndExport(page, 220, 860)).liveW).toBeCloseTo(220, 0);
    expect((await dropAndExport(page, 830, 860)).liveW).toBeCloseTo(830, 0);
    expect((await dropAndExport(page, 860, 860)).liveW).toBeCloseTo(860, 0);
  });
});
