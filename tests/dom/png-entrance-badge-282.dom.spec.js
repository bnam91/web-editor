/* png-entrance-badge-282.dom.spec.js — ★282 PNG 입구에서 A/B 배지 0 을 «그림»으로 잰다 (S3 · 261029 · 지디 16:5x ②)
 *   까닭(지디 참값): :257 무력화 → T4(thumbnail-strip-parity · 소스 대조)만 빨강 · B5(capture-section-image · 공용 찍기)·T1(클론 걷기) 초록
 *     ⇒ «PNG 입구에서 배지 0 을 행위로 재는 spec» = 0. ⛔T4 는 제 할 일(글)을 했다 — 모자란 것은 입구에서 그림을 보는 자.
 *   길(입구 = 사용자 PNG 내보내기 그 함수): window.exportSection(sec, 'png', 860) → _exportSectionInner → js/io/export-image.js
 *     prepareCloneForCapture → stripEditorOnlyForCapture(:257) → js/io/capture-safety.js `.variation-badge` 걷기(:509)
 *     → 캡처 → toBlob → 다운로드. ★returnDataUrl 을 안 쓴다 — 실제로 «나간 파일»을 Playwright download 로 받아 그 PNG 를 읽는다.
 *   ★forceH2C: 하네스 electronAPI 는 가짜(모두 null)라 네이티브 CDP 캡처가 없다(t6-01 머리말 실측) ⇒ html2canvas 길로 찍는다.
 *     클론 준비(:257)는 두 길이 같다 — 갈림은 그 뒤 captureCloneToCanvas 안이다. ⇒ 네이티브 픽셀은 «안 쟀다».
 *   자: ⑴ 나간 PNG 의 «배지 자리» 평균색이 배지색에서 멀다 ⑵ ★음성대조 = 같은 크기 «배지 없는 자리»(오른쪽 위)도 배지색이 아니다
 *     ⑶ 배지가 있던 자리 판정이 «죽은 자»가 아님은 :257 무력화 사본 빨강으로 잰다(한 쌍 · 태양 GO 뒤).
 *   ★전제(이게 빨강이면 아래는 «안 쟀다»): 배지가 붙었다 · 보인다 · 자리를 차지한다 · 다운로드가 PNG 로 왔다.
 *   ⛔고정 대기 없음 · ⛔소스 창 없음. */
const fs = require('fs');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

test('X1 ★282 PNG 입구 — 나간 PNG 의 A/B 배지 자리가 배지색이 아니다(음성대조 자리도 아님)', async ({ page }) => {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  const pre = await page.evaluate(async () => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach((s) => s.remove());
    await window.addSection();
    const s = c.querySelector('.section-block'); if (!s) return { badge: false };
    window.deselectAll?.(); window.createVariation(s);   // 제품 함수 = 툴바 A/B 단추가 부르는 그것(section-variation.js :81)
    const b = s.querySelector(':scope > .variation-badge');
    if (!b) return { badge: false, sid: s.id };
    const S = s.getBoundingClientRect(), R = b.getBoundingClientRect();
    const rgb = (getComputedStyle(b).backgroundColor.match(/\d+/g) || []).slice(0, 3).map(Number);
    return { badge: true, sid: s.id, shown: getComputedStyle(s).display !== 'none', rgb,
      rel: { x: R.left - S.left, y: R.top - S.top, w: R.width, h: R.height }, secW: S.width };
  });
  expect(pre.badge, `★전제: 섹션에 A/B 배지가 붙었다 ${JSON.stringify(pre)}`).toBe(true);
  expect(pre.shown, '★전제: 그 섹션이 보인다').toBe(true);
  expect(pre.rel.w > 4 && pre.rel.h > 4, `★전제: 배지가 자리를 차지한다 ${JSON.stringify(pre.rel)}`).toBe(true);

  const [dl] = await Promise.all([
    page.waitForEvent('download'),
    page.evaluate((sid) => window.exportSection(document.getElementById(sid), 'png', 860, { forceH2C: true }), pre.sid),
  ]);
  const buf = fs.readFileSync(await dl.path());
  expect(/\.png$/.test(dl.suggestedFilename()) && buf.subarray(1, 4).toString() === 'PNG',
    `★전제: 다운로드가 PNG 로 왔다 ${dl.suggestedFilename()} · ${buf.subarray(0, 8).toString('hex')}`).toBe(true);

  const m = await page.evaluate(async ({ b64, pre }) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const cv = document.createElement('canvas'); cv.width = im.naturalWidth; cv.height = im.naturalHeight;
    const g = cv.getContext('2d'); g.drawImage(im, 0, 0);
    const k = im.naturalWidth / pre.secW;
    const mean = (x, y, w, h) => { const d = g.getImageData(Math.floor(x * k), Math.floor(y * k), Math.max(1, Math.floor(w * k)), Math.max(1, Math.floor(h * k))).data; const s = [0, 0, 0]; for (let i = 0; i < d.length; i += 4) { s[0] += d[i]; s[1] += d[i + 1]; s[2] += d[i + 2]; } const n = d.length / 4; return s.map((v) => Math.round(v / n)); };
    return { w: im.naturalWidth, h: im.naturalHeight, k,
      atBadge: mean(pre.rel.x, pre.rel.y, pre.rel.w, pre.rel.h),
      atControl: mean(pre.secW - pre.rel.x - pre.rel.w, pre.rel.y, pre.rel.w, pre.rel.h) };   // 오른쪽 위 · 같은 크기 · 배지 없는 자리
  }, { b64: buf.toString('base64'), pre });
  console.log(`[282] X1 ${JSON.stringify({ file: dl.suggestedFilename(), bytes: buf.length, badgeRgb: pre.rgb, rel: pre.rel, ...m })}`);
  const dist = (a) => Math.hypot(a[0] - pre.rgb[0], a[1] - pre.rgb[1], a[2] - pre.rgb[2]);
  expect(dist(m.atControl), `[음성대조] 배지 없는 자리가 배지색으로 읽힌다 — 픽셀 자가 죽었다 ${JSON.stringify(m)} · 배지 ${pre.rgb}`).toBeGreaterThan(60);
  expect(dist(m.atBadge), `★나간 PNG 의 배지 자리가 배지색이다 = 입구에서 배지가 찍혔다 ${JSON.stringify(m)} · 배지 ${pre.rgb}`).toBeGreaterThan(60);
  expect(errs).toEqual([]);
});
