/* cmp-placeholder-hint.dom.spec.js — 비교(comparison) 블럭 빈 칸 ★시각 전용 안내. (1012t1 D5)
 *
 * 현빈: 「컴패리전 블럭을 추가하면 우측에 플레이스홀더가 안 보여 어디에 무엇을 입력해야 되는지 안 보인다.
 *        ‘내용을 입력하세요.’ 연회색 플레이스홀더에 보이게」
 * ★10-08 「제거」(cmp-placeholder-free)와 같이 선다: 안내는 «글자»가 아니라 :empty 일 때만 보이는 CSS ::before.
 *   모델(cols)·textContent·저장본에 안내 문구가 0 이어야 한다(P1·P5·P7).
 * ★waitForTimeout 금지 — waitForFunction / expect.poll.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js cmp-placeholder-hint
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC ='<div class="section-block" data-section="1" id="sB"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>';

async function setup(page, make) {
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
    window.buildLayerPanel?.(); window.deselectAll?.();
    window.__blk?.scrollIntoView({ block: 'center' });
  }, [make, SEC]);
  await page.waitForFunction(() => !!window.__blk && window.__blk.isConnected, null, { timeout: 5000 });
  return errs;
}
/* 전제 — 블럭이 섰고 행>0, 힌트 상수가 문자열. */
async function assertRuler(page) {
  const n = await page.evaluate(() => ({
    hd: window.__blk.querySelectorAll('.cmp-hd').length,
    rows: window.__blk.querySelectorAll('.cmp-row').length,
    row: window.CMP_ROW_HINT, hdHint: window.CMP_HD_HINT,
  }));
  expect(n.rows, `전제 — 행이 그려졌다 ${JSON.stringify(n)}`).toBeGreaterThan(0);
  expect(typeof n.row === 'string' && n.row.length > 0, `전제 — window.CMP_ROW_HINT ${JSON.stringify(n.row)}`).toBe(true);
  expect(typeof n.hdHint === 'string' && n.hdHint.length > 0, `전제 — window.CMP_HD_HINT ${JSON.stringify(n.hdHint)}`).toBe(true);
  return n;
}
/* ::before 의 content 를 «수»로 — 힌트면 JSON 따옴표 문자열, 없으면 'none'/'normal'. */
const befores = (page, sel) => page.evaluate((s) => [...window.__blk.querySelectorAll(s)].map(e => {
  const cs = getComputedStyle(e, '::before');
  return { content: cs.content, opacity: cs.opacity, color: cs.color, text: e.textContent, html: e.innerHTML };
}), sel);
const model = (page) => page.evaluate(() => window.getComparisonCols(window.__blk.dataset));
/* 안내 색 토큰(css/design-tokens.css) — 값은 «산 토큰»에서 읽는다(손으로 박지 않는다). 계산색(rgb) 꼴로 바꿔 돌려준다. */
const HINT_TOKEN = '--text-placeholder-canvas';
const tokenColor = (page) => page.evaluate((name) => {
  const raw = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  const probe = document.createElement('i'); probe.style.color = raw; document.body.appendChild(probe);
  const rgb = getComputedStyle(probe).color; probe.remove();
  return { raw, rgb };
}, HINT_TOKEN);
const NEW = 'window.addComparisonBlock({});';
const TWO = "window.addComparisonBlock({ cols: [{ title: 'A', rows: [{type:'text',text:'a'},{type:'image'}] }, { title: 'B', rows: [{type:'text',text:''},{type:'text',text:'b'}] }], featured: 1 });";

test('P1 새 블럭 빈 행 칸 전부 ‘내용을 입력하세요.’ 안내 · 글자·모델은 빈 채', async ({ page }) => {
  const errs = await setup(page, NEW);
  const h = await assertRuler(page);
  const rows = await befores(page, '.cmp-row');
  expect(rows.length).toBeGreaterThan(0);
  const tok = await tokenColor(page);
  expect(tok.raw.length > 0, `전제 — 토큰 ${HINT_TOKEN} 이 :root 에 정의됐다 ${JSON.stringify(tok)}`).toBe(true);
  for (const r of rows) {
    expect(r.content, `행 ::before — ${JSON.stringify(r)}`).toBe(JSON.stringify(h.row));
    expect(r.text, '안내는 글자가 아니다').toBe('');
    expect(r.color, `색 — 토큰 ${HINT_TOKEN}(${tok.raw}) (칼럼 색 상속 아님) ${r.color}`).toBe(tok.rgb);
  }
  const m = await model(page);
  expect(m.flatMap(c => c.rows.map(r => r.text)).every(t => t === ''), '모델 text 전부 빈 문자열').toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P2 빈 헤더 칸에도 ‘제목을 입력하세요’ 안내 · 오른쪽(강조) 칼럼 행도 같다', async ({ page }) => {
  const errs = await setup(page, NEW);
  const h = await assertRuler(page);
  const hd = await befores(page, '.cmp-hd');
  expect(hd.length).toBeGreaterThan(0);
  for (const x of hd) { expect(x.content, JSON.stringify(x)).toBe(JSON.stringify(h.hdHint)); expect(x.text).toBe(''); }
  const feat = await befores(page, '.cmp-feat .cmp-row');
  expect(feat.length, '전제 — 강조 칼럼 행이 있다').toBeGreaterThan(0);
  for (const x of feat) expect(x.content, JSON.stringify(x)).toBe(JSON.stringify(h.row));
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P3·P4 음성 — 글이 든 칸과 이미지 칸엔 안내가 없다', async ({ page }) => {
  const errs = await setup(page, TWO);
  await assertRuler(page);
  const res = await page.evaluate(() => [...window.__blk.querySelectorAll('.cmp-hd, .cmp-row')].map(e => ({
    img: e.classList.contains('cmp-img'), text: e.textContent, c: getComputedStyle(e, '::before').content })));
  const withText = res.filter(r => !r.img && r.text !== '');
  const imgs = res.filter(r => r.img);
  expect(withText.length, '전제 — 글 든 칸이 있다').toBeGreaterThan(0);
  expect(imgs.length, '전제 — 이미지 칸이 있다').toBeGreaterThan(0);
  for (const r of [...withText, ...imgs]) expect(['none', 'normal'], JSON.stringify(r)).toContain(r.c);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P5 입력하면 사라지고, 다 지우고 blur 하면 다시 보인다 (남은 <br> 정리)', async ({ page }) => {
  const errs = await setup(page, NEW);
  const h = await assertRuler(page);
  const cell = page.locator('#sB .comparison-block .cmp-row').first();
  const hint = JSON.stringify(h.row);
  const content = () => page.evaluate(() => getComputedStyle(window.__blk.querySelector('.cmp-row'), '::before').content);
  expect(await content(), '전제 — 처음엔 안내가 보인다').toBe(hint);
  await cell.dblclick();
  await page.keyboard.type('abc');
  await expect.poll(content, { message: '글을 쓰면 안내가 사라진다' }).not.toBe(hint);
  await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete');
  await page.waitForFunction(() => window.__blk.querySelector('.cmp-row').textContent === '');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(content, { message: '다 지우고 blur → 안내가 돌아온다' }).toBe(hint);
  const after = await page.evaluate(() => window.__blk.querySelector('.cmp-row').innerHTML);
  expect(after, '남은 <br> 이 걷혔다').toBe('');
  const m = await model(page);
  expect(m[0].rows[0].text, '모델도 빈 문자열(안내가 안 들어갔다)').toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P5b 헤더도 지우고 blur 하면 안내가 돌아온다', async ({ page }) => {
  const errs = await setup(page, TWO);
  const h = await assertRuler(page);
  const hd = page.locator('#sB .comparison-block .cmp-hd').first();
  await hd.dblclick();
  await page.keyboard.press('Meta+a'); await page.keyboard.press('Delete');
  await page.waitForFunction(() => window.__blk.querySelector('.cmp-hd').textContent === '');
  await page.evaluate(() => document.activeElement?.blur?.());
  await expect.poll(() => page.evaluate(() => getComputedStyle(window.__blk.querySelector('.cmp-hd'), '::before').content),
    { message: '헤더 안내 복귀' }).toBe(JSON.stringify(h.hdHint));
  expect(await page.evaluate(() => window.__blk.querySelector('.cmp-hd').innerHTML)).toBe('');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P6 #canvas 밖(내보내기 클론처럼)에선 안내가 없다', async ({ page }) => {
  const errs = await setup(page, NEW);
  await assertRuler(page);
  const r = await page.evaluate(() => {
    const clone = window.__blk.cloneNode(true);
    const host = document.createElement('div'); host.id = 'zz-export-host';
    host.style.cssText = 'position:absolute;left:0;top:0;width:800px;';
    document.body.appendChild(host); host.appendChild(clone);
    const out = [...clone.querySelectorAll('.cmp-row, .cmp-hd')].map(e => getComputedStyle(e, '::before').content);
    const inCanvas = !!clone.closest('#canvas');
    host.remove();
    return { out, inCanvas };
  });
  expect(r.inCanvas, '전제 — 클론이 #canvas 밖이다').toBe(false);
  expect(r.out.length, '전제 — 칸이 있다').toBeGreaterThan(0);
  for (const c of r.out) expect(['none', 'normal'], c).toContain(c);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P7 저장본(serializeProject)에 안내 문구가 0', async ({ page }) => {
  const errs = await setup(page, NEW);
  const h = await assertRuler(page);
  const s = await page.evaluate(() => {
    const p = window.serializeProject?.();
    return typeof p === 'string' ? p : JSON.stringify(p);
  });
  expect(s && s.length > 100, '전제 — 직렬화가 나왔다').toBe(true);
  expect(s.includes('comparison'), '전제 — 비교 블럭이 저장본에 있다').toBe(true);
  expect(s.includes(h.row), `저장본에 ${h.row} 가 있다`).toBe(false);
  expect(s.includes(h.hdHint), `저장본에 ${h.hdHint} 가 있다`).toBe(false);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P8 우측 패널 입력칸 placeholder 속성', async ({ page }) => {
  const errs = await setup(page, NEW);
  const h = await assertRuler(page);
  const r = await page.evaluate(() => { window.showComparisonProperties(window.__blk);
    return { rows: [...document.querySelectorAll('.cmp-row-input')].map(e => e.getAttribute('placeholder')),
             titles: [...document.querySelectorAll('.cmp-col-title')].map(e => e.getAttribute('placeholder')) }; });
  expect(r.rows.length, '전제 — 행 입력칸 8개').toBe(8);
  expect(r.rows.every(p => p === h.row), JSON.stringify(r.rows)).toBe(true);
  expect(r.titles.length).toBeGreaterThan(0);
  expect(r.titles.every(p => p === h.hdHint), JSON.stringify(r.titles)).toBe(true);
  expect(errs, errs.join('\n')).toEqual([]);
});

/* ── D5-d / D2-e — 안내 글 색(토큰)·굵기·흐림 + 두 칼럼 대비 2.5~4.5 · 그리드 쪽 무변 ── */
/* 같은 장면에 빈 그리드 줄을 하나 더 세운다(비교 블럭 아래). 반환: 안내를 읽을 요소. */
async function addEmptyGridLine(page) {
  await page.evaluate(() => {
    const { row, block } = window.makeGridBlock({ cols: [{ width: 1, lines: [{ type: 'body', text: '' }] }] });
    block.id = 'zzGrid';
    document.querySelector('#sB .section-inner').appendChild(row);
    window.rebindAll?.();
  });
  await page.waitForFunction(() => !!document.querySelector('#zzGrid .grd-line:empty'));
}
const measure = `(() => {
  const parse = (c) => { const m = c.match(/[\\d.]+/g).map(Number); return { r: m[0], g: m[1], b: m[2], a: m.length > 3 ? m[3] : 1 }; };
  const over = (f, b) => ({ r: f.r * f.a + b.r * (1 - f.a), g: f.g * f.a + b.g * (1 - f.a), b: f.b * f.a + b.b * (1 - f.a), a: 1 });
  const lum = (c) => { const k = [c.r, c.g, c.b].map(v => { v /= 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); }); return 0.2126 * k[0] + 0.7152 * k[1] + 0.0722 * k[2]; };
  const bgOf = (el) => { const chain = []; for (let e = el; e; e = e.parentElement) chain.push(e);
    let bg = { r: 255, g: 255, b: 255, a: 1 };
    for (const e of chain.reverse()) { const c = parse(getComputedStyle(e).backgroundColor); if (c.a > 0) bg = over(c, bg); }
    return bg; };
  return (el) => { const cs = getComputedStyle(el, '::before'); const bg = bgOf(el);
    const eff = over({ ...parse(cs.color), a: parse(cs.color).a * Number(cs.opacity) }, bg);
    const l1 = lum(eff), l2 = lum(bg);
    return { color: cs.color, weight: cs.fontWeight, opacity: cs.opacity, content: cs.content,
             ratio: (Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05) }; };
})()`;

test('P9 [D5-d] 두 칼럼 빈 행·빈 헤더·칸 안 빈 줄 안내 — 대비 2.5~4.5 · 두 칼럼 같은 색·굵기 · normal · 색 = 토큰', async ({ page }) => {
  const errs = await setup(page, NEW);
  await assertRuler(page);
  /* 칼럼마다 첫 행에 빈 줄 하나(칸 안 빈 줄 안내) — 나머지 행은 빈 칸(빈 행 안내)으로 남는다. */
  await page.evaluate(() => { const cols = window.getComparisonCols(window.__blk.dataset);
    for (const c of cols) { c.rows[0].lines = [{ type: 'body', text: '' }]; c.rows[0].text = ''; }
    window.__blk.dataset.cols = JSON.stringify(cols); window.renderComparison?.(window.__blk); });
  await page.waitForFunction(() => window.__blk.querySelectorAll('.cmp-row .ln-row > .grd-line:empty').length >= 2);
  const tok = await tokenColor(page);
  const r = await page.evaluate((src) => {
    const m = (0, eval)(src);
    const pick = (col) => {
      if (!col) return null;
      const one = (sel) => { const e = col.querySelector(sel); if (!e) return null;
        const x = m(e); x.bg = getComputedStyle(col).backgroundColor; return x; };
      return { row: one('.cmp-row:not(.cmp-img):empty'), hd: one('.cmp-hd:empty'), ln: one('.cmp-row .ln-row > .grd-line:empty') };
    };
    return { muted: pick(window.__blk.querySelector('.cmp-col:not(.cmp-feat)')), feat: pick(window.__blk.querySelector('.cmp-col.cmp-feat')) };
  }, measure);
  expect(tok.raw.length > 0, `전제 — 토큰 ${HINT_TOKEN} 정의 ${JSON.stringify(tok)}`).toBe(true);
  const KINDS = ['row', 'hd', 'ln'];
  for (const col of ['muted', 'feat']) for (const k of KINDS) {
    expect(r[col] && r[col][k], `전제 — ${col} 칼럼 ${k} 안내 요소가 있다 ${JSON.stringify(r[col])}`).toBeTruthy();
  }
  expect(r.muted.row.bg, `전제 — 회색 칼럼과 강조 칼럼 배경이 다르다 ${r.muted.row.bg} / ${r.feat.row.bg}`).not.toBe(r.feat.row.bg);
  const log = {};
  for (const col of ['muted', 'feat']) for (const k of KINDS) log[`${col}.${k}`] = Number(r[col][k].ratio.toFixed(3));
  log.bg = { muted: r.muted.row.bg, feat: r.feat.row.bg }; log.token = tok;
  test.info().annotations.push({ type: 'contrast', description: JSON.stringify(log) });
  console.log('P9 contrast', JSON.stringify(log));
  for (const col of ['muted', 'feat']) for (const k of KINDS) {
    const x = r[col][k];
    expect(x.ratio, `${col}.${k} 대비 ${x.ratio} ≥ 2.5`).toBeGreaterThanOrEqual(2.5);
    expect(x.ratio, `${col}.${k} 대비 ${x.ratio} ≤ 4.5 (본문처럼 보이면 안 된다)`).toBeLessThanOrEqual(4.5);
    expect(x.weight, `${col}.${k} font-weight normal`).toBe('400');
    expect(x.color, `${col}.${k} 색 = 토큰 ${HINT_TOKEN}(${tok.raw})`).toBe(tok.rgb);
    expect(x.opacity, `${col}.${k} opacity 로 흐리지 않는다`).toBe('1');
  }
  for (const k of KINDS) {
    expect([r.muted[k].color, r.muted[k].weight], `${k}: 회색 칼럼 = 강조 칼럼(색·굵기)`).toEqual([r.feat[k].color, r.feat[k].weight]);
  }
  expect(errs, errs.join('\n')).toEqual([]);
});

test('P10 [D2-e] 칸 안 빈 줄 안내 = 빈 칸 안내 문구(CMP_ROW_HINT) · 색·굵기·흐림 같음 · 색 = 토큰 · 그리드 문구·색 무변', async ({ page }) => {
  const errs = await setup(page, NEW);
  const h = await assertRuler(page);
  await addEmptyGridLine(page);
  await page.evaluate(() => { const cols = window.getComparisonCols(window.__blk.dataset);
    cols[0].rows[0].lines = [{ type: 'body', text: '' }]; cols[0].rows[0].text = '';
    window.__blk.dataset.cols = JSON.stringify(cols); window.renderComparison?.(window.__blk); });
  await page.waitForFunction(() => !!window.__blk.querySelector('.cmp-row .ln-row > .grd-line:empty'));
  const r = await page.evaluate((src) => {
    const m = (0, eval)(src);
    const ln = window.__blk.querySelector('.cmp-row .ln-row > .grd-line:empty');
    const cell = window.__blk.querySelector('.cmp-row:not(.cmp-img):empty');
    const grid = document.querySelector('#zzGrid .grd-line:empty');
    return { ln: m(ln), cell: cell && m(cell), grid: m(grid) };
  }, measure);
  expect(r.ln.content, '빈 줄 안내 = CMP_ROW_HINT').toBe(JSON.stringify(h.row));
  expect(r.cell && r.cell.content, '빈 칸 안내 = CMP_ROW_HINT').toBe(JSON.stringify(h.row));
  expect([r.ln.color, r.ln.weight, r.ln.opacity], '빈 줄 안내 색·굵기·흐림 = 빈 칸 안내').toEqual([r.cell.color, r.cell.weight, r.cell.opacity]);
  const tok = await tokenColor(page);
  expect(r.ln.color, `빈 줄 안내 색 = 토큰 ${HINT_TOKEN}(${tok.raw})`).toBe(tok.rgb);
  expect(r.grid.content, '그리드 빈 본문 줄 문구 무변(기준 9ce081f0 = 본문을 입력하세요)').toBe('"본문을 입력하세요"');
  expect(r.grid.color, '그리드 빈 줄 안내 색 무변(#ccc) — 컴패리전 토큰이 그리드로 새지 않았다').toBe('rgb(204, 204, 204)');
  expect(errs, errs.join('\n')).toEqual([]);
});
