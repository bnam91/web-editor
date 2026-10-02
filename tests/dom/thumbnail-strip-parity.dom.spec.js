/* thumbnail-strip-parity.dom.spec.js — 썸네일 클론이 «내보내기 클론과 같은 명부»로 걷는다
 *
 * ★최종통합 QA(2026-09-21, medium): 「저장할 때 편집 중이던 상태가 프로젝트 목록 썸네일에
 *   그대로 박힌다(주석·체크리스트·선택 테두리·「내용을 입력하세요」)」.
 *   js/io/save-load.js captureThumbnail 은 클론에서 ⑴.section-label ⑵.section-toolbar
 *   ⑶루트의 .selected «셋»만 걷었다. 내보내기 클론(js/io/export-image.js prepareCloneForCapture)이
 *   걷는 나머지는 하나도 안 걷었다.
 *   실측(EXPORT-D, 픽셀): [thumb] 주석(자홍) 200px · 편집전용프록시(하늘) 100px 이 찍혔다.
 *
 * 고침 = 명부를 «한 벌»로(js/io/capture-safety.js stripEditorOnlyForCapture) 모으고
 *   두 경로가 그 한 벌을 쓴다. 두 벌로 두면 한쪽만 늙는다 — 실제로 그랬다.
 *
 * 여기서 재는 것:
 *   T1 편집 chrome 전수 — 걷힌 뒤 클론에 한 건도 안 남는다(카테고리별로).
 *   T2 ★콘텐츠는 안 걷는다 — 진짜 글자·이미지·도형은 그대로(과잉 삭제 방지).
 *   T3 ★라이브 캔버스 불변 — 클론만 바뀐다.
 *   T1-pre ★음성대조 — 옛 썸네일 4줄로 걷으면 전부 그대로 남는다.
 *   T4 ★SSOT — 두 호출부가 «같은 함수»를 부른다(소스 대조). 한쪽이 자기 명부로 돌아가면 빨강.
 *
 * ⛔앱을 «안» 띄운다 — capture-safety.js 만 크로미움에 얹는다.
 * 실행: npm run test:dom -- thumbnail-strip-parity
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 편집 중인 섹션 — 걷어야 할 것과 남아야 할 것을 «둘 다» 담는다. */
const SEC_HTML = `
<div class="section-block selected sec-bg-editing" id="sec1">
  <div class="section-label">Section 01</div>
  <div class="section-toolbar"><button>⋯</button></div>
  <div class="variation-badge">A</div>
  <div class="sec-bg-proxy"></div>
  <div class="section-inner">
    <div class="row row-active">
      <div class="text-block selected" id="tb"><div class="tb-body">진짜 글자</div></div>
    </div>
    <div class="row">
      <div class="text-block"><div class="tb-body" data-is-placeholder="true">내용을 입력하세요</div></div>
    </div>
    <div class="row"><div class="qa-block">QA 체크리스트</div></div>
    <div class="row col-active">
      <div class="asset-block img-editing" id="ab">
        <div class="img-edit-hint">드래그로 위치 조정</div>
        <div class="img-boundary"></div>
        <img class="asset-img" alt="진짜 이미지">
      </div>
    </div>
    <div class="annotation-block">펜 주석</div>
    <div class="annot-preview"></div>
    <div class="frame-block" style="transform:rotate(5deg)">
      <div class="shape-block shape-redact" id="shp" data-shape-type="rectangle"></div>
    </div>
    <div class="shape-block" id="shpPick" data-shape-fill="image"></div>
    <div class="shape-block" id="shpImg" data-shape-fill="image" data-shape-image="x.png"></div>
  </div>
</div>`;

const HARNESS = `<!doctype html><html><head><meta charset="utf-8"></head><body>
<div id="canvas">${SEC_HTML}</div>
<script type="module">
  import { stripEditorOnlyForCapture } from '/js/io/capture-safety.js';
  window.__strip = stripEditorOnlyForCapture;
  /* 옛 썸네일 4줄 그대로 — js/io/save-load.js captureThumbnail 의 고치기 «전» 모양 */
  window.__stripOld = (clone) => {
    clone.querySelector?.('.section-label')?.remove();
    clone.querySelector?.('.section-toolbar')?.remove();
    clone.classList.remove('selected');
  };
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const probe = (page, which) => page.evaluate((w) => {
  const sec = document.getElementById('sec1');
  const clone = sec.cloneNode(true);
  document.body.appendChild(clone);
  (w === 'old' ? window.__stripOld : window.__strip)(clone);
  const has = (s) => !!clone.querySelector(s);
  const out = {
    // ── 걷혀야 할 것 ──
    label: has('.section-label'),
    toolbar: has('.section-toolbar'),
    variation: has('.variation-badge'),
    annotation: has('.annotation-block'),
    annotPreview: has('.annot-preview'),
    qaBlock: has('.qa-block'),
    qaRowGone: clone.querySelectorAll('.row').length,
    bgProxy: has('.sec-bg-proxy'),
    imgHint: has('.img-edit-hint'),
    imgBoundary: has('.img-boundary'),
    rootSelected: clone.classList.contains('selected'),
    rootBgEditing: clone.classList.contains('sec-bg-editing'),
    childSelected: has('.text-block.selected'),
    imgEditing: has('.img-editing'),
    rowActive: has('.row-active'),
    colActive: has('.col-active'),
    placeholderVisible: clone.querySelector('[data-is-placeholder="true"]')?.style.visibility || '',
    pickerAttr: clone.querySelector('#shpPick')?.getAttribute('data-shape-fill') || null,
    // ── 남아야 할 것(콘텐츠) ──
    realText: clone.querySelector('#tb .tb-body')?.textContent || '',
    realImg: has('.asset-img'),
    realShapeImg: clone.querySelector('#shpImg')?.getAttribute('data-shape-fill') || null,
    placeholderStillThere: has('[data-is-placeholder="true"]'),
    // ── 프라이버시: 인라인 transform 조상의 z-index 끌어올림 ──
    frameZ: clone.querySelector('.frame-block')?.style.zIndex || '',
    // ── 라이브 캔버스 불변 ──
    liveLabel: !!sec.querySelector('.section-label'),
    liveSelected: sec.classList.contains('selected'),
    liveAnnotation: !!sec.querySelector('.annotation-block'),
  };
  clone.remove();
  return out;
}, which);

test('T1 ★편집 chrome 전수 — 걷힌 뒤 클론에 한 건도 안 남는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new');
  console.log('  T1-head:', r);
  expect({
    label: r.label, toolbar: r.toolbar, variation: r.variation,
    annotation: r.annotation, annotPreview: r.annotPreview, qaBlock: r.qaBlock,
    bgProxy: r.bgProxy, imgHint: r.imgHint, imgBoundary: r.imgBoundary,
    rootSelected: r.rootSelected, rootBgEditing: r.rootBgEditing,
    childSelected: r.childSelected, imgEditing: r.imgEditing,
    rowActive: r.rowActive, colActive: r.colActive,
  }).toEqual({
    label: false, toolbar: false, variation: false,
    annotation: false, annotPreview: false, qaBlock: false,
    bgProxy: false, imgHint: false, imgBoundary: false,
    rootSelected: false, rootBgEditing: false,
    childSelected: false, imgEditing: false,
    rowActive: false, colActive: false,
  });
  expect(r.placeholderVisible, '미입력 안내문구는 «숨기»되 높이는 남긴다').toBe('hidden');
  expect(r.qaRowGone, 'QA 블록은 감싸는 .row 까지 지워 세로 공간도 없앤다(4줄 → 3줄)').toBe(3);
  expect(r.pickerAttr, '이미지 없는 도형의 «바둑판» 표시는 편집 전용이라 뗀다').toBe(null);
  expect(r.frameZ, '가림막 도형의 인라인 transform 조상은 z-index 3 으로 끌어올린다(프라이버시)').toBe('3');
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T2 ★콘텐츠는 안 걷는다 — 과잉 삭제 방지', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new');
  expect(r.realText, '진짜 글자가 사라지면 썸네일이 빈 그림이 된다').toBe('진짜 글자');
  expect(r.realImg).toBe(true);
  expect(r.realShapeImg, '이미지가 «실제로» 들어간 도형의 data-shape-fill 은 그대로').toBe('image');
  expect(r.placeholderStillThere, 'placeholder 는 지우지 않는다(높이 collapse 금지) — 숨길 뿐').toBe(true);
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T3 ★라이브 캔버스는 안 건드린다 — 클론만 바뀐다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'new');
  expect({ liveLabel: r.liveLabel, liveSelected: r.liveSelected, liveAnnotation: r.liveAnnotation })
    .toEqual({ liveLabel: true, liveSelected: true, liveAnnotation: true });
  expect(errs, errs.join(' | ')).toEqual([]);
});

test('T1-pre ★음성대조 — 옛 썸네일 4줄로 걷으면 전부 그대로 남는다', async ({ page }) => {
  const errs = await boot(page);
  const r = await probe(page, 'old');
  console.log('  T1-pre:', r);
  expect(r.annotation, '★옛 꼴에서도 안 남으면 이 검사는 아무것도 안 보고 있다').toBe(true);
  expect(r.qaBlock).toBe(true);
  expect(r.childSelected).toBe(true);
  expect(r.imgEditing).toBe(true);
  expect(r.rowActive).toBe(true);
  expect(r.bgProxy).toBe(true);
  expect(r.imgHint).toBe(true);
  expect(r.placeholderVisible, '옛 꼴에선 「내용을 입력하세요」가 그대로 보였다').toBe('');
  expect(errs, errs.join(' | ')).toEqual([]);
});

/* ── T4 SSOT — 두 클론이 같은 명부를 쓴다(소스 대조) ────────────────────────────
   한쪽이 자기 목록으로 돌아가면 여기서 빨강. 「두 벌로 두면 한쪽만 늙는다」가 이 결함의 뿌리였다. */
test('T4 ★썸네일·내보내기 두 경로가 «같은 함수»를 부른다', () => {
  const saveLoad = fs.readFileSync(path.join(REPO, 'js/io/save-load.js'), 'utf8');
  const exportImg = fs.readFileSync(path.join(REPO, 'js/io/export-image.js'), 'utf8');
  const safety = fs.readFileSync(path.join(REPO, 'js/io/capture-safety.js'), 'utf8');

  expect(safety).toMatch(/export function stripEditorOnlyForCapture\(/);

  const thumb = saveLoad.slice(saveLoad.indexOf('async function captureThumbnail'),
                               saveLoad.indexOf('/* ── 프로젝트 파일 저장'));
  expect(thumb, '썸네일이 공용 명부를 안 부른다').toMatch(/stripEditorOnlyForCapture\(clone\)/);
  const prep = exportImg.slice(exportImg.indexOf('export async function prepareCloneForCapture'),
                               exportImg.indexOf('document.body.appendChild(clone);'));
  expect(prep, '내보내기가 공용 명부를 안 부른다').toMatch(/stripEditorOnlyForCapture\(clone\)/);

  // ★자기 명부로 «되돌아간» 자리를 잡는다 — 걷기 목록이 다시 두 벌이 되는 것이 이 결함의 재발이다.
  expect(thumb, '썸네일이 자기 명부(.annotation-block 나열)로 되돌아갔다').not.toMatch(/annotation-block/);
  expect(prep, '내보내기가 자기 명부(.annotation-block 나열)로 되돌아갔다').not.toMatch(/annotation-block/);
});
