/* video-pending-warn.dom.spec.js — 「미확정 영상 알림」이 진짜 DOM 에서 뜨고, 안 떠야 할 때 안 뜨는가.
 *
 * ★왜 생겼나 (T-032, 2026-09-21)
 *   영상을 넣고 «GIF로 적용»을 안 한 채 나가면 원본이 저장에서 빠진다(js/io/section-serialize.js
 *   T-012 세척). 알림이 «홈으로 나가기»·«블럭 선택 해제» 두 곳에만 있어서, 창을 닫거나 ⌘S 를
 *   누르면 아무 말도 없었다(실앱 9551 재현: ⌘S 토스트가 '💾 저장됨' 하나뿐).
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
  import { hasPendingVideo, warnPendingVideoLoss, warnPendingVideoLossIf, PENDING_VIDEO_MSG, PENDING_VIDEO_SELECTOR }
    from '/js/io/pending-video-warn.js';
  window.__toasts = [];
  window.showToast = (m) => { window.__toasts.push(String(m)); };
  window.__api = { hasPendingVideo, warnPendingVideoLoss, warnPendingVideoLossIf, PENDING_VIDEO_MSG, PENDING_VIDEO_SELECTOR };
  /* 실제 에셋 블록과 «같은 성질»로 만든다 — js/image-handling.js setAssetVideoFromSrc 가 붙이는 것. */
  window.__mk = (kind) => {
    const c = document.getElementById('canvas');
    c.innerHTML = '';
    const ab = document.createElement('div');
    ab.className = 'asset-block has-image';
    if (kind === 'video') ab.dataset.assetType = 'video-pending';
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
});
