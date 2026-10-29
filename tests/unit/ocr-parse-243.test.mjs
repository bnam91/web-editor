/* ocr-parse-243 — services/ocrPrompt.js parseOcr «모델 글 → { text, lines }» 의 자 (시트 33 1020t2a1 · 243 · 242)
 *
 * ★왜: parseOcr 는 세 공급자(anthropicService.js:347 · geminiService.js:359 · openaiService.js:403)가 같이 부르는데
 *   tests/ 에 이 이름을 부르는 검사가 0 이었다(261029 지디 실측 · S5 3ea20db3 에서 다시 잼 — git grep -ln -e parseOcr -e ocrPrompt -- tests/ = 0).
 * ★무엇을 잠그나(«지금 꼴» — ⛔처방 아님):
 *   P1 코드펜스·앞뒤 말 붙은 정상 JSON ⇒ lines 가 서고 text = 줄들을 \n 으로 이음
 *   P2 { 없는 글(indexOf('{') = −1 ⇒ slice(−1, lastIndexOf('}')+1) = '' ⇒ JSON.parse 던짐) ⇒ lines null · text = 다듬은 원문
 *   P3 } 만 · { 만 ⇒ 같은 꼴(던짐 → 원문)
 *   P4 ★lines 항목이 문자열·null·숫자·text 없는 객체 ⇒ text 는 비 text 를 걸러 내지만 ★lines 는 받은 그대로 돌려준다(쓰레기 통과 · 지금 꼴)
 *   P5 lines 가 배열 아님 · lines 키 없음 ⇒ JSON 이어도 lines null · text = 원문(JSON 글자째)
 *   P6 JSON 객체 둘이 한 글에 ⇒ 첫 { ~ 끝 } 가 JSON 이 아니라 던짐 ⇒ 원문(S5 가 더한 경계)
 *   P7 <img onerror> 꼴 글은 글자 그대로 돌려준다 — ★돌려줌 자체는 결함 아님(242 의 결함 자리는 innerHTML 쪽)
 * ★양성대조: GD1001_ROOT 로 «JSON.parse 줄을 무력화한 사본»을 가리키면 P1·P4·P7 이 빨강(S5 261029 ×3 실측 · P2·P3·P5·P6 은
 *   JSON 이 안 서는 길이라 무력화해도 같은 값 — 경계 자리로 둔다). */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const ROOT = process.env.GD1001_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const { parseOcr } = require(path.join(ROOT, 'services', 'ocrPrompt.js'));

test('P1 코드펜스·앞뒤 말 붙은 정상 JSON ⇒ lines 섬 · text = 줄 이음', () => {
  const fence = '```json\n{"lines":[{"style":"h2","text":"제목"},{"style":"body","text":"본문"}]}\n```';
  assert.deepEqual(parseOcr(fence), { text: '제목\n본문', lines: [{ style: 'h2', text: '제목' }, { style: 'body', text: '본문' }] });
  const talk = '여기 결과입니다: {"lines":[{"style":"body","text":"하나"}]} 끝.';
  assert.deepEqual(parseOcr(talk), { text: '하나', lines: [{ style: 'body', text: '하나' }] });
  assert.deepEqual(parseOcr('{"lines":[]}'), { text: '', lines: [] }, '글자 없음 = 빈 배열 · text 빈 글');
});

test('P2 { 없는 글 ⇒ lines null · text = 다듬은 원문 (빈 값·null 도)', () => {
  assert.deepEqual(parseOcr('그냥 글입니다'), { text: '그냥 글입니다', lines: null });
  assert.deepEqual(parseOcr('  앞뒤 공백  '), { text: '앞뒤 공백', lines: null });
  assert.deepEqual(parseOcr(''), { text: '', lines: null });
  assert.deepEqual(parseOcr(null), { text: '', lines: null });
  assert.deepEqual(parseOcr(undefined), { text: '', lines: null });
});

test('P3 } 만 · { 만 ⇒ lines null · text = 원문', () => {
  assert.deepEqual(parseOcr('끝 } 만'), { text: '끝 } 만', lines: null });
  assert.deepEqual(parseOcr('{ 열기만'), { text: '{ 열기만', lines: null });
});

test('P4 ★lines 항목이 문자열·null·숫자·text 없는 객체 ⇒ text 는 걸러지나 lines 는 받은 그대로(지금 꼴)', () => {
  const r = parseOcr('{"lines":["문자열",null,{"text":"진짜"},{"style":"h1"},5]}');
  assert.equal(r.text, '진짜');
  assert.deepEqual(r.lines, ['문자열', null, { text: '진짜' }, { style: 'h1' }, 5], '★lines 는 거르지 않는다 — 이 단언이 빨개지면 «거르게 고쳤다»는 뜻(그 커밋에서 같이 고쳐라)');
});

test('P5 lines 가 배열 아님 · lines 키 없음 ⇒ lines null · text = JSON 글자째', () => {
  assert.deepEqual(parseOcr('{"lines":"x"}'), { text: '{"lines":"x"}', lines: null });
  assert.deepEqual(parseOcr('{"text":"x"}'), { text: '{"text":"x"}', lines: null });
});

test('P6 JSON 객체 둘이 한 글에 ⇒ 첫 { ~ 끝 } 가 JSON 아님 ⇒ 원문', () => {
  const two = '{"lines":[{"text":"A"}]} 그리고 {"lines":[{"text":"B"}]}';
  assert.deepEqual(parseOcr(two), { text: two, lines: null });
});

test('P7 <img onerror> 꼴 글은 글자 그대로 돌려준다(이스케이프는 parseOcr 몫 아님)', () => {
  const x = '<img src=x onerror=alert(1)>';
  assert.deepEqual(parseOcr(JSON.stringify({ lines: [{ style: 'body', text: x }] })), { text: x, lines: [{ style: 'body', text: x }] });
  assert.deepEqual(parseOcr(x), { text: x, lines: null });
});
