/* slide-frame-cells — SLIDE-CELL-AS-FRAME-01(현빈 261118 · handoff/PLAN-ty-slide-frame-cells-261118.md) · 커밋 1 = 데이터 두 갈래 + 비파괴 렌더 + 왕복.
 *   js/blocks/slide-block.js: data-cell-mode="frame" = 정본 DOM(.sld-track > .frame-block.sld-cell 자식) · renderSlideBlock 프레임 갈래 = 배치만(칸 자식 무접촉)
 * F0 ★프레임 모드 슬라이드 · 칸 2 에 들어가(_activeFrame = 칸) 진짜 addTextBlock → 그 칸 안 글자(같은 요소 = id 로 잰다 · addTextBlock 프레임 갈래는 content 를 안 받는다)
 *    → 패널 값 바꾸기 길(setSlideLayout · renderSlideBlock 탐) + pushHistory → 글자 «같은 요소» 그대로 · 칸 3 · 간격 반영
 *    → ⌘Z 한 번 = 간격 전(글자 있음) · ⌘Z 한 번 더 = 글자 넣기 전(칸 3 그대로 · 칸 비었음) · ⌘⇧Z = 글자 다시
 *    → 저장 → 다시 열기(serializeProject → applyProjectData · RERENDER_KINDS 가 renderSlideBlock 을 탄다) → 칸 2 안 글자 · 표식·칸 배치 모드 그대로
 * F0b [음성] 사진 모드(표식 없음) = 옛 렌더 그대로(.sld-card · 칸 프레임 0)
 * ── 커밋 2 ──
 * F1 추가 메뉴 입구(addSlideBlock) 새 블럭 = 프레임 칸 3 · 패널 «프레임 추가하기» → 4 · 칸 ✕ → 3 · ↓ 순서(칸 요소째) · 칸 폭 % → data-w · 그 칸 폭 · 12 상한에서 단추 꺼짐 · ⌘Z = 직전 하나
 * F2 빈 칸을 진짜 클릭 → 그 칸 고름(_activeFrame) · 패널 = 슬라이드(그 칸 줄 표시 · «사진 넣기(칸 2)») · 프레임 px 손잡이 0 · 프레임 패널 0
 *    → addTextBlock = 그 칸 안 · 칸 «사진 넣기»(진짜 파일창) → 그 칸 꽉 에셋 · 칸 dragstart = 막힘 · 칸 고른 채 ⌘G(groupSelectedBlocks) = 묶음 0(칸은 트랙 그대로)
 * ── 커밋 3 ──
 * F3 GIF·미리보기 = 칸째 흐름: 칸 1 빨강 사진 · 칸 2 파랑 사진 · 칸 3 빈 칸 → slidePrepare = 칸 셋을 찍은 canvas(빨강·파랑) · slidePlan draw t=0 = 칸 자리(첫 장면)에 빨강·파랑
 *    · ★흐름 t(밀린 거리 100px) 에서 «칸 안 내용까지 같이» 파랑 왼끝이 100 만큼 왼쪽(현빈 Q2 확인 칸) · 안내 줄 «정지 한 장»
 *    (캡처 = grid-step 과 같은 길 — 하네스 electronAPI captureSectionCdp 를 진짜 CDP Page.captureScreenshot 로 잇는다 · grid-step.dom 과 같은 꼴)
 * ── 커밋 4 ──
 * F5 복제(진짜 ⌘D) — 칸·칸 안 글자 id 가 새로 · 사본 칸 안을 지워도 원본 그대로
 * F6 Figma JSON — 프레임 모드 = type frame + 칸마다 children(칸 프레임 · 칸 2 안 글자 블럭이 그 칸 children 에) · 칸 자리 x 늘어남 · images 없음
 *    / 사진 모드는 slide-block.dom M6(images) 가 그대로 잰다
 * ── 커밋 5 ──
 * F4 옛 사진 모드 저장본(빨강·파랑 2장 · 칸 1 폭 40) — 저장→다시 열기→다시 저장 = 저장본 canvas 글자 그대로(변환 0) · 패널 «프레임으로 바꾸기»(진짜 클릭)
 *    → 프레임 칸 2 · 칸마다 그 사진 에셋(칸 꽉) · 칸 1 data-w 40 · data-slides 걷힘 · ⌘Z 한 번 = 사진 모드(사진 2 · 카드 2 · 칸 0)
 * 양성대조(CTL · _patches/slide-frame-CTL1-destructive.patch): renderSlideBlock 의 프레임 갈래 `if (isFrameSlide(block)) {…}` 를 지움(옛 replaceChildren 로 떨어짐) → F0 빨강(값 바꾸자 글자 사라짐) — 예측
 *   slide-frame-CTL6-no-convert.patch(패널 «프레임으로 바꾸기» 배선 삭제) → F4 빨강 — 예측
 *   slide-frame-CTL5-figma-images.patch(Figma 프레임 갈래 조건을 false → 옛 images 갈래) → F6 빨강 — 예측
 *   slide-frame-CTL4-no-frame-prepare.patch(slidePrepare 프레임 갈래 삭제 → 사진 길) → F3 빨강(칸 그림 0) — 예측
 *   slide-frame-CTL2-no-cell-pick.patch(block-drag click 의 _pickSlideCell 줄 삭제) → F2 빨강(프레임 패널·px 손잡이) ·
 *   slide-frame-CTL3-group-cell.patch(⌘G 칸 거르기 줄 삭제) → F2 빨강(칸이 묶음으로 빠짐) — 예측
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, opts) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async (opts) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock(opts);
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.pushHistory?.();   // 놓은 뒤 표본(이 장면의 «처음»)
    return block.id;
  }, opts);
  return { errs, id };
}
const st = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const cells = [...b.querySelectorAll(':scope > .sld-track > .sld-cell')];
  return {
    mode: b.dataset.cellMode || null, cells: cells.length, layouts: cells.map((c) => c.dataset.cellLayout),
    kids: cells.map((c) => [...c.querySelectorAll('.text-block')].map((t) => t.id)),
    text: cells.map((c) => c.textContent.trim()),
    gap: b.querySelector(':scope > .sld-track')?.style.gap || '',
  };
}, id);
async function key(page, k) { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press(k); }

test('F0 ★칸 안 글자 — 값 바꿈·⌘Z·⌘⇧Z·저장 왕복에도 그대로(비파괴 렌더)', async ({ page }) => {
  const { errs, id } = await scene(page, { cellMode: 'frame' });
  const s0 = await st(page, id);
  expect({ mode: s0.mode, cells: s0.cells, layouts: s0.layouts }).toEqual({ mode: 'frame', cells: 3, layouts: ['free', 'free', 'free'] });
  /* 칸 2 에 들어가 진짜 넣기 길(addTextBlock → _insertToFlowFrame B 모드) */
  await page.evaluate((id) => { const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1]; window._activeFrame = cell; window.addTextBlock('body'); }, id);
  const s1 = await st(page, id);
  expect(s1.kids[1].length, '[전제] 칸 2 안에 글자 블럭').toBe(1);
  const tid = s1.kids[1][0];
  /* 패널 값 바꾸기 길 — renderSlideBlock 을 탄다 */
  await page.evaluate((id) => { window._activeFrame = null; window.setSlideLayout(document.getElementById(id), { gap: 30 }); window.pushHistory?.(); }, id);
  const s2 = await st(page, id);
  expect({ cells: s2.cells, kid: s2.kids[1], gap: s2.gap }, '★값 바꿔도 칸 안 글자 «같은 요소» 그대로').toEqual({ cells: 3, kid: [tid], gap: '30px' });
  await key(page, 'Meta+z');
  await expect.poll(async () => (await st(page, id))?.gap, '⌘Z 1 = 간격 전').toBe('16px');
  expect((await st(page, id)).kids[1], '간격만 되돌림 · 글자 있음').toEqual([tid]);
  await key(page, 'Meta+z');
  await expect.poll(async () => (await st(page, id))?.kids[1].length, '⌘Z 2 = 글자 넣기 전').toBe(0);
  expect((await st(page, id)).cells, '칸 3 그대로').toBe(3);
  await key(page, 'Meta+Shift+z');
  await expect.poll(async () => (await st(page, id))?.kids[1], '⌘⇧Z = 글자 다시').toEqual([tid]);
  /* 저장 → 다시 열기 */
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  const s3 = await st(page, id);
  expect({ mode: s3?.mode, cells: s3?.cells, layouts: s3?.layouts, kid: s3?.kids[1] }, '★다시 열어도 칸 2 안 글자').toEqual({ mode: 'frame', cells: 3, layouts: ['free', 'free', 'free'], kid: [tid] });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F0b [음성] 사진 모드 = 옛 렌더 그대로', async ({ page }) => {
  const { errs, id } = await scene(page, {});
  const r = await page.evaluate((id) => { const b = document.getElementById(id); return { mode: b.dataset.cellMode || null, cards: b.querySelectorAll('.sld-card').length, cells: b.querySelectorAll('.sld-cell').length }; }, id);
  expect(r).toEqual({ mode: null, cards: 3, cells: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function menuScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    window.selectSection(c.querySelector('.section-block'));
    const made = window.addSlideBlock();   // 추가 메뉴 onclick 과 같은 입구
    made.block.scrollIntoView({ block: 'center' });
    return made.block.id;
  });
  return { errs, id };
}
const cellIds = (page, id) => page.evaluate((id) => [...document.getElementById(id).querySelectorAll(':scope > .sld-track > .sld-cell')].map((c) => c.id), id);

test('F1 새 블럭 = 프레임 칸 3 · 추가·빼기·순서·폭 · 12 상한 · ⌘Z', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const c0 = await cellIds(page, id);
  expect(c0.length, '★메뉴 새 블럭 = 프레임 칸 3').toBe(3);
  await expect(page.locator('#sld-add-cell'), '[전제] 패널 = 칸 줄').toHaveCount(1);
  await page.click('#sld-add-cell');
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(4);
  await page.click('.sld-cell-row[data-idx="3"] .sld-cell-del');
  await expect.poll(() => cellIds(page, id)).toEqual(c0);
  await page.click('.sld-cell-row[data-idx="0"] .sld-cell-down');
  await expect.poll(() => cellIds(page, id), '↓ = 칸 요소째').toEqual([c0[1], c0[0], c0[2]]);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => cellIds(page, id), '⌘Z = 순서 전').toEqual(c0);
  await page.locator('.sld-cell-row[data-idx="1"] .sld-cw').fill('30'); await page.locator('.sld-cell-row[data-idx="1"] .sld-cw').dispatchEvent('change');
  const w = await page.evaluate((id) => { const b = document.getElementById(id), c = b.querySelectorAll('.sld-cell')[1]; return { dw: c.dataset.w, ratio: c.getBoundingClientRect().width / b.getBoundingClientRect().width }; }, id);
  expect(w.dw).toBe('30');
  expect(Math.abs(w.ratio - 0.3), `칸 2 폭 비 ${w.ratio}`).toBeLessThanOrEqual(0.01);
  for (let i = 3; i < 12; i++) await page.click('#sld-add-cell');
  await expect.poll(() => cellIds(page, id).then((a) => a.length)).toBe(12);
  await expect(page.locator('#sld-add-cell'), '12 상한').toBeDisabled();
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F2 빈 칸 클릭 = 그 칸 고름(슬라이드 패널 · 손잡이 0) → 넣기·사진 넣기 = 그 칸 안 · 칸 끌기·⌘G 막힘', async ({ page }) => {
  const { errs, id } = await menuScene(page);
  const p = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, id);
  await page.mouse.click(p[0], p[1]);
  const pick = await page.evaluate((id) => {
    const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1];
    return { active: window._activeFrame === cell, sel: cell.classList.contains('selected'), row: document.querySelector('.sld-cell-row.active')?.dataset.idx ?? null,
      handles: document.querySelectorAll('.ss-resize-handle, .ss-radius-handle').length, framePanel: !!document.getElementById('ss-align-left') };   // 프레임 패널(prop-frame.js)에만 있는 id
  }, id);
  expect(pick, '★칸 고름 · 슬라이드 패널 그 칸 줄 · 프레임 px 손잡이 0 · 프레임 패널 0').toEqual({ active: true, sel: true, row: '1', handles: 0, framePanel: false });
  await expect(page.locator('#sld-cell-photo')).toHaveText(/칸 2/);
  /* 고른 칸에 넣기 = 그 칸 안(_insertToFlowFrame) */
  await page.evaluate(() => window.addTextBlock('body'));
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').length, id), '★글자 = 칸 2 안').toBe(1);
  /* 칸 «사진 넣기» — 진짜 파일창 */
  const q = await page.evaluate((id) => { const r = document.getElementById(id).querySelectorAll('.sld-cell')[1].getBoundingClientRect(); return [r.left + 8, r.top + 8]; }, id);
  await page.mouse.click(q[0], q[1]);   // 칸 빈 곳(왼위 모서리 · 글자는 가운데에 놓였다) — 칸 고름 + 패널
  await expect(page.locator('#sld-cell-photo')).toHaveCount(1);
  const png = await page.evaluate(() => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = '#ff0000'; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png').split(',')[1]; });
  const [fc] = await Promise.all([page.waitForEvent('filechooser'), page.click('#sld-cell-photo')]);
  await fc.setFiles([{ name: 'r.png', mimeType: 'image/png', buffer: Buffer.from(png, 'base64') }]);
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.asset-block').length, id), '★사진 = 칸 2 안').toBe(1);
  const fill = await page.evaluate((id) => { const c = document.getElementById(id).querySelectorAll('.sld-cell')[1], a = c.querySelector('.asset-block'), r = c.getBoundingClientRect(), q = a.getBoundingClientRect(); return [q.left - r.left, q.top - r.top, q.width / r.width, q.height / r.height].map((v) => Math.round(v * 100) / 100); }, id);
  expect(fill, '칸 꽉(왼위 0 · 폭·높이 1)').toEqual([0, 0, 1, 1]);
  /* 막기 — 칸 자체 끌기 · ⌘G */
  const guard = await page.evaluate((id) => {
    const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1];
    const ev = new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: new DataTransfer() });
    cell.dispatchEvent(ev);
    window.deselectAll(); cell.classList.add('selected'); window.groupSelectedBlocks?.();
    return { dragBlocked: ev.defaultPrevented, parentIsTrack: cell.parentElement?.classList.contains('sld-track'), groups: document.querySelectorAll('#canvas .frame-block[data-group="true"]').length };
  }, id);
  expect(guard, '★칸 끌기 막힘 · ⌘G 로 칸이 안 빠짐').toEqual({ dragBlocked: true, parentIsTrack: true, groups: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function wireCdp(page) {
  const cdp = await page.context().newCDPSession(page);
  await page.exposeFunction('__cdpShot', async ({ x = 0, y = 0, width, height, scale = 1 }) => (await cdp.send('Page.captureScreenshot', {
    format: 'png', clip: { x: Math.round(x), y: Math.round(y), width: Math.ceil(width), height: Math.ceil(height), scale: scale > 0 && scale <= 4 ? scale : 1 },
    captureBeyondViewport: true, fromSurface: true })).data);
  await page.evaluate(() => { const real = window.electronAPI; window.electronAPI = new Proxy({}, { get: (t, k) => (k === 'captureSectionCdp' ? (o) => window.__cdpShot(o) : real[k]) }); });
}

test('F3 GIF·미리보기 — 칸을 찍어 흐름 · 칸 안 내용까지 같이 움직임', async ({ page }) => {
  const { errs, id } = await scene(page, { cellMode: 'frame' });
  await wireCdp(page);
  await page.evaluate(async (id) => {
    const b = document.getElementById(id), cells = b.querySelectorAll('.sld-cell');
    cells.forEach((c) => { c.dataset.w = '30'; });
    window.renderSlideBlock(b);
    const fill = (cell, color) => {
      const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = color; x.fillRect(0, 0, 40, 30);
      window._activeFrame = cell; const had = new Set(cell.querySelectorAll('.asset-block'));
      window.addAssetBlock(null, { imgSrc: cv.toDataURL('image/png') });
      const ab = [...cell.querySelectorAll('.asset-block')].find((a) => !had.has(a));
      Object.assign(ab.style, { left: '0px', top: '0px', width: '100%', height: '100%' });
    };
    fill(cells[0], '#ff0000'); fill(cells[1], '#0000ff'); window._activeFrame = null;
    b.scrollIntoView({ block: 'center' });
  }, id);
  await page.waitForFunction((id) => [...document.getElementById(id).querySelectorAll('.sld-cell .asset-block img')].filter((i) => i.complete && i.naturalWidth > 0).length >= 2, id);   // 칸 사진 둘이 떴다(조건 대기)
  const r = await page.evaluate(async (id) => {
    const b = document.getElementById(id), cells = [...b.querySelectorAll('.sld-cell')];
    const imgs = await window.slidePrepare(b);
    const mid = (cv) => cv ? Array.from(cv.getContext('2d').getImageData(Math.floor(cv.width / 2), Math.floor(cv.height / 2), 1, 1).data).slice(0, 3) : null;
    const W = b.offsetWidth, H = b.offsetHeight, br = b.getBoundingClientRect(), k = br.width / W;
    const cx = cells.map((c) => { const q = c.getBoundingClientRect(); return [(q.left - br.left) / k, q.width / k]; });
    const gap = parseFloat(b.querySelector('.sld-track').style.gap) || 0, period = cx.reduce((a, [, w]) => a + w + gap, 0);
    const shot = (t) => { const cv = document.createElement('canvas'); cv.width = W; cv.height = H; const ctx = cv.getContext('2d'); window.slidePlan(b).draw(ctx, W, H, null, t); return ctx; };
    const at = (ctx, x) => Array.from(ctx.getImageData(Math.round(x), Math.round(H / 2), 1, 1).data).slice(0, 3);
    const blueLeft = (ctx) => { const d = ctx.getImageData(0, Math.round(H / 2), W, 1).data; for (let x = 0; x < W; x++) { const i = x * 4; if (d[i + 2] > 200 && d[i] < 60 && d[i + 1] < 60) return x; } return -1; };
    const c0 = shot(0), shift = 100, c1 = shot(shift / period);
    return { n: imgs.length, err: b._sldImgs?.err ?? null, m0: mid(imgs[0]), m1: mid(imgs[1]),
      red0: at(c0, cx[0][0] + cx[0][1] / 2), blue0: at(c0, cx[1][0] + cx[1][1] / 2), bl0: blueLeft(c0), bl1: blueLeft(c1), info: window.slidePlan(b).info };
  }, id);
  expect({ n: r.n, err: r.err }, '[전제] 칸 셋을 찍음').toEqual({ n: 3, err: null });
  expect([r.m0, r.m1], '★찍은 칸 = 칸 안 사진 색').toEqual([[255, 0, 0], [0, 0, 255]]);
  expect([r.red0, r.blue0], '★t=0 = 첫 장면 칸 자리').toEqual([[255, 0, 0], [0, 0, 255]]);
  expect(Math.abs((r.bl0 - r.bl1) - 100), `★칸 안 내용까지 같이 흐름(파랑 왼끝 ${r.bl0} → ${r.bl1})`).toBeLessThanOrEqual(2);
  expect(r.info).toContain('정지 한 장');
  expect(errs, errs.join(' | ')).toEqual([]);
});

async function withText(page) {
  const { errs, id } = await menuScene(page);
  await page.evaluate((id) => { const cell = document.getElementById(id).querySelectorAll('.sld-cell')[1]; window._activeFrame = cell; window.addTextBlock('body'); window._activeFrame = null; }, id);
  return { errs, id };
}

test('F5 복제(⌘D) — 칸·글자 id 새로 · 사본을 지워도 원본 그대로', async ({ page }) => {
  const { errs, id } = await withText(page);
  const ids0 = await page.evaluate((id) => { const b = document.getElementById(id); return [...b.querySelectorAll('.sld-cell, .text-block')].map((e) => e.id); }, id);
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+d');
  await expect.poll(() => page.locator('#canvas .slide-block').count(), '[전제] 사본').toBe(2);
  const r = await page.evaluate(({ id, ids0 }) => {
    const copy = [...document.querySelectorAll('#canvas .slide-block')].find((b) => b.id !== id);
    const ids1 = [...copy.querySelectorAll('.sld-cell, .text-block')].map((e) => e.id);
    const all = [...document.querySelectorAll('#canvas [id]')].map((e) => e.id), dup = all.filter((x, i) => x && all.indexOf(x) !== i);
    copy.querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').forEach((t) => (t.closest('.frame-block[data-text-frame]') || t).remove());
    return { mode: copy.dataset.cellMode, cells: copy.querySelectorAll('.sld-cell').length, overlap: ids1.filter((x) => ids0.includes(x)), dup, origText: document.getElementById(id).querySelectorAll('.sld-cell')[1].querySelectorAll('.text-block').length };
  }, { id, ids0 });
  expect(r, '★사본 = 프레임 칸 3 · 원본과 겹치는 id 0 · 문서 안 겹침 0 · 사본 지워도 원본 글자 그대로').toEqual({ mode: 'frame', cells: 3, overlap: [], dup: [], origText: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F6 Figma — 프레임 모드 = frame + 칸 children(칸 안 글자까지) · images 없음', async ({ page }) => {
  const { errs, id } = await withText(page);
  const r = await page.evaluate((id) => {
    let node = null; const walk = (o) => { if (node || !o || typeof o !== 'object') return; if (o.id === id) { node = o; return; } Object.values(o).forEach(walk); };
    walk(window.buildFigmaExportJSON?.(null));
    if (!node) return { why: '노드 없음' };
    const kids = node.children || [];
    const hasText = (o) => !!o && typeof o === 'object' && (o.type === 'text' || Object.values(o).some(hasText));
    return { type: node.type, images: Array.isArray(node.images), n: kids.length, xsUp: kids.every((k, i) => i === 0 || k.x > kids[i - 1].x), kidTypes: kids.map((k) => k.block?.type), textIn: kids.map((k) => hasText(k.block)), w0: kids[0]?.w > 0 };
  }, id);
  expect(r, `★Figma 프레임 칸 — ${JSON.stringify(r)}`).toEqual({ type: 'frame', images: false, n: 3, xsUp: true, kidTypes: ['frame', 'frame', 'frame'], textIn: [false, true, false], w0: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('F4 옛 사진 모드 — 다시 열어도 글자 그대로 · «프레임으로 바꾸기»(누를 때만) · ⌘Z 한 번 = 사진 모드', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const id = await page.evaluate(async () => {
    const mk = (c) => { const cv = document.createElement('canvas'); cv.width = 40; cv.height = 30; const x = cv.getContext('2d'); x.fillStyle = c; x.fillRect(0, 0, 40, 30); return cv.toDataURL('image/png'); };
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const sec = c.querySelector('.section-block'); window.selectSection(sec);
    const { row, block } = window.makeSlideBlock({ slides: [{ src: mk('#ff0000'), w: 40 }, { src: mk('#0000ff') }] });   // 옛 사진 모드(표식 없음)
    (sec.querySelector('.section-inner') || sec).appendChild(row); window.bindBlock?.(block);
    window.pushHistory?.();
    return block.id;
  });
  /* 저장본 바이트 = serializeProject 의 페이지 canvas 글자 — 저장 → 다시 열기 → 다시 저장해도 같아야(열 때 변환 0) */
  const saved = () => page.evaluate(() => { window.flushCurrentPage?.(); const d = JSON.parse(window.serializeProject()); return d.pages.map((p) => p.canvas).join('\n'); });
  const bytes0 = await saved();
  await page.evaluate(() => { const d = JSON.parse(window.serializeProject()); document.getElementById('canvas').innerHTML = ''; window.applyProjectData(d); });
  expect(await saved(), '★다시 열어도 저장본 글자 그대로(옛 사진 블럭 변환 0)').toBe(bytes0);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.sld-card').length, id), '첫 장면 = 옛 사진 카드').toBe(2);
  await page.evaluate((id) => window.selectBlock(id), id);
  await page.click('#sld-to-frame');
  const f = await page.evaluate((id) => {
    const b = document.getElementById(id), cells = [...b.querySelectorAll(':scope > .sld-track > .sld-cell')];
    return { mode: b.dataset.cellMode || null, slides: b.dataset.slides ?? null, cards: b.querySelectorAll('.sld-card').length, n: cells.length, w0: cells[0]?.dataset.w ?? null,
      imgs: cells.map((c) => (c.querySelector('.asset-block')?.dataset.imgSrc || '').slice(0, 22)),
      fill: cells.map((c) => { const a = c.querySelector('.asset-block'); if (!a) return null; const r = c.getBoundingClientRect(), q = a.getBoundingClientRect(); return [Math.round(q.width / r.width * 100) / 100, Math.round(q.height / r.height * 100) / 100]; }) };
  }, id);
  expect(f, '★프레임 칸 2 · 칸마다 그 사진 · 칸 1 폭 40 · data-slides 걷힘').toEqual({ mode: 'frame', slides: null, cards: 0, n: 2, w0: '40', imgs: ['data:image/png;base64,', 'data:image/png;base64,'], fill: [[1, 1], [1, 1]] });
  await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); return { mode: b.dataset.cellMode || null, n: JSON.parse(b.dataset.slides || '[]').length, cards: b.querySelectorAll('.sld-card').length, cells: b.querySelectorAll('.sld-cell').length }; }, id),
    '★⌘Z 한 번 = 사진 모드').toEqual({ mode: null, n: 2, cards: 2, cells: 0 });
  expect(errs, errs.join(' | ')).toEqual([]);
});
