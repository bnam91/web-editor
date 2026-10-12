/* effects-glow.dom.spec.js — 텍스트 블럭 「Effects」 에 «글로우» 식구 (1012t1E3 · 2026-10-12)
 *
 * ★원문 — 「글로우 효과는 이스트에그로도 있지만 >> 우측 패널 '이펙트'에 반사와 함께 글로우 이펙트에 넣어줘」
 * ★재는 것
 *   G0 전제 — 명부에 glow · 텍스트 목록 = 반사·글로우 · 도형/에셋엔 없음
 *   G1 고르면 그것만(3겹) · G2 값 → 그림 · ★G3 Shadow 절과 공존(합성 문) · G4 눈/✕/바이트 동일
 *   G5 ⌘Z·저장 왕복 · G6 하류(그라데이션 .tgs · Figma textShadowSource · 화면 픽셀 양성/음성)
 *   ★G7 하위호환(글로우 없으면 Shadow 절 산출 = 옛 대입과 바이트 동일) · G8 반사에 비치나(실측 기록) · G9 이스트에그 공존
 * ⛔고정 대기 0 — waitForFunction / expect.poll 로 «무엇을 기다리나»를 쓴다(dom-fixed-wait-census).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/effects-glow.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

/* 장면: effects-registry.dom.spec.js setup 꼴 — [텍스트 eT 80px 파랑] [에셋 eA] [도형 eSh] */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="eS" data-section="1"><div class="section-hitzone"></div><div class="section-inner" id="eI">
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="eR1" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="eR2" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:40px"></div><div class="row" id="eR3" data-layout="stack"></div>
      <div class="gap-block" data-type="gap" style="height:260px"></div></div></div>`);
    const { block: tb } = window.makeTextBlock('h1'); const tf = window._makeTextFrame();
    window.applyTextOpts(tb, tf, {}, 'h1'); tf.appendChild(tb); tb.id = 'eT'; tf.id = 'eTF';
    const h = tb.querySelector('[class^="tb-"]'); h.textContent = '███'; h.style.color = '#2d6fe8'; h.style.fontSize = '80px'; h.style.lineHeight = '1';
    document.getElementById('eR1').appendChild(tf);
    const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'eA'; document.getElementById('eR2').appendChild(ab);
    const { block: sb } = window.makeShapeBlock('rectangle'); sb.id = 'eSh';
    const ss = document.createElement('div'); ss.className = 'frame-block'; ss.id = 'eShF';
    ss.dataset.width = '100'; ss.dataset.height = '100'; ss.style.width = '100px'; ss.style.height = '100px';
    ss.appendChild(sb); document.getElementById('eR3').appendChild(ss);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  await page.waitForFunction(() => !!document.querySelector('#eT [class^="tb-"]') && !!document.getElementById('eSh') && !!document.getElementById('eA'));
  return errs;
}

const PANEL_OF = { eT: 'txt', eSh: 'shape', eA: 'asset' };
/** 글자칸 화면 자리가 «멈출 때까지» 기다린다(줌·레이아웃이 몇 프레임 뒤에 자리 잡는다 — 실측: 바로 잰 rect 와 스크린샷이 어긋났다). */
const settle = (page, id) => page.waitForFunction((id) => {
  const e = document.getElementById(id); if (!e) return false;
  const r = e.getBoundingClientRect(); const k = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  const w = (window.__e3settle ||= {}); if (w[id] === k) { w[id + '#'] = (w[id + '#'] || 0) + 1; } else { w[id] = k; w[id + '#'] = 0; }
  return w[id + '#'] >= 5;
}, id, { polling: 'raf' });
/** 블럭을 진짜 마우스로 고른다 — 그 블럭의 패널(Effects 절)이 뜰 때까지(안 뜨면 다시 누른다). */
const pick = async (page, id) => {
  await expect(async () => {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
    await settle(page, id);
    const p = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
    await page.evaluate(() => { window.deselectAll?.(); ['txt', 'shape', 'asset'].forEach(P => document.getElementById(`${P}-fx-section`)?.remove()); });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(([id, P]) => document.getElementById(id).classList.contains('selected') && !!document.getElementById(`${P}-fx-section`), [id, PANEL_OF[id]], { timeout: 3000 });
  }).toPass({ timeout: 20000 });
};
const addList = (page, P) => page.evaluate((P) => { const a = document.getElementById(`${P}-fx-add`); return a ? [...a.options].slice(1).map(o => o.value) : null; }, P);
const ds = (page, id) => page.evaluate((id) => Object.fromEntries(Object.entries(document.getElementById(id).dataset).filter(([k]) => k.startsWith('fx'))), id);
const cards = (page) => page.evaluate(() => [...document.querySelectorAll('#txt-fx-list .prop-cell-card')].map(e => e.dataset.fxType));
/** 글자칸 computed text-shadow 를 겹으로 쪼갠다(괄호 안 쉼표는 안 쪼갠다). */
const layers = (page) => page.evaluate(() => {
  const ts = getComputedStyle(document.querySelector('#eT [class^="tb-"]')).textShadow;
  if (!ts || ts === 'none') return [];
  const out = []; let d = 0, cur = '';
  for (const ch of ts) { if (ch === '(') d++; if (ch === ')') d--; if (ch === ',' && d === 0) { out.push(cur.trim()); cur = ''; } else cur += ch; }
  if (cur.trim()) out.push(cur.trim());
  return out;
});
const addGlow = async (page) => {
  await page.selectOption('#txt-fx-add', 'glow');
  await page.waitForFunction(() => !!document.getElementById('txt-fxgl-card'));
};
/** Shadow 절 토글 — 숨은 checkbox 를 DOM click(change 가 뜬다 · 사람이 라벨을 누를 때와 같은 사건). */
const shadowToggle = async (page, on) => {
  await page.evaluate((on) => { const c = document.getElementById('txt-shadow-on'); if (!c) throw new Error('txt-shadow-on 없음'); if (c.checked !== on) c.click(); }, on);
  await page.waitForFunction((on) => document.querySelector('#eT [class^="tb-"]').dataset.shadowEnabled === (on ? 'true' : 'false'), on);
};

/* ══ G0 전제 ══ */
test('G0 전제 — 명부에 glow · 텍스트 목록 = 반사·글로우 · 도형/에셋 목록엔 글로우 없음 · 합성 문이 window 에 있다', async ({ page }) => {
  const errs = await setup(page);
  expect(await page.evaluate(() => window.fxTypeKeys()), '명부에 반사·글로우').toEqual(expect.arrayContaining(['reflect', 'glow']));
  expect(await page.evaluate(() => [typeof window.fxComposeTextShadow, typeof window.fxComposedTextShadowCss, typeof window.setFxGlow]), '합성 문·쓰개').toEqual(['function', 'function', 'function']);
  await pick(page, 'eT');
  const t = await addList(page, 'txt');
  expect(t, '★텍스트 목록에 반사와 함께 글로우').toEqual(expect.arrayContaining(['reflect', 'glow']));
  expect(await page.evaluate(() => document.querySelector('#txt-fx-add option[value="glow"]').textContent.trim()), '라벨').toBe('글로우');
  await pick(page, 'eSh'); expect(await addList(page, 'shape'), '도형 — 글로우 없음').not.toContain('glow');
  await pick(page, 'eA'); expect(await addList(page, 'asset'), '에셋 — 글로우 없음').not.toContain('glow');
  expect(errs).toEqual([]);
});

/* ══ G1 고르면 그것만 ══ */
test('G1 글로우를 고르면 그것만 붙는다 — 키 {fxGlow:on} · 카드 [glow] · text-shadow 3겹 · 기본색 #ff00ff', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  expect(await layers(page), '전제 — 처음엔 그림자 0겹').toEqual([]);
  await addGlow(page);
  expect(await ds(page, 'eT')).toEqual({ fxGlow: 'on' });
  expect(await cards(page)).toEqual(['glow']);
  const L = await layers(page);
  expect(L.length, '★3겹').toBe(3);
  expect(L.every(l => l.includes('rgb(255, 0, 255)')), `기본색 ${L}`).toBe(true);
  expect(L[2], '가장 큰 겹 = Blur 기본 20').toContain('20px');
  const labels = await page.evaluate(() => [...document.querySelectorAll('#txt-fxgl-body .prop-label')].map(e => e.textContent.trim()));
  expect(labels, '칸 = 이웃 카드와 같은 말·순서(슬라이더 → 색)').toEqual(['Blur', '불투명도', '색상']);
  expect(errs).toEqual([]);
});

/* ══ G2 값 → 그림 ══ */
test('G2 Blur 30 → 가장 큰 겹 30px · 불투명도 50 → alpha 0.5 · hex 00FF00 → 초록', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT'); await addGlow(page);
  await page.evaluate(() => { const s = document.getElementById('txt-fxgl-blur-slider'); s.value = '30'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect.poll(async () => (await layers(page))[2] || '').toContain('30px');
  expect((await layers(page))[0], '첫 겹 = 30×0.21').toContain('6.3px');
  await page.evaluate(() => { const s = document.getElementById('txt-fxgl-op-slider'); s.value = '50'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await expect.poll(async () => (await layers(page))[0] || '').toContain('0.5)');
  await page.fill('#txt-fxgl-color-hex', '00FF00');
  await page.locator('#txt-fxgl-color-hex').dispatchEvent('change');
  await expect.poll(async () => (await layers(page)).join('|')).toContain('rgba(0, 255, 0, 0.5)');
  expect(await ds(page, 'eT')).toEqual({ fxGlow: 'on', fxGlowBlur: '30', fxGlowOp: '50', fxGlowColor: '#00ff00' });
  expect(errs).toEqual([]);
});

/* ══ G3 ★Shadow 절과 공존 ══ */
test('G3 ★글로우 + Shadow 절 — 켜면 4겹(글로우 3 위 · 사용자 1 아래) · Shadow 끄면 3 · 글로우 ✕ 면 사용자 1 만', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT'); await addGlow(page);
  expect((await layers(page)).length, '전제 — 글로우 3겹').toBe(3);
  await shadowToggle(page, true);
  let L = await layers(page);
  expect(L.length, '★Shadow 를 켜도 글로우가 산다 — 4겹').toBe(4);
  expect(L.slice(0, 3).every(l => l.includes('rgb(255, 0, 255)')), '앞 셋 = 글로우').toBe(true);
  expect(L[3], '맨 뒤 = 사용자 그림자(2 2 4 · 0.5)').toBe('rgba(0, 0, 0, 0.5) 2px 2px 4px');
  await shadowToggle(page, false);
  expect((await layers(page)).length, 'Shadow 끔 → 글로우 3').toBe(3);
  await shadowToggle(page, true);
  await page.click('#txt-fxgl-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxgl-card'));
  L = await layers(page);
  expect(L, '★글로우 ✕ → 사용자 그림자만 남는다').toEqual(['rgba(0, 0, 0, 0.5) 2px 2px 4px']);
  expect(await ds(page, 'eT')).toEqual({});
  expect(errs).toEqual([]);
});

/* ══ G4 눈 · ✕ · 바이트 동일 ══ */
test('G4 눈 끔 = 키 보존·그림 0 · ✕ → 블럭·섹션 outerHTML 이 켜기 전과 바이트 동일', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  const snap = () => page.evaluate(() => ({ t: document.getElementById('eT').outerHTML, s: document.getElementById('eS').outerHTML }));
  const before = await snap();
  await addGlow(page);
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { blur: 12, op: 70, color: '#123456' }));
  expect((await snap()).t, '전제 — 켠 동안은 다르다').not.toBe(before.t);
  await page.click('#txt-fxgl-eye');
  await page.waitForFunction(() => document.getElementById('eT').dataset.fxGlow === 'off');
  expect(await layers(page), '눈 끔 → 그림 0').toEqual([]);
  expect((await ds(page, 'eT')).fxGlowBlur, '★값은 남는다').toBe('12');
  await page.click('#txt-fxgl-eye');
  await expect.poll(async () => (await layers(page)).length).toBe(3);
  await page.click('#txt-fxgl-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxgl-card'));
  expect(await snap(), '★✕ 뒤 = 켜기 전 바이트').toEqual(before);
  expect(errs).toEqual([]);
});

/* ══ G5 ⌘Z · 저장 왕복 ══ */
test('G5 더하기·슬라이더·✕ 각 ⌘Z 한 걸음 · 저장 왕복 뒤 키·인라인 유지 · watchAllFx ≥1', async ({ page }) => {
  const errs = await setup(page);
  const undo = async () => { await page.evaluate(() => document.activeElement?.blur?.()); await page.keyboard.press('Meta+z'); };
  await pick(page, 'eT'); await addGlow(page);
  await undo();
  await expect.poll(() => ds(page, 'eT'), '더하기 ⌘Z 1').toEqual({});
  await pick(page, 'eT'); await addGlow(page);
  await page.evaluate(() => { const s = document.getElementById('txt-fxgl-blur-slider'); s.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
    for (const v of ['24', '28', '33']) { s.value = v; s.dispatchEvent(new Event('input', { bubbles: true })); } });
  expect((await ds(page, 'eT')).fxGlowBlur).toBe('33');
  await undo();
  await expect.poll(async () => (await ds(page, 'eT')).fxGlowBlur, '슬라이더 드래그 ⌘Z 1 = 드래그 전').toBeUndefined();
  expect((await ds(page, 'eT')).fxGlow, '글로우는 남아 있다').toBe('on');
  await pick(page, 'eT');
  await page.click('#txt-fxgl-del');
  await page.waitForFunction(() => !document.getElementById('txt-fxgl-card'));
  await undo();
  await expect.poll(() => ds(page, 'eT'), '✕ ⌘Z 1').toEqual({ fxGlow: 'on' });

  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { blur: 17, color: '#00aaff' }));
  const st0 = await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').style.textShadow);
  expect(st0, '전제 — 인라인이 있다').toContain('17px');
  const snap = await page.evaluate(() => window.serializeProject());
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
  await page.waitForFunction(() => !!document.getElementById('eT'));
  expect(await ds(page, 'eT'), '저장 왕복 — 키').toEqual({ fxGlow: 'on', fxGlowBlur: '17', fxGlowColor: '#00aaff' });
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').style.textShadow), '저장 왕복 — 인라인').toBe(st0);
  expect(await page.evaluate(() => window.watchAllFx(document.getElementById('canvas'))), 'watchAllFx').toBeGreaterThanOrEqual(1);
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').style.textShadow), '재합성은 멱등').toBe(st0);
  expect(errs).toEqual([]);
});

/* ══ G6 하류 ══ */
test('G6 하류 — Figma textShadowSource 에 글로우색 · 그라데이션 글자 .tgs/--tgs-src 에 글로우 · 화면 픽셀(양성＋음성)', async ({ page }) => {
  const errs = await setup(page);
  /* ⒞ 픽셀 — 글자 오른쪽 8px 자리. 끈 판 = 배경색(음성), 켠 판 = 초록 쪽(양성) */
  await page.evaluate(() => document.getElementById('eT').scrollIntoView({ block: 'center' })); await settle(page, 'eT');
  const pt = await page.evaluate(() => { const h = document.querySelector('#eT [class^="tb-"]'); h.scrollIntoView({ block: 'center' });
    const rg = document.createRange(); rg.selectNodeContents(h); const q = rg.getBoundingClientRect(); return [Math.round(q.right + 8), Math.round(q.top + q.height / 2)]; });
  const px = async () => { const buf = await page.screenshot({ clip: { x: pt[0], y: pt[1], width: 1, height: 1 } });
    return page.evaluate(async (b64) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = 1; c.height = 1; const x = c.getContext('2d'); x.drawImage(i, 0, 0); return [...x.getImageData(0, 0, 1, 1).data.slice(0, 3)]; }, buf.toString('base64')); };
  const off = await px();
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { state: 'on', blur: 30, color: '#00ff00' }));
  const on = await px();
  console.log(`[G6] 글자 옆 8px — 끔 ${off} · 켬 ${on}`);
  expect(on[1] - on[0], `★양성 — 켜면 초록 쪽 ${on}`).toBeGreaterThan(20);
  expect(on, '★음성대조 — 끈 판과 다르다').not.toEqual(off);
  /* ⒝ Figma — export-figma-json 이 읽는 그 함수 */
  expect(await page.evaluate(() => window.textShadowSource(document.querySelector('#eT [class^="tb-"]'))), 'Figma 원천에 글로우').toContain('rgb(0, 255, 0)');
  /* ⒜ 그라데이션 글자 */
  await page.evaluate(() => window.applyTextGradient(document.getElementById('eT'), { css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)' }, { commit: true }));
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { blur: 20 }));
  const g = await page.evaluate(() => { const h = document.querySelector('#eT [class^="tb-"]'); return { tgs: h.classList.contains('tgs'), src: h.style.getPropertyValue('--tgs-src'), f: h.style.getPropertyValue('--tgs-filter') }; });
  expect(g.tgs, '그라데이션 글자 → .tgs').toBe(true);
  expect(g.src, '--tgs-src 에 글로우색').toContain('rgb(0, 255, 0)');
  expect(g.f, '여러 겹 = SVG 필터').toContain('url(#');
  expect(await page.evaluate(() => window.textShadowSource(document.querySelector('#eT [class^="tb-"]'))), 'Figma 원천(.tgs 판)').toContain('rgb(0, 255, 0)');
  expect(errs).toEqual([]);
});

/* ══ G7 ★하위호환 ══ */
test('G7 ★글로우 없는 블럭 — Shadow 절 켬/끔의 style 이 옛 통째 대입과 바이트 동일 · 키 없는 블럭은 applyFxGlow 무변', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'eT');
  /* 옛 동작의 자 — 같은 글자칸 사본에 옛 _apply 가 하던 대입을 그대로 한다 */
  const ref = (css) => page.evaluate((css) => { const h = document.querySelector('#eT [class^="tb-"]'); const d = document.createElement('div');
    d.setAttribute('style', h.getAttribute('style') || ''); d.style.textShadow = css; return d.getAttribute('style'); }, css);
  const want0 = await ref('');
  const wantOn = await ref('2px 2px 4px rgba(0,0,0,0.5)');
  await shadowToggle(page, true);
  const gotOn = await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').getAttribute('style'));
  expect(gotOn, '★켬 = 옛 대입 바이트').toBe(wantOn);
  await shadowToggle(page, false);
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').getAttribute('style')), '★끔 = 옛 대입 바이트').toBe(want0);
  /* 옛 문서(키 없음) — applyFxGlow·watchAll 은 손대지 않는다 */
  const b0 = await page.evaluate(() => document.getElementById('eS').outerHTML);
  const n = await page.evaluate(() => { window.applyFxGlow(document.getElementById('eT')); return window.watchAllFxGlow(document.getElementById('canvas')); });
  expect(n, '걸린 블럭 0').toBe(0);
  expect(await page.evaluate(() => document.getElementById('eS').outerHTML), '★키 없음 = 바이트 그대로').toBe(b0);
  expect(errs).toEqual([]);
});

/* ══ G8 실측 기록 — 반사에 글로우가 비치나 ══ */
test('G8 실측 기록 — 반사(-webkit-box-reflect) 띠에 글로우가 비치는가(GLOW_SHOWS_IN_REFLECTION 과 같아야 한다) · 양성＋음성대조', async ({ page }) => {
  const errs = await setup(page);
  /* ★계측기 — 글자 «옆»(글로우만 있는 자리)을 반사 띠로 «거울에 비춘 자리»에서 잰다(gap 0 → y' = 2·바닥 − y).
     음성대조 = 반사 «없이» 글로우만 켰을 때 그 자리 변화(글로우 자체가 띠 자리까지 번진 몫). 비친다 = 반사 몫이 그것보다 크다. */
  await page.evaluate(() => document.getElementById('eT').scrollIntoView({ block: 'center' })); await settle(page, 'eT');
  const P = await page.evaluate(() => { const h = document.querySelector('#eT [class^="tb-"]');
    const rg = document.createRange(); rg.selectNodeContents(h); const q = rg.getBoundingClientRect(); const b = document.getElementById('eT').getBoundingClientRect();
    const x = Math.round(q.right + 4); const ys = [0.3, 0.45, 0.6, 0.75].map(k => q.top + q.height * k);
    return { side: ys.map(y => [x, Math.round(y)]), band: ys.map(y => [x, Math.round(2 * b.bottom - y)]) }; });
  const read = async (pts) => { const buf = await page.screenshot();
    return page.evaluate(async ({ b64, pts }) => { const i = new Image(); i.src = 'data:image/png;base64,' + b64; await i.decode(); const c = document.createElement('canvas'); c.width = i.width; c.height = i.height; const x = c.getContext('2d'); x.drawImage(i, 0, 0);
      return pts.map(([X, Y]) => [...x.getImageData(X, Y, 1, 1).data.slice(0, 3)]); }, { b64: buf.toString('base64'), pts }); };
  const diff = (a, b) => a.reduce((n, p, i) => n + Math.abs(p[0] - b[i][0]) + Math.abs(p[1] - b[i][1]) + Math.abs(p[2] - b[i][2]), 0);
  const glow = (on) => page.evaluate((on) => window.setFxGlow(document.getElementById('eT'), on ? { state: 'on', blur: 20, color: '#00ff00' } : { state: 'none' }), on);
  const b0 = { side: await read(P.side), band: await read(P.band) };
  await glow(true);
  const g1 = { side: await read(P.side), band: await read(P.band) };
  await glow(false);
  await page.evaluate(() => window.setFxReflect(document.getElementById('eT'), { state: 'on', gap: 0, len: 100, op: 100 }));
  await settle(page, 'eT');
  const r0 = await read(P.band);
  await glow(true);
  const r1 = await read(P.band);
  const dSide = diff(g1.side, b0.side), dDirect = diff(g1.band, b0.band), dBand = diff(r1, r0);
  const shows = dBand > dDirect + 60;
  console.log(`[G8] 양성(글자 옆) ${dSide} · 음성(반사 없이 띠 자리) ${dDirect} · 반사 띠 변화 ${dBand} ⇒ 글로우는 반사에 ${shows ? '비친다' : '안 비친다'}`);
  expect(dSide, '★양성대조 — 글로우가 글자 옆에 그려졌다').toBeGreaterThan(60);
  const src = fs.readFileSync(path.join(ROOT, 'js/effects-glow.js'), 'utf8');
  const m = src.match(/GLOW_SHOWS_IN_REFLECTION\s*=\s*(true|false)/);
  expect(m, '코드에 실측 기록이 있다').toBeTruthy();
  expect(shows, '★실측 = 코드의 기록').toBe(m[1] === 'true');
  expect(errs).toEqual([]);
});

/* ══ G9 이스트에그 공존 ══ */
test('G9 이스트에그 네온과 공존 — 둘 다 데이터가 남고 · 글로우 ✕ 뒤 네온 text-shadow 가 돌아온다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => window.applyTextEffect(document.getElementById('eT'), { preset: 'neon' }));
  await page.waitForFunction(() => document.querySelector('#eT [class^="tb-"]').classList.contains('tfx-neon'));
  const neon = await layers(page);
  expect(neon.length, '전제 — 네온 text-shadow 가 산다').toBeGreaterThan(3);
  const te0 = await page.evaluate(() => document.getElementById('eT').dataset.textEffect || null);
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { state: 'on', color: '#00ff00' }));
  expect((await layers(page)).length, '켠 동안 = 카드 글로우(인라인이 이긴다)').toBe(3);
  expect(await page.evaluate(() => document.getElementById('eT').dataset.textEffect || null), '이스트에그 데이터 보존').toBe(te0);
  await page.evaluate(() => window.setFxGlow(document.getElementById('eT'), { state: 'none' }));
  expect(await layers(page), '★✕ → 네온 복귀').toEqual(neon);
  expect(await page.evaluate(() => document.querySelector('#eT [class^="tb-"]').classList.contains('tfx-neon')), '네온 클래스 그대로').toBe(true);
  expect(errs).toEqual([]);
});
