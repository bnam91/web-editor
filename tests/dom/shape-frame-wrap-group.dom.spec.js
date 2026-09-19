/* shape-frame-wrap-group.dom.spec.js — 0918 shape A안(T-057) 픽스라운드: ⌘G / ⌘⌥G 와 도형 래퍼
 *
 * 이벨류에이터 실측(9502):
 *   H1 섹션레벨 도형 + 텍스트 다중선택 → ⌘⌥G : 새 프레임이 도형 래퍼 «안»에 생기고 도형이 «삭제»(데이터 손실).
 *      원인 = flow 분기 row 단위가 shape-block 자체 → sectionInner 인덱스 -1 → rows[0].before(ss) 가 래퍼 안.
 *   M1 도형 1개 선택 → ⌘G/⌘⌥G : 새 그룹이 래퍼 «안»(rectangle ▸ Group 1 ▸ Rectangle).
 *      원인 = parentFreeFrame = selected[0].closest('[data-free-layout]') 가 도형 래퍼 자신을 잡음 +
 *             래퍼 수집이 죽은 셀렉터 '.frame-block[data-shape-frame]'.
 *
 * 여기서는 js/block-factory.js 의 «원본» wrapSelectedBlocksInFrame 을 _slice-block 으로 잘라
 *   shape-frame.js 원본과 함께 하네스 페이지에서 실행한다(앱은 안 띄운다).
 * 실행: npm run test:dom -- shape-frame-wrap-group
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');
const BF = fs.readFileSync(path.join(REPO, 'js/block-factory.js'), 'utf8');
const WRAP_SRC = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const NEXT_GROUP_SRC = sliceBlock(BF, 'function _nextGroupName(');

const HARNESS_JS = `
import { isShapeFrame, shapeFrameOf } from '/js/shape-frame.js';
let __n = 0;
function makeFrameBlock() {
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = 'ss_new' + (++__n);
  ss.dataset.freeLayout = 'true';
  return ss;
}
window.pushHistory = () => {};
window.buildLayerPanel = () => {};
window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
${NEXT_GROUP_SRC}
${WRAP_SRC}
window.__wrap = wrapSelectedBlocksInFrame;
window.__ready = true;
`;

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            .section-block{position:relative;width:800px;}
            .section-inner{display:flex;flex-direction:column;}
            .frame-block[data-free-layout="true"]{position:relative;}
            .shape-block{width:100%;height:100%;}
            .text-block{height:40px;}
          </style>
          <script type="module" src="/__harness.js"></script>
          </head><body>${bodyHtml}</body></html>`,
      });
    }
    if (url.pathname === '/__harness.js') return route.fulfill({ contentType: 'application/javascript', body: HARNESS_JS });
    if (url.pathname === '/js/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const SHAPE = (id, sel) =>
  `<div class="shape-block${sel ? ' selected' : ''}" id="${id}" data-shape-type="rectangle" style="position:absolute;left:0;top:0;"></div>`;
const WRAP_STYLE = 'width:100px;height:100px;max-width:100%;margin:0 auto;min-height:100px;background:transparent;padding:0;';

// 섹션레벨: [gap, 텍스트프레임(Heading), 도형래퍼, gap]
const SECTION_LEVEL = (shapeSel, textSel, wrapSel) => `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="gap-block" id="gb_top" style="height:20px"></div>
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block${textSel ? ' selected' : ''}" id="tb_1">Heading</div></div>
  <div class="frame-block${wrapSel ? ' selected' : ''}" id="ss_shape" data-free-layout="true" data-layer-name="rectangle" style="${WRAP_STYLE}">${SHAPE('shp_1', shapeSel)}</div>
  <div class="gap-block" id="gb_bot" style="height:20px"></div>
</div></div>`;

function snapshot() {
  const shp = document.getElementById('shp_1');
  const w = document.getElementById('ss_shape');
  return {
    shapeCount: document.querySelectorAll('.shape-block').length,
    shapeParent: shp?.parentElement?.id,
    wrapKids: w ? [...w.children].map(c => c.id) : null,
    wrapIsShapeFrame: window.ShapeFrame.isShapeFrame(w),
    wrapParent: w?.parentElement?.id,
    wrapWidth: w?.style.width,
    innerOrder: [...document.getElementById('inner').children].map(c => c.id),
    // 도형 래퍼 «안»의 frame-block 수 — 0 이어야 한다
    framesInsideWrap: w ? w.querySelectorAll('.frame-block').length : -1,
  };
}

test('H1 ★섹션레벨 도형+텍스트 → ⌘⌥G: 새 프레임은 래퍼 «밖», 도형은 삭제되지 않고 래퍼째 새 프레임 안', async ({ page }) => {
  const errs = await boot(page, SECTION_LEVEL(true, true, true));
  const out = await page.evaluate((snapSrc) => {
    window.__wrap();
    const snap = new Function('return (' + snapSrc + ')()');
    return snap();
  }, snapshot.toString());
  expect(out.shapeCount, '도형이 지워지면 안 된다(데이터 손실)').toBe(1);
  expect(out.shapeParent).toBe('ss_shape');
  expect(out.wrapKids).toEqual(['shp_1']);
  expect(out.framesInsideWrap, '래퍼 안에 프레임이 생기면 안 된다').toBe(0);
  expect(out.wrapIsShapeFrame).toBe(true);
  expect(out.wrapParent).toMatch(/^ss_new/);
  expect(out.wrapWidth, '도형 래퍼 크기 유지(100% 로 늘리지 않음)').toBe('100px');
  // 새 프레임은 원래 텍스트 자리(gb_top 뒤)에
  expect(out.innerOrder[0]).toBe('gb_top');
  expect(out.innerOrder[1]).toMatch(/^ss_new/);
  expect(out.innerOrder).toContain('gb_bot');
  expect(errs).toEqual([]);
});

for (const asGroup of [true, false]) {
  test(`M1 섹션레벨 도형 1개만 선택 → ${asGroup ? '⌘G' : '⌘⌥G'}: 새 ${asGroup ? '그룹' : '프레임'}이 래퍼를 감싼다(래퍼 안 아님)`, async ({ page }) => {
    const errs = await boot(page, SECTION_LEVEL(true, false, true));
    const out = await page.evaluate(([snapSrc, g]) => {
      window.__wrap({ asGroup: g });
      const snap = new Function('return (' + snapSrc + ')()');
      const s = snap();
      const outer = document.getElementById('ss_shape').parentElement;
      s.outerGroup = outer.dataset.group || null;
      s.outerParent = outer.parentElement.id;
      return s;
    }, [snapshot.toString(), asGroup]);
    expect(out.shapeCount).toBe(1);
    expect(out.wrapKids).toEqual(['shp_1']);
    expect(out.framesInsideWrap).toBe(0);
    expect(out.wrapParent).toMatch(/^ss_new/);
    expect(out.outerParent).toBe('inner');
    expect(out.outerGroup).toBe(asGroup ? 'true' : null);
    expect(errs).toEqual([]);
  });
}

test('M2 자유배치 프레임 안 도형 1개 → ⌘G: 새 그룹은 부모 프레임 직속, 도형 래퍼를 좌표 보존해 감싼다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="frame-block selected" id="ss_parent" data-free-layout="true" style="position:relative;width:600px;height:400px;">
    <div class="frame-block selected" id="ss_shape" data-free-layout="true" data-layer-name="star" style="position:absolute;left:50px;top:60px;width:100px;height:100px;">${SHAPE('shp_1', true)}</div>
  </div>
</div></div>`);
  const out = await page.evaluate(() => {
    const before = document.getElementById('shp_1').getBoundingClientRect();
    window.__wrap({ asGroup: true });
    const w = document.getElementById('ss_shape');
    const g = w.parentElement;
    const after = document.getElementById('shp_1').getBoundingClientRect();
    return {
      gIsGroup: g.dataset.group, gParent: g.parentElement.id,
      wrapKids: [...w.children].map(c => c.id), inside: w.querySelectorAll('.frame-block').length,
      dx: Math.abs(before.left - after.left), dy: Math.abs(before.top - after.top),
      ejected: window.ShapeFrame.ejectShapeFrameIntruders(document.body),
    };
  });
  expect(out.gIsGroup).toBe('true');
  expect(out.gParent).toBe('ss_parent');
  expect(out.wrapKids).toEqual(['shp_1']);
  expect(out.inside).toBe(0);
  expect(out.dx).toBeLessThanOrEqual(1);
  expect(out.dy).toBeLessThanOrEqual(1);
  expect(out.ejected).toBe(0);
  expect(errs).toEqual([]);
});

test('N1 음성대조 — 도형 없는 텍스트 2개 ⌘⌥G 는 기존대로(텍스트가 새 프레임 직속 absolute)', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block selected" id="tb_1">A</div></div>
  <div class="frame-block" id="tf_2" data-text-frame="true"><div class="text-block selected" id="tb_2">B</div></div>
</div></div>`);
  const out = await page.evaluate(() => {
    window.__wrap();
    const a = document.getElementById('tb_1'), b = document.getElementById('tb_2');
    return { pa: a.parentElement.id, pb: b.parentElement.id, pos: a.style.position, topB: b.style.top,
             order: [...document.getElementById('inner').children].map(c => c.id) };
  });
  expect(out.pa).toMatch(/^ss_new/);
  expect(out.pb).toBe(out.pa);
  expect(out.pos).toBe('absolute');
  expect(out.topB).toBe('40px');
  expect(out.order).toEqual([out.pa]);
  expect(errs).toEqual([]);
});

/* ── 2라운드 T-057: 섹션 좌우여백(section-inner 인라인 padding)이 있을 때 ⌘G/⌘⌥G 가 도형을 여백만큼 밀던 결함 ──
 * 원인: flow 분기 _shapeLeft 를 section-inner «테두리 상자» 기준으로 쟀다(패딩 포함) → 새 프레임(내용 상자 안)
 *       에 다시 left 로 넣으면 패딩만큼 한 번 더 밀림(72px). 합쳐진 파트(merged-part) 패딩도 같은 식으로 샌다.
 * 기준: 묶기 전후 도형(shape-block)의 화면 left 차이 ≤ 1px. */
const PADDED_SECTION = ({ shapeSel = true, textSel = false, secStyle = '', merged = false } = {}) => {
  const inner = `
  <div class="gap-block" id="gb_top" style="height:20px"></div>
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block${textSel ? ' selected' : ''}" id="tb_1">Heading</div></div>
  <div class="frame-block${shapeSel ? ' selected' : ''}" id="ss_shape" data-free-layout="true" data-layer-name="rectangle" style="${WRAP_STYLE}">${SHAPE('shp_1', shapeSel)}</div>
  <div class="gap-block" id="gb_bot" style="height:20px"></div>`;
  const body = merged
    ? `<div class="merged-part" id="mp_1" style="display:flex;flex-direction:column;padding-left:40px;padding-right:40px;">${inner}</div>`
    : inner;
  return `
<div class="section-block selected" id="sec" style="${secStyle}"><div class="section-inner" id="inner" style="padding-left:72px;padding-right:72px;">${body}</div></div>`;
};

async function measureWrap(page, asGroup) {
  return page.evaluate((g) => {
    const shp = document.getElementById('shp_1');
    const before = shp.getBoundingClientRect();
    window.__wrap({ asGroup: g });
    const after = shp.getBoundingClientRect();
    const w = document.getElementById('ss_shape');
    return { dx: after.left - before.left, bl: before.left, al: after.left,
             wrapParent: w.parentElement.id, shapeCount: document.querySelectorAll('.shape-block').length };
  }, asGroup);
}

for (const asGroup of [true, false]) {
  const k = asGroup ? '⌘G' : '⌘⌥G';
  test(`H2 ★섹션 좌우여백 72 + 가운데 도형 1개 → ${k}: 도형 가로 위치 그대로(|Δ|≤1)`, async ({ page }) => {
    const errs = await boot(page, PADDED_SECTION());
    const out = await measureWrap(page, asGroup);
    expect(out.wrapParent).toMatch(/^ss_new/);
    expect(Math.abs(out.dx), `묶은 뒤 도형이 ${out.dx}px 밀렸다(before ${out.bl} → after ${out.al})`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });
  test(`H2b 섹션 좌우여백 72 + 도형·텍스트 같이 → ${k}: 도형 가로 위치 그대로`, async ({ page }) => {
    const errs = await boot(page, PADDED_SECTION({ textSel: true }));
    const out = await measureWrap(page, asGroup);
    expect(out.shapeCount).toBe(1);
    expect(Math.abs(out.dx), `Δ=${out.dx}`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });
  test(`H3 합쳐진 파트(padding 40) 안 도형 → ${k}: 도형 가로 위치 그대로`, async ({ page }) => {
    const errs = await boot(page, PADDED_SECTION({ merged: true }));
    const out = await measureWrap(page, asGroup);
    expect(out.wrapParent).toMatch(/^ss_new/);
    expect(Math.abs(out.dx), `Δ=${out.dx}`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });
  test(`H4 줌(섹션 scale 0.5) + 여백 72 → ${k}: 도형 가로 위치 그대로`, async ({ page }) => {
    const errs = await boot(page, PADDED_SECTION({ secStyle: 'transform:scale(0.5);transform-origin:0 0;' }));
    const out = await measureWrap(page, asGroup);
    expect(Math.abs(out.dx), `Δ=${out.dx}`).toBeLessThanOrEqual(1);
    expect(errs).toEqual([]);
  });
}
