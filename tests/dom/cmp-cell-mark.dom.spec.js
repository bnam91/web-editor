/* cmp-cell-mark.dom.spec.js — 1017t1c3 비교(comparison) «어느 칸을 골랐는지 모른다» — 글자 칸 선택 표시. (2026-10-18)
 *
 * ★현빈 원문: 「줄추가 드랍다운이 있긴 한데 어떤 칸(셀)을 선택했는지 알 수가 없어서 어디에 줄이 추가되는지
 *   추가한 이후에 알게 되는 문제」
 * ★뿌리(실측): js/blocks/line-host.js lnMark 가 addr.li===null(= 줄 없는 «칸» 모드)에서 조기 return 해 0픽셀.
 *   그리드 짝(js/props/prop-grid.js grd-cell-selected)은 같은 계약(host.mark)을 «칸을 칠한다」로 구현한다.
 * ★고침: lnMark 에 칸 모드 분기를 더하고(host.cellMark 가 참인 주인만 — 기본안 = 비교만), 새 공용 클래스
 *   ln-cell-selected(.cmp-cell-selected 재사용 금지 — 음성대조 참고). lnAugmentCmpPanel 의 Esc 잔류도 고침.
 * ⛔고정 대기 0 — waitForFunction / expect.poll 로.
 *
 * 음성대조(공용 본문 무력화 — 「공용 본문 무력화 → 소비자 수만큼 빨강」):
 *   · js/blocks/line-host.js lnMark 의 `addr.li === null` 칸 분기(M1)를 지우면 → 이 파일 C1·C2·C3 빨강 · N* 는 그대로 초록
 *     (= 이 자는 «그림»만 잰다 — 다른 주인·다른 검사에는 안 닿는다).
 *   · lnMark 머리의 기존 걷기(`_LN_SEL_CLASSES` 순회, M2)를 지우면 → line-host 공용 본문이 죽어
 *     버블·챗·laurel·카드·비교의 여러 spec 이 «함께» 빨개진다(한 벌을 공유한다는 증거 — 숫자는 보고에 적는다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-cell-mark
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const SEC = '<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';
/* 칼럼0(muted): [글자 a0, 글자 a1, 줄 있는 글자(x0,x1)] · 칼럼1(강조): [이미지, 글자 b1, 글자 b2] */
const MAKE = `window.addComparisonBlock({ cols: [
  { title: 'A', rows: [{type:'text',text:'a0'},{type:'text',text:'a1'},{type:'text',text:'a2',lines:[{type:'body',text:'x0'},{type:'body',text:'x1'}]}] },
  { title: 'B', rows: [{type:'image',text:'',imgSrc:'${PX}',imgFit:'cover'},{type:'text',text:'b1'},{type:'text',text:'b2'}] }], featured: 1 });`;

const cellSel = (c, r) => `#sB .comparison-block .cmp-row[data-col-idx="${c}"][data-row-idx="${r}"]`;
const lineSel = (c, r, li) => `${cellSel(c, r)} > .ln-row[data-ln="${li}"]`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(([mk, sec]) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    window.rebindAll?.(); window.applyZoom?.(100);
    window.deselectAll?.(); window.selectSection(document.getElementById('sB'));
    (0, eval)(mk);
    window.__blk = [...document.querySelectorAll('#sB .comparison-block')].pop();
    window.__bid = window.__blk?.id;
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [MAKE, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected && !window.__blk.classList.contains('selected'), null, { timeout: 5000 });
  return errs;
}
const blk = 'document.getElementById(window.__bid)';
const count = (page, sel) => page.evaluate((s) => document.querySelectorAll(s).length, sel);

/* 요소 가운데(멈춘 뒤) + «누르는 점이 그 요소 위»라는 전제 단언 */
async function at(page, sel) {
  const rc = await waitStableRect(page, sel);
  const hit = await page.evaluate(([x, y, s]) => {
    const e = document.elementFromPoint(x, y); const want = document.querySelector(s);
    return !!(e && want && (e === want || want.contains(e)));
  }, [rc.cx, rc.cy, sel]);
  expect(hit, `전제 — (${rc.cx},${rc.cy}) 가 ${sel} 위다`).toBe(true);
  return rc;
}
/* 블럭 고르기(클릭1) → 그 칸 고르기(클릭2) */
async function pickCell(page, c, r) {
  const p = await at(page, cellSel(c, r));
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  await page.mouse.click(p.cx, p.cy);
  await page.waitForFunction(() => !!document.getElementById('grd-line-add-kind') || document.querySelectorAll('.cmp-cell-selected').length > 0, null, { timeout: 3000 });
}
/* 블럭이 이미 선택+단독이면 클릭 한 번으로 칸이 바뀐다(그리드 2단 선택 규칙) */
async function clickCell(page, c, r) {
  const p = await at(page, cellSel(c, r));
  await page.mouse.click(p.cx, p.cy);
}

test('전제 — 클릭 전 ln-cell-selected 0 · 블럭 미선택', async ({ page }) => {
  const errs = await setup(page);
  expect(await count(page, '.ln-cell-selected'), '클릭 전 표식 0').toBe(0);
  expect(await page.evaluate(() => document.getElementById(window.__bid).classList.contains('selected')), '미선택').toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('C1 글자 칸(0,1) 고름 → 활성 {r:1,c:0,li:null} · ln-cell-selected 1 · dataset 일치 · box-shadow inset+sel-color', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await page.evaluate(`window.grdGetActiveLine(${blk})`), '활성 = 그 칸(줄 없음)').toEqual({ r: 1, c: 0, li: null });
  expect(await count(page, '.ln-cell-selected'), '표식 1').toBe(1);
  const marked = await page.evaluate(() => { const e = document.querySelector('.ln-cell-selected'); return [e.dataset.colIdx, e.dataset.rowIdx]; });
  expect(marked, '표식이 «누른 그 칸»에 있다').toEqual(['0', '1']);
  const sh = await page.evaluate(() => getComputedStyle(document.querySelector('.ln-cell-selected')).boxShadow);
  const selColor = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--sel-color').trim());
  expect(sh, 'box-shadow = inset').toContain('inset');
  if (selColor) {
    const rgbMatch = await page.evaluate((c) => {
      const d = document.createElement('div'); d.style.color = c; document.body.appendChild(d);
      const rgb = getComputedStyle(d).color; d.remove(); return rgb;
    }, selColor);
    expect(sh, 'box-shadow 색 = --sel-color').toContain(rgbMatch);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('C2 다른 칸(0,0)으로 옮김 → ln-cell-selected 여전히 1 · 새 칸에 있다(누적 안 됨)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '.ln-cell-selected'), '전제 — 1').toBe(1);
  await clickCell(page, 0, 0);
  await page.waitForFunction(() => {
    const a = window.grdGetActiveLine(document.getElementById(window.__bid));
    return !!a && a.r === 0 && a.c === 0 && a.li === null;
  }, null, { timeout: 3000 });
  expect(await count(page, '.ln-cell-selected'), '여전히 1(누적 안 됨)').toBe(1);
  const marked = await page.evaluate(() => { const e = document.querySelector('.ln-cell-selected'); return [e.dataset.colIdx, e.dataset.rowIdx]; });
  expect(marked, '표식이 새 칸으로 옮겨졌다').toEqual(['0', '0']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('C3 renderComparison 뒤에도 표식 1(lnRemark 되붙임)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '.ln-cell-selected'), '전제 — 1').toBe(1);
  await page.evaluate(`window.renderComparison(${blk})`);
  expect(await count(page, '.ln-cell-selected'), '재렌더 뒤에도 1').toBe(1);
  const marked = await page.evaluate(() => { const e = document.querySelector('.ln-cell-selected'); return [e.dataset.colIdx, e.dataset.rowIdx]; });
  expect(marked, '재렌더 뒤 그 칸 그대로').toEqual(['0', '1']);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N1 이미지 칸(1,0) 2번째 클릭 → ln-cell-selected 0 · cmp-cell-selected 1(두 표식이 안 섞인다)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 1, 0);
  expect(await count(page, '.ln-cell-selected'), '이미지 칸은 ln-cell-selected 0').toBe(0);
  expect(await count(page, '.cmp-cell-selected'), '이미지 칸은 cmp-cell-selected 1').toBe(1);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N2 Esc(실키) → ln-cell-selected 0 (lnAugmentCmpPanel 잔류 방지)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '.ln-cell-selected'), '전제 — 1').toBe(1);
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !window.grdGetActiveLine(document.getElementById(window.__bid)), null, { timeout: 3000 });
  expect(await count(page, '.ln-cell-selected'), 'Esc 뒤 0').toBe(0);
  expect(await page.evaluate(() => document.getElementById(window.__bid).classList.contains('selected')), 'Esc 뒤 블럭 선택은 유지').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N3 다른 블럭 클릭(블럭 떠남) → ln-cell-selected 0', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '.ln-cell-selected'), '전제 — 1').toBe(1);
  await page.evaluate(() => { window.deselectAll?.(); });
  expect(await count(page, '.ln-cell-selected'), '블럭을 떠나면 0').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

/** 내보낸 단독 HTML 문자열을 가로챈다(다운로드는 막는다). grid-cell-selected-leak.dom.spec.js L1 의 grabExport 와 같은 꼴. */
const grabExport = (page) => page.evaluate(async () => {
  const OrigBlob = window.Blob;
  const origClick = HTMLAnchorElement.prototype.click;
  let body = null;
  HTMLAnchorElement.prototype.click = function () {};
  window.Blob = function (parts, o) { body = (parts || []).join(''); return new OrigBlob(parts, o); };
  try { await window.exportHTMLFile(); } catch (e) { body = 'THREW:' + (e && e.message); }
  window.Blob = OrigBlob;
  HTMLAnchorElement.prototype.click = origClick;
  return body;
});

test('L1 배송본 — 칸 고른 채 단독HTML 내보내기에 ln-cell-selected·cmp-cell-selected 0건(음성대조 포함)', async ({ page }) => {
  const errs = await setup(page);
  await pickCell(page, 0, 1);
  expect(await count(page, '.ln-cell-selected'), '전제 — 캔버스엔 표식 1').toBe(1);
  const body = await grabExport(page);
  expect(body, 'exportHTMLFile 가 던지지 않았다').not.toMatch(/^THREW:/);
  const C = (s, re) => (String(s).match(re) || []).length;
  expect(C(body, /ln-cell-selected/g), '단독HTML 에 ln-cell-selected 0').toBe(0);
  expect(C(body, /cmp-cell-selected/g), '단독HTML 에 cmp-cell-selected 0(기존에도 빠져 있던 자리)').toBe(0);
  /* ★음성대조 — 선택을 풀면 «당연히» 0 이어야 한다. 둘이 같이 0 이면 자가 항등식이다. */
  await page.evaluate(() => window.deselectAll?.());
  const body2 = await grabExport(page);
  expect(C(body2, /ln-cell-selected/g), '음성대조 — 선택 없어도 0').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('N4 줄이 있는 칸(0,2)의 «줄»을 고르면 ln-line-selected 1 + ln-cell-selected 0(줄 모드·칸 모드 안 겹침)', async ({ page }) => {
  const errs = await setup(page);
  /* 클릭1 — 블럭만 고른다(어디를 눌러도 무방, lnClickAddr 가 wasSole=false 로 null 을 돌린다) */
  const p1 = await at(page, cellSel(0, 2));
  await page.mouse.click(p1.cx, p1.cy);
  await page.waitForFunction(() => document.getElementById(window.__bid).classList.contains('selected'), null, { timeout: 3000 });
  /* 클릭2 — «그 줄» 요소를 정확히 누른다(칸 가운데는 두 줄 경계에 걸릴 수 있어 ⛔쓰지 않는다) */
  const p2 = await at(page, lineSel(0, 2, 0));
  await page.mouse.click(p2.cx, p2.cy);
  await page.waitForFunction(() => {
    const a = window.grdGetActiveLine(document.getElementById(window.__bid));
    return !!a && Number.isInteger(a.li);
  }, null, { timeout: 3000 });
  const act = await page.evaluate(`window.grdGetActiveLine(${blk})`);
  expect(act, '줄이 있는 칸의 두 번째 클릭 = 그 줄 선택').toEqual({ r: 2, c: 0, li: 0 });
  expect(await count(page, '.ln-line-selected'), '줄 표식 1').toBe(1);
  expect(await count(page, '.ln-cell-selected'), '칸 표식 0(줄 모드와 안 겹침)').toBe(0);
  expect(errs, errs.join('\n')).toEqual([]);
});
