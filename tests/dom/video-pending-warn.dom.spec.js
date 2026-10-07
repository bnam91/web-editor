/* video-pending-warn.dom.spec.js — 「미확정 영상 알림」이 진짜 DOM 에서 뜨고, 안 떠야 할 때 안 뜨는가.
 *
 * ★왜 생겼나 (T-032, 2026-09-21)
 *   영상을 넣고 «GIF로 적용»을 안 한 채 나가면 원본이 저장에서 빠진다(js/io/section-serialize.js
 *   T-012 세척). 알림이 «홈으로 나가기»·«블럭 선택 해제» 두 곳에만 있어서, 창을 닫거나 ⌘S 를
 *   누르면 아무 말도 없었다(실앱 9551 재현: ⌘S 토스트가 '💾 저장됨' 하나뿐).
 *
 * ★2026-09-22 (T-032 마무리) — 카드의 «핵심»인 「한 번만」을 여기서 «센다».
 *   고치기 전 실측(dev 12865a1, 포트 9643): 선택했다 풀기 5회 → 알림 5회 · ⌘S 3회 → 알림 3회.
 *   P6 이 그 횟수를 못박고, P7(영상 없음)·P8(같은 블럭에 다른 영상)이 «반대 방향»을 막는다 —
 *   래치가 너무 세면 영영 침묵하고(P8), 너무 약하면 다시 잔소리가 된다(P6).
 *
 * ★여기서 재는 것 = «판정과 문구» 그 자체 (js/io/pending-video-warn.js)
 *   배선(어느 자리가 이걸 부르나)은 tests/unit/video-pending-warn.test.mjs 가 소스로 못박는다.
 *   ⚠️창 닫기는 메인 프로세스 경로라 여기서 못 잰다 — 못 잰 축(단위검사 S-3 가 소스로만 막는다).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(asset-panel-min-scale.dom.spec.js 와 같은 부팅).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js video-pending-warn
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas"></div>
<script type="module">
  import { hasPendingVideo, warnPendingVideoLoss, warnPendingVideoLossIf, resetPendingVideoWarnLatch,
           PENDING_VIDEO_MSG, PENDING_VIDEO_SELECTOR }
    from '/js/io/pending-video-warn.js';
  window.__toasts = [];
  window.showToast = (m) => { window.__toasts.push(String(m)); };
  window.__api = { hasPendingVideo, warnPendingVideoLoss, warnPendingVideoLossIf, resetPendingVideoWarnLatch,
                   PENDING_VIDEO_MSG, PENDING_VIDEO_SELECTOR };
  /* 실제 에셋 블록과 «같은 성질»로 만든다 — js/image-handling.js setAssetVideoFromSrc 가 붙이는 것.
     src 는 원본 dataURL 자리(dataset.imgSrc) — 「한 번만」 래치가 여기서 신원을 뽑는다. */
  window.__mk = (kind, src) => {
    const c = document.getElementById('canvas');
    c.innerHTML = '';
    const ab = document.createElement('div');
    ab.className = 'asset-block has-image';
    if (kind === 'video') { ab.dataset.assetType = 'video-pending'; ab.dataset.imgSrc = src || 'data:video/mp4;base64,AAAA'; }
    c.appendChild(ab);
    return ab;
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

test.describe('미확정 영상 알림 — 뜰 때 뜨고, 안 뜰 때 안 뜬다', () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test('P1 미확정 영상이 있으면 알린다 — 「알렸다」를 돌려준다', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.__mk('video');
      window.__toasts.length = 0;
      const warned = window.__api.warnPendingVideoLossIf(document.getElementById('canvas'));
      return { warned, toasts: window.__toasts.slice(), msg: window.__api.PENDING_VIDEO_MSG };
    });
    expect(r.warned, '알렸다를 안 돌려준다 — 부르는 쪽이 900ms 를 못 준다').toBe(true);
    expect(r.toasts).toEqual([r.msg]);
    expect(r.msg).toContain('GIF로 적용되지 않았습니다');
    expect(r.msg).toContain('사라집니다');
  });

  test('P2 ★음성대조 — 적용이 끝난(=성질이 없는) 블록에서는 «한 번도» 안 뜬다', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.__mk('image');
      window.__toasts.length = 0;
      const warned = window.__api.warnPendingVideoLossIf(document.getElementById('canvas'));
      return { warned, toasts: window.__toasts.slice(), has: window.__api.hasPendingVideo(document.getElementById('canvas')) };
    });
    expect(r.has).toBe(false);
    expect(r.warned).toBe(false);
    expect(r.toasts, '적용을 끝냈는데 잔소리가 뜬다').toEqual([]);
  });

  test('P3 ★잔소리 금지 — «편집 중»(성질 그대로)에는 아무도 안 부르므로 0건', async ({ page }) => {
    /* 구간 슬라이더는 dataset.trimIn/Out 만 바꾼다(js/props/asset-video-trim.js).
       성질(video-pending)은 그대로다 — 그래도 알림은 «떠나는 자리»에서만 나야 한다.
       여기서는 「슬라이더가 여러 번 움직여도 알림 함수가 스스로 뜨지 않는다」를 못박는다. */
    const r = await page.evaluate(() => {
      const ab = window.__mk('video');
      window.__toasts.length = 0;
      for (let i = 0; i < 8; i++) {
        ab.dataset.trimIn = String(i * 0.1);
        ab.dataset.trimOut = String(1 + i * 0.1);
        ab.dispatchEvent(new Event('input', { bubbles: true }));
        ab.dispatchEvent(new Event('change', { bubbles: true }));
      }
      return { toasts: window.__toasts.slice(), still: window.__api.hasPendingVideo(document.getElementById('canvas')) };
    });
    expect(r.still, '전제가 깨졌다 — 슬라이더 조작으로 성질이 사라졌다').toBe(true);
    expect(r.toasts, '구간 슬라이더를 만질 때마다 잔소리가 뜬다').toEqual([]);
  });

  test('P4 root 가 없거나 이상해도 던지지 않는다 — 알림이 앱을 멈추면 안 된다', async ({ page }) => {
    const r = await page.evaluate(() => ({
      nul: window.__api.hasPendingVideo(null),
      und: window.__api.hasPendingVideo(undefined),
      junk: window.__api.hasPendingVideo({}),
    }));
    expect(r).toEqual({ nul: false, und: false, junk: false });
  });

  test('P5 window 통로가 열려 있다 — 메인 프로세스(창 닫기)가 이걸 부른다', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.__mk('video');
      window.__toasts.length = 0;
      /* main.js mainWindow.on('close') 가 executeJavaScript 로 «그대로» 넣는 식 */
      const asked = (window.hasPendingVideo?.() && window.warnPendingVideoLoss?.()) === true;
      return { asked, toasts: window.__toasts.slice() };
    });
    expect(r.asked, 'window.hasPendingVideo / warnPendingVideoLoss 통로가 닫혔다 — 창 닫기 알림이 죽는다').toBe(true);
    expect(r.toasts.length).toBe(1);
  });

  /* ══ 「한 번만」 — 카드의 핵심 ═══════════════════════════════════════════════
     ⚠️둘 다 있어야 뜻이 있다: «되풀이해도 한 번»(P6)과 «없으면 아예 안 뜸»(P7).
       P6 만 있으면 「아무 때도 안 뜨게」 만들어도 초록이고, P7 만 있으면 잔소리가 돌아온다. */

  test('P6 ★되풀이해도 «한 번만» — 같은 미확정 영상으로 5번 불러도 알림은 1회', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.__api.resetPendingVideoWarnLatch();
      window.__mk('video', 'data:video/mp4;base64,ONEONEONE');
      const canvas = document.getElementById('canvas');
      const returned = [];
      for (let i = 0; i < 5; i++) returned.push(window.__api.warnPendingVideoLossIf(canvas));
      return { toasts: window.__toasts.slice(), returned, msg: window.__api.PENDING_VIDEO_MSG };
    });
    expect(r.toasts.length, `5번 불렀는데 알림이 ${r.toasts.length}회 떴다 — 「한 번만」이 아니다`).toBe(1);
    expect(r.toasts[0]).toBe(r.msg);
    /* 돌려주는 값도 한 번만 true 여야 한다 — goHome 이 이걸로 「900ms 늦출지」를 정한다 */
    expect(r.returned, '「알렸나」가 매번 true 다 — 부르는 쪽이 매번 이동을 늦춘다').toEqual([true, false, false, false, false]);
  });

  test('P7 ★음성대조 — 미확정 영상이 «없으면» 몇 번을 불러도 0회', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.__api.resetPendingVideoWarnLatch();
      window.__mk('image');                       // 영상이 아니다(적용 끝났거나 그냥 이미지)
      const canvas = document.getElementById('canvas');
      const returned = [];
      for (let i = 0; i < 5; i++) returned.push(window.__api.warnPendingVideoLossIf(canvas));
      return { toasts: window.__toasts.slice(), returned, has: window.__api.hasPendingVideo(canvas) };
    });
    expect(r.has, '이미지 블록을 미확정 영상으로 본다 — 판정이 성질을 안 본다').toBe(false);
    expect(r.toasts, '영상이 없는데 알렸다 — 카드가 「새 결함」이라 부른 바로 그것이다').toEqual([]);
    expect(r.returned).toEqual([false, false, false, false, false]);
  });

  test('P8 ★역방향 — 같은 블럭에 «다른» 영상을 다시 넣으면 래치가 풀려 한 번 더 알린다', async ({ page }) => {
    const r = await page.evaluate(() => {
      window.__api.resetPendingVideoWarnLatch();
      const canvas = document.getElementById('canvas');
      const ab = window.__mk('video', 'data:video/mp4;base64,FIRSTVIDEO');
      ab.id = 'ab_same';
      window.__api.warnPendingVideoLossIf(canvas);
      const afterFirst = window.__toasts.length;

      /* ① 적용/삭제로 미확정이 사라진 «사이» — 여기서 알리면 안 된다 */
      delete ab.dataset.assetType;
      window.__api.warnPendingVideoLossIf(canvas);
      const afterApplied = window.__toasts.length;

      /* ② «같은 블럭 id» 에 다른 영상을 넣는다 — id 로 래치를 걸었다면 여기서 침묵한다(거짓 음성) */
      ab.dataset.assetType = 'video-pending';
      ab.dataset.imgSrc = 'data:video/mp4;base64,SECONDVIDEO-DIFFERENT';
      window.__api.warnPendingVideoLossIf(canvas);
      window.__api.warnPendingVideoLossIf(canvas);
      return { afterFirst, afterApplied, afterSecond: window.__toasts.length, sameId: ab.id };
    });
    expect(r.afterFirst, '첫 영상에 안 알렸다').toBe(1);
    expect(r.afterApplied, '미확정이 아닌데 알렸다').toBe(1);
    expect(r.afterSecond, '같은 블럭의 «다른» 영상에 영영 침묵한다 — 래치를 블럭 id 로 걸었다').toBe(2);
  });

  /* ═══════════════════════════════════════════════════════════════════════════
     P9 ★★«같은» 영상 — ★P8 의 ★빈칸이다 (T-032 거짓음성, 2026-09-22 검수 · 2026-10-07 지음)
     ★왜 ★P8 이 ★있는데도 ★이 구멍이 ★15일 살았나:
       ★P8 은 ★★«다른» 영상이다. 그리고 그 ①단계에서 `delete ab.dataset.assetType` 로
       ★미확정을 ★없애므로 ★identity 가 ★비고 ⇒ `warnPendingVideoLossIf` 가 ★스스로 래치를 푼다
       (`pending-video-warn.js:73` 「없다 ⇒ 안 알리고 래치도 푼다」).
       ⇒ ★★★P8 은 `resetPendingVideoWarnLatch` 를 ★★거치지 않고도 ★초록이었다.
       ⇒ ★★그 초록이 「래치 풀기는 검사됐다」로 읽혔다 — ★★«한 축의 초록이 ★다른 축의 0건을 가린다».
     ★★이 검사가 재는 것 = ★★«신원이 ★그대로»인 채로 ★★명시적 해제만으로 ★다시 알리나.
       ⇒ ⛔dataset 을 ★지우지 않는다. 지우면 ★위의 ★다른 길이 ★래치를 풀어
         ★★«무엇이 풀었나»가 ★안 갈린다(★P8 이 그 꼴이다).
     ★★★사슬이 ★둘로 나뉘어 있다 — ★어느 한 짝이 죽으면 ★버그가 ★되살아난다:
       ⑴ `tests/unit/video-pending-warn.test.mjs` S-12/S-13 = ★`clearAssetImage` 가
          `resetPendingVideoWarnLatch` 를 ★«부르나»(★소스로 잰다)
       ⑵ ★★이 P9 = ★그 함수가 ★«실제로 래치를 ★푸나»(★동작으로 잰다)
       ⛔둘 중 하나만으로는 ★막히지 않는다. ★한쪽을 지울 땐 ★다른 쪽도 보라.
     ⚠️★이 하네스로 ★«못» 재는 것: `clearAssetImage` 자체(`js/image-handling.js:792`)는
       ★plain 전역이라(`:1517` `window.clearAssetImage =`) ★이 ESM 하네스에 ★못 싣는다
       ⇒ ★그 배선은 ⑴ 이 맡는다. ★저장본에 `data:video` 가 남나(=★진짜 손실)도 ★여기서 못 잰다
       — ★`bootApp` 판이 필요하다(★별건으로 올렸다).
     ═══════════════════════════════════════════════════════════════════════════ */
  test('P9 ★★«같은» 영상도 ★해제가 있으면 ★한 번 더 알린다 — ⛔해제가 없으면 ★침묵(그게 그 버그)', async ({ page }) => {
    const r = await page.evaluate(() => {
      const canvas = document.getElementById('canvas');
      /* ★★두 길의 ★신원을 ★«다르게» 둔다 — ⒜ 가 남긴 래치가 ⒝ 의 ★첫 경고를 막지 않게.
         ⚠️2026-10-07: 처음엔 둘을 ★같은 신원으로 두고 ⒝ 시작에 ★해제를 불러 바닥을 쓸었다.
           ★그 해제가 ★바로 ★양성대조로 ★무력화하는 그 함수라, 변이판에서 ★`b1`(★전제)이 ★0 이 되어
           ★★«주 단언 b2 를 ★재기 전에» 터졌다 ⇒ ★양성대조가 ★무엇을 잠그는지 ★증명 못 했다.
         ⇒ ★★«바닥을 ★피검 대상으로 쓰지 마라» — ★두 길을 ★신원으로 ★독립시킨다. */
      const SAME_A = 'data:video/mp4;base64,SAMEVIDEO-A';
      const SAME_B = 'data:video/mp4;base64,SAMEVIDEO-B-DIFFERENT-IDENTITY';

      /* ⒜ ★해제를 ★«안» 부르는 길 — ★★버그 ★재현. 신원이 같으니 ★침묵해야 한다 */
      window.__mk('video', SAME_A);
      window.__toasts.length = 0;
      window.__api.warnPendingVideoLossIf(canvas);
      const a1 = window.__toasts.length;
      window.__api.warnPendingVideoLossIf(canvas);   /* ⛔해제 없이 다시 — 같은 신원 */
      const a2 = window.__toasts.length;

      /* ⒝ ★해제를 ★부르는 길 — ★clearAssetImage 가 하는 ★그 호출 ★하나뿐.
         ⛔dataset 은 ★그대로 둔다(★지우면 identity 가 비어 ★다른 길로 풀린다)
         ⛔바닥을 ★해제로 쓸지 않는다 — ★신원이 ⒜ 와 다르니 ★첫 경고는 ★그냥 뜬다 */
      window.__mk('video', SAME_B);
      window.__toasts.length = 0;
      window.__api.warnPendingVideoLossIf(canvas);
      const b1 = window.__toasts.length;
      window.__api.resetPendingVideoWarnLatch();     /* ★✕로 비우는 자리가 하는 일 */
      window.__api.warnPendingVideoLossIf(canvas);   /* ★같은 신원 그대로 */
      const b2 = window.__toasts.length;

      return { a1, a2, b1, b2 };
    });
    /* ★전제 — 두 길의 ★첫 경고가 ★같아야 한다(★바닥이 같다는 증인) */
    expect(r.a1, '★첫 경고가 안 떴다 — 이 검사의 바닥이 무너졌다').toBe(1);
    expect(r.b1, '★두 길의 첫 경고가 다르다 — 바닥이 같지 않으면 아래 대비가 무의미하다').toBe(1);
    /* ⒜ ★해제 없으면 ★침묵 — ★★그 버그의 꼴이다(⛔「0회」를 ★안전으로 읽지 마라) */
    expect(r.a2, '★해제 없이도 다시 알렸다 — 그러면 「한 번만」 래치가 죽은 것이다(P6 를 봐라)').toBe(1);
    /* ⒝ ★★해제가 있으면 ★한 번 더 — ★고침이 ★사는 자리 */
    expect(r.b2,
      '★★«같은» 영상인데 해제 뒤에도 침묵한다 — ✕로 비우고 같은 파일을 다시 넣으면 경고 0회인 채로 '
      + '저장돼 ★영상이 실제로 사라진다(조용한 데이터 소실). resetPendingVideoWarnLatch 가 죽었다').toBe(2);
    /* ★★항등식이 아님 — ★두 길이 ★다른 답을 낸다. ⛔같으면 이 검사는 ★아무것도 안 잠근다 */
    expect(r.b2, '★해제 있는 길과 없는 길이 ★같은 답을 낸다 — 이 검사는 ★안 재고 있다').not.toBe(r.a2);
  });
});
