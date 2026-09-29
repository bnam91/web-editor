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

const EFF_SRC   = sliceFn(DRAG, 'function effectiveSectionPadX(', 'drag-utils');
const APPLY_SRC = sliceFn(DRAG, 'function applyBlockFullBleed(', 'drag-utils');
const CLEAR_SRC = sliceFn(DRAG, 'function clearBlockFullBleed(', 'drag-utils');

/* state.pageSettings.padX 는 모듈 import 라 vm 에 «주입»한다 — 검사가 전역 기본값을 흔들 수 있어야 한다. */
const ctx = vm.createContext({ state: { pageSettings: { padX: 32 } } });
vm.runInContext(`${EFF_SRC}\n${APPLY_SRC}\n${CLEAR_SRC}`, ctx);
const { effectiveSectionPadX, applyBlockFullBleed, clearBlockFullBleed } = ctx;

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
function scene({ innerPadX, rowPadX, rowPaddingX, blockDataset = {}, blockStyle = {}, wrapFrame = false } = {}) {
  const inner = makeEl({ cls: ['section-inner'], dataset: innerPadX === undefined ? {} : { paddingX: String(innerPadX) } });
  let parent = inner;
  if (wrapFrame) parent = makeEl({ cls: ['frame-block'], parent });
  if (rowPadX !== undefined || rowPaddingX !== undefined) {
    const d = {};
    if (rowPadX !== undefined) d.padX = String(rowPadX);
    if (rowPaddingX !== undefined) d.paddingX = String(rowPaddingX);
    parent = makeEl({ cls: ['row'], dataset: d, parent });
  }
  const block = makeEl({ cls: ['banner02-block'], dataset: blockDataset, style: blockStyle, parent });
  return { inner, block };
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

test('P1d ⛔프레임 «안»은 못 뚫는다 — .frame-block{overflow:hidden} 이라 잘리기만 한다', () => {
  const { block } = scene({ innerPadX: 40, wrapFrame: true, blockDataset: { fullBleed: 'true' } });
  assert.equal(effectiveSectionPadX(block), 0);
  assert.equal(applyBlockFullBleed(block), 0);
  assert.deepEqual(block._writes, []);
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
 * 이 규약을 쓰는 곳이 넷이 됐다(canvas·chat·frame·banner02). 다섯이 되는 순간
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

test('C1 ★fullBleed 식구를 «기계로» 센다 — 다섯째가 오면 빨개진다', () => {
  const users = harvestFullBleedUsers();
  const expected = [
    'js/blocks/banner02-block.js',   // 배너2 — 렌더 안에서 적용 (2026-09-10 신규)
    'js/blocks/canvas-block.js',     // 카드  — renderCanvas 가 통합 처리
    'js/blocks/chat-block.js',       // 채팅  — renderChatBlock 안에서 적용
    'js/props/prop-banner02.js',     // 배너2 패널 (2026-09-10 신규)
    'js/props/prop-chat.js',         // 채팅 패널
    'js/props/prop-frame.js',        // 프레임 — 패널이 «직접» 적용(렌더 함수가 없다) (2026-09-10 신규)
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
