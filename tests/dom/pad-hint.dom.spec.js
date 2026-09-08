/* pad-hint.dom.spec.js — 좌우 패딩 힌트의 «진짜 끝». (2026-09-08 신설)
 *
 * ★왜 필요한가
 *   tests/unit/pad-hint.test.js 는 «소스에 그 문자열이 있나»까지만 안다.
 *   ⇒ 「CSS 변수가 진짜 테두리 두께가 되나」·「400ms 뒤 진짜 사라지나」·
 *     「만지지 않은 섹션은 진짜 0px 인가」는 «렌더러가 그린 뒤»에만 답이 나온다.
 *   그래서 여기서는 진짜 css/editor-canvas.css 와 진짜 js/props/prop-section.js 를
 *   크로미움에 얹고, 진짜 슬라이더에 진짜 input 을 흘려 getComputedStyle 로 «잰다».
 *
 * ⛔앱을 «안» 띄운다 — 고디터 인스턴스·MCP 대역 무접촉. 레포 파일만 얹는다
 *   (modal-resize.dom.spec.js 의 page.route 하네스를 그대로 쓴다).
 *
 * ★★변이를 빨갛게 만드는 책임은 tests/unit/pad-hint.test.js 가 진다
 *   (tests/dom 은 playwright 라 node --test 스위트에 «안 들어간다»).
 *   여기는 «그 배선이 실제로 화면을 바꾸나»를 잰다.
 *
 * 실행: npx playwright test --config=tests/dom/playwright.dom.config.js pad-hint
 */
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
               '.html': 'text/html', '.png': 'image/png', '.svg': 'image/svg+xml' };

/* ★하네스는 «진짜 index.html» 이다 — 스크립트 태그만 걷어내고 마크업·CSS 는 그대로 쓴다.
   ⚠️처음엔 손으로 만든 작은 골격을 썼는데 editor.js 가 #zoom-display·bindSectionDropZone …
     하며 줄줄이 넘어졌다. 골격을 «흉내»내면 그 흉내가 검사의 전제가 된다.
   ⇒ 진짜 마크업을 쓰면 CSS 캐스케이드도 진짜다(editor-canvas.css 가 혼자 로드될 때와 다르다). */
const HARNESS = (() => {
  let h = fs.readFileSync(path.join(REPO, 'index.html'), 'utf8');
  h = h.replace(/<script\b[\s\S]*?<\/script>/gi, '');
  /* ★세척 «진짜 함수»를 얹는다 — D6 이 재구현이 아니라 실물을 돌리게. 플레인 스크립트라 단독 로드된다. */
  return h.replace('</body>', `<script src="/js/io/section-serialize.js"></script>
<script type="module">
  import { showSectionProperties } from '/js/props/prop-section.js';
  import { showPageProperties } from '/js/props/prop-page.js';
  window.__open = showSectionProperties;
  window.__openPage = showPageProperties;
  window.__ready = true;
</script></body>`);
})();

/* 섹션은 «로드 뒤»에 넣는다 — 로드 시점에 캔버스에 섹션이 있으면 editor.js 가
   플레인 스크립트(bindSectionDropZone)를 찾다 넘어진다. 우리 검사와 무관한 배선이다. */
const SECTIONS = `
  <div class="section-block" id="sec_1" data-section="1" data-name="Section 01">
    <div class="section-hitzone"><span class="section-label">Section 01</span></div>
    <div class="section-inner" style="min-height:200px"></div>
  </div>
  <div class="section-block" id="sec_2" data-section="2" data-name="Section 02">
    <div class="section-hitzone"><span class="section-label">Section 02</span></div>
    <div class="section-inner" style="min-height:200px">
      <div class="asset-block" id="ab_full" style="height:80px;background:#3355ff"></div>
    </div>
  </div>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      return route.fulfill({ status: 404, body: '' });
    }
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  await page.evaluate((html) => { document.getElementById('canvas').innerHTML = html; }, SECTIONS);
  /* ★입력이 살아 있다 — 섹션이 «실제로» 들어갔나. 0개면 아래 단언이 전부 공회전한다. */
  const n = await page.locator('#canvas .section-inner').count();
  expect(n, '섹션이 캔버스에 안 들어갔다 — 이 검사가 잴 대상이 없다').toBe(2);
  return errs;
}

/** 섹션 프로퍼티 패널을 «진짜로» 연다. 슬라이더가 나올 때까지 기다린다. */
async function openPanel(page, secId) {
  await page.evaluate((id) => window.__open(document.getElementById(id)), secId);
  await page.waitForSelector('#sec-padx-slider', { state: 'attached' });
}

/** 진짜 슬라이더에 진짜 input 이벤트를 흘린다(사람이 끄는 것과 같은 경로). */
async function slide(page, v) {
  await page.evaluate((v) => {
    const s = document.getElementById('sec-padx-slider');
    s.value = String(v);
    s.dispatchEvent(new Event('input', { bubbles: true }));
  }, v);
}

/** 띠의 «진짜» 두께 — 의사요소의 계산된 테두리 폭. */
const bandOf = (page, secId) => page.evaluate((id) => {
  const inner = document.querySelector('#' + id + ' .section-inner');
  const b = getComputedStyle(inner, '::before');
  const s = getComputedStyle(inner);
  return {
    left: b.borderLeftWidth, right: b.borderRightWidth, color: b.borderLeftColor,
    padL: s.paddingLeft, padR: s.paddingRight,
    overflowX: s.overflowX, position: s.position,
    varL: inner.style.getPropertyValue('--gdt-pad-l'),
    on: document.body.classList.contains('gdt-pad-on'),
  };
}, secId);

test('D1 ★슬라이더를 «진짜로» 움직이면 띠 두께 = 패딩값 (양성대조: 만지기 «전»엔 0px)', async ({ page }) => {
  const errs = await boot(page);
  await openPanel(page, 'sec_1');

  /* ★입력이 살아 있다 — 슬라이더가 진짜로 있고, 만지기 전엔 띠가 «없다».
     이 음성대조가 없으면 아래 40px 이 「원래 그랬던 것」과 구별되지 않는다. */
  expect(await page.locator('#sec-padx-slider').count()).toBe(1);
  const before = await bandOf(page, 'sec_1');
  expect(before.on, '만지기 전인데 body 에 gdt-pad-on 이 있다').toBe(false);
  expect(before.left, '만지기 전인데 띠가 있다').toBe('0px');

  await slide(page, 40);
  const at40 = await bandOf(page, 'sec_1');
  expect(at40.on, '슬라이더를 움직였는데 gdt-pad-on 이 안 붙었다').toBe(true);
  expect(at40.padL, '패딩 자체가 안 먹었다 — 이 검사의 전제가 깨졌다').toBe('40px');
  expect(at40.left,  '★띠 두께가 패딩값과 다르다(왼쪽)').toBe('40px');
  expect(at40.right, '★띠 두께가 패딩값과 다르다(오른쪽)').toBe('40px');
  expect(at40.color, '★색이 핑크 10% 가 아니다').toBe('rgba(255, 0, 128, 0.1)');

  /* ★«따라온다» — 한 값에서만 맞는 건 우연일 수 있다. 다른 값에서도 같아야 계산이 없다는 뜻. */
  await slide(page, 12);
  const at12 = await bandOf(page, 'sec_1');
  expect(at12.left,  '패딩을 12로 줄였는데 띠가 안 따라왔다').toBe('12px');
  expect(at12.right, '패딩을 12로 줄였는데 띠가 안 따라왔다').toBe('12px');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D2 ★400ms 뒤 저절로 사라진다 — 그리고 «변수까지» 거둔다', async ({ page }) => {
  const errs = await boot(page);
  await openPanel(page, 'sec_1');
  await slide(page, 40);

  const on = await bandOf(page, 'sec_1');
  expect(on.on, '띠가 뜨지도 않았다 — D2 의 전제가 깨졌다').toBe(true);
  expect(on.varL, '인라인 변수가 안 박혔다 — D2 의 전제가 깨졌다').toBe('40px');

  /* 디바운스보다 «짧게» 기다렸을 땐 아직 살아 있어야 한다(끄는 «동안» 보이는 게 이 기능이다). */
  await page.waitForTimeout(150);
  expect((await bandOf(page, 'sec_1')).on, '150ms 만에 사라졌다 — 끄는 동안 안 보인다').toBe(true);

  await page.waitForTimeout(500);
  const off = await bandOf(page, 'sec_1');
  expect(off.on, '★650ms 이 지나도 gdt-pad-on 이 남아 있다 — 디바운스가 없다').toBe(false);
  expect(off.left, '클래스는 빠졌는데 띠가 남아 있다').toBe('0px');
  /* ★변수를 안 거두면 인라인 style 이라 getSerializedCanvas(clone.innerHTML)를 타고
     «프로젝트 파일»에 실린다 — 옆집 그리드 가이드가 DOM 을 안 건드리는 이유. */
  expect(off.varL, '★인라인 변수가 남았다 — 프로젝트 파일에 실린다').toBe('');
  expect(await page.evaluate(() => document.querySelector('#sec_1 .section-inner').getAttribute('style')),
    '★style 속성에 --gdt-pad 가 남았다').not.toContain('--gdt-pad');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D3 ★만지지 «않은» 섹션엔 띠가 0px 다 (변수를 body 에 박으면 여기서 빨강)', async ({ page }) => {
  const errs = await boot(page);

  /* sec_2 에 «다른» 패딩을 먼저 먹여 둔다 — 두 섹션의 패딩이 다른 상황을 만든다. */
  await openPanel(page, 'sec_2');
  await slide(page, 16);
  await page.waitForTimeout(500);                        // 힌트가 걷힌 뒤부터 대조를 시작한다

  await openPanel(page, 'sec_1');
  await slide(page, 40);

  const a = await bandOf(page, 'sec_1');
  const b = await bandOf(page, 'sec_2');

  /* ★입력이 살아 있다 — 두 섹션의 패딩이 «실제로 다르다». 같으면 이 대조는 아무것도 안 잰다. */
  expect(a.padL, 'sec_1 패딩').toBe('40px');
  expect(b.padL, 'sec_2 패딩').toBe('16px');
  expect(a.padL).not.toBe(b.padL);

  expect(a.on, '띠가 켜지지도 않았다').toBe(true);
  expect(a.left, '만지는 섹션의 띠').toBe('40px');
  expect(b.left,  '★만지지 않은 sec_2 에 띠가 떴다 — 변수를 body 에 박았나').toBe('0px');
  expect(b.right, '★만지지 않은 sec_2 에 띠가 떴다 — 변수를 body 에 박았나').toBe('0px');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D4 ★overflow-x:clip 과 position 전환 실측 — 띠가 잘리지 않고, 켤 때만 relative 다', async ({ page }) => {
  const errs = await boot(page);
  await openPanel(page, 'sec_1');

  /* ⚠️.section-inner 는 평소 position 이 없다(editor-layout.css). 켜는 «동안»만 relative 다. */
  const before = await bandOf(page, 'sec_1');
  expect(before.overflowX, 'overflow-x 가 clip 이 아니다 — 이 검사의 전제가 바뀌었다').toBe('clip');
  expect(before.position, '켜기 전인데 이미 relative 다').toBe('static');

  await slide(page, 40);
  const on = await bandOf(page, 'sec_1');
  expect(on.position, '켜는 동안 relative 가 아니면 inset:0 이 «더 바깥»을 기준으로 잡힌다').toBe('relative');

  /* ★띠는 inner 의 «안쪽»이라 clip 에 안 잘린다 — 의사요소 상자와 inner 상자를 «재서» 확인한다. */
  const geo = await page.evaluate(() => {
    const inner = document.querySelector('#sec_1 .section-inner');
    /* ⚠️getBoundingClientRect 를 쓰면 안 된다 — #canvas-scaler 의 transform: scale 이 곱해진다.
         실측: 배율 40% 에서 rect.width 344 / 레이아웃 폭 860 으로 «두 배 넘게» 갈렸다.
         의사요소의 computed width 는 레이아웃 px 이므로 «같은 자»로 재야 한다. */
    const si = getComputedStyle(inner), sb = getComputedStyle(inner, '::before');
    return {
      w: si.width, padL: si.paddingLeft, padR: si.paddingRight,
      bw: sb.width, bl: sb.borderLeftWidth, br: sb.borderRightWidth,
    };
  });
  expect(parseFloat(geo.w), '섹션 폭이 0 이다 — 잴 대상이 없다').toBeGreaterThan(100);
  /* ⚠️box-sizing:border-box 라 computed width 는 «테두리 상자»다(콘텐츠 상자가 아니다).
       ⇒ inset:0 이 제대로 서면 의사요소 테두리 상자 = 부모 폭 «그대로»여야 한다.
       한 픽셀이라도 넘치면 overflow-x:clip 이 잘라낼 자리가 생긴다 — 넘치지 «않음»을 잰다. */
  expect(geo.bw, '★의사요소가 부모 폭과 안 맞는다 — 넘치면 clip 이 잘라낸다').toBe(geo.w);
  /* 그리고 띠가 «먹는» 폭이 정확히 좌우 패딩이다 — 계산이 없다는 말의 실측. */
  expect(parseFloat(geo.bl) + parseFloat(geo.br),
    '★띠가 덮는 폭이 좌우 패딩 합과 다르다').toBe(parseFloat(geo.padL) + parseFloat(geo.padR));

  /* 400ms 뒤엔 position 도 원래대로 돌아온다(켤 때마다 생겼다 없어지는 컨테이닝 블록). */
  await page.waitForTimeout(500);
  expect((await bandOf(page, 'sec_1')).position, '꺼진 뒤에도 relative 로 남았다').toBe('static');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D5 ★숫자칸도 «같은 손»을 탄다 — 슬라이더만 배선되지 않았다', async ({ page }) => {
  const errs = await boot(page);
  await openPanel(page, 'sec_1');

  /* ★입력이 살아 있다 — 숫자칸이 진짜로 있나. 없으면 아래는 아무것도 안 잰다. */
  expect(await page.locator('#sec-padx-number').count(), '숫자칸이 없다').toBe(1);
  expect((await bandOf(page, 'sec_1')).left, '만지기 전인데 띠가 있다').toBe('0px');

  /* ⚠️숫자칸은 change 에서 pushHistory() 까지 부른다. 그 함수는 js/io/save-load.js 의
       window.getSerializedCanvas 를 쓰는데 이 하네스는 그 모듈을 안 얹는다(앱을 안 띄우므로).
       ⇒ «이 검사가 재려는 것»(숫자칸도 힌트를 부르나)과 무관한 하네스의 구멍이라 여기서만 메운다.
       ⛔이걸 «기능이 깨졌다»로 읽지 마라 — 실제 앱에는 그 함수가 있다(save-load.js:1993). */
  await page.evaluate(() => {
    window.getSerializedCanvas = window.getSerializedCanvas || (() => '');
    const n = document.getElementById('sec-padx-number');
    n.value = '28';
    n.dispatchEvent(new Event('change', { bubbles: true }));
  });

  const b = await bandOf(page, 'sec_1');
  expect(b.on, '★숫자칸으로 바꿨는데 띠가 안 떴다 — 슬라이더에만 배선됐다').toBe(true);
  expect(b.padL, '패딩 자체가 안 먹었다').toBe('28px');
  expect(b.left, '★띠 두께가 숫자칸 값과 다르다').toBe('28px');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════
   D6 ★저장과의 «경합» — 힌트가 켜진 «그 순간»에 직렬화하면?
   400ms 거두기는 보통 autoSave(1500ms)보다 먼저 끝난다. 그런데 슬라이더를
   «놓지 않고 계속 끄는 동안»엔 클래스도 변수도 살아 있다. 그 창에 저장이 겹치면?
   ⇒ 재본 결과: serializeCleanRoot 는 «거부목록»이라 .section-inner 의 style 을 안 턴다.
     그래서 세척에 한 줄을 더했다. 이 검사는 그 한 줄이 사라지면 빨개진다.
   ★말로 「거두니까 괜찮다」로 두지 않는다 — 거두기가 안 도는 창이 실재하기 때문이다.
   ═══════════════════════════════════════════════════════════ */
test('D6 ★힌트가 «켜진 채로» 직렬화해도 --gdt-pad 가 0건이다', async ({ page }) => {
  const errs = await boot(page);
  await openPanel(page, 'sec_1');
  await slide(page, 40);

  const r = await page.evaluate(() => {
    const inner = document.querySelector('#sec_1 .section-inner');
    return {
      /* ★입력이 살아 있다 ⑴ — 세척 «진짜 함수»가 실재하나. 없으면 아래는 공회전이다. */
      hasFn: typeof window.serializeCleanRoot === 'function',
      /* ★입력이 살아 있다 ⑵ — 지금 «정말로» 힌트가 켜져 있고 변수가 라이브 DOM 에 있나. */
      on: document.body.classList.contains('gdt-pad-on'),
      liveVar: inner.style.getPropertyValue('--gdt-pad-l'),
      /* ★양성대조 — 세척 «전»의 클론에는 변수가 «실제로» 들어 있다.
         이게 0이면 이 검사는 아무것도 안 재고 있다. */
      rawHits: (document.getElementById('canvas').cloneNode(true).outerHTML.match(/--gdt-pad/g) || []).length,
      /* 본 단언 — 세척을 «진짜로» 돌린 결과 */
      cleanHits: (() => {
        const clone = document.getElementById('canvas').cloneNode(true);
        window.serializeCleanRoot(clone);
        return (clone.innerHTML.match(/--gdt-pad/g) || []).length;
      })(),
      /* 세척이 라이브 DOM 을 안 건드렸나 — 클론 전용이어야 한다 */
      liveVarAfter: inner.style.getPropertyValue('--gdt-pad-l'),
      /* 세척이 «진짜 편집»인 패딩까지 먹지는 않았나 (과잉 세척 음성대조) */
      padKept: (() => {
        const clone = document.getElementById('canvas').cloneNode(true);
        window.serializeCleanRoot(clone);
        return (clone.innerHTML.match(/padding-left: 40px/g) || []).length;
      })(),
    };
  });

  expect(r.hasFn, 'serializeCleanRoot 가 없다 — 하네스가 그 스크립트를 안 얹었나').toBe(true);
  expect(r.on, '힌트가 켜져 있지 않다 — 이 검사의 전제가 깨졌다').toBe(true);
  expect(r.liveVar, '라이브 DOM 에 변수가 없다 — 잴 대상이 없다').toBe('40px');
  expect(r.rawHits, '★세척 «전»에도 변수가 0건이다 — 이 검사가 아무것도 안 재고 있다')
    .toBeGreaterThanOrEqual(2);                       // 좌·우 두 개. 하한을 박는다
  expect(r.rawHits, '변수가 비정상적으로 많다 — 엉뚱한 것을 세고 있다').toBeLessThan(20);

  expect(r.cleanHits, '★세척한 마크업에 --gdt-pad 가 남았다 — 저장본에 편집 보조가 실린다').toBe(0);
  expect(r.liveVarAfter, '★세척이 라이브 DOM 을 건드렸다 — 클론 전용이어야 한다').toBe('40px');
  expect(r.padKept, '★세척이 «진짜 편집»인 패딩까지 먹었다').toBe(1);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════
   켜고 끄기 — «런타임». 소스에 문자열이 있나로 끝내지 않는다.
   ★T-persist 는 «진짜 함수»(readPadHintOn/savePadHintOn + showPageProperties)로 잰다.
     재구현한 잣대로 재면 재구현이 맞는지를 재는 꼴이 된다.
   ⚠️여기서 «패널 폭·잘림»은 재지 않는다 — 하네스는 CSS 를 얹은 만큼만 갖는다.
     폭·잘림은 실앱(CDP)에서 잰다.
   ═══════════════════════════════════════════════════════════ */

/** 페이지 패널을 «진짜로» 열고 체크박스가 나올 때까지 기다린다. */
async function openPagePanel(page) {
  await page.evaluate(() => window.__openPage());
  await page.waitForSelector('#page-pad-hint-on', { state: 'attached' });
}

test('D7 ★기본은 켜짐 — 저장값이 «없을 때» 체크돼 있고 띠도 뜬다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => localStorage.clear());        // 키가 «없는» 상태를 만든다
  await openPagePanel(page);

  const st = await page.evaluate(() => ({
    /* ★입력이 살아 있다 — 체크박스가 실제로 있나. 0개면 아래 셋이 전부 공회전한다. */
    n: document.querySelectorAll('#page-pad-hint-on').length,
    stored: localStorage.getItem('gdt.padHint'),
    checked: document.getElementById('page-pad-hint-on').checked,
    readsOn: window.readPadHintOn(),
    /* 형제(그리드)와 «같은 절»에 있나 — 자리를 실측한다 */
    sameSection: !!document.getElementById('page-grid-on')
      ?.closest('.prop-section')?.querySelector('#page-pad-hint-on'),
    type: document.getElementById('page-pad-hint-on').type,
  }));
  expect(st.n, '체크박스가 없다 — 잴 대상이 없다').toBe(1);
  expect(st.stored, '저장값이 «없는» 상태여야 이 검사가 뜻이 있다').toBeNull();
  expect(st.readsOn, '★키가 없는데 readPadHintOn 이 false 다 — 기본이 뒤집혔다').toBe(true);
  expect(st.checked, '★기본인데 체크가 안 돼 있다').toBe(true);
  expect(st.sameSection, '★그리드 가이드와 «다른 절»에 있다').toBe(true);
  expect(st.type, '★어휘가 체크박스가 아니다').toBe('checkbox');

  /* 그리고 «실제로» 뜬다 */
  await openPanel(page, 'sec_1');
  await slide(page, 40);
  expect((await bandOf(page, 'sec_1')).left, '기본 켜짐인데 띠가 안 뜬다').toBe('40px');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D8 ★T-off — 꺼 두면 슬라이더를 만져도 «아예» 안 뜬다', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => localStorage.clear());
  await openPagePanel(page);

  /* ★양성대조 먼저 — 끄기 «전»엔 뜬다. 이게 없으면 「원래 안 뜨는 것」과 구별이 안 된다. */
  await openPanel(page, 'sec_1');
  await slide(page, 40);
  expect((await bandOf(page, 'sec_1')).left, '끄기 전인데 안 뜬다 — 양성대조가 깨졌다').toBe('40px');
  await page.waitForTimeout(500);

  /* 진짜 체크박스를 진짜로 클릭해서 끈다 */
  await openPagePanel(page);
  await page.click('#page-pad-hint-on');
  expect(await page.evaluate(() => window.readPadHintOn()), '껐는데 false 로 안 읽힌다').toBe(false);

  await openPanel(page, 'sec_1');
  await slide(page, 72);
  const off = await bandOf(page, 'sec_1');
  expect(off.padL, '패딩 «자체»는 계속 먹어야 한다 — 끈 것은 힌트지 기능이 아니다').toBe('72px');
  expect(off.on,   '★꺼 뒀는데 body 에 gdt-pad-on 이 붙었다').toBe(false);
  expect(off.left, '★꺼 뒀는데 띠가 떴다').toBe('0px');
  expect(off.varL, '★꺼 뒀는데 인라인 변수가 박혔다').toBe('');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D9 ★T-persist — 껐다가 패널을 «다시 열면» 꺼져 있다 (진짜 함수 왕복)', async ({ page }) => {
  const errs = await boot(page);
  await page.evaluate(() => localStorage.clear());
  await openPagePanel(page);
  expect(await page.evaluate(() => document.getElementById('page-pad-hint-on').checked),
    '시작 상태가 켜짐이어야 한다').toBe(true);

  await page.click('#page-pad-hint-on');                  // 끈다
  const saved = await page.evaluate(() => localStorage.getItem('gdt.padHint'));
  expect(saved, '★저장이 «실제로» 되지 않았다 — 왕복을 잴 수 없다').toBe('{"on":false}');

  /* 패널을 «다시 그린다» — 사람이 다른 것을 만졌다가 돌아온 것과 같은 경로 */
  await page.evaluate(() => { document.querySelector('#panel-right .panel-body').innerHTML = ''; });
  await openPagePanel(page);
  expect(await page.evaluate(() => document.getElementById('page-pad-hint-on').checked),
    '★다시 열었더니 체크가 되살아났다 — 저장을 안 읽는다').toBe(false);

  /* 다시 켜면 저장도 따라온다(한 방향만 되는 것을 막는다) */
  await page.click('#page-pad-hint-on');
  expect(await page.evaluate(() => localStorage.getItem('gdt.padHint')),
    '다시 켠 것이 저장되지 않았다').toBe('{"on":true}');

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

test('D10 ★기존 저장값을 «덮지 않는다» — 꺼진 채 저장돼 있으면 열어도 꺼진 채다', async ({ page }) => {
  const errs = await boot(page);
  /* 사람이 예전에 꺼 둔 상태를 «미리» 만든다 */
  await page.evaluate(() => { localStorage.clear(); localStorage.setItem('gdt.padHint', '{"on":false}'); });

  await openPagePanel(page);
  const st = await page.evaluate(() => ({
    stored: localStorage.getItem('gdt.padHint'),
    checked: document.getElementById('page-pad-hint-on').checked,
  }));
  expect(st.checked, '★저장된 «꺼짐»을 무시하고 체크했다').toBe(false);
  expect(st.stored, '★패널을 열기만 했는데 저장값이 덮였다').toBe('{"on":false}');

  /* 그리고 그 상태에서 슬라이더를 만져도 안 뜬다 */
  await openPanel(page, 'sec_1');
  await slide(page, 40);
  expect((await bandOf(page, 'sec_1')).on, '★저장된 꺼짐인데 띠가 떴다').toBe(false);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});

/* ═══════════════════════════════════════════════════════════
   D11 ★풀블리드 에셋 «위»에서도 띠 폭이 패딩과 같다 — 픽셀로 잰다
   ⛔getComputedStyle 로 끝내면 안 된다. 이 결함의 모양이 정확히
     「소스는 맞는데 화면에서 «가려지는»」 것이었다 —
     실측(2026-09-08 실앱): 패딩 88px 짜리 줄이 에셋 구간에서 55px 로 읽혔다.
   ⇒ 화면을 «찍어» 그 자리의 색을 직접 읽는다.
   ⇐ 되돌리면 빨강: CSS 의 z-index 한 줄을 빼면 에셋이 띠를 덮어 파랑만 나온다.
   ═══════════════════════════════════════════════════════════ */

/** 화면을 찍어 «그 좌표의 색»을 읽는다. 페이지 안 canvas 로 디코딩한다(외부 라이브러리 없음). */
async function samplePixels(page, pts) {
  const b64 = (await page.screenshot()).toString('base64');
  return page.evaluate(async ({ b64, pts }) => {
    const img = new Image();
    img.src = 'data:image/png;base64,' + b64;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = img.naturalWidth; c.height = img.naturalHeight;
    c.getContext('2d').drawImage(img, 0, 0);
    const ctx = c.getContext('2d');
    /* 스크린샷이 CSS px 와 1:1 인지 «재서» 확인한다 — 아니면 좌표가 어긋난다. */
    const k = img.naturalWidth / window.innerWidth;
    return {
      k, w: img.naturalWidth,
      px: pts.map(p => [...ctx.getImageData(Math.round(p[0] * k), Math.round(p[1] * k), 1, 1).data].slice(0, 3)),
    };
  }, { b64, pts });
}

const near = (got, want, tol = 4) =>
  got.length === 3 && got.every((v, i) => Math.abs(v - want[i]) <= tol);

test('D11 ★풀블리드 에셋 위에서도 띠가 «보인다» — 화면을 찍어 색으로 잰다', async ({ page }) => {
  const errs = await boot(page);

  /* ⚠️하네스는 앱을 안 띄우므로 index.html 의 «프로젝트 로딩 가림막»이 안 걷힌다 —
       #proj-loading-overlay 가 rgba(0,0,0,.28) 로 화면 전체를 덮어, #3355ff 가 (36,60,181) 로 읽혔다.
       ⇒ 이 검사만 그걸 걷는다. 재려는 것은 「띠가 에셋 위에 칠해지나」지 가림막이 아니다. */
  await page.evaluate(() => document.getElementById('proj-loading-overlay')?.remove());

  await openPanel(page, 'sec_2');            // sec_2 의 .section-inner «직속»에 asset-block 이 있다
  await slide(page, 40);

  /* ★★배치가 «멈출 때까지» 먼저 기다린다.
     하네스의 줌은 비동기로 자리를 잡는다 — 실측에서 같은 검사가 실행마다 배율 0.46/0.52/0.40 로 갈렸고,
     그 사이에 좌표를 뜨고 화면을 찍으면 «다른 순간의 둘»을 맞대게 된다.
     ⛔이걸 안 하면 「띠가 엉뚱한 데 있다」는 거짓 실패가 난다(실제로 세 번 속았다). */
  await page.waitForFunction(() => {
    const r = document.querySelector('#sec_2 .section-inner').getBoundingClientRect();
    const k = Math.round(r.x) + 'x' + Math.round(r.width);
    const same = window.__padGeoKey === k; window.__padGeoKey = k; return same;
  }, null, { polling: 250 });
  await slide(page, 40);                     // 자리가 잡힌 «뒤»에 다시 켠다

  const geo = await page.evaluate(() => {
    const inner = document.querySelector('#sec_2 .section-inner');
    const ab = document.getElementById('ab_full');
    const ir = inner.getBoundingClientRect(), ar = ab.getBoundingClientRect();
    return {
      innerX: ir.x, innerW: ir.width, abX: ar.x, abY: ar.y, abH: ar.height,
      abML: getComputedStyle(ab).marginLeft,
      band: getComputedStyle(inner, '::before').borderLeftWidth,
      pad: getComputedStyle(inner).paddingLeft,
      z: getComputedStyle(inner, '::before').zIndex,
      on: document.body.classList.contains('gdt-pad-on'),
      scale: ir.width / parseFloat(getComputedStyle(inner).width),
    };
  });

  /* ★입력이 살아 있다 ⑴ — 그 에셋이 «정말로» 풀블리드인가. 음수 마진이 없으면 겹침이 없어 공회전이다. */
  expect(geo.abML, '★에셋에 음수 마진이 안 걸렸다 — 풀블리드가 아니면 잴 게 없다').toBe('-40px');
  /* ★입력이 살아 있다 ⑵ — 에셋이 띠 구간을 «실제로» 덮고 있나 */
  expect(geo.abX, '★에셋이 띠 구간을 안 덮는다 — 겹침이 없으면 이 검사는 공회전이다')
    .toBeLessThanOrEqual(geo.innerX + 1);
  expect(geo.abH, '에셋 높이가 0 이다').toBeGreaterThan(10);
  expect(geo.on, '찍기 직전에 힌트가 꺼져 있었다').toBe(true);
  expect(geo.band, '띠 폭이 패딩과 다르다').toBe('40px');
  expect(geo.pad, '패딩이 안 먹었다').toBe('40px');
  /* 화면 위 띠 폭 — 샘플점을 띠 «안»에 확실히 넣으려면 최소 4px 은 돼야 한다 */
  const bandPx = 40 * geo.scale;
  expect(bandPx, `화면상 띠가 ${bandPx.toFixed(1)}px 뿐 — 샘플점을 안에 넣을 수 없다`).toBeGreaterThan(6);

  const y = Math.round(geo.abY + geo.abH / 2);
  const pts = [[Math.round(geo.innerX + bandPx / 2), y],                    // 왼쪽 띠 «안»
               [Math.round(geo.innerX + geo.innerW - bandPx / 2), y],       // 오른쪽 띠 «안»
               [Math.round(geo.innerX + geo.innerW / 2), y]];               // 띠 «밖»(대조군)

  /* ★입력이 살아 있다 ⑶ — 세 점이 «정말로» 그 에셋 위인가
     (::before 는 pointer-events:none 이라 elementFromPoint 는 아래의 에셋을 돌려준다) */
  expect(await page.evaluate(p => p.map(q => document.elementFromPoint(q[0], q[1])?.id || 'NULL'), pts),
    '★샘플점이 그 에셋 위가 아니다 — 엉뚱한 좌표를 찍고 있다').toEqual(['ab_full', 'ab_full', 'ab_full']);

  const BLUE = [51, 85, 255];                  // #3355ff — 에셋 바탕
  const PINK_ON_BLUE = [71, 77, 242];          // rgba(255,0,128,.10) 을 그 위에 얹은 값

  const on = await samplePixels(page, pts);
  expect(on.k, '스크린샷과 CSS px 의 자가 1:1 이 아니다 — 좌표가 어긋난다').toBe(1);

  /* ★대조군 먼저 — 띠 «밖»은 순수 에셋 색이어야 한다.
     여기가 다르면 좌표든 가림막이든 전제가 깨진 것이고 아래 판정은 헛돈다. */
  expect(near(on.px[2], BLUE),
    `★대조군(띠 밖)이 에셋 색이 아니다 — 얻은 색 ${on.px[2]}, 기대 ${BLUE}`).toBe(true);

  /* 본 단언 — 띠 «안»은 에셋 위인데도 핑크가 얹힌다.
     ⇐ CSS 의 z-index 한 줄을 빼면 여기서 «가려져» 순수 파랑이 나온다. */
  for (const [k, nm] of [[0, '왼쪽'], [1, '오른쪽']]) {
    expect(near(on.px[k], PINK_ON_BLUE),
      `★${nm} 띠가 에셋에 가려 안 보인다 — 얻은 색 ${on.px[k]}, 기대 ${PINK_ON_BLUE} (가려지면 ${BLUE})`).toBe(true);
  }

  /* 음성대조 — 꺼지면 도로 순수 파랑이다(「원래부터 그 색」이 아님을 못 박는다) */
  await page.waitForTimeout(600);
  const off = await samplePixels(page, pts);
  expect(near(off.px[0], BLUE), `★띠가 걷힌 뒤에도 핑크가 남았다 — ${off.px[0]}`).toBe(true);
  expect(near(off.px[1], BLUE), `★띠가 걷힌 뒤에도 핑크가 남았다 — ${off.px[1]}`).toBe(true);

  expect(errs, '콘솔 오류가 났다: ' + errs.join(' | ')).toEqual([]);
});
