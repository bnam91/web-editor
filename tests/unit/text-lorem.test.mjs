/* text-lorem — TEXT-LOREM-FILL-01(현빈 261121) 더미 글 생성기(js/text-lorem.js) 셈.
 * L1 단위별 개수 — 단어 n · 문장 n(마침표 n) · 문단 n(빈 줄 n−1 · 문단마다 문장 3~5)
 * L2 씨앗 결정성 — 같은 씨앗 = 같은 글 · 다른 씨앗 = 다른 글
 * L3 소독 — 모르는 단위·글 = 기본(문장 · en) · 개수 1..상한 정수(0·음수·NaN·초과)
 * L4 en 은 «Lorem ipsum» 으로 시작 · ko 는 한글만(라틴 0) — 한글은 선택지로만(기본 en)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { fileURLToPath, pathToFileURL } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
/* 루트 package.json = commonjs ⇒ .js 의 export 를 Node 가 못 읽는다 — 임시 .mjs 로 옮겨 file:// 로(win-portability ②-4: data: URL 금지). */
const TMP = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'lorem-')), 'text-lorem.mjs');
fs.copyFileSync(path.join(ROOT, 'js/text-lorem.js'), TMP);
const M = await import(pathToFileURL(TMP).href);

test('L1 단위별 개수', () => {
  for (const n of [1, 5, 37]) assert.equal(M.loremText({ unit: 'word', count: n }, 3).split(' ').length, n, `단어 ${n}`);
  for (const n of [1, 4, 30]) assert.equal(M.loremText({ unit: 'sentence', count: n }, 3).match(/\./g).length, n, `문장 ${n}`);
  for (const n of [1, 3, 10]) {
    const paras = M.loremText({ unit: 'paragraph', count: n }, 3).split('\n\n');
    assert.equal(paras.length, n, `문단 ${n}`);
    for (const p of paras) { const k = p.match(/\./g).length; assert.ok(k >= 3 && k <= 5, `문단 안 문장 ${k}`); }
  }
  assert.deepEqual(M.loremPieces({ unit: 'sentence', count: 4 }, 9).length, 4, '조각 = 문장 4');
});

test('L2 씨앗 결정성', () => {
  const o = { unit: 'paragraph', count: 2 };
  assert.equal(M.loremText(o, 42), M.loremText(o, 42));
  assert.notEqual(M.loremText(o, 42), M.loremText(o, 43));
});

test('L3 소독', () => {
  assert.deepEqual(M.normLorem({}), { unit: 'sentence', lang: 'en', count: 2 });
  assert.deepEqual(M.normLorem({ unit: 'zzz', lang: 'fr', count: 'x' }), { unit: 'sentence', lang: 'en', count: 2 });
  assert.equal(M.normLorem({ unit: 'word', count: 0 }).count, 1);
  assert.equal(M.normLorem({ unit: 'word', count: -5 }).count, 1);
  assert.equal(M.normLorem({ unit: 'word', count: 9999 }).count, M.LOREM_MAX.word);
  assert.equal(M.normLorem({ unit: 'paragraph', count: 99 }).count, M.LOREM_MAX.paragraph);
  assert.equal(M.normLorem({ unit: 'sentence', count: 2.6 }).count, 3);
});

test('L4 en 시작 · ko 한글만 · 기본 en', () => {
  assert.match(M.loremText({ unit: 'sentence', count: 2 }, 1), /^Lorem ipsum /);
  const ko = M.loremText({ unit: 'paragraph', count: 2, lang: 'ko' }, 1);
  assert.doesNotMatch(ko, /[A-Za-z]/);
  assert.match(ko, /[가-힣]/);
  assert.equal(M.LOREM_DEFAULT.lang, 'en');
});
