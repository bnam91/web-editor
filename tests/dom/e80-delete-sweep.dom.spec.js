/* e80-delete-sweep.dom.spec.js — E80 «같은 꼴 훑기»: editor.js deleteSelectedFromCanvas 의 삭제 갈래마다
 *   «글자 편집(앞 표본만 찍는 조작) → 그 삭제 → ⌘Z 한 번 → 편집이 남나».
 * 장면: S1 = 편집할 글자 eT(지우지 않는다) · S2 = 갈래별 지울 대상 · S3 = 다중 섹션용.
 * 각 갈래는 «삭제 직후 꼭대기 이름»으로 그 갈래를 탔는지 먼저 단언한다(이름이 다르면 빨강 = 장면이 틀렸다).
 * 결과(남음/사라짐)는 단언하지 않고 [SWEEP] 줄로만 남긴다 — 고침 범위 표의 재료(판정은 지디).
 *   E80_SWEEP_EXPECT='K1=남음,K2=사라짐…' 을 주면 그 값으로 단언한다(양성·음성대조 판에서 쓴다).
 * 양성대조: K1 블록 삭제(앞 체크포인트 있음) = «남음».
 * 음성대조: 블록 삭제 갈래 앞 체크포인트(editor.js `window.ensureHistoryCheckpoint?.('삭제 전');` — 블록 갈래 쪽)를 뺀 사본을 GD1001_ROOT 로 → K1 «사라짐». */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

const EXPECT = Object.fromEntries((process.env.E80_SWEEP_EXPECT || '').split(',').filter(Boolean).map(kv => kv.split('=')));

async function scene(page, build) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((build) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const sec = (id) => `<div class="section-block" id="${id}" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="${id}I">
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="${id}R" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`;
    c.insertAdjacentHTML('beforeend', sec('S1') + sec('S2') + sec('S3'));
    const TX = (id, s) => { const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = id; tb.querySelector('[class^="tb-"]').textContent = s; return tf; };
    document.getElementById('S1R').appendChild(TX('eT', '편집글'));
    (new Function('TX', build))(TX);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100); window.applyPageSettings?.(); window.clearHistory?.();
  }, build);
  await page.waitForTimeout(300);
  return errs;
}
const pt = (page, sel, where = 'center') => page.evaluate(([sel, where]) => {
  const e = document.querySelector(sel); if (!e) return null; e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect();
  return where === 'corner' ? [q.right - 6, q.top + 6] : where === 'edge' ? [q.left + 6, q.top + 6] : where === 'end' ? [q.right - 4, q.top + q.height / 2] : [q.left + q.width / 2, q.top + q.height / 2];
}, [sel, where]);
async function editT(page) {
  const p = await pt(page, '#eT [class^="tb-"]', 'end');
  for (let n = 0; n < 3 && !(await page.evaluate(() => !!document.querySelector('#eT [contenteditable="true"]'))); n++) { await page.mouse.dblclick(p[0], p[1]); await page.waitForTimeout(150); }
  expect(await page.evaluate(() => !!document.querySelector('#eT [contenteditable="true"]')), '전제 — eT 글자 편집 중').toBe(true);
  await page.keyboard.press('End'); await page.keyboard.type('EDIT');
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); }); await page.waitForTimeout(200);
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').textContent)).toBe('편집글EDIT');
}
async function run(page, key, branch, wantTop, select) {
  await editT(page);
  await select();
  const sel = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected, #canvas .group-selected, #canvas .row-active')].map(e => (e.id || e.className.split(' ')[0]) + (e.classList.contains('row-active') ? '(row-active)' : '')));
  await page.evaluate(() => document.activeElement?.blur?.());
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); await page.waitForTimeout(150); }, `${key} ${branch}`, { soft: true });
  const t = await page.evaluate(() => document.querySelector('#eT [class^="tb-"]')?.textContent ?? null);
  const kept = t === '편집글EDIT' ? '남음' : '사라짐';
  console.log(`[SWEEP] ${key} | ${branch} | sel=${JSON.stringify(sel)} | top=${r.topAction} | dPos=${r.dPos} | ⌘Z뒤 eT=${JSON.stringify(t)} → ${kept}`);
  expect(r.topAction, `${key}: 삭제 직후 꼭대기 = 그 갈래 이름(장면 확인)`).toBe(wantTop);
  if (EXPECT[key]) expect(kept, `${key} 기대`).toBe(EXPECT[key]);
}

test('K1 블록 삭제(:3396 앞 체크포인트 있음 · 양성대조)', async ({ page }) => {
  await scene(page, `document.getElementById('S2R').appendChild(TX('xB', '지울 블럭'));`);
  await run(page, 'K1', '블록 삭제', '블록 삭제', async () => { const p = await pt(page, '#xB', 'edge'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200); });
});

test('K2 서브섹션 삭제(:3368 · 프레임 혼자 · E80)', async ({ page }) => {
  await scene(page, `const f = window.makeFrameBlock({ fullWidth: true }); f.id = 'xF'; f.style.minHeight = '100px'; f.style.padding = '20px'; f.appendChild(TX('xFT', '프레임 안')); document.getElementById('S2R').appendChild(f);`);
  await run(page, 'K2', '서브섹션 삭제', '서브섹션 삭제', async () => {
    for (let n = 0; n < 3; n++) { const p = await pt(page, '#xF', 'corner'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200); if (await page.evaluate(() => document.getElementById('xF').classList.contains('selected'))) break; }
  });
});

test('K3 프레임 삭제(:3334 · 옛 group-block — 불러온 문서에만 산다)', async ({ page }) => {
  await scene(page, `const g = document.createElement('div'); g.className = 'group-block'; g.id = 'xG'; g.style.minHeight = '80px';
    const gi = document.createElement('div'); gi.className = 'group-inner'; gi.appendChild(TX('xGT', '그룹 안')); g.appendChild(gi); document.getElementById('S2R').appendChild(g);
    if (typeof window.bindGroupDrag === 'function') window.bindGroupDrag(g); else g.dataset.noBind = '1';`);
  test.skip(await page.evaluate(() => !!document.getElementById('xG').dataset.noBind), 'window.bindGroupDrag 없음 — 장면 못 세움');
  await run(page, 'K3', '프레임 삭제', '프레임 삭제', async () => { const p = await pt(page, '#xG .group-inner'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200); });
});

test('K4 섹션 삭제(단일 · :3548)', async ({ page }) => {
  await scene(page, `document.getElementById('S2R').appendChild(TX('xS', 'S2 글'));`);
  await run(page, 'K4', '섹션 삭제(단일)', '섹션 삭제', async () => { const p = await pt(page, '#S2', 'edge'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200); });
});

test('K5 섹션 다중 삭제(:3311/:3318 · ⌘클릭 둘)', async ({ page }) => {
  await scene(page, ``);
  await run(page, 'K5', '섹션 삭제(다중)', '섹션 삭제', async () => {
    let p = await pt(page, '#S2', 'edge'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(150);
    p = await pt(page, '#S3', 'edge'); await page.keyboard.down('Meta'); await page.mouse.click(p[0], p[1]); await page.keyboard.up('Meta'); await page.waitForTimeout(200);
    expect(await page.evaluate(() => window.multiSel?.sections?.size), '전제 — 섹션 둘 다중 선택').toBe(2);
  });
});

/* 여러 열 행 = 옛 꼴(.row[data-layout=flex] > .col × N) — 새 프리셋은 더 안 만든다(block-factory.js makePresetRow 머리말), 불러온 문서에만 산다(save-load.js:914 보존). */
const COLS = `const r = document.getElementById('S2R'); r.dataset.layout = 'flex'; r.dataset.ratioStr = '1*1';
  r.innerHTML = '<div class="col" id="xC1" data-flex="1" style="flex:1;min-height:120px"></div><div class="col" id="xC2" data-flex="1" style="flex:1;min-height:120px"></div>';
  document.getElementById('xC1').appendChild(TX('xCT', '열 글'));`;

test('K6 행 삭제(:3511 · row-active)', async ({ page }) => {
  await scene(page, COLS);
  await run(page, 'K6', '행 삭제', '행 삭제', async () => { const p = await pt(page, '#xC2'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200);
    expect(await page.evaluate(() => document.getElementById('S2R').classList.contains('row-active')), '전제 — 행 활성').toBe(true); });
});

test('K7 열 삭제(:3295 · ⌘클릭 열 둘)', async ({ page }) => {
  await scene(page, COLS);
  await run(page, 'K7', '열 삭제', '열 삭제', async () => {
    for (const id of ['xC1', 'xC2']) {   // ⌘클릭 둘(열 빈 자리 — 아래쪽)
      const p = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + q.width / 2, id === 'xC1' ? q.bottom - 8 : q.top + q.height / 2]; }, id);
      await page.keyboard.down('Meta'); await page.mouse.click(p[0], p[1]); await page.keyboard.up('Meta'); await page.waitForTimeout(150);
    }
    expect(await page.evaluate(() => window.multiSel?.cols?.size), '전제 — 열 둘 다중 선택').toBe(2);
  });
});

test('K8 그리드 줄 삭제(:3240 → updateGridBlock 앞 표본)', async ({ page }) => {
  await scene(page, `const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '줄A' }, { type: 'body', text: '줄B' }] }] }); g.id = 'xGr'; document.getElementById('S2R').appendChild(g); window.renderGridBlock(g);`);
  await run(page, 'K8', '그리드 줄 삭제', '그리드 수정', async () => {
    let p = await pt(page, '#xGr'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200);
    p = await pt(page, '#xGr .grd-line, #xGr [data-li="1"]'); if (p) { await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200); }
    const a = await page.evaluate(() => window.grdGetActiveLine?.(document.getElementById('xGr')));
    expect(a && a.li !== null && a.li !== undefined, `전제 — 활성 줄 ${JSON.stringify(a)}`).toBe(true);
  });
});

test('K9 말풍선 줄 삭제(:3217 lnDeleteActiveLine → updateSpeechBubbleBlock 앞 표본)', async ({ page }) => {
  await scene(page, ``);
  await page.evaluate(() => { window.selectSection(document.getElementById('S2')); window.addSpeechBubbleBlock('left'); const b = [...document.querySelectorAll('#S2 .speech-bubble-block')].pop(); b.id = 'xBb';
    window.updateSpeechBubbleBlock('xBb', { lines: [{ type: 'body', text: '첫 줄' }, { type: 'body', text: '둘째 줄' }] }); window.deselectAll?.(); window.applyPageSettings?.(); window.clearHistory?.(); });
  await run(page, 'K9', '말풍선 줄 삭제', '블럭 수정', async () => {
    let p = await pt(page, '#xBb .tb-bubble'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(150);
    p = await pt(page, '#xBb .ln-row[data-ln="1"]'); await page.mouse.click(p[0], p[1]); await page.waitForTimeout(200);
  });
});
