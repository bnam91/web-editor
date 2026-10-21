// W2D-06d — 선 스티커 끌기가 자리(dataset.x/y)를 안 민다 (지디 다시 걸기 · S7 ⑥-1 probe-2 실측).
// 장면은 앱 제 문(플로팅 패널 메뉴 · 마우스 끌기 · 끝점/두께 손잡이 · Shift 누름 · 우측 패널 단추)으로만 짓는다. page.evaluate 는 읽기만.
// 고정 대기 0줄 — 기다림은 waitForFunction(polling) / 하네스 waitStableRect 뿐. rect 는 가라앉힌 뒤 두 번 읽는다.
//
// 자 — 선 스티커의 «자리»(dataset.x/y)가 만들 때 식(js/blocks/sticker-block.js addStickerBlock 의 선 갈래)과 같은가:
//   x = min(x1, x2) · y = min(y1, y2) − 보정 · 보정 = highlightB 두께/2 · arrow ArrowFx.headLen(두께)/2   (±1 · 반올림 몫)
//   ⇒ 조작마다 «그 조작 뒤 dataset.x/y 가 따라왔나»를 한 칸씩 잰다(N 의 분모 = 아래 칸 목록).
//
// 성공 = 단언 (칸마다 · 바닥 04ce0b74 에서 빨강이면 그 조작이 «써야 하는데 안 쓰는 자리»)
//   C0(지키는 칸) 만든 직후 · O1 몸통 끌기 · O2 끝점(end) 손잡이 · O3 끝점(start) 손잡이 · O4 두께 손잡이(highlightB)
//   O5 복수 선택 «왼쪽 정렬»(js/props/prop-multisel.js → _translateSticker) · O6 보통 스티커를 패널에서 «선 형광펜»으로 바꿈
//   O7 우측 패널 두께(선 형광펜 · js/props/prop-sticker.js bindHlbThick) · O8 우측 패널 두께(화살표 · js/props/prop-sticker-arrow.js pair) — 끝점은 그대로 · 보정만 바뀐다
//
// 판 정체 — ⑴ git -C ROOT rev-parse HEAD === EXPECT_SHA
//           ⑵ IDENT_FILES 마다 페이지가 받은 sha1 === ROOT 파일 sha1 === EXPECT_FILE_SHA1S 의 같은 자리 값
//   EXPECT_FILE_SHA1S = 순수 sha1(파일 내용) — `shasum -a 1 <파일>` · ⛔`git hash-object`(blob 머리가 붙어 값이 다르다).
//   ★판 정체 ⑴ 의 양성대조 — 2026-10-22 fixG-1: EXPECT_SHA 를 한 판 전 것(04ce0b74)으로 준 채 레인이 커밋(b3800aea)되자
//     12 칸 전부 «판 정체 ⑴» 그 자리에서 멈췄다(무효 런) ⇒ 이 단언은 엉뚱한 판을 잡는다 — ⛔지우지 마라.
//   IDENT_NO_GIT=1 (변이 사본 전용 · .git 없는 나무) — ⑴ 을 건너뛰고 그 사실을 로그에 남긴다 · 판 정체는 ⑵(서빙 파일 sha1)로만 묶는다.
//     (사본 나무에 .git 파일을 두면 git 이 레인 worktree 의 HEAD 를 읽어 사본 내용을 안 묶는다 — 태양 22:5x 실측)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1440, height: 900 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const EXPECT_SHA = process.env.EXPECT_SHA || '';
const IDENT_FILES = (process.env.IDENT_FILES || 'js/sticker-select.js,js/blocks/sticker-block.js,js/props/prop-sticker.js,js/props/prop-sticker-arrow.js').split(',');
const EXPECT_FILE_SHA1S = (process.env.EXPECT_FILE_SHA1S || '').split(',');
const DRAG = 60;   // 끌기 거리(화면 px)
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`W06D ${tag} ${JSON.stringify(o)}`);

async function assertBoard(page) {
  expect(EXPECT_SHA, '판 정체: EXPECT_SHA env 가 풀 sha 40자').toMatch(/^[0-9a-f]{40}$/);
  expect(EXPECT_FILE_SHA1S.length, '판 정체: EXPECT_FILE_SHA1S 수 = IDENT_FILES 수').toBe(IDENT_FILES.length);
  const noGit = process.env.IDENT_NO_GIT === '1';
  const headSha = noGit ? null : execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const rows = [];
  for (let i = 0; i < IDENT_FILES.length; i++) {
    const f = IDENT_FILES[i];
    const rootSha1 = sha1(fs.readFileSync(path.join(ROOT, f)));
    const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
      let bin = ''; for (let k = 0; k < a.length; k += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(bin); }, `${ORIGIN}/${f}`);
    rows.push({ file: f, rootSha1, pageSha1: sha1(Buffer.from(b64, 'base64')), expect: EXPECT_FILE_SHA1S[i] });
  }
  log('ident', { root: ROOT, expectSha: EXPECT_SHA, headSha, noGit, rows });
  if (!noGit) expect(headSha, '판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  for (const r of rows) {
    expect(r.pageSha1, `판 정체 ⑵a: 페이지가 받은 ${r.file} === ROOT 파일`).toBe(r.rootSha1);
    expect(r.rootSha1, `판 정체 ⑵b: ROOT ${r.file} === EXPECT_FILE_SHA1S`).toBe(r.expect);
  }
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
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.getSelectedSection === 'function' && typeof window._isLineSticker === 'function', null, { timeout: 30000 });
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
async function softClick(page, x, y, sel, mods = []) {
  const hit = await page.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); if (!e) return { ok: false, hit: null };
    return { ok: !!(e.matches(sel) || e.closest(sel)), hit: (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] }; }, [x, y, sel]);
  if (hit.ok) { for (const m of mods) await page.keyboard.down(m); await page.mouse.click(x, y); for (const m of mods.slice().reverse()) await page.keyboard.up(m); }
  return hit;
}
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);
const secIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));

async function newSection(page) {
  const before = await secIds(page);
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const id = (await secIds(page)).find(x => !before.includes(x)) || null;
  expect(id, '전제: 새 섹션이 생겼다').toBeTruthy();
  expect(await pollTrue(page, (i) => window.getSelectedSection?.()?.id === i, id, 3000), '전제: 새 섹션이 골라졌다').toBe(true);
  await clearText(page, id);
  return id;
}
// 새 섹션의 기본 글자를 앱 문(누름 + Delete)으로 지운다 — 선 형광펜(z 1)은 글자(z 2) 아래라 그 위를 누르면 글자를 맞힌다(v1 부름: 손잡이·몸통 누름이 .tb-h2)
async function clearText(page, secId) {
  for (let k = 0; k < 6; k++) {
    const tb = await page.evaluate((s) => document.getElementById(s).querySelector('.text-block')?.id || null, secId);
    if (!tb) break;
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    await scrollTo(page, `[id="${tb}"]`);
    const r = await stableTwice(page, `[id="${tb}"]`);
    const hit = await softClick(page, r.cx, r.cy, `[id="${tb}"]`);
    expect(hit.ok, `전제: 지울 글자를 맞혔다(${hit.hit})`).toBe(true);
    expect(await pollTrue(page, (i) => !!document.getElementById(i)?.classList.contains('selected'), tb, 3000), '전제: 글자가 골라졌다(편집 아님)').toBe(true);
    await page.keyboard.press('Delete');
    expect(await pollTrue(page, (i) => !document.getElementById(i), tb, 3000), `전제: 글자 ${tb} 가 Delete 로 지워졌다`).toBe(true);
  }
  expect(await page.evaluate((s) => document.getElementById(s).querySelectorAll('.text-block').length, secId), '전제: 섹션에 글자 0').toBe(0);
  const picked = await page.evaluate((s) => window.getSelectedSection?.()?.id === s, secId);
  if (!picked) {
    const hz = await stableTwice(page, `[id="${secId}"] .section-hitzone`);
    await softClick(page, hz.left + 10, hz.cy, `[id="${secId}"] .section-hitzone`);
    expect(await pollTrue(page, (i) => window.getSelectedSection?.()?.id === i, secId, 3000), '전제: 섹션을 다시 골랐다').toBe(true);
  }
}
async function markSeen(page) { await page.evaluate(() => document.querySelectorAll('.sticker-block').forEach(e => { e.__w06d = true; })); }
async function insSticker(page, label) {
  await markSeen(page);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-pen-menu .fp-menu-item').filter({ hasText: new RegExp('^\\s*' + label + '\\s*$') }).first().click();
  await pollTrue(page, () => [...document.querySelectorAll('.sticker-block')].some(e => !e.__w06d));
  const ids = await page.evaluate(() => [...document.querySelectorAll('.sticker-block')].filter(e => !e.__w06d).map(e => e.id));
  expect(ids.length, `전제: ${label} 를 메뉴로 넣었다(새 스티커 1개)`).toBe(1);
  await stableTwice(page, `[id="${ids[0]}"]`);
  return ids[0];
}
// 자 — 지금 끝점에서 만들 때 식으로 계산한 자리와 dataset.x/y
//   ★기대값은 이 spec 이 «제 식»으로 끝점에서 셈한다(앱의 한 벌 window._lineStickerBox 를 부르지 않는다) — 앱 한 벌이 언제나 옛 값·null 을
//     돌려주는 판에서도 이 자는 빨갛다(항등식 아님). 끝점은 조작(끌기·손잡이·정렬)이 만든 값이라 고침과 무관하다.
//   ㉡ 이 식은 앱 _lineStickerBox(js/blocks/sticker-block.js)와 «따로» 산다 — 앱 식이 바뀌면 여기도 같이 본다(⛔한쪽만 지우지 마라).
//     두 식의 대조는 C0 칸(log «C0-twin»)에 있다 — 수(고친 판 · 2026-10-22 00:50 · twin-1): Highlight spec (350,151.5) = 앱 (350,151.5) ·
//     Arrow Line spec (350,94) = 앱 (350,94).
async function pos(page, id) {
  return page.evaluate((i) => {
    const e = document.getElementById(i); const d = e.dataset; const t = parseFloat(d.thickness);
    const x1 = parseFloat(d.x1), y1 = parseFloat(d.y1), x2 = parseFloat(d.x2), y2 = parseFloat(d.y2);
    const corr = d.shape === 'highlightB' ? (Number.isFinite(t) ? t : 12) / 2
      : d.shape === 'arrow' ? (window.ArrowFx?.headLen?.(Number.isFinite(t) ? t : 4) ?? 12) / 2 : 0;
    const want = { x: Math.min(x1, x2), y: Math.min(y1, y2) - corr };
    const have = { x: parseFloat(d.x), y: parseFloat(d.y) };
    return { id: i, shape: d.shape, isLine: !!window._isLineSticker?.(e), x1, y1, x2, y2, thickness: d.thickness ?? null, corr, want, have,
      styleLeft: e.style.left, styleTop: e.style.top, ok: Math.abs(have.x - want.x) <= 1 && Math.abs(have.y - want.y) <= 1 };
  }, id);
}
async function dragBy(page, from, dx, dy) {
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  await page.mouse.move(from.x + dx, from.y + dy, { steps: 8 }); await page.mouse.up();
}
// 선 위 가운데(몸통) — 선을 그리는 요소의 rect 가운데
const bodyMid = (page, id) => page.evaluate((i) => { const e = document.getElementById(i); const p = e.querySelector('.sticker-hlb-line, .arrow-hit, path, line, polyline') || e; const r = p.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, id);
const handleMid = (page, id, ep) => page.evaluate(([i, ep]) => { const h = document.getElementById(i).querySelector(`.hlb-handle[data-endpoint="${ep}"]`); if (!h) return null; const r = h.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [id, ep]);
async function hitAt(page, p) {
  return page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] + (e.dataset?.endpoint ? `[${e.dataset.endpoint}]` : '') : null; }, [p.x, p.y]);
}
function judge(cell, label, before, after, extra = {}) {
  log('cell', { cell, label, before: { have: before.have, want: before.want }, after: { have: after.have, want: after.want, x1: after.x1, y1: after.y1, x2: after.x2, y2: after.y2, corr: after.corr, styleLeft: after.styleLeft, styleTop: after.styleTop }, ...extra });
  expect.soft(after.ok, `${cell} ${label}: 조작 뒤 dataset.x/y (${after.have.x},${after.have.y}) = 만들 때 식 (${after.want.x},${after.want.y}) ±1`).toBe(true);
}

for (const label of ['Highlight', 'Arrow Line']) {
  test(`W06D C0·O1 ${label} — 만든 직후 · 몸통 끌기`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await boot(page);
    await newSection(page);
    const L = await insSticker(page, label);
    const p0 = await pos(page, L);
    expect(p0.isLine, '전제: 선 스티커').toBe(true);
    judge('C0', label, p0, p0);
    // ㉠ 두 식 대조(지디) — 이 spec 의 식(pos)과 앱 한 벌 window._lineStickerBox 가 만든 직후 같은 답을 내나. 앱 한 벌이 없는 판(바닥)은 기록만.
    const app = await page.evaluate((i) => (typeof window._lineStickerBox === 'function' ? window._lineStickerBox(document.getElementById(i)) : null), L);
    log('C0-twin', { label, spec: p0.want, app });
    if (app) expect.soft(Math.abs(app.x - p0.want.x) < 0.01 && Math.abs(app.y - p0.want.y) < 0.01, `C0 ${label}: spec 식 (${p0.want.x},${p0.want.y}) = 앱 _lineStickerBox (${app.x},${app.y})`).toBe(true);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const m = await bodyMid(page, L);
    const hit = await hitAt(page, m);
    expect(hit && hit.includes('hlb-handle') === false, `전제: 몸통을 눌렀다(손잡이 아님 · ${hit})`).toBe(true);
    await dragBy(page, m, DRAG, DRAG / 2);
    await stableTwice(page, `[id="${L}"]`);
    const p1 = await pos(page, L);
    expect(p1.x1 !== p0.x1 || p1.y1 !== p0.y1, '전제: 끝점이 움직였다(끌기가 먹었다)').toBe(true);
    judge('O1', label, p0, p1, { hit });
    expect(errs).toEqual([]);
  });

  for (const ep of ['end', 'start']) {
    test(`W06D ${ep === 'end' ? 'O2' : 'O3'} ${label} — 끝점(${ep}) 손잡이 끌기`, async ({ page }) => {
      test.setTimeout(120000);
      const errs = await boot(page);
      await newSection(page);
      const L = await insSticker(page, label);
      expect(await pollTrue(page, ([i, e]) => !!document.getElementById(i).querySelector(`.hlb-handle[data-endpoint="${e}"]`), [L, ep]), `전제: ${ep} 손잡이가 있다(만든 직후 골라진 상태)`).toBe(true);
      const p0 = await pos(page, L);
      const h = await handleMid(page, L, ep);
      const hit = await hitAt(page, h);
      expect(hit && hit.includes(`[${ep}]`), `전제: ${ep} 손잡이를 맞혔다(${hit})`).toBe(true);
      // start 는 왼쪽·위로(상자 min 이 바뀐다) · end 는 오른쪽·위로(y 의 min 이 바뀐다)
      await dragBy(page, h, ep === 'start' ? -DRAG : DRAG, -DRAG / 2);
      await stableTwice(page, `[id="${L}"]`);
      const p1 = await pos(page, L);
      expect(p1.x1 !== p0.x1 || p1.y1 !== p0.y1 || p1.x2 !== p0.x2 || p1.y2 !== p0.y2, '전제: 끝점이 움직였다').toBe(true);
      judge(ep === 'end' ? 'O2' : 'O3', label, p0, p1, { hit });
      expect(errs).toEqual([]);
    });
  }

  test(`W06D O5 ${label} — 복수 선택 «왼쪽 정렬»(_translateSticker)`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await boot(page);
    await newSection(page);
    const N = await insSticker(page, 'Sticker');
    const L = await insSticker(page, label);
    // 보통 스티커를 왼쪽으로 옮겨 둔다(정렬이 선 스티커를 움직이게) — 몸통 끌기
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const nr = await stableTwice(page, `[id="${N}"]`);
    await dragBy(page, { x: nr.cx, y: nr.cy }, -DRAG, 0);   // v3 부름: −2·DRAG,+DRAG 는 탄성으로 섹션 밖에 나가 Shift 누름이 #canvas-wrap 을 맞혔다
    expect(await page.evaluate(([n, s]) => document.getElementById(n).closest('.section-block')?.id === s && (() => { const a = document.getElementById(n).getBoundingClientRect(); const b = document.getElementById(s).getBoundingClientRect(); return a.left >= b.left && a.right <= b.right && a.top >= b.top && a.bottom <= b.bottom; })(), [N, await page.evaluate((n) => document.getElementById(n).closest('.section-block').id, N)]), '전제: 보통 스티커가 섹션 상자 안').toBe(true);
    await stableTwice(page, `[id="${N}"]`);
    const p0 = await pos(page, L);
    await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
    const lm = await bodyMid(page, L);
    const h1 = await softClick(page, lm.x, lm.y, `[id="${L}"]`);
    expect(h1.ok, `전제: 선 스티커를 눌렀다(${h1.hit})`).toBe(true);
    const nr2 = await stableTwice(page, `[id="${N}"]`);
    const h2 = await softClick(page, nr2.cx, nr2.cy, `[id="${N}"]`, ['Shift']);
    expect(h2.ok, `전제: 보통 스티커를 Shift 로 더 골랐다(${h2.hit})`).toBe(true);
    expect(await pollTrue(page, () => !!document.querySelector('#panel-right [data-ov-align="left"]')), '전제: 복수 선택 패널(왼쪽 정렬 단추)').toBe(true);
    await page.click('#panel-right [data-ov-align="left"]', { timeout: 10000 });
    await stableTwice(page, `[id="${L}"]`);
    const p1 = await pos(page, L);
    expect(p1.x1 !== p0.x1 || p1.x2 !== p0.x2, '전제: 정렬이 선 스티커 끝점을 움직였다').toBe(true);
    judge('O5', label, p0, p1);
    expect(errs).toEqual([]);
  });
}

test('W06D O4 Highlight — 두께 손잡이 끌기', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await boot(page);
  await newSection(page);
  const L = await insSticker(page, 'Highlight');
  expect(await pollTrue(page, (i) => !!document.getElementById(i).querySelector('.hlb-handle[data-endpoint="thick"]'), L), '전제: 두께 손잡이가 있다').toBe(true);
  const p0 = await pos(page, L);
  const h = await handleMid(page, L, 'thick');
  const hit = await hitAt(page, h);
  expect(hit && hit.includes('[thick]'), `전제: 두께 손잡이를 맞혔다(${hit})`).toBe(true);
  await dragBy(page, h, 0, DRAG / 3);
  await stableTwice(page, `[id="${L}"]`);
  const p1 = await pos(page, L);
  expect(p1.thickness !== p0.thickness, `전제: 두께가 바뀌었다(${p0.thickness} → ${p1.thickness})`).toBe(true);
  judge('O4', 'Highlight', p0, p1, { hit });
  expect(errs).toEqual([]);
});

for (const c of [{ cell: 'O7', label: 'Highlight', num: '#stk-hlb-thick-num', v: 30 }, { cell: 'O8', label: 'Arrow Line', num: '#stk-arrow-thick-num', v: 8 }]) {
  test(`W06D ${c.cell} ${c.label} — 우측 패널 두께`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await boot(page);
    await newSection(page);
    const L = await insSticker(page, c.label);
    expect(await pollTrue(page, (sel) => !!document.querySelector(sel), c.num), `전제: 우측 패널 두께 칸 ${c.num}`).toBe(true);
    const p0 = await pos(page, L);
    await page.fill(c.num, String(c.v), { timeout: 10000 });
    await page.press(c.num, 'Enter');
    expect(await pollTrue(page, ([i, v]) => Number(document.getElementById(i).dataset.thickness) === v, [L, c.v]), `전제: 두께가 ${c.v} 가 됐다`).toBe(true);
    await stableTwice(page, `[id="${L}"]`);
    const p1 = await pos(page, L);
    judge(c.cell, c.label, p0, p1);
    expect(errs).toEqual([]);
  });
}

test('W06D O6 Sticker → 패널 «선 형광펜» 으로 바꿈', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await boot(page);
  await newSection(page);
  const S = await insSticker(page, 'Sticker');
  expect(await pollTrue(page, () => !!document.querySelector('#stk-shape-group [data-shape="highlightB"]')), '전제: 우측 패널 모양 단추(선 형광펜)').toBe(true);
  const before = await page.evaluate((i) => { const d = document.getElementById(i).dataset; return { x: d.x, y: d.y, shape: d.shape }; }, S);
  await page.click('#stk-shape-group [data-shape="highlightB"]', { timeout: 10000 });
  expect(await pollTrue(page, (i) => document.getElementById(i).dataset.shape === 'highlightB', S), '전제: 모양이 선 형광펜이 됐다').toBe(true);
  await stableTwice(page, `[id="${S}"]`);
  const p1 = await pos(page, S);
  judge('O6', 'Sticker→highlightB', { have: before, want: before }, p1, { before });
  expect(errs).toEqual([]);
});
