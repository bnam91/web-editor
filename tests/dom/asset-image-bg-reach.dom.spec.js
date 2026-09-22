/* asset-image-bg-reach.dom.spec.js — T-011 「이미지를 넣은 에셋 블럭은 그라데이션에 «닿을» 수 없다」.
 *
 * ★무엇이 병인가 (2026-09-22 실측)
 *   - 이미지 «없는» 에셋 블럭: 우측 패널에 「배경색」 줄 + 「초기화」 버튼이 있다 → 그라데이션 정상.
 *   - 이미지를 «넣으면»: js/props/prop-asset.js 의 imageSection 이 hasImage 갈래(:105)로 갈라지고,
 *     「배경색」 줄(:126~127)과 「초기화」(:133)는 «else 갈래에만» 있다. 배선도 마찬가지 —
 *     wireColorField('asset-bg')·asset-bg-clear 리스너가 :582 의 else 안에 있다(:584, :601).
 *     ⇒ 이미지를 넣는 순간 배경색/그라데이션으로 가는 «문»이 통째로 사라진다.
 *   - 그런데 js/image-handling.js clearAssetImage(:770~)는 dataset.bgColor 를 «안» 지운다.
 *     ⇒ 이미 걸어 둔 그라데이션은 data-bgColor 에 남고 화면에도 계속 칠해지는데,
 *       그걸 «고칠 문»도 «지울 버튼»도 없다 = 막다른 골목.
 *
 * ⚠️★함정 — 「그라데이션이 안 먹는다」가 «아니다». 먹는다. 칠해진다.
 *   안 되는 건 «닿는 길»이다. 그래서 이 스펙은 «그리는 쪽»을 재지 않는다 —
 *   오히려 P3 은 「칠해지고 있음」을 양성대조로 «초록»으로 박아 두고, 그 옆에서
 *   「패널이 그 사실을 한 마디도 안 한다」를 «빨강»으로 잡는다.
 *
 * ★재는 방식 = «존재»가 아니라 «행위»
 *   id 를 못박으면 고치는 사람이 다른 id 를 쓰는 순간 검사가 거짓 빨강이 된다.
 *   그래서 P1·P2 는 「패널에서 «배경»이라 적힌 절을 찾아 → 그 안의 스와치를 «눌러» →
 *   진짜 컬러피커 그라데이션 탭을 «눌러» → 블럭의 data-bgColor 가 바뀌는가」로 잰다.
 *   선택자에 안 묶이고, DOM 0×0 유령도 자동으로 걸러진다(0×0 은 애초에 못 누른다).
 *   ⛔그래도 rect 는 따로 잰다 — 「있다」로 세지 않기 위해서.
 *
 * ★하네스가 «직접 만든» 상태로 재지 않는다
 *   - 블럭 = js/block-factory.js 의 makeAssetBlock() (실제 블럭 추가 경로가 쓰는 그 함수, :876/:888)
 *   - 이미지 = js/image-handling.js 의 setAssetImageFromSrc() (실제 업로드·스크래치 경로가 수렴하는 자리)
 *     ⛔classList.add('has-image') 를 하네스에서 직접 하지 않는다 — 그러면 실제 경로에서만 나는 결함을 놓친다.
 *   - 그라데이션 = 진짜 컬러피커 팝오버의 「그라데이션」 탭 클릭 (color-picker.js:85 «누르면 바로 적용»)
 *   - 패널 = prop-asset.js 의 showAssetProperties() 원문
 *
 * ★빨강의 «이유»를 두 쪽에서 확인했다 (2026-09-22, dev 1972a80)
 *   ㉠ dev 원문        : P1·P2·P3 «빨강» / P4·P5 «초록»  — 회귀 대조가 초록이므로
 *      「하네스가 못 찾는다」가 아니다. 같은 계측기로 이미지 «없는» 쪽은 배경 절을 찾고,
 *      스와치를 누르고, 그라데이션을 걸고, 초기화까지 왕복한다.
 *   ㉡ 음성대조(결함만 제거한 prop-asset.js 사본을 같은 하네스에 먹임): 5/5 «초록».
 *      ⇒ 빨강은 「닿는 길이 없다」를 가리킨다. (재현: 하네스 라우트에서 /js/props/prop-asset.js 만
 *        배경색 줄·초기화를 hasImage 갈래에도 넣은 사본으로 바꿔치기하면 된다.)
 *   ★이 음성대조가 실제로 «무의미한 빨강» 하나를 잡아냈다 — P2 의 초기화 버튼 탐색이
 *     /제거/ 로 훑는 바람에 같은 절의 「이미지 제거」를 눌렀고, 고친 뒤에도 빨강이 났다.
 *     지금은 이름·id 로 이미지/영상 버튼을 «먼저 배제»하고, «무엇을 눌렀는지»도 같이 못박는다.
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(asset-panel-min-scale.dom.spec.js 와 같은 부팅).
 * 실행: npm run test:dom -- asset-image-bg-reach
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

/* 1×1 투명 PNG — 「이미지가 들어간 상태」를 만들기 위한 최소 자료.
   ⛔파일 선택창은 열지 않는다. 실제 경로(setAssetImageFromSrc)는 dataURL 을 그대로 받는다. */
const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==';

/* 영상 «미리보기»(video-pending) 상태를 만들기 위한 최소 자료 — tests/fixtures/tiny-video.webm.
   ⛔검사가 ffmpeg 로 만들어 쓰지 않는다: 도구 의존성이 들어가면 그 도구가 없는 기계에서 검사가 죽는다.
     610바이트 VP8/WebM 을 «파일로 두고 읽는다». ★WebM 인 이유 — Playwright 번들 크로미움에는
     H.264 가 없어 mp4 는 loadedmetadata 가 안 뜬다(실앱 Electron 은 뜬다). 검사는 어디서나 같아야 한다. */
const WEBM = 'data:video/webm;base64,'
  + fs.readFileSync(path.join(REPO, 'tests', 'fixtures', 'tiny-video.webm')).toString('base64');

/* 사용자가 고른 «자기 색» — 기본값(#a0a0a0)과 구별돼야 「이게 내 값이다」를 증명할 수 있다. */
const USER_HEX = 'FF3B30';
const USER_RGB = 'rgb(255, 59, 48)';

/* ★io:true 일 때만 저장/복원 쪽(section-serialize.js + save-load.js)을 같이 얹는다.
   ⛔기본값은 false — P1~P5 의 기준선(「지금 dev 에서 3빨강/2초록」)이 «그때 잰 그 판»과
     한 바이트도 달라지지 않아야 한다. 모듈을 하나 더 얹으면 그 수가 무엇의 수인지 흐려진다. */
const IO_SCRIPTS = `
<script src="/js/io/section-serialize.js"></script>`;
const harnessHTML = ({ io = false } = {}) => `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/color-picker.css">
<style>
  body{margin:0;background:#1b1b1b}
  /* 실앱의 우측 패널 폭(240px)을 그대로 준다 — 폭이 없으면 필드가 0 으로 짜부라져
     「닿는 길이 없다」와 「좁아서 안 보인다」가 섞인다(T-100 선례). */
  #panel-right{position:fixed;right:0;top:0;width:240px;height:100%;overflow:auto;background:#252525}
  #panel-right .panel-body{padding:8px}
</style></head><body>
<div id="canvas-wrap"><div id="canvas">
  <div class="section-block"><div class="section-inner" id="host" style="width:860px;"></div></div>
</div></div>
<div id="panel-right"><div class="panel-body"></div></div>
${io ? IO_SCRIPTS : ''}
<script type="module">
  /* 실앱이 전역으로 주는 것들 — 여기서 재는 것과 무관한 배선만 얇게 세운다. */
  window.__hist = 0;
  window.pushHistory = () => { window.__hist++; };
  window.bindBlock = () => {};
  window.scheduleAutoSave = () => {};
  window.getBlockBreadcrumb = () => 'Section > Row';
  window.getEffectiveUsePadx = (ab) => ab.dataset.usePadx === 'true';

  const bf = await import('/js/block-factory.js');   // makeAssetBlock — «실제» 블럭 생성
  await import('/js/image-handling.js');             // setAssetImageFromSrc / clearAssetImage — «실제» 이미지 경로
  const pa = await import('/js/props/prop-asset.js');
  await import('/js/props/color-picker.js');         // 팝오버(그라데이션 탭) 원문

  window.__mk = () => {
    const host = document.getElementById('host');
    host.innerHTML = '';
    const { row, block } = bf.makeAssetBlock();   // ⛔하네스가 div 를 짓지 않는다
    block.style.width = '400px';
    block.style.height = '300px';
    host.appendChild(row);
    window.__ab = block;
    return block;
  };
  window.__open = (ab) => pa.showAssetProperties(ab);

  if (${io}) {
    /* ⛔저장/복원을 하네스가 «흉내내지» 않는다 — 실제 함수를 그대로 부른다.
       저장 = save-load.js getSerializedCanvas()(:480, 세척은 serializeCleanRoot 단일 진실원)
       복원 = canvasEl.innerHTML 재대입 + save-load.js rebindAll()(:857)
              ★rebindAll 주석이 스스로 「undo/redo·페이지전환·프로젝트 로드·협업패치가
                canvasEl.innerHTML 을 새로 앉힌 뒤 공통으로 거치는 단일 지점」이라 적는다. */
    /* ★rebindAll 이 부르는 «섹션 배선» 다섯 자리만 대역을 세운다.
       이들은 js/editor.js 에 있는데, editor.js 는 index.html 의 전체 DOM 을 전제해서
       (실측: 「Cannot read properties of null (reading 'style')」) 이 하네스에선 못 얹는다.
       ⛔대신 rebindAll «자체»는 원문 그대로 돌린다 — 이 카드가 걸린 자리
         (.asset-block.has-image > .asset-img 클립 마이그레이션 · aspect-ratio 잠금 ·
          .asset-overlay 정리)는 전부 rebindAll 본문 안이고, 대역은 그 바깥이다.
       ★무엇을 대역으로 세웠는지 기록해 두고, 검사가 그 목록을 다시 못박는다
         — 「대역이 조용히 늘어나 진짜 결함을 삼키는」 길을 막는다. */
    window.__stubbed = ['migrateColsFromDOM', 'bindSectionDelete', 'bindSectionOrder', 'bindSectionDropZone', 'bindSectionDrag'];
    window.__stubCalls = [];
    window.__stubbed.forEach(n => { window[n] = (...a) => { window.__stubCalls.push(n); }; });
    await import('/js/io/save-load.js');
    window.__save = () => window.getSerializedCanvas();
    window.__load = (html) => {
      const canvas = document.getElementById('canvas');
      canvas.innerHTML = html;
      window.rebindAll();
      return canvas.querySelector('.asset-block');
    };
  }
  window.__ready = true;
</script></body></html>`;

async function boot(page, { io = false } = {}) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: harnessHTML({ io }) });
    const file = path.join(REPO, url.pathname);
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.setViewportSize({ width: 1400, height: 900 });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true, null, { timeout: 20000 });
  return errs;
}

/* ── 계측기 ───────────────────────────────────────────────────────────────
   ⛔「요소가 있다」로 세지 않는다. 전부 rect(px)·innerText 로 잰다. */

/** 패널이 «열리긴 했는가» — 빨강의 이유가 「패널이 통째로 안 그려짐」이 아님을 먼저 못박는다. */
const panelAlive = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  const sl = document.getElementById('asset-w-slider');
  const r = sl ? sl.getBoundingClientRect() : null;
  return {
    sections: body ? body.querySelectorAll('.prop-section').length : 0,
    textLen: body ? body.innerText.trim().length : 0,
    widthSlider: r ? { w: Math.round(r.width), h: Math.round(r.height) } : null,
  };
});

/** 패널에서 «배경»이라 적힌 절을 찾아, 그 안의 색 스와치와 «초기화류» 버튼을 rect 로 재서 돌려준다.
 *  선택자(#asset-bg-*)를 못박지 않는다 — 고친 쪽이 다른 id 를 써도 같은 뜻이면 통과해야 한다. */
const bgReach = (page) => page.evaluate(() => {
  const body = document.querySelector('#panel-right .panel-body');
  if (!body) return { section: false };
  const secs = [...body.querySelectorAll('.prop-section')];
  const sec = secs.find(s => /배경|그라데이션|gradient/i.test(s.innerText));
  if (!sec) return { section: false, panelText: body.innerText.replace(/\s*\n+\s*/g, ' | ') };
  const box = (el) => { const r = el.getBoundingClientRect(); return { w: Math.round(r.width), h: Math.round(r.height) }; };
  const swatch = sec.querySelector('.prop-color-swatch');
  /* 「배경을 되돌리는」 버튼 — 배경 절 «안»에서만 찾는다.
     ⛔★«이미지 제거»를 집으면 안 된다. 음성대조(패치본)에서 실제로 그랬다:
       /제거/ 하나로 훑었더니 같은 절의 「이미지 제거」(#asset-remove-btn)를 먼저 집어
       clearAssetImage 가 돌았고, 그래서 「고쳤는데도 빨강」이 나왔다 — 무의미한 빨강.
       ⇒ ㉠이미지/영상을 없애는 버튼은 «이름으로도 id 로도» 제외하고, ㉡「초기화」류만 집는다. */
  const clearBtn = [...sec.querySelectorAll('button')].find(b => {
    const t = (b.textContent || '').trim();
    if (/^(asset-(remove|replace|upload|pos)-btn)$/.test(b.id)) return false;
    if (/이미지|영상|image|video/i.test(t)) return false;
    return /초기화|기본값|지우기|없음|reset|clear|none/i.test(t);
  });
  return {
    section: true,
    label: (sec.innerText.match(/[^\n|]*배경[^\n|]*/) || [''])[0].trim(),
    swatch: swatch ? box(swatch) : null,
    swatchId: swatch ? (swatch.querySelector('input[type=color]')?.id || '') : '',
    clear: clearBtn ? box(clearBtn) : null,
    clearText: clearBtn ? clearBtn.textContent.trim() : '',
    panelText: body.innerText.replace(/\s*\n+\s*/g, ' | '),
  };
});

/** 블럭이 «지금» 무슨 배경을 들고 있는가 — 데이터(data-bgColor)와 화면(computed) 둘 다. */
const bgState = (page) => page.evaluate(() => {
  const ab = window.__ab;
  const cs = getComputedStyle(ab);
  return {
    dataBg: ab.dataset.bgColor || '',
    computedImage: cs.backgroundImage,
    computedColor: cs.backgroundColor,
    hasImage: ab.classList.contains('has-image'),
    imgSrcLen: (ab.dataset.imgSrc || '').length,
  };
});

/** 배경 절의 스와치를 «눌러» 컬러피커를 연다. (0×0 유령이면 여기서 못 연다 = 자동 검출) */
async function openBgPicker(page) {
  const pos = await page.evaluate(() => {
    const body = document.querySelector('#panel-right .panel-body');
    const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
    const sw = sec && sec.querySelector('.prop-color-swatch');
    if (!sw) return null;
    const r = sw.getBoundingClientRect();
    if (r.width < 4 || r.height < 4) return null;   // ⛔0×0 유령은 「있다」로 안 센다
    return { x: r.left + r.width / 2, y: r.top + r.height / 2 };
  });
  if (!pos) return false;
  await page.mouse.click(pos.x, pos.y);
  await page.waitForFunction(() => { const p = document.querySelector('.goya-cp-popover'); return p && !p.hidden; }, null, { timeout: 4000 });
  return true;
}

async function closePicker(page) {
  await page.keyboard.press('Escape');
  await page.waitForTimeout(120);
}

/** 사용자가 hex 칸에 «자기 색»을 찍는 진짜 경로. */
async function typeBgHex(page, hex) {
  await page.evaluate((h) => {
    const body = document.querySelector('#panel-right .panel-body');
    const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
    const inp = sec.querySelector('.prop-color-hex');
    inp.value = h;
    inp.dispatchEvent(new Event('input', { bubbles: true }));
    inp.dispatchEvent(new Event('change', { bubbles: true }));
  }, hex);
}

/** 컬러피커의 「그라데이션」 탭을 «눌러» 적용한다 — color-picker.js:85 「누르면 바로 적용」. */
async function applyGradientViaPicker(page) {
  await page.click('.goya-cp-popover .goya-cp-tab[data-tab="gradient"]');
  await page.waitForTimeout(250);
}

/** 이미지 «없는» 에셋 블럭에 실제 경로로 그라데이션을 얹는다. 성공하면 dataBg 를 돌려준다. */
async function seedGradient(page) {
  expect(await openBgPicker(page), '전제: 이미지 없는 블럭에서는 배경 스와치를 누를 수 있어야 한다').toBe(true);
  await closePicker(page);
  await typeBgHex(page, USER_HEX);
  await openBgPicker(page);
  await applyGradientViaPicker(page);
  await closePicker(page);
  return (await bgState(page)).dataBg;
}

async function addImage(page) {
  await page.evaluate((src) => window.setAssetImageFromSrc(window.__ab, src), PNG);
  // setAssetImageFromSrc 가 스스로 showAssetProperties 를 다시 부른다(image-handling.js:741) — 실제 경로 그대로.
  await page.waitForTimeout(200);
}

/** 영상을 «실제 경로»로 넣는다 — js/image-handling.js:646 setAssetVideoFromSrc.
 *  ⛔ab.classList.add('has-image') 나 dataset.assetType 을 하네스가 직접 쓰지 않는다.
 *    그 표시를 손으로 박으면 «실제 경로에서만 나는 결함»을 영영 못 잡는다. */
async function addVideo(page) {
  await page.evaluate((src) => window.setAssetVideoFromSrc(window.__ab, src), WEBM);
  // loadedmetadata 가 떠야 트림 절이 «불러오는 중»에서 실제 컨트롤로 바뀐다(image-handling.js:676).
  await page.waitForFunction(() => window.__ab && window.__ab.dataset.trimOut !== undefined, null, { timeout: 8000 })
    .catch(() => {});   // 못 떠도 배경 축 판정은 계속한다 — 아래에서 따로 센다
  await page.waitForTimeout(250);
}

test.describe('T-011 이미지 넣은 에셋 블럭 ↔ 배경 그라데이션에 «닿는 길»', () => {
  let pageErrs;
  /* P6 은 저장/복원 모듈이 더 필요해 자기 부팅을 따로 한다 — 그때만 boot 을 다시 부른다.
     ★route 는 page 당 한 번만 걸면 되므로, P6 에서는 이 기본 부팅을 안 쓴다(아래 test.skip 아님 —
     boot 이 route 를 덮어쓰지 않도록 P6 전용 describe 로 분리했다). */
  test.beforeEach(async ({ page }) => { pageErrs = await boot(page); });

  test('P1 ★닿는 길 — 이미지를 넣은 에셋 블럭에서도 배경색/그라데이션에 이르는 진입점이 있어야 한다', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });
    await addImage(page);

    // ① 빨강의 «이유»를 먼저 좁힌다 — 패널 자체는 멀쩡히 열렸다.
    const alive = await panelAlive(page);
    expect(alive.sections, '패널이 통째로 안 그려졌다면 이 검사의 빨강은 뜻이 없다').toBeGreaterThan(3);
    expect(alive.widthSlider, '패널 본문이 살아 있는지의 기준선(너비 슬라이더)').not.toBeNull();
    expect(alive.widthSlider.w, '너비 슬라이더가 0×0 이면 패널이 안 그려진 것').toBeGreaterThan(20);

    // ② 전제: 이미지가 «실제 경로»로 들어갔다.
    const st = await bgState(page);
    expect(st.hasImage, '전제: setAssetImageFromSrc 가 has-image 를 붙였다').toBe(true);
    expect(st.imgSrcLen, '전제: data-imgSrc 가 실렸다').toBeGreaterThan(20);

    // ③ 본검사 — 「배경」이라 적힌 절이 패널에 있는가, 그 스와치가 «눌릴 크기»인가.
    const reach = await bgReach(page);
    expect(reach.section, `이미지를 넣은 에셋 패널에 «배경» 절이 없다 — 패널 전문: ${reach.panelText}`).toBe(true);
    expect(reach.swatch, '배경 절은 있는데 색 필드가 없다').not.toBeNull();
    expect(reach.swatch.w, `배경 스와치가 ${reach.swatch && reach.swatch.w}px — DOM 0×0 유령`).toBeGreaterThan(8);
    expect(reach.swatch.h, '배경 스와치 높이가 0').toBeGreaterThan(8);

    // ④ «존재»가 아니라 «행위» — 진짜로 그라데이션까지 닿는가.
    expect(await openBgPicker(page), '배경 스와치를 눌러도 컬러피커가 안 열린다').toBe(true);
    await applyGradientViaPicker(page);
    await closePicker(page);
    const after = await bgState(page);
    expect(after.dataBg, `그라데이션 탭을 눌렀는데 data-bgColor 가 «${after.dataBg}» — 닿지 않았다`).toMatch(/gradient\s*\(/i);
    expect(after.computedImage, '데이터는 바뀌었는데 화면에 안 칠해졌다').toMatch(/gradient/i);

    expect(pageErrs, '페이지 에러가 났다면 빨강의 이유가 다른 데 있다').toEqual([]);
  });

  test('P2 ★되돌릴 길 — 그라데이션이 걸린 채 이미지를 넣어도 그것을 «지울 수단»이 있어야 한다', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });

    // ① 실제 경로로 그라데이션을 먼저 건다(이미지 넣기 «전»).
    const seeded = await seedGradient(page);
    expect(seeded, '전제: 이미지 없는 상태에선 그라데이션이 걸려야 한다').toMatch(/gradient\s*\(/i);
    expect(seeded, `전제: 걸린 값이 «내가 고른 색»(#${USER_HEX})이어야 기본값과 구별된다 — 실제: ${seeded}`)
      .toMatch(new RegExp(USER_HEX, 'i'));

    // ② 이미지를 «실제 경로»로 넣는다.
    await addImage(page);
    const st = await bgState(page);
    expect(st.hasImage, '전제: 이미지가 들어갔다').toBe(true);

    // ③ 본검사 — 지울 버튼이 패널에 «눌릴 크기»로 있는가.
    const reach = await bgReach(page);
    expect(reach.section, `이미지를 넣자 «배경» 절이 사라졌다 — 지울 문도 같이 사라진다. 패널 전문: ${reach.panelText}`).toBe(true);
    expect(reach.clear, `배경 절에 초기화/지우기 버튼이 없다 (절 안 버튼 텍스트: ${reach.clearText})`).not.toBeNull();
    expect(reach.clear.w, `초기화 버튼이 ${reach.clear && reach.clear.w}px — 0×0 유령`).toBeGreaterThan(8);
    expect(reach.clear.h, '초기화 버튼 높이가 0').toBeGreaterThan(8);

    // ④ 눌러서 «실제로» 지워지는가.
    const clickedText = await page.evaluate(() => {
      const body = document.querySelector('#panel-right .panel-body');
      const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
      const btn = [...sec.querySelectorAll('button')].find(b => {
        const t = (b.textContent || '').trim();
        if (/^(asset-(remove|replace|upload|pos)-btn)$/.test(b.id)) return false;
        if (/이미지|영상|image|video/i.test(t)) return false;
        return /초기화|기본값|지우기|없음|reset|clear|none/i.test(t);
      });
      btn.click();
      return (btn.textContent || '').trim();
    });
    // 「무엇을 눌렀는지」를 기록한다 — 엉뚱한 버튼(이미지 제거)을 누르고 빨강을 내는 걸 막는다.
    expect(clickedText, `누른 버튼이 배경 초기화가 아니다 — «${clickedText}»`).not.toMatch(/이미지|영상/);
    await page.waitForTimeout(150);
    const after = await bgState(page);
    expect(after.dataBg, `초기화를 눌렀는데 data-bgColor 가 «${after.dataBg}» 로 남았다`).not.toMatch(/gradient\s*\(/i);
    expect(after.computedImage, '초기화를 눌렀는데 화면엔 그라데이션이 그대로다').not.toMatch(/gradient/i);
    expect(after.hasImage, '초기화가 이미지까지 날리면 안 된다').toBe(true);
  });

  test('P3 ★막다른 골목 관측 — 값은 «남아서 칠해지는데» 패널은 그 사실을 한 마디도 안 한다', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });
    const seeded = await seedGradient(page);
    expect(seeded, '전제').toMatch(/gradient\s*\(/i);
    await addImage(page);

    const st = await bgState(page);

    /* ⒜ 양성대조(«초록»이어야 한다) — 그리는 쪽은 «멀쩡하다».
       ⛔이게 초록이어야 아래 ⒝ 의 빨강이 「그라데이션이 안 먹는다」가 아니라
         「닿는 길이 없다」를 가리킨다는 게 증명된다. */
    expect(st.dataBg, `관측: data-bgColor 가 살아 있는가 — 실제 «${st.dataBg}»`).toMatch(/gradient\s*\(/i);
    expect(st.dataBg, '관측: 남은 값이 사용자가 고른 색인가').toMatch(new RegExp(USER_HEX, 'i'));
    expect(st.computedImage, '양성대조: 이미지가 있어도 그라데이션은 «칠해진다»').toMatch(/gradient/i);
    expect(st.computedImage, '양성대조: 칠해진 것이 사용자 색인가').toContain(USER_RGB);

    /* ⒝ 본검사(지금 «빨강») — 그런데 패널엔 그 값이 어디에도 안 보인다. */
    const reach = await bgReach(page);
    expect(reach.section,
      `칠해지고 있는 그라데이션(${st.dataBg})이 패널 어디에도 안 나온다 — 패널 전문: ${reach.panelText}`).toBe(true);
    expect(reach.swatch, '배경 절은 있으나 값을 보여 줄 스와치가 없다').not.toBeNull();

    // ⒞ 패널이 보여 주는 값이 «지금 칠해진 값»과 같은 말을 해야 한다.
    const swatchBg = await page.evaluate(() => {
      const body = document.querySelector('#panel-right .panel-body');
      const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
      const sw = sec && sec.querySelector('.prop-color-swatch');
      return sw ? getComputedStyle(sw).backgroundImage : '';
    });
    expect(swatchBg, '패널 스와치가 블럭에 칠해진 그라데이션을 안 비춘다').toMatch(/gradient/i);
  });

  test('P4 ★회귀 대조 — 이미지 «없는» 에셋 블럭은 지금도 되는 그대로여야 한다 (전 구간 왕복)', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });

    // ① 배경 절·스와치·초기화 버튼이 «눌릴 크기»로 있다.
    const reach = await bgReach(page);
    expect(reach.section, '이미지 없는 에셋 패널에 배경 절이 없다').toBe(true);
    expect(reach.label, '「배경색」 라벨').toContain('배경');
    expect(reach.swatch.w, '스와치 폭').toBeGreaterThan(8);
    expect(reach.clear, '초기화 버튼').not.toBeNull();
    expect(reach.clear.w, '초기화 버튼 폭(T-100: 자기 줄로 내려 안 짜부라져야 한다)').toBeGreaterThan(20);

    // ② 솔리드 → 그라데이션 → 화면까지.
    const seeded = await seedGradient(page);
    expect(seeded, '그라데이션이 data-bgColor 에 실린다').toMatch(/gradient\s*\(/i);
    const mid = await bgState(page);
    expect(mid.computedImage, '그라데이션이 화면에 칠해진다').toMatch(/gradient/i);
    expect(mid.computedImage, '칠해진 것이 내가 고른 색이다').toContain(USER_RGB);

    // ③ 초기화 → 되돌아온다.
    /* ★실측(2026-09-22): 초기화는 data-bgColor 를 «빈 값»으로 두지 않는다.
       prop-asset.js:601~ 이 delete 한 «직후» bgField.setHex('#a0a0a0') 가 onApply 를 태워
       기본 솔리드를 다시 쓴다. ⇒ 기대값은 «빈 값»이 아니라 «그라데이션이 아닌 기본 솔리드».
       ⛔여기에 '' 를 박으면 이 회귀 대조가 «지금 dev 에서도» 빨강이 되어 아무것도 못 지킨다. */
    await page.evaluate(() => document.getElementById('asset-bg-clear').click());
    await page.waitForTimeout(120);
    const after = await bgState(page);
    expect(after.dataBg, `초기화 후에도 그라데이션이 data-bgColor 에 남았다 — 실제 «${after.dataBg}»`).not.toMatch(/gradient\s*\(/i);
    expect(['', '#a0a0a0'], `초기화가 기본 솔리드(#a0a0a0)로 안 돌아갔다 — 실제 «${after.dataBg}»`).toContain(after.dataBg);
    expect(after.computedImage, '초기화 후에도 그라데이션이 칠해져 있다').not.toMatch(/gradient/i);

    expect(pageErrs).toEqual([]);
  });

  test('P5 ★회귀 대조 — 이미지를 «빼면» 배경 절이 돌아오고 남아 있던 값이 다시 만져진다', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });
    const seeded = await seedGradient(page);
    await addImage(page);
    expect((await bgState(page)).hasImage).toBe(true);

    // 실제 경로로 이미지 제거 (패널의 「이미지 제거」가 부르는 그 함수).
    await page.evaluate(() => window.clearAssetImage(window.__ab));
    await page.waitForTimeout(150);
    await page.evaluate(() => window.__open(window.__ab));

    const st = await bgState(page);
    expect(st.hasImage, '이미지가 빠졌다').toBe(false);
    /* ★현재 동작 고정: clearAssetImage(image-handling.js:770~)는 data-bgColor 를 «안» 지운다.
       그래서 이미지를 빼면 옛 그라데이션이 그대로 돌아온다 — 지금 유일한 탈출구다.
       ⛔이 줄이 빨강이 되면 「탈출구까지 막혔다」는 뜻이다. */
    expect(st.dataBg, '이미지 제거 뒤 걸어 뒀던 그라데이션이 사라졌다').toBe(seeded);
    const reach = await bgReach(page);
    expect(reach.section, '이미지를 빼면 배경 절이 돌아와야 한다').toBe(true);
    expect(reach.swatch.w).toBeGreaterThan(8);
  });
});

/* ══════════════════════════════════════════════════════════════════════════
   P6 — 저장 → 불러오기 «왕복» 뒤에도 닿는가.
   ★왜 따로 도는가: 저장/복원 모듈(section-serialize.js + save-load.js)을 더 얹어야 해서
     하네스가 달라진다. P1~P5 의 기준선을 «같은 판»으로 유지하려고 describe 를 분리했다.
   ★왜 재는가: 이미지가 든 에셋은 저장본의 class 에 has-image 가 그대로 실린다 →
     다시 열어도 같은 갈래로 떨어진다. 왕복에서 값까지 새면 고쳐도 반쪽이다.
   ⛔저장·복원을 하네스가 흉내내지 않는다 — getSerializedCanvas()/rebindAll() 원문을 부른다.
══════════════════════════════════════════════════════════════════════════ */
test.describe('T-011 저장 → 불러오기 왕복', () => {
  let pageErrs;
  test.beforeEach(async ({ page }) => { pageErrs = await boot(page, { io: true }); });

  test('P6 ★왕복 — 그라데이션 건 이미지 에셋을 저장했다 다시 열어도 배경에 닿아야 한다', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });
    const seeded = await seedGradient(page);
    expect(seeded, '전제: 이미지 없는 상태에서 그라데이션이 걸린다').toMatch(/gradient\s*\(/i);
    await addImage(page);
    const before = await bgState(page);
    expect(before.hasImage, '전제: 이미지가 들어갔다').toBe(true);

    // ⓪ 대역이 «섹션 배선 다섯 자리»뿐임을 못박는다 — 에셋/배경 쪽은 전부 원문이 돈다.
    expect(await page.evaluate(() => window.__stubbed), '하네스 대역 목록이 바뀌었다')
      .toEqual(['migrateColsFromDOM', 'bindSectionDelete', 'bindSectionOrder', 'bindSectionDropZone', 'bindSectionDrag']);

    // ① 저장 — 실제 getSerializedCanvas().
    const saved = await page.evaluate(() => window.__save());
    expect(saved.length, '저장본이 비었다면 왕복 자체가 성립 안 한다').toBeGreaterThan(200);
    /* ★축 하나 더: 저장본 «문자열»에 값이 실렸는가. 여기서 새면 「닿는 길」 이전에 «자료 유실»이다.
       ⛔이건 지금 dev 에서도 초록이어야 한다 — 실려는 있고, 만질 길만 없는 게 이 카드의 병이다. */
    expect(saved, `저장본에 has-image 가 없다`).toContain('has-image');
    expect(saved.toLowerCase(), `저장본에 그라데이션이 안 실렸다 — 저장 단계에서 값이 샌다`).toMatch(/gradient\s*\(/i);
    expect(saved.toLowerCase(), '저장본에 실린 그라데이션이 내가 고른 색이 아니다').toContain(USER_HEX.toLowerCase());

    // ② 불러오기 — canvasEl.innerHTML 재대입 + 실제 rebindAll().
    await page.evaluate((html) => {
      const ab = window.__load(html);
      window.__ab = ab;
      window.__open(ab);
    }, saved);
    await page.waitForTimeout(200);

    // ③ 전제·양성대조 — 왕복 뒤에도 이미지가 살아 있고, 그라데이션은 «여전히 칠해진다».
    const st = await bgState(page);
    expect(st.hasImage, '왕복 뒤 has-image 가 사라졌다 — 이 검사의 빨강은 다른 병을 가리킨다').toBe(true);
    expect(st.dataBg, `왕복 뒤 data-bgColor — 실제 «${st.dataBg}»`).toMatch(/gradient\s*\(/i);
    expect(st.computedImage, '양성대조: 왕복 뒤에도 그라데이션은 칠해진다').toMatch(/gradient/i);
    expect(st.computedImage, '양성대조: 칠해진 것이 내 색이다').toContain(USER_RGB);

    // ④ 패널이 열렸는지부터 — 빨강의 이유를 좁힌다.
    const alive = await panelAlive(page);
    expect(alive.widthSlider, '왕복 뒤 패널이 안 열렸다면 이 빨강은 뜻이 없다').not.toBeNull();
    expect(alive.widthSlider.w).toBeGreaterThan(20);

    // ⑤ 본검사 — 왕복 뒤에도 배경에 닿는 문이 있는가.
    const reach = await bgReach(page);
    expect(reach.section,
      `저장→복원 뒤에도 «배경» 절이 없다 (칠해진 값: ${st.dataBg}) — 패널 전문: ${reach.panelText}`).toBe(true);
    expect(reach.swatch, '배경 절은 있는데 색 필드가 없다').not.toBeNull();
    expect(reach.swatch.w, '배경 스와치 0×0').toBeGreaterThan(8);

    // ⑥ 그리고 실제로 만져지는가 — 왕복 뒤 «새» 그라데이션으로 덮어쓸 수 있어야 한다.
    expect(await openBgPicker(page), '왕복 뒤 배경 스와치를 눌러도 피커가 안 열린다').toBe(true);
    await applyGradientViaPicker(page);
    await closePicker(page);
    expect((await bgState(page)).dataBg, '왕복 뒤 그라데이션 탭을 눌렀는데 값이 안 바뀐다').toMatch(/gradient\s*\(/i);

    expect(pageErrs, '페이지 에러가 났다면 빨강의 이유가 다른 데 있다').toEqual([]);
  });

  test('P7 ★회귀 대조 — 이미지 «없는» 에셋은 왕복 뒤에도 지금처럼 만져진다', async ({ page }) => {
    await page.evaluate(() => { window.__open(window.__mk()); });
    const seeded = await seedGradient(page);
    const saved = await page.evaluate(() => window.__save());
    expect(saved.toLowerCase(), '저장본에 그라데이션이 실린다').toMatch(/gradient\s*\(/i);

    await page.evaluate((html) => { window.__ab = window.__load(html); window.__open(window.__ab); }, saved);
    await page.waitForTimeout(200);

    const st = await bgState(page);
    expect(st.hasImage, '이미지 없는 상태가 유지된다').toBe(false);
    expect(st.dataBg, '왕복 뒤 값이 그대로다').toBe(seeded);
    expect(st.computedImage, '왕복 뒤에도 칠해진다').toContain(USER_RGB);

    const reach = await bgReach(page);
    expect(reach.section, '왕복 뒤 배경 절이 있다').toBe(true);
    expect(reach.swatch.w).toBeGreaterThan(8);
    expect(reach.clear, '왕복 뒤 초기화 버튼이 있다').not.toBeNull();

    // 왕복 뒤에도 초기화가 «실제로» 먹는가.
    await page.evaluate(() => document.getElementById('asset-bg-clear').click());
    await page.waitForTimeout(120);
    const after = await bgState(page);
    expect(after.dataBg, `왕복 뒤 초기화가 안 먹는다 — 실제 «${after.dataBg}»`).not.toMatch(/gradient\s*\(/i);
    expect(after.computedImage, '왕복 뒤 초기화 후에도 그라데이션이 칠해져 있다').not.toMatch(/gradient/i);

    expect(pageErrs).toEqual([]);
  });

  test('P8 ★영상도 같은 갈래다 — video-pending 에서도 배경에 닿고, 되돌려도 영상이 안 날아간다', async ({ page }) => {
    /* ★왜 따로 있나 (2026-09-22)
       setAssetVideoFromSrc(image-handling.js:646)도 has-image 를 붙이고, prop-asset.js 의 패널은
       hasImage «하나»로만 갈린다 ⇒ 영상은 이미지와 «같은 갈래»를 타고 같은 증상이 났다.
       그런데 P1~P7 은 전부 이미지 경로만 밟는다 — 다음 사람이 그 갈래를 건드리면
       영상 쪽은 «조용히» 도로 막힌다. 그 자리를 여기서 지킨다. */
    await page.evaluate(() => { window.__open(window.__mk()); });
    await addVideo(page);

    // ① 전제 — 실제 경로가 표시를 붙였다(하네스가 박은 게 아니다).
    const st0 = await page.evaluate(() => ({
      hasImage: window.__ab.classList.contains('has-image'),
      assetType: window.__ab.dataset.assetType,
      videoEl: !!window.__ab.querySelector('video.asset-video'),
      trimOut: window.__ab.dataset.trimOut,
    }));
    expect(st0.hasImage, '전제: setAssetVideoFromSrc 가 has-image 를 붙였다').toBe(true);
    expect(st0.assetType, '전제: 영상 미리보기 상태다').toBe('video-pending');
    expect(st0.videoEl, '전제: video 엘리먼트가 실제로 꽂혔다').toBe(true);

    // ② 패널이 통째로 안 그려진 것은 아님을 먼저 못박는다.
    const alive = await panelAlive(page);
    expect(alive.widthSlider, '패널 본문 기준선').not.toBeNull();
    expect(alive.widthSlider.w).toBeGreaterThan(20);

    // ③ 본검사 — 영상 상태에서도 «배경» 절에 닿는가.
    const reach = await bgReach(page);
    expect(reach.section, `영상 에셋 패널에 «배경» 절이 없다 — 패널 전문: ${reach.panelText}`).toBe(true);
    expect(reach.swatch, '배경 절은 있는데 색 필드가 없다').not.toBeNull();
    expect(reach.swatch.w, `배경 스와치가 ${reach.swatch && reach.swatch.w}px — 0×0 유령`).toBeGreaterThan(8);

    // ④ «존재»가 아니라 «행위» — 진짜 피커로 그라데이션까지.
    expect(await openBgPicker(page), '영상 상태에서 배경 스와치를 눌러도 피커가 안 열린다').toBe(true);
    await applyGradientViaPicker(page);
    await closePicker(page);
    const after = await bgState(page);
    expect(after.dataBg, `영상 상태에서 그라데이션 탭을 눌렀는데 data-bgColor 가 «${after.dataBg}»`).toMatch(/gradient\s*\(/i);
    expect(after.computedImage, '데이터는 바뀌었는데 화면에 안 칠해졌다').toMatch(/gradient/i);

    // ⑤ 영상은 그대로다 — 배경을 만졌다고 영상이 날아가면 안 된다.
    const st1 = await page.evaluate(() => ({
      assetType: window.__ab.dataset.assetType,
      videoEl: !!window.__ab.querySelector('video.asset-video'),
      trimSections: [...document.querySelectorAll('#panel-right .prop-section')]
        .filter(s => /Video/i.test(s.querySelector('.prop-section-title')?.textContent || '')).length,
    }));
    expect(st1.assetType, '배경을 건드리자 영상 상태가 풀렸다').toBe('video-pending');
    expect(st1.videoEl, '배경을 건드리자 video 엘리먼트가 사라졌다').toBe(true);
    /* 트림 절이 살아 있는가 — 배경 절을 끼워 넣느라 영상 절을 밀어내지 않았다는 증거.
       (Fit/교체/제거 절 + 트림 절 = 2. 트림은 loadedmetadata 전엔 «불러오는 중» 상태로 뜬다.) */
    expect(st1.trimSections, 'Video 절(교체/제거 + 트림)이 줄었다 — 배경 절이 영상 절을 밀어냈다').toBe(2);

    // ⑥ 되돌릴 길 — 「초기화」를 눌러도 영상은 살아남아야 한다.
    const clickedText = await page.evaluate(() => {
      const body = document.querySelector('#panel-right .panel-body');
      const sec = [...body.querySelectorAll('.prop-section')].find(s => /배경/.test(s.innerText));
      const btn = [...sec.querySelectorAll('button')].find(b => {
        const t = (b.textContent || '').trim();
        if (/^(asset-(remove|replace|upload|pos)-btn)$/.test(b.id)) return false;
        if (/이미지|영상|image|video/i.test(t)) return false;
        return /초기화|기본값|지우기|없음|reset|clear|none/i.test(t);
      });
      if (!btn) return null;
      btn.click();
      return (btn.textContent || '').trim();
    });
    // ⛔「무엇을 눌렀는가」를 남긴다 — 「영상 제거」를 눌러 놓고 빨강을 내는 사고를 막는다(P2 선례).
    expect(clickedText, '배경 절에서 초기화 버튼을 못 찾았다').not.toBeNull();
    expect(clickedText, `누른 버튼이 배경 초기화가 아니다 — «${clickedText}»`).not.toMatch(/이미지|영상/);
    await page.waitForTimeout(150);

    const end = await page.evaluate(() => ({
      dataBg: window.__ab.dataset.bgColor || '',
      computedImage: getComputedStyle(window.__ab).backgroundImage,
      assetType: window.__ab.dataset.assetType,
      videoEl: !!window.__ab.querySelector('video.asset-video'),
    }));
    expect(end.dataBg, `초기화 뒤에도 그라데이션이 남았다 — «${end.dataBg}»`).not.toMatch(/gradient\s*\(/i);
    expect(end.computedImage, '초기화 뒤에도 화면에 그라데이션이 그대로다').not.toMatch(/gradient/i);
    expect(end.assetType, '배경 초기화가 영상 상태까지 풀었다').toBe('video-pending');
    expect(end.videoEl, '★배경 초기화가 영상을 날렸다').toBe(true);

    expect(pageErrs, '페이지 에러가 났다면 빨강의 이유가 다른 데 있다').toEqual([]);
  });
});
