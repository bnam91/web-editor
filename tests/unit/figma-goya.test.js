/* 단위 하네스 — js/io/goya-asset-inline.js (Figma export JSON goya-asset:// 재인라인)
 * 실행: node --test "tests/unit/*.test.js"  (Node 22+는 디렉터리 인자 불가 → glob)
 * 대상 모듈은 브라우저용 ES 모듈(import/export)인데 루트 package.json이 "type":"commonjs"라
 * node가 .js를 ESM으로 안 읽는다 → os.tmpdir()에 .mjs 사본을 만들어 동적 import로 로드한다.
 * window/IPC 무접촉: reader를 주입해 순수 함수로 검증.
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { pathToFileURL } = require('url');

const SRC = path.resolve(__dirname, '../../js/io/goya-asset-inline.js');
let _modP = null;
function load() {
  if (!_modP) {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-figma-'));
    const mjs = path.join(dir, 'goya-asset-inline.mjs');
    fs.copyFileSync(SRC, mjs);
    _modP = import(pathToFileURL(mjs).href);
  }
  return _modP;
}

const PNG = 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const A = 'goya-asset://proj1/aaaaaaaaaaaaaaaa.png';
const B = 'goya-asset://proj1/bbbbbbbbbbbbbbbb.jpg';
const HTTPS = 'https://example.com/x.png';

// reader 스텁: 호출 기록 + 파일별 응답(미등록 → null)
function mkReader(table) {
  const calls = [];
  const reader = async (projectId, filename) => {
    calls.push(`${projectId}/${filename}`);
    return Object.prototype.hasOwnProperty.call(table, filename) ? table[filename] : null;
  };
  return { reader, calls };
}

// buildFigmaExportJSON 결과 모양을 흉내낸 최소 트리(imgSrc·src·bgImage·카드 중첩·비교행)
function sampleJson() {
  return {
    version: 'sangpe-design-v1',
    sections: [
      { id: 's1', bgImage: A, blocks: [
        { type: 'image', src: A },
        { type: 'banner02', imgSrc: B },
        { type: 'card', cards: [{ imgSrc: A }, { imgSrc: PNG }] },
        { type: 'comparison', cols: [{ rows: [{ type: 'image', imgSrc: HTTPS }] }] },
      ] },
    ],
  };
}

test('ⓐ imgSrc·src(bgImg)·섹션 bgImage 3곳 모두 data URI로 치환', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const { reader } = mkReader({ 'aaaaaaaaaaaaaaaa.png': PNG, 'bbbbbbbbbbbbbbbb.jpg': 'data:image/jpeg;base64,/9j/' });
  const json = sampleJson();
  const r = await inlineGoyaAssetsInJSON(json, reader);
  assert.equal(json.sections[0].bgImage, PNG);
  assert.equal(json.sections[0].blocks[0].src, PNG);
  assert.equal(json.sections[0].blocks[1].imgSrc, 'data:image/jpeg;base64,/9j/');
  assert.equal(json.sections[0].blocks[2].cards[0].imgSrc, PNG);
  assert.equal(r.totalAssets, 2);
  assert.equal(r.resolvedAssets, 2);
  assert.equal(r.unresolvedAssets, 0);
  assert.equal(r.json, json); // 제자리 변경 + 동일 객체 반환
});

test('ⓑ 같은 URL은 reader를 1회만 호출', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const { reader, calls } = mkReader({ 'aaaaaaaaaaaaaaaa.png': PNG, 'bbbbbbbbbbbbbbbb.jpg': PNG });
  await inlineGoyaAssetsInJSON(sampleJson(), reader); // A는 3곳(bgImage·src·card), B는 1곳
  assert.deepEqual(calls.sort(), ['proj1/aaaaaaaaaaaaaaaa.png', 'proj1/bbbbbbbbbbbbbbbb.jpg']);
});

test('ⓒ reader null → 원본 URL 유지 + unresolvedAssets=1', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const { reader } = mkReader({ 'aaaaaaaaaaaaaaaa.png': PNG }); // B는 없음(파일 없음 시나리오)
  const json = sampleJson();
  const r = await inlineGoyaAssetsInJSON(json, reader);
  assert.equal(json.sections[0].blocks[0].src, PNG);   // A는 치환
  assert.equal(json.sections[0].blocks[1].imgSrc, B);  // B는 원본 유지
  assert.equal(r.unresolvedAssets, 1);
  assert.deepEqual(r.unresolvedUrls, [B]);
});

test('ⓒ-2 reader 자체가 없음(웹·IPC 미가용) → 전부 원본 유지, 전부 unresolved', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const json = sampleJson();
  const r = await inlineGoyaAssetsInJSON(json, null);
  assert.deepEqual(json, sampleJson());
  assert.equal(r.unresolvedAssets, 2);
});

test('ⓒ-3 reader throw → 삼키지 않고 unresolved로 집계, 나머지는 계속 처리', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const origWarn = console.warn; console.warn = () => {};
  try {
    const reader = async (_p, fn) => { if (fn.startsWith('bbbb')) throw new Error('boom'); return PNG; };
    const json = sampleJson();
    const r = await inlineGoyaAssetsInJSON(json, reader);
    assert.equal(json.sections[0].blocks[0].src, PNG);
    assert.equal(json.sections[0].blocks[1].imgSrc, B);
    assert.equal(r.unresolvedAssets, 1);
  } finally { console.warn = origWarn; }
});

test('ⓓ data: URI와 https URL은 건드리지 않고 reader도 호출하지 않음', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const { reader, calls } = mkReader({});
  const json = { sections: [{ bgImage: PNG, blocks: [{ src: HTTPS }, { imgSrc: '' }, { text: '그냥 goya 텍스트' }] }] };
  const before = JSON.stringify(json);
  const r = await inlineGoyaAssetsInJSON(json, reader);
  assert.equal(JSON.stringify(json), before);
  assert.equal(calls.length, 0);
  assert.equal(r.totalAssets, 0);
  assert.equal(r.unresolvedAssets, 0);
});

test('url("goya-asset://…") 처럼 CSS 문자열 안에 박힌 참조도 안쪽만 치환', async () => {
  const { inlineGoyaAssetsInJSON } = await load();
  const { reader } = mkReader({ 'aaaaaaaaaaaaaaaa.png': PNG });
  const json = { style: `background-image:url("${A}")` };
  await inlineGoyaAssetsInJSON(json, reader);
  assert.equal(json.style, `background-image:url("${PNG}")`);
});

test('parseGoyaAssetUrl / isGoyaAssetUrl / makeElectronAssetReader(window 없음 → null)', async () => {
  const { parseGoyaAssetUrl, isGoyaAssetUrl, makeElectronAssetReader } = await load();
  assert.deepEqual(parseGoyaAssetUrl(A), { projectId: 'proj1', filename: 'aaaaaaaaaaaaaaaa.png' });
  assert.equal(parseGoyaAssetUrl(HTTPS), null);
  assert.equal(isGoyaAssetUrl(A), true);
  assert.equal(isGoyaAssetUrl(PNG), false);
  assert.equal(isGoyaAssetUrl(null), false);
  assert.equal(makeElectronAssetReader(), null);
});
