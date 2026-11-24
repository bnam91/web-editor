/* layout-section-shapes — 표준 Layout 부품(js/props/_layout-section.js) 마크업 꼴(소비자 C1·C2 요청 · 탑 261125)
 *   패딩 슬롯 넷(좌우+상하 · 좌우만 · 네 면 한 값 · L/R + 옛 사슬) · 축마다 범위 · 간격 label · 간격 두 칸 · 블럭 슬롯 숫자 · one 아이콘 · 사슬 막힘 까닭
 * ★소스를 vm 에 그대로 올려 «진짜로» 부른다(import 한 줄만 가짜 wireNumberScrub 로 바꾼다 — 배선은 DOM spec layout-std-parts 몫). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const src = fs.readFileSync(path.join(ROOT, 'js', 'props', '_layout-section.js'), 'utf8')
  .replace(/^import .*$/m, 'const wireNumberScrub = () => {};')
  .replace(/^export (const|function) /gm, '$1 ');
const names = ['layoutSizeRowHTML', 'layoutPadSlotHTML', 'layoutGapSlotHTML', 'layoutSlotNumberHTML', 'LAY_FULLW_WHY'];
const L = vm.runInNewContext(`${src}\n({ ${names.join(', ')} })`, {});
const ids = (h) => [...h.matchAll(/ id="([^"]*)"/g)].map((m) => m[1]);
const attr = (h, id, a) => new RegExp(`id="${id}"[^>]*\\b${a}="([^"]*)"`).exec(h)?.[1] ?? null;
const labels = (h) => [...h.matchAll(/<div class="ui-s2-cell"><span>([^<]*)<\/span>/g)].map((m) => m[1]);

test('P1 패딩 좌우만 — y 칸 없음 · id="undefined" 0', () => {
  const h = L.layoutPadSlotHTML({ xId: 'p-x', x: 8, max: 100 });
  assert.deepEqual(ids(h), ['p-x-scrub', 'p-x']);
  assert.ok(!h.includes('undefined'));
});

test('P2 패딩 축마다 범위 — xMax/yMax(·Min) 가 축 칸에 · 없으면 max/min', () => {
  const h = L.layoutPadSlotHTML({ xId: 'c-px', yId: 'c-py', x: 10, y: 5, max: 999, xMax: 160, yMax: 80, yMin: 2 });
  assert.deepEqual([attr(h, 'c-px', 'max'), attr(h, 'c-py', 'max'), attr(h, 'c-px', 'min'), attr(h, 'c-py', 'min')], ['160', '80', '0', '2']);
  const d = L.layoutPadSlotHTML({ xId: 'd-px', yId: 'd-py', x: 1, y: 1, max: 120 });
  assert.deepEqual([attr(d, 'd-px', 'max'), attr(d, 'd-py', 'max')], ['120', '120']);
  assert.deepEqual(labels(h), ['Padding', '']);
});

test('P3 패딩 네 면 한 값 — 칸 하나(allId) · data-slot pad-all', () => {
  const h = L.layoutPadSlotHTML({ allId: 'icd-pad', all: 12, max: 80 });
  assert.deepEqual(ids(h), ['icd-pad-scrub', 'icd-pad']);
  assert.match(h, /data-slot="pad-all"/);
  assert.equal(attr(h, 'icd-pad', 'value'), '12');
});

test('P4 패딩 L/R 두 칸 + 블럭의 옛 사슬 id 그대로(배선은 블럭)', () => {
  const h = L.layoutPadSlotHTML({ lId: 'stb-padl', rId: 'stb-padr', l: 4, r: 6, max: 200, chainId: 'stb-ph-chain', chainOn: true });
  assert.deepEqual(ids(h), ['stb-padl-scrub', 'stb-padl', 'stb-padr-scrub', 'stb-padr', 'stb-ph-chain']);
  assert.deepEqual(labels(h), ['L', 'R']);
  assert.equal(attr(h, 'stb-ph-chain', 'aria-pressed'), 'true');
  assert.ok(!/ui-lay-spacer/.test(h), '사슬이 끝 칸을 쓴다');
  const n = L.layoutPadSlotHTML({ lId: 'a-l', rId: 'a-r', l: 0, r: 0, max: 10 });
  assert.ok(/ui-lay-spacer/.test(n) && !/prop-chain-btn/.test(n), '사슬 없으면 빈칸');
});

test('P5 간격 — label · 두 칸(가로 ↔ / 세로 ↕) · 한 칸 기본 Gap', () => {
  assert.deepEqual(labels(L.layoutGapSlotHTML({ id: 'g', value: 8, max: 50 })), ['Gap']);
  assert.deepEqual(labels(L.layoutGapSlotHTML({ id: 'g', value: 8, max: 50, label: 'Item gap' })), ['Item gap']);
  const two = L.layoutGapSlotHTML({ xId: 'crt-gapx', yId: 'crt-gapy', x: 4, y: 6, max: 100, yMax: 40 });
  assert.deepEqual(ids(two), ['crt-gapx-scrub', 'crt-gapx', 'crt-gapy-scrub', 'crt-gapy']);
  assert.match(two, /data-slot="gap-xy"/);
  assert.deepEqual([attr(two, 'crt-gapx', 'max'), attr(two, 'crt-gapy', 'max')], ['100', '40']);
});

test('P6 블럭 슬롯 숫자 — 이름 + [중립 아이콘 숫자] · 끝 단추 없음 · step 그대로', () => {
  const h = L.layoutSlotNumberHTML({ id: 'annot-dim', label: '치수', value: 1.5, min: 0, max: 10, step: 0.1 });
  assert.deepEqual(ids(h), ['annot-dim-scrub', 'annot-dim']);
  assert.equal(attr(h, 'annot-dim', 'step'), '0.1');
  assert.match(h, /<span class="prop-label">치수<\/span>/);
  assert.ok(!/prop-chain-btn/.test(h));
});

test('P7 one 아이콘 — 기본 w(↔) · h(↕) · px(중립)', () => {
  const pathOf = (icon) => /<svg[^>]*>(.*?)<\/svg>/.exec(L.layoutSizeRowHTML({ prefix: 'q', one: { id: 'q-one', label: 'Height', value: 40, max: 200, icon } }))[1];
  const w = pathOf(undefined), hh = pathOf('h'), px = pathOf('px');
  assert.ok(w.includes('M1.5 6h9'), '기본 = ↔');
  assert.ok(hh.includes('M6 1.5v9'), 'h = ↕');
  assert.ok(px !== w && px !== hh, 'px = 중립');
});

test('P8 사슬 막힘(꽉참) — aria-disabled + 까닭 · 켬 표시 끔', () => {
  const h = L.layoutSizeRowHTML({ prefix: 'a', w: { id: 'a-w', value: 860, max: 860 }, h: { id: 'a-h', value: 780, max: 1600 }, chain: { on: true, blocked: L.LAY_FULLW_WHY } });
  assert.deepEqual([attr(h, 'a-ratio', 'aria-pressed'), attr(h, 'a-ratio', 'aria-disabled'), attr(h, 'a-ratio', 'title')], ['false', 'true', '너비가 줄 폭에 맞춰져 있어 비율을 묶을 수 없어요']);
  const f = L.layoutSizeRowHTML({ prefix: 'b', w: { id: 'b-w', value: 400, max: 860 }, h: { id: 'b-h', value: 300, max: 1600 }, chain: { on: true } });
  assert.deepEqual([attr(f, 'b-ratio', 'aria-pressed'), /id="b-ratio"[^>]*aria-disabled/.test(f)], ['true', false]);
});

/* ── 배선(C1 261125 버그): read() 없는 축 — 편집 전 값은 «마지막으로 먹은 값» · 빈 칸 되돌림에 NaN 0 · 지우고 치면 사슬 비율은 옛 값 ── */
function wireRig(axes, chain) {
  class El { get value() { return this._v; } set value(v) { this._v = String(v); }   // input.value 처럼 늘 문자열
    constructor(v) { this.value = v; this.l = {}; this.disabled = false; this.attrs = {}; this.classList = { toggle() {} }; }
    addEventListener(t, f) { (this.l[t] ||= []).push(f); } fire(t) { (this.l[t] || []).forEach((f) => f({})); }
    getAttribute(k) { return this.attrs[k] ?? null; } setAttribute(k, v) { this.attrs[k] = String(v); } removeAttribute(k) { delete this.attrs[k]; } }
  const els = Object.fromEntries(axes.map(([id, v]) => [id, new El(v)]));
  const calls = Object.fromEntries(axes.map(([id]) => [id, []]));
  let commits = 0;
  const ctx = { document: { getElementById: (id) => els[id] ?? null }, window: {} };
  const W = vm.runInNewContext(`${src}\nwireLayoutSection`, ctx);
  const ax = (id, max) => ({ numberId: id, max, apply: (v) => calls[id].push(v) });
  W({ commit: () => commits++, w: ax(axes[0][0], 1000), h: axes[1] ? ax(axes[1][0], 1000) : undefined, chain });
  const type = (id, v) => { els[id].value = String(v); els[id].fire('input'); };
  const change = (id) => els[id].fire('change');
  return { els, calls, type, change, commits: () => commits };
}

test('P9 read 없는 축 — 비우고 change = 옛 값 되돌림 · apply 에 NaN 0 · 이력 0', () => {
  const r = wireRig([['pd', 24]]);
  r.type('pd', ''); r.change('pd');
  assert.equal(r.els.pd.value, '24');
  assert.ok(r.calls.pd.every(Number.isFinite), `NaN apply: ${r.calls.pd}`);
  assert.equal(r.commits(), 0);
  /* 쳐서 바꿨다가(36 그림) 비우고 change → 24 로 되그림 */
  r.type('pd', 36); r.type('pd', ''); r.change('pd');
  assert.deepEqual([r.els.pd.value, r.calls.pd.at(-1), r.commits()], ['24', 24, 0]);
  /* 먹은 값 뒤에는 그 값이 «전 값» */
  r.type('pd', 40); r.change('pd'); r.type('pd', ''); r.change('pd');
  assert.deepEqual([r.els.pd.value, r.calls.pd.every(Number.isFinite), r.commits()], ['40', true, 1]);
});

test('P10 read 없는 축 + 사슬 — 지우고 치면 비율 = 옛 값(200:100) · 끌기처럼 input 여러 번도 같은 비율', () => {
  const r = wireRig([['w', 200], ['h', 100]], { id: 'none', on: true, set() {} });
  r.type('w', ''); r.type('w', 3); r.type('w', 30); r.type('w', 300); r.change('w');
  assert.deepEqual([r.els.w.value, r.els.h.value], ['300', '150']);
  assert.ok([...r.calls.w, ...r.calls.h].every(Number.isFinite));
  r.type('w', 301); r.type('w', 302); r.change('w');   // 다음 편집 = 먹은 값(300:150) 기준
  assert.equal(r.els.h.value, '151');
});
