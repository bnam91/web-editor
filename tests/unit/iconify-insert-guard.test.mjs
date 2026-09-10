/* ★「받은 것이 SVG 가 아니면 캔버스에 «넣지 않는다»」 — 2026-09-10 현빈 QA 발.
 *
 * 무슨 일이었나: 아이콘 격자가 한 검색에 SVG 를 80건 «동시에» 받는다.
 *   실측(연속 8회 검색) = 480건 중 401건이 HTTP 429(Cloudflare, retry-after 78).
 *   ⚠️★fetch 는 429 를 «성공으로 resolve» 한다 ⇒ try/catch 에 «안 걸린다».
 *   그 상태에서 아이콘을 삽입하면 Cloudflare 안내 HTML(≈7KB)이 그대로 블록에 들어가고,
 *   삽입 시점엔 세척기가 없어서(sanitizeCanvasHtml 은 «로드 때만») 프로젝트에 저장된다.
 *   ⇒ ★그림이 안 나오는 건 «불편»이지만 이건 «데이터 오염»이다 — 성격이 다르다.
 *
 * ★이 검사는 «소스»를 잰다 — 이 파일은 브라우저 전용이라 node 가 실행할 수 없다.
 *   ⇒ 그래서 «떠낸 구간»이 비지 않았는지를 본 단언 «앞»에 세운다(입력이 살아 있다). */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const REL  = 'js/panels/iconify-panel.js';
const SRC  = fs.readFileSync(path.join(ROOT, REL), 'utf8');
/** 주석을 걷는다 — 주석에 적힌 `res.ok` 를 «코드»로 세면 안 된다. */
const CODE = SRC.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:])\/\/[^\n]*/g, '$1');

/** 삽입 경로(_doInsert)의 fetch 구간만 떠낸다. */
function insertBlock(src) {
  const i = src.indexOf('const res = await fetch(');
  if (i < 0) return '';
  const j = src.indexOf('closeIconifyModal()', i);
  return j < 0 ? '' : src.slice(i, j);
}

test('I0 ★「입력이 살아 있다」 — 삽입 경로의 fetch 구간을 실제로 떠냈다', () => {
  const blk = insertBlock(CODE);
  assert.ok(blk.length > 40,
    `구간을 ${blk.length}자밖에 못 떠냈다 — 하네스가 부서졌다(계약이 문 것이 아니다)`);
  assert.match(blk, /svgText\s*=/, '떠낸 구간에 svgText 대입이 없다 — 엉뚱한 데를 떴다');
});

test('I1 ★HTTP 오류를 «성공으로 읽지 않는다» — res.ok 를 본다', () => {
  const blk = insertBlock(CODE);
  assert.match(blk, /!\s*res\.ok/,
    '★res.ok 를 안 본다 — fetch 는 429 를 성공으로 resolve 하므로 에러 문서가 캔버스에 들어간다');
});

test('I2 ★「SVG 인가」까지 본다 — 200 인데 에러 문서를 주는 경우가 있다', () => {
  const blk = insertBlock(CODE);
  assert.match(blk, /<svg/i,
    '★본문이 SVG 인지 안 본다 — 프록시·캡티브 포털은 200 으로 HTML 을 준다');
});

test('I3 ★막았으면 «폴백»으로 보낸다 — 삽입만 막고 끝내면 아이콘이 아예 안 들어간다', () => {
  const blk = insertBlock(CODE);
  assert.match(blk, /throw/,
    '★throw 가 없다 — 아래 catch 의 img 폴백으로 가야 서버 회복 시 저절로 그려진다');
  assert.match(CODE, /svgText\s*=\s*`<img src="\$\{ICONIFY_API\}/,
    '폴백(img)이 사라졌다 — 막기만 하면 아무것도 안 들어간다');
});

test('I4 [변이] 가드를 빼면 이 검사가 «실제로» 빨개진다', () => {
  const mutated = CODE.replace(/if\s*\(!res\.ok\)[^\n]*\n/, '');
  assert.notEqual(mutated, CODE, '★하네스가 부서졌다 — 앵커를 못 찾았다');
  const blk = insertBlock(mutated);
  assert.ok(blk.length > 40, '변이판에서 구간을 못 떠냈다');
  assert.ok(!/!\s*res\.ok/.test(blk),
    '★가드를 지웠는데 여전히 res.ok 가 보인다 — 이 검사는 아무것도 안 지킨다');
});
