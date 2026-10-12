/* highlight-line-j1j2 — 형광펜(선 형광펜 B, shape:'highlightB') 1012t1J1 · J2.
 *
 * 현빈(1012t1 J1): 「b만 남겨줘 · 찍으면 선이 되는데 그냥 누르면 만들어지게 하고 그다음 조정」
 *
 * ★무엇을 잠그나 (J1)
 *   J1-a 섹션을 고른 뒤 «실제 UI 클릭»(스티커 버튼 → 메뉴 «Highlight»)이면 B 가 바로 하나 생긴다:
 *        길이 160 수평선 · 두 끝점 섹션 안 · 선택됨 · 끝점 핸들 2 · 우측 Highlight Line 절이 보인다 · 두 클릭 모드는 꺼져 있다.
 *        (고치기 전: 메뉴가 두 클릭 모드로 들어가 블럭 0개 · 그리고 좌표 없는 addStickerBlock({shape:'highlightB'})는 (0,0)→(100,0))
 *   J1-b 만든 직후 끝 핸들을 실제 마우스로 끌면 x2 가 는다(«그다음 조정»).
 *   J1-c 만든 직후 ⌘Z 한 번이면 블럭이 0개(삽입 이음매).
 *   J1-d 옛 프로젝트의 면 형광펜 A(data-shape="highlight")는 계속 그려지고 패널이 열린다 · Shape 토글의 A 단추는 «A 블럭에서만».
 * 음성대조(보고에 수): sticker-block.js 의 끝점 주입 갈래를 지우면 J1-a 빨강 · prop-sticker.js 의 isHl 조건을 true 로 깨면 J1-d 빨강.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/* 섹션 하나를 깔고 «고른» 상태로 둔다. 돌려주는 값 = 섹션 id. */
async function setupSection(page) {
  return page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secH" style="position:relative;height:480px;background:#ffffff"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    const sec = document.getElementById('secH');
    window.selectSection?.(sec);
    return { id: sec.id, selected: window.getSelectedSection?.() === sec };
  });
}

/* 스티커 버튼 → 메뉴 항목(텍스트로 찾음) 을 «실제 마우스»로 누른다. */
async function clickPenMenu(page, label) {
  const btn = await page.evaluate(() => { const r = document.getElementById('fp-pen-btn').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
  await page.mouse.click(btn.x, btn.y);
  await page.waitForFunction((label) => [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].some(e => e.textContent.trim() === label && e.getBoundingClientRect().width > 0), label, { timeout: 3000 });
  const it = await page.evaluate((label) => {
    const items = [...document.querySelectorAll('#fp-pen-menu .fp-menu-item')].filter(e => e.textContent.trim() === label && e.getBoundingClientRect().width > 0);
    const r = items[0].getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { n: items.length, x, y, hit: document.elementFromPoint(x, y) === items[0] };
  }, label);
  expect(it.n, `★전제: 보이는 «${label}» 메뉴 항목이 하나다`).toBe(1);
  expect(it.hit, '★전제: 누르는 점이 그 메뉴 항목 위다').toBe(true);
  await page.mouse.click(it.x, it.y);
}

const hlbState = (page) => page.evaluate(() => {
  const all = [...document.querySelectorAll('.sticker-block[data-shape="highlightB"]')];
  const b = all[all.length - 1];
  const sec = document.getElementById('secH');
  if (!b) return { n: 0 };
  const d = b.dataset;
  const sec2 = document.getElementById('stk-hlb-section');
  return {
    n: all.length, id: b.id,
    x1: +d.x1, y1: +d.y1, x2: +d.x2, y2: +d.y2,
    secW: sec.offsetWidth, secH: sec.offsetHeight,
    selected: b.classList.contains('selected'),
    handles: b.querySelectorAll('.hlb-handle').length,
    panel: !!sec2 && getComputedStyle(sec2).display !== 'none',
    mode: document.body.classList.contains('hlb-mode'),
  };
});

test('J1-a 메뉴 «Highlight» 한 번 누르면 선 형광펜이 «바로» 생기고 고른 상태(끝점 핸들 2·패널)다', async ({ page }) => {
  const errs = await bootApp(page);
  const s = await setupSection(page);
  expect(s.selected, '★전제: 섹션이 골라져 있다').toBe(true);
  const before = await page.evaluate(() => document.querySelectorAll('.sticker-block').length);
  expect(before).toBe(0);

  await clickPenMenu(page, 'Highlight');
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"]').length === 1, null, { timeout: 3000 });
  const r = await hlbState(page);
  expect(r.n, '선 형광펜이 정확히 하나').toBe(1);
  expect(await page.evaluate(() => document.querySelectorAll('.sticker-block').length), '스티커가 +1 (A 는 안 생긴다)').toBe(1);
  expect(Math.hypot(r.x2 - r.x1, r.y2 - r.y1), '기본 길이 160').toBe(160);
  expect(r.y1, '수평선').toBe(r.y2);
  for (const [k, v, max] of [['x1', r.x1, r.secW], ['x2', r.x2, r.secW], ['y1', r.y1, r.secH], ['y2', r.y2, r.secH]]) {
    expect(v, `${k} 가 섹션 안(>0)`).toBeGreaterThan(0);
    expect(v, `${k} 가 섹션 안(<끝)`).toBeLessThan(max);
  }
  expect(r.selected, '만든 직후 골라져 있다').toBe(true);
  expect(r.handles, '끝점 핸들 2').toBe(2);
  expect(r.panel, '우측 Highlight Line 절이 보인다').toBe(true);
  expect(r.mode, '두 클릭 모드로 들어가지 않았다').toBe(false);
  expect(errs).toEqual([]);
});

test('J1-b 만든 직후 끝 핸들을 끌면 x2 가 는다(그다음 조정)', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  await clickPenMenu(page, 'Highlight');
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"] .hlb-handle').length === 2, null, { timeout: 3000 });
  const h = await page.evaluate(() => {
    const e = document.querySelector('.sticker-block[data-shape="highlightB"] .hlb-handle[data-endpoint="end"]');
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    return { x, y, hit: document.elementFromPoint(x, y) === e, x2: +e.closest('.sticker-block').dataset.x2 };
  });
  expect(h.hit, '★전제: 누르는 점이 끝 핸들 위다').toBe(true);
  await page.mouse.move(h.x, h.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(h.x + i * 10, h.y);
  await page.mouse.up();
  await expect.poll(() => page.evaluate(() => +document.querySelector('.sticker-block[data-shape="highlightB"]').dataset.x2)).toBeGreaterThan(h.x2 + 20);
});

test('J1-c 만든 직후 ⌘Z 한 번이면 블럭이 0개', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  await clickPenMenu(page, 'Highlight');
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"]').length === 1, null, { timeout: 3000 });
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('.sticker-block').length)).toBe(0);
});

test('J1-d 옛 면 형광펜 A 는 계속 그려지고 패널이 열린다 · Shape 의 A 단추는 A 블럭에서만', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('secH');
    sec.insertAdjacentHTML('beforeend', '<div class="sticker-block" id="stk_oldA" data-type="sticker" data-shape="highlight" data-x="40" data-y="40" data-hl-w="200" data-hl-h="30" data-hl-color="rgba(0, 200, 255, 0.5)"></div>');
    const a = document.getElementById('stk_oldA');
    window.renderStickerBlock?.(a);
    window.bindStickerSelect?.(a);
    window._selectSticker?.(a);
    const cs = getComputedStyle(a);
    const hlSec = document.getElementById('stk-hl-section');
    const out = { w: cs.width, bg: cs.backgroundColor, hlPanel: !!hlSec && getComputedStyle(hlSec).display !== 'none',
      aBtnOnA: document.querySelectorAll('#stk-shape-group [data-shape="highlight"]').length };
    const b = window.makeStickerBlock({ shape: 'highlightB', x1: 60, y1: 200, x2: 220, y2: 200 });
    sec.appendChild(b); window.bindStickerSelect?.(b); window._selectSticker?.(b);
    out.aBtnOnB = document.querySelectorAll('#stk-shape-group [data-shape="highlight"]').length;
    out.bBtnOnB = document.querySelectorAll('#stk-shape-group [data-shape="highlightB"]').length;
    return out;
  });
  expect(r.w, 'A 너비 = 저장된 200').toBe('200px');
  expect(r.bg, 'A 색 = 저장된 색').toBe('rgba(0, 200, 255, 0.5)');
  expect(r.hlPanel, 'A 패널(Highlight Size) 열림').toBe(true);
  expect(r.aBtnOnA, 'A 블럭에선 Shape 의 A 단추가 있다(B 로 넘어갈 수 있게)').toBe(1);
  expect(r.bBtnOnB, '★전제: B 블럭 패널이 그려졌다').toBe(1);
  expect(r.aBtnOnB, 'B 블럭에선 A 로 바꾸는 단추가 없다').toBe(0);
});

/* ══════════════════════════════════════════════════════════════════════════
   J2 — 두들 프리셋 칩 (선 형광펜 우측 패널 «Doodle Presets»)
   음성대조(보고에 수): 칩 맵핑(PRESETS 키) 한 글자를 깨면 J2-b 빨강 · 렌더 두들 갈래를 비우면 J2-b 빨강 ·
     모르는 lineStyle 폴백을 지우면 J2-f 빨강.
   ══════════════════════════════════════════════════════════════════════════ */
/* 프리셋 기대값 — ★글자로 박는다(doodle-line-render.js 에서 읽으면 항등식) */
const DOODLE_WANT = {
  scribble: { thickness: '18', hlColor: 'rgba(255, 235, 70, 0.75)', paths: 1 },
  brush:    { thickness: '20', hlColor: 'rgba(255, 150, 40, 0.6)',  paths: 3 },
  circle:   { thickness: '4',  hlColor: 'rgba(230, 60, 60, 0.9)',   paths: 1 },
  double:   { thickness: '5',  hlColor: 'rgba(40, 110, 230, 0.85)', paths: 2 },
  scratch:  { thickness: '6',  hlColor: 'rgba(230, 60, 60, 0.9)',   paths: 1 },
};

/* B 하나를 만들어 고른다(입구 함수 — J1 이 입구 클릭을 따로 잰다). 돌려주는 값 = id */
async function makeSelectedB(page, extra = {}) {
  await setupSection(page);
  return page.evaluate((extra) => {
    const sec = document.getElementById('secH');
    const b = window.makeStickerBlock({ shape: 'highlightB', x1: 80, y1: 200, x2: 420, y2: 200, seed: 4242, ...extra });
    sec.appendChild(b); window.bindStickerSelect?.(b); window._selectSticker?.(b);
    return b.id;
  }, extra);
}

async function clickChip(page, key) {
  const c = await page.evaluate((key) => {
    const e = document.querySelector(`#stk-hlb-doodle-group .prop-preset-btn[data-doodle="${key}"]`);
    if (!e) return null;
    e.scrollIntoView({ block: 'center' });
    const r = e.getBoundingClientRect();
    const x = r.left + r.width / 2, y = r.top + r.height / 2;
    const hit = document.elementFromPoint(x, y);
    return { x, y, hit: !!hit && (hit === e || e.contains(hit)) };
  }, key);
  expect(c, `★전제: «${key}» 칩이 있다`).not.toBeNull();
  expect(c.hit, `★전제: 누르는 점이 «${key}» 칩 위다`).toBe(true);
  await page.mouse.click(c.x, c.y);
}

test('J2-a 선 형광펜 패널에 두들 칩 5개 · A·원형 스티커에선 그 절이 숨는다', async ({ page }) => {
  const errs = await bootApp(page);
  await makeSelectedB(page);
  const r = await page.evaluate(() => {
    const vis = () => { const s = document.getElementById('stk-hlb-doodle-section'); return !!s && getComputedStyle(s).display !== 'none'; };
    const out = { chips: [...document.querySelectorAll('#stk-hlb-doodle-group .prop-preset-btn')].map(e => e.dataset.doodle), onB: vis() };
    const sec = document.getElementById('secH');
    const a = window.makeStickerBlock({ shape: 'highlight', x: 40, y: 40 }); sec.appendChild(a); window.bindStickerSelect?.(a); window._selectSticker?.(a);
    out.onA = vis(); out.panelA = !!document.getElementById('stk-hl-section');
    const c = window.makeStickerBlock({ shape: 'circle', x: 300, y: 40 }); sec.appendChild(c); window.bindStickerSelect?.(c); window._selectSticker?.(c);
    out.onCircle = vis(); out.panelCircle = !!document.getElementById('stk-shape-group');
    return out;
  });
  expect(r.chips).toEqual(['scribble', 'brush', 'circle', 'double', 'scratch']);
  expect(r.onB, 'B 에선 보인다').toBe(true);
  expect(r.panelA, '★전제: A 패널이 그려졌다').toBe(true);
  expect(r.onA, 'A 에선 숨는다').toBe(false);
  expect(r.panelCircle, '★전제: 원형 패널이 그려졌다').toBe(true);
  expect(r.onCircle, '원형에선 숨는다').toBe(false);
  expect(errs).toEqual([]);
});

test('J2-b 칩 5개를 실제로 누르면 모양·두께·색이 깔리고 획 수가 맞고 필터 0 · 잘림 없음', async ({ page }) => {
  const errs = await bootApp(page);
  const id = await makeSelectedB(page);
  for (const [key, want] of Object.entries(DOODLE_WANT)) {
    await clickChip(page, key);
    await page.waitForFunction(([id, key]) => document.getElementById(id)?.dataset.lineStyle === key
      && document.querySelector(`#stk-hlb-doodle-group .prop-preset-btn[data-doodle="${key}"]`)?.classList.contains('active'), [id, key], { timeout: 3000 });
    const r = await page.evaluate((id) => {
      const b = document.getElementById(id);
      const svg = b.querySelector('svg.sticker-hlb-svg');
      const ps = [...b.querySelectorAll('path.sticker-hlb-line')];
      let top = Infinity, bot = -Infinity;
      for (const p of ps) { const bb = p.getBBox(); top = Math.min(top, bb.y); bot = Math.max(bot, bb.y + bb.height); }
      return { ds: { lineStyle: b.dataset.lineStyle, thickness: b.dataset.thickness, hlColor: b.dataset.hlColor },
        paths: ps.length, empty: ps.filter(p => !(p.getAttribute('d') || '').trim()).length,
        filters: b.querySelectorAll('[filter], filter').length,
        svgH: +svg.getAttribute('height'), top, bot,
        styleActive: document.querySelectorAll('#stk-hlb-style-group .prop-align-btn.active').length,
        handles: b.querySelectorAll('.hlb-handle').length };
    }, id);
    expect(r.ds, `${key}: 프리셋 값`).toEqual({ lineStyle: key, thickness: want.thickness, hlColor: want.hlColor });
    expect(r.paths, `${key}: 획 수`).toBe(want.paths);
    expect(r.empty, `${key}: 빈 d`).toBe(0);
    expect(r.filters, `${key}: SVG 필터 0`).toBe(0);
    expect(r.top, `${key}: 위가 안 잘린다`).toBeGreaterThanOrEqual(-0.01);
    expect(r.bot, `${key}: 아래가 안 잘린다`).toBeLessThanOrEqual(r.svgH + 0.01);
    expect(r.styleActive, `${key}: 직선/물결/마커 토글은 비활성`).toBe(0);
    expect(r.handles, `${key}: 끝점 핸들 2 유지`).toBe(2);
  }
  expect(errs).toEqual([]);
});

test('J2-c 결정성 — 두 번 그려도 · 직렬화→재삽입→재렌더해도 같은 그림', async ({ page }) => {
  await bootApp(page);
  const id = await makeSelectedB(page);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    const out = {};
    for (const k of ['scribble', 'brush', 'circle', 'double', 'scratch']) {
      b.dataset.lineStyle = k;
      window.renderStickerBlock(b);
      const one = b.querySelector('svg').outerHTML;
      window.renderStickerBlock(b);
      const two = b.querySelector('svg').outerHTML;
      const wrap = document.createElement('div'); wrap.appendChild(b.cloneNode(true));
      window.serializeCleanRoot(wrap);
      const html = wrap.innerHTML;
      const host = document.createElement('div'); host.innerHTML = html;
      const c = host.firstElementChild; c.id = id + '_re';      // id 해시 폴백을 안 타게 seed 가 실렸는지도 같이 잰다
      document.getElementById('secH').appendChild(c);
      window.renderStickerBlock(c);
      out[k] = { same: one === two, reSame: c.querySelector('svg').outerHTML.replace(/hlb-rough-[^"]+/g, '') === one.replace(/hlb-rough-[^"]+/g, ''), seed: c.dataset.seed };
      c.remove();
    }
    return out;
  }, id);
  for (const [k, v] of Object.entries(r)) {
    expect(v.same, `${k}: 두 번 그리면 같다`).toBe(true);
    expect(v.seed, `${k}: 직렬화에 seed 가 산다`).toBe('4242');
    expect(v.reSame, `${k}: 저장/로드 길에서도 같다`).toBe(true);
  }
});

test('J2-d 동그라미로 bbox 가 커져도 끝점 핸들이 (x1,y1)/(x2,y2) 에 붙어 있다', async ({ page }) => {
  await bootApp(page);
  const id = await makeSelectedB(page);
  await clickChip(page, 'circle');
  await page.waitForFunction((id) => document.getElementById(id)?.dataset.lineStyle === 'circle' && document.querySelectorAll(`#${id} .hlb-handle`).length === 2, id, { timeout: 3000 });
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    const sec = document.getElementById('secH').getBoundingClientRect();
    const z = (window.currentZoom || 40) / 100;
    return [...b.querySelectorAll('.hlb-handle')].map(h => {
      const q = h.getBoundingClientRect();
      const i = h.dataset.endpoint === 'start' ? '1' : '2';
      return { ep: h.dataset.endpoint, dx: Math.abs((q.left + q.width / 2) - (sec.left + (+b.dataset['x' + i]) * z)), dy: Math.abs((q.top + q.height / 2) - (sec.top + (+b.dataset['y' + i]) * z)) };
    });
  }, id);
  expect(r.length).toBe(2);
  for (const h of r) { expect(h.dx, `${h.ep} x`).toBeLessThanOrEqual(2); expect(h.dy, `${h.ep} y`).toBeLessThanOrEqual(2); }
});

test('J2-e 칩 → ⌘Z 한 번이면 직전 스타일로 돌아간다', async ({ page }) => {
  await bootApp(page);
  await setupSection(page);
  await clickPenMenu(page, 'Highlight');            // 실제 입구(삽입 이음매 포함)
  await page.waitForFunction(() => document.querySelectorAll('.sticker-block[data-shape="highlightB"]').length === 1, null, { timeout: 3000 });
  const before = await page.evaluate(() => document.querySelector('.sticker-block[data-shape="highlightB"]').dataset.lineStyle);
  expect(before, '★전제: 처음은 직선').toBe('line');
  await clickChip(page, 'double');
  await page.waitForFunction(() => document.querySelector('.sticker-block[data-shape="highlightB"]')?.dataset.lineStyle === 'double', null, { timeout: 3000 });
  await page.evaluate(() => { document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+z');
  await expect.poll(() => page.evaluate(() => {
    const all = document.querySelectorAll('.sticker-block[data-shape="highlightB"]');
    return all.length === 1 ? all[0].dataset.lineStyle : `n=${all.length}`;
  })).toBe('line');
});

test('J2-f 모르는 lineStyle 은 직선으로 떨어진다(선이 안 사라진다)', async ({ page }) => {
  await bootApp(page);
  const id = await makeSelectedB(page);
  const r = await page.evaluate((id) => {
    const b = document.getElementById(id);
    b.dataset.lineStyle = 'zzz';
    window.renderStickerBlock(b);
    const ps = [...b.querySelectorAll('path.sticker-hlb-line')];
    return { n: ps.length, d: ps.map(p => p.getAttribute('d') || '') };
  }, id);
  expect(r.n).toBe(1);
  expect(r.d[0].trim().length, 'd 가 비었다 — 선이 안 보인다').toBeGreaterThan(0);
});
