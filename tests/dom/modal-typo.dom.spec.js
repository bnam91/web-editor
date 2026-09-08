/* modal-typo.dom.spec.js — 모달 타이포의 «진짜 끝». (2026-09-08, B단위)
 *
 * ★왜 필요한가
 *   모달의 진실은 dataset 이고, `renderModalBlock` 은 `block.innerHTML = html` 로
 *   슬롯을 «통째로 새로» 만든다. 그래서 텍스트 패널의 관례를 베껴 슬롯에 인라인을 박으면
 *   «첫 측정은 통과하고» 재렌더에서 조용히 죽는다.
 *   ⇒ 여기서는 «사람이 보는 것»(getComputedStyle)으로, 그리고 «재렌더 한 번 더» 뒤에 잰다.
 *
 * ★그리고 «패널 경로»로 잰다 — 함수를 직접 부르지 않고 진짜 컨트롤에 진짜 이벤트를 쏜다.
 *   결함이 사는 곳은 그 핸들러다. 함수만 직접 부르면 배선을 끊어도 초록이다.
 *
 * ⚠️⚠️★이 파일은 «변이를 잡는 그물이 아니다».
 *   tests/dom 은 playwright 라 `node --test "tests/unit/*"` 스위트에 «안 들어간다».
 *   변이를 빨갛게 만드는 책임은 tests/unit/modal-typo-model.test.mjs 와
 *   tests/unit/typo-section-ssot.test.mjs 가 진다.
 *   여기는 「진짜 계산 스타일로 «한 번은» 잰다」를 레포에 남기는 자리다.
 *   (선례이자 이웃: modal-variant.dom.spec.js — 같은 말을 자기 머리에 적어 뒀다.)
 *
 * ★BASE 와 HEAD 를 «같은 잣대로 둘 다» 잰다 (DOM-⑤)
 *   「넘침 0건」만 재면 「원래 0이었나 내가 고쳤나」가 안 갈린다.
 *   그래서 base(20cfe5a)의 prop-modal.js 를 같은 하네스에 얹어 «1건»을 실측하고,
 *   HEAD 에서 «0건»을 실측해 1 → 0 을 증명한다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js modal-typo
 */
const { test, expect } = require('@playwright/test');
const { execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const BASE_REF = '20cfe5a';                 // A단위 위 = 이 작업의 바닥
const PANEL_REL = 'js/props/prop-modal.js';
/* ★헤드리스 크로미움엔 queryLocalFonts 가 없다 ⇒ «설치 폰트»(Georgia 등)가 목록에 안 뜬다.
   그래서 _FP_STATIC 에 «항상» 있는 폰트로 고른다. 실물 앱에선 Georgia 로도 확인했다. */
const PICK_FONT = 'Playfair Display';

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* ★패널 폭을 «실물과 같은 240px» 로 만든다 — editor-panels.css 가 --panel-right-w 로 잡는 값.
   넘침은 폭에 달린 측정이라, 폭을 안 맞추면 이 검사는 아무 뜻이 없다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script type="module">
  import { makeModalBlock, renderModalBlock } from '/js/blocks/modal-block.js';
  import { showModalProperties } from '/js/props/prop-modal.js';
  window.__mk = makeModalBlock;
  window.__render = renderModalBlock;
  window.__open = showModalProperties;
  window.__ready = true;
</script></body></html>`;

/** base 판 prop-modal.js — git 에서 «그 커밋의 실물»을 꺼낸다(사본을 손으로 안 만든다). */
function basePanelSrc() {
  return execFileSync('git', ['show', `${BASE_REF}:${PANEL_REL}`], { cwd: REPO, encoding: 'utf8' });
}

/**
 * @param {'head'|'base'} which  어느 판의 패널을 얹을지
 */
async function boot(page, which = 'head') {
  const baseSrc = which === 'base' ? basePanelSrc() : null;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({ contentType: 'text/html', body: HARNESS });
    }
    // ★base 측정일 때만 패널 «한 파일»을 갈아끼운다. 나머지는 전부 레포의 진짜 파일이다.
    if (baseSrc && url.pathname === '/' + PANEL_REL) {
      return route.fulfill({ contentType: 'text/javascript', body: baseSrc });
    }
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 모달 하나를 캔버스에 올리고 패널을 «연다» — 여기서부터는 사용자와 같은 경로다. */
async function mountAndOpen(page, variant = 'titled') {
  await page.evaluate((v) => {
    const { row, block } = window.__mk({ variant: v });
    document.getElementById('host').appendChild(row);
    window.__block = block;
    window.__open(block);
  }, variant);
}

/** ★계산된 스타일 — dataset 이 아니라 «사람이 보는 것»을 잰다. */
const slotStyle = (page, sel = '.tb-mdl-text') => page.evaluate((s) => {
  const el = window.__block.querySelector(s);
  if (!el) return null;
  const c = getComputedStyle(el);
  return { ff: c.fontFamily, color: c.color, fs: c.fontSize, fw: c.fontWeight,
           lh: c.lineHeight, ls: c.letterSpacing, fst: c.fontStyle, bg: c.backgroundColor };
}, sel);

/** 패널 안의 «가로로 잘리는» 요소들. 폭이 0 인 것은 안 센다(숨은 요소). */
const overflows = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const all = [...body.querySelectorAll('*')];
  return {
    panelW: body.clientWidth,
    scanned: all.length,
    list: all.filter((e) => e.scrollWidth > e.clientWidth && e.clientWidth > 0)
             .map((e) => ({ cls: String(e.className).slice(0, 40), sw: e.scrollWidth, cw: e.clientWidth,
                            txt: (e.textContent || '').trim().slice(0, 34) })),
  };
});

/* ══ DOM-⓪ — 「입력이 살아 있다」. ⛔이게 없으면 아래가 전부 자가통과한다. ══ */

test('DOM-⓪ ★변형 6개 + 컬러변수 칩이 «실재»한다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);
  const seen = await page.evaluate(() => ({
    variants: [...document.querySelectorAll('#mdl-variant option')].map((o) => o.value),
    chips: document.querySelectorAll('#mdl-typo-color-chips .cv-chip').length,
    chipsHidden: document.getElementById('mdl-typo-color-chips')?.hidden,
  }));
  console.log('  입력:', seen);
  expect(seen.variants.length).toBeGreaterThanOrEqual(6);
  /* ⛔칩이 0이면 「칩이 먹는가」를 재는 DOM-④ 가 «한 바퀴도 안 돌면서» 초록이 된다. */
  expect(seen.chips).toBeGreaterThanOrEqual(1);
  expect(seen.chipsHidden).toBe(false);
  expect(errs).toEqual([]);
});

/* ══ DOM-① — 절이 «실제 DOM 에» 있다 ═══════════════════════════════════════ */

test('DOM-① ★Typography·Fill 절의 컨트롤 13종이 실제 DOM 에 있다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);
  const missing = await page.evaluate(() => {
    const need = ['mdl-typo-font-trigger', 'mdl-typo-font-weight', 'mdl-typo-size-number',
      'mdl-typo-bold-btn', 'mdl-typo-italic-btn', 'mdl-typo-strike-btn', 'mdl-typo-highlight-btn',
      'mdl-typo-lh-number', 'mdl-typo-ls-number',
      'mdl-typo-color', 'mdl-typo-color-hex', 'mdl-typo-color-alpha', 'mdl-typo-color-chips'];
    return need.filter((id) => !document.getElementById(id));
  });
  expect(missing).toEqual([]);
  // ★지운 것도 «지워졌는지» 본다 — 옛 행이 되살아나면 같은 뜻의 컨트롤이 둘이 된다.
  const ghosts = await page.evaluate(() => ['mdl-fs-slider', 'mdl-fs-number', 'mdl-fg-color']
    .filter((id) => !!document.getElementById(id)));
  expect(ghosts).toEqual([]);
  expect(errs).toEqual([]);
});

/* ══ DOM-② — ★먹는다 그리고 ★★재렌더를 견딘다 ═════════════════════════════ */

test('DOM-② ★★패널로 바꾼 타이포가 «재렌더 한 번 더» 뒤에도 그대로다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);

  const before = await slotStyle(page);
  console.log('  손대기 전:', before);

  // ── 사용자와 «같은 경로»로 바꾼다 ──
  await page.click('#mdl-typo-font-trigger');
  await page.evaluate((want) => {
    const it = [...document.querySelectorAll('#mdl-typo-font-list .font-item')]
      .find((i) => i.textContent.includes(want));
    if (!it) throw new Error(`폰트 목록에 ${want} 가 없다 — 이 검사는 지금 아무것도 안 보고 있다`);
    it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }, PICK_FONT);
  const hex = page.locator('#mdl-typo-color-hex');
  await hex.fill('ff0000');
  await hex.dispatchEvent('input');
  await page.selectOption('#mdl-typo-font-weight', '700');
  const lh = page.locator('#mdl-typo-lh-number');
  await lh.fill('2.5'); await lh.dispatchEvent('change');
  const ls = page.locator('#mdl-typo-ls-number');
  await ls.fill('4'); await ls.dispatchEvent('change');

  const after = await slotStyle(page);
  console.log('  패널로 바꾼 직후:', after);
  expect(after.ff).toContain(PICK_FONT);
  expect(after.color).toBe('rgb(255, 0, 0)');
  expect(after.fw).toBe('700');
  expect(after.lh).toBe('90px');            // 36 × 2.5
  expect(after.ls).toBe('4px');

  /* ★★여기가 이 파일의 존재 이유다.
     슬롯 인라인에 박는 배선이면 여기서 «전부 증발»한다 — innerHTML 이 통째로 갈린다. */
  await page.evaluate(() => window.__render(window.__block));
  const survived = await slotStyle(page);
  console.log('  ★재렌더 한 번 더 뒤:', survived);
  expect(survived).toEqual(after);
  expect(errs).toEqual([]);
});

test('DOM-②b ★양성대조 — 슬롯에 «직접» 박은 것은 재렌더에서 실제로 죽는다', async ({ page }) => {
  await boot(page);
  await mountAndOpen(page);
  // 「슬롯에 인라인으로 박는」 배선이 하는 짓을 흉내낸다.
  const injected = await page.evaluate((want) => {
    const el = window.__block.querySelector('.tb-mdl-text');
    el.style.fontFamily = `${want}, serif`;
    return getComputedStyle(el).fontFamily;
  }, PICK_FONT);
  expect(injected).toContain(PICK_FONT);     // ⛔주입이 «먹었는지»부터 확인한다
  await page.evaluate(() => window.__render(window.__block));
  const gone = await page.evaluate(() => getComputedStyle(window.__block.querySelector('.tb-mdl-text')).fontFamily);
  console.log('  슬롯 인라인, 재렌더 뒤:', gone);
  expect(gone).not.toContain(PICK_FONT);
});

/* ══ DOM-③ — 예상버그⑵ 제목 굵기 (CSS 700 을 이기는가) ════════════════════ */

test('DOM-③ ★titled 제목도 굵기를 따라간다 — .tb-mdl-title{font-weight:700} 을 이긴다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page, 'titled');

  const t0 = await slotStyle(page, '.tb-mdl-title');
  expect(t0.fw).toBe('700');                 // 안 정했으면 CSS 의 «제목은 굵다»가 산다

  await page.selectOption('#mdl-typo-font-weight', '300');
  const t1 = await slotStyle(page, '.tb-mdl-title');
  const b1 = await slotStyle(page, '.tb-mdl-text');
  console.log('  굵기 300 — 제목:', t1.fw, '/ 본문:', b1.fw);
  /* ★루트 인라인 굵기는 «상속»으로 내려오는데, 선택자가 붙은 CSS 규칙을 못 이긴다.
     그래서 제목에는 «인라인으로» 같은 값을 박는다. 그게 빠지면 여기서 700 이 나온다. */
  expect(t1.fw).toBe('300');
  expect(b1.fw).toBe('300');

  await page.evaluate(() => window.__render(window.__block));
  expect((await slotStyle(page, '.tb-mdl-title')).fw).toBe('300');
  expect(errs).toEqual([]);
});

/* ══ DOM-④ — 예상버그⑸ 컬러변수 칩이 «먹는가» ════════════════════════════ */

test('DOM-④ ★컬러변수 칩을 누르면 실제 색이 바뀌고, hex 칸은 «풀린 hex» 를 보여 준다', async ({ page }) => {
  const errs = await boot(page);
  await mountAndOpen(page);

  await page.click('#mdl-typo-color-chips .cv-chip');
  const seen = await page.evaluate(() => ({
    ds: window.__block.dataset.textColor,
    color: getComputedStyle(window.__block.querySelector('.tb-mdl-text')).color,
    hexField: document.getElementById('mdl-typo-color-hex').value,
    picker: document.getElementById('mdl-typo-color').value,
    active: !!document.querySelector('#mdl-typo-color-chips .cv-chip.active'),
  }));
  console.log('  칩 클릭 뒤:', seen);
  /* ⛔_MDL_COLOR_RE 가 var() 를 거부하면 dataset 이 안 박히고 「눌리는데 안 먹는」 상태가 된다. */
  expect(seen.ds).toMatch(/^var\(--color-/);
  expect(seen.color).not.toBe('rgb(28, 28, 30)');       // 기본 글자색에서 실제로 벗어났다
  /* ⛔raw 를 hex 칸에 꽂으면 「VAR(--COLOR」가 «글자로» 뜨고 input[type=color] 는 검정이 된다. */
  expect(seen.hexField).toMatch(/^[0-9A-F]{6}$/);
  expect(seen.picker).toMatch(/^#[0-9a-f]{6}$/);
  expect(seen.active).toBe(true);

  await page.evaluate(() => window.__render(window.__block));
  const after = await page.evaluate(() => getComputedStyle(window.__block.querySelector('.tb-mdl-text')).color);
  expect(after).toBe(seen.color);                        // 재렌더를 견딘다
  expect(errs).toEqual([]);
});

/* ══ DOM-⑤ — ★넘침 «1 → 0». base 와 head 를 «같은 잣대»로 둘 다 잰다 ══════ */

test('DOM-⑤ ★패널 가로 넘침이 base 1건 → head 0건 (같은 잣대로 둘 다 쟀다)', async ({ page }) => {
  /* ⛔「head 가 0건」만 재면 «원래 0이었나 내가 고쳤나»가 안 갈린다.
     그래서 base(20cfe5a)의 prop-modal.js 를 같은 하네스에 얹어 먼저 잰다. */
  await boot(page, 'base');
  await mountAndOpen(page);
  const base = await overflows(page);
  console.log(`  BASE(${BASE_REF}) 패널 ${base.panelW}px · 자손 ${base.scanned}개 · 넘침 ${base.list.length}건`,
    base.list);
  expect(base.panelW).toBeGreaterThan(200);      // 폭을 못 맞췄으면 이 측정은 무의미하다
  expect(base.list.length).toBe(1);
  expect(base.list[0].txt).toContain('더블클릭해 입력');
  expect(base.list[0].sw).toBeGreaterThan(base.list[0].cw);
});

test('DOM-⑤b ★HEAD 는 넘침 0건 — 그 안내문 행을 지웠다', async ({ page }) => {
  const errs = await boot(page, 'head');
  await mountAndOpen(page);
  const head = await overflows(page);
  console.log(`  HEAD 패널 ${head.panelW}px · 자손 ${head.scanned}개 · 넘침 ${head.list.length}건`, head.list);
  expect(head.panelW).toBeGreaterThan(200);
  /* ⛔자손이 0개면 「넘침 0건」은 «아무것도 안 본» 0이다. 세는 대상이 있음을 먼저 세운다. */
  expect(head.scanned).toBeGreaterThan(50);
  expect(head.list).toEqual([]);
  // 그 안내문 자체가 사라졌는지도 본다(폭만 줄여 숨긴 게 아니라 «지웠다»).
  expect(await page.evaluate(() => document.body.innerText.includes('더블클릭해 입력'))).toBe(false);
  expect(errs).toEqual([]);
});

test('DOM-⑤c ★양성대조 — 그 행을 도로 넣으면 잣대가 «실제로» 1건을 잡는다', async ({ page }) => {
  /* ⛔넘침 0건이 「잣대가 죽어서」일 수도 있다. 그 가능성을 여기서 없앤다. */
  await boot(page, 'head');
  await mountAndOpen(page);
  expect((await overflows(page)).list).toEqual([]);
  await page.evaluate(() => {
    const sec = document.querySelector('#panel-right .panel-body .prop-section');
    const row = document.createElement('div');
    row.className = 'prop-row';
    row.innerHTML = '<span class="prop-label" style="opacity:.6">글자는 캔버스에서 더블클릭해 입력</span>';
    sec.appendChild(row);
  });
  const withRow = await overflows(page);
  console.log('  안내문을 도로 넣었을 때:', withRow.list);
  expect(withRow.list.length).toBe(1);
  expect(withRow.list[0].txt).toContain('더블클릭해 입력');
});

/* ══ DOM-⑥ — 텍스트 패널이 «안 깨졌다» (부품 추출의 뒷면) ═════════════════ */

test('DOM-⑥ ★공유 부품을 쓰는 텍스트 패널도 그대로 뜨고 폰트가 «먹는다»', async ({ page }) => {
  /* 추출은 텍스트 패널을 안 건드리는 것이 조건이었다. 골든 비교(unit)가 «마크업»을 지키고,
     여기서는 «배선»이 살아 있는지를 실물로 본다 — 위젯을 공유했으니 회귀가 날 자리다. */
  const errs = await boot(page);
  await page.evaluate(async () => {
    const m = await import('/js/props/prop-text-template.js');
    const w = await import('/js/props/prop-text-wireup-font.js');
    const host = document.querySelector('#panel-right .panel-body');
    const tb = document.createElement('div');
    tb.id = 'tb_dom'; tb.className = 'text-block';
    const content = document.createElement('div');
    content.contentEditable = 'true'; content.textContent = '추출 확인용';
    tb.appendChild(content);
    document.getElementById('host').appendChild(tb);
    window.getBlockBreadcrumb = () => 'Section 1';
    host.innerHTML = m.buildTextPropsHtml({
      tb, isOverlayTb: false, currentClass: 'tb-body', currentAlign: 'left',
      currentX: 0, currentY: 0, currentRotation: 0, currentW: 300,
      currentFont: '', currentWeight: '400', currentSize: 16,
      currentLH: 1.5, currentLS: 0, currentColor: '#1a1a1a', currentColorAlpha: 100,
      currentPadT: 0, currentPadL: 0, currentPadR: 0, phLinked: false,
      isLabel: false, currentBgColor: '#fff', currentRadius: 0, labelPillH: 24,
      isSpeechBubble: false, currentBubbleStyle: 'round', currentTail: 'left',
      bubbleBgHex: '#fff', showSender: false, senderName: '',
      isIconText: false, currentItbGap: 8,
      mix: { color: { mixed: false }, fontSize: { mixed: false }, fontWeight: { mixed: false } },
      shadow: { enabled: false, x: 2, y: 2, blur: 4, color: '#000000', alpha: 50 },
      isLiner: false, isStrike: false, isBold: false, isItalic: false, isHighlight: false,
    });
    w.wireFontSection({ propPanel: host, ctx: { contentEl: content } });
    window.__content = content;
  });

  const ids = await page.evaluate(() => ['txt-font-trigger', 'txt-font-weight', 'txt-size-number',
    'txt-bold-btn', 'txt-lh-number', 'txt-ls-number', 'txt-color', 'txt-color-hex', 'txt-color-chips']
    .filter((i) => !document.getElementById(i)));
  expect(ids).toEqual([]);

  // ★공유 위젯이 텍스트 쪽 «적용»(인라인 style + rawFont)을 그대로 하는가
  await page.click('#txt-font-trigger');
  await page.evaluate((want) => {
    const it = [...document.querySelectorAll('#txt-font-list .font-item')]
      .find((i) => i.textContent.includes(want));
    if (!it) throw new Error(`폰트 목록에 ${want} 가 없다 — 위젯이 안 떴다`);
    it.dispatchEvent(new MouseEvent('mousedown', { bubbles: true }));
  }, PICK_FONT);
  const seen = await page.evaluate(() => ({
    inline: window.__content.style.fontFamily,
    raw: window.__content.dataset.rawFont,
    computed: getComputedStyle(window.__content).fontFamily,
    label: document.getElementById('txt-font-name').textContent,
  }));
  console.log('  텍스트 패널 폰트 적용:', seen);
  /* ★모달은 dataset 에, 텍스트는 «인라인 style + rawFont» 에 — 위젯을 공유해도 이 갈림은 유지된다. */
  expect(seen.inline).toContain(PICK_FONT);
  expect(seen.raw).toContain(PICK_FONT);
  expect(seen.computed).toContain(PICK_FONT);
  expect(seen.label).toBe(PICK_FONT);
  expect(errs).toEqual([]);
});
