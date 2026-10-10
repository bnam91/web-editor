/* block-full-bleed — 「패딩 제외(full-bleed)」 공용 부품의 «계약»을 잠근다. (2026-09-10 신설)
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스에서 «진짜 함수»를 떼어 실행한다.
 *
 * ★왜 이 파일이 있나
 *   현빈: 「배너블럭2과 프레임블럭의 경우 에셋블럭의 경우처럼 패딩제외 라디오버튼의 기능을 넣어줘.」
 *   뿌리는 에셋블럭(prop-asset.js `dataset.usePadx` + prop-page.js applyAssetFullBleed)이고,
 *   비에셋 블록은 그 패턴을 per-block `dataset.fullBleed` 로 미러해 왔다(chat-block·canvas-block).
 *   ⇒ 새 방식을 만들지 않고 그 규약을 공용 부품으로 뽑아 프레임·배너2 에 물렸다.
 *
 * ★이 파일이 지키는 것 — «기본이 끔»이 전부다
 *   P2 기본(끔)에서는 «아무것도» 안 만진다 → 이미 만든 배너·프레임이 안 바뀐다.
 *   ⛔이 계약이 깨지면 옛 문서 전부가 조용히 넓어진다. 그래서 «스타일 쓰기 자체»를 센다.
 *
 * ★실측으로 잡은 함정 (2026-09-10, 앱 9396, 프레임)
 *   프레임은 인라인 `max-width:100%` 를 달고 태어난다. 켤 때 그걸 none 으로 밀어야 폭이 넓어지는데,
 *   끌 때 되돌리지 않으면 860px 가 안 잘리고 «섹션 밖으로 삐져나간 채» 굳었다.
 *   ⇒ 켤 때 원래 값을 적어 두고 끌 때 되돌린다. F3/F4 가 그 왕복을 잠근다.
 *
 * ⚠️「화면에 실제로 먹는가」의 런타임 실측은 CDP(앱 9396)로 한다. 여기는 «규약»을 잠그는 그물이다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const strip = (src) => { const s = makeStripper(); return src.split('\n').map(s).join('\n'); };

const DRAG = strip(readSrc(ROOT, 'js/drag-utils.js'));

function sliceFn(src, head, what) {
  const i = src.indexOf(head);
  assert.ok(i >= 0, `«${head}» 를 못 찾았다 (${what}) — 이름이 바뀌었으면 이 검사도 같이 옮겨라`);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  return src.slice(i, j);
}

/* ★★2026-10-09 — ★`effectiveSectionPadX` 가 ★★«이 프레임이 정말 자르나»를 ★제 벌로 세지 않고
   ★★공용 술어를 ★부른다(★명부 ★하나). ⇒ ★★그 술어도 ★같이 싣는다.
   ⛔안 실으면 ★`ReferenceError: clipsContent is not defined` 로 ★★P1d 셋이 ★빨개진다
     — ★2026-10-09 ★실제로 그랬고, ★★그것이 ★「★import 를 늘리면 ★하네스가 ★조용히(또는 요란히) 빈다」의 자리다.
   ★★그리고 ★이렇게 ★진짜 술어를 ★실어야 ★아래 P1d 셋이 ★★«제품이 쓰는 그 판정»을 ★잰다
     — ⛔사본을 ★여기 적으면 ★이 검사가 ★★제 사본만 잰다.
   ★★★2026-10-10 ㈄ — ★싣는 ★조각이 ★★1 → ★★여럿이 됐다. ★까닭:
     ★옛 `clipsContent` 는 ★★한 함수로 ★자립했지만, ★공용 `clipsContent` 는
     ★★`clipFamily` ＋ ★`CLIP_DEFAULTS` 와 ★★한 벌이다 ⇒ ★★함수 하나만 떠내면 ★ReferenceError 다.
     ⇒ ★★`js/clip-content.js` 는 ★★import 가 ★★0 이라(★실측) ★★모듈 ★통째로 ★실을 수 있다
       — ★조각을 ★세 번 ★떠내는 것보다 ★★덜 ★부서진다(★이름을 ★하나 바꿔도 ★여기가 ★안 깨진다). */
const CLIP_SRC = strip(readSrc(ROOT, 'js/clip-content.js'))
  .replace(/^\s*export\s+/gm, '')
  .replace(/^if \(typeof window[\s\S]*$/m, '')    /* ★window 노출 꼬리는 ★vm 에 ★필요 없다 */
  /* ★★★`vm` 에서 ★최상위 ★`const` 는 ★★전역 ★«속성»이 ★안 된다(★함수 선언만 된다) ⇒ ★`ctx.CLIP_DEFAULTS`
     ★가 ★★undefined 였다(★실측 2026-10-10: ★표 단언이 ★빨개져 ★잡았다). ★★`var` 로 ★바꿔 ★내보낸다.
     ⛔줄 ★맨 앞만 ★바꾼다 — ★함수 ★안의 ★`const` 는 ★그대로 둔다(★얼기 유지) */
  .replace(/^const /gm, 'var ');
const CLIPS_SRC = CLIP_SRC;
/* ★★★2026-10-10 — ★`effectiveSectionPadX` 가 ★★`sectionPadX` 를 ★부른다(★물음을 ★갈랐다) ⇒ ★★둘 다 ★싣는다.
   ⛔하나만 실으면 ★`ReferenceError: sectionPadX is not defined` 로 ★★여덟 칸이 ★빨개진다(★실측 2026-10-10). */
const SPX_SRC   = sliceFn(DRAG, 'function sectionPadX(', 'drag-utils');
const EFF_SRC   = sliceFn(DRAG, 'function effectiveSectionPadX(', 'drag-utils');
const APPLY_SRC = sliceFn(DRAG, 'function applyBlockFullBleed(', 'drag-utils');
const CLEAR_SRC = sliceFn(DRAG, 'function clearBlockFullBleed(', 'drag-utils');

/* state.pageSettings.padX 는 모듈 import 라 vm 에 «주입»한다 — 검사가 전역 기본값을 흔들 수 있어야 한다. */
const ctx = vm.createContext({ state: { pageSettings: { padX: 32 } } });
vm.runInContext(`${CLIPS_SRC}\n${SPX_SRC}\n${EFF_SRC}\n${APPLY_SRC}\n${CLEAR_SRC}`, ctx);
const { effectiveSectionPadX, sectionPadX, applyBlockFullBleed, clearBlockFullBleed,
        clipsContent, clipFamily, CLIP_DEFAULTS } = ctx;
assert.equal(typeof sectionPadX, 'function',
  '★sectionPadX 가 ★하네스에 ★안 실렸다 — ★effectiveSectionPadX 가 ★그것을 ★부른다');
/* ★전제 — ★공용 술어가 ★정말 실렸다. ⛔이게 안 서면 ★아래 P1d 셋이 ★«무엇을 쟀는지» 모른다
   ★★한 벌이 ★★셋이라 ★★셋 다 ★단언한다 — ★하나만 비어도 ★★조용히 ★undefined 가 돈다 */
assert.equal(typeof clipsContent, 'function',
  '★clipsContent 가 ★하네스에 ★안 실렸다 — ★effectiveSectionPadX 가 ★그것을 부른다');
assert.equal(typeof clipFamily, 'function', '★clipFamily 가 ★안 실렸다 — ★clipsContent 가 ★그것을 부른다');
assert.equal(typeof CLIP_DEFAULTS, 'object', '★CLIP_DEFAULTS 표가 ★안 실렸다 — ★계열 기본값이 ★undefined 가 된다');
/* ★★★그리고 ★★«이 하네스가 ★제품과 ★같은 답을 내나»를 ★한 번 ★눌러 본다 —
   ⛔typeof 만으론 ★★«실렸다»지 ★★«맞게 돈다»가 ★아니다 */
assert.equal(clipFamily({ classList: { contains: (c) => c === 'frame-block' } }), 'frame',
  '★하네스에서 ★계열 판정이 ★안 돈다');
assert.equal(CLIP_DEFAULTS.frame, true, '★프레임 기본값이 ★자름이 ★아니다 — ★표가 ★바뀠다');

/* ── 최소 DOM 흉내 ── «스타일 쓰기»를 세기 위해 style 을 Proxy 로 감싼다. */
function makeEl({ cls = [], dataset = {}, style = {}, parent = null } = {}) {
  const writes = [];
  const raw = { ...style };
  const el = {
    nodeType: 1,
    _writes: writes,
    dataset: { ...dataset },
    parentElement: parent,
    classList: { contains: (c) => cls.includes(c) },
    style: new Proxy(raw, {
      set(t, k, v) { writes.push(String(k)); t[k] = v; return true; },
    }),
    closest(sel) {
      let cur = el;
      while (cur) {
        const names = cur === el ? cls : cur._cls || [];
        for (const c of names) {
          if (sel === `.${c}`) return cur;
          if (sel.startsWith(`.${c}[`)) {
            const m = sel.match(/\[data-([a-z-]+)="([^"]*)"\]/);
            if (m) {
              const key = m[1].replace(/-([a-z])/g, (_, x) => x.toUpperCase());
              if (cur.dataset?.[key] === m[2]) return cur;
            }
          }
        }
        cur = cur.parentElement;
      }
      return null;
    },
  };
  el._cls = cls;
  return el;
}

/** section-inner > (row?) > block 사슬을 만든다. */
function scene({ innerPadX, rowPadX, rowPaddingX, blockDataset = {}, blockStyle = {}, wrapFrame = false, frameRadius, frameClip } = {}) {
  const inner = makeEl({ cls: ['section-inner'], dataset: innerPadX === undefined ? {} : { paddingX: String(innerPadX) } });
  let parent = inner;
  let frame = null;
  if (wrapFrame) {
    /* ★2026-10-10 — ★`frameClip` 칸을 더했다. ★★«안 자르는 프레임»을 ★지을 수 있어야 ★양쪽으로 잰다 */
    const fd = {};
    if (frameRadius !== undefined) fd.radius = String(frameRadius);
    if (frameClip !== undefined) fd.clipContent = String(frameClip);
    frame = makeEl({ cls: ['frame-block'], parent, dataset: fd });
    parent = frame;
  }
  if (rowPadX !== undefined || rowPaddingX !== undefined) {
    const d = {};
    if (rowPadX !== undefined) d.padX = String(rowPadX);
    if (rowPaddingX !== undefined) d.paddingX = String(rowPaddingX);
    parent = makeEl({ cls: ['row'], dataset: d, parent });
  }
  const block = makeEl({ cls: ['banner02-block'], dataset: blockDataset, style: blockStyle, parent });
  return { inner, block, frame };
}

test('U0 공용 부품 셋을 «소스에서» 실제로 떠냈다', () => {
  assert.equal(typeof effectiveSectionPadX, 'function');
  assert.equal(typeof applyBlockFullBleed, 'function');
  assert.equal(typeof clearBlockFullBleed, 'function');
});

/* ── P2 «기본은 끔» — 가장 중요한 계약 ─────────────────────────────────── */
test('P2 음성대조 — dataset.fullBleed 가 없으면 «스타일을 한 번도 안 쓴다»', () => {
  const { block } = scene();
  const r = applyBlockFullBleed(block);
  assert.equal(r, 0, '꺼진 블록에 padX 를 돌려줬다');
  assert.deepEqual(block._writes, [], `기본(끔)인데 스타일을 건드렸다: ${block._writes.join(', ')}`);
  assert.equal(block.dataset.fbMaxW, undefined, '기본(끔)인데 dataset 을 남겼다');
});

test("P2b 음성대조 — dataset.fullBleed='false' 도 «끔»이다", () => {
  const { block } = scene({ blockDataset: { fullBleed: 'false' } });
  assert.equal(applyBlockFullBleed(block), 0);
  assert.deepEqual(block._writes, []);
});

/* ── P1 「실제로 걸린다」 ──────────────────────────────────────────────── */
test('P1 켜면 폭·좌우마진을 «세트로» 덮는다 (width 단독이면 우측이 잘린다)', () => {
  const { block } = scene({ innerPadX: 40, blockDataset: { fullBleed: 'true' } });
  const padX = applyBlockFullBleed(block);
  assert.equal(padX, 40);
  assert.equal(block.style.width, 'calc(100% + 80px)');
  assert.equal(block.style.marginLeft, '-40px');
  assert.equal(block.style.marginRight, '-40px');
  for (const k of ['width', 'marginLeft', 'marginRight']) {
    assert.ok(block._writes.includes(k), `${k} 를 안 썼다 — 세트 규약 위반`);
  }
});

test('P1b padX 출처 우선순위: row(padX→paddingX) → section-inner override → 전역', () => {
  assert.equal(effectiveSectionPadX(scene({ innerPadX: 40, rowPadX: 12 }).block), 12, 'row.padX 가 이겨야 한다');
  assert.equal(effectiveSectionPadX(scene({ innerPadX: 40, rowPaddingX: 8 }).block), 8, 'row.paddingX 도 읽어야 한다');
  assert.equal(effectiveSectionPadX(scene({ innerPadX: 40 }).block), 40, 'section-inner override');
  assert.equal(effectiveSectionPadX(scene({}).block), 32, '전역 pageSettings.padX');
});

test('P1c padX 가 0 이면 «뚫을 게 없다» — 켜져 있어도 아무것도 안 쓴다', () => {
  ctx.state.pageSettings.padX = 0;
  const { block } = scene({ blockDataset: { fullBleed: 'true' } });
  assert.equal(applyBlockFullBleed(block), 0);
  assert.deepEqual(block._writes, []);
  ctx.state.pageSettings.padX = 32;
});

/* ★[2026-09-28] 이 검사의 «제목이 거짓»이 됐던 자리다.
     옛 제목: 「⛔프레임 «안»은 못 뚫는다 — .frame-block{overflow:hidden} 이라 잘리기만 한다」
     그 까닭이던 overflow:hidden 을 현빈 지시로 visible 로 풀었다(css/editor-blocks.css).
     ⇒ 이제 자르는 것은 «모서리를 둥글린 프레임»뿐이고, 판정도 그것으로 옮겼다.
     ⛔제목이 «조건»을 말하면 조건이 바뀔 때 제목째 거짓이 된다 — 그래서 조건을 제목에 적고
       그 조건을 «양쪽으로» 잰다(둥글면 0, 안 둥글면 뚫린다). */
/* ══ ★★P1d — ★★«조건»이 ★세 번 ★바뀐 자리다. ★제목에 ★조건을 ★다시 적고 ★★양쪽으로 ★잰다 ══
   ★★★이 두 칸 중 ★★«하나만» 서면 ★★전과 ★같다 — ⛔한 칸만 고치고 ★닫지 ★마라.
   ★★날짜 셋을 ★나란히 둔다(★다음 사람이 ★네 번째로 ★뒤집기 ★전에 ★읽게):
     ★2026-09-28  현빈 지시로 ★`.frame-block` 의 ★overflow 를 ★visible 로 ★풀었다
       ⇒ ★★`fc1da73c`(09-29)가 ★「★막아둔 ★까닭이 ★죽었는데 ★문만 남아 있었다」며 ★가드를 ★고쳤고
         ★★P1d 를 ★★«조건을 ★제목에 ★다시 적고 ★양쪽으로 재게» ★바꿨다 — ★그때 ★이 둘이 ★생겼다
     ★2026-10-10  현빈 「프레임 밖은 ★안 보여야」 ⇒ ★★기본을 ★다시 ★hidden 으로 ★닫았다
       ⇒ ★★★죽은 ★까닭이 ★되살아나면 ★★문도 ★되살아난다 — ★그 가드가 ★다시 ★일한다
         ⇒ ★★그래서 ★이 둘의 ★조건이 ★또 ★바뀌었다. ★같은 꼴로 ★다시 적는다
   ★★판정은 ★★`clipsContent` ★하나다 — ⛔`radius` 로 ★세지 ★마라(★2026-10-10 부터 ★기준이 ★아니다) ══ */

test('P1d ★★«자르는» 프레임 안은 ★못 뚫는다 — ★기본이 ★자름이다 (2026-10-10 · 옛 조건: data-radius)', () => {
  const { block, frame } = scene({ innerPadX: 40, wrapFrame: true, blockDataset: { fullBleed: 'true' } });
  /* ★★★전제 — ★제목이 ★«자르는»이라 ★말하므로 ★재기 ★전에 ★그것을 ★단언한다
     (⛔안 걸면 ★제목째 ★거짓이 될 수 있다 — ★기본이 ★또 뒤집히는 날) */
  assert.equal(clipsContent(frame), true, '★전제 — 이 프레임은 ★자른다(기본값)');
  assert.equal(effectiveSectionPadX(block), 0, '★자르는 프레임 안에서는 ★뚫어 봐야 ★잘린다 ⇒ 0');
  assert.equal(applyBlockFullBleed(block), 0);
  assert.deepEqual(block._writes, [], '★한 픽셀도 ★안 쓴다');
});

test('P1d-2 ★★«둥근» 프레임도 ★같다 — ⛔이제 ★radius 가 ★기준이 ★아니다 (★기본이 자름이라 ★어차피 0)', () => {
  const { block, frame } = scene({ innerPadX: 40, wrapFrame: true, frameRadius: 12, blockDataset: { fullBleed: 'true' } });
  assert.equal(clipsContent(frame), true, '★전제 — 자른다');
  assert.equal(effectiveSectionPadX(block), 0);
  /* ★★음성대조 — ★radius ★0 이어도 ★★같다(⛔옛 조건은 ★여기서 ★40 을 기대했다) */
  const z = scene({ innerPadX: 40, wrapFrame: true, frameRadius: 0, blockDataset: { fullBleed: 'true' } });
  assert.equal(clipsContent(z.frame), true, '★전제 — radius 0 도 ★자른다(기본값이 자름이다)');
  assert.equal(effectiveSectionPadX(z.block), 0, '★radius 로 ★갈리지 ★않는다');
});

test('P1d-3 ★★«안 자르는» 프레임 안에서는 ★뚫린다 — ★사람이 ★「내용 자르기」를 ★★끈 판 (★이 칸이 ★전엔 없었다)', () => {
  /* ★★★이 칸이 ★★«양쪽»의 ★나머지 ★반쪽이다. ⛔없으면 ★위 둘이 ★전부 ★0 을 재서 ★★항등식이 된다
     — ★「언제나 0」과 ★「조건이 0 을 만든다」가 ★구분 ★안 된다. */
  const { block, frame } = scene({ innerPadX: 40, wrapFrame: true, frameClip: 'false', blockDataset: { fullBleed: 'true' } });
  /* ★★★전제 둘 — ★제목이 ★«안 자르는»이라 ★말하므로 ★둘 다 ★재기 ★전에 ★단언한다
     (★지디 2026-10-10: ★한쪽만 전제를 걸면 ★★비대칭이 되고 ★그 비대칭이 ★이 칸을 ★조용히 ★거짓으로 만든다) */
  assert.equal(frame.dataset.clipContent, 'false', '★전제 — 토글이 ★명시로 ★꺼져 있다');
  assert.equal(clipsContent(frame), false, '★전제 — 그래서 ★안 자른다');
  assert.equal(effectiveSectionPadX(block), 40, '★안 자르니 ★뚫어도 ★안 잘린다 ⇒ 40');
  assert.equal(applyBlockFullBleed(block), 40);
});

/* ══ ★★★P1g — ★★«두 물음이 ★갈렸다»를 ★잠근다 (2026-10-10 · ★지디 조건 ⒜) ═════════
   ★★왜 ★있나 — ★한 함수가 ★★두 물음을 ★답하고 있었다:
     ★㉠ ★«이 자리의 ★패딩이 ★얼마냐»(조회)   ★㉡ ★«el 이 ★그걸 ★뚫을 수 ★있나»(full-bleed)
   ★`js/panels/template-system.js` 의 ★`_tplReapplyPagePad` 는 ★★㉠ 만 ★물었는데 ★★㉡ 까지 ★받아
     ★★서브섹션 길에서 ★★0 을 ★받았다 ⇒ ★★`tpl-pagepad-e81` ★T2·T5 가 ★빨갰다(★실측 2026-10-10).
   ⇒ ★★★그래서 ★★이 칸은 ★★«같은 장면에서 ★두 자가 ★다른 수를 ★준다»를 ★잠근다.
   ★★⛔«같아졌다»로 ★닫지 ★않는다 — ★★★«그 값이 ★됐다»를 ★잰다(★수를 ★박는다). */
test('P1g ★★두 물음이 ★갈렸다 — ★조회(sectionPadX) ↔ ★뚫기(effectiveSectionPadX)', () => {
  /* ★★⑴ ★자르는 프레임 ★«안» — ★★둘이 ★달라야 한다 */
  const inFr = scene({ innerPadX: 40, wrapFrame: true, blockDataset: { fullBleed: 'true' } });
  assert.equal(clipsContent(inFr.frame), true, '★전제 — 그 프레임은 ★자른다(기본값)');
  assert.equal(sectionPadX(inFr.block), 40,
    '★★조회가 ★프레임을 ★본다 — ★★그러면 ★template-system 이 ★또 ★0 을 받는다');
  assert.equal(effectiveSectionPadX(inFr.block), 0,
    '★★뚫기가 ★자르는 프레임 안에서 ★0 이 ★아니다 — ★★②(현빈 1009t3-②)의 뜻이 ★죽었다');
  /* ★★⑵ ★★음성대조 — ★프레임 ★«밖»에서는 ★둘이 ★같아야 한다
       ⛔안 같으면 ★조회가 ★★무언가를 ★더 하거나 ★덜 한다 */
  const out = scene({ innerPadX: 40 });
  assert.equal(sectionPadX(out.block), 40, '★프레임 밖 — ★조회');
  assert.equal(effectiveSectionPadX(out.block), 40, '★프레임 밖 — ★뚫기도 ★같은 수여야 한다');
  /* ★★⑶ ★조회의 ★우선순위 ★두 칸 — ★override ?? ★문서 padX · ★row 가 ★이긴다 */
  assert.equal(sectionPadX(scene({}).block), 32, '★override 없으면 ★문서 padX(32)');
  assert.equal(sectionPadX(scene({ innerPadX: 40, rowPadX: 12 }).block), 12, '★row padX 가 ★이긴다');
  assert.equal(sectionPadX(scene({ innerPadX: 40, rowPaddingX: 8 }).block), 8, '★row paddingX 도 ★읽는다');
});

test('P1e section-inner 밖(플로팅/떠 있는 자리)이면 0', () => {
  const orphan = makeEl({ cls: ['banner02-block'], parent: makeEl({ cls: ['section-block'] }) });
  assert.equal(effectiveSectionPadX(orphan), 0);
});

/* ── F3/F4 maxWidth 왕복 — 프레임에서 실제로 났던 회귀 ──────────────────── */
test('F3 켜면 인라인 max-width 를 «적어 두고» none 으로 민다', () => {
  const { block } = scene({ innerPadX: 40, blockDataset: { fullBleed: 'true' }, blockStyle: { maxWidth: '100%' } });
  applyBlockFullBleed(block);
  assert.equal(block.style.maxWidth, 'none', 'maxWidth 가 남으면 폭이 «안 넓어진다»');
  assert.equal(block.dataset.fbMaxW, '100%', '되돌릴 값을 안 적어 뒀다');
});

test('F4 끄면 적어 둔 max-width 로 «정확히» 되돌린다 (2026-09-10 실측 회귀핀)', () => {
  const { block } = scene({ innerPadX: 40, blockDataset: { fullBleed: 'true' }, blockStyle: { maxWidth: '100%', width: '860px' } });
  applyBlockFullBleed(block);
  delete block.dataset.fullBleed;
  clearBlockFullBleed(block);
  assert.equal(block.style.maxWidth, '100%',
    'max-width:none 이 남았다 — 폭이 안 잘려 섹션 밖으로 삐져나간 채 굳는다');
  assert.equal(block.dataset.fbMaxW, undefined, '되돌린 뒤에도 표식이 남았다');
  assert.equal(block.style.width, '', 'calc 폭을 안 지웠다');
  assert.equal(block.style.marginLeft, '');
  assert.equal(block.style.marginRight, '');
});

test('F5 padX 가 바뀌어 다시 켜져도 «원래» max-width 를 덮어쓰지 않는다', () => {
  const { block } = scene({ innerPadX: 40, blockDataset: { fullBleed: 'true' }, blockStyle: { maxWidth: '100%' } });
  applyBlockFullBleed(block);
  applyBlockFullBleed(block);            // padX 변경 등으로 재적용
  assert.equal(block.dataset.fbMaxW, '100%', '두 번째 적용이 «none» 을 원본으로 적어 버렸다');
});

test('F6 사용자가 직접 준 px 폭은 «보존»한다 (calc 만 지운다)', () => {
  const block = makeEl({ cls: ['banner02-block'], style: { width: '600px' } });
  clearBlockFullBleed(block);
  assert.equal(block.style.width, '600px', 'calc 가 아닌 폭까지 지웠다 — 사용자가 정한 값이다');
});

/* ── ★fullBleed 를 쓰는 자리를 «기계로» 센다 ────────────────────────────
 * 이 규약을 쓰는 곳이 다섯이 됐다(canvas·chat·frame·banner02·grid). 여섯이 되는 순간
 * 「손으로 적은 목록」이 또 생길 자리다 — 그래서 «분모»를 기계가 세게 둔다.
 *
 * ⚠️이건 «동작을 가르는 명부»가 아니다(그건 ⛔). 새 식구가 늘면 «빨개져서 검토를 강제하는» 인구조사다.
 *   빨개지면 지우지 말고, 새 식구가 아래 셋을 갖췄는지 확인하고 숫자를 갱신하라:
 *     ⑴ 렌더가 폭을 다시 박는다면 «렌더 안»에서 적용하는가 (안 그러면 다음 렌더에 조용히 지워진다
 *        — 배너2 가 정확히 그 자리였다)
 *     ⑵ «끄기»가 흔적을 지우고 자연 폭을 되살리는가 (F4: 끄기가 켜기보다 잘 깨진다)
 *     ⑶ 기본이 «꺼짐»인가 (P2: 옛 문서 무변화) */
function harvestFullBleedUsers() {
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'js/blocks')).filter(f => f.endsWith('.js')).map(f => `js/blocks/${f}`),
    ...fs.readdirSync(path.join(ROOT, 'js/props')).filter(f => f.endsWith('.js')).map(f => `js/props/${f}`),
  ];
  const hit = [];
  for (const rel of files) {
    const src = strip(readSrc(ROOT, rel));
    /* ★표식을 «직접» 읽는 쪽과 공용 부품을 «부르는» 쪽을 둘 다 센다 —
       배너2 는 부품만 부르므로(dataset 을 직접 안 읽는다) 앞쪽만 보면 «안 세어진다». */
    if (/dataset\.fullBleed|data-full-bleed|applyBlockFullBleed|clearBlockFullBleed/.test(src)) hit.push(rel);
  }
  return hit.sort();
}

/* ★[0929] 에셋도 «공용 계산»으로 합쳤다 — 그 전으로 되돌아가면 여기서 빨개진다.
   무엇이 있었나: assetFullBleedWidth 가 padX 계산을 «한 벌 더» 갖고 있었다(row 의 패딩 키가
   두 가지인 함정까지 똑같이 적어서). 그래서 실제로 갈렸다 — 0928 에 공용 쪽 프레임 가드를
   「둥근 프레임만 자른다」로 고쳤는데 에셋 쪽은 「프레임이면 무조건 0」으로 남았다.
   ⇒ 계산은 drag-utils.effectiveSectionPadX «한 곳»이고, 에셋은 자기 전용 가드(preset 고정폭)만 갖는다. */
test('C2 ★에셋도 공용 계산을 쓴다 — assetFullBleedWidth 가 padX 를 «다시» 읽지 않는다', () => {
  const page = strip(readSrc(ROOT, 'js/props/prop-page.js'));
  const i = page.indexOf('function assetFullBleedWidth(');
  assert.ok(i >= 0, 'assetFullBleedWidth 가 없다');
  const fn = page.slice(i, page.indexOf('\nwindow.assetFullBleedWidth', i));
  assert.match(fn, /effectiveSectionPadX/, '공용 계산(effectiveSectionPadX)을 불러야 한다');
  assert.ok(!/dataset\.paddingX|pageSettings\.padX|dataset\.padX/.test(fn),
    '패딩을 «직접» 다시 읽고 있다 — 계산이 또 두 벌이 된다(0929 통합 이전으로 되돌아간 것)');
});

test('C1 ★fullBleed 식구를 «기계로» 센다 — 다섯째가 오면 빨개진다', () => {
  const users = harvestFullBleedUsers();
  const expected = [
    'js/blocks/banner02-block.js',   // 배너2 — 렌더 안에서 적용 (2026-09-10 신규)
    'js/blocks/canvas-block.js',     // 카드  — renderCanvas 가 통합 처리
    'js/blocks/chat-block.js',       // 채팅  — renderChatBlock 안에서 적용
    'js/blocks/grid-block.js',       // 그리드 — renderGridBlock 안에서 적용 (2026-10-01 — 렌더가 width=100% 를 다시 박아 배너2 와 같은 병이 났다, grd_ts0he_lvy913j)
    'js/props/prop-banner02.js',     // 배너2 패널 (2026-09-10 신규)
    'js/props/prop-chat.js',         // 채팅 패널
    'js/props/prop-frame.js',        // 프레임 — 패널이 «직접» 적용(렌더 함수가 없다) (2026-09-10 신규)
    'js/props/prop-grid.js',         // 그리드 — 티켓 ⑥ (2026-09-28 신규 · 0929 에 자체 구현에서 이 한 벌로 합쳤다)
    'js/props/prop-page.js',         // padX 일괄 적용 — 표식 쓸이
    'js/props/prop-simple-card.js',  // 카드 패널
  ];
  assert.deepEqual(users, expected,
    '패딩제외 식구가 바뀌었다. ⛔지우지 말고 새 식구가 ⑴렌더 안 적용 ⑵끄기 되돌림 ⑶기본 꺼짐 을 ' +
    '갖췄는지 확인하고 이 목록을 갱신하라 (파일 머리 주석 참고)');
});

test('C2 ★렌더가 폭을 다시 박는 블록은 «렌더 안»에서 적용해야 한다 (배너2 회귀핀)', () => {
  /* ★배너2 의 병이 정확히 이것이었다: renderBanner02 가 매 렌더 width/maxWidth/margin 을 다시 박아서
     패널에서만 적용하면 «다음 렌더에 조용히 지워진다». chat-block 이 같은 자리에 같은 것을 둔 이유다. */
  const bn2 = strip(readSrc(ROOT, 'js/blocks/banner02-block.js'));
  const i = bn2.indexOf('function renderBanner02(');
  assert.ok(i >= 0, 'renderBanner02 를 못 찾았다 — 이름이 바뀌었으면 이 검사도 옮겨라');
  let j = bn2.indexOf('{', i), depth = 0, end = bn2.length;
  for (let k = j; k < bn2.length; k++) {
    if (bn2[k] === '{') depth++;
    else if (bn2[k] === '}') { depth--; if (!depth) { end = k + 1; break; } }
  }
  const body = bn2.slice(i, end);
  const wIdx = body.indexOf("block.style.maxWidth = designW + 'px'");
  const aIdx = body.indexOf('applyBlockFullBleed');
  assert.ok(wIdx >= 0, '전제: 렌더가 maxWidth 를 다시 박는다(자가 도는지 확인)');
  assert.ok(aIdx >= 0, 'renderBanner02 가 패딩제외를 «안» 덮는다 — 켜도 다음 렌더에 지워진다');
  assert.ok(aIdx > wIdx, '적용이 폭 지정 «앞»에 있다 — 「제 폭 먼저, 패딩제외 마지막」 규약 위반');
});

/* ── 규약: 명부 금지 ──────────────────────────────────────────────────── */
test('S1 ⛔명부 금지 — padX 일괄 적용이 «블록 이름»이 아니라 표식으로 쓸어야 한다', () => {
  const page = strip(readSrc(ROOT, 'js/props/prop-page.js'));
  assert.ok(page.includes(`'[data-full-bleed="true"]:not(.canvas-block)'`),
    'applyPadXToSection 이 data-full-bleed 표식 쓸이를 안 한다 — 새 블록이 padX 변경을 못 따라온다');
});
