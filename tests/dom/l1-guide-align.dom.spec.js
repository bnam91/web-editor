/* l1-guide-align.dom.spec.js — L1 「그리드 가이드 켜고 섹션 조절하면 칼럼 어긋남 · 섹션별로도」 (지디 승인 안 ②)
 *
 * «맞음»: 섹션마다 가이드 칼럼 n 개가 «그 섹션 .section-inner 내용 상자»(좌우 패딩 안쪽)를 채운다 —
 *   첫 칼럼 왼끝 = 내용 왼끝 · 마지막 칼럼 오른끝 = 내용 오른끝 (±0.5 화면px) · 칼럼 수 = n.
 * ★«렌더된 픽셀»로 잰다 — 섹션 안 한 줄을 가로로 훑어 칼럼색(빨강 기) 구간을 찾는다. 변수(값)가 아니라 그림을 본다.
 * 조작은 패널의 «진짜 입력칸»에 값을 넣고 input/change 를 낸다(사람 손과 같은 핸들러).
 * 양성대조: 6119145c(고치기 전)에서 동작 1·2·4·7 이 빨강(측정 L1-DESIGN.md: +96/+80px) — GD1001_ROOT 로 같은 시험을 돌린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/l1-guide-align.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const TOL = 0.5;
const SEC = (id) => `<div class="section-block" id="${id}" data-section="1" data-name="${id}"><div class="section-hitzone"></div><div class="section-inner" id="${id}-in">
  <div class="gap-block" data-type="gap" style="height:160px"></div><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`;

async function setup(page, zoom, ids = ['sA', 'sB']) {
  await page.setViewportSize({ width: 1600, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    try { localStorage.removeItem('gdt.gridGuide'); } catch (_) {}
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyPagePadX?.(32); window.applyZoom?.(100);
  }, ids.map(SEC).join(''));
  await page.waitForTimeout(150);
  await gridOn(page, true);
  if (zoom !== 100) await page.evaluate((z) => window.applyZoom(z), zoom);
  await page.waitForTimeout(250);
  expect(await page.evaluate(() => window.currentZoom), `전제 — 배율 ${zoom}`).toBe(zoom);
  expect(await page.evaluate(() => document.body.classList.contains('gdt-grid-on')), '전제 — 가이드 켬').toBe(true);
  return errs;
}
const gridOn = (page, on) => page.evaluate((on) => { window.deselectAll?.(); window.showPageProperties();
  const el = document.getElementById(on ? 'page-grid-on' : 'page-grid-off'); el.checked = true; el.dispatchEvent(new Event('change', { bubbles: true })); }, on);
const setPagePadX = (page, v) => page.evaluate((v) => { window.deselectAll?.(); window.showPageProperties();
  const s = document.getElementById('page-padx-slider'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, v);
const setSecPadX = (page, id, v) => page.evaluate(async ([id, v]) => { await window.showSectionProperties(document.getElementById(id));
  const s = document.getElementById('sec-padx-slider'); s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); }, [id, v])
  .then(() => page.waitForTimeout(700));   // ★패딩 비주얼(분홍 띠)이 400ms 뒤 꺼질 때까지 — 안 기다리면 그 띠를 칼럼색으로 센다(실측 첫 판: ±80px)
const setAssetExclude = (page, on) => page.evaluate((on) => { window.deselectAll?.(); window.showPageProperties();
  const c = document.getElementById('page-padx-asset'); c.checked = on; c.dispatchEvent(new Event('change', { bubbles: true })); }, on);
const setPreset = (page, id) => page.evaluate(async (id) => { await window.showSectionProperties(document.getElementById(id));
  const s = document.getElementById('sec-preset'); const opt = s && [...s.options].find(o => o.value && o.value !== s.value);
  if (!opt) return null; s.value = opt.value; s.dispatchEvent(new Event('change', { bubbles: true })); return opt.value; }, id);

/* 섹션 하나의 내용 상자 vs 칼럼색 구간(화면 픽셀 한 줄) */
async function scan(page, innerSel) {
  const box = await page.evaluate((sel) => {
    const i = document.querySelector(sel); if (!i) return null;
    const cs = getComputedStyle(i), r = i.getBoundingClientRect(), k = window.currentZoom / 100;
    if (r.width === 0) return { hidden: true };
    return { l: r.left + parseFloat(cs.paddingLeft) * k, r: r.left + (i.clientWidth - parseFloat(cs.paddingRight)) * k,
             y: r.top + Math.min(40 * k, r.height / 2), x0: r.left - 2, x1: r.right + 2, padL: parseFloat(cs.paddingLeft), padR: parseFloat(cs.paddingRight) };
  }, innerSel);
  if (!box || box.hidden) return { box, missing: true };
  const buf = await page.screenshot();
  const runs = await page.evaluate(async ([b64, box]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0);
    const d = img.width / window.innerWidth, Y = Math.round(box.y * d), X0 = Math.max(0, Math.floor(box.x0 * d)), X1 = Math.min(img.width, Math.ceil(box.x1 * d));
    const row = x.getImageData(X0, Y, X1 - X0, 1).data; const out = []; let s = -1;
    for (let i = 0; i < X1 - X0; i++) { const t = row[i * 4] > row[i * 4 + 1] + 8; if (t && s < 0) s = i; if (!t && s >= 0) { out.push([(X0 + s) / d, (X0 + i) / d]); s = -1; } }
    if (s >= 0) out.push([(X0 + s) / d, X1 / d]);
    return out;
  }, [buf.toString('base64'), box]);
  const n = await page.evaluate(() => parseInt(document.getElementById('page-grid-cols')?.value || '12'));
  return { n, count: runs.length, firstL: runs.length ? +(runs[0][0] - box.l).toFixed(2) : null, lastR: runs.length ? +(runs[runs.length - 1][1] - box.r).toFixed(2) : null, padL: box.padL, padR: box.padR };
}
const aligned = (m) => !m.missing && m.count === m.n && Math.abs(m.firstL) <= TOL && Math.abs(m.lastR) <= TOL;

const ACTIONS = [
  ['0 기준(페이지 padX 32)', async () => {}],
  ['1 섹션 B 좌우 패딩 80', async (p) => setSecPadX(p, 'sB', 80)],
  ['2 섹션 A(첫째) 좌우 패딩 80', async (p) => setSecPadX(p, 'sA', 80)],
  ['3 페이지 좌우 패딩 60', async (p) => setPagePadX(p, 60)],
  ['4 섹션 A 덮어쓰기 20 → 페이지 패딩 60', async (p) => { await setSecPadX(p, 'sA', 20); await setPagePadX(p, 60); }],
  ['5 에셋블록 제외 끔', async (p) => setAssetExclude(p, false)],
  ['6 섹션 A 프리셋 바꾸기', async (p) => setPreset(p, 'sA')],
  ['7 섹션 B 패딩 80 → 가이드 껐다 켜기', async (p) => { await setSecPadX(p, 'sB', 80); await gridOn(p, false); await gridOn(p, true); }],
];

for (const zoom of [100, 40]) for (const [name, act] of ACTIONS) {
  test(`L1-A 배율 ${zoom} · ${name} — 섹션마다 칼럼 = 자기 내용 상자`, async ({ page }) => {
    const errs = await setup(page, zoom);
    await act(page); await page.waitForTimeout(250);
    for (const id of ['sA', 'sB']) {
      const m = await scan(page, `#${id}-in`);
      expect(aligned(m), `★${id} 칼럼 ${m.count}/${m.n} · 왼끝 ${m.firstL} · 오른끝 ${m.lastR} px (패딩 ${m.padL}/${m.padR})`).toBe(true);
    }
    expect(errs).toEqual([]);
  });
}

/* ㉢ 합친 섹션 — 섹션 B 를 A 에 합친 뒤(진짜 함수 mergeSelectedSectionUp), A 의 .section-inner 가이드가 맞나 ·
   합쳐 넣은 상자(.section-merged-part)의 내용 상자와의 차이는 «사실»로 남긴다(가이드는 .section-inner 에 그린다). */
for (const zoom of [100, 40]) test(`L1-M 배율 ${zoom} · 합친 섹션(B 를 A 로) — A 칼럼 = A 내용 상자`, async ({ page }) => {
  const errs = await setup(page, zoom);
  await setSecPadX(page, 'sB', 80);
  const ok = await page.evaluate(() => { window.deselectAll?.(); document.getElementById('sB').classList.add('selected'); return window.mergeSelectedSectionUp(); });
  expect(ok, '전제 — 합쳐졌다').toBeTruthy();
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => ({ b: !!document.getElementById('sB'), part: document.querySelectorAll('#sA .section-merged-part').length })), '전제 — B 는 A 안의 상자가 됐다').toEqual({ b: false, part: 1 });
  const m = await scan(page, '#sA-in');
  expect(aligned(m), `★A 칼럼 ${m.count}/${m.n} · 왼끝 ${m.firstL} · 오른끝 ${m.lastR}`).toBe(true);
  const part = await page.evaluate(() => { const p = document.querySelector('#sA .section-merged-part'), cs = getComputedStyle(p), i = document.getElementById('sA-in'), ics = getComputedStyle(i), k = window.currentZoom / 100;
    const pr = p.getBoundingClientRect(), ir = i.getBoundingClientRect();
    return { partContentL: +(pr.left + parseFloat(cs.paddingLeft) * k - (ir.left + parseFloat(ics.paddingLeft) * k)).toFixed(2), partContentR: +((pr.right - parseFloat(cs.paddingRight) * k) - (ir.left + (i.clientWidth - parseFloat(ics.paddingRight)) * k)).toFixed(2) }; });
  test.info().annotations.push({ type: '합쳐 넣은 상자 내용 상자 − A 내용 상자(화면 px, 사실 기록)', description: JSON.stringify(part) });
  const mp = await scan(page, '#sA .section-merged-part');
  test.info().annotations.push({ type: '합쳐 넣은 상자 안 칼럼색 구간(사실 기록)', description: JSON.stringify(mp) });
  console.log('L1M', JSON.stringify({ zoom, part, mergedPartScan: mp }));
  expect(errs).toEqual([]);
});

/* ㉢ A/B 변형 — A 의 B 안을 만들고(createVariation), B 안 패딩을 80 으로 바꾼 뒤 B 를 켠다(toggleVariation) — 보이는 섹션의 칼럼이 맞나 */
for (const zoom of [100, 40]) test(`L1-V 배율 ${zoom} · A/B 변형(B 안 패딩 80) — 보이는 섹션 칼럼 = 자기 내용 상자`, async ({ page }) => {
  const errs = await setup(page, zoom);
  const bId = await page.evaluate(async () => { const m = await import('/js/section-variation.js'); const a = document.getElementById('sA'); m.createVariation(a);
    const b = [...document.querySelectorAll('.section-block')].find(s => s.dataset.variationGroup === a.dataset.variationGroup && s.dataset.variation === 'B'); return b && b.id; });
  expect(bId, '전제 — B 안이 생겼다').toBeTruthy();
  await page.evaluate(async (bId) => { const m = await import('/js/section-variation.js'); m.toggleVariation(document.getElementById('sA')); }, bId);
  await page.waitForTimeout(200);
  const vis = await page.evaluate((bId) => ({ a: document.getElementById('sA').getBoundingClientRect().height > 0, b: document.getElementById(bId).getBoundingClientRect().height > 0 }), bId);
  expect(vis, '전제 — B 가 보이고 A 가 숨었다').toEqual({ a: false, b: true });
  await setSecPadX(page, bId, 80); await page.waitForTimeout(200);
  const m = await scan(page, `#${bId} .section-inner`);
  expect(aligned(m), `★B 칼럼 ${m.count}/${m.n} · 왼끝 ${m.firstL} · 오른끝 ${m.lastR} (패딩 ${m.padL})`).toBe(true);
  const mB = await scan(page, '#sB-in');
  expect(aligned(mB), `★아래 섹션 sB 칼럼 ${mB.count}/${mB.n} · 왼끝 ${mB.firstL} · 오른끝 ${mB.lastR}`).toBe(true);
  expect(errs).toEqual([]);
});

/* ⑶ 반올림 — 섹션 패딩 × 칼럼 수 × 거터 × 배율 조합에서 최대 오차(화면 px). 합격선 ±0.5 */
test('L1-R 반올림 — 조합별 최대 오차 ≤ 0.5px', async ({ page }) => {
  test.setTimeout(180000);
  const errs = await setup(page, 100, ['sA']);
  const rows = []; let worst = 0;
  for (const zoom of [100, 40]) {
    await page.evaluate((z) => window.applyZoom(z), zoom); await page.waitForTimeout(250);
    for (const [n, g] of [[12, 10], [6, 10], [7, 13], [24, 2], [5, 80]]   /* 거터 0 은 칼럼이 한 덩이로 붙어 «개수»를 못 센다 — 2 로 */) {
      await page.evaluate(([n, g]) => { window.deselectAll?.(); window.showPageProperties();
        const c = document.getElementById('page-grid-cols'), u = document.getElementById('page-grid-gut');
        c.value = n; c.dispatchEvent(new Event('change', { bubbles: true })); u.value = g; u.dispatchEvent(new Event('change', { bubbles: true })); }, [n, g]);
      for (const pad of [0, 7, 33, 57, 100]) {
        await setSecPadX(page, 'sA', pad); await page.waitForTimeout(120);
        const m = await scan(page, '#sA-in');
        const e = Math.max(Math.abs(m.firstL ?? 99), Math.abs(m.lastR ?? 99));
        worst = Math.max(worst, e); rows.push({ zoom, n, g, pad, count: m.count, firstL: m.firstL, lastR: m.lastR });
      }
    }
  }
  console.log('L1R', JSON.stringify({ worst, rows }));
  test.info().annotations.push({ type: '반올림 최대 오차(화면 px)', description: String(worst) });
  /* 칼럼 «개수»는 거터가 화면 2px 이상일 때만 센다 — 40% 에서 거터 2px = 화면 0.8px 이라 칼럼이 붙어 보여 못 센다(측정 도구 해상도 · 정렬과 무관). 끝 오차는 전부 본다. */
  const countable = rows.filter(r => r.g * r.zoom / 100 >= 2);
  expect(countable.every(r => r.count === r.n), `칼럼 수 ${JSON.stringify(countable.filter(r => r.count !== r.n))}`).toBe(true);
  expect(worst, `★최대 오차 ${worst}px`).toBeLessThanOrEqual(TOL);
  expect(errs).toEqual([]);
});

/* ㉡·⑵ 누출 — 가이드 켠 채 ⑴ 썸네일(진짜 saveProjectToFile → captureThumbnail · electronAPI 가로채기) ⑵ PNG(exportSection:
 *   html2canvas 길(forceH2C) 픽셀 + 네이티브 길(electronAPI.captureSection 이 불리는 «순간» body 클래스)).
 * ★자가 빨강 대조: 가이드를 «linear-gradient» 로 바꾼 변이를 주입한다 — html2canvas 는 repeating 을 못 그려서 «우연히» 안 샌다.
 *   linear 는 그린다(측정: [255,127,127]). 가드가 없으면(6119145c 썸네일) 칼럼 자리가 빨개져야 한다. */
const LINEAR = 'body.gdt-grid-on .section-inner{background-image:linear-gradient(to right, rgba(255,0,0,.5) 0, rgba(255,0,0,.5) 50%, transparent 50%) !important;background-repeat:no-repeat !important}';
test('L1-X 누출 — 썸네일 · PNG(h2c·네이티브) 칼럼 자리 = 흰색 (linear 변이로도)', async ({ page }) => {
  const errs = await setup(page, 100, ['sA']);
  await page.evaluate((css) => { const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st); }, LINEAR);
  await page.waitForTimeout(100);
  // 전제 — 화면에는 변이 가이드가 «보인다»(왼쪽 1/4 지점 빨강)
  const live = await page.evaluate(() => { const i = document.getElementById('sA-in'), r = i.getBoundingClientRect(); return [r.left + 100, r.top + 40]; });
  const shotPx = await page.evaluate(async ([b64, pt]) => { const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height; const x = c.getContext('2d'); x.drawImage(img, 0, 0); const d = img.width / window.innerWidth;
    return Array.from(x.getImageData(Math.round(pt[0] * d), Math.round(pt[1] * d), 1, 1).data.slice(0, 3)); }, [(await page.screenshot()).toString('base64'), live]);
  expect(shotPx[0] > shotPx[1] + 30, `전제 — 화면엔 변이 가이드가 보인다 ${JSON.stringify(shotPx)}`).toBe(true);
  const r = await page.evaluate(async () => {
    const decode = async (u, X, Y) => { const img = new Image(); img.src = u; await img.decode(); const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
      const x = c.getContext('2d'); x.drawImage(img, 0, 0); const k = img.width / 860; return Array.from(x.getImageData(Math.round(X * k), Math.round(Y * k), 1, 1).data.slice(0, 3)); };
    const out = {};
    // ⑴ 썸네일 — 진짜 저장 길
    const real = window.electronAPI; const got = [];
    window.electronAPI = new Proxy({}, { get: (t, k) => (...args) => { for (const a of args) { const s = typeof a === 'string' ? a : (() => { try { return JSON.stringify(a); } catch (_) { return ''; } })(); const m = s && s.match(/data:image\/[a-z]+;base64,[A-Za-z0-9+/=]{100,}/); if (m) got.push(m[0]); } return Promise.resolve(null); } });
    try { const m = await import('/js/io/save-load.js'); await m.saveProjectToFile(undefined, { projectId: 'p_l1_thumb' }); } catch (e) { out.thumbErr = String(e); }
    window.electronAPI = real;
    out.thumbGot = got.length;
    out.thumbPx = got.length ? await decode(got[0], 100, 40) : null;
    out.classAfterThumb = document.body.classList.contains('gdt-grid-on');
    // ⑵-a PNG html2canvas 길
    try { const u = await window.exportSection(document.getElementById('sA'), 'png', 860, { returnDataUrl: true, forceH2C: true }); out.pngH2CPx = await decode(u, 100, 40); } catch (e) { out.pngH2CErr = String(e && (e.message || e.type) || e); }
    // ⑵-b PNG 네이티브 길 — captureSection 이 불리는 «순간» 클래스
    const seen = []; const real2 = window.electronAPI;
    const PNG1 = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
    window.electronAPI = new Proxy({}, { get: (t, k) => ((k === 'captureSection' || k === 'captureSectionCdp') ? (...a) => { seen.push(document.body.classList.contains('gdt-grid-on')); return Promise.resolve(PNG1); } : real2[k]) });
    try { await window.exportSection(document.getElementById('sA'), 'png', 860, { returnDataUrl: true }); } catch (_) {}
    window.electronAPI = real2;
    out.nativeClassAtCapture = seen;
    out.classAfter = document.body.classList.contains('gdt-grid-on');
    return out;
  });
  console.log('L1X', JSON.stringify(r));
  const red = (px) => px && px[0] > px[1] + 30;
  expect(r.thumbGot, `전제 — 썸네일이 실제로 만들어졌다 ${JSON.stringify(r)}`).toBeGreaterThan(0);
  expect(red(r.thumbPx), `★썸네일 칼럼 자리 ${JSON.stringify(r.thumbPx)} — 빨강이면 가이드가 샜다`).toBe(false);
  expect(r.classAfterThumb, '썸네일 뒤 가이드 클래스 복원').toBe(true);
  expect(r.pngH2CPx, `전제 — PNG(h2c) 가 나왔다 ${r.pngH2CErr || ''}`).toBeTruthy();
  expect(red(r.pngH2CPx), `★PNG(h2c) 칼럼 자리 ${JSON.stringify(r.pngH2CPx)}`).toBe(false);
  expect(r.nativeClassAtCapture.length, '전제 — 네이티브 캡처가 불렸다').toBeGreaterThan(0);
  expect(r.nativeClassAtCapture.every(v => v === false), `★네이티브 캡처 순간 가이드 클래스 ${JSON.stringify(r.nativeClassAtCapture)}`).toBe(true);
  expect(r.classAfter, 'PNG 뒤 가이드 클래스 복원').toBe(true);
  expect(errs).toEqual([]);
});

/* ── L1-S 행동 시험(G5 가 대리하던 뜻) — 가이드를 켠 채 «저장»하면 저장 문자열에 gdt-grid 가 0번이다 ──
 *   재는 것: ⑴ serializeProject() 문자열 ⑵ 진짜 saveProjectToFile 이 electronAPI 로 넘기는 인자(가로채기) 안의 'gdt-grid' 개수.
 *   양성대조: 가이드 클래스를 «캔버스 안»(.section-inner)에도 붙이는 변이 판(GD1001_ROOT)에서 빨개진다. */
test('L1-S 가이드 켠 채 저장 — 저장 문자열의 gdt-grid 0번', async ({ page }) => {
  const errs = await setup(page, 100);
  await setSecPadX(page, 'sB', 80);   // 섹션 패널을 거쳐 가이드 상태에서 편집이 있었던 판
  const r = await page.evaluate(async () => {
    const count = (str) => (String(str).match(/gdt-grid/g) || []).length;
    const out = { bodyOn: document.body.classList.contains('gdt-grid-on') };
    out.serialize = count(window.serializeProject());
    const real = window.electronAPI; const args = [];
    window.electronAPI = new Proxy({}, { get: (t, k) => (...a) => { for (const x of a) { try { args.push(typeof x === 'string' ? x : JSON.stringify(x)); } catch (_) {} } return Promise.resolve(null); } });
    try { const m = await import('/js/io/save-load.js'); await m.saveProjectToFile(undefined, { projectId: 'p_l1_save' }); } catch (e) { out.err = String(e); }
    window.electronAPI = real;
    out.saveCalls = args.length; out.saveArgsChars = args.reduce((a, s) => a + (s ? s.length : 0), 0);
    out.saveArgs = args.reduce((a, s) => a + count(s), 0);
    return out;
  });
  console.log('L1S', JSON.stringify(r));
  expect(r.bodyOn, '전제 — 가이드가 켜져 있다').toBe(true);
  expect(r.saveCalls, `전제 — 저장이 실제로 electronAPI 로 나갔다 ${JSON.stringify(r)}`).toBeGreaterThan(0);
  expect(r.serialize, `★serializeProject 의 gdt-grid ${r.serialize}번`).toBe(0);
  expect(r.saveArgs, `★저장 인자의 gdt-grid ${r.saveArgs}번`).toBe(0);
  expect(errs).toEqual([]);
});
