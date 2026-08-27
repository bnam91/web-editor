/* U-VD 하네스 — js/version-diff.js (버전 히스토리의 «손실 중심» diff)
 * 실행: node --test "tests/unit/*.test.js"
 * 라이브 userData 무접촉: 이 파일은 디스크를 «읽기»만 한다(모듈 소스 1개). 쓰기 0.
 *
 * ★왜 이 파일에 미니 DOM 이 들어 있나
 *   version-diff 는 렌더러 IIFE(`window.versionDiff = …`)라 node 에서 그냥 require 되지 않고,
 *   changeDiff 는 DOMParser 를 쓴다. 이 레포엔 jsdom/linkedom 이 «없다»(package.json 전수 확인)
 *   — 복구 도구의 단위테스트를 위해 런타임 의존성을 늘리지 않기로 했다.
 *   ⇒ ⑴ 가짜 window 를 인자로 넣어 소스를 «같은 realm 에서» 평가해 모듈을 얻고(vm 금지 — 아래 주석),
 *     ⑵ normSection 이 «실제로 쓰는 API 표면»만 구현한 최소 DOM 을 opts.DOMParser 로 주입한다.
 *   ⚠️ 도구를 안 재고 쓰면 초록이 무의미하다 → MD1~MD3 이 «미니 DOM 자체»를 먼저 검증한다.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');

const SS = require('../../main/project-store/snapshot-store');

/* ═══ 미니 DOM ═══════════════════════════════════════════════════════════ */
const VOID = new Set(['area', 'base', 'br', 'col', 'embed', 'hr', 'img', 'input', 'link', 'meta', 'param', 'source', 'track', 'wbr']);

class MText {
  constructor(t) { this.text = t; this.parent = null; }
  get outerHTML() { return this.text; }
}
class MEl {
  constructor(tag, attrs) { this.tagName = tag; this._attrs = attrs || []; this.childNodes = []; this.parent = null; }
  get id() { return this.getAttribute('id') || ''; }
  hasAttribute(n) { return this._attrs.some(a => a[0] === n); }
  getAttribute(n) { const a = this._attrs.find(x => x[0] === n); return a ? (a[1] === null ? '' : a[1]) : null; }
  setAttribute(n, v) { const a = this._attrs.find(x => x[0] === n); if (a) a[1] = v; else this._attrs.push([n, v]); }
  removeAttribute(n) { this._attrs = this._attrs.filter(x => x[0] !== n); }
  get classList() {
    const self = this;
    const list = () => (self.getAttribute('class') || '').split(/\s+/).filter(Boolean);
    return {
      contains: (c) => list().includes(c),
      add: (...cs) => { const l = list(); for (const c of cs) if (c && !l.includes(c)) l.push(c); self.setAttribute('class', l.join(' ')); },
      remove: (...cs) => { if (!self.hasAttribute('class')) return; self.setAttribute('class', list().filter(c => !cs.includes(c)).join(' ')); },
    };
  }
  get children() { return this.childNodes.filter(n => n instanceof MEl); }
  get firstElementChild() { return this.children[0] || null; }
  get textContent() { return this.childNodes.map(n => (n instanceof MEl) ? n.textContent : n.text).join(''); }
  remove() {
    if (!this.parent) return;
    const i = this.parent.childNodes.indexOf(this);
    if (i >= 0) this.parent.childNodes.splice(i, 1);
    this.parent = null;
  }
  matches(sel) {
    sel = sel.trim();
    if (sel.startsWith('.')) return this.classList.contains(sel.slice(1));
    if (sel.startsWith('#')) return this.id === sel.slice(1);
    if (sel.startsWith('[') && sel.endsWith(']')) return this.hasAttribute(sel.slice(1, -1));
    return this.tagName === sel.toLowerCase();
  }
  querySelectorAll(selList) {
    const sels = String(selList).split(',').map(s => s.trim()).filter(Boolean);
    const out = [];
    const walk = (node) => { for (const c of node.children) { if (sels.some(s => c.matches(s))) out.push(c); walk(c); } };
    walk(this);
    return out;
  }
  cloneNode(deep) {
    const e = new MEl(this.tagName, this._attrs.map(a => a.slice()));
    if (deep) for (const c of this.childNodes) {
      const cc = (c instanceof MEl) ? c.cloneNode(true) : new MText(c.text);
      cc.parent = e; e.childNodes.push(cc);
    }
    return e;
  }
  get innerHTML() { return this.childNodes.map(n => (n instanceof MEl) ? n.outerHTML : n.text).join(''); }
  get outerHTML() {
    const at = this._attrs.map(([n, v]) => (v === null ? ` ${n}` : ` ${n}="${v}"`)).join('');
    if (VOID.has(this.tagName)) return `<${this.tagName}${at}>`;
    return `<${this.tagName}${at}>${this.innerHTML}</${this.tagName}>`;
  }
}
function _tagEnd(html, from) {
  let q = null;
  for (let i = from + 1; i < html.length; i++) {
    const ch = html[i];
    if (q) { if (ch === q) q = null; continue; }
    if (ch === '"' || ch === "'") { q = ch; continue; }
    if (ch === '>') return i;
  }
  return html.length;
}
const ATTR_RE = /([^\s=\/>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
function _parseTag(body) {
  const m = body.match(/^([A-Za-z][^\s\/>]*)/);
  const name = m ? m[1].toLowerCase() : 'div';
  const rest = body.slice(m ? m[1].length : 0);
  const attrs = [];
  ATTR_RE.lastIndex = 0;
  let a;
  while ((a = ATTR_RE.exec(rest)) !== null) {
    const v = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : null));
    attrs.push([a[1], v]);
  }
  return { name, attrs };
}
function parseHTML(html) {
  const root = new MEl('#root', []);
  let cur = root, i = 0;
  const pushText = (t) => { if (!t) return; const n = new MText(t); n.parent = cur; cur.childNodes.push(n); };
  while (i < html.length) {
    const lt = html.indexOf('<', i);
    if (lt === -1) { pushText(html.slice(i)); break; }
    if (lt > i) pushText(html.slice(i, lt));
    if (html.startsWith('<!--', lt)) { const e = html.indexOf('-->', lt); i = (e === -1) ? html.length : e + 3; continue; }
    const gt = _tagEnd(html, lt);
    if (html[lt + 1] === '/') {
      const name = html.slice(lt + 2, gt).trim().toLowerCase();
      let n = cur;
      while (n && n !== root && n.tagName !== name) n = n.parent;
      if (n && n !== root) cur = n.parent || root;
      i = gt + 1; continue;
    }
    const raw = html.slice(lt + 1, gt);
    const selfClose = raw.trimEnd().endsWith('/');
    const { name, attrs } = _parseTag(selfClose ? raw.trimEnd().slice(0, -1) : raw);
    const el = new MEl(name, attrs);
    el.parent = cur; cur.childNodes.push(el);
    if (!selfClose && !VOID.has(name)) cur = el;
    i = gt + 1;
  }
  return root;
}
class MDoc {
  constructor(root) { this.root = root; }
  getElementById(id) {
    const found = this.root.querySelectorAll('#' + id);
    return found[0] || null;
  }
  querySelectorAll(s) { return this.root.querySelectorAll(s); }
}
class FakeDOMParser {
  parseFromString(str) { return new MDoc(parseHTML(str)); }
}

/* ═══ 모듈 로더 ══════════════════════════════════════════════════════════ */
const SRC = fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'version-diff.js'), 'utf8');
/* ★vm.createContext 를 쓰지 않는다 — 다른 realm 에서 만든 배열/객체는 prototype 이 달라
 *   assert.deepEqual 이 「구조는 같은데 reference-equal 이 아니다」로 전부 빨강이 된다.
 *   같은 realm 에서 window 만 인자로 넣어 평가한다(모듈은 DOMParser 를 typeof 로 가드한다). */
function load(windowExtras) {
  const win = Object.assign({}, windowExtras || {});
  new Function('window', SRC)(win);
  return { vd: win.versionDiff, win };
}
const VD = load().vd;
const P = { DOMParser: FakeDOMParser };

/* ═══ 픽스처 ═════════════════════════════════════════════════════════════ */
function sec(id, name, inner = '') {
  return `<div class="section-block" data-section="1" id="${id}"${name ? ` data-name="${name}"` : ''}>`
       + `<div class="section-hitzone"><span class="section-label" draggable="true">${name || id}</span></div>`
       + `<div class="section-inner">${inner}</div></div>`;
}
const S = (...ks) => ks.map(([k, n]) => ({ k, n }));
const keys = (arr) => arr.map(x => x.k);
const names = (arr) => arr.map(x => x.n);

/* ═══ MD — 미니 DOM 자기검증(도구를 먼저 잰다) ═══════════════════════════ */

test('MD1 미니 DOM 라운드트립 — 파싱→outerHTML 이 원문을 보존해야 아래 초록이 의미를 갖는다', () => {
  const html = sec('sec_a', 'A', '<img src="goya-asset://p/aa.png" alt="x"><p>본문</p>');
  const root = parseHTML(`<div id="c">${html}</div>`);
  assert.equal(root.querySelectorAll('#c')[0].innerHTML, html);
});

test('MD2 미니 DOM 의 querySelectorAll·remove·classList 가 normSection 이 기대하는 대로 동작한다', () => {
  const root = parseHTML('<div id="c"><div class="section-block selected"><span class="section-label">L</span><b contenteditable="true">t</b></div></div>');
  const s = root.querySelectorAll('.section-block')[0];
  assert.equal(s.querySelectorAll('.section-label').length, 1);
  s.querySelectorAll('.section-label').forEach(n => n.remove());
  assert.equal(s.querySelectorAll('.section-label').length, 0);
  s.classList.remove('selected');
  assert.equal(s.getAttribute('class'), 'section-block');
  s.querySelectorAll('[contenteditable]').forEach(n => n.removeAttribute('contenteditable'));
  assert.equal(s.outerHTML, '<div class="section-block"><b>t</b></div>');
});

test('MD3 속성값 안의 > 로 태그가 조기 종료되지 않는다(base64/스타일 문자열 방어)', () => {
  const root = parseHTML('<div id="c" data-x="a>b"><i>z</i></div>');
  const d = root.querySelectorAll('#c')[0];
  assert.equal(d.getAttribute('data-x'), 'a>b');
  assert.equal(d.innerHTML, '<i>z</i>');
});

/* ═══ lossDiff ═══════════════════════════════════════════════════════════ */

test('LD1 ★양성대조 — 섹션 3개를 지운 현재본이면 lost 가 «바로 그 3개»(이름까지)여야 한다. 이게 이 기능의 전부다', () => {
  const entry = S(
    ['page_1::sec_a', '히어로'], ['page_1::sec_b', '혜택정리'], ['page_1::sec_c', '스펙표'],
    ['page_1::sec_d', 'FAQ'], ['page_1::sec_e', '배송안내'], ['page_2::sec_f', '리뷰'],
  );
  const current = S(['page_1::sec_a', '히어로'], ['page_1::sec_c', '스펙표'], ['page_2::sec_f', '리뷰']);
  const r = VD.lossDiff(entry, current);
  assert.deepEqual(keys(r.lost), ['page_1::sec_b', 'page_1::sec_d', 'page_1::sec_e']);
  assert.deepEqual(names(r.lost), ['혜택정리', 'FAQ', '배송안내']);
  assert.deepEqual(r.gained, []);
  assert.equal(r.keptCount, 3);
});

test('LD2 ★음성대조 — 같은 입력이면 lost 는 «비어야» 한다. 없으면 「항상 손실 있음」 구현도 LD1 을 통과한다', () => {
  const secs = S(['page_1::sec_a', 'A'], ['page_1::sec_b', 'B'], ['page_1::sec_c', 'C']);
  const r = VD.lossDiff(secs, secs.map(s => ({ ...s })));
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.gained, []);
  assert.deepEqual(r.renamed, []);
  assert.equal(r.keptCount, 3);
  assert.equal(VD.formatLossSummary(r), '');
});

test('LD3 이름만 바꾼 섹션은 «손실이 아니다» — renamed 로 간다. 손실로 세면 복구 대상이 거짓으로 부풀어 목록을 못 믿는다', () => {
  const entry = S(['page_1::sec_a', '혜택정리'], ['page_1::sec_b', 'FAQ']);
  const current = S(['page_1::sec_a', '혜택 정리(수정)'], ['page_1::sec_b', 'FAQ']);
  const r = VD.lossDiff(entry, current);
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.renamed, [{ k: 'page_1::sec_a', from: '혜택정리', to: '혜택 정리(수정)' }]);
  assert.equal(r.keptCount, 2);
});

test('LD4 순서만 바꾼 경우 — 손실 0. 섹션을 위아래로 옮긴 것뿐인데 경고가 뜨면 사용자는 목록을 꺼 버린다', () => {
  const entry = S(['page_1::sec_a', 'A'], ['page_1::sec_b', 'B'], ['page_1::sec_c', 'C']);
  const current = S(['page_1::sec_c', 'C'], ['page_1::sec_a', 'A'], ['page_1::sec_b', 'B']);
  const r = VD.lossDiff(entry, current);
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.gained, []);
  assert.equal(r.keptCount, 3);
});

test('LD5 그 버전 «이후»에 만든 섹션은 gained — lost 에 섞이면 「지금은 없는 섹션 N」이 거짓말이 된다', () => {
  const entry = S(['page_1::sec_a', 'A']);
  const current = S(['page_1::sec_a', 'A'], ['page_1::sec_new', '신규 후기']);
  const r = VD.lossDiff(entry, current);
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.gained, [{ k: 'page_1::sec_new', n: '신규 후기' }]);
  assert.equal(VD.formatLossSummary(r), '');
});

test('LD6 lost/gained 는 «입력 순서»(=캔버스 순서)를 지킨다. 정렬하면 사용자가 화면 기억으로 못 찾는다', () => {
  const entry = S(['p::z', 'Z'], ['p::y', 'Y'], ['p::x', 'X'], ['p::keep', 'K']);
  const current = S(['p::keep', 'K'], ['p::n2', 'N2'], ['p::n1', 'N1']);
  const r = VD.lossDiff(entry, current);
  assert.deepEqual(keys(r.lost), ['p::z', 'p::y', 'p::x']);
  assert.deepEqual(keys(r.gained), ['p::n2', 'p::n1']);
});

test('LD7 빈/null/필드누락 입력에도 «던지지 않는다» — 사고 직후 모달이 통째로 안 뜨는 게 최악이다', () => {
  for (const [a, b] of [[null, null], [undefined, undefined], [[], []], ['nope', 7], [{}, {}], [null, S(['p::a', 'A'])]]) {
    const r = VD.lossDiff(a, b);
    assert.ok(Array.isArray(r.lost) && Array.isArray(r.gained) && Array.isArray(r.renamed));
    assert.equal(typeof r.keptCount, 'number');
  }
  // 원소 단위 쓰레기도 조용히 버린다(전체를 못 쓰게 만들지 않는다)
  const r = VD.lossDiff([null, 3, { n: '키없음' }, { k: 'p::a' }, { k: 'p::b', n: 'B' }], []);
  assert.deepEqual(keys(r.lost), ['p::a', 'p::b']);
  assert.deepEqual(names(r.lost), ['a', 'B']);   // n 누락 시 id 폴백(fingerprint 규약과 같은 결)
});

test('LD8 중복 키는 한 번만 센다 — 손상 인덱스가 같은 섹션을 두 번 실어도 「없는 섹션 6」 같은 거짓 숫자가 안 나온다', () => {
  const entry = S(['p::a', 'A'], ['p::a', 'A 사본'], ['p::b', 'B'], ['p::b', 'B 사본']);
  const rLost = VD.lossDiff(entry, []);
  assert.deepEqual(keys(rLost.lost), ['p::a', 'p::b']);
  assert.equal(VD.formatLossSummary(rLost), '지금은 없는 섹션 2');
  const rKept = VD.lossDiff(entry, S(['p::a', 'A'], ['p::a', 'A'], ['p::b', 'B']));
  assert.equal(rKept.keptCount, 2);
  assert.deepEqual(rKept.lost, []);
});

test('LD9 noid_* 폴백 키 — 인덱스가 같으면 유지, 밀리면 lost+gained 로 «드러낸다»(조용히 같음 처리하지 않는다)', () => {
  const same = VD.lossDiff(S(['p::noid_0', '(이름 없음)'], ['p::sec_a', 'A']), S(['p::noid_0', '(이름 없음)'], ['p::sec_a', 'A']));
  assert.deepEqual(same.lost, []);
  assert.equal(same.keptCount, 2);
  // 앞에 섹션이 하나 생겨 인덱스가 밀린 경우: noid_0 → noid_1
  const shifted = VD.lossDiff(S(['p::noid_0', '(이름 없음)']), S(['p::sec_new', '신규'], ['p::noid_1', '(이름 없음)']));
  assert.deepEqual(keys(shifted.lost), ['p::noid_0']);
  assert.deepEqual(keys(shifted.gained), ['p::sec_new', 'p::noid_1']);
});

/* ═══ formatLossSummary ══════════════════════════════════════════════════ */

test('FS1 손실 0 이면 «빈 문자열» — UI 가 경고 줄 자체를 안 그리는 계약이다(«변경 없음» 같은 말을 지어내지 않는다)', () => {
  assert.equal(VD.formatLossSummary({ lost: [], gained: [{ k: 'p::a', n: 'A' }], renamed: [], keptCount: 1 }), '');
  assert.equal(VD.formatLossSummary([]), '');
});

test('FS2 손실 N 이면 "지금은 없는 섹션 N" 한 개념만 쓴다', () => {
  assert.equal(VD.formatLossSummary({ lost: [{ k: 'p::a', n: 'A' }, { k: 'p::b', n: 'B' }, { k: 'p::c', n: 'C' }] }), '지금은 없는 섹션 3');
  assert.equal(VD.formatLossSummary([{ k: 'p::a', n: 'A' }]), '지금은 없는 섹션 1');
});

test('FS3 쓰레기 입력에도 빈 문자열 — 목록 렌더가 한 줄 때문에 통째로 죽지 않는다', () => {
  for (const bad of [null, undefined, 0, 'x', {}, { lost: 'nope' }]) assert.equal(VD.formatLossSummary(bad), '');
});

/* ═══ changeDiff ═════════════════════════════════════════════════════════ */

test('CD1 ★음성대조 — 같은 캔버스면 changed 0. 「전부 변경」으로 뜨는 순간 이 도구는 노이즈가 된다', () => {
  const html = sec('sec_a', 'A', '<p>본문</p>') + sec('sec_b', 'B', '<img src="goya-asset://p/aa.png">');
  const r = VD.changeDiff({ page_1: html }, { page_1: html }, P);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.gained, []);
  assert.deepEqual(r.summary, { same: 2, changed: 0, lost: 0, gained: 0, total: 2 });
  assert.notEqual(r.mixedEncoding, true);
});

test('CD2 ★양성대조 — 내용이 실제로 바뀐 섹션«만» changed 로 잡힌다', () => {
  const snap = { page_1: sec('sec_a', 'A', '<p>옛 문구</p>') + sec('sec_b', 'B', '<p>그대로</p>') };
  const cur  = { page_1: sec('sec_a', 'A', '<p>새 문구</p>') + sec('sec_b', 'B', '<p>그대로</p>') };
  const r = VD.changeDiff(snap, cur, P);
  assert.deepEqual(keys(r.changed), ['page_1::sec_a']);
  assert.equal(r.summary.same, 1);
  assert.equal(r.summary.total, 2);
});

test('CD3 런타임 클래스·contenteditable·툴바 차이는 «같음» — normSection 재사용의 이유다(가짜 diff 방지)', () => {
  const snap = { page_1: sec('sec_a', 'A', '<p>본문</p>') };
  const cur  = {
    page_1: '<div class="section-block selected" data-section="1" id="sec_a" data-name="A">'
          + '<div class="section-hitzone"><span class="section-label" draggable="true">A</span></div>'
          + '<div class="section-toolbar"><button>x</button></div>'
          + '<div class="section-inner"><p contenteditable="true">본문</p></div></div>',
  };
  const r = VD.changeDiff(snap, cur, P);
  assert.deepEqual(r.changed, [], '런타임 노이즈가 「변경」으로 새면 목록 전체를 못 믿는다');
  assert.equal(r.summary.same, 1);
});

test('CD4 ★문서화된 교환 — 주석(.annotation-block)만 바뀐 섹션은 «같음»으로 나온다(§6-3, 거짓양성이 더 해롭다)', () => {
  const snap = { page_1: sec('sec_a', 'A', '<div class="annotation-block">옛 메모</div><p>본문</p>') };
  const cur  = { page_1: sec('sec_a', 'A', '<div class="annotation-block">새 메모</div><p>본문</p>') };
  const r = VD.changeDiff(snap, cur, P);
  assert.deepEqual(r.changed, [], '이 초록은 «의도»다 — 바꾸려면 §6-3 부터 읽어라');
  assert.equal(r.summary.same, 1);
});

test('CD5 섹션 삭제/추가는 lost/gained 로 갈린다 — changed 에 섞이면 「지금은 없다」를 못 짚는다', () => {
  const snap = { page_1: sec('sec_a', 'A') + sec('sec_b', '혜택정리') + sec('sec_c', 'C') };
  const cur  = { page_1: sec('sec_a', 'A') + sec('sec_c', 'C') + sec('sec_new', '신규') };
  const r = VD.changeDiff(snap, cur, P);
  assert.deepEqual(r.lost, [{ k: 'page_1::sec_b', n: '혜택정리' }]);
  assert.deepEqual(r.gained, [{ k: 'page_1::sec_new', n: '신규' }]);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.summary, { same: 2, changed: 0, lost: 1, gained: 1, total: 4 });
});

test('CD6 순서만 바뀌면 changed 0 · lost 0 — 키가 id 라서 위치에 흔들리지 않는다', () => {
  const a = sec('sec_a', 'A', '<p>1</p>'), b = sec('sec_b', 'B', '<p>2</p>'), c = sec('sec_c', 'C', '<p>3</p>');
  const r = VD.changeDiff({ page_1: a + b + c }, { page_1: c + a + b }, P);
  assert.deepEqual(r.changed, []);
  assert.deepEqual(r.lost, []);
  assert.deepEqual(r.gained, []);
  assert.equal(r.summary.same, 3);
});

test('CD7 ★혼합 인코딩 가드 — 한쪽만 data:image 면 mixedEncoding:true. 이걸 놓치면 이미지 든 섹션이 «전부» 변경으로 뜬다', () => {
  const snap = { page_1: sec('sec_a', 'A', '<img src="goya-asset://p/aa.png">') };
  const cur  = { page_1: sec('sec_a', 'A', '<img src="data:image/png;base64,iVBORw0KGgo=">') };
  const r = VD.changeDiff(snap, cur, P);
  assert.equal(r.mixedEncoding, true);
  assert.deepEqual(keys(r.changed), ['page_1::sec_a'], '경고만 얹고 결과는 그대로 낸다(정규화는 호출측 책임)');
  // 반대 방향(스냅샷이 레거시 base64, 현재본이 정규형)도 같이 잡아야 한다
  assert.equal(VD.changeDiff(cur, snap, P).mixedEncoding, true);
});

test('CD8 양쪽 다 정규형이면 mixedEncoding 플래그가 «없다» — 상시 경고는 경고를 무시하게 만든다', () => {
  const snap = { page_1: sec('sec_a', 'A', '<img src="goya-asset://p/aa.png">') };
  const cur  = { page_1: sec('sec_a', 'A', '<img src="goya-asset://p/bb.png">') };
  const r = VD.changeDiff(snap, cur, P);
  assert.equal('mixedEncoding' in r, false);
  assert.deepEqual(keys(r.changed), ['page_1::sec_a']);
  // 양쪽 다 base64(둘 다 미외부화)도 «혼합»이 아니다
  const b64 = { page_1: sec('sec_a', 'A', '<img src="data:image/png;base64,iVBORw0KGgo=">') };
  assert.equal('mixedEncoding' in VD.changeDiff(b64, b64, P), false);
});

test('CD9 window.marketMerge 가 있으면 «그것»을 쓴다 — 마켓머지/협업과 「바뀌었다」 판정이 갈리면 안 된다', () => {
  let normCalls = 0, hashCalls = 0;
  const { vd } = load({
    marketMerge: {
      normSection: (el) => { normCalls++; return el.outerHTML; },
      hash: (s) => { hashCalls++; return 'H' + s.length; },
    },
  });
  const html = sec('sec_a', 'A', '<p>x</p>');
  const r = vd.changeDiff({ page_1: html }, { page_1: html }, P);
  assert.ok(normCalls >= 2 && hashCalls >= 2, 'marketMerge 를 실제로 호출해야 한다');
  assert.equal(r.summary.same, 1);
});

test('CD10 marketMerge 가 없어도 단독으로 돈다 — 로컬 사본 폴백(테스트/부분 로드 컨텍스트)', () => {
  const { win } = load();
  assert.equal(win.marketMerge, undefined);
  const r = VD.changeDiff({ p: sec('s1', 'S', '<p>a</p>') }, { p: sec('s1', 'S', '<p>b</p>') }, P);
  assert.deepEqual(keys(r.changed), ['p::s1']);
});

test('CD11 DOMParser 가 없으면 «조용한 변경 0» 대신 던진다 — 「달라진 게 없다」는 거짓말이 제일 위험하다', () => {
  assert.throws(() => VD.changeDiff({ p: sec('s1', 'S') }, { p: sec('s1', 'S') }), /DOMParser/);
});

test('CD12 빈/null/비문자열 캔버스맵에도 던지지 않는다', () => {
  for (const [a, b] of [[null, null], [{}, {}], [{ p: '' }, { p: '' }], [{ p: 123 }, { p: null }], ['x', 9]]) {
    const r = VD.changeDiff(a, b, P);
    assert.equal(r.summary.total, 0);
  }
  const r = VD.changeDiff({ p: sec('s1', 'S') }, {}, P);
  assert.deepEqual(keys(r.lost), ['p::s1']);
});

test('CD13 ★키 규약이 snapshot-store.fingerprint 와 «같아야» 한다 — L1(인덱스)과 L2(캔버스)가 다른 키를 쓰면 같은 섹션이 두 번 보인다', () => {
  const pages = [
    { id: 'page_1', canvas: sec('sec_a', 'A') + '<div class="section-block" data-section="2">이름·id 없음</div>' },
    { id: 'page_2', canvas: sec('sec_c', 'C') },
  ];
  const fpKeys = SS.fingerprint({ pages }).secs.map(s => s.k);
  assert.deepEqual(fpKeys, ['page_1::sec_a', 'page_1::noid_1', 'page_2::sec_c'], 'noid 카운터는 «페이지를 가로지르는 전역»이다');
  const map = Object.fromEntries(pages.map(p => [p.id, p.canvas]));
  const r = VD.changeDiff(map, {}, P);
  assert.deepEqual(keys(r.lost), fpKeys, 'changeDiff 도 같은 키를 내야 한다');
});

test('CD14 이름 규약 — data-name → .section-label → id 순(fingerprint 와 같은 결)', () => {
  const withName = sec('sec_a', '혜택정리');
  const labelOnly = '<div class="section-block" id="sec_b"><div class="section-hitzone"><span class="section-label">라벨이름</span></div></div>';
  const bare = '<div class="section-block" id="sec_c"></div>';
  const r = VD.changeDiff({ p: withName + labelOnly + bare }, {}, P);
  assert.deepEqual(names(r.lost), ['혜택정리', '라벨이름', 'sec_c']);
});

test('CD15 lossDiff 와 changeDiff 가 같은 사고에 «같은 답»을 낸다 — 두 층이 어긋나면 사용자는 어느 쪽도 못 믿는다', () => {
  const snapPages = [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_b', '혜택정리') + sec('sec_c', 'C') }];
  const curPages  = [{ id: 'page_1', canvas: sec('sec_a', 'A') + sec('sec_c', 'C') }];
  const l = VD.lossDiff(SS.fingerprint({ pages: snapPages }).secs, SS.fingerprint({ pages: curPages }).secs);
  const c = VD.changeDiff({ page_1: snapPages[0].canvas }, { page_1: curPages[0].canvas }, P);
  assert.deepEqual(l.lost, c.lost);
  assert.equal(VD.formatLossSummary(l), '지금은 없는 섹션 1');
});

test('SY1 ★로컬 사본이 market-merge.normSection 과 «같은 답»을 낸다 — 표준(js/market-merge.js:12)이 바뀌었는데 여기 사본이 안 따라오면 이 테스트가 빨강이 된다', () => {
  // market-merge.js 도 같은 방식(IIFE + window)이라 같은 realm 에서 로드된다.
  const mmWin = {};
  new Function('window', fs.readFileSync(path.join(__dirname, '..', '..', 'js', 'market-merge.js'), 'utf8'))(mmWin);
  assert.equal(typeof mmWin.marketMerge.normSection, 'function');

  // 「같아야 하는 쌍」 = 차이가 «전부» normSection 이 벗기는 것뿐인 쌍.
  const SAME_PAIRS = [
    // 런타임 클래스
    ['<div class="section-block" id="s1"><p>본문</p></div>',
     '<div class="section-block selected dragging" id="s1"><p>본문</p></div>'],
    // section-label · section-toolbar · variation-badge
    ['<div class="section-block" id="s1"><p>본문</p></div>',
     '<div class="section-block" id="s1"><span class="section-label">L</span><div class="section-toolbar"><button>x</button></div><div class="variation-badge">v2</div><p>본문</p></div>'],
    // contenteditable
    ['<div class="section-block" id="s1"><p>본문</p></div>',
     '<div class="section-block" id="s1"><p contenteditable="true">본문</p></div>'],
    // annotation-block · annot-preview (★문서화된 교환)
    ['<div class="section-block" id="s1"><div class="annotation-block">옛 메모</div><p>본문</p></div>',
     '<div class="section-block" id="s1"><div class="annotation-block">새 메모</div><div class="annot-preview">p</div><p>본문</p></div>'],
    // 공백 정규화 — ★«연속 공백을 한 칸으로 접을» 뿐 «지우지는» 않는다.
    //   그래서 「들여쓰기 있음 vs 없음」은 여전히 «변경»으로 잡힌다(내가 여기서 한 번 틀렸다).
    //   실전에선 양쪽 재료가 같은 직렬화기(canonicalize/getSerializedCanvas) 산출이라 문제 없다.
    ['<div class="section-block" id="s1">\n  <p>본문</p>\n</div>',
     '<div class="section-block" id="s1">    <p>본문</p> </div>'],
  ];
  // 「달라야 하는 쌍」 = 진짜 내용 차이. 벗기기가 과하면 여기가 「같음」으로 무너진다(음성대조).
  const DIFF_PAIRS = [
    ['<div class="section-block" id="s1"><p>옛 문구</p></div>',
     '<div class="section-block" id="s1"><p>새 문구</p></div>'],
    ['<div class="section-block" id="s1"><img src="goya-asset://p/aa.png"></div>',
     '<div class="section-block" id="s1"><img src="goya-asset://p/bb.png"></div>'],
    ['<div class="section-block" id="s1" style="padding:10px"><p>본문</p></div>',
     '<div class="section-block" id="s1" style="padding:20px"><p>본문</p></div>'],
  ];

  const local = load().vd;                              // window.marketMerge 없음 → 로컬 사본
  const viaMM = load({ marketMerge: mmWin.marketMerge }).vd;  // 표준 주입
  const verdict = (vd, a, b) => vd.changeDiff({ p: a }, { p: b }, P).summary.changed;

  for (const [a, b] of SAME_PAIRS) {
    assert.equal(verdict(viaMM, a, b), 0, `표준이 「같음」이라야 한다: ${b.slice(0, 60)}`);
    assert.equal(verdict(local, a, b), 0, `로컬 사본이 표준과 갈렸다: ${b.slice(0, 60)}`);
  }
  for (const [a, b] of DIFF_PAIRS) {
    assert.equal(verdict(viaMM, a, b), 1, `표준이 「변경」이라야 한다: ${b.slice(0, 60)}`);
    assert.equal(verdict(local, a, b), 1, `로컬 사본이 표준과 갈렸다: ${b.slice(0, 60)}`);
  }
});
