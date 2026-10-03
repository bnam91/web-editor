/* free-frame-grid-width-exits.dom.spec.js — F3 후속 «떠나는 입구» 다섯 곳을 이름으로 잰다 (지디 조건, 2026-10-03)
 *   ① moveBlock(MCP) ② ungroupBlock ③ _bindPastedEl(붙여넣기·⌘D) ④ exitFloat ⑤ 레이어 패널 섹션 drop(insertIntoSec·다중 이동)
 * 곳마다: 자동 폭 그리드가 자유 프레임 «밖»으로 → 100%(키·표시 없음) · «다른» 자유 프레임으로 → 그 프레임 × 0.8 · 사용자 폭 → 그대로.
 * ⚠️진짜 입력이 아니라 «그 입구 함수»를 실제 앱 코드로 직접 부른다(bootApp). 곳별 까닭:
 *   ① MCP 문 자체가 함수 호출(window.moveBlock)이다 — 입력 장치가 없다.
 *   ② 그룹 풀기 단축키·메뉴는 ungroupBlock 하나로 모인다 — 그 함수를 부른다(그룹은 DOM 으로 짓는다).
 *   ③ 시스템 클립보드 대신 앱 내부 clipboard 를 쓰는 copySelected/pasteClipboard/duplicateSelected 를 부른다(⌘C/⌘V 키 배선은 안 잰다).
 *   ④ 오버레이 토글 버튼 배선 대신 window.OverlayFloat.enterFloat/exitFloat 를 부른다.
 *   ⑤ 레이어 패널 HTML5 끌기는 하네스에서 dragover rAF·지시선이 안정적으로 안 선다 → window.layerDragSrc 를 세우고
 *      그 섹션 .layer-children 에 drop 이벤트를 «합성»해 실제 drop 핸들러를 태운다(진짜 마우스 아님).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sX" data-section="1" data-name="sX"><div class="section-hitzone"></div><div class="section-inner" id="innerX">
  <div class="gap-block" data-type="gap" style="height:20px"></div>
  <div class="frame-block" id="frA" data-free-layout="true" style="position:relative;width:764px;height:260px;margin:0 auto"></div>
  <div class="gap-block" data-type="gap" style="height:20px"></div>
  <div class="frame-block" id="frB" data-free-layout="true" style="position:relative;width:400px;height:260px;margin:0 auto">
    <div class="row" id="rowBT" style="position:absolute;left:0px;top:0px;width:120px"><div class="text-block" id="tB" data-type="body"><div class="tb-body">B</div></div></div>
  </div>
  <div class="gap-block" data-type="gap" style="height:20px"></div>
  <div class="row" id="rowT"><div class="text-block" id="tFlow" data-type="body"><div class="tb-body">흐름 글</div></div></div>
  <div class="gap-block" data-type="gap" style="height:80px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1300 });
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html); window.rebindAll?.(); window.deselectAll?.();
    window.applyZoom?.(100);
  }, SEC);
  await page.waitForTimeout(300);
  return errs;
}
/* frA 에 패널 삽입(자동 폭). user 면 그 뒤 updateGridBlock width 300. */
const mkGrid = (page, user) => page.evaluate((user) => {
  const fr = document.getElementById('frA'), sec = document.getElementById('sX');
  window.deselectAll?.(); sec.classList.add('selected'); fr.classList.add('selected'); window._activeFrame = fr;
  const id = window.addGridBlock({}).block.id;
  if (user) window.updateGridBlock(id, { width: 300 });
  window.deselectAll?.(); window._activeFrame = null;
  return id;
}, user);
const st = (page, id) => page.evaluate((id) => {
  const g = document.getElementById(id);
  if (!g) return null;
  const fr = g.closest('.frame-block[data-free-layout="true"]');
  const i = document.getElementById('innerX'), cs = getComputedStyle(i);
  const u = g.parentElement && g.parentElement.classList.contains('row') ? g.parentElement : g;
  return { where: fr ? fr.id : 'sec', w: g.offsetWidth, uw: u.offsetWidth, uPos: u.style.position, uCssW: u === g ? '(블럭)' : u.style.width, key: g.dataset.gridWidth ?? null, auto: g.dataset.gridWidthAuto ?? null,
           float: g.dataset.overlayBlock === 'true' || !!g.closest('[data-overlay-block="true"]'),
           secW: i.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight),
           fB: Math.round(document.getElementById('frB').clientWidth * 0.8) };
}, id);
const OUT = (s) => ({ where: s.where, w: s.w, key: s.key, auto: s.auto });

async function premise(page, id, user) {
  const s = await st(page, id);
  expect({ where: s.where, key: s.key, auto: s.auto }, '전제 — frA 안 ' + (user ? '사용자 폭 300' : '자동 폭 611'))
    .toEqual(user ? { where: 'frA', key: '300', auto: null } : { where: 'frA', key: '611', auto: '1' });
}
function expectOut(s, label) { expect(OUT(s), `${label} — 섹션으로 나오면 100%`).toEqual({ where: 'sec', w: s.secW, key: null, auto: null }); }
function expectInB(s, label) {
  expect(OUT(s), `${label} — frB 로 들어가면 frB × 0.8`).toEqual({ where: 'frB', w: s.fB, key: String(s.fB), auto: '1' });
  /* ★끌리는 단위(row)의 폭도 그 폭이어야 한다 — T-088 클램프는 «단위» 폭으로 잰다. row 에 옛 px 가 남으면 다시 «수직만». */
  expect(s.uw, `${label} — 끌리는 단위 폭(${s.uCssW})이 그리드 폭과 다르다`).toBe(s.w);
}
function expectUser(s, label, where) { expect(OUT(s), `${label} — 사용자 폭 그대로`).toEqual({ where, w: 300, key: '300', auto: null }); }

/* ── ① moveBlock (MCP move_block) ── */
test('①a moveBlock — 섹션 흐름으로 옮기면 100%', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  expect(await page.evaluate((id) => !!window.moveBlock(id, { afterId: 'tFlow' }), id), '전제 — 옮겼다').toBe(true);
  expectOut(await st(page, id), '①a'); expect(errs).toEqual([]);
});
test('①b moveBlock — 다른 자유 프레임(frB)으로 옮기면 frB × 0.8', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  expect(await page.evaluate((id) => !!window.moveBlock(id, { afterId: 'tB' }), id)).toBe(true);
  expectInB(await st(page, id), '①b'); expect(errs).toEqual([]);
});
test('①c moveBlock — 사용자 폭은 섹션으로 옮겨도 그대로', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page, true); await premise(page, id, true);
  await page.evaluate((id) => window.moveBlock(id, { afterId: 'tFlow' }), id);
  expectUser(await st(page, id), '①c', 'sec'); expect(errs).toEqual([]);
});

/* ── ② ungroupBlock — 그리드를 그룹 상자에 담아 «어디»에 두고 푼다 ── */
const groupAndUngroup = (page, id, hostId) => page.evaluate(([id, hostId]) => {
  const g = document.getElementById(id), unit = g.parentElement.classList.contains('row') ? g.parentElement : g;
  const host = document.getElementById(hostId);
  const grp = document.createElement('div');
  grp.className = 'frame-block'; grp.id = 'grpT'; grp.dataset.freeLayout = 'true'; grp.dataset.group = 'true';
  grp.style.cssText = 'position:absolute;left:10px;top:40px;width:700px;height:150px;';
  if (host.classList.contains('section-inner')) grp.style.position = 'relative';
  host.appendChild(grp);
  unit.style.position = 'absolute'; unit.style.left = '0px'; unit.style.top = '0px';
  grp.appendChild(unit);
  window.syncAutoGridWidth?.(unit);   // 그룹 안 = 손대지 않음(그 자체도 잰다: 아래 전제)
  const inGroup = { key: g.dataset.gridWidth ?? null };
  window.ungroupBlock(grp);
  return { inGroup, grpGone: !document.getElementById('grpT') };
}, [id, hostId]);
test('②a ungroupBlock — 섹션 흐름에 놓인 그룹을 풀면 100%', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  const r = await groupAndUngroup(page, id, 'innerX');
  expect(r, '전제 — 그룹 안에선 키 그대로 · 풀렸다').toEqual({ inGroup: { key: '611' }, grpGone: true });
  expectOut(await st(page, id), '②a'); expect(errs).toEqual([]);
});
test('②b ungroupBlock — frB 안 그룹을 풀면 frB × 0.8', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  const r = await groupAndUngroup(page, id, 'frB');
  expect(r.grpGone).toBe(true);
  expectInB(await st(page, id), '②b'); expect(errs).toEqual([]);
});
test('②c ungroupBlock — 사용자 폭은 그대로', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page, true); await premise(page, id, true);
  await groupAndUngroup(page, id, 'innerX');
  expectUser(await st(page, id), '②c', 'sec'); expect(errs).toEqual([]);
});

/* ── ③ _bindPastedEl — 붙여넣기·⌘D ── */
const copyThenPaste = (page, id, target) => page.evaluate(([id, target]) => {
  const before = new Set([...document.querySelectorAll('.grid-block')].map(g => g.id));
  window.deselectAll?.(); window.selectBlock?.(id); window.copySelected();
  window.deselectAll?.();
  const sec = document.getElementById('sX'); sec.classList.add('selected');
  /* ★F1(2026-10-03 지디 결정)과 맞춘다 — 프레임을 «오브젝트로» 고른 채 ⌘V 는 이제 프레임의 «다음 형제»로 간다.
     그래서 «frB 안으로» 붙이는 길은 frB 안의 자식을 고른 상태다(레인 통합 때 이 시험이 섹션으로 간 것을 보고 고침). */
  if (target === 'frB') { const fr = document.getElementById('frB'); fr.classList.add('selected'); window._activeFrame = fr;
    let kid = document.getElementById('frBkid');
    if (!kid) { fr.insertAdjacentHTML('beforeend', '<div class="gap-block" data-type="gap" id="frBkid" style="position:absolute;left:0;top:0;width:60px;height:20px"></div>'); kid = document.getElementById('frBkid'); }
    kid.classList.add('selected'); }
  else { window._activeFrame = null; document.getElementById('tFlow').classList.add('selected'); }
  window.pasteClipboard();
  const nu = [...document.querySelectorAll('.grid-block')].map(g => g.id).filter(x => !before.has(x));
  return nu;
}, [id, target]);
test('③a 붙여넣기 — frA 의 자동 폭 그리드를 섹션에 붙이면 사본은 100%', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  const nu = await copyThenPaste(page, id, 'sec');
  expect(nu.length, '전제 — 사본 하나').toBe(1);
  expectOut(await st(page, nu[0]), '③a');
  expect((await st(page, id)).key, '원본은 frA 그대로').toBe('611');
  expect(errs).toEqual([]);
});
test('③b 붙여넣기 — frB 안 자식을 고른 채 붙이면 사본은 frB × 0.8', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  const nu = await copyThenPaste(page, id, 'frB');
  expect(nu.length).toBe(1);
  expectInB(await st(page, nu[0]), '③b'); expect(errs).toEqual([]);
});
test('③c ⌘D — 같은 프레임 사본은 frA 기준 자동 폭 그대로', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  const nu = await page.evaluate((id) => {
    const before = new Set([...document.querySelectorAll('.grid-block')].map(g => g.id));
    window.__before = before; window.deselectAll?.(); window.selectBlock?.(id); document.activeElement?.blur?.();
    return true;
  }, id).then(async () => {
    await page.keyboard.press('Meta+d'); await page.waitForTimeout(200);   // ⌘D — 실제 키(duplicateSelected 는 window 에 없다)
    return page.evaluate(() => [...document.querySelectorAll('.grid-block')].map(g => g.id).filter(x => !window.__before.has(x)));
  });
  expect(nu.length).toBe(1);
  expect(OUT(await st(page, nu[0]))).toEqual({ where: 'frA', w: 611, key: '611', auto: '1' });
  expect(errs).toEqual([]);
});
test('③d 붙여넣기 — 사용자 폭 사본은 섹션에서도 300', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page, true); await premise(page, id, true);
  const nu = await copyThenPaste(page, id, 'sec');
  expect(nu.length).toBe(1);
  expectUser(await st(page, nu[0]), '③d', 'sec'); expect(errs).toEqual([]);
});

/* ── ④ exitFloat — 띄웠다가 내릴 때 «돌아갈 곳»이 바뀌었으면 ── */
const floatThenExit = (page, id, mode) => page.evaluate(([id, mode]) => {
  const OF = window.OverlayFloat, g = document.getElementById(id);
  const pos = OF.posElOf(g);
  const okIn = OF.enterFloat(pos);
  const floating = g.dataset.overlayBlock === 'true' || !!g.closest('[data-overlay-block="true"]');
  if (mode === 'frameGone') document.getElementById('frA').remove();        // 돌아갈 프레임이 그 사이 지워졌다 → 섹션 본문 폴백
  if (mode === 'toB') pos.dataset.overlayReturnParent = 'frB';              // 돌아갈 곳이 frB
  const okOut = OF.exitFloat(pos);
  return { okIn, floating, okOut };
}, [id, mode]);
test('④a exitFloat — 돌아갈 프레임이 사라져 섹션으로 내려오면 100%', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  expect(await floatThenExit(page, id, 'frameGone'), '전제 — 떴다가 내렸다').toEqual({ okIn: true, floating: true, okOut: true });
  expectOut(await st(page, id), '④a'); expect(errs).toEqual([]);
});
test('④b exitFloat — frB 로 내려오면 frB × 0.8', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
  expect(await floatThenExit(page, id, 'toB')).toEqual({ okIn: true, floating: true, okOut: true });
  expectInB(await st(page, id), '④b'); expect(errs).toEqual([]);
});
test('④c exitFloat — 사용자 폭은 섹션으로 내려와도 300', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page, true); await premise(page, id, true);
  await floatThenExit(page, id, 'frameGone');
  expectUser(await st(page, id), '④c', 'sec'); expect(errs).toEqual([]);
});

/* ── ⑤ 레이어 패널 섹션 drop — 합성 drop 이벤트로 실제 핸들러를 태운다 ── */
const layerDrop = (page, ids, withIndicator) => page.evaluate(([ids, withIndicator]) => {
  window.buildLayerPanel?.();
  const sec = document.getElementById('sX');
  const kids = sec._layerEl?.querySelector('.layer-children');
  if (!kids) return { ok: false, why: 'layer-children 없음' };
  const units = ids.map(id => { const g = document.getElementById(id); return g.parentElement.classList.contains('row') ? g.parentElement : g; });
  window.layerDragSrc = { _dragTarget: units[0] };
  window.layerMultiDragTargets = units.length > 1 ? units : null;
  if (withIndicator) {
    const ind = document.createElement('div'); ind.className = 'layer-drop-indicator';
    kids.appendChild(ind);
  }
  kids.dispatchEvent(new Event('drop', { bubbles: true, cancelable: true }));
  return { ok: true };
}, [ids, withIndicator]);
for (const ind of [true, false]) {
  test(`⑤a 레이어 drop(insertIntoSec, 지시선 ${ind ? '있음' : '없음'}) — frA 의 자동 폭 그리드를 섹션으로 → 100%`, async ({ page }) => {
    const errs = await setup(page); const id = await mkGrid(page); await premise(page, id);
    expect(await layerDrop(page, [id], ind)).toEqual({ ok: true });
    expectOut(await st(page, id), `⑤a(${ind ? '지시선' : '지시선 없음'})`); expect(errs).toEqual([]);
  });
}
test('⑤b 레이어 다중 이동 — 자동 폭 그리드 둘을 섹션으로 → 둘 다 100%', async ({ page }) => {
  const errs = await setup(page); const id1 = await mkGrid(page); const id2 = await mkGrid(page);
  await premise(page, id1); await premise(page, id2);
  expect(await layerDrop(page, [id1, id2], true)).toEqual({ ok: true });
  expectOut(await st(page, id1), '⑤b-1'); expectOut(await st(page, id2), '⑤b-2'); expect(errs).toEqual([]);
});
test('⑤c 레이어 drop — 사용자 폭은 섹션으로 옮겨도 300', async ({ page }) => {
  const errs = await setup(page); const id = await mkGrid(page, true); await premise(page, id, true);
  await layerDrop(page, [id], true);
  expectUser(await st(page, id), '⑤c', 'sec'); expect(errs).toEqual([]);
});
