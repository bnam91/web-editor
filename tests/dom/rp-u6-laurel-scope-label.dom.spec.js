/* rp-u6-laurel-scope-label — 월계수 «잎 간격·잎 크기·잎 채움·잎 색상»이 칸 카드(그 칸만)와 일괄 줄(모든 칸)에 같은 이름표로 두 번 서던 것(수지 발주32 · U6).
 *   dev 는 「All Cells (일괄)」/「Cells (n)」 절로 갈려 보였다 ⇒ 일괄 줄에 그리드 범위 표기 꼴(「… · 모든 칸」 · data-scope="all" · title 전문).
 * S1 네 이름마다: 칸 카드(Content) 이름표 ≠ 일괄 줄 이름표 · 일괄 쪽은 「모든 칸」을 담고 줄이 data-scope="all" · title 에 전문
 * 양성대조: prop-laurel.js 일괄 줄 이름표를 옛 꼴(「잎 간격」 등 · data-scope 없음)으로 되돌리면 S1 빨강. 잘림(56px 라벨)은 로그로만 찍는다. */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('S1 일괄 줄과 칸 카드의 같은 속성이 서로 다른 범위로 읽힌다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection(); const sec = c.querySelector('.section-block'); window.deselectAll?.(); window.selectSection(sec);
    const before = new Set(sec.querySelectorAll('.laurel-block')); window.addLaurelBlock?.();
    const b = [...sec.querySelectorAll('.laurel-block')].find((x) => !before.has(x)); if (!b) return { err: 'no laurel' };
    window.deselectAll?.(); b.classList.add('selected'); window.showLaurelProperties(b);
    const P = document.querySelector('#panel-right .panel-body');
    const rowsOf = (secKey) => [...P.querySelectorAll(`.prop-section[data-sec="${secKey}"] .prop-label`)].map((l) => ({ t: l.textContent.trim(), title: l.title || '', scope: l.closest('[data-scope]')?.dataset.scope || null, cut: l.scrollWidth > l.clientWidth, inCard: !!l.closest('.prop-cell-card, [data-sec-item], [data-card-index]') }));
    const content = rowsOf('content').filter((x) => x.inCard);
    const bulk = [...rowsOf('size'), ...rowsOf('layout'), ...rowsOf('fill')];
    const out = {};
    for (const name of ['잎 간격', '잎 크기', '잎 채움', '잎 색상']) {
      out[name] = { card: content.find((x) => x.t.startsWith(name))?.t ?? null, bulk: bulk.find((x) => x.t.startsWith(name)) ?? null };
    }
    return { out };
  });
  expect(r.err, String(r.err)).toBeUndefined();
  console.log('[S1] ' + JSON.stringify(r.out));
  for (const [name, o] of Object.entries(r.out)) {
    expect(o.card, `[전제] ${name} 칸 카드 이름표`).not.toBeNull();
    expect(o.bulk, `[전제] ${name} 일괄 줄`).not.toBeNull();
    expect(o.bulk.t, `★${name} — 일괄 줄과 칸 카드가 같은 이름표(어느 쪽이 일괄인지 안 보인다)`).not.toBe(o.card);
    expect(o.bulk.t, `★${name} 일괄 줄에 범위 표기가 없다`).toContain('모든 칸');
    expect(o.bulk.scope, `★${name} 일괄 줄 data-scope`).toBe('all');
    expect(o.bulk.title, `★${name} 일괄 줄 title 전문`).toContain('모든 칸');
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});
