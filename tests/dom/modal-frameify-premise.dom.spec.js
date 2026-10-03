/* modal-frameify-premise — M1 「프레임화 하기」 착수 «전» 전제 측정 P1~P7 (2026-10-04, M1 레인 · 설계 $S/reports/M1-DESIGN.md §6-1)
 * ★이 파일은 «지금 판(5015a2ab)이 어떤가»를 수로 남긴다 — 프레임화 코드를 «안» 부른다(그래서 pin 에서도 돈다).
 *   각 시험은 «값을 적고(console.log '[P#]')» 설계가 기대는 성질만 expect 로 잠근다. 깨지면 설계의 그 줄을 다시 정한다.
 * ⛔앱 무접촉 — bootApp(헤드리스 크로미움에 레포 파일만). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sP" data-section="1" data-name="P"><div class="section-hitzone"></div><div class="section-inner" id="innerP" style="padding-left: 32px; padding-right: 32px;">
<div class="gap-block" data-type="gap" id="gTop" style="height:40px"></div>
<div class="gap-block" data-type="gap" id="gEnd" style="height:200px"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1400 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    window.applyZoom?.(100);   // 수치를 캔버스 px 로 읽게 — bootApp 기본 배율은 40% 다(첫 판 P3·P4 가 화면 px 로 재서 빨갰다)
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); window.clearHistory?.();
  }, SEC);
  await page.waitForTimeout(300);
  return errs;
}
/** 섹션의 gTop 뒤에 모달 하나를 넣는다(makeModalBlock 의 row 째) — 돌려주는 것: 모달 id */
const putModal = (page, opts) => page.evaluate((o) => {
  const { row, block } = window.makeModalBlock(o);
  document.getElementById('gTop').after(row);
  window.renderModalBlock(block); window.bindBlock?.(block);
  return block.id;
}, opts);

test('P1 글꼴 — 기본 모달 글자 칸과 새 text-block(body) 의 computed font-family 가 같은가', async ({ page }) => {
  const errs = await setup(page);
  expect(errs, errs.join(' | ')).toEqual([]);
  const id = await putModal(page, { variant: 'plain', text: '가나다 abc' });
  const r = await page.evaluate((id) => {
    const slot = document.querySelector(`#${id} .tb-mdl-text`);
    const { block } = window.makeTextBlock('body');
    const tf = window._makeTextFrame(); tf.appendChild(block);
    document.getElementById('gEnd').before(tf);
    const ce = block.querySelector('.tb-body');
    return { modal: getComputedStyle(slot).fontFamily, text: getComputedStyle(ce).fontFamily,
             textInline: ce.style.fontFamily, modalWeight: getComputedStyle(slot).fontWeight, textWeight: getComputedStyle(ce).fontWeight,
             modalWB: getComputedStyle(slot).wordBreak + '/' + getComputedStyle(slot).overflowWrap, textWB: getComputedStyle(ce).wordBreak + '/' + getComputedStyle(ce).overflowWrap,
             modalWS: getComputedStyle(slot).whiteSpace };
  }, id);
  console.log('[P1]', JSON.stringify(r));
  expect(r.modal.length).toBeGreaterThan(0);   // 값은 로그로 — 같은지 여부가 설계 ⑮의 갈래를 정한다
});

for (const variant of ['plain', 'titled', 'icon', 'icon-stack', 'grid-2', 'dashed']) {
  test(`P2 복원 멱등 — ${variant}: 직렬화 → restoreSnapshot → 직렬화가 «글자 단위로» 같다`, async ({ page }) => {
    await setup(page);
    await putModal(page, { variant, title: '제목', text: '본문\n둘째 줄', cell1: '칸1', cell2: '칸2', dropShadow: 'soft', radius: 12, borderW: 2 });
    const r = await page.evaluate(() => {
      const a = window.getSerializedCanvas();
      window.restoreSnapshot({ canvas: a, settings: {}, selection: null });
      const b = window.getSerializedCanvas();
      let i = 0; while (i < a.length && a[i] === b[i]) i++;
      return { same: a === b, at: i, a: a.slice(Math.max(0, i - 60), i + 60), b: b.slice(Math.max(0, i - 60), i + 60) };
    });
    console.log(`[P2 ${variant}]`, r.same ? 'same' : JSON.stringify(r));
    expect(r.same, `★${variant} 복원이 비멱등 — ⌘Z 깊이(R1 줄기) 위험: ${r.a} ⟂ ${r.b}`).toBe(true);
  });
}

test('P3 fullWidth 프레임 + 인라인 min-height:0 — 높이 = 내용(작은 글자 한 줄) · 인라인이 없으면 60px 로 «커진다»', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const mk = (minH) => {
      const f = window.makeFrameBlock({ fullWidth: true, bg: '#eeeeee' });
      if (minH !== null) f.style.minHeight = minH;
      const { block } = window.makeTextBlock('body'); const tf = window._makeTextFrame();
      const ce = block.querySelector('.tb-body'); ce.textContent = 'x'; ce.style.fontSize = '12px'; ce.style.lineHeight = '1.2'; delete ce.dataset.isPlaceholder;
      tf.appendChild(block); f.appendChild(tf); document.getElementById('gEnd').before(f);
      return { frame: f.getBoundingClientRect().height, kid: tf.getBoundingClientRect().height };
    };
    return { withZero: mk('0px'), without: mk(null) };
  });
  console.log('[P3]', JSON.stringify(r));
  expect(Math.abs(r.withZero.frame - r.withZero.kid), '★min-height:0 이 CSS 60px 를 못 눌렀다').toBeLessThan(0.01);
  expect(r.without.frame, '전제 — 인라인이 없으면 60 으로 커진다(누를 까닭이 실제로 있다)').toBeGreaterThanOrEqual(60);
});

test('P4 자리 — .row 로 싼 모달 자리에 section-inner 직속 프레임을 끼우면 같은 y·x·폭에 선다', async ({ page }) => {
  await setup(page);
  const id = await putModal(page, { variant: 'plain', text: '자리 재기' });
  const r = await page.evaluate((id) => {
    const m = document.getElementById(id); const row = m.parentElement;
    const a = m.getBoundingClientRect(); const nextTop = document.getElementById('gEnd').getBoundingClientRect().top;
    const f = window.makeFrameBlock({ fullWidth: true, bg: '#eeeeee' }); f.style.minHeight = '0px';
    const filler = document.createElement('div'); filler.style.height = a.height + 'px'; f.appendChild(filler);
    row.replaceWith(f);
    const b = f.getBoundingClientRect(); const nextTop2 = document.getElementById('gEnd').getBoundingClientRect().top;
    return { a: [a.left, a.top, a.width, a.height], b: [b.left, b.top, b.width, b.height], nextTop, nextTop2, rowStyle: row.getAttribute('style') };
  }, id);
  console.log('[P4]', JSON.stringify(r));
  expect(r.b).toEqual(r.a);
  expect(r.nextTop2).toBe(r.nextTop);
});

test('P5 자유배치 프레임 안 absolute fullWidth 프레임 — 클릭 선택 · 직렬화 왕복 · 레이어 등록', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const free = window.makeFrameBlock({ bg: '#f0f0f0' });   // freeLayout 기본
    free.id = 'freeP'; document.getElementById('gEnd').before(free); window.bindFrameDropZone(free);
    const f = window.makeFrameBlock({ fullWidth: true, bg: '#ddeeff' }); f.id = 'fwP';
    f.style.position = 'absolute'; f.style.left = '40px'; f.style.top = '60px'; f.style.width = '400px'; f.dataset.offsetX = '40'; f.dataset.offsetY = '60'; f.style.minHeight = '0px';
    const { block } = window.makeTextBlock('body'); const tf = window._makeTextFrame(); tf.appendChild(block); f.appendChild(tf);
    free.appendChild(f); window.bindFrameDropZone(f); window.bindBlock(block); window.buildLayerPanel?.();
    const before = f.getBoundingClientRect();
    const ser = window.getSerializedCanvas();
    window.restoreSnapshot({ canvas: ser, settings: {}, selection: null });
    const f2 = document.getElementById('fwP');
    const after = f2?.getBoundingClientRect();
    return { kept: !!f2, parentFree: f2?.parentElement?.id, before: [before.left, before.top, before.width], after: after && [after.left, after.top, after.width],
             layer: !!document.querySelector('#layer-panel [data-id="fwP"], #layer-tree [data-block-id="fwP"]') || !!f2?._layerItem };
  });
  console.log('[P5 serialize]', JSON.stringify(r));
  // 클릭 선택: 프레임 안의 빈 곳(텍스트 밖)을 누른다
  const pt = await page.evaluate(() => { const f = document.getElementById('fwP'); f.scrollIntoView({ block: 'center' }); const b = f.getBoundingClientRect(); return [b.right - 6, b.top + 3]; });
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForTimeout(150);
  const sel = await page.evaluate(() => ({ fw: document.getElementById('fwP')?.classList.contains('selected'), free: document.getElementById('freeP')?.classList.contains('selected'), active: window._activeFrame?.id }));
  console.log('[P5 click]', JSON.stringify(sel));
  await page.mouse.click(pt[0], pt[1]);   // 두 번째 클릭 = 자유배치 자식으로 «들어가기»(다른 자유배치 자식과 같은 손짓인가)
  await page.waitForTimeout(150);
  const sel2 = await page.evaluate(() => ({ fw: document.getElementById('fwP')?.classList.contains('selected'), active: window._activeFrame?.id }));
  console.log('[P5 click2]', JSON.stringify(sel2));
  expect(r.kept).toBe(true);
  expect(r.after).toEqual(r.before);
});

test('P6 그리드 밑(.grd-children) fullWidth 프레임 — 그리드 재렌더를 견딘다', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const COLS = JSON.stringify([{ width: 1, lines: [{ type: 'body', text: '가' }] }, { width: 1, lines: [{ type: 'body', text: '나' }] }]);
    const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack';
    row.innerHTML = `<div class="grid-block" id="gP" data-type="grid" data-gap="24" data-valign="top"></div>`;
    row.firstChild.dataset.cols = COLS;
    document.getElementById('gEnd').before(row);
    const g = document.getElementById('gP'); window.renderGridBlock(g);
    window.addGridChild('gP', 'body');                       // 그릇을 만든다(정본 입구)
    const box = g.querySelector(':scope > .grd-children');
    const f = window.makeFrameBlock({ fullWidth: true, bg: '#ddeeff' }); f.id = 'fwG'; f.style.minHeight = '0px';
    const { block } = window.makeTextBlock('body'); const tf = window._makeTextFrame(); tf.appendChild(block); f.appendChild(tf);
    box.appendChild(f); window.bindFrameDropZone(f); window.bindBlock(block);
    window.renderGridBlock(g);
    const a = !!document.querySelector('#gP > .grd-children > #fwG');
    const ser = window.getSerializedCanvas(); window.restoreSnapshot({ canvas: ser, settings: {}, selection: null });
    return { afterRender: a, afterRestore: !!document.querySelector('#gP > .grd-children > #fwG'), boxApi: typeof window.ensureGridKidsBox };
  });
  console.log('[P6]', JSON.stringify(r));
  expect(r.afterRender).toBe(true);
  expect(r.afterRestore).toBe(true);
});

test('P7 목적 — fullWidth 프레임을 «클릭으로» 고른 뒤 addTextBlock(body) 는 그 프레임 «안»으로 간다', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => {
    const f = window.makeFrameBlock({ fullWidth: true, bg: '#ddeeff', padding: 20 }); f.id = 'fwT'; f.style.minHeight = '0px';
    const { block } = window.makeTextBlock('body'); block.id = 'tbT0'; const tf = window._makeTextFrame(); tf.appendChild(block); f.appendChild(tf);
    document.getElementById('gEnd').before(f); window.bindFrameDropZone(f); window.bindBlock(block); window.buildLayerPanel?.();
  });
  const pt = await page.evaluate(() => { const f = document.getElementById('fwT'); f.scrollIntoView({ block: 'center' }); const b = f.getBoundingClientRect(); return [b.right - 5, b.top + 5]; });
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForTimeout(150);
  const before = await page.evaluate(() => document.querySelectorAll('#fwT .text-block').length);
  await page.evaluate(() => window.addTextBlock('body'));
  const r = await page.evaluate(() => ({ active: window._activeFrame?.id, sel: document.getElementById('fwT').classList.contains('selected'), n: document.querySelectorAll('#fwT .text-block').length }));
  console.log('[P7]', JSON.stringify({ before, ...r }));
  expect(r.active).toBe('fwT');
  expect(r.n).toBe(before + 1);
});
