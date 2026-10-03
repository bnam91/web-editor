/* template-no-scratch-link.dom.spec.js — SP1 (현빈 2026-10-03 확정) 「템플릿에서 캔버스로 새로 추가되는건 스크래치패드 없이 들어와야해」
 * 앱 통째로 헤드리스(bootApp) — 진짜 index.html + 진짜 template-system.js·scratchpad-link.js·scratch-pad.js,
 * 진짜 마우스 클릭(「템플릿으로 저장」 버튼 · 미리보기의 「+ 섹션 추가」 버튼 · 스크래치 항목 끌기).
 *
 * ★양성대조: GD1001_ROOT=<37ab1c65 체크아웃> 로 돌리면 이 하네스가 «그 판의» index.html 을 통째로 싣는다(bootApp 이 ROOT 를 쓴다)
 *   ⇒ 빨강이어야 할 것은 보고서에 이름으로 적는다. 지키는 시험(원본 링크 보존 · 스크래치 아이템 1개)은 양쪽 초록이어야 한다.
 * ⛔이 하네스로 «못 재는» 축: 템플릿 index/canvas «파일»(electronAPI 는 메모리 대역) · 다른 «프로젝트»(프로젝트 미로드 — 같은 페이지 안 삽입으로 대신,
 *   「다른 프로젝트」는 «스크래치에 없는 토큰» = 대상 DB 에 없는 id 로 재현: TL4) · 재기동 뒤 영속.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js template-no-scratch-link
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SECS = `
<div class="section-block" id="sPre" data-section="1" data-name="앞" data-bg="#ffffff" style="background-color:#ffffff;height:200px;">
  <div class="section-hitzone"><span class="section-label">앞</span></div><div class="section-inner"></div></div>
<div class="section-block" id="sOrig" data-section="2" data-name="원본" data-bg="#eeeeee" style="background-color:#eeeeee;height:260px;">
  <div class="section-hitzone"><span class="section-label">원본</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gO1" style="height:40px;"></div></div></div>`;

async function setup(page) {
  await page.setViewportSize({ width: 1700, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((html) => {
    /* 템플릿 저장소 = 메모리 대역(진짜 saveAsTemplate/_loadCanvas 가 이 «저장 API» 를 통해 오간다) */
    const store = {}; window.__tplStore = store;
    const real = window.electronAPI;
    window.electronAPI = new Proxy({}, { get: (_, k) => {
      if (k === 'saveTemplateCanvas') return async (id, h) => { store[id] = h; return true; };
      if (k === 'loadTemplateCanvas') return async (id) => store[id] ?? null;
      if (k === 'saveTemplateIndex')  return async () => true;
      if (k === 'loadTemplateIndex')  return async () => [];
      return real[k];
    } });
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    c.insertAdjacentHTML('beforeend', html);
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('sPre').scrollIntoView({ block: 'start' });
  }, SECS);
  await page.waitForTimeout(300);
  return errs;
}

/* 진짜 스크래치 아이템(진짜 scratch-pad.js) + 원본 섹션에 링크 — 그리고 «전제»를 단언한다 */
async function seedLinked(page) {
  const id = await page.evaluate(async (px) => {
    await window._scratchAddAndSave(px, 20, 300, 120);
    const el = [...document.querySelectorAll('.scratch-item')].pop();
    const sid = el.dataset.scratchId;
    window.SPLink.addLink('sOrig', sid);
    return sid;
  }, PX);
  const prem = await page.evaluate((sid) => ({
    token: document.getElementById('sOrig').dataset.refLinks || null,
    itemInModel: !!window._scratchItemById(sid),
    itemInDom: !!document.querySelector(`.scratch-item[data-scratch-id="${sid}"]`),
    pairs: window.SPLink.allLinks().map((l) => l.sectionId + '→' + l.scratchId),
  }), id);
  expect(prem.token, '★전제 — 원본 섹션이 링크 토큰을 쥐고 있다').toContain(id);
  expect(prem.itemInModel, '★전제 — 스크래치 «모델»에 진짜 아이템이 있다').toBe(true);
  expect(prem.itemInDom, '★전제 — 스크래치 «DOM» 에 아이템이 있다').toBe(true);
  expect(prem.pairs).toEqual(['sOrig→' + id]);
  return id;
}

/* 진짜 마우스: 섹션 선택 → 우측 「템플릿으로 저장」 */
async function registerViaUI(page, secId, name) {
  const pt = await page.evaluate((id) => { document.getElementById(id).scrollIntoView({ block: 'center' }); const r = document.querySelector('#' + id + ' .section-hitzone').getBoundingClientRect(); return [r.left + 6, r.top + r.height / 2]; }, secId);
  await page.mouse.click(pt[0], pt[1]);
  await page.waitForSelector('#sec-tpl-save-btn', { timeout: 5000 });
  await page.fill('#sec-tpl-name', name);
  await page.click('#sec-tpl-save-btn');
  await page.waitForFunction((n) => window.loadTemplates().some((t) => t.name === n), name, { timeout: 5000 });
  return page.evaluate((n) => window.loadTemplates().find((t) => t.name === n).id, name);
}

/* 진짜 마우스: 미리보기 모달의 「+ 섹션 추가」 */
async function insertViaUI(page, tplId) {
  const before = await page.evaluate(() => document.querySelectorAll('#canvas > .section-block').length);
  await page.evaluate((id) => window.showTemplatePreview(id), tplId);
  await page.waitForSelector('.tpl-preview-insert-btn', { timeout: 5000 });
  await page.click('.tpl-preview-insert-btn');
  await page.waitForFunction((n) => document.querySelectorAll('#canvas > .section-block').length === n + 1, before, { timeout: 5000 });
  await page.waitForTimeout(150);
}

const snap = (page, sid) => page.evaluate((sid) => {
  const secs = [...document.querySelectorAll('#canvas > .section-block')];
  const pairs = window.SPLink.allLinks();
  const per = {};
  pairs.forEach((l) => { per[l.scratchId] = (per[l.scratchId] || 0) + 1; });
  const item = window._scratchItemById(sid);
  return {
    secs: secs.map((s) => ({ id: s.id, name: s.dataset.name, attr: s.hasAttribute('data-ref-links'), inner: s.querySelectorAll('[data-ref-links]').length, tokens: window.SPLink._parse(s).length })),
    canvasAttrCount: document.querySelectorAll('#canvas [data-ref-links]').length,
    maxPerImage: pairs.length ? Math.max(...Object.values(per)) : 0,
    pairs: pairs.map((l) => l.sectionId + '→' + l.scratchId),
    itemCount: document.querySelectorAll('.scratch-item').length,
    itemExists: !!item, itemTop: item && item.el ? item.el.getBoundingClientRect().top : null,
    origToken: document.getElementById('sOrig').dataset.refLinks || null,
  };
}, sid);

test('TL1 ★링크된 섹션을 템플릿으로 등록 → 같은 프로젝트에 2번 삽입 — 새 섹션 둘은 링크 0, 원본 링크·스크래치는 그대로', async ({ page }) => {
  const errs = await setup(page);
  const sid = await seedLinked(page);
  const tplId = await registerViaUI(page, 'sOrig', 'SP1-링크원본');
  /* 등록 «뒤»에도 원본이 링크를 쥔다(= 클론만 벗겼다) */
  const afterReg = await snap(page, sid);
  expect(afterReg.origToken, '★등록이 «라이브 원본»의 링크를 지웠다').toContain(sid);
  expect(afterReg.pairs).toEqual(['sOrig→' + sid]);
  /* 저장된 템플릿 HTML 은 토큰이 0건이다(등록 시점 strip) */
  const stored = await page.evaluate((id) => window.__tplStore[id], tplId);
  expect(stored, '전제 — 템플릿이 저장됐다').toContain('section-block');
  expect((stored.match(/data-ref-links/g) || []).length, '★저장본에 링크 토큰이 실렸다').toBe(0);

  await insertViaUI(page, tplId);
  await insertViaUI(page, tplId);
  const s = await snap(page, sid);
  const news = s.secs.filter((x) => x.name === 'SP1-링크원본');
  expect(news.length, '전제 — 새 섹션이 «둘» 생겼다').toBe(2);
  for (const n of news) {
    expect(n, `★새 섹션 ${n.id} 이 링크 토큰을 지녔다`).toMatchObject({ attr: false, inner: 0, tokens: 0 });
  }
  expect(s.origToken, '★원본 링크가 날아갔다').toContain(sid);
  expect(s.pairs, '링크 쌍은 원본 하나뿐').toEqual(['sOrig→' + sid]);
  expect(s.maxPerImage).toBe(1);
  expect(s.itemCount, '스크래치 아이템은 복제되지 않는다(1개 그대로)').toBe(1);
  expect(s.itemExists).toBe(true);
  expect(errs).toEqual([]);
});

test('TL2 ★스크래치 아이템은 «원본»만 따라간다 — 앞 섹션을 키우면 아이템이 그만큼 움직이고, 아이템을 끌어도 새 섹션은 무관', async ({ page }) => {
  await setup(page);
  const sid = await seedLinked(page);
  const tplId = await registerViaUI(page, 'sOrig', 'SP1-따라감');
  await insertViaUI(page, tplId);
  await insertViaUI(page, tplId);

  /* 좌표는 «스크래치 모델의 y(scaler 좌표)» 로 잰다 — 화면 px 은 배율·스크롤에 흔들린다 */
  const y0 = await page.evaluate((sid) => window._scratchItemById(sid).y, sid);
  await page.evaluate(() => { document.getElementById('sPre').style.height = '300px'; });   // 원본이 100px 내려간다
  await page.waitForFunction(([sid, y0]) => Math.abs(window._scratchItemById(sid).y - y0) > 1, [sid, y0], { timeout: 5000 });
  await page.waitForTimeout(300);
  const y1 = await page.evaluate((sid) => window._scratchItemById(sid).y, sid);
  expect(Math.round(y1 - y0), '★링크가 살아 있다면 아이템은 원본을 따라 100px 내려간다').toBe(100);

  /* 진짜 마우스로 스크래치 아이템을 끈다 → 원본 기준 오프셋이 재앵커될 뿐, 새 섹션엔 아무 일도 없다 */
  const pt = await page.evaluate((sid) => { const el = window._scratchItemById(sid).el; el.scrollIntoView({ block: 'center', inline: 'center' }); const r = el.getBoundingClientRect(); return [r.left + 14, r.top + 14]; }, sid);
  await page.mouse.move(pt[0], pt[1]); await page.mouse.down();
  for (let i = 1; i <= 6; i++) await page.mouse.move(pt[0], pt[1] + i * 6);
  await page.mouse.up(); await page.waitForTimeout(200);
  const s = await snap(page, sid);
  const news = s.secs.filter((x) => x.name === 'SP1-따라감');
  expect(news.length).toBe(2);
  expect(news.every((n) => !n.attr && n.inner === 0), '★아이템을 만져도 새 섹션에 링크가 생기지 않는다').toBe(true);
  expect(s.pairs).toEqual(['sOrig→' + sid]);
  expect(s.itemCount).toBe(1);
});

test('TL3 ★이 수정 «이전»에 등록된 템플릿(HTML 에 토큰이 박혀 있다) — 삽입해도 링크 0', async ({ page }) => {
  await setup(page);
  const sid = await seedLinked(page);
  /* 옛 템플릿 시뮬레이션: «저장 API» 로 토큰이 박힌 HTML 을 직접 넣는다(등록 경로를 안 거친다) */
  const old = await page.evaluate(async (sid) => {
    const html = `<div class="section-block" id="sOld" data-section="1" data-name="옛템플릿" data-ref-links="${sid}:0,sp_gone01:1" style="height:150px;">`
      + `<div class="section-hitzone"><span class="section-label">옛</span></div>`
      + `<div class="section-inner"><div class="gap-block" data-type="gap" id="gOld" data-ref-links="${sid}:0" style="height:30px;"></div></div></div>`;
    const id = 'tpl_old_sp1';
    await window.electronAPI.saveTemplateCanvas(id, html);
    window.saveTemplatesPublic([{ id, name: '옛템플릿', folder: '기타', category: 'body', tags: [], createdAt: new Date().toISOString(), thumbnail: null, type: 'section' }, ...window.loadTemplates()]);
    return { id, tokens: (window.__tplStore[id].match(/data-ref-links/g) || []).length };
  }, sid);
  expect(old.tokens, '★전제 — 옛 템플릿은 토큰 둘(루트+자손)을 품고 있다').toBe(2);
  await insertViaUI(page, old.id);
  const s = await snap(page, sid);
  const n = s.secs.find((x) => x.name === '옛템플릿');
  expect(n, '전제 — 삽입됐다').toBeTruthy();
  expect(n).toMatchObject({ attr: false, inner: 0, tokens: 0 });
  expect(s.canvasAttrCount, '캔버스 전체에서 토큰은 «원본 섹션 하나»뿐').toBe(1);
  expect(s.origToken).toContain(sid);
  expect(s.pairs).toEqual(['sOrig→' + sid]);
  expect(s.maxPerImage).toBe(1);
});

test('TL4 ★「다른 프로젝트」꼴 — 대상 스크래치에 없는 토큰(死참조)도 삽입 때 벗겨진다', async ({ page }) => {
  await setup(page);   // 스크래치 아이템 없음 = 다른 프로젝트에 넣는 것과 같은 «대상 DB 에 없는 id»
  const pre = await page.evaluate(async () => {
    const html = `<div class="section-block" id="sX" data-section="1" data-name="타프로젝트" data-ref-links="sp_other1:0" style="height:150px;"><div class="section-hitzone"><span class="section-label">X</span></div><div class="section-inner"></div></div>`;
    await window.electronAPI.saveTemplateCanvas('tpl_x_sp1', html);
    window.saveTemplatesPublic([{ id: 'tpl_x_sp1', name: '타프로젝트', folder: '기타', category: 'body', tags: [], createdAt: new Date().toISOString(), thumbnail: null, type: 'section' }]);
    return { scratchItems: document.querySelectorAll('.scratch-item').length, tokens: (window.__tplStore.tpl_x_sp1.match(/data-ref-links/g) || []).length };
  });
  expect(pre).toEqual({ scratchItems: 0, tokens: 1 });   // 전제
  await insertViaUI(page, 'tpl_x_sp1');
  const s = await snap(page, 'none');
  expect(s.secs.find((x) => x.name === '타프로젝트')).toMatchObject({ attr: false, inner: 0, tokens: 0 });
  expect(s.canvasAttrCount).toBe(0);
  expect(s.pairs).toEqual([]);
});

test('TL5 지키는 시험 — 링크 없는 섹션을 등록·삽입하는 기존 동작은 그대로(이름·태그·번호)', async ({ page }) => {
  await setup(page);
  const tplId = await registerViaUI(page, 'sPre', 'SP1-무링크');
  await insertViaUI(page, tplId);
  const r = await page.evaluate(() => [...document.querySelectorAll('#canvas > .section-block')].map((s) => [s.dataset.section, s.dataset.name]));
  expect(r).toEqual([['1', '앞'], ['2', 'SP1-무링크'], ['3', '원본']]);   // sPre 선택 상태에서 넣었으니 바로 아래
});
