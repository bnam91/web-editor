/* text-style-recent — ⑶ ★「저장한 스타일 복사」 = ★최근 효과 줄. (2026-10-08 현빈 직접 지시)
 *   원문: 「★저장한 스타일도 ★복사할수 있게 해달라고 했잖아. ★프리셋을 추가할 수 있게 ★하든
 *          ★혹은 ★최근 스타일을 선택할 수 있게 말야」
 *   ＋ 지디 notes ★T14 「★그 형광펜 스타일로 ★다른 텍스트에 하려는데 ★매번 설정을 ★복붙하기가 ★귀찮아」
 *     ★T15 「★최근 형광펜처럼 … ★마찬가지 ★최근 효과 뜨게」 ⇒ ★T14 와 ★★같은 기계여야 한다.
 *
 * ★★왜 ★저장소까지 ★여기서 재나(⛔unit 이 아니라) —
 *   js/design-system.js 는 ★IIFE 이고 ★document·localStorage·electronAPI 를 ★쓴다.
 *   ★vm 스텁을 지어 재면 ★그 스텁이 틀렸을 때 ★«검사가 한 환경에서만 참»이 된다.
 *   ⇒ ★실제 앱이 뜬 ★그 환경에서 ★그 함수를 ★불러 잰다. ⛔더 싼 계측기를 ★발명하지 않는다.
 *
 * 재는 것
 *   A1 ★전제 — 세 함수가 ★실재하고 ★빈 판에서 ★0건 (★안 서면 아래가 전부 공허하다)
 *   A2 ★맨 앞으로 ＋ ★같은 값 두 번 = ★쓰기 없음
 *   A3 ★MAX 넘으면 ★뒤에서 버린다 — ★MAX 를 ★정의 자리에서 ★읽는다(⛔맨숫자 금지)
 *   A4 ★kind 가 ★안 섞인다 (hl push 가 dot 큐를 ★안 바꾼다)
 *   A5 ★모르는 꼴은 ★버린다 (중첩 객체·NaN·빈 객체)
 *   A6 ★창 안 연속 = ★맨 앞을 ★덮는다 / ★창 밖 = ★쌓인다 — ★창을 ★상수에서 읽는다
 *   B1 ★meta 에 ★없으면 ★빈 목록 (⛔직전 프로젝트 것이 ★안 남는다)
 *   B2 ★meta 가 ★이긴다 (localStorage 와 ★다른 값을 넣어 ★갈라 본다)
 *   B3 ★push 가 ★정본(meta)에 ★쓴다 — saveProjectMeta 호출을 ★센다
 *   C1 ★줄 — 0건이면 ★없고, 쌓이면 ★열린다
 *   C2 ★★양성 — 두 스타일을 쓰면 칩 ★2개 · ★누르면 ★그 스타일이 ★그려진다(★픽셀로)
 *   C3 ★★«다른 텍스트에» — 블럭 A 에서 쓰고 ★블럭 B 에 ★입힌다 (★T14 원문의 ★그 요구)
 *   C4 ★음성 — 칩을 눌러도 ★«그 효과만» 바뀐다 (폰트·크기·글자색 ★불변)
 *   C5 ★★칩이 ★글 블럭 ★밖이다 — ★제품의 ★다섯 조회가 ★안 속는다 ＋ ★양성대조(안에 넣으면 ★잡힌다)
 *   C6 ★저장 왕복 — 저장본(meta)에 실리고 ★다시 열어도 산다
 *   M  ★MAX 를 ★재는 법 — 줄 가용폭·칩폭·gap 을 ★찍는다(⛔단언이 아니라 ★기록 — 상수를 ★그 수로 둔다)
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 재기동 · 실제 meta.json 파일 · 네이티브 메뉴.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-style-recent
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff;padding:80px 0 0 80px"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const HL_A = '#ffd400';   // 글자(#555)·흰 배경과 안 섞이는 두 색 — 그림에서 획만 골라 센다
const HL_B = '#22aa55';

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.(); window.applyZoom?.(100);
    document.getElementById('sA').classList.add('selected');
    try { localStorage.removeItem('we_text_style_history_v1'); } catch (_) {}
  }, SEC);
  await page.waitForTimeout(250);
  return errs;
}
const insertText = (page, content) => page.evaluate((t) => {
  const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
  document.getElementById('sA').classList.add('selected');
  window.addTextBlock('body', { content: t });
  const fresh = [...document.querySelectorAll('#canvas .text-block')].filter(e => !before.has(e.id));
  return fresh.length ? fresh[fresh.length - 1].id : null;
}, content);
const openPanel = async (page, id) => {
  await page.evaluate((i) => window.showTextProperties(document.getElementById(i)), id);
  await page.waitForSelector('#txt-style-group', { state: 'attached' });
};
async function clickSel(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box: ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(220);
}
async function typeField(page, sel, v) {
  await page.fill(sel, String(v));
  await page.press(sel, 'Enter');
  await page.waitForTimeout(180);
}
/* 형광펜을 켜고 ★색·바 높이를 ★패널로 고친다 — ★commit 이 나야 큐에 쌓인다. */
async function makeHighlight(page, id, hex, h) {
  await openPanel(page, id);
  const on = await page.evaluate((i) => !!document.querySelector(`#${i} span.tb-hl`), id);
  if (!on) await clickSel(page, '#txt-highlight-btn');
  await page.evaluate(([i, c]) => document.getElementById(i).style.setProperty('--tb-hl-color', c), [id, hex]);
  await typeField(page, '#txt-hl-h-num', h);          // ★이 commit 이 쌓는다
}
const hist = (page, k) => page.evaluate((kk) => window.DesignSystem.getTextStyleHistory(kk), k);

/* ══ A — 저장소 ═══════════════════════════════════════════════════════════ */

test('A1~A6 ★저장소 — 맨 앞·중복 없음·MAX·kind 분리·꼴 거르기·창 덮기', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(() => {
    const DS = window.DesignSystem;
    const out = { api: {}, };
    out.api.get = typeof DS?.getTextStyleHistory;
    out.api.push = typeof DS?.pushTextStyleHistory;
    out.api.restore = typeof DS?.restoreTextStyleHistoryFromMeta;
    out.MAX = DS?.TEXT_STYLE_HISTORY_MAX;
    out.WIN = DS?.TEXT_STYLE_COALESCE_MS;
    if (out.api.push !== 'function') return out;
    const T0 = 1000000;
    const far = (n) => T0 + n * (out.WIN + 1000);        // ★창 ★밖 — 쌓인다
    out.empty = DS.getTextStyleHistory('hl').length;

    // A2 맨 앞으로 ＋ 같은 값 두 번 = 쓰기 없음
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': '#ff0000' }, { now: far(1) });
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': '#00ff00' }, { now: far(2) });
    out.afterTwo = DS.getTextStyleHistory('hl').map(r => r.v['--tb-hl-color']);
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': '#00ff00' }, { now: far(3) });
    out.afterSame = DS.getTextStyleHistory('hl').map(r => r.v['--tb-hl-color']);

    // A3 MAX — 정의 자리에서 읽은 수 + 2 만큼 넣는다
    for (let i = 0; i < out.MAX + 2; i++) DS.pushTextStyleHistory('hl', { '--tb-hl-h': `${i + 10}%` }, { now: far(10 + i) });
    out.capped = DS.getTextStyleHistory('hl').length;
    out.cappedHead = DS.getTextStyleHistory('hl')[0].v['--tb-hl-h'];

    // A4 kind 분리
    out.dotBefore = DS.getTextStyleHistory('dot').length;
    DS.pushTextStyleHistory('dot', { '--tb-dot-size': '9px' }, { now: far(100) });
    out.dotAfter = DS.getTextStyleHistory('dot').length;
    out.hlUnchanged = DS.getTextStyleHistory('hl').length;

    // A5 모르는 꼴은 버린다
    const n0 = DS.getTextStyleHistory('ul').length;
    DS.pushTextStyleHistory('ul', { bad: { deep: 1 } }, { now: far(200) });   // 중첩 → 키가 다 버려져 빈 객체 ⇒ 안 쌓임
    DS.pushTextStyleHistory('ul', { n: NaN }, { now: far(201) });
    DS.pushTextStyleHistory('ul', {}, { now: far(202) });
    DS.pushTextStyleHistory('ul', null, { now: far(203) });
    out.ulAfterBad = DS.getTextStyleHistory('ul').length - n0;
    DS.pushTextStyleHistory('ul', { '--tb-ul-thick': '6px', junk: { a: 1 } }, { now: far(204) });
    out.ulKept = DS.getTextStyleHistory('ul')[0] ? Object.keys(DS.getTextStyleHistory('ul')[0].v) : null;

    // A6 창 안이면 맨 앞을 덮는다 / 창 밖이면 쌓인다
    try { localStorage.removeItem('we_text_style_history_v1'); } catch (_) {}
    DS.pushTextStyleHistory('grad', { css: 'linear-gradient(90deg,#111 0%,#222 100%)' }, { now: T0 });
    DS.pushTextStyleHistory('grad', { css: 'linear-gradient(90deg,#333 0%,#444 100%)' }, { now: T0 + out.WIN - 1 });
    out.inWindow = DS.getTextStyleHistory('grad').length;
    DS.pushTextStyleHistory('grad', { css: 'linear-gradient(90deg,#555 0%,#666 100%)' }, { now: T0 + out.WIN * 3 });
    out.outWindow = DS.getTextStyleHistory('grad').length;
    return out;
  });
  console.log('  A:', JSON.stringify(r));
  // A1 전제
  expect(r.api, '★전제 — 세 함수가 ★없다. 아래가 전부 공허하다').toEqual({ get: 'function', push: 'function', restore: 'function' });
  expect(typeof r.MAX, '★전제 — MAX 상수를 ★안 내보낸다(검사가 맨숫자를 박게 된다)').toBe('number');
  expect(typeof r.WIN, '★전제 — 창 상수를 ★안 내보낸다').toBe('number');
  expect(r.empty, `★전제 — 빈 판에서 ${r.empty}건이다`).toBe(0);
  // A2
  expect(r.afterTwo, '★새 것이 ★맨 앞이 아니다').toEqual(['#00ff00', '#ff0000']);
  expect(r.afterSame, '★같은 값을 ★또 넣었더니 ★쌓였다 — 「맨 앞과 같으면 쓰기 없음」이 죽었다').toEqual(['#00ff00', '#ff0000']);
  // A3
  expect(r.capped, `★MAX(${r.MAX})를 넘겨 넣었는데 ${r.capped}건이다`).toBe(r.MAX);
  expect(r.cappedHead, '★가장 ★새 것이 ★안 남았다 — 앞이 아니라 뒤를 버린 것이다').toBe(`${r.MAX + 11}%`);
  // A4
  expect(r.dotBefore, '★전제 — dot 큐가 비어 있지 않다').toBe(0);
  expect(r.dotAfter, '★dot 에 넣었는데 ★안 쌓였다').toBe(1);
  expect(r.hlUnchanged, '★dot 에 넣었더니 ★hl 큐가 ★바뀌었다 — kind 가 ★섞인다').toBe(r.MAX);
  // A5
  expect(r.ulAfterBad, `★모르는 꼴 ★넷을 넣었는데 ${r.ulAfterBad}건이 ★쌓였다`).toBe(0);
  expect(r.ulKept, '★모르는 키를 ★안 버렸다').toEqual(['--tb-ul-thick']);
  // A6
  expect(r.inWindow, `★창(${r.WIN}ms) ★안에서 ★연달아 넣었는데 ${r.inWindow}건이 됐다 — 맨 앞을 ★안 덮는다`).toBe(1);
  expect(r.outWindow, `★창 ★밖에서 넣었는데 ${r.outWindow}건이다 — ★쌓여야 한다(아니면 ★창이 ★항상 참이다)`).toBe(2);
});

test('B1~B3 ★정본은 meta — 없으면 빈 목록 · meta 가 이긴다 · push 가 meta 에 쓴다', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    const DS = window.DesignSystem;
    const out = {};
    const KEY = 'we_text_style_history_v1';
    window.activeProjectId = 'p-test';
    // ── B1 meta 에 없으면 ★빈 목록 (캐시에 ★뭔가 있어도) ──
    localStorage.setItem(KEY, JSON.stringify({ hl: [{ v: { '--tb-hl-color': '#aaaaaa' }, t: 1 }] }));
    out.cacheBefore = DS.getTextStyleHistory('hl').length;
    window.electronAPI = { loadProjectMeta: async () => ({}), saveProjectMeta: async () => true };
    await DS.restoreTextStyleHistoryFromMeta('p-test');
    out.afterNoMeta = DS.getTextStyleHistory('hl').length;
    // ── B2 meta 가 ★이긴다 ──
    localStorage.setItem(KEY, JSON.stringify({ hl: [{ v: { '--tb-hl-color': '#cccccc' }, t: 1 }] }));
    window.electronAPI = { loadProjectMeta: async () => ({ textStyleHistory: { hl: [{ v: { '--tb-hl-color': '#123456' }, t: 2 }] } }), saveProjectMeta: async () => true };
    await DS.restoreTextStyleHistoryFromMeta('p-test');
    out.afterMeta = DS.getTextStyleHistory('hl').map(x => x.v['--tb-hl-color']);
    // ── B3 push 가 ★meta 에 쓴다 ──
    const calls = [];
    window.electronAPI = { loadProjectMeta: async () => ({}), saveProjectMeta: async (pid, patch) => { calls.push(patch); return true; } };
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': '#abcdef' });
    await new Promise(r2 => setTimeout(r2, 50));
    out.metaCalls = calls.length;
    out.metaHasKey = calls.some(c => c && c.textStyleHistory && Array.isArray(c.textStyleHistory.hl));
    return out;
  });
  console.log('  B:', JSON.stringify(r));
  expect(r.cacheBefore, '★전제 — 캐시에 넣은 것이 ★안 읽힌다(자가 고장났다)').toBe(1);
  expect(r.afterNoMeta, '★meta 에 ★없는데 ★캐시가 ★남았다 — ★직전 프로젝트 것이 ★따라온다(컬러 «변수»가 앓는 그 병)').toBe(0);
  expect(r.afterMeta, '★meta 가 ★안 이겼다').toEqual(['#123456']);
  expect(r.metaCalls, '★push 가 ★정본(meta)에 ★안 썼다 — 작업 캐시에만 남으면 ★프로젝트를 옮기면 사라진다').toBeGreaterThan(0);
  expect(r.metaHasKey, '★meta 에 ★textStyleHistory 가 ★안 실렸다').toBe(true);
});

/* ══ C — UI ══════════════════════════════════════════════════════════════ */

test('C1·C2 ★최근 줄 — 0건이면 없고, 쌓이면 열리고, 누르면 그려진다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page, 'AAAAAA');
  await openPanel(page, id);
  // ── C1 전제: 0건이면 ★줄이 숨어 있다 ──
  const c1 = await page.evaluate(() => {
    const row = document.getElementById('txt-hl-recent-row');
    return { exists: !!row, hidden: row ? row.hidden : null, chips: row ? row.querySelectorAll('.ts-chip').length : null };
  });
  expect(c1.exists, '★최근 줄 자리가 ★마크업에 ★없다').toBe(true);
  expect(c1.hidden, `★0건인데 ★줄이 ★떠 있다. 잰 값 hidden=${c1.hidden} chips=${c1.chips}`).toBe(true);

  // 두 스타일을 만든다(색이 다르다 ⇒ 칩 둘)
  await makeHighlight(page, id, HL_A, 40);
  await page.waitForTimeout(50);
  await makeHighlight(page, id, HL_B, 80);
  /* ⚠️★여기서 ★둘이 ★한 벌로 ★합쳐질 수 있다 — ★창(TEXT_STYLE_COALESCE_MS) ★안에 들어가면
       ★뒤엣것이 ★앞엣것을 ★덮는다(A6 가 그 규약을 잰다). ★실측: 이 하네스에선 ★1건이 된다.
     ⇒ ★★「칩이 ★여럿일 때 ★여럿 그려지나」는 ★따로 세운다 — ★창 ★밖 시각을 ★주어 ★한 건을 ★더 넣는다.
       ⛔UI 로 4초를 ★기다려 만들지 않는다(검사가 ★느려지고 ★그만큼 ★흔들린다). */
  await page.evaluate(([c, h]) => {
    const DS = window.DesignSystem;
    DS.pushTextStyleHistory('hl', { '--tb-hl-color': c, '--tb-hl-h': h, '--tb-hl-y': '0px' },
      { now: Date.now() + DS.TEXT_STYLE_COALESCE_MS * 2 });
  }, ['#3300ff', '70%']);
  const list = await hist(page, 'hl');
  expect(list.length, `★둘이 ★안 쌓였다 — 큐 ${list.length}건`).toBeGreaterThanOrEqual(2);

  await openPanel(page, id);
  const c2 = await page.evaluate(() => {
    const row = document.getElementById('txt-hl-recent-row');
    return { hidden: row.hidden, chips: row.querySelectorAll('.ts-chip').length,
             prevCls: [...row.querySelectorAll('.ts-chip-prev')].map(e => e.className),
             label: row.querySelector('.cv-chips-label')?.textContent };
  });
  console.log('  C2:', JSON.stringify(c2), '· 큐', list.length);
  expect(c2.hidden, '★쌓였는데 ★줄이 ★안 열렸다').toBe(false);
  expect(c2.chips, `★칩 수가 ${c2.chips} 다 — 큐 ${list.length}건과 ★같아야 한다`).toBe(list.length);
  expect(c2.prevCls.every(c => c.includes('tb-hl')), `★미리보기가 ★제품 클래스를 ★안 입었다. 잰 값 ${JSON.stringify(c2.prevCls)}`).toBe(true);
  expect(c2.label, '★라벨이 ★「최근」이 아니다').toBe('최근');
  expect(errs, `★페이지 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('C3·C4 ★«다른 텍스트에» — 블럭 B 에 입히고, 그 효과만 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  const idA = await insertText(page, 'AAAAAA');
  await makeHighlight(page, idA, HL_A, 40);
  const want = (await hist(page, 'hl'))[0];
  expect(want && want.v, '★전제 — 큐에 ★한 벌이 ★안 쌓였다').toBeTruthy();

  const idB = await insertText(page, 'BBBBBB');
  await openPanel(page, idB);
  // ── C4 음성 — 누르기 «전»의 글자 꼴을 적어 둔다 ──
  const before = await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('.tb-body');
    const cs = getComputedStyle(ce);
    return { font: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, color: cs.color, hl: !!ce.querySelector('span.tb-hl') };
  }, idB);
  expect(before.hl, '★전제 — B 에 ★이미 형광펜이 있다(그러면 ★입혔다를 못 가른다)').toBe(false);

  await clickSel(page, '#txt-hl-recent-row .ts-chip');
  await page.waitForTimeout(250);
  const after = await page.evaluate((i) => {
    const tb = document.getElementById(i);
    const ce = tb.querySelector('.tb-body');
    const cs = getComputedStyle(ce);
    const tbcs = getComputedStyle(tb);
    return { font: cs.fontFamily, size: cs.fontSize, weight: cs.fontWeight, color: cs.color,
             hl: !!ce.querySelector('span.tb-hl'),
             color_v: tbcs.getPropertyValue('--tb-hl-color').trim(), h: tbcs.getPropertyValue('--tb-hl-h').trim() };
  }, idB);
  console.log('  C3/C4:', JSON.stringify({ before, after, want: want.v }));
  // ── C3 양성 ──
  expect(after.hl, '★★칩을 눌렀는데 ★B 에 형광펜이 ★안 걸렸다 — T14 가 요구한 ★그것이다').toBe(true);
  expect(after.color_v.toLowerCase(), `★입힌 ★색이 다르다. 잰 ${after.color_v} / 뜬 ${want.v['--tb-hl-color']}`).toBe(String(want.v['--tb-hl-color']).toLowerCase());
  expect(after.h, `★입힌 ★바 높이가 다르다. 잰 ${after.h} / 뜬 ${want.v['--tb-hl-h']}`).toBe(want.v['--tb-hl-h']);
  // ── C4 음성 — ★그 효과만 ──
  expect({ font: after.font, size: after.size, weight: after.weight, color: after.color },
    '★칩을 눌렀더니 ★폰트·크기·굵기·글자색까지 ★바뀌었다 — ★한 벌에 ★기본 서식이 ★들어갔다(⛔넣지 않기로 했다)')
    .toEqual({ font: before.font, size: before.size, weight: before.weight, color: before.color });
  expect(errs, `★페이지 오류: ${errs.join(' | ')}`).toEqual([]);
});

test('C5 ★칩은 글 블럭 «밖»이다 — 제품의 다섯 조회가 안 속는다 (＋양성대조)', async ({ page }) => {
  await setup(page);
  const id = await insertText(page, 'AAAAAA');
  await makeHighlight(page, id, HL_A, 40);
  await openPanel(page, id);
  const r = await page.evaluate((i) => {
    const tb = document.getElementById(i);
    const ce = tb.querySelector('.tb-body');
    const row = document.getElementById('txt-hl-recent-row');
    const chipPrev = row.querySelector('.ts-chip-prev');
    const out = {
      chipExists: !!chipPrev,
      chipInContent: !!(chipPrev && ce.contains(chipPrev)),
      /* ★제품이 ★실제로 쓰는 ★그 꼴 — contentEl 안만 본다(prop-text-wireup-text-edit.js 의 다섯) */
      seenByProduct: ce.querySelectorAll('span.tb-hl').length,
      globalDoc: document.querySelectorAll('span.tb-hl').length,
    };
    // ★양성대조 — ★칩을 ★글 블럭 ★안에 ★넣으면 ★잡혀야 한다(아니면 이 검사는 ★아무것도 안 잠근다)
    const probe = document.createElement('span');
    probe.className = 'ts-chip-prev tb-hl';
    ce.appendChild(probe);
    out.seenWhenInside = ce.querySelectorAll('span.tb-hl').length;
    probe.remove();
    out.seenAfterRemove = ce.querySelectorAll('span.tb-hl').length;
    return out;
  }, id);
  console.log('  C5:', JSON.stringify(r));
  expect(r.chipExists, '★전제 — 칩이 ★안 그려졌다').toBe(true);
  expect(r.chipInContent, '★칩이 ★글자칸 ★안에 있다 — 제품의 다섯 조회가 ★속는다').toBe(false);
  expect(r.globalDoc, `★전제 — 문서 전체엔 ★칩까지 ${r.globalDoc}개가 보인다(칩이 ★그 클래스를 ★입었다는 증거)`).toBeGreaterThan(r.seenByProduct);
  expect(r.seenWhenInside, '★★양성대조가 ★안 섰다 — 글자칸 ★안에 넣어도 ★안 잡히면 ★이 검사는 ★아무것도 안 잠근다').toBe(r.seenByProduct + 1);
  expect(r.seenAfterRemove, '★치운 뒤 수가 ★안 돌아왔다').toBe(r.seenByProduct);
});

test('C6 ★저장 왕복 — meta 에 실리고 다시 열어도 산다', async ({ page }) => {
  await setup(page);
  const id = await insertText(page, 'AAAAAA');
  await page.evaluate(() => {
    window.activeProjectId = 'p-c6';
    window.__metaStore = {};
    window.electronAPI = {
      loadProjectMeta: async () => window.__metaStore,
      saveProjectMeta: async (pid, patch) => { Object.assign(window.__metaStore, patch); return true; },
    };
  });
  await makeHighlight(page, id, HL_A, 40);
  await page.waitForTimeout(150);
  const saved = await page.evaluate(() => window.__metaStore.textStyleHistory || null);
  expect(saved && Array.isArray(saved.hl) && saved.hl.length, '★저장본(meta)에 ★안 실렸다').toBeTruthy();

  // ★다시 열기 — 캐시를 비우고 meta 에서만 복원한다
  const after = await page.evaluate(async () => {
    try { localStorage.removeItem('we_text_style_history_v1'); } catch (_) {}
    const emptied = window.DesignSystem.getTextStyleHistory('hl').length;
    await window.DesignSystem.restoreTextStyleHistoryFromMeta('p-c6');
    return { emptied, restored: window.DesignSystem.getTextStyleHistory('hl').map(r => r.v['--tb-hl-color']) };
  });
  console.log('  C6:', JSON.stringify(after));
  expect(after.emptied, '★전제 — 캐시를 비웠는데 ★안 비었다').toBe(0);
  expect(after.restored[0], '★다시 열었더니 ★최근 효과가 ★사라졌다').toBe(HL_A.toLowerCase());
});

test('M ★MAX 를 재는 법 — 줄 가용폭 · 칩폭 · gap 을 찍는다', async ({ page }) => {
  /* ⛔단언이 ★아니라 ★기록이다 — design-system.js TEXT_STYLE_HISTORY_MAX 를 ★이 수로 둔다.
     ★법 = floor((줄 가용폭 − 라벨폭) ÷ (칩폭 + gap))  ★컬러(7)와 ★같은 법, ★다른 칩. */
  await setup(page);
  const id = await insertText(page, 'AAAAAA');
  await makeHighlight(page, id, HL_A, 40);
  await openPanel(page, id);
  const m = await page.evaluate(() => {
    const row = document.getElementById('txt-hl-recent-row');
    const cs = getComputedStyle(row);
    const chip = row.querySelector('.ts-chip');
    const label = row.querySelector('.cv-chips-label');
    const rowW = row.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0);
    const gap = parseFloat(cs.gap || 0);
    const chipW = chip ? chip.getBoundingClientRect().width : null;
    const labelW = label ? label.getBoundingClientRect().width + parseFloat(getComputedStyle(label).marginRight || 0) : 0;
    return { rowW, gap, chipW, labelW,
             max: (chipW ? Math.floor((rowW - labelW - gap) / (chipW + gap)) : null),
             declared: window.DesignSystem.TEXT_STYLE_HISTORY_MAX };
  });
  console.log(`  M: 줄가용폭 ${m.rowW} · 라벨폭 ${m.labelW} · 칩폭 ${m.chipW} · gap ${m.gap} ⇒ ★MAX ${m.max} (지금 상수 ${m.declared})`);
  expect(m.chipW, '★전제 — 칩이 ★없어 폭을 못 쟀다').toBeTruthy();
  expect(m.declared, `★상수(${m.declared})가 ★잰 수(${m.max})와 ★다르다 — ★위 세 수로 ★다시 세워라`).toBe(m.max);
});

test('D1 ★★네 kind 가 «한 기계»다 — 죽이면 넷이 «전부» 빨강인지 셀 수 있게', async ({ page }) => {
  /* ★★지디 요구 ⑥ — ⛔「합쳤다」만 말하지 말고 ★「무력화 → ★소비자 수만큼 빨강」을 ★한 쌍으로.
     ⇒ ★이 검사는 ★네 kind 를 ★한 자리에서 ★따로 재고 ★죽은 것의 ★이름을 ★찍는다.
       ★그래야 ★저장소 본문을 ★죽였을 때 ★★«몇이 빨강인가»를 ★셀 수 있다(4 가 아니면 ★명부가 아직 둘이다).
     ★★«항등식»이 ★아니다 — ★기대값은 ★이 파일에 ★손으로 적은 ★리터럴이고,
       ⛔저장소 ★자기 코드에서 ★읽어 오지 ★않는다(읽어 오면 ★죽여도 ★초록이 된다). */
  await setup(page);
  const WANT = {
    hl:   { '--tb-hl-color': '#ff0000' },
    dot:  { '--tb-dot-size': '7px' },
    ul:   { '--tb-ul-thick': '3px' },
    grad: { css: 'linear-gradient(90deg,#010203 0%,#040506 100%)' },
  };
  const r = await page.evaluate((want) => {
    const DS = window.DesignSystem;
    const out = {};
    let t = 5000000;
    for (const k of Object.keys(want)) {
      t += (DS.TEXT_STYLE_COALESCE_MS || 0) + 1000;
      try {
        DS.pushTextStyleHistory(k, want[k], { now: t });
        const got = DS.getTextStyleHistory(k)[0];
        out[k] = !!(got && got.v && JSON.stringify(got.v) === JSON.stringify(want[k]));
      } catch (_) { out[k] = false; }
    }
    return out;
  }, WANT);
  const dead = Object.keys(WANT).filter(k => !r[k]);
  console.log(`  D1: ${JSON.stringify(r)} · 죽은 kind ${dead.length}건 ${JSON.stringify(dead)}`);
  expect(dead,
    `★kind ${dead.length}건이 ★저장소를 ★안 탄다 ${JSON.stringify(dead)} — ` +
    '★하나라도 빠지면 ★T14·T15 가 ★같은 기계가 ★아니다(명부가 둘이다)').toEqual([]);
});
