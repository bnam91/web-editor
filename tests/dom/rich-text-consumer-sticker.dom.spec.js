/* rich-text-consumer-sticker.dom.spec.js — ★«공용 sanitizer 를 쓰는 ★소비자»의 ★행동을 재는 자.
 *
 * ★★왜 이 파일이 생겼나 (지디 2026-10-08 ⑴⑵ · ★그가 ★자기 QA 로 잡은 것)
 *   `js/util/sanitize-rich-text.js` 를 공용화한 뒤 ★무력화 QA 를 돌렸더니 ★빨강 3건이
 *   ★★전부 ★«모듈 ★자신의 spec»(rich-text-sanitize S2·S3·S5)이었다.
 *   ★스티커를 겨냥한 DOM ★9벌은 ★하나도 ★안 빨개졌다 — 그 9벌에서
 *   `textHtml`·`sanitizeRichText`·`richTextHasFormatting` 언급이 ★전부 ★0 이었다.
 *   ⇒ ★★그 길을 ★«재는 자»가 ★애초에 ★0 이라 ★빨개질 ★수가 없었다.
 *   ⇒ ★★고친 쌍: 「무력화 → ★«그 길을 ★재는 ★검사» N개 ★전부 빨강」
 *      ＋ 「빨강이 ★전부 ★모듈 자신의 spec 이면 그것은 ★«안전하다»가 아니라 ★★«소비자 쪽을 안 재고 있다»다」
 *   ★★⇒ ★이 파일이 ★그 ★N 을 ★0 에서 ★올리는 자다. ⛔지우면 ★그 쌍이 ★다시 거짓이 된다.
 *
 * ★★«사람이 하는 순서»를 밟는다 — ⛔장면을 손으로 만들지 않는다
 *   스티커를 ★넣고 → ★더블클릭으로 편집에 들어가고(그게 앱의 그 제스처다 · js/sticker-select.js:486)
 *   → ★진짜 키로 글자를 치고 → ★끝 3글자를 ⇧← 로 ★고르고 → ★⌘B 를 누르고 → ★바깥을 눌러 ★커밋한다.
 *   ★각 칸마다 ★전제를 ★단언한다(선택이 섰나 · 커밋됐나). ⛔전제 없는 수는 ★증거가 아니다.
 *
 * ★★⚠️실측으로 ★내 전제가 ★틀렸던 자리(2026-10-08) — ★적어 둔다
 *   ★스티커 글자는 ★기본이 ★굵다(STICKER_DEFAULTS.fontWeight) ⇒ ★선택에 ⌘B 를 누르면
 *   ★`<b>` 가 아니라 ★`<span style="font-weight: normal">` 이 나온다(★굵기를 ★끈 것이다).
 *   ⛔그래서 「`<b>` 가 생겼나」로 전제를 걸면 ★제품이 도는데도 ★빨개진다 — ★실제로 그렇게 빨개졌다.
 *   ⇒ ★★판정은 ★«앱 자신의 판정자»로 한다: ★`window._stickerHtmlHasFormatting`
 *     (= 공용 모듈의 `richTextHasFormatting` · ★커밋 경로가 ★쓰는 ★그 식이다 — sticker-select.js:552).
 *   ★★그 선택이 ★이 검사를 ★공용 본문에 ★묶어 준다 ⇒ ★본문 무력화가 ★여기로 ★닿는다.
 *
 * 재는 것
 *   C1 ★사람 순서 — 부분 서식이 ★`dataset.textHtml` 에 ★저장되고 ★렌더에 ★산다
 *   C2 ★★무회귀 — `textHtml` ★없는 블럭(옛 저장본 꼴)은 ★평문 경로로 그려진다
 *      ★스티커 선례의 규약이고(소스: 「옛 저장본(textHtml 없음) ★완전 무변·무회귀」),
 *      ★모달(⑶)도 ★같은 꼴이어야 한다 — 지디 ⑶② 가 ★요구한 칸이다.
 *   C3 ★★변조 재-sanitize — ★저장본의 `textHtml` 에 `<script>`·`onerror`·`url(` 가 들어 있어도
 *      ★렌더가 ★걷는다. ★★그게 ★이 모듈이 ★«렌더·로드마다 다시 돌는» ★존재 이유다.
 *   C4 ★저장 왕복 — serializeProject → ★앱 재기동 → applyProjectData 뒤에도 부분 서식이 산다
 *   C5 ★서식이 ★없으면 `textHtml` 이 ★안 생긴다(평문 동치 → ★delete) — ★C2 의 짝
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 재기동 · 파일로 쓰인 저장본 · 다른 배율(100% 에서만).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js rich-text-consumer-sticker
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const SEC = '<div class="section-block" id="sA" data-section="1" data-name="sA" style="background-color:#ffffff"><div class="section-hitzone"></div><div class="section-inner" id="inA"></div></div>';
const TXT = 'AAABBBCCC';
const OUTSIDE = { x: 800, y: 960 };

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

/* 스티커 넣기(준비) — 앱 입구 함수.
   ★★⚠️실측 — `addStickerBlock` 은 ★생성 ★직후 ★편집에 ★자동 진입한다(A26: 「생성 직후 ★프로그램적
     편집 진입에도 사용」 · js/sticker-select.js `_enterStickerEdit`).
   ⛔그 세션을 ★열어 둔 채 dataset 을 고치고 innerHTML 을 갈아끼우면, ★나중에 ★blur 가 ★묵은
     `finish` 를 돌려 ★detach 된 노드의 innerText(=빈 값)를 읽고 ★`dataset.text` 를 ★플레이스홀더로 ★덮는다
     (실측: 렌더는 AAABBBCCC 인데 ★dataset.text 가 ★"Text" 로 갈렸다).
   ⇒ ★넣은 뒤 ★바깥을 눌러 ★그 세션을 ★닫고, ★«편집이 안 열려 있음»을 ★단언한 뒤 돌려준다. */
async function addSticker(page) {
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addStickerBlock?.({ shape: 'text' });
    const fresh = [...document.querySelectorAll('#canvas .sticker-block')].filter(e => !before.has(e.id));
    return fresh.length ? fresh[fresh.length - 1].id : null;
  });
  if (!id) return null;
  await page.waitForTimeout(300);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);     // ★자동 진입한 편집을 닫는다
  await page.waitForTimeout(400);
  const open = await page.evaluate((i) => document.querySelector(`#${i} [contenteditable="true"]`) ? true : false, id);
  expect(open, '★전제 — 스티커 편집 세션이 ★아직 열려 있다(묵은 finish 가 dataset 을 덮는다)').toBe(false);
  return id;
}

const state = (page, id) => page.evaluate((i) => {
  const b = document.getElementById(i);
  if (!b) return { err: 'block 이 없다' };
  const sp = b.querySelector('.sticker-text');
  return {
    text: b.dataset.text ?? null,
    textHtml: b.dataset.textHtml ?? null,
    hasKey: Object.prototype.hasOwnProperty.call(b.dataset, 'textHtml'),
    rendered: sp ? sp.innerHTML : null,
    shown: sp ? sp.innerText : null,
    bTags: sp ? sp.querySelectorAll('b,strong').length : -1,
    styledSpans: sp ? sp.querySelectorAll('span[style]').length : -1,
    /* ★앱 자신의 판정자 — 커밋 경로가 쓰는 그 식(공용 모듈의 richTextHasFormatting) */
    fmtRendered: sp ? (window._stickerHtmlHasFormatting?.(sp.innerHTML) ?? null) : null,
    fmtStored: (window._stickerHtmlHasFormatting?.(b.dataset.textHtml || '') ?? null),
  };
}, id);

/* 더블클릭으로 편집에 들어가 전체선택 → 타이핑 → 끝 3글자 고르기 → ⌘B → 바깥 클릭(커밋).
   ★`Home` 은 이 글자칸들에서 안 먹었다(⑥·②⑦ 실측) ⇒ ★`End` 기준으로 센다. */
async function editAndBoldTail3(page, id) {
  const sel = `#${id} .sticker-text`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  const ce = await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel);
  expect(ce, '★전제 — 더블클릭으로 ★편집에 못 들어갔다(앱의 그 제스처가 아니다)').toBe('true');

  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TXT);
  await page.waitForTimeout(200);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
  const s = await page.evaluate(() => { const x = getSelection();
    return { rc: x.rangeCount, col: x.isCollapsed, str: x.toString() }; });
  expect(s, `★전제 — 끝 3글자("CCC")가 골라져야 한다. 잰 값 ${JSON.stringify(s)}`)
    .toEqual({ rc: 1, col: false, str: 'CCC' });

  await page.keyboard.press('ControlOrMeta+b');
  await page.waitForTimeout(200);
  /* ★판정은 ★«앱 자신의 판정자»로 — ⛔`<b>` 를 찾지 않는다(머리말의 그 실측). */
  const live = await page.evaluate((x) => {
    const e = document.querySelector(x);
    return { html: e.innerHTML, fmt: window._stickerHtmlHasFormatting?.(e.innerHTML) ?? null,
             b: e.querySelectorAll('b,strong').length, spans: e.querySelectorAll('span[style]').length };
  }, sel);
  expect(live.fmt, `★전제 — ⌘B 뒤에도 ★«부분 서식»이 ★없다(앱 자신의 판정자로 쟀다). 잰 값 ${JSON.stringify(live)}`).toBe(true);

  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);   // ★커밋(blur → finish)
  await page.waitForTimeout(500);
  return live;
}

/* ══════════════════════════════════════════════════════════════════ */

test('C1 ★사람 순서 — 부분 서식이 dataset.textHtml 에 저장되고 렌더에 산다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addSticker(page);
  expect(id, '★스티커가 안 들어갔다 — 아래는 아무것도 안 잰다').toBeTruthy();
  const s0 = await state(page, id);
  expect(s0.hasKey, `★전제 — 새 스티커에 이미 textHtml 이 있다. 잰 값 ${JSON.stringify(s0)}`).toBe(false);

  const live = await editAndBoldTail3(page, id);
  const s1 = await state(page, id);
  console.log('  C1:', JSON.stringify({ live, ...s1 }));
  expect(s1.text, `★평문도 같이 저장돼야 한다(두 칸이 짝이다). 잰 값 ${s1.text}`).toBe(TXT);
  expect(s1.textHtml, `★★부분 서식이 ★dataset.textHtml 에 안 저장됐다. 잰 값 ${JSON.stringify(s1)}`).toBeTruthy();
  expect(s1.fmtStored, `★★저장된 textHtml 에 ★«서식»이 없다(앱 판정자로 쟀다). 잰 값 ${JSON.stringify(s1)}`).toBe(true);
  expect(s1.fmtRendered, `★★렌더에 서식이 ★안 살았다 — 저장은 됐는데 ★안 보인다. 잰 값 ${JSON.stringify(s1)}`).toBe(true);
  expect(s1.shown, `★글자가 바뀌었다. 잰 값 ${s1.shown}`).toBe(TXT);
  expect(errs).toEqual([]);
});

test('C2 ★★무회귀 — textHtml 없는 블럭(옛 저장본 꼴)은 평문 경로로 그려진다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addSticker(page);
  /* ★옛 저장본 꼴 = `text` 만 있고 `textHtml` 이 ★없다. ★그 꼴로 두고 ★다시 그린다.
     ⛔이것은 «준비»다 — addStickerBlock 과 같은 층이고 ★재는 대상이 아니다. */
  /* ⚠️실측 — ★생성 ★직후에 dataset 을 쓰면 ★나중에 ★기본값('Text')으로 ★덮인다
     (앞 회차에서 `text:"Text"` 인데 ★렌더는 AAABBBCCC 로 ★갈려 있었다). ⇒ ★멈춘 뒤 쓰고 ★전제를 단언한다. */
  await page.waitForTimeout(400);
  await page.evaluate((i) => {
    const b = document.getElementById(i);
    b.dataset.text = 'AAABBBCCC';
    delete b.dataset.textHtml;
    window.renderStickerBlock?.(b);
  }, id);
  await page.waitForTimeout(250);
  const s = await state(page, id);
  expect(s.text, `★전제 — 내가 쓴 평문이 ★dataset 에 안 남았다(생성 직후 덮임). 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  console.log('  C2:', JSON.stringify(s));
  expect(s.hasKey, `★전제 — textHtml 이 남아 있다. 이 판에선 C2 가 «옛 저장본»을 안 잰다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.shown, `★평문이 안 보인다. 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  expect(s.bTags, `★서식이 ★없는데 서식 태그가 생겼다. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  /* ★그려진 알맹이가 ★평문 그대로다 — 마크업이 끼면 옛 저장본의 모습이 바뀐 것이다 */
  expect(s.rendered, `★평문 경로가 아니다(마크업이 끼었다). 잰 값 ${s.rendered}`).toBe(TXT);
  expect(errs).toEqual([]);
});

test('C3 ★★변조 재-sanitize — 저장본의 textHtml 이 더럽혀져 있어도 렌더가 걷는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addSticker(page);
  /* ★저장본·.gdt 가 ★변조된 꼴. ★이 모듈이 ★«렌더·로드마다 다시 돌는» ★존재 이유가 ★이것이다. */
  const DIRTY = 'AAA<script>window.__pwned=1</script>'
              + '<span style="background-color:url(x)" onerror="window.__pwned=2">BBB</span>'
              + '<a href="javascript:void 0">CCC</a><b>DDD</b>';
  await page.evaluate(([i, h]) => {
    const b = document.getElementById(i);
    b.dataset.text = 'AAABBBCCCDDD';
    b.dataset.textHtml = h;
    window.renderStickerBlock?.(b);
  }, [id, DIRTY]);
  const s = await state(page, id);
  const pwned = await page.evaluate(() => window.__pwned ?? null);
  console.log('  C3:', JSON.stringify({ rendered: s.rendered, pwned }));
  expect(s.rendered, '★전제 — 아무것도 안 그려졌다(그러면 아래 「없다」가 공짜로 참이 된다)').toBeTruthy();
  for (const [name, re] of [['script', /<script|__pwned/i], ['on* 속성', /onerror/i],
                            ['url(', /url\(/i], ['a[href]', /<a\b|href|javascript/i]]) {
    expect(re.test(s.rendered), `★★«${name}» 가 ★렌더에 살아남았다. 잰 값 ${s.rendered}`).toBe(false);
  }
  expect(pwned, `★★변조 코드가 ★실행됐다 — template 파싱이 아니다. 잰 값 ${pwned}`).toBeNull();
  /* ★음성대조 — 걷는 자가 ★«전부 지우는 자»는 아니다: 허용된 `<b>` 는 ★산다 */
  expect(/<b\b/i.test(s.rendered), `★허용된 <b> 까지 걷혔다 — 그러면 위 「없다」가 공짜다. 잰 값 ${s.rendered}`).toBe(true);
  expect(s.shown, `★글자가 사라졌다. 잰 값 ${s.shown}`).toContain('DDD');
  expect(errs).toEqual([]);
});

test('C4 ★저장 왕복 — 저장 → 앱 재기동 → 다시 열기 뒤에도 부분 서식이 산다', async ({ page }) => {
  await setup(page);
  const id = await addSticker(page);
  await editAndBoldTail3(page, id);
  const before = await state(page, id);
  expect(before.textHtml, `★전제 — 저장 전에 textHtml 이 없다. 잰 값 ${JSON.stringify(before)}`).toBeTruthy();

  const snap = await page.evaluate(() => window.serializeProject());
  /* ★★⚠️실측 — 저장본은 ★HTML 이다. `dataset.textHtml` 은 거기서 ★`data-text-html` 로 나온다.
     ⛔내가 처음엔 ★JS 속성명(`textHtml`)으로 ★HTML 을 grep 해 ★0건을 받고 「안 실렸다」로 읽었다 —
       ★「낱말 grep 은 ★찾는 자이고 ★닫는 자가 아니다」의 ★또 한 얼굴이다. */
  const hasAttr = /data-text-html/.test(snap);
  const hasPlain = /data-text=/.test(snap);
  console.log('  C4 저장본:', JSON.stringify({ hasAttr, hasPlain, len: snap.length }));
  expect(hasPlain, '★전제 — 저장본에 ★평문(data-text)조차 없다. 그러면 아래가 엉뚱한 것을 잰다').toBe(true);
  expect(hasAttr, '★저장본에 ★data-text-html 이 ★안 실렸다 — 다시 열면 서식이 사라진다').toBe(true);

  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(500);

  const after = await state(page, id);
  console.log('  C4:', JSON.stringify(after));
  expect(after.err).toBeUndefined();
  expect(after.textHtml, `★다시 연 뒤 textHtml 이 사라졌다. 잰 값 ${JSON.stringify(after)}`).toBeTruthy();
  expect(after.fmtRendered, `★★다시 연 뒤 서식이 ★안 그려진다(앱 판정자로 쟀다). 잰 값 ${JSON.stringify(after)}`).toBe(true);
  expect(after.shown, `★글자가 바뀌었다. 잰 값 ${after.shown}`).toBe(TXT);
});

test('C5 ★서식이 없으면 textHtml 이 안 생긴다 (평문 동치 → delete · C2 의 짝)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addSticker(page);
  const sel = `#${id} .sticker-text`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel),
    '★전제 — 편집에 못 들어갔다').toBe('true');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TXT);                 // ★서식 ★없이 평문만
  await page.waitForTimeout(200);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);
  await page.waitForTimeout(500);

  const s = await state(page, id);
  console.log('  C5:', JSON.stringify(s));
  expect(s.text, `★평문이 안 저장됐다. 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  expect(s.hasKey, `★★서식이 없는데 textHtml 이 생겼다 — 옛 평문 경로가 죽는다(C2 가 그 자리다). 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.bTags, `★서식 태그가 생겼다. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  expect(errs).toEqual([]);
});
