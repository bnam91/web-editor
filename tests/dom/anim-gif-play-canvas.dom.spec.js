/* anim-gif-play-canvas — PLAY-ON-CANVAS-01(현빈: «캔버스에서 그대로 적용되게 만드는 옵션 … gif 효과가 섹션에서 어울리는지 보기 위해서»).
 * ★잰다: 실제 텍스트 블럭 · 실제 모달 · 진짜 «캔버스에서 보기» 단추 클릭 · 진짜 키보드 Esc · 진짜 마우스 클릭 · 실제 배율(applyZoom).
 * P1 단추 → 모달 닫힘 · 덮개 #anim-canvas-play 하나 · #canvas 밖(body) · 블럭 자리에 붙음 · 재생 중 serializeProject·캔버스 HTML·이력 무변 ·
 *    배율 50% 로 바꿔도 블럭 자리를 따라감 · Esc → 덮개 0 · 캔버스 HTML·이력 그대로(Esc 는 멈춤에만 — 아이맥 001ae0374+C9 첫 판은 Esc 가 선택 해제까지 타서 2줄 다름) · pageerror 0
 * P2 ★뒤집음(현빈 재QA 261116 «계속 플레이되면 좋겠고» · 지디 판정 (나)): 옛 P2 «재생 중 캔버스 클릭 → 멈춤» → 클릭은 안 끝낸다(덮개 남고 계속 돈다 · 에디터로 그대로) · Esc 로 끝
 * P3 ★바꿈: 옛 P3(덮개 위 «⏸ 멈춤/▶ 재생» 단추)는 걷었다 → 블럭 ▶/⏸ 단추(#anim-tb-play · 에셋 ✕ 자리·꼴): 고른 GIF 블럭에 마우스 → 오른쪽 위(블럭 오른끝−40 · 위+10 — ★3판: 화면px 가 아니라 캔버스px × 배율, GIF-PLAY-OVERLAY-LAYER-SIZE-01 · 크기·층은 anim-gif-play-layer L1~L3) ▶ ·
 *    진짜 클릭 → 재생(⏸) · 바퀴 ≥2 · 단추·덮개는 #canvas 밖 · serializeProject·캔버스 HTML·Figma JSON 에 0 · ⏸ 클릭 → 끝(▶) · 다시 ▶ → 재생 중 더블클릭(편집) → 끝
 *    양성대조(예측 · CTL): animation-engine.js tick 의 `|| tb.classList.contains('editing')` 삭제 + _placePlayBtn 의 `_playBtn.textContent = playing ? '⏸' : '▶'` → `'▶'` → P3 빨강 · P2 는 CTL 의 keydown 갈래와 무관
 * 양성대조(예측): js/animation-engine.js playAnimOnCanvas 의 `document.body.appendChild(cv)` → `tb.appendChild(cv)` → P1 빨강(#canvas 안 · 저장에 섞임 · 캔버스 HTML 바뀜) · 단위 E14 도
 * 셀렉터·전역 대조(제품 소스 grep): .anim-play-canvas-btn(index.html 모달 꼬리) · #anim-canvas-play(animation-engine.js playAnimOnCanvas cv.id) · #anim-gif-modal ·
 *   window.serializeProject(save-load.js:3299) · window.historyStack(history.js 읽기 전용) · window.applyZoom(editor.js:5275 · % 단위 — _t905-ops 의 applyZoom(30)) ·
 *   window.addSection · window.selectSection(editor.js:5271) · window.addTextBlock · window.openAnimModal(엔진 끝)
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    window.addTextBlock('body');
    const tb = [...c.querySelectorAll('.text-block')].pop();
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('.tb-body');
    ce.innerHTML = '캔버스에서 보기 <span style="color: rgb(255, 0, 0)">빨강</span>';
    window.__tb = tb;
    window.openAnimModal(tb);
  });
  return errs;
}
const snap = (page) => page.evaluate(() => ({ html: document.getElementById('canvas').innerHTML, hist: window.historyStack.length, ser: window.serializeProject() }));
/** 두 HTML 의 첫 다른 줄(실패 메시지용 — 무엇이 바뀌었는지 바로 보이게). */
const firstDiff = (a, b) => { const x = a.split('\n'), y = b.split('\n'); for (let i = 0; i < Math.max(x.length, y.length); i++) if (x[i] !== y[i]) return `줄 ${i}: «${(x[i] || '').trim().slice(0, 200)}» → «${(y[i] || '').trim().slice(0, 200)}»`; return '같음'; };
/** 캔버스가 멈출 때까지(배율 transform 전환 0.15초 · 맞춤·스크롤) — 재고 나서 누르는 사이에 움직이면 좌표가 낡는다.
 *  수지맥(M4) 런에서 부트 직후 전환 중에 재 P3·L3 가 빨강(배율 0.4364 = 전환 중간값 · 아이맥 초록) — 창·배율에 안 기대게 «멈춤»을 먼저 본다. */
const settle = (page) => expect.poll(() => page.evaluate(() => new Promise((res) => {
  const s = document.getElementById('canvas-scaler'), r0 = window.__tb.getBoundingClientRect();
  requestAnimationFrame(() => requestAnimationFrame(() => {
    const r1 = window.__tb.getBoundingClientRect(), busy = (s.getAnimations ? s.getAnimations() : []).length;
    res(!busy && ['x', 'y', 'width', 'height'].every((k) => Math.abs(r0[k] - r1[k]) < 0.01));
  }));
})), { timeout: 10000, message: '[전제] 캔버스 배율·자리가 멈춤' }).toBe(true);
const overlayVsBlock = (page) => page.evaluate(() => {
  const cv = document.getElementById('anim-canvas-play'), a = cv && cv.getBoundingClientRect(), b = window.__tb.getBoundingClientRect();
  return cv ? Math.max(Math.abs(a.left - b.left), Math.abs(a.top - b.top), Math.abs(a.width - b.width), Math.abs(a.height - b.height)) : -1;
});

test('P1 캔버스에서 보기 — 덮개는 #canvas 밖 · 블럭 자리 · 저장·캔버스 HTML·이력 무변 · 배율 따라감 · Esc 원상', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#anim-gif-modal .anim-play-canvas-btn');   // 견줌 기준 = 재생 «중» 스냅(모달 닫기 자체의 저장 몫과 섞지 않는다)
  await expect(page.locator('#anim-gif-modal')).toBeHidden();
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  expect(await page.evaluate(() => !document.getElementById('anim-canvas-play').closest('#canvas')), '★덮개가 #canvas 안').toBe(true);
  await expect.poll(() => overlayVsBlock(page), { message: '덮개 = 블럭 자리' }).toBeLessThanOrEqual(1);
  const during = await snap(page);
  expect(during.ser.includes('anim-canvas-play'), '★저장에 덮개가 섞였다').toBe(false);
  await page.evaluate(() => window.applyZoom(50));
  await expect.poll(() => overlayVsBlock(page), { message: '★배율을 바꾸니 덮개가 블럭 자리에서 떨어졌다' }).toBeLessThanOrEqual(1);
  await page.evaluate(() => window.applyZoom(100));
  await expect.poll(() => overlayVsBlock(page)).toBeLessThanOrEqual(1);
  const before = await snap(page);
  await page.keyboard.press('Escape');
  await expect(page.locator('#anim-canvas-play'), '★Esc 로 안 멈춘다').toHaveCount(0);
  const after = await snap(page);
  expect(after.html === before.html, `★Esc 가 멈춤 말고 에디터까지 탔다 — ${firstDiff(before.html, after.html)}`).toBe(true);
  expect(after.hist, '이력 무변(재생 시작 직후와 Esc 뒤)').toBe(during.hist);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 재생 중 다른 곳 클릭은 안 끝낸다 — 계속 돈다 · Esc 로 끝', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#anim-gif-modal .anim-play-canvas-btn');
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  const box = await page.evaluate(() => { const r = document.getElementById('canvas').getBoundingClientRect(); return { x: r.left + 5, y: r.top + 5 }; });
  await page.mouse.click(box.x, box.y);
  await page.keyboard.press('Shift');
  await expect(page.locator('#anim-canvas-play'), '★클릭·⇧ 로 끝났다').toHaveCount(1);
  await expect.poll(() => page.evaluate(() => Number(document.getElementById('anim-canvas-play')?.dataset.loops ?? -1)), { timeout: 15000, message: '★계속 안 돈다' }).toBeGreaterThanOrEqual(2);
  await page.keyboard.press('Escape');
  await expect(page.locator('#anim-canvas-play'), 'Esc = 끝').toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P3 블럭 ▶/⏸ — 에셋 ✕ 자리 · 재생·끝 · 편집 들어가면 끝 · 저장·HTML·Figma 0', async ({ page }) => {
  const errs = await scene(page);
  await page.click('#anim-gif-modal .anim-item[data-id="fade-in"]');   // 고름 = 블럭에 효과가 남는다(data-anim-fx)
  await page.evaluate(() => window.closeAnimModal());
  expect(await page.evaluate(() => window.__tb.dataset.animFx), '[전제] 효과가 블럭에').toBe('fade-in');
  await settle(page);
  const tbBox = await page.evaluate(() => { const r = window.__tb.getBoundingClientRect(), s = document.getElementById('canvas-scaler'); return { x: r.left + r.width / 2, y: r.top + r.height / 2, right: r.right, top: r.top, k: s.getBoundingClientRect().width / s.offsetWidth }; });
  await page.mouse.move(tbBox.x, tbBox.y);
  const btn = page.locator('#anim-tb-play');
  await expect(btn, '★GIF 블럭에 올렸는데 ▶ 가 없다').toBeVisible();
  await expect(btn).toHaveText('▶');
  const bb = await btn.boundingBox();
  expect([Math.abs(bb.x - (tbBox.right - 40 * tbBox.k)) <= 1, Math.abs(bb.y - (tbBox.top + 10 * tbBox.k)) <= 1], `블럭 오른쪽 위(에셋 ✕ 자리 · 캔버스px × 배율 ${tbBox.k}) — ${JSON.stringify(bb)}`).toEqual([true, true]);
  await btn.click();
  await expect(page.locator('#anim-canvas-play'), '★▶ 로 재생 안 됨').toHaveCount(1);
  await expect(btn).toHaveText('⏸');
  await expect.poll(() => page.evaluate(() => Number(document.getElementById('anim-canvas-play')?.dataset.loops ?? -1)), { timeout: 15000 }).toBeGreaterThanOrEqual(2);
  const leak = await page.evaluate(() => {
    const all = []; const walk = (o) => { if (Array.isArray(o)) o.forEach(walk); else if (o && typeof o === 'object') Object.values(o).forEach(walk); else if (typeof o === 'string') all.push(o); };
    window.flushCurrentPage?.(); walk(window.buildFigmaExportJSON?.(null) ?? null);
    const re = /anim-tb-play|anim-canvas-play/;
    return { inCanvas: !!document.querySelector('#canvas #anim-tb-play, #canvas #anim-canvas-play'), ser: re.test(window.serializeProject()), html: re.test(document.getElementById('canvas').innerHTML), fig: all.some((x) => re.test(x)) };
  });
  expect(leak, '★편집 전용 단추·덮개가 문서·저장·Figma 에 섞였다').toEqual({ inCanvas: false, ser: false, html: false, fig: false });
  await btn.click();
  await expect(page.locator('#anim-canvas-play'), '★⏸ 로 안 끝남').toHaveCount(0);
  await expect(btn).toHaveText('▶');
  await btn.click();
  await expect(page.locator('#anim-canvas-play')).toHaveCount(1);
  await settle(page);
  const tb2 = await page.evaluate(() => { const r = window.__tb.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.dblclick(tb2.x, tb2.y);   // 블럭 편집(누르기 직전 자리)
  await expect(page.locator('#anim-canvas-play'), '★편집 들어갔는데 재생이 남았다').toHaveCount(0);
  expect(errs, errs.join(' | ')).toEqual([]);
});
