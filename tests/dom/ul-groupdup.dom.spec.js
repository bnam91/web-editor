/* ul-groupdup.dom.spec.js — 0920b 유저렌즈 유닛 «groupdup»
 *
 * 증상(페르소나 실측): 텍스트를 ⌘D 로 복제한 뒤 원본+복제본을 ⌘G 로 묶으면
 *   «복제본이 말없이 사라진다». 토스트 0건, ⌘Z 로만 되살아난다 = 조용한 데이터 손실.
 *
 * 뿌리(js/block-factory.js wrapSelectedBlocksInFrame, flow 분기):
 *   ⑴ 단위 해석이 `b.closest('.row') || b` 로 폴백해 «선택된 블록 자신»이 «껍데기»가 될 수 있었고
 *   ⑵ 알맹이는 손으로 적은 명부(BLOCK_SEL 27종)의 «자손 검색»으로만 퍼냈고
 *      (querySelectorAll 은 자기 자신을 안 담는다 ⇒ 단위=블록이면 빈 배열)
 *   ⑶ 껍데기를 «무조건» row.remove() 했다.
 *   ⇒ 복제본이 그대로 삭제. 같은 뿌리로 명부에 없는 modal·sticker·gradient·speech-bubble 도 삭제됐다.
 *
 * 고침: 「껍데기만 지운다」 불변식을 한 자리로.
 *   shape-frame.js 에 성질 판정 isBlockEl / topLevelBlocksOf / isEmptyShell 을 두고
 *   (drag-utils.js isFlowAnchorBlock 의 「★왜 명부를 버렸나」와 같은 규약),
 *   flow 분기는 «껍데기가 실제로 있을 때만» 퍼내고 «빈 껍데기만» 지운다.
 *
 * 하네스: tests/dom/shape-frame-wrap-group.dom.spec.js 와 같은 형 — 앱을 안 띄우고
 *   원본 wrapSelectedBlocksInFrame 을 _slice-block 으로 잘라 shape-frame.js 원본과 함께 돌린다.
 * 실행: npm run test:dom -- ul-groupdup
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { sliceBlock } = require('../unit/_slice-block.js');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
/* ★음성대조/양성대조 손잡이 — 기본은 «이 레포의 js/». 고치기 «전» 사본을 가리키면 이 파일 전체가
 *   빨강이 되어야 한다(계측기가 실제로 증상을 잡는다는 증거):
 *     UL_GROUPDUP_JS=<0920b 이전 js 디렉터리> npm run test:dom -- ul-groupdup
 *   ⚠️CI/기본 실행에선 절대 설정하지 말 것. 설정되면 아래 배너가 찍힌다. */
const JS_DIR = process.env.UL_GROUPDUP_JS || path.join(REPO, 'js');
if (process.env.UL_GROUPDUP_JS) console.warn(`[ul-groupdup] ★양성대조 모드 — js 원본을 ${JS_DIR} 에서 읽는다`);
const SHAPE_FRAME_JS = fs.readFileSync(path.join(JS_DIR, 'shape-frame.js'), 'utf8');
const BF = fs.readFileSync(path.join(JS_DIR, 'block-factory.js'), 'utf8');
const WRAP_SRC = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const NEXT_GROUP_SRC = sliceBlock(BF, 'function _nextGroupName(');

// 고치기 «전» 소스에는 새 술어가 없다 — 양성대조 때 import 가 깨지지 않게 실제 쓰임으로 고른다.
const NEEDS_PREDICATES = /topLevelBlocksOf|isEmptyShell/.test(WRAP_SRC);
const HARNESS_JS = `
import { isShapeFrame, shapeFrameOf${NEEDS_PREDICATES ? ', topLevelBlocksOf, isEmptyShell' : ''} } from '/js/shape-frame.js';
let __n = 0;
function makeFrameBlock() {
  const ss = document.createElement('div');
  ss.className = 'frame-block';
  ss.id = 'ss_new' + (++__n);
  ss.dataset.freeLayout = 'true';
  ss.dataset.width = '860';
  ss.dataset.height = '520';
  ss.style.cssText = 'width:860px;height:520px;min-height:520px;';
  return ss;
}
window.pushHistory = () => {};
window.buildLayerPanel = () => {};
window.deselectAll = () => document.querySelectorAll('.selected').forEach(e => e.classList.remove('selected'));
window.__toasts = [];
window.showToast = (m) => window.__toasts.push(m);
${NEXT_GROUP_SRC}
${WRAP_SRC}
window.__wrap = wrapSelectedBlocksInFrame;
window.__ready = true;
`;

async function boot(page, bodyHtml) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        body: `<!doctype html><html><head><meta charset="utf-8">
          <style>
            .section-block{position:relative;width:800px;}
            .section-inner{display:flex;flex-direction:column;}
            .frame-block[data-free-layout="true"]{position:relative;}
            .shape-block{width:100%;height:100%;}
            .text-block{height:40px;}
            .zoom-block{width:100px;height:100px;}
            .modal-block,.sticker-block,.gradient-block,.speech-bubble-block{height:60px;}
            .row{display:flex;}
            .col{display:flex;flex-direction:column;flex:1;}
          </style>
          <script type="module" src="/__harness.js"></script>
          </head><body>${bodyHtml}</body></html>`,
      });
    }
    if (url.pathname === '/__harness.js') return route.fulfill({ contentType: 'application/javascript', body: HARNESS_JS });
    if (url.pathname === '/js/shape-frame.js') return route.fulfill({ contentType: 'application/javascript', body: SHAPE_FRAME_JS });
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* ★G4 의 그물 — «명부에 기대지 않는» 생존 판정.
 *  연산 전후로 「클래스가 -block 으로 끝나는 id 요소」 집합을 비교한다.
 *  알맹이를 퍼낸 뒤 «빈» 텍스트프레임 래퍼가 사라지는 것은 ⌘G 의 설계(N1 이 그 순서를 못박는다)라
 *  그것만 대상에서 뺀다. 그 밖에 하나라도 줄면 실패 — 새 블록 타입이 생겨도 자동으로 지켜진다. */
const NET = `(() => {
  const ids = () => [...document.querySelectorAll('[id]')]
    .filter(e => [...e.classList].some(c => c.endsWith('-block')) && !e.id.startsWith('ss_new'))
    .map(e => e.id);
  const wrappers = [...document.querySelectorAll('.frame-block[data-text-frame]')].map(e => e.id);
  return { ids, wrappers };
})()`;

async function wrapWithNet(page, opts) {
  return page.evaluate(([netSrc, o]) => {
    const net = new Function('return ' + netSrc)();
    const before = net.ids();
    window.__wrap(o);
    const after = net.ids();
    return {
      before, after,
      lost: before.filter((i) => !after.includes(i)),
      lostKernel: before.filter((i) => !after.includes(i) && !net.wrappers.includes(i)),
      toasts: window.__toasts.slice(),
    };
  }, [NET, opts || {}]);
}

/* ── G1 ★본증상 — 원본 텍스트프레임 + «맨몸» 복제 text-block ──────────────
 * 섹션 레벨 텍스트는 .frame-block[data-text-frame] > .text-block 으로 태어나는데,
 * ⌘D 는 copySelected 가 그 래퍼를 잃어 «맨몸 text-block» 을 .section-inner 직속에 붙인다.
 * 그 복제본이 tf 도 row 도 없어 «단위 = 자기 자신»이 됐고, 그대로 삭제됐다. */
test('G1 ★원본 tf + 맨몸 복제 text-block → ⌘G: 텍스트 2개가 모두 새 그룹 안에 «살아서» 들어간다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block selected" id="tb_1">원본</div></div>
  <div class="text-block selected" id="tb_2">복제본</div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const a = document.getElementById('tb_1'), b = document.getElementById('tb_2');
    return {
      count: document.querySelectorAll('.text-block').length,
      pa: a && a.parentElement.id, pb: b && b.parentElement.id,
      topA: a && a.style.top, topB: b && b.style.top,
      posB: b && b.style.position,
      group: a && a.parentElement.dataset.group,
      innerKids: [...document.getElementById('inner').children].map((c) => c.id),
    };
  });
  expect(net.lostKernel, '복제본이 사라지면 안 된다(데이터 손실)').toEqual([]);
  expect(out.count, '.text-block 2개 유지').toBe(2);
  expect(out.pa).toMatch(/^ss_new/);
  expect(out.pb, '둘 다 «같은» 새 그룹 직속').toBe(out.pa);
  expect(out.group).toBe('true');
  expect(out.posB).toBe('absolute');
  expect(out.topA).not.toBe(out.topB);          // 겹쳐 쌓이지 않는다
  expect(out.innerKids, '빈 텍스트프레임 래퍼는 남기지 않는다').toEqual([out.pa]);
  expect(errs).toEqual([]);
});

/* ── G2 섹션 직속 떠 있는(absolute) zoom-block — 단위가 자기 자신인 또 한 갈래 ── */
test('G2 섹션 직속 absolute .zoom-block + 텍스트 → ⌘G: zoom 이 살아남는다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block selected" id="tb_1">글</div></div>
  <div class="zoom-block selected" id="zm_1" style="position:absolute;left:40px;top:40px;"><svg></svg></div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const z = document.getElementById('zm_1');
    return { alive: !!z, parent: z && z.parentElement.id };
  });
  expect(net.lostKernel).toEqual([]);
  expect(out.alive, '확대블럭이 말없이 지워지면 안 된다').toBe(true);
  expect(out.parent).toMatch(/^ss_new/);
  expect(errs).toEqual([]);
});

/* ── G3 «명부에 없던» 타입 — row 안의 미선택 modal-block ──────────────────
 * 옛 코드의 BLOCK_SEL 27종에 .modal-block 이 없었다 ⇒ 퍼내지 못한 채 row 와 같이 삭제.
 * 고친 뒤에는 성질 판정이 잡아 «그룹 안»으로 같이 들어간다(row 통째로 묶는다는 원래 뜻). */
test('G3 row 안 [선택 텍스트 + 미선택 modal] → ⌘G: modal 이 살아남는다(토스트 없이 조용히 지우지 않는다)', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="row" id="row_1"><div class="text-block selected" id="tb_1">글</div><div class="modal-block" id="md_1">모달</div></div>
  <div class="frame-block" id="tf_2" data-text-frame="true"><div class="text-block selected" id="tb_2">둘</div></div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const m = document.getElementById('md_1');
    return { alive: !!m, parent: m && m.parentElement.id, rowGone: !document.getElementById('row_1') };
  });
  expect(net.lostKernel, 'modal 이 사라지면 안 된다').toEqual([]);
  expect(out.alive).toBe(true);
  expect(out.parent).toMatch(/^ss_new/);
  expect(out.rowGone, '알맹이를 다 퍼낸 빈 row 는 정리된다').toBe(true);
  expect(errs).toEqual([]);
});

/* ── G4 ★명부에 안 기대는 그물 — 명부에 «전혀 없는» 세 타입을 한꺼번에 ──── */
test('G4 ★생존 그물 — sticker·gradient·speech-bubble 이 함께 든 row 를 묶어도 한 개도 안 준다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="row" id="row_1">
    <div class="text-block selected" id="tb_1">글</div>
    <div class="speech-bubble-block" id="sb_1">말풍선</div>
    <div class="sticker-block" id="st_1">스티커</div>
    <div class="gradient-block" id="gd_1">그라데</div>
  </div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  expect(net.lostKernel, `사라진 것: ${JSON.stringify(net.lost)}`).toEqual([]);
  expect(net.after.length).toBe(net.before.length);   // 이번 픽스처엔 빈 래퍼가 없다
  expect(errs).toEqual([]);
});

/* ── G4b .col 두 겹 아래의 블록도 그물에 걸린다(최상위 수확이 «한 겹»에서 멈추지 않는다) ── */
test('G4b .col 안의 블록도 살아서 옮겨진다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="row" id="row_1">
    <div class="col" id="c1"><div class="text-block selected" id="tb_1">왼쪽</div></div>
    <div class="col" id="c2"><div class="asset-block" id="as_1">오른쪽</div></div>
  </div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const a = document.getElementById('as_1');
    return { parent: a && a.parentElement.id, rowGone: !document.getElementById('row_1') };
  });
  expect(net.lostKernel).toEqual([]);
  expect(out.parent).toMatch(/^ss_new/);
  expect(out.rowGone, '빈 .col 만 남은 row 는 지워도 된다').toBe(true);
  expect(errs).toEqual([]);
});

/* ── G5 중복 수확 — 단위가 «row» 일 때 그 안의 텍스트프레임을 헤집지 않는다 ────
 * 옛 코드는 BLOCK_SEL 에 .frame-block 이 있고 «자손 전수» 검색이라, row 안의 tf 와 그 «안»의
 * text-block 을 둘 다 명부에 담았다 ⇒ 문서순서대로 tf 를 옮긴 «직후» 자식 text-block 을
 * tf «밖»으로 다시 끌어내 «빈 텍스트프레임»이 남았다.
 * (선택 블록이 tf «안»에 있으면 단위가 tf 로 잡혀 이 경로를 안 탄다 — 그래서 픽스처의
 *  선택 블록은 row 직속 «맨몸» 블록이고, tf 는 옆에 미선택으로 둔다.) */
test('G5 단위가 row 일 때 안의 텍스트프레임은 래퍼째 옮겨진다(빈 프레임이 남지 않는다)', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="row" id="row_1">
    <div class="text-block selected" id="tb_bare">맨몸</div>
    <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block" id="tb_in">안쪽</div></div>
  </div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const tf = document.getElementById('tf_1'), tb = document.getElementById('tb_in');
    return {
      tfAlive: !!tf, tfParent: tf && tf.parentElement.id, tbParent: tb && tb.parentElement.id,
      emptyFrames: [...document.querySelectorAll('.frame-block[data-text-frame]')]
        .filter((f) => f.children.length === 0).map((f) => f.id),
      rowGone: !document.getElementById('row_1'),
    };
  });
  expect(net.lostKernel).toEqual([]);
  expect(out.tfAlive).toBe(true);
  expect(out.tfParent, '텍스트프레임은 새 그룹 직속으로 «통째로» 옮겨진다').toMatch(/^ss_new/);
  expect(out.tbParent, '안의 텍스트를 프레임 밖으로 도로 끌어내면 안 된다').toBe('tf_1');
  expect(out.emptyFrames, '빈 텍스트프레임이 남으면 안 된다').toEqual([]);
  expect(out.rowGone).toBe(true);
  expect(errs).toEqual([]);
});

/* ── G6 음성대조/회귀 — 도형 없는 텍스트 2개(정상 경로)는 예전 그대로 ────────
 * shape-frame-wrap-group 의 N1 과 같은 픽스처. 특례(isGapRow/isShapeRow)를 술어로 접었으니
 * «안 바뀌었다»를 여기서도 한 번 더 못박는다. */
test('G6 회귀 — 텍스트프레임 2개 ⌘⌥G 는 기존대로(둘 다 새 프레임 직속 absolute, 40px 간격)', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block selected" id="tb_1">A</div></div>
  <div class="frame-block" id="tf_2" data-text-frame="true"><div class="text-block selected" id="tb_2">B</div></div>
</div></div>`);
  const out = await page.evaluate(() => {
    window.__wrap();
    const a = document.getElementById('tb_1'), b = document.getElementById('tb_2');
    return { pa: a.parentElement.id, pb: b.parentElement.id, pos: a.style.position, topB: b.style.top,
             order: [...document.getElementById('inner').children].map((c) => c.id), toasts: window.__toasts.slice() };
  });
  expect(out.pa).toMatch(/^ss_new/);
  expect(out.pb).toBe(out.pa);
  expect(out.pos).toBe('absolute');
  expect(out.topB).toBe('40px');
  expect(out.order).toEqual([out.pa]);
  expect(out.toasts, '정상 경로에선 토스트가 뜨지 않는다').toEqual([]);
  expect(errs).toEqual([]);
});

/* ── G7 회귀 — gap-block 은 «빈 칸 자체»가 내용이라 지워지지 않고 옮겨진다 ── */
test('G7 회귀 — gap-block 은 단위째 옮겨지고 삭제되지 않는다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="gap-block selected" id="gb_1" style="height:20px"></div>
  <div class="frame-block" id="tf_1" data-text-frame="true"><div class="text-block selected" id="tb_1">글</div></div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const g = document.getElementById('gb_1');
    return { alive: !!g, parent: g && g.parentElement.id };
  });
  expect(net.lostKernel).toEqual([]);
  expect(out.alive).toBe(true);
  expect(out.parent).toMatch(/^ss_new/);
  expect(errs).toEqual([]);
});

/* ── G8 ★동작이 «바뀐» 자리 — 중첩 그룹 ─────────────────────────────────────
 * 고치기 «전»: 이미 만든 그룹 G1 을 다른 블록과 함께 ⌘G 하면, G1 도 「단위 = 자기 자신」이 돼
 *   `g1.querySelectorAll(BLOCK_SEL)` 로 자식만 퍼내고 `g1.remove()` 가 «그룹 자체»를 지웠다
 *   — 그룹 이름까지 조용히 사라지고 중첩이 원천적으로 불가능했다.
 * 고친 «뒤»: G1 은 알맹이(블록)이므로 래퍼째 새 그룹 안으로 들어간다 = 중첩 그룹이 된다.
 * ★이건 의도한 변화다 — 이 함수 머리주석이 이미 「frame-block 서브섹션·중첩그룹 포함」이라고
 *   적어 두었는데 구현이 그걸 못 지키고 있었다. 되돌리지 말 것. */
test('G8 ★이미 만든 그룹 + 텍스트 → ⌘G: 기존 그룹이 «지워지지 않고» 중첩된다', async ({ page }) => {
  const errs = await boot(page, `
<div class="section-block selected" id="sec"><div class="section-inner" id="inner">
  <div class="frame-block selected" id="g1" data-group="true" data-free-layout="true" data-name="Group 1" style="width:100%;height:80px;">
    <div class="text-block" id="ta" style="position:absolute;top:0px;left:0px;width:100%">A</div>
    <div class="text-block" id="tb" style="position:absolute;top:40px;left:0px;width:100%">B</div>
  </div>
  <div class="frame-block" id="tf_2" data-text-frame="true"><div class="text-block selected" id="tc">C</div></div>
</div></div>`);
  const net = await wrapWithNet(page, { asGroup: true });
  const out = await page.evaluate(() => {
    const g1 = document.getElementById('g1');
    return {
      g1Alive: !!g1,
      g1Name: g1 && g1.dataset.name,
      g1Kids: g1 && [...g1.children].map((k) => k.id),
      g1Parent: g1 && g1.parentElement.id,
      outerGroup: g1 && g1.parentElement.dataset.group,
      innerKids: [...document.getElementById('inner').children].map((c) => c.id),
    };
  });
  expect(net.lostKernel, '그룹이 통째로 사라지면 안 된다').toEqual([]);
  expect(out.g1Alive).toBe(true);
  expect(out.g1Name, '그룹 이름이 유지된다').toBe('Group 1');
  expect(out.g1Kids, '자식을 그룹 밖으로 헤집어 꺼내지 않는다').toEqual(['ta', 'tb']);
  expect(out.g1Parent).toMatch(/^ss_new/);
  expect(out.outerGroup).toBe('true');
  expect(out.innerKids).toEqual([out.g1Parent]);
  expect(errs).toEqual([]);
});
