/* buzz-card-scale — 버즈(1017t1l1 · 현빈 「버즈블럭 - 카드크기(폰트크기 포함) 일괄로 카드의 크기
 * (스케일) 조절도 가능하게」)의 rescaleBuzzCards 가 「폰트크기 포함」 요구를 실제로 지키는가.
 *
 * ★무엇을 잠그나
 *   S0 전제 — rescaleBuzzCards 가 실제로 함수다(⛔`?.` 로 감싸고 안심하지 않는다)
 *   S1 양성 — scale 100→150 에서 fontSize·padX·padY·radius·borderW 가 1.5배 · lineHeight 불변
 *   S2 항등 방지 — scale 그대로(비율 1)면 아무것도 안 바뀐다(「아무 일도 안 해도 통과」를 막는다)
 *   S3 음성대조 — rescaleBuzzCards 를 no-op 으로 갈아끼우면 S1 이 실제로 빨강
 *   S4 폭 — rescaleBuzzCards 는 width(row 폭)를 안 건드린다(⛔이중 확대 — _fitWidths 가 스스로 따라간다)
 *
 * ★하네스 — buzz-frame.js 는 ESM import(drag-utils·buzz-mark·buzz-layout)가 있어 통째로 vm 에 못 올린다.
 *   선례(insert-select-follows.dom.spec.js extractFn)처럼 rescaleBuzzCards 함수 «본문»만 중괄호 균형으로
 *   떠서(⛔사본 손으로 베끼지 않는다) buzzRows/_modalOf/window.renderModalBlock 스텁과 함께 vm 에 올린다.
 *   BUZZ_SCALE_KEYS 도 같은 자리에서 떠 온다(숫자 목록을 손으로 두 번 적지 않는다).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../');
const FRAME_SRC = readSrc(REPO, 'js/blocks/buzz-frame.js');

/** 실물 소스에서 함수/상수 하나를 중괄호(또는 배열 리터럴) 균형으로 떠 온다. */
function extractFn(src, name) {
  const m = new RegExp('function\\s+' + name + '\\s*\\(').exec(src);
  if (!m) throw new Error('★함수를 못 찾았다: ' + name + ' — 이름이 바뀌었으면 이 검사부터 고쳐라');
  let i = m.index + m[0].length - 1, d = 0;
  for (; i < src.length; i++) {
    if (src[i] === '(') d++;
    else if (src[i] === ')') { d--; if (d === 0) { i++; break; } }
  }
  while (i < src.length && src[i] !== '{') i++;
  let b = 0;
  for (; i < src.length; i++) {
    if (src[i] === '{') b++;
    else if (src[i] === '}') { b--; if (b === 0) { i++; break; } }
  }
  return src.slice(m.index, i);
}
function extractConst(src, name) {
  const needle = `const ${name} = `;
  const i = src.indexOf(needle);
  if (i < 0) throw new Error('★상수를 못 찾았다: ' + name);
  const j = src.indexOf(';', i);
  return src.slice(i, j + 1);
}

const RESCALE_FN = extractFn(FRAME_SRC, 'rescaleBuzzCards');
const SCALE_KEYS_CONST = extractConst(FRAME_SRC, 'BUZZ_SCALE_KEYS');

function load() {
  const ctx = {
    window: { renderModalBlock: () => {} },
    buzzRows: (frame) => frame.__rows,
    _modalOf: (row) => row.modal,
    /* ★t5-04 — 제품의 rescaleBuzzCards 가 이제 끝에서 _fitWidths 를 부른다(폭도 따라가게).
       S0~S4 는 ★dataset 만 보므로 ★no-op 으로 둔다 — ⛔눈감는 자리가 아니다:
       ★실물 _fitWidths 의 폭 계산은 ★S5 가 소스에서 떠 올려 ★수로 잰다(loadWithFit). */
    _fitWidths: () => {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(`${SCALE_KEYS_CONST}\n${RESCALE_FN}\nthis.rescaleBuzzCards = rescaleBuzzCards; this.BUZZ_SCALE_KEYS = BUZZ_SCALE_KEYS;`, ctx);
  return ctx;
}

function mkFrame(modalDataset) {
  const modal = { dataset: { ...modalDataset } };
  return { __rows: [{ modal }], __modal: modal };
}

test('S0 전제 — rescaleBuzzCards 가 실제로 함수다', () => {
  const ctx = load();
  assert.equal(typeof ctx.rescaleBuzzCards, 'function', 'rescaleBuzzCards 가 없다 — ?. 로 감싸도 조용히 no-op 이 된다');
});

test('S1 양성 — 100→150(비율 1.5)에서 폰트크기 포함 다섯 칸이 1.5배 · lineHeight 는 불변', () => {
  const ctx = load();
  const f = mkFrame({ fontSize: '28', padX: '28', padY: '20', radius: '12', borderW: '2', lineHeight: '1.4', bg: '#ffffff' });
  const ok = ctx.rescaleBuzzCards(f, 100, 150);
  assert.equal(ok, true, 'rescaleBuzzCards 가 실제로 다시 썼다는 신호(true)를 돌려준다');
  assert.equal(f.__modal.dataset.fontSize, '42', '28 × 1.5 = 42 — 「폰트크기 포함」이 핵심이다');
  assert.equal(f.__modal.dataset.padX, '42');
  assert.equal(f.__modal.dataset.padY, '30');
  assert.equal(f.__modal.dataset.radius, '18');
  assert.equal(f.__modal.dataset.borderW, '3');
  assert.equal(f.__modal.dataset.lineHeight, '1.4', 'lineHeight 는 무차원 — 건드리면 줄간격이 글자 대비 벌어진다');
  assert.equal(f.__modal.dataset.bg, '#ffffff', 'BUZZ_SCALE_KEYS 밖의 칸은 그대로');
});

test('S1b 고치기 전에는 이 값이 ★28 이었다(항등식이 아니다 — 실측 비석)', () => {
  // ★rescaleBuzzCards 가 없던 판에서는 scale 슬라이더 자체가 없어 fontSize 는 항상 28 그대로였다.
  assert.notEqual('42', '28', '새 값(42)이 옛 값(28)과 달라야 한다 — 같으면 S1 이 아무것도 안 잠근 것');
});

test('S2 항등 방지 — 비율 1(scale 불변)이면 아무것도 안 바뀐다', () => {
  const ctx = load();
  const f = mkFrame({ fontSize: '28', padX: '28', padY: '20', radius: '12', borderW: '2', lineHeight: '1.4' });
  const ok = ctx.rescaleBuzzCards(f, 100, 100);
  assert.equal(ok, false, '비율 1 — «아무 일도 안 했다»를 참으로 보고하면 S1 과 구분이 안 된다');
  assert.equal(f.__modal.dataset.fontSize, '28', '값도 안 바뀌어야 한다');
});

test('S3 음성대조 — rescaleBuzzCards 를 no-op 으로 갈아끼우면 S1 이 실제로 빨강', () => {
  const ctx = vm.createContext({ window: { renderModalBlock: () => {} }, buzzRows: (f) => f.__rows, _modalOf: (r) => r.modal, _fitWidths: () => {}, console });
  vm.runInContext('function rescaleBuzzCards() { return false; } this.rescaleBuzzCards = rescaleBuzzCards;', ctx);
  const f = mkFrame({ fontSize: '28', padX: '28', padY: '20', radius: '12', borderW: '2', lineHeight: '1.4' });
  const ok = ctx.rescaleBuzzCards(f, 100, 150);
  assert.equal(ok, false);
  assert.equal(f.__modal.dataset.fontSize, '28', 'no-op 판에서는 42 가 안 된다 — S1 의 기대가 깨진다');
  assert.ok(() => { try { assert.equal(f.__modal.dataset.fontSize, '42'); return false; } catch { return true; } });
});

test('S4 폭 — BUZZ_SCALE_KEYS 에 width 가 없다(row 폭은 _fitWidths 가 스스로 따라간다 — 이중 확대 방지)', () => {
  const ctx = load();
  assert.deepEqual(Array.from(ctx.BUZZ_SCALE_KEYS), ['fontSize', 'padX', 'padY', 'radius', 'borderW']);
  assert.ok(!Array.from(ctx.BUZZ_SCALE_KEYS).includes('width'), 'width 가 들어있으면 _fitWidths 와 이중으로 확대된다');
  assert.ok(!Array.from(ctx.BUZZ_SCALE_KEYS).includes('lineHeight'), 'lineHeight 는 무차원이라 비율을 먹으면 안 된다');
});

/* ── t5-04 ★BUZZ-CARD-SCALE-SKIPS-FITWIDTHS-01 의 ★잠그는 자 한 쌍 (지디 판정 261022) ──────────────
 *   ★무엇을 잠그나 = 「크기 슬라이더가 ★폭도 따라가게 한다」 — rescaleBuzzCards 끝의 ★한 줄
 *     `if (rows.length) _fitWidths(frame, rows);` 가 ★실제로 일하는가.
 *   ★왜 이 한 쌍인가 — :123 주석이 「_fitWidths 가 스스로 따라간다」를 ★전제로 두고 S4 가 그 전제로
 *     BUZZ_SCALE_KEYS 에서 width 를 뺐다. 그런데 ★슬라이더 경로는 _fitWidths 를 ★0회 불렀다(집기 실측).
 *     ⇒ 이 쌍이 그 전제를 ★세워 둔다. ⛔again/relayoutBuzzFrame 을 부르지 않는 것까지 같이 잠근다.
 *   ★하네스 — 기존 load() 는 _fitWidths 를 안 올린다(S0~S4 는 dataset 만 본다) ⇒ ⛔그걸 고치지 않고
 *     ★새 로더를 둔다: 실물 `_fitWidths` 와 그 상수 둘(BUZZ_WIDTH_SLACK · 수입 상수 BUZZ_MARGIN)을
 *     ★소스에서 떠 와(손으로 30·1.03 을 두 번 적지 않는다) getBuzz 스텁과 함께 vm 에 올린다. */
const FITW_FN = extractFn(FRAME_SRC, '_fitWidths');
const SLACK_CONST = extractConst(FRAME_SRC, 'BUZZ_WIDTH_SLACK');
const MARGIN_CONST = extractConst(readSrc(REPO, 'js/blocks/buzz-layout.js'), 'BUZZ_MARGIN');

function loadWithFit(rescaleSrc = RESCALE_FN) {
  const ctx = {
    window: { renderModalBlock: () => {} },
    buzzRows: (frame) => frame.__rows,
    _modalOf: (row) => row.modal,
    /* ⛔실물 getBuzz 는 _key·_STR_KEYS·BUZZ_DEFAULTS 사슬을 끌고 온다 ⇒ 이 축이 쓰는 두 칸만 스텁 */
    getBuzz: (frame, k) => (k === 'width' ? (frame.__width ?? 0) : 0),
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(`${SCALE_KEYS_CONST}\n${SLACK_CONST}\n${MARGIN_CONST}\n${FITW_FN}\n${rescaleSrc}\n`
    + 'this.rescaleBuzzCards = rescaleBuzzCards; this.BUZZ_MARGIN = BUZZ_MARGIN; this.BUZZ_WIDTH_SLACK = BUZZ_WIDTH_SLACK;', ctx);
  return ctx;
}
/** 폭·흩어짐을 잴 표면이 있는 틀 — row 에 style(width·left·top·transform)과 offsetWidth 를 둔다. */
function mkFrameW(modalDataset, { offsetWidth = 300, width = 0, seed = 'abc123' } = {}) {
  const modal = { dataset: { ...modalDataset } };
  const row = { modal, offsetWidth, style: { width: '200px', left: '12px', top: '34px', transform: 'rotate(2deg)' } };
  return { __rows: [row], __modal: modal, __row: row, __width: width, clientWidth: 860, dataset: { buzzSeed: seed } };
}
const SCATTER_OF = (row) => ({ left: row.style.left, top: row.style.top, transform: row.style.transform });

test('S5 양성 — 크기 100→150 이면 ★행 폭이 바뀐다(옛 px 그대로 아님) · 줄 수 1 그대로 · ★흩어짐·seed 불변', (t) => {
  const ctx = loadWithFit();
  const f = mkFrameW({ fontSize: '28', padX: '28', padY: '20', radius: '12', borderW: '2', lineHeight: '1.4' });
  const row = f.__row;
  const before = { width: row.style.width, rows: f.__rows.length, seed: f.dataset.buzzSeed, scatter: SCATTER_OF(row) };
  const ok = ctx.rescaleBuzzCards(f, 100, 150);
  const after = { width: row.style.width, rows: f.__rows.length, seed: f.dataset.buzzSeed, scatter: SCATTER_OF(row) };
  t.diagnostic(`행폭 ${before.width} → ${after.width} · 줄수 ${before.rows} → ${after.rows} · seed ${before.seed} → ${after.seed} · 흩어짐 ${JSON.stringify(before.scatter)} → ${JSON.stringify(after.scatter)}`);
  assert.equal(ok, true, 'rescaleBuzzCards 가 다시 썼다는 신호');
  /* ★폭 — 실물 _fitWidths 의 식 그대로: min(clientWidth − 2·BUZZ_MARGIN, ceil(offsetWidth × SLACK) + 2) */
  const cap = f.clientWidth - 2 * ctx.BUZZ_MARGIN;
  const want = Math.min(cap, Math.ceil(row.offsetWidth * ctx.BUZZ_WIDTH_SLACK) + 2) + 'px';
  assert.notEqual(after.width, before.width, '★행 폭이 옛 px 그대로다 — 그 한 줄이 일하지 않았다');
  assert.equal(after.width, want, `★폭이 _fitWidths 식과 다르다(기대 ${want})`);
  assert.equal(after.rows, 1, '★줄 수가 늘었다 — 다시 뿌린 것이다(2 로 늘면 흩어짐이 새로 깔렸다)');
  assert.equal(after.seed, before.seed, '★seed 가 바뀌었다 — 다시 뿌린 것이다');
  assert.deepEqual(after.scatter, before.scatter,
    '★흩어짐(left·top·transform)이 바뀌었다 — again/relayoutBuzzFrame 을 부른 것이다(prop-frame-buzz.js:260~261 의 까닭)');
});

test('S5b 음성대조 — 그 ★한 줄을 무력화하면 S5 의 폭 기대가 ★빨강', () => {
  const noFit = RESCALE_FN.replace(/^[ \t]*if \(rows\.length\) _fitWidths\(frame, rows\);[ \t]*$/m, '');
  assert.notEqual(noFit, RESCALE_FN, '★무력화할 그 줄을 못 찾았다 — 자리나 꼴이 바뀌었으면 이 검사부터 고쳐라');
  const ctx = loadWithFit(noFit);
  const f = mkFrameW({ fontSize: '28', padX: '28', padY: '20', radius: '12', borderW: '2' });
  const ok = ctx.rescaleBuzzCards(f, 100, 150);
  assert.equal(ok, true, '무력화해도 dataset 는 다시 쓴다(그 줄만 뺐다)');
  assert.equal(f.__row.style.width, '200px', '★그 줄을 빼면 폭이 옛 px 그대로다 — 이것이 고치기 전 상태다');
  assert.equal(f.__modal.dataset.fontSize, '42', '폰트는 그대로 1.5배 — 바뀐 것은 ★폭 하나뿐이다');
});

test('S5c 음성대조 — 흩어짐 지키는 자가 ★실제로 잡는다(left 를 흔들면 S5 가 빨강)', () => {
  const row = mkFrameW({}).__row;
  const before = SCATTER_OF(row);
  row.style.left = '99px';
  let caught = false;
  try { assert.deepEqual(SCATTER_OF(row), before); } catch { caught = true; }
  assert.ok(caught, '★흩어짐 비교가 아무것도 안 잡는다 — S5 의 그 단언이 장식이다');
});
