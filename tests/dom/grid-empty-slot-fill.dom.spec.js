/* grid-empty-slot-fill.dom.spec.js — T4② 「높이·너비 ★100% 가 디폴트」 (현빈 2026-10-07 · 지디 판정)
 *
 * ★현빈 원문 ★두 문장이 ★한 요구다:
 *   「높이 너비 ★100%가 ★디폴트여야지.」 ＋ 「★개별로 추가 조절했으면 ★별개로 적용둬야하는거고.」
 *   ⇒ ★기본은 «꽉 채움» · ★손으로 만지면 ★그때만 고정.
 *
 * ★범위 — ★★«빈 슬롯만»(지디 판정). ⛔`:2225`·`:2230`(그림이 ★든 줄) ★무접촉.
 *   까닭 = ★E157(현빈 10-05 「고쳐 그럼」)이 ★「크롭 없는 그림 줄은 높이 키를 무시 → 네이티브 비율」을
 *   ★이미 정했다. ★이틀 전 ★그의 결정을 ★오늘 말로 덮지 않는다. ⇒ ★E1 이 ★그 경계를 ★지킨다.
 *
 * ★왜 «100% ＋ 바닥» 인가(실측 2026-10-07 probe A):
 *   `.grd-cell` 은 ★display:flex 다 ⇒ 인라인 `height:180px` 이 ★안 지켜지고 ★72px 로 ★눌려 있었다.
 *   `height:100%` 로 바꾸니 ★칸 높이에 ★정확히 찼다. ★바닥(min-height)은 ★칸 높이가 ★그 슬롯으로만
 *   정해지는 판(옆에 내용 없음)에서 100% 가 ★순환이라 0 으로 꺼지는 것을 막는다.
 *
 * ★순서는 ★위험한 것부터(지디): ⑸E157 → ⑷저장왕복 → ⑴채움 → ⑵명시우선 → ⑶원
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/grid-empty-slot-fill.dom.spec.js
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/** 섹션 → 그리드 → 첫 칸에 줄 하나. 둘째 칸엔 «키 큰» 글자를 둬서 칸이 ★확정 높이를 갖게 한다. */
async function build(page, line, opts = {}) {
  return page.evaluate(({ line, opts }) => {
    document.getElementById('canvas').innerHTML =
      `<div class="section-block" id="s" data-section="1">
         <div class="section-hitzone"><span class="section-label">S</span></div>
         <div class="section-inner" id="in" style="padding-left:60px;padding-right:60px"></div></div>`;
    const { row, block } = window.makeGridBlock({});
    document.getElementById('in').appendChild(row);
    block.id = 'G';
    const m = window.getGridModel(block);
    m.cols[0].lines = [line];
    m.cols[1].lines = [{ type: 'body', text: opts.tall || '줄\n줄\n줄\n줄\n줄\n줄\n줄\n줄' }];
    block.dataset.cols = JSON.stringify(m.cols);
    window.renderGridBlock(block);
    return true;
  }, { line, opts });
}

const slot = (page, sel = '.grd-img-empty') => page.evaluate((s) => {
  const el = document.querySelector('#G ' + s);
  if (!el) return null;
  const cell = el.closest('.grd-cell');
  return {
    inline: el.getAttribute('style') || '',
    h: Math.round(el.getBoundingClientRect().height),
    cellH: cell ? Math.round(cell.getBoundingClientRect().height) : null,
  };
}, sel);

test('E1 ⑸ ★E157 을 ★안 깬다 — ★그림이 ★든 줄은 ★손대지 않았다(네이티브 비율 그대로)', async ({ page }) => {
  await bootApp(page);
  // ★크롭 없음 = E157 이 「높이 키를 그릴 때 무시」라 정한 그 갈래. height 를 ★줘도 무시돼야 한다.
  await build(page, { type: 'image', imgSrc: PX, height: 300 });
  const r = await page.evaluate(() => {
    const f = document.querySelector('#G .grd-img-frame:not(.grd-img-empty)');
    const img = f ? f.querySelector('img') : null;
    return { frameInline: f ? f.getAttribute('style') : null, imgInline: img ? img.getAttribute('style') : null };
  });
  expect(r.frameInline, '전제 — 그림 든 틀이 그려졌다').not.toBe(null);
  /* ★E157 의 규약: 크롭 없는 그림은 `height:auto`(네이티브 비율). ⛔100% 로 바뀌면 ★그의 10-05 결정이 깨진 것이다. */
  expect(r.imgInline, `★E157 이 깨졌다 — 안쪽 그림 style=${r.imgInline}`).toContain('height:auto');
  expect(r.frameInline, `★그림 든 틀에 100% 가 샜다 — style=${r.frameInline}`).not.toContain('height:100%');
});

test('E2 ⑷ ★저장 왕복 — ★미설정이 ★미설정으로 남는다(기본값이 ★안 박힌다)', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'image', imgSrc: '' });            // ★height 키 없음
  const before = await page.evaluate(() => {
    const m = window.getGridModel(document.getElementById('G'));
    return { has: 'height' in (m.cols[0].lines[0] || {}), saved: window.getSerializedCanvas() };
  });
  expect(before.has, '전제 — 판에 height 키가 ★없다').toBe(false);
  /* ★한 번 박히면 ★되돌릴 수 없다(저장본이 바뀐다) ⇒ 저장 글자에 height 가 ★안 나와야 한다. */
  expect(/"height"\s*:/.test(before.saved), '★저장본에 height 키가 박혔다').toBe(false);

  // ★앱을 다시 띄워 열어도 ★여전히 미설정
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; window.rebindAll?.({ preserveHistory: true }); }, before.saved);
  const after = await page.evaluate(() => {
    const b = document.getElementById('G');
    const m = window.getGridModel(b);
    return { has: 'height' in (m.cols[0].lines[0] || {}), inline: b.querySelector('.grd-img-empty')?.getAttribute('style') || '' };
  });
  expect(after.has, '★다시 연 뒤 height 키가 생겼다 — 기본값이 박혔다').toBe(false);
  expect(after.inline, `★다시 연 뒤에도 채움이어야 한다 — style=${after.inline}`).toContain('height:100%');
});

test('E3 ⑴ ★미설정이면 ★칸을 채운다(＋바닥이 있어 0 으로 안 꺼진다)', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'image', imgSrc: '' });
  const r = await slot(page);
  expect(r, '전제 — 빈 슬롯이 그려졌다').not.toBe(null);
  expect(r.inline, `★채움이 아니다 — style=${r.inline}`).toContain('height:100%');
  expect(r.inline, `★바닥이 없다 — style=${r.inline}`).toContain('min-height:180px');
  /* ★실제로도 채워야 한다 — «적힌 것»이 아니라 «그려진 것»으로 (옛 판은 flex 에 눌려 72px 였다). */
  expect(r.h, `★칸(${r.cellH})을 안 채웠다 — 슬롯 ${r.h}`).toBeGreaterThanOrEqual(Math.min(r.cellH, 180));
  expect(r.h, '★0 으로 꺼졌다').toBeGreaterThan(0);
});

test('E4 ⑵ ★손으로 만지면 ★그때만 고정 — 명시값이 ★이긴다', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'image', imgSrc: '', height: 240 });
  const r = await slot(page);
  expect(r.inline, `★명시값이 안 이겼다 — style=${r.inline}`).toContain('height:240px');
  expect(r.inline, '★명시값인데 채움이 같이 붙었다').not.toContain('height:100%');
  /* ⛔★«그려진 높이»는 ★안 잠근다 — ★이 변경이 ★고치는 것이 아니다.
     ★실측 2026-10-07: 240px 을 줘도 ★96~103px 로 그려진다(옛 판의 180 폴백도 ★72px 였다).
     ⇒ ★명시 높이가 ★화면에서 안 지켜지는 것은 ★이 레인 ★이전부터의 ★별건이다(원인 ★미측정).
     ⛔여기서 `toBe(240)` 을 걸면 ★내가 ★안 고친 것을 ★고쳤다고 말하는 검사가 된다.
     ★대신 ★「채움이 아니다」와 ★「0 이 아니다」만 — ★내가 ★실제로 보장하는 것. */
  expect(r.h, `★그려지긴 해야 한다 — ${r.h}`).toBeGreaterThan(0);
});

test('E5 ⑶ ★원도 ★같은 규칙 — 미설정이면 채우고 명시값이면 이긴다 · ★정원은 유지', async ({ page }) => {
  await bootApp(page);
  await build(page, { type: 'image', imgSrc: '', imgShape: 'circle' });   // ★지름 키 없음
  const unset = await slot(page, '.grd-img-circle');
  expect(unset, '전제 — 빈 원이 그려졌다').not.toBe(null);
  expect(unset.inline, `★원이 안 채운다 — style=${unset.inline}`).toContain('height:100%');
  expect(unset.inline, '★정원이 깨졌다(aspect-ratio 없음)').toContain('aspect-ratio:1/1');

  await build(page, { type: 'image', imgSrc: '', imgShape: 'circle', height: 160 });
  const set = await slot(page, '.grd-img-circle');
  expect(set.inline, `★원의 명시 지름이 안 이겼다 — style=${set.inline}`).toContain('width:160px');
  expect(set.inline, '★명시인데 채움이 같이 붙었다').not.toContain('height:100%');
});
