/* graph-label-edit.dom.spec.js — K8⒤ 그래프 카테고리 라벨 캔버스 직접 편집 (태양 lane-f-graph 2026-10-05)
 * 현빈 K8: 카테고리 라벨을 캔버스에서 더블클릭해 바로 고친다. 저장 자리 = dataset.items[i].label 한 곳(패널 .grb-data-label-input 과 같은 키).
 * 고침: drag-utils renderGraph — 블럭 dblclick 위임(색인 = 블럭 안 카테고리 라벨 순서) → contenteditable(plaintext-only) · Enter/blur 확정 · Esc 취소 · 빈 글자 무변
 *   · css/editor-graph.css 한 줄(.grb-line-overlay .grb-line-xlabel pointer-events:auto — 꺾은선 라벨층이 클릭을 흘려보내던 것).
 * ★사용자 자리에서 «진짜» 더블클릭: _click-at.js clickAt(x,y,{sel},{dbl:true}) — 누르기 직전 elementFromPoint 가 그 라벨이어야 한다(합성 이벤트 ⛔).
 * 선택도 실클릭(블럭 클릭 → 패널). ⌘Z 는 키보드.
 * 양성대조: d1f642ff 나무 안 → E1~E4 · H-line 빨강 · X1 X2 초록 (predict: $S/fg/predict.md).
 *
 * ★★비석(261018 1017t1f6) — 현빈 원문 「항목(라벨) 추가하면 엔터쳐서 줄바꿈도 할수 있게해줘」 지시로
 *   ★맨 Enter 의 뜻이 «확정»→«줄바꿈»으로 바뀌었다. 확정은 ⌘/Ctrl+Enter · blur 로 옮겼다(Esc=취소는 그대로).
 *   ⛔이 파일이 2026-10-05 에 잠그던 것(맨 Enter=확정)은 ★더는 참이 아니다 — 아래 E·X2·X3·I*·P 는
 *   전부 '엔터' 자리를 'Meta+Enter' 로 바꿔 ★새 사실에 맞췄다. 새 사실 자체는 N1 이 잠근다.
 *   ⚠️축 눈금(.grb-ov-tick · 숫자, js/drag-utils.js _graphAxisTickBeginEdit)은 ★Enter=확정 그대로다 —
 *   숫자 한 줄엔 줄바꿈이 뜻이 없어서 다르게 배정했다(graph-axis-tick-edit 쪽 시험이 그걸 잠근다).
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
  test(`E ${type} — 라벨 더블클릭 → 타이핑 → ⌘Enter = items[i].label · 패널 · 저장 · ⌘Z 한 번`, async ({ page }) => {
    const { errs, id } = await setup(page, type);
    const before = await labels(page, id);
    const sel = await beginEdit(page, id, type, 1);
    await page.keyboard.press('Meta+a');
    await page.keyboard.type('새라벨K8');
    await page.keyboard.press('Meta+Enter');   // ★261018 — 맨 Enter 는 이제 줄바꿈(N1) · 확정은 ⌘Enter
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

/* ★261018 1017t1f6㉡ — 새 사실 자체를 잠근다: 맨 Enter = 줄바꿈(아직 미확정) · ⌘Enter = 확정 · 화면도 pre-wrap 으로 두 줄. */
test('N1 ★맨 Enter = 줄바꿈(미확정) · ⌘Enter = 확정 — items[i].label 에 \\n 들어가고 화면도 두 줄', async ({ page }) => {
  const { errs, id } = await setup(page, 'bar-v');
  const before = await labels(page, id);
  const sel = await beginEdit(page, id, 'bar-v', 1);
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('첫줄');
  await page.keyboard.press('Enter');   // ★맨 Enter — 줄바꿈일 뿐, 아직 편집 중이어야 한다(확정 아님)
  await expect.poll(() => page.evaluate(([id, sel]) => document.getElementById(id).querySelectorAll(sel)[1]?.isContentEditable, [id, sel]), { message: '맨 Enter 뒤에도 편집 중 — 확정되지 않았다' }).toBe(true);
  expect(await labels(page, id), '맨 Enter 만으로는 아직 커밋되지 않는다').toEqual(before);
  await page.keyboard.type('둘째줄');
  await page.keyboard.press('Meta+Enter');   // ★⌘Enter — 확정
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 1 ? '첫줄\n둘째줄' : l));
  expect(await page.evaluate(([id, sel]) => document.getElementById(id).querySelectorAll(sel)[1].textContent, [id, sel])).toBe('첫줄\n둘째줄');
  // pre-wrap — 두 줄이 된 라벨의 높이가 한 줄일 때보다 커진다(실제로 줄이 꺾여 «그려졌는지»까지 잰다)
  const twoLineH = await page.evaluate(([id, sel]) => document.getElementById(id).querySelectorAll(sel)[1].getBoundingClientRect().height, [id, sel]);
  const oneLineH = await page.evaluate(([id, sel]) => document.getElementById(id).querySelectorAll(sel)[0].getBoundingClientRect().height, [id, sel]);
  expect(twoLineH, '두 줄 라벨이 한 줄 라벨보다 뚜렷이 높다(pre-wrap 이 실제로 줄을 그렸다)').toBeGreaterThan(oneLineH * 1.5);
  // 편집 흔적 0
  expect(await page.evaluate((id) => ({ ce: document.getElementById(id).querySelectorAll('[contenteditable]').length, ed: document.getElementById(id).classList.contains('editing') }), id)).toEqual({ ce: 0, ed: false });
  expect(errs).toEqual([]);
});

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

test('X2 빈 글자 ⌘Enter = 무변(빈 라벨은 크기 0 — 다시 못 누른다)', async ({ page }) => {
  const { errs, id } = await setup(page, 'line');
  const before = await labels(page, id);
  await beginEdit(page, id, 'line', 0);
  await page.keyboard.press('Meta+a'); await page.keyboard.press('Backspace');
  await page.keyboard.press('Meta+Enter');   // ★261018 — 확정은 ⌘Enter(맨 Enter 는 줄바꿈 — 빈 칸에선 \n 하나가 생길 뿐 여전히 미확정)
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
  await page.keyboard.press('Meta+Enter');   // ★261018 — 확정으로 편집을 깨끗이 닫는다(맨 Enter 는 줄바꿈이라 안 닫힌다)
  expect(errs).toEqual([]);
});

/* ── 6f7f6476 뒤(색인 = 블럭 안 카테고리 라벨 순서) — «맞는 라벨»에 들어가나 (팀장 조건 ①) ── */
async function editAt(page, id, type, i, text) {
  await beginEdit(page, id, type, i);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(text); await page.keyboard.press('Meta+Enter');   // ★261018 — 확정은 ⌘Enter
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
  await page.keyboard.press('Meta+Enter');   // ★261018 — 확정은 ⌘Enter
  await expect.poll(() => labels(page, id)).toEqual(expect.arrayContaining(['굵게링크']));
  const r = await page.evaluate((id) => { const e = document.getElementById(id).querySelectorAll('.grb-bar-label')[1]; return { label: JSON.parse(document.getElementById(id).dataset.items)[1].label, kids: e.children.length, text: e.textContent, html: e.innerHTML }; }, id);
  expect(r).toEqual({ label: '굵게링크', kids: 0, text: '굵게링크', html: '굵게링크' });
  expect(errs).toEqual([]);
});

/* ── t4-17 — 원형 «조각 안 이름»(.grb-pie-name) 캔버스 편집 · 색인은 «제 종류 안에서» (S3 · 261022) ──
 * 현빈 t4-17: 「원형 그래프블럭 : 순위 및 이름표시 하는거 캔버스에서 직접 수정가능하게」 — 편집 대상 = 이름 하나(순위 배지 = pieRanks 계산값 ⇒ 대상 아님).
 * ★DOM 순서 = [조각 안 이름 0..N-1, 범례 라벨 0..N-1](drag-utils.js _renderPie) ⇒ 명부 «전체» 색인을 세면 범례가 N.. 로 밀린다.
 *   T7⒜ 가 그 회귀 칸이다 — 고치기 전에도 초록이어야 하고, 명부에 이름만 더한 판에서 빨강이어야 한다.
 * 장면: 같은 값 3 항목 · 이름 표시 = 패널 토글 실클릭 · 범례 끄기도 패널 토글 실클릭 · 더블클릭은 clickAt(누르기 직전 elementFromPoint). */
const PIE_ITEMS = [{ label: '가', value: 1 }, { label: '나', value: 1 }, { label: '다', value: 1 }];
async function pieSetup(page) {
  const { errs, id } = await setup(page, 'pie');
  await page.evaluate(([id, items]) => { const g = document.getElementById(id); g.dataset.items = JSON.stringify(items); window.renderGraph(g); }, [id, PIE_ITEMS]);
  const p = await centre(page, id, '.grb-pie-label', 0);
  await clickAt(page, p.x, p.y, { sel: '.graph-block' }, { label: '원형 선택' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), { message: '장면 미성립: 원형 블럭이 안 골라졌다' }).toBe(true);
  return { errs, id };
}
async function pieToggle(page, tid) {
  await page.locator(`label.prop-toggle:has(#${tid})`).click();
}
/* 전제 칸 — 이름이 «항목마다 하나» 있고 보인다. 좁아서 grbPieFitTags 가 숨겼으면 결함 판정이 아니라 장면 미성립이다. */
async function pieNamesShown(page, id) {
  await expect.poll(() => page.evaluate((id) => [...document.getElementById(id).querySelectorAll('.grb-pie-name')].map(e => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; }).join(), id),
    { message: '장면 미성립: 조각 안 이름이 항목마다 보이지 않는다(개수·크기)' }).toBe(PIE_ITEMS.map(() => true).join());
}
async function pieEditAt(page, id, sel, i, text) {
  await centre(page, id, sel, i);
  const q = await stableCentre(page, id, sel, i);
  await clickAt(page, q.x, q.y, { sel }, { label: `${sel}[${i}] 더블클릭`, dbl: true });
  await expect.poll(() => page.evaluate(([id, sel]) => document.activeElement?.matches(sel) && document.activeElement.isContentEditable && document.getElementById(id).contains(document.activeElement), [id, sel]), { message: `${sel}[${i}] 가 편집 상태로 포커스`, timeout: 3000 }).toBe(true);
  await page.keyboard.press('Meta+a'); await page.keyboard.type(text); await page.keyboard.press('Meta+Enter');
}
test('T7⒜ ★회귀 — 이름 표시가 켜진 판에서 범례 «둘째» 라벨 → items[1] 만(⛔items[4])', async ({ page }) => {
  const { errs, id } = await pieSetup(page);
  await pieToggle(page, 'grb-pie-name-toggle');
  await pieNamesShown(page, id);
  const before = await labels(page, id);
  await pieEditAt(page, id, '.grb-pie-label', 1, '범례둘');
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 1 ? '범례둘' : l));
  expect(errs).toEqual([]);
});
test('T7⒝ ★조각 안 «둘째» 이름 → items[1] 만 · 조각 안·범례 글자 같이 바뀜(덧③ T6 과 같은 칸)', async ({ page }) => {
  const { errs, id } = await pieSetup(page);
  await pieToggle(page, 'grb-pie-name-toggle');
  await pieNamesShown(page, id);
  const before = await labels(page, id);
  await pieEditAt(page, id, '.grb-pie-name', 1, '조각둘');
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 1 ? '조각둘' : l));
  expect(await page.evaluate((id) => [document.getElementById(id).querySelectorAll('.grb-pie-name')[1].textContent, document.getElementById(id).querySelectorAll('.grb-pie-label')[1].textContent], id)).toEqual(['조각둘', '조각둘']);
  expect(errs).toEqual([]);
});
test('T7⒞ ★범례를 끈 판(E5 · LEGEND-OFF-KILLS-NAME-EDIT-01)에서도 조각 안 «둘째» 이름 → items[1] 만', async ({ page }) => {
  const { errs, id } = await pieSetup(page);
  await pieToggle(page, 'grb-pie-name-toggle');
  await pieToggle(page, 'grb-pie-legend-toggle');
  await expect.poll(() => page.evaluate((id) => [document.getElementById(id).dataset.pieLegendOff, document.getElementById(id).querySelectorAll('.grb-pie-label').length], id), { message: '장면 미성립: 범례가 안 꺼졌다' }).toEqual(['1', 0]);
  await pieNamesShown(page, id);
  const before = await labels(page, id);
  await pieEditAt(page, id, '.grb-pie-name', 1, '끈판둘');
  await expect.poll(() => labels(page, id)).toEqual(before.map((l, i) => i === 1 ? '끈판둘' : l));
  expect(errs).toEqual([]);
});
