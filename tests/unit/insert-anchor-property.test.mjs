/* insert-anchor-property — 「새 블록 아래에 갭(g)이 붙는가」의 «판정»을 잠근다. (2026-09-10 신설)
 *   실행: node --test "tests/unit/*.test.mjs"  ·  소스에서 «진짜 판정 함수»를 떼어 실행한다.
 *
 * ★왜 이 파일이 있나
 *   현빈: 「모달블럭 추가하고 g 를 누르면 바로 아래에 갭블럭이 추가돼야 되는데 안된다.」
 *   원인은 `js/drag-utils.js` 의 insertAfterSelected 가 「기준점이 될 블록」을
 *   `.text-block.selected, .asset-block.selected, …` 처럼 «손으로 적은 명부»로 골랐던 것.
 *   명부가 두 벌(프레임 안 / 섹션 레벨)이라 새 블록이 생길 때마다 두 곳을 같이 고쳐야 했고,
 *   실제로 셋이 빠져 있었다.
 *
 * ★실측 (앱 9396, HEAD db750f4, 2026-09-10)
 *   블록 25종을 «뒤에 표지 블록을 하나 더 둔» 픽스처로 전수 측정:
 *     modal · mockup · joker → 갭이 «바로 아래»가 아니라 «섹션 맨 끝»에 붙었다 (3/25 빨강)
 *
 * ⛔⛔★★다음 사람에게 — 「g 가 붙는 자리」를 잴 때 «블록이 하나뿐인» 픽스처로 재지 마라.
 *   섹션에 블록이 하나면 「그 블록 바로 아래」와 「섹션 맨 끝」이 **같은 자리**다.
 *   그러면 고장난 블록도 «통과»로 나온다 — 실제로 첫 판이 25/25 초록이었고, 셋이 고장나 있었다.
 *   ⇒ ★**대상 블록 «뒤»에 표지 블록을 하나 더 두어라.** 그래야 두 답이 갈린다.
 *   ★이건 「검사가 죽은」 게 아니라 «픽스처가 두 답을 겹쳐 놓은» 것이다 — 초록이 무의미해진다.
 *     같은 함정은 「맨 끝에 넣는 동작」을 재는 모든 자리에 있다(붙여넣기·복제·드롭).
 *
 * ★이 파일이 지키는 것
 *   ⑴ 판정이 «성질»이다 — 명부로 되돌리면 즉시 빨강 (S-명부금지)
 *   ⑵ ★분모를 «기계가» 센다 — 캔버스 블록 클래스를 소스에서 긁어 판정에 먹인다.
 *      새 블록이 생기면 분모가 저절로 늘어난다. 손으로 적지 않는다.
 *   ⑶ 음성대조 둘 — 옛 명부에 있던 것들이 «여전히» 잡히고, 플로팅/컨테이너는 «여전히» 안 잡힌다.
 *
 * ⚠️「갭이 실제로 그 자리에 꽂히는가」의 런타임 실측은 CDP(앱 9396)로 한다.
 *   여기(jsdom 미설치)는 «판정»을 잠그는 그물이다. 둘 다 있어야 완성이다.
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

const DRAG_RAW = readSrc(ROOT, 'js/drag-utils.js');
const DRAG = strip(DRAG_RAW);

/** 이름으로 최상위 선언 한 덩이를 잘라낸다 — ⛔고정 창 slice 금지, 중괄호 균형으로. */
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

const EXCLUDE_SRC  = DRAG.match(/const _ANCHOR_EXCLUDE_CLASSES = \[[^\]]*\];/)?.[0] ?? '';
const IS_FLOW_SRC  = sliceFn(DRAG, 'function isFlowAnchorBlock(', 'drag-utils');
const FIND_SRC     = sliceFn(DRAG, 'function findFlowAnchorSelected(', 'drag-utils');
const INSERT_SRC   = sliceFn(DRAG, 'function insertAfterSelected(', 'drag-utils');

/* 소스 그대로를 vm 에서 살린다 — «떠낸 것이 진짜 그 함수»여야 이 검사가 의미가 있다. */
const ctx = vm.createContext({});
vm.runInContext(`${EXCLUDE_SRC}\n${IS_FLOW_SRC}\n${FIND_SRC}`, ctx);
const isFlowAnchorBlock    = ctx.isFlowAnchorBlock;
const findFlowAnchorSelected = ctx.findFlowAnchorSelected;

/** 최소 가짜 요소 — classList 는 «순회 + contains» 둘 다 필요하다. */
function fakeEl(classes, style = {}) {
  const list = [...classes];
  list.contains = (c) => list.includes(c);
  return { nodeType: 1, classList: list, style };
}

/* ── ★분모를 «기계가» ─────────────────────────────────────────────────────
 * 캔버스 블록을 «만드는» 파일들에서 블록 클래스명을 긁는다.
 *   범위 = js/blocks/*.js + js/block-factory.js
 *   ⛔preview.js(.preview-page-block)·section-search.js(.ss-item-block) 처럼 캔버스 밖
 *     UI 는 이 범위에 애초에 없다 — 「제외 목록」을 손으로 적지 않기 위한 범위 선택이다.
 * ⇒ 새 블록 파일이 생기면 분모가 «저절로» 늘어난다. */
function harvestBlockClasses() {
  const files = [
    ...fs.readdirSync(path.join(ROOT, 'js/blocks')).filter(f => f.endsWith('.js')).map(f => `js/blocks/${f}`),
    'js/block-factory.js',
  ];
  const found = new Set();
  const re = /(?:className\s*=\s*'([^']*)'|classList\.add\('([a-z0-9-]+)'\))/g;
  for (const rel of files) {
    const src = readSrc(ROOT, rel);
    let m;
    while ((m = re.exec(src))) {
      for (const tok of (m[1] ?? m[2] ?? '').split(/\s+/)) {
        if (/^[a-z0-9]+(?:-[a-z0-9]+)*-block$/.test(tok)) found.add(tok);
      }
    }
  }
  return [...found].sort();
}

const ALL_BLOCK_CLASSES = harvestBlockClasses();

/* 위쪽 분기에서 «따로» 처리되는 컨테이너 셋 — 기준점 후보가 아니다. */
const CONTAINERS = ['section-block', 'frame-block', 'shape-block'];

/* 플로팅 계열 — 인라인 position:absolute 로 섹션 직속에 뜬다. */
const FLOATING = ['sticker-block', 'gradient-block', 'zoom-block', 'annotation-block'];

/* ★옛 명부 (HEAD db750f4 의 insertAfterSelected 가 쓰던 것) — «음성대조 전용 화석»이다.
 *   ⛔여기에 새 블록을 더하지 마라. 이건 「예전에 되던 것이 여전히 되는가」를 재는 고정 표본이다. */
const OLD_ROSTER = [
  'text-block', 'asset-block', 'gap-block', 'icon-circle-block', 'table-block',
  'label-group-block', 'card-block', 'graph-block', 'divider-block', 'bridge-block',
  'grid-block', 'infocard-block', 'innercard-block', 'icon-text-block', 'icon-block',
  'step-block', 'vector-block', 'canvas-block', 'banner02-block', 'comparison-block',
  'laurel-block', 'chat-block',
];

test('U0 판정 두 함수를 «소스에서» 실제로 떠냈다', () => {
  assert.equal(typeof isFlowAnchorBlock, 'function');
  assert.equal(typeof findFlowAnchorSelected, 'function');
  assert.ok(EXCLUDE_SRC.includes('section-block'), '_ANCHOR_EXCLUDE_CLASSES 를 못 떠냈다');
});

test('G3 분모를 «기계가» — 소스에서 긁은 캔버스 블록이 전부 기준점이 된다', () => {
  // 수확이 통째로 실패하면(정규식 깨짐) 0개라도 아래 루프가 조용히 통과한다 → 하한을 못박는다.
  assert.ok(ALL_BLOCK_CLASSES.length >= 25,
    `블록 클래스 수확이 너무 적다(${ALL_BLOCK_CLASSES.length}) — 수확 정규식이 깨졌다`);
  for (const c of ALL_BLOCK_CLASSES) {
    if (CONTAINERS.includes(c)) continue;
    const floating = FLOATING.includes(c);
    const el = fakeEl([c], floating ? { position: 'absolute' } : {});
    assert.equal(isFlowAnchorBlock(el), !floating,
      `${c} 의 판정이 틀렸다 (플로팅=${floating})`);
  }
});

test('G1 모달·목업·조커가 기준점으로 «잡힌다» (2026-09-10 실측 3종 회귀핀)', () => {
  for (const c of ['modal-block', 'mockup-block', 'joker-block']) {
    assert.equal(isFlowAnchorBlock(fakeEl([c])), true,
      `${c} 가 기준점에서 빠졌다 — g 가 갭을 섹션 맨 끝에 붙인다`);
  }
});

test('G2 음성대조 — 옛 명부에 있던 것들이 «여전히» 잡힌다', () => {
  for (const c of OLD_ROSTER) {
    assert.equal(isFlowAnchorBlock(fakeEl([c])), true, `${c} 를 새 판정이 놓쳤다 (과하게 걸러냄)`);
  }
});

test('G2b 음성대조 — 플로팅 계열은 «여전히» 기준점이 아니다', () => {
  for (const c of FLOATING) {
    assert.equal(isFlowAnchorBlock(fakeEl([c], { position: 'absolute' })), false,
      `${c} 가 기준점으로 잡혔다 — 새 블록이 section-inner 흐름에서 빠진다`);
  }
  assert.equal(isFlowAnchorBlock(fakeEl(['text-block'], { position: 'fixed' })), false);
});

test('G2c 음성대조 — 컨테이너 셋(section/frame/shape)은 기준점이 아니다', () => {
  for (const c of CONTAINERS) {
    assert.equal(isFlowAnchorBlock(fakeEl([c])), false, `${c} 는 위 분기에서 따로 처리된다`);
  }
  // text-frame 래퍼처럼 frame-block 이 함께 붙은 경우도 제외돼야 한다.
  assert.equal(isFlowAnchorBlock(fakeEl(['frame-block', 'text-block'])), false);
});

test('G3b ⛔명부 금지 — 판정부에 하드코딩된 «.xxx-block.selected» 가 없다', () => {
  const body = `${IS_FLOW_SRC}\n${FIND_SRC}\n${INSERT_SRC}`;
  // 컨테이너 셋(section/frame/shape)은 «자기 분기»를 갖는다 — 그건 명부가 아니라 특례다.
  const allowed = new Set(CONTAINERS.map(c => `.${c}.selected`));
  const hits = (body.match(/\.[a-z0-9-]+-block\.selected/g) || []).filter(h => !allowed.has(h));
  assert.deepEqual(hits, [],
    `기준점 판정이 명부로 되돌아갔다: ${hits.join(', ')} — 명부는 새 블록이 생길 때마다 빠진다`);
});

test('G3c ★«두 자리»가 같은 술어를 본다 — 한 곳만 고치면 「프레임 안에서만 안 되는」 병이 남는다', () => {
  /* ★옛 명부는 «두 벌»이었다: 프레임 안 분기(ssInner)와 섹션 레벨 분기(document).
     한 곳만 성질로 바꾸면 「섹션에선 되는데 프레임 안에서만 안 된다」가 되고, 그건 훨씬 찾기 어렵다.
     ⇒ 두 자리가 «같은 함수»를 부르는지 센다. 한쪽이 다시 제 목록을 갖게 되면 여기서 빨개진다. */
  const calls = INSERT_SRC.match(/findFlowAnchorSelected\([^)]*\)/g) || [];
  assert.equal(calls.length, 2,
    `기준점 탐색 호출이 «두 곳»이 아니다(${calls.length}곳: ${calls.join(' / ')}) — ` +
    '한 분기가 제 판정을 따로 갖게 되면 프레임 안/밖이 갈린다');
  // 그리고 그 «같은 함수»가 실제로 같은 술어(isFlowAnchorBlock)를 쓴다.
  assert.ok(FIND_SRC.includes('isFlowAnchorBlock('),
    '탐색기가 성질 술어를 안 쓴다 — 두 자리가 같아도 판정이 다르면 소용없다');
  // 양성대조: 두 분기가 실재하는지(ssInner 분기 / 섹션 레벨 분기)
  assert.ok(/const activeSS = window\._activeFrame/.test(INSERT_SRC), '전제: 프레임 안 분기가 실재한다');
});

test('S1 첫 후보를 고르는 순서·범위가 그대로다 (문서순 · .section-inner 안)', () => {
  // 섹션 레벨 분기는 문서 전체에서 «첫» 후보를 집고 나서 섹션을 대조한다(옛 판과 같은 순서).
  assert.ok(/findFlowAnchorSelected\(document,\s*true\)/.test(INSERT_SRC),
    '섹션 레벨 분기가 scoped(.section-inner) 탐색을 안 쓴다 — 섹션 직속 플로팅이 기준점이 된다');
  assert.ok(/findFlowAnchorSelected\(ssInner,\s*false\)/.test(INSERT_SRC),
    '프레임 안 분기가 프레임 범위 탐색을 안 쓴다');
  assert.ok(FIND_SRC.includes("'.section-inner .selected'"),
    'scoped 탐색이 .section-inner 로 좁히지 않는다');
});

test('S2 findFlowAnchorSelected 는 «첫» 후보를 문서순으로 돌려준다', () => {
  const a = fakeEl(['sticker-block'], { position: 'absolute' });
  const b = fakeEl(['modal-block']);
  const c = fakeEl(['text-block']);
  const root = { querySelectorAll: () => [a, b, c] };
  assert.equal(findFlowAnchorSelected(root, false), b, '플로팅을 건너뛰고 첫 «흐름» 후보를 집어야 한다');
  assert.equal(findFlowAnchorSelected(null, false), null);
});
