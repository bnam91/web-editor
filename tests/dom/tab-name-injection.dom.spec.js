/* tab-name-injection.dom.spec.js — T-049 후속. «프로젝트 이름이 탭 줄에서 코드가 되는가».
 *
 * ★왜 따로 필요한가 (2026-09-21 실앱 재현, 포트 9541)
 *   목록 화면(pages/projects.html)은 _escHtml 로 막혀 있었는데 «에디터 탭 줄»이 안 막혀 있었다.
 *   그런 이름의 프로젝트를 열면 js/tab-system.js 의 renderTabBar 가 이름을 템플릿 문자열로
 *   innerHTML 에 이어붙였고, 앱 CSP 가 script-src 'unsafe-inline' 이라 곧장 돌았다
 *   (실측: document.title 이 페이로드대로 바뀌고 .proj-tab-name 안에 태그가 실물로 박혔다).
 *
 * ★이 검사의 모양 — «안 터졌다»를 재지 않는다. «터졌으면 빨강»이 되는지부터 증명한다.
 *   T1(양성대조)이 같은 페이로드를 날것 innerHTML 로 넣어 계측기(카나리아+노드 수)가 정말
 *   불이 켜지는지 보인다. T1 이 초록이어야 T2·T3 의 초록이 뜻을 가진다.
 *   ⇒ T1 이 빨강이면 계측기가 죽은 것이지 앱이 안전한 게 아니다.
 *
 * ★이름을 «검사»하는 길로 막지 않았다(명부가 또 생긴다). 내는 자리에서 항상 문자로 넣는다
 *   (textContent / dataset / 클로저). 그래서 여기선 «어떤 글자가 와도 노드가 안 생긴다»를 잰다.
 *
 * ⛔앱을 안 띄운다 — 고디터 인스턴스·9345 대역 무접촉. 빈 페이지에 js/tab-system.js 만 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const SRC = path.join(__dirname, '..', '..', 'js', 'tab-system.js');

/* 페이로드 = 「코드로 읽히면 카나리아를 켠다」. 구체 문자열은 여기서만 산다. */
const PAYLOAD = `T49 <img src=x onerror="window.__t49_fired=1;document.title='T49-PWN'">`;

async function boot(page) {
  await page.goto('about:blank');
  await page.evaluate(() => {
    window.__t49_fired = 0;
    document.title = 'clean';
    document.body.innerHTML =
      '<div id="tab-bar"></div>' +
      '<div id="tab-add-wrap"><div id="tab-add-menu"></div></div>' +
      '<div id="project-name-display"></div><div id="project-id-display"></div>';
  });
}

/* 계측기가 보는 것 — 카나리아 + «주입된 노드가 실제로 생겼나» 둘 다. */
async function probe(page, sel) {
  return page.evaluate((s) => {
    const host = document.querySelector(s);
    return {
      fired: !!window.__t49_fired,
      title: document.title,
      injectedNodes: host ? host.querySelectorAll('*').length : -1,
      text: host ? host.textContent : null,
    };
  }, sel);
}

test('T049-DOM-1 ★양성대조 — 같은 페이로드를 날것 innerHTML 로 넣으면 계측기가 «빨강»이 된다', async ({ page }) => {
  await boot(page);
  await page.evaluate((p) => {
    const span = document.createElement('span');
    span.className = 'positive-control';
    span.innerHTML = p;                      // ← 옛 renderTabBar 가 하던 바로 그 짓
    document.getElementById('tab-bar').appendChild(span);
  }, PAYLOAD);
  await page.waitForTimeout(300);            // onerror 는 다음 턴에 돈다

  const r = await probe(page, '.positive-control');
  console.log(`  양성대조: fired=${r.fired} title=${r.title} 주입노드=${r.injectedNodes}`);
  expect(r.fired, '★계측기가 죽었다 — 코드가 돌았는데도 카나리아가 안 켜졌다').toBe(true);
  expect(r.injectedNodes, '★계측기가 죽었다 — 태그가 노드로 박혔는데 0 으로 센다').toBeGreaterThan(0);
  expect(r.title).toBe('T49-PWN');
});

test('T049-DOM-2 ★탭 줄(renderTabBar) — 이름이 «글자로만» 들어간다', async ({ page }) => {
  await boot(page);
  await page.addScriptTag({ type: 'module', content: fs.readFileSync(SRC, 'utf8') });
  await page.evaluate((p) => {
    window.openTabs = [{ id: 'proj_1', name: p }];
    window.activeProjectId = 'proj_1';
    window.renderTabBar();
  }, PAYLOAD);
  await page.waitForTimeout(300);

  const r = await probe(page, '.proj-tab-name');
  console.log(`  탭 줄: fired=${r.fired} title=${r.title} 주입노드=${r.injectedNodes}`);
  expect(r.injectedNodes, '★이름이 마크업으로 파싱됐다 — .proj-tab-name 안에 노드가 생겼다').toBe(0);
  expect(r.fired, '★프로젝트 이름이 탭 줄에서 코드로 돌았다').toBe(false);
  expect(r.title, '★페이로드가 document.title 을 바꿨다').toBe('clean');
  expect(r.text, '★막느라 이름 글자를 잃으면 안 된다 — 보이는 건 원문 그대로여야 한다').toBe(PAYLOAD);
});

test('T049-DOM-3 ★+ 드롭다운(toggleTabAddMenu) — 같은 이름이 목록에서도 글자로만 들어간다', async ({ page }) => {
  await boot(page);
  await page.addScriptTag({ type: 'module', content: fs.readFileSync(SRC, 'utf8') });
  await page.evaluate(async (p) => {
    // about:blank 엔 localStorage 가 없다(SecurityError) → 일렉트론 분기로 목록을 먹인다.
    window.IS_ELECTRON = true;
    window.electronAPI = { listProjects: async () => [{ id: 'proj_2', name: p, updatedAt: new Date().toISOString() }] };
    window.openTabs = [];
    window.activeProjectId = null;
    await window.toggleTabAddMenu({ stopPropagation() {} });
  }, PAYLOAD);
  await page.waitForTimeout(300);

  const r = await probe(page, '.tab-add-item-name');
  console.log(`  + 드롭다운: fired=${r.fired} title=${r.title} 주입노드=${r.injectedNodes}`);
  expect(r.injectedNodes, '★이름이 마크업으로 파싱됐다 — .tab-add-item-name 안에 노드가 생겼다').toBe(0);
  expect(r.fired, '★프로젝트 이름이 + 드롭다운에서 코드로 돌았다').toBe(false);
  expect(r.title).toBe('clean');
  expect(r.text).toBe(PAYLOAD);
});
