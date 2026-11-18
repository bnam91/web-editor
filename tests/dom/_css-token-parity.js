/* _css-token-parity — CSS 토큰 통일 레인 공용 시각 대조 틀 (PLAN-css-token-unify-261118 §5 ②(ii) · 배정표 «단위 닫는 근거» 3).
 *
 * 쓰는 법(레인 spec 한 장 = 자기 묶음 화면 명부):
 *   const P = require('./_css-token-parity.js');
 *   const SCREENS = [{ name: '설정 모달', files: ['css/settings-modal.css'], root: '#settings-modal .sm-dialog',
 *                      open: (page) => page.evaluate(() => window.openSettingsModal()) }];
 *   test('parity', async ({ browser }) => { await P.check(browser, SCREENS); });
 *   돌리기: CSS_TOKEN_BASE=<레인 바탕 sha> npx playwright test --config=tests/dom/playwright.dom.config.js <spec> --workers=1
 *
 * 무엇을 하나 — 두 판을 «같은 하네스»(bootApp)로 띄운다:
 *   지금 판 = 작업 트리 그대로 · 핀 판 = css/ 중 BASE 와 다른 파일만 BASE 내용으로 덮음(js·html 은 같다 ⇒ 차이는 css 뿐).
 *   ⛔HEAD 를 핀으로 두지 않는다(고친 뒤엔 HEAD = 고친 판 → 공짜 초록). BASE 없으면 skip.
 *   화면마다 ① «찍는지» 단언(요소 있음 · display/visibility · 크기 > 0) ② 픽셀 0 · 크기 같음 ③ 기본 테마 + 다른 테마(applyTheme) 두 번.
 *   덮은 선언 x/y(파일별): 후보 = BASE 판 css 에서 A단계 토큰으로 바꿀 수 있는 리터럴을 품은 줄 · 바뀐 = BASE 대비 이 레인이 바꾼 줄.
 *     그 줄의 선택자(가상요소 ::before 등은 떼고)가 찍은 root 안(또는 root 자신)의 보이는 요소에 걸리면 «덮음».
 *     ★바뀐 줄 중 못 덮은 것이 있으면 빨강(배정표: 못 덮은 선언은 단위에서 빼거나 spec 을 넓힌다).
 *   자 양성대조(늘): 첫 화면의 지금 판 root 에 opacity .98 → 픽셀 차 > 0 이어야(같은 자가 미세한 차를 본다 · G18 과 같은 꼴).
 */
const { execFileSync } = require('child_process');
const { expect } = require('@playwright/test');
const { bootApp, ROOT } = require('./_root-harness.js');
const A = require('../../scripts/css-token-a-stage.cjs');

const BASE = process.env.CSS_TOKEN_BASE || null;
const OTHER_THEME = { primary: '#c0392b', text: '#f1c40f', background: '#16a085' };
const git = (...a) => execFileSync('git', ['-C', ROOT, ...a], { encoding: 'utf8', maxBuffer: 64 << 20 });

/** css/ 중 BASE 와 다른 파일 → BASE 내용(새로 생긴 파일은 null = 404). */
function cssOverlay(base) {
  const map = new Map();
  for (const line of git('diff', '--name-status', base, '--', 'css').split('\n').filter(Boolean)) {
    const [st, ...ps] = line.split('\t');
    if (st.startsWith('R')) { map.set('/' + ps[1], null); map.set('/' + ps[0], execFileSync('git', ['-C', ROOT, 'show', `${base}:${ps[0]}`])); continue; }
    map.set('/' + ps[0], st.startsWith('A') ? null : execFileSync('git', ['-C', ROOT, 'show', `${base}:${ps[0]}`]));
  }
  return map;
}

/** 파일별 {후보 줄, 바뀐 줄} → [{line, sel}] (선택자는 지금 판 기준 · 후보는 BASE 판 기준). */
function declLines(files) {
  const ctx = A.loadCtx(ROOT);
  const changed = {};
  for (const p of A.proveDiff(ROOT, BASE, ctx).pairs) (changed[p.file] = changed[p.file] || []).push(p.line);
  const out = {};
  for (const f of files) {
    const baseText = git('show', `${BASE}:${f}`); const nowText = require('fs').readFileSync(require('path').join(ROOT, f), 'utf8');
    const selBase = A.selectorsByLine(baseText); const selNow = A.selectorsByLine(nowText);
    const cand = [];
    baseText.split('\n').forEach((ln, i) => {
      if (A.declsOfLine(ln).some((d) => A.candidatesOfDecl(d.prop, d.value, ctx).length)) cand.push({ line: i + 1, sel: selBase[i + 1] });
    });
    out[f] = { cand, changed: (changed[f] || []).map((line) => ({ line, sel: selNow[line] })) };
  }
  return out;
}

async function settle(page) {
  await page.mouse.move(1, 1);
  await page.evaluate(async () => { await document.fonts.ready; await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))); });
}
async function visibleRoot(page, sel, tag) {
  const st = await page.evaluate((s) => {
    const e = document.querySelector(s); if (!e) return { exists: false };
    const cs = getComputedStyle(e); const r = e.getBoundingClientRect();
    return { exists: true, display: cs.display, visibility: cs.visibility, w: r.width, h: r.height };
  }, sel);
  expect(st.exists, `[${tag}] ${sel} 가 없다 — 이 화면을 못 찍는다`).toBe(true);
  expect(st.display, `[${tag}] ${sel} display`).not.toBe('none');
  expect(st.visibility, `[${tag}] ${sel} visibility`).not.toBe('hidden');
  expect(st.w > 0 && st.h > 0, `[${tag}] ${sel} 크기 ${st.w}×${st.h}`).toBe(true);
}
async function shot(page, sel) {
  const buf = await page.locator(sel).first().screenshot({ type: 'png', animations: 'disabled', caret: 'hide' });
  return page.evaluate(async (b64) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + b64; await img.decode();
    const cv = document.createElement('canvas'); cv.width = img.width; cv.height = img.height;
    const c = cv.getContext('2d'); c.drawImage(img, 0, 0);
    return { w: img.width, h: img.height, d: Array.from(c.getImageData(0, 0, img.width, img.height).data) };
  }, buf.toString('base64'));
}
function pxDiff(a, b, tag) {
  if (a.w !== b.w || a.h !== b.h) { console.log(`[css-token] ${tag} 크기 다름 ${a.w}×${a.h} vs ${b.w}×${b.h}`); return Infinity; }
  let n = 0; let logged = 0;
  for (let k = 0; k < a.d.length; k += 4) {
    if (a.d[k] !== b.d[k] || a.d[k + 1] !== b.d[k + 1] || a.d[k + 2] !== b.d[k + 2] || a.d[k + 3] !== b.d[k + 3]) {
      n++; if (logged++ < 5) console.log(`[css-token] ${tag} (${(k / 4) % a.w},${Math.floor(k / 4 / a.w)}) 지금 ${a.d.slice(k, k + 4)} · 핀 ${b.d.slice(k, k + 4)}`);
    }
  }
  return n;
}
/** 지금 판에서 root 안(또는 root 자신)의 보이는 요소에 걸리는 선택자인가. */
const covers = (page, root, sels) => page.evaluate(([r, S]) => {
  const R = document.querySelector(r);
  const vis = (e) => { const b = e.getBoundingClientRect(); const cs = getComputedStyle(e); return b.width > 0 && b.height > 0 && cs.visibility !== 'hidden'; };
  return S.map((s) => {
    if (!s) return false;
    const bare = s.replace(/::?(before|after|placeholder|selection|marker|first-line|first-letter|-webkit-[\w-]+|-moz-[\w-]+)\b/g, '');
    try { return [...document.querySelectorAll(bare)].some((e) => (R === e || R.contains(e)) && vis(e)); } catch { return false; }
  });
}, [root, sels]);

/** 명부의 화면을 두 판·두 테마로 찍어 픽셀 0 + 덮은 선언 셈. 돌려주는 값은 보고 한 줄 재료. */
async function check(browser, screens) {
  if (!BASE) { console.log('[css-token] CSS_TOKEN_BASE 없음 — skip'); return null; }
  const overlay = cssOverlay(BASE);
  console.log(`[css-token] BASE ${BASE} · 핀 덮개 css ${overlay.size}개: ${[...overlay.keys()].join(' ') || '(없음 — 이 판은 BASE 와 css 가 같다: 픽셀 비교는 «찍는지»·자 검사만 뜻이 있다)'}`);
  const pages = [];
  for (const ov of [null, overlay]) {
    const ctx = await browser.newContext({ viewport: { width: 1600, height: 1000 }, deviceScaleFactor: 1 });
    const p = await ctx.newPage(); const errs = await bootApp(p, ov ? { overlay: ov } : undefined);
    pages.push({ p, errs, ctx });
  }
  const [now, pin] = pages;
  const files = [...new Set(screens.flatMap((s) => s.files))];
  const lines = declLines(files);
  const covered = {}; for (const f of files) covered[f] = { cand: new Set(), changed: new Set() };
  const rows = [];
  for (const theme of [null, OTHER_THEME]) {
    if (theme) for (const { p } of pages) await p.evaluate((t) => ThemeSystem.applyTheme(t), theme);   // eslint-disable-line no-undef
    for (const s of screens) {
      const tag = `${s.name}${theme ? ' · 다른 테마' : ''}`;
      for (const { p } of pages) { await s.open(p); await settle(p); }
      await visibleRoot(now.p, s.root, tag + ' 지금'); await visibleRoot(pin.p, s.root, tag + ' 핀');
      const d = pxDiff(await shot(now.p, s.root), await shot(pin.p, s.root), tag);
      rows.push({ screen: tag, diff: d });
      if (!theme) for (const f of s.files) {
        const L = lines[f];
        (await covers(now.p, s.root, L.cand.map((x) => x.sel))).forEach((ok, i) => ok && covered[f].cand.add(L.cand[i].line));
        (await covers(now.p, s.root, L.changed.map((x) => x.sel))).forEach((ok, i) => ok && covered[f].changed.add(L.changed[i].line));
      }
      if (s.close) for (const { p } of pages) await s.close(p);
    }
  }
  // 자 양성대조 — 같은 자가 미세한 차를 본다
  const s0 = screens[0];
  await s0.open(now.p); await s0.open(pin.p); await settle(now.p); await settle(pin.p);
  await now.p.evaluate((r) => { document.querySelector(r).style.opacity = '0.98'; }, s0.root);
  const ctl = pxDiff(await shot(now.p, s0.root), await shot(pin.p, s0.root), `${s0.name} 양성대조`);

  const cov = {}; const uncovered = [];
  for (const f of files) {
    const L = lines[f];
    cov[f] = { cand: `${covered[f].cand.size}/${L.cand.length}`, changed: `${covered[f].changed.size}/${L.changed.length}` };
    for (const x of L.changed) if (!covered[f].changed.has(x.line)) uncovered.push(`${f}:${x.line} ${x.sel}`);
  }
  console.log(`[css-token] 픽셀 ${rows.map((r) => `${r.screen}=${r.diff}`).join(' · ')} · 양성대조 ${ctl}`);
  console.log(`[css-token] 덮은 선언(후보·바뀐) ${Object.entries(cov).map(([f, c]) => `${f} ${c.cand}·${c.changed}`).join(' · ')}`);
  if (uncovered.length) console.log(`[css-token] 못 덮은 바뀐 줄:\n  ${uncovered.join('\n  ')}`);

  expect(ctl, '자 양성대조: opacity .98 이 픽셀로 보여야 한다').toBeGreaterThan(0);
  for (const r of rows) expect(r.diff, `${r.screen} 픽셀 차`).toBe(0);
  expect(uncovered, '바뀐 줄은 전부 찍은 화면에 걸려야 한다(아니면 단위에서 빼거나 화면을 넓힌다)').toEqual([]);
  for (const { errs } of pages) expect(errs, '페이지 오류').toEqual([]);
  for (const { ctx } of pages) await ctx.close();
  return { overlaySize: overlay.size, rows, ctl, cov };
}

module.exports = { BASE, check, cssOverlay, declLines, pxDiff, OTHER_THEME };
