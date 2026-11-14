/* cert-render-smoke.test.mjs — Documents(cert-block) 렌더 «실제로 돈다» 단위 (2026-11-14 · 태양)
 * 왜: e32eabd44 에서 _renderGridStage 가 받지 않은 forOutput 을 써서 «기본(격자) 블럭 추가가 전부 ReferenceError» 였다.
 *     node --check 는 문법만 보고, 다른 단위는 cert-block.js 를 «읽기만» 해서 아무도 못 잡았다(DOM 스펙은 srv 에서 못 돈다).
 * 무엇: 최소 가짜 DOM 위에서 makeCertBlock(메뉴 추가와 같은 길) + renderCertBlock 을 모드 2 × 출력 2 × 간격 2 로 실제로 부른다.
 *   · 바깥 import 네 줄(drag-utils · drag-drop · checker-tokens · prop-grid)만 작은 대역으로 바꾸고 cert-layout.js 는 진짜를 쓴다.
 *   · 바꾼 소스와 cert-layout.js(.mjs 로 — node 는 .js 를 CommonJS 로 읽는다)를 공용 임시 우산(mkTmpRoot)에 쓰고 file: URL 로 싣는다(win-portability ②-4 · tmproot).
 * ⑯ 폭: 매 렌더(출력 포함)가 dataset.width 로 블럭 폭을 세운다 — renderCertBlock 의 applyCertWidth 를 빼면 S2 빨강(인텔 P27 이 DOM RH1 을 못 빨갛게 한 그 줄).
 * 양성대조: e32eabd44 의 cert-block.js(= `_renderGridStage(st)` 가 forOutput 을 안 받던 판)로 돌리면 S1·S2 빨강(실측 · ReferenceError 5건).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { mkTmpRoot } from './_tmproot.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');

class CL {
  constructor() { this.s = new Set(); }
  add(...a) { a.forEach((x) => this.s.add(x)); }
  remove(...a) { a.forEach((x) => this.s.delete(x)); }
  contains(x) { return this.s.has(x); }
  toggle(x, on) { ((on ?? !this.s.has(x)) ? this.s.add(x) : this.s.delete(x)); }
}
class El {
  constructor(tag) {
    this.tagName = tag.toUpperCase(); this.children = []; this.parentElement = null; this.classList = new CL();
    this.dataset = {}; this.style = { cssText: '', removeProperty() {} }; this.attrs = {}; this.isConnected = true;
  }
  set className(v) { this.classList = new CL(); String(v).split(/\s+/).filter(Boolean).forEach((c) => this.classList.add(c)); }
  get className() { return [...this.classList.s].join(' '); }
  appendChild(c) { c.parentElement = this; this.children.push(c); return c; }
  append(...cs) { cs.forEach((c) => this.appendChild(c)); }
  remove() { const p = this.parentElement; if (p) p.children = p.children.filter((x) => x !== this); }
  setAttribute(k, v) { this.attrs[k] = v; }
  getAttribute(k) { return this.attrs[k]; }
  addEventListener() {}
  closest() { return null; }
  _all() { return this.children.flatMap((c) => [c, ...c._all()]); }
  _match(sel) {
    return sel.split(',').map((x) => x.trim()).some((x) => {
      const m = x.replace(/^:scope\s*>\s*/, '').match(/^\.([\w-]+)(?:\.([\w-]+))?/);
      return !!m && this.classList.contains(m[1]) && (!m[2] || this.classList.contains(m[2]));
    });
  }
  querySelectorAll(sel) { return (/:scope\s*>/.test(sel) ? this.children : this._all()).filter((e) => e._match(sel)); }
  querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
}

async function loadCert() {
  globalThis.document = { createElement: (t) => new El(t), body: new El('body'), querySelector: () => null, querySelectorAll: () => [] };
  globalThis.window = globalThis;
  globalThis.getComputedStyle = () => ({});
  let src = fs.readFileSync(path.join(ROOT, 'js', 'blocks', 'cert-block.js'), 'utf8');
  const stub = [
    [/^import \{ genId, insertAfterSelected \} from '\.\.\/drag-utils\.js';/m, "let __n = 0; const genId = (p) => p + '_' + (++__n); const insertAfterSelected = () => {};"],
    [/^import \{ bindBlock \} from '\.\.\/drag-drop\.js';/m, 'const bindBlock = () => {};'],
    [/^import \{ checkerBg \} from '\.\.\/checker-tokens\.js';/m, "const checkerBg = () => 'conic-gradient(#eee 0 25%)';"],
    [/^import \{ grdImageFileOk, grdPickedImageSrc, grdPickImageFile \} from '\.\.\/props\/prop-grid\.js';/m, "const grdImageFileOk = () => true, grdPickedImageSrc = async () => '', grdPickImageFile = () => {};"],
    [/from '\.\/cert-layout\.js'/, "from './cert-layout.mjs'"],   // cert-layout.js 는 «진짜»(import 0) — 같은 우산에 .mjs 로 복사
  ];
  for (const [re, to] of stub) { assert.match(src, re, `[전제] cert-block.js import 꼴이 바뀌었다: ${re}`); src = src.replace(re, to); }
  assert.doesNotMatch(src, /^import .* from '\.\.?\/(?!cert-layout\.mjs')/m, '[전제] 대역 안 된 상대 import 가 남았다');
  const dir = mkTmpRoot('cert-render-smoke-');
  fs.copyFileSync(path.join(ROOT, 'js', 'blocks', 'cert-layout.js'), path.join(dir, 'cert-layout.mjs'));
  fs.writeFileSync(path.join(dir, 'cert-block.mjs'), src);
  await import(pathToFileURL(path.join(dir, 'cert-block.mjs')).href);
  assert.equal(typeof globalThis.renderCertBlock, 'function', '[전제] window.renderCertBlock');
}

const IMG = 'data:image/png;base64,iVBORw0KGgo=';

test('S1 메뉴 추가와 같은 길 — makeCertBlock(기본 격자)이 던지지 않고 용지를 그린다', async () => {
  await loadCert();
  const { block } = globalThis.makeCertBlock();
  assert.equal(block.dataset.mode, 'grid', '[전제] ⑩ 기본 = 격자');
  assert.ok(block.querySelectorAll('.cert-sheet').length >= 1, '용지 0장');
});

test('S2 모드 2 × 출력 2 × 간격(양·음) — 던지지 않음 · ✕ 는 편집에만(⑲)', async () => {
  await loadCert();
  for (const mode of ['grid', 'stack']) for (const forOutput of [false, true]) for (const gap of ['16', '-40']) {
    const b = document.createElement('div');
    b.className = 'cert-block';
    Object.assign(b.dataset, { mode, gapX: gap, gapY: gap, samples: 'on', overlap: 'right', width: '500', callouts: 'on' });
    b.dataset.certs = JSON.stringify([{ img: IMG, crop: { size: 120, x: -5, y: -3 } }, { img: '' }, { img: IMG }, { img: '' }]);
    globalThis.renderCertBlock(b, { forOutput });
    const x = b.querySelectorAll('.cert-sheet-clear').length;
    assert.equal(x, forOutput ? 0 : 2, `${mode} forOutput=${forOutput} gap=${gap}: ✕ ${x}`);
    assert.equal(b.style.width, '500px', `${mode} forOutput=${forOutput}: ⑯ 폭은 dataset.width 에서 렌더가 세운다(인라인을 베끼지 않고)`);
  }
});
