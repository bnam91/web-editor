/* _grid-ifg-harness — 1013t2F(칸 테두리 «선 자리» · 인포그래픽 프리셋) 유닛 두 파일의 공용 하네스.
 *   grid-cell-border.test.js 의 미니 DOM·import 갈아끼우기와 «같은 표면»이다(새 하네스를 발명하지 않는다).
 *   (파일명이 _ 로 시작해 테스트 글롭에 안 걸린다 — 도구다.)
 * ★loadGrid(mutate) — grid-block.js 를 임시 폴더에 «grid-block.js» 이름으로 얹고, 원하면 grid-infographic.js 도 «같은 폴더»에
 *   얹어 그 모듈의 `./grid-block.js` import 가 «같은 인스턴스»를 보게 한다(⛔스텁 아님 — 실물 둘).
 * ★mutate(src, which) — 음성대조용 소스 비틀기. which = 'grid' | 'ifg' | 'pick'. 주입이 «안 먹으면» 그 자리에서 죽는다.
 * ★1017t1i2 — `js/blocks/grid-ifg-icon-pick.js`(더블클릭 → iconify 고르개 배선)도 ★같은 폴더에 얹는다.
 *   ★그 모듈은 아무것도 import 하지 «않는다»(window 다리만) — 그래도 ★같은 폴더에 둬야 변이를 주입할 수 있고,
 *     grid-infographic.js 가 걸어 둔 `window.GRID_IFG_PRESETS` 를 ★같은 인스턴스로 본다(색 대타가 그걸 읽는다).
 *   ★돌려 받는 셋째 칸 `C` = 그 모듈. withIfg 가 거짓이면 null.
 *   ⛔「내장 아이콘 35종 명부」는 ★없다 — 현빈 정정(2026-10-20)으로 걷혔다. 아이콘은 iconify 에서 온다. */
'use strict';
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { pathToFileURL } = require('url');
const { readSrc } = require('./_srcread.js');
const { mkTmpRoot } = require('./_tmproot.js');

const REPO = path.join(__dirname, '../../');
const GRID_RAW = readSrc(REPO, 'js/blocks/grid-block.js');
const IFG_RAW = readSrc(REPO, 'js/blocks/grid-infographic.js');
const PICK_RAW = readSrc(REPO, 'js/blocks/grid-ifg-icon-pick.js');

function makeFakeDom() {
  const registry = new Map();
  function createElement(tag) {
    let _id = '', _classes = new Set();
    const el = {
      tagName: tag, dataset: {}, style: {}, innerHTML: '', children: [],
      get id() { return _id; },
      set id(v) { if (_id) registry.delete(_id); _id = v; if (v) registry.set(v, el); },
      get className() { return [..._classes].join(' '); },
      set className(v) { _classes = new Set(String(v).split(/\s+/).filter(Boolean)); },
      classList: {
        contains: (c) => _classes.has(c),
        add: (...cs) => cs.forEach(c => _classes.add(c)),
        remove: (...cs) => cs.forEach(c => _classes.delete(c)),
        replace: (a, b) => { if (!_classes.has(a)) return false; _classes.delete(a); _classes.add(b); return true; },
      },
      appendChild(child) { return child; },
      /* 블럭 배경(G12) 렌더가 셸 앞뒤에 덧붙인다 — 문자열로 흉내(E4 의 배경 켬 갈래용) */
      insertAdjacentHTML(pos, html) { el.innerHTML = /begin/.test(pos) ? html + el.innerHTML : el.innerHTML + html; },
      scrollIntoView() {},
    };
    return el;
  }
  return { createElement, getElementById: (id) => registry.get(id) || null };
}

let seq = 0;
async function loadGrid({ mutate = null, withIfg = false, gridSrc = GRID_RAW, pickSrc = PICK_RAW } = {}) {
  const dir = mkTmpRoot(`gifg-${seq++}-`);   // ★치우기는 공용 자(_tmproot.js)가 쥔다 — tmproot-sole-owner
  let src = gridSrc;
  const b0 = src;
  src = src.replace(
    "import { insertAfterSelected, genId } from '../drag-utils.js';\nimport { bindBlock } from '../drag-drop.js';\n",
    "const insertAfterSelected = () => {};\nconst genId = (p) => `${p}_` + Math.random().toString(36).slice(2, 9);\nconst bindBlock = () => {};\n");
  assert.notEqual(src, b0, '★소스에서 drag-utils/drag-drop import 2줄을 못 찾았다 — 리팩터링됐나?');
  fs.copyFileSync(path.join(REPO, 'js/grid-cell-resize.js'), path.join(dir, 'gcr.mjs'));
  fs.copyFileSync(path.join(REPO, 'js/util/sanitize-rich-text.js'), path.join(dir, 'srt.mjs'));
  const b1 = src;
  src = src.replace("from '../grid-cell-resize.js'", 'from ' + JSON.stringify(pathToFileURL(path.join(dir, 'gcr.mjs')).href));
  assert.notEqual(src, b1, '★grid-cell-resize.js import 를 못 찾았다');
  const b2 = src;
  src = src.replace("from '../util/sanitize-rich-text.js'", 'from ' + JSON.stringify(pathToFileURL(path.join(dir, 'srt.mjs')).href));
  assert.notEqual(src, b2, '★sanitize-rich-text.js import 를 못 찾았다');
  if (mutate) {
    const bm = src;
    src = mutate(src, 'grid');
    assert.ok(typeof src === 'string');
    if (!withIfg) assert.notEqual(src, bm, '★변이가 주입되지 않았다 — 음성대조가 «아무것도 안 바꾼 채» 돌 뻔했다');
  }
  fs.writeFileSync(path.join(dir, 'grid-block.js'), src);
  globalThis.document = makeFakeDom();
  globalThis.window = {};
  const G = await import(pathToFileURL(path.join(dir, 'grid-block.js')).href);
  let I = null, C = null;
  if (withIfg) {
    let isrc = IFG_RAW;
    if (mutate) isrc = mutate(isrc, 'ifg');
    let csrc = pickSrc;
    if (mutate) csrc = mutate(csrc, 'pick');
    fs.writeFileSync(path.join(dir, 'grid-ifg-icon-pick.js'), csrc);
    fs.writeFileSync(path.join(dir, 'grid-infographic.js'), isrc);
    /* 인포그래픽 모듈은 window.getGridModel/updateGridBlock/addGridBlock 을 «부를 때» 읽는다 — 브라우저와 같은 이름을 건다. */
    window.getGridModel = G.getGridModel;
    window.updateGridBlock = G.updateGridBlock;
    /* ★순서 — 인포그래픽을 ★먼저 얹어 `window.GRID_IFG_PRESETS` 가 서게 한다(고르개의 색 대타가 그걸 읽는다). */
    I = await import(pathToFileURL(path.join(dir, 'grid-infographic.js')).href);
    C = await import(pathToFileURL(path.join(dir, 'grid-ifg-icon-pick.js')).href);
  }
  return { G, I, C };
}

/** 한 칸의 «인라인 style» 문자열을 좌표로 집는다(grid-cell-border.test.js cellStyle 와 같은 자). */
function cellStyle(block, r, c) {
  const re = new RegExp(`<div class="grd-cell[^"]*" data-r="${r}" data-c="${c}" style="([^"]*)"`);
  const m = String(block.innerHTML).match(re);
  assert.ok(m, `★칸(${r},${c})을 innerHTML 에서 못 찾았다 — 계측기가 겨냥을 잃었다`);
  return m[1];
}
/** 칸 style 에서 네 변 값을 뽑는다 — 없으면 null(=선언 없음). */
function sides(st) {
  const g = (k) => { const m = new RegExp(`(?:^|;)${k}:([^;]*);`).exec(st); return m ? m[1] : null; };
  return { top: g('border-top'), left: g('border-left'), right: g('border-right'), bottom: g('border-bottom') };
}

const FIX = (mt) => ({
  cols: [{ width: 1, lines: [{ type: 'body', text: 'A' }] }, { width: 1, lines: [{ type: 'body', text: 'B' }] }],
  rows: [{ height: 'auto' }, { height: 'auto' }],
  cells: [[{ lines: [{ type: 'body', text: 'A' }] }, { lines: [{ type: 'h3', text: 'B', ...(mt ? { marginTop: 12 } : {}) }] }],
          [{ lines: [{ type: 'body', text: 'C' }] }, { lines: [{ type: 'body', text: 'D' }] }]],
});

module.exports = { REPO, GRID_RAW, IFG_RAW, PICK_RAW, loadGrid, cellStyle, sides, FIX };
