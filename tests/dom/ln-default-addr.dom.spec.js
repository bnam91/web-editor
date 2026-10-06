/* ln-default-addr.dom.spec.js — ★⑵-A 「챗도 버블처럼 ★첫 클릭에 줄을 더할 수 있다」 ＋ ★그 기본 주소가 단축키를 안 소진한다
 *   (현빈 2026-10-06 「버블블럭에 줄처럼 블럭 추가할 수 있는데, 챗블럭은 그렇게 안 되는거 같더라?」 · 지디 GO)
 *
 * ★왜 별 파일인가 — tests/dom/bt2-lines.dom.spec.js T3 가 「버블과 챗이 같은 줄 기능」을 재는데, ★그 시험 자신이
 *   비대칭을 «손짓 수»로 품고 있었다(T3:106 버블 클릭 1회 / T3:113-114 챗 2회). 즉 ★같은 결과에 닿는 «길의 길이»를
 *   안 쟀다. 여기서 ★그 수를 잰다. ⛔T3 를 고치지 않는다 — 그건 「같은 결과」를 재는 자고, 이건 「같은 손짓」을 재는 자다.
 *   (＋이 파일을 따로 둔 또 한 까닭: fx-small3 레인이 g 결함 검사를 세우는 중이라 같은 파일을 둘이 건드리지 않게.)
 *
 * ★뿌리 하나를 잠근다 — line-host.js `_mountLineUi` 가 «패널을 그리면서» 활성 줄을 «쓰던» 것.
 *   ⇒ 그래서 ⑴챗에 기본 주소를 넣어도 g 가 안 소진되고 ⑵버블의 기존 g 결함도 같이 닫힌다.
 *   ★「그 뿌리를 무력화하면 N개가 전부 빨강인가」 — synthetic 분기를 지우면 P2·P2b 가 빨강(＋fx-small3 의 g 검사도).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/ln-default-addr.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left: 60px; padding-right: 60px;" data-padding-x="60"></div></div>`;

async function fresh(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sL'));
  }, SEC);
  return errs;
}
const addBubble = (page) => page.evaluate(() => {
  window.addSpeechBubbleBlock('left');
  const b = [...document.querySelectorAll('.speech-bubble-block')].pop();
  window.updateSpeechBubbleBlock(b.id, { text: '안녕하세요' });
  return b.id;
});
const addChat = (page, n) => page.evaluate((n) => {
  window.addChatBlock({ messages: Array.from({ length: n }, (_, i) => ({ text: '메시지' + (i + 1), align: i % 2 ? 'right' : 'left' })) });
  return document.querySelector('.chat-block').id;
}, n);
/** ★클릭을 «세면서» 한다 — 이 시험의 본 측정값이 「몇 번 눌러야 닿나」이기 때문이다. */
async function clickOnce(page, sel) {
  const r = await waitStableRect(page, sel);
  await page.mouse.click(r.cx, r.cy);
  await page.waitForTimeout(140);
  return 1;
}
const addSelVisible = (page) => page.locator('#grd-line-add-kind').isVisible().catch(() => false);
const activeLine = (page, id) => page.evaluate((id) => {
  const a = window.grdGetActiveLine?.(document.getElementById(id));
  return a ? { r: a.r, li: a.li } : null;
}, id);

test('P0 ★전제 — 버블·챗이 서고, 둘 다 «줄이 없다»(이 시험이 재는 장면이 실제로 선다)', async ({ page }) => {
  const errs = await fresh(page);
  const sb = await addBubble(page);
  const ch = await addChat(page, 1);
  const st = await page.evaluate(({ sb, ch }) => ({
    bubbleLines: document.getElementById(sb).dataset.lines ?? null,
    chatLines: (JSON.parse(document.getElementById(ch).dataset.messages)[0] || {}).lines ?? null,
    msgCount: JSON.parse(document.getElementById(ch).dataset.messages).length,
  }), { sb, ch });
  expect(st, '전제: 둘 다 줄 없음 · 챗 메시지 1개').toEqual({ bubbleLines: null, chatLines: null, msgCount: 1 });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P1 ★클릭 «한 번»으로 버블·챗 둘 다 「＋ 줄 추가」에 닿는다 — 손짓 수가 같다', async ({ page }) => {
  const errs = await fresh(page);
  const sb = await addBubble(page);
  const ch = await addChat(page, 1);

  await page.evaluate(() => window.deselectAll?.());
  const nB = await clickOnce(page, `#${sb} .tb-bubble`);
  const okB = await addSelVisible(page);

  await page.evaluate(() => window.deselectAll?.());
  const nC = await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="0"]`);
  const okC = await addSelVisible(page);

  /* ★잰 값을 단언에 찍는다 — 빨강일 때 「몇 번이었나」가 보이게. */
  expect(`버블 클릭 ${nB}회 → 손잡이 ${okB} · 챗 클릭 ${nC}회 → 손잡이 ${okC}`)
    .toBe('버블 클릭 1회 → 손잡이 true · 챗 클릭 1회 → 손잡이 true');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2 ★버블과 챗은 «다른 길»로 같은 결과에 닿는다 — 버블은 세우고 걸러내고, 챗은 ★안 세운다', async ({ page }) => {
  /* ★★왜 둘이 다른가 — ⛔이게 이 커밋에서 제일 틀리기 쉬운 자리다.
   *   버블: 기본 주소를 ★세운다. fx-small3 의 B4 가 그것을 «계약»으로 잠근다(패널 기본 주소는 유지).
   *         단축키가 그걸 읽지 않게 하는 몫은 `_lnPickedLine`(c429aab7)이 진다 — 「말풍선 ＋ 줄 없음 ＋ li:null」을 걸러낸다.
   *   챗  : 기본 주소를 ★안 세운다(패널만 그린다). ⛔`_lnPickedLine` 에 챗 갈래를 더하는 길은 ★막혀 있다 —
   *         챗의 「줄 없는 메시지 ＋ li:null」은 ★B3 의 «사람이 고른 상태»와 ★글자 그대로 같다({"r":0,"c":0,"li":null}).
   *         ⇒ DOM 에서 «파생»으로는 못 가른다. 실측: 그 갈래를 넣으면 ★B3 가 빨개진다(D10 설계가 죽는다).
   *   ⇒ 그래서 «걸러내기»(버블)와 «안 세우기»(챗)는 ★두 벌이 아니다. 자리가 다르고 서로 보완한다.
   *      ★한쪽을 다른 쪽으로 통일하려 들면 B3(챗) 또는 B4(버블)가 빨개진다 — 그 둘이 이 갈림의 증인이다. */
  const errs = await fresh(page);
  const sb = await addBubble(page);
  const ch = await addChat(page, 1);
  await page.evaluate(() => window.deselectAll?.());
  await clickOnce(page, `#${sb} .tb-bubble`);
  const aB = await activeLine(page, sb);
  await page.evaluate(() => window.deselectAll?.());
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="0"]`);
  const aC = await activeLine(page, ch);
  expect(`버블 ${JSON.stringify(aB)} · 챗 ${JSON.stringify(aC)}`)
    .toBe('버블 {"r":0,"li":null} · 챗 null');
  /* ★그런데 ★«결과»는 같다 — 둘 다 g 가 메시지/말풍선으로 안 샌다. 버블 쪽은 B1 이, 챗 쪽은 아래 P5 가 잰다. */
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P2b ★음성대조 — 사람이 «줄/메시지를 눌렀을 때»는 활성 줄이 선다(synthetic 이 사람 길을 안 껐다)', async ({ page }) => {
  const errs = await fresh(page);
  const ch = await addChat(page, 1);
  await page.evaluate(() => window.deselectAll?.());
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="0"]`);   // ①블럭 선택(기본 주소 · 활성 줄 없음)
  expect(await activeLine(page, ch), '전제: 첫 클릭 뒤엔 활성 줄이 없다').toBeNull();
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="0"]`);   // ②사람이 메시지를 «고른다»
  expect(await activeLine(page, ch), '★두 번째 클릭(사람이 고름)엔 활성 줄이 서야 한다').toEqual({ r: 0, li: null });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P3 ★메시지가 둘 이상이면 기본 주소를 «안 준다» — 어느 메시지인지 거짓말하지 않게', async ({ page }) => {
  const errs = await fresh(page);
  const ch = await addChat(page, 3);
  await page.evaluate(() => window.deselectAll?.());
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="1"]`);
  const shown = await addSelVisible(page);
  const hint = await page.locator('#ln-line-panel .prop-hint').first().textContent().catch(() => null);
  expect(`손잡이=${shown} · 안내=${(hint || '').includes('메시지를 한 번 더 누르면')}`)
    .toBe('손잡이=false · 안내=true');
  /* ★그리고 «한 번 더» 누르면 그 메시지가 선다 — 길이 막힌 게 아니라 «고르게» 한 것이다. */
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="1"]`);
  expect(await activeLine(page, ch), '고른 메시지 = 2번째(r=1)').toEqual({ r: 1, li: null });
  expect(await addSelVisible(page), '고른 뒤엔 「＋ 줄 추가」가 보인다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P4 ★첫 클릭에서 바로 줄을 더할 수 있다 — 챗도 버블과 «같은 결과»(D2 첫 줄 굽기 포함)', async ({ page }) => {
  const errs = await fresh(page);
  const ch = await addChat(page, 1);
  await page.evaluate(() => window.deselectAll?.());
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="0"]`);
  await page.locator('#grd-line-add-kind').selectOption('h2');
  await page.waitForTimeout(220);
  const lines = await page.evaluate((id) => JSON.parse(document.getElementById(id).dataset.messages)[0].lines, ch);
  /* D2 — 첫 전환 때 지금 본문이 «첫 줄»로 구워지고, 고른 종류가 그 다음에 붙는다. */
  expect((lines || []).map(l => l.type), '★첫 클릭 → 줄 추가가 바로 먹는다(D2 굽기 ＋ 새 줄)').toEqual(['body', 'h2']);
  expect(lines[0].text, 'D2 — 지금 본문이 첫 줄이 된다').toBe('메시지1');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('P5 ★챗을 «고르기만» 해도 g 가 메시지로 안 샌다 — ⑵-A 를 넣어도 결함이 안 번졌다는 증거 (지디 발주)', async ({ page }) => {
  /* ★왜 이 칸이 따로 필요한가 — fx-small3 의 bubble-shortcut-not-in-text B1~B7 은 ★이 장면을 안 잰다.
     B3 는 챗의 활성 줄을 `grdSetActiveLine` 으로 ★손으로 세워 장면을 만든다(사람이 하는 순서를 안 밟는다).
     ⇒ ★실측: ⑵-A 의 기본 주소를 «그냥» 넣으면 B1~B7 이 ★7/7 초록인데 ★챗 g 가 번진다
       (메시지에 [body,gap] 이 생기고 전역 갭은 0). ★검사 일곱이 초록인데 결함이 사는 자리였다.
     ⇒ 그 분모를 여기서 메운다 — ★클릭으로 장면을 만든다. */
  const errs = await fresh(page);
  const ch = await addChat(page, 1);
  const before = await page.evaluate(() => document.querySelectorAll('#canvas .gap-block').length);
  await page.evaluate(() => window.deselectAll?.());
  await clickOnce(page, `#${ch} .chb-btext[data-msg-idx="0"]`);
  expect(await addSelVisible(page), '전제: 첫 클릭에 손잡이가 보인다(⑵-A 가 섰다)').toBe(true);
  await page.keyboard.press('g');
  await page.waitForTimeout(260);
  const after = await page.evaluate((id) => ({
    lines: JSON.parse(document.getElementById(id).dataset.messages)[0].lines ?? null,
    gaps: document.querySelectorAll('#canvas .gap-block').length,
  }), ch);
  /* ★잰 값을 단언에 찍는다 — 빨강일 때 「무엇이 생겼나」가 보이게. */
  expect(`메시지 줄=${JSON.stringify(after.lines)} · 전역 갭=${after.gaps}`)
    .toBe(`메시지 줄=null · 전역 갭=${before + 1}`);
  expect(errs, errs.join(' | ')).toEqual([]);
});
