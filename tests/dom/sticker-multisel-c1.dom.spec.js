/* sticker-multisel-c1.dom.spec.js — 1013t2C1 (현빈 「스티커 패널들은 복수 선택이 안 되는 문제 — ⇧ 혹은 ⌘ 누른 채 선택하면 복수 선택」)
 * 앱 통째로 헤드리스(bootApp) · 진짜 마우스(clickAt — 누르기 직전 맞힌 요소를 단언) · ⛔waitForTimeout 0.
 *
 * ★명부(ROSTER)는 «정의»에서 읽는다 — ⛔수를 박지 않는다(로그에 N 을 찍는다).
 *   index.html #fp-pen-menu 의 «주석 밖» button.fp-menu-item onclick 을 뽑아 가른다:
 *     · addStickerBlock( 를 부른다 → 스티커 입구(shape 는 인자 shape:'…' · 없으면 sticker-block.js STICKER_DEFAULTS.shape)
 *     · count-sticker-tool.js 가 window 에 내놓는 toggle* 함수 → 카운트 입구(enter* → 실제 클릭 1번 → exit*)
 *     · 비스티커 분류표(NON_STICKER) → 따로
 *     · ★그 밖 = «분류 안 된 메뉴» → R0 빨강(새 입구가 생겼는데 명부가 조용히 안 느는 병을 막는다 · S6 개명 때도 여기서 운다)
 *   + 메뉴 밖 변형: sticker-block.js `_SHAPES` 중 메뉴 명부에 없는 shape(square·highlight 등)를 덧붙인다.
 * ★규약(다른 블럭과 같다 — js/editor.js): ⌘/Ctrl = toggleBlockSelect(넣고 빼기) · ⇧ = rangeSelectBlocks(앵커~대상 범위).
 * ★검사 수 = 칸 × 종류 수(K). 각 종류 칸은 test.step 이름에 종류를 적는다.
 * 양성대조 Z: 줌(이미 정본 두 함수를 탄다 · block-drag.js if (isZoom)) — 수리 전에도 초록이어야 한다.
 * 음성대조 지점(plan-1013t2-C1 §5 NC1~NC8) — 보고서 참조. */
const fs = require('fs');
const path = require('path');
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const REPO = path.resolve(__dirname, '..', '..');
const read = (...p) => fs.readFileSync(path.join(REPO, ...p), 'utf8');

/* ── 명부: 정의에서 읽기 ─────────────────────────────────────────── */
const NON_STICKER = { togglePenMode: 'annotation', addGradientBlock: 'gradient', addZoomBlock: 'zoom' };
function readRoster() {
  const html = read('index.html');
  const i = html.indexOf('id="fp-pen-menu"');
  if (i < 0) throw new Error('#fp-pen-menu 를 index.html 에서 못 찾음 — 명부를 못 읽었다');
  const body = html.slice(i, html.indexOf('</div>', i)).replace(/<!--[\s\S]*?-->/g, '');
  const items = [...body.matchAll(/<button class="fp-menu-item" onclick="([^"]*)"(?:\s+[\w-]+="[^"]*")*\s*>([^<]*)<\/button>/g)]
    .map(m => ({ onclick: m[1], label: m[2].trim() }));
  const cst = read('js', 'count-sticker-tool.js');
  const cnt = {
    toggle: (cst.match(/window\.(toggle\w+)\s*=/) || [])[1],
    enter:  (cst.match(/window\.(enter\w+)\s*=/) || [])[1],
    exit:   (cst.match(/window\.(exit\w+)\s*=/) || [])[1],
  };
  const stk = read('js', 'blocks', 'sticker-block.js');
  const defShape = (stk.match(/const STICKER_DEFAULTS = \{\s*shape:\s*'(\w+)'/) || [])[1];
  const shapesM = stk.match(/const _SHAPES = (\[[^\]]*\])/);
  const allShapes = shapesM ? JSON.parse(shapesM[1].replace(/'/g, '"')) : [];
  const roster = [], nonSticker = [], unclassified = [];
  for (const it of items) {
    const fn = (it.onclick.match(/^\s*(?:window\.)?(\w+)\(/) || [])[1];
    if (/addStickerBlock\(/.test(it.onclick)) {
      roster.push({ label: it.label, kind: 'sticker', shape: (it.onclick.match(/shape:\s*'(\w+)'/) || [])[1] || defShape });
    } else if (cnt.toggle && fn === cnt.toggle) {
      roster.push({ label: it.label, kind: 'count', shape: null });
    } else if (NON_STICKER[fn]) {
      nonSticker.push({ label: it.label, kind: NON_STICKER[fn] });
    } else {
      unclassified.push(`${it.label} (${fn})`);
    }
  }
  const menuShapes = new Set(roster.filter(r => r.kind === 'sticker').map(r => r.shape));
  for (const s of allShapes) if (!menuShapes.has(s)) roster.push({ label: `(메뉴 밖) ${s}`, kind: 'sticker', shape: s, offMenu: true });
  return { items, roster, nonSticker, unclassified, cnt, defShape, allShapes };
}
const R = readRoster();
const ROSTER = R.roster;
const K = ROSTER.length;
console.log(`[C1] 명부 N=${K} · 메뉴 ${R.items.length} · 비스티커 ${R.nonSticker.map(n => n.kind).join(',')} · 분류 안 됨 ${R.unclassified.length}`
  + ` · ${ROSTER.map(r => `${r.label}=${r.kind === 'count' ? 'count' : r.shape}`).join(' | ')}`);

/* ── 무대 ─────────────────────────────────────────────────────── */
/* ⚠️section-inner 의 좌우 패딩(32px 기본)을 무대에 «미리» 적는다 — 안 적으면 ⌘Z 복원이 그 기본값을 써 넣어
   expectOneUndoStep 의 «조작 전 = ⌘Z 뒤» 비교(S5·S7)가 정렬·삭제와 무관한 차이로 빨개진다(이벨류에이터 실측). */
const SEC = `
<div class="section-block" id="secA" data-section="1" style="height:1000px;background:#eee;">
  <div class="section-hitzone"><span class="section-label">A</span></div>
  <div class="section-inner" id="innerA" style="padding-left:32px;padding-right:32px;">
    <div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block" id="tbA" data-type="body"><div class="tb-body" contenteditable="false">글자 블럭</div></div></div>
    <div class="gap-block" id="gapA" data-type="gap" style="height:900px;"></div>
  </div>
</div>
<div class="section-block" id="secB" data-section="2" style="height:700px;background:#ddd;">
  <div class="section-hitzone"><span class="section-label">B</span></div>
  <div class="section-inner" id="innerB" style="padding-left:32px;padding-right:32px;"><div class="gap-block" id="gapB" data-type="gap" style="height:680px;"></div></div>
  <div class="zoom-block" id="zmA" data-type="zoom" data-x="60" data-y="380" data-w="200" data-h="100"
       style="position:absolute;left:60px;top:380px;width:200px;height:100px;"></div>
  <div class="zoom-block" id="zmB" data-type="zoom" data-x="420" data-y="380" data-w="200" data-h="100"
       style="position:absolute;left:420px;top:380px;width:200px;height:100px;"></div>
</div>`;
const ICON_SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="#333"/></svg>';
const slot = (i) => ({ x: 40 + (i % 4) * 200, y: 120 + Math.floor(i / 4) * 220 });

const selIds = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .selected')]
  .filter(e => !e.classList.contains('section-block') && !e.classList.contains('section-merged-part')).map(e => e.id).sort());
const panelName = (page) => page.evaluate(() => document.querySelector('#panel-right .prop-block-name')?.textContent?.trim() || '');
const panelCrumb = (page) => page.evaluate(() => document.querySelector('#panel-right .prop-breadcrumb')?.textContent?.trim() || '');
const handleN = (page, id) => page.evaluate((id) => document.getElementById(id)
  .querySelectorAll(':scope > .sticker-corner-handle, :scope > .sticker-rotate-zone, :scope > .hlb-handle').length, id);
/* 그라데이션 손잡이는 선택되면 #ss-handles-overlay 로 «탈출»한다(js/overlay-handles.js HANDLE_ESCAPE_SPECS) —
   블럭 자식만 세면 늘 0 이다. 자식 + 탈출한 것 중 주인이 그 블럭인 것(window.__handleEscape.owners — 계측 진입점)을 센다. */
const gradHandleN = (page, id) => page.evaluate((id) => {
  const own = document.getElementById(id).querySelectorAll(':scope > .gradient-corner-handle').length;
  const esc = (window.__handleEscape?.owners?.() || []).filter(o => o === id).length;
  return own + esc;
}, id);
const stickerN = (page, sec = 'secA') => page.evaluate((s) => document.querySelectorAll(`#${s} > .sticker-block`).length, sec);

async function center(page, id, inner) {
  return page.evaluate(([id, inner]) => {
    const b = document.getElementById(id);
    b.scrollIntoView({ block: 'center' });
    const el = inner ? b.querySelector(inner) : b;
    const r = el.getBoundingClientRect();
    return [r.left + r.width / 2, r.top + r.height / 2];
  }, [id, inner || null]);
}
/** 실제 마우스 클릭 — mod: 'Meta' | 'Shift' | null. 누르는 점이 그 블럭 위인지 clickAt 이 먼저 단언한다(전제). */
async function clickBlock(page, id, mod, { inner, dbl } = {}) {
  const [x, y] = await center(page, id, inner);
  if (mod) await page.keyboard.down(mod);
  try { await clickAt(page, x, y, { sel: `[id="${id}"]` }, { label: `${mod || 'plain'}→${id}`, dbl }); }
  finally { if (mod) await page.keyboard.up(mod); }
}
/* 패널은 정본 두 함수가 setTimeout 으로 고른다 — «재는 그 값»을 기다린다 */
const pollSel = (page, want, msg) => expect.poll(() => selIds(page), { message: msg }).toEqual([...want].sort());

async function makeOne(page, r, i) {
  const { x, y } = slot(i);
  if (r.kind === 'count') {
    const t0 = await page.evaluate((enter) => {
      window.deselectAll?.(); window.selectSection?.(document.getElementById('secA'));
      window[enter](); return performance.now();
    }, R.cnt.enter);
    // 도구는 진입 50ms 안의 클릭을 먹는다(count-sticker-tool.js _cntOnClickCapture) — 그 창이 지났는지를 잰다
    await page.waitForFunction((t0) => performance.now() - t0 > 60, t0);
    const before = await page.evaluate(() => [...document.querySelectorAll('#secA > .sticker-block')].map(b => b.id));
    const [px, py] = await page.evaluate(([x, y]) => {
      const s = document.getElementById('secA'); s.scrollIntoView({ block: 'start' });
      const rc = s.getBoundingClientRect(); const k = rc.width / s.offsetWidth;
      return [rc.left + (x + 30) * k, rc.top + (y + 30) * k];
    }, [x, y]);
    await clickAt(page, px, py, { sel: '[id="secA"]' }, { label: 'count 찍기' });
    const id = await page.evaluate(([before, exit]) => {
      window[exit]();
      const n = [...document.querySelectorAll('#secA > .sticker-block')].filter(b => !before.includes(b.id));
      return n.length === 1 ? n[0].id : `ERR:${n.length}`;
    }, [before, R.cnt.exit]);
    return id;
  }
  const id = await page.evaluate(([shape, x, y, svg]) => {
    window.deselectAll?.(); window.selectSection?.(document.getElementById('secA'));
    const before = new Set([...document.querySelectorAll('#secA > .sticker-block')]);
    const opts = { shape, x, y };
    if (shape === 'icon') Object.assign(opts, { iconName: 'c1:dot', svg });   // 메뉴는 모달을 거친다 — 모달 대신 같은 인자로
    window.addStickerBlock(opts);
    const n = [...document.querySelectorAll('#secA > .sticker-block')].filter(b => !before.has(b));
    return n.length === 1 ? n[0].id : `ERR:${n.length}`;
  }, [r.shape, x, y, ICON_SVG]);
  if (r.shape === 'text' && !String(id).startsWith('ERR')) {
    // 텍스트 스티커는 생성 직후 rAF 로 인라인 편집에 들어간다(sticker-block.js A26) — 들어간 것을 보고 빠져나온다
    await page.waitForFunction((id) => document.getElementById(id)?.querySelector('.sticker-text')?.isContentEditable, id);
    await page.evaluate(() => document.activeElement?.blur?.());
    await page.waitForFunction((id) => !document.getElementById(id)?.querySelector('.sticker-text')?.isContentEditable, id);
  }
  return id;
}

/** 무대 + 명부의 모든 종류를 secA 에 하나씩. 돌려줌: [{...r, id}] */
async function setup(page, { stickers = true } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    document.getElementById('canvas').insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
  }, SEC);
  const made = [];
  if (stickers) {
    for (let i = 0; i < ROSTER.length; i++) {
      const r = ROSTER[i];
      const n0 = await stickerN(page);
      const id = await makeOne(page, r, i);
      expect(id, `전제: ${r.label} 입구로 스티커 하나가 생겼다`).not.toMatch(/^ERR/);
      expect(await stickerN(page), `전제: ${r.label} — .sticker-block 이 정확히 1개 늘었다`).toBe(n0 + 1);
      const ds = await page.evaluate((id) => ({ shape: document.getElementById(id).dataset.shape, count: document.getElementById(id).dataset.count || '' }), id);
      if (r.kind === 'count') expect(ds.count, `전제: ${r.label} — data-count 가 붙었다`).not.toBe('');
      else expect(ds.shape, `전제: ${r.label} — data-shape`).toBe(r.shape);
      made.push({ ...r, id });
    }
    await page.evaluate(() => window.deselectAll?.());
    await pollSel(page, [], '전제: 무대가 다 서면 아무것도 안 골라져 있다');
  }
  return { errs, made };
}
const kindName = (m) => `${m.label}[${m.kind === 'count' ? 'count' : m.shape}]`;

/* ═══ R0 명부 ═══ */
test('R0 ★명부 — 스티커 패널 메뉴가 전부 분류된다(분류 안 된 입구 0) · N≥1', async () => {
  expect(R.items.length, '메뉴 버튼을 못 읽었다').toBeGreaterThan(0);
  expect(R.unclassified, `분류 안 된 메뉴(새 입구? 개명?) — 명부 파서를 갱신하라`).toEqual([]);
  expect(K, '스티커 명부가 비었다').toBeGreaterThanOrEqual(1);
  expect(R.defShape, 'STICKER_DEFAULTS.shape 를 못 읽었다').toBeTruthy();
  expect(R.cnt.toggle && R.cnt.enter && R.cnt.exit, 'count-sticker-tool.js 의 window 진입 함수 이름을 못 읽었다').toBeTruthy();
});

/* ═══ S1 ⌘넣기 ×K ═══ */
test('S1 ★⌘클릭으로 종류마다 하나씩 «더해진다» — 직전 것들 유지 (×K)', async ({ page }) => {
  const { errs, made } = await setup(page);
  await clickBlock(page, 'tbA', null);
  await pollSel(page, ['tbA'], '전제: 글자 블럭 하나');
  const want = ['tbA'];
  for (const m of made) {
    await test.step(`S1 ${kindName(m)}`, async () => {
      await clickBlock(page, m.id, 'Meta');
      want.push(m.id);
      await pollSel(page, want, `${kindName(m)} ⌘클릭 뒤 ${want.length}개`);
    });
  }
  expect(errs).toEqual([]);
});

/* ═══ S2 ⌘빼기 ×K ═══ */
test('S2 ★⌘클릭을 한 번 더 — 그 스티커만 빠지고 손잡이(모서리·회전·끝점) 0 (×K)', async ({ page }) => {
  const { errs, made } = await setup(page);
  for (let i = 0; i < made.length; i++) {
    const m = made[i], nb = made[(i + 1) % made.length];
    await test.step(`S2 ${kindName(m)}`, async () => {
      await clickBlock(page, m.id, null);                       // 보통 클릭 = 손잡이가 붙는다
      await pollSel(page, [m.id], '전제: 하나');
      expect(await handleN(page, m.id), `전제: ${kindName(m)} 에 손잡이가 붙었다`).toBeGreaterThan(0);
      const others = nb.id === m.id ? ['tbA'] : [nb.id, 'tbA'];
      for (const o of others) await clickBlock(page, o, 'Meta');
      await pollSel(page, [m.id, ...others], '전제: 여럿');
      await clickBlock(page, m.id, 'Meta');                     // 빼기
      await pollSel(page, others, `${kindName(m)} 만 빠진다`);
      expect(await handleN(page, m.id), `${kindName(m)} — 빠진 스티커에 손잡이가 남았다`).toBe(0);
    });
  }
  expect(errs).toEqual([]);
});

/* ═══ S3 ⇧범위 ×K ═══ */
test('S3 ★이웃 스티커를 보통 클릭(앵커) → 대상 ⇧클릭 = 둘 다 (×K)', async ({ page }) => {
  const { errs, made } = await setup(page);
  test.skip(made.length < 2, '앵커·대상 둘이 필요하다');
  for (let i = 0; i < made.length; i++) {
    const m = made[i], anchor = made[i === 0 ? 1 : i - 1];          // DOM 순서상 바로 이웃 — 사이에 낀 형제 0
    await test.step(`S3 ${kindName(m)}`, async () => {
      await clickBlock(page, anchor.id, null);
      await pollSel(page, [anchor.id], '전제: 앵커 하나');
      await clickBlock(page, m.id, 'Shift');
      await pollSel(page, [anchor.id, m.id], `${kindName(m)} ⇧클릭 — 앵커~대상`);
    });
  }
  expect(errs).toEqual([]);
});

async function pickAll(page, made) {
  await clickBlock(page, made[0].id, null);
  for (const m of made.slice(1)) await clickBlock(page, m.id, 'Meta');
  await pollSel(page, made.map(m => m.id), `전제: K=${made.length} 개를 ⌘로 골랐다`);
}

/* ═══ S4 패널 — 스티커만 ═══ */
test('S4 ★같은 섹션 스티커 K개 → 「K개 선택됨 · 떠 있는 블럭 — 서로 맞춤」', async ({ page }) => {
  const { errs, made } = await setup(page);
  test.skip(made.length < 2, '둘 이상이어야 복수');
  await pickAll(page, made);
  await expect.poll(() => panelName(page)).toBe(`${made.length}개 선택됨`);
  await expect.poll(() => panelCrumb(page)).toContain('떠 있는 블럭');
  expect(errs).toEqual([]);
});

/* ═══ S5 정렬 ×K (highlightB 포함) ═══ */
test('S5 ★「서로 맞춤」 왼쪽 정렬 — 고른 스티커 왼쪽(레이아웃 px) 같음 · 선 형광펜은 양 끝이 같은 양 · ⌘Z 한 칸', async ({ page }) => {
  const { errs, made } = await setup(page);
  test.skip(made.length < 2, '둘 이상이어야 복수');
  await pickAll(page, made);
  await expect.poll(() => panelCrumb(page)).toContain('서로 맞춤');
  const before = await page.evaluate((ids) => ids.map(id => { const b = document.getElementById(id); return { id, shape: b.dataset.shape, left: b.offsetLeft, x1: +b.dataset.x1, x2: +b.dataset.x2 }; }), made.map(m => m.id));
  const minLeft = Math.min(...before.map(b => b.left));
  let after = null;
  await expectOneUndoStep(page, async () => {
    const [x, y] = await page.evaluate(() => { const r = document.querySelector('#panel-right [data-ov-align="left"]').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
    await clickAt(page, x, y, { sel: '[data-ov-align="left"]' }, { label: '왼쪽 정렬' });
    await expect.poll(() => page.evaluate((ids) => new Set(ids.map(id => document.getElementById(id).offsetLeft)).size, made.map(m => m.id))).toBe(1);
    after = await page.evaluate((ids) => ids.map(id => { const b = document.getElementById(id); return { id, shape: b.dataset.shape, left: b.offsetLeft, x1: +b.dataset.x1, x2: +b.dataset.x2 }; }), made.map(m => m.id));
  }, '스티커 서로 맞춤 왼쪽');
  for (const a of after) {
    await test.step(`S5 ${a.shape}`, async () => {
      expect(Math.abs(a.left - minLeft), `${a.id}(${a.shape}) 왼쪽 = 가장 왼쪽(${minLeft})`).toBeLessThanOrEqual(1);
      if (['highlightB', 'arrow'].includes(a.shape)) {   // ★1013t2C4 선 스티커 둘 — 위치 = 두 끝점
        const b = before.find(v => v.id === a.id);
        expect(a.x2 - a.x1, '선 형광펜 길이(x2−x1) 불변').toBe(b.x2 - b.x1);
        expect(Math.abs((a.x1 - b.x1) - (a.left - b.left)), '양 끝이 상자와 같은 양만큼 옮겨졌다').toBeLessThanOrEqual(1);
      }
    });
  }
  expect(made.some(m => m.shape === 'highlightB'), '전제: 명부에 선 형광펜(highlightB)이 있다 — 없으면 이 칸의 갈래를 못 잰다').toBe(true);
  expect(errs).toEqual([]);
});

/* ═══ S6 패널 — 섞임 ═══ */
test('S6 ★글자 1 + 스티커 1 → 흐름 패널 「2개 선택됨」(스티커 패널·Page 아님)', async ({ page }) => {
  const { errs, made } = await setup(page);
  await clickBlock(page, 'tbA', null);
  await clickBlock(page, made[0].id, 'Meta');
  await pollSel(page, ['tbA', made[0].id], '전제: 둘');
  await expect.poll(() => panelName(page)).toBe('2개 선택됨');
  expect(await panelCrumb(page)).not.toContain('서로 맞춤');
  expect(errs).toEqual([]);
});

/* ═══ S7 삭제 ×K 한 번에 ═══ */
test('S7 ★K개 고르고 Delete 한 번 → 0 · ⌘Z 한 번 → K', async ({ page }) => {
  const { errs, made } = await setup(page);
  await pickAll(page, made);
  await expectOneUndoStep(page, async () => {
    await page.keyboard.press('Delete');
    await expect.poll(() => stickerN(page)).toBe(0);
  }, '스티커 여럿 삭제');
  await expect.poll(() => stickerN(page)).toBe(made.length);
  expect(errs).toEqual([]);
});

/* ═══ S8 보통 클릭 = 하나만 ═══ */
test('S8 ★여럿 고른 뒤 하나를 보통 클릭 → 그것 하나 · 그 스티커 패널', async ({ page }) => {
  const { errs, made } = await setup(page);
  test.skip(made.length < 2, '둘 이상이어야 복수');
  await pickAll(page, made);
  const t = made[made.length - 1];
  await clickBlock(page, t.id, null);
  await pollSel(page, [t.id], '보통 클릭 = 그것 하나만');
  await expect.poll(() => panelName(page)).not.toContain('개 선택됨');
  expect(errs).toEqual([]);
});

/* ═══ S9 ⌘드래그 무회귀 ═══ */
test('S9 ★골라진 여럿 중 하나를 ⌘+끌기 = 자유 이동(섹션 밖) · 선택 수 그대로 · 안 골라진 것을 ⌘끌면 골라진다', async ({ page }) => {
  const { errs, made } = await setup(page);
  const plain = made.filter(m => m.kind === 'sticker' && !['highlightB', 'arrow', 'text'].includes(m.shape));   // ★1013t2C4 화살표도 선 스티커(dataset.x 를 안 쓴다)
  test.skip(plain.length < 3, '끌 스티커 셋이 필요하다');
  const [a, b, c] = plain;
  await clickBlock(page, a.id, null);
  await clickBlock(page, b.id, 'Meta');
  await pollSel(page, [a.id, b.id], '전제: 둘');
  const drag = async (id) => {
    const [x, y] = await center(page, id);
    const secLeft = await page.evaluate(() => document.getElementById('secA').getBoundingClientRect().left);
    await page.keyboard.down('Meta');
    await page.mouse.move(x, y); await page.mouse.down();
    for (let s = 1; s <= 8; s++) await page.mouse.move(x - (x - secLeft + 80) * s / 8, y);
    await page.mouse.up();
    await page.keyboard.up('Meta');
  };
  await drag(b.id);
  await expect.poll(() => page.evaluate((id) => parseFloat(document.getElementById(id).dataset.x), b.id), { message: '⌘드래그 = 섹션 밖까지(자유 이동)' }).toBeLessThan(0);
  await pollSel(page, [a.id, b.id], '⌘드래그 끝 click 이 토글로 새지 않는다');
  await page.evaluate(() => window.deselectAll?.());
  await pollSel(page, [], '전제: 비움');
  await drag(c.id);
  await pollSel(page, [c.id], '안 골라진 스티커를 ⌘드래그 → 끝나면 골라짐(옛 동작)');
  expect(errs).toEqual([]);
});

/* ═══ S10 레이어 패널 ⌘클릭 ═══ */
test('S10 ★레이어 패널에서 스티커 두 줄 ⌘클릭 → 둘 다 · 「서로 맞춤」 패널', async ({ page }) => {
  const { errs, made } = await setup(page);
  test.skip(made.length < 2, '둘 이상이어야 복수');
  const [a, b] = made;
  await page.evaluate(() => window.buildLayerPanel?.());
  await page.waitForFunction((ids) => ids.every(id => document.getElementById(id)?._layerItem?.isConnected), [a.id, b.id]);
  // ⚠️레이어 줄은 접힌 트리 안일 수 있어 «합성 click(metaKey)» 으로 누른다 — 처리기(layer-panel-items.js)는 같은 것을 탄다
  await page.evaluate((ids) => {
    window.deselectAll?.();
    ids.forEach(id => document.getElementById(id)._layerItem.dispatchEvent(new MouseEvent('click', { bubbles: true, metaKey: true })));
  }, [a.id, b.id]);
  await pollSel(page, [a.id, b.id], '레이어 ⌘클릭 둘');
  await expect.poll(() => panelCrumb(page)).toContain('서로 맞춤');
  expect(errs).toEqual([]);
});

/* ═══ S11 Esc ═══ */
test('S11 ★섞인 선택(글자+스티커) → Esc → 골라진 것 0', async ({ page }) => {
  const { errs, made } = await setup(page);
  await clickBlock(page, 'tbA', null);
  await clickBlock(page, made[0].id, 'Meta');
  await pollSel(page, ['tbA', made[0].id], '전제: 둘');
  await page.keyboard.press('Escape');
  await pollSel(page, [], 'Esc 뒤 0');
  expect(errs).toEqual([]);
});

/* ═══ S12 텍스트 편집 중 ⌘클릭 ═══ */
test('S12 ★텍스트 스티커 편집 중 ⌘클릭은 선택을 안 바꾼다', async ({ page }) => {
  const { errs, made } = await setup(page);
  const t = made.find(m => m.shape === 'text');
  test.skip(!t, '명부에 텍스트 스티커가 없다');
  await clickBlock(page, t.id, null);
  await pollSel(page, [t.id], '전제: 하나');
  await clickBlock(page, t.id, null, { inner: '.sticker-text', dbl: true });
  await page.waitForFunction((id) => document.getElementById(id).querySelector('.sticker-text')?.isContentEditable, t.id);
  await clickBlock(page, t.id, 'Meta', { inner: '.sticker-text' });
  await pollSel(page, [t.id], '편집 중 ⌘클릭 — 그대로');
  expect(errs).toEqual([]);
});

/* ═══ S13 Gradient ⌘/⇧ (C1-g) ═══ */
test('S13 ★그라데이션 — ⌘넣기 · ⌘빼기(손잡이 0) · ⇧범위', async ({ page }) => {
  const { errs } = await setup(page, { stickers: false });
  const [g1, g2] = await page.evaluate(() => {
    window.deselectAll?.(); window.selectSection?.(document.getElementById('secB'));
    const a = window.addGradientBlock({ x: 40, y: 40, width: 200, height: 100 });
    window.selectSection?.(document.getElementById('secB'));
    const b = window.addGradientBlock({ x: 40, y: 200, width: 200, height: 100 });
    window.deselectAll?.();
    return [a?.id, b?.id];
  });
  expect(g1 && g2, '전제: 그라데이션 둘이 생겼다').toBeTruthy();
  await test.step('S13 ⌘넣기', async () => {
    await clickBlock(page, g1, null);
    await clickBlock(page, g2, 'Meta');
    await pollSel(page, [g1, g2], '⌘ 로 둘');
  });
  await test.step('S13 ⌘빼기', async () => {
    await expect.poll(() => gradHandleN(page, g1), { message: '전제: 보통 클릭한 g1 에 손잡이' }).toBeGreaterThan(0);
    await clickBlock(page, g1, 'Meta');
    await pollSel(page, [g2], 'g1 만 빠진다');
    await expect.poll(() => gradHandleN(page, g1), { message: '빠진 그라데이션에 손잡이가 남았다' }).toBe(0);
  });
  await test.step('S13 ⇧범위', async () => {
    await clickBlock(page, g1, null);
    await pollSel(page, [g1], '전제: 앵커');
    await clickBlock(page, g2, 'Shift');
    await pollSel(page, [g1, g2], '⇧ 로 둘');
  });
  expect(errs).toEqual([]);
});

/* ═══ Z 양성대조 — 줌(정본 두 함수를 이미 탄다) ═══ */
test('Z 양성대조 — 줌 ⌘넣기 · ⇧범위 (수리 전에도 초록이어야 한다)', async ({ page }) => {
  const { errs } = await setup(page, { stickers: false });
  await clickBlock(page, 'zmA', null);
  await clickBlock(page, 'zmB', 'Meta');
  await pollSel(page, ['zmA', 'zmB'], '줌 ⌘');
  await clickBlock(page, 'zmA', null);
  await pollSel(page, ['zmA'], '전제: 앵커');
  await clickBlock(page, 'zmB', 'Shift');
  await pollSel(page, ['zmA', 'zmB'], '줌 ⇧');
  expect(errs).toEqual([]);
});
