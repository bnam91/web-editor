/* frame-dblclick-overlay — 프레임 «오버레이» 모형(현빈 2026-10-08 · 발주서 ORDER-frame-dblclick-focus 「정정 확정」 절).
 *
 * 현빈 원문: 「1번클릭은 프레임블럭위에 마치 오버레이된것 처럼 내부수정이 안되게 되는거고, 두번클릭하면 편집모드로 들어가지는거지」
 *          「프레임블럭 내부에 자식블럭위에서 더블클릭하면 그걸 선택할수 있는거야. (내부진입 및 자식 선택을 하나로)」
 * 다섯 칸(발주서 §4 ① ⒜~⒠):
 *   OV-a 1번 클릭 → 프레임 선택 · 자식 선택 없음 · 편집 아님
 *   OV-b 더블(여백) → 진입 · 자식 선택 없음 · t 가 프레임 «안»
 *   OV-c 더블(자식 위) → 진입 ＋ 그 자식 선택 · ⛔편집 아님 · t 가 프레임 «안»
 *   OV-d 편집모드 안에서 자식을 또 더블 → 그 자식 편집
 *   OV-e 스택모드 · 자식 선택 상태 t → 프레임 «안» · 선택한 자식 «바로 다음»(㉠)
 * 기준선(고치기 전 dev ee614986 실측 · 삽입 포커스 표): 여백 더블 → t 가 프레임 «바로 아래(밖)» · 자식 더블 → 바로 편집 · t 가 글자로 타이핑.
 * 규율: 누를 자리는 «누르기 직전» 다시 재고 [전제] 그 점이 대상 위(첫 클릭 뒤 줌이 늦게 서서 자리가 바뀐다).
 * ⛔이 검사가 안 잰 것: 「클릭 → (사이 두고) 클릭」 드릴인(E93 · frame-drill-in) — 오버레이 모형에서 이 길을 막을지는 미정(지디·현빈 판정).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

async function scene(page, { stack = false } = {}) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const ids = await page.evaluate((stack) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sOV" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sOV');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    const kids = [0, 1].map(i => {
      window.deselectAll?.(); window._activeFrame = fr;
      const t = made('.text-block', () => window.addTextBlock('body'));
      const ed = t.querySelector('[contenteditable]') || t.querySelector('[class^="tb-"]'); if (ed) ed.textContent = '글 ' + (i + 1);
      const tu = t.closest('.frame-block[data-text-frame]') || t; tu.style.left = '40px'; tu.style.top = (30 + i * 110) + 'px'; tu.style.width = '260px';
      return { tb: t.id, tu: tu.id };
    });
    fr.style.height = '300px'; fr.style.minHeight = '300px';
    if (stack) window.__convertFreeLayoutToStack(fr);
    window.deselectAll?.(); window._activeFrame = null;
    return { fr: fr.id, kids, stack: fr.dataset.freeLayout !== 'true' };
  }, stack);
  await page.waitForTimeout(800);
  return ids;
}
const pt = (page, id, fx, fy) => page.evaluate(({ id, fx, fy }) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width * fx, y: r.top + r.height * fy }; }, { id, fx, fy });
async function gesture(page, id, fx, fy, dbl, frameId) {
  const p = await pt(page, id, fx, fy);
  /* [전제] 누르는 점이 «대상의 사각형 안»이고 그 점의 맨 위 요소가 «그 프레임 소속»이다.
     ⚠️선택 안 된 프레임의 자식은 pointer-events:none(css/editor-blocks.css :145) — 첫 동작에서 elementFromPoint 는 자식이 아니라 프레임을 준다.
       그래서 «자식이 맞았나»를 맨 위 요소로 재면 고치기 전 판에서 전제가 거짓이 된다(2026-10-08 첫 판 12건). 사각형 ＋ 프레임 소속으로 잰다. */
  const ok = await page.evaluate(({ x, y, id, fr }) => { const r = document.getElementById(id).getBoundingClientRect();
    const inRect = x >= r.left && x <= r.right && y >= r.top && y <= r.bottom;
    return inRect && !!document.elementFromPoint(x, y)?.closest('#' + fr); }, { ...p, id, fr: frameId });
  expect(ok, `[전제] 누르는 점이 #${id} 사각형 안 · 프레임 #${frameId} 소속`).toBe(true);
  if (dbl) await page.mouse.dblclick(p.x, p.y); else await page.mouse.click(p.x, p.y);
  await page.waitForTimeout(650);
}
const state = (page, ids) => page.evaluate((ids) => ({
  frameSel: document.getElementById(ids.fr).classList.contains('selected'),
  childSel: ids.kids.map(k => document.getElementById(k.tb).classList.contains('selected')),
  editing: !!document.querySelector('#canvas .editing') || !!document.activeElement?.isContentEditable,
}), ids);
/* t 를 눌러 새 글자가 어디에 섰나: 'inside' + 프레임 안 자식 순서 / 'outside' / 'typed'(글자에 타이핑) / 'none' */
async function pressT(page, ids) {
  const before = await page.evaluate(() => ({ ids: [...document.querySelectorAll('#canvas .text-block')].map(e => e.id), txt: [...document.querySelectorAll('#canvas [contenteditable]')].map(e => e.textContent) }));
  await page.keyboard.press('t'); await page.waitForTimeout(500);
  return page.evaluate(({ before, ids }) => {
    const nb = [...document.querySelectorAll('#canvas .text-block')].find(e => !before.ids.includes(e.id));
    if (!nb) { const now = [...document.querySelectorAll('#canvas [contenteditable]')].map(e => e.textContent); return { where: now.some((t, i) => before.txt[i] !== undefined && t !== before.txt[i]) ? 'typed' : 'none' }; }
    const fr = document.getElementById(ids.fr);
    if (!fr.contains(nb)) return { where: 'outside' };
    const unit = (e) => { let u = e; while (u && u.parentElement !== fr) u = u.parentElement; return u; };
    const order = [...fr.children].filter(c => !c.classList.contains('gap-block')).map(c => c.id);
    return { where: 'inside', order, newUnit: unit(nb)?.id };
  }, { before, ids });
}

test('OV-a 1번 클릭 → 프레임만 골라진다(오버레이) · 자식 선택 없음 · 편집 아님', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, false, ids.fr);
  expect(await state(page, ids)).toEqual({ frameSel: true, childSel: [false, false], editing: false });
});

test('OV-b 여백 더블클릭 → 진입 · 자식 선택 없음 · t 가 프레임 «안»', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.fr, 0.9, 0.92, true, ids.fr);
  const s = await state(page, ids);
  expect(s.childSel, '여백 더블인데 자식이 골라졌다').toEqual([false, false]);
  expect(s.editing, '여백 더블인데 편집이 켜졌다').toBe(false);
  const r = await pressT(page, ids);
  expect(r.where, `여백 더블 뒤 t 가 프레임 안이 아니다(${r.where})`).toBe('inside');
});

test('OV-c 자식 위 더블클릭 → 진입 ＋ 그 자식 선택 · 편집 아님 · t 가 프레임 «안»', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, true, ids.fr);
  const s = await state(page, ids);
  expect(s.childSel, '누른 자식이 골라지지 않았다').toEqual([true, false]);
  expect(s.editing, '한 번의 더블클릭이 편집까지 갔다(진입 ＋ 선택까지만이어야)').toBe(false);
  const r = await pressT(page, ids);
  expect(r.where, `자식 더블 뒤 t 가 프레임 안이 아니다(${r.where})`).toBe('inside');
});

test('OV-d 편집모드 안에서 자식을 또 더블클릭 → 그 자식 편집', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, true, ids.fr);
  const s1 = await state(page, ids);
  expect(s1.childSel[0], '[전제] 첫 더블 뒤 자식이 골라졌다').toBe(true);
  expect(s1.editing, '[전제] 첫 더블 뒤엔 아직 편집이 아니다(이게 아니면 이 칸은 아무것도 안 잰다)').toBe(false);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, true, ids.fr);
  const s2 = await state(page, ids);
  expect(s2.editing, '편집모드 안 두 번째 더블클릭인데 편집이 안 켜졌다').toBe(true);
  expect(s2.childSel[0]).toBe(true);
});

test('OV-e 스택모드 · 자식 더블(선택) 뒤 t → 프레임 «안» · 선택한 자식 «바로 다음»(㉠)', async ({ page }) => {
  const ids = await scene(page, { stack: true });
  expect(ids.stack, '[전제] 스택으로 바뀌었다').toBe(true);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, true, ids.fr);
  const s = await state(page, ids);
  expect(s.childSel, '[전제] 글1 이 골라졌다').toEqual([true, false]);
  const r = await pressT(page, ids);
  expect(r.where, `스택 프레임에서 t 가 안이 아니다(${r.where})`).toBe('inside');
  const i = r.order.indexOf(ids.kids[0].tu);
  expect(r.order[i + 1], `새 글자가 «글1 바로 다음»이 아니다 — 순서 ${r.order}`).toBe(r.newUnit);
});

/* ── 최종 규칙(지디 발주서 「최종 확정」 · 현빈 2026-10-08): R1 더블 = 한 겹 내려감 · R2 1번 클릭 = 현재 깊이의 직계 자식 선택 · R3 더 내려갈 것 없으면(글자) 편집 ── */
test('OV-f (R2) 깊이 1 에서 다른 자식을 1번 클릭 → 그 자식 선택', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, true, ids.fr);          // 깊이 1 ＋ 글1 선택
  expect((await state(page, ids)).childSel, '[전제] 글1 이 골라졌다').toEqual([true, false]);
  await gesture(page, ids.kids[1].tu, 0.3, 0.5, false, ids.fr);         // 깊이 1 에서 글2 1클릭
  const s = await state(page, ids);
  expect(s.childSel, '깊이 1 에서 1클릭한 자식이 골라지지 않았다').toEqual([false, true]);
  expect(s.editing).toBe(false);
});

async function nestedScene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  /* 장면: tests/dom/frame-drill-in.dom.spec.js 의 «중첩» 짓기 선례 그대로(makeFrameBlock · _makeTextFrame · applyTextOpts — 앱 공장 함수).
     ⚠️addFrameBlock/addTextBlock 을 활성 프레임으로 겹쳐 부르는 첫 판은 안쪽이 안 생겼다(TypeError · 장면 짓기 실패). */
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sOVN" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="sOVNI"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="sOVNR" data-layout="stack"></div><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>`);
    const { block: tb } = window.makeTextBlock('h2'); const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h2'); tf.appendChild(tb); tb.id = 'ovT'; tb.querySelector('[class^="tb-"]').textContent = '손자 글';
    const F = window.makeFrameBlock({ fullWidth: true }); F.id = 'ovF'; F.style.padding = '30px';
    const F2 = window.makeFrameBlock({ fullWidth: true }); F2.id = 'ovF2'; F2.style.padding = '30px';
    F2.appendChild(tf); F.appendChild(F2); document.getElementById('sOVNR').appendChild(F);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    return { F: 'ovF', F2: 'ovF2', T: 'ovT', tu: tf.id || (tf.id = 'ovTF'), F2inF: F2.parentElement === F, TinF2: F2.contains(tb) };
  });
  await page.waitForTimeout(800);
  return ids;
}
const nstate = (page, n) => page.evaluate((n) => ({
  F: document.getElementById(n.F).classList.contains('selected'), F2: document.getElementById(n.F2).classList.contains('selected'),
  T: document.getElementById(n.T).classList.contains('selected'),
  editing: !!document.querySelector('#canvas .editing') || !!document.activeElement?.isContentEditable,
}), n);

test('OV-g (R1·R2·R3) 중첩 F > F2 > 글: 더블 → F2 선택(깊이1) · 또 더블 → 글 선택(깊이2) · 또 더블 → 편집', async ({ page }) => {
  const n = await nestedScene(page);
  expect(n.F2inF && n.TinF2, '[전제] F 안에 F2 · F2 안에 글').toBe(true);
  await gesture(page, n.tu, 0.3, 0.5, true, n.F);
  const s1 = await nstate(page, n);
  expect({ F2: s1.F2, T: s1.T, editing: s1.editing }, '1번째 더블(깊이 0→1): F2 가 골라져야 — 글·편집 아님').toEqual({ F2: true, T: false, editing: false });
  await gesture(page, n.tu, 0.3, 0.5, true, n.F);
  const s2 = await nstate(page, n);
  expect({ T: s2.T, editing: s2.editing }, '2번째 더블(깊이 1→2): 글이 골라져야 — 편집 아님').toEqual({ T: true, editing: false });
  await gesture(page, n.tu, 0.3, 0.5, true, n.F);
  const s3 = await nstate(page, n);
  expect(s3.editing, '3번째 더블: 더 내려갈 것이 없는 글 → 편집이어야(R3)').toBe(true);
});

/* ── «오버레이»의 실체와 예외 둘 (css/editor-blocks.css:142~146 · 지디 2026-10-08 「이미 있다 — 이름만 달랐다」) ──
 *   `.frame-block:not(.selected):not([data-text-frame]):not(:has(.selected)) *:not(.shape-block):not(.shape-handle){pointer-events:none}`
 *   = 고르지 않은 프레임의 자손은 클릭을 못 받는다(현빈 「1번 클릭은 오버레이된 것처럼 내부수정이 안 되게」).
 *   예외 ⑴ shape-block·shape-handle — 고르지 않은 프레임 안에서도 클릭을 받는다.
 *   예외 ⑵ data-text-frame — 글자 래퍼 «자신»은 덮개가 아니다(래퍼는 .selected 를 안 받으므로 · 주석 원문 「text-frame은 항상 .selected 없음 (투명 래퍼) → 별도 규칙으로 제외」).
 *   ⚠️왜 도형이 예외인가 — 주석에 «까닭이 없다»(그 줄의 첫 커밋 512de5b3 2026-04-08 「프레임 코너 반경 핸들 추가」 — 까닭 문장 0). ⛔못 찾았다.
 *   이 두 칸은 «정책»이 아니라 «지금 손이 닿는 자리»를 잠근다: 다음 사람이 「왜 이것만 다르지」로 시간을 안 쓰게. */
test('OV-x1 [예외의 실제] 고르지 않은 프레임 안의 도형도 첫 클릭 자리에서 «도형»이 안 맞는다 — 도형 예외 줄은 프레임 안에선 효력이 없다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const r = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sOX" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sOX');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    window.deselectAll?.(); window.selectSection?.(sec); window._activeFrame = fr;   // addShapeBlock 은 «고른 섹션»이 있어야 만든다(첫 판: 섹션을 풀어 둬 도형 0 — 장면 흠)
    const sh = made('.shape-block', () => window.addShapeBlock?.('rectangle'));
    window.deselectAll?.(); window._activeFrame = null;
    if (!sh) return { made: false };
    const b = sh.getBoundingClientRect(); const x = b.left + b.width / 2, y = b.top + b.height / 2;
    const top = document.elementFromPoint(x, y);
    return { made: true, inFrame: fr.contains(sh), frameSel: fr.classList.contains('selected'), hitShape: !!top?.closest('.shape-block'), pe: getComputedStyle(sh).pointerEvents };
  });
  expect(r.made, '[전제] 프레임 안에 도형이 생겼다').toBe(true);
  expect(r.inFrame, '[전제] 도형이 프레임 안이다').toBe(true);
  expect(r.frameSel, '[전제] 프레임은 안 골라졌다').toBe(false);
  /* ★실측(2026-10-08 · 고치기 전 판 ee614986 과 레인 둘 다 같은 값): 도형 pointer-events = none · 첫 클릭 자리의 맨 위 = 도형 아님.
     까닭(행위로 확인한 것만): :145 줄은 «.shape-block 자신»을 빼지만 그 도형의 래퍼(도형 프레임 = frame-block)가 덮개를 받고 pointer-events 는 «상속»된다.
     ⇒ 예외 줄이 있어도 «진짜 프레임 안» 도형은 덮인다 = R2(1클릭 = 프레임) 와 같다. 예외 줄은 «섹션 직속 도형 래퍼»에서만 뜻이 있을 수 있다(미측정). */
  expect({ hitShape: r.hitShape, pe: r.pe }, '프레임 안 도형의 덮개 상태가 바뀌었다').toEqual({ hitShape: false, pe: 'none' });
});

test('OV-x2 [예외] 섹션의 글자 래퍼(data-text-frame)는 덮개가 아니다 — 고르지 않아도 첫 클릭 자리에서 «글자»가 맞는다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const r = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sOX2" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sOX2');
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const before = new Set([...document.querySelectorAll('#canvas .text-block')].map(e => e.id));
    window.addTextBlock('body');
    const t = [...document.querySelectorAll('#canvas .text-block')].find(e => !before.has(e.id));
    window.deselectAll?.();
    const tf = t.closest('.frame-block[data-text-frame]');
    const b = t.getBoundingClientRect(); const top = document.elementFromPoint(b.left + 10, b.top + b.height / 2);
    return { hasTF: !!tf, tfInRealFrame: !!tf?.parentElement?.closest('.frame-block:not([data-text-frame])'), hitText: !!top?.closest('.text-block'), tfSel: !!tf?.classList.contains('selected') };
  });
  expect(r.hasTF, '[전제] 글자가 글자 래퍼 안이다').toBe(true);
  expect(r.tfInRealFrame, '[전제] 그 래퍼는 «진짜 프레임» 밖(섹션)이다').toBe(false);
  expect(r.tfSel, '[전제] 래퍼는 .selected 가 아니다').toBe(false);
  expect(r.hitText, '글자 래퍼가 덮개가 됐다 — 첫 클릭이 글자에 안 닿는다').toBe(true);
});

test('OV-x3 (R1) 프레임 안 도형 자리 더블클릭 → 진입 ＋ 도형 선택 · 도형 «편집»(글자) 아님', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sOX3" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(60);
    const sec = document.getElementById('sOX3');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
    const fr = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock());
    window.deselectAll?.(); window.selectSection?.(sec); window._activeFrame = fr;
    const sh = made('.shape-block', () => window.addShapeBlock('rectangle'));
    window.deselectAll?.(); window._activeFrame = null;
    return { fr: fr.id, sh: sh?.id, wrap: sh?.closest('.frame-block')?.id, inFr: !!(sh && fr.contains(sh)) };
  });
  expect(ids.inFr, '[전제] 도형이 프레임 안이다').toBe(true);
  await page.waitForTimeout(800);
  await gesture(page, ids.sh, 0.5, 0.5, true, ids.fr);
  const s = await page.evaluate((ids) => ({ fr: document.getElementById(ids.fr).classList.contains('selected'),
    shapeOrWrapSel: document.getElementById(ids.sh).classList.contains('selected') || document.getElementById(ids.wrap).classList.contains('selected'),
    editing: !!document.querySelector('#canvas .editing') || !!document.activeElement?.isContentEditable }), ids);
  expect(s.shapeOrWrapSel, '도형 자리 더블클릭인데 도형(또는 그 래퍼)이 안 골라졌다').toBe(true);
  expect(s.editing, '도형 자리 더블클릭 한 번이 편집까지 갔다').toBe(false);
});

/* ── 두 상태가 한 깊이를 다르게 말하지 않는다(지디 2026-10-08 ⑶) — CSS 는 «자식 선택 깊이»(:has(.selected)) · JS 는 «여백 진입»(window._enteredFrame) 하나씩 ── */
test('OV-h 여백 더블 → _enteredFrame = 그 프레임 · 그동안 자손 .selected 0', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.fr, 0.9, 0.92, true, ids.fr);
  const r = await page.evaluate((ids) => ({ entered: window._enteredFrame?.id || null, descSel: document.getElementById(ids.fr).querySelectorAll('.selected').length }), ids);
  expect(r).toEqual({ entered: ids.fr, descSel: 0 });
});

test('OV-i 여백 진입 뒤 자식 1클릭(R2) → 자식 선택 · t 는 여전히 프레임 «안»(두 상태가 겹쳐도 무해)', async ({ page }) => {
  const ids = await scene(page);
  await gesture(page, ids.fr, 0.9, 0.92, true, ids.fr);
  await gesture(page, ids.kids[0].tu, 0.3, 0.5, false, ids.fr);
  const s = await state(page, ids);
  expect(s.childSel, '[전제] 여백 진입 뒤 1클릭한 자식이 골라졌다').toEqual([true, false]);
  const r = await pressT(page, ids);
  expect(r.where, `두 상태가 겹친 판에서 t 가 프레임 안이 아니다(${r.where})`).toBe('inside');
});

test('OV-j (R4 무변) Esc → 선택 전부 해제 ＋ _enteredFrame 비움 ＋ 덮개 복귀(자식 pointer-events none)', async ({ page }) => {
  const ids = await scene(page);
  for (const how of ['empty', 'child']) {
    if (how === 'empty') await gesture(page, ids.fr, 0.9, 0.92, true, ids.fr);
    else await gesture(page, ids.kids[0].tu, 0.3, 0.5, true, ids.fr);
    const pre = await page.evaluate((ids) => ({ entered: !!window._enteredFrame, sel: document.querySelectorAll('#canvas .selected').length }), ids);
    expect(pre.entered || pre.sel > 0, `[전제] ${how} 진입 뒤 무언가 들어간 상태다`).toBe(true);
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
    const r = await page.evaluate((ids) => ({ sel: document.querySelectorAll('#canvas .selected').length, entered: window._enteredFrame || null,
      pe: getComputedStyle(document.getElementById(ids.kids[0].tu)).pointerEvents }), ids);
    expect(r, `${how}: Esc 뒤 «전부 해제 · 진입 표시 없음 · 덮개 복귀»가 아니다`).toEqual({ sel: 0, entered: null, pe: 'none' });
  }
});
