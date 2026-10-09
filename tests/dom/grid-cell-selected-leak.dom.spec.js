/* grid-cell-selected-leak.dom.spec.js — 「★빈 그리드 칸 선택 표시가 ★산출물로 샌다」 (1009t3 A4 · 2026-10-10)
 *
 * ★무엇이 있었나 (★행위로 쟀다 — ⛔소스 독해가 아니다)
 *   빈 칸을 ★사람의 길로 고르면(드릴다운 ⇒ 두 번 클릭) `.grd-cell-selected` 가 붙는데,
 *   그 클래스가 ★다섯 세척 명부 ★전부에 없어서 ★이렇게 샜다:
 *     저장본 1건 · ⌘C 섹션 클립보드 1건 · 템플릿 1건 · PNG 클론 1건
 *     섹션 비교 해시  `b8315380`(선택 전) → `805b8dc8`(고른 뒤)   ⇒ 협업 라이브 가드가 흔들린다
 *     ★★HTML 배송본 : 클래스 ＋ `#canvas .grid-block .grd-cell-selected` ★CSS 규칙이 ★같이 실려
 *                      ★배송본을 ★렌더하니 ★computed `rgb(45,111,232) 0 0 0 2px inset` — ★★그려졌다
 *
 * ★★«다시 열면 남나»는 ★거짓이었다 — 그 자리는 ★세척이 아니라 ★★«그리드 재렌더»가 가려 준다.
 *   실측으로 쪼갰다: 저장본 1 → innerHTML 주입 후 1 → ★열 때 세척 통과 후 ★★여전히 1 → rebindAll 후 0.
 *   ⇒ ★★«우연한 방어»다. 그래서 ★L2 는 ★«열기 세척» 그 연산만 ★따로 잰다 — 재렌더에 가려지지 않게.
 *
 * ★양성대조 판 = ★핀 `be4ebbc10c77` (`GD1001_ROOT=/Users/a1/.gd-work/t3a4/pin-be4ebbc1`).
 *   ⛔HEAD 를 판으로 쓰지 마라 — 고친 뒤엔 HEAD 가 곧 고친 판이라 대조가 전부 초록이 된다.
 *
 * ★각 칸의 ★전제를 ★그 칸 안에서 ★먼저 단언한다 — 「0개에서 0건」은 항등식이다.
 * 실행: npm run test:dom -- grid-cell-selected-leak
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

/** 섹션 1개 ＋ 그리드 1개(0열 = ★줄 0개인 «빈 칸», 1열 = 글자 줄). */
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  /* ⛔앱이 «뜬다»를 먼저 단언한다 — 안 뜨면 아래 모든 수가 «0개에서 0건»이 되어 조용히 초록이다. */
  expect(errs, `★앱 부팅에 pageerror ${errs.length}건 — 아래 측정은 전부 무효다:\n${errs.join('\n')}`).toEqual([]);
  const made = await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" data-name="S1" id="sec1">'
      + '<div class="section-hitzone" style="height:28px"></div><div class="section-inner" id="inner1"></div></div>');
    window.rebindAll?.();
    window.deselectAll?.();
    document.getElementById('sec1').classList.add('selected');
    const r = window.addGridBlock?.({ cols: [{ width: 1, lines: [] }, { width: 1, lines: [{ type: 'body', text: 'BBB' }] }] });
    window.__g = (r && r.block) || document.querySelector('#inner1 .grid-block');
    return {
      hasGrid: !!(window.__g && window.__g.isConnected),
      cells: document.querySelectorAll('#inner1 .grd-cell').length,
      c0lines: document.querySelectorAll('#inner1 .grd-cell[data-r="0"][data-c="0"] [data-line]').length,
    };
  });
  await page.waitForTimeout(250);
  expect(made.hasGrid, '★전제: addGridBlock 이 블럭을 안 세웠다').toBe(true);
  expect(made.cells, '★전제: 칸이 2개가 아니다 — 장면이 안 섰다').toBe(2);
  expect(made.c0lines, '★전제: 0열이 «빈 칸»이 아니다(줄이 있다) — 셀 모드로 안 내려간다').toBe(0);
  return errs;
}

/** ★사람의 길 — 진짜 마우스로 두 번(첫 클릭 = 블럭 선택 · 둘째 = 빈 칸). ⛔classList.add 로 심지 않는다. */
async function pickEmptyCell(page) {
  const cell = page.locator('#inner1 .grd-cell[data-r="0"][data-c="0"]');
  await cell.scrollIntoViewIfNeeded();
  await cell.click({ force: true });
  await page.waitForTimeout(120);
  await cell.click({ force: true });
  await page.waitForTimeout(200);
  /* ★전제 — 골라졌고, ★표시가 ★실제로 그려진다(계측기가 살아있다). */
  const s = await page.evaluate(() => {
    const e = document.querySelector('#canvas .grd-cell[data-r="0"][data-c="0"]');
    return { mark: document.querySelectorAll('#canvas .grd-cell-selected').length,
             shadow: e ? getComputedStyle(e).boxShadow : null };
  });
  expect(s.mark, '★전제: 빈 칸이 안 골라졌다 — 아래 「0건」은 아무것도 안 잰다').toBe(1);
  expect(s.shadow, '★전제: 선택 표시가 안 그려진다 — 「유령 테두리」를 잴 자가 죽었다').not.toBe('none');
}

/** 내보낸 단독 HTML 문자열을 가로챈다(다운로드는 막는다). */
const grabExport = (page) => page.evaluate(async () => {
  const OrigBlob = window.Blob;
  const origClick = HTMLAnchorElement.prototype.click;
  let body = null;
  HTMLAnchorElement.prototype.click = function () {};
  window.Blob = function (parts, o) { body = (parts || []).join(''); return new OrigBlob(parts, o); };
  try { await window.exportHTMLFile(); } catch (e) { body = 'THREW:' + (e && e.message); }
  window.Blob = OrigBlob;
  HTMLAnchorElement.prototype.click = origClick;
  return body;
});

/* ═══ L1 저장본 ═════════════════════════════════════════════════════════════ */
test('L1 ★저장본·⌘C 재료·템플릿에 0건이다 (＋음성대조)', async ({ page }) => {
  await setup(page);
  await pickEmptyCell(page);
  const r = await page.evaluate(() => {
    const C = (s) => (String(s).match(/grd-cell-selected/g) || []).length;
    const sec = document.getElementById('sec1');
    const out = {
      saved:    C(window.getSerializedCanvas()),
      proj:     C(window.serializeProject()),
      clipboard: C(window.serializeSectionClone(sec)),
      template: window.serializeCleanSelf(sec.cloneNode(true)).querySelectorAll('.grd-cell-selected').length,
      savedLen: window.getSerializedCanvas().length,
    };
    /* ★음성대조 — 선택을 풀면 «당연히» 0 이어야 한다. 둘이 같이 0 이면 자가 항등식이다. */
    window.deselectAll?.();
    out.afterDeselect = C(window.getSerializedCanvas());
    out.cellsStillThere = document.querySelectorAll('#canvas .grd-cell').length;
    return out;
  });
  expect(r.savedLen, '★전제: 저장 문자열이 비었다 — 이 0건은 항등식이다').toBeGreaterThan(200);
  expect(r.cellsStillThere, '★음성대조 전제: 칸이 사라졌다 — 비교 대상이 없다').toBe(2);
  expect(r.saved,     '★저장본에 샜다 — 다시 열어도 그 세션 내내 남고, 비교 키를 흔든다').toBe(0);
  expect(r.proj,      '★proj 직렬화에 샜다').toBe(0);
  expect(r.clipboard, '★⌘C 섹션 클립보드 문자열에 샜다 — 붙여넣는 쪽으로 옮겨간다').toBe(0);
  expect(r.template,  '★템플릿 저장본(serializeCleanSelf)에 샜다 — 꺼내 넣을 때마다 따라온다').toBe(0);
  expect(r.afterDeselect, '★음성대조: 선택을 풀었는데도 남았다').toBe(0);
});

/* ═══ L2 열기 세척 — ⛔재렌더에 가려지지 않게 «그 연산만» 잰다 ════════════════ */
test('L2 ★«열 때» 세척이 이 토큰을 벗긴다 — ⛔재렌더가 가려 주는 것에 기대지 않는다', async ({ page }) => {
  await setup(page);
  await pickEmptyCell(page);
  const r = await page.evaluate(() => {
    /* js/io/save-load.js stripLoadedRuntimeState 와 «같은 연산»이다(그쪽은 모듈 안에 있어 못 부른다). */
    const clone = document.getElementById('sec1').cloneNode(true);
    const before = clone.querySelectorAll('.grd-cell-selected').length;
    clone.querySelectorAll('[class]').forEach(window.runtimeMarkers.stripRuntimeMarkers);
    return { before, after: clone.querySelectorAll('.grd-cell-selected').length,
             // ★대조 — 명부에 «있는» 형제는 같은 연산에서 벗겨진다(자가 돌고 있다)
             reHandle: window.runtimeMarkers.isRuntimeMarker('zzz-line-selected') };
  });
  expect(r.before, '★전제: 클론에 마커가 없다 — 이 0건은 항등식이다').toBe(1);
  expect(r.reHandle, '★전제: 자가 죽었다(줄 마커 성질 묶음이 깨졌다)').toBe(true);
  expect(r.after, '★«열 때» 세척이 이 토큰을 못 벗긴다 — 이미 샌 저장물은 열어도 안 낫는다').toBe(0);
});

/* ═══ L3 ★배송본 — «실렸나»가 아니라 «그려지나» ══════════════════════════════ */
test('L3 ★HTML 배송본을 ★렌더해도 테두리가 안 그려진다 (＋음성대조)', async ({ page, context }) => {
  await setup(page);
  await pickEmptyCell(page);
  const body = await grabExport(page);
  expect(String(body).startsWith('THREW'), '★내보내기가 던졌다: ' + String(body).slice(0, 200)).toBe(false);

  const p2 = await context.newPage();
  await p2.route('**/*', (r) => r.fulfill({ contentType: 'text/html', body }));
  await p2.goto('http://export.a4.test/export.html');
  const r = await p2.evaluate(() => {
    const els = [...document.querySelectorAll('.grd-cell-selected')];
    return {
      n: els.length,
      shadows: els.map((e) => getComputedStyle(e).boxShadow),
      rule: [...document.styleSheets].some((ss) => {
        try { return [...ss.cssRules].some((x) => (x.selectorText || '').includes('grd-cell-selected')); }
        catch (_) { return false; }
      }),
      cellsTotal: document.querySelectorAll('.grd-cell').length,
      hasCanvasId: !!document.getElementById('canvas'),
    };
  });
  await p2.close();
  expect(r.cellsTotal, '★전제: 배송본에 그리드 칸이 없다 — 아래 0건은 항등식이다').toBe(2);
  expect(r.hasCanvasId, '★전제: 배송본에 #canvas 래퍼가 없다 — 그 CSS 규칙은 애초에 못 맞는다(자가 눈먼다)').toBe(true);
  expect(r.n, `★배송본에 클래스가 ${r.n}건 실렸다 — 받는 사람 화면에 «고르지도 않은 칸»의 테두리가 그려진다`).toBe(0);
  expect(r.shadows, '★배송본에서 테두리가 ★그려졌다').toEqual([]);
  expect(r.rule, '★편집 전용 CSS 규칙이 배송본 <style> 에 수확됐다 — 클래스를 벗겨도 규칙은 남지 않아야 한다').toBe(false);
});

/* ═══ L4 PNG·썸네일 공용 겹 ═════════════════════════════════════════════════ */
test('L4 ★PNG·썸네일 공용 겹(stripEditorOnlyForCapture)도 0건이다', async ({ page }) => {
  await setup(page);
  await pickEmptyCell(page);
  const r = await page.evaluate(async () => {
    const clone = document.getElementById('sec1').cloneNode(true);
    const before = clone.querySelectorAll('.grd-cell-selected').length;
    const mod = await import('/js/io/capture-safety.js');
    mod.stripEditorOnlyForCapture(clone);
    return { before, after: clone.querySelectorAll('.grd-cell-selected').length,
             // ★대조 — 같은 겹이 «이미 벗기던» 것은 그대로 벗긴다
             selAfter: clone.querySelectorAll('.selected').length };
  });
  expect(r.before, '★전제: 클론에 마커가 없다 — 항등식이다').toBe(1);
  expect(r.after, '★PNG·썸네일 공용 겹이 이 토큰을 안 벗긴다 — 산출물 바이트에 박힌다').toBe(0);
  expect(r.selAfter, '★대조: 같은 겹이 .selected 를 못 벗긴다 — 겹이 통째로 죽었다').toBe(0);
});

/* ═══ L5 ★협업·버전 비교 키 ═════════════════════════════════════════════════ */
test('L5 ★칸을 고른 것이 섹션 비교 해시를 움직이지 않는다', async ({ page }) => {
  await setup(page);
  const h0 = await page.evaluate(() => {
    window.deselectAll?.();
    return window.historyDiff.sectionGuardHash(document.getElementById('sec1'));
  });
  expect(h0, '★전제: 해시를 못 냈다(marketMerge/historyDiff 가 안 섰다)').toBeTruthy();
  await pickEmptyCell(page);
  const h1 = await page.evaluate(() => window.historyDiff.sectionGuardHash(document.getElementById('sec1')));
  expect(h1, `★칸을 «고르기만» 했는데 비교 해시가 ${h0} → ${h1} 로 움직였다 — 협업 라이브 가드가 「체크포인트 후 원격 변경」으로 읽어 스코프 되돌리기를 포기한다`).toBe(h0);
});

/* ═══ L6 ★형제 — item-selected 도 같은 축 ══════════════════════════════════ */
test('L6 ★라벨 항목 선택(item-selected)도 저장본·비교 해시를 안 흔든다', async ({ page }) => {
  await setup(page);
  const pre = await page.evaluate(() => {
    window.deselectAll?.();
    document.getElementById('sec1').classList.add('selected');
    const r = window.addLabelGroupBlock?.({});
    const lg = (r && r.block) || document.querySelector('#inner1 .label-group-block');
    return { ok: !!lg, items: lg ? lg.querySelectorAll('.label-item').length : 0 };
  });
  expect(pre.ok && pre.items > 0, `★전제: 라벨 그룹 장면을 못 세웠다: ${JSON.stringify(pre)}`).toBe(true);
  await page.waitForTimeout(200);
  const h0 = await page.evaluate(() => {
    window.deselectAll?.();
    return { hash: window.historyDiff.sectionGuardHash(document.getElementById('sec1')),
             live: document.querySelectorAll('#canvas .item-selected').length };
  });
  expect(h0.live, '★전제: 고르기 전에 이미 붙어 있었다').toBe(0);
  const li = page.locator('#inner1 .label-group-block .label-item').first();
  await li.click({ force: true });
  await page.waitForTimeout(120);
  await li.click({ force: true });
  await page.waitForTimeout(220);
  const r = await page.evaluate(() => ({
    live: document.querySelectorAll('#canvas .item-selected').length,
    hash: window.historyDiff.sectionGuardHash(document.getElementById('sec1')),
    saved: (window.getSerializedCanvas().match(/item-selected/g) || []).length,
  }));
  expect(r.live, '★전제: 라벨 항목이 안 골라졌다 — 아래 수는 아무것도 안 잰다').toBe(1);
  expect(r.saved, '★저장본에 item-selected 가 샜다').toBe(0);
  expect(r.hash, `★라벨 항목을 고른 것이 비교 해시를 ${h0.hash} → ${r.hash} 로 움직였다`).toBe(h0.hash);
});
