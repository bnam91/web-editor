/* frame-see-through-hover-t207 — 0.9.12 t2-07(현빈 261112 Q9 A안): 배경이 안 보이는(투명·순백) 프레임은 지나갈 때 경계 아웃라인(Figma식).
 *   클릭 규칙은 «무변» — 아래 클릭 칸은 고치기 전 판에서도 초록이다(이 버그가 판정 문제가 아니었다는 증거 · 조사 보고 261112).
 *   T1 경계   — 투명 프레임 테두리 안쪽 4px 에 지나가면 아웃라인 · 누르면 그 프레임 selected
 *   T2 자식    — 투명 프레임의 글자 위 더블클릭 → 글자만 selected(프레임 아님)
 *   T3 빈 영역 — 투명 프레임 빈 곳 지나가면 아웃라인 · 누르면 프레임 selected
 *   T4 중첩    — outer>mid>leaf 다 투명: leaf 자리 지나가면 outer «만» 긋는다(클릭이 고를 것) · 더블 2번 → leaf selected
 *   T5 레이어  — leaf 레이어 항목 클릭 → leaf selected
 *   W1 흰색    — #FFFFFF 프레임 지나가면 아웃라인 · 배경투명도 0 프레임도 아웃라인
 *   W2 [음성대조] #EFEFEF·빨강 프레임은 지나가도 아웃라인 없음 · 선택된 투명 프레임은 선택선 그대로(지나감 선 아님)
 * 양성대조: css/editor-blocks.css 의 `.frame-block.frame-see-through…:hover` 규칙(t2-07 주석 밑 한 덩이)을 지우면 T1·T3·T4(outer)·W1 빨강, T2·T5·W2·클릭 칸 초록.
 *   S1 저장 오염 — 지나감 표식이 히스토리 직렬·serializeProject·캡처 클론에 안 샌다(양성대조는 그 칸 주석)
 * 하네스 = bootApp(앱 안 띄움). 누를 자리는 누르기 직전 다시 잰다. 대기는 조건으로만(f2·until).
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 대기는 «조건»으로만(tests/unit/dom-fixed-wait-census W3·W4) — f2 = 두 프레임 · until = 기대 상태를 최대 2초 기다린 뒤 «그래도» 단언한다(안 서면 단언이 제 말로 빨개진다). */
const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const until = async (page, fn, arg) => { await page.waitForFunction(fn, arg, { timeout: 2000 }).catch(() => {}); await f2(page); };

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  expect(errs, '앱 부팅 pageerror').toEqual([]);
  const ids = await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sT7" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`);
    window.rebindAll?.(); window.applyZoom?.(50);
    const sec = document.getElementById('sT7');
    const made = (sel, fn) => { const b = new Set([...document.querySelectorAll('#canvas ' + sel)].map(e => e.id)); fn(); return [...document.querySelectorAll('#canvas ' + sel)].find(e => !b.has(e.id)); };
    const F = (bg, h = 200) => { window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
      const f = made('.frame-block:not([data-text-frame])', () => window.addFrameBlock({ bg })); f.style.height = h + 'px'; f.style.minHeight = h + 'px'; return f; };
    const tr = F('rgba(0, 0, 0, 0)');
    window.deselectAll?.(); window._activeFrame = tr;
    const t = made('.text-block', () => window.addTextBlock('body'));
    const ed = t.querySelector('[contenteditable]') || t.querySelector('[class^="tb-"]'); if (ed) ed.textContent = '투명 프레임 안 글';
    const tu = t.closest('.frame-block[data-text-frame]') || t; tu.style.left = '40px'; tu.style.top = '30px'; tu.style.width = '260px';
    const white = F('#FFFFFF'), grey = F('#EFEFEF'), red = F('#ff0000');
    const op0 = F('#EFEFEF'); op0.dataset.bgOpacity = '0'; op0.style.setProperty('--frame-bg-opacity', '0'); op0.classList.add('has-bg-opacity'); window.syncFrameBgVars(op0);
    const outer = F('rgba(0, 0, 0, 0)', 400), mid = F('rgba(0, 0, 0, 0)'), leaf = F('rgba(0, 0, 0, 0)');
    const place = (ch, par, l, tp, w, h) => { const u = ch.closest('.row') && ch.closest('.row').children.length === 1 ? ch.closest('.row') : ch;
      Object.assign(ch.style, { position: 'absolute', left: l + 'px', top: tp + 'px', width: w + 'px', height: h + 'px', minHeight: h + 'px', margin: '0' }); par.appendChild(ch); if (u !== ch) u.remove(); };
    place(mid, outer, 100, 60, 500, 260); place(leaf, mid, 40, 40, 200, 120);
    window.rebindAll?.(); window.buildLayerPanel?.(); window.deselectAll?.(); window._activeFrame = null;
    return { tr: tr.id, tb: t.id, white: white.id, grey: grey.id, red: red.id, op0: op0.id, outer: outer.id, mid: mid.id, leaf: leaf.id };
  });
  await page.waitForFunction((ids) => Object.values(ids).every((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && r.width > 0 && r.height > 0; }), ids);
  await f2(page);
  return ids;
}
const pt = (page, id, fx, fy, inset = 0) => page.evaluate(({ id, fx, fy, inset }) => { const r = document.getElementById(id).getBoundingClientRect();
  return { x: inset ? r.right - inset : r.left + r.width * fx, y: r.top + r.height * fy }; }, { id, fx, fy, inset });
async function hover(page, id, fx = 0.5, fy = 0.5, inset = 0) {
  await page.mouse.move(3, 3); const p = await pt(page, id, fx, fy, inset); await page.mouse.move(p.x, p.y, { steps: 3 });
  await page.waitForFunction(({ x, y }) => !!document.elementFromPoint(x, y)?.matches(':hover'), p); await f2(page); return p;
}
const outline = (page, id) => page.evaluate((id) => getComputedStyle(document.getElementById(id)).outlineStyle, id);
const sel = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .frame-block.selected, #canvas .text-block.selected')].map(e => e.id));

test('T1 경계 — 투명 프레임 테두리 안쪽 4px: 지나가면 아웃라인 · 누르면 그 프레임', async ({ page }) => {
  const ids = await scene(page);
  const p = await hover(page, ids.tr, 0, 0.6, 4);
  expect(await outline(page, ids.tr), '투명 프레임 경계에 지나감 아웃라인이 없다').toBe('solid');
  await page.mouse.click(p.x, p.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.tr);
  expect(await sel(page)).toEqual([ids.tr]);
});

/* T2 기대값 = 옛 동작(인텔 261112 첫 판 빨강 뒤 가름): 자식 위 더블클릭은 «진입 ＋ 자식 선택»이고 부모 프레임 .selected 는 남는다.
   근거(스크래치 프로브 · 기준판 aded4a28a 와 고친 판 둘 다 · 투명·#EFEFEF 둘 다 같음): selected = [프레임, 글자] · 글자 래퍼(data-text-frame)는 안 골라짐 · 편집 아님.
   OV-c(frame-dblclick-overlay)도 프레임 쪽은 단언하지 않는다. ⇒ 이 칸이 재는 것: 투명이어도 자식이 골라진다(＝불투명과 같은 결과). */
test('T2 자식 충돌 — 투명 프레임 글자 위 더블클릭 → 글자 selected(＋부모 프레임 = 옛 동작) · 편집 아님', async ({ page }) => {
  const ids = await scene(page);
  const p = await pt(page, ids.tb, 0.3, 0.5);
  await page.mouse.dblclick(p.x, p.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.tb);
  expect((await sel(page)).sort()).toEqual([ids.tr, ids.tb].sort());
  expect(await page.evaluate(() => !!document.activeElement?.isContentEditable), '한 번의 더블클릭이 편집까지 갔다').toBe(false);
});

test('T3 빈 영역 — 투명 프레임 빈 곳: 지나가면 아웃라인 · 누르면 프레임', async ({ page }) => {
  const ids = await scene(page);
  const p = await hover(page, ids.tr, 0.85, 0.85);
  expect(await outline(page, ids.tr), '투명 프레임 빈 곳에 지나감 아웃라인이 없다').toBe('solid');
  await page.mouse.click(p.x, p.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.tr);
  expect(await sel(page)).toEqual([ids.tr]);
});

test('T4 중첩 투명 — leaf 자리 지나가면 outer 만 긋는다 · 더블 2번 → leaf', async ({ page }) => {
  const ids = await scene(page);
  await hover(page, ids.leaf, 0.5, 0.5);
  expect([await outline(page, ids.outer), await outline(page, ids.mid), await outline(page, ids.leaf)], '클릭이 고를 outer 만 그어야 한다').toEqual(['solid', 'none', 'none']);
  let p = await pt(page, ids.leaf, 0.85, 0.85); await page.mouse.dblclick(p.x, p.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.mid);
  expect(await sel(page), '[전제] 더블 1번 = mid').toEqual([ids.mid]);
  p = await pt(page, ids.leaf, 0.85, 0.85); await page.mouse.dblclick(p.x, p.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.leaf);
  expect(await sel(page)).toEqual([ids.leaf]);
});

/* T5 준비 — 중첩 프레임 레이어 행은 접힌 채 그려진다(.layer-row-group.collapsed → .layer-row-children display:none). 사람이 하듯 outer → mid 의 꺾쇠를 실클릭으로 편다.
   ⚠️꺾쇠는 svg 라 offsetParent 가 없다 — 보임은 rect 로 잰다(첫 판이 그걸 못 펴고 «[전제] 보인다»에서 늘 빨강이었다). */
test('T5 레이어 패널 — leaf 항목 클릭 → leaf selected', async ({ page }) => {
  const ids = await scene(page);
  for (const id of [ids.outer, ids.mid]) {
    const c = await page.evaluate((id) => { const g = document.getElementById(id)?._layerItem?.closest('.layer-row-group');
      const ch = g?.querySelector(':scope > .layer-row-header .layer-chevron'); if (!ch) return null;
      if (!g.classList.contains('collapsed')) return { open: true };
      ch.scrollIntoView({ block: 'center' }); const r = ch.getBoundingClientRect(); return r.width ? { x: r.left + r.width / 2, y: r.top + r.height / 2 } : null; }, id);
    expect(c, `[전제] ${id} 레이어 꺾쇠가 보인다`).not.toBeNull();
    if (!c.open) { await page.mouse.click(c.x, c.y); await until(page, (id) => !document.getElementById(id)._layerItem.closest('.layer-row-group').classList.contains('collapsed'), id); }
  }
  const li = await page.evaluate((id) => { const l = document.getElementById(id)?._layerItem; if (!l || !l.offsetParent) return null; l.scrollIntoView({ block: 'center' });
    const r = l.getBoundingClientRect(); return { x: r.left + Math.min(60, r.width / 2), y: r.top + r.height / 2 }; }, ids.leaf);
  expect(li, '[전제] leaf 레이어 항목이 보인다').not.toBeNull();
  await page.mouse.click(li.x, li.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.leaf);
  expect(await sel(page)).toContain(ids.leaf);
});

test('W1 흰색 #FFFFFF · 배경투명도 0 — 지나가면 아웃라인', async ({ page }) => {
  const ids = await scene(page);
  await hover(page, ids.white); expect(await outline(page, ids.white), '흰 프레임').toBe('solid');
  await hover(page, ids.op0); expect(await outline(page, ids.op0), '배경투명도 0 프레임').toBe('solid');
});

test('W2 [음성대조] 회색·빨강은 안 긋는다 · 선택된 투명 프레임은 선택선(지나감 아님)', async ({ page }) => {
  const ids = await scene(page);
  await hover(page, ids.grey); expect(await outline(page, ids.grey), '#EFEFEF 에 그었다').toBe('none');
  await hover(page, ids.red); expect(await outline(page, ids.red), '빨강에 그었다').toBe('none');
  const p = await hover(page, ids.tr, 0.85, 0.85); await page.mouse.click(p.x, p.y); await until(page, (id) => document.getElementById(id).classList.contains('selected'), ids.tr);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), ids.tr), '[전제] 골라졌다').toBe(true);
  expect(await outline(page, ids.tr), '선택선').toBe('solid');
});

/* S1 저장 오염(int-2 지디 261112) — 표식 .frame-see-through 은 mouseenter 가 다는 «편집 전용» 상태다. 명부에 없어서 저장본·⌘Z 표본에 샜다
   (증상: tests/dom/nested-frame-width-cap.dom.spec.js W1 stack 「A3 ⌘Z 한 번 뒤 화면 = 조작 전 내용」 빨강).
   재는 것: 지나가는 «중»에도 ⑴ 히스토리 직렬(getSerializedCanvas — _history-step 의 A3 가 비교하는 그 문자열)이 지나가기 전과 «같다»
     ⑵ serializeProject 문자열에 표식 0 ⑶ PNG·썸네일 공용 겹(stripEditorOnlyForCapture) 클론에 표식 0.
   양성대조: js/io/section-serialize.js RUNTIME_MARKER_CLS 의 'frame-see-through' 줄을 빼면 ⑴⑵ 빨강 · capture-safety EDITOR_STATE_CLS 줄을 빼면 ⑶ 빨강. */
test('S1 지나감 표식이 저장·히스토리·캡처에 안 샌다', async ({ page }) => {
  const ids = await scene(page);
  await page.mouse.move(3, 3); await f2(page);
  const before = await page.evaluate(() => window.getSerializedCanvas());
  await hover(page, ids.tr, 0.85, 0.85);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('frame-see-through'), ids.tr), '[전제] 지나가는 중 표식이 섰다').toBe(true);
  const r = await page.evaluate(async () => {
    const hist = window.getSerializedCanvas();
    const proj = window.serializeProject();
    const clone = document.getElementById('sT7').cloneNode(true);
    (await import('/js/io/capture-safety.js')).stripEditorOnlyForCapture(clone);
    return { hist, proj: proj.includes('frame-see-through'), cap: !!clone.querySelector('.frame-see-through') };
  });
  expect(r.hist === before, '지나가는 것만으로 히스토리 직렬이 달라졌다(⌘Z 표본 오염)').toBe(true);
  expect(r.proj, 'serializeProject 에 frame-see-through 가 실렸다').toBe(false);
  expect(r.cap, '캡처 클론에 frame-see-through 가 남았다').toBe(false);
});
