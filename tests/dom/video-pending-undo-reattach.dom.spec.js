/* video-pending-undo-reattach.dom.spec.js — T-031: video-pending 상태에서 트림하다 ⌘Z 하면
 * «트림이 아니라 영상 자체»가 사라지던 회귀의 원문 게이트. (2026-09-15, 2차수정 스냅샷스코프)
 *
 * ★배경
 *   T-012 는 video-pending(트림 확정 전 임시 상태)이 저장본·undo 스냅샷에 원본 영상 data URL을
 *   통째로 영구 저장하는 걸 막으려고 serializeCleanRoot 가 video-pending 블록을 "빈 업로드대기"
 *   로 되돌리게 했다. 그런데 pushHistory 도 «같은» getSerializedCanvas → serializeCleanRoot 를
 *   거친다 — 그래서 트림 핸들을 드래그할 때마다(js/props/asset-video-trim.js pushHistory) 찍히는
 *   undo 스냅샷도 전부 "빈 에셋"이 되어, ⌘Z 한 번에 트림 위치가 아니라 영상 자체가 사라진다.
 *
 * ★고침(1차 → 2차)
 *   1차: js/io/section-serialize.js 에 세션 한정 전역 Map(_videoPendingCache, block.id 키)을
 *   두고 지우기 직전 원본을 캐시, reattachVideoPendingBlocks 가 되살렸다. 그런데 a1-a3 코드리뷰가
 *   전역 last-write-wins 구조의 구멍을 찾았다 — 지운 영상 → 무관한 편집 → ⌘Z 한 번(=그 편집만
 *   취소해야 정상)에도 «이미 지운» 영상이 되살아나고, 트림을 여러 번 고친 뒤 되돌려도 구간이
 *   «그 시점 값»이 아니라 «최신 값»으로 붙었다.
 *   2차: 전역 캐시를 없애고, getLastVideoPendingSidecar()가 «바로 직전 serializeCleanRoot
 *   호출 하나»가 발견한 것만 돌려주게 했다 — 호출자(history.js pushHistory/init, save-load.js
 *   flushCurrentPage)가 자기 스냅샷/페이지 객체에 videoPendingSidecar로 붙여 «그 시점 전용»으로
 *   들고 다닌다. reattachVideoPendingBlocks(root, sidecar)는 이제 sidecar 를 «명시적으로»
 *   받아야 하고(2번째 인자 필수 — 안 주면 아무것도 안 한다, fail-closed), 그 스냅샷 자신의
 *   sidecar 만 쓰므로 무관한 스냅샷을 복원할 땐 되살아나지 않는다.
 *   진짜 파일 리로드(새 세션)는 sidecar 필드 자체가 없어 자연히 "빈 업로드대기"(T-031 의도된
 *   동작)로 떨어진다 — 그걸 T3 이 잰다. 같은 자리에서 그레인(.asset-grain)이 video-pending
 *   세척에 같이 빠지던 부수피해도 고쳤다 — T4.
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
    // ★2차수정: history.js pushHistory 는 getSerializedCanvas() 직후 같은 동기 구간에서
    // getLastVideoPendingSidecar() 를 읽어 이 스냅샷 «자신»에 붙인다 — 여기서도 같은 타이밍으로
    // 읽어야 한다(늦게 읽으면 다음 serializeCleanRoot 호출에 덮어써질 수 있다).
    const sidecar = window.getLastVideoPendingSidecar();

    // ⌘Z — js/history.js restoreSnapshot 과 같은 수순: 캔버스를 스냅샷으로 통째 교체.
    canvas.innerHTML = snap;
    const abAfterRestore = document.getElementById('ab_1');
    const buggedGone = !abAfterRestore.dataset.imgSrc; // ★고치기 전엔 여기서 영상이 이미 사라져 있다

    // js/history.js 가 rebindAll 직후 부르는 자리 — 이 스냅샷 자신의 sidecar 만 넘긴다.
    window.reattachVideoPendingBlocks(canvas, sidecar);

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

test('T3 ★진짜 리로드(새 세션·sidecar 없음)는 reattach 가 손대지 않는다 — T-031 의도된 "빈 업로드대기" 유지', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    // ★이 page 는 방금 새로 boot 됐다 — 이 시나리오엔 sidecar 자체가 없다(캡처를 한 번도 안
    // 했다 — 진짜 파일에서 로드한 데이터에도 videoPendingSidecar 필드가 없는 것과 같은 모양).
    // 아래 HTML 은 serializeCleanRoot 가 실제로 만드는 "빈 업로드대기" 모양 그대로다(T1/T4 로
    // 이미 검증됨) — data-asset-type 도 삭제 목록에 있어 실제 스냅샷엔 안 남는다.
    canvas.innerHTML = `
      <div class="section-block" id="sec1"><div class="section-inner">
        <div class="asset-block" id="ab_1">
          <div class="asset-overlay" style="color:#fff">문구</div>
          <div class="asset-grain" style="opacity:0.4" data-grain-intensity="35"></div>
        </div>
      </div></div>`;
    window.reattachVideoPendingBlocks(canvas, undefined); // ★applyProjectData/협업패치처럼 sidecar 없이 부르는 경우
    const ab = document.getElementById('ab_1');
    return { imgSrc: ab.dataset.imgSrc || null, hasImage: ab.classList.contains('has-image') };
  });
  expect(out.imgSrc, '★sidecar 가 없는데도 원본이 나타났다 — 있어선 안 될 출처').toBeNull();
  expect(out.hasImage, '★sidecar 없이도 has-image 가 켜졌다').toBe(false);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('T5 ★2차수정 핵심 — 지운 영상 → 무관한 편집(pushHistory) → 그 편집만 ⌘Z 해도 영상이 되살아나지 «않는다» (a1-a3 지적 회귀)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((fx) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = fx;

    // S1 — clearAssetImage 가 지우기 «직전» 부르는 pushHistory: 아직 video-pending이라
    // 이 스냅샷의 sidecar엔 원본이 실린다(= "지운 것을 즉시 ⌘Z로 되돌리기" 위한 정상 캡처).
    let clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const s1Sidecar = window.getLastVideoPendingSidecar();

    // 실제 지우기(clearAssetImage 가 하는 일 그대로 — dataset 클리어 + 빈 오버레이만 남김).
    const ab = document.getElementById('ab_1');
    ab.classList.remove('has-image');
    ['imgSrc','fit','imgW','imgX','imgY','imgPosition','assetType','trimIn','trimOut','playbackRate']
      .forEach(k => delete ab.dataset[k]);
    ab.innerHTML = '<div class="asset-overlay" style="color:#fff">문구</div>';

    // S2 — 무관한 편집(예: 다른 텍스트 수정)의 pushHistory. 이 블록은 이미 안 비어있는
    // video-pending 이 아니므로(assetType 없음) 이 스윕은 이 id 를 sidecar에 «안 담는다».
    clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const s2Snap = clone.innerHTML;
    const s2Sidecar = window.getLastVideoPendingSidecar();

    // ⌘Z 한 번 — S2 를 복원(= "무관한 편집"만 취소하는 게 정상). S1 이 아니라 S2 의 sidecar 를 써야 한다.
    canvas.innerHTML = s2Snap;
    window.reattachVideoPendingBlocks(canvas, s2Sidecar);
    const afterOneUndo = document.getElementById('ab_1');

    return {
      s1HadIt: !!s1Sidecar['ab_1'],
      s2HasIt: !!s2Sidecar['ab_1'],
      imgSrcAfterOneUndo: afterOneUndo.dataset.imgSrc || null,
      hasImageAfterOneUndo: afterOneUndo.classList.contains('has-image'),
    };
  }, fixture());

  expect(out.s1HadIt, '★전제 확인 — 지우기 직전 스냅샷(S1)엔 원본이 있어야 한다(즉시 ⌘Z 복구용)').toBe(true);
  expect(out.s2HasIt, '★전제 확인 — 지운 뒤의 스냅샷(S2)엔 원본이 없어야 한다').toBe(false);
  expect(out.imgSrcAfterOneUndo, '★회귀 — 무관한 편집 하나만 ⌘Z 했는데 지운 영상이 되살아났다').toBeNull();
  expect(out.hasImageAfterOneUndo, '★회귀 — has-image 가 잘못 켜졌다').toBe(false);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('T6 ★대조 — 지운 직후 «그 자리에서» ⌘Z 하면(S1 복원) 정상적으로 되살아난다(toast "⌘Z로 되돌리기" 약속 유지)', async ({ page }) => {
  const errs = await boot(page);
  const out = await page.evaluate((fx) => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = fx;

    let clone = canvas.cloneNode(true);
    window.serializeCleanRoot(clone);
    const s1Snap = clone.innerHTML;
    const s1Sidecar = window.getLastVideoPendingSidecar();

    const ab = document.getElementById('ab_1');
    ab.classList.remove('has-image');
    ['imgSrc','fit','imgW','imgX','imgY','imgPosition','assetType','trimIn','trimOut','playbackRate']
      .forEach(k => delete ab.dataset[k]);
    ab.innerHTML = '<div class="asset-overlay" style="color:#fff">문구</div>';

    // ⌘Z 한 번 — 지우기 자체를 취소(S1 복원).
    canvas.innerHTML = s1Snap;
    window.reattachVideoPendingBlocks(canvas, s1Sidecar);
    const restored = document.getElementById('ab_1');
    return { imgSrc: restored.dataset.imgSrc || null };
  }, fixture());

  expect(out.imgSrc, '★지운 직후 첫 ⌘Z 가 원본을 못 살렸다 — toast 의 약속이 깨졌다').toBe(IMG_SRC);
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
