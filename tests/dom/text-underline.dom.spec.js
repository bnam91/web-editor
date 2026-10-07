/* text-underline.dom.spec.js — ⑤ 텍스트 ★밑줄 (수지 피드백 ⑤ · 지디 발주 2026-10-08:
 *   「텍스트 ★밑줄(볼드/이탤릭/취소선/하이라이트 로우에 추가)」)
 *   ⚠️출처는 ★2차다(server-manager 가 전한 요약) — ⛔「원문」이 아니다.
 *
 * ★무엇이 새것인가 — 레포에 밑줄 «단추»는 ★없었다(B·I·취소선·형광펜 ★넷).
 *   js/props/prop-text.js:147 주석이 말하는 옛 `tb.dataset.highlight='underline'` 은 ★값만 있고
 *   ★구현이 없던 죽은 값이라 2026-10-06 에 지워졌다 ⇒ 이것은 ★되살리기가 아니라 ★새로 만드는 일이다.
 *
 * ★★이 시험의 핵은 U3 이다 — 밑줄과 취소선은 ★한 CSS 속성(text-decoration-line)에 ★같이 산다.
 *   각자 `el.style.textDecorationLine = 'underline'` 로 쓰면 ★다른 하나를 ★조용히 지운다.
 *   ⇒ 「켜졌다」만 재는 시험은 그 사고를 ★못 본다. 두 손잡이를 ★겹쳐서 잰다.
 *
 * 재는 것
 *   U1 ★무선택 전체 — 켜면 글자칸에 밑줄이 ★그려진다(computed ＋ ★칠해진 픽셀). 끄면 사라진다.
 *      ★전제: ⒜ 켜기 «전»에 밑줄이 없다 ⒝ ★저장된 선택이 ★없다(그래야 «전체» 갈래를 재는 것이다).
 *   U2 ★부분 선택 — 세 글자(BBB)에만 걸리고 ★그 밖(AAA·CCC)엔 ★안 걸린다(★음성대조).
 *      ★전제: 선택이 rangeCount 1 · 펼쳐짐 · 글자 "BBB" · 그 글자칸 안.
 *   U3 ★★취소선과 공존 — 취소선 켠 글에 밑줄을 켜도 ★취소선이 산다. 그 ★반대도. 하나만 꺼도 ★다른 하나는 산다.
 *   U4 ★저장 왕복 — serializeProject → ★앱 재기동 → applyProjectData 뒤에도 밑줄이 산다.
 *   U5 ★패널 되비침 — 밑줄 켠 블럭의 패널을 다시 열면 단추가 ★active(「단추 표시」와 「실제」가 안 갈린다).
 *   U6 ★배송본 — 단독 HTML 에 밑줄이 실린다(인라인 서식이라 ★나가야 하는 것).
 *   U7 ★⌘U — 편집 중 ⌘U 가 밑줄을 걸고 ★되돌리기 한 단위다.
 *      ⚠️★이 하나는 ★고치기 «전» 판(64a06566)에서도 ★초록이었다 — 실측 2026-10-08: 8건 중 ★U7 만 통과.
 *        까닭 = contenteditable 의 ⌘U 는 ★브라우저가 기본으로 처리한다(editor.js 엔 ⌘U 갈래가 ★없다).
 *        ⇒ U7 은 ★«지키는 시험»이다. ⛔이것을 ⑤ 의 ★증명으로 읽지 마라. 나머지 7건이 증명이다.
 *        ★그래서 editor.js 에 ⌘U 갈래를 ★안 넣었다 — 넣을 까닭을 이 자가 못 찾아 줬다(⌘B·⌘I 와 ★다른 판정).
 *   U9 ★★취소선을 «끌 때»도 부분 잔재(`<s>`·span)를 걷는다 — ★이 커밋의 ★부수 변경을 잠그는 자(지디 2026-10-08 지시).
 *      ★★실측으로 드러난 것: 「블럭이 켜진 채 잔재가 있는」 상태는 ★단추 경로로는 ★안 만들어진다
 *        (켜진 블럭에서 부분 S 는 그 선택을 «끄는» 쪽으로 가서 line-through 잔재를 안 남긴다 — tags 0).
 *        ⇒ 그 상태는 ★붙여넣기·★저장본 열기·가져오기로 온다. U9 ㉢ 은 ★그 꼴을 만들고,
 *        ★그런 저장본이 ★실제로 만들어진다는 것(serializeProject 에 `<s>` 가 실린다)을 ★같이 단언한다.
 *      ⛔이 검사가 없으면 다음 사람이 「끄는 갈래의 걷기」를 ★되돌린다(지디: 「되돌린 결정은 «검사»로 잠가라」).
 *   U8 ★다른 패널은 ★안 바뀐다 — showUnderline 기본 false ⇒ 모달·그리드·챗 마크업 «바이트 동일».
 *      (바이트 동일성 자체는 tests/unit/typo-section-ssot.test.mjs T1·T2-d 가 잠근다. 여기선 ★DOM 에 없음을 본다.)
 *
 * ★양성대조(실측 2026-10-08, 판 = 고치기 «전» 64a06566 — ★HEAD 가 아니다):
 *   ★빨강 7건 = U1 U2 U3 U4 U5 U6 U8 (전부 「#txt-underline-btn 이 없다」로 떨어진다)
 *   ★초록 1건 = U7 (위 ⚠️ 참조 — 지키는 시험)
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 재기동·네이티브 메뉴·파일 저장/불러오기(electronAPI 가짜),
 *   그래서 U6 은 ★exportHTMLFile() 이 아니라 ★세척 한 벌(capture-safety.js)을 잰다 — 파일에 쓰인 바이트는 «모른다».
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js text-underline
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';

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

/* 블럭 넣기(준비) — 앱 입구 함수. 돌려주는 것 = 새 블럭 id */
const insertText = (page, content = 'AAA BBB CCC') => page.evaluate((t) => {
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

/* 패널 단추를 «진짜 마우스»로 누른다 — 선택을 지키는 길(mousedown preventDefault)을 그대로 탄다. */
async function clickBtn(page, sel) {
  const b = await page.locator(sel).first().boundingBox();
  if (!b) throw new Error('no box: ' + sel);
  await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
  await page.waitForTimeout(150);
}

/* 글자칸에 들어가 «끝에서 back 글자 앞»부터 ⇧← len 번으로 고른다 (text-selection-panel.dom.spec.js 와 ★같은 관용구).
   'AAA BBB CCC' 에서 (back 4, len 3) = "BBB" · (back 0, len 3) = "CCC".
   ★자리가 «멈춘 뒤»의 좌표로 누른다(_root-harness waitStableRect) — 앞선 조작 뒤 자리가 아직 움직이는
     사이에 좌표를 재면 ★엉뚱한 곳을 더블클릭한다(2026-10-08 ⑥ 시험에서 메뉴바를 눌러 선택이 "File" 이 됐다). */
async function editAndSelectTail(page, hostSel, back, len) {
  await page.locator(hostSel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, hostSel);
  await page.mouse.dblclick(r.left + r.width - 4, r.top + r.height / 2);
  await page.waitForTimeout(300);
  await page.keyboard.press('End');
  for (let i = 0; i < back; i++) await page.keyboard.press('ArrowLeft');
  for (let i = 0; i < len; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
}
const editAndSelectBBB = (page, hostSel) => editAndSelectTail(page, hostSel, 4, 3);

async function assertPremiseSel(page, hostSel, want) {
  const p = await page.evaluate((hs) => {
    const s = getSelection(); const host = document.querySelector(hs);
    return { rc: s.rangeCount, col: s.isCollapsed, str: s.toString(),
             inHost: !!host && host.contains(s.anchorNode) && host.contains(s.focusNode) };
  }, hostSel);
  expect(p, `★전제 — 글자칸 안에 ${JSON.stringify(want)} 가 선택돼 있어야 한다. 잰 값 ${JSON.stringify(p)}`)
    .toEqual({ rc: 1, col: false, str: want, inHost: true });
}
const assertPremiseBBB = (page, hostSel) => assertPremiseSel(page, hostSel, 'BBB');

/* 「바깥」 = 캔버스 빈 곳(패널은 x≥1360). text-selection-panel.dom.spec.js 와 ★같은 좌표. */
const OUTSIDE = { x: 800, y: 960 };
/* ★★저장 선택을 ★버리고 패널을 다시 연다 — 「★무선택 갈래」를 재려면 ★이게 필요하다.
   2026-10-08 실측: ★부분 서식 뒤에도 ★저장 선택이 ★살아 있다(TX1 정책 — 「연달아 두 번째 조작도
   ★같은 글자에 간다」, js/props/_text-selection.js). ⇒ 단추를 ★두 번 누르면 ★둘 다 «부분» 갈래다.
   ⛔그래서 「두 번 눌렀으니 블럭 전체가 토글됐겠지」로 읽으면 ★다른 것을 잰다 — 처음 U9 ㉡ 가 그 꼴로 빨개졌다.
   ★사람이 하는 순서 = ★바깥을 눌러 편집을 떠난다. 그러면 패널이 닫히므로 ★다시 연다. */
async function dropSelection(page, id) {
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);
  await page.waitForTimeout(250);
  const alive = await page.evaluate(() => !!window.__textSelection?.getSavedTextSelection?.());
  expect(alive, '★전제 — 바깥을 눌렀는데 저장 선택이 남아 있다(그러면 아래가 «부분» 갈래를 잰다)').toBe(false);
  await openPanel(page, id);
}

/* 글자별 computed text-decoration-line — [글자, 값] 의 줄 */
const perChar = (page, hostSel) => page.evaluate((hs) => {
  const host = document.querySelector(hs); const out = [];
  const w = document.createTreeWalker(host, NodeFilter.SHOW_TEXT); let n;
  while ((n = w.nextNode())) {
    const cs = getComputedStyle(n.parentElement);
    const v = cs.textDecorationLine || cs.textDecoration || '';
    for (const ch of n.nodeValue) out.push([ch, v]);
  }
  return out;
}, hostSel);

/* BBB 안/밖의 값 집합 — 「걸려야 할 곳」과 「안 걸려야 할 곳」을 ★한 번에 */
async function split(page, hostSel) {
  const pc = (await perChar(page, hostSel)).filter(([ch]) => ch.trim());
  const text = pc.map(x => x[0]).join('');
  const i = text.indexOf('BBB');
  return {
    text,
    inB:  [...new Set(pc.slice(i, i + 3).map(x => x[1]))],
    out:  [...new Set([...pc.slice(0, i), ...pc.slice(i + 3)].map(x => x[1]))],
  };
}

/* 글자칸을 그려서 «가로로 긴 획»이 있는 줄을 센다 — 밑줄은 글자 폭만큼 ★이어진 한 줄이다.
   ⛔computed 만 믿지 않는다(「값은 박혔는데 안 그려진다」를 못 본다). */
async function paintedRuns(page, hostSel) {
  const b64 = (await (await page.$(hostSel)).screenshot()).toString('base64');
  return page.evaluate(async (s) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    let long = 0, best = 0;
    for (let y = 0; y < c.height; y++) {
      let run = 0, rowBest = 0;
      for (let x = 0; x < c.width; x++) {
        const k = (y * c.width + x) * 4;
        if (d[k] < 120 && d[k + 1] < 120 && d[k + 2] < 120) { run++; rowBest = Math.max(rowBest, run); }
        else run = 0;
      }
      best = Math.max(best, rowBest);
      if (rowBest > 60) long++;          // 글자 획으로는 60px 연속 검정이 안 난다(본문 15px)
    }
    return { longRows: long, maxRun: best, w: c.width, h: c.height };
  }, b64);
}

const deco = (page, id) => page.evaluate((i) => {
  const ce = document.getElementById(i).querySelector('[contenteditable]');
  const cs = getComputedStyle(ce);
  return { computed: cs.textDecorationLine || cs.textDecoration || '',
           inlineLine: ce.style.textDecorationLine, inlineShort: ce.style.textDecoration,
           uBtn: document.getElementById('txt-underline-btn')?.classList.contains('active') ?? null,
           sBtn: document.getElementById('txt-strike-btn')?.classList.contains('active') ?? null };
}, id);

/* ══════════════════════════════════════════════════════════════════ */

test('U1 ★무선택 전체 — 켜면 밑줄이 «그려지고», 끄면 사라진다 (전제: 켜기 전 없음 · 저장 선택 없음)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  expect(id, '★블럭이 안 들어갔다 — 아래는 아무것도 안 잰다').toBeTruthy();
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;

  /* ★전제 ⒜ — 켜기 전엔 밑줄이 없다 */
  const b0 = await deco(page, id);
  expect(b0.computed, `★전제 — 켜기 전에 이미 밑줄이다. 잰 값 ${b0.computed}`).not.toContain('underline');
  /* ★전제 ⒝ — ★저장된 선택이 없다(있으면 「부분」 갈래를 재게 되어 U1 이 다른 것을 잰다) */
  const saved0 = await page.evaluate(() => !!window.__textSelection?.getSavedTextSelection?.());
  expect(saved0, '★전제 — 저장된 선택이 있다. 이 판에서 U1 은 «전체» 갈래를 안 잰다').toBe(false);
  const p0 = await paintedRuns(page, host);
  expect(p0.longRows, `★전제 — 켜기 전에 이미 «가로로 긴 획»이 있다(잣대가 죽었다). 잰 값 ${JSON.stringify(p0)}`).toBe(0);

  await clickBtn(page, '#txt-underline-btn');
  const on = await deco(page, id);
  const p1 = await paintedRuns(page, host);
  console.log('  U1 on:', JSON.stringify({ ...on, ...p1 }));
  expect(on.computed, `★밑줄이 안 걸렸다. 잰 값 ${on.computed}`).toContain('underline');
  expect(on.uBtn, '★단추 표시가 안 켜졌다 — 표시와 실제가 갈리면 다음 클릭이 거꾸로 간다').toBe(true);
  expect(p1.longRows, `★값은 박혔는데 ★안 그려진다. 잰 값 ${JSON.stringify(p1)}`).toBeGreaterThan(0);

  await clickBtn(page, '#txt-underline-btn');
  const off = await deco(page, id);
  const p2 = await paintedRuns(page, host);
  console.log('  U1 off:', JSON.stringify({ ...off, ...p2 }));
  expect(off.computed, `★꺼도 밑줄이 남는다. 잰 값 ${off.computed}`).not.toContain('underline');
  expect(off.uBtn).toBe(false);
  expect(p2.longRows, `★꺼도 획이 그려져 있다. 잰 값 ${JSON.stringify(p2)}`).toBe(0);
  const text = await page.evaluate((h) => document.querySelector(h).innerText, host);
  expect(text, '★끄면서 글자가 사라졌다').toBe('AAA BBB CCC');
  expect(errs).toEqual([]);
});

test('U2 ★부분 선택 — BBB «에만» 걸린다 (음성대조: AAA·CCC 엔 안 걸린다)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;

  await editAndSelectBBB(page, host);
  await assertPremiseBBB(page, host);

  const pre = await split(page, host);
  expect(pre.inB.some(v => v.includes('underline')), '★전제 — 고르기 전에 이미 밑줄이다').toBe(false);

  await clickBtn(page, '#txt-underline-btn');
  const got = await split(page, host);
  console.log('  U2:', JSON.stringify(got));
  expect(got.text, '★글자가 바뀌었다').toBe('AAABBBCCC');
  expect(got.inB.every(v => v.includes('underline')),
    `★BBB 에 밑줄이 안 걸렸다. 잰 값 inB=${JSON.stringify(got.inB)}`).toBe(true);
  expect(got.out.some(v => v.includes('underline')),
    `★★BBB «밖»에도 밑줄이 걸렸다 — 선택한 만큼이 아니다. 잰 값 out=${JSON.stringify(got.out)}`).toBe(false);
  expect(errs).toEqual([]);
});

test('U3 ★★취소선과 공존 — 한 CSS 속성을 나눠 쓰는데 서로를 안 지운다 (양방향)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);

  /* ㉠ 취소선 먼저 → 밑줄을 켠다. 취소선이 ★살아 있어야 한다. */
  await clickBtn(page, '#txt-strike-btn');
  const s1 = await deco(page, id);
  expect(s1.computed, `★전제 — 취소선이 안 걸렸다. 잰 값 ${s1.computed}`).toContain('line-through');
  await clickBtn(page, '#txt-underline-btn');
  const both = await deco(page, id);
  console.log('  U3 ㉠ 취소선→밑줄:', JSON.stringify(both));
  expect(both.computed, `★★밑줄을 켜면서 ★취소선이 지워졌다. 잰 값 ${both.computed}`).toContain('line-through');
  expect(both.computed, `★밑줄이 안 걸렸다. 잰 값 ${both.computed}`).toContain('underline');
  expect([both.uBtn, both.sBtn], '★둘 다 켜졌는데 단추 표시가 안 맞는다').toEqual([true, true]);

  /* ㉡ 밑줄만 끈다 → 취소선은 ★남는다 */
  await clickBtn(page, '#txt-underline-btn');
  const sOnly = await deco(page, id);
  console.log('  U3 ㉡ 밑줄만 끔:', JSON.stringify(sOnly));
  expect(sOnly.computed, `★밑줄을 끄면서 취소선까지 지워졌다. 잰 값 ${sOnly.computed}`).toContain('line-through');
  expect(sOnly.computed, `★밑줄이 안 꺼졌다. 잰 값 ${sOnly.computed}`).not.toContain('underline');

  /* ㉢ 반대 방향 — 밑줄 먼저 → 취소선을 켠다. 밑줄이 ★살아 있어야 한다. */
  await clickBtn(page, '#txt-strike-btn');            // 취소선 끔(바닥 비움)
  await clickBtn(page, '#txt-underline-btn');         // 밑줄 켬
  const u1 = await deco(page, id);
  expect(u1.computed, `★전제 — 바닥이 «밑줄만»이 아니다. 잰 값 ${u1.computed}`).toContain('underline');
  expect(u1.computed, `★전제 — 취소선이 안 꺼졌다. 잰 값 ${u1.computed}`).not.toContain('line-through');
  await clickBtn(page, '#txt-strike-btn');
  const both2 = await deco(page, id);
  console.log('  U3 ㉢ 밑줄→취소선:', JSON.stringify(both2));
  expect(both2.computed, `★★취소선을 켜면서 ★밑줄이 지워졌다. 잰 값 ${both2.computed}`).toContain('underline');
  expect(both2.computed, `★취소선이 안 걸렸다. 잰 값 ${both2.computed}`).toContain('line-through');
  expect(errs).toEqual([]);
});

test('U4 ★저장 왕복 — 저장 → 앱 재기동 → 다시 열기 뒤에도 밑줄이 산다', async ({ page }) => {
  await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await clickBtn(page, '#txt-underline-btn');
  const before = await deco(page, id);
  expect(before.computed, `★전제 — 저장 전에 밑줄이 없다. 잰 값 ${before.computed}`).toContain('underline');

  const snap = await page.evaluate(() => window.serializeProject());
  expect(/underline/.test(snap), '★저장본에 밑줄이 ★안 실렸다 — 다시 열면 사라진다').toBe(true);

  await bootApp(page);                                   // ★앱을 다시 띄운다(「새로 연 것」과 같은 꼴)
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(400);

  const after = await page.evaluate((i) => {
    const tb = document.getElementById(i);
    if (!tb) return { err: 'tb 가 다시 안 생겼다' };
    const ce = tb.querySelector('[contenteditable]') || tb.querySelector('[class^="tb-"]');
    const cs = getComputedStyle(ce);
    return { computed: cs.textDecorationLine || cs.textDecoration || '', text: ce.innerText };
  }, id);
  console.log('  U4:', JSON.stringify(after));
  expect(after.err).toBeUndefined();
  expect(after.computed, `★다시 연 뒤 밑줄이 사라졌다. 잰 값 ${after.computed}`).toContain('underline');
  expect(after.text).toBe('AAA BBB CCC');
});

test('U5 ★패널 되비침 — 다시 열면 단추가 active (표시와 실제가 안 갈린다)', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await clickBtn(page, '#txt-underline-btn');

  /* ★다른 블럭으로 갔다 돌아온다 — 패널을 ★처음부터 다시 그리게 만든다(지금 DOM 을 다시 읽는 길) */
  const id2 = await insertText(page, 'ZZZ');
  await openPanel(page, id2);
  const other = await page.evaluate(() => document.getElementById('txt-underline-btn')?.classList.contains('active'));
  expect(other, '★★밑줄 안 건 다른 블럭인데 단추가 켜져 있다 — 전역 상태를 읽고 있다').toBe(false);

  await openPanel(page, id);
  const back = await page.evaluate(() => document.getElementById('txt-underline-btn')?.classList.contains('active'));
  console.log('  U5:', JSON.stringify({ other, back }));
  expect(back, '★밑줄 건 블럭인데 단추가 꺼져 보인다 — 한 번 누르면 꺼야 할 것을 켠다').toBe(true);
  expect(errs).toEqual([]);
});

test('U6 ★배송본 — 내보내기 «세척»이 밑줄 인라인을 안 걷어낸다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  await clickBtn(page, '#txt-underline-btn');
  const on = await deco(page, id);
  expect(on.computed, '★전제 — 내보내기 전에 밑줄이 없다').toContain('underline');
  expect(on.inlineLine, `★전제 — 밑줄이 «인라인»에 없다(그러면 아래가 다른 것을 잰다). 잰 값 ${on.inlineLine}`).toContain('underline');

  /* ★단독 HTML·PNG·썸네일 ★세 길이 ★같이 쓰는 세척 한 벌(js/io/capture-safety.js) —
     여기서 인라인 서식이 걷히면 ★배송본에서 밑줄이 사라진다. ⛔exportHTMLFile() 은 못 쓴다:
     electronAPI 가짜라 파일을 안 쓰고 문자열도 안 돌려준다(이 하네스의 «못 재는 축»). */
  const r = await page.evaluate(async (i) => {
    const mod = await import('../../js/io/capture-safety.js');
    const clone = document.getElementById('canvas').cloneNode(true);
    mod.stripEditorOnlyForCapture(clone);
    const tb = clone.querySelector('#' + i);
    const ce = tb && (tb.querySelector('[contenteditable]') || tb.querySelector('[class^=\"tb-\"]'));
    return { found: !!ce, inline: ce ? (ce.getAttribute('style') || '') : null,
             html: ce ? ce.outerHTML.slice(0, 200) : null };
  }, id);
  console.log('  U6:', JSON.stringify(r));
  expect(r.found, '★세척 뒤 글자칸이 없다 — 이 측정이 아무것도 안 잰다').toBe(true);
  expect(r.inline, `★세척이 밑줄 인라인을 걷어냈다 — 배송본에 밑줄이 없다. 잰 값 ${r.inline}`).toContain('underline');
  expect(errs).toEqual([]);
});

test('U7 ★⌘U — 편집 중 ⌘U 가 밑줄을 걸고 ★되돌리기 한 단위다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;
  await editAndSelectBBB(page, host);
  await assertPremiseBBB(page, host);

  const pre = await split(page, host);
  expect(pre.inB.some(v => v.includes('underline')), '★전제 — 누르기 전에 이미 밑줄이다').toBe(false);

  await page.keyboard.press('ControlOrMeta+u');
  await page.waitForTimeout(200);
  const got = await split(page, host);
  console.log('  U7:', JSON.stringify(got));
  expect(got.inB.every(v => v.includes('underline')),
    `★⌘U 가 밑줄을 안 걸었다. 잰 값 inB=${JSON.stringify(got.inB)}`).toBe(true);
  expect(got.out.some(v => v.includes('underline')),
    `★⌘U 가 선택 밖에도 걸었다. 잰 값 out=${JSON.stringify(got.out)}`).toBe(false);

  /* ★되돌리기 한 단위 — 네이티브 ⌘U 는 history 를 안 남긴다(그러면 ⌘Z 가 밑줄을 못 되돌린다) */
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.waitForTimeout(150);
  await page.keyboard.press('ControlOrMeta+z');
  await page.waitForTimeout(350);
  const undone = await split(page, host);
  console.log('  U7 undo:', JSON.stringify(undone));
  expect(undone.inB.some(v => v.includes('underline')),
    `★⌘Z 로 안 되돌아간다 — ⌘U 가 되돌리기 기록을 안 남겼다. 잰 값 ${JSON.stringify(undone)}`).toBe(false);
  expect(errs).toEqual([]);
});

test('U8 ★다른 패널엔 «없다» — 기본 false 라 모달 패널 DOM 에 밑줄 단추가 안 생긴다', async ({ page }) => {
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  /* ★양성대조 — 텍스트 패널에는 ★있다(아래 「없다」가 «아무것도 못 재는 상태»와 구분된다) */
  const inText = await page.evaluate(() => !!document.getElementById('txt-underline-btn'));
  expect(inText, '★텍스트 패널에 밑줄 단추가 없다 — 아래 음성대조가 공짜로 참이 된다').toBe(true);

  const mdl = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addModalBlock?.({});
    const fresh = [...document.querySelectorAll('#canvas .modal-block')].filter(e => !before.has(e.id));
    const el = fresh[fresh.length - 1];
    if (!el) return { err: 'modal-block 이 안 들어갔다' };
    window.showModalProperties?.(el);
    return { has: !!document.getElementById('mdl-typo-underline-btn'),
             hasStrike: !!document.getElementById('mdl-typo-strike-btn') };
  });
  console.log('  U8:', JSON.stringify(mdl));
  expect(mdl.err).toBeUndefined();
  expect(mdl.hasStrike, '★전제 — 모달 타이포 절이 안 열렸다(그러면 아래가 아무것도 안 잰다)').toBe(true);
  expect(mdl.has, '★모달에도 밑줄 단추가 생겼다 — showUnderline 기본값이 false 가 아니다(골든이 갈린다)').toBe(false);
  expect(errs).toEqual([]);
});

test('U9 ★★취소선을 «끌 때»도 부분 잔재를 걷는다 (부수 변경을 검사로 잠근다)', async ({ page }) => {
  /* ★왜 이 시험이 ★따로 있나 (지디 2026-10-08 판정: 「부수 변경 ★유지 GO. ⛔단 ★검사를 같이 세워라」)
     옛 취소선 배선은 ★켤 때만 부분 잔재를 걷고 ★끌 때는 ★안 걷었다. B·I(wireInlineStyleBtn)·형광펜
     ★셋은 ★양쪽에서 걷으니 ★넷 중 ★하나만 달랐다 — ★«명부가 갈렸다»는 뜻이라 합치는 쪽이 맞다.
     ⇒ wireDecoBtn 은 ★양쪽에서 걷는다. ★그 결정을 ★여기서 잠근다.
     ★잔재는 ★앱의 그 길(부분 선택 → execCommand)이 만든 ★실물로 만든다 — ⛔손으로 `<s>` 를 심지 않는다. */
  const errs = await setup(page);
  const id = await insertText(page);
  await openPanel(page, id);
  const host = `#${id} [contenteditable]`;

  const residue = () => page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('[contenteditable]');
    const tags = [...ce.querySelectorAll('strike, s')];
    const spans = [...ce.querySelectorAll('span[style*="line-through"]')];
    return { tags: tags.length, spans: spans.length, n: tags.length + spans.length,
             inlineLine: ce.style.textDecorationLine, html: ce.innerHTML.slice(0, 200) };
  }, id);

  /* ㉠ ★양성대조 — 앱의 «부분 선택» 길이 ★실제로 잔재를 만든다(잣대가 살아 있다) */
  await editAndSelectBBB(page, host);
  await assertPremiseBBB(page, host);
  await clickBtn(page, '#txt-strike-btn');
  const r1 = await residue();
  console.log('  U9 ㉠ 부분 취소선:', JSON.stringify({ tags: r1.tags, spans: r1.spans, inline: r1.inlineLine }));
  expect(r1.n, `★부분 선택으로 취소선을 걸었는데 ★잔재가 0건이다 — 이 시험의 잣대가 죽었다(아래가 공짜로 참이 된다). html=${r1.html}`).toBeGreaterThan(0);
  expect(r1.inlineLine, '★전제 — 부분 적용인데 블럭 인라인까지 걸렸다').not.toContain('line-through');
  /* ★사실 단언 — 부분 서식 뒤에도 ★저장 선택이 ★산다(TX1 정책). ★아래 ㉡ 가 바깥을 눌러야 하는 ★까닭이다. */
  expect(await page.evaluate(() => !!window.__textSelection?.getSavedTextSelection?.()),
    '★부분 서식 뒤 저장 선택이 사라졌다 — TX1 정책(연달아 같은 글자)이 깨졌나').toBe(true);

  /* ㉡ ★켜기 갈래 — 잔재를 걷고 블럭 인라인 하나가 «단일 소스»가 된다(옛 판도 하던 것) */
  await dropSelection(page, id);
  await clickBtn(page, '#txt-strike-btn');
  const r2 = await residue();
  console.log('  U9 ㉡ 켜기:', JSON.stringify({ tags: r2.tags, spans: r2.spans, inline: r2.inlineLine }));
  expect(r2.n, `★켤 때 잔재를 안 걷었다. 잰 값 tags=${r2.tags} spans=${r2.spans}`).toBe(0);
  expect(r2.inlineLine, `★켰는데 블럭 인라인에 없다. 잰 값 ${r2.inlineLine}`).toContain('line-through');

  /* ㉢ ★블럭이 «켜진 채» 잔재가 있는 상태를 만든다 — ★이게 ㉣ 의 전제다.
     ★★먼저 ★잰 사실(2026-10-08): ★단추 경로로는 이 상태를 ★★못 만든다 —
       블럭이 켜진 채 부분 선택으로 S 를 누르면 execCommand 가 그 선택의 취소선을 «끄는» 쪽으로 가서
       line-through 잔재를 ★안 남긴다(실측 tags 0 · spans 0 · 인라인 line-through 그대로).
       ⛔그걸 모르고 「부분 조작하면 잔재가 생긴다」로 전제를 걸었다가 ★이 자리에서 빨개졌다.
     ⇒ 그러면 이 상태는 ★어디서 오나 — ★붙여넣기 · ★옛/외부 저장본 열기 · 가져오기다
       (그 길들은 execCommand 토글을 안 타고 `<s>` 를 ★그대로 들여온다).
     ⇒ 아래는 ★그 길과 ★같은 꼴을 만든다(글자칸 HTML 에 `<s>` 가 들어온 상태). ★준비 단계다 —
       addTextBlock 과 ★같은 층이고, ⛔«재는 대상»이 아니다.
     ★★그리고 ★그런 저장본이 ★실제로 만들어진다는 것을 ★같이 잠근다(serializeProject 에 `<s>` 가 실린다).
       ⛔그 단언이 없으면 이 장면은 ★「앱에서 안 생기는 꼴」일 수 있다. */
  await page.evaluate((i) => {
    const ce = document.getElementById(i).querySelector('[contenteditable]');
    ce.innerHTML = ce.innerHTML.replace('CCC', '<s>CCC</s>');
  }, id);
  const r3 = await residue();
  const snapHasS = await page.evaluate(() => /<s>/.test(window.serializeProject()));
  console.log('  U9 ㉢ 켜진 채 잔재(저장본 경로):', JSON.stringify({ tags: r3.tags, spans: r3.spans, inline: r3.inlineLine, snapHasS }));
  expect(r3.n, `★★전제 — 끄기 «전»에 잔재가 있어야 한다. 0건이면 ㉣ 는 ★끄는 갈래의 걷기를 ★안 재는 것이다. 잰 값 tags=${r3.tags} spans=${r3.spans} html=${r3.html}`).toBeGreaterThan(0);
  expect(r3.inlineLine, `★전제 — 블럭 인라인이 «켜진 채»여야 한다(그래야 다음 클릭이 ★끄는 갈래다). 잰 값 ${r3.inlineLine}`).toContain('line-through');
  expect(snapHasS, '★전제 — 이 꼴이 ★저장본에 안 실린다. 그러면 「저장본 열기로 온다」가 거짓이고 이 장면은 앱에서 안 생긴다').toBe(true);

  /* ㉣ ★★끄기 갈래 — 여기서 걷는 것이 ★이 커밋의 부수 변경이다(옛 판은 ★안 걷었다).
     ★무선택임을 ★단언한다 — 선택이 살아 있으면 «부분» 갈래로 가서 ★다른 것을 잰다. */
  expect(await page.evaluate(() => !!window.__textSelection?.getSavedTextSelection?.()),
    '★전제 — 저장 선택이 살아 있다. 이러면 ㉣ 가 ★끄는 갈래를 안 잰다').toBe(false);
  await clickBtn(page, '#txt-strike-btn');
  const r4 = await residue();
  const text = await page.evaluate((h) => document.querySelector(h).innerText, host);
  console.log('  U9 ㉣ 끄기:', JSON.stringify({ tags: r4.tags, spans: r4.spans, inline: r4.inlineLine, text }));
  expect(r4.n, `★★끌 때 부분 잔재를 ★안 걷었다 — 「껐는데 일부 글자만 취소선」이 된다. 잰 값 tags=${r4.tags} spans=${r4.spans} html=${r4.html}`).toBe(0);
  expect(r4.inlineLine, `★껐는데 블럭 인라인이 남았다. 잰 값 ${r4.inlineLine}`).not.toContain('line-through');
  expect(text, '★걷으면서 글자가 사라졌다').toBe('AAA BBB CCC');
  /* ★음성대조 — 밑줄은 ★안 건드렸다(같은 CSS 속성이지만 ★내 토큰만 걷는다) */
  const deco2 = await deco(page, id);
  expect(deco2.computed, '★취소선 잔재를 걷으면서 ★밑줄까지 켜졌다').not.toContain('underline');
  expect(errs).toEqual([]);
});
