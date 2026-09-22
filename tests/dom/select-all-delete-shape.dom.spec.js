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
 * ★2026-09-21 픽스 라운드에서 «프레임이 미리 골라진 채 ⌘A→Delete» 축이 더해졌다(아래 픽스① 3건).
 *   ⌘A 는 기존 선택을 «풀지 않고 더하기»만 하므로, 프레임이 이미 골라져 있으면 삭제함수의
 *   프레임 단독삭제 갈래가 먼저 걸려 «프레임 한 줄»만 지우고 return 했다.
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
/* deleteSelectedFromCanvas 가 쓰는 SSOT 파생(.selected 판) — «진짜 소스의 식»을 그대로 떠온다. */
const SEL_SELECTED_RHS = declRhs(EDITOR_SRC, 'SECTION_BLOCK_TYPE_SEL_SELECTED');

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
      <!-- Free 프레임(빈 그릇) — 삽입 직후엔 이게 .selected 로 남는다(실앱 실측) -->
      <div class="frame-block" data-free-layout="true" id="ssFree"></div>
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
async function selectAllThenDelete(page, selRhs, delSrc, delList, selSelRhs, preSelectIds) {
  return page.evaluate(([selRhs, delSrc, delList, selSelRhs, preSelectIds]) => {
    const SEL = new Function('return (' + selRhs + ')')();
    /* ★⌘A 는 기존 선택을 «풀지 않고 더한다» — 그래서 미리 골라 둔 것이 그대로 남는다.
       preSelectIds 로 그 상황(예: Free 프레임 삽입 직후 프레임이 selected)을 재현한다. */
    (preSelectIds || []).forEach(id => document.getElementById(id)?.classList.add('selected'));
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
    const SECTION_BLOCK_TYPE_SEL_SELECTED = new Function('SECTION_BLOCK_TYPE_SEL', 'return (' + selSelRhs + ')')(SEL);
    const scope = {
      /* ★하네스는 잘라 넣은 코드가 부르는 «최상위 선언 전부»를 실어야 한다(레포 규약).
         2026-09-22 T-099 로 deleteSelectedFromCanvas 가 SSOT «원본»(.selected 없는 판)도
         쓰기 시작했다 — 안 실으면 ReferenceError 로 «검사처럼 생긴 빨강»이 난다. */
      SECTION_BLOCK_TYPE_SEL: SEL,
      SECTION_BLOCK_TYPE_SEL_SELECTED,
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
      frames: document.querySelectorAll('.frame-block').length,
    };
  }, [selRhs, delSrc, delList, selSelRhs, preSelectIds]);
}

test('음성대조 ★고치기 «전» 목록이면 ⌘A 가 도형을 안 고르고 Delete 뒤에도 도형이 남는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await selectAllThenDelete(page, SEL_OLD, DEL_SRC, DEL_LIST, SEL_SELECTED_RHS, []);
  expect(r.picked, '옛 목록인데 도형이 골라졌다 — 이 대조가 버그를 재현 못 한다').not.toContain('shp1');
  expect(r.shapes, '★이 대조가 빨강(도형 잔존)을 못 만든다 ⇒ 아래 본검사가 아무것도 증명 못 한다').toBe(1);
  expect(r.chats, '옛 목록은 챗블럭도 안 골랐다 — 같이 남아야 한다').toBe(1);
  expect(r.texts, '텍스트는 옛 목록에도 있었으니 지워져야 한다').toBe(0);
  expect(errs).toEqual([]);
});

test('본검사 ★지금 목록(SECTION_BLOCK_TYPE_SEL)이면 ⌘A→Delete 가 도형까지 «다» 지운다', async ({ page }) => {
  const errs = await boot(page);
  const r = await selectAllThenDelete(page, SEL_NOW_RHS, DEL_SRC, DEL_LIST, SEL_SELECTED_RHS, []);
  expect(r.picked, '⌘A 가 도형을 안 골랐다 — T-085 재발').toContain('shp1');
  expect(r.consumed).toBe(true);
  expect(r.toasts, '토스트가 떴다(보호섹션 등 엉뚱한 갈래로 샜다)').toEqual([]);
  expect(r.shapes, '★도형이 안 지워졌다 — T-085 재발').toBe(0);
  expect(r.texts, '텍스트가 안 지워졌다').toBe(0);
  expect(r.chats, '챗블럭이 안 지워졌다').toBe(0);
  expect(r.gaps, 'Gap 이 안 지워졌다').toBe(0);
  expect(r.left, '도형 래퍼 프레임(ss2)이 도형과 같이 안 없어졌다').not.toContain('ss2');
  /* ★남는 것 = ss1(텍스트프레임 «빈 그릇») 하나. 텍스트프레임은 .row 밖 직속이라
     block.closest('.row') 가 null → 텍스트 «블록»만 remove 되고 그릇이 남는다.
     ⚠️이건 이 커밋 전에도 같았다(고치기 전 목록으로 돌린 음성대조에서도 동일) — 이 유닛 밖. */
  /* ★2026-09-22 (T-099): 2 → 1. 바로 위 문단이 「ss1 이 빈 그릇으로 남는다 … 이 유닛 밖」이라고
     적어 둔 그 자리를 T-099 가 닫았다 — «이 삭제가 비운» 프레임은 이제 같이 걷힌다.
     ⇒ 남는 것은 ssFree «하나»뿐이다. 그리고 그게 이 줄의 핵심이다:
       ssFree 는 «처음부터 비어 있던» 그릇이라 후보에 없다 ⇒ 과삭제가 아니라는 증명이 아래 줄이다.
       (「빈 프레임을 전부 지운다」로 짰다면 ssFree 도 사라져 아래 줄이 빨개진다.) */
  expect(r.frames, '남은 프레임 수가 달라졌다(ssFree 하나가 기준 — ss1 은 T-099 로 같이 걷힌다)').toBe(1);
  expect(r.left, '⌘A 가 «안» 고른 Free 프레임까지 지워졌다 — 그건 과삭제다').toContain('ssFree');
  expect(errs).toEqual([]);
});

/* ── 2026-09-21 픽스 라운드 ① — 「프레임이 미리 골라진 채 ⌘A→Delete」 ──────────────────
 *  ★실앱 실측(포트 9527, 40%, fix/ul-selectdelete@4cf864c — 고치기 «전»)
 *      ⌘A 직후 sel=8 [section, gap, text, text, gap, gap, frame(Free), gap]
 *      Delete 직후 frame 3→2 · text 2→2(남음) · gap 4→4(남음)
 *    ⇒ 고른 여덟 중 «Free 프레임 하나»만 사라졌다. ⌘A 는 기존 선택을 풀지 않고 더하기만 하므로
 *      (editor.js e.key==='a'), 프레임이 이미 골라져 있으면 deleteSelectedFromCanvas 의
 *      프레임 단독삭제 갈래(selSS)가 «먼저 걸려 return» 했다.                                */
test('픽스① ★프레임이 미리 골라져 있어도 ⌘A→Delete 가 «다» 지운다 (프레임 한 줄만 지우고 끝나지 않는다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await selectAllThenDelete(page, SEL_NOW_RHS, DEL_SRC, DEL_LIST, SEL_SELECTED_RHS, ['ssFree']);
  expect(r.consumed).toBe(true);
  expect(r.shapes, '도형이 남았다 — 프레임 갈래가 가로챘다').toBe(0);
  expect(r.texts,  '텍스트가 남았다 — 프레임 갈래가 가로챘다').toBe(0);
  expect(r.chats,  '챗블럭이 남았다 — 프레임 갈래가 가로챘다').toBe(0);
  expect(r.gaps,   'Gap 이 남았다 — 프레임 갈래가 가로챘다').toBe(0);
  expect(r.left,   '미리 골라져 있던 Free 프레임이 안 지워졌다').not.toContain('ssFree');
  /* 본검사(1)에서 ssFree 가 더 빠진 수. ★2026-09-22 (T-099) 로 ss1 도 걷히면서 1 → 0 이 됐다.
     미리 골라져 있던 ssFree 가 «안» 지워지면 1 이 되어 원증상이 다시 잡힌다. */
  expect(r.frames, '★미리 골라져 있던 Free 프레임이 안 지워졌다(본검사는 1, 여기선 ssFree 가 빠져 0)').toBe(0);
  expect(r.toasts).toEqual([]);
  expect(errs).toEqual([]);
});

/* M3 회귀 — 「프레임을 «혼자» 골랐을 때」는 예전 그대로 그 프레임 줄만 지운다. */
test('픽스① 회귀 ★프레임만 «혼자» 골랐으면 그 프레임 줄만 지운다(M3 보존)', async ({ page }) => {
  const errs = await boot(page);
  const r = await page.evaluate(([delSrc, delList, selSelRhs, selRhs]) => {
    const SEL = new Function('return (' + selRhs + ')')();
    document.getElementById('ssFree').classList.add('selected');   // 프레임 «혼자»
    const toasts = [];
    window.showToast = (m) => toasts.push(m);
    window.CANVAS_SEL_BLOCKS = new Function('return (' + delList + ')')();
    window.canvasEl = document.getElementById('canvas');
    window.pushHistory = () => {};
    window.buildLayerPanel = () => {};
    window.ensureHistoryCheckpoint = () => {};
    window.isSectionProtected = () => false;
    window.addGhostSection = () => {};
    const actions = [];
    const SECTION_BLOCK_TYPE_SEL_SELECTED = new Function('SECTION_BLOCK_TYPE_SEL', 'return (' + selSelRhs + ')')(SEL);
    const scope = {
      /* ★하네스는 잘라 넣은 코드가 부르는 «최상위 선언 전부»를 실어야 한다(레포 규약).
         2026-09-22 T-099 로 deleteSelectedFromCanvas 가 SSOT «원본»(.selected 없는 판)도
         쓰기 시작했다 — 안 실으면 ReferenceError 로 «검사처럼 생긴 빨강»이 난다. */
      SECTION_BLOCK_TYPE_SEL: SEL,
      SECTION_BLOCK_TYPE_SEL_SELECTED,
      clearAssetImage: () => {},
      deselectAll: () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected')),
      multiSel: { cols: new Set(), blocks: new Set(), sections: new Set() },
      clearMultiSel: () => {},
      canvasEl: document.getElementById('canvas'),
      pushHistory: (a) => actions.push(a),
      ensureHistoryCheckpoint: () => {},
    };
    const names = Object.keys(scope);
    const fn = new Function(...names, `${delSrc}; return deleteSelectedFromCanvas;`)(...names.map(n => scope[n]));
    const consumed = fn();
    return {
      consumed, actions, toasts,
      left: [...document.querySelectorAll('#host [id]')].map(e => e.id),
      texts: document.querySelectorAll('.text-block').length,
      shapes: document.querySelectorAll('.shape-block').length,
      gaps: document.querySelectorAll('.gap-block').length,
    };
  }, [DEL_SRC, DEL_LIST, SEL_SELECTED_RHS, SEL_NOW_RHS]);
  expect(r.consumed).toBe(true);
  expect(r.left, '프레임 «혼자» 골랐는데 그 프레임이 안 지워졌다').not.toContain('ssFree');
  expect(r.texts,  '프레임 혼자 골랐는데 텍스트까지 지워졌다 — M3 회귀').toBe(1);
  expect(r.shapes, '프레임 혼자 골랐는데 도형까지 지워졌다 — M3 회귀').toBe(1);
  expect(r.gaps,   '프레임 혼자 골랐는데 Gap 까지 지워졌다 — M3 회귀').toBe(2);
  expect(r.actions, '프레임 단독삭제 갈래(서브섹션 삭제)를 안 탔다').toContain('서브섹션 삭제');
  expect(errs).toEqual([]);
});

/* ★음성대조(픽스①) — 가드 한 줄을 «빼면» 원증상이 그대로 돌아온다.
 *   이게 빨강을 못 만들면 위 픽스① 검사는 아무것도 증명하지 못한다(계측기가 자기를 증명한다). */
test('음성대조(픽스①) ★«바깥 선택» 가드를 빼면 프레임 한 줄만 지우고 끝난다 — 원증상 재현', async ({ page }) => {
  const errs = await boot(page);
  const DEL_SRC_NOGUARD = DEL_SRC.replace('if (!ssHasSelectedChild && !_selOutsideSS)', 'if (!ssHasSelectedChild)');
  expect(DEL_SRC_NOGUARD, '변이 주입 실패 — 가드 줄을 못 찾았다').not.toBe(DEL_SRC);
  const r = await selectAllThenDelete(page, SEL_NOW_RHS, DEL_SRC_NOGUARD, DEL_LIST, SEL_SELECTED_RHS, ['ssFree']);
  expect(r.left, '★가드를 뺐는데도 Free 프레임이 지워지지 않았다 — 이 대조가 원증상을 못 만든다').not.toContain('ssFree');
  expect(r.texts,  '★가드를 뺐으면 텍스트가 «남아야» 한다(프레임 갈래가 가로채고 return)').toBe(1);
  expect(r.shapes, '★가드를 뺐으면 도형이 «남아야» 한다').toBe(1);
  expect(r.gaps,   '★가드를 뺐으면 Gap 이 «남아야» 한다').toBe(2);
  expect(errs).toEqual([]);
});
