/* scratch-drop-size.dom.spec.js — 「스크래치패드에서 보이던 크기 그대로 섹션에 들어가는가」.
 *   (현빈 신고 2026-09-20: 「스크래치패드에서 섹션에 들어갈때, 스크래치패드와 다른 크기로
 *    들어가는 이슈」)
 *
 * ★음성대조 (dev@20e50e3 실측, 고치기 «전»)
 *   스크래치 표시폭 220px → 들어간 asset-block 폭 796px(3.62배) · 높이 597px
 *   inline style 은 `align-self: center; height: 597px;` — width 가 «아예 안 박힌다».
 *   비율(440:330)은 지켜지고 절대 크기만 커진다 = 신고 문장과 정확히 일치.
 *
 * ★무엇을 재나
 *   S1 표시폭을 넘기면 그 폭·그 비율로 들어간다
 *   S2 ★음성대조 — 안 넘기면(자산패널 경로) 종전대로 풀폭이다 (회귀 가드)
 *   S3 표시폭이 콘텐츠폭 이상이면 풀블리드를 그대로 둔다
 *   S4 ★newsection 분기(캔버스 빈 곳 드롭)도 같다 — insert 만 고치면 red
 *
 * ⛔앱을 «안» 띄운다 — page.route 로 레포를 가짜 origin 에 얹어 «진짜 모듈»을 import 한다
 *   (modal-variant.dom.spec.js 와 같은 부팅). 고디터 인스턴스·MCP 대역 무접촉.
 * ⚠️⚠️tests/dom 은 `npm test` 스위트에 «안» 들어간다. 변이 책임은
 *   tests/unit/scratch-drop-size.test.js 가 진다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js scratch-drop-size
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const PX = 'data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7';

/* 실앱 골격: #canvas-wrap > #canvas-scaler > (#canvas > .section-block > .section-inner)
   + .scratch-item 은 «#canvas-scaler 의 형제 자식» — 그래서 #canvas 와 같은 px 공간이다. */
const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css"><link rel="stylesheet" href="/css/editor-layout.css">
<style>#canvas-scaler{position:relative;width:860px;min-height:900px;}#canvas{width:860px;}
.section-block{position:relative;background:#fff;}
.section-inner{padding-left:32px;padding-right:32px;min-height:400px;display:block;}</style></head><body>
<div id="canvas-wrap"><div id="canvas-scaler">
  <div id="canvas"><div class="section-block" id="sec"><div class="section-inner" id="inner" data-padding-x="32"></div></div></div>
  <div class="scratch-item" id="sp" style="position:absolute;left:900px;top:0;width:220px;">
    <img src="${PX}" style="display:block;width:100%;height:auto;"></div>
</div></div>
<script type="module">
  import { commitScratchDropAt } from '/js/canvas-scratch-drop.js';
  window.__commit = commitScratchDropAt;
  window.state = { pageSettings: { padX: 32 } };
  window.makeAssetBlock = () => {
    const row=document.createElement('div'); row.className='row'; row.dataset.layout='stack'; row.id='row_t';
    const ab=document.createElement('div'); ab.className='asset-block'; ab.id='ab_t';
    ab.dataset.align='center'; ab.dataset.overlay='false'; ab.style.alignSelf='center';
    ab.innerHTML='<div class="asset-overlay"></div>'; row.appendChild(ab); return {row,block:ab};
  };
  window.setAssetImageFromSrc = (ab,src)=>{ ab.classList.add('has-image'); ab.dataset.imgSrc=src;
    ab.innerHTML='<div class="asset-img-clip"><img class="asset-img" src="'+src+'" style="width:100%;height:100%;object-fit:cover"></div>'; };
  window.bindBlock=()=>{}; window.buildLayerPanel=()=>{}; window.triggerAutoSave=()=>{};
  window.applyPadXToSection=(inner,px)=>{ inner.style.paddingLeft=px?px+'px':''; inner.style.paddingRight=px?px+'px':''; };
  /* newsection 분기 스텁 — 실앱의 addSection/addAssetBlock 과 «같은 순서»로 만든다.
     ★addAssetBlock 은 block-factory.applyExcludePadX 로 calc(100%+2·padX)+음수마진을 «먼저» 박는다.
       그 뒤에 폭이 덮이는지가 이 스텁이 재현해야 할 핵심이다. */
  window.addSection = () => {
    const sec=document.createElement('div'); sec.className='section-block'; sec.id='sec2';
    const inner=document.createElement('div'); inner.className='section-inner'; inner.dataset.paddingX='32';
    sec.appendChild(inner); document.getElementById('canvas').appendChild(sec);
  };
  window.selectSection = ()=>{};
  window.addAssetBlock = () => {
    const sec=document.getElementById('sec2'); const inner=sec.querySelector('.section-inner');
    const row=document.createElement('div'); row.className='row'; row.dataset.layout='stack';
    const ab=document.createElement('div'); ab.className='asset-block'; ab.id='ab_n';
    ab.dataset.align='center'; ab.style.alignSelf='center';
    ab.style.marginLeft='-32px'; ab.style.marginRight='-32px'; ab.style.width='calc(100% + 64px)';
    row.appendChild(ab); inner.appendChild(row);
  };
  window.getDragAfterElement=()=>null;
  window.__ready=true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
}

/** 섹션 안에 «먼저 블록 하나를 둬서» insert 경로로 떨어지게 한 뒤 커밋한다. */
const dropIntoSection = (page, opts) => page.evaluate(({ opts, PX }) => {
  const inner = document.getElementById('inner');
  const seed = document.createElement('div');
  seed.className = 'row'; seed.dataset.layout = 'stack';
  seed.style.height = '100px'; seed.style.background = '#eee';
  inner.appendChild(seed);
  const sr = seed.getBoundingClientRect();
  const ok = window.__commit(sr.left + sr.width / 2, sr.top + sr.height / 2, PX,
    Object.assign({ naturalWidth: 440, naturalHeight: 330 }, opts));
  const ab = document.getElementById('ab_t');
  const r = ab ? ab.getBoundingClientRect() : null;
  return {
    committed: ok,
    scratchW: +document.getElementById('sp').getBoundingClientRect().width.toFixed(1),
    w: r ? +r.width.toFixed(1) : null,
    h: r ? +r.height.toFixed(1) : null,
    inline: ab ? ab.getAttribute('style') : null,
    usePadx: ab ? ab.dataset.usePadx : null,
    contentW: +inner.getBoundingClientRect().width.toFixed(1),
  };
}, { opts, PX });

test.describe('스크래치 → 섹션 드롭 크기', () => {
  test.beforeEach(async ({ page }) => { await boot(page); });

  test('S1 표시폭 220 을 넘기면 220×165 로 들어간다 (음성대조 796×597)', async ({ page }) => {
    const m = await dropIntoSection(page, { width: 220 });
    expect(m.committed).toBe(true);
    expect(m.scratchW, '하네스 전제 — 스크래치 표시폭').toBe(220);
    expect(m.w, `들어간 폭 ${m.w} (inline: ${m.inline})`).toBeCloseTo(220, 0);
    // 비율은 스크래치에서 보이던 그대로: 220 × 330/440 = 165
    expect(m.h, `들어간 높이 ${m.h}`).toBeCloseTo(165, 0);
    expect(m.usePadx, 'usePadx 표식을 안 찍었다 — 우측패널이 화면과 다른 말을 한다').toBe('false');
  });

  test('S2 ★음성대조: width 미전달(자산패널 경로)은 종전대로 풀폭', async ({ page }) => {
    const m = await dropIntoSection(page, {});
    expect(m.committed).toBe(true);
    // 콘텐츠폭 860 − padX 2×32 = 796 (리터럴이 아니라 «재서» 비교한다)
    expect(m.w, `폭 ${m.w} / 콘텐츠폭 ${m.contentW}`).toBeCloseTo(m.contentW - 64, 0);
    expect(m.inline, 'width 가 박혔다 — 옵트인 계약이 깨졌다').not.toContain('width:');
  });

  test('S3 표시폭이 콘텐츠폭 이상이면 풀블리드를 그대로 둔다', async ({ page }) => {
    const m = await dropIntoSection(page, { width: 860 });
    expect(m.w).toBeCloseTo(m.contentW - 64, 0);
    expect(m.inline, '풀폭 이상인데 px 폭을 박았다').not.toContain('width:');
  });

  test('S4 ★newsection 분기(캔버스 빈 곳 드롭)도 220 — insert 만 고치면 red', async ({ page }) => {
    const m = await page.evaluate(({ PX }) => {
      // 섹션 «밖» = #canvas-scaler 안이지만 어떤 섹션에도 안 닿는 좌표
      const scaler = document.getElementById('canvas-scaler');
      const sec = document.getElementById('sec');
      const sr = sec.getBoundingClientRect();
      const ok = window.__commit(sr.left + 10, sr.bottom + 40, PX,
        { naturalWidth: 440, naturalHeight: 330, width: 220 });
      const ab = document.getElementById('ab_n');
      const r = ab ? ab.getBoundingClientRect() : null;
      return { committed: ok, w: r ? +r.width.toFixed(1) : null, h: r ? +r.height.toFixed(1) : null,
               inline: ab ? ab.getAttribute('style') : null, scalerW: scaler.clientWidth };
    }, { PX });
    expect(m.committed, `newsection 으로 안 떨어졌다 (inline: ${m.inline})`).toBe(true);
    expect(m.w, `들어간 폭 ${m.w} (inline: ${m.inline})`).toBeCloseTo(220, 0);
    expect(m.h, `들어간 높이 ${m.h}`).toBeCloseTo(165, 0);
    expect(m.inline, 'addAssetBlock 이 박은 풀블리드 음수마진이 안 풀렸다').not.toContain('-32px');
  });
});
