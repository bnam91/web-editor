/* text-scale-tool — t13A-08 K 텍스트 스케일 모드(0.9.13_t13A 9행 · 현빈 261118 · 지디 GO 261118)
 *   현빈 눌러볼 동작: 텍스트 블록 고름 → K → 모서리 손잡이 → 끌면 글자·자간·패딩·외곽선·그림자가 같이 커짐 → K/Esc/V 로 끝.
 *   장면 = 진짜 앱(bootApp) · 흐름 텍스트 하나(글자 20px · 자간 2px · 위아래 패딩 10px · 외곽선 2px 가운데 · 그림자 4/4/8).
 * 칸
 *   S1 흐름 텍스트: K 전 손잡이 0 → K → 4 · se 를 오른쪽 200px 끌면 글자 ×k(>1.1) 와 «같은 k» 로 자간·패딩·외곽선·그림자 · 폭은 안 씀 · ⌘Z 한 번 = 원래 값
 *   S2 끄기 셋: K 다시 → 손잡이 0 · Esc → 0(선택은 남음) · V → 0(선택은 남음) · 선택 풀림 → 모드 끝
 *   S3 오버레이 텍스트: K 없이 모서리 = 지금 그대로(글자만 · 자간 그대로 — 현빈 A안 0920) · K 켜고 끌면 자간도 같은 k
 * 양성대조: _patches/controls/TSCALE-CTL-rest.patch(onMove 의 _scaleRest?.(k) 한 줄 뺌) → S1·S3 빨강 · S2 초록
 *          _patches/controls/TSCALE-CTL-ktoggle.patch(K 재입력 끄기 한 줄 뺌) → S2 «K 다시» 빨강 · S1·S3 초록
 * 안 잰 것: 실앱 실키 · 그리드/laurel 칸이 골라졌을 때 K = 아이콘(순서는 editor.js 같은 갈래 안 «뒤»라 소스로만) · ⌘K · 말풍선·아이콘텍스트 · 회전 글상자.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const H = '#ss-handles-overlay [data-tf-resize-dir]';
async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  await page.waitForFunction(() => typeof window.textScaleToggle === 'function' && typeof window.exitToolModes === 'function');   // [전제] 모듈·명부가 섰다
  await page.evaluate(() => {
    window.applyZoom?.(100);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection(); const sec = [...c.querySelectorAll('.section-block')].pop(); sec.id = 'S';
    sec.querySelectorAll('.frame-block[data-text-frame]').forEach((t) => (t.closest('.row') || t).remove());
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const tb = [...sec.querySelectorAll('.text-block')].pop(); tb.id = 'TB';
    const t = tb.querySelector('[class^="tb-"]'); t.id = 'TC';
    t.textContent = '스케일 시험 글'; delete t.dataset.isPlaceholder;
    t.style.fontSize = '20px'; t.style.letterSpacing = '2px';
    tb.style.paddingTop = '10px'; tb.style.paddingBottom = '10px';
    Object.assign(t.dataset, { strokeOn: 'true', strokeW: '2', strokeColor: '#000000', strokeAlign: 'center',
      shadowEnabled: 'true', shadowX: '4', shadowY: '4', shadowBlur: '8', shadowColor: '#000000', shadowAlpha: '50' });
    window.rebindAll?.(); window.deselectAll(); window.clearHistory?.();
  });
  await page.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  return errs;
}
const st = (page) => page.evaluate((H) => {
  const tb = document.getElementById('TB'), t = document.getElementById('TC'), tf = tb?.closest('.frame-block[data-text-frame]');
  return { handles: document.querySelectorAll(H).length, sel: !!tb?.classList.contains('selected'),
    fs: parseFloat(t?.style.fontSize), ls: parseFloat(t?.style.letterSpacing), pad: parseFloat(tb?.style.paddingTop),
    sw: parseFloat(t?.dataset.strokeW), shx: parseFloat(t?.dataset.shadowX), tfW: tf?.offsetWidth, tfStyleW: tf?.style.width ?? null };
}, H);
async function pick(page) {
  const r = await waitStableRect(page, '#TC');
  await page.mouse.click(r.cx, r.cy);
  await expect.poll(async () => (await st(page)).sel, '[전제] 텍스트가 골라졌다').toBe(true);
}
async function dragSe(page, dx) {
  const r = await waitStableRect(page, '#ss-handles-overlay .tfo-overlay-handle.se');
  await page.mouse.move(r.cx, r.cy); await page.mouse.down();
  await page.mouse.move(r.cx + dx / 2, r.cy, { steps: 4 }); await page.mouse.move(r.cx + dx, r.cy, { steps: 4 });
  await page.mouse.up();
}

test('S1 흐름 텍스트 — K 로 손잡이 · 끌면 글자와 같은 k 로 자간·패딩·외곽선·그림자 · 폭 안 씀 · ⌘Z 한 번', async ({ page }) => {
  const errs = await scene(page);
  await pick(page);
  const s0 = await st(page);
  expect([s0.handles, s0.fs, s0.ls, s0.pad, s0.sw, s0.shx], '[전제] 흐름이라 손잡이 0 · 시작 값').toEqual([0, 20, 2, 10, 2, 4]);
  await page.keyboard.press('k');
  await expect.poll(async () => (await st(page)).handles, 'S1 K → 모서리 손잡이 4').toBe(4);
  await dragSe(page, 200);
  const s1 = await st(page);
  const k = s1.fs / 20;
  expect(k, 'S1 글자가 커졌다(k>1.1)').toBeGreaterThan(1.1);
  expect([Math.abs(s1.ls - 2 * k) < 0.05, Math.abs(s1.pad - 10 * k) <= 1, Math.abs(s1.sw - 2 * k) <= 0.5, Math.abs(s1.shx - 4 * k) <= 1],
    `S1 같은 k(${k.toFixed(3)}) — 자간·패딩·외곽선·그림자 ${JSON.stringify(s1)}`).toEqual([true, true, true, true]);
  /* 흐름 tf 는 팩토리가 style.width '100%' 를 심어 둔다(r1 이 '' 로 잘못 기대 — 아이맥 r67 빨강) ⇒ 시작 값 그대로인지 잰다 */
  expect([s1.tfStyleW, Math.abs(s1.tfW - s0.tfW) <= 1], `S1 흐름 폭은 안 쓴다(시작 ${s0.tfStyleW})`).toEqual([s0.tfStyleW, true]);
  await page.keyboard.press('ControlOrMeta+z');
  await expect.poll(async () => { const x = await st(page); return [x.fs, x.ls, x.pad, x.sw, x.shx]; }, 'S1 ⌘Z 한 번 = 원래').toEqual([20, 2, 10, 2, 4]);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S2 끄기 — K 다시 · Esc · V (선택은 남음) · 선택 풀림이면 저절로', async ({ page }) => {
  const errs = await scene(page);
  await pick(page);
  const on = async (why) => { await page.keyboard.press('k'); await expect.poll(async () => (await st(page)).handles, `[전제] ${why} 앞 K 켜짐`).toBe(4); };
  await on('K 다시');
  await page.keyboard.press('k');
  await expect.poll(async () => (await st(page)).handles, 'S2 K 다시 = 끔').toBe(0);
  await on('Esc');
  await page.keyboard.press('Escape');
  await expect.poll(async () => { const x = await st(page); return [x.handles, x.sel]; }, 'S2 Esc = 모드만 끔 · 선택 남음').toEqual([0, true]);
  await on('V');
  await page.keyboard.press('v');
  await expect.poll(async () => { const x = await st(page); return [x.handles, x.sel]; }, 'S2 V = 모든 도구 모드 끝 · 선택 남음').toEqual([0, true]);
  await on('선택 풀림');
  await page.evaluate(() => window.deselectAll());
  await expect.poll(async () => (await st(page)).handles, 'S2 선택 풀림 = 모드 끝').toBe(0);
  await pick(page);
  await page.keyboard.press('v');
  expect(await page.evaluate(() => window.exitToolModes()), 'S2 [지킴] 켜진 모드 없으면 V 는 아무것도 안 끔').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S3 오버레이 텍스트 — K 없으면 지금 그대로(자간 무변) · K 켜면 자간도 같은 k', async ({ page }) => {
  const errs = await scene(page);
  await pick(page);
  await page.click('#txt-overlay-toggle');
  await expect.poll(async () => (await st(page)).handles, '[전제] 오버레이 = 손잡이 4').toBe(4);
  await dragSe(page, 120);
  let s = await st(page);
  expect([s.fs > 20.5, s.ls], 'S3 K 없음 = 글자만(현빈 A안) · 자간 그대로').toEqual([true, 2]);
  const fs0 = s.fs;
  await page.keyboard.press('k');
  await expect.poll(() => page.evaluate(() => !!document.getElementById('TB').closest('.frame-block')._textScale), '[전제] K 켜짐').toBe(true);
  await dragSe(page, 120);
  s = await st(page);
  const k = s.fs / fs0;
  expect(k, 'S3 K 로 더 커짐').toBeGreaterThan(1.05);
  expect(Math.abs(s.ls - 2 * k) < 0.05, `S3 자간 = 같은 k(${k.toFixed(3)}) · ${s.ls}`).toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});
