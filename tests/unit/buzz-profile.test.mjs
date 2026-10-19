/* buzz-profile — 버즈 카드의 프로필 이미지·이모지(1017t1l2 · 현빈 1018t1-l2a/b/c).
 *
 * ★무엇을 잠그나
 *   P0 전제   — 두 판(고치기 전 핀 · 지금 작업트리)이 «서로 다른 글자»다. 같으면 아래 무회귀가 항등식이다.
 *   P1 무회귀 — 프로필 칸이 «없는» 모달 576조합에서 innerHTML·cssText 가 두 판 사이 ★바이트로 같다.
 *   P2 양성대조 — 같은 576조합에 프로필을 «넣으면» 두 판이 ★갈린다. 갈리는 수가 곧 «그릴 수 있는 자리»의 수다
 *                 ⇒ P1 의 초록이 「안 재고 있다」가 아님을 같은 자로 보인다.
 *   P3 자리    — 현빈 l2a: 왼쪽이면 프로필이 글 «앞», 오른쪽이면 «뒤».
 *   P4 크기    — 현빈 l2c: 적어 두면 본문 글자와 «따로» 움직이고, 안 적으면 글자를 따라간다.
 *   P5 오버레이 — 현빈 l2c: 켜면 바깥 상자 높이가 0 이라 카드 높이를 «안 민다»(= 배경 밖으로 걸친다).
 *   P6 × 단추  — 프로필이 있을 때만 난다(없으면 0건).
 *   P7 당겨짐  — 현빈 l2b: 지우면 래퍼째 사라져 «지운 뒤»가 «처음부터 없던 것»과 바이트로 같다.
 *   P8 우선순위 — 사진이 이모지를 이긴다(쓰는 자리와 그리는 자리의 규칙이 같다).
 *   P9 이스케이프 — 따옴표가 든 값이 속성을 못 깬다 ＋ ★반례 단언(원문이 그대로는 안 들어간다).
 *   P10 미결 비석 — 현빈이 아직 안 답하신 두 칸이 소스에 「미결」로 살아 있다.
 *
 * ★하네스 — tests/unit/_modal-harness.js «한 벌»이다(⛔사본 금지 · 그 파일 머리말).
 *   「고치기 전 판」은 그 하네스의 opts.src 로 올린다.
 * ★기준판을 ★HEAD 로 두지 않는다 — 고친 판이 커밋되는 순간 HEAD 가 곧 이 판이 되어
 *   무회귀·양성대조가 ★전부 초록(=항등식)이 된다. 그래서 ★sha 를 박는다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { loadModalModule, fakeBlock } = require('./_modal-harness.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

/* ★고치기 전 판 — 1017t1l2 프로필이 들어가기 «직전»의 dev HEAD.
   ⛔'HEAD' 로 바꾸지 마라(위 머리말). 이 sha 가 사라지면 ★건너뛰지 말고 ★빨개져야 한다. */
const BASE_SHA = '0573bb91';
const MODAL_REL = 'js/blocks/modal-block.js';
/** innerHTML 과 cssText 를 «한 글자»로 이어 재는 자리표. 둘 다 그리는 결과다. */
const SEP = '\n/*--cssText--*/\n';

function baseSrc() {
  return execFileSync('git', ['-C', REPO, 'show', BASE_SHA + ':' + MODAL_REL],
    { encoding: 'utf8', maxBuffer: 8 * 1024 * 1024 });
}
const nowSrc = () => fs.readFileSync(path.join(REPO, MODAL_REL), 'utf8').replace(/\r\n/g, '\n');

/** renderModalBlock 이 실제로 받는 모양 ＋ 장식이 쓰는 insertAdjacentHTML('beforeend'). */
function blk(ds) {
  const b = fakeBlock(ds);
  b.insertAdjacentHTML = (pos, html) => { assert.equal(pos, 'beforeend'); b.innerHTML += html; };
  return b;
}

/* ── 조합 표 — 프로필과 무관한 축만 돈다(프로필 칸은 아래에서 «더해» 쓴다) ── */
const VARIANTS = ['plain', 'dashed', 'titled', 'icon', 'icon-stack', 'grid-2'];
const ALIGNS = ['left', 'center', 'right'];
const FONTS = ['28', '32'];
const TAPES = ['', 'center'];
/* ⛔textHtml 축은 ★안 돌린다 — 그 길은 공용 sanitizer 가 ★진짜 document 를 쓴다(하네스엔 없다).
   대신 ★같은 수의 조합을 두께 축으로 채운다 — 그 축은 renderModalBlock 이 ★직접 그린다. */
const BORDERS = ['', '2'];
const RADII = ['', '12'];
const HLS = ['', '#ffee00'];
/** 프로필 칸이 «하나도 없는» 조합들. */
function combos() {
  const out = [];
  for (const variant of VARIANTS) for (const align of ALIGNS) for (const fontSize of FONTS)
    for (const decoTape of TAPES) for (const borderW of BORDERS) for (const radius of RADII) for (const hlColor of HLS) {
      const ds = { variant, align, fontSize, textText: '한 달 써 보고 엄마 것도 주문했어요', titleText: '제목', cell1: '가', cell2: '나' };
      if (decoTape) ds.decoTape = decoTape;
      if (borderW) ds.borderW = borderW;
      if (radius) ds.radius = radius;
      if (hlColor) { ds.hlColor = hlColor; ds.hlOn = '1'; }
      out.push(ds);
    }
  return out;
}
const PROFILE_KEYS = ['profileImg', 'profileEmoji', 'profileSide', 'profileSize', 'profileOverlay'];
const SMILE = '\u{1F60A}';

/** 한 판의 모듈로 한 조합을 그려 «잰 글자»를 돌려준다. */
function draw(M, ds) {
  const b = blk(ds);
  M.renderModalBlock(b);
  return b.innerHTML + SEP + (b.style.cssText || '');
}

const NEW = loadModalModule();
const OLD = loadModalModule({ src: baseSrc() });

test('P0 전제 — 기준판 sha 가 살아 있고, 두 판의 소스가 «서로 다르다»', () => {
  const base = baseSrc().replace(/\r\n/g, '\n');
  assert.ok(base.length > 1000, BASE_SHA + ':' + MODAL_REL + ' 를 못 읽었다 — ⛔건너뛰지 말고 이 핀부터 고쳐라');
  assert.notEqual(nowSrc(), base,
    '두 판이 같은 글자다 — 아래 무회귀·양성대조가 전부 ★항등식이 된다(이 검사부터 의미를 잃는다)');
  assert.equal(typeof NEW.renderModalBlock, 'function');
  assert.equal(typeof OLD.renderModalBlock, 'function');
});

test('P0b 전제 — 조합 표에 프로필 칸이 한 건도 없다(무회귀의 분모가 «프로필 없는 판»이어야 한다)', () => {
  const all = combos();
  assert.equal(all.length, 576, '조합 수가 바뀌었다 — 아래 P2 의 기대 수(192/384)도 같이 다시 세라');
  let hit = 0;
  for (const ds of all) for (const k of PROFILE_KEYS) if (k in ds) hit++;
  assert.equal(hit, 0, '조합 표에 프로필 칸이 섞였다 — 그러면 P1 이 「안 달라졌다」를 못 잰다');
});

test('P1 무회귀 — 프로필 없는 576조합이 고치기 전 판과 ★바이트로 같다', () => {
  const all = combos();
  const bad = [];
  for (const ds of all) {
    const a = draw(OLD, ds), b = draw(NEW, ds);
    if (a !== b) bad.push({ ds, a, b });
  }
  assert.equal(bad.length, 0,
    '옛 저장본 ' + bad.length + '/' + all.length + ' 조합이 달라졌다 — 첫 건: ' + JSON.stringify(bad[0] && bad[0].ds)
    + '\n  옛: ' + (bad[0] && bad[0].a) + '\n  새: ' + (bad[0] && bad[0].b));
});

test('P2 양성대조 — 같은 자로 재서 «프로필을 넣으면» 갈린다 ＋ 갈리는 자리는 plain·dashed 뿐이다', () => {
  const all = combos();
  let diff = 0, same = 0;
  const diffVariants = new Set(), sameVariants = new Set();
  for (const ds of all) {
    const withPf = Object.assign({}, ds, { profileEmoji: SMILE });
    if (draw(OLD, withPf) !== draw(NEW, withPf)) { diff++; diffVariants.add(ds.variant); }
    else { same++; sameVariants.add(ds.variant); }
  }
  assert.ok(diff > 0, '★프로필을 넣어도 두 판이 같다 — 비교기가 아무것도 못 재고 있다(P1 의 초록이 무의미)');
  assert.deepEqual([...diffVariants].sort(), ['dashed', 'plain'],
    '그리는 자리가 plain·dashed 밖으로 샜거나 좁아졌다 — modal-block.js 의 그 갈래와 같은 집합이어야 한다');
  assert.equal(diff, 192, '갈린 조합 ' + diff + ' — 576 중 plain·dashed 몫(2/6 = 192)이어야 한다');
  assert.equal(same, 384, '안 갈린 조합 ' + same + ' — 나머지 네 변형 몫(4/6 = 384)이어야 한다');
  assert.ok(!sameVariants.has('plain') && !sameVariants.has('dashed'));
});

/* ── 아래는 «지금 판»만 잰다(옛 판엔 기능 자체가 없다) ───────────────── */
const PF = { textText: '재구매만 벌써 세 번째예요', variant: 'plain', align: 'left', fontSize: '28' };
const with_ = (extra) => Object.assign({}, PF, extra);
const OUTER_RE = /class="mdl-profile" data-side="[a-z]+" style="position:relative;flex:0 0 auto;width:(\d+)px;height:(\d+)px;"/;
function outerBox(html) {
  const m = OUTER_RE.exec(html);
  assert.ok(m, '프로필 바깥 상자를 못 찾았다 — 마크업이 바뀌었으면 이 검사부터 고쳐라\n' + html);
  return { w: +m[1], h: +m[2] };
}

test('P3 자리 — 왼쪽이면 프로필이 글 앞, 오른쪽이면 글 뒤(현빈 l2a)', () => {
  const left = draw(NEW, with_({ profileEmoji: SMILE }));
  assert.ok(/class="mdl-profilerow"/.test(left), '프로필이 있으면 가로 래퍼가 난다');
  assert.ok(left.indexOf('class="mdl-profile"') < left.indexOf('class="tb-mdl-text"'),
    '기본(왼쪽)에서 프로필이 글보다 앞이어야 한다');
  assert.ok(/data-side="left"/.test(left));

  const right = draw(NEW, with_({ profileEmoji: SMILE, profileSide: 'right' }));
  assert.ok(right.indexOf('class="tb-mdl-text"') < right.indexOf('class="mdl-profile"'),
    '오른쪽에서는 글이 프로필보다 앞이어야 한다');
  assert.ok(/data-side="right"/.test(right));

  /* 표 밖의 값은 왼쪽으로 착지한다 — 패널이 보여 주는 값과 같은 착지점이어야 한다. */
  assert.ok(/data-side="left"/.test(draw(NEW, with_({ profileEmoji: SMILE, profileSide: 'top' }))),
    '표 밖의 자리 값은 왼쪽으로 착지해야 한다');
});

test('P4 크기 — 적으면 글자와 따로, 안 적으면 글자를 따라간다(현빈 l2c 「프로필 크기만」)', () => {
  /* ⑴ 안 적은 판 — 글자 28 → max(48, round(28×1.6)=45) = 48 · 글자 40 → round(64) = 64 */
  assert.equal(outerBox(draw(NEW, with_({ profileEmoji: SMILE }))).w, 48);
  assert.equal(outerBox(draw(NEW, with_({ fontSize: '40', profileEmoji: SMILE }))).w, 64);
  /* ⑵ 적은 판 — 글자를 28→40 으로 바꿔도 ★안 움직인다. 이것이 l2c 의 요구다. */
  assert.equal(outerBox(draw(NEW, with_({ profileEmoji: SMILE, profileSize: '120' }))).w, 120);
  assert.equal(outerBox(draw(NEW, with_({ fontSize: '40', profileEmoji: SMILE, profileSize: '120' }))).w, 120,
    '크기를 적어 뒀는데 본문 글자를 따라 움직였다 — 「크기만 키울 수 있도록」이 깨졌다');
  /* ⑶ 경계 — 모달 한 표(24~400)로 죈다. ⛔패널이 제 수를 갖지 않는 그 표다. */
  assert.equal(outerBox(draw(NEW, with_({ profileEmoji: SMILE, profileSize: '9999' }))).w, 400);
  assert.equal(outerBox(draw(NEW, with_({ profileEmoji: SMILE, profileSize: '1' }))).w, 24);
});

test('P5 오버레이 — 켜면 바깥 상자 높이가 0 이라 카드 높이를 안 민다(현빈 l2c)', () => {
  const off = outerBox(draw(NEW, with_({ profileEmoji: SMILE, profileSize: '160' })));
  const on  = outerBox(draw(NEW, with_({ profileEmoji: SMILE, profileSize: '160', profileOverlay: '1' })));
  assert.equal(off.w, 160);
  assert.equal(off.h, 160, '기본은 카드 높이를 민다(시안 ④ 그대로 — 현빈 미결)');
  assert.equal(on.w, 160, '폭은 그대로여야 한다 — 글은 여전히 옆으로 비켜선다');
  assert.equal(on.h, 0, '오버레이는 높이를 0 으로 — 그래야 배경 위아래로 넘쳐 걸친다');
  /* 얼굴은 두 갈래 모두 ★같은 자리에 절대배치다(마크업 하나 · 숫자 하나로 갈린다). */
  for (const h of [draw(NEW, with_({ profileEmoji: SMILE })), draw(NEW, with_({ profileEmoji: SMILE, profileOverlay: '1' }))]) {
    assert.ok(/class="mdl-profile-face" style="position:absolute;left:0;top:50%;transform:translateY\(-50%\);/.test(h));
  }
});

test('P6 × 단추 — 프로필이 있을 때만 난다', () => {
  const on = draw(NEW, with_({ profileEmoji: SMILE }));
  assert.equal((on.match(/class="mdl-profile-x"/g) || []).length, 1);
  const off = draw(NEW, with_({}));
  assert.equal((off.match(/mdl-profile-x/g) || []).length, 0, '프로필이 없는데 × 자리가 남으면 안 된다');
});

test('P7 당겨짐 — 지운 뒤가 «처음부터 없던 것»과 바이트로 같다(현빈 l2b 「자리 사라짐」)', () => {
  const b = blk(with_({ profileEmoji: SMILE }));
  NEW.renderModalBlock(b);
  assert.ok(/mdl-profilerow/.test(b.innerHTML), '전제 — 지우기 전에는 래퍼가 있다');
  delete b.dataset.profileEmoji;          // × 단추가 하는 일(그 핸들러의 두 줄)
  delete b.dataset.profileImg;
  NEW.renderModalBlock(b);
  assert.equal(b.innerHTML + SEP + (b.style.cssText || ''), draw(NEW, with_({})),
    '지운 뒤에 빈 자리가 남았다 — 「글이 당겨짐」이 아니라 「빈 자리로 남음」이 된다');
  assert.ok(!/mdl-profilerow|mdl-profile-x/.test(b.innerHTML));
});

test('P8 우선순위 — 사진이 이모지를 이긴다', () => {
  const h = draw(NEW, with_({ profileImg: 'data:image/png;base64,iVBORw0KGgo=', profileEmoji: SMILE }));
  assert.ok(/class="mdl-profile-img"/.test(h));
  assert.ok(!/mdl-profile-emoji/.test(h), '사진과 이모지가 같이 그려지면 둘 중 하나라는 규칙이 깨진다');
});

test('P9 이스케이프 — 따옴표가 속성을 못 깬다 ＋ ★반례 단언', () => {
  const evil = 'data:image/png;base64,AAA" onerror="alert(1)';
  const h = draw(NEW, with_({ profileImg: evil }));
  assert.ok(!h.includes('AAA" onerror'), '날 따옴표가 그대로 살아남았다 — 속성이 끝나고 새 속성이 생긴다');
  assert.ok(!/onerror\s*=\s*["']/.test(h), '따옴표를 여는 onerror 속성이 생겼다');
  /* ★반례 — 「안 들어간다」가 ★항등식이 아님을 보인다: 값은 «살아서 바뀜 꿀»로 실제로 들어 있다.
     ⇒ 「그냥 사진을 안 그렸다」로 초록이 나는 길을 막는다. */
  assert.ok(h.includes('AAA&quot; onerror=&quot;alert(1)'), '값이 ★바뀜 꿀로 실제로 들어 있어야 한다(안 그렸으면 위 두 단언은 공짜다)');
  assert.ok(!h.includes(evil), '원문이 그대로 들어갔다');
  /* 줄바꿈이 든 값은 ★아예 안 그린다(속성·cssText 를 깨는 자리) — 이모지로 폴백하지도 않는다. */
  assert.ok(!/mdl-profile\b/.test(draw(NEW, with_({ profileImg: 'data:image/png;base64,AA\nBB' }))),
    '줄바꿈이 든 사진 주소는 거절해야 한다');
});

test('P10 미결 비석 — ⑵꼴·⑷높이차가 「미결」로 소스에 남아 있다(다음 사람이 지어내지 않게)', () => {
  const src = nowSrc();
  const at = src.indexOf('const MODAL_PROFILE_SIDES');
  assert.ok(at > 0, '프로필 상수를 못 찾았다 — 이름이 바뀌었으면 이 검사부터 고쳐라');
  const head = src.slice(Math.max(0, at - 4000), at);
  assert.ok(/미결/.test(head), '프로필 머리말에서 「미결」 표식이 사라졌다 — 지우려면 현빈 답을 먼저 받아라');
  assert.ok(/MODAL_PROFILE_RADIUS/.test(src) && /MODAL_PROFILE_EMOJI_RATIO/.test(src),
    '미결 ⑵ 의 두 값이 «한 자리씩»으로 남아 있어야 한다(답이 오면 거기만 고친다)');
});
