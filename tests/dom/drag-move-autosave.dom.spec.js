/* drag-move-autosave.dom.spec.js — ⒡ 끌어 옮긴 것이 «저장»되나 (2026-10-05 lane-esweep · 데이터 손실)
 *
 * 증상(실앱 실측 · 격리 앱 0f572e2a): 섹션 안 글자 A 를 B 아래로 끌어 놓으면 화면은 B,A 인데 파일은 A,B 그대로 —
 *   4초·20초 뒤에도 파일 무변 · 다시 읽으면(reload) 옮김이 사라진다. 「상관없는 편집 하나를 하면 그때 같이 저장된다」.
 *   E132(칸에 끌어 넣은 줄이 다시 열면 없음)도 같은 뿌리.
 * 뿌리: dragstart 가 자동저장 «억제 창»을 연다(_suppressDragSave / AutoSaveSuppress.begin('layer-drag')).
 *   놓기의 DOM 변화는 창 «안»이라 scheduleAutoSave 가 «기억 없이» 버리고, dragend 는 창만 닫는다(저장 예약 없음).
 * 분모 = 억제 창을 여는 길 6: P1 block-drag.js 블럭 단위 · P2 block-drag.js 프레임 · P3 section-drag.js 섹션 라벨 ·
 *   P4 section-drag.js 그룹(놓아도 바뀌는 것 없음 — dragSrc 를 안 정함 · 시험 없음) · P5 section-drag.js 빈 row · P6 layer-panel-items.js 레이어.
 * 판정 = 창이 닫힌 뒤 2.5초 안 localStorage 자동저장본(web-editor-autosave__<pid>)의 순서가 «화면과 같은가».
 *   (electronAPI 는 가짜라 파일은 못 잰다 — 자동저장이 파일 쓰기와 «같은 snap» 으로 localStorage 를 먼저 쓴다: save-load.js scheduleAutoSave.)
 * S* = 그 길의 요소에 진짜 dragstart → DOM 옮김 → 진짜 dragend(앱 리스너가 창을 열고 닫는다 · 놓기 판정·좌표는 안 잼).
 *   ⚠️처음엔 «진짜 손» 끌기로 짰다 — 하네스에서 앱 함수로 만든 글자 둘이 겹쳐 A 를 누르면 B 가 맞고(전제 실패) 프레임 판이 판마다 뒤집혀 S 꼴로 바꿨다.
 * R0 = 진짜 손(page.mouse) 제자리 끌기.
 *   ⚠️레이어 «진짜 손» 끌기(R6)는 뺐다 — 하네스에서 전제(화면이 바뀜)가 6 중 2 만 섰다(23:3x · 고친 판 · load 6~11). 저장 길은 S6 이 «정해진 꼴»로 잰다 · 진짜 손은 실앱 표가 잰다.
 * 머리표: [새 것] 0f572e2a 에서 빨강(S1 · S3 · S5 · S6) · [지킴] 0f572e2a 에서도 초록(S2 · R0) · [전제] 재기 위한 조건.
 * ⛔못 보는 꼴: 앱 종료·다시 열기(파일) — 실앱 표가 잰다. P4 그룹(놓아도 바뀌는 것 없음)은 시험 없음.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { ROOT, ORIGIN } = require('./_root-harness.js');
const PID = 'proj_1700000000777';
test.describe.configure({ timeout: 60000 });
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png' };

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e)));
  await page.setViewportSize({ width: 1500, height: 1100 });
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.addInitScript(() => { window.prompt = () => { throw new Error('prompt() is not supported.'); }; });
  await page.route(`${ORIGIN}/**`, async (r) => {
    const u = new URL(r.request().url());
    const f = path.join(ROOT, decodeURIComponent(u.pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html?project=${PID}`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.hasUnsavedChanges === 'function', null, { timeout: 20000 });
  await page.waitForTimeout(2500);   // 열기 뒤 늦게 오는 저장(있으면)이 끝나게
  return errs;
}
const SKEL = (id) => `<div class="section-block" id="${id}" data-section="1" data-name="${id}"><div class="section-hitzone"><span class="section-label" draggable="true">${id}</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="gap-block" data-type="gap" style="height:160px"></div></div></div>`;
/** 장면: 섹션 뼈대(JS) + 블럭은 «앱 함수»로(T▾·Frame 단추가 부르는 그 함수) — 손으로 쓴 HTML 은 끌기 배선이 안 붙는다(첫 판 실측: 화면 무변). */
async function scene(page, secIds, build) {
  const ids = await page.evaluate(([secIds, build]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', secIds.map(id => `<div class="section-block" id="${id}" data-section="1" data-name="${id}"><div class="section-hitzone"><span class="section-label" draggable="true">${id}</span></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:40px"></div><div class="gap-block" data-type="gap" style="height:160px"></div></div></div>`).join(''));
    window.rebindAll?.(); window.applyZoom?.(50);
    const out = {};
    for (const [key, secId, kind] of build) {
      const sec = document.getElementById(secId); window.deselectAll?.(); window._activeFrame = null; window.selectSection?.(sec);
      const before = new Set([...document.querySelectorAll('#canvas [id]')].map(e => e.id));
      if (kind === 'text') window.addTextBlock('body');
      else if (kind === 'frame') window.addFrameBlock();
      else if (kind === 'emptyRow') { if (typeof window.addPresetRow === 'function') window.addPresetRow('__esweep_empty'); }
      const sel = kind === 'text' ? '.text-block' : kind === 'frame' ? '.frame-block:not([data-text-frame])' : '.row';
      const made = [...document.querySelectorAll('#canvas ' + sel)].find(e => !before.has(e.id));
      out[key] = made ? made.id : null;
    }
    window.deselectAll?.(); window._activeFrame = null; window.buildLayerPanel?.();
    return out;
  }, [secIds, build]);
  await page.waitForTimeout(400);
  const any = Object.values(ids).filter(Boolean)[0] || secIds[0];
  await expect.poll(() => page.evaluate(([pid, id]) => (localStorage.getItem('web-editor-autosave__' + pid) || '').includes('id=\\"' + id + '\\"'), [PID, any]), { timeout: 5000, message: '[전제] 장면이 자동저장본에 들어감' }).toBe(true);
  await page.waitForTimeout(300);
  return ids;
}
const savedIdx = (page, ids) => page.evaluate(([pid, ids]) => { const s = localStorage.getItem('web-editor-autosave__' + pid) || ''; return ids.map(i => s.indexOf('id=\\"' + i + '\\"')); }, [PID, ids]);
const screenIdx = (page, ids) => page.evaluate((ids) => { const all = [...document.querySelectorAll('#canvas [id]')].map(e => e.id); return ids.map(i => all.indexOf(i)); }, ids);
const ordered = (a) => a.every((v, i) => i === 0 || (a[i - 1] >= 0 && v > a[i - 1]));
/** ★mouse.down 을 클릭 «바로 뒤»에 하면 Playwright 가 clickCount 2(더블클릭)로 보내 글자 편집에 들어가 끌기가 막힌다(첫 판 실측) — 0.8초 띄운다.
 *  hitSel: 누르는 점이 그 요소 위인가를 «먼저» 단언([전제]). */
async function nativeDrag(page, from, to, hitSel, fromSel) {
  await page.waitForTimeout(800);
  if (fromSel) from = await ctr(page, fromSel);
  if (typeof from === 'function') from = await from();          // 클릭·선택 뒤 자리가 움직였을 수 있다 — 누르기 «직전»에 다시 잰다
  if (typeof to === 'function') to = await to();
  await page.mouse.move(from.x, from.y); await page.waitForTimeout(250);   // 사람처럼 먼저 올려 둔다(섹션 라벨은 hover 때만 잡힌다)
  if (hitSel) { const hit = await page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return { ok: !!e?.closest(s), cls: String(e?.className).slice(0, 40) + '#' + (e?.closest('[id]')?.id || '') }; }, [from.x, from.y, hitSel]); expect(hit.ok, `[전제] 누르는 점이 ${hitSel} 위 · 맞은 것=${hit.cls}`).toBe(true); }
  await page.mouse.move(from.x, from.y); await page.mouse.down();
  for (let k = 1; k <= 12; k++) await page.mouse.move(from.x + (to.x - from.x) * k / 12, from.y + (to.y - from.y) * k / 12);
  await page.waitForTimeout(150); await page.mouse.up(); await page.waitForTimeout(200);
}
const ctr = (page, sel, fy = 0.5) => page.evaluate(([s, fy]) => { const e = document.querySelector(s); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.left + Math.min(40, r.width / 2)), y: Math.round(r.top + r.height * fy) }; }, [sel, fy]);
/** 화면이 «기대 순서»가 된 뒤, 2.5초 안 저장본도 같은 순서가 되나 */
async function expectSavedLikeScreen(page, ids, label) {
  const scr = await screenIdx(page, ids);
  expect(ordered(scr), `[전제] ${label}: 화면이 ${ids.join('<')} 로 바뀜 · 화면 idx=${scr}`).toBe(true);
  await expect(async () => { const sv = await savedIdx(page, ids); expect(ordered(sv), `${label}: 2.5초 안 자동저장본 순서 · 저장본 idx=${JSON.stringify(sv)} 화면 idx=${scr}`).toBe(true); }).toPass({ timeout: 2500, intervals: [250] });
}

/** 그 길의 «요소»에 진짜 dragstart → (놓기 대신) DOM 을 손으로 옮김 → 진짜 dragend. 앱의 dragstart/dragend 리스너가 그대로 돈다(억제 창 열고 닫기).
 *  ⛔놓기 판정·좌표는 안 잰다 — 그건 실앱 표(사람 순서)가 잰다. 이 시험이 재는 것 = «창이 닫힌 뒤 저장이 걸리나». */
async function windowDrag(page, srcExpr, moveBody, reason) {
  const opened = await page.evaluate(([srcExpr, moveBody]) => {
    const src = (new Function('return ' + srcExpr))();
    if (!src) return { err: 'no src' };
    const dt = new DataTransfer();
    src.dispatchEvent(new DragEvent('dragstart', { bubbles: true, cancelable: true, dataTransfer: dt }));
    const holders = (window.AutoSaveSuppress?.inspect?.().holders || []).map(h => h.reason);
    (new Function(moveBody))();
    return { holders, src: src.id || src.className.split(' ')[0] };
  }, [srcExpr, moveBody]);
  expect(opened.holders, `[전제] dragstart 가 억제 창(${reason})을 열었다 · 잡은 것=${JSON.stringify(opened)}`).toContain(reason);
  await page.waitForTimeout(50);   // 관측자(마이크로태스크)가 «창 안에서» 변화를 보게
  await page.evaluate((srcExpr) => { const src = (new Function('return ' + srcExpr))(); src.dispatchEvent(new DragEvent('dragend', { bubbles: true, dataTransfer: new DataTransfer() })); }, srcExpr);
}
const unitOf = (id) => `document.getElementById('${id}').closest('[draggable="true"]')`;

test('S1 [새 것] P1 블럭 단위(글자) — 창 안에서 A 를 B 뒤로 옮기고 창이 닫히면 2.5초 안 저장본도 B,A', async ({ page }) => {
  const errs = await boot(page);
  const { A, B } = await scene(page, ['secA'], [['A', 'secA', 'text'], ['B', 'secA', 'text']]);
  expect(A && B, `[전제] 글자 둘 ${A} ${B}`).toBeTruthy();
  await windowDrag(page, unitOf(A), `const a=${unitOf(A)}, b=${unitOf(B)}; b.after(a);`, 'section-drag');
  await expectSavedLikeScreen(page, [B, A], 'S1');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S2 [지킴] P2 프레임 — 창 안에서 프레임을 B 뒤로 옮기면 저장본도 따라감(dragend 가 이미 저장을 건다)', async ({ page }) => {
  const errs = await boot(page);
  const { F, B } = await scene(page, ['secA'], [['F', 'secA', 'frame'], ['B', 'secA', 'text']]);
  expect(F && B, `[전제] 프레임·글자 ${F} ${B}`).toBeTruthy();
  const f = await page.evaluate((F) => { const e = document.getElementById(F); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: Math.round(r.right - 6), y: Math.round(r.top + 6) }; }, F);
  await page.mouse.click(f.x, f.y); await page.waitForTimeout(300);   // 프레임 끌기는 «고른 프레임»만(block-drag.js _bindFrameOwnDrag)
  expect(await page.evaluate((F) => document.getElementById(F).classList.contains('selected'), F), '[전제] 프레임이 골라졌다').toBe(true);
  await windowDrag(page, `document.getElementById('${F}')`, `const f=document.getElementById('${F}'), b=${unitOf(B)}; b.after(f);`, 'section-drag');
  await expectSavedLikeScreen(page, [B, F], 'S2');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S3 [새 것] P3 섹션 라벨 — 창만 열고 닫는 길(놓기 처리기 밖)에서 섹션 순서를 바꿔도 저장본이 따라감', async ({ page }) => {
  const errs = await boot(page);
  await scene(page, ['secA', 'secB'], [['A', 'secA', 'text'], ['B', 'secB', 'text']]);
  await windowDrag(page, `document.querySelector('#secA .section-label')`, `document.getElementById('secB').after(document.getElementById('secA'));`, 'section-drag');
  await expectSavedLikeScreen(page, ['secB', 'secA'], 'S3');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S5 [새 것] P5 빈 row — 창 안에서 빈 row 를 B 뒤로 옮기면 저장본도 따라감', async ({ page }) => {
  const errs = await boot(page);
  const { E, B } = await scene(page, ['secA'], [['E', 'secA', 'emptyRow'], ['B', 'secA', 'text']]);
  const bound = E ? await page.evaluate((E) => !!document.getElementById(E)._dragBound && !document.getElementById(E).querySelector('.text-block,.asset-block'), E) : false;
  expect(bound, `[전제] 빈 row(addPresetRow 이름 없는 종류)에 끌기가 묶였다(bindEmptyRow) · E=${E}`).toBe(true);
  await windowDrag(page, `document.getElementById('${E}')`, `const e=document.getElementById('${E}'), b=${unitOf(B)}; b.after(e);`, 'section-drag');
  await expectSavedLikeScreen(page, [B, E], 'S5');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('S6 [새 것] P6 레이어 항목 — 레이어 창 안에서 A 를 B 뒤로 옮기면 저장본도 따라감', async ({ page }) => {
  const errs = await boot(page);
  const { A, B } = await scene(page, ['secA'], [['A', 'secA', 'text'], ['B', 'secA', 'text']]);
  await page.evaluate(() => { window.switchToTab?.('file'); window.buildLayerPanel?.(); });
  await page.waitForTimeout(300);
  const item = `[...document.querySelectorAll('.layer-item')].find(i => i._dragTarget && (i._dragTarget.id === '${A}' || i._dragTarget.querySelector?.('#${A}')))`;
  await windowDrag(page, item, `const a=${unitOf(A)}, b=${unitOf(B)}; b.after(a);`, 'layer-drag');
  await expectSavedLikeScreen(page, [B, A], 'S6');
  expect(errs, errs.join('\n')).toEqual([]);
});

test('R0 [지킴] «진짜 손» 끌었다가 제자리에 놓으면(변화 0) 저장이 새로 안 생긴다', async ({ page }) => {
  const errs = await boot(page);
  const { A, B } = await scene(page, ['secA'], [['A', 'secA', 'text'], ['B', 'secA', 'text']]);
  const ts0 = await page.evaluate((pid) => localStorage.getItem('web-editor-autosave__' + pid + '_ts'), PID);
  const a = await ctr(page, `#${A} [class^="tb-"]`); await page.mouse.click(a.x, a.y); await page.waitForTimeout(300);
  await nativeDrag(page, a, { x: a.x + 2, y: a.y + 1 }, `#${A}`);
  await page.waitForTimeout(2500);
  const ts1 = await page.evaluate((pid) => localStorage.getItem('web-editor-autosave__' + pid + '_ts'), PID);
  const scr = await screenIdx(page, [A, B]);
  expect(ordered(scr), `[전제] 화면 그대로 A<B · ${scr}`).toBe(true);
  expect(ts1, `변화 0 끌기 뒤 저장 타임스탬프 ${ts0} → ${ts1}`).toBe(ts0);
  expect(errs, errs.join('\n')).toEqual([]);
});
