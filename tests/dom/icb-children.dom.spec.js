/* icb-children.dom.spec.js — G14 「원형이 그릇이 된다」 (현빈 2026-10-03 안 ㉢ 확정 · 지디 GO 2026-10-04)
 *   서클 에셋블럭(.icon-circle-block)의 안쪽 원(.icb-circle)에 자식 그릇 .icb-children — 자식이 ≥1 일 때만.
 *   넣는 길: 우측 패널 「＋ 블럭 넣기 ▾」(#icb-kid-add-kind) → window.addCircleChild(circle, 'body'|'h2'|'icon').
 *   패널 배경 = 채움 켬/끔(#icb-fill-toggle · 끔 = 기존 값 'transparent') + 기존 색칸(hex·%) — 투명도는 «배경만»(㉠, 지디 확정).
 *   B1 = 오버레이 토글(#icb-float-toggle · prop-iconify 와 같은 공용 overlay-float).
 * ★양성대조 판 = 5015a2ab(G14 직전 origin/dev). GD1001_ROOT=<그 판 사본> 으로 같은 파일을 돌린다.
 *   «새 동작» 시험은 그 판에서 빨강, «지키는» 시험(K0·K0b·K15b)은 초록이어야 한다 — 명부는 C1 커밋 메시지.
 * ★전제 단언 먼저(0건 초록 금지) · 진짜 입력(마우스·키·select·filechooser) · 판정은 DOM 과 «화면 픽셀».
 * 하네스 = _root-harness bootApp(앱 통째 헤드리스, ⛔Electron 아님 — 파일 저장/불러오기 자체는 직렬화 왕복으로 갈음).
 */
const { test, expect } = require('@playwright/test');
const path = require('path');
const { execFileSync } = require('child_process');
const { bootApp, waitStableRect, ORIGIN } = require('./_root-harness.js');

test.setTimeout(90000);

const SEC = `<div class="section-block" id="sC" data-section="1" data-name="C" data-bg="#ffffff" style="background-color:#ffffff;">
  <div class="section-hitzone"><span class="section-label">C</span></div>
  <div class="section-inner" id="innerC"><div class="gap-block" data-type="gap" id="gC0" style="height:40px;"></div>
  <div class="gap-block" data-type="gap" id="gC1" style="height:200px;"></div></div></div>`;
// 왼쪽 절반 불투명 파랑 · 오른쪽 절반 완전 투명 (2×1)
const HALF = 'iVBORw0KGgoAAAANSUhEUgAAAAIAAAABCAYAAAD0In+KAAAAD0lEQVR4nGNgYPj/nwEIAAr+Af/hHqJQAAAAAElFTkSuQmCC';

/** 앱을 띄우고 «진짜 생성기»(makeIconCircleBlock)로 지름 400 서클을 섹션에 놓는다. */
async function setup(page, { size = 400 } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  const id = await page.evaluate(({ h, size }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    const { row, block } = window.makeIconCircleBlock();
    row.id = 'rowC';
    block.dataset.size = String(size);
    const circ = block.querySelector('.icb-circle'); circ.style.width = size + 'px'; circ.style.height = size + 'px';
    document.getElementById('gC0').after(row);
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
    return block.id;
  }, { h: SEC, size });
  await page.waitForTimeout(300);
  const pre = await page.evaluate((id) => ({ ok: !!document.querySelector(`#${id} > .icb-circle`), kids: document.querySelectorAll('.icb-children').length }), id);
  expect(pre, '전제 — 서클이 섹션에 있고 그릇 0개').toEqual({ ok: true, kids: 0 });
  return { errs, id };
}
const park = (page) => page.mouse.move(5, 500);
async function pixelAt(page, x, y) {
  const buf = await page.screenshot({ clip: { x: Math.round(x) - 1, y: Math.round(y) - 1, width: 3, height: 3 } });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height;
    const g = c.getContext('2d'); g.drawImage(img, 0, 0);
    const d = g.getImageData(Math.floor(img.width / 2), Math.floor(img.height / 2), 1, 1).data;
    return [d[0], d[1], d[2]];
  }, buf.toString('base64'));
}
const near = (a, b, tol = 8) => a.every((v, i) => Math.abs(v - b[i]) <= tol);
const isChecker = (px) => near(px, [0xd8, 0xd8, 0xd8]) || near(px, [0xf0, 0xf0, 0xf0]);

/** 서클 «원»을 진짜 클릭으로 고른다(원 윗쪽 12% 지점 — 가운데 자식 그릇을 피한다). 패널이 서클 패널이어야 한다. */
async function selectCircle(page, id) {
  const r = await waitStableRect(page, `#${id} .icb-circle`);
  await page.mouse.click(r.cx, r.top + r.height * 0.12);
  await page.waitForTimeout(300);
  return page.evaluate(() => !!document.getElementById('icb-size-number'));
}
async function centreOf(page, sel) {
  return page.evaluate((sel) => { const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return r.width ? [r.left + r.width / 2, r.top + r.height / 2] : null; }, sel);
}
/** 패널 「＋ 블럭 넣기 ▾」로 하나 넣는다(서클 선택 → select 고르기). 넣은 블럭 id. */
async function addViaPanel(page, id, kind) {
  expect(await selectCircle(page, id), '전제 — 서클 패널').toBe(true);
  const has = await page.evaluate(() => !!document.getElementById('icb-kid-add-kind'));
  expect(has, '패널에 「＋ 블럭 넣기 ▾」(#icb-kid-add-kind)가 있다').toBe(true);
  await page.selectOption('#icb-kid-add-kind', kind);
  await page.waitForTimeout(300);
  return page.evaluate((id) => { const box = document.querySelector(`#${id} > .icb-circle > .icb-children`); const k = box ? [...box.children].filter(c => !c.classList.contains('drop-indicator')) : []; return k.map(e => e.id); }, id);
}
const setKidText = (page, id, text) => page.evaluate(({ id, text }) => {
  const t = document.querySelector(`#${id} .icb-children .text-block [class^="tb-"]`) || document.querySelector(`#${id} .icb-children .text-block`);
  t.textContent = text; delete t.dataset.isPlaceholder; return true;
}, { id, text });
const kidState = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const circ = b.querySelector('.icb-circle'); const box = circ.querySelector(':scope > .icb-children');
  const cr = circ.getBoundingClientRect(); const br = box ? box.getBoundingClientRect() : null;
  return { box: !!box, n: box ? box.children.length : 0, vis: box ? getComputedStyle(box).visibility : null,
    circ: { cx: cr.left + cr.width / 2, cy: cr.top + cr.height / 2, w: cr.width, top: cr.top, left: cr.left, h: cr.height },
    kbox: br ? { cx: br.left + br.width / 2, cy: br.top + br.height / 2, w: br.width } : null,
    hasImg: b.classList.contains('has-image'), overflow: getComputedStyle(circ).overflow };
}, id);

/* ═══ 기준판(5015a2ab) git 객체로 같은 앱을 띄운다 — grid-children-shell-bytes 의 수법 그대로 ═══ */
const BASE = '5015a2ab';
const REPO = path.join(__dirname, '..', '..');
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };
const _baseCache = new Map();
function baseFile(rel) {
  if (_baseCache.has(rel)) return _baseCache.get(rel);
  let buf = null;
  try { buf = execFileSync('git', ['show', `${BASE}:${rel}`], { cwd: REPO, maxBuffer: 64 * 1024 * 1024, stdio: ['ignore', 'pipe', 'ignore'] }); } catch (_) { buf = null; }
  _baseCache.set(rel, buf);
  return buf;
}
async function bootBase(page) {
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const rel = decodeURIComponent(new URL(r.request().url()).pathname).replace(/^\/+/, '');
    const buf = baseFile(rel);
    if (!buf) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(rel)] || 'application/octet-stream', body: buf });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
}
/** 자식 0개 서클의 «꼴들» — 생성 · 패널 열기 · 그림 넣기 · 그림 빼기 · MCP 그림 · MCP 그림 빼기. */
const SNAP0 = async (b64) => {
  const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
  c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sB" data-section="1"><div class="section-inner" id="innerB"></div></div>');
  const inner = document.getElementById('innerB');
  const out = {};
  const mk = () => { const { row, block } = window.makeIconCircleBlock(); inner.appendChild(row); window.bindBlock?.(block); return block; };
  const strip = (b) => b.outerHTML.replace(/ id="[^"]*"/g, ' id=""');
  { const b = mk(); out['생성'] = strip(b); }
  { const b = mk(); window.showIconCircleProperties(b); out['패널 열기'] = strip(b); }
  const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
  const file = new File([bin], 'half.png', { type: 'image/png' });
  const waitImg = (b) => new Promise(res => { const t0 = Date.now(); (function f() { if (b.classList.contains('has-image') || Date.now() - t0 > 3000) res(); else setTimeout(f, 30); })(); });
  { const b = mk(); window.loadImageToCircle(b, file); await waitImg(b); out['그림 넣기'] = strip(b); window.clearCircleImage(b); out['그림 빼기'] = strip(b); }
  { const b = mk(); window.updateIconCircleBlock(b.id, { imgSrc: 'data:image/png;base64,' + b64 }); out['MCP 그림'] = strip(b); window.updateIconCircleBlock(b.id, { imgSrc: '' }); out['MCP 그림 빼기'] = strip(b); }
  return out;
};

test('K0 ★지키기 — 자식 0개 서클은 5015a2ab 와 outerHTML 바이트 동일(생성·패널·그림 넣기/빼기·MCP 그림 = 6꼴)', async ({ browser }) => {
  const pCur = await browser.newPage(), pBase = await browser.newPage();
  const e1 = [], e2 = []; pCur.on('pageerror', e => e1.push(String(e))); pBase.on('pageerror', e => e2.push(String(e)));
  await pCur.setViewportSize({ width: 1600, height: 1000 }); await pBase.setViewportSize({ width: 1600, height: 1000 });
  await bootApp(pCur); await bootBase(pBase);
  const cur = await pCur.evaluate(SNAP0, HALF), base = await pBase.evaluate(SNAP0, HALF);
  const keys = Object.keys(base);
  expect(keys.length, '전제 — 표본 6꼴이 모였다').toBe(6);
  expect(base['그림 넣기'], '전제 — 기준판에서 그림이 실제로 들어갔다').toContain('icb-img');
  const diffs = keys.filter(k => cur[k] !== base[k]);
  for (const k of diffs) {
    let i = 0; while (i < cur[k].length && cur[k][i] === base[k][i]) i++;
    console.log(`BYTEDIFF ${k} @${i}: cur «${cur[k].slice(Math.max(0, i - 40), i + 60)}» base «${base[k].slice(Math.max(0, i - 40), i + 60)}»`);
  }
  expect(diffs, '바이트가 다른 꼴').toEqual([]);
  expect(e1).toEqual([]); expect(e2).toEqual([]);
});

test('K1 ★패널 「＋ 블럭 넣기 › 텍스트」 → 원 안 그릇(.icb-circle > .icb-children)에 들어가고 원 한가운데(±2px)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const kids = await addViaPanel(page, id, 'body');
  expect(kids.length, '자식 하나').toBe(1);
  const s = await kidState(page, id);
  expect(s.box).toBe(true);
  expect(Math.abs(s.kbox.cx - s.circ.cx), '가로 가운데').toBeLessThanOrEqual(2);
  expect(Math.abs(s.kbox.cy - s.circ.cy), '세로 가운데').toBeLessThanOrEqual(2);
  /* 넣은 블럭이 «선택»되고 그 패널이 뜬다(삽입 래퍼 insert-select) — 서클 패널이 아니다 */
  const sel = await page.evaluate(() => ({ icb: !!document.getElementById('icb-size-number'), selInKids: !!document.querySelector('.icb-children .selected') }));
  expect(sel.selInKids, '새 자식이 선택됐다').toBe(true);
  expect(errs).toEqual([]);
});

test('K1b 제목·아이콘도 넣어진다 — 세로로 쌓이고(위→아래 순서) 간격 8px(캔버스)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'h2');
  const kids = await addViaPanel(page, id, 'icon');
  expect(kids.length).toBe(2);
  const g = await page.evaluate((id) => {
    const box = document.querySelector(`#${id} .icb-children`); const [a, b] = [...box.children];
    const z = box.getBoundingClientRect().width / box.offsetWidth;
    return { types: [a.querySelector('.text-block')?.dataset.type || a.className, b.className], gap: (b.getBoundingClientRect().top - a.getBoundingClientRect().bottom) / z, icon: !!b.closest('.icb-children') && b.classList.contains('icon-block') };
  }, id);
  expect(g.icon, '둘째는 아이콘 블럭').toBe(true);
  expect(Math.abs(g.gap - 8), `간격 8 — 잰 ${g.gap}`).toBeLessThanOrEqual(1);
  /* ⚠️하네스 한정 오류 하나는 뺀다 — 아이콘 패널(prop-iconify.js svgPresets 목록)이 electronAPI.svgPresets.list() 를 부르는데,
     하네스의 가짜 electronAPI 는 «모든 속성 = 함수»라 svgPresets 가 객체가 아니어서 .list 가 없다(실앱엔 있다). 아이콘 블럭을 고르면 늘 난다. */
  expect(errs.filter(e => !/svgPresets\?\.list is not a function/.test(e))).toEqual([]);
});

test('K2 ★넘친 글자는 원 모양으로 잘린다 · 그릇 폭 = 지름 × 1/√2(내접 정사각형)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'h2');
  await setKidText(page, id, '가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하 가나다라마바사아자차카타파하');
  await page.evaluate(() => window.deselectAll?.());
  await page.waitForTimeout(200);
  const s = await kidState(page, id);
  expect(Math.abs(s.kbox.w - s.circ.w / Math.SQRT2), `그릇 폭 ${s.kbox.w} vs ${s.circ.w / Math.SQRT2}`).toBeLessThanOrEqual(2);
  const over = await page.evaluate((id) => { const box = document.querySelector(`#${id} .icb-children`); return box.scrollHeight > document.querySelector(`#${id} .icb-circle`).clientHeight; }, id);
  expect(over, '전제 — 글자가 원 높이를 넘친다').toBe(true);
  await park(page);
  /* 원의 바깥 «모서리» 지점(사각 상자 안 · 원 밖) = 섹션 흰색 — 넘친 글자가 원 밖으로 안 새어 나온다 */
  const corner = await pixelAt(page, s.circ.left + s.circ.w * 0.06, s.circ.top + s.circ.h * 0.06);
  expect(near(corner, [255, 255, 255], 4), `원 밖 모서리 = 흰색 — 찍힌 ${corner}`).toBe(true);
  expect(errs).toEqual([]);
});

test('K3 ★자식이 있는 채로 그림 넣기(filechooser) → 자식이 남고 그림 위에 보인다', async ({ page }) => {
  const { errs, id } = await setup(page);
  const kids = await addViaPanel(page, id, 'body');
  await setKidText(page, id, 'KID');
  expect(await selectCircle(page, id)).toBe(true);
  const up = await centreOf(page, '#icb-upload-btn');
  expect(up, '전제 — 이미지 선택 버튼').not.toBeNull();
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.mouse.click(up[0], up[1])]);
  await fc.setFiles({ name: 'half.png', mimeType: 'image/png', buffer: Buffer.from(HALF, 'base64') });
  await page.waitForTimeout(700);
  const s = await kidState(page, id);
  expect(s.hasImg, '전제 — 그림이 들어갔다').toBe(true);
  expect(s.n, '자식이 남았다').toBe(1);
  const top = await page.evaluate(({ id, kid }) => { const k = document.getElementById(kid); const r = k.getBoundingClientRect(); const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!el && k.contains(el); }, { id, kid: kids[0] });
  expect(top, '자식이 그림보다 위(그 자리 맨 위 요소가 자식)').toBe(true);
  expect(errs).toEqual([]);
});

test('K4 ★그림 위치 조절 동안 자식은 숨고, 끝내면(Esc) 돌아오며 원이 다시 자른다 · 그림 제거해도 자식이 남는다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  await page.evaluate(async ({ id, b64 }) => {
    const b = document.getElementById(id); const bin = Uint8Array.from(atob(b64), ch => ch.charCodeAt(0));
    window.loadImageToCircle(b, new File([bin], 'h.png', { type: 'image/png' }));
    await new Promise(r => setTimeout(r, 500));
  }, { id, b64: HALF });
  expect((await kidState(page, id)).hasImg, '전제 — 그림').toBe(true);
  expect(await selectCircle(page, id)).toBe(true);
  const pos = await centreOf(page, '#icb-pos-btn');
  await page.mouse.click(pos[0], pos[1]); await page.waitForTimeout(300);
  const editing = await kidState(page, id);
  expect(editing.vis, '편집 중 자식 숨김').toBe('hidden');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  const after = await kidState(page, id);
  expect(after.vis, '끝내면 다시 보인다').toBe('visible');
  expect(after.overflow, '원이 다시 자른다').toBe('hidden');
  expect(await selectCircle(page, id)).toBe(true);
  const rm = await centreOf(page, '#icb-remove-btn');
  await page.mouse.click(rm[0], rm[1]); await page.waitForTimeout(300);
  const s = await kidState(page, id);
  expect(s.hasImg).toBe(false);
  expect(s.n, '그림 제거 뒤에도 자식이 남는다').toBe(1);
  expect(errs).toEqual([]);
});

test('K5 ★직렬화 → 다시 심기 → rebindAll 뒤 자식이 살아 있고, 자식 클릭 = 자식 선택 · 원 빈 곳 클릭 = 서클 선택', async ({ page }) => {
  const { errs, id } = await setup(page);
  const kids = await addViaPanel(page, id, 'body');
  await setKidText(page, id, 'ROUND');
  await page.evaluate(() => { const s = document.getElementById('sC'); const h = s.outerHTML; s.remove(); document.getElementById('canvas').insertAdjacentHTML('beforeend', h); window.rebindAll(); window.deselectAll(); });
  await page.waitForTimeout(300);
  expect((await kidState(page, id)).n, '다시 심은 뒤 자식 하나').toBe(1);
  const tb = await page.evaluate((id) => document.querySelector(`#${id} .icb-children .text-block`)?.id, id);
  const r = await waitStableRect(page, `#${tb}`);
  await page.mouse.click(r.cx, r.cy); await page.waitForTimeout(300);
  const a = await page.evaluate(({ id, tb }) => ({ kidSel: document.getElementById(tb).classList.contains('selected'), circSel: document.getElementById(id).classList.contains('selected'), icbPanel: !!document.getElementById('icb-size-number') }), { id, tb });
  expect(a, '자식 클릭 = 자식 선택(서클 아님)').toEqual({ kidSel: true, circSel: false, icbPanel: false });
  await page.evaluate(() => window.deselectAll());
  expect(await selectCircle(page, id), '원 빈 곳 클릭 = 서클 패널').toBe(true);
  expect(errs).toEqual([]);
  expect(kids.length).toBe(1);
});

test('K6 ★넣기 ⌘Z 한 번 = 넣기 전 바이트 · ⇧⌘Z = 다시', async ({ page }) => {
  const { errs, id } = await setup(page);
  const before = await page.evaluate((id) => document.getElementById(id).outerHTML, id);
  await addViaPanel(page, id, 'body');
  await page.evaluate(() => { window.deselectAll(); document.activeElement?.blur?.(); });
  await page.mouse.click(5, 500);
  await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
  const undone = await page.evaluate((id) => document.getElementById(id)?.outerHTML.replace(/ class="icon-circle-block selected"/, ' class="icon-circle-block"'), id);
  expect(undone, '⌘Z = 넣기 전 그대로').toBe(before);
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(400);
  expect((await kidState(page, id)).n, '⇧⌘Z = 자식 돌아옴').toBe(1);
  expect(errs).toEqual([]);
});

test('K7 서클 복제(⌘D) — 자식까지 복제되고 문서 안 id 가 겹치지 않는다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  expect(await selectCircle(page, id)).toBe(true);
  await page.keyboard.press('Meta+d'); await page.waitForTimeout(400);
  const r = await page.evaluate(() => {
    const ids = [...document.querySelectorAll('#canvas [id]')].map(e => e.id);
    const dup = ids.filter((x, i) => ids.indexOf(x) !== i);
    return { circles: document.querySelectorAll('#canvas .icon-circle-block').length, boxes: document.querySelectorAll('#canvas .icb-children > *').length, dup };
  });
  expect(r.circles, '전제 — 복제됐다').toBe(2);
  expect(r.boxes, '자식도 둘').toBe(2);
  expect(r.dup, '겹치는 id').toEqual([]);
  expect(errs).toEqual([]);
});

test('K8 HTML 내보내기 — 자식 글자가 원(.icb-circle) 안에 실린다 · 편집 표시 없음', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  await setKidText(page, id, 'EXPORT-KID-Q');
  await page.evaluate(() => window.deselectAll());
  const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.evaluate(() => window.exportHTMLFile())]);
  const fs = require('fs');
  const html = fs.readFileSync(await dl.path(), 'utf8');
  expect(html.split('EXPORT-KID-Q').length - 1, '글자 한 번').toBe(1);
  const inCircle = await page.evaluate((h) => { const d = new DOMParser().parseFromString(h, 'text/html'); const t = [...d.querySelectorAll('.icb-circle .icb-children *')].some(e => e.textContent.includes('EXPORT-KID-Q')); return t; }, html);
  expect(inCircle, '원 안 그릇에 있다').toBe(true);
  expect(html.includes('.icb-children'), '그릇 CSS 규칙이 실렸다').toBe(true);
  expect(errs).toEqual([]);
});

test('K9 마지막 자식을 지우면 그릇이 자리를 안 먹는다(없거나 :empty → display none) · 자리표시가 돌아온다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  const tb = await page.evaluate((id) => document.querySelector(`#${id} .icb-children .text-block`)?.id, id);
  const r = await waitStableRect(page, `#${tb}`);
  await page.mouse.click(r.cx, r.cy); await page.waitForTimeout(250);
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  const s = await page.evaluate((id) => { const box = document.querySelector(`#${id} .icb-children`); const ph = document.querySelector(`#${id} .icb-placeholder`);
    return { circle: !!document.getElementById(id), kids: box ? box.childElementCount : 0, boxShown: box ? getComputedStyle(box).display !== 'none' : false, ph: ph ? getComputedStyle(ph).display : null }; }, id);
  expect(s.circle, '전제 — 서클은 남는다(자식만 지움)').toBe(true);
  expect(s.kids).toBe(0);
  expect(s.boxShown, '빈 그릇이 자리를 먹지 않는다').toBe(false);
  expect(s.ph, '자리표시 돌아옴').not.toBe('none');
  expect(errs).toEqual([]);
});

test('K10 간격 정리 시퀀스 — 자식이 들어가도 서클 줄의 자식 타입은 [icon-circle] 그대로(원 안 글자를 «줄의 글자»로 안 센다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const before = await page.evaluate(() => JSON.stringify(window.readSpacingSequence('sC').sections[0].items.find(i => i.id === 'rowC')));
  await addViaPanel(page, id, 'body');
  const after = await page.evaluate(() => JSON.stringify(window.readSpacingSequence('sC').sections[0].items.find(i => i.id === 'rowC')));
  expect(before, '전제 — 서클 줄이 시퀀스에 있다').toContain('icon-circle');
  expect(after).toBe(before);
  expect(errs).toEqual([]);
});

test('K11 ★빈 원 패널 = 「채움 끔」(E48 — 지금은 E8E8E8 100% 로 거짓) · 켜면 색이 칠해지고 끄면 transparent + 체커', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await selectCircle(page, id)).toBe(true);
  const t0 = await page.evaluate(() => { const t = document.getElementById('icb-fill-toggle'); return t ? { checked: t.checked } : null; });
  expect(t0, '패널에 채움 토글(#icb-fill-toggle)').not.toBeNull();
  expect(t0.checked, '빈 원 = 채움 끔').toBe(false);
  const tg = await page.evaluate(() => { const l = document.getElementById('icb-fill-toggle').closest('label'); l.scrollIntoView({ block: 'center' }); const r = l.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(tg[0], tg[1]); await page.waitForTimeout(250);
  const on = await page.evaluate((id) => ({ ds: document.getElementById(id).dataset.bgColor, bgc: getComputedStyle(document.querySelector(`#${id} .icb-circle`)).backgroundColor }), id);
  expect(on.bgc, '켜면 색이 칠해진다').toBe('rgb(232, 232, 232)');
  await page.mouse.click(tg[0], tg[1]); await page.waitForTimeout(250);
  const off = await page.evaluate((id) => document.getElementById(id).dataset.bgColor, id);
  expect(off, '끔 = 기존 값 transparent').toBe('transparent');
  await page.evaluate(() => window.deselectAll()); await park(page);
  const s = await kidState(page, id);
  const px = await pixelAt(page, s.circ.cx, s.circ.cy);
  expect(isChecker(px), `끔 = 체커 — 찍힌 ${px}`).toBe(true);
  expect(errs).toEqual([]);
});

test('K11b 색을 고른 원은 «채움 켬»으로 보이고, 끈 뒤 다시 켜면 그 색으로 돌아온다(데이터 키 추가 없음)', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await selectCircle(page, id)).toBe(true);
  const hx = await centreOf(page, '#icb-bg-hex');
  await page.mouse.click(hx[0], hx[1]); await page.keyboard.press('Meta+a'); await page.keyboard.type('3366FF'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  await page.evaluate(() => window.deselectAll());
  expect(await selectCircle(page, id)).toBe(true);
  expect(await page.evaluate(() => document.getElementById('icb-fill-toggle')?.checked), '색 있는 원 = 켬').toBe(true);
  const tg = await page.evaluate(() => { const l = document.getElementById('icb-fill-toggle').closest('label'); const r = l.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.click(tg[0], tg[1]); await page.waitForTimeout(200);
  await page.mouse.click(tg[0], tg[1]); await page.waitForTimeout(200);
  const ds = await page.evaluate((id) => ({ ...document.getElementById(id).dataset }), id);
  expect(ds.bgColor).toBe('#3366ff');
  expect(Object.keys(ds).sort(), '새 dataset 키 없음').toEqual(['bgColor', 'border', 'size', 'type'].sort());
  expect(errs).toEqual([]);
});

const figmaJson = (page) => page.evaluate(async () => {
  const ps = { bg: '#ffffff', padX: 0 };
  const { state } = await import('/js/globals.js');
  state.pages = [{ canvas: document.getElementById('canvas').innerHTML, pageSettings: ps }]; state.pageSettings = ps;
  return JSON.stringify(window.buildFigmaExportJSON(null));
});
test('K12 ★Figma JSON — 자식이 있으면 서클을 자유 프레임으로 싸서 원 + 자식 글자(정확히 한 번)를 낸다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  await setKidText(page, id, 'FIG-KID-Z');
  const flat = await figmaJson(page);
  expect(flat.split('FIG-KID-Z').length - 1, '자식 글자 한 번').toBe(1);
  const j = JSON.parse(flat);
  const find = (o, f) => { if (!o || typeof o !== 'object') return null; if (f(o)) return o; for (const v of Object.values(o)) { const r = find(v, f); if (r) return r; } return null; };
  const fr = find(j, o => o.type === 'frame' && Array.isArray(o.children) && o.children.some(c => c.block && c.block.type === 'circle'));
  expect(fr, '원을 품은 자유 프레임').toBeTruthy();
  expect(fr.free).toBe(true);
  expect(JSON.stringify(fr)).toContain('FIG-KID-Z');
  expect(errs).toEqual([]);
});

test('K12b 지키기 — 자식 없는 서클의 Figma 블럭은 그대로 type:circle(프레임으로 안 싼다)', async ({ page }) => {
  const { errs, id } = await setup(page);
  const flat = await figmaJson(page);
  const j = JSON.parse(flat);
  const find = (o, f) => { if (!o || typeof o !== 'object') return null; if (f(o)) return o; for (const v of Object.values(o)) { const r = find(v, f); if (r) return r; } return null; };
  const c = find(j, o => o.type === 'circle' && o.id === id);
  expect(c, '전제 — 서클이 나갔다').toBeTruthy();
  expect(find(j, o => o.type === 'frame' && Array.isArray(o.children) && o.children.some(k => k.block && k.block.id === id)), '프레임으로 안 쌌다').toBeNull();
  expect(errs).toEqual([]);
});

test('K13 레이어 패널 — 자식이 있는 서클은 펼쳐진다(쉐브론 + 그 밑에 자식 줄)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  await page.evaluate(() => window.buildLayerPanel?.());
  await page.waitForTimeout(200);
  const r = await page.evaluate((id) => {
    const circ = document.getElementById(id); const kid = circ.querySelector('.icb-children > *');
    const items = [...document.querySelectorAll('.layer-item')];
    const kidItem = items.find(it => it._dragTarget === kid || (it._dragTarget && kid.contains(it._dragTarget)) || (it._dragTarget && it._dragTarget.contains && it._dragTarget.contains(kid) && it._dragTarget !== circ && !it._dragTarget.contains(circ)));
    if (!kidItem) return { kidItem: false };
    const grp = kidItem.closest('.layer-row-children')?.parentElement;
    const head = grp?.querySelector(':scope > .layer-row-header .layer-item');
    return { kidItem: true, chevron: !!grp?.querySelector(':scope > .layer-row-header .layer-chevron'), headIsCircle: !!head && (head._dragTarget === circ || (head._dragTarget && head._dragTarget.contains(circ))) };
  }, id);
  expect(r).toEqual({ kidItem: true, chevron: true, headIsCircle: true });
  expect(errs).toEqual([]);
});

test('K14 ★B1 — 서클 패널에 오버레이 토글이 있고, 누르면 띄우고(data-overlay-block) 다시 누르면 원래 줄로 돌아온다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  expect(await selectCircle(page, id)).toBe(true);
  const b = await centreOf(page, '#icb-float-toggle');
  expect(b, '패널에 오버레이 토글(#icb-float-toggle)').not.toBeNull();
  await page.mouse.click(b[0], b[1]); await page.waitForTimeout(300);
  const on = await page.evaluate((id) => ({ fl: document.getElementById(id).dataset.overlayBlock, kids: document.querySelectorAll(`#${id} .icb-children > *`).length }), id);
  expect(on, '띄움 + 자식 그대로').toEqual({ fl: 'true', kids: 1 });
  const b2 = await centreOf(page, '#icb-float-toggle');
  await page.mouse.click(b2[0], b2[1]); await page.waitForTimeout(300);
  const off = await page.evaluate((id) => ({ fl: document.getElementById(id).dataset.overlayBlock || null, parent: document.getElementById(id).parentElement?.id }), id);
  expect(off).toEqual({ fl: null, parent: 'rowC' });
  expect(errs).toEqual([]);
});

test('K15 ★자식이 있어도 패널 손잡이가 먹는다 — 지름(그릇 비례) · 회전(자식도 같이) · 배경 hex(자식 밖 원 픽셀) · 투명도 50 은 배경만(자식 글자색 그대로)', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  await setKidText(page, id, 'K');
  expect(await selectCircle(page, id)).toBe(true);
  const typeInto = async (sel, v, commit = 'Tab') => { const c = await centreOf(page, sel); await page.mouse.click(c[0], c[1]); await page.keyboard.press('Meta+a'); await page.keyboard.type(v); await page.keyboard.press(commit); await page.waitForTimeout(250); };
  await typeInto('#icb-size-number', '320');
  let s = await kidState(page, id);
  expect(Math.abs(s.kbox.w - s.circ.w / Math.SQRT2), '그릇이 지름 따라 준다').toBeLessThanOrEqual(2);
  await typeInto('#icb-rot-number', '30');
  const rot = await page.evaluate((id) => { const k = document.querySelector(`#${id} .icb-children > *`); const m = new DOMMatrix(getComputedStyle(document.getElementById(id)).transform); return { blockRot: Math.round(Math.atan2(m.b, m.a) * 180 / Math.PI), kidInside: !!k.closest(`#${id}`) }; }, id);
  expect(rot).toEqual({ blockRot: 30, kidInside: true });
  await typeInto('#icb-rot-number', '0');
  const colBefore = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .icb-children .text-block [class^="tb-"]`) || document.querySelector(`#${id} .icb-children .text-block`)).color, id);
  await typeInto('#icb-bg-hex', 'FF0000', 'Enter');
  await typeInto('#icb-bg-alpha', '50', 'Enter');
  await page.evaluate(() => window.deselectAll()); await park(page);
  s = await kidState(page, id);
  const px = await pixelAt(page, s.circ.cx, s.circ.top + s.circ.h * 0.12);
  expect(near(px, [255, 127, 127]), `자식 밖 원 = 반투명 빨강 — 찍힌 ${px}`).toBe(true);
  const colAfter = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .icb-children .text-block [class^="tb-"]`) || document.querySelector(`#${id} .icb-children .text-block`)).color, id);
  expect(colAfter, '투명도 ㉠ = 배경만 — 자식 글자색 그대로').toBe(colBefore);
  const op = await page.evaluate((id) => ({ blk: getComputedStyle(document.getElementById(id)).opacity, box: getComputedStyle(document.querySelector(`#${id} .icb-children`)).opacity }), id);
  expect(op).toEqual({ blk: '1', box: '1' });
  expect(errs).toEqual([]);
});

test('K15b 지키기 — 자식 없는 원: 배경 hex 가 칠해진다(측정표 13가지 중 대표 · A1 수정 유지)', async ({ page }) => {
  const { errs, id } = await setup(page);
  expect(await selectCircle(page, id)).toBe(true);
  const hx = await centreOf(page, '#icb-bg-hex');
  await page.mouse.click(hx[0], hx[1]); await page.keyboard.press('Meta+a'); await page.keyboard.type('00AA00'); await page.keyboard.press('Enter'); await page.waitForTimeout(250);
  await page.evaluate(() => window.deselectAll()); await park(page);
  const s = await kidState(page, id);
  expect(near(await pixelAt(page, s.circ.cx, s.circ.cy), [0, 170, 0])).toBe(true);
  expect(errs).toEqual([]);
});

test('K16 MCP 읽기(getCanvasState) — 원 안 자식이 보이고 부모 사슬이 서클에 닿는다', async ({ page }) => {
  const { errs, id } = await setup(page);
  await addViaPanel(page, id, 'body');
  await setKidText(page, id, 'MCP-KID');
  const st = await page.evaluate(() => JSON.stringify(window.getCanvasState('sC')));
  const j = JSON.parse(st);
  const blocks = (j.sections ? j.sections[0].blocks : j.blocks) || [];
  const kid = blocks.find(b => b.type === 'text' || (b.text || '').includes('MCP-KID'));
  expect(kid, '자식 글자 블럭이 읽힌다').toBeTruthy();
  const byId = Object.fromEntries(blocks.map(b => [b.blockId, b]));
  let p = kid.parentId, hops = 0; while (p && p !== id && hops < 5) { p = byId[p]?.parentId; hops++; }
  expect(p, '부모 사슬 끝 = 서클').toBe(id);
  expect(errs).toEqual([]);
});
