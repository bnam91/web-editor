/* sec-bg-live.dom.spec.js — b1a ㉮ 「배경이미지 편집 «중» 화면이 굳는다」 · ★편집 중을 재는 자.
 *
 * ★sec-bg-parity(완료 뒤)와 갈라 둠 — tests/dom/sec-bg-parity.dom.spec.js 는 «Esc 로 끝낸 뒤» 를 잰다.
 *   이 파일은 ★mouse.up «전»(조작 중 · rAF 2) 화면을 잰다. 그 자가 0벌이라 e4bb4594(1017t1k1·k2)의
 *   회귀(편집 중 무엇을 해도 화면이 안 바뀜)가 5일 동안 안 잡혔다.
 *
 * ★글자 자는 이 결함에 눈이 없다 — 회전 중 레이어 size 글자가 cover→860px 645px 로 바뀌었는데 화면은 0
 *   (S1-b1a M1 덤 · frame-bg-edit-wiring B3 같은 스타일 문자열 정규식의 거울상) ⇒ ★픽셀 자가 유일한 증인.
 *   구조 자(같은 병이 다른 자리로 다시 들어오는 길) = tests/unit/bg-layer-guard.test.mjs G8.
 *
 * ★★왜 자가 둘인가 — 영수증(평가자 실측 · work-b1a/eval/EVAL.md · 변이 사본):
 *   V1 image-handling.js:1313 에 `!!deg ||` 를 되붙임 ⇒ 이 spec ★9/9 초록(G5b 전 · 지금 11칸 · 편집 중엔 needs 가 늘 참이라 화면 차 0)
 *      · bg-layer-guard ★G8a 빨강(자리 5 · 짝 4 · 짝 아님 1) = ★구조 자만 봤다.
 *   V2 needsBgLayer 의 `_secBgEditing` 줄 삭제 ⇒ 이 spec ★6 빨강(G2 0 · G3 0 · G4 0 · R4-b 0 · R4-c 채도 0 · G9 17)
 *      · unit ★3/3 초록(구조는 그대로) = ★픽셀 자만 봤다.
 *   ⇒ 서로의 사각을 덮었다 — ⛔하나를 지우지 마라.
 *
 * ★자 — 숙주 사각형 안쪽 2px 스크린샷(#ss-handles-overlay 숨김 · deviceScaleFactor 1)
 *   바뀐 픽셀 = RGB 한 채널이라도 차이 > 8 · 분모 = 자른 사각형 픽셀 수.
 *   ★힌트 칩 .img-edit-hint 도 숨긴다(편집 UI · shot() 주석의 실측).
 *   diff 는 별 about:blank 페이지에서 OffscreenCanvas 로(⚠ 앱 페이지 data: fetch 는 CSP — a2a36b2a 선례).
 *   세 장: B = 조작 전 · D = 중(mouse.up 전) · C = Esc 완료 뒤.
 *   ① diff(B,D) > 0 (중에 바뀐다) ② diff(D,C) ≤ 2%·분모 (중 = 완료 뒤 그림 · ★회전 중 그림이 «사라지는»
 *   결함은 ①을 거짓 초록으로 만든다 — ②가 막는다) · G7 diff(B,C) ≥ 50%·분모 (자 양성대조).
 *   ★회전 칸(G4) ② 만 전용 문턱 2,000/39,440 — 근거는 liveCell 주석.
 *   ★하한을 단언한다 — 정확값(스케일 30,575/39,440 · P1·M1 두 런 같음 · 칩 포함 · 칩 숨긴 뒤 29,777)은 뷰포트·줌·무늬·안티앨리어싱에
 *   묶여 하네스가 바뀌면 «고장 아님»에도 빨강이 된다. 정확값은 매 런 [sec-bg-live] 줄로 적는다.
 *   ⛔문턱을 올려 맞추지 마라.
 *
 * ★장면 길 = S1-b1a probe-m1.js 와 같다 — 섹션 HTML + rebindAll · 실제 클릭 선택 · 패널 #sec-bg-hex /
 *   #…-bg-alpha · #…-bg-img-input setInputFiles(160×120 사분면＋사선 PNG) · #…-pos-btn 클릭 → 실제 마우스.
 *   ⚠ 프레임만 window.addFrameBlock() 함수 호출로 짓는다(사람 손 아님).
 *
 * ★무력화 대조표(예측 — S1-b1a PLAN · GD1001_ROOT 사본으로 돌려 칸별로 적는다):
 *   ㉠ 핀 002d9725(처방 전)           ⇒ G2 G3 G4 G5 R4-a G9 빨강 · G1 G7 R4-b R4-c 초록
 *   ㉡ 핀 ＋ :1364 adjHost 옛 꼴(() => proxy) ⇒ G2 G3 G4 R4-b R4-c G9 빨강 · G5 R4-a 초록
 *      (= e4bb4594 가 프레임·반투명을 냈다 · 불투명 섹션은 ㉯ twoLayer 가 둘째 뿌리)
 *   ㉢ 직전 처방판(편집 키에 has-bg-opacity 예외 없음) ⇒ G5b 빨강(편집 중 ::before 변수 안 따라옴 · 평가 F1)
 *   ㉣ 재투입 1 판(adjHost 에 has-bg-opacity 예외 없음) ⇒ R4-d 빨강(채도가 proxy 에 걸려 조용히 버려짐 · 평가 N1)
 *   ⚠ 이 파일이 못 재는 것: has-bg-opacity 프레임의 회전·색보정 «화면»(편집 중 안 보임 · 완료 뒤 그림 사라짐 =
 *     HAS-BG-OPACITY-LAYER-ZERO · R4-d 는 레이어·filter 존재만) · 모달 · 그라데이션 색 · 진입 때 이미 회전/색보정.
 *     2026-10-22 — 회전·색보정 «화면»을 G5c·R4-e 가 잰다(현빈 지시로 픽셀로 옮겼다).
 *   ⚠ 편집 중 반투명 «물들임»은 처방판도 없다(핀과 같음 · R-1) — R4-a 는 diff(D,C) 를 기록만.
 *
 * ⛔전수 금지 — 이 1벌만. 실행: npx playwright test --config=tests/dom/playwright.dom.config.js sec-bg-live.dom
 */
const { test, expect } = require('@playwright/test');
const { bootApp, waitStableRect } = require('./_root-harness.js');

const OPAQUE = '#204080';

const raf2 = (page) => page.waitForFunction(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(() => r(true)))));
const log = (cell, obj) => {
  const line = `[sec-bg-live] ${cell} ${JSON.stringify(obj)}`;
  console.log(line);
  test.info().annotations.push({ type: cell, description: JSON.stringify(obj) });
};

/** 160×120 · 네 사분면 색 + 검은 사선 — 크기·위치·회전이 바뀌면 화면이 반드시 바뀌는 무늬 */
async function makePng(page) {
  const b64 = await page.evaluate(() => {
    const c = document.createElement('canvas'); c.width = 160; c.height = 120;
    const g = c.getContext('2d');
    g.fillStyle = '#e53935'; g.fillRect(0, 0, 80, 60);
    g.fillStyle = '#43a047'; g.fillRect(80, 0, 80, 60);
    g.fillStyle = '#fdd835'; g.fillRect(0, 60, 80, 60);
    g.fillStyle = '#1e88e5'; g.fillRect(80, 60, 80, 60);
    g.strokeStyle = '#000'; g.lineWidth = 3;
    for (let k = -160; k < 320; k += 20) { g.beginPath(); g.moveTo(k, 0); g.lineTo(k + 120, 120); g.stroke(); }
    return c.toDataURL('image/png').split(',')[1];
  });
  return Buffer.from(b64, 'base64');
}

/** 장면: 섹션(또는 그 안 프레임) ＋ 색 ＋ 이미지 → 편집 진입 직전까지. 돌려줌 { errs, host, btnId } */
/* ★second — 프레임을 ★두 번 지어 둘째(첫째 «안»에 들어간다)를 숙주로. G5b 전용.
 *   까닭(실측): css/editor-blocks.css:991-992 `.section-block:hover|.selected .section-inner > :first-child::before
 *   { display:none }` 가 섹션의 첫 자식 프레임의 ::before 를 지운다 — 드래그 중엔 늘 hover 라 has-bg-opacity
 *   프레임 그림이 ★편집 전부터 0픽셀(평가 F1 의 「B0 흰 바탕」). 둘째 프레임은 섹션 첫 자식이 아니라 ::before 가 보인다. */
async function buildScene(page, { color = OPAQUE, alphaPct = null, frame = false, second = false } = {}) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend',
      '<div class="section-block" data-section="1" id="secA" style="height:300px">'
      + '<div class="section-hitzone"></div><div class="section-inner" id="innerA"></div></div>');
    window.rebindAll?.();
    window.__sec = document.getElementById('secA');
  });
  const rect = await waitStableRect(page, '#secA');
  await page.mouse.click(rect.left + 30, rect.top + 30);   // 사람 손 선택
  const buffer = await makePng(page);
  let host = '#secA', pfx = 'sec';
  if (frame) {
    await page.evaluate(() => window.addFrameBlock());     // ⚠ 함수 호출(사람 손 아님)
    if (second) await page.evaluate(() => window.addFrameBlock());
    const fid = await page.evaluate((second) => { const fs = window.__sec.querySelectorAll('.frame-block'); const f = second ? fs[fs.length - 1] : fs[0];
      if (f) f.id = f.id || 'frmA'; window.__frm = f; return f ? f.id : null; }, second);
    expect(fid, '★프레임을 못 지었다').not.toBeNull();
    host = '#' + fid; pfx = 'ss';
    const fr = await waitStableRect(page, host);
    if (!(await page.evaluate(() => !!document.getElementById('ss-bg-hex')))) await page.mouse.click(fr.left + 10, fr.top + 10);
    if (!(await page.evaluate(() => !!document.getElementById('ss-bg-hex')))) await page.evaluate(() => window.showFrameProperties(window.__frm));
  } else if (!(await page.evaluate(() => !!document.getElementById('sec-bg-hex')))) {
    await page.evaluate(() => window.showSectionProperties(window.__sec));
  }
  await page.locator(`#${pfx}-bg-hex`).fill(color.replace('#', ''));
  await page.locator(`#${pfx}-bg-hex`).press('Enter');
  if (alphaPct != null) {
    await page.locator(`#${pfx}-bg-alpha`).fill(String(alphaPct));
    await page.locator(`#${pfx}-bg-alpha`).press('Enter');
  }
  await page.locator(`#${pfx}-bg-img-input`).setInputFiles({ name: 'live.png', mimeType: 'image/png', buffer });
  await page.waitForFunction((h) => (document.querySelector(h)?.dataset.bgImg || '').startsWith('data:image/png'), host, { timeout: 5000 });
  const btnId = frame ? 'ss-bg-pos-btn' : 'sec-bg-pos-btn';
  if (!(await page.evaluate((id) => !!document.getElementById(id), btnId))) {
    await page.evaluate((f) => f ? window.showFrameProperties(window.__frm) : window.showSectionProperties(window.__sec), frame);
  }
  return { errs, host, btnId };
}

/** 편집 진입 — 패널 버튼 클릭 → 프록시 decode → rAF×4 */
async function enterEdit(page, btnId) {
  await page.locator('#' + btnId).click();
  await page.waitForFunction(() => { const i = document.querySelector('.sec-bg-proxy .asset-img'); return !!i && i.complete && i.naturalWidth > 0; }, null, { timeout: 5000 });
  await raf2(page); await raf2(page); await raf2(page);
}

async function exitEdit(page) {
  await page.evaluate(() => document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true })));
  await page.waitForFunction(() => document.querySelectorAll('.sec-bg-proxy').length === 0, null, { timeout: 5000 });
  await raf2(page);
}

/* ★편집 UI 는 자의 분모 밖 — 손잡이 오버레이(#ss-handles-overlay)와 ★같은 부류로 힌트 칩(.img-edit-hint ·
 *   js/image-handling.js 의 enterImageEditMode 가 프록시 안에 붙임)도 숨긴다.
 *   실측(b1a Generator 2026-10-22): 칩을 안 숨기면 G2 ② diff(D,C) = 5,790/39,440 — ★자가 칩을 잰 것
 *   (중엔 칩이 있고 완료 뒤엔 없다). 숨기면 162/39,440. ⛔문턱(2%)은 그대로 — 대상에서 UI 를 뺀 것이다. */
async function shot(page, host) {
  await page.evaluate(() => { const o = document.getElementById('ss-handles-overlay'); if (o) o.style.visibility = 'hidden';
    document.querySelectorAll('.img-edit-hint').forEach(e => { e.style.visibility = 'hidden'; }); });
  await raf2(page);
  const r = await page.evaluate((h) => { const b = document.querySelector(h).getBoundingClientRect();
    return { x: Math.round(b.left) + 2, y: Math.round(b.top) + 2, width: Math.round(b.width) - 4, height: Math.round(b.height) - 4 }; }, host);
  const buf = await page.screenshot({ clip: r });
  await page.evaluate(() => { const o = document.getElementById('ss-handles-overlay'); if (o) o.style.visibility = '';
    document.querySelectorAll('.img-edit-hint').forEach(e => { e.style.visibility = ''; }); });
  return buf;
}

/** 별 about:blank 페이지에서 픽셀 diff */
async function diff(dp, a, b) {
  const r = await dp.evaluate(async ([a64, b64]) => {
    const load = async (s) => createImageBitmap(await (await fetch('data:image/png;base64,' + s)).blob());
    const [A, B] = [await load(a64), await load(b64)];
    if (A.width !== B.width || A.height !== B.height) return { error: `크기 다름 ${A.width}x${A.height} vs ${B.width}x${B.height}` };
    const get = (bm) => { const c = new OffscreenCanvas(bm.width, bm.height); const g = c.getContext('2d'); g.drawImage(bm, 0, 0); return g.getImageData(0, 0, bm.width, bm.height).data; };
    const da = get(A), db = get(B);
    let n = 0;
    for (let i = 0; i < da.length; i += 4) {
      if (Math.abs(da[i] - db[i]) > 8 || Math.abs(da[i + 1] - db[i + 1]) > 8 || Math.abs(da[i + 2] - db[i + 2]) > 8) n++;
    }
    return { changed: n, total: A.width * A.height };
  }, [a.toString('base64'), b.toString('base64')]);
  expect(r.error, r.error).toBeUndefined();
  return r;
}

async function cornerBR(page) {
  return page.evaluate(() => {
    const pts = [...document.querySelectorAll('#ss-handles-overlay .img-corner-handle')].map(e => { const r = e.getBoundingClientRect();
      return { x: r.left + r.width / 2, y: r.top + r.height / 2, hit: document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2) === e }; });
    pts.sort((a, b) => (b.x + b.y) - (a.x + a.y));
    return pts.find(p => p.hit) || pts[0] || null;
  });
}

async function rotateStart(page) {
  return page.evaluate(() => {
    const img = document.querySelector('.sec-bg-proxy .asset-img');
    const zones = [...document.querySelectorAll('#ss-handles-overlay .img-rotate-zone')];
    if (!img || !zones.length) return null;
    const ir = img.getBoundingClientRect();
    const cx = ir.left + ir.width / 2, cy = ir.top + ir.height / 2;
    for (const zone of zones) {
      const zr = zone.getBoundingClientRect(); const pad = 4;
      for (const [zx, zy] of [[zr.left + pad, zr.top + pad], [zr.right - pad, zr.top + pad], [zr.left + pad, zr.bottom - pad], [zr.right - pad, zr.bottom - pad]]) {
        if (zx >= 0 && zy >= 0 && zx <= innerWidth && zy <= innerHeight && document.elementFromPoint(zx, zy) === zone) return { cx, cy, zx, zy };
      }
    }
    return null;
  });
}

/** 조작 «시작 → 중» — mouse.up 은 부르는 쪽이 한다. kind: scale | move | rotate */
async function dragStart(page, host, kind) {
  let from, to;
  if (kind === 'scale') {
    from = await cornerBR(page);
    expect(from, '★코너 손잡이를 못 찾았다').not.toBeNull();
    to = { x: from.x + 120, y: from.y + 90 };
  } else if (kind === 'move') {
    const r = await waitStableRect(page, host);
    from = { x: r.cx, y: r.cy }; to = { x: r.cx + 70, y: r.cy + 45 };
  } else {
    const r = await rotateStart(page);
    expect(r, '★회전존을 못 찾았다').not.toBeNull();
    const startAng = Math.atan2(r.zy - r.cy, r.zx - r.cx);
    const radius = Math.max(60, Math.hypot(r.zx - r.cx, r.zy - r.cy));
    const ang = startAng + 30 * Math.PI / 180;
    from = { x: r.zx, y: r.zy }; to = { x: r.cx + radius * Math.cos(ang), y: r.cy + radius * Math.sin(ang) };
  }
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await raf2(page);
}

const clipCount = (page, host) => page.evaluate((h) => document.querySelector(h).querySelectorAll(':scope > .sec-bg-clip').length, host);

/** 새 맥락(DSF 1) 하나 + diff 페이지 */
async function open(browser) {
  const ctx = await browser.newContext({ deviceScaleFactor: 1 });
  const page = await ctx.newPage();
  const dctx = await browser.newContext();
  const dp = await dctx.newPage();
  await dp.goto('about:blank');
  return { ctx, page, dctx, dp, close: async () => { await ctx.close(); await dctx.close(); } };
}

/** G2~G5 공통 — ① ② G7 */
async function liveCell(browser, cell, { kind, frame = false }) {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page, { frame });
    await enterEdit(o.page, btnId);
    const pre = await o.page.evaluate((h) => { const el = document.querySelector(h);
      return { editing: !!el._secBgEditing, clips: el.querySelectorAll(':scope > .sec-bg-clip').length, needs: window.needsBgLayer?.(el) }; }, host);
    const B = await shot(o.page, host);
    await dragStart(o.page, host, kind);
    const mid = await o.page.evaluate((h) => { const el = document.querySelector(h); const cs = getComputedStyle(el);
      return { hostCsBgSize: cs.backgroundSize, hostInlineBgImage: (el.style.backgroundImage || '').slice(0, 30), clips: el.querySelectorAll(':scope > .sec-bg-clip').length }; }, host);
    const D = await shot(o.page, host);
    await o.page.mouse.up();
    await raf2(o.page);
    await exitEdit(o.page);
    const C = await shot(o.page, host);
    const bd = await diff(o.dp, B, D), dc = await diff(o.dp, D, C), bc = await diff(o.dp, B, C);
    log(cell, { kind, frame, pre, mid, BD: `${bd.changed}/${bd.total}`, DC: `${dc.changed}/${dc.total}`, BC: `${bc.changed}/${bc.total}`, DCpct: +(100 * dc.changed / dc.total).toFixed(2) });
    /* G7 먼저 — 자가 살아 있나(양성대조).
       ★기준점 30,575/39,440 은 ★칩(.img-edit-hint) 포함 실측(P1·M1) · 칩을 숨긴 뒤(이 자) 29,777. */
    expect(bc.changed, `★G7 ${cell} 자 양성대조: Esc 뒤 대 전 ${bc.changed}/${bc.total} < 50%`).toBeGreaterThanOrEqual(bc.total * 0.5);
    expect(bd.changed, `★${cell} ① 조작 «중» 화면이 안 바뀐다(굳음): diff(B,D) ${bd.changed}/${bd.total}`).toBeGreaterThan(0);
    /* ② 문턱 — 다른 칸은 2%·분모. ★회전 칸(G4)만 전용 문턱 2,000/39,440(≈5.1%) — S1 판정 · 근거 세 칸:
         ㉠ 실측 898/39,440 (편집 중 30.1448° ↔ 완료 뒤 _r1 30.1°)
         ㉡ 편집 중 레이어를 같은 각도 rotate(30.1deg)로 맞춰도 748/39,440 — 픽셀당 최대 33/채널 · 116줄 전체에 옅게.
            원인 «못 잼» — 편집 중/완료 뒤 그리기 길 차이로 추정(work-b1a/scripts/diag-rot.js)
         ㉢ 실패꼴(회전 안 됨) ≈ G7 회전 34,264/39,440
         ⇒ 문턱 = 실측의 2.2배 · 실패꼴의 1/17. ⛔다른 칸으로 넓히지 마라. */
    const dcMax = kind === 'rotate' ? 2000 : dc.total * 0.02;
    expect(dc.changed, `★${cell} ② 중 ≠ 완료 뒤: diff(D,C) ${dc.changed}/${dc.total} > ${kind === 'rotate' ? '2,000(회전 전용)' : '2%'}`).toBeLessThanOrEqual(dcMax);
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
}

/* ═══ G1 전제 ═══════════════════════════════════════════════════════════════ */
test('G1 ★전제 — 불투명 섹션＋이미지 · 편집 진입 상태', async ({ browser }) => {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page);
    await enterEdit(o.page, btnId);
    const s = await o.page.evaluate((h) => { const el = document.querySelector(h); const pi = document.querySelector('.sec-bg-proxy .asset-img');
      return { bg: el.dataset.bg, img: (el.dataset.bgImg || '').slice(0, 14), editing: !!el._secBgEditing,
        proxies: document.querySelectorAll('.sec-bg-proxy').length, nw: pi ? pi.naturalWidth : 0,
        clips: el.querySelectorAll(':scope > .sec-bg-clip').length, needs: window.needsBgLayer?.(el) }; }, host);
    log('G1', s);   // 레이어 수·needs 는 기록만(처방과 무관한 전제)
    expect([s.bg, s.img, s.editing, s.proxies, s.nw > 0]).toEqual([OPAQUE, 'data:image/png', true, 1, true]);
    await exitEdit(o.page);
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
});

/* ═══ G2~G5 · G7 ═══════════════════════════════════════════════════════════ */
test('G2 ★섹션 불투명 · 스케일 중 화면이 바뀐다 (= O 불투명 스케일)', async ({ browser }) => { await liveCell(browser, 'G2', { kind: 'scale' }); });
test('G3 ★섹션 불투명 · 위치(끌기) 중 화면이 바뀐다', async ({ browser }) => { await liveCell(browser, 'G3', { kind: 'move' }); });
test('G4 ★섹션 불투명 · 회전 중 화면이 바뀐다(그림이 사라지지 않고)', async ({ browser }) => { await liveCell(browser, 'G4', { kind: 'rotate' }); });
test('G5 ★프레임 불투명 · 스케일 중 화면이 바뀐다', async ({ browser }) => { await liveCell(browser, 'G5', { kind: 'scale', frame: true }); });

/* ═══ G5b has-bg-opacity 프레임(::before 가 그린다 · b1a 재투입 F1) ════════════
   투명도 = 패널 UI(#ss-bgopa-num · prop-frame applyBgOpacity 길). 예측: 이번 판 초록 · 직전 판(편집 키에
   has-bg-opacity 예외 없음) 빨강(편집 중 writeLive 가 안 불려 ::before 변수가 안 따라옴) · 핀 초록. */
test('G5b ★반투명(has-bg-opacity) 프레임 · ::before 가 보이는 장면 · 스케일 중 화면이 바뀐다', async ({ browser }) => {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page, { frame: true, second: true });
    await o.page.locator('#ss-bgopa-num').fill('50');      // 패널 투명도 칸(input 이벤트 → applyBgOpacity)
    await raf2(o.page);
    const pre = await o.page.evaluate((h) => { const el = document.querySelector(h); const b = getComputedStyle(el, '::before');
      return { opa: el.classList.contains('has-bg-opacity'), beforeImg: b.backgroundImage !== 'none', beforeDisplay: b.display }; }, host);
    /* 전제: 조작 전 화면에 «그림» 픽셀 > 0 — --frame-bg-img 를 잠깐 none 으로 찍은 것과 다르다 */
    const B = await shot(o.page, host);
    await o.page.evaluate((h) => { const el = document.querySelector(h); window.__g5bImg = el.style.getPropertyValue('--frame-bg-img'); el.style.setProperty('--frame-bg-img', 'none'); }, host);
    const Bn = await shot(o.page, host);
    await o.page.evaluate((h) => { document.querySelector(h).style.setProperty('--frame-bg-img', window.__g5bImg); }, host);
    await raf2(o.page);
    const vis = await diff(o.dp, B, Bn);
    await enterEdit(o.page, btnId);
    const B2 = await shot(o.page, host);
    await dragStart(o.page, host, 'scale');
    const mid = await o.page.evaluate((h) => { const el = document.querySelector(h);
      return { varSize: el.style.getPropertyValue('--frame-bg-size'), clips: el.querySelectorAll(':scope > .sec-bg-clip').length }; }, host);
    const D = await shot(o.page, host);
    await o.page.mouse.up(); await raf2(o.page);
    await exitEdit(o.page);
    const C = await shot(o.page, host);
    const bd = await diff(o.dp, B2, D), dc = await diff(o.dp, D, C);
    log('G5b', { pre, imgVisible: `${vis.changed}/${vis.total}`, mid, BD: `${bd.changed}/${bd.total}`, DC_record: `${dc.changed}/${dc.total}` });
    expect(pre, '★G5b 전제: has-bg-opacity · ::before 그림 · display').toEqual({ opa: true, beforeImg: true, beforeDisplay: 'block' });
    expect(vis.changed, `★G5b 전제: 조작 전 ::before 그림 픽셀이 0 이다(${vis.changed}/${vis.total}) — 장면이 이 길을 못 본다`).toBeGreaterThan(0);
    expect(bd.changed, `★G5b 스케일 중 화면 굳음(::before 변수가 안 따라옴): ${bd.changed}/${bd.total}`).toBeGreaterThan(0);
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
});

/* ═══ R4-d 반투명 프레임 색보정 «완료 뒤» — 핀 꼴(레이어 1 · filter 유지) · b1a N1 ═══════════════
   ★시끄러운 결함으로 되돌린 것 — 완료 뒤 그림이 사라짐(레이어 높이 0 · --frame-bg-img none)은 HAS-BG-OPACITY-LAYER-ZERO.
   ⛔이 칸은 «그림이 보인다»를 재지 않는다. 채도 입력이 조용히 버려지지 않음(레이어·filter 가 남음)만 잠근다.
   예측: 이번 판 초록 · 직전 판(adjHost 예외 없음 → 색보정이 proxy 에 걸려 버려짐) 빨강 · 핀 초록. */
test('R4-d ★반투명(has-bg-opacity) 프레임 · 채도 -100 → Esc ⇒ 레이어 1 · filter 유지(핀 꼴)', async ({ browser }) => {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page, { frame: true, second: true });
    await o.page.locator('#ss-bgopa-num').fill('50');
    await raf2(o.page);
    await enterEdit(o.page, btnId);
    await saturate(o.page);
    await exitEdit(o.page);
    const r = await o.page.evaluate((h) => { const el = document.querySelector(h); const L = el.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
      return { opa: el.classList.contains('has-bg-opacity'), clips: el.querySelectorAll(':scope > .sec-bg-clip').length,
        filter: L ? L.style.filter.slice(0, 40) : null, needs: window.needsBgLayer?.(el), frameBgImg: el.style.getPropertyValue('--frame-bg-img').slice(0, 20) }; }, host);
    log('R4-d', r);
    expect(r.opa, '★R4-d 전제: has-bg-opacity').toBe(true);
    expect(r.clips, '★R4-d 완료 뒤 레이어가 없다 — 채도가 조용히 버려졌다(proxy 에 걸림)').toBe(1);
    expect(r.filter, '★R4-d 완료 뒤 레이어 filter 가 채도를 안 든다').toMatch(/url\(["']?#img-color-adj-/);
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
});

/* ═══ G5c · R4-e 반투명(has-bg-opacity) 프레임 «화면» — HAS-BG-OPACITY-LAYER-ZERO 를 픽셀로 (2026-10-22 · 현빈 지시) ══
   ★G5b 조리법 그대로(둘째 프레임 · #ss-bgopa-num 50 · 전제 opa/beforeImg/beforeDisplay ＋ vis = --frame-bg-img 잠깐 none 과의 차).
   세 장 B2(진입 뒤 조작 전) · D(조작 중 · mouse.up 전) · C(Esc 완료 뒤):
     ⑴ 양성대조 diff(B2,C) ≥ 50%·분모 (자가 사는가) → ① diff(B2,D) > 0 (중에 바뀐다) → ② 뒤 그림 픽셀 > 0 («화면» 자 · 지디 ⒜ 2026-10-22)
        («완료 뒤 그림이 사라짐»을 ① 혼자는 못 막는다). DC 는 기록만(아래 단언 자리 주석 · 머리말 R-1).
   ★음성대조(-neg) — 편집 진입 «전» `#host{--frame-bg-img:none !important}` 규칙을 문서에 단다(인라인 변수 쓰기를 이긴다 · 제품 코드 무변)
     ⇒ 그림이 없으면 ① 이 «안» 떠야 한다(BD = 0). 뜨면 ① 은 ::before 그림이 아닌 다른 길(프록시·레이어·UI)을 잰다. */
/* ★빨강이 참인 칸의 메시지 꼬리 — 이름 · 판 · 판 근거 · 뜻 · 날짜(지디 판정 2026-10-22 · ⛔test.fixme/skip 금지 · dev 머지는 고침과 같이). */
const LAYER_ZERO_TAIL = ' — HAS-BG-OPACITY-LAYER-ZERO · 판 378db8296845bf71bbe6fbe5344d0ee4c28a44c1'
  + ' · c5aa02eb ⊂ 378db829 merge-base 로 확인(태양) · 고치면 초록이 된다 — 고치기 전엔 이 빨강이 참이다 · 2026-10-22';
async function opaCell(browser, cell, { act, neg = false }) {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page, { frame: true, second: true });
    await o.page.locator('#ss-bgopa-num').fill('50');
    await raf2(o.page);
    const pre = await o.page.evaluate((h) => { const el = document.querySelector(h); const b = getComputedStyle(el, '::before');
      return { opa: el.classList.contains('has-bg-opacity'), beforeImg: b.backgroundImage !== 'none', beforeDisplay: b.display }; }, host);
    const B = await shot(o.page, host);
    await o.page.evaluate((h) => { const el = document.querySelector(h); window.__opaImg = el.style.getPropertyValue('--frame-bg-img'); el.style.setProperty('--frame-bg-img', 'none'); }, host);
    const Bn = await shot(o.page, host);
    await o.page.evaluate((h) => { document.querySelector(h).style.setProperty('--frame-bg-img', window.__opaImg); }, host);
    await raf2(o.page);
    const vis = await diff(o.dp, B, Bn);
    if (neg) await o.page.evaluate((h) => { const st = document.createElement('style'); st.id = '__opa-neg'; st.textContent = `${h}{--frame-bg-img:none !important}`; document.head.appendChild(st); }, host);
    await enterEdit(o.page, btnId);
    const B2 = await shot(o.page, host);
    const pos0 = await o.page.evaluate((h) => document.querySelector(h).dataset.bgPos || null, host);
    if (act === 'rotate' || act === 'move') await dragStart(o.page, host, act);
    else await saturate(o.page);
    const mid = await o.page.evaluate((h) => { const el = document.querySelector(h); const px = document.querySelector('.sec-bg-proxy');
      const L = el.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
      return { varImg: el.style.getPropertyValue('--frame-bg-img').slice(0, 20), clips: el.querySelectorAll(':scope > .sec-bg-clip').length,
        proxies: document.querySelectorAll('.sec-bg-proxy').length,
        /* ★조작이 «걸렸나» — BD = 0 의 두 까닭(정말 안 따라감 / 장면이 조작을 못 보냄)을 가른다(지디 판정 ⑵) */
        rot: px ? parseFloat(px.dataset.imgRotate || 0) : null,
        pxX: px ? parseFloat(px.dataset.imgX || 0) : null, pxY: px ? parseFloat(px.dataset.imgY || 0) : null,
        imgLeft: (() => { const i = document.querySelector('.sec-bg-proxy .asset-img'); return i ? i.style.left : null; })(),
        sat: [...document.querySelectorAll('[data-adj-saturation]')].map(e => e.dataset.adjSaturation).slice(0, 3),
        layerFilter: L ? (L.style.filter || '').slice(0, 40) : null }; }, host);
    const D = await shot(o.page, host);
    if (act === 'rotate' || act === 'move') { await o.page.mouse.up(); await raf2(o.page); }
    await exitEdit(o.page);
    const C = await shot(o.page, host);
    /* 뒤 그림 픽셀(기록만) — afterCell 과 같은 자: ::before 배경 + .sec-bg-clip 둘 다 끈 Cn 과의 차. ② DC 의 큰 값이
       «그림이 사라짐»인지 «편집 중/뒤 투명도 차»인지 가른다(×3 런 1 G5d). */
    await o.page.evaluate((h) => { const st = document.createElement('style'); st.id = '__opa-off';
      st.textContent = `${h}::before{background-image:none !important} ${h} > .sec-bg-clip{visibility:hidden !important}`; document.head.appendChild(st); }, host);
    const Cn = await shot(o.page, host);
    await o.page.evaluate(() => document.getElementById('__opa-off')?.remove());
    const pic = await diff(o.dp, C, Cn);
    const after = await o.page.evaluate((h) => { const el = document.querySelector(h); const b = getComputedStyle(el, '::before');
      const L = el.querySelector(':scope > .sec-bg-clip'); const LI = el.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
      return { opa: el.classList.contains('has-bg-opacity'), clips: el.querySelectorAll(':scope > .sec-bg-clip').length,
        bgRotate: el.dataset.bgRotate || null, bgPos: el.dataset.bgPos || null, layerFilter: LI ? (LI.style.filter || '').slice(0, 40) : null,
        layerH: L ? Math.round(L.getBoundingClientRect().height) : null, varImg: el.style.getPropertyValue('--frame-bg-img').slice(0, 20),
        beforeImg: b.backgroundImage !== 'none' }; }, host);
    const bd = await diff(o.dp, B2, D), dc = await diff(o.dp, D, C), bc = await diff(o.dp, B2, C);
    log(cell, { act, neg, pos0, pre, imgVisible: `${vis.changed}/${vis.total}`, mid, after,
      BD: `${bd.changed}/${bd.total}`, DC: `${dc.changed}/${dc.total}`, BC: `${bc.changed}/${bc.total}`, picAfter_record: `${pic.changed}/${pic.total}`,
      BDpct: +(100 * bd.changed / bd.total).toFixed(2), DCpct: +(100 * dc.changed / dc.total).toFixed(2), BCpct: +(100 * bc.changed / bc.total).toFixed(2) });
    expect(pre, `★${cell} 전제: has-bg-opacity · ::before 그림 · display`).toEqual({ opa: true, beforeImg: true, beforeDisplay: 'block' });
    expect(vis.changed, `★${cell} 전제: 조작 전 ::before 그림 픽셀이 0 이다(${vis.changed}/${vis.total}) — 장면이 이 길을 못 본다`).toBeGreaterThan(0);
    if (act === 'rotate') {
      expect(Math.abs(mid.rot), `★${cell} 전제: 회전이 상태에 안 들어갔다(조작 중 proxy imgRotate = ${mid.rot}) — 장면이 조작을 못 보냈다`).toBeGreaterThan(1);
      expect(Math.abs(parseFloat(after.bgRotate || 0)), `★${cell} 전제: 완료 뒤 bgRotate = ${after.bgRotate}`).toBeGreaterThan(1);
    } else if (act === 'move') {
      expect(mid.imgLeft, `★${cell} 전제: 위치가 조작 중 상태에 안 들어갔다(프록시 그림 left = ${mid.imgLeft})`).toMatch(/px$/);
      expect(after.bgPos, `★${cell} 전제: 완료 뒤 bgPos 가 안 바뀌었다(${pos0} → ${after.bgPos})`).not.toBe(pos0);
    } else {
      /* 앱은 채도를 −1.000(−100 % 의 정규화)으로 든다 — 레이어 filter 의 …_m1p000 과 같은 값. ⛔'-100' 글자만 찾지 마라(×3 런 1 에서 밟음). */
      expect(mid.sat.some(v => [-1, -100].includes(parseFloat(v))), `★${cell} 전제: 채도가 상태에 안 들어갔다(조작 중 data-adj-saturation = ${JSON.stringify(mid.sat)})`).toBe(true);
      expect(after.layerFilter || '', `★${cell} 전제: 완료 뒤 레이어 filter 가 채도를 안 든다`).toMatch(/url\(["']?#img-color-adj-/);
    }
    /* ★② 는 «뒤 그림»으로 잰다 — DC 는 기록만(태양·지디 2026-10-22). 까닭 = 머리말 원문
       «⚠ 편집 중 반투명 «물들임»은 처방판도 없다(핀과 같음 · R-1) — R4-a 는 diff(D,C) 를 기록만.»
       ⇒ 반투명은 중↔뒤 화면 차가 노이즈로 크다(×3 런 2: G5d DC 69,360/69,360 인데 뒤 그림 68,968 남음).
       ⛔불투명 칸(liveCell)의 ② 는 그대로 DC ≤ 2%. */
    if (neg) {
      expect(bd.changed, `★${cell} 음성대조: 그림을 none 으로 막았는데 조작 중 화면이 바뀐다 ${bd.changed}/${bd.total} — ① 이 그림 아닌 것을 잰다`).toBe(0);
      /* ② 반대 꼴(지디): 그림이 없으면 «뒤 그림 픽셀 = 0» — 본 칸 «있으면 > 0» 과 두 방향이 서서 자가 그 자리를 본다. */
      expect(pic.changed, `★${cell} 음성대조 ②: 그림을 막았는데 뒤 그림 픽셀 ${pic.changed}/${pic.total} — 뒤 그림 자가 그림 아닌 것을 잰다`).toBe(0);
    } else {
      expect(bc.changed, `★${cell} ⑴ 자 양성대조: Esc 뒤 대 전 ${bc.changed}/${bc.total} < 50%`).toBeGreaterThanOrEqual(bc.total * 0.5);
      expect(bd.changed, `★${cell} ① 조작 «중» 화면이 안 바뀐다: diff(B2,D) ${bd.changed}/${bd.total}${LAYER_ZERO_TAIL}`).toBeGreaterThan(0);
      expect(pic.changed, `★${cell} ② 완료 뒤 화면에 그림이 없다: diff(C, 그림 끈 C) ${pic.changed}/${pic.total}${LAYER_ZERO_TAIL}`).toBeGreaterThan(0);
      /* ⛔범위 밖 — IMPL-COUPLED-ASSERTION-01 (지디 ⒜ 2026-10-22): 옛 단언 `expect(after.varImg).not.toBe('none')`.
         이 자는 «누가 그리나»(::before 변수 길)를 재므로 «화면이 맞나» 물음에 못 쓴다 — frame-bg.js syncFrameBgVars 가
         레이어 길이면 설계상 none 을 쓴다 ⇒ 영영 빨강. 값은 log 의 after.varImg 에 남는다. 화면 물음은 바로 위 ② pic. */
    }
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
}
test('G5c ★반투명(has-bg-opacity) 프레임 · 회전 중 화면이 바뀐다 · 완료 뒤 그림이 사라지지 않는다', async ({ browser }) => { await opaCell(browser, 'G5c', { act: 'rotate' }); });
test('G5d ★반투명(has-bg-opacity) 프레임 · 배경 위치 이동(끌기) 중 화면이 바뀐다 · 완료 뒤 유지 (현빈 [9] · G3 의 반투명판)', async ({ browser }) => { await opaCell(browser, 'G5d', { act: 'move' }); });
test('G5c-neg ★음성대조 — 그림(--frame-bg-img) none 이면 회전 중 화면이 안 바뀐다', async ({ browser }) => { await opaCell(browser, 'G5c-neg', { act: 'rotate', neg: true }); });
test('R4-e ★반투명(has-bg-opacity) 프레임 · 채도 -100 조작 «중» 화면이 바뀐다 · 완료 뒤 유지', async ({ browser }) => { await opaCell(browser, 'R4-e', { act: 'sat' }); });
test('R4-e-neg ★음성대조 — 그림(--frame-bg-img) none 이면 채도 조작 중 화면이 안 바뀐다', async ({ browser }) => { await opaCell(browser, 'R4-e-neg', { act: 'sat', neg: true }); });

/* ═══ G5b-after · R4-d-after — 기존 G5b · R4-d 가 초록인 까닭이 «고쳐져서»인가 «그 축을 안 재서»인가 (지디 판정 ⑷ · 2026-10-22) ══
   ★기존 G5b(스케일 «중»만) · R4-d(레이어·filter «존재»만)는 ⛔그대로 둔다. 여기는 «완료 뒤 그림이 보이나»만 잰다.
   단언(순서): 전제(opa · ::before 그림 · vis > 0 · 조작이 상태에 들어감) → 화면 그림 있음(픽셀).
   --frame-bg-img ≠ none = 기록만(구현 단언 · IMPL-COUPLED-ASSERTION-01 · 지디 ⒜ 2026-10-22).
   레이어 수·높이 = 기록만(구현 단언 · IMPL-COUPLED-ASSERTION-01).
   «화면 그림 픽셀» = diff(C, Cn) · Cn = C 에서 ::before 배경과 .sec-bg-clip 을 «둘 다» 끈 것(어느 길이 그리든 그림이 있으면 > 0). */
async function afterCell(browser, cell, { act }) {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page, { frame: true, second: true });
    await o.page.locator('#ss-bgopa-num').fill('50');
    await raf2(o.page);
    const pre = await o.page.evaluate((h) => { const el = document.querySelector(h); const b = getComputedStyle(el, '::before');
      return { opa: el.classList.contains('has-bg-opacity'), beforeImg: b.backgroundImage !== 'none', beforeDisplay: b.display }; }, host);
    const B = await shot(o.page, host);
    await o.page.evaluate((h) => { const el = document.querySelector(h); window.__aImg = el.style.getPropertyValue('--frame-bg-img'); el.style.setProperty('--frame-bg-img', 'none'); }, host);
    const Bn = await shot(o.page, host);
    await o.page.evaluate((h) => { document.querySelector(h).style.setProperty('--frame-bg-img', window.__aImg); }, host);
    await raf2(o.page);
    const vis = await diff(o.dp, B, Bn);
    const before = await o.page.evaluate((h) => ({ bgSize: document.querySelector(h).dataset.bgSize || null }), host);
    await enterEdit(o.page, btnId);
    if (act === 'scale') { await dragStart(o.page, host, 'scale'); await o.page.mouse.up(); await raf2(o.page); }
    else await saturate(o.page);
    await exitEdit(o.page);
    const C = await shot(o.page, host);
    const after = await o.page.evaluate((h) => { const el = document.querySelector(h); const b = getComputedStyle(el, '::before');
      const L = el.querySelector(':scope > .sec-bg-clip'); const LI = el.querySelector(':scope > .sec-bg-clip > .sec-bg-img');
      return { opa: el.classList.contains('has-bg-opacity'), clips: el.querySelectorAll(':scope > .sec-bg-clip').length,
        layerH: L ? Math.round(L.getBoundingClientRect().height) : null, varImg: el.style.getPropertyValue('--frame-bg-img').slice(0, 20),
        beforeImg: b.backgroundImage !== 'none', bgSize: el.dataset.bgSize || null, layerFilter: LI ? (LI.style.filter || '').slice(0, 40) : null }; }, host);
    await o.page.evaluate((h) => { const st = document.createElement('style'); st.id = '__after-off';
      st.textContent = `${h}::before{background-image:none !important} ${h} > .sec-bg-clip{visibility:hidden !important}`; document.head.appendChild(st); }, host);
    const Cn = await shot(o.page, host);
    const pic = await diff(o.dp, C, Cn), bc = await diff(o.dp, B, C);
    log(cell, { act, pre, imgVisible: `${vis.changed}/${vis.total}`, before, after, picAfter: `${pic.changed}/${pic.total}`, BC: `${bc.changed}/${bc.total}` });
    expect(pre, `★${cell} 전제: has-bg-opacity · ::before 그림 · display`).toEqual({ opa: true, beforeImg: true, beforeDisplay: 'block' });
    expect(vis.changed, `★${cell} 전제: 조작 전 ::before 그림 픽셀이 0 이다(${vis.changed}/${vis.total})`).toBeGreaterThan(0);
    if (act === 'scale') expect(after.bgSize, `★${cell} 전제: 스케일이 상태에 안 들어갔다(bgSize ${before.bgSize} → ${after.bgSize})`).toMatch(/^\d+(\.\d+)?px \d+(\.\d+)?px$/);
    else expect(after.layerFilter || '', `★${cell} 전제: 완료 뒤 레이어 filter 가 채도를 안 든다`).toMatch(/url\(["']?#img-color-adj-/);
    expect(pic.changed, `★${cell} 완료 뒤 화면에 그림이 없다: diff(C, 그림 끈 C) ${pic.changed}/${pic.total}${LAYER_ZERO_TAIL}`).toBeGreaterThan(0);
    /* ⛔범위 밖 — IMPL-COUPLED-ASSERTION-01 (지디 ⒜ 2026-10-22): 옛 단언 `expect(after.varImg).not.toBe('none')`.
       이 자는 «누가 그리나»를 재므로 «화면이 맞나» 물음에 못 쓴다(레이어가 그리면 설계상 none · frame-bg.js syncFrameBgVars).
       값은 log 의 after.varImg 에 남는다. */
    /* ★구현 단언 — 기록만(IMPL-COUPLED-ASSERTION-01 · 지디 2026-10-22): «레이어 높이 > 0» 은 그리는 방식을 전제한다.
       스케일 완료 뒤엔 ::before 가 그리고 레이어가 «없다»(×3 런 1·2: 그림 69,320 보임 · clips 0) ⇒ 단언하면 거짓 빨강.
       사용자가 보는 것은 «그림»이다 — 주 단언은 위 뒤 그림 픽셀 하나. 레이어 수·높이는 log 의 after 에 남는다. */
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
}
test('G5b-after ★반투명 프레임 · 스케일 완료(Esc) 뒤 그림이 보인다', async ({ browser }) => { await afterCell(browser, 'G5b-after', { act: 'scale' }); });
test('R4-d-after ★반투명 프레임 · 채도 −100 완료(Esc) 뒤 그림이 보인다', async ({ browser }) => { await afterCell(browser, 'R4-d-after', { act: 'sat' }); });

/* ═══ R4-a 반투명 ═══════════════════════════════════════════════════════════ */
test('R4-a ★반투명 섹션 · 스케일 중 바뀐다 · 완료 뒤 물들임 복귀(레이어 0)', async ({ browser }) => {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page, { alphaPct: 50 });
    await enterEdit(o.page, btnId);
    const B = await shot(o.page, host);
    await dragStart(o.page, host, 'scale');
    const D = await shot(o.page, host);
    await o.page.mouse.up(); await raf2(o.page);
    await exitEdit(o.page);
    const C = await shot(o.page, host);
    const after = await o.page.evaluate((h) => { const el = document.querySelector(h);
      return { grad: /gradient/.test(getComputedStyle(el).backgroundImage), clips: el.querySelectorAll(':scope > .sec-bg-clip').length }; }, host);
    const bd = await diff(o.dp, B, D), dc = await diff(o.dp, D, C);
    log('R4-a', { BD: `${bd.changed}/${bd.total}`, DC_record: `${dc.changed}/${dc.total}`, after });
    expect(bd.changed, `★R4-a 반투명 스케일 중 화면 굳음: ${bd.changed}/${bd.total}`).toBeGreaterThan(0);
    expect(after, '★R4-a 완료 뒤 물들임(gradient)·레이어 0 이 아니다').toEqual({ grad: true, clips: 0 });
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
});

/* ═══ R4-b 색보정 실시간 ═══════════════════════════════════════════════════ */
async function saturate(page) {
  await page.waitForFunction(() => !!document.getElementById('ca-saturation'), null, { timeout: 3000 });
  await page.evaluate(() => { const s = document.getElementById('ca-saturation'); s.value = '-100'; s.dispatchEvent(new Event('input', { bubbles: true })); });
  await raf2(page);
}
test('R4-b ★색보정 채도 -100 조작 중 화면이 바뀐다(실시간)', async ({ browser }) => {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page);
    await enterEdit(o.page, btnId);
    const B = await shot(o.page, host);
    await saturate(o.page);
    const D = await shot(o.page, host);
    const bd = await diff(o.dp, B, D);
    log('R4-b', { BD: `${bd.changed}/${bd.total}` });
    expect(bd.changed, `★R4-b 채도 슬라이더가 화면에 안 닿는다: ${bd.changed}/${bd.total}`).toBeGreaterThan(0);
    await exitEdit(o.page);
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
});

/* ═══ R4-c 완료 뒤 레이어 수 ═══════════════════════════════════════════════ */
test('R4-c ★완료 뒤 레이어 수 — 스케일만 0 · 회전 1 · 채도 -100 1', async ({ browser }) => {
  const got = [];
  for (const act of ['scale', 'rotate', 'sat']) {
    const o = await open(browser);
    try {
      const { host, btnId } = await buildScene(o.page);
      await enterEdit(o.page, btnId);
      if (act === 'sat') await saturate(o.page);
      else { await dragStart(o.page, host, act); await o.page.mouse.up(); await raf2(o.page); }
      await exitEdit(o.page);
      got.push(await clipCount(o.page, host));
    } finally { await o.close(); }
  }
  log('R4-c', { scale: got[0], rotate: got[1], sat: got[2] });
  expect(got, '★R4-c 완료 뒤 레이어 수 [스케일, 회전, 채도]').toEqual([0, 1, 1]);
});

/* ═══ G9 ㉯ twoLayer 갈래 스파이(지디 판정 j2 ②㉢) ═════════════════════════
   편집 중(스케일·위치 드래그) 숙주에 «두 층» 꼴(`cover, …` · `center, …`)이 한 번이라도 쓰였나를 관찰한다.
   ⛔제품 코드에 훅 없음 — BG_EDIT_HOSTS 는 window 에 노출 안 됨 ⇒ MutationObserver 관찰 꼴.
   예측: 처방판 0(갈래 안 닿음) · 핀 ≥1(빨강 · 진입 첫 syncBg 부터 writeLive 가 `cover, Wpx Hpx`). */
test('G9 ★편집 중 twoLayer(writeLive 두 층) 갈래가 안 불린다 — 불투명 섹션 스케일·위치', async ({ browser }) => {
  const o = await open(browser);
  try {
    const { errs, host, btnId } = await buildScene(o.page);
    await o.page.evaluate((h) => {
      const el = document.querySelector(h);
      window.__g9 = { writes: 0, vals: [] };
      window.__g9obs = new MutationObserver(() => {
        const s = el.style.backgroundSize, p = el.style.backgroundPosition;
        if (/,/.test(s) || /,/.test(p)) { window.__g9.writes++; if (window.__g9.vals.length < 4) window.__g9.vals.push(`${s} | ${p}`); }
      });
      window.__g9obs.observe(el, { attributes: true, attributeFilter: ['style'] });
    }, host);
    await enterEdit(o.page, btnId);
    await dragStart(o.page, host, 'scale'); await o.page.mouse.up(); await raf2(o.page);
    await dragStart(o.page, host, 'move');  await o.page.mouse.up(); await raf2(o.page);
    const g9 = await o.page.evaluate(() => new Promise(r => setTimeout(() => { window.__g9obs.disconnect(); r(JSON.parse(JSON.stringify(window.__g9))); }, 0)));
    log('G9', g9);
    expect(g9.writes, `★G9 편집 중 twoLayer 두 층 쓰기가 ${g9.writes}회 — 죽은 갈래가 살아 있다: ${g9.vals.join(' / ')}`).toBe(0);
    await exitEdit(o.page);
    expect(errs, errs.join('\n')).toEqual([]);
  } finally { await o.close(); }
});
