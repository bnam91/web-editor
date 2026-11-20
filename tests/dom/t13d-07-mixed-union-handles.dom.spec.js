/* t13d-07 — 0.9.13 t13D-07 섹션의 «오버레이 글자» + «흐름 프레임»(형제)을 복수 선택 → 공통 선택 상자 손잡이가 없어 크기 조절 불가
 * 원인: selection-overlay.js _unionScalable 이 고른 것 «전부 absolute» 일 때만 손잡이를 달았다(t2-02b 메이커 결정 · 흐름 = 좌표 없음).
 * 고침: 흐름 «프레임»은 섞여도 손잡이를 단다 — 크기만(좌표·offset 안 씀 · overlay-handles.js s.flow) · 글자는 ⌘G 규칙(min(sx,sy)).
 * U1 ⇧클릭 둘 → 전체 상자 손잡이 8
 * U2 se 끌기 → 프레임 폭·높이 커짐 · 프레임 left/top/offset 안 씀 · 글자 커짐 · ⌘Z 한 번에 복귀
 * U3 흐름 «글자»가 섞이면 종전대로 손잡이 0(t202b D 와 같은 뜻 — 넓힌 것은 프레임뿐)
 * 양성대조: _patches/t13d-07-CTL.patch → U1·U2 빨강(손잡이 0) · U3 초록.
 * G1 ⌘G(현상 1 · 현빈 결정 261120 «일반 그룹»): 오버레이 글자 + 흐름 프레임 → 그 자리 그대로 «새 공통 그룹»(프레임 안으로 넣기 0) ·  글자 화면 자리 무변 · 그룹 손잡이(모서리 넷)
 *   양성대조: _patches/t13d-07-CTL-cmdg.patch(block-factory 의 _overlayText 갈래 걷음 = 옛 9/30 «프레임 안으로») → G1 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitZoomSettled } = require('./_root-harness.js');

const raf = (p) => p.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const UH = (d) => `#ss-handles-overlay .ss-union-handle.${d}`;
const uh = (page) => page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay .ss-union-handle')].filter((h) => h.getBoundingClientRect().width > 0 && getComputedStyle(h).display !== 'none').length);
const mid = (page, sel) => page.evaluate((s) => { const q = document.querySelector(s).getBoundingClientRect(); return [q.x + q.width / 2, q.y + q.height / 2]; }, sel);
async function pick(page, sels) {
  let [x, y] = await mid(page, sels[0]); await page.mouse.click(x, y);
  await page.keyboard.down('Shift');
  for (const s of sels.slice(1)) { [x, y] = await mid(page, s); await page.mouse.click(x, y); }
  await page.keyboard.up('Shift'); await raf(page);
}

async function scene(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); await window.addSection();
    const sec = c.querySelector('.section-block'); sec.id = 'sG';
    window.applyZoom?.(100);
  });
  await waitZoomSettled(page, 100);
  await page.evaluate(() => {
    const sec = document.getElementById('sG'); document.getElementById('canvas-wrap').scrollTop = 0; sec.scrollIntoView({ block: 'start' });
    const tf = sec.querySelector('.frame-block[data-text-frame]'); tf.id = 'tfO'; tf.style.width = '160px'; tf.dataset.width = '160';
    const tb = tf.querySelector('[class^="tb-"]'); tb.textContent = '글자'; tb.style.fontSize = '20px'; delete tb.dataset.isPlaceholder;
    const p = window.OverlayFloat.posElOf(tf); window.OverlayFloat.enterFloat(p); p.style.left = '20px'; p.style.top = '20px'; p.dataset.offsetX = '20'; p.dataset.offsetY = '20';
    window.deselectAll(); window.selectSection(sec); window.addFrameBlock();
    const fr = [...sec.querySelectorAll('.frame-block:not([data-text-frame])')].pop(); fr.id = 'frF';
    window.updateFrameBlock?.('frF', { width: 300, height: 150 });
    window.deselectAll(); window.selectSection(sec); window.addTextBlock('body');
    const tf2 = [...sec.querySelectorAll('.frame-block[data-text-frame]')].find((x) => x !== tf); tf2.id = 'tfFlow';
    window.deselectAll(); document.activeElement?.blur?.(); window.clearHistory?.();
  });
  await raf(page);
  /* [시험만 · 인텔 261120 U1~U3 3/3 ✘ «전제» 줄] 흐름 프레임의 계산 position 은 'static' 이 아니라 'relative'(css/editor-blocks.css .frame-block — 자유배치 자식의 기준)
     ⇒ «흐름» = absolute 아님으로 잰다(뜻 같음 · 좌표 없음) · 오버레이 표식은 enterFloat 가 단 «자리 요소»(OverlayFloat.posElOf) 에 있다(overlay-float.js:373). */
  const pre = await page.evaluate(() => { const t = document.getElementById('tfO'); return { frFlow: getComputedStyle(document.getElementById('frF')).position !== 'absolute', tf: (window.OverlayFloat.posElOf(t) || t).dataset.overlayBlock }; });
  expect(pre, '[전제] 프레임 = 흐름(absolute 아님) · 글자 = 오버레이').toEqual({ frFlow: true, tf: 'true' });
  return errs;
}
const read = (page) => page.evaluate(() => { const f = document.getElementById('frF'), t = document.getElementById('tfO'), tb = t.querySelector('[class^="tb-"]');
  return { fw: f.getBoundingClientRect().width, fh: f.getBoundingClientRect().height, fpos: [f.style.left, f.style.top, f.dataset.offsetX ?? null, f.dataset.offsetY ?? null], fs: parseFloat(getComputedStyle(tb).fontSize) }; });

test('U1 오버레이 글자 + 흐름 프레임 ⇧클릭 → 전체 상자 손잡이 8', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#frF', '#tfO .text-block']);
  expect(await page.evaluate(() => window.__selOverlay.targets().map((e) => e.id).sort()), '[전제] 고른 둘').toEqual(['frF', 'tfO']);
  await expect.poll(() => uh(page), '★공통 상자 손잡이').toBe(8);
  expect(errs).toEqual([]);
});

test('U2 se 끌기 → 프레임 크기·글자 함께 · 프레임 좌표 안 씀 · ⌘Z 한 번', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#frF', '#tfO .text-block']);
  await expect.poll(() => uh(page), '[전제] 손잡이 8').toBe(8);
  const a = await read(page);
  const [x, y] = await mid(page, UH('se'));
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 60, { steps: 6 }); await page.mouse.up(); await raf(page);
  const b = await read(page);
  expect(b.fw, `★프레임 폭 ${a.fw}→${b.fw}`).toBeGreaterThan(a.fw + 5);
  expect(b.fh, `★프레임 높이 ${a.fh}→${b.fh}`).toBeGreaterThan(a.fh + 5);
  expect(b.fs, `★글자 ${a.fs}→${b.fs}`).toBeGreaterThan(a.fs);
  expect(b.fpos, '★흐름 프레임엔 좌표·offset 을 안 쓴다').toEqual(a.fpos);
  await page.keyboard.press('Meta+z'); await raf(page);
  await expect.poll(async () => { const c = await read(page); return [Math.round(c.fw), Math.round(c.fh), c.fs]; }, '★⌘Z 한 번 = 옛 크기').toEqual([Math.round(a.fw), Math.round(a.fh), a.fs]);
  expect(errs).toEqual([]);
});

test('U3 흐름 «글자»가 섞이면 종전대로 손잡이 0', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#tfO .text-block', '#tfFlow .text-block']);
  expect(await page.evaluate(() => document.querySelectorAll('.ss-sel-union').length), '[전제] 전체 상자 있음').toBe(1);
  expect(await uh(page), '손잡이 0').toBe(0);
  expect(errs).toEqual([]);
});

test('G1 ⌘G = 일반 그룹(현빈 261120) — 그 자리 그대로 새 공통 그룹 · 프레임 안으로 넣기 0 · 손잡이 8', async ({ page }) => {
  const errs = await scene(page);
  await pick(page, ['#frF', '#tfO .text-block']);
  expect(await page.evaluate(() => window.__selOverlay.targets().map((e) => e.id).sort()), '[전제] 고른 둘').toEqual(['frF', 'tfO']);
  const r0 = await page.evaluate(() => { const q = document.getElementById('tfO').getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width)]; });
  const p0 = await page.evaluate(() => document.getElementById('frF').parentElement.id || document.getElementById('frF').parentElement.className);
  await page.keyboard.press('Meta+g'); await raf(page);
  const g = await page.evaluate(() => { const f = document.getElementById('frF'), t = document.getElementById('tfO'), grp = f.parentElement.closest('.frame-block[data-group="true"]');
    return { group: !!grp, sameGroup: !!grp && grp.contains(t), textInFrame: f.contains(t), frameParentIsGroup: f.parentElement === grp || f.parentElement?.parentElement === grp }; });
  expect(g, '★새 공통 그룹 · 글자는 프레임 «안»이 아니라 그룹 안 · 프레임도 그룹 안').toEqual({ group: true, sameGroup: true, textInFrame: false, frameParentIsGroup: true });
  const r1 = await page.evaluate(() => { const q = document.getElementById('tfO').getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.width)]; });
  expect(r1.map((v, i) => Math.abs(v - r0[i]) <= 1), `★글자 화면 자리 그대로 ${JSON.stringify([r0, r1])}`).toEqual([true, true, true]);
  /* 그룹(=프레임) 손잡이 꼴 = 모서리 넷(overlay-handles.js showFrameHandles dirs nw·ne·sw·se · 같은 앱 보통 ⌘G 그룹 시험 group-scale-* 도 .ss-resize-handle 모서리) ·
     인텔 261120 G1 Received 4 = 정상 그룹 꼴(옛 기대 8 은 내 잘못 — 공통 «선택 상자» 손잡이 8 과 섞음). */
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay .ss-resize-handle')].filter((h) => h.getBoundingClientRect().width > 0 && getComputedStyle(h).display !== 'none').map((h) => h.dataset.dir).sort().join(',')), '★그룹 손잡이 = 모서리 넷').toBe('ne,nw,se,sw');
  expect(p0, '[전제] 묶기 전 프레임 부모 기록').toBeTruthy();
  expect(errs).toEqual([]);
});
