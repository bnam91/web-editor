/* grid-cell-panel-handles.dom.spec.js — 「모델·렌더는 되는데 «패널에 누를 데가 없다»」를 재는 그물.
 * (2026-09-23 · 기준선 86dce84)
 *
 * ★재는 «양»
 *   「우측 패널이 «그 값을 줄 수 있는 손잡이»를 실제로 내놓는가」.
 *   ⛔「필드가 소스에 있나」가 아니다 — 그건 주석 한 줄에도 속는다. 여기서는 패널에 뜬
 *     «모든» 컨트롤을 하나씩 «실제로 움직여» 보고, 그 결과 모델/렌더가 변하는지를 본다.
 *     ⇒ 손잡이의 «이름»을 안 정해도 된다. 고치는 쪽이 id 를 뭐라 짓든, 그 값을 주면 초록이다.
 *
 * ★명부로 묻는다 — 수를 안 박는다
 *   · 칸 필드 = grid-block.js 의 `GRID_CELL_FIELDS` 를 «소스에서 떠서» 쓴다.
 *     ⇒ 렌더러 유닛이 여기에 «테두리» 이름을 더하는 순간 이 검사가 «자동으로» 그것도 요구한다.
 *   · 줄 종류 = 모듈이 «실제로 내보내는» GRID_ROLES 의 키.
 *   ⛔둘 다 손으로 센 수(「단추 셋」)를 안 쓴다.
 *
 * ★양쪽으로 묻는다
 *   있어야 할 것이 있나(E1~E7) ＋ 없어야 할 것이 없나(E0-b 음성대조 · E8 폭).
 *
 * ★계측기 자체 점검(E0)
 *   ⑴ 주석 거르개는 «공용 하나»(tests/unit/_strip-comments.js)만 쓴다 — 내 것을 안 만든다.
 *   ⑵ 그 거르개가 줄을 «삼키지» 않는지 실물 앵커(prop-grid.js 의 `input.accept = 'image/*'`)로 잰다.
 *   ⑶ 탐침이 «있는 손잡이»를 실제로 찾아내는지 양성대조(가로정렬·간격·피커)로 잰다.
 *   ⑷ 탐침이 «아무것에나» 반응하지 않는지 음성대조(절대 안 변하는 키)로 잰다.
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉. 레포 파일만 크로미움에 얹는다.
 *   하네스 골격은 tests/dom/grid-typo.dom.spec.js 를 그대로 베꼈다(새 하네스를 발명하지 않는다).
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js grid-cell-panel-handles
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
/* ⛔주석 거르개는 «공용 하나»만 쓴다 — 이 레포엔 같은 것이 11벌 있었고 9벌이 부서져 있었다.
     오늘(2026-09-22)도 한 파일의 74줄을 삼킨 사고가 있었다. 내 것을 만들지 않는다. */
const { stripComments } = require('../unit/_strip-comments.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const SRC_BLOCK = fs.readFileSync(path.join(REPO, 'js/blocks/grid-block.js'), 'utf8');
const SRC_PANEL = fs.readFileSync(path.join(REPO, 'js/props/prop-grid.js'), 'utf8');

/** `const NAME = new Set([...])` 를 «코드에서만» 떠 온다(주석 안의 같은 이름엔 안 속는다). */
function rosterFromSource(src, name) {
  const code = stripComments(src);
  const m = code.match(new RegExp(name + '\\s*=\\s*new Set\\(\\[([\\s\\S]*?)\\]\\)'));
  if (!m) return null;
  return (m[1].match(/'[^']+'|"[^"]+"/g) || []).map(s => s.slice(1, -1));
}
/** `const NAME = [...]` (배열 리터럴) — _GRD_TYPO_FIELDS 용. */
function arrayFromSource(src, name) {
  const code = stripComments(src);
  const m = code.match(new RegExp(name + '\\s*=\\s*\\[([^\\]]*)\\]'));
  if (!m) return null;
  return (m[1].match(/'[^']+'|"[^"]+"/g) || []).map(s => s.slice(1, -1));
}

const CELL_FIELDS = rosterFromSource(SRC_BLOCK, 'GRID_CELL_FIELDS');
const LINE_FIELDS = rosterFromSource(SRC_BLOCK, 'GRID_LINE_FIELDS');
const TYPO_FIELDS = arrayFromSource(SRC_PANEL, '_GRD_TYPO_FIELDS');

/* ★칸 필드마다 «무엇으로 볼 것인가»(증인)를 여기서 정한다.
 *   model = getGridModel 의 cells[r][c][k] 가 변했나 · css = 그 칸 요소의 계산 스타일이 변했나.
 *   둘 «중 하나»만 움직여도 「손잡이가 있다」로 친다 — 실제로 세로정렬은 block.dataset 에 쓰고
 *   모델 칸 키는 안 건드린다(그래도 사용자에겐 손잡이가 있는 것이다).
 * ⛔명부에 있는데 여기 없는 필드가 생기면 E4 가 «증인 미정»으로 빨개진다. 그게 의도다 —
 *   조용히 안 재고 지나가는 것(= 검사처럼 생긴 문장)보다 낫다. */
const CELL_WITNESS = {
  bg:          { css: ['css.backgroundColor'],                ko: '칸 배경색' },
  padding:     { css: ['css.paddingTop', 'css.paddingLeft'],  ko: '칸 패딩' },
  radius:      { css: ['css.borderTopLeftRadius'],            ko: '칸 모서리' },
  align:       { css: ['css.lineTextAlign'],                  ko: '칸 가로정렬' },
  valign:      { css: ['css.justifyContent'],                 ko: '칸 세로정렬' },
  /* ~~[2026-09-23 예정 · 안 그렇게 됐다] 「테두리를 «칸 필드» borderWidth/borderColor 로 낸다」~~
     ★T-172 는 2026-09-24 에 «블록 축»으로 났다 — dataset.cellBorderWidth/Color/Style 셋이고,
       GRID_CELL_FIELDS 에는 «안» 들어간다(그래서 E4 의 루프는 이 칸을 영영 안 돈다).
       까닭: 표에 필요한 것은 «격자 선 한 벌»이지 칸마다 다른 테두리가 아니고, 칸 축에 넣으면
       이 파일의 E4 · grid-patchcell-reject P7 · grid-row0-lines-invariant I5 가 «동시에 참일 수
       없는» 삼각형이 된다(T-172 카드가 그 자리에서 멈춰 있었다).
     ⇒ 지금 테두리를 재는 곳은 tests/dom/grid-cell-border.dom.spec.js 와
       tests/unit/grid-cell-border.test.js 다. 이 두 줄은 «다시 칸 축으로 가는 날»의 증인으로만
       남겨 둔다(명부에 이름이 생기는 순간 E4 가 스스로 요구하기 시작한다).
     ⛔CSS 문자열 통째("1px solid #ddd")는 이 축이 아니다 — _esc 가 «;»·«:» 를 안 막아
       선언이 새는 자리다(grid-block.js 의 _GRID_FONT_RE 주석이 같은 사고를 적어 뒀다). */
  borderWidth: { css: ['css.borderTopWidth'],                 ko: '칸 테두리 두께' },
  borderColor: { css: ['css.borderTopColor'],                 ko: '칸 테두리 색' },
  lines:       null,                            // 내용 — E6/E7 이 따로 잰다
};
/** 칸 필드 명부에서 내용(lines)을 뺀 것 — 스냅샷이 이 이름들을 «자동으로» 덮는다.
 *  ⇒ 명부에 borderWidth 가 생기면 스냅샷에 `cell.borderWidth` 가 저절로 생긴다. */
const CELL_VALUE_FIELDS = (CELL_FIELDS || []).filter(k => k !== 'lines');

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
<script>
  /* ★아이콘 피커 대역 — 앱에만 있는 모달이다. «없는 채로» 재면 「+ 아이콘」 단추가 아무것도
     안 만들고, 그러면 이미지 줄이 「손잡이 없음」으로 나온다 — 그건 제품 결함이 아니라
     «하네스가 만든 가짜 빨강»이다. 대역을 놓고, E0-c 가 「대역이 실제로 불렸나」를 잰다. */
  window.__iconifyCalls = 0;
  window.openIconifyModal = (cb) => { window.__iconifyCalls++; cb({ svg: '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><path d="M0 0h24v24H0z"/></svg>', size: 64 }); };
</script>
<script type="module">
  import { makeGridBlock, renderGridBlock, updateGridBlock, getGridModel, GRID_ROLES } from '/js/blocks/grid-block.js';
  import { showGridProperties } from '/js/props/prop-grid.js';
  window.__mk = makeGridBlock;
  window.__render = renderGridBlock;
  window.__model = getGridModel;
  window.__open = showGridProperties;
  window.__roles = Object.keys(GRID_ROLES);
  window.__ready = true;
</script></body></html>`;

/** @param {(src:string, pathname:string)=>string} [mutate]
 *  ★두 번째 인자는 «양성대조 전용»이다 — 레포 파일을 서빙하기 «직전»에 한 군데만 비튼다.
 *    안 주면 지금까지와 완전히 같다(레포 바이트 그대로). */
async function boot(page, mutate) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    const body = fs.readFileSync(file);
    const ct = MIME[path.extname(file)] || 'text/plain';
    if (mutate) return route.fulfill({ contentType: ct, body: mutate(body.toString('utf8'), url.pathname) });
    return route.fulfill({ contentType: ct, body });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate((fx) => { window.__FIX = fx; }, FIXTURE);
  return errs;
}

/* ★픽스처 — 갈래를 «전부» 담는다: 글자 줄 여럿 · 한 줄만 있는 칸(줄 삭제 disabled) · «빈 칸».
   빈 칸이 있어야 줄바의 T/G/K 3버튼 갈래를 잰다. */
const FIXTURE = {
  cols: [{ width: 1, lines: [] }, { width: 1, lines: [] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [
    [ { lines: [ { type: 'body', text: 'A0' }, { type: 'h2', text: 'A1' }, { type: 'caption', text: 'A2' } ] },
      { lines: [ { type: 'body', text: 'B0' } ] } ],
    [ { lines: [ { type: 'body', text: 'C0' },
                 /* ★이미지 줄 — E11-b(줄 단위 정렬, 이미지 갈래)가 이 줄을 쓴다. */
                 { type: 'image', imgSrc: 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7', height: 40 } ] },
      { lines: [] } ],                                   // ★빈 칸
  ],
};
const A_TEXT = { r: 0, c: 0, li: 1 };    // h2 글자 줄 — 줄 3개짜리 칸
const A_EMPTY = { r: 1, c: 1, li: null }; // 빈 칸
/* ★1행 칸 — «cells» 에 진짜로 따로 저장되는 칸.
   ⛔0행 «줄 내용»은 «열 그 자체»다(row 0 lines = cols[].lines — 단일 진실원). T-178 이 고치기
     «전»에는 꾸밈 5개도 같은 자리라, 0행 칸에 준 값이 열 기본값이 되어 아래 행까지 칠했다 — E10 참조.
   ⇒ 「칸마다 따로 되나」(E9)는 그 별칭이 «없는» 1행 칸에서 재야 자가 안 흐려진다
     (고친 뒤에도 이 선택은 그대로 유효하다 — 1행 칸은 언제나 cells 에 저장되는 칸이다). */
const A_ROW1 = { r: 1, c: 0, li: 0 };
const A_IMG  = { r: 1, c: 0, li: 1 };    // 이미지 줄

/* ══ 탐침 — 패널의 «모든» 요소를 하나씩 실제로 움직여 본다 ════════════════
 * 매 후보마다 블록을 «새로» 심고 패널을 다시 연다(앞 조작이 다음 조작에 새지 않게).
 * 돌려주는 것: [{ i, tag, id, label, act, changed:[바뀐 스냅샷 키…] }]
 */
const PROBE = async (page, addr) => page.evaluate(async ({ addr, fields }) => {
  const HOST = () => document.getElementById('host');
  const PANEL = () => document.querySelector('#panel-right .panel-body');
  const TR = addr.r, TC = addr.c;

  function remount() {
    HOST().innerHTML = '';
    PANEL().innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST().appendChild(row);
    block.classList.add('selected');
    window.__block = block;
    window.__open(block, addr);
  }

  function snap() {
    const B = window.__block;
    const out = {};
    let m = null;
    try { m = window.__model(B); } catch (_) {}
    const cell = (m && m.cells && m.cells[TR] && m.cells[TR][TC]) || {};
    const lines = Array.isArray(cell.lines) ? cell.lines : [];
    /* ★이름을 손으로 안 적는다 — 명부에서 온 것을 그대로 돈다(테두리가 생기면 저절로 덮인다). */
    for (const k of fields) out['cell.' + k] = JSON.stringify(cell[k] === undefined ? null : cell[k]);
    out['lines.n'] = String(lines.length);
    out['lines.types'] = JSON.stringify(lines.map(l => (l && l.type) || 'body'));
    /* ⛔`lines.map(l=>l.bg)` 를 통째로 비교하면 «줄이 하나 늘어난 것»만으로도 달라져서
         「뱃지 손잡이가 있다」는 «거짓 초록»이 난다(첫 실측에서 E5 가 그렇게 통과했다).
         ⇒ 「어느 줄이든 bg 가 «생겼나»」라는 참/거짓 하나로 줄인다. */
    out['lines.anyBg'] = String(lines.some(l => l && l.bg));
    const li = addr.li === null ? 0 : addr.li;
    const line = lines[li] || {};
    out['line.type'] = JSON.stringify(line.type === undefined ? null : line.type);
    out['line.bg'] = JSON.stringify(line.bg === undefined ? null : line.bg);
    /* ★«줄»의 정렬. ⛔cell.align / css.lineTextAlign 과 «같이» 쓰면 안 된다 —
         열 정렬 단추가 그 둘을 움직여서 「줄 정렬 손잡이가 있다」는 거짓 초록을 만든다(E11). */
    out['line.align'] = JSON.stringify(line.align === undefined ? null : line.align);
    /* ⛔`lines.map(l=>l.align)` 를 통째로 견주면 «줄이 하나 늘어난 것»만으로 달라진다 —
         lines.bgs 로 이미 한 번 당한 거짓 초록이다(실측: 「+ 줄 추가」가 E11 을 통과시켰다).
         ⇒ 참/거짓 하나로 줄인다. */
    out['lines.anyAlign'] = String(lines.some(l => l && l.align));

    const el = B.querySelector('.grd-cell[data-r="' + TR + '"][data-c="' + TC + '"]');
    if (!el) { out['css.CELL-GONE'] = '1'; } else {
      const cs = getComputedStyle(el);
      out['css.backgroundColor'] = cs.backgroundColor;
      out['css.paddingTop'] = cs.paddingTop;
      out['css.paddingLeft'] = cs.paddingLeft;
      out['css.borderTopLeftRadius'] = cs.borderTopLeftRadius;
      out['css.borderTopWidth'] = cs.borderTopWidth;
      out['css.borderTopColor'] = cs.borderTopColor;
      out['css.justifyContent'] = cs.justifyContent;
      const ln = el.querySelector('[data-line]');
      out['css.lineTextAlign'] = ln ? getComputedStyle(ln).textAlign : '(no-line)';
      out['css.badgeN'] = String(el.querySelectorAll('.grd-badge').length);
    }
    out['ds.valign'] = B.dataset.valign || '';
    out['ds.colsN'] = String((() => { try { return JSON.parse(B.dataset.cols || '[]').length; } catch (_) { return -1; } })());
    /* ★음성대조 열 — 어떤 조작에도 절대 안 변한다. 여기가 변했다고 나오면 비교기가 고장난 것이다. */
    out['__never'] = 'CONSTANT';
    return out;
  }

  const fire = (el, type) => el.dispatchEvent(new Event(type, { bubbles: true }));
  function drive(el) {
    const tag = el.tagName.toLowerCase();
    const type = String(el.type || '').toLowerCase();
    if (tag === 'input' && type === 'file') return 'skip(file)';
    if (tag === 'select') {
      for (const opt of el.options) { el.value = opt.value; fire(el, 'input'); fire(el, 'change'); }
      return 'select×' + el.options.length;
    }
    if (tag === 'input' || tag === 'textarea') {
      if (type === 'checkbox' || type === 'radio') { el.click(); return 'click'; }
      if (type === 'color') { el.value = '#7b2ff7'; fire(el, 'input'); fire(el, 'change'); return 'color'; }
      if (type === 'range') {
        const lo = Number(el.min || 0), hi = Number(el.max || 100);
        el.value = String(Math.round(lo + (hi - lo) * 0.63)); fire(el, 'input'); fire(el, 'change'); return 'range';
      }
      /* 글자/숫자 칸 — 갈래를 몇 개 넣어 본다(하나만 넣으면 그 칸이 거부하는 값일 수 있다). */
      for (const v of ['37', '7B2FF7', '#7b2ff7', '2:1']) { el.value = v; fire(el, 'input'); fire(el, 'change'); }
      /* ★★<input type="number"> 는 «숫자가 아닌» 값을 넣으면 el.value 가 «''» 가 된다(브라우저 규약).
         ⇒ 위 네 갈래 중 뒤 셋은 숫자 칸에서 전부 「비우기」다. 마지막이 비우기로 끝나면
           「값을 줬다가 스스로 지운」 꼴이 되어, 손잡이가 «있어도» before===after 로 읽힌다.
         실측(2026-09-23): 이 자리 때문에 padding·radius 가 「손잡이 없음」으로 나왔다 —
           `after 37: {"padding":37}` 이었다가 `after 7B2FF7: {}` 로 되돌아갔다.
         ⇒ 숫자 칸은 «유효한 숫자»로 끝낸다. 이 검사가 묻는 것은 「그 손잡이가 값을 쓰나」이지
           「마지막에 무엇이 남나」가 아니다.
         ⛔«합집합»(값마다 스냅샷을 떠 변화를 모으기)으로 재지 마라 — 그러면
           「값을 줬다가 스스로 되돌리는 손잡이」를 못 잡게 되어 이 검사가 «약해진다».
           유효값으로 끝내는 쪽은 안 약해진다(되돌리는 손잡이가 있으면 모델이 37 과 달라져 여전히 잡힌다).
         ★짝 검사 = E0-e(사각지대가 실재함) · E0-f(손잡이를 없애면 실제로 빨개짐). */
      if (type === 'number') { el.value = '37'; fire(el, 'input'); fire(el, 'change'); }
      return 'type';
    }
    el.click();
    return 'click';
  }

  // ① 후보 명부를 «한 번» 뜬다(패널은 이 주소에서 결정적이라 인덱스가 맞는다).
  remount();
  const n = PANEL().querySelectorAll('*').length;
  const results = [];
  for (let i = 0; i < n; i++) {
    remount();
    const el = PANEL().querySelectorAll('*')[i];
    if (!el) { results.push({ i, tag: '(gone)', id: '', label: '', act: 'skip', changed: [] }); continue; }
    const before = snap();
    let act = 'err';
    try { act = drive(el); } catch (e) { act = 'throw:' + e.message; }
    const after = snap();
    const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
    const changed = [...keys].filter(k => before[k] !== after[k]);
    /* ⛔그리드 피커는 «칸 자체를 없앤다». 그러면 css.* 키가 통째로 사라져 「전부 변했다」로 읽힌다 —
       그건 「그 칸에 값을 줬다」가 아니다. 잴 수 없는 후보로 표시해 계수에서 뺀다.
       (첫 실측에서 이것 때문에 bg·padding·radius 가 «손잡이 있음»으로 잘못 나왔다) */
    const gone = !!(before['css.CELL-GONE'] || after['css.CELL-GONE']);
    results.push({
      i, gone,
      tag: el.tagName.toLowerCase() + (el.type ? '[' + el.type + ']' : ''),
      id: el.id || '',
      cls: el.className && typeof el.className === 'string' ? el.className : '',
      label: (el.textContent || '').trim().slice(0, 28),
      disabled: !!el.disabled,
      act, changed,
    });
  }
  return { n, results, iconifyCalls: window.__iconifyCalls };
}, { addr, fields: CELL_VALUE_FIELDS });

/** 어떤 후보가 이 스냅샷 키들 중 하나라도 바꿨나 — 바꾼 후보들의 설명 목록. */
const movers = (probe, keys) => probe.results
  .filter(r => !r.gone && r.changed.some(k => keys.includes(k)))
  .map(r => `${r.id || r.cls || r.tag}(${r.label})`);

/* ══════════════════════════════════════════════════════════════════════════
 * E0 — 계측기 자체 점검. 본 측정 «앞»에 선다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E0-a ★명부를 «코드에서» 떠 왔다 — 주석 거르개가 줄을 삼키지 않는다', () => {
  expect(CELL_FIELDS, 'GRID_CELL_FIELDS 를 소스에서 못 떴다 — 명부가 없으면 이 파일 전체가 헛돈다').not.toBeNull();
  expect(LINE_FIELDS, 'GRID_LINE_FIELDS 를 소스에서 못 떴다').not.toBeNull();
  expect(TYPO_FIELDS, '_GRD_TYPO_FIELDS 를 소스에서 못 떴다').not.toBeNull();
  expect(CELL_FIELDS).toContain('lines');
  expect(CELL_FIELDS).toContain('bg');

  /* ★거르개 자가검진 — 「줄을 삼키는가」를 실물 앵커로 잰다.
     prop-grid.js 에는 `input.accept = 'image/*'` 가 «실재»하고, 부서진 거르개는 바로 그
     `/*` 를 블록 주석 시작으로 읽어 그 뒤를 통째로 삼켰다(이 레포가 실제로 당한 사고). */
  const strippedPanel = stripComments(SRC_PANEL);
  expect(strippedPanel.split('\n').length, '★거르개가 줄 수를 바꿨다 — 무언가를 삼켰다')
    .toBe(SRC_PANEL.split('\n').length);
  expect(strippedPanel, "★`input.accept = 'image/*'` 뒤가 삼켜졌다 — 초록이 「괜찮다」가 아니라 「안 봤다」가 된다")
    .toContain("input.accept = 'image/*'");
  expect(strippedPanel, '★거르개가 코드를 못 남겼다 — showGridProperties 선언이 사라졌다')
    .toContain('export function showGridProperties');
  /* 반대 방향 — 거르개가 «진짜로 걷는가». 레포 문구를 앵커로 쓰지 않는다:
     이 거르개는 «여러 줄 템플릿 리터럴 안의 주석»을 못 걷는다고 스스로 적어 뒀고,
     prop-grid.js 의 주석 상당수가 그 안에 있다(실측). 레포 문구로 재면 그 한계에 걸려
     「거르개가 죽었다」는 «거짓 빨강»이 난다. ⇒ 내가 만든 입력으로 잰다. */
  const probe = stripComments([
    "const keep1 = 1;  // GHOST_LINE_COMMENT",
    "/* GHOST_BLOCK_COMMENT */ const keep2 = 2;",
    "const keep3 = 'KEEP_IN_STRING';",
  ].join('\n'));
  expect(probe, '★줄 주석을 안 걷는다').not.toContain('GHOST_LINE_COMMENT');
  expect(probe, '★블록 주석을 안 걷는다').not.toContain('GHOST_BLOCK_COMMENT');
  expect(probe, '★문자열 안의 글자까지 삼켰다').toContain('KEEP_IN_STRING');
  expect(probe.split('\n').length, '★줄 수가 달라졌다 — 무언가를 삼켰다').toBe(3);
});

test('E0-b ★탐침이 «있는 손잡이»를 실제로 찾아낸다 (양성대조) + «아무것에나» 반응하지 않는다 (음성대조)', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_TEXT);
  expect(errs).toEqual([]);
  expect(probe.n, '패널에 요소가 거의 없다 — 패널이 안 떴다').toBeGreaterThan(40);

  // 양성대조 ⑴ — 가로정렬 단추는 «줄의 text-align» 을 바꾼다.
  expect(movers(probe, ['css.lineTextAlign']).length,
    '★탐침이 가로정렬 단추조차 못 찾았다 — 이 파일의 모든 빨강은 «안 봤다»는 뜻이다').toBeGreaterThan(0);
  // 양성대조 ⑵ — 세로정렬 단추는 block.dataset.valign 을 바꾼다.
  expect(movers(probe, ['ds.valign']).length, '★탐침이 세로정렬 단추를 못 찾았다').toBeGreaterThan(0);
  // 양성대조 ⑶ — 그리드 피커는 열 수를 바꾼다.
  expect(movers(probe, ['ds.colsN']).length, '★탐침이 그리드 피커를 못 찾았다').toBeGreaterThan(0);
  // 양성대조 ⑷ — 글자 줄엔 Typography 가 «있다». 그 손잡이는 찾아져야 한다.
  expect(probe.results.some(r => r.id === 'grd-typo-size-number' && r.act === 'type'),
    '★Typography 크기 칸을 안 움직였다 — 탐침이 input 을 건너뛰고 있다').toBe(true);

  // 음성대조 — 절대 안 변하는 열은 «단 한 번도» 변했다고 나오지 않는다.
  const ghosts = probe.results.filter(r => r.changed.includes('__never'));
  expect(ghosts.map(g => g.id || g.tag),
    '★비교기가 «안 변한 것»을 변했다고 센다 — 이 파일의 모든 초록이 거짓이다').toEqual([]);

  // 탐침이 폭주하지 않는다 — 한 후보가 스냅샷 «전부»를 바꾸면 그건 비교가 아니라 붕괴다.
  const wild = probe.results.filter(r => r.changed.length > 14).map(r => r.id || r.tag);
  expect(wild, '★한 조작이 스냅샷 거의 전부를 바꿨다 — 탐침이 블록을 부쉈다').toEqual([]);
});

test('E0-c ★아이콘 피커 대역이 «실제로» 불린다 — 빈 칸의 이미지 갈래가 하네스 탓에 빨개지지 않는다', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_EMPTY);
  expect(errs).toEqual([]);
  expect(probe.results.some(r => r.id === 'grd-cell-add-icon-btn'),
    '★빈 칸 줄바에 「+ 아이콘」 단추가 안 보인다 — 픽스처의 빈 칸이 빈 칸이 아니다').toBe(true);
  expect(probe.iconifyCalls,
    '★openIconifyModal 대역이 한 번도 안 불렸다 — 「이미지 줄 추가 손잡이가 없다」는 판정이 ' +
    '제품이 아니라 «하네스» 탓일 수 있다. 그대로 두면 가짜 빨강이다').toBeGreaterThan(0);
});

test('E0-d ★증인이 «값이 주어지면» 실제로 움직인다 — 「손잡이가 없다」가 「내가 눈이 멀었다」가 아님을 세운다', async ({ page }) => {
  const errs = await boot(page);
  /* ★이 파일의 빨강은 전부 「어떤 조작에도 이 스냅샷 키가 안 변했다」는 꼴이다.
     그 키가 «애초에 안 변하는 키»라면 빨강은 아무 뜻도 없다. ⇒ 패널을 «거치지 않고»
     API 로 같은 값을 넣어 보고, 증인이 움직이는지 먼저 세운다.
     ⛔이것이 「모델도 렌더도 된다」는 전제의 증거이기도 하다 — 말이 아니라 측정으로. */
  const moved = await page.evaluate(async (addr) => {
    const out = {};
    const HOST = document.getElementById('host');
    const PANEL = document.querySelector('#panel-right .panel-body');
    const mk = () => {
      HOST.innerHTML = ''; PANEL.innerHTML = '';
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
      HOST.appendChild(row); block.classList.add('selected');
      window.__block = block; window.__open(block, addr);
      return block;
    };
    const read = (B) => {
      const el = B.querySelector('.grd-cell[data-r="' + addr.r + '"][data-c="' + addr.c + '"]');
      const cs = el ? getComputedStyle(el) : null;
      let cell = {};
      try { cell = window.__model(B).cells[addr.r][addr.c] || {}; } catch (_) {}
      const lines = Array.isArray(cell.lines) ? cell.lines : [];
      return {
        'cell.bg': JSON.stringify(cell.bg ?? null),
        'cell.padding': JSON.stringify(cell.padding ?? null),
        'cell.radius': JSON.stringify(cell.radius ?? null),
        'cell.align': JSON.stringify(cell.align ?? null),
        'cell.valign': JSON.stringify(cell.valign ?? null),
        'css.backgroundColor': cs ? cs.backgroundColor : '',
        'css.paddingTop': cs ? cs.paddingTop : '',
        'css.borderTopLeftRadius': cs ? cs.borderTopLeftRadius : '',
        'css.justifyContent': cs ? cs.justifyContent : '',
        'css.lineTextAlign': (() => { const l = el && el.querySelector('[data-line]'); return l ? getComputedStyle(l).textAlign : ''; })(),
        'line.bg': JSON.stringify(lines[addr.li] && lines[addr.li].bg !== undefined ? lines[addr.li].bg : null),
        'lines.anyBg': String(lines.some(l => l && l.bg)),
        'line.align': JSON.stringify(lines[addr.li] && lines[addr.li].align !== undefined ? lines[addr.li].align : null),
        'lines.anyAlign': String(lines.some(l => l && l.align)),
        'line.type': JSON.stringify(lines[addr.li] ? lines[addr.li].type ?? null : null),
        'lines.n': String(lines.length),
        'lines.types': JSON.stringify(lines.map(l => (l && l.type) || 'body')),
      };
    };
    const trial = (name, patch) => {
      const B = mk();
      const before = read(B);
      const res = window.updateGridBlock(B.id, { patchCell: Object.assign({ r: addr.r, c: addr.c }, patch) });
      const after = read(B);
      out[name] = {
        ok: !!(res && res.ok),
        rejected: res && res.error ? String(res.error) : '',
        changed: Object.keys(after).filter(k => before[k] !== after[k]),
      };
    };
    trial('bg', { bg: '#7b2ff7' });
    trial('padding', { padding: 24 });
    trial('radius', { radius: 18 });
    trial('align', { align: 'right' });
    trial('valign', { valign: 'bottom' });
    trial('line.bg', { lineIndex: addr.li, bg: '#7b2ff7' });
    trial('line.align', { lineIndex: addr.li, align: 'right' });
    trial('line.type', { lineIndex: addr.li, type: 'caption' });
    return out;
  }, A_TEXT);
  expect(errs).toEqual([]);

  const need = {
    bg: ['cell.bg', 'css.backgroundColor'],
    padding: ['cell.padding', 'css.paddingTop'],
    radius: ['cell.radius', 'css.borderTopLeftRadius'],
    align: ['cell.align', 'css.lineTextAlign'],
    valign: ['cell.valign', 'css.justifyContent'],
    'line.bg': ['line.bg', 'lines.anyBg'],
    'line.align': ['line.align', 'lines.anyAlign'],
    'line.type': ['line.type', 'lines.types'],
  };
  const blind = [];
  for (const [k, keys] of Object.entries(need)) {
    const got = moved[k] || { changed: [] };
    const hit = keys.filter(x => got.changed.includes(x));
    if (!hit.length) blind.push(`${k} → 증인 ${keys.join('/')} 가 «안» 움직였다 (ok:${got.ok} ${got.rejected})`);
  }
  expect(blind, '★증인이 눈멀었다:\n   ' + blind.join('\n   ') + '\n' +
    '   이게 빨개지면 아래 빨강들은 「손잡이가 없다」가 아니라 「내 자가 못 잰다」는 뜻이다').toEqual([]);
});

/* ★E0-e / E0-f — 2026-09-23 T-178 에서 드러난 «탐침의 사각지대»와 그 짝.
 *
 * 무엇이 있었나 — E4·E1~E3 의 padding·radius 가 초록이던 까닭은 손잡이가 있어서가 «아니라»,
 *   A_TEXT 가 «행 0 주소»여서 prop-grid.js 의 `_grdBlank(0, true) === 0` 이 마지막에 0 을
 *   박아 줬기 때문이다. 행 1 주소로 같은 각본을 돌리면 «기준선 f724dc1 에서도 이미 빈 채»다(실측).
 *   ⇒ 이 사각지대는 T-178 이 «만든» 것이 아니라 행 0 특례가 «가리고» 있던 것이다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E0-e ★사각지대를 이름으로 잠근다 — 마지막 쓰기가 「비우기」면 손잡이가 «있어도» 안 보인다', async ({ page }) => {
  const errs = await boot(page);
  /* ⑴ 사각지대가 «실재»한다 — 유효값 뒤에 무효값(=비우기)을 넣으면 모델이 되돌아온다. */
  const r = await page.evaluate(async (addr) => {
    const HOST = document.getElementById('host');
    const PANEL = document.querySelector('#panel-right .panel-body');
    HOST.innerHTML = ''; PANEL.innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row); block.classList.add('selected');
    window.__block = block; window.__open(block, addr);
    const pad = () => {
      let cell = {};
      try { cell = window.__model(block).cells[addr.r][addr.c] || {}; } catch (_) {}
      return JSON.stringify(cell.padding === undefined ? null : cell.padding);
    };
    const el = document.getElementById('grd-cell-padding');
    if (!el) return { found: false };
    const put = (v) => {
      el.value = v;
      el.dispatchEvent(new Event('input', { bubbles: true }));
      el.dispatchEvent(new Event('change', { bubbles: true }));
      return pad();
    };
    return { found: true, isNumber: String(el.type).toLowerCase(), start: pad(),
      after37: put('37'), afterJunk: put('7B2FF7'), valueAfterJunk: JSON.stringify(el.value) };
  }, A_TEXT);
  expect(errs).toEqual([]);
  expect(r.found, '★패딩 칸을 못 찾았다 — 이 검사의 겨냥이 빗나갔다').toBe(true);
  expect(r.isNumber, '★패딩 칸이 type=number 가 아니다 — 아래 설명이 더는 안 맞는다').toBe('number');
  expect(r.after37, '★유효한 숫자를 넣었는데 모델이 안 움직였다 — 손잡이가 정말 없는 것이다').toBe('37');
  expect(r.valueAfterJunk,
    '★<input type=number> 에 숫자 아닌 값을 넣었는데 el.value 가 \'\' 가 «안» 됐다 — ' +
    '브라우저 규약이 바뀌었거나 칸 종류가 바뀌었다. 그러면 drive() 의 마지막 보정도 뜻을 잃는다').toBe('""');
  expect(r.afterJunk,
    '★숫자 아닌 값(= 비우기)이 앞서 준 37 을 «안» 지웠다 — 사각지대 설명이 더는 안 맞는다.\n' +
    '   그러면 drive() 의 마지막 유효값 보정은 불필요한 손질이다. 주석과 함께 걷어내라')
    .not.toBe('37');
});

test('E0-f ★★양성대조 — 패딩 «손잡이를 없앤» 변형본에서는 이 축이 실제로 빨개진다', async ({ page }) => {
  /* ⛔이게 없으면 위 drive() 손질은 「검사를 죽여서 초록을 산 것」과 구별되지 않는다.
     ⇒ 배선 한 줄을 «지운» prop-grid.js 를 서빙하고, 패딩 축이 죽는지 본다.
     ★다른 축(배경색)은 살아 있어야 한다 — 변이가 패널을 통째로 부순 게 아님을 같이 센다. */
  const ANCHOR = "  numWire('grd-cell-padding', 'padding');\n";
  const errs = await boot(page, (src, pathname) => {
    if (!pathname.endsWith('/js/props/prop-grid.js')) return src;
    const out = src.replace(ANCHOR, '');
    if (out === src) throw new Error('★변이 닻이 빗나갔다 — numWire 패딩 배선을 못 찾았다');
    return out;
  });
  const probe = await PROBE(page, A_TEXT);
  expect(errs).toEqual([]);
  expect(probe.n, '★패널이 안 떴다 — 변이가 모듈을 통째로 깨뜨렸다').toBeGreaterThan(40);
  expect(movers(probe, ['cell.bg', 'css.backgroundColor']).length,
    '★변이가 패널을 통째로 부쉈다 — 배경색 손잡이까지 사라졌다면 이 양성대조는 아무것도 안 가른다')
    .toBeGreaterThan(0);
  expect(movers(probe, ['cell.padding', 'css.paddingTop', 'css.paddingLeft']),
    '★패딩 배선을 «지웠는데도» 누군가 패딩을 주고 있다 — E1~E3·E4 의 패딩 판정은 헛것이다')
    .toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E1~E4 — 칸 단위 손잡이. ★명부(GRID_CELL_FIELDS)에서 파생한다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E4 ★명부 전수 — GRID_CELL_FIELDS 의 «모든» 칸 필드에 패널 손잡이가 있다', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_TEXT);
  expect(errs).toEqual([]);

  /* ⛔명부에 새 이름이 생겼는데 증인을 안 정하면 여기서 «먼저» 빨개진다 —
     조용히 안 재고 지나가는 「검사처럼 생긴 문장」이 되지 않게. (테두리가 신설되면 이 줄이 운다) */
  const noWitness = CELL_FIELDS.filter(k => !(k in CELL_WITNESS));
  expect(noWitness, `★칸 필드 명부에 «새 이름»이 생겼다: ${noWitness.join(', ')} — ` +
    '이 검사에 증인(어느 CSS/모델 값으로 보는가)을 정하고 그 손잡이를 재라. ' +
    '증인을 안 정하면 이 검사는 그 필드를 «안 보고» 초록이 된다.\n' +
    '   ★테두리가 여기 들어왔다면 «같은 패치에» 이것도 세워라(설계 M6): borderWidth:0 일 때 ' +
    '칸의 인라인 style 에 border 선언이 «0건»인가. 0 을 0px solid 로 찍으면 안 보이는 테두리가 ' +
    '레이아웃을 민다').toEqual([]);

  const missing = [];
  const found = [];
  for (const k of CELL_FIELDS) {
    const w = CELL_WITNESS[k];
    if (!w) continue;                                  // lines = 내용, E6/E7 이 잰다
    const keys = ['cell.' + k, ...w.css];
    const who = movers(probe, keys);
    (who.length ? found : missing).push(`${k}(${w.ko})`);
  }
  expect(missing, `★패널에 «손잡이가 없는» 칸 필드: ${missing.join(' · ')}\n` +
    `   (손잡이가 있는 것: ${found.join(' · ') || '없음'})\n` +
    '   모델도 렌더러도 이 값을 읽는다(grid-block.js renderGridBlock 의 pick(...)). ' +
    '읽는데 «줄 데가 없다» — 그게 이 검사가 재는 양이다.\n' +
    '   ⚠️이 축은 «어떤 단위로든» 그 값이 들어가나만 묻는다 — 블록 통째·열 통째도 초록이다. ' +
    '「칸마다 따로 되나」는 E9 가 «따로» 잰다').toEqual([]);
});

for (const [field, ko] of [['bg', '배경색'], ['padding', '패딩'], ['radius', '모서리']]) {
  test(`E1~E3 ★칸 «${ko}» — 패널의 어떤 손잡이도 이 값을 못 준다`, async ({ page }) => {
    const errs = await boot(page);
    const probe = await PROBE(page, A_TEXT);
    expect(errs).toEqual([]);
    const w = CELL_WITNESS[field];
    const who = movers(probe, ['cell.' + field, ...w.css]);
    expect(who, `★칸 ${ko}(cell.${field}) 를 주는 손잡이가 패널에 «하나도» 없다. ` +
      `렌더러는 이미 읽는다 — grid-block.js 의 renderGridBlock 이 pick('${field}') 로 칸 style 에 ` +
      '직접 박는다. 모델·렌더는 되는데 누를 데가 없는 자리다').not.toEqual([]);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * E5 — 뱃지(알약). 줄에 bg 를 주면 렌더러가 «알약» 분기로 갈아탄다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E5-전제 ★구조적 공백을 소스로 먼저 확인한다 — line.bg 는 렌더러 명부엔 있고 패널 명부엔 없다', () => {
  expect(LINE_FIELDS, "★렌더러가 line.bg 를 안 읽는다면 E5 는 «없는 것»을 요구하는 셈이다").toContain('bg');
  expect(TYPO_FIELDS, '★패널의 타이포 명부에 bg 가 «이미» 있다 — E5 의 전제가 틀렸다. 다시 재라')
    .not.toContain('bg');
});

test('E5 ★뱃지(알약) — 패널의 어떤 손잡이도 줄에 bg 를 못 준다', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_TEXT);
  expect(errs).toEqual([]);
  /* ⛔css.badgeN 을 증인으로 쓰지 않는다 — 줄 «수»가 바뀌기만 해도 달라진다(거짓 초록). */
  const who = movers(probe, ['line.bg', 'lines.anyBg']);
  expect(who, '★줄에 bg 를 주는 손잡이가 «하나도» 없다 — 그래서 알약(뱃지)을 패널로는 못 만든다. ' +
    '⚠️_grdTypoSectionsHtml 의 showHighlight:false 를 true 로 되돌리는 것은 «답이 아니다» — ' +
    'tests/unit/grid-line-typo.test.js U1-c 가 그 자리를 잠갔고, 형광펜(text background)과 ' +
    '알약(line.bg)은 렌더러에서 «다른 분기»다. 알약 전용 손잡이가 따로 필요하다').not.toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E6 — 줄 추가. ★수를 안 박는다: 역할 명부(GRID_ROLES)에서 떠서 «전부» 묻는다.
 * ════════════════════════════════════════════════════════════════════════ */

for (const [where, addr] of [['빈 칸', A_EMPTY], ['줄이 있는 칸', A_TEXT]]) {
  test(`E6 ★«${where}» 에서 역할 명부의 «모든» 줄 종류를 추가할 길이 있다`, async ({ page }) => {
    const errs = await boot(page);
    const roles = await page.evaluate(() => window.__roles);
    expect(errs).toEqual([]);
    expect(roles.length, '역할 명부가 비었다 — 이 검사는 아무것도 안 본다').toBeGreaterThan(1);

    /* 「그 종류의 줄이 «생겼나»」로 잰다 — 단추 이름이 아니라 결과로. 고치는 쪽이
       드롭다운으로 만들든 단추로 만들든, 줄이 생기면 초록이다. */
    const perRole = await page.evaluate(async ({ addr, roles }) => {
      const HOST = () => document.getElementById('host');
      const PANEL = () => document.querySelector('#panel-right .panel-body');
      function remount() {
        HOST().innerHTML = ''; PANEL().innerHTML = '';
        const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
        HOST().appendChild(row); block.classList.add('selected');
        window.__block = block; window.__open(block, addr);
      }
      const types = () => {
        try {
          const l = window.__model(window.__block).cells[addr.r][addr.c].lines || [];
          return l.map(x => (x && x.type) || 'body');
        } catch (_) { return []; }
      };
      const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
      const hit = {};
      for (const role of [...roles, 'image', 'gap']) hit[role] = [];
      remount();
      const n = PANEL().querySelectorAll('*').length;
      for (let i = 0; i < n; i++) {
        remount();
        const el = PANEL().querySelectorAll('*')[i];
        if (!el) continue;
        /* ★옵션 «하나»가 한 조작이다 — TYPE_SETS 와 «같은» 규칙(자의 한계를 제품 결함으로
             읽던 자리). 여기선 추가만 세지만 규칙을 한 벌로 둔다: 두 벌이면 따로 늙는다. */
        const collect = (before, after) => {
          if (after.length <= before.length) return;
          const bc = {}; before.forEach(t => { bc[t] = (bc[t] || 0) + 1; });
          for (const t of after) {
            if (bc[t]) { bc[t]--; continue; }
            if (hit[t]) hit[t].push(el.id || el.className || el.tagName);
          }
        };
        const tag = el.tagName.toLowerCase(), ty = String(el.type || '').toLowerCase();
        try {
          if (tag === 'select') {
            for (const o of el.options) {
              const b2 = types();
              el.value = o.value; fire(el, 'input'); fire(el, 'change');
              collect(b2, types());
            }
          } else if (tag === 'input' && ty === 'file') { /* skip */ }
          else { const b2 = types(); el.click(); collect(b2, types()); }
        } catch (_) {}
      }
      return hit;
    }, { addr, roles });

    const missing = Object.entries(perRole).filter(([, v]) => v.length === 0).map(([k]) => k);
    const have = Object.entries(perRole).filter(([, v]) => v.length).map(([k]) => k);
    expect(missing, `★«${where}» 에서 추가할 «길이 없는» 줄 종류: ${missing.join(', ')}\n` +
      `   (길이 있는 것: ${have.join(', ') || '없음'})\n` +
      '   명부는 GRID_ROLES 에서 떠 왔다 — 수를 손으로 세지 않았다.\n' +
      '   ⛔★«image» 가 초록으로 보여도 「사진을 넣는 길이 있다」로 읽지 마라 — 이 자를 만든 것은 ' +
      '「+ 아이콘 (K)」다. 아이콘과 파일 사진은 «둘 다 type:\'image\'» 라 모델로는 구분이 안 된다. ' +
      '실제로 사진을 넣는 길은 «캔버스 우클릭 하나뿐»이고 그것도 반쪽이다(글자 줄 위에서 ' +
      '우클릭하면 빨간 토스트 — 다른 워커 실측). 파일 사진 축은 이 그물이 «못 재는» 축이다').toEqual([]);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * E7 — 줄 «종류 바꾸기». 이미 있는 줄의 type 을 다른 역할로.
 * ════════════════════════════════════════════════════════════════════════ */

test('E7 ★이미 있는 줄의 «종류를 바꾸는» 길이 있다 (body → 다른 역할)', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_TEXT);
  expect(errs).toEqual([]);
  /* line.type 이 «바뀌되 줄 수는 그대로» — 줄을 새로 만든 것과 구분한다. */
  const who = probe.results
    .filter(r => !r.gone && r.changed.includes('line.type') && !r.changed.includes('lines.n'))
    .map(r => `${r.id || r.cls || r.tag}(${r.label})`);
  expect(who, '★선택한 줄의 종류를 바꾸는 손잡이가 «하나도» 없다. ' +
    'h2 로 만든 줄을 body 로 내리려면 지우고 다시 만드는 수밖에 없다').not.toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E9 — ★「어떤 단위로든 된다」와 「«칸마다» 된다」는 다른 양이다.
 *
 *   E4 는 전자만 묻는다. 그래서 valign 이 초록으로 나오는데, 패널이 실제로 쓰는 곳은
 *   block.dataset.valign 이다 — 블록 «통째». 「칸마다 되는 줄 알았는데 통째였다」는
 *   E4 의 초록 «뒤에» 숨는다. ⇒ 축을 갈라서 여기서 따로 잰다.
 *   판정식: 「대상 칸이 변하되 «이웃 칸»은 안 변하는」 손잡이가 있나.
 *   ⛔E1~E3(손잡이가 아예 없는 것)과 겹치지 않게, «E4 에서 손잡이가 있다고 나온 필드»만 묻는다.
 * ════════════════════════════════════════════════════════════════════════ */

/** 대상 칸 + 이웃 둘을 «같이» 찍는 탐침. 돌려주는 것: [{…, tgt:[…], sib:[…] }] */
const PROBE_CELLS = async (page, addr) => page.evaluate(async ({ addr, fields }) => {
  const HOST = () => document.getElementById('host');
  const PANEL = () => document.querySelector('#panel-right .panel-body');
  const SIBS = [{ r: addr.r, c: addr.c === 0 ? 1 : 0 }, { r: addr.r === 0 ? 1 : 0, c: addr.c }];

  function remount() {
    HOST().innerHTML = ''; PANEL().innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST().appendChild(row); block.classList.add('selected');
    window.__block = block; window.__open(block, addr);
  }
  function snapOne(r, c) {
    const B = window.__block;
    const out = {};
    let cell = {};
    try { cell = (window.__model(B).cells[r] || [])[c] || {}; } catch (_) {}
    for (const k of fields) out['cell.' + k] = JSON.stringify(cell[k] === undefined ? null : cell[k]);
    const el = B.querySelector('.grd-cell[data-r="' + r + '"][data-c="' + c + '"]');
    if (!el) { out['css.GONE'] = '1'; return out; }
    const cs = getComputedStyle(el);
    out['css.backgroundColor'] = cs.backgroundColor;
    out['css.paddingTop'] = cs.paddingTop;
    out['css.paddingLeft'] = cs.paddingLeft;
    out['css.borderTopLeftRadius'] = cs.borderTopLeftRadius;
    out['css.borderTopWidth'] = cs.borderTopWidth;
    out['css.borderTopColor'] = cs.borderTopColor;
    out['css.justifyContent'] = cs.justifyContent;
    const ln = el.querySelector('[data-line]');
    out['css.lineTextAlign'] = ln ? getComputedStyle(ln).textAlign : '(no-line)';
    return out;
  }
  const diff = (a, b) => [...new Set([...Object.keys(a), ...Object.keys(b)])].filter(k => a[k] !== b[k]);
  const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
  function drive(el) {
    const tag = el.tagName.toLowerCase(), ty = String(el.type || '').toLowerCase();
    if (tag === 'input' && ty === 'file') return;
    if (tag === 'select') { for (const o of el.options) { el.value = o.value; fire(el, 'input'); fire(el, 'change'); } return; }
    if (tag === 'input' || tag === 'textarea') {
      if (ty === 'checkbox' || ty === 'radio') return el.click();
      if (ty === 'color') { el.value = '#7b2ff7'; fire(el, 'input'); fire(el, 'change'); return; }
      if (ty === 'range') {
        const lo = Number(el.min || 0), hi = Number(el.max || 100);
        el.value = String(Math.round(lo + (hi - lo) * 0.63)); fire(el, 'input'); fire(el, 'change'); return;
      }
      for (const v of ['37', '7B2FF7', '#7b2ff7', '2:1']) { el.value = v; fire(el, 'input'); fire(el, 'change'); }
      /* ★숫자 칸은 «유효한 숫자»로 끝낸다 — 위 PROBE 의 drive() 와 «같은 까닭»이다
         (<input type=number> 는 숫자 아닌 값에 el.value 가 '' 가 되어 마지막이 「비우기」가 된다).
         ⚠️이 파일엔 drive() 가 «두 벌»이다(PROBE · PROBE_CELLS). 한쪽만 고치면 E4 는 초록인데
           E9 만 빨간 꼴이 난다 — 실제로 2026-09-23 에 그렇게 났다. 고칠 땐 둘 다 봐라. */
      if (ty === 'number') { el.value = '37'; fire(el, 'input'); fire(el, 'change'); }
      return;
    }
    el.click();
  }

  remount();
  const n = PANEL().querySelectorAll('*').length;
  const results = [];
  for (let i = 0; i < n; i++) {
    remount();
    const el = PANEL().querySelectorAll('*')[i];
    if (!el) continue;
    const b0 = snapOne(addr.r, addr.c), bs = SIBS.map(s => snapOne(s.r, s.c));
    try { drive(el); } catch (_) {}
    const a0 = snapOne(addr.r, addr.c), as = SIBS.map(s => snapOne(s.r, s.c));
    const gone = [b0, a0, ...bs, ...as].some(x => x['css.GONE']);
    results.push({
      id: el.id || '', cls: (typeof el.className === 'string' ? el.className : ''),
      tag: el.tagName.toLowerCase(), label: (el.textContent || '').trim().slice(0, 24),
      gone,                                   // ⛔피커처럼 «칸을 없애는» 조작은 계수에서 뺀다
      tgt: diff(b0, a0),
      sib: [...new Set([].concat(...bs.map((b, i2) => diff(b, as[i2]))))],
    });
  }
  return results;
}, { addr, fields: CELL_VALUE_FIELDS });

test('E9-전제 ★「이웃은 안 변했다」를 실제로 가려낼 수 있다 (API 로 한 칸만 칠해 본다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(async ({ addr, fields }) => {
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row); block.classList.add('selected');
    window.__block = block; window.__open(block, addr);
    const read = (r2, c2) => {
      let cell = {};
      try { cell = (window.__model(block).cells[r2] || [])[c2] || {}; } catch (_) {}
      const el = block.querySelector('.grd-cell[data-r="' + r2 + '"][data-c="' + c2 + '"]');
      return JSON.stringify([fields.map(k => cell[k] ?? null), el ? getComputedStyle(el).backgroundColor : '']);
    };
    const b = [read(1, 0), read(1, 1), read(0, 0)];
    const res = window.updateGridBlock(block.id, { patchCell: { r: 1, c: 0, bg: '#7b2ff7' } });
    const a = [read(1, 0), read(1, 1), read(0, 0)];
    return { ok: !!(res && res.ok), tgtMoved: b[0] !== a[0], sibMoved: b[1] !== a[1] || b[2] !== a[2] };
  }, { addr: A_ROW1, fields: CELL_VALUE_FIELDS });
  expect(errs).toEqual([]);
  expect(r.ok, 'patchCell 이 실패했다 — 전제가 안 선다').toBe(true);
  expect(r.tgtMoved, '★한 칸만 칠했는데 «그 칸»이 안 변했다 — 이 자로는 아무것도 못 잰다').toBe(true);
  expect(r.sibMoved, '★한 칸만 칠했는데 «이웃»까지 변했다고 나온다 — 격리 판정식이 고장났다. ' +
    'E9 의 빨강이 「통째다」가 아니라 「내 자가 이웃을 잘못 본다」가 된다').toBe(false);
});

test('E9 ★손잡이가 «있는» 칸 필드 중, «칸마다 따로» 줄 수 있는 것은 무엇인가', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_ROW1);
  const cells = await PROBE_CELLS(page, A_ROW1);
  expect(errs).toEqual([]);

  const perCellMissing = [];
  const perCellOk = [];
  for (const k of CELL_VALUE_FIELDS) {
    const w = CELL_WITNESS[k];
    if (!w) continue;
    const keys = ['cell.' + k, ...w.css];
    // E4 에서 «손잡이가 아예 없는» 필드는 여기서 안 묻는다(E1~E3 과 겹친다).
    if (!movers(probe, keys).length) continue;
    const live = cells.filter(r => !r.gone);
    const isolated = live.filter(r => r.tgt.some(x => keys.includes(x)) && !r.sib.some(x => keys.includes(x)));
    const wide = live.filter(r => r.tgt.some(x => keys.includes(x)) && r.sib.some(x => keys.includes(x)));
    (isolated.length ? perCellOk : perCellMissing).push(
      `${k}(${w.ko})${isolated.length ? '' : ` — 통째로만 움직인다: ${wide.slice(0, 3).map(x => x.id || x.cls || x.tag).join(', ')}`}`);
  }
  expect(perCellMissing, '★「칸마다 따로」 줄 수 «없는» 칸 필드:\n   ' + perCellMissing.join('\n   ') + '\n' +
    `   (칸마다 되는 것: ${perCellOk.join(' · ') || '없음'})\n` +
    '   ⚠️이 필드들은 E4 에서 «초록»이다 — 값이 들어가긴 한다. 다만 들어가는 단위가 «칸»이 아니다.\n' +
    '   · 세로정렬: 패널이 block.dataset.valign 에 쓴다 — 블록 통째.\n' +
    '   · 가로정렬: 패널이 cols[].align 에 «전 열» 일괄로 쓴다 — 열 통째(게다가 줄의 ' +
    'line.align 오버라이드를 지운다).\n' +
    '   ⇒ 「칸마다 되는 줄 알았는데 통째였다」가 E4 의 초록 뒤에 숨어 있던 자리다').toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E10 — ★★«0행 칸»에 준 값은 «그 칸에만» 머문다. (2026-09-23 이 그물이 찾아낸 것)
 *
 *   ⛔이건 E9-전제를 세우다 나왔다 — 처음엔 「내 격리 판정식이 고장났다」고 읽었는데,
 *     다시 재 보니 제품이 그렇게 «동작»했다. 「의심을 설명으로 닫지 마라」의 실례다.
 *
 *   병명: 행 0 은 «열 그 자체»다(row 0 = cols[].lines). 그래서 patchCell{r:0} 이 쓰는 자리는
 *   cols[c] 이고, 렌더러의 폴백 `pick = (k) => (cell[k] !== undefined ? cell[k] : col[k])`
 *   때문에 «자기 값이 없는 아래 행 칸들»이 그 값을 물려받는다.
 *   ⇒ 1행 칸의 «모델»은 그대로 null 인데 «화면»만 칠해진다 — 데이터와 화면이 어긋난다.
 *
 *   ⚠️grid-block.js 의 해당 자리 주석은 「행 0 은 cell===col 이라 pick()이 늘 col 값을
 *     돌려주므로 모든 행에 «같은 코드»로 맞다」고 적혀 있다. 맞는 말이지만 «아래 행이
 *     물려받는다»는 결과는 안 적혀 있다 — 안심을 주는 문장이 경고 부재보다 나쁜 자리다.
 *
 *   ★왜 패널 그물에 넣나 — 칸 배경색/패딩/모서리 손잡이를 만들어 patchCell 로 커밋하는 순간
 *     사용자가 «1행 1열 칸 하나»를 칠했는데 그 열이 통째로 칠해진다. 손잡이보다 먼저 정해야 한다.
 *   ⛔담당 = 카드 T-178(2026-09-23 배정). 이 빨강은 패널 유닛이 혼자 못 닫는다.
 *
 * ★★2026-09-23(2차) — `test.fail` 을 «걷어냈다». 이제 이건 «초록이어야 하는» 검사다.
 *   ⇒ T-178 을 고치기 «전»에는 여기가 빨갛다(그게 병이 살아 있다는 표시다).
 *     고치고 나면 초록으로 돌아오고, 병이 되살아나면 다시 운다 — 표시가 아니라 «그물»이다.
 *   ⛔단언은 «원래부터» 「안 변한다」 방향으로 적혀 있었다(`toBe(r.before.css10)`).
 *     `test.fail` 이 그 뜻을 뒤집어 읽히게 했을 뿐이라, 걷어내는 것으로 방향이 맞는다 —
 *     ★여기서 단언까지 «한 번 더» 뒤집으면 「변해야 한다」가 되어 병을 잠그는 검사가 된다.
 *
 *   ⛔왜 여태 «그냥 빨갛게» 두지 않았었나 — 빨강 하나를 「카드가 안 닫혔다」는 표시로 쓰면
 *     전수가 영영 exit 1 이 되고 ★«다음에 생기는 진짜 빨강»이 그 안에 숨는다.
 *     실제로 났다: 2026-09-23 전수가 「2 failed」로 떴는데 새 빨강인지 알던 빨강인지
 *     한눈에 못 갈라, 가르는 데만 여덟 번 다시 쟀다(그 하나는 M9 부하 플레이크였다).
 *     ⇒ 그 값은 T-178 이 «손에 잡힌 지금» 끝났다. 고치는 쪽이 이 빨강을 보고 닫는다.
 *
 *   ★짝 — 아래 `E10-전제`(늘 초록)는 그대로 둔다. `test.fail` 시절의 안전장치였지만,
 *     지금도 「준 칸조차 안 변했다/다른 열이 변했다」를 따로 울어 주는 값이 있다.
 *   ★더 잘게 가른 같은 축 = tests/dom/grid-row0-cell-style.dom.spec.js (T178-1b·2b·2c·3).
 *     그쪽이 «열 기본값이 여전히 사는가»(T178-2a)까지 같이 잠근다 — 여기만 고치고
 *     폴백을 없애면 그 기능이 사라진다.
 * ════════════════════════════════════════════════════════════════════════ */

/** E10 의 표본을 뜬다 — 전제 검사와 본 검사가 «같은» 것을 본다. */
async function runE10(page) {
  const errs = await boot(page);
  const r = await page.evaluate(async () => {
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row); block.classList.add('selected');
    const css = (r2, c2) => {
      const el = block.querySelector('.grd-cell[data-r="' + r2 + '"][data-c="' + c2 + '"]');
      if (!el) return '(gone)';
      const s2 = getComputedStyle(el);
      return s2.backgroundColor + ' | ' + s2.paddingTop + ' | ' + s2.borderTopLeftRadius;
    };
    const model = (r2, c2) => {
      try { const c3 = (window.__model(block).cells[r2] || [])[c2] || {}; return JSON.stringify([c3.bg ?? null, c3.padding ?? null, c3.radius ?? null]); }
      catch (_) { return 'ERR'; }
    };
    const before = { css10: css(1, 0), m10: model(1, 0), css11: css(1, 1) };
    // 0행 0열 «한 칸»에만 준다.
    const res = window.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, bg: '#7b2ff7', padding: 24, radius: 18 } });
    return {
      ok: !!(res && res.ok),
      before,
      css00: css(0, 0),
      css10: css(1, 0), m10: model(1, 0),
      css11: css(1, 1),
    };
  });
  return { errs, r };
}

/* ★E10-전제 — «늘 초록이어야 하는» 짝. 「준 칸조차 안 변했다」·「다른 열이 변했다」를
 *   따로 울어 준다. ⛔이게 빨개지면 E10 의 판정은 헛것이다 — 먼저 여기를 봐라. */
test('E10-전제 ★그물이 살아 있다 — 준 칸은 변하고, 다른 열은 안 변한다', async ({ page }) => {
  const { errs, r } = await runE10(page);
  expect(errs).toEqual([]);
  expect(r.ok, 'patchCell 이 실패했다 — 이 검사는 아무것도 안 본다').toBe(true);
  // 전제 — 준 칸은 실제로 변했다.
  expect(r.css00, '★준 칸조차 안 변했다 — 전제가 안 선다').toContain('rgb(123, 47, 247)');
  // 잣대 — «다른 열»(1행 1열)은 안 변한다. 이게 안 지켜지면 E10 의 단언은 헛것이다.
  expect(r.css11, '★다른 열까지 변했다 — 이 검사의 잣대가 죽었다').toBe(r.before.css11);
});

test('E10 ★«0행 칸»에 준 값이 아래 행 칸까지 칠하지 «않는다» — 칸 손잡이의 전제', async ({ page }) => {
  const { r } = await runE10(page);

  // 본 단언 ⑴ — 같은 열 «아래 행»의 화면이 따라 변했다.
  expect(r.css10, `★0행 0열에만 값을 줬는데 «1행 0열»의 화면이 따라 변했다.\n` +
    `   before: ${r.before.css10}\n   after : ${r.css10}\n` +
    '   행 0 = 열 그 자체(cols[].lines)이고 렌더러 폴백이 cell[k] ?? col[k] 라서다.\n' +
    '   ⇒ 칸 배경색/패딩/모서리 손잡이를 patchCell 로 그냥 이으면, 사용자가 칸 «하나»를 ' +
    '칠했을 때 그 열이 통째로 칠해진다').toBe(r.before.css10);

  // 본 단언 ⑵ — 그런데 «모델»은 그대로다. 데이터와 화면이 어긋난다(더 고약한 쪽).
  expect(r.m10, '★1행 0열은 «모델이 null 인 채로» 화면만 칠해졌다 — 저장본을 봐도 왜 칠해졌는지 ' +
    '안 보인다. 「없다」가 「안 칠해졌다」를 뜻하지 않는 자리다').toBe(r.before.m10);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E8 — ★없어야 할 것이 없나: 폭이 안 무너진다 (T-100 이 물린 자리).
 *   손잡이가 늘면 240px 패널이 짜부라진다. 지금은 «안 무너져» 있다 —
 *   고치는 쪽이 칸을 밀어 넣다가 무너뜨리면 여기가 운다(짝 검사).
 * ════════════════════════════════════════════════════════════════════════ */

for (const [where, addr] of [['글자 줄', A_TEXT], ['빈 칸', A_EMPTY]]) {
  test(`E8 ★«${where}» 패널 — 폭 240px 이 그대로고 가로로 넘치는 요소가 없다`, async ({ page }) => {
    const errs = await boot(page);
    const m = await page.evaluate((addr) => {
      const HOST = document.getElementById('host');
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
      HOST.appendChild(row); block.classList.add('selected');
      window.__open(block, addr);
      const right = document.getElementById('panel-right');
      const body = right.querySelector('.panel-body');
      const rb = body.getBoundingClientRect();
      const over = [];
      for (const el of body.querySelectorAll('*')) {
        const r = el.getBoundingClientRect();
        if (r.width === 0 && r.height === 0) continue;          // 0×0 유령은 안 센다
        if (r.right > rb.right + 0.5) over.push((el.id || el.className || el.tagName) + ' +' + Math.round(r.right - rb.right));
      }
      return {
        panelW: Math.round(right.getBoundingClientRect().width),
        scrollOver: body.scrollWidth - body.clientWidth,
        over: over.slice(0, 12),
      };
    }, addr);
    expect(errs).toEqual([]);
    expect(m.panelW, '★패널 폭이 240 이 아니다 — 기준이 달라졌으니 이 검사의 수를 다시 정해라').toBe(240);
    expect(m.scrollOver, `★패널 본문이 가로로 ${m.scrollOver}px 넘친다 (T-100 재발)`).toBeLessThanOrEqual(0);
    expect(m.over, `★패널 밖으로 삐져나온 요소: ${m.over.join(' · ')}`).toEqual([]);
  });
}

/* ══════════════════════════════════════════════════════════════════════════
 * E11 — ★«줄 단위» 정렬 손잡이. (팀리드 지시 2026-09-23)
 *
 *   정렬 손잡이는 지금 «열 단위» 하나뿐이다. 그런데 글자 줄 렌더러는 이미 line.align 을
 *   읽는다(`const align = line.align || colAlign || 'left';`) — 모델도 렌더도 되는데
 *   누를 데가 없는, E1~E3 과 «같은 부류»다.
 *
 *   ⛔증인을 「둘 중 하나」로 두면 안 된다 — 열 정렬 단추가 cell.align 과
 *     css.lineTextAlign 을 «둘 다» 움직여서 초록을 만들어 준다. 세로정렬에서 «블록이냐
 *     칸이냐»를 가른 것처럼, 여기선 «열이냐 줄이냐»를 가른다. ⇒ 증인은 line.align «하나».
 *
 *   ★왜 중요한가(팀리드 실측): 현빈 저장본 24 프로젝트에 image 줄이 통틀어 «1개»다.
 *     까닭이 「줄 단위 정렬 UI 가 없어서」다. 렌더러만 고치면 «MCP 로만 쓸 수 있는 기능»이
 *     열린다 — 사람 손엔 안 닿는다. 「렌더러가 읽는다」를 «된다»로 세면 틀린다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E11-a ★«글자 줄»의 정렬을 그 줄에만 주는 손잡이가 있다', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_TEXT);
  expect(errs).toEqual([]);
  /* ⛔열 정렬 단추가 실제로 «다른» 증인을 움직인다는 것을 먼저 세운다 —
     그래야 아래 빨강이 「줄 증인만 안 움직인다」는 뜻이 된다. */
  expect(movers(probe, ['css.lineTextAlign']).length,
    '★열 정렬 단추조차 안 잡힌다 — 이 검사의 대조군이 죽었다').toBeGreaterThan(0);

  const who = movers(probe, ['line.align', 'lines.anyAlign']);
  expect(who, '★고른 «줄»에 정렬을 주는 손잡이가 «하나도» 없다 — 정렬은 열 단위 하나뿐이다. ' +
    '글자 줄 렌더러는 line.align 을 이미 읽는다(line.align || colAlign). ' +
    '⛔열 정렬로 대신하면 «그 열의 모든 줄»이 같이 움직인다(E9 가 그걸 따로 잰다)').not.toEqual([]);
});

test('E11-b ★«이미지 줄»의 정렬을 그 줄에만 주는 손잡이가 있다', async ({ page }) => {
  const errs = await boot(page);
  const probe = await PROBE(page, A_IMG);
  expect(errs).toEqual([]);
  // 전제 — 정말 이미지 줄을 골랐다(Image 절이 떠 있다).
  expect(probe.results.some(r => r.id === 'grd-img-height'),
    '★Image 절이 안 떴다 — 이미지 줄을 안 고른 것이다. 이 검사는 아무것도 안 본다').toBe(true);

  const who = movers(probe, ['line.align', 'lines.anyAlign']);
  expect(who, '★고른 «이미지 줄»에 정렬을 주는 손잡이가 «하나도» 없다.\n' +
    '   ⚠️그리고 이 축은 렌더러와 «별개»다 — 지금 이미지 분기는 line.align 을 아예 «안 읽는다»\n' +
    '   (grid-block.js 이미지 분기의 alignCss 는 colAlign 만 본다, 게다가 widthPct<100 일 때만).\n' +
    '   ⇒ 렌더러 유닛이 그걸 고쳐도 «손잡이»는 따로 필요하다. 반대로 손잡이만 만들고\n' +
    '   렌더러를 안 고치면 「눌리는데 안 먹는」 칸이 된다 — 두 쪽 다 봐야 닫힌다').not.toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E12 (설계 M7) — ★「추가」와 「바꾸기」가 «같은 명부 하나»를 읽나.
 *   두 벌이면 따로 늙는다 — 이 레포의 고질이다(비율 상한이 한 곳만 4로 올라가 4열 입력이
 *   조용히 무시됐던 사고가 prop-grid.js 주석에 그대로 적혀 있다).
 *   ⛔이름을 안 본다 — 「추가로 만들 수 있는 종류 집합」과 「바꿔서 될 수 있는 종류 집합」을
 *     «실제로 만들어 보고» 비교한다. 같은 상수 하나를 읽으면 두 집합이 같아진다.
 * ════════════════════════════════════════════════════════════════════════ */

/** 패널 컨트롤을 전부 몰아 보고, 「새로 «생긴» 줄 종류」와 「«바뀐» 줄 종류」를 각각 모은다. */
const TYPE_SETS = async (page, addr) => page.evaluate(async ({ addr }) => {
  const HOST = () => document.getElementById('host');
  const PANEL = () => document.querySelector('#panel-right .panel-body');
  function remount() {
    HOST().innerHTML = ''; PANEL().innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST().appendChild(row); block.classList.add('selected');
    window.__block = block; window.__open(block, addr);
  }
  const types = () => {
    try { return (window.__model(window.__block).cells[addr.r][addr.c].lines || []).map(l => (l && l.type) || 'body'); }
    catch (_) { return []; }
  };
  const fire = (el, t) => el.dispatchEvent(new Event(t, { bubbles: true }));
  const added = new Set(), changed = new Set();
  remount();
  const n = PANEL().querySelectorAll('*').length;
  for (let i = 0; i < n; i++) {
    remount();
    const el = PANEL().querySelectorAll('*')[i];
    if (!el) continue;
    /* ★한 «조작»마다 앞뒤를 견준다. ⛔select 를 「옵션 전부 돌린 뒤 한 번」 견주면
         추가는 «쌓여서» 다 남지만 바꾸기는 «뒤 옵션이 앞을 덮어» 마지막 것만 남는다 —
         그러면 E6(한 컨트롤로 8종 추가)과 E12(added==changed)를 «이 자로는 동시에 만족할 수
         없고», 빨강이 제품 결함이 아니라 «자의 한계»가 된다(2026-09-23 구현자 실측).
       ⇒ 옵션 «하나»가 한 조작이다. */
    const collect = (before, after) => {
      if (after.length > before.length) {
        const bc = {}; before.forEach(t => { bc[t] = (bc[t] || 0) + 1; });
        for (const t of after) { if (bc[t]) { bc[t]--; continue; } added.add(t); }
      } else if (after.length === before.length) {
        for (let k = 0; k < after.length; k++) if (after[k] !== before[k]) changed.add(after[k]);
      }
    };
    const tag = el.tagName.toLowerCase(), ty = String(el.type || '').toLowerCase();
    try {
      if (tag === 'select') {
        for (const o of el.options) {
          const b2 = types();
          el.value = o.value; fire(el, 'input'); fire(el, 'change');
          collect(b2, types());
        }
      } else if (tag === 'input' && ty === 'file') { /* skip */ }
      else { const b2 = types(); el.click(); collect(b2, types()); }
    } catch (_) {}
  }
  return { added: [...added].sort(), changed: [...changed].sort() };
}, { addr });

test('E12 ★「줄 추가」와 「줄 종류 바꾸기」가 내놓는 종류 «명부»가 같다 (두 벌이면 따로 늙는다)', async ({ page }) => {
  const errs = await boot(page);
  const t = await TYPE_SETS(page, A_TEXT);
  expect(errs).toEqual([]);
  expect(t.added, '★추가로 만들 수 있는 종류가 «0개»다 — 이 검사의 전제가 안 선다').not.toEqual([]);
  expect(t.changed, `★«바꾸기»로 될 수 있는 종류가 0개다 (추가로 되는 것: ${t.added.join(', ')}).\n` +
    '   바꾸기 길 자체가 없어서다(E7). 길을 낼 때 «추가와 같은 상수 하나»에서 종류를 읽어라 — ' +
    '두 벌로 적으면 한쪽만 늙는다').not.toEqual([]);
  expect(t.changed, `★두 명부가 다르다 — 추가: [${t.added.join(', ')}] / 바꾸기: [${t.changed.join(', ')}]`)
    .toEqual(t.added);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E13 (설계 M2) — ★패널이 내놓는 종류 중에 «화면에서 사라지는» 것이 없다.
 *   duo 는 cols 없으면, graph 는 items 없으면 _gridLineHtml 이 return '' 한다 —
 *   사용자가 고르면 «줄이 증발»한다. 위험 명부를 이름으로 안 적고 «실제로 렌더해 보고» 뜬다.
 *   ★지금은 초록이다(단추 셋이 body·gap·image 뿐). 종류 목록이 늘어나는 그 패치에서 문다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E13 ★«페이로드 없이 고르면 줄이 사라지는» 종류가 패널 목록에 없다', async ({ page }) => {
  const errs = await boot(page);
  const roles = await page.evaluate(() => window.__roles);
  // ⑴ 위험 명부를 «실측»으로 뜬다 — 이름을 손으로 안 적는다.
  const vanish = await page.evaluate(async ({ cand }) => {
    const HOST = document.getElementById('host');
    const out = [];
    for (const t of cand) {
      HOST.innerHTML = '';
      const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
      HOST.appendChild(row);
      window.updateGridBlock(block.id, { patchCell: { r: 0, c: 0, lineIndex: 1, type: t } });
      const cell = block.querySelector('.grd-cell[data-r="0"][data-c="0"]');
      const el = cell && cell.querySelector('[data-line="1"]');
      if (!el) out.push(t);          // 그 줄이 화면에서 «없어졌다»
    }
    return out;
  }, { cand: [...roles, 'image', 'gap', 'duo', 'graph'] });

  // 계측기 점검 — 위험이 «하나도 안 잡히면» 이 검사는 아무것도 안 지킨다.
  expect(vanish, '★페이로드 없이 사라지는 종류를 «하나도» 못 찾았다 — 이 검사는 검사처럼 생긴 문장이다. ' +
    '(grid-block.js 의 duo 는 cols 없으면, graph 는 items 없으면 return \'\' 한다)').not.toEqual([]);

  const t = await TYPE_SETS(page, A_TEXT);
  const offered = [...new Set([...t.added, ...t.changed])];
  const bad = offered.filter(x => vanish.includes(x));
  expect(errs).toEqual([]);
  expect(bad, `★패널이 내놓는 종류에 «고르면 줄이 사라지는» 것이 있다: ${bad.join(', ')}\n` +
    `   (패널 목록: ${offered.join(', ') || '없음'} / 위험 명부 실측: ${vanish.join(', ')})\n` +
    '   페이로드를 같이 안 주면 렌더러가 return \'\' 한다 — 사용자에겐 「줄이 증발했다」로 보인다')
    .toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * E14 (설계 M3) — ★종류를 바꾸면 «앞 종류의 짐»이 안 남는다.
 *   image → body 로 바꿨는데 imgSrc 가 남으면 dataURL 수백 KB 가 저장본에 눌러앉는다.
 *   ⚠️바꾸는 «손잡이»는 아직 없다(E7). 그래서 여기서는 그 손잡이가 «탈» 길(patchCell)을
 *     직접 재 둔다 — 손잡이를 만들 때 이 자리를 같이 정해야 한다.
 * ════════════════════════════════════════════════════════════════════════ */

test('E14 ★image → body 로 바꾸면 imgSrc 가 «안» 남는다 (전환 경로 = 손잡이가 탈 길)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(async ({ addr }) => {
    const HOST = document.getElementById('host');
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(window.__FIX)));
    HOST.appendChild(row);
    const line = () => { try { return (window.__model(block).cells[addr.r][addr.c].lines || [])[addr.li] || {}; } catch (_) { return {}; } };
    const before = line();
    const res = window.updateGridBlock(block.id, { patchCell: { r: addr.r, c: addr.c, lineIndex: addr.li, type: 'body', text: '바뀐 줄' } });
    const after = line();
    return {
      ok: !!(res && res.ok),
      wasImage: before.type === 'image' && !!before.imgSrc,
      afterType: after.type,
      leftovers: ['imgSrc', 'height', 'widthPct'].filter(k => after[k] !== undefined),
      dsBytes: (block.dataset.cells || '').length + (block.dataset.cols || '').length,
    };
  }, { addr: A_IMG });
  expect(errs).toEqual([]);
  expect(r.wasImage, '★전제가 안 선다 — 픽스처의 그 줄이 이미지가 아니다').toBe(true);
  expect(r.ok, 'patchCell 이 실패했다').toBe(true);
  expect(r.afterType, '종류가 안 바뀌었다 — 이 검사는 아무것도 안 본다').toBe('body');
  expect(r.leftovers, `★종류를 바꿨는데 앞 종류의 필드가 남았다: ${r.leftovers.join(', ')} ` +
    `(지금 dataset ${r.dsBytes}바이트). imgSrc 는 dataURL 이라 수백 KB 가 저장본에 눌러앉는다. ` +
    '⇒ 「종류 바꾸기」 손잡이를 만들 때 앞 종류의 필드를 «같이 지워야» 한다').toEqual([]);
});

/* ══════════════════════════════════════════════════════════════════════════
 * ★★ 축 G — «델타» 그물. (설계 유닛 명세 2026-09-23)
 *
 * ★원칙: **델타를 재라, 절대값을 재지 마라.**
 *   패널이 이미 세로로 넘치는 것은 기준선 86dce84 에 «있던» 것이고 별건이다.
 *   그걸 이 유닛의 빨강으로 올리면 «남의 결함을 우리 장부에 적는 것»이 된다.
 *   ⇒ 절대값은 «보고만» 한다(합격선 없음). 합격선은 «패치 전 ↔ 후»의 차이에만 건다.
 *
 * ⛔★델타는 «두 번 재서 빼는 것»이다 — 한 번 재고 설계자 산술과 빼면 그건 CSS 산술이지
 *   실측이 아니다. ⇒ 기준선 값을 «골든 파일»로 찍어 커밋해 두고, 패치 나무에서 같은
 *   자(같은 창·같은 픽스처·같은 격자·같은 선택 줄)로 한 번 더 재서 «뺀다».
 *
 * ⛔골든은 «조용히 다시 찍히면» 안 된다 — 재촬영이 증명을 덮는다. 그래서
 *   ⑴ 골든에 기준선 커밋을 적어 두고 검사가 그걸 대조하며
 *   ⑵ 파일이 없으면 «찍고 나서 실패»한다(사람이 커밋하게).
 * ════════════════════════════════════════════════════════════════════════ */

/* ★2026-09-24 «재촬영» — 86dce84 → 59c6d63 (이 가지의 바닥).
 *   까닭: 86dce84 이후 이 패널에 열여덟 커밋이 들어오며 골든 대비 +38px 이 이미 쌓였다
 *   (실측 2026-09-24: 59c6d63 의 제품코드로 재면 scrollHeight 1173 · 컨트롤 45,
 *    골든은 1135 · 35). 합격선 +60 의 남은 여유가 22px 인데 «손잡이 한 줄»(prop-row 하나)이
 *   실측 30px 이라, 새 손잡이가 «원리적으로» 못 들어간다.
 *   ⇒ 즉 이 수는 「한 커밋의 순증」이 아니라 「열여덟 커밋의 누적」을 재고 있었다.
 *   ⛔합격선 60 은 «한 글자도» 안 넓힌다. 기준점만 이 가지의 바닥으로 옮긴다
 *     — 이 파일이 스스로 적어 둔 절차 그대로다(「다시 찍을 땐 «따로 커밋»해라」).
 *   ⚠️잃는 것을 적는다: 저 +38px 의 «빚»이 여기서 0 으로 리셋된다. 이 패널을 같이 만지는
 *     다른 유닛의 가지에도 병합 시 같은 사면이 간다 — 팀리드가 «알고» 받아야 하는 값이다. */
const GOLDEN_BASELINE = '59c6d63';
const GOLDEN_PATH = path.join(__dirname, 'fixtures', 'grid-panel-golden.json');

/* ★「골든에 86dce84 라고 «적혀 있다»」와 「그 판에서 «찍혔다»」는 다른 말이다.
 *   실제로 났다(2026-09-23): 구현자의 «패치 트리»에서 G1 이 골든을 스스로 찍었고, 파일엔
 *   baseline:86dce84 라고 적혔는데 수는 패치본 치수였다 — 오염된 증거가 기준선 행세를 했다.
 * ⇒ 문자열을 믿지 않는다. 패널 치수를 «만드는» 제품 파일들의 내용을 해시해 적어 두고,
 *   그 해시가 «기준선 커밋의» 같은 파일들과 일치하는지 검사가 직접 대조한다.
 *   ⛔HEAD 를 쓰지 않는다 — 내 커밋은 tests/ 만 건드리므로 HEAD 는 기준선이 아니다.
 *     「제품코드가 기준선이냐」가 물어야 할 것이다. */
const PRODUCT_INPUTS = [
  'js/props/prop-grid.js', 'js/props/_helpers.js', 'js/props/_typo-section.js',
  'js/blocks/grid-block.js', 'css/editor-props.css', 'css/editor-panels.css', 'css/color-picker.css',
];
const sha12 = (buf) => require('crypto').createHash('sha256').update(buf).digest('hex').slice(0, 12);
/** 지금 나무의 제품코드 지문. */
function productShaNow() {
  return sha12(PRODUCT_INPUTS.map(f => f + '\0' + fs.readFileSync(path.join(REPO, f), 'utf8')).join('\0'));
}
/** «기준선 커밋»의 제품코드 지문 — git 에서 직접 꺼낸다(작업본이 무엇이든 무관). */
function productShaAtBaseline() {
  const { execFileSync } = require('child_process');
  return sha12(PRODUCT_INPUTS.map(f =>
    f + '\0' + execFileSync('git', ['show', `${GOLDEN_BASELINE}:${f}`], { cwd: REPO, encoding: 'utf8', maxBuffer: 1 << 28 })
  ).join('\0'));
}

/* 4×4 · 글자 줄 선택 — 설계 명세가 못박은 «같은 픽스처». */
const FIX_4x4 = (() => {
  const line = (t, s) => ({ type: t, text: s });
  const cell = (tag) => ({ lines: [line('body', tag + '-0'), line('caption', tag + '-1')] });
  const cells = [];
  for (let r = 0; r < 4; r++) {
    const row = [];
    for (let c = 0; c < 4; c++) row.push(cell(`${r}${c}`));
    cells.push(row);
  }
  cells[0][0] = { lines: [line('body', 'A0'), line('h2', 'A1'), line('caption', 'A2')] };
  return {
    cols: [0, 1, 2, 3].map(() => ({ width: 1, lines: [] })),
    rows: [0, 1, 2, 3].map(() => ({ height: 'auto' })),
    cells,
  };
})();
const A_4x4 = { r: 0, c: 0, li: 1 };

/** 같은 자. ⛔여기를 고치면 골든이 무효가 된다 — 고칠 땐 골든도 «따로» 다시 찍어야 한다. */
async function measurePanel(page) {
  await page.setViewportSize({ width: 1280, height: 900 });
  return page.evaluate(({ fx, addr }) => {
    const HOST = document.getElementById('host');
    HOST.innerHTML = '';
    document.querySelector('#panel-right .panel-body').innerHTML = '';
    const { row, block } = window.__mk(JSON.parse(JSON.stringify(fx)));
    HOST.appendChild(row); block.classList.add('selected');
    window.__open(block, addr);

    const right = document.getElementById('panel-right');
    const body = right.querySelector('.panel-body');
    const rb = body.getBoundingClientRect();
    const rel = (el) => { const r = el.getBoundingClientRect(); return { top: Math.round(r.top - rb.top), bottom: Math.round(r.bottom - rb.top), w: Math.round(r.width) }; };

    /* ★줄바의 닻 — ⛔단추 «하나»에 걸면 그 단추가 select 로 갈음되는 순간 닻이 «없어지고»,
         그러면 「Δ≤0」이 «안 밀렸다»가 아니라 «못 쟀다»가 된다(2026-09-23 구현자 실측:
         lineBarBottom 828 → -1 로 G2 가 거짓 통과했다). 오늘 이 저장소에서 난 「닻이 옮겨
         붙어 초록」의 형제다 — 저쪽은 옮겨 붙었고 이쪽은 없어졌다. 둘 다 빨강으로 안 나온다.
       ⇒ ⑴ 줄 «요약»이 사는 절(prop-section)을 1순위 닻으로 쓴다 — 단추가 무엇으로 바뀌든 산다.
         ⑵ 어느 닻을 썼는지 «같이 적는다». 골든과 다르면 실패 — 같은 것을 재고 있지 않다는 뜻이다.
         ⑶ 하나도 못 찾으면 «-1»이 아니라 MISSING/null 로 적어 G2 가 «실패»하게 한다. */
    const anchorTry = [
      ['summary-section', () => document.getElementById('grd-line-summary')?.closest('.prop-section')],
      ['delbtn-section', () => document.getElementById('grd-line-del-btn')?.closest('.prop-section')],
      ['addbtn', () => document.getElementById('grd-line-add-btn')],
    ];
    let anchorName = 'MISSING', anchorEl = null;
    for (const [name, get] of anchorTry) { const el = get(); if (el) { anchorName = name; anchorEl = el; break; } }

    const barBtns = [...(anchorEl ? anchorEl.querySelectorAll('button, select') : [])];
    const colorFields = [...body.querySelectorAll('.prop-color-field')];
    const overflowRight = [...body.querySelectorAll('*')].filter(el => {
      const r = el.getBoundingClientRect();
      return (r.width || r.height) && r.right > rb.right + 0.5;
    }).length;

    return {
      panelW: Math.round(right.getBoundingClientRect().width),
      bodyClientW: body.clientWidth,
      bodyScrollW: body.scrollWidth,
      /* 절대값 — «보고만». 합격선 없음(기준선에 이미 있던 것이라 별건 카드로 간다). */
      scrollHeight: body.scrollHeight,
      clientHeight: body.clientHeight,
      lineBarAnchor: anchorName,
      lineBarBottom: anchorEl ? rel(anchorEl).bottom : null,     // ⛔못 찾으면 null — G2 가 실패한다
      barBtnN: barBtns.length,
      barBtnRows: barBtns.length ? new Set(barBtns.map(b => rel(b).top)).size : null,
      colorFieldN: colorFields.length,
      colorFieldMinW: colorFields.length ? Math.min(...colorFields.map(f => rel(f).w)) : -1,
      overflowRight,
      controlN: body.querySelectorAll('input,select,textarea,button').length,
    };
  }, { fx: FIX_4x4, addr: A_4x4 });
}

test('G0 ★자가 흔들리지 않는다 — 같은 창·같은 픽스처로 두 번 재면 «같은 수»다', async ({ page }) => {
  const errs = await boot(page);
  const a = await measurePanel(page);
  const b = await measurePanel(page);
  expect(errs).toEqual([]);
  expect(a.controlN, '패널이 안 떴다 — 이 자는 아무것도 안 잰다').toBeGreaterThan(10);
  /* ⛔델타 게이트의 진짜 위험은 «잣대가 흔들리는 것»이다. 흔들리면 Δ 가 소음이 되고,
     그 소음을 합격선 60px 이 조용히 삼킨다. 재현성을 «먼저» 세운다. */
  expect(b, '★같은 자로 두 번 쟀는데 수가 달라졌다 — 이 자로 잰 Δ 는 아무 뜻이 없다').toEqual(a);
});

test('G1 ★기준선 골든이 있고, 그 골든이 «이 나무의 기준선»에서 찍힌 것이다', async ({ page }) => {
  const errs = await boot(page);
  const now = await measurePanel(page);
  expect(errs).toEqual([]);

  if (!fs.existsSync(GOLDEN_PATH)) {
    fs.mkdirSync(path.dirname(GOLDEN_PATH), { recursive: true });
    const shot = productShaNow();
    fs.writeFileSync(GOLDEN_PATH, JSON.stringify({
      _: '기준선 패널 치수. ⛔손으로 고치지 마라 — 다시 찍을 땐 «따로 커밋»해라(재촬영이 증명을 덮는다).',
      baseline: GOLDEN_BASELINE, fixture: '4x4 · (0,0) li:1 글자 줄 · viewport 1280x900',
      /* ★«찍힌 판»의 제품코드 지문. 적힌 문자열이 아니라 이것이 증거다. */
      productSha: shot,
      metrics: now,
    }, null, 2) + '\n', 'utf8');
    throw new Error(`★골든을 «방금» 찍었다 (제품코드 지문 ${shot}). ` +
      '조용히 찍고 통과하면 다음 사람이 「비교했다」고 믿는다.\n' +
      '   ⛔★«패치 트리»에서 찍었다면 그건 기준선이 아니다 — 지우고 기준선 나무에서 다시 찍어라. ' +
      '다음 줄의 G1 이 지문으로 그걸 잡는다');
  }
  const g = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8'));
  expect(g.baseline, `★골든에 «다른» 기준선(${g.baseline})이 적혀 있다 — 약속은 ${GOLDEN_BASELINE} 다`).toBe(GOLDEN_BASELINE);
  /* ★★여기가 핵심 — «적혀 있다»가 아니라 «그 판에서 찍혔다»를 잰다. */
  let wantSha = null;
  try { wantSha = productShaAtBaseline(); }
  catch (e) {
    throw new Error('★기준선 제품코드를 못 읽는다(git show 실패) — 이 골든이 «어느 판»에서 ' +
      '찍혔는지 확인할 수 없다. 확인 못 하는 골든은 증거가 아니다. 원인: ' + e.message);
  }
  expect(g.productSha, `★이 골든은 «기준선이 아닌 판»에서 찍혔다.\n` +
    `   골든에 적힌 제품코드 지문: ${g.productSha}\n` +
    `   ${GOLDEN_BASELINE} 의 제품코드 지문 : ${wantSha}\n` +
    '   파일엔 baseline 이 적혀 있어도 수는 «그 판»의 치수다 — 오염된 증거가 기준선 행세를 한다. ' +
    '기준선 나무에서 다시 찍어 커밋해라').toBe(wantSha);
  expect(Object.keys(g.metrics).sort(), '★골든과 지금 자가 «재는 항목»이 다르다 — 자를 고쳤으면 골든도 ' +
    '따로 다시 찍어라(같은 커밋에 묶지 마라: 재촬영이 증명을 덮는다)').toEqual(Object.keys(now).sort());
});

test('G2 ★델타 — 순증·줄바 밀림·가로 잘림·색칸 폭이 기준선보다 나빠지지 않았다', async ({ page }) => {
  test.skip(!fs.existsSync(GOLDEN_PATH), '골든이 아직 없다 — G1 을 먼저 돌려라');
  const errs = await boot(page);
  const now = await measurePanel(page);
  const g = JSON.parse(fs.readFileSync(GOLDEN_PATH, 'utf8')).metrics;
  expect(errs).toEqual([]);

  const d = (k) => now[k] - g[k];
  const report = ['   [절대값 — 보고만, 합격선 없음]',
    `     scrollHeight ${g.scrollHeight} → ${now.scrollHeight} (clientHeight ${now.clientHeight})`,
    `     줄바 아랫변 ${g.lineBarBottom} → ${now.lineBarBottom} · 색칸 ${g.colorFieldN}개 최소폭 ${now.colorFieldMinW}`,
    `     컨트롤 ${g.controlN} → ${now.controlN}`].join('\n');

  // ⑴ 순증 — 설계 합격선 Δ ≤ +60px.
  expect(d('scrollHeight'), `★패널 순증이 ${d('scrollHeight')}px 다 (합격선 +60).\n${report}`).toBeLessThanOrEqual(60);
  /* ⛔Δ<0 은 「좋다」가 아니다 — 절이 «하나 안 뜬» 것일 수 있다. 무엇이 빠졌는지 먼저 세라. */
  expect(d('scrollHeight') < 0 ? `줄었다(${d('scrollHeight')}px) · 컨트롤 ${g.controlN}→${now.controlN}` : '',
    `★패널이 «줄었다». 좋아진 게 아니라 «절이 하나 안 떴을» 수 있다 — 무엇이 빠졌는지 먼저 세라.\n${report}`).toBe('');

  /* ⑴-전 ★못 잰 것이 «통과»로 새지 않게. 오늘 이 자가 정확히 그렇게 거짓 통과했다.
     닻이 사라지면 Δ 가 «-829» 같은 큰 음수가 되어 「안 밀렸다」를 공짜로 만족시킨다. */
  expect(now.lineBarAnchor, '★줄바의 닻을 «하나도» 못 찾았다 — Δ 는 「안 밀렸다」가 아니라 ' +
    '「못 쟀다」다. 요약(#grd-line-summary)이 사는 prop-section 이 살아 있어야 한다').not.toBe('MISSING');
  expect(now.lineBarAnchor, `★닻이 «바뀌었다» (골든 ${g.lineBarAnchor} → 지금 ${now.lineBarAnchor}). ` +
    '같은 것을 재고 있지 않으니 Δ 는 비교가 아니다').toBe(g.lineBarAnchor);
  const sentinels = Object.entries(now).filter(([k, v]) => v === null || (v === -1 && g[k] !== -1));
  expect(sentinels.map(([k, v]) => `${k}=${v}`), '★«못 쟀다»는 표시가 남았다 — 그대로 두면 Δ 가 ' +
    '큰 음수가 되어 합격선을 공짜로 통과한다').toEqual([]);

  // ⑵ 줄바가 더 밀리지 않았다. ⛔offsetTop 이 아니라 rect (스크롤이 안 섞이게 rb.top 기준 상대값).
  expect(d('lineBarBottom'), `★줄바가 기준선보다 ${d('lineBarBottom')}px 더 아래로 밀렸다.\n${report}`).toBeLessThanOrEqual(0);

  // ⑶ 가로 잘림 0 — 껍데기가 overflow:hidden 이라 초과분은 «없는 것»으로 보인다(스크롤로도 못 본다).
  expect(now.bodyScrollW - now.bodyClientW, `★패널 본문이 가로로 ${now.bodyScrollW - now.bodyClientW}px 넘친다`).toBeLessThanOrEqual(0);
  expect(now.overflowRight, `★패널 오른쪽 밖으로 나간 요소 ${now.overflowRight}개 — overflow:hidden 이라 ` +
    '사용자에겐 «잘려서 없는 것»으로 보인다').toBe(0);

  // ⑷ T-100 — 색 칸이 «전건» 기준선보다 좁아지지 않았다(그리고 기준선이 128 이상이었으면 계속 128 이상).
  expect(now.colorFieldMinW >= g.colorFieldMinW, `★색 칸 최소폭이 ${g.colorFieldMinW} → ${now.colorFieldMinW} 로 좁아졌다 (T-100).\n${report}`).toBe(true);
  if (g.colorFieldMinW >= 128) {
    expect(now.colorFieldMinW, `★색 칸이 128px 아래로 내려갔다 (기준선 ${g.colorFieldMinW}) — T-100 재발`).toBeGreaterThanOrEqual(128);
  }

  // ⑸ 줄바 단추가 «한 줄»을 유지한다.
  expect(now.barBtnRows, `★줄바 단추가 ${now.barBtnRows}줄로 갈라졌다 (기준선 ${g.barBtnRows}줄).\n${report}`).toBeLessThanOrEqual(g.barBtnRows);
});
