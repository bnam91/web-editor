/* 단위 하네스 — ★1020 W2A 「그라데이션 ★무효화」: 섹션이 자라면 잘린 자리가 ★따라오나.
 *
 * ★현빈 원문: 「그라데이션 올린 섹션에 글을 더 쓰면 잘린 자리가 안 따라온다 — 저장했다 다시 열면 제자리로」
 * ★앱 장면 실측(헤드리스 · 진짜 index.html · 섹션 + 단추 → 스티커 패널 Gradient → 패널 높이 100 →
 *   진짜 마우스로 끌어 내림 → 패널 높이 400 → 제목 더블클릭 후 ★실제 타이핑 · 핀 a42d76d5):
 *     섹션 283 → 1028 · 클립 아랫값 ★300 그대로 · 기대 0 ⇒ ★어긋남 300px (S5 보고서 ②표).
 *     저장본(serializeProject)의 `.grad-fill` 에도 ★옛 값 300 이 실린다 · 다시 열면 로드가 다시 그려 0(= 「제자리로」).
 *
 * ★무엇을 고쳤나(js/blocks/gradient-block.js)
 *   ⑴ ★섹션 감시자 1벌 — ResizeObserver(border-box). ★등록은 한 점(_gradSecOnAdded · #canvas MutationObserver)뿐 — 렌더는 안 올린다(S1).
 *      섹션 상자가 바뀌면 그 섹션의 그라데이션 클립을 ★같은 식(_gradSecClipValue)으로 다시 낸다 · 같은 값이면 안 쓴다.
 *   ⑵ ★추가 입구 — makeGradientBlock 의 렌더는 붙이기 «전»이라 `--sec-clip` 을 ★지웠다(추가 직후 '').
 *      붙이는 순간 단일 등록점이 다시 낸다(W0 · 등록점을 끄면 M1 이 잡는다 — 옛 M4 「붙인 뒤 렌더」는 재작업에서 뺐다).
 *
 *   ⑶ ★넣기 문(1020 W2A 재작업 · 평가 D1) — 섹션 복제(⌘D)·붙여넣기는 js/editor.js _bindPastedEl 을 지나 render 를
 *      안 부른다 ⇒ 사본 섹션이 감시에 안 올라 사본에 글을 쓰면 +300px(평가자 실측 2회). #canvas MutationObserver
 *      (childList·subtree)가 «그라데이션이 들어온 순간» 그 섹션을 올리고 바로 다시 낸다(G1·G2 · M6).
 *
 * ★자 — 가짜 DOM(최소 요소·style·ResizeObserver)에서 ★실제 소스를 .mjs 별칭으로 import 해 돌린다.
 *   ★«브라우저가 크기 변화를 전한다»는 것만 손으로 흉내 낸다(deliver) — 그 밖의 길은 전부 실물 함수다.
 *   ★양성대조: `W2A_GRAD_SRC=<핀 판 gradient-block.js 사본>` 으로 돌리면 같은 칸이 핀 판을 잰다
 *     (기본은 이 레포의 js/blocks/gradient-block.js · 쓰는 파일은 칸 이름 옆 «src» 로 찍는다).
 *
 * ★★못 재는 것(⛔「안전하다」로 읽지 마라):
 *   ⒤ 진짜 브라우저가 ★언제·몇 번 전하나 — 헤드리스 탐침으로만 쟀다(보고서 ③: 타이핑 한 판에 콜백 수).
 *   ⒥ ★화면에 안 그려지는 창에선 ResizeObserver 가 안 온다(js/editor.js:716 실측 주석) — 그 창에서 바뀐 뒤
 *      저장되면 저장본엔 옛 값이 남는다(열면 로드가 다시 그려 맞다). 여기서도 DOM 에서도 ★안 쟀다.
 *   ⒧ A/B 사본·템플릿 넣기·블럭 붙여넣기의 «앱 장면» — 같은 넣기 문을 지나지만 DOM 으로는 섹션 복제(⌘D)만 쟀다.
 *   ⒦ 형제 셋(스티커·목업·확대)의 같은 병 — 범위 밖, 안 고쳤다.
 *
 * ⛔닻에 ★매개변수 목록을 적지 마라 · ⛔닻을 ★변수에 담지 마라(tests/unit/anchor-signature-ratchet.test.mjs).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..', '..');
const SRC_PATH = process.env.W2A_GRAD_SRC || path.join(ROOT, 'js', 'blocks', 'gradient-block.js');
const SRC = fs.readFileSync(SRC_PATH, 'utf8').replace(/\r\n/g, '\n');
const SRC_TAG = `src=${path.basename(SRC_PATH)}@${crypto.createHash('sha256').update(SRC).digest('hex').slice(0, 12)}`;

/* ── 가짜 DOM ─────────────────────────────────────────────────────────────── */
function makeWorld() {
  const W = { writes: 0, ros: [], observeOpts: [], unobserves: 0 };
  class FakeStyle {
    constructor() { this._p = new Map(); }
    set cssText(t) {
      this._p = new Map();
      for (const d of String(t).split(';')) { const i = d.indexOf(':'); if (i > 0) this._p.set(d.slice(0, i).trim(), d.slice(i + 1).trim()); }
    }
    get cssText() { return [...this._p].map(([k, v]) => `${k}:${v};`).join(''); }
    setProperty(k, v) { if (k === '--sec-clip') W.writes++; this._p.set(k, String(v)); }
    getPropertyValue(k) { return this._p.get(k) || ''; }
    removeProperty(k) { this._p.delete(k); }
  }
  class FakeEl {
    constructor(tag = 'div') { this.nodeType = 1; this.tagName = tag.toUpperCase(); this.className = ''; this.id = ''; this.dataset = {}; this.style = new FakeStyle(); this.children = []; this.parentElement = null; this._root = false; this.offsetWidth = 0; this.offsetHeight = 0; }
    get classList() { const el = this; return { contains: (c) => el.className.split(/\s+/).includes(c), add: (c) => { if (!el.classList.contains(c)) el.className = (el.className + ' ' + c).trim(); }, remove: (c) => { el.className = el.className.split(/\s+/).filter(x => x !== c).join(' '); } }; }
    get isConnected() { let e = this; while (e) { if (e._root) return true; e = e.parentElement; } return false; }
    get firstChild() { return this.children[0] || null; }
    _detach() { if (this.parentElement) { const p = this.parentElement; p.children = p.children.filter(c => c !== this); this.parentElement = null; } }
    appendChild(n) { n._detach(); n.parentElement = this; this.children.push(n); return n; }
    insertBefore(n, ref) { n._detach(); n.parentElement = this; const i = ref ? this.children.indexOf(ref) : -1; if (i < 0) this.children.push(n); else this.children.splice(i, 0, n); return n; }
    remove() { this._detach(); }
    cloneNode(deep) {
      const c = new FakeEl(this.tagName); c.className = this.className; c.id = this.id; c.dataset = { ...this.dataset };
      c.style._p = new Map(this.style._p); c.offsetWidth = this.offsetWidth; c.offsetHeight = this.offsetHeight;
      if (deep) for (const ch of this.children) { const cc = ch.cloneNode(true); cc.parentElement = c; c.children.push(cc); }
      return c;
    }
    _matches(sel) { const m = sel.match(/^\.([\w-]+)$/); return !!(m && this.classList.contains(m[1])); }
    closest(sel) { let e = this; while (e) { if (e._matches(sel)) return e; e = e.parentElement; } return null; }
    querySelector(sel) {
      const m = sel.match(/^:scope > (\.[\w-]+)$/);
      if (m) return this.children.find(c => c._matches(m[1])) || null;
      return this.querySelectorAll(sel)[0] || null;
    }
    querySelectorAll(sel) { const out = []; const walk = (e) => { for (const c of e.children) { if (c._matches(sel)) out.push(c); walk(c); } }; walk(this); return { length: out.length, forEach: (f) => out.forEach(f), [Symbol.iterator]: () => out[Symbol.iterator]() }; }
  }
  class FakeRO {
    constructor(cb) { this.cb = cb; this.targets = new Map(); W.ros.push(this); }
    observe(t, o) { this.targets.set(t, o); W.observeOpts.push(o); }
    unobserve(t) { this.targets.delete(t); W.unobserves++; }
    disconnect() { this.targets.clear(); }
  }
  class FakeMO {
    constructor(cb) { this.cb = cb; this.targets = []; W.mos.push(this); }
    observe(t, o) { this.targets.push([t, o]); }
    disconnect() { this.targets = []; }
  }
  W.mos = [];
  /** ★브라우저 흉내 둘째 — 「이 노드들이 #canvas 아래에 들어왔다」(childList 기록)를 지켜보는 자에게 전한다. */
  /* ★L3(1021) — 브라우저처럼 갈라 전한다: subtree 면 #canvas 아래 어디든, 아니면 #canvas «직계» 로 들어온 노드만.
     (옛 판은 subtree 가 없으면 «아무것도» 안 전해 «감시자 죽음»과 «직계만 봄»이 같은 빨강이었다.) */
  W.mutate = (nodes) => {
    let n = 0;
    for (const mo of W.mos) {
      const t = mo.targets.find(([tt, o]) => tt === W.root && o && o.childList);
      if (!t) continue;
      const got = t[1].subtree ? nodes : nodes.filter(nd => nd.parentElement === W.root);
      if (!got.length) continue;
      mo.cb([{ type: 'childList', addedNodes: got }], mo); n++;
    }
    return n;
  };
  /** ★브라우저 흉내 단 하나 — 「이 요소의 크기가 바뀌었다」를 지켜보는 자 전부에게 전한다. */
  W.deliver = (el) => { let n = 0; for (const ro of W.ros) if (ro.targets.has(el)) { ro.cb([{ target: el }], ro); n++; } return n; };
  W.observing = (el) => W.ros.some(ro => ro.targets.has(el));
  W.root = new FakeEl('div'); W.root._root = true; W.root.id = 'canvas';
  W.section = (w, h) => { const s = new FakeEl('div'); s.className = 'section-block'; s.offsetWidth = w; s.offsetHeight = h; W.root.appendChild(s); return s; };
  W.FakeEl = FakeEl; W.FakeRO = FakeRO; W.FakeMO = FakeMO;
  return W;
}

let _seq = 0;
/** 소스(문자열)를 새 세계에서 import — 모듈 상태(감시자)는 import 마다 새로 선다. */
async function load(src) {
  const W = makeWorld();
  globalThis.window = { getSelectedSection: () => W.selected || null, pushHistory: () => {}, scheduleAutoSave: () => {}, buildLayerPanel: () => {}, bindGradientSelect: () => {}, showNoSelectionHint: () => {} };
  globalThis.document = { createElement: (t) => new W.FakeEl(t), getElementById: (id) => (id === 'canvas' ? W.root : null) };
  globalThis.ResizeObserver = W.FakeRO;
  globalThis.MutationObserver = W.FakeMO;
  const alias = path.join(os.tmpdir(), `w2a-grad-${process.pid}-${++_seq}.mjs`);
  fs.writeFileSync(alias, src);
  try { await import(pathToFileURL(alias).href); } finally { fs.unlinkSync(alias); }
  return { W, win: globalThis.window };
}
/** 메뉴 문(addGradientBlock) + ★브라우저가 그 삽입을 #canvas MutationObserver 에 전한다(W.mutate). */
function addG(W, win, opts) { const g = win.addGradientBlock(opts); if (g) W.mutate([g]); return g; }
const fillOf = (g) => g.querySelector(':scope > .grad-fill');
const bottomOf = (g) => { const m = fillOf(g)?.style.getPropertyValue('--sec-clip').match(/inset\(([-\d.]+)px ([-\d.]+)px ([-\d.]+)px ([-\d.]+)px\)/); return m ? Number(m[3]) : null; };

/* ── 장면들(판정 없이 수만 낸다 — 아래 칸과 변이 칸이 같이 쓴다) ─────────────────── */
/** 추가 입구 — 메뉴 단추가 부르는 그 함수(addGradientBlock). 섹션 860×283 · 높이 300 · y 0 ⇒ 기대 17 */
async function sceneAdd(src) {
  const { W, win } = await load(src);
  W.selected = W.section(860, 283);
  const g = addG(W, win, { x: 0, y: 0 });
  return { bottom: bottomOf(g), observing: W.observing(W.selected) };
}
/** 무효화 — 태양/지디 수: 섹션 100 → 350 · clipBottom 300 ⇒ 기대 50 */
async function sceneGrow(src) {
  const { W, win } = await load(src);
  const sec = (W.selected = W.section(860, 100));
  const g = addG(W, win, { x: 0, y: 100, height: 300 });
  win.renderGradientBlock(g);                // 패널 높이 칸(prop-gradient.js rerender)이 부르는 그 꼴
  const b0 = bottomOf(g);
  sec.offsetHeight = 350;                     // 글이 늘어 섹션이 자랐다
  const bStill = bottomOf(g);                 // 전하기 «전» — 섹션만 바뀌고 값은 그대로여야 한다(자가 원인임을 가른다)
  const delivered = W.deliver(sec);
  return { b0, bStill, delivered, b1: bottomOf(g) };
}
/** 같은 크기를 다시 전하면 — 쓰기 수 */
async function sceneNoop(src) {
  const { W, win } = await load(src);
  const sec = (W.selected = W.section(860, 283));
  addG(W, win, { x: 0, y: 0 });
  W.deliver(sec);                             // 처음 관찰(브라우저는 observe 직후 한 번 준다)
  const w0 = W.writes;
  for (let i = 0; i < 5; i++) W.deliver(sec);
  return { observing: W.observing(sec), extraWrites: W.writes - w0 };
}
/** ★L4 — 같은 섹션이 «두 번» 들어온다(드래그로 같은 섹션 안에서 다시 붙음 · 섹션 순서 옮김 = 같은 요소가 다시 들어옴).
 *  WeakSet(:230)이 막아야 observe 는 섹션당 1번. */
async function sceneTwice(src) {
  const { W, win } = await load(src);
  const sec = (W.selected = W.section(860, 283));
  const g = addG(W, win, { x: 0, y: 0 });     // 1번째 들어옴
  sec.appendChild(g); W.mutate([g]);           // 2번째 — 같은 섹션에 같은 블럭이 다시 붙음
  W.root.appendChild(sec); W.mutate([sec]);    // 3번째 — 섹션째 다시 들어옴(순서 옮김)
  return { observeCalls: W.observeOpts.length, observing: W.observing(sec), mutations: 3 };
}
/** 렌더를 여러 번(드래그 = mousemove 마다 렌더) — 관찰 등록 수 · 상자 옵션 */
async function sceneMany(src) {
  const { W, win } = await load(src);
  const sec = (W.selected = W.section(860, 283));
  const g = addG(W, win, { x: 0, y: 0 });
  for (let i = 0; i < 50; i++) win.renderGradientBlock(g, { secW: 860, secH: 283 });
  return { observeCalls: W.observeOpts.length, box: W.observeOpts.map(o => o && o.box), observing: W.observing(sec) };
}
/** 섹션 둘 — 한쪽만 자라면 다른 쪽은 안 건드린다 · 떼어진 섹션은 감시에서 내린다 */
async function sceneTwo(src) {
  const { W, win } = await load(src);
  const a = (W.selected = W.section(860, 100));
  const ga = addG(W, win, { x: 0, y: 0, height: 300 });
  const b = (W.selected = W.section(860, 100));
  const gb = addG(W, win, { x: 0, y: 0, height: 300 });
  const wb0 = bottomOf(gb);
  a.offsetHeight = 250; W.deliver(a);
  const r = { a: bottomOf(ga), b: bottomOf(gb), wb0 };
  b.remove(); W.deliver(b);
  r.bObservedAfterRemove = W.observing(b);
  return r;
}

/** 섹션 복제(⌘D) — ★render 를 안 부르는 넣기 길(js/editor.js _bindPastedEl)을 흉내: 깊은 복제를 #canvas 에 붙이기만 한다.
 *  원본 섹션 283 · 그라데이션 y183 h400 ⇒ 300. 사본이 283→1028 로 자라면 ⇒ 0 이어야 한다(평가 D1 그 장면). */
async function sceneDup(src) {
  const { W, win } = await load(src);
  const a = (W.selected = W.section(860, 283));
  const g = addG(W, win, { x: 0, y: 183, height: 400 });
  win.renderGradientBlock(g);
  const b = a.cloneNode(true);                 // 사본 — 붙여넣기 길은 render·bindGradientSelect 를 안 부른다
  W.root.appendChild(b);
  const mutated = W.mutate([b]);               // 브라우저: 들어온 노드를 MutationObserver 에 전한다
  const gb = b.querySelector(':scope > .gradient-block');
  const b0 = bottomOf(gb);
  const watchedAfterInsert = W.observing(b);
  b.offsetHeight = 1028;                       // 사본 제목에 144자
  const delivered = W.deliver(b);
  return { b0, watchedAfterInsert, mutated, delivered, b1: bottomOf(gb), orig: bottomOf(g) };
}
/** 다른 높이 섹션에 그라데이션 붙여넣기 — 이미 감시 중인 섹션이라 크기 변화(RO)가 없다 ⇒ 들어오는 순간 다시 내야 한다 */
async function scenePasteOther(src) {
  const { W, win } = await load(src);
  const a = (W.selected = W.section(860, 100));
  const g = addG(W, win, { x: 0, y: 0, height: 300 });   // a 기준 200
  const b = (W.selected = W.section(860, 250));
  addG(W, win, { x: 0, y: 0, height: 100 });             // b 를 감시에 올려 둔다
  const p = g.cloneNode(true);                                     // 복사본(값은 a 기준 200 이 박혀 있다)
  b.appendChild(p);
  W.mutate([p]);
  return { copied: 200, b1: bottomOf(p), expected: 50 };
}

/* ── 칸 ──────────────────────────────────────────────────────────────────── */
test(`W0 ★추가 입구 — 메뉴로 넣자마자 섹션 밖이 잘린다(283 섹션 · 300 높이 ⇒ 17) [${SRC_TAG}]`, async () => {
  const r = await sceneAdd(SRC);
  assert.equal(r.bottom, 17, `★추가 직후 클립 아랫값이 ${r.bottom} — makeGradientBlock 의 렌더는 붙이기 전이라 '' 다. 붙인 뒤 다시 그리지 않으면 섹션 밖으로 샌다`);
  assert.equal(r.observing, true, '★추가한 그라데이션의 섹션이 감시자에 안 올랐다 — 다음 글 추가를 못 본다');
});

test(`W1 ★★무효화 — 섹션 100→350 이면 clipBottom 300→50 (태양/지디 수) [${SRC_TAG}]`, async () => {
  const r = await sceneGrow(SRC);
  /* 전제 — 식이 살아 있고(300), 섹션만 바꿔서는 값이 안 바뀐다(★바꾸는 자가 «전하기»임을 가른다 = 항등식 방지) */
  assert.equal(r.b0, 300, `[전제] 렌더 직후 clipBottom 이 300 이 아니다(${r.b0}) — 식 또는 가짜 DOM 이 깨졌다`);
  assert.equal(r.bStill, 300, `[전제] 섹션 높이만 바꿨는데 값이 ${r.bStill} — 이 자는 감시자를 안 잰다`);
  assert.notEqual(50, r.b0, '[전제] 기대값과 시작값이 같으면 이 칸은 아무것도 안 잰다');
  assert.equal(r.b1, 50,
    `★★섹션이 350 으로 자랐는데 클립 아랫값이 ${r.b1} — 감시자가 없거나 안 돈다(지켜보는 자 ${r.delivered}). 현빈 「잘린 자리가 안 따라온다」 그 증상`);
});

test(`W2 ★debounce 대신 «같은 값이면 안 쓴다» — 같은 크기 5번 전해도 쓰기 0 [${SRC_TAG}]`, async () => {
  const r = await sceneNoop(SRC);
  assert.equal(r.observing, true, '[전제] 섹션이 감시자에 안 올랐다 — 쓰기 0 이 «안 돌아서»인지 가를 수 없다');
  assert.equal(r.extraWrites, 0, `★크기가 안 바뀐 전달에 --sec-clip 을 ${r.extraWrites}번 썼다 — 자동저장 감시자(style 쓰기를 편집으로 센다)를 헛되이 깨운다`);
});

test(`W3 ★border-box 를 본다 · 섹션당 한 번만 올린다(넣기 1번 + 렌더 50번 ⇒ observe 1번) [${SRC_TAG}]`, async () => {
  const r = await sceneMany(SRC);
  assert.equal(r.observing, true, '[전제] 섹션이 감시자에 안 올랐다');
  assert.equal(r.observeCalls, 1, `★렌더 50번(드래그)에 observe 를 ${r.observeCalls}번 불렀다 — 섹션당 한 번이어야 한다`);
  assert.deepEqual(r.box, ['border-box'],
    '★감시 상자가 border-box 가 아니다 — 식이 읽는 offsetHeight 는 border-box 라, content-box 면 ★섹션 패딩만 바뀔 때 안 운다');
});

test(`W4 ★제 섹션만 — 다른 섹션 그라데이션은 안 건드리고, 떼어진 섹션은 감시에서 내린다 [${SRC_TAG}]`, async () => {
  const r = await sceneTwo(SRC);
  assert.equal(r.wb0, 200, '[전제] 둘째 섹션 시작값이 200 이 아니다');
  assert.equal(r.a, 50, `★자란 섹션(100→250)의 클립이 ${r.a} — 50 이어야 한다`);
  assert.equal(r.b, 200, `★안 자란 섹션의 클립이 ${r.b} 로 바뀌었다 — 남의 섹션 그라데이션을 건드린다`);
  assert.equal(r.bObservedAfterRemove, false, '★떼어진 섹션을 계속 붙잡는다 — undo·페이지 전환마다 옛 DOM 이 쌓인다');
});

test(`G1 ★★섹션 복제(⌘D) 사본 — 들어오는 순간 감시에 오르고, 사본이 자라면 300→0 (평가 D1) [${SRC_TAG}]`, async () => {
  const r = await sceneDup(SRC);
  assert.equal(r.b0, 300, `[전제] 사본의 시작값이 300 이 아니다(${r.b0}) — 복제 흉내가 깨졌다`);
  assert.equal(r.orig, 300, '[전제] 원본은 안 자랐다 — 300 그대로여야 한다');
  assert.equal(r.watchedAfterInsert, true, `★복제로 들어온 사본 섹션이 감시에 안 올랐다(전한 넣기 감시자 ${r.mutated}) — 붙여넣기 길은 render 를 안 부른다`);
  assert.equal(r.b1, 0, `★★사본이 1028 로 자랐는데 클립 아랫값이 ${r.b1} — 사본에서 글을 더 쓰면 잘린 자리가 안 따라온다(D1)`);
});

test(`G2 ★다른 높이 섹션에 붙여넣은 그라데이션 — 들어오는 순간 그 섹션 기준으로 다시 낸다(200→50) [${SRC_TAG}]`, async () => {
  const r = await scenePasteOther(SRC);
  assert.notEqual(r.copied, r.expected, '[전제] 복사된 값과 기대값이 같으면 이 칸은 아무것도 안 잰다');
  assert.equal(r.b1, r.expected, `★붙여넣은 그라데이션이 옛 섹션 높이로 굳은 값(${r.b1})을 그대로 들고 있다 — 이미 감시 중인 섹션엔 RO 가 안 온다`);
});

/* ── 변이 — 「이 자가 고침을 지키나」. 고친 소스(SRC)를 한 군데씩 망가뜨려 장면이 ★틀린 값을 내는지 ── */
function mutate(src, needle, repl, name) {
  assert.ok(src.includes(needle), `★변이 ${name} 의 바늘을 못 찾았다 — 고침이 없거나(핀 판) 소스가 바뀌었다`);
  return src.replace(needle, repl);
}

test(`M1 ★단일 등록점(_gradSecOnAdded)을 끄면 W0·W1·G1 이 틀린다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, 'function _gradSecOnAdded(node) {\n', 'function _gradSecOnAdded(node) {\n  return;\n', 'M1');
  const r = await sceneGrow(m);
  assert.equal(r.b1, 300, `★등록점을 껐는데 clipBottom 이 ${r.b1} — W1 이 그 점 말고 다른 것을 재고 있다(등록이 둘이다)`);
  const d = await sceneDup(m);
  assert.equal(d.b1, 300, `★등록점을 껐는데 복제 사본 값이 ${d.b1} — 등록이 그 점 밖에도 있다`);
  const a = await sceneAdd(m);
  assert.notEqual(a.bottom, 17, `★등록점을 껐는데 추가 직후 값이 17 — W0 가 그 점 말고 다른 것을 잰다`);
});

test(`S1 ★등록은 한 점 — _watchGradSec 를 부르는 자리는 _gradSecOnAdded 안 하나뿐(렌더는 안 올린다) [${SRC_TAG}]`, async () => {
  const code = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
  const calls = [...code.matchAll(/_watchGradSec\(/g)].length;
  const defs = [...code.matchAll(/function _watchGradSec\(/g)].length;
  assert.equal(defs, 1, '[전제] _watchGradSec 정의가 하나가 아니다');
  assert.equal(calls - defs, 1, `★_watchGradSec 를 부르는 자리가 ${calls - defs}곳 — 등록점이 둘 이상이면 «한 점을 끄면 전부 빨강»이 안 선다`);
  const onAdded = code.slice(code.indexOf('function _gradSecOnAdded('), code.indexOf('function _initGradSecInsertWatch('));
  assert.match(onAdded, /_watchGradSec\(s\)/, '★그 한 자리가 _gradSecOnAdded 안이 아니다');
  const render = code.slice(code.indexOf('function renderGradientBlock('), code.indexOf('function _gradSecClipValue('));
  assert.doesNotMatch(render, /_watchGradSec\(/, '★렌더가 감시자에 올린다 — 둘째 등록점');
});

test(`M2 ★같은 값 생략을 빼면 W2 가 틀린다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, "if (fill.style.getPropertyValue('--sec-clip') !== v) fill.style.setProperty", 'fill.style.setProperty', 'M2');
  const r = await sceneNoop(m);
  assert.ok(r.extraWrites > 0, `★생략을 뺐는데 쓰기 ${r.extraWrites} — W2 는 아무것도 안 잰다`);
});

test(`M3 ★상자를 content-box(기본값)로 두면 W3 가 틀린다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, "_gradSecRO.observe(sec, { box: 'border-box' });", '_gradSecRO.observe(sec);', 'M3');
  const r = await sceneMany(m);
  assert.notDeepEqual(r.box, ['border-box'], '★옵션을 뺐는데 W3 의 자가 border-box 를 본다 — 자가 죽었다');
});

test(`M5 ★떼어진 섹션 내리기를 빼면 W4 가 틀린다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, '    _gradSecRO?.unobserve(sec);\n', '', 'M5');
  const r = await sceneTwo(m);
  assert.equal(r.bObservedAfterRemove, true, '★unobserve 를 뺐는데도 내려졌다 — W4 끝 단언이 그 줄을 안 잰다');
});

test(`M6 ★넣기 감시자(#canvas MutationObserver)를 죽이면 G1·G2 가 틀린다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, '  mo.observe(canvasEl, { childList: true, subtree: true });\n', '', 'M6');
  const r = await sceneDup(m);
  assert.equal(r.b1, 300, `★넣기 감시자를 뗐는데 사본 값이 ${r.b1} — G1 이 그 감시자를 안 잰다`);
  const r2 = await scenePasteOther(m);
  assert.notEqual(r2.b1, r2.expected, `★넣기 감시자를 뗐는데 붙여넣기 값이 기대값(${r2.expected}) 그대로 — G2 가 그 감시자를 안 잰다`);
});

test(`W5 ★같은 섹션이 3번 들어와도 등록은 1번(WeakSet) [${SRC_TAG}]`, async () => {
  const r = await sceneTwice(SRC);
  assert.equal(r.observing, true, '[전제] 섹션이 감시자에 안 올랐다 — observe 수가 «안 돌아서»인지 가를 수 없다');
  assert.equal(r.observeCalls, 1, `★같은 섹션이 ${r.mutations}번 들어왔는데 observe 가 ${r.observeCalls}번 — 섹션당 1번이어야 한다(WeakSet)`);
});

test(`M7 ★WeakSet 막기(:230 «|| _gradSecWatched.has(sec)»)를 빼면 W5 가 틀린다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, "if (typeof ResizeObserver !== 'function' || _gradSecWatched.has(sec)) return;", "if (typeof ResizeObserver !== 'function') return;", 'M7');
  const r = await sceneTwice(m);
  assert.equal(r.observeCalls, 3, `★WeakSet 을 뺐는데 observe ${r.observeCalls}번(예측 3) — W5 가 그 막기를 안 잰다`);
});

test(`M8 ★넣기 감시자를 «직계만»(subtree:false)으로 두면 — G1(섹션째)은 초록 · G2(섹션 안에 붙임)만 빨강 ⇒ M6(죽음)과 다른 빨강 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, '  mo.observe(canvasEl, { childList: true, subtree: true });\n', '  mo.observe(canvasEl, { childList: true, subtree: false });\n', 'M8');
  const d = await sceneDup(m);
  assert.equal(d.b1, 0, `★직계만 봐도 섹션째 들어오는 복제는 잡혀야 한다 — 실측 ${d.b1}(예측 0)`);
  const p = await scenePasteOther(m);
  /* 예측 null — 직계만 보면 섹션 «안»으로 넣은 원본(addGradientBlock)도 못 봐 값이 비고(eval2 DOM 실측 「추가 직후 null」과 같은 꼴),
     그 사본을 섹션 안에 붙여도 못 본다. */
  assert.equal(p.b1, null, `★직계만 보면 섹션 안에 붙인 그라데이션은 못 본다 — 실측 ${p.b1}(예측 null)`);
});

test(`N1 ★무해 변이(주석 한 줄)는 W0~W5·G1·G2 의 수를 안 바꾼다 [${SRC_TAG}]`, async () => {
  const m = mutate(SRC, '/* ★섹션 밖 크롭 식 ★한 벌', '/* (N1 무해 변이) ★섹션 밖 크롭 식 ★한 벌', 'N1');
  assert.deepEqual(await sceneAdd(m), await sceneAdd(SRC));
  assert.deepEqual(await sceneGrow(m), await sceneGrow(SRC));
  assert.deepEqual(await sceneNoop(m), await sceneNoop(SRC));
  assert.deepEqual(await sceneMany(m), await sceneMany(SRC));
  assert.deepEqual(await sceneTwo(m), await sceneTwo(SRC));
  assert.deepEqual(await sceneDup(m), await sceneDup(SRC));
  assert.deepEqual(await scenePasteOther(m), await scenePasteOther(SRC));
  assert.deepEqual(await sceneTwice(m), await sceneTwice(SRC));
});
