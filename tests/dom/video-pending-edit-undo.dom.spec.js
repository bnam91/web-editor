/* video-pending-edit-undo.dom.spec.js — T-130 «미확정 영상(«GIF로 적용» 전)에 한 편집이
 * 되돌리기에 한 칸도 안 쌓여, ⌘Z 한 번이 영상을 통째로 지운다».
 *
 * ★기전 — T-012/T-031 이 video-pending 블럭을 «저장 대상»에서 뺐다. js/io/section-serialize.js
 *   serializeCleanRoot 가 그 블럭을 «빈 업로드대기»로 세척하고, 원본·트림·속도는 문자열이 아니라
 *   «그 sweep 전용 사이드카»에 담는다. ⇒ 미확정 영상에 한 편집은 스냅샷 «문자열»을 한 글자도
 *   안 바꾼다 ⇒ js/history.js 의 무변화 중복 차단이 「무변화」로 읽고 pushHistory 가 돌아나간다.
 *   ⇒ 편집이 안 쌓이고(①), 그 항목에 원본도 안 실린다(②) — 한 줄에서 둘이 같이 난다.
 *
 * ★고침 — 항목의 «정체»를 (canvas 문자열, 사이드카) «쌍»으로 본다(js/history.js _videoPendingKey).
 *   차단 «두 벌»(pushHistory · ensureHistoryCheckpoint)에 같은 잣대를 건다.
 *
 * ★실앱 실측(2026-09-22, 포트 9636 · 기준 dev 12865a1 · 진짜 mp4 · 진짜 드래그·클릭)
 *   고치기 «전» : 업로드+트림 드래그 2회 동안 꼭대기 {pos:2,len:3,seq:5} 에서 0칸.
 *                ⌘Z 한 번 → .asset-block 1개 → **0개**(블럭 통째로 소멸). ⌘⇧Z 해도 영상은 안 옴.
 *                썸네일 고정 → 0칸. ⌘Z → 블럭은 남고 «영상 내용물»이 사라짐(imgSrc null).
 *   고친 «뒤» : 드래그 2회 → 스택 3칸(시작표본 포함). ⌘Z 3연타 = 구간→구간→영상제거, 블럭 유지.
 *                썸네일 고정 → 1칸(seq 11→12). ⌘Z → data:video/mp4 복귀. ⌘⇧Z → 썸네일 복귀.
 *
 * ★진짜 js/globals.js + js/history.js + js/io/section-serialize.js 를 크로미움에 얹는다.
 *   (앱은 «안» 띄운다 — 고디터 인스턴스·MCP 9345 대역 무접촉.)
 *   getSerializedCanvas·rebindAll 은 js/io/save-load.js:459~471 · :888 과 «같은 모양»으로 합성한다
 *   (그 두 모듈은 에디터 전역이 통째로 필요해 못 얹는다 — 배선이 그 모양인지는
 *    tests/unit/video-pending-restore-wiring.test.js 가 따로 잠근다).
 *
 * ★★음성대조가 이 스펙의 핵심이다 — 「통과를 만들어 내는 검사」가 되지 않도록 «현재»
 *   js/history.js 소스에서 변형본을 «만들어» 돌린다(화석을 베껴 두지 않는다).
 *     N1 = 사이드카 비교를 두 차단에서 뺀 «고치기 전(dev)» 모양 ⇒ P1~P4 가 실제로 빨강이 된다
 *     N2 = 사이드카 읽기를 다시 차단 «아래»로 내린 모양(= 고칠 방향 ⑵만·⑴ 없음)
 *          ⇒ 「원본이 안 실린다」쪽만 빨강이 된다 — ⑴과 ⑵가 «둘 다» 필요하다는 증거
 *
 * ⛔그레인 «없는» 블럭으로 잰다 — 그레인이 붙으면 세척본과 비우기 출력에 차이가 하나 더 생겨
 *   이 결함이 «안 보인다»(T-130 카드 🛠 ⚠️).
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js video-pending-edit-undo
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8').replace(/\r\n/g, '\n');

const GLOBALS_JS = read('js/globals.js');
const HISTORY_JS = read('js/history.js');
const SERIALIZE_JS = read('js/io/section-serialize.js');

/* ── 음성대조본 ① — 사이드카를 «안 재던» dev 모양 ────────────────────────────
   두 차단에서 _videoPendingKey 비교만 걷는다. 다른 줄은 그대로다. */
/* ⛔«게으르게» 만든다 — 파일 최상단에서 던지면 고침을 되돌렸을 때 Playwright 가 수집
   단계에서 죽어 P 검사들이 «안 돌고», 로그가 「No tests found」로만 남는다. 그러면
   «빨개지는 것»과 «안 도는 것»을 못 가린다. 변형은 그 검사 «안»에서 만든다. */
const HISTORY_N1 = () => {
  let s = HISTORY_JS;
  const a = '      && _videoPendingKey(_top.videoPendingSidecar) === _videoPendingKey(_videoPendingSidecar)\n';
  if (!s.includes(a)) throw new Error('N1 변환이 늙었다 — pushHistory 의 사이드카 비교 줄을 못 찾았다');
  s = s.replace(a, '');
  const b = '\n      || _videoPendingKey(historyStack[historyPos]?.videoPendingSidecar) !== _videoPendingKey(_sidecar)';
  if (!s.includes(b)) throw new Error('N1 변환이 늙었다 — ensureHistoryCheckpoint 의 사이드카 비교 줄을 못 찾았다');
  s = s.replace(b, '');
  if (/&&\s*_videoPendingKey|\|\|\s*_videoPendingKey/.test(s)) {
    throw new Error('N1 변환본에 사이드카 비교가 남았다');
  }
  return s;
};

/* ── 음성대조본 ② — 사이드카 «읽기»만 차단 아래로 되돌린 모양 ───────────────
   = 「차단에 예외를 둔다(⑵)」는 했는데 「원본 붙이는 자리를 올린다(⑴)」는 안 한 판.
   ⚠️이 변형본에서는 pushHistory 의 비교가 _videoPendingSidecar 를 «선언 전»에 읽는다 —
     const 의 TDZ 로 던진다. 그래서 «조용한 절반 통과»가 아니라 시끄럽게 빨강이 된다.
     그것이 바로 ⑴ 없이 ⑵만으로는 성립하지 않는다는 증거다(P5 가 그 모양을 잰다). */
const HISTORY_N2 = () => {
  let s = HISTORY_JS;
  const decl = '  const _videoPendingSidecar = window.getLastVideoPendingSidecar?.();\n';
  if (!s.includes(decl)) throw new Error('N2 변환이 늙었다 — 사이드카 읽기 줄을 못 찾았다');
  s = s.replace(decl, '');
  const anchor = '  historyStack = historyStack.slice(0, historyPos + 1);\n  historyStack.push({ canvas: _canvas,';
  if (!s.includes(anchor)) throw new Error('N2 변환이 늙었다 — push 자리를 못 찾았다');
  s = s.replace(anchor, '  historyStack = historyStack.slice(0, historyPos + 1);\n' + decl + '  historyStack.push({ canvas: _canvas,');
  return s;
};

/* ═══ 하네스 ═══════════════════════════════════════════════════════════════
   getSerializedCanvas / rebindAll 은 js/io/save-load.js 의 «그 두 자리»와 같은 모양이다. */
const HARNESS_JS = `
import './globals.js';
import './history.js';

const canvas = () => document.getElementById('canvas');

/* js/io/save-load.js:459~471 getSerializedCanvas 와 같은 모양 — 클론에 serializeCleanRoot */
window.getSerializedCanvas = () => {
  const clone = canvas().cloneNode(true);
  window.serializeCleanRoot(clone);
  return clone.innerHTML;
};
/* js/io/save-load.js:888 rebindAll 과 같은 모양 — opts.videoPendingSidecar 를 그대로 넘긴다 */
window.__rebindCalls = [];
window.rebindAll = (opts) => {
  window.__rebindCalls.push(opts && opts.videoPendingSidecar ? Object.keys(opts.videoPendingSidecar) : null);
  window.reattachVideoPendingBlocks(canvas(), opts && opts.videoPendingSidecar);
};
window.deselectAll = () => { canvas().querySelectorAll('.selected').forEach(e => e.classList.remove('selected')); };
window.applyPageSettings = () => {};
window.buildLayerPanel = () => {};
window.scheduleAutoSave = () => {};
window.clearAssetImage = () => {};
window.bindBlock = () => {};
window.CANVAS_SEL_BLOCKS_AND_SHAPE = '.asset-block.selected';
window.syncSection = () => {};
window.highlightBlock = () => {};
window.setBlockAnchor = () => {};
window.openPanelForBlock = () => {};
window.showHandlesFor = () => {};

/* ── 미확정 영상 «편집 입구»들 — 진짜 입구와 «같은 모양» ─────────────────────
   ⛔진짜 asset-video-trim.js 는 <video> 의 duration 이 있어야 배선되는 패널 모듈이라
     여기 못 얹는다. 재는 것은 «이음매의 모양»이지 패널의 내용이 아니다. */
const AB = () => document.getElementById('ab1');

/* js/image-handling.js loadVideoToAsset — pushHistory 는 «비동기 읽기 전»(push-before),
   영상이 붙는 순간에는 «아무도 안 찍는다». 그 모양 그대로. */
window.__uploadVideo = (src) => {
  window.pushHistory();
  const ab = AB();
  ab.classList.add('has-image');
  ab.dataset.assetType = 'video-pending';
  ab.dataset.imgSrc = src;
  ab.dataset.fit = 'cover';
  ab.dataset.trimIn = '0';
  ab.dataset.trimOut = '3';
  ab.innerHTML = '<div class="asset-img-clip"><video class="asset-img asset-video" src="' + src + '" muted loop playsinline></video></div>'
    + '<button class="asset-overlay-clear" title="영상 제거">✕</button>'
    + '<div class="asset-overlay"></div>';
};
/* js/props/asset-video-trim.js:214~222 — 값을 바꾸고 «뒤»에 찍는다(push-after) */
window.__trim = (k, v) => { AB().dataset[k] = String(v); window.pushHistory('영상 트림 구간 조절'); };
/* ★진짜 트림 «드래그» 한 번의 모양 — js/drag-history.js arm() 이 onMove 첫 틱에 «시작 표본»을
   찍고(:205 beginDragHistory), onUp 이 «끝 표본»을 찍는다(:222). 양쪽 끝을 다 남기는 정본 규약. */
window.__trimDrag = (k, v) => { window.pushHistory('영상 트림 구간 조절'); window.__trim(k, v); };
/* 같은 파일 :252~259 — 속도도 push-after */
window.__speed = (v) => { AB().dataset.playbackRate = String(v); window.pushHistory('영상 재생속도 변경'); };
/* 같은 파일 :271~277 — 썸네일 고정은 «바꾸기 전»에 찍고(push-before) 에셋을 <img> 로 바꾼다 */
window.__markThumb = (pngSrc) => {
  window.pushHistory('영상 프레임 썸네일 고정');
  const ab = AB();
  delete ab.dataset.assetType;
  delete ab.dataset.trimIn;
  delete ab.dataset.trimOut;
  delete ab.dataset.playbackRate;
  ab.dataset.imgSrc = pngSrc;
  ab.innerHTML = '<div class="asset-img-clip"><img class="asset-img" src="' + pngSrc + '"></div>'
    + '<div class="asset-overlay"></div>';
};
/* 캔버스 «문자열»이 실제로 바뀌는 대조용 편집(영상과 무관) */
window.__renameText = (t) => { document.getElementById('tb1').textContent = t; window.pushHistory('텍스트 수정'); };

/* 관측치 — 영상은 문자열 «밖»에 산다. 그래서 문자열만 재면 안 된다. */
window.__obs = () => {
  const ab = AB();
  return {
    blocks: canvas().querySelectorAll('.asset-block').length,
    type: ab ? (ab.dataset.assetType || null) : null,
    srcHead: ab && ab.dataset.imgSrc ? ab.dataset.imgSrc.slice(0, 16) : null,
    trimIn: ab ? (ab.dataset.trimIn || null) : null,
    trimOut: ab ? (ab.dataset.trimOut || null) : null,
    rate: ab ? (ab.dataset.playbackRate || null) : null,
    video: ab ? !!ab.querySelector('video.asset-video') : null,
    img: ab ? !!ab.querySelector('img.asset-img') : null,
    tip: window.getHistoryTip(),
  };
};
/* ★시나리오 사이 초기화 — 캔버스를 «픽스처 원형»으로 되돌린 «뒤» clearHistory 한다.
   ⛔순서가 중요하다. DOM 을 안 되돌리고 clearHistory 만 하면 앞 시나리오가 남긴 영상이
     초기 스냅샷의 사이드카에 실려, 음성대조본에서도 ⌘Z 가 영상을 되살린다(=거짓 음성).
     실제로 그 함정에 한 번 걸렸다(2026-09-22). */
window.__PRISTINE = document.getElementById('canvas').innerHTML;
window.__reset = () => {
  document.getElementById('canvas').innerHTML = window.__PRISTINE;
  window.clearHistory();
};
window.__ready = true;
`;

/* ⛔에셋 오버레이에 id 를 달지 «마라» — serializeCleanRoot 는 오버레이를 innerHTML·style 만
   가지고 «다시 짓는다»(js/io/section-serialize.js:195~205). id 를 달면 세척본에서 그것만
   사라져 「영상을 넣어도 문자열이 그대로다」라는 이 카드의 전제가 깨진 것처럼 보인다.
   ⇒ 캔버스에 «보이는» 대조 편집은 세척이 안 건드리는 별도 텍스트 블럭으로 한다. */
const BODY = `<div id="canvas"><div class="section-block" id="sec1"><div class="section-inner">
  <div class="asset-block" id="ab1" data-align="center"><div class="asset-overlay"></div></div>
  <div class="text-block" id="tb1">원문</div>
</div></div></div>`;

const VID = 'data:video/mp4;base64,AAAAIGZ0eXBpc29tAAACAGlzb21pc28y';
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUg';

async function boot(page, variant = 'fix') {
  const H = variant === 'N1' ? HISTORY_N1() : variant === 'N2' ? HISTORY_N2() : HISTORY_JS;
  await page.route(`${ORIGIN}/**`, async (route) => {
    const u = new URL(route.request().url());
    const js = (body) => route.fulfill({ contentType: 'application/javascript', body });
    if (u.pathname === '/__harness.html') {
      return route.fulfill({
        contentType: 'text/html',
        /* index.html 과 같은 순서 — 플레인 스크립트(section-serialize) 먼저, 모듈 나중 */
        body: `<!doctype html><html><head><meta charset="utf-8">
          <script src="/section-serialize.js"></script>
          <script type="module" src="/__harness.js"></script>
          </head><body>${BODY}</body></html>`,
      });
    }
    if (u.pathname === '/__harness.js')        return js(HARNESS_JS);
    if (u.pathname === '/globals.js')          return js(GLOBALS_JS);
    if (u.pathname === '/history.js')          return js(H);
    if (u.pathname === '/section-serialize.js') return js(SERIALIZE_JS);
    return route.fulfill({ status: 404, body: '' });
  });
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

/* 브라우저 안에서 도는 시나리오들. */
const SCENARIO = ({ which, VID, PNG }) => {
  const reset = () => { window.__reset(); };
  const tip = () => window.getHistoryTip();

  if (which === 'P0') {
    /* ★전제 — 세척이 «정말로» 영상을 문자열에서 지우고 사이드카에 담는가.
       이게 거짓이면 아래 초록은 «빈 입력의 초록»이다. */
    reset();
    const before = window.getSerializedCanvas();
    window.__uploadVideo(VID);
    const after = window.getSerializedCanvas();
    const sc = window.getLastVideoPendingSidecar();
    return {
      sameString: before === after,
      hasVideoData: after.indexOf('data:video') !== -1,
      sidecarIds: Object.keys(sc || {}),
      sidecarSrcHead: sc && sc.ab1 ? sc.ab1.imgSrc.slice(0, 16) : null,
      live: window.__obs(),
    };
  }

  if (which === 'P1') {
    /* ★트림 — 편집이 «쌓이는가», 그리고 ⌘Z 가 «구간 한 칸»만 되돌리는가.
       ★앞에 «보이는 편집»을 하나 둔다 — 카드 ⑵ 의 모양을 그대로 만들기 위해서다:
         고치기 «전»에는 ⌘Z 가 트림 대신 «그 앞 편집»으로 건너뛰고, 그 항목엔 영상이 안 담겨 있어
         영상이 같이 사라진다. 앞 편집이 없으면 스택 바닥이라 undo 가 «아무 일도 안 해»
         음성대조가 「안 사라졌다」로 초록이 된다(거짓 음성). */
    reset();
    window.__renameText('앞 편집');
    window.__uploadVideo(VID);
    const afterUpload = tip();
    window.__trimDrag('trimIn', '0.5');
    const afterT1 = tip();
    window.__trimDrag('trimOut', '2.0');
    const afterT2 = tip();
    window.undo();
    const undo1 = window.__obs();
    window.undo();
    const undo2 = window.__obs();
    window.redo();
    const redo1 = window.__obs();
    return { afterUpload, afterT1, afterT2, undo1, undo2, redo1 };
  }

  if (which === 'P2') {
    /* ★속도 — 같은 경로(2026-09-21 시점에 «화면에서 안 쟀던» 축).
       ⚠️업로드 «직후» 바로 속도를 바꾸면 「영상은 있고 속도는 기본값」 표본이 한 번도 안 찍힌다 —
         그건 이 카드가 아니라 «삽입(push-before) → 패널(push-after)» 이음매다(P7 이 그 자리를 잰다).
         여기서는 실앱 실측과 같은 모양(앞에 보이는 편집이 하나 있는 판)으로 잰다. */
    reset();
    window.__uploadVideo(VID);
    window.__renameText('사이 편집');
    window.__speed(2);
    const afterS1 = tip();
    window.__speed(0.5);
    const afterS2 = tip();
    window.undo();
    const undo1 = window.__obs();
    window.undo();
    const undo2 = window.__obs();
    return { afterS1, afterS2, undo1, undo2 };
  }

  if (which === 'P3') {
    /* ★썸네일 고정 — 업로드와 썸네일 «사이»에 아무 편집도 없다(카드 🔎⑩①~③) */
    reset();
    window.__uploadVideo(VID);
    const afterUpload = tip();
    window.__markThumb(PNG);
    const afterMark = tip();
    window.undo();
    const undo1 = window.__obs();
    window.redo();
    const redo1 = window.__obs();
    return { afterUpload, afterMark, undo1, redo1 };
  }

  if (which === 'P4') {
    /* ★대조군(카드 🔎⑩④) — 업로드와 썸네일 «사이»에 캔버스에 보이는 편집을 하나 끼운다.
       ⛔이 걸음이 없으면 «고쳤다»와 «원래 되던 경우를 봤다»를 못 가린다. */
    reset();
    window.__uploadVideo(VID);
    window.__renameText('사이 편집');
    const afterMid = tip();
    window.__markThumb(PNG);
    window.undo();
    return { afterMid, undo1: window.__obs() };
  }

  if (which === 'P5') {
    /* ★회귀 — 영상이 «없는» 판에서는 무변화 차단이 그대로 살아 있어야 한다
       (그 차단은 「⌘Z 를 눌렀는데 화면이 그대로인 먹통 한 칸」을 없애려고 넣은 것이다) */
    reset();
    const base = window.historyStack.length;
    window.pushHistory('a');           // 캔버스 무변화 — 안 쌓여야 한다
    const afterNoop1 = window.historyStack.length;
    window.__renameText('바뀜');     // 진짜 편집 — 쌓여야 한다
    const afterReal = window.historyStack.length;
    window.pushHistory('b');           // 같은 상태를 또 찍는다(after→before 이음매) — 안 쌓여야 한다
    const afterNoop2 = window.historyStack.length;
    return { base, afterNoop1, afterReal, afterNoop2 };
  }

  if (which === 'P6') {
    /* ★미확정 영상이 «있어도» 같은 상태를 두 번 찍으면 한 칸만 — 먹통 한 칸 방지 유지 */
    reset();
    window.__uploadVideo(VID);
    window.__trim('trimIn', '0.5');
    const a = window.historyStack.length;
    window.pushHistory('같은 상태 재촬영');   // 사이드카도 문자열도 그대로
    const b = window.historyStack.length;
    return { a, b };
  }

  if (which === 'P7') {
    /* ★이 카드 «밖»의 이음매를 알고 고정한다 — js/image-handling.js:614 loadVideoToAsset 은
       push-before 인데(비동기 읽기 «전»에 찍는다) 영상이 붙는 «뒤»를 아무도 안 찍는다.
       ⇒ 업로드 직후 첫 편집이 «드래그가 아닌» 패널 커밋(속도·썸네일)이면 「영상은 있고 값은
         기본값」 칸이 없다. 트림은 js/drag-history.js 가 시작 표본을 찍어 그 칸이 «있다».
       ⛔이 카드는 그 자리를 안 받는다(T-131 가족 · 카드 ⚠️「다른 영상 기능을 얹지 마라」).
         고쳐지는 날 이 검사가 빨강이 된다 — 그때 이 주석부터 읽어라. */
    reset();
    window.__uploadVideo(VID);
    const afterUpload = window.historyStack.length;
    window.__speed(2);
    const afterSpeed = window.historyStack.length;
    window.undo();
    const undo1 = window.__obs();
    /* 대조 — 트림은 시작 표본이 있어 같은 자리에서 «영상이 남는다» */
    reset();
    window.__uploadVideo(VID);
    window.pushHistory('영상 트림 구간 조절');       // js/drag-history.js arm() 의 시작 표본
    window.__trim('trimIn', '0.5');
    window.undo();
    const dragUndo1 = window.__obs();
    return { afterUpload, afterSpeed, undo1, dragUndo1 };
  }

  return { unknown: which };
};

const run = (page, which) => page.evaluate(SCENARIO, { which, VID, PNG });

test('P0 ★전제 — 세척이 영상을 «문자열 밖»으로 옮긴다(아래 초록이 빈 입력의 초록이 아니다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P0');
  expect(r.live.video, '★픽스처에 <video> 가 안 붙었다 — 시나리오 자체가 죽었다').toBe(true);
  expect(r.live.type, '★video-pending 상태가 아니다').toBe('video-pending');
  expect(r.sameString, '★영상을 넣었는데 직렬화 문자열이 «달라졌다» — 이 카드의 전제가 깨졌다(세척이 안 돈다)').toBe(true);
  expect(r.hasVideoData, '★스냅샷 문자열에 원본이 실렸다 — T-012 회귀').toBe(false);
  expect(r.sidecarIds, '★사이드카가 그 블럭을 안 담았다').toEqual(['ab1']);
  expect(r.sidecarSrcHead).toBe(VID.slice(0, 16));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P1 ★트림 — 편집이 «한 칸씩» 쌓이고, ⌘Z 한 번이 구간만 되돌린다(영상은 남는다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P1');
  expect(r.afterT1.len, '★트림 편집이 한 칸도 안 쌓였다 — T-130 본체').toBeGreaterThan(r.afterUpload.len);
  expect(r.afterT2.len, '★두 번째 트림도 안 쌓였다').toBeGreaterThan(r.afterT1.len);
  /* ⌘Z 한 번 = 마지막 트림만 되돌린다 */
  expect(r.undo1.blocks, '★⌘Z 한 번에 에셋 블럭이 사라졌다 — 사용자가 만든 것을 잃는다').toBe(1);
  expect(r.undo1.video, '★⌘Z 한 번에 영상이 사라졌다').toBe(true);
  expect(r.undo1.trimOut, '★되돌아온 구간이 직전 값이 아니다').toBe('3');
  expect(r.undo1.trimIn, '★⌘Z 한 번이 «두 칸»을 먹었다(trimIn 까지 되돌아갔다)').toBe('0.5');
  /* 한 번 더 = 그 앞 트림 */
  expect(r.undo2.video, '★두 번째 ⌘Z 에서 영상이 사라졌다').toBe(true);
  expect(r.undo2.trimIn, '★두 번째 ⌘Z 가 첫 트림을 안 되돌렸다').toBe('0');
  /* ⌘⇧Z 로 돌아온다 */
  expect(r.redo1.trimIn, '★⌘⇧Z 가 트림을 안 되살렸다').toBe('0.5');
  expect(r.redo1.video, '★⌘⇧Z 뒤 영상이 없다 — 되살릴 표본이 없었다는 뜻').toBe(true);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P2 ★속도 — 같은 한 수로 같이 닫힌다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P2');
  expect(r.afterS2.len, '★속도 변경이 안 쌓였다').toBeGreaterThan(r.afterS1.len);
  expect(r.undo1.rate, '★⌘Z 가 속도를 직전 값으로 안 되돌렸다').toBe('2');
  expect(r.undo1.video, '★속도 ⌘Z 에 영상이 사라졌다').toBe(true);
  expect(r.undo2.rate, '★두 번째 ⌘Z 가 속도를 안 지웠다').toBe(null);
  expect(r.undo2.video, '★두 번째 ⌘Z 에 영상이 사라졌다').toBe(true);
  expect(r.undo2.srcHead, '★두 번째 ⌘Z 뒤 원본이 영상이 아니다').toBe(VID.slice(0, 16));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P3 ★썸네일 고정 — 사이에 아무 편집이 없어도 ⌘Z 가 «영상»을 되살린다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P3');
  expect(r.afterMark.len, '★썸네일 고정의 push-before 가 한 칸도 안 쌓였다').toBeGreaterThan(r.afterUpload.len);
  expect(r.undo1.blocks, '★블럭 자체가 사라졌다').toBe(1);
  expect(r.undo1.video, '★⌘Z 뒤 영상이 안 돌아왔다 — 블럭은 남고 «영상 내용물»이 사라지는 그 증상').toBe(true);
  expect(r.undo1.srcHead, '★되살아난 원본이 영상이 아니다').toBe(VID.slice(0, 16));
  expect(r.undo1.type).toBe('video-pending');
  expect(r.redo1.img, '★⌘⇧Z 가 썸네일(이미지)로 안 돌아왔다').toBe(true);
  expect(r.redo1.srcHead).toBe(PNG.slice(0, 16));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P4 ★대조군 — 사이에 «보이는 편집»을 끼운 경우도 여전히 정상(사이드카 장치가 살아 있다)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P4');
  expect(r.afterMid.len, '★대조군 전제 — 보이는 편집은 원래 쌓인다').toBeGreaterThan(1);
  expect(r.undo1.video, '★대조군이 깨졌다 — 원래 되던 경로를 이 수정이 죽였다').toBe(true);
  expect(r.undo1.srcHead).toBe(VID.slice(0, 16));
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P5 ★회귀 — 영상이 없는 판의 무변화 중복 차단은 그대로다(먹통 한 칸 방지 유지)', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P5');
  expect(r.afterNoop1, '★캔버스 무변화인데 칸이 생겼다 — 먹통 한 칸 재발').toBe(r.base);
  expect(r.afterReal, '★진짜 편집이 안 쌓였다').toBe(r.base + 1);
  expect(r.afterNoop2, '★같은 상태를 두 번 찍었는데 칸이 둘 생겼다 — 먹통 한 칸 재발').toBe(r.afterReal);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P6 ★회귀 — 미확정 영상이 있어도 «같은 상태 재촬영»은 한 칸만 남긴다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P6');
  expect(r.b, '★사이드카가 같은데도 칸이 하나 더 생겼다 — 먹통 한 칸').toBe(r.a);
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('P7 ★알고 남긴 자리 — 업로드 «직후» 첫 편집이 드래그가 아니면 「영상은 있고 값은 기본값」 칸이 없다', async ({ page }) => {
  const errs = await boot(page);
  const r = await run(page, 'P7');
  /* 이 카드의 고침으로 «속도 한 칸»은 생긴다 */
  expect(r.afterSpeed, '★속도 편집이 안 쌓였다 — T-130 본체가 깨졌다').toBe(r.afterUpload + 1);
  /* ⛔그런데 그 한 칸의 «앞»이 곧장 업로드 전이다 — js/image-handling.js:614 loadVideoToAsset 이
     push-before 인데 영상이 붙는 «뒤»를 아무도 안 찍기 때문이다(T-131 가족 이음매).
     ⇒ 업로드 직후 바로 속도를 바꾸고 ⌘Z 하면 속도가 아니라 «업로드»가 되돌아간다.
     ★이 카드는 그 자리를 안 받는다. 고쳐지는 날 이 줄이 빨강이 된다 — 그때 이 주석부터 읽어라. */
  expect(r.undo1.video, '★남은 이음매가 닫혔다 — 이 검사와 위 주석을 같이 고쳐라').toBe(false);
  /* ★대조 — 같은 자리라도 «드래그»는 시작 표본이 있어 영상이 남는다(js/drag-history.js) */
  expect(r.dragUndo1.video, '★드래그 시작 표본이 있는 경로에서도 영상이 사라졌다 — T-130 본체').toBe(true);
  expect(r.dragUndo1.trimIn, '★드래그 ⌘Z 가 구간을 직전 값으로 안 되돌렸다').toBe('0');
  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

/* ═══ 음성대조 ═══════════════════════════════════════════════════════════ */

test('N1 ★음성대조 — 사이드카 비교를 빼면 P1·P2·P3 가 «실제로» 빨강이 된다', async ({ page }) => {
  const errs = await boot(page, 'N1');
  const p0 = await run(page, 'P0');
  expect(p0.sameString, '★N1 전제 — 세척은 변형본에서도 그대로여야 한다').toBe(true);

  const p1 = await run(page, 'P1');
  expect(p1.afterT1.len, '★N1 인데 트림이 쌓였다 — 변형이 늙었거나 고침이 다른 자리에 있다').toBe(p1.afterUpload.len);
  /* ★실앱에서는 여기서 «에셋 블럭 자체»가 사라졌다(그 세션에서 블럭을 방금 넣었기 때문).
     이 하네스는 블럭이 픽스처에 원래 있어 «영상만» 사라진다 — 잃는 것은 같다. */
  expect(p1.undo1.video, '★N1 재현 — ⌘Z 한 번에 영상이 사라져야 한다(dev 실측)').toBe(false);
  expect(p1.undo1.srcHead, '★N1 재현 — 빈 에셋이 되어야 한다').toBe(null);

  const p2 = await run(page, 'P2');
  expect(p2.afterS2.len, '★N1 인데 속도가 쌓였다').toBe(p2.afterS1.len);

  const p3 = await run(page, 'P3');
  expect(p3.afterMark.len, '★N1 인데 썸네일 push-before 가 쌓였다').toBe(p3.afterUpload.len);
  expect(p3.undo1.video, '★N1 재현 — 썸네일 뒤 ⌘Z 는 영상을 못 되살려야 한다').toBe(false);
  expect(p3.undo1.srcHead, '★N1 재현 — 빈 에셋이 되어야 한다').toBe(null);

  /* 대조군은 N1 에서도 «돈다» — 그래서 P4 하나만으로는 고침을 증명 못 한다 */
  const p4 = await run(page, 'P4');
  expect(p4.undo1.video, '★N1 에서도 대조군은 돌아야 한다(이 축은 원래 되던 경로다)').toBe(true);

  expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
});

test('N2 ★음성대조 — 사이드카 읽기를 차단 «아래»로 되돌리면 성립하지 않는다(⑴ 과 ⑵ 가 둘 다 필요하다)', async ({ page }) => {
  const errs = await boot(page, 'N2');
  /* 변형본은 «선언 전 참조»가 되어 pushHistory 가 던진다 — 조용히 절반만 통과하지 않는다.
     ⛔이 검사는 「던진다」를 재는 것이 아니라 「⑵ 만으로는 못 세운다」를 재는 것이다. */
  const broke = await page.evaluate(() => {
    try { window.clearHistory(); window.__uploadVideo('data:video/mp4;base64,AAAA'); return null; }
    catch (e) { return String(e && e.name || e); }
  });
  expect(broke, '★N2 변형본이 멀쩡히 돌았다 — 「원본 붙이는 자리를 차단 위로」가 이 고침에 필요 없다는 뜻이 된다. 변형을 다시 봐라').not.toBeNull();
  expect(errs.length, 'pageerror 는 여기서 예상 범위다').toBeGreaterThanOrEqual(0);
});
