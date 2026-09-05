/* 단위 하네스 — 프레임 «신규 추가» 텍스트의 글자정렬 계약 (현빈 2026-09-05)
 *
 *   (a) 프레임 안에 «새로» 만드는 텍스트 → 글자 정렬도 중앙 + 좌표도 중앙
 *   (b) 외부에서 들고 들어옴(드롭·붙여넣기·복제) → 글자 정렬 «무접촉», 좌표만 중앙
 *   (c) 「중앙」의 기준 = 프레임블럭의 «보여지는» 가로너비
 *
 * ★frame-geometry.test.mjs 관례를 그대로 따른다 — 실제 소스 파일을 .mjs 별칭으로 복사해 import,
 *   기대값에 리터럴을 안 박고(상수 import), 호출부 검사는 «실제 소스 텍스트»를 읽어 센다.
 * ★음성대조를 같이 둔다 — 「어디에도 안 샜다」를 증명하려면 «갈리는» 축이 있어야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'fs';
import os from 'os';
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const srcPath = path.join(ROOT, 'js/frame-geometry.js');
const aliasPath = path.join(os.tmpdir(), `ftc-alias-${process.pid}.mjs`);
fs.copyFileSync(srcPath, aliasPath);
const G = await import(pathToFileURL(aliasPath).href);
fs.unlinkSync(aliasPath);

const read = rel => fs.readFileSync(path.join(ROOT, rel), 'utf8');

/* 프레임 스텁 — clientWidth/Height 와 «다른» rect/dataset 값을 일부러 심어
   어느 축을 읽는지 갈라낸다. */
const frameStub = (over = {}) => ({
  clientWidth: 860, clientHeight: 520,
  offsetWidth: 900, offsetHeight: 560,
  getBoundingClientRect: () => ({ width: 344, height: 208 }),   // 40% 줌 상황(실측치)
  dataset: { freeLayout: 'true', width: '860', height: '520' },
  ...over,
});

/* ═══ ① (a)/(b) 판정 술어 — newTextAlignInFrame ═══ */

test('①-a (a) 자유배치 프레임에 «좌표도 정렬도 안 준» 신규 추가 → 중앙 (상수와 대조)', () => {
  assert.equal(G.newTextAlignInFrame(frameStub(), undefined, false), G.FRAME_NEW_TEXT_ALIGN);
  assert.equal(G.newTextAlignInFrame(frameStub(), '', false), G.FRAME_NEW_TEXT_ALIGN);
  // 상수가 실제로 «가운데»인지 — 지시문이 요구한 값
  assert.equal(G.FRAME_NEW_TEXT_ALIGN, 'center');
});

test('①-b ★호출자가 align 을 명시하면 «그가 이긴다» — 덮으면 MCP·API 가 지정한 정렬이 사라진다', () => {
  for (const a of ['left', 'right', 'justify', 'center']) {
    assert.equal(G.newTextAlignInFrame(frameStub(), a, false), null, `align=${a} 를 덮었다`);
  }
});

test('①-c ★좌표를 «준» 호출(MCP·Figma 임포트)은 (a) 가 아니다 — 무접촉', () => {
  assert.equal(G.newTextAlignInFrame(frameStub(), undefined, true), null);
});

test('①-d ★회귀 금지선 — 자유배치 프레임이 «아니면» 아무것도 하지 않는다', () => {
  assert.equal(G.newTextAlignInFrame(null, undefined, false), null, '섹션 직접(프레임 없음)');
  assert.equal(G.newTextAlignInFrame(frameStub({ dataset: { fullWidth: 'true' } }), undefined, false), null,
               'fullWidth(플로우) 프레임');
  assert.equal(G.newTextAlignInFrame(frameStub({ dataset: {} }), undefined, false), null, '플래그 없는 프레임');
  assert.equal(G.newTextAlignInFrame({}, undefined, false), null, 'dataset 자체가 없는 요소');
});

/* ═══ ② (c) 「보여지는 가로너비」 축 ═══ */

test('②-a frameVisibleSize 는 clientWidth/Height 를 읽는다 — offset·rect·dataset «아님»', () => {
  const f = frameStub();
  assert.deepEqual(G.frameVisibleSize(f), { w: f.clientWidth, h: f.clientHeight });
  // 음성대조: 스텁이 실제로 «갈리는» 값을 갖고 있는지(안 갈리면 이 테스트는 항상 초록이다)
  assert.notEqual(f.clientWidth, f.offsetWidth);
  assert.notEqual(f.clientWidth, f.getBoundingClientRect().width);
});

test('②-b ★줌(rect) 축으로 중앙을 내면 어긋난다 — 실측 재현(40% 줌: 정답 330 vs rect 72)', () => {
  const f = frameStub();               // clientWidth 860 / rect 344 (실측 40% 줌)
  const elW = 200;                     // 자식 offsetWidth 는 스케일을 «안» 받는다
  const good = G.frameAlignOffset(G.frameVisibleSize(f).w, 0, elW, 0, 'center', null).left;
  const bad  = G.frameAlignOffset(f.getBoundingClientRect().width, 0, elW, 0, 'center', null).left;
  assert.equal(good, Math.round((f.clientWidth - elW) / 2));
  assert.notEqual(good, bad);
  assert.ok(Math.abs(good - bad) > 200, `두 축이 갈리지 않으면 이 테스트는 무의미하다 (${good} vs ${bad})`);
});

test('②-c dataset.width 는 «설정값» — max-width 로 줄어든 프레임에서 clientWidth 와 갈린다', () => {
  const nested = frameStub({ clientWidth: 400, dataset: { freeLayout: 'true', width: '860' } });
  assert.equal(G.frameVisibleSize(nested).w, 400);
  assert.notEqual(G.frameVisibleSize(nested).w, Number(nested.dataset.width));
});

/* ═══ ③ 캐스케이드가 프레임 밖으로 밀어내지 않는가 ═══ */

test('③-a 폭을 꽉 채운 자식(가운데정렬 텍스트프레임 width:100%)은 X 캐스케이드가 «사라진다»', () => {
  const fw = 860;
  const cascaded = G.cascadeIfOccupied(0, 231, [{ left: 0, top: 231 }]);
  assert.equal(cascaded.left, 20, '캐스케이드 자체는 여전히 X 를 민다(음성대조)');
  assert.equal(G.clampLeftIntoFrame(cascaded.left, fw, fw), 0, '꽉 찬 폭인데 X 가 밀렸다');
  assert.equal(cascaded.top, 251, 'Y 캐스케이드는 살아있어야 겹침이 막힌다');
});

test('③-b 여유가 있으면 캐스케이드를 «그대로» 둔다 — 클램프가 과잉이면 안 된다', () => {
  assert.equal(G.clampLeftIntoFrame(20, 860, 338), 20);
  assert.equal(G.clampLeftIntoFrame(350, 860, 160), 350);
  // 자식이 프레임보다 크면 0(음수로 밀어내지 않는다)
  assert.equal(G.clampLeftIntoFrame(20, 400, 800), 0);
});

/* ═══ ④ 호출부 전수 — 「같은 판정을 여러 곳에 베끼지 마라」 ═══ */

/* (a) 두 경로의 «함수 본문»만 잘라낸다 — 파일 전체를 보면 무관한 'center'(alignSelf,
   backgroundPosition, enum 검사 등 30여 곳)에 걸려 규칙이 무의미해진다. */
function aPathBodies() {
  const bf = read('js/block-factory.js');
  const at = bf.indexOf('function addTextBlock');
  const ab = bf.indexOf('function addBlankTextBlock');
  const end = bf.indexOf('function isVisuallyBlankButHasBreaks');
  assert.ok(at > 0 && ab > at && end > ab, '(a) 두 함수의 경계를 못 찾았다');
  return { bf, addText: bf.slice(at, ab), addBlank: bf.slice(ab, end) };
}

test('④-a (a) 판정은 술어 하나다 — 두 함수 본문에 «가운데»를 손으로 박은 자리가 없다', () => {
  const { addText, addBlank } = aPathBodies();
  for (const [name, body] of [['addTextBlock', addText], ['addBlankTextBlock', addBlank]]) {
    assert.match(body, /newTextAlignInFrame\(/, `${name} 이 술어를 안 쓴다`);
    // ★M7 형태(align: opts.align || 'center')까지 잡으려면 «리터럴 자체»를 금지해야 한다.
    //   두 본문에는 원래 'center' 가 한 번도 안 나온다(음성대조는 아래 ok() 로).
    assert.ok(!/'center'/.test(body), `${name} 본문에 'center' 리터럴이 박혀있다 — 술어 우회`);
  }
  // 음성대조 ①: 잘라낸 본문이 «실제로 내용이 있는지»(빈 문자열이면 위 규칙은 항상 초록)
  assert.ok(addText.length > 2000 && addBlank.length > 1500, '본문 슬라이스가 너무 짧다');
  // 음성대조 ②: 이 정규식이 실제로 무언가를 잡는지 — SSOT 는 자기 안에 상수를 갖고 있어야 한다
  assert.match(read('js/frame-geometry.js'), /FRAME_NEW_TEXT_ALIGN\s*=\s*'center'/);
});

test('④-b ★(a) 두 경로(addTextBlock·addBlankTextBlock)가 «둘 다» 술어를 부른다', () => {
  const bf = read('js/block-factory.js');
  const at = bf.indexOf('function addTextBlock');
  const ab = bf.indexOf('function addBlankTextBlock');
  const after = bf.indexOf('function _makeTextFrame') > ab ? bf.indexOf('function _makeTextFrame') : bf.length;
  assert.ok(at > 0 && ab > at, '함수 위치를 못 찾았다');
  assert.match(bf.slice(at, ab), /newTextAlignInFrame\(/, 'addTextBlock 누락');
  assert.match(bf.slice(ab, after), /newTextAlignInFrame\(/, 'addBlankTextBlock 누락');
});

test('④-c ★정렬은 applyTextOpts «전»에 정해져야 한다 — 뒤면 폭 클램프가 한 박자 늦는다', () => {
  const bf = read('js/block-factory.js');
  const at = bf.indexOf('function addTextBlock');
  const ab = bf.indexOf('function addBlankTextBlock');
  const body = bf.slice(at, ab);
  const iPred = body.indexOf('newTextAlignInFrame(');
  const iApply = body.indexOf('applyTextOpts(');
  const iClamp = body.indexOf('_clampTextFrameWidth(');
  assert.ok(iPred > 0 && iApply > 0 && iClamp > 0, '세 자리를 다 못 찾았다');
  assert.ok(iPred < iApply, '술어가 applyTextOpts 뒤에 있다');
  assert.ok(iApply < iClamp, 'applyTextOpts 가 폭 클램프 뒤에 있다');
});

test('④-d ★(b) 경로는 술어를 «안» 부른다 — 부르면 계약 위반(글자정렬 무접촉)', () => {
  for (const f of ['js/block-drag.js', 'js/editor.js']) {
    assert.ok(!/newTextAlignInFrame/.test(read(f)), `${f} 가 (a) 술어를 불렀다`);
    assert.ok(!/\.style\.textAlign\s*=/.test(read(f)), `${f} 가 text-align 을 건드린다`);
  }
});

test('④-e ★(b) 드롭 경로는 «좌표만» 중앙 — left 하드코딩 0px 이 아니라 공유 술어를 쓴다', () => {
  const bd = read('js/block-drag.js');
  assert.match(bd, /from '\.\/frame-geometry\.js'/, 'block-drag 가 SSOT 를 import 안 한다');
  // 재정렬 루프가 중앙 술어를 쓰는가
  const loop = bd.slice(bd.indexOf('DOM 순서 변경 후 absolute 블록의 top 재계산'));
  const seg = loop.slice(0, 1400);
  assert.match(seg, /frameVisibleSize\(/, '드롭 루프가 (c) 축 술어를 안 쓴다');
  assert.match(seg, /frameAlignOffset\(/, '드롭 루프가 중앙 술어를 안 쓴다');
  assert.ok(!/b\.style\.left\s*=\s*'0px'/.test(seg), "드롭 루프에 left='0px' 하드코딩이 남아있다");
});

test('④-f ★섹션 정렬 상속이 «프레임 안» 텍스트를 근거로 쓰지 않는다 (회귀 금지선 누출 경로)', () => {
  const du = read('js/drag-utils.js');
  const i = du.indexOf('function getSectionAlign');
  const body = du.slice(i, i + 900);
  assert.match(body, /data-free-layout/, '자유배치 프레임 제외 가드가 없다');
  assert.ok(!/const first = sec\.querySelector\(/.test(body), '옛 «첫 하나만 본다» 구현이 남아있다');
});

test('④-g 좌표 중앙배치는 (c) 축을 쓴다 — 정렬버튼과 삽입경로가 같은 폭을 본다', () => {
  const bf = read('js/block-factory.js');
  const i = bf.indexOf('function _placeAtFrameCenter');
  const body = bf.slice(i, i + 1800);
  assert.match(body, /frameVisibleSize\(frame\)/, '_placeAtFrameCenter 가 (c) 축 술어를 안 쓴다');
  assert.ok(!/frame\.clientWidth/.test(body), '축을 «두 벌»로 읽고 있다(직접 clientWidth)');
  assert.match(body, /clampLeftIntoFrame\(/, '캐스케이드 클램프가 SSOT 를 안 쓴다');
});
