/* graph-h6-gradient.dom.spec.js — E151 그라디언트 바탕에서 그래프 자동 밝기(H6) (태양 lane-bt2-fix 2026-10-06 · 승인 ⒜ 그래프만)
 * 옛: canvas-contrast.js backdropRgbAt 이 조상 중 backgroundImage 가 있으면 null → syncGraphTone 이 아무 변수도 안 쓴다.
 * 사용자 길 둘(코드독해 · prop-frame.js:738-740 · prop-section.js _applySectionBg):
 *   ⒜ 프레임 배경 그라디언트(패널 그라디언트 탭: style.background = css · dataset.bg = css)
 *   ⒝ 섹션 «이미지 + 색»(linear-gradient(c, c), url(img)) — 색이 불투명이면 보이는 바탕 = c(그림은 가려짐)
 * 고침(⒜): backdropStopsAt(el) — 걸음은 backdropRgbAt 과 같고, 맨 위 층이 «모든 정지점 불투명» 그라디언트면 그 정지점들을 낸다(이미지가 그 밑이어도).
 *   syncGraphTone 만 그것을 쓴다: 톤 = 모든 정지점이 같은 톤일 때만 · 목표 대비는 모든 정지점 위에서. G5 그리드·G6 표·선택 톤은 무변(G7 지킴).
 * K6 속빈 점 구멍: 그라디언트엔 «한 색»이 없다 → 흰 대체 그대로(⒦1) · 이름 «E151 은 H6 만 푼다».
 * 대비 = WCAG 독립 구현(제품 계산기 import 안 함).
 * 양성대조: 0f572e2a 나무 안 → G1 G2 빨강 · G3~G7 초록. 변이(backdropStopsAt → null) → G1 G2 빨강.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/graph-h6-gradient.dom.spec.js */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const lin = (c) => { c /= 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4; };
const L = (r) => 0.2126 * lin(r[0]) + 0.7152 * lin(r[1]) + 0.0722 * lin(r[2]);
const cr = (a, b) => { const x = L(a), y = L(b); return (Math.max(x, y) + 0.05) / (Math.min(x, y) + 0.05); };
const rgb = (s) => (String(s).match(/[\d.]+/g) || []).map(Number).slice(0, 3);
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* where: 'frame' = 프레임(그라디언트 css) 안에 꺾은선 · 'section' = 섹션 dataset.bg/bgImg → applySectionBg */
async function setup(page, { where, css = '', color = '', img = '' }) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  const id = await page.evaluate(([where, css, color, img]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', '<div class="section-block" id="sG" data-section="1"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div></div></div>');
    window.rebindAll?.(); window.applyZoom?.(100); const S = document.getElementById('sG');
    window.selectSection(S); window.addGraphBlock({ chartType: 'line' });
    const g = [...S.querySelectorAll('.graph-block')].pop();
    if (where === 'frame') {
      window.selectSection(S); window.addFrameBlock();
      const f = [...S.querySelectorAll('.frame-block')].pop(); f.id = 'fG';
      f.style.backgroundColor = ''; f.style.background = css; f.dataset.bg = css;   // 프레임 패널 그라디언트 탭과 같은 꼴(prop-frame.js:738-740)
      f.appendChild(g.closest('.row') || g);
    } else {
      if (color) S.dataset.bg = color; if (img) S.dataset.bgImg = img; window.applySectionBg(S);
    }
    window.renderGraph(g); window.deselectAll?.(); return g.id;
  }, [where, css, color, img]);
  await page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
  return { errs, id };
}
const look = (page, id) => page.evaluate((id) => { const g = document.getElementById(id);
  return { line: g.style.getPropertyValue('--grb-auto-line').trim(), stroke: getComputedStyle(g.querySelector('.grb-line-path')).stroke }; }, id);

test('G1 ★어두운 그라디언트 프레임(#111 → #2a2a2a) 안 꺾은선 → H6 켜짐 · 모든 정지점 위 대비 ≥ 4.5', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'frame', css: 'linear-gradient(180deg, #111111, #2a2a2a)' });
  const l = await look(page, id);
  expect(l.line, '변수 있음').not.toBe('');
  for (const stop of [[17, 17, 17], [42, 42, 42]]) expect(cr(rgb(l.stroke), stop), `선 ${l.stroke} · 정지점 ${stop}`).toBeGreaterThanOrEqual(4.5);
  expect(errs).toEqual([]);
});
test('G2 ★섹션 «이미지 + 불투명 어두운 색»(#111) → 보이는 바탕 = #111 → H6 켜짐', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'section', color: '#111111', img: PNG });
  const bgImg = await page.evaluate(() => getComputedStyle(document.getElementById('sG')).backgroundImage);
  expect(bgImg, '전제: 색 층 그라디언트 + 그림').toMatch(/linear-gradient.*url\(/);
  const l = await look(page, id);
  expect(l.line, '변수 있음').not.toBe('');
  expect(cr(rgb(l.stroke), [17, 17, 17])).toBeGreaterThanOrEqual(4.5);
  expect(errs).toEqual([]);
});
test('G3 밝은 그라디언트 프레임(흰 → #eee) → 변수 없음(오늘 그대로)', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'frame', css: 'linear-gradient(180deg, #ffffff, #eeeeee)' });
  expect((await look(page, id)).line).toBe('');
  expect(errs).toEqual([]);
});
test('G4 섞인 그라디언트 프레임(#111 → 흰) → 변수 없음(모른다 = 오늘 그대로)', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'frame', css: 'linear-gradient(180deg, #111111, #ffffff)' });
  expect((await look(page, id)).line).toBe('');
  expect(errs).toEqual([]);
});
test('G5 섹션 «그림만» → 변수 없음(그림 픽셀은 못 본다 — 못 보는 꼴 그대로)', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'section', img: PNG });
  expect((await look(page, id)).line).toBe('');
  expect(errs).toEqual([]);
});
test('G6 섹션 «그림 + 반투명 어두운 색» → 변수 없음(그림이 비친다 = 모른다)', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'section', color: 'rgba(17,17,17,0.5)', img: PNG });
  expect((await look(page, id)).line).toBe('');
  expect(errs).toEqual([]);
});
test('G7 지킴 — 공용 backdropRgbAt · textToneAt «자체»는 그라디언트에서 그대로 null(소비자 넷 — G5 그리드 · G6 표 · 관찰자 · 선택 톤 — 무변 · ⒝ 는 현빈 결정)', async ({ page }) => {
  const { errs, id } = await setup(page, { where: 'frame', css: 'linear-gradient(180deg, #111111, #2a2a2a)' });
  const r = await page.evaluate((id) => { const g = document.getElementById(id); const tt = window.__gdTextTone; return { rgb: tt.backdropRgbAt(g), tone: tt.textToneAt(g) }; }, id);
  expect(r).toEqual({ rgb: null, tone: null });
  expect(errs).toEqual([]);
});
