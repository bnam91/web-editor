/* ★_root-harness 의 ★파일 캐시가 ★«거짓 초록»을 ★안 내는지 잠근다 (2026-10-14 지디).
 *   ★까닭: route 핸들러가 goto 마다 2.6MB(111파일)를 다시 읽어 ★워커 경합을 만들었다
 *     (실측 workers=1 177/177 초록 ↔ workers=4 ✘1 ↔ 인텔 고부하 전수 failed 15).
 *   ⇒ 캐시를 넣었는데, ★단순 Map 이면 ★런 중 파일이 바뀔 때 ★옛 내용을 돌려준다 = ★거짓 초록.
 *   ⇒ 키에 mtimeMs＋size 를 넣어 막았고, ★그게 ★정말 막는지를 ★여기서 ★행위로 잰다.
 *   ⛔내부 함수를 들여다보지 않는다 — ★«파일을 바꾸고 다시 받아 본다»로 잰다. */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN, boot } = require('./_root-harness.js');

const REL = 'tests/dom/__cache-probe.js';
const ABS = path.join(ROOT, REL);

test.afterEach(() => { try { fs.unlinkSync(ABS); } catch {} });

test('HC1 ★캐시가 ★바뀐 파일을 ★다시 읽는다 — ⛔옛 내용을 돌려주면 ★거짓 초록이 난다', async ({ page }) => {
  fs.writeFileSync(ABS, 'window.__probe = "FIRST";\n');
  const html = `<!doctype html><meta charset="utf-8"><script src="/${REL}"></script>`;
  await boot(page, html, { ready: false });
  const first = await page.evaluate(() => window.__probe);
  expect(first, '★전제 — 첫 읽기가 선다').toBe('FIRST');

  /* ★mtime 이 ★같은 ms 로 찍히면 ★키가 안 바뀌어 ★이 시험이 ★못 잰다 ⇒ ★크기도 바꿔 ★둘 다 움직인다 */
  fs.writeFileSync(ABS, 'window.__probe = "SECOND-CHANGED";\n');
  const st = fs.statSync(ABS);
  fs.utimesSync(ABS, st.atime, new Date(st.mtimeMs + 2000));

  await boot(page, html, { ready: false });
  const second = await page.evaluate(() => window.__probe);
  expect(second, '★★바뀐 뒤엔 ★새 내용이 와야 한다 — ⛔FIRST 가 오면 ★캐시가 ★거짓 초록을 낸다').toBe('SECOND-CHANGED');
});

test('HC2 ★★음성대조 — ★안 바꾸면 ★같은 내용이 ★그대로 온다(캐시가 ★엉뚱한 걸 돌려주지 않는다)', async ({ page }) => {
  fs.writeFileSync(ABS, 'window.__probe = "STABLE";\n');
  const html = `<!doctype html><meta charset="utf-8"><script src="/${REL}"></script>`;
  await boot(page, html, { ready: false });
  expect(await page.evaluate(() => window.__probe)).toBe('STABLE');
  await boot(page, html, { ready: false });
  expect(await page.evaluate(() => window.__probe), '★두 번째도 같은 내용').toBe('STABLE');
});
