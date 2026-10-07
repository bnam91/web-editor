/* thumb-skip-live-canvas — 썸네일이 «안 쓸» 라이브 캔버스를 베끼지 않는다 (2026-10-07 지디 ㉠).
 *
 * ★무엇이 병이었나: html2canvas 는 찍을 요소 하나가 아니라 «문서 전체»를 복제·레이아웃한다.
 *   썸네일(save-load.js captureThumbnail)은 첫 섹션 «클론» 하나만 쓰는데 #canvas 의 모든 섹션까지 복제됐다.
 *   실측(판 2866df63 ×3 · 입자 시안 320개 × 20 섹션): 썸네일 한 번 12.7~34.5 s · 메인스레드 최장 막힘 11.3~31.3 s.
 * ★처방: 그 호출부에만 ignoreElements(#canvas) 를 인자로 — capture 공용 길(내보내기 PNG)은 «안» 바뀐다.
 *
 * ★시간 대신 «부하에 안 흔들리는 수»로 잰다: html2canvas 의 onclone 으로 «복제된 문서»의 .section-block 수를 센다.
 *   TS1 썸네일 = 1 (클론 하나) · TS2 내보내기 PNG = 라이브 N + 클론 1 (그대로 — 음성대조: capture 본체 기본값을 안 바꿨다)
 *   TS3 뺀 것이 그림에 «0 픽셀»이었다 — 같은 장면을 ignoreElements 뗀 채 다시 찍어 썸네일 data URL 이 «같다».
 * 양성대조(핀 2866df63 · 고치기 전 판): TS1 빨강(복제 21) · TS2 초록 · TS3 초록(뗄 것이 없어 같다) — 커밋 메시지·보고에 판과 함께.
 */
const { test, expect } = require('@playwright/test');
const { bootApp } = require('./_root-harness.js');
const { INSTALL_FAKE_META_SRC } = require('./_fake-meta.js');

const N = 6;   // 라이브 섹션 수 — 「첫 섹션 밖」이 있어야 잴 것이 있다

async function setup(page) {
  await page.setViewportSize({ width: 1500, height: 1000 });
  await bootApp(page);
  await page.evaluate(([fake, N]) => {
    (new Function(fake))();
    window.activeProjectId = 'pA';
    window.__meta.pA = {};
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach(s => s.remove());
    for (let i = 0; i < N; i++) {
      c.insertAdjacentHTML('beforeend', `<div class="section-block" id="ts${i}" data-section="${i + 1}" style="background:${i ? '#2a6' : '#36c'}"><div class="section-inner"><div class="gap-block" data-type="gap" style="height:${120 + i * 10}px"></div></div></div>`);
    }
    window.rebindAll?.();
    /* html2canvas 를 감싸 «부를 때 받은 옵션»과 «복제된 문서의 섹션 수»를 적는다. 진짜 html2canvas 는 그대로 돈다. */
    const real = window.html2canvas;
    window.__h2c = [];
    window.__stripIgnore = false;
    window.html2canvas = function (el, o) {
      const rec = { hasIgnore: typeof (o && o.ignoreElements) === 'function', clonedSections: null, ignoresCanvas: null, ignoresTarget: null };
      if (rec.hasIgnore) { rec.ignoresCanvas = o.ignoreElements(document.getElementById('canvas')) === true; rec.ignoresTarget = o.ignoreElements(el) === true; }
      window.__h2c.push(rec);
      const o2 = Object.assign({}, o);
      if (window.__stripIgnore) delete o2.ignoreElements;
      const prev = o2.onclone;
      o2.onclone = (doc, clonedEl) => { rec.clonedSections = doc.querySelectorAll('.section-block').length; return prev ? prev(doc, clonedEl) : undefined; };
      return real.call(this, el, o2);
    };
  }, [INSTALL_FAKE_META_SRC, N]);
}
const thumb = (page) => page.evaluate(async () => {
  window.__h2c.length = 0; window.__meta.pA = {};
  await window.saveProjectToFile(window.serializeProject(), { projectId: 'pA' });
  return { t: window.__meta.pA.thumbnail || null, calls: window.__h2c.slice() };
});

test('TS1 ★썸네일 — 복제된 문서에 섹션은 «클론 하나»뿐(라이브 캔버스를 안 베낀다)', async ({ page }) => {
  await setup(page);
  expect(await page.evaluate(() => document.querySelectorAll('#canvas .section-block').length), '★전제: 라이브 섹션이 여럿이다').toBe(N);
  const r = await thumb(page);
  expect(typeof r.t, '★전제: 썸네일이 찍혀 실렸다').toBe('string');
  expect(r.calls.length, '★전제: 썸네일 저장에서 html2canvas 가 불렸다').toBeGreaterThan(0);
  const c = r.calls[0];
  expect(c.clonedSections, `썸네일이 라이브 캔버스까지 복제했다(복제 문서 섹션 ${c.clonedSections})`).toBe(1);
  expect(c.ignoresCanvas, '술어가 #canvas 를 빼야 한다').toBe(true);
  expect(c.ignoresTarget, '술어가 찍을 클론 자신을 빼면 빈 그림이다').toBe(false);
});

test('TS2 ★음성대조 — 내보내기 PNG(capture 공용 길)는 그대로: ignoreElements 없음 · 라이브 섹션도 복제', async ({ page }) => {
  await setup(page);
  const r = await page.evaluate(async () => {
    window.__h2c.length = 0;
    const sec = document.querySelector('#canvas .section-block');
    const out = await window.exportSection(sec, 'png', 860, { returnDataUrl: true, forceH2C: true });
    const url = typeof out === 'string' ? out : (out && (out.dataUrl || out.url)) || null;
    return { ok: typeof url === 'string' && url.startsWith('data:image/png'), calls: window.__h2c.slice() };
  });
  expect(r.ok, '★전제: 내보내기가 PNG data URL 을 돌려줬다').toBe(true);
  expect(r.calls.length, '★전제: 내보내기에서 html2canvas 가 불렸다').toBeGreaterThan(0);
  for (const c of r.calls) {
    expect(c.hasIgnore, 'capture 공용 길에 ignoreElements 가 생겼다 — 썸네일 호출부에만 두기로 했다').toBe(false);
    expect(c.clonedSections, '내보내기 복제 문서 = 라이브 N + 클론 1(그대로여야 한다)').toBe(N + 1);
  }
});

test('TS3 뺀 것이 그림에 «0 픽셀» — ignoreElements 를 뗀 채 다시 찍어도 썸네일이 같다', async ({ page }) => {
  await setup(page);
  const a = await thumb(page);
  await page.evaluate(() => { window.__stripIgnore = true; });
  const b = await thumb(page);
  expect(typeof a.t, '★전제: 썸네일이 찍혔다').toBe('string');
  expect(b.calls[0].clonedSections, '★전제: 뗀 판은 라이브 캔버스를 복제했다(대조가 살아 있다)').toBe(N + 1);
  expect(a.t === b.t, `썸네일 그림이 갈렸다(길이 ${a.t && a.t.length} · ${b.t && b.t.length}) — 뺀 것이 그림에 들어가 있었다`).toBe(true);
});
