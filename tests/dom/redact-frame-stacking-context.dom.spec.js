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

test('F1 ★양성대조(고치기 전 메커니즘 확인) — transform 조상 안의 도형(z:3, 프레임은 안 올림)은 조상 밖 text-block(z:2)에 진다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const shp = document.getElementById('shp1');
    // ★.shape-redact 클래스를 빼야 한다 — 지금은 editor-blocks.css의
    //   .frame-block:has(.shape-block.shape-redact) 규칙(F3가 지키는 라이브 고침)이 이
    //   클래스를 보고 frame1을 «자동으로» 끌어올려버려서, "프레임은 안 올린 채 도형만
    //   올린" 순수 메커니즘 재현이 이 클래스를 달고는 더 이상 안 된다(고침이 하네스보다
    //   먼저 개입). 메커니즘 자체(F2/F3와 무관하게 브라우저 스태킹 규칙이 이렇다는 것)만
    //   보이려는 시험이라 클래스를 떼고 z-index만 수동으로 흉내낸다.
    shp.classList.remove('shape-redact');
    shp.style.zIndex = '3';
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

test('F3 ★근본 고침(라이브 화면) — export 클론이 아니라 «편집 화면 그 자체»에서도 프레임 안 redact가 프레임 밖 텍스트를 이긴다', async ({ page }) => {
  // ★a1-a3 지적(②, 가장 심각): e0ba9c7는 export 클론(JS)만 고쳤다 — 편집 화면에서
  //   «선택 안 된» 가림막이 transform 프레임 안에 있고 가릴 글자가 프레임 밖에 있으면,
  //   화면공유·스크린샷에 그대로 노출된다(clone도 export도 없는, 순수 라이브 DOM 문제).
  //   CSS `:has()`(editor-blocks.css .frame-block:has(.shape-block.shape-redact))로
  //   고쳤다 — 브라우저가 DOM 변화마다 자동 재평가하므로 JS 훅이 전혀 필요 없다.
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    // ★.selected 를 «안 준다» — 이게 바로 6c476ef 이전에 "라이브는 안전해 보였던" 이유
    //   (라이브에서 만지는 도형은 보통 selected라 우연히 이겼다)였던 것과 반대 조건이다.
    const shp = document.getElementById('shp1');
    const frame = document.getElementById('frame1');
    const top = document.elementFromPoint(30, 20);
    return {
      topId: top ? top.id : null,
      frameZ: getComputedStyle(frame).zIndex,
      shpSelected: shp.classList.contains('selected'),
    };
  });
  expect(out.shpSelected, '★전제 — 도형이 선택 안 된 상태여야 이 시나리오다').toBe(false);
  expect(out.frameZ, '★:has() 규칙이 프레임 자신의 z-index를 안 끌어올렸다').toBe('3');
  expect(out.topId, '★라이브 화면(편집 중, export 없음)에서도 텍스트가 미선택 redact 도형을 이긴다 — 화면공유·스크린샷 노출').toBe('shp1');
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
