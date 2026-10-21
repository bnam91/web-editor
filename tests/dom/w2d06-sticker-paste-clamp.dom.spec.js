// W2D-06 — 스티커를 붙여넣으면 섹션 높이 밖에 놓인다 (현빈 W2D · S3 C06 · 지디 처방).
// 장면은 앱 제 문(플로팅 패널 메뉴 · 섹션 꼬리표 · 마우스 · 휠 · ⌘C/⌘V)으로만 짓는다. page.evaluate 는 읽기만.
// 고정 대기 0줄 — 기다림은 waitForFunction(polling) / 하네스 waitStableRect 뿐. rect 는 가라앉힌 뒤 두 번 읽는다.
// 판정은 «모델 px»(dataset.x/y · offsetWidth/Height · sec.clientWidth/Height)로만 한다 — 화면 px 는 장면을 짓는 데만 쓴다.
//
// 성공 = 단언
//   S1 secTop — 짧은 섹션을 화면 위쪽에 올려(섹션 아래 끝 < 캔버스 가운데) ⌘V 하면 사본 상자가 제 섹션 상자 안
//   S3 두 번  — secTop 에서 ⌘V 를 한 번 더 하면 두 사본이 같은 자리가 아니고 둘 다 섹션 안
//   S2 가운데 — 섹션을 캔버스 가운데로 굴려(섹션 rect 가 캔버스 가운데 점을 덮는다) 같은 클립보드로 ⌘V → 사본 상자가 섹션 안(바닥에서도 초록 — 음성 짝)
//   S5 끌기 경계 — 스티커 끌기 클램프 _clampToSection(js/sticker-select.js:30)의 아래 끝 = 섹션 clientHeight − 사본 높이
//                  (붙이기 클램프 _placePastedOverlay 의 maxY 와 같은 자). 바닥에서도 초록이어야 지키는 칸.
//   S4 자란 섹션 — 섹션에 Frame 을 넣어(플로팅 패널 «Frame 추가») 섹션 clientHeight 가 늘어난 뒤 S1 장면 → 사본이 «늘어난» 섹션 안.
//                  clientHeight 를 고른 전제(흐름 블럭이 섹션을 키운다 · absolute 스티커는 안 키운다)를 런으로 한 번 잰다.
//   차례 S1 → S3 → S2: 원본은 한 번만 누른다(v1 에서 S2 사본이 원본을 덮어 다시 누르기가 사본을 맞혔다).
//
// 판 정체 — ⑴ git -C ROOT rev-parse HEAD === EXPECT_SHA
//           ⑵ 페이지가 받은 js/editor.js 의 sha1 === ROOT 작업트리 js/editor.js 의 sha1 === EXPECT_FILE_SHA1
//   (고침은 js/editor.js 에 든다 — 바닥 판과 고친 판에서 이 파일이 다르다. HEAD 는 두 판이 같다.)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1440, height: 900 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const EDGE = 10;          // 섹션 아래 끝이 캔버스 가운데보다 이만큼 위 · 캔버스 위 끝보다 이만큼 아래
const AIM = 60;           // 휠로 섹션 아래 끝을 캔버스 가운데 위 이 거리로 올린다
const WHEEL_MAX = 200;    // 휠 한 번 최대

const EXPECT_SHA = process.env.EXPECT_SHA || '';
const EXPECT_FILE_SHA1 = process.env.EXPECT_FILE_SHA1 || '';
const IDENT_FILE = 'js/editor.js';
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`W2D06 ${tag} ${JSON.stringify(o)}`);

async function assertBoard(page) {
  expect(EXPECT_SHA, '판 정체: EXPECT_SHA env 가 풀 sha 40자').toMatch(/^[0-9a-f]{40}$/);
  expect(EXPECT_FILE_SHA1, '판 정체: EXPECT_FILE_SHA1 env 가 sha1 40자').toMatch(/^[0-9a-f]{40}$/);
  const headSha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const rootSha1 = sha1(fs.readFileSync(path.join(ROOT, IDENT_FILE)));
  const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(bin); }, `${ORIGIN}/${IDENT_FILE}`);
  const pageSha1 = sha1(Buffer.from(b64, 'base64'));
  log('ident', { root: ROOT, expectSha: EXPECT_SHA, headSha, identFile: IDENT_FILE, expectFileSha1: EXPECT_FILE_SHA1, rootSha1, pageSha1 });
  expect(headSha, '판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  expect(pageSha1, '판 정체 ⑵a: 페이지가 받은 js/editor.js === ROOT 작업트리 js/editor.js').toBe(rootSha1);
  expect(rootSha1, '판 정체 ⑵b: ROOT 작업트리 js/editor.js === EXPECT_FILE_SHA1').toBe(EXPECT_FILE_SHA1);
}

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setViewportSize(VIEW);
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (!url.startsWith(ORIGIN + '/')) return r.abort();
    const f = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.serializeProject === 'function' && typeof window.getSelectedSection === 'function', null, { timeout: 30000 });
  await assertBoard(page);
  return errs;
}

async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
async function stableTwice(page, sel) {
  const a = await waitStableRect(page, sel); const b = await waitStableRect(page, sel);
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
// 누르기 직전 맞힌 요소 — 기대 선택자 밖이면 안 누른다
async function softClick(page, x, y, sel) {
  const hit = await page.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); if (!e) return { ok: false, hit: null };
    return { ok: !!(e.matches(sel) || e.closest(sel)), hit: (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] }; }, [x, y, sel]);
  if (hit.ok) await page.mouse.click(x, y);
  return hit;
}
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));

async function pickSec(page, id) {
  const SEC = `[id="${id}"]`; await scrollTo(page, SEC);
  const hz = await stableTwice(page, SEC + ' .section-hitzone');
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await softClick(page, hz.left + EDGE, hz.cy, SEC + ' .section-hitzone');
  return pollTrue(page, (id) => window.getSelectedSection?.()?.id === id, id, 3000);
}
async function newSection(page) {
  const before = await secIds(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const id = (await secIds(page)).find(x => !before.includes(x)) || null;
  expect(id, '전제: 새 섹션이 생겼다').toBeTruthy();
  expect(await pickSec(page, id), '전제: 새 섹션을 골랐다').toBe(true);
  return id;
}
async function markSeen(page) { await page.evaluate(() => document.querySelectorAll('.sticker-block').forEach(e => { e.__w2d06 = true; })); }
async function freshSticker(page) {
  await pollTrue(page, () => [...document.querySelectorAll('.sticker-block')].some(e => !e.__w2d06), null, 6000);
  return page.evaluate(() => { const f = [...document.querySelectorAll('.sticker-block')].filter(e => !e.__w2d06); return f.map(e => e.id); });
}
async function insSticker(page, label) {
  await markSeen(page);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-pen-menu .fp-menu-item').filter({ hasText: new RegExp('^\\s*' + label + '\\s*$') }).first().click();
  const ids = await freshSticker(page);
  expect(ids.length, `전제: ${label} 를 메뉴로 넣었다(새 스티커 1개)`).toBe(1);
  return ids[0];
}
async function clickSticker(page, id) {
  const S = `[id="${id}"]`; await scrollTo(page, S);
  const r = await stableTwice(page, S);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const hit = await softClick(page, r.cx, r.cy, S);
  expect(hit.ok, `전제: 원본 ${id} 를 맞혔다(맞힌 것 ${hit.hit})`).toBe(true);
}
// 캔버스 가운데·섹션 rect — 장면 짓기용(화면 px 는 판정에 안 쓴다)
async function geoOf(page, secId) {
  return page.evaluate((s) => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(); const r = document.getElementById(s).getBoundingClientRect();
    return { wTop: w.top, wMid: w.top + w.height / 2, wCx: w.left + w.width / 2, bTop: r.top, bBot: r.bottom }; }, secId);
}
async function scrollSecTop(page, secId) {
  let reached = false, iters = 0, g = null;
  for (; iters < 40; iters++) {
    g = await geoOf(page, secId);
    if (g.bBot < g.wMid - EDGE && g.bBot > g.wTop + EDGE) { reached = true; break; }
    const dy = Math.max(-WHEEL_MAX, Math.min(WHEEL_MAX, g.bBot - (g.wMid - AIM)));
    await page.mouse.move(g.wCx, g.wMid); await page.mouse.wheel(0, dy);
    await stableTwice(page, `[id="${secId}"]`);
  }
  return { reached, iters, g };
}
// 판정 자 — 모델 px
async function boxOf(page, id) {
  return page.evaluate((id) => { const e = document.getElementById(id); const sec = e?.closest('.section-block');
    const z = window.currentZoom ?? null;
    return { id, sec: sec?.id ?? null, x: parseInt(e.dataset.x, 10), y: parseInt(e.dataset.y, 10), left: e.style.left, top: e.style.top,
      w: e.offsetWidth, h: e.offsetHeight, secW: sec?.clientWidth ?? null, secH: sec?.clientHeight ?? null, zoom: z }; }, id);
}
const inside = (b) => b.x >= 0 && b.y >= 0 && b.x + b.w <= b.secW && b.y + b.h <= b.secH;
// 끌기 클램프 자 — js/sticker-select.js:30 _clampToSection 에 «아주 아래»를 넣어 아래 끝을 읽는다(순수 함수 · 문서 무변)
async function dragFloor(page, id) {
  return page.evaluate((id) => { const e = document.getElementById(id); const sec = e.closest('.section-block');
    const r = window._clampToSection(0, Number.MAX_SAFE_INTEGER, sec, e.offsetWidth, e.offsetHeight);
    return { dragMaxY: r[1], secH: sec.clientHeight, h: e.offsetHeight }; }, id);
}
async function paste(page) {
  await markSeen(page);
  await page.keyboard.press('Meta+v');
  const ids = await freshSticker(page);
  expect(ids.length, '전제: ⌘V 로 사본 1개가 생겼다').toBe(1);
  await stableTwice(page, `[id="${ids[0]}"]`);
  return ids[0];
}

for (const label of ['Sticker', 'Text Sticker']) {
  test(`W2D06 ${label} — S2 asIs · S1 secTop · S3 두 번`, async ({ page }) => {
    test.setTimeout(180000);
    const errs = await boot(page);
    const secA = await newSection(page);      // 원본 자리
    const src = await insSticker(page, label);
    const srcBox = await boxOf(page, src);
    expect(srcBox.sec, '전제: 원본이 제 섹션 안').toBe(secA);

    // S1 secTop
    await clickSticker(page, src);
    await page.keyboard.press('Meta+c');
    const sc = await scrollSecTop(page, secA);
    log('S1-scroll', { label, ...sc });
    expect(sc.reached, '전제: 섹션 아래 끝 < 캔버스 가운데 · 섹션 일부는 보인다').toBe(true);
    expect(await page.evaluate(() => window.getSelectedSection?.()?.id ?? null), '전제: 붙일 섹션 = 원본 섹션').toBe(secA);
    const p1 = await paste(page);
    const b1 = await boxOf(page, p1);
    log('S1', { label, b: b1, inside: inside(b1) });

    // S3 한 번 더
    const p3 = await paste(page);
    const b3 = await boxOf(page, p3);
    log('S3', { label, b: b3, inside: inside(b3), sameAsS1: b3.x === b1.x && b3.y === b1.y });
    const s5 = await dragFloor(page, p1);
    log('S5', { label, ...s5 });

    // S2 가운데 — 같은 클립보드
    await scrollTo(page, `[id="${secA}"]`);
    await stableTwice(page, `[id="${secA}"]`);
    const g2 = await geoOf(page, secA);
    log('S2-scroll', { label, g: g2 });
    expect(g2.bTop < g2.wMid && g2.bBot > g2.wMid, '전제: 섹션 rect 가 캔버스 가운데 점을 덮는다').toBe(true);
    expect(await page.evaluate(() => window.getSelectedSection?.()?.id ?? null), '전제: S2 붙일 섹션 = 원본 섹션').toBe(secA);
    const p2 = await paste(page);
    const b2 = await boxOf(page, p2);
    log('S2', { label, b: b2, inside: inside(b2) });

    expect(errs, '페이지 에러 0').toEqual([]);
    expect.soft(b2.sec, 'S2: 사본이 원본 섹션에 붙었다').toBe(secA);
    expect.soft(inside(b2), `S2 가운데: 사본 상자가 섹션 안 (x ${b2.x} y ${b2.y} w ${b2.w} h ${b2.h} · 섹션 ${b2.secW}×${b2.secH})`).toBe(true);
    expect.soft(b1.sec, 'S1: 사본이 원본 섹션에 붙었다').toBe(secA);
    expect.soft(inside(b1), `S1 secTop: 사본 상자가 섹션 안 (x ${b1.x} y ${b1.y} w ${b1.w} h ${b1.h} · 섹션 ${b1.secW}×${b1.secH})`).toBe(true);
    expect.soft(inside(b3), `S3: 두 번째 사본도 섹션 안 (x ${b3.x} y ${b3.y} · 섹션 ${b3.secW}×${b3.secH})`).toBe(true);
    expect.soft(b3.x === b1.x && b3.y === b1.y, `S3: 두 사본이 같은 자리가 아니다 (S1 ${b1.x},${b1.y} · S3 ${b3.x},${b3.y})`).toBe(false);
    expect.soft(s5.dragMaxY, `S5: 끌기 클램프 아래 끝 = 섹션 clientHeight − 높이 (${s5.secH} − ${s5.h})`).toBe(s5.secH - s5.h);
  });
}

test('W2D06 S4 — Frame 으로 자란 섹션에서 secTop 붙여넣기', async ({ page }) => {
  test.setTimeout(180000);
  const errs = await boot(page);
  const secA = await newSection(page);
  const h0 = await page.evaluate((s) => document.getElementById(s).clientHeight, secA);
  await page.click('.fp-btn[title^="Frame 추가"]');
  expect(await pollTrue(page, ([s, h]) => document.getElementById(s).clientHeight > h, [secA, h0]), '전제: Frame 을 넣으니 섹션 clientHeight 가 늘었다').toBe(true);
  await stableTwice(page, `[id="${secA}"]`);
  const h1 = await page.evaluate((s) => document.getElementById(s).clientHeight, secA);
  expect(await pickSec(page, secA), '전제: 자란 섹션을 다시 골랐다').toBe(true);
  const src = await insSticker(page, 'Sticker');
  const h2 = await page.evaluate((s) => document.getElementById(s).clientHeight, secA);
  await clickSticker(page, src);
  await page.keyboard.press('Meta+c');
  const sc = await scrollSecTop(page, secA);
  log('S4-scroll', { h0, h1, h2, ...sc });
  expect(sc.reached, '전제: 섹션 아래 끝 < 캔버스 가운데 · 섹션 일부는 보인다').toBe(true);
  const p4 = await paste(page);
  const b4 = await boxOf(page, p4);
  log('S4', { h0, h1, h2, b: b4, inside: inside(b4) });
  expect(errs, '페이지 에러 0').toEqual([]);
  expect.soft(h2, '전제: 스티커(absolute)를 넣어도 섹션 clientHeight 는 그대로').toBe(h1);
  expect.soft(b4.sec, 'S4: 사본이 자란 섹션에 붙었다').toBe(secA);
  expect.soft(inside(b4), `S4: 사본 상자가 자란 섹션 안 (x ${b4.x} y ${b4.y} w ${b4.w} h ${b4.h} · 섹션 ${b4.secW}×${b4.secH} · Frame 전 높이 ${h0})`).toBe(true);
});
