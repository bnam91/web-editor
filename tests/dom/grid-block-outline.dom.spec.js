/* grid-block-outline.dom.spec.js — G17 「블럭 외곽선」(지디 2차 발주 2026-10-03) + G18 정렬 단추 픽셀 지킴.
 *
 * ★G17 — 그리드 «블럭 상자» 네 변을 변마다 켜고 끈다 + 「사방」·「없음」. 정본 = dataset.blockOutline(grid-block.js).
 *   재는 것: 우측 패널 단추를 «진짜 마우스»로 눌러 → 렌더된 블럭의 «계산된» border-*(변마다) · dataset ·
 *   ⌘Z/⇧⌘Z · 저장 왕복(serializeProject → 새로 띄운 앱에 applyProjectData) · PNG 클론 픽셀 · 단독 HTML 산출.
 *   양성대조: GD1001_ROOT=<37ab1c65 체크아웃> 에서 O1~O6 은 빨강이어야 한다(그 판엔 단추·모델이 없다).
 *
 * ★G18 — 그리드 Layout 절 정렬 단추 여섯(가로·세로)이 «고정 판 37ab1c65» 와 픽셀이 같고, 눌렀을 때 쓰는 값이 같다.
 *   ⛔비교 판을 HEAD 로 두지 않는다(고친 뒤엔 HEAD = 고친 판이라 대조가 공짜 초록이 된다) — git show 로 핀 판을 싣는다.
 *   이 시험은 «안 바뀜»을 지키는 시험이라 핀에서도 초록이어야 하고, 그림 하나를 바꾼 변이에서 빨강이어야 한다(보고서에 기록).
 *
 * 앱 통째(bootApp) · 헤드리스 · 고디터 인스턴스·MCP 대역 무접촉. 실행:
 *   npx playwright test --config=tests/dom/playwright.dom.config.js grid-block-outline */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT, ORIGIN } = require('./_root-harness.js');

const SIDES = ['Top', 'Right', 'Bottom', 'Left'];

async function setup(page, boot = bootApp) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await boot(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }], rows: [{ height: 'auto' }] });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  });
  await page.waitForTimeout(200);
  return errs;
}
/** 블럭을 진짜 마우스로 한 번 눌러 고른다(첫 클릭 = 블럭 선택 → 우측 패널). */
async function selectGrid(page) {
  const [x, y] = await page.evaluate(() => { const r = document.getElementById('gG').getBoundingClientRect(); return [r.left + 8, r.top + 8]; });
  await page.mouse.click(x, y); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.getElementById('gG').classList.contains('selected')), '전제 — 그리드가 골라졌다').toBe(true);
}
async function clickBtn(page, sel) {
  const p = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  expect(p, `패널에 ${sel} 가 있다`).not.toBeNull();
  await page.mouse.click(p[0], p[1]); await page.waitForTimeout(250);
}
const borders = (page) => page.evaluate((S) => { const cs = getComputedStyle(document.getElementById('gG'));
  return Object.fromEntries(S.map(s => [s, `${cs['border' + s + 'Width']} ${cs['border' + s + 'Style']}`])); }, SIDES);
const ds = (page) => page.evaluate(() => document.getElementById('gG').dataset.blockOutline ?? null);
const OFF = '0px none';

test('O0 전제 — 새 그리드엔 외곽선이 없다(네 변 0px · 키 없음) · 패널에 「블럭 외곽선」 단추 여섯이 «한 줄»에 잘림 없이 뜬다', async ({ page }) => {
  const errs = await setup(page);
  expect(await ds(page)).toBeNull();
  expect(await borders(page)).toEqual({ Top: OFF, Right: OFF, Bottom: OFF, Left: OFF });
  await selectGrid(page);
  const lay = await page.evaluate(() => {
    const g = document.getElementById('grd-outline-group'); if (!g) return null;
    const bs = [...g.querySelectorAll('button')].map(b => b.getBoundingClientRect());
    const sec = g.closest('.prop-section'); const title = sec.querySelector('.prop-section-title');
    const ref = document.querySelector('#grd-halign-group .prop-align-btn').getBoundingClientRect();
    const body = document.querySelector('#panel-right .panel-body') || document.getElementById('panel-right');
    const br = body.getBoundingClientRect();
    return { n: bs.length, tops: [...new Set(bs.map(r => Math.round(r.top)))], minW: Math.min(...bs.map(r => r.width)), h: bs.map(r => Math.round(r.height)),
      rightMax: Math.max(...bs.map(r => r.right)), bodyRight: br.right, title: title && title.textContent.trim(), refH: Math.round(ref.height),
      icon: [...g.querySelectorAll('svg')].map(s => s.getAttribute('width')) };
  });
  expect(lay, '패널에 #grd-outline-group 이 있다').not.toBeNull();
  expect(lay.title).toBe('블럭 외곽선');
  expect(lay.n, '단추 여섯(위·아래·왼쪽·오른쪽·사방·없음)').toBe(6);
  expect(lay.tops.length, `★한 줄이어야 한다 — 단추 윗변이 ${lay.tops.join(',')}`).toBe(1);
  expect(lay.rightMax, '★패널 오른쪽 밖으로 안 나간다').toBeLessThanOrEqual(lay.bodyRight);
  expect(lay.h.every(h => h === lay.refH), `단추 높이가 이웃 정렬 단추(${lay.refH})와 같다: ${lay.h}`).toBe(true);
  console.log(`[O0] 단추 최소폭 ${lay.minW.toFixed(1)}px · 아이콘 width ${[...new Set(lay.icon)]}`);
  expect(errs).toEqual([]);
});

test('O1 ★변 하나씩 — 누르면 그 변만 켜지고 다시 누르면 꺼진다(계산된 border · dataset)', async ({ page }) => {
  await setup(page); await selectGrid(page);
  for (const s of SIDES) {
    const k = s.toLowerCase();
    await clickBtn(page, `#grd-outline-group [data-outline-side="${k}"]`);
    const b = await borders(page);
    for (const t of SIDES) expect(b[t], `${s} 를 켰을 때 ${t}`).toBe(t === s ? '1px solid' : OFF);
    expect(await ds(page)).toBe(k);
    expect(await page.evaluate((k) => document.querySelector(`#grd-outline-group [data-outline-side="${k}"]`).classList.contains('active'), k), '켠 변 단추가 active').toBe(true);
    await clickBtn(page, `#grd-outline-group [data-outline-side="${k}"]`);
    expect(await borders(page)).toEqual({ Top: OFF, Right: OFF, Bottom: OFF, Left: OFF });
    expect(await ds(page), '다 끄면 키가 «지워진다»').toBeNull();
  }
  // 둘을 겹쳐 켜면 둘 다
  await clickBtn(page, '#grd-outline-group [data-outline-side="top"]');
  await clickBtn(page, '#grd-outline-group [data-outline-side="left"]');
  expect(await ds(page)).toBe('top,left');
  expect(await borders(page)).toEqual({ Top: '1px solid', Right: OFF, Bottom: OFF, Left: '1px solid' });
});

test('O2 ★「사방」은 네 변 · 「없음」은 전부 끄고 style 에 border 흔적을 안 남긴다', async ({ page }) => {
  await setup(page); await selectGrid(page);
  await clickBtn(page, '#grd-outline-group [data-outline-all="1"]');
  expect(await borders(page)).toEqual({ Top: '1px solid', Right: '1px solid', Bottom: '1px solid', Left: '1px solid' });
  expect(await ds(page)).toBe('top,right,bottom,left');
  await clickBtn(page, '#grd-outline-group [data-outline-all="0"]');
  expect(await borders(page)).toEqual({ Top: OFF, Right: OFF, Bottom: OFF, Left: OFF });
  expect(await ds(page)).toBeNull();
  /* ⛔낱말 «border» 로 재지 마라 — box-sizing:border-box 가 늘 있다(첫 판이 그걸로 거짓 빨강). 변 선언만 본다. */
  const st = await page.evaluate(() => document.getElementById('gG').getAttribute('style') || '');
  expect(st, 'style 에 변 border 선언이 남았다').not.toMatch(/(^|;)\s*border(-(top|right|bottom|left))?(-(width|style|color))?\s*:/);
});

test('O3 굵기·색·꼴은 «모든 칸 테두리» 값을 따른다(새 손잡이 0)', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.updateGridBlock('gG', { cellBorderWidth: 3, cellBorderColor: '#7b2ff7', cellBorderStyle: 'dashed' }));
  await selectGrid(page);
  await clickBtn(page, '#grd-outline-group [data-outline-side="bottom"]');
  const cs = await page.evaluate(() => { const c = getComputedStyle(document.getElementById('gG')); return `${c.borderBottomWidth} ${c.borderBottomStyle} ${c.borderBottomColor}`; });
  expect(cs).toBe('3px dashed rgb(123, 47, 247)');
});

test('O4 ★⌘Z 한 번이 마지막 한 번만 되돌린다 · ⇧⌘Z 로 다시', async ({ page }) => {
  await setup(page); await selectGrid(page);
  await clickBtn(page, '#grd-outline-group [data-outline-side="top"]');
  await clickBtn(page, '#grd-outline-group [data-outline-side="right"]');
  expect(await ds(page)).toBe('top,right');
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(page), '⌘Z 1번 = 오른쪽만 꺼진다').toBe('top');
  expect((await borders(page)).Right).toBe(OFF);
  expect((await borders(page)).Top).toBe('1px solid');
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await ds(page), '⌘Z 2번 = 처음(없음)').toBeNull();
  expect(await borders(page)).toEqual({ Top: OFF, Right: OFF, Bottom: OFF, Left: OFF });
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  expect(await ds(page)).toBe('top');
  expect((await borders(page)).Top).toBe('1px solid');
});

test('O5 ★저장 왕복 — serializeProject → 새로 띄운 앱에 applyProjectData 해도 같은 변이 그어져 있고, 다시 그려도 그대로다', async ({ page }) => {
  await setup(page); await selectGrid(page);
  await clickBtn(page, '#grd-outline-group [data-outline-side="top"]');
  await clickBtn(page, '#grd-outline-group [data-outline-side="left"]');
  const before = await borders(page);
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForTimeout(400);
  expect(await ds(page)).toBe('top,left');
  expect(await borders(page)).toEqual(before);
  await page.evaluate(() => { const g = document.getElementById('gG'); g.dataset.gap = '40'; window.renderGridBlock(g); });
  expect(await borders(page), '다시 그려도(열 간격 변경) 그대로').toEqual(before);
});

test('O6 ★내보내기 — PNG 클론에 위 변 선이 «픽셀로» 찍히고 아래 변은 안 찍힌다 · 단독 HTML 에도 실린다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.updateGridBlock('gG', { cellBorderColor: '#ff0000', cellBorderWidth: 0 }));
  await selectGrid(page);
  await clickBtn(page, '#grd-outline-group [data-outline-side="top"]');
  await page.evaluate(() => window.deselectAll?.());
  const p = await page.evaluate(async () => {
    const ex = await import('/js/io/export-image.js');
    const clone = await ex.prepareCloneForCapture(document.getElementById('gS'), 860, true);
    ex.renderComponentsInClone(clone);
    clone.id = '__clone'; clone.style.position = 'fixed'; clone.style.zIndex = '2147483647'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
    const G = clone.querySelector('.grid-block'); const r = G.getBoundingClientRect(); const cr = clone.getBoundingClientRect();
    return { x: Math.round(r.left - cr.left), y: Math.round(r.top - cr.top), w: Math.round(r.width), h: Math.round(r.height), cw: Math.round(cr.width) };
  });
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const red = await page.evaluate(async ([b64, p]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0); const sx = img.width / p.cw;
    const isRed = (x, y) => { const d = ctx.getImageData(Math.round(x * sx), Math.round(y * sx), 1, 1).data; return d[0] > 200 && d[1] < 80 && d[2] < 80; };
    let top = 0, bottom = 0;
    for (let i = 4; i < p.w - 4; i++) { if (isRed(p.x + i, p.y)) top++; if (isRed(p.x + i, p.y + p.h - 1)) bottom++; }
    return { top, bottom, span: p.w - 8 };
  }, [shot.toString('base64'), p]);
  await page.evaluate(() => document.getElementById('__clone')?.remove());
  expect(red.top, `★PNG 위 변 빨간 픽셀 ${red.top}/${red.span}`).toBeGreaterThan(red.span * 0.9);
  expect(red.bottom, 'PNG 아래 변엔 선이 없다(대조)').toBe(0);
  const html = await page.evaluate(async () => {
    let out = null;
    const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:none'; };
    const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
    try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; }
    return out ? await out.text() : null;
  });
  expect(html, 'HTML 산출물을 못 받았다').toBeTruthy();
  const page2 = await page.context().newPage();
  await page2.setContent(html);
  const h2 = await page2.evaluate(() => { const G = document.getElementById('gG'); if (!G) return null; const c = getComputedStyle(G);
    return { top: `${c.borderTopWidth} ${c.borderTopStyle} ${c.borderTopColor}`, bottom: c.borderBottomWidth }; });
  await page2.close();
  expect(h2, '단독 HTML 에 그리드가 있다').not.toBeNull();
  expect(h2.top).toBe('1px solid rgb(255, 0, 0)');
  expect(h2.bottom).toBe('0px');
});

test('O7 피그마 JSON — 켠 변만 border 에 실린다 · 끈 그리드는 border 키가 «없다»(그물 대조) · ⚠️렌더러가 읽는지는 미측정', async ({ page }) => {
  await setup(page);
  const find = (j) => { let hit = null; JSON.stringify(j, (k, v) => { if (v && v.id === 'gG') hit = v; return v; }); return hit; };
  const off = find(await page.evaluate(() => (window.flushCurrentPage(), window.buildFigmaExportJSON(null))));
  expect(off, '그리드가 피그마 JSON 에 있다').not.toBeNull();
  expect('border' in off, '끈 그리드엔 border 키가 없다').toBe(false);
  await selectGrid(page);
  await clickBtn(page, '#grd-outline-group [data-outline-side="top"]');
  await clickBtn(page, '#grd-outline-group [data-outline-side="right"]');
  const on = find(await page.evaluate(() => (window.flushCurrentPage(), window.buildFigmaExportJSON(null))));
  expect(on.border.top).toEqual({ width: 1, style: 'solid', color: 'rgb(208, 208, 208)' });
  expect(on.border.right).toEqual({ width: 1, style: 'solid', color: 'rgb(208, 208, 208)' });
  expect(on.border.bottom).toBeNull();
  expect(on.border.left).toBeNull();
});

/* ══ G18 — 정렬 단추 픽셀·동작 지킴 (핀 37ab1c65 대비) ══════════════════════════════ */
const PIN = '37ab1c65';
/** 핀 판에서 «달라진» 앱 파일을 핀 내용으로 덮어 싣는다. 새로 생긴 파일은 404(핀에 없다). */
function pinOverlay() {
  const out = execFileSync('git', ['-C', ROOT, 'diff', '--name-status', PIN, '--', 'js', 'css', 'index.html'], { encoding: 'utf8' });
  const map = new Map();
  for (const line of out.split('\n').filter(Boolean)) {
    const [st, f] = line.split('\t');
    map.set('/' + f, st.startsWith('A') ? null : execFileSync('git', ['-C', ROOT, 'show', `${PIN}:${f}`]));
  }
  return map;
}
/** bootApp 과 «같은» 띄우기 — 다른 점은 덮개 파일만 핀 내용으로 낸다는 것 하나.
 *  ⛔bootApp 위에 page.route 를 «덧대지» 못 한다: 나중에 건 route 가 먼저 돌아서 bootApp 의 것이 다 받아 버린다. */
function pinnedBoot(overlay) {
  const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
  return async (page) => {
    const errs = [];
    page.on('pageerror', e => errs.push(String(e)));
    await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
    await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
    await page.route(`${ORIGIN}/**`, async (r) => {
      const u = decodeURIComponent(new URL(r.request().url()).pathname);
      const ct = MIME[path.extname(u)] || 'application/octet-stream';
      if (overlay.has(u)) { const b = overlay.get(u); return b === null ? r.fulfill({ status: 404, body: '' }) : r.fulfill({ contentType: ct, body: b }); }
      const f = path.join(ROOT, u);
      if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
      return r.fulfill({ contentType: ct, body: fs.readFileSync(f) });
    });
    await page.goto(`${ORIGIN}/index.html`);
    await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
    return errs;
  };
}
async function bootWith(page, overlay) {
  return setup(page, overlay ? pinnedBoot(overlay) : bootApp);
}
const ALIGN_SEL = ['#grd-halign-group [data-ha]', '#grd-valign-group [data-va]'];
async function alignShot(page) {
  await selectGrid(page);
  await page.evaluate(() => document.getElementById('grd-halign-group').scrollIntoView({ block: 'center' }));
  await page.mouse.move(5, 5); await page.waitForTimeout(150);
  const rows = ['#grd-halign-group', '#grd-valign-group'];
  const shots = [];
  for (const s of rows) shots.push(await (await page.locator(s).evaluateHandle(e => e.closest('.prop-row'))).asElement().screenshot({ type: 'png' }));
  const html = await page.evaluate((S) => S.map(s => [...document.querySelectorAll(s)].map(b => b.outerHTML).join('\n')).join('\n'), ALIGN_SEL);
  return { shots, html };
}
async function decode(page, buf) {
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, d: Array.from(ctx.getImageData(0, 0, img.width, img.height).data) };
  }, buf.toString('base64'));
}

test('G18-0 전제 — 핀 판 덮개가 «실제로 다른 판»을 싣는다(덮을 파일 수 ≥ 0 을 말하고, 지금 판이면 0)', async () => {
  const ov = pinOverlay();
  console.log(`[G18] 핀 ${PIN} 덮개 파일 ${ov.size}개: ${[...ov.keys()].join(' ')}`);
  if (process.env.GD1001_ROOT) expect(ov.size, '핀 체크아웃 자신이면 덮을 것이 없다').toBe(0);
  else expect(ov.size, '★이 브랜치는 핀과 달라야 한다(아니면 대조가 공짜 초록)').toBeGreaterThan(0);
});

test('G18-1 ★그리드 정렬 단추 두 줄이 핀 판과 «픽셀 0 차이» · 마크업 동일', async ({ browser }) => {
  const ctxA = await browser.newContext(); const ctxB = await browser.newContext();
  const a = await ctxA.newPage(); const b = await ctxB.newPage();
  await bootWith(a, null); await bootWith(b, pinOverlay());
  const A = await alignShot(a); const B = await alignShot(b);
  for (let i = 0; i < A.shots.length; i++) {
    const pa = await decode(a, A.shots[i]); const pb = await decode(a, B.shots[i]);
    expect([pa.w, pa.h], `줄 ${i} 크기`).toEqual([pb.w, pb.h]);
    let diff = 0; for (let k = 0; k < pa.d.length; k += 4) if (pa.d[k] !== pb.d[k] || pa.d[k + 1] !== pb.d[k + 1] || pa.d[k + 2] !== pb.d[k + 2] || pa.d[k + 3] !== pb.d[k + 3]) diff++;
    console.log(`[G18-1] 줄 ${i} ${pa.w}x${pa.h} 다른 픽셀 ${diff}`);
    expect(diff, `★정렬 줄 ${i} 에서 핀과 다른 픽셀 ${diff}개`).toBe(0);
  }
  /* 마크업은 픽셀 «뒤»에 잰다 — 앞에 두면 그림 변이가 마크업에서 먼저 걸려 픽셀 자가 빨개질 수 있는지를 못 본다. */
  expect(A.html, '단추 마크업(outerHTML)이 핀과 다르다').toBe(B.html);
  await ctxA.close(); await ctxB.close();
});

test('G18-2 ★정렬 단추 여섯을 차례로 누르면 핀 판과 «같은 값»을 쓴다(valign · 열 align)', async ({ browser }) => {
  const run = async (overlay) => {
    const ctx = await browser.newContext(); const pg = await ctx.newPage();
    await bootWith(pg, overlay); await selectGrid(pg);
    const log = [];
    for (const s of ['[data-ha="center"]', '[data-ha="right"]', '[data-ha="left"]', '[data-va="middle"]', '[data-va="bottom"]', '[data-va="top"]']) {
      await clickBtn(pg, `#grd-${s.includes('ha') ? 'h' : 'v'}align-group ${s}`);
      log.push(await pg.evaluate(() => { const g = document.getElementById('gG');
        return `${g.dataset.valign || ''}|${JSON.parse(g.dataset.cols).map(c => c.align || '').join(',')}|${[...document.querySelectorAll('#grd-halign-group .active, #grd-valign-group .active')].map(b => b.dataset.ha || b.dataset.va).join(',')}`; }));
    }
    await ctx.close();
    return log;
  };
  const now = await run(null); const pin = await run(pinOverlay());
  console.log(`[G18-2] ${now.join(' / ')}`);
  expect(now).toEqual(pin);
});
