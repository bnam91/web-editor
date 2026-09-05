/* U-GRIDOUT 하네스 — 그리드 «아웃라인 방향·줌보정» 회귀 가드 + 칼럼 경계 가이드 계약.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  라이브 userData 무접촉(CSS 소스만 읽는다).
 *
 * ★왜 이 파일이 있나 — 현빈 2026-09-05 제보 둘이 «같은 뿌리»였다.
 *   ⑴ 「그리드 블럭에 셀 아웃라인과 그리드블럭 아웃라인이 안 맞아. 1*1번째 셀 텍스트를
 *      더블클릭하면 에디트 모드되면서 텍스트 아웃라인 박스가 튀어나가잖아」(grd_ts0he_zf5bpyt)
 *      ⇒ 블록 테두리는 offset «음수»(안쪽), 편집 테두리는 «+2px»(바깥쪽)로 방향이 반대였다.
 *        그리드 안쪽 여백이 0 이라(실측 .grd-inner padding 0, cell.left === block.left)
 *        1행 1열에선 그 3px 이 블록 «밖»으로 그대로 나갔다.
 *   ⑵ 편집 테두리 폭이 «생짜 1px» 이었다 — 스케일러 안이라 줌에 곱해진다.
 *      10% 축소면 화면상 0.1px(사실상 안 보임), 400% 면 4px. 즉 어긋남이 줌마다 달랐다.
 *      ★현빈이 요즘 10% 에서 작업하셨다 — 「어떤 땐 안 보이고 어떤 땐 튄다」의 정체.
 *   ⑶ 「1*2 인 경우에 칼럼과 칼럼 사이에 갭이 있는지? 영역이 어떻게 되는지 몰겠네」
 *      ⇒ 갭은 «있었다»(GRID_DEFAULTS.gap=24). 표시가 없었을 뿐이다.
 *
 * ★기대값에 숫자를 박지 않는다 — 「블록 테두리와 «같은 식»인가」로 비교한다.
 *   그래야 나중에 토큰이 바뀌어도 둘이 «같이» 움직인다(한쪽만 늙는 것을 막는다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

const BLOCKS = read('css/editor-blocks.css');
const GRIDJS = read('js/blocks/grid-block.js');

/** 주석을 걷어낸다 — 주석 안의 옛 값(폐기 기록)이 검사에 걸리면 안 된다. */
const strip = s => s.replace(/\/\*[\s\S]*?\*\//g, '');

/** 셀렉터 하나의 선언 블록을 CSS 에서 뽑는다(주석 제거 후). */
function ruleFor(css, selectorNeedle) {
  const src = strip(css);
  const i = src.indexOf(selectorNeedle);
  assert.ok(i !== -1, `셀렉터를 못 찾음: ${selectorNeedle} — 리팩터링됐나?`);
  const a = src.indexOf('{', i), b = src.indexOf('}', a);
  assert.ok(a !== -1 && b > a, `선언 블록을 못 찾음: ${selectorNeedle}`);
  return src.slice(a + 1, b).trim();
}

const decl = (body, prop) => {
  const m = body.match(new RegExp(`(?:^|;)\\s*${prop}\\s*:\\s*([^;]+)`));
  return m ? m[1].trim() : null;
};

/* ── 기준선: 블록 선택 테두리가 «정본»이다 ────────────────────────── */
const BLOCK_SEL_BODY = ruleFor(BLOCKS, '.innercard-block.selected {');
const BLOCK_W   = decl(BLOCK_SEL_BODY, 'outline');
const BLOCK_OFF = decl(BLOCK_SEL_BODY, 'outline-offset');

test('U-GRIDOUT0 기준선 — 블록 선택 테두리는 «안쪽»이고 줌 보정을 쓴다(이게 정본)', () => {
  assert.match(BLOCK_W,   /--sel-outline-w/, '블록 테두리 폭이 토큰이 아니다 — 기준선이 흔들렸다');
  assert.match(BLOCK_OFF, /^calc\(\s*-1\s*\*/, '블록 테두리 offset 이 음수(안쪽)가 아니다');
});

/* ── [M51] 편집 테두리 방향 ───────────────────────────────────────── */
const EDIT_BODY = ruleFor(BLOCKS, '#canvas .grid-block [contenteditable="true"] {');

test('★M51 — 편집 테두리 offset 이 «음수»(안쪽)다. 양수면 1행1열에서 블록 밖으로 튀어나간다', () => {
  const off = decl(EDIT_BODY, 'outline-offset');
  assert.ok(off, '편집 테두리에 outline-offset 이 없다');
  assert.doesNotMatch(off, /^\s*\+?\d/, `offset 이 양수다(${off}) — 현빈 제보의 «튀어나감» 그 자체다`);
  assert.match(off, /^calc\(\s*-1\s*\*/, `offset 이 음수 calc 가 아니다: ${off}`);
});

test('★M51 — 편집 테두리와 블록 테두리는 «같은 식»이어야 한다(한쪽만 늙는 것을 막는다)', () => {
  assert.equal(decl(EDIT_BODY, 'outline-offset'), BLOCK_OFF,
    'offset 식이 블록 테두리와 다르다 — 토큰이 바뀌면 둘이 갈라진다');
});

/* ── [M56] 줌 보정 ────────────────────────────────────────────────── */
test('★M56 — 편집 테두리 폭이 «생짜 px» 이 아니라 줌 보정 토큰이다(10%에서 0.1px 로 사라졌다)', () => {
  const w = decl(EDIT_BODY, 'outline');
  assert.ok(w, '편집 테두리에 outline 이 없다');
  assert.doesNotMatch(w, /(^|\s)\d+(\.\d+)?px/, `폭이 생짜 px 다(${w}) — 스케일러 안이라 줌에 곱해진다`);
  assert.match(w, /--sel-outline-w/, `폭이 --sel-outline-w 가 아니다: ${w}`);
});

test('★M56 — 축소 상태 가독성 보강: 배경 틴트가 있다(.text-block.editing 과 같은 두 겹 관례)', () => {
  const bg = decl(EDIT_BODY, 'background');
  assert.ok(bg, '배경 틴트가 없다 — 줌 보정을 해도 1px 은 축소 상태에서 있는지 없는지다');
  assert.match(bg, /--sel-color-fill/, `틴트가 토큰이 아니다: ${bg}`);
});

/* ── [M52] 칼럼 경계 가이드 ───────────────────────────────────────── */
test('★M52 — 갭은 «있다». 가이드는 그 갭을 잠식하지 않는다(offset 음수)', () => {
  // 갭이 실재한다는 것부터 소스로 확인한다 — 「있나?」가 현빈의 첫 물음이었다.
  const gap = strip(GRIDJS).match(/gap\s*:\s*(\d+)/);
  assert.ok(gap && Number(gap[1]) > 0, 'GRID_DEFAULTS.gap 이 0 이거나 사라졌다');

  const body = ruleFor(BLOCKS, '#canvas .grid-block.selected > .grd-inner > .grd-cell,');
  const off = decl(body, 'outline-offset');
  assert.match(off, /^calc\(\s*-1\s*\*/,
    `가이드 offset 이 음수가 아니다(${off}) — 바깥이면 점선이 갭을 잠식해 갭이 좁아 보인다`);
  assert.match(decl(body, 'outline'), /dashed/, '가이드가 점선이 아니다 — 블록 테두리와 위계가 안 갈린다');
});

test('★M52 — 가이드는 .selected «와» .editing 둘 다에 걸린다(편집 중에 사라지면 안 된다)', () => {
  const src = strip(BLOCKS);
  assert.ok(src.includes('#canvas .grid-block.selected > .grd-inner > .grd-cell'),
    '.selected 판이 없다');
  assert.ok(src.includes('#canvas .grid-block.editing  > .grd-inner > .grd-cell')
         || src.includes('#canvas .grid-block.editing > .grd-inner > .grd-cell'),
    '.editing 판이 없다 — 더블클릭해 편집에 들어가는 «가장 필요한 순간»에 가이드가 꺼진다');
});

test('★M52 — 가이드는 «직계»만 두른다(그리드 안에 그리드가 와도 남의 칸을 안 건드린다)', () => {
  const src = strip(BLOCKS);
  assert.ok(!/\.grid-block\.selected\s+\.grd-cell\s*[,{]/.test(src),
    '자손 셀렉터(공백)로 걸려 있다 — 중첩 그리드의 안쪽 칸까지 두른다');
});

test('★M52·M51 — 캔버스 밖(내보내기 클론)으로 안 샌다: 두 규칙 다 #canvas 스코프', () => {
  const src = strip(BLOCKS);
  for (const needle of ['.grid-block [contenteditable="true"]',
                        '.grid-block.selected > .grd-inner > .grd-cell']) {
    const i = src.indexOf(needle);
    assert.ok(i !== -1, `규칙을 못 찾음: ${needle}`);
    assert.ok(src.slice(Math.max(0, i - 10), i).includes('#canvas'),
      `${needle} 앞에 #canvas 스코프가 없다 — export 클론에 샌다`);
  }
});
