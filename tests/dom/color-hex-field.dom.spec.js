/* color-hex-field.dom.spec.js — 「색 코드 칸이 한 규약으로 도는가 + 값이 보이는가」(유닛 colorhex / 카드 T-100)
 *
 * ★왜 생겼나 (2026-09-20 «사용자 관점 훑기»)
 *   ① 같은 «색 코드» 칸인데 자리마다 규칙이 달랐다 — 섹션 배경은 `00FF00`(# 없이 6자),
 *      Heading 은 `#00FF00`(# 포함 7자). 어느 쪽이 맞는지 화면만 보고는 알 수 없다.
 *   ② 아무 글자나 넣어도 «말없이 무시»된다. 칸에는 쓴 값이 그대로 남아, 화면은 초록인데
 *      값은 안 바뀐 «거짓 상태»가 된다. 최악은 `sec-txt-*-hex`·`cvb-*-hex` — blur 복원조차 없어
 *      무효값이 영원히 칸에 박혀 있었다.
 *   ③ 에셋 «배경색» 칸이 16px 로 짜부라져 값 자체가 안 보인다(T-100). 패널 폭은 반응형이 아니라
 *      고정 240px 이므로 이건 «좁은 화면» 얘기가 아니라 항상 재현되는 결정론적 레이아웃 버그다.
 *
 * ★고친 모양 = «배선을 한 자리로»
 *   color-picker.js 의 wireHexText 하나가 (검증 → 실시간 적용 → 무효 표시 → blur 복원 → 커밋)을
 *   전부 맡고, 나머지 자리는 «문법»(6자리 hex / transparent 허용 / 자유 CSS)만 주입한다.
 *   문법이 다르다고 정규식을 하나로 우겨넣지 않는다 — 공유하는 것은 배선이지 문법이 아니다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(asset-panel-min-scale.dom.spec.js 와 같은 부팅).
 *   editor.js 는 통째로 끌어오면 에디터 전역이 필요해지므로 «같은 이름의 스텁»으로 갈아끼운다
 *   (prop-section.js 자기 코드는 레포 원본 그대로 돈다 — 베끼지 않는다).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js color-hex-field
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* editor.js 스텁 — prop-section.js 가 쓰는 다섯 이름만. (진짜 editor.js 는 4천 줄 전역 초기화라
   패널 한 장 재는 데 끌어오면 하네스가 앱이 된다.) */
const EDITOR_STUB = `
export const PRESETS = [{ id: 'default', name: '기본' }];
export const _presetsReady = Promise.resolve();
export function pushHistory() { window.__hist = (window.__hist || 0) + 1; }
export function rgbToHex(v) {
  const m = String(v || '').match(/rgba?\\((\\d+)[,\\s]+(\\d+)[,\\s]+(\\d+)/);
  if (!m) return '#000000';
  return '#' + [1,2,3].map(i => Number(m[i]).toString(16).padStart(2, '0')).join('');
}
export function getBlockBreadcrumb() { return 'Section'; }
`;

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/design-tokens.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>body{margin:0;display:flex}#canvas-wrap{flex:1}</style>
</head><body>
<div id="canvas-wrap"><div id="canvas"><div class="section-block" id="sec_x"><div class="section-inner" id="host" style="width:860px;"></div></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script type="module">
  import { showAssetProperties } from '/js/props/prop-asset.js';
  import { showSectionProperties } from '/js/props/prop-section.js';
  import '/js/props/prop-simple-card.js';
  window.getBlockBreadcrumb = () => 'Section > Row';
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx === 'true';
  window.pushHistory = () => { window.__hist = (window.__hist || 0) + 1; };
  window.scheduleAutoSave = () => {};
  window.renderCanvas = () => { window.__render = (window.__render || 0) + 1; };
  window.clearTextGradient = () => {};

  window.__openAsset = () => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const row = document.createElement('div'); row.className = 'row'; row.dataset.layout = 'stack';
    const ab = document.createElement('div'); ab.className = 'asset-block'; ab.id = 'ab_x';
    ab.dataset.align = 'center'; ab.style.alignSelf = 'center';
    ab.style.width = '600px'; ab.style.height = '400px';
    row.appendChild(ab); host.appendChild(row);
    showAssetProperties(ab);          // 이미지 없음 → 「배경색」 행이 있는 분기
    return ab;
  };

  window.__openSection = async () => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const tb = document.createElement('div'); tb.className = 'text-block'; tb.dataset.type = 'heading';
    const inner = document.createElement('div'); inner.contentEditable = 'true';
    inner.style.color = 'rgb(0, 0, 0)'; inner.textContent = '제목';
    tb.appendChild(inner); host.appendChild(tb);
    const sec = document.getElementById('sec_x');
    sec.dataset.bg = '#123456';
    await showSectionProperties(sec);
    return sec;
  };

  window.__openCard = () => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const b = document.createElement('div'); b.className = 'canvas-block'; b.id = 'cvb_x';
    b.dataset.cardMode = 'simple';
    b.dataset.iconMode = 'true';
    b.dataset.cards = JSON.stringify([{ title: '가', desc: '나' }]);
    host.appendChild(b);
    window.showSimpleCardProperties(b);
    return b;
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    if (url.pathname === '/js/editor.js') return route.fulfill({ contentType: 'text/javascript', body: EDITOR_STUB });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 칸에 글자를 «사람처럼» 넣는다 — input 이벤트가 실제로 뜬다. */
async function typeInto(page, id, text) {
  await page.evaluate((id) => { const el = document.getElementById(id); el.focus(); el.value = ''; }, id);
  await page.locator(`#${id}`).fill('');            // fill 은 input 1회
  await page.locator(`#${id}`).type(text, { delay: 5 });
}

/** 현재 칸 상태를 읽는다. */
const probe = (page, id) => page.evaluate((id) => {
  const el = document.getElementById(id);
  if (!el) return null;
  const r = el.getBoundingClientRect();
  return {
    value: el.value,
    w: Math.round(r.width),
    invalid: el.classList.contains('prop-color-hex--invalid') || el.getAttribute('aria-invalid') === 'true',
    maxlength: el.getAttribute('maxlength'),
  };
}, id);

test.describe('색 코드 칸 — 한 규약 · 무효값은 알리거나 되돌린다 · 값이 보인다', () => {
  let errs;
  test.beforeEach(async ({ page }) => { errs = await boot(page); });

  /* ── T0 하네스가 살아 있다 (본 단언 앞에) ─────────────────────────────── */
  test('T0 세 패널이 실제로 그려진다 — 이게 죽으면 아래 단언은 «없는 것»을 보며 초록이 된다', async ({ page }) => {
    const n = await page.evaluate(() => {
      window.__openAsset();
      const a = !!document.getElementById('asset-bg-hex');
      window.__openCard();
      const c = !!document.getElementById('cvb-icon-color-hex');
      return { a, c };
    });
    expect(n.a, '에셋 패널에 asset-bg-hex 가 없다').toBe(true);
    expect(n.c, '심플카드 패널에 cvb-icon-color-hex 가 없다').toBe(true);
    const s = await page.evaluate(async () => { await window.__openSection(); return !!document.getElementById('sec-bg-hex') && !!document.getElementById('sec-txt-heading-hex'); });
    expect(s, '섹션 패널에 sec-bg-hex / sec-txt-heading-hex 가 없다').toBe(true);
    expect(errs.join('\n'), '콘솔/페이지 오류').toBe('');
  });

  /* ── L: 레이아웃 — 「값이 안 보인다」(T-100) ────────────────────────── */
  test('L1 ★에셋 「배경색」 hex 칸이 240px 패널에서 최소폭을 지킨다 (T-100)', async ({ page }) => {
    // 음성대조(고치기 전): 「초기화」 버튼이 같은 flex 줄의 3번째 형제라 .prop-color-field 만 줄어
    //                     hex 칸이 ~10~16px 로 짜부라진다.
    await page.evaluate(() => window.__openAsset());
    const m = await probe(page, 'asset-bg-hex');
    expect(m, 'asset-bg-hex 가 없다').not.toBeNull();
    expect(m.w, `배경색 hex 칸이 ${m.w}px — 여섯 글자(RRGGBB)가 안 들어간다`).toBeGreaterThanOrEqual(50);
  });

  test('L2 음성대조 — 버튼 없는 형제 행(외곽선)은 원래 멀쩡했다', async ({ page }) => {
    await page.evaluate(() => window.__openAsset());
    const m = await probe(page, 'asset-stroke-color-hex');
    expect(m.w, '이 행이 애초에 좁았다면 L1 의 원인 지목이 틀린 것이다').toBeGreaterThanOrEqual(50);
  });

  test('L3 ★같은 뿌리 — 심플카드의 「투명」/「✕」 버튼이 붙은 색칸도 최소폭을 지킨다', async ({ page }) => {
    await page.evaluate(() => window.__openCard());
    for (const id of ['cvb-iconbg-hex', 'cvb-textbg-hex', 'cvb-text-bg-top-raw']) {
      const m = await probe(page, id);
      expect(m, `${id} 가 없다`).not.toBeNull();
      expect(m.w, `${id} 가 ${m.w}px`).toBeGreaterThanOrEqual(50);
    }
  });

  /* ── R: 규칙 통일 ──────────────────────────────────────────────────── */
  test('R1 ★네 자리의 «표시 규칙»이 같다 — 전부 # 없는 대문자 6자', async ({ page }) => {
    // 음성대조(고치기 전): sec-bg-hex='123456' vs sec-txt-heading-hex='#000000' — 같은 색칸인데 다른 말.
    const v = await page.evaluate(async () => {
      await window.__openSection();
      const g = id => document.getElementById(id)?.value;
      const out = { secBg: g('sec-bg-hex'), secTxt: g('sec-txt-heading-hex') };
      window.__openAsset();
      out.assetBg = g('asset-bg-hex');
      window.__openCard();
      out.icon = g('cvb-icon-color-hex');
      return out;
    });
    for (const [k, val] of Object.entries(v)) {
      expect(val, `${k} 의 표시값이 «# 없는 6자 대문자»가 아니다: ${JSON.stringify(val)}`).toMatch(/^[0-9A-F]{6}$/);
    }
  });

  test('R2 ★네 자리 모두 «# 를 붙여 써도» 받는다 (규칙을 외우지 않아도 된다)', async ({ page }) => {
    await page.evaluate(async () => { await window.__openSection(); });
    await typeInto(page, 'sec-txt-heading-hex', '#00FF00');
    const applied = await page.evaluate(() => document.querySelector('#host [contenteditable]').style.color);
    expect(applied, 'Heading 에 #00FF00 을 넣었는데 글자색이 안 바뀌었다').toMatch(/(0,\s*255,\s*0)|#00ff00/i);
  });

  /* ── V: 무효값 ─────────────────────────────────────────────────────── */
  const CASES = [
    ['asset-bg-hex', () => window.__openAsset()],
    ['sec-bg-hex', async () => { await window.__openSection(); }],
    ['sec-txt-heading-hex', async () => { await window.__openSection(); }],
    ['cvb-icon-color-hex', () => window.__openCard()],
  ];

  for (const [id] of CASES) {
    test(`V-${id} 무효값은 ① 안 먹고 ② 표시가 뜨고 ③ blur 로 되돌아간다`, async ({ page }) => {
      // 음성대조(고치기 전): ① 만 참이고 ②③ 은 거짓 — 칸에 zz1234 가 그대로 남는다
      //                     (sec-txt-*/cvb-* 는 blur 핸들러 자체가 없었다).
      const open = CASES.find(c => c[0] === id)[1];
      await page.evaluate(async (which) => {
        if (which === 'asset-bg-hex') window.__openAsset();
        else if (which === 'cvb-icon-color-hex') window.__openCard();
        else await window.__openSection();
      }, id);
      const before = (await probe(page, id)).value;
      await typeInto(page, id, 'zz1234');
      const mid = await probe(page, id);
      expect(mid.invalid, `무효값인데 아무 표시가 없다 — 사용자는 «먹었다»고 읽는다 (칸 값: ${mid.value})`).toBe(true);
      await page.evaluate((id) => document.getElementById(id).blur(), id);
      const after = await probe(page, id);
      expect(after.value, `blur 했는데 무효값 «${after.value}» 이 칸에 남아 있다`).toBe(before);
      expect(after.invalid, 'blur 로 되돌렸는데 무효 표시가 남았다').toBe(false);
    });
  }

  test('V-부분입력 — 여섯 자를 다 못 친 상태(12345)도 무효로 표시된다', async ({ page }) => {
    await page.evaluate(() => window.__openAsset());
    await typeInto(page, 'asset-bg-hex', '12345');
    const m = await probe(page, 'asset-bg-hex');
    expect(m.invalid, '5자는 색이 아니다 — 표시가 있어야 한다').toBe(true);
  });

  test('V-양성대조 ★유효값은 표시 없이 «실제로» 먹는다', async ({ page }) => {
    await page.evaluate(() => window.__openAsset());
    await typeInto(page, 'asset-bg-hex', 'FF0000');
    const m = await probe(page, 'asset-bg-hex');
    expect(m.invalid, '유효값에 무효 표시가 붙었다 — 계측기가 아니라 검사가 틀린 것이다').toBe(false);
    const sw = await page.evaluate(() => document.getElementById('asset-bg-color').closest('.prop-color-swatch').style.background);
    expect(sw, `스와치가 안 따라왔다: ${sw}`).toMatch(/rgb\(255,\s*0,\s*0\)|#ff0000/i);
  });

  test('V-transparent ★「transparent」를 받는 칸은 그 단어도 유효값이다 (문법은 자리마다 다르다)', async ({ page }) => {
    await page.evaluate(() => window.__openCard());
    await typeInto(page, 'cvb-iconbg-hex', 'transparent');
    const m = await probe(page, 'cvb-iconbg-hex');
    expect(m.invalid, '이 칸의 문법에는 transparent 가 들어 있다 — 무효로 막으면 기능이 죽는다').toBe(false);
  });
});
