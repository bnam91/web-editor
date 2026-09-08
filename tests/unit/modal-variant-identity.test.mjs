/* 단위 하네스 — 「모달 변형의 «정체»가 표 한 곳에서 오고, 호출부가 그 표를 우회하지 않는가」.
 *   실행: node --test "tests/unit/*.test.mjs"  ·  DOM 없이 «소스에서 진짜 함수를» 떼어 실행한다.
 *
 * ★왜 이 파일이 생겼나 (적대검수 2026-09-08)
 *   `dashed` 변형이 «통째로 아무 일도 안 했다». 프로퍼티 패널에서 고르면
 *   `dataset.variant === 'dashed'` 는 되는데 `getComputedStyle(el).borderTopStyle` 은 `none`.
 *   변형 여섯 중 하나가 기능이 살아 있는 내내 «조용히 없었고» 아무도 못 봤다.
 *   원인은 둘 — 변형별 기본값 삼항이 makeModalBlock «생성 시점»에만 있었고,
 *   패널의 변형 핸들러는 `block.dataset.variant = sel.value;` «한 줄»이라 정체가 안 따라갔다.
 *
 * ★★그리고 고친 뒤에도 «검사가 없어서» 머지가 보류됐다. 검수자가 변이 둘을 넣었는데 둘 다 통과했다:
 *     변이① prop-modal.js: applyModalVariant(block, sel.value) → block.dataset.variant = sel.value
 *     변이② modal-block.js: MODAL_VARIANT_IDENTITY 에서 dashed 항목 제거
 *   ⇒ 「고쳤다」와 「지켜진다」는 다른 말이다. 이 파일이 그 둘을 빨갛게 만든다.
 *
 * ★선례 — tests/unit/grid-callsite-ssot.test.mjs 가 «정확히 같은 병»에서 태어났다.
 *   그쪽 머리 주석: 「본문이 «모듈 내부»만 봤다. 실제 결함은 호출부에 있었고, 결함을 그대로
 *   되살려도 434/434 초록이었다 — 값을 부르는 쪽을 안 보면 SSOT 는 지켜지지 않는다.」
 *
 * ⚠️T-a 는 «동작»이 아니라 «소스 문자열»을 단언한다. 정상적인 리팩터링에도 빨강이 날 수 있다 —
 *   그때는 이 파일을 지우지 말고, 「변형의 정체가 여전히 표 한 곳에서 오고 패널이 그걸 부르는가」를
 *   확인한 뒤 패턴을 고쳐라. 지우면 결함이 조용히 돌아온다.
 *
 * ⚠️⚠️짝 파일 tests/dom/modal-variant.dom.spec.js 는 «진짜 getComputedStyle» 로 같은 것을 재지만,
 *   그건 playwright 라 이 스위트(node --test "tests/unit/*")에 «안 들어간다».
 *   ⇒ 변이를 잡는 책임은 «이 파일»이 진다. 저쪽만 보고 「보호된다」고 믿지 마라.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { readSrc } from './_srcread.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const MODAL_SRC = readSrc(ROOT, 'js/blocks/modal-block.js');
const PROP_SRC = readSrc(ROOT, 'js/props/prop-modal.js');

/* 주석을 걷어낸다 — 주석에 적힌 옛 코드(설명문)를 결함으로 세면 오탐이다.
 * 이 레포의 design-gate 가 예전에 정확히 그 오탐을 냈고, grid-callsite-ssot 도 같은 이유로 이걸 쓴다.
 * ⚠️이 파일이 다루는 두 소스에는 주석 안에 `dataset.variant` · `#f6f7f9` 가 «실제로» 적혀 있다. */
function stripComments(src) {
  return src.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/* ── 하네스 ────────────────────────────────────────────────────────────────
 * ⛔표도 함수도 «베끼지» 않는다 — js/blocks/modal-block.js 를 그대로 vm 에 올려 실행한다.
 *   베끼면 검사가 코드와 조용히 갈라져서, 검사는 초록인데 제품은 깨진 상태가 된다.
 *   ESM 문법 두 가지만 벗긴다(import 줄 · 끝의 export 문) — 나머지 본문은 «한 글자도» 안 건드린다.
 *   DOM 에 닿는 것은 최소로 스텁한다: document.createElement · genId.
 *   (선례: selection-outline-zoom.test.mjs 가 같은 방식으로 _geomOf 를 진짜로 돌린다.) */
function loadModalModule() {
  const body = MODAL_SRC
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export\s*\{[\s\S]*?\};/, '');
  assert.ok(!/^\s*import\s/m.test(body), 'import 줄을 다 못 벗겼다 — 하네스를 고쳐라');
  assert.ok(!/^\s*export\s/m.test(body), 'export 문을 다 못 벗겼다 — 하네스를 고쳐라');

  let seq = 0;
  const mkEl = () => ({
    className: '', id: '', innerHTML: '',
    dataset: Object.create(null),
    style: {},
    appendChild() {},
    scrollIntoView() {},
  });
  const ctx = {
    document: { createElement: mkEl },
    window: {},
    genId: (p) => `${p}_${++seq}`,
    insertAfterSelected() {}, showNoSelectionHint() {}, bindBlock() {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(
    body + '\n;globalThis.__M = { MODAL_VARIANT_IDENTITY, MODAL_IDENTITY_KEYS, MODAL_DEFAULTS,'
         + ' MODAL_VARIANTS, _effDefault, applyModalVariant, makeModalBlock, renderModalBlock };',
    ctx, { filename: 'js/blocks/modal-block.js' });
  return ctx.__M;
}

const M = loadModalModule();
const { MODAL_VARIANT_IDENTITY: TABLE, MODAL_DEFAULTS, MODAL_VARIANTS } = M;

/** 표에 적힌 값이 «렌더된 인라인 스타일»에 실제로 찍혔는지 — dataset 만 보면 결함을 놓친다. */
function assertIdentityRendered(block, ident, where) {
  const css = block.style.cssText || '';
  if ('borderW' in ident && 'borderStyle' in ident && Number(ident.borderW) > 0) {
    assert.ok(css.includes(`border:${ident.borderW}px ${ident.borderStyle} `),
      `${where}: 렌더된 cssText 에 «border:${ident.borderW}px ${ident.borderStyle}» 가 없다.\n  실제: ${css}`);
  }
  if ('bg' in ident) {
    assert.ok(css.includes(`background:${ident.bg};`),
      `${where}: 렌더된 cssText 에 «background:${ident.bg}» 가 없다.\n  실제: ${css}`);
  }
}

/* ══ T-b · 표를 «루프»로 돈다 ═══════════════════════════════════════════════
 * ⛔`dashed` 를 손으로 적지 않는다 — 다음 변형이 정체를 가지면 «자동으로» 걸려야 한다.
 *   ★단, 표가 비면 루프가 0바퀴라 통과해버린다 ⇒ 「비어 있지 않다」를 «따로» 단언한다(바로 아래). */

test('T-b0 ★표가 «살아 있다» — 비어 있지 않고, dashed 가 그 안에 있다 (루프 0바퀴 위장 방지)', () => {
  const names = Object.keys(TABLE);
  assert.ok(names.length > 0,
    'MODAL_VARIANT_IDENTITY 가 비었다 — 아래 루프가 «0바퀴»로 돌아 전부 초록이 된다. ' +
    '변형의 정체를 표에서 지웠다면 그 변형은 다시 «조용히 없는» 상태다.');
  assert.ok(Object.hasOwn(TABLE, 'dashed'),
    '★dashed 가 MODAL_VARIANT_IDENTITY 에서 사라졌다. 이게 실제로 났던 결함이고, ' +
    '검수자가 이 항목을 지우는 변이로 검사 공백을 실증했다. 지우려면 이 검사도 같이 논의해라.');
  // 표에 적힌 변형은 실재하는 변형이어야 한다(오타로 영영 안 걸리는 항목 방지)
  for (const v of names) {
    assert.ok(MODAL_VARIANTS.includes(v),
      `표에 «${v}» 가 있는데 MODAL_VARIANTS 에 없다 — 오타면 그 항목은 영영 안 걸린다`);
    assert.ok(Object.keys(TABLE[v]).length > 0, `표의 «${v}» 항목이 비었다`);
  }
});

test('T-b1 ★표의 «모든» 변형 × «모든» 키 — 그 변형으로 만든 블록이 그 값을 실제로 갖는다', () => {
  for (const [v, ident] of Object.entries(TABLE)) {
    const { block } = M.makeModalBlock({ variant: v });
    for (const [key, val] of Object.entries(ident)) {
      assert.equal(block.dataset[key], String(val),
        `makeModalBlock({variant:'${v}'}) 의 dataset.${key} 가 «${block.dataset[key]}» 다 — 표의 «${val}» 여야 한다. ` +
        `변형별 기본값이 표를 안 거치고 있다(옛 결함: 삼항이 makeModalBlock 안에만 있었다).`);
    }
    assertIdentityRendered(block, ident, `makeModalBlock({variant:'${v}'})`);
  }
});

test('T-b2 ★★변형을 «전환»해도 정체가 따라간다 — 이게 실제로 났던 결함이다', () => {
  const base = MODAL_DEFAULTS.variant;
  for (const [v, ident] of Object.entries(TABLE)) {
    if (v === base) continue;
    const { block } = M.makeModalBlock({});           // 기본 변형으로 만든 뒤
    assert.equal(block.dataset.variant, base);
    M.applyModalVariant(block, v);                    // 표의 변형으로 «전환»
    M.renderModalBlock(block);
    assert.equal(block.dataset.variant, v);
    for (const [key, val] of Object.entries(ident)) {
      assert.equal(block.dataset[key], String(val),
        `${base}→${v} 전환 후 dataset.${key} 가 «${block.dataset[key]}» 다 — «${val}» 여야 한다. ` +
        `dataset.variant 만 바꾸고 정체를 안 채우면 화면은 «아무 일도 안 한다».`);
    }
    assertIdentityRendered(block, ident, `${base}→${v} 전환`);
  }
});

test('T-b3 ★되돌리기 — 표의 변형에서 기본 변형으로 가면 정체가 «벗겨진다»', () => {
  const base = MODAL_DEFAULTS.variant;
  for (const v of Object.keys(TABLE)) {
    if (v === base) continue;
    const { block } = M.makeModalBlock({ variant: v });
    M.applyModalVariant(block, base);
    M.renderModalBlock(block);
    assert.equal(block.dataset.variant, base);
    for (const key of M.MODAL_IDENTITY_KEYS) {
      assert.equal(block.dataset[key], String(MODAL_DEFAULTS[key]),
        `${v}→${base} 되돌리기 후 dataset.${key} 가 «${block.dataset[key]}» 로 남았다 — ` +
        `«${MODAL_DEFAULTS[key]}» 여야 한다. ⛔MODAL_DEFAULTS 와만 비교하면 이전 변형의 기본값이 ` +
        `«사용자 값»으로 오판돼 여기서 실패한다(기각된 대안).`);
    }
  }
});

test('T-b4 ★사용자가 «손댄» 값은 전환이 덮지 않는다 (양방향)', () => {
  const base = MODAL_DEFAULTS.variant;
  for (const [v, ident] of Object.entries(TABLE)) {
    if (v === base) continue;
    for (const key of Object.keys(ident)) {
      // 기본값과도, 그 변형의 정체값과도 «다른» 값을 고른다 → 무조건 「손댐」이어야 한다
      const mine = (typeof MODAL_DEFAULTS[key] === 'number') ? '9' : '__user__';
      const { block } = M.makeModalBlock({});
      block.dataset[key] = mine;
      M.applyModalVariant(block, v);
      assert.equal(block.dataset[key], mine,
        `${base}→${v}: 사용자가 고른 ${key}=«${mine}» 를 덮어썼다`);
      M.applyModalVariant(block, base);
      assert.equal(block.dataset[key], mine,
        `${v}→${base}: 사용자가 고른 ${key}=«${mine}» 를 덮어썼다 (되돌릴 때도 지켜야 한다)`);
    }
  }
});

test('T-b5 ★검사할 키 목록은 표 «전체»의 합집합이다 (prev 쪽에만 있는 키도 되돌릴 수 있어야 한다)', () => {
  const union = new Set(Object.values(TABLE).flatMap((o) => Object.keys(o)));
  assert.deepEqual([...M.MODAL_IDENTITY_KEYS].sort(), [...union].sort(),
    'MODAL_IDENTITY_KEYS 가 표의 합집합이 아니다 — next 쪽 키만 보면 되돌리기가 한쪽으로 샌다');
  for (const key of M.MODAL_IDENTITY_KEYS) {
    assert.ok(Object.hasOwn(MODAL_DEFAULTS, key),
      `표의 키 «${key}» 가 MODAL_DEFAULTS 에 없다 — 되돌릴 «공통 기본값»이 없어 undefined 가 박힌다`);
  }
});

test('T-b6 ★유효 기본값은 「표 → 공통 기본값」 순서로만 온다', () => {
  for (const key of M.MODAL_IDENTITY_KEYS) {
    // 표에 없는 변형은 공통 기본값
    const plain = MODAL_VARIANTS.find((v) => !Object.hasOwn(TABLE, v));
    assert.equal(M._effDefault(plain, key), MODAL_DEFAULTS[key]);
    // 표에 있는 변형은 표의 값
    for (const [v, ident] of Object.entries(TABLE)) {
      assert.equal(M._effDefault(v, key), Object.hasOwn(ident, key) ? ident[key] : MODAL_DEFAULTS[key]);
    }
  }
});

/* ══ T-a · 호출부 SSOT ═════════════════════════════════════════════════════
 * 변이① (applyModalVariant 호출을 dataset.variant 대입으로 되돌리기)를 잡는 자리.
 * ⚠️여기부터는 «소스 문자열» 단언이다 — 위 ⚠️ 경고를 읽어라. */

test('T-a1 ★패널의 변형 핸들러가 applyModalVariant 를 «부른다»', () => {
  const src = stripComments(PROP_SRC);
  assert.match(src, /import\s*\{[^}]*\bapplyModalVariant\b[^}]*\}\s*from\s*['"]\.\.\/blocks\/modal-block\.js['"]/,
    'prop-modal.js 가 applyModalVariant 를 import 하지 않는다 — 변형의 정체가 표를 안 거친다');
  assert.match(src, /applyModalVariant\s*\(/,
    'prop-modal.js 가 applyModalVariant 를 «부르지» 않는다. ' +
    '★이게 변이①이 통과하던 자리다: dataset.variant 만 갈아끼우면 렌더된 borderTopStyle 이 none 으로 남는다.');
});

test('T-a2 ★★패널이 dataset.variant 를 «직접» 쓰지 않는다 (변이① 재발 방지)', () => {
  const src = stripComments(PROP_SRC);
  const hits = [...src.matchAll(/dataset\s*\.\s*variant\s*=(?!=)/g)];
  assert.equal(hits.length, 0,
    'prop-modal.js 가 dataset.variant 에 «직접» 대입한다. 정체(테두리·배경)를 채우지 않고 이름표만 ' +
    '바꾸는 것이라, 변형 하나가 «조용히 없는» 옛 결함이 그대로 돌아온다. ' +
    'applyModalVariant(block, v) 를 써라 — 채우기와 이름표 갱신의 «순서»까지 그 안에 있다.');
});

test('T-a3 ★채우기가 «먼저», dataset.variant 갱신이 «나중» — 순서가 계약이다', () => {
  const src = stripComments(MODAL_SRC);
  const fn = src.slice(src.indexOf('function applyModalVariant'));
  const loop = fn.indexOf('for (const key of MODAL_IDENTITY_KEYS)');
  const setV = fn.search(/block\.dataset\.variant\s*=/);
  assert.ok(loop >= 0, 'applyModalVariant 안에서 채우기 루프를 못 찾았다 — 패턴을 갱신하라');
  assert.ok(setV >= 0, 'applyModalVariant 안에서 dataset.variant 갱신을 못 찾았다 — 패턴을 갱신하라');
  assert.ok(loop < setV,
    'dataset.variant 를 «먼저» 갱신하고 있다. 그러면 「이전 변형의 유효 기본값」 판정이 무너져 ' +
    '사용자 값 보존도 되돌리기도 같이 깨진다.');
});

test('T-a4 ★변형별 기본값이 표 «밖»에 삼항으로 되살아나지 않았다', () => {
  const src = stripComments(MODAL_SRC);
  assert.equal(/\bisDashed\b/.test(src), false,
    'modal-block.js 에 isDashed 가 되살아났다 — 변형별 기본값 삼항이 makeModalBlock «생성 시점»에만 ' +
    '있어서 전환 때 안 따라가던 것이 바로 그 결함이다. MODAL_VARIANT_IDENTITY 를 써라.');
  // 생성·렌더 둘 다 표를 거쳐야 한다(한쪽만 거치면 생성은 맞고 전환은 틀린 옛 상태로 돌아간다)
  const make = src.slice(src.indexOf('function makeModalBlock'));
  const render = src.slice(src.indexOf('function renderModalBlock'), src.indexOf('function makeModalBlock'));
  assert.match(make, /_effDefault\s*\(/, 'makeModalBlock 이 _effDefault 를 안 쓴다');
  assert.match(render, /_effDefault\s*\(/, 'renderModalBlock 이 _effDefault 를 안 쓴다');
});

test('T-a5 ★패널의 폴백도 «그 변형의» 유효 기본값이다 (화면이 캔버스와 다른 값을 말하지 않는다)', () => {
  const src = stripComments(PROP_SRC);
  assert.match(src, /import\s*\{[^}]*\b_effDefault\b[^}]*\}\s*from\s*['"]\.\.\/blocks\/modal-block\.js['"]/,
    'prop-modal.js 가 _effDefault 를 import 하지 않는다');
  for (const [re, what] of [
    [/_i\(\s*'borderW'\s*,\s*0\s*\)/, "_i('borderW', 0)"],
    [/dataset\.borderStyle\s*\|\|\s*'solid'/, "dataset.borderStyle || 'solid'"],
    [/dataset\.bg\s*\|\|\s*'#[0-9a-fA-F]{6}'/, "dataset.bg || '#…'"],
  ]) {
    assert.equal(re.test(src), false,
      `prop-modal.js 에 하드코딩 폴백 «${what}» 이 남아 있다 — dataset 키가 없는 dashed 블록에서 ` +
      `캔버스는 2px dashed 인데 패널만 0/solid 로 보이는 «화면이 거짓말하는» 자리가 된다.`);
  }
});
