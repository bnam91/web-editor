/* grid-typo.dom.spec.js — 그리드 «줄 단위» 타이포·필의 진짜 끝. (2026-09-08)
 *
 * ★왜 필요한가
 *   그리드의 진실은 dataset 이고 renderGridBlock 은 `block.innerHTML = html` 로 «통째로»
 *   새로 만든다. 그래서 DOM 인라인에 박는 배선은 «첫 측정을 통과하고 조용히 죽는다».
 *   ⇒ 여기서는 getComputedStyle 로, 그리고 «재렌더 한 번 더» 뒤에 잰다(D1-c).
 *
 * ⚠️⚠️★이 파일은 «변이를 잡는 그물이 아니다» — tests/dom 은 playwright 라
 *   `node --test "tests/unit/*"` 스위트에 «안 들어간다». 변이 책임은
 *   tests/unit/grid-line-typo.test.js 가 진다. 여기는 「진짜 계산 스타일로 «한 번은» 잰다」 자리다.
 *
 * ★하네스는 CSS 를 «내가 얹은 만큼»만 갖는다 — 덜 얹으면 실물보다 관대하다.
 *   editor-canvas(섹션 흰 배경!)까지 «전부» 얹는다.
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-typo
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-canvas.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/color-picker.css">
<link rel="stylesheet" href="/css/editor-blocks.css"></head><body>
<div id="canvas"><div class="section-block"><div class="section-inner" id="host"></div></div></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/design-system.js"></script>
<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
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
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ★픽스처 — 계획서 §5 그대로: 2열 × 2행 · 셀마다 3줄 · 뱃지 1 · 빈 줄 1 · gap 1 · 명시색 1.
   갈래를 «전부» 담아야 계수기가 어느 갈래에서 눈이 머는지 드러난다. */
const FIXTURE = {
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

async function mount(page) {
  await page.evaluate((fx) => {
    const { row, block } = window.__mk(fx);
    document.getElementById('host').appendChild(row);
    block.classList.add('selected');
    window.__block = block;
  }, FIXTURE);
}

/** 패널을 «그 줄»로 연다 — 사용자의 클릭이 부르는 것과 «같은» 함수·같은 인자. */
const open = (page, addr) => page.evaluate((a) => window.__open(window.__block, a), addr);

/* ★§6 계수기 — 「한 줄」의 글자를 담는 요소는 «한 종류가 아니다».
   ⛔[data-line] 의 computed style 로 재면 뱃지 줄은 font-size 가 «영원히 안 변해»
     「끔 0 / 켬 0 → 0==0」으로 조용히 통과한다. hostOf 는 _gridEditable 과 «같은» 술어다. */
const SNAP_FN = `(() => {
  const hostOf = (lineEl) => lineEl.classList.contains('grd-line')
    ? lineEl
    : lineEl.querySelector(':scope > .grd-badge');
  const PROPS = ['font-size','font-weight','line-height','letter-spacing','color',
                 'text-align','font-family','font-style','text-decoration-line'];
  const out = {};
  for (const el of window.__block.querySelectorAll('[data-line]')) {
    const host = hostOf(el);
    const key = '(' + el.dataset.r + ',' + el.dataset.c + ',' + el.dataset.line + ')';
    if (!host) { out[key] = 'NO-HOST'; continue; }
    const cs = getComputedStyle(host);
    out[key] = PROPS.map(p => p + '=' + cs.getPropertyValue(p)).join('|');
  }
  return out;
})()`;
const snap = (page) => page.evaluate(SNAP_FN);
const diffKeys = (a, b) => Object.keys(b).filter(k => a[k] !== b[k]);

/* ══ D1-a — §6 양성대조. 본 측정 «앞»에 선다. ═══════════════════════════ */

test('D1-a ★계수기가 «옆 줄»의 변화를 실제로 잡는다 (뱃지 줄 포함) — 본 측정의 전제', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);

  const snapA = await snap(page);
  expect(Object.keys(snapA).length, '[data-line] 요소를 못 찾았다 — 계수기가 죽었다').toBeGreaterThanOrEqual(11);
  /* ★갈래를 «각각» 확인한다 — 「NO-HOST 가 0건」으로 재면 틀린다: gap 줄은 NO-HOST 가 «정답»이다.
     세기 전에 이름을 확인한다는 게 이 뜻이다(팀이 path vs polygon 으로 밟은 함정의 그리드판). */
  expect(snapA['(0,1,2)'], '★뱃지 줄의 host(span.grd-badge)를 못 봤다 — 그러면 그 줄은 «영원히 안 변해» ' +
    '「끔 0 / 켬 0 → 0==0」으로 조용히 통과한다').not.toBe('NO-HOST');
  expect(snapA['(0,1,2)'], '뱃지 줄에서 label 역할값(16px)이 안 읽힌다 — 바깥 정렬 래퍼를 재고 있다')
    .toContain('font-size=16px');
  expect(snapA['(1,0,1)'], '★gap 줄이 host 를 갖는다고 나온다 — 계수기가 «글자 없는 줄»을 구분 못 한다')
    .toBe('NO-HOST');
  expect(snapA['(0,0,2)'], '빈 줄(text:"")이 계수 대상에서 빠졌다').not.toBe('NO-HOST');

  // 이웃을 «일부러» 움직인다 — 패널이 아니라 API 로, 대상 줄이 아닌 «(0,1,2) 뱃지 줄»에.
  await page.evaluate(() => window.__block && window.updateGridBlock(window.__block.id,
    { patchCell: { r: 0, c: 1, lineIndex: 2, fontSize: 47, color: '#ff0000' } }));
  const snapB = await snap(page);
  const d = diffKeys(snapA, snapB);
  expect(d, `★변화가 ${d.length}건이다(1건이어야). 0 이면 계수기가 뱃지의 span 을 못 본 것이고, ` +
    `2 이상이면 patchCell 이 이웃까지 만진 것이다`).toEqual(['(0,1,2)']);

  // 되돌리면 원래 스냅샷과 «같아진다» — 계수기의 되돌림 감지까지 증명한다.
  await page.evaluate(() => window.updateGridBlock(window.__block.id,
    { patchCell: { r: 0, c: 1, lineIndex: 2, fontSize: undefined, color: undefined } }));
  expect(diffKeys(snapA, await snap(page)), '되돌렸는데 스냅샷이 안 돌아온다').toEqual([]);
  expect(errs).toEqual([]);
});

/* ══ D1-b — 패널이 «그 줄의 현재 값»으로 채워 나온다 ═══════════════════ */

test('D1-b ★칸.value || 칸.placeholder 가 «전부» 비어 있지 않다 (§4-B 실패식)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 1, li: 1 });          // body + 명시색 #ff0000

  const got = await page.evaluate(() => {
    const ids = ['grd-typo-size-number', 'grd-typo-lh-number', 'grd-typo-ls-number', 'grd-typo-color-hex'];
    const out = {};
    for (const id of ids) {
      const el = document.getElementById(id);
      out[id] = el ? { value: el.value, ph: el.getAttribute('placeholder') || '' } : null;
    }
    return out;
  });

  for (const [id, v] of Object.entries(got)) {
    expect(v, `${id} 칸이 아예 없다 — 절이 안 떴다`).not.toBeNull();
    expect((v.value || v.ph), `★${id} 이 «회색조차» 아니다 — 진짜로 「빈 채로 떴다」. ` +
      `어댑터가 역할 폴백을 안 하고 있다`).not.toBe('');
  }
  // ★구분이 «살아 있다»: 안 정한 것은 value 가 비고 placeholder 만 있다(굳어버리기 방지).
  expect(got['grd-typo-size-number'].value, 'size 에 역할 기본값이 «값으로» 박혔다 — 한 번 튀면 데이터에 굳는다').toBe('');
  expect(got['grd-typo-size-number'].ph, 'body 역할 크기 22 가 회색으로 안 보인다').toBe('22');
  // 명시한 색은 «값»으로 보인다.
  expect(got['grd-typo-color-hex'].value).toBe('FF0000');

  /* ★색을 «안 정한» 줄도 따로 본다 — 위 줄은 색이 명시돼 있어 hex 의 «placeholder 갈래»를
     전혀 안 지난다. 갈래마다 검사를 세워야 한다(안 그러면 colorHexPh 를 지워도 초록이다). */
  await open(page, { r: 0, c: 0, li: 1 });          // h2 · 색 미지정
  const noColor = await page.evaluate(() => {
    const el = document.getElementById('grd-typo-color-hex');
    return { value: el.value, ph: el.getAttribute('placeholder') || '' };
  });
  expect(noColor.value, '★색을 안 정했는데 hex 에 값이 «박혀» 있다 — 한 번 튀면 데이터에 굳는다').toBe('');
  expect(noColor.ph, '★역할 기본색(h2 #1a1a1a)이 회색으로 «안» 보인다 — 어느 칸도 회색조차 아니면 ' +
    '그게 진짜 「빈 채로 떴다」다').toBe('1A1A1A');
  expect(errs).toEqual([]);
});

/* ══ D1-c — 진짜 change 로 «대상 줄만» 변한다 + 재렌더 뒤에도 살아 있다 ══ */

test('D1-c ★패널 입력 → 대상 줄만 변화, 그리고 «재렌더 한 번 더» 뒤에도 그대로다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 0, li: 1 });

  const snapA = await snap(page);
  await page.fill('#grd-typo-size-number', '55');
  await page.dispatchEvent('#grd-typo-size-number', 'change');
  await page.fill('#grd-typo-lh-number', '2.5');
  await page.dispatchEvent('#grd-typo-lh-number', 'change');

  const snapB = await snap(page);
  expect(diffKeys(snapA, snapB), '★대상 줄 «하나»만 변해야 한다').toEqual(['(0,0,1)']);
  expect(snapB['(0,0,1)']).toContain('font-size=55px');

  /* ★2차 측정 — renderGridBlock 을 «한 번 더» 부른다. 배선이 DOM 인라인에만 썼다면
     여기서 죽는다(prop-modal 교훈: 「첫 측정을 통과하고 조용히 죽는다」). */
  await page.evaluate(() => window.__render(window.__block));
  const snapC = await snap(page);
  expect(snapC['(0,0,1)'], '★재렌더에서 값이 날아갔다 — 배선이 dataset 이 아니라 DOM 인라인에 썼다')
    .toBe(snapB['(0,0,1)']);
  expect(errs).toEqual([]);
});

/* ══ D7 — pushHistory 는 «적용 전»에, 제스처당 «1회» ═══════════════════
 * 계획서 §4-C 가 「이 작업 최대의 함정」이라 부른 자리인데 실측(적대 검수) 결과
 *   const commit = (fields) => { begin(); setLine(fields); end(); };
 *   → { setLine(fields); begin(); end(); }   (순서 뒤집기)
 * 로 바꿔도 npm test 1851 · test:dom 64 «전부 초록»이었다. 코드는 맞게 짰고 주석도 길게
 * 달았는데 «기계는 아무것도 안 지키고» 있었다.
 *
 * ★뒤에 부르면 스냅샷이 «이미 바뀐 상태»라 undo 가 두 단계를 한꺼번에 되돌린다 —
 *   이 레포엔 moveSection 에 그 버그가 «실재»한다. 그걸 재도입하는 변이다.
 * ⇒ 「호출 «횟수»」와 「호출 «시점»의 dataset」을 둘 다 잰다. 횟수만 재면 순서 뒤집기를 못 잡는다. */

test('D7 ★연속 input 3회 + change 1회 → pushHistory «1회», 그리고 그 시점 dataset 이 «변경 전»', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 0, li: 0 });         // body · 색 미지정

  const r = await page.evaluate(async () => {
    const B = window.__block;
    const calls = [];
    const real = window.pushHistory;
    // ★스파이 — 부를 때마다 «그 시점의» dataset 을 통째로 찍는다. 시점을 안 찍으면 순서를 못 잰다.
    window.pushHistory = function (...a) { calls.push(B.dataset.cols); return real?.apply(this, a); };

    const before = B.dataset.cols;
    const pick = document.getElementById('grd-typo-color');
    // 색 피커를 «드래그»하는 흉내 — 연속 input 3회, 그다음 change 1회.
    for (const hex of ['#112233', '#223344', '#334455']) {
      pick.value = hex;
      pick.dispatchEvent(new Event('input', { bubbles: true }));
    }
    pick.dispatchEvent(new Event('change', { bubbles: true }));

    window.pushHistory = real;
    return { calls, before, after: B.dataset.cols };
  });

  expect(errs).toEqual([]);
  // 전제 — 조작이 «실제로» 먹었다. 안 먹었으면 「1회」는 「0회에서 우연히」일 수 있다.
  expect(r.after, '★색이 dataset 에 안 들어갔다 — 이 검사는 아무것도 안 본 것이다').not.toBe(r.before);
  expect(r.after).toContain('#334455');

  // 본 단언 ⑴ — 제스처당 «1회». 3회면 ⌘Z 를 세 번 눌러야 하는 상태다.
  expect(r.calls.length,
    `★pushHistory 가 ${r.calls.length}회 불렸다 — 연속 input 마다 쌓이면 ⌘Z 가 못 쓰게 된다`).toBe(1);

  // 본 단언 ⑵ — «그 시점»의 스냅샷이 «변경 전»이다. 이게 순서 뒤집기를 잡는 자리다.
  expect(r.calls[0],
    '★pushHistory 가 «적용 뒤»에 불렸다 — 스냅샷이 이미 바뀐 상태라 undo 가 두 단계를 ' +
    '한꺼번에 되돌린다(이 레포 moveSection 에 실재하는 버그다). 어휘는 prop-modal, 기법은 prop-grid.')
    .toBe(r.before);
});

test('D7-b ★숫자 칸(change 한 번)도 «적용 전» 1회다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 0, li: 0 });

  const r = await page.evaluate(async () => {
    const B = window.__block;
    const calls = [];
    const real = window.pushHistory;
    window.pushHistory = function (...a) { calls.push(B.dataset.cols); return real?.apply(this, a); };
    const before = B.dataset.cols;
    const el = document.getElementById('grd-typo-size-number');
    el.value = '77';
    el.dispatchEvent(new Event('change', { bubbles: true }));
    window.pushHistory = real;
    return { calls, before, after: B.dataset.cols };
  });

  expect(errs).toEqual([]);
  expect(r.after, '크기가 안 먹었다 — 검사가 헛돈다').not.toBe(r.before);
  expect(r.after).toContain('"fontSize":77');
  expect(r.calls.length, `pushHistory 가 ${r.calls.length}회다`).toBe(1);
  expect(r.calls[0], '★적용 뒤에 찍혔다 — undo 가 두 단계를 한꺼번에 되돌린다').toBe(r.before);
});

/* ══ D1-d — 마커가 «구분되고» 블록 밖으로 안 나간다 ([M51]) ═════════════ */

test('D1-d ★마커는 이웃·편집중과 다른 서명이고, 블록 rect 를 «안 벗어난다»', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 0, li: 1 });

  const m = await page.evaluate(() => {
    const B = window.__block;
    const sel = B.querySelector('.grd-line-selected');
    if (!sel) return { none: true };
    const nb = [...B.querySelectorAll('[data-line]')].find(e => e !== sel && e.classList.contains('grd-line'));
    const cs = getComputedStyle(sel), cn = getComputedStyle(nb);
    const rb = B.getBoundingClientRect(), rs = sel.getBoundingClientRect();
    return {
      shadow: cs.boxShadow, nbShadow: cn.boxShadow,
      outline: cs.outlineStyle, bg: cs.backgroundColor,
      // .editing 서명 = outline + background 틴트. 마커는 그 둘 «아닌» 것으로 구분돼야 한다.
      out: (rs.left < rb.left - 0.5) || (rs.right > rb.right + 0.5),
    };
  });

  expect(m.none, '마커가 안 붙었다 — _grdSyncLineMark 가 안 돌았거나 주소가 안 맞는다').toBeFalsy();
  expect(m.shadow, '마커에 box-shadow 가 없다').not.toBe('none');
  expect(m.shadow, '★이웃과 «같은» 서명이다 — 사람이 어느 줄인지 구분할 수 없다').not.toBe(m.nbShadow);
  expect(m.outline, '★outline 으로 그렸다 — [M51] 이 정확히 그 자리에서 물렸다(「튀어나가잖아」)').toBe('none');
  expect(m.out, '★마커가 블록 rect 를 벗어났다 — [M51] 재발').toBe(false);
  expect(errs).toEqual([]);
});

test('D1-d-전제 ★잣대 대조 — 마커 없는 줄은 box-shadow 가 none 이다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, null);                          // 선택 «없음»
  const n = await page.evaluate(() => ({
    marks: window.__block.querySelectorAll('.grd-line-selected').length,
    shadow: getComputedStyle(window.__block.querySelector('.grd-line')).boxShadow,
  }));
  expect(n.marks, '선택을 껐는데 마커가 남아 있다').toBe(0);
  expect(n.shadow, '★마커가 없는데도 box-shadow 가 있다 — D1-d 는 아무것도 안 지킨다').toBe('none');
  expect(errs).toEqual([]);
});

/* ══ D5 — 자기재귀 3곳에서 «선택이 유지된다» ═══════════════════════════ */

test('D5-전제 ★잣대가 살아 있다 — 마커는 1건이고, 다른 줄을 고르면 «움직인다»', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 1, li: 2 });         // 뱃지 줄
  const at = () => page.evaluate(() => {
    const els = [...document.querySelectorAll('.grd-line-selected')];
    return { n: els.length, key: els[0] && `(${els[0].dataset.r},${els[0].dataset.c},${els[0].dataset.line})` };
  });
  expect(await at()).toEqual({ n: 1, key: '(0,1,2)' });
  await open(page, { r: 0, c: 0, li: 0 });
  expect(await at(), '★다른 줄을 골랐는데 마커가 안 움직인다 — 잣대가 죽었다').toEqual({ n: 1, key: '(0,0,0)' });
  expect(errs).toEqual([]);
});

/* 패널이 스스로를 다시 부르는 3곳에서 선택이 «첫 줄로 튀지 않는다»를 조작별로 잰다.

   ⚠️★이 검사는 «단독 변이로 안 죽는다» — 그 사실을 여기 적어 둔다.
     prop-grid.js 의 `showGridProperties(block, _curAddr)` 에서 인자를 빼도(:516·:551·:569 각각)
     이 3건은 «전부 초록»이다. 실측으로 확인했다. 결함이 아니라 «이중 방어»이기 때문이다:
     패널이 선택을 WeakMap 으로 «기억»하므로(bn2 선례) 1-인자로 불려도 복구된다.
   ★그래서 «진짜 지지대»는 여기가 아니라 아래 D6(WeakMap 폴백)다. 되돌리기 변이도 거기 있다.
     이 3건이 지키는 것은 「어느 조작을 해도 선택이 살아 있다」는 «동작»이지, 특정 한 줄이 아니다.
   ⛔안심을 주는 문장은 경고 부재보다 나쁘다 — 그래서 「되돌리면 빨강」을 여기 안 적는다. */
for (const [what, act] of [
  ['세로 정렬', `document.querySelector('[data-va="middle"]').click()`],
  ['가로 정렬', `document.querySelector('[data-ha="center"]').click()`],
  ['그리드 피커', `(() => { const c = document.querySelectorAll('#grd-grid-picker .gp-cell, #grd-grid-picker [data-c]'); (c[c.length-1] || document.querySelector('#grd-grid-picker div')).click(); })()`],
]) {
  test(`D5 ★«${what}» 을 조작해 패널이 다시 그려져도 선택 줄이 그대로다`, async ({ page }) => {
    const errs = await boot(page);
    await mount(page);
    await open(page, { r: 0, c: 1, li: 2 });        // 뱃지 줄 — 갈래를 일부러 어려운 쪽으로

    const before = await page.evaluate(() => document.getElementById('grd-line-summary')?.textContent || '');
    expect(before, 'Typography 요약이 안 떴다 — 이 검사가 아무것도 안 본다').toContain('3번째 줄');

    await page.evaluate((code) => eval(code), act);
    await page.waitForTimeout(50);

    const after = await page.evaluate(() => {
      const els = [...document.querySelectorAll('.grd-line-selected')];
      return {
        key: els[0] && `(${els[0].dataset.r},${els[0].dataset.c},${els[0].dataset.line})`,
        n: els.length,
        summary: document.getElementById('grd-line-summary')?.textContent || '',
      };
    });
    expect(after.key, `★«${what}» 뒤 선택이 첫 줄로 튀었다 — 자기재귀 호출에 주소를 안 넘겼다`).toBe('(0,1,2)');
    expect(after.n).toBe(1);
    expect(after.summary, '패널의 Typography 절이 다른 줄을 보고 있다').toContain('3번째 줄');
    expect(errs).toEqual([]);
  });
}

/* ══ D6 — ★계획서가 «못 짚은» 4번째 자기재귀 자리 ══════════════════════
 * 계획서 §1-A #4 는 자기재귀를 prop-grid.js 3곳으로 셌다. 그런데 grid-block.js 의
 * updateGridBlock 도 성공하면 «스스로» window.showGridProperties?.(block) 을 «1-인자»로
 * 다시 부른다 — MCP·인라인 편집 커밋·패널 조작이 전부 그 길을 탄다.
 * 그 자리엔 넘길 주소가 «없다» ⇒ 패널이 선택을 «기억»해야만 살아남는다(WeakMap, bn2 선례).
 *
 * ★그리고 이게 D5 의 변이 3건이 «초록»으로 나온 이유이기도 하다: 기억이 있으면
 *   자기재귀 3곳에 주소를 안 넘겨도 선택이 안 튄다(그 인자는 이중 방어라 단독 변이로는 안 죽는다).
 *   ⇒ 진짜 지지대는 여기다. 되돌리면 빨강: prop-grid.js 의
 *      `addrArg === undefined ? grdGetActiveLine(block) : addrArg` → `addrArg` */

test('D6 ★updateGridBlock 이 «1-인자»로 패널을 다시 그려도 선택 줄이 그대로다', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 0, c: 1, li: 2 });          // 뱃지 줄

  const before = await page.evaluate(() => document.getElementById('grd-line-summary')?.textContent || '');
  expect(before, 'Typography 요약이 안 떴다').toContain('3번째 줄');

  // ★패널을 «거치지 않고» 모델만 바꾼다 — updateGridBlock 이 스스로 패널을 다시 그린다.
  const ok = await page.evaluate(() => window.updateGridBlock(window.__block.id,
    { patchCell: { r: 1, c: 0, lineIndex: 0, fontSize: 19 } }).ok);
  expect(ok, 'patch 가 실패했다 — 이 검사는 아무것도 안 본다').toBe(true);

  const after = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.grd-line-selected')];
    return {
      n: els.length,
      key: els[0] && `(${els[0].dataset.r},${els[0].dataset.c},${els[0].dataset.line})`,
      summary: document.getElementById('grd-line-summary')?.textContent || '',
    };
  });
  expect(after.key, '★updateGridBlock 의 패널 재표시에서 선택이 «날아갔다» — ' +
    '그 자리엔 넘길 주소가 없다. 패널이 선택을 기억해야 한다(WeakMap).').toBe('(0,1,2)');
  expect(after.n, '마커가 여러 개거나 0개다').toBe(1);
  expect(after.summary, '패널이 다른 줄을 보고 있다').toContain('3번째 줄');
  expect(errs).toEqual([]);
});

/* ══ D2 — 저장 → 로드 왕복에서 값이 살아남는다 ═════════════════════════ */

test('D2 ★serializeCleanRoot 왕복 뒤에도 computed 가 «같다» (타이포가 dataset 안에 산다)', async ({ page }) => {
  const errs = await boot(page);
  await mount(page);
  await open(page, { r: 1, c: 1, li: 1 });
  await page.fill('#grd-typo-size-number', '48');
  await page.dispatchEvent('#grd-typo-size-number', 'change');
  await page.fill('#grd-typo-ls-number', '3');
  await page.dispatchEvent('#grd-typo-ls-number', 'change');

  const before = await snap(page);
  const round = await page.evaluate(() => {
    // 저장 경로와 «같은» 세척 → data-cols/data-cells 재파싱 → 새 블록으로 렌더
    const clone = document.getElementById('canvas').cloneNode(true);
    window.serializeCleanRoot(clone);
    const html = clone.innerHTML;
    const host = document.getElementById('host');
    host.innerHTML = '';
    const tmp = document.createElement('div');
    tmp.innerHTML = html;
    const b = tmp.querySelector('.grid-block');
    host.appendChild(b);
    window.__block = b;
    b.classList.add('selected');
    window.__render(b);                       // save-load.js:1063 과 같은 재호출
    return { hasMarker: html.includes('grd-line-selected') };
  });
  expect(round.hasMarker, '★선택 마커가 저장본에 샜다').toBe(false);
  expect(await snap(page), '★왕복에서 값이 달라졌다 — 타이포 필드가 dataset 밖에 산다').toEqual(before);
  expect(errs).toEqual([]);
});
