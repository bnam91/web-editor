/* def01-history-step.dom.spec.js — DEF-01 1단계: 공용 헬퍼 expectOneUndoStep 을 «한 짝»에서 먼저 닫는다(지디: 계측기는 자기 자신을 잰다).
 *
 * 첫 짝 = 공용 길 «블럭 삭제» — js/editor.js deleteSelectedFromCanvas: 앞 표본 ensureHistoryCheckpoint('삭제 전') + 끝 표본 pushHistory('블록 삭제').
 *   H1 원본 → 헬퍼 초록(⒝ «늘 빨강인 헬퍼»가 아님을 보인다)
 *   H2 앞+끝 «둘 다» 찍히는 경우(날 변화 뒤 삭제) → Δpos = 2 인데도 헬퍼 초록(⒟ 오탐 아님) — 수를 남긴다
 *   H3 시험 안의 «표본 없는 조작»(dataset 만 바꿈) → 헬퍼가 그 값(Δpos 0 · ⌘Z 구제 len +1)을 «본다»(soft 로 수만 단언)
 * 양성대조(⒜) = 제품 한 줄 변이 사본을 GD1001_ROOT 로 실어 같은 spec:
 *   m-end  : editor.js `pushHistory('블록 삭제');` 지움 → H1 빨강(A1·A2)
 *   m-front: editor.js `ensureHistoryCheckpoint?.('삭제 전');` 지움 → H1 초록 · H2 빨강(A3 — ⌘Z 가 날 변화 «전»까지 간다)
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/def01-history-step.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { expectOneUndoStep } = require('./_history-step.js');

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="hS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="hI">
      <div class="gap-block" data-type="gap" id="hG" style="height:40px"></div><div class="row" id="hR1" data-layout="stack"></div><div class="row" id="hR2" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    const mk = (id, row, s) => { const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = id;
      tb.querySelector('[class^="tb-"]').textContent = s; document.getElementById(row).appendChild(tf); };
    mk('hA', 'hR1', '첫째 블럭'); mk('hB', 'hR2', '둘째 블럭');
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    /* ★장면을 «복원이 만드는 꼴»로 먼저 맞춘다 — 복원(⌘Z)은 페이지 설정을 다시 걸어 섹션 안쪽에 padding 인라인을 쓴다.
       손으로 끼운 장면엔 그게 없어 «조작 전 바이트»가 복원 뒤와 처음부터 달랐다(첫 판 실측: section-inner style 49자). */
    window.applyPageSettings?.();
    window.clearHistory?.();          // 깨끗한 바닥: 꼭대기 = 지금 장면
  });
  await page.waitForTimeout(300);
  return errs;
}
async function selectBlock(page, id) {
  const p = await page.evaluate((id) => { const e = document.getElementById(id); e.scrollIntoView({ block: 'center' }); const q = e.getBoundingClientRect(); return [q.left + 8, q.top + q.height / 2]; }, id);
  await page.evaluate(() => window.deselectAll?.());
  await page.mouse.click(p[0], p[1]); await page.waitForTimeout(250);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), `전제 — ${id} 가 골라졌다`).toBe(true);
}

test('H1 ⒝ 원본 — 블럭 삭제(Delete) = 헬퍼 초록 (끝 표본 있음 · ⌘Z 구제 없음 · 한 칸 · 조작 전 바이트)', async ({ page }) => {
  const errs = await setup(page);
  await selectBlock(page, 'hA');
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, '블럭 삭제');
  expect(r.dPos, '보통 경우 = 한 칸(앞 표본은 꼭대기와 같아 안 쌓인다)').toBe(1);
  expect(r.topAction).toBe('블록 삭제');
  expect(await page.evaluate(() => !!document.getElementById('hA')), '⌘Z 뒤 블럭이 돌아왔다').toBe(true);
  expect(errs).toEqual([]);
});

test('H2 ⒟ 앞+끝 «둘 다» 찍힘 — 날 변화(표본 없음) 뒤 블럭 삭제 → Δpos 2 · 그래도 ⌘Z 한 번 = 삭제 직전(날 변화 뒤) — 헬퍼 초록', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => { document.getElementById('hG').style.height = '77px'; });   // 날 변화 — 아무 표본도 안 찍는다
  await selectBlock(page, 'hA');
  const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, '날 변화 뒤 블럭 삭제');
  expect(r.dPos, '★앞 표본(날 변화 상태) + 끝 표본 = 두 칸').toBe(2);
  expect(await page.evaluate(() => document.getElementById('hG').style.height), '⌘Z 한 번 뒤에도 날 변화는 남아 있다(삭제 «직전»으로)').toBe('77px');
});

test('H3 계측기 자기 재기 — 시험 안 «표본 없는 조작»(dataset 만)에서 헬퍼가 Δpos 0 · ⌘Z 구제(len +1·pos 제자리)를 «본다»', async ({ page }) => {
  await setup(page);
  const r = await expectOneUndoStep(page, async () => { await page.evaluate(() => { document.getElementById('hG').style.height = '91px'; }); }, '표본 없는 조작', { soft: true });
  expect(r.changed, '전제 — 화면이 바뀌었다').toBe(true);
  expect(r.dPos, '표본이 없으면 Δpos 0').toBe(0);
  expect(r.undoDLen, '★⌘Z 가 구제 칸을 만든다(DEF-01) — 헬퍼 A2 가 이 값으로 빨개진다').toBe(1);
  expect(r.undoDPos, '구제 칸을 쌓고 한 칸 내려와 pos 는 제자리').toBe(0);
  expect(r.restored, '그래도 화면은 돌아온다 — «화면만» 재는 대조가 공회전하는 까닭').toBe(true);
});
