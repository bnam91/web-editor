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
/* ★좌표 클릭은 전부 clickAt — 누르기 «직전» 맞힌 요소를 찍고 기대와 다르면 빨강(_click-at.js · 지디 하네스 규율).
   2026-10-04 integ14 전수에서 K7 이 «전제 — 열 둘 다중 선택 Expected 2 · Received 0» 으로 한 번 빨갰는데 맞힌 요소가 안 찍혀 까닭을 못 갈랐다.
   ⇒ 이제 빗나가면 「clickAt K7 ⌘xC1: (x,y) 맞힌 요소 «…» 가 기대 … 와 다르다」로 «이름으로» 찍힌다.
   기대 선택자는 `[id="…"]` 꼴 — 헬퍼의 `#id` 꼴은 «맞힌 요소 자체»의 id 를 요구해 자식(글자 등)을 맞히면 빨강이 된다. 여기선 «그 안»이면 된다.
   ★클릭 뒤 고정 대기 → «상태를 기다리는 자»(waitForState). ⌘클릭은 keyboard.down('Meta') 로 쥔 채 clickAt(헬퍼는 page.mouse.click 을 쓴다 — 쥔 Meta 가 실린다). */
const { clickAt } = require('./_click-at.js');
const waitState = (page, fn, arg, label) => page.waitForFunction(fn, arg, { timeout: 3000 }).catch(() => { throw new Error(`상태 기다림 시간초과 — ${label}`); });
const ANY_SEL = () => !!document.querySelector('#canvas .selected, #canvas .group-selected, #canvas .row-active');

/* ★기본값 = 고친 판 기대(integ13 · 팀리드 판정 — 이 파일은 dev 회귀): env 가 없으면 K1~K9 모두 «남음»을 단언한다.
   측정용 덮어쓰기: E80_SWEEP_EXPECT='K2=사라짐,…'(옛 판) · E80_SWEEP_EXPECT=none(결과 단언 끔 — 기록만).
   E90 점검: 이 파일이 단언하는 갈래 이름(K1~K9)에 범용 라벨 「작업」은 없다 — 블록 삭제 · 서브섹션 삭제 · 프레임 삭제 · 섹션 삭제 · 행 삭제 · 열 삭제 · 그리드 수정 · 블럭 수정. */
const _EXP_DEFAULT = 'K1=남음,K2=남음,K3=남음,K4=남음,K5=남음,K6=남음,K7=남음,K8=남음,K9=남음';
const _EXP_SRC = process.env.E80_SWEEP_EXPECT === 'none' ? '' : (process.env.E80_SWEEP_EXPECT || _EXP_DEFAULT);
const EXPECT = Object.fromEntries(_EXP_SRC.split(',').filter(Boolean).map(kv => kv.split('=')));

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
/* ★좌표는 «자리가 멈춘 뒤»에 잰다(2026-10-04 clickAt 판 실측: ×8 에서 빗나간 6 번이 전부 «gb_…(갭 블럭)·canvas-wrap» 을 맞혔다 —
   scrollIntoView 직후 레이아웃·스크롤이 덜 멈춘 좌표). 사각형이 interval 간격으로 «두 번 연속 같을 때»까지 기다린다(_root-harness waitStableRect 와 같은 자).
   끝내 안 멈추면 마지막 값을 쓰고, 빗나가면 clickAt 이 «맞힌 요소»를 찍는다. */
const pt = async (page, sel, where = 'center') => {
  /* ★첫 판(2026-10-04 20:26) 실측: 기다리는 동안 다른 비동기 스크롤(배율 가운데 맞추기 등)이 캔버스를 되돌려 y 가 −1689 로 «화면 밖에서» 멈췄다.
     ⇒ 매 번 «화면 안인가»를 보고, 밖이면 다시 scrollIntoView 한다. «화면 안 + 두 번 연속 같음»일 때만 돌려준다. */
  const once = () => page.evaluate(([sel, where]) => {
    const e = document.querySelector(sel); if (!e) return null; let q = e.getBoundingClientRect();
    const inView = (r) => r.top >= 0 && r.bottom <= window.innerHeight && r.left >= 0 && r.right <= window.innerWidth;
    if (!inView(q)) { e.scrollIntoView({ block: 'center' }); q = e.getBoundingClientRect(); }
    const p = where === 'corner' ? [q.right - 6, q.top + 6] : where === 'edge' ? [q.left + 6, q.top + 6] : where === 'end' ? [q.right - 4, q.top + q.height / 2] : [q.left + q.width / 2, q.top + q.height / 2];
    return { p, inView: p[1] >= 0 && p[1] <= window.innerHeight && p[0] >= 0 && p[0] <= window.innerWidth };
  }, [sel, where]);
  let prev = await once(); if (!prev) return null;
  for (let i = 0; i < 30; i++) { await page.waitForTimeout(100); const cur = await once(); if (!cur) return null;
    if (cur.inView && prev.inView && cur.p[0] === prev.p[0] && cur.p[1] === prev.p[1]) return cur.p; prev = cur; }
  return prev.p;
};
async function editT(page) {
  const p = await pt(page, '#eT [class^="tb-"]', 'end');
  /* 재시도 3번은 남긴다 — 더블클릭이 첫 판에 «고르기»만 하고 편집에 안 들어가는 일이 있어 생긴 고리다(원 작성자의 고리 · 까닭 미측정). 대기만 상태로 바꿨다. */
  for (let n = 0; n < 3 && !(await page.evaluate(() => !!document.querySelector('#eT [contenteditable="true"]'))); n++) {
    await clickAt(page, p[0], p[1], { sel: '[id="eT"]' }, { label: '편집 더블클릭 eT', dbl: true });
    await page.waitForFunction(() => !!document.querySelector('#eT [contenteditable="true"]'), null, { timeout: 600 }).catch(() => {});
  }
  expect(await page.evaluate(() => !!document.querySelector('#eT [contenteditable="true"]')), '전제 — eT 글자 편집 중').toBe(true);
  await page.keyboard.press('End'); await page.keyboard.type('EDIT');
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); });
  await waitState(page, () => !document.querySelector('#eT [contenteditable="true"]'), null, '편집 끝(contenteditable 풀림)');
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
  await run(page, 'K1', '블록 삭제', '블록 삭제', async () => { const p = await pt(page, '#xB', 'edge'); await clickAt(page, p[0], p[1], { sel: '[id="xB"]' }, { label: 'K1 xB' }); await waitState(page, ANY_SEL, null, 'K1 고름'); });
});

test('K2 서브섹션 삭제(:3368 · 프레임 혼자 · E80)', async ({ page }) => {
  await scene(page, `const f = window.makeFrameBlock({ fullWidth: true }); f.id = 'xF'; f.style.minHeight = '100px'; f.style.padding = '20px'; f.appendChild(TX('xFT', '프레임 안')); document.getElementById('S2R').appendChild(f);`);
  await run(page, 'K2', '서브섹션 삭제', '서브섹션 삭제', async () => {
    /* 재시도 3번은 남긴다(원 작성자의 고리 — 모서리 첫 클릭이 프레임을 못 고르는 일이 있었다 · 까닭 미측정). 대기만 상태로. */
    for (let n = 0; n < 3; n++) { const p = await pt(page, '#xF', 'corner'); await clickAt(page, p[0], p[1], { sel: '[id="xF"]', not: '[id="xFT"]' }, { label: `K2 xF 모서리 #${n + 1}` });
      await page.waitForFunction(() => document.getElementById('xF').classList.contains('selected'), null, { timeout: 600 }).catch(() => {});
      if (await page.evaluate(() => document.getElementById('xF').classList.contains('selected'))) break; }
  });
});

test('K3 프레임 삭제(:3334 · 옛 group-block — 불러온 문서에만 산다)', async ({ page }) => {
  await scene(page, `const g = document.createElement('div'); g.className = 'group-block'; g.id = 'xG'; g.style.minHeight = '80px';
    const gi = document.createElement('div'); gi.className = 'group-inner'; gi.appendChild(TX('xGT', '그룹 안')); g.appendChild(gi); document.getElementById('S2R').appendChild(g);
    if (typeof window.bindGroupDrag === 'function') window.bindGroupDrag(g); else g.dataset.noBind = '1';`);
  test.skip(await page.evaluate(() => !!document.getElementById('xG').dataset.noBind), 'window.bindGroupDrag 없음 — 장면 못 세움');
  await run(page, 'K3', '프레임 삭제', '프레임 삭제', async () => { const p = await pt(page, '#xG .group-inner'); await clickAt(page, p[0], p[1], { sel: '[id="xG"]' }, { label: 'K3 xG' }); await waitState(page, ANY_SEL, null, 'K3 고름'); });
});

test('K4 섹션 삭제(단일 · :3548)', async ({ page }) => {
  await scene(page, `document.getElementById('S2R').appendChild(TX('xS', 'S2 글'));`);
  await run(page, 'K4', '섹션 삭제(단일)', '섹션 삭제', async () => { const p = await pt(page, '#S2', 'edge'); await clickAt(page, p[0], p[1], { sel: '[id="S2"]' }, { label: 'K4 S2' }); await waitState(page, ANY_SEL, null, 'K4 고름'); });
});

test('K5 섹션 다중 삭제(:3311/:3318 · ⌘클릭 둘)', async ({ page }) => {
  await scene(page, ``);
  await run(page, 'K5', '섹션 삭제(다중)', '섹션 삭제', async () => {
    let p = await pt(page, '#S2', 'edge'); await clickAt(page, p[0], p[1], { sel: '[id="S2"]' }, { label: 'K5 S2' }); await waitState(page, ANY_SEL, null, 'K5 S2 고름');
    p = await pt(page, '#S3', 'edge'); await page.keyboard.down('Meta');
    try { await clickAt(page, p[0], p[1], { sel: '[id="S3"]' }, { label: 'K5 ⌘S3' }); } finally { await page.keyboard.up('Meta'); }
    await page.waitForFunction(() => window.multiSel?.sections?.size === 2, null, { timeout: 3000 }).catch(() => {});   // 못 기다리면 아래 «전제» 단언이 값을 찍는다
    expect(await page.evaluate(() => window.multiSel?.sections?.size), '전제 — 섹션 둘 다중 선택').toBe(2);
  });
});

/* 여러 열 행 = 옛 꼴(.row[data-layout=flex] > .col × N) — 새 프리셋은 더 안 만든다(block-factory.js makePresetRow 머리말), 불러온 문서에만 산다(save-load.js:914 보존). */
const COLS = `const r = document.getElementById('S2R'); r.dataset.layout = 'flex'; r.dataset.ratioStr = '1*1';
  r.innerHTML = '<div class="col" id="xC1" data-flex="1" style="flex:1;min-height:120px"></div><div class="col" id="xC2" data-flex="1" style="flex:1;min-height:120px"></div>';
  document.getElementById('xC1').appendChild(TX('xCT', '열 글'));`;

test('K6 행 삭제(:3511 · row-active)', async ({ page }) => {
  await scene(page, COLS);
  await run(page, 'K6', '행 삭제', '행 삭제', async () => { const p = await pt(page, '#xC2'); await clickAt(page, p[0], p[1], { sel: '[id="xC2"]' }, { label: 'K6 xC2' });
    await page.waitForFunction(() => document.getElementById('S2R').classList.contains('row-active'), null, { timeout: 3000 }).catch(() => {});
    expect(await page.evaluate(() => document.getElementById('S2R').classList.contains('row-active')), '전제 — 행 활성').toBe(true); });
});

test('K7 열 삭제(:3295 · ⌘클릭 열 둘)', async ({ page }) => {
  await scene(page, COLS);
  await run(page, 'K7', '열 삭제', '열 삭제', async () => {
    for (const id of ['xC1', 'xC2']) {   // ⌘클릭 둘(열 빈 자리 — 아래쪽)
      /* xC1 은 «아래쪽 빈 자리»(글자 블럭을 피함) — 멈춘 사각형에서 잰다 */
      await pt(page, '#' + id);
      const p = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left + q.width / 2, id === 'xC1' ? q.bottom - 8 : q.top + q.height / 2]; }, id);
      const want = (await page.evaluate(() => window.multiSel?.cols?.size || 0)) + 1;
      await page.keyboard.down('Meta');
      try { await clickAt(page, p[0], p[1], { sel: `[id="${id}"]`, not: '.text-block' }, { label: `K7 ⌘${id}` }); } finally { await page.keyboard.up('Meta'); }
      await page.waitForFunction((n) => (window.multiSel?.cols?.size || 0) >= n, want, { timeout: 3000 }).catch(() => {});   // 못 기다리면 아래 «전제» 단언이 값을 찍는다
    }
    expect(await page.evaluate(() => window.multiSel?.cols?.size), '전제 — 열 둘 다중 선택').toBe(2);
  });
});

test('K8 그리드 줄 삭제(:3240 → updateGridBlock 앞 표본)', async ({ page }) => {
  await scene(page, `const { block: g } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '줄A' }, { type: 'body', text: '줄B' }] }] }); g.id = 'xGr'; document.getElementById('S2R').appendChild(g); window.renderGridBlock(g);`);
  await run(page, 'K8', '그리드 줄 삭제', '그리드 수정', async () => {
    let p = await pt(page, '#xGr'); await clickAt(page, p[0], p[1], { sel: '[id="xGr"]' }, { label: 'K8 xGr' }); await waitState(page, ANY_SEL, null, 'K8 그리드 고름');
    p = await pt(page, '#xGr .grd-line, #xGr [data-li="1"]');
    if (p) { await clickAt(page, p[0], p[1], { sel: '[id="xGr"] .grd-line, [id="xGr"] [data-li="1"]' }, { label: 'K8 줄' });
      await page.waitForFunction(() => { const a = window.grdGetActiveLine?.(document.getElementById('xGr')); return !!a && a.li !== null && a.li !== undefined; }, null, { timeout: 3000 }).catch(() => {}); }
    const a = await page.evaluate(() => window.grdGetActiveLine?.(document.getElementById('xGr')));
    expect(a && a.li !== null && a.li !== undefined, `전제 — 활성 줄 ${JSON.stringify(a)}`).toBe(true);
  });
});

test('K9 말풍선 줄 삭제(:3217 lnDeleteActiveLine → updateSpeechBubbleBlock 앞 표본)', async ({ page }) => {
  await scene(page, ``);
  await page.evaluate(() => { window.selectSection(document.getElementById('S2')); window.addSpeechBubbleBlock('left'); const b = [...document.querySelectorAll('#S2 .speech-bubble-block')].pop(); b.id = 'xBb';
    window.updateSpeechBubbleBlock('xBb', { lines: [{ type: 'body', text: '첫 줄' }, { type: 'body', text: '둘째 줄' }] }); window.deselectAll?.(); window.applyPageSettings?.(); window.clearHistory?.(); });
  await run(page, 'K9', '말풍선 줄 삭제', '블럭 수정', async () => {
    let p = await pt(page, '#xBb .tb-bubble'); await clickAt(page, p[0], p[1], { sel: '[id="xBb"] .tb-bubble' }, { label: 'K9 말풍선' }); await waitState(page, ANY_SEL, null, 'K9 말풍선 고름');
    p = await pt(page, '#xBb .ln-row[data-ln="1"]'); await clickAt(page, p[0], p[1], { sel: '[id="xBb"] .ln-row[data-ln="1"]' }, { label: 'K9 둘째 줄' });
    /* 말풍선 줄 활성 = grdGetActiveLine(블럭)(js/blocks/line-host.js:134·229 가 말풍선·챗에도 같은 함수를 쓴다 — code-read). */
    await page.waitForFunction(() => { const a = window.grdGetActiveLine?.(document.getElementById('xBb')); return !!a && a.li === 1; }, null, { timeout: 3000 }).catch(() => {});
  });
});
