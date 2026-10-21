/* scratch-layer-order.dom.spec.js — 스크래치패드 항목 ⌘[ / ⌘] 레이어 순서 (1020t2a2)
 * 현빈 원문: 「스크래치패드 간 커맨드 '[',']' 이것만으로도 레이어 순서 변경가능하도록 해줘.」
 *
 * ★무엇이 없었나(핀 b5148b48d64fa5615953b2fb670f4e22c1adc26a · 행위 ×3): 스크래치 항목은 #canvas-scaler 직계 · 표식
 *   `.scratch-selected` 라 ⌘[ / ⌘] 의 살아 있는 길(editor.js moveSelectedBlocks — `.selected` · 섹션/프레임 형제)이
 *   «해당 없음»이었다. C 를 고르고 ⌘[ · ⌘] · ⌘⇧[ · ⌘⇧] 를 눌러도 순서 ABC 그대로.
 * ★재는 축 — 화면이다: 셋이 겹친 점에서 elementFromPoint 가 «누구를 집나». 항목은 전부 z-index 100 이라
 *   «DOM 뒤 = 위»다(행위로 잼 — L0). 그리고 정본인 배열 순서(저장되는 것)와 IndexedDB 원자료 · 재열기.
 * ★장면은 앱의 제 문으로: 「참고 이미지 일괄 추가」 입력(#scratchpad-folder-input · 인라인 onchange) → 실마우스로 끌어 겹침
 *   → 실클릭으로 고름 → 실키. 캔버스 대조군은 툴바 「새 섹션 추가」 · 도형 드롭다운 Rectangle · 우측 패널 오버레이 토글 · ⌘G.
 *   ⚠️initScratchPad(pid,'p1') 만 «프로젝트 열기» 대역(하네스엔 실프로젝트가 없다 — scratch-folder-columns 와 같은 꼴).
 *
 * ★양성대조: 제품 파일 둘(js/editor.js · js/scratch-pad.js)을 핀 b5148b48 로 `git show` 한 판에서 돌리면 (로그는 work-1020t2a2/ 아래)
 *   빨강 = L1·L2 · L3 · L5 · L6 · L7 · L11 — 2026-10-21 01:19~01:21 ×3 (제너레이터 gen/spec-pin1~3.log)
 *                                           · 08:15~08:17 ×3 (평가자 eval/logs/pinctl-dom-1~3.log) · 09:38 ×1 (구멍 평가 hole-eval/logs/pin-dom.log)
 *   빨강 = L12 — 2026-10-21 09:38 ×1 (구멍 평가 hole-eval/logs/pin-dom.log · :455 본 단언) · 제너레이터 HOLE ×1 도 빨강
 *   빨강 = L13 — 2026-10-21 09:38 ×1 (구멍 평가 hole-eval/logs/pin-dom.log · :497 본 단언) · 제너레이터 HOLE ×1 도 빨강
 *   초록 = L0 · L4 · L8 · L9 · L9b · L9c · L10 (지키는 자 · 대조군) — 같은 런들.
 * ★판정(지디 a2 · 261021): ⇧ 는 캔버스처럼 무시(⌘⇧] = ⌘] 한 칸) · 히스토리 이름 = 캔버스 갈래 이름(앱에서 눌러 읽어 대조 — L11) ·
 *   섞인 선택이면 스크래치가 가져간다(⌘X·⌘G 선례 — 행위 ×3 확인) · 항목끼리.
 * ⛔이 하네스로 못 재는 것: Electron 재기동 뒤 IndexedDB · proj.json 매니페스트(다른 맥) 하이드레이션.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { mkTmpRoot } = require('../unit/_tmproot.js');

function png(w, h, rgb) {
  const chunk = (type, data) => {
    const body = Buffer.concat([Buffer.from(type, 'ascii'), data]);
    const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
    const crc = Buffer.alloc(4); crc.writeUInt32BE(zlib.crc32(body));
    return Buffer.concat([len, body, crc]);
  };
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 2;
  const px = Buffer.alloc(w * 3); for (let i = 0; i < w; i++) px.set(rgb, i * 3);
  const raw = Buffer.concat(Array.from({ length: h }, () => Buffer.concat([Buffer.from([0]), px])));
  return Buffer.concat([Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw)), chunk('IEND', Buffer.alloc(0))]);
}
let IMGDIR;
test.beforeAll(() => {
  IMGDIR = path.join(mkTmpRoot('gd-sp-layer-'), 'refs');
  fs.mkdirSync(IMGDIR, { recursive: true });
  [['a', [220, 40, 40]], ['b', [40, 40, 220]], ['c', [40, 180, 40]]].forEach(([n, c]) => fs.writeFileSync(path.join(IMGDIR, n + '.png'), png(100, 50, c)));
  // L13 용 — 두 번에 나눠 넣는다(A·B 먼저 · 그리드 ＋ 층이 붙은 «뒤»에 C)
  const base = path.dirname(IMGDIR);
  IMGDIR_AB = path.join(base, 'refs-ab'); IMGDIR_C = path.join(base, 'refs-c');
  fs.mkdirSync(IMGDIR_AB, { recursive: true }); fs.mkdirSync(IMGDIR_C, { recursive: true });
  [['a', [220, 40, 40]], ['b', [40, 40, 220]]].forEach(([n, c]) => fs.writeFileSync(path.join(IMGDIR_AB, n + '.png'), png(100, 50, c)));
  fs.writeFileSync(path.join(IMGDIR_C, 'c.png'), png(100, 50, [40, 180, 40]));
});
let IMGDIR_AB, IMGDIR_C;

/** 두 애니메이션 프레임 — 키·클릭 처리는 동기라 그 뒤 그려진 상태를 읽는다(⛔고정 ms 대기 금지 — dom-fixed-wait-census). */
const frames = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r()))));
const uid = (p) => p + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);

/** 상태 — 이름(A/B/C)은 «처음 들어온 순서»로 붙인다(page.__ids). P 가 있으면 그 점의 맨 위 항목. */
const state = (page, P) => page.evaluate((P) => {
  const ids = window.__ids || [];
  const nm = (id) => 'ABC'[ids.indexOf(id)] || '?';
  const items = [...document.querySelectorAll('.scratch-item')];
  const top = P ? document.elementFromPoint(P[0], P[1])?.closest?.('.scratch-item') : null;
  const t = window.getHistoryTip?.();
  return {
    dom: items.map(e => nm(e.dataset.scratchId)).join(''),
    arr: (window._getScratchItemsForMCP?.() || []).map(o => nm(o.id)).join(''),
    top: top ? nm(top.dataset.scratchId) : null,
    sel: items.filter(e => e.classList.contains('scratch-selected')).map(e => nm(e.dataset.scratchId)).join(''),
    pos: t ? t.pos : null,
    action: t ? t.action : null,
  };
}, P);

async function bootScratch(page, pid) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(async (pid) => { await window.initScratchPad?.(pid, 'p1'); }, pid);
  return errs;
}

/** 앱의 제 문으로 세 장을 넣고, 실마우스로 끌어 겹친다. 돌려주는 P = 셋이 다 덮는 점(화면 px). */
async function scratchScene(page, pid) {
  const errs = await bootScratch(page, pid);
  await page.setInputFiles('#scratchpad-folder-input', IMGDIR);
  await page.waitForFunction(() => document.querySelectorAll('.scratch-item').length === 3, null, { timeout: 15000 });
  await page.evaluate(() => { window.__ids = [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId); });
  await page.evaluate(() => document.querySelector('.scratch-item').scrollIntoView({ block: 'start', inline: 'center' }));
  await waitStableRect(page, '.scratch-item', { index: 2 });
  const r0 = await waitStableRect(page, '.scratch-item', { index: 0 });
  const z = r0.width / 860;   // 860 = 항목 폭(캔버스 px) — 화면 폭에서 배율을 읽는다
  // A y0~430 · B y530~960 · C y1060~1490 (캔버스 px) → B 를 300 위로(230~660) · C 를 700 위로(360~790) ⇒ 360~430 에서 셋이 겹친다
  const drag = async (i, dy) => {
    const r = await waitStableRect(page, '.scratch-item', { index: i });
    await page.mouse.move(r.cx, r.cy); await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(r.cx, r.cy - dy * z * k / 8);
    await page.mouse.up(); await frames(page);
  };
  await drag(1, 300);
  await drag(2, 700);
  await clickEmpty(page);
  const P = await overlapPoint(page);
  return { errs, P };
}
async function overlapPoint(page) {
  const rs = [];
  for (let i = 0; i < 3; i++) rs.push(await waitStableRect(page, '.scratch-item', { index: i }));
  const L = Math.max(...rs.map(r => r.left)), T = Math.max(...rs.map(r => r.top));
  const R = Math.min(...rs.map(r => r.left + r.width)), B = Math.min(...rs.map(r => r.top + r.height));
  expect(R > L && B > T, `셋이 겹치는 띠가 없다 ${JSON.stringify(rs)}`).toBe(true);
  return [Math.round((L + R) / 2), Math.round((T + B) / 2)];
}
async function clickEmpty(page) {
  // 스크래치·캔버스 밖 빈 바닥 — 스크래치 선택만 푼다(scratch-pad.js 바닥 클릭)
  const pt = await page.evaluate(() => {
    const wrap = document.getElementById('canvas-wrap').getBoundingClientRect();
    for (let y = wrap.bottom - 6; y > wrap.top; y -= 23) for (let x = wrap.right - 6; x > wrap.left; x -= 23) {
      const h = document.elementFromPoint(x, y);
      if (h && h.closest('#canvas-wrap') && !h.closest('.scratch-item') && !h.closest('.section-block') && !h.closest('#canvas .frame-block')) return [x, y];
    }
    return null;
  });
  expect(pt, '빈 바닥을 못 찾았다').not.toBeNull();
  await page.mouse.click(pt[0], pt[1]); await frames(page);
}
/** 이름(A/B/C)의 항목에서 «그 항목이 맨 위로 잡히는» 점을 찾아 실클릭한다(겹친 곳을 피한다). */
async function clickItem(page, name, { shift = false } = {}) {
  const pt = await page.evaluate((name) => {
    const id = window.__ids['ABC'.indexOf(name)];
    const el = document.querySelector(`.scratch-item[data-scratch-id="${id}"]`);
    const b = el.getBoundingClientRect();
    for (let y = b.top + 4; y < b.bottom - 2; y += 6) for (let x = b.left + b.width / 2; x < b.right - 2; x += 40) {
      if (document.elementFromPoint(x, y)?.closest('.scratch-item') === el) return [Math.round(x), Math.round(y)];
    }
    return null;
  }, name);
  expect(pt, `${name} 가 맨 위로 잡히는 점이 없다`).not.toBeNull();
  if (shift) await page.keyboard.down('Shift');
  await page.mouse.click(pt[0], pt[1]);
  if (shift) await page.keyboard.up('Shift');
  await frames(page);
}
const press = async (page, k) => { await page.keyboard.press(k); await frames(page); };
const idbOrder = (page, pid) => page.evaluate(({ pid }) => new Promise((res) => {
  const rq = indexedDB.open('ScratchPadDB');
  rq.onsuccess = (e) => {
    const g = e.target.result.transaction('scratch', 'readonly').objectStore('scratch').get('scratch-pad-' + pid + '-p1');
    g.onsuccess = () => res((g.result || []).map(o => 'ABC'[(window.__ids || []).indexOf(o.id)] || '?').join(''));
  };
}), { pid });

// ── 캔버스 장면(대조군): 새 섹션 + Rectangle ×2 (툴바 실클릭) ──
async function addTwoRects(page) {
  await page.click('button.fp-btn.primary[title="새 섹션 추가"]');
  await page.waitForFunction(() => !!document.querySelector('#canvas .section-block'));
  for (let i = 0; i < 2; i++) {
    await page.click('#fp-shape-dropdown > button.fp-dropdown-trigger');
    await page.locator('#fp-shape-dropdown button.fp-menu-item:has-text("Rectangle")').waitFor({ state: 'visible' });
    await page.click('#fp-shape-dropdown button.fp-menu-item:has-text("Rectangle")');
    await page.waitForFunction((n) => document.querySelectorAll('#canvas .shape-block').length === n, i + 1);
  }
  const ids = await page.evaluate(() => [...document.querySelectorAll('#canvas .shape-block')].map(s => s.id));
  expect(ids.length).toBe(2);
  return ids;
}
async function clickShape(page, id, { shift = false, dbl = false } = {}) {
  await page.evaluate((id) => document.getElementById(id).scrollIntoView({ block: 'center' }), id);
  const r = await waitStableRect(page, '#' + id);
  if (shift) await page.keyboard.down('Shift');
  if (dbl) await page.mouse.dblclick(r.cx, r.cy); else await page.mouse.click(r.cx, r.cy);
  if (shift) await page.keyboard.up('Shift');
  await frames(page);
}
const shapeOrder = (page) => page.evaluate(() => [...document.querySelectorAll('#canvas .shape-block')].map(s => s.id));
const tip = (page) => page.evaluate(() => { const t = window.getHistoryTip?.(); return { pos: t?.pos, action: t?.action }; });

/* ═════════════════ 스크래치 ═════════════════ */

test('L0 전제 — 셋 다 #canvas-scaler 직계 · z 100 · 겹친 점의 위 = DOM 맨 뒤(C) · 실클릭이 C 를 고른다 · `.selected` 안 씀', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L0'));
  const f = await page.evaluate(() => {
    const sc = document.getElementById('canvas-scaler');
    const it = [...document.querySelectorAll('.scratch-item')];
    return { direct: it.every(e => e.parentElement === sc), z: it.map(e => getComputedStyle(e).zIndex) };
  });
  expect(f).toEqual({ direct: true, z: ['100', '100', '100'] });
  const s0 = await state(page, P), s0b = await state(page, P);
  expect(s0).toEqual(s0b);                       // 두 번 읽어 같다
  expect([s0.dom, s0.arr, s0.top]).toEqual(['ABC', 'ABC', 'C']);
  await page.mouse.click(P[0], P[1]); await frames(page);
  expect((await state(page, P)).sel).toBe('C');
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item.selected').length)).toBe(0);
  expect(errs).toEqual([]);
});

test('L1·L2 ★C 고르고 ⌘[ → ACB(위 = B · 배열 같이 · 「뒤로 보내기」) → ⌘] → ABC(「앞으로 가져오기」)', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L1'));
  await page.mouse.click(P[0], P[1]); await frames(page);
  const s0 = await state(page, P);
  expect([s0.dom, s0.sel]).toEqual(['ABC', 'C']);
  await press(page, 'Meta+BracketLeft');
  const s1 = await state(page, P);
  expect({ dom: s1.dom, arr: s1.arr, top: s1.top, sel: s1.sel }).toEqual({ dom: 'ACB', arr: 'ACB', top: 'B', sel: 'C' });
  expect([s1.pos - s0.pos, s1.action]).toEqual([1, '뒤로 보내기']);
  await press(page, 'Meta+BracketRight');
  const s2 = await state(page, P);
  expect({ dom: s2.dom, arr: s2.arr, top: s2.top }).toEqual({ dom: 'ABC', arr: 'ABC', top: 'C' });
  expect([s2.pos - s1.pos, s2.action]).toEqual([1, '앞으로 가져오기']);
  expect([s1.action, s2.action]).not.toContain('레이어 순서');
  expect(errs).toEqual([]);
});

test('L3 ★⇧ 는 무시 — A 고르고 ⌘⇧] → BAC(한 칸 · 맨 위 BCA 아님) · ⌘⇧[ → ABC', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L3'));
  await clickItem(page, 'A');
  expect((await state(page, P)).sel).toBe('A');
  await press(page, 'Meta+Shift+BracketRight');
  const s1 = await state(page, P);
  expect([s1.dom, s1.arr, s1.action]).toEqual(['BAC', 'BAC', '앞으로 가져오기']);
  await press(page, 'Meta+Shift+BracketLeft');
  const s2 = await state(page, P);
  expect([s2.dom, s2.arr, s2.action]).toEqual(['ABC', 'ABC', '뒤로 보내기']);
  expect(errs).toEqual([]);
});

test('L4 지키는 자 — 이미 맨 위(C)에서 ⌘] → 무변 · 히스토리 0', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L4'));
  await page.mouse.click(P[0], P[1]); await frames(page);
  const s0 = await state(page, P);
  await press(page, 'Meta+BracketRight');
  const s1 = await state(page, P);
  expect([s1.dom, s1.arr, s1.top, s1.pos]).toEqual(['ABC', 'ABC', 'C', s0.pos]);
  expect(errs).toEqual([]);
});

test('L5 ★복수 — A·B(⇧) 고르고 ⌘] → 덩어리째 C 뒤로 = CAB · 겹친 점의 위 = B', async ({ page }) => {
  /* 손으로 셈: order ABC · picked {A,B} · 'down' = 마지막 고른 것(B) 바로 뒤 형제(C) 뒤로 덩어리째 ⇒ C A B. 겹친 점의 위 = B. */
  const { errs, P } = await scratchScene(page, uid('L5'));
  await clickItem(page, 'A');
  await clickItem(page, 'B', { shift: true });
  expect((await state(page, P)).sel).toBe('AB');
  await press(page, 'Meta+BracketRight');
  const s1 = await state(page, P);
  expect({ dom: s1.dom, arr: s1.arr, top: s1.top, sel: s1.sel }).toEqual({ dom: 'CAB', arr: 'CAB', top: 'B', sel: 'AB' });
  expect(errs).toEqual([]);
});

test('L6 ★⌘Z 한 칸이 순서를 되돌리고 ⌘⇧Z 가 다시 한다', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L6'));
  await page.mouse.click(P[0], P[1]); await frames(page);
  const s0 = await state(page, P);
  await press(page, 'Meta+BracketLeft');
  const s1 = await state(page, P);
  expect(s1.dom).toBe('ACB');
  await press(page, 'Meta+KeyZ');
  const s2 = await state(page, P);
  expect({ dom: s2.dom, arr: s2.arr, top: s2.top, pos: s2.pos }).toEqual({ dom: 'ABC', arr: 'ABC', top: 'C', pos: s0.pos });
  await press(page, 'Meta+Shift+KeyZ');
  const s3 = await state(page, P);
  expect({ dom: s3.dom, arr: s3.arr, top: s3.top, pos: s3.pos }).toEqual({ dom: 'ACB', arr: 'ACB', top: 'B', pos: s1.pos });
  expect(errs).toEqual([]);
});

test('L7 ★저장 → 재열기(IndexedDB · 새 탭) ×3 — 바꾼 순서가 남는다', async ({ page, context }) => {
  test.setTimeout(150000);
  const seen = [];
  for (let r = 1; r <= 3; r++) {
    const pid = uid('L7r' + r);
    const p1 = r === 1 ? page : await context.newPage();
    const { P } = await scratchScene(p1, pid);
    await p1.mouse.click(P[0], P[1]); await frames(p1);
    await press(p1, 'Meta+BracketLeft');
    expect((await state(p1, P)).dom).toBe('ACB');
    const ids = await p1.evaluate(() => window.__ids);
    // 저장은 비동기(IndexedDB) — 원자료가 바뀔 때까지 기다린다(끝내 안 바뀌면 옛 값 그대로 아래에서 빨강)
    await expect.poll(() => idbOrder(p1, pid), { timeout: 5000 }).toBe('ACB').catch(() => {});
    const idb = await idbOrder(p1, pid);
    await p1.close();
    const p2 = await context.newPage();
    const errs2 = await bootScratch(p2, pid);
    await p2.waitForFunction(() => document.querySelectorAll('.scratch-item').length === 3, null, { timeout: 15000 });
    await p2.evaluate((ids) => { window.__ids = ids; }, ids);
    await p2.evaluate(() => document.querySelector('.scratch-item').scrollIntoView({ block: 'start', inline: 'center' }));
    const P2 = await overlapPoint(p2);
    const s = await state(p2, P2), sb = await state(p2, P2);
    expect(s).toEqual(sb);
    seen.push({ r, idb, dom: s.dom, arr: s.arr, top: s.top, errs: errs2.length });
    await p2.close();
  }
  expect(seen.map(x => [x.idb, x.dom, x.arr, x.top, x.errs])).toEqual([1, 2, 3].map(() => ['ACB', 'ACB', 'ACB', 'B', 0]));
});

test('L8 지키는 자 — 맨 [ / ] (⌘ 없이)는 아무 일도 안 한다', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L8'));
  await page.mouse.click(P[0], P[1]); await frames(page);
  const s0 = await state(page, P);
  await press(page, 'BracketLeft');
  await press(page, 'BracketRight');
  const s1 = await state(page, P);
  expect([s1.dom, s1.arr, s1.pos]).toEqual(['ABC', 'ABC', s0.pos]);
  expect(errs).toEqual([]);
});

test('L10 지키는 자 — 입력칸에 글자 커서가 있으면 ⌘[ 는 스크래치를 안 건드린다', async ({ page }) => {
  const { errs } = await scratchScene(page, uid('L10'));
  // 우측 패널에 입력칸이 뜨게 도형 하나를 고른 뒤(앱의 제 문), 스크래치 C 를 고르고, 그 패널 입력칸을 실클릭
  const [s1] = await addTwoRects(page);
  await clickShape(page, s1);
  await page.evaluate(() => document.querySelector('.scratch-item').scrollIntoView({ block: 'start', inline: 'center' }));
  const P = await overlapPoint(page);
  await page.mouse.click(P[0], P[1]); await frames(page);
  expect((await state(page, P)).sel).toBe('C');
  const inp = await page.evaluate(() => {
    const el = [...document.querySelectorAll('#panel-right input')]
      .find(e => { if (['file', 'checkbox', 'radio', 'range', 'color', 'hidden'].includes(e.type) || e.disabled || e.readOnly || !e.offsetWidth || !e.offsetHeight) return false;
        const b = e.getBoundingClientRect(); return b.top >= 0 && b.bottom <= innerHeight && document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === e; });
    if (!el) return null; const b = el.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, id: el.id || el.className };
  });
  expect(inp, '우측 패널에 보이는 입력칸을 못 찾았다').not.toBeNull();
  await page.mouse.click(inp.x, inp.y); await frames(page);
  expect(await page.evaluate(() => document.activeElement?.tagName)).toBe('INPUT');
  expect((await state(page, P)).sel).toBe('C');   // 입력칸 클릭이 스크래치 선택을 안 풀었다(전제)
  const o0 = await shapeOrder(page);
  await press(page, 'Meta+BracketLeft');
  expect((await state(page, P)).dom).toBe('ABC');
  expect(await shapeOrder(page)).toEqual(o0);
  expect(errs).toEqual([]);
});

/* ═════════════════ 대조군 — 한 핸들러를 같이 쓴다(이 묶음에서 제일 쉽게 깨지는 자리) ═════════════════ */

test('L9 대조 ㈏ — ⌘G 그룹 안 자식(스크래치 선택 없음): ⌘] 「앞으로 가져오기」 · ⌘[ 「뒤로 보내기」 · 순서가 바뀐다', async ({ page }) => {
  const { errs } = await scratchScene(page, uid('L9'));
  const [s1, s2] = await addTwoRects(page);
  await clickShape(page, s1); await clickShape(page, s2, { shift: true });
  await press(page, 'Meta+KeyG');
  expect(await page.evaluate((id) => !!document.getElementById(id)?.closest('.frame-block[data-free-layout="true"]'), s1)).toBe(true);
  await clickShape(page, s1, { dbl: true });
  expect(await page.evaluate(() => document.querySelectorAll('.scratch-item.scratch-selected').length)).toBe(0);
  const o0 = await shapeOrder(page);
  await press(page, 'Meta+BracketRight');
  const o1 = await shapeOrder(page), t1 = await tip(page);
  await press(page, 'Meta+BracketLeft');
  const o2 = await shapeOrder(page), t2 = await tip(page);
  expect(o1).toEqual([...o0].reverse());
  expect(t1.action).toBe('앞으로 가져오기');
  expect(o2).toEqual(o0);
  expect(t2.action).toBe('뒤로 보내기');
  expect(errs).toEqual([]);
});

test('L9b 대조 ㈎ — 오버레이 둘(섹션 직속): ⌘] 「앞으로 가져오기」 · 섹션 직속 순서가 바뀐다', async ({ page }) => {
  const { errs } = await scratchScene(page, uid('L9b'));
  const ids = await addTwoRects(page);
  /* 오버레이는 «아래 것부터» 띄운다 — 위 것을 먼저 띄우면 아래 것이 흐름에서 올라와 그 오버레이 밑에 깔려
     다음 클릭이 오버레이를 다시 집는다(플래너 탐침 c1_toggle1 이 그렇게 «해제»했다). */
  const tops = await page.evaluate((ids) => ids.map(id => document.getElementById(id).getBoundingClientRect().top), ids);
  const order = tops[0] > tops[1] ? [ids[0], ids[1]] : [ids[1], ids[0]];
  for (const id of order) {
    await clickShape(page, id);
    await page.click('#shape-overlay-toggle');
    await page.waitForFunction((id) => !!document.getElementById(id)?.closest('[data-overlay-block="true"]'), id);
  }
  const unitOrder = () => page.evaluate((ids) => {
    const us = ids.map(id => document.getElementById(id).closest('[data-overlay-block="true"]'));
    if (us.some(u => !u)) return null;
    const sec = us[0].parentElement;
    return { sameSection: us.every(u => u.parentElement === sec) && sec.classList.contains('section-block'),
      order: [...sec.children].filter(c => us.includes(c)).map(c => ids[us.indexOf(c)]) };
  }, ids);
  const u0 = await unitOrder();
  expect(u0, '두 도형이 오버레이가 안 됐다').not.toBeNull();
  expect(u0.sameSection).toBe(true);
  await clickShape(page, u0.order[0]);   // 앞(아래) 것을 골라 ⌘] → 뒤(위)로
  await press(page, 'Meta+BracketRight');
  const u1 = await unitOrder(), t1 = await tip(page);
  expect(u1.order).toEqual([u0.order[1], u0.order[0]]);
  expect(t1.action).toBe('앞으로 가져오기');
  await press(page, 'Meta+BracketLeft');
  const u2 = await unitOrder(), t2 = await tip(page);
  expect(u2.order).toEqual(u0.order);
  expect(t2.action).toBe('뒤로 보내기');
  expect(errs).toEqual([]);
});

test('L9c 대조 흐름 — 도형 프레임: ⌘] 「프레임 아래로 이동」', async ({ page }) => {
  const { errs } = await scratchScene(page, uid('L9c'));
  const ids = await addTwoRects(page);
  const o0 = await shapeOrder(page);
  await clickShape(page, o0[0]);
  await press(page, 'Meta+BracketRight');
  const o1 = await shapeOrder(page), t1 = await tip(page);
  expect(o1).toEqual([o0[1], o0[0]]);
  expect(t1.action).toBe('프레임 아래로 이동');
  expect(ids.length).toBe(2);
  expect(errs).toEqual([]);
});

/* ═════════════════ 섞인 선택 (판정 ⑶) + 히스토리 이름 대조 (판정 ⑵) ═════════════════ */

test('L11 ★섞인 선택이면 스크래치가 가져간다 · 그 히스토리 이름 == 앱에서 캔버스 ⌘[ / ⌘] 를 눌러 생긴 이름', async ({ page }) => {
  const { errs, P } = await scratchScene(page, uid('L11'));
  const [s1, s2] = await addTwoRects(page);
  await clickShape(page, s1); await clickShape(page, s2, { shift: true });
  await press(page, 'Meta+KeyG');
  await clickShape(page, s1, { dbl: true });
  // ⑵ 캔버스 갈래 이름 — 손으로 박지 않는다: 지금 눌러서 읽는다(스크래치 선택 없음)
  await press(page, 'Meta+BracketRight'); const canvasDown = (await tip(page)).action;
  await press(page, 'Meta+BracketLeft'); const canvasUp = (await tip(page)).action;
  expect(canvasDown && canvasUp && canvasDown !== canvasUp).toBeTruthy();
  // 섞는다: 캔버스 자식이 골라진 채 스크래치 C 를 실클릭
  await page.evaluate(() => document.querySelector('.scratch-item').scrollIntoView({ block: 'start', inline: 'center' }));
  const P2 = await overlapPoint(page);
  await page.mouse.click(P2[0], P2[1]); await frames(page);
  const mixed = await page.evaluate(() => ({ canvas: document.querySelectorAll('#canvas .shape-block.selected').length }));
  expect(mixed.canvas, '전제: 캔버스 선택이 남아 있다(섞인 상태)').toBeGreaterThan(0);
  const o0 = await shapeOrder(page), s0 = await state(page, P2);
  expect(s0.sel).toBe('C');
  await press(page, 'Meta+BracketLeft');
  const sUp = await state(page, P2), oUp = await shapeOrder(page);
  await press(page, 'Meta+BracketRight');
  const sDown = await state(page, P2), oDown = await shapeOrder(page);
  expect({ up: sUp.dom, down: sDown.dom }).toEqual({ up: 'ACB', down: 'ABC' });   // 스크래치가 가져갔다
  expect([oUp, oDown]).toEqual([o0, o0]);                                          // 캔버스는 무변
  expect({ up: sUp.action, down: sDown.action }).toEqual({ up: canvasUp, down: canvasDown });
  expect(P).toBeTruthy();
  expect(errs).toEqual([]);
});

/* ═════════════════ 구멍 메우기 (1020t2a2 평가자 변이 V5 · V1 — 이 두 꼴을 위 L0~L11 이 못 물었다) ═════════════════ */

test('L12 ★섞인 선택 · 스크래치 C 가 이미 맨 위에서 ⌘] → 키는 스크래치가 가진다(캔버스로 안 흐른다) · 히스토리·도형·스크래치 무변', async ({ page }) => {
  /* 지키는 자: 지디 판정 ⑶(섞인 선택은 스크래치가 키를 갖는다). 변이 V5 «끝이면 false» 면 키가 moveSelectedBlocks 로 흘러
     캔버스 그룹 자식이 움직이고 히스토리가 쌓인다(평가자 mixedend 실측 pos 5→7). */
  const { errs } = await scratchScene(page, uid('L12'));
  const [s1, s2] = await addTwoRects(page);
  await clickShape(page, s1); await clickShape(page, s2, { shift: true });
  await press(page, 'Meta+KeyG');
  await clickShape(page, s1, { dbl: true });
  // 전제: 캔버스만 골랐을 때 ⌘] 는 실제로 도형 순서를 바꾼다(흘렀다면 보였을 것) — 눌러 보고 ⌘Z 로 되돌린다
  const oc0 = await shapeOrder(page);
  await press(page, 'Meta+BracketRight');
  expect(await shapeOrder(page), '전제: 캔버스 ⌘] 가 도형 순서를 바꾼다').not.toEqual(oc0);
  await press(page, 'Meta+KeyZ');
  expect(await shapeOrder(page)).toEqual(oc0);
  // 섞는다: 캔버스 자식이 골라진 채 스크래치 C(맨 위)를 실클릭
  await page.evaluate(() => document.querySelector('.scratch-item').scrollIntoView({ block: 'start', inline: 'center' }));
  const P = await overlapPoint(page);
  await page.mouse.click(P[0], P[1]); await frames(page);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .shape-block.selected').length), '전제: 캔버스 선택이 남아 있다(섞인 상태)').toBeGreaterThan(0);
  const s0 = await state(page, P), o0 = await shapeOrder(page);
  expect([s0.dom, s0.arr, s0.top, s0.sel]).toEqual(['ABC', 'ABC', 'C', 'C']);
  await press(page, 'Meta+BracketRight');
  const s1b = await state(page, P), o1 = await shapeOrder(page);
  expect({ pos: s1b.pos, action: s1b.action }).toEqual({ pos: s0.pos, action: s0.action });   // 히스토리 무변
  expect(o1).toEqual(o0);                                                                       // 도형 순서 무변
  expect([s1b.dom, s1b.arr, s1b.top]).toEqual(['ABC', 'ABC', 'C']);                             // 스크래치 순서 무변
  expect(errs).toEqual([]);
});

test('L13 ★#canvas-scaler 의 비-스크래치 자식(#grd-plus-layer)과의 상대 순서 — ⌘[ 는 스크래치 «자리»끼리만 바꾼다 · ⌘Z 원상', async ({ page }) => {
  /* 지키는 자: 지디 채택 1021 — V1 «슬롯 유지».
     근거: work-1020t2a2/PLAN.md :64 원문 「(스크래치끼리 상대 순서만 바꾼다 · link-edges/todo-pin-overlay/canvas 앞쪽 자식은 안 움직인다)」.
     ⛔근거는 위 괄호 «원칙» 절뿐이다. 같은 줄에 적힌 방법(anchor 앞으로 insertBefore)은 폐기됐다(GEN.md) — 스크래치 «사이»에
       다른 자식이 끼면 그 원칙을 깬다 · 지금 구현은 슬롯 교환. ⛔줄 전체를 근거로 읽고 그 방법으로 되돌리지 마라.
     현빈·지디 원문에는 없다 — 원문 없음 · 설계 판단.
     변이 V1 «슬롯 교환 대신 첫 스크래치 앞으로 몰기» 면 C·B 가 #grd-plus-layer 앞으로 몰린다(평가자 scaler 실측 «A C B #grd-plus-layer»).
     장면 = 앱의 제 문(평가자 7번 꼴): 폴더 2장(A B) → 툴바 새 섹션 → 컴포넌트 ▸ Grid → 그리드 실클릭(＋ 층이 scaler 끝에 붙음) → 폴더 1장(C). */
  const errs = await bootScratch(page, uid('L13'));
  await page.setInputFiles('#scratchpad-folder-input', IMGDIR_AB);
  await page.waitForFunction(() => document.querySelectorAll('.scratch-item').length === 2, null, { timeout: 15000 });
  await clickEmpty(page);
  await page.click('button.fp-btn.primary[title="새 섹션 추가"]');
  await page.waitForFunction(() => !!document.querySelector('#canvas .section-block'));
  await page.click('button.fp-dropdown-trigger[onclick*="fp-component-dropdown"]');
  const g = page.locator('#fp-component-dropdown button.fp-menu-item', { hasText: /^Grid$/ });
  await g.waitFor({ state: 'visible' }); await g.click();
  await page.waitForFunction(() => !!document.querySelector('#canvas .grid-block'));
  const gid = await page.evaluate(() => document.querySelector('#canvas .grid-block').id);
  await clickShape(page, gid);
  await page.waitForFunction(() => document.getElementById('grd-plus-layer')?.parentElement?.id === 'canvas-scaler', null, { timeout: 5000 });
  await page.setInputFiles('#scratchpad-folder-input', IMGDIR_C);
  await page.waitForFunction(() => document.querySelectorAll('.scratch-item').length === 3, null, { timeout: 15000 });
  await page.evaluate(() => { window.__ids = [...document.querySelectorAll('.scratch-item')].map(e => e.dataset.scratchId); });
  const sig = () => page.evaluate(() => {
    const ids = window.__ids; const sc = document.getElementById('canvas-scaler');
    return [...sc.childNodes].filter(n => n.nodeType === 1 || n.nodeType === 8)
      .map(c => c.nodeType === 8 ? '<!>' : c.classList.contains('scratch-item') ? 'ABC'[ids.indexOf(c.dataset.scratchId)] : '#' + (c.id || String(c.className).split(' ')[0]));
  });
  const sub = (s) => s.filter(t => t.length === 1 || t === '#grd-plus-layer');
  const init = await sig();
  expect(sub(init), '전제: ＋ 층이 A·B 와 C 사이에 앉는다').toEqual(['A', 'B', '#grd-plus-layer', 'C']);
  await clickEmpty(page);
  await page.evaluate(() => document.querySelector(`.scratch-item[data-scratch-id="${window.__ids[2]}"]`).scrollIntoView({ block: 'center', inline: 'center' }));
  await waitStableRect(page, '.scratch-item', { index: 2 });
  await clickItem(page, 'C');
  expect((await state(page)).sel).toBe('C');
  const t0 = await tip(page);
  await press(page, 'Meta+BracketLeft');
  const s1 = await sig(), st1 = await state(page);
  expect(sub(s1)).toEqual(['A', 'C', '#grd-plus-layer', 'B']);
  expect(s1).toEqual(init.map(t => (t === 'B' ? 'C' : t === 'C' ? 'B' : t)));   // 그 밖 scaler 자식 자리 전부 그대로 · 표식(주석) 누수 0
  expect([st1.arr, st1.pos - t0.pos, st1.action]).toEqual(['ACB', 1, '뒤로 보내기']);
  await press(page, 'Meta+KeyZ');
  const s2 = await sig(), st2 = await state(page);
  expect(s2).toEqual(init);
  expect([st2.arr, st2.pos]).toEqual(['ABC', t0.pos]);
  expect(errs).toEqual([]);
});
