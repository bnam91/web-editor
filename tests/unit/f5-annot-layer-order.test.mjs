/* f5-annot-layer-order.test.mjs — 1020t2f5 어노테이션 ⌘] / ⌘[ (현빈 261026 답 · 지디 갈래 ㉡)
 *
 *   F1 ⛔SECTION_BLOCK_TYPE_SEL 무접촉 — 값(명부 33)이 5e4256d1 과 «글자 그대로» 같다 · .annotation-block 0
 *   F2 ⛔editor.js ⌘[ / ⌘] 갈래 무접촉 — 그 안에 annotLayerOrder 0 · W1 거리(갈래 머리 → moveSelectedBlocks) 351 / 354 그대로
 *       (⒞ 꼴 한 줄을 넣으면 425 / 430 — W1 400 · U1 375 를 넘는다 · S3 실측 · 그래서 capture 꼴로 갔다)
 *   F3 annotation-select.js — capture keydown(BracketLeft/Right · ⌘ · ⌥ 아님 · 입력칸·편집 돌려보냄 · 스크래치 양보) · 이력 이름이
 *       스티커 선례(sticker-select.js)와 «같은 글자» · 블럭별 z 는 인라인 style.zIndex
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..', '..');
const ED = readFileSync(join(ROOT, 'js/editor.js'), 'utf8');
const AS = readFileSync(join(ROOT, 'js/annotation-select.js'), 'utf8');
const ST = readFileSync(join(ROOT, 'js/sticker-select.js'), 'utf8');

/* 5e4256d1 의 값 — 손으로 바꾸지 마라(바뀌면 그 까닭을 적고 같이 고친다) */
const SECTION_SEL_AT_5E4256D1 = ['.text-block', '.asset-block', '.gap-block', '.icon-circle-block', '.icon-text-block', '.icon-block',
  '.table-block', '.label-group-block', '.graph-block', '.divider-block', '.bridge-block', '.grid-block', '.infocard-block', '.innercard-block',
  '.modal-block', '.shape-block', '.speech-bubble-block', '.banner02-block', '.comparison-block', '.mockup-block', '.vector-block', '.step-block',
  '.joker-block', '.canvas-block', '.chat-block', '.coupon-block', '.quote-block', '.radial-block', '.gradient-block', '.sticker-block',
  '.laurel-block', '.zoom-block', '.qa-block'];

test('F1 ⛔SECTION_BLOCK_TYPE_SEL 무접촉 — 값 그대로 · .annotation-block 0', () => {
  const a = ED.indexOf('const SECTION_BLOCK_TYPE_SEL = [');
  const b = ED.indexOf('].join(', a);
  assert.ok(a > 0 && b > a, '★정의를 못 찾았다 — 이 단언이 낡았다');
  const items = [...ED.slice(a, b).matchAll(/'([^']+)'/g)].map((m) => m[1]);
  assert.deepEqual(items, SECTION_SEL_AT_5E4256D1, '★정본 명부가 바뀌었다');
  assert.equal(items.includes('.annotation-block'), false, '★주석을 정본에 더했다 — 파생 명부 여럿이 같이 바뀐다');
});

test('F2 ⛔editor.js ⌘[ / ⌘] 갈래 무접촉 — annotLayerOrder 0 · W1 거리 351 / 354', () => {
  for (const [k, d, want] of [['BracketLeft', 'up', 351], ['BracketRight', 'down', 354]]) {
    const at = ED.indexOf(`if (e.code === '${k}') {`);
    const end = ED.indexOf(`moveSelectedBlocks('${d}')`, at);
    assert.ok(at > 0 && end > at, `★${k} 갈래를 못 찾았다`);
    assert.equal(ED.slice(at, end).includes('annotLayerOrder'), false, `★${k} 갈래에 주석 줄을 넣었다(W1 을 넘는다)`);
    assert.equal(end - at, want, `★${k} 갈래 길이가 바뀌었다 — W1 여유를 다시 재라`);
  }
});

test('F3 capture keydown · 이력 이름 = 스티커 선례 글자 · 인라인 z', () => {
  assert.match(AS, /window\.annotLayerOrder = annotLayerOrder;/, '★창 입구가 없다');
  const cap = AS.slice(AS.indexOf("window.annotLayerOrder = annotLayerOrder;"));
  assert.match(cap, /document\.addEventListener\('keydown',[\s\S]*?BracketLeft[\s\S]*?BracketRight[\s\S]*?\}, true\);/, '★capture 로 안 걸었다');
  assert.match(cap, /_scratchHasSelection/, '★스크래치 양보가 없다(키 다툼)');
  assert.match(cap, /isContentEditable\)\) return;/, '★편집 중 돌려보냄이 없다');
  const names = (src) => (src.match(/pushHistory\?\.\(direction === 'up' \? '([^']+)' : '([^']+)'\)/) || []).slice(1);
  assert.deepEqual(names(AS), names(ST), '★이력 이름이 선례와 다르다');
  assert.deepEqual(names(AS), ['뒤로 보내기', '앞으로 가져오기']);
  assert.match(AS, /a\.style\.zIndex = String\(z\)/, '★블럭별 z 를 인라인으로 안 쓴다');
});
