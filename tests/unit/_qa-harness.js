/* _qa-harness — `js/blocks/qa-block.js` 를 «진짜로» 돌려보는 단 하나의 하네스.
 * _modal-harness.js 와 같은 원칙: 표도 함수도 베끼지 않는다 — 소스를 vm 에 그대로 올려 실행한다.
 * ESM 문법 두 가지만 벗긴다(import 줄 · 끝의 export 문). 나머지는 한 글자도 안 건드린다.
 *
 * (파일명이 _ 로 시작해 테스트 글롭에 안 걸린다 — 도구다.)
 * ESM(.mjs)에서는 createRequire 로 부른다:
 *   const { loadQAModule } = createRequire(import.meta.url)('./_qa-harness.js');
 */
'use strict';
const assert = require('node:assert/strict');
const path = require('node:path');
const vm = require('node:vm');
const { readSrc } = require('./_srcread.js');

const ROOT = path.join(__dirname, '../..');
const QA_REL = 'js/blocks/qa-block.js';

function qaSrc() {
  return readSrc(ROOT, QA_REL);
}

/**
 * qa-block.js 를 vm 에 올려 실행하고 «내부 이름»을 꺼내 준다.
 * DOM 에 닿는 것은 최소로 스텁한다: document.createElement/getElementById · genId.
 * @param {object} [opts]
 * @param {object} [opts.win]     vm 안의 `window` 로 쓸 그 객체. 안 주면 빈 객체.
 * @param {object} [opts.byId]    document.getElementById 가 찾아줄 {id: block} 맵.
 *   updateQABlock 은 함수 «안에서» document.getElementById(blockId) 를 직접 부르므로,
 *   「실제로 존재하는 블록을 갱신하는」 경로를 재려면 이 맵에 fakeBlock() 을 등록해야 한다.
 *   안 주면 항상 null(= 모든 blockId 가 NOT_FOUND) — 「조회 이전」 검증만 잴 때 쓴다.
 */
function loadQAModule(opts) {
  const body = qaSrc()
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export\s*\{[\s\S]*?\};/, '');
  assert.ok(!/^\s*import\s/m.test(body), 'import 줄을 다 못 벗겼다 — 하네스를 고쳐라');
  assert.ok(!/^\s*export\s/m.test(body), 'export 문을 다 못 벗겼다 — 하네스를 고쳐라');

  const byId = (opts && opts.byId) || {};
  let seq = 0;
  const mkEl = () => fakeBlock();
  const ctx = {
    document: {
      createElement: mkEl,
      getElementById: (id) => byId[String(id)] || null,
    },
    window: (opts && opts.win) || {},
    genId: (p) => `${p}_${++seq}`,
    insertAfterSelected() {}, showNoSelectionHint() {}, bindBlock() {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(
    body + '\n;globalThis.__QA = { makeQABlock, addQABlock, updateQABlock, renderQABlock, bindQABlockEvents };',
    ctx, { filename: QA_REL });
  return ctx.__QA;
}

/** 저장·로드 왕복본처럼 «dataset 만 든» 블록 흉내. renderQABlock 이 실제로 받는 모양 그대로다. */
function fakeBlock(dataset = {}) {
  const set = new Set();
  return {
    className: 'qa-block', id: 'qa_fake', innerHTML: '',
    dataset: Object.assign(Object.create(null), dataset),
    classList: {
      add(...cs) { cs.forEach(c => set.add(c)); },
      remove(...cs) { cs.forEach(c => set.delete(c)); },
      contains(c) { return set.has(c); },
      toggle(c, force) {
        const on = force !== undefined ? force : !set.has(c);
        if (on) set.add(c); else set.delete(c);
        return on;
      },
    },
    style: {},
    appendChild() {}, scrollIntoView() {}, addEventListener() {},
  };
}

module.exports = { loadQAModule, qaSrc, fakeBlock, ROOT, QA_REL };
