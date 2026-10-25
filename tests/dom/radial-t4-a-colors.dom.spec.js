/* radial-t4-a-colors — S6 t4 ⒜ (t4-02 선 색 · t4-04 앞 절반 가운데 기본값) · 2026-10-21
 *
 * 현빈 원문(T4-ORIGINAL.txt):
 *   t4-02 「선 색이 왜 이걸로 되어있는지? C9BDF5이걸로 되어있는데 점색과 통일시켜줘 c9cdd6」
 *     ⇒ 점 색의 참값은 #c8cdd6 이다(radial-block.js 의 dotColor · 지디 확정). 선 색 기본 = 점 색.
 *     ★★2026-10-25 정정 — ★바로 윗줄의 ★「지디 확정 #c8cdd6」은 ★★뒤집혔다. ⛔윗줄을 ★지우지 마라(역사 문장) :
 *       ★현빈 원문이 ★`c9cdd6` 이고(한 자리 차이), ★그 요청값으로 ★제품을 고쳤다 — `ac502952` · `radial-block.js` RADIAL_DOT_COLOR.
 *       ⇒ ★이 스펙의 ★DOT_HEX·DOT_RGB·★칸 제목을 ★그때 ★같이 안 고쳐 ★dev 에 ★빨강 셋이 ★서 있었다.
 *         ★놓친 까닭 = ★고친 뒤 ★「그 값을 쓰는 자」 ★전수를 ★안 했다(단위검사 한 벌만 보고 ★이 DOM 스펙을 못 봤다).
 *   t4-04 「최초에 핵심효능 6가지라는 텍스트도 바꿔줘. 6B4DE0 배경색도 없애줘」
 *     ⇒ (해석) 가운데 글 저장값 '' + 안내문구 «내용을 입력하세요»(인용구 블럭 규약) · 가운데 배경 투명 · 그림자 없음 · 글자 색 #222222.
 *
 * 블럭은 «실제 문»으로 만든다 — 떠 있는 툴바 Component ▾ → 「Radial」(index.html 의 addRadialBlock 버튼).
 * 칸:
 *   P0 판 정체 — EXPECT_SHA(40 hex) = git -C ROOT rev-parse HEAD · 페이지가 받은 radial-block.js 바이트의 sha1
 *      = ROOT 디스크 파일 sha1 = EXPECT_FILE_SHA1(40 hex). (레인은 미커밋이라 핀과 HEAD 가 같다 — 파일 sha1 이 둘을 가른다.)
 *      ⒜-2: 이 덩어리가 건드린 파일 «전부»(ID_FILES 다섯 · spec 자신 제외)를 env EXPECT_FILES_SHA1(JSON {경로: sha1}) 로 받는다 —
 *      열쇠 목록이 정확히 ID_FILES 와 같아야 하고 값은 모두 40 hex · 페이지가 받은 바이트 sha1 = ROOT 디스크 sha1 = env 값.
 *      (proto 데모 둘은 앱이 싣지 않는다 — 하네스 라우트가 ROOT 디스크에서 내주는 바이트를 fetch 로 잰다.)
 *   A1 새 원 블럭 선 색 = 점 기본색 — .rdl-line stroke · dataset.lineColor · 패널 「선 색」 hex = c9cdd6 = RADIAL_DEFAULTS.dotColor
 *   A2 패널 「호」 뒤 — .rdl-line 계산 stroke = .rdl-cell--dot 계산 backgroundColor = rgb(201, 205, 214)
 *   A3 가운데 배경 없음 — .rdl-center 계산 backgroundColor rgba(0, 0, 0, 0) · boxShadow none · dataset.centerBg '' 또는 transparent
 *   A4 가운데 기본 글 = 안내문구 — dataset.centerText '' · [data-is-placeholder="true"] 1개 · 글 «내용을 입력하세요» · 흐림 0.45 · «핵심 효능» 0
 *   A5 글자 색이 흰색이 아니다 — 계산 color ≠ rgb(255, 255, 255) · = 라벨 색 rgb(34, 34, 34)
 *   ⒜-2 (이벨류에이터 변이 M1 · M5 · M6 이 지나간 구멍 + QA⑵ 결함):
 *   A1/A2 원 모드 .rdl-line 의 «계산» stroke = DOT_RGB (★수는 그 상수 한 자리 · 속성 글자만 보던 구멍 · M1)
 *   A3 .rdl-center 아래 자식 모두 계산 배경 투명 (M5)
 *   A6 캡처 클론(capture-safety stripEditorOnlyForCapture)에서 안내문구가 보이지 않는다 · 저장 직렬화 data-center-text = '' (M6)
 *   A7 패널 가운데 「배경」 칸 = 빈 「블럭 배경」 칸과 hex · 알파 · 스와치가 같다(FFFFFF · 검은 000000 아님 · 지디: prop-radial 「블럭 배경」 관용구)
 *      · 알파 칸에 100 을 넣으면 흰색으로 칠해진다(검정 아님)
 *   ⒜-3 (이벨류에이터 eval-a2 E1 · 결함 2):
 *   A8 새 블럭 — 가운데 「배경」 알파 칸과 「블럭 배경」 알파 칸을 각각 눌렀다가 아무것도 안 치고 나오면(blur)
 *      두 칸 글자가 같고 그 값 = 100 (가운데가 100 → 0 으로 뒤집히면 결함) · 문서 값(dataset) 불변
 * 좌표는 waitStableRect 로 멈춘 뒤 «두 번» 재서 같을 때만 누른다(고정 대기 없음). */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { execFileSync } = require('child_process');
const { ROOT, bootApp, waitStableRect } = require('./_root-harness.js');
const { clickAt } = require('./_click-at.js');

const ID_FILE = 'js/blocks/radial-block.js';
/* ⒜-2: 정체 파일 — 이 덩어리(⒜ + ⒜-2)가 건드린 파일 전부(spec 자신 제외). */
const ID_FILES = ['css/editor-radial.css', 'js/blocks/radial-block.js', 'js/props/prop-radial.js', 'proto/demo-z6-a-arc.html', 'proto/demo-z6-a.html'];
/* ★261025 — ★현빈 요청값(`c9cdd6`)으로 맞췄다. ★정본은 `js/blocks/radial-block.js` 의 RADIAL_DOT_COLOR 한 자리고,
   ★여기 두 상수는 ★그 값을 ★손으로 ★베낀 ★둘째 명부다 ⇒ ★갈리면 ★이 머리말을 ★같이 고쳐라. */
const DOT_HEX = '#c9cdd6';
const DOT_RGB = 'rgb(201, 205, 214)';
const PH = '내용을 입력하세요';
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

/** 멈춘 사각형을 두 번 재서 같은지 본다 — 다르면 빨강(옛 좌표로 누르지 않는다). */
async function stableTwice(page, sel, opts = {}) {
  const a = await waitStableRect(page, sel, opts);
  const b = await waitStableRect(page, sel, opts);
  expect([b.left, b.top, b.width, b.height], `${sel}[${opts.index || 0}] 두 번 잰 사각형이 같다`).toEqual([a.left, a.top, a.width, a.height]);
  expect(a.width > 0 && a.height > 0, `${sel} 크기가 있다`).toBe(true);
  return b;
}

async function setup(page) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  const errs = await bootApp(page);
  const secId = await page.evaluate(async () => {
    await document.fonts?.ready;
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.addSection?.();
    const sec = c.querySelector('.section-block');
    window.deselectAll?.();
    window.selectSection?.(sec);
    window.clearHistory?.();
    return sec?.id || null;
  });
  expect(secId, '전제: 섹션이 하나 있다').toBeTruthy();
  return { errs, secId };
}

/** Component ▾ → 「Radial」 을 진짜로 눌러 원 블럭 하나를 만든다. */
async function makeRadial(page) {
  const { errs, secId } = await setup(page);
  const trig = '#fp-component-dropdown .fp-dropdown-trigger';
  const t = await stableTwice(page, trig);
  await clickAt(page, t.cx, t.cy, { sel: trig }, { label: 'Component 펼치기' });
  await expect(page.locator('#fp-component-dropdown')).toHaveClass(/open/);
  const idx = await page.evaluate(() => [...document.querySelectorAll('#fp-component-menu .fp-menu-item')].findIndex((b) => b.textContent.trim() === 'Radial'));
  expect(idx, '전제: 삽입 메뉴에 「Radial」 이 있다').toBeGreaterThanOrEqual(0);
  const r = await stableTwice(page, '#fp-component-menu .fp-menu-item', { index: idx });
  const hit = await page.evaluate(([x, y]) => (document.elementFromPoint(x, y)?.textContent || '').trim(), [r.cx, r.cy]);
  expect(hit, '누를 자리 = 「Radial」').toBe('Radial');
  await clickAt(page, r.cx, r.cy, { sel: '#fp-component-menu .fp-menu-item' }, { label: 'Radial 누르기' });
  await expect.poll(() => page.evaluate(() => document.querySelectorAll('#canvas .radial-block').length), { message: '전제: 방사형 블럭 1개' }).toBe(1);
  const id = await page.evaluate(() => document.querySelector('#canvas .radial-block').id);
  await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage`), id, { timeout: 15000 });
  await stableTwice(page, `[id="${id}"]`);
  const st = await page.evaluate((bid) => { const b = document.getElementById(bid); return { shape: b.dataset.shape, sec: b.closest('.section-block')?.id || null }; }, id);
  expect(st, '전제: 고른 섹션에 원 블럭').toEqual({ shape: 'circle', sec: secId });
  return { errs, id };
}

test.describe('S6 t4 ⒜ radial 기본 색 · 가운데', () => {
  test('P0 판 정체 — HEAD = EXPECT_SHA · 페이지가 받은 radial-block.js sha1 = 디스크 = EXPECT_FILE_SHA1', async ({ page }) => {
    const want = process.env.EXPECT_SHA || '';
    const wantFile = process.env.EXPECT_FILE_SHA1 || '';
    /* ★★261025 — ★이 칸은 ★«레인 전용»이다. ★기준값 셋이 ★환경변수로만 오고(버전관리 ★밖) ⇒
       ★그 변수 ★없이 돌면 ★★언제나 ★빨강이었다. ★dev 에 들어온 뒤로 ★줄곧 그랬다.
       ⇒ ★★「범위 밖 검사는 ★FAIL 이 아니라 ★SKIP」. ★이름 = `RADIAL-P0-IDENTITY-NEEDS-LANE-ENV-01`
       ⛔지우지 ★마라 — ★레인이 ★`EXPECT_SHA=… EXPECT_FILE_SHA1=… EXPECT_FILES_SHA1=…` 를 넘기면
         ★이 칸이 ★스스로 ★깨어나 ★전과 똑같이 ★잰다(아래 단언 ★한 줄도 ★안 고쳤다). */
    test.skip(!want && !wantFile && !process.env.EXPECT_FILES_SHA1,
      'RADIAL-P0-IDENTITY-NEEDS-LANE-ENV-01 — 레인 환경변수(EXPECT_SHA·EXPECT_FILE_SHA1·EXPECT_FILES_SHA1)가 없다');
    expect(/^[0-9a-f]{40}$/.test(want), `EXPECT_SHA 는 40 hex — 받은 값 «${want}»`).toBe(true);
    expect(/^[0-9a-f]{40}$/.test(wantFile), `EXPECT_FILE_SHA1 은 40 hex — 받은 값 «${wantFile}»`).toBe(true);
    let wantMap = null;
    try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) { wantMap = null; }
    expect(wantMap && typeof wantMap === 'object', `EXPECT_FILES_SHA1 은 JSON 객체 — 받은 값 «${process.env.EXPECT_FILES_SHA1 || ''}»`).toBe(true);
    expect(Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = 건드린 파일 목록 그대로').toEqual([...ID_FILES].sort());
    for (const rel of ID_FILES) expect(/^[0-9a-f]{40}$/.test(String(wantMap[rel])), `EXPECT_FILES_SHA1[${rel}] 은 40 hex — 받은 값 «${wantMap[rel]}»`).toBe(true);
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(head, `git -C ${ROOT} rev-parse HEAD`).toBe(want);
    const disk = sha1(fs.readFileSync(path.join(ROOT, ID_FILE)));
    const errs = await bootApp(page);
    const b64 = await page.evaluate(async (rel) => {
      const res = await fetch('/' + rel, { cache: 'no-store' });
      if (!res.ok) return null;
      const u8 = new Uint8Array(await res.arrayBuffer());
      let s = '';
      for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
      return btoa(s);
    }, ID_FILE);
    expect(b64, '전제: 페이지가 파일을 받았다').toBeTruthy();
    const served = sha1(Buffer.from(b64, 'base64'));
    expect(served, '페이지가 받은 바이트 = 디스크 파일').toBe(disk);
    expect(served, '페이지가 받은 바이트 = EXPECT_FILE_SHA1').toBe(wantFile);
    for (const rel of ID_FILES) {
      const d = sha1(fs.readFileSync(path.join(ROOT, rel)));
      const got = await page.evaluate(async (r) => {
        const res = await fetch('/' + r, { cache: 'no-store' });
        if (!res.ok) return null;
        const u8 = new Uint8Array(await res.arrayBuffer());
        let s = '';
        for (let i = 0; i < u8.length; i += 0x8000) s += String.fromCharCode.apply(null, u8.subarray(i, i + 0x8000));
        return btoa(s);
      }, rel);
      expect(got, `전제: 페이지가 ${rel} 를 받았다`).toBeTruthy();
      const sv = sha1(Buffer.from(got, 'base64'));
      expect(sv, `${rel}: 페이지가 받은 바이트 = 디스크`).toBe(d);
      expect(sv, `${rel}: 페이지가 받은 바이트 = EXPECT_FILES_SHA1`).toBe(wantMap[rel]);
    }
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A1 새 원 블럭 선 색 = 점 기본색 #c9cdd6 (stroke · dataset · 패널 hex)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await expect(page.locator('#rdl-line-hex'), '전제: 패널 「선 색」 칸이 열렸다').toHaveCount(1);
    const m = await page.evaluate(async (bid) => {
      const mod = await import('/js/blocks/radial-block.js');
      const b = document.getElementById(bid);
      const lines = b.querySelectorAll('.rdl-line');
      return { lines: lines.length, stroke: (lines[0]?.getAttribute('stroke') || '').toLowerCase(), ds: (b.dataset.lineColor || '').toLowerCase(),
        shape: b.dataset.shape, cstroke: lines[0] ? getComputedStyle(lines[0]).stroke : null,
        hex: (document.getElementById('rdl-line-hex')?.value || '').toLowerCase(), dotDefault: String(mod.RADIAL_DEFAULTS.dotColor).toLowerCase() };
    }, id);
    expect(m.lines, '전제: 선 1개').toBe(1);
    expect(m.dotDefault, '점 기본색(참값)').toBe(DOT_HEX);
    expect(m.stroke, '.rdl-line stroke = 점 기본색').toBe(DOT_HEX);
    expect(m.shape, '전제: 원 모드').toBe('circle');
    expect(m.cstroke, '원 모드 .rdl-line 의 «계산» stroke(화면 색) = 점 기본색').toBe(DOT_RGB);
    expect(m.ds, 'dataset.lineColor = 점 기본색').toBe(DOT_HEX);
    expect(m.hex, '패널 「선 색」 hex = 점 기본색').toBe(DOT_HEX.slice(1));
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A2 패널 「호」 뒤 — 선의 화면 색 = 점의 화면 색 rgb(201, 205, 214)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const c0 = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const ls = [...b.querySelectorAll('.rdl-line')];
      return { shape: b.dataset.shape, n: ls.length, strokes: [...new Set(ls.map((l) => getComputedStyle(l).stroke))] };
    }, id);
    expect(c0.shape, '전제: 「호」 누르기 전 = 원').toBe('circle');
    expect(c0.n, '전제: 원 모드 선이 있다').toBeGreaterThan(0);
    expect(c0.strokes, `원 모드 선의 계산 stroke = ${DOT_RGB}`).toEqual([DOT_RGB]);
    const r = await stableTwice(page, '#rdl-shape-arc');
    await clickAt(page, r.cx, r.cy, { sel: '#rdl-shape-arc' }, { label: '패널 「호」' });
    await page.waitForFunction((bid) => !!document.querySelector(`[id="${bid}"] > .rdl-stage--arc .rdl-cell--dot`), id, { timeout: 15000 });
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const line = b.querySelector('.rdl-line');
      const dots = [...b.querySelectorAll('.rdl-cell--dot')];
      return { shape: b.dataset.shape, line: line ? getComputedStyle(line).stroke : null, dots: dots.length, dotBgs: [...new Set(dots.map((d) => getComputedStyle(d).backgroundColor))] };
    }, id);
    expect(m.shape, '전제: 호로 바뀌었다').toBe('arc');
    expect(m.dots, '전제: 점이 있다').toBeGreaterThan(0);
    expect(m.dotBgs, `점 색 한 가지 = ${DOT_RGB}`).toEqual([DOT_RGB]);
    expect(m.line, '선의 계산 stroke = 점의 계산 색').toBe(m.dotBgs[0]);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A3 새 원 블럭 가운데 — 배경 투명 · 그림자 없음', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const cs = [...b.querySelectorAll('.rdl-center')];
      const c = cs[0];
      const kids = c ? [...c.querySelectorAll('*')] : [];
      return { n: cs.length, mode: b.dataset.centerMode, ds: b.dataset.centerBg, bg: c ? getComputedStyle(c).backgroundColor : null, shadow: c ? getComputedStyle(c).boxShadow : null,
        kids: kids.length, kidBgs: kids.map((k) => `${k.className}:${getComputedStyle(k).backgroundColor}`).filter((x) => !x.endsWith(':rgba(0, 0, 0, 0)')) };
    }, id);
    expect(m.n, '전제: 가운데 1개').toBe(1);
    expect(m.mode, '전제: 가운데 = 글').toBe('text');
    expect(m.bg, '가운데 계산 배경 = 투명').toBe('rgba(0, 0, 0, 0)');
    expect(m.shadow, '가운데 그림자 = none').toBe('none');
    expect(['', 'transparent'], `dataset.centerBg 는 '' 또는 transparent — 실제 «${m.ds}»`).toContain(m.ds);
    expect(m.kids, '전제: 가운데 안에 자식(글 칸)이 있다').toBeGreaterThan(0);
    expect(m.kidBgs, '가운데 자식 모두 계산 배경 투명(투명 아닌 것 목록 = 빈 배열)').toEqual([]);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A4 가운데 기본 글 = 안내문구 «내용을 입력하세요» (저장값 \'\' · 흐림 · 옛 글 0)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const phs = [...b.querySelectorAll('.rdl-center [data-is-placeholder="true"]')];
      return { ds: b.dataset.centerText, n: phs.length, text: phs[0] ? phs[0].textContent : null, opacity: phs[0] ? getComputedStyle(phs[0]).opacity : null,
        old: (b.textContent.match(/핵심 효능/g) || []).length };
    }, id);
    expect(m.ds, 'dataset.centerText = \'\'').toBe('');
    expect(m.n, '안내문구 표식 1개').toBe(1);
    expect(m.text, '안내문구 글').toBe(PH);
    expect(m.opacity, '인용구 블럭과 같은 흐림(editor-blocks.css #canvas [data-is-placeholder])').toBe('0.45');
    expect(m.old, '«핵심 효능» 0건').toBe(0);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A5 가운데 글자 색 ≠ 흰색 (= 라벨 색 #222222)', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate((bid) => {
      const b = document.getElementById(bid);
      const c = b.querySelector('.rdl-center');
      return { color: c ? getComputedStyle(c).color : null, ds: b.dataset.centerColor };
    }, id);
    expect(m.color, '전제: 가운데가 있다').not.toBeNull();
    expect(m.color, '글자 색이 흰색이 아니다').not.toBe('rgb(255, 255, 255)');
    expect(m.color, '글자 색 = 라벨 색').toBe('rgb(34, 34, 34)');
    expect(m.ds, 'dataset.centerColor').toBe('#222222');
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A6 안내문구는 캡처 클론에서 안 보인다 · 저장 data-center-text = \'\'', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const m = await page.evaluate(async ([bid, ph]) => {
      const cs = await import('/js/io/capture-safety.js');
      const b = document.getElementById(bid);
      const sec = b.closest('.section-block');
      const phEl = b.querySelector('.rdl-center [data-is-placeholder="true"]');
      const html = window.getSerializedCanvas();
      const d = document.createElement('div'); d.innerHTML = html;
      const sb = d.querySelector(`[id="${bid}"]`);
      const clone = sec.cloneNode(true); clone.id = 'rdl-t4a-clone';
      clone.style.position = 'absolute'; clone.style.left = '-5000px'; clone.style.top = '0';
      document.body.appendChild(clone);
      const before = (clone.innerText || '').includes(ph);
      cs.stripEditorOnlyForCapture(clone);
      const vis = [...clone.querySelectorAll('*')].filter((e) => !e.children.length && (e.textContent || '').includes(ph) && getComputedStyle(e).visibility !== 'hidden' && getComputedStyle(e).display !== 'none').length;
      const after = (clone.innerText || '').includes(ph);
      clone.remove();
      return { secOk: !!sec, still: phEl ? cs.isStillPlaceholderText(phEl) : null, saved: sb ? sb.getAttribute('data-center-text') : null, before, vis, after };
    }, [id, PH]);
    expect(m.secOk, '전제: 블럭이 섹션 안에 있다').toBe(true);
    expect(m.still, '라이브 안내문구 칸 = capture-safety 가 «아직 안내문구»로 본다').toBe(true);
    expect(m.saved, '저장 직렬화(getSerializedCanvas)의 data-center-text = \'\'').toBe('');
    expect(m.before, '전제: 벗기기 전 클론엔 안내문구가 보였다').toBe(true);
    expect(m.vis, '벗긴 클론에서 안내문구가 보이는 채 남은 요소 0').toBe(0);
    expect(m.after, '벗긴 클론 innerText 에 안내문구 0').toBe(false);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A7 패널 가운데 「배경」 = 빈 「블럭 배경」 칸과 같은 꼴(FFFFFF · 검은 000000 아님) · 알파 100 → 흰색', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    await expect(page.locator('#rdl-center-bg-hex'), '전제: 패널 가운데 「배경」 칸이 열렸다').toHaveCount(1);
    const m = await page.evaluate((bid) => {
      const f = (p) => {
        const hex = document.getElementById(`${p}-hex`), al = document.getElementById(`${p}-alpha`);
        const sw = hex?.closest('.prop-color-field')?.querySelector('.prop-color-swatch');
        return { hex: hex?.value ?? null, alpha: al?.value ?? null, swatch: sw ? getComputedStyle(sw).backgroundColor : null };
      };
      return { bgDs: document.getElementById(bid).dataset.bg ?? null, centerDs: document.getElementById(bid).dataset.centerBg, center: f('rdl-center-bg'), block: f('rdl-bg') };
    }, id);
    console.log('A7 잰 값', JSON.stringify(m));
    expect(m.bgDs || '', '전제: 「블럭 배경」 = 빈 값(투명 기본)').toBe('');
    expect(m.block.hex, '전제: 「블럭 배경」 칸이 있다').not.toBeNull();
    expect(m.center, '가운데 「배경」 칸 = 빈 값일 때의 「블럭 배경」 칸(hex · 알파 · 스와치)').toEqual(m.block);
    expect(['', 'transparent'], `가운데 배경 dataset = 투명 기본 — 실제 «${m.centerDs}»`).toContain(m.centerDs);
    expect(m.center.hex, '「배경」 hex = FFFFFF (검은 000000 아님)').toBe('FFFFFF');
    expect(m.center.swatch, '스와치 = 흰색(검은 rgb(0, 0, 0) 아님)').toBe('rgb(255, 255, 255)');
    await page.locator('#rdl-center-bg-alpha').fill('100');
    await expect.poll(() => page.evaluate((bid) => document.getElementById(bid).dataset.centerBg, id), { message: '알파 100 → dataset.centerBg = 흰색' }).toBe('#ffffff');
    const bg = await page.evaluate((bid) => getComputedStyle(document.querySelector(`[id="${bid}"] .rdl-center`)).backgroundColor, id);
    expect(bg, '알파를 올린 가운데 계산 배경 = 흰색(검정 아님)').toBe('rgb(255, 255, 255)');
    expect(errs, 'pageerror').toEqual([]);
  });

  test('A8 알파 칸 들어갔다 나오기(안 침) — 가운데 「배경」 = 「블럭 배경」 = 100', async ({ page }) => {
    const { errs, id } = await makeRadial(page);
    const read = (p) => page.evaluate(([bid, pre]) => {
      const b = document.getElementById(bid);
      return { alpha: document.getElementById(`${pre}-alpha`)?.value ?? null, focus: document.activeElement?.id || null,
        dsBg: b.dataset.bg ?? null, dsCenterBg: b.dataset.centerBg ?? null };
    }, [id, p]);
    const out = {};
    for (const p of ['rdl-center-bg', 'rdl-bg']) {
      await expect(page.locator(`#${p}-alpha`), `전제: ${p} 알파 칸`).toHaveCount(1);
      const before = await read(p);
      await page.locator(`#${p}-alpha`).click();
      const inFocus = await read(p);
      await page.locator(`#${p}-alpha`).blur();
      const after = await read(p);
      out[p] = { before, inFocus, after };
      expect(inFocus.focus, `전제: ${p} 알파 칸에 포커스`).toBe(`${p}-alpha`);
      expect(after.focus, `전제: ${p} 알파 칸에서 나왔다`).not.toBe(`${p}-alpha`);
      expect([after.dsBg, after.dsCenterBg], `${p}: 안 치고 나오면 문서 값 불변`).toEqual([before.dsBg, before.dsCenterBg]);
    }
    console.log('A8 잰 값', JSON.stringify(out));
    expect(out['rdl-center-bg'].after.alpha, 'blur 뒤 가운데 「배경」 알파 = 「블럭 배경」 알파').toBe(out['rdl-bg'].after.alpha);
    expect(out['rdl-center-bg'].after.alpha, 'blur 뒤 가운데 「배경」 알파 = 100 (0 으로 뒤집히면 결함)').toBe('100');
    expect(out['rdl-bg'].after.alpha, 'blur 뒤 「블럭 배경」 알파 = 100').toBe('100');
    expect(errs, 'pageerror').toEqual([]);
  });
});
