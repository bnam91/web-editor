/* icon-stroke-fill — ICON-FEATHER-MATERIAL-RESEARCH-01(현빈 261121 발주2 #3): 넣은 뒤 그 아이콘에서 — Feather(선 아이콘) = 선 두께 · Material Symbols = 채움/선
 * 고침: js/blocks/icon-variant.js(셈) · iconify-block.js(다시 그린 뒤에도 선 두께) · prop-iconify.js(Stroke 절 «선 두께» · Fill 절 «채움/선»)
 * I1 Feather — Stroke 절 «선 두께» 숫자 3.5 → 뿌리 stroke-width 3.5 · 크기 바꿔도 그대로 · 저장 표본에 3.5 · undo 1번 = 2
 * I2 [지킴] 채운 아이콘(mdi) = «선 두께» 줄 없음 · 채움 줄 없음
 * I3 Material Symbols — «선» 진짜 클릭 → 이름 home-outline · 그림 갈림 · 색·크기 그대로 · 패널 «선» 켜짐 / 받기 실패면 이름 그대로 + 알림
 * I4 내보내기 — PNG 잉크 면적 3.5 > 1(두 측정 견줌) · HTML·Figma JSON svg 에 stroke-width="3.5"
 * I5 [미카사 채점 ②] Iconify 가 주는 실제 Lucide 꼴(stroke-width 가 path 에) → «선 두께» 줄 뜸 · 3 → path stroke-width 3
 * I6 [미카사 채점 ②] 고르기 창 Feather 걸러 «heart» 검색 — Iconify 검색은 feather 를 0 으로 준다 → 세트 목록에서 골라 격자에 feather:heart
 * 네트워크 0 — fetch 를 쪽 안에서 가로채 Iconify 대역 SVG 를 준다.
 * 양성대조: _patches/icon-stroke-fill-CTL.patch(applyIconStroke·msNameFor 걷음) → I1·I3·I4 빨강 · I2 초록 · (실측) icon-child-stroke-CTL(자식 stroke-width 안 봄) → I5 빨강 · icon-feather-search-CTL(세트 목록 폴백 걷음) → I6 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');
/* captureTruth(PNG 길)는 electronAPI.captureSectionCdp 로 찍는다 — 하네스 electronAPI 는 «모든 키가 함수»인 Proxy 라 그대로 두면 null → base64,null → ci.onerror(Event).
   CDP Page.captureScreenshot 으로 갈아 끼운다(slide-frame-cells wireCdp 꼴 · 지디 Electron 전수 261122 «page.evaluate: Event» 11건 = 이 배선 빠짐). */
async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real?.[k]) }); });
}

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const FEATHER = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1-1.1a5.5 5.5 0 0 0-7.8 7.8l1 1.1L12 21.2l7.8-7.8 1-1.1a5.5 5.5 0 0 0 0-7.8z"/></svg>';
const MDI = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M10 20v-6h4v6h5v-8h3L12 3L2 12h3v8z"/></svg>';
const MS_FILL = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M4 21V9l8-6l8 6v12h-6v-7h-4v7z" data-v="fill"/></svg>';
const MS_OUT = '<svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24"><path fill="currentColor" d="M6 19h3v-6h6v6h3v-9l-6-4.5L6 10zm-2 2V9l8-6l8 6v12h-7v-6h-2v6z" data-v="outline"/></svg>';

async function scene(page, name, svg) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
  await page.evaluate(async ({ name, svg, out }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection(); window.applyZoom?.(100);
    const sec = c.querySelector('.section-block'); sec.id = 'sI'; window.deselectAll(); window.selectSection(sec);
    const r = window.addIconifyBlock(name, svg, 128); r.block.id = 'icI'; window.updateIconifyBlock('icI', { iconColor: '#d0021b' });
    window.__fetchLog = []; const f0 = window.fetch; window.__fetchFail = false;
    window.fetch = async (u, ...a) => { const s = String(u); if (s.startsWith('https://api.iconify.design/')) { window.__fetchLog.push(s); if (window.__fetchFail) return new Response('nope', { status: 404 }); return new Response(s.endsWith('-outline.svg') ? out : '<svg/>', { status: 200 }); } return f0(u, ...a); };
    window.__toasts = []; const t0 = window.showToast; window.showToast = (m, ...x) => { window.__toasts.push(String(m)); return t0?.(m, ...x); };
    window.clearHistory?.();
  }, { name, svg, out: MS_OUT });
  await waitZoomSettled(page, 100);
  const xy = await page.evaluate(() => { const e = document.getElementById('icI'); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.click(xy[0], xy[1]); await raf(page);
  await page.evaluate(() => { if (!document.getElementById('icn-size-number')) window.showIconifyProperties?.(document.getElementById('icI')); });
  await page.waitForFunction(() => !!document.getElementById('icn-size-number'), null, { timeout: 5000 });
  return errs;
}
const sw = (page) => page.evaluate(() => { const b = document.getElementById('icI'); return { attr: b.querySelector(':scope > svg')?.getAttribute('stroke-width') ?? null, ds: b.dataset.iconStroke ?? null }; });

test('I1 Feather 선 두께 3.5 · 크기 바꿔도 · 저장 · undo', async ({ page }) => {
  const errs = await scene(page, 'feather:heart', FEATHER);
  expect(await page.evaluate(() => !!document.getElementById('icn-stroke-w-number')), '[전제] Stroke 절 «선 두께»').toBe(true);
  await page.fill('#icn-stroke-w-number', '3.5'); await page.press('#icn-stroke-w-number', 'Enter'); await raf(page);
  expect(await sw(page), '★3.5').toEqual({ attr: '3.5', ds: '3.5' });
  await page.evaluate(() => window.updateIconifyBlock('icI', { size: 96, svg: document.querySelector('#icI > svg').outerHTML.replace('stroke-width="3.5"', 'stroke-width="2"') })); await raf(page);
  expect((await sw(page)).attr, '★다시 그려도(svg 갈아 끼움) 저장된 두께').toBe('3.5');
  const h = await page.evaluate(() => window.getSerializedCanvas());
  expect(/data-icon-stroke="3.5"/.test(h) && /stroke-width="3.5"/.test(h), '★저장 표본').toBe(true);
  await page.evaluate(() => { window.undo(); window.undo(); }); await raf(page);
  expect((await sw(page)).attr, '★undo = 2(처음)').toBe('2');
  expect(errs).toEqual([]);
});

test('I2 [지킴] 채운 아이콘 = 선 두께·채움 줄 없음', async ({ page }) => {
  const errs = await scene(page, 'mdi:home', MDI);
  expect(await page.evaluate(() => [!!document.getElementById('icn-stroke-w-number'), !!document.getElementById('icn-ms-fill-group')]), '★둘 다 없음').toEqual([false, false]);
  expect(errs).toEqual([]);
});

test('I3 Material Symbols «선» 클릭 → home-outline · 색·크기 그대로 / 실패 = 그대로+알림', async ({ page }) => {
  const errs = await scene(page, 'material-symbols:home', MS_FILL);
  expect(await page.evaluate(() => document.querySelector('#icn-ms-fill-group .active')?.dataset.msFill), '[전제] 채움 켜짐').toBe('fill');
  await page.click('#icn-ms-fill-group [data-ms-fill="outline"]');
  await page.waitForFunction(() => document.getElementById('icI').dataset.iconName === 'material-symbols:home-outline', null, { timeout: 5000 }).catch(() => {});
  const a = await page.evaluate(() => { const b = document.getElementById('icI'); return { name: b.dataset.iconName, v: (b.querySelector('path')?.getAttribute('d') || '').startsWith('M6 19h3') ? 'outline' : 'fill',   /* 세척기가 data-* 를 버려 d 로 가름 */ color: b.dataset.iconColor, size: b.dataset.size, active: document.querySelector('#icn-ms-fill-group .active')?.dataset.msFill ?? null, url: window.__fetchLog.at(-1) || null }; });
  expect(a, '★선 모양으로').toEqual({ name: 'material-symbols:home-outline', v: 'outline', color: '#d0021b', size: '128', active: 'outline', url: 'https://api.iconify.design/material-symbols/home-outline.svg' });
  await page.evaluate(() => { window.__fetchFail = true; });
  await page.click('#icn-ms-fill-group [data-ms-fill="fill"]'); await page.waitForFunction(() => window.__toasts.length > 0, null, { timeout: 5000 }).catch(() => {});
  const b = await page.evaluate(() => ({ name: document.getElementById('icI').dataset.iconName, toast: window.__toasts.at(-1) || null }));
  expect(b, '★실패 = 이름 그대로 + 알림').toEqual({ name: 'material-symbols:home-outline', toast: '이 아이콘은 그 모양이 없거나 지금 받을 수 없어요' });
  expect(errs).toEqual([]);
});

test('I4 PNG 잉크 3.5 > 1 · HTML·Figma 에 stroke-width', async ({ page }) => {
  const errs = await scene(page, 'feather:heart', FEATHER);
  const ink = async (w) => { await page.fill('#icn-stroke-w-number', String(w)); await page.press('#icn-stroke-w-number', 'Enter'); await raf(page);
    return page.evaluate(async () => { const s = document.getElementById('sI'); const r = await window.__exportGate.captureTruth(s, 860, window.__exportGate.sectionBgColor(s)); const x = r.canvas.getContext('2d'); const d = x.getImageData(0, 0, r.canvas.width, r.canvas.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] > 150 && d[i + 1] < 90 && d[i + 2] < 90) n++; return n; }); };
  const thin = await ink(1), thick = await ink(3.5);
  expect(thick > thin * 2, `★PNG 빨간 선 면적 1 → 3.5 (${thin} → ${thick})`).toBe(true);
  const out = await page.evaluate(async () => {
    let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
    const html = blob ? await blob.text() : ''; const j = await window.buildFigmaExportJSON(['sI']); let n = null; const w = (o) => { if (!o || typeof o !== 'object' || n) return; if (o.id === 'icI') { n = o; return; } Object.values(o).forEach(w); }; w(j);
    return { html: /stroke-width="3.5"/.test(html), figma: !!n && /stroke-width="3.5"/.test(n.svg || '') };
  });
  expect(out, '★HTML·Figma').toEqual({ html: true, figma: true });
  expect(errs).toEqual([]);
});

const LUCIDE_REAL = '<svg xmlns="http://www.w3.org/2000/svg" width="1em" height="1em" viewBox="0 0 24 24"><path fill="none" stroke="currentColor" stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M2 9.5a5.5 5.5 0 0 1 9.591-3.676a.56.56 0 0 0 .818 0A5.49 5.49 0 0 1 22 9.5c0 2.29-1.5 4-3 5.5l-5.492 5.313a2 2 0 0 1-3 .019L5 15c-1.5-1.5-3-3.2-3-5.5"/></svg>';   // api.iconify.design/lucide/heart.svg 응답 그대로(261121)
test('I5 Iconify 실제 Lucide 꼴(path 의 stroke-width) → 선 두께', async ({ page }) => {
  const errs = await scene(page, 'lucide:heart', LUCIDE_REAL);
  expect(await page.evaluate(() => !!document.getElementById('icn-stroke-w-number')), '★«선 두께» 줄이 안 뜬다(뿌리만 봄)').toBe(true);
  expect(await page.evaluate(() => document.getElementById('icn-stroke-w-number').value), '지금 두께 = path 값').toBe('2');
  await page.fill('#icn-stroke-w-number', '3'); await page.press('#icn-stroke-w-number', 'Enter'); await raf(page);
  expect(await page.evaluate(() => document.querySelector('#icI > svg path').getAttribute('stroke-width')), '★path 에 입힘').toBe('3');
  expect(errs).toEqual([]);
});

test('I6 Feather 걸러 검색 — Iconify 검색 0 이면 세트 목록에서', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page); await wireCdp(page);
  await page.evaluate(() => {
    window.__fetchLog = []; const f0 = window.fetch;
    window.fetch = async (u, ...a) => { const s = String(u); if (!s.startsWith('https://api.iconify.design/')) return f0(u, ...a); window.__fetchLog.push(s);
      if (s.includes('/search?')) return new Response(JSON.stringify({ icons: [], total: 0 }), { status: 200 });   // 실측 응답(261121): feather 는 검색 색인에 없다
      if (s.includes('/collection?prefix=feather')) return new Response(JSON.stringify({ prefix: 'feather', total: 4, uncategorized: ['heart', 'star', 'home', 'heart-off'] }), { status: 200 });
      if (s.includes('/feather.json')) return new Response(JSON.stringify({ prefix: 'feather', icons: { heart: { body: '<path d="M1 1h2"/>' }, 'heart-off': { body: '<path d="M1 1h2"/>' } }, width: 24, height: 24 }), { status: 200 });
      return new Response('<svg/>', { status: 200 }); };
    window.openIconifyModal();
  });
  await page.click('.iconify-col-btn[data-prefix="feather"]');
  await page.fill('#iconify-search-input', 'heart');
  await page.waitForFunction(() => /feather:heart/.test(document.getElementById('iconify-grid')?.innerHTML || ''), null, { timeout: 8000 }).catch(() => {});
  const g = await page.evaluate(() => ({ html: document.getElementById('iconify-grid')?.innerHTML || '', log: window.__fetchLog }));
  expect(/feather:heart"/.test(g.html) && /feather:heart-off/.test(g.html) && !/feather:star/.test(g.html), `★Feather 검색 결과 0 (격자 ${g.html.slice(0, 160)})`).toBe(true);
  expect(g.log.some((u) => u.includes('/collection?prefix=feather')), '세트 목록을 받았다').toBe(true);
  expect(errs).toEqual([]);
});
