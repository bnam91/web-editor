/* [C3] 상세 비교(L2) 배선 — «펼치기»를 실제로 눌러서 잰다.
 * 실행: node tests/unit/vhist-detail.test.js
 *
 * ★한계를 먼저 적는다: changeDiff 는 «진짜 DOMParser»가 필요하다(없으면 던지도록 설계돼 있다).
 *   그래서 CI 에서 잴 수 있는 건 «배선과 계약»이다 — 어떤 인자로 부르는지, 못 하는 경우를
 *   무슨 문구로 말하는지, 여닫기 상태가 맞는지. changeDiff «자체»는 version-diff.test.js(37건)가
 *   진짜 DOM 으로 잰다. 진짜 DOMParser 를 태운 통합 확인은 격리 크롬 프로브로 따로 한다.
 *   ⇒ 「CI 가 초록이니 브라우저에서도 된다」로 읽지 마라. 여기서 재는 건 그게 아니다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

/* ── 최소 DOM — «이 파일이 실제로 찾는 것»만 되살린다 ────────────────────
 * ★2026-08-28 구조 변경: 목록이 «루트 기준»(root.querySelector('.vhist-list'))으로 그려지고,
 *   상세 박스는 전역 id 가 아니라 «행 안»(btn.closest('.vhist-row').querySelector(...))에서 찾는다.
 *   두 표면(모달·설정 페인)이 동시에 DOM 에 있어도 안 부딪히게 한 변경이라, 가짜도 그 구조를 흉내낸다.
 */
function makeDom() {
  const byId = new Map();
  const byClass = new Map();   // '.vhist-list' 같은 훅 → 노드
  const boxes = new Map();     // ts → 상세 박스
  const HOOKS = ['vhist-shell', 'vhist-list', 'vhist-intro-text', 'vhist-status-text'];

  function mkEl(tag) {
    const el = {
      tagName: tag, children: [], _text: '', _html: '', className: '', id: '',
      disabled: false, style: { display: '' }, dataset: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      _listeners: {}, _row: null, _box: null, _made: [],
      set textContent(v) { this._text = String(v); },
      get textContent() { return this._text; },
      set innerHTML(v) { this._html = String(v); el._hydrate(); },
      get innerHTML() { return this._html; },
      appendChild(c) { this.children.push(c); if (c.id) byId.set(c.id, c); return c; },
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener() {},
      click() {
        // ★진짜 브라우저는 disabled 버튼에 click 을 «안» 보낸다 — 연타 방어를 재려면 이게 필요하다.
        if (this.disabled) return Promise.resolve([]);
        return Promise.all((this._listeners.click || []).map(fn => fn({ target: this })));
      },
      closest(sel) { return (sel === '.vhist-row' && this._row) ? this._row : null; },
      querySelector(sel) {
        if (sel === '[data-vh-detail-box]' && this._box) return this._box;
        if (byClass.has(sel)) return byClass.get(sel);
        return null;
      },
      querySelectorAll(sel) {
        const m = /^\[data-vh-([a-z]+)\]$/.exec(sel);
        if (!m) return [];
        const key = `vh${m[1][0].toUpperCase()}${m[1].slice(1)}`;
        return (this._made || []).filter(b => b.dataset[key] !== undefined);
      },
      _hydrate() {
        this._made = [];
        /* ★상세 박스는 «마크업에 실제로 있을 때만» 만든다.
         *   초판은 버튼(data-vh-detail)만 보고 박스를 «지어냈다» — 그래서 소스가 전역 id 로
         *   되돌아가도(=마크업에 data-vh-detail-box 가 없어져도) 가짜는 박스를 계속 만들어
         *   변이가 살아남았다. 가짜가 실제보다 관대하면 그 초록은 아무 뜻이 없다. */
        const boxTs = new Set([...this._html.matchAll(/data-vh-detail-box="(\d+)"/g)].map(m => m[1]));
        for (const mm of this._html.matchAll(/data-vh-(detail|open|restore)="(\d+)"/g)) {
          const b = mkEl('button');
          b.dataset[`vh${mm[1][0].toUpperCase()}${mm[1].slice(1)}`] = mm[2];
          b.textContent = mm[1] === 'detail' ? '펼치기' : '';
          if (mm[1] === 'detail') {
            const row = mkEl('div'); row.className = 'vhist-row';
            b._row = row;
            if (boxTs.has(mm[2])) {          // 마크업에 있을 때만
              const box = mkEl('div');
              box.style.display = 'none';
              box.dataset.vhDetailBox = mm[2];
              row._box = box;
              boxes.set(mm[2], box);
            }
          }
          this._made.push(b);
        }
        for (const mm of this._html.matchAll(/id="([^"]+)"/g)) {
          const d = mkEl('div'); d.id = mm[1]; byId.set(mm[1], d);
        }
        for (const mm of this._html.matchAll(/class="([^"]+)"/g)) {
          for (const c of mm[1].split(/\s+/)) {
            if (!HOOKS.includes(c)) continue;
            const d = mkEl('div'); d.className = mm[1];
            byClass.set('.' + c, d);   // 나중 것이 이긴다 = 마지막 렌더가 유효
          }
        }
      },
    };
    return el;
  }
  const doc = {
    body: mkEl('body'), createElement: mkEl,
    getElementById: (id) => byId.get(id) || null,
    addEventListener() {}, removeEventListener() {},
  };
  return { doc, byId, byClass, boxes, mkEl };
}

const ENTRY = { ts: 1787700000000, file: '1787700000000.json', reason: 'auto', pinned: false,
  canon: 1, bytes: 1024, name: 'T', counts: { pages: 1, sections: 2, blocks: 0, images: 0 },
  secs: [{ k: 'page_1::sec_a', n: 'A' }, { k: 'page_1::sec_b', n: 'B' }], assets: [] };
const CURRENT = { ts: 1787700100000, bytes: 900, projMtimeMs: 1, name: 'T',
  counts: { pages: 1, sections: 2, blocks: 0, images: 0 },
  secs: [{ k: 'page_1::sec_a', n: 'A' }, { k: 'page_1::sec_b', n: 'B' }] };

function loadUI(o = {}) {
  const { doc, byId, byClass, boxes } = makeDom();
  const calls = { diffArgs: [], toasts: [] };
  const win = {
    document: doc,
    openTabs: [{ id: 'proj_1', name: 'T' }],
    activeProjectId: 'proj_1',
    showToast: (m) => calls.toasts.push(m),
    alert: () => {},
    requestAnimationFrame: (fn) => { setTimeout(fn, 0); return 1; },
    versionDiff: o.versionDiff === null ? undefined : (o.versionDiff || {
      changeDiff: () => ({ changed: [], lost: [], gained: [], summary: { same: 2, changed: 0, lost: 0, gained: 0, total: 2 } }),
    }),
    electronAPI: {
      historyList: async () => ({ ok: true, current: CURRENT, entries: [ENTRY], legacyCount: 0, pendingCount: 0, totalBytes: 1024 }),
      historyDiffPayload: async (a) => { calls.diffArgs.push(a); return o.diffReply; },
    },
  };
  win.window = win;
  // 데이터 계층(순수)은 진짜를 얹는다 — 행 모델을 흉내내면 그건 내 흉내를 재는 것이다.
  new Function('window', fs.readFileSync(path.join(__dirname, '../../js/version-history.js'), 'utf8'))(win);
  new Function('window', 'document', fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8'))(win, doc);
  return { win, doc, byId, byClass, boxes, calls };
}

/** 모달을 열고 «펼치기» 버튼을 실제로 누른다. */
async function openAndExpand(env) {
  await env.win.openVersionHistory({ projectId: 'proj_1', projectName: 'T' });
  const list = env.byClass.get('.vhist-list');
  const btn = list.querySelectorAll('[data-vh-detail]')[0];
  assert.ok(btn, '★「펼치기」 버튼이 그려지지 않았다');
  await btn.click();
  return { btn, box: env.boxes.get(String(ENTRY.ts)) };
}

/* ═══════════════════════════════════════════════════════════════════════ */

test('C3-1 ★「펼치기」를 누르면 그 버전 ts 로 diff 페이로드를 «부른다»', async () => {
  const env = loadUI({ diffReply: { ok: true, ts: ENTRY.ts, snapCanvas: { page_1: '<div></div>' }, curCanvas: { page_1: '<div></div>' }, bytes: 20 } });
  const { btn, box } = await openAndExpand(env);
  assert.deepEqual(env.calls.diffArgs, [{ projectId: 'proj_1', ts: ENTRY.ts }],
    '★목록을 그릴 때가 아니라 «누를 때» 한 번, 그 행의 ts 로 불러야 한다');
  assert.notEqual(box.style.display, 'none', '★펼쳤는데 안 보인다');
  assert.equal(box.style.display, '',
    '★인라인 display 를 박으면 CSS 의 .vhist-detail{display:flex;gap:4px} 이 죽는다(경미⑧) — 인라인은 «지운다»');
  assert.equal(btn.textContent, '접기', '★상태가 버튼에 안 비친다');
});

test('C3-2 ★다시 누르면 접힌다 — 그리고 두 번 부르지 않는다(캐시)', async () => {
  const env = loadUI({ diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  const { btn, box } = await openAndExpand(env);
  await btn.click();
  assert.equal(box.style.display, 'none');
  assert.equal(btn.textContent, '펼치기');
  await btn.click();
  assert.notEqual(box.style.display, 'none');
  assert.equal(env.calls.diffArgs.length, 1,
    `★같은 행을 여닫을 때마다 39MB 를 다시 읽고 있다(호출 ${env.calls.diffArgs.length}회)`);
});

test('C3-3 ★too_large 는 «상세 비교 생략»이라고 말한다 — 「변경 0」으로 답하지 않는다', async () => {
  const env = loadUI({ diffReply: { ok: false, reason: 'too_large', bytes: 40 * 1024 * 1024 } });
  const { box } = await openAndExpand(env);
  assert.match(box.innerHTML, /상세 비교 생략/, '★생략을 «달라진 게 없다»로 답하면 거짓말이다');
  assert.match(box.innerHTML, /너무 커서/, '★왜 생략하는지 말해야 한다 — 이유 없는 생략은 고장으로 읽힌다');
  assert.ok(!/달라진 섹션/.test(box.innerHTML), '★못 잰 걸 잰 것처럼 쓰지 않는다');
});

test('C3-4 ★mixedEncoding 이면 «바뀐 섹션»만 생략하고, 없어진/생긴 섹션은 그대로 보여준다', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 },
    versionDiff: { changeDiff: () => ({
      mixedEncoding: true,
      changed: [{ k: 'page_1::sec_a', n: '전부' }, { k: 'page_1::sec_b', n: '가짜' }],
      lost: [{ k: 'page_1::sec_z', n: '없어진섹션' }],
      gained: [{ k: 'page_1::sec_y', n: '새섹션' }],
      summary: { same: 0, changed: 2, lost: 1, gained: 1, total: 4 } }) },
  });
  const { box } = await openAndExpand(env);
  assert.match(box.innerHTML, /상세 비교 생략/);
  assert.ok(!/달라진 섹션/.test(box.innerHTML),
    '★한쪽만 인라인 base64 면 이미지 섹션이 «전부» 바뀐 것으로 보인다 — 그 목록은 가짜다');
  assert.match(box.innerHTML, /없어진섹션/, '★id 로 판별하는 손실은 저장 형식과 무관하다 — 지우면 안 된다');
  assert.match(box.innerHTML, /새섹션/);
});

test('C3-5 ★changeDiff 가 던져도(DOMParser 없음) 화면이 안 죽는다 — 「생략」으로 말한다', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 },
    versionDiff: { changeDiff: () => { throw new Error('version-diff.changeDiff: DOMParser 가 없다'); } },
  });
  const { box, btn } = await openAndExpand(env);
  assert.match(box.innerHTML, /상세 비교 생략/);
  assert.match(box.innerHTML, /DOMParser/);
  assert.equal(btn.disabled, false, '★예외 뒤 버튼이 잠긴 채로 남으면 다시 시도할 수 없다');
});

test('C3-6 ★비교 모듈이 아예 없어도 «생략»이다 — undefined 참조로 죽지 않는다', async () => {
  const env = loadUI({ versionDiff: null, diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  const { box } = await openAndExpand(env);
  assert.match(box.innerHTML, /상세 비교 생략/);
  assert.equal(env.calls.diffArgs.length, 0, '★쓸 수도 없는데 39MB 를 먼저 읽었다');
});

test('C3-7 정상 비교는 «내용»을 보여준다 — 위 케이스들이 「전부 생략」이라 초록인 게 아니다(양성대조)', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 },
    versionDiff: { changeDiff: () => ({
      changed: [{ k: 'page_1::sec_a', n: '상단 배너' }],
      lost: [{ k: 'page_1::sec_z', n: '상세컷 3' }],
      gained: [],
      summary: { same: 5, changed: 1, lost: 1, gained: 0, total: 7 } }) },
  });
  const { box } = await openAndExpand(env);
  assert.ok(!/상세 비교 생략/.test(box.innerHTML), '★멀쩡한 비교를 생략으로 답했다');
  assert.match(box.innerHTML, /달라진 섹션 1[\s\S]*상단 배너/);
  assert.match(box.innerHTML, /지금은 없는 섹션 1[\s\S]*상세컷 3/);
  assert.match(box.innerHTML, /같음 5/);
});

test('C3-8 ★모달을 닫으면 상세 캐시를 버린다 — 다음에 열 땐 «지금»이 달라져 있다', async () => {
  const env = loadUI({ diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  await openAndExpand(env);
  assert.equal(env.calls.diffArgs.length, 1);
  env.win.closeVersionHistory();
  await openAndExpand(env);
  assert.equal(env.calls.diffArgs.length, 2,
    '★닫았다 다시 열었는데 «옛 비교»를 그대로 보여준다 — 그 사이 편집한 내용이 반영되지 않는다');
});

test('C3-9 ★상세 영역을 [hidden] 으로 감추지 않는다 — display 를 주는 클래스에 진다(팀 교훈)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  const fn = src.slice(src.indexOf('function _toggleDetail'), src.indexOf('function formatBytesLocal'));
  assert.ok(!/\.hidden\s*=/.test(fn), '★el.hidden 으로 여닫고 있다 — 화면엔 보이는데 코드는 감췄다고 믿는다');
  assert.match(fn, /style\.display/);
});

/* ═══ [C3검수] 생존 변이 사살 + 「모르면 모른다」 반대편 잠그기 ═══════════ */

test('C3-10 ★«비교 재료 0개»를 「내용이 같습니다」로 답하지 않는다 (치명②)', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 0 },
    versionDiff: { changeDiff: () => ({ changed: [], lost: [], gained: [],
      summary: { same: 0, changed: 0, lost: 0, gained: 0, total: 0 } }) },
  });
  const { box } = await openAndExpand(env);
  assert.ok(!/같습니다/.test(box.innerHTML),
    '★잰 섹션이 0개인데 «유일한 긍정 안심 문구»를 냈다 — 복구하러 온 사용자를 「볼 필요 없다」로 민다');
  assert.match(box.innerHTML, /상세 비교 생략/);
  assert.ok(!/같음 0 · 전체 0/.test(box.innerHTML), '★0/0 집계를 근거처럼 보여주지 않는다');
});

test('C3-11 ★섹션이 «있고» 정말 같을 때만 「같습니다」라고 한다(양성대조 — 문구를 통째로 지우면 빨강)', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 10 },
    versionDiff: { changeDiff: () => ({ changed: [], lost: [], gained: [],
      summary: { same: 4, changed: 0, lost: 0, gained: 0, total: 4 } }) },
  });
  const { box } = await openAndExpand(env);
  assert.match(box.innerHTML, /같습니다/, '★잰 게 있고 전부 같은데 «같다»고 말하지 않으면 답을 안 준 것이다');
  assert.match(box.innerHTML, /같음 4 · 전체 4/);
});

test('C3-12 ★「닫는 중」 도착한 응답이 «폐기한 캐시»를 되살리지 않는다 (치명①)', async () => {
  let release;
  const gate = new Promise(r => { release = r; });
  const env = loadUI({ diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  env.win.electronAPI.historyDiffPayload = async (a) => {
    env.calls.diffArgs.push(a); await gate;
    return { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 };
  };
  await env.win.openVersionHistory({ projectId: 'proj_1', projectName: 'T' });
  const btn = env.byClass.get('.vhist-list').querySelectorAll('[data-vh-detail]')[0];
  const p = btn.click();
  env.win.closeVersionHistory();      // 응답 «전에» 닫는다
  release(); await p; await new Promise(r => setTimeout(r, 10));

  // 다시 열어 펼치면 «새로» 물어봐야 한다 — 그 사이 편집·저장이 있었을 수 있다
  await openAndExpand(env);
  assert.equal(env.calls.diffArgs.length, 2,
    '★닫는 중 도착한 응답이 캐시를 되살렸다 — 편집분이 전혀 반영 안 된 옛 결과를 「같습니다」로 말한다');
});

test('C3-13 ★일시적 실패는 캐시하지 않는다 — 「한 번 더 눌러보기」가 통해야 한다 (중대⑥)', async () => {
  let n = 0;
  const env = loadUI({ diffReply: null });
  env.win.electronAPI.historyDiffPayload = async (a) => {
    env.calls.diffArgs.push(a); n++;
    if (n === 1) return { ok: false, reason: 'exception', message: 'EBUSY: resource busy' };
    return { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 };
  };
  const { btn, box } = await openAndExpand(env);
  assert.match(box.innerHTML, /상세 비교 생략/);
  await btn.click();                    // 접기
  await btn.click();                    // 다시 펼치기 → 재시도해야 한다
  await new Promise(r => setTimeout(r, 20));
  assert.equal(env.calls.diffArgs.length, 2,
    '★한 번 실패한 문구가 캐시로 박혀서, 접었다 펴도 다시 물어보지 않는다(사고 직후에 재시도가 안 통한다)');
  assert.ok(!/상세 비교 생략/.test(box.innerHTML), '★재시도가 성공했는데 옛 실패 문구가 남았다');
});

test('C3-14 ★영구 조건(too_large)은 캐시한다 — 재시도 허용이 «매번 39MB 읽기»가 되면 안 된다', async () => {
  const env = loadUI({ diffReply: { ok: false, reason: 'too_large', bytes: 40 * 1024 * 1024 } });
  const { btn } = await openAndExpand(env);
  await btn.click(); await btn.click();
  await new Promise(r => setTimeout(r, 20));
  assert.equal(env.calls.diffArgs.length, 1, '★용량은 다시 물어도 답이 같다 — 캐시가 맞다');
});

test('C3-15 ★비교 중엔 버튼이 잠긴다 — 연타로 IPC 가 두 번 나가지 않는다 (M10)', async () => {
  let release; const gate = new Promise(r => { release = r; });
  const env = loadUI({ diffReply: null });
  env.win.electronAPI.historyDiffPayload = async (a) => {
    env.calls.diffArgs.push(a); await gate; return { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 };
  };
  await env.win.openVersionHistory({ projectId: 'proj_1', projectName: 'T' });
  const btn = env.byClass.get('.vhist-list').querySelectorAll('[data-vh-detail]')[0];
  const p = btn.click();
  assert.equal(btn.disabled, true, '★비교 중인데 버튼이 안 잠겼다');
  await btn.click();                    // 연타 — 잠겼으면 안 들어간다
  release(); await p; await new Promise(r => setTimeout(r, 10));
  assert.equal(env.calls.diffArgs.length, 1, `★연타로 IPC 가 ${env.calls.diffArgs.length}번 나갔다`);
  assert.equal(btn.disabled, false, '★끝났는데 버튼이 잠긴 채다 — 다시 펼칠 수 없다');
});

test('C3-16 ★too_large 는 «용량»을 같이 말한다 — 숫자가 없으면 사용자가 판단할 수 없다 (M8)', async () => {
  const env = loadUI({ diffReply: { ok: false, reason: 'too_large', bytes: 41 * 1024 * 1024 } });
  const { box } = await openAndExpand(env);
  assert.match(box.innerHTML, /4[01](\.\d+)?MB/, `★용량이 안 붙었다: ${box.innerHTML}`);
});

test('C3-17 ★손실 줄은 «빨강»으로 구분된다 — 다른 줄과 같은 색이면 헤드라인이 아니다 (M12)', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 },
    versionDiff: { changeDiff: () => ({ changed: [{ k: 'p::a', n: '배너' }], lost: [{ k: 'p::z', n: '상세컷' }],
      gained: [{ k: 'p::y', n: '새것' }], summary: { same: 1, changed: 1, lost: 1, gained: 1, total: 4 } }) },
  });
  const { box } = await openAndExpand(env);
  const lostLine = box.innerHTML.split('\n').find(l => /지금은 없는 섹션/.test(l)) || box.innerHTML;
  assert.match(lostLine, /is-lost/, '★손실 줄에 is-lost 가 없다 — CSS 가 --ui-danger 를 못 준다');
  assert.ok(!/is-lost[^>]*>[+✎]/.test(box.innerHTML), '★손실이 아닌 줄에 is-lost 가 붙었다');
});

test('C3-18 ★「지금」 행에는 상세 버튼이 없다 — 자기 자신과 비교할 것이 없다 (M13)', async () => {
  const env = loadUI({ diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  await env.win.openVersionHistory({ projectId: 'proj_1', projectName: 'T' });
  const html = env.byClass.get('.vhist-list').innerHTML;
  // 「지금」 행은 is-current 다. 그 행이 끝나기 «전»에 상세 버튼이 나오면 안 된다.
  const curStart = html.indexOf('is-current');
  const nextRow = html.indexOf('<div class="vhist-row', curStart + 1);
  const currentRow = curStart === -1 ? '' : html.slice(curStart, nextRow === -1 ? html.length : nextRow);
  assert.ok(!/data-vh-detail/.test(currentRow),
    '★「지금」 행에 펼치기가 붙었다 — 누르면 자기 자신과 비교하게 된다');
  assert.equal((html.match(/data-vh-detail="/g) || []).length, 1, '버전 행에는 붙어야 한다(양성대조)');
});

test('C3-19 ★섹션 이름을 «이스케이프»한다 — data-name 은 사용자 입력이다 (M14/M15)', async () => {
  const env = loadUI({
    diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 },
    versionDiff: { changeDiff: () => ({
      changed: [{ k: 'p::a', n: '<img src=x onerror=alert(1)>' }],
      lost: [{ k: 'p::z', n: '<script>bad()</script>' }], gained: [],
      summary: { same: 0, changed: 1, lost: 1, gained: 0, total: 2 } }) },
  });
  const { box } = await openAndExpand(env);
  assert.ok(!/<img src=x/.test(box.innerHTML), '★섹션 이름의 태그가 «날것»으로 들어갔다');
  assert.ok(!/<script>/.test(box.innerHTML), '★스크립트 태그가 날것으로 들어갔다');
  assert.match(box.innerHTML, /&lt;img/, '이스케이프된 형태로는 보여야 한다');
});

test('C3-20 ★main 이 내는 reason 이 «영어 토큰»으로 화면에 나가지 않는다 (경미⑦)', async () => {
  for (const reason of ['no_current', 'current_corrupt', 'corrupt', 'not_found', 'exception', 'unavailable']) {
    const env = loadUI({ diffReply: { ok: false, reason } });
    const { box } = await openAndExpand(env);
    assert.ok(!new RegExp(reason).test(box.innerHTML),
      `★「상세 비교 생략 — ${reason}」이 그대로 나간다`);
    assert.match(box.innerHTML, /상세 비교 생략 — .*[가-힣]/, `${reason} 에 한국어 사유가 없다`);
  }
});

/* ═══ [진입점 재설계] 두 표면이 «동시에» DOM 에 있어도 안 부딪힌다 ════════
 * 설정 페인과 모달이 같은 목록을 그린다. 상세 박스를 전역 id 로 찾으면 같은 id 가 둘이 되고,
 * getElementById 는 «먼저 그려진 쪽»을 집는다 — 설정에서 펼쳤는데 모달 쪽에 그려진다.
 */

test('C3-21 ★두 곳에 마운트해도 «자기 행»의 상세에만 그린다 (전역 id 금지)', async () => {
  const env = loadUI({ diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  // ⒜ 첫 번째 표면(모달)
  await env.win.openVersionHistory({ projectId: 'proj_1', projectName: 'T' });
  const listA = env.byClass.get('.vhist-list');
  const btnA = listA.querySelectorAll('[data-vh-detail]')[0];
  const boxA = btnA.closest('.vhist-row').querySelector('[data-vh-detail-box]');

  // ⒝ 두 번째 표면(설정 페인) — 같은 프로젝트·같은 ts 로 «또» 그린다
  const pane = env.doc.createElement('div');
  pane.innerHTML = '<div class="vhist-intro-text"></div><div class="vhist-list"></div><div class="vhist-status-text"></div>';
  env.doc.body.appendChild(pane);
  await env.win.mountVersionHistory(pane, { projectId: 'proj_1', projectName: 'T' });
  const listB = env.byClass.get('.vhist-list');
  const btnB = listB.querySelectorAll('[data-vh-detail]')[0];
  const boxB = btnB.closest('.vhist-row').querySelector('[data-vh-detail-box]');
  assert.notEqual(boxA, boxB, '전제: 두 표면의 상세 박스는 «다른 노드»다');

  await btnB.click();
  await new Promise(r => setTimeout(r, 20));
  assert.notEqual(boxB.style.display, 'none', '★누른 쪽이 안 열렸다');
  assert.ok(boxB.innerHTML.length > 0, '★누른 쪽에 내용이 없다');
  assert.equal(boxA.style.display, 'none',
    '★안 누른 표면의 상세가 열렸다 — 전역 id 로 찾으면 먼저 그려진 쪽을 집는다');
  assert.equal(boxA.innerHTML, '', '★남의 상세 박스에 내용을 썼다');
});

test('C3-22 ★상세 박스를 «문서 전역»에서 찾지 않는다(코드 규약)', () => {
  const src = fs.readFileSync(path.join(__dirname, '../../js/version-history-ui.js'), 'utf8')
    .replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
  assert.ok(!/getElementById\(`vhist-detail-/.test(src) && !/getElementById\('vhist-detail-/.test(src),
    '★전역 id 로 상세 박스를 찾고 있다 — 두 표면이 같은 id 를 갖는다');
  assert.match(src, /closest\('\.vhist-row'\)/, '★행 안에서 찾아야 한다');
});
