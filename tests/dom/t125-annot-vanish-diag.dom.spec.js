/* t125-annot-vanish-diag.dom.spec.js — 125 ㉯ FALSE-PASS-CHECKER-SAID-OK-WHILE-ANNOT-MISSING-01
 *   진단 한 줄을 «글자 밖»으로: 어노테이션(.annotation-block · .annot-label · .annot-svg)이 라이브 섹션에서는 그려지는데
 *   캡처 클론에서 «안 그려지면» console.warn('[export-annot-missing] …')(js/io/capture-safety.js warnIfCaptureAnnotVanished).
 *   ⛔원인을 안 고른다 — 아래 두 «안 그려짐» 꼴(숨김 · 걷힘)을 같은 한 줄이 잡는다.
 *
 *   N  음성 — 정상 판: 어노가 클론에 그대로 그려짐 ⇒ 0줄
 *   H  ★양성 — 클론에서만 숨김(visibility hidden · 「DOM 에 있는데 안 그려짐」) ⇒ 1줄 · 라이브 2 → 클론 0
 *   R  ★양성 — 클론에서 통째로 걷힘(= 고침 없는 판 8d10b079 의 capture-safety 한 줄을 되살린 변이) ⇒ 1줄 · 표본 inClone false
 *   U  음성 — 사용자가 라이브에서부터 숨긴 어노는 분모에 안 든다 ⇒ 0줄
 *   ★다른 글이 있는 섹션이다 — warnIfCaptureTextVanished 는 이 장면 넷 다 0줄(그 자의 시야 밖임을 같은 장면에서 단언).
 *
 * 양성대조 핀 68ba1f1b·8d10b079: GD1001_ROOT=<핀 사본> ⇒ 진단 함수가 없어 H·R 빨강 · N·U 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js t125-annot-vanish-diag
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT, ORIGIN } = require('./_root-harness.js');

async function scene(page) {
  const errs = await bootApp(page);
  return { errs, ...(await place(page)) };
}
async function place(page) {
  return page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection?.();
    const sec = c.querySelector('.section-block');
    const inner = sec.querySelector('.section-inner');
    const tb = document.createElement('div');
    tb.innerHTML = '<div class="row"><div class="text-block" data-type="text"><div class="tb-body">본문 글자가 있는 섹션</div></div></div>';
    inner.appendChild(tb.firstElementChild);
    const pen = window.makeAnnotationBlock({ points: [[20, 20], [160, 90]], text: 'PEN' });
    const dim = window.makeAnnotationBlock({ annotKind: 'dim', points: [[30, 200], [230, 200]], text: 'DIM' });
    sec.appendChild(pen); sec.appendChild(dim);
    window.annotRedrawDim?.(dim);
    window.deselectAll?.();
    return { secId: sec.id, penId: pen.id, dimId: dim.id };
  });
}
/* 섹션 내보내기 한 번(다운로드 없음) — 그동안 찍힌 경고 줄을 모은다. 캡처 자체의 성패는 이 칸의 축이 아니다. */
async function exportAndWarns(page, secId) {
  const warns = [];
  const on = (m) => { if (m.type() === 'warning' || m.type() === 'warn') warns.push(m.text()); };
  page.on('console', on);
  const r = await page.evaluate(async (id) => {
    try { await window.exportSection(document.getElementById(id), 'png', 860, { returnDataUrl: true }); return 'ok'; }
    catch (e) { return 'threw:' + String(e).slice(0, 80); }
  }, secId);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  page.off('console', on);
  return { r, annot: warns.filter((t) => t.includes('[export-annot-missing]')), blank: warns.filter((t) => t.includes('[export-blank]')) };
}
const live = (page, ids) => page.evaluate(({ penId, dimId }) => [penId, dimId].map((i) => {
  const el = document.getElementById(i); const r = el.getBoundingClientRect(); return { label: !!el.querySelector('.annot-label'), svg: !!el.querySelector('.annot-svg'), w: r.width, h: r.height };
}), ids);

test('N 음성 — 정상 판: 어노가 클론에 그려짐 ⇒ [export-annot-missing] 0줄 · [export-blank] 0줄', async ({ page }) => {
  const s = await scene(page);
  const L = await live(page, s);
  expect(L.every((x) => x.label && x.svg && x.w > 0 && x.h > 0), '전제: 라이브 어노 둘이 라벨·선과 함께 그려진다').toBe(true);
  const w = await exportAndWarns(page, s.secId);
  expect(w.annot, '★정상 판에서 울리면 오탐').toEqual([]);
  expect(w.blank, '전제: 글자 있는 섹션 — 글자 진단은 침묵').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('H ★양성 — 클론에서만 숨김(DOM 에 있는데 안 그려짐) ⇒ 1줄 · 라이브 2 → 클론 0', async ({ page }) => {
  const s = await scene(page);
  /* 클론은 body 바로 밑에 붙는다(js/io/export-image.js) — 라이브는 #canvas 안이라 이 규칙에 안 걸린다 */
  await page.addStyleTag({ content: 'body > .section-block .annotation-block { visibility: hidden !important; }' });
  const L = await live(page, s);
  expect(L.every((x) => x.w > 0), '전제: 라이브는 그대로 그려진다').toBe(true);
  const w = await exportAndWarns(page, s.secId);
  expect(w.annot.length, `★한 줄 (${w.r})`).toBe(1);
  expect(w.annot[0], '★증상(라이브 → 클론 수)이 글자로').toContain('.annotation-block 2→0');
  expect(w.blank, '★글자 진단은 이 꼴을 못 본다(시야 밖)').toEqual([]);
  expect(s.errs).toEqual([]);
});

test('R ★양성 — 클론에서 통째로 걷힘(8d10b079 의 한 줄을 되살린 변이) ⇒ 1줄', async ({ page }) => {
  const errs = await bootApp(page);
  const file = path.join(ROOT, 'js/io/capture-safety.js');
  const src = fs.readFileSync(file, 'utf8');
  const OLD = "clone.querySelectorAll('.annot-preview').forEach(el => el.remove());";
  expect(src.includes(OLD), '전제: 변이 닻이 소스에 있다').toBe(true);
  const mutated = src.replace(OLD, "clone.querySelectorAll('.annotation-block, .annot-preview').forEach(el => el.remove()); /* [125-R 변이 = 3648a3f1 되돌림] */");
  await page.route(`${ORIGIN}/js/io/capture-safety.js`, (r) => r.fulfill({ contentType: 'application/javascript', body: mutated }));
  await page.reload();
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.groupSelectedBlocks === 'function', null, { timeout: 20000 });
  const s = await place(page);
  const w = await exportAndWarns(page, s.secId);
  expect(w.annot.length, `★한 줄 (${w.r})`).toBe(1);
  expect(w.annot[0], '★걷혀도 같은 한 줄').toContain('.annotation-block 2→0');
  expect(w.blank, '★글자 진단은 이 꼴도 못 본다').toEqual([]);
  expect(errs).toEqual([]);
});

test('U 음성 — 사용자가 라이브에서부터 숨긴 어노는 결손이 아니다 ⇒ 0줄', async ({ page }) => {
  const s = await scene(page);
  await page.evaluate(({ penId, dimId }) => { for (const i of [penId, dimId]) document.getElementById(i).style.display = 'none'; }, s);
  const w = await exportAndWarns(page, s.secId);
  expect(w.annot).toEqual([]);
  expect(s.errs).toEqual([]);
});
