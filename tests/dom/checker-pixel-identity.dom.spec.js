/* checker-pixel-identity.dom.spec.js — 체커 값을 변수로 모은 뒤에도 «화면 픽셀이 한 점도 안 변했다» (S1 선행, 2026-10-04).
 * 골든 = 07d8178b(변수화 전) 에서 찍은 PNG (tests/dom/fixtures/checker-golden/*.png). 지금 판을 같은 방법으로 찍어 «픽셀 수준»으로 대조한다.
 *   찍는 법(골든 갱신): GD1001_ROOT=<07d8178b 체크아웃> CHECKER_SNAP=update npx playwright test --config=tests/dom/playwright.dom.config.js checker-pixel-identity
 *   ⚠️S1 이 «일부러» 체커를 어둡게 하면 이 시험은 빨강이 된다 — 그때 골든을 새 시안 값으로 갈고 이 머리말에 날짜·사유를 적는다(변수 하나를 바꿔 빨강이 되는 것이 «설계»).
 * 자리 9곳: 섹션 투명배경 · 에셋 빈칸 · 아이콘원 · 배너 빈 이미지(작은 쌍) · 그리드 빈 슬롯(작은 쌍) · 표 이미지칸(투명 쌍) ·
 *           확대블럭 배경 · 목업 화면(JS 인라인) · 주석 라벨(JS 인라인) · 도형 SVG 패턴.
 * 전제 단언: 각 자리가 «진짜 체커로 칠해졌는가»(computed 서명)와 «그림에 색이 둘 이상인가» — 빈 화면끼리 같다는 거짓 초록 방지. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const GOLD = path.join(__dirname, 'fixtures', 'checker-golden');
const UPDATE = process.env.CHECKER_SNAP === 'update';
const CLEAR_PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';

const SITES = [
  { id: 'section-sec-bg-empty', sel: '#s1', html: `<div class="section-block sec-bg-empty" id="s1" data-section="1" style="height:200px;width:400px"></div>`, sig: 'bg' },
  { id: 'asset-empty', sel: '#a1', html: `<div class="asset-block" id="a1" style="height:200px;width:400px"></div>`, sig: 'bg' },
  { id: 'icon-circle-empty', sel: '#ic1 .icb-circle', html: `<div class="icon-circle-block" data-type="icon-circle" id="ic1" data-size="160" data-border="none"><div class="icb-circle" style="width:160px;height:160px"></div></div>`, sig: 'bg' },
  { id: 'banner-small-pair', sel: '#b1 .bn2-img-empty', html: `<div class="banner02-block" id="b1"><div class="bn2-img-empty" style="width:200px;height:100px"></div></div>`, sig: 'bg' },
  { id: 'grid-slot-small-pair', sel: '#g1 .grd-img-empty', html: `<div class="grid-block" id="g1"><div class="grd-img-empty" style="width:200px;height:100px"></div></div>`, sig: 'bg' },
  { id: 'table-clear-pair', sel: '#t1 .tbl-img-cell', html: `<div class="table-block" id="t1"><div class="tbl-img-cell" style="width:200px;height:100px"></div></div>`, sig: 'bg' },
  { id: 'zoom-bg', sel: '#z1 .zoom-bg', html: `<div class="zoom-block" id="z1"><div class="zoom-bg" style="width:200px;height:120px"></div></div>`, sig: 'bg' },
  { id: 'cvb-empty', sel: '#c1 .cvb-img-empty', html: `<div class="canvas-block" id="c1"><div class="cvb-img-empty" style="width:200px;height:120px"></div></div>`, sig: 'bg' },
  { id: 'mockup-screen-inline', sel: '#m1 .mkp-screen', html: `<div class="mockup-block" id="m1"><div class="mkp-screen" style="width:200px;height:120px"></div></div>`, sig: 'bg', run: `window.applyMockupScreenImage(document.getElementById('m1'), '${CLEAR_PNG}')` },
  { id: 'annot-label-inline', sel: '#an1', html: `<div id="an1"></div>`, sig: 'child-bg', run: `document.getElementById('an1').innerHTML = window._renderAnnotLabelInner('image', { text: '', labelImageSrc: '', labelImageSize: 40, labelImageRadius: 0 })` },
  { id: 'shape-svg-pattern', sel: '#sh1', html: `<div class="shape-block" id="sh1" data-shape-type="rectangle" data-shape-fill="image" style="position:relative;width:800px;height:480px"><svg class="shape-svg" viewBox="0 0 100 60" preserveAspectRatio="none" style="width:100%;height:100%"><rect x="0" y="0" width="100" height="60" fill="currentColor"/></svg></div>`, sig: 'fill', inCanvas: true },
];

async function diffPng(page, aB64, bB64) {
  return page.evaluate(async ([a, b]) => {
    const load = async (s) => { const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const g = c.getContext('2d'); g.drawImage(i, 0, 0); return g.getImageData(0, 0, i.width, i.height); };
    const A = await load(a), B = await load(b);
    if (A.width !== B.width || A.height !== B.height) return { size: [A.width, A.height, B.width, B.height], diff: -1, colors: 0 };
    let diff = 0; const seen = new Set();
    for (let i = 0; i < A.data.length; i += 4) {
      if (A.data[i] !== B.data[i] || A.data[i + 1] !== B.data[i + 1] || A.data[i + 2] !== B.data[i + 2] || A.data[i + 3] !== B.data[i + 3]) diff++;
      seen.add((A.data[i] << 16) | (A.data[i + 1] << 8) | A.data[i + 2]);
    }
    return { size: [A.width, A.height], diff, colors: seen.size };
  }, [aB64, bB64]);
}

test('CP 체커 자리 전부 — 변수화 전(골든)과 «0 픽셀» 다르다', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await bootApp(page);
  // 앱 CSS 가 «다 얹힌» 문서에 격리 무대를 만든다(앱 CSS 를 그대로 먹는다 — 한 환경에서만 참인 검사 방지).
  await page.evaluate(() => { const st = document.createElement('div'); st.id = 'ck-stage'; st.style.cssText = 'position:fixed;left:0;top:0;width:1100px;height:880px;background:#fff;z-index:99999;padding:20px;display:flex;flex-direction:column;gap:20px;overflow:auto'; document.body.appendChild(st); });
  const report = [];
  for (const s of SITES) {
    /* 도형 체커 규칙은 `#canvas .shape-block…` 로 «캔버스 안»에만 선다 — 그 자리 무대는 #canvas «안, 흐름 속»에 둔다(fixed 로 두면 캔버스 배율·잘림에 가려 빈 흰 그림이 찍혔다 — 핀에서도 단색이라 전제 단언이 잡았다). */
    await page.evaluate(([html, run, inCanvas]) => {
      let st = document.getElementById('ck-stage');
      st.style.display = inCanvas ? 'none' : 'flex';   // 위에 뜬 흰 무대가 캔버스 안 자리를 «덮지» 않게
      const old = document.getElementById('ck-stage-c'); if (old && !inCanvas) old.remove();
      if (inCanvas) { st = document.getElementById('ck-stage-c') || Object.assign(document.createElement('div'), { id: 'ck-stage-c' }); st.style.cssText = 'background:#fff;padding:20px;width:900px'; const cv = document.getElementById('canvas'); cv.insertBefore(st, cv.firstChild); st.scrollIntoView(); }
      st.innerHTML = html; if (run) (0, eval)(run);
    }, [s.html, s.run || '', !!s.inCanvas]);
    await page.waitForTimeout(80);
    // 전제 ① 진짜 체커로 칠해졌다
    const sig = await page.evaluate(([sel, kind]) => {
      let el = document.querySelector(sel); if (!el) return 'MISSING';
      if (kind === 'child-bg') el = el.firstElementChild;
      const cs = getComputedStyle(kind === 'fill' ? el.querySelector('rect') : el);
      return kind === 'fill' ? cs.fill : cs.backgroundImage;
    }, [s.sel, s.sig]);
    if (s.sig === 'fill') expect(sig, `${s.id} 전제 — 도형 면이 패턴 fill`).toContain('goya-shape-checker');
    else expect(sig, `${s.id} 전제 — 체커 서명`).toMatch(/repeating-conic-gradient/);
    const el = await page.$(s.sel);
    expect(el, `${s.id} 전제 — 요소가 있다`).not.toBeNull();
    const shot = (await (s.sig === 'child-bg' ? (await page.$(s.sel + ' > *')) : el).screenshot()).toString('base64');
    const gp = path.join(GOLD, s.id + '.png');
    if (UPDATE) { fs.writeFileSync(gp, Buffer.from(shot, 'base64')); report.push(`${s.id}: golden written`); continue; }
    expect(fs.existsSync(gp), `${s.id} 골든이 있다(${gp})`).toBe(true);
    const r = await diffPng(page, fs.readFileSync(gp).toString('base64'), shot);
    expect(r.colors, `${s.id} 전제 — 그림에 색이 둘 이상(빈 그림끼리 같다는 거짓 초록 방지)`).toBeGreaterThanOrEqual(2);
    report.push(`${s.id}: ${r.size.join('x')} diff=${r.diff} colors=${r.colors}`);
    expect.soft(r.diff, `${s.id} 다른 픽셀 수`).toBe(0);   // soft — 한 자리가 틀려도 «어느 자리들이» 틀렸는지 전부 보인다
  }
  console.log('[checker-pixel]\n' + report.join('\n'));
  expect(errs, '페이지 오류 0').toEqual([]);
});
