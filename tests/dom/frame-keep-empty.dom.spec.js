/* frame-keep-empty.dom.spec.js — 현빈 결정(2026-10-03): 「프레임 블럭 안에 블럭을 지우니? 빈 프레임이 되어야지?
 *   나중에 다른 걸 다시 넣을 수도 있으니?」 ⇒ 프레임 안 자식을 다 지워도 «사용자 프레임»은 그대로 선다.
 *
 * ★뒤집는 결정: T-099(eddff69c, 2026-09-22) — deleteSelectedFromCanvas 가 «이 삭제가 비운» 프레임을 같이 걷었다.
 *   그 까닭은 「⌘A→Delete 뒤 눈에 보이는 빈 Frame(286×208)이 남는다」 하나였다(저장·내보내기·⌘Z 사고가 아니다).
 *   이제 걷는 것은 사용자가 «프레임으로 본 적 없는» 껍데기뿐 — 글자 래퍼(data-text-frame)·그룹(data-group).
 *
 * 실제 앱(bootApp) + 실제 마우스·키. 판은 «진짜 경로»로 만든다: addFrameBlock(자유 / 흐름) → 패널 addAssetBlock 으로 안에 넣기.
 * 자유 프레임·흐름 프레임 둘 다, 배율 100·40 둘 다.
 *   K  — 지운 뒤 프레임이 남고 자식만 사라진다 · 히스토리 라벨
 *   V  — 빈 프레임이 «보이나»: ⑴높이(px) ⑵elementFromPoint·클릭으로 골라짐 ⑶프레임 패널 ⑷패널 삽입으로 다시 넣기 + 빈 표시(점선)
 *   U  — ⌘Z 한 걸음이면 자식이 돌아오고 프레임은 그대로(같은 id)
 *   S  — 저장 왕복(serializeProject → 새로 띄워 applyProjectData) 뒤에도 빈 프레임이 같은 높이로 선다
 *   E  — 내보내기: PNG 클론·단독 HTML 에 «빈 표시(점선)»가 안 실린다 (★같은 판의 라이브엔 점선이 있다 = 대조)
 *   G  — 그룹은 비면 같이 걷힌다(이 커밋이 그룹을 «남기지 않는다»는 것을 잠근다 — 판단, 보고에 적음)
 * ★양성대조: GD1001_ROOT=<604602cd 체크아웃> 이면 K·V·U·S·E 가 빨강이어야 한다(프레임이 지워져 없다 / 점선 CSS 가 없다). G 는 양쪽 초록.
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js --workers=1 frame-keep-empty */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const SHOT_DIR = process.env.T099_SHOT_DIR || '';
const SEC0 = `<div class="section-block" id="sF1" data-section="1" data-name="sF1"><div class="section-hitzone"></div><div class="section-inner" id="inF1">
  <div class="gap-block" id="gBefore" data-type="gap" style="height:60px;"></div>
  <div class="gap-block" id="gAfter" data-type="gap" style="height:60px;"></div></div></div>`;
const EXPECT_H = { free: 520, flow: 60 };   // makeFrameBlock 기본 자유 높이 · .frame-block min-height(흐름)

async function setup(page, kind, zoom = 100) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([h, kind]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    window.selectSection?.(document.getElementById('sF1'));
    document.getElementById('gBefore').classList.add('selected');
    window.addFrameBlock(kind === 'flow' ? { fullWidth: true } : {});      // 진짜 프레임(툴바 「Frame」과 같은 함수)
    const FR = window._activeFrame; FR.id = 'FR';
    window.addAssetBlock('standard');                                      // 패널 삽입 — 프레임 «안»으로
    FR.querySelector('.asset-block').id = 'kid';
    window.rebindAll?.(); window.deselectAll?.();
  }, [SEC0, kind]);
  await page.evaluate((z) => window.applyZoom?.(z), zoom);
  await page.waitForTimeout(500);
  await page.evaluate(() => document.getElementById('FR').scrollIntoView({ block: 'center' }));
  await page.waitForTimeout(300);
  await page.evaluate(() => window.clearHistory?.());
  return errs;
}
const rc = (page, id) => page.evaluate((id) => { const r = document.getElementById(id)?.getBoundingClientRect(); return r && { l: r.left, t: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, id);
async function selectKidAndDelete(page) {
  const r = await rc(page, 'kid');
  for (let i = 0; i < 3; i++) {   // 안 골라진 프레임의 자식 — 프레임이 먼저 잡히면 한 번 더
    if (await page.evaluate(() => document.getElementById('kid').classList.contains('selected'))) break;
    await page.mouse.click(r.cx, r.cy); await page.waitForTimeout(150);
  }
  expect(await page.evaluate(() => document.getElementById('kid').classList.contains('selected')), '전제 — 자식(에셋)이 골라졌다').toBe(true);
  await page.keyboard.press('Delete'); await page.waitForTimeout(400);
}
const frameState = (page) => page.evaluate(() => {
  const FR = document.getElementById('FR');
  if (!FR) return { exists: false };
  const cs = getComputedStyle(FR);
  return { exists: true, kids: FR.children.length, kid: !!document.getElementById('kid'), outline: cs.outlineStyle, offsetH: FR.offsetHeight,
           tip: window.getHistoryTip?.() || null };
});

for (const kind of ['free', 'flow']) {
  test(`K-${kind} ★자식을 지우면 자식만 사라지고 프레임은 남는다 · 히스토리 「블록 삭제」`, async ({ page }) => {
    const errs = await setup(page, kind);
    await selectKidAndDelete(page);
    const s = await frameState(page);
    expect(errs).toEqual([]);
    expect(s.exists, '★빈 프레임이 같이 지워졌다(T-099 정리가 아직 사용자 프레임을 걷는다)').toBe(true);
    expect(s.kid, '자식이 안 지워졌다').toBe(false);
    expect(s.kids).toBe(0);
    expect(s.tip?.action, '히스토리 라벨').toBe('블록 삭제');
    expect(s.tip?.canUndo).toBe(true);
  });

  for (const z of [100, 40]) {
    test(`V-${kind}@${z} ★빈 프레임이 보이고(높이·점선) 골라지고(점·클릭) 패널이 뜨고 다시 넣을 수 있다`, async ({ page }) => {
      const errs = await setup(page, kind, z);
      expect(await page.evaluate(() => window.currentZoom), '전제 — 그 배율이 «정말» 걸렸다').toBe(z);
      await selectKidAndDelete(page);
      await page.evaluate(() => { window.deselectAll?.(); });
      await page.mouse.move(5, 5);   // 호버 채움(::after) 걷기
      await page.waitForTimeout(150);
      const s = await frameState(page);
      expect(s.exists, '빈 프레임이 없다').toBe(true);
      const r = await rc(page, 'FR');
      // ⑴ 화면 높이 = 모델 높이 × 배율 (±1)
      expect(s.offsetH, '모델 높이').toBe(EXPECT_H[kind]);
      expect(Math.abs(r.h - EXPECT_H[kind] * z / 100), `화면 높이 ${r.h}`).toBeLessThanOrEqual(1);
      // ⑴' 경계가 보인다 — 흰 프레임 + 흰 섹션이라 경계는 «빈 표시(점선)»뿐이다
      const look = await page.evaluate(() => { const F = document.getElementById('FR'); const cs = getComputedStyle(F);
        return { outline: cs.outlineStyle, ow: parseFloat(cs.outlineWidth), bg: cs.backgroundColor, secBg: getComputedStyle(document.getElementById('sF1')).backgroundColor }; });
      expect(look.outline, '★빈 프레임에 «빈 표시»(점선)가 없다 — 흰 위에 흰 상자라 경계가 안 보인다').toBe('dashed');
      /* 배율 보정(--inv-zoom) — 40% 에서 2.5px 를 주지만 크로미움이 outline 폭을 정수 px 로 내려 2px(=화면 0.8px)가 된다.
         같은 토큰을 쓰는 .marquee-hit 도 같은 꼴이다. ⇒ 화면 두께 0.75~1.25px 를 «한 줄로 보인다»로 잰다(보정 없으면 40% 에서 0.4px). */
      const scr = look.ow * z / 100;
      expect(scr >= 0.75 && scr <= 1.25, `점선 화면 두께 ${scr}px`).toBe(true);
      if (SHOT_DIR && z === 100) await page.screenshot({ path: `${SHOT_DIR}/t099-empty${kind === 'free' ? '' : '-flow'}.png` });
      // ⑵ 고를 수 있나 — 가운데 점이 그 프레임, 클릭하면 골라진다
      const hit = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.closest('.frame-block')?.id || null, [r.cx, r.cy]);
      expect(hit, 'elementFromPoint 가 빈 프레임을 못 잡는다').toBe('FR');
      await page.mouse.click(r.cx, r.cy); await page.waitForTimeout(250);
      const sel = await page.evaluate(() => ({ sel: document.getElementById('FR').classList.contains('selected'), af: window._activeFrame?.id || null,
        outline: getComputedStyle(document.getElementById('FR')).outlineStyle }));
      expect(sel.sel, '클릭해도 안 골라진다').toBe(true);
      expect(sel.af).toBe('FR');
      expect(sel.outline, '골라지면 선택 실선이 빈 표시를 이긴다').toBe('solid');
      // ⑶ 프레임 속성 패널
      const panel = await page.evaluate(() => (document.querySelector('#panel-right')?.innerText || '').replace(/\s+/g, ' '));
      expect(panel, '프레임 패널이 안 떴다').toMatch(/PROPERTIES Frame FR/);
      // ⑷ 패널 삽입 — 진짜 단추(Body)를 누른다
      await page.evaluate(() => window.toggleFpDropdown?.('fp-text-dropdown'));
      await page.locator('#fp-text-dropdown .fp-menu-item', { hasText: 'Body' }).click();
      await page.waitForTimeout(300);
      const ins = await page.evaluate(() => ({ inFrame: document.querySelectorAll('#FR .text-block').length, all: document.querySelectorAll('#sF1 .text-block').length }));
      expect(ins, '다시 넣은 블록이 빈 프레임 «안»에 안 들어갔다').toEqual({ inFrame: 1, all: 1 });
      await page.evaluate(() => window.deselectAll?.()); await page.waitForTimeout(100);
      expect(await page.evaluate(() => getComputedStyle(document.getElementById('FR')).outlineStyle), '내용이 생겼는데 빈 표시가 남았다').toBe('none');
      expect(errs).toEqual([]);
    });
  }

  test(`U-${kind} ★⌘Z 한 걸음 — 자식이 프레임 «안»으로 돌아오고 프레임은 같은 것`, async ({ page }) => {
    const errs = await setup(page, kind);
    await selectKidAndDelete(page);
    expect((await frameState(page)).exists, '전제 — 지운 뒤 프레임이 남아 있다').toBe(true);
    await page.evaluate(() => { window.deselectAll?.(); document.activeElement?.blur?.(); });
    await page.keyboard.press('Meta+z'); await page.waitForTimeout(400);
    const a = await page.evaluate(() => ({ frames: document.querySelectorAll('#sF1 .frame-block:not([data-text-frame]):not([data-group="true"])').length,
      kidInFR: !!document.querySelector('#FR #kid'), tip: window.getHistoryTip?.() }));
    expect(errs).toEqual([]);
    expect(a.kidInFR, '한 번의 ⌘Z 로 자식이 프레임 안으로 안 돌아왔다').toBe(true);
    expect(a.frames, '되돌린 뒤 프레임이 둘이 됐다(빈 껍데기 + 복원본)').toBe(1);
    expect(a.tip?.canUndo, '한 걸음 되돌린 뒤 더 되돌릴 칸이 남았다(지우기가 두 칸이었다)').toBe(false);
  });

  test(`S-${kind} ★저장 왕복 — 다시 열어도 빈 프레임이 같은 높이로 선다`, async ({ page }) => {
    await setup(page, kind);
    await selectKidAndDelete(page);
    const before = await frameState(page);
    expect(before.exists, '전제 — 지운 뒤 프레임이 남아 있다').toBe(true);
    const snap = await page.evaluate(() => window.serializeProject());
    await bootApp(page);
    await page.evaluate((d) => window.applyProjectData(d), JSON.parse(snap));
    await page.waitForTimeout(1200);
    const after = await frameState(page);
    expect(after.exists, '저장 왕복에서 빈 프레임이 사라졌다').toBe(true);
    expect(after.kids).toBe(0);
    expect(after.offsetH).toBe(before.offsetH);
  });

  test(`E-${kind} ★내보내기 — PNG 클론·단독 HTML 엔 빈 표시(점선)가 없다 (같은 판 라이브엔 있다)`, async ({ page }) => {
    const errs = await setup(page, kind);
    await selectKidAndDelete(page);
    await page.evaluate(() => window.deselectAll?.());
    expect((await frameState(page)).outline, '대조 — 라이브 편집 화면엔 점선이 있다').toBe('dashed');
    // PNG — 제품 파이프라인(prepareCloneForCapture)으로 클론을 세워 브라우저가 직접 찍는다
    const png = await page.evaluate(async () => {
      const ex = await import('/js/io/export-image.js');
      const clone = await ex.prepareCloneForCapture(document.getElementById('sF1'), 860, true);
      ex.renderComponentsInClone(clone);
      clone.id = '__clone'; clone.style.position = 'fixed'; clone.style.zIndex = '2147483647'; clone.style.top = '0px'; clone.style.left = '0px'; clone.style.background = '#ffffff';
      const F = clone.querySelector('.frame-block:not([data-text-frame]):not([data-group="true"])');
      const r = F.getBoundingClientRect(); const cr = clone.getBoundingClientRect();
      return { outline: getComputedStyle(F).outlineStyle, h: Math.round(r.height), x: Math.round(r.left - cr.left), y: Math.round(r.top - cr.top), w: Math.round(r.width) };
    });
    expect(png.outline, '★PNG 클론에 점선이 실린다').toBe('none');
    expect(png.h, 'PNG 에서 빈 프레임 높이').toBe(EXPECT_H[kind]);
    await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());
    const shot = await page.locator('#__clone').screenshot({ type: 'png' });
    // 프레임 테두리 1px 안쪽 띠(위·왼쪽)를 훑어 «흰색 아닌» 픽셀 수를 센다 — 점선이 찍히면 #3a3a3a 가 나온다
    const dark = await page.evaluate(async ([b64, p]) => {
      const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
      const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
      const ctx = cv.getContext('2d'); ctx.drawImage(img, 0, 0);
      let n = 0; const sx = img.width / 860;
      for (let i = 2; i < p.w - 2; i++) { const d = ctx.getImageData(Math.round((p.x + i) * sx), Math.round(p.y * sx), 1, 1).data; if (d[0] < 200) n++; }
      for (let j = 2; j < p.h - 2; j++) { const d = ctx.getImageData(Math.round(p.x * sx), Math.round((p.y + j) * sx), 1, 1).data; if (d[0] < 200) n++; }
      return n;
    }, [shot.toString('base64'), png]);
    expect(dark, '★PNG 에 빈 프레임 테두리(어두운 점)가 찍혔다').toBe(0);
    await page.evaluate(() => document.getElementById('__clone')?.remove());
    // 단독 HTML — 진짜 exportHTMLFile 을 돌려 산출 문자열을 받는다
    const html = await page.evaluate(async () => {
      let out = null;
      const oc = URL.createObjectURL; URL.createObjectURL = (b) => { out = b; return 'blob:none'; };
      const ck = HTMLAnchorElement.prototype.click; HTMLAnchorElement.prototype.click = function () {};
      try { await window.exportHTMLFile(); } finally { URL.createObjectURL = oc; HTMLAnchorElement.prototype.click = ck; }
      return out ? await out.text() : null;
    });
    expect(html, 'HTML 산출물을 못 받았다').toBeTruthy();
    const page2 = await page.context().newPage();
    await page2.setViewportSize({ width: 1000, height: 1000 });
    await page2.setContent(html);
    const h2 = await page2.evaluate(() => { const F = document.getElementById('FR'); if (!F) return null; const cs = getComputedStyle(F);
      return { outline: cs.outlineStyle, h: Math.round(F.getBoundingClientRect().height) }; });
    await page2.close();
    expect(h2, 'HTML 에 빈 프레임이 없다').not.toBeNull();
    expect(h2.outline, '★단독 HTML 에 점선이 실린다').toBe('none');
    expect(errs).toEqual([]);
  });
}

test('G ★그룹은 «비면» 같이 걷힌다(그룹 안 마지막 블록 삭제) — 그룹은 사용자가 보는 프레임이 아니다', async ({ page }) => {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate((h) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h.replace('<div class="gap-block" id="gAfter"',
      '<div class="frame-block" id="GR" data-group="true" data-free-layout="true" data-width="600" data-height="200" style="position:relative;width:600px;height:200px;"><div class="asset-block" id="gk" style="position:absolute;left:10px;top:10px;width:200px;height:120px;"><div class="asset-overlay"></div></div></div><div class="gap-block" id="gAfter"'));
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('sF1').classList.add('selected');
    document.getElementById('gk').classList.add('selected');
  }, SEC0);
  await page.evaluate(() => window.deleteSelectedFromCanvas ? window.deleteSelectedFromCanvas() : null);
  if (await page.evaluate(() => !!document.getElementById('gk'))) { await page.keyboard.press('Delete'); await page.waitForTimeout(300); }
  const s = await page.evaluate(() => ({ gk: !!document.getElementById('gk'), GR: !!document.getElementById('GR') }));
  expect(errs).toEqual([]);
  expect(s.gk).toBe(false);
  expect(s.GR, '빈 그룹이 남았다').toBe(false);
});

/* ── 적대QA(2026-10-03) — 중첩 그룹 사슬 · 사용자 프레임 안 그룹 ──
 *   G2: GO[에셋 A, GI[에셋 B]] 에서 A·B 를 지우면 GI·GO 둘 다 걷힌다. (baa6a65d…842be230 판: GO 가 300px «안 보이는 빈 상자»로 남았다 —
 *       후보가 «선택→조상» 순이라 GO 가 GI 보다 먼저 검사돼 「안 빈 그룹(GI)이 들어 있다」로 남았다.)
 *   G3: 사용자 프레임 UF[그룹 G[에셋 C]] 에서 C 를 지우면 G 는 걷히고 UF 는 남는다(사용자 프레임은 비어도 산다). */
const ABS = (id, l, t) => `<div class="asset-block" id="${id}" style="position:absolute;left:${l}px;top:${t}px;width:150px;height:100px;"><div class="asset-overlay"></div></div>`;
async function deleteByKeys(page, html, ids) {
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  await page.evaluate(([h, ids]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h);
    window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('sF1').classList.add('selected');
    ids.forEach(id => document.getElementById(id).classList.add('selected'));
    document.activeElement?.blur?.();
  }, [html, ids]);
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  return errs;
}
const withBody = (body) => SEC0.replace('<div class="gap-block" id="gAfter"', body + '<div class="gap-block" id="gAfter"');

test('G2 ★중첩 그룹 GO[A, GI[B]] — A·B 를 지우면 GI·GO 둘 다 걷힌다(보이지 않는 빈 그룹이 안 남는다)', async ({ page }) => {
  const html = withBody(`<div class="frame-block" id="GO" data-group="true" data-free-layout="true" data-width="600" data-height="300" style="position:relative;width:600px;height:300px;">${ABS('gA', 10, 10)}`
    + `<div class="frame-block" id="GI" data-group="true" data-free-layout="true" style="position:absolute;left:200px;top:120px;width:300px;height:150px;">${ABS('gB', 10, 10)}</div></div>`);
  const errs = await deleteByKeys(page, html, ['gA', 'gB']);
  const s = await page.evaluate(() => ({ A: !!document.getElementById('gA'), B: !!document.getElementById('gB'), GI: !!document.getElementById('GI'), GO: !!document.getElementById('GO') }));
  expect(errs).toEqual([]);
  expect({ A: s.A, B: s.B }, '전제 — 고른 두 에셋이 지워졌다').toEqual({ A: false, B: false });
  expect(s.GI, '안쪽 빈 그룹이 남았다').toBe(false);
  expect(s.GO, '★바깥 빈 그룹이 남았다(안쪽부터 안 봤다 / 그룹을 «남길 프레임»으로 셌다)').toBe(false);
});

test('G3 ★사용자 프레임 UF[그룹 G[에셋 C]] — C 를 지우면 그룹은 걷히고 사용자 프레임은 남는다', async ({ page }) => {
  const html = withBody(`<div class="row" id="rowUF" data-layout="stack"><div class="frame-block" id="UF" data-free-layout="true" data-width="600" data-height="300" style="position:relative;width:600px;height:300px;">`
    + `<div class="frame-block" id="G" data-group="true" data-free-layout="true" style="position:absolute;left:20px;top:20px;width:300px;height:150px;">${ABS('gC', 10, 10)}</div></div></div>`);
  const errs = await deleteByKeys(page, html, ['gC']);
  const s = await page.evaluate(() => ({ C: !!document.getElementById('gC'), G: !!document.getElementById('G'), UF: !!document.getElementById('UF'), ufKids: document.getElementById('UF')?.children.length }));
  expect(errs).toEqual([]);
  expect(s.C, '전제 — 에셋이 지워졌다').toBe(false);
  expect(s.G, '빈 그룹이 남았다').toBe(false);
  expect(s.UF, '★사용자 프레임까지 걷혔다').toBe(true);
  expect(s.ufKids).toBe(0);
});

/* G4 — 적대QA 꼴 그대로 + 3겹: 사용자 프레임 UFx 옆에 GO[A, GM[B, GI[C]]] 를 두고 A·B·C 를 지운다
 *   ⇒ 그룹 0개 · 사용자 프레임 수 그대로(1). 바깥이 먼저 검사되든 안쪽이 먼저든(깊이순 + 고정점) 사슬 전체가 걷혀야 한다. */
test('G4 ★3겹 중첩 그룹 GO[A, GM[B, GI[C]]] 전부 삭제 → 그룹 0개 · 사용자 프레임 수 그대로', async ({ page }) => {
  const GRP = (id, l, t, w, h, inner) => `<div class="frame-block" id="${id}" data-group="true" data-free-layout="true" style="position:${id === 'GO' ? 'relative' : 'absolute'};left:${l}px;top:${t}px;width:${w}px;height:${h}px;">${inner}</div>`;
  const html = withBody(`<div class="row" id="rowUFx" data-layout="stack"><div class="frame-block" id="UFx" data-free-layout="true" style="position:relative;width:600px;height:120px;"></div></div>`
    + GRP('GO', 0, 0, 700, 400, ABS('gA', 10, 10) + GRP('GM', 180, 20, 500, 360, ABS('gB', 10, 10) + GRP('GI', 180, 130, 300, 200, ABS('gC', 10, 10)))));
  const USER = '.frame-block:not([data-text-frame]):not([data-group="true"])';
  await page.setViewportSize({ width: 1500, height: 1100 });
  const errs = await bootApp(page);
  const before = await page.evaluate(([h, U]) => {
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.();
    document.getElementById('sF1').classList.add('selected');
    ['gA', 'gB', 'gC'].forEach(id => document.getElementById(id).classList.add('selected'));
    document.activeElement?.blur?.();
    return { groups: document.querySelectorAll('#sF1 .frame-block[data-group="true"]').length, users: document.querySelectorAll('#sF1 ' + U).length };
  }, [html, USER]);
  expect(before, '전제 — 그룹 셋 · 사용자 프레임 하나').toEqual({ groups: 3, users: 1 });
  await page.keyboard.press('Delete'); await page.waitForTimeout(300);
  const after = await page.evaluate((U) => ({ assets: document.querySelectorAll('#sF1 .asset-block').length,
    groups: document.querySelectorAll('#sF1 .frame-block[data-group="true"]').length, users: document.querySelectorAll('#sF1 ' + U).length }), USER);
  expect(errs).toEqual([]);
  expect(after.assets, '전제 — 고른 세 에셋이 지워졌다').toBe(0);
  expect(after.groups, '★빈 그룹이 남았다').toBe(0);
  expect(after.users, '사용자 프레임 수가 바뀌었다').toBe(before.users);
});
