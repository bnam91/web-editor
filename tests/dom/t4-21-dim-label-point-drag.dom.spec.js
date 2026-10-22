// t4-21 — 치수선의 흰 점(처음 찍은 d·c)을 끌면 라벨 글이 치수선을 떠나 점 c 로 옮겨지는 버그 (지디 노트 :49 · :184 «a·b 점을 끌면 라벨 텍스트가 옮겨지는 버그»).
// 장면은 앱 제 문으로만: 새 섹션 단추 · 펜 메뉴 «사이즈 스티커»(toggleDimMode) · 섹션 클릭 3번 · Esc ×2 · 라벨 클릭(고르기) · 손잡이 마우스 끌기. page.evaluate 는 읽기만.
// 낱말(코드 정의 · js/annotation-select.js _ensureHandles 주석): a·b = 치수선 양끝 파란 손잡이(.annot-dim-handle · dimA/dimB) · d·c = 처음 찍은 흰 손잡이(.annot-handle[pointIdx]).
//   ⚠️원문은 «a·b 점»이라 적었다 — 탐침(S7 s1 · 05eefbd5)에서 라벨이 «옮겨지는» 것은 흰 점(d·c) 끌기였다(라벨−중점 (0,−11) → (212.2, 55)).
//     파란 a·b 끌기는 라벨이 치수선 중점을 따라간다(설계 — annot-dim-geometry.js labelAt) ⇒ G0 이 그 꼴을 지킨다.
// 자 — «라벨 중심 − 치수선 중점»(화면 px · 줌 100). 기대 = 만든 직후 값(lift 11 → (0, −11)) 그대로 ±2.
//   ＋ a·b 가 박혀 있으면(dimA/dimB · 만들 때 찍힌다) d·c 끌기는 보조선만 바꾼다 ⇒ 라벨 «절대 자리»도 그대로 ±2.
// 성공 = 단언 (칸마다 · 바닥 05eefbd5 에서 R1·R2 빨강 · G0 초록)
// 판 정체 — HEAD === EXPECT_SHA · ID_FILES 마다 페이지가 받은 sha1 === 디스크 === EXPECT_FILES_SHA1(JSON · ~/taeyang-098/ty-specenv.py 로 파생)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

test.describe.configure({ timeout: 90000 });

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1600, height: 1200 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const ID_FILES = ['js/annotation-select.js', 'js/annotation-tool.js', 'js/blocks/annot-dim-geometry.js', 'js/blocks/annotation-block.js'];
const TOL = 2;
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`T421 ${tag} ${JSON.stringify(o)}`);

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
  await page.addInitScript(() => {
    window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) });
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
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.makeAnnotationBlock === 'function' && typeof window.annotDimGeometry === 'function', null, { timeout: 30000 });
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

// 지금 화면의 치수선 — 라벨 중심 · 치수선 두 끝(svg 좌표 → 화면) · 중점 · 손잡이
const snap = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const C = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const m = b.querySelector('.annot-svg')?.getScreenCTM();
  const P = (x, y) => { const p = new DOMPoint(Number(x), Number(y)).matrixTransform(m); return [p.x, p.y]; };
  const ln = b.querySelector('.annot-dim-line');
  const a = P(ln.getAttribute('x1'), ln.getAttribute('y1')), bb = P(ln.getAttribute('x2'), ln.getAttribute('y2'));
  const mid = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2];
  const lab = C(b.querySelector('.annot-label'));
  return { lab, a, b: bb, mid, lm: [lab[0] - mid[0], lab[1] - mid[1]],
    handles: [...b.querySelectorAll('.annot-handle')].map(h => ({ k: h.dataset.dimEnd || ('p' + h.dataset.pointIdx), at: C(h) })) };
}, id);

// 앱 문으로 치수선 하나 만들고 고른다 → id
async function makeDim(page) {
  await zoom100(page);
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  expect(await poll(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length), '전제: 새 섹션').toBe(true);
  const sec = (await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id))).find(x => !before.includes(x));
  await page.evaluate((s) => document.getElementById(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sec);
  await waitStableRect(page, `#${sec}`);
  const sr = await rectOf(page, `#${sec}`);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="toggleDimMode"]');
  // 고정 대기 0줄(tests/unit/dom-fixed-wait-census W3) — 클릭마다 «그 클릭이 먹혔다»를 기다린다: 미리보기 점 1 → 2 → 치수선 블럭
  const P = [[sr.x + 250, sr.y + sr.h - 60], [sr.x + 550, sr.y + sr.h - 60], [sr.x + 400, sr.y + sr.h - 110]];
  for (const [k, p] of P.slice(0, 2).entries()) {
    await page.mouse.click(p[0], p[1]);
    expect(await poll(page, (n) => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= n, k + 1, 4000), `전제: 클릭 ${k + 1} 이 점으로 먹혔다`).toBe(true);
  }
  await page.mouse.click(P[2][0], P[2][1]);
  expect(await poll(page, (s) => !!document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]'), sec, 4000), '전제: 치수선 생김(클릭 3)').toBe(true);
  const id = await page.evaluate((s) => document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]').id, sec);
  // 만든 직후 라벨이 편집에 들어간 «뒤»에 Esc(라벨 keydown) — 들어가기 전에 누르면 안 닿는다(dimension-sticker-t3-01 selectDim 머리 :86~95)
  //   ★«편집에 들어갔다» = contenteditable 만이 아니라 ★포커스까지 — 포커스는 setTimeout 0 뒤에 온다(js/annotation-select.js annotBeginLabelEdit 끝)
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return l?.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, id, 4000), '전제: 라벨이 편집에 들어갔다(포커스까지)').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, (i) => document.querySelector(`#${i} .annot-label`)?.getAttribute('contenteditable') !== 'true', id, 4000), '전제: 라벨 편집에서 빠져나왔다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, () => !document.body.classList.contains('pen-mode'), null, 4000), '전제: 펜 모드 꺼짐').toBe(true);
  const lr = await rectOf(page, `#${id} .annot-label`);
  const hit = await hitAt(page, lr.cx, lr.cy, `#${id} .annot-label`);
  expect(hit.ok, `전제: 라벨 맞힘(${hit.hit})`).toBe(true);
  await page.mouse.click(lr.cx, lr.cy);
  expect(await poll(page, (i) => document.getElementById(i).classList.contains('selected') && document.querySelectorAll(`#${i} .annot-handle`).length >= 4, id, 3000), '전제: 고름 · 손잡이 넷(d·c·a·b)').toBe(true);
  expect(await page.evaluate((i) => !!(document.getElementById(i).dataset.dimA && document.getElementById(i).dataset.dimB), id), '전제: a·b 가 박혔다(dimA·dimB)').toBe(true);
  return id;
}

// 손잡이를 마우스로 끈다 — 끄는 동안 한 번 · 놓은 뒤 한 번 잰다
async function drag(page, id, key, dx, dy) {
  const s0 = await snap(page, id);
  const h = s0.handles.find(h => h.k === key);
  expect(h, `전제: 손잡이 ${key}`).toBeTruthy();
  const hit = await hitAt(page, h.at[0], h.at[1], '.annot-handle');
  expect(hit.ok, `전제: 손잡이 ${key} 맞힘(${hit.hit})`).toBe(true);
  await page.mouse.move(h.at[0], h.at[1]); await page.mouse.down();
  for (let i = 1; i <= 10; i++) await page.mouse.move(h.at[0] + dx * i / 10, h.at[1] + dy * i / 10);
  const during = await snap(page, id);
  await page.mouse.up();
  const after = await snap(page, id);
  return { s0, during, after };
}
const near = (p, q) => Math.abs(p[0] - q[0]) <= TOL && Math.abs(p[1] - q[1]) <= TOL;

test('G0 (지킴) 파란 a 를 끌면 라벨은 치수선 중점을 따라간다 — 라벨−중점 그대로', async ({ page }) => {
  const errs = await boot(page);
  const id = await makeDim(page);
  const r = await drag(page, id, 'A', 0, -40);
  log('G0', r);
  expect(r.during.a[1] < r.s0.a[1] - 20, '전제: a 가 실제로 움직였다').toBe(true);
  expect(near(r.during.lm, r.s0.lm), `끄는 동안 라벨−중점 ${r.during.lm} ≈ ${r.s0.lm}`).toBe(true);
  expect(near(r.after.lm, r.s0.lm), `놓은 뒤 라벨−중점 ${r.after.lm} ≈ ${r.s0.lm}`).toBe(true);
  expect(errs).toEqual([]);
});

for (const [name, key, dx, dy] of [['R1 흰 d(첫 점)', 'p0', -50, 0], ['R2 흰 c(둘째 점)', 'p1', 40, 20]]) {
  test(`${name} 를 끌어도 라벨은 치수선에 남는다 — 라벨 자리·라벨−중점 그대로`, async ({ page }) => {
    const errs = await boot(page);
    const id = await makeDim(page);
    const r = await drag(page, id, key, dx, dy);
    log(name, r);
    const moved = r.during.handles.find(h => h.k === key);
    expect(moved && Math.hypot(moved.at[0] - r.s0.handles.find(h => h.k === key).at[0], moved.at[1] - r.s0.handles.find(h => h.k === key).at[1]) > 20, '전제: 흰 점이 실제로 움직였다').toBe(true);
    expect(near(r.during.lab, r.s0.lab), `끄는 동안 라벨 자리 ${r.during.lab} ≈ ${r.s0.lab}`).toBe(true);
    expect(near(r.after.lab, r.s0.lab), `놓은 뒤 라벨 자리 ${r.after.lab} ≈ ${r.s0.lab}`).toBe(true);
    expect(near(r.after.lm, r.s0.lm), `놓은 뒤 라벨−중점 ${r.after.lm} ≈ ${r.s0.lm}`).toBe(true);
    expect(errs).toEqual([]);
  });
}
