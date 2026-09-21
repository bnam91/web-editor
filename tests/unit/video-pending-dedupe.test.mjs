/* video-pending-dedupe.test.mjs — T-130 «원문 게이트» (2026-09-22)
 *
 * ★무엇을 잠그나 — 행동은 tests/dom/video-pending-edit-undo.dom.spec.js 가 실물로 잰다.
 *   여기는 «되돌아가기 쉬운 두 가지»를 문장 수준에서 못 하게 막는다:
 *     ⓐ 무변화 중복 차단이 «두 벌»인데(pushHistory · ensureHistoryCheckpoint) 한쪽만 고치는 것
 *     ⓑ 사이드카 읽기를 다시 차단 «아래»로 내리는 것(= 고칠 방향 ⑴ 을 되돌리는 것)
 *   그리고 «얹으면 조용히 다른 걸 죽이는 것» 하나를 같이 막는다:
 *     ⓒ _stripNonEdit(문자열 비교자)에 «공백 정리»를 얹는 것 — 그 순간 T-035 의
 *       「✕ 로 비운 직후 ⌘Z 되살리기」가 죽는다(기전은 T-035 ⚠️ E).
 *
 * ⛔주석 거르기는 tests/unit/_strip-comments.js 의 makeStripper «만» 쓴다 — includes 가
 *   주석 속 문구에 속아 초록나는 걸 막는다(이 레포의 house rule).
 * ⛔고정 창(slice) 금지 — 함수 몸통은 중괄호를 세어 떼어낸다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require = createRequire(import.meta.url);
const { makeStripper } = require('./_strip-comments');

const ROOT = path.join(__dirname, '..', '..');
const HISTORY_SRC = fs.readFileSync(path.join(ROOT, 'js', 'history.js'), 'utf8');

/** 함수 «몸통»을 중괄호 균형으로 떠낸다. */
function extractFn(src, name) {
  const m = new RegExp('(?:async\\s+)?function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('함수를 못 찾았다: ' + name);
  const start = m.index;
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(start, i);
}
const codeOnly = (s) => { const strip = makeStripper(); return s.split('\n').map(strip).join('\n'); };

const PUSH_HISTORY   = codeOnly(extractFn(HISTORY_SRC, 'pushHistory'));
const ENSURE_CKPT    = codeOnly(extractFn(HISTORY_SRC, 'ensureHistoryCheckpoint'));
const STRIP_NON_EDIT = codeOnly(extractFn(HISTORY_SRC, '_stripNonEdit'));
const VP_KEY         = codeOnly(extractFn(HISTORY_SRC, '_videoPendingKey'));

test('D0 ★뗀 몸통들이 비어 있지 않다 (아래 초록이 빈 함수의 초록이 아니다)', () => {
  for (const [n, b] of [['pushHistory', PUSH_HISTORY], ['ensureHistoryCheckpoint', ENSURE_CKPT],
                        ['_stripNonEdit', STRIP_NON_EDIT], ['_videoPendingKey', VP_KEY]]) {
    assert.ok(b.length > 40, `${n} 을 못 뗐다`);
  }
});

test('D1 ★차단 «두 벌»이 둘 다 사이드카를 잰다 — 한쪽만 고치면 그쪽 경로에서만 고쳐진다', () => {
  assert.match(PUSH_HISTORY, /_videoPendingKey\(\s*_top\.videoPendingSidecar\s*\)\s*===\s*_videoPendingKey\(/,
    '★pushHistory 의 무변화 차단이 사이드카를 «안» 잰다 — 미확정 영상 편집이 한 칸도 안 쌓인다(T-130)');
  assert.match(ENSURE_CKPT, /_videoPendingKey\(\s*historyStack\[historyPos\]\?\.videoPendingSidecar\s*\)\s*!==\s*_videoPendingKey\(/,
    '★ensureHistoryCheckpoint 가 사이드카를 «안» 잰다 — undo 첫 스텝의 선적재가 영상을 떨어뜨린다(T-130)');
});

test('D2 ★사이드카 «읽기»가 차단 «위»에 있다(고칠 방향 ⑴) — 아래로 내리면 원본이 그 항목에 안 실린다', () => {
  const declIdx  = PUSH_HISTORY.indexOf('const _videoPendingSidecar');
  const blockIdx = PUSH_HISTORY.indexOf('_sameEdit(_top.canvas');
  const pushIdx  = PUSH_HISTORY.indexOf('historyStack.push(');
  assert.ok(declIdx > 0, '★pushHistory 가 사이드카를 아예 안 읽는다');
  assert.ok(blockIdx > 0, '★pushHistory 의 무변화 차단을 못 찾았다 — 이 게이트가 늙었다');
  assert.ok(pushIdx > 0, '★pushHistory 의 항목 생성을 못 찾았다 — 이 게이트가 늙었다');
  assert.ok(declIdx < blockIdx,
    '★사이드카 읽기가 무변화 차단 «아래»로 내려갔다 — 차단이 그걸 비교할 수 없게 된다(T-130 ⑴ 회귀)');
  // ensure 쪽도 같은 순서여야 한다(그쪽은 원래부터 위였다 — T-031 3차)
  const eDecl = ENSURE_CKPT.indexOf('const _sidecar');
  const eBlock = ENSURE_CKPT.indexOf('_sameEdit(historyStack[historyPos]');
  assert.ok(eDecl > 0 && eBlock > 0 && eDecl < eBlock,
    '★ensureHistoryCheckpoint 의 사이드카 읽기가 차단 아래로 내려갔다');
});

test('D3 ★열쇠가 «사람이 바꾸는 값»을 전부 담는다 — 하나라도 빠지면 그 편집이 다시 안 쌓인다', () => {
  for (const f of ['fit', 'trimIn', 'trimOut', 'playbackRate']) {
    assert.match(HISTORY_SRC, new RegExp("'" + f + "'"),
      `★_VP_FIELDS 에서 ${f} 가 빠졌다 — 그 값만 바꾼 편집이 되돌리기에 안 쌓인다`);
  }
  assert.match(VP_KEY, /imgSrc/,
    '★열쇠가 imgSrc 를 아예 안 본다 — 같은 블럭에 다른 영상을 올려도 «같은 상태»로 읽힌다');
  assert.match(VP_KEY, /\.length/,
    '★열쇠가 원본을 길이로 줄이지 않는다 — 최대 ~66MB 문자열 비교가 편집마다 들어간다');
  /* 사이드카를 통째로 JSON 으로 만들면 그 66MB 가 매 편집마다 직렬화된다 */
  assert.doesNotMatch(VP_KEY, /JSON\.stringify/,
    '★열쇠가 JSON.stringify 로 만들어진다 — 원본 data URL 을 편집마다 통째로 복사하게 된다');
});

test('D4 ★없음·{} 은 «같다» — 영상이 없는 대다수 편집에서 회귀 0 이 되는 근거', () => {
  /* ★소스에서 함수만 떼어 «진짜로» 돌린다(문장 검사가 아니다).
     ⛔data: URL 로 import 하지 «마라» — tests/unit/win-portability.test.mjs ②-4 가 막는다
       (윈도우에서 ERR_UNSUPPORTED_ESM_URL_SCHEME 로 파일이 통째로 죽는다). new Function 으로 판다. */
  const from = HISTORY_SRC.indexOf('const _VP_FIELDS');
  const to   = HISTORY_SRC.indexOf('/* ── ★0920b');
  assert.ok(from > 0 && to > from, '★_videoPendingKey 조각을 못 떼냈다 — 이 게이트가 늙었다');
  const snippet = HISTORY_SRC.slice(from, to);
  assert.match(snippet, /function _videoPendingKey/, '★떼낸 조각에 함수가 없다');
  const k = new Function(snippet + '\nreturn _videoPendingKey;')();
  assert.equal(k(null), k({}), '★null 과 {} 이 다르게 읽힌다 — 영상 없는 판에서 칸이 늘어난다');
  assert.equal(k(undefined), k({}), '★undefined 와 {} 이 다르게 읽힌다');
  const a = { ab1: { imgSrc: 'data:video/mp4;base64,AAAA', fit: 'cover', trimIn: '0', trimOut: '3' } };
  const b = { ab1: { imgSrc: 'data:video/mp4;base64,AAAA', fit: 'cover', trimIn: '0', trimOut: '3' } };
  assert.equal(k(a), k(b), '★같은 상태가 다르게 읽힌다 — 먹통 한 칸이 생긴다');
  assert.notEqual(k(a), k({ ab1: { ...a.ab1, trimIn: '0.5' } }), '★트림이 달라도 같게 읽힌다 — T-130 본체');
  assert.notEqual(k(a), k({ ab1: { ...a.ab1, playbackRate: '2' } }), '★속도가 달라도 같게 읽힌다');
  assert.notEqual(k(a), k({}), '★영상이 있고 없고가 같게 읽힌다 — 업로드가 한 칸도 안 남는다');
  /* 키 순서가 달라도 같아야 한다(Object.keys 순서는 삽입 순서를 따른다) */
  assert.equal(k({ x: a.ab1, y: a.ab1 }), k({ y: a.ab1, x: a.ab1 }),
    '★블럭 «순서»만 달라도 다르게 읽힌다 — 엉뚱한 칸이 생긴다');
});

test('D5 ★_stripNonEdit 에 «공백 정리»를 얹지 않았다 — 얹으면 T-035 의 ✕→⌘Z 되살리기가 조용히 죽는다', () => {
  assert.doesNotMatch(STRIP_NON_EDIT, /\\s\+|\\n|trim\(\)|replace\(\s*\/\s*\\s/,
    '★_stripNonEdit 이 공백을 정리한다 — js/image-handling.js clearAssetImage 의 출력과 ' +
    'serializeCleanRoot 의 출력이 «공백 덕»에 달라서 도는 자리가 죽는다(T-035 ⚠️ E). ' +
    '⛔이 결함은 «그레인 붙은» 블럭으로 확인하면 안 보인다 — 그레인 없는 블럭으로 재라.');
});
