/* select-all-delete-shape.dom.spec.js — T-085 「⌘A 전체선택 후 Delete 하면 도형만 안 지워진다」 회귀 그물.
 *
 * ★출처: 2026-09-20 «사용자 관점 훑기». 실앱 실측(포트 9527, 40% 줌, 고치기 «전»)
 *     ⌘A 선택집합 = [gap, text, text, gap]        ← .shape-block 0개
 *     Delete 뒤   = .shape-block 1개가 그대로 남음  ← 사용자가 본 증상
 *   뿌리: js/editor.js 의 ⌘A 분기가 «손으로 한 벌 더 적은» 블록 클래스 목록을 쓰고 있었고
 *        그 목록이 뒤처져 있었다(shape 외 11종 누락). 고침 = SSOT(SECTION_BLOCK_TYPE_SEL) 공유.
 *
 * 이 검사는 «진짜 소스»를 떠다 돌린다 — 선택 셀렉터(SECTION_BLOCK_TYPE_SEL)와
 * 삭제 함수(deleteSelectedFromCanvas) 둘 다 js/editor.js 에서 잘라 쓴다.
 * 음성대조(고치기 «전» 목록)를 같은 그릇에 넣어 빨강을 실제로 본다.
 *
 * ⛔앱을 «안» 띄운다. 실행: npm run test:dom -- select-all-delete-shape
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const EDITOR_SRC = fs.readFileSync(path.join(REPO, 'js/editor.js'), 'utf8').replace(/\r\n/g, '\n');

/** 함수 «전체»를 중괄호 균형으로 떠낸다(매개변수 괄호를 먼저 닫는다). grid-block-select-delete 선례. */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}

/** 선언의 끝(;) 을 «따옴표·줄주석을 건너뛰며» 찾는다.
 *  ⚠️단순 indexOf(';\n') 는 `...';  // 주석` 꼴에서 «다음 선언»까지 집어삼킨다(실측으로 물렸다). */
function endOfDecl(src, from) {
  let q = null;
  for (let i = from; i < src.length; i++) {
    const c = src[i];
    if (q) { if (c === '\\') { i++; continue; } if (c === q) q = null; continue; }
    if (c === "'" || c === '"' || c === '`') { q = c; continue; }
    if (c === '/' && src[i + 1] === '/') { while (i < src.length && src[i] !== '\n') i++; continue; }
    if (c === ';') return i;
  }
  throw new Error('선언의 끝(;)을 못 찾았다');
}

/** `const NAME = <식>;` 의 «식»만 떠낸다. */
function declRhs(src, name) {
  const i = src.indexOf(`const ${name} =`);
  if (i < 0) throw new Error(`선언을 못 찾았다: ${name}`);
  return src.slice(i + `const ${name} =`.length, endOfDecl(src, i)).trim();
}

const DEL_SRC     = extractFn(EDITOR_SRC, 'deleteSelectedFromCanvas');
const SEL_NOW_RHS = declRhs(EDITOR_SRC, 'SECTION_BLOCK_TYPE_SEL');
const DEL_LIST    = declRhs(EDITOR_SRC, 'CANVAS_SEL_BLOCKS');

/* ★고치기 «전» 목록 — int/0920b 29ae1cb 의 ⌘A 분기에 손으로 적혀 있던 그대로. 음성대조용 상수. */
const SEL_OLD =
  "'.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, ' +" +
  "'.label-group-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .modal-block, .icon-text-block, .canvas-block, .banner02-block, .comparison-block, .vector-block, .qa-block'";

/* 섹션 하나 = gap + [텍스트프레임>텍스트] + [도형프레임>도형] + [row>챗] + gap.
   실앱 DOM 구조 그대로다(포트 9527 실측: 프레임은 .row 없이 .section-inner 직속). */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas">
  <div class="section-block selected" id="sec1">
    <div class="section-inner" id="host">
      <div class="gap-block" id="gb1"></div>
      <div class="frame-block" data-text-frame="true" id="ss1"><div class="text-block" id="tb1">T</div></div>
      <div class="frame-block" id="ss2"><div class="shape-block" id="shp1"></div></div>
      <div class="row" id="row1"><div class="chat-block" id="chb1"></div></div>
      <div class="gap-block" id="gb2"></div>
    </div>
  </div>
</div>
</body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, (route) =>
    route.fulfill({ contentType: 'text/html', body: HARNESS }));
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  return errs;
}

/** ⌘A 분기가 하는 일(활성 섹션 안 selRhs 매칭 전부에 .selected) → 진짜 삭제함수 실행. */
async function selectAllThenDelete(page, selRhs, delSrc, delList) {
  return page.evaluate(([selRhs, delSrc, delList]) => {
    const SEL = new Function('return (' + selRhs + ')')();
    const activeSec = document.querySelector('.section-block.selected') || document.querySelector('.section-block');
    const picked = [...activeSec.querySelectorAll(SEL)];
    picked.forEach(b => b.classList.add('selected'));

    const toasts = [];
    window.showToast = (m) => toasts.push(m);
    window.CANVAS_SEL_BLOCKS = new Function('return (' + delList + ')')();
    window.canvasEl = document.getElementById('canvas');
    window.pushHistory = () => {};
    window.buildLayerPanel = () => {};
    window.ensureHistoryCheckpoint = () => {};
    window.isSectionProtected = () => false;
    window.addGhostSection = () => {};
    const scope = {
      clearAssetImage: () => {},
      deselectAll: () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')),
      multiSel: { cols: new Set(), blocks: new Set(), sections: new Set() },
      clearMultiSel: () => {},
      canvasEl: document.getElementById('canvas'),
      pushHistory: () => {},
      ensureHistoryCheckpoint: () => {},
    };
    const names = Object.keys(scope);
    const fn = new Function(...names, `${delSrc}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    const consumed = fn();
    return {
      picked: picked.map(e => e.id),
      consumed,
      toasts,
      left: [...document.querySelectorAll('#host [id]')].map(e => e.id),
      shapes: document.querySelectorAll('.shape-block').length,
      texts: document.querySelectorAll('.text-block').length,
      chats: document.querySelectorAll('.chat-block').length,
      gaps: document.querySelectorAll('.gap-block').length,
    };
  }, [selRhs, delSrc, delList]);
}

test('음성대조 ★고치기 «전» 목록이면 ⌘A 가 도형을 안 고르고 Delete 뒤에도 도형이 남는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await selectAllThenDelete(page, SEL_OLD, DEL_SRC, DEL_LIST);
  expect(r.picked, '옛 목록인데 도형이 골라졌다 — 이 대조가 버그를 재현 못 한다').not.toContain('shp1');
  expect(r.shapes, '★이 대조가 빨강(도형 잔존)을 못 만든다 ⇒ 아래 본검사가 아무것도 증명 못 한다').toBe(1);
  expect(r.chats, '옛 목록은 챗블럭도 안 골랐다 — 같이 남아야 한다').toBe(1);
  expect(r.texts, '텍스트는 옛 목록에도 있었으니 지워져야 한다').toBe(0);
  expect(errs).toEqual([]);
});

test('본검사 ★지금 목록(SECTION_BLOCK_TYPE_SEL)이면 ⌘A→Delete 가 도형까지 «다» 지운다', async ({ page }) => {
  const errs = await boot(page);
  const r = await selectAllThenDelete(page, SEL_NOW_RHS, DEL_SRC, DEL_LIST);
  expect(r.picked, '⌘A 가 도형을 안 골랐다 — T-085 재발').toContain('shp1');
  expect(r.consumed).toBe(true);
  expect(r.toasts, '토스트가 떴다(보호섹션 등 엉뚱한 갈래로 샜다)').toEqual([]);
  expect(r.shapes, '★도형이 안 지워졌다 — T-085 재발').toBe(0);
  expect(r.texts, '텍스트가 안 지워졌다').toBe(0);
  expect(r.chats, '챗블럭이 안 지워졌다').toBe(0);
  expect(r.gaps, 'Gap 이 안 지워졌다').toBe(0);
  expect(r.left, '도형 래퍼 프레임(ss2)이 도형과 같이 안 없어졌다').not.toContain('ss2');
  expect(errs).toEqual([]);
});
