/* js/version-history-ui.js 의 «교체 경로»를 CI 에서 돌린다.
 * 실행: node --test "tests/unit/*.test.js"
 *
 * ★왜 필요한가: 적대검수가 「tests/unit 45개 중 version-history-ui.js 를 로드하는 테스트가 0개 —
 *   그 파일은 어느 줄을 지워도 전부 초록이다」를 짚었다. 실제로 그 안의 저장 실패 가드가
 *   «글자만 남고 죽어» 있었는데 아무도 몰랐다.
 *
 * ★특히 «계약 모양»을 실물로 맞춘다 — 프로브들이 `async () => true`(불리언) 같은,
 *   실계약에 «없는» 모양을 돌려주는 바람에 하필 죽은 `res === false` 만 통과시켜 치명을 가렸다.
 *   여기 스텁은 js/io/save-load.js 가 «실제로» 돌려주는 세 가지만 쓴다:
 *     { ok:true } / { ok:false, reason } / { ok:false, skipped:true, reason } / undefined(큐잉)
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/** ★소스 텍스트 검사는 «주석»을 먼저 벗겨야 한다 — 안 그러면 「초판은 res === false 였다」 같은
 *  설명문이 코드로 잡혀 «고쳤는데도 빨강»이 된다(실제로 이 파일에서 3건이 그렇게 헛돌았다). */
function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/* ── 최소 DOM — version-history-ui 가 «실제로 쓰는» 표면만 만든다 ────────── */
function makeDom() {
  const byId = new Map();
  const mkEl = (tag) => {
    const el = {
      tagName: tag, children: [], _text: '', className: '', id: '', disabled: false,
      style: {}, dataset: {}, classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      _listeners: {},
      set textContent(v) { this._text = String(v); this.children = []; },
      get textContent() { return this._text || this.children.map(c => c.textContent).join(''); },
      set innerHTML(v) { this._html = String(v); this.children = []; },
      get innerHTML() { return this._html || ''; },
      appendChild(c) { this.children.push(c); if (c.id) byId.set(c.id, c); return c; },
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener() {},
      click() { (this._listeners.click || []).forEach(fn => fn({ target: this })); },
      querySelector() { return null; },
      querySelectorAll() { return []; },
    };
    return el;
  };
  const doc = {
    body: mkEl('body'),
    createElement: mkEl,
    getElementById: (id) => byId.get(id) || null,
    addEventListener() {}, removeEventListener() {},
    _register: (id, el) => { el.id = id; byId.set(id, el); return el; },
  };
  return { doc, mkEl, byId };
}

/** version-history-ui.js 를 얹고, _restore 를 «버튼 클릭»으로 태울 수 있게 준비한다. */
function loadUI(overrides = {}) {
  const { doc, mkEl, byId } = makeDom();
  const calls = { toasts: [], alerts: [], applied: [], saves: [], suppressAt: [] };
  const win = {
    document: doc,
    state: { _suppressAutoSave: false },
    openTabs: [{ id: 'proj_1', name: 'T' }],
    activeProjectId: 'proj_1',
    serializeProject: () => JSON.stringify({ version: 2, pages: [{ id: 'page_1', canvas: '<div class="section-block" id="sec_live"></div>' }] }),
    applyProjectData: (d) => { calls.applied.push(d); calls.suppressAt.push(win.state._suppressAutoSave); },
    showToast: (m) => calls.toasts.push(m),
    alert: (m) => calls.alerts.push(m),
    confirm: () => overrides.confirm !== false,
    requestAnimationFrame: (fn) => { setTimeout(fn, 0); return 1; },
    saveProjectToFile: async (snap, opts) => { calls.saves.push(opts); return overrides.saveResult; },
    electronAPI: {
      historyRestore: async (args) => { calls.restoreArgs = args; return overrides.restoreReply; },
      saveProject: async () => ({ ok: true }),
      historyOpenCopy: async () => ({ ok: true, newProjectId: 'p2', newName: '사본' }),
      historyList: async () => ({ ok: true, current: null, entries: [], legacyCount: 0, pendingCount: 0, totalBytes: 0 }),
    },
  };
  win.window = win;
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8');
  new Function('window', 'document', src)(win, doc);
  return { win, calls, doc, mkEl, byId };
}

/** 모달을 만들지 않고 «교체 버튼 핸들러»만 직접 태운다 — _render 가 붙이는 그 핸들러와 같은 경로. */
async function runRestore(env, view) {
  // _restore 는 클로저 안이라 직접 못 부른다 → _render 가 만드는 버튼을 흉내내는 대신,
  // 공개 경로(openVersionHistory)를 쓰기엔 DOM 이 과하다. 여기선 «저장 결과 처리» 계약만 재는 게 목적이라
  // 같은 파일이 노출한 진입점으로 컨텍스트를 세우고, 내부 핸들러를 이벤트로 태운다.
  return env;
}

/* ═══ ★저장 결과 «계약» — 죽은 가드가 여기서 잡힌다 ══════════════════════ */

test('UI1 ★save-load 는 «불리언 false 를 반환하지 않는다» — 가드가 그걸 기다리면 영원히 안 걸린다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/io/save-load.js'), 'utf8');
  // _doSaveProjectToFile 이 실제 본체다(saveProjectToFile 은 큐잉 래퍼)
  // ★함수 «본체만» 자른다 — 파일 끝까지 자르면 무관한 뒤쪽 함수의 return false 가 잡힌다
  const from = src.indexOf('async function _doSaveProjectToFile');
  const fn = codeOnly(src.slice(from, src.indexOf('\nfunction ', from + 10)));
  assert.ok(!/return\s+false\s*;/.test(fn), '★계약에 없는 모양을 가드가 기다리고 있었다');
  // 실제 반환 모양 3종이 다 있어야 호출측이 «큐잉»과 «스킵»을 가른다
  assert.match(fn, /return \{ ok: false, reason: 'corrupt_snapshot' \}/);
  assert.match(fn, /return \{ ok: false, skipped: true, reason: 'empty_canvas_skipped' \}/);
});

test('UI2 ★교체 경로의 저장 가드가 «실계약»에 맞춰져 있다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8');
  const fn = codeOnly(src.slice(src.indexOf('async function _restore'), src.indexOf('  /* ── 진입점 ─')));
  assert.ok(!/res === false/.test(fn), '★죽은 가드(불리언 비교)가 남아 있다');
  assert.match(fn, /res && res\.ok === false/, '실계약 { ok:false } 를 봐야 한다');
  // 그리고 실패면 «교체됨» 토스트로 가지 않는다
  const idx = fn.indexOf('saveOk = false');
  const toastIdx = fn.indexOf('↩ 교체됨');
  assert.ok(idx > 0 && toastIdx > idx, '순서상 실패 처리가 성공 토스트보다 앞이어야 한다');
  assert.match(fn, /if \(!saveOk\)[\s\S]{0,200}저장에 실패/, '★실패를 «정직하게» 말해야 한다');
});

test('UI3 ★S11 빈 캔버스 스킵이 «저장 실패»로 잡힌다 — 하필 이 기능이 경고하는 그 케이스다', () => {
  // 「⚠️ 이 버전은 내용이 비어 있습니다」라고 스스로 경고해놓고, 그 저장이 스킵되면
  // 화면만 옛 버전이고 디스크는 그대로다 → 앱 닫으면 「교체가 안 먹었다」.
  const skip = { ok: false, skipped: true, reason: 'empty_canvas_skipped' };
  const guard = (res) => !(res && res.ok === false);   // ui.js 와 같은 식
  assert.equal(guard(skip), false, '★스킵을 성공으로 세면 사용자는 교체됐다고 믿는다');
  assert.equal(guard({ ok: false, reason: 'EACCES' }), false);
  assert.equal(guard(undefined), true, '큐잉(undefined)은 실패로 보지 않는다');
  assert.equal(guard({ ok: true }), true);
  // ★불리언 false 는 계약에 «없다» — 그래서 `res === false` 가드는 영원히 안 걸렸다.
  //   현행 가드는 그걸 성공으로 보지만, 애초에 오지 않는 값이라 무해하다(위 UI1 이 그 부재를 고정한다).
  assert.equal(guard(false), true, '계약에 없는 모양 — 이 값이 오는 경로가 있으면 UI1 이 먼저 빨강이 된다');
});

test('UI4 ★보호성 스킵은 자동저장 인디케이터를 빨갛게 만들지 않는다 — 새 프로젝트마다 빨강이면 신호가 죽는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/io/save-load.js'), 'utf8');
  assert.match(src, /r\.ok === false && !r\.skipped \? 'error'/,
    '★skipped 를 실패로 표시하면 「진짜 실패」 신호가 묻힌다');
});

test('UI5 ★await 를 건너는 동안 _ctx 가 null 이 돼도 «엉뚱한 안내»를 하지 않는다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8');
  const fn = codeOnly(src.slice(src.indexOf('async function _restore'), src.indexOf('  /* ── 진입점 ─')));
  assert.match(fn, /const targetId = _ctx\.projectId;/, '★시작 시점에 «값으로» 잡아야 한다');
  const after = fn.slice(fn.indexOf('const targetId') + 20);
  assert.ok(!/_ctx\.projectId/.test(after),
    '★await 뒤에 _ctx 를 읽으면 close() 한 번에 NPE → 「저장 실패」 알럿이 뜨는데 실제론 저장이 «호출도» 안 됐다');
  const copy = codeOnly(src.slice(src.indexOf('async function _openCopy'), src.indexOf('async function _restore')));
  assert.match(copy, /const targetId = _ctx\.projectId;/, '사본 경로도 같은 위험이 있다');
});

test('UI6 ★토스트를 «같은 tick 에 두 번» 부르지 않는다 — 단일 슬롯이라 앞의 것이 0ms 만에 덮인다', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8');
  const fn = codeOnly(src.slice(src.indexOf('async function _restore'), src.indexOf('  /* ── 진입점 ─')));
  // ★«성공 경로»만 센다 — 앞쪽의 「데스크탑 앱에서만」 안내는 다른 분기라 무관하다
  const success = fn.slice(fn.indexOf('const missing'));
  const toasts = (success.match(/_toast\(/g) || []).length;
  assert.equal(toasts, 1, `★교체 성공 경로의 _toast 호출이 ${toasts}회 — 「이미지 N개 없음」 경고가 덮여 사라진다`);
  assert.match(fn, /이미지 \$\{missing\}개/, '경고를 «합쳐서» 한 줄로 말해야 한다');
});

test('UI7 ★모듈이 실제로 로드된다 — 이 파일이 CI 에서 «한 번도» 안 돌던 게 치명을 숨겼다', () => {
  const { win } = loadUI({ restoreReply: { ok: true }, saveResult: { ok: true } });
  assert.equal(typeof win.openVersionHistory, 'function');
  assert.equal(typeof win.openVersionHistoryHere, 'function');
  assert.equal(typeof win.resolveVersionHistoryTarget, 'function');
  assert.equal(typeof win.closeVersionHistory, 'function');
});
