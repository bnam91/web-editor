/* figma-modal-min-height-88.dom.spec.js — 시트 0.9.14 88 FIGMA-MODAL-FIXED-HEIGHT-SENT-AS-H-01(탑 261125) · 실앱 DOM 쪽 확인
 *   «최소» 모달(hMode fixed · H 작음 · 내용이 H 를 넘음) → buildFigmaExportJSON(업로드 JSON) 의 그 모달 height = 화면 offsetHeight(> H) · 단위 = figma-modal-min-height-88.test.mjs
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/figma-modal-min-height-88.dom.spec.js --workers=1 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('M88 «최소» 모달 — 내용이 H 를 넘으면 Figma JSON height = 화면 높이(H 아님)', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  const r = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove()); const sec = await window.addSection(); window.deselectAll?.(); window.selectSection?.(sec);
    window.addModalBlock({});
    const m = [...document.querySelectorAll('#canvas .modal-block')].pop(); m.id = m.id || 'eM88';
    m.dataset.hMode = 'fixed'; m.dataset.height = '30'; window.renderModalBlock?.(m);
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    /* ★업로드가 쓰는 길 = buildFigmaExportJSON(figma-publish.js:200 → …Inlined). ⛔exportFigmaJSON(파일 저장 · 옛 parseCol 은 text/asset/gap 만 집는다 :333)은 모달을 «애초에» 안 싣는다 */
    const j = window.buildFigmaExportJSON(null); const txt = 'built';
    const find = (o) => { if (!o || typeof o !== 'object') return null; if (o.kind === 'modal' && o.id === m.id) return o; for (const v of Object.values(o)) { const f = find(v); if (f) return f; } return null; };
    const g = find(j);
    const kinds = []; const walk = (o) => { if (!o || typeof o !== 'object') return; if (o.kind || o.type) kinds.push(`${o.type}/${o.kind || ''}#${o.id || ''}`); Object.values(o).forEach(walk); }; walk(j);
    return { H: 30, live: m.offsetHeight, sent: g ? g.height : null, mode: m.dataset.hMode, id: m.id, got: !!txt, kinds: kinds.slice(0, 12), n: kinds.length, inSec: !!m.closest('.section-block'), parent: m.parentElement?.className?.slice(0, 40), inStr: (() => { window.flushCurrentPage?.(); const st = window.getProjectState?.() || window.__state || window.state; const pg = (st?.pages || window.pages || [])[0]; return pg ? String(pg.canvas || '').includes(m.id) : 'no-pages'; })(), pagesN: (window.getProjectState?.()?.pages || window.pages || []).length };
  });
  console.log('M88 ' + JSON.stringify(r));
  expect(r.mode).toBe('fixed');
  expect(r.live, '[전제] 내용이 H(30) 를 넘는다').toBeGreaterThan(30);
  expect(r.sent, `★Figma JSON 높이 = 화면 높이 ${r.live}(옛 = H 30)`).toBe(r.live);
  expect(errs).toEqual([]);
});
