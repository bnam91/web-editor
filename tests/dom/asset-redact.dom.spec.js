/* asset-redact — 에셋(이미지)블럭 «블러 (Redact)»를 행위로 잰다 (1012t1 C1 · 현빈 원문 「블러 (Redact)」)
 *
 * ★설계(plan-C1): 상태 = 에셋 블럭 자신의 data-redact(1..100) + 인라인 --redact-blur(px).
 *   그림 = 그림(.asset-img / 구운 canvas) «자신»의 filter: blur — 인라인은 writeImgFilter 한 자리(색보정과 합성),
 *   인라인이 비면 css/editor-layout.css 가 바닥으로 흐린다 · 사방 3σ 키우고 클립이 자른다. 공용 모듈 js/effects/image-redact.js.
 *   ⛔backdrop(뒤 막)은 버렸다 — 캔버스 배율 >100% 에서 아래·오른쪽 띠가 원본을 보였다(이벨류에이터 2026-10-13 · R11 이 잠근다).
 *
 * 칸
 *   R1 패널 자리·꼴 — ★2026-10-26 1012t1C1 이동: 입구 = Effects 드롭다운(#asset-fx-add)의 「블러」 · 고르면 Effects 카드 안에
 *      「강도」 줄(그레인 줄과 같은 꼴) · 옛 따로 절 0 · 그림 없는 에셋엔 「블러」 항목 없음
 *   R2 슬라이더 60 → 속성·변수·그림 계산 filter blur(12px)
 *   R3 0 = 지움(바이트 — outerHTML 에 redact 0건)
 *   R4 픽셀 — 흐림(가운데 줄 sd) · 상자 밖 번짐 0 · 안 가장자리 바탕색 기미 없음 (양성대조: 켜기 전 sd 큼)
 *   R5 저장 왕복(getSerializedCanvas → innerHTML) · undo 1번이면 꺼짐
 *   R6 이미지 교체 후 유지 · 이미지 제거 후 속성·변수 없음
 *   R7 스크래치 이동(captureAssetFx → setAssetImageWithFx) 보존 — 변수까지
 *   R8 html2canvas 안전실패 — 양성대조(neutralize 없이 = 원본 누출) · neutralize 뒤 회색 · 클론 src 없음 · 라이브 무변경
 *   R9 색보정 공존 — 그림 인라인 filter 에 url(#…) 와 blur 가 같이 산다(순서 둘 다)
 *   R10 Figma JSON — redact 실림 · 원본 src 문자열이 JSON 어디에도 없다(양성대조: 끄면 있다)
 *   R11 캔버스 배율 150·200 — 줄(높이 2~98%)·가장자리 세로줄 전부 켬/끔 sd 비 < 0.1 (양성대조: 끔 sd ≥ 20)
 *   R12 배율 150 + 색보정 동시 — 같은 비 < 0.1 · 인라인 filter 에 url(…) 와 blur(12px) 둘 다 · undo 뒤에도 다시 합성
 *
 * ⛔고정 대기 0(waitForFunction / expect.poll) · ⛔화면 px 사각형을 읽지 않는다(R4 는 하네스가 자리를 «정한» 최소판).
 *
 * 음성대조(쓴 이가 정한 것 — ★이 파일은 아직 안 돌았다):
 *   · image-redact.js writeImgFilter 의 블러 몫 줄(parts.push(`blur(…)`)) 빼기              ⇒ R12(색보정이 인라인을 쥐면 바닥 CSS 가 못 이긴다) 빨강
 *     (R11 은 색보정이 없어 바닥 CSS 가 흐리므로 초록일 수 있다 — 그 축은 아래 «옛 뒤 막»으로 잰다)
 *   · css/editor-layout.css 에셋 블러를 옛 뒤 막(::after backdrop)으로 되돌리기               ⇒ R11 빨강(누출 띠)
 *   · image-redact.js applyRedact 의 '--redact-blur' → '--redact-blux'(setProperty 줄)     ⇒ R2(변수) 빨강 · R4 는 폴백 8px 로 초록일 수 있다(정상)
 *   · applyRedact v<=0 갈래 `delete host.dataset.redact;` 주석                              ⇒ R3 · R6 빨강
 *   · effects-blur.js 카드의 `-redact-slider` → `-redact-slidex`                               ⇒ R1 빨강
 *   · image-handling.js ASSET_FX_DS_KEYS 에서 'redact' 빼기                                   ⇒ R7 빨강
 *   · capture-safety.js 새 루프의 removeAttribute('src') + visibility 줄 끄기 + box 배경 3줄 끄기 ⇒ R8 빨강
 *   · export-figma-json.js `return redact ? { src: null, redact } : {};` → `return {};`        ⇒ R10 빨강
 */
const { test, expect } = require('@playwright/test');
const { boot, bootApp } = require('./_root-harness.js');

/* ── 공용: 앱(bootApp)에 그림 든 에셋 하나 ─────────────────────────────────── */
async function setupAsset(page) {
  const errs = await bootApp(page);
  await page.evaluate(async () => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.(); window.addSection();
    window.applyZoom?.(100);
    /* 줄무늬 PNG — 파랑/노랑 6px (흐림 판정용) */
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180;
    const x = cv.getContext('2d');
    for (let i = 0; i < 240; i += 12) { x.fillStyle = '#0000ff'; x.fillRect(i, 0, 6, 180); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, 180); }
    window.__SRC = cv.toDataURL('image/png');
    const cv2 = document.createElement('canvas'); cv2.width = 8; cv2.height = 8;
    cv2.getContext('2d').fillRect(0, 0, 8, 8);
    window.__SRC2 = cv2.toDataURL('image/png');
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.();
    window.setAssetImageFromSrc(block, window.__SRC);
    window.__AB = block.id;
  });
  await page.waitForFunction(() => {
    const ab = document.getElementById(window.__AB);
    const img = ab && ab.querySelector('.asset-img-clip .asset-img');
    return !!(ab && ab.classList.contains('has-image') && img && img.complete && img.naturalWidth > 0);
  }, null, { timeout: 15000 });
  return errs;
}
/* ★2026-10-26 1012t1C1 이동 — 블러 입구가 «Effects 드롭다운의 「블러」»가 됐다. 사람 길 그대로: 패널을 열고 「블러」를 고른다.
   고르면 기본 강도(FX_BLUR_DEFAULT = 40 ⇒ 8px)로 켜지고 카드 안에 옛 id 그대로의 슬라이더가 선다.
   ⇒ 이 헬퍼 «뒤»의 상태는 «끔»이 아니라 «기본값 켬»이다 — 끔 전제를 재던 R2·R5 는 전제를 헬퍼 «앞»에서 잰다. */
const openPanel = async (page) => {
  await page.evaluate(() => window.showAssetProperties(document.getElementById(window.__AB)));
  await page.waitForFunction(() => !!document.getElementById('asset-fx-add'), null, { timeout: 5000 });
  await page.selectOption('#asset-fx-add', 'blur');
  await page.waitForFunction(() => !!document.getElementById('asset-redact-slider'), null, { timeout: 5000 });
};
/** 슬라이더를 사람 손처럼: input(라이브) → change(커밋) */
const slide = (page, v) => page.evaluate((val) => {
  const s = document.getElementById('asset-redact-slider');
  s.value = String(val);
  s.dispatchEvent(new Event('input', { bubbles: true }));
  s.dispatchEvent(new Event('change', { bubbles: true }));
}, v);
/** 지금 상태 — 매번 id 로 다시 찾는다(undo·왕복 뒤 노드가 바뀐다) */
const state = (page) => page.evaluate(() => {
  const ab = document.getElementById(window.__AB);
  if (!ab) throw new Error('다시 찾았는데 없다: ' + window.__AB);
  const media = ab.querySelector(':scope > .asset-img-clip > :is(.asset-img, canvas)');
  return {
    attr: ab.getAttribute('data-redact'),
    blurVar: ab.style.getPropertyValue('--redact-blur') || '',
    imgFilter: media ? getComputedStyle(media).filter : null,      // 계산값(바닥 CSS + 인라인)
    imgInline: media ? (media.style.filter || '') : null,          // 인라인(합성 한 자리가 쓴 것)
    hasImage: ab.classList.contains('has-image'),
    outerHasRedact: /redact/i.test(ab.outerHTML),
  };
});

test('R1 패널 — Effects 드롭다운에 「블러」 · 고르면 Effects 카드 안 「강도」 줄(그레인과 같은 꼴) · 옛 따로 절 0 · 그림 없으면 항목 없다', async ({ page }) => {
  const errs = await setupAsset(page);
  await page.evaluate(() => window.showAssetProperties(document.getElementById(window.__AB)));
  const pre = await page.evaluate(() => {
    const sel = document.getElementById('asset-fx-add');
    return { opts: sel ? [...sel.options].map(o => [o.value, o.textContent.trim()]) : null,
             oldSec: !!document.getElementById('asset-redact-section'), slider: !!document.getElementById('asset-redact-slider'),
             titles: [...document.querySelectorAll('#prop-panel .prop-section-title, .prop-section-title')].map(t => t.textContent.trim()) };
  });
  console.log('R1 pre', JSON.stringify(pre.opts));
  expect(pre.opts, '전제: 그림 든 에셋 패널에 Effects 드롭다운이 없다').not.toBe(null);
  expect(pre.opts, 'Effects 드롭다운에 「블러」 가 없다').toContainEqual(['blur', '블러']);
  expect(pre.oldSec, '옛 따로 절 «블러 (Redact)» 가 남았다(두 곳)').toBe(false);
  expect(pre.titles, '옛 절 제목이 패널에 남았다').not.toContain('블러 (Redact)');
  expect(pre.slider, '고르기 전부터 블러 슬라이더가 있다(옛 절)').toBe(false);
  await openPanel(page);
  const out = await page.evaluate(() => {
    const grainSec = document.getElementById('asset-grain-slider')?.closest('.prop-section');
    const gs = document.getElementById('asset-grain-slider'), gn = document.getElementById('asset-grain-number');
    const rs = document.getElementById('asset-redact-slider'), rn = document.getElementById('asset-redact-number');
    const card = rs?.closest('.prop-cell-card');
    return {
      grainNextIsFx: !!grainSec && grainSec.nextElementSibling?.id === 'asset-fx-section',
      inFx: !!rs?.closest('#asset-fx-section'), cardType: card?.dataset.fxType || null,
      cardTitle: card?.querySelector('.prop-cell-card-title')?.textContent.trim() || null,
      optsAfter: [...(document.getElementById('asset-fx-add')?.options || [])].map(o => o.value),
      rsType: rs?.type, rsMin: rs?.min, rsMax: rs?.max, rnType: rn?.type, rnMin: rn?.min, rnMax: rn?.max,
      sameSliderCls: rs?.className === gs?.className, sameNumberCls: rn?.className === gn?.className,
      sameRowCls: rs?.parentElement?.className === gs?.parentElement?.className,
      label: rs?.parentElement?.querySelector('.prop-label')?.textContent || null,
      rowInline: rs ? rs.parentElement.querySelectorAll('[style]').length + (rs.parentElement.hasAttribute('style') ? 1 : 0) : -1,
    };
  });
  console.log('R1', JSON.stringify(out));
  expect(out.grainNextIsFx, '그레인 바로 다음이 Effects 절이 아니다(옛 절이 끼어 있다)').toBe(true);
  expect(out.inFx, '블러 슬라이더가 Effects 절 안에 없다').toBe(true);
  expect(out.cardType).toBe('blur');
  expect(out.cardTitle).toBe('블러');
  expect(out.optsAfter, '건 뒤에도 드롭다운에 「블러」 가 남았다(종류당 하나)').not.toContain('blur');
  expect([out.rsType, out.rsMin, out.rsMax]).toEqual(['range', '0', '100']);
  expect([out.rnType, out.rnMin, out.rnMax]).toEqual(['number', '0', '100']);
  expect(out.sameSliderCls && out.sameNumberCls && out.sameRowCls, '그레인 줄과 클래스가 다르다').toBe(true);
  expect(out.label).toBe('강도');
  expect(out.rowInline, '강도 줄에 인라인 style 이 생겼다(디자인시스템)').toBe(0);

  /* 그림 없는 에셋 — 「블러」 항목이 없다(전제: 패널은 열렸다) */
  const none = await page.evaluate(() => {
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block);
    window.showAssetProperties(block);
    const sel = document.getElementById('asset-fx-add');
    return { panelOpen: !!document.getElementById('asset-bg-clear'), redact: !!document.getElementById('asset-redact-slider'),
             blurOpt: !!sel?.querySelector('option[value="blur"]'), hasImage: block.classList.contains('has-image') };
  });
  expect(none.hasImage, '전제: 빈 에셋인데 has-image').toBe(false);
  expect(none.panelOpen, '전제: 빈 에셋 패널이 안 열렸다').toBe(true);
  expect(none.redact, '그림 없는 에셋에 블러 줄이 있다').toBe(false);
  expect(none.blurOpt, '그림 없는 에셋 드롭다운에 「블러」 가 있다').toBe(false);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R2 슬라이더 60 → data-redact 60 · --redact-blur 12px · 그림 filter blur(12px)', async ({ page }) => {
  const errs = await setupAsset(page);
  const s0 = await state(page);   /* ★전제는 «고르기 전»에 잰다 — openPanel 이 「블러」를 골라 기본값으로 켠다(1012t1C1 이동) */
  expect(s0.attr, '전제: 처음부터 켜져 있다').toBe(null);
  expect(s0.imgFilter, '전제: 켜기 전엔 그림 filter 가 없어야 한다').toBe('none');
  await openPanel(page);
  const sDef = await state(page);
  expect([sDef.attr, sDef.blurVar.trim()], '「블러」를 고르면 기본 강도 40 ⇒ 8px 로 켜진다').toEqual(['40', '8px']);
  await slide(page, 60);
  await expect.poll(async () => (await state(page)).imgFilter).toContain('blur(12px)');
  const s1 = await state(page);
  expect(s1.attr).toBe('60');
  expect(s1.blurVar.trim()).toBe('12px');
  expect(s1.imgInline, '합성 한 자리가 인라인에 블러 몫을 안 썼다').toContain('blur(12px)');
  expect(await page.evaluate(() => document.getElementById('asset-redact-number').value)).toBe('60');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R3 0 = 지움 — 속성·변수 없음 · outerHTML 에 redact 0건', async ({ page }) => {
  const errs = await setupAsset(page);
  await openPanel(page);
  await slide(page, 60);
  await expect.poll(async () => (await state(page)).attr).toBe('60');
  await page.evaluate(() => {
    const n = document.getElementById('asset-redact-number');
    n.value = '0';
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });
  await expect.poll(async () => (await state(page)).attr).toBe(null);
  const s = await state(page);
  expect(s.blurVar).toBe('');
  expect(s.outerHasRedact, '끈 뒤에도 바이트에 redact 가 남았다').toBe(false);
  expect(s.imgFilter, '끈 뒤에도 그림이 흐리다').toBe('none');
  expect(s.imgInline, '끈 뒤에도 인라인 블러가 남았다').toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── R4·R8 최소판: 자리를 하네스가 «정한다»(화면 사각형을 안 읽는다) ─────────────────── */
const STAGE_W = 420, STAGE_H = 320, INSET = 10;     // 바탕(빨강) 420×320 안에 10px 띄워 400×300 에셋
const ROW_Y = 160;                                  // 가운데 줄
const ROW_X0 = 70, ROW_X1 = 350;                    // 가장자리 피해서
const OUT_X = INSET - 3;                            // 상자 밖 3px
const EDGE_X = INSET;                               // 안 가장자리 첫 px
const SD_ON = 50, SD_OFF = 5, EDGE_TINT_MAX = 12, LEAK_SD = 100;
const MINI = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/design-tokens.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<style>html,body{margin:0;padding:0;background:#ffffff;}
#stage{position:fixed;left:0;top:0;width:${STAGE_W}px;height:${STAGE_H}px;background:#ff0000;overflow:hidden;}</style>
</head><body>
<div id="stage"><div class="asset-block has-image" id="ab_r"
  style="position:absolute;left:${INSET}px;top:${INSET}px;width:${STAGE_W - INSET * 2}px;height:${STAGE_H - INSET * 2}px;margin:0;padding:0;border-radius:24px;outline:none;">
  <div class="asset-img-clip"><img class="asset-img" id="img_r" draggable="false"></div></div></div>
<script src="/vendor/html2canvas/html2canvas.min.js"></script>
<script type="module">
  import * as R from '/js/effects/image-redact.js';
  import { neutralizeRedactForH2C } from '/js/io/capture-safety.js';
  window.__R = R; window.__neutralize = neutralizeRedactForH2C;
  const c = document.createElement('canvas'); c.width = ${STAGE_W - INSET * 2}; c.height = ${STAGE_H - INSET * 2};
  const x = c.getContext('2d');
  for (let i = 0; i < c.width; i += 12) { x.fillStyle = '#0000ff'; x.fillRect(i, 0, 6, c.height); x.fillStyle = '#ffff00'; x.fillRect(i + 6, 0, 6, c.height); }
  /* 그림 하나를 «잰다»: 이미지(가로 cssW 기준)에서 가운데 줄 B 채널 sd · 밖 3px · 안 가장자리 */
  window.__stats = (src, cssW) => {
    const k = src.width / cssW;
    const ctx = src.getContext ? src.getContext('2d') : null;
    const px = (cx, cy) => Array.from(ctx.getImageData(Math.floor(cx * k), Math.floor(cy * k), 1, 1).data);
    const bs = [];
    for (let xx = ${ROW_X0}; xx < ${ROW_X1}; xx++) bs.push(px(xx, ${ROW_Y})[2]);
    const m = bs.reduce((a, b) => a + b, 0) / bs.length;
    const sd = Math.sqrt(bs.reduce((a, b) => a + (b - m) * (b - m), 0) / bs.length);
    return { sd: Math.round(sd * 10) / 10, out: px(${OUT_X}, ${ROW_Y}), edge: px(${EDGE_X}, ${ROW_Y}), mid: px(${(ROW_X0 + ROW_X1) / 2}, ${ROW_Y}) };
  };
  window.__fromPng = async (b64, cssW) => {
    const bmp = await createImageBitmap(await (await fetch('data:image/png;base64,' + b64)).blob());
    const cv = document.createElement('canvas'); cv.width = bmp.width; cv.height = bmp.height;
    cv.getContext('2d').drawImage(bmp, 0, 0);
    return window.__stats(cv, cssW);
  };
  const img = document.getElementById('img_r');
  img.onload = () => { window.__ready = true; };
  window.__SRC = c.toDataURL('image/png');
  img.src = window.__SRC;
</script></body></html>`;
const measureScreen = async (page) => {
  const png = await page.screenshot({ clip: { x: 0, y: 0, width: STAGE_W, height: STAGE_H } });
  return page.evaluate(([b64, w]) => window.__fromPng(b64, w), [png.toString('base64'), STAGE_W]);
};

test('R4 픽셀 — 흐림(sd) · 상자 밖 번짐 0 · 안 가장자리 바탕색 기미 없음 (양성대조 = 켜기 전)', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 600 });
  const errs = await boot(page, MINI);
  const before = await measureScreen(page);
  console.log('R4 before', JSON.stringify(before));
  expect(before.sd, '양성대조: 켜기 전 줄무늬가 안 보인다 ⇒ 이 자는 흐림을 못 가른다').toBeGreaterThan(SD_ON);
  expect(before.out.slice(0, 3), '전제: 상자 밖이 빨강 바탕이 아니다').toEqual([255, 0, 0]);
  await page.evaluate(() => window.__R.applyRedact(document.getElementById('ab_r'), 60));
  await page.waitForFunction(() => /blur\(12px\)/.test(getComputedStyle(document.querySelector('#ab_r > .asset-img-clip > .asset-img')).filter || ''));
  await expect.poll(async () => (await measureScreen(page)).sd, { message: '켰는데 줄무늬가 남는다(흐려지지 않았다)' }).toBeLessThan(SD_OFF);
  const after = await measureScreen(page);
  console.log('R4 after', JSON.stringify(after));
  expect(after.out.slice(0, 3), '블러가 상자 밖으로 번졌다').toEqual([255, 0, 0]);
  expect(after.edge[0] - after.edge[1], '안 가장자리에 빨강 바탕이 섞였다').toBeLessThan(EDGE_TINT_MAX);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R8 html2canvas 안전실패 — 양성대조(누출) → neutralize 뒤 회색 · 클론 src 없음 · 라이브 무변경', async ({ page }) => {
  await page.setViewportSize({ width: 800, height: 900 });
  const errs = await boot(page, MINI);
  const out = await page.evaluate(async ([W, H]) => {
    if (typeof window.html2canvas !== 'function') throw new Error('전제: html2canvas 가 없다');
    const live = document.getElementById('stage');
    const ab = document.getElementById('ab_r');
    window.__R.applyRedact(ab, 60);
    const mk = (tag) => {
      const c = live.cloneNode(true);
      c.id = 'stage_' + tag;
      c.querySelectorAll('[id]').forEach((e) => { e.id = e.id + '_' + tag; });
      /* id 를 바꾸면 #stage 규칙(크기·빨강 바탕)이 떨어진다 ⇒ 인라인으로 같은 값을 준다 */
      Object.assign(c.style, { position: 'absolute', left: '0px', top: '400px', width: W + 'px', height: H + 'px',
                               background: '#ff0000', overflow: 'hidden' });
      document.body.appendChild(c);
      return c;
    };
    const opt = { scale: 1, backgroundColor: null, logging: false };
    const a = mk('leak');
    const leak = window.__stats(await window.html2canvas(a, opt), W);
    a.remove();
    const b = mk('safe');
    window.__neutralize(b);
    const bImg = b.querySelector('img');
    const bAb = b.querySelector('.asset-block');
    const cloneInfo = { src: bImg.getAttribute('src'), vis: bImg.style.visibility, dsImgSrc: bAb.dataset.imgSrc ?? null };
    const safe = window.__stats(await window.html2canvas(b, opt), W);
    b.remove();
    const liveImg = document.getElementById('img_r');
    return { leak, safe, cloneInfo,
             liveSrcSame: liveImg.getAttribute('src') === window.__SRC, liveVis: liveImg.style.visibility,
             liveRedact: ab.getAttribute('data-redact'), liveClipBg: ab.querySelector('.asset-img-clip').style.backgroundColor };
  }, [STAGE_W, STAGE_H]);
  console.log('R8', JSON.stringify(out));
  expect(out.leak.sd, '양성대조: neutralize 없이 h2c 가 원본을 안 찍었다 ⇒ 이 자는 누출을 못 본다').toBeGreaterThan(LEAK_SD);
  expect(out.safe.sd, 'neutralize 뒤에도 줄무늬(원본)가 찍힌다').toBeLessThan(SD_OFF);
  expect(out.safe.mid.slice(0, 3), '덮개가 불투명 회색(기존 REDACT_OPAQUE_FILL)이 아니다').toEqual([74, 74, 74]);
  expect(out.cloneInfo.src, '클론 img 에 원본 src 가 남았다(단독 HTML 로 샌다)').toBe(null);
  expect(out.cloneInfo.vis).toBe('hidden');
  expect(out.liveSrcSame && out.liveVis === '' && out.liveRedact === '60' && out.liveClipBg === '', '라이브 DOM 이 바뀌었다').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ★2026-10-26 1012t1C1 이동 — 켜는 길이 «「블러」 고름(한 걸음) → 강도 끌기(한 걸음)» 두 제스처가 됐다.
   ⇒ 옛 「undo 1번이면 꺼짐」은 「undo 1번 = 끌기 전(기본 40) · 2번 = 꺼짐」으로 바뀐다(⛔약하게 한 것이 아니다 — 두 칸을 다 잰다). */
test('R5 저장 왕복 · undo 1번 = 끌기 전(기본값) · 2번 = 꺼짐', async ({ page }) => {
  const errs = await setupAsset(page);
  await page.evaluate(() => window.pushHistory?.('R5 끔 기준'));
  await openPanel(page);
  await page.evaluate(() => window.pushHistory?.('R5 기준'));
  await slide(page, 60);
  await expect.poll(async () => (await state(page)).attr).toBe('60');
  /* 왕복 — 저장 문자열로 캔버스를 갈아 끼운다 */
  const ser = await page.evaluate(() => {
    const html = window.getSerializedCanvas();
    document.getElementById('canvas').innerHTML = html;
    /* ★preserveHistory — 그냥 rebindAll 은 설계상 clearHistory 를 부른다(save-load.js «rebindAll» 머리말) ⇒ 뒤 undo 칸이 잴 것이 없다 */
    window.rebindAll?.({ preserveHistory: true });
    return { hasAttr: /data-redact="60"/.test(html), hasVar: /--redact-blur:\s*12px/.test(html) };
  });
  expect(ser.hasAttr, '저장 문자열에 data-redact 가 없다').toBe(true);
  expect(ser.hasVar, '저장 문자열에 --redact-blur 가 없다').toBe(true);
  await expect.poll(async () => (await state(page)).imgFilter).toContain('blur(12px)');
  const rt = await state(page);
  expect([rt.attr, rt.blurVar.trim()]).toEqual(['60', '12px']);
  /* undo 1번 — 끌기 «전»(고른 직후 기본값 40)으로 */
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await state(page)).attr, { message: 'undo 1번이 끌기 전(기본 40)으로 안 갔다' }).toBe('40');
  /* undo 2번 — 고르기 «전»(꺼짐)으로 */
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await state(page)).attr, { message: 'undo 2번에 블러가 안 꺼졌다' }).toBe(null);
  const u = await state(page);
  expect(u.hasImage, 'undo 가 그림까지 먹었다(두 걸음)').toBe(true);
  expect(u.blurVar).toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R6 이미지 교체 → 유지 · 이미지 제거 → 속성·변수 없음', async ({ page }) => {
  const errs = await setupAsset(page);
  await page.evaluate(() => window.applyImageRedact(document.getElementById(window.__AB), 60));
  await page.evaluate(() => window.setAssetImageFromSrc(document.getElementById(window.__AB), window.__SRC2));
  await page.waitForFunction(() => document.getElementById(window.__AB)?.querySelector('.asset-img')?.getAttribute('src') === window.__SRC2);
  const swapped = await state(page);
  expect([swapped.attr, swapped.blurVar.trim()], '교체 뒤 블러가 사라졌다').toEqual(['60', '12px']);
  expect(swapped.imgFilter, '새 그림이 안 흐리다(바닥 CSS)').toContain('blur(12px)');
  await page.evaluate(() => window.clearAssetImage(document.getElementById(window.__AB)));
  await expect.poll(async () => (await state(page)).hasImage).toBe(false);
  const cleared = await state(page);
  expect(cleared.attr, '제거 뒤 data-redact 가 남았다 — 다음 그림이 말없이 흐려진다').toBe(null);
  expect(cleared.blurVar).toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R7 스크래치 이동 — captureAssetFx 가 담고 setAssetImageWithFx 가 변수까지 되얹는다', async ({ page }) => {
  const errs = await setupAsset(page);
  const out = await page.evaluate(() => {
    const ab = document.getElementById(window.__AB);
    window.applyImageRedact(ab, 60);
    const fx = window.captureAssetFx(ab);
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block);
    const before = block.getAttribute('data-redact');
    window.setAssetImageWithFx(block, window.__SRC, fx);
    return { fxRedact: fx?.ds?.redact ?? null, before, attr: block.getAttribute('data-redact'),
             blurVar: block.style.getPropertyValue('--redact-blur').trim() };
  });
  expect(out.before, '전제: 새 에셋이 이미 켜져 있다').toBe(null);
  expect(out.fxRedact, 'captureAssetFx 가 블러를 안 담았다').toBe('60');
  expect(out.attr).toBe('60');
  expect(out.blurVar, '속성만 오고 변수가 빠졌다').toBe('12px');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R9 색보정 공존 — 그림 인라인 filter 에 url(#…) 와 blur 가 같이 산다(순서 둘 다)', async ({ page }) => {
  const errs = await setupAsset(page);
  const read = () => page.evaluate(() => {
    const ab = document.getElementById(window.__AB);
    const img = ab.querySelector('.asset-img');
    return { filter: img.style.filter || '', computed: getComputedStyle(img).filter || '' };
  });
  /* 순서 1: 색보정 → 블러 */
  await page.evaluate(() => {
    const ab = document.getElementById(window.__AB);
    window.applyImgColorAdjust(ab.querySelector('.asset-img'), { exposure: 0, contrast: 0, saturation: -100, temperature: 0, tint: 0, highlights: 0, shadows: 0 });
    window.applyImageRedact(ab, 60);
  });
  const a = await read();
  expect(a.filter, '색보정 필터가 사라졌다').toMatch(/^url\(/);
  expect(a.filter, '블러를 켰는데 색보정 인라인이 블러를 안 품는다').toContain('blur(12px)');
  expect(a.computed).toMatch(/url\(.*\).*blur\(12px\)/);
  /* 순서 2: 끄고 블러 → 색보정 */
  await page.evaluate(() => {
    const ab = document.getElementById(window.__AB);
    const img = ab.querySelector('.asset-img');
    window.applyImgColorAdjust(img, { exposure: 0, contrast: 0, saturation: 0, temperature: 0, tint: 0, highlights: 0, shadows: 0 });
    window.applyImageRedact(ab, 0);
    window.applyImageRedact(ab, 60);
    window.applyImgColorAdjust(img, { exposure: 0, contrast: 0, saturation: -100, temperature: 0, tint: 0, highlights: 0, shadows: 0 });
  });
  const b = await read();
  expect(b.filter, '색보정이 블러를 지웠다(프라이버시)').toMatch(/^url\(.*\) blur\(12px\)$/);
  expect(b.computed).toMatch(/url\(.*\).*blur\(12px\)/);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R10 Figma JSON — redact 실림 · 원본 src 가 JSON 어디에도 없다 (양성대조: 끄면 있다)', async ({ page }) => {
  const errs = await setupAsset(page);
  const build = () => page.evaluate(() => {
    window.flushCurrentPage?.();
    const s = JSON.stringify(window.buildFigmaExportJSON(null));
    const json = JSON.parse(s);
    const found = [];
    const walk = (o) => { if (!o || typeof o !== 'object') return; if (o.id === window.__AB) found.push(o); Object.values(o).forEach(walk); };
    walk(json);
    return { hasSrc: s.includes(window.__SRC), block: found[0] || null, n: found.length };
  });
  const off = await build();
  expect(off.n, '전제: 에셋 블럭이 JSON 에 없다').toBeGreaterThan(0);
  expect(off.hasSrc, '양성대조: 끈 상태에서 원본 src 가 JSON 에 없다 ⇒ 이 자는 누출을 못 본다').toBe(true);
  expect(off.block.redact ?? null).toBe(null);
  await page.evaluate(() => window.applyImageRedact(document.getElementById(window.__AB), 60));
  const on = await build();
  console.log('R10', JSON.stringify({ type: on.block?.type, redact: on.block?.redact, src: on.block?.src }));
  expect(on.hasSrc, '블러를 켰는데 원본 src 가 Figma JSON 에 실렸다').toBe(false);
  expect(on.block.redact).toEqual({ intensity: 60, blurPx: 12, cover: '#4a4a4a' });
  expect(on.block.src).toBe(null);
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── R11·R12: 캔버스 배율 >100% 누출 잠금 (이벨류에이터 프로브 c1zoom-probe 와 같은 자) ──────────────
 * 자리는 «그림 상자 요소 스크린샷»으로만 잡는다(화면 사각형을 숫자와 견주지 않는다).
 * 줄 = 높이 %의 가로 띠(5px · 가로 5~95% 구간) · 가장자리 세로 띠(5px · 세로 5~95% 구간). B 채널 sd.
 * 판정 = 켬 sd / 끔 sd < RATIO_MAX · 양성대조 = 모든 줄의 끔 sd ≥ MIN_OFF(바둑판이 그 줄에서 보인다). */
const ZOOM_ROWS = [2, 5, 25, 50, 75, 90, 95, 97, 98];
const ZOOM_COLS = [2, 5, 50, 95, 97, 98];
const RATIO_MAX = 0.1, MIN_OFF = 20;
async function setupChecker(page) {
  await page.setViewportSize({ width: 1700, height: 1200 });
  const errs = await bootApp(page);
  await page.evaluate(() => {
    const c = document.getElementById('canvas');
    c.querySelectorAll('.section-block').forEach((s) => s.remove());
    window.rebindAll?.(); window.deselectAll?.(); window.addSection();
    window.applyZoom?.(100);
    /* 바둑판 파랑/노랑 6px — 가로·세로 줄 모두 고대비 */
    const cv = document.createElement('canvas'); cv.width = 240; cv.height = 180;
    const x = cv.getContext('2d');
    for (let i = 0; i < 240; i += 6) for (let j = 0; j < 180; j += 6) { x.fillStyle = ((i + j) / 6) % 2 ? '#ffff00' : '#0000ff'; x.fillRect(i, j, 6, 6); }
    window.__SRC = cv.toDataURL('image/png');
    const { row, block } = window.makeAssetBlock();
    document.querySelector('.section-block .section-inner').appendChild(row);
    window.bindBlock?.(block); window.rebindAll?.();
    window.setAssetImageFromSrc(block, window.__SRC);
    block.style.width = '320px'; block.style.height = '240px'; block.style.borderRadius = '0px';
    window.__AB = block.id;
  });
  await page.waitForFunction(() => {
    const ab = document.getElementById(window.__AB);
    const img = ab && ab.querySelector('.asset-img-clip .asset-img');
    return !!(ab && ab.classList.contains('has-image') && img && img.complete && img.naturalWidth > 0);
  }, null, { timeout: 15000 });
  return errs;
}
async function zoomTo(page, z) {
  await page.evaluate((zz) => { window.deselectAll?.(); window.applyZoom(zz); }, z);
  /* 전제: 배율이 실제로 그 값이다(캔버스 스케일러 변환 행렬) */
  await page.waitForFunction((zz) => {
    const m = /matrix\(([^,]+)/.exec(getComputedStyle(document.getElementById('canvas-scaler')).transform);
    return !!m && Math.abs(parseFloat(m[1]) * 100 - zz) < 0.001;
  }, z, { timeout: 5000 });
  await page.evaluate(() => {
    document.getElementById(window.__AB).scrollIntoView({ block: 'center', inline: 'center' });
  });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
}
const clipSelOf = (id) => `[id="${id}"] > .asset-img-clip`;
async function lineSds(page, sel, shotPath) {
  const png = await page.locator(sel).screenshot(shotPath ? { path: shotPath } : {});
  return page.evaluate(async ([b64, rows, cols]) => {
    const im = new Image(); im.src = 'data:image/png;base64,' + b64; await im.decode();
    const W = im.naturalWidth, H = im.naturalHeight;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d'); ctx.drawImage(im, 0, 0);
    const sd = (d) => { const bs = []; for (let i = 0; i < d.length; i += 4) bs.push(d[i + 2]); const m = bs.reduce((a, v) => a + v, 0) / bs.length; return Math.round(Math.sqrt(bs.reduce((a, v) => a + (v - m) ** 2, 0) / bs.length) * 10) / 10; };
    const o = { w: W, h: H, line: {} };
    const x0 = Math.floor(W * 0.05), x1 = Math.ceil(W * 0.95), y0 = Math.floor(H * 0.05), y1 = Math.ceil(H * 0.95);
    /* 줄 하나가 아니라 5px 띠 — 한 줄이 바둑판 칸 «경계»에 걸리면 반쯤 섞인 단색이라 끔 sd 가 0 이 된다(첫 실측: row50·row90) */
    const BAND = 5, half = 2;
    for (const p of rows) { const y = Math.max(0, Math.min(H - BAND, Math.floor(H * p / 100) - half)); o.line['row' + p] = sd(ctx.getImageData(x0, y, x1 - x0, BAND).data); }
    for (const p of cols) { const xx = Math.max(0, Math.min(W - BAND, Math.floor(W * p / 100) - half)); o.line['col' + p] = sd(ctx.getImageData(xx, y0, BAND, y1 - y0).data); }
    return o;
  }, [png.toString('base64'), ZOOM_ROWS, ZOOM_COLS]);
}
const setRedact = async (page, v) => {
  await page.evaluate((vv) => window.applyImageRedact(document.getElementById(window.__AB), vv), v);
  /* 상태(속성)만 기다린다 — «어떻게 흐리나»(그림 filter·뒤 막)에 기대지 않아야 픽셀 판정이 방식과 무관한 자가 된다 */
  await page.waitForFunction((vv) => (document.getElementById(window.__AB).getAttribute('data-redact') || '0') === String(vv), v, { timeout: 5000 });
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
/** 켬/끔 비교 — 줄마다 { off, on, ratio } · 양성대조 위반 줄 · 누출 줄 */
function judge(off, on) {
  const rows = {}, weak = [], leak = [];
  for (const k of Object.keys(off.line)) {
    const ratio = Math.round(on.line[k] / Math.max(1, off.line[k]) * 1000) / 1000;
    rows[k] = { off: off.line[k], on: on.line[k], ratio };
    if (!(off.line[k] >= MIN_OFF)) weak.push(k);
    if (!(ratio < RATIO_MAX)) leak.push(`${k}=${ratio}`);
  }
  return { rows, weak, leak };
}

test('R11 캔버스 배율 150·200 — 모든 줄·가장자리 세로줄 켬/끔 sd 비 < 0.1 (양성대조: 끔 sd ≥ 20)', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await setupChecker(page);
  const id = await page.evaluate(() => window.__AB);
  for (const z of [150, 200]) {
    await zoomTo(page, z);
    await setRedact(page, 0);
    const off = await lineSds(page, clipSelOf(id));
    await setRedact(page, 60);
    const shot = (z === 200 && process.env.C1_SHOT_DIR) ? `${process.env.C1_SHOT_DIR}/C1-after2-zoom200.png` : null;
    const on = await lineSds(page, clipSelOf(id), shot);
    const j = judge(off, on);
    console.log(`R11 zoom ${z} · ${off.w}x${off.h} · ` + JSON.stringify(j.rows));
    expect(j.weak, `양성대조: 배율 ${z} 끔 상태에서 바둑판이 안 보이는 줄 — 이 자는 그 줄을 못 잰다`).toEqual([]);
    expect(j.leak, `배율 ${z} 에서 블러 켬인데 원본 무늬가 남는 줄(누출)`).toEqual([]);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('R12 배율 150 + 색보정 동시 — 블러가 살아남고 색보정도 걸린다 · undo 뒤 다시 합성', async ({ page }) => {
  test.setTimeout(120000);
  const errs = await setupChecker(page);
  const id = await page.evaluate(() => window.__AB);
  await zoomTo(page, 150);
  const ADJ = { exposure: 0, contrast: 0, saturation: -1, temperature: 0, tint: 0, highlights: 0, shadows: 0 };
  const ADJ2 = { ...ADJ, saturation: -0.5 };
  const filt = () => page.evaluate(() => {
    const ab = document.getElementById(window.__AB);
    const img = ab.querySelector(':scope > .asset-img-clip > :is(.asset-img, canvas)');
    return { inline: img.style.filter || '', computed: getComputedStyle(img).filter, sat: img.dataset.adjSaturation ?? null, redact: ab.getAttribute('data-redact') };
  });
  /* 색보정 먼저(끔 기준) */
  await page.evaluate((a) => { window.applyImgColorAdjust(document.getElementById(window.__AB).querySelector('.asset-img'), a); window.pushHistory?.('R12 색보정'); }, ADJ);
  const f0 = await filt();
  expect(f0.inline, '전제: 색보정이 안 걸렸다').toMatch(/^url\(/);
  const off = await lineSds(page, clipSelOf(id));
  /* 블러 켬 */
  await setRedact(page, 60);
  await page.evaluate(() => window.pushHistory?.('R12 블러'));
  const f1 = await filt();
  const on = await lineSds(page, clipSelOf(id));
  const j1 = judge(off, on);
  console.log('R12 on · ' + JSON.stringify(j1.rows) + ' · filter ' + f1.inline);
  /* 픽셀 먼저(행위) — 그 다음 문자열(원인) */
  expect(j1.weak, '양성대조: 색보정 상태(끔)에서 바둑판이 안 보이는 줄').toEqual([]);
  expect(j1.leak, '색보정과 같이 걸었더니 원본 무늬가 남는 줄(누출)').toEqual([]);
  expect(f1.inline, '인라인 filter 에 색보정·블러가 둘 다 있어야 한다').toMatch(/url\(.*\).*blur\(12px\)/);
  /* 색보정을 한 번 더 바꾸고(색보정 쓰기 길이 블러를 지우면 안 된다) */
  await page.evaluate((a) => { window.applyImgColorAdjust(document.getElementById(window.__AB).querySelector('.asset-img'), a); window.pushHistory?.('R12 색보정2'); }, ADJ2);
  const f2 = await filt();
  expect(f2.inline, '색보정을 다시 쓰자 블러가 지워졌다(프라이버시)').toMatch(/url\(.*\).*blur\(12px\)/);
  /* undo 1번 — 「블러」 표본으로. 복원(rebindAll → restoreImgColorAdjust)이 블러 몫을 다시 합성해야 한다 */
  await page.evaluate(() => window.undo());
  await expect.poll(async () => (await filt()).sat, { message: 'undo 가 색보정2 를 안 되돌렸다' }).toBe(f1.sat);
  const f3 = await filt();
  expect(f3.redact).toBe('60');
  expect(f3.inline, 'undo 뒤 인라인에 색보정·블러가 둘 다 있어야 한다').toMatch(/url\(.*\).*blur\(12px\)/);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const on2 = await lineSds(page, clipSelOf(id));
  const j2 = judge(off, on2);
  console.log('R12 after-undo · ' + JSON.stringify(j2.rows));
  expect(j2.leak, 'undo 뒤 원본 무늬가 남는 줄(누출)').toEqual([]);
  expect(errs, errs.join(' | ')).toEqual([]);
});
