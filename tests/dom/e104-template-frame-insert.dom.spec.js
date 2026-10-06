/* e104-template-frame-insert.dom.spec.js — E104: 프레임(서브섹션) 템플릿을 넣으면 «클릭해도 안 골라지고» 안쪽 id 가 원본과 겹치던 것
 *
 * 머리표(지디 규율): [새 것] d1f642ff 에서 빨강 · [회귀 지킴] d1f642ff 에서도 초록 · [전제] 재기 위한 조건.
 * 원인(실앱 변이 실측 BUNDLE-C/e104v.json): row > «col» > 프레임 꼴이 클릭을 죽였다(col 만 풀면 원본과 같음 · 안쪽 id 재발급·바인딩만으로는 안 됨).
 *   id 중복은 «따로 있는» 결함(바깥 ss.id 만 새로).
 * 고침 = template-system.js insertTemplate(서브섹션): row > 프레임(col 없이) + 안쪽 [id] 전부 새 id(붙여넣기 규칙).
 * 길 = window.saveAsTemplate(프레임 패널 「저장」 단추가 부르는 함수) → window.insertTemplate(템플릿 브라우저 「삽입」 단추가 부르는 함수).
 *   템플릿 저장소 = 메모리(tpl-pagepad-e81 선례 — 하네스 electronAPI 가짜라서). 클릭 = clickAt(맞힌 요소 단언). */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const store = new Map(); const base = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (t, k) => {
      if (k === 'saveTemplateCanvas') return async (id, html) => { store.set(id, html); return { ok: true }; };
      if (k === 'loadTemplateCanvas') return async (id) => store.get(id) ?? null;
      return base[k];
    } });
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sT" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100);
    const sec = document.getElementById('sT'); window.deselectAll?.(); window.selectSection?.(sec);
    const f0 = new Set([...document.querySelectorAll('.frame-block')].map(f => f.id));
    window.addFrameBlock();
    const F = [...document.querySelectorAll('#sT .frame-block:not([data-text-frame])')].find(f => !f0.has(f.id));
    window.addTextBlock('h2');   // 프레임을 고른 채 — 프레임 안으로
    const inner = [...F.querySelectorAll('[id]')].map(e => e.id);
    await window.saveAsTemplate(F, 'e104-sub', '기타', '', [], 'subsection');
    const tpl = window.loadTemplates().find(t => t.name === 'e104-sub');
    window.deselectAll?.(); window.selectSection?.(sec);
    const before = new Set([...document.querySelectorAll('.frame-block:not([data-text-frame])')].map(f => f.id));
    await window.insertTemplate(tpl);
    const NF = [...document.querySelectorAll('#sT .frame-block:not([data-text-frame])')].find(f => !before.has(f.id));
    window.deselectAll?.();
    return { F: F.id, NF: NF ? NF.id : null, inner, hasText: !!F.querySelector('.text-block') };
  });
  expect(r.hasText, '[전제] 원본 프레임 안에 글자').toBe(true);
  expect(r.NF, '[전제] 넣은 프레임이 생겼다').toBeTruthy();
  await page.waitForTimeout(300);
  return { errs, ...r };
}
/** 프레임의 «빈 자리» — 맨 위 요소가 그 프레임 자신인 점 */
const emptyPoint = (page, id) => page.evaluate((id) => { const f = document.getElementById(id); f.scrollIntoView({ block: 'center' }); const r = f.getBoundingClientRect();
  for (let y = Math.round(r.bottom - 4); y > r.top; y -= 4) for (const x of [Math.round(r.right - 8), Math.round(r.left + 8)]) { if (document.elementFromPoint(x, y) === f) return [x, y]; } return null; }, id);
const textPoint = (page, id) => page.evaluate((id) => { const t = document.getElementById(id).querySelector('.text-block [class^="tb-"]'); t.scrollIntoView({ block: 'center' }); const r = t.getBoundingClientRect(); return [r.left + 20, r.top + r.height / 2]; }, id);

test('O1 [새 것] 넣은 프레임 빈 자리 클릭 → 그 프레임이 골라진다(원본과 같음)', async ({ page }) => {
  const { errs, NF } = await setup(page);
  const p = await emptyPoint(page, NF);
  expect(p, '[전제] 넣은 프레임에 빈 자리').toBeTruthy();
  await clickAt(page, p[0], p[1], { sel: `#${NF}` }, { label: '넣은 프레임 빈 자리' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), NF), { message: '★넣은 프레임 선택' }).toBe(true);
  expect(errs).toEqual([]);
});

test('O2 [새 것] 넣은 프레임 안 글자 클릭 → 프레임이 골라진다(첫 클릭 = 그릇 · 원본과 같음)', async ({ page }) => {
  const { errs, F, NF } = await setup(page);
  const t0 = await textPoint(page, F);
  await clickAt(page, t0[0], t0[1], { sel: '.frame-block' }, { label: '원본 안 글자' });
  const orig = await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), F);
  expect(orig, '[전제] 원본은 첫 클릭에 프레임').toBe(true);
  await page.evaluate(() => window.deselectAll?.());
  const t = await textPoint(page, NF);
  await clickAt(page, t[0], t[1], { sel: '.frame-block' }, { label: '넣은 프레임 안 글자' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), NF), { message: '★넣은 프레임 선택(원본과 같음)' }).toBe(true);
  expect(errs).toEqual([]);
});

test('O3 [새 것] 넣은 프레임 안쪽 id 가 원본과 안 겹친다 · 꼴 = row > 프레임', async ({ page }) => {
  const { errs, NF, inner } = await setup(page);
  const r = await page.evaluate(([NF, inner]) => { const nf = document.getElementById(NF); const all = {}; document.querySelectorAll('#canvas [id]').forEach(e => { all[e.id] = (all[e.id] || 0) + 1; });
    return { dup: [...nf.querySelectorAll('[id]')].filter(e => all[e.id] > 1).map(e => e.id), reusedOrig: [...nf.querySelectorAll('[id]')].filter(e => inner.includes(e.id)).map(e => e.id), parent: nf.parentElement.className.split(' ')[0] }; }, [NF, inner]);
  expect(r.dup, `★중복 id ${JSON.stringify(r)}`).toEqual([]);
  expect(r.reusedOrig, '원본 id 재사용 0').toEqual([]);
  expect(r.parent, '★꼴 = row > 프레임(col 없음)').toBe('row');
  expect(errs).toEqual([]);
});

test('G1 [회귀 지킴] 섹션 템플릿 넣기는 그대로 — 섹션이 하나 늘고 안 블럭이 따라 들어간다', async ({ page }) => {
  const { errs } = await setup(page);
  const r = await page.evaluate(async () => {
    const S = document.getElementById('sT'); const n0 = document.querySelectorAll('#canvas .section-block').length;
    await window.saveAsTemplate(S, 'e104-sec', '기타', '', [], 'section');
    const t = window.loadTemplates().find(t => t.name === 'e104-sec'); window.deselectAll?.(); window.selectSection?.(S);
    await window.insertTemplate(t);
    const secs = [...document.querySelectorAll('#canvas .section-block')]; const last = secs.find(s => s !== S && s.querySelector('.frame-block'));
    return { n0, n1: secs.length, hasFrame: !!last, hasText: !!last?.querySelector('.text-block') };
  });
  expect([r.n1 - r.n0, r.hasFrame, r.hasText], JSON.stringify(r)).toEqual([1, true, true]);
  expect(errs).toEqual([]);
});
