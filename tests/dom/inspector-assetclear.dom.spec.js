/* inspector-assetclear.dom.spec.js — T4-ASSETCLEAR: 인스펙터 «이미지» 줄의 «비우기» (현빈 확정 ⒜ · 2026-10-22)
 *
 * 현빈 확정 ⒜: «이미지만 비움 · 블록 유지». 범위 = 인스펙터 «이미지» 줄만.
 *   ⛔«텍스트» 줄엔 안 단다 — 선례 js/inspector.js 주석 «★★「텍스트」는 ★지디가 넓힌 범위다 — ⛔현빈은 ★이미지만 말했다».
 *
 * 칸:
 *   P0 판 정체 — EXPECT_SHA(40 hex) = git -C ROOT rev-parse HEAD · 페이지가 받은 ID_FILES 바이트 sha1 = 디스크 = EXPECT_FILES_SHA1.
 *      (env 는 ~/taeyang-098/ty-specenv.py 로 이 파일의 ID_FILES 에서 파생한다 — ⛔손으로 베끼지 마라.)
 *   C0 대조(자 ⑶ 의 양성대조) — 있는 clearAssetImage 를 «손 루프»로 3 번 부르면 ⌘Z 1 번에 1/3 만 돌아온다
 *      (그 함수가 부를 때마다 pushHistory 한다 · N 블럭 = N 걸음). 이 자가 «N 걸음»을 잡는다는 증거다.
 *   C1 사람 순서 — 인스펙터 탭을 연다 → «이미지» 줄의 «비우기» 단추를 누른다:
 *      ⑴ 이미지 든 3 블럭: .has-image 0 · data-img-src 0 · .asset-img 0 · .asset-overlay 1 (= 새 빈 블록 꼴)
 *         ＋ 빈 자리표시(체크무늬)가 다시 보인다 — 계산 background-image 에 conic-gradient (전제에서 «이미지 든 동안 꺼짐»을 먼저 잰다)
 *      ⑵ 블록 유지: asset 블록 수 4 그대로 · id 그대로 · 처음부터 빈 1 블록은 바이트 무변
 *      ⑶ ⌘Z 한 번에 3/3 이 같은 src 로 돌아온다 · 이력 증가 ≤ 1
 *   C2 음성대조 ⑷ — «텍스트» 줄에는 단추가 없다 · 단추는 문서 전체에 «이미지» 줄 하나뿐.
 *   C3 저장·다시 열기 — 비운 뒤 직렬화(getSerializedCanvas)를 새 페이지에서 applyProjectData 로 연다 ⇒ 빈 에셋 4 그대로.
 *
 * 장면은 하네스로 만든다(⛔현빈 실데이터): 섹션 1 · asset 이미지 3 + 빈 asset 1 · text 2.
 * 공용부 = ./_root-harness.js (앱 통째 · 가짜 electronAPI).
 */
const { test, expect } = require('@playwright/test');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
const { ROOT, bootApp } = require('./_root-harness.js');

const ID_FILES = ['js/image-handling.js', 'js/inspector.js'];
const N_IMG = 3;           // 이미지 든 asset
const N_EMPTY = 1;         // 처음부터 빈 asset
const N_TEXT = 2;
const sha1 = (buf) => crypto.createHash('sha1').update(buf).digest('hex');

async function setup(page) {
  await page.setViewportSize({ width: 1400, height: 1000 });
  const errs = await bootApp(page);
  await page.evaluate(({ nImg, nEmpty, nText }) => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    c.insertAdjacentHTML('beforeend', `<div class="section-block" id="aS" data-section="1">
      <div class="section-hitzone"></div><div class="section-inner" id="aI"></div></div>`);
    const inner = document.getElementById('aI');
    for (let i = 0; i < nImg + nEmpty; i++) {
      const r = window.makeAssetBlock(); const ab = r.block || r; ab.id = 'aA' + i;
      inner.appendChild(ab);
    }
    for (let i = 0; i < nText; i++) {
      const { block: tb } = window.makeTextBlock('h1');
      const tf = window._makeTextFrame(); window.applyTextOpts(tb, tf, {}, 'h1');
      tf.appendChild(tb); tb.id = 'aT' + i;
      tb.querySelector('[class^="tb-"]').textContent = 'T' + i;
      inner.appendChild(tf);
    }
    window.rebindAll?.();
    const colors = ['#ff6600', '#0066ff', '#22aa44'];
    for (let i = 0; i < nImg; i++) {
      const cv = document.createElement('canvas'); cv.width = 120; cv.height = 60;
      const x = cv.getContext('2d'); x.fillStyle = colors[i % colors.length]; x.fillRect(0, 0, 120, 60);
      window.updateAssetBlock?.('aA' + i, { imgSrc: cv.toDataURL('image/png') });
    }
    window.deselectAll?.(); window.applyZoom?.(100);
  }, { nImg: N_IMG, nEmpty: N_EMPTY, nText: N_TEXT });
  const st = await snapAssets(page);
  /* ★전제 — 장면이 «실제로» 들어갔나. 아니면 아래가 공회전이다. */
  expect(st.length, '전제: asset 블록 수').toBe(N_IMG + N_EMPTY);
  expect(st.filter(a => a.hasImage && a.src).length, '전제: 이미지 든 asset').toBe(N_IMG);
  expect(st.filter(a => a.src).every(a => !a.checker), '전제(자의 양성대조): 이미지 든 asset 은 체크무늬가 «꺼져» 있다').toBe(true);
  expect(st.filter(a => !a.src).every(a => a.checker), '전제: 빈 asset 은 체크무늬가 보인다').toBe(true);
  expect(new Set(st.filter(a => a.src).map(a => a.src)).size, '전제: 이미지 src 셋이 서로 다르다(돌아온 것을 가를 수 있다)').toBe(N_IMG);
  expect(await page.locator('#aI .text-block').count(), '전제: text 블록 수').toBe(N_TEXT);
  return errs;
}

/** asset 블록마다 «비움» 판정에 쓰는 꼴 — 정의 자리(clearAssetImage)가 지우는 것 · 새 빈 블록(makeAssetBlock)의 꼴. */
const snapAssets = (page) => page.evaluate(() => [...document.querySelectorAll('#aI .asset-block')].map(ab => ({
  id: ab.id,
  hasImage: ab.classList.contains('has-image'),
  src: ab.dataset.imgSrc || '',
  imgEls: ab.querySelectorAll('.asset-img').length,
  overlays: ab.querySelectorAll(':scope > .asset-overlay').length,
  /* ★빈 자리표시 = 체크무늬 — css/editor-layout.css «.asset-block { background: repeating-conic-gradient(…) }» ·
     .has-image 가 붙으면 css/editor-blocks.css «.asset-block.has-image { background: transparent }» 가 끈다(지디 덧 08:5x). */
  checker: /conic-gradient/.test(getComputedStyle(ab).backgroundImage),
  html: ab.outerHTML,
})));

/** 사람 순서 ①: 왼쪽 패널 «Inspector» 탭을 누른다(index.html .panel-tab[data-tab=inspector]). */
async function openInspector(page) {
  await page.locator('.panel-tab[data-tab="inspector"]').click();
  await expect(page.locator('#inspector-panel-body'), '전제: 인스펙터 패널이 보인다').toBeVisible();
  await expect(page.locator('#inspector-stats-body .insp-stat-label', { hasText: '이미지' }).first(), '전제: «이미지» 줄이 그려졌다').toBeVisible();
}

/** 라벨로 그 줄을 집는다 — 표시값 · «그 줄의» 비우기 단추 수(줄 안 + 줄 바로 밑 비우기 줄 .insp-stat-action).
 *  ★단추는 줄 «밑» 한 줄에 산다 — 머리 넷의 꼴(inspector-t17 I5: 자식 label+value)을 안 건드리려고. */
const rowOf = (page, label) => page.evaluate((lab) => {
  const el = [...document.querySelectorAll('#inspector-stats-body .insp-stat-label')].find(e => e.textContent.trim() === lab);
  if (!el) return { found: false };
  const row = el.closest('.insp-stat-row');
  const nx = row.nextElementSibling;
  const action = nx && nx.matches('.insp-stat-action') ? nx : null;
  return {
    found: true,
    value: row.querySelector('.insp-stat-value')?.textContent.trim() ?? null,
    kids: [...row.children].map(c => c.className.split(' ')[0]).join('+'),
    clearBtns: row.querySelectorAll('[data-insp-clear]').length + (action ? action.querySelectorAll('[data-insp-clear]').length : 0),
  };
}, label);

const undoOnce = async (page) => {
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
};

test.describe('T4-ASSETCLEAR 인스펙터 «이미지» 비우기', () => {
  test('P0 판 정체 — HEAD = EXPECT_SHA · 페이지가 받은 ID_FILES sha1 = 디스크 = EXPECT_FILES_SHA1', async ({ page }) => {
    const want = process.env.EXPECT_SHA || '';
    expect(/^[0-9a-f]{40}$/.test(want), `EXPECT_SHA 는 40 hex — 받은 값 «${want}»`).toBe(true);
    let wantMap = null;
    try { wantMap = JSON.parse(process.env.EXPECT_FILES_SHA1 || ''); } catch (_) { wantMap = null; }
    expect(wantMap && typeof wantMap === 'object', `EXPECT_FILES_SHA1 은 JSON 객체 — 받은 값 «${process.env.EXPECT_FILES_SHA1 || ''}»`).toBe(true);
    expect(Object.keys(wantMap).sort(), 'EXPECT_FILES_SHA1 열쇠 = ID_FILES 그대로').toEqual([...ID_FILES].sort());
    const head = execFileSync('git', ['-C', ROOT, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim();
    expect(head, `git -C ${ROOT} rev-parse HEAD`).toBe(want);
    const errs = await bootApp(page);
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

  test('C0 대조 — 있는 clearAssetImage 를 손 루프로 3 번 부르면 ⌘Z 한 번에 1/3 만 돌아온다(N 블럭 = N 걸음 · 자 ⑶ 양성대조)', async ({ page }) => {
    const errs = await setup(page);
    const before = await snapAssets(page);
    const len0 = await page.evaluate(() => window.getHistoryTip().len);
    await page.evaluate((n) => { for (let i = 0; i < n; i++) window.clearAssetImage(document.getElementById('aA' + i)); }, N_IMG);
    const len1 = await page.evaluate(() => window.getHistoryTip().len);
    /* 첫 push 는 꼭대기와 같으면 안 쌓인다(history.js 무변화 중복 차단) ⇒ N−1 또는 N. 어느 쪽이든 «1 걸음보다 많다». */
    test.info().annotations.push({ type: 'C0 이력 증가', description: String(len1 - len0) });
    expect(len1 - len0, '손 루프: 이력이 블럭마다 는다(N−1 이상)').toBeGreaterThanOrEqual(N_IMG - 1);
    expect((await snapAssets(page)).filter(a => a.hasImage).length, '손 루프 뒤: 이미지 0').toBe(0);
    await undoOnce(page);
    const after = await snapAssets(page);
    const back = before.filter(b => b.src).filter(b => after.find(a => a.id === b.id)?.src === b.src).length;
    expect(back, '손 루프 뒤 ⌘Z 한 번: 돌아온 이미지 수 = 1 (마지막 블럭만)').toBe(1);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C1 사람 순서 — 인스펙터 열기 → «이미지» 줄 «비우기» ⇒ ⑴ 이미지만 비움 ⑵ 블록 유지 ⑶ ⌘Z 한 번에 전부', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    const r0 = await rowOf(page, '이미지');
    expect(r0.found, '전제: «이미지» 줄').toBe(true);
    expect(r0.value, '전제: «이미지» 줄이 세는 수 = asset 4').toBe(String(N_IMG + N_EMPTY));
    expect(r0.clearBtns, '«이미지» 줄에 비우기 단추가 하나 있다').toBe(1);
    expect(r0.kids, '«이미지» 줄 자신의 꼴은 그대로(label+value · 머리 넷 같은 꼴)').toBe('insp-stat-label+insp-stat-value');

    const before = await snapAssets(page);
    const emptyBefore = before.filter(a => !a.src);
    const tip0 = await page.evaluate(() => window.getHistoryTip());
    await page.locator('#inspector-stats-body [data-insp-clear="assetBlocks"]').click();
    const after = await snapAssets(page);
    const tip1 = await page.evaluate(() => window.getHistoryTip());

    // ⑵ 블록 유지
    expect(after.length, '⑵ asset 블록 수 무변').toBe(before.length);
    expect(after.map(a => a.id), '⑵ asset 블록 id 그대로 · 순서 그대로').toEqual(before.map(a => a.id));
    for (const e of emptyBefore) expect(after.find(a => a.id === e.id)?.html, `⑵ 처음부터 빈 ${e.id} 는 바이트 무변`).toBe(e.html);
    // ⑴ 이미지만 비움 — 정의 자리가 지우는 꼴 = 새 빈 블록 꼴
    for (const a of after) {
      expect(a.hasImage, `⑴ ${a.id} .has-image 0`).toBe(false);
      expect(a.src, `⑴ ${a.id} data-img-src 0`).toBe('');
      expect(a.imgEls, `⑴ ${a.id} .asset-img 0`).toBe(0);
      expect(a.overlays, `⑴ ${a.id} .asset-overlay 1 (빈 에셋 꼴)`).toBe(1);
      expect(a.checker, `⑴ ${a.id} 빈 자리표시(체크무늬 · 계산 background-image) 보임`).toBe(true);
    }
    expect(await page.locator('#aI .text-block').count(), '⑴ text 블록은 안 건드린다').toBe(N_TEXT);
    // ⑶ 이력 한 걸음
    expect(tip1.len - tip0.len, '⑶ 이력 증가 ≤ 1 (N 블럭 = N 걸음이면 빨강)').toBeLessThanOrEqual(1);
    expect((await rowOf(page, '이미지')).clearBtns, '비운 뒤: 비울 이미지 0 ⇒ 단추 0').toBe(0);

    await undoOnce(page);
    const undone = await snapAssets(page);
    const back = before.filter(b => b.src).filter(b => undone.find(a => a.id === b.id)?.src === b.src).length;
    expect(back, `⑶ ⌘Z 한 번에 돌아온 이미지 = ${N_IMG}/${N_IMG} (같은 src)`).toBe(N_IMG);
    expect(undone.length, '⑶ ⌘Z 뒤 asset 블록 수 무변').toBe(before.length);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C2 음성대조 ⑷ — «텍스트» 줄에는 단추가 없다 · 비우기 단추는 «이미지» 줄 하나뿐', async ({ page }) => {
    const errs = await setup(page);
    await openInspector(page);
    const t = await rowOf(page, '텍스트');
    expect(t.found, '전제: «텍스트» 줄').toBe(true);
    expect(t.value, '전제: «텍스트» 줄이 세는 수').toBe(String(N_TEXT));
    expect(t.clearBtns, '⑷ «텍스트» 줄 비우기 단추 0').toBe(0);
    const all = await page.evaluate(() => [...document.querySelectorAll('#inspector-stats-body [data-insp-clear]')]
      .map(b => (b.closest('.insp-stat-row') || b.closest('.insp-stat-action')?.previousElementSibling)
        ?.querySelector('.insp-stat-label')?.textContent.trim() ?? null));
    expect(all.length, '전제(양성): 비우기 단추가 «있다» — 0 이면 아래 «이미지 아닌 줄 0»이 공회전').toBe(1);
    expect(all.filter(l => l !== '이미지'), '⑷ «이미지» 아닌 줄의 비우기 단추 0').toEqual([]);
    expect(errs, 'pageerror').toEqual([]);
  });

  test('C3 저장·다시 열기 — 비운 직렬화를 새 페이지에서 열면 빈 에셋 4 그대로', async ({ page, browser }) => {
    const errs = await setup(page);
    await openInspector(page);
    await page.locator('#inspector-stats-body [data-insp-clear="assetBlocks"]').click();
    const snap = await page.evaluate(() => ({ canvas: window.getSerializedCanvas(), pageSettings: window.state?.pageSettings }));
    expect(snap.canvas.includes('id="aA0"'), '전제: 직렬화에 asset 이 들어 있다').toBe(true);
    expect(/data-img-src=/.test(snap.canvas), '직렬화에 data-img-src 0').toBe(false);

    const ctx = await browser.newContext();
    const p2 = await ctx.newPage();
    const errs2 = await bootApp(p2);
    await p2.evaluate((d) => window.applyProjectData(d), snap);
    const re = await p2.evaluate(() => [...document.querySelectorAll('#canvas .asset-block')].map(ab => ({
      id: ab.id, hasImage: ab.classList.contains('has-image'), src: ab.dataset.imgSrc || '', imgEls: ab.querySelectorAll('.asset-img').length,
      checker: /conic-gradient/.test(getComputedStyle(ab).backgroundImage),
    })));
    expect(re.map(a => a.id).sort(), '다시 열기: asset 블록 4 그대로').toEqual(['aA0', 'aA1', 'aA2', 'aA3']);
    for (const a of re) {
      expect(a.hasImage, `다시 열기: ${a.id} .has-image 0`).toBe(false);
      expect(a.src, `다시 열기: ${a.id} data-img-src 0`).toBe('');
      expect(a.imgEls, `다시 열기: ${a.id} .asset-img 0`).toBe(0);
      expect(a.checker, `다시 열기: ${a.id} 빈 자리표시(체크무늬) 보임`).toBe(true);
    }
    expect(errs, 'pageerror').toEqual([]);
    expect(errs2, 'pageerror(다시 연 페이지)').toEqual([]);
    await ctx.close();
  });
});
