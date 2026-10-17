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
  const ctx = vm.createContext({ window: { renderModalBlock: () => {} }, buzzRows: (f) => f.__rows, _modalOf: (r) => r.modal, console });
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
