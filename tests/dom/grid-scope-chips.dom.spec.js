/* grid-scope-chips.dom.spec.js — 그리드 패널 ⑥ 스코프칩 v1(현빈 Q3 · right-panel-unify U1 · ULTRAPLAN §4-1)
 *   + GRID-PANEL-EMPTY-TYPOGRAPHY-TITLE-ONLY-01 · prop-hint ≤2 · 틀(data-sec) 이관.
 *
 * v1 = 열 때 선택에서 스코프를 추론해 칩만 켠다(절은 전부 보임) · 칩을 누르면 그 스코프 줄·절만 보인다 · 같은 칩을 다시 누르면 풀린다.
 *   필터는 그리드 패널 안 임시(블럭별 메모리) — 다시 그려도(updateGridBlock) 유지, 명시적 null 재선택이면 풀린다.
 * 양성대조(되돌리면 빨강):
 *   S1 ← prop-grid.js scopeChipsHTML 호출에서 disabled: !_scopeOk[scope] 를 false 로 → 글줄 칩 disabled 단언 빨강.
 *   S2 ← _inferred 를 'block' 고정 → 줄 고른 상태 current=line 단언 빨강.
 *   S3 ← _grdApplyScopeFilter 본문을 비우면 → 「다른 스코프 줄 숨김」 단언 빨강.
 *   S4 ← showGridProperties 의 `if (addrArg === null) _grdScopeFilter.delete(block)` 를 지우면 → 재선택 뒤 필터 남음 빨강.
 *   S5 ← _grdTypoParts 의 `if (!hit) return { typo: '', fill: '' }` 를 옛 「Typography 제목만」 절로 되돌리면 빨강.
 *   S6 ← 지운 힌트 하나(예: 「행/열 사이 간격(px)」)를 되살리면 줄 선택 상태 prop-hint 3 → 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { rows = 2, cols = 2 } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(({ rows, cols }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="kS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="kR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>');
    const L = (t) => [{ type: 'body', text: t }, { type: 'image' }];
    const { block: g } = window.makeGridBlock({ cols: Array.from({ length: cols }, (_, i) => ({ width: 1, lines: L('칸' + i) })), rows: Array.from({ length: rows }, () => ({ height: 'auto' })) });
    g.id = 'kG'; document.getElementById('kR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.applyZoom?.(100);
  }, { rows, cols });
  return errs;
}
const open = (page, addr) => page.evaluate((addr) => window.showGridProperties(document.getElementById('kG'), addr), addr);
const chips = (page) => page.evaluate(() => [...document.querySelectorAll('#grd-scope-chips button[data-scope]')].map(b => ({
  id: b.id, scope: b.dataset.scope, active: b.classList.contains('active'), pressed: b.getAttribute('aria-pressed'), current: b.getAttribute('aria-current') === 'true', disabled: b.disabled, title: b.title || '',
})));
const shown = (page, sel) => page.evaluate((sel) => { const el = document.querySelector(sel); return !!el && !!el.offsetParent; }, sel);
/* ★기대 바뀜(Q1 · Q2 · 현빈 GO 261120) — 묶음 몸(size·layout·padding) · Type 띠도 절이다(겉 직속만 보면 Layout 이 안 잡힌다). 보임 = 자기와 묶음 겉이 다 보일 때 */
const secShown = (page) => page.evaluate(() => Object.fromEntries([...document.querySelectorAll('#panel-right .panel-body .prop-section[data-sec]')].map(s => [s.dataset.sec, s.style.display !== 'none' && s.closest('.prop-sec-group')?.style.display !== 'none'])));

test('S1 블럭만 고른 상태 — 칩 넷 · 추론 = 블록(aria-current · 눌림 아님) · 글줄 칩 disabled + 까닭 title · 걸러 보기 없음', async ({ page }) => {
  const errs = await scene(page);
  await open(page, null);
  const c = await chips(page);
  expect(c.map(x => x.id)).toEqual(['grd-scope-block', 'grd-scope-col', 'grd-scope-row', 'grd-scope-line']);
  expect(c.find(x => x.scope === 'block'), '★추론은 «지금 것»(current)이지 «눌림»이 아니다(M3)').toMatchObject({ current: true, active: false, pressed: 'false', disabled: false });
  expect(c.filter(x => x.pressed === 'true' || x.active), '★필터 없을 때 눌린 칩 0').toEqual([]);
  expect(c.find(x => x.scope === 'line')).toMatchObject({ current: false, pressed: 'false', disabled: true });
  expect(c.find(x => x.scope === 'line').title, '★disabled 까닭').toMatch(/캔버스/);
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter ?? null), '열 때는 걸러 보지 않는다(v1)').toBe(null);
  expect(Object.values(await secShown(page)).every(Boolean), '열 때 절은 전부 보인다').toBe(true);
  expect(errs).toEqual([]);
});

test('S1b 1행 1열 그리드 — 행 칩 disabled + 까닭 title · 열 칩은 켜짐(가로 정렬 · 모든 열은 1열에도 있다)', async ({ page }) => {
  const errs = await scene(page, { rows: 1, cols: 1 });
  await open(page, null);
  const c = await chips(page);
  expect(c.find(x => x.scope === 'row')).toMatchObject({ disabled: true });
  expect(c.find(x => x.scope === 'row').title, '★행 칩 disabled 까닭').toMatch(/1행/);
  expect(c.find(x => x.scope === 'col').disabled).toBe(false);
  expect(errs).toEqual([]);
});

test('S2 줄을 고른 상태 — 추론 active=글줄 · 글줄 칩 켜짐', async ({ page }) => {
  const errs = await scene(page);
  await open(page, { r: 0, c: 0, li: 0 });
  const c = await chips(page);
  expect(c.find(x => x.scope === 'line')).toMatchObject({ current: true, pressed: 'false', disabled: false });
  expect(c.find(x => x.scope === 'block').current).toBe(false);
  expect(errs).toEqual([]);
});

test('S3 칩 누르기 = 그 스코프만 보기 · 다시 누르면 풀림 · disabled 칩은 아무 일 없음', async ({ page }) => {
  const errs = await scene(page);
  await open(page, null);
  expect(await shown(page, '#grd-valign-group'), '[전제] 세로 정렬(블록) 보임').toBe(true);
  await page.click('#grd-scope-col');
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter)).toBe('col');
  expect(await shown(page, '#grd-col-ratio'), '열 = 비율 보임').toBe(true);
  expect(await shown(page, '#grd-halign-group'), '열 = 가로 정렬 · 모든 열 보임').toBe(true);
  expect(await shown(page, '#grd-valign-group'), '★블록 줄(세로 정렬 · 블록)은 숨김').toBe(false);
  expect(await shown(page, '#grd-border-w-slider'), '★블록 절(Stroke)은 숨김').toBe(false);
  const s = await secShown(page);
  expect(s.layout, 'Layout 절은 남는다').toBe(true);
  expect(s.stroke, '★열 줄이 없는 절은 절째 숨김').toBe(false);
  expect((await chips(page)).find(x => x.scope === 'col'), '걸러 보는 칩 = 눌림').toMatchObject({ active: true, pressed: 'true' });
  expect((await chips(page)).find(x => x.scope === 'block'), '추론 칩은 current 로 남는다').toMatchObject({ current: true, pressed: 'false' });
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('grd-scope-chips')).backgroundColor), '★걸러 보는 중 = 그룹 배경(data-filter)').not.toBe('rgba(0, 0, 0, 0)');
  await page.click('#grd-scope-row');
  expect(await shown(page, '#grd-rowh-toggle'), '행 = 행 높이 보임').toBe(true);
  expect(await shown(page, '#grd-col-ratio'), '행 = 비율 숨김').toBe(false);
  await page.click('#grd-scope-row');
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter ?? null), '같은 칩 다시 = 풀림').toBe(null);
  expect(Object.values(await secShown(page)).every(Boolean)).toBe(true);
  await page.locator('#grd-scope-line').click({ force: true });
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter ?? null), 'disabled 글줄 칩 = 무반응').toBe(null);
  expect(errs).toEqual([]);
});

test('S4 걸러 보기는 다시 그려도 유지(updateGridBlock) · 명시적 null 재선택이면 풀림', async ({ page }) => {
  const errs = await scene(page);
  await open(page, null);
  await page.click('#grd-scope-col');
  await page.evaluate(() => window.updateGridBlock('kG', { colGap: 30 }));
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips')?.dataset.filter ?? null), '★다시 그려도 유지').toBe('col');
  await open(page, null);
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter ?? null), '★재선택 = 풀림').toBe(null);
  expect(errs).toEqual([]);
});

test('S5 GRID-PANEL-EMPTY-TYPOGRAPHY-TITLE-ONLY-01 — 블럭만 고르면 Typography 절 없음(빈 제목 머리 0) · 글자 줄을 고르면 있음', async ({ page }) => {
  const errs = await scene(page);
  await open(page, null);
  const r = await page.evaluate(() => ({
    sec: !!document.querySelector('#panel-right .panel-body > [data-sec="typography"]'),
    bare: [...document.querySelectorAll('#panel-right .panel-body .prop-section')].filter(s => s.querySelector(':scope > .prop-section-title')?.textContent.trim() === 'Typography' && s.querySelectorAll('input,select,button').length === 0).length,
  }));
  expect(r, '★빈 Typography 머리').toEqual({ sec: false, bare: 0 });
  await open(page, { r: 0, c: 0, li: 0 });
  expect(await page.evaluate(() => !!document.querySelector('#panel-right .panel-body > [data-sec="typography"] #grd-typo-size-number')), '글자 줄 = Typography 절 안 크기 칸').toBe(true);
  expect(errs).toEqual([]);
});

test('S6 prop-hint ≤ 2 · 라벨과 같은 title 0 — 블럭·글자 줄·그림 줄·빈 칸 상태 전부', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => window.updateGridBlock('kG', { patchCell: { r: 1, c: 1, lines: [] } }));
  const out = {};
  for (const [n, a] of [['block', null], ['text', { r: 0, c: 0, li: 0 }], ['image', { r: 0, c: 0, li: 1 }], ['empty', { r: 1, c: 1, li: null }]]) {
    await open(page, a);
    out[n] = await page.evaluate(() => {
      const body = document.querySelector('#panel-right .panel-body');
      return {
        hints: body.querySelectorAll('.prop-hint').length,
        dupTitle: [...body.querySelectorAll('.prop-label[title]')].filter(l => l.title.trim() === l.textContent.trim()).map(l => l.title),
      };
    });
  }
  /* L2 — 양성대조가 «설 수 있는» 상태: 글자 줄은 이미 2(요약 + 「줄이면 잘린…」) ⇒ 지운 힌트 하나를 되살리면 3 → 빨강. */
  expect(out.text.hints, '[전제] 글자 줄 상태 = 힌트 2(꽉 참)').toBe(2);
  for (const [n, r] of Object.entries(out)) {
    expect(r.hints, `★${n}: prop-hint ${r.hints} > 2`).toBeLessThanOrEqual(2);
    expect(r.dupTitle, `★${n}: 라벨을 되풀이하는 title`).toEqual([]);
  }
  expect(errs).toEqual([]);
});

/* S7 ★소유 제외는 «그릇» 단위다(U0b OWNERSHIP_EXEMPT_SCOPES · #grd-cell-body/#grd-line-body/#grd-rule-body) — 같은 컨트롤이 하위 접기 «밖»이면 빨강.
 *   양성대조 그 자체: 칸 여백 줄(#grd-cell-padding)을 몸통 밖(Content 절 몸 바로 아래)으로 옮기면 judgePanel 이 「소유 위반: grd-cell-padding」을 낸다.
 *   (이 단언이 빨강이면 = 제외가 id/접두 전역으로 새고 있다.) */
const { loadSectionSpec, readPanel, judgePanel } = require('./_panel-sections.js');
test('S7 ★하위 접기 안 = 제외 · 밖으로 옮기면 소유 위반(그릇 단위 제외의 양성대조)', async ({ page }) => {
  const errs = await scene(page);
  const SPEC = loadSectionSpec();
  await open(page, { r: 0, c: 0, li: 0 });
  const inside = judgePanel(await readPanel(page), SPEC).filter(v => /grd-cell-(padding|radius|bg)\b/.test(v));
  expect(inside, '[전제] #grd-cell-body 안의 칸 여백·모서리·배경은 판정 밖').toEqual([]);
  await page.evaluate(() => {
    const row = document.getElementById('grd-cell-padding').closest('.prop-row');
    document.querySelector('#panel-right .panel-body > [data-sec="content"] > .prop-sec-body').appendChild(row);
  });
  const outside = judgePanel(await readPanel(page), SPEC);
  expect(outside.join(' | '), '★몸통 밖으로 나온 칸 여백을 못 잡는다 — 제외가 그릇이 아니라 전역이다').toContain('소유 위반: grd-cell-padding');
  expect(errs).toEqual([]);
});

/* S8 ★칩 필터 × 고른 것 전수 — 페이지 에러 0 (U5 평가자 교차 지적: 조건부 마크업을 null 가드 없이 찾는 배선은 «기본 아닌 상태»에서만 죽는다).
 *   고른 것 7: 블럭 · 블럭(배경 켬 = Effects 절) · 글자 줄 · 그림 줄 · 원 그림 줄(원 효과) · 빈 칸 · 중첩(두 칸) 안 줄 — 열/행 «개별 선택»은 모델에 없어 칩 필터(col/row)로 덮는다.
 *   필터 5: 없음 · 블록 · 열 · 행 · 글줄(켜진 칩만 누른다 · disabled 는 건너뜀을 센다). 각 판 뒤 updateGridBlock 으로 한 번 더 그려 «필터가 걸린 채 재배선»도 지난다.
 *   양성대조: prop-grid.js 의 `document.getElementById('grd-nest-outer-btn')?.addEventListener` 에서 `?.` 를 `.` 로 바꾸면
 *     중첩 아닌 상태 전부에서 TypeError → 이 시험 빨강(errs ≠ []). */
test('S8 ★칩 필터 5 × 고른 것 7 — 페이지 에러 0 · 판마다 패널이 섰다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="kS" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="row" id="kR" data-layout="stack"></div></div></div>');
    const { block: g } = window.makeGridBlock({ cols: [
      { width: 1, lines: [{ type: 'body', text: 'T' }, { type: 'image' }, { type: 'duo', cols: [{ width: 1, lines: [{ type: 'body', text: 'IN-A' }] }, { width: 1, lines: [{ type: 'body', text: 'IN-B' }] }] }, { type: 'image', imgShape: 'circle' }] },
      { width: 1, lines: [] },
    ], rows: [{ height: 'auto' }, { height: 'auto' }] });
    g.id = 'kG'; document.getElementById('kR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g);
  });
  const KINDS = [['block', null], ['blockBg', null], ['text', { r: 0, c: 0, li: 0 }], ['image', { r: 0, c: 0, li: 1 }], ['circle', { r: 0, c: 0, li: 3 }],
                 ['empty', { r: 0, c: 1, li: null }], ['nested', { r: 0, c: 0, li: 2, np: '0.0' }]];
  const ran = [];
  for (const [kind, addr] of KINDS) {
    await page.evaluate((on) => window.updateGridBlock('kG', { blockBg: { on } }), kind === 'blockBg');
    for (const filter of [null, 'block', 'col', 'row', 'line']) {
      await open(page, addr);
      if (filter) {
        const ok = await page.evaluate((f) => { const b = document.getElementById('grd-scope-' + f); return !!b && !b.disabled; }, filter);
        if (!ok) { ran.push(`${kind}×${filter}:skip(disabled)`); continue; }
        await page.click('#grd-scope-' + filter);
      }
      await page.evaluate(() => window.updateGridBlock('kG', { colGap: 20 + Math.floor(Math.random() * 10) }));   // 필터 걸린 채 다시 그리기·배선
      expect(await page.evaluate(() => !!document.querySelector('#panel-right .panel-body > .prop-section[data-sec]')), `${kind}×${filter}: 패널`).toBe(true);
      ran.push(`${kind}×${filter}`);
    }
  }
  expect(ran.filter(r => !r.endsWith('skip(disabled)')).length, '[전제] 판 수(켜진 칩만)').toBeGreaterThanOrEqual(25);
  expect(errs, `★페이지 에러 — 판: ${ran.join(', ')}`).toEqual([]);
});

/* S9 M3 — 추론 스코프가 바뀌면 필터가 풀린다(블록 필터 중 글줄을 고르면 블록 필터가 남아 글줄 절을 숨기던 것). 양성대조: _grdScopeFilter 의 at 비교를 지우면 빨강. */
test('S9 필터는 «건 때의 추론»에 묶인다 — 블록 필터 중 글자 줄을 고르면 풀림 · 같은 추론의 재그리기는 유지', async ({ page }) => {
  const errs = await scene(page);
  await open(page, null);
  await page.click('#grd-scope-block');
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter)).toBe('block');
  await page.evaluate(() => window.updateGridBlock('kG', { colGap: 28 }));
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter), '같은 추론 = 유지').toBe('block');
  await open(page, { r: 0, c: 0, li: 0 });
  expect(await page.evaluate(() => document.getElementById('grd-scope-chips').dataset.filter ?? null), '★추론이 글줄로 바뀌면 풀림').toBe(null);
  expect(await shown(page, '#grd-line-summary'), '글줄 요약이 보인다').toBe(true);
  expect(errs).toEqual([]);
});
