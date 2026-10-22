// 261022 현빈 결정 «아노테이션 블록과 치수선 블럭은 보여야지 최종 이미지» — 공용 걷기(js/io/capture-safety.js stripEditorOnlyForCapture)의
//   «.annotation-block» 걷기를 떼고 «.annot-preview»(그리는 중 미리보기)만 남긴다. 그 함수를 부르는 «소비자 셋»에서 «나온다»를 잰다(지디 «셋 한 쌍»):
//   ⓐ 섹션 PNG — 섹션 패널 «이 섹션 내보내기»(js/io/export-image.js prepareCloneForCapture · native CDP 갈래)
//   ⓑ 썸네일 — 앱이 편집 멈춘 뒤 스스로 찍는 길(js/io/save-load.js _runIdleThumbnail → captureThumbnail → saveProjectMeta)
//   ⓒ 단독 HTML — exportHTMLFile(UI 입구 0 · 함수 부름)
//   ＋ 음성대조: .annot-preview 는 여전히 빠진다(ⓒ 문자열).
// 장면은 앱 제 문으로만: 펜 메뉴 «Annotation»(클릭 2 · Enter) · «사이즈 스티커»(클릭 3) · Esc · 섹션 히트존 · 섹션 패널 단추. page.evaluate 는 읽기만 —
//   예외(이름으로): ① exportHTMLFile() 부름(UI 입구 0) ② html2canvas 입력 엿보기(지나가기만) ③ 내보낸 HTML 을 «따로 연 페이지».
// 자: 라벨 상자 안 «어두운 점»(r,g,b 모두 < 100) 수 — 흰 섹션 위 글(#1a1a1a). 0 = 빠졌다 · > 0 = 나왔다.
// 성공 = 단언 (바닥 8eaaf07a 에서 A·T·H 빨강(빠진다) · N 초록) · H2 = :44 좁히기의 음성대조 한 쌍
// 판 정체 — HEAD === EXPECT_SHA · ID_FILES 마다 페이지가 받은 sha1 === 디스크 === EXPECT_FILES_SHA1(JSON · ~/taeyang-098/ty-specenv.py 로 파생)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

test.describe.configure({ timeout: 150000 });

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1600, height: 1200 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const ID_FILES = ['js/io/capture-safety.js', 'js/io/export-html.js', 'js/io/export-image.js', 'js/io/save-load.js', 'js/io/export-css-collect.js'];
const TOL = 2;
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`AEX ${tag} ${JSON.stringify(o)}`);

async function assertBoard(page) {
  const want = process.env.EXPECT_SHA || '';
  expect(want, '판 정체: EXPECT_SHA 40 hex').toMatch(/^[0-9a-f]{40}$/);
  let wantMap = null; try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) {}
  expect(wantMap && Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = ID_FILES').toEqual([...ID_FILES].sort());
  const noGit = process.env.IDENT_NO_GIT === '1';
  const head = noGit ? null : execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const rows = [];
  for (const f of ID_FILES) {
    const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
      let s = ''; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); }, `${ORIGIN}/${f}`);
    rows.push({ f, page: sha1(Buffer.from(b64, 'base64')), root: sha1(fs.readFileSync(path.join(ROOT, f))), want: wantMap[f] });
  }
  log('ident', { root: ROOT, head, noGit, want, rows });
  if (!noGit) expect(head, '판 정체 ⑴ HEAD === EXPECT_SHA').toBe(want);
  for (const r of rows) { expect(r.page, `판 정체 ⑵a ${r.f} 서빙=디스크`).toBe(r.root); expect(r.root, `판 정체 ⑵b ${r.f} 디스크=env`).toBe(r.want); }
}

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setViewportSize(VIEW);
  // native 갈래 = main.js capture-section-cdp 와 같은 명령·같은 인자(Page.captureScreenshot · clip scale 1 · captureBeyondViewport · fromSurface)
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.addInitScript(() => {
    // ★saveProjectMeta = 썸네일이 «굳는» 출구(js/io/save-load.js _runIdleThumbnail) — 그 인자를 적어 둔다(되돌림값은 다른 메서드와 같은 null)
    window.__meta = [];
    window.electronAPI = new Proxy({}, { get: (t, k) => k === 'captureSectionCdp' ? (o) => window.__cdpShot(o)
      : k === 'saveProjectMeta' ? ((id, m) => { window.__meta.push({ id, m }); return Promise.resolve(null); })
      : (() => Promise.resolve(null)) });
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
  });
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return r.continue();
    if (!url.startsWith(ORIGIN + '/')) return r.abort();
    const f = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=s7aex`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.makeAnnotationBlock === 'function' && typeof window.annotDimGeometry === 'function' && typeof window.exportSection === 'function', null, { timeout: 30000 });
  // ★html2canvas «입력» 엿보기(지나가기만) — 썸네일 클론에 무엇이 실렸나를 센다. 그리는 것은 진짜 html2canvas 그대로.
  await page.evaluate(() => { const real = window.html2canvas; window.__h2c = [];
    window.html2canvas = (el, o) => { window.__h2c.push({ annot: el.querySelectorAll('.annotation-block').length, dim: el.querySelectorAll('.annotation-block[data-annot-kind="dim"]').length, prev: el.querySelectorAll('.annot-preview').length }); return real(el, o); }; });
  await assertBoard(page);
  return errs;
}
const poll = async (page, fn, arg, timeout = 6000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };
const rectOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
const hitAt = (page, x, y, sel) => page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return { ok: !!(e && (e.matches(s) || e.closest(s))),
  hit: e ? (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? '').split(' ')[0] : null }; }, [x, y, sel]);
async function zoom100(page) {
  for (let k = 0; k < 20; k++) {
    const z = (await page.textContent('#zoom-display')).trim();
    if (z === '100%') return z;
    await page.click(parseInt(z, 10) < 100 ? '#zoom-ctrl .zoom-btn >> nth=1' : '#zoom-ctrl .zoom-btn >> nth=0');
    await poll(page, (p) => document.getElementById('zoom-display').textContent.trim() !== p, z, 3000);
  }
  return (await page.textContent('#zoom-display')).trim();
}


async function penClickIn(page, sec, dx, fromBottom) {
  await page.evaluate((s) => document.getElementById(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sec);
  await waitStableRect(page, `#${sec}`);
  const r = await rectOf(page, `#${sec}`);
  const x = r.x + dx, y = r.y + r.h - fromBottom;
  const inSec = await page.evaluate(([x, y, s]) => document.elementFromPoint(x, y)?.closest('.section-block')?.id === s, [x, y, sec]);
  expect(inSec, `전제: 펜 클릭 자리 (${Math.round(x)},${Math.round(y)}) 가 그 섹션 안`).toBe(true);
  await page.mouse.click(x, y);
}
async function leaveLabelEdit(page, id) {
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return l?.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, id, 4000), '전제: 라벨 편집(포커스까지)').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, (i) => document.querySelector(`#${i} .annot-label`)?.getAttribute('contenteditable') !== 'true', id, 4000), '전제: 라벨 편집에서 빠져나왔다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, () => !document.body.classList.contains('pen-mode'), null, 4000), '전제: 펜 모드 꺼짐').toBe(true);
}
// 첫 섹션(썸네일은 첫 섹션만 찍는다 — captureThumbnail firstSec)에 펜 어노테이션 하나 ＋ 치수선 하나
async function scene(page) {
  await zoom100(page);
  let sec = await page.evaluate(() => document.querySelector('#canvas .section-block:not([data-ghost])')?.id || null);
  if (!sec) {
    await page.click('.fp-btn.primary[title="새 섹션 추가"]');
    expect(await poll(page, () => !!document.querySelector('#canvas .section-block:not([data-ghost])'), null, 5000), '전제: 섹션').toBe(true);
    sec = await page.evaluate(() => document.querySelector('#canvas .section-block:not([data-ghost])').id);
  }
  const before = await page.evaluate(() => [...document.querySelectorAll('.annotation-block')].map(a => a.id));
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="togglePenMode"]');
  await penClickIn(page, sec, 120, 50);
  expect(await poll(page, () => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= 1, null, 4000), '전제: 펜 첫 점').toBe(true);
  await penClickIn(page, sec, 220, 90);
  expect(await poll(page, () => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= 2, null, 4000), '전제: 펜 둘째 점').toBe(true);
  await page.keyboard.press('Enter');
  expect(await poll(page, (b) => [...document.querySelectorAll('.annotation-block:not([data-annot-kind="dim"])')].some(a => !b.includes(a.id)), before, 4000), '전제: 펜 어노테이션 생김').toBe(true);
  const pen = await page.evaluate((b) => [...document.querySelectorAll('.annotation-block:not([data-annot-kind="dim"])')].find(a => !b.includes(a.id)).id, before);
  await leaveLabelEdit(page, pen);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="toggleDimMode"]');
  for (const [k, p] of [[480, 40], [760, 40]].entries()) {
    await penClickIn(page, sec, p[0], p[1]);
    expect(await poll(page, (n) => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= n, k + 1, 4000), `전제: 치수 클릭 ${k + 1}`).toBe(true);
  }
  await penClickIn(page, sec, 620, 80);
  expect(await poll(page, (s) => !!document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]'), sec, 4000), '전제: 치수선 생김').toBe(true);
  const dim = await page.evaluate((s) => document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]').id, sec);
  await leaveLabelEdit(page, dim);
  await page.keyboard.press('Escape'); await page.mouse.click(5, VIEW.height - 5); await page.mouse.move(2, 2);
  return { sec, pen, dim };
}
// 섹션 기준 라벨 사각형(px · 섹션 860 폭 기준)
const labelRects = (page, ids) => page.evaluate(({ sec, pen, dim }) => { const s = document.getElementById(sec); if (!s) return null; const sr = s.getBoundingClientRect(); const k = sr.width / 860;
  const R = (i) => { const l = document.querySelector(`#${i} .annot-label`); if (!l) return null; const r = l.getBoundingClientRect(); return { x: (r.left - sr.left) / k, y: (r.top - sr.top) / k, w: r.width / k, h: r.height / k }; };
  return { k, pen: R(pen), dim: R(dim) }; }, ids);
// 그림(base64) 안 사각형의 어두운 점 수 — 브라우저 디코더(새 의존성 0)
const darkIn = (page, b64, mime, sx, rect) => page.evaluate(async ([b64, mime, sx, rc]) => {
  const im = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = `data:${mime};base64,` + b64; });
  const c = document.createElement('canvas'); c.width = im.width; c.height = im.height; const g = c.getContext('2d', { willReadFrequently: true }); g.drawImage(im, 0, 0);
  const x0 = Math.max(0, Math.floor(rc.x * sx)), y0 = Math.max(0, Math.floor(rc.y * sx)), x1 = Math.min(im.width, Math.ceil((rc.x + rc.w) * sx)), y1 = Math.min(im.height, Math.ceil((rc.y + rc.h) * sx));
  if (x1 <= x0 || y1 <= y0) return { img: [im.width, im.height], dark: -1 };
  const d = g.getImageData(x0, y0, x1 - x0, y1 - y0).data; let n = 0;
  for (let i = 0; i < d.length; i += 4) if (d[i] < 100 && d[i + 1] < 100 && d[i + 2] < 100) n++;
  return { img: [im.width, im.height], dark: n, box: [x0, y0, x1 - x0, y1 - y0] };
}, [b64, mime, sx, rect]);

test('A ⓐ 섹션 PNG(«이 섹션 내보내기») — 펜 어노테이션·치수선 라벨이 그림에 남는다', async ({ page }) => {
  const errs = await boot(page);
  const ids = await scene(page);
  const lr = await labelRects(page, ids);
  await page.evaluate((s) => document.querySelector(`#${s} .section-hitzone`)?.scrollIntoView({ block: 'center', behavior: 'instant' }), ids.sec);
  await waitStableRect(page, `#${ids.sec} .section-hitzone`);
  const hz = await rectOf(page, `#${ids.sec} .section-hitzone`);
  const hzHit = await hitAt(page, hz.x + 10, hz.cy, `#${ids.sec} .section-hitzone`);
  log('A-hz', { hz, hzHit });
  expect(hzHit.ok, `전제: 섹션 히트존을 맞힘(${hzHit.hit})`).toBe(true);
  await page.mouse.click(hz.x + 10, hz.cy);
  expect(await poll(page, (i) => window.getSelectedSection?.()?.id === i && !!document.getElementById('sec-export-btn'), ids.sec, 4000), '전제: 섹션 골라 Export 단추').toBe(true);
  await page.selectOption('#sec-export-format', 'png');
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.click('#sec-export-btn')]);
  const buf = fs.readFileSync(await dl.path());
  const b64 = buf.toString('base64');
  const pen = await darkIn(page, b64, 'image/png', 1, lr.pen), dim = await darkIn(page, b64, 'image/png', 1, lr.dim);
  log('A', { lr, pen, dim, bytes: buf.length });
  expect(pen.img[0], '전제: PNG 폭 860').toBe(860);
  expect(pen.dark, 'PNG 펜 어노테이션 라벨 어두운 점 > 0').toBeGreaterThan(0);
  expect(dim.dark, 'PNG 치수선 라벨 어두운 점 > 0').toBeGreaterThan(0);
  expect(errs).toEqual([]);
});

test('T ⓑ 썸네일(편집 멈춘 뒤 앱이 찍는 길) — 클론에 둘이 실리고 saveProjectMeta 에 그림이 간다', async ({ page }) => {
  const errs = await boot(page);
  const ids = await scene(page);
  const n0 = await page.evaluate(() => window.__meta.length);
  expect(await poll(page, (n) => window.__meta.slice(n).some(e => e.m && e.m.thumbnail), n0, 40000), '전제: 앱이 썸네일을 찍어 saveProjectMeta 로 보냈다(유휴 8초 길)').toBe(true);
  const r = await page.evaluate(() => ({ h2c: window.__h2c.slice(-3), thumbLen: (window.__meta.filter(e => e.m && e.m.thumbnail).pop()?.m.thumbnail || '').length }));
  log('T', { ids, ...r });
  const last = r.h2c[r.h2c.length - 1];
  expect(last, '전제: html2canvas 가 불렸다').toBeTruthy();
  expect(last.annot, '썸네일 클론의 .annotation-block = 2(펜 1 ＋ 치수선 1)').toBe(2);
  expect(last.dim, '그중 치수선 1').toBe(1);
  expect(last.prev, '음성대조: .annot-preview 0').toBe(0);
  expect(errs).toEqual([]);
});

test('H ⓒ 단독 HTML — 둘이 실리고 열면 보인다 · N 음성대조: 그리는 중 미리보기(.annot-preview)는 빠진다', async ({ page, context }) => {
  const errs = await boot(page);
  const ids = await scene(page);
  // 음성대조 장면: 펜 모드에서 한 점만 찍어 «그리는 중 미리보기»를 라이브에 세운다
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="togglePenMode"]');
  await penClickIn(page, ids.sec, 300, 150);
  expect(await poll(page, () => document.querySelectorAll('.annot-preview').length >= 1, null, 4000), '전제: 라이브에 .annot-preview 있음').toBe(true);
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = fs.readFileSync(await dh.path(), 'utf8');
  const cnt = (re) => (html.match(re) || []).length;
  const str = { annot: cnt(/class="[^"]*\bannotation-block\b/g), dim: cnt(/data-annot-kind="dim"/g), prev: cnt(/class="[^"]*\bannot-preview\b/g) };
  log('H-str', str);
  expect(str.annot, 'HTML 에 .annotation-block 2').toBe(2);
  expect(str.dim, '그중 치수선 1').toBe(1);
  expect(str.prev, 'N 음성대조: .annot-preview 0').toBe(0);
  // 내보낸 HTML 을 따로 열어 라벨이 «보인다»
  const xp = await context.newPage();
  await xp.setViewportSize(VIEW);
  await xp.route('**/*', (rq) => { const u = rq.request().url(); if (u === 'http://aex.test/export.html') return rq.fulfill({ contentType: 'text/html', body: html });
    if (u.startsWith('data:') || u.startsWith('blob:')) return rq.continue(); return rq.abort(); });
  await xp.goto('http://aex.test/export.html');
  const vis = await xp.evaluate(({ pen, dim }) => { const V = (i) => { const l = document.querySelector(`#${i} .annot-label`); if (!l) return null; const cs = getComputedStyle(l); const r = l.getBoundingClientRect();
    const b = document.getElementById(i), bcs = b ? getComputedStyle(b) : null, svg = b?.querySelector('.annot-svg');
    return { w: Math.round(r.width), h: Math.round(r.height), vis: cs.visibility, disp: cs.display, op: cs.opacity,
      pos: cs.position, left: cs.left, top: cs.top, color: cs.color, fs: cs.fontSize, text: (l.textContent || '').slice(0, 20), inlineStyle: (l.getAttribute('style') || '').slice(0, 160),
      blockPos: bcs?.position, blockInline: (b?.getAttribute('style') || '').slice(0, 120), svg: !!svg, svgRect: svg ? [Math.round(svg.getBoundingClientRect().width), Math.round(svg.getBoundingClientRect().height)] : null,
      cssHasAnnot: [...document.querySelectorAll('style')].some(st => /\.annot-label\s*\{/.test(st.textContent)) }; }; return { pen: V(pen), dim: V(dim) }; }, ids);
  log('H-vis', vis);
  for (const k of ['pen', 'dim']) {
    expect(vis[k] && vis[k].w > 0 && vis[k].h > 0 && vis[k].vis !== 'hidden' && vis[k].disp !== 'none' && vis[k].op !== '0', `열어 본 HTML 에서 ${k} 라벨이 보인다`).toBe(true);
    const shot = await xp.locator(`#${ids[k]} .annot-label`).screenshot();
    const d = await darkIn(xp, shot.toString('base64'), 'image/png', 1, { x: 0, y: 0, w: 2000, h: 2000 });
    log(`H-dark-${k}`, d);
    expect(d.dark, `열어 본 HTML ${k} 라벨 어두운 점 > 0`).toBeGreaterThan(0);
  }
  await xp.close();
  expect(errs).toEqual([]);
});

// H2 — 지디 판정 3 ① 조건3 «음성대조 한 쌍»(DOM 쪽): export-css-collect.js EDITOR_ONLY_SEL 을 좁힌 뒤
//   ⑴ 편집 전용(.annot-handle · .annot-rot-handle · .annot-selbox) CSS 규칙은 배송본 <style> 에 0
//   ⑵ 콘텐츠(.annot-label · .annot-svg) CSS 규칙은 > 0
//   ★치수선을 «고른 채» 내보낸다 — 손잡이가 라이브에 살아 있어야 ⑴ 이 정규식의 일을 잰다(CSS 수확은 라이브에서 맞는 규칙만 담는다).
//   ⛔고른 채 내보낸 HTML 에 손잡이 «요소»가 실리나는 SELECTED-ANNOT-HANDLE-BAKED-IN-01(별건 · 미측정) — 여기선 로그만, 단언 0.
test('H2 ⓒ 단독 HTML <style> — 콘텐츠 annot 규칙은 실리고 편집 전용 annot 규칙은 0 (치수선 고른 채)', async ({ page }) => {
  const errs = await boot(page);
  const ids = await scene(page);
  const lr = await rectOf(page, `#${ids.dim} .annot-label`);
  const hit = await hitAt(page, lr.cx, lr.cy, `#${ids.dim} .annot-label`);
  expect(hit.ok, `전제: 치수선 라벨 맞힘(${hit.hit})`).toBe(true);
  await page.mouse.click(lr.cx, lr.cy);
  expect(await poll(page, (i) => document.getElementById(i).classList.contains('selected') && document.querySelectorAll(`#${i} .annot-handle`).length >= 1, ids.dim, 3000), '전제: 치수선 고름 · 라이브 손잡이 ≥1').toBe(true);
  const live = await page.evaluate((i) => ({ handle: document.querySelectorAll(`#${i} .annot-handle`).length, selbox: document.querySelectorAll(`#${i} .annot-selbox`).length }), ids.dim);
  log('H2-live', live);
  const [dh] = await Promise.all([page.waitForEvent('download', { timeout: 60000 }), page.evaluate(() => { window.exportHTMLFile(); return null; })]);
  const html = fs.readFileSync(await dh.path(), 'utf8');
  const css = [...html.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(m => m[1]).join('\n');
  const rules = (re) => (css.match(re) || []).length;
  const got = {
    label: rules(/\.annot-label[^{}]*\{/g), svg: rules(/\.annot-svg[^{}]*\{/g),
    handle: rules(/\.annot-handle[^{}]*\{/g), rot: rules(/\.annot-rot-handle[^{}]*\{/g), selbox: rules(/\.annot-selbox[^{}]*\{/g),
  };
  log('H2-css', got);
  log('H2-elem(SELECTED-ANNOT-HANDLE-BAKED-IN-01 · 단언 0)', { handle: (html.match(/class="[^"]*\bannot-handle\b/g) || []).length, selbox: (html.match(/class="[^"]*\bannot-selbox\b/g) || []).length });
  expect(got.label, '⑵ .annot-label 규칙 > 0').toBeGreaterThan(0);
  expect(got.svg, '⑵ .annot-svg 규칙 > 0').toBeGreaterThan(0);
  expect(got.handle + got.rot + got.selbox, '⑴ 편집 전용 annot 규칙 0').toBe(0);
  expect(errs).toEqual([]);
});
