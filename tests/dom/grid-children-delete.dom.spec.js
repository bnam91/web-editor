/* grid-children-delete.dom.spec.js — E55 「그리드 밑 자식(.grd-children)을 골라 Delete/⌫ 하면 그리드째 사라진다」 (태양 2026-10-04)
 *   결함(실측 dev 5015a2ab): 글자 자식은 자기 .row 없이 맨몸 글자래퍼로 그릇 밑에 산다 → deleteSelectedFromCanvas 의
 *   closest('.row') 가 «그리드를 품은 줄(rG)»까지 올라가 그리드+자식 전부를 지웠다. 고침 = editor.js BLOCK_KIDS_BOX_SEL 경계.
 * E57 「지우기 네 경우」:
 *   ⒜ 자식 고름(클릭) → Delete·Backspace = 그 자식만 · 그리드·다른 자식 남음 — ★글자 자식·에셋 자식 둘 다
 *   ⒝ 그리드 고름 → Delete = 그리드+자식 통째
 *   ⒞ 자식 글자 편집 중 ⌫ = 글자만
 *   ⒟ 각각 ⌘Z 한 번 = 한 단계(지우기 전과 같다)
 *   ⒠ 키 누르기 직전 선택 목록을 로그로 남긴다(console.log '[E55 sel]')
 *   + 지키는 시험 N: 그리드 «밖» 보통 글자 줄 · 프레임 안 글자 — 종전 단위(줄째 / 프레임 유지) 그대로.
 * ★전제 단언 «먼저»(자식 셋이 실제로 그릇에 있다 — 0건 초록 금지). 진짜 마우스·키(page.mouse / keyboard).
 * ★양성대조: GD1001_ROOT=<5015a2ab 사본> 으로 ⒜ 빨강(그리드째 사라짐) · 경계 끈 변이로도 ⒜ 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const COLS = '[{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;가&quot;}]},{&quot;width&quot;:1,&quot;lines&quot;:[{&quot;type&quot;:&quot;body&quot;,&quot;text&quot;:&quot;다&quot;}]}]';
const SEC = `<div class="section-block" id="sG" data-section="1" data-name="G"><div class="section-hitzone"></div><div class="section-inner" id="innerG">
<div class="gap-block" data-type="gap" id="g0" style="height:40px"></div>
<div class="row" id="rT"><div class="text-block" data-type="body" id="tT"><div class="tb-body">보통 글</div></div></div>
<div class="row" id="rG"><div class="grid-block" id="gG" data-type="grid" data-gap="24" data-valign="top" data-cols="${COLS}"></div></div>
<div class="frame-block" id="fF" data-full-width="true" style="background:#fff;width:100%;box-sizing:border-box;padding:20px"><div class="frame-block" data-text-frame="true" id="tfF"><div class="text-block" data-type="body" id="tF"><div class="tb-body">프레임 글</div></div></div><div class="row" id="rF2"><div class="asset-block" id="aF2" data-align="center" style="min-height:40px"><div class="asset-overlay"></div></div></div></div>
<div class="row" id="rM"><div class="frame-block" id="mS" data-full-width="true" style="background:#eef;width:100%;box-sizing:border-box;padding:20px"><div class="frame-block" data-text-frame="true" id="mST1"><div class="text-block" data-type="body" id="mSt1"><div class="tb-body">모달꼴 하나</div></div></div><div class="frame-block" data-text-frame="true" id="mST2"><div class="text-block" data-type="body" id="mSt2"><div class="tb-body">모달꼴 둘</div></div></div></div><div class="gap-block" data-type="gap" id="rMg" style="height:10px"></div></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:300px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  page.on('console', m => { if (m.text().startsWith('[E55')) console.log(m.text()); });
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.renderGridBlock?.(document.getElementById('gG'));
    /* 자식 셋: 글자 둘(맨몸 글자래퍼) + 에셋 하나(자기 줄) — G19 입구 그대로 */
    const t1 = window.addGridChild('gG', 'body').block, t2 = window.addGridChild('gG', 'body').block, a = window.addGridChild('gG', 'image').block;
    t1.id = 'tK1'; t1.closest('.frame-block').id = 'kT1'; t1.querySelector('[contenteditable], .tb-body, div').textContent = '자식하나';
    t2.id = 'tK2'; t2.closest('.frame-block').id = 'kT2'; t2.querySelector('[contenteditable], .tb-body, div').textContent = '자식둘';
    a.id = 'aK'; a.closest('.row').id = 'kA'; a.style.minHeight = '60px';
    window.deselectAll?.(); window.buildLayerPanel?.();
    window.clearHistory?.();
  }, SEC);
  await page.waitForTimeout(400);
  const pre = await page.evaluate(() => ({
    kids: [...document.querySelector('#gG > .grd-children').children].map(k => k.id),
    tf: document.getElementById('kT1').dataset.textFrame, ownRow: !!document.getElementById('tK1').parentElement.closest('.row') && document.getElementById('tK1').closest('.row').id,
  }));
  /* 전제: 결함의 모양 그대로 — 글자 자식의 closest('.row') 가 그리드 줄 rG 다(자기 줄 없음) */
  expect(pre).toEqual({ kids: ['kT1', 'kT2', 'kA'], tf: 'true', ownRow: 'rG' });
  return errs;
}
const rect = (page, q) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, top: r.top, h: r.height }; }, q);
/* ★E56 겹침(G15 ＋ 와 함께 든 묶음, 2026-10-04 태양): 그리드에 마우스가 올라가면 아래 ＋(지름 화면 40px)가 «블럭 가로 가운데 · 껍데기 바로 아래»에 떠서
   첫 자식 위를 덮는다(100% 15.8px · 40% 30.3px — 지디 ㉠ 「원 안만 히트」로 의도). 첫 자식 «가로 가운데»를 누르면 ＋ 원 안이라 행이 더해진다.
   ⇒ 이 시험이 재는 것(자식 고르기·지우기)은 ＋ 와 무관하므로, 첫 자식은 «왼쪽 1/5 지점»을 누른다(＋ 원 밖). 시험의 뜻은 그대로다. */
const rectOffPlus = (page, q) => page.evaluate((q) => { const e = document.querySelector(q); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left + r.width * 0.2, y: r.top + r.height / 2, top: r.top, h: r.height }; }, q);
/* 구조 지문 — id 순서 + 글자. 선택 클래스·편집 속성은 안 본다(⌘Z 비교용). */
const sig = (page) => page.evaluate(() => { const c = document.getElementById('canvas'); return [...c.querySelectorAll('[id]')].map(e => e.id).join(',') + '|' + c.textContent.replace(/\s+/g, ' '); });
const kids = (page) => page.evaluate(() => [...(document.querySelector('#gG > .grd-children')?.children || [])].map(k => k.id));
const exists = (page, ids) => page.evaluate((ids) => Object.fromEntries(ids.map(i => [i, !!document.getElementById(i)])), ids);
/* ⒠ 키 직전 선택 목록 */
async function logSel(page, tag) {
  const s = await page.evaluate(() => [...document.querySelectorAll('#canvas .selected, #canvas .group-selected, #canvas .row-active, #canvas [contenteditable="true"]')]
    .map(e => `${e.id || '(no-id)'}.${[...e.classList].filter(c => /block|selected|row|active|editing/.test(c)).join('.')}${e.isContentEditable && e.getAttribute('contenteditable') === 'true' ? '[edit]' : ''}`));
  await page.evaluate(([t, s]) => console.log(`[E55 sel] ${t}: ${JSON.stringify(s)}`), [tag, s]);
  return s;
}
const blur = (page) => page.evaluate(() => document.activeElement?.blur?.());
const undo = async (page) => { await blur(page); await page.keyboard.press('Meta+z'); await page.waitForTimeout(400); };

for (const key of ['Delete', 'Backspace']) {
  test(`A-text-${key} ⒜ 글자 자식 클릭 → ${key} = 그 자식만 · 그리드·다른 자식 남음 · ⒟ ⌘Z 한 번 = 제자리`, async ({ page }) => {
    const errs = await setup(page);
    const s0 = await sig(page);
    const t = await rectOffPlus(page, '#tK1');   // E56 — 위 rectOffPlus 주석
    await page.mouse.click(t.x, t.y); await page.waitForTimeout(300);
    const sel = await logSel(page, `A-text-${key} 키 직전`);
    expect(sel.some(s => s.startsWith('tK1.') && s.includes('selected')), '전제 — 클릭이 글자 자식을 골랐다').toBe(true);
    expect(sel.some(s => s.includes('[edit]')), '전제 — 편집 상태가 아니다(블럭 선택)').toBe(false);
    await blur(page);
    await page.keyboard.press(key); await page.waitForTimeout(400);
    expect(await exists(page, ['rG', 'gG', 'kT2', 'kA', 'rT', 'fF']), '그리드·다른 자식·이웃은 남는다').toEqual({ rG: true, gG: true, kT2: true, kA: true, rT: true, fF: true });
    expect(await kids(page), '지운 것은 그 자식(글자래퍼째) 하나').toEqual(['kT2', 'kA']);
    await undo(page);
    expect(await sig(page), '⌘Z 한 번 = 지우기 전과 같다').toBe(s0);
    expect(errs).toEqual([]);
  });

  test(`A-asset-${key} ⒜ 에셋 자식 클릭 → ${key} = 그 자식만 · ⒟ ⌘Z 한 번`, async ({ page }) => {
    const errs = await setup(page);
    const s0 = await sig(page);
    const a = await rect(page, '#aK');
    await page.mouse.click(a.x, a.y); await page.waitForTimeout(300);
    const sel = await logSel(page, `A-asset-${key} 키 직전`);
    expect(sel.some(s => s.startsWith('aK.') && s.includes('selected')), '전제 — 클릭이 에셋 자식을 골랐다').toBe(true);
    await blur(page);
    await page.keyboard.press(key); await page.waitForTimeout(400);
    expect(await exists(page, ['rG', 'gG', 'kT1', 'kT2', 'rT', 'fF'])).toEqual({ rG: true, gG: true, kT1: true, kT2: true, rT: true, fF: true });
    expect(await kids(page)).toEqual(['kT1', 'kT2']);
    await undo(page);
    expect(await sig(page)).toBe(s0);
    expect(errs).toEqual([]);
  });
}

test('B ⒝ 그리드 고름 → Delete = 그리드+자식 통째(줄 rG째) · ⒟ ⌘Z 한 번', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await sig(page);
  const g = await rect(page, '#gG');
  await page.mouse.click(g.x, g.top + 2); await page.waitForTimeout(300);
  const sel = await logSel(page, 'B 키 직전');
  expect(sel.some(s => s.startsWith('gG.') && s.includes('selected')), '전제 — 그리드가 블럭으로 골라졌다').toBe(true);
  expect(sel.some(s => /^(tK|aK)/.test(s)), '전제 — 자식은 안 골라졌다').toBe(false);
  await blur(page);
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  expect(await exists(page, ['rG', 'gG', 'kT1', 'kT2', 'kA', 'rT', 'fF'])).toEqual({ rG: false, gG: false, kT1: false, kT2: false, kA: false, rT: true, fF: true });
  await undo(page);
  expect(await sig(page)).toBe(s0);
  expect(errs).toEqual([]);
});

test('C ⒞ 글자 자식 편집 중 ⌫ = 글자만(블럭·그리드 그대로) · ⒟ 편집 끝낸 뒤 ⌘Z 한 번 = 글자 복원', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await sig(page);
  const t = await rectOffPlus(page, '#tK1');   // E56 — 위 rectOffPlus 주석
  await page.mouse.dblclick(t.x, t.y); await page.waitForTimeout(300);
  const sel = await logSel(page, 'C 키 직전');
  expect(sel.some(s => s.includes('[edit]')), '전제 — 글자 편집 상태다').toBe(true);
  /* 더블클릭은 낱말을 통째 고른다 — 맥 크로미움에선 End 가 캐럿을 안 옮겨(실측 1회차: 낱말째 지워짐) → → 로 끝에 접는다 */
  await page.keyboard.press('ArrowRight'); await page.keyboard.press('Backspace'); await page.waitForTimeout(300);
  expect(await exists(page, ['rG', 'gG', 'kT1', 'tK1', 'kT2', 'kA'])).toEqual({ rG: true, gG: true, kT1: true, tK1: true, kT2: true, kA: true });
  expect(await kids(page)).toEqual(['kT1', 'kT2', 'kA']);
  expect((await page.evaluate(() => document.getElementById('tK1').textContent.trim())), '글자 한 자만 지워졌다').toBe('자식하');
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
  await undo(page);
  expect(await sig(page), '⌘Z 한 번 = 편집 전 글자').toBe(s0);
  expect(errs).toEqual([]);
});

/* ── 지키는 시험: 그릇 밖 보통 블럭의 삭제 단위는 종전 그대로 ── */
test('N1 지키는 — 그리드 밖 보통 글자 줄 클릭 → Delete = 그 줄(rT)째 · 그리드·자식 무관', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await sig(page);
  const t = await rect(page, '#tT');
  await page.mouse.click(t.x, t.y); await page.waitForTimeout(300);
  const sel = await logSel(page, 'N1 키 직전');
  expect(sel.some(s => s.startsWith('tT.') && s.includes('selected'))).toBe(true);
  await blur(page);
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  expect(await exists(page, ['rT', 'tT', 'rG', 'gG', 'kT1', 'kT2', 'kA', 'fF'])).toEqual({ rT: false, tT: false, rG: true, gG: true, kT1: true, kT2: true, kA: true, fF: true });
  await undo(page);
  expect(await sig(page)).toBe(s0);
  expect(errs).toEqual([]);
});

test('N2 지키는 — 프레임 안 에셋(자기 줄) 클릭 → Backspace = 그 줄(rF2)째 · 프레임·글자래퍼 남음', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await sig(page);
  /* 프레임 안 자식은 프레임을 먼저 고른 뒤(첫 클릭) 다시 눌러 고른다 — 실제 손 순서 */
  const a = await rect(page, '#aF2');
  await page.mouse.click(a.x, a.y); await page.waitForTimeout(300);
  let sel = await logSel(page, 'N2 첫 클릭 뒤');
  if (!sel.some(s => s.startsWith('aF2.'))) { await page.mouse.click(a.x, a.y); await page.waitForTimeout(300); sel = await logSel(page, 'N2 키 직전'); }
  expect(sel.some(s => s.startsWith('aF2.') && s.includes('selected')), '전제 — 프레임 안 에셋이 골라졌다').toBe(true);
  await blur(page);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(400);
  expect(await exists(page, ['rF2', 'aF2', 'fF', 'tfF', 'tF', 'rG', 'gG', 'kT1'])).toEqual({ rF2: false, aF2: false, fF: true, tfF: true, tF: true, rG: true, gG: true, kT1: true });
  await undo(page);
  expect(await sig(page)).toBe(s0);
  expect(errs).toEqual([]);
});

/* ── 명부(census) 측정: «자기 줄 없는 자식» 꼴 중 M1(모달 프레임화) 꼴 — 줄 안 스택 프레임 > 맨몸 글자래퍼.
   M1 판은 dev 에 없어 그 «꼴»을 손으로 심어 잰다(⚠️M1 코드 자체는 미측정). 지키는 규칙 = _frameBetween(블럭만 · 프레임·줄 남음). */
async function pickInFrame(page, q, tag) {
  const a = await rect(page, q);
  await page.mouse.click(a.x, a.y); await page.waitForTimeout(300);
  let sel = await logSel(page, `${tag} 첫 클릭 뒤`);
  const id = q.slice(1);
  if (!sel.some(s => s.startsWith(id + '.') && s.includes('selected'))) { await page.mouse.click(a.x, a.y); await page.waitForTimeout(300); sel = await logSel(page, `${tag} 키 직전`); }
  return sel;
}
test('M-sec 명부 — 줄(rM) 안 스택 프레임(M1 꼴)의 맨몸 글자 → Delete = 그 글자만 · 프레임·줄·다른 글자 남음 · ⌘Z 한 번', async ({ page }) => {
  const errs = await setup(page);
  const s0 = await sig(page);
  const sel = await pickInFrame(page, '#mSt1', 'M-sec');
  expect(sel.some(s => s.startsWith('mSt1.') && s.includes('selected')), '전제 — 프레임 안 글자가 골라졌다').toBe(true);
  await blur(page);
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
  expect(await exists(page, ['mSt1', 'mST2', 'mSt2', 'mS', 'rM', 'rG', 'gG'])).toEqual({ mSt1: false, mST2: true, mSt2: true, mS: true, rM: true, rG: true, gG: true });
  await undo(page);
  expect(await sig(page)).toBe(s0);
  expect(errs).toEqual([]);
});
test('M-grid 명부 — 그리드 그릇 안 스택 프레임(M1 꼴 D) 의 맨몸 글자 → Backspace = 그 글자만 · 프레임·그리드 남음 · ⌘Z 한 번', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    const box = document.querySelector('#gG > .grd-children');
    box.insertAdjacentHTML('beforeend', '<div class="frame-block" id="mG" data-full-width="true" style="background:#efe;width:100%;box-sizing:border-box;padding:20px"><div class="frame-block" data-text-frame="true" id="mGT1"><div class="text-block" data-type="body" id="mGt1"><div class="tb-body">그릇모달 하나</div></div></div><div class="frame-block" data-text-frame="true" id="mGT2"><div class="text-block" data-type="body" id="mGt2"><div class="tb-body">그릇모달 둘</div></div></div></div>');
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
  });
  await page.waitForTimeout(300);
  expect(await kids(page), '전제 — 넷째 자식(프레임) 심김').toEqual(['kT1', 'kT2', 'kA', 'mG']);
  const s0 = await sig(page);
  /* ⚠️진짜 클릭으로는 못 고른다(실측 1회차: 두 번 눌러도 선택 0 — dev 엔 그릇 안 프레임을 넣는 길이 없어 클릭 처리기가 이 꼴을 모른다).
     ⇒ M-sec 실측 선택 꼴(프레임 + 글자 .selected)을 그대로 «심어서» 키만 진짜로 누른다 — 삭제 갈래만 잰다(선택 길은 미측정). */
  await page.evaluate(() => { document.getElementById('mG').classList.add('selected'); document.getElementById('mGt1').classList.add('selected'); });
  const sel = await logSel(page, 'M-grid 키 직전(선택 심음)');
  expect(sel.some(s => s.startsWith('mGt1.') && s.includes('selected'))).toBe(true);
  await blur(page);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(400);
  expect(await exists(page, ['mGt1', 'mGT2', 'mG', 'rG', 'gG', 'kT1'])).toEqual({ mGt1: false, mGT2: true, mG: true, rG: true, gG: true, kT1: true });
  expect(await kids(page)).toEqual(['kT1', 'kT2', 'kA', 'mG']);
  await undo(page);
  expect(await sig(page)).toBe(s0);
  expect(errs).toEqual([]);
});

/* ── 에셋 자식의 ⒞ — 에셋엔 «글자 편집»이 없다. 짝은 「이미지 편집(더블클릭) 중 ⌫ = 이미지만 비움」(deleteSelectedFromCanvas 맨 앞 갈래). */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
test('A-asset-C ⒞ 에셋 자식 이미지 편집 중 ⌫ = 이미지만(블럭·그리드 그대로) · ⒟ ⌘Z 한 번 = 이미지 복원', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate((src) => {
    const ab = document.getElementById('aK');
    ab.classList.add('has-image'); ab.dataset.imgSrc = src; ab.style.minHeight = '120px';
    ab.insertAdjacentHTML('afterbegin', `<img class="asset-img" src="${src}" style="width:100%;height:120px;object-fit:cover">`);
    window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
  }, PNG);
  await page.waitForTimeout(300);
  const s0 = await sig(page);
  const a = await rect(page, '#aK');
  await page.mouse.click(a.x, a.y); await page.waitForTimeout(300);
  await page.mouse.dblclick(a.x, a.y); await page.waitForTimeout(400);
  const sel = await logSel(page, 'A-asset-C 키 직전');
  expect(await page.evaluate(() => document.getElementById('aK').classList.contains('img-editing')), '전제 — 이미지 편집 상태').toBe(true);
  await page.keyboard.press('Backspace'); await page.waitForTimeout(400);
  expect(await exists(page, ['aK', 'kA', 'rG', 'gG', 'kT1', 'kT2'])).toEqual({ aK: true, kA: true, rG: true, gG: true, kT1: true, kT2: true });
  expect(await page.evaluate(() => ({ img: !!document.querySelector('#aK .asset-img'), has: document.getElementById('aK').classList.contains('has-image') })), '이미지만 비었다').toEqual({ img: false, has: false });
  await undo(page);
  expect(await page.evaluate(() => ({ img: !!document.querySelector('#aK .asset-img'), has: document.getElementById('aK').classList.contains('has-image') })), '⌘Z 한 번 = 이미지 복원').toEqual({ img: true, has: true });
  expect(await sig(page)).toBe(s0);
  expect(errs).toEqual([]);
});
