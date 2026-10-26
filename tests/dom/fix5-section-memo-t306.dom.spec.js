/* fix5-section-memo-t306.dom.spec.js — t3-06 메모 있는 섹션 / 없는 섹션 구분해 보기 (ㄱ+ㄴ+ㄷ+㉱)
 *
 * 현빈 원문(👉): 「섹션 중에 노트가 있는 노트 메모 할 수 있잖아 근데 노트가 있는 섹션과 없는 섹션을 구분해서
 *   내가 좀 볼 수 있었으면 좋겠어 … 좌측의 투두 패널 따로 거기서 뭐 확인을 할 수 있도록 해야 될까」
 * 현빈 답 = ㄱ+ㄴ+ㄷ(+㉱) · 정본 시안 sian-11-section-memo-t306-v1 · 계획 reports/S6-FIX5/plan-t306.md
 *
 * 재는 것 (실제 마우스·키 — clickAt 은 누르기 직전 elementFromPoint 로 «무엇을» 누르는지 단언한다):
 *   A1 ㉮ 📝 단추 채움/빈 — 메모 있으면 주황 바탕·점·채운 종이, 없으면 그대로. 모달로 쓰고 지우면 따라 바뀐다.
 *   B1 ㉯ 탭 수 = 메모 섹션 수 · 섹션 왼쪽 바깥 자리 · 배율/높이/이동 뒤에도 자리 · 숨긴 섹션 흐림
 *   B2 ㉯ hover = 미리보기 · 클릭 = 그 섹션 선택 + 메모 창
 *   B3 ㉯ #canvas 안 표식 0 · getSerializedCanvas 표식 0 · PNG 캡처 클론(prepareCloneForCapture) 표식 0 · 단독 HTML 클론 0
 *   B4 표식·목록·hover·토글이 #canvas 를 한 번도 안 건드린다(= autoSaveObserver 를 안 깨운다)
 *   C1 ㉰ 체크리스트 탭 맨 위 토글 묶음 — 줄 수·차례·번호·미리보기·체크 수 · 접기/펴기 · 이름만
 *   C2 ㉰ 줄 클릭 = selectSection(sec, true) — 선택 + 섹션 위가 창 위 40px + 번쩍(덧층)
 *   C3 ㉰ 현재 페이지만 — 새 페이지로 가면 0줄, 돌아오면 그대로
 *   D1 ㉱ 레이어 섹션 행 📝 — 있음/없음 · 메모 생기면 붙고 지우면 떨어진다 · 레이어 재빌드에도 남는다
 *   E1 메모를 지우면 탭·목록·레이어에서 빠진다
 *   T1 ★투두 무접촉 — 투두 항목 수·_ckItems/_ckSections·프로젝트 JSON checklistItems/checklistSections·
 *      localStorage 키/값이 묶음 열고 닫기·이름만·메모 추가·삭제·줄 클릭 전후 같다
 *
 * 양성대조: GD1001_ROOT=<바닥 8608bb13 사본> 로 돌리면 A1·B*·C*·D1·E1·T1 이 빨강이어야 한다(바닥엔 이 기능이 없다).
 * 고정 대기 0 — expect.poll / waitForFunction / waitStableRect 만 쓴다.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js tests/dom/fix5-section-memo-t306.dom.spec.js --workers=1 --retries=0
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const ORANGE_BG = 'rgba(245, 158, 11, 0.14)';
const MEMO1 = '출처: 쿠팡 1번 컷\n[ ] 문구 고치기\n[x] 사진 바꾸기';

/* 섹션 5개 — 메모: sM1(체크 2) · sM3(글) · sM4(공백만 = «있음» · 숨김) / 없음: sM2 · sM5 */
async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((memo1) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    for (let i = 0; i < 5; i++) window.addSection({ skipDefaultBlock: true });
    const secs = [...c.querySelectorAll('.section-block')];
    secs.forEach((s, i) => { s.id = 'sM' + (i + 1); s._name = '섹션' + (i + 1); s.dataset.name = '섹션' + (i + 1); });
    window.setSectionMemo('sM1', memo1);
    window.setSectionMemo('sM3', '히어로 카피 확인');
    window.setSectionMemo('sM4', '   ');
    const s4 = document.getElementById('sM4');
    s4.dataset.hidden = '1'; s4.style.visibility = 'hidden'; s4.style.opacity = '0';   // 레이어 눈 끔과 같은 꼴(layer-panel.js)
    window.applyZoom && window.applyZoom(50);
    window.deselectAll && window.deselectAll();
    window.buildLayerPanel && window.buildLayerPanel();
  }, MEMO1);
  return errs;
}

const tabIds = (page) => page.evaluate(() => [...document.querySelectorAll('#section-memo-overlay .smemo-tab')].map(t => t.dataset.secId));
const rowIds = (page) => page.evaluate(() => [...document.querySelectorAll('#smemo-group .smemo-item')].map(r => r.dataset.secId));

/* 탭이 «그 섹션 왼쪽 바깥»에 화면 크기 24px 로 붙어 있나 — 어긋난 칸의 이름을 돌려준다(빈 배열 = 다 맞음) */
const tabPlacementErrors = (page) => page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('#section-memo-overlay .smemo-tab').forEach(t => {
    const s = document.getElementById(t.dataset.secId);
    if (!s) { bad.push(t.dataset.secId + ':no-sec'); return; }
    const tr = t.getBoundingClientRect(), sr = s.getBoundingClientRect();
    if (Math.abs(tr.top - sr.top) > 1.5) bad.push(`${t.dataset.secId}:top ${tr.top.toFixed(1)}≠${sr.top.toFixed(1)}`);
    if (Math.abs(tr.right - (sr.left - 6)) > 1.5) bad.push(`${t.dataset.secId}:right ${tr.right.toFixed(1)}≠${(sr.left - 6).toFixed(1)}`);
    if (Math.abs(tr.width - 24) > 1) bad.push(`${t.dataset.secId}:w ${tr.width.toFixed(1)}`);
  });
  return bad;
});

async function clickLayerSection(page, id) {
  /* 레이어는 File 탭에 산다 — 다른 탭이면 먼저 File 탭을 진짜로 누른다 */
  if (await page.evaluate(() => getComputedStyle(document.getElementById('file-panel-body')).display === 'none')) {
    const t = await waitStableRect(page, '.panel-tab[data-tab="file"]');
    await clickAt(page, t.cx, t.cy, { sel: '.panel-tab[data-tab="file"]' }, { label: 'File 탭' });
    await page.waitForFunction(() => getComputedStyle(document.getElementById('file-panel-body')).display !== 'none');
  }
  const sel = `#layer-panel-body .layer-section[data-sec-id="${id}"] > .layer-section-header .layer-section-name`;
  await page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
  const r = await waitStableRect(page, sel);
  await clickAt(page, r.cx, r.cy, { sel: '.layer-section-name' }, { label: `레이어 ${id}` });
  await page.waitForFunction((i) => document.getElementById(i)?.classList.contains('selected'), id);
  /* 레이어 클릭 = selectSection(sec, true) — 부드러운 스크롤이 «늦게» 시작할 수 있다(T1 둘째 런 실측: 두 번 잰 자리가
     같다가 그 뒤에 2612→2462 로 움직였다) ⇒ 그 함수의 약속(섹션 위 = 창 위 40px)이 설 때까지 기다린다 */
  /* ⚠️«정확히 40px» 만 기다리면 마지막 섹션(sM5)에서 30초를 넘긴 적이 있다(적대 검수 뒤 런 · 꼬리 여백이 그 사이 다시 걷힘).
     ⇒ «40px 에 섰다» 또는 «스크롤이 20 프레임 내리 안 움직이고 섹션 위가 창 안에 있다» 중 먼저 오는 것. */
  await page.evaluate(() => { window.__lsScroll = { st: -1, n: 0 }; });
  await page.waitForFunction((i) => {
    const s = document.getElementById(i), w = document.getElementById('canvas-wrap');
    const d = s.getBoundingClientRect().top - w.getBoundingClientRect().top;
    if (Math.abs(d - 40) <= 1) return true;
    const t = window.__lsScroll;
    if (w.scrollTop === t.st) t.n++; else { t.st = w.scrollTop; t.n = 0; }
    return t.n >= 20 && d >= 30 && d < w.clientHeight - 60;
  }, id, { polling: 'raf' });
}

/* 고른 섹션의 툴바 📝 를 진짜로 눌러 모달을 연다 */
async function openMemoByToolbar(page, id) {
  await clickLayerSection(page, id);
  const sel = `#${id} > .section-toolbar .st-memo-btn`;
  const r = await waitStableRect(page, sel);
  await clickAt(page, r.cx, r.cy, { sel: '.st-memo-btn' }, { label: `📝 ${id}` });
  await page.waitForFunction(() => document.activeElement === document.querySelector('.section-memo-backdrop.open .smp-editor'));
}
async function closeMemo(page) {
  await page.keyboard.press('Escape');
  await page.waitForFunction(() => !document.querySelector('.section-memo-backdrop'));
}

const memoBtnLook = (page, id) => page.evaluate((i) => {
  const b = document.querySelector(`#${i} > .section-toolbar .st-memo-btn`);
  const cs = getComputedStyle(b);
  const path = b.querySelector('svg path');
  return { bg: cs.backgroundColor, dot: getComputedStyle(b, '::after').content, fill: path ? getComputedStyle(path).fill : null };
}, id);

async function openChecklistTab(page) {
  const r = await waitStableRect(page, '.panel-tab[data-tab="checklist"]');
  await clickAt(page, r.cx, r.cy, { sel: '.panel-tab[data-tab="checklist"]' }, { label: '체크리스트 탭' });
  await page.waitForFunction(() => getComputedStyle(document.getElementById('checklist-panel-body')).display !== 'none' && !!document.getElementById('smemo-group'));
}

// ─────────────────────────────────────────────────────────────────────────────

test('A1 ㉮ 📝 단추 — 메모 있으면 주황 바탕·점·채운 종이, 모달로 쓰고 지우면 채움/빈 이 따라 바뀐다', async ({ page }) => {
  const errs = await setup(page);
  await clickLayerSection(page, 'sM1');
  const on = await memoBtnLook(page, 'sM1');
  expect(on.bg, 'sM1(메모 있음) 바탕').toBe(ORANGE_BG);
  expect(on.dot, 'sM1 점').toBe('""');
  expect(on.fill, 'sM1 종이 채움').not.toBe('none');

  await clickLayerSection(page, 'sM2');
  const off = await memoBtnLook(page, 'sM2');
  expect(off.bg, 'sM2(메모 없음) 바탕은 비어 있다').toBe('rgba(0, 0, 0, 0)');
  expect(off.dot, 'sM2 점 없음').toBe('none');
  expect(off.fill, 'sM2 종이 안 채움').toBe('none');

  // 빈 → 채움: 모달에 글을 쳐서 닫는다
  await openMemoByToolbar(page, 'sM2');
  await page.keyboard.type('새 메모');
  await closeMemo(page);
  expect(await page.evaluate(() => document.getElementById('sM2').getAttribute('data-memo'))).toBe('새 메모');
  /* 마우스가 아직 단추 위라 :hover(0.24) → 0.14 로 «넘어가는 중»일 수 있다(.st-btn transition 0.15s · 첫 런 실측 0.153) — 비키고 기다린다 */
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await memoBtnLook(page, 'sM2')).bg, '쓰고 나니 채움').toBe(ORANGE_BG);

  // 채움 → 빈: 다 지우고 닫는다(빈 글 = 속성 삭제 — 제품 규칙)
  await openMemoByToolbar(page, 'sM2');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await closeMemo(page);
  expect(await page.evaluate(() => document.getElementById('sM2').hasAttribute('data-memo'))).toBe(false);
  await page.mouse.move(5, 5);
  await expect.poll(async () => (await memoBtnLook(page, 'sM2')).bg, '지우니 빈').toBe('rgba(0, 0, 0, 0)');
  const off2 = await memoBtnLook(page, 'sM2');
  expect(off2.dot).toBe('none');
  expect(errs, '페이지 오류 0').toEqual([]);
});

test('B1 ㉯ 바깥 탭 — 수 = 메모 섹션 수 · 섹션 왼쪽 바깥 · 배율·높이·이동 뒤에도 자리 · 숨긴 섹션 흐림', async ({ page }) => {
  const errs = await setup(page);
  await expect.poll(() => tabIds(page), '탭 = 메모 있는 섹션(캔버스 순)').toEqual(['sM1', 'sM3', 'sM4']);
  await expect.poll(() => tabPlacementErrors(page), '배율 50% 자리').toEqual([]);
  expect(await page.evaluate(() => {
    const t = document.querySelector('#section-memo-overlay .smemo-tab[data-sec-id="sM4"]');
    return { cls: t.classList.contains('is-hidden-sec'), op: getComputedStyle(t).opacity };
  }), '숨긴 sM4 탭은 흐리다').toEqual({ cls: true, op: '0.45' });

  for (const z of [100, 30]) {
    await page.evaluate((zz) => window.applyZoom(zz), z);
    await expect.poll(() => tabPlacementErrors(page), `배율 ${z}% 자리`).toEqual([]);
  }
  // 높이 변화 — sM1 을 키우면 아래 탭이 따라 내려간다
  await page.evaluate(() => { document.querySelector('#sM1 .gap-block').style.height = '420px'; });
  await expect.poll(() => tabPlacementErrors(page), '높이 변화 뒤 자리').toEqual([]);
  // 섹션 이동 — sM3 을 맨 앞으로
  await page.evaluate(() => { const c = document.getElementById('canvas'); c.insertBefore(document.getElementById('sM3'), document.getElementById('sM1')); });
  await expect.poll(() => tabIds(page), '이동 뒤 차례').toEqual(['sM3', 'sM1', 'sM4']);
  await expect.poll(() => tabPlacementErrors(page), '이동 뒤 자리').toEqual([]);
  // 비활성 변형(display:none) — 자리가 없으니 탭도 없다
  await page.evaluate(() => { document.getElementById('sM4').dataset.variationActive = '0'; });
  await expect.poll(() => tabIds(page), '비활성 변형은 탭 없음').toEqual(['sM3', 'sM1']);
  expect(errs).toEqual([]);
});

test('B2 ㉯ 탭 hover = 메모 미리보기 · 클릭 = 그 섹션 선택 + 메모 창', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => document.getElementById('sM1').scrollIntoView({ block: 'center' }));
  const sel = '#section-memo-overlay .smemo-tab[data-sec-id="sM1"]';
  const r = await waitStableRect(page, sel);
  await page.mouse.move(r.cx, r.cy);
  await page.waitForSelector('.smemo-tip');
  const tip = await page.evaluate(() => ({ name: document.querySelector('.smemo-tip-name').textContent, text: document.querySelector('.smemo-tip-text').textContent, n: document.querySelectorAll('.smemo-tip').length }));
  expect(tip.n).toBe(1);
  expect(tip.name).toBe('01 · 섹션1');
  expect(tip.text, '체크는 ☐/☑ 로').toBe('출처: 쿠팡 1번 컷\n☐ 문구 고치기\n☑ 사진 바꾸기');
  await page.mouse.move(r.cx + 300, r.cy + 300);
  await page.waitForFunction(() => !document.querySelector('.smemo-tip'));

  await clickAt(page, r.cx, r.cy, { sel: '.smemo-tab' }, { label: 'sM1 탭' });
  await page.waitForSelector('.section-memo-backdrop.open');
  const st = await page.evaluate(() => ({
    title: document.querySelector('.smp-title-name').textContent,
    sel: [...document.querySelectorAll('#canvas .section-block.selected')].map(s => s.id),
    tip: document.querySelectorAll('.smemo-tip').length,
  }));
  expect(st).toEqual({ title: '섹션1', sel: ['sM1'], tip: 0 });
  await closeMemo(page);
  expect(await page.evaluate(() => document.getElementById('sM1').getAttribute('data-memo')), '열고 닫기만 = 메모 그대로').toBe(MEMO1);
  expect(errs).toEqual([]);
});

test('B3 ㉯ 표식은 저장본·PNG 클론·HTML 클론 어디에도 없다', async ({ page }) => {
  const errs = await setup(page);
  await expect.poll(() => tabIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  const leak = await page.evaluate(async () => {
    const MARK = '.smemo-tab, .smemo-flash, .smemo-tip, #section-memo-overlay, .layer-memo-ico, #smemo-group';
    const RE = /smemo|section-memo-overlay|layer-memo-ico/;
    const canvas = document.getElementById('canvas');
    const ser = window.getSerializedCanvas();
    const ex = await import('/js/io/export-image.js');
    const png = await ex.prepareCloneForCapture(document.getElementById('sM1'), 860, true);
    const pngN = png.querySelectorAll(MARK).length + (RE.test(png.outerHTML) ? 1 : 0);
    png.remove();
    const cs = await import('/js/io/capture-safety.js');
    const html = canvas.cloneNode(true);
    cs.stripEditorOnlyForCapture(html);
    return {
      inCanvas: canvas.querySelectorAll(MARK).length,
      overlayParent: document.getElementById('section-memo-overlay').parentElement.id,
      serMark: RE.test(ser) ? 1 : 0,
      serMemo: (ser.match(/data-memo=/g) || []).length,
      png: pngN,
      html: html.querySelectorAll(MARK).length + (RE.test(html.outerHTML) ? 1 : 0),
    };
  });
  expect(leak).toEqual({ inCanvas: 0, overlayParent: 'canvas-scaler', serMark: 0, serMemo: 3, png: 0, html: 0 });
  expect(errs).toEqual([]);
});

test('B4 표식·hover·묶음 토글·다시 그리기가 #canvas 를 한 번도 안 건드린다(autoSave 를 안 깨운다)', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  await expect.poll(() => tabIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  /* 스크롤(지연 배경 로드가 #canvas 를 만질 수 있다)은 감시를 걸기 «전»에 끝낸다 — 재는 것은 이 기능의 손길뿐 */
  await page.evaluate(() => document.getElementById('sM3').scrollIntoView({ block: 'center' }));
  const r = await waitStableRect(page, '#section-memo-overlay .smemo-tab[data-sec-id="sM3"]');
  /* ★부팅 1.5초 뒤 한 번 도는 툴바 수화(js/section-memo.js · js/section-protection.js 의 setTimeout 1500)가
     📝·🔒 단추의 onclick/title 을 다시 쓴다 — 이 기능과 무관한 변이다(첫 런에서 실측: 그 둘만 22건).
     ⇒ 그 타이머가 지난 «뒤»에 감시를 건다(시간 조건이지 고정 대기가 아니다). 걸러 내지 않는다 — 재는 창을 옮길 뿐.
     ★타이머는 DOMContentLoaded 에서 건다(section-memo.js 끝 · section-protection.js _init) ⇒ 기준 = DCL 끝 + 1500 + 여유 500.
       (둘째 런에서 «부팅 시작 + 2500» 은 모자랐다 — 같은 22건이 다시 났고, 스택이 _hydrateAllSectionsForMemoBtn 였다.) */
  await page.waitForFunction(() => {
    const nav = performance.getEntriesByType('navigation')[0];
    return !!nav && nav.domContentLoadedEventEnd > 0 && performance.now() > nav.domContentLoadedEventEnd + 2000;
  });
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  await page.evaluate(() => {
    window.__muts = [];
    window.__mo = new MutationObserver(rs => rs.forEach(r => window.__muts.push(r.type + ':' + (r.attributeName || '') + ':' + (r.target.id || r.target.className))));
    window.__mo.observe(document.getElementById('canvas'), { subtree: true, childList: true, attributes: true, characterData: true });
  });
  await page.mouse.move(r.cx, r.cy);
  await page.waitForSelector('.smemo-tip');
  await page.mouse.move(5, 5);
  for (const sel of ['#smemo-group .smemo-group-head', '#smemo-group .smemo-group-head', '#smemo-group .smemo-seg button[data-v="0"]', '#smemo-group .smemo-seg button[data-v="1"]']) {
    const b = await waitStableRect(page, sel);
    await clickAt(page, b.cx, b.cy, { sel }, { label: sel });
  }
  await page.evaluate(() => window.SectionMemoView.refresh());
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  const muts = await page.evaluate(() => { window.__mo.takeRecords().forEach(r => window.__muts.push(r.type)); return window.__muts; });
  expect(muts, '#canvas 변이 0').toEqual([]);
  expect(errs).toEqual([]);
});

test('C1 ㉰ 체크리스트 탭 맨 위 묶음 — 줄 수·차례·번호·미리보기·체크 수 · 접기/펴기 · 이름만', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  const where = await page.evaluate(() => {
    const g = document.getElementById('smemo-group');
    return { parent: g.parentElement.id, next: g.nextElementSibling && g.nextElementSibling.id, prevIsToolbar: !!(g.previousElementSibling && g.previousElementSibling.classList.contains('ck-toolbar')), inList: !!g.closest('#ck-list') };
  });
  expect(where, '자리 = 투두 툴바와 #ck-list 사이(목록 끌어놓기 밖)').toEqual({ parent: 'checklist-panel-body', next: 'ck-list', prevIsToolbar: true, inList: false });
  await expect.poll(() => rowIds(page), '줄 = 메모 섹션 · 캔버스 순').toEqual(['sM1', 'sM3', 'sM4']);
  const look = await page.evaluate(() => ({
    badge: document.querySelector('#smemo-group .smemo-group-badge').textContent,
    nums: [...document.querySelectorAll('#smemo-group .smemo-num')].map(e => e.textContent),
    pv1: document.querySelector('#smemo-group .smemo-item[data-sec-id="sM1"] .smemo-preview').textContent,
    chk1: document.querySelector('#smemo-group .smemo-item[data-sec-id="sM1"] .smemo-chk').textContent,
    chk3: document.querySelectorAll('#smemo-group .smemo-item[data-sec-id="sM3"] .smemo-chk').length,
    dim4: getComputedStyle(document.querySelector('#smemo-group .smemo-item[data-sec-id="sM4"]')).opacity,
    dim1: getComputedStyle(document.querySelector('#smemo-group .smemo-item[data-sec-id="sM1"]')).opacity,
    clamp: getComputedStyle(document.querySelector('#smemo-group .smemo-preview')).webkitLineClamp,
  }));
  expect(look).toEqual({ badge: '3 / 5', nums: ['01', '03', '04'], pv1: '출처: 쿠팡 1번 컷\n☐ 문구 고치기\n☑ 사진 바꾸기', chk1: '1/2', chk3: 0, dim4: '0.45', dim1: '1', clamp: '2' });

  const head = await waitStableRect(page, '#smemo-group .smemo-group-head');
  await clickAt(page, head.cx, head.cy, { sel: '.smemo-group-head' }, { label: '묶음 접기' });
  await expect.poll(() => rowIds(page), '접으면 0줄').toEqual([]);
  expect(await page.evaluate(() => document.querySelector('#smemo-group .smemo-group-badge').textContent), '접어도 개수는 보인다').toBe('3 / 5');
  await clickAt(page, head.cx, head.cy, { sel: '.smemo-group-head' }, { label: '묶음 펴기' });
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM3', 'sM4']);

  const nameOnly = await waitStableRect(page, '#smemo-group .smemo-seg button[data-v="0"]');
  await clickAt(page, nameOnly.cx, nameOnly.cy, { sel: '.smemo-seg button' }, { label: '이름만' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#smemo-group .smemo-preview').length), '이름만 = 미리보기 0').toBe(0);
  expect(await rowIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  // 투두 패널이 다시 그려져도(innerHTML 통째 갈이) 묶음이 같은 자리로 돌아온다
  await page.evaluate(() => window.renderChecklistPanel());
  await expect.poll(() => page.evaluate(() => { const g = document.getElementById('smemo-group'); return !!g && g.nextElementSibling?.id === 'ck-list'; })).toBe(true);
  expect(errs).toEqual([]);
});

test('C2 ㉰ 줄 클릭 = 선택 + 섹션 위가 캔버스 창 위 40px + 번쩍', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  await page.evaluate(() => { document.getElementById('canvas-wrap').scrollTop = 0; });
  const row = await waitStableRect(page, '#smemo-group .smemo-item[data-sec-id="sM3"] .smemo-name');
  await clickAt(page, row.cx, row.cy, { sel: '.smemo-item' }, { label: 'sM3 줄' });
  await page.waitForFunction(() => document.getElementById('sM3').classList.contains('selected'));
  expect(await page.evaluate(() => !!document.querySelector('#section-memo-overlay .smemo-flash')), '번쩍(덧층)').toBe(true);
  await expect.poll(() => page.evaluate(() => Math.round(document.getElementById('sM3').getBoundingClientRect().top - document.getElementById('canvas-wrap').getBoundingClientRect().top)), '섹션 위 = 창 위 40px').toBe(40);
  expect(await page.evaluate(() => ({
    sel: [...document.querySelectorAll('#canvas .section-block.selected')].map(s => s.id),
    rowSel: [...document.querySelectorAll('#smemo-group .smemo-item--on')].map(r => r.dataset.secId),
    flashInCanvas: document.querySelectorAll('#canvas .smemo-flash').length,
    secFlashCls: /flash/.test(document.getElementById('sM3').className),
  }))).toEqual({ sel: ['sM3'], rowSel: ['sM3'], flashInCanvas: 0, secFlashCls: false });
  expect(errs).toEqual([]);
});

test('C3 ㉰ 현재 페이지만 — 새 페이지에선 0줄·탭 0, 돌아오면 그대로', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  const firstPage = await page.evaluate(() => JSON.parse(window.serializeProject()).currentPageId);
  expect(firstPage, '전제: 지금 페이지 id 가 있다').toBeTruthy();
  await page.evaluate(() => window.addPage());
  await page.waitForFunction(() => document.querySelectorAll('#canvas .section-block').length === 0);
  await expect.poll(() => rowIds(page), '새 페이지 = 0줄').toEqual([]);
  await expect.poll(() => tabIds(page), '새 페이지 = 탭 0').toEqual([]);
  expect(await page.evaluate(() => ({ badge: document.querySelector('#smemo-group .smemo-group-badge').textContent, empty: document.querySelectorAll('#smemo-group .smemo-empty').length }))).toEqual({ badge: '0 / 0', empty: 1 });
  await page.evaluate((p) => window.switchPage(p), firstPage);
  await expect.poll(() => rowIds(page), '돌아오면 그대로').toEqual(['sM1', 'sM3', 'sM4']);
  await expect.poll(() => tabIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  expect(errs).toEqual([]);
});

test('D1 ㉱ 레이어 섹션 행 📝 — 있음/없음 · 생기면 붙고 · 재빌드에도 남는다', async ({ page }) => {
  const errs = await setup(page);
  const icons = () => page.evaluate(() => [...document.querySelectorAll('#layer-panel-body .layer-section[data-sec-id]')]
    .map(ls => ls.dataset.secId + ':' + (ls.querySelector(':scope > .layer-section-header > .layer-memo-ico') ? 1 : 0)));
  await expect.poll(icons).toEqual(['sM1:1', 'sM2:0', 'sM3:1', 'sM4:1', 'sM5:0']);
  expect(await page.evaluate(() => {
    const ico = document.querySelector('#layer-panel-body .layer-section[data-sec-id="sM1"] .layer-memo-ico');
    return { nextIsEye: !!ico.nextElementSibling?.classList.contains('layer-eye-btn'), vis: getComputedStyle(ico).display };
  }), '눈 단추 앞 · 보인다').toEqual({ nextIsEye: true, vis: 'flex' });
  await openMemoByToolbar(page, 'sM5');
  await page.keyboard.type('x');
  await closeMemo(page);
  await expect.poll(icons, '메모 생기면 붙는다').toEqual(['sM1:1', 'sM2:0', 'sM3:1', 'sM4:1', 'sM5:1']);
  await page.evaluate(() => window.buildLayerPanel());
  await expect.poll(icons, '재빌드에도').toEqual(['sM1:1', 'sM2:0', 'sM3:1', 'sM4:1', 'sM5:1']);
  expect(errs).toEqual([]);
});

test('E1 메모를 지우면 탭·목록·레이어에서 빠진다(MCP 길 setSectionMemo 와 모달 길 둘 다)', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  await page.evaluate(() => window.setSectionMemo('sM3', ''));
  await expect.poll(() => tabIds(page)).toEqual(['sM1', 'sM4']);
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM4']);
  expect(await page.evaluate(() => document.querySelector('#smemo-group .smemo-group-badge').textContent)).toBe('2 / 5');
  // 모달 길 — sM1 을 다 지운다
  await openMemoByToolbar(page, 'sM1');
  await page.keyboard.press('ControlOrMeta+a');
  await page.keyboard.press('Backspace');
  await closeMemo(page);
  await expect.poll(() => tabIds(page)).toEqual(['sM4']);
  await expect.poll(() => rowIds(page)).toEqual(['sM4']);
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#layer-panel-body .layer-memo-ico').length)).toBe(1);
  expect(errs).toEqual([]);
});

test('T1 ★투두 무접촉 — 묶음 열고 닫기·이름만·메모 추가/삭제·줄 클릭 전후 투두 항목·저장 키·값이 같다', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    window._ckItems = [
      { id: 'ck_a', text: '상세 1차 시안 공유', done: false, sectionId: null },
      { id: 'ck_b', text: '가격표 숫자 확인', done: false, sectionId: 'cs_1', x: 120, y: 340 },
      { id: 'ck_c', text: '폰트 교체', done: true, sectionId: 'cs_1' },
    ];
    window._ckSections = [{ id: 'cs_1', name: '현빈 메모', collapsed: false }];
    window.__ckRefs = [window._ckItems, window._ckSections];
    window.renderChecklistPanel();
  });
  await openChecklistTab(page);
  const snap = () => page.evaluate(() => {
    const proj = JSON.parse(window.serializeProject());
    const ls = Object.keys(localStorage).sort().map(k => [k, localStorage.getItem(k)]);
    return {
      items: JSON.stringify(window._ckItems),
      sections: JSON.stringify(window._ckSections),
      sameRefs: window._ckItems === window.__ckRefs[0] && window._ckSections === window.__ckRefs[1],
      proj: JSON.stringify([proj.checklistItems, proj.checklistSections]),
      lsKeys: ls.map(([k]) => k).join('|'),
      lsTodo: JSON.stringify(ls.filter(([k, v]) => /check|todo|ck_/i.test(k) || /checklist/i.test(v || ''))),
      todoDom: [...document.querySelectorAll('#ck-list .ck-item:not(.ck-item--ephemeral), #ck-list .ck-section-header')].map(e => (e.querySelector('.ck-item-text, .ck-section-name') || e).textContent.trim()),
      pins: document.querySelectorAll('#todo-pin-overlay .todo-pin').length,
    };
  });
  const before = await snap();
  expect(before.todoDom, '전제: 투두 3항목 + 묶음 1').toEqual(['상세 1차 시안 공유', '현빈 메모', '가격표 숫자 확인', '폰트 교체']);
  expect(before.pins, '전제: 핀 1').toBe(1);

  const press = async (sel, label) => { const b = await waitStableRect(page, sel); await clickAt(page, b.cx, b.cy, { sel }, { label }); };
  await press('#smemo-group .smemo-group-head', '묶음 접기');
  await press('#smemo-group .smemo-group-head', '묶음 펴기');
  await press('#smemo-group .smemo-seg button[data-v="0"]', '이름만');
  await press('#smemo-group .smemo-seg button[data-v="1"]', '미리보기');
  await press('#smemo-group .smemo-item[data-sec-id="sM3"] .smemo-name', 'sM3 줄');
  // 메모 추가(모달) · 삭제(MCP 길)
  await openMemoByToolbar(page, 'sM2');
  await page.keyboard.type('투두와 무관한 메모');
  await closeMemo(page);
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM2', 'sM3', 'sM4']);
  await openChecklistTab(page);
  await page.evaluate(() => window.setSectionMemo('sM2', ''));
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM3', 'sM4']);

  const after = await snap();
  expect(after, '투두 무접촉 — 항목·묶음·프로젝트 JSON·localStorage·화면 줄·핀 모두 같다').toEqual(before);
  expect(after.sameRefs, '_ckItems/_ckSections 배열을 갈아 끼우지도 않았다').toBe(true);
  expect(errs).toEqual([]);
});

/* ── 적대 검수(2026-10-26) 뒤 더한 칸 ─────────────────────────────────────────
 *   F2 ⌘Z/⌘⇧Z(restoreSnapshot = #canvas.innerHTML 통째 갈이) 뒤에도 줄·탭 클릭이 «산» 섹션을 고른다
 *   F3 높이만 30번 바꿔도 탭 노드를 새로 안 만든다(기존 탭 재사용) · 바뀐 것 없는 refresh 는 덧층에 쓰기 0
 *   F4 묶음이 있어도 투두 조작(체크박스 클릭 · 묶음 접기 · 항목 추가)이 그대로 되고 진척 % 가 따라간다
 * 양성대조: F2·F3 = 2faf4441(고치기 전 판) 사본에서 빨강 · F4 = 변이 M3b(묶음이 #ck-list 클릭을 삼킴)에서 빨강. */

test('F2 ⌘Z·⌘⇧Z 로 캔버스가 통째로 갈린 뒤에도 줄 클릭·탭 클릭이 산 섹션을 고른다', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  await expect.poll(() => rowIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  await page.evaluate(() => {
    window.pushHistory('t306-F2 앞');
    window.setSectionBg(document.getElementById('sM3'), '#ffeeaa');
    window.pushHistory('t306-F2 배경');
  });
  for (const step of ['undo', 'redo']) {
    await page.evaluate((st) => { window.__old = [...document.querySelectorAll('#canvas .section-block')]; window[st](); }, step);
    await page.waitForFunction(() => { const s = document.getElementById('sM3'); return !!s && !window.__old.includes(s); });
    const bg = await page.evaluate(() => document.getElementById('sM3').style.backgroundColor);
    expect(bg, `전제: ${step} 가 먹었다`).toBe(step === 'undo' ? '' : 'rgb(255, 238, 170)');
    await page.evaluate(() => window.deselectAll());

    // 줄 클릭 → 산 sM3 선택
    const row = await waitStableRect(page, '#smemo-group .smemo-item[data-sec-id="sM3"] .smemo-name');
    await clickAt(page, row.cx, row.cy, { sel: '.smemo-item' }, { label: `${step} 뒤 sM3 줄` });
    await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#canvas .section-block.selected')].map(s => s.id)), `${step} 뒤 줄 클릭 = 산 sM3 선택`).toEqual(['sM3']);

    // 탭 클릭 → 산 sM1 선택 + 메모 창
    await page.evaluate(() => { window.deselectAll(); document.getElementById('sM1').scrollIntoView({ block: 'center' }); });
    const tab = await waitStableRect(page, '#section-memo-overlay .smemo-tab[data-sec-id="sM1"]');
    await clickAt(page, tab.cx, tab.cy, { sel: '.smemo-tab' }, { label: `${step} 뒤 sM1 탭` });
    await page.waitForSelector('.section-memo-backdrop.open');
    expect(await page.evaluate(() => ({
      sel: [...document.querySelectorAll('#canvas .section-block.selected')].map(s => s.id),
      live: document.getElementById('sM1').classList.contains('selected'),
      title: document.querySelector('.smp-title-name').textContent,
    })), `${step} 뒤 탭 클릭 = 산 sM1 선택 + 메모 창`).toEqual({ sel: ['sM1'], live: true, title: '섹션1' });
    await closeMemo(page);
  }
  expect(errs).toEqual([]);
});

test('F3 높이만 30번 바뀌어도 탭 노드를 새로 안 만든다 · 바뀐 것 없는 refresh 는 덧층 쓰기 0', async ({ page }) => {
  const errs = await setup(page);
  await expect.poll(() => tabIds(page)).toEqual(['sM1', 'sM3', 'sM4']);
  await expect.poll(() => tabPlacementErrors(page)).toEqual([]);
  await page.evaluate(() => {
    window.__tabs0 = [...document.querySelectorAll('#section-memo-overlay .smemo-tab')];
    window.__ovRec = { added: 0, removed: 0, attrs: 0 };
    window.__ovMo = new MutationObserver(rs => rs.forEach(r => {
      if (r.type === 'childList') {
        r.addedNodes.forEach(n => { if (n.classList && n.classList.contains('smemo-tab')) window.__ovRec.added++; });
        r.removedNodes.forEach(n => { if (n.classList && n.classList.contains('smemo-tab')) window.__ovRec.removed++; });
      } else window.__ovRec.attrs++;
    }));
    window.__ovMo.observe(document.getElementById('section-memo-overlay'), { childList: true, subtree: true, attributes: true });
  });
  for (let k = 1; k <= 30; k++) {
    await page.evaluate((h) => { document.querySelector('#sM1 .gap-block').style.height = h + 'px'; }, 100 + k * 7);
    await expect.poll(() => tabPlacementErrors(page), `높이 ${k}번째 뒤 자리`).toEqual([]);
  }
  const r1 = await page.evaluate(() => ({
    ...window.__ovRec,
    same: [...document.querySelectorAll('#section-memo-overlay .smemo-tab')].every((t, i) => t === window.__tabs0[i]),
  }));
  expect(r1.added, '탭 노드 추가 0(기존 탭 재사용)').toBe(0);
  expect(r1.removed, '탭 노드 제거 0').toBe(0);
  expect(r1.same, '같은 탭 노드 셋').toBe(true);
  expect(r1.attrs, '자리 고치기는 일어났다(전제)').toBeGreaterThan(0);

  await page.evaluate(() => { window.__ovMo.takeRecords(); window.__ovRec = { added: 0, removed: 0, attrs: 0 }; window.SectionMemoView.refresh(); window.SectionMemoView.refresh(); });
  await page.evaluate(() => new Promise(res => requestAnimationFrame(() => requestAnimationFrame(res))));
  const r2 = await page.evaluate(() => { window.__ovMo.takeRecords().forEach(() => window.__ovRec.attrs++); return window.__ovRec; });
  expect(r2, '바뀐 것 없는 refresh = 덧층 쓰기 0').toEqual({ added: 0, removed: 0, attrs: 0 });
  expect(errs).toEqual([]);
});

test('F4 묶음이 있어도 투두 조작이 그대로 — 체크박스 클릭 · 묶음 접기 · 항목 추가 · 진척 %', async ({ page }) => {
  const errs = await setup(page);
  await page.evaluate(() => {
    window._ckItems = [
      { id: 'ck_a', text: '상세 1차 시안 공유', done: false, sectionId: null },
      { id: 'ck_b', text: '가격표 숫자 확인', done: false, sectionId: 'cs_1' },
      { id: 'ck_c', text: '폰트 교체', done: true, sectionId: 'cs_1' },
    ];
    window._ckSections = [{ id: 'cs_1', name: '현빈 메모', collapsed: false }];
  });
  await openChecklistTab(page);
  const prog = () => page.evaluate(() => [...document.querySelectorAll('#checklist-panel-body .ck-progress-label span')].map(e => e.textContent).join(' · '));
  expect(await prog(), '전제').toBe('1 / 3 · 33%');

  // ① 체크박스 진짜 클릭
  const cb = await waitStableRect(page, '#ck-list .ck-item[data-id="ck_a"] .ck-check');
  await clickAt(page, cb.cx, cb.cy, { sel: '.ck-check' }, { label: 'ck_a 체크' });
  await expect.poll(prog, '체크하면 진척이 오른다').toBe('2 / 3 · 67%');
  expect(await page.evaluate(() => window._ckItems.find(i => i.id === 'ck_a').done)).toBe(true);

  // ② 투두 묶음(cs_1) 접기
  const sh = await waitStableRect(page, '#ck-list .ck-section-header[data-section-id="cs_1"] .ck-section-name');
  await clickAt(page, sh.cx, sh.cy, { sel: '.ck-section-header' }, { label: 'cs_1 접기' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#ck-list .ck-item[data-section-id="cs_1"]').length), '접으면 그 묶음 항목 0').toBe(0);
  expect(await page.evaluate(() => window._ckSections[0].collapsed)).toBe(true);

  // ③ 항목 추가 — 자리표시 줄 더블클릭 → 치고 Enter
  const ph = await waitStableRect(page, '#ck-list .ck-item--placeholder');
  await clickAt(page, ph.cx, ph.cy, { sel: '.ck-item--placeholder' }, { label: '자리표시 더블클릭', dbl: true });
  await page.waitForFunction(() => document.activeElement && document.activeElement.classList.contains('ck-inline-input'));
  await page.keyboard.type('새 할 일');
  await page.keyboard.press('Enter');
  await expect.poll(() => page.evaluate(() => window._ckItems.map(i => i.text)), '항목이 저장됐다').toContain('새 할 일');
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#ck-list .ck-item-text')].map(e => e.textContent)), '목록에 보인다').toContain('새 할 일');
  /* ★진척 줄은 «패널 통째 그리기»(renderChecklistPanel)에서만 다시 센다 — 항목 추가 commit 은 _renderList 만 부른다
     (js/checklist-panel.js 의 기존 동작 · 바닥 8608bb13 도 같다 · 이 기능은 안 건드렸다). 탭을 다시 열어 센다. */
  await openChecklistTab(page);
  await expect.poll(prog, '항목이 늘면 진척 분모가 는다').toBe('2 / 4 · 50%');
  // 묶음은 그 사이 내내 제자리
  expect(await page.evaluate(() => document.getElementById('smemo-group')?.nextElementSibling?.id)).toBe('ck-list');
  expect(errs).toEqual([]);
});

test('C1b ㉰ 숨은 섹션 줄 흐림 — 눈 끔 · 숨은 시안(술어는 js/variation-visibility.js 다리로 부른다 · ⑰ V4)', async ({ page }) => {
  const errs = await setup(page);
  await openChecklistTab(page);
  const rowCls = (id) => page.evaluate((id) => { const r = document.querySelector(`#smemo-group .smemo-item[data-sec-id="${id}"]`); return r ? r.classList.contains('is-hidden-sec') : null; }, id);
  expect(await page.evaluate(() => typeof window.VariationVisibility?.isHiddenVariationSection), '전제: 술어 다리가 섰다').toBe('function');
  // 장면: sM4 = 눈 끔(setup) · sM3 = 보이는 메모 섹션 → 숨은 시안으로 바꿔 본다
  await expect.poll(() => rowCls('sM4'), '눈 끔 줄 = 흐림(setup 의 sM4)').toBe(true);
  await expect.poll(() => rowCls('sM3'), '전제: sM3 줄 보통').toBe(false);
  await page.evaluate(() => { document.getElementById('sM3').dataset.variationActive = '0'; });
  await expect.poll(() => rowCls('sM3'), '숨은 시안 줄 = 흐림').toBe(true);
  await page.evaluate(() => { document.getElementById('sM3').dataset.variationActive = '1'; });
  await expect.poll(() => rowCls('sM3'), '활성으로 돌리면 보통').toBe(false);
  expect(errs).toEqual([]);
});
