/* t5-14 — 그리드 원형 이미지 «안 글자» 위 더블클릭 → 캔버스 직접 편집.
 *   현빈 원문: 「grd_yb8d4_0z2o2u9에서 텍스트 추가한 뒤에, 원형을 클릭하면 왜 gui가 뜨는지?, 그리고 캔버스에서 텍스트 바로 수정할 수 있게 해줘」
 *   지디 판정 GO · 범위 = ★«원 안 글자(.grd-img-circle-text) 위 더블클릭만». ⛔2026-10-07 ㉠-a(js/props/prop-grid.js G20 머리 —
 *     「원형 줄의 더블클릭은 이미 둘 다 차 있다: 빈 원 → 파일 선택기 · 그림 든 원 → 크롭 편집」)는 ★깨지 않는다.
 *
 * ⒜ ★음성대조(먼저 세운다 · 고치기 전 판에서 초록이어야 한다): 원 «글자 밖» 더블클릭 → 여전히 GUI.
 *     A1 빈 원(글자 있음)  → 파일 선택기가 뜬다(Playwright 'filechooser' 사건) · 글자 편집 0
 *     A2 그림 든 원(글자 있음) → 크롭 편집 프록시(.grd-img-edit-proxy · js/image-handling.js enterGridImageEditMode) · 글자 편집 0
 *   자: 누른 점의 elementFromPoint 가 ★원 프레임(또는 그 <img>)이고 ★글자칸이 아님을 [전제]로 단언한다.
 *
 * 장면: 그리드 블럭을 makeGridBlock 으로 세운다(★예외 — 이름으로: 장면 «세우기»만 page.evaluate · 선례 tests/dom/grid-circle-text.dom.spec.js setup).
 *   제스처(클릭·더블클릭·키)는 ★마우스·키보드로만. 고정 대기 0줄(tests/unit/dom-fixed-wait-census W3) — 조건을 기다린다.
 * 판 정체: _root-harness.js 의 ROOT(GD1001_ROOT) — 이 spec 은 판 sha 를 단언하지 않는다(그리드 선례 spec 들과 같은 꼴). 판은 런 로그 첫 줄(run-test.sh)이 적는다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const log = (tag, o) => console.log(`T514 ${tag} ${JSON.stringify(o)}`);
const poll = async (page, fn, arg, timeout = 4000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };

async function setup(page, line) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((line) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="gS" data-section="1"><div class="section-hitzone"></div><div class="section-inner">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="gR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:400px"></div></div></div>`);
    const { block: g } = window.makeGridBlock({
      cols: [{ width: 1, lines: [line] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
      rows: [{ height: 'auto' }],
    });
    g.id = 'gG'; document.getElementById('gR').appendChild(g); window.rebindAll?.(); window.renderGridBlock(g); window.deselectAll?.();
  }, line);
  expect(await poll(page, () => !!document.querySelector('#gG .grd-img-frame .grd-img-circle-text')), '[전제] 원 안 글자가 그려졌다').toBe(true);
  await waitStableRect(page, '#gG .grd-img-frame');
  return errs;
}
const CIRC = (extra = {}) => Object.assign({ type: 'image', imgSrc: '', imgShape: 'circle', height: 160, text: '원글자' }, extra);

/** 원 «글자 밖» 한 점 — 가운데 x · 위에서 14% (글자칸은 가운데 한 줄이라 닿지 않는다 · 원 안이다). */
async function offTextPoint(page) {
  const p = await page.evaluate(() => {
    const f = document.querySelector('#gG .grd-img-frame'); const r = f.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height * 0.14;
    const e = document.elementFromPoint(x, y);
    return { x, y, onFrame: !!(e && (e === f || f.contains(e))), onText: !!(e && e.closest('.grd-img-circle-text')), hit: e ? e.className : null };
  });
  expect(p.onFrame && !p.onText, `[전제] 누른 점 = 원 프레임 · 글자칸 아님 (${p.hit})`).toBe(true);
  return p;
}
const editingText = (page) => page.evaluate(() => {
  const t = document.querySelector('#gG .grd-img-circle-text');
  return { ce: t ? t.getAttribute('contenteditable') : null, active: !!(t && document.activeElement === t), blockEditing: document.getElementById('gG').classList.contains('editing') };
});

/* ══ ⒜ 음성대조 — 원(도형) 위 더블클릭은 여전히 GUI ══════════════════════════════════════ */
test('A1 ⒜ 빈 원(글자 있음) · 글자 밖 더블클릭 → 파일 선택기 · 글자 편집 0', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const p = await offTextPoint(page);
  const chooser = page.waitForEvent('filechooser', { timeout: 4000 }).then(() => true, () => false);
  await page.mouse.dblclick(p.x, p.y);
  const got = await chooser;
  const ed = await editingText(page);
  log('A1', { chooser: got, ed });
  expect(got, '빈 원 더블클릭 → 파일 선택기').toBe(true);
  expect(ed.ce === 'true' || ed.active, '글자 편집 0').toBe(false);
  expect(errs).toEqual([]);
});

test('A2 ⒜ 그림 든 원(글자 있음) · 글자 밖 더블클릭 → 크롭 편집 · 글자 편집 0', async ({ page }) => {
  const errs = await setup(page, CIRC({ imgSrc: PX }));
  const p = await offTextPoint(page);
  await page.mouse.dblclick(p.x, p.y);
  const proxy = await poll(page, () => !!document.querySelector('.grd-img-edit-proxy'));
  const ed = await editingText(page);
  log('A2', { proxy, ed });
  expect(proxy, '그림 든 원 더블클릭 → 크롭 편집(.grd-img-edit-proxy)').toBe(true);
  expect(ed.ce === 'true' || ed.active, '글자 편집 0').toBe(false);
  expect(errs).toEqual([]);
});
