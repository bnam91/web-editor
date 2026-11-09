/* df-key-create — T307(현빈 261109): 맨 D = 그리드 블록 · 맨 F = 프레임 블록 (T 와 같은 가드 · 같은 넣는 자리).
 * 팀장 결정: Q1 F F = 형제 · Q2 프레임 오브젝트 선택 → 다음 형제 / 들어간 상태 → 안(고른 자식 다음, 없으면 끝) · Q3 하드코딩 · Q4 그리드 칸 골라 D → 그 그리드 다음 형제.
 * 하네스 = bootApp(앱 통째) · 키는 진짜 keyboard.press · 고르기는 진짜 클릭/더블클릭(t-key-repeat-after-frame 꼴) · 대기는 rAF·expect.poll. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const FR_SEL = '.frame-block:not([data-text-frame])';
const KIND = { d: '.grid-block', f: FR_SEL };
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const TXT = (id, t) => `<div class="text-block" id="${id}" data-type="body"><div class="tb-body" contenteditable="false">${t}</div></div>`;
const SCENE = `<div class="section-block" id="sH" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inH" style="padding-left: 32px; padding-right: 32px;">
  <div class="gap-block" id="g0" data-type="gap" style="height:30px"></div>
  <div class="frame-block" id="topTF" data-text-frame="true" data-bg="transparent" style="background:transparent;width:100%;box-sizing:border-box;">${TXT('topT', '본문')}</div>
  <div class="row" id="rowF" data-layout="stack"><div class="frame-block" id="FR" data-free-layout="true" style="position:relative;width:600px;height:240px;">
    <div class="text-block" id="kid" data-type="heading" style="position:absolute;left:20px;top:20px;width:260px;"><div class="tb-h2" contenteditable="false">자식</div></div></div></div>
  <div class="row" id="rowL" data-layout="stack"><div class="frame-block" id="FL" data-full-width="true" style="width:600px;min-height:200px;">
    <div class="frame-block" id="kTF1" data-text-frame="true" data-bg="transparent" style="background:transparent;width:100%;box-sizing:border-box;">${TXT('k1', '첫째')}</div>
    <div class="frame-block" id="kTF2" data-text-frame="true" data-bg="transparent" style="background:transparent;width:100%;box-sizing:border-box;">${TXT('k2', '둘째')}</div></div></div>
  <div class="row" id="rowP" data-layout="stack"><div class="frame-block" id="P" data-free-layout="true" style="position:relative;width:600px;height:300px;">
    <div class="frame-block" id="FN" data-free-layout="true" style="position:absolute;left:20px;top:20px;width:400px;height:160px;">
      <div class="text-block" id="kidN" data-type="heading" style="position:absolute;left:10px;top:10px;width:200px;"><div class="tb-h2" contenteditable="false">손자</div></div></div></div></div>
  <div class="row" id="rowE" data-layout="stack"><div class="frame-block" id="EF" data-free-layout="true" style="position:relative;width:600px;height:200px;"></div></div>
  <div class="gap-block" id="gAfter" data-type="gap" style="height:200px"></div></div></div>`;

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.applyZoom?.(100);
    // 그리드 하나 — 앱의 넣기 길로(섹션 골라 gAfter 앞)
    window.deselectAll(); window.selectSection(document.getElementById('sH')); window._activeFrame = null; window.addGridBlock();
    const g = document.querySelector('#inH > .row .grid-block'); g.id = g.id || 'G';
    window.deselectAll(); window._activeFrame = null; window.clearHistory?.();
  }, SCENE);
  await raf(page);
  return errs;
}
const ids = (page, sel) => page.evaluate((sel) => [...document.querySelectorAll('#canvas ' + sel)].map((e) => e.id), sel);
/* 새 것 하나 → { host: 그것을 품은 그릇 id 중 host 후보의 직계 단위, prev: 그 단위의 앞 형제 id, last } */
const placeOf = (page, sel, before, host) => page.evaluate(([sel, before, host]) => {
  const n = [...document.querySelectorAll('#canvas ' + sel)].filter((e) => !before.includes(e.id));
  if (n.length !== 1) return { n: n.length };
  const H = document.getElementById(host); let u = n[0];
  while (u && u.parentElement !== H) u = u.parentElement;
  if (!u) return { n: 1, inHost: false, parent: n[0].parentElement?.id };
  return { n: 1, inHost: true, prev: u.previousElementSibling?.id || null, last: u === H.lastElementChild, depth1: !n[0].parentElement.closest('.frame-block:not([data-text-frame])') };
}, [sel, before, host]);
async function press(page, k, sel, before) {
  await page.keyboard.press(k);
  await expect.poll(() => page.evaluate(([sel, n]) => document.querySelectorAll('#canvas ' + sel).length - n, [sel, before.length]), `${k}: 하나 생김`).toBe(1);
}
/* id 를 host 직계 단위로(rebindAll 이 글을 text-frame 으로 감싼다) */
const unitIn = (page, id, host) => page.evaluate(([id, host]) => { let u = document.getElementById(id); while (u && u.parentElement?.id !== host) u = u.parentElement; return u?.id; }, [id, host]);
/* ★누르기 전에 대상이 멈출 때까지 — 부하 때 스크롤 직후 옛 좌표로 눌러 세 번 다 빗나가던 것(평가 2차 ×15 에서 4/30) */
const center = async (page, id) => { await waitStableRect(page, '#' + id); return centerNow(page, id); };
const centerNow = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
const scrollTo = (page, id) => page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
const emptyPoint = (page, id) => page.evaluate((id) => { const f = document.getElementById(id); const r = f.getBoundingClientRect();
  for (let y = Math.round(r.bottom - 6); y > r.top; y -= 4) for (const x of [Math.round(r.right - 10), Math.round(r.left + 10)]) if (document.elementFromPoint(x, y) === f) return [x, y]; return null; }, id);
/* 고르기만 재시도(부하 때 첫 누름이 빗나감) — 단언은 각 시험에 그대로 */
async function until(page, ok, act) { for (let i = 0; i < 3 && !(await ok()); i++) { await act(); await raf(page); } expect(await ok(), '[전제] 고르기').toBe(true); }

const CTX = {
  section: { host: 'inH', prev: null, async go(page) { await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; window.selectSection(document.getElementById('sH')); }); } },
  frameSelected: { host: 'inH', prev: 'rowF', async go(page) { await scrollTo(page, 'FR');
    await until(page, () => page.evaluate(() => document.getElementById('FR').classList.contains('selected') && !document.querySelector('#FR .selected')),
      async () => { const p = await emptyPoint(page, 'FR'); await page.mouse.click(...p); }); } },
  enteredChildFree: { host: 'FR', prev: 'kid', async go(page) { await scrollTo(page, 'FR');
    await until(page, () => page.evaluate(() => document.getElementById('kid').classList.contains('selected')),
      async () => { const p = await center(page, 'kid'); if (await page.evaluate(() => window._enteredFrame?.id === 'FR')) await page.mouse.click(...p); else await page.mouse.dblclick(...p); }); } },
  enteredChildFlow: { host: 'FL', prev: 'kTF1', async go(page) { await scrollTo(page, 'FL');
    await until(page, () => page.evaluate(() => document.getElementById('k1').classList.contains('selected')),
      async () => { const p = await center(page, 'k1'); if (await page.evaluate(() => window._enteredFrame?.id === 'FL')) await page.mouse.click(...p); else await page.mouse.dblclick(...p); }); } },
  enteredNoChild: { host: 'FL', last: true, async go(page) { await scrollTo(page, 'FL');
    await until(page, () => page.evaluate(() => window._enteredFrame?.id === 'FL' && !document.querySelector('#FL .selected')),
      async () => { const p = await emptyPoint(page, 'FL'); await page.mouse.dblclick(...p); }); } },
  depth2: { host: 'P', prev: 'FN', async go(page) { await scrollTo(page, 'P');
    /* [전제] FN = 오브젝트 선택(FN 자체는 «안 들어감»). 재시도 때 P 에 이미 들어가 있으면 한 번 클릭 — 또 더블클릭하면 FN 에 들어가 버린다(×3 에서 2/3 실측) */
    await until(page, () => page.evaluate(() => document.getElementById('FN').classList.contains('selected') && !document.querySelector('#FN .selected') && window._enteredFrame?.id !== 'FN'),
      async () => { const p = await page.evaluate(() => { const r = document.getElementById('FN').getBoundingClientRect(); return [r.left + 6, r.top + 6]; });
        if (await page.evaluate(() => window._enteredFrame?.id === 'P')) await page.mouse.click(...p); else await page.mouse.dblclick(...p); }); } },   // P 에 들어가며 FN 을 오브젝트로(t-key-repeat 꼴)
};
for (const k of ['d', 'f']) for (const [name, c] of Object.entries(CTX)) {
  test(`${k.toUpperCase()} · ${name} → ${c.host} 안${c.prev ? ', ' + c.prev + ' 바로 다음' : c.last ? ', 끝' : ''}`, async ({ page }) => {
    const errs = await scene(page);
    await c.go(page);
    const before = await ids(page, KIND[k]);
    await press(page, k, KIND[k], before);
    const r = await placeOf(page, KIND[k], before, c.host);
    expect(r.inHost, `그릇 ${c.host} ${JSON.stringify(r)}`).toBe(true);
    if (c.prev) expect(r.prev, JSON.stringify(r)).toBe(await unitIn(page, c.prev, c.host));
    if (c.last) expect(r.last, JSON.stringify(r)).toBe(true);
    if (c.host === 'inH') expect(r.depth1, '섹션 직속(중첩 아님)').toBe(true);
    expect(errs, errs.join(' | ')).toEqual([]);
  });
}
for (const k of ['d', 'f']) test(`${k.toUpperCase()} · 선택 없음 → 블록 0`, async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { window.deselectAll(); window._activeFrame = null; });
  const n0 = (await ids(page, KIND[k])).length;
  await page.keyboard.press(k); await raf(page); await raf(page);
  expect((await ids(page, KIND[k])).length).toBe(n0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('Q4 — 그리드 칸 골라 D → 그 그리드 다음 형제(섹션 직속)', async ({ page }) => {
  const errs = await scene(page);
  const gid = await page.evaluate(() => document.querySelector('#inH .grid-block').id);
  await scrollTo(page, gid);
  await until(page, () => page.evaluate((g) => document.getElementById(g).classList.contains('selected'), gid),
    async () => { await waitStableRect(page, '#' + gid); const p = await page.evaluate((g) => { const c = document.getElementById(g).querySelector('[class*="grd-cell"]') || document.getElementById(g); const r = c.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, gid); await page.mouse.click(...p); });
  const before = await ids(page, '.grid-block');
  await press(page, 'd', '.grid-block', before);
  const gUnit = await page.evaluate((g) => { let u = document.getElementById(g); while (u.parentElement.id !== 'inH') u = u.parentElement; return u.id; }, gid);
  const r = await placeOf(page, '.grid-block', before, 'inH');
  expect(r, JSON.stringify(r)).toMatchObject({ inHost: true, prev: gUnit });
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('Q1 — F F = 형제 둘(중첩 아님)', async ({ page }) => {
  const errs = await scene(page);
  await CTX.section.go(page);
  const b0 = await ids(page, FR_SEL);
  await press(page, 'f', FR_SEL, b0);
  const a = (await ids(page, FR_SEL)).find((x) => !b0.includes(x));
  const b1 = await ids(page, FR_SEL);
  await press(page, 'f', FR_SEL, b1);
  const r = await placeOf(page, FR_SEL, b1, 'inH');
  expect(r, JSON.stringify(r)).toMatchObject({ inHost: true, prev: a });
  expect(await page.evaluate((a) => document.getElementById(a).children.length, a), '첫 프레임 안은 빈 채').toBe(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
/* 새 프레임 직후 T·D — 현빈 t3-01 원문 · 지디 ㉠(261109, ⒜ 걷음): 새 프레임 «바로 다음 형제»(섹션 직속). F 직후 F 는 위 Q1. */
for (const k of ['t', 'd']) test(`F 직후 ${k.toUpperCase()} → 새 프레임 다음 형제`, async ({ page }) => {
  const errs = await scene(page);
  await CTX.section.go(page);
  const b0 = await ids(page, FR_SEL);
  await press(page, 'f', FR_SEL, b0);
  const a = (await ids(page, FR_SEL)).find((x) => !b0.includes(x));
  const sel = k === 't' ? '.text-block' : '.grid-block';
  const b1 = await ids(page, sel);
  await press(page, k, sel, b1);
  const r = await placeOf(page, sel, b1, 'inH');
  expect(r, JSON.stringify(r)).toMatchObject({ inHost: true, prev: a });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 빈 프레임은 «더블클릭으로 들어가야» 안에 넣는다(㉠) — 들어간 뒤 T·D·F·툴바 「Frame 추가」 = 그 빈 프레임 안 */
const FRAME_BTN = { sel: FR_SEL, async go(page) { const b = await page.evaluate(() => { const e = [...document.querySelectorAll('button[title]')].find((x) => x.title.includes('Frame 추가') && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }); await page.mouse.click(...b); } };
for (const k of ['t', 'd', 'f', 'Frame 추가']) test(`빈 프레임 더블클릭 진입 → ${k} = 그 빈 프레임 안`, async ({ page }) => {
  const errs = await scene(page);
  await scrollTo(page, 'EF');
  await until(page, () => page.evaluate(() => window._enteredFrame?.id === 'EF'), async () => { const p = await center(page, 'EF'); await page.mouse.dblclick(...p); });
  const sel = k === 't' ? '.text-block' : k === 'd' ? '.grid-block' : FR_SEL;
  const before = await ids(page, sel);
  if (k === 'Frame 추가') { await FRAME_BTN.go(page); await expect.poll(async () => (await ids(page, sel)).length - before.length).toBe(1); }
  else await press(page, k, sel, before);
  const r = await placeOf(page, sel, before, 'EF');
  expect(r, JSON.stringify(r)).toMatchObject({ n: 1, inHost: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ⌘V 도 같은 규칙(㉠) — 앱 안 클립보드만: OS 쓰기 문(electronAPI.clipboardWriteText)을 페이지 안 가짜로 갈아 끼운다(cmd-a-frame-scope 꼴) */
for (const how of ['oneClick', 'entered']) test(`⌘V · 빈 프레임 ${how === 'oneClick' ? '한 번 클릭 → 다음 형제' : '더블클릭 진입 → 안'}`, async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const fake = async () => ({ ok: true }); if (window.electronAPI) { try { window.electronAPI.clipboardWriteText = fake; } catch (_) {} if (window.electronAPI.clipboardWriteText !== fake) window.electronAPI = new Proxy(window.electronAPI, { get: (t, k) => k === 'clipboardWriteText' ? fake : t[k] }); } });
  expect(await page.evaluate(() => !window.electronAPI || String(window.electronAPI.clipboardWriteText).includes('ok: true')), '[전제] OS 클립보드 쓰기 = 가짜').toBe(true);
  await scrollTo(page, 'topT');
  await until(page, () => page.evaluate(() => document.getElementById('topT').classList.contains('selected')), async () => { const p = await center(page, 'topT'); await page.mouse.click(...p); });
  await page.keyboard.press('Meta+c');
  await scrollTo(page, 'EF');
  if (how === 'oneClick') await until(page, () => page.evaluate(() => document.getElementById('EF').classList.contains('selected') && window._enteredFrame?.id !== 'EF'), async () => { const p = await center(page, 'EF'); await page.mouse.click(...p); });
  else await until(page, () => page.evaluate(() => window._enteredFrame?.id === 'EF'), async () => { const p = await center(page, 'EF'); await page.mouse.dblclick(...p); });
  const before = await ids(page, '.text-block');
  await page.keyboard.press('Meta+v');
  await expect.poll(async () => (await ids(page, '.text-block')).length - before.length, '⌘V 하나').toBe(1);
  const r = await placeOf(page, '.text-block', before, how === 'oneClick' ? 'inH' : 'EF');
  if (how === 'oneClick') expect(r, JSON.stringify(r)).toMatchObject({ n: 1, inHost: true, prev: 'rowE' });
  else expect(r, JSON.stringify(r)).toMatchObject({ n: 1, inHost: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── 안 걸려야 하는 자리 ── */
const counts = (page) => page.evaluate(() => ({ g: document.querySelectorAll('#canvas .grid-block').length, f: document.querySelectorAll('#canvas .frame-block:not([data-text-frame])').length }));
test('글 편집 중 d·f → 글자로 들어가고 블록 0', async ({ page }) => {
  const errs = await scene(page);
  await scrollTo(page, 'topT');
  await until(page, () => page.evaluate(() => document.activeElement?.closest?.('#topT') && document.activeElement.isContentEditable),
    async () => { const p = await center(page, 'topT'); await page.mouse.dblclick(...p); });
  const c0 = await counts(page);
  await page.keyboard.press('End'); await page.keyboard.press('d'); await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.querySelector('#topT [class^="tb-"]').textContent)).toContain('df');
  expect(await counts(page)).toEqual(c0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('입력칸에서 d·f → 블록 0', async ({ page }) => {
  const errs = await scene(page);
  await CTX.section.go(page);
  await page.evaluate(() => { const i = document.createElement('input'); i.id = 'tIn'; i.style.cssText = 'position:fixed;left:10px;top:10px;z-index:99999;width:100px'; document.body.appendChild(i); });
  await page.mouse.click(40, 18);
  await expect.poll(() => page.evaluate(() => document.activeElement?.id)).toBe('tIn');
  const c0 = await counts(page);
  await page.keyboard.press('d'); await page.keyboard.press('f');
  await expect.poll(() => page.evaluate(() => document.getElementById('tIn').value)).toBe('df');
  expect(await counts(page)).toEqual(c0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('IME 조합 중(isComposing) D·F → 블록 0 · 같은 dispatch 에 isComposing 없으면 생김(양성)', async ({ page }) => {
  const errs = await scene(page);
  await CTX.section.go(page);
  const fire = (code, comp) => page.evaluate(([code, comp]) => document.body.dispatchEvent(new KeyboardEvent('keydown', { code, key: code === 'KeyD' ? 'd' : 'f', isComposing: comp, bubbles: true, cancelable: true })), [code, comp]);
  const c0 = await counts(page);
  await fire('KeyD', true); await fire('KeyF', true); await raf(page);
  expect(await counts(page)).toEqual(c0);
  await fire('KeyD', false);
  await expect.poll(() => counts(page)).toEqual({ g: c0.g + 1, f: c0.f });
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('⌘D = 복제만 · ⌥D = 우정렬만 · ⇧D·⇧F·⌘F·⌘T = 블록 0', async ({ page }) => {
  const errs = await scene(page);
  await scrollTo(page, 'topT');
  await until(page, () => page.evaluate(() => document.getElementById('topT').classList.contains('selected')), async () => { const p = await center(page, 'topT'); await page.mouse.click(...p); });
  const c0 = await counts(page);
  const t0 = (await ids(page, '.text-block')).length;
  await page.keyboard.press('Meta+d');
  await expect.poll(async () => (await ids(page, '.text-block')).length, '⌘D 복제').toBe(t0 + 1);
  expect(await counts(page), '⌘D: 그리드·프레임 0').toEqual(c0);
  await page.keyboard.press('Alt+d'); await raf(page);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')].some((e) => e.style.alignSelf === 'flex-end')), '⌥D 우정렬').toBe(true);
  expect(await counts(page), '⌥D: 블록 0').toEqual(c0);
  for (const k of ['Shift+d', 'Shift+f', 'Meta+f', 'Meta+t']) { await page.keyboard.press(k); await raf(page); await page.keyboard.press('Escape'); await raf(page); }
  expect(await counts(page), '⇧D·⇧F·⌘F·⌘T: 블록 0').toEqual(c0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── ⌘Z 한 번 · 저장 왕복 ── */
for (const k of ['d', 'f']) test(`${k.toUpperCase()} → ⌘Z 한 번 = 직렬 바이트 그대로`, async ({ page }) => {
  const errs = await scene(page);
  await CTX.frameSelected.go(page);
  const s0 = await page.evaluate(() => window.getSerializedCanvas());
  const before = await ids(page, KIND[k]);
  await press(page, k, KIND[k], before);
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => window.getSerializedCanvas()), '⌘Z 한 번 뒤 직렬 = 전').toBe(s0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
test('저장 왕복 — D·F 로 만든 구조가 직렬 → 다시 열기 뒤 같다', async ({ page }) => {
  const errs = await scene(page);
  await CTX.frameSelected.go(page);
  await press(page, 'f', FR_SEL, await ids(page, FR_SEL));
  await CTX.enteredChildFlow.go(page);
  await press(page, 'd', '.grid-block', await ids(page, '.grid-block'));
  const shape = () => page.evaluate(() => [...document.querySelectorAll('#canvas .grid-block, #canvas .frame-block:not([data-text-frame])')]
    .map((e) => `${e.id}<${e.parentElement.closest('.frame-block:not([data-text-frame]), .section-inner')?.id}#${[...e.parentElement.children].indexOf(e)}`));
  const s0 = await shape();
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); window.clearHistory?.(); });
  await expect.poll(shape).toEqual(s0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
