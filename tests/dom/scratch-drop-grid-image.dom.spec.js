/* scratch-drop-grid-image.dom.spec.js — G8 (현빈 2026-10-03 「그리드에 넣은 에셋블럭에 스크래치패드를 드래그앤드랍 해도 안 들어간다」)
 * 앱 통째로 헤드리스(bootApp) — 진짜 마우스로 스크래치 항목을 «같은 자리 위 잠깐 머물렀다» 놓는다(ARM_DELAY_MS).
 * ★그리드 칸의 «이미지»는 asset-block 이 아니라 그리드 줄(line.type==='image') — DOM 은 div.grd-img-frame[data-r][data-c][data-line].
 *   정본은 dataset 모델이라 updateGridBlock{patchCell:{lineIndex,imgSrc}} 문으로만 넣는다(DOM 만 바꾸면 다음 렌더에 날아간다).
 * ★양성대조 판 = 604602cd (GD1001_ROOT) → 빨강이어야 할 것: G1 G2 G3 G4. C0(섹션 안 에셋 교체)은 지키는 시험(양쪽 초록).
 * ⛔못 재는 축: 저장 «파일» 자체(electronAPI 가짜) — 저장 왕복은 직렬화 문자열로만 잰다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const NEW = 'data:image/svg+xml;base64,' + Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#c03030"/></svg>').toString('base64');

const SEC = `
<div class="section-block" id="sG" data-section="1" data-name="G" data-bg="#ffffff" style="background-color:#ffffff;">
  <div class="section-hitzone"><span class="section-label">G</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gG1" style="height:30px;"></div>
    <div class="row" id="rowA"><div class="asset-block has-image" id="abA" data-img-src="${PX}" style="height:160px;"><div class="asset-img-clip"><img class="asset-img" src="${PX}" draggable="false"></div></div></div>
    <div class="gap-block" data-type="gap" id="gG2" style="height:30px;"></div>
    <div id="gridHost"></div>
    <div class="gap-block" data-type="gap" id="gG3" style="height:200px;"></div>
  </div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  await bootApp(page);
  await page.evaluate(async ({ html, PX }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', html);
    const m = await import('/js/blocks/grid-block.js');
    const { block } = m.makeGridBlock({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }] });
    document.getElementById('gridHost').appendChild(block);
    m.updateGridBlock(block.id, { rows: [{ height: 'auto' }] });
    // 칸0 = 그림이 든 이미지 줄, 칸1 = 빈 이미지 슬롯
    let r = m.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lines: [{ type: 'image', imgSrc: PX, height: 160 }] } });
    if (!r.ok) throw new Error(r.message);
    r = m.updateGridBlock(block.id, { patchCell: { r: 0, c: 1, lines: [{ type: 'image', height: 160 }] } });
    if (!r.ok) throw new Error(r.message);
    window.__gid = block.id;
    window.rebindAll?.(); window.deselectAll?.(); document.getElementById('sG').scrollIntoView({ block: 'start' });
  }, { html: SEC, PX });
  await page.waitForTimeout(300);
  await page.evaluate((u) => window._scratchAddAndSaveFx(u, 20, 20, 200), NEW);
  await page.waitForTimeout(300);
  /* ⌘Z 의 «돌아갈 자리» — 실제 앱엔 프로젝트 로드·이전 편집이 쌓여 있다. 이 하네스는 빈 스택이라 직접 한 칸 깐다. */
  await page.evaluate(() => window.pushHistory('기준'));
}
const model = (page) => page.evaluate(async () => { const m = await import('/js/blocks/grid-block.js'); const g = m.getGridModel(document.getElementById(window.__gid)); return g.cells.map(r => r.map(cl => cl.lines.map(l => ({ type: l.type, imgSrc: l.imgSrc || '' })))); });
const state = (page) => page.evaluate(() => ({
  scratch: document.querySelectorAll('.scratch-item').length,
  ab: document.querySelectorAll('#sG .asset-block').length,
  abSrc: document.getElementById('abA')?.dataset.imgSrc || '',
  secBg: document.getElementById('sG').dataset.bgImage || document.getElementById('sG').style.backgroundImage || '',
  gridImgs: [...document.querySelectorAll('#sG .grid-block .grd-img-frame')].map(f => ({ c: f.dataset.c, empty: f.classList.contains('grd-img-empty') })),
}));
/* 스크래치 마지막 항목을 «목표 요소 한가운데»로 끌어 머문 뒤 놓는다 */
async function dragScratchTo(page, sel) {
  const tgt = await page.evaluate((s) => { const el = document.querySelector(s); el.scrollIntoView({ block: 'center' }); const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, sel);
  const item = await page.evaluate(() => { const els = [...document.querySelectorAll('.scratch-item')]; const el = els[els.length - 1]; const r = el.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(item[0], item[1]); await page.mouse.down();
  for (let i = 1; i <= 12; i++) await page.mouse.move(item[0] + (tgt[0] - item[0]) * i / 12, item[1] + (tgt[1] - item[1]) * i / 12);
  await page.waitForTimeout(700);
  await page.mouse.move(tgt[0] + 1, tgt[1] + 1);
  await page.waitForTimeout(100);
  const guide = await page.evaluate(() => document.querySelector('.sp2c-badge')?.textContent || '');
  await page.mouse.up();
  await page.waitForTimeout(400);
  return guide;
}

test('C0 대조 — 섹션 안 에셋에 놓으면 그 에셋 이미지로 교체(그대로)', async ({ page }) => {
  await setup(page);
  const s0 = await state(page);
  await dragScratchTo(page, '#abA');
  const s1 = await state(page);
  expect(s1.abSrc).toBe(NEW);
  expect(s1.scratch).toBe(s0.scratch - 1);
  expect(s1.ab).toBe(s0.ab);
});

test('G1 ★그림이 든 그리드 칸 이미지에 놓으면 그 칸 이미지가 바뀐다(모델이 정본) — 배경·새 블럭 아님, 스크래치 소비', async ({ page }) => {
  await setup(page);
  const s0 = await state(page);
  const guide = await dragScratchTo(page, '#sG .grid-block .grd-img-frame[data-c="0"]');
  const s1 = await state(page);
  const m = await model(page);
  expect(m[0][0][0].imgSrc).toBe(NEW);
  expect(m[0][1][0].imgSrc).toBe('');   // 옆 칸은 그대로
  expect(s1.ab).toBe(s0.ab);            // 새 에셋블럭 안 생김
  expect(s1.secBg).toBe(s0.secBg);      // 섹션 배경 안 바뀜
  expect(s1.scratch).toBe(s0.scratch - 1);
  expect(guide).toContain('이미지');
});

test('G2 ★빈 이미지 슬롯에 놓으면 그 슬롯이 채워진다', async ({ page }) => {
  await setup(page);
  await dragScratchTo(page, '#sG .grid-block .grd-img-frame[data-c="1"]');
  const m = await model(page);
  expect(m[0][1][0].imgSrc).toBe(NEW);
  expect(m[0][0][0].imgSrc).toBe(PX);
});

test('G3 ★다음 렌더에도 남는다(DOM 만 바꾼 게 아니다) + 직렬화에 실린다', async ({ page }) => {
  await setup(page);
  await dragScratchTo(page, '#sG .grid-block .grd-img-frame[data-c="0"]');
  const r = await page.evaluate(async (NEWV) => {
    const m = await import('/js/blocks/grid-block.js');
    const b = document.getElementById(window.__gid);
    m.renderGridBlock(b);
    const afterRender = b.querySelector('.grd-img-frame[data-c="0"] img')?.src;
    const ser = JSON.stringify(window.getSerializedCanvas());
    return { afterRender, inSer: ser.includes(NEWV.slice(-40)) };
  }, NEW);
  expect(r.afterRender).toBe(NEW);
  expect(r.inSer).toBe(true);
});

test('G4 ★⌘Z 한 걸음 — 칸 이미지가 되돌아오고 스크래치 항목이 되살아난다', async ({ page }) => {
  await setup(page);
  const s0 = await state(page);
  await dragScratchTo(page, '#sG .grid-block .grd-img-frame[data-c="0"]');
  expect((await model(page))[0][0][0].imgSrc, '전제 — 놓기가 먼저 먹었어야 ⌘Z 를 잰다').toBe(NEW);
  await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(500);
  const m = await model(page);
  const s1 = await state(page);
  expect(m[0][0][0].imgSrc).toBe(PX);
  expect(s1.scratch).toBe(s0.scratch);
});

const svgN = (n) => 'data:image/svg+xml;base64,' + Buffer.from(`<svg xmlns="http://www.w3.org/2000/svg" width="200" height="120"><rect width="200" height="120" fill="#${(n * 1234567 % 0xffffff).toString(16).padStart(6, '0')}"/><text x="10" y="60">img${n}</text></svg>`).toString('base64');

test('G5 ★서로 다른 그림 10장을 같은 칸에 10번 — 매번 먹고(간헐 0), ⌘Z 10번이 한 걸음씩 거꾸로 간다', async ({ page }) => {
  /* 고정 대기(300·350ms ×10)를 «상태 조건 대기»로 바꿨다 — 이 시험은 기본 30s 예산에 22.7s 를 써서(고정 대기만 6.5s) 부하가 오르면 예산째 넘어갔다.
   * 조건 = 칸0 모델의 imgSrc(정본)·스크래치 항목 수. ⌘Z 는 «눌렀더니 imgSrc 가 바뀔 때까지» 기다린 뒤 «정확히 seq[k]» 를 단언한다 → 두 걸음 가면 빨강, 안 가면 5s 뒤 빨강.
   * 놓기의 dwell(700ms, ARM_DELAY)과 mouseup 뒤 400ms 는 제품 시간·공용 도우미 몫이라 그대로 둔다. */
  await setup(page);
  const cell0 = async () => (await model(page))[0][0][0].imgSrc;
  const scratchN = async () => (await state(page)).scratch;
  const seq = [PX];
  for (let n = 1; n <= 10; n++) {
    const u = svgN(n);
    const n0 = await scratchN();
    await page.evaluate((u) => window._scratchAddAndSaveFx(u, 20, 20, 200), u);
    await expect.poll(scratchN, { message: `넣기 ${n}번째 전제 — 새 스크래치 항목이 생겼어야 끌 수 있다`, timeout: 5000 }).toBe(n0 + 1);
    // 방금 넣은 항목이 «마지막» — 이전 항목은 이미 소비됐다
    const before = await state(page);
    await dragScratchTo(page, '#sG .grid-block .grd-img-frame[data-c="0"]');
    await expect.poll(cell0, { message: `넣기 ${n}번째 — 칸 이미지가 그 그림이어야`, timeout: 5000 }).toBe(u);
    await expect.poll(scratchN, { message: `넣기 ${n}번째 — 스크래치 소비`, timeout: 5000 }).toBe(before.scratch - 1);
    seq.push(u);
  }
  expect(await cell0(), '전제 — ⌘Z 를 재기 전, 칸은 마지막 그림이어야').toBe(seq[10]);
  for (let k = 9; k >= 0; k--) {
    const was = await cell0();
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z');
    await expect.poll(cell0, { message: `⌘Z ${10 - k}번째 — 칸 이미지가 «바뀌어야»(안 먹으면 여기서 빨강)`, timeout: 5000 }).not.toBe(was);
    expect(await cell0(), `⌘Z ${10 - k}번째 — 정확히 한 걸음 거꾸로`).toBe(seq[k]);
  }
});
