/* variation-visible.test.js — A/B 베리에이션을 «읽을 수 있게» 한다 (2026-09-08 현빈 지시)
 *
 * ★왜: A안·B안은 «같은 자리의 두 시안»인데, 그 사실을 안 실어 보내면 밖에서는
 *   «그냥 섹션 두 개»로 보인다. 「섹션 정리해줘」에 B안이 «중복»으로 지워질 수 있다.
 * ⛔숨기지 «않는다» — 표시한다. 안내문구(placeholder)와 같은 원칙이다:
 *   AI 가 「이건 같은 자리의 다른 안이다」를 «알아야» 옳게 다룬다.
 *
 * ⚠️★이 검사가 특히 겨누는 것: «허용목록이 조용히 떨구는 것».
 *   _slimCanvasState 의 허용목록은 렌더러가 새로 보내는 필드를 말없이 버린다.
 *   그 경고가 코드에 이미 있었는데 나는 오늘 placeholder 로 «한 번 걸렸다» — 이게 두 번째다.
 *   ⇒ 「렌더러가 싣는다」와 「MCP 가 준다」를 «따로» 잰다. 한쪽만 재면 또 놓친다.
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert');
const fs = require('fs');
const path = require('path');

const ROOT = path.join(__dirname, '..', '..');
const CS  = fs.readFileSync(path.join(ROOT, 'js', 'canvas-state.js'), 'utf8');
const MCP = fs.readFileSync(path.join(ROOT, 'main', 'claude-pm', 'mcp-server.js'), 'utf8');
const VAR = fs.readFileSync(path.join(ROOT, 'js', 'section-variation.js'), 'utf8');

test('V1 ★«쓰는 쪽»과 «읽는 쪽»이 같은 이름을 본다 (드리프트 방지)', () => {
  /* section-variation.js 가 심는 이름이 바뀌면 읽기가 조용히 빈다.
     ⇒ 심는 쪽에 그 셋이 «실제로» 있는지부터 확인한다(전제 검사). */
  for (const k of ['variationGroup', 'variation', 'variationActive']) {
    assert.match(VAR, new RegExp(`dataset\\.${k}\\s*=`),
      `★section-variation.js 가 ${k} 를 안 심는다 — 읽기가 겨누는 대상이 바뀌었다`);
  }
});

test('V2 ★렌더러가 섹션에 A/B 를 «싣는다»', () => {
  assert.match(CS, /variationGroup: vg/, '★섹션 읽기에 variationGroup 이 없다');
  assert.match(CS, /variation: section\.dataset\.variation/, '★어느 안(A/B)인지 안 싣는다');
  assert.match(CS, /variationActive: section\.dataset\.variationActive === '1'/,
    "★지금 «보이는 안»인지 안 싣는다 — '1'/'0' 문자열을 boolean 으로 갈라야 한다");
});

test('V3 ⛔A/B 가 «아닌» 섹션엔 키를 안 붙인다 — 응답이 헛되이 커진다', () => {
  assert.match(CS, /\.\.\.\(vg \? \{/, '★변형이 없어도 키를 붙인다(빈 값이 섹션마다 실린다)');
});

test('V4 ★★허용목록이 A/B 를 안 떨군다 — «두 경로 모두» (요약·상세)', () => {
  const i = MCP.indexOf('function _slimCanvasState');
  assert.ok(i > 0, '_slimCanvasState 가 없다');
  const body = MCP.slice(i, i + 4000);
  const hits = [...body.matchAll(/variationGroup: s\.variationGroup/g)].length;
  assert.equal(hits, 2,
    `★A/B 를 싣는 자리가 ${hits}곳이다 — «요약»과 «상세» 둘 다여야 한다. ` +
    '한쪽만 채우면 「목록엔 안 보이는데 상세엔 보이는」 어긋남이 난다');
});

test('V5 ★«목록»에서 특히 중요하다 — 사람이 「왜 두 개지」를 보는 자리다', () => {
  const i = MCP.indexOf('sections: shown.map');
  assert.ok(i > 0, '요약 경로를 못 찾았다');
  const summary = MCP.slice(i, i + 700);
  assert.match(summary, /variationGroup/,
    '★요약(목록)에 A/B 가 없다 — 목록만 보면 여전히 «섹션 두 개»다');
});
