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
 *   X7 ★높이도 내보내기 폭을 따라 줄어든다(2026-09-21 현빈 결정 — 옛 «기록»을 갈아끼웠다)
 *
 * ★★이 스펙이 재는 축을 «사용자 증상»으로 읽지 말 것 (2026-09-20 실앱 재검증)
 *   위 X1~X5 가 재는 것은 «블록이 섹션 상자 밖으로 나갔나»(레이아웃 축) 하나다. 그 축은 0 이 맞다.
 *   그런데 현빈 신고문(「좌우 40px 잘린다」)의 축은 «그림 내용이 남았나»(픽셀 축)다.
 *   실앱(9501·줌40%·prepareCloneForCapture 진짜 호출) 실측:
 *     · 고치기 전 780 → 블록이 상자 밖으로 좌 40 / 우 40      · 고친 뒤 → 0 / 0   ← 이 스펙의 축
 *     · 그런데 «내보낸 PNG 픽셀»은 고치기 전·후가 «같다» — 그림 양끝 마커가 둘 다 사라진다.
 *   기전이 «둘»이고 둘 다 40 을 내놓기 때문이다 (표시폭 860 · 내보내기 780 기준):
 *     ㉠ 고친 문 — 블록이 860px 로 굳어 780 캔버스 밖으로 (860−780)/2 = 40 씩 나갔다.
 *     ㉡ 안 고친 문 — 높이가 절대 px 로 잠겨 있다(applyAspectSync). 폭만 780 으로 줄면
 *        상자 비율이 그림 비율보다 «좁아져» object-fit:cover 가 (860−780)/2 = 40 씩 깎는다.
 *   ㉡ 은 스크래치 드롭이 만든 게 «아니다» — 패널로 만든 보통 풀블리드 에셋
 *     (prop-page.applyAssetFullBleed + 높이 px)도 780 에서 똑같이 40 씩 깎인다(실측 확인).
 *     = 「내보내기는 클론 «폭만» 바꾼다」라는 레포 기준선의 결과다.
 *   ⇒ ㉡ 은 **2026-09-21 현빈 결정으로 닫혔다** — 「780되게끔 줄이는 걸로」(자르지 말고 축소).
 *     고친 자리 = js/io/export-image.js syncImageBoxesToCaptureWidth (클론에서 그림 상자의
 *     «비율»을 화면과 같게 다시 잠근다). 아래 X7 이 그 뜻을 지킨다.
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
.section-inner{padding-left:32px;padding-right:32px;min-height:400px;display:block;}
/* ★2026-09-22(T-011): 우측 패널을 «흐름에서 뺀다» — 실앱(position:fixed 우측 240px)과 같은 모양.
   옛 하네스는 #panel-right 를 body 맨 위 «흐름»에 뒀다. 그래서 패널이 길어지는 만큼 캔버스가
   아래로 밀리고, 드롭 지점이 뷰포트(720) 밖으로 나가면 elementFromPoint 가 null 을 주어
   commitScratchDropAt 이 decision 'none' 으로 false 를 돌려준다 = «드롭이 안 된» 것처럼 보인다.
   실측: 패널 높이 621px(여유 99px) → 배경 절 한 개 늘자 753px → 드롭점 y=811 > 720 → 거짓 빨강.
   ⛔이 검사가 재는 것은 «내보내기 폭»이지 패널 높이가 아니다. 그 둘을 붙여 두면 패널에 줄 하나
     더하는 사람마다 여기서 영문 모를 빨강을 만난다. ⇒ 좌표를 패널 높이와 떼어 놓는다. */
#panel-right{position:fixed;right:0;top:0;width:240px;height:100%;overflow:auto;}</style></head><body>
<div id="panel-right"><div class="panel-body"></div></div>
<div id="canvas-wrap"><div id="canvas-scaler">
  <div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner" data-padding-x="32"></div></div></div>
  <div class="scratch-item" id="sp" style="position:absolute;left:900px;top:0;width:220px;">
    <img src="${PX}" style="display:block;width:100%;height:auto;"></div>
</div></div>
<script type="module">
  import { commitScratchDropAt } from '/js/canvas-scratch-drop.js';
  import { showAssetProperties } from '/js/props/prop-asset.js';
  /* ★2026-09-21 — 내보내기 «흉내»를 걷어내고 진짜 함수를 부른다.
     현빈 결정(「780되게끔 줄이는 걸로」)으로 내보내기가 «폭만» 바꾸는 게 아니라
     그림 상자의 세로도 같이 줄이게 됐다(export-image.js syncImageBoxesToCaptureWidth).
     흉내 한 줄로는 그 절반만 재게 돼 X7 이 «낡은 기록»이 된다. */
  import { prepareCloneForCapture } from '/js/io/export-image.js';
  window.__commit = commitScratchDropAt;
  window.__open = showAssetProperties;
  window.__prep = prepareCloneForCapture;
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
const dropAndExport = (page, want, exportW) => page.evaluate(async ({ want, exportW, PX }) => {
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

  /* ★내보내기 «그 자체» — 흉내가 아니라 js/io/export-image.js prepareCloneForCapture 를 부른다. */
  const sec = document.getElementById('sec');
  const clone = await window.__prep(sec, exportW, false);

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
    blockH: +cr.height.toFixed(1),
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

  /* X7 ★기록(record) → ★2026-09-21 «결정이 났다»로 갱신.
     옛 기록(2026-09-20): 「폭은 내보내기를 따라가는데 높이는 절대 px 로 잠겨 있어 cover 가
     ㉠ 과 똑같은 40px 을 깎는다 — 줄일지 자를지는 현빈 결정 사안」.
     현빈 결정: **「780되게끔 줄이는 걸로」** = 자르지 말고 폭에 맞춰 축소, 세로도 비율대로.
     ⇒ 이제 높이도 따라 줄어야 한다(js/io/export-image.js syncImageBoxesToCaptureWidth).
       픽셀 축(비율·cover 가 깎는 양)의 전수 증명은 tests/dom/export-width-scale-down.dom.spec.js. */
  test('X7 ★높이도 내보내기 폭을 따라 줄어든다 — cover 가 더 깎지 않는다 (현빈 결정 2026-09-21)', async ({ page }) => {
    const at860 = await dropAndExport(page, 860, 860);
    const at780 = await dropAndExport(page, 860, 780);
    // ㉠ — 상자 밖으로는 한 픽셀도 안 나간다
    expect(at780.cutLeft).toBe(0);
    expect(at780.cutRight).toBe(0);
    // ㉡ — 높이가 «폭이 줄어든 만큼» 같이 줄었다
    expect(at780.blockH, `780 높이 ${at780.blockH} / 860 높이 ${at860.blockH} — 세로가 안 따라갔다`)
      .toBeCloseTo(at860.blockH * (780 / 860), 0);
    // 그래서 cover 가 깎는 양 = 0 (그려지는 폭 = 상자 폭)
    const drawnW = at780.blockH * (440 / 330);
    const cropEachSide = (drawnW - at780.blockW) / 2;
    expect(cropEachSide, `cover 가 좌우 ${cropEachSide.toFixed(1)}px 씩 깎는다`).toBeCloseTo(0, 0);
  });

  test('X5 가드 — 편집 화면(860)에서 보이던 폭은 그대로다 (스크래치 계약 불변)', async ({ page }) => {
    expect((await dropAndExport(page, 220, 860)).liveW).toBeCloseTo(220, 0);
    expect((await dropAndExport(page, 830, 860)).liveW).toBeCloseTo(830, 0);
    expect((await dropAndExport(page, 860, 860)).liveW).toBeCloseTo(860, 0);
  });
});
