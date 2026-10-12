/* rich-text-consumer-modal.dom.spec.js — ★수지② 「모달블럭에서 ★텍스트 영역 선택한 만큼 ★안 됨」
 *   ⚠️출처는 ★2차다(server-manager → 지디 전달문) — ⛔「원문」이 아니다.
 *
 * ★★무엇이 문제였나 — ★행위로 쟀다(tests/dom/sz27-partial-format-wall · 그 벌은 ★skip 전용 기록이다)
 *   전제A dataset.textText="AAABBBCCC" ✅ · 전제B 선택 "CCC" ✅ · execCommand 직후 `AAABBB<b>CCC</b>` ✅
 *   ★★재렌더 뒤 → ★`AAABBBCCC` · ★b=0  ⇒ ★★「걸리는 것처럼 보이다가 ★재렌더에서 ★사라진다」
 *   까닭: 커밋이 ★평문만 담고(`_mdlReadText` → `commitModalSlot(…, text)`),
 *         렌더가 ★`_esc(shown)` 로 ★마크업을 escape 한다.
 *
 * ★★고치는 꼴 = ★스티커 선례(«U6b 리치텍스트»)를 ★그대로 — ⛔새 관용구 0
 *   ⑴ 커밋: 평문 키 ★옆에 ★Html 키를 둔다(`data-<slot>-html`). ★서식이 없으면 ★지운다(무회귀)
 *   ⑵ 렌더: Html 키가 있으면 ★재-sanitize 한 HTML, 없으면 ★옛 평문 경로(`_esc`)
 *   ⑶ sanitize 는 ★공용 한 벌(js/util/sanitize-rich-text.js) — ★스티커와 ★같은 본문
 *
 * 재는 것 (★사람이 하는 순서로 · 칸마다 ★전제 단언)
 *   M1 ★사람 순서 — 슬롯 편집 → ★끝 3글자 ⇧← → ★⌘B → 바깥 클릭 ⇒ ★Html 키에 저장 ＋ ★렌더에 산다
 *   M2 ★★무회귀 — Html 키 ★없는 블럭(옛 저장본 꼴)은 ★평문 경로로 그려진다 ＋ ★`<`·`&` 가 ★escape 된다
 *      (★지디 ⑶② 가 요구한 칸 — 「마이그레이션이 빠진다」를 막는 자리)
 *   M3 ★★변조 재-sanitize — Html 키에 script·on*·url(·a[href] 가 있어도 ★렌더가 걷고 ★실행되지 않는다
 *   M4 ★저장 왕복 — serializeProject → ★앱 재기동 → applyProjectData 뒤에도 산다
 *   M5 ★서식이 ★없으면 Html 키가 ★안 생긴다(평문 동치 → delete) — ★M2 의 짝
 *   M6 ★★«글자는 ★같고 ★서식만 바뀐» 커밋이 ★삼켜지지 않는다
 *      ⛔옛 커밋 경로는 `if (next === before) return` 으로 ★조기 반환한다 — ★⌘B 는 ★글자를 안 바꾼다
 *      ⇒ ★그 비교에 ★Html 을 ★같이 넣지 않으면 ★서식이 ★영영 커밋되지 않는다. ★이 칸이 그 자다.
 *   M7 ★프로그램적 ★평문 쓰기(★`commitModalSlot(block, slot, text, '')`)가 ★묵은 Html 을 ★지운다
 *      (스티커가 적어 둔 그 교훈 — sticker-block.js: 「MCP 텍스트 수정은 평문 → 잔존 textHtml 제거」)
 *      ⛔안 지우면 ★새 글자가 ★옛 서식 HTML 에 ★가려진다
 *   M8 ★안내문구(placeholder)엔 ★Html 이 안 끼어든다 — 빈 슬롯은 ★평문 안내문구 그대로
 *
 * ⛔이 하네스로 «못 재는» 축: Electron 재기동 · 파일 저장 · 다른 배율(100% 에서만).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js rich-text-consumer-modal
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

const addModal = async (page) => {
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addModalBlock?.({});
    const fresh = [...document.querySelectorAll('#canvas .modal-block')].filter(e => !before.has(e.id));
    return fresh.length ? fresh[fresh.length - 1].id : null;
  });
  await page.waitForTimeout(300);
  return id;
};

const SLOT = 'text';                       // 기본 변형의 본문 슬롯
const sel = (id) => `#${id} [data-mdl-slot="${SLOT}"]`;

const state = (page, id) => page.evaluate(([i, s]) => {
  const b = document.getElementById(i);
  if (!b) return { err: 'block 이 없다' };
  const e = b.querySelector(`[data-mdl-slot="${s}"]`);
  const plainKey = { title: 'titleText', text: 'textText', cell1: 'cell1', cell2: 'cell2' }[s];
  const htmlKey = { title: 'titleHtml', text: 'textHtml', cell1: 'cell1Html', cell2: 'cell2Html' }[s];
  return {
    plain: b.dataset[plainKey] ?? null,
    html: b.dataset[htmlKey] ?? null,
    hasHtmlKey: Object.prototype.hasOwnProperty.call(b.dataset, htmlKey),
    rendered: e ? e.innerHTML : null,
    shown: e ? e.innerText : null,
    isPh: e ? (e.dataset.isPlaceholder ?? null) : null,
    /* ★앱 자신의 판정자 — 커밋 경로가 쓰는 그 식(공용 모듈의 richTextHasFormatting).
       ⛔`<b>` 를 찾지 않는다: ⌘B 는 꼴이 글꼴 상태에 따라 달라진다(스티커에서 실측). */
    fmtRendered: e ? (window._stickerHtmlHasFormatting?.(e.innerHTML) ?? null) : null,
    fmtStored: (window._stickerHtmlHasFormatting?.(b.dataset[htmlKey] || '') ?? null),
  };
}, [id, SLOT]);

/* 슬롯에 들어가 평문을 넣고 ★커밋한다(바깥 클릭) */
async function typeInto(page, id, text) {
  const s = sel(id);
  await page.locator(s).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, s);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  expect(await page.evaluate((x) => document.querySelector(x)?.getAttribute('contenteditable'), s),
    '★전제 — 더블클릭으로 슬롯 편집에 못 들어갔다').toBe('true');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(text);
  await page.waitForTimeout(200);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);
  await page.waitForTimeout(500);
}

/* 다시 들어가 ★끝 3글자를 고르고 ★⌘B → 바깥 클릭으로 커밋.
   ★`Home` 은 이 글자칸들에서 안 먹었다(실측) ⇒ ★`End` 기준. */
async function boldTail3(page, id) {
  const s = sel(id);
  await page.locator(s).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, s);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  await page.keyboard.press('End');
  for (let i = 0; i < 3; i++) await page.keyboard.press('Shift+ArrowLeft');
  await page.waitForTimeout(150);
  const g = await page.evaluate(() => { const x = getSelection();
    return { rc: x.rangeCount, col: x.isCollapsed, str: x.toString() }; });
  expect(g, `★전제 — 끝 3글자("CCC")가 골라져야 한다. 잰 값 ${JSON.stringify(g)}`)
    .toEqual({ rc: 1, col: false, str: 'CCC' });

  await page.keyboard.press('ControlOrMeta+b');
  await page.waitForTimeout(200);
  const live = await page.evaluate((x) => {
    const e = document.querySelector(x);
    return { html: e.innerHTML, fmt: window._stickerHtmlHasFormatting?.(e.innerHTML) ?? null };
  }, s);
  /* ★전제 — ⌘B 가 ★«살아 있는 DOM»에 ★서식을 만들었다. ⛔안 만들면 아래가 «빈 것»을 잰다.
     ⚠️editor.js 의 document 레벨 ⌘B 와 ★이중토글이 나면 ★여기서 false 가 된다(스티커가 적어 둔 함정). */
  expect(live.fmt, `★전제 — ⌘B 뒤 ★살아 있는 DOM 에 ★서식이 없다(이중토글?). 잰 값 ${JSON.stringify(live)}`).toBe(true);

  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);
  await page.waitForTimeout(500);
  return live;
}

/* ══════════════════════════════════════════════════════════════════ */

test('M1 ★사람 순서 — 부분 서식이 Html 키에 저장되고 렌더에 산다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  expect(id, '★모달이 안 들어갔다').toBeTruthy();
  await typeInto(page, id, TXT);
  const s0 = await state(page, id);
  expect(s0.plain, `★전제A — 평문이 dataset 에 안 들어갔다. 잰 값 ${JSON.stringify(s0)}`).toBe(TXT);
  expect(s0.hasHtmlKey, `★전제 — 아직 Html 키가 있어선 안 된다. 잰 값 ${JSON.stringify(s0)}`).toBe(false);

  const live = await boldTail3(page, id);
  const s1 = await state(page, id);
  console.log('  M1:', JSON.stringify({ live, ...s1 }));
  expect(s1.plain, `★평문이 바뀌었다. 잰 값 ${s1.plain}`).toBe(TXT);
  expect(s1.html, `★★부분 서식이 ★Html 키에 안 저장됐다 — 「되는 척하다 사라진다」 그대로다. 잰 값 ${JSON.stringify(s1)}`).toBeTruthy();
  expect(s1.fmtStored, `★★저장된 Html 에 ★서식이 없다(앱 판정자). 잰 값 ${JSON.stringify(s1)}`).toBe(true);
  expect(s1.fmtRendered, `★★렌더에 서식이 ★안 살았다 — 저장은 됐는데 ★안 보인다. 잰 값 ${JSON.stringify(s1)}`).toBe(true);
  expect(s1.shown, `★글자가 바뀌었다. 잰 값 ${s1.shown}`).toBe(TXT);
  expect(errs).toEqual([]);
});

test('M2 ★★무회귀 — Html 키 없는 블럭(옛 저장본 꼴)은 평문 경로 ＋ escape 가 산다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  /* ★옛 저장본 꼴 = 평문 키만. ⛔«준비»다(addModalBlock 과 같은 층).
     ★글자에 `<`·`&` 를 넣어 ★escape 가 ★죽지 않았는지 같이 본다 — 리치텍스트를 켜면서 가장 쉽게 깨지는 자리다. */
  await page.evaluate(([i, t]) => {
    const b = document.getElementById(i);
    b.dataset.textText = t;
    delete b.dataset.textHtml;
    window.renderModalBlock?.(b);
  }, [id, 'A<b>X</b>&amp;B']);
  await page.waitForTimeout(250);
  const s = await state(page, id);
  console.log('  M2:', JSON.stringify(s));
  expect(s.hasHtmlKey, `★전제 — Html 키가 남아 있다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.shown, `★★평문이 ★평문으로 안 보인다 — escape 가 죽었다(옛 저장본의 모습이 바뀐다). 잰 값 ${JSON.stringify(s)}`).toBe('A<b>X</b>&amp;B');
  expect(s.fmtRendered, `★서식이 ★없는데 서식으로 그려졌다 — escape 가 죽었다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(errs).toEqual([]);
});

test('M3 ★★변조 재-sanitize — Html 키가 더럽혀져 있어도 렌더가 걷고 실행되지 않는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  const DIRTY = 'AAA<script>window.__mpwned=1</script>'
              + '<span style="background-color:url(x)" onerror="window.__mpwned=2">BBB</span>'
              + '<a href="javascript:void 0">CCC</a><b>DDD</b>';
  await page.evaluate(([i, h]) => {
    const b = document.getElementById(i);
    b.dataset.textText = 'AAABBBCCCDDD';
    b.dataset.textHtml = h;
    window.renderModalBlock?.(b);
  }, [id, DIRTY]);
  await page.waitForTimeout(250);
  const s = await state(page, id);
  const pwned = await page.evaluate(() => window.__mpwned ?? null);
  console.log('  M3:', JSON.stringify({ rendered: s.rendered, pwned }));
  expect(s.rendered, '★전제 — 아무것도 안 그려졌다(아래 「없다」가 공짜가 된다)').toBeTruthy();
  for (const [name, re] of [['script', /<script|__mpwned/i], ['on* 속성', /onerror/i],
                            ['url(', /url\(/i], ['a[href]', /<a\b|href|javascript/i]]) {
    expect(re.test(s.rendered), `★★«${name}» 가 ★렌더에 살아남았다. 잰 값 ${s.rendered}`).toBe(false);
  }
  expect(pwned, `★★변조 코드가 ★실행됐다 — template 파싱이 아니다. 잰 값 ${pwned}`).toBeNull();
  /* ★음성대조 — 허용된 `<b>` 는 ★산다(안 그러면 「전부 지우는 자」와 구분 안 된다) */
  expect(/<b\b/i.test(s.rendered), `★허용된 <b> 까지 걷혔다 — 위 「없다」가 공짜다. 잰 값 ${s.rendered}`).toBe(true);
  expect(errs).toEqual([]);
});

test('M4 ★저장 왕복 — 저장 → 앱 재기동 → 다시 열기 뒤에도 부분 서식이 산다', async ({ page }) => {
  await setup(page);
  const id = await addModal(page);
  await typeInto(page, id, TXT);
  await boldTail3(page, id);
  const before = await state(page, id);
  expect(before.html, `★전제 — 저장 전에 Html 키가 없다. 잰 값 ${JSON.stringify(before)}`).toBeTruthy();

  const snap = await page.evaluate(() => window.serializeProject());
  /* ★저장본은 ★HTML 이다 ⇒ 속성명은 ★`data-text-html`(⛔JS 속성명 `textHtml` 로 재면 0건이다 — 실측된 함정) */
  const hasAttr = /data-text-html/.test(snap), hasPlain = /data-text-text/.test(snap);
  console.log('  M4 저장본:', JSON.stringify({ hasAttr, hasPlain, len: snap.length }));
  expect(hasPlain, '★전제 — 저장본에 ★평문(data-text-text)조차 없다. 아래가 엉뚱한 것을 잰다').toBe(true);
  expect(hasAttr, '★저장본에 ★data-text-html 이 ★안 실렸다 — 다시 열면 서식이 사라진다').toBe(true);

  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(500);
  const after = await state(page, id);
  console.log('  M4:', JSON.stringify(after));
  expect(after.err).toBeUndefined();
  expect(after.html, `★다시 연 뒤 Html 키가 사라졌다. 잰 값 ${JSON.stringify(after)}`).toBeTruthy();
  expect(after.fmtRendered, `★★다시 연 뒤 서식이 ★안 그려진다. 잰 값 ${JSON.stringify(after)}`).toBe(true);
  expect(after.shown, `★글자가 바뀌었다. 잰 값 ${after.shown}`).toBe(TXT);
});

test('M5 ★서식이 없으면 Html 키가 안 생긴다 (평문 동치 → delete · M2 의 짝)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  await typeInto(page, id, TXT);          // ★서식 없이 평문만
  const s = await state(page, id);
  console.log('  M5:', JSON.stringify(s));
  expect(s.plain, `★평문이 안 저장됐다. 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  expect(s.hasHtmlKey, `★★서식이 없는데 Html 키가 생겼다 — 옛 평문 경로가 죽는다(M2 가 그 자리다). 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.fmtRendered, `★서식으로 그려졌다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(errs).toEqual([]);
});

test('M6 ★★글자는 같고 «서식만» 바뀐 커밋이 삼켜지지 않는다 (조기 반환 함정)', async ({ page }) => {
  /* ★★⌘B 는 ★글자를 ★안 바꾼다. 옛 커밋 경로는 `if (next === before) return` 으로 ★조기 반환하므로
     ★그 비교에 ★Html 을 ★같이 넣지 않으면 ★서식이 ★영영 커밋되지 않는다. ★이 칸이 그 자다.
     ⇒ ★글자 길이·내용이 ★한 글자도 안 바뀐 것을 ★단언한 뒤 ★Html 이 ★생겼는지 본다. */
  const errs = await setup(page);
  const id = await addModal(page);
  await typeInto(page, id, TXT);
  const a = await state(page, id);
  expect(a.plain, '★전제 — 평문이 안 들어갔다').toBe(TXT);
  expect(a.hasHtmlKey, '★전제 — Html 키가 벌써 있다').toBe(false);

  await boldTail3(page, id);
  const b = await state(page, id);
  console.log('  M6:', JSON.stringify({ plainBefore: a.plain, plainAfter: b.plain, html: b.html }));
  expect(b.plain, `★★평문이 ★한 글자도 안 바뀌어야 한다(그게 이 함정의 조건이다). 잰 값 ${b.plain}`).toBe(a.plain);
  expect(b.hasHtmlKey, `★★평문이 같다는 까닭으로 ★서식 커밋이 ★삼켜졌다 — 조기 반환에 ★Html 비교가 없다. 잰 값 ${JSON.stringify(b)}`).toBe(true);
  expect(b.fmtStored, `★Html 키는 생겼는데 ★서식이 없다. 잰 값 ${JSON.stringify(b)}`).toBe(true);
  expect(errs).toEqual([]);
});

test('M7 ★프로그램적 평문 쓰기가 «묵은 Html» 을 지운다 (스티커가 적어 둔 그 교훈)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  await page.evaluate(([i, h]) => {
    const b = document.getElementById(i);
    b.dataset.textText = 'AAABBBCCC';
    b.dataset.textHtml = h;
    window.renderModalBlock?.(b);
  }, [id, 'AAABBB<b>CCC</b>']);
  await page.waitForTimeout(250);
  const s0 = await state(page, id);
  expect(s0.fmtRendered, `★전제 — 옛 서식이 안 그려졌다. 잰 값 ${JSON.stringify(s0)}`).toBe(true);

  /* ★앱 입구로 ★평문을 새로 넣는다.
     ★★⚠️내 첫 판은 ★`applyModalVariant(b, v, {text:'ZZZ'})` 를 썼다 — ★틀렸다.
       ★실측: 그 함수는 ★`(block, next)` ★2인자이고 ★슬롯 글자를 ★안 쓴다(modal-block.js:249).
       ⇒ ★그 빨강은 ★제품이 아니라 ★내 ★입구 오독이었다(「★내가 적은 이름·서명은 ★미확인」).
     ★★슬롯 평문을 ★«생성 뒤에» 쓰는 ★유일한 입구 = ★`commitModalSlot`(window 에 노출돼 있다).
       ★앞으로 MCP·템플릿이 글자를 넣는다면 ★그 입구를 쓴다 ⇒ ★그 입구가 ★묵은 Html 을 지워야 한다.
     ⚠️`makeModalBlock` 의 같은 처리는 ★방어다 — ★새로 만드는 블럭엔 ★묵은 Html 이 ★있을 수 없다.
       ⛔그걸 「필요하다」로 적지 않는다. */
  const applied = await page.evaluate((i) => {
    const b = document.getElementById(i);
    if (typeof window.commitModalSlot !== 'function') return { err: 'commitModalSlot 이 없다' };
    const changed = window.commitModalSlot(b, 'text', 'ZZZ', '');
    window.renderModalBlock?.(b);
    return { ok: true, changed };
  }, id);
  await page.waitForTimeout(250);
  const s1 = await state(page, id);
  console.log('  M7:', JSON.stringify({ applied, ...s1 }));
  expect(applied.err, `★입구를 못 찾았다 — 이 칸이 아무것도 안 잰다. 잰 값 ${JSON.stringify(applied)}`).toBeUndefined();
  expect(applied.changed, `★전제 — 입구가 ★«바뀌었다»를 안 돌려줬다(조기 반환?). 잰 값 ${JSON.stringify(applied)}`).toBe(true);
  expect(s1.plain, `★새 평문이 안 들어갔다. 잰 값 ${JSON.stringify(s1)}`).toBe('ZZZ');
  expect(s1.hasHtmlKey, `★★묵은 Html 이 ★안 지워졌다 — ★새 글자가 ★옛 서식에 ★가려진다. 잰 값 ${JSON.stringify(s1)}`).toBe(false);
  expect(s1.shown, `★새 글자가 안 보인다 — 옛 Html 이 가리고 있다. 잰 값 ${JSON.stringify(s1)}`).toBe('ZZZ');
  expect(errs).toEqual([]);
});

test('M8 ★안내문구엔 Html 이 안 끼어든다 — 빈 슬롯은 평문 안내문구 그대로', async ({ page }) => {
  const errs = await setup(page);
  const id = await addModal(page);
  const s = await state(page, id);
  console.log('  M8:', JSON.stringify(s));
  expect(s.isPh, `★전제 — 새 모달의 슬롯이 ★안내문구 상태가 아니다. 잰 값 ${JSON.stringify(s)}`).toBe('true');
  expect(s.hasHtmlKey, `★빈 슬롯에 Html 키가 있다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.fmtRendered, `★안내문구가 ★서식으로 그려졌다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect((s.shown || '').trim().length, `★안내문구가 비었다. 잰 값 ${JSON.stringify(s)}`).toBeGreaterThan(0);
  expect(errs).toEqual([]);
});
