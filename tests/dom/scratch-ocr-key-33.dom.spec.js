/* scratch-ocr-key-33.dom.spec.js — 시트 33 1020t2a1 AI OCR ★첫 커밋: 스크래치 항목 «ocr» 칸이 저장·로드를 왕복한다
 *
 * ★처방(지디 ㉠ GO) — js/scratch-pad.js
 *   ⑴ SCRATCH_ITEM_KEYS 에 'ocr' (저장·매니페스트·가져오기 등 _pickScratch 파생 여덟 자리가 «담는다»)
 *   ⑵ 로드 길 — `items.forEach(({ … fx }) => _createItem(…, fx))` 가 명부 밖 «손 목록»이었다 ⇒ ocr 를 실어 나른다
 *     (_createItem 아홉째 인자 ocrArg · item.ocr).
 * ★잰 값(S3 · DOM 하네스 ×3 · 고치기 전 탐침): 명부 한 줄만 더한 판 = raw1 남음 · ★mem2 null · ★raw2 null
 *   ⇒ 저장은 되나 다음 로드가 버리고 그다음 저장이 IndexedDB 에서도 지웠다(⑵ 가 빠지면 이 검사 R 이 빨강).
 * ★칸
 *   R  저장(raw1) → 로드(mem2) → 다시 저장(raw2) 셋 다 ocr 그대로
 *   M  매니페스트 하이드레이션(:1428 — IndexedDB 빔 + page.scratchpad) 로드 뒤 ocr 남음 · 그 재저장에도 남음
 *   I  가져오기(_scratchImportAll · :2303) → 로드 뒤 ocr 남음
 *   N  (음성대조) ocr 없는 옛 항목은 저장 글자(JSON)에 ocr 0 · 로드·재저장 앞뒤 바이트 같음
 * ⛔범위 밖(Q5·Q6 판단 뒤): 복제 _scratchDuplicateItem · 되살림 _scratchRestoreItem 은 ocr 를 안 넘긴다 — 이 검사는 안 잰다.
 * ⛔고정 대기 0 — 모두 await 로 끝나는 길만 쓴다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';
const OCR = [{ text: '안녕 OCR', at: 1 }];

/* 페이지 안에서 쓰는 도구 — IndexedDB 날 레코드 읽기 · id 로 찾기 */
const TOOLS = `
  window.__rawScratch = (key) => new Promise((res, rej) => { const o = indexedDB.open('ScratchPadDB');
    o.onsuccess = () => { const q = o.result.transaction('scratch', 'readonly').objectStore('scratch').get(key);
      q.onsuccess = () => { res(q.result || []); o.result.close(); }; q.onerror = () => rej(q.error); }; o.onerror = () => rej(o.error); });
  window.__recOf = (arr, id) => (arr || []).find((x) => x && x.id === id) || null;
`;
async function setup(page) {
  const errs = await bootApp(page);
  await page.evaluate((src) => (new Function(src))(), TOOLS);
  return errs;
}

test('R 저장 → 로드 → 다시 저장 · ocr 셋 다 남는다', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async ({ PNG, OCR }) => {
    const K = 'scratch-pad-pR-pg1';
    await window.initScratchPad('pR', 'pg1');
    await window._scratchAddAndSaveFx(PNG, 200, 10, 100, undefined, 'sNew');
    window._scratchItemById('sNew').ocr = OCR;
    await window.flushScratchForSwitch();
    const raw1 = window.__recOf(await window.__rawScratch(K), 'sNew')?.ocr ?? null;
    await window.initScratchPad('pR', 'pg1');
    const mem2 = window._scratchItemById('sNew')?.ocr ?? null;
    await window.flushScratchForSwitch();
    const raw2 = window.__recOf(await window.__rawScratch(K), 'sNew')?.ocr ?? null;
    return { raw1, mem2, raw2 };
  }, { PNG, OCR });
  expect(r, 'R raw1·mem2·raw2 셋 다 ocr').toEqual({ raw1: OCR, mem2: OCR, raw2: OCR });
  expect(errs).toEqual([]);
});

test('M 매니페스트 하이드레이션(IndexedDB 빔) 로드 뒤 ocr 남음', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async ({ PNG, OCR }) => {
    const pages = window.state.pages;
    const pg = { id: 'pgM', scratchpad: [{ src: PNG, x: 10, y: 10, w: 100, id: 'sM', ocr: OCR }] };
    pages.push(pg);
    try {
      await window.initScratchPad('pM', 'pgM');
      const mem = window._scratchItemById('sM')?.ocr ?? null;
      const raw = window.__recOf(await window.__rawScratch('scratch-pad-pM-pgM'), 'sM')?.ocr ?? null;   // 하이드레이션이 부르는 재저장
      return { hydrated: !!window._scratchItemById('sM'), mem, raw };
    } finally { pages.splice(pages.indexOf(pg), 1); }
  }, { PNG, OCR });
  expect(r.hydrated, '전제: 매니페스트로 채워졌다').toBe(true);
  expect({ mem: r.mem }, 'M 로드 뒤 ocr').toEqual({ mem: OCR });
  await expect.poll(() => page.evaluate(async () => window.__recOf(await window.__rawScratch('scratch-pad-pM-pgM'), 'sM')?.ocr ?? null), { message: 'M 재저장에도 ocr', timeout: 5000 }).toEqual(OCR);
  expect(errs).toEqual([]);
});

test('I 가져오기(_scratchImportAll) → 로드 뒤 ocr 남음', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async ({ PNG, OCR }) => {
    const n = await window._scratchImportAll('pI', [{ pageId: 'pgI', items: [{ src: PNG, x: 10, y: 10, w: 100, id: 'sI', ocr: OCR, linkDy: 5 }] }]);
    const raw = window.__recOf(await window.__rawScratch('scratch-pad-pI-pgI'), 'sI');
    await window.initScratchPad('pI', 'pgI');
    return { n, rawOcr: raw?.ocr ?? null, rawLinkDy: raw ? raw.linkDy ?? null : 'none', mem: window._scratchItemById('sI')?.ocr ?? null };
  }, { PNG, OCR });
  expect({ rawOcr: r.rawOcr, mem: r.mem }, 'I 가져온 레코드·로드 뒤 ocr').toEqual({ rawOcr: OCR, mem: OCR });
  expect({ n: r.n, rawLinkDy: r.rawLinkDy }, '전제: 한 장 가져옴 · linkDy 는 옛 동작대로 빠짐').toEqual({ n: 1, rawLinkDy: null });
  expect(errs).toEqual([]);
});

test('N (음성대조) ocr 없는 옛 항목 — 저장 글자에 ocr 0 · 로드·재저장 앞뒤 바이트 같음', async ({ page }) => {
  const errs = await setup(page);
  const r = await page.evaluate(async ({ PNG }) => {
    const K = 'scratch-pad-pN-pg1';
    const bytes = (rec) => new TextEncoder().encode(JSON.stringify(rec)).length;
    await window.initScratchPad('pN', 'pg1');
    await window._scratchAddAndSaveFx(PNG, 10, 10, 100, undefined, 'sOld');
    await window.flushScratchForSwitch();
    const rec1 = window.__recOf(await window.__rawScratch(K), 'sOld');
    await window.initScratchPad('pN', 'pg1');
    await window.flushScratchForSwitch();
    const rec2 = window.__recOf(await window.__rawScratch(K), 'sOld');
    return { b1: bytes(rec1), b2: bytes(rec2), json1HasOcr: /"ocr"/.test(JSON.stringify(rec1)), json2HasOcr: /"ocr"/.test(JSON.stringify(rec2)), ocr2: rec2.ocr ?? null };
  }, { PNG });
  expect({ same: r.b1 === r.b2, json1HasOcr: r.json1HasOcr, json2HasOcr: r.json2HasOcr, ocr2: r.ocr2 }, 'N 옛 항목 바이트 같음 · ocr 0').toEqual({ same: true, json1HasOcr: false, json2HasOcr: false, ocr2: null });
  console.log(`[33 N] old item JSON bytes ${r.b1} → ${r.b2}`);
  expect(errs).toEqual([]);
});
