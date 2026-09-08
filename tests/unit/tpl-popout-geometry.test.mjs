/* tpl-popout-geometry — 「템플릿 패널을 떼어낸다」의 «기하 계승»을 지킨다.
 *
 * ═══ 왜 이 파일이 있나 (2026-09-08, 현빈 실물 검수) ════════════════════════════
 * 현빈: 「앱 안에서 보던 비율이 확장버튼을 누르니 다른 비율로 되서 — «윈도우 패널이 플로팅된» 느낌」
 * 원인: 팝아웃 창이 `width: 420, height: 720` 을 «박아» 두고 패널 크기를 «안 봤다».
 *       그리고 자리도 안 받아서 «화면 가운데»에 떴다.
 *   ⇒ 사용자가 맞춰둔 크기가 버려지고, 「패널이 떨어져 나왔다」가 아니라 「새 창이 열렸다」가 된다.
 *
 * ═══ ★이 파일의 «세기» — 어디까지 «실행»으로 재나 ═════════════════════════════
 * 형제 파일 `tpl-open-window-await.test.mjs` 는 소스 문자열 단언이 대부분이고, 그 한계를
 * 스스로 적어 두었다(「하네스를 고치는 날 런타임으로 승격시켜라」). 이 판에서 하네스를
 * «추가만 해서» 고쳤다(BrowserWindow 옵션 포획 · screen.workArea · loadFile reject 주입).
 * 그래서 여기서는 대부분을 진짜로 «돌린다»:
 *
 *   G3  클램프  → `main/popout-geometry.js` 를 «import 해서 실행». 순수 함수라 100% 런타임.
 *   G2  크기계승→ 진짜 IPC 핸들러를 불러 «BrowserWindow 가 받은 옵션»을 읽는다.
 *   G1  preload → 화살표 함수 «소스를 꺼내 실행»하고 가짜 ipcRenderer 로 인자 통과를 잰다.
 *   G4  복구    → 렌더러 모듈을 가짜 DOM 에 싣고 applyTemplatePanelSize 를 «실행»,
 *                 main 의 _tplWinContentSize 는 «소스를 꺼내 실행»한다.
 *   G5  기존계약→ loadFile 을 «진짜로 reject 시켜» await·destroy·ok:false 를 런타임으로 잰다.
 *                 (형제 파일의 소스 단언은 그대로 둔다 — 배선이 옮겨졌는지도 알아야 한다.)
 *
 * ⛔표로 도는 검사에는 「입력이 살아 있다」를 «따로» 세웠다. 목록이 비면 0바퀴라 스스로 통과한다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { stripComments } from './_strip-comments.js';   // ★공용 주석 거르개(자기 벌을 만들면 S-6 이 빨개진다)

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { loadMain } = require('./_ipc-harness.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');

const {
  resolvePopoutBounds,
  POPOUT_DEFAULT_W, POPOUT_DEFAULT_H, POPOUT_MIN_W, POPOUT_MIN_H,
} = require(path.join(ROOT, 'main/popout-geometry.js'));


/* ⚠️★하네스는 «파일당 하나»다 — main.js 는 모듈 싱글턴이라 두 번째 loadMain() 은
     require 캐시에 막혀 ipcMain.handle 이 «한 번도 안 불린» 빈 핸들러 맵을 돌려준다
     (실측: 「IPC 채널 없음: templates:open-window」). 그래서 하나를 만들어 나눠 쓴다. */
const H = loadMain();

/** 다음 검사를 «창이 없는» 상태에서 시작한다 — 살아 있으면 핸들러가 reused:true 로 빠진다. */
function freshWin() {
  for (const w of H.stub.__windows) { try { w.destroy(); } catch { /* 이미 죽었으면 그만 */ } }
  H.stub.__windows.length = 0;
  H.stub.__loadFileFails = null;
  H.stub.__display = { workArea: WA, workAreaSize: { width: WA.width, height: WA.height } };
}

/* 1920×1080 에 맥 메뉴막대(25) 를 흉내낸 작업영역 */
const WA = { x: 0, y: 25, width: 1920, height: 1055 };

/* ═══════════════════════════════════════════════════════════════════════════
   G3 ★클램프 — 순수 함수를 «실행»해서 잰다
   ═══════════════════════════════════════════════════════════════════════════ */

test('G3-0 ★[전제] 순수 함수가 진짜로 실려 있다 — 이게 죽으면 아래 G3 은 전부 무의미하다', () => {
  assert.equal(typeof resolvePopoutBounds, 'function',
    '★main/popout-geometry.js 가 resolvePopoutBounds 를 안 내보낸다 — 클램프를 «실행»으로 잴 길이 사라졌다');
  assert.equal(POPOUT_MIN_W, 320);
  assert.equal(POPOUT_MIN_H, 360);
});

test('G3-1 ★크기를 «계승»한다 — 준 값이 그대로 나온다(기본값으로 덮어쓰지 않는다)', () => {
  const b = resolvePopoutBounds({ width: 640, height: 500, x: 300, y: 120 }, WA);
  assert.equal(b.width, 640, '★준 폭이 사라졌다 — 크기 계승이 죽었다');
  assert.equal(b.height, 500, '★준 높이가 사라졌다');
  assert.equal(b.centered, false, '★자리를 줬는데 중앙으로 물러났다');
  assert.equal(b.x, 300);
  assert.equal(b.y, 120);
});

test('G3-2 ★★클램프(하한) — MIN 아래 값은 «실행 결과»가 MIN 으로 올라온다', () => {
  const cases = [
    { in: { width: 10,  height: 10  }, why: '터무니없이 작은 값' },
    { in: { width: 0,   height: 0   }, why: '0' },
    { in: { width: -900, height: -900 }, why: '음수' },
    { in: { width: 319, height: 359 }, why: 'MIN 바로 아래(경계)' },
  ];
  /* ⛔목록이 비면 «0바퀴라 저절로 통과»한다 — 그래서 살아 있음을 «따로» 센다. */
  assert.ok(cases.length >= 4, '★검사 입력이 비었거나 줄었다 — 이 검사는 아무것도 안 재고 있다');

  for (const c of cases) {
    const b = resolvePopoutBounds({ ...c.in, x: 100, y: 100 }, WA);
    assert.ok(b.width >= POPOUT_MIN_W,
      `★${c.why}: width=${b.width} 가 하한 ${POPOUT_MIN_W} 아래다 — 헤더 버튼이 겹쳐 «되돌리기»조차 못 누른다`);
    assert.ok(b.height >= POPOUT_MIN_H,
      `★${c.why}: height=${b.height} 가 하한 ${POPOUT_MIN_H} 아래다`);
  }
});

test('G3-3 ★★클램프(상한) — 작업영역보다 큰 크기는 작업영역까지만', () => {
  const b = resolvePopoutBounds({ width: 99999, height: 99999, x: 0, y: 25 }, WA);
  assert.equal(b.width, WA.width,  '★화면보다 넓은 창이 만들어진다');
  assert.equal(b.height, WA.height, '★화면보다 높은 창이 만들어진다');
});

test('G3-4 ★★클램프(화면 밖) — 창 «전체»가 작업영역 안으로 끌려온다', () => {
  const cases = [
    { in: { x: 99999,  y: 99999  }, why: '오른쪽·아래로 한참 밖' },
    { in: { x: -5000,  y: -5000  }, why: '왼쪽·위로 한참 밖' },
    { in: { x: 1900,   y: 1070   }, why: '모서리에 걸쳐 «반쯤» 밖' },
  ];
  assert.ok(cases.length >= 3, '★검사 입력이 비었다 — 0바퀴로 저절로 통과할 뻔했다');

  for (const c of cases) {
    const b = resolvePopoutBounds({ width: 420, height: 720, ...c.in }, WA);
    assert.equal(b.centered, false, `★${c.why}: 자리를 줬는데 중앙으로 도망갔다`);
    assert.ok(b.x >= WA.x && b.x + b.width  <= WA.x + WA.width,
      `★${c.why}: x=${b.x} w=${b.width} — 창이 화면 «밖»으로 나간다. ` +
      'frame:false 라 신호등이 없어서 사용자는 그 창을 옮길 수도 닫을 수도 없다');
    assert.ok(b.y >= WA.y && b.y + b.height <= WA.y + WA.height,
      `★${c.why}: y=${b.y} h=${b.height} — 창이 화면 «밖»으로 나간다(잡을 데가 없다)`);
  }
});

test('G3-5 ★쓰레기 값은 «조용히» 기본값으로 물러난다 — 던지지 않는다', () => {
  const cases = [
    undefined, null, 42, 'nope', [],
    { width: NaN, height: NaN, x: NaN, y: NaN },
    { width: Infinity, height: -Infinity, x: Infinity, y: 0 },
    { width: '640', height: '500', x: '10', y: '10' },   // 문자열은 «숫자가 아니다»
    { width: null, height: undefined },
  ];
  assert.ok(cases.length >= 9, '★검사 입력이 비었다 — 이 검사는 아무것도 안 재고 있다');

  for (const c of cases) {
    let b;
    assert.doesNotThrow(() => { b = resolvePopoutBounds(c, WA); },
      `★${JSON.stringify(c)} 에 던졌다 — 렌더러가 보낸 쓰레기 하나로 팝아웃이 통째로 죽는다`);
    assert.equal(b.width, POPOUT_DEFAULT_W,
      `★${JSON.stringify(c)}: 크기를 못 읽었으면 기본값(${POPOUT_DEFAULT_W})으로 물러나야 한다 (얻은 값: ${b.width})`);
    assert.equal(b.height, POPOUT_DEFAULT_H, `★${JSON.stringify(c)}: 높이 기본값으로 안 물러났다`);
  }
});

test('G3-6 좌표가 «반쪽»이면 자리를 통째로 버린다 — 반쪽 좌표는 중앙보다 나쁘다', () => {
  const half = [
    { width: 500, height: 500, x: 100 },              // y 없음
    { width: 500, height: 500, y: 100 },              // x 없음
    { width: 500, height: 500, x: 100, y: NaN },      // y 가 NaN
  ];
  assert.ok(half.length >= 3, '★검사 입력이 비었다');
  for (const c of half) {
    const b = resolvePopoutBounds(c, WA);
    assert.equal(b.centered, true, `★${JSON.stringify(c)}: 반쪽 좌표로 창을 앉혔다`);
    assert.equal(b.width, 500, '★자리를 버렸다고 «크기»까지 버리면 안 된다');
  }
});

test('G3-7 작업영역을 «모르면» 크기만 계승하고 자리는 중앙 — 화면 밖에 앉히느니 중앙이 낫다', () => {
  const bad = [undefined, null, {}, { x: 0, y: 0 }, { width: 10, height: 10, x: 0, y: 0 }];
  assert.ok(bad.length >= 5, '★검사 입력이 비었다');
  for (const wa of bad) {
    const b = resolvePopoutBounds({ width: 640, height: 500, x: 300, y: 120 }, wa);
    assert.equal(b.centered, true, `★workArea=${JSON.stringify(wa)} 인데 자리를 앉혔다 — 가둘 데가 없으니 화면 밖일 수 있다`);
    assert.equal(b.width, 640, '★크기까지 버릴 이유는 없다');
  }
});

test('G3-8 원점이 음수인 화면(왼쪽 보조 모니터)에서도 그 화면 «안»에 앉는다', () => {
  const left = { x: -1680, y: 0, width: 1680, height: 1050 };
  const b = resolvePopoutBounds({ width: 420, height: 720, x: -1500, y: 100 }, left);
  assert.equal(b.centered, false);
  assert.ok(b.x >= left.x && b.x + b.width <= left.x + left.width,
    `★x=${b.x} — 보조 모니터의 작업영역 밖으로 나갔다(주 모니터 기준으로 잘랐다는 뜻)`);
});

/* ═══════════════════════════════════════════════════════════════════════════
   G1 preload — 인자를 «받아서 그대로» 넘긴다
   ═══════════════════════════════════════════════════════════════════════════ */

/** preload.js 에서 openTemplateWindow 화살표 함수의 «소스»를 꺼낸다. */
function preloadOpenArrow() {
  const src = stripComments(readSrc(ROOT, 'preload.js'));
  const m = src.match(/openTemplateWindow\s*:\s*(\([^)]*\)\s*=>\s*ipcRenderer\.invoke\([^;]*?\))\s*,/);
  assert.ok(m, '★preload 의 openTemplateWindow 를 못 찾았다 — 모양이 바뀌었으면 «이 검사부터» 고쳐라(지우지 말고)');
  return m[1];
}

test('G1 ★preload 의 openTemplateWindow 는 인자를 «받아 그대로» 넘긴다 (실행으로 잰다)', () => {
  const arrow = preloadOpenArrow();
  assert.doesNotMatch(arrow, /^\(\s*\)\s*=>/,
    `★«${arrow}» — 인자를 «아예 안 받는다». 그러면 렌더러가 잰 크기·자리가 preload 에서 버려진다`);

  const seen = [];
  const ipcRenderer = { invoke: (...a) => { seen.push(a); return Promise.resolve({ ok: true }); } };
  const fn = new Function('ipcRenderer', `return (${arrow});`)(ipcRenderer);

  const geom = { width: 640, height: 500, x: 300, y: 120 };
  fn(geom);
  assert.equal(seen.length, 1, '★invoke 가 안 불렸다');
  assert.equal(seen[0][0], 'templates:open-window', '★채널이 바뀌었다');
  assert.deepEqual(seen[0][1], geom,
    '★받은 값이 그대로 안 넘어갔다 — preload 에서 «해석»하면 안전선이 두 곳으로 갈린다(판단은 main 이 쥔다)');
  assert.equal(seen[0][1], geom, '★사본을 만들어 넘겼다 — 통과만 시켜라');

  /* 인자를 «안» 줘도 깨지지 않아야 한다(구 호출처 호환) */
  fn();
  assert.equal(seen[1][1], undefined, '★인자 없이 부르면 undefined 가 그대로 가야 한다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   G2 main 핸들러 — «받은 크기·자리»로 창을 만든다 (진짜 핸들러를 부른다)
   ═══════════════════════════════════════════════════════════════════════════ */

test('G2 ★★핸들러가 «받은» 크기·자리로 창을 만든다 — 420×720 리터럴로 되돌리면 여기서 빨개진다', async () => {
  freshWin();

  const geom = { width: 640, height: 512, x: 244, y: 69 };
  const r = await H.invoke('templates:open-window', geom);
  assert.deepEqual(r, { ok: true, reused: false }, '★성공 계약이 깨졌다');

  assert.equal(H.stub.__windows.length, 1, '★창이 정확히 한 개 만들어져야 한다');
  const o = H.stub.__windows[0].__opts;

  assert.equal(o.width, 640,
    `★창을 width=${o.width} 로 만들었다 — 렌더러가 보낸 640 을 «안 봤다». ` +
    `기본값(${POPOUT_DEFAULT_W})이 나왔다면 크기 계승이 통째로 죽은 것이다`);
  assert.equal(o.height, 512, `★창을 height=${o.height} 로 만들었다 — 512 를 «안 봤다»`);
  assert.equal(o.x, 244, `★x=${o.x} — 패널이 있던 자리를 «안 봤다»(중앙에 뜬다 = 「새 창이 열렸다」로 보인다)`);
  assert.equal(o.y, 69,  `★y=${o.y} — 패널이 있던 자리를 «안 봤다»`);
  assert.ok(!o.center, '★자리를 정했는데 center:true 도 같이 줬다 — 어느 쪽이 이길지 알 수 없다');

  assert.equal(o.minWidth, POPOUT_MIN_W, '★minWidth 하한이 사라졌다');
  assert.equal(o.minHeight, POPOUT_MIN_H, '★minHeight 하한이 사라졌다');
  assert.equal(o.frame, false, '★frame:false 를 되돌리면 안 된다 — 현빈이 「신호등 없애라」고 한 결과다');
});

test('G2-b ★핸들러도 «화면 밖»을 막는다 — 클램프가 진짜 배선에 걸려 있다', async () => {
  freshWin();

  await H.invoke('templates:open-window', { width: 99999, height: 99999, x: 99999, y: 99999 });
  const o = H.stub.__windows[0].__opts;
  assert.ok(o.width <= WA.width && o.height <= WA.height,
    `★${o.width}×${o.height} — 화면보다 큰 창을 만들었다`);
  assert.ok(o.x >= WA.x && o.x + o.width <= WA.x + WA.width,
    `★x=${o.x} — 창이 화면 밖에 뜬다. frame:false 라 «잡을 데가 없다»`);
  assert.ok(o.y >= WA.y && o.y + o.height <= WA.y + WA.height, `★y=${o.y} — 창이 화면 밖에 뜬다`);
});

test('G2-c 기하를 «안 주면» 예전처럼 기본값·중앙 — 옛 호출처가 깨지지 않는다', async () => {
  freshWin();
  H.stub.__display = null;   // 기본 작업영역(0,0,1920,1080) 으로
  const r = await H.invoke('templates:open-window');
  assert.deepEqual(r, { ok: true, reused: false });
  const o = H.stub.__windows[0].__opts;
  assert.equal(o.width, POPOUT_DEFAULT_W);
  assert.equal(o.height, POPOUT_DEFAULT_H);
  assert.equal(o.center, true, '★자리를 모르면 중앙에 띄워야 한다');
  assert.ok(!('x' in o) && !('y' in o), '★자리를 모르는데 x/y 를 박았다');
});

test('G2-d 렌더러가 «지금» 크기를 재서 보낸다 — localStorage 가 아니라 getBoundingClientRect', () => {
  const src = readSrc(ROOT, 'js/panels/template-browser.js');
  const m = src.match(/function _tplPanelGeometry\(\)[\s\S]*?\n\}/);
  assert.ok(m, '★_tplPanelGeometry 를 못 찾았다 — 배선이 옮겨졌으면 «이 검사부터» 고쳐라');
  const body = stripComments(m[0]);
  assert.match(body, /getBoundingClientRect\s*\(/,
    '★getBoundingClientRect 가 사라졌다 — 「지금 보고 있는」 크기가 아니게 된다');
  assert.doesNotMatch(body, /localStorage/,
    '★localStorage 를 읽는다 — 사용자가 방금 늘렸는데 아직 저장 안 된 크기를 놓친다(자리는 애초에 저장되지도 않는다)');
  assert.match(body, /screenX/, '★screenX 가 없다 — 화면 좌표를 못 만든다');
  assert.match(body, /screenY/, '★screenY 가 없다 — 화면 좌표를 못 만든다');

  /* 그 값이 «실제로 넘어가는지» — 팝아웃 클릭 핸들러가 인자 없이 부르면 계승이 죽는다 */
  const h = src.match(/document\.getElementById\('tpl-browser-popout'\)[\s\S]*?\n {2}\}\);/);
  assert.ok(h, '★#tpl-browser-popout 클릭 핸들러를 못 찾았다');
  const hb = stripComments(h[0]);
  assert.match(hb, /openTemplateWindow\?\.\(\s*_tplPanelGeometry\(\)\s*\)/,
    '★openTemplateWindow 를 «인자 없이» 부른다 — 잰 크기·자리가 여기서 버려진다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   G4 복구 — 창의 «지금» 크기를 패널에 되돌린다 (왕복 대칭)
   ═══════════════════════════════════════════════════════════════════════════ */

/** main.js 의 _tplWinContentSize 를 «꺼내서 실행»한다(_tplWin 만 참조하는 함수다). */
function loadTplWinContentSize() {
  const src = readSrc(ROOT, 'main.js');
  const m = src.match(/function _tplWinContentSize\(\)[\s\S]*?\n\}/);
  assert.ok(m, '★_tplWinContentSize 를 못 찾았다 — 창 크기를 재는 자리가 사라졌다면 복구가 크기를 못 되돌린다');
  return new Function('_tplWin', `${m[0]}\nreturn _tplWinContentSize();`);
}

test('G4-a ★창의 «지금» 크기를 읽는다 — 이상하면 null 로 물러난다 (실행으로 잰다)', () => {
  const read = loadTplWinContentSize();

  const live = { isDestroyed: () => false, getContentBounds: () => ({ x: 10, y: 20, width: 640, height: 540 }) };
  assert.deepEqual(read(live), { width: 640, height: 540 },
    '★창의 지금 크기를 못 읽는다 — 복구가 옛 크기(또는 기본값)로 되돌려 왕복이 어긋난다');

  const bad = [
    { why: '창이 없다',        win: null },
    { why: '이미 죽었다',      win: { isDestroyed: () => true, getContentBounds: () => ({ width: 640, height: 540 }) } },
    { why: 'API 가 없다',      win: { isDestroyed: () => false } },
    { why: '0 을 돌려준다',    win: { isDestroyed: () => false, getContentBounds: () => ({ width: 0, height: 0 }) } },
    { why: 'NaN 을 돌려준다',  win: { isDestroyed: () => false, getContentBounds: () => ({ width: NaN, height: NaN }) } },
    { why: '던진다',           win: { isDestroyed: () => false, getContentBounds: () => { throw new Error('boom'); } } },
  ];
  assert.ok(bad.length >= 6, '★검사 입력이 비었다 — 0바퀴로 저절로 통과할 뻔했다');
  for (const c of bad) {
    assert.equal(read(c.win), null, `★${c.why}: null 이 아니다 — 패널을 0px 로 찌그러뜨릴 수 있다`);
  }
});

test('G4-b ★복구 핸들러가 «그 크기»를 편집기로 넘긴다', () => {
  const src = readSrc(ROOT, 'main.js');
  const m = src.match(/ipcMain\.handle\(\s*'templates:restore-panel'[\s\S]*?\n\}\);/);
  assert.ok(m, "★templates:restore-panel 핸들러를 못 찾았다 — 채널이 바뀌었으면 «이 검사부터» 고쳐라");
  const body = stripComments(m[0]);
  assert.ok(body.includes('_callEditorCommand'), '★주석을 지우다가 본문까지 지웠다 — 이 검사는 무효다');

  assert.match(body, /_tplWinContentSize\s*\(/,
    '★복구가 창 크기를 «안 잰다» — 떼었다 붙일 때마다 패널이 원래 크기로 돌아간다(왕복 비대칭)');
  assert.match(body, /_callEditorCommand\(\s*\{[^}]*open-panel[^}]*\.\.\./,
    '★잰 크기를 open-panel 명령에 «안 실었다» — 재기만 하고 안 쓰면 아무 일도 안 일어난다');

  /* 순서 — 창을 닫은 «뒤»에 재면 이미 못 읽는다 */
  assert.ok(body.indexOf('_tplWinContentSize') < body.indexOf('.close('),
    '★창을 닫은 «뒤»에 크기를 잰다 — 그때는 이미 읽을 수 없다');
});

test('G4-c ★편집기가 받은 크기를 패널에 «입힌다» (가짜 DOM 에서 실행으로 잰다)', () => {
  const src = readSrc(ROOT, 'js/panels/template-browser.js');
  const panel = { style: {}, dataset: {}, getBoundingClientRect: () => ({ width: 420, height: 700, left: 244, top: 44 }) };
  const store = new Map();
  const win = { innerHeight: 1000, innerWidth: 1600, screenX: 0, screenY: 0 };
  const doc = { getElementById: (id) => (id === 'tpl-browser' ? panel : null), addEventListener() {}, removeEventListener() {} };
  const ls = { getItem: (k) => (store.has(k) ? store.get(k) : null), setItem: (k, v) => store.set(k, String(v)) };
  const api = new Function('window', 'document', 'localStorage', 'requestAnimationFrame',
    `${src}\nreturn { applyTemplatePanelSize, _tplPanelGeometry };`)(win, doc, ls, () => {});

  assert.equal(typeof api.applyTemplatePanelSize, 'function',
    '★applyTemplatePanelSize 가 없다 — 창 크기를 패널에 되돌릴 «손»이 사라졌다');

  assert.equal(api.applyTemplatePanelSize(640, 540), true);
  assert.equal(panel.style.width, '640px', '★패널 폭이 안 바뀌었다 — 복구할 때마다 크기가 어긋난다');
  assert.equal(panel.style.height, '540px', '★패널 높이가 안 바뀌었다');
  assert.deepEqual(JSON.parse(store.get('tpl-browser-size')), { w: 640, h: 540 },
    '★localStorage 에 안 남겼다 — 다음에 패널을 열면 다시 옛 크기로 돌아간다');

  /* 인앱 패널의 한계 안으로 — 창은 화면만큼 커질 수 있지만 패널은 편집기 창 «안»에 산다 */
  api.applyTemplatePanelSize(5000, 5000);
  assert.equal(panel.style.width, '700px', `★패널 폭 상한(700)을 넘겼다 — 얻은 값: ${panel.style.width}`);
  assert.equal(panel.style.height, '900px', `★패널 높이가 창 높이의 90%를 넘겼다 — 얻은 값: ${panel.style.height}`);

  /* 값이 이상하면 «아무것도 안 한다» — 0px 패널을 만들면 되돌아올 길이 없다 */
  const bad = [[undefined, undefined], [NaN, NaN], [0, 0], [-100, -100], ['x', 'y'], [null, 540]];
  assert.ok(bad.length >= 6, '★검사 입력이 비었다');
  for (const [w, h] of bad) {
    panel.style.width = 'SENTINEL'; panel.style.height = 'SENTINEL';
    assert.equal(api.applyTemplatePanelSize(w, h), false, `★(${w}, ${h}) 를 받아들였다`);
    assert.equal(panel.style.width, 'SENTINEL', `★(${w}, ${h}) 로 패널 폭을 건드렸다`);
    assert.equal(panel.style.height, 'SENTINEL', `★(${w}, ${h}) 로 패널 높이를 건드렸다`);
  }
});

test('G4-d ★편집기의 open-panel 명령이 그 손을 «부른다» — 배선이 이어져 있다', () => {
  const src = readSrc(ROOT, 'js/panels/template-system.js');
  const m = src.match(/if\s*\(p\.action === 'open-panel'\)\s*\{[\s\S]*?\n {4}\}/);
  assert.ok(m, "★__tplEditorCommand 의 open-panel 분기를 못 찾았다 — 배선이 옮겨졌으면 «이 검사부터» 고쳐라");
  const body = stripComments(m[0]);
  assert.ok(body.includes('openTemplateBrowser'), '★주석을 지우다가 본문까지 지웠다 — 이 검사는 무효다');
  assert.match(body, /applyTemplatePanelSize\?\.\(\s*p\.width\s*,\s*p\.height\s*\)/,
    '★open-panel 이 받은 크기를 패널에 «안 입힌다» — main 이 크기를 보내도 아무 일이 안 일어난다');
});

/* ═══════════════════════════════════════════════════════════════════════════
   G5 기존 계약 3건 — ★소스 단언(형제 파일)에서 «런타임»으로 승격시킨다
   ═══════════════════════════════════════════════════════════════════════════ */

test('G5 ★★loadFile 이 «비동기로» 깨져도 main 이 잡는다 — await·destroy·ok:false 를 실행으로 잰다', async () => {
  freshWin();
  H.stub.__loadFileFails = 'ERR_FILE_NOT_FOUND (-6)';

  const r = await H.invoke('templates:open-window', { width: 640, height: 512, x: 244, y: 69 });

  assert.equal(r.ok, false,
    '★로드가 깨졌는데 {ok:true} 를 돌려줬다 — await 가 빠지면 정확히 이렇게 된다.\n' +
    '  그러면 렌더러는 그 말을 믿고 인앱 패널을 «닫고», 사용자에게는 내용 없는 창만 남는다');
  assert.ok(r.reason, '★reason 이 없다 — 사용자에게 보여 줄 «읽을 수 있는 한 줄»이 사라졌다');

  assert.equal(H.stub.__windows.length, 1, '★창은 만들어졌어야 한다(그래야 「치웠나」를 잴 수 있다)');
  assert.equal(H.stub.__windows[0].__destroyed, true,
    '★깨진 창을 destroy 하지 않았다 — frame:false 라 신호등도 없고 내용도 안 실려 X 버튼도 없다.\n' +
    '  ⇒ 사용자는 «닫을 길이 아예 없는 빈 창»을 떠안는다');

  /* 참조를 놓았으니 다음 호출은 «새 창»이어야 한다(reused 가 아니다) */
  H.stub.__loadFileFails = null;
  const again = await H.invoke('templates:open-window');
  assert.deepEqual(again, { ok: true, reused: false },
    '★죽은 창 참조를 붙잡고 있다 — 팝아웃이 다시 안 열린다');
});
