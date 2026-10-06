/* modal-frameify-gates — M1 「프레임화 하기」 소스 자물쇠 (2026-10-04, M1 레인)
 * 행동은 tests/dom/modal-frameify*.dom.spec.js 가 잰다(playwright — node --test 스위트 밖). 여기는 «node --test 안»에서
 * 빨개질 수 있는 것만: 두 자리가 같은 수를 보는가 · 금지 문구 · 처리기 순서 · 삽입 갈래 두 곳에 R6 가 걸렸나 · 스크립트 줄.
 * ⚠️이 파일만 보고 「보호된다」고 믿지 마라 — 행동은 DOM 시험 몫이다. */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const src = (rel) => readFileSync(path.join(ROOT, rel), 'utf8').replace(/\r\n/g, '\n');
const FZ = src('js/blocks/modal-frameify.js');
const MB = src('js/blocks/modal-block.js');
const PM = src('js/props/prop-modal.js');
const BF = src('js/block-factory.js');
const IX = src('index.html');

test('G1 형광펜 색 — 모달 렌더(_highlightCss)와 프레임화(HIGHLIGHT_BG)가 같은 값', () => {
  const a = MB.match(/highlight === '1' \? 'background-color:(#[0-9a-fA-F]{3,8});'/)?.[1];
  const b = FZ.match(/const HIGHLIGHT_BG = '(#[0-9a-fA-F]{3,8})'/)?.[1];
  assert.ok(a && b, '두 자리를 못 찾았다 — 이 검사를 고쳐라');
  assert.equal(b, a);
});

test('G2 icon-stack 간격 9px — 모달 렌더 상수와 프레임화가 같은 값', () => {
  const a = MB.match(/justify-content:\$\{jv\};gap:(\d+)px;text-align:center;/)?.[1];
  const b = FZ.match(/st\.gap = '(\d+)px'/)?.[1];
  assert.ok(a && b);
  assert.equal(b, a);
});

test('G3 금지 문구 — 「되돌릴 수 없」이 프레임화·패널 어디에도 없다(지디 조건: 말로 막지 말고 되게)', () => {
  for (const [n, s] of [['modal-frameify.js', FZ], ['prop-modal.js', PM]]) {
    const code = s.split('\n').filter(l => !/^\s*(\/\/|\*|\/\*)/.test(l)).join('\n');
    assert.ok(!code.includes('되돌릴 수 없'), `${n} 에 금지 문구`);
  }
});

test('G4 가로 형태 까닭 — 「아직 안 됩니다」 단독이 아니라 «왜»를 말한다', () => {
  const r = FZ.match(/FRAMEIFY_HORIZONTAL_REASON = '([^']+)'/)?.[1] || '';
  assert.ok(r.includes('세로로만'), r);
  assert.ok(r.includes('가로'), r);
});

test('G5 처리기 순서 — 「프레임화」 갈래가 applyModalVariant·commit «앞»에서 빠져나간다', () => {
  const at = PM.indexOf("sel?.addEventListener('change'");
  assert.ok(at > 0);
  const body = PM.slice(at, at + 1200);
  const fz = body.indexOf('__frameify'), av = body.indexOf('applyModalVariant(');
  assert.ok(fz > 0 && av > 0 && fz < av, '프레임화 갈래가 변형 적용보다 뒤다 — 가짜 «변형 바꿈» 칸이 생긴다');
});

test('G6 R6 — 프레임 흐름 갈래 두 곳(addTextBlock · addBlankTextBlock)이 applyFrameRowTextStyle 을 부른다 · applyTextOpts «앞»', () => {
  for (const fn of ['function addTextBlock(', 'function addBlankTextBlock(']) {
    const s = BF.indexOf(fn); const e = BF.indexOf('\nfunction ', s + 10);
    const body = BF.slice(s, e);
    const hook = body.indexOf('applyFrameRowTextStyle(activeSS');
    assert.ok(hook > 0, `${fn} 에 R6 걸이가 없다`);
  }
  const s = BF.indexOf('function addTextBlock('); const body = BF.slice(s, BF.indexOf('\nfunction ', s + 10));
  assert.ok(body.indexOf('applyFrameRowTextStyle(activeSS') < body.indexOf('applyTextOpts(block, tf, _opts'), '명시 opts 가 템플릿을 이겨야 한다 — 템플릿이 먼저');
});

test('G7 스크립트 줄 — modal-frameify.js 가 modal-block.js «뒤»에 실린다 · modal-block.js 는 프레임화 코드를 모른다', () => {
  const a = IX.indexOf('js/blocks/modal-block.js'), b = IX.indexOf('js/blocks/modal-frameify.js');
  assert.ok(a > 0 && b > a);
  assert.ok(!/frameify/i.test(MB), 'modal-block.js 를 건드렸다 — 프레임화는 별 파일이다(렌더 바이트 무변경)');
});
