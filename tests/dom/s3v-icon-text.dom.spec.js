/* s3v-icon-text.dom.spec.js — S3V Icon Text «세로»(아이콘 위 · 글 아래) (2026-10-04 태양 lane-s3-vertical)
 *
 * ⛔Icon Text 는 렌더러가 없다 — 저장된 DOM 이 정본이다. 모양 = 블럭 속성(data-itb-dir)·인라인 style·CSS.
 * 결정(지디 2026-10-04): 키 data-itb-dir="v"(없으면 가로 = 옛 모양) · 세로 기본 정렬 = 가운데(지디 시안 ㉮ — 2026-10-04).
 *
 * S1 바이트 동일 — 손대지 않은(=가로) Icon Text 여러 꼴의 outerHTML 이 핀 6119145c 골든과 같다(+ 저장→불러오기 왕복).
 * S2 세로 그림 · S3 패널 「방향」 · ⒤⒥⒦⒧ 정렬 «다 듣나»·왕복·⌘Z · S6 실어 나르기 · S7 디자인 JSON · S8 E57 지우기.
 * 골든 뜨기: S3V_GOLDEN=update 로 «핀 판(C0 커밋)»에서 한 번. ⛔기능 코드가 든 판에서 다시 뜨지 마라.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/s3v-icon-text.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sI"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;
const GOLD = path.join(__dirname, 'fixtures', 's3v-icon-text-golden.json');
const UPDATE = process.env.S3V_GOLDEN === 'update';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAAABJRU5ErkJggg==';
/* ★C0 에는 기능이 없다 — 기능을 재는 시험은 «빨강이 정상»(test.fail). 기능 커밋에서 이 줄을 false 로 바꾼다(걷지 않으면 «예상 밖 통과»로 빨강). */
const FEATURE = false;

async function fresh(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sI'));
  }, SEC);
  return errs;
}
async function addItb(page, text = '본문 내용') {
  const id = await page.evaluate((t) => {
    window.selectSection(document.getElementById('sI'));
    const before = new Set([...document.querySelectorAll('.icon-text-block')].map(b => b.id));
    window.addIconTextBlock();
    const b = [...document.querySelectorAll('.icon-text-block')].find(x => !before.has(x.id));
    window.updateIconTextBlock(b.id, { text: t });
    return b.id;
  }, text);
  return id;
}
async function click(page, sel) { const r = await waitStableRect(page, sel); await page.mouse.click(r.cx, r.cy); await page.waitForTimeout(120); }
async function selectItb(page, id) { await page.evaluate(() => window.deselectAll?.()); await click(page, `#${id} .itb-text`); }
async function alignBtn(page, a) { await page.locator(`#panel-right .prop-align-btn[data-align="${a}"]`).first().click(); await page.waitForTimeout(120); }
async function dirBtn(page, d) { await expect(page.locator('#itb-dir-group'), '패널에 「방향」 단추 묶음').toHaveCount(1, { timeout: 2000 }); await page.locator(`#itb-dir-group .prop-align-btn[data-dir="${d}"]`).click(); await page.waitForTimeout(150); }
/** 아이콘·글의 화면 자리 — 블럭 기준 상대 px(줌 영향 → 비교는 같은 판 안에서만) */
const geo = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), i = b.querySelector('.itb-icon'), t = b.querySelector('.itb-text');
  const B = b.getBoundingClientRect(), I = i.getBoundingClientRect(), T = t.getBoundingClientRect();
  const r = (x) => Math.round(x * 10) / 10;
  return { icon: { l: r(I.left - B.left), r: r(B.right - I.right), t: r(I.top - B.top), b: r(I.bottom - B.top), cx: r((I.left + I.right) / 2 - B.left) },
           text: { l: r(T.left - B.left), r: r(B.right - T.right), t: r(T.top - B.top), cx: r((T.left + T.right) / 2 - B.left) },
           bw: r(B.width), dir: b.dataset.itbDir || null, style: b.getAttribute('style') || '', tstyle: t.getAttribute('style') || '' };
}, id);
/** 보이는 «글자 줄» 정렬 — 줄 상자(Range)의 가로 위치로 잰다(textAlign 값만 보면 «안 먹힘»을 못 잡는다) */
const inkX = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id), t = b.querySelector('.itb-text'); const B = b.getBoundingClientRect();
  const rg = document.createRange(); rg.selectNodeContents(t); const R = rg.getBoundingClientRect();
  return { l: Math.round(R.left - B.left), r: Math.round(B.right - R.right) };
}, id);

/** 속성 «순서»만 다른 것을 같게 본다 — 불러오기(rebind)·⌘Z 복원이 .itb-text 의 contenteditable 을 다시 달아 «맨 뒤로» 옮긴다
 *  (핀 6119145c 실측 C0 1차: 값은 같고 순서만 다름). 골든 비교(S1 핀 대조)는 이걸 쓰지 «않는다» — 날 바이트 그대로. */
const CANON = (html) => { const t = document.createElement('template'); t.innerHTML = html;
  const fix = (el) => { const a = [...el.attributes].map(x => [x.name, x.value]).sort((p, q) => p[0] < q[0] ? -1 : p[0] > q[0] ? 1 : 0);
    a.forEach(([n]) => el.removeAttribute(n)); a.forEach(([n, v]) => el.setAttribute(n, v)); [...el.children].forEach(fix); };
  [...t.content.children].forEach(fix); return t.innerHTML; };

// ─────────── S1 바이트 동일 ───────────
test('S1 손대지 않은(=가로) Icon Text 여러 꼴의 outerHTML 이 핀(6119145c) 골든과 같다 · 저장→불러오기 왕복도 같다', async ({ page }) => {
  const errs = await fresh(page);
  const ids = [];
  ids.push(await addItb(page, '기본'));
  ids.push(await addItb(page, '그림'));
  await page.evaluate(({ id, png }) => window.updateIconTextBlock(id, { imgSrc: png }), { id: ids[1], png: PNG });
  ids.push(await addItb(page, '가운데 정렬'));
  await selectItb(page, ids[2]); await alignBtn(page, 'center');
  ids.push(await addItb(page, '오른쪽 정렬'));
  await selectItb(page, ids[3]); await alignBtn(page, 'right');
  ids.push(await addItb(page, '간격 32'));
  await selectItb(page, ids[4]);
  await page.locator('#itb-gap-number').fill('32'); await page.locator('#itb-gap-number').dispatchEvent('input');
  await page.evaluate(() => window.deselectAll?.());
  const snap = () => page.evaluate((ids) => ids.map((id, n) => document.getElementById(id).outerHTML.split(id).join(`ITB${n}`)
    .replace(/ data-layer-[a-z-]+="[^"]*"/g, '')), ids);
  const live = await snap();
  expect(live.every(h => !h.includes('data-itb-dir')), '가로(기본)에는 방향 속성이 «없다»').toBe(true);
  await page.evaluate(() => { const html = window.getSerializedCanvas(); const c = document.getElementById('canvas'); c.innerHTML = window.sanitizeCanvasHtml(html); window.rebindAll(); window.deselectAll?.(); });
  const reloaded = await snap();
  const canon = (arr) => page.evaluate(({ arr, f }) => { const C = eval(f); return arr.map(C); }, { arr, f: CANON.toString() });
  expect(await canon(reloaded), '저장→불러오기 왕복 뒤 같다(속성 순서 무시)').toEqual(await canon(live));
  if (UPDATE) { fs.mkdirSync(path.dirname(GOLD), { recursive: true }); fs.writeFileSync(GOLD, JSON.stringify(live, null, 2) + '\n'); return; }
  expect(fs.existsSync(GOLD), '골든이 있다').toBe(true);
  expect(live).toEqual(JSON.parse(fs.readFileSync(GOLD, 'utf8')));
  expect(errs).toEqual([]);
});

// ─────────── S2·S3 세로 그림 · 패널 「방향」 ───────────
test('S2·S3 패널 「방향 ▸ 세로」 = data-itb-dir="v" · 아이콘 위 · 글 아래 · 가운데(기본) · 단추는 기존 클래스', async ({ page }) => {
  if (FEATURE) test.fail(true, 'C0: 세로 기능 없음 — 기능 커밋에서 FEATURE=false');
  await fresh(page);
  const id = await addItb(page, '세로 본문');
  await selectItb(page, id);
  const cls = await page.evaluate(() => { const g = document.getElementById('itb-dir-group'); return g ? { g: g.className, b: [...g.querySelectorAll('button')].map(b => b.className + '|' + b.dataset.dir + '|' + !!b.querySelector('svg')) } : null; });
  expect(cls, '「방향」 단추 = .prop-align-group > .prop-align-btn[data-dir] + SVG(구분선과 같은 꼴)').toEqual({ g: 'prop-align-group', b: ['prop-align-btn active|horizontal|true', 'prop-align-btn|vertical|true'] });
  await dirBtn(page, 'vertical');
  const g = await geo(page, id);
  expect(g.dir, '속성').toBe('v');
  expect(g.icon.b, `아이콘 아래쪽(${g.icon.b}) ≤ 글 위쪽(${g.text.t}) — 위아래로 쌓였다`).toBeLessThanOrEqual(g.text.t + 0.5);
  expect(Math.abs(g.icon.cx - g.bw / 2), `기본 = 가운데: 아이콘 중심 ${g.icon.cx} vs 블럭 중심 ${g.bw / 2}`).toBeLessThanOrEqual(1);
  const ink = await inkX(page, id);
  expect(Math.abs(ink.l - ink.r), `글자도 가운데: 좌 ${ink.l} 우 ${ink.r}`).toBeLessThanOrEqual(2);
  expect(await page.locator('#itb-dir-group .prop-align-btn[data-dir="vertical"]').getAttribute('class'), 'active 가 옮겨졌다').toContain('active');
});

// ─────────── ⒤⒦ 가로 정렬 → 세로 → 가로 ───────────
for (const a of ['left', 'center', 'right']) {
  test(`⒤⒦ 가로 «${a}» 로 맞춘 뒤 세로로 바꿔도 «${a}» · 다시 가로로 오면 원래 «${a}»`, async ({ page }) => {
    if (FEATURE) test.fail(true, 'C0: 세로 기능 없음');
    await fresh(page);
    const id = await addItb(page, '정렬 왕복');
    await selectItb(page, id); await alignBtn(page, a);
    const h0 = await geo(page, id), k0 = await inkX(page, id);
    await dirBtn(page, 'vertical');
    const v = await geo(page, id), kv = await inkX(page, id);
    const side = (gg, kk) => a === 'left' ? [gg.icon.l, kk.l] : a === 'right' ? [gg.icon.r, kk.r] : [Math.abs(gg.icon.cx - gg.bw / 2), Math.abs((kk.l - kk.r) / 2)];
    const [vi, vt] = side(v, kv);
    expect(vi, `세로 «${a}»: 아이콘 ${a === 'center' ? '중심 어긋남' : a + ' 여백'}=${vi}`).toBeLessThanOrEqual(1);
    expect(vt, `세로 «${a}»: 글자 ${a === 'center' ? '좌우차/2' : a + ' 여백'}=${vt}`).toBeLessThanOrEqual(2);
    await dirBtn(page, 'horizontal');
    const h1 = await geo(page, id), k1 = await inkX(page, id);
    expect({ i: h1.icon, t: h1.text, k: k1 }, '가로로 되돌리면 처음 가로와 같은 자리').toEqual({ i: h0.icon, t: h0.text, k: k0 });
    expect(h1.dir, '가로 = 속성 없음').toBeNull();
    expect(h1.style.includes('align-items') || h1.tstyle.includes('text-align'), `옛(세로) 키가 남지 않는다: ${h1.style} / ${h1.tstyle}`).toBe(false);
  });
}

// ─────────── ⒥ 세로에서 정렬 단추 셋이 «다 듣는가» ───────────
test('⒥ 세로에서 왼→가운데→오른→왼 — 단추마다 아이콘·글자 자리가 «실제로» 바뀐다(눌렀는데 안 변하는 것 0)', async ({ page }) => {
  if (FEATURE) test.fail(true, 'C0: 세로 기능 없음');
  await fresh(page);
  const id = await addItb(page, '세로 정렬');
  await selectItb(page, id); await dirBtn(page, 'vertical');
  let prev = await geo(page, id), prevK = await inkX(page, id);
  for (const a of ['left', 'center', 'right', 'left']) {
    await alignBtn(page, a);
    const g = await geo(page, id), k = await inkX(page, id);
    expect(g.icon.l !== prev.icon.l, `«${a}»: 아이콘이 움직였다 (${prev.icon.l} → ${g.icon.l})`).toBe(true);
    expect(k.l !== prevK.l, `«${a}»: 글자가 움직였다 (${prevK.l} → ${k.l})`).toBe(true);
    expect(await page.locator(`#panel-right .prop-align-btn[data-align="${a}"]`).first().getAttribute('class'), `«${a}» active`).toContain('active');
    prev = g; prevK = k;
  }
});

// ─────────── ⒧ ⌘Z 한 걸음 ───────────
test('⒧ 방향 바꾸기·세로 정렬 — 각각 ⌘Z 한 번에 한 걸음, ⌘⇧Z 로 다시', async ({ page }) => {
  if (FEATURE) test.fail(true, 'C0: 세로 기능 없음');
  await fresh(page);
  const id = await addItb(page, '되돌리기');
  const snap = () => page.evaluate(({ id, f }) => eval(f)(document.getElementById(id).outerHTML), { id, f: CANON.toString() });
  const steps = [['세로로', () => dirBtn(page, 'vertical')], ['오른쪽', () => alignBtn(page, 'right')], ['왼쪽', () => alignBtn(page, 'left')], ['가로로', () => dirBtn(page, 'horizontal')]];
  for (const [name, act] of steps) {
    await selectItb(page, id);
    const s0 = await snap();
    await act();
    const s1 = await snap();
    expect(s1, `전제: «${name}» 가 바꿨다`).not.toBe(s0);
    await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
    expect(await snap(), `«${name}» ⌘Z 한 번 = 바로 앞`).toBe(s0);
    await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(250);
    expect(await snap(), `«${name}» ⌘⇧Z = 다시 뒤`).toBe(s1);
  }
});

// ─────────── S5 간격 ───────────
test('S5 세로 간격 = 아이콘 아래–글 위 사이 = gap px (기본 16 · 32 로 바꾸면 32)', async ({ page }) => {
  if (FEATURE) test.fail(true, 'C0: 세로 기능 없음');
  await fresh(page);
  const id = await addItb(page, '간격');
  await selectItb(page, id); await dirBtn(page, 'vertical');
  const z = await page.evaluate(() => { const m = getComputedStyle(document.getElementById('canvas-scaler') || document.body).transform; const k = m && m !== 'none' ? parseFloat(m.split('(')[1]) : 1; return k || 1; });
  const g0 = await geo(page, id);
  expect(Math.round((g0.text.t - g0.icon.b) / z), `기본 간격 px(줌 ${z}) = ${(g0.text.t - g0.icon.b) / z}`).toBe(16);
  await page.locator('#itb-gap-number').fill('32'); await page.locator('#itb-gap-number').dispatchEvent('input'); await page.waitForTimeout(120);
  const g1 = await geo(page, id);
  expect(Math.round((g1.text.t - g1.icon.b) / z), `간격 32 px = ${(g1.text.t - g1.icon.b) / z}`).toBe(32);
});

// ─────────── S6 실어 나르기 ───────────
test('S6 세로 블럭이 저장→불러오기 · ⌘C/⌘V · 섹션 HTML(템플릿·변형 경로) · HTML 내보내기 CSS 에서 «세로로» 남는다', async ({ page }) => {
  if (FEATURE) test.fail(true, 'C0: 세로 기능 없음(규칙이 없어 아이콘이 위로 안 간다)');
  await fresh(page);
  const id = await addItb(page, '실어 나르기');
  await selectItb(page, id); await dirBtn(page, 'vertical');
  const isV = (sel) => page.evaluate((sel) => { const b = document.querySelector(sel); if (!b) return 'missing'; const I = b.querySelector('.itb-icon').getBoundingClientRect(), T = b.querySelector('.itb-text').getBoundingClientRect(); return b.dataset.itbDir === 'v' && I.bottom <= T.top + 0.5; }, sel);
  // 저장 → 불러오기
  await page.evaluate(() => { const html = window.getSerializedCanvas(); const c = document.getElementById('canvas'); c.innerHTML = window.sanitizeCanvasHtml(html); window.rebindAll(); });
  expect(await isV(`#${id}`), '저장→불러오기').toBe(true);
  // ⌘C/⌘V
  await selectItb(page, id);
  const n0 = await page.evaluate(() => document.querySelectorAll('.icon-text-block').length);
  await page.keyboard.press('Meta+c'); await page.keyboard.press('Meta+v'); await page.waitForTimeout(300);
  expect(await page.evaluate(() => document.querySelectorAll('.icon-text-block').length), '붙여넣기 = 하나 늘었다').toBe(n0 + 1);
  expect(await page.evaluate(() => [...document.querySelectorAll('.icon-text-block')].every(b => b.dataset.itbDir === 'v')), '사본도 세로').toBe(true);
  // 섹션 HTML 되살리기(템플릿·변형이 쓰는 «섹션 문자열» 꼴)
  const ok = await page.evaluate(() => { const sec = document.getElementById('sI'); const html = sec.outerHTML; const t = document.createElement('div'); t.innerHTML = html; const s2 = t.firstElementChild; s2.id = 'sI2'; s2.querySelectorAll('[id]').forEach(e => { if (e.id !== 'sI2') e.id = e.id + '_c'; }); document.getElementById('canvas').appendChild(s2); window.rebindAll?.(); return document.querySelectorAll('#sI2 .icon-text-block').length; });
  expect(ok, '섹션 사본에 Icon Text 가 있다').toBeGreaterThan(0);
  expect(await isV('#sI2 .icon-text-block'), '섹션 사본도 세로').toBe(true);
  // HTML 내보내기 CSS 에 세로 규칙이 실린다
  const css = await page.evaluate(async () => { const m = await import('/js/io/export-css-collect.js'); return m.collectCanvasCss(document.getElementById('canvas')); });
  expect(/\.icon-text-block\[data-itb-dir="?v"?\]/.test(css), 'HTML 내보내기 CSS 에 세로 규칙').toBe(true);
});

// ─────────── S7 디자인 JSON ───────────
async function designJson(page) {
  return page.evaluate(async () => {
    let blob = null; const o1 = URL.createObjectURL; const o2 = HTMLAnchorElement.prototype.click;
    URL.createObjectURL = (b) => { blob = b; return 'blob:s3v'; }; HTMLAnchorElement.prototype.click = function () {};
    try { window.exportDesignJSON(); } finally { URL.createObjectURL = o1; HTMLAnchorElement.prototype.click = o2; }
    return blob ? JSON.parse(await blob.text()) : null;
  });
}
const itbNodes = (j) => { const out = []; const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.type === 'icon-text') out.push(x); Object.values(x).forEach(walk); } }; walk(j); return out; };
/* ★핀 6119145c 실측(C0 1차): 디자인 JSON 은 .row > .col > 블럭 만 돈다 — Icon Text 는 .row > .icon-text-block(.col 없음)이라
 *  «노드 자체가 안 나간다»(가로·세로 모두, 기존 공백). S3V 는 이걸 고치지 «않는다»(범위 밖) ⇒ 시험은 «방향이 JSON 을 안 바꾼다»만 잰다. */
const noIds = (j) => JSON.parse(JSON.stringify(j, (k, v) => (k === 'id' || k === 'exportedAt' || k === 'createdAt') ? undefined : v));
test('S7a 디자인 JSON — Icon Text 노드는 핀 6119145c 에서도 0 (기존 공백 · 기록)', async ({ page }) => {
  await fresh(page);
  await addItb(page, '가로 JSON');
  const j = await designJson(page);
  expect(j, '전제: 내보내기가 돌았다').not.toBeNull();
  const n = itbNodes(j);
  test.info().annotations.push({ type: 'design-json', description: `icon-text 노드=${n.length}` });
  expect(n.length, '핀과 같다 = 0(기존 공백)').toBe(0);
});
test('S7b 디자인 JSON — 세로로 바꿔도 내보낸 JSON 이 가로와 같다(id·시각 빼고)', async ({ page }) => {
  if (FEATURE) test.fail(true, 'C0: 세로 기능 없음');
  await fresh(page);
  const id = await addItb(page, '세로 JSON');
  const h = noIds(await designJson(page));
  await selectItb(page, id); await dirBtn(page, 'vertical');
  expect(await page.evaluate((id) => document.getElementById(id).dataset.itbDir, id), '전제: 세로가 됐다').toBe('v');
  expect(noIds(await designJson(page))).toEqual(h);
});

// ─────────── S9 MCP 렌더러 길 · 읽기(canvas-state) ───────────
test('S9 updateIconTextBlock{direction} = 패널과 같은 한 곳 · 잘못된 값 거절 · getCanvasState 요약에 세로만 direction', async ({ page }) => {
  await fresh(page);
  const id = await addItb(page, 'MCP 세로');
  const r = await page.evaluate((id) => {
    const sum = () => { let hit = null; const walk = (x) => { if (Array.isArray(x)) x.forEach(walk); else if (x && typeof x === 'object') { if (x.blockId === id) hit = x; Object.values(x).forEach(walk); } }; walk(window.getCanvasState()); return hit && hit.summary; };
    const h = sum();
    const bad = window.updateIconTextBlock(id, { direction: 'diagonal' });
    const badDir = document.getElementById(id).dataset.itbDir || null;
    const ok = window.updateIconTextBlock(id, { direction: 'vertical' });
    return { h, bad, badDir, ok, dir: document.getElementById(id).dataset.itbDir || null, v: sum() };
  }, id);
  expect(r.h && 'direction' in r.h, `가로 요약엔 direction 키가 없다(옛 답 그대로) — ${JSON.stringify(r.h)}`).toBe(false);
  expect(r.bad.ok, `잘못된 값 거절 — ${JSON.stringify(r.bad)}`).toBe(false);
  expect(r.badDir, '거절 뒤 그대로 가로').toBeNull();
  expect(r.ok.ok && r.ok.applied.direction, JSON.stringify(r.ok)).toBe('vertical');
  expect(r.ok.before.direction).toBe('horizontal');
  expect(r.dir).toBe('v');
  expect(r.v && r.v.direction, `세로 요약 — ${JSON.stringify(r.v)}`).toBe('vertical');
});

// ─────────── S8 E57 지우기 ───────────
for (const dir of ['horizontal', 'vertical']) {
  test(`S8 E57 ${dir} — ⒜ 블럭 고름 Delete = 블럭만(섹션·옆 블럭 남음) ⒝ 편집 중 ⌫ = 글자만 ⒞ 아이콘 칸 클릭 뒤 Delete ⒟ ⌘Z 한 걸음 ⒠ 선택 로그`, async ({ page }) => {
    if (FEATURE && dir === 'vertical') test.fail(true, 'C0: 세로 기능 없음');
    await fresh(page);
    const id = await addItb(page, 'ABC');
    await page.evaluate(() => { window.selectSection(document.getElementById('sI')); window.addTextBlock('body'); });
    if (dir === 'vertical') { await selectItb(page, id); await dirBtn(page, 'vertical'); }
    const note = async (lbl) => { const s = await page.evaluate(() => ({ sel: [...document.querySelectorAll('#canvas .selected')].map(e => e.id || e.className.split(' ')[0]), editing: !!document.querySelector('#canvas [contenteditable="true"]') })); test.info().annotations.push({ type: 'selection', description: `${lbl}: ${JSON.stringify(s)}` }); return s; };
    const snap = () => page.evaluate(({ id, f }) => { const e = document.getElementById(id); return e ? eval(f)(e.outerHTML) : null; }, { id, f: CANON.toString() });
    // ⒝ 편집 중 ⌫
    const rr = await waitStableRect(page, `#${id} .itb-text`); await page.mouse.dblclick(rr.cx, rr.cy); await page.waitForTimeout(150);
    expect((await note('⒝ 전')).editing, '전제: 편집 중').toBe(true);
    await page.evaluate(() => { const el = document.activeElement; const s = window.getSelection(); s.selectAllChildren(el); s.collapseToEnd(); });
    await page.keyboard.press('Backspace');
    await page.evaluate(() => document.activeElement?.blur?.()); await page.waitForTimeout(150);
    expect(await page.evaluate((id) => document.querySelector(`#${id} .itb-text`)?.textContent, id), '⒝ 글자 한 자만').toBe('AB');
    // ⒜ 블럭 고름 Delete
    await selectItb(page, id);
    expect((await note('⒜ 전')).sel, '전제: 블럭이 골라졌다').toContain(id);
    const s0 = await snap();
    await page.keyboard.press('Delete'); await page.waitForTimeout(200);
    expect(await snap(), '⒜ 블럭이 지워졌다').toBeNull();
    expect(await page.evaluate(() => !!document.getElementById('sI') && document.querySelectorAll('#sI .text-block').length), '⒜ 섹션·옆 블럭 남음').toBeTruthy();
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(250);
    expect(await snap(), '⒟ ⌘Z 한 걸음 = 블럭 복원').toBe(s0);
    // ⒞ 아이콘 칸 클릭 뒤 Delete — 파일 고르기 창은 막는다(입력 click 을 무력화)
    await page.evaluate(() => { window.deselectAll(); HTMLInputElement.prototype.click = function () {}; });
    await click(page, `#${id} .itb-icon`);
    const sc = await note('⒞ 전');
    await page.keyboard.press('Delete'); await page.waitForTimeout(200);
    const after = await snap();
    test.info().annotations.push({ type: 'icon-click-delete', description: `selected=${JSON.stringify(sc.sel)} blockAfter=${after ? 'kept' : 'deleted'}` });
    expect(await page.evaluate(() => !!document.getElementById('sI')), '⒞ 섹션은 남는다').toBe(true);
  });
}
