/* icon-text-panel-after-restore.dom.spec.js — 「복원(⌘Z·프로젝트 열기) 뒤에도 아이콘+텍스트
 * 블럭의 우측 패널이 열리는가」.
 *
 * ★신고 (2026-09-20 최종 통합 라운드, 실앱 9505·줌 40% 에서 실측하다 발견)
 *   아이콘+텍스트 블럭을 넣고 «⌘Z 한 번»을 누르면, 그 뒤로는 블럭을 아무리 클릭해도
 *   우측 텍스트 패널이 «영영» 안 열린다(블럭은 선택되고 테두리도 뜨는데 패널만 안 온다).
 *   오버레이를 켜 둔 상태였다면 오버레이 토글조차 못 찾아 «끌 수도» 없다.
 *
 * ★기전 — 그물 셋 중 둘이 이 타입을 모른다
 *   ⑴ 스냅샷은 편집 상태 속성을 «전부» 뗀다 — js/io/section-serialize.js
 *      (`root.querySelectorAll('[contenteditable]') … removeAttribute`). 이건 의도된 세척이다.
 *   ⑵ 복원 뒤 되붙이는 자리는 `.text-block` «만» 돈다 — js/io/save-load.js rebindAll.
 *      .icon-text-block 은 .text-block 이 «아니고» 본문 칸도 `.itb-text`(접두사 itb-)라
 *      그 inner 목록에도 없다 ⇒ 이 타입만 되붙임을 못 받는다.
 *   ⑶ 읽는 쪽의 fallback 목록도 tb-* 뿐이었다 — js/props/prop-text.js showTextProperties 는
 *      `[contenteditable]` 도 fallback 도 못 찾으면 console.warn 뒤 «조용히 return» 한다.
 *   ⇒ 세척은 모두에게 같은데 되살림이 둘 다 이 타입을 빼먹어, 아이콘+텍스트만 패널을 잃는다.
 *
 * ★실앱 실측 (고치기 전, 9505 / 줌 40% / 격리 프로필)
 *   삽입 직후        : .itb-text contenteditable="false" · 클릭 → 패널 토글 있음
 *   ⌘Z 직후          : contenteditable=null           · 패널 토글 «0개»
 *   ⌘Z 뒤 다시 클릭  : contenteditable=null           · 패널 토글 «0개» (영영 안 돌아온다)
 *   대조군 .tb-h2 / .tb-bubble 은 같은 ⌘Z 뒤에도 contenteditable="false" 를 유지했다
 *   (그 둘은 ⑵ 의 `.text-block` 갈래가 되붙여 준다) ⇒ 이 타입 «한 종»만 새는 게 맞다.
 *
 * ⚠️★재현 함정 — ⌘Z 를 «언제» 누르냐로 결과가 갈린다 (내가 한 번 헛디뎠다, 2026-09-20)
 *   · 삽입 «직후» ⌘Z  = «삽입 자체»를 무른다 ⇒ 블럭이 사라지고 패널은 Gap/Size 로 바뀐다.
 *                        이건 «정상»이다 — 여기서 「패널이 다르다」를 보고 결함으로 읽으면 안 된다.
 *   · 리사이즈(또는 다른 편집) «뒤» ⌘Z = «그 편집»만 무른다 ⇒ 블럭이 살아남고,
 *                        복원 경로를 한 번 통과하므로 «여기서만» 위 병이 난다.
 *   ⇒ 재현 절차를 적는 사람은 ⌘Z 앞에 «편집 한 번»을 꼭 끼워라. 안 끼우면 "재현 안 됨"이 나오고,
 *     그 거짓 음성이 이 결함을 「없는 것」으로 닫는다.
 *
 * ⚠️★같은 결의 거짓 음성을 «나도 한 번 더» 냈다 — 잘린 출력으로 「없다」를 판정하지 마라
 *   위 재현 함정을 적은 날(2026-09-20) 나는 인스턴스 하나를 두고 「--user-data-dir 이 없다
 *   = 격리 안 된 실사용 프로필이다」라고 보고했다가 오탐으로 정정당했다. 원인은 관측이 아니라
 *   «자른 것»이었다 — `ps … | cut -c1-160` 이 그 인자 앞에서 줄을 잘랐고, 나는 「안 보인다」를
 *   「없다」로 읽었다. 실제로는 있었다(자르지 않고 `ps -o args= -p <pid> | tr ' ' '\n' | grep`
 *   으로 끊어 세면 나온다. ⚠️단 기본 프로필 경로엔 «공백»이 있어 `tr ' '` 도 값을 자른다 —
 *   값까지 봐야 하면 자르지 말고 인자 문자열 자체를 봐라).
 *   ⇒ 「A 가 보이지 않는다」와 「A 가 없다」는 다른 문장이다. 부재를 주장하려면 «자르지 않은»
 *     관측이거나, 못 봤다고 적어라. 잘못된 부재 판정은 멀쩡한 것을 죽이러 가게 만든다.
 *   ★쓸 것 — «있나/없나»와 «값»은 다른 명령이다(둘을 한 명령으로 때우려다 셋이 틀렸다).
 *     ⛔명령 본문은 블록 주석 «밖»(아래 // 줄)에 뒀다 — sed 의 `.*` + `//` 가 만드는 «별+빗금»이
 *       블록 주석을 그 자리에서 끝내 버려서, 여기 적었다가 이 파일을 한 번 깨먹었다(d707fb1).
 *   ⚠️값 쪽은 «휴리스틱»이라 완전하지 않다(실측): 경로에 공백이 있으면 `tr ' '` 판은 값을
 *     자르고, `sed` 로 뒤쪽 인자를 떼는 판은 다음 인자가 대문자(--Foo)면 그걸 값으로 삼킨다.
 *     값 안에 스페이스+하이픈두개가 들어가도 깨진다 ⇒ 값을 «판정 근거»로 쓸 땐 원본 인자도
 *     같이 남겨라. 값은 «보여 주기»용이고, 판정은 «자르지 않은» 관측으로 해라.
 *
 * ★고친 뒤 «온전함»까지 확인 (2026-09-20, panel-dict 사전을 기준선으로)
 *   「패널이 열린다」와 「패널이 온전하다」는 다른 말이라 한 겹 더 쟀다. panel-dict 추출기와
 *   «같은 잣대»(.prop-section-title · input,select,textarea,button,[contenteditable=true],[role=slider]
 *   · isVisible=offsetParent||getClientRects)로 실앱에서 뽑아 셋을 맞댔다:
 *     삽입직후(내 트리)      절 11(보임 9) · 컨트롤 76(보임 43)
 *     ⌘Z 복원 뒤(고친 뒤)    절 11(보임 9) · 컨트롤 76(보임 43)   ← 같다
 *     ref icon-text(20e50e3) 절 11(보임 9) · 컨트롤 76(보임 43)
 *   컨트롤 76개를 (id·cls·kind·소속절·보임) 으로 전수 대조 — 복원 뒤가 삽입직후와 다른 칸은
 *   `txt-overlay-toggle` 의 `active` «하나»뿐이고, 그건 그 주행에서 오버레이를 켜 둔 «상태» 차이다.
 *   ⇒ 되살리되 «덜» 되살리지 않는다. (그리고 삽입직후==20e50e3 이라 이 브랜치가 패널 모양을
 *     건드리지 않았다는 것도 같이 잡힌다.)
 *
 * ★무엇을 재나 — 이 하네스는 ⑶ 을 재고, ⑵ 는 tests/unit/icon-text-contenteditable-restore
 *   가 «되붙이는 자리»를 직접 본다(rebindAll 은 앱 전체를 끌고 와야 해서 여기선 못 돈다).
 *   R1 ★복원 꼴(= contenteditable 이 떨어진 상태)의 아이콘+텍스트도 패널이 열린다  (고치기 전 red)
 *   R2 ★그때 편집 표식이 «되살아난다» (다음 사람이 또 같은 곳에서 안 넘어지게)        (고치기 전 red)
 *   R3 양성대조 — 같은 꼴의 흔한 텍스트(.tb-body)는 고치기 «전에도» 열린다
 *      ⇒ 이 검사가 「패널이 아예 안 뜨는 하네스」라서 red 인 게 아님을 증명한다.
 *   R4 음성대조 — 본문 칸이 «없는» 껍데기에는 여전히 패널을 열지 않는다(무조건 통과 아님).
 *
 * ⛔앱을 «안» 띄운다 — 레포 파일만 크로미움에 얹는다(overlay-icon-text-panel-sync 와 같은 부팅).
 *   ★패널은 스텁이 아니라 «진짜» js/props/prop-text.js 다.
 * ⚠️변이 책임은 tests/unit/icon-text-contenteditable-restore.test.mjs 가 진다(tests/dom 은 `npm test` 밖).
 *
 * 실행: npm run test:dom -- icon-text-panel-after-restore
 */
// ★위 「부재 판정」 항목이 말한 명령 둘 — 줄 주석이라야 안전하다(블록 주석 안에선 sed 의 별+빗금이
//   주석을 끊는다). $P 는 대상 PID.
//   ⑴ 있나/없나(판정용, 아무것도 안 자른다):
//        case "$(ps -o args= -p $P)" in *--user-data-dir=*) echo 있음;; *) echo 없음;; esac
//   ⑵ 값까지(보여 주기용, 휴리스틱):
//        ps -o args= -p $P | sed 's/.*--user-data-dir=//; s/ --.*//'
const { test, expect } = require('@playwright/test');
const fs = require('fs');
const path = require('path');

const REPO = path.join(__dirname, '..', '..');
const ORIGIN = 'http://goditor.dom.test';
const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css', '.html': 'text/html' };

const HARNESS = `<!doctype html><html><head><meta charset="utf-8">
<link rel="stylesheet" href="/css/editor-base.css">
<link rel="stylesheet" href="/css/editor-panels.css">
<link rel="stylesheet" href="/css/editor-props.css">
<link rel="stylesheet" href="/css/editor-blocks.css">
<link rel="stylesheet" href="/css/editor-extra.css">
<style>#panel-right{position:fixed;right:0;top:0;width:260px;height:100%;overflow:auto;z-index:10000}</style>
</head><body style="margin:0">
<div id="canvas-scaler" style="transform: scale(1); transform-origin: 0 0;">
  <div id="canvas" style="width:860px">
    <div class="section-block" id="sec" style="width:860px;min-height:600px;position:relative">
      <div class="section-inner" id="host" style="width:600px;margin:0 auto"></div>
    </div>
  </div>
</div>
<div id="ss-handles-overlay"></div>
<div id="panel-right"><div class="panel-body"></div></div>
<script src="/js/feature-flags.js"></script>
<script src="/js/drag-history.js"></script>
<script src="/js/block-edit.js"></script>
<script src="/js/text-effect-transform.js"></script>
<script type="module">
  import '/js/block-factory.js';                       // makeIconTextBlock / makeTextBlock / _makeTextFrame
  import '/js/props/color-picker.js';
  import { showTextProperties } from '/js/props/prop-text.js';
  window.currentZoom = 100;
  window.showTextProperties = showTextProperties;
  window.scheduleAutoSave = () => {};
  window.triggerAutoSave  = () => {};
  window.getBlockBreadcrumb = () => '';
  window.pushHistory = () => {};
  window.__ready = true;
</script></body></html>`;

async function boot(page) {
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e)));
  await page.route(`${ORIGIN}/**`, async (route) => {
    const url = new URL(route.request().url());
    if (url.pathname === '/__harness.html') return route.fulfill({ contentType: 'text/html', body: HARNESS });
    const file = path.join(REPO, decodeURIComponent(url.pathname));
    if (!file.startsWith(REPO) || !fs.existsSync(file)) return route.fulfill({ status: 404, body: '' });
    return route.fulfill({ contentType: MIME[path.extname(file)] || 'text/plain', body: fs.readFileSync(file) });
  });
  await page.goto(`${ORIGIN}/__harness.html`);
  await page.waitForFunction(() => window.__ready === true);
  return errs;
}

const raf = (page) => page.evaluate(() => new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r))));

/** ★«복원된 꼴»을 만든다 — 진짜 팩토리로 올린 뒤, 스냅샷이 하는 것과 «같은» 세척을 먹인다
 *  (js/io/section-serialize.js 의 그 한 줄). 앱에서는 ⌘Z·프로젝트 열기가 이 상태를 만든다. */
async function mountRestored(page, kind) {
  return page.evaluate((kind) => {
    const host = document.getElementById('host');
    let block;
    if (kind === 'icon-text') {
      const made = window.makeIconTextBlock();
      host.appendChild(made.row);
      block = made.block;
    } else if (kind === 'text') {
      const made = window.makeTextBlock('body');
      host.appendChild(made.row || made.block);
      block = made.block;
    } else { // 'empty' — 본문 칸이 없는 껍데기(음성대조)
      block = document.createElement('div');
      block.className = 'icon-text-block';
      block.id = 'itb_empty';
      host.appendChild(block);
    }
    // ★세척 — 스냅샷과 같은 손짓
    block.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
    document.querySelector('#panel-right .panel-body').innerHTML = '';
    block.classList.add('selected');
    window.showTextProperties(block);
    const inner = block.querySelector('.itb-text, .tb-body');
    return {
      ce: inner ? inner.getAttribute('contenteditable') : null,
      panelOpen: !!document.getElementById('txt-overlay-toggle'),
    };
  }, kind);
}

test.describe('복원 뒤 아이콘+텍스트 패널', () => {
  test('R1 ★복원 꼴의 아이콘+텍스트도 우측 패널이 열린다 (고치기 전 안 열림)', async ({ page }) => {
    const errs = await boot(page);
    const r = await mountRestored(page, 'icon-text');
    await raf(page);
    expect(r.panelOpen,
      '★패널이 안 열렸다 — showTextProperties 가 contentEl 을 못 찾고 return 했다').toBe(true);
    expect(errs, `pageerror: ${errs.join(' | ')}`).toEqual([]);
  });

  test('R2 ★그때 편집 표식(contenteditable)이 되살아난다', async ({ page }) => {
    await boot(page);
    const r = await mountRestored(page, 'icon-text');
    expect(r.ce, '★.itb-text 의 contenteditable 이 안 되살아났다').toBe('false');
  });

  test('R3 양성대조 — 같은 꼴의 흔한 텍스트(.tb-body)는 고치기 전에도 열린다', async ({ page }) => {
    await boot(page);
    const r = await mountRestored(page, 'text');
    expect(r.panelOpen, '대조군까지 안 열린다 — 이 하네스가 패널 자체를 못 띄우는 것이다').toBe(true);
  });

  test('R4 음성대조 — 본문 칸이 «없는» 껍데기에는 패널을 열지 않는다', async ({ page }) => {
    await boot(page);
    const r = await mountRestored(page, 'empty');
    expect(r.panelOpen, '본문 칸이 없는데도 패널이 열렸다 — 게이트가 무조건 통과로 바뀌었다').toBe(false);
  });
});
