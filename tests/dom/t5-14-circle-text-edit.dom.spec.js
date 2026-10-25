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

/* ══ ⒝ 글자 위 더블클릭 → 캔버스 편집 ═══════════════════════════════════════════════════════
 *   B1 진입(파일창 0 · 크롭 0 · host 편집) · B2 확정(Enter) → 그 줄 text 저장 · ⌘Z 한 걸음 · B3 Esc 무변
 *   QA-1 프롭힌트 0 · QA-2 편집 중 글자 모양 = 평소 · outline = 그리드 글자 줄 편집과 같다
 *   ★바닥(aefbabde)에서 ⒝ 는 빨강이다(글자 위 더블클릭이 GUI 로 빠진다 — 현빈 «원형을 클릭하면 왜 gui가 뜨는지»).
 *     ⇒ 커밋은 고침과 같이(⛔일부러 빨강으로 두지 않는다). 바닥 빨강 수는 리포트(run-b-base-*.log)에. */
const lineText = (page) => page.evaluate(() => {
  const g = document.getElementById('gG');
  const m = window.getGridModel ? window.getGridModel(g) : null;
  const ln = m ? m.cols[0].lines[0] : null;
  return { model: ln ? (ln.text === undefined ? null : ln.text) : '∅', shown: document.querySelector('#gG .grd-img-circle-text')?.textContent ?? null };
});
async function textPoint(page) {
  const p = await page.evaluate(() => {
    const t = document.querySelector('#gG .grd-img-circle-text'); const r = t.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const e = document.elementFromPoint(x, y);
    return { x, y, onText: !!(e && e.closest('.grd-img-circle-text')), hit: e ? e.className : null };
  });
  expect(p.onText, `[전제] 누른 점 = 원 안 글자 (${p.hit})`).toBe(true);
  return p;
}
async function enterTextEdit(page) {
  const p = await textPoint(page);
  let chooser = false; const onCh = () => { chooser = true; };
  page.on('filechooser', onCh);
  await page.mouse.dblclick(p.x, p.y);
  const ok = await poll(page, () => { const t = document.querySelector('#gG .grd-img-circle-text'); return !!t && t.getAttribute('contenteditable') === 'true' && document.activeElement === t; }, null, 3000);
  page.off('filechooser', onCh);
  const proxy = await page.evaluate(() => !!document.querySelector('.grd-img-edit-proxy'));
  return { ok, chooser, proxy };
}

for (const [tag, extra] of [['빈 원', {}], ['그림 든 원', { imgSrc: PX }]]) {
  test(`B1 ⒝ ${tag} · 글자 위 더블클릭 → 글자 편집 진입 · 파일창 0 · 크롭 0`, async ({ page }) => {
    const errs = await setup(page, CIRC(extra));
    const r = await enterTextEdit(page);
    log(`B1 ${tag}`, r);
    expect(r.chooser, '파일 선택기 0').toBe(false);
    expect(r.proxy, '크롭 프록시 0').toBe(false);
    expect(r.ok, '글자칸 contenteditable true · 포커스').toBe(true);
    expect(errs).toEqual([]);
  });
}

/* ★B2 확정 키 바뀜(261026 · 미카사 · t5-12 「원형이미지에 글자 … 한줄만 가능」) — Enter 는 이제 줄바꿈 · 확정은 ⌘Enter(어노 라벨 꼴).
   이 파일 머리가 적어 둔 「원 글자 여러 줄은 t5-12 몫」 그 자리다. 재는 것(저장·⌘Z 한 걸음)은 그대로. */
test('B2 ⒝ 확정(⌘Enter) → 그 줄 글자 저장 · ⌘Z 한 걸음', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const t0 = await page.evaluate(() => window.getHistoryTip());
  const r = await enterTextEdit(page);
  expect(r.ok, '[전제] 편집 진입').toBe(true);
  await page.keyboard.press('Meta+ArrowRight');   // 글 끝으로 — macOS 크로미움은 End 가 캐럿을 안 옮긴다(run-fix-1 실측: 「원글추가자」)
  await page.keyboard.type('추가');
  await page.keyboard.press('Meta+Enter');
  expect(await poll(page, () => document.querySelector('#gG .grd-img-circle-text')?.getAttribute('contenteditable') !== 'true', null, 3000), '[전제] 편집이 끝났다').toBe(true);
  const after = await lineText(page);
  const t1 = await page.evaluate(() => window.getHistoryTip());
  log('B2', { after, t0, t1 });
  expect(after, '모델·화면 = 원글자추가').toEqual({ model: '원글자추가', shown: '원글자추가' });
  // ⌘Z 한 걸음 — 캔버스 빈 데를 눌러 초점을 캔버스로(입력칸 안 ⌘Z 는 글자 되돌리기라서)
  await page.mouse.click(5, 990);
  await page.keyboard.press('Meta+z');
  expect(await poll(page, () => document.querySelector('#gG .grd-img-circle-text')?.textContent === '원글자', null, 3000), '⌘Z 1 → 원글자').toBe(true);
  const undone = await lineText(page);
  log('B2-undo', undone);
  expect(undone, '⌘Z 1 뒤 모델도 원글자').toEqual({ model: '원글자', shown: '원글자' });
  expect(errs).toEqual([]);
});

/* B2R (기록 · 단언은 전제만) — 같은 블럭 글자 줄 «B» 를 기존 길로 고쳤을 때의 히스토리 Δlen. B2 의 Δlen 과 나란히 적으려고 잰다. */
test('B2R 대조 기록 — 그리드 글자 줄 편집 한 번의 히스토리 Δlen', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const t0 = await page.evaluate(() => window.getHistoryTip());
  const bp = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-c="1"] .grd-line').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.dblclick(bp[0], bp[1]);
  expect(await poll(page, () => document.querySelector('#gG .grd-cell[data-c="1"] .grd-line')?.getAttribute('contenteditable') === 'true'), '[전제] 글자 줄 편집').toBe(true);
  await page.keyboard.press('Meta+ArrowRight');
  await page.keyboard.type('x');
  await page.mouse.click(5, 990);
  expect(await poll(page, () => document.querySelector('#gG .grd-cell[data-c="1"] .grd-line')?.textContent === 'Bx'), '[전제] 글자 줄 커밋(Bx)').toBe(true);
  const t1 = await page.evaluate(() => window.getHistoryTip());
  log('B2R', { t0, t1, dLen: t1.len - t0.len });
  expect(errs).toEqual([]);
});

test('B3 ⒝ Esc → 무변(모델·화면·히스토리 칸)', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const t0 = await page.evaluate(() => window.getHistoryTip());
  const r = await enterTextEdit(page);
  expect(r.ok, '[전제] 편집 진입').toBe(true);
  await page.keyboard.press('Meta+ArrowRight');   // 글 끝으로 — macOS 크로미움은 End 가 캐럿을 안 옮긴다(run-fix-1 실측: 「원글추가자」)
  await page.keyboard.type('버림');
  expect(await page.evaluate(() => document.querySelector('#gG .grd-img-circle-text')?.textContent), '[전제] 타이핑이 먹었다').toBe('원글자버림');
  await page.keyboard.press('Escape');
  expect(await poll(page, () => document.querySelector('#gG .grd-img-circle-text')?.getAttribute('contenteditable') !== 'true', null, 3000), '[전제] 편집이 끝났다').toBe(true);
  const after = await lineText(page);
  const t1 = await page.evaluate(() => window.getHistoryTip());
  log('B3', { after, t0, t1 });
  expect(after, '모델·화면 = 원글자 그대로').toEqual({ model: '원글자', shown: '원글자' });
  expect(t1.len - t0.len, '히스토리 칸 Δ 0').toBe(0);
  expect(errs).toEqual([]);
});

/* QA-1 «불필요한 프롭힌트 0» — 자 둘:
 *   ⑴ 줄을 단클릭으로 고른 상태의 패널 «Image» 절 (줄 수 · id 집합) ＝ 글자 편집 진입 뒤 (새 줄·새 칸 0)
 *   ⑵ #canvas · #panel-right «밖»의 «살아 보이는» 요소 묶음(첫 class · 개수) — 고른 상태 ＝ 진입 뒤 (툴팁·토스트·팝오버 새것 0)
 *   ⛔옛 자(MutationObserver addedNodes)는 버렸다 — 클릭이 다시 그린 패널 절·손잡이가 «붙었다 떨어져» 밖으로 세어졌다
 *     (run-fix-1: .prop-section ×12 · .grd-overlay-handle 등 — 다시 그리기지 새 힌트가 아니다). */
const outsideLive = (page) => page.evaluate(() => {
  const bag = {};
  for (const el of document.body.querySelectorAll('*')) {
    if (el.closest('#canvas') || el.closest('#panel-right')) continue;
    if (!el.getClientRects().length) continue;
    const cs = getComputedStyle(el); if (cs.visibility === 'hidden' || cs.display === 'none' || cs.opacity === '0') continue;
    const k = (el.id ? '#' + el.id : '') + '.' + (String(el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').split(' ')[0]);
    bag[k] = (bag[k] || 0) + 1;
  }
  return bag;
});
const diffBag = (a, b) => Object.keys(a).filter(k => (a[k] || 0) > (b[k] || 0)).map(k => `${k}×${a[k] - (b[k] || 0)}`).sort();
const imgSection = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const secs = [...(body ? body.querySelectorAll('.prop-section') : [])];
  const img = secs.find(s => (s.querySelector('.prop-section-title')?.textContent || '').trim() === 'Image');
  return img ? { rows: img.querySelectorAll('.prop-row, .prop-color-row').length, ids: [...img.querySelectorAll('[id]')].map(e => e.id).sort() } : null;
});
test('QA-1 ⒝ 편집 진입에 새 프롭힌트·툴팁 0', async ({ page }) => {
  const errs = await setup(page, CIRC());
  const p = await textPoint(page);
  await page.mouse.click(p.x, p.y);
  expect(await poll(page, () => document.getElementById('gG').classList.contains('selected')), '[전제] 블럭 고름').toBe(true);
  await page.mouse.click(p.x, p.y);
  expect(await poll(page, () => !!document.getElementById('grd-img-ctext')), '[전제] 줄 고름 — 패널 원 절').toBe(true);
  const sel = await imgSection(page);
  const live0 = await outsideLive(page);
  const r = await enterTextEdit(page);
  expect(r.ok, '[전제] 편집 진입').toBe(true);
  const live1 = await outsideLive(page);
  const added = diffBag(live1, live0), gone = diffBag(live0, live1);
  const ed = await imgSection(page);
  log('QA-1', { sel, ed, added, gone });
  expect(ed, '패널 Image 절 — 고른 상태와 같다(새 줄·칸 0)').toEqual(sel);
  expect(added, '#canvas·#panel-right 밖 «보이는» 요소 — 고른 상태 대비 새것 0').toEqual([]);
  expect(errs).toEqual([]);
});

/* QA-2 «디자인 일관성» — 편집 중 글자 모양 = 평소 · outline = 같은 블럭 글자 줄(.grd-line) 편집 중 outline */
const look = (page, sel) => page.evaluate((sel) => {
  const e = document.querySelector(sel); if (!e) return null; const cs = getComputedStyle(e);
  return { fs: cs.fontSize, color: cs.color, fw: cs.fontWeight, lh: cs.lineHeight, ta: cs.textAlign, ol: [cs.outlineStyle, cs.outlineWidth, cs.outlineColor, cs.outlineOffset].join(' ') };
}, sel);
test('QA-2 ⒝ 편집 중 글자 모양 = 평소 · outline = 그리드 글자 줄 편집과 같다', async ({ page }) => {
  const errs = await setup(page, CIRC());
  // 기준: 같은 블럭 둘째 칸 글자 줄 «B» 를 더블클릭 편집(기존 길) → outline 을 읽고 Esc
  const bp = await page.evaluate(() => { const r = document.querySelector('#gG .grd-cell[data-c="1"] .grd-line').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.dblclick(bp[0], bp[1]);
  expect(await poll(page, () => document.querySelector('#gG .grd-cell[data-c="1"] .grd-line')?.getAttribute('contenteditable') === 'true'), '[전제] 글자 줄 편집(기준)').toBe(true);
  const ref = await look(page, '#gG .grd-cell[data-c="1"] .grd-line');
  await page.keyboard.press('Escape');
  expect(await poll(page, () => document.querySelector('#gG .grd-cell[data-c="1"] .grd-line')?.getAttribute('contenteditable') !== 'true'), '[전제] 기준 편집 끝').toBe(true);
  const before = await look(page, '#gG .grd-img-circle-text');
  const r = await enterTextEdit(page);
  expect(r.ok, '[전제] 편집 진입').toBe(true);
  const during = await look(page, '#gG .grd-img-circle-text');
  log('QA-2', { ref, before, during });
  for (const k of ['fs', 'color', 'fw', 'lh', 'ta']) expect(during[k], `편집 중 ${k} = 평소`).toBe(before[k]);
  expect(during.ol, 'outline = 그리드 글자 줄 편집과 같다').toBe(ref.ol);
  expect(errs).toEqual([]);
});
