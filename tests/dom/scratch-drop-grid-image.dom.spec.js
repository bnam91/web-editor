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

/* ★160(G5-SPEC-TIMEOUT-MARGIN-THIN-01 · 지디 판정 261028) — 옛 G5(넣기 10 · ⌘Z 10 · 한 시험)는 30s 예산에 24.5~25.5s(인텔 저부하 ×3 · 판 7f3c6de2)
   ⇒ 여유 4.5~5.5s. «10» 은 QA «10번 중 5번»(66eba2e0)에서 온 «시행 수» ⇒ 5+5 로 쪼개도 시행 총 10 은 지킨다.
   잃는 것 둘은 이름으로 갈음한다: ⑴ «같은 칸 연속 10 번 누적» → 아래 A10(225) · ⑵ «⌘Z 10 걸음 사슬» → 아래 G5c(넣기 대신 모델 문 patchCell). */
async function dropSeq(page, from, to) {
  const cell0 = async () => (await model(page))[0][0][0].imgSrc;
  const scratchN = async () => (await state(page)).scratch;
  const seq = [await cell0()];
  for (let n = from; n <= to; n++) {
    const u = svgN(n);
    const n0 = await scratchN();
    await page.evaluate((u) => window._scratchAddAndSaveFx(u, 20, 20, 200), u);
    await expect.poll(scratchN, { message: `넣기 ${n}번째 전제 — 새 스크래치 항목`, timeout: 5000 }).toBe(n0 + 1);
    const before = await state(page);
    await dragScratchTo(page, '#sG .grid-block .grd-img-frame[data-c="0"]');
    await expect.poll(cell0, { message: `넣기 ${n}번째 — 칸 이미지가 그 그림이어야`, timeout: 5000 }).toBe(u);
    await expect.poll(scratchN, { message: `넣기 ${n}번째 — 스크래치 소비`, timeout: 5000 }).toBe(before.scratch - 1);
    seq.push(u);
  }
  return { seq, cell0 };
}
async function undoSeq(page, seq, cell0, tag) {
  for (let k = seq.length - 2; k >= 0; k--) {
    const was = await cell0();
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z');
    await expect.poll(cell0, { message: `${tag} ⌘Z ${seq.length - 1 - k}번째 — 칸 이미지가 «바뀌어야»`, timeout: 5000 }).not.toBe(was);
    expect(await cell0(), `${tag} ⌘Z ${seq.length - 1 - k}번째 — 정확히 한 걸음 거꾸로`).toBe(seq[k]);
  }
}
test('G5a ★서로 다른 그림 5장을 같은 칸에 5번(1~5) — 매번 먹고, ⌘Z 5번이 한 걸음씩 거꾸로', async ({ page }) => {
  await setup(page);
  const { seq, cell0 } = await dropSeq(page, 1, 5);
  expect(await cell0(), '전제 — ⌘Z 전 마지막 그림').toBe(seq[5]);
  await undoSeq(page, seq, cell0, 'G5a');
});
test('G5b ★서로 다른 그림 5장을 같은 칸에 5번(6~10) — 매번 먹고, ⌘Z 5번이 한 걸음씩 거꾸로', async ({ page }) => {
  await setup(page);
  const { seq, cell0 } = await dropSeq(page, 6, 10);
  expect(await cell0(), '전제 — ⌘Z 전 마지막 그림').toBe(seq[5]);
  await undoSeq(page, seq, cell0, 'G5b');
});
test('G5c ★⌘Z 10 걸음 사슬 — 모델 문(patchCell)으로 칸 그림을 10번 바꾸고 ⌘Z 10번이 정확히 한 걸음씩(옛 G5 ⑵ 지킴)', async ({ page }) => {
  await setup(page);
  const cell0 = async () => (await model(page))[0][0][0].imgSrc;
  const seq = [await cell0()];
  for (let n = 1; n <= 10; n++) {
    const u = svgN(n);
    const r = await page.evaluate(async (u) => {
      const m = await import('/js/blocks/grid-block.js');
      const res = m.updateGridBlock(window.__gid, { patchCell: { r: 0, c: 0, lineIndex: 0, imgSrc: u } });
      window.pushHistory(`G5c ${u.slice(-8)}`);   // 앱 편집 한 번 = 히스토리 한 칸(넣기 길과 같은 꼴)
      return res && res.ok;
    }, u);
    expect(r, `patchCell ${n}번째 ok`).toBe(true);
    expect(await cell0(), `patchCell ${n}번째 — 칸이 그 그림`).toBe(u);
    seq.push(u);
  }
  await undoSeq(page, seq, cell0, 'G5c');
});

/* ★225(지디 판정 261028 · 160 쪼개기의 짝) — «같은 칸 연속 10 번 누적» 자: 칸 하나 · 넣기 10 · 부팅 1 · ⌘Z 없음.
   fillCells 는 단언하지 않고 걸음마다 { n, cell, ok, why } 를 돌려준다 — 양성대조(일부러 더럽힘)가 «그 걸음에서 잡히나» 를 같은 함수로 잰다. */
async function fillCells(page, cellsOf, { dirtyAt = 0, stopOnFail = false } = {}) {
  const out = [];
  for (let n = 1; n <= 10; n++) {
    const c = cellsOf(n), u = svgN(100 + n);
    if (n === dirtyAt) {   // ★양성대조 — 그 칸의 이미지 줄을 «본문 줄» 로 바꿔 더럽힌다(놓을 자리가 없어짐)
      await page.evaluate(async (c) => { const m = await import('/js/blocks/grid-block.js');
        m.updateGridBlock(window.__gid, { patchCell: { r: 0, c, lines: [{ type: 'body', text: '더럽힘' }] } }); }, c);
    }
    const n0 = (await state(page)).scratch;
    await page.evaluate((u) => window._scratchAddAndSaveFx(u, 20, 20, 200), u);
    await expect.poll(async () => (await state(page)).scratch, { timeout: 5000 }).toBe(n0 + 1);
    const sel = `#sG .grid-block .grd-img-frame[data-c="${c}"]`;
    const has = await page.evaluate((s) => !!document.querySelector(s), sel);
    if (has) await dragScratchTo(page, sel);
    let got = null;
    try {
      await expect.poll(async () => (await model(page))[0][c][0]?.imgSrc ?? null, { timeout: 4000 }).toBe(u);
      got = u;
    } catch { got = (await model(page))[0][c][0]?.imgSrc ?? null; }
    out.push({ n, cell: c, ok: got === u, why: has ? (got === u ? '' : '칸 그림이 그 그림이 아님') : '놓을 이미지 칸이 없음' });
    if (stopOnFail && got !== u) break;   // ★양성대조는 «처음 잡힌 걸음» 이 몫 — 뒤 걸음마다 4s 기다려 30s 예산에 닿던 것(실측 29.2s)을 막는다
  }
  return out;
}
test('A10 ★225 누적 — 같은 칸에 넣기 10 번(부팅 1 · ⌘Z 없음) 전부 먹는다', async ({ page }) => {
  test.setTimeout(90000);   // 10 번이 이 자의 값이라 일을 못 줄인다(걸음당 제품 대기 1.1s 포함 ≈2.4s). 부하 여유는 예산으로 준다
  await setup(page);
  const r = await fillCells(page, () => 0);
  console.log('[A10]', JSON.stringify(r.map((x) => [x.n, x.ok])));
  expect(r.filter((x) => !x.ok).map((x) => `${x.n}:${x.why}`), '같은 칸 연속 넣기 중 안 먹은 걸음').toEqual([]);
});
test('A10P ★양성대조 — 6 번째 앞에서 칸을 일부러 더럽히면 «6 번째부터» 빨강으로 잡힌다(1~5 는 초록)', async ({ page }) => {
  await setup(page);
  const r = await fillCells(page, () => 0, { dirtyAt: 6, stopOnFail: true });
  console.log('[A10P]', JSON.stringify(r.map((x) => [x.n, x.ok])));
  expect(r.slice(0, 5).every((x) => x.ok), '전제: 1~5 는 먹었다').toBe(true);
  expect([r.length, r[5].ok], '★6 번째(더럽힌 걸음)에서 자가 잡고 멈춘다').toEqual([6, false]);
});
test('A10N 음성대조 — 다른 칸(칸0·칸1 번갈아) 열 번은 초록', async ({ page }) => {
  test.setTimeout(90000);   // A10 과 같은 까닭
  await setup(page);
  const r = await fillCells(page, (n) => (n % 2 ? 0 : 1));
  console.log('[A10N]', JSON.stringify(r.map((x) => [x.n, x.cell, x.ok])));
  expect(r.filter((x) => !x.ok).map((x) => `${x.n}@${x.cell}:${x.why}`)).toEqual([]);
});
