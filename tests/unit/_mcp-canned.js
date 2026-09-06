/* _mcp-canned.js — 가짜 렌더러가 돌려줄 «실기 픽스처» 로더. (F6 → F2)
 * (파일명이 _ 로 시작해 테스트 글롭에 안 걸린다 — 도구다.)
 *
 * ★왜 픽스처인가: canned 를 «손으로 지어낸 작은 값»으로 두면 응답 크기·잘림·허용목록이
 *   전부 초록으로 지나간다. 실기 픽스처(섹션2·텍스트3·사진3·표5×4·갭2·프레임안텍스트1,
 *   사진 2장이 «인라인 dataURL»)라야 F4 의 `base64,` 금지가 «자극 있는» 검사가 된다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const FIXTURE_DIR = path.join(__dirname, '..', 'fixtures', 'mcp-canvas-fixture');
const STATE = path.join(FIXTURE_DIR, 'canvas-state.json');

let _cache = null;
function _load() {
  if (_cache) return _cache;
  if (!fs.existsSync(STATE)) {
    throw new Error(`[mcp-canned] 픽스처가 없다: ${STATE}\n  → node tests/fixtures/mcp-canvas-fixture/make-fixture.mjs`);
  }
  _cache = JSON.parse(fs.readFileSync(STATE, 'utf8'));
  return _cache;
}

/** 전체 캔버스 상태(깊은 사본 — 도구가 손대도 다음 호출이 오염되지 않는다). */
function canvasFixture(sectionId) {
  const all = JSON.parse(JSON.stringify(_load()));
  if (!sectionId) return all;
  const s = all.sections.filter(x => x.sectionId === sectionId);
  if (!s.length) return { ok: false, code: 'NOT_FOUND', message: `section ${sectionId} not found` };
  return { ok: true, sections: s };
}

/** ⚠️getCanvasState 는 {sectionId} 객체로 불린다(mcp-server.js). */
function cannedGetCanvasState(arg) { return canvasFixture(arg && arg.sectionId); }

const FIXTURE_SECTION_IDS = ['sec_fixt_1', 'sec_fixt_2'];
/** 픽스처가 담은 «모든» blockId — 하나라도 응답에서 빠지면 #1 결함 재발이다. */
function fixtureBlockIds() {
  return _load().sections.flatMap(s => s.blocks.map(b => b.blockId));
}

module.exports = { FIXTURE_DIR, canvasFixture, cannedGetCanvasState, FIXTURE_SECTION_IDS, fixtureBlockIds };
