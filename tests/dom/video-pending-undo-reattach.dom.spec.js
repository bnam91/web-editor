/* video-pending-undo-reattach.dom.spec.js — T-033: video-pending 상태에서 트림하다 ⌘Z 하면
 * «트림이 아니라 영상 자체»가 사라지던 회귀의 원문 게이트. (2026-09-15)
 *
 * ★배경
 *   T-012 는 video-pending(트림 확정 전 임시 상태)이 저장본·undo 스냅샷에 원본 영상 data URL을
 *   통째로 영구 저장하는 걸 막으려고 serializeCleanRoot 가 video-pending 블록을 "빈 업로드대기"
 *   로 되돌리게 했다. 그런데 pushHistory 도 «같은» getSerializedCanvas → serializeCleanRoot 를
 *   거친다 — 그래서 트림 핸들을 드래그할 때마다(js/props/asset-video-trim.js pushHistory) 찍히는
 *   undo 스냅샷도 전부 "빈 에셋"이 되어, ⌘Z 한 번에 트림 위치가 아니라 영상 자체가 사라진다.
 *
 * ★고침
 *   js/io/section-serialize.js 에 세션 한정 런타임 캐시(_videoPendingCache, block.id 키)를 두고
 *   지우기 «직전»에 원본(imgSrc/fit/trimIn/trimOut/playbackRate)을 캡처한다. undo/redo 로 캔버스가
 *   갈린 뒤(js/history.js restoreSnapshot/restoreSnapshotScoped 가 rebindAll 직후) 호출하는
 *   reattachVideoPendingBlocks 가 그 캐시로 원본을 다시 붙인다. 진짜 파일 리로드(새 세션)는
 *   캐시가 비어 있어 자연히 "빈 업로드대기"(T-031 의도된 동작)로 떨어진다 — 그걸 T3 이 잰다.
 *   같은 자리에서 그레인(.asset-grain)이 video-pending 세척에 같이 빠지던 부수피해도 고쳤다 — T4.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. section-serialize.js 만 얹는다
 *   (template-marker-leak.dom.spec.js 와 같은 하네스).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js video-pending-undo
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const SER_SRC = fs.readFileSync(path.join(REPO, 'js/io/section-serialize.js'), 'utf8');

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas"></div></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.addScriptTag({ content: SER_SRC });   // index.html:993 과 같은 계약(플레인 스크립트)
  // reattachVideoPendingBlocks 가 부르는 두 전역 — 실앱에선 image-handling.js/block-drag.js 가 단다.
  await page.evaluate(() => {
    window.__clearCalls = 0;
    window.__bindCalls = 0;
    window.clearAssetImage = () => { window.__clearCalls++; };
    window.bindBlock = () => { window.__bindCalls++; };
  });
  return errs;
}

const IMG_SRC = 'data:video/mp4;base64,AAAAAAAAA'; // 실제 재생 불가한 더미 — 데이터 왕복만 잰다

function fixture() {
  return `
<div class="section-block" id="sec1">
  <div class="section-inner">
    <div class="asset-block has-image" id="ab_1" data-asset-type="video-pending"
         data-img-src="${IMG_SRC}" data-fit="cover" data-trim-in="0" data-trim-out="4.2">
      <div class="asset-img-clip"><video class="asset-img asset-video" src="${IMG_SRC}" muted loop playsinline></video></div>
      <button class="asset-overlay-clear" title="영상 제거">✕</button>
      <div class="asset-overlay" style="color:#fff">문구</div>
      <div class="asset-grain" style="opacity:0.4" data-grain-intensity="35"></div>
    </div>
  </div>
</div>`;
}

test('T0 ★픽스처가 살아 있다 — 아래 초록이 빈 입력의 초록이 아니다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((fx) => {
    document.getElementById('canvas').innerHTML = fx;
    const ab = document.getElementById('ab_1');
    return { imgSrc: ab.dataset.imgSrc, grain: !!ab.querySelector('.asset-grain') };
  }, fixture());
  expect(out.imgSrc).toBeTruthy();
  expect(out.grain).toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('T1 ★pushHistory 스냅샷(serializeCleanRoot 결과)엔 원본이 없다 — T-012 안전장치가 여전히 산다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((fx) => {
    document.getElementById('canvas').innerHTML = fx;
    const clone = document.getElementById('canvas').cloneNode(true);
    window.serializeCleanRoot(clone);
    return clone.innerHTML;
  }, fixture());
  expect(out, '★스냅샷 문자열에 원본 video data URL 이 실렸다 — T-012 회귀').not.toContain(IMG_SRC);
  expect(out, '★data-img-src 자체가 남아있다').not.toContain('data-img-src');
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('T2 ★⌘Z 재현 — 트림 2번(pushHistory 2회) 뒤 undo 로 캔버스가 "빈 스냅샷"으로 갈려도, ' +
     'reattachVideoPendingBlocks 가 마지막 트림값까지 정확히 되살린다', async ({ page }) => {
  const errs = await boot(page);
  const result = await page.evaluate((fx) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = fx;

    // pushHistory #1 — 트림 IN 드래그(예: 0 → 0.5)
    document.getElementById('ab_1').dataset.trimIn = '0.5';
    let clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);

    // pushHistory #2 — 트림 OUT 드래그(예: 4.2 → 3.1). ★undo 가 되돌아갈 "직전 상태" 스냅샷.
    document.getElementById('ab_1').dataset.trimOut = '3.1';
    clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const snap = clone.innerHTML; // ← historyStack 에 실제로 찍히는 문자열과 동일

    // ⌘Z — js/history.js restoreSnapshot 과 같은 수순: 캔버스를 스냅샷으로 통째 교체.
    canvas.innerHTML = snap;
    const abAfterRestore = document.getElementById('ab_1');
    const buggedGone = !abAfterRestore.dataset.imgSrc; // ★고치기 전엔 여기서 영상이 이미 사라져 있다

    // js/history.js 가 rebindAll 직후 부르는 자리.
    window.reattachVideoPendingBlocks(canvas);

    const ab = document.getElementById('ab_1');
    return {
      buggedGone,
      imgSrcRestored: ab.dataset.imgSrc,
      trimIn: ab.dataset.trimIn,
      trimOut: ab.dataset.trimOut,
      hasImage: ab.classList.contains('has-image'),
      videoSrc: ab.querySelector('.asset-video')?.getAttribute('src') || null,
      overlayText: ab.querySelector('.asset-overlay')?.textContent || null,
      grainStyle: ab.querySelector('.asset-grain')?.getAttribute('style') || null,
      grainIntensity: ab.querySelector('.asset-grain')?.dataset.grainIntensity || null,
      bindCalls: window.__bindCalls,
    };
  }, fixture());

  expect(result.buggedGone, '★캔버스 교체 직후엔(reattach 전) 영상이 빈 상태다 — 회귀 전제 확인').toBe(true);
  expect(result.imgSrcRestored, '★reattach 후에도 원본 영상이 안 돌아왔다 — 데이터손실 재현').toBe(IMG_SRC);
  expect(result.trimIn, '★트림 IN 이 되돌아간 게 아니라 «최신값»으로 남아야 한다(undo 는 이 스냅샷 자체를 향해 도착)').toBe('0.5');
  expect(result.trimOut, '★트림 OUT 도 마지막 드래그값이 그대로 붙어야 한다').toBe('3.1');
  expect(result.hasImage).toBe(true);
  expect(result.videoSrc, '★<video> 엘리먼트 자체가 다시 안 생겼다').toBe(IMG_SRC);
  expect(result.overlayText, '★오버레이 문구가 소실됐다').toBe('문구');
  expect(result.grainStyle, '★그레인 스타일이 소실됐다').toBe('opacity:0.4');
  expect(result.grainIntensity, '★그레인 강도가 소실됐다').toBe('35');
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('T3 ★진짜 리로드(새 세션·캐시 없음)는 reattach 가 손대지 않는다 — T-031 의도된 "빈 업로드대기" 유지', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    // ★이 page 는 방금 새로 boot 됐다 — _videoPendingCache 는 비어 있다(캡처를 한 번도 안 했다).
    // 아래 HTML 은 serializeCleanRoot 가 실제로 만드는 "빈 업로드대기" 모양 그대로다(T1/T4 로
    // 이미 검증됨) — data-asset-type 도 삭제 목록에 있어 실제 스냅샷엔 안 남는다.
    canvas.innerHTML = `
      <div class="section-block" id="sec1"><div class="section-inner">
        <div class="asset-block" id="ab_1">
          <div class="asset-overlay" style="color:#fff">문구</div>
          <div class="asset-grain" style="opacity:0.4" data-grain-intensity="35"></div>
        </div>
      </div></div>`;
    window.reattachVideoPendingBlocks(canvas);
    const ab = document.getElementById('ab_1');
    return { imgSrc: ab.dataset.imgSrc || null, hasImage: ab.classList.contains('has-image') };
  });
  expect(out.imgSrc, '★캐시가 없는데도 원본이 나타났다 — 있어선 안 될 출처').toBeNull();
  expect(out.hasImage, '★캐시 없이도 has-image 가 켜졌다').toBe(false);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('T4 ★부수피해 — 섹션 복사/템플릿 저장 경로(serializeSectionClone)도 그레인을 함께 보존한다', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((fx) => {
    document.getElementById('canvas').innerHTML = fx;
    const sec = document.getElementById('sec1');
    return window.serializeSectionClone(sec);
  }, fixture());
  expect(out, '★섹션 클론 세척본에 그레인이 빠졌다(부수피해 미수정)').toContain('asset-grain');
  expect(out, '★그레인 강도값도 같이 빠졌다').toContain('35');
  expect(out, '★video-pending 원본은 여전히 안 실려야 한다(이건 의도된 세척)').not.toContain(IMG_SRC);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});
