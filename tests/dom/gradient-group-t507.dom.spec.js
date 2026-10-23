/* gradient-group-t507.dom.spec.js — t5-07 「그라데이션블럭과 에셋 블럭 현재 그룹설정이 안되는지?」 (S3 · 261022)
 *   ⌘G(wrapSelectedBlocksInFrame) 가 «골라진» 블럭을 정말 묶는가 — 갈래별로 «행위»를 잰다(명부 단언은 block-selector-roster 가 한다).
 *   ★바닥(aefbabde)에서 빨강이어야 하는 칸: B1 B2 B3 M1 M3 — 그라데이션·모달·스티커가 ⌘G 수집 명부(block-factory BLOCK_SEL)에 없어 «조용히 빠진다».
 *   ⚠️M2(말풍선)는 바닥에서도 초록이다 — 말풍선의 진짜 클래스는 'text-block speech-bubble-block'(block-factory.js makeSpeechBubbleBlock)이라
 *     옛 명부가 .text-block 으로 이미 잡는다(261023 바닥 앱 실측). 첫 판 장면은 클래스를 하나만 적어 바닥 빨강을 «거짓으로» 냈다(S3 흠).
 *   ★바닥에서도 초록이어야 하는 칸: R1 R2(회귀 · 에셋 조합은 원래 된다).
 *   B3 의 기대(흐름 에셋 + 그라데이션 = 묶지 않고 까닭 한 줄)는 t5-07 판정 ③(흐름 블럭+떠 있는 블럭 새 갈래 = t5-08 (a) 현빈 칸)을 따른다.
 *   ⛔앱을 «안» 띄운다 — frame-float-group 하네스와 같이 wrapSelectedBlocksInFrame «하나만» 잘라 싣는다.
 *   양성대조: T507_JS=<바닥 판 js 디렉터리> 로 같은 칸이 옛 판을 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/gradient-group-t507.dom.spec.js */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock, assertDepsProvided } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const JS_DIR = process.env.T507_JS || path.join(REPO, 'js');
if (process.env.T507_JS) console.warn(`[gradient-group-t507] ★양성대조 모드 — js 를 ${JS_DIR} 에서 읽는다`);

const BF = fs.readFileSync(path.join(JS_DIR, 'block-factory.js'), 'utf8');
const ED = fs.readFileSync(path.join(JS_DIR, 'editor.js'), 'utf8');
const WRAP_SRC = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const NEXT_GROUP_SRC = sliceBlock(BF, 'function _nextGroupName(');
/* 정본 명부(editor.js SECTION_BLOCK_TYPE_SEL)를 같은 자리에서 읽어 window 에 싣는다 — 파생된 판이 그것을 읽어도 하네스가 산다(바닥 판은 안 읽는다). */
const SSOT = (ED.match(/const SECTION_BLOCK_TYPE_SEL = \[[\s\S]*?\]\.join\(', '\);/) || [''])[0];

const WRAP_JS = `
import { isShapeFrame, shapeFrameOf, topLevelBlocksOf, isEmptyShell } from '/js/shape-frame.js';
${SSOT}
window.SECTION_BLOCK_TYPE_SEL = typeof SECTION_BLOCK_TYPE_SEL === 'string' ? SECTION_BLOCK_TYPE_SEL : undefined;
let __n = 0;
function makeFrameBlock() {
  const ss = document.createElement('div');
  ss.className = 'frame-block'; ss.id = 'ss_new' + (++__n);
  ss.dataset.freeLayout = 'true'; ss.dataset.width = '860'; ss.dataset.height = '520';
  ss.style.cssText = 'width:860px;height:520px;min-height:520px;';
  return ss;
}
window.__hist = [];
window.pushHistory = (l) => window.__hist.push(l || '');
window.buildLayerPanel = () => {};
window.scheduleAutoSave = () => {};
window.genId = (p) => p + '_' + (++__n);
window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
window.__toasts = [];
window.showToast = (m) => window.__toasts.push(String(m));
${NEXT_GROUP_SRC}
${WRAP_SRC}
window.__wrap = wrapSelectedBlocksInFrame;
/* ★U2 렌더러 칸 — 진짜 렌더러를 싣는다(cssText 를 dataset.x/y 로 통째로 다시 쓰는 그 함수). 못 실으면 __rendErr 에 남긴다(⛔조용히 건너뛰지 않는다). */
window.__rendErr = [];
try { await import('/js/blocks/gradient-block.js'); } catch (e) { window.__rendErr.push('gradient ' + e); }
try { await import('/js/blocks/sticker-block.js'); } catch (e) { window.__rendErr.push('sticker ' + e); }
window.__ready = true;
`;

/* ★파생 가드(tests/unit/slice-harness-deps-roster SHD2) — 조각이 부르는 외부 import 이름을 하네스가 다 주나.
 *   이 하네스는 «모듈»로 심어 shape-frame.js 넷을 진짜 import 로 준다 ⇒ 그 import 줄에서 이름을 떠 «준 것»으로 센다(⛔이름을 손으로 적지 않는다).
 *   genId · showToast 는 window.* 로 준다(declaresName 이 그 꼴을 읽는다). */
const _IMPORTED = [...WRAP_JS.matchAll(/^import\s*\{([^}]*)\}\s*from/gm)].flatMap(m => m[1].split(',').map(x => x.trim()).filter(Boolean));
assertDepsProvided(WRAP_SRC, BF, WRAP_JS + _IMPORTED.map(n => `\nconst ${n} = /* import */ 0;`).join(''), 'gradient-group-t507 하네스(wrapSelectedBlocksInFrame)');
assertDepsProvided(NEXT_GROUP_SRC, BF, WRAP_JS, 'gradient-group-t507 하네스(_nextGroupName)');

const CSS = `* { box-sizing: border-box; } body { margin: 0; }
  .section-block { position: relative; width: 860px; min-height: 1400px; }
  .section-inner { display: flex; flex-direction: column; }
  .frame-block { position: relative; max-width: 100%; }
  .gradient-block, .sticker-block { position: absolute; }`;

/* 흐름: 에셋 · 글자 · 모달 · 말풍선 · 자유배치 프레임 / 섹션 직속 떠 있음: 그라데이션 · 스티커(dataset.x/y 정본) · 오버레이 에셋 · 오버레이 글자 */
const BODY = `
<div class="section-block" id="sec1">
  <div class="section-inner" id="inner1">
    <div class="row" id="rowA"><div class="asset-block" id="ab_flow" style="height:120px">에셋</div></div>
    <div class="row" id="rowT"><div class="text-block" id="tb_flow" style="height:40px">흐름 글자</div></div>
    <div class="row" id="rowM"><div class="modal-block" id="mdl1" style="height:80px">모달</div></div>
    <div class="row" id="rowS"><div class="text-block speech-bubble-block" id="sbb1" style="height:60px">말풍선</div></div>
    <div class="frame-block" id="ssA" data-free-layout="true" style="width:860px;height:400px;margin:0 auto;">
      <div class="mockup-block" id="mkp1" style="position:absolute;left:174px;top:0;width:300px;height:300px;"></div>
    </div>
  </div>
  <div class="gradient-block" id="grad1" data-x="100" data-y="300" style="left:100px;top:300px;width:400px;height:200px;"></div>
  <div class="sticker-block" id="stk1" data-x="600" data-y="320" style="left:600px;top:320px;width:120px;height:120px;"></div>
  <div class="zoom-block" id="zmb1" data-x="500" data-y="700" style="position:absolute;left:500px;top:700px;width:160px;height:160px;"></div>
  <div class="asset-block" id="abOv" data-overlay-block="true" data-offset-x="40" data-offset-y="1000"
       style="position:absolute;left:40px;top:1000px;width:200px;height:120px;">오버레이 에셋</div>
  <div class="frame-block" id="ovT" data-text-frame="true" data-overlay-block="true" data-sel-variant="sticker"
       data-offset-x="300" data-offset-y="1100" style="position:absolute;left:300px;top:1100px;width:120px;height:40px;">
    <div class="text-block" id="tbOv">오버레이</div>
  </div>
</div>`;

function route(page, harnessHtml, extra = {}) {
  return page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    if (u.pathname === '/__h.html') return r.fulfill({ contentType: 'text/html', body: harnessHtml });
    if (extra[u.pathname]) return r.fulfill({ contentType: 'application/javascript', body: extra[u.pathname] });
    let f;
    if (u.pathname.startsWith('/js/')) f = path.join(JS_DIR, u.pathname.slice(4));
    if (!f || !fs.existsSync(f)) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: 'application/javascript', body: fs.readFileSync(f) });
  });
}
async function bootWrap(page) {
  await route(page, `<!doctype html><html><head><meta charset="utf-8"><style>${CSS}</style>
    <script type="module" src="/__wrap.js"></script></head><body>${BODY}</body></html>`, { '/__wrap.js': WRAP_JS });
  const errs = []; page.on('pageerror', e => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__h.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}
/* 고르고 ⌘G — 고른 것의 «섹션 기준 화면 자리»를 전·후로 찍는다 */
const groupOf = (page, ids) => page.evaluate((ids) => {
  const s = document.getElementById('sec1').getBoundingClientRect();
  const rect = (id) => { const b = document.getElementById(id).getBoundingClientRect(); return [Math.round(b.left - s.left), Math.round(b.top - s.top)]; };
  const before = Object.fromEntries(ids.map(id => [id, rect(id)]));
  ids.forEach(id => document.getElementById(id).classList.add('selected'));
  window.__wrap({ asGroup: true });
  const groups = [...document.querySelectorAll('.frame-block[data-group="true"]')];
  const parentOf = (id) => { const p = document.getElementById(id).parentElement; return p.id || p.className; };
  const groupOfId = (id) => { const g = document.getElementById(id).closest('.frame-block[data-group="true"]'); return g ? g.id : null; };
  return { groups: groups.length, parents: Object.fromEntries(ids.map(id => [id, parentOf(id)])), inGroup: Object.fromEntries(ids.map(id => [id, groupOfId(id)])),
    before, after: Object.fromEntries(ids.map(id => [id, rect(id)])), toasts: window.__toasts.slice() };
}, ids);
const OK_TOAST = /개를 그룹으로 묶었어요/;

test('B1 ★그라데이션 + 오버레이 에셋 → 한 그룹에 둘 다 · 그라데이션 화면 자리 그대로 · 성공 한 줄', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['grad1', 'abOv']);
  expect(r.groups, '그룹 하나').toBe(1);
  expect(r.inGroup.grad1, '★그라데이션이 그룹 안에 — 바닥은 «조용히 빠진다»').not.toBeNull();
  expect(r.inGroup.grad1).toBe(r.inGroup.abOv);
  expect(r.after.grad1, '그라데이션 화면 자리').toEqual(r.before.grad1);
  expect(r.toasts.length, 'QA ⑴ 토스트는 성공 한 줄뿐').toBe(1);
  expect(r.toasts[0]).toMatch(OK_TOAST);
  expect(errs).toEqual([]);
});
test('B2 ★그라데이션 + 흐름 자유배치 프레임 하나 → 그라데이션이 프레임 «안»으로 · 화면 자리 그대로(줌 선례 :2361 꼴)', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['ssA', 'grad1']);
  expect(r.parents.grad1, '★그라데이션 부모 = 그 프레임 — 바닥은 «조용히 빠진다»').toBe('ssA');
  expect(r.after.grad1, '그라데이션 화면 자리').toEqual(r.before.grad1);
  expect(r.toasts.length, 'QA ⑴ 토스트 한 줄').toBe(1);
  expect(errs).toEqual([]);
});
test('B3 ★흐름 에셋 + 그라데이션 → 묶지 않고 까닭 한 줄(흐름+떠 있음 새 갈래 = t5-08 (a) 현빈 칸) · 에셋을 홀로 묶지 않는다', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['ab_flow', 'grad1']);
  expect(r.groups, '★그룹 0 — 바닥은 에셋 «하나만» 묶고 그라데이션을 조용히 뺀다').toBe(0);
  expect(r.parents.grad1).toBe('sec1');
  expect(r.parents.ab_flow).toBe('rowA');
  expect(r.toasts.length).toBe(1);
  expect(r.toasts[0]).toContain('자유배치 프레임 하나');
  expect(errs).toEqual([]);
});
test('R1 (회귀) 오버레이 에셋 + 오버레이 글자 → 한 그룹 · 성공 한 줄', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['abOv', 'tbOv']);
  expect(r.groups).toBe(1);
  expect(r.inGroup.abOv).not.toBeNull();
  expect(r.inGroup.abOv).toBe(r.inGroup.tbOv);
  expect(r.toasts.length).toBe(1);
  expect(r.toasts[0]).toMatch(OK_TOAST);
  expect(errs).toEqual([]);
});
test('R2 (회귀) 흐름 에셋 + 흐름 글자 → 한 그룹 · 성공 한 줄', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['ab_flow', 'tb_flow']);
  expect(r.groups).toBe(1);
  expect(r.inGroup.ab_flow).not.toBeNull();
  expect(r.inGroup.ab_flow).toBe(r.inGroup.tb_flow);
  expect(r.toasts.length).toBe(1);
  expect(r.toasts[0]).toMatch(OK_TOAST);
  expect(errs).toEqual([]);
});
for (const [cell, id, what] of [['M1', 'mdl1', '모달'], ['M2', 'sbb1', '말풍선']]) {
  test(`${cell} ★${what}(흐름) + 흐름 글자 → 한 그룹에 둘 다(파생의 부작용 칸 — 판정 ① (가))`, async ({ page }) => {
    const errs = await bootWrap(page);
    const r = await groupOf(page, [id, 'tb_flow']);
    expect(r.groups).toBe(1);
    expect(r.inGroup[id], `★${what}이 그룹 안에 — 바닥은 «조용히 빠진다»`).not.toBeNull();
    expect(r.inGroup[id]).toBe(r.inGroup.tb_flow);
    expect(r.toasts.length).toBe(1);
    expect(errs).toEqual([]);
  });
}
test('M3 ★스티커(그라데이션과 같은 «제 방식 떠 있음») + 오버레이 에셋 → 한 그룹에 둘 다 · 자리 그대로(판정 ① (가) 조건부 칸)', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['stk1', 'abOv']);
  expect(r.groups).toBe(1);
  expect(r.inGroup.stk1, '★스티커가 그룹 안에 — 바닥은 «조용히 빠진다»').not.toBeNull();
  expect(r.inGroup.stk1).toBe(r.inGroup.abOv);
  expect(r.after.stk1).toEqual(r.before.stk1);
  expect(r.toasts.length).toBe(1);
  expect(errs).toEqual([]);
});

/* ── U2 렌더러 칸(261023 · 지디 GO 뒤) ─────────────────────────────────────────
 *   «묶였다»만으로는 모자란다 — 렌더러(renderGradientBlock)가 cssText 를 dataset.x/y 로 «통째로 다시 쓴다».
 *   ⇒ 묶은 «뒤» 진짜 렌더러를 한 번 더 돌려도 화면 자리가 그대로여야 한다(정본째 옮겼나).
 *   ⛔이 칸들은 끌기(U3 · 대기)·섹션 클립(--sec-clip · t5-08 (b))·저장→다시 열기를 «안» 잰다. */
const renderedRect = (page, id) => page.evaluate((id) => {
  const el = document.getElementById(id), s = document.getElementById('sec1').getBoundingClientRect();
  if (el.classList.contains('gradient-block')) window.renderGradientBlock(el);
  if (el.classList.contains('sticker-block')) window.renderStickerBlock(el);
  const b = el.getBoundingClientRect();
  return { at: [Math.round(b.left - s.left), Math.round(b.top - s.top)], ds: [el.dataset.x, el.dataset.y], rendErr: window.__rendErr.slice() };
}, id);
async function bootRendered(page) {
  const errs = await bootWrap(page);
  /* 바닥 모습을 진짜 렌더러로 먼저 그린다 — 손으로 적은 style 이 아니라 렌더러가 낸 자리에서 시작 */
  const pre = await page.evaluate(() => {
    ['grad1'].forEach(id => window.renderGradientBlock?.(document.getElementById(id)));
    return { rendErr: window.__rendErr.slice(), hasGrad: typeof window.renderGradientBlock === 'function' };
  });
  expect(pre.rendErr, '장면 미성립 — 렌더러를 못 실었다').toEqual([]);
  expect(pre.hasGrad, '장면 미성립 — renderGradientBlock 없음').toBe(true);
  return errs;
}
test('RG1 ★그라데이션 + 오버레이 에셋 묶은 뒤 렌더러를 다시 돌려도 자리 그대로(dataset.x/y = 그룹 기준)', async ({ page }) => {
  const errs = await bootRendered(page);
  const r = await groupOf(page, ['grad1', 'abOv']);
  expect(r.inGroup.grad1, '전제 — 묶였다').not.toBeNull();
  const g = await renderedRect(page, 'grad1');
  expect(g.at, '★렌더 뒤 화면 자리 = 묶기 전 자리(정본째 옮겼나)').toEqual(r.before.grad1);
  expect(errs).toEqual([]);
});
test('RG2 ★그라데이션 + 흐름 자유배치 프레임 — 프레임 안으로 넣은 뒤 렌더러를 다시 돌려도 자리 그대로', async ({ page }) => {
  const errs = await bootRendered(page);
  const r = await groupOf(page, ['ssA', 'grad1']);
  expect(r.parents.grad1, '전제 — 프레임 안').toBe('ssA');
  const g = await renderedRect(page, 'grad1');
  expect(g.at, '★렌더 뒤 화면 자리').toEqual(r.before.grad1);
  expect(errs).toEqual([]);
});
test('RG3 ★그룹 «안»에서 다시 ⌘G(중첩 · 자유배치 갈래) — 그라데이션 렌더 뒤 자리 그대로', async ({ page }) => {
  const errs = await bootRendered(page);
  const r1 = await groupOf(page, ['grad1', 'abOv', 'tbOv']);
  expect(r1.groups, '전제 — 첫 묶기').toBe(1);
  /* 그룹 안에서 그라데이션 + 오버레이 글자만 다시 — allInSameFreeFrame 갈래.
     ★안쪽 상자 원점(min x)이 바깥 그룹 원점과 달라야 한다 — 같으면 밀 양이 0 이라 «정본을 안 민 판»과 못 가른다(261023 mE 가 초록으로 알려 줌). */
  const r2 = await groupOf(page, ['grad1', 'tbOv']);
  expect(r2.groups, '전제 — 중첩 그룹 둘').toBe(2);
  expect(r2.inGroup.grad1, '★그라데이션이 «새» 안쪽 그룹에 — 바닥은 처음부터 안 묶여 이 칸이 빈 초록이 된다').not.toBe(r1.inGroup.grad1);
  expect(r2.inGroup.grad1).toBe(r2.inGroup.tbOv);
  const shift = await page.evaluate(() => parseInt(document.getElementById('grad1').closest('.frame-block[data-group="true"]').style.left, 10));
  expect(shift, '장면 미성립 — 안쪽 그룹 원점이 0 이면 밀 양이 0').not.toBe(0);
  const g = await renderedRect(page, 'grad1');
  expect(g.at, '★중첩 묶기 + 렌더 뒤 화면 자리').toEqual(r1.before.grad1);
  expect(errs).toEqual([]);
});
test('RS1 ★스티커 + 오버레이 에셋 — 진짜 스티커 렌더러를 다시 돌려도 자리 그대로(판정 ① (가) 조건 칸)', async ({ page }) => {
  const errs = await bootRendered(page);
  const pre = await page.evaluate(() => { window.renderStickerBlock(document.getElementById('stk1')); return typeof window._translateSticker; });
  expect(pre, '장면 미성립 — _translateSticker 없음').toBe('function');
  const r = await groupOf(page, ['stk1', 'abOv']);
  expect(r.inGroup.stk1, '전제 — 묶였다').not.toBeNull();
  expect(r.after.stk1, '묶은 직후 자리').toEqual(r.before.stk1);
  const g = await renderedRect(page, 'stk1');
  expect(g.at, '★렌더 뒤 화면 자리').toEqual(r.before.stk1);
  expect(errs).toEqual([]);
});
test('Z1 (부작용 관찰 · 성질 파생) 줌 + 오버레이 에셋 → 한 그룹 · 자리 그대로', async ({ page }) => {
  const errs = await bootWrap(page);
  const r = await groupOf(page, ['zmb1', 'abOv']);
  expect(r.groups).toBe(1);
  expect(r.inGroup.zmb1, '★줌이 그룹 안에').not.toBeNull();
  expect(r.inGroup.zmb1).toBe(r.inGroup.abOv);
  expect(r.after.zmb1, '줌 화면 자리').toEqual(r.before.zmb1);
  expect(r.toasts.length).toBe(1);
  expect(errs).toEqual([]);
});
