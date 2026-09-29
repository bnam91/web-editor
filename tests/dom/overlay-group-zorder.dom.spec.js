/* overlay-group-zorder.dom.spec.js — 「겹쳐 띄운 블럭을 ⌘G 로 묶고 ⌘[ / ⌘] 로 앞뒤를 바꾼다」
 *
 * ★현빈 2026-09-30 원문 3번: 「오버레이된 블럭들 간 그룹 설정(⌘G), 겹친 요소 간 레이어 순서
 *   변경(⌘[ , ⌘]) — 목적: 원형 쉐이프블럭 오버레이 + 그 위에 텍스트 오버레이를 얹어 그룹으로 묶기」.
 *
 * ★무엇이 없었나 (소스 실측, 2026-09-30)
 *   ⑴ ⌘G  — js/block-factory.js wrapSelectedBlocksInFrame 에는 갈래가 둘뿐이었다:
 *            «자유배치 프레임 안»(좌표 보존) 과 «흐름»(stackY 로 세로 쌓기).
 *            오버레이는 섹션 «직속»이라 자유배치 갈래에 안 걸리고 흐름 갈래로 떨어진다
 *            ⇒ 사용자가 일부러 만든 겹침이 ⌘G 한 번에 위아래로 «풀린다».
 *   ⑵ ⌘[/⌘] — js/editor.js moveSelectedBlocks 의 두 갈래가 각각 closest('.section-inner') 와
 *            closest('.row') 로 단위를 찾는다. 오버레이는 둘 다 없어 «조용히 아무 일도» 안 했다.
 *
 * ★이 검사가 재는 «축» — 화면이다, DOM 인덱스가 아니다.
 *   · 겹침 보존   : 묶기 전후로 두 블럭의 «화면 사각형»이 한 픽셀도 안 움직인다.
 *   · 앞뒤        : 겹친 지점에서 document.elementFromPoint 가 «누구를 집는가».
 *   ⛔「children 순서가 바뀌었다」로만 재면 CSS 가 뒤집혀도 초록이다 — 실제로 겹침은
 *     z-index 가 아니라 DOM 순서로 정해지므로, 그 인과를 브라우저에게 물어야 한다.
 *
 * ⛔앱을 «안» 띄운다 — 함수만 잘라 진짜 크로미움 레이아웃에 올린다(ul-groupdup 과 같은 방식).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-group-zorder
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
/* ★양성대조 — 고치기 «전»의 js 디렉터리를 가리키면 이 다섯이 «빨개져야» 한다.
 *   그래야 이 검사가 증상을 실제로 잡는다는 증거가 된다(안 그러면 「안 재고 있다」와 구분 안 됨).
 *     mkdir -p /tmp/gz-before && git archive HEAD js | tar -x -C /tmp/gz-before
 *     OVERLAY_GZ_JS=/tmp/gz-before/js npx playwright test --config=tests/dom/playwright.dom.config.js overlay-group-zorder
 *   ⚠️CI/기본 실행에선 절대 설정하지 말 것 — 설정되면 아래 배너가 찍힌다. */
const JS_DIR = process.env.OVERLAY_GZ_JS || path.join(REPO, 'js');
if (process.env.OVERLAY_GZ_JS) console.warn(`[overlay-group-zorder] ★양성대조 모드 — js 원본을 ${JS_DIR} 에서 읽는다`);

const SHAPE_FRAME_JS = fs.readFileSync(path.join(JS_DIR, 'shape-frame.js'), 'utf8');
const BF = fs.readFileSync(path.join(JS_DIR, 'block-factory.js'), 'utf8');
const ED = fs.readFileSync(path.join(JS_DIR, 'editor.js'), 'utf8');
const SD = fs.readFileSync(path.join(JS_DIR, 'section-drag.js'), 'utf8');

const WRAP_SRC = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const NEXT_GROUP_SRC = sliceBlock(BF, 'function _nextGroupName(');
const MOVE_SRC = sliceBlock(ED, 'function moveSelectedBlocks(');
const UNGROUP_SRC = sliceBlock(SD, 'function ungroupBlock(');

const HARNESS_JS = `
import { isShapeFrame, shapeFrameOf, topLevelBlocksOf, isEmptyShell } from '/js/shape-frame.js';
let __n = 0;
function makeFrameBlock() {
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = 'ss_new' + (++__n);
  ss.dataset.freeLayout = 'true';
  ss.dataset.width = '860';
  ss.dataset.height = '520';
  ss.style.cssText = 'width:860px;height:520px;min-height:520px;';
  return ss;
}
/* moveSelectedBlocks 는 «맨몸» pushHistory 를 부른다(window. 이 아니다) — 그 이름을 모듈 스코프에 둔다. */
let __hist = [];
function pushHistory(label) { __hist.push(label || ''); }
window.__hist = () => __hist.slice();
window.pushHistory = pushHistory;
window.buildLayerPanel = () => {};
window.scheduleAutoSave = () => {};
window.genId = (p) => p + '_' + (++__n);
window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
window.__toasts = [];
window.showToast = (m) => window.__toasts.push(m);
${NEXT_GROUP_SRC}
${WRAP_SRC}
${MOVE_SRC}
${UNGROUP_SRC}
window.__wrap = wrapSelectedBlocksInFrame;
window.__move = moveSelectedBlocks;
window.__ungroup = ungroupBlock;
window.__ready = true;
`;

/* 앱 규약을 그대로 옮긴다 — 겹침은 «DOM 순서»가 정한다(z-index 를 아무도 안 준다). */
const CSS = `
  * { box-sizing: border-box; } body { margin: 0; }
  .section-block { position: relative; width: 800px; min-height: 400px; }
  .section-inner { display: flex; flex-direction: column; }
  .frame-block { position: relative; max-width: 100%; }
  .frame-block[data-free-layout="true"] { position: relative; }
  .shape-block { width: 100%; height: 100%; background: #4a7; }
  .text-block { width: 100%; height: 100%; background: #fc6; }
  .row { display: flex; }
`;

/* 섹션 하나 + «겹쳐 띄운» 오버레이 둘.
 *   ⑴ 도형 오버레이 — .frame-block 래퍼 > .shape-block   (0,0) 200×200
 *   ⑵ 글자 오버레이 — .frame-block[data-text-frame] > .text-block (60,60) 120×60
 * 둘의 사각형이 (60,60)~(180,120) 에서 겹친다 — 그 점이 아래 elementFromPoint 의 자리다. */
const BODY = `
<div class="section-block" id="sec1">
  <div class="section-inner" id="inner1">
    <div class="row" id="row1"><div class="text-block" id="flow_tb" style="height:30px">흐름</div></div>
  </div>
  <div class="frame-block" id="ov_shape"
       data-overlay-block="true" data-sel-variant="sticker"
       data-offset-x="0" data-offset-y="0"
       style="position:absolute;left:0px;top:0px;width:200px;height:200px;">
    <div class="shape-block" id="sh1"></div>
  </div>
  <div class="frame-block" id="ov_text" data-text-frame="true"
       data-overlay-block="true" data-sel-variant="sticker"
       data-offset-x="60" data-offset-y="60"
       style="position:absolute;left:60px;top:60px;width:120px;height:60px;">
    <div class="text-block" id="tb1">글자</div>
  </div>
</div>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style>
          <script type="module" src="/__harness.js"></script></head><body>${BODY}</body></html>`,
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

/* 겹치는 지점(섹션-로컬 (120,90)) 에서 «위에 그려진 것»을 브라우저에게 묻는다. */
const TOPMOST = `(() => {
  const sec = document.getElementById('sec1').getBoundingClientRect();
  const el = document.elementFromPoint(sec.left + 120, sec.top + 90);
  const host = el?.closest('#ov_shape, #ov_text, .frame-block[data-group="true"]');
  return { hit: el?.id || null, host: host?.id || null };
})()`;

test('O1 ★겹쳐 띄운 둘을 ⌘G — «화면 자리»가 한 픽셀도 안 움직인다(흐름 갈래는 세로로 쌓았다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const rectOf = (id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      const s = document.getElementById('sec1').getBoundingClientRect();
      return { x: Math.round(b.left - s.left), y: Math.round(b.top - s.top), w: Math.round(b.width), h: Math.round(b.height) };
    };
    const before = { shape: rectOf('ov_shape'), text: rectOf('ov_text') };
    document.getElementById('sh1').classList.add('selected');
    document.getElementById('tb1').classList.add('selected');
    window.__wrap({ asGroup: true });
    const after = { shape: rectOf('ov_shape'), text: rectOf('ov_text') };
    const grp = document.querySelector('.frame-block[data-group="true"]');
    return {
      before, after,
      group: grp ? {
        id: grp.id,
        parentId: grp.parentElement.id,
        overlay: grp.dataset.overlayBlock,
        left: grp.style.left, top: grp.style.top,
        w: grp.style.width, h: grp.style.height,
        kids: [...grp.children].map(c => c.id),
      } : null,
      childMarks: ['ov_shape', 'ov_text'].map(id => ({
        id,
        parentId: document.getElementById(id).parentElement.id,
        overlay: document.getElementById(id).dataset.overlayBlock ?? null,
        selVariant: document.getElementById(id).dataset.selVariant ?? null,
      })),
      toasts: window.__toasts.slice(),
    };
  });
  expect(errs).toEqual([]);
  // ★본증상 — 자리가 그대로다. 흐름 갈래로 떨어졌다면 text 가 shape 아래(y=200)로 밀린다.
  expect(r.after.shape).toEqual(r.before.shape);
  expect(r.after.text).toEqual(r.before.text);
  // 그룹이 «섹션 직속 오버레이»로 태어났다
  expect(r.group).not.toBeNull();
  expect(r.group.parentId).toBe('sec1');
  expect(r.group.overlay).toBe('true');
  expect(r.group.left).toBe('0px');
  expect(r.group.top).toBe('0px');
  expect(r.group.w).toBe('200px');
  expect(r.group.h).toBe('200px');
  expect(r.group.kids).toEqual(['ov_shape', 'ov_text']);
  // 자식은 «떠 있다는 표식»을 내려놓는다 — 안 그러면 드래그가 섹션 좌표로 클램프해 좌표가 튄다
  const groupId = r.group.id;
  for (const m of r.childMarks) {
    expect(m.parentId).toBe(groupId);
    expect(m.overlay).toBeNull();
    expect(m.selVariant).toBeNull();
  }
  expect(r.toasts.join('|')).toContain('그룹으로 묶었어요');
});

test('O2 ★그룹을 풀면 «다시 섹션 직속 오버레이»가 된다 — 표식과 좌표가 같이 돌아온다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    const rectOf = (id) => {
      const b = document.getElementById(id).getBoundingClientRect();
      const s = document.getElementById('sec1').getBoundingClientRect();
      return { x: Math.round(b.left - s.left), y: Math.round(b.top - s.top) };
    };
    const before = { shape: rectOf('ov_shape'), text: rectOf('ov_text') };
    document.getElementById('sh1').classList.add('selected');
    document.getElementById('tb1').classList.add('selected');
    window.__wrap({ asGroup: true });
    const grp = document.querySelector('.frame-block[data-group="true"]');
    window.__ungroup(grp);
    return {
      before,
      after: { shape: rectOf('ov_shape'), text: rectOf('ov_text') },
      groupGone: !document.querySelector('.frame-block[data-group="true"]'),
      marks: ['ov_shape', 'ov_text'].map(id => {
        const el = document.getElementById(id);
        return {
          id,
          parentId: el.parentElement.id,
          overlay: el.dataset.overlayBlock ?? null,
          selVariant: el.dataset.selVariant ?? null,
          hasReturn: 'overlayReturnParent' in el.dataset,
          offsetX: el.dataset.offsetX, offsetY: el.dataset.offsetY,
        };
      }),
    };
  });
  expect(errs).toEqual([]);
  expect(r.groupGone).toBe(true);
  expect(r.after).toEqual(r.before);
  for (const m of r.marks) {
    expect(m.parentId).toBe('sec1');
    expect(m.overlay).toBe('true');
    expect(m.selVariant).toBe('sticker');
    expect(m.hasReturn).toBe(true);
  }
  expect(r.marks[0].offsetX).toBe('0');
  expect(r.marks[1].offsetX).toBe('60');
});

test('O3 ★⌘] — 겹친 지점에서 «위에 그려지는 것»이 실제로 바뀐다(뒤에 있던 도형이 앞으로)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate((topSrc) => {
    const top = () => new Function('return ' + topSrc)();
    const before = top();
    // 도형을 골라 ⌘](앞으로) — 흐름 갈래의 방향 규약과 같은 'down'
    document.getElementById('sh1').classList.add('selected');
    window.__move('down');
    const after = top();
    // 다시 ⌘[(뒤로) 로 되돌린다
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    document.getElementById('sh1').classList.add('selected');
    window.__move('up');
    return {
      before, after, back: top(),
      order: [...document.getElementById('sec1').children].map(c => c.id),
      hist: window.__hist(),
    };
  }, TOPMOST);
  expect(errs).toEqual([]);
  // 처음엔 «DOM 뒤»인 글자가 위에 있다
  expect(r.before.host).toBe('ov_text');
  // ⌘] 뒤엔 도형이 위다 — 브라우저가 그렇게 그린다
  expect(r.after.host).toBe('ov_shape');
  // ⌘[ 로 되돌아온다
  expect(r.back.host).toBe('ov_text');
  expect(r.order).toEqual(['inner1', 'ov_shape', 'ov_text']);
  expect(r.hist.length).toBe(2);
});

/* ⚠️O4·O5 는 «증상 계측기»가 아니다 — 고치기 전에도 초록이다(그때는 «해당 없음»이라 안 돌았고,
 *   지금은 «할 일이 없다»라서 안 돈다. 결과가 같고 까닭이 다르다).
 *   둘은 그물이다: 새 갈래가 남의 ⌘[ 를 훔치거나, 끝에서 히스토리를 쌓는 회귀를 문다.
 *   증상을 재는 것은 O1·O2·O3 셋이고, 그 셋이 양성대조에서 실제로 빨개진다(파일 머리말). */
test('O4 ★맨 끝에서는 «아무 일도 안 한다» — 히스토리도 안 쌓인다(먹통과 구분되는 자리)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    // 글자가 이미 맨 앞(DOM 맨 뒤)이다 — ⌘] 는 할 일이 없다
    document.getElementById('tb1').classList.add('selected');
    window.__move('down');
    const a = { order: [...document.getElementById('sec1').children].map(c => c.id), hist: window.__hist().length };
    // 도형은 맨 뒤다 — ⌘[ 도 할 일이 없다
    document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
    document.getElementById('sh1').classList.add('selected');
    window.__move('up');
    const b = { order: [...document.getElementById('sec1').children].map(c => c.id), hist: window.__hist().length };
    return { a, b };
  });
  expect(errs).toEqual([]);
  expect(r.a.order).toEqual(['inner1', 'ov_shape', 'ov_text']);
  expect(r.a.hist).toBe(0);
  expect(r.b.order).toEqual(['inner1', 'ov_shape', 'ov_text']);
  expect(r.b.hist).toBe(0);
});

test('O5 ★흐름 블럭은 «영향 없음» — 오버레이 갈래가 남의 ⌘[ 를 가로채지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(() => {
    document.getElementById('flow_tb').classList.add('selected');
    window.__move('up');   // .row 가 하나뿐이라 흐름 갈래에서 «맨 위»로 걸려 되돌아간다
    return {
      secOrder: [...document.getElementById('sec1').children].map(c => c.id),
      innerOrder: [...document.getElementById('inner1').children].map(c => c.id),
      hist: window.__hist().length,
    };
  });
  expect(errs).toEqual([]);
  expect(r.secOrder).toEqual(['inner1', 'ov_shape', 'ov_text']);
  expect(r.innerOrder).toEqual(['row1']);
  expect(r.hist).toBe(0);
});
