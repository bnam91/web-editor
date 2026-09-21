/* export-width-scale-down.dom.spec.js — 「780px 내보내기는 «잘라내지 말고 줄인다»」(현빈 결정 2026-09-21).
 *
 * ★결정 원문
 *   「780되게끔 줄이는 걸로」 — 큰 그림을 폭에 맞춰 «축소»해 전부 보이게. 세로도 비율대로.
 *
 * ★고치기 전의 기전 (= 이 스펙이 «음성대조»로 먼저 확인한 빨강)
 *   내보내기는 섹션을 복제하고 «클론의 폭만» 바꾼다(js/io/export-image.js prepareCloneForCapture).
 *   그래서 폭이 상대값인 블록은 780 으로 따라 줄지만, 높이는 applyAspectSync·패널이 박아 둔
 *   «절대 px» 그대로다 ⇒ 상자 비율이 그림 비율보다 좁아져 `.asset-img{object-fit:cover}` 가
 *   좌우를 깎는다(860→780 이면 (860−780)/2 = 40px 씩, 폭 표현을 고친 뒤에도 픽셀은 그대로였다).
 *   ⇒ 「블록이 상자 밖으로 나갔나」(레이아웃 축)와 「그림 내용이 남았나」(픽셀 축)는 다른 축이고,
 *     tests/dom/scratch-drop-export-width.dom.spec.js 는 앞의 축만 닫았다(그 파일 X7 기록).
 *
 * ★이 스펙이 재는 것 — «픽셀 축»
 *   상자 비율(w/h)이 화면과 같으면 cover 가 깎는 비율도 같다 ⇒ 「화면과 같은 그림, 크기만 작게」.
 *   그래서 ⑴잘림 0 ⑵상자 비율 = 화면 비율 ⑶cover 가 «새로» 깎는 양 0 을 폭 780·860·1000·640 에서 잰다.
 *   E1 860(등폭) — 아무 것도 안 바뀐다(기존 내보내기 회귀 방지)
 *   E2 ★780 — 두 경로(스크래치 드롭 · 패널 풀블리드) 다 비율 유지 + 새 잘림 0
 *   E3 ★임의폭 1000·640 — 같은 답(780 만 특별대우 아님)
 *   E4 음성대조 — 폭이 «안» 변하는 고정폭 그림(220px)은 높이도 «안» 변한다
 *   E5 ★두 경로가 «같은 답» — 스크래치와 패널 풀블리드의 축소배율이 일치
 *   E6 ★그리드 블럭의 이미지 줄(.grd-img)도 같은 답 — «상대폭 + 절대높이 + cover» 라는 기전이
 *      에셋과 «똑같은데» 첫 판(d0b7ed4)의 선택자가 .asset-block 하나뿐이라 이 축이 비어 있었다
 *      (2026-09-21 최종통합 QA high — 실앱 실측: 그리드 716x300/원본 860x540 의 세로 가시비율이
 *       화면 0.6673 → 780 0.7512 / 640 0.9633 / 1000 0.5582 로 갈렸다. 같은 실행의 에셋 3종은 일치).
 *
 * ⛔앱을 «안» 띄운다 — page.route 로 레포를 가짜 origin 에 얹고 js/io/export-image.js 의
 *   prepareCloneForCapture 를 «진짜로» 부른다(흉내가 아니다 — tests/dom/redact-frame-stacking-context
 *   와 같은 수법). 캔버스 줌 40% 도 재현한다(scale(0.4)): 배율에 속으면 안 되는 계산이다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js export-width-scale-down
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 1×1 투명 GIF — 자연 크기는 dataset 으로 «선언»하고 상자만 잰다(로딩 타이밍 무관). */
const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/* 화면(=캔버스 860) 기준 상자.
   · 스크래치 드롭 경로 : 440×330 그림, 풀블리드 → 860 × 645
   · 패널 풀블리드 경로 : 1200×800 그림, 풀블리드 → 860 × 573.33
   · 고정폭(음성대조)   : 440×330 그림, 220px   → 220 × 165 */
const NAT = { scratch: [440, 330], panel: [1200, 800], fixed: [440, 330] };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-layout.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<style>
  #canvas-scaler{position:relative;width:860px;transform:scale(0.4);transform-origin:0 0;}
  #canvas{width:860px;}
  .section-block{position:relative;background:#fff;}
  .section-inner{padding-left:32px;padding-right:32px;display:block;}
  .row{display:flex;}
</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler"><div id="canvas">
  <div class="section-block" id="sec">
    <div class="section-inner" id="inner" data-padding-x="32">
      <!-- ① 스크래치 드롭이 만든 꼴: calc(100% + 2·padX) + 음수마진 세트 + 절대 px 높이 -->
      <div class="row" data-layout="stack">
        <div class="asset-block has-image" id="ab_scratch" data-align="center" data-use-padx="true"
             style="width:calc(100% + 64px);margin-left:-32px;margin-right:-32px;align-self:center;height:645px;">
          <div class="asset-img-clip"><img class="asset-img" src="${PX}" style="object-fit:cover"></div>
        </div>
      </div>
      <!-- ② 패널 풀블리드가 만든 꼴: 같은 폭 관용구 + 절대 px 높이(prop-page.applyAssetFullBleed) -->
      <div class="row" data-layout="stack">
        <div class="asset-block has-image" id="ab_panel" data-align="center" data-use-padx="true"
             style="width:calc(100% + 64px);margin-left:-32px;margin-right:-32px;align-self:center;height:573.33px;">
          <div class="asset-img-clip"><img class="asset-img" src="${PX}" style="object-fit:cover"></div>
        </div>
      </div>
      <!-- ③ 그리드 블럭의 이미지 줄(js/blocks/grid-block.js _gridLineHtml): 상대폭(%) + 절대높이(px) + cover.
           ⛔에셋과 달리 «상자»가 아니라 img 자신이 그 꼴이다 — 같은 기전, 다른 자리. -->
      <div class="row" data-layout="stack">
        <div class="grid-block" id="gb_grid" data-type="grid" style="display:flex;gap:24px;">
          <div class="grd-col" style="flex:1;min-width:0;display:flex;flex-direction:column;">
            <img class="grd-img" id="grd_img" src="${PX}" draggable="false" data-r="0" data-c="0" data-line="0"
                 style="display:block;width:100%;height:300px;object-fit:cover;">
          </div>
        </div>
      </div>
      <!-- ④ 음성대조: 폭이 절대 px 라 내보내기 폭을 «안» 따라간다 -->
      <div class="row" data-layout="stack">
        <div class="asset-block has-image" id="ab_fixed" data-align="center" data-use-padx="false"
             style="width:220px;align-self:center;height:165px;">
          <div class="asset-img-clip"><img class="asset-img" src="${PX}" style="object-fit:cover"></div>
        </div>
      </div>
    </div>
  </div>
</div></div></div>
<script type="module">
  import { prepareCloneForCapture } from '/js/io/export-image.js';
  window.__prep = prepareCloneForCapture;
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/** 진짜 prepareCloneForCapture 로 폭 `w` 클론을 만들고 블록 세 개의 상자를 잰다.
 *  화면 쪽은 줌 40% 가 곱해져 있으므로 «비율»만 쓴다(rect.width/rect.height 는 배율이 약분된다). */
const capture = (page, w) => page.evaluate(async (w) => {
  const sec = document.getElementById('sec');
  const ids = ['ab_scratch', 'ab_panel', 'ab_fixed', 'grd_img'];
  const live = {};
  for (const id of ids) {
    const r = document.getElementById(id).getBoundingClientRect();
    live[id] = { aspect: r.width / r.height, relW: r.width / sec.getBoundingClientRect().width };
  }
  const clone = await window.__prep(sec, w, false);
  const secR = clone.getBoundingClientRect();
  const out = { exportSecW: +secR.width.toFixed(2), blocks: {} };
  for (const id of ids) {
    const el = clone.querySelector('#' + id);
    const r = el.getBoundingClientRect();
    out.blocks[id] = {
      w: +r.width.toFixed(2),
      h: +r.height.toFixed(2),
      inlineH: el.style.height,
      aspect: +(r.width / r.height).toFixed(4),
      liveAspect: +live[id].aspect.toFixed(4),
      relW: +(r.width / secR.width).toFixed(4),
      liveRelW: +live[id].relW.toFixed(4),
      cutLeft:  +Math.max(0, secR.left - r.left).toFixed(2),
      cutRight: +Math.max(0, r.right - secR.right).toFixed(2),
    };
  }
  clone.remove();
  return out;
}, w);

/** object-fit:cover 가 «남겨 주는» 원본 비율 (1 이면 그 축은 한 톨도 안 깎인다). */
function visibleFrac(boxW, boxH, nw, nh) {
  const box = boxW / boxH, img = nw / nh;
  return { x: +Math.min(1, box / img).toFixed(4), y: +Math.min(1, img / box).toFixed(4) };
}

test.describe('780px 내보내기 — 자르지 말고 줄인다 (현빈 결정 2026-09-21)', () => {
  test('E1 860(등폭) — 내보내기가 상자를 한 톨도 안 건드린다 (기존 산출물 회귀 방지)', async ({ page }) => {
    const errs = await boot(page);
    const r = await capture(page, 860);
    expect(errs, `모듈 로드 중 에러: ${errs.join(' | ')}`).toEqual([]);
    expect(r.exportSecW).toBe(860);
    expect(r.blocks.ab_scratch.h, '860 인데 스크래치 블록 높이가 바뀌었다').toBeCloseTo(645, 1);
    expect(r.blocks.ab_panel.h,   '860 인데 패널 블록 높이가 바뀌었다').toBeCloseTo(573.33, 1);
    expect(r.blocks.ab_fixed.h,   '860 인데 고정폭 블록 높이가 바뀌었다').toBeCloseTo(165, 1);
  });

  test('E2 ★780 — 두 경로 다 «비율 유지 + 새 잘림 0» (고치기 전: cover 가 좌우 40px 씩 깎음)', async ({ page }) => {
    await boot(page);
    const r = await capture(page, 780);
    expect(r.exportSecW, '하네스 전제 — 내보내기 폭').toBe(780);
    for (const id of ['ab_scratch', 'ab_panel']) {
      const b = r.blocks[id];
      // ⑴ 레이아웃 축 — 섹션 상자 밖으로 안 나간다
      expect(b.cutLeft,  `${id} 좌측 ${b.cutLeft}px 잘림`).toBe(0);
      expect(b.cutRight, `${id} 우측 ${b.cutRight}px 잘림`).toBe(0);
      // ⑵ 비율 축 — 상자 비율이 화면과 같다(= 세로도 비율대로 줄었다)
      expect(b.aspect, `${id} 상자비율 ${b.aspect} ≠ 화면 ${b.liveAspect} — 세로가 안 따라갔다 (inline: ${b.inlineH})`)
        .toBeCloseTo(b.liveAspect, 2);
      // ⑶ 픽셀 축 — cover 가 «새로» 깎는 양이 0 (화면과 같은 그림)
      const [nw, nh] = id === 'ab_panel' ? [1200, 800] : [440, 330];
      const vis = visibleFrac(b.w, b.h, nw, nh);
      expect(vis.x, `${id} cover 가 가로를 ${(100 - vis.x * 100).toFixed(1)}% 깎는다`).toBeCloseTo(1, 2);
      expect(vis.y, `${id} cover 가 세로를 ${(100 - vis.y * 100).toFixed(1)}% 깎는다`).toBeCloseTo(1, 2);
    }
    // 폭은 780 을 «꽉» 채운다(풀블리드 뜻 유지)
    expect(r.blocks.ab_scratch.w).toBeCloseTo(780, 0);
    expect(r.blocks.ab_panel.w).toBeCloseTo(780, 0);
    // 세로는 비율대로 — 645 × 780/860 = 585, 573.33 × 780/860 = 520
    expect(r.blocks.ab_scratch.h, '세로가 비율대로 안 줄었다').toBeCloseTo(585, 0);
    expect(r.blocks.ab_panel.h,   '세로가 비율대로 안 줄었다').toBeCloseTo(520, 0);
  });

  test('E3 ★임의폭(1000·640)도 같은 답 — 780 만 특별대우가 아니다', async ({ page }) => {
    await boot(page);
    for (const [w, expScratch, expPanel] of [[1000, 645 * 1000 / 860, 573.33 * 1000 / 860],
                                             [640,  645 * 640 / 860,  573.33 * 640 / 860]]) {
      const r = await capture(page, w);
      expect(r.exportSecW).toBe(w);
      for (const id of ['ab_scratch', 'ab_panel']) {
        const b = r.blocks[id];
        expect(b.cutLeft,  `${w}px — ${id} 좌측 잘림`).toBe(0);
        expect(b.cutRight, `${w}px — ${id} 우측 잘림`).toBe(0);
        expect(b.aspect, `${w}px — ${id} 상자비율 ${b.aspect} ≠ 화면 ${b.liveAspect}`).toBeCloseTo(b.liveAspect, 2);
      }
      expect(r.blocks.ab_scratch.h, `${w}px 스크래치 높이`).toBeCloseTo(expScratch, 0);
      expect(r.blocks.ab_panel.h,   `${w}px 패널 높이`).toBeCloseTo(expPanel, 0);
    }
  });

  test('E4 음성대조 — 폭이 «안» 변하는 고정폭(220px) 그림은 높이도 «안» 변한다', async ({ page }) => {
    await boot(page);
    for (const w of [780, 1000, 640]) {
      const b = (await capture(page, w)).blocks.ab_fixed;
      expect(b.w, `${w}px — 고정폭이 따라 움직였다`).toBeCloseTo(220, 0);
      expect(b.h, `${w}px — 폭이 그대로인데 높이가 ${b.h} 로 바뀌었다`).toBeCloseTo(165, 0);
    }
  });

  test('E5 ★스크래치 경로와 패널 풀블리드 경로가 «같은 답»을 낸다 (앞 QA 가 갈린다고 실측한 자리)', async ({ page }) => {
    await boot(page);
    for (const w of [780, 1000, 640]) {
      const r = await capture(page, w);
      const s = r.blocks.ab_scratch, p = r.blocks.ab_panel;
      expect(s.w, `${w}px — 두 경로의 폭이 다르다`).toBeCloseTo(p.w, 1);
      // «축소배율»(화면 대비)이 두 경로에서 같아야 한다
      const kS = s.h / 645, kP = p.h / 573.33;
      expect(kS, `${w}px — 스크래치 배율 ${kS.toFixed(4)} vs 패널 배율 ${kP.toFixed(4)}`).toBeCloseTo(kP, 3);
      expect(kS, `${w}px — 배율이 폭 비율(${(w / 860).toFixed(4)})과 다르다`).toBeCloseTo(w / 860, 3);
    }
  });
});

/* ══════════════════════════════════════════════════════════════════════════════
   E6 — 그리드 블럭의 «이미지 줄»(.grd-img)  [2026-09-21 최종통합 QA high]
   에셋 블럭과 기전이 «똑같다»: 폭은 상대값(width:N%)이라 내보내기 폭을 따라 줄고,
   높이는 절대 px 로 잠겨 있고(js/blocks/grid-block.js _gridLineHtml `height:${h}px`),
   그림은 object-fit:cover 다. 그런데 첫 판의 선택자가 `.asset-block` 하나뿐이라
   이 줄만 «화면과 다른 그림»이 됐다.
   ⛔에셋과 다른 점 하나 — 여기선 «상자»가 아니라 img 자신이 그 꼴이고 id 가 없다
     (짝짓기는 자리번호로 간다). 그래서 별개의 검사가 필요하다.
   ══════════════════════════════════════════════════════════════════════════ */
test('E6 ★그리드 이미지 줄도 «자르지 말고 줄인다» — 에셋과 같은 답', async ({ page }) => {
  const errs = await boot(page);
  // ⑴ 등폭(860)은 한 톨도 안 바뀐다
  const r860 = await capture(page, 860);
  expect(r860.blocks.grd_img.h, '860 인데 그리드 이미지 높이가 바뀌었다').toBeCloseTo(300, 1);

  for (const w of [780, 1000, 640]) {
    const r = await capture(page, w);
    const g = r.blocks.grd_img;
    /* ⑵ 폭은 내보내기 폭을 따라간다(전제) — 안 따라가면 이 검사가 아무것도 안 본다.
       ★«상대폭»이 아니라 «실폭»으로 잰다 — 섹션 좌우 패딩(32px)은 절대값이라 폭이 줄어도
         안 줄어든다. 그래서 비(比)는 0.9256 → 0.9179 로 달라지는 게 정상이다. */
    expect(g.w, `${w}px — 그리드 이미지 폭이 내보내기 폭을 안 따라간다`).toBeCloseTo(w - 64, 0);
    // ⑶ 상자 비율이 화면과 같다 = 세로가 비율대로 따라갔다 (고치기 전: 300px 고정)
    expect(g.aspect, `${w}px — 그리드 상자비율 ${g.aspect} ≠ 화면 ${g.liveAspect} (inline: ${g.inlineH})`)
      .toBeCloseTo(g.liveAspect, 2);
    // ⑷ 픽셀 축 — cover 가 «새로» 깎는 양 0 (원본 860×540 기준: 실앱 실측과 같은 그림)
    const vis = visibleFrac(g.w, g.h, 860, 540);
    const liveVis = visibleFrac(r860.blocks.grd_img.w, r860.blocks.grd_img.h, 860, 540);
    expect(vis.y, `${w}px — 세로 가시비율 ${vis.y} ≠ 화면 ${liveVis.y} (그림이 화면과 다르게 잘린다)`)
      .toBeCloseTo(liveVis.y, 2);
    expect(vis.x, `${w}px — 가로 가시비율 ${vis.x} ≠ 화면 ${liveVis.x}`).toBeCloseTo(liveVis.x, 2);
    // ⑸ 수치로도 못박는다 — 화면 796×300 ⇒ 세로 = 300 × (내보내기폭−64)/796
    expect(g.h, `${w}px — 그리드 높이가 비율대로 안 줄었다`).toBeCloseTo(300 * (w - 64) / 796, 0);
  }
  expect(errs, errs.join(' | ')).toEqual([]);
});
