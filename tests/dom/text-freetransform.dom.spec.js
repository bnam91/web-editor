/* text-freetransform.dom.spec.js — 글상자 ★자유변형 ★U2(«렌더 배선» · ⛔핸들 없음)
 *   (2026-10-23 · 지디 발주 `ORDER-u2-text-ft-ui-261023.md` §3·§4 · 설계 `PLAN-text-freetransform-impl.md` §481)
 *
 * ★재는 것 — ★발주 §3 이 가리킨 ★정본 §481 의 ★15 ★그대로(⛔새 단언을 발명하지 않았다):
 *   `P3` · `PRE-IDENTITY` · `NegA_pixel_same` · `NegB_origin` · `NegC_tb_no_transform` ·
 *   `J_roundtrip` · `D_box_real` · `NoFreeze_fontsize` · `NoNumberField` · `NoNumberField_neg` ·
 *   `Registry_mirror` · `W_three_equal` · `W_neighbor_unmoved` · `W_neighbor_premise` · `W_esc_zero_wrap`
 *   ＋ ★현빈 QA 두 칸(발주 §4) — `QA-1` 불필요한 프롭힌트 0 · `QA-2` 디자인 일관
 *   ⛔U3 의 것은 ★없다(핸들 12 · 모서리 끌기 · 묶임 · 회전 동거 · `Shared_HALF_derived`).
 *
 * ★★전제 단언을 ★먼저 건다(발주 §3 ⒜) — 「…에서」라 이름 붙인 칸은 ★재기 «전»에 그 조건을 단언한다.
 *   까닭: U1 에서 ★조정자가 건 단언이 ★항등식이어서 ★아무것도 안 잠근 일이 있었다(발주 정정 ⑫).
 *   ⇒ `PRE-IDENTITY`(변형 0 임) · `W_neighbor_premise`(이웃이 정말 뒤에 있다 ＋ ★양성대조) ·
 *     `NegC` 의 「회전 0」(`dataset.rotation` 없다) 를 ★그 칸 안에서 먼저 단언한다.
 *
 * ★장면은 ★앱 입구로만 만든다 — `addSection()` · `selectSection()` · `addTextBlock()` ·
 *   `makeShapeBlock()` · `makeAssetBlock()`. ⛔손으로 DOM 을 지어 장면을 만들지 않는다
 *   (⇒ 「그 꼴이 앱에서 생기나」가 ★구성상 참이다 · 실측 261023: `addSection()` 혼자서도
 *     글상자 하나를 만들고, 글상자 ★뒤에 블럭이 오는 것이 ★앱의 기본 꼴이다).
 *
 * ⛔고정 대기 0 — `waitForFunction`/`expect.poll`/`toPass` 로 «무엇을 기다리나»를 쓴다
 *   (잠그는 자 = tests/unit/dom-fixed-wait-census.test.mjs).
 * ⛔「0건」을 ★금지단언만으로 닫지 않는다 — 칸마다 ★반례·양성대조를 한 쌍으로 건다
 *   (선례 = tests/dom/fx-particles-panel.dom.spec.js D10 · tests/dom/checker-section-tone.dom.spec.js S8).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/text-freetransform.dom.spec.js --workers=1
 * ★양성대조(판을 갈아 끼운다): GD1001_ROOT=<fc487b3d 를 뽑은 경로> 로 같은 벌을 돌리면
 *   그 판엔 `js/effects-freetransform.js` 가 ★없으므로 ★전부 빨강이어야 한다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, ROOT } = require('./_root-harness.js');

/* ── 장면 ──────────────────────────────────────────────────────────────
   `ftTB`  우리 글상자(h1) · `ftTF` 그 text-frame 래퍼
   `ftNB`  ★이웃 — 흐름상 ★바로 뒤의 글상자(body)   ← `W_neighbor_*` 가 쓴다
   `ftOTB` ★손 안 댄 둘째 글상자                     ← `NegA_pixel_same` · `NoNumberField_neg` 가 쓴다
   `ftSH`/`ftAS`/`ftFR` 도형·에셋·프레임             ← `Registry_mirror` 가 쓴다 */
async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1600 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    document.querySelectorAll('.section-block').forEach(s => s.remove());
    window.addSection();
    const sec = document.querySelector('.section-block');
    sec.id = 'ftS';
    /* ★앱 입구로만 — 섹션을 ★다시 고르면 다음 블럭이 ★뒤에 붙는다(insertAfterSelected). */
    window.selectSection(sec); window.addTextBlock('h1');
    window.selectSection(sec); window.addTextBlock('body');
    window.selectSection(sec); window.addTextBlock('h1');
    const tfs = [...sec.querySelectorAll('.frame-block[data-text-frame="true"]')];
    /* tfs[0] = addSection 이 스스로 만든 글상자 · [1] 우리 것 · [2] 이웃 · [3] 손 안 댄 것 */
    tfs[1].id = 'ftTF'; tfs[1].querySelector('.text-block').id = 'ftTB';
    tfs[2].id = 'ftNB';
    tfs[3].querySelector('.text-block').id = 'ftOTB';
    for (const [id, txt] of [['ftTB', '온풍기 맥스'], ['ftOTB', '보온 텀블러']]) {
      const g = document.querySelector(`#${id} [class^="tb-"]`);
      g.textContent = txt; delete g.dataset.isPlaceholder;
    }
    /* 도형·에셋·프레임 — `Registry_mirror` 의 거울 */
    const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'ftAS';
    const row = document.createElement('div'); row.className = 'row'; row.id = 'ftR'; row.dataset.layout = 'stack';
    row.appendChild(ab); sec.querySelector('.section-inner').appendChild(row);
    const { block: sb } = window.makeShapeBlock('rectangle'); sb.id = 'ftSH';
    const fr = document.createElement('div'); fr.className = 'frame-block'; fr.id = 'ftFR';
    fr.dataset.width = '100'; fr.dataset.height = '100'; fr.style.width = '100px'; fr.style.height = '100px';
    fr.appendChild(sb);
    const row2 = document.createElement('div'); row2.className = 'row'; row2.id = 'ftR2'; row2.dataset.layout = 'stack';
    row2.appendChild(fr); sec.querySelector('.section-inner').appendChild(row2);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
  });
  await page.waitForFunction(() => !!document.querySelector('#ftTB [class^="tb-"]')
    && !!document.getElementById('ftNB') && !!document.getElementById('ftOTB')
    && !!document.getElementById('ftSH') && !!document.getElementById('ftAS'));
  await settle(page, 'ftTB');
  return errs;
}

/** 그 요소의 화면 자리가 «멈출 때까지» — 배율 맞추기가 몇 프레임 뒤에 자리 잡는다(선례 effects-glow setup). */
const settle = (page, id) => page.waitForFunction((id) => {
  const e = document.getElementById(id); if (!e) return false;
  const r = e.getBoundingClientRect();
  const k = [r.left, r.top, r.width, r.height].map(Math.round).join(',');
  const w = (window.__ftSettle ||= {});
  if (w[id] === k) { w[id + '#'] = (w[id + '#'] || 0) + 1; } else { w[id] = k; w[id + '#'] = 0; }
  return w[id + '#'] >= 5;
}, id, { polling: 'raf' });

const PANEL_OF = { ftTB: 'txt', ftOTB: 'txt', ftSH: 'shape', ftAS: 'asset' };
/** 블럭을 ★진짜 마우스로 고른다 — 그 블럭의 Effects 절이 뜰 때까지(선례 effects-glow `pick`). */
const pick = async (page, id) => {
  await expect(async () => {
    await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
    await settle(page, id);
    const p = await page.evaluate((id) => { const q = document.getElementById(id).getBoundingClientRect(); return [q.left + 6, q.top + q.height / 2]; }, id);
    await page.evaluate(() => { window.deselectAll?.(); ['txt', 'shape', 'asset'].forEach(P => document.getElementById(`${P}-fx-section`)?.remove()); });
    await page.mouse.click(p[0], p[1]);
    await page.waitForFunction(([id, P]) => document.getElementById(id).classList.contains('selected') && !!document.getElementById(`${P}-fx-section`),
      [id, PANEL_OF[id]], { timeout: 3000 });
  }).toPass({ timeout: 20000 });
};

/** 「이펙트 → 자유변형」을 ★패널에서 고른다(사람이 하는 그 두 걸음). */
const addFt = async (page, P = 'txt') => {
  await page.selectOption(`#${P}-fx-add`, 'freetransform');
  await page.waitForFunction((P) => !!document.getElementById(`${P}-fxft-card`), P);
};

/** 글자칸·박스·이웃의 수를 한 번에 — ⛔칸마다 다른 자를 쓰지 않는다(자가 둘이면 수가 갈린다). */
const read = (page, id = 'ftTB') => page.evaluate((id) => {
  const tb = document.getElementById(id);
  const tf = tb.closest('.frame-block[data-text-frame="true"]');
  const g = tb.querySelector('[class^="tb-"]');
  const r = document.createRange(); r.selectNodeContents(g);
  const gr = r.getBoundingClientRect(); r.detach?.();
  const cs = getComputedStyle(g), cst = getComputedStyle(tb);
  const nb = document.getElementById('ftNB');
  const tbr = tb.getBoundingClientRect();
  const rd = (v) => Math.round(v * 100) / 100;
  return {
    corners: tb.dataset.tfCorners || null,
    glyphTransform: cs.transform, glyphOrigin: cs.transformOrigin,
    fontSize: cs.fontSize, color: cs.color, fontWeight: cs.fontWeight, lineHeight: cs.lineHeight,
    tbTransform: cst.transform, tbOutline: cst.outlineWidth + ' ' + cst.outlineStyle + ' ' + cst.outlineColor,
    /* ★★파란 아웃라인은 ★`.text-block` 이 ★아니라 ★★tf 가 그린다 — 실측 261023:
       `css/editor-blocks.css:2131~2134` `.frame-block[data-text-frame="true"]:has(.text-block.selected)`
       가 `outline: var(--sel-outline-w) solid var(--sel-color)` 를 걸고,
       `:2146~2149`(T6 「outline 2겹 픽스」)가 `.text-block.selected` 의 것을 ★transparent 로 되돌린다.
       ⇒ ★발주·설계가 적은 ⒞ 「`.text-block` 이 파란 아웃라인」은 ★래퍼가 있는 꼴에서 ★사실과 다르다.
         ★그래서 ★㉣(둘 다에 같은 폭)가 ★더 필요하다 — ★보이는 아웃라인이 ★tf 의 것이므로. */
    tfOutline: (() => { const c = getComputedStyle(tf); return c.outlineWidth + ' ' + c.outlineStyle + ' ' + c.outlineColor; })(),
    tbW: rd(tbr.width), tbH: rd(tbr.height), tfW: rd(tf.getBoundingClientRect().width),
    glyphBox: { w: rd(gr.width), h: rd(gr.height), left: rd(gr.left), top: rd(gr.top) },
    /* ★스크롤을 ★같이 찍는다 — `pick()` 이 `scrollIntoView` 를 하므로 ★뷰포트 좌표만 보면
       ★스크롤 이동이 ★「글자가 움직였다」로 ★둔갑한다(261023 ★내 첫 빨강이 그것이었다 · Δ498px). */
    scroll: [Math.round(window.scrollX), Math.round(window.scrollY)],
    tbLeft: rd(tbr.left), tbTop: rd(tbr.top),
    nbTop: nb ? rd(nb.getBoundingClientRect().top) : null,
    state: window.ftStateOf(tb),
    rotation: tb.dataset.rotation ?? null,
    tfRotation: tf.dataset.rotation ?? null,
  };
}, id);

/** `matrix3d(...)`/`matrix(...)` 문자열 → 수 배열. */
const nums = (m) => String(m).replace(/^matrix3?d?\(|\)$/g, '').split(',').map(Number);

/* ══════════════════════════════════════════════════════════════════════
   P0 ★전제 — 명부에 식구가 ★있고, ★U2 라 ★핸들은 ★없다
   ══════════════════════════════════════════════════════════════════════ */
test('P0 ★전제 — 명부 식구 ⑤ 「freetransform」 이 ★등록돼 있고, 텍스트 목록에 ★뜬다 (⛔수를 박지 않고 판에서 읽는다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const tb = document.getElementById('ftTB');
    return { keys: window.fxTypeKeys(), forText: window.fxTypesFor(tb).map(t => t.key) };
  });
  console.log('[P0]', JSON.stringify(r));
  /* ⛔「다섯째다」를 숫자로 박지 않는다 — 선례 effects-registry.dom.spec.js:7 의 규율. */
  expect(r.keys, '★전제: 명부를 판에서 읽었다(비면 모듈이 안 실렸다 ⇒ 아래 0건은 ★「안 재고 있다」다)').not.toEqual([]);
  expect(r.keys, '★명부에 freetransform 이 없다 — 식구 등록이 안 됐다').toContain('freetransform');
  expect(r.forText, '★글상자 목록에 자유변형이 안 뜬다').toContain('freetransform');
  /* ★U2 의 범위 단언 — 핸들은 ★U3 다. ⛔여기서 핸들이 뜨면 단계가 섞인 것이다. */
  const handles = await page.evaluate(() => document.querySelectorAll('[data-tf-resize-dir]').length);
  expect(handles, '★U2 는 ★핸들이 없다 — 떴다면 U3 가 섞였다(그 단언은 이 벌에 없다)').toBe(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   P3 — 저장 값이 ★모서리 ★8 숫자다
   ══════════════════════════════════════════════════════════════════════ */
test('P3 ★저장 값이 모서리 ★8 숫자 — `dataset.tfCorners` 를 쉼표로 쪼개면 ★길이 8', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  /* ★전제/반례 — 켜기 «전»에는 ★없다(⛔「8이다」만 두면 켜지 않아도 통과하는 길이 생긴다) */
  expect(await page.evaluate(() => document.getElementById('ftTB').dataset.tfCorners ?? null),
    '★전제: 켜기 전에는 tfCorners 가 없다').toBe(null);
  await addFt(page);
  const r = await page.evaluate(() => {
    const raw = document.getElementById('ftTB').dataset.tfCorners;
    return { raw, parts: raw.split(','), allNum: raw.split(',').every(s => Number.isFinite(Number(s))) };
  });
  console.log('[P3]', JSON.stringify(r));
  expect(r.parts.length, '★모서리 여덟 숫자가 아니다').toBe(8);
  expect(r.allNum, '★여덟 칸이 전부 수가 아니다').toBe(true);
  /* ⛔16값 행렬을 ★싣지 않는다(발주 ② — 한쪽만 정본) */
  const ds = await page.evaluate(() => Object.keys(document.getElementById('ftTB').dataset));
  expect(ds.filter(k => /matrix/i.test(k)), '★matrix3d 16값이 dataset 에 실렸다 — ⛔그 여덟에서 «매번 계산»한다').toEqual([]);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   PRE-IDENTITY — ★변형 0 에서 글자 행렬이 ★항등이다
   ★이 칸은 ★다른 칸들의 ★전제다(「변형 0 에서」라 이름 붙인 칸은 이것을 먼저 건다).
   ★무엇을 잡나: `measure()` 의 ★되먹임 차단을 빼면 ★`matrix(0.952,0,0,0.795)` 가 난다(261022 실측).
   ══════════════════════════════════════════════════════════════════════ */
test('PRE-IDENTITY ★변형 0(항등 네 점)에서 글자칸 computed transform 이 ★항등이다 — ⛔되먹임이 있으면 빨강', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  const r = await read(page);
  console.log('[PRE-IDENTITY]', JSON.stringify({ corners: r.corners, t: r.glyphTransform, state: r.state }));
  /* ★전제 — 네 점이 ★바탕 네모다(그래야 「변형 0」이라 부를 수 있다) */
  const C = r.corners.split(',').map(Number);
  expect(C[0], '★전제: nw.x = 0').toBeCloseTo(0, 1);
  expect(C[1], '★전제: nw.y = 0').toBeCloseTo(0, 1);
  expect(C[3], '★전제: ne.y = 0').toBeCloseTo(0, 1);
  expect(C[6], '★전제: sw.x = 0').toBeCloseTo(0, 1);
  expect(C[2], '★전제: ne.x = W > 0').toBeGreaterThan(1);
  expect(C[5], '★전제: se.y = H > 0').toBeGreaterThan(1);
  /* ★본 단언 — ★항등. ⛔`matrix3d` 문자열 비교가 아니라 ★computed 값으로(브라우저가 접는다). */
  const n = nums(r.glyphTransform);
  expect(n.length === 6 || n.length === 16, `★행렬 꼴이 아니다: ${r.glyphTransform}`).toBe(true);
  const ident6 = n.length === 6 ? n : [n[0], n[1], n[4], n[5], n[12], n[13]];
  expect(ident6.map(v => Math.round(v * 1000) / 1000),
    `★변형 0 인데 ★항등이 아니다(되먹임 차단이 죽었다): ${r.glyphTransform}`).toEqual([1, 0, 0, 1, 0, 0]);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   NegA_pixel_same — `tfCorners` 가 ★없으면 ★고치기 «전»과 ★같다
   ＋ ★양성대조: ★걸린 블럭은 ★달라진다(⛔「안 변했다」만 두면 모듈이 죽어도 초록)
   ══════════════════════════════════════════════════════════════════════ */
test('NegA_pixel_same ★tfCorners 가 없는 글상자는 ★무변 (＋★양성대조: 걸린 블럭은 달라진다)', async ({ page }) => {
  const errs = await setup(page);
  const snap = (id) => page.evaluate((id) => {
    const e = document.getElementById(id); const r = e.getBoundingClientRect();
    const g = e.querySelector('[class^="tb-"]');
    return { html: e.outerHTML, rect: [r.width, r.height].map(v => Math.round(v * 100) / 100),
             gt: getComputedStyle(g).transform, fs: getComputedStyle(g).fontSize };
  }, id);
  const other0 = await snap('ftOTB');
  const ours0 = await snap('ftTB');

  await pick(page, 'ftTB');
  await addFt(page);
  /* ★모듈을 ★실제로 돌렸다는 전제 — ⛔안 돌았으면 「무변」은 증거가 아니다 */
  expect(await page.evaluate(() => !!document.getElementById('ftTB').dataset.tfCorners),
    '★전제: 우리 블럭에 효과가 걸렸다').toBe(true);
  await settle(page, 'ftOTB');
  const other1 = await snap('ftOTB');
  const ours1 = await snap('ftTB');
  console.log('[NegA] other', JSON.stringify(other0.rect), '→', JSON.stringify(other1.rect));

  /* ★본 단언 — 손 안 댄 글상자는 ★바이트까지 같다 */
  expect(other1.html, '★tfCorners 가 없는 글상자의 outerHTML 이 바뀌었다 — ⛔기존 텍스트 무변').toBe(other0.html);
  expect(other1.rect, '★tfCorners 가 없는 글상자의 크기가 바뀌었다').toEqual(other0.rect);
  expect(other1.gt, '★tfCorners 가 없는 글상자에 행렬이 걸렸다').toBe(other0.gt);
  /* ★★양성대조 — ★걸린 쪽은 ★달라진다. ⇒ 위의 「같다」가 ★자가 죽어서 난 초록이 ★아니다 */
  expect(ours1.html, '★양성대조 실패 — 걸린 블럭도 안 변했다(모듈이 안 돌았다)').not.toBe(ours0.html);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   NegB_origin — ★변형 0 에서 글자의 ★좌상단이 «제자리»다
   ★★값을 안 쓰고 ★뜻을 잰다(발주 정정 ⑫ ⒝) ⇒ `OX=OY=0` 에서도 ★항등식이 아니다.
   ★무엇을 잡나: origin 을 `0 0` 으로도 `center center` 로도 두면 ★빨강(변이 둘이 같은 단언을 민다).
   ══════════════════════════════════════════════════════════════════════ */
test('NegB_origin ★변형 0 에서 글자 좌상단이 ★제자리다(±1px) — ⛔origin 의 «값»을 재지 않고 «뜻»을 잰다', async ({ page }) => {
  const errs = await setup(page);
  /* ★★고르기를 ★먼저 한다 — `pick()` 의 `scrollIntoView` 가 ★두 측정 ★사이에 들어오면
     ★스크롤 이동이 ★「글자가 움직였다」로 ★둔갑한다(실측 261023: Δ498px = ★내 시험 설계의 흠). */
  await pick(page, 'ftTB');
  await settle(page, 'ftTB');
  const before = await read(page);
  await addFt(page);
  await settle(page, 'ftTB');
  const after = await read(page);
  console.log('[NegB]', JSON.stringify({ before: before.glyphBox, after: after.glyphBox,
    scroll: [before.scroll, after.scroll], origin: after.glyphOrigin }));
  /* ★전제 — ★스크롤이 ★안 움직였다. 움직였다면 ★아래 수는 ★origin 을 재는 것이 아니다. */
  expect(after.scroll, `★전제: 두 측정 사이에 스크롤이 움직였다 ${JSON.stringify(before.scroll)} → ${JSON.stringify(after.scroll)}`).toEqual(before.scroll);
  /* ★전제 — 박스의 ★자리(흐름 위치)가 그대로다. 폭·높이는 ⒞ 로 ★바뀌는 것이 정상이다. */
  expect(Math.abs(after.tbTop - before.tbTop), '★전제: 박스의 흐름 자리(top)가 그대로다').toBeLessThanOrEqual(1);
  expect(Math.abs(after.tbLeft - before.tbLeft), '★전제: 박스의 흐름 자리(left)가 그대로다').toBeLessThanOrEqual(1);
  /* ★전제 — 변형 0 이다(PRE-IDENTITY 와 ★같은 조건을 ★이 칸에서도 먼저 건다) */
  const n = nums(after.glyphTransform);
  const id6 = n.length === 6 ? n : [n[0], n[1], n[4], n[5], n[12], n[13]];
  expect(id6.map(v => Math.round(v * 1000) / 1000), '★전제: 변형 0(항등)에서 재야 뜻이 있다').toEqual([1, 0, 0, 1, 0, 0]);
  /* ★본 단언 */
  expect(Math.abs(after.glyphBox.left - before.glyphBox.left),
    `★글자 좌상단 x 가 움직였다 ${before.glyphBox.left} → ${after.glyphBox.left} — origin 이 글자 좌상단을 안 가리킨다`).toBeLessThanOrEqual(1);
  expect(Math.abs(after.glyphBox.top - before.glyphBox.top),
    `★글자 좌상단 y 가 움직였다 ${before.glyphBox.top} → ${after.glyphBox.top}`).toBeLessThanOrEqual(1);

  /* ★★★위의 「변형 0」 칸만으로는 ★★아무것도 안 잠근다 — ★항등 행렬은 ★origin 과 ★무관하다.
     ★★실측으로 그것을 ★확인했다(261023 무력화 대조 M2): `transform-origin` 한 줄을 ★죽여도
       ★빨강이 ★0 건이었다 ⇒ ★★그 칸은 ★정정 ⑫ 가 경고한 ★그 ★항등식이다.
     ⇒ ★★★«무는» 꼴을 ★같이 건다: ★nw 가 ★제자리인 ★★비항등 변형.
       네 점 `[[0,0],[W,0],[0.6W,H],[0,H]]` ⇒ 정규화 뒤 min 이 (0,0) 이라 ★nw ↦ (0,0)
       ⇒ ★origin 이 ★글자 좌상단이면 ★잉크 좌상단이 ★제자리 · ★center 면 ★크게 움직인다.
     ★실측 수(같은 장면): origin 맞음 ⇒ Δ(0, 0) / ★origin=center ⇒ ★Δ(−164.89, −265.14). */
  const bite = await page.evaluate(() => {
    const tb = document.getElementById('ftTB');
    const { W, H } = window.ftStateOf(tb);
    window.setFxFreeTransform(tb, [[0, 0], [W, 0], [W * 0.6, H], [0, H]]);
    const g = tb.querySelector('[class^="tb-"]');
    const inkOf = () => { const r = document.createRange(); r.selectNodeContents(g);
      const b = r.getBoundingClientRect(); r.detach?.();
      return { left: Math.round((b.left + window.scrollX) * 100) / 100, top: Math.round((b.top + window.scrollY) * 100) / 100 }; };
    const good = inkOf();
    const t = getComputedStyle(g).transform;
    /* ★★그 자가 ★사나 — ★origin 을 ★center 로 두면 ★움직여야 한다(⛔안 움직이면 자가 죽었다) */
    const keep = g.style.transformOrigin;
    g.style.transformOrigin = 'center center';
    const bad = inkOf();
    g.style.transformOrigin = keep;
    return { good, bad, t, origin: getComputedStyle(g).transformOrigin };
  });
  const base = { left: before.glyphBox.left + before.scroll[0], top: before.glyphBox.top + before.scroll[1] };
  console.log('[NegB-bite]', JSON.stringify({ base, ...bite }));
  /* ★전제 — ★정말 비항등이다(항등이면 아래가 다시 항등식이 된다) */
  expect(bite.t, '★전제: nw 고정 ★비항등 변형이 걸렸다').toContain('matrix3d');
  /* ★본 단언 — origin 이 글자 좌상단을 가리키므로 ★잉크 좌상단이 ★제자리다 */
  expect(Math.abs(bite.good.left - base.left), `★비항등 변형에서 잉크 좌상단 x 가 움직였다 ${base.left} → ${bite.good.left}`).toBeLessThanOrEqual(1);
  expect(Math.abs(bite.good.top - base.top), `★비항등 변형에서 잉크 좌상단 y 가 움직였다 ${base.top} → ${bite.good.top}`).toBeLessThanOrEqual(1);
  /* ★★그 자의 ★양성대조 — ★origin 을 center 로 두면 ★움직인다 */
  const moved = Math.abs(bite.bad.left - base.left) + Math.abs(bite.bad.top - base.top);
  expect(moved, '★★자가 죽었다 — origin 을 center 로 바꿔도 잉크 좌상단이 안 움직인다(그러면 위 「제자리」는 증거가 아니다)').toBeGreaterThan(10);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   NegC_tb_no_transform — `.text-block`(파란 아웃라인)은 ★행렬을 ★안 받는다
   ★전제 「회전 0」도 같이 — 회전 host 는 ★tf | `.text-block` 이라(js/asset-rotate.js:350~351)
     회전이 걸리면 ★정당하게 빨개진다 ⇒ 「그 전제가 섰음을 무엇으로 아나」를 ★같이 단언한다.
   ══════════════════════════════════════════════════════════════════════ */
test('NegC_tb_no_transform ★`.text-block` computed transform 이 ★none — 켠 뒤 · ★Esc 뒤에도 (＋전제: 회전 0)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  const on = await read(page);
  /* ★전제 — 회전이 걸려 있지 않다(걸려 있으면 이 단언은 ★다른 것을 재게 된다) */
  expect(on.rotation, '★전제: 글상자에 회전이 없다').toBe(null);
  expect(on.tfRotation, '★전제: text-frame 에도 회전이 없다').toBe(null);
  /* ★전제 — 글자칸에는 ★행렬이 ★걸렸다(⛔안 걸렸으면 「tb 가 none」은 증거가 아니다) */
  expect(on.glyphTransform, '★전제: 글자칸에 행렬이 걸렸다').not.toBe('none');
  expect(on.tbTransform, '★`.text-block` 에 행렬이 걸렸다 — ⛔아웃라인이 같이 찌그러진다(정정 ⑨)').toBe('none');

  /* 사다리꼴로 바꾼 뒤에도 */
  await page.evaluate(() => {
    const tb = document.getElementById('ftTB'); const { W, H } = window.ftStateOf(tb);
    window.setFxFreeTransform(tb, [[W * 0.2, 0], [W * 0.8, 0], [W, H], [0, H]]);
  });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#ftTB [class^="tb-"]')).transform.startsWith('matrix3d'));
  expect((await read(page)).tbTransform, '★사다리꼴 뒤 `.text-block` 에 행렬이 걸렸다').toBe('none');

  /* ★Esc 뒤에도 */
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#ftTB.selected'));
  expect((await read(page)).tbTransform, '★Esc 뒤 `.text-block` 에 행렬이 걸렸다').toBe('none');
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   J_roundtrip — ★저장 → ★다시 열기 ⇒ ★같은 모양 (현빈 「블럭으로도 유지되나」의 검사)
   ★`W H OX OY` 는 WeakMap 에 사니 ★로드 뒤엔 없다 ⇒ ★명부의 `watchAllFx` 가 다시 그려야 한다.
   ══════════════════════════════════════════════════════════════════════ */
test('J_roundtrip ★저장 → 다시 열기 ⇒ 모서리 여덟과 글자 행렬이 ★같다 (＋반례: 저장 글자에 모서리가 실렸다)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  const trap = await page.evaluate(() => {
    const tb = document.getElementById('ftTB'); const { W, H } = window.ftStateOf(tb);
    window.setFxFreeTransform(tb, [[W * 0.2, 0], [W * 0.8, 0], [W, H], [0, H]]);
    return { W, H };
  });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#ftTB [class^="tb-"]')).transform.startsWith('matrix3d'));
  const before = await read(page);
  /* ★전제 — 정말 찌그러져 있다(항등이면 왕복이 ★항등식이 된다) */
  expect(before.glyphTransform, '★전제: 사다리꼴이 걸렸다').toContain('matrix3d');
  expect(nums(before.glyphTransform)[7], '★전제: 원근 항 h32 가 0 이 아니다').not.toBe(0);

  const html = await page.evaluate(() => window.getSerializedCanvas());
  expect(html, '★반례/전제: 저장 글자에 모서리 여덟이 실려야 한다 — 안 실렸으면 아래 왕복은 ★다른 길로 된 것이다').toContain('data-tf-corners');

  /* ★다시 열기 — 캔버스를 통째로 갈아 끼우고 ★명부의 watchAllFx 를 돈다(제품 로드 경로와 같은 순서) */
  const after = await page.evaluate(async (saved) => {
    const c = document.getElementById('canvas');
    c.innerHTML = window.sanitizeCanvasHtml(saved);
    window.rebindAll?.();
    const n = window.watchAllFx(c);
    const tb = document.getElementById('ftTB');
    const g = tb.querySelector('[class^="tb-"]');
    return { watched: n, corners: tb.dataset.tfCorners, gt: getComputedStyle(g).transform };
  }, html);
  console.log('[J_roundtrip]', JSON.stringify({ trap, before: before.corners, after }));
  expect(after.watched, '★watchAllFx 가 아무것도 다시 그리지 않았다 — 「데이터 → 화면」이 로드에서 끊겼다').toBeGreaterThanOrEqual(1);
  expect(after.corners, '★왕복 뒤 모서리 여덟이 달라졌다').toBe(before.corners);
  const a = nums(after.gt).map(v => Math.round(v * 1000) / 1000);
  const b = nums(before.glyphTransform).map(v => Math.round(v * 1000) / 1000);
  expect(a, '★왕복 뒤 글자 행렬이 달라졌다 — 「블럭으로도 유지」가 깨졌다').toEqual(b);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   D_box_real — ★박스가 글자를 ★감싼다(⒞ · 현빈 msg5416) · ★«네 꼴»에서
   판정 = 정규화된 D 가 ★전부 박스 안: 0 ≤ Dx ≤ (박스폭 − OX) · 0 ≤ Dy ≤ (박스높이 − OY)
   ⛔한 꼴로 닫지 마라 — ★「왼·위로 나감」 꼴이 ★정규화를 재는 ★그 꼴이다.
   ══════════════════════════════════════════════════════════════════════ */
test('D_box_real ★박스가 글자를 감싼다 — ★네 꼴(변형 0 · 왼·위로 나감 · 모서리 하나만 밖 · 사다리꼴) 전부 삐져나감 0', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  const r = await page.evaluate(() => {
    const tb = document.getElementById('ftTB');
    const { W, H } = window.ftStateOf(tb);
    const shapes = {
      '변형 0': [[0, 0], [W, 0], [W, H], [0, H]],
      '왼·위로 나감': [[-60, -40], [W, 0], [W, H], [0, H]],
      '모서리 하나만 밖': [[0, 0], [W + 120, 0], [W, H], [0, H]],
      '사다리꼴': [[W * 0.2, 0], [W * 0.8, 0], [W, H], [0, H]],
    };
    const out = {};
    for (const [name, C] of Object.entries(shapes)) {
      window.setFxFreeTransform(tb, C, { history: false });
      const st = window.ftStateOf(tb);
      const cur = window.ftCornersOf(tb);
      const mnx = Math.min(...cur.map(q => q[0])), mny = Math.min(...cur.map(q => q[1]));
      const D = cur.map(([x, y]) => [x - mnx, y - mny]);
      const bw = parseFloat(tb.style.width), bh = parseFloat(tb.style.minHeight);
      const overflow = D.map(([x, y]) => [
        Math.max(0, -x), Math.max(0, x - (bw - st.OX)),
        Math.max(0, -y), Math.max(0, y - (bh - st.OY)),
      ]).flat();
      out[name] = { D: D.map(p => p.map(v => Math.round(v * 100) / 100)), bw, bh, OX: st.OX, OY: st.OY,
                    worst: Math.round(Math.max(...overflow) * 100) / 100 };
    }
    return out;
  });
  console.log('[D_box_real]', JSON.stringify(r, null, 1));
  /* ★전제 — ★네 꼴을 ★다 돌렸다(⛔한 꼴만 돌고 초록이면 그 자는 정규화를 안 잰다) */
  expect(Object.keys(r).length, '★네 꼴을 다 돌려야 한다').toBe(4);
  for (const [name, v] of Object.entries(r)) {
    expect(v.bw, `★${name}: 박스 폭이 수가 아니다 — 렌더가 안 돌았다`).toBeGreaterThan(0);
    expect(v.worst, `★${name}: 글자가 박스 밖으로 ${v.worst}px 삐져나갔다 — ⒞「계속 감쌈」이 깨졌다`).toBeLessThanOrEqual(0.5);
  }
  /* ★「왼·위로 나감」이 ★정말 왼·위로 나간 꼴이었나 — ⛔안 나갔으면 그 꼴은 정규화를 ★안 쟀다 */
  expect(r['왼·위로 나감'].D.some(([x, y]) => x > 0.5 && y > 0.5),
    '★전제: 「왼·위로 나감」 꼴에서 정규화가 ★실제로 당겼다(안 당겼으면 그 꼴이 다른 꼴과 같다)').toBe(true);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   ★★D_floor_keeps_base — ⚠️★발주 ★밖에서 ★더한 칸이다(§3 의 15 에 ★없다). ★까닭을 적는다.
   ★★설계 ④ 의 ★변이 ⒁ 는 「`boxFromCorners` 의 ★하한 둘을 빼면 ⇒ `D_zero_same_as_base` ＋
     `D_box_real` ★빨강」이라 ★적었는데, ★★그 사상(mapping)이 ★거짓이다 — ★★내가 쟀다(261023):
       · ★U2 무력화 대조 M11(하한 없는 식으로 갈아끼움) ⇒ ★★18칸 ★전부 초록(빨강 ★0 건)
       · ★U1 `D_zero_same_as_base` 는 ★«변형 0» ★한 꼴만 재고, ★그 꼴에서 두 식은 ★★값이 같다
         (스크래치 실측: 변형 0 에서 OX·OY 네 짝 ★전부 ★동일 / ★«안쪽으로 줄임» 꼴에서만 ★갈린다
          — w200 h60 vs ★w100 h30)
     ⇒ ★★하한 둘은 ★★«아무도 안 잠그는» 결정이었다. ⛔`js/fx/homography.js` 는 ★금지선이라
       ★고치지 않고, ★★«지금 꼴»을 ★수로 못박아 ★그 결정이 ★보이게만 한다.
   ★★⇒ ★지디 판정 칸: ★하한이 ★뜻한 것인가(박스는 ★바탕보다 작아지지 않는다) 아니면
     ⒞「계속 감쌈」이 ★줄어든 글자도 ★따라가야 하는가. ★이 칸은 ★«지금 꼴»을 적었을 뿐이다.
   ══════════════════════════════════════════════════════════════════════ */
test('D_floor_keeps_base ⚠️발주 밖 — ★안쪽으로 줄이면 박스가 ★바탕보다 작아지지 ★않는다(하한 둘을 수로 못박는다)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  const r = await page.evaluate(() => {
    const tb = document.getElementById('ftTB');
    const st0 = window.ftStateOf(tb);
    const base = { w: st0.W + st0.OX, h: st0.H + st0.OY, W: st0.W, H: st0.H, OX: st0.OX, OY: st0.OY };
    /* ★안쪽으로 ★줄인다 — 네 점이 ★바탕의 절반 ⇒ ★하한이 없으면 박스가 ★절반이 된다 */
    window.setFxFreeTransform(tb, [[0, 0], [st0.W * 0.5, 0], [st0.W * 0.5, st0.H * 0.5], [0, st0.H * 0.5]]);
    const rd = (v) => Math.round(v * 100) / 100;
    return { base: { w: rd(base.w), h: rd(base.h) }, st: base,
             boxW: rd(parseFloat(tb.style.width)), boxH: rd(parseFloat(tb.style.minHeight)),
             corners: tb.dataset.tfCorners };
  });
  console.log('[D_floor_keeps_base]', JSON.stringify(r));
  /* ★전제 — ★네 점이 ★정말 줄어 있다(⛔안 줄었으면 아래가 항등식이다) */
  const C = r.corners.split(',').map(Number);
  expect(C[2], `★전제: ne.x(${C[2]})가 바탕 W(${r.st.W})의 절반쯤으로 줄었다`).toBeLessThan(r.st.W * 0.75);
  /* ★본 단언 — ★하한이 살아 박스가 ★바탕 그대로다 */
  expect(r.boxW, `★박스 폭이 바탕(${r.base.w})보다 작아졌다 ${r.boxW} — 하한 W+OX 가 죽었다`).toBeCloseTo(r.base.w, 0);
  expect(r.boxH, `★박스 높이가 바탕(${r.base.h})보다 작아졌다 ${r.boxH} — 하한 H+OY 가 죽었다`).toBeCloseTo(r.base.h, 0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   NoFreeze_fontsize — ★`tfCorners` 를 지우면 ★글자 크기가 ★바닥값으로 돌아온다
   ⇒ 찌그러짐을 `font-size` 로 ★굳혔다면 ★안 돌아온다 ⇒ ★발주 ②의 ⛔를 ★검사로 박는다.
   ══════════════════════════════════════════════════════════════════════ */
test('NoFreeze_fontsize ★✕ 뒤 글자 크기·굵기·자간이 ★바닥값으로 — ⛔font-size 로 굳히는 길을 막는다', async ({ page }) => {
  const errs = await setup(page);
  const base = await read(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.evaluate(() => {
    const tb = document.getElementById('ftTB'); const { W, H } = window.ftStateOf(tb);
    window.setFxFreeTransform(tb, [[0, 0], [W * 2.2, 0], [W * 2.2, H * 0.4], [0, H * 0.4]]);
  });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#ftTB [class^="tb-"]')).transform !== 'none');
  const on = await read(page);
  /* ★전제 — 정말 찌그러졌다 ＋ ★글자 속성은 ★그 동안에도 ★안 굳었다 */
  expect(on.glyphTransform, '★전제: 찌그러짐이 걸렸다').not.toBe('none');
  expect(on.fontSize, '★찌그러짐이 ★`font-size` 로 굳었다 — ⛔1회성 굳힘이면 「블럭으로 유지」가 깨진다').toBe(base.fontSize);
  expect(on.fontWeight, '★굵기가 굳었다').toBe(base.fontWeight);

  await page.click('#txt-fxft-del');
  await page.waitForFunction(() => !document.getElementById('ftTB').dataset.tfCorners);
  const off = await read(page);
  console.log('[NoFreeze]', JSON.stringify({ base: base.fontSize, on: on.fontSize, off: off.fontSize, offT: off.glyphTransform }));
  expect(off.fontSize, '★✕ 뒤 글자 크기가 바닥값으로 안 돌아왔다 — 굳혔다는 뜻이다').toBe(base.fontSize);
  expect(off.glyphTransform, '★✕ 뒤에도 행렬이 남았다').toBe('none');
  expect(off.tbW, '★✕ 뒤 박스 폭이 바닥값으로 안 돌아왔다').toBeCloseTo(base.tbW, 0);
  expect(off.tfW, '★✕ 뒤 tf 폭이 바닥값으로 안 돌아왔다 — ★사용자가 정한 폭을 우리가 먹었다').toBeCloseTo(base.tfW, 0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   NoNumberField / _neg — ★패널에 ★숫자 칸을 ★만들지 않았다
   현빈: 「★값 입력이 아니라 ★핸들 움직여서」(발주 ③⒞)
   ★_neg = ★잣대 음성대조 — ★이웃 글로우 카드에는 ★있다 ⇒ 자가 ★죽지 않았다
     (선례 꼴 = tests/dom/checker-section-tone.dom.spec.js S8 「걷기 없이 찍으면 센다」)
   ══════════════════════════════════════════════════════════════════════ */
test('NoNumberField ★우리 카드에 숫자·슬라이더 칸 0 (＋★_neg 잣대: 이웃 글로우 카드에는 ★있다)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.selectOption('#txt-fx-add', 'glow');                 /* ★같은 패널에 ★이웃 카드를 띄운다 */
  await page.waitForFunction(() => !!document.getElementById('txt-fxgl-card'));
  const r = await page.evaluate(() => {
    const q = (sel) => document.querySelectorAll(sel).length;
    return {
      ours: q('#txt-fxft-card input[type=range], #txt-fxft-card input[type=number]'),
      oursAllInputs: q('#txt-fxft-card input'),
      glow: q('#txt-fxgl-card input[type=range], #txt-fxgl-card input[type=number]'),
      oursCard: !!document.getElementById('txt-fxft-card'),
      oursReset: !!document.getElementById('txt-fxft-reset'),
      hints: [...document.querySelectorAll('#txt-fxft-card .prop-hint')].map(e => e.textContent.trim()),
    };
  });
  console.log('[NoNumberField]', JSON.stringify(r));
  /* ★전제 — 우리 카드가 ★떴다(⛔안 떴으면 「0개」는 ★「안 재고 있다」다) */
  expect(r.oursCard, '★전제: 우리 카드가 떴다').toBe(true);
  expect(r.oursReset, '★전제: 카드에 「원래대로」가 있다 — 빈 카드라면 0개는 증거가 아니다').toBe(true);
  /* ★★잣대 음성대조 — ★같은 자로 ★이웃 카드를 재면 ★센다 */
  expect(r.glow, '★★잣대가 죽었다 — 같은 선택자로 글로우 카드를 재도 0 이다(그러면 우리 0 은 증거가 아니다)').toBeGreaterThanOrEqual(2);
  /* ★본 단언 */
  expect(r.ours, `★우리 카드에 숫자/슬라이더 칸이 ${r.ours}개 생겼다 — 현빈 「값 입력이 아니라 핸들 움직여서」`).toBe(0);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   Registry_mirror — ★도형·에셋·프레임엔 ★안 뜬다 (거울상)
   선례 = tests/dom/effects-registry.dom.spec.js:146~149 「텍스트엔 그림자가 안 뜬다」
   ══════════════════════════════════════════════════════════════════════ */
test('Registry_mirror ★도형·에셋·프레임엔 자유변형이 ★안 뜬다 (＋반례: 그들에게도 뜨는 식구는 ★있다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const k = (el) => window.fxTypesFor(el).map(t => t.key);
    return {
      text: k(document.getElementById('ftTB')),
      shape: k(document.getElementById('ftSH')),
      asset: k(document.getElementById('ftAS')),
      frame: k(document.getElementById('ftFR')),
    };
  });
  console.log('[Registry_mirror]', JSON.stringify(r));
  expect(r.text, '★전제: 글상자엔 뜬다').toContain('freetransform');
  for (const who of ['shape', 'asset', 'frame']) {
    /* ★반례 — ★그 블럭에도 ★뜨는 식구가 있다(⛔목록이 통째로 비면 「안 뜬다」는 증거가 아니다) */
    expect(r[who].length, `★반례: ${who} 목록이 비었다 — 그러면 「자유변형이 없다」는 ★「안 재고 있다」다`).toBeGreaterThanOrEqual(1);
    expect(r[who], `★${who} 에 자유변형이 떴다 — supports 가 ★허용 목록이 아니다`).not.toContain('freetransform');
  }
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   W_three_equal — `.text-block` 폭 = tf 폭 = ★글자 경계 (★㉣ 「너비 항상 동일」)
   ★★★⛔⛔다음 사람에게 — ★★«늘리는 꼴로 ★재면 ★거짓 빨강이 난다»(지디 승인 261023)
     ★`tf` 는 ★`max-width:100%` 다 ⇒ ★★늘리는 쪽은 ★★안 먹는다:
       ★실측 — `tf.style.width = '916px'` 를 ★썼는데 ★computed ★796px ★유지(섹션 폭에 ★캡된다).
       ★좁히는 쪽은 ★먹는다 — 실측 ★596px.
     ⇒ ★★그 꼴에서는 ★`tb` ★만 넓어져 ★「셋이 같다」가 ★제품이 ★맞는데도 ★빨개진다.
     ⇒ ★★그러므로 ★이 칸은 ★★«섹션 폭을 넘지 않는 꼴»에서만 잰다 — ★아래 ★전제 단언이 ★그것을 ★막는다.
     ⛔★늘리는 꼴로 이 칸을 짜고 ★제품을 고치지 마라 — ★그 길은 ★★«싼 쪽(엉뚱한 고침)»이다
       [[gate-offers-a-cheap-wrong-fix]]. ★고칠 것은 ★제품이 아니라 ★이 자의 ★창이다.
   ══════════════════════════════════════════════════════════════════════ */
test('W_three_equal ★`.text-block` 폭 = tf 폭 = 글자 경계(±1px) — ★㉣ 「너비 항상 동일」', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  const r = await read(page);
  console.log('[W_three_equal]', JSON.stringify({ tbW: r.tbW, tfW: r.tfW, glyphW: r.glyphBox.w, state: r.state }));
  /* ★전제 — ★섹션 폭을 ★넘지 않는 꼴이다(넘으면 tf 가 캡되어 ★거짓 빨강이 난다) */
  const cap = await page.evaluate(() => {
    const tf = document.getElementById('ftTF');
    return Math.round(parseFloat(getComputedStyle(tf.parentElement).width));
  });
  expect(r.glyphBox.w, `★전제: 글자 경계(${r.glyphBox.w})가 부모 폭(${cap})을 넘지 않는다 — 넘으면 tf 가 max-width 에서 캡된다`).toBeLessThan(cap);
  /* ★본 단언 — ★셋이 같다 */
  expect(Math.abs(r.tbW - r.tfW), `★.text-block(${r.tbW}) ≠ tf(${r.tfW}) — 「너비 항상 동일」이 깨졌다`).toBeLessThanOrEqual(1);
  expect(Math.abs(r.tbW - r.glyphBox.w), `★.text-block(${r.tbW}) ≠ 글자 경계(${r.glyphBox.w}) — ⒞ 「감쌈」이 깨졌다`).toBeLessThanOrEqual(1);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   W_neighbor_premise / W_neighbor_unmoved — ★J 가로 `width` 의 ★갈림(발주 §1 칸 1)
   ★★전제가 ★없으면 「안 움직였다」가 「★원래 안 움직이는 놈이었다」와 ★구분 안 된다.
   ★★실측(261023 · 조정자가 못 쟀던 칸): ㉣(`tb`＋`tf` 같은 폭) ⇒ ★Δ0.00 ⇒ ㉣ 가 산다.

   ★★★⛔⛔다음 사람에게 — ★★«세로는 ★움직인다. ★그것은 ★의도다»(⛔결함으로 읽지 마라 · 지디 승인 261023)
     ★이 칸은 ★★«가로 축» 물음만 잰다. ★세로로는 ★이웃이 ★★박스가 자란 만큼 ★정확히 밀린다
       — 실측 `tb` min-height ＋80 ⇒ ★이웃 top ★＋80.00 · 효과를 ★켜기만 해도 ★＋4.61
         (⒞ 가 글자 잉크 124 를 감싸려면 min-height 119 가 필요하고 바탕이 114.39 다 · OY=−5).
     ★까닭 = ★⒞ 「박스가 아예 글자를 ★계속 감쌈」(현빈 msg5416 ★확정)의 ★피할 수 없는 결과다.
     ★그리고 ★★㉢ 로 가도 ★똑같다 — ★`tf` 는 `height` 가 ★막혀 있어(js/overlay-handles.js:3441~3443
       「높이는 «쓰지 않고 잰다»」) ★세로 감쌈은 ★`.text-block` 의 `min-height` ★한 길뿐이다.
     ⇒ ★★그러므로 ★세로 Δ 를 ★★「㉣ 의 흠」으로도 ★「회귀」로도 ★읽지 마라. ⛔이 칸을 세로로 넓히지 마라.
     ⇒ ★「켜기만 해도 ★뒤 블럭이 ★4.61px 내려간다」가 ★현빈께 ★보일 변화인지는 ★★지디 판정 칸이다(보고에 올렸다).
   ══════════════════════════════════════════════════════════════════════ */
test('W_neighbor_premise ★이웃이 정말 뒤에 있다 (＋★양성대조: 세로를 키우면 ★움직인다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const tf = document.getElementById('ftTF'), nb = document.getElementById('ftNB'), tb = document.getElementById('ftTB');
    const rd = (v) => Math.round(v * 100) / 100;
    const a = tf.getBoundingClientRect(), b = nb.getBoundingClientRect();
    const base = rd(b.top);
    /* ★★양성대조 — 세로를 키우면 ★이웃이 움직여야 한다. 움직이지 않으면 이 이웃은 ★자가 아니다. */
    tb.style.minHeight = (tb.getBoundingClientRect().height + 80) + 'px';
    const moved = rd(nb.getBoundingClientRect().top);
    tb.style.minHeight = '';
    const back = rd(nb.getBoundingClientRect().top);
    return { tfBottom: rd(a.bottom), nbTop: base, moved, back,
             follows: !!(tf.compareDocumentPosition(nb) & Node.DOCUMENT_POSITION_FOLLOWING) };
  });
  console.log('[W_neighbor_premise]', JSON.stringify(r));
  /* ★DOM 순서로 ★정말 뒤다 */
  expect(r.follows, '★이웃이 DOM 순서상 우리 뒤가 아니다 — 그러면 「안 움직였다」가 뜻이 없다').toBe(true);
  /* ⚠️정본은 `nbTop > tfBottom` 이라 적었는데 ★실측은 ★정확히 ★같다(둘이 붙어 있다) ⇒ `>=` 로 잰다.
     ★그 수를 적어 둔다 — 261023 실측 `381.19 >= 381.19`. */
  expect(r.nbTop, `★이웃 top(${r.nbTop})이 우리 bottom(${r.tfBottom})보다 위에 있다 — 뒤가 아니다.`
    + ` ⛔★정본(PLAN §326 표)의 꼴 「ftNB.top ★>★ fTF.bottom」으로 되돌리지 마라 —`
    + ` ★흐름상 ★바로 다음 블럭에서는 ★둘이 ★정확히 같아 ★그 꼴이 ★거짓이 된다`
    + ` (실측 2026-10-23: 381.19 > 381.19 = false · 지디 승인).`
    + ' ⇒ ★">=" (±0.5) ＋ compareDocumentPosition FOLLOWING ＋ ★양성대조 셋으로 잰다').toBeGreaterThanOrEqual(r.tfBottom - 0.5);
  /* ★★양성대조 */
  expect(r.moved - r.nbTop, `★★양성대조 실패 — 세로를 80px 키웠는데 이웃이 ${r.moved - r.nbTop}px 움직였다. 이 이웃은 ★움직일 수 있는 놈이어야 한다`).toBeGreaterThan(60);
  expect(Math.abs(r.back - r.nbTop), '★원복이 안 됐다 — 뒤 칸들이 오염된다').toBeLessThanOrEqual(0.5);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('W_neighbor_unmoved ★㉣(`tb`＋`tf` 같은 폭)를 써도 이웃 top 이 ★같다 — ★가로 축(그 수가 ㉣ 를 골랐다)', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(() => {
    const tb = document.getElementById('ftTB'), tf = document.getElementById('ftTF'), nb = document.getElementById('ftNB');
    const rd = (v) => Math.round(v * 100) / 100;
    const top = () => rd(nb.getBoundingClientRect().top);
    const base = top();
    const out = { base };
    /* ㉢ — tf 폭만 */
    tf.style.width = (tf.getBoundingClientRect().width + 120) + 'px';
    out.tfOnly = rd(top() - base);
    tf.style.width = '100%';
    /* ★㉣ — 둘 다 ★같은 폭(넓히는 쪽 · 좁히는 쪽) */
    const w = (tf.getBoundingClientRect().width + 120) + 'px';
    tf.style.width = w; tb.style.width = w;
    out.bothWider = rd(top() - base);
    const w2 = (tf.getBoundingClientRect().width - 200) + 'px';
    tf.style.width = w2; tb.style.width = w2;
    out.bothNarrower = rd(top() - base);
    tf.style.width = '100%'; tb.style.width = '';
    out.restored = rd(top() - base);
    return out;
  });
  console.log('[W_neighbor_unmoved]', JSON.stringify(r));
  expect(r.base, '★전제: 이웃의 자리를 쟀다').toBeGreaterThan(0);
  expect(Math.abs(r.bothWider), `★★㉣(둘 다 넓힘)이 이웃을 ${r.bothWider}px 밀었다 — ㉣ 가 죽고 ㉢ 로 가야 한다`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(r.bothNarrower), `★★㉣(둘 다 좁힘)이 이웃을 ${r.bothNarrower}px 밀었다`).toBeLessThanOrEqual(0.5);
  expect(Math.abs(r.restored), '★원복이 안 됐다').toBeLessThanOrEqual(0.5);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   W_esc_zero_wrap — ★Esc 뒤 ★원복이 ★아니라 «★변형 0 의 ★감쌈»이다
   ⒞ 는 「계속 감쌈」이라(현빈 msg5416) ★Esc 가 박스를 ★되돌리지 ★않는다.
   ⛔「Esc 뒤 원래 너비」(msg5406)는 ★정정 ⑩ 에서 ★거둬졌다 — ⛔그 꼴로 재지 마라.
   ══════════════════════════════════════════════════════════════════════ */
test('W_esc_zero_wrap ★Esc 뒤 박스가 ★«변형 0 의 감쌈» 그대로 — ⛔원복이 아니다(정정 ⑩)', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  await addFt(page);
  await page.evaluate(() => { window.resetFxFreeTransform(document.getElementById('ftTB')); });
  await settle(page, 'ftTB');
  const on = await read(page);
  /* ★전제 — 변형 0 이고, 박스가 ★글자를 감싸고 있다 */
  expect(on.corners, '★전제: 효과가 걸렸다').not.toBe(null);
  expect(Math.abs(on.tbW - on.glyphBox.w), '★전제: 변형 0 에서 박스가 글자를 감싸고 있다').toBeLessThanOrEqual(1);

  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('#ftTB.selected'));
  await settle(page, 'ftTB');
  const esc = await read(page);
  console.log('[W_esc_zero_wrap]', JSON.stringify({ onW: on.tbW, escW: esc.tbW, onH: on.tbH, escH: esc.tbH, corners: esc.corners }));
  expect(esc.corners, '★Esc 가 모서리 여덟을 지웠다 — Esc 는 효과를 끄는 것이 아니다').toBe(on.corners);
  expect(Math.abs(esc.tbW - on.tbW), `★Esc 뒤 박스 폭이 바뀌었다 ${on.tbW} → ${esc.tbW} — ⒞ 「계속 감쌈」이 깨졌다`).toBeLessThanOrEqual(1);
  expect(Math.abs(esc.tbH - on.tbH), `★Esc 뒤 박스 높이가 바뀌었다 ${on.tbH} → ${esc.tbH}`).toBeLessThanOrEqual(1);
  expect(Math.abs(esc.tfW - on.tfW), `★Esc 뒤 tf 폭이 바뀌었다 ${on.tfW} → ${esc.tfW}`).toBeLessThanOrEqual(1);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   ★현빈 QA 두 칸 (발주 §4) — 「QA게이트할때 ★불필요한 프롭힌트는 없는지,
     ★디자인일관성을 지켰는지도 함께본다」
   ══════════════════════════════════════════════════════════════════════ */
test('QA-1 ★불필요한 프롭힌트 0 — 진입 전/후 패널 행 id 를 찍고 `added` 가 ★우리 카드 뿐임을 단언한다', async ({ page }) => {
  const errs = await setup(page);
  await pick(page, 'ftTB');
  const ids = () => page.evaluate(() => ({
    rows: [...document.querySelectorAll('#txt-fx-section [id]')].map(e => e.id),
    hints: [...document.querySelectorAll('#txt-fx-section .prop-hint')].map(e => e.textContent.trim()),
    panelHints: [...document.querySelectorAll('#panel-right .prop-hint')].map(e => e.textContent.trim()),
  }));
  const before = await ids();
  await addFt(page);
  const after = await ids();
  const added = after.rows.filter(x => !before.rows.includes(x));
  const addedHints = after.hints.filter(x => !before.hints.includes(x));
  const addedPanelHints = after.panelHints.filter(x => !before.panelHints.includes(x));
  console.log('[QA-1] 전', before.rows.length, JSON.stringify(before.rows));
  console.log('[QA-1] 후', after.rows.length, JSON.stringify(after.rows));
  console.log('[QA-1] added', JSON.stringify(added), 'addedHints', JSON.stringify(addedHints));
  /* ★전제 — 진입 «전»에 Effects 절이 ★떠 있었다(⛔안 떴으면 「0건」은 안 재고 있다) */
  expect(before.rows, '★전제: 진입 전 Effects 절에 ＋ 목록이 있다').toContain('txt-fx-add');
  /* ★본 단언 — ★프롭힌트는 ★하나도 늘지 않았다(⛔「힌트 없애주기」 1020t2c3 과 같은 결) */
  expect(addedHints, `★우리 카드가 프롭힌트를 ${addedHints.length}개 더했다 — 현빈 「불필요한 프롭힌트는 없는지」`).toEqual([]);
  expect(addedPanelHints, `★우리 진입이 패널 전체에 프롭힌트를 ${addedPanelHints.length}개 더했다`).toEqual([]);
  /* ★늘어난 행은 ★우리 카드의 것 ★뿐이다 — ⛔「0개」로 두지 않고 ★이름으로 잰다 */
  expect(added.sort(), '★늘어난 패널 행이 우리 카드의 것만이 아니다').toEqual(
    ['txt-fx-list', 'txt-fxft-body', 'txt-fxft-card', 'txt-fxft-del', 'txt-fxft-head', 'txt-fxft-reset'].sort());
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

test('QA-2 ★디자인 일관 — 글자 꼴(fs·color·fw·lh)과 ★아웃라인이 ★기존 편집 꼴과 ★같은 값이다 (★값은 선례에서 떠온다)', async ({ page }) => {
  const errs = await setup(page);
  /* ★★아웃라인 기준값을 ★손으로 적지 않는다 — ★손 안 댄 글상자(`ftOTB`)를 ★골라 ★그 값을 ★떠온다.
     ⚠️★★그런데 ★어느 요소의 값인가를 ★실측으로 고쳤다(261023) — 발주·설계는 ⒞ 를
       「`.text-block` 이 파란 아웃라인」이라 적었지만, ★래퍼가 있는 꼴에서는 ★★tf 가 그린다:
         `.frame-block[data-text-frame="true"]:has(.text-block.selected)` → solid var(--sel-color)
         `.frame-block[data-text-frame="true"] > .text-block.selected`    → ★transparent(T6 2겹 픽스)
       ⇒ ★선례의 ★tf 값을 떠오고, `.text-block` 쪽은 ★「선례와 같은 transparent」로 ★같이 잰다.
       ★이것이 ★㉣(둘 다에 같은 폭)를 ★더 필요하게 만든다 — ★보이는 아웃라인이 ★tf 의 것이다. */
  await pick(page, 'ftOTB');
  const ref = await read(page, 'ftOTB');
  console.log('[QA-2] 선례(손 안 댄 글상자)', JSON.stringify({ tfOutline: ref.tfOutline, tbOutline: ref.tbOutline, fs: ref.fontSize, color: ref.color, fw: ref.fontWeight, lh: ref.lineHeight }));
  expect(ref.tfOutline, '★전제: 선례의 ★보이는 아웃라인(tf)을 떠왔다 — style 이 none 이면 선례가 안 골라진 것이다').toContain('solid');

  await pick(page, 'ftTB');
  const base = await read(page);
  await addFt(page);
  await page.evaluate(() => {
    const tb = document.getElementById('ftTB'); const { W, H } = window.ftStateOf(tb);
    window.setFxFreeTransform(tb, [[W * 0.2, 0], [W * 0.8, 0], [W, H], [0, H]]);
  });
  await page.waitForFunction(() => getComputedStyle(document.querySelector('#ftTB [class^="tb-"]')).transform.startsWith('matrix3d'));
  const on = await read(page);
  console.log('[QA-2] 변형 중', JSON.stringify({ outline: on.tbOutline, fs: on.fontSize, color: on.color, fw: on.fontWeight, lh: on.lineHeight }));
  /* ★전제 — ★정말 변형 중이다 */
  expect(on.glyphTransform, '★전제: 변형 중이다').toContain('matrix3d');
  /* ★글자 꼴 넷 — ★바뀌지 않는다(변형은 ★그림이고 ★글자 속성이 아니다) */
  expect(on.fontSize, '★변형 중 글자 크기가 달라졌다').toBe(base.fontSize);
  expect(on.color, '★변형 중 글자 색이 달라졌다').toBe(base.color);
  expect(on.fontWeight, '★변형 중 글자 굵기가 달라졌다').toBe(base.fontWeight);
  expect(on.lineHeight, '★변형 중 줄간이 달라졌다').toBe(base.lineHeight);
  /* ★아웃라인 — ★기존 편집 꼴과 ★같은 값(★선례에서 떠온 것 · ★두 요소 ★다) */
  expect(on.tfOutline, `★변형 중 ★보이는 아웃라인(tf)이 기존 편집 꼴과 다르다 — 선례 ${ref.tfOutline} / 우리 ${on.tfOutline}`).toBe(ref.tfOutline);
  expect(on.tbOutline, `★변형 중 .text-block 쪽 아웃라인이 기존 편집 꼴과 다르다 — 선례 ${ref.tbOutline} / 우리 ${on.tbOutline}`).toBe(ref.tbOutline);
  /* ★그리고 ★카드 꼴도 ★식구 꼴 그대로다 — ⛔새 UI 언어를 만들지 않았다 */
  const card = await page.evaluate(() => {
    const c = document.getElementById('txt-fxft-card');
    const glow = document.querySelector('#txt-fx-list .prop-cell-card[data-fx-type="glow"]');
    return { cls: c.className.split(/\s+/).filter(Boolean).sort(),
             head: !!c.querySelector('.prop-cell-card-header'), title: !!c.querySelector('.prop-cell-card-title'),
             del: !!document.getElementById('txt-fxft-del'), glowCls: glow ? glow.className.split(/\s+/).filter(Boolean).sort() : null };
  });
  console.log('[QA-2] 카드', JSON.stringify(card));
  expect(card.cls, '★카드가 `.prop-cell-card` 꼴이 아니다 — ⛔새 UI 언어를 발명하지 마라').toContain('prop-cell-card');
  expect(card.head, '★카드 머리가 식구 꼴(.prop-cell-card-header)이 아니다').toBe(true);
  expect(card.title, '★카드 제목이 식구 꼴(.prop-cell-card-title)이 아니다').toBe(true);
  expect(card.del, '★카드에 ✕(효과 삭제)가 없다 — 「원래대로」로 돌아갈 길').toBe(true);
  expect(errs, `★앱이 오류를 냈다: ${errs.join(' | ')}`).toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════
   ★소스 자 — ⛔금지선이 지켜졌나(발주 §2·§6). ★「화면에 없다」≠「코드에 없다」라
     DOM 으로 못 보는 칸은 ★소스로 잠근다(선례 fx-particles-panel D10 ⑶).
   ══════════════════════════════════════════════════════════════════════ */
test('U2-SCOPE ★금지선 — `js/fx/homography.js` 는 불러 쓰기만 · `HALF` 를 공용으로 빼지 않았다 · U3 자리 무접촉', async () => {
  /* ★★자를 ★먼저 적는다 — ★주석을 ★걷는다.
     ★까닭(실측 261023 · ★내 첫 빨강): 이 파일 머리말이 ★`HALF` 를 ★글자로 품어
       `/HALF/.test(src)` 가 ★true 를 냈다 ⇒ ★★「주석이 소스 파싱 게이트의 ★입력」이 된 그 자리다.
     ★걷는 부품은 ★이 벌이 ★쓰는 ★하나 — `tests/unit/_strip-comments.js`
       ⛔레포에 ★따로 걷는 자가 ★★«≥88 · ≤122» 있다 — `STRIP-COMMENTS-NOT-ONE-COMPONENT-01`
         (★≥88 = ★사용 자리 자 · ★≤122 = ★정의 자리 자 — ★자가 다르면 수가 갈린다)
       ★★단 ★★«공백을 ★지워 ★JS 소스를 ★견주는» 자는 ★★0 ⇒ ★위험 ★0 (261023 지디·u2 실측)
       ⇒ ★★그러니 ★이 수는 ★«고칠 일감»이 ★아니다 — ★그 부품을 고칠 때 ★안 따라온다는 ★사실만이다
       ⇒ ⛔새 정규식으로 주석을 걷지 않는다. */
  const { stripCommentsTA, templateBalanced } = require('../unit/_strip-comments.js');
  const raw = fs.readFileSync(path.join(ROOT, 'js/effects-freetransform.js'), 'utf8');
  expect(templateBalanced(raw), '★전제: 템플릿 리터럴 백틱이 짝이 맞다 — 안 맞으면 주석 걷기가 어긋난다').toBe(true);
  const ft = stripCommentsTA(raw);
  /* ★★자가 ★살아 있나 — ★같은 자로 ★주석을 걷기 «전»에는 ★`HALF` 가 ★잡힌다(머리말이 품었다) */
  expect(/HALF/.test(raw), '★★잣대 — 걷기 «전»에는 머리말의 HALF 가 잡힌다(안 잡히면 자가 죽었다)').toBe(true);
  /* ★U1 이 잠근 셈을 ★다시 적지 않았다 — ★불러 쓴다 */
  expect(/from '\.\/fx\/homography\.js'/.test(ft), '★호모그래피를 불러 쓰지 않는다 — 셈이 두 자리에 살면 갈린다').toBe(true);
  for (const name of ['homography', 'cornerMatrix3d', 'normalizeCorners', 'boxFromCorners']) {
    expect(new RegExp(`function\\s+${name}\\s*\\(`).test(ft), `★${name} 을 ★이 파일에 다시 짰다 — ⛔U1 이 잠갔다(명부가 둘이 된다)`).toBe(false);
  }
  /* ★`HALF` ★선언이 ★이 파일에 ★없다(U2 는 핸들을 안 그린다 ⇒ 쓸 자리가 없다).
     ★자 꼴은 ★설계 ⑦-⑶ 이 쓴 그것을 따른다 — ⛔「낱말이 있나」가 아니라 ★「선언이 있나」. */
  const HALF_DECL = /const\s+[A-Za-z_][A-Za-z_0-9]*HALF[A-Za-z_0-9]*\s*=/;
  expect(HALF_DECL.test(ft), '★U2 에 HALF 선언이 생겼다 — 핸들은 U3 다').toBe(false);
  /* ★★그 자의 ★음성대조 — ★같은 자를 ★`js/overlay-handles.js` 에 대면 ★잡힌다(≥1) */
  const oh = stripCommentsTA(fs.readFileSync(path.join(ROOT, 'js/overlay-handles.js'), 'utf8'));
  expect((oh.match(new RegExp(HALF_DECL.source, 'g')) || []).length,
    '★★잣대가 죽었다 — 같은 자로 js/overlay-handles.js 를 재도 0 이다(그러면 우리 0 은 증거가 아니다)').toBeGreaterThanOrEqual(1);
  /* ★★U3 자리 ★무접촉 — ⛔「안 고쳤다」는 미확인이다 ⇒ ★우리 이름이 ★그 둘에 ★0건 */
  for (const f of ['js/overlay-handles.js', 'js/editor.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(/freetransform|tfCorners/.test(s), `★${f} 에 우리 이름이 생겼다 — ★U3 자리는 이 단계가 아니다`).toBe(false);
  }
  /* ★★U1 의 그 파일이 ★안 바뀌었나 — ★이 벌이 ★그것도 잰다(⛔「안 고쳤다」는 미확인이다) */
  const hg = fs.readFileSync(path.join(ROOT, 'js/fx/homography.js'), 'utf8');
  for (const name of ['homography', 'cornerMatrix3d', 'normalizeCorners', 'boxFromCorners', 'edgePointAt']) {
    expect(new RegExp(`export function ${name}\\(`).test(hg), `★js/fx/homography.js 의 내보내기 ${name} 가 사라졌다`).toBe(true);
  }
  /* ★명부 한 줄 — ★index.html 에 ★우리 식구가 실렸다(⛔「등록만 하면 뜬다」의 그 한 줄) */
  const idx = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  expect((idx.match(/js\/effects-freetransform\.js/g) || []).length, '★index.html 의 명부 줄이 하나가 아니다').toBe(1);
  /* ★패널 파일 ★0줄 — 명부 합격 기준(「효과 하나 = 파일 하나 ＋ 한 줄」) */
  for (const f of ['js/props/prop-text.js', 'js/props/prop-text-template.js']) {
    const s = fs.readFileSync(path.join(ROOT, f), 'utf8');
    expect(/freetransform|tfCorners/.test(s), `★${f} 에 우리 이름이 생겼다 — 명부 합격 기준(패널 0줄)이 깨졌다`).toBe(false);
  }
});
