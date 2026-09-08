/* tpl-open-window-await — 「템플릿 패널 팝아웃」의 실패 경로가 «말을 하는가»를 지킨다.
 *
 * ═══ ★왜 이 파일이 있나 (2026-09-08, 현빈 실물 검수 → 적대검수 ⓒ) ═══════════════
 * `main.js` 의 `templates:open-window` 는 «창을 띄우는» IPC 다. 여기서 세 번 연속 같은 병을 앓았다:
 *
 *   ①  실패를 만드는 코드가 «아예 없었다» — try/catch 도, ok:false 분기도 없었다.
 *       그래서 렌더러는 「패널을 안 닫는」 것까지는 맞게 했지만 «아무 말도 못 했다»(토스트 0건).
 *       사용자 눈에는 「버튼을 눌렀는데 아무 일도 안 일어남」.
 *   ②  try/catch 를 넣었더니 «반쯤» 고쳐졌다. `loadFile` 은 Promise 를 돌려주는데
 *       ★`await` 가 없어서 «비동기 reject» 가 동기 catch 를 그대로 빠져나갔다.
 *       ⇒ main 은 `{ok:true}` 를 돌려주고, 렌더러는 그 말을 믿고 «패널을 닫았다».
 *   ③  그 순간 남는 창이 «닫을 길이 없다» — 같은 판에 `frame:false`(신호등 제거)를 넣었기 때문에
 *       신호등이 없고, 내용이 안 실렸으니 헤더의 X 버튼도 없다.
 *       실측(CDP, `pages/template-browser.html` 을 «실제로» 치우고 클릭):
 *         href=chrome-error://chromewebdata/ · bodyLen=0 · #tpl-browser-close 없음 · .tpl-browser-header 없음
 *
 * ★즉 ③ 은 «개선(신호등 제거)이 만든 새 위험»이다. 그래서 이 세 불변식은 «함께» 지켜져야 한다.
 *
 * ═══ ⚠️★이 파일의 한계 — «먼저» 읽어라 ══════════════════════════════════════
 * 아래 T-c2~T-c5 는 **런타임 검사가 아니라 «소스 문자열» 단언**이다.
 *
 *  ⛔무엇을 «못» 잡나
 *     · `await` 는 그대로인데 `loadFile` 이 다른 이름/다른 호출 형태로 바뀐 경우
 *     · `catch` 안에 `ok:false` 와 `destroy()` 라는 «글자»는 있는데 «로직»이 망가진 경우
 *     · 렌더러가 `if (r?.ok)` 가드를 유지한 채 `r` 을 엉뚱하게 채우는 경우
 *    ⇒ 이 검사들은 「배선이 아직 거기 있는가」만 지킨다. 「그 배선이 옳게 도는가」가 아니다.
 *
 *  ★왜 소스 단언인가
 *     Electron main 프로세스를 유닛테스트에서 «띄울» 수 없다. `_ipc-harness.js` 로 main.js 를
 *     적재해 진짜 핸들러를 부를 수는 있지만(T-c1 이 그렇게 한다), 그 하네스의 BrowserWindow 스텁은
 *     ★`loadFile` 이 «항상 성공»하는 고정 객체를 돌려준다 — 테스트가 그걸 reject 시킬 수 없다.
 *     `main.js` 가 모듈 적재 시점에 `const { BrowserWindow } = require('electron')` 로
 *     바인딩을 «잡아버려서» 나중에 스텁을 갈아끼워도 안 먹는다(실측 확인).
 *     ⇒ 하네스를 고치면 런타임으로 잴 수 있지만, `_ipc-harness.js` 는 «여러 검사가 공유하는 도구»라
 *       이 건 하나 때문에 건드리지 않았다. 고치는 날 T-c3 을 런타임 검사로 «승격»시켜라.
 *
 *  ★진짜로 «잰» 것은 어디 있나 — CDP 실앱 계측(전용 인스턴스, 별도 user-data-dir):
 *     · ⓑ `pages/template-browser.html` 을 실제로 치움 → 패널 «안 닫힘» · 토스트 1건 · 잔여 창 0개
 *     · main 로그에 `[templates] 팝아웃 창을 열지 못했다: Error: ERR_FILE_NOT_FOUND (-6)` 1건
 *       ⇒ 비동기 reject 가 catch 까지 «온다»는 직접 증거
 *     · ★A/B: `await` «한 단어만» 도로 빼면 다시 빨강(패널 닫힘 · 토스트 0 · chrome-error 빈 창 1개)
 *     · 정상: 패널 닫힘 · 창 1개(bodyLen 44388 · #tpl-browser-close 있음)
 *   ⛔그 계측은 «내 하네스 안에서만» 살았다. 이 파일은 그 결론을 레포에 남기려고 있다.
 *
 *  ⚠️정상적인 리팩터링에도 빨강이 날 수 있다. 그때 이 파일을 «지우지 마라».
 *    「그 불변식이 여전히 지켜지는가」를 먼저 확인하고, 지켜진다면 «패턴»을 고쳐라.
 *    선례: `grid-callsite-ssot.test.mjs`(호출부 SSOT), `entitlement-ipc.test.mjs` U-ENT-B14(부팅 await 0).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');   // ★CRLF 정규화 — 윈도우에서 자르기가 어긋나 검사가 통째로 안 도는 사고가 있었다
const { loadMain } = require('./_ipc-harness.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

/* 주석을 «먼저» 지운다 — 이 자리의 주석에는 `await`·`ok: false`·`destroy()` 가 «설명으로» 잔뜩 들어 있어서
   안 지우면 계측기가 «자기 자신의 설명문»을 배선으로 착각한다(entitlement-ipc U-ENT-B14 가 겪은 오탐). */
const stripComments = (s) =>
  s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1 ');

/** main.js 에서 templates:open-window 핸들러 «본문»만 잘라 온다(주석 제거된 상태). */
function openWindowHandlerBody() {
  const src = readSrc(ROOT, 'main.js');
  const m = src.match(/ipcMain\.handle\(\s*'templates:open-window'[\s\S]*?\n\}\);/);
  assert.ok(m, '★templates:open-window 핸들러를 못 찾았다 — 채널명이 바뀌었으면 «이 검사부터» 고쳐라');
  const body = stripComments(m[0]);
  /* ★자르기·주석제거가 본문까지 먹지 않았는지 확인한다. 이게 없으면 「빈 문자열이라 다 통과」가 된다. */
  assert.ok(body.includes('BrowserWindow') && body.includes('catch'),
    '★주석을 지우다가 본문까지 지웠다 — 이 검사는 무효다');
  return body;
}

/** js/panels/template-browser.js 에서 팝아웃 버튼 클릭 핸들러만 잘라 온다(주석 제거된 상태). */
function popoutHandlerBody() {
  const src = readSrc(ROOT, 'js/panels/template-browser.js');
  const m = src.match(/document\.getElementById\('tpl-browser-popout'\)[\s\S]*?\n {2}\}\);/);
  assert.ok(m, "★#tpl-browser-popout 클릭 핸들러를 못 찾았다 — 배선이 옮겨졌으면 «이 검사부터» 고쳐라");
  const body = stripComments(m[0]);
  assert.ok(body.includes('openTemplateWindow'),
    '★주석을 지우다가 본문까지 지웠다 — 이 검사는 무효다');
  return body;
}

/* ═══ T-c1 «런타임» — 진짜 핸들러를 불러 성공 계약의 «모양»을 잰다 ═══════════════
   ⚠️여기서 «실패» 경로는 못 잰다(위 한계 참조). 성공 두 갈래만 진짜로 돈다. */
test('T-c1 ★templates:open-window 는 «등록된 채널»이고, 부르면 Promise 를 돌려준다(=async 다)', async () => {
  const H = loadMain();
  assert.equal(H.has('templates:open-window'), true,
    '★채널이 아예 없다 — 팝아웃 버튼이 눌려도 아무 일도 안 난다');

  const p = H.invoke('templates:open-window');
  assert.ok(p && typeof p.then === 'function',
    '★핸들러가 Promise 를 안 돌려준다 = 동기 함수다. 동기면 loadFile 의 «비동기 reject» 를 영영 못 잡는다');

  const first = await p;
  assert.deepEqual(first, { ok: true, reused: false },
    '★첫 호출의 성공 계약이 깨졌다 — 렌더러는 이 ok 를 보고 «인앱 패널을 닫는다»');

  const second = await H.invoke('templates:open-window');
  assert.deepEqual(second, { ok: true, reused: true },
    '★두 번째 호출은 «창을 새로 만들지 않고» 포커스만 줘야 한다(창이 둘이면 어느 쪽이 최신인지 알 수 없다)');
});

/* ═══ T-c2 핸들러가 async 로 선언돼 있다 ════════════════════════════════════ */
test('T-c2 templates:open-window 핸들러는 «async» 다', () => {
  const src = readSrc(ROOT, 'main.js');
  assert.match(src, /ipcMain\.handle\(\s*'templates:open-window'\s*,\s*async\s/,
    '★핸들러에서 async 가 사라졌다 — async 가 아니면 loadFile 에 await 를 «못 붙인다»');
});

/* ═══ T-c3 ★★핵심 — 핸들러 안의 loadFile 이 await 된다 ══════════════════════ */
test('T-c3 ★★핸들러 안의 loadFile 은 «await» 된다 — 이게 빠지면 비동기 reject 가 catch 를 빠져나간다', () => {
  const body = openWindowHandlerBody();
  const calls = [...body.matchAll(/([A-Za-z_$][\w$]*)\.loadFile\s*\(/g)];
  assert.ok(calls.length > 0,
    '★핸들러 안에서 loadFile 호출을 못 찾았다 — 로드 방식이 바뀌었으면 «이 검사부터» 고쳐라(지우지 말고)');

  for (const c of calls) {
    const before = body.slice(Math.max(0, c.index - 40), c.index);
    assert.match(before, /await\s+$/,
      `★\`${c[1]}.loadFile(\` 앞에 await 가 없다.\n` +
      '  loadFile 은 Promise 를 돌려준다 — 파일이 없거나 로드가 깨지면 «비동기로» reject 하고,\n' +
      '  동기 try/catch 는 그걸 «못 잡는다». 그러면 main 은 {ok:true} 를 돌려주고 렌더러는 패널을 닫는다.\n' +
      '  ⇒ 사용자에게는 «닫을 길 없는 빈 창»(frame:false 라 신호등도 없다)만 남는다.\n' +
      '  ⛔.catch() 로 때우는 것은 «이 검사가 일부러 통과시키지 않는다»: .catch() 는 즉시 반환하니\n' +
      '    {ok:true} 가 「로드 성공」을 뜻하지 않게 되고, 결말이 지금 결함과 똑같아진다.\n' +
      '    이 IPC 의 {ok:true} 는 «창이 떴고 내용까지 실렸다» 를 뜻해야 한다.');
  }
});

/* ═══ T-c4 catch 가 «말을 하고» «빈 창을 치운다» ═════════════════════════════ */
test('T-c4 catch 는 { ok: false } 를 돌려주고 «반쯤 만들어진 창을 destroy» 한다', () => {
  const body = openWindowHandlerBody();
  /* catch 는 핸들러의 «마지막» 블록이라 거기서 끝까지를 본다. ⛔`\n  });` 로 끊으려 하지 마라 —
     핸들러의 닫는 줄은 `  }` + `});` 로 갈라져 있어서 안 걸린다(초판이 그렇게 빨개졌다).
     ⚠️«첫» catch 를 잡는다 — destroy() 는 자기 try/catch(e2) 로 감싸여 있어서
     lastIndexOf 로 잡으면 그 안쪽 catch 부터 보게 되고 destroy() 가 시야 밖으로 나간다(초판의 오탐). */
  const at = body.indexOf('catch');
  assert.notEqual(at, -1, '★catch 블록을 못 찾았다 — 실패를 «값으로» 만드는 자리가 사라졌다');
  const katch = body.slice(at);

  assert.match(katch, /ok\s*:\s*false/,
    '★catch 가 { ok: false } 를 안 돌려준다 — 렌더러가 실패를 «모르고» 토스트도 못 띄운다(침묵 실패)');
  assert.match(katch, /reason\s*:/,
    '★reason 이 없다 — 렌더러가 사용자에게 보여 줄 «읽을 수 있는 한 줄»이 사라진다');
  assert.match(katch, /\.destroy\s*\(/,
    '★catch 가 destroy() 를 안 부른다 — 로드가 깨진 창이 화면에 남는다.\n' +
    '  frame:false 라 그 창엔 신호등도 없고, 내용이 안 실렸으니 헤더 X 버튼도 없다 ⇒ «닫을 길이 아예 없다».');
});

/* ═══ T-c5 렌더러 — «성공을 확인한 뒤에만» 인앱 패널을 닫는다 ═════════════════ */
test('T-c5 ★팝아웃 핸들러는 try/catch 를 갖고, ok 를 확인한 «뒤에만» 인앱 패널을 닫는다', () => {
  const body = popoutHandlerBody();

  assert.match(body, /try\s*\{/,
    '★try 가 없다 — preload 누락·채널 미등록이면 await 가 «던지고», 토스트도 못 띄운 채 끝난다');
  assert.match(body, /catch\s*\(/,
    '★catch 가 없다 — 던져진 실패가 «침묵»한다(패널은 지키지만 사용자는 이유를 모른다)');

  const closes = [...body.matchAll(/closeTemplateBrowser\s*\(/g)];
  assert.equal(closes.length, 1,
    `★closeTemplateBrowser 호출이 ${closes.length}개다 — 닫는 자리는 «하나»여야 가드를 믿을 수 있다`);

  /* 닫는 «그 줄»이 ok 가드를 달고 있어야 한다. 무조건 닫기로 바뀌면 여기서 빨개진다. */
  const line = body.slice(body.lastIndexOf('\n', closes[0].index) + 1,
                          body.indexOf('\n', closes[0].index));
  assert.match(line, /if\s*\(/,
    `★«${line.trim()}» — 조건 없이 닫는다. 창이 안 떴는데 패널을 닫으면 사용자는 패널을 «잃는다»`);
  assert.match(line, /\bok\b/,
    `★«${line.trim()}» — 닫는 조건이 ok 를 안 본다. 「창이 떴다」를 확인하지 않고 닫는 셈이다`);
});
