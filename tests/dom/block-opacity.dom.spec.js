/* block-opacity.dom — 블럭 불투명도 A4(지디 261124 · data-opacity 0~100 · 100 = 키 없음 · 그림 = 블럭 요소 인라인 opacity)
 *   ★«블럭 요소» = 패널이 고르는 콘텐츠 블럭(text-block · shape-block · asset-block · 진짜 프레임). 투명 래퍼(text-frame · 도형 래퍼)를
 *     주면 js/block-opacity.js 가 안쪽으로 내려가 «한 번만» 건다.
 * 장면(앱 bootApp · 섹션 하나): 자유배치 프레임 #opF(빨강 400×200) > text-frame 래퍼 > 글 #opT
 * 칸
 *   B1 계약(진짜 앱 window) — 반올림·자르기 · 100 = 키·인라인 지움 · 래퍼 → 안쪽 한 번 · 그림(계산값) = v/100
 *   B2 저장 왕복(getSerializedCanvas → innerHTML → rebindAll) · undo → 없음 · redo → 다시
 *   B3 HTML 내보내기 — 내보낸 HTML 을 새 페이지에 띄워 #opF .5 · #opT .4(겹침 = 둘 다 제 값 · CSS 가 곱한다)
 *   B4 PNG(html2canvas 길 captureCloneToCanvas useNative=false) — 빨강 50% ≈ (255,128,128) · 100 = (255,0,0) 양성대조
 *   B5 Figma 진짜 길 — buildFigmaExportJSON(캔버스) → 진짜 렌더러(가짜 figma_cmd) → set_node_properties 프레임 .5 · 글 .4(곱한 .2 없음) · 키 없으면 0
 *   B6 옛 저장(키 없음) — 불러오기·저장 뒤 data-opacity 0 · «opacity» 글자 수 무변
 *   B7 Fill 눈(data-fill-hidden)과 독립 — 하나를 바꿔도 다른 하나 그대로(키 수준 · F6 CSS 는 이 base 에 없음)
 *   B8 PNG 네이티브(CDP) 길 — 앱이 실제로 쓰는 길(isNativeCapture) · B4 와 같은 판정(100 양성대조 먼저)
 * 양성대조: base b03691dfa 판(js/block-opacity.js 없음 · export/renderer 손 안 댐) → B1·B2·B3·B4·B5·B8 빨강 · B6·B7 은 setBlockOpacity 가 없어 빨강.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');
const { bootApp } = require('./_root-harness.js');
const { mkTmpRoot } = require('../unit/_tmproot.js');
const ROOT = path.join(__dirname, '..', '..');

async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.(); window.addSection(); window.applyZoom?.(100);
    const inner = document.querySelector('.section-block .section-inner');
    inner.insertAdjacentHTML('beforeend',
      '<div class="frame-block" id="opF" data-free-layout="true" data-width="400" data-height="200" data-bg="#ff0000" style="position:relative;width:400px;height:200px;background:#ff0000;">'
      + '<div class="frame-block" id="opTF" data-text-frame="true" style="position:absolute;left:0px;top:0px;width:200px;">'
      + '<div class="text-block" id="opT"><div class="tb-body" contenteditable="true">OPX</div></div></div></div>');
    window.rebindAll?.();
  });
  return errs;
}
const st = (page) => page.evaluate(() => {
  const F = document.getElementById('opF'), T = document.getElementById('opT'), TF = document.getElementById('opTF');
  return { F: F?.getAttribute('data-opacity') ?? null, T: T?.getAttribute('data-opacity') ?? null, TF: TF?.getAttribute('data-opacity') ?? null,
    Fc: F ? getComputedStyle(F).opacity : null, Tc: T ? getComputedStyle(T).opacity : null, TFc: TF ? getComputedStyle(TF).opacity : null };
});

test('B1 계약 — 반올림·자르기 · 100 = 지움 · 래퍼 → 안쪽 한 번 · 그림 = v/100', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => typeof window.setBlockOpacity + typeof window.readBlockOpacity)).toBe('functionfunction');
  expect(await page.evaluate(() => window.readBlockOpacity(document.getElementById('opF')))).toBe(100);
  await page.evaluate(() => window.setBlockOpacity(document.getElementById('opF'), 49.6));
  expect(await st(page)).toMatchObject({ F: '50', Fc: '0.5' });
  await page.evaluate(() => window.setBlockOpacity(document.getElementById('opTF'), 40));   // 래퍼를 준다
  expect(await st(page), '래퍼를 줬는데 안쪽 글에 한 번만 걸려야 한다').toMatchObject({ T: '40', Tc: '0.4', TF: null, TFc: '1' });
  await page.evaluate(() => window.setBlockOpacity(document.getElementById('opF'), 300));
  const s = await st(page);
  expect([s.F, s.Fc]).toEqual([null, '1']);
  expect(await page.evaluate(() => document.getElementById('opF').style.opacity)).toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B2 저장 왕복 · undo/redo', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.pushHistory?.('B2 기준'));
  await page.evaluate(() => { window.setBlockOpacity(document.getElementById('opF'), 50); window.setBlockOpacity(document.getElementById('opT'), 40); });
  const html = await page.evaluate(() => {
    const h = window.getSerializedCanvas();
    document.getElementById('canvas').innerHTML = h;
    window.rebindAll?.({ preserveHistory: true });
    return h;
  });
  expect(/id="opF"[^>]*data-opacity="50"|data-opacity="50"[^>]*id="opF"/.test(html), '저장 문자열에 프레임 data-opacity 없음').toBe(true);
  expect(await st(page)).toMatchObject({ F: '50', Fc: '0.5', T: '40', Tc: '0.4' });
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await st(page)).F, { message: 'undo 가 불투명도를 안 걷었다' }).toBe(null);
  expect((await st(page)).Fc).toBe('1');
  await page.evaluate(() => window.redo());
  await expect.poll(async () => (await st(page)).Fc, { message: 'redo 가 불투명도를 안 되살렸다' }).toBe('0.5');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B3 HTML 내보내기 — 받는 화면에서 프레임 .5 · 글 .4', async ({ page, context }) => {
  const errs = await setup(page);
  await page.evaluate(() => { window.setBlockOpacity(document.getElementById('opF'), 50); window.setBlockOpacity(document.getElementById('opT'), 40); });
  const html = await page.evaluate(async () => {
    const origCreate = URL.createObjectURL, origClick = HTMLAnchorElement.prototype.click;
    let captured = null;
    URL.createObjectURL = (b) => { captured = b; return 'blob:op-spec'; };
    HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = origCreate; HTMLAnchorElement.prototype.click = origClick; }
    return captured ? await captured.text() : null;
  });
  expect(typeof html, '전제: 내보낸 HTML 을 가로챘다').toBe('string');
  const p2 = await context.newPage();
  await p2.route('**/*', (r) => r.abort());
  await p2.setContent(html, { waitUntil: 'domcontentloaded' });
  const got = await p2.evaluate(() => ['opF', 'opT'].map((id) => { const e = document.getElementById(id); return e ? getComputedStyle(e).opacity : null; }));
  await p2.close();
  expect(got).toEqual(['0.5', '0.4']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B4 PNG(html2canvas) — 빨강 50% ≈ (255,128,128) · 100 = (255,0,0)', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.deselectAll?.());
  const shoot = () => page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const sec = document.querySelector('.section-block'), F = document.getElementById('opF');
    const sr = sec.getBoundingClientRect(), fr = F.getBoundingClientRect(), z = (window.currentZoom || 100) / 100;
    const gx = (fr.right - sr.left) / z - 10, gy = (fr.bottom - sr.top) / z - 10;   // 오른아래 모서리 안쪽(글 없음)
    const clone = await ex.prepareCloneForCapture(sec, 860, false); ex.renderComponentsInClone(clone);
    const { canvas } = await ex.captureCloneToCanvas(clone, 860, '#ffffff', false, sec); clone.remove();
    const s = canvas.width / 860;
    return [...canvas.getContext('2d').getImageData(Math.round(gx * s), Math.round(gy * s), 1, 1).data].slice(0, 3);
  });
  const full = await shoot();
  expect(full, '양성대조: 100 에서 빨강이 아니다(자리를 잘못 잼)').toEqual([255, 0, 0]);
  await page.evaluate(() => window.setBlockOpacity(document.getElementById('opF'), 50));
  const half = await shoot();
  console.log('[B4]', JSON.stringify({ full, half }));
  expect(half[0]).toBeGreaterThanOrEqual(250);
  for (const c of [half[1], half[2]]) { expect(c).toBeGreaterThanOrEqual(118); expect(c).toBeLessThanOrEqual(138); }
  expect(errs, errs.join(' | ')).toEqual([]);
});

const FAKE = `import { appendFileSync } from 'fs';
const a = process.argv; const cmd = a[a.indexOf('--command') + 1]; const p = a[a.indexOf('--params') + 1];
const id = 'n' + process.hrtime.bigint();
appendFileSync(process.env.FAKE_LOG, JSON.stringify({ cmd, params: JSON.parse(p), id }) + '\\n');
console.log(JSON.stringify(cmd === 'get_document_info' ? { children: [] } : { id }));`;
function render(doc) {
  const dir = mkTmpRoot('renderer-opacity-dom-');
  const src = path.join(ROOT, 'figma-renderer');
  for (const f of fs.readdirSync(src)) if (f.endsWith('.mjs')) fs.copyFileSync(path.join(src, f), path.join(dir, f));
  fs.writeFileSync(path.join(dir, 'figma_cmd.mjs'), FAKE);
  const json = path.join(dir, 'd.json'), log = path.join(dir, 'l.log');
  fs.writeFileSync(json, JSON.stringify(doc));
  const r = spawnSync('node', [path.join(dir, 'sangpe_to_figma.mjs'), 'CH', json], { encoding: 'utf8', env: { ...process.env, FAKE_LOG: log } });
  if (r.status !== 0) throw new Error(r.stderr);
  return fs.readFileSync(log, 'utf8').trim().split('\n').map((l) => JSON.parse(l));
}
const buildJson = (page) => page.evaluate(() => { window.flushCurrentPage?.(); return JSON.parse(JSON.stringify(window.buildFigmaExportJSON(null))); });
const ops = (o, out = []) => { if (o && typeof o === 'object') { if (typeof o.opacity === 'number' && o.type) out.push([o.type, o.id || '', o.opacity]); Object.values(o).forEach((v) => ops(v, out)); } return out; };

test('B5 Figma 진짜 길 — 캔버스 → JSON → 렌더러 → set_node_properties 프레임 .5 · 글 .4(곱하지 않음)', async ({ page }) => {
  const errs = await setup(page);
  const off = await buildJson(page);
  expect(ops(off), '키 없는데 노드 opacity 가 실렸다').toEqual([]);
  expect(render(off).filter((c) => c.cmd === 'set_node_properties').length).toBe(0);
  await page.evaluate(() => { window.setBlockOpacity(document.getElementById('opF'), 50); window.setBlockOpacity(document.getElementById('opT'), 40); });
  const on = await buildJson(page);
  const o = ops(on);
  console.log('[B5]', JSON.stringify(o));
  expect(o).toContainEqual(['frame', 'opF', 0.5]);
  expect(o.filter(([t, , v]) => t === 'text' && v === 0.4).length, '글 노드에 제 값 .4 가 없다').toBe(1);
  expect(o.some(([, , v]) => Math.abs(v - 0.2) < 1e-9), '미리 곱한 값(.2)이 실렸다').toBe(false);
  const cmds = render(on);
  const fr = cmds.find((c) => c.cmd === 'create_frame' && c.params.name === 'frame_opF');
  expect(fr, '전제: 프레임 노드가 안 만들어졌다').toBeTruthy();
  const sp = cmds.filter((c) => c.cmd === 'set_node_properties').map((c) => [c.params.nodeId, c.params.opacity]);
  expect(sp).toContainEqual([fr.id, 0.5]);
  const made = new Set(cmds.filter((c) => /^create_/.test(c.cmd)).map((c) => c.id));
  const kid = sp.filter(([id, v]) => v === 0.4 && made.has(id) && id !== fr.id);
  expect(kid.length, '글(안쪽) 노드에 .4 가 안 걸렸다').toBeGreaterThan(0);
  expect(sp.some(([, v]) => Math.abs(v - 0.2) < 1e-9)).toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B6 옛 저장(키 없음) — 불러오기·저장 뒤 opacity 흔적 무변', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const a = window.getSerializedCanvas();
    document.getElementById('canvas').innerHTML = a;
    window.rebindAll?.();
    const b = window.getSerializedCanvas();
    const n = (s) => (s.match(/opacity/g) || []).length;
    return { dataOp: /data-opacity/.test(b), na: n(a), nb: n(b), api: typeof window.setBlockOpacity };
  });
  expect(r.api, '전제: 모듈이 실렸다').toBe('function');
  expect(r.dataOp).toBe(false);
  expect(r.nb).toBe(r.na);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('B7 Fill 눈(data-fill-hidden)과 독립', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const F = document.getElementById('opF');
    F.dataset.fillHidden = '1';
    window.setBlockOpacity(F, 30);
    const a = [F.dataset.fillHidden ?? null, F.dataset.opacity ?? null];
    delete F.dataset.fillHidden;
    const b = [F.dataset.fillHidden ?? null, F.dataset.opacity ?? null, getComputedStyle(F).opacity];
    F.dataset.fillHidden = '1'; window.setBlockOpacity(F, 100);
    const c = [F.dataset.fillHidden ?? null, F.dataset.opacity ?? null];
    return { a, b, c };
  });
  expect(r.a).toEqual(['1', '30']);
  expect(r.b).toEqual([null, '30', '0.3']);
  expect(r.c).toEqual(['1', null]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* B8 ★네이티브(CDP) 길 — 앱(Electron)이 실제로 쓰는 PNG 길(isNativeCapture = electronAPI.captureSection 있음 · captureSectionCdp 로 찍음).
   하네스 = text-highlight-bar.dom.spec.js H8 의 installCdpCapture 꼴(진짜 Page.captureScreenshot) — 같은 꼴을 여기 둔다. */
async function installCdpCapture(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) => {
    const r = await cdp.send('Page.captureScreenshot', { format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 }, captureBeyondViewport: true, fromSurface: true });
    return r.data;
  });
  await page.evaluate(() => {
    const old = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : k === 'captureSection' ? (() => Promise.resolve(null)) : old[k]) });
  });
}

test('B8 PNG(네이티브 CDP 길) — 빨강 50% ≈ (255,128,128) · 100 = (255,0,0)', async ({ page }) => {
  await page.setViewportSize({ width: 1200, height: 900 });
  const errs = await setup(page);
  await installCdpCapture(page);
  await page.evaluate(() => window.deselectAll?.());
  const shoot = () => page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    if (!ex.isNativeCapture()) throw new Error('전제: 네이티브 길이 아니다');
    const sec = document.querySelector('.section-block'), F = document.getElementById('opF');
    const sr = sec.getBoundingClientRect(), fr = F.getBoundingClientRect(), z = sr.width / 860;   // 화면 배율 → 860 기준
    const gx = (fr.right - sr.left) / z - 10, gy = (fr.bottom - sr.top) / z - 10;
    const clone = await ex.prepareCloneForCapture(sec, 860, true); ex.renderComponentsInClone(clone);
    const { canvas, native } = await ex.captureCloneToCanvas(clone, 860, '#ffffff', true, sec); clone.remove();
    if (!native) throw new Error('전제: native 갈래를 안 탔다');
    const s = canvas.width / 860;
    return [...canvas.getContext('2d').getImageData(Math.round(gx * s), Math.round(gy * s), 1, 1).data].slice(0, 3);
  });
  const full = await shoot();
  expect(full, '양성대조: 100 에서 빨강이 아니다(자리를 잘못 잼)').toEqual([255, 0, 0]);
  await page.evaluate(() => window.setBlockOpacity(document.getElementById('opF'), 50));
  const half = await shoot();
  console.log('[B8]', JSON.stringify({ full, half }));
  expect(half[0]).toBeGreaterThanOrEqual(250);
  for (const c of [half[1], half[2]]) { expect(c).toBeGreaterThanOrEqual(118); expect(c).toBeLessThanOrEqual(138); }
  expect(errs, errs.join(' | ')).toEqual([]);
});
