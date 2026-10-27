// 택일5 — 치수선 라벨 «모서리 라운드» 조절칸 (msg5223 «5 라벨 모서리 라운드: ⒜기본값0 / ⒝조절칸» · 현빈 답 ⒝ ＋ «기본값은 지금처럼 유지(0 으로 안 돌림)»).
// 이미 있는 꼴 둘(지디 실측): 라벨그룹 «모서리» 0~50 px(js/props/prop-label-group.js lg-item-radius) · 비교블록 0~40 px(prop-comparison.js cmp-rad) ⇒ 남은 하나 = 치수선.
// 지금 값(정의 자리): .annot-label { border-radius: 4px }(css/editor-blocks.css .annot-label 블록) — 치수선 라벨은 인라인 반경 0줄 ⇒ ★기본 = 4px(바이트 보존: 키·인라인 없음).
// 장면은 앱 제 문으로만(t4-21 과 같은 makeDim) ＋ 패널 숫자칸 입력·Enter · ⌘Z/⌘⇧Z(되돌림 길 = 저장본 복원과 같은 annotPropsFromDataset → makeAnnotationBlock). page.evaluate 는 읽기만.
// 성공 = 단언 (바닥 5c0a2f62 에서 R1·R2 빨강 · G1·G2 초록)
// 판 정체 — HEAD === EXPECT_SHA · ID_FILES 마다 페이지가 받은 sha1 === 디스크 === EXPECT_FILES_SHA1(JSON · ~/taeyang-098/ty-specenv.py 로 파생)
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, waitStableRect } = require('./_root-harness.js');

test.describe.configure({ timeout: 90000 });

const ORIGIN = 'http://goditor.dom.test';
const VIEW = { width: 1600, height: 1200 };
const MIME = { '.js': 'application/javascript', '.mjs': 'application/javascript', '.css': 'text/css', '.html': 'text/html', '.svg': 'image/svg+xml', '.png': 'image/png', '.json': 'application/json' };
const ID_FILES = ['js/annotation-select.js', 'js/blocks/annotation-block.js', 'js/io/save-load.js', 'js/props/prop-annotation.js'];
const TOL = 2;
const sha1 = (b) => crypto.createHash('sha1').update(b).digest('hex');
const log = (tag, o) => console.log(`T5R ${tag} ${JSON.stringify(o)}`);

async function assertBoard(page) {
  const want = process.env.EXPECT_SHA || '';
  expect(want, '판 정체: EXPECT_SHA 40 hex').toMatch(/^[0-9a-f]{40}$/);
  let wantMap = null; try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) {}
  expect(wantMap && Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = ID_FILES').toEqual([...ID_FILES].sort());
  const noGit = process.env.IDENT_NO_GIT === '1';
  const head = noGit ? null : execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD']).toString().trim();
  const rows = [];
  for (const f of ID_FILES) {
    const b64 = await page.evaluate(async (u) => { const a = new Uint8Array(await (await fetch(u, { cache: 'no-store' })).arrayBuffer());
      let s = ''; for (let k = 0; k < a.length; k += 0x8000) s += String.fromCharCode.apply(null, a.subarray(k, k + 0x8000)); return btoa(s); }, `${ORIGIN}/${f}`);
    rows.push({ f, page: sha1(Buffer.from(b64, 'base64')), root: sha1(fs.readFileSync(path.join(ROOT, f))), want: wantMap[f] });
  }
  log('ident', { root: ROOT, head, noGit, want, rows });
  if (!noGit) expect(head, '판 정체 ⑴ HEAD === EXPECT_SHA').toBe(want);
  for (const r of rows) { expect(r.page, `판 정체 ⑵a ${r.f} 서빙=디스크`).toBe(r.root); expect(r.root, `판 정체 ⑵b ${r.f} 디스크=env`).toBe(r.want); }
}

async function boot(page) {
  const errs = [];
  page.on('pageerror', e => errs.push(String(e).slice(0, 300)));
  page.on('dialog', d => d.dismiss().catch(() => {}));
  await page.setViewportSize(VIEW);
  await page.addInitScript(() => {
    window.electronAPI = new Proxy({}, { get: () => (() => Promise.resolve(null)) });
    window.prompt = () => { throw new Error('prompt() is not supported.'); };
  });
  await page.route('**/*', async (r) => {
    const url = r.request().url();
    if (url.startsWith('data:') || url.startsWith('blob:')) return r.continue();
    if (!url.startsWith(ORIGIN + '/')) return r.abort();
    const f = path.join(ROOT, decodeURIComponent(new URL(url).pathname));
    if (!f.startsWith(ROOT) || !fs.existsSync(f) || fs.statSync(f).isDirectory()) return r.fulfill({ status: 404, body: '' });
    return r.fulfill({ contentType: MIME[path.extname(f)] || 'application/octet-stream', body: fs.readFileSync(f) });
  });
  await page.goto(`${ORIGIN}/index.html`);
  await page.waitForFunction(() => typeof window.rebindAll === 'function' && typeof window.makeAnnotationBlock === 'function' && typeof window.annotDimGeometry === 'function', null, { timeout: 30000 });
  await assertBoard(page);
  return errs;
}
const poll = async (page, fn, arg, timeout = 6000) => { try { await page.waitForFunction(fn, arg, { timeout, polling: 100 }); return true; } catch { return false; } };
const rectOf = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect();
  return { x: r.left, y: r.top, w: r.width, h: r.height, cx: r.left + r.width / 2, cy: r.top + r.height / 2 }; }, sel);
const hitAt = (page, x, y, sel) => page.evaluate(([x, y, s]) => { const e = document.elementFromPoint(x, y); return { ok: !!(e && (e.matches(s) || e.closest(s))),
  hit: e ? (e.id ? '#' + e.id : '') + '.' + String(e.className?.baseVal ?? e.className ?? '').split(' ')[0] : null }; }, [x, y, sel]);
async function zoom100(page) {
  for (let k = 0; k < 20; k++) {
    const z = (await page.textContent('#zoom-display')).trim();
    if (z === '100%') return z;
    await page.click(parseInt(z, 10) < 100 ? '#zoom-ctrl .zoom-btn >> nth=1' : '#zoom-ctrl .zoom-btn >> nth=0');
    await poll(page, (p) => document.getElementById('zoom-display').textContent.trim() !== p, z, 3000);
  }
  return (await page.textContent('#zoom-display')).trim();
}

// 지금 화면의 치수선 — 라벨 중심 · 치수선 두 끝(svg 좌표 → 화면) · 중점 · 손잡이
const snap = (page, id) => page.evaluate((id) => {
  const b = document.getElementById(id); if (!b) return null;
  const C = (e) => { if (!e) return null; const r = e.getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; };
  const m = b.querySelector('.annot-svg')?.getScreenCTM();
  const P = (x, y) => { const p = new DOMPoint(Number(x), Number(y)).matrixTransform(m); return [p.x, p.y]; };
  const ln = b.querySelector('.annot-dim-line');
  const a = P(ln.getAttribute('x1'), ln.getAttribute('y1')), bb = P(ln.getAttribute('x2'), ln.getAttribute('y2'));
  const mid = [(a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2];
  const lab = C(b.querySelector('.annot-label'));
  return { lab, a, b: bb, mid, lm: [lab[0] - mid[0], lab[1] - mid[1]],
    handles: [...b.querySelectorAll('.annot-handle')].map(h => ({ k: h.dataset.dimEnd || ('p' + h.dataset.pointIdx), at: C(h) })) };
}, id);


// 펜 클릭 한 번 — ★섹션 자리를 «누르기 직전»에 다시 재고, 그 점이 «그 섹션»인지 맞힌 뒤 누른다.
//   까닭(v4 실측 G2 1/3 «둘째 점» 빨강): 새 섹션의 부드러운 굴림(addSection scrollIntoView smooth) 동안 첫 자리로 재 둔 좌표가 옆 섹션을 누르면
//   펜 도구가 «다른 섹션 → 점 초기화»(js/annotation-tool.js _handlePenClick)로 간다 — 검사가 빠른 것이지 제품이 아니다(추정 · 대조 안 함).
//   ＋ v5 실측(R1 1/3): 그 전제가 «(770,1140) 이 섹션 밖»으로 잡았다 — 화면 아래 끝(높이 1200)이라 무엇이 덮었다 ⇒ 누르기 전 섹션을 화면 가운데로 굴린다
//     (펜 도구의 점은 섹션 좌표라 굴림과 무관하다 — js/annotation-tool.js _clientToSectionCoord).
async function penClickIn(page, sec, dx, fromBottom) {
  await page.evaluate((s) => document.getElementById(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sec);
  await waitStableRect(page, `#${sec}`);
  const r = await rectOf(page, `#${sec}`);
  const x = r.x + dx, y = r.y + r.h - fromBottom;
  const inSec = await page.evaluate(([x, y, s]) => document.elementFromPoint(x, y)?.closest('.section-block')?.id === s, [x, y, sec]);
  expect(inSec, `전제: 펜 클릭 자리 (${Math.round(x)},${Math.round(y)}) 가 그 섹션 안`).toBe(true);
  await page.mouse.click(x, y);
}
// 앱 문으로 치수선 하나 만들고 고른다 → id
async function makeDim(page) {
  await zoom100(page);
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  expect(await poll(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length), '전제: 새 섹션').toBe(true);
  const sec = (await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id))).find(x => !before.includes(x));
  await page.evaluate((s) => document.getElementById(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sec);
  await waitStableRect(page, `#${sec}`);
  const sr = await rectOf(page, `#${sec}`);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="toggleDimMode"]');
  // 고정 대기 0줄(tests/unit/dom-fixed-wait-census W3) — 클릭마다 «그 클릭이 먹혔다»를 기다린다: 미리보기 점 1 → 2 → 치수선 블럭
  const P = [[250, 60], [550, 60], [400, 110]];
  for (const [k, p] of P.slice(0, 2).entries()) {
    await penClickIn(page, sec, p[0], p[1]);
    expect(await poll(page, (n) => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= n, k + 1, 4000), `전제: 클릭 ${k + 1} 이 점으로 먹혔다`).toBe(true);
  }
  await penClickIn(page, sec, P[2][0], P[2][1]);
  expect(await poll(page, (s) => !!document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]'), sec, 4000), '전제: 치수선 생김(클릭 3)').toBe(true);
  const id = await page.evaluate((s) => document.getElementById(s).querySelector('.annotation-block[data-annot-kind="dim"]').id, sec);
  // 만든 직후 라벨이 편집에 들어간 «뒤»에 Esc(라벨 keydown) — 들어가기 전에 누르면 안 닿는다(dimension-sticker-t3-01 selectDim 머리 :86~95)
  //   ★«편집에 들어갔다» = contenteditable 만이 아니라 ★포커스까지 — 포커스는 setTimeout 0 뒤에 온다(js/annotation-select.js annotBeginLabelEdit 끝)
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return l?.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, id, 4000), '전제: 라벨이 편집에 들어갔다(포커스까지)').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, (i) => document.querySelector(`#${i} .annot-label`)?.getAttribute('contenteditable') !== 'true', id, 4000), '전제: 라벨 편집에서 빠져나왔다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, () => !document.body.classList.contains('pen-mode'), null, 4000), '전제: 펜 모드 꺼짐').toBe(true);
  const lr = await rectOf(page, `#${id} .annot-label`);
  const hit = await hitAt(page, lr.cx, lr.cy, `#${id} .annot-label`);
  expect(hit.ok, `전제: 라벨 맞힘(${hit.hit})`).toBe(true);
  await page.mouse.click(lr.cx, lr.cy);
  expect(await poll(page, (i) => document.getElementById(i).classList.contains('selected') && document.querySelectorAll(`#${i} .annot-handle`).length >= 4, id, 3000), '전제: 고름 · 손잡이 넷(d·c·a·b)').toBe(true);
  expect(await page.evaluate((i) => !!(document.getElementById(i).dataset.dimA && document.getElementById(i).dataset.dimB), id), '전제: a·b 가 박혔다(dimA·dimB)').toBe(true);
  return id;
}


const labelState = (page, id) => page.evaluate((i) => { const b = document.getElementById(i); const l = b.querySelector('.annot-label');
  return { cs: getComputedStyle(l).borderTopLeftRadius, inline: l.style.borderRadius, key: b.dataset.labelRadius ?? null, attr: b.hasAttribute('data-label-radius') }; }, id);
const panelRow = (page) => page.evaluate(() => { const n = document.getElementById('annot-label-radius-num'), s = document.getElementById('annot-label-radius');
  return { num: !!n, slider: !!s, val: n ? n.value : null, min: n?.min ?? null, max: n?.max ?? null, label: n?.closest('.prop-row')?.querySelector('.prop-label')?.textContent?.trim() ?? null }; });

test('G1 (지킴) 새 치수선 라벨 모서리 = 지금 값 4px · 키·인라인 0 (바이트 보존)', async ({ page }) => {
  const errs = await boot(page);
  const id = await makeDim(page);
  const st = await labelState(page, id);
  log('G1', st);
  expect(st.cs, '계산값 = CSS 기본 4px').toBe('4px');
  expect(st.inline, '인라인 반경 없음').toBe('');
  expect(st.attr, 'data-label-radius 없음(옛 저장본과 같은 꼴)').toBe(false);
  expect(errs).toEqual([]);
});

test('R1 치수선 패널 «모서리» 칸 — 0~50 px · 처음 값 4 · 12 를 넣으면 라벨이 12px', async ({ page }) => {
  const errs = await boot(page);
  const id = await makeDim(page);
  const row = await panelRow(page);
  log('R1-row', row);
  expect(row, '칸 꼴 = 라벨그룹 «모서리»와 같다(범위 0~50 · 숫자칸 ＋ 슬라이더)').toEqual({ num: true, slider: true, val: '4', min: '0', max: '50', label: '모서리' });
  await page.fill('#annot-label-radius-num', '12');
  await page.press('#annot-label-radius-num', 'Enter');
  expect(await poll(page, (i) => getComputedStyle(document.querySelector(`#${i} .annot-label`)).borderTopLeftRadius === '12px', id, 3000), '라벨 계산 반경 12px').toBe(true);
  const st = await labelState(page, id);
  log('R1-after', st);
  expect(st.key, '저장 키 labelRadius = 12').toBe('12');
  expect(errs).toEqual([]);
});

test('R2 12px 가 되돌림 길(⌘Z → ⌘⇧Z · 저장본 복원과 같은 다시 짓기)을 지나도 남는다', async ({ page }) => {
  const errs = await boot(page);
  const id = await makeDim(page);
  await page.fill('#annot-label-radius-num', '12');
  await page.press('#annot-label-radius-num', 'Enter');
  expect(await poll(page, (i) => getComputedStyle(document.querySelector(`#${i} .annot-label`)).borderTopLeftRadius === '12px', id, 3000), '전제: 12px 가 섰다').toBe(true);
  await page.keyboard.press('Escape'); await page.mouse.click(5, VIEW.height - 5);
  const mod = process.platform === 'darwin' ? 'Meta' : 'Control';
  await page.keyboard.press(`${mod}+z`);
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return !!l && getComputedStyle(l).borderTopLeftRadius === '4px'; }, id, 4000), '⌘Z 뒤 4px(한 걸음 되돌림)').toBe(true);
  await page.keyboard.press(`${mod}+Shift+z`);
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return !!l && getComputedStyle(l).borderTopLeftRadius === '12px'; }, id, 4000), '⌘⇧Z 뒤 다시 12px').toBe(true);
  log('R2', await labelState(page, id));
  expect(errs).toEqual([]);
});

test('G2 (지킴) 일반 어노테이션 패널엔 «모서리» 칸이 없다(범위 = 치수선)', async ({ page }) => {
  const errs = await boot(page);
  await zoom100(page);
  const before = await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id));
  await page.click('.fp-btn.primary[title="새 섹션 추가"]');
  expect(await poll(page, (n) => document.querySelectorAll('#canvas .section-block:not([data-ghost])').length > n, before.length), '전제: 새 섹션').toBe(true);
  const sec = (await page.evaluate(() => [...document.querySelectorAll('#canvas .section-block:not([data-ghost])')].map(s => s.id))).find(x => !before.includes(x));
  await page.evaluate((s) => document.getElementById(s).scrollIntoView({ block: 'center', behavior: 'instant' }), sec);
  await waitStableRect(page, `#${sec}`);
  const sr = await rectOf(page, `#${sec}`);
  await page.click('#fp-pen-dropdown .fp-dropdown-trigger');
  await page.click('#fp-pen-menu .fp-menu-item[onclick*="togglePenMode"]');
  await penClickIn(page, sec, 250, 60);
  expect(await poll(page, () => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= 1, null, 4000), '전제: 첫 점').toBe(true);
  await penClickIn(page, sec, 450, 90);
  expect(await poll(page, () => document.querySelectorAll('.annot-preview .annot-preview-dot').length >= 2, null, 4000), '전제: 둘째 점').toBe(true);
  await page.keyboard.press('Enter');
  expect(await poll(page, (s) => !!document.getElementById(s).querySelector('.annotation-block:not([data-annot-kind="dim"])'), sec, 4000), '전제: 일반 어노테이션 생김').toBe(true);
  const id = await page.evaluate((s) => document.getElementById(s).querySelector('.annotation-block:not([data-annot-kind="dim"])').id, sec);
  expect(await poll(page, (i) => { const l = document.querySelector(`#${i} .annot-label`); return l?.getAttribute('contenteditable') === 'true' && document.activeElement === l; }, id, 4000), '전제: 라벨 편집(포커스까지)').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, (i) => document.querySelector(`#${i} .annot-label`)?.getAttribute('contenteditable') !== 'true', id, 4000), '전제: 라벨 편집에서 빠져나왔다').toBe(true);
  await page.keyboard.press('Escape');
  expect(await poll(page, () => !document.body.classList.contains('pen-mode'), null, 4000), '전제: 펜 모드 꺼짐').toBe(true);
  const lr = await rectOf(page, `#${id} .annot-label`);
  await page.mouse.click(lr.cx, lr.cy);
  expect(await poll(page, (i) => document.getElementById(i).classList.contains('selected') && !!document.querySelector('#panel-right .prop-section'), id, 3000), '전제: 골라져 패널이 섰다').toBe(true);
  const row = await panelRow(page);
  log('G2', row);
  expect(row.num || row.slider, '일반 어노테이션엔 «모서리» 칸 없음').toBe(false);
  /* ★합침 261026(S7) — 택일5 는 「기본값은 지금처럼 유지(0 으로 안 돌림)」(msg5223 ⒝), 1013t2C6 👉 는 「첨에는 모서리 라운드를 주지말 것」.
     이 칸(일반 어노테이션)에서 두 원문이 갈린다 ⇒ 태양 발주 ① «나중·직접 지시 = 1013t2C6» 로 펜 어노테이션은 0 · 치수선은 4(위 G1 그대로).
     ⬜ 현빈 확인 대기 — 보고서에 양쪽 원문을 적었다. */
  expect(await labelState(page, id).then(s => s.cs), '일반(펜) 어노테이션 라벨은 처음 0px(1013t2C6 ⓒ) — 치수선 4px 은 G1').toBe('0px');
  expect(errs).toEqual([]);
});

test('R3 (곁 실측) 치수선 라벨 «여백» 칸도 화면에 닿는다 — 12 를 넣으면 계산 padding 12px', async ({ page }) => {
  /* ★왜 이 칸 — R1 첫 고친 판에서 «모서리» 칸은 섰는데 라벨이 안 바뀌었다. 까닭(독해): js/props/prop-annotation.js _rerenderAnnotation 이
     치수선이면 annotRedrawDim(자리·글만) 뒤 ★바로 돌아가 «라벨 스타일» 갈래를 안 탄다 ⇒ 같은 절의 다른 칸(여백)도 치수선엔 안 닿는다고 본다 — 그것을 잰다. */
  const errs = await boot(page);
  const id = await makeDim(page);
  await page.fill('#annot-label-pad-num', '12');
  await page.press('#annot-label-pad-num', 'Enter');
  const ok = await poll(page, (i) => getComputedStyle(document.querySelector(`#${i} .annot-label`)).paddingTop === '12px', id, 3000);
  log('R3', await page.evaluate((i) => { const b = document.getElementById(i); const l = b.querySelector('.annot-label'); return { key: b.dataset.labelPad ?? null, pad: getComputedStyle(l).padding, inline: l.style.padding }; }, id));
  expect(ok, '치수선 라벨 계산 padding 12px').toBe(true);
  expect(errs).toEqual([]);
});
