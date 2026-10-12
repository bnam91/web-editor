/* ln-nohistory.dom.spec.js — ★`opts.noHistory` 가 ★버블·챗 모델 입구에도 있다 (2026-10-06 · 지디 GO)
 *
 * ★왜 생겼나 — ⑵-B②(줄 옮기기)가 ★「같은 행까지」에서 멈췄다. 「옆 메시지로」는 ★한 제스처가 두 문으로 나가야 하는데
 *   `updateChatBlock`·`updateSpeechBubbleBlock` 이 ★`opts` 를 «안 받았다»(서명이 `(blockId, partial = {})`).
 *   ★★그런데 line-host.js 의 두 commit 은 ★이미 `opts` 를 3인자로 넘기고 있었다 ⇒ ★조용히 버려졌다.
 *   ⇒ 「값은 넘기는데 아무 일도 안 난다」 — ★사슬이 연결돼 있고 ★끝에서 떨어져 있었다.
 * ★꼴은 ★그리드와 «한 글자도 다르지 않다»(grid-block.js updateGridBlock) — ⛔새 설계를 하지 않았다.
 *
 * ★★⛔그리고 ★`opts.noHistory` ★하나로는 ★안 됐다 — ★실측으로 알았다(기대 0 → ★실제 2 · 기대 1 → ★실제 3).
 *   까닭: ★js/model-update-history.js 래퍼가 ★`window.update*Block` ★전부를 감싸 ★«끝 표본»을 한 칸 더 쌓고,
 *         ★그 래퍼는 ★`opts` 를 ★«안 본다». ⇒ 문 하나 = pushHistory ★2회(입구 안 push-before ＋ 래퍼 끝 표본).
 *   ⇒ ★★두 문 꼴은 ★«Raw ＋ noHistory» ★둘을 같이 써야 «이력 0칸»이 된다.
 *     ★Raw = 이름이 `/^update[A-Z]\w*Block$/` 에 안 걸리게 끝낸 ★우회 원본 — ★선례가 있다:
 *       js/blocks/grid-block.js `window.updateGridBlockRaw`(그 주석이 ★까닭을 다 적어 뒀다)
 *       ＋ js/canvas-scratch-drop.js:486 이 ★이미 그 길을 쓴다(「둘이 되면 ⌘Z 첫 걸음이 먹통이다 — 실측」).
 *     ⇒ ★그래서 이 커밋이 ★`updateChatBlockRaw`·`updateSpeechBubbleBlockRaw` 를 ★같은 꼴로 등록한다.
 *   ⚠️★해법이 ★레포에 ★이미 적혀 있었다 — ★「문서에 있어도 ★안 읽히면 없는 것과 같다」의 또 한 판이다.
 *
 * ★이 파일이 재는 것 넷
 *   N0 ★전제 — opts 를 ★안 주면 종전대로 «쌓는다»(기본값 불변). ⛔없으면 N1 이 「언제나 안 쌓는다」와 구분 안 된다
 *   N1 ★★`Raw` ＋ noHistory 를 ★같이 주면 «이력 0칸» — 버블·챗 ★둘 다
 *   N1b ⛔★래퍼를 타는 길(window.update*Block)에 noHistory ★만 주면 ★«아직 한 칸 쌓인다»
 *        ⇒ ★그게 «왜 Raw 가 필요한가»의 ★증인이다. ⛔이 칸을 지우면 다음 사람이 Raw 를 떼어 본다
 *   N2 ★★행동 — ★㉣ 꼴: ★문1 = Raw(noHistory 안 줌) ＋ ★문2 = 래퍼＋noHistory ⇒ ★스택 ＋1 · ⌘Z 한 번
 *        ⛔내가 처음 쓴 두 꼴은 ★둘 다 틀렸다 — ⑴문1 보통 ⇒ ★반쪽 칸 ⑵호출자 1칸＋둘 다 Raw ⇒ ★스택 ＋0(실측)
 *        ⇒ ★★값만 재면 ★거짓 초록이 된다 ⇒ ★스택 길이를 ★같이 잰다
 * ★양성대조 = ★Raw 를 ★일반 입구로 바꾸면 ★N1·N2 가 빨강(＝이력이 두 칸).
 *
 * ⛔이 커밋은 ★선행만이다 — 「옆 메시지로」(⑵-B③)는 ★여기 없다(지디 조건 ㉣).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/ln-nohistory.dom.spec.js --workers=1
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = `<div class="section-block" data-section="1" id="sN"><div class="section-hitzone"></div>
  <div class="section-inner" style="padding-left:60px;padding-right:60px;" data-padding-x="60"></div></div>`;

/** ★pushHistory 를 «세는» 자를 끼운다 — ⛔원본을 계속 부른다(이력이 실제로 쌓여야 ⌘Z 를 잴 수 있다). */
async function scene(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  const ids = await page.evaluate((h) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.();
    window.selectSection(document.getElementById('sN'));
    window.addSpeechBubbleBlock('left');
    const sb = [...document.querySelectorAll('.speech-bubble-block')].pop();
    window.updateSpeechBubbleBlock(sb.id, { text: '안녕' });
    window.addChatBlock({ messages: [{ text: 'm1', align: 'left' }, { text: 'm2', align: 'right' }] });
    const ch = document.querySelector('.chat-block');
    window.__pushLog = [];
    const orig = window.pushHistory;
    window.pushHistory = function (...a) { window.__pushLog.push(a[0] ?? '(이름없음)'); return orig.apply(this, a); };
    return { sb: sb.id, ch: ch.id };
  }, SEC);
  return { errs, ...ids };
}
const pushCount = (page) => page.evaluate(() => window.__pushLog.length);
/* ★★스택 «길이» — ⛔pushHistory ★호출 수로 재면 틀린다(history.js 의 무변화 중복 차단이 하나를 버린다).
   ★실측 2026-10-06: 「호출 1회」인데 스택 ★＋0 인 꼴이 있었다 ⇒ ★호출 수는 ★«칸 수»가 아니다. */
const stackLen = (page) => page.evaluate(() => (window.historyStack || []).length);
const reset = (page) => page.evaluate(() => { window.__pushLog = []; });

test('N0 ★전제 — opts 를 «안 주면» 종전대로 쌓는다(기본값 불변)', async ({ page }) => {
  const s = await scene(page);
  await reset(page);
  await page.evaluate(({ sb, ch }) => {
    window.updateSpeechBubbleBlock(sb, { text: '바꿈1' });
    window.updateChatBlock(ch, { gap: 20 });
  }, s);
  /* ⛔이 전제가 없으면 아래 N1 이 「★언제나 안 쌓는다」(= 이력이 통째로 죽은 판)와 ★구분되지 않는다.
     ★수가 ★4 인 까닭(실측) — ★문 하나 = pushHistory ★2회다: ㉠입구 «안»의 push-before ㉡래퍼의 «끝 표본».
     ⇒ 두 문 × 2 = ★4. ⛔「2」라 적으면 ★래퍼를 안 센 것이다(내가 처음 그렇게 적어 ★빨강을 봤다). */
  expect(await pushCount(page), '★opts 없이 부른 두 문이 종전처럼 안 쌓았다 — 기본값이 바뀌었다').toBe(4);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('N1 ★★`Raw` ＋ noHistory 를 같이 주면 «이력 0칸» — 버블·챗 둘 다', async ({ page }) => {
  const s = await scene(page);
  await reset(page);
  const r = await page.evaluate(({ sb, ch }) => {
    /* ★둘을 ★같이 써야 0칸이다 — Raw 만이면 입구 안 push-before 가 쌓고, noHistory 만이면 래퍼 끝 표본이 쌓는다. */
    const a = window.updateSpeechBubbleBlockRaw(sb, { text: '바꿈2' }, { noHistory: true });
    const b = window.updateChatBlockRaw(ch, { gap: 24 }, { noHistory: true });
    return { aOk: !!(a && a.ok), bOk: !!(b && b.ok),
      bubbleText: document.getElementById(sb).querySelector('.tb-bubble').innerText.trim(),
      chatGap: document.getElementById(ch).dataset.gap };
  }, s);
  /* ★전제 — ★두 문이 «실제로 바꿨다». ⛔안 바꿨으면 「안 쌓았다」는 당연한 말이 된다. */
  expect([r.aOk, r.bOk, r.bubbleText, r.chatGap], `전제: 둘 다 커밋됐다 (잰 값 ${JSON.stringify(r)})`)
    .toEqual([true, true, '바꿈2', '24']);
  expect(await pushCount(page), '★Raw ＋ noHistory 인데 이력이 쌓였다').toBe(0);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('N1b ⛔★래퍼를 타는 길에 noHistory ★만 주면 «아직 한 칸 쌓인다» — ★Raw 가 필요한 까닭', async ({ page }) => {
  /* ★이 칸이 ★«왜 Raw 인가»의 증인이다. ⛔지우면 다음 사람이 Raw 를 떼어 보고 「되는데?」라 읽는다
     — ★그때 ⌘Z 가 ★두 번이 되고 ★중간이 반쪽이 된다(그리드에서 ★실제로 그러고 있다 · 별건). */
  const s = await scene(page);
  await reset(page);
  await page.evaluate(({ sb, ch }) => {
    window.updateSpeechBubbleBlock(sb, { text: '바꿈3' }, { noHistory: true });
    window.updateChatBlock(ch, { gap: 26 }, { noHistory: true });
  }, s);
  /* ★입구 안 push-before 는 꺼졌지만 ★래퍼의 «끝 표본»이 문마다 한 번 쌓는다 ⇒ ★2. */
  expect(await pushCount(page), '★래퍼가 끝 표본을 안 쌓았다 — 이 증인이 낡았다(래퍼가 opts 를 보게 바뀌었나)').toBe(2);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});

test('N2 ★★행동 — ★㉣ 꼴(문1 Raw · 문2 래퍼＋noHistory) ⇒ ★스택 «한 칸» ＋ ⌘Z 한 번에 둘 다', async ({ page }) => {
  /* ★★⛔내가 처음 쓴 꼴이 ★틀렸다 — ★실측이 두 번 뒤집었다(2026-10-06 · 지디 ㉣):
   *   ⑴「문1 보통 ＋ 문2 noHistory」 ⇒ 래퍼 끝 표본이 ★「문1 만 적용된 반쪽」을 한 칸 남긴다 ⇒ ⌘Z① 이 반쪽
   *   ⑵「호출자가 pushHistory 1칸 ＋ 둘 다 Raw＋noHistory」 ⇒ ★스택 ★＋0 이다(실측).
   *      까닭: 그 pushHistory 가 ★«변경 전» 상태를 찍는데 ★앞 동작의 끝 표본과 같아
   *            history.js 의 ★무변화 중복 차단에 먹힌다 ⇒ ★이 제스처의 칸이 ★아예 안 생긴다.
   *      ⛔그런데 이 검사는 ★초록이었다 — before 가 «초기 상태»라 ⌘Z 가 더 앞 칸으로 가도 ★값이 같았다.
   *        ⇒ ★★「값만 재면 ★거짓 초록이 된다」 ⇒ ★스택 길이를 ★같이 재야 한다.
   * ★★참값(㉣) = ★문1 을 ★Raw 로(noHistory ★안 줌 — 그 push-before 가 «변경 전» 칸이다)
   *              ＋ ★문2 는 ★래퍼를 타게 두고 noHistory (그 끝 표본이 ★«마지막 문»의 칸이다)
   *   ⇒ 스택 ★＋1 · ⌘Z 한 번에 둘 다. ★그게 prop-grid.js grdMoveLineToCell 이 쓰는 꼴이다(같은 커밋). */
  const s = await scene(page);
  const before = await page.evaluate(({ ch }) => JSON.parse(document.getElementById(ch).dataset.messages)
    .map(m => (m.lines || []).map(l => l.text)), s);
  const stack0 = await stackLen(page);
  await page.evaluate(({ ch }) => {
    window.updateChatBlockRaw(ch, { editMessage: { index: 0, lines: [{ type: 'body', text: 'X' }] } });                      // ★문1 = Raw · noHistory 안 줌
    window.updateChatBlock(ch, { editMessage: { index: 1, lines: [{ type: 'body', text: 'Y' }] } }, { noHistory: true });    // ★문2 = 래퍼 ＋ noHistory
  }, s);
  const mid = await page.evaluate(({ ch }) => JSON.parse(document.getElementById(ch).dataset.messages)
    .map(m => (m.lines || []).map(l => l.text)), s);
  const stack1 = await stackLen(page);
  /* ★★전제 둘 — ⑴두 문이 실제로 바뀌었다 ⑵★스택이 ★«한 칸»이다(⛔0 도 2 도 아니다). */
  expect(`문2 뒤 ${JSON.stringify(mid)} · 스택 ＋${stack1 - stack0}`)
    .toBe(`문2 뒤 ${JSON.stringify([['X'], ['Y']])} · 스택 ＋1`);

  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  /* ⛔«고정 대기»로 재지 않는다 — 조건으로 기다린다(부하에서 값을 잃는다). */
  const read = () => page.evaluate(({ ch }) => JSON.parse(document.getElementById(ch).dataset.messages)
    .map(m => (m.lines || []).map(l => l.text)), s);
  let after = mid;
  for (let i = 0; i < 40 && JSON.stringify(after) === JSON.stringify(mid); i++) {
    await page.waitForTimeout(100);
    after = await read();
  }
  /* ★세 갈래를 갈라 적는다 — ㉠안 먹었다 ㉡반쪽 ㉢원래로. */
  const half = JSON.stringify(after) === JSON.stringify([['X'], []])
    || JSON.stringify(after) === JSON.stringify([[], ['Y']]);
  expect(`먹었나=${JSON.stringify(after) !== JSON.stringify(mid)} · 반쪽=${half} · 값=${JSON.stringify(after)}`)
    .toBe(`먹었나=true · 반쪽=false · 값=${JSON.stringify(before)}`);
  expect(s.errs, s.errs.join(' | ')).toEqual([]);
});
