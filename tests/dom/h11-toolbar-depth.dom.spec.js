/* h11-toolbar-depth.dom.spec.js — H11(현빈 2026-10-05 「한 번 클릭 후에는 프레임 밖에 삽입되어야지」 · 지디 재지시): 툴바 넣기의 «깊이»
 *
 * 머리표(지디 규율): [새 것] d1f642ff 에서 빨강 · [회귀 지킴·안전망] d1f642ff 에서도 초록 · [전제] 재기 위한 조건.
 * 규칙(판정 한 자리 = js/drag-utils.js frameTakesInsert):
 *   ⒤ 프레임을 «한 번 클릭»(오브젝트 선택 — 자손 선택 0) → 툴바 넣기는 프레임 «다음 형제»(밖).
 *   ⒥ «들어간 상태»(프레임 클릭 → 자식 클릭 = 자식이 골라짐) → 툴바 넣기는 프레임 «안»(09-23 의 요구가 drill-in 으로 산다 — 안전망).
 * 실측(H11-F1/README · h11b-base.json, d1f642ff 실앱): ⒤ 툴바 넷(Graph·T▾ Heading·이미지 Standard·도형 Rectangle) «안» ✗ · ⒥ 넷 «안» ✓.
 * ⒜(10-05 지디 승인) 정의: «drill-in 할 대상이 없는 프레임(자식 요소 0)은 그 자체가 안쪽 상태다 ⇒ 안에 넣는다» — 아래 E-* 경계 행(I-* 장면은 자식이 있어 그대로 밖).
 * 하네스 = bootApp(앱 통째) · 고르기·메뉴 = clickAt(누르기 직전 맞힌 요소 단언) · 상태 대기. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const KINDS = {
  free: 'data-free-layout="true" style="position:relative;width:600px;height:320px;"',
  flow: 'data-full-width="true" style="width:600px;min-height:260px;"',
};
const CHILD = {
  free: '<div class="text-block" id="kid" data-type="heading" style="position:absolute;left:20px;top:20px;width:260px;"><div class="tb-h2" contenteditable="false">자식</div></div>',
  flow: '<div class="frame-block" id="kidTF" data-text-frame="true" data-bg="transparent" style="background:transparent;width:100%;box-sizing:border-box;"><div class="text-block" id="kid" data-type="heading"><div class="tb-h2" contenteditable="false">자식</div></div></div>',
};
const sec = (kind) => `<div class="section-block" id="sH" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inH">
  <div class="gap-block" data-type="gap" style="height:30px"></div>
  <div class="row" id="rowF" data-layout="stack"><div class="frame-block" id="FR" ${KINDS[kind]}>${CHILD[kind]}</div></div>
  <div class="gap-block" id="gAfter" data-type="gap" style="height:200px"></div></div></div>`;
/* 툴바 길 넷 — index.html 의 그 단추·그 항목(진짜 클릭) */
const PATHS = [
  { name: 'Graph', title: '컴포넌트', item: 'Graph', cls: '.graph-block' },
  { name: 'Heading', title: '텍스트 블록 추가', item: 'Heading', cls: '.text-block' },
  { name: 'Standard', title: '이미지(Asset)', item: 'Standard', cls: '.asset-block' },
  { name: 'Rectangle', title: '도형 추가', item: 'Rectangle', cls: '.shape-block' },
];

async function setup(page, kind) {
  await page.setViewportSize({ width: 1600, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('FR').scrollIntoView({ block: 'center' });
  }, sec(kind));
  await page.waitForTimeout(300);
  return errs;
}
const framePoint = (page) => page.evaluate(() => { const f = document.getElementById('FR'); const r = f.getBoundingClientRect();
  for (let y = Math.round(r.bottom - 6); y > r.top; y -= 4) for (const x of [Math.round(r.right - 10), Math.round(r.left + 10)]) { if (document.elementFromPoint(x, y) === f) return [x, y]; } return null; });
const kidPoint = (page) => page.evaluate(() => { const t = document.querySelector('#kid [class^="tb-"]'); const r = t.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; });
async function clickFrame(page) {
  const p = await framePoint(page); expect(p, '[전제] 프레임 빈 자리').toBeTruthy();
  await clickAt(page, p[0], p[1], { sel: '#FR' }, { label: '프레임 한 번 클릭' });
  await expect.poll(() => page.evaluate(() => document.getElementById('FR').classList.contains('selected') && !document.querySelector('#FR .selected')), { message: '[전제] 프레임만 골라짐(자손 0)' }).toBe(true);
}
async function drillIn(page) {
  await clickFrame(page);
  const k = await kidPoint(page);
  await page.waitForTimeout(400);   // 두 번 클릭이 «더블클릭»으로 묶이지 않게(앱의 들어가기 = 따로 두 번)
  await clickAt(page, k[0], k[1], { sel: '.text-block' }, { label: '자식 클릭(들어가기)' });
  await expect.poll(() => page.evaluate(() => document.getElementById('FR').classList.contains('selected') && !!document.querySelector('#FR .text-block.selected')), { message: '[전제] 들어간 상태(프레임 + 자식 골라짐)' }).toBe(true);
}
async function toolbar(page, p) {
  const b = await page.evaluate((t) => { const e = [...document.querySelectorAll('button[title]')].find(x => x.title.includes(t) && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, p.title);
  await clickAt(page, b[0], b[1], { sel: 'button[title]' }, { label: `툴바 ${p.title}` }); await page.waitForTimeout(250);
  const it = await page.evaluate((t) => { const e = [...document.querySelectorAll('.fp-menu-item')].find(x => x.textContent.trim() === t && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, p.item);
  await clickAt(page, it[0], it[1], { sel: '.fp-menu-item' }, { label: `항목 ${p.item}` }); await page.waitForTimeout(400);
}
const newOne = (page, cls, before) => page.evaluate(([cls, before]) => { const n = [...document.querySelectorAll(`#canvas ${cls}`)].filter(e => !before.includes(e.id));
  if (n.length !== 1) return { n: n.length };
  const e = n[0]; let unit = e; while (unit.parentElement && unit.parentElement.id !== 'inH' && unit.parentElement.id !== 'FR') unit = unit.parentElement;   // 섹션 본문(또는 프레임) 바로 아래 단위(글자 프레임·행·도형 래퍼째)
  return { n: 1, inside: !!e.closest('#FR'), prevOfUnit: unit.previousElementSibling ? unit.previousElementSibling.id : null, unitParent: unit.parentElement.id || unit.parentElement.className.split(' ')[0] }; }, [cls, before]);
const ids = (page, cls) => page.evaluate((cls) => [...document.querySelectorAll(`#canvas ${cls}`)].map(e => e.id), cls);

for (const kind of ['free', 'flow']) for (const p of PATHS) {
  test(`I-${kind}-${p.name} [새 것] 프레임 한 번 클릭 → 툴바 「${p.item}」 = 프레임 «다음 형제»(밖)`, async ({ page }) => {
    const errs = await setup(page, kind);
    const before = await ids(page, p.cls);
    await clickFrame(page);
    await toolbar(page, p);
    const r = await newOne(page, p.cls, before);
    expect(r.n, `[전제] 새 ${p.cls} 하나 ${JSON.stringify(r)}`).toBe(1);
    expect(r.inside, `★한 번 클릭인데 프레임 «안»으로 ${JSON.stringify(r)}`).toBe(false);
    expect(r.prevOfUnit, `★다음 형제 = 프레임을 담은 행(rowF) 바로 뒤 ${JSON.stringify(r)}`).toBe('rowF');
    expect(errs).toEqual([]);
  });
  test(`J-${kind}-${p.name} [회귀 지킴·안전망] 들어간 상태(프레임 → 자식 클릭) → 툴바 「${p.item}」 = 프레임 «안»(09-23 요구)`, async ({ page }) => {
    const errs = await setup(page, kind);
    const before = await ids(page, p.cls);
    await drillIn(page);
    await toolbar(page, p);
    const r = await newOne(page, p.cls, before);
    expect(r.n, `[전제] 새 ${p.cls} 하나 ${JSON.stringify(r)}`).toBe(1);
    expect(r.inside, `★들어간 상태인데 프레임 «밖»으로 ${JSON.stringify(r)}`).toBe(true);
    expect(errs).toEqual([]);
  });
}

/* ══ H11 ⒜(2026-10-05 지디 승인) — 정의: 삽입은 «선택 깊이»를 따른다. drill-in 할 대상이 없는 프레임(자식 요소 0)은 그 자체가 안쪽 상태다 ⇒ 안에 넣는다.
 * 경계 행(예측 먼저 — H11-F1/E-rows-predict.md): «자식 요소» = 요소 노드만 · .drop-indicator 제외 · 갭·빈 글자 프레임은 센다.
 * 머리표: [새 것] cfd307ff 에서 빨강 · [경계 고정] 정의의 «센다» 쪽을 잠근다(cfd307ff 에서도 초록). */
const INNER = {
  empty: { tag: '[새 것]', want: true, html: () => '' },
  ws: { tag: '[새 것]', want: true, html: () => '\n   <!-- 주석 -->\n   ' },
  gap: { tag: '[경계 고정]', want: false, html: (kind) => `<div class="gap-block" id="eGap" data-type="gap" style="height:40px;${kind === 'free' ? 'position:absolute;left:20px;top:20px;width:200px;' : ''}"></div>` },
  tf: { tag: '[경계 고정]', want: false, html: (kind) => `<div class="frame-block" id="eTF" data-text-frame="true" data-bg="transparent" style="background:transparent;${kind === 'free' ? 'position:absolute;left:20px;top:20px;width:200px;' : 'width:100%;'}box-sizing:border-box;"></div>` },
  real: { tag: '[경계 고정]', want: false, html: (kind) => CHILD[kind] },
};
const secWith = (kind, inner) => sec(kind).replace(CHILD[kind], inner);
const E_PATHS = PATHS.filter(p => p.name === 'Heading' || p.name === 'Graph');
for (const kind of ['free', 'flow']) for (const [row, def] of Object.entries(INNER)) for (const p of E_PATHS) {
  test(`E-${row}-${kind}-${p.name} ${def.tag} 자식 요소 ${row === 'empty' || row === 'ws' ? '0' : '1'}(${row}) 프레임 한 번 클릭 → 툴바 「${p.item}」 = ${def.want ? '«안»' : '«밖»(다음 형제)'}`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    const errs = await bootApp(page);
    await page.evaluate((h) => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
      c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
      document.getElementById('FR').scrollIntoView({ block: 'center' });
    }, secWith(kind, def.html(kind)));
    await page.waitForTimeout(300);
    expect(await page.evaluate(() => document.getElementById('FR').children.length), `[전제] 자식 요소 수(${row})`).toBe(row === 'empty' || row === 'ws' ? 0 : 1);
    const before = await ids(page, p.cls);
    await clickFrame(page);
    await toolbar(page, p);
    const r = await newOne(page, p.cls, before);
    expect(r.n, `[전제] 새 ${p.cls} 하나 ${JSON.stringify(r)}`).toBe(1);
    expect(r.inside, `★${row} — ${def.want ? '안' : '밖'} 이어야 ${JSON.stringify(r)}`).toBe(def.want);
    if (!def.want) expect(r.prevOfUnit, `밖 = 행(rowF) 바로 뒤 ${JSON.stringify(r)}`).toBe('rowF');
    expect(errs).toEqual([]);
  });
}
/* E-made — 툴바 「Frame 추가」(진짜 클릭) 직후 바로 툴바 넣기 = 새 프레임 «안»(09-23 의 그 자리) */
for (const p of E_PATHS) {
  test(`E-made-${p.name} [새 것] 「Frame 추가」 직후(새 프레임이 골라진 채) → 툴바 「${p.item}」 = 새 프레임 «안»`, async ({ page }) => {
    await page.setViewportSize({ width: 1600, height: 1200 });
    const errs = await bootApp(page);
    await page.evaluate(() => {
      const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
      c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sH" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="inH"><div class="gap-block" data-type="gap" style="height:60px"></div></div></div>');
      window.rebindAll?.(); window.applyZoom?.(100); window.deselectAll?.(); window.selectSection?.(document.getElementById('sH'));   // [전제] 섹션 고름(판 세우기)
      window.__f0 = new Set([...document.querySelectorAll('.frame-block')].map(f => f.id));
    });
    const fb = await page.evaluate(() => { const e = [...document.querySelectorAll('button[title]')].find(x => x.title.includes('Frame 추가') && x.getBoundingClientRect().width > 0); const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await clickAt(page, fb[0], fb[1], { sel: 'button[title]' }, { label: 'Frame 추가' }); await page.waitForTimeout(400);
    const fid = await page.evaluate(() => [...document.querySelectorAll('#sH .frame-block:not([data-text-frame])')].find(f => !window.__f0.has(f.id))?.id);
    expect(fid, '[전제] 새 프레임').toBeTruthy();
    expect(await page.evaluate((id) => { const f = document.getElementById(id); return { sel: f.classList.contains('selected'), kids: f.children.length }; }, fid), '[전제] 새 프레임 = 골라짐 · 자식 0').toEqual({ sel: true, kids: 0 });
    const before = await ids(page, p.cls);
    await toolbar(page, p);
    const r = await page.evaluate(([cls, before, fid]) => { const n = [...document.querySelectorAll(`#canvas ${cls}`)].filter(e => !before.includes(e.id)); return { n: n.length, inside: n.length === 1 && !!n[0].closest(`[id="${fid}"]`) }; }, [p.cls, before, fid]);
    expect(r, `★새 프레임 안 ${JSON.stringify(r)}`).toEqual({ n: 1, inside: true });
    expect(errs).toEqual([]);
  });
}
