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

/* ── 최소 DOM — innerHTML 문자열에서 «이 파일이 실제로 찾는 것»만 되살린다 ─── */
function makeDom() {
  const byId = new Map();
  function mkEl(tag) {
    const el = {
      tagName: tag, children: [], _text: '', _html: '', className: '', id: '',
      disabled: false, style: { display: '' }, dataset: {},
      classList: { _s: new Set(), add(c) { this._s.add(c); }, remove(c) { this._s.delete(c); }, contains(c) { return this._s.has(c); } },
      _listeners: {},
      set textContent(v) { this._text = String(v); },
      get textContent() { return this._text; },
      set innerHTML(v) { this._html = String(v); el._hydrate(); },
      get innerHTML() { return this._html; },
      appendChild(c) { this.children.push(c); if (c.id) byId.set(c.id, c); return c; },
      addEventListener(t, fn) { (this._listeners[t] = this._listeners[t] || []).push(fn); },
      removeEventListener() {},
      click() { return Promise.all((this._listeners.click || []).map(fn => fn({ target: this }))); },
      querySelector() { return null; },
      querySelectorAll(sel) {
        const m = /^\[data-vh-([a-z]+)\]$/.exec(sel);
        if (!m) return [];
        return (this._made || []).filter(b => b.dataset[`vh${m[1][0].toUpperCase()}${m[1].slice(1)}`] !== undefined);
      },
      /* innerHTML 에 «심어둔» 버튼/영역을 실제 노드로 되살린다 —
       * 이 파일이 하는 일이 정확히 그것(문자열로 그리고, 그린 걸 다시 찾아 핸들러를 건다)이기 때문이다. */
      _hydrate() {
        this._made = [];
        for (const mm of this._html.matchAll(/data-vh-(detail|open|restore)="(\d+)"/g)) {
          const b = mkEl('button');
          b.dataset[`vh${mm[1][0].toUpperCase()}${mm[1].slice(1)}`] = mm[2];
          b.textContent = mm[1] === 'detail' ? '펼치기' : '';
          this._made.push(b);
        }
        // id 를 가진 노드는 «전부» 되살린다 — 이 파일은 그린 뒤 getElementById 로 다시 찾는다.
        // ★innerHTML 을 다시 넣으면 «새 노드»다 — 옛 노드를 재사용하면 display 같은 상태가
        //   실제 DOM 과 달리 살아남아, 테스트가 있지도 않은 동작을 재게 된다(실제로 C3-8 이 그랬다).
        for (const mm of this._html.matchAll(/id="([^"]+)"/g)) {
          const d = mkEl('div');
          d.id = mm[1];
          if (/^vhist-detail-\d+$/.test(mm[1])) d.style.display = 'none';
          byId.set(mm[1], d);
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
  return { doc, byId, mkEl };
}

const ENTRY = { ts: 1787700000000, file: '1787700000000.json', reason: 'auto', pinned: false,
  canon: 1, bytes: 1024, name: 'T', counts: { pages: 1, sections: 2, blocks: 0, images: 0 },
  secs: [{ k: 'page_1::sec_a', n: 'A' }, { k: 'page_1::sec_b', n: 'B' }], assets: [] };
const CURRENT = { ts: 1787700100000, bytes: 900, projMtimeMs: 1, name: 'T',
  counts: { pages: 1, sections: 2, blocks: 0, images: 0 },
  secs: [{ k: 'page_1::sec_a', n: 'A' }, { k: 'page_1::sec_b', n: 'B' }] };

function loadUI(o = {}) {
  const { doc, byId } = makeDom();
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
  return { win, doc, byId, calls };
}

/** 모달을 열고 «펼치기» 버튼을 실제로 누른다. */
async function openAndExpand(env) {
  await env.win.openVersionHistory({ projectId: 'proj_1', projectName: 'T' });
  const list = env.doc.getElementById('vhist-list');
  const btn = list.querySelectorAll('[data-vh-detail]')[0];
  assert.ok(btn, '★「펼치기」 버튼이 그려지지 않았다');
  await btn.click();
  return { btn, box: env.doc.getElementById(`vhist-detail-${ENTRY.ts}`) };
}

/* ═══════════════════════════════════════════════════════════════════════ */

test('C3-1 ★「펼치기」를 누르면 그 버전 ts 로 diff 페이로드를 «부른다»', async () => {
  const env = loadUI({ diffReply: { ok: true, ts: ENTRY.ts, snapCanvas: { page_1: '<div></div>' }, curCanvas: { page_1: '<div></div>' }, bytes: 20 } });
  const { btn, box } = await openAndExpand(env);
  assert.deepEqual(env.calls.diffArgs, [{ projectId: 'proj_1', ts: ENTRY.ts }],
    '★목록을 그릴 때가 아니라 «누를 때» 한 번, 그 행의 ts 로 불러야 한다');
  assert.equal(box.style.display, 'block', '★펼쳤는데 안 보인다');
  assert.equal(btn.textContent, '접기', '★상태가 버튼에 안 비친다');
});

test('C3-2 ★다시 누르면 접힌다 — 그리고 두 번 부르지 않는다(캐시)', async () => {
  const env = loadUI({ diffReply: { ok: true, snapCanvas: {}, curCanvas: {}, bytes: 1 } });
  const { btn, box } = await openAndExpand(env);
  await btn.click();
  assert.equal(box.style.display, 'none');
  assert.equal(btn.textContent, '펼치기');
  await btn.click();
  assert.equal(box.style.display, 'block');
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
