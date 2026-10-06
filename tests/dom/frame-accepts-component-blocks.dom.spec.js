/* frame-accepts-component-blocks.dom.spec.js — 「Frame 안에 넣는다」는 «화면의 약속»을 잠근다
 *
 * 현빈 실기 제보(2026-09-23, userlens): 「그리드 블럭이 프레임 블럭에 안 들어간다」.
 *
 * ★무엇이 있었나 — 프레임 속성 패널 맨 아랫줄이 이렇게 «약속»한다:
 *     「Frame 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다.」
 *   그런데 실측(격리 인스턴스 9341, 재현 3/3)은 이랬다:
 *     · 텍스트(Label)  → 프레임 «안»  ✅   (block-factory.js 가 자기 프레임 분기를 갖고 있다)
 *     · 그리드          → 프레임 «밖»  ⛔   (공용 insertAfterSelected 를 탄다)
 *
 * ★이건 그리드만의 병이 «아니다». 공용 경로를 타는 컴포넌트 블럭이 15종이다 —
 *   banner·banner02·canvas·chat·comparison·grid·iconify·infocard·innercard·laurel·
 *   mockup·modal·qa·step·vector. ⇒ 고칠 자리는 «한 곳»이고, 15곳에 분기를 베끼면 안 된다.
 *
 * ⛔여기서 «안» 재는 것 — 도형 래퍼(shape frame)는 여전히 «뒤»에 붙어야 한다.
 *   그건 0918 A안 확정이고 shape-frame-isolation.dom.spec.js I1~I3 이 이미 잠갔다.
 *   이 파일이 초록이면서 그쪽이 빨개지면 «고침이 너무 넓은» 것이다(짝 검사).
 *
 * ★H11(2026-10-05): 09-23 결정 = 패널 삽입은 «안»(현빈 「그리드가 프레임에 안 들어간다」) → 10-05 재지시로 «밖»(현빈 「한 번 클릭 후에는 프레임 밖에 삽입되어야지」) · 까닭 = drill-in 이 09-23 의 요구를 대신 채운다.
 *   ⇒ F1(아래)을 뒤집었다: 프레임을 «오브젝트로» 고른 채(자손 선택 0) 넣으면 «다음 형제». 옛 단언(«안»)은 지우지 않고 각 시험 안에 주석으로 남긴다.
 *   F1d(새): 들어간 상태(프레임 안 자식이 골라짐)에서 넣으면 여전히 «안» — 09-23 의 요구가 drill-in 으로 살아 있다는 증거.
 * ★10-05 ⒜: F1 은 10-05 H11 때 밖으로 뒤집었다가 ⒜ 정의(빈 프레임 = 안쪽)로 되돌림 — 픽스처 프레임이 비어 있어서(F0 「처음엔비어있다」).
 * ⛔앱을 «안» 띄운다 — js/drag-utils.js 원본만 route-fulfill (shape-frame-isolation 부트 패턴).
 * 실행: npm run test:dom -- frame-accepts-component-blocks
 */
const { test, expect } = require('@playwright/test');
const { dragUtilsDep } = require('./_drag-utils-deps.js');   // E99 후속 — drag-utils 의 side-effect import(graph-limits.js)를 진짜로
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const SHAPE_FRAME_JS = fs.readFileSync(path.join(REPO, 'js/shape-frame.js'), 'utf8');
const DRAG_UTILS_JS = fs.readFileSync(path.join(REPO, 'js/drag-utils.js'), 'utf8');

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>.section-block{position:relative;width:800px;}</style>
          <script type="module">
            import * as SF from '/js/shape-frame.js';
            import * as DU from '/js/drag-utils.js';
            window.__SF = SF; window.__DU = DU; window.__ready = true;
          </script></head><body>${bodyHtml}</body></html>`,
      });
    }
    if (url.pathname === '/js/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    { const d = dragUtilsDep(url.pathname, '/js/'); if (d) return route.fulfill(d); }
    if (url.pathname === '/js/drag-utils.js') return route.fulfill({ contentType: 'application/javascript', body: DRAG_UTILS_JS });
    if (url.pathname === '/js/globals.js') return route.fulfill({ contentType: 'application/javascript', body: 'export const state = {};' });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ★실기 그대로의 모양 — 사용자가 「Frame 추가」를 누르면 data-free-layout="true" 인
 *   «진짜» 프레임이 서고, 클릭하면 .selected 가 붙고 window._activeFrame 이 그것이 된다.
 *   (실측 dataset: {bg:'#ffffff', freeLayout:'true', width:'860', height:'520', padY:'0'})
 * ⛔프레임 «뒤»에 표지 블록을 하나 둔다 — 「뒤에 붙었다」와 「안에 들어갔다」가
 *   블록 하나짜리 픽스처에서는 «같은 답»으로 겹친다(insert-anchor-property 가 남긴 경고). */
const FIXTURE = `
<div class="section-block" id="S"><div class="section-inner" id="SI">
  <div class="row" id="R"><div class="frame-block selected" id="F" data-free-layout="true"
       style="position:relative;width:600px;height:300px;background:#ffffff;"></div></div>
  <div class="gap-block" id="AFTER"></div>
</div></div>`;

/* 공용 경로를 타는 컴포넌트 블럭 15종 중 대표 — 클래스만 다르고 경로는 «하나»다. */
const COMPONENTS = ['grid-block', 'step-block', 'chat-block', 'modal-block', 'comparison-block'];

test('F0 전제 — 그물이 살아 있다(프레임은 «진짜» 프레임이고 선택돼 있다)', async ({ page }) => {
  const errs = await boot(page, FIXTURE);
  const out = await page.evaluate(() => {
    const F = document.getElementById('F');
    return {
      있다: !!F,
      선택됨: F.classList.contains('selected'),
      도형래퍼아님: !window.__SF.isShapeFrame(F),
      글자프레임아님: !F.dataset.textFrame,
      배너아님: !F.dataset.bannerPreset,
      같은섹션: F.closest('.section-block') === document.getElementById('S'),
      처음엔비어있다: F.children.length === 0,
    };
  });
  expect(errs).toEqual([]);
  expect(out).toEqual({
    있다: true, 선택됨: true, 도형래퍼아님: true, 글자프레임아님: true,
    배너아님: true, 같은섹션: true, 처음엔비어있다: true,
  });
});

for (const cls of COMPONENTS) {
  /* 09-23 옛 제목(기록): `F1-${cls} ★프레임을 고른 채 「${cls}」을 넣으면 프레임 «안»에 들어간다 (화면이 약속한 그대로)`
     H11 제목(기록): `F1-${cls} ★프레임을 «오브젝트로» 고른 채 …을 넣으면 프레임 «다음 형제»(H11 10-05 재지시 — 09-23 «안» 뒤집음)`
     ★10-05 H11 때 밖으로 뒤집었다가 ⒜ 정의(빈 프레임 = 안쪽)로 되돌림 — 픽스처 프레임은 «처음엔 비어있다»(F0). */
  test(`F1-${cls} ★«빈» 프레임을 고른 채 「${cls}」을 넣으면 프레임 «안»에 들어간다(09-23 · ⒜ 정의: 자식 요소 0 = 안쪽 상태)`, async ({ page }) => {
    const errs = await boot(page, FIXTURE);
    const out = await page.evaluate((klass) => {
      const F = document.getElementById('F');
      window._activeFrame = F;                       // 실기: 프레임을 클릭하면 이렇게 된다
      const el = document.createElement('div');
      el.className = klass; el.id = 'NEW';
      window.__DU.insertAfterSelected(document.getElementById('S'), el);
      return {
        프레임안: !!el.closest('#F'),
        부모: el.parentElement.id,
        프레임자식수: F.children.length,
        표지블록그대로: document.getElementById('AFTER') ? document.getElementById('AFTER').previousElementSibling.id : null,
        앞형제: el.previousElementSibling ? el.previousElementSibling.id : null,
      };
    }, cls);
    expect(errs).toEqual([]);
    /* ── H11(10-05) 단언(기록 — ⒜ 정의로 되돌림: 빈 프레임은 오브젝트로 골라도 안쪽 상태):
       expect(out.프레임안).toBe(false) · expect(out.프레임자식수).toBe(0) · expect(out.앞형제).toBe('R') ──
       ── 아래 = 09-23 단언(다시 살아 있음 · 10-05 ⒜) ── */
    expect(out.프레임안,
      `★「${cls}」이 프레임 «밖»으로 나갔다 — 부모=${out.부모}.\n` +
      '   프레임 속성 패널은 「Frame 클릭 후 플로팅 패널에서 블록을 추가하면 이 안으로 들어갑니다」라고\n' +
      '   «약속»한다. 텍스트(Label)는 그 약속을 지키는데(block-factory.js 자기 분기) 컴포넌트 블럭\n' +
      '   15종은 공용 insertAfterSelected 를 타서 프레임 «뒤»(형제)로 붙는다.\n' +
      '   ⇒ 고칠 자리는 drag-utils.js 의 «한 곳»이다. 15곳에 분기를 베끼지 마라.').toBe(true);
    expect(out.프레임자식수).toBe(1);
  });
}

for (const cls of COMPONENTS) {
  test(`F1d-${cls} [새 것·안전망] 들어간 상태(프레임 안 자식이 골라짐)에서 「${cls}」을 넣으면 여전히 프레임 «안»(09-23 요구 = drill-in)`, async ({ page }) => {
    const errs = await boot(page, FIXTURE);
    const out = await page.evaluate((klass) => {
      const F = document.getElementById('F');
      const kid = document.createElement('div'); kid.className = 'gap-block selected'; kid.id = 'KID'; F.appendChild(kid);   // 들어간 상태: 자손이 골라짐
      window._activeFrame = F;
      const el = document.createElement('div'); el.className = klass; el.id = 'NEW';
      window.__DU.insertAfterSelected(document.getElementById('S'), el);
      return { 프레임안: !!el.closest('#F'), 부모: el.parentElement.id };
    }, cls);
    expect(errs).toEqual([]);
    expect(out.프레임안, `들어간 상태인데 프레임 «밖»으로 나갔다 · 부모=${out.부모}`).toBe(true);
  });
}

test('F2 ★짝 검사 — 고침이 «너무 넓지» 않다: 도형 래퍼는 여전히 «뒤»다', async ({ page }) => {
  const errs = await boot(page, `
    <div class="section-block" id="S"><div class="section-inner" id="SI">
      <div class="frame-block selected" id="SW" data-free-layout="true"
           style="width:100px;height:100px;margin:0 auto;background:transparent;padding:0;max-width:100%;min-height:100px;">
        <div class="shape-block" id="shp" data-type="shape" data-shape-type="rectangle"
             style="position:absolute;left:0;top:0;"><svg class="shape-svg"></svg></div>
      </div>
      <div class="gap-block" id="AFTER"></div>
    </div></div>`);
  const out = await page.evaluate(() => {
    const W = document.getElementById('SW');
    window._activeFrame = W;
    const el = document.createElement('div'); el.className = 'grid-block'; el.id = 'NEW';
    window.__DU.insertAfterSelected(document.getElementById('S'), el);
    return { 도형래퍼자식수: W.children.length, 래퍼안: !!el.closest('#SW'), 부모: el.parentElement.id };
  });
  expect(errs).toEqual([]);
  expect(out.래퍼안,
    '★도형 래퍼 «안»에 들어갔다 — 0918 A안(「도형 래퍼는 그냥 도형이다」)을 깬다. 고침이 너무 넓다.').toBe(false);
  expect(out.도형래퍼자식수).toBe(1);
});
