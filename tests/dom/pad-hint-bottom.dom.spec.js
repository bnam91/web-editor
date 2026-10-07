/* pad-hint-bottom.dom.spec.js — ★아래 패딩 띠 ＋ 띠·그리드 «색 피커» (2026-10-07 현빈 ①②)
 *
 * ★왜 필요한가
 *   tests/unit/pad-hint.test.js 는 «소스에 그 문자열이 있나»까지만 안다.
 *   ⇒ 「--gdt-pad-b 가 진짜 테두리 두께가 되나」·「고른 색이 ★좌우와 아래 둘 다에 먹나」·
 *     「그 색이 ★쓸기를 살아남나」·「스와치를 넣어도 라디오가 ★안 눌리나」는
 *     «렌더러가 그린 뒤»에만 답이 나온다.
 *
 * ★★계측기를 ★먼저 증명한다 — ①의 측정에서 쓴 꼴을 그대로 옮겼다:
 *   ★좌우 띠를 먼저 재서 「이 자가 띠를 잡는다」를 세우고, ★그다음 아래를 잰다.
 *   그 양성대조가 없으면 「아래 0px」이 «없다»인지 «안 재고 있다»인지 구분이 안 된다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉(pad-hint.dom.spec.js 하네스를 그대로 쓴다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js pad-hint-bottom
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  return h.replace('</body>', `<script src="/vendor/html2canvas/html2canvas.min.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { showSectionProperties } from '/js/props/prop-section.js';
  import { showPageProperties } from '/js/props/prop-page.js';
  window.__open = showSectionProperties;
  window.__openPage = showPageProperties;
  window.__ready = true;
</script></body>`);
})();

const SECTIONS = `
  <div class="section-block" id="sec_1" data-section="1" data-name="Section 01">
    <div class="section-hitzone"><span class="section-label">Section 01</span></div>
    <div class="section-inner" style="min-height:200px"></div>
  </div>
  <div class="section-block" id="sec_2" data-section="2" data-name="Section 02">
    <div class="section-hitzone"><span class="section-label">Section 02</span></div>
    <div class="section-inner" style="min-height:200px"></div>
  </div>`;

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
  /* ★저장된 «보기 설정»을 비운다 — 앞 검사가 고른 색이 남으면 기본값 단언이 거짓이 된다. */
  await page.addInitScript(() => {
    try { ['gdt.padHint', 'gdt.padHintColor', 'gdt.gridColor', 'gdt.gridGuide'].forEach(k => localStorage.removeItem(k)); } catch (_) {}
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; }, SECTIONS);
  expect(await page.locator('#canvas .section-inner').count(), '★전제 — 섹션 2개가 들어가야 한다').toBe(2);
  return errs;
}

async function openSection(page, id) {
  await page.evaluate((id) => window.__open(document.getElementById(id)), id);
  await page.waitForSelector('#sec-padb-slider', { state: 'attached' });
}
async function openPage(page) {
  await page.evaluate(() => window.__openPage());
  await page.waitForSelector('#page-pad-hint-color', { state: 'attached' });
}
const fire = (page, id, v) => page.evaluate(([id, v]) => {
  const s = document.getElementById(id);
  if (!s) throw new Error('★요소가 없다: ' + id);
  s.value = String(v);
  s.dispatchEvent(new Event('input', { bubbles: true }));
  return true;
}, [id, v]);

/** 섹션 상자(.section-block)의 ::before = ★아래 띠 / inner 의 ::before = ★좌우 띠 */
const bands = (page, id) => page.evaluate((id) => {
  const sec = document.getElementById(id);
  const inner = sec.querySelector('.section-inner');
  const sb = getComputedStyle(sec, '::before');
  const ib = getComputedStyle(inner, '::before');
  return {
    bottom: sb.borderBottomWidth, bottomColor: sb.borderBottomColor, secContent: sb.content,
    left: ib.borderLeftWidth, leftColor: ib.borderLeftColor, innerContent: ib.content,
    secPadB: getComputedStyle(sec).paddingBottom,
    varB: sec.style.getPropertyValue('--gdt-pad-b'),
    varL: inner.style.getPropertyValue('--gdt-pad-l'),
    on: document.body.classList.contains('gdt-pad-on'),
  };
}, id);

/* ═══ B1 — ★아래 띠. 좌우를 ★양성대조로 먼저 세운다 ═══ */
test('B1 ★아래 패딩 슬라이더가 띠를 띄운다 (양성대조: 좌우가 먼저 잡힌다)', async ({ page }) => {
  const errs = await boot(page);
  await openSection(page, 'sec_1');

  const base = await bands(page, 'sec_1');
  expect(base.on, '★전제 — 만지기 전인데 gdt-pad-on 이 붙어 있다').toBe(false);
  expect(base.bottom, '★전제 — 만지기 전인데 아래 띠가 0px 이 아니다').toBe('0px');

  /* ★양성대조 — 같은 자(getComputedStyle ::before)로 좌우를 먼저 잡는다.
     ⇐ 이게 빨강이면 아래 단언이 통째로 공회전이다. */
  await fire(page, 'sec-padx-slider', 40);
  const x = await bands(page, 'sec_1');
  expect(x.on, '★양성대조 실패 — 좌우를 움직였는데 gdt-pad-on 이 안 붙었다').toBe(true);
  expect(x.left, '★양성대조 실패 — 좌우 띠 두께가 40px 이 아니다').toBe('40px');
  expect(x.leftColor, '★양성대조 실패 — 좌우 띠 색이 기본 핑크 10% 가 아니다').toBe('rgba(255, 0, 128, 0.1)');

  /* 띠를 걷고(400ms) 본 측정 — 앞 상태가 남으면 「아래가 떴다」가 좌우 덕일 수 있다. */
  await page.waitForTimeout(700);
  const cleared = await bands(page, 'sec_1');
  expect(cleared.on, '★전제 — 띠가 안 걷혔다').toBe(false);
  expect(cleared.varL, '★전제 — 좌우 변수가 안 걷혔다').toBe('');

  /* ★본 측정 — 아래 패딩 */
  await fire(page, 'sec-padb-slider', 80);
  const b = await bands(page, 'sec_1');
  expect(b.secPadB, '★아래 패딩이 DOM 에 안 먹었다 — 이 아래 단언이 무의미하다').toBe('80px');
  expect(b.on, '★아래를 움직였는데 gdt-pad-on 이 안 붙었다').toBe(true);
  expect(b.varB, '★--gdt-pad-b 가 섹션 상자에 안 박혔다').toBe('80px');
  expect(b.secContent, '★.section-block 의 ::before 가 안 생겼다 — [style*="--gdt-pad-b"] 가드가 안 맞나').toBe('""');
  expect(b.bottom, '★아래 띠 두께가 패딩값(80px)과 다르다').toBe('80px');
  expect(b.bottomColor, '★아래 띠 색이 좌우와 같은 핑크 10% 가 아니다').toBe('rgba(255, 0, 128, 0.1)');

  /* ★음성대조 — 만지지 «않은» 섹션엔 띠가 없다(변수를 body 에 박았다면 둘 다 떴을 것이다). */
  const other = await bands(page, 'sec_2');
  expect(other.bottom, '★만지지 않은 섹션에도 아래 띠가 떴다 — 변수를 섹션이 아닌 공용 자리에 박았다').toBe('0px');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ B2 — 게이트를 좌우와 «같이» 쓴다 ═══ */
test('B2 ★「패딩 비주얼 끔」이면 아래 띠도 안 뜬다 (게이트 공유)', async ({ page }) => {
  const errs = await boot(page);
  await openPage(page);
  /* ★전제 — 기본은 «켜짐»이다(prop-page.js readPadHintOn). 그래야 아래의 «끄기»가 변화다. */
  expect(await page.evaluate(() => document.getElementById('page-pad-hint-on').checked),
    '★전제 — 패딩 비주얼 기본이 켜짐이 아니다').toBe(true);

  /* ★양성대조 — 켜진 채로는 아래 띠가 «뜬다» */
  await openSection(page, 'sec_1');
  await fire(page, 'sec-padb-slider', 60);
  expect((await bands(page, 'sec_1')).bottom, '★양성대조 실패 — 켜짐인데 아래 띠가 안 뜬다').toBe('60px');
  await page.waitForTimeout(700);

  /* 끈다 */
  await openPage(page);
  await page.evaluate(() => {
    const off = document.getElementById('page-pad-hint-off');
    off.checked = true;
    off.dispatchEvent(new Event('change', { bubbles: true }));
  });
  expect(await page.evaluate(() => window.readPadHintOn()), '★끔이 저장되지 않았다').toBe(false);

  await openSection(page, 'sec_1');
  await fire(page, 'sec-padb-slider', 120);
  const off = await bands(page, 'sec_1');
  expect(off.secPadB, '★꺼도 패딩 «자체»는 먹어야 한다(띠만 안 뜨는 것이다)').toBe('120px');
  expect(off.on, '★꺼 뒀는데 gdt-pad-on 이 붙었다').toBe(false);
  expect(off.varB, '★꺼 뒀는데 --gdt-pad-b 가 박혔다 — 인라인 변수가 저장으로 샌다').toBe('');
  expect(off.bottom, '★꺼 뒀는데 아래 띠가 떴다').toBe('0px');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ B3 — 거두기 ＋ 저장본 누출 0 ═══ */
test('B3 ★400ms 뒤 아래 띠를 거두고, «켜진 채로» 직렬화해도 저장본에 0건이다', async ({ page }) => {
  const errs = await boot(page);
  await openSection(page, 'sec_1');
  await fire(page, 'sec-padb-slider', 80);

  const r = await page.evaluate(() => {
    const sec = document.getElementById('sec_1');
    return {
      hasFn: typeof window.serializeCleanRoot === 'function',
      on: document.body.classList.contains('gdt-pad-on'),
      liveVar: sec.style.getPropertyValue('--gdt-pad-b'),
      /* ★양성대조 — 세척 «전» 클론에는 변수가 실제로 있다. 0이면 아래가 공회전이다. */
      rawHits: (document.getElementById('canvas').cloneNode(true).outerHTML.match(/--gdt-pad-b/g) || []).length,
      cleanHits: (() => {
        const clone = document.getElementById('canvas').cloneNode(true);
        window.serializeCleanRoot(clone);
        return (clone.innerHTML.match(/--gdt-pad/g) || []).length;
      })(),
      liveAfter: sec.style.getPropertyValue('--gdt-pad-b'),
      /* ★과잉 세척 음성대조 — «진짜 편집»인 padding-bottom 은 살아 있어야 한다. */
      padKept: (() => {
        const clone = document.getElementById('canvas').cloneNode(true);
        window.serializeCleanRoot(clone);
        return (clone.innerHTML.match(/padding-bottom: 80px/g) || []).length;
      })(),
    };
  });
  expect(r.hasFn, '★전제 — serializeCleanRoot 가 없다').toBe(true);
  expect(r.on, '★전제 — 힌트가 켜진 «그 순간»이 아니다').toBe(true);
  expect(r.liveVar, '★전제 — 라이브 DOM 에 --gdt-pad-b 가 없다').toBe('80px');
  expect(r.rawHits, '★양성대조 실패 — 세척 전 클론에 --gdt-pad-b 가 0건이다').toBeGreaterThan(0);
  expect(r.cleanHits, '★세척 뒤에도 --gdt-pad 가 남았다 — 저장본·배송본에 실린다').toBe(0);
  expect(r.liveAfter, '★세척이 라이브 DOM 을 건드렸다 — 클론 전용 계약을 깼다').toBe('80px');
  expect(r.padKept, '★세척이 «진짜 편집»인 padding-bottom 까지 먹었다').toBe(1);

  /* 거두기 */
  await page.waitForTimeout(700);
  const after = await bands(page, 'sec_1');
  expect(after.on, '★400ms 이 지나도 gdt-pad-on 이 남아 있다').toBe(false);
  expect(after.varB, '★400ms 뒤에도 --gdt-pad-b 가 남아 있다').toBe('');
  expect(after.secPadB, '★거두기가 «진짜 편집»인 패딩까지 걷었다').toBe('80px');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ B4·B5 — 색 피커. ★교차 대조로 «서로를 안 건드린다»를 잠근다 ═══ */
test('B4 ★패딩 색을 고르면 «좌우와 아래 둘 다» 바뀌고 ★그리드는 안 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  await openPage(page);

  const gridBg = () => page.evaluate(() => {
    document.body.classList.add('gdt-grid-on');
    return getComputedStyle(document.querySelector('#sec_1 .section-inner')).backgroundImage;
  });
  const before = { grid: await gridBg() };
  expect(before.grid, '★전제 — 그리드 배경을 못 읽었다').toContain('rgba(255, 0, 0, 0.1)');

  /* ★틸로 고른다 — 현빈이 ②에서 직접 말한 계열 */
  await fire(page, 'page-pad-hint-color', '#14b8a6');

  await openSection(page, 'sec_1');
  await fire(page, 'sec-padx-slider', 40);
  await fire(page, 'sec-padb-slider', 80);
  const b = await bands(page, 'sec_1');
  expect(b.leftColor, '★고른 색이 «좌우» 띠에 안 먹었다').toBe('rgba(20, 184, 166, 0.1)');
  expect(b.bottomColor, '★고른 색이 «아래» 띠에 안 먹었다 — 좌우에만 먹으면 그게 결함이다').toBe('rgba(20, 184, 166, 0.1)');

  /* ★교차 대조 — 그리드는 그대로여야 한다(둘을 «구분»하는 것이 ②의 목적이다) */
  expect(await gridBg(), '★패딩 색을 골랐더니 그리드 색까지 바뀌었다 — 변수가 섞였다')
    .toContain('rgba(255, 0, 0, 0.1)');

  /* ★저장되나 — 보기 설정이라 localStorage 다(프로젝트 아님) */
  expect(await page.evaluate(() => localStorage.getItem('gdt.padHintColor')), '★고른 색이 저장되지 않았다').toBe('#14b8a6');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

test('B5 ★그리드 색을 고르면 그리드만 바뀌고 ★패딩 띠는 안 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  await openPage(page);
  await fire(page, 'page-grid-color', '#0000ff');

  const grid = await page.evaluate(() => {
    document.body.classList.add('gdt-grid-on');
    return getComputedStyle(document.querySelector('#sec_1 .section-inner')).backgroundImage;
  });
  expect(grid, '★고른 그리드 색이 안 먹었다').toContain('rgba(0, 0, 255, 0.1)');

  await openSection(page, 'sec_1');
  await fire(page, 'sec-padb-slider', 80);
  expect((await bands(page, 'sec_1')).bottomColor,
    '★그리드 색을 골랐더니 패딩 띠까지 바뀌었다 — 변수가 섞였다').toBe('rgba(255, 0, 128, 0.1)');
  expect(await page.evaluate(() => localStorage.getItem('gdt.gridColor'))).toBe('#0000ff');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ B6 — ★폭. ⛔.prop-row 는 overflow:hidden 이라 «조용히» 잘린다 ═══ */
test('B6 ★스와치를 넣은 실제 패널에서 라디오가 ⛔눌리지 않는다 (수로 잠근다)', async ({ page }) => {
  const errs = await boot(page);
  await openPage(page);

  const row = (labelText) => page.evaluate((t) => {
    const lab = [...document.querySelectorAll('.prop-label')].find(e => e.textContent.trim() === t);
    if (!lab) return { found: false };
    const r = lab.closest('.prop-row');
    const grp = r.querySelector('.prop-radio-group');
    const sw = r.querySelector('.prop-color-swatch');
    /* ★그룹의 «자연폭» — flex:1 을 잠깐 꺼서 내용이 요구하는 폭을 잰다. 바로 되돌린다.
       ⛔row.scrollWidth 로 재지 마라: flex:1 이 남는 폭을 흡수해 ★언제나 clientWidth 와 같다
         (2026-10-07 실측 — 그 자로는 아무것도 안 쟀다). */
    const prev = grp.style.flex;
    grp.style.flex = '0 0 auto';
    const natural = Math.round(grp.getBoundingClientRect().width);
    grp.style.flex = prev;
    return {
      found: true, rowW: r.clientWidth,
      labW: Math.round(lab.getBoundingClientRect().width),
      grpNatural: natural, grpNow: Math.round(grp.getBoundingClientRect().width),
      swW: sw ? Math.round(sw.getBoundingClientRect().width) : 0,
      radios: [...r.querySelectorAll('.prop-radio')].map(e => Math.round(e.getBoundingClientRect().width)),
      clipped: [...r.querySelectorAll('.prop-radio')].map(e => e.scrollWidth > e.clientWidth),
    };
  }, labelText);

  for (const t of ['그리드 가이드', '패딩 비주얼']) {
    const m = await row(t);
    expect(m.found, `★전제 — 「${t}」 로우를 못 찾았다`).toBe(true);
    expect(m.radios.length, `★전제 — 「${t}」 라디오가 2개가 아니다`).toBe(2);
    expect(m.swW, `★「${t}」 로우에 색 스와치가 없다(폭 0) — 현빈 ② 가 안 들어갔다`).toBe(24);
    /* ★본 단언 — 그룹이 «자연폭» 밑으로 눌리지 않았다 = 라디오가 안 잘렸다 */
    expect(m.grpNow, `⛔「${t}」: 스와치 때문에 라디오 그룹이 자연폭(${m.grpNatural}) 밑으로 눌렸다`
      + ` — 두 로우로 쪼개야 한다. 잰 값: row ${m.rowW} · 라벨 ${m.labW} · 그룹 ${m.grpNow} · 스와치 ${m.swW}`)
      .toBeGreaterThanOrEqual(m.grpNatural);
    expect(m.clipped, `⛔「${t}」: 라디오 글자가 잘렸다 — ${JSON.stringify(m)}`).toEqual([false, false]);
  }
  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ B7 — ★경계. 고른 «색»은 쓸기를 살아남아야 한다(이름이 한 글자 차이다) ═══ */
test('B7 ★띠를 거둘 때 «고른 색»은 지워지지 않는다 (--gdt-padhint-color vs --gdt-pad-)', async ({ page }) => {
  const errs = await boot(page);
  await openPage(page);
  await fire(page, 'page-pad-hint-color', '#14b8a6');

  const read = () => page.evaluate(() => ({
    color: document.documentElement.style.getPropertyValue('--gdt-padhint-color'),
    /* ★양성대조 — 쓸기가 «진짜로 뭔가를 지우나». 0이면 아래 「색이 남았다」가 공회전이다. */
    padVars: (document.getElementById('canvas').outerHTML.match(/--gdt-pad-/g) || []).length,
  }));

  await openSection(page, 'sec_1');
  await fire(page, 'sec-padx-slider', 40);
  await fire(page, 'sec-padb-slider', 80);
  const before = await read();
  expect(before.color, '★전제 — 고른 색이 문서 변수에 안 박혔다').toBe('rgba(20, 184, 166, 0.1)');
  expect(before.padVars, '★양성대조 실패 — 쓸기 전에 --gdt-pad- 변수가 0건이다').toBeGreaterThan(0);

  /* ★쓸기를 «진짜로» 돌린다 */
  await page.evaluate(() => window.sweepPadHintVars());
  const after = await read();
  expect(after.padVars, '★쓸기가 두께 변수를 못 걷었다 — 이 검사의 자가 죽었다').toBe(0);
  expect(after.color, '★★쓸기가 «사용자가 고른 색»까지 지웠다 — 색 변수 이름이 쓸기 접두사에 걸렸다')
    .toBe('rgba(20, 184, 166, 0.1)');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});

/* ═══ B8 — 내보내기 가드가 «아래 띠도» 끈다 ═══ */
test('B8 ★내보내기 가드(withGuideOff)가 아래 띠도 끈다 — 클래스 한 곳에 매달려 있다', async ({ page }) => {
  const errs = await boot(page);
  await openSection(page, 'sec_1');
  await fire(page, 'sec-padb-slider', 80);

  const r = await page.evaluate(async () => {
    const m = await import('/js/io/capture-safety.js');
    const sec = document.getElementById('sec_1');
    const band = () => getComputedStyle(sec, '::before').borderBottomWidth;
    const out = { hasFn: typeof m.withGuideOff === 'function', pre: band(), during: null, post: null };
    if (!out.hasFn) return out;
    await m.withGuideOff(async () => { out.during = band(); });
    out.post = band();
    return out;
  });
  expect(r.hasFn, '★전제 — withGuideOff 를 못 불렀다').toBe(true);
  expect(r.pre, '★전제 — 가드를 돌리기 «전»에 아래 띠가 안 떠 있었다. 이 검사는 공회전이다').toBe('80px');
  expect(r.during, '★가드가 도는 «동안» 아래 띠가 켜져 있었다 — 내보낸 이미지에 띠가 찍힌다').toBe('0px');
  expect(r.post, '★가드 뒤 아래 띠가 원복되지 않았다 — finally 가 죽었다').toBe('80px');

  expect(errs, '★페이지 에러: ' + errs.join(' | ')).toEqual([]);
});
