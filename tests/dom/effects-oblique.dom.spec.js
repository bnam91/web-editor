/* effects-oblique.dom.spec.js — 텍스트 블럭 「Effects」 에 «오블리크(롱섀도)» 식구 (TEXT-FX-OBLIQUE-01 · 2026-11-21 · 제니)
 *
 * ★재는 것
 *   O0 전제(명부·목록·도형엔 없음) · O1 고르면 그것만(기본 12겹 45°) · O2 값 → 그림
 *   ★O3 글로우·그림자와 공존(합성 문 — CTL: effects-glow.js 합성 문에서 오블리크를 빼면 빨강)
 *   O4 눈/✕/바이트 동일 · O5 저장 왕복·옛 문서 무변 · O6 Figma 8겹 상한 솎음 · O7 내보내기(HTML·PNG) + 렌더 png
 * 렌더 png 는 OBLIQUE_PNG_DIR(기본 ~/gd-team-261121/jn-oblique-png)에 남긴다 — 앱 패널 · PNG 내보내기 · 8겹 솎음 계단 비교.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/effects-oblique.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { bootApp } = require('./_root-harness.js');
const { addFx, fxAddKeys, fxAddLabel } = require('./_fx-add.js');

const OUT = process.env.OBLIQUE_PNG_DIR || path.join(os.homedir(), 'gd-team-261121', 'jn-oblique-png');
const savePng = (name, buf) => { fs.mkdirSync(OUT, { recursive: true }); fs.writeFileSync(path.join(OUT, name), buf); };

/* 장면: effects-glow.dom.spec.js setup 꼴 — [텍스트 eT 80px 파랑] [도형 eSh] */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="eI">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="eR1" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="eR3" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const { block: tb } = window.makeTextBlock('h1'); const tf = window._makeTextFrame();
    window.applyTextOpts(tb, tf, {}, 'h1'); tf.appendChild(tb); tb.id = 'eT'; tf.id = 'eTF';
    const h = tb.querySelector('[class^="tb-"]'); h.textContent = 'SALE'; h.style.color = '#ffcc00'; h.style.fontSize = '80px'; h.style.lineHeight = '1';
    document.getElementById('eR1').appendChild(tf);
    const { block: sb } = window.makeShapeBlock('rectangle'); sb.id = 'eSh';
    const ss = document.createElement('div'); ss.className = 'frame-block'; ss.id = 'eShF';
    ss.dataset.width = '100'; ss.dataset.height = '100'; ss.style.width = '100px'; ss.style.height = '100px';
    ss.appendChild(sb); document.getElementById('eR3').appendChild(ss);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  await page.waitForFunction(() => !!document.querySelector('#eT [class^="tb-"]') && !!document.getElementById('eSh'));
  return errs;
}

const PANEL_OF = { eT: 'txt', eSh: 'shape' };
const settle = (page, id) => page.waitForFunction((id) => {
  const e = document.getElementById(id); if (!e) return false;
  const r = e.getBoundingClientRect(); const k = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  const w = (window.__obSettle ||= {}); if (w[id] === k) { w[id + '#'] = (w[id + '#'] || 0) + 1; } else { w[id] = k; w[id + '#'] = 0; }
  return w[id + '#'] >= 5;
}, id, { polling: 'raf' });
const pick = async (page, id) => {
  await expect(async () => {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
    await settle(page, id);
    const p = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
    await page.evaluate(() => { window.deselectAll?.(); ['txt', 'shape'].forEach(P => document.getElementById(`${P}-fx-section`)?.remove()); });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(([id, P]) => document.getElementById(id).classList.contains('selected') && !!document.getElementById(`${P}-fx-section`), [id, PANEL_OF[id]], { timeout: 3000 });
  }).toPass({ timeout: 20000 });
};
const addList = (page, P) => fxAddKeys(page, P);   // ★기대 바뀜(시안 v10): 텍스트는 ＋ 메뉴 · 도형은 고르개 — 공용 _fx-add.js
const ds = (page, id) => page.evaluate((id) => Object.fromEntries(Object.entries(document.getElementById(id).dataset).filter(([k]) => k.startsWith('fx'))), id);
const splitTs = (ts) => { if (!ts || ts === 'none') return []; const out = []; let d = 0, cur = '';
  for (const ch of ts) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim()); return out; };
const layers = async (page) => splitTs(await page.evaluate(() => getComputedStyle(document.querySelector('#eT [class^="tb-"]')).textShadow));
const set = (page, patch) => page.evaluate((p) => window.setFxOblique(document.getElementById('eT'), p), patch);
const addOblique = async (page) => {
  await addFx(page, 'txt', 'oblique');
  await page.waitForFunction(() => !!document.getElementById('txt-fxob-card'));
};
/** 글자 둘레 사각(뷰포트 좌표) — 그림자 자리까지 pad 만큼 넓힌다. */
const textBox = (page, pad = 60) => page.evaluate((pad) => { const h = document.querySelector('#eT [class^="tb-"]'); h.scrollIntoView({ block: 'center' });
  const rg = document.createRange(); rg.selectNodeContents(h); const q = rg.getBoundingClientRect();
  return { x: Math.max(0, Math.round(q.left - 10)), y: Math.max(0, Math.round(q.top - 10)), width: Math.round(q.width + pad), height: Math.round(q.height + pad) }; }, pad);
/** png 속 «어두운 점»(오블리크 기본색 #1a1a1a 쪽) 수 — 바탕(흰)·글자(노랑)는 안 센다. */
const darkCount = (page, buf) => page.evaluate(async (b64) => {
  const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
  const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
  const d = x.getImageData(0, 0, c.width, c.height).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 80 && d[i + 1] < 80 && d[i + 2] < 80 && d[i + 3] > 200) n++;
  return n;
}, buf.toString('base64'));

/* ══ O0 전제 ══ */
test('O0 전제 — 명부에 oblique · 텍스트 목록에 «오블리크» · 도형 목록엔 없음', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => window.fxTypeKeys())).toEqual(expect.arrayContaining(['glow', 'oblique']));
  await pick(page, 'eT');
  expect(await addList(page, 'txt')).toEqual(expect.arrayContaining(['glow', 'oblique']));
  expect(await fxAddLabel(page, 'txt', 'oblique')).toBe('오블리크');
  await pick(page, 'eSh'); expect(await addList(page, 'shape'), '도형 — 오블리크 없음').not.toContain('oblique');
  expect(errs).toEqual([]);
});

/* ══ O1 고르면 그것만 ══ */
test('O1 목록에서 고르면 — 키 {fxOblique:on} · 카드 · 기본 12겹(45° · 끝 겹 8.5px 8.5px) · 칸 = 각도·길이·불투명도·색상', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  expect(await layers(page), '전제 — 0겹').toEqual([]);
  await addOblique(page);
  expect(await ds(page, 'eT')).toEqual({ fxOblique: 'on' });
  const L = await layers(page);
  expect(L.length, '★기본 길이 12 = 12겹').toBe(12);
  expect(L[0]).toContain('0.7px 0.7px 0px');
  expect(L[11], '끝 겹 = 12·cos45').toContain('8.5px 8.5px 0px');
  expect(L.every(l => l.includes('rgb(26, 26, 26)')), '기본색 #1a1a1a').toBe(true);
  expect(await page.evaluate(() => [...document.querySelectorAll('#txt-fxob-body .prop-label')].map(e => e.textContent.trim()))).toEqual(['각도', '길이', '불투명도', '색상']);
  expect(await page.locator('#txt-fxob-figma-hint').count(), '12 > 8 → Figma 솎음 안내가 보인다').toBe(1);
  expect(await page.evaluate(() => { window.deselectAll?.(); return getComputedStyle(document.getElementById('eTF')).overflow; }), '★(고름 풀고) 텍스트 프레임이 롱섀도를 안 자른다').toBe('visible');
  expect(errs).toEqual([]);
});

/* ══ O2 값 → 그림 ══ */
test('O2 슬라이더 — 길이 5 → 5겹 · 각도 0 → 오른쪽(5px 0px) · 불투명도 50 → alpha 0.5 · hex', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT'); await addOblique(page);
  const slide = (k, v) => page.evaluate(([k, v]) => { const s = document.getElementById(`txt-fxob-${k}-slider`); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, [k, v]);
  await slide('len', '5'); await expect.poll(async () => (await layers(page)).length).toBe(5);
  await slide('angle', '0'); await expect.poll(async () => (await layers(page))[4]).toContain('5px 0px 0px');
  await slide('op', '50'); await expect.poll(async () => (await layers(page))[0]).toContain('0.5)');
  await page.fill('#txt-fxob-color-hex', 'FF0000'); await page.locator('#txt-fxob-color-hex').dispatchEvent('change');
  await expect.poll(async () => (await layers(page)).join('|')).toContain('rgba(255, 0, 0, 0.5)');
  expect(await ds(page, 'eT')).toEqual({ fxOblique: 'on', fxObliqueLen: '5', fxObliqueAngle: '0', fxObliqueOp: '50', fxObliqueColor: '#ff0000' });
  expect(errs).toEqual([]);
});

/* ══ O3 ★공존 ══ */
test('O3 ★글로우·그림자와 공존 — [글로우 3, 사용자 1, 오블리크 n] · 그림자 ✕ · 글로우 ✕ 뒤에도 오블리크가 남는다', async ({ page }) => {
  const errs = await setup(page);
  await set(page, { state: 'on', len: 4 });
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { state: 'on', color: '#00ff00' }));
  await pick(page, 'eT');
  await addFx(page, 'txt', 'shadow');
  await page.waitForFunction(() => document.querySelector('#eT [class^="tb-"]').dataset.shadowEnabled === 'true');
  let L = await layers(page);
  expect(L.length, `★3+1+4 = 8 · ${L.join(' | ')}`).toBe(8);
  expect(L.slice(0, 3).every(l => l.includes('rgb(0, 255, 0)')), '글로우가 위').toBe(true);
  expect(L.slice(4).every(l => l.includes('rgb(26, 26, 26)')), '★오블리크가 맨 아래(뒤)').toBe(true);
  await page.click('#txt-fxsh-del');
  await page.waitForFunction(() => document.querySelector('#eT [class^="tb-"]').dataset.shadowEnabled !== 'true');
  expect((await layers(page)).length, '그림자 ✕ → 3+4').toBe(7);
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { state: 'none' }));
  L = await layers(page);
  expect(L.length, '★글로우 ✕ 뒤에도 오블리크 4').toBe(4);
  expect(L.every(l => l.includes('rgb(26, 26, 26)'))).toBe(true);
  expect(errs).toEqual([]);
});

/* ══ O4 눈 · ✕ · 바이트 ══ */
test('O4 눈 끄면 0겹(값 보존) · ✕ → 키 전부 지움 · outerHTML 이 켜기 전과 바이트 같다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  const before = await page.evaluate(() => document.getElementById('eT').outerHTML.replace(/ selected\b/g, ''));
  await addOblique(page);
  await page.fill('#txt-fxob-len-num', '20'); await page.locator('#txt-fxob-len-num').dispatchEvent('change');
  await page.waitForFunction(() => document.getElementById('eT').dataset.fxObliqueLen === '20');
  await page.click('#txt-fxob-eye');
  await page.waitForFunction(() => document.getElementById('eT').dataset.fxOblique === 'off');
  expect(await layers(page), '눈 끔 → 0겹').toEqual([]);
  expect((await ds(page, 'eT')).fxObliqueLen, '값은 남는다').toBe('20');
  await page.click('#txt-fxob-eye');
  await expect.poll(async () => (await layers(page)).length).toBe(20);
  await page.click('#txt-fxob-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxob-card'));
  expect(await ds(page, 'eT')).toEqual({});
  expect(await page.evaluate(() => { window.deselectAll?.(); return getComputedStyle(document.getElementById('eTF')).overflow; }), '✕ 뒤 프레임은 다시 자른다(옛 동작)').not.toBe('visible');
  expect(await page.evaluate(() => document.getElementById('eT').outerHTML.replace(/ selected\b/g, '')), '★바이트 동일').toBe(before);
  expect(errs).toEqual([]);
});

/* ══ O5 저장 왕복 · 옛 문서 ══ */
test('O5 저장 → 다시 열기 — 키·인라인 그대로 · watchAllFx 멱등 · 키 없는 옛 문서는 한 글자도 안 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  const old0 = await page.evaluate(() => document.getElementById('eT').outerHTML);
  expect(await page.evaluate(() => window.watchAllFxOblique(document.getElementById('canvas'))), '옛 문서 — 걸린 블럭 0').toBe(0);
  expect(await page.evaluate(() => document.getElementById('eT').outerHTML), '옛 문서 무변').toBe(old0);
  await set(page, { state: 'on', angle: 120, len: 9, color: '#3300aa' });
  const st0 = await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').style.textShadow);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.getElementById('eT'));
  expect(await ds(page, 'eT')).toEqual({ fxOblique: 'on', fxObliqueAngle: '120', fxObliqueLen: '9', fxObliqueColor: '#3300aa' });
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').style.textShadow)).toBe(st0);
  expect(await page.evaluate(() => window.watchAllFx(document.getElementById('canvas')))).toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').style.textShadow), '재합성 멱등').toBe(st0);
  expect(errs).toEqual([]);
});

/* ══ O6 Figma 8겹 ══ */
test('O6 Figma JSON — 오블리크 40 + 글로우 3 → 총 8겹(오블리크 5 · 끝 겹 = 전체 길이) · 오블리크 없으면 옛 값 그대로', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  /* ★내보내기는 직렬화본(state.pages)을 돈다 — 손으로 꽂은 장면 대신 앱의 진짜 넣기 문(addTextBlock)으로 */
  await page.evaluate(() => { if (!document.querySelector('#canvas .section-block')) window.addSection(); const sec = [...document.querySelectorAll('#canvas .section-block')].pop(); window.deselectAll?.(); window.selectSection?.(sec); window.addTextBlock('h1', { content: 'SALE' }); const tb = [...document.querySelectorAll('#canvas .text-block')].pop(); tb.id = 'eF'; });
  const tb = (fn, a) => page.evaluate(([f, a]) => window[f](document.getElementById('eF'), a), [fn, a]);
  const figTs = () => page.evaluate(() => { const find = (o) => { if (!o || typeof o !== 'object') return null;
    if (o.style && typeof o.style.textShadow === 'string' && /SALE/.test(JSON.stringify(o))) return o.style.textShadow;
    for (const v of Object.values(o)) { const r = find(v); if (r != null) return r; } return null; }; return find(window.buildFigmaExportJSON(null)); });
  await tb('setFxGlow', { state: 'on' });
  const glowOnly = await figTs();
  expect(glowOnly, '★전제 — JSON 에 글자 노드가 있다').not.toBeNull();
  expect(splitTs(glowOnly).length, '오블리크 없음 = 옛 길(글로우 3)').toBe(3);
  expect(await page.evaluate(() => window.fxFigmaTextShadow(document.querySelector('#eF [class^="tb-"]'))), '오블리크 없음 → null(옛 길)').toBeNull();
  await tb('setFxOblique', { state: 'on', len: 40, angle: 0 });
  expect(splitTs(await page.evaluate(() => getComputedStyle(document.querySelector('#eF [class^="tb-"]')).textShadow)).length, '화면은 43겹 그대로').toBe(43);
  const F = splitTs(await figTs());
  expect(F.length, `★Figma ≤ 8 · ${F.join(' | ')}`).toBe(8);
  expect(F[7], '끝 겹 = 전체 길이 40px').toMatch(/^40px 0px 0px/);
  expect(errs).toEqual([]);
});

/* ══ O7 내보내기 + 렌더 png ══ */
test('O7 내보내기 — HTML 에 오블리크 text-shadow · PNG(CDP 갈래)에 그림자 픽셀(양성/음성) · 앱 패널·8겹 계단 png', async ({ page }) => {
  const errs = await setup(page);
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x, y, width, height, scale }, captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { window.electronAPI = new Proxy({}, { get: (t, k) => k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : (() => Promise.resolve(null)) }); });
  const exportPng = async () => Buffer.from((await page.evaluate(async () => {
    const r = await window.exportSection(document.getElementById('eS'), 'png', 860, { returnDataUrl: true });
    return typeof r === 'string' ? r : (r.dataUrl || r.url);
  })).split(',')[1], 'base64');

  const png0 = await exportPng();
  await set(page, { state: 'on', len: 24, angle: 45 });
  const png1 = await exportPng();
  savePng('export-section.png', png1);
  const d0 = await darkCount(page, png0), d1 = await darkCount(page, png1);
  console.log(`[O7] PNG 어두운 점 — 끈 판 ${d0} · 켠 판 ${d1}`);
  expect(d1, '★PNG 에 롱섀도가 그려졌다(양성 ≫ 음성)').toBeGreaterThan(d0 + 2000);

  /* HTML — 저장되는 글자칸 인라인에 오블리크 겹이 있다(내보내기는 캔버스 DOM 을 그대로 싣는다) */
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = fs.readFileSync(await dh.path(), 'utf8');
  expect(html, '★HTML 에 끝 겹(24·cos45 = 17px)').toMatch(/17px 17px 0px/);
  expect(html).toContain('data-fx-oblique="on"');

  /* 앱 패널 png — 카드가 펼쳐진 우측 패널 + 캔버스 글자 */
  await pick(page, 'eT');
  await page.locator('#txt-fxob-card').scrollIntoViewIfNeeded();
  savePng('app-panel-card.png', await page.locator('#txt-fxob-card').screenshot());
  savePng('app-canvas-text.png', await page.screenshot({ clip: await textBox(page) }));

  /* 8겹 솎음 계단 — 같은 글자를 화면 판(24겹)과 Figma 판(8겹)으로 나란히. Figma 그림자 ≈ text-shadow(blur 0) 로 근사해 그린다. */
  const figCss = await page.evaluate(() => window.fxFigmaTextShadow(document.querySelector('#eT [class^="tb-"]')));
  expect(splitTs(figCss).length).toBe(8);
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(1, 1);   /* 고름·hover 칠 빼고 찍는다 */
  const box = await textBox(page);
  const full = await page.screenshot({ clip: box });
  await page.evaluate((css) => { document.querySelector('#eT [class^="tb-"]').style.textShadow = css; }, figCss);
  const thin = await page.screenshot({ clip: box });
  savePng('stair-full-24.png', full); savePng('stair-figma-8.png', thin);
  const df = await darkCount(page, full), dt = await darkCount(page, thin);
  console.log(`[O7] 계단 — 화면 24겹 어두운 점 ${df} · Figma 8겹 ${dt} (비 ${(dt / df).toFixed(2)})`);
  expect(errs).toEqual([]);
});
