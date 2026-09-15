/* redact-frame-stacking-context.dom.spec.js — T-027 후속: 6c476ef(shape-redact z-index:3)의
 * 잔여 구멍(a1-a3 지적, 2026-09-15). transform이 걸린 조상(예: .frame-block — applyFrameTransform
 * 이 거의 항상 인라인 transform을 쓴다)은 새 스태킹 컨텍스트를 만들어, 그 안의 redact 도형이
 * z-index:3이어도 «조상 밖»의 형제(.text-block 등, z-index:2)와 직접 비교되지 못한다.
 * elementFromPoint 실측으로 CSS 메커니즘 자체를 먼저 확인(z1)했고, 실제 고침은
 * js/io/export-image.js prepareCloneForCapture 가 클론에서 redact 도형의 transform-조상들을
 * 찾아 z-index를 같이 끌어올리는 것 — 이 파일은 «그 함수 자체»를 실행해 검증한다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. export-image.js 를 ES 모듈로
 *   그대로 로드해 prepareCloneForCapture 를 직접 호출한다(document.fonts.ready 외 외부
 *   의존 없음, 이 파일 안에서 확인함).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js redact-frame-stacking
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css' };

const BLOCKS_CSS = fs.readFileSync(path.join(REPO, 'css/editor-blocks.css'), 'utf8');
const LAYOUT_CSS = fs.readFileSync(path.join(REPO, 'css/editor-layout.css'), 'utf8');

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>${LAYOUT_CSS}</style>
          <style>${BLOCKS_CSS}</style>
          </head><body>
          <div class="section-block" id="sec1" style="position:relative;width:400px;height:200px;">
            <!-- ★재현 조건: redact 도형이 transform 걸린 프레임 «안»에, 민감 텍스트는 프레임 «밖»에. -->
            <div class="frame-block" id="frame1" style="position:relative;transform:translate(0px,0px);width:200px;height:100px;">
              <div class="shape-block shape-redact" id="shp1" data-shape-type="rect"
                   data-shape-redact-mode="mosaic"
                   style="position:absolute;left:0;top:0;width:200px;height:60px;"></div>
            </div>
            <div class="text-block" id="txt1" style="position:absolute;left:10px;top:10px;">민감 900101-1234567</div>
          </div>
          </body></html>`,
      });
    }
    if (url.pathname === '/js/io/export-image.js') {
      return route.fulfill({ contentType: 'text/javascript', body: fs.readFileSync(path.join(REPO, 'js/io/export-image.js')) });
    }
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  return errs;
}

test('F1 ★양성대조(고치기 전 메커니즘 확인) — transform 조상 안의 redact(z:3)는 조상 밖 text-block(z:2)에 진다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const shp = document.getElementById('shp1');
    shp.style.zIndex = '3'; // editor-blocks.css 규칙과 같은 값을 직접 흉내(prepareCloneForCapture 개입 없이)
    // (30,20): frame1(0-200,0-100) 안, shp1(0-60) 안, txt1(10,10 부근) 겹치는 지점.
    const top = document.elementFromPoint(30, 20);
    return { topId: top ? top.id : null };
  });
  expect(out.topId, '★양성대조 실패 — 스태킹 컨텍스트 격리 자체가 이 하네스에서 재현 안 됨(테스트 신뢰 불가)').toBe('txt1');
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('F1b ★메커니즘 확인 — 조상(frame1) 자신의 z-index만 끌어올려도 충분하다(도형 z-index는 그대로 auto/미지정이어도)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    document.getElementById('frame1').style.zIndex = '3';
    const top = document.elementFromPoint(30, 20);
    return { topId: top ? top.id : null };
  });
  expect(out.topId, '★조상 z-index 만 올려도 안쪽 redact 도형이 밖의 text-block 을 이겨야 한다').toBe('shp1');
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('F2 ★고침 — prepareCloneForCapture 를 거친 클론에서는 redact 도형이 조상 밖 text-block을 이긴다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(async () => {
    const { prepareCloneForCapture } = await import('/js/io/export-image.js');
    const sec = document.getElementById('sec1');
    const clone = await prepareCloneForCapture(sec, 400, false);
    // ★원본 sec1은 clone과 별개로 문서에 그대로 남아있다(실제 export도 원본을 안 건드린다) —
    // 원본을 그대로 두고 clone만 화면 안으로 옮기면 같은 좌표에 «둘 다» 걸려 원본이 잡힐 수
    // 있다(실측: 처음엔 이래서 오탐이 났다 — 원본의 손 안 댄 txt1이 잡힌 것이었다). 검증
    // 목적으로만 원본을 잠깐 치워둔다(clone/export 로직과 무관, 테스트 격리용).
    sec.style.display = 'none';
    // 클론은 export 정책대로 position:fixed;top:-99999px 로 화면 밖에 붙는다(실제 export는
    // CDP captureBeyondViewport/html2canvas offscreen 렌더로 그 상태 그대로 찍지만,
    // elementFromPoint 는 «뷰포트 안»만 본다 — 검증 목적으로 잠깐 화면 안으로 옮겨서 찍는다.
    // z-index·DOM 구조는 건드리지 않으므로 스태킹 판정 결과는 동일하다.
    clone.style.top = '0px';
    const cloneRect = clone.getBoundingClientRect();
    const shp = clone.querySelector('#shp1');
    const txt = clone.querySelector('#txt1');
    const top = document.elementFromPoint(cloneRect.left + 30, cloneRect.top + 20);
    const frame = clone.querySelector('#frame1');
    const result = {
      topId: top ? top.id : null,
      topIsCloneTxt: top === txt,
      topIsCloneShp: top === shp,
      shpZ: shp.style.zIndex,
      frameZ: frame.style.zIndex,
      selectedStripped: !clone.classList.contains('selected') && !shp.classList.contains('selected'),
    };
    clone.remove(); // 정리
    sec.style.display = ''; // 원본 복원
    return result;
  });
  expect(out.frameZ, '★prepareCloneForCapture 가 transform 걸린 조상(frame1)의 z-index 를 끌어올리지 않았다').toBe('3');
  expect(out.topIsCloneTxt, '★회귀 — 클론 자신의 text-block이 클론 자신의 redact 도형 위에 그려진다').toBe(false);
  expect(out.topIsCloneShp, '★클론의 redact 도형(또는 프레임)이 최상단이 아니다').toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
