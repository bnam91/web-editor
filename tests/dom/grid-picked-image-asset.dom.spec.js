/* grid-picked-image-asset.dom.spec.js — E91: 그리드에 «파일창으로 고른» 그림은 data URL 통째가 아니라 자산(goya-asset URL)으로 (2026-10-06 lane-esweep · 태양 승인 01:26)
 *
 * 증상(실측 10-05 18:28 · 격리 앱): 칸 «이미지 줄»을 패널 파일창으로 넣으면 잡음 PNG 691,014자가 상한 면제(trusted)로 통째 인라인 —
 *   getSerializedCanvas 3,286 → 1,385,361 · 히스토리 표본마다 그림 두 벌(칸 JSON + img src) · 알림 0.
 * 뿌리: 파일창 입구 4 중 칸 배경(G4 · prop-grid.js) 하나만 assetsSaveCanvasImage → goya-asset · 나머지 셋(패널 이미지 줄 · 오른클릭 교체 ·
 *   블럭 배경 이미지)은 readAsDataURL 을 그대로 넣었다.
 * 고침: prop-grid.js grdPickedImageSrc(file) 한 벌(G4 몸통) — 네 입구가 부른다 · 자산 IPC 가 없으면(웹·헤드리스) 종전 data URL(저장 때 외부화).
 * 머리표: [새 것] 8a8de086 에서 빨강(P1 P2 P3) · [지킴] 8a8de086 에서도 초록(P0 P4) · [전제] 재기 위한 조건. 예측 = reports/esweep/predict-e91.md.
 * ⛔못 보는 꼴: 실제 OS 파일창(여기는 Playwright filechooser) · 스크래치 끌기 · MCP 입구(신뢰 안 함 — 상한 그대로).
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });

const URL_ASSET = 'goya-asset://proj_e91test/pick.png';
/** 자산 IPC 흉내(Proxy) — 따로 떼어 «언제» 거는지 시험이 고른다.
 *  ★P2(진짜 클릭 줄 고르기)는 고른 «뒤»에 건다: 10-06 잼 — Proxy 를 먼저 걸면 진짜 클릭 고르기 2/10 (안 걸면 30/30) ·
 *   실패 판에서 elementFromPoint = 클래스 없는 DIV 가 그리드를 덮음(무엇이 만드는지 ㉡ 안 잼). 시험 대상(파일창 → 자산 URL)과 무관한 하네스 탓. */
async function installIpc(page, ipc = true) {
  await page.evaluate(([ipc, url]) => {
    window.__saved = []; window.activeProjectId = 'proj_e91test';
    window.electronAPI = ipc
      ? new Proxy({ assetsSaveCanvasImage: async (a) => { window.__saved.push({ mime: a.mime, n: (a.b64 || '').length }); return { ok: true, url }; } }, { get: (t, k) => (k in t ? t[k] : () => Promise.resolve(null)) })
      : new Proxy({}, { get: () => (() => Promise.resolve(null)) });
  }, [ipc, URL_ASSET]);
}
async function setup(page, { ipc = true, ipcLater = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([ipc, url]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="gI">
      <div class="gap-block" data-type="gap" style="height:80px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const cv = document.createElement('canvas'); cv.width = 1; cv.height = 1; const x = cv.getContext('2d'); x.fillStyle = '#00ff00'; x.fillRect(0, 0, 1, 1);
    const tiny = cv.toDataURL('image/png');
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [{ type: 'image', imgSrc: tiny }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 220 }],
      cells: [[{ lines: [{ type: 'image', imgSrc: tiny }] }, { lines: [{ type: 'body', text: 'B' }] }]],
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
    window.applyZoom?.(100);
  }, [ipc, URL_ASSET]);
  if (!ipcLater) await installIpc(page, ipc);
  await page.waitForTimeout(250);
  return errs;
}
/** 잡음 PNG(≈700KB) 파일 — 캔버스로 만든다(바이트를 손으로 안 적는다) */
async function noisePng(page) {
  const b64 = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 480; cv.height = 480; const x = cv.getContext('2d'); const d = x.createImageData(480, 480);
    for (let i = 0; i < d.data.length; i++) d.data[i] = (Math.random() * 256) | 0; x.putImageData(d, 0, 0); return cv.toDataURL('image/png').split(',')[1]; });
  const f = path.join(os.tmpdir(), `e91-${process.pid}-${Date.now()}.png`);
  fs.writeFileSync(f, Buffer.from(b64, 'base64'));
  return { f, bytes: fs.statSync(f).size };
}
const serLen = (page) => page.evaluate(() => (window.getSerializedCanvas?.() || '').length);
const gridHtml = (page) => page.evaluate(() => document.getElementById('gG').outerHTML + JSON.stringify(document.getElementById('gG').dataset));
async function pickImageLine(page) {
  const [x, y] = await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); const q = g.getBoundingClientRect(); return [q.right - 8, q.top + 8]; });
  await page.mouse.click(x, y); await page.waitForTimeout(250);
  const [lx, ly] = await page.evaluate(() => { const l = document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] [data-line="0"]'); const q = l.getBoundingClientRect(); return [q.left + q.width / 2, q.top + q.height / 2]; });
  await page.mouse.click(lx, ly); await page.waitForTimeout(350);
  /* 줄 고르기가 한 번에 안 잡히는 판이 있었다(첫 판 P4: 패널이 «Grid» 블럭 단계에 머묾) — 0.8초 띄워 한 번 더(더블클릭으로 안 읽히게) · 끝내 안 되면 [전제] 빨강 */
  for (let k = 0; k < 2 && !(await page.evaluate(() => !!document.getElementById('grd-img-pick-btn'))); k++) { await page.waitForTimeout(800); await page.mouse.click(lx, ly); await page.waitForTimeout(400); }
  expect(await page.evaluate(() => !!document.getElementById('grd-img-pick-btn')), '[전제] 이미지 줄을 골랐다(패널에 「이미지 교체…」)').toBe(true);
  return [lx, ly];
}
/** [전제·JS] 이미지 줄을 «고른 상태» — 진짜 클릭 고르기가 하네스에서 흔들려(10-06 run: P1·P4 전제 실패 · 8a8de086 판에선 섰다) 이 시험의 대상(파일창 → 자산 URL)과 무관한 단계만 JS 로 세운다.
 *  같은 문 = 캔버스 클릭이 부르는 selectBlock + grdSetActiveLine + showGridProperties. 파일창은 그대로 진짜(filechooser). */
async function selectImageLineJS(page) {
  await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); window.deselectAll?.(); window.selectBlock(g); window.grdSetActiveLine(g, { r: 0, c: 0, li: 0 }); window.showGridProperties(g); });
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => !!document.getElementById('grd-img-pick-btn')), '[전제·JS] 이미지 줄 패널(「이미지 교체…」)').toBe(true);
}
async function selectBlockJS(page) {
  await page.evaluate(() => { const g = document.getElementById('gG'); g.scrollIntoView({ block: 'center' }); window.deselectAll?.(); window.selectBlock(g); window.grdSetActiveLine(g, null); window.showGridProperties(g); });
  await page.waitForTimeout(300);
}
async function expectAsset(page, before, tag) {
  await expect(async () => {
    const h = await gridHtml(page); const n = await serLen(page);
    expect({ asset: h.includes(URL_ASSET), dataPng: /data:image\/png;base64,[A-Za-z0-9+/]{2000}/.test(h), grew: n - before },
      `${tag}: 그리드에 자산 URL · 큰 data URL 없음 · 직렬화 증가 < 2000 · 잰 증가=${n - before}`).toMatchObject({ asset: true, dataPng: false });
    expect(n - before, `${tag}: 직렬화 증가(자)`).toBeLessThan(2000);
  }).toPass({ timeout: 3000 });
}

test('P1 [새 것] 패널 「이미지 교체…」 파일창 → 자산 URL · 직렬화 증가 < 2,000', async ({ page }) => {
  const errs = await setup(page); const { f, bytes } = await noisePng(page);
  expect(bytes, '[전제] 그림이 상한(200,000자)보다 크다').toBeGreaterThan(300000);
  await selectImageLineJS(page);
  const before = await serLen(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#grd-img-pick-btn')]);
  await fc.setFiles(f);
  await expectAsset(page, before, 'P1');
  fs.unlinkSync(f); expect(errs).toEqual([]);
});

test('P2 [새 것] 오른클릭 「이미지」 메뉴 → 교체 파일창 → 자산 URL', async ({ page }) => {
  const errs = await setup(page, { ipcLater: true }); const { f } = await noisePng(page);
  const [lx, ly] = await pickImageLine(page);
  await installIpc(page, true);   // ★고른 뒤에 건다(위 installIpc 주석)
  const before = await serLen(page);
  await page.mouse.click(lx, ly, { button: 'right' }); await page.waitForTimeout(300);
  const shown = await page.evaluate(() => { const e = document.getElementById('bcm-grid-img'); return e && getComputedStyle(e).display !== 'none' && e.getBoundingClientRect().height > 0; });
  expect(shown, '[전제] 오른클릭 메뉴에 이미지 항목').toBe(true);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#bcm-grid-img')]);
  await fc.setFiles(f);
  await expectAsset(page, before, 'P2');
  fs.unlinkSync(f); expect(errs).toEqual([]);
});

test('P3 [새 것] 그리드 블럭 배경 이미지 → 자산 URL', async ({ page }) => {
  const errs = await setup(page); const { f } = await noisePng(page);
  await page.evaluate(() => window.updateGridBlock('gG', { blockBg: { on: true } }));   // [전제·JS] 블럭 배경 켬(패널 토글과 같은 문)
  await selectBlockJS(page);   // [전제·JS] 블럭 단계 패널(10-06 run: 진짜 클릭이 줄 단계로 떨어져 입구가 안 보인 판 있음)
  expect(await page.evaluate(() => !!document.getElementById('grd-bbg-img-input')), '[전제] 블럭 배경 이미지 입구').toBe(true);
  const before = await serLen(page);
  await page.setInputFiles('#grd-bbg-img-input', f);
  await expectAsset(page, before, 'P3');
  fs.unlinkSync(f); expect(errs).toEqual([]);
});

test('P0 [지킴] 칸 배경(G4) 파일창 = 자산 URL 그대로', async ({ page }) => {
  const errs = await setup(page); const { f } = await noisePng(page);
  await selectImageLineJS(page);
  const open = await page.evaluate(() => { const b = document.getElementById('grd-cell-body'); return b && getComputedStyle(b).display !== 'none'; });
  if (!open) { await page.click('#grd-cell-toggle'); await page.waitForTimeout(200); }
  const before = await serLen(page);
  await page.setInputFiles('#grd-cell-img-input', f);
  await expectAsset(page, before, 'P0');
  fs.unlinkSync(f); expect(errs).toEqual([]);
});

test('P4 [지킴] 자산 IPC 가 없으면(웹·헤드리스) 패널 파일창 그림은 data URL 로 «들어간다»(거절 0)', async ({ page }) => {
  const errs = await setup(page, { ipc: false }); const { f } = await noisePng(page);
  await selectImageLineJS(page);
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#grd-img-pick-btn')]);
  await fc.setFiles(f);
  await expect(async () => { const src = await page.evaluate(() => document.querySelector('#gG .grd-cell[data-r="0"][data-c="0"] img')?.getAttribute('src') || '');
    expect(src.startsWith('data:image/png') && src.length > 300000, `폴백 data URL · 길이=${src.length}`).toBe(true); }).toPass({ timeout: 3000 });
  fs.unlinkSync(f); expect(errs).toEqual([]);
});
