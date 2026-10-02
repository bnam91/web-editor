/* color-history.dom.spec.js — 컬러 히스토리(최근 쓴 색) · 현빈 확정 B안 2026-10-02(지디 경유)
 *   VAR 줄 아래 «최근» 줄 — 점만(글자 없음) · 개수 COLOR_HISTORY_MAX(=7, 우측 인스펙터 240 에서 한 줄 실측) · 프로젝트별(meta.colorHistory)
 *   쌓는 자리 = 색 팝업을 «닫을 때» 그 열림의 마지막 확정 단색 하나(끄는 중·투명도만·그라데이션·안 바꿈은 안 쌓음).
 * 앱 통째(bootApp) · 색 팝업은 진짜 마우스(스와치 mousedown → 스펙트럼 클릭 = 확정 → Esc 로 닫기).
 * ★첫 단언 = 전제(패널 폭 240 · 기본 변수 3개) — 그 조건이 «정말» 섰는지부터.
 * ★같은 판 대조: H3(같은 판에서 VAR 칩 = var() 바인딩 / 최근 칩 = 고정 hex — 둘이 다른 값을 낸다) · H4(변수 3 vs 0 에서 VAR 줄만 갈림).
 *   변이 사본: 상수 8 → H5 빨강 · meta 합쳐쓰기 줄을 «따로 읽고쓰기»로 되돌린 사본 → H8 빨강(커밋 본문에 결과).
 * ★양성대조 판 7699ea33: 기능이 없어 전제에서 지는 «약한» 빨강. */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

/* 프로젝트 meta 를 메모리에 두는 가짜 electronAPI — loadProjectMeta 를 일부러 «늦게» 돌려 경합을 드러낸다(H8). */
const FAKE_META = () => {
  window.__meta = {};
  const real = window.electronAPI;
  window.electronAPI = new Proxy({}, { get: (_t, k) => {
    /* ★«부른 순간»에 찍어 두고 늦게 돌려준다 — 실제 IPC 처럼(요청 시점의 파일). 첫 판은 «돌려줄 때» 읽어서
       먼저 쓴 결과를 늘 봐 경합이 안 생겼다(변이 사본으로 H8 이 초록이라 찾음 — 계측기가 경합을 못 봤다). */
    if (k === 'loadProjectMeta') return (pid) => { const snap = window.__meta[pid] ? JSON.parse(JSON.stringify(window.__meta[pid])) : null; return new Promise(r => setTimeout(() => r(snap), 30)); };
    if (k === 'saveProjectMeta') return (pid, m) => { window.__meta[pid] = JSON.parse(JSON.stringify(m)); return Promise.resolve({ ok: true }); };
    return real[k];
  } });
};
async function setup(page, { meta = false } = {}) {
  await page.setViewportSize({ width: 1600, height: 1000 });
  await bootApp(page);
  await page.evaluate(([meta, fm]) => {
    localStorage.removeItem('we_color_history_v1');
    if (meta) (new Function(fm))();
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="sA" data-section="1"><div class="section-inner"><div class="gap-block" data-type="gap" style="height:60px"></div><div class="row" id="rT"><div class="text-block" data-type="body" id="tT"><div class="tb-body">글자</div></div></div><div class="gap-block" data-type="gap" style="height:200px"></div></div></div>`);
    window.rebindAll?.();
    document.dispatchEvent(new CustomEvent('colorhistory-changed'));
  }, [meta, `(${FAKE_META.toString()})()`]);
  /* ⚠️클릭 «전에» 자리가 멈출 때까지 — 부하에선 기동 뒤 배율 맞추기가 늦게 끝나 잰 좌표와 누르는 순간 사이에 글 블럭이 움직여
     빗나갔다(실측). 공용 도우미 waitStableRect(_root-harness.js)로 — 같은 병을 세 번 고쳐 묶은 것. */
  const st = await waitStableRect(page, '#tT');
  await page.mouse.click(st.left + 10, st.cy);
  /* ⚠️고정 대기(300ms)로 두면 부하에서 패널이 그려지기 «전»에 재서 흔들렸다(실측: --repeat-each=8 에서 72 중 14 빨강 — 전부
     칩 상자·최근 줄이 «아직 없음»). ⇒ 칩 상자가 붙을 때까지 기다린다(기능 탓 아님 — 시험 준비의 타이밍). */
  await page.waitForSelector('#txt-color-chips + .cv-recent-row', { state: 'attached', timeout: 10000 });
  /* ⚠️프로젝트 id 는 블럭을 고른 «뒤»에 넣는다 — 먼저 넣으면 브랜치 시스템이 그 프로젝트를 «main(읽기 전용)»으로 잠가
     클릭이 선택이 안 됐다(실측: 「main은 읽기 전용이에요」 띠 · 부하에서 H7 8/8 빨강). 기능이 아니라 고정 데이터 순서 탓. */
  if (meta) await page.evaluate(() => { window.activeProjectId = 'pA'; });
}
const pre = (page) => page.evaluate(() => ({ panelW: Math.round(document.getElementById('panel-right').getBoundingClientRect().width), vars: Object.keys(window.DesignSystem.getColorVars()).length, box: !!document.getElementById('txt-color-chips') }));
const hist = (page) => page.evaluate(() => window.DesignSystem.getColorHistory());
const recentRow = (page) => page.evaluate(() => { const r = document.querySelector('#txt-color-chips + .cv-recent-row'); if (!r) return null;
  return { hidden: r.hidden, chips: [...r.querySelectorAll('.cv-chip.recent')].map(c => c.dataset.cvRecent), labelText: [...r.querySelectorAll('.cv-chip.recent')].map(c => c.textContent.trim()).join(''),
           tops: [...r.querySelectorAll('.cv-chip.recent')].map(c => Math.round(c.getBoundingClientRect().top)) }; });
const blockColor = (page) => page.evaluate(() => { const e = [...document.querySelectorAll('#tT, #tT *')].find(x => x.style && x.style.color); return e ? e.getAttribute('style').match(/color:\s*([^;]+)/)?.[1].trim() : null; });

/* 색 팝업: 스와치 mousedown → 스펙트럼을 (fx,fy) 들에서 차례로 클릭(클릭마다 «확정») → Esc 로 닫기 */
async function popupPick(page, points) {
  const sw = await page.evaluate(() => { const r = document.getElementById('txt-color').closest('.prop-color-swatch').getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; });
  await page.mouse.move(sw[0], sw[1]); await page.mouse.down(); await page.mouse.up(); await page.waitForTimeout(150);
  for (const [fx, fy] of points) {
    const sp = await page.evaluate(() => { const r = document.querySelector('.goya-cp-popover [data-el="spectrum"]').getBoundingClientRect(); return [r.left, r.top, r.width, r.height]; });
    await page.mouse.click(sp[0] + sp[2] * fx, sp[1] + sp[3] * fy); await page.waitForTimeout(80);
  }
  const committed = await page.evaluate(() => document.getElementById('txt-color').value.toLowerCase());
  await page.keyboard.press('Escape'); await page.waitForTimeout(150);
  return committed;
}

test('H1 ★팝업을 «닫을 때» 그 열림의 마지막 확정 하나만 쌓인다 — 더듬기 중간값·열고 안 바꾼 것은 안 쌓인다', async ({ page }) => {
  await setup(page);
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  const last = await popupPick(page, [[0.2, 0.3], [0.7, 0.6], [0.9, 0.2]]);   // 한 열림에서 세 번 확정
  expect(await hist(page)).toEqual([last]);
  await popupPick(page, []);                                                  // 열고 아무것도 안 하고 닫기
  expect(await hist(page)).toEqual([last]);
});
test('H2 같은 색은 맨 앞으로(중복 없음) · 넘치면 뒤에서 버려 COLOR_HISTORY_MAX 개', async ({ page }) => {
  await setup(page);
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  const r = await page.evaluate(() => { const D = window.DesignSystem; ['#111111', '#222222', '#333333'].forEach(D.pushColorHistory); D.pushColorHistory('#111111');
    const a = D.getColorHistory(); for (let i = 0; i < 10; i++) D.pushColorHistory('#0000' + String(i).padStart(2, '0')); return { a, b: D.getColorHistory(), max: D.COLOR_HISTORY_MAX }; });
  expect(r.a).toEqual(['#111111', '#333333', '#222222']);
  expect(r.max).toBe(7);
  expect(r.b.length).toBe(7);
  expect(r.b[0]).toBe('#000009');
});
test('H3 ★★누르면 하는 일이 다르다 — VAR 칩 = var(--color-…, #hex) 바인딩 / 최근 칩 = 고정 #hex', async ({ page }) => {
  await setup(page);
  await page.evaluate(() => window.DesignSystem.pushColorHistory('#2e8b57'));
  await page.waitForTimeout(100);
  await page.click('#txt-color-chips .cv-chip[data-cv-name="accent"]'); await page.waitForTimeout(150);
  expect(await blockColor(page)).toMatch(/^var\(--color-accent,\s*#ff6b6b\)$/);
  await page.click('#txt-color-chips + .cv-recent-row .cv-chip.recent[data-cv-recent="#2e8b57"]'); await page.waitForTimeout(150);
  const c = await blockColor(page);
  expect(c, '최근 칩은 var() 가 «아니다»').not.toMatch(/var\(/);
  expect(c.toLowerCase()).toMatch(/#2e8b57|rgb\(46,\s*139,\s*87\)/);
});
test('H4 변수 0 + 최근 있음 → VAR 줄 숨고 최근 줄은 보인다 · 최근 0 → 최근 줄 없음(숨김) · 점만(글자 없음)', async ({ page }) => {
  await setup(page);
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  let rr = await recentRow(page);
  expect(rr.hidden, '최근 0 → 줄 숨김').toBe(true);
  await page.evaluate(() => window.DesignSystem.pushColorHistory('#7b4397')); await page.waitForTimeout(100);
  rr = await recentRow(page);
  expect({ hidden: rr.hidden, chips: rr.chips, labelText: rr.labelText }).toEqual({ hidden: false, chips: ['#7b4397'], labelText: '' });
  await page.evaluate(() => Object.keys(window.DesignSystem.getColorVars()).forEach(n => window.DesignSystem.removeColorVar(n))); await page.waitForTimeout(150);
  expect(await page.evaluate(() => Object.keys(window.DesignSystem.getColorVars()).length), '전제 — 변수 0').toBe(0);
  expect(await page.evaluate(() => document.getElementById('txt-color-chips').hidden)).toBe(true);
  expect((await recentRow(page)).hidden).toBe(false);
});
test('H5 ★최근 7개가 «한 줄»(모든 칩 top 같음) — 상수가 패널 폭과 맞다', async ({ page }) => {
  await setup(page);
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  await page.evaluate(() => { for (let i = 0; i < 12; i++) window.DesignSystem.pushColorHistory('#' + (0x101010 * (i + 1) % 0xffffff).toString(16).padStart(6, '0')); });
  await page.waitForTimeout(100);
  const rr = await recentRow(page);
  expect(rr.chips.length).toBe(await page.evaluate(() => window.DesignSystem.COLOR_HISTORY_MAX));
  expect(new Set(rr.tops).size, `칩 top 들: ${rr.tops.join(',')}`).toBe(1);
});
test('H6 최근 칩 우클릭 → 인라인 이름 폼(디자인시스템 탭과 같은 꼴) → 그 색으로 변수가 생기고 VAR 줄에 나타난다', async ({ page }) => {
  await setup(page);
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  await page.evaluate(() => window.DesignSystem.pushColorHistory('#c0392b')); await page.waitForTimeout(100);
  await page.click('#txt-color-chips + .cv-recent-row .cv-chip.recent', { button: 'right' }); await page.waitForTimeout(150);
  expect(await page.evaluate(() => document.getElementById('cv-recent-var-form')?.className)).toBe('var-add-form');
  await page.keyboard.type('fromRecent'); await page.keyboard.press('Enter'); await page.waitForTimeout(200);
  expect(await page.evaluate(() => window.DesignSystem.getColorVars().fromRecent)).toBe('#c0392b');
  expect(await page.isVisible('#txt-color-chips .cv-chip[data-cv-name="fromRecent"]')).toBe(true);
});
test('H7 ★프로젝트별 — A 에서 쌓은 최근은 meta 에 없는 B 를 열면 안 보이고, A 로 돌아오면 다시 보인다', async ({ page }) => {
  await setup(page, { meta: true });
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  const r = await page.evaluate(async () => { const D = window.DesignSystem;
    D.pushColorHistory('#f3a712'); D.pushColorHistory('#16a085'); await new Promise(x => setTimeout(x, 200));
    const a = D.getColorHistory(); const metaA = window.__meta.pA?.colorHistory;
    window.activeProjectId = 'pB'; const b = await D.restoreColorHistoryFromMeta('pB');
    window.activeProjectId = 'pA'; const a2 = await D.restoreColorHistoryFromMeta('pA');
    return { a, metaA, b, a2 }; });
  expect(r.metaA).toEqual(['#16a085', '#f3a712']);
  expect(r.b).toEqual([]);
  expect(r.a2).toEqual(['#16a085', '#f3a712']);
});
test('H8 ★meta 합쳐쓰기 경합 — 변수 추가 «직후» 색 확정해도 meta 에 colorVars·colorHistory 둘 다 남는다', async ({ page }) => {
  await setup(page, { meta: true });
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  const m = await page.evaluate(async () => { window.DesignSystem.setColorVar('brandX', '#123456'); window.DesignSystem.pushColorHistory('#abcdef');
    await new Promise(x => setTimeout(x, 400)); return window.__meta.pA; });
  expect(m.colorVars?.brandX).toBe('#123456');
  expect(m.colorHistory).toEqual(['#abcdef']);
});
test('H9 어두운 색 점도 보인다 — 최근 칩 점 테두리는 밝다 · 변수 칩 점 테두리는 그대로(어둡다)', async ({ page }) => {
  await setup(page);
  expect(await pre(page), '전제 — 패널 폭 240 · 기본 변수 3 · 칩 자리').toEqual({ panelW: 240, vars: 3, box: true });
  await page.evaluate(() => window.DesignSystem.pushColorHistory('#1b1b1b')); await page.waitForTimeout(100);
  const b = await page.evaluate(() => ({ recent: getComputedStyle(document.querySelector('.cv-chip.recent .cv-chip-dot')).borderTopColor, v: getComputedStyle(document.querySelector('#txt-color-chips .cv-chip-dot')).borderTopColor }));
  expect(b.recent).toBe('rgba(255, 255, 255, 0.38)');
  expect(b.v).toBe('rgba(0, 0, 0, 0.25)');
});
