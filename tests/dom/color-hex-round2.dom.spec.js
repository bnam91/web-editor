/* color-hex-round2.dom.spec.js — 앞 라운드가 «못 닿은» 색 코드 칸들 (2026-09-21 픽스 라운드)
 *
 * ★왜 2라운드가 필요했나 (이벨류에이터 실측)
 *   0920 라운드는 배선을 wireHexText 한 자리로 모았지만 «손사본이 남은 자리»를 사람이 손으로 셌고
 *   그 숫자가 틀렸다. 남아 있던 대표 셋:
 *     ① `page-bg-hex`(페이지 바탕색) — 이 칸만 maxlength="6" 이라 `#00FF00` 을 붙여 넣으면
 *        «7번째 글자가 잘려» `#00FF0` 이 되고, 그 무효값은 말없이 무시됐다.
 *        = 신고 원문(「자리마다 # 규칙이 다르다 + 틀리면 말없이 무시」)이 그대로 남은 칸.
 *     ② `mdl-typo-color-hex` / `grd-typo-color-hex` — blur 리스너가 «0건» 이라
 *        무효값이 칸에 영원히 남았다(= ULFIX 유닛 설명문의 그 문장).
 *   ③ Enter 로는 어떤 색칸도 «확정»되지 않았다 — `<form>` 밖이라 Chromium 이 change 를 안 쏜다.
 *      자유형식 칸(cvb-text-bg-raw)은 input 이 스와치만 바꾸므로 사용자 눈엔 「Enter 쳤는데 안 바뀜」.
 *   ④ `formatHex6OrTransparent` 가 hex 도 transparent 도 아닌 CSS 를 «대문자로 망가뜨렸다»
 *      (`rgb(0,0,0)` → `RGB(0,0,0)` → parse 실패 → 멀쩡한 값에 빨간 무효 표시).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(다른 DOM 스펙과 같은 부팅).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js color-hex-round2
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★페이지 바탕 칸의 마크업은 index.html 에서 «꺼내 쓴다» — 베끼면 안 된다.
   베낀 순간 이 검사는 「내가 쓴 maxlength」를 재게 되고, 실물이 6 으로 되돌아가도 초록이다
   (앞 라운드가 딱 그 꼴로 새 사각지대를 만들었다). 못 찾으면 그 자리에서 죽는다. */
const PAGE_BG_MARKUP = (() => {
  const html = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  const m = /<input[^>]*id="page-bg-hex"[^>]*>/.exec(html);
  if (!m) throw new Error('index.html 에서 page-bg-hex 입력을 못 찾았다 — 하네스가 실물을 안 재고 있다');
  return m[0];
})();

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/design-tokens.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas-wrap"><div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<!-- 페이지 바탕 칸 — index.html 의 «그 줄»을 런타임에 꺼내 끼운다(위 PAGE_BG_MARKUP). -->
<div id="ds-page-bg">
  <div class="prop-color-swatch" style="width:24px;height:24px;"><input type="color" id="page-bg-color" value="#777777"></div>
  ${PAGE_BG_MARKUP}
  <input type="text" id="page-bg-alpha-input" value="100">
</div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { wireCanvasBgControl } from '/js/props/prop-page.js';
  import { makeModalBlock } from '/js/blocks/modal-block.js';
  import { showModalProperties } from '/js/props/prop-modal.js';
  import { makeGridBlock } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  import '/js/props/prop-simple-card.js';
  window.__hist = 0;
  window.pushHistory = () => { window.__hist++; };
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => '';
  window.renderCanvas = window.renderCanvas || (() => {});

  window.__openPageBg = () => { wireCanvasBgControl(); };

  window.__openModal = () => {
    const host = document.getElementById('host'); host.innerHTML = '';
    const { row, block } = makeModalBlock ? (makeModalBlock('titled') || {}) : {};
    if (row) host.appendChild(row); else if (block) host.appendChild(block);
    window.__block = block;
    showModalProperties(block);
    return !!document.getElementById('mdl-typo-color-hex');
  };

  /* ★픽스처는 grid-typo.dom.spec.js 의 것을 «그대로» 쓴다 — 거기서 이미 도는 모양이다.
     (1열×1행으로 줄이면 _grdResolveAddr 가 줄을 못 찾아 Fill 절이 안 그려진다 — 실측) */
  const GRID_FX = {
    cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
    rows: [{ height: 'auto' }, { height: 'auto' }],
    cells: [
      [ { lines: [ { type: 'body', text: 'A0' }, { type: 'h2', text: 'A1' }, { type: 'caption', text: '' } ] },
        { lines: [ { type: 'body', text: 'B0' },
                   { type: 'body', text: 'B1', color: '#ff0000' },
                   { type: 'label', text: 'B2', bg: '#111111' } ] } ],
      [ { lines: [ { type: 'body', text: 'C0' }, { type: 'gap', height: 20 }, { type: 'body', text: 'C2' } ] },
        { lines: [ { type: 'body', text: 'D0' }, { type: 'body', text: 'D1' }, { type: 'body', text: 'D2' } ] } ],
    ],
  };
  const _mountGrid = () => {
    const host = document.getElementById('host'); host.innerHTML = '';
    const { row, block } = makeGridBlock(GRID_FX);
    host.appendChild(row); block.classList.add('selected');
    window.__block = block;
    return block;
  };
  window.__openGrid = () => {
    showGridProperties(_mountGrid(), { r: 0, c: 1, li: 1 });     // 명시색 #ff0000 인 줄
    return !!document.getElementById('grd-typo-color-hex');
  };
  window.__openGridNoColor = () => {
    showGridProperties(_mountGrid(), { r: 0, c: 0, li: 1 });     // 색 «안 정한» 줄(h2)
    return !!document.getElementById('grd-typo-color-hex');
  };

  window.__openCard = () => {
    const host = document.getElementById('host'); host.innerHTML = '';
    const b = document.createElement('div'); b.className = 'canvas-block'; b.id = 'cvb_x';
    b.dataset.cardMode = 'simple'; b.dataset.iconMode = 'true';
    b.dataset.cards = JSON.stringify([{ title: '가', desc: '나' }]);
    host.appendChild(b);
    window.__block = b;
    window.showSimpleCardProperties(b);
    return b.id;
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 칸에 «사람처럼» 친다 — maxlength 가 실제로 자르는지까지 그대로 겪는다. */
async function typeInto(page, id, text) {
  await page.locator(`#${id}`).click();
  await page.locator(`#${id}`).fill('');
  await page.locator(`#${id}`).type(text, { delay: 5 });
}

const probe = (page, id) => page.evaluate((id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  return {
    value: el.value,
    invalid: el.classList.contains('prop-color-hex--invalid') || el.getAttribute('aria-invalid') === 'true',
    maxlength: el.getAttribute('maxlength'),
  };
}, id);

test.describe('색 코드 칸 2라운드 — 남은 손사본 · Enter 확정 · 표기 망가짐', () => {
  let errs;
  test.beforeEach(async ({ page }) => { errs = await boot(page); });

  test('T0 하네스가 살아 있다 — 네 패널이 실제로 그려진다', async ({ page }) => {
    const got = await page.evaluate(() => {
      window.__openPageBg();
      const p = !!document.getElementById('page-bg-hex');
      const m = window.__openModal();
      const g = window.__openGrid();
      window.__openCard();
      const c = !!document.getElementById('cvb-textbg-hex');
      return { p, m, g, c };
    });
    expect(got, JSON.stringify(got)).toEqual({ p: true, m: true, g: true, c: true });
    expect(errs.join('\n')).toBe('');
  });

  /* ── ① page-bg-hex ────────────────────────────────────────────────── */
  test('P1 ★「바탕색」 칸이 `#` 을 붙여 써도 받는다 (maxlength 가 7번째 글자를 안 자른다)', async ({ page }) => {
    // 음성대조(고치기 전): maxlength="6" → 칸 값이 `#00FF0` 로 잘리고 picker 는 #777777 그대로.
    await page.evaluate(() => { window.state.pageSettings.bg = '#777777'; window.__openPageBg(); });
    await typeInto(page, 'page-bg-hex', '#00FF00');
    const m = await probe(page, 'page-bg-hex');
    expect(m.maxlength, '이 칸만 maxlength 가 다르면 «같은 글자»가 자리마다 다르게 먹힌다').toBe('7');
    expect(m.value, `칸 값이 잘렸다: ${m.value}`).toBe('#00FF00');
    expect(m.invalid, '유효값인데 무효 표시가 붙었다').toBe(false);
    const applied = await page.evaluate(() => ({
      bg: window.state.pageSettings.bg,
      pick: document.getElementById('page-bg-color').value,
    }));
    expect(applied.bg.toLowerCase(), '값이 «말없이 무시»됐다').toBe('#00ff00');
    expect(applied.pick.toLowerCase()).toBe('#00ff00');
  });

  test('P2 ★「바탕색」 무효값은 ① 안 먹고 ② 표시가 뜨고 ③ blur 로 되돌아간다', async ({ page }) => {
    await page.evaluate(() => { window.state.pageSettings.bg = '#777777'; window.__openPageBg(); });
    await typeInto(page, 'page-bg-hex', 'zz1234');
    const mid = await probe(page, 'page-bg-hex');
    expect(mid.invalid, `무효값인데 아무 표시가 없다(칸: ${mid.value}) — 사용자는 «먹었다»고 읽는다`).toBe(true);
    expect((await page.evaluate(() => window.state.pageSettings.bg)).toLowerCase()).toBe('#777777');
    await page.evaluate(() => document.getElementById('page-bg-hex').blur());
    const after = await probe(page, 'page-bg-hex');
    expect(after.value, `blur 했는데 무효값 «${after.value}» 이 남아 있다`).toBe('777777');
    expect(after.invalid).toBe(false);
  });

  /* ── ② 모달·그리드 타이포 「글자색」 — blur 리스너가 0건이던 자리 ──── */
  for (const [id, opener] of [['mdl-typo-color-hex', '__openModal'], ['grd-typo-color-hex', '__openGrid']]) {
    test(`C-${id} ★무효값이 칸에 «영원히» 남지 않는다 (blur 복원 + 무효 표시)`, async ({ page }) => {
      // 음성대조(고치기 전): blur 리스너가 아예 없어 zz1234 가 칸에 그대로 남고 표시도 없었다.
      const before = await page.evaluate((o) => { window[o](); return document.getElementById(
        o === '__openModal' ? 'mdl-typo-color-hex' : 'grd-typo-color-hex').value; }, opener);
      await typeInto(page, id, 'zz1234');
      const mid = await probe(page, id);
      expect(mid.invalid, `무효값인데 표시가 없다(칸: ${mid.value})`).toBe(true);
      await page.evaluate((i) => document.getElementById(i).blur(), id);
      const after = await probe(page, id);
      expect(after.value, `blur 뒤에도 «${after.value}» 가 칸에 남았다 — 신고 증상 그대로다`).toBe(before);
      expect(after.invalid, 'blur 로 되돌렸는데 무효 표시가 남았다').toBe(false);
    });
  }

  test('C-양성대조 ★유효값은 두 칸에서 실제로 먹는다 (계측기가 아니라 코드를 재고 있다)', async ({ page }) => {
    await page.evaluate(() => window.__openModal());
    await typeInto(page, 'mdl-typo-color-hex', '00FF00');
    const mdl = await page.evaluate(() => ({
      invalid: document.getElementById('mdl-typo-color-hex').classList.contains('prop-color-hex--invalid'),
      ds: window.__block.dataset.textColor,
    }));
    expect(mdl.invalid).toBe(false);
    expect(String(mdl.ds).toLowerCase(), `모달 글자색이 안 바뀌었다: ${mdl.ds}`).toMatch(/#00ff00|0,\s*255,\s*0/);
  });

  test('C-빈칸 ★「안 정했다」는 무효가 아니다 — blur 해도 역할 기본색이 «박히지» 않는다', async ({ page }) => {
    // ★이걸 안 재면 wireHexText 의 blur 복원이 placeholder 갈래를 값으로 굳혀 버린다
    //   (grid-typo.dom.spec 이 지키는 「한 번 튀면 데이터에 굳는다」 축과 같은 것).
    await page.evaluate(() => window.__openGridNoColor());
    const v0 = await probe(page, 'grd-typo-color-hex');
    expect(v0.value, '픽스처가 「색 안 정한 줄」이 아니다 — 이 검사는 아무 것도 안 재고 있다').toBe('');
    await page.locator('#grd-typo-color-hex').click();
    await page.evaluate(() => document.getElementById('grd-typo-color-hex').blur());
    const v1 = await probe(page, 'grd-typo-color-hex');
    expect(v1.value, `blur 만 했는데 «${v1.value}» 가 칸에 박혔다`).toBe('');
    expect(v1.invalid, '빈 칸에 무효 표시가 붙었다 — 「안 정했다」는 틀린 값이 아니다').toBe(false);
  });

  /* ── ③ Enter 로 확정된다 ──────────────────────────────────────────── */
  /* ⚠️«못 잰 축» — 이 하네스(Playwright 합성 Enter)에서는 픽스 «전»에도 Chromium 이 change 를 쏴서
     E1 이 초록이었다(음성대조 실패 = 빨강을 못 봤다). 이벨류에이터가 실앱 9524 에서 CDP 주입키로
     잰 「change 0건」을 여기서는 재현하지 못한다. ⇒ E1 은 «회귀 방지»로 남기고,
     이 라운드가 실제로 «더한» 것은 E2(내 keydown 커밋 + 브라우저 change 가 겹쳐 두 번 쌓이지 않는가)다. */
  test('E1 ★자유형식 배경칸은 Enter 로 «확정»된다 (회귀 방지 — 아래 주석의 «못 잰 축» 참고)', async ({ page }) => {
    await page.evaluate(() => { window.__openCard(); window.__block.dataset.textBg = '#ff0000'; window.showSimpleCardProperties(window.__block); });
    await typeInto(page, 'cvb-text-bg-raw', 'rgba(0,0,0,0.5)');
    const beforeEnter = await page.evaluate(() => window.__block.dataset.textBg);
    await page.locator('#cvb-text-bg-raw').press('Enter');
    const afterEnter = await page.evaluate(() => ({ ds: window.__block.dataset.textBg, active: document.activeElement?.id }));
    expect(beforeEnter.toLowerCase(), 'input 만으로 이미 커밋됐다면 이 검사는 Enter 를 안 재고 있다').toBe('#ff0000');
    expect(afterEnter.ds, `Enter 를 쳤는데 값이 안 들어갔다: ${afterEnter.ds}`).toBe('rgba(0,0,0,0.5)');
    expect(afterEnter.active, 'Enter 가 포커스를 빼앗았다 — 계속 고칠 수 있어야 한다').toBe('cvb-text-bg-raw');
  });

  test('E2 ★Enter 로 확정한 뒤 빠져나가도 히스토리가 «두 번» 쌓이지 않는다 (이 라운드가 더한 축)', async ({ page }) => {
    await page.evaluate(() => { window.__openCard(); window.__hist = 0; });
    await typeInto(page, 'cvb-icon-color-hex', '00FF00');
    await page.locator('#cvb-icon-color-hex').press('Enter');
    const h1 = await page.evaluate(() => window.__hist);
    await page.evaluate(() => document.getElementById('cvb-icon-color-hex').blur());
    const h2 = await page.evaluate(() => window.__hist);
    expect(h1, 'Enter 가 커밋을 안 했다').toBeGreaterThanOrEqual(1);
    expect(h2 - h1, `Enter 뒤 blur 가 «같은 값»을 또 커밋했다(되돌리기 두 칸) — ${h1} → ${h2}`).toBe(0);
  });

  test('E3 ★무효값 + Enter = change 와 같게 되돌린다 (Enter 가 «예외 통로»가 아니다)', async ({ page }) => {
    await page.evaluate(() => window.__openCard());
    const before = await probe(page, 'cvb-icon-color-hex');
    await typeInto(page, 'cvb-icon-color-hex', 'zz1234');
    await page.locator('#cvb-icon-color-hex').press('Enter');
    const after = await probe(page, 'cvb-icon-color-hex');
    expect(after.value, `Enter 로 무효값이 «통과»했다: ${after.value}`).toBe(before.value);
    expect(after.invalid).toBe(false);
  });

  /* ── ④ 표기 함수가 값을 망가뜨리지 않는다 ─────────────────────────── */
  test('F1 ★hex 도 transparent 도 아닌 CSS 를 대문자로 «망가뜨리지» 않는다', async ({ page }) => {
    // 음성대조(고치기 전): formatHex6OrTransparent('rgb(0,0,0)') = 'RGB(0,0,0)' → parse 실패 → 빨간 표시.
    await page.evaluate(() => {
      window.__openCard();
      window.__block.dataset.textBg = 'rgb(0,0,0)';       // 10자 — syncTextBgUI 가 hex 칸에 원문을 넣는 길이
      window.showSimpleCardProperties(window.__block);
    });
    const v0 = await probe(page, 'cvb-textbg-hex');
    expect(v0.value, `픽스처가 의도한 상태가 아니다(칸: ${v0.value})`).toBe('rgb(0,0,0)');
    await page.locator('#cvb-textbg-hex').click();
    await page.evaluate(() => document.getElementById('cvb-textbg-hex').blur());
    const v1 = await probe(page, 'cvb-textbg-hex');
    expect(v1.value, `blur 가 값을 망가뜨렸다: ${v1.value}`).toBe('rgb(0,0,0)');
    expect(v1.invalid, '멀쩡한 CSS 값에 빨간 무효 표시가 붙었다').toBe(false);
  });
});
