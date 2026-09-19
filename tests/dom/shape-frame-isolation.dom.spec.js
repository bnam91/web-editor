/* shape-frame-isolation.dom.spec.js — 0918 shape A안: «도형 래퍼는 그냥 도형이다»
 *
 * 현빈 원문: 「ss_ts0he_hmdtw6g 왜 렉탱글 안에 렉탱글과 에셋 서클이 들어가지? 토글이 열릴 이유가
 *   없지 않아? 왜 프레임처럼 작용해? 그냥 도형일 뿐.」 + 확정결정 「이미 들어간 블럭은 밖으로 꺼낸다」.
 *
 * 근본원인: addShapeBlock 이 도형을 «자유배치 프레임» 안에 넣어 만들고, _activeFrame=래퍼 가 되면
 *   _insertToFlowFrame·insertAfterSelected 등이 래퍼를 평범한 컨테이너로 보고 그 «안»에 넣었다.
 *
 * 여기서 재는 것:
 *   E1~E5 로드 정규화(ejectShapeFrameIntruders) — 실제 오염 2건의 DOM 모양 그대로 재현.
 *   R1    판정/해석 SSOT(isShapeFrame·resolveInsertFrame·anchorUnitOf).
 *   I1~I3 실제 insertAfterSelected(js/drag-utils.js 원본)가 도형 래퍼 «안»에 안 넣는다.
 *
 * ⛔앱을 «안» 띄운다 — js/shape-frame.js · js/drag-utils.js 원본을 route-fulfill 로 단독 로드
 *   (globals.js 만 스텁). gradient-shape-rotation-box.dom.spec.js 부트 패턴.
 * 실행: npm run test:dom -- shape-frame-isolation
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');
const DRAG_UTILS_JS = fs.readFileSync(path.join(REPO, 'js/drag-utils.js'), 'utf8');

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            .section-block{position:relative;width:800px;}
            .frame-block[data-free-layout="true"]{position:relative;}
            .shape-block{width:100%;height:100%;}
          </style>
          <script type="module">
            import * as SF from '/js/shape-frame.js';
            import * as DU from '/js/drag-utils.js';
            window.__SF = SF; window.__DU = DU; window.__ready = true;
          </script>
          </head><body>${bodyHtml}</body></html>`,
      });
    }
    if (url.pathname === '/js/shape-frame.js') {
      return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    }
    if (url.pathname === '/js/drag-utils.js') {
      return route.fulfill({ contentType: 'application/javascript', body: DRAG_UTILS_JS });
    }
    if (url.pathname === '/js/globals.js') {
      return route.fulfill({ contentType: 'application/javascript', body: 'export const state = {};' });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const SHAPE = (id = 'shp_a') =>
  `<div class="shape-block" id="${id}" data-type="shape" data-shape-type="rectangle" style="position:absolute;left:0;top:0;"><svg class="shape-svg"></svg></div>`;
const WRAP_STYLE = 'width:100px;height:100px;max-width:100%;margin:0 auto;min-height:100px;background:transparent;padding:0;';

/* ── 실제 오염 ① proj_1789534352645 / ss_ts0he_hmdtw6g — 부모 .section-inner(플로우) ── */
const HMDTW6G = `
<div class="section-block" id="sec1"><div class="section-inner" id="inner1">
  <div class="frame-block" id="ss_ts0he_hmdtw6g" data-free-layout="true" data-layer-name="rectangle" style="${WRAP_STYLE}">
    ${SHAPE('shp_1')}
    <div class="icon-circle-block" id="icb_1" style="position:absolute;left:0;top:20px;width:100%;" data-offset-x="0" data-offset-y="20"></div>
  </div>
  <div class="gap-block" id="gb_marker" style="height:40px"></div>
</div></div>`;

test('E1 ★실제 오염 hmdtw6g — 아이콘서클이 래퍼 «바로 뒤» row 로 나오고 래퍼엔 도형 1개만 남는다', async ({ page }) => {
  const errs = await boot(page, HMDTW6G);
  const out = await page.evaluate(() => {
    const n = window.__SF.ejectShapeFrameIntruders(document.body);
    const w = document.getElementById('ss_ts0he_hmdtw6g');
    const next = w.nextElementSibling;
    const icb = document.getElementById('icb_1');
    return {
      n,
      wrapKids: [...w.children].map(c => c.id),
      nextIsRow: next?.classList.contains('row') && next.dataset.layout === 'stack',
      rowKids: [...(next?.children || [])].map(c => c.id),
      afterRow: next?.nextElementSibling?.id,
      icbPos: icb.style.position, icbLeft: icb.style.left, icbTop: icb.style.top,
      icbOff: [icb.dataset.offsetX, icb.dataset.offsetY],
      icbWidth: icb.style.width,
    };
  });
  expect(out.n).toBe(1);
  expect(out.wrapKids).toEqual(['shp_1']);
  expect(out.nextIsRow, '꺼낸 맨몸 블록은 .row[data-layout=stack] 로 감싼다').toBe(true);
  expect(out.rowKids).toEqual(['icb_1']);
  // ★표지 gap 이 row «뒤»에 있어야 «바로 뒤»(≠ 맨 끝)가 증명된다
  expect(out.afterRow).toBe('gb_marker');
  expect([out.icbPos, out.icbLeft, out.icbTop]).toEqual(['', '', '']);
  expect(out.icbOff).toEqual([undefined, undefined]);
  expect(out.icbWidth, 'width:100% 는 플로우에서 무해 — 건드리지 않는다').toBe('100%');
  expect(errs).toEqual([]);
});

/* ── 실제 오염 ② proj_1788412243066 / ss_ts0he_wuzqx3u — 부모 .section-merged-part(플로우) ── */
const WUZQX3U = `
<div class="section-block" id="sec2"><div class="section-inner">
  <div class="section-merged-part" id="part1">
    <div class="frame-block" id="ss_ts0he_wuzqx3u" data-free-layout="true" style="${WRAP_STYLE}">
      ${SHAPE('shp_2')}
      <div class="icon-circle-block" id="icb_2" style="position:absolute;left:0;top:20px;width:100%;"></div>
      <div class="frame-block" id="sb_tf" data-text-frame="true" style="background:transparent;width:100%;box-sizing:border-box;"><div class="speech-bubble-block" id="sbb_1"></div></div>
    </div>
    <div class="gap-block" id="gb_marker2"></div>
  </div>
</div></div>`;

test('E2 ★실제 오염 wuzqx3u — 순서 [래퍼, row(아이콘서클), 말풍선 텍스트프레임] 보존, 텍스트프레임 style 불변', async ({ page }) => {
  const errs = await boot(page, WUZQX3U);
  const out = await page.evaluate(() => {
    const tfStyleBefore = document.getElementById('sb_tf').getAttribute('style');
    const n = window.__SF.ejectShapeFrameIntruders(document.body);
    const part = document.getElementById('part1');
    return {
      n,
      order: [...part.children].map(c => (c.classList.contains('row') ? 'ROW:' + [...c.children].map(k => k.id).join(',') : c.id)),
      wrapKids: [...document.getElementById('ss_ts0he_wuzqx3u').children].map(c => c.id),
      tfSame: document.getElementById('sb_tf').getAttribute('style') === tfStyleBefore,
    };
  });
  expect(out.n).toBe(2);
  expect(out.wrapKids).toEqual(['shp_2']);
  expect(out.order).toEqual(['ss_ts0he_wuzqx3u', 'ROW:icb_2', 'sb_tf', 'gb_marker2']);
  expect(out.tfSame).toBe(true);
  expect(errs).toEqual([]);
});

test('E3 중첩 — 자유배치 부모 안 도형래퍼(abs 50,60) 의 abs 자식(10,20) 은 부모 직속 (60,80), 화면 위치 ±1px 유지', async ({ page }) => {
  const errs = await boot(page, `
  <div class="section-block"><div class="section-inner">
    <div class="frame-block" id="P" data-free-layout="true" style="position:relative;width:600px;height:400px;">
      <div class="frame-block" id="W" data-free-layout="true" style="position:absolute;left:50px;top:60px;width:100px;height:100px;">
        ${SHAPE('shp_3')}
        <div class="icon-circle-block" id="icb_3" style="position:absolute;left:10px;top:20px;width:40px;height:40px;"></div>
        <div class="frame-block" id="tf_flow" data-text-frame="true" style="width:80px;height:20px;"></div>
      </div>
    </div>
  </div></div>`);
  const out = await page.evaluate(() => {
    const r0 = document.getElementById('icb_3').getBoundingClientRect();
    const n = window.__SF.ejectShapeFrameIntruders(document.body);
    const icb = document.getElementById('icb_3');
    const tf = document.getElementById('tf_flow');
    const r1 = icb.getBoundingClientRect();
    return {
      n, parent: icb.parentElement.id, left: icb.style.left, top: icb.style.top,
      off: [icb.dataset.offsetX, icb.dataset.offsetY], dx: r1.left - r0.left, dy: r1.top - r0.top,
      tfParent: tf.parentElement.id, tfPos: [tf.style.position, tf.style.left, tf.style.top],
      order: [...document.getElementById('P').children].map(c => c.id),
    };
  });
  expect(out.n).toBe(2);
  expect(out.parent).toBe('P');
  expect([out.left, out.top]).toEqual(['60px', '80px']);
  expect(out.off).toEqual(['60', '80']);
  expect(Math.abs(out.dx)).toBeLessThanOrEqual(1);
  expect(Math.abs(out.dy)).toBeLessThanOrEqual(1);
  // 플로우 자식(텍스트프레임)은 자유배치 부모에선 absolute, 래퍼 바로 아래(top = 60 + 100)
  expect(out.tfParent).toBe('P');
  expect(out.tfPos).toEqual(['absolute', '50px', '160px']);
  expect(out.order).toEqual(['W', 'icb_3', 'tf_flow']);
  expect(errs).toEqual([]);
});

test('E4 멱등 + 음성대조 — 두 번째 실행 0·DOM 무변이 / 깨끗한 래퍼·그룹·배너·텍스트프레임은 안 건드린다', async ({ page }) => {
  const errs = await boot(page, `
  <div class="section-block"><div class="section-inner" id="root">
    <div class="frame-block" id="clean" data-free-layout="true" style="${WRAP_STYLE}">${SHAPE('shp_c')}</div>
    <div class="frame-block" id="grp" data-group="true" data-free-layout="true">${SHAPE('shp_g')}<div class="frame-block" data-text-frame="true" id="grp_tf"></div></div>
    <div class="frame-block" id="ban" data-banner-preset="x" data-free-layout="true">${SHAPE('shp_b')}<div class="icon-circle-block" id="ban_icb"></div></div>
    <div class="frame-block" id="tf" data-text-frame="true">${SHAPE('shp_t')}<div class="text-block" id="tb_t"></div></div>
    <div class="frame-block" id="outer" data-free-layout="true" style="position:relative;">
      <div class="frame-block" id="inner_w" data-free-layout="true" style="position:absolute;left:0;top:0;width:100px;height:100px;">${SHAPE('shp_i')}</div>
      <div class="text-block" id="outer_tb"></div>
    </div>
  </div></div>`);
  const out = await page.evaluate(() => {
    const SF = window.__SF;
    const before = document.body.innerHTML;
    const n1 = SF.ejectShapeFrameIntruders(document.body);
    const n2 = SF.ejectShapeFrameIntruders(document.body);
    return {
      n1, n2, same: document.body.innerHTML === before,
      isClean: SF.isShapeFrame(document.getElementById('clean')),
      isGrp: SF.isShapeFrame(document.getElementById('grp')),
      isBan: SF.isShapeFrame(document.getElementById('ban')),
      isTf: SF.isShapeFrame(document.getElementById('tf')),
      // ★자손 검색 버그 회귀 잠금 — 도형래퍼를 «자손»으로 품은 일반 프레임은 도형 프레임이 아니다
      isOuter: SF.isShapeFrame(document.getElementById('outer')),
      isInner: SF.isShapeFrame(document.getElementById('inner_w')),
    };
  });
  expect(out.n1).toBe(0);
  expect(out.n2).toBe(0);
  expect(out.same, '오염 없으면 DOM 무변이(undo/redo 마다 도는 rebindAll 이 dirty 를 만들면 안 된다)').toBe(true);
  expect(out.isClean).toBe(true);
  expect([out.isGrp, out.isBan, out.isTf]).toEqual([false, false, false]);
  expect(out.isOuter).toBe(false);
  expect(out.isInner).toBe(true);
  expect(errs).toEqual([]);
});

test('E5 래퍼당 도형 1개 — 두 번째 shape-block 은 «자기 래퍼»를 입고 나온다 / 일시 UI 는 지운다', async ({ page }) => {
  const errs = await boot(page, `
  <div class="section-block"><div class="section-inner" id="root">
    <div class="frame-block" id="W2" data-free-layout="true" data-layer-name="rectangle" style="${WRAP_STYLE}">
      ${SHAPE('shp_first')}
      <div class="drop-indicator"></div>
      ${SHAPE('shp_second')}
    </div>
  </div></div>`);
  const out = await page.evaluate(() => {
    const SF = window.__SF;
    const n = SF.ejectShapeFrameIntruders(document.body);
    const w = document.getElementById('W2');
    const s2 = document.getElementById('shp_second');
    const nw = s2.parentElement;
    return {
      n, wKids: [...w.children].map(c => c.id),
      indicators: document.querySelectorAll('.drop-indicator').length,
      nwIsShapeFrame: SF.isShapeFrame(nw), nwIsNext: w.nextElementSibling === nw,
      nwIdNew: nw.id && nw.id !== 'W2', nwLayerName: nw.dataset.layerName,
      nwKids: [...nw.children].map(c => c.id),
      again: SF.ejectShapeFrameIntruders(document.body),
    };
  });
  expect(out.n).toBe(1);
  expect(out.wKids).toEqual(['shp_first']);
  expect(out.indicators).toBe(0);
  expect(out.nwIsShapeFrame).toBe(true);
  expect(out.nwIsNext).toBe(true);
  expect(out.nwIdNew).toBe(true);
  expect(out.nwLayerName).toBe('rectangle');
  expect(out.nwKids).toEqual(['shp_second']);
  expect(out.again).toBe(0);
  expect(errs).toEqual([]);
});

test('R1 resolveInsertFrame · anchorUnitOf', async ({ page }) => {
  const errs = await boot(page, `
  <div class="section-block"><div class="section-inner">
    <div class="frame-block" id="secW" data-free-layout="true">${SHAPE('shp_s')}</div>
    <div class="row" data-layout="stack" id="rowR"><div class="frame-block" id="rowW" data-free-layout="true">${SHAPE('shp_r')}</div></div>
    <div class="frame-block" id="P" data-free-layout="true">
      <div class="frame-block" id="nestW" data-free-layout="true" style="position:absolute;">${SHAPE('shp_n')}</div>
    </div>
  </div></div>`);
  const out = await page.evaluate(() => {
    const SF = window.__SF; const $ = (id) => document.getElementById(id);
    const idOf = (e) => (e === null ? null : e === undefined ? 'undef' : e.id);
    return {
      secLevel: idOf(SF.resolveInsertFrame($('secW'))),
      nested: idOf(SF.resolveInsertFrame($('nestW'))),
      plain: idOf(SF.resolveInsertFrame($('P'))),
      nul: idOf(SF.resolveInsertFrame(null)),
      anchorShape: idOf(SF.anchorUnitOf($('shp_s'))),
      anchorInRow: idOf(SF.anchorUnitOf($('shp_r'))),
      anchorPlain: idOf(SF.anchorUnitOf($('P'))),
      frameOf: idOf(SF.shapeFrameOf($('shp_n'))),
    };
  });
  expect(out).toEqual({
    secLevel: null, nested: 'P', plain: 'P', nul: null,
    anchorShape: 'secW', anchorInRow: 'rowR', anchorPlain: 'P', frameOf: 'nestW',
  });
  expect(errs).toEqual([]);
});

/* ── I: 실제 insertAfterSelected(drag-utils.js 원본) — 유입 차단 ── */
const INSERT_FIXTURE = `
<div class="section-block" id="S"><div class="section-inner" id="SI">
  <div class="frame-block" id="SW" data-free-layout="true" style="${WRAP_STYLE}">${SHAPE('shp_sw')}</div>
  <div class="frame-block" id="P" data-free-layout="true" style="position:relative;width:600px;height:300px;">
    <div class="frame-block" id="NW" data-free-layout="true" style="position:absolute;left:10px;top:10px;width:100px;height:100px;">${SHAPE('shp_nw')}</div>
    <div class="frame-block" id="tf_p" data-text-frame="true" style="position:absolute;left:0;top:200px;"></div>
  </div>
  <div class="gap-block" id="gb_end"></div>
</div></div>`;

test('I1 ★hmdtw6g 경로 — 섹션레벨 도형래퍼가 _activeFrame 이고 아무것도 선택 안 됐어도 래퍼 «안»엔 안 들어간다', async ({ page }) => {
  const errs = await boot(page, INSERT_FIXTURE);
  const out = await page.evaluate(() => {
    window._activeFrame = document.getElementById('SW');
    const el = document.createElement('div'); el.className = 'text-block'; el.id = 'NEW';
    window.__DU.insertAfterSelected(document.getElementById('S'), el);
    return { parent: el.parentElement.id, swKids: document.getElementById('SW').children.length };
  });
  expect(out.swKids).toBe(1);
  expect(out.parent).toBe('SI');
  expect(errs).toEqual([]);
});

test('I2 섹션레벨 도형이 선택된 채 _activeFrame=래퍼 → 새 블록은 래퍼 «바로 뒤»', async ({ page }) => {
  const errs = await boot(page, INSERT_FIXTURE);
  const out = await page.evaluate(() => {
    const W = document.getElementById('SW');
    window._activeFrame = W; document.getElementById('shp_sw').classList.add('selected');
    const el = document.createElement('div'); el.className = 'text-block'; el.id = 'NEW';
    window.__DU.insertAfterSelected(document.getElementById('S'), el);
    return { next: W.nextElementSibling?.id, wKids: W.children.length };
  });
  expect(out.wKids).toBe(1);
  expect(out.next).toBe('NEW');
  expect(errs).toEqual([]);
});

test('I3 자유배치 프레임 안 도형래퍼가 활성 + 도형 선택 → 새 블록은 부모 프레임 «안», 래퍼 바로 뒤(프레임 밖으로 안 튄다)', async ({ page }) => {
  const errs = await boot(page, INSERT_FIXTURE);
  const out = await page.evaluate(() => {
    const NW = document.getElementById('NW');
    window._activeFrame = NW; document.getElementById('shp_nw').classList.add('selected');
    const el = document.createElement('div'); el.className = 'text-block'; el.id = 'NEW';
    window.__DU.insertAfterSelected(document.getElementById('S'), el);
    // 선택 없이 활성만 남은 경우 — 부모 프레임 P 로 해석(래퍼 안 ✗)
    document.getElementById('shp_nw').classList.remove('selected');
    const el2 = document.createElement('div'); el2.className = 'text-block'; el2.id = 'NEW2';
    window.__DU.insertAfterSelected(document.getElementById('S'), el2);
    return { parent: el.parentElement.id, prev: el.previousElementSibling?.id, nwKids: NW.children.length, parent2: el2.parentElement.id };
  });
  expect(out.nwKids).toBe(1);
  expect(out.parent).toBe('P');
  expect(out.prev).toBe('NW');
  expect(out.parent2).toBe('P');
  expect(errs).toEqual([]);
});
