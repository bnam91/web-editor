/* save-load-roundtrip-1001.dom.spec.js — 지디 2026-10-01 ③「저장·불러오기 왕복이 통째로 미측정 — 이번 묶음에서 가장 큰 구멍」
 * 앱 통째(bootApp) · 기능은 «진짜 길»로 만들고(⌘M·우클릭 메뉴·⌘⇧M), 저장·다시 열기는:
 *   serializeProject()(저장 직전 JSON) → bootApp 으로 «새로 띄움»(런타임 상태 전부 버림) → applyProjectData(JSON)(불러온 것 적용).
 *   ⚠️디스크 쓰기·읽기(electronAPI)는 이 하네스 밖 — «무엇을 쓰고 무엇을 읽어 세우나»까지 잰다.
 *   ⚠️스크래치 IndexedDB(C1 의 스크래치 항목 fx)는 별도 — 여기선 «캔버스 에셋에 입힌 fx»만.
 * ★양성대조 판 7699ea33: R1 R2 R3 은 기능 자체가 없어 «전제에서 진다»(약한 빨강) — 이 파일은 «왕복이 깨지지 않는가»를 재는 지킴 시험이다.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const PX = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

const SECS = `
<div class="section-block" id="sA" data-section="1" data-name="위섹션" data-bg="rgb(250,240,230)" style="background-color:rgb(250,240,230);">
  <div class="section-hitzone"><span class="section-label">위섹션</span></div>
  <div class="section-inner" style="padding-left:40px;padding-right:40px;" data-padding-x="40">
    <div class="gap-block" data-type="gap" id="gA1" style="height:100px;"></div>
    <div class="frame-block" id="tfA" data-text-frame="true"><div class="text-block" id="tbA" data-type="body"><div class="tb-body" contenteditable="false">위 글자</div></div></div>
    <div class="gap-block" data-type="gap" id="gA2" style="height:80px;"></div>
  </div></div>
<div class="section-block" id="sB" data-section="2" data-name="아래섹션" data-bg="rgb(20,30,90)" style="background-color:rgb(20,30,90);">
  <div class="section-hitzone"><span class="section-label">아래섹션</span></div>
  <div class="section-inner" style="padding-left:12px;padding-right:12px;" data-padding-x="12">
    <div class="gap-block" data-type="gap" id="gB1" style="height:60px;"></div>
    <div class="frame-block" id="tfB" data-text-frame="true"><div class="text-block" id="tbB" data-type="body"><div class="tb-body" contenteditable="false">아래 글자</div></div></div>
    <div class="gap-block" data-type="gap" id="gB2" style="height:60px;"></div>
  </div>
  <div class="frame-block" id="ovB" data-overlay-block="true" data-sel-variant="sticker" data-free-layout="true" data-offset-x="300" data-offset-y="70"
       style="position:absolute;left:300px;top:70px;width:90px;height:90px;"><div class="shape-block" id="shB" style="width:100%;height:100%;background:#e44"></div></div>
</div>
<div class="section-block" id="sC" data-section="3" data-name="셋째" data-bg="rgb(200,250,200)" style="background-color:rgb(200,250,200);">
  <div class="section-hitzone"><span class="section-label">셋째</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gC1" style="height:50px;"></div>
    <div class="frame-block" id="tfC" data-text-frame="true"><div class="text-block" id="tbC" data-type="body"><div class="tb-body" contenteditable="false">셋째 글자</div></div></div></div>
</div>`;


/* 섹션 하나의 «보이는 꼴» — 이름·배경색·안쪽 좌우여백·내용 순서·떠 있는 블럭의 섹션 기준 자리 */
const shape = (page, id) => page.evaluate((id) => {
  const s = document.getElementById(id); if (!s) return null;
  const inner = s.querySelector(':scope > .section-inner');
  const sr = s.getBoundingClientRect(), k = sr.width / s.offsetWidth;
  const ov = s.querySelector('#ovB'); const orr = ov?.getBoundingClientRect();
  return { name: s.dataset.name, bg: getComputedStyle(s).backgroundColor, padL: inner?.style.paddingLeft,
           /* 갭은 «높이»로 잰다 — 되살린 이음매 갭은 새 id 를 받는다(지운 갭의 id 는 기록 안 했다). 다른 블럭은 id 로. */
           order: [...inner.querySelectorAll(':scope > [id]')].map(e => e.classList.contains('gap-block') ? 'gap@' + parseFloat(e.style.height) : e.id),
           ov: ov ? { parent: ov.parentElement.id, x: Math.round((orr.left - sr.left) / k), y: Math.round((orr.top - sr.top) / k) } : null };
}, id);

async function mergeBIntoA(page) {
  await page.evaluate(() => { window.deselectAll?.(); const b = document.getElementById('sB'); window.selectSectionWithModifier?.(b, { metaKey: false, shiftKey: false }); });
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+m');
  await page.waitForTimeout(150);
}


const SEC = `
<div class="section-block" id="sG" data-section="1" data-name="G" data-bg="rgba(255,255,255,0)" style="background-color:rgba(255,255,255,0);">
  <div class="section-hitzone"><span class="section-label">G</span></div>
  <div class="section-inner"><div class="gap-block" data-type="gap" id="gG" style="height:40px;"></div>
    <div class="row" id="rowA"><div class="asset-block has-image" id="abG" data-img-src="${PX}" style="height:200px;">
      <div class="asset-img-clip"><img class="asset-img" src="${PX}" style="width:100%;height:100%;object-fit:cover"></div></div></div>
  </div></div>`;


async function rclickMenu(page, blockId, itemId) {
  const [x, y] = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [r.left + r.width / 2, r.top + r.height / 2]; }, blockId);
  await page.mouse.click(x, y, { button: 'right' });
  const it = await page.evaluate((id) => { const el = document.getElementById(id); const r = el.getBoundingClientRect(); return { vis: getComputedStyle(el).display, xy: [r.left + 20, r.top + r.height / 2] }; }, itemId);
  return it;
}


async function boot(page, html) {
  await page.setViewportSize({ width: 1600, height: 1100 });
  await bootApp(page);
  await page.evaluate((h) => { const c = document.getElementById('canvas'); c.querySelectorAll('.section-block').forEach(s => s.remove()); c.insertAdjacentHTML('beforeend', h); window.rebindAll?.(); window.deselectAll?.(); }, html);
  await page.waitForTimeout(200);
}
/* 저장 → 새로 띄움 → 불러옴. 돌려주는 것 = 저장한 JSON(무엇이 디스크로 가는가) */
async function reopen(page, mutate) {
  const snap = await page.evaluate(() => window.serializeProject());
  const data = mutate ? mutate(JSON.parse(snap)) : JSON.parse(snap);
  await bootApp(page);
  await page.evaluate((d) => window.applyProjectData(d), data);
  await page.waitForTimeout(300);
  return snap;
}
async function splitB(page) {
  await page.evaluate(() => { window.deselectAll?.(); window.selectBlock?.('tbB'); document.activeElement?.blur?.(); });
  await page.keyboard.press('Meta+Shift+m');
  await page.waitForTimeout(150);
}

test('R1 ★D1 — 합치기 → 저장·다시 열기 → 분리: 이름·배경·좌우여백·이음매 갭·떠 있는 블럭이 원래대로', async ({ page }) => {
  await boot(page, SECS);
  const A0 = await shape(page, 'sA'), B0 = await shape(page, 'sB');
  await mergeBIntoA(page);
  expect(await page.evaluate(() => !!document.getElementById('sB')), '전제 — 합쳐졌다').toBe(false);
  const snap = await reopen(page);
  expect(snap, '저장본에 «합칠 때 남긴 기록»이 실린다').toContain('data-merged-name');
  expect(snap).toContain('data-merged-tail-gap-h');
  await splitB(page);
  expect(await shape(page, 'sB')).toEqual(B0);
  expect(await shape(page, 'sA')).toEqual(A0);
});
test('R2 ★D1 «옛 저장본»(기록 없는 proj.json) 도 왕복에서 조용히 안 깨진다 — 기본값으로 나누고 토스트로 알린다', async ({ page }) => {
  await boot(page, SECS);
  await mergeBIntoA(page);
  /* 옛 판이 남긴 저장본 = 합친 상자에 mergedName·mergedTailGapH·mergedOuter 가 «없다» — JSON 에서 지워 만든다 */
  await reopen(page, (d) => { d.pages.forEach(p => { p.canvas = p.canvas.replace(/\sdata-merged-(name|tail-gap-h|outer)="[^"]*"/g, ''); }); return d; });
  expect(await page.evaluate(() => document.querySelectorAll('[data-merged-name],[data-merged-tail-gap-h],[data-merged-outer]').length), '전제 — 기록이 정말 없다').toBe(0);
  await page.evaluate(() => { window.__toasts = []; const o = window.showToast; window.showToast = (m, ...a) => { window.__toasts.push(String(m)); return o?.(m, ...a); }; });
  await splitB(page);
  const r = await page.evaluate(() => { const b = document.getElementById('sB'); return { back: !!b, name: b?.dataset.name, secs: document.querySelectorAll('#canvas > .section-block').length, toasts: window.__toasts }; });
  expect(r.back, '분리는 된다').toBe(true);
  expect(r.secs).toBe(3);
  expect(r.name).toMatch(/^Section \d+$/);
  expect(r.toasts.join('|'), '기록이 없었다는 걸 말한다').toMatch(/기록|기본/);
});
test('R3 ★C2 — 「이 섹션 배경으로」 → 저장·다시 열기 → 정본(dataset.bgImg)이 남고 화면도 그 그림', async ({ page }) => {
  await boot(page, SEC);
  const it = await rclickMenu(page, 'abG', 'bcm-asset-to-secbg');
  await page.mouse.click(it.xy[0], it.xy[1]); await page.waitForTimeout(150);
  const before = await page.evaluate(() => document.getElementById('sG').dataset.bgImg);
  expect(before, '전제 — 배경이 걸렸다').toBeTruthy();
  await reopen(page);
  const r = await page.evaluate(() => { const s = document.getElementById('sG'); s.scrollIntoView(); return { ds: s.dataset.bgImg, css: getComputedStyle(s).backgroundImage }; });
  expect(r.ds).toBe(before);
  await page.waitForTimeout(300);
  expect(await page.evaluate(() => getComputedStyle(document.getElementById('sG')).backgroundImage)).toContain('url(');
});
/* fx 묶음을 «뜻»으로 비교한다 — img.style 은 브라우저가 다시 쓸 때 띄어쓰기가 바뀐다(「width:100%」→「width: 100%」). 속성별 값 맵으로. */
const FX_NORM = `(() => { const fx = window.captureAssetFx(document.getElementById('abG'));
  const m = {}; const d = document.createElement('div'); d.setAttribute('style', fx.img?.style || '');
  for (let i = 0; i < d.style.length; i++) { const k = d.style[i]; m[k] = d.style.getPropertyValue(k); }
  return JSON.stringify({ ...fx, img: { ...fx.img, style: Object.keys(m).sort().map(k => k + '=' + m[k]) } }); })()`;
test('R4 ★C1 — 캔버스 에셋에 입힌 이미지 효과(fx 묶음)가 저장·다시 열기 뒤 «같은 묶음»', async ({ page }) => {
  await boot(page, SEC);
  await page.evaluate(() => {
    const ab = document.getElementById('abG');
    /* 효과를 «앱의 길»로 입힌다: 다른 에셋에서 잡은 fx 를 setAssetImageWithFx 로(C1 이 스크래치→캔버스에서 쓰는 그 함수) */
    const src = ab.cloneNode(true); src.id = 'abSrc';
    Object.assign(src.dataset, { fit: 'contain', imgX: '12', imgY: '-8', imgRotate: '15', overlay: 'rgba(10,20,30,0.4)' });
    src.querySelector('img').style.objectFit = 'contain';
    const fx = window.captureAssetFx(src);
    window.setAssetImageWithFx(ab, ab.dataset.imgSrc, fx);
  });
  const fx0 = await page.evaluate(FX_NORM);
  expect(JSON.parse(fx0).ds, '전제 — 효과가 실렸다').toMatchObject({ imgRotate: '15', overlay: 'rgba(10,20,30,0.4)' });
  await reopen(page);
  expect(await page.evaluate(FX_NORM)).toBe(fx0);
});
