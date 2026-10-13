/* shape-ellipse-multi.dom.spec.js — 1013t2A1 원(ellipse) 도형 «갯수·간격·원마다 색·이너 그림자»
 * 현빈 원문: 「Ellipse 블럭 : 별모양 블럭처럼 갯수 선택하면 늘릴 수 있고, 각 원 모양마다 각각의 색을
 *            입력할 수 있다. 살짝 이너 그림자 느낌도 줄 수 있다.」 (그림 ref/1013t2-img01.png — 원 6개 한 줄)
 *
 * 양성대조 판 = 8d2435c0(고치기 전) — `GD1001_ROOT=<그 판 체크아웃>` 로 돌리면
 *   기대: E1·E2·E3·E4·E5·E7·E8·E9·E10 빨강 · E6 초록(지키는 칸 — 옛 저장본 바이트 불변). ★아직 안 돌렸다.
 * 고정 대기 0건 — 조건 대기(waitForFunction · expect.poll)만 쓴다. 매 칸 전제를 먼저 단언한다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sA" data-section="1" data-name="A" data-bg="#ffffff" style="background:#fff;">
  <div class="section-hitzone"><span class="section-label">A</span></div><div class="section-inner"></div></div>`;
/* 그림 색 6개 — 눈대중한 검사 핀일 뿐 제품 기본값이 아니다(소문자 = 칸이 돌려주는 꼴) */
const PINS = ['#ffffff', '#d9d9d9', '#7a7a7a', '#000000', '#a9cfdc', '#d93a26'];
const OLD_INNER = '<ellipse cx="50" cy="50" rx="50" ry="50"></ellipse>';

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 950 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sA'));
    window.addShapeBlock?.('ellipse');
  }, SEC);
  await page.waitForFunction(() => !!document.querySelector('#canvas .shape-block'));
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  await page.waitForFunction(() => !!document.getElementById('shape-w-num'));
  const pre = await page.evaluate(() => {
    const b = document.querySelector('#canvas .shape-block');
    return { id: b.id, type: b.dataset.shapeType };
  });
  expect(pre.id, '전제 — 도형 블록이 생겼다').toMatch(/^shp_/);
  expect(pre.type, '전제 — 원이다').toBe('ellipse');
  return errs;
}

/** 숫자칸에 사람이 치듯 — input ＋ change. */
async function setNum(page, id, v) {
  await page.evaluate(([id, v]) => {
    const n = document.getElementById(id);
    if (!n) throw new Error(`${id} 가 없다`);
    n.value = String(v);
    n.dispatchEvent(new Event('input', { bubbles: true }));
    n.dispatchEvent(new Event('change', { bubbles: true }));
  }, [id, v]);
}

/** 사람처럼 — hex 칸을 누르고 치고 Enter. */
async function typeHex(page, idPrefix, hex) {
  const el = page.locator(`#${idPrefix}-hex`);
  await expect(el, `전제 — ${idPrefix} 글자칸이 화면에 있다`).toBeVisible();
  await el.click();
  await el.fill(hex.replace('#', '').toUpperCase());
  await el.press('Enter');
}

/** W·H 를 100 으로(원 하나 = 정사각) 한 뒤 갯수 n. */
async function toCount(page, n) {
  await setNum(page, 'shape-w-num', 100);
  await setNum(page, 'shape-h-num', 100);
  await page.waitForFunction(() => document.querySelector('#canvas .shape-block').closest('.frame-block')?.style.width === '100px');
  await setNum(page, 'shape-ellipse-count-num', n);
  await page.waitForFunction((n) => document.querySelectorAll('#canvas .shape-block svg ellipse').length === n, n);
}

const look = (page) => page.evaluate(() => {
  const b = document.querySelector('#canvas .shape-block');
  const svg = b.querySelector('svg');
  const frame = b.closest('.frame-block');
  return {
    id: b.id,
    count: b.dataset.ellipseCount ?? null,
    colors: b.dataset.ellipseColors ?? null,
    shadow: b.dataset.ellipseShadow ?? null,
    viewBox: svg.getAttribute('viewBox'),
    inner: svg.innerHTML,
    fills: [...svg.querySelectorAll('ellipse')].map((e) => e.getAttribute('fill')),
    filters: [...svg.querySelectorAll('ellipse')].map((e) => e.getAttribute('filter')),
    nFilter: svg.querySelectorAll('filter').length,
    nBlur: svg.querySelectorAll('feGaussianBlur').length,
    filterIds: [...svg.querySelectorAll('filter')].map((f) => f.id),
    flood: svg.querySelector('feFlood')?.getAttribute('flood-opacity') ?? null,
    frameW: parseInt(frame?.style.width, 10) || null,
  };
});

test('E1 원 패널에 「갯수」 칸이 있다 (1~10 · 기본 1)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const n = document.getElementById('shape-ellipse-count-num');
    const labels = [...document.querySelectorAll('#prop-panel .prop-label, .prop-label')].map((e) => e.textContent.trim());
    return { has: !!n, min: n?.min, max: n?.max, value: n?.value, labels };
  });
  expect(r.has, `갯수 칸 (라벨 전수: ${JSON.stringify(r.labels)})`).toBe(true);
  expect(r.labels).toContain('갯수');
  expect([r.min, r.max, r.value]).toEqual(['1', '10', '1']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E2 갯수 6 ⇒ 원 6개 · viewBox 700 · 프레임 폭 700 · 원이 둥글게 남는다', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 6);
  const s = await look(page);
  expect(s.count).toBe('6');
  expect(s.viewBox).toBe('0 0 700 100');
  expect(s.frameW, `프레임 폭 (잰 값: ${s.frameW})`).toBe(700);
  const cx = await page.evaluate(() => [...document.querySelectorAll('#canvas .shape-block svg ellipse')].map((e) => Number(e.getAttribute('cx'))));
  expect(cx).toEqual([50, 170, 290, 410, 530, 650]);
  /* 레이아웃 px(clientWidth · 배율 무관)로 원 하나의 가로/세로 비 */
  const ratio = await page.evaluate(() => {
    const svg = document.querySelector('#canvas .shape-block svg');
    const e = svg.querySelector('ellipse');
    const [, , vw, vh] = svg.getAttribute('viewBox').split(/\s+/).map(Number);
    const w = 2 * Number(e.getAttribute('rx')) * svg.clientWidth / vw;
    const h = 2 * Number(e.getAttribute('ry')) * svg.clientHeight / vh;
    return h > 0 ? w / h : 0;
  });
  expect(ratio, `원 하나의 가로/세로 (잰 값: ${ratio})`).toBeGreaterThan(0.98);
  expect(ratio).toBeLessThan(1.02);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E3 원마다 색 — hex 칸 6개에 친 색이 원 6개의 fill · dataset 에 선다', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 6);
  await page.waitForFunction(() => !!document.getElementById('shape-ellipse-c5-hex'));
  const nRows = await page.evaluate(() => document.querySelectorAll('[id^="shape-ellipse-c"][id$="-hex"]').length);
  expect(nRows, '전제 — 색 칸이 원 수만큼').toBe(6);
  for (let i = 0; i < 6; i++) await typeHex(page, `shape-ellipse-c${i}`, PINS[i]);
  await expect.poll(async () => (await look(page)).fills).toEqual(PINS);
  const s = await look(page);
  expect(s.colors).toBe(PINS.join(','));
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E4 이너 그림자 — 켜기(35) · 세기 80 ⇒ 0.48 · 끄기 ⇒ 흔적 0', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 3);
  const pre = await look(page);
  expect(pre.nFilter, '전제 — 처음엔 필터가 없다').toBe(0);
  await page.locator('#shape-ellipse-shadow-toggle').check();
  await page.waitForFunction(() => !!document.querySelector('#canvas .shape-block svg filter'));
  let s = await look(page);
  expect(s.shadow).toBe('35');
  expect(s.nFilter).toBe(1);
  expect(s.nBlur).toBe(1);
  expect(s.filterIds).toEqual([`eish-${s.id}`]);
  expect(s.filters).toEqual(Array(3).fill(`url(#eish-${s.id})`));
  await page.waitForFunction(() => !!document.getElementById('shape-ellipse-shadow-num'));
  await setNum(page, 'shape-ellipse-shadow-num', 80);
  await expect.poll(async () => (await look(page)).flood).toBe('0.48');
  await page.locator('#shape-ellipse-shadow-toggle').uncheck();
  await page.waitForFunction(() => !document.querySelector('#canvas .shape-block svg filter'));
  s = await look(page);
  expect(s.shadow).toBe(null);
  expect(s.filters).toEqual([null, null, null]);
  expect(s.inner).not.toContain('eish-');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E5 저장 왕복 — 원 6개 · 색 · 그림자가 dataset 에서 «다시 그려진다»', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 6);
  for (let i = 0; i < 6; i++) await typeHex(page, `shape-ellipse-c${i}`, PINS[i]);
  await page.locator('#shape-ellipse-shadow-toggle').check();
  await page.waitForFunction(() => !!document.querySelector('#canvas .shape-block svg filter'));
  const before = await look(page);
  expect(before.fills, '전제 — 저장 전 칠').toEqual(PINS);
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(saved.length, '전제 — 저장본이 비지 않았다').toBeGreaterThan(100);
  expect(saved).toContain('data-ellipse-count="6"');
  /* ⑴ 그대로 왕복 ⑵ svg 안쪽을 옛 원 하나로 «지운» 저장본 — 로드(rebindAll)가 dataset 에서 다시 그리는지 */
  const stripped = saved.replace(/(<svg[^>]*class="shape-svg"[^>]*>)[\s\S]*?(<\/svg>)/, `$1${OLD_INNER}$2`);
  expect(stripped, '전제 — 지운 판이 실제로 다르다').not.toBe(saved);
  for (const html of [saved, stripped]) {
    const after = await page.evaluate((html) => {
      const c = document.getElementById('canvas');
      c.querySelectorAll('.section-block').forEach((s) => s.remove());
      c.insertAdjacentHTML('beforeend', html);
      window.rebindAll?.();
      const b = document.querySelector('#canvas .shape-block');
      const svg = b.querySelector('svg');
      return { n: svg.querySelectorAll('ellipse').length, vb: svg.getAttribute('viewBox'),
        fills: [...svg.querySelectorAll('ellipse')].map((e) => e.getAttribute('fill')),
        nFilter: svg.querySelectorAll('filter').length,
        flt: [...svg.querySelectorAll('ellipse')].every((e) => e.getAttribute('filter') === `url(#eish-${b.id})`) };
    }, html);
    expect(after.n, `불러온 뒤 원 수 (잰 값: ${after.n})`).toBe(6);
    expect(after.vb).toBe('0 0 700 100');
    expect(after.fills).toEqual(PINS);
    expect(after.nFilter).toBe(1);
    expect(after.flt).toBe(true);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E6 옛 저장본 불변 — 키 없는 원은 rebindAll 뒤 바이트 그대로 · 새 원도 같은 글자', async ({ page }) => {
  const errs = await setup(page);
  const fresh = await look(page);
  expect(fresh.inner, '새 원 = 옛 글자').toBe(OLD_INNER);
  expect(fresh.viewBox).toBe('0 0 100 100');
  expect([fresh.count, fresh.colors, fresh.shadow]).toEqual([null, null, null]);
  const saved = await page.evaluate(() => {
    const sec = document.getElementById('sA');
    const out = window.serializeSectionClone ? window.serializeSectionClone(sec) : sec.outerHTML;
    return typeof out === 'string' ? out : (out && out.outerHTML) || '';
  });
  expect(saved).not.toContain('data-ellipse-');
  expect(saved).not.toContain('eish-');
  const after = await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.();
    const svg = document.querySelector('#canvas .shape-block svg');
    return { inner: svg.innerHTML, vb: svg.getAttribute('viewBox') };
  }, saved);
  expect(after.inner).toBe(OLD_INNER);
  expect(after.vb).toBe('0 0 100 100');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E7 막기 — 갯수 3 이면 가림막 절 0 · 이미지 탭 없음 · 까닭 글 / 가림막 ON(갯수 1)이면 갯수 칸 잠김', async ({ page }) => {
  const errs = await setup(page);
  const pre = await page.evaluate(() => !!document.getElementById('shape-redact-toggle'));
  expect(pre, '전제 — 원 1개면 가림막 절이 있다').toBe(true);
  await toCount(page, 3);
  await page.waitForFunction(() => !!document.getElementById('shape-ellipse-gap-num'));
  const r = await page.evaluate(() => {
    const inp = document.getElementById('shape-color-color');
    return { redact: !!document.getElementById('shape-redact-toggle'),
      modes: inp?.dataset.cpModes ?? null, note: inp?.dataset.cpModesNote ?? null };
  });
  expect(r.redact).toBe(false);
  expect(r.modes).toBe('solid,gradient');
  expect(r.note || '').toContain('원이 여러 개');
  await setNum(page, 'shape-ellipse-count-num', 1);
  await page.waitForFunction(() => !!document.getElementById('shape-redact-toggle'));
  await page.locator('#shape-redact-toggle').check();
  await page.evaluate(() => window.showShapeProperties?.(document.querySelector('#canvas .shape-block')));
  await page.waitForFunction(() => !!document.getElementById('shape-ellipse-count-hint'));
  const dis = await page.evaluate(() => [document.getElementById('shape-ellipse-count-num')?.disabled,
    document.getElementById('shape-ellipse-count-slider')?.disabled]);
  expect(dis).toEqual([true, true]);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E8 그라데이션 + 원마다 색 — 지정한 원은 hex 그대로 · 나머지는 url(#grad-…)', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 3);
  await typeHex(page, 'shape-ellipse-c0', '#d93a26');
  await expect.poll(async () => (await look(page)).fills[0]).toBe('#d93a26');
  await page.evaluate(() => {
    const inp = document.getElementById('shape-color-color');
    inp.dispatchEvent(new CustomEvent('goya-cp:gradient', { detail: { type: 'linear', angle: 90,
      css: 'linear-gradient(90deg, #ff0000 0%, #0000ff 100%)',
      stops: [{ color: '#ff0000', offset: 0 }, { color: '#0000ff', offset: 1 }] } }));
  });
  const id = (await look(page)).id;
  const want = [`#d93a26`, `url(#grad-${id})`, `url(#grad-${id})`];
  await expect.poll(async () => (await look(page)).fills).toEqual(want);
  /* 로드·⌘Z 가 지나는 그리개를 한 번 더 — 그래도 같은가 */
  await page.evaluate(() => window.refreshShapeInnerSVG(document.querySelector('#canvas .shape-block')));
  expect((await look(page)).fills).toEqual(want);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E9 PNG(html2canvas) — 이너 그림자 ON 이면 흰 원의 위쪽 안 가장자리가 어두워진다', async ({ page }) => {
  const errs = await setup(page);
  await setNum(page, 'shape-w-num', 160);
  await setNum(page, 'shape-h-num', 160);
  await typeHex(page, 'shape-color', '#ffffff');
  await page.waitForFunction(() => document.querySelector('#canvas .shape-block').dataset.shapeColor === '#ffffff');
  const shot = (on) => page.evaluate(async (on) => {
    if (typeof window.html2canvas !== 'function') throw new Error('전제: html2canvas 가 없다');
    const b = document.querySelector('#canvas .shape-block');
    if (on) b.dataset.ellipseShadow = '80'; else delete b.dataset.ellipseShadow;
    window.refreshShapeInnerSVG(b);
    window.deselectAll?.();
    const cv = await window.html2canvas(b, { scale: 1, backgroundColor: '#ff0000', logging: false });
    const ctx = cv.getContext('2d');
    const px = ctx.getImageData(Math.floor(cv.width * 0.5), Math.floor(cv.height * 0.04), 1, 1).data;
    return { lum: Math.round((px[0] + px[1] + px[2]) / 3), rgb: [px[0], px[1], px[2]], w: cv.width,
      nFilter: b.querySelectorAll('svg filter').length };
  }, on);
  const off = await shot(false);
  expect(off.nFilter, '전제 — OFF 판에 필터 없음').toBe(0);
  expect(off.w, '전제 — 그림이 찍혔다').toBeGreaterThan(0);
  expect(off.lum, `전제 — OFF 픽셀이 흰 원 안 (잰 값: ${JSON.stringify(off.rgb)})`).toBeGreaterThanOrEqual(245);
  const on = await shot(true);
  expect(on.nFilter, '전제 — ON 판에 필터 1개').toBe(1);
  expect(on.lum, `ON ${JSON.stringify(on.rgb)} vs OFF ${JSON.stringify(off.rgb)}`).toBeLessThan(off.lum - 10);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('E10 붙여넣기 id — block.id 가 바뀌면 relink 가 필터 id·url 을 새 id 로 잇는다', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 2);
  await page.locator('#shape-ellipse-shadow-toggle').check();
  await page.waitForFunction(() => !!document.querySelector('#canvas .shape-block svg filter'));
  const r = await page.evaluate(() => {
    const b = document.querySelector('#canvas .shape-block');
    const oldId = b.id;
    b.id = 'shp_new';
    const pre = b.querySelector('svg filter').id;
    const changed = window.relinkShapeGradient(b);
    return { oldId, pre, changed, ids: [...b.querySelectorAll('svg filter')].map((f) => f.id),
      urls: [...b.querySelectorAll('svg ellipse')].map((e) => e.getAttribute('filter')) };
  });
  expect(r.pre, '전제 — relink 전엔 옛 id').toBe(`eish-${r.oldId}`);
  expect(r.changed).toBe(true);
  expect(r.ids).toEqual(['eish-shp_new']);
  expect(r.urls).toEqual(['url(#eish-shp_new)', 'url(#eish-shp_new)']);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* 1013t2A1 이벨류에이터 지적 — 「개별 색 지우기」가 .prop-btn(24px 아이콘 단추) 그대로라 글자가 접혀 「색/지」만 보였다.
   이웃 글자 단추처럼 width:100% — 접히지 않고(한 줄) 줄 폭을 채운다. */
test('E11 「개별 색 지우기」 단추가 접히지 않는다 — 한 줄 · 줄 폭을 채운다', async ({ page }) => {
  const errs = await setup(page);
  await toCount(page, 3);
  await page.waitForFunction(() => !!document.getElementById('shape-ellipse-colors-reset'));
  const m = await page.evaluate(() => {
    const b = document.getElementById('shape-ellipse-colors-reset');
    const row = b.parentElement.getBoundingClientRect();
    const r = b.getBoundingClientRect();
    const cs = getComputedStyle(b);
    return { w: r.width, rowW: row.width, h: b.clientHeight, sh: b.scrollHeight, lh: parseFloat(cs.lineHeight) || parseFloat(cs.fontSize) * 1.4, text: b.textContent };
  });
  expect(m.text, '전제 — 그 단추다').toBe('개별 색 지우기');
  expect(m.rowW, '전제 — 줄이 그려졌다').toBeGreaterThan(100);
  expect(m.sh, `접힘 — scrollHeight ${m.sh} > clientHeight ${m.h}`).toBeLessThanOrEqual(m.h + 1);
  expect(m.w, `폭 ${m.w} / 줄 ${m.rowW}`).toBeGreaterThanOrEqual(m.rowW - 1);
  expect(errs, errs.join(' | ')).toEqual([]);
});
