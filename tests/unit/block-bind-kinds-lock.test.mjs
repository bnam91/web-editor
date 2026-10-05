/* block-bind-kinds-lock.test.mjs — R7b 잠금 (lane-drag · 2026-10-05 · 지디 ⒜ + 잠금 시험)
 *
 * js/block-bind-kinds.js 가 «bindBlock 걸 종류»의 정본이다. 지금 그 명부를 쓰는 곳은 섹션 템플릿 넣기 하나뿐이고,
 * 손으로 적은 명부 8 곳은 0.9.7 에 옮긴다. 그 사이 «더 벌어지지» 않게, 손 명부마다 «오늘 빠진 종류»를 얼린다.
 *   - 손 명부가 종류를 «더» 빠뜨리면(줄 하나 지움) → 빨강.
 *   - 정본에 «새 종류»를 더하면 → 손 명부 8 곳이 전부 한 칸씩 더 벌어져 빨강(= 이 시험이 정본을 읽는다는 증거).
 *     그때 할 일: 손 명부에 그 종류를 넣거나, 아래 표에 «까닭»과 함께 얼린 칸을 늘린다.
 * 까닭 표기(지디 ㉠ — «의도» 를 짐작으로 적지 않는다):
 *   covered = 다른 클래스로 이미 걸림(잰 것: speech-bubble-block 은 text-block 을 같이 단다 — block-factory.js makeSpeechBubbleBlock)
 *   debt    = 걸려야 하는데 빠짐(실측 또는 코드독해로 증상 있음)
 *   unconfirmed = 그 길로 그 종류가 다시 태어나는지 아직 안 쟀다
 * (gradient-block 은 정본에서 뺐다 — bindBlock 이 아니라 bindGradientSelect 로 묶인다. 그래서 손 명부에 없어도 «빠짐»이 아니다.)
 * 자리는 «줄 번호»가 아니라 그 명부 글자를 찾아 읽는다(줄이 밀려도 같은 명부를 읽게).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (p) => fs.readFileSync(path.join(REPO, p), 'utf8');
const kindsOf = (s) => new Set([...s.matchAll(/\.([a-z0-9-]+-block)\b/g)].map(m => m[1]));

const ROSTER_SRC = read('js/block-bind-kinds.js');
const ROSTER = new Set([...ROSTER_SRC.slice(ROSTER_SRC.indexOf('BLOCK_BIND_KINDS'), ROSTER_SRC.indexOf(']);')).matchAll(/'([a-z0-9-]+-block)'/g)].map(m => m[1]));

/** 손 명부 하나 — file 안에서 anchor 글자로 시작하는 줄(occurrence 번째)의 셀렉터를 읽는다. */
function handList(file, anchor, occurrence = 0) {
  const src = read(file);
  let at = -1;
  for (let i = 0; i <= occurrence; i++) { at = src.indexOf(anchor, at + 1); if (at < 0) return null; }
  const end = src.indexOf('\n', at);
  return kindsOf(src.slice(at, end < 0 ? undefined : end));
}

const C = 'covered', D = 'debt', U = 'unconfirmed';
/* 얼린 표: 자리 → { 빠진 종류: 까닭 }. 오늘(2026-10-05 · f56222f2+R7b) 잰 그대로. */
const FROZEN = {
  'editor.js _bindPastedEl BLOCK_SEL': { file: 'js/editor.js', anchor: "const BLOCK_SEL = '.text-block", gaps: {} },
  'editor.js 붙여넣기 _ALL': { file: 'js/editor.js', anchor: "const _ALL = '.text-block", gaps: { 'joker-block': U } },
  'save-load.js rebindAll': { file: 'js/io/save-load.js', anchor: "canvasEl.querySelectorAll('.text-block, .asset-block", gaps: { 'speech-bubble-block': C } },
  'editor.js 초기 바인딩': { file: 'js/editor.js', anchor: "document.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block", gaps: { 'joker-block': U, 'shape-block': U, 'speech-bubble-block': C } },
  'block-factory.js 섹션 바인딩': { file: 'js/block-factory.js', anchor: "sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block", gaps: { 'banner02-block': U, 'canvas-block': U, 'comparison-block': U, 'icon-block': U, 'joker-block': U, 'mockup-block': U, 'modal-block': U, 'speech-bubble-block': C } },
  'template-system.js subsection 갈래': { file: 'js/panels/template-system.js', anchor: "ss.querySelectorAll('.text-block, .asset-block", gaps: { 'banner02-block': U, 'canvas-block': U, 'chat-block': U, 'comparison-block': U, 'laurel-block': U, 'mockup-block': U, 'speech-bubble-block': C, 'step-block': U, 'vector-block': U, 'zoom-block': U } },
  'section-variation.js createVariation': { file: 'js/section-variation.js', anchor: "clone.querySelectorAll('.text-block, .asset-block", occurrence: 0, gaps: Object.fromEntries(['banner02-block', 'canvas-block', 'chat-block', 'comparison-block', 'joker-block', 'laurel-block', 'mockup-block', 'modal-block', 'qa-block', 'shape-block', 'step-block', 'vector-block', 'zoom-block'].map(k => [k, D]).concat([['speech-bubble-block', C]])) },
  'section-variation.js addVariation': { file: 'js/section-variation.js', anchor: "clone.querySelectorAll('.text-block, .asset-block", occurrence: 1, gaps: Object.fromEntries(['banner02-block', 'canvas-block', 'chat-block', 'comparison-block', 'joker-block', 'laurel-block', 'mockup-block', 'modal-block', 'qa-block', 'shape-block', 'step-block', 'vector-block', 'zoom-block'].map(k => [k, D]).concat([['speech-bubble-block', C]])) },
};

test('정본 명부가 서 있다(28 종 · 만드는 자리가 있고 bindBlock 으로 묶이는 종류)', () => {
  assert.equal(ROSTER.size, 28, `정본 ${ROSTER.size} 종`);
});

test('★섹션 템플릿 넣기(section 갈래)는 손 명부가 아니라 정본에서 끌어온다', () => {
  const src = read('js/panels/template-system.js');
  assert.ok(/import\s*\{[^}]*BLOCK_BIND_SEL[^}]*\}\s*from\s*'\.\.\/block-bind-kinds\.js'/.test(src), 'template-system.js 가 block-bind-kinds.js 를 안 읽는다');
  assert.ok(/sec\.querySelectorAll\(BLOCK_BIND_SEL\)\.forEach/.test(src), 'section 갈래가 BLOCK_BIND_SEL 로 bindBlock 을 안 건다');
});

for (const [name, site] of Object.entries(FROZEN)) {
  test(`잠금 · ${name} — 오늘 얼린 것보다 «더» 빠지지 않는다`, () => {
    const got = handList(site.file, site.anchor, site.occurrence || 0);
    assert.ok(got, `${name}: 명부 줄을 못 찾았다(글자 «${site.anchor.slice(0, 40)}…» )`);
    const missing = [...ROSTER].filter(k => !got.has(k)).sort();
    const allowed = Object.keys(site.gaps).sort();
    const extra = missing.filter(k => !allowed.includes(k));
    assert.deepEqual(extra, [], `${name}: 새로 빠진 종류 ${JSON.stringify(extra)} (얼린 빠짐 ${allowed.length} · 지금 ${missing.length})`);
  });
}
