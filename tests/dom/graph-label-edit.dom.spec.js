/* graph-label-edit.dom.spec.js — K8⒤ 그래프 카테고리 라벨 캔버스 직접 편집 (태양 lane-f-graph 2026-10-05)
 * 현빈 K8: 카테고리 라벨을 캔버스에서 더블클릭해 바로 고친다. 저장 자리 = dataset.items[i].label 한 곳(패널 .grb-data-label-input 과 같은 키).
 * 고침: drag-utils renderGraph — 블럭 dblclick 위임(색인 = 블럭 안 카테고리 라벨 순서) → contenteditable(plaintext-only) · Enter/blur 확정 · Esc 취소 · 빈 글자 무변
 *   · css/editor-graph.css 한 줄(.grb-line-overlay .grb-line-xlabel pointer-events:auto — 꺾은선 라벨층이 클릭을 흘려보내던 것).
 * ★사용자 자리에서 «진짜» 더블클릭: _click-at.js clickAt(x,y,{sel},{dbl:true}) — 누르기 직전 elementFromPoint 가 그 라벨이어야 한다(합성 이벤트 ⛔).
 * 선택도 실클릭(블럭 클릭 → 패널). ⌘Z 는 키보드.
 * 양성대조: d1f642ff 나무 안 → E1~E4 · H-line 빨강 · X1 X2 초록 (predict: $S/fg/predict.md).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-label-edit.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const LABEL_SEL = { 'bar-v': '.grb-bar-label', 'bar-pair': '.grb-bar-label', 'bar-h': '.grb-bar-h-desc', 'line': '.grb-line-xlabel' };

async function setup(page, chartType) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate((chartType) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const S = document.getElementById('sG'); window.selectSection(S); window.addGraphBlock({ chartType });
    const g = [...document.querySelectorAll('#sG .graph-block')].pop();
    window.deselectAll?.(); return g.id;
  }, chartType);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return { errs, id };
}
const centre = (page, id, sel, i) => page.evaluate(([id, sel, i]) => {
  const el = document.getElementById(id).querySelectorAll(sel)[i]; el.scrollIntoView({ block: 'center' });
  const r = el.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width };
}, [id, sel, i]);
const labels = (page, id) => page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.items || '[]').map(it => it.label), id);
const panelLabels = (page) => page.evaluate(() => [...document.querySelectorAll('.grb-data-label-input')].map(i => i.value));
const saved = (page) => page.evaluate(() => window.getSerializedCanvas());

/* 실클릭으로 블럭 선택(라벨 말고 블럭 몸통 아무 데나 — 라벨 첫 클릭도 선택이 된다) → 라벨 더블클릭 */
async function beginEdit(page, id, type, i = 1) {
  const sel = LABEL_SEL[type];
  await centre(page, id, sel, i);   // scrollIntoView
  const p = await stableCentre(page, id, sel, i);
  await clickAt(page, p.x, p.y, { sel: ".graph-block" }, { label: "선택" });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id)).toBe(true);
  const q = await stableCentre(page, id, sel, i);   // ★선택 뒤 패널이 열리며 캔버스가 움직인다 — 멈춘 좌표로만 누른다(×8 첫 판 12/56 이 옛 좌표)
  await clickAt(page, q.x, q.y, { sel }, { label: `${type} 라벨 더블클릭`, dbl: true });
  await expect.poll(() => page.evaluate(([id, sel]) => document.activeElement?.matches(sel) && document.activeElement.isContentEditable && !!document.getElementById(id).contains(document.activeElement), [id, sel]), { message: '라벨이 편집 상태로 포커스', timeout: 3000 }).toBe(true);
  return sel;
}
/* waitStableRect(_root-harness) 와 같은 규약 — 같은 rect 가 150ms 간격으로 두 번 이어야 «멈춤». 라벨은 고유 셀렉터가 없어 index 로 본다. */
async function stableCentre(page, id, sel, i, { interval = 150, tries = 40 } = {}) {
  let prev = null;
  for (let k = 0; k < tries; k++) {
    const r = await page.evaluate(([id, sel, i]) => { const e = document.getElementById(id)?.querySelectorAll(sel)[i]; if (!e) return null; const b = e.getBoundingClientRect(); return [Math.round(b.left), Math.round(b.top), Math.round(b.width), Math.round(b.height)]; }, [id, sel, i]);
    if (r && prev && r.join() === prev.join()) return { x: r[0] + r[2] / 2, y: r[1] + r[3] / 2 };
    prev = r; await page.waitForTimeout(interval);
  }
  throw new Error(`stableCentre: ${sel}[${i}] 가 안 멈췄다 — 옛 좌표로 누르지 않는다`);
}

for (const type of ['bar-v', 'bar-pair', 'bar-h', 'line']) {
  test(`E ${type} — 라벨 더블클릭 → 타이핑 → Enter = items[i].label · 패널 · 저장 · ⌘Z 한 번`, async ({ page }) => {
    const { errs, id } = await setup(page, type);
    const before = await labels(page, id);
    const sel = await beginEdit(page, id, type, 1);
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('새라벨K8');
    await page.keyboard.press('Enter');
    await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 1 ? '새라벨K8' : l));
    // 캔버스 글자 · 패널 · 저장 — 같은 값
    expect(await page.evaluate(([id, sel]) => document.getElementById(id).querySelectorAll(sel)[1].textContent, [id, sel])).toBe('새라벨K8');
    expect(await panelLabels(page)).toEqual(before.map((l, i) => i === 1 ? '새라벨K8' : l));
    expect(await saved(page)).toContain('새라벨K8');
    // 편집 흔적 0 — contenteditable · editing 클래스가 남지 않는다
    expect(await page.evaluate((id) => ({ ce: document.getElementById(id).querySelectorAll('[contenteditable]').length, ed: document.getElementById(id).classList.contains('editing') }), id)).toEqual({ ce: 0, ed: false });
    // ⌘Z 한 번 = 옛 글자
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.keyboard.press('Meta+z');
    await expect.poll(() => page.evaluate((id) => { const g = document.querySelector('#sG .graph-block'); return g ? JSON.parse(g.dataset.items || '[]').map(it => it.label) : null; }, id)).toEqual(before);
    expect(errs).toEqual([]);
  });
}

test('X1 Esc = 무변(데이터·저장·글자)', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  const before = await labels(page, id); const s0 = await saved(page);
  await beginEdit(page, id, 'bar-v', 0);
  await page.keyboard.type('버릴글자');
  await page.keyboard.press('Escape');
  await page.waitForTimeout(100);
  expect(await labels(page, id)).toEqual(before);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-bar-label')[0].textContent, id)).toBe(before[0]);
  expect(await saved(page)).toBe(s0);
  expect(errs).toEqual([]);
});

test('X2 빈 글자 Enter = 무변(빈 라벨은 크기 0 — 다시 못 누른다)', async ({ page }) => {
  const { errs, id } = await setup(page, 'line');
  const before = await labels(page, id);
  await beginEdit(page, id, 'line', 0);
  await page.keyboard.press('Meta+a'); await page.keyboard.press('Backspace');
  await page.keyboard.press('Enter');
  await page.waitForTimeout(100);
  expect(await labels(page, id)).toEqual(before);
  expect(await page.evaluate((id) => document.getElementById(id).querySelectorAll('.grb-line-xlabel')[0].textContent, id)).toBe(before[0]);
  expect(errs).toEqual([]);
});

test('X3 편집 중 Backspace/Delete 가 블럭을 지우지 않는다', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  await beginEdit(page, id, 'bar-v', 0);
  await page.keyboard.press('End'); await page.keyboard.press('Backspace'); await page.keyboard.press('Delete');
  expect(await page.evaluate((id) => !!document.getElementById(id), id)).toBe(true);
  await page.keyboard.press('Enter');
  expect(errs).toEqual([]);
});

/* ── 6f7f6476 뒤(색인 = 블럭 안 카테고리 라벨 순서) — «맞는 라벨»에 들어가나 (팀장 조건 ①) ── */
async function editAt(page, id, type, i, text) {
  await beginEdit(page, id, type, i);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(text); await page.keyboard.press('Enter');
}
test('I1 ★꺾은선 «마지막» 라벨 → items[last] 만 바뀐다', async ({ page }) => {
  const { errs, id } = await setup(page, 'line');
  const before = await labels(page, id); const last = before.length - 1;
  await editAt(page, id, 'line', last, '끝라벨');
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === last ? '끝라벨' : l));
  expect(errs).toEqual([]);
});
test('I2 ★세로 막대 · 값 라벨 숨김(showVLabel=0)에서 «셋째» 라벨 → items[2] 만', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  await page.evaluate((id) => { const g = document.getElementById(id); g.dataset.showVLabel = '0'; window.renderGraph(g); }, id);
  const before = await labels(page, id);
  await editAt(page, id, 'bar-v', 2, '셋째');
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 2 ? '셋째' : l));
  expect(errs).toEqual([]);
});
test('I3 ★비교 막대(범례 있음) «셋째» 라벨 → items[2] 만(범례 글자는 카테고리 라벨이 아니다)', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-pair');
  await page.evaluate((id) => { const g = document.getElementById(id); g.dataset.seriesA = '우리'; g.dataset.seriesB = '남'; window.renderGraph(g); }, id);
  const before = await labels(page, id);
  await editAt(page, id, 'bar-pair', 2, '셋째');
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 2 ? '셋째' : l));
  expect(errs).toEqual([]);
});
test('I4 카테고리 라벨 숨김(showXLabel=0) — 숨은 라벨은 못 누른다 · 데이터 무변', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  await page.evaluate((id) => { const g = document.getElementById(id); g.dataset.showXLabel = '0'; window.renderGraph(g); }, id);
  const before = await labels(page, id);
  const vis = await page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-bar-label')].map(e => e.getBoundingClientRect().height), id);
  expect(vis.every(h => h === 0), '숨은 라벨 크기 0').toBe(true);
  expect(await labels(page, id)).toEqual(before);
  expect(errs).toEqual([]);
});

/* ── contenteditable 'true'(⒥⒝ · _parkedAlive 계약) 의 구멍 막기 — HTML 붙여넣기 (팀장 조건 ③) ── */
test('P ★편집 중 HTML(굵게+링크) 붙여넣기 → 확정 뒤 items[i].label = 맨글자 · 라벨 자식 요소 0 · 화면 = 맨글자', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  /* 진짜 클립보드 길: 페이지 안 서식 조각을 고르고 실키 ⌘C(file:// 은 navigator.clipboard 가 없다) → 라벨 편집에서 실키 ⌘V */
  await page.evaluate(() => { const d = document.createElement('div'); d.id = 'pasteSrc'; d.style.cssText = 'position:fixed;left:0;top:0;z-index:99999;background:#fff'; d.innerHTML = '<b>굵게</b><a href="https://example.com">링크</a>'; document.body.appendChild(d);
    const r = document.createRange(); r.selectNodeContents(d); const s = getSelection(); s.removeAllRanges(); s.addRange(r); });
  await page.keyboard.press('Meta+c');
  await page.evaluate(() => { document.getElementById('pasteSrc').remove(); getSelection().removeAllRanges(); });
  await beginEdit(page, id, 'bar-v', 1);
  await page.keyboard.press('Meta+a');
  await page.keyboard.press('Meta+v');
  // 전제: 붙여넣기가 «실제로» 들어갔다(안 들어갔으면 아래가 헛초록)
  await expect.poll(() => page.evaluate(() => document.activeElement?.textContent || ''), { message: '붙여넣기 들어감', timeout: 3000 }).toContain('굵게');
  const during = await page.evaluate(() => document.activeElement.children.length);
  test.info().annotations.push({ type: 'paste-during', description: `편집 중 라벨 자식 요소 ${during}` });
  expect(during, '전제: 붙여넣기가 서식 요소를 실제로 들였다(구멍이 있다 — 확정이 닫아야 한다)').toBeGreaterThan(0);
  await page.keyboard.press('Enter');
  await expect.poll(() => labels(page, id)).toEqual(expect.arrayContaining(['굵게링크']));
  const r = await page.evaluate((id) => { const e = document.getElementById(id).querySelectorAll('.grb-bar-label')[1]; return { label: JSON.parse(document.getElementById(id).dataset.items)[1].label, kids: e.children.length, text: e.textContent, html: e.innerHTML }; }, id);
  expect(r).toEqual({ label: '굵게링크', kids: 0, text: '굵게링크', html: '굵게링크' });
  expect(errs).toEqual([]);
});
