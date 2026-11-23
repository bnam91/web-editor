/* html-attr-curly-quote — js/** 마크업 문자열의 속성 값이 굽은 따옴표(” “)로 감싸이면 브라우저가 따옴표째 값으로 읽어
 *   클래스·id 가 «소리 없이» 안 먹는다(prop-quote.js:174 class=”prop-hint” — 안내가 맨 글로 보였다 · 탑 힌트 전수 261123 덤).
 * 판정 = `이름=”` 또는 `이름=“` 꼴 0. 양성대조 = 같은 판정이 굽은 따옴표 줄을 잡는다. */
import { test } from 'node:test';
import { fileURLToPath } from 'node:url';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');   // fileURLToPath = 윈도우 경로도 맞음(win-portability ②-5)
const BAD = /\b[a-z][a-z-]*=[“”]/;
function walk(d, out = []) { for (const e of fs.readdirSync(d, { withFileTypes: true })) { const p = path.join(d, e.name); if (e.isDirectory()) walk(p, out); else if (p.endsWith('.js')) out.push(p); } return out; }
test('C1 js/** 속성 값에 굽은 따옴표 0', () => {
  const hits = [];
  for (const f of walk(path.join(ROOT, 'js'))) fs.readFileSync(f, 'utf8').split('\n').forEach((l, i) => { if (BAD.test(l)) hits.push(`${path.relative(ROOT, f)}:${i + 1}`); });
  assert.deepEqual(hits, []);
});
test('C2 양성대조 — 굽은 따옴표 속성은 잡는다 · 곧은 따옴표·본문 속 따옴표는 안 잡는다', () => {
  assert.equal(BAD.test('<div class=”prop-hint”>'), true);
  assert.equal(BAD.test('<div class="prop-hint">'), false);
  assert.equal(BAD.test('글 안의 “인용” 은 괜찮다'), false);
});
