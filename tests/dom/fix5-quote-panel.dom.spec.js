/* fix5-quote-panel.dom.spec.js — 1012t1H5 인용구 우측 패널: Fill VAR·최근 / Stroke / 스타일 단추 7
 *
 * 현빈 원문(👉): 「우측 패널 fill 부분 : [ 글자색 / var, 최근이 있어야되는거 아니겠니? 그리고 스트로크 옵션도
 *   필요해 보이고,,? [B I S] 이것도 왜이리 적니? 폰트도 기본 프리텐다드로 되게 해줘.」
 * 고치기 전 판(ca702d40) 실측: Fill = 글자색 % 만(VAR·최근 없음) · Stroke 절 없음 · 스타일 단추 3.
 *
 * ★«있다»만 재지 않는다 — 진짜 클릭으로 누르고 «인용구 글자(.tb-qt-line)에 먹었나»를 computed 로 잰다.
 * 양성대조: GD1001_ROOT=<ca702d40 사본> 로 돌리면 F1~F5 가 빨강이어야 한다(F6 Pretendard 는 양쪽 초록 — 회귀 지킴이).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-quote-panel.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page, opts = {}, { before } = {}) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([o, pre]) => {
    if (pre === 'recent') window.DesignSystem.pushColorHistory('#12ab34');
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" data-section="1" id="sQ"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll && window.rebindAll();
    window.applyZoom && window.applyZoom(100);
    window.deselectAll && window.deselectAll();
    window.selectSection(document.getElementById('sQ'));
    window.addQuoteBlock(o);
    window.__qt = [...document.querySelectorAll('#sQ .quote-block')].pop();
    window.deselectAll && window.deselectAll();
    window.__qt && window.__qt.scrollIntoView({ block: 'center' });
  }, [opts, before || null]);
  await page.waitForFunction(() => !!window.__qt && window.__qt.isConnected, null, { timeout: 5000 });
  return errs;
}

/** 진짜 클릭으로 블럭을 골라 패널을 연다. */
async function openPanel(page) {
  await page.evaluate(() => { window.__qt.dataset.pnl = '1'; });
  const r = await waitStableRect(page, '[data-pnl="1"]');
  await clickAt(page, r.cx, r.cy, { sel: '[data-pnl="1"]' }, { label: '인용구 고르기' });
  await page.waitForFunction(() => !!document.getElementById('qt-shape-group'), null, { timeout: 5000 });
}

/** 패널 안 요소를 화면에 들이고 진짜 마우스로 누른다. */
async function clickSel(page, sel, label) {
  const ok = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; e.scrollIntoView({ block: 'center' }); return true; }, sel);
  expect(ok, `${label}: ${sel} 가 없다`).toBe(true);
  const r = await waitStableRect(page, sel);
  /* `#id` 꼴은 clickAt 이 «정확히 그 요소»만 받는다 — 단추 안 <u>·<svg> 를 맞혀도 단추로 치게 속성 꼴로 넘긴다 */
  const spec = /^#[\w-]+$/.test(sel) ? `[id="${sel.slice(1)}"]` : sel;
  await clickAt(page, r.cx, r.cy, { sel: spec }, { label });
}

const lineInfo = (page) => page.evaluate(() => {
  const l = window.__qt.querySelector('.tb-qt-line');
  const cs = getComputedStyle(l);
  const hl = l.querySelector('span.tb-hl');
  const gl = l.querySelector('span.tb-glow');
  return {
    color: cs.color,
    deco: cs.textDecorationLine,
    strokeW: cs.webkitTextStrokeWidth,
    paintOrder: cs.paintOrder,
    hl: hl ? getComputedStyle(hl).backgroundImage : null,
    glow: gl ? getComputedStyle(gl).textShadow : null,
    dots: l.querySelectorAll('span.tb-dot').length,
    dotI: [...l.querySelectorAll('span.tb-dot')].map(sp => sp.style.getPropertyValue('--tb-dot-i')),
    dotBefore: l.querySelector('span.tb-dot') ? getComputedStyle(l.querySelector('span.tb-dot'), '::before').width : null,
    text: l.textContent,
  };
});

/* F1 — Fill VAR 칩: 있고, 누르면 인용구 글자색이 그 변수에 «바인딩»된다 */
test('F1 Fill VAR 칩을 누르면 인용구 글자색이 var(--color-*) 로 묶이고 화면 색이 그 변수 색이 된다', async ({ page }) => {
  const errs = await setup(page, { text: '안녕 세상' });
  await openPanel(page);
  const cen = await page.evaluate(() => {
    const box = document.getElementById('qt-textcol-chips');
    const fill = box && box.closest('.prop-section');
    return {
      box: !!box, hidden: box ? box.hidden : null,
      inFill: fill ? (fill.querySelector('.prop-section-title')?.textContent || '').trim() : null,
      chips: box ? [...box.querySelectorAll('.cv-chip[data-cv-name]')].map(c => c.dataset.cvName) : [],
      label: box?.querySelector('.cv-chips-label')?.textContent.trim() || null,
    };
  });
  expect(cen.box, '#qt-textcol-chips(VAR 줄)가 있어야 한다').toBe(true);
  expect(cen.inFill, 'VAR 줄은 Fill 절 안').toBe('Fill');
  expect(cen.hidden, 'VAR 줄이 보인다(기본 변수 3종)').toBe(false);
  expect(cen.label).toBe('VAR');
  expect(cen.chips.length >= 1, `칩 수 ${JSON.stringify(cen.chips)}`).toBe(true);

  const name = cen.chips[0];
  const varHex = await page.evaluate((n) => window.DesignSystem.getColorVars()[n], name);
  await clickSel(page, `#qt-textcol-chips .cv-chip[data-cv-name="${name}"]`, 'VAR 칩');
  const after = await page.evaluate(() => ({ ds: window.__qt.dataset.textColor }));
  expect(after.ds, `dataset.textColor 가 var() 바인딩이어야 한다. 잰 값 ${after.ds}`).toMatch(new RegExp(`^var\\(--color-${name}\\b`));
  const li = await lineInfo(page);
  const want = await page.evaluate((h) => { const d = document.createElement('div'); d.style.color = h; document.body.appendChild(d); const c = getComputedStyle(d).color; d.remove(); return c; }, varHex);
  expect(li.color, `인용구 글자의 화면 색 = 변수 색(${varHex})`).toBe(want);
  /* 변수 값을 바꾸면 따라 바뀐다(정적 hex 복사가 아니라 바인딩) */
  await page.evaluate((n) => window.DesignSystem.setColorVar(n, '#0a0b0c'), name);
  expect((await lineInfo(page)).color, '변수를 바꾸면 인용구 글자색이 따라온다').toBe('rgb(10, 11, 12)');
  /* 칩 active */
  const active = await page.evaluate((n) => document.querySelector(`#qt-textcol-chips .cv-chip[data-cv-name="${n}"]`)?.classList.contains('active'), name);
  expect(active, '누른 칩이 active').toBe(true);
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});

/* F2 — Fill 최근 줄: 색 히스토리가 있으면 보이고, 누르면 그 hex 가 고정으로 들어간다 */
test('F2 Fill 「최근」 줄을 누르면 인용구 글자색이 그 색으로 고정된다', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' }, { before: 'recent' });
  await openPanel(page);
  const cen = await page.evaluate(() => {
    const row = document.querySelector('#panel-right .cv-recent-row');
    return {
      row: !!row, hidden: row ? row.hidden : null,
      inFill: row ? (row.closest('.prop-section')?.querySelector('.prop-section-title')?.textContent || '').trim() : null,
      label: row?.querySelector('.cv-recent-label')?.textContent.trim() || null,
      has: !!row?.querySelector('.cv-chip.recent[data-cv-recent="#12ab34"]'),
    };
  });
  expect(cen.row, '최근 줄이 있어야 한다').toBe(true);
  expect(cen.inFill).toBe('Fill');
  expect(cen.hidden).toBe(false);
  expect(cen.label).toBe('최근');
  expect(cen.has, '쌓아 둔 #12ab34 칩').toBe(true);
  await clickSel(page, '#panel-right .cv-recent-row .cv-chip.recent[data-cv-recent="#12ab34"]', '최근 칩');
  expect(await page.evaluate(() => window.__qt.dataset.textColor)).toBe('#12ab34');
  expect((await lineInfo(page)).color).toBe('rgb(18, 171, 52)');
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});

/* F3 — Stroke 절: 켜고 두께·위치를 바꾸면 인용구 글자에 외곽선이 그려지고, 다시 그려도·다시 열어도 남는다 · ⌘Z 로 돌아간다 */
test('F3 Stroke 절을 켜면 인용구 글자에 외곽선이 생기고 두께·위치가 먹으며 dataset 에 남는다', async ({ page }) => {
  const errs = await setup(page, { text: '안녕' });
  await openPanel(page);
  const sec = await page.evaluate(() => {
    const s = document.getElementById('qt-stroke-section');
    const titles = [...document.querySelectorAll('#panel-right .prop-section-title')].map(e => e.textContent.trim());
    return { has: !!s, titles, on: document.getElementById('qt-stroke-on')?.checked ?? null };
  });
  expect(sec.has, `Stroke 절이 있어야 한다. 절 제목 ${JSON.stringify(sec.titles)}`).toBe(true);
  expect(sec.titles.indexOf('Stroke') > sec.titles.indexOf('Fill'), 'Stroke 는 Fill 뒤(텍스트블럭과 같은 순서)').toBe(true);
  expect(sec.on).toBe(false);
  expect((await lineInfo(page)).strokeW, '켜기 전 외곽선 0').toBe('0px');

  const h0 = await page.evaluate(() => window.__qt.dataset.textStrokeOn ?? null);
  expect(h0).toBeNull();
  await clickSel(page, '#qt-stroke-section .prop-toggle', 'Stroke 켜기');
  let li = await lineInfo(page);
  expect(await page.evaluate(() => window.__qt.dataset.textStrokeOn)).toBe('true');
  expect(li.strokeW, '외부(기본) 2px ⇒ 그리는 획 4px').toBe('4px');
  expect(li.paintOrder).toMatch(/^stroke/);

  /* 두께 6 */
  await page.evaluate(() => { const n = document.getElementById('qt-stroke-w-number'); n.value = '6'; n.dispatchEvent(new Event('input', { bubbles: true })); n.dispatchEvent(new Event('change', { bubbles: true })); });
  expect((await lineInfo(page)).strokeW).toBe('12px');
  /* 위치 = 가운데 */
  await page.evaluate(() => { const s = document.getElementById('qt-stroke-align'); s.value = 'center'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  li = await lineInfo(page);
  expect(li.strokeW, '가운데 = 두께 그대로').toBe('6px');
  expect(await page.evaluate(() => ({ w: window.__qt.dataset.textStrokeW, a: window.__qt.dataset.textStrokeAlign }))).toEqual({ w: '6', a: 'center' });

  /* 다시 그리기(로드와 같은 길) 뒤에도 남는다 + 패널을 다시 열면 그 값이 보인다 */
  await page.evaluate(() => { window.renderQuoteBlock(window.__qt); window.showQuoteProperties(window.__qt); });
  expect((await lineInfo(page)).strokeW).toBe('6px');
  expect(await page.evaluate(() => ({ on: document.getElementById('qt-stroke-on').checked, w: document.getElementById('qt-stroke-w-number').value, a: document.getElementById('qt-stroke-align').value })))
    .toEqual({ on: true, w: '6', a: 'center' });
  /* 부호는 안 건드린다 */
  expect(await page.evaluate(() => getComputedStyle(window.__qt.querySelector('.tb-qt-mark')).webkitTextStrokeWidth)).toBe('0px');
  /* 블럭 자체에 필터가 안 걸린다(부호까지 번지지 않게 — text-stroke-filter 관찰자 셀렉터 회피) */
  expect(await page.evaluate(() => window.__qt.style.getPropertyValue('--gd-stroke-filter'))).toBe('');

  /* 위치 = 내부 — 텍스트블럭과 같은 SVG 필터 길(줄에만 --gd-stroke-filter · 블럭엔 없음) */
  await page.evaluate(() => { const s = document.getElementById('qt-stroke-align'); s.value = 'inside'; s.dispatchEvent(new Event('change', { bubbles: true })); });
  const ins = await page.evaluate(() => {
    const l = window.__qt.querySelector('.tb-qt-line');
    const v = l.style.getPropertyValue('--gd-stroke-filter');
    const id = (v.match(/#([\w-]+)/) || [])[1];
    return { v, def: !!(id && document.getElementById(id)), filter: getComputedStyle(l).filter, blk: window.__qt.style.getPropertyValue('--gd-stroke-filter') };
  });
  expect(ins.v, `내부 외곽선 필터 — 잰 값 ${JSON.stringify(ins)}`).toMatch(/^url\(#/);
  expect(ins.def, '필터 정의가 문서에 있다').toBe(true);
  expect(ins.filter).not.toBe('none');
  expect(ins.blk).toBe('');

  /* 되돌리기 — 패널 조작이 히스토리 칸을 남겼나: ⌘Z 를 거듭하면 외곽선이 꺼진 상태로 돌아간다 */
  for (let i = 0; i < 6; i++) {
    const on = await page.evaluate(() => document.querySelector('.quote-block')?.dataset.textStrokeOn ?? null);
    if (on === null) break;
    await page.evaluate(() => window.undo());
  }
  expect(await page.evaluate(() => document.querySelector('.quote-block')?.dataset.textStrokeOn ?? null), '⌘Z 로 외곽선 켜기 전으로').toBeNull();
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});

/* F4 — 스타일 단추 7 (텍스트블럭과 같은 순서) + 누르면 인용구 글자에 먹는다 */
test('F4 스타일 단추가 텍스트블럭과 같은 7개이고, 밑줄·형광펜·점·글로우가 인용구 글자에 실제로 먹는다', async ({ page }) => {
  const errs = await setup(page, { text: '안녕 세상' });
  await openPanel(page);
  const ids = await page.evaluate(() => [...document.querySelectorAll('#qt-typo-style-group .prop-style-btn')].map(b => b.id));
  expect(ids, '단추 7 — B I U S H 점 글로우').toEqual([
    'qt-typo-bold-btn', 'qt-typo-italic-btn', 'qt-typo-underline-btn', 'qt-typo-strike-btn',
    'qt-typo-highlight-btn', 'qt-typo-dot-btn', 'qt-typo-glow-btn']);
  /* 다 닿나(잘려서 안 눌리는 단추 0) */
  const reach = await page.evaluate((list) => list.map(id => {
    const el = document.getElementById(id); el.scrollIntoView({ block: 'center' });
    const r = el.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return { id, ok: !!hit && (hit === el || el.contains(hit)) };
  }), ids);
  for (const r of reach) expect(r.ok, `${r.id} 가 안 눌린다(가려짐·잘림)`).toBe(true);

  const base = await lineInfo(page);
  expect(base.deco).toBe('none');
  expect(base.hl).toBeNull();

  await clickSel(page, '#qt-typo-underline-btn', 'U');
  let li = await lineInfo(page);
  expect(li.deco, '밑줄').toBe('underline');
  await clickSel(page, '#qt-typo-strike-btn', 'S');
  li = await lineInfo(page);
  expect(li.deco.split(' ').sort(), '밑줄＋취소선 함께').toEqual(['line-through', 'underline']);

  await clickSel(page, '#qt-typo-highlight-btn', 'H');
  li = await lineInfo(page);
  expect(li.hl && li.hl !== 'none', `형광펜 획(background-image) — 잰 값 ${li.hl}`).toBe(true);
  expect(li.text, '글은 그대로').toBe('안녕 세상');

  await clickSel(page, '#qt-typo-dot-btn', '점');
  li = await lineInfo(page);
  expect(li.dots, '공백 뺀 글자마다 점 하나').toBe(4);
  expect(li.dotBefore, '점 지름(기본 4px)').toBe('4px');
  /* 점 자리 번호 — 가운데가 0(텍스트블럭 _dotReindex 와 같은 규약) ⇒ 간격을 줘도 양쪽으로 퍼진다 */
  expect(li.dotI, '--tb-dot-i = 자리 − (n−1)/2').toEqual(['-1.5', '-0.5', '0.5', '1.5']);
  expect(li.text).toBe('안녕 세상');

  await clickSel(page, '#qt-typo-glow-btn', '글로우');
  li = await lineInfo(page);
  expect(li.glow && li.glow !== 'none', `글로우 text-shadow — 잰 값 ${li.glow}`).toBe(true);

  const ds = await page.evaluate(() => { const d = window.__qt.dataset; return [d.underline, d.strike, d.highlight, d.dot, d.glow]; });
  expect(ds, 'dataset 에 남는다(저장·로드 = dataset)').toEqual(['1', '1', '1', '1', '1']);
  const act = await page.evaluate((list) => list.map(id => document.getElementById(id).classList.contains('active')), ids);
  expect(act, '켠 단추 active(B·I 는 안 켬)').toEqual([false, false, true, true, true, true, true]);

  /* 다시 그려도 남는다 · 다시 누르면 꺼진다 */
  await page.evaluate(() => { window.renderQuoteBlock(window.__qt); window.showQuoteProperties(window.__qt); });
  li = await lineInfo(page);
  expect([li.dots, !!li.hl, !!li.glow]).toEqual([4, true, true]);
  await clickSel(page, '#qt-typo-dot-btn', '점 끄기');
  await clickSel(page, '#qt-typo-highlight-btn', 'H 끄기');
  li = await lineInfo(page);
  expect([li.dots, li.hl]).toEqual([0, null]);
  expect(await page.evaluate(() => [window.__qt.dataset.dot ?? null, window.__qt.dataset.highlight ?? null])).toEqual([null, null]);
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});

/* F5 — 내보내기: 효과 span(점 = 글자마다 span · 형광펜·글로우 span)이 글자를 «더» 싣지 않는다 · VAR 색은 풀린 색으로 나간다
   ⚠️고치기 전 판에서도 texts 에 글이 ★두 번 있다(.tb-qt-body 와 .tb-qt-line 이 둘 다 tb- 라 둘 다 수집 — 기존 동작, 이 단위 밖).
     ⇒ 여기서는 «효과를 켜기 전과 후의 texts 가 같다»를 잰다(효과가 더한 몫 = 0). */
test('F5 Figma JSON — 효과를 켜도 texts 가 켜기 전과 같고, VAR 글자색이 var() 날글자로 새지 않는다', async ({ page }) => {
  const errs = await setup(page, { text: '가나다' });
  const exp = () => page.evaluate(async () => {
    const ps = { bg: '#eeeeee', padX: 0 };
    const { state } = await import('/js/globals.js');
    state.pages = [{ canvas: document.getElementById('canvas').innerHTML, pageSettings: ps }];
    state.pageSettings = ps;
    const json = window.buildFigmaExportJSON(null);
    let gen = null;
    const walk = (b) => { if (!b || typeof b !== 'object') return; if (b.kind === 'quote') gen = b; (b.children || []).forEach(c => walk(c.block || c)); };
    (json.sections || []).forEach(s => (s.blocks || []).forEach(b => walk(b.block || b)));
    return gen ? gen.texts.map(t => ({ t: t.t, color: t.color })) : null;
  });
  const off = await exp();
  expect(off, '인용구 generic 블럭').not.toBeNull();
  await page.evaluate(() => {
    const b = window.__qt;
    Object.assign(b.dataset, { dot: '1', highlight: '1', glow: '1', underline: '1', textColor: 'var(--color-primary, #123456)' });
    window.renderQuoteBlock(b);
  });
  expect(await page.evaluate(() => window.__qt.querySelectorAll('.tb-qt-line span.tb-dot').length), '전제: 점 span 이 섰다').toBe(3);
  const on = await exp();
  expect(on.map(t => t.t), `효과가 글자를 더 싣지 않는다 — 끈 판 ${JSON.stringify(off.map(t => t.t))}`).toEqual(off.map(t => t.t));
  /* ⚠️색: 이 길(buildFigmaExportJSON 은 직렬본을 떼어 읽는다)에서는 computed 가 비어 폴백 '#111111' 이 나간다 — 켜기 전에도 같다(기존 한계).
     ⇒ 여기서는 «var() 날글자가 JSON 에 새지 않는다»만 잰다. */
  const lineCol = on.find(t => t.t === '가나다').color;
  expect(String(lineCol).includes('var('), `var() 날글자가 새면 안 된다 — 잰 값 ${lineCol}`).toBe(false);
  expect(lineCol, '색 칸은 켜기 전과 같은 길로 나간다').toBe(off.find(t => t.t === '가나다').color);
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});

/* F6 — 회귀 지킴이: 새 인용구 폰트 기본 = Pretendard (이미 ✅ — 지키기만) */
test('F6 새 인용구의 글꼴 기본은 Pretendard 이고 패널도 그렇게 보인다', async ({ page }) => {
  const errs = await setup(page, {});
  await openPanel(page);
  const r = await page.evaluate(() => ({
    ds: window.__qt.dataset.fontFamily || '',
    ff: getComputedStyle(window.__qt.querySelector('.tb-qt-line')).fontFamily,
    panel: document.getElementById('qt-typo-font-name')?.textContent.trim(),
  }));
  expect(r.ds).toMatch(/Pretendard/);
  expect(r.ff).toMatch(/Pretendard/);
  expect(r.panel).toMatch(/Pretendard/);
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});

/* F7 — 외곽선을 «안 켠» 인용구는 줄 DOM 이 옛 판과 바이트 같다(applyStroke 를 켰을 때만 부른다).
   ⚠️두께·색·위치 값만 남고 켜기가 꺼진 블럭(패널에서 켰다 끈 블럭)도 같아야 한다 — 늘 부르면 data-stroke-* 가 줄에 붙는다. */
test('F7 외곽선이 꺼진 인용구의 줄 DOM 은 키가 없을 때와 바이트 같다(data-stroke-*·획 선언 0)', async ({ page }) => {
  const errs = await setup(page, { text: '가나\n다라' });
  const r = await page.evaluate(() => {
    const b = window.__qt;
    const snap = () => [...b.querySelectorAll('.tb-qt-line')].map(l => l.outerHTML);
    window.renderQuoteBlock(b);
    const none = snap();
    Object.assign(b.dataset, { textStrokeW: '6', textStrokeColor: '#ff0000', textStrokeAlign: 'inside' });
    window.renderQuoteBlock(b);
    const offKept = snap();
    b.dataset.textStrokeOn = 'true';
    window.renderQuoteBlock(b);
    const on = snap();
    return { none, offKept, on };
  });
  expect(r.none.length, '전제: 줄 둘').toBe(2);
  expect(r.none.join('').includes('stroke'), `키 없는 블럭 줄에 stroke 흔적 0 — ${r.none.join('')}`).toBe(false);
  expect(r.offKept, '켜기 꺼짐 + 값만 남은 블럭 = 키 없는 블럭과 바이트 같다').toEqual(r.none);
  expect(r.on.every(h => h.includes('data-stroke-on="true"')), '음성대조: 켜면 줄이 달라진다(자가 살아 있다)').toBe(true);
  expect(errs, `페이지 오류 ${errs.join(' | ')}`).toEqual([]);
});
