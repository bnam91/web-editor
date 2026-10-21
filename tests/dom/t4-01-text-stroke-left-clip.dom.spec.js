// t4-01 — 텍스트 외곽선(스트로크) 왼쪽 잘림 (현빈 T4 «[텍스트]» · 지디 FINDING-t4-01 · S7).
// 장면은 앱 제 문(플로팅 패널 «새 섹션»·텍스트 메뉴 · ⌘0 · 블럭 누름 · 우측 패널 외곽선 절 · Esc/빈 곳 누름)으로 짓는다.
//   예외(선례 text-dot-frame-clip F3·F5 와 같은 꼴): P3·P4 의 «내용 자르기»·«둥글기»는 프레임 dataset 을 직접 준다(그 패널 길은 이 버그 밖).
// 고정 대기 0줄 — 기다림은 waitForFunction(polling) / 하네스 waitStableRect 뿐. rect 는 가라앉힌 뒤 두 번 읽는다.
//
// 자(픽셀) — 글자 왼쪽 변 둘레 좁은 띠를 page.screenshot({clip}) 으로 받아 페이지 canvas 로 열마다 «스트로크 색 픽셀 수»를 센다.
//   R(상태) = 프레임 왼쪽 경계 «밖» · 섹션 rect «안» 열 가운데 스트로크 색(무채색 · 흰 바탕 아님) 픽셀이 하나라도 있는 열의 수.
//   기준 = 고른 상태(R_sel) — css/editor-blocks.css «:has(.text-block.selected){overflow:visible}» 때문에 고른 동안은 안 잘린다(진단 덧).
//   사라진 px = R_sel − R_desel (같은 자 · 같은 띠 · 같은 판).
// 자른 PNG — test-results/S7-t4-01-png/<RUN_TAG>-<칸>-<sel|desel>.png (레인 안 · .gitignore:5 test-results/) · 경로와 clip 은 로그 «T401 png» 줄.
//
// 성공 = 단언
//   P1 외곽선(외부·가운데)을 켠 글자를 «선택 푼 뒤» 보면 프레임 왼쪽 경계 밖 열에 스트로크 색이 있다(R_desel > 0)
//   P2 사라진 px = R_sel − R_desel ≤ 1  (바닥: R_sel 만큼 다 사라진다)
//   P2r 오른쪽 변도 같은 자로 사라진 px ≤ 1 (지디: 처방 overflow 류는 양쪽을 같이 푼다 — 오른쪽 전/후 수를 같이 낸다)
//   줌 — 100%(⌘0) 와 40%(⌘0 뒤 줌 «−» 단추 6번) 둘: 스트로크 폭이 배율에 곱해져 잘리는 양이 다르다
//   P3(지키는 칸) 프레임 data-clip-content="true"(사용자가 켠 자름)면 계속 잘린다: R_desel = 0
//   P4(지키는 칸) 둥근 텍스트 프레임(data-radius≠0)은 계속 자른다: R_desel = 0
//   P5(지키는 칸) 외곽선 없는 텍스트 프레임은 overflow 가 그대로 hidden
//   ⒜ 앱 길 값: 외부 두께 N → 글자칸 인라인 -webkit-text-stroke-width = 2N · paint-order «stroke fill» (진단의 손 값 6px = N 3 과 같은 꼴)
//   C1 캡처(내부 8): 앱 캡처 길(js/io/capture-safety.js captureSectionImage · html2canvas 클론)로 찍은 그림에서 프레임 왼쪽 경계 밖 스트로크 열 = 0
//      (클론은 내부 외곽선을 가운데 획으로 근사해 인라인에 쓴다 — 규칙이 «인라인 획»을 잡으면 내보내기에서만 샌다 · 지디 판정)
//   C2 캡처(외부 8): 같은 자로 경계 밖 스트로크 열 > 0 (캔버스와 같아진다 — 바닥에선 0)
//   L0 외부 API window.goditor._addBlock({type:'text', strokeWidth, align:'left'}) 가 만든 옛 꼴 글자(인라인 획 ○ · data-stroke-on ✗ — 고스트 넘버럴 길)도
//      선택 푼 뒤 프레임 overflow visible · 왼쪽 경계 밖 스트로크 열 > 0  (v7 의 L0 기록은 선택을 안 풀어 :has(.text-block.selected) 로 바닥에서도 visible — 무효)
//
// 판 정체 — ⑴ git -C ROOT rev-parse HEAD === EXPECT_SHA
//           ⑵ IDENT_FILE(기본 css/editor-blocks.css)을 페이지가 받은 sha1 === ROOT 파일 sha1 === EXPECT_FILE_SHA1
//   EXPECT_FILE_SHA1 = 순수 sha1(파일 내용) — `shasum -a 1 <파일>` · ⛔`git hash-object`(blob 머리가 붙어 값이 다르다).
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1440, height: 900 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const EXPECT_SHA = process.env.EXPECT_SHA || '';
const EXPECT_FILE_SHA1 = process.env.EXPECT_FILE_SHA1 || '';
const IDENT_FILE = process.env.IDENT_FILE || 'css/editor-blocks.css';
const RUN_TAG = process.env.T401_TAG || 'run';
const PNG_DIR = path.join(__dirname, '..', '..', 'test-results', 'S7-t4-01-png');
const BAND = 24;      // 띠 너비(프레임 왼쪽 경계 밖 · 화면 px)
const INSET = 8;      // 띠가 경계 안쪽으로 들어가는 너비
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`T401 ${tag} ${JSON.stringify(o)}`);

async function assertBoard(page) {
  expect(EXPECT_SHA, '판 정체: EXPECT_SHA env 가 풀 sha 40자').toMatch(/^[0-9a-f]{40}$/);
  expect(EXPECT_FILE_SHA1, '판 정체: EXPECT_FILE_SHA1 env 가 sha1 40자').toMatch(/^[0-9a-f]{40}$/);
  const headSha = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const rootSha1 = sha1(fs.readFileSync(path.join(ROOT, IDENT_FILE)));
  const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
    let bin = ''; for (let i = 0; i < a.length; i += 0x8000) bin += String.fromCharCode.apply(null, a.subarray(i, i + 0x8000)); return btoa(bin); }, `${ORIGIN}/${IDENT_FILE}`);
  const pageSha1 = sha1(Buffer.from(b64, 'base64'));
  log('ident', { root: ROOT, expectSha: EXPECT_SHA, headSha, identFile: IDENT_FILE, expectFileSha1: EXPECT_FILE_SHA1, rootSha1, pageSha1 });
  expect(headSha, '판 정체 ⑴: ROOT 의 HEAD === EXPECT_SHA').toBe(EXPECT_SHA);
  expect(pageSha1, `판 정체 ⑵a: 페이지가 받은 ${IDENT_FILE} === ROOT 파일`).toBe(rootSha1);
  expect(rootSha1, `판 정체 ⑵b: ROOT ${IDENT_FILE} === EXPECT_FILE_SHA1`).toBe(EXPECT_FILE_SHA1);
}

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setViewportSize(VIEW);
  await page.addInitScript(() => { window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) }); });
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (!url.startsWith(ORIGIN + '/')) return r.abort();
    const f = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.getSelectedSection === 'function' && typeof window.addTextBlock === 'function', null, { timeout: 30000 });
  await assertBoard(page);
  return errs;
}

async function pollTrue(page, fn, arg, timeout = 6000) {
  try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; }
}
async function stableTwice(page, sel) {
  const a = await waitStableRect(page, sel); const b = await waitStableRect(page, sel);
  return { ...b, twiceSame: a.left === b.left && a.top === b.top && a.width === b.width && a.height === b.height };
}
async function softClick(page, x, y, sel) {
  const hit = await page.evaluate(([x, y, sel]) => { const e = document.elementFromPoint(x, y); if (!e) return { ok: false, hit: null };
    return { ok: !!(e.matches(sel) || e.closest(sel)), hit: (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? e.tagName).split(' ')[0] }; }, [x, y, sel]);
  if (hit.ok) await page.mouse.click(x, y);
  return hit;
}
const scrollTo = (page, sel) => page.evaluate((s) => document.querySelector(s)?.scrollIntoView({ block: 'center', behavior: 'instant' }), sel);

// 앱 길 — 새 섹션 → Heading → ⌘0(줌 100) [→ 줌 «−» 단추로 40] → 글자 누름(우측 패널이 그 글자)
async function scene(page, zoom = 100, ta = 'left') {
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  const secId = await page.evaluate((b) => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id).find(x => !b.includes(x)) || null, before);
  expect(secId, '전제: 새 섹션').toBeTruthy();
  await page.evaluate(() => document.querySelectorAll('#canvas .text-block').forEach(e => { e.__t401 = true; }));
  await page.click('#fp-text-dropdown .fp-dropdown-trigger');
  await page.locator('#fp-text-menu .fp-menu-item').filter({ hasText: /^\s*Heading\s*$/ }).first().click();
  expect(await pollTrue(page, () => [...document.querySelectorAll('#canvas .text-block')].some(e => !e.__t401)), '전제: Heading 을 메뉴로 넣었다').toBe(true);
  const tbId = await page.evaluate(() => [...document.querySelectorAll('#canvas .text-block')].find(e => !e.__t401).id);
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  await page.keyboard.press('Meta+0');
  expect(await pollTrue(page, () => (window.currentZoom ?? 0) === 100), '전제: ⌘0 으로 줌 100').toBe(true);
  for (let z = 100; z > zoom; z -= 10) {
    await page.click('#zoom-ctrl .zoom-btn:first-child');
    expect(await pollTrue(page, (want) => (window.currentZoom ?? 0) === want, z - 10), `전제: 줌 «−» 단추로 ${z - 10}`).toBe(true);
  }
  const fr = await page.evaluate((i) => { const f = document.getElementById(i).closest('.frame-block'); return f ? { id: f.id, textFrame: f.dataset.textFrame ?? null } : null; }, tbId);
  expect(fr?.textFrame, '전제: 글자가 텍스트 프레임(data-text-frame) 안에 있다').toBe('true');
  await selectText(page, tbId);
  // 현빈 꼴 = 글자가 프레임 왼쪽 끝에 붙어 있다(진단: 글자 상자 left = 부모 left · padding 0). 새 Heading 은 가운데 정렬이라
  //   잉크가 왼쪽 끝에서 멀다(v2 부름: 경계 안쪽 8px 열까지 스트로크 0) ⇒ 우측 패널 «왼쪽 정렬» 단추로 붙인다.
  //   오른쪽 변 칸(지디 ④)은 «오른쪽 정렬»로 잉크를 오른쪽 끝에 붙인다(왼쪽 정렬이면 오른쪽 틈 ~218px 라 오른쪽 수가 늘 0/0 — v5 부름).
  await page.click(`#panel-right .prop-align-btn[data-align="${ta}"]`, { timeout: 10000 });
  expect(await pollTrue(page, ([i, a]) => getComputedStyle(document.getElementById(i).querySelector('[class^="tb-"]')).textAlign === a, [tbId, ta]), `전제: 글자 ${ta} 정렬(패널 단추)`).toBe(true);
  return { secId, tbId, frId: fr.id };
}
// 잉크 왼쪽 끝 — 글자칸 내용 Range 의 rect(기록용)
const inkOf = (page, tbId) => page.evaluate((i) => { const c = document.getElementById(i).querySelector('[class^="tb-"]'); const r = document.createRange(); r.selectNodeContents(c);
  const b = r.getBoundingClientRect(); const f = c.closest('.frame-block').getBoundingClientRect(); return { inkLeft: b.left, inkRight: b.right, frameLeft: f.left, frameRight: f.right, gapL: b.left - f.left, gapR: f.right - b.right, textAlign: getComputedStyle(c).textAlign }; }, tbId);
async function selectText(page, tbId) {
  const S = `[id="${tbId}"]`; await scrollTo(page, S);
  const r = await stableTwice(page, S);
  const hit = await softClick(page, r.cx, r.cy, S);
  expect(hit.ok, `전제: 글자를 맞혔다(맞힌 것 ${hit.hit})`).toBe(true);
  expect(await pollTrue(page, () => !!document.getElementById('txt-stroke-section')), '전제: 우측 패널에 외곽선 절').toBe(true);
}
// 우측 패널 외곽선 절 — 켜기 · 두께 · 위치
// 켜기 = 토글 라벨(입력 상자 자체는 화면에 안 보인다 — v1 부름에서 «element is not visible» 로 2분 멈춤)
async function setStroke(page, { w, align }) {
  if (!(await page.isChecked('#txt-stroke-on'))) await page.click('#txt-stroke-section label.prop-toggle', { timeout: 10000 });
  expect(await pollTrue(page, () => document.getElementById('txt-stroke-on')?.checked === true && getComputedStyle(document.getElementById('txt-stroke-controls')).display !== 'none'), '전제: 외곽선 켜짐 · 조절 칸 보임').toBe(true);
  await page.fill('#txt-stroke-w-number', String(w), { timeout: 10000 });
  await page.selectOption('#txt-stroke-align', align, { timeout: 10000 });
}
async function strokeStyle(page, tbId) {
  return page.evaluate((i) => { const tb = document.getElementById(i); const c = tb.querySelector('[data-stroke-on]') || tb.querySelector('[class^="tb-"]');
    const st = c?.style; return { el: c ? c.className : null, on: c?.dataset.strokeOn ?? null, w: c?.dataset.strokeW ?? null, align: c?.dataset.strokeAlign ?? null,
      strokeWidth: st?.getPropertyValue('-webkit-text-stroke-width') || null, strokeColor: st?.getPropertyValue('-webkit-text-stroke-color') || null, paintOrder: st?.getPropertyValue('paint-order') || null }; }, tbId);
}
// 선택 풀기 — Esc 두 번 + 섹션 밖 캔버스 빈 곳 누름(deselectAll 꼴)
async function deselect(page) {
  await page.keyboard.press('Escape'); await page.keyboard.press('Escape');
  const pt = await page.evaluate(() => { const w = document.getElementById('canvas-wrap').getBoundingClientRect(); const s = document.querySelector('#canvas .section-block:not([data-ghost])').getBoundingClientRect();
    return { x: Math.max(w.left + 4, s.left / 2 + w.left / 2), y: w.top + w.height / 2 }; });
  await softClick(page, pt.x, pt.y, '#canvas-wrap');
  return pollTrue(page, () => document.querySelectorAll('#canvas .selected, #canvas .editing').length === 0, null, 3000);
}
// 자 — 프레임 왼쪽(또는 오른쪽) 경계 둘레 띠를 찍어 열마다 스트로크 색 픽셀 수
async function measure(page, frId, tbId, name) {
  const L = await band(page, frId, tbId, name, 'L');
  const Rt = await band(page, frId, tbId, name, 'R');
  return { R: L.R, Rr: Rt.R, overflow: L.overflow, clip: L.clip, clipR: Rt.clip, file: L.file, fileR: Rt.file };
}
async function band(page, frId, tbId, name, side) {
  const f = await stableTwice(page, `[id="${frId}"]`);
  const t = await stableTwice(page, `[id="${tbId}"]`);
  const edge = Math.round(side === 'L' ? f.left : f.left + f.width);
  const clip = side === 'L'
    ? { x: edge - BAND, y: Math.floor(t.top), width: BAND + INSET, height: Math.max(1, Math.ceil(t.height)) }
    : { x: edge - INSET, y: Math.floor(t.top), width: BAND + INSET, height: Math.max(1, Math.ceil(t.height)) };
  const buf = await page.screenshot({ clip });
  fs.mkdirSync(PNG_DIR, { recursive: true });
  const file = path.join(PNG_DIR, `${RUN_TAG}-${name}-${side}.png`);
  fs.writeFileSync(file, buf);
  const cols = await page.evaluate(async (s) => {
    const i = new Image(); i.src = 'data:image/png;base64,' + s; await i.decode();
    const c = document.createElement('canvas'); c.width = i.width; c.height = i.height;
    const g = c.getContext('2d'); g.drawImage(i, 0, 0);
    const d = g.getImageData(0, 0, c.width, c.height).data;
    const out = [];
    // 스트로크 색 = «무채색이고 흰 바탕이 아님»(채널 차 < 16 · 최댓값 < 200). 새 Heading 은 자리표시 글이라 검은 획이 회색(139)으로 그려진다
    //   (v3 부름 PNG 실측) · 선택 아웃라인(파랑 45,111,232)은 채널 차가 커서 안 센다.
    for (let x = 0; x < c.width; x++) { let n = 0; for (let y = 0; y < c.height; y++) { const k = (y * c.width + x) * 4; const mx = Math.max(d[k], d[k + 1], d[k + 2]), mn = Math.min(d[k], d[k + 1], d[k + 2]); if (mx - mn < 16 && mx < 200) n++; } out.push(n); }
    return out;
  }, buf.toString('base64'));
  // 섹션 밖(캔버스 회색 바탕)은 세지 않는다 — v4 부름: 줌 40 에서 섹션 끝이 프레임에서 ~13px 라 띠가 바탕 회색을 11열 먹었다(R_desel 11 · 좌우 같음).
  const secR = await page.evaluate((i) => { const s = document.getElementById(i).closest('.section-block'); const r = s.getBoundingClientRect(); return { l: r.left, r: r.right }; }, frId);
  const inSec = (k) => { const x = clip.x + k; return x >= Math.ceil(secR.l) && x < Math.floor(secR.r); };
  const outside = side === 'L' ? cols.slice(0, BAND).map((n, k) => (inSec(k) ? n : 0)) : cols.slice(INSET).map((n, k) => (inSec(k + INSET) ? n : 0));
  const R = outside.filter(n => n > 0).length;
  const counted = (side === 'L' ? cols.slice(0, BAND).map((_, k) => inSec(k)) : cols.slice(INSET).map((_, k) => inSec(k + INSET))).filter(Boolean).length;
  const overflow = await page.evaluate((i) => getComputedStyle(document.getElementById(i)).overflow, frId);
  log('png', { name, side, file: path.relative(path.join(__dirname, '..', '..'), file), clip, frameLeft: f.left, frameRight: f.left + f.width, textLeft: t.left, textRight: t.left + t.width, section: secR, countedCols: counted, overflow, R, outsideCols: outside });
  return { R, overflow, clip, file };
}

for (const c of [{ name: 'z100-outside-3', w: 3, align: 'outside', zoom: 100 }, { name: 'z100-outside-8', w: 8, align: 'outside', zoom: 100 }, { name: 'z100-center-8', w: 8, align: 'center', zoom: 100 },
                 { name: 'z40-outside-8', w: 8, align: 'outside', zoom: 40 }, { name: 'z40-outside-20', w: 20, align: 'outside', zoom: 40 },
                 { name: 'z100-outside-8-right', w: 8, align: 'outside', zoom: 100, ta: 'right' }]) {
  test(`T401 ${c.name} — 선택 푼 뒤 왼쪽 외곽선이 안 잘린다 (P1·P2)`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await boot(page);
    const s = await scene(page, c.zoom, c.ta || 'left');
    await setStroke(page, c);
    const st = await strokeStyle(page, s.tbId);
    log('stroke', { name: c.name, ...st });
    if (c.align === 'outside') {
      expect.soft(st.strokeWidth, `⒜ 앱 길 값: 외부 ${c.w} → 인라인 stroke 폭 ${c.w * 2}px`).toBe(`${c.w * 2}px`);
      // 한계(지디 · 단언 아님 · 적기만): 소스 값 «stroke fill»(applyStroke 가 쓴 글자)과 여기서 읽는 값 «stroke»(브라우저가 줄여 돌려준 값)는 다른 자다.
      //   이 정규식은 «stroke» 와 «stroke fill» 을 같게 본다. 순서 뒤집힘(fill stroke)은 /^stroke/ 와 안 맞으니 빨강이 될 것으로 읽히지만
      //   브라우저가 그 값을 무엇으로 돌려주는지(normal · fill …)는 안 쟀다 — «잡는다»고 적지 않는다.
      expect.soft(st.paintOrder, '⒜ 앱 길 값: paint-order 가 stroke 먼저(브라우저는 «stroke fill» 을 «stroke» 로 줄여 돌려준다)').toMatch(/^stroke\b/);
    }
    log('ink', { name: c.name, ...(await inkOf(page, s.tbId)) });
    const sel = await measure(page, s.frId, s.tbId, `${c.name}-sel`);
    expect(await deselect(page), '전제: 선택이 다 풀렸다(배송본 꼴)').toBe(true);
    const des = await measure(page, s.frId, s.tbId, `${c.name}-desel`);
    log('P', { name: c.name, R_sel: sel.R, R_desel: des.R, lost: sel.R - des.R, Rr_sel: sel.Rr, Rr_desel: des.Rr, lostR: sel.Rr - des.Rr, overflowSel: sel.overflow, overflowDesel: des.overflow });
    expect(errs, '페이지 에러 0').toEqual([]);
    const right = c.ta === 'right';
    expect(right ? sel.Rr : sel.R, `전제(자): 고른 상태(안 잘림 기준)에서 ${right ? '오른쪽' : '왼쪽'} 경계 밖 스트로크 열이 있다`).toBeGreaterThan(0);
    expect.soft(right ? des.Rr : des.R, `P1 ${c.name}: 선택 푼 뒤 프레임 ${right ? '오른쪽' : '왼쪽'} 경계 밖 열에 스트로크 색 (R_desel ${right ? des.Rr : des.R})`).toBeGreaterThan(0);
    expect.soft(sel.R - des.R, `P2 ${c.name}: 사라진 px = R_sel ${sel.R} − R_desel ${des.R} ≤ 1`).toBeLessThanOrEqual(1);
    expect.soft(sel.Rr - des.Rr, `P2r ${c.name}: 오른쪽 사라진 px = ${sel.Rr} − ${des.Rr} ≤ 1`).toBeLessThanOrEqual(1);
  });
}

test('T401 inside-8 — 기록 칸(내부 = SVG 필터 · 번짐 기대 0)', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await boot(page);
  const s = await scene(page);
  await setStroke(page, { w: 8, align: 'inside' });
  log('stroke', { name: 'inside-8', ...(await strokeStyle(page, s.tbId)) });
  const sel = await measure(page, s.frId, s.tbId, 'inside-8-sel');
  expect(await deselect(page), '전제: 선택이 다 풀렸다').toBe(true);
  const des = await measure(page, s.frId, s.tbId, 'inside-8-desel');
  log('P', { name: 'inside-8', R_sel: sel.R, R_desel: des.R, lost: sel.R - des.R });
  expect(errs, '페이지 에러 0').toEqual([]);
  expect.soft(sel.R - des.R, `P6 inside-8: 사라진 px ≤ 1`).toBeLessThanOrEqual(1);
});

// 캡처 자 — 앱 캡처 길로 섹션을 찍어(scale 2) 프레임 왼쪽 경계 밖 띠를 같은 색 규칙으로 센다 · 자른 띠 PNG 를 남긴다
async function captureBand(page, secId, frId, name) {
  const geo = await page.evaluate(([s, f]) => { const a = document.getElementById(s).getBoundingClientRect(); const b = document.getElementById(f).getBoundingClientRect();
    return { secLeft: a.left, frameLeft: b.left, frameTop: b.top - a.top, frameH: b.height, zoom: (window.currentZoom ?? 100) / 100 }; }, [secId, frId]);
  const out = await page.evaluate(async ([s, g, BAND]) => {
    const m = await import('/js/io/capture-safety.js');
    const r = await m.captureSectionImage(document.getElementById(s));
    if (!r || !r.ok) return { ok: false, reason: r && r.reason };
    const i = new Image(); i.src = r.dataUrl; await i.decode();
    const k = i.width / document.getElementById(s).offsetWidth;   // 캡처 배율(클론 폭 기준)
    const edge = Math.round((g.frameLeft - g.secLeft) / g.zoom * k);
    const top = Math.max(0, Math.round(g.frameTop / g.zoom * k)); const h = Math.max(1, Math.round(g.frameH / g.zoom * k));
    const bw = BAND * 2; const x0 = Math.max(0, edge - bw);
    const c = document.createElement('canvas'); c.width = edge - x0 + 8; c.height = h;
    const ctx = c.getContext('2d'); ctx.drawImage(i, x0, top, c.width, h, 0, 0, c.width, h);
    const d = ctx.getImageData(0, 0, c.width, h).data; const cols = [];
    for (let x = 0; x < edge - x0; x++) { let n = 0; for (let y = 0; y < h; y++) { const q = (y * c.width + x) * 4; const mx = Math.max(d[q], d[q + 1], d[q + 2]), mn = Math.min(d[q], d[q + 1], d[q + 2]); if (mx - mn < 16 && mx < 200) n++; } cols.push(n); }
    return { ok: true, w: i.width, h: i.height, scale: k, edge, crop: { x: x0, y: top, width: c.width, height: h }, cols, R: cols.filter(n => n > 0).length, png: c.toDataURL('image/png').split(',')[1] };
  }, [secId, geo, BAND]);
  if (out.ok) {
    fs.mkdirSync(PNG_DIR, { recursive: true });
    const file = path.join(PNG_DIR, `${RUN_TAG}-${name}-capture-L.png`);
    fs.writeFileSync(file, Buffer.from(out.png, 'base64'));
    out.file = path.relative(path.join(__dirname, '..', '..'), file); delete out.png;
  }
  log('capture', { name, geo, ...out });
  return out;
}

for (const c of [{ name: 'C1-inside-8', align: 'inside' }, { name: 'C2-outside-8', align: 'outside' }]) {
  test(`T401 ${c.name} — 캡처 길(내보내기 클론)`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await boot(page);
    const s = await scene(page);
    await setStroke(page, { w: 8, align: c.align });
    expect(await deselect(page), '전제: 선택이 다 풀렸다').toBe(true);
    const cap = await captureBand(page, s.secId, s.frId, c.name);
    expect(errs, '페이지 에러 0').toEqual([]);
    expect(cap.ok, `전제: 캡처가 그림을 냈다(${cap.reason || ''})`).toBe(true);
    if (c.align === 'inside') expect.soft(cap.R, `C1 ${c.name}: 캡처에서 프레임 왼쪽 경계 밖 스트로크 열 0 (캔버스와 같다)`).toBe(0);
    else expect.soft(cap.R, `C2 ${c.name}: 캡처에서 프레임 왼쪽 경계 밖 스트로크 열 > 0`).toBeGreaterThan(0);
  });
}

test('T401 L0 — 외부 API 의 strokeWidth 글자(옛 꼴 · dataset 없음)도 선택 푼 뒤 안 잘린다', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await boot(page);
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  await pollTrue(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length);
  await page.evaluate(() => document.querySelectorAll('#canvas .text-block').forEach(e => { e.__t401 = true; }));
  await page.evaluate(() => window.goditor._addBlock({ type: 'text', style: 'h2', content: '가나다', align: 'left', strokeWidth: 8, strokeColor: '#000000' }));
  expect(await pollTrue(page, () => [...document.querySelectorAll('#canvas .text-block')].some(e => !e.__t401)), '전제: API 로 글자가 생겼다').toBe(true);
  const ids = await page.evaluate(() => { const tb = [...document.querySelectorAll('#canvas .text-block')].find(e => !e.__t401); const fr = tb.closest('.frame-block'); return { tbId: tb.id, frId: fr ? fr.id : null }; });
  expect(await deselect(page), '전제: 선택이 다 풀렸다(배송본 꼴)').toBe(true);
  const rec = await page.evaluate(([t, f]) => { const c = document.getElementById(t).querySelector('[class^="tb-"]'); const fr = f ? document.getElementById(f) : null;
    return { inlineStroke: c.style.getPropertyValue('-webkit-text-stroke-width') || null, paintOrder: c.style.getPropertyValue('paint-order') || null, strokeOn: c.dataset.strokeOn ?? null, strokeAlign: c.dataset.strokeAlign ?? null,
      textAlign: getComputedStyle(c).textAlign, inTextFrame: fr ? fr.dataset.textFrame ?? null : null, frameOverflow: fr ? getComputedStyle(fr).overflow : null }; }, [ids.tbId, ids.frId]);
  const des = ids.frId ? await measure(page, ids.frId, ids.tbId, 'L0-desel') : { R: null };
  log('L0', { ...rec, R_desel: des.R });
  expect(errs, '페이지 에러 0').toEqual([]);
  expect(rec.inlineStroke, '전제: API 글자에 인라인 획').toBeTruthy();
  expect(rec.strokeOn, '전제: API 글자는 data-stroke-on 이 없다(옛 꼴)').toBeNull();
  expect(rec.inTextFrame, '전제: API 글자가 텍스트 프레임 안').toBe('true');
  expect.soft(rec.frameOverflow, 'L0: 선택 푼 뒤 옛 꼴 글자의 프레임 overflow visible').toBe('visible');
  expect.soft(des.R, `L0: 선택 푼 뒤 왼쪽 경계 밖 스트로크 열 > 0 (R_desel ${des.R})`).toBeGreaterThan(0);
});

for (const g of [{ name: 'P3-clip-content', key: 'clipContent', val: 'true' }, { name: 'P4-radius', key: 'radius', val: '24' }]) {
  test(`T401 ${g.name} — 지키는 칸: 계속 자른다`, async ({ page }) => {
    test.setTimeout(120000);
    const errs = await boot(page);
    const s = await scene(page);
    await setStroke(page, { w: 8, align: 'outside' });
    expect(await deselect(page), '전제: 선택이 다 풀렸다').toBe(true);
    await page.evaluate(([i, k, v]) => { document.getElementById(i).dataset[k] = v; }, [s.frId, g.key, g.val]);
    expect(await pollTrue(page, (i) => getComputedStyle(document.getElementById(i)).overflow === 'hidden', s.frId), `${g.name}: 프레임 overflow 가 hidden`).toBe(true);
    const des = await measure(page, s.frId, s.tbId, `${g.name}-desel`);
    log('P', { name: g.name, R_desel: des.R, overflow: des.overflow });
    expect(errs, '페이지 에러 0').toEqual([]);
    expect(des.R, `${g.name}: 경계 밖 스트로크 열 0`).toBe(0);
  });
}

test('T401 P5 — 지키는 칸: 외곽선 없는 텍스트 프레임은 overflow hidden 그대로', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await boot(page);
  const s = await scene(page);
  expect(await deselect(page), '전제: 선택이 다 풀렸다').toBe(true);
  const ov = await page.evaluate((i) => getComputedStyle(document.getElementById(i)).overflow, s.frId);
  log('P', { name: 'P5', overflow: ov });
  expect(errs, '페이지 에러 0').toEqual([]);
  expect(ov, 'P5: 외곽선 없는 텍스트 프레임 overflow').toBe('hidden');
});
