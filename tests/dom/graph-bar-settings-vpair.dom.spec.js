/* graph-bar-settings-vpair — 세로(bar-v)·비교(bar-pair) 막대에도 Bar Settings(B7, 2026-10-03 현빈 「세로 막대, 비교막대 그래프도 Bar Settings 기능이 있어야」)
 * ──────────────────────────────────────────────────────────────────────────────────────
 * 전: Bar Settings(두께·좌우 패딩·항목 간격·숫자 크기·바 색상)가 bar-h 에만 있었다. 후: bar-h·bar-v·bar-pair 가 «한 마크업»을 공유.
 *   · bar-pair 는 «바 색상» 줄을 뺀다(Pair Settings «색상 A» 가 이미 id grb-bar — 중복 id 금지).
 *   · renderGraph 는 dataset 키(itemGap·barThickness·padX·pctSize·bar-v barColor)가 «있을 때만» inline 으로 낸다 ⇒ 키 없으면 바이트 동일(B7-0).
 * 시험 이름 ↔ 잰 것
 *   B7-0 키 없으면 «고치기 전 판(36cbe872)이 낸 innerHTML» 과 바이트까지 같다 — 골든 fixtures/graph-vpair-pin-golden.json(핀에서 뽑음)
 *        ★E99 U26 ⒜(2026-10-05 지디): 두께 키가 없어도 막대 24px — 골든을 새 판에서 다시 뽑았다. 옛 골든과의 차이는 «추가뿐»
 *        (막대 `width:24px;max-width:100%;margin:0 auto;` · 칸 ` style="min-width:0;"`) — 판정기 tests/dom/_u26-delta.js 로 단언(손눈 대조 아님).
 *   B7-1 절·줄: «Bar Settings» 절 하나 · 줄 4(두께·좌우 패딩·항목 간격·숫자 크기) · 바 색상은 bar-v 에만 / pair 는 #grb-bar-color «하나»(Pair Settings 것)
 *   B7-2 computed — gap·padding·fill 폭·값 글자 크기가 입력대로 (세로·비교 둘)
 *   B7-3 저장 왕복 — 직렬화→복원 뒤에도 dataset·computed 유지
 *   B7-4 PNG 픽셀 — 제품 캡처 파이프라인을 지나 바 색 화소 수가 두께대로 는다(선례 grid-export-nested-depth2 exportPixels)
 *   B7-5 HTML 내보내기 경로(canvas clone) 에 inline 이 실린다
 *   B7-6 ⌘Z 한 걸음 = 바꾼 한 걸음만 되돌린다
 * 양성대조: GD1001_ROOT=<36cbe872 체크아웃> 으로 같은 시험을 돌려 «어느 시험이 빨강인가» 를 커밋 본문에 명부로 적는다.
 * ⛔못 재는 축: 실앱(Electron) · 슬라이더 «끌기» 제스처(여기선 number 입력 change 로 같은 코드 경로를 탄다). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp } = require('./_root-harness.js');

const GOLDEN = JSON.parse(fs.readFileSync(path.join(__dirname, 'fixtures', 'graph-vpair-pin-golden.json'), 'utf8'));
const ITEMS = [
  { label: '가', value: 40, value2: 30 },
  { label: '나', value: 80, value2: 60, color: '#ff0000' },
  { label: '다', value: 0, value2: 10 },
];
const TYPES = ['bar-v', 'bar-pair'];

/** 한 판: 섹션 하나 + 그래프 블럭. extra = 시작 dataset. */
async function setup(page, type, extra = {}, items = ITEMS) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(({ type, extra, items }) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="b7S" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;"></div></div>');
    const { row, block } = window.makeGraphBlock();
    block.id = 'b7g';
    block.dataset.chartType = type;
    block.dataset.items = JSON.stringify(items);
    for (const [k, v] of Object.entries(extra)) block.dataset[k] = v;
    document.querySelector('#b7S .section-inner').appendChild(row);
    window.renderGraph(block);
    window.rebindAll?.(); window.deselectAll?.();
  }, { type, extra, items });
  await page.waitForTimeout(250);
  await page.evaluate(() => { window.clearHistory?.(); });
  return errs;
}
const openPanel = (page) => page.evaluate(() => { window.showGraphProperties(document.getElementById('b7g')); });
/** 패널 number 칸에 값을 넣고 change — 실제 입력과 같은 핸들러(applyXxx + pushHistory)를 탄다. */
async function setNum(page, id, v) {
  await page.evaluate(([id, v]) => { const el = document.getElementById(id); el.value = String(v); el.dispatchEvent(new Event('change', { bubbles: true })); }, [id, v]);
}
const IDS = { thick: 'grb-bar-thickness-number', padx: 'grb-padx-number', gap: 'grb-item-gap-number', pct: 'grb-pct-size-number' };
const read = (page) => page.evaluate(() => {
  const b = document.getElementById('b7g');
  const bars = b.querySelector('.grb-bars-v'); const cs = getComputedStyle(bars);
  const fills = [...b.querySelectorAll('.grb-bar-fill')];
  return {
    ds: { vItemGap: b.dataset.vItemGap, vBarThickness: b.dataset.vBarThickness, vPadX: b.dataset.vPadX, vPctSize: b.dataset.vPctSize },
    gap: (() => { const c = bars.querySelectorAll('.grb-bar-col'); return (c[1].offsetLeft - c[0].offsetLeft - c[0].offsetWidth) + 'px'; })(), padL: cs.paddingLeft, padR: cs.paddingRight,
    fillW: fills.map(f => f.offsetWidth),   // offsetWidth = 배율 전 px(캔버스 줌이 getBoundingClientRect 를 줄인다)
    valPx: [...b.querySelectorAll('.grb-bar-val-label')].map(l => getComputedStyle(l).fontSize),
  };
});

for (const type of TYPES) {
  test(`B7-0 [${type}] 키가 없으면 innerHTML 이 핀(36cbe872)과 바이트까지 같다`, async ({ page }) => {
    const errs = await setup(page, type, { chartHeight: '300', labelSize: '18' });
    const got = await page.evaluate(() => document.getElementById('b7g').innerHTML);
    expect(got.length, '골든이 비었다').toBeGreaterThan(200);
    expect(got).toBe(GOLDEN[type]);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`B7-1 [${type}] 패널 — Bar Settings 절 하나·줄 넷, 바 색상은 ${type === 'bar-v' ? '있다' : '없다(#grb-bar-color 는 Pair Settings 의 하나뿐)'}`, async ({ page }) => {
    const errs = await setup(page, type);
    await openPanel(page);
    const r = await page.evaluate(() => {
      const titles = [...document.querySelectorAll('#panel-right .prop-section-title')].filter(t => t.textContent.trim() === 'Bar Settings');
      const sec = titles[0]?.closest('.prop-section');
      const labels = sec ? [...sec.querySelectorAll('.prop-label')].map(l => l.textContent.trim()) : [];
      return {
        n: titles.length, labels,
        colorInSec: sec ? sec.querySelectorAll('#grb-bar-color').length : -1,
        colorAll: document.querySelectorAll('#grb-bar-color').length,
        dupIds: [...document.querySelectorAll('#panel-right [id]')].map(e => e.id).filter((id, i, a) => a.indexOf(id) !== i),
        sliders: ['grb-bar-thickness-slider', 'grb-padx-slider', 'grb-item-gap-slider', 'grb-pct-size-slider'].map(id => !!document.getElementById(id)),
      };
    });
    expect(r.n, 'Bar Settings 절이 하나여야 한다').toBe(1);
    expect(r.labels.slice(0, 4)).toEqual(['두께', '좌우 패딩', '항목 간격', '숫자 크기']);
    expect(r.sliders).toEqual([true, true, true, true]);
    expect(r.dupIds, '중복 id').toEqual([]);
    expect(r.colorAll, '#grb-bar-color 는 패널 전체에서 하나').toBe(1);
    expect(r.colorInSec, type === 'bar-v' ? '세로: Bar Settings 안에 바 색상' : '비교: Bar Settings 안엔 바 색상 없음').toBe(type === 'bar-v' ? 1 : 0);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`B7-2 [${type}] computed — 항목 간격·좌우 패딩·바 폭·값 글자 크기가 입력대로`, async ({ page }) => {
    const errs = await setup(page, type);
    await openPanel(page);
    await setNum(page, IDS.gap, 40); await setNum(page, IDS.padx, 12); await setNum(page, IDS.thick, 20); await setNum(page, IDS.pct, 30);
    const r = await read(page);
    expect(r.ds, '키가 dataset 에 안 들어갔다 — 아래 숫자는 전부 헛것').toEqual({ vItemGap: '40', vBarThickness: '20', vPadX: '12', vPctSize: '30' });
    expect(r.gap).toBe('40px');
    expect([r.padL, r.padR]).toEqual(['12px', '12px']);
    expect(r.fillW.every(w => w === 20), `바 폭 ${JSON.stringify(r.fillW)}`).toBe(true);
    expect(r.valPx.every(f => f === '30px'), `값 글자 ${JSON.stringify(r.valPx)}`).toBe(true);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`B7-3 [${type}] 저장 왕복 — 직렬화→복원 뒤에도 같다`, async ({ page }) => {
    const errs = await setup(page, type, { vItemGap: '36', vBarThickness: '18', vPadX: '8', vPctSize: '26' });
    const before = await read(page);
    expect(before.gap).toBe('36px');
    await page.evaluate(() => { const a = window.getSerializedCanvas(); window.restoreSnapshot({ canvas: a, settings: {}, selection: null }); });
    await page.waitForTimeout(200);
    const after = await read(page);
    expect(after).toEqual(before);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`B7-4 [${type}] PNG 픽셀 — 바 두께 20→40 이면 바 색 화소가 늘어난다(제품 캡처 파이프라인)`, async ({ page }) => {
    const errs = await setup(page, type, { barColor: '#00aa00', barColor2: '#0000ff', vItemGap: '24' }, [
      { label: '가', value: 80, value2: 80, color: '#00aa00' }, { label: '나', value: 80, value2: 80, color: '#00aa00' }]);
    await openPanel(page);
    const count = async (w) => {
      await setNum(page, IDS.thick, w);
      return page.evaluate(async () => {
        const ex = await import('/js/io/export-image.js');
        document.getElementById('__b7clone')?.remove();
        const sec = document.getElementById('b7S');
        const clone = await ex.prepareCloneForCapture(sec, 860, true);
        ex.renderComponentsInClone(clone);
        clone.id = '__b7clone'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
        clone.getBoundingClientRect();
        return { w: clone.getBoundingClientRect().width, h: clone.getBoundingClientRect().height };
      }).then(async () => {
        const shot = await page.locator('#__b7clone').screenshot({ type: 'png' });
        return page.evaluate(async (b64) => {
          const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
          const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
          const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
          const d = ctx.getImageData(0, 0, cv.width, cv.height).data;
          let g = 0, bl = 0;
          for (let i = 0; i < d.length; i += 4) {
            if (Math.abs(d[i] - 0) < 12 && Math.abs(d[i + 1] - 170) < 12 && Math.abs(d[i + 2] - 0) < 12) g++;
            if (Math.abs(d[i]) < 12 && Math.abs(d[i + 1]) < 12 && Math.abs(d[i + 2] - 255) < 12) bl++;
          }
          return { g, bl };
        }, shot.toString('base64'));
      });
    };
    const a = await count(20);
    const b = await count(40);
    const key = type === 'bar-v' ? 'g' : 'bl';
    expect(a[key], '양성대조: 20px 판에 바 색이 «있다»(0 이면 아래 비는 헛것)').toBeGreaterThan(500);
    expect(b[key] / a[key], `두께 20→40 인데 화소 비 ${(b[key] / a[key]).toFixed(2)} (≈2 여야 한다) · ${JSON.stringify({ a, b })}`).toBeGreaterThan(1.7);
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`B7-5 [${type}] HTML 내보내기 경로 — canvas clone 에 inline 이 실린다`, async ({ page }) => {
    const errs = await setup(page, type, { vItemGap: '36', vBarThickness: '18', vPadX: '8', vPctSize: '26' });
    const r = await page.evaluate(() => {
      const clone = document.getElementById('canvas').cloneNode(true);
      const g = clone.querySelector('#b7g');
      return { bars: g.querySelector('.grb-bars-v').getAttribute('style'), fill: g.querySelector('.grb-bar-fill').getAttribute('style'), val: g.querySelector('.grb-bar-val-label').getAttribute('style') };
    });
    expect(r.bars).toContain('gap:min(36px'); expect(r.bars).toContain('padding:0 8px');
    expect(r.fill).toContain('width:18px');
    expect(r.val).toContain('font-size:26px');
    expect(errs, errs.join('\n')).toEqual([]);
  });

  test(`B7-6 [${type}] ⌘Z 한 걸음 — 바꾼 한 걸음만 되돌린다`, async ({ page }) => {
    const errs = await setup(page, type);
    await openPanel(page);
    await setNum(page, IDS.gap, 40);
    await setNum(page, IDS.thick, 20);
    expect((await read(page)).ds).toMatchObject({ vItemGap: '40', vBarThickness: '20' });
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(250);
    const one = await read(page);
    expect(one.ds.vBarThickness, '⌘Z 한 번 — 마지막(두께)만 사라져야 한다').toBeUndefined();
    expect(one.ds.vItemGap, '⌘Z 한 번 — 앞 걸음(간격 40)은 남아야 한다').toBe('40');
    await page.keyboard.press('Meta+z');
    await page.waitForTimeout(250);
    expect((await read(page)).ds.vItemGap, '⌘Z 두 번 — 간격도 사라진다').toBeUndefined();
    expect(errs, errs.join('\n')).toEqual([]);
  });
}

/* ══ B7r — 현빈 결정 ㉯: 세로·비교는 «새로 정하는 값(vXxx)»만 받는다. 옛 bar-h 키는 안 먹는다. ══ */
const HYUNBIN = { 'data-type': 'graph', 'data-chart-type': 'bar-pair', 'data-preset': 'default',
  'data-chart-height': '376', 'data-label-size': '24', 'data-show-v-label': '0', 'data-show-x-label': '1',
  'data-bar-thickness': '30', 'data-pad-x': '12', 'data-item-gap': '44', 'data-pct-size': '44' };
test('B7-7 ★옛 bar-h 키를 가진 bar-pair(현빈 grb_ts0he_to1ptwe 속성 꼴·글만 바꿈)를 다시 그려도 innerHTML 이 핀(36cbe872)과 같다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const html = await page.evaluate((attrs) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="b7S" data-section="1"><div class="section-hitzone"></div><div class="section-inner" style="padding-left: 32px; padding-right: 32px;"></div></div>');
    const g = document.createElement('div'); g.className = 'graph-block'; g.id = 'b7g';
    for (const [k, v] of Object.entries(attrs)) g.setAttribute(k, v);
    g.dataset.items = JSON.stringify([{ label: '글A', value: 75 }, { label: '글B', value: 90 }]);
    document.querySelector('#b7S .section-inner').appendChild(g);
    window.renderGraph(g);
    return g.innerHTML;
  }, HYUNBIN);
  expect(html).toBe(GOLDEN.hyunbin);
  expect(html, '옛 키가 새 겉모습을 만들면 안 된다').not.toMatch(/gap:|padding:0 |width:30px/);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('B7-8 ★타입을 오가도 겉모습은 «새로 정한 값»만 따른다(h→v→pair→line→v, 옛 키는 그대로 남는다)', async ({ page }) => {
  const errs = await setup(page, 'bar-h', { itemGap: '60', padX: '40', pctSize: '100', barThickness: '30', barColor: '#ff00ff', labelSize: '20' });
  await openPanel(page);
  const look = () => page.evaluate(() => {
    const b = document.getElementById('b7g'); const bars = b.querySelector('.grb-bars-v'); const cs = bars && getComputedStyle(bars);
    const f = b.querySelector('.grb-bar-fill:not([style*="dashed"])');
    return { type: b.dataset.chartType, gap: cs && cs.columnGap, pad: cs && cs.paddingLeft, val: getComputedStyle(b.querySelector('.grb-bar-val-label')).fontSize,
      fillW: f && f.offsetWidth, colW: f && f.parentElement.offsetWidth, bg: f && getComputedStyle(f).backgroundColor };
  });
  const click = async (id) => { await page.evaluate((id) => document.getElementById(id).click(), id); await page.waitForTimeout(100); };
  for (const [btn, t] of [['grb-type-v', 'bar-v'], ['grb-type-pair', 'bar-pair']]) {
    await click(btn);
    const r = await look();
    expect(r.type).toBe(t);
    expect(r.gap, `${t}: 옛 항목 간격 60 이 따라왔다`).toBe('10px');
    expect(r.pad, `${t}: 옛 좌우 패딩 40 이 따라왔다`).toBe('0px');
    expect(r.val, `${t}: 옛 숫자 크기 100 이 따라왔다`).toBe('21px');
    expect(r.fillW, `${t}: 옛 두께 30 이 따라왔다(기본 = 24, E99 U26 ⒜ — 전엔 칸 폭 100%)`).toBe(24);
    if (t === 'bar-v') expect(r.bg, `${t}: 옛 barColor #ff00ff 가 따라왔다`).not.toBe('rgb(255, 0, 255)');   // pair 의 barColor 는 원래 «색상 A»(핀도 칠한다)
  }
  // 비교 막대 «색상 A» 는 barColor(원래부터 pair 의 것) — 세로로 가도 막대색이 되면 안 된다
  await page.evaluate(() => { document.getElementById('b7g').dataset.barColor = '#0000ff'; });
  await click('grb-type-v');
  expect((await look()).bg, 'pair 색상 A 가 세로 막대색이 됐다').not.toBe('rgb(0, 0, 255)');
  // line 의 좌우 패딩(padX 키 공유) 이 세로로 새지 않는다
  await page.evaluate(() => { const b = document.getElementById('b7g'); b.dataset.chartType = 'line'; b.dataset.padX = '40'; window.renderGraph(b); });
  await click('grb-type-v');
  expect((await look()).pad, 'line 좌우 패딩이 세로로 샜다').toBe('0px');
  // 세로에서 새로 정한 값은 세로·비교에서 먹고, 가로로 가도 가로 값은 그대로(옛 키 보존)
  await openPanel(page);
  await setNum(page, IDS.pct, 10);
  await click('grb-type-h');
  const h = await page.evaluate(() => { const b = document.getElementById('b7g'); return { ig: b.dataset.itemGap, ps: b.dataset.pctSize, px: getComputedStyle(b.querySelector('.grb-bar-h-pct')).fontSize, gap: getComputedStyle(b.querySelector('.grb-bars-h')).rowGap }; });
  expect(h).toEqual({ ig: '60', ps: '100', px: '100px', gap: '60px' });
  expect(errs, errs.join('\n')).toEqual([]);
});

for (const type of TYPES) test(`B7-9 [${type}] ★넘침 없음 — 비교 12항목·두께 48·간격 80 이어도 가로로 안 넘친다(간격은 폭/항목수로 클램프, 막대는 칸 100% 상한)`, async ({ page }) => {
  const many = Array.from({ length: 12 }, (_, i) => ({ label: `항목${i + 1}`, value: 10 + i * 7, value2: 90 - i * 5 }));
  {
    const errs = await setup(page, type, {}, many);
    await openPanel(page);
    /* H1(2026-10-05): 세로·비교 두께 위 끝 = 막대가 선 칸의 폭 — 비교 12항목은 시리즈 칸이 48 보다 좁아 그 폭에서 멈춘다(넘침 없음은 그대로 잰다). */
    const cap = await page.evaluate(() => Math.floor(document.querySelector('#b7g .grb-bar-fill').parentElement.clientWidth));
    await setNum(page, IDS.thick, 48); await setNum(page, IDS.gap, 80); await setNum(page, IDS.padx, 80);
    const r = await page.evaluate(() => { const b = document.getElementById('b7g'); const bars = b.querySelector('.grb-bars-v');
      return { sw: bars.scrollWidth, cw: bars.clientWidth, bsw: b.scrollWidth, bcw: b.clientWidth, ds: b.dataset.vBarThickness }; });
    expect(r.ds, `키가 안 들어갔다(48 · 칸 폭 ${cap} 이 작으면 그 폭 — H1)`).toBe(String(Math.min(48, cap)));
    expect(r.sw, `바 줄이 넘친다 ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.cw);
    expect(r.bsw, `블럭이 넘친다 ${JSON.stringify(r)}`).toBeLessThanOrEqual(r.bcw);
    expect(errs, errs.join('\n')).toEqual([]);
  }
});
