/* grain-figma-note — IMG-FX-GRAIN-01(현빈 261121): 그레인은 Figma JSON 에 안 실린다 → 내보내기·업로드 직전 «피그마로 안 나감» 비차단 알림(certOutputNotice 와 같은 꼴 · showToast)
 * 고침: js/io/export-figma-json.js figmaGrainNotice · exportFigmaJSON 이 부름 · js/io/figma-publish.js 업로드가 고른 섹션으로 부름
 * N1 그레인 켠 그림 → Figma JSON 내려받기 = 알림 «그레인 1곳은 피그마로 안 나갑니다» · [전제] JSON 에 grain 글자 0(정말 빠짐)
 * N2 그레인 0(슬라이더 0) → 알림 없음
 * N3 업로드 길 — 고른 섹션만 센다(그레인 든 섹션을 안 고르면 0 · 고르면 1)
 * N4 [채점 ⑥] 실사용 업로드 길(창 → 진짜 «업로드» 클릭 · 가짜 figmaUpload IPC)에서 알림
 * 양성대조: _patches/grain-note-CTL.patch(showToast 줄 걷음) → N1·N3 빨강 · N2 초록 · (실측) grain-upload-CTL(업로드 길의 알림 줄 걷음) → N4 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

async function scene(page, grain) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async (grain) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); await window.addSection(); window.applyZoom?.(100);
    const [s1, s2] = c.querySelectorAll('.section-block'); s1.id = 'sG1'; s2.id = 'sG2';
    const cv = document.createElement('canvas'); cv.width = 200; cv.height = 120; const x = cv.getContext('2d'); x.fillStyle = '#5577aa'; x.fillRect(0, 0, 200, 120);
    const { row, block } = window.makeAssetBlock(); s1.querySelector('.section-inner').appendChild(row); window.bindBlock?.(block); window.rebindAll?.(); window.setAssetImageFromSrc(block, cv.toDataURL('image/png')); block.id = 'abG';
    window.__toasts = []; const t0 = window.showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return t0?.(m, ...a); };
    window.__grain = grain;
  }, grain);
  await waitZoomSettled(page, 100);
  await page.waitForFunction(() => document.querySelector('#abG .asset-img')?.complete, null, { timeout: 15000 });
  /* 사람 길: 그림 고르고 패널 «그레인» 숫자칸 */
  const xy = await page.evaluate(() => { const e = document.getElementById('abG'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(xy[0], xy[1]);
  await page.evaluate(() => { if (!document.getElementById('asset-grain-number')) { window.selectBlock?.('abG'); window.showAssetProperties?.(document.getElementById('abG')); } });
  await page.waitForFunction(() => !!document.getElementById('asset-grain-number'), null, { timeout: 5000 });
  await page.fill('#asset-grain-number', String(grain)); await page.press('#asset-grain-number', 'Enter');
  await page.waitForFunction((g) => (parseInt(document.querySelector('#abG .asset-grain')?.dataset.grainIntensity || '0', 10) || 0) === g, grain, { timeout: 5000 });
  return errs;
}
const exportJSON = (page) => page.evaluate(async () => {
  window.__toasts = []; let blob = null; const oc = URL.createObjectURL, ok = HTMLAnchorElement.prototype.click;
  URL.createObjectURL = function (x) { blob = x; return oc.call(URL, x); }; HTMLAnchorElement.prototype.click = function () { if (!this.download) return ok.call(this); };
  try { await window.exportFigmaJSON(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ok; }
  const txt = blob ? await blob.text() : '';
  return { toasts: window.__toasts.filter((t) => t.includes('그레인')), grainInJson: /grain/i.test(txt), jsonLen: txt.length };
});

test('N1 그레인 켬 → Figma JSON 내려받기에 «안 나감» 알림', async ({ page }) => {
  const errs = await scene(page, 60);
  const r = await exportJSON(page);
  expect([r.jsonLen > 0, r.grainInJson], `[전제] JSON 나옴 · 그레인 글자 0(정말 빠짐) ${JSON.stringify(r)}`).toEqual([true, false]);
  expect(r.toasts, '★알림').toEqual(['그레인 1곳은 피그마로 안 나갑니다(PNG·HTML 엔 나감)']);
  expect(errs).toEqual([]);
});

test('N2 그레인 0 → 알림 없음', async ({ page }) => {
  const errs = await scene(page, 0);
  const r = await exportJSON(page);
  expect(r.toasts, '★알림 없음').toEqual([]);
  expect(errs).toEqual([]);
});

test('N3 업로드 길 — 고른 섹션만 센다', async ({ page }) => {
  const errs = await scene(page, 60);
  const r = await page.evaluate(() => {
    window.__toasts = [];
    const a = window.figmaGrainNotice([document.getElementById('sG2')]), ta = window.__toasts.length;
    const b = window.figmaGrainNotice([document.getElementById('sG1'), document.getElementById('sG2')]), tb = window.__toasts.filter((t) => t.includes('그레인')).length;
    return [a, ta, b, tb];
  });
  expect(r, '★그레인 없는 섹션만 = 0·알림 0 / 든 섹션 포함 = 1·알림 1').toEqual([0, 0, 1, 1]);
  expect(errs).toEqual([]);
});

/* N4 [미카사 채점 261121 ⑥] 실사용 길 그대로 — 업로드 창(openFigmaUploadModal) → 채널 칸 → 섹션 칸 → «업로드» 진짜 클릭(doFigmaUpload)
 *   가짜는 electronAPI.figmaUpload·readNodeMap 둘(⛔실 Figma·소켓 0) · N1 은 UI 가 안 부르는 옛 exportFigmaJSON 이고 N3 는 함수를 직접 불러 «실사용 길» 증거가 아니었다. */
test('N4 실사용 업로드 길(창 → 업로드 클릭)에서도 알림 · 업로드 JSON 에 그레인 0', async ({ page }) => {
  const errs = await scene(page, 60);
  await page.evaluate(() => {
    window.__up = null; const api = window.electronAPI || {};
    window.electronAPI = new Proxy(api, { get: (t, k) => (k === 'figmaUpload' ? async (ch, json) => { window.__up = { ch, len: JSON.stringify(json).length, grain: /grain/i.test(JSON.stringify(json)) }; return { ok: true }; } : k === 'readNodeMap' ? async () => ({}) : t[k]) });
    window.__toasts = [];
  });
  await page.evaluate(() => window.openFigmaUploadModal());
  await page.waitForSelector('#figma-channel-input', { state: 'visible', timeout: 5000 });
  await page.fill('#figma-channel-input', 'testchan');
  await page.evaluate(() => document.querySelectorAll('.figma-sec-cb').forEach((cb) => { cb.checked = cb.dataset.secId === 'sG1'; }));
  await page.click('#figma-upload-btn');
  await page.waitForFunction(() => window.__up != null, null, { timeout: 15000 });
  const r = await page.evaluate(() => ({ up: window.__up, toasts: window.__toasts.filter((t) => t.includes('그레인')) }));
  expect([r.up.ch, r.up.len > 0, r.up.grain], `[전제] 업로드 JSON 나감 · 그레인 글자 0 ${JSON.stringify(r.up)}`).toEqual(['testchan', true, false]);
  expect(r.toasts, '★실사용 업로드 길에서 알림').toEqual(['그레인 1곳은 피그마로 안 나갑니다(PNG·HTML 엔 나감)']);
  expect(errs).toEqual([]);
});
