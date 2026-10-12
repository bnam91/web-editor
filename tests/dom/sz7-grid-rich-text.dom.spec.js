/* sz7-grid-rich-text.dom.spec.js — ★수지⑦ 「그리드 칸 ★추가 줄도 ★영역선택 텍스트 스타일 변경」
 *   을 ★재는 자. ⇒ 공용 sanitizer(`js/util/sanitize-rich-text.js`)의 ★★세 번째 소비자.
 *   ⚠️요구의 출처는 ★2차다(server-manager → 지디 발주서) — ⛔「원문」이 아니다.
 *
 * ══ ★이 파일과 ★sz27 의 ★분업 (⛔명부를 둘로 만들지 않는다) ══════════════════
 *   `sz27-partial-format-wall.dom.spec.js` ★W-⑦ = ★「재렌더를 견디나」 ★그 한 칸.
 *     그 파일 머리말이 ★고치는 사람에게 ★「skip 을 떼고 단언을 뒤집어라」고 ★적어 두었다 ⇒ ★그대로 했다.
 *   ⇒ ★이 파일은 ★그것을 ★다시 재지 않는다. ★나머지 칸(저장·무회귀·변조·꼴)을 ★여기서 잰다.
 *
 * ══ ★★판정자 — ⛔내 기대로 걸지 않는다 ════════════════════════════════════
 *   `window._stickerHtmlHasFormatting` 를 쓴다. ★이름은 스티커지만 ★그 값은
 *   ★공용 모듈의 `richTextHasFormatting` ★그 자체다(`js/blocks/sticker-block.js:34`
 *   `window._stickerHtmlHasFormatting = richTextHasFormatting`).
 *   ★★그 선택이 ★이 검사를 ★공용 본문에 ★묶는다 ⇒ ★본문을 무력화하면 ★여기가 ★빨개진다(⑥).
 *   ⛔「`<b>` 가 생겼나」로 걸지 않는다 — ★스티커에서 ★그 전제가 ★실제로 틀렸다
 *     (기본 굵기 때문에 ⌘B 가 `<span style="font-weight:normal">` 을 냈다 · 선례 머리말).
 *   ★그 판정자 ★자신도 ★대조한다(J0) — ⛔재는 자를 ★안 재면 ★그 초록이 ★무엇인지 모른다.
 *
 * ══ ★«사람이 하는 순서»를 밟는다 — ⛔장면을 손으로 만들지 않는다 ═══════════════
 *   그리드를 ★넣고 → ★더블클릭으로 줄 편집에 들어가고(`js/block-drag.js:304` `_gridBeginEdit`)
 *   → ★진짜 키로 치고 → ★끝 3글자를 ⇧← 로 ★고르고 → ★⌘B → ★바깥을 눌러 ★커밋한다
 *   (`_gridEndEdit` = ★단일 커밋 choke point · block-drag.js:211).
 *   ★칸마다 ★전제를 ★단언한다(편집에 들어갔나 · 선택이 섰나 · 모델에 들어갔나).
 *
 * ══ ★모델 자리 — ⚠️실측 ════════════════════════════════════════════════
 *   ★행 0 의 줄은 ★`dataset.cells` 가 ★아니라 ★`dataset.cols[i].lines` 에 산다
 *   (`getGridModel`: row0 = cols.map(c => ({ lines: c.lines, ...cellRows[0][i] })) · grid-block.js:2047).
 *   ⛔그걸 모르고 `dataset.cells` 를 고치면 ★아무 일도 안 나고 ★「변조가 안 걷혔다」로 읽는다.
 *
 * ══ ★이 길이 ★지나야 하는 ★문 ═══════════════════════════════════════════
 *   `GRID_LINE_FIELDS`(grid-block.js:990)에 ★`textHtml` 이 ★없으면 `updateGridBlock` 이
 *   patchCell 을 ★통째로 거절한다 ⇒ ★G1 이 ★그 문을 ★같이 잰다(따로 또 재지 않는다).
 *   ★그 명부는 `tests/unit/grid-patchcell-reject.test.js` P6 가 ★`_gridLineHtml` 을
 *   ★파싱해(정규식 `\bline\.(\w+)`) 대조한다 — ⚠️★그 함수 ★안의 ★주석도 ★그 입력이다.
 *
 * 재는 것
 *   J0 ★★판정자 대조 — 공용 판정자가 ★살아 있고(양성) ★아무 때나 참이 아니다(음성)
 *   G1 ★사람 순서 — ⌘B 부분 서식이 ★모델 `line.textHtml` 에 ★저장되고 ★렌더에 산다
 *   G2 ★★무회귀 — `textHtml` ★없는 줄(옛 저장본 꼴)은 ★평문 경로로 그려진다
 *   G3 ★★변조 재-sanitize — 저장본의 `textHtml` 이 더럽혀져 있어도 ★렌더가 걷는다
 *                            ＋ ★음성대조: 허용된 `<b>` 는 ★산다
 *   G4 ★저장 왕복 — serializeProject → ★재기동 → applyProjectData 뒤에도 산다
 *   G5 ★서식이 ★없으면 `textHtml` 이 ★안 생긴다 (★G2 의 짝 · 평문 동치 → 미생성)
 *   G6 ★꼴 — ★B·I·U·S ★넷이 ★각각 산다 (⌘B/⌘I/⌘U/⌘⇧X)
 *      ⚠️`STRIKE` 가 ★그 함정의 자리다(sticker-block.js 38~40 · 허용목록에 없으면 ★«되는 척»만 한다).
 *   G7 ★★허용목록을 ★«정의 자리에서 ★읽어» 대조 — ⛔목록을 ★손으로 ★베끼지 않는다(명부 둘 금지)
 *   P1 ★★«벽» 측정 — ★형광펜·점의 ★꼴이 ★공용 sanitizer 를 ★지나면 ★무엇이 남나
 *
 * ══ ★★★범위 — ★2026-10-08 ★현빈 답으로 ★닫혔다(지디 전달) ═══════════════════
 *   ★「★아니 ★나중에 ★더 추가할거긴해. ★일단은 ★★점까지만」
 *   ⇒ ★이번 범위 = ★★B · I · U · S · ★형광펜 · ★점 ★여섯. ★그 밖은 ★다음 릴리스.
 *   ⇒ ★★구조를 ★«더 올 것»에 ★열어 둔다: ★허용목록을 ★여섯에 ★하드코딩하지 않고
 *     ★공용 모듈의 ★정의 자리(`RICH_TEXT_ALLOWED_TAGS`·`RICH_TEXT_ALLOWED_STYLE_PROPS`)를 ★읽는다(G7).
 *
 * ══ ★★★⚠️실측 — ★형광펜·점은 ★B/I/U/S 와 ★«층이 다르다» (★P1 이 재는 것) ═══════
 *   ★둘은 ★«태그»가 아니라 ★★«class ＋ CSS 사용자정의 속성»으로 만들어진다:
 *     · 형광펜 = ★`span.tb-hl`   (`HL_CLASS` · prop-text-wireup-text-edit.js:158)
 *               ＋ 색·높이의 ★정본은 ★`.text-block` 의 ★인라인 `--tb-hl-color`·`--tb-hl-h`
 *     · 점      = ★`span.tb-dot` (`DOT_CLASS` · 같은 파일 :172) · ★`.tb-dot::before` 가 ★그린다
 *               ＋ `--tb-dot-i` 는 ★span 마다 · 나머지 `--tb-dot-*` 는 ★`.text-block` 인라인
 *   ★★그런데 ★공용 sanitizer 는 ★SPAN 에서 ★`style` ★하나만 베끼고(:117~123)
 *     그 style 도 ★`RICH_TEXT_ALLOWED_STYLE_PROPS` ★5개 ★이름만 남긴다(`sanitizeStyle`).
 *   ⇒ ★★`class` 는 ★걷힌다 · ★`--tb-hl-*`·`--tb-dot-*` 도 ★걷힌다(5개 명부에 없다)
 *   ⇒ ★★그리고 ★그릇 쪽 정본이 사는 ★`.text-block` 이 ★그리드 줄엔 ★★없다(`.grd-line` 이다)
 *   ★★⇒ ★★★여섯 중 ★넷(B/I/U/S)은 ★이 길로 가고, ★둘(형광펜·점)은 ★★이 길로 ★못 간다.
 *   ⛔★그 둘을 ★어떻게 할지는 ★★내가 고르지 않는다 — ★P1 이 ★재서 ★적고 ★지디가 올린다.
 *
 * ⛔이 하네스로 «못 재는» 축: ★붙여넣기 경로 · ★Electron 재기동(브라우저 재부팅으로 흉낸다)
 *   · ★네이티브 메뉴 · ★다른 배율(100% 에서만 쟀다) · ★중첩 «안» 줄(`np` 주소 · 발주서 §8⑵ 미측정).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sz7-grid-rich-text
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect, src } = require('./_root-harness.js');

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

/* 그리드 넣기(준비 · 앱 입구 함수). ⛔재는 대상이 아니다. */
async function addGrid(page) {
  const id = await page.evaluate(() => {
    const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
    document.getElementById('sA').classList.add('selected');
    window.addGridBlock?.({});
    const fresh = [...document.querySelectorAll('#canvas .grid-block')].filter(e => !before.has(e.id));
    return fresh.length ? fresh[fresh.length - 1].id : null;
  });
  await page.waitForTimeout(350);
  return id;
}

/* ★공용 판정자 — 이름은 스티커지만 값은 공용 `richTextHasFormatting` 그 자체(머리말). */
const judge = (page, html) => page.evaluate((h) => window._stickerHtmlHasFormatting?.(h) ?? null, html);

/* 그리드 (0,0) 첫 줄의 ★모델 + ★렌더 상태.
   ★행 0 의 줄은 `dataset.cols[0].lines` 에 산다(머리말의 그 실측). */
const state = (page, id) => page.evaluate((i) => {
  const b = document.getElementById(i);
  if (!b) return { err: 'block 이 없다' };
  const el = b.querySelector('.grd-line');
  let line = null;
  try { line = window.getGridModel?.(b)?.cells?.[0]?.[0]?.lines?.[0] ?? null; } catch (e) { line = null; }
  let rawCols = null;
  try { rawCols = JSON.parse(b.dataset.cols || '[]'); } catch (_) { rawCols = null; }
  const rawLine = rawCols && rawCols[0] && Array.isArray(rawCols[0].lines) ? rawCols[0].lines[0] : null;
  return {
    text: line ? (line.text ?? null) : null,
    textHtml: line ? (line.textHtml ?? null) : null,
    /* ★«키가 있나»는 ★모델 합성본이 아니라 ★저장 꼴(dataset.cols)에서 본다 —
       합성이 기본값을 끼워 넣으면 「있다」가 공짜로 참이 된다. */
    hasKey: !!(rawLine && Object.prototype.hasOwnProperty.call(rawLine, 'textHtml')),
    rendered: el ? el.innerHTML : null,
    shown: el ? el.innerText : null,
    bTags: el ? el.querySelectorAll('b,strong').length : -1,
    styledSpans: el ? el.querySelectorAll('span[style]').length : -1,
    fmtRendered: el ? (window._stickerHtmlHasFormatting?.(el.innerHTML) ?? null) : null,
    fmtStored: (window._stickerHtmlHasFormatting?.(line ? (line.textHtml || '') : '') ?? null),
  };
}, id);

/* 더블클릭 → 전체선택 → 타이핑 → 끝 3글자 → (키) → 바깥 클릭(커밋).
   ★`Home` 은 이 글자칸들에서 안 먹었다(sz27 · 스티커 실측) ⇒ ★`End` 기준으로 센다. */
async function editAndFormatTail3(page, id, keys) {
  const sel = `#${id} .grd-line`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  const ce = await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel);
  expect(ce, '★전제 — 더블클릭으로 ★줄 편집에 못 들어갔다(앱의 그 제스처가 아니다)').toBe('true');

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

  for (const k of keys) { await page.keyboard.press(k); await page.waitForTimeout(150); }
  const live = await page.evaluate((x) => {
    const e = document.querySelector(x);
    return { html: e.innerHTML, fmt: window._stickerHtmlHasFormatting?.(e.innerHTML) ?? null,
             b: e.querySelectorAll('b,strong').length, spans: e.querySelectorAll('span[style]').length };
  }, sel);
  expect(live.fmt, `★전제 — ${keys.join('+')} 뒤에도 ★«부분 서식»이 ★없다(공용 판정자로 쟀다). 잰 값 ${JSON.stringify(live)}`).toBe(true);

  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);   // ★커밋 = _gridEndEdit
  await page.waitForTimeout(500);
  return live;
}

/* ══════════════════════════════════════════════════════════════════ */

test('J0 ★★판정자 대조 — 공용 판정자가 살아 있고(양성) 아무 때나 참이 아니다(음성)', async ({ page }) => {
  await setup(page);
  /* ⛔이 칸이 없으면 ★아래의 ★모든 「fmt=false」가 ★«판정자가 없어서»인지
     ★«서식이 없어서»인지 ★구분되지 않는다. */
  const alive = await judge(page, '<b>x</b>');
  expect(alive, '★★공용 판정자(richTextHasFormatting)가 ★없다 — 아래 칸들은 아무것도 안 잰다').toBe(true);
  const neg = await judge(page, 'x');
  expect(neg, '★★판정자가 ★평문에도 ★참이다 — 그러면 아래 「서식이 산다」가 ★공짜로 초록이다').toBe(false);
});

test('G1 ★사람 순서 — ⌘B 부분 서식이 모델 line.textHtml 에 저장되고 렌더에 산다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  expect(id, '★그리드가 안 들어갔다 — 아래는 아무것도 안 잰다').toBeTruthy();
  const s0 = await state(page, id);
  expect(s0.err).toBeUndefined();
  expect(s0.hasKey, `★전제 — 새 그리드 줄에 이미 textHtml 이 있다. 잰 값 ${JSON.stringify(s0)}`).toBe(false);

  const live = await editAndFormatTail3(page, id, ['ControlOrMeta+b']);
  const s1 = await state(page, id);
  console.log('  G1:', JSON.stringify({ live, ...s1 }));
  expect(s1.text, `★평문도 ★같이 저장돼야 한다(두 칸이 ★짝이다 — 평문을 지우면 안 된다). 잰 값 ${s1.text}`).toBe(TXT);
  expect(s1.textHtml, `★★부분 서식이 ★모델 line.textHtml 에 안 저장됐다(GRID_LINE_FIELDS 가 patchCell 을 거절했을 수도 있다). 잰 값 ${JSON.stringify(s1)}`).toBeTruthy();
  expect(s1.fmtStored, `★★저장된 textHtml 에 ★«서식»이 없다(공용 판정자로 쟀다). 잰 값 ${JSON.stringify(s1)}`).toBe(true);
  expect(s1.fmtRendered, `★★렌더에 서식이 ★안 살았다 — 저장은 됐는데 ★안 보인다(_esc 가 걷었다). 잰 값 ${JSON.stringify(s1)}`).toBe(true);
  expect(s1.shown, `★글자가 바뀌었다. 잰 값 ${s1.shown}`).toBe(TXT);
  expect(errs).toEqual([]);
});

test('G2 ★★무회귀 — textHtml 없는 줄(옛 저장본 꼴)은 평문 경로로 그려진다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  /* ★옛 저장본 꼴 = `text` 만 있고 `textHtml` 이 ★없다. ★그 꼴을 ★저장 자리에 직접 둔다.
     ⛔이것은 «준비»다 — 재는 대상이 아니다. */
  await page.evaluate(([i, t]) => {
    const b = document.getElementById(i);
    const cols = JSON.parse(b.dataset.cols || '[]');
    cols[0] = cols[0] || {}; cols[0].lines = [{ type: 'body', text: t }];
    b.dataset.cols = JSON.stringify(cols);
    window.renderGridBlock?.(b);
  }, [id, TXT]);
  await page.waitForTimeout(300);
  const s = await state(page, id);
  console.log('  G2:', JSON.stringify(s));
  expect(s.text, `★전제 — 내가 쓴 평문이 ★모델에 안 남았다. 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  expect(s.hasKey, `★전제 — textHtml 이 남아 있다. 이 판에선 G2 가 «옛 저장본»을 ★안 잰다. 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.shown, `★평문이 안 보인다. 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  expect(s.bTags, `★서식이 ★없는데 서식 태그가 생겼다. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  /* ★그려진 알맹이가 ★평문 그대로다 — 마크업이 끼면 옛 저장본의 ★모습이 바뀐 것이다 */
  expect(s.rendered, `★평문 경로가 아니다(마크업이 끼었다). 잰 값 ${s.rendered}`).toBe(TXT);
  expect(errs).toEqual([]);
});

test('G3 ★★변조 재-sanitize — 저장본의 textHtml 이 더럽혀져 있어도 렌더가 걷는다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  /* ★저장본·.gdt 가 ★변조된 꼴. ★이 모듈이 ★«렌더·로드마다 다시 돌는» ★존재 이유가 ★이것이다.
     ⛔커밋 경로를 ★타지 않는다 — 커밋이 걷는 것과 ★렌더가 걷는 것은 ★다른 자리다. */
  const DIRTY = 'AAA<script>window.__pwned=1</script>'
              + '<span style="background-color:url(x)" onerror="window.__pwned=2">BBB</span>'
              + '<a href="javascript:void 0">CCC</a><b>DDD</b>';
  await page.evaluate(([i, h]) => {
    const b = document.getElementById(i);
    const cols = JSON.parse(b.dataset.cols || '[]');
    cols[0] = cols[0] || {}; cols[0].lines = [{ type: 'body', text: 'AAABBBCCCDDD', textHtml: h }];
    b.dataset.cols = JSON.stringify(cols);
    window.renderGridBlock?.(b);
  }, [id, DIRTY]);
  await page.waitForTimeout(300);
  const s = await state(page, id);
  const pwned = await page.evaluate(() => window.__pwned ?? null);
  console.log('  G3:', JSON.stringify({ rendered: s.rendered, pwned }));
  expect(s.rendered, '★전제 — 아무것도 안 그려졌다(그러면 아래 「없다」가 ★공짜로 참이 된다)').toBeTruthy();
  for (const [name, re] of [['script', /<script|__pwned/i], ['on* 속성', /onerror/i],
                            ['url(', /url\(/i], ['a[href]', /<a\b|href|javascript/i]]) {
    expect(re.test(s.rendered), `★★«${name}» 가 ★렌더에 살아남았다. 잰 값 ${s.rendered}`).toBe(false);
  }
  expect(pwned, `★★변조 코드가 ★실행됐다 — template 파싱이 아니다. 잰 값 ${pwned}`).toBeNull();
  /* ★음성대조 — 걷는 자가 ★«전부 지우는 자»는 아니다: 허용된 `<b>` 는 ★산다.
     ⛔이 줄이 없으면 위 네 「없다」는 ★«아무것도 안 그린다»와 ★구분되지 않는다. */
  expect(/<b\b/i.test(s.rendered), `★허용된 <b> 까지 걷혔다 — 그러면 위 「없다」가 ★공짜다. 잰 값 ${s.rendered}`).toBe(true);
  expect(s.shown, `★글자가 사라졌다. 잰 값 ${s.shown}`).toContain('DDD');
  expect(errs).toEqual([]);
});

test('G4 ★저장 왕복 — 저장 → 재기동 → 다시 열기 뒤에도 부분 서식이 산다', async ({ page }) => {
  await setup(page);
  const id = await addGrid(page);
  await editAndFormatTail3(page, id, ['ControlOrMeta+b']);
  const before = await state(page, id);
  expect(before.textHtml, `★전제 — 저장 ★전에 textHtml 이 없다(G1 이 먼저 서야 한다). 잰 값 ${JSON.stringify(before)}`).toBeTruthy();

  const snap = await page.evaluate(() => window.serializeProject());
  /* ⚠️저장본은 ★HTML 이다 — 모델은 `data-cols` 속성 ★안의 ★JSON 으로 나간다.
     ⛔JS 속성명으로 grep 하면 ★0건을 받고 「안 실렸다」로 읽는다(스티커 C4 가 밟은 그 함정). */
  const hasCols = /data-cols=/.test(snap);
  const hasHtmlField = /textHtml/.test(snap);
  console.log('  G4 저장본:', JSON.stringify({ hasCols, hasHtmlField, len: snap.length }));
  expect(hasCols, '★전제 — 저장본에 ★data-cols 조차 없다. 그러면 아래가 ★엉뚱한 것을 잰다').toBe(true);
  expect(hasHtmlField, '★저장본에 ★textHtml 이 ★안 실렸다 — 다시 열면 서식이 사라진다').toBe(true);

  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(JSON.parse(d)), snap);
  await page.waitForTimeout(600);

  const after = await state(page, id);
  console.log('  G4:', JSON.stringify(after));
  expect(after.err).toBeUndefined();
  expect(after.textHtml, `★다시 연 뒤 textHtml 이 사라졌다. 잰 값 ${JSON.stringify(after)}`).toBeTruthy();
  expect(after.fmtRendered, `★★다시 연 뒤 서식이 ★안 그려진다(공용 판정자로 쟀다). 잰 값 ${JSON.stringify(after)}`).toBe(true);
  expect(after.shown, `★글자가 바뀌었다. 잰 값 ${after.shown}`).toBe(TXT);
});

test('G5 ★서식이 없으면 textHtml 이 안 생긴다 (평문 동치 → 미생성 · G2 의 짝)', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  const sel = `#${id} .grd-line`;
  await page.locator(sel).first().scrollIntoViewIfNeeded();
  const r = await waitStableRect(page, sel);
  await page.mouse.dblclick(r.cx, r.cy);
  await page.waitForTimeout(400);
  expect(await page.evaluate((s) => document.querySelector(s)?.getAttribute('contenteditable'), sel),
    '★전제 — 줄 편집에 못 들어갔다').toBe('true');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.type(TXT);                 // ★서식 ★없이 평문만
  await page.waitForTimeout(200);
  await page.mouse.click(OUTSIDE.x, OUTSIDE.y);
  await page.waitForTimeout(500);

  const s = await state(page, id);
  console.log('  G5:', JSON.stringify(s));
  expect(s.text, `★평문이 안 저장됐다. 잰 값 ${JSON.stringify(s)}`).toBe(TXT);
  expect(s.hasKey, `★★서식이 없는데 textHtml 이 생겼다 — ★옛 평문 경로가 죽는다(G2 가 그 자리다). 잰 값 ${JSON.stringify(s)}`).toBe(false);
  expect(s.bTags, `★서식 태그가 생겼다. 잰 값 ${JSON.stringify(s)}`).toBe(0);
  expect(errs).toEqual([]);
});

/* ★꼴 전수 — ⛔B 만 재고 「일반 텍스트블럭처럼」을 닫지 않는다.
   ⚠️`STRIKE`(⌘⇧X)가 ★그 함정의 자리다 — 허용목록에 없으면 ★커밋 순간 언랩돼
     ★«되는 척»만 하고 사라진다(sticker-block.js 38~40 이 적어 둔 것 · 이미 한 번 앓은 병).
   ⛔형광펜·점은 ★여기 없다 — ★범위 미확정(발주서 §8⑷). 고르지 않고 ★지디에게 물었다. */
for (const [label, keys] of [['B ⌘B', ['ControlOrMeta+b']], ['I ⌘I', ['ControlOrMeta+i']],
                             ['U ⌘U', ['ControlOrMeta+u']], ['S ⌘⇧X', ['ControlOrMeta+Shift+x']]]) {
  test(`G6 ★꼴 — ${label} 부분 서식이 저장되고 렌더에 산다`, async ({ page }) => {
    const errs = await setup(page);
    const id = await addGrid(page);
    const live = await editAndFormatTail3(page, id, keys);
    const s = await state(page, id);
    console.log(`  G6 ${label}:`, JSON.stringify({ live, ...s }));
    expect(s.text, `★평문이 안 남았다. 잰 값 ${s.text}`).toBe(TXT);
    expect(s.fmtStored, `★★${label} 가 ★모델에 ★안 저장됐다(공용 판정자로 쟀다). 잰 값 ${JSON.stringify(s)}`).toBe(true);
    expect(s.fmtRendered, `★★${label} 가 ★렌더에서 ★사라졌다 — «되는 척»이다. 잰 값 ${JSON.stringify(s)}`).toBe(true);
    expect(s.shown, `★글자가 바뀌었다. 잰 값 ${s.shown}`).toBe(TXT);
    expect(errs).toEqual([]);
  });
}

/* ══ G7 ★★허용목록을 ★«정의 자리에서 ★읽어» 대조 ═══════════════════════════
   ⛔목록을 ★손으로 ★베껴 적으면 ★«명부가 둘»이 되고 ★다음 사람이 ★어긋남을 못 본다.
   ⇒ ★`js/util/sanitize-rich-text.js` 를 ★파싱해 ★그 Set 을 ★뽑아 쓴다.
   ★다음에 ★꼴이 하나 늘면 ★정의 자리 ★한 곳만 고치면 ★이 검사가 ★따라 온다. */
const MOD = 'js/util/sanitize-rich-text.js';
const setFromSource = (source, name) => {
  const m = source.match(new RegExp(`${name} = new Set\\(\\[([\\s\\S]*?)\\]\\)`));
  if (!m) return null;
  return [...m[1].matchAll(/'([^']+)'/g)].map((x) => x[1]);
};

test('G7 ★★허용목록 — 정의 자리에서 읽은 그 목록이 B/I/U/S 를 담고 있다', async () => {
  const source = src(MOD);
  const tags = setFromSource(source, 'RICH_TEXT_ALLOWED_TAGS');
  const props = setFromSource(source, 'RICH_TEXT_ALLOWED_STYLE_PROPS');
  /* ★전제 — ★파싱이 ★섰나. ⛔null 이면 아래 「담고 있다」가 ★«안 쟀다»와 구분되지 않는다. */
  expect(tags, `★전제 — ★정의 자리에서 ★RICH_TEXT_ALLOWED_TAGS 를 ★못 읽었다(정규식이 썩었다). 잰 값 ${tags}`).toBeTruthy();
  expect(props, `★전제 — ★RICH_TEXT_ALLOWED_STYLE_PROPS 를 ★못 읽었다. 잰 값 ${props}`).toBeTruthy();
  console.log('  G7 정의 자리 실측:', JSON.stringify({ tags, props }));
  /* ★★⌘B/⌘I/⌘U/⌘⇧X 가 ★만드는 태그가 ★그 목록에 ★있나 — ★G6 네 칸이 ★서는 ★까닭이다.
     ★execCommand 는 판에 따라 B/STRONG · I/EM · U · S/STRIKE 중 하나를 낸다 ⇒ ★짝으로 센다. */
  for (const [label, any] of [['굵게 ⌘B', ['B', 'STRONG']], ['기울임 ⌘I', ['I', 'EM']],
                              ['밑줄 ⌘U', ['U']], ['취소선 ⌘⇧X', ['S', 'STRIKE']]]) {
    expect(any.some((t) => tags.includes(t)),
      `★★«${label}» 가 만드는 태그가 ★허용목록에 ★없다 — ★커밋 순간 언랩돼 ★«되는 척»만 한다(§3 의 그 함정). 잰 값 ${JSON.stringify(tags)}`).toBe(true);
  }
  /* ★음성대조 — 목록이 ★«전부 통과»가 아니다. ⛔이 줄이 없으면 위 네 칸이 ★공짜로 초록이다. */
  expect(tags.includes('SCRIPT') || tags.includes('A') || tags.includes('DIV'),
    `★허용목록이 ★위험한 태그까지 담고 있다 — 그러면 위 네 「있다」가 ★공짜다. 잰 값 ${JSON.stringify(tags)}`).toBe(false);
  /* ★형광펜·점이 ★쓰는 것은 ★그 명부에 ★없다 — ★P1 이 ★행위로 다시 잰다(여기선 ★이름만). */
  expect(props.some((p) => p.startsWith('--')),
    `★사용자정의 속성(--tb-*)이 ★허용 style 명부에 ★있다 — 그러면 ★P1 의 전제가 바뀐다. 잰 값 ${JSON.stringify(props)}`).toBe(false);
});

/* ══ P1~P4 ★★«벽»이 ★열렸다 — ★2026-10-08 ★결정 뒤 ═══════════════════════════
   ★★이 자리는 ★원래 ★«벽 측정 기록»이었다: ★형광펜(`span.tb-hl`)·점(`span.tb-dot`)의 꼴이
   ★공용 sanitizer 를 ★지나면 ★`class` 와 ★`--tb-*` 가 ★걷혀 ★`<span>` 만 남는다고 ★잠가 뒀다.
   ★★그리고 ★그 머리말에 ★적었다: 「★결정이 오면 ★이 단언을 ★뒤집어라」.
   ★★★결정이 왔다 — ★현빈 「★일단은 ★점까지만」(＝B·I·U·S·형광펜·점 ★여섯) · ★지디 판정 ㉠＋⑴.
   ⇒ ★★그래서 ★뒤집었다. ★이제 ★★«열렸다»를 잠근다 — ★그리고 ★★«남은 벽»도 ★같이 잠근다.

   ★★설계(지디 판정 ⑶): ★★«허용목록을 ★소비자가 ★준다».
     ★공용 본문은 ★하나 · ★`opts` 를 ★안 주면 ★★스티커·모달은 ★한 글자도 ★안 바뀐다(★P3 가 그 자다).
   ⛔★허용목록을 ★손으로 ★베끼지 ★않는다 — ★`GRID_RICH_TEXT_OPTS` 의 ★«정의 자리»를 ★읽어 쓴다(G7 과 같은 꼴).
     ★그러면 ★다음에 ★이름이 하나 늘 때 ★정의 자리 ★한 곳만 고치면 ★이 검사가 ★따라온다. */
const GRID_MOD = 'js/blocks/grid-block.js';
/** ★`GRID_RICH_TEXT_OPTS` 를 ★정의 자리에서 ★읽는다(⛔사본 금지). */
function gridOptsFromSource() {
  const src0 = src(GRID_MOD);
  const m = src0.match(/GRID_RICH_TEXT_OPTS = Object\.freeze\(\{([\s\S]*?)\}\);/);
  if (!m) return null;
  const grab = (key) => {
    const mm = m[1].match(new RegExp(key + ":\\s*Object\\.freeze\\(\\[([^\\]]*)\\]\\)"));
    return mm ? [...mm[1].matchAll(/'([^']+)'/g)].map((x) => x[1]) : null;
  };
  const classes = grab('classes');
  const styleProps = grab('styleProps');
  if (!classes || !styleProps) return null;
  return { classes, styleProps };
}

const HL  = '<span class="tb-hl" style="--tb-hl-color:#ffe400">BBB</span>';
const DOT = '<span class="tb-dot" style="--tb-dot-i:-0.5">C</span>';

test('P1 ★★열렸다 — 그리드 허용목록을 주면 tb-hl·tb-dot 과 --tb-dot-i 가 산다', async ({ page }) => {
  await setup(page);
  const OPTS = gridOptsFromSource();
  expect(OPTS, `★전제 — ★정의 자리에서 ★GRID_RICH_TEXT_OPTS 를 ★못 읽었다(정규식이 썩었다). 잰 값 ${JSON.stringify(OPTS)}`).toBeTruthy();
  console.log('  P1 정의 자리 실측:', JSON.stringify(OPTS));
  /* ★전제 — ★그 목록이 ★내가 재려는 ★그 이름들을 ★담고 있나(⛔안 담겼으면 아래는 엉뚱한 것을 잰다) */
  expect(OPTS.classes, '★전제 — 허용 class 에 tb-hl 이 없다').toContain('tb-hl');
  expect(OPTS.classes, '★전제 — 허용 class 에 tb-dot 이 없다').toContain('tb-dot');
  expect(OPTS.styleProps, '★전제 — 허용 style prop 에 --tb-dot-i 가 없다').toContain('--tb-dot-i');

  const got = await page.evaluate(([hl, dot, opts]) => ({
    hl:  window._sanitizeStickerHtml?.(hl, opts) ?? null,
    dot: window._sanitizeStickerHtml?.(dot, opts) ?? null,
    b:   window._sanitizeStickerHtml?.('<b>DDD</b>', opts) ?? null,
    /* ★판정자도 ★같은 목록으로 — ★class 만 붙은 span 을 ★«서식»으로 봐야 ★커밋이 된다 */
    fmtHl:  window._stickerHtmlHasFormatting?.(hl, opts) ?? null,
    fmtDot: window._stickerHtmlHasFormatting?.(dot, opts) ?? null,
  }), [HL, DOT, OPTS]);
  console.log('  P1 잰 값:', JSON.stringify(got));
  expect(got.b, '★전제 — 허용된 <b> 조차 걷혔다(자가 죽었다)').toBe('<b>DDD</b>');
  /* ★★형광펜 — `class` 가 ★산다. ★`--tb-hl-color` 는 ★안 산다(★판정 ⑴ 로 ★색은 ★줄마다 모델 필드에 산다). */
  expect(got.hl, `★★형광펜 class 가 ★안 살았다 — 형광펜이 ★«되는 척»만 한다. 잰 값 ${JSON.stringify(got)}`).toBe('<span class="tb-hl">BBB</span>');
  /* ★★점 — `class` ＋ ★span 마다인 `--tb-dot-i`(★음수·소수)가 ★산다. */
  expect(got.dot, `★★점의 class/--tb-dot-i 가 ★안 살았다. 잰 값 ${JSON.stringify(got)}`).toBe('<span class="tb-dot" style="--tb-dot-i:-0.5">C</span>');
  /* ★★판정자 — ★style 없는 ★class 만의 span 도 ★«서식»이어야 ★커밋 경로가 ★싣는다 */
  expect(got.fmtHl, `★★형광펜을 ★«서식»으로 ★안 본다 ⇒ ★커밋이 ★빈다. 잰 값 ${JSON.stringify(got)}`).toBe(true);
  expect(got.fmtDot, `★★점을 ★«서식»으로 ★안 본다 ⇒ ★커밋이 ★빈다. 잰 값 ${JSON.stringify(got)}`).toBe(true);
});

test('P3 ★★조건⒜ 무변 — opts 를 안 주면 남의 소비자(스티커·모달)는 한 글자도 안 바뀐다', async ({ page }) => {
  await setup(page);
  /* ★★이 칸이 ★이 설계의 ★핵이다 — ★공용 필터를 ★넓히지 ★않았음을 ★행위로 보인다.
     ⛔`opts` ★없이 부르면 ★class 도 ★`--tb-*` 도 ★걷혀야 한다(★옛 동작 ★그대로). */
  const got = await page.evaluate(([hl, dot]) => ({
    hl:  window._sanitizeStickerHtml?.(hl) ?? null,
    dot: window._sanitizeStickerHtml?.(dot) ?? null,
    b:   window._sanitizeStickerHtml?.('<b>DDD</b>') ?? null,
    /* ⚠️★분별자는 ★«class 만» 있는 span 이어야 한다 — ★2026-10-08 실측:
         ★`richTextHasFormatting` 은 ★예전부터 ★«style 속성이 붙은 span»이면 ★참이었다.
         ★HL 에는 ★`--tb-hl-color` 가 ★붙어 있어 ★opts 없이도 ★참이다 — ★★그건 ★내 변경이 ★아니라
         ★★원래 동작이다. ⇒ ★그걸로 재면 ★무변을 ★못 가른다(★내가 그 함정을 ★먼저 밟았다). */
    fmtClassOnly: window._stickerHtmlHasFormatting?.('<span class="tb-hl">X</span>') ?? null,
    fmtStyledPre: window._stickerHtmlHasFormatting?.(hl) ?? null,
    styled: window._sanitizeStickerHtml?.('<span style="color:#ff0000">X</span>') ?? null,
  }), [HL, DOT]);
  console.log('  P3 잰 값:', JSON.stringify(got));
  expect(got.b, '★전제 — 허용된 <b> 가 걷혔다(자가 죽었다)').toBe('<b>DDD</b>');
  /* ★★옛 동작 — `class`·`--tb-*` 는 ★걷힌다 */
  expect(got.hl, `★★opts 없이 ★class 가 ★살았다 — ★남의 소비자(스티커·모달)의 공격면이 ★같이 넓어졌다. 잰 값 ${JSON.stringify(got)}`).toBe('<span>BBB</span>');
  expect(got.dot, `★★opts 없이 ★--tb-dot-i 가 ★살았다 — 같은 까닭. 잰 값 ${JSON.stringify(got)}`).toBe('<span>C</span>');
  expect(got.fmtClassOnly, `★★opts 없이 ★«class 만»의 span 을 ★«서식»으로 봤다 — ★스티커의 판정이 ★갈렸다. 잰 값 ${JSON.stringify(got)}`).toBe(false);
  /* ★원래 동작 ★기록 — ★style 속성이 붙은 span 은 ★opts 와 ★무관하게 ★예전부터 ★«서식»이다.
     ⛔이것을 ★「내가 넓혔다」로 ★읽지 마라. ★그래서 ★위 분별자를 ★class 만으로 ★골랐다. */
  expect(got.fmtStyledPre, `★style 붙은 span 의 ★옛 판정이 ★바뀌었다(원래 true 였다). 잰 값 ${JSON.stringify(got)}`).toBe(true);
  /* ★음성대조 — ★기본 명부는 ★여전히 ★제 일을 한다(★전부 막는 자가 된 것이 ★아니다) */
  expect(got.styled, `★기본 허용 style(color)까지 걷혔다 — 그러면 위 「걷힌다」가 ★공짜다. 잰 값 ${JSON.stringify(got)}`).toBe('<span style="color:#ff0000">X</span>');
});

test('P4 ★★조건⒞ 음성대조 — 넓힌 자리가 «구멍»이 되지 않았다', async ({ page }) => {
  await setup(page);
  const OPTS = gridOptsFromSource();
  expect(OPTS, '★전제 — 허용목록을 못 읽었다').toBeTruthy();
  const got = await page.evaluate((opts) => {
    const f = (h) => window._sanitizeStickerHtml?.(h, opts) ?? null;
    return {
      evilClass: f('<span class="evil">X</span>'),
      mixClass:  f('<span class="tb-hl evil">X</span>'),
      unkProp:   f('<span class="tb-hl" style="--x:url(javascript:0)">X</span>'),
      urlVal:    f('<span class="tb-dot" style="--tb-dot-i:url(x)">X</span>'),
      script:    f('<span class="tb-dot"><script>window.__p2=1</script>X</span>'),
      onerr:     f('<span class="tb-hl" onerror="window.__p2=2">X</span>'),
      href:      f('<a class="tb-hl" href="javascript:0">X</a>'),
      pwned:     window.__p2 ?? null,
    };
  }, OPTS);
  console.log('  P4 잰 값:', JSON.stringify(got));
  /* ★허용 ★안 한 class 는 ★걷힌다 — ★`class` 를 ★통째로 ★열지 않았다 */
  expect(got.evilClass, `★★허용 안 한 class 가 ★살았다 — ★class 를 통째로 열었다. 잰 값 ${got.evilClass}`).toBe('<span>X</span>');
  expect(got.mixClass, `★★섞어 주면 ★허용 밖 토막이 ★같이 살았다. 잰 값 ${got.mixClass}`).toBe('<span class="tb-hl">X</span>');
  /* ★허용 ★안 한 사용자정의 속성은 ★걷힌다 */
  expect(/--x/.test(got.unkProp), `★★허용 안 한 --x 가 ★살았다. 잰 값 ${got.unkProp}`).toBe(false);
  /* ★허용한 prop 이라도 ★값이 ★수가 아니면 ★걷힌다 */
  expect(/url\(/i.test(got.urlVal), `★★`+'`--tb-dot-i:url(x)`'+` 가 ★살았다 — ★값 화이트리스트가 ★뚫렸다. 잰 값 ${got.urlVal}`).toBe(false);
  for (const [name, re, v] of [['script', /<script|__p2/i, got.script], ['on* 속성', /onerror/i, got.onerr],
                               ['a[href]', /<a\b|href|javascript/i, got.href]]) {
    expect(re.test(String(v)), `★★«${name}» 가 ★살아남았다. 잰 값 ${v}`).toBe(false);
  }
  expect(got.pwned, `★★변조 코드가 ★실행됐다. 잰 값 ${got.pwned}`).toBeNull();
  /* ★음성대조 — ★걷는 자가 ★«전부 지우는 자»는 아니다: ★허용한 것은 ★산다 */
  expect(/class="tb-dot"/.test(got.script), `★허용한 tb-dot 까지 걷혔다 — 그러면 위 「없다」가 공짜다. 잰 값 ${got.script}`).toBe(true);
});

/* ══ G8 ★⒢ ★내보내기(figma export) — ★마크업이 ★새지 않는가 ═══════════════════
   ⚠️★★이 칸은 ★2026-10-08 에 ★★한 번 ★사라졌다 — ★P1 을 뒤집을 때 ★파일 ★«꼬리»를
     ★통째로 갈아 ★그 뒤에 있던 ★이 칸이 ★조용히 ★지워졌다.
   ★★㉠ ★이 비석이 ★가리키는 것 = ★★«이 파일의 ★꼬리를 ★인덱스로 ★자르는 ★모든 편집».
     ⛔«P1 을 고치는 일»만 가리키는 것이 ★아니다 — ★다음 사람이 ★다른 칸을 고치며 ★같은 짓을 한다.
     ⇒ ★이 파일을 ★고칠 땐 ★★«꼬리 치환» 대신 ★★앵커 ★두 개(시작·끝) 사이만 ★갈아라.
   ★★㉡ ★이 파일이 ★스스로 바뀐 횟수 = ★★1 (★2026-10-08 신설 `108dae8f`→리베이스 `18db04c5`)
     ＋ ★커밋 안 된 수정 ★1회분. ⇒ ★★이 수가 ★늘 때마다 ★이 비석을 ★다시 읽어라.
     ⛔이 수를 ★갱신하지 ★않으면 ★이 비석 자체가 ★★낡은 기록이 된다(★비석도 ★썩는다).
     ★★잡은 것은 ★«검사 수»다(★돌아간 14 ↔ ★선언 11+G6×4 를 ★견줬다).
     ⇒ ★★교훈: ★꼬리를 ★인덱스로 ★잘라 갈아끼우면 ★그 뒤의 것이 ★같이 죽는다.
        ★고친 뒤엔 ★★«검사 이름 전수»를 ★견줘라(⛔수만 보면 ★다음에 또 놓친다).

   ★발주서 §5⒢ 는 `export-figma-json.js` 의 ★「`line.text`/`lines[` ★1건 자리」를 재라 했다.
   ★★내 실측 = ★그 수는 ★★0건이다(지디 재확인 · 발주서 정정 §⑵).
   ⇒ ⒢ 가 ★잠글 것은 ★★«그 통로가 ★줄 글자를 ★아예 안 나른다»다:
     그리드는 export 의 ★GENERIC 폴백으로 나가고(:885~), 글자는 ★`[class^="tb-"]` 를
     ★`innerText` 로만 긁는다(:901~906). ★그리드 줄은 ★`.grd-line` 이라 ★안 걸린다.
   ⇒ ★★그래서 ★부분 서식 마크업도 ★샐 ★자리가 없다. ★그 사실을 ★행위로 잠근다.
   ⛔「그래야 한다」가 아니라 ★「2026-10-08 에 그렇다」다 — ★누가 그리드 줄 글자를 ★export 에
     싣기 시작하면 ★이 칸이 ★빨개진다. ★그때 ★«평문이냐 sanitized HTML 이냐»를 ★정해야 한다. */
test('G8 ★⒢ export — 그리드 줄 글자는 figma export 에 안 실린다 ⇒ 마크업도 샐 자리가 없다', async ({ page }) => {
  const errs = await setup(page);
  const id = await addGrid(page);
  await editAndFormatTail3(page, id, ['ControlOrMeta+b']);
  const st = await state(page, id);
  expect(st.textHtml, `★전제 — ★서식이 ★모델에 없다(G1 이 먼저 서야 한다). 잰 값 ${JSON.stringify(st)}`).toBeTruthy();

  /* ★★★2026-10-08 — ★이 자리에서 ★한 번 ★틀렸다. ★적어 둔다(★길이 ★180자).
   *   ⛔`buildFigmaExportJSON(null)` 만 부르면 ★`sections: []` 가 온다 —
   *     ★★내보내기는 ★`state.pages`(★직렬화본)를 돌고 ★★라이브 DOM 을 ★안 본다.
   *   ⇒ ★★`flushCurrentPage()` 가 ★★빠진 단계다. ★선례가 ★그걸 ★먼저 부른다
   *     (★`tests/dom/T12-gridcol-probe.dom.spec.js:378~380`).
   *   ★★그 사실은 ★이 레포의 ★구조이고, ★★`tests/dom/rich-text-loss-axes.dom.spec.js:49~56` 이
   *     ★★이미 ★적어 두었다 — ★★나는 ★그 파일을 ★그날 ★읽었는데 ★★1~34 줄만 읽고 ★★49~56 을 ★놓쳤다.
   *   ⇒ ★★교훈: ★★«남의 측정 기록»을 ★근거로 쓸 땐 ★머리말을 ★★끝까지 읽어라 —
   *     ★이 레포는 ★★«내 자가 어디서 거쳤나»를 ★머리말 ★뒤쪽에 적는다.
   *   ★그리드는 ★비율이 선 ★뒤에 찍어야 한다(★export 파일 `:56` 의 ★그 대기). */
  const out = await page.evaluate(async () => {
    await (window.whenGridRatiosSettled?.() ?? Promise.resolve());
    window.flushCurrentPage?.();
    const j = window.buildFigmaExportJSON?.(null);
    return j == null ? null : JSON.stringify(j);
  });
  expect(out, '★전제 — ★export 가 ★null 이다(그러면 아래 「없다」가 ★공짜로 참이 된다)').toBeTruthy();
  expect(out.includes(id), `★전제 — ★export 에 ★그 그리드(${id})가 ★없다 — ★★장면이 안 섰다(★flushCurrentPage 를 빼면 180자가 온다). 길이 ${out.length}`).toBe(true);

  /* ★★★음성대조 — ★★«장면이 ★사는가»를 ★가른다 (★textfmt ③ 이 ★이 칸으로 ★거짓 보고를 막았다).
     ★평문 텍스트블럭을 ★앱 입구로 넣고 ★그 글자가 ★export 에 ★실리는지 본다.
     ⛔이게 ★없으면 ★★«그리드 글자가 안 실린다»와 ★★«내 장면에서 ★아무 글자도 안 실린다»가
       ★구분되지 ★않는다 — ★★그 둘을 ★섞으면 ★★제품 결함을 ★거짓으로 ★올린다. */
  const ctl = await page.evaluate(async () => {
    document.getElementById('sA').classList.add('selected');
    window.addTextBlock?.('body');
    const tb = [...document.querySelectorAll('#canvas .text-block')].pop();
    const inner = tb?.querySelector('[contenteditable], .tb-text, .tb-body') || tb;
    if (inner) inner.textContent = 'ZZZCTLZZZ';
    await (window.whenGridRatiosSettled?.() ?? Promise.resolve());
    window.flushCurrentPage?.();
    const j = window.buildFigmaExportJSON?.(null);
    return { len: j == null ? 0 : JSON.stringify(j).length, hasCtl: JSON.stringify(j ?? '').includes('ZZZCTLZZZ') };
  });
  console.log('  G8 음성대조(평문 텍스트블럭):', JSON.stringify(ctl));
  expect(ctl.hasCtl, `★★음성대조 실패 — ★평문 텍스트블럭 글자도 ★export 에 ★안 실린다 ⇒ ★★내 ★장면이 ★죽었다(★제품 판정 ★금지). 잰 값 ${JSON.stringify(ctl)}`).toBe(true);
  console.log('  G8:', JSON.stringify({ len: out.length, hasId: out.includes(id), hasTxt: out.includes(TXT) }));

  for (const [name, re] of [['<b>', /<b\b|<\/b>/i], ['<strong>', /<strong\b/i],
                            ['style 달린 span', /<span[^>]*style/i], ['취소선', /<s\b|<strike\b/i],
                            ['tb-hl·tb-dot', /tb-hl|tb-dot/i]]) {
    expect(re.test(out), `★★«${name}» 가 ★export 에 ★샜다 — 피그마 빌더가 ★그 글자를 ★평문으로 찍어 ★태그가 ★화면에 보인다. 길이 ${out.length}`).toBe(false);
  }
  /* ★★그 통로가 ★줄 글자를 ★아예 안 나른다 — ★위 「없다」가 ★«왜» 공짜가 아닌지의 ★까닭 */
  expect(out.includes(TXT), `★★그리드 줄 글자가 ★export 에 ★실리기 시작했다("${TXT}" 가 있다) — ⛔그냥 고치지 마라. ★평문이냐 ★sanitized HTML 이냐를 ★먼저 정해라(발주서 §5⒢).`).toBe(false);
  expect(errs).toEqual([]);
});
