/* sz27-partial-format-wall.dom.spec.js — ★수지 ②⑦ «부분 선택 서식» 의 ★벽을 ★재서 ★적어 둔 것.
 *   수지② 「모달블럭에서 텍스트 영역 선택한 만큼 안 됨」
 *   수지⑦ 「그리드 블럭 칸 추가 줄도 영역선택 텍스트 스타일 변경(일반 텍스트블럭처럼)」
 *   ⚠️출처는 ★2차다(server-manager → 지디 전달문) — ⛔「원문」이 아니다.
 *
 * ★★이 파일은 ★«측정 기록»이다. ★고치는 일이 ★아니다.
 *   ⛔그래서 ★전부 `test.skip` 이다 — ★돌면 ★지금의 «깨진 동작»을 ★잠가 버린다(고치면 빨개진다).
 *   ★★고치는 사람은 ⒜ skip 을 떼고 ⒝ 아래 ★단언을 ★뒤집어라(「사라진다」 → 「산다」).
 *   ★머리말의 수는 ★2026-10-08 03시 실측이다(판 = origin/dev 91b93612 이전, 커밋 9429f9ae).
 *
 * ══ ★★무엇을 쟀나 — ★전제 ★셋을 ★단언하고 ★진짜 마우스·키로 ════════════════════════
 *   ⑴ 글자를 넣고 ★모델/dataset 에 들어간 것을 확인(전제A)
 *   ⑵ 다시 들어가 ★끝 3글자만 골라 «CCC» 임을 확인(전제B)
 *   ⑶ `execCommand('bold')` 가 ★<b> 를 만든 것을 확인(전제C)
 *   ⑷ 편집을 끝내고 → ★재렌더를 한 번 일으켜 ★<b> 가 ★사는지 본다
 *
 *   ┌────────┬──────────────────────┬──────────┬──────────────────────┬──────────────────┐
 *   │        │ 전제A 모델/dataset   │ 전제B    │ execCommand 직후     │ ★★재렌더 뒤      │
 *   ├────────┼──────────────────────┼──────────┼──────────────────────┼──────────────────┤
 *   │ ⑦ 그리드│ text:"AAABBBCCC"     │ "CCC"    │ AAABBB<b>CCC</b> b=1 │ AAABBBCCC ★b=0   │
 *   │ ② 모달  │ textText:"AAABBBCCC" │ "CCC"    │ AAABBB<b>CCC</b> b=1 │ AAABBBCCC ★b=0   │
 *   └────────┴──────────────────────┴──────────┴──────────────────────┴──────────────────┘
 *   ⇒ ★증상의 기전 = 「★걸리는 것처럼 ★보이다가 ★재렌더에서 ★사라진다」.
 *
 * ══ ★★까닭(소스로 확인한 자리) ═════════════════════════════════════════════════
 *   ⑦ `js/block-drag.js` `_gridEndEdit` — 글자를 ★`innerText`(평문)로 읽고,
 *      커밋 ★직전에 `host.textContent = before` 로 ★DOM 을 평문으로 ★되돌린 뒤
 *      모델에 ★문자열만 커밋한다. 렌더러 `js/blocks/grid-block.js` 는 `_esc(line.text)` 로
 *      ★마크업을 ★escape 한다.
 *   ② `js/block-drag.js` `_mdlReadText` → `commitModalSlot(block, slot, text)` 로 ★문자열만.
 *      렌더러 `js/blocks/modal-block.js` 는 `_esc(shown)`.
 *      ★★그 파일 ★322행이 ★이미 적어 두었다:
 *        「⚠️슬롯은 _esc() 평문이라 «부분 선택»은 ★원리적으로 불가하다 — 슬롯 전체가 칠해진다」
 *   ★서식은 ★줄/슬롯 ★전체에 ★모델 필드(fontSize·weight·italic·strike·color·fontFamily)로 걸린다.
 *   ★`getSelection` 수: `js/props/prop-grid.js` ★0 · `js/blocks/grid-block.js` ★0.
 *
 * ══ ★★그러면 무엇이 필요한가 — ★선례가 ★이미 있다 ══════════════════════════════
 *   `js/blocks/sticker-block.js` 의 ★«U6b 리치텍스트»:
 *     · `dataset.textHtml` 에 ★부분 서식 HTML (평문 `dataset.text` 와 ★나란히 ⇒ 없으면 옛 경로 = ★무회귀)
 *     · `_sanitizeStickerHtml()` — ★정규식 아님, ★DOM 순회 ＋ `<template>` 파싱(실행 컨텍스트 없음)
 *     · 허용 태그 B STRONG I EM U S ★STRIKE BR SPAN · 허용 style prop 5 · ★값도 화이트리스트
 *     · ★렌더·로드마다 ★재-sanitize(저장본 변조 대비)
 *     · ★그 파일 38~40행이 ★같은 함정을 적어 뒀다: 「STRIKE 가 허용목록에 없으면 ⌘⇧X 취소선이
 *       커밋 순간 언랩돼 ★«되는 척»만 하고 사라진다」 ⇒ ★위 표와 ★같은 꼴. ★이미 한 번 앓은 병이다.
 *   ⛔그런데 ★셋이 걸린다(판정 필요 — 지디):
 *     ① 그 sanitizer 는 ★공용 모듈이 ★아니다(`window._sanitizeStickerHtml` 전역만, export 없음)
 *        ⇒ 베끼면 ★명부가 둘. 뽑으면 ★남의 돌아가는 코드를 건드린다.
 *     ② ★그 선례를 재는 ★검사가 ★0건이다(`grep -rln 'textHtml|sanitizeSticker' tests/` → 없음)
 *     ③ 스티커의 부분 서식은 ★캔버스 편집 길(네이티브 ⌘B/⌘I/⌘⇧X)에서 나온다 —
 *        `prop-sticker.js` getSelection ★0 · execCommand ★0, 소스 주석도 「패널 버튼 연동은 ★후속」.
 *        ⇒ 수지 요청의 ★«패널에서» 부분은 ★선례가 없고, ⑤⑥ 의 wireDecoBtn·wireInlineStyleBtn 이 그 자리다.
 *
 * ══ ★★범위 — ⛔내 금지선 ══════════════════════════════════════════════════════
 *   ⑦ 가 손대야 하는 자리에 ★`js/props/prop-grid.js` 가 있다 — ★지디 소관이고 ★내 금지선이다.
 *      분모: `line.text`/`lines[]` 를 읽는 자리 ★레포 39건 · 공유 골든
 *      `tests/dom/fixtures/{grid-panel,grid-cellpady-y0,grid-flatten-y0,bt2-grid-panel}-golden.json` ★4개(지디 소관).
 *   ② 는 ★전부 내 범위(`modal-block.js` · `prop-modal.js` · `block-drag.js`).
 *      분모: 슬롯 키(titleText·textText·cell1·cell2)를 읽는 자리 ★21건 / 5파일
 *      (block-drag · modal-block · ★modal-frameify · canvas-block · export-figma-json).
 *
 * ⛔이 하네스로 «못 재는» 축: ★붙여넣기 경로 · Electron 재기동 · 네이티브 메뉴 · 다른 배율(100% 에서만 쟀다).
 * 실행(일부러 skip 이다): npx playwright test --config=tests/dom/playwright.dom.config.js sz27-partial-format-wall
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const TXT = 'AAABBBCCC';

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}
/* 더블클릭 → 전체선택 → 타이핑 → 바깥클릭(커밋). ★글자를 «모델에» 넣는 단계. */
async function typeInto(page, sel, text) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
  await page.waitForTimeout(200);
  await page.mouse.click(800, 960);
  await page.waitForTimeout(500);
}
/* 다시 들어가 ★끝 3글자만. ⛔`Home` 은 이 글자칸들에서 안 먹었다(실측) — `End` 기준으로 센다. */
async function selectTail3(page, sel) {
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
  return page.evaluate(() => { const s = getSelection();
    return { rc: s.rangeCount, col: s.isCollapsed, str: s.toString() }; });
}

test.skip('W-⑦ 그리드 칸 — 부분 서식이 ★재렌더에서 사라진다 (2026-10-08 측정 기록)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addGridBlock?.({});
    const f = [...document.querySelectorAll('#canvas .grid-block')].filter(e => !before.has(e.id));
    return f[f.length - 1]?.id || null;
  });
  const sel = `#${id} .grd-line`;
  await typeInto(page, sel, TXT);
  const m0 = await page.evaluate((i) => JSON.stringify(
    window.getGridModel?.(document.getElementById(i))?.cells?.[0]?.[0]?.lines?.[0]), id);
  expect(m0, '★전제A — 타이핑한 글자가 모델에 안 들어갔다').toContain(TXT);

  const s = await selectTail3(page, sel);
  expect(s, `★전제B — 끝 3글자가 안 골라졌다. 잰 값 ${JSON.stringify(s)}`).toEqual({ rc: 1, col: false, str: 'CCC' });

  const cmd = await page.evaluate((i) => { document.execCommand('bold');
    const l = document.getElementById(i).querySelector('.grd-line');
    return { html: l.innerHTML, b: l.querySelectorAll('b,strong').length }; }, id);
  expect(cmd.b, `★전제C — execCommand 가 <b> 를 안 만들었다. 잰 값 ${JSON.stringify(cmd)}`).toBeGreaterThan(0);

  await page.mouse.click(800, 960);
  await page.waitForTimeout(500);
  const afterRender = await page.evaluate((i) => {
    window.renderGridBlock?.(document.getElementById(i));
    const l = document.getElementById(i).querySelector('.grd-line');
    return { html: l.innerHTML, b: l.querySelectorAll('b,strong').length }; }, id);
  console.log('  W-⑦ 재렌더 뒤:', JSON.stringify(afterRender));
  /* ★★지금의 «깨진» 동작을 ★기록한다. ★고치는 사람은 ★이 단언을 ★뒤집어라(toBe(1) 로). */
  expect(afterRender.b, `★★부분 서식이 재렌더를 ★견딘다면 이 기록이 낡았다 — 단언을 뒤집어라. 잰 값 ${JSON.stringify(afterRender)}`).toBe(0);
  expect(errs).toEqual([]);
});

test.skip('W-② 모달 슬롯 — 부분 서식이 ★재렌더에서 사라진다 (2026-10-08 측정 기록)', async ({ page }) => {
  const errs = await setup(page);
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addModalBlock?.({});
    const f = [...document.querySelectorAll('#canvas .modal-block')].filter(e => !before.has(e.id));
    return f[f.length - 1]?.id || null;
  });
  const sel = `#${id} [data-mdl-slot="text"]`;
  await typeInto(page, sel, TXT);
  /* ⛔dataset 키는 `text` 가 ★아니라 ★`textText` 다 — 그걸 몰라 `undefined` 를 받고
     「모달은 글자가 커밋 안 된다」로 읽을 뻔했다(modal-block.js:525·642 · block-drag.js:293 의 표). */
  const ds0 = await page.evaluate((i) => ({ ...document.getElementById(i).dataset }), id);
  expect(ds0.textText, '★전제A — 타이핑한 글자가 dataset.textText 에 안 들어갔다').toBe(TXT);

  const s = await selectTail3(page, sel);
  expect(s, `★전제B — 끝 3글자가 안 골라졌다. 잰 값 ${JSON.stringify(s)}`).toEqual({ rc: 1, col: false, str: 'CCC' });

  const cmd = await page.evaluate((i) => { document.execCommand('bold');
    const e = document.getElementById(i).querySelector('[data-mdl-slot="text"]');
    return { html: e.innerHTML, b: e.querySelectorAll('b,strong').length }; }, id);
  expect(cmd.b, `★전제C — execCommand 가 <b> 를 안 만들었다. 잰 값 ${JSON.stringify(cmd)}`).toBeGreaterThan(0);

  await page.mouse.click(800, 960);
  await page.waitForTimeout(500);
  const afterRender = await page.evaluate((i) => {
    window.renderModalBlock?.(document.getElementById(i));
    const e = document.getElementById(i).querySelector('[data-mdl-slot="text"]');
    return { html: e ? e.innerHTML : null, b: e ? e.querySelectorAll('b,strong').length : -1 }; }, id);
  console.log('  W-② 재렌더 뒤:', JSON.stringify(afterRender));
  expect(afterRender.b, `★★부분 서식이 재렌더를 ★견딘다면 이 기록이 낡았다 — 단언을 뒤집어라. 잰 값 ${JSON.stringify(afterRender)}`).toBe(0);
  expect(errs).toEqual([]);
});
