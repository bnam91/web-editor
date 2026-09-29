/* overlay-group-zorder-wiring.test.mjs — 오버레이 «그룹(⌘G)»·«앞뒤(⌘[ ⌘])» 의 배선 (2026-09-30)
 * 실행: node --test tests/unit/overlay-group-zorder-wiring.test.mjs
 *
 * ★동작 자체는 tests/dom/overlay-group-zorder.dom.spec.js 가 «진짜 브라우저»로 잰다
 *   (겹침 보존 · elementFromPoint 로 본 앞뒤). 이 파일은 그 검사가 «닿지 못하는 자리»만 문다:
 *     ⑴ 단축키가 그 함수로 가나 — DOM 검사는 함수를 직접 부른다(키를 안 친다)
 *     ⑵ 갈래의 «순서» — 뒤에 두면 앞 갈래가 먼저 삼켜 영영 안 돈다
 *     ⑶ 0 을 삼키는 `||` 폴백 — 왼쪽 끝(offset 0) 블록에서만 나는 함정이라 픽스처로 놓치기 쉽다
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const require_ = createRequire(import.meta.url);
const { sliceBlock } = require_('./_slice-block.js');
const ROOT = path.join(__dirname, '..', '..');

const ED = fs.readFileSync(path.join(ROOT, 'js', 'editor.js'), 'utf8');
const BF = fs.readFileSync(path.join(ROOT, 'js', 'block-factory.js'), 'utf8');
const SD = fs.readFileSync(path.join(ROOT, 'js', 'section-drag.js'), 'utf8');

const MOVE = sliceBlock(ED, 'function moveSelectedBlocks(');
const WRAP = sliceBlock(BF, 'function wrapSelectedBlocksInFrame(');
const UNGROUP = sliceBlock(SD, 'function ungroupBlock(');

test('W1 ★⌘[ / ⌘] 가 «메타 갈래 안»에서 moveSelectedBlocks 로 간다 (현빈 「커맨드 [ , ]」)', () => {
  const meta = ED.indexOf('if (e.metaKey || e.ctrlKey) {');
  const bl = ED.indexOf("if (e.code === 'BracketLeft') {");
  const br = ED.indexOf("if (e.code === 'BracketRight') {");
  assert.ok(meta > 0 && bl > meta && br > bl,
    '★대괄호 갈래가 ⌘/Ctrl 갈래 «밖»으로 나갔다 — 그러면 맨 대괄호가 블록을 옮긴다');
  assert.match(ED.slice(bl, bl + 400), /moveSelectedBlocks\('up'\)/, '★⌘[ 가 up 으로 안 간다');
  assert.match(ED.slice(br, br + 400), /moveSelectedBlocks\('down'\)/, '★⌘] 가 down 으로 안 간다');
});

test('W2 ★⌘G 가 groupSelectedBlocks → wrapSelectedBlocksInFrame({asGroup:true}) 로 간다', () => {
  assert.match(ED, /window\.groupSelectedBlocks\?\.\(\)/, '★⌘G 갈래가 groupSelectedBlocks 를 안 부른다');
  assert.match(BF, /function groupSelectedBlocks\(\) \{\s*\n\s*return wrapSelectedBlocksInFrame\(\{ asGroup: true \}\);/,
    '★groupSelectedBlocks 가 wrapSelectedBlocksInFrame 으로 안 간다');
});

test('W3 ⛔오버레이 갈래가 «맨 앞»이다 — 뒤에 두면 앞 갈래가 먼저 삼킨다', () => {
  /* moveSelectedBlocks: 프레임 갈래는 closest('.section-inner') 가 null 이라 그 자리에서
     return 한다 ⇒ 오버레이 갈래가 그 뒤에 있으면 «영영 안 돈다». */
  const iFloat = MOVE.indexOf('const _stackUnitOf =');
  const iFrame = MOVE.indexOf('const selFrame = window._activeFrame;');
  const iRow = MOVE.indexOf("const BLOCK_SEL =");
  assert.ok(iFloat > 0 && iFrame > 0 && iRow > 0, '★세 갈래 중 하나를 못 찾았다 — 이 단언이 낡았다');
  assert.ok(iFloat < iFrame && iFloat < iRow,
    `★moveSelectedBlocks 의 «겹침» 갈래가 맨 앞이 아니다(stack ${iFloat} / frame ${iFrame} / row ${iRow})`);
  /* ★형제 명부를 손으로 적지 않는다 — ⇧클릭이 쓰는 SIBLING_MULTI_SEL 을 그대로 쓴다.
     손으로 적으면 절대배치 «손잡이»(.frame-resize-handle 등)가 형제로 세어져 맨 앞/맨 뒤가 틀어진다. */
  assert.match(MOVE, /w\.matches\?\.\(SIBLING_MULTI_SEL\)/,
    '★겹침 갈래가 SIBLING_MULTI_SEL 을 안 쓴다 — 명부가 두 벌이 되고 손잡이가 형제로 세어진다');
  /* ★두 컨테이너를 «둘 다» 본다 — 오버레이(섹션 직속)와 자유배치 프레임 안(⌘G 그룹의 자식). */
  assert.match(MOVE, /contains\('section-block'\)/, '★섹션 직속(오버레이) 갈래가 없다');
  assert.match(MOVE, /dataset\?\.freeLayout === 'true'/, '★자유배치 프레임 안(그룹 자식) 갈래가 없다');

  /* wrapSelectedBlocksInFrame: 흐름 갈래는 stackY 로 «세로로 쌓는다» ⇒ 오버레이가 거기로
     떨어지면 사용자가 만든 겹침이 풀린다. 반드시 그 앞에서 가로채야 한다. */
  const iOv = WRAP.indexOf('const _floatWrapperOf =');
  const iFlow = WRAP.indexOf('// ── 섹션 레벨(flow) 블록 묶기');
  assert.ok(iOv > 0 && iFlow > 0, '★두 갈래 중 하나를 못 찾았다 — 이 단언이 낡았다');
  assert.ok(iOv < iFlow,
    `★⌘G 의 오버레이 갈래가 흐름 갈래 «뒤»에 있다(overlay ${iOv} / flow ${iFlow}) — 겹침이 세로로 풀린다`);
});

test('W4 ⛔좌표를 «0 을 삼키는» 폴백으로 읽지 않는다 (왼쪽 끝 블록에서만 나는 함정)', () => {
  const at = WRAP.indexOf('const _coord =');
  assert.ok(at > 0, '★좌표 해석자(_coord)를 못 찾았다');
  const body = WRAP.slice(at, WRAP.indexOf('};', at));
  assert.ok(/Number\.isFinite/.test(body),
    '★_coord 가 Number.isFinite 로 안 가른다 — `parseInt(a) || parseInt(b)` 꼴이면 offsetX=0 인 블록이 '
    + '조용히 style 값을 먹는다(둘이 어긋난 순간 좌표가 튄다)');
  assert.ok(!/parseInt\([^)]*\)\s*\|\|\s*parseInt/.test(body),
    `★_coord 에 0 을 삼키는 폴백이 있다 — 본 것: ${body}`);
});

test('W5 ★표식 되살리기는 «섹션 직속»일 때만 — 흐름 프레임의 언그룹은 안 건드린다', () => {
  const at = UNGROUP.indexOf("parent.classList?.contains('section-block')");
  assert.ok(at > 0, '★ungroupBlock 에 섹션 직속 판정이 없다 — 오버레이 그룹을 풀면 표식이 사라진다');
  const body = UNGROUP.slice(at, UNGROUP.indexOf('groupEl.remove();', at));
  for (const k of ['overlayBlock', 'overlayReturnParent', 'overlayReturnAfter', 'selVariant']) {
    assert.ok(body.includes(k), `★되살리는 칸에 ${k} 가 빠졌다 — enterFloat 이 다는 것과 같아야 한다`);
  }
  assert.ok(body.includes('window._bindOverlayMoveDrag?.('),
    '★되살린 뒤 오버레이 이동 배선을 다시 안 건다 — 풀자마자 못 끄는 블록이 된다');
});
