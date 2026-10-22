/* collab-kill-switch — ★협업 킬스위치 «한 자리»가 ★정말 전부를 끄나 · ★기본값은 그대로 켜짐인가 (t3-07 · 2026-10-22 imac-지디워커)
 *
 * ★현빈 요구 = 협업을 ★끌 수 있게. ⛔「사용자가 어디서 끄나」(설정 화면? admin? 프로젝트별?)는 ★안 정해졌다 — ★현빈 칸.
 *   ⇒ ★새 장치를 ★안 만들었다. 끄는 자리는 ★이미 하나다: `js/feature-flags.js` 의 `w.COLLAB_ENABLED = true;`.
 *   ⇒ 이 검사는 ⑴ 그 한 줄이 ★여전히 true(동작 변화 0) ⑵ 그 줄을 읽는 자리 ★전수 ⑶ 그 한 줄을 false 로 바꾼 판에서
 *     ★무엇이 사라지나를 ★잠근다. ★「끄는 길」을 현빈이 정하면 ★그 길은 ★이 한 줄을 바꾸는 쪽이어야 이 자가 산다.
 * ★끄면 사라지는 것 = OFF_ROSTER (0.9.7 릴리스 노트 「공동작업」: 초대 종 · 「편집 중」 · 충돌 고르기 · 주인이 해산 · 상단바 연결 상태
 *   ＋ 입구 둘: 설정 「협업」 탭 · 목록 👥 「원격으로 올리기」).
 * ⛔안 사라지는 것(설계 — js/feature-flags.js 머리말): 이미 협업으로 올라간 프로젝트의 「👥 공동작업」 배지·collab-card 표시(데이터는 안 건드린다).
 * ⛔안 재는 것: 실제 화면(DOM 렌더) · 서버 · Electron main 쪽 IPC(main.js 는 플래그를 ★0 번 읽는다 — C1 이 센다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const FLAG_FILE = 'js/feature-flags.js';
const FLAG_LINE = 'w.COLLAB_ENABLED = true;';

/* ★읽는 자리 명부 — 파일 → 줄 수(주석 뗀 코드에서 `COLLAB_ENABLED` 가 든 줄). ★쓰는 자리(FLAG_FILE)는 1 이어야 한다.
   ⛔새 자리가 생기면 C1 이 빨강 — ★그 자리가 «끄면 무엇이 사라지나»에 들면 OFF_ROSTER 에도 칸을 더하라. */
const READERS = {
  'js/feature-flags.js': 1,            // ★쓰는 자리(정본) — 이 한 줄
  'js/globals.js': 1,                  // 모듈 이름으로 다시 내보냄 · ⚠️가져다 쓰는 곳 0(이 자로 셌다 — import 줄도 토큰을 품는다)
  'js/settings/settings-modal.js': 2,  // 「협업」 탭 단추 · 패인
  'js/collab/sync.js': 2,              // start() · autoStart()
  'js/collab/invites-badge.js': 1,     // inboxOpen()
  'pages/projects.html': 2,            // 👥 단추 그리기 · shareProjectUI 두 겹 문
};

const SKIP_DIRS = new Set(['node_modules', 'tests', '.git', 'dist', 'release', 'tools', 'docs', '.claude', '_context', 'debug']);
function censusReaders() {
  const out = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full); continue; }
      if (!/\.(js|mjs|cjs|html)$/.test(e.name)) continue;
      const rel = path.relative(ROOT, full).split(path.sep).join('/');
      let s = readSrc(ROOT, rel);
      if (rel.endsWith('.html')) s = s.replace(/<!--[\s\S]*?-->/g, m => m.replace(/[^\n]/g, ' '));   // HTML 주석(줄 수는 지킨다)
      const strip = makeStripper();
      const n = s.split('\n').map(l => strip(l)).filter(l => l.includes('COLLAB_ENABLED')).length;
      if (n) out[rel] = n;
    }
  })(ROOT);
  return out;
}

/** 협업 스크립트 여섯을 index.html 순서대로 vm 에 싣는다. on=false 면 ★FLAG_LINE 한 줄만 false 로 바꾼 판.
 *  linked = 열린 프로젝트가 협업본(ref 가 collabId 를 준다) — ★켜진 판에서 «그려질 것»이 정말 그려지는지 보는 양성대조. */
function boot({ on, linked }) {
  const calls = [], ids = [], timers = [];
  const fakeEl = () => ({ style: {}, dataset: {}, classList: { add() {}, remove() {}, toggle() {} }, appendChild() {}, remove() {},
    addEventListener() {}, setAttribute() {}, querySelector: () => null, querySelectorAll: () => [], textContent: '', title: '' });
  const c = { console: { log() {}, info() {}, warn() {}, error() {}, debug() {} } };
  c.window = c;
  c.document = { readyState: 'complete', hidden: false, body: fakeEl(),
    getElementById: (id) => { ids.push(id); return /^collab-/.test(id) ? fakeEl() : null; },
    addEventListener() {}, querySelectorAll: () => [], querySelector: () => null, createElement: fakeEl };
  c.location = { search: '?project=p1' };
  c.URLSearchParams = URLSearchParams;
  c.CustomEvent = class { constructor(t, o) { this.type = t; this.detail = o && o.detail; } };
  c.dispatchEvent = () => true; c.addEventListener = () => {}; c.removeEventListener = () => {};
  c.innerWidth = 1200; c.innerHeight = 800;
  c.setInterval = (f, ms) => { timers.push(ms); return 1; }; c.clearInterval = () => {};
  c.setTimeout = (f, ms) => { timers.push('t' + ms); return 1; }; c.clearTimeout = () => {};
  c.electronAPI = { collab: new Proxy({}, { get: (_, k) => (...a) => {
    calls.push(k);
    if (k === 'ref') return Promise.resolve(linked ? { ref: { collabId: 'c1', role: 'owner', seq: 0 } } : { ref: null });
    if (k === 'pull') return Promise.resolve({ ok: true, seq: 1, patches: [], presence: [{ actorId: 'zz', name: '상대', editingSectionId: 's1' }] });
    return Promise.resolve({ ok: true, invites: [], projects: [] });
  } }) };
  vm.createContext(c);
  const flagSrc = readSrc(ROOT, FLAG_FILE);
  assert.equal(flagSrc.split(FLAG_LINE).length, 2, `★${FLAG_FILE} 에 «${FLAG_LINE}» 가 ★한 번이 아니다 — 끄는 자리가 하나가 아니다`);
  vm.runInContext(on ? flagSrc : flagSrc.replace(FLAG_LINE, 'w.COLLAB_ENABLED = false;'), c, { filename: FLAG_FILE });
  for (const f of ['js/collab/reasons.js', 'js/collab/sync.js', 'js/collab/notify.js', 'js/collab/conflict-ui.js', 'js/collab/presence-ui.js', 'js/collab/invites-badge.js']) {
    vm.runInContext(readSrc(ROOT, f), c, { filename: f });
  }
  /* 「편집 중」 그리기 = presence-ui.js paint 가 ★제 층(#collab-presence-layer)을 찾는 것으로 엿본다(그 객체는 얼려 있어 바꿔 끼울 수 없다) */
  return { c, calls, ids, timers, painted: () => ids.filter(i => i === 'collab-presence-layer') };
}
/** vm 안 객체 → 이 realm 으로(프로토타입이 달라 deepEqual 이 «항상 다르다» — collab-enable-gate.test.mjs G1 이 밟은 흠) */
const J = (x) => JSON.parse(JSON.stringify(x));
const settle = async () => { for (let i = 0; i < 6; i++) await new Promise(r => setImmediate(r)); };

test('C0 ★동작 변화 0 — 기본값은 여전히 켜짐(true) · 끄는 자리는 그 한 줄', () => {
  const c = { console }; c.window = c; vm.createContext(c);
  vm.runInContext(readSrc(ROOT, FLAG_FILE), c, { filename: FLAG_FILE });
  assert.equal(c.COLLAB_ENABLED, true, '★기본값이 true 가 아니다 — 발주 ⒜ 는 «동작 변화 0» 이다(끄는 길은 현빈 칸)');
  assert.equal(readSrc(ROOT, FLAG_FILE).split(FLAG_LINE).length, 2);
});

test('C1 ★읽는 자리 전수 — 명부와 같다 (자 = 주석·HTML주석 뗀 코드의 COLLAB_ENABLED 줄 · tests/tools/docs 제외)', () => {
  const got = censusReaders();
  assert.deepEqual(got, READERS,
    `★COLLAB_ENABLED 를 읽는 자리가 명부와 다르다:\n  실물 ${JSON.stringify(got)}\n  ⇒ 새 자리면 READERS 에 올리고, 끄면 사라지는 것이면 OFF_ROSTER 에도 칸을 더하라`);
  const total = Object.values(got).reduce((a, b) => a + b, 0);
  assert.equal(total - 1, 8, '★읽는 자리(쓰는 자리 1 제외)가 8 이 아니다');
  assert.equal(got['main.js'], undefined, '★Electron main 이 플래그를 읽기 시작했다 — 이 검사의 «안 재는 것»이 바뀐다');
});

test('C2 ★양성대조 — 켜진 판(협업본을 연 편집기)에서는 ★초대 폴링·동기화·「편집 중」·상단바가 ★실제로 돈다', async () => {
  const r = boot({ on: true, linked: true });
  await settle();
  assert.ok(r.calls.includes('invites'), `★초대 종 폴링이 안 돈다 — 양성대조 미성립 (${r.calls})`);
  assert.ok(r.timers.includes(20000), '★초대 20초 폴링 타이머가 없다');
  assert.ok(r.calls.includes('ref') && r.calls.includes('pull'), `★동기화가 안 붙었다 (${r.calls})`);
  assert.ok(r.ids.includes('collab-topbar-badge'), '★상단바 연결 상태를 안 그린다');
  assert.ok(r.painted().length > 0, '★「편집 중」을 안 그린다(presence 층 조회 0) — 양성대조 미성립');
  assert.equal(r.c.collabInvites.inboxOpen(), true);
  assert.deepEqual(J(await r.c.collabSync.start('p1')), { ok: true, collabId: 'c1' });
});

/* ★★끄면 사라지는 것 — 「무엇으로 사라지나」(직접 = 그 자리가 플래그를 읽음 · 간접 = 동기화가 안 붙어 그리는 자가 안 불림) */
const OFF_ROSTER = [
  { id: 'invite-bell',   what: '초대 종(상단바 「초대 N건」 · 그 자리 수락·거절·열기)', how: '직접 — invites-badge.js inboxOpen() false ⇒ boot 이 폴링·리스너를 안 단다' },
  { id: 'presence',      what: '섹션 위 「편집 중」 표시',                              how: '간접 — sync.js start/autoStart 가 막혀 pull 0 ⇒ paintPresence → CollabPresenceUI.paint 안 불림' },
  { id: 'conflict-pick', what: '충돌 고르기',                                        how: '간접 — sync 사건(emit) 0 ⇒ notify.js → conflict-ui.js 안 그림' },
  { id: 'topbar-status', what: '상단바 연결 상태(#collab-topbar-badge)',               how: '간접 — 그리는 자가 sync.js·notify.js·conflict-ui.js 뿐 ⇒ 셋 다 안 불림(조회 0)' },
  { id: 'disband',       what: '주인이 해산(설정 「협업」 탭 안 단추)',                    how: '직접 — settings-modal.js 가 탭·패인을 안 그린다' },
  { id: 'settings-tab',  what: '설정 「협업」 탭·패인',                                 how: '직접 — settings-modal.js:96·:107 템플릿 조건' },
  { id: 'share-button',  what: '목록 카드 👥 「원격으로 올리기」 · shareProjectUI',         how: '직접 — projects.html 단추 조건 ＋ 함수 첫 줄 문(두 겹)' },
];

test('C3 ★★끈 판(그 한 줄만 false) — OFF_ROSTER 일곱이 사라진다', async () => {
  assert.equal(OFF_ROSTER.length, 7);
  const r = boot({ on: false, linked: true });
  await settle();
  assert.equal(r.c.COLLAB_ENABLED, false, '★끈 판이 안 섰다');
  /* invite-bell */
  assert.equal(r.c.collabInvites.inboxOpen(), false);
  assert.equal(r.calls.includes('invites'), false, '★끈 판에서 초대 폴링이 돈다');
  /* presence · conflict-pick · topbar-status — 협업 API 0 · 타이머 0 · 협업 DOM 조회 0 */
  assert.deepEqual(r.calls, [], `★끈 판에서 협업 API 를 불렀다: ${r.calls}`);
  assert.deepEqual(r.timers, [], `★끈 판에서 타이머가 섰다: ${r.timers}`);
  assert.deepEqual(r.ids.filter(i => /^collab-/.test(i)), [], `★끈 판에서 협업 DOM 을 건드렸다: ${r.ids}`);
  assert.deepEqual(J(await r.c.collabSync.start('p1')), { ok: false, reason: 'collab_disabled' });
  await settle();
  assert.deepEqual(r.calls, [], '★손으로 start 를 불러도 API 를 부른다 — 문이 한 겹이다');
  assert.deepEqual(r.painted(), [], '★끈 판에서 「편집 중」을 그렸다');
  /* topbar-status · conflict-pick · presence 의 «그리는 자» 전수 — 이게 넓어지면 «간접»이 거짓이 된다 */
  const code = (f) => { const s = makeStripper(); return readSrc(ROOT, f).split('\n').map(l => s(l)).join('\n'); };
  const writers = (needle) => Object.keys(censusFiles()).filter(f => code(f).includes(needle)).sort();
  assert.deepEqual(writers("'collab-topbar-badge'"), ['js/collab/conflict-ui.js', 'js/collab/notify.js', 'js/collab/sync.js']);
  assert.deepEqual(writers('CollabPresenceUI.paint'), ['js/collab/sync.js']);
  assert.deepEqual(writers('CollabConflictUI'), ['js/collab/conflict-ui.js', 'js/collab/notify.js']);
  assert.ok(/\.onEvent\(\s*onEvent\s*\)/.test(code('js/collab/notify.js')), '★notify 가 sync 사건을 안 듣는다 — 「간접」의 사슬이 끊겼다');
  /* settings-tab · disband — 템플릿 조건을 «그대로» 평가한다 */
  const sm = code('js/settings/settings-modal.js');
  const conds = [...sm.matchAll(/\$\{window\.COLLAB_ENABLED \? ('(?:[^'\\]|\\.)*') : ''\}/g)].map(m => m[1]);
  assert.equal(conds.length, 2, '★설정 탭·패인 조건 둘을 못 찾았다');
  const evalT = (on, lit) => vm.runInNewContext(`window.COLLAB_ENABLED ? ${lit} : ''`, { window: { COLLAB_ENABLED: on } });
  assert.ok(evalT(true, conds[0]).includes('data-tab="collab"') && evalT(true, conds[1]).includes('data-pane="collab"'));
  assert.equal(evalT(false, conds[0]) + evalT(false, conds[1]), '');
  assert.ok(/disband/.test(sm), '★해산 단추가 설정 모달에 없다 — disband 칸의 근거가 옮겨졌다');
  /* share-button — 단추 조건 ＋ 함수 문 */
  const ph = readSrc(ROOT, 'pages/projects.html');
  assert.match(ph, /const shareBtnHtml = \(!window\.COLLAB_ENABLED \|\|/);
  assert.match(ph, /async function shareProjectUI\([^)]*\) \{\s*e\.stopPropagation\(\);[\s\S]{0,400}?if \(!window\.COLLAB_ENABLED\) return;/);
});

test('C4 ★음성대조 — 협업본이 «아닌» 프로젝트를 켜진 판에서 열면 동기화는 안 붙는다(끈 판과 «같은 이유»가 아니다)', async () => {
  const r = boot({ on: true, linked: false });
  await settle();
  assert.ok(r.calls.includes('ref'), '★켜진 판인데 ref 를 안 물었다');
  assert.equal(r.calls.includes('pull'), false);
  assert.deepEqual(J(await r.c.collabSync.start('p1')), { ok: false, reason: 'not_linked' });
});

function censusFiles() {
  const out = {};
  (function walk(dir) {
    for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, e.name);
      if (e.isDirectory()) { if (!SKIP_DIRS.has(e.name)) walk(full); continue; }
      if (/\.js$/.test(e.name)) out[path.relative(ROOT, full).split(path.sep).join('/')] = 1;
    }
  })(ROOT);
  return out;
}
