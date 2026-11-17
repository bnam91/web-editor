/* export-missing-image-notice-0912 — 0.9.12 현빈 결정 #11 (261117) · HTML-EXPORT-MISSING-IMAGE-NOTICE-DECISION-01(125행)
 *   현빈: «모든 내보내기에서 문제 되는 경우 일관되게 빠진 그림 알림». 옛: PNG·GIF 는 못 그린 그림을 아무 말 없이 빈칸으로 · HTML 은 console.warn 만 ·
 *   Figma JSON 파일도 console.warn 만 · Figma 업로드만 제 문구 토스트 · .gdt 는 main 이 missingAssets 를 올리는데 렌더러가 안 읽었다.
 * 고침: 문구 한 자리(js/export-result-modal.js missingImageText) —
 *   PNG/JPG/GIF(섹션·전체): captureCloneToCanvas 가 대기 뒤 못 그린 그림을 세어(imgMissing) 섹션 결과에 싣고, 결과 모달(기존)이 요약 줄 + 섹션 줄로 말한다
 *     · 단일 섹션은 «같다» 토스트로 덮지 않고 같은 모달 · HTML·Figma JSON·Figma 업로드·.gdt = 같은 문구 토스트.
 * 장면: 섹션 둘 — sOK(그림 멀쩡) · sMISS(그림 src·data-img-src 를 없는 goya-asset 으로 = 에셋 파일이 사라진 프로젝트). 하네스엔 IPC 가 없어 goya 는 못 읽는다.
 * 칸
 *   E1 sMISS 섹션 PNG → 결과 imgMissing 1 · showExportResultOne = 결과 모달에 «그림 1개를 못 실었습니다»
 *   E2 [지킴] sOK 섹션 PNG → imgMissing 키 없음 · 모달 안 뜸(옛 토스트)
 *   E3 전체 PNG(exportAllImagesPNG) → 모달 요약에 «그림 1개» · 그 줄의 섹션 이름 = sMISS 하나
 *   E4 HTML 내보내기 → 토스트 = 같은 문구(1개) / Figma JSON 파일(exportFigmaJSON) → 토스트 = 같은 문구(1개)
 * 양성대조: _patches/controls/MISSIMG-CTL.patch(제품 다섯 파일 되돌림) → E1·E3·E4 빨강 · E2 초록.
 * 안 잰 것: Figma 업로드(채널·플러그인 필요 — 문구만 공용으로 바꿈) · .gdt(main IPC 필요 — main/gdt/export.js:559 missingAssets 를 읽기만) · GIF(같은 capture() 를 지난다 · 직접 안 돌림) · 네이티브(CDP) 캡처 갈래(하네스는 h2c) · 실앱.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const f2 = (p) => p.waitForFunction(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const GOYA = 'goya-asset://proj_gone/img_missing.png';
const MSG1 = '⚠️ 그림 1개를 못 실었습니다 — 그 자리는 빈 채로 나갔습니다';

async function scene(page) {
  await page.setViewportSize({ width: 1500, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate((GOYA) => {
    const cv = document.createElement('canvas'); cv.width = 300; cv.height = 150; const g = cv.getContext('2d'); g.fillStyle = '#3366cc'; g.fillRect(0, 0, 300, 150);
    const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove());
    for (const id of ['sOK', 'sMISS']) c.insertAdjacentHTML('beforeend', `<div class="section-block" id="${id}" data-section="1" data-name="${id}"><div class="section-hitzone"></div><div class="section-inner"><div class="gap-block" data-type="gap" style="height:30px"></div></div></div>`);
    window.rebindAll?.();
    for (const id of ['sOK', 'sMISS']) {
      window.deselectAll?.(); window.selectSection?.(document.getElementById(id));
      const before = new Set([...document.querySelectorAll('#canvas .asset-block')]);
      window.addAssetBlock();
      const ab = [...document.querySelectorAll('#canvas .asset-block')].find(e => !before.has(e));
      ab.id = 'ab_' + id;
      window.setAssetImageFromSrc(ab, cv.toDataURL('image/png'));
    }
    window.deselectAll?.();
    /* 토스트 기록 · 다운로드 막기(파일은 안 본다 — 재는 것은 «알림») */
    window.__toasts = []; const _t = window.showToast; window.showToast = (m) => { window.__toasts.push(String(m)); return _t?.(m); };
    HTMLAnchorElement.prototype.click = function () {};
  }, GOYA);
  await page.waitForFunction(() => [...document.querySelectorAll('#canvas .asset-block img')].every(i => i.complete && i.naturalWidth > 0));
  /* 에셋 파일이 사라진 프로젝트 — 저장된 src 가 못 읽는 goya-asset */
  await page.evaluate((GOYA) => { const ab = document.getElementById('ab_sMISS'); ab.dataset.imgSrc = GOYA; ab.querySelector('img').setAttribute('src', GOYA); }, GOYA);
  await page.waitForFunction(() => { const i = document.querySelector('#ab_sMISS img'); return i.complete && i.naturalWidth === 0; });
  await f2(page);
  const pre = await page.evaluate(() => ({ ok: document.querySelector('#ab_sOK img').naturalWidth > 0, miss: document.querySelector('#ab_sMISS img').naturalWidth }));
  expect(pre, '[전제] sOK 그림은 그려졌고 sMISS 그림은 못 읽었다').toEqual({ ok: true, miss: 0 });
  return errs;
}
const modalText = (page) => page.evaluate(() => { const m = document.getElementById('exres-modal'); return m ? m.innerText : null; });
const closeModal = (page) => page.evaluate(() => document.getElementById('exres-modal')?.remove());

test('E1 못 읽은 그림 든 섹션 PNG = imgMissing 1 · 결과 모달이 말한다 / E2 [지킴] 멀쩡한 섹션 = 키 없음 · 모달 0', async ({ page }) => {
  const errs = await scene(page);
  const r = await page.evaluate(async () => {
    const one = async (id) => { const res = await window.exportSection(document.getElementById(id), 'png', 860, { forceH2C: true });
      window.showExportResultOne(res, { format: 'png', width: 860 });
      const m = document.getElementById('exres-modal'); const out = { res: { imgMissing: res.imgMissing, failed: !!res.failed }, modal: m ? m.innerText : null }; m?.remove(); return out; };
    return { miss: await one('sMISS'), ok: await one('sOK') };
  });
  console.log('[MISSIMG-DIAG E1/E2] ' + JSON.stringify(r));
  expect(r.miss.res, 'E1 — 못 그린 그림 수가 섹션 결과에 없다').toEqual({ imgMissing: 1, failed: false });
  expect(r.miss.modal, 'E1 — 결과 모달이 안 떴다(옛: «내보냈습니다» 토스트로 덮였다)').not.toBeNull();
  expect(r.miss.modal, 'E1 — 모달에 못 실은 그림 문구가 없다').toContain(MSG1);
  expect(r.ok, 'E2 [지킴] 멀쩡한 섹션 — 키 없음 · 모달 안 뜸').toEqual({ res: { imgMissing: undefined, failed: false }, modal: null });
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E3 전체 PNG — 결과 모달 요약에 «그림 1개» · 그림 못 실은 섹션 줄은 sMISS 하나', async ({ page }) => {
  const errs = await scene(page);
  await page.evaluate(() => { const _e = window.exportSection; window.exportSection = (s, f, w, o) => _e(s, f, w, { ...(o || {}), forceH2C: true }); });
  await page.evaluate(() => window.exportAllImagesPNG());
  await page.waitForFunction(() => !!document.getElementById('exres-modal'), null, { timeout: 60000 }).catch(() => {});
  const r = await page.evaluate(() => { const m = document.getElementById('exres-modal');
    return m ? { sums: [...m.querySelectorAll('.exres-sum')].map(e => e.textContent), rows: [...m.querySelectorAll('.exres-row')].map(e => e.innerText) } : null; });
  console.log('[MISSIMG-DIAG E3] ' + JSON.stringify(r));
  expect(r, '[전제] 전체 내보내기 결과 모달').not.toBeNull();
  expect(r.sums, 'E3 — 요약에 못 실은 그림 줄이 없다').toContain(MSG1);
  const missRows = r.rows.filter(t => t.includes('그림 1개를 못 실었습니다'));
  expect(missRows.length, 'E3 — 그림 못 실은 섹션 줄 수').toBe(1);
  expect(missRows[0], 'E3 — 그 줄이 sMISS 가 아니다').toContain('sMISS');
  await closeModal(page);
  expect(errs, errs.join('\n')).toEqual([]);
});

test('E4 HTML 내보내기 · Figma JSON 파일 — 같은 문구 토스트(1개)', async ({ page }) => {
  const errs = await scene(page);
  const html = await page.evaluate(async () => { window.__toasts = []; await window.exportHTMLFile(); return window.__toasts.slice(); });
  const fig = await page.evaluate(async () => { window.__toasts = []; await window.exportFigmaJSON(); return window.__toasts.slice(); });
  console.log('[MISSIMG-DIAG E4] ' + JSON.stringify({ html, fig }));
  expect(html, 'E4 HTML — 못 실은 그림 토스트가 없다(옛: console.warn 만)').toContain(MSG1);
  expect(fig, 'E4 Figma JSON — 못 실은 그림 토스트가 없다(옛: console.warn 만)').toContain(MSG1);
  expect(errs, errs.join('\n')).toEqual([]);
});
