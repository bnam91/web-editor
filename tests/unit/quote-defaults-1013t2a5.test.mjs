/* U-Q1013t2A5 — 인용구(Quote) «새 블럭» 기본값 지킴이. (2026-10-14, 현빈 1013t2A5)
 *   현빈 원문: 「quato블럭 기본 폰트 시스템이 아닌 프리텐다드로 해주고, 크기는 기본 36폰트로 해줄 것
 *              / 기본 입력된 텍스트 → (옛 문구) → '내용을 입력하세요'」
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ⚠️이 파일은 «소스 문자열»을 단언한다. 행위(새 블럭 Pretendard·36 · 옛 저장본 불변 · 시스템 고르기)는
 *   tests/dom/quote-block.dom.spec.js Q23·Q24·Q25 가 잰다.
 * ★규율 — 입력이 살아 있다를 먼저 단언한다(훑는 목록·본문이 비면 뒤 검사가 0바퀴로 자기통과한다).
 *
 * 음성대조(계획 A5 §6):
 *   MA3 QUOTE_DEFAULTS.fontFamily 에 Pretendard 를 넣는다 → U2 빨강
 *   MA4 ph 를 옛 문구로 되돌린다                     → U3 · U4 빨강
 *   MA1 quoteNewFontFamily 의 fontChain('Pretendard') 를 리터럴로 바꾼다 → U1 빨강
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';

const require = createRequire(import.meta.url);
const { stripCommentsTA, templateBalanced } = require('./_strip-comments.js');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO = path.join(__dirname, '../../');
const read = (rel) => fs.readFileSync(path.join(REPO, rel), 'utf8');

const F_BLK = 'js/blocks/quote-block.js';
/* 옛 문구 — ⛔js/ 에는 다시 적지 않는다. 여기(검사)에만 산다. */
const OLD_PH = ['빠르게', '입는', '하루'].join(' ');
const NEW_PH = '내용을 입력하세요';

function blkCode() {
  const raw = read(F_BLK);
  assert.ok(templateBalanced(raw), 'quote-block.js 템플릿 균형이 깨졌다 — 주석 걷기를 못 믿는다');
  const code = stripCommentsTA(raw);
  assert.ok(code.includes('function makeQuoteBlock'), '입력이 죽었다 — makeQuoteBlock 본문이 안 남았다');
  return code;
}

/** QUOTE_DEFAULTS = Object.freeze({ … }) 본문(주석 걷은 것). */
function defaultsBody(code) {
  const at = code.indexOf('const QUOTE_DEFAULTS = Object.freeze({');
  assert.ok(at >= 0, '전제: QUOTE_DEFAULTS 선언을 찾았다');
  const end = code.indexOf('});', at);
  assert.ok(end > at, '전제: QUOTE_DEFAULTS 가 닫힌다');
  const body = code.slice(at, end);
  assert.ok(/\bph\s*:/.test(body) && /\bfontSize\s*:/.test(body), '전제: 본문에 ph·fontSize 키가 있다');
  return body;
}

test('U1 새 블럭 글꼴은 fontChain(\'Pretendard\') 한 출처에서 받고, 리터럴 \'Pretendard\' 는 0건', () => {
  const code = blkCode();
  assert.match(code, /import\s*\{[^}]*\bfontChain\b[^}]*\}\s*from\s*'\.\.\/props\/prop-text-utils\.js'/,
    'fontChain 을 prop-text-utils.js 에서 가져온다');
  const calls = code.match(/fontChain\(\s*'Pretendard'\s*\)/g) || [];
  assert.equal(calls.length, 1, `fontChain('Pretendard') 호출이 정확히 1 (잰 수 ${calls.length})`);
  /* 호출 자리를 걷어낸 나머지에 'Pretendard' 따옴표 리터럴이 있으면 사본이다 */
  const rest = code.replace(/fontChain\(\s*'Pretendard'\s*\)/g, '');
  assert.ok(!/['"`]Pretendard/.test(rest), "fontChain 밖에 'Pretendard' 리터럴이 있다 — 피커 값과 출처가 갈린다");
  /* 그리고 makeQuoteBlock 이 opts 가 없을 때 그 값을 박는다 */
  const mk = code.slice(code.indexOf('function makeQuoteBlock'), code.indexOf('function _selectNewQuote'));
  assert.ok(mk.length > 100, '전제: makeQuoteBlock 본문을 잘랐다');
  assert.match(mk, /quoteNewFontFamily\(\)/, 'makeQuoteBlock 이 quoteNewFontFamily() 를 부른다');
  assert.match(mk, /QUOTE_NEW_FONT_SIZE/, 'makeQuoteBlock 이 QUOTE_NEW_FONT_SIZE 를 쓴다');
  assert.match(code, /const\s+QUOTE_NEW_FONT_SIZE\s*=\s*36\s*;/, 'QUOTE_NEW_FONT_SIZE = 36');
});

test('U2 QUOTE_DEFAULTS 의 렌더 폴백은 그대로 — fontFamily \'\' · fontSize 21 (옛 저장본 불변)', () => {
  const body = defaultsBody(blkCode());
  assert.match(body, /\bfontFamily\s*:\s*''\s*,/, "QUOTE_DEFAULTS.fontFamily 가 '' 이다(바꾸면 옛 블럭에 선언이 붙고 「기본 (시스템)」을 못 고른다)");
  assert.match(body, /\bfontSize\s*:\s*21\s*,/, 'QUOTE_DEFAULTS.fontSize 가 21 이다(키 없는 블럭의 폴백)');
});

test('U3 js/ 전체에서 옛 안내문구 0건', () => {
  const files = [];
  (function walk(dir) {
    for (const e of fs.readdirSync(path.join(REPO, dir), { withFileTypes: true })) {
      const rel = path.join(dir, e.name);
      if (e.isDirectory()) walk(rel);
      else if (/\.(m?js)$/.test(e.name)) files.push(rel);
    }
  })('js');
  assert.ok(files.length > 50, `전제: js/ 파일을 훑었다 (잰 수 ${files.length})`);
  assert.ok(files.includes(F_BLK), '전제: 훑은 목록에 quote-block.js 가 있다');
  const hits = files.filter((f) => read(f).includes(OLD_PH));
  assert.deepEqual(hits, [], `옛 문구가 남았다: ${hits.join(', ')}`);
});

test('U4 안내문구 ph 가 「내용을 입력하세요」(원문대로 마침표 없음)', () => {
  const body = defaultsBody(blkCode());
  const m = body.match(/\bph\s*:\s*'([^']*)'/);
  assert.ok(m, '전제: ph 리터럴을 찾았다');
  assert.equal(m[1], NEW_PH);
});
