/* text-range-glow.dom.spec.js — 네온글로우를 «선택 영역»에만 (1012t1E2 · 2026-10-12)
 *
 * ★원문 — 「이스트에그로써 네온글로우 효과가 하나의 텍스트 블럭 전체에만 들어가는데 하이라이트 효과처럼
 *   특정 영역선택후 입력도 가능하게 해줘」
 * ★꼴 = 형광펜과 같다: 서식 줄 글로우 단추(#txt-glow-btn) · 선택 있으면 그 글자만 span.tb-glow · 없으면 전체(토글)
 *   · 값 = .text-block 인라인 --tb-glow-color / --tb-glow-k · 최근 칩 = kind 'glow'.
 * ★재는 것
 *   G1 범위 — BBB 만 빛난다(밖 AAA·CCC 는 text-shadow none)        G2 무선택 — 전체 한 span · 다시 누르면 0(토글)
 *   G3 값 — 색·세기 칸이 인라인 변수와 «그려진» text-shadow 를 바꾼다  G4 ⌘Z — 한 걸음에 span 이 사라진다
 *   G5 저장 왕복 — span·변수가 다시 연 뒤에도 산다                    G6 바이트 동일 — showGlow 안 준 호출엔 글로우 0 글자
 *   G7 최근 칩 — A 에서 쌓고 B 에 입힌다                               G8 그라데이션 글자 — 단추가 막히고 이유가 뜬다
 *   G9 공존 — Effects 블럭 글로우(E3)와 범위 글로우가 span 안에서 «둘 다» 그려진다(--tb-glow-base)
 * ⛔고정 대기 0 — waitForFunction / expect.poll(dom-fixed-wait-census). 전제는 칸 안에서 단언한다.
 * ⚠️2026-10-12 작성 — ★«검사 정지 창»이라 한 번도 안 돌렸다. 첫 실행이 곧 첫 측정이다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/text-range-glow.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff;padding:80px 0 0 80px"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const MAGENTA = 'rgb(255, 0, 255)';   // css .text-block --tb-glow-color 기본 #ff00ff

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForFunction(() => !!document.getElementById('inA'));
  return errs;
}
const insertText = (page, content = 'AAA BBB CCC') => page.evaluate((t) => {
  const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
  document.getElementById('sA').classList.add('selected');
  window.addTextBlock('body', { content: t });
  const fresh = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
  return fresh.length ? fresh[fresh.length - 1].id : null;
}, content);
const openPanel = async (page, id) => {
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-glow-btn', { state: 'attached' });
};
const ceSel = (id) => `#${id} [contenteditable]`;

/** 진짜 마우스·키로 «끝에서 back 글자 앞부터 ⇧← len 번» 고른다 — 'AAA BBB CCC' 에서 (4,3) = BBB. */
async function selectTail(page, id, back, len, want) {
  const hs = ceSel(id);
  await page.locator(hs).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, hs);
  await page.mouse.dblclick(r.left + r.width - 4, r.top + r.height / 2);
  await page.waitForFunction((s) => { const h = document.querySelector(s); const a = document.activeElement; return !!h && !!a && (a === h || h.contains(a)); }, hs);
  await page.keyboard.press('End');
  for (let i = 0; i < back; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < len; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForFunction((w) => getSelection().toString() === w, want);
  /* ★전제 — 앱의 «저장 선택»(단추가 읽는 그것)이 섰다. 아니면 단추가 «전체» 갈래로 가서 G1 이 엉뚱한 것을 잰다. */
  await page.waitForFunction(([s, w]) => {
    const g = window.__textSelection?.getSavedTextSelection?.(); const h = document.querySelector(s);
    return !!g && !!h && (g.host === h || h.contains(g.host)) && g.range.toString() === w;
  }, [hs, want]);
}
async function clickGlow(page, id, wantSpans) {
  const b = await page.locator('#txt-glow-btn').first().boundingBox();
  if (!b) throw new Error('no box: #txt-glow-btn');
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForFunction(([i, n]) => document.querySelectorAll(`#${i} span.tb-glow`).length === n, [id, wantSpans]);
}
const typeField = async (page, sel, v) => { await page.fill(sel, String(v)); await page.press(sel, 'Enter'); };

/** 한 요소의 computed text-shadow 를 겹으로(괄호 안 쉼표는 안 쪼갠다). */
const layersOf = (page, sel) => page.evaluate((s) => {
  const e = document.querySelector(s); if (!e) return null;
  const ts = getComputedStyle(e).textShadow;
  if (!ts || ts === 'none') return [];
  const out = []; let d = 0, cur = '';
  for (const ch of ts) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim());
  return out;
}, sel);
const glowTexts = (page, id) => page.evaluate((i) => [...document.querySelectorAll(`#${i} span.tb-glow`)].map(s => s.textContent), id);

/* ══ G1 범위 ══ */
test('G1 ★범위 — BBB 를 고르고 단추 → span.tb-glow 1개 = "BBB" · 밖(글자칸 자신)은 text-shadow none', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  /* ★음성대조(전) — 누르기 전엔 span 0 · 글자칸 그림자 없음 */
  expect(await glowTexts(page, id), '★전제 — 이미 글로우 span 이 있다').toEqual([]);
  expect(await layersOf(page, ceSel(id)), '★전제 — 글자칸에 이미 그림자가 있다(밖 none 단언이 공짜가 된다)').toEqual([]);

  await selectTail(page, id, 4, 3, 'BBB');
  await clickGlow(page, id, 1);
  expect(await glowTexts(page, id), '★선택한 글자만 둘러야 한다').toEqual(['BBB']);
  const inL = await layersOf(page, `#${id} span.tb-glow`);
  expect(inL.length, `★span 이 3겹이 아니다: ${JSON.stringify(inL)}`).toBe(3);
  expect(inL.every(l => l.includes(MAGENTA)), `★기본색이 아니다: ${JSON.stringify(inL)}`).toBe(true);
  expect(await layersOf(page, ceSel(id)), '★선택 밖(AAA·CCC = 글자칸 직속 글자)에 빛이 샜다').toEqual([]);
  expect(await page.evaluate((s) => document.querySelector(s).innerText, ceSel(id)), '★글자가 바뀌었다').toBe('AAA BBB CCC');
  expect(await page.evaluate(() => document.getElementById('txt-glow-btn').classList.contains('active'))).toBe(true);
  expect(errs).toEqual([]);
});

/* ══ G2 무선택 = 전체 · 토글 ══ */
test('G2 ★무선택 — 전체 한 span · 다시 누르면 0 · 칸이 같이 여닫힌다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  expect(await page.evaluate(() => !!window.__textSelection?.getSavedTextSelection?.()), '★전제 — 저장 선택이 있다(«전체» 갈래를 안 잰다)').toBe(false);
  const rows = () => page.evaluate(() => ['txt-glow-color-row', 'txt-glow-k-row'].map(k => { const e = document.getElementById(k); return e ? getComputedStyle(e).display : null; }));
  expect(await rows(), '★전제 — 꺼진 블럭에 칸이 떠 있다').toEqual(['none', 'none']);
  await clickGlow(page, id, 1);
  expect(await glowTexts(page, id)).toEqual(['AAA BBB CCC']);
  expect(await rows()).toEqual(['flex', 'flex']);
  await clickGlow(page, id, 0);
  expect(await layersOf(page, ceSel(id))).toEqual([]);
  expect(await rows()).toEqual(['none', 'none']);
  const nodes = await page.evaluate((s) => { const w = document.createTreeWalker(document.querySelector(s), NodeFilter.SHOW_TEXT); let n = 0; while (w.nextNode()) n++; return n; }, ceSel(id));
  expect(nodes, '★걷은 뒤 텍스트 토막이 남았다(normalize 안 돎)').toBe(1);
  expect(errs).toEqual([]);
});

/* ══ G3 값 → 그림 ══ */
test('G3 ★값 — 색 hex·세기 칸이 인라인 변수와 «그려진» text-shadow 를 바꾼다 (안 고친 블럭은 인라인 0)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  const other = await insertText(page, 'ZZZ');
  await openPanel(page, id);
  await clickGlow(page, id, 1);
  await typeField(page, '#txt-glow-color-hex', '22AA55');
  await page.waitForFunction((i) => document.getElementById(i).style.getPropertyValue('--tb-glow-color').trim() !== '', id);
  const L = await layersOf(page, `#${id} span.tb-glow`);
  expect(L.every(l => l.includes('rgb(34, 170, 85)')), `★고른 색이 안 그려진다: ${JSON.stringify(L)}`).toBe(true);
  await typeField(page, '#txt-glow-k-num', 40);
  await page.waitForFunction((i) => document.getElementById(i).style.getPropertyValue('--tb-glow-k').trim() === '0.4', id);
  const L2 = await layersOf(page, `#${id} span.tb-glow`);
  /* computed 꼴 = "rgb(…) 0px 0px 11.2px" — 색을 걷고 남은 px 셋 중 마지막이 blur */
  const blurs = L2.map(l => { const px = l.replace(/rgba?\([^)]*\)/, '').match(/-?[\d.]+px/g) || []; return parseFloat(px[px.length - 1]); });
  expect(Math.max(...blurs), `★세기 40 인데 가장 큰 겹이 28×0.4=11.2px 가 아니다: ${JSON.stringify(L2)}`).toBeCloseTo(11.2, 1);
  /* ★음성대조 — 안 고친 블럭엔 인라인이 없다(css 기본값이 산다) */
  expect(await page.evaluate((i) => [document.getElementById(i).style.getPropertyValue('--tb-glow-color'), document.getElementById(i).style.getPropertyValue('--tb-glow-k')], other)).toEqual(['', '']);
  expect(errs).toEqual([]);
});

/* ══ G4 ⌘Z ══ */
test('G4 ★⌘Z — 범위 글로우 한 번이 한 걸음에 사라진다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await selectTail(page, id, 4, 3, 'BBB');
  await clickGlow(page, id, 1);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((i) => document.querySelectorAll(`#${i} span.tb-glow`).length, id), '★⌘Z 한 번에 span 이 안 걷혔다').toBe(0);
  expect(await page.evaluate((i) => document.querySelector(`#${i} [contenteditable]`)?.innerText, id), '★⌘Z 가 글자까지 되돌렸다(한 걸음이 둘을 먹었다)').toBe('AAA BBB CCC');
  expect(errs).toEqual([]);
});

/* ══ G5 저장 왕복 ══ */
test('G5 ★저장 왕복 — serializeProject → 재기동 → applyProjectData 뒤 span·변수 유지', async ({ page }) => {
  await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await selectTail(page, id, 4, 3, 'BBB');
  await clickGlow(page, id, 1);
  await typeField(page, '#txt-glow-color-hex', '22AA55');
  await page.waitForFunction((i) => document.getElementById(i).style.getPropertyValue('--tb-glow-color').trim() !== '', id);
  const snap = await page.evaluate(() => window.serializeProject());
  expect(/tb-glow/.test(snap), '★저장본에 span 이 안 실렸다').toBe(true);
  expect(/--tb-glow-color/.test(snap), '★저장본에 색이 안 실렸다').toBe(true);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForFunction((i) => !!document.getElementById(i), id);
  expect(await glowTexts(page, id), '★다시 연 뒤 범위가 사라졌다').toEqual(['BBB']);
  const L = await layersOf(page, `#${id} span.tb-glow`);
  expect(L.every(l => l.includes('rgb(34, 170, 85)')), `★다시 연 뒤 색이 사라졌다: ${JSON.stringify(L)}`).toBe(true);
});

/* ══ G6 바이트 동일 ══ */
test('G6 ★바이트 동일 — showGlow 안 준 Typography 산출엔 «glow» 0 글자 · 준 산출엔 단추가 있다(양성대조)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async () => {
    const m = await import(new URL('js/props/_typo-section.js', location.href).href);
    const base = { p: 'mdl-typo', size: 32 };
    const off = m.buildTypographySectionHtml(base);
    const offExplicit = m.buildTypographySectionHtml({ ...base, showGlow: false, showGlowOpts: false });
    const on = m.buildTypographySectionHtml({ ...base, showGlow: true, showGlowOpts: true, isGlow: true });
    return { offHasGlow: /glow/.test(off), same: off === offExplicit, onBtn: /id="mdl-typo-glow-btn"/.test(on), onRow: /id="mdl-typo-glow-k-row"/.test(on) };
  });
  expect(r.offHasGlow, '★기본 호출(모달·그리드·챗)에 글로우가 샜다').toBe(false);
  expect(r.same).toBe(true);
  expect([r.onBtn, r.onRow], '★양성대조 — 켜도 안 나온다(위 음성이 공짜다)').toEqual([true, true]);
  expect(errs).toEqual([]);
});

/* ══ G7 최근 칩 ══ */
test('G7 ★최근 칩 — A 에서 색을 확정하면 glow 큐에 쌓이고, B 에서 칩을 누르면 B 전체에 같은 색으로 입는다', async ({ page }) => {
  const errs = await setup(page);
  const a = await insertText(page);
  const b = await insertText(page, 'XYZ');
  await openPanel(page, a);
  await clickGlow(page, a, 1);
  await typeField(page, '#txt-glow-color-hex', '22AA55');
  await expect.poll(() => page.evaluate(() => (window.DesignSystem.getTextStyleHistory('glow') || []).length), '★glow 큐에 안 쌓였다').toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => window.DesignSystem.getTextStyleHistory('glow')[0].v['--tb-glow-color'])).toMatch(/#22aa55|rgb\(34, 170, 85\)/i);
  await openPanel(page, b);
  expect(await glowTexts(page, b), '★전제 — B 에 이미 글로우가 있다').toEqual([]);
  await page.waitForSelector('#txt-glow-recent-row .ts-chip', { state: 'visible' });
  const cb = await page.locator('#txt-glow-recent-row .ts-chip').first().boundingBox();
  await page.mouse.click(cb.x + cb.width / 2, cb.y + cb.height / 2);
  await page.waitForFunction((i) => document.querySelectorAll(`#${i} span.tb-glow`).length === 1, b);
  expect(await glowTexts(page, b)).toEqual(['XYZ']);
  const L = await layersOf(page, `#${b} span.tb-glow`);
  expect(L.every(l => l.includes('rgb(34, 170, 85)')), `★칩 색이 B 에 안 입혀졌다: ${JSON.stringify(L)}`).toBe(true);
  expect(errs).toEqual([]);
});

/* ══ G8 그라데이션 글자 ══ */
test('G8 ★그라데이션 글자 — 글로우 단추가 막히고 title 에 이유 · 눌러도 span 0 (단색 블럭은 열림 = 양성대조)', async ({ page }) => {
  const errs = await setup(page);
  const plain = await insertText(page, 'PPP');
  const id = await insertText(page);
  await openPanel(page, plain);
  expect(await page.evaluate(() => document.getElementById('txt-glow-btn').disabled), '★양성대조 — 단색 블럭에서도 막혀 있다').toBe(false);
  const ok = await page.evaluate((i) => window.applyTextGradient(document.querySelector(`#${i} [contenteditable]`),
    { css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)', type: 'linear', angle: 90, stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] }, { commit: true }), id);
  expect(ok, '★전제 — 그라데이션이 안 걸렸다').toBeTruthy();
  await openPanel(page, id);
  const st = await page.evaluate(() => { const g = document.getElementById('txt-glow-btn'); return { d: g.disabled, t: g.title }; });
  expect(st.d, '★그라데이션 글자인데 단추가 열려 있다(빛이 글자를 덮는다 — 계획 P2)').toBe(true);
  expect(st.t).toContain('그라데이션');
  await page.evaluate(() => document.getElementById('txt-glow-btn').click());
  await expect.poll(() => page.evaluate((i) => document.querySelectorAll(`#${i} span.tb-glow`).length, id)).toBe(0);
  expect(errs).toEqual([]);
});

/* ══ G9 블럭 글로우(E3)와 공존 ══ */
test('G9 ★공존 — Effects 블럭 글로우(초록) + 범위 글로우(자홍): span 안은 «둘 다»(6겹) · 밖은 초록 3겹 · 블럭 글로우 ✕ 면 span 은 자홍 3겹', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await page.evaluate((i) => window.setFxGlow(document.getElementById(i), { state: 'on', blur: 20, color: '#00ff00' }), id);
  const GREEN = 'rgb(0, 255, 0)';
  expect((await layersOf(page, ceSel(id))).length, '★전제 — 블럭 글로우 3겹이 안 섰다').toBe(3);
  await selectTail(page, id, 4, 3, 'BBB');
  await clickGlow(page, id, 1);
  const inL = await layersOf(page, `#${id} span.tb-glow`);
  expect(inL.length, `★span 안 겹 수: ${JSON.stringify(inL)}`).toBe(6);
  expect(inL.filter(l => l.includes(MAGENTA)).length, '범위 겹 3').toBe(3);
  expect(inL.filter(l => l.includes(GREEN)).length, '★span 안에서 블럭 글로우가 사라졌다(text-shadow 상속 덮어쓰기)').toBe(3);
  expect((await layersOf(page, ceSel(id))).every(l => l.includes(GREEN)), '밖은 블럭 글로우만').toBe(true);
  /* ★음성대조 — --tb-glow-base 를 걷으면 span 안 초록이 사라진다 ⇒ 위 «둘 다»는 그 변수가 지고 있다 */
  const noBase = await page.evaluate((s) => { const ce = document.querySelector(s); const v = ce.style.getPropertyValue('--tb-glow-base');
    ce.style.removeProperty('--tb-glow-base'); const ts = getComputedStyle(ce.querySelector('span.tb-glow')).textShadow; ce.style.setProperty('--tb-glow-base', v); return { had: !!v.trim(), ts }; }, ceSel(id));
  expect(noBase.had, '★전제 — 글자칸에 --tb-glow-base 가 없다').toBe(true);
  expect(noBase.ts.includes(GREEN), '★변수를 걷었는데도 초록이 있다 — 이 칸이 변수를 안 잰다').toBe(false);
  /* 블럭 글로우 ✕ → 합성 문이 base 를 따라 고친다 */
  await page.evaluate((i) => window.setFxGlow(document.getElementById(i), { state: 'none' }), id);
  await expect.poll(async () => (await layersOf(page, `#${id} span.tb-glow`)).length, '★블럭 글로우를 지웠는데 span 이 옛 base 를 들고 있다').toBe(3);
  expect((await layersOf(page, `#${id} span.tb-glow`)).every(l => l.includes(MAGENTA))).toBe(true);
  expect(errs).toEqual([]);
});
