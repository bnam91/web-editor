/* laurel-dataset-height-260.dom.spec.js — 시트 260 LAUREL-RENDER-LEAVES-STALE-DATASET-HEIGHT-01 의 자 (imac-gd-L3 · 261031 · JQ-RULER-A3 ⑴)
 * 원문: 「renderLaurelBlock 이 cells 를 쓴 뒤 block.dataset.height 를 안 지워, 한 블럭이 «높이»를 두 자리에 어긋나게 든다」 · 첫 일 ⑵ 「그 둘이 어긋나면 빨강인 단언 하나」.
 * 정본 = cells[i].height (렌더가 읽는 자리 · js/blocks/laurel-block.js _renderLaurelCellHtml). dataset.height 는 옛 단일 데이터 → cells[0] 이주(:73)만 읽는다.
 * ★L1 은 «일부러 빨강» 이다(test.fail) — 260 이 지는 빨강. FLAKY 아님. 고치는 날 «예상 밖 통과» 로 빨개져 알려 준다 · 그때 test.fail 을 떼라.
 *   L0 [전제] 그 장면이 선다(화면은 정본 200 을 그린다) — 없으면 L1 의 빨강이 «장면이 안 섬» 과 안 갈린다.
 *   N  [음성] 옛 키가 없는 평소 장면 ⇒ 어긋남 0.
 * ⛔이 자가 안 재는 것: dataset.height 를 읽는 소비자 전수(원문 ⑴ · :73 하나는 읽어 봄 · 블럭 공통 길은 안 셌다) · 저장본·다시 열기 뒤 · prop-laurel.js:20 이 지우는 패널 길 · 어떻게 고치나.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SEC = '<div class="section-block" data-section="1" id="sL"><div class="section-hitzone"></div><div class="section-inner"></div></div>';
async function render(page, legacyHeight) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  await bootApp(page);
  return page.evaluate(([sec, legacy]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', sec); window.rebindAll?.(); window.deselectAll?.(); window.selectSection(document.getElementById('sL'));
    window.addLaurelBlock({ gridCols: 1, gridRows: 1, cells: [{ lines: [{ text: 'x' }], leafColor: '#1a1a1a', gap: 24, height: 200 }] });
    const b = [...document.querySelectorAll('#sL .laurel-block')].pop();
    if (legacy !== null) b.dataset.height = legacy; else delete b.dataset.height;
    window.renderLaurelBlock(b);
    const inner = b.querySelector('.laurel-inner');
    return { ds: b.dataset.height ?? null, cells: JSON.parse(b.dataset.cells).map((x) => x.height), minH: inner?.style.minHeight ?? null };
  }, [SEC, legacyHeight]);
}
/** 어긋남 = 옛 키가 남아 있고 정본과 다르다 */
const stale = (r) => r.ds !== null && r.cells.some((h) => String(h) !== String(r.ds));

test('L0 [전제] 옛 키 90 + 셀 200 을 심고 렌더 — 정본 cells 200 이 그대로다', async ({ page }) => {
  const r = await render(page, '90');
  expect(r.cells).toEqual([200]);
  expect(r.minH, '[전제] 렌더가 돌았다').not.toBeNull();
});
test('L1 ★260 이 지는 빨강 — 렌더 뒤 dataset.height 가 남아 cells[].height 와 어긋나면 안 된다', async ({ page }) => {
  test.fail(true, '260 — renderLaurelBlock 이 옛 키를 안 지운다. 고치면 이 표시가 빨개진다 — 그때 test.fail 을 떼라.');
  const r = await render(page, '90');
  expect(stale(r), `높이가 두 자리에 어긋난다 ${JSON.stringify(r)}`).toBe(false);
});
test('N [음성] 옛 키가 없는 평소 장면 — 어긋남 0', async ({ page }) => {
  const r = await render(page, null);
  expect(r.ds).toBeNull();
  expect(stale(r)).toBe(false);
});
