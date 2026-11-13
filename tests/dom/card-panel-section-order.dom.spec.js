/* card-panel-section-order.dom.spec.js — 카드 블럭 우측패널 「Card Grid」(카드 수 c×r) 접이식.
 * ★옛 발주 1017t1d2 는 「Card Grid 절을 그리드블럭처럼 맨 위로 + 접이식」이었다. ★U3(right-panel-unify, 2026-11-13) 이후 절 순서는
 *   전역 정본(js/props/_section-spec.js — Size 가 Layout 앞)이 정하고, Card Grid 는 Layout 절 «안» 접이식(공용 discSec)이다.
 *   (맨 위 자리를 되살릴지는 현빈 결정 대기 — 지디 경유 F3.)
 * 지금 재는 것: C1 = #cvb-grid-toggle 접이식이 있다 · Layout 절(data-sec="layout") 안 · 기본 접힘 · 머리에 「1×1」 ·
 *   C2 = 누르면 펼쳐지고 피커 16칸이 DOM 에 있다(지움이 아니라 접힘).
 * ★기준선 a60d0c05 — 그 판엔 접이식 부품(id="cvb-grid-toggle")이 «없다»(평범한 .prop-section-title). N1 이 그 판의 소스를 그대로 실행해
 *   그 사실을 실측한다(C1 의 접이식 단언이 실제로 재고 있다는 음성대조).
 * ⛔waitForTimeout 없음(ratchet tests/unit/dom-fixed-wait-census.test.mjs W3) — waitForFunction 로만 기다린다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js card-panel-section-order
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, ORIGIN, bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" id="sO" data-section="1" data-name="sO"><div class="section-hitzone"></div><div class="section-inner" id="innerO">
  <div id="slotO"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([sec]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', sec);
    const made = window.makeCanvasBlock({ cardMode: 'simple' });
    made.block.id = 'cvb_order1';
    document.getElementById('slotO').replaceWith(made.row);
    window.rebindAll?.(); window.deselectAll?.();
    window.selectBlock?.(made.block.id);
    return made.block.id;
  }, [SEC]);
  await page.waitForFunction(() => !!document.getElementById('cvb-grid-picker') || !!document.querySelector('#panel-right .prop-section-title'));
  return { id, errs };
}

/* 패널의 절 제목 전부 + 「Card Grid」 절의 접이식 상태(있으면). */
const probe = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const titles = [...body.querySelectorAll('.prop-section-title')].map(t => t.textContent.trim());
  const head = document.getElementById('cvb-grid-toggle');
  const bodyEl = document.getElementById('cvb-grid-body');
  return {
    titles,
    gridTitleIdx: titles.findIndex(t => t.startsWith('Card Grid')),
    sizeTitleIdx: titles.findIndex(t => t === 'Card Size'),
    cardsTitleIdx: titles.findIndex(t => t.startsWith('Cards (')),
    hasDisclosure: !!head,
    headText: head ? head.textContent.trim() : null,
    bodyDisplay: bodyEl ? getComputedStyle(bodyEl).display : null,
    pickerCellN: (document.getElementById('cvb-grid-picker') || { children: [] }).children.length,
  };
});

test('C1 ★실측 — 「Card Grid」 접이식이 Layout 절 안에 있고 기본 접힘', async ({ page }) => {
  /* ★U3(right-panel-unify) — 옛 C1 은 「Card Grid 절이 Card Size 절보다 위」를 쟀다(1017t1d2). 이제 절 순서는 전역 정본
     (js/props/_section-spec.js — Size 가 Layout 앞)이 정하고, 카드 수는 배치라 Layout 절 «안» 접이식(공용 discSec)으로 산다.
     ⇐ 되돌리면 빨강: 접이식을 빼면(hasDisclosure) · 다른 절로 옮기면(gridSec) · 기본을 펼침으로 바꾸면(bodyDisplay). */
  const { errs } = await setup(page);
  const p = await probe(page);
  const gridSec = await page.evaluate(() => document.getElementById('cvb-grid-toggle')?.closest('.prop-section[data-sec]')?.dataset.sec || null);
  expect(errs, 'JS 오류 0건').toEqual([]);
  expect(p.hasDisclosure, '접이식 쉐브론 머리(#cvb-grid-toggle)가 없다').toBe(true);
  expect(gridSec, `「Card Grid」 접이식이 Layout 절 밖이다 — 산 제목: ${JSON.stringify(p.titles)}`).toBe('layout');
  expect(p.bodyDisplay, '★기본은 «접힘»이다(그리드 Grid(N×M) 절과 같은 dflt)').toBe('none');
  expect(p.headText, `접힌 제목이 지금 몇 칸인지 말해야 한다 (실제: "${p.headText}")`).toContain('1×1');
});

test('C2 ★머리를 누르면 펼쳐지고, 피커 16칸이 «이미 DOM 에» 있다(지움이 아니라 접힘)', async ({ page }) => {
  await setup(page);
  await page.click('#cvb-grid-toggle');
  await page.waitForFunction(() => document.getElementById('cvb-grid-body')?.style.display === 'block'
    || getComputedStyle(document.getElementById('cvb-grid-body')).display === 'block');
  const p = await probe(page);
  expect(p.bodyDisplay, '펼친 뒤에도 display:none 이면 토글이 안 먹는다').toBe('block');
  expect(p.pickerCellN, '피커 4×4=16칸이 DOM 에 있어야 한다(접힘 동안 지워지지 않았다는 증거)').toBe(16);
});

/* ★무력화 증명 — Card Grid 절을 Card Size 뒤로 되돌리면(또는 접이식을 빼면) C1 이 빨개져야
   비로소 이 검사가 「실제로 재고 있다」가 증명된다. a60d0c05(기준선)이 그 사보타주의 «진짜 사본»이다 —
   N1 이 그 판의 진짜 소스를 그대로 실행해 재서, 손으로 베낀 기대값이 아니라 «그 커밋이 실제로 낸 HTML」로 비교한다. */
test('N1 ★음성대조(기준선 a60d0c05) — 고치기 전 판은 ★이 단언이 빨강이다(순서 역전 + 접이식 없음)', async ({ page }) => {
  const OLD_REF = 'a60d0c05';
  const oldSrc = execFileSync('git', ['show', `${OLD_REF}:js/props/prop-simple-card.js`], { cwd: ROOT, encoding: 'utf8' });
  const { id, errs } = await setup(page);
  /* ★route 우선권은 «나중에 등록한 쪽»이다(실측 — bootApp 의 전수 route 를 먼저 걸면 내 override 가 안 먹혔다).
     ⇒ bootApp 이 끝난 «뒤»에 이 경로만 override 해 걸고, 쿼리스트링으로 새 모듈 인스턴스를 동적 import 한다
     (같은 URL 재요청은 모듈 캐시에 걸려 네트워크를 안 탄다 — 그래서 ?oldref=1 로 다른 스펙사이파이어를 만든다). */
  await page.route(`${ORIGIN}/js/props/prop-simple-card.js?oldref=1`, (route) => route.fulfill({ contentType: 'application/javascript', body: oldSrc }));
  await page.evaluate(async (blockId) => {
    await import('/js/props/prop-simple-card.js?oldref=1');   // ★옛 모듈의 마지막 줄이 window.showSimpleCardProperties 를 덮어쓴다
    window.showSimpleCardProperties(document.getElementById(blockId));
  }, id);
  const p = await probe(page);
  expect(errs, 'JS 오류 0건(옛 판도 그대로 뜬다)').toEqual([]);
  expect(p.gridTitleIdx, '기준선에도 Card Grid 절은 있다').toBeGreaterThanOrEqual(0);
  expect(p.sizeTitleIdx, '기준선에도 Card Size 절은 있다').toBeGreaterThanOrEqual(0);
  // ★역전 — 기준선은 Card Grid 가 Card Size «뒤»에 있다(지금 판과 정반대 — 이게 바로 이 발주가 고친 것이다).
  expect(p.gridTitleIdx, `기준선 실측 제목 순서: ${JSON.stringify(p.titles)}`).toBeGreaterThan(p.sizeTitleIdx);
  // ★접이식 부품 자체가 없다.
  expect(p.hasDisclosure, '기준선엔 #cvb-grid-toggle 이 없어야 한다(평범한 div 였다)').toBe(false);
});
