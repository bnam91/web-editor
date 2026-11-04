/* image-inlet-asset.dom.spec.js — BIG-IMAGE-INSERT-RENDERER-OOM-01 · 사람이 큰 그림을 넣는 입구가 data URL 대신 자산 URL 을 넣는지의 자.
 * 자산 IPC 는 스텁이다. 입구마다 진짜 파일 창(filechooser)을 거친다. 앱 RSS·다시 열기는 앱 측정값(회신)에 있다.
 * ⛔이 자가 안 재는 것: 렌더러 메모리 · goya-asset 프로토콜로 실제 그림이 뜨는지.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAEBgIApD5fRAAAAABJRU5ErkJggg==', 'base64');
/* add = 블럭 만들기, sel = 그 블럭, open = 그 입구의 파일 창 열기(b = 블럭) */
const INLETS = {
  '글 아이콘 사진': { add: () => window.addIconTextBlock(), sel: '.icon-text-block', open: async (b) => { b.querySelector('.itb-icon').click(); document.querySelector('[data-ifg-upload]').click(); } },
  '표 칸 빈 슬롯': { add: () => window.addGridBlock({ cols: [{ width: 1, lines: [{ type: 'image', imgSrc: '' }] }] }), sel: '.grid-block', dbl: '.grd-img-empty[data-line]' },
  '섹션 배경': { open: async (b) => { window.showSectionProperties(b); document.getElementById('sec-bg-img-btn').click(); } },
  '프레임 배경': { add: () => window.addFrameBlock(), sel: '.frame-block:not([data-text-frame])', open: async (b) => { window.showFrameProperties(b); document.getElementById('ss-bg-img-btn').click(); } },
  '목업 화면': { add: () => window.addDeviceMockupBlock('iphone'), sel: '.mockup-block', open: async (b) => { window.showMockupProperties(b); document.querySelector('#mkp-upload-btn').click(); } },
  '비교 행': { add: () => window.addComparisonBlock(), sel: '.comparison-block', open: async (b) => { window.cmpPickRowImage(b, 0, 0); } },
  '배너02': { add: () => window.addBanner02Block(), sel: '.banner02-block,.bn2-block,[data-block-type="banner02"]', open: async (b) => { window.showBanner02Properties(b); document.querySelector('#bn2-img-upload').click(); } },
  '모달 배경': { add: () => window.addModalBlock(), sel: '.modal-block', open: async (b) => { window.showModalProperties(b); document.getElementById('mdl-bg-img-btn').click(); } },
  '심플 카드 패널': { add: () => window.addCanvasBlock({ cardMode: 'simple' }), sel: '.canvas-block', open: async (b) => { window.showSimpleCardProperties(b); document.querySelector('.cvb-card-img-btn').click(); } },
  '카드 캔버스': { add: () => window.addCanvasBlock(), sel: '.canvas-block', open: async (b) => { window._triggerCvbCardImage(b, 0); } },
  '캔버스 레이어': { add: () => window.addCanvasBlock({ layers: [{ type: 'image', src: '', x: 0, y: 0, w: 300, h: 200 }] }), sel: '.canvas-block', open: async (b) => { window.showCanvasProperties(b); document.querySelector('.cvb-img-upload-btn').click(); } },
};

async function put(page, name, saved) {
  const it = INLETS[name];
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.route('**/__asset/**', (r) => r.fulfill({ contentType: 'image/png', body: PNG }));
  await page.evaluate(async ([saved, add, sel]) => {
    window.activeProjectId = 'p1';
    window.electronAPI = { ...(window.electronAPI || {}), assetsSaveCanvasImage: async () => (saved ? { ok: true, url: `${location.origin}/__asset/h.png` } : { ok: false }) };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec);
    window.__b = sec;
    if (add) { await (0, eval)(`(${add})`)(); window.__b = [...c.querySelectorAll(sel)].pop(); }
    window.__b.scrollIntoView({ block: 'center' });
  }, [saved, it.add && it.add.toString(), it.sel]);
  const chooser = page.waitForEvent('filechooser');
  /* 하네스의 main 잠금이 가끔 캔버스 마우스를 막는다(thumb-gutter-defer-165 주석) — 잴 축은 파일 창 뒤 값이라 이벤트를 슬롯에 바로 준다. 진짜 마우스는 앱 런 값. */
  if (it.dbl) await page.evaluate((sel) => window.__b.querySelector(sel).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), it.dbl);
  else await page.evaluate(async (open) => { await (0, eval)(`(${open})`)(window.__b); }, it.open.toString());
  await (await chooser).setFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => /base64,|\/__asset\//.test(document.getElementById('canvas').innerHTML));
  return { errs, html: await page.evaluate(() => document.getElementById('canvas').innerHTML) };
}

/* 자산 저장을 기다리는 사이 대상이 떨어진다(탭 전환이 캔버스를 비우는 그 꼴). 진짜 탭 전환은 앱 측정값(회신)에 있다. */
async function putDetached(page, name) {
  const it = INLETS[name];
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async ([add, sel]) => {
    window.activeProjectId = 'p1';
    window.__toasts = []; const t0 = window.showToast; window.showToast = (m) => { window.__toasts.push(m); t0?.(m); };
    window.electronAPI = { ...(window.electronAPI || {}), assetsSaveCanvasImage: () => { window.__b.remove(); return Promise.resolve({ ok: true, url: `${location.origin}/__asset/h.png` }); } };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = [...c.querySelectorAll('.section-block')].pop(); window.selectSection(sec);
    window.__b = sec;
    if (add) { await (0, eval)(`(${add})`)(); window.__b = [...c.querySelectorAll(sel)].pop(); }
    window.__b.scrollIntoView({ block: 'center' });
    window.__h0 = window.historyStack.length;
  }, [it.add && it.add.toString(), it.sel]);
  const chooser = page.waitForEvent('filechooser');
  if (it.dbl) await page.evaluate((sel) => window.__b.querySelector(sel).dispatchEvent(new MouseEvent('dblclick', { bubbles: true })), it.dbl);
  else await page.evaluate(async (open) => { await (0, eval)(`(${open})`)(window.__b); }, it.open.toString());
  await (await chooser).setFiles({ name: 'a.png', mimeType: 'image/png', buffer: PNG });
  await page.waitForFunction(() => window.__toasts.length > 0);
  return { errs, r: await page.evaluate(() => ({ wrote: /__asset\//.test(window.__b.outerHTML), slot: window.historyStack.length - window.__h0, toasts: window.__toasts })) };
}

for (const name of Object.keys(INLETS)) {
  test(`[틈] ${name} — 기다리는 사이 대상이 떨어지면 안 쓰고 이력도 안 늘고 말한다`, async ({ page }) => {
    const { errs, r } = await putDetached(page, name);
    expect(r.wrote).toBe(false);
    expect(r.slot).toBe(0);
    expect(r.toasts).toEqual(['⚠️ 화면이 바뀌어 그림을 넣지 못했습니다 — 다시 넣어 주세요']);
    expect(errs).toEqual([]);
  });
  test(`${name} — 자산 URL 로 넣는다`, async ({ page }) => {
    const { errs, html } = await put(page, name, true);
    expect(html).toMatch(/\/__asset\//);
    expect(html).not.toMatch(/data:image\/png;base64,/);
    expect(errs).toEqual([]);
  });
  test(`[음성] ${name} — 자산 저장이 실패하면 data URL 로 넣어 그림을 잃지 않는다`, async ({ page }) => {
    const { errs, html } = await put(page, name, false);
    expect(html).toMatch(/data:image\/png;base64,/);
    expect(errs).toEqual([]);
  });
}
