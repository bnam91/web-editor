/* section-protect-frame-delete — 🔒 보호 섹션의 프레임은 Delete·⌘X 로 안 지워진다
 * 왜: 프레임 단독 삭제 갈래가 A13 보호 검사 전에 지우고 return 해서, 프레임과 안의 글자까지 지워지고 토스트도 없었다(S3 앱 재현 각 3/3).
 * 칸: 맨 위·중간·안쪽 × Delete·⌘X = 그대로 · 같은 토스트 · 저장 왕복 뒤에도 그대로 · 히스토리 안 늘어남
 *     복수 = 보호 섹션 형제 둘 · 보호+미보호 섞임(부분 삭제 없음) · 프레임+글자 섞임
 *     [대조] 보호 글자 = 같은 토스트 · [음성] 미보호 = 지워지고 ⌘Z 로 돌아온다
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const FR = '.frame-block:not([data-text-frame])';
const TOAST = '🔒 보호된 섹션의 블록은 삭제할 수 없습니다 — 🔒 버튼으로 보호 해제 후 삭제하세요';
const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));

/* 섹션 하나: R > A > G > H(큰 틀부터 안으로) + 형제 S · 각 프레임에 글자 하나. 아래쪽 섹션 U 는 protU 일 때 미보호 짝. */
async function scene(page, { prot = true } = {}) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  const ids = await page.evaluate(async ([FR, prot]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    const mkSec = async () => { await window.addSection(); return [...c.querySelectorAll('.section-block')].pop(); };
    const sec = await mkSec();
    const add = (s, par, w, h, l, t) => {
      window.deselectAll(); window.selectSection(s); window._activeFrame = par ? document.getElementById(par) : null;
      const b = new Set(s.querySelectorAll(FR)); window.addFrameBlock();
      const f = [...s.querySelectorAll(FR)].find((x) => !b.has(x));
      window.updateFrameBlock(f.id, { width: w, height: h });
      if (par) { f.style.left = l + 'px'; f.style.top = t + 'px'; f.dataset.offsetX = l; f.dataset.offsetY = t; }
      window.deselectAll(); window._activeFrame = null; return f.id;
    };
    const R = add(sec, null, 860, 560); const A = add(sec, R, 600, 420, 20, 20); const G = add(sec, A, 400, 300, 20, 20); const H = add(sec, G, 200, 160, 20, 20);
    const S = add(sec, R, 200, 160, 640, 20);
    /* 안의 글자: 맨 안쪽 H·형제 S 와 섹션 직속 */
    const text = (par) => { window.deselectAll(); window.selectSection(sec); window._activeFrame = par ? document.getElementById(par) : null; window.addTextBlock('body', { content: '남아야 할 글자' }); window.deselectAll(); window._activeFrame = null; };
    text(H); text(S); text(null);
    const sec2 = await mkSec(); const U = add(sec2, null, 860, 200);
    if (prot) window.setSectionProtected(sec.id, true);
    window.deselectAll(); window.clearHistory?.();
    document.getElementById(R).scrollIntoView({ block: 'center' });
    window.__toasts = []; const o = window.showToast; window.showToast = function (m) { window.__toasts.push(String(m)); return o?.apply(this, arguments); };
    return { sec: sec.id, R, A, G, H, S, U };
  }, [FR, prot]);
  await waitStableRect(page, '#' + ids.R);
  return { errs, ...ids };
}
const read = (page) => page.evaluate((FR) => ({
  frames: [...document.querySelectorAll('#canvas ' + FR)].map((f) => f.id),
  texts: document.querySelectorAll('#canvas .text-block').length,
  toasts: window.__toasts,
  tip: JSON.stringify(window.getHistoryTip()),
}), FR);
const box = (page, id) => page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
const clickFree = async (page, id, mod) => { const b = await box(page, id); if (mod) await page.keyboard.down(mod); await page.mouse.click(mod ? (b.l + b.r) / 2 : b.r - 14, mod ? (b.t + b.b) / 2 : b.b - 14); if (mod) await page.keyboard.up(mod); await raf(page); };
/* 사람 길: 바깥부터 차례로 눌러 들어가 target 만 고른다. */
async function pick(page, path) {
  for (const id of path) await clickFree(page, id);
  const target = path[path.length - 1];
  const s = await page.evaluate((id) => ({ on: document.getElementById(id).classList.contains('selected'), blocks: document.querySelectorAll('#canvas .text-block.selected').length }), target);
  expect(s, '[전제] 프레임만 골랐다').toEqual({ on: true, blocks: 0 });
}
/* 저장 왕복 = serializeProject → applyProjectData */
const reopen = async (page) => {
  const snap = await page.evaluate(() => window.serializeProject());
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await raf(page);
};

for (const [keyName, key] of [['Delete', 'Delete'], ['⌘X', 'Meta+x']]) {
  for (const [depth, pathOf] of [['맨 위', (i) => [i.R]], ['중간', (i) => [i.R, i.A]], ['안쪽', (i) => [i.R, i.A, i.G]]]) {
    test(`P ${depth} 프레임 ${keyName} — 보호면 그대로 · 토스트 · 다시 열어도 그대로`, async ({ page }) => {
      const s = await scene(page);
      const s0 = await read(page);
      await pick(page, pathOf(s));
      await page.keyboard.press(key); await raf(page);
      const s1 = await read(page);
      expect(s1.frames, '★보호 섹션 프레임이 지워졌다').toEqual(s0.frames);
      expect(s1.texts, '★안의 글자가 지워졌다').toBe(s0.texts);
      expect(s1.toasts, '★글자·표와 같은 토스트').toEqual([TOAST]);
      expect(s1.tip, '막은 삭제가 ⌘Z 칸을 만들었다').toBe(s0.tip);
      await reopen(page);
      const s2 = await read(page);
      expect(s2.frames, '★다시 열기').toEqual(s0.frames);
      expect(s2.texts).toBe(s0.texts);
      expect(await page.evaluate((id) => window.isSectionProtected(id), s.sec), '보호값 그대로').toBe(true);
      expect(s.errs, s.errs.join(' | ')).toEqual([]);
    });
  }
}

for (const [keyName, key] of [['Delete', 'Delete'], ['⌘X', 'Meta+x']]) {
  test(`M1 형제 프레임 둘 ${keyName} — 보호면 그대로 · 토스트`, async ({ page }) => {
    const s = await scene(page);
    const s0 = await read(page);
    await pick(page, [s.R, s.A]);
    await clickFree(page, s.S, 'Shift');
    expect(await page.evaluate(([a, b]) => [a, b].map((i) => document.getElementById(i).classList.contains('selected')), [s.A, s.S]), '[전제] 둘 고름').toEqual([true, true]);
    await page.keyboard.press(key); await raf(page);
    const s1 = await read(page);
    expect(s1.frames).toEqual(s0.frames); expect(s1.texts).toBe(s0.texts); expect(s1.toasts).toEqual([TOAST]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`M2 프레임+섹션 직속 글자 ${keyName} — 보호면 그대로 · 토스트`, async ({ page }) => {
    const s = await scene(page);
    const s0 = await read(page);
    await page.evaluate(([R, sec]) => {   // ⌘A 꼴 혼합 선택(프레임 + 그 밖 블럭)
      window.deselectAll();
      document.getElementById(sec).classList.add('selected');
      document.getElementById(R).classList.add('selected');
      [...document.getElementById(sec).querySelectorAll('.text-block')].pop().classList.add('selected');
    }, [s.R, s.sec]);
    await page.keyboard.press(key); await raf(page);
    const s1 = await read(page);
    expect(s1.frames).toEqual(s0.frames); expect(s1.texts).toBe(s0.texts); expect(s1.toasts).toEqual([TOAST]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
  test(`M3 보호 프레임+미보호 섹션 프레임 ${keyName} — 부분 삭제 없음`, async ({ page }) => {
    const s = await scene(page);
    const s0 = await read(page);
    await page.evaluate(([R, U]) => { window.deselectAll(); document.getElementById(R).classList.add('selected'); document.getElementById(U).classList.add('selected'); }, [s.R, s.U]);
    await page.keyboard.press(key); await raf(page);
    const s1 = await read(page);
    expect(s1.frames, '★어느 쪽도 안 지워진다').toEqual(s0.frames); expect(s1.toasts).toEqual([TOAST]);
    expect(s.errs, s.errs.join(' | ')).toEqual([]);
  });
}

test('C [대조] 보호 섹션 글자 Delete — 같은 토스트', async ({ page }) => {
  const s = await scene(page);
  const s0 = await read(page);
  await page.evaluate((sec) => { window.selectBlock([...document.getElementById(sec).querySelectorAll('.text-block')].pop().id); }, s.sec);
  await page.keyboard.press('Delete'); await raf(page);
  const s1 = await read(page);
  expect(s1.texts).toBe(s0.texts); expect(s1.toasts).toEqual([TOAST]);
});

for (const [keyName, key] of [['Delete', 'Delete'], ['⌘X', 'Meta+x']]) {
  for (const [depth, pathOf, gone] of [['맨 위', (i) => [i.R], (i) => [i.R, i.A, i.G, i.H, i.S]], ['중간', (i) => [i.R, i.A], (i) => [i.A, i.G, i.H]], ['안쪽', (i) => [i.R, i.A, i.G], (i) => [i.G, i.H]]]) {
    test(`N [음성] 미보호 ${depth} 프레임 ${keyName} — 그 나무만 지워지고 토스트 없음 · ⌘Z 로 돌아온다`, async ({ page }) => {
      const s = await scene(page, { prot: false });
      const s0 = await read(page);
      await pick(page, pathOf(s));
      await page.keyboard.press(key); await raf(page);
      const s1 = await read(page);
      expect(s1.frames, '그 나무만 빠진다').toEqual(s0.frames.filter((f) => !gone(s).includes(f)));
      expect(s1.texts).toBeLessThan(s0.texts);
      expect(s1.toasts).toEqual([]);
      expect(s1.tip, '[자 양성] 지우면 꼭대기가 바뀐다').not.toBe(s0.tip);
      await page.keyboard.press('Meta+z'); await raf(page);
      const s2 = await read(page);
      expect(s2.frames, '⌘Z').toEqual(s0.frames); expect(s2.texts).toBe(s0.texts);
      expect(s.errs, s.errs.join(' | ')).toEqual([]);
    });
  }
}
