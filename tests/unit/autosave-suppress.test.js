/* H6 — `_suppressAutoSave` 고착. 자동저장이 «조용히» 멎는 자리.
 * 실행: node tests/unit/autosave-suppress.test.js
 *
 * ★이 파일이 재는 것은 셋이다.
 *   ⑴ 구조(js/autosave-suppress.js)가 «맞게» 구는가 — 특히 «해제 순서가 뒤바뀔 때».
 *   ⑵ 그 구조가 «실제로 불리는가» — 모듈은 완벽한데 아무도 안 부르는 자리를 막는다.
 *   ⑶ 아직 «직접 대입»으로 남은 자리가 허용목록 그대로인가 — 새 ON 이 몰래 늘면 빨강.
 *
 * ⛔검사가 자기 «주석»에 걸리지 않게, 소스 검사는 codeOnly() 로 주석을 먼저 벗긴다
 *   (vhist-ui-restore.test.js 가 세운 규율 — 이 레포에서 실제로 3건이 그렇게 헛돌았다).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '../..');
const read = (rel) => fs.readFileSync(path.join(ROOT, rel), 'utf8');

function codeOnly(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

/** js/ 아래 모든 .js — ⛔「부분집합을 세고 전체를 말하지 마라」. 범위를 코드로 박는다. */
function allJsFiles(dir = path.join(ROOT, 'js'), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allJsFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(path.relative(ROOT, p));
  }
  return out.sort();
}

/** 억제 모듈을 DOM 없이 얹는다 — report-buffer.js 와 같은 고전 스크립트라 이게 된다. */
function loadSuppress({ withDocument = false } = {}) {
  const w = { state: { _suppressAutoSave: false }, ReportBuffer: { notes: [], note(m) { this.notes.push(m); } } };
  const rafQ = [];
  w.requestAnimationFrame = (fn) => { rafQ.push(fn); return rafQ.length; };
  if (withDocument) w.document = {};
  new Function('window', 'globalThis', read('js/autosave-suppress.js'))(w, w);
  return { w, A: w.AutoSaveSuppress, flushRaf: () => { const q = rafQ.splice(0); q.forEach(fn => fn()); } };
}

/* ═══ ⑴ 구조 ═══════════════════════════════════════════════════════════ */

test('S1 열면 켜지고 닫으면 꺼진다', () => {
  const { w, A } = loadSuppress();
  const t = A.begin('x');
  assert.equal(w.state._suppressAutoSave, true);
  A.end(t);
  assert.equal(w.state._suppressAutoSave, false);
});

test('S2 중첩 — 안쪽이 닫혀도 바깥 창이 살아 있으면 «안 꺼진다»', () => {
  const { w, A } = loadSuppress();
  const outer = A.begin('outer'), inner = A.begin('inner');
  A.end(inner);
  assert.equal(w.state._suppressAutoSave, true, '안쪽이 바깥의 억제를 꺼버렸다');
  A.end(outer);
  assert.equal(w.state._suppressAutoSave, false);
});

test('S3 ★해제 «순서»가 뒤바뀌어도 고착하지 않는다 — 이전값 복원이 못 하는 일', () => {
  /* 이 레포에 실제로 있는 모양: 바깥은 «동기»로 닫고 안쪽(applyProjectData)은 «rAF» 로 닫는다.
     이전값(prevSuppress) 방식이면 여기서 바깥이 false 로 되돌린 뒤 안쪽이 「이전값=true」를
     복원해 ★영구 고착한다. 깊이 세기는 순서와 무관하다. */
  const { w, A } = loadSuppress();
  const outer = A.begin('outer'), inner = A.begin('inner-rAF');
  A.end(outer);                                   // 바깥이 «먼저» 나간다
  assert.equal(w.state._suppressAutoSave, true, '아직 안쪽 창이 열려 있는데 꺼졌다');
  A.end(inner);                                   // 뒤늦게 안쪽이 나간다
  assert.equal(w.state._suppressAutoSave, false, '★고착 — 늦게 나간 쪽이 억제를 되살렸다');
});

test('S4 같은 토큰을 두 번 닫아도 «남의 창»이 안 닫힌다', () => {
  /* dragend 는 캡처·버블 양쪽에서 온다 — 실제로 두 번 불린다. */
  const { w, A } = loadSuppress();
  const a = A.begin('drag'), b = A.begin('other');
  A.end(a); A.end(a); A.end(a);
  assert.equal(w.state._suppressAutoSave, true, '두 번째 end 가 남의 창을 닫았다');
  A.end(b);
  assert.equal(w.state._suppressAutoSave, false);
});

test('S5 안 연 채 닫아도 아무 일 없다 (null·미개시 토큰)', () => {
  const { w, A } = loadSuppress();
  const live = A.begin('live');
  assert.equal(A.end(null), false);
  assert.equal(A.end(undefined), false);
  assert.equal(A.end({ released: true }), false);
  assert.equal(w.state._suppressAutoSave, true, '엉뚱한 end 가 살아 있는 창을 닫았다');
  A.end(live);
});

test('S6 ★«직접 대입»으로 켜 둔 남의 억제를 깨지 않는다 (허용목록 자리와의 공존)', () => {
  const { w, A } = loadSuppress();
  w.state._suppressAutoSave = true;               // applyProjectData·history 등이 raw 로 켜 둔 창
  const t = A.begin('mine');
  A.end(t);
  assert.equal(w.state._suppressAutoSave, true, '★내 창을 닫으면서 «남의» 억제까지 꺼버렸다');
});

test('S7 wrap — 예외가 나도 창은 닫히고, 예외는 그대로 올라간다', () => {
  const { w, A } = loadSuppress();
  assert.throws(() => A.wrap('boom', () => { throw new Error('터짐'); }), /터짐/);
  assert.equal(w.state._suppressAutoSave, false, '★고착 — 예외가 창을 열어둔 채 나갔다');
});

test('S8 wrapAsync — 거부돼도 창은 닫힌다', async () => {
  const { w, A } = loadSuppress();
  await assert.rejects(A.wrapAsync('boom', async () => { throw new Error('거부'); }), /거부/);
  assert.equal(w.state._suppressAutoSave, false, '★고착 — 거부가 창을 열어둔 채 나갔다');
});

test('S9 endNextFrame — «한 프레임 뒤»에 닫는다(동기 해제가 아니다)', () => {
  const { w, A, flushRaf } = loadSuppress();
  const t = A.begin('rAF');
  A.endNextFrame(t);
  assert.equal(w.state._suppressAutoSave, true, '★동기로 닫혔다 — MutationObserver 경합이 되살아난다');
  flushRaf();
  assert.equal(w.state._suppressAutoSave, false);
});

/* ═══ 감시견 — 알리기만 한다 ══════════════════════════════════════════ */

test('W1 한계 «전»엔 안 알린다, 넘으면 알린다, 그리고 «한 번만» 알린다', () => {
  const { A } = loadSuppress();
  A.begin('stuck');
  const t0 = 1000000;
  assert.equal(A.evaluateStuck(t0).report, null);
  assert.equal(A.evaluateStuck(t0 + A.STUCK_MS - 1).report, null, '한계 전에 울었다');
  const first = A.evaluateStuck(t0 + A.STUCK_MS);
  assert.ok(first.report, '한계를 넘었는데 안 울었다');
  assert.match(first.report, /stuck/);
  assert.equal(A.evaluateStuck(t0 + A.STUCK_MS * 10).report, null, '같은 에피소드를 두 번 알렸다');
});

test('W2 ⛔감시견은 억제를 «풀지 않는다» — 알리기만', () => {
  const { w, A } = loadSuppress();
  A.begin('stuck');
  const t0 = 5000;
  A.evaluateStuck(t0); A.evaluateStuck(t0 + A.STUCK_MS);
  assert.equal(w.state._suppressAutoSave, true,
    '★감시견이 남의 억제 창을 깼다 — 고착보다 큰 결함이다');
});

test('W3 드래그처럼 «사람 손»이 쥔 창은 더 긴 한계를 쓴다(늑대소년 방지)', () => {
  const { A } = loadSuppress();
  A.begin('section-drag', { longLived: true });
  const t0 = 0;
  A.evaluateStuck(t0);
  assert.equal(A.evaluateStuck(t0 + A.STUCK_MS + 1).report, null, '드래그 30초에 오경보');
  assert.ok(A.evaluateStuck(t0 + A.STUCK_LONG_MS).report, '5분이 넘어도 안 울었다');
});

test('W4 억제가 풀리면 다음 에피소드를 «다시» 알릴 수 있다', () => {
  const { A } = loadSuppress();
  const t1 = A.begin('a'); A.evaluateStuck(0);
  assert.ok(A.evaluateStuck(A.STUCK_MS).report);
  A.end(t1);
  A.evaluateStuck(A.STUCK_MS + 1);                // 꺼짐 — 무장 해제
  A.begin('b'); A.evaluateStuck(100000);
  assert.ok(A.evaluateStuck(100000 + A.STUCK_MS).report, '두 번째 에피소드를 못 알렸다');
});

test('W5 ★열린 창이 «없는데» 켜져 있는 경우를 «따로» 말한다 (raw 대입 쪽 지목)', () => {
  const { w, A } = loadSuppress();
  w.state._suppressAutoSave = true;               // 허용목록의 raw 대입이 켠 뒤 안 끈 모양
  A.evaluateStuck(0);
  const r = A.evaluateStuck(A.STUCK_MS);
  assert.ok(r.report);
  assert.equal(r.depth, 0);
  assert.match(r.report, /직접 대입/);
});

test('W6 감시견이 ReportBuffer 로 «실제로» 흘러간다 (알림 배선)', async () => {
  const { w, A } = loadSuppress();
  A.begin('wired');
  A.evaluateStuck(0);
  A.evaluateStuck(A.STUCK_MS);                    // 무장
  // 실제 타이머 경로: 아주 짧은 주기로 한 번 돌린다
  A.__resetForTest(); A.begin('wired2');
  const realNow = Date.now;
  try {
    Date.now = () => 0; A.evaluateStuck();
    Date.now = () => A.STUCK_MS;
    A.startWatch(1);
    await new Promise(r => setTimeout(r, 30));
  } finally { Date.now = realNow; A.stopWatch(); }
  assert.ok(w.ReportBuffer.notes.some(n => /\[H6\]/.test(n)),
    '★감시견이 «어디에도» 안 남는다 — 들키지 않는 고착과 같다');
});

/* ═══ ⑵ 배선 — 「모듈은 완벽한데 아무도 안 부른다」를 막는다 ═════════════ */

test('M1 index.html 이 억제 모듈을 «싣고», 그것도 모듈 스크립트보다 «먼저» 싣는다', () => {
  const html = read('index.html');
  const i = html.indexOf('src="js/autosave-suppress.js"');
  assert.ok(i > 0, '★index.html 이 js/autosave-suppress.js 를 안 싣는다 — 전부 죽은 코드다');
  const firstModule = html.indexOf('<script type="module"');
  assert.ok(firstModule > 0);
  assert.ok(i < firstModule,
    '★모듈보다 늦게 실린다 — 모듈이 window.AutoSaveSuppress 를 못 찾는다');
});

/** 부르는 자리 표 — reason 문자열이 곧 «계약»이다. */
const CALLSITES = [
  ['js/tab-system.js', 'tab-switch', 'finally'],
  ['js/io/save-load.js', 'page-switch', 'finally'],
  ['js/io/save-load.js', 'page-delete', 'finally'],
  ['js/branch-system.js', 'branch-switch', 'finally'],
  ['js/branch-system.js', 'branch-merge', 'finally'],
  ['js/commit-system.js', 'commit-restore', 'finally'],
  ['js/section-drag.js', 'section-drag', 'paired'],
  ['js/panels/layer-panel-items.js', 'layer-drag', 'paired'],
  ['js/io/save-load.js', 'reload-seal', 'paired'],
];

for (const [file, reason, kind] of CALLSITES) {
  test(`M2 ${file} — '${reason}' 을 «실제로» 열고 닫는다 (${kind})`, () => {
    const code = codeOnly(read(file));
    const openIdx = code.indexOf(`AutoSaveSuppress.begin('${reason}'`);
    assert.ok(openIdx > 0, `★'${reason}' 억제 창을 «아무도 안 연다» — 이 자리는 안 고쳐졌다`);
    // 이 창 다음의 «다음 begin» 전까지가 이 자리의 사정거리
    const nextOpen = code.indexOf('AutoSaveSuppress.begin(', openIdx + 10);
    const region = code.slice(openIdx, nextOpen > 0 ? nextOpen : code.length);
    assert.ok(region.includes('AutoSaveSuppress.end('),
      `★'${reason}' 을 열기만 하고 «안 닫는다» — 고착 그 자체다`);
    if (kind === 'finally') {
      /* ★「end 가 어딘가 있다」로는 부족하다 — 정상 경로에서만 부르고 예외 경로엔 없을 수 있다.
         «finally 블록 안»에 해제가 있어야 한다. (tab-switch 는 정상 해제 2곳 + finally 안전망 1곳) */
      assert.match(region, /finally\s*\{[\s\S]{0,300}?AutoSaveSuppress\.end\(/,
        `★'${reason}' 의 해제가 finally 블록 «안»에 없다 — 예외 한 번이면 그대로 고착한다`);
    }
  });
}

test('M3 드롭 직후 해제가 «켠 쪽»(section-drag)을 통해 간다', () => {
  const code = codeOnly(read('js/io/save-load.js'));
  assert.ok(/_resumeDragSave\(\);/.test(code),
    '★드롭 자리가 억제를 «직접» 끈다 — 켠 쪽 토큰이 열린 채 남는다');
  assert.match(code, /import \{ _resumeDragSave \} from '\.\.\/section-drag\.js'/);
});

/* ═══ ⑶ 허용목록 — 남은 «직접 대입»을 기계로 고정한다 ═══════════════════ */

/* 아직 raw 로 두는 자리와 «왜». 새 대입이 늘면 이 검사가 빨개진다.
   ⛔ 「고칠 수 있는데 안 고쳤다」가 아니라 「고치면 «더» 나빠진다」인 자리만 여기 있다. */
const RAW_ALLOWED = {
  /* js/globals.js 의 `_suppressAutoSave: false` 는 «객체 리터럴»이라 여기 안 걸린다 —
     대입이 아니라 상태의 «정의»다. 그건 그대로 둔다. */
  'js/io/save-load.js': {
    count: 2,
    why: 'applyProjectData 가 «자기» 창을 열고 rAF 로 «한 프레임 뒤» 닫는다(이미 try/finally). '
       + '★구조로 바꾸면 이 창이 부르는 쪽(탭전환·브랜치·커밋복원)의 창에 «중첩»돼 해제가 한 프레임 밀리고, '
       + '그러면 복원 직후 MutationObserver 가 억제 안에서 발화해 «복원 결과가 자동저장되지 않는다». '
       + '고착이 아니라 «반대 방향» 회귀다 ⇒ 배포 직전엔 건드리지 않는다.',
  },
  'js/history.js': { count: 4, why: 'restoreSnapshot·restoreSnapshotScoped — 이미 try/finally + rAF 해제(C2-A9). 고칠 결함이 없다' },
  'js/collab/sync.js': { count: 2, why: '원격 패치 적용 — 이미 try/finally + rAF 해제. ★고전 스크립트라 import 불가' },
  'js/version-history-ui.js': { count: 2, why: '이 패턴의 «정본»(prevSuppress + rAF). 전용 검사(vhist-ui-restore)가 이 파일을 로드해 지킨다' },
};

test('R1 ★js/ 전수 — «직접 대입»은 허용목록 그대로여야 한다', () => {
  const RE = /_suppressAutoSave\s*=(?!=)/g;
  const found = {};
  for (const rel of allJsFiles()) {
    if (rel === 'js/autosave-suppress.js') continue;          // 구조 본체는 당연히 쓴다
    const n = (codeOnly(read(rel)).match(RE) || []).length;
    if (n) found[rel] = n;
  }
  const expected = Object.fromEntries(Object.entries(RAW_ALLOWED).map(([k, v]) => [k, v.count]));
  assert.deepEqual(found, expected,
    '★자동저장 억제를 «손으로» 켜고 끄는 자리가 바뀌었다.\n'
    + '  새로 켜야 한다면 window.AutoSaveSuppress.begin(reason) / …end(tok) 를 try/finally 로 써라.\n'
    + '  정말 raw 가 필요하면 이 표에 «이유»와 함께 올려라 — 이유 없는 추가는 여기서 막힌다.');
});

test('R2 허용목록의 모든 자리가 «이유»를 갖고 있다', () => {
  for (const [f, v] of Object.entries(RAW_ALLOWED)) {
    assert.ok(v.why && v.why.length > 20, `${f} 의 허용 이유가 비어 있다`);
  }
});
