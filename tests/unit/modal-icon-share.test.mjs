/* 모달 아이콘 = «아이콘블럭과 같은 것» — 현빈 발주 2026-09-09
 *
 * 지시 원문: 「아이콘 색 >> 아이콘 블럭 넣을 때의 색으로 해주고 / 캔버스에 누르면 바로 아이콘
 *   버튼처럼 교체 / 이미지파일 등의 버튼과 svg 프리셋 절이 나오게 / 아이콘 블럭과 같은 역할이라
 *   우측 프로퍼티에서 아이콘 선택 시 아이콘블럭에 있는 기본 기능들 나타나면 됨」
 *
 * ★이 검사의 «중심»은 I1 과 I4 다 — 둘 다 「같은 것이 두 벌이 되지 않았는가」를 잰다.
 *   ⛔두 색을 손으로 적어 비교하면 아무것도 안 잰 것이다(그러면 내가 적은 수끼리 같은지만
 *     재게 된다). ⇒ «양쪽 출처»(iconify-block.js · modal-block.js)를 각각 진짜로 돌려서 잰다.
 *   ★그리고 변이를 «실제로 주입»한다: 아이콘블럭 소스의 기본색을 바꿔 다시 돌린다.
 *     모달이 안 따라오면(=자기 리터럴을 갖고 있으면) 빨강이다.
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import path from 'node:path';
import vm from 'node:vm';
import fs from 'node:fs';

const require_ = createRequire(import.meta.url);
const { loadModalModule, modalSrc, fakeBlock, ROOT } = require_('./_modal-harness.js');
const { readSrc } = require_('./_srcread.js');
const { stripComments } = require_('./_strip-comments.js');

const ICONIFY_REL   = 'js/blocks/iconify-block.js';
const PROP_MODAL_REL = 'js/props/prop-modal.js';
const PROP_ICON_REL  = 'js/props/prop-iconify.js';

/* ── 아이콘블럭을 «진짜로» 돌리는 얇은 로더 ──────────────────────────────────────
   ⛔표를 베끼지 않는다 — 소스를 그대로 vm 에 올린다(_modal-harness 와 같은 규율).
   ⚠️src 인자를 받는 이유 = «변이 주입» 때문이다. 원본과 변이본을 같은 길로 돌려야
     둘의 차이가 「소스의 그 한 수」밖에 없다고 말할 수 있다. */
function loadIconifyModule(src) {
  const body = (src ?? readSrc(ROOT, ICONIFY_REL))
    .replace(/^import[^\n]*\n/gm, '')
    .replace(/export\s*\{[\s\S]*?\};/, '');
  let seq = 0;
  const mkEl = () => ({
    className: '', id: '', innerHTML: '', dataset: Object.create(null), style: {},
    appendChild() {}, querySelector() { return null; }, setAttribute() {},
  });
  const ctx = {
    document: { createElement: mkEl },
    window: {},
    genId: (p) => `${p}_${++seq}`,
    insertAfterSelected() {}, showNoSelectionHint() {}, bindBlock() {},
    console,
  };
  vm.createContext(ctx);
  vm.runInContext(body + '\n;globalThis.__I = { makeIconifyBlock };', ctx, { filename: ICONIFY_REL });
  return ctx.__I;
}

/** 아이콘블럭을 «새로 넣을 때»의 색 — 팩토리 결과에서 읽는다(수를 적지 않는다). */
function iconifyNewColor(src) {
  return loadIconifyModule(src).makeIconifyBlock().block.dataset.iconColor;
}

/** 모달을 «새로 만들 때»의 아이콘색 — window.makeIconifyBlock 을 실제로 물려서 잰다. */
function modalNewIconColor(iconifySrc) {
  const win = { makeIconifyBlock: loadIconifyModule(iconifySrc).makeIconifyBlock };
  const M = loadModalModule({ win });
  return { color: M.makeModalBlock({ variant: 'icon' }).block.dataset.iconColor, M };
}

// ══ I1 — 두 기본색이 «같다». 손으로 적은 수는 한 개도 없다 ═════════════════════
test('I1 모달 아이콘 기본색 == 아이콘블럭 기본색 (양쪽 출처에서 읽어 대조)', () => {
  const icnColor = iconifyNewColor();
  const { color: mdlColor } = modalNewIconColor();
  assert.ok(/^#[0-9a-fA-F]{3,8}$/.test(icnColor),
    `아이콘블럭 기본색을 «못 읽었다»(${icnColor}) — 못 읽으면 이 검사는 아무것도 안 잰 것이다`);
  assert.equal(mdlColor, icnColor,
    `모달 아이콘 기본색이 아이콘블럭과 갈라졌다: 모달=${mdlColor} 아이콘블럭=${icnColor}`);
});

test('I1-변이 아이콘블럭의 기본색을 바꾸면 «모달이 따라온다» (모달에 리터럴이 없다는 증거)', () => {
  const before = iconifyNewColor();
  const MUT = '#3f51b5';
  assert.notEqual(before, MUT, '변이 색이 원래 색과 같으면 변이가 아니다 — 다른 색을 골라라');

  const src = readSrc(ROOT, ICONIFY_REL);
  const mutated = src.replace(/dataset\.iconColor = '#000000'/, `dataset.iconColor = '${MUT}'`);
  // ★변이가 «실제로 주입됐는지» 먼저 확인한다. 안 박혔는데 초록이면 그건 통과가 아니다.
  assert.notEqual(mutated, src, '변이 주입 실패 — iconify-block.js 의 기본색 대입 줄을 못 찾았다');
  assert.equal(iconifyNewColor(mutated), MUT, '변이 주입은 됐는데 팩토리가 안 따라왔다');

  const { color } = modalNewIconColor(mutated);
  assert.equal(color, MUT,
    `모달이 아이콘블럭을 «안 따라온다» — 모달 쪽에 색 리터럴이 두 벌로 생겼다는 뜻이다 (모달=${color})`);
});

// ══ I2 — 음성대조: 이미 저장된 모달블럭은 «안 바뀐다» ══════════════════════════
test('I2 저장된 모달블럭의 아이콘색은 안 바뀐다 (dataset 이 이긴다)', () => {
  const LEGACY = '#f0b429';
  const { M } = modalNewIconColor();
  // ⑴ 렌더 폴백(옛 기본값)은 그대로여야 한다 — 바꾸면 dataset 없는 옛 블록의 화면이 움직인다
  assert.equal(M.MODAL_DEFAULTS.iconColor, LEGACY,
    'MODAL_DEFAULTS.iconColor 는 «옛 블록용 렌더 폴백»이다 — 새 색으로 바꾸면 옛 화면이 같이 움직인다');

  // ⑵ 저장본(dataset 만 든 블록)을 그대로 그려 본다
  const saved = fakeBlock({ variant: 'icon', iconColor: LEGACY, iconSize: '24', textText: 'x' });
  M.renderModalBlock(saved);
  assert.match(saved.innerHTML, /color:#f0b429/,
    '저장된 모달의 아이콘색이 덮였다 — 옛 블록은 저장값이 이겨야 한다');
  assert.doesNotMatch(saved.innerHTML, /color:#000000/, '새 기본색이 옛 블록에 새어 들어갔다');
});

test('I2-변이 아이콘블럭 색을 바꿔도 «저장된» 모달은 안 움직인다', () => {
  const src = readSrc(ROOT, ICONIFY_REL);
  const mutated = src.replace(/dataset\.iconColor = '#000000'/, "dataset.iconColor = '#3f51b5'");
  assert.notEqual(mutated, src, '변이 주입 실패');
  const { M } = modalNewIconColor(mutated);
  const saved = fakeBlock({ variant: 'icon', iconColor: '#f0b429', iconSize: '24' });
  M.renderModalBlock(saved);
  assert.match(saved.innerHTML, /color:#f0b429/, '저장된 모달이 새 기본색에 끌려갔다');
  assert.doesNotMatch(saved.innerHTML, /#3f51b5/, '저장된 모달에 새 기본색이 샜다');
});

// ══ ⑵ 캔버스에서 누르면 «바로 교체» ═══════════════════════════════════════════
test('⑵ 아이콘 슬롯이 «누를 수 있는» 모양으로 그려진다 (cursor + 표식)', () => {
  const { M } = modalNewIconColor();
  const b = fakeBlock({ variant: 'icon', iconColor: '#f0b429', iconSize: '24' });
  M.renderModalBlock(b);
  assert.match(b.innerHTML, /class="mdl-icon"/, '아이콘 슬롯이 안 그려졌다');
  assert.match(b.innerHTML, /data-mdl-icon="1"/, '슬롯 표식(data-mdl-icon)이 없다');
  assert.match(b.innerHTML, /cursor:pointer/, '슬롯이 «버튼처럼» 안 보인다 — cursor 선언이 없다');
});

test('⑵ 고른 아이콘이 앉는 자리는 «한 곳»이다 (applyPickedIconToModal)', () => {
  const { M } = modalNewIconColor();
  const b = fakeBlock({ variant: 'icon' });

  assert.equal(M.applyPickedIconToModal(b, null), false, 'picked 가 없으면 아무것도 안 해야 한다');

  M.applyPickedIconToModal(b, { name: 'lucide:bell', svg: '<svg id="s1"></svg>' });
  assert.equal(b.dataset.iconName, 'lucide:bell');
  assert.equal(b.dataset.iconSvg, '<svg id="s1"></svg>');
  assert.equal(b.dataset.raster, undefined, '벡터로 바꿨는데 래스터 마커가 남았다');

  M.applyPickedIconToModal(b, { name: 'img:photo', src: 'goya-asset://a/b.png' });
  assert.equal(b.dataset.raster, '1');
  assert.equal(b.dataset.iconSrc, 'goya-asset://a/b.png');
  assert.equal(b.dataset.iconSvg, undefined, '래스터로 바꿨는데 벡터 잔재가 남았다');
});

test('⑵-변이 슬롯 클릭이 «고르기 모달»로 간다 (openModalIconPicker → openIconifyModal)', () => {
  const src = modalSrc();
  assert.match(src, /function openModalIconPicker\(block\)\s*\{[\s\S]{0,200}window\.openIconifyModal/,
    'openModalIconPicker 가 window.openIconifyModal 을 안 부른다 — 고르기 UI 를 새로 짰거나 끊겼다');
  assert.match(src, /addEventListener\('click',[\s\S]{0,400}openModalIconPicker\(block\)/,
    '슬롯 클릭이 고르기로 연결돼 있지 않다 — ⑵가 죽었다');
});

// ══ ⑶⑷ 우측 패널 — «아이콘블럭의 그 패널»을 그대로 연다 ════════════════════════
test('I3 모달 아이콘 패널이 아이콘블럭 패널을 «부른다» (이미지 파일 버튼·프리셋 절의 출처)', () => {
  const propModal = readSrc(ROOT, PROP_MODAL_REL);
  const propIcon  = readSrc(ROOT, PROP_ICON_REL);

  // ⑴ 모달 패널이 아이콘블럭 패널을 실제로 부른다
  assert.match(propModal, /export function showModalIconProperties\(block\)/,
    'showModalIconProperties 가 없다 — ⑷의 진입점이 사라졌다');
  assert.match(propModal, /window\.showIconifyProperties\(slot\)/,
    '아이콘블럭 패널을 «안 부른다» — 그러면 이미지 버튼·프리셋 절이 어디서도 안 온다');
  assert.match(propModal, /id="mdl-icon-more"/, '패널에서 여는 버튼이 없다');

  // ⑵ 그 패널에 «실제로» 이미지 파일 버튼과 프리셋 절이 있다 (부른 곳에 물건이 있는가)
  assert.match(propIcon, /id="icn-svg-file-btn"/, '아이콘블럭 패널에 이미지 파일 버튼이 없다');
  assert.match(propIcon, /id="icn-preset-grid"/,  '아이콘블럭 패널에 SVG 프리셋 절이 없다');
  assert.match(propIcon, /내 SVG 프리셋/,          '아이콘블럭 패널에 프리셋 절 제목이 없다');

  // ⑶ 슬롯이 아이콘블럭의 «계약»을 갖춰야 그 패널이 동작한다(updateIconifyBlock 이 class 를 본다)
  assert.match(propModal, /slot\.classList\.add\('icon-block'\)/,
    '슬롯에 icon-block 계약을 안 입힌다 — updateIconifyBlock 이 NOT_FOUND 로 거절한다');
  assert.match(propModal, /slot\.classList\.remove\('icon-block'\)/,
    '입힌 계약을 «안 벗긴다» — 세션이 끝나도 슬롯이 아이콘블럭인 척 남는다');
});

test('I4 베끼지 않았다 — 프리셋·이미지 코드가 모달 쪽에 «두 벌»로 생기지 않았다', () => {
  const propModal = readSrc(ROOT, PROP_MODAL_REL);
  const mdl       = modalSrc();

  for (const needle of ['svgPresets', 'icn-preset-', 'icn-svg-file', 'assetsSaveCanvasImage']) {
    assert.ok(!propModal.includes(needle),
      `prop-modal.js 가 아이콘블럭 패널의 «${needle}» 를 베껴 왔다 — 부르는 쪽으로 가라`);
    assert.ok(!mdl.includes(needle),
      `modal-block.js 가 아이콘블럭의 «${needle}» 를 베껴 왔다 — 부르는 쪽으로 가라`);
  }

  // 아이콘 기본색 계산이 js/blocks 아래 «두 벌»이 아니다
  const blocksDir = path.join(ROOT, 'js/blocks');
  const owners = fs.readdirSync(blocksDir)
    .filter((f) => f.endsWith('.js'))
    .filter((f) => /dataset\.iconColor\s*=\s*'#[0-9a-fA-F]{3,8}'/.test(
      fs.readFileSync(path.join(blocksDir, f), 'utf8')));
  assert.deepEqual(owners, ['iconify-block.js'],
    `아이콘 기본색 리터럴의 주인은 한 파일이어야 한다. 지금: ${owners.join(', ')}`);

  // 모달은 그 색을 «부른다»
  assert.match(mdl, /window\.makeIconifyBlock/,
    '모달이 아이콘블럭 팩토리를 안 부른다 — 색을 어디서 가져오는지 다시 봐라');
});

test('⑷ 모달 dataset 이 «여전히» 진실이다 (슬롯에서 바뀐 값이 모달로 되돌아온다)', () => {
  const propModal = readSrc(ROOT, PROP_MODAL_REL);
  assert.match(propModal, /_MDL_ICON_KEYMAP/, '모달↔슬롯 키 표가 없다');
  assert.match(propModal, /new MutationObserver/, '슬롯 변화를 모달로 되돌리는 장치가 없다');
  assert.match(propModal, /function _syncIconSlotToModal/, '되돌리는 함수가 없다');
  // 키 표가 «양방향 한 표»여야 한다 — 두 벌이면 한쪽만 낡는다
  const n = (propModal.match(/_MDL_ICON_KEYMAP\s*=/g) || []).length;
  assert.equal(n, 1, `키 표가 ${n} 벌이다 — 하나여야 한다`);
});

/* ★★키표의 «내용»을 «기계가 센 분모»로 못박는다.
     ⚠️2026-09-09 적대적 검수가 잡은 구멍: 위 ⑷ 는 `_MDL_ICON_KEYMAP` 이라는 «이름»이 있는지와
       «몇 벌»인지만 grep 한다. ⇒ 행을 하나씩 지워도(회전·색·svg) 전 검사가 «초록»이었다.
     ⇒ ★분모를 손으로 적지 않는다 — 모달이 실제로 쓰는 `icon*` dataset 키를 «소스에서» 뽑아
       그 전수가 키표에 드는지 본다. 새 아이콘 키가 생기는 날 이 검사가 «스스로» 빨개진다. */
test('⑷-키표 ★모달의 icon* 키 «전수»가 키표에 든다 (내용을 잰다, 이름이 아니라)', () => {
  const propModal = readSrc(ROOT, PROP_MODAL_REL);
  const modalSrc  = readSrc(ROOT, 'js/blocks/modal-block.js');

  /* 키표에서 «왼쪽 열»(모달 키)을 뽑는다. */
  /* ⚠️★비탐욕 `[\s\S]*?\]` 는 «안쪽 쌍의 닫는 괄호»에서 멈춘다 — 처음에 그렇게 써서
       쌍을 0개 뽑았고, 아래 「입력이 살아 있다」 가드가 그걸 잡았다. 표의 «끝»(`];`)까지 간다. */
  const tbl = propModal.match(/const\s+_MDL_ICON_KEYMAP\s*=\s*\[([\s\S]*?)\n\];/);
  assert.ok(tbl, '키표를 못 떠냈다 — 하네스가 부서졌다(계약이 문 것이 아니다)');
  const pairs = [...tbl[1].matchAll(/\[\s*'([^']+)'\s*,\s*'([^']+)'\s*\]/g)].map(m => [m[1], m[2]]);
  assert.ok(pairs.length >= 5, `키표에서 ${pairs.length} 쌍밖에 못 뽑았다 — 정규식이 죽었다`);
  const left = new Set(pairs.map(p => p[0]));

  /* ★분모 — 모달 소스가 «실제로» 쓰는 icon* dataset 키 전수(기계가 뽑는다). */
  const ALL = [...new Set([...modalSrc.matchAll(/dataset\.(icon[A-Z][A-Za-z]*)/g)].map(m => m[1]))];
  assert.ok(ALL.length >= 4, `모달에서 icon* dataset 키를 ${ALL.length}개밖에 못 뽑았다 — 분모가 죽었다`);

  /* ⛔예외를 두려면 «왜»를 여기 적어라. 조용히 늘리면 이 검사는 명부가 된다. */
  const EXCEPT = new Set([]);
  const missing = ALL.filter(k => !EXCEPT.has(k) && !left.has(k));
  assert.deepEqual(missing, [],
    `키표에 «빠진» 모달 아이콘 키: ${missing.join(', ')} — 전수 ${ALL.length}개 중`
    + ` (키표: ${[...left].join(', ')})`);

  /* ★회전은 «이름이 다르게» 건너간다(iconRotation → rotation) — 그 짝을 따로 못박는다.
       이름이 같은 것들과 달리 여기만 «번역»이라, 조용히 어긋나면 회전이 헛돈다. */
  assert.deepEqual(pairs.find(p => p[0] === 'iconRotation'), ['iconRotation', 'rotation'],
    'iconRotation 의 짝이 rotation 이 아니다 — 슬롯의 회전이 모달로 안 돌아온다');
  assert.deepEqual(pairs.find(p => p[0] === 'iconSize'), ['iconSize', 'size'],
    'iconSize 의 짝이 size 가 아니다');
});

test('⑷ 아이콘 회전이 «저장되는 값»이 됐다 (아이콘블럭의 회전 기능이 헛돌지 않게)', () => {
  const { M } = modalNewIconColor();
  assert.equal(M.MODAL_DEFAULTS.iconRotation, 0, '기본 회전은 0 이어야 한다(옛 블록 화면 불변)');

  const none = fakeBlock({ variant: 'icon', iconSize: '24' });
  M.renderModalBlock(none);
  assert.doesNotMatch(none.innerHTML, /transform:rotate/,
    '회전 0 인데 transform 선언이 나갔다 — 이미 만든 모달의 cssText 가 달라진다');

  const rot = fakeBlock({ variant: 'icon', iconSize: '24', iconRotation: '90' });
  M.renderModalBlock(rot);
  assert.match(rot.innerHTML, /transform:rotate\(90deg\)/, '회전 값이 안 그려진다');
});

test('⑷ 아이콘블럭 패널의 「교체」 버튼이 «모달의 문»으로 간다 (엉뚱한 블록 생성 방지)', () => {
  const propModal = readSrc(ROOT, PROP_MODAL_REL);
  const propIcon  = readSrc(ROOT, PROP_ICON_REL);
  const panel     = readSrc(ROOT, 'js/panels/iconify-panel.js');

  /* ★이 검사가 지키는 사고: 아이콘블럭 패널의 「교체」는 콜백 «없이» openIconifyModal 을 부르고,
     콜백이 없으면 iconify-panel 이 addIconifyBlock 으로 «새 블록»을 캔버스에 꽂는다.
     모달 안에서 그 길로 새면 아이콘이 안 바뀌고 엉뚱한 블록이 하나 생긴다.
     ⇒ 전제(아이콘블럭 쪽이 콜백 없이 부른다)가 «아직도 참인지»부터 잰다. 참이 아니게 되면
       이 우회는 필요 없어진 것이고, 그때 이 검사가 알려 준다. */
  assert.match(propIcon, /const openModal = \(\) => window\.openIconifyModal\?\.\(\);/,
    '전제가 바뀌었다 — prop-iconify 의 「교체」가 이제 콜백을 넘긴다면 모달 쪽 우회를 걷어내라');
  assert.match(panel, /else window\.addIconifyBlock\(name, svgText, size\);/,
    '전제가 바뀌었다 — 콜백 없을 때의 폴백이 더 이상 addIconifyBlock 이 아니다');

  for (const id of ['icn-replace-btn', 'icn-open-modal-btn']) {
    assert.ok(propModal.includes(`#${id}`),
      `「교체」 버튼(${id})을 안 가로챈다 — 누르면 아이콘이 바뀌는 대신 엉뚱한 아이콘블럭이 생긴다`);
  }
  assert.match(propModal, /propPanel\.addEventListener\('click', grabReplace, true\)/,
    '가로채기를 «캡처 단계»로 안 걸었다 — 대상 요소에 같이 걸면 등록 순서라 원래 리스너가 먼저 뜰 수 있다');
  assert.match(propModal, /window\.openModalIconPicker\?\.\(block\);/,
    '가로챈 클릭이 openModalIconPicker 로 안 간다');
  assert.match(propModal, /propPanel\.removeEventListener\('click', grabReplace, true\)/,
    '오래 사는 propPanel 에 가로채기를 남긴다 — 나중에 «아이콘블럭 자신»의 패널까지 가로챈다');
  /* ★주석을 걷고 «코드»만 본다 — 이 파일의 주석에 cloneNode 라는 «금지 표지»가 적혀 있어서
     날문자열로 재면 자기 경고문에 걸린다(_strip-comments.js 가 태어난 그 병의 사촌). */
  assert.ok(!stripComments(propModal).includes('cloneNode'),
    'cloneNode 로 갈아끼우지 마라 — 이 레포는 clone 경로를 명부로 관리한다(export-channel-roster)');
});

test('⑷ 아이콘 세션은 «항상 하나»다 (겹치면 새 슬롯을 옛 감시자가 지운다)', () => {
  const propModal = readSrc(ROOT, PROP_MODAL_REL);
  assert.match(propModal, /let _iconSession = null;/, '세션 손잡이가 없다');
  assert.match(propModal, /_iconSession\?\.\(false\);/,
    '새 세션을 열기 전에 옛 세션을 «동기적으로» 안 닫는다 — 겹치면 새 슬롯이 지워진다');
  assert.match(propModal, /_iconSession = finish;/, '세션 손잡이에 finish 를 안 걸었다');
});
