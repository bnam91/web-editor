/* esweep-fixes.dom.spec.js — lane-esweep 고침 넷의 시험 (2026-10-05 · 태양 승인 21:47 / 지디 21:49 · 21:55)
 *   A  ⑶ icb_k7kbb_msmevtj — 띄운 아이콘 서클의 모서리 손잡이도 «보라»(--ui-sel-overlay). 실측: 손잡이 4/4 파랑 45,111,232 · 손잡이에 data-sel-variant 없음.
 *   B  ⑷㉣ sb_ts0he_4lus8he — 말풍선은 «상하» 패딩 칸 disabled + 보이는 안내 한 줄(현빈 「비활성화」 · 꼬리가 떨어짐 실측 −10 → +14px).
 *   C  ⑺ tb-card-edit-btn — 공용 템플릿 카드에 «보이는» 까닭 한 줄(배지·hover 말고).
 *   E133 — 스택 프레임 정렬 단추가 아이콘(iconify)·카드에도 닿는다(실측: Icon 326/326 · Card 178/178 가운데 그대로).
 *   E134 — 심플카드 아이콘 고르기 창엔 «크기» 칸을 안 보인다(고른 크기를 안 쓰는 길 · 실측 32·200 둘 다 166px).
 * 머리표: [새 것] 8d5e50a6 에서 빨강 · [지킴] 8d5e50a6 에서도 초록 · [전제] 재기 위한 조건. 예측 = reports/esweep/predict-fixes.md.
 * ⛔못 보는 꼴: 실앱 창·배율 40% 그대로는 실앱 표가 잰다. E133 의 vector·mockup(같은 margin:auto)은 여기서 안 잰다.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN, bootApp } = require('./_root-harness.js');
test.describe.configure({ timeout: 60000 });

const SKEL = `<div class="section-block" id="sX" data-section="1" data-name="sX"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="gap-block" data-type="gap" style="height:300px"></div></div></div>`;
async function fresh(page, zoom = 100) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([h, z]) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(z); }, [SKEL, zoom]);
  await page.waitForTimeout(300);
  return errs;
}
/** 앱 함수로 하나 넣고(T▾·메뉴가 부르는 그 함수) 새 요소 id 를 돌려준다 */
const addInSection = (page, call, sel) => page.evaluate(([call, sel]) => {
  const before = new Set([...document.querySelectorAll(sel)].map(e => e.id));
  window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(document.getElementById('sX'));
  (new Function(call))();
  const made = [...document.querySelectorAll(sel)].find(e => !before.has(e.id));
  return made ? made.id : null;
}, [call, sel]);
const clickCenter = async (page, sel) => { const p = await page.evaluate((s) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, sel); await page.mouse.click(p.x, p.y); await page.waitForTimeout(350); };
const cssVar = (page, v) => page.evaluate((v) => { const d = document.createElement('div'); d.style.color = `var(${v})`; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, v);

/* ── A ── */
async function icbScene(page) {
  await fresh(page);
  const id = await addInSection(page, 'window.addIconCircleBlock()', '#canvas .icon-circle-block');
  expect(id, '[전제] 서클을 넣었다').toBeTruthy();
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(5, 300);
  await clickCenter(page, `#${id} .icb-circle`);
  return id;
}
const icbHandleColors = (page) => page.evaluate(() => [...document.querySelectorAll('#ss-handles-overlay .icb-overlay-handle')].filter(h => h.getBoundingClientRect().width > 0).map(h => getComputedStyle(h).borderTopColor));
test('A-H1 [새 것] 띄운 서클의 모서리 손잡이 넷 = --ui-sel-overlay(보라)', async ({ page }) => {
  const id = await icbScene(page);
  const tg = await page.evaluate(() => { const t = document.getElementById('icb-float-toggle'); if (!t) return null; t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect(tg, '[전제] 패널 띄우기 토글').toBeTruthy();
  await page.mouse.click(tg.x, tg.y); await page.waitForTimeout(400);
  expect(await page.evaluate((id) => document.getElementById(id).dataset.overlayBlock, id), '[전제] 떴다').toBe('true');
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(5, 300); await clickCenter(page, `#${id} .icb-circle`);
  const purple = await cssVar(page, '--ui-sel-overlay');
  await expect(async () => { const got = await icbHandleColors(page); expect(got.length === 4 && got.every(c => c === purple), `손잡이 색=${JSON.stringify(got)} · 보라=${purple}`).toBe(true); }).toPass({ timeout: 2000 });
});
test('A-H2 [지킴] 안 띄운 서클 손잡이 = --sel-color(파랑) 그대로', async ({ page }) => {
  await icbScene(page);
  const blue = await cssVar(page, '--sel-color');
  await expect(async () => { const got = await icbHandleColors(page); expect(got.length === 4 && got.every(c => c === blue), `손잡이 색=${JSON.stringify(got)} · 파랑=${blue}`).toBe(true); }).toPass({ timeout: 2000 });
});

/* ── B ── */
const pvState = (page) => page.evaluate(() => { const n = document.getElementById('txt-pv-number'), sl = document.getElementById('txt-pv-slider'); const hint = [...document.querySelectorAll('#panel-right .prop-hint, .panel-body .prop-hint')].find(h => /꼬리/.test(h.textContent) && h.getBoundingClientRect().height > 0);
  return { num: n ? n.disabled : null, slider: sl ? sl.disabled : null, hint: hint ? hint.textContent.trim() : null }; });
test('B1 [새 것] 말풍선 — 상하 칸 둘 disabled + 보이는 안내 한 줄', async ({ page }) => {
  await fresh(page);
  const id = await addInSection(page, "window.addSpeechBubbleBlock('left')", '#canvas .speech-bubble-block');
  expect(id, '[전제] 말풍선').toBeTruthy();
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(5, 300); await clickCenter(page, `#${id} .tb-bubble`);
  const st = await pvState(page);
  expect(st.num, `상하 숫자칸 disabled · ${JSON.stringify(st)}`).toBe(true);
  expect(st.slider, `상하 슬라이더 disabled · ${JSON.stringify(st)}`).toBe(true);
  expect(st.hint, `보이는 안내 · ${JSON.stringify(st)}`).toBeTruthy();
});
test('B2 [지킴] 일반 글자(Body) — 상하 칸 enabled · 안내 없음', async ({ page }) => {
  await fresh(page);
  const id = await addInSection(page, "window.addTextBlock('body')", '#canvas .text-block');
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(5, 300); await clickCenter(page, `#${id} [class^="tb-"]`);
  const st = await pvState(page);
  expect(st, JSON.stringify(st)).toEqual({ num: false, slider: false, hint: null });
});

/* ── C ── */
async function tplBoot(page) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const IDX = [{ id: 'tpl_es_shared', name: '공용하나', folder: '기타', type: 'section', _scope: 'shared' }, { id: 'tpl_es_mine', name: '내것하나', folder: '기타', type: 'section', _scope: 'personal' }];
  /* bootApp 의 null 프록시 init 이 «뒤에» 돌아 덮는다 — 쓰기 막힌 속성으로 심어 그 대입을 무효로 한다(아래 [전제] 카드 둘로 확인). */
  await page.addInitScript((idx) => { Object.defineProperty(window, 'electronAPI', { configurable: false, writable: false, value: new Proxy({}, { get: (_, k) => (k === 'loadTemplateIndex' ? (() => Promise.resolve(idx)) : (() => Promise.resolve(null))) }) }); }, IDX);
  const errs = await bootApp(page);
  await page.evaluate(() => window.initTemplates?.());
  await page.waitForTimeout(300);
  await page.evaluate(() => { if (!document.querySelector('.tb-card')) window.toggleTemplateBrowser?.(); });
  await page.waitForTimeout(600);
  const n = await page.evaluate(() => document.querySelectorAll('.tb-card').length);
  expect(n, '[전제] 카드 둘이 보인다').toBeGreaterThanOrEqual(2);
  return errs;
}
const cardInfo = (page, id) => page.evaluate((id) => { const c = document.querySelector(`.tb-card[data-tpl-id="${id}"]`); const why = [...c.querySelectorAll('*')].find(e => /수정.{0,12}할 수 없|수정·삭제할 수 없/.test(e.textContent) && e.children.length === 0 && e.getBoundingClientRect().height > 0 && !e.classList.contains('tb-card-shared'));
  return { disabled: c.querySelector('.tb-card-edit-btn').disabled, why: why ? why.textContent.trim() : null }; }, id);
test('C1 [새 것] 공용 카드 — 수정 단추 disabled 옆에 «보이는» 까닭 한 줄', async ({ page }) => {
  await tplBoot(page);
  const c = await cardInfo(page, 'tpl_es_shared');
  expect(c.disabled, '[전제] 공용 = disabled').toBe(true);
  expect(c.why, `보이는 까닭 · ${JSON.stringify(c)}`).toBeTruthy();
});
test('C2 [지킴] 개인 카드 — 까닭 줄 없음 · 수정 단추 살아 있음', async ({ page }) => {
  await tplBoot(page);
  expect(await cardInfo(page, 'tpl_es_mine')).toEqual({ disabled: false, why: null });
});

/* ── E133 ── */
/** 프레임 «빈 곳»을 진짜로 누른다(사용자처럼) — 그 점이 정말 프레임 자신인지 훑어서 찾는다 */
async function clickFrame(page, fid) {
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(5, 300);
  const p = await page.evaluate((fid) => { const f = document.getElementById(fid); f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect(); for (let y = Math.round(r.bottom - 4); y > r.top; y -= 3) { for (const x of [Math.round(r.right - 6), Math.round(r.left + 6)]) { if (document.elementFromPoint(x, y) === f) return { x, y }; } } return null; }, fid);
  expect(p, `[전제] 프레임 ${fid} 빈 곳`).toBeTruthy();
  await page.mouse.click(p.x, p.y); await page.waitForTimeout(350);
}
async function frameWith(page, menuCall, sel) {
  await fresh(page, 50);
  const fid = await addInSection(page, 'window.addFrameBlock()', '#canvas .frame-block:not([data-text-frame])');
  await page.evaluate((fid) => { window.deselectAll?.(); window._activeFrame = document.getElementById(fid); window.addTextBlock('h2'); window._activeFrame = null; window.deselectAll?.(); }, fid);   // [전제·JS] 빈 프레임은 스택 변환이 막힌다
  await clickFrame(page, fid);
  const st = await page.evaluate(() => { const b = document.getElementById('ss-to-stack-btn'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  if (st) { await page.mouse.click(st.x, st.y); await page.waitForTimeout(450); }
  const bid = await page.evaluate(([fid, call, sel]) => { const f = document.getElementById(fid); const before = new Set([...document.querySelectorAll(sel)].map(e => e.id)); window.deselectAll?.(); window._activeFrame = f; (new Function(call))(); window._activeFrame = null; const made = [...document.querySelectorAll(sel)].find(e => !before.has(e.id)); return made && f.contains(made) ? made.id : null; }, [fid, menuCall, sel]);
  expect(bid, `[전제] 프레임 안에 넣었다 ${menuCall}`).toBeTruthy();
  expect(await page.evaluate((fid) => document.getElementById(fid).dataset.freeLayout || null, fid), '[전제] 스택 프레임').toBe(null);
  return { fid, bid };
}
async function pressAlign(page, fid, a) {
  await clickFrame(page, fid);
  const b = await page.evaluate((a) => { const e = document.getElementById('ss-align-' + a); if (!e) return null; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, a);
  expect(b, `[전제] 정렬 단추 ${a}`).toBeTruthy();
  await page.mouse.click(b.x, b.y); await page.waitForTimeout(300);
}
const lr = (page, fid, bid) => page.evaluate(([fid, bid]) => { const f = document.getElementById(fid), b = document.getElementById(bid); const z = (window.currentZoom || 40) / 100; const fr = f.getBoundingClientRect(), br = b.getBoundingClientRect(), cs = getComputedStyle(f);
  return { L: Math.round((br.left - fr.left) / z - parseFloat(cs.paddingLeft) - parseFloat(cs.borderLeftWidth)), R: Math.round((fr.right - br.right) / z - parseFloat(cs.paddingRight) - parseFloat(cs.borderRightWidth)), ml: b.style.marginLeft, mr: b.style.marginRight }; }, [fid, bid]);
for (const [tag, call, sel] of [['M1 Icon', "window.addIconifyBlock('', '', 64)", '#canvas .icon-block'], ['M2 Card', 'window.addCanvasBlock()', '#canvas .canvas-block']]) {
  test(`E133-${tag} [새 것] 왼/오/가운데 단추가 닿는다`, async ({ page }) => {
    const { fid, bid } = await frameWith(page, call, sel);
    await pressAlign(page, fid, 'left'); const L = await lr(page, fid, bid);
    await pressAlign(page, fid, 'right'); const R = await lr(page, fid, bid);
    await pressAlign(page, fid, 'hcenter'); const C = await lr(page, fid, bid);
    expect(L.L < 3 && L.R > 20, `왼쪽 ${JSON.stringify(L)}`).toBe(true);
    expect(R.R < 3 && R.L > 20, `오른쪽 ${JSON.stringify(R)}`).toBe(true);
    expect(Math.abs(C.L - C.R) <= 3, `가운데 ${JSON.stringify(C)}`).toBe(true);
  });
}
test('E133-M3 [지킴] 대조 Object·Circle — 왼/오 따라감 · 인라인 마진 안 생김', async ({ page }) => {
  for (const [call, sel] of [["window.addAssetBlock('small')", '#canvas .asset-block'], ['window.addIconCircleBlock()', '#canvas .icon-circle-block']]) {
    const { fid, bid } = await frameWith(page, call, sel);
    await pressAlign(page, fid, 'left'); const L = await lr(page, fid, bid);
    await pressAlign(page, fid, 'right'); const R = await lr(page, fid, bid);
    expect(L.L < 3 && R.R < 3, `${sel} 왼 ${JSON.stringify(L)} 오 ${JSON.stringify(R)}`).toBe(true);
    expect([L.ml, L.mr, R.ml, R.mr].every(v => v === '' || v === '0px'), `${sel} 인라인 마진 ${JSON.stringify([L, R])}`).toBe(true);
  }
});

/* ── E134 ── */
const sizeVisible = (page) => page.evaluate(() => { const i = document.getElementById('iconify-size-input'); if (!i) return null; const vis = (e) => !!e && e.getBoundingClientRect().width > 0 && getComputedStyle(e).display !== 'none';
  return { input: vis(i), label: vis(i.previousElementSibling), px: vis(i.nextElementSibling) }; });
test('E134-K1 [새 것] 심플카드 아이콘 고르기 창 = 크기 칸(라벨·칸·px) 안 보임', async ({ page }) => {
  await fresh(page);
  const id = await addInSection(page, 'window.addCanvasBlock()', '#canvas .canvas-block');
  await page.evaluate((id) => { document.getElementById(id).dataset.iconMode = 'true'; }, id);   // [전제·JS] 아이콘 모드 = 레이어 이름 **icon_ 이스터에그
  await page.evaluate(() => window.deselectAll?.()); await page.mouse.move(5, 300); await clickCenter(page, `#${id}`);
  const ib = await page.evaluate(() => { const b = document.querySelector('.cvb-card-icon-btn[data-card-index="0"]'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  expect(ib, '[전제] 패널 «아이콘 추가» 단추').toBeTruthy();
  await page.mouse.click(ib.x, ib.y); await page.waitForTimeout(400);
  const v = await sizeVisible(page);
  expect(v, `크기 칸 ${JSON.stringify(v)}`).toEqual({ input: false, label: false, px: false });
});
test('E134-K2 [지킴] 일반 길 = 크기 칸 보임 · 카드 길을 한 번 연 뒤에도 일반 길은 보임', async ({ page }) => {
  await fresh(page);
  await page.evaluate(() => window.openIconifyModal(() => {}));
  await page.waitForTimeout(300);
  expect(await sizeVisible(page), '일반 길 처음').toEqual({ input: true, label: true, px: true });
  await page.evaluate(() => { window.closeIconifyModal(); window.openIconifyModal(() => {}, { hideSize: true }); window.closeIconifyModal(); window.openIconifyModal(() => {}); });
  await page.waitForTimeout(300);
  expect(await sizeVisible(page), '카드 길 다음 일반 길').toEqual({ input: true, label: true, px: true });
});
