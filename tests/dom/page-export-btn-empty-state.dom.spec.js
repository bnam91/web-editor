/* page-export-btn-empty-state.dom.spec.js — 「섹션 0개인데 『전체 섹션 내보내기』가 활성」.
 *   (2026-09-20 사용자 관점 훑기 → 유닛 exportvisual)
 *
 * ★재현(고치기 전, 실측 2026-09-21 · 실앱 9525 · New Design 직후 빈 캔버스):
 *     #page-export-all-btn → disabled=false · background rgb(45,111,232) · title=''
 *     눌렀을 때 confirm: 「전체 0개 섹션을 내보냅니다. 계속할까요?」
 *   스크린샷: $SP/h0920b/ulexp-BEFORE-C-export-btn-0sec.png
 *
 * ★뿌리 — js/props/prop-page.js 의 버튼은 정적 HTML 이고 disabled 도 상태 바인딩도 «처음부터»
 *   없었다. 클릭 핸들러의 secCount 는 confirm 문구용이라 «렌더 시점엔 계산조차 안 됐다».
 *
 * 여기서 재는 것:
 *   N0 ★음성대조 — 고치기 «전» 소스(int/0920b)에 disabled 바인딩이 실제로 없다.
 *   T1 0섹션이면 disabled + 이유(title).
 *   T2 ★패널을 연 «채로» 섹션이 생기면 따라 살아난다(손으로 적은 트리거 목록 없이).
 *   T3 다시 0이 되면 도로 비활성.
 *   T4 ★버튼이 낡은 채 활성이어도 confirm 「0개를 내보냅니다」는 안 뜬다(이중 안전장치).
 *   T5 옵저버가 쌓이지 않는다 — 패널을 여러 번 열어도 하나만 산다.
 *   T6 ★내보내는 «동안»엔 옵저버가 버튼을 다시 켜지 않는다(export 경로가 캔버스를 만진다).
 *
 * ⛔앱을 «안» 띄운다 — index.html + 레포 파일만 크로미움에 얹는다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js page-export-btn-empty-state
 */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script type="module">
  import { showPageProperties } from '/js/props/prop-page.js';
  window.__openPage = showPageProperties;
  window.__ready = true;
</script></body>`);
})();

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate(() => {
    document.querySelector('#canvas').innerHTML = '';
    window.__openPage();
  });
  return errs;
}

const readBtn = (page) => page.evaluate(() => {
  const b = document.getElementById('page-export-all-btn');
  return b ? { disabled: b.disabled, title: b.title } : null;
});

const setSections = (page, n) => page.evaluate(async (n) => {
  const c = document.querySelector('#canvas');
  c.innerHTML = '';
  for (let i = 0; i < n; i++) {
    const s = document.createElement('div');
    s.className = 'section-block';
    c.appendChild(s);
  }
  // MutationObserver 는 마이크로태스크 뒤에 돈다
  await new Promise(r => setTimeout(r, 0));
}, n);

test('N0 ★음성대조 — 고치기 «전» 소스에는 버튼 상태 바인딩이 아예 없다', () => {
  let before;
  try {
    before = execFileSync('git', ['-C', REPO, 'show', 'int/0920b:js/props/prop-page.js'], { encoding: 'utf8' });
  } catch (e) {
    test.skip(true, 'int/0920b 를 못 읽는다(머지 뒤 브랜치가 사라진 환경) — 이 축은 못 잼');
    return;
  }
  const seg = before.slice(before.indexOf("const pageExportBtn = document.getElementById('page-export-all-btn')"),
                           before.indexOf('// Backward compat'));
  expect(seg.length, '고치기 전 소스에서 버튼 배선 구간을 못 찾았다').toBeGreaterThan(100);
  expect(seg, '★여기서 disabled 바인딩이 나오면 이 카드의 전제가 틀린 것이다')
    .not.toMatch(/pageExportBtn\.disabled\s*=\s*(secCount|n)\s*===\s*0/);
  expect(before, '★옛 코드에서는 secCount 가 confirm 문구에서만 쓰였다')
    .toMatch(/const secCount = canvasEl\.querySelectorAll\('\.section-block'\)\.length;/);
});

test('T1 섹션 0개 — 버튼이 비활성이고 이유를 말한다', async ({ page }) => {
  const errs = await boot(page);
  const r = await readBtn(page);
  console.log('  T1:', r);
  expect(r).toEqual({ disabled: true, title: '내보낼 섹션이 없습니다' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 ★패널을 연 «채로» 섹션이 생기면 따라 살아난다', async ({ page }) => {
  const errs = await boot(page);
  await setSections(page, 3);
  const r = await readBtn(page);
  console.log('  T2:', r);
  expect(r).toEqual({ disabled: false, title: '전체 3개 섹션을 내보냅니다' });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 다시 0개가 되면 도로 비활성', async ({ page }) => {
  const errs = await boot(page);
  await setSections(page, 2);
  expect((await readBtn(page)).disabled).toBe(false);
  await setSections(page, 0);
  expect((await readBtn(page)).disabled, '섹션을 다 지웠는데 버튼이 살아 있다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T4 ★버튼이 낡은 채 활성이어도 「0개를 내보냅니다」는 안 묻는다(이중 안전장치)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(async () => {
    const b = document.getElementById('page-export-all-btn');
    const asked = [];
    window.confirm = (m) => { asked.push(m); return false; };
    let exported = 0;
    window.exportAllSections = async () => { exported++; return { ok: [], failed: [] }; };
    b.disabled = false;                 // 어떤 이유로든 낡은 활성 상태를 가정
    b.click();
    await new Promise(r2 => setTimeout(r2, 20));
    return { asked, exported, disabledAfter: b.disabled };
  });
  console.log('  T4:', r);
  expect(r.asked, '★「전체 0개 섹션을 내보냅니다」를 물으면 안 된다').toEqual([]);
  expect(r.exported, '0개인데 내보내기가 돌았다').toBe(0);
  expect(r.disabledAfter, '클릭이 상태를 다시 맞춰야 한다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T5 옵저버가 쌓이지 않는다 — 패널을 여러 번 열어도 살아 있는 건 하나', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(async () => {
    const seen = new Set();
    for (let i = 0; i < 5; i++) { window.__openPage(); seen.add(window.__gdtPageExportObs); }
    // 마지막 하나만 캔버스를 보고 있어야 한다 — 이전 것들은 disconnect 됐다.
    const c = document.querySelector('#canvas');
    const s = document.createElement('div'); s.className = 'section-block'; c.appendChild(s);
    await new Promise(r2 => setTimeout(r2, 0));
    const b = document.getElementById('page-export-all-btn');
    return { distinct: seen.size, disabled: b.disabled, hook: !!window.__gdtPageExportObs };
  });
  console.log('  T5:', r);
  expect(r.hook, '옵저버 핸들이 없다 — 떼어낼 방법이 사라졌다').toBe(true);
  expect(r.disabled, '여러 번 연 뒤에도 마지막 패널이 정상 동작해야 한다').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T6 ★내보내는 «동안»에는 옵저버가 버튼을 다시 켜지 않는다', async ({ page }) => {
  const errs = await boot(page);
  await setSections(page, 2);
  const r = await page.evaluate(async () => {
    const b = document.getElementById('page-export-all-btn');
    const c = document.querySelector('#canvas');
    window.confirm = () => true;
    let midDisabled = null, midText = null;
    window.exportAllSections = async () => {
      // export 경로는 캔버스를 만진다(materializeAllSections) — 옵저버가 깨어난다
      const s = document.createElement('div'); s.className = 'section-block'; c.appendChild(s);
      await new Promise(r2 => setTimeout(r2, 10));
      midDisabled = b.disabled; midText = b.textContent;
      return { ok: [], failed: [] };
    };
    b.click();
    await new Promise(r2 => setTimeout(r2, 60));
    return { midDisabled, midText, after: b.disabled, afterText: b.textContent };
  });
  console.log('  T6:', r);
  expect(r.midDisabled, '★내보내는 중인데 버튼이 다시 눌리는 상태가 됐다(중복 실행 위험)').toBe(true);
  expect(r.midText).toBe('내보내는 중...');
  expect(r.after, '끝난 뒤에는 지금 섹션 수 기준으로 되살아난다').toBe(false);
  expect(r.afterText).toBe('전체 섹션 내보내기');
  expect(errs, errs.join(' | ')).toEqual([]);
});
