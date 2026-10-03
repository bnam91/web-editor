/* text-tone-dark-bg.dom.spec.js — G5·G6 (현빈 2026-10-03, TASK-20261003-goditor-32 ③)
 *   G5 「어두운 배경을 가진 섹션에 그리드 블럭 추가하면 안 보임, 텍스트 동적으로 되면 좋겠음」
 *   G6 「테이블 헤더가 어두워지면 텍스트도 자동으로 밝아지게」(수지맥 tbl_84a7j_7vu4onh — 헤더 #595959 · 글자 #222222)
 *
 * 재는 것 — «결과»로 잰다(computed color 의 WCAG 대비 · 내보낸 픽셀 · 따로 띄운 HTML 의 computed).
 *   T1 어두운 섹션 4종 × 역할 6종 → 대비 ≥4.5(보통) / ≥3.0(큰 글자: 24px 이상, 또는 굵기 700 이상이면서 18.66px 이상)
 *   T2 흰 섹션 = 역할색 그대로(대조) · 사용자 색은 어두운 섹션에서도 그대로
 *   T3 배경을 밝게 되돌리면 글자도 돌아온다(관찰자) · data-cols 는 한 글자도 안 바뀐다
 *   T4 G6 헤더 — 어두운 헤더 + 기본 글자색 → 밝게 · 사용자 글자색은 그대로 · 헤더를 밝히면 돌아온다
 *   T5 내보내기 PNG(제품 캡처 클론) 픽셀에 그 밝은 글자색이 있다
 *   T6 단독 HTML(제품 CSS 수확 collectCanvasCss) 을 따로 띄워도 같은 색
 *   T7 저장 왕복(serializeCleanRoot) — 자동 값이 dataset 에 «안» 굳고, 다시 열어 밝은 배경이면 기본색
 *   T8(앱 통째) ⌘Z — 배경 바꾸기를 되돌리면 글자도 돌아온다
 * ⛔대비 계산은 canvas-contrast.js 를 import 하지 않는다 — 같은 걸 쓰면 계산기의 버그가 시험을 통과해 «세탁»된다(그 파일 머리말 규약).
 * 양성대조: GD1001_ROOT=<604602cd 체크아웃> 로 돌리면 고치기 전 판을 잰다(_root-harness).
 */
const { test, expect } = require('@playwright/test');
const { boot, bootApp } = require('./_root-harness.js');

const lin = (c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4));
const L = ([r, g, b]) => 0.2126 * lin(r / 255) + 0.7152 * lin(g / 255) + 0.0722 * lin(b / 255);
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => { const m = /rgba?\((\d+),\s*(\d+),\s*(\d+)/.exec(s); return m ? [+m[1], +m[2], +m[3]] : null; };
const hex = (h) => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));

/* 수지맥 tbl_84a7j_7vu4onh «원문 꼴» (원격 읽기, 지디 전달) — 손으로 지어내지 않았다. */
const SUJI_TABLE = `<div class="row" data-layout="stack"><div class="table-block" data-type="table" id="tblS" data-style="default" data-show-header="true" data-cell-align="center" data-show-v-lines="true" data-show-h-lines="true" data-show-outer-x="false" data-show-outer-y="true" data-outer-width="1" data-row-h="60" data-table-pad-x="0" data-line-color="#888888" data-header-bg="#595959" data-text-color="#222222" data-font-family="'Pretendard', sans-serif" style="--tbl-outer-w: 1px; --tbl-hline-w: 1px; --tbl-vline-w: 1px; --tbl-line-color: #888888; --tbl-header-bg: #595959; --tbl-text-color: #222222; --tbl-font-family: 'Pretendard', sans-serif;" data-col-widths="1.5:2:2" data-font-size="24">
<table class="tb-table" style="table-layout: fixed; font-size: 24px;"><colgroup><col style="width: 27.27%;"><col style="width: 36.36%;"><col style="width: 36.36%;"></colgroup>
<thead><tr style="height: 60px;"><th style="text-align:center">구분</th><th style="text-align: center;">교환 및 반품</th><th style="text-align: center;">A/S</th></tr></thead>
<tbody><tr style="height: 60px;"><td style="text-align:center">접수일 기준</td><td style="text-align: center;">수령일로부터 14일 이내</td><td style="text-align: center;">수령일로부터 14일 이후</td></tr></tbody></table></div></div>`;

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css"><link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-layout.css"><link rel="stylesheet" href="/css/editor-blocks.css">
<style>html,body{margin:0;padding:0;background:#fff}</style></head><body>
<div id="canvas"><div class="section-block" id="sec1" style="width:860px;background-color:#ffffff"><div class="section-inner" id="host"></div></div></div>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import '/js/globals.js';
  import '/js/canvas-contrast.js';
  import { makeGridBlock, renderGridBlock } from '/js/blocks/grid-block.js';
  const ex = await import('/js/io/export-image.js');
  const css = await import('/js/io/export-css-collect.js');
  window.__mk = makeGridBlock; window.__render = renderGridBlock;
  window.__prepare = ex.prepareCloneForCapture; window.__renderInClone = ex.renderComponentsInClone;
  window.__collectCss = css.collectCanvasCss;
  window.__ready = true;
</script></body></html>`;

const ROLES = ['label', 'h1', 'h2', 'h3', 'body', 'caption'];
/* 그리드 하나: 칸 6개, 칸마다 역할 하나(색 미지정) + 마지막 칸에 사용자 색 줄 */
async function plantGrid(page, secBg) {
  return page.evaluate(([roles, bg]) => {
    const sec = document.getElementById('sec1'); sec.style.backgroundColor = bg; sec.dataset.bg = bg;
    const host = document.getElementById('host'); host.innerHTML = '';
    /* ★칸은 최대 4열(MAX_COLS) — 역할 6종은 3열×2행으로 놓는다. */
    const { row, block } = window.__mk({ cols: [{ width: 1 }, { width: 1 }, { width: 1 }] });
    host.appendChild(row);
    const cellOf = (t, i) => ({ lines: i === roles.length - 1
      ? [{ type: t, text: 'R' + t }, { type: 'body', text: 'USER', color: '#123456' }]
      : [{ type: t, text: 'R' + t }] });
    const all = roles.map(cellOf);
    const r0 = window.updateGridBlock(block.id, { rows: [{ height: 'auto' }, { height: 'auto' }] });
    const r = window.updateGridBlock(block.id, { cells: [all.slice(0, 3), all.slice(3, 6)] });
    return { id: block.id, ok: !!(r0 && r0.ok && r && r.ok) };
  }, [ROLES, secBg]);
}
const readGrid = (page, id) => page.evaluate((gid) => {
  const b = document.getElementById(gid);
  return [...b.querySelectorAll('.grd-line')].map(l => { const cs = getComputedStyle(l);
    return { text: l.textContent, color: cs.color, size: parseFloat(cs.fontSize), weight: +cs.fontWeight }; });
}, id);
const isLarge = (l) => l.size >= 24 || (l.weight >= 700 && l.size >= 18.66);
const ROLE_COLOR = { label: '#555555', h1: '#111111', h2: '#1a1a1a', h3: '#333333', body: '#555555', caption: '#999999' };

test('T0 전제 — 톤 계산이 실렸고 관찰자가 #canvas 를 본다(없으면 아래 초록은 «안 잰 것»)', async ({ page }) => {
  const errs = await boot(page, HARNESS);
  const r = await page.evaluate(() => ({ tone: typeof window.__gdTextTone?.textToneAt, sec: getComputedStyle(document.getElementById('sec1')).backgroundColor }));
  expect(errs).toEqual([]);
  expect(r.tone).toBe('function');
  expect(r.sec).toBe('rgb(255, 255, 255)');
});

for (const bg of ['#000000', '#1a1a1a', '#333333', '#555555']) {
  test(`T1 G5 어두운 섹션 ${bg} — 색 미지정 역할 6종이 대비 기준을 넘는다`, async ({ page }) => {
    await boot(page, HARNESS);
    const g = await plantGrid(page, bg);
    expect(g.ok).toBe(true);
    const secBg = await page.evaluate(() => getComputedStyle(document.getElementById('sec1')).backgroundColor);
    expect(rgb(secBg), '전제 — 섹션이 정말 그 색이다').toEqual(hex(bg));
    const lines = (await readGrid(page, g.id)).filter(l => l.text.startsWith('R'));
    expect(lines.length).toBe(6);
    const bad = lines.map(l => ({ ...l, cr: +cr(rgb(l.color), hex(bg)).toFixed(2), need: isLarge(l) ? 3 : 4.5 })).filter(l => l.cr < l.need);
    expect(bad, JSON.stringify(bad)).toEqual([]);
  });
}

test('T2 흰 섹션 = 역할색 그대로(대조) · 사용자 색은 어두운 섹션에서도 그대로', async ({ page }) => {
  await boot(page, HARNESS);
  let g = await plantGrid(page, '#ffffff');
  const white = await readGrid(page, g.id);
  for (const t of ROLES) expect(rgb(white.find(l => l.text === 'R' + t).color), t).toEqual(hex(ROLE_COLOR[t]));
  g = await plantGrid(page, '#1a1a1a');
  const dark = await readGrid(page, g.id);
  expect(rgb(dark.find(l => l.text === 'USER').color)).toEqual(hex('#123456'));
  expect(rgb(dark.find(l => l.text === 'Rbody').color), '대조 — 같은 판에서 미지정 줄은 바뀌었다').not.toEqual(hex('#555555'));
});

test('T3 배경을 밝게 되돌리면 글자도 돌아온다 · data-cols 불변', async ({ page }) => {
  await boot(page, HARNESS);
  const g = await plantGrid(page, '#ffffff');
  const cols0 = await page.evaluate((id) => document.getElementById(id).dataset.cols + '|' + document.getElementById(id).dataset.cells, g.id);
  const setBg = (c) => page.evaluate((cc) => { const s = document.getElementById('sec1'); s.style.backgroundColor = cc; s.dataset.bg = cc; }, c);
  await setBg('#1a1a1a'); await page.waitForTimeout(50);
  const dark = await readGrid(page, g.id);
  expect(cr(rgb(dark.find(l => l.text === 'Rbody').color), hex('#1a1a1a'))).toBeGreaterThanOrEqual(4.5);
  await setBg('#ffffff'); await page.waitForTimeout(50);
  const back = await readGrid(page, g.id);
  expect(rgb(back.find(l => l.text === 'Rbody').color)).toEqual(hex('#555555'));
  expect(rgb(back.find(l => l.text === 'Rh1').color)).toEqual(hex('#111111'));
  const cols1 = await page.evaluate((id) => document.getElementById(id).dataset.cols + '|' + document.getElementById(id).dataset.cells, g.id);
  expect(cols1, '자동 색이 모델에 굳으면 안 된다').toBe(cols0);
});

test('T4 G6 수지맥 표 — 어두운 헤더 + 기본 글자색 → 밝게 · 사용자 색 보존 · 헤더를 밝히면 돌아온다', async ({ page }) => {
  await boot(page, HARNESS);
  await page.evaluate((h) => { document.getElementById('host').innerHTML = h; }, SUJI_TABLE);
  await page.waitForTimeout(50);
  const th = () => page.evaluate(() => { const t = document.querySelector('#tblS thead th'); const cs = getComputedStyle(t);
    return { color: cs.color, bg: cs.backgroundColor, td: getComputedStyle(document.querySelector('#tblS tbody td')).color, ds: document.getElementById('tblS').dataset.textColor }; });
  let r = await th();
  expect(rgb(r.bg), '전제 — 헤더 배경 #595959').toEqual(hex('#595959'));
  expect(cr(rgb(r.color), rgb(r.bg))).toBeGreaterThanOrEqual(4.5);
  expect(rgb(r.td), '본문(흰 배경)은 그대로').toEqual(hex('#222222'));
  expect(r.ds, 'dataset 은 안 바뀐다').toBe('#222222');
  // 사용자 글자색
  await page.evaluate(() => { const b = document.getElementById('tblS'); b.dataset.textColor = '#ff0000'; b.style.setProperty('--tbl-text-color', '#ff0000'); });
  await page.waitForTimeout(50);
  r = await th(); expect(rgb(r.color)).toEqual([255, 0, 0]);
  // 기본으로 되돌리고 헤더를 밝게
  await page.evaluate(() => { const b = document.getElementById('tblS'); b.dataset.textColor = '#222222'; b.style.setProperty('--tbl-text-color', '#222222');
    b.dataset.headerBg = '#f0f0f0'; b.style.setProperty('--tbl-header-bg', '#f0f0f0'); });
  await page.waitForTimeout(50);
  r = await th(); expect(rgb(r.color)).toEqual(hex('#222222'));
});

test('T5 내보내기 PNG — 캡처 클론 픽셀에 밝은 글자가 있다(그리드·헤더 둘 다 #f2f2f2 — 위·아래 자리로 가른다)', async ({ page }) => {
  await boot(page, HARNESS);
  await page.setViewportSize({ width: 1000, height: 900 });
  await page.evaluate(([tbl]) => {
    const sec = document.getElementById('sec1'); sec.style.backgroundColor = '#1a1a1a'; sec.dataset.bg = '#1a1a1a';
    const host = document.getElementById('host'); host.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1 }] }); host.appendChild(row);
    window.updateGridBlock(block.id, { cells: [[{ lines: [{ type: 'body', text: '가나다라마바사아자차카타파하 가나다라마바사', fontSize: 40 }] }]] });
    host.insertAdjacentHTML('beforeend', tbl);
  }, [SUJI_TABLE]);
  await page.waitForTimeout(80);
  await page.evaluate(async () => {
    const clone = await window.__prepare(document.getElementById('sec1'), 860, true);
    window.__renderInClone(clone); clone.id = '__clone'; clone.style.top = '0px'; clone.style.left = '0px';
    const base = clone.getBoundingClientRect(); const th = clone.querySelector('thead th').getBoundingClientRect();
    window.__split = Math.round(th.top - base.top);            // 이 y 위 = 그리드, 아래 = 표
  });
  const split = await page.evaluate(() => window.__split);
  const shot = await page.locator('#__clone').screenshot({ type: 'png' });
  const n = await page.evaluate(async ([b64, split]) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height; const x = cv.getContext('2d'); x.drawImage(img, 0, 0);
    const d = x.getImageData(0, 0, cv.width, cv.height).data; const near = (i, c) => Math.abs(d[i] - c) <= 3 && Math.abs(d[i + 1] - c) <= 3 && Math.abs(d[i + 2] - c) <= 3;
    let g = 0, h = 0; for (let i = 0; i < d.length; i += 4) { if (near(i, 0xf2)) { if ((i / 4 / cv.width) < split) g++; else h++; } } return { g, h };
  }, [shot.toString('base64'), split]);
  expect(split, '전제 — 표가 그리드 아래에 있다').toBeGreaterThan(20);
  expect(n.g, '그리드 밝은 글자 픽셀').toBeGreaterThan(200);
  expect(n.h, '헤더 밝은 글자 픽셀').toBeGreaterThan(50);
});

test('T6 단독 HTML — 수확한 CSS + 마크업을 따로 띄워도 같은 색', async ({ page, browser }) => {
  await boot(page, HARNESS);
  await page.evaluate(([tbl]) => {
    const sec = document.getElementById('sec1'); sec.style.backgroundColor = '#333333';
    const host = document.getElementById('host'); host.innerHTML = '';
    const { row, block } = window.__mk({ cols: [{ width: 1 }] }); host.appendChild(row);
    window.updateGridBlock(block.id, { cells: [[{ lines: [{ type: 'h2', text: 'HEAD' }] }]] });
    host.insertAdjacentHTML('beforeend', tbl);
  }, [SUJI_TABLE]);
  await page.waitForTimeout(80);
  const live = await page.evaluate(() => ({ g: getComputedStyle(document.querySelector('.grd-line')).color, th: getComputedStyle(document.querySelector('#tblS thead th')).color,
    html: `<!doctype html><html><head><style>${window.__collectCss(document.getElementById('canvas'))}</style></head><body><div id="canvas">${document.getElementById('canvas').innerHTML}</div></body></html>` }));
  const p2 = await browser.newPage();
  await p2.setContent(live.html);
  const out = await p2.evaluate(() => ({ g: getComputedStyle(document.querySelector('.grd-line')).color, th: getComputedStyle(document.querySelector('#tblS thead th')).color }));
  await p2.close();
  expect(rgb(live.th)).toEqual(hex('#f2f2f2'));
  expect(out).toEqual({ g: live.g, th: live.th });
});

test('T7 저장 왕복 — 자동 값은 dataset 에 안 굳고, 다시 연 뒤 밝은 배경이면 기본색', async ({ page }) => {
  await boot(page, HARNESS);
  const g = await plantGrid(page, '#000000');
  await page.evaluate((h) => document.getElementById('host').insertAdjacentHTML('beforeend', h), SUJI_TABLE);
  await page.waitForTimeout(50);
  const r = await page.evaluate((id) => {
    const canvas = document.getElementById('canvas'); const clone = canvas.cloneNode(true); window.serializeCleanRoot(clone);
    const saved = clone.innerHTML;
    const m = /data-cols="([^"]*)"/.exec(saved); const cols = m ? m[1] : '';
    canvas.innerHTML = saved;                                       // 다시 열기
    const b = document.getElementById(id); window.__render(b);       // save-load 가 하는 재렌더
    const reopened = getComputedStyle(b.querySelector('.grd-line')).color;
    const sec = document.getElementById('sec1'); sec.style.backgroundColor = '#ffffff';
    return { colsHasAuto: /f2f2f2|ffffff/i.test(cols.replace(/&quot;/g, '"')), tc: document.getElementById('tblS').dataset.textColor, reopened };
  }, g.id);
  await page.waitForTimeout(50);
  const after = await readGrid(page, g.id);
  const th = await page.evaluate(() => getComputedStyle(document.querySelector('#tblS thead th')).color);
  expect(r.colsHasAuto, '모델에 자동색이 들어갔다').toBe(false);
  expect(r.tc).toBe('#222222');
  expect(cr(rgb(r.reopened), [0, 0, 0])).toBeGreaterThanOrEqual(4.5);
  expect(rgb(after.find(l => l.text === 'Rbody').color)).toEqual(hex('#555555'));
  expect(cr(rgb(th), hex('#595959')), '헤더는 여전히 어둡다 — 밝은 글자 유지').toBeGreaterThanOrEqual(4.5);
});

test('T8 앱 통째 ⌘Z — 섹션을 어둡게 한 걸 되돌리면 그리드 글자도 돌아온다', async ({ page }) => {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  const pre = await page.evaluate(() => typeof window.__gdTextTone?.textToneAt);
  expect(pre, '전제 — 앱 부팅에 톤 계산이 실렸다').toBe('function');
  await page.evaluate(() => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sU" data-section="1" data-name="U" style="background-color:#ffffff"><div class="section-inner" id="hostU"></div></div>');
    const { row, block } = window.makeGridBlock ? window.makeGridBlock({}) : { row: null, block: null };
    if (row) document.getElementById('hostU').appendChild(row);
    window.rebindAll?.(); window.deselectAll?.();
    window.__gid = block && block.id;
    window.pushHistory?.('seed');
  });
  const gid = await page.evaluate(() => window.__gid);
  expect(gid, '전제 — 그리드를 심었다').toBeTruthy();
  await page.evaluate(() => { const s = document.getElementById('sU'); s.dataset.bg = '#1a1a1a'; s.style.backgroundColor = '#1a1a1a'; });
  await page.waitForTimeout(80);
  await page.evaluate(() => window.pushHistory?.('섹션 배경'));
  const dark = await page.evaluate((id) => getComputedStyle(document.querySelector(`#${id} .grd-line`)).color, gid);
  expect(cr(rgb(dark), hex('#1a1a1a'))).toBeGreaterThanOrEqual(4.5);
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(250);
  const back = await page.evaluate((id) => ({ c: getComputedStyle(document.querySelector(`#${id} .grd-line`)).color, bg: getComputedStyle(document.getElementById('sU')).backgroundColor }), gid);
  expect(rgb(back.bg), '전제 — ⌘Z 가 배경을 되돌렸다').toEqual([255, 255, 255]);
  expect(rgb(back.c)).toEqual(hex('#555555'));
  expect(errs.filter(e => !/ResizeObserver/.test(e))).toEqual([]);
});
