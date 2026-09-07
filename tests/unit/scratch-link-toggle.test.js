/* #16 스크래치패드 — 「연결선 표시」 토글(B) · 「일괄 숨기기」(C) 게이트
 *
 * 현빈 발주(2026-09-07 밤)
 *   B. 섹션↔스크래치패드 연결을 점선으로 · ★톱니바퀴에서 껐다 켰다
 *   C. 스크래치패드 일괄 숨기기 (산만할 때)
 *
 * ★이 검사가 «겨누는 것»
 *   B 는 「선을 그리는 일」이 아니었다 — 점선(dasharray 5 5)도 스위치(setShowEdges)도 이미 있었고,
 *   ⛔없던 것은 «스위치를 UI 에 붙이는 자리»와 «기억»이다. 그래서 처방이 «둘»이고 검사도 «둘»이다:
 *     ① 토글이 화면에 있고 그 스위치를 부른다   ② 저장되고 «부팅 시» 다시 적용된다
 *   C 는 「지우기」가 아니라 「표시만 끄기」다. 그래서 «데이터를 안 건드린다»를 같이 잰다.
 *
 * ★대역(mock)을 세우지 않는다 — 원문에서 «몸통을 떼어» 실제로 돌린다
 *   (debug-port-badge-gate.test.js 와 같은 방식). 원문이 바뀌면 여기가 빨개진다.
 *
 * ⛔이 검사가 «안» 보는 것 (정직하게 적는다)
 *   · 실기(Electron) 에서 실제로 선이 사라지는지 — ⛔현빈 실사용 PC라 창을 띄우지 않았다. «안 쟀다».
 *   · 톱니바퀴를 눌러 모달이 열리고 탭이 전환되는 상호작용 — 렌더 없이 못 잰다. «안 쟀다».
 *   · 저장이 디스크(settings.json)에 실제로 쓰이는지 — writeSettings 는 별건이라 «안 쟀다»
 *     (여기서 재는 것은 「patch 에 키가 실려 나가는가」까지다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert');
const path = require('path');
const { readSrc } = require('./_srcread.js');

const ROOT = path.join(__dirname, '..', '..');
const SRC = {
  main:   readSrc(ROOT, 'main.js'),
  store:  readSrc(ROOT, 'js', 'settings', 'settings-store.js'),
  modal:  readSrc(ROOT, 'js', 'settings', 'settings-modal.js'),
  link:   readSrc(ROOT, 'js', 'scratchpad-link.js'),
  scratch:readSrc(ROOT, 'js', 'scratch-pad.js'),
  css:    readSrc(ROOT, 'css', 'editor-canvas.css'),
  html:   readSrc(ROOT, 'index.html'),
};

/* ⛔「주석 줄인가」는 «구문»으로 판정한다(// · * · /*).
 *   ★장식 문자(★·⛔)로 거르면 안 된다 — 2026-09-07 그렇게 걸렀다가 «금지 주석»을 위반으로 세어
 *     dev 를 빨갛게 만든 사고가 났다(6ed5295). 필터도 판정기다. */
function isCommentLine(line) {
  const t = line.trimStart();
  return t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}
/** 주석을 «구문으로» 걷어낸 소스 (문자열 훑기 전용) */
function codeOnly(src) {
  return src.split('\n').filter(l => !isCommentLine(l)).join('\n');
}

/** `needle` 로 시작하는 함수/화살표의 «중괄호 몸통»을 원문에서 떼어낸다. */
function bodyAfter(src, needle, label) {
  const i = src.indexOf(needle);
  assert.notStrictEqual(i, -1, `★"${label}" 를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라`);
  const start = src.indexOf('{', i + needle.length - 1);
  assert.notStrictEqual(start, -1, `★"${label}" 의 몸통 시작 { 을 못 찾았다`);
  let depth = 0, j = start;
  for (; j < src.length; j++) {
    if (src[j] === '{') depth++;
    else if (src[j] === '}') { depth--; if (depth === 0) break; }
  }
  assert.ok(j < src.length, `★"${label}" 의 몸통 끝을 못 찾았다`);
  return src.slice(start + 1, j);
}

// ══════════════════════════════════════════════════════════════════
// 0) 양성대조 — 이 검사가 «실제로» 그 파일들을 읽고 있다
// ══════════════════════════════════════════════════════════════════
test('★양성대조 — 일곱 파일을 실제로 읽고 있다 (0건이 «못 읽어서»가 아니다)', () => {
  assert.match(SRC.main,    /const DEFAULT_SETTINGS = \{/,        '★main.js 를 못 읽고 있다');
  assert.match(SRC.store,   /const FALLBACK = \{/,                '★settings-store.js 를 못 읽고 있다');
  assert.match(SRC.modal,   /function renderPerfPane\s*\(/,       '★settings-modal.js 를 못 읽고 있다');
  assert.match(SRC.link,    /function setShowEdges\s*\(/,         '★scratchpad-link.js 를 못 읽고 있다');
  assert.match(SRC.scratch, /window\._scratchAddAndSave = async/, '★scratch-pad.js 를 못 읽고 있다');
  assert.match(SRC.css,     /\.scratch-item \{/,                  '★editor-canvas.css 를 못 읽고 있다');
  assert.match(SRC.html,    /scratchpad-folder-input/,            '★index.html 을 못 읽고 있다');
});

test('★필터 대조 — 「주석 줄」 판정기가 살아 있다 (금지 주석은 건너뛰고 진짜 코드는 잡는다)', () => {
  for (const c of [
    '  // ⛔_scratchRemoveById 를 부르지 마라',
    '   * ★_scratchRemoveById 호출 0',
    '/* window._scratchRemoveById(id) 는 데이터를 지운다 */',
  ]) assert.equal(isCommentLine(c), true, `★금지 주석을 «코드»로 세고 있다: ${c}`);
  for (const c of [
    '      await window._scratchRemoveById(id);',
    'document.body.classList.toggle("scratch-hidden-all", next);',
  ]) assert.equal(isCommentLine(c), false, `★진짜 코드를 «건너뛰고» 있다: ${c}`);
});

// ══════════════════════════════════════════════════════════════════
// B-① 스위치가 «UI 에 붙었다» — 없던 것이 바로 이 자리다
// ══════════════════════════════════════════════════════════════════
test('B① 환경설정에 「연결선 표시」 체크박스가 있고, 그게 SPLink 스위치를 «부른다»', () => {
  const perf = bodyAfter(SRC.modal, 'function renderPerfPane', 'renderPerfPane');
  assert.match(perf, /id="settings-show-link-edges"/,
    '★체크박스가 없다 — 스위치(setShowEdges)가 다시 «파일 밖 참조 0» 으로 돌아갔다');
  assert.match(perf, /type="checkbox"/, '★기존 토글 어휘(type="checkbox")를 안 따랐다');
  assert.match(perf, /settings-egg-toggle/, '★공용 클래스를 안 썼다 (새 CSS 를 만들었나?)');

  const code = codeOnly(SRC.modal);
  assert.match(code, /window\.SPLink\?\.setShowEdges\?\.\(/,
    '★저장해도 «지금 화면»에 반영되지 않는다 — setShowEdges 호출이 없다');
  // ⛔새 탭 금지 — 탭 목록이 늘지 않았다
  const tabs = [...SRC.modal.matchAll(/class="settings-tab[^"]*" data-tab="([a-z]+)"/g)].map(m => m[1]);
  assert.deepEqual(tabs.sort(), ['api', 'collab', 'dev', 'easter', 'market', 'perf', 'shortcuts', 'version'],
    '★탭이 늘거나 줄었다 — 새 탭을 만들지 않기로 했다');
});

// ══════════════════════════════════════════════════════════════════
// B-② «기억»한다 — 저장되고, 부팅 시 다시 적용된다
// ══════════════════════════════════════════════════════════════════
test('B② 저장 patch 에 showScratchLinkEdges 가 실린다 (앱을 껐다 켜도 남으려면 여기부터)', () => {
  const onSave = bodyAfter(SRC.modal, 'async function onSave', 'onSave');
  assert.match(codeOnly(onSave), /showScratchLinkEdges:\s*_draft\.showScratchLinkEdges !== false/,
    '★저장이 안 실린다 = 「기억」이 없다. 그리고 «=== true» 로 읽으면 기본 ON 이 깨진다');
  const open = bodyAfter(SRC.modal, 'window.openSettingsModal = function', 'openSettingsModal');
  assert.match(codeOnly(open), /showScratchLinkEdges:\s*cur\.showScratchLinkEdges !== false/,
    '★모달을 열 때 draft 에 «현재 값»이 안 실린다 → 저장하면 항상 기본값으로 되돌아간다');
});

test('B② 기본값이 «두 벌 다» ON 이다 (main 정본 + 렌더러 FALLBACK)', () => {
  assert.match(codeOnly(SRC.main),  /showScratchLinkEdges:\s*true/,
    '★main.js DEFAULT_SETTINGS 에 기본값이 없다 — 키 없는 기존 사용자가 선을 잃는다');
  assert.match(codeOnly(SRC.store), /showScratchLinkEdges:\s*true/,
    '★settings-store FALLBACK 에 기본값이 없다 (기본값이 두 벌인 구조 — 갈리면 안 된다)');
});

test('B② 부팅 시 저장값을 «실제로» setShowEdges 에 넣는다 — 원문 몸통을 떼어 돌린다', () => {
  const body = bodyAfter(SRC.link, 'function _applySavedShowEdges', '_applySavedShowEdges');
  const run = (settings) => {
    const calls = [];
    const fn = new Function('window', 'setShowEdges', body);
    const ret = fn({ _settings: settings }, v => calls.push(v));
    return { calls, ret };
  };
  assert.deepEqual(run({ showScratchLinkEdges: false }).calls, [false], '★OFF 저장값이 부팅에 안 먹는다');
  assert.deepEqual(run({ showScratchLinkEdges: true  }).calls, [true],  '★ON 저장값이 부팅에 안 먹는다');
  // ⚠️키가 «없으면» ON 이다 — 기본값이 true 라서. undefined 를 OFF 로 읽으면 기존 사용자의 선이 사라진다.
  assert.deepEqual(run({}).calls, [true], '★키가 없는(=업데이트 직후) 사용자에게서 선이 사라진다');
  // 설정이 아직 «안 왔을» 때는 아무것도 안 한다 — 리스너가 나중에 받아준다
  assert.deepEqual(run(undefined).calls, [], '★설정이 오기도 전에 스위치를 건드린다');
  assert.strictEqual(run(undefined).ret, false, '★「아직 못 읽었다」를 «못 읽었다»로 돌려주지 않는다');
});

test('B② 적용 시점이 «두 자리» 다 걸려 있다 (로드 순서가 보장되지 않는다)', () => {
  const code = codeOnly(SRC.link);
  const boot = bodyAfter(SRC.link, 'function _boot', '_boot');
  assert.match(codeOnly(boot), /_applySavedShowEdges\(\)/,
    '★_boot 에서 안 읽는다 — settings:ready 가 «먼저» 지나간 경우 저장값이 무시된다');
  assert.match(code, /addEventListener\('settings:ready',\s*_applySavedShowEdges\)/,
    "★settings:ready 리스너가 없다 — 설정이 «늦게» 오면 저장값이 무시된다");
  assert.match(code, /addEventListener\('settings:changed',\s*_applySavedShowEdges\)/,
    '★settings:changed 리스너가 없다 — 다른 창/경로의 저장이 반영되지 않는다');
});

test('B 점선은 «이미 있던 것»이다 — 새로 그리지 않았는지 확인 (dasharray 보존)', () => {
  const extra = readSrc(ROOT, 'css', 'editor-extra.css');
  assert.match(extra, /\.spl-edges line\s*\{[^}]*stroke-dasharray/,
    '★점선 규칙이 사라졌다 — 이미 있던 것을 지우고 다시 만들지 마라');
});

// ══════════════════════════════════════════════════════════════════
// C 일괄 숨기기 — «표시만» 끈다
// ══════════════════════════════════════════════════════════════════
test('C 토글이 body 클래스를 켰다 껐다 한다 — 원문 몸통을 떼어 돌린다', () => {
  const body = bodyAfter(SRC.scratch, 'window.toggleScratchHideAll = (force)', 'toggleScratchHideAll');
  const ctx = { hidden: false, cls: new Set(), toasts: 0, relayouts: 0, labels: 0 };
  const fn = new Function('ctx', 'force', `
    let _scratchHiddenAll = ctx.hidden;
    const document = { body: { classList: { toggle(c, on) { if (on) ctx.cls.add(c); else ctx.cls.delete(c); } } } };
    const window = { __spLinkRelayout: () => { ctx.relayouts++; }, showToast: () => { ctx.toasts++; } };
    const _syncScratchHideAllLabel = () => { ctx.labels++; };
    const r = (function (force) { ${body} })(force);
    ctx.hidden = _scratchHiddenAll;
    return r;
  `);

  assert.strictEqual(fn(ctx, undefined), true, '★첫 호출이 «숨김»을 반환하지 않는다');
  assert.ok(ctx.cls.has('scratch-hidden-all'), '★body 클래스가 안 붙는다 = 아무것도 안 숨겨진다');
  assert.strictEqual(fn(ctx, undefined), false, '★두 번째 호출이 «다시 보기»로 안 돌아온다');
  assert.ok(!ctx.cls.has('scratch-hidden-all'), '★다시 보기인데 클래스가 안 떨어진다');
  // 강제 지정도 먹는다
  assert.strictEqual(fn(ctx, true), true);
  assert.strictEqual(fn(ctx, true), true, '★force=true 를 두 번 주면 «토글»돼 버린다');
  assert.ok(ctx.relayouts >= 4, '★연결선 재계산을 안 부른다 → 숨긴 뒤 선이 «허공에» 남는다');
  assert.ok(ctx.toasts >= 4, '★아무 피드백이 없다 — 사용자가 「지워졌나」로 읽는다');
  assert.ok(ctx.labels >= 4, '★메뉴 라벨이 상태를 안 따라간다');
});

test('C ⛔데이터를 «절대» 안 건드린다 (표시만 끈다)', () => {
  const body = bodyAfter(SRC.scratch, 'window.toggleScratchHideAll = (force)', 'toggleScratchHideAll');
  const code = codeOnly(body);                       // ⛔주석은 «구문으로» 걷어낸 뒤 센다
  for (const bad of ['_scratchRemoveById', '_scratchAddAndSave', '_saveScratch', 'indexedDB', 'delete(']) {
    assert.ok(!code.includes(bad), `★숨기기가 데이터를 건드린다: ${bad}`);
  }
  // ★양성대조 — 그 이름들이 «이 파일에는» 실제로 있다(오타난 매처가 조용히 통과하는 것 방지)
  assert.ok(SRC.scratch.includes('_scratchRemoveById'), '★대조 실패 — 이름 자체가 파일에 없다');
  assert.ok(SRC.scratch.includes('_scratchAddAndSave'), '★대조 실패 — 이름 자체가 파일에 없다');
});

test('C 숨김 규칙은 CSS 한 줄이다 (새 색·새 간격 0)', () => {
  assert.match(SRC.css, /body\.scratch-hidden-all \.scratch-item \{ display: none; \}/,
    '★숨김 규칙이 없다 = 클래스를 붙여도 아무 일도 안 난다');
  const rule = SRC.css.match(/body\.scratch-hidden-all \.scratch-item \{([^}]*)\}/)[1];
  assert.ok(!/#[0-9a-fA-F]{3,8}|rgba?\(|px|--/.test(rule),
    `★숨김 규칙에 새 색·간격·토큰이 들어갔다: ${rule.trim()}`);
});

test('C 입구가 «있다» — 툴바 메뉴에서 그 함수를 부른다', () => {
  assert.match(SRC.html, /id="scratch-hide-all-item"/, '★입구가 없다 — 사용자가 부를 방법이 0');
  assert.match(SRC.html, /onclick="window\.toggleScratchHideAll\?\.\(\)/, '★버튼이 토글을 안 부른다');
  assert.match(SRC.html, /class="pub-dd-item" id="scratch-hide-all-item"/,
    '★기존 메뉴 어휘(pub-dd-item)를 안 따랐다 = 새 CSS 를 만들었다는 뜻');
  assert.match(SRC.html, /id="scratch-hide-all-label"/, '★라벨 자리가 없다 → 상태를 못 보여준다');
});

test('C 숨긴 동안 연결선이 «허공에» 남지 않는다 — 원문의 가드 줄을 그대로 돌린다', () => {
  const draw = bodyAfter(SRC.link, 'function _drawEdges', '_drawEdges');
  const line = draw.split('\n').find(l => !isCommentLine(l) && l.includes('continue') && l.includes('ir.width'));
  assert.ok(line, '★0×0 가드가 없다 — display:none 인 스크래치로 선이 (0,0) 까지 뻗는다');
  const guard = new Function('ir', 'sr', `let hit = false; ${line.replace('continue', 'hit = true')}; return hit;`);
  const R = (w, h) => ({ width: w, height: h, left: 0, top: 0, right: w, bottom: h });
  assert.strictEqual(guard(R(0, 0), R(300, 500)), true,  '★숨겨진 스크래치인데 선을 계속 긋는다');
  assert.strictEqual(guard(R(220, 140), R(0, 0)), true,  '★숨겨진 섹션인데 선을 계속 긋는다');
  assert.strictEqual(guard(R(220, 140), R(300, 500)), false, '★멀쩡한 쌍의 선까지 지운다(과잉 차단)');
});

test('C 상태는 «세션 한정»이다 — 저장 경로를 타지 않는다 (껐다 켜면 다시 보인다)', () => {
  const code = codeOnly(SRC.scratch);
  assert.match(code, /let _scratchHiddenAll = false;/, '★세션 상태 변수가 없다');
  assert.ok(!/showScratchHiddenAll|scratchHiddenAll['"]?\s*:/.test(codeOnly(SRC.main)),
    '★숨김 상태가 settings 로 새어 나갔다 — 다음 실행에 「빈 캔버스」를 보게 된다');
  assert.ok(!codeOnly(SRC.store).includes('scratchHiddenAll'),
    '★숨김 상태가 렌더러 설정으로 새어 나갔다');
});
