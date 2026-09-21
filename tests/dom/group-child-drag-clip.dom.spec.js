/* group-child-drag-clip.dom.spec.js — 「그룹 «안»의 블럭을 한 칸 끌어내리면 화면에서 사라진다」 (T-088 2라운드)
 *
 * ★실앱 실측(2026-09-22 · 포트 9635 · 줌 100% · CDP 진짜 입력 주입):
 *   섹션에 제목 + ⌘G 그룹을 두고 제목을 그룹으로 끌어 넣으면 그룹이 120→314px 로 커지며
 *   제목이 top:148px 에 자리잡는다(여기까지가 1라운드 고침 growFrameToFitChildren).
 *   그 «뒤» 제목을 한 칸 더 끌어내리면 — 프레임 «안»의 이동이라 프레임은 안 커진다 —
 *     style.top 148 → 288 · rect 472~638 (그룹 밑변 498 을 140px 넘고 섹션 밑변 598 도 넘음)
 *     · 가운데 elementFromPoint = gap-block(= 안 잡힌다) · innerText 는 그대로
 *   = DOM 에서 지워진 것(⑴)도 아니고 좌표만 튄 것(⑶)도 아니다. «프레임이 잘라 먹은 것»(⑵)이다.
 *   .frame-block 은 overflow:hidden(css/editor-blocks.css:11) 이고, 프레임 «안에서» 자식을
 *   옮길 때는 프레임을 키우지 않는다(js/block-drag.js `_resizeFrameToFitChildren` = 의도된 no-op).
 *   ⇒ 키우지 않을 거면 «죄어야» 한다. 그 죔이 clampChildIntoFrame 이다.
 *
 * ★이 검사는 «잘리는 성질»을 진짜 브라우저 레이아웃 + 실제 히트테스트로 잰다 —
 *   「rect 가 있다」와 「화면에서 잡힌다」는 다른 말이라 elementFromPoint 로도 같이 잰다.
 *
 * ⛔앱을 «안» 띄운다 — js/frame-geometry.js 를 ES 모듈로 올려 진짜 CSS 로 잰다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js group-child-drag-clip
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';

/* 실측값 그대로 — 그룹 716×314, 끌어 옮기는 제목(텍스트프레임) 577×166. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"><style>
  * { box-sizing: border-box; } body { margin:0; }
  .section-inner { position:relative; width:860px; padding:0 72px; }
  .frame-block { position:relative; width:100%; max-width:100%; overflow:hidden;
                 display:flex; flex-direction:column; min-height:60px; }
</style>
<script type="module">
  import { clampChildIntoFrame } from '/frame-geometry.js';
  window.clampChildIntoFrame = clampChildIntoFrame;
  window.__ready = true;
</script>
</head><body>
  <div class="section-inner" id="inner">
    <div class="frame-block" id="grp" data-group="true" data-free-layout="true"
         data-height="314" style="width:100%;height:314px;min-height:314px;padding:0;">
      <div class="frame-block" data-text-frame="true" id="kid"
           style="position:absolute;left:70px;top:148px;width:577px;height:166px;background:#eee;"></div>
    </div>
  </div>
</body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: HARNESS });
    }
    if (url.pathname === '/frame-geometry.js') {
      return route.fulfill({
        contentType: 'application/javascript',
        body: fs.readFileSync(path.join(REPO, 'js/frame-geometry.js'), 'utf8'),
      });
    }
    return route.fulfill({ status: 404, body: '' });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/* 자식을 top 으로 옮긴 뒤 «어디까지 나갔나»와 «화면에서 잡히나»를 같이 잰다.
   clamp=true 면 고침(clampChildIntoFrame)을 거쳐서 옮긴다. */
const moveTo = ({ left, top, clamp }) => {
  const g = document.getElementById('grp');
  const k = document.getElementById('kid');
  let L = left, T = top;
  if (clamp) {
    const c = window.clampChildIntoFrame(left, top, k.offsetWidth, k.offsetHeight, g.offsetWidth, g.offsetHeight);
    L = c.left; T = c.top;
  }
  k.style.left = L + 'px';
  k.style.top  = T + 'px';
  const gr = g.getBoundingClientRect();
  const kr = k.getBoundingClientRect();
  const cx = kr.left + kr.width / 2;
  const cy = kr.top + kr.height / 2;
  const hit = document.elementFromPoint(cx, cy);
  return {
    styleLeft: k.style.left, styleTop: k.style.top,
    beyondBottom: Math.round(kr.bottom - gr.bottom),
    beyondRight:  Math.round(kr.right  - gr.right),
    centerIsKid: !!hit && (hit === k || k.contains(hit)),
    inDoc: document.contains(k),
    frameH: g.style.height,          // 프레임은 «안 커진다» — 이 축의 규약
  };
};

test('음성대조 — 안 죄면 한 칸 끌어내린 자식이 프레임 밖으로 나가 «안 잡힌다»', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(moveTo, { left: 70, top: 288, clamp: false });
  expect(r.styleTop).toBe('288px');
  expect(r.beyondBottom).toBe(140);    // 288 + 166 = 454 > 314 (실앱 실측과 같은 값)
  expect(r.centerIsKid).toBe(false);   // 가운데가 잘려 히트테스트에 안 잡힌다 = 「사라졌다」
  expect(r.inDoc).toBe(true);          // ★지워진 게 아니다 — ⑴ 이 아니라 ⑵ 다
  expect(r.frameH).toBe('314px');      // 프레임은 안 커진다(그게 이 축의 규약이다)
});

test('고침 — 죄고 나면 프레임 «안»에 남고 화면에서도 잡힌다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(moveTo, { left: 70, top: 288, clamp: true });
  expect(r.styleTop).toBe('148px');    // 314 − 166 = 148 이 최대
  expect(r.beyondBottom).toBe(0);
  expect(r.centerIsKid).toBe(true);
  expect(r.frameH).toBe('314px');      // ★죌 뿐 «키우지 않는다» — 넣는 축(growFrameToFitChildren)과 다른 축
});

test('위로도 죈다 — 음수로 끌어올려도 머리가 안 잘린다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(moveTo, { left: -200, top: -120, clamp: true });
  expect(r.styleTop).toBe('0px');
  expect(r.styleLeft).toBe('0px');
  expect(r.centerIsKid).toBe(true);
});

test('가로도 같은 규칙 — 오른쪽으로 밀어도 프레임 폭을 못 넘는다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(moveTo, { left: 9999, top: 0, clamp: true });
  expect(r.styleLeft).toBe('139px');   // 716 − 577 = 139
  expect(r.beyondRight).toBe(0);
  expect(r.centerIsKid).toBe(true);
});

test('자식이 프레임보다 크면 0 — 적어도 머리는 보인다', async ({ page }) => {
  await boot(page);
  const r = await page.evaluate(({ left, top, clamp }) => {
    const k = document.getElementById('kid');
    k.style.height = '900px';   // 프레임(314)보다 큰 자식
    const g = document.getElementById('grp');
    const c = window.clampChildIntoFrame(left, top, k.offsetWidth, k.offsetHeight, g.offsetWidth, g.offsetHeight);
    k.style.left = c.left + 'px'; k.style.top = c.top + 'px';
    const gr = g.getBoundingClientRect(), kr = k.getBoundingClientRect();
    const hit = document.elementFromPoint(kr.left + kr.width / 2, gr.top + 10);
    return { styleTop: k.style.top, topGap: Math.round(kr.top - gr.top), headVisible: !!hit && k.contains(hit) || hit === k };
  }, { left: 70, top: 288, clamp: true });
  expect(r.styleTop).toBe('0px');
  expect(r.topGap).toBe(0);
  expect(r.headVisible).toBe(true);
});
