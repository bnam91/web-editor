/* overlay-drag-contenteditable-guard.dom.spec.js — T-037 P0 (2026-09-16, 실측 QA 발견).
 *
 * ★근본원인: js/props/prop-text-wireup-overlay.js의 _bindOverlayMoveDrag(posEl) mousedown
 *   가드가 `e.target.closest('.resize-handle, [contenteditable]')`였다. 텍스트 블록의 실제
 *   렌더 요소(.tb-h2 등, js/block-factory.js가 만듦)는 편집 중이 «아닐 때도» 항상
 *   contenteditable="false"를 달고 있다(수십 자리, 예: block-factory.js:1392). CSS 속성선택자
 *   [contenteditable]는 값과 무관하게 «속성 존재»만 보므로 false여도 걸려, 오버레이 텍스트
 *   «어디를 클릭해도» mousedown 핸들러가 즉시 return — 크로스섹션 드래그가 통째로 막혀 있었다.
 *
 *   실측(격리 인스턴스, CDP 진짜 mousedown→move×20→up): 20단계 진짜 드래그를 여러 번 재현해도
 *   매번 텍스트만 네이티브 셀렉션되고 블록은 1px도 안 움직였고 parentSection도 그대로였다.
 *
 * ★고침: 값을 [contenteditable="true"]로 좁혔다 — 실제 편집 진입 시(block-drag.js 여러 곳이
 *   setAttribute('contenteditable','true')로 켠다)만 드래그를 막고, 평소(false) 상태는 막지
 *   않는다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. prop-text-wireup-overlay.js 원문에서
 *   가드 표현식만 정규식으로 떠서(대역이 아니라 «진짜 소스 문자열») 실제 브라우저 DOM의
 *   Element.closest()로 CSS 속성선택자 매칭을 그대로 잰다 — jsdom 없이, 진짜 속성 매칭 규칙으로.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js overlay-drag-contenteditable
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';

const OVERLAY_SRC = fs.readFileSync(path.join(REPO, 'js/props/prop-text-wireup-overlay.js'), 'utf8');

/* ★가드 줄 자체를 원문에서 그대로 떠낸다(대역 아님) — 구현이 바뀌면 이 정규식이 못 찾아 던진다. */
const GUARD_RE = /if \(e\.target\.closest\('([^']+)'\)\) return;/;
const m = OVERLAY_SRC.match(GUARD_RE);
if (!m) throw new Error('★가드 표현식을 원문에서 못 찾음 — prop-text-wireup-overlay.js의 _bindOverlayMoveDrag 구현이 바뀌었으면 이 테스트도 같이 고쳐라');
const GUARD_SELECTOR = m[1];   // 예: ".resize-handle, [contenteditable=\"true\"]"

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><body>
          <div class="section-block">
            <div class="frame-block" data-text-frame="true" data-overlay-block="true" id="tf1">
              <!-- ★block-factory.js가 실제로 만드는 것과 같은 모양 — 평소(비-편집) 상태는
                   항상 contenteditable="false"다(대역 아님, 실제 프로젝트에서 매 렌더마다 이렇다). -->
              <div class="tb-h2" contenteditable="false" id="txt1">소제목을 입력하세요</div>
            </div>
          </div>
          </body></html>`,
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
}

test('전제 — 가드 선택자를 원문에서 실제로 떴다(하드코딩 카피 아님)', () => {
  expect(GUARD_SELECTOR).toContain('contenteditable');
});

test('T-037-1 ★핵심(회귀 게이트) — 평소 상태(contenteditable="false")는 가드에 안 걸린다(드래그가 시작돼야 한다)', async ({ page }) => {
  await boot(page);
  const blocked = await page.evaluate((sel) => {
    const target = document.getElementById('txt1');   // contenteditable="false"
    return !!target.closest(sel);
  }, GUARD_SELECTOR);
  expect(blocked, 'contenteditable="false"인 평소 텍스트를 클릭했는데 가드가 걸렸다 — T-037 재현(크로스섹션 드래그가 시작조차 안 됨)').toBe(false);
});

test('T-037-2 편집 중(contenteditable="true")은 여전히 가드에 걸린다(드래그를 막아야 한다) — 회귀 없음', async ({ page }) => {
  await boot(page);
  const blocked = await page.evaluate(() => {
    document.getElementById('txt1').setAttribute('contenteditable', 'true');
  });
  const blocked2 = await page.evaluate((sel) => document.getElementById('txt1').closest(sel) != null, GUARD_SELECTOR);
  expect(blocked2, '편집 중인데도 가드가 안 걸린다 — 타이핑 중에 드래그가 끼어드는 회귀').toBe(true);
});

test('T-037-3 리사이즈 핸들은 여전히 가드에 걸린다(기존 동작 보존)', async ({ page }) => {
  await boot(page);
  const blocked = await page.evaluate((sel) => {
    const h = document.createElement('div');
    h.className = 'resize-handle';
    document.getElementById('tf1').appendChild(h);
    return h.closest(sel) != null;
  }, GUARD_SELECTOR);
  expect(blocked, '.resize-handle 가드가 깨졌다').toBe(true);
});

test('T-037-4 [양성대조] 옛 선택자([contenteditable], 값 무관)였다면 평소 상태도 걸렸을 것이다 — 이 버그를 실제로 재현', async ({ page }) => {
  await boot(page);
  const OLD_SELECTOR = GUARD_SELECTOR.replace('[contenteditable="true"]', '[contenteditable]');
  expect(OLD_SELECTOR, '양성대조 치환 앵커를 못 찾음').not.toBe(GUARD_SELECTOR);
  const blockedByOld = await page.evaluate((sel) => document.getElementById('txt1').closest(sel) != null, OLD_SELECTOR);
  expect(blockedByOld, '양성대조가 재현 안 됨 — 옛 선택자도 평소 상태를 안 막았다면 이 테스트가 실제 결함을 못 본다는 뜻').toBe(true);
});
