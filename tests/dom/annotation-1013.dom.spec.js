/* annotation-1013 — 스티커패널 어노테이션 블럭 (1013t1A1·A2·A3).
 *
 * ★무엇을 잠그나
 *   AN1 만들면 «바로» 좌측 레이어에 「Annotation」 행(아이콘·Sticker 태그)이 선다 (A1)
 *   AN2 그 행을 누르면 어노테이션 패널 + 점 핸들이 뜬다 (A1)
 *   AN3 지우면 «죽은 행»이 안 남는다 (A1)
 *   AN4 기본 글자 크기 24 (dataset · 그려진 크기) · 프리셋을 눌러도 24 그대로 (A2)
 *   AN5 우측 패널에 글 입력칸이 없고, 캔버스 더블클릭으로 글을 고친다 (A2) · 마침 = ⌘Enter (1013t2C6)
 *   AN6 고른 라벨을 끌면 라벨만 옮겨진다(dataset.labelDx/Dy · 선 점 불변) (A3)
 *   AN7 끌기 한 번 = ⌘Z 한 걸음 · ⌘⇧Z 로 다시 (A3)
 *   AN8 다시 그려도(rebindAll) 오프셋이 남고 라벨 style 이 라이브와 같다 (A3)
 *   AN9 패널 숫자칸으로 옮기기 · 「자동 배치로 되돌리기」(없으면 꺼짐) (A3)
 *   AN10 «고른 라벨» 표식은 저장 직렬화에 안 실린다 (A3)
 *   AN11 다시 그려도(rebindAll — 로드·⌘Z 복원이 같이 쓰는 길) 라벨 테두리 스타일이 남는다 (A3-pre)
 *   AN12(1017t1h4) 라벨 위치 절에 「한 번 더 누르면」 힌트가 없다(패널이 뜬 전제에서)
 *   AN13(1017t1h6) 라벨 위치 절 — span.prop-label 0개 · dx/dy/되돌리기 입력칸은 살아있다
 *   AN14(1017t1h7) 프리셋 드롭다운 — option 수(정의 자리 파생) · 값 리터럴 · .prop-preset-btn 0 · 공용 CSS/다른 패널 무접촉
 * ★만드는 길은 «사람 손» 그대로 — 펜 단추 → 메뉴 「Annotation」 → 섹션 두 점 → Enter → Esc.
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const { bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt, hitAt } = require('./_click-at.js');
const { expectOneUndoStep } = require('./_history-step.js');

const SEC = '[id="secA"]';

/* 빈 섹션 하나. */
async function setup(page) {
  await page.evaluate(() => {
    const canvas = document.getElementById('canvas');
    canvas.innerHTML = '<div class="section-block" id="secA" style="position:relative;height:420px;background:#f4f4f6"><div class="section-inner"></div></div>';
    window.rebindAll?.();
    window.applyPagePadX?.(window.state?.pageSettings?.padX);   // 복원(applyPageSettings)이 하는 것과 같게 — ⌘Z 비교가 «셋업 차이»로 갈리지 않게
    window.buildLayerPanel?.();
  });
}

const annotCount = (page) => page.evaluate(() => document.querySelectorAll('#secA .annotation-block').length);
const layerRows = (page) => page.evaluate(() => document.querySelectorAll('#layer-panel-body .layer-item').length);

/* 펜 단추 → 「Annotation」 → 두 점 → Enter(라벨 편집 진입) → Esc(확정·펜 종료). 돌려줌: 만든 블럭 id. */
async function makeAnnotation(page, { p1 = [0.2, 0.3], p2 = [0.45, 0.6] } = {}) {
  const before = await annotCount(page);
  await page.click('#fp-pen-btn');
  await page.click('#fp-pen-menu .fp-menu-item:text-is("Annotation")');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), '★전제: 펜 모드가 켜졌다').toBe(true);
  const r = await waitStableRect(page, SEC);
  await clickAt(page, r.left + r.width * p1[0], r.top + r.height * p1[1], { sel: SEC }, { label: '첫 점' });
  await clickAt(page, r.left + r.width * p2[0], r.top + r.height * p2[1], { sel: SEC }, { label: '둘째 점' });
  await page.keyboard.press('Enter');
  await expect.poll(() => annotCount(page), 'Enter 로 어노테이션 하나가 생겼다').toBe(before + 1);
  await expect.poll(() => page.evaluate(() => document.activeElement?.classList?.contains('annot-label')), '생성 직후 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate(() => document.body.classList.contains('pen-mode')), 'Esc 로 펜 모드 종료').toBe(false);
  return page.evaluate(() => { const all = document.querySelectorAll('#secA .annotation-block'); return all[all.length - 1].id; });
}

const rowOf = (page, id) => page.evaluate((id) => {
  const it = [...document.querySelectorAll('#layer-panel-body .layer-item')].find(i => i._dragTarget?.id === id);
  if (!it) return null;
  return { type: it.dataset.layerType, name: it.querySelector('.layer-item-name')?.textContent, tag: it.querySelector('.layer-item-type')?.textContent,
    icon: !!it.querySelector('svg.layer-item-icon'), active: it.classList.contains('active') };
}, id);

test('AN1 만들면 바로 레이어에 「Annotation」 행이 선다 (아이콘 · Sticker 태그)', async ({ page }) => {
  const errs = await bootApp(page);
  await setup(page);
  expect(await annotCount(page), '★전제: 어노테이션 0').toBe(0);
  const rows0 = await layerRows(page);
  const id = await makeAnnotation(page);
  await expect.poll(() => rowOf(page, id), '만든 직후(다른 동작 없이) 행이 있다').toEqual({ type: 'annotation', name: 'Annotation', tag: 'Sticker', icon: true, active: false });
  expect(await layerRows(page), '행 수 = 전 + 1').toBe(rows0 + 1);
  expect(errs).toEqual([]);
});

test('AN2 레이어 행을 누르면 어노테이션 패널 + 점 핸들이 뜬다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await expect.poll(() => rowOf(page, id)).not.toBeNull();
  expect(await page.evaluate(() => document.querySelectorAll('.annot-handle').length), '★전제: 누르기 전 핸들 0').toBe(0);
  const rowSel = '#layer-panel-body .layer-item[data-layer-type="annotation"]';
  const rr = await waitStableRect(page, rowSel);
  await clickAt(page, rr.cx, rr.cy, { sel: rowSel }, { label: '레이어 행' });
  await expect.poll(() => page.evaluate((id) => {
    const b = document.getElementById(id);
    return { sel: b.classList.contains('selected'), handles: b.querySelectorAll('.annot-handle').length,
      panel: !!document.querySelector('#panel-right [data-prop-panel="annotation"]') };
  }, id), '선택 + 핸들 2 + 어노테이션 패널').toEqual({ sel: true, handles: 2, panel: true });
  expect((await rowOf(page, id)).active, '그 행이 켜졌다').toBe(true);
});

test('AN3 지우면 레이어에 죽은 행이 안 남는다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await expect.poll(() => rowOf(page, id)).not.toBeNull();
  const lr = await waitStableRect(page, `[id="${id}"] .annot-label`);
  await clickAt(page, lr.cx, lr.cy, { sel: `[id="${id}"] .annot-label` }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '★전제: 캔버스에서 골랐다').toBe(true);
  await page.keyboard.press('Backspace');
  await expect.poll(() => annotCount(page), 'Backspace 로 지워졌다').toBe(0);
  await expect.poll(() => page.evaluate(() => [...document.querySelectorAll('#layer-panel-body .layer-item')].filter(i => i._dragTarget && !i._dragTarget.isConnected).length),
    '지운 블럭을 가리키는 행 0').toBe(0);
  expect(await rowOf(page, id), '그 블럭의 행이 없다').toBeNull();
});

/* 캔버스에서 라벨을 눌러 고른다(진짜 마우스). */
async function selectByLabel(page, id) {
  const sel = `[id="${id}"] .annot-label`;
  const lr = await waitStableRect(page, sel);
  await clickAt(page, lr.cx, lr.cy, { sel }, { label: '라벨' });
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).classList.contains('selected')
    && !!document.querySelector('#panel-right [data-prop-panel="annotation"]'), id), '★전제: 골랐고 어노테이션 패널이 떴다').toBe(true);
  return lr;
}

test('AN4 기본 글자 크기 24 — 만든 직후 · 프리셋을 눌러도 그대로', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  const fs = () => page.evaluate((id) => {
    const b = document.getElementById(id); const l = b.querySelector('.annot-label');
    return { data: b.dataset.labelFontSize, drawn: getComputedStyle(l).fontSize, panel: document.getElementById('annot-font-size-num')?.value ?? null };
  }, id);
  expect((await fs()).data, '만든 직후 dataset').toBe('24');
  expect((await fs()).drawn, '만든 직후 그려진 크기').toBe('24px');
  await selectByLabel(page, id);
  expect((await fs()).panel, '패널 「크기」 칸').toBe('24');
  const before = await page.evaluate((id) => document.getElementById(id).dataset.strokeColor, id);
  await page.selectOption('#panel-right #annot-preset-select', '0');
  await expect.poll(() => page.evaluate((id) => document.getElementById(id).dataset.strokeColor, id), '★전제: 프리셋이 먹었다(선 색이 바뀜)').not.toBe(before);
  expect(await fs(), '프리셋 뒤에도 24').toEqual({ data: '24', drawn: '24px', panel: '24' });
});

test('AN5 우측 패널에 글 입력칸이 없다 — 글은 캔버스 더블클릭으로 고친다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  const lr = await selectByLabel(page, id);
  expect(await page.evaluate(() => ({ ta: document.querySelectorAll('#panel-right #annot-text, #panel-right [data-prop-panel="annotation"] ~ .prop-section textarea').length,
    hint: [...document.querySelectorAll('#panel-right .prop-hint')].some(h => h.textContent.includes('더블클릭')) })), '입력칸 0 · 안내 한 줄').toEqual({ ta: 0, hint: true });
  await page.mouse.dblclick(lr.cx, lr.cy);
  await expect.poll(() => page.evaluate((id) => { const l = document.querySelector(`[id="${id}"] .annot-label`); return l.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, id),
    '더블클릭으로 라벨 편집에 들어갔다').toBe(true);
  await page.keyboard.type('캔버스입력');
  await page.keyboard.press('Meta+Enter');   // ★1013t2C6 — Enter 는 이제 줄바꿈이다. 마침 = ⌘Enter(스텝·카드 블럭과 같은 규약)
  await expect.poll(() => page.evaluate((id) => { const b = document.getElementById(id); return { data: b.dataset.text, drawn: b.querySelector('.annot-label').textContent, ce: b.querySelector('.annot-label').getAttribute('contenteditable') }; }, id),
    '캔버스에서 쓴 글이 데이터·화면에 들어갔다').toEqual({ data: '캔버스입력', drawn: '캔버스입력', ce: 'false' });
});

/* 저장 → 다시 불러오기와 같은 길: 직렬화한 캔버스를 다시 넣고 rebindAll. */
const reloadCanvas = (page) => page.evaluate(() => {
  const c = document.getElementById('canvas');
  c.innerHTML = window.getSerializedCanvas();
  window.rebindAll();
});

test('AN11 다시 그려도 라벨 테두리 «대시»가 남는다 (rebindAll 이 dataset 을 전부 읽는다)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  await page.click('#annot-border-style-group .prop-align-btn[data-style="dashed"]');
  const read = () => page.evaluate((id) => { const b = document.getElementById(id); const l = b.querySelector('.annot-label');
    return { data: b.dataset.labelBorderStyle, drawn: getComputedStyle(l).borderTopStyle, css: l.style.cssText }; }, id);
  const live = await read();
  expect([live.data, live.drawn], '★전제: 패널에서 대시가 먹었다').toEqual(['dashed', 'dashed']);
  await reloadCanvas(page);
  const after = await read();
  expect([after.data, after.drawn], '다시 그린 뒤에도 대시').toEqual(['dashed', 'dashed']);
  expect(after.css, '다시 그린 라벨 style(정규화) = 라이브').toBe(live.css);
});

const labelSel = (id) => `[id="${id}"] .annot-label`;
const labelState = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); const l = b.querySelector('.annot-label'); const r = l.getBoundingClientRect();
  return { dx: b.dataset.labelDx ?? null, dy: b.dataset.labelDy ?? null, points: b.dataset.points, translate: l.style.translate,
    picked: l.classList.contains('annot-cell-selected'), x: r.left, y: r.top, css: l.style.cssText };
}, id);

/* 고른다(라벨 클릭) → 한 번 더 누른다(안 움직임) → 라벨이 «골라졌다». */
async function pickLabel(page, id) {
  await selectByLabel(page, id);
  const lr = await waitStableRect(page, labelSel(id));
  await clickAt(page, lr.cx, lr.cy, { sel: labelSel(id) }, { label: '라벨 한 번 더' });
  await expect.poll(async () => (await labelState(page, id)).picked, '한 번 더 누르면 라벨이 골라진다').toBe(true);
  return lr;
}

/* 라벨을 진짜 마우스로 (+DX, +DY) «캔버스 px» 만큼 끈다(화면 px = 캔버스 px × 배율). */
const DX = 40, DY = 20;
async function dragLabel(page, id, lr) {
  const z = await page.evaluate(() => (window.currentZoom || 40) / 100);
  expect(Number.isFinite(z) && z > 0, `★전제: 배율이 수다(${z})`).toBe(true);
  const hit = await hitAt(page, lr.cx, lr.cy);
  expect(hit && /annot-label/.test(hit.cls), `★전제: 누르는 점이 라벨 위다(${JSON.stringify(hit)})`).toBe(true);
  await page.mouse.move(lr.cx, lr.cy);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) await page.mouse.move(lr.cx + DX * z * i / 8, lr.cy + DY * z * i / 8);
  await page.mouse.up();
  return z;
}

test('AN6 고른 라벨을 끌면 라벨만 옮겨진다 — dataset.labelDx/Dy · 화면 이동량 · 선 점 불변', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  const lr = await pickLabel(page, id);
  const s0 = await labelState(page, id);
  expect([s0.dx, s0.dy, s0.translate], '★전제: 오프셋 없음').toEqual([null, null, '']);
  const z = await dragLabel(page, id, lr);
  await expect.poll(async () => { const s = await labelState(page, id); return [s.dx, s.dy]; }, '놓으면 dataset 에 오프셋').toEqual([String(DX), String(DY)]);
  const s1 = await labelState(page, id);
  expect(s1.translate, '그려진 translate').toBe(`${DX}px ${DY}px`);
  expect(Math.abs((s1.x - s0.x) - DX * z) <= 1 && Math.abs((s1.y - s0.y) - DY * z) <= 1, `라벨이 화면에서 (${DX},${DY})×배율 만큼 움직였다: Δ=(${s1.x - s0.x},${s1.y - s0.y}) z=${z}`).toBe(true);
  expect(s1.points, '선의 점(마지막 점 포함)은 그대로 — 라벨만 떨어진다').toBe(s0.points);
  expect(await page.evaluate((id) => document.getElementById(id).classList.contains('selected'), id), '끈 뒤에도 선택 유지').toBe(true);
});

test('AN7 라벨 끌기 한 번 = ⌘Z 한 걸음 · ⌘⇧Z 로 다시', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  const lr = await pickLabel(page, id);
  const s0 = await labelState(page, id);
  const r = await expectOneUndoStep(page, () => dragLabel(page, id, lr), '어노테이션 라벨 위치');
  expect(r.topAction, '끝 표본 이름').toBe('어노테이션 라벨 위치');
  const u = await labelState(page, id);
  expect([u.dx, u.dy, u.translate], '⌘Z 뒤 오프셋 없음').toEqual([null, null, '']);
  expect(Math.abs(u.x - s0.x) <= 1 && Math.abs(u.y - s0.y) <= 1, `⌘Z 뒤 라벨 원위치 Δ=(${u.x - s0.x},${u.y - s0.y})`).toBe(true);
  await page.keyboard.press('Meta+Shift+z');
  await expect.poll(async () => { const s = await labelState(page, id); return [s.dx, s.dy, s.translate]; }, '⌘⇧Z 한 번에 다시').toEqual([String(DX), String(DY), `${DX}px ${DY}px`]);
});

test('AN8 다시 그려도(rebindAll) 오프셋이 남고 라벨 style 이 라이브와 같다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  const lr = await pickLabel(page, id);
  await dragLabel(page, id, lr);
  await expect.poll(async () => (await labelState(page, id)).dx, '★전제: 끌어서 오프셋이 생겼다').toBe(String(DX));
  const live = await labelState(page, id);
  await reloadCanvas(page);
  const after = await labelState(page, id);
  expect([after.dx, after.dy, after.translate], '다시 그린 뒤 오프셋').toEqual([String(DX), String(DY), `${DX}px ${DY}px`]);
  expect(after.css, '라벨 style(정규화) = 라이브 — translate 가 «맨 끝» 한 자리').toBe(live.css);
  expect(Math.abs(after.x - live.x) <= 1 && Math.abs(after.y - live.y) <= 1, `다시 그린 라벨이 같은 자리 Δ=(${after.x - live.x},${after.y - live.y})`).toBe(true);
});

test('AN9 패널 숫자칸으로 옮기고 「자동 배치로 되돌리기」로 지운다 (없으면 단추 꺼짐)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const btn = () => page.evaluate(() => { const b = document.getElementById('annot-label-reset'); return b ? b.disabled : null; });
  expect(await btn(), '★전제: 오프셋 없으면 단추가 꺼져 있다').toBe(true);
  await page.click('#annot-label-dx');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('15');
  await page.keyboard.press('Enter');
  await page.click('#annot-label-dy');
  await page.keyboard.press('Meta+a');
  await page.keyboard.type('-12');
  await page.keyboard.press('Enter');
  await expect.poll(async () => { const s = await labelState(page, id); return [s.dx, s.dy, s.translate]; }, '숫자칸 값이 먹었다').toEqual(['15', '-12', '15px -12px']);
  await expect.poll(btn, '오프셋이 생기면 단추가 켜진다').toBe(false);
  const tip0 = await page.evaluate(() => window.getHistoryTip().pos);
  await page.click('#annot-label-reset');
  await expect.poll(async () => { const s = await labelState(page, id); return [s.dx, s.dy, s.translate]; }, '되돌리기 → 키 없음 · translate 없음').toEqual([null, null, '']);
  await expect.poll(btn, '되돌린 뒤 단추가 꺼진다').toBe(true);
  expect(await page.evaluate(() => window.getHistoryTip().action), '되돌리기도 히스토리 한 칸').toBe('라벨 위치 되돌리기');
  expect(await page.evaluate(() => window.getHistoryTip().pos), '꼭대기가 올라갔다').toBeGreaterThan(tip0);
});

test('AN10 «고른 라벨» 표식은 저장 직렬화에 안 실린다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await pickLabel(page, id);
  const r = await page.evaluate(() => ({ live: document.querySelectorAll('.annot-cell-selected').length, saved: (window.getSerializedCanvas().match(/annot-cell-selected/g) || []).length }));
  expect(r, '라이브엔 1 · 직렬화엔 0').toEqual({ live: 1, saved: 0 });
  await page.keyboard.press('Escape');
  await expect.poll(() => page.evaluate((id) => ({ picked: !!document.querySelector('.annot-cell-selected'), sel: document.getElementById(id).classList.contains('selected') }), id),
    'ESC 한 번은 라벨 고르기만 푼다').toEqual({ picked: false, sel: true });
});

/* ★1017t1h4 — 안내 문구("한 번 더 누르면…") 삭제. 돌아오는 것을 막는 래칫. */
test('AN12(1017t1h4) 라벨 위치 절에 「한 번 더 누르면」 힌트가 없다 (패널이 뜬 전제에서)', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const r = await page.evaluate(() => {
    const hints = [...document.querySelectorAll('#panel-right .prop-hint')];
    return { total: hints.length, hasDbl: hints.some(h => h.textContent.includes('더블클릭')), hasOld: hints.some(h => h.textContent.includes('한 번 더 누르면')),
      /* ★1020t2c3 — 현빈 2026-10-20 「프롭힌트 없애주기」로 지운 ★회전 손잡이 힌트. */
      hasRot: hints.some(h => h.textContent.includes('손잡이를 끌어 돌립니다')) };
  });
  expect(r.total >= 1 && r.hasDbl, '★전제: 패널이 떴다(다른 힌트가 살아있다 — 0건을 「없다」로 닫지 않는다)').toBe(true);
  expect(r.hasOld, '지운 문구는 없다').toBe(false);
  /* ★★1020t2c3 래칫 — ★이 힌트는 ★파티클 패널이 아니라 ★여기(주석/화살표 블럭 「고정점」 절, rotatable 분기)에 있었다.
     ★현빈 노트 제목은 「프롭힌트 없애주기 : 파티클 추가시」였지만 ★그 글자의 ★유일한 자리는 ★이 패널이다
       (실측 2026-10-20 · NFC/NFD 양쪽으로 전 레포 1건) ⇒ ★지디 판정 ⑵로 ★여기를 지웠다.
     ★전제는 ★위 줄(total>=1 && hasDbl)이 ★이미 받친다 — `:307`(더블클릭) 힌트가 살아있다.
     ⛔`:307` 까지 지우면 ★이 칸이 ★전제에서 죽는다(그것이 ★이 칸을 믿을 수 있는 까닭이다).
     ★항등식이 아님 — ★핀 a42d76d59f45a70eb3ee0e1f68a8ed37650f7565 에서 hasRot 은 ★true 였다. */
  expect(r.hasRot, '★지운 문구(「시작점 옆 손잡이를 끌어 돌립니다 · ⇧ 45°」)가 되돌아왔다 — 핀에서는 있었다').toBe(false);
});

/* ★1017t1h6 — 「위치」span 만 걷는다. 같은 절을 째 지우면 AN9(dx/dy/되돌리기)가 깨진다. */
test('AN13(1017t1h6) 라벨 위치 절 — span.prop-label 0개 · dx/dy/되돌리기는 살아있다', async ({ page }) => {
  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);
  const r = await page.evaluate(() => {
    const sec = document.getElementById('annot-label-pos-section');
    const dx = document.getElementById('annot-label-dx');
    const dy = document.getElementById('annot-label-dy');
    return {
      labelCount: sec ? sec.querySelectorAll('.prop-label').length : null,
      dx: !!dx, dy: !!dy, reset: !!document.getElementById('annot-label-reset'),
      dxTitle: dx?.title ?? null, dyTitle: dy?.title ?? null,
    };
  });
  expect(r).toEqual({ labelCount: 0, dx: true, dy: true, reset: true, dxTitle: '가로(dx)', dyTitle: '세로(dy)' });
});

/* ★1017t1h7 — 프리셋 드롭다운. option 수는 «정의 자리에서 파생»(손으로 3 을 박지 않는다),
   값은 따로 리터럴로 한 번 더 잠근다(항등식 방지). 공용 .prop-preset-btn CSS/다른 소비자는 무접촉. */
test('AN14(1017t1h7) 프리셋 드롭다운 — option 수 · 값 리터럴 · .prop-preset-btn 0 · 공용 CSS 무접촉', async ({ page }) => {
  const src = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'props', 'prop-annotation.js'), 'utf8');
  const m = src.match(/const ANNOTATION_PRESETS = \[([\s\S]*?)\n\];/);
  expect(m, '★전제: ANNOTATION_PRESETS 정의를 소스에서 찾았다').not.toBeNull();
  const presetCount = (m[1].match(/name:\s*'/g) || []).length;
  expect(presetCount, '★전제: 정의 자리 프리셋 수 > 0').toBeGreaterThan(0);

  await bootApp(page);
  await setup(page);
  const id = await makeAnnotation(page);
  await selectByLabel(page, id);

  const optCount = await page.evaluate(() => document.querySelectorAll('#panel-right #annot-preset-select option').length);
  expect(optCount, 'option 수 = 머리(빈 값) 1 + 정의 자리 프리셋 수').toBe(presetCount + 1);
  const headVal = await page.evaluate(() => document.querySelector('#panel-right #annot-preset-select option')?.value);
  expect(headVal, '머리 option 값은 빈 문자열').toBe('');

  await page.selectOption('#panel-right #annot-preset-select', '0');
  const stroke = await page.evaluate((id) => document.getElementById(id).dataset.strokeColor, id);
  expect(stroke, "'0'을 고르면 strokeColor 가 '#e74c3c'(값 자체를 리터럴로 잠근다 — 같은 소스 파싱만으론 항등식)").toBe('#e74c3c');

  const btnCountHere = await page.evaluate(() => document.querySelectorAll('#panel-right .prop-preset-btn').length);
  expect(btnCountHere, '어노테이션 패널엔 .prop-preset-btn 0개(공용 단추를 썼었지만 이제 드롭다운이다)').toBe(0);

  // ★음성대조 — 공용 .prop-preset-btn 소비자(prop-asset.js)는 그대로다(분모 출처: grid-guide-radio.test.js).
  const assetSrc = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'props', 'prop-asset.js'), 'utf8');
  const assetBtnCount = (assetSrc.match(/prop-preset-btn prop-type-btn/g) || []).length;
  expect(assetBtnCount, '다른 패널(prop-asset.js)의 .prop-preset-btn 소비는 ≥4 그대로').toBeGreaterThanOrEqual(4);
});
