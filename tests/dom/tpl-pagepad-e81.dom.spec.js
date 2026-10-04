/* tpl-pagepad-e81.dom.spec.js — E81 템플릿 «블럭·서브섹션» 넣기 뒤 페이지 padX 다시 걸기 (태양 lane-e81-tplpad 2026-10-04)
 *
 * 처방(승인 · 지디 ㉯): js/panels/template-system.js 의 블럭·서브섹션 두 갈래가 pushHistory «앞»에서
 *   공용 _tplReapplyPagePad(sec) = applyPadXToSection(inner, window.effectiveSectionPadX(inner)) 를 부른다.
 *   «넣은 섹션만» — 문서 전체(:603 applyPageSettings)가 아니다. ⛔행 안 에셋은 안 덮인다(E92 · 별건).
 * 장면: 원본 padX 48 에서 블럭을 만들어 템플릿으로 뜨고 → 문서 padX 20 → 넣는다. «전제 단언»(48 ≠ 20)을 먼저 찍는다.
 * 자: 값은 «문자열 정규식»이 아니라 DOM 으로 읽는다 — 화면은 el.style · getComputedStyle,
 *   표본·저장 파일은 그 HTML 문자열을 DOMParser 로 파싱해 style.marginLeft/width 를 읽는다.
 * ★표본 = 넣기 직후 동기 getSerializedCanvas() — pushHistory 가 저장하는 바로 그 문자열(넣기 갈래에 push 뒤 DOM 을 바꾸는 줄이 없다).
 * 실측 바탕: $S/reports/E81-MEASURE.md(분모 · ⌘Z 판) · 설계 $S/reports/E81-DESIGN.md §12.
 * 골든(T3): E81_GOLDEN=update 로 «핀 4df20f78 판(시험 커밋)»에서 한 번. ⛔고친 판에서 다시 뜨지 마라.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/tpl-pagepad-e81.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

/* ★시험 커밋에는 고침이 없다 — 고침을 재는 시험은 «빨강이 정상»(test.fail). 고침 커밋에서 false. */
const FIX = true;
const GOLD = path.join(__dirname, 'fixtures', 'tpl-pagepad-e81-golden.json');
const UPDATE = process.env.E81_GOLDEN === 'update';
/* ★gradient 는 T1 에서 «뺀다»: 섹션 길에선 gradient-block 이 .section-block «직속»(section-inner 밖)에 서고, 블럭 길에선 row 안에 선다
   (실측 2026-10-04 판 DBG3 — 「gradient@section-block」). 둘의 left 차이는 padX 가 아니라 «자리» 차이다 → 같은 자로 못 견준다(E81 아님). */
const FB = ['bridge', 'cardFB', 'frameFB', 'chatFB'];             // 블럭 길에서 어긋나는 전폭 갈래(분모 실측)
const SUB = ['sub-bridge', 'sub-gridFB', 'sub-frameFB', 'sub-chatFB', 'sub-gradient'];
const PLAIN = ['text', 'grid', 'card', 'frame', 'chat', 'table', 'divider', 'icontext'];   // 전폭 아님 8(분모 0/8)

/** 앱 · 섹션 셋(S1 원본 · S2 넣을 곳 · S3 남) · 템플릿 저장소(메모리) · 저장 가로채기 */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const store = new Map(); window.__saved = [];
    const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => {
      if (k === 'saveTemplateCanvas') return async (id, html) => { store.set(id, html); return { ok: true }; };
      if (k === 'loadTemplateCanvas') return async (id) => store.get(id) ?? null;
      if (k === 'saveProject') return async (p) => { window.__saved.push(JSON.stringify(p)); return { ok: true }; };
      return base[k];
    } });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    const mk = (id) => `<div class="section-block" data-section="1" id="${id}"><div class="section-hitzone"></div><div class="section-inner" id="${id}-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>`;
    c.insertAdjacentHTML('beforeend', mk('eS1') + mk('eS2') + mk('eS3'));
    window.rebindAll?.();
    const st = window.state; st.pageSettings.padX = 48; window.applyPageSettings();
    const S1 = document.getElementById('eS1');
    const last = (sel) => [...S1.querySelectorAll(sel)].pop();
    const made = [];
    const add = (k, fn, sel, after) => { window.selectSection(S1); fn(); const el = last(sel); if (!el) { made.push(k + ':없음'); return; } el.dataset.e81 = k; after && after(el); made.push(k); };
    add('text', () => window.addTextBlock('body'), '.text-block');
    add('bridge', () => window.addBridgeBlock(), '.bridge-block');
    add('gradient', () => window.addGradientBlock(), '.gradient-block');
    add('grid', () => window.addGridBlock({}), '.grid-block');
    add('gridFB', () => window.addGridBlock({}), '.grid-block', el => { el.dataset.fullBleed = 'true'; });
    add('card', () => window.addCanvasBlock(), '.canvas-block');
    add('cardFB', () => window.addCanvasBlock(), '.canvas-block', el => { el.dataset.fullBleed = 'true'; });
    add('frame', () => window.addFrameBlock(), '.frame-block:not([data-text-frame])');
    add('frameFB', () => window.addFrameBlock(), '.frame-block:not([data-text-frame])', el => { el.dataset.fullBleed = 'true'; });
    add('chat', () => window.addChatBlock({ messages: [{ text: 'a', align: 'left' }] }), '.chat-block');
    add('chatFB', () => window.addChatBlock({ messages: [{ text: 'a', align: 'left' }] }), '.chat-block', el => { el.dataset.fullBleed = 'true'; });
    add('table', () => window.addTableBlock(), '.table-block');
    add('divider', () => window.addDividerBlock(), '.divider-block');
    add('icontext', () => window.addIconTextBlock(), '.icon-text-block');
    window.applyPageSettings();
    const ids = {};
    for (const el of [...S1.querySelectorAll('[data-e81]')]) {
      await window.saveBlockAsTemplate(el, 'e81-' + el.dataset.e81);
      ids[el.dataset.e81] = window.loadTemplates().find(t => t.name === 'e81-' + el.dataset.e81)?.id || null;
    }
    /* 서브섹션: 프레임 F 에 전 종류 복제(sub-<종류>) */
    window.selectSection(S1); window.addFrameBlock(); const F = last('.frame-block:not([data-text-frame])'); F.removeAttribute('data-e81');
    for (const el of [...S1.querySelectorAll('[data-e81]')]) { if (el === F || F.contains(el)) continue; const cl = el.cloneNode(true); cl.id = el.id + '_f'; cl.dataset.e81 = 'sub-' + el.dataset.e81; F.appendChild(cl); }
    window.applyPageSettings();
    await window.saveAsTemplate(F, 'e81-sub', '기타', '', [], 'subsection'); ids.__sub = window.loadTemplates().find(t => t.name === 'e81-sub')?.id;
    await window.saveAsTemplate(S1, 'e81-sec', '기타', '', [], 'section'); ids.__sec = window.loadTemplates().find(t => t.name === 'e81-sec')?.id;
    st.pageSettings.padX = 20; window.applyPageSettings(); S1.remove();
    window.clearHistory?.();
    return { ids, made, docPadX: st.pageSettings.padX, s2pad: document.getElementById('eS2-in').style.paddingLeft };
  });
  /* ★전제 단언 — 원본 padX(48) ≠ 문서 padX(20) */
  expect(r.docPadX, '전제: 문서 padX').toBe(20);
  expect(r.s2pad, '전제: 넣을 섹션 inner').toBe('20px');
  expect(r.made.filter(m => m.includes(':')), `전제: 종류 다 만들어짐 ${r.made}`).toEqual([]);
  return { ...r, errs };
}
const ins = (page, id, secId = 'eS2') => page.evaluate(async ([id, secId]) => {
  const t = window.loadTemplates().find(t => t.id === id); window.selectSection(document.getElementById(secId));
  await window.insertTemplate(t); return !!t; }, [id, secId]);
/** 화면 값(인라인 · 계산 · 섹션 inner 기준 left) — 첫 번째 [data-e81=k] */
const screen = (page, k, scope = '#canvas') => page.evaluate(([k, scope]) => {
  const el = document.querySelector(`${scope} [data-e81="${k}"]`); if (!el) return null;
  const inner = el.closest('.section-inner') || el.closest('.section-block'); const q = el.getBoundingClientRect(); const iq = inner.getBoundingClientRect();
  return { ml: el.style.marginLeft, w: el.style.width, cml: getComputedStyle(el).marginLeft, cw: Math.round(q.width), left: Math.round(q.left - iq.left) };
}, [k, scope]);
/** HTML 문자열 속 그 블럭의 인라인 style — DOMParser 로(정규식 아님) */
const parsed = (page, html, k) => page.evaluate(([html, k]) => {
  const d = new DOMParser().parseFromString(html, 'text/html'); const el = d.querySelector(`[data-e81="${k}"]`);
  return el ? { ml: el.style.marginLeft, w: el.style.width } : null; }, [html, k]);
const serial = (page) => page.evaluate(() => window.getSerializedCanvas());
/** 대조값 = «섹션 길»로 넣은 같은 블럭(:603 이 다시 건다). ⚠️섹션 길은 문서 전체를 다시 걸므로 «마지막»에 부른다. */
async function sectionRef(page, ids, kinds) {
  await page.evaluate(() => { const n = document.createElement('div'); n.innerHTML = '<div class="section-block" data-section="1" id="eSR"><div class="section-hitzone"></div><div class="section-inner" id="eSR-in"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>'; document.getElementById('canvas').appendChild(n.firstElementChild); window.rebindAll?.(); });
  await ins(page, ids.__sec, 'eSR');
  const ref = {};
  for (const k of kinds) ref[k] = await page.evaluate((k) => {
    const secs = [...document.querySelectorAll('#canvas .section-block')].filter(s => !['eS2', 'eS3', 'eSR'].includes(s.id));
    const el = secs.map(s => s.querySelector(`[data-e81="${k}"]`)).find(Boolean); if (!el) return null;
    const inner = el.closest('.section-inner') || el.closest('.section-block'); const q = el.getBoundingClientRect(); const iq = inner.getBoundingClientRect();
    return { ml: el.style.marginLeft, w: el.style.width, cml: getComputedStyle(el).marginLeft, cw: Math.round(q.width), left: Math.round(q.left - iq.left) };
  }, k);
  return ref;
}
const geom = (v) => v && { cml: v.cml, cw: v.cw, left: v.left };

// ─────────── T1 블럭 길 · T2 서브섹션 길 ───────────
test('T1 ★블럭 길 — 전폭 4종(bridge·cardFB·frameFB·chatFB)이 넣은 직후 «섹션 길로 넣은 같은 블럭»과 같은 꼴(계산 ml·폭·left)', async ({ page }) => {
  if (FIX) test.fail(true, '핀: 블럭 길은 다시 걸기 없음 — 원본 padX(−48) 그대로');
  const { ids } = await setup(page);
  const got = {};
  for (const k of FB) { await ins(page, ids[k]); got[k] = await screen(page, k, '#eS2'); }
  const ref = await sectionRef(page, ids, FB);
  for (const k of FB) expect(geom(got[k]), `${k} 블럭 길 ${JSON.stringify(got[k])} vs 섹션 길 ${JSON.stringify(ref[k])}`).toEqual(geom(ref[k]));
});
test('T2 ★서브섹션 길 — 프레임 안 전폭 5종(sub-bridge·sub-gridFB·sub-frameFB·sub-chatFB·sub-gradient)이 섹션 길의 같은 프레임 자식과 같은 꼴', async ({ page }) => {
  if (FIX) test.fail(true, '핀: 서브섹션 길은 다시 걸기 없음(그리드 렌더도 안 부름)');
  const { ids } = await setup(page);
  await ins(page, ids.__sub);
  const got = {}; for (const k of SUB) got[k] = await screen(page, k, '#eS2');
  const ref = await sectionRef(page, ids, SUB);
  for (const k of SUB) expect(geom(got[k]), `${k} 서브섹션 길 ${JSON.stringify(got[k])} vs 섹션 길 ${JSON.stringify(ref[k])}`).toEqual(geom(ref[k]));
});

// ─────────── T3 전폭 아님 8 — 바이트 골든(핀 4df20f78) ───────────
test('T3 전폭 아님 8 — 블럭 길로 넣은 블럭 outerHTML 이 핀(4df20f78) 골든과 같다(무작위 id 정규화)', async ({ page }) => {
  const { ids } = await setup(page);
  const out = {};
  for (const k of PLAIN) {
    await ins(page, ids[k]);
    out[k] = await page.evaluate((k) => { const el = document.querySelector(`#eS2 [data-e81="${k}"]`); if (!el) return null;
      const c = el.cloneNode(true); c.classList.remove('selected');
      c.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
      return c.outerHTML.replace(/(id|data-[a-z-]*id|for|aria-labelledby)="[^"]*"/g, '$1="#"').replace(/\b(sec|row|ss|tb|grd|cvb|chb|tbl|dvd|itb|ab|gb|icn|mkp|ln)_[A-Za-z0-9_]+/g, '$1_#'); }, k);
  }
  if (UPDATE) { fs.mkdirSync(path.dirname(GOLD), { recursive: true }); fs.writeFileSync(GOLD, JSON.stringify(out, null, 1) + '\n'); return; }
  const gold = JSON.parse(fs.readFileSync(GOLD, 'utf8'));
  for (const k of PLAIN) expect(out[k], `T3 ${k}`).toBe(gold[k]);
});

// ─────────── T4 override 섹션 ───────────
test('T4 override 섹션(inner data-padding-x=30)에 블럭 길로 넣으면 그 섹션 값(−30)을 따른다(문서 20 아님)', async ({ page }) => {
  if (FIX) test.fail(true, '핀: 다시 걸기 없음 — −48');
  const { ids } = await setup(page);
  await page.evaluate(() => { const i = document.getElementById('eS3-in'); i.dataset.paddingX = '30'; window.applyPadXToSection(i, 30); });
  await ins(page, ids.bridge, 'eS3');
  const v = await screen(page, 'bridge', '#eS3');
  expect({ ml: v.ml, w: v.w }, JSON.stringify(v)).toEqual({ ml: '-30px', w: 'calc(100% + 60px)' });
});

// ─────────── T5 표본 바이트 · ⌘Z 단계(DEF-01 꼴) ───────────
test('T5 ★넣은 «직후» 표본(getSerializedCanvas) 속 값 = −20 · 넣기 → 다른 조작 → ⌘Z ×2 단계가 맞다', async ({ page }) => {
  if (FIX) test.fail(true, '핀: 표본에 −48');
  const { ids } = await setup(page);
  await ins(page, ids.bridge);
  const s1 = await parsed(page, await serial(page), 'bridge');
  expect(s1, `블럭 길 표본 ${JSON.stringify(s1)}`).toEqual({ ml: '-20px', w: 'calc(100% + 40px)' });
  await ins(page, ids.__sub);
  const s2 = await parsed(page, await serial(page), 'sub-frameFB');
  expect(s2 && s2.w, `서브섹션 길 표본 ${JSON.stringify(s2)}`).toBe('calc(100% + 40px)');
  // 다른 조작(push-after) — 페이지 배경 바꾸기 대신: 섹션 S3 에 글자 블럭 넣기
  await page.evaluate(() => { window.selectSection(document.getElementById('eS3')); window.addTextBlock('body'); });
  const undo = async () => { await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); }); await page.keyboard.press('Meta+z'); await page.waitForTimeout(300); };
  await undo();
  expect(await page.evaluate(() => document.querySelectorAll('#eS3 .text-block').length), '⌘Z 1 = 글자 블럭만 되돌림').toBe(0);
  expect((await screen(page, 'sub-frameFB', '#eS2')).w, '⌘Z 1 뒤 서브섹션 넣기는 남음 · −20').toBe('calc(100% + 40px)');
  await undo();
  expect(await screen(page, 'sub-frameFB', '#eS2'), '⌘Z 2 = 서브섹션 넣기 되돌림').toBeNull();
  expect((await screen(page, 'bridge', '#eS2')).ml, '블럭 길 넣기는 남음').toBe('-20px');
});

// ─────────── T6 남 무변(㉯) ───────────
test('T6 «남 무변» — 블럭 길로 넣어도 다른 섹션(S3 · 일부러 낡은 −48 브리지)은 한 바이트도 안 바뀐다', async ({ page }) => {
  const { ids } = await setup(page);
  await page.evaluate(() => { const S3 = document.getElementById('eS3'); window.selectSection(S3); window.addBridgeBlock(); const b = [...S3.querySelectorAll('.bridge-block')].pop(); b.dataset.e81 = 'stale'; b.style.marginLeft = '-48px'; b.style.marginRight = '-48px'; b.style.width = 'calc(100% + 96px)'; });
  /* ★선택 표지(.selected)는 «남의 상태»가 아니라 편집 표시다 — 셋업이 S3 를 고른 채 찍으면 그것만으로 달라진다(첫 판 실측: bridge-block «selected» 하나). 고르기를 풀고, 비교에서도 뺀다. */
  await page.evaluate(() => window.deselectAll?.());
  const snap = () => page.evaluate(() => { const c = document.getElementById('eS3').cloneNode(true); c.classList.remove('selected'); c.querySelectorAll('.selected').forEach(x => x.classList.remove('selected')); return c.outerHTML; });
  const before = await snap();
  await ins(page, ids.bridge); await ins(page, ids.__sub);
  expect(await snap(), 'S3 무변').toBe(before);
});

// ─────────── T7 E57 · T8 E64 ───────────
test('T7 E57 — 넣은 블럭 Delete = 그 블럭만 · ⌘Z 로 −20 값까지 돌아온다', async ({ page }) => {
  const { ids } = await setup(page);
  await ins(page, ids.bridge); await ins(page, ids.chatFB);
  await page.evaluate(() => { window.deselectAll(); const b = document.querySelector('#eS2 [data-e81="bridge"]'); window.selectBlock ? window.selectBlock(b.id) : b.classList.add('selected'); });
  await page.waitForTimeout(150);
  await page.keyboard.press('Delete'); await page.waitForTimeout(250);
  expect(await screen(page, 'bridge', '#eS2'), '⒜ 그 블럭 지움').toBeNull();
  expect(await screen(page, 'chatFB', '#eS2'), '⒜ 옆 블럭 남음').not.toBeNull();
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); }); await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  const v = await screen(page, 'bridge', '#eS2');
  expect(v && v.ml, `⌘Z 복원 ${JSON.stringify(v)}`).toBe('-20px');
});
test('T8 E64 — G12 블럭 배경 켠 전폭 그리드 템플릿을 블럭 길로 넣어도 배경 키·전폭이 그대로(다시 걸기가 남의 상태를 안 지운다)', async ({ page }) => {
  const { ids } = await setup(page);
  // 전폭 그리드 템플릿을 «블럭 배경 켬»으로 하나 더 뜬다(원본 padX 48 상태에서)
  const id = await page.evaluate(async () => {
    const st = window.state; st.pageSettings.padX = 48; window.applyPageSettings();
    const S = document.getElementById('eS3'); window.selectSection(S); window.addGridBlock({}); const g = [...S.querySelectorAll('.grid-block')].pop();
    g.dataset.fullBleed = 'true'; g.dataset.e81 = 'gridBg'; window.updateGridBlock(g.id, { blockBg: { on: true, color: '#2f3d57', padY: 10, padX: 10 } });
    window.applyPageSettings(); await window.saveBlockAsTemplate(g, 'e81-gridBg'); g.remove();
    st.pageSettings.padX = 20; window.applyPageSettings();
    return window.loadTemplates().find(t => t.name === 'e81-gridBg').id; });
  await ins(page, id);
  const r = await page.evaluate(() => { const g = document.querySelector('#eS2 [data-e81="gridBg"]'); return { bgOn: g.dataset.blockBgOn, layer: !!g.querySelector(':scope > .grd-bg'), ml: g.style.marginLeft, w: g.style.width }; });
  expect(r, JSON.stringify(r)).toEqual({ bgOn: '1', layer: true, ml: '-20px', w: 'calc(100% + 40px)' });
});

// ─────────── T12 undo/redo · T13 저장 파일 ───────────
test('T12 넣은 직후 · ⌘Z · ⌘⇧Z 모든 단계 −20(⚠️핀도 ⌘⇧Z 뒤는 −20 — «넣은 직후» 칸이 핀을 빨갛게 한다)', async ({ page }) => {
  if (FIX) test.fail(true, '핀: 넣은 직후 −48');
  const { ids } = await setup(page);
  await ins(page, ids.bridge);
  const a = await screen(page, 'bridge', '#eS2');
  expect(a.ml, `넣은 직후 ${JSON.stringify(a)}`).toBe('-20px');
  await page.evaluate(() => { document.activeElement?.blur?.(); window.deselectAll?.(); }); await page.keyboard.press('Meta+z'); await page.waitForTimeout(300);
  expect(await screen(page, 'bridge', '#eS2'), '⌘Z = 없음').toBeNull();
  await page.keyboard.press('Meta+Shift+z'); await page.waitForTimeout(300);
  const c = await screen(page, 'bridge', '#eS2');
  expect(c.ml, `⌘⇧Z ${JSON.stringify(c)}`).toBe('-20px');
});
test('T13 넣고 ⌘Z «없이» 바로 저장 → 저장 데이터(serializeProject — saveProjectToFile 이 쓰는 그 함수) 속 그 블럭 = −20(핀 −48)', async ({ page }) => {
  /* ★하네스에선 electronAPI.saveProject 에 {id,name,updatedAt} 만 간다(실측 DBG2 — 73자). 그래서 «저장할 데이터를 만드는 함수»를 직접 읽는다. */
  if (FIX) test.fail(true, '핀: 저장 데이터에 −48');
  const { ids } = await setup(page);
  await ins(page, ids.bridge);
  const html = await page.evaluate(() => { const p = JSON.parse(window.serializeProject()); const pages = (p && p.pages) || []; return pages.map(pg => pg.canvas || '').join('\n'); });
  expect(html.length, '전제: 저장 데이터에 canvas').toBeGreaterThan(100);
  const v = await parsed(page, html, 'bridge');
  expect(v, `저장 데이터 ${JSON.stringify(v)}`).toEqual({ ml: '-20px', w: 'calc(100% + 40px)' });
});
