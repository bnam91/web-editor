/* 버즈 프로필 얼굴 끌기 — onUp 이 «무조건» 다시 그린다 (244 · 그 렌더가 끈 뒤 click 을 없애는 것이 삼키개를 걷은 근거)
 *
 * 까닭(S5 261029 · 판 6f30a34d DOM ×5): _startProfileDrag onUp 의 renderModalBlock 이 얼굴 노드를 갈아 끈 뒤 click 이 오지 않는다
 *   (그대로·삼키개 무력화 두 판 click 0 · 20/20). 렌더만 뺀 사본은 click 이 와서 카드 고름이 풀리거나 패널이 두 번 열렸다(10/10).
 *   ⇒ 그 자리의 삼키개(swallowNextClick)는 하는 일이 0 이고, 걷을 때 그 안전은 «이 렌더가 조건 없이 있다» 에 걸린다(이 검사가 먼저 선다).
 *   행위로는 «렌더 안 하는 길» 을 못 만든다(지금 코드에 그 길 0) ⇒ 구조로 잠근다.
 * 자: 주석 뗀 소스에서 _startProfileDrag 본문 → 그 안 «const onUp = () => { … }» 본문(괄호 맞추기 · ⛔고정 창) →
 *   그 본문 «맨 바깥 문장» 중 하나가 정확히 renderModalBlock(block) 이다(if 블럭·if 한 줄·삼항 안이 아니다).
 * 한 쌍(커밋 메시지): 그 호출을 주석 처리한 사본에서 R1 빨강 ×3 · GD1001_ROOT 로 그 사본을 읽힌다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = process.env.GD1001_ROOT || path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const FILE = 'js/blocks/modal-block.js';

/** open 위치의 «{» 와 짝인 «}» 까지(문자열 속 괄호는 안 가림 — 이 자의 한계 · 대상 본문엔 없음) */
function blockFrom(src, open) {
  let d = 0;
  for (let i = open; i < src.length; i++) { if (src[i] === '{') d++; else if (src[i] === '}') { d--; if (d === 0) return src.slice(open, i + 1); } }
  return null;
}
/** body(«{ … }») 의 맨 바깥 «문장» 목록 — 안쪽 { } 는 걷고 ; · 줄바꿈으로 가른다(if 한 줄·삼항·&& 는 그 문장이 «정확히 그 호출» 이 아니라 빠진다) */
function topStatements(body) {
  let d = 0, out = '';
  for (let i = 1; i < body.length - 1; i++) { const c = body[i]; if (c === '{') { d++; continue; } if (c === '}') { d--; continue; } if (d === 0) out += c; }
  return out.split(/[;\n]/).map((x) => x.trim()).filter(Boolean);
}
function onUpBody(src) {
  const f = src.indexOf('function _startProfileDrag(');
  if (f < 0) return { err: '_startProfileDrag 없음' };
  const fn = blockFrom(src, src.indexOf('{', f));
  const m = /const\s+onUp\s*=\s*\(\s*\)\s*=>\s*\{/.exec(fn || '');
  if (!m) return { err: 'onUp 없음' };
  return { body: blockFrom(fn, m.index + m[0].length - 1) };
}

test('R0 자가 산다 — 맨 바깥 호출은 잡고 · if 안·주석 속은 안 잡는다', () => {
  const has = (s) => topStatements(onUpBody(stripComments(s)).body).includes('renderModalBlock(block)');
  const OK = 'function _startProfileDrag(b){ const onUp = () => { if (!cur) return; x(); renderModalBlock(block); y(); }; }';
  const IN_IF = 'function _startProfileDrag(b){ const onUp = () => { if (!cur) return; if (z) { renderModalBlock(block); } }; }';
  const IF1 = 'function _startProfileDrag(b){ const onUp = () => { if (z) renderModalBlock(block); }; }';
  const COMMENTED = 'function _startProfileDrag(b){ const onUp = () => { if (!cur) return; // renderModalBlock(block);\n y(); }; }';
  const TERN = 'function _startProfileDrag(b){ const onUp = () => { z ? renderModalBlock(block) : 0; }; }';
  assert.deepEqual([has(OK), has(IN_IF), has(IF1), has(COMMENTED), has(TERN)], [true, false, false, false, false]);
});

test('R1 _startProfileDrag onUp 이 renderModalBlock(block) 을 조건 없이 부른다(244 — 이 렌더가 끈 뒤 click 을 없앤다)', () => {
  const src = stripComments(fs.readFileSync(path.join(ROOT, FILE), 'utf8'));
  const u = onUpBody(src);
  assert.equal(u.err, undefined, u.err);
  assert.ok(topStatements(u.body).includes('renderModalBlock(block)'), '렌더가 빠지거나 조건 안으로 들어갔다 — 끈 뒤 click 이 다시 온다(244) · 삼키개를 되살리거나 그 click 을 따로 막아라');
});
