/* shape-star-inner-gap.test.mjs — ★별 «통통함»(Q2) ＋ «간격»(Q3) (현빈 2026-10-07 · 지디 판정)
 *
 * 현빈 원문: 「`shp_1p9hd3j` — ★별 ★간격 조절되면 좋겠고, ★별이 너무 뾰족해서
 *              ★★라운드나 ★살짝 통통한 별로도 만들 수 있으면 좋겠어」
 * ★두 축이다(지디): ★통통 = `starInner`(안쪽 반지름 비) · ★라운드 = `starRound`(꼭지 둥글기)
 *   ⇒ ★라운드는 ★★별개다 — polygon/clip-path 는 ★직선만이라 ★path 전환이 필요하다(비용 큼). ★여기 없다.
 *
 * ★★Q3 가 ★Q1(반사 하한)과 ★다른 점 — ★이 파일의 핵이다:
 *   Q1 은 ★꺾임이 ★h·len 의 ★함수라 ★«고정 하한»이 ★0 뿐이었다 ⇒ ★수를 ★파생할 수 ★없었다.
 *   ★Q3 는 ★«완전히 가려지는» 점이 ★★n 과 ★무관하다(dx 가 ★틀 폭에만 달렸다)
 *     ⇒ ★★고정 하한 ★−200 이 ★있다 ⇒ ★그 ★50 전인 ★−150 을 ★파생할 수 ★있다.
 *   ⇒ ★★그래서 ★★여기선 ★Q1 에서 ★못 세운 단언(「하한이 ★절대 하한보다 안쪽」)을 ★세운다. ★⒜ 가 그것이다.
 */
import test from 'node:test';
import assert from 'node:assert';
import path from 'node:path';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
/* ★모듈을 ★«실제로» 싣는다 — ⛔소스 문자열만 보면 ★자가 ★죽는다.
   ★실측(2026-10-07): ⒞ 를 ★정규식으로 쟀더니 ★`clampStarInner` 의 ★«둘째» `return null` 을 잡아
     ★미설정 특례를 ★없애는 변이에도 ★★초록이었다(★양성대조가 ★그걸 잡았다).
   ⇒ ★★순수 함수는 ★★불러서 재라. 선례 = tests/unit/shape-star.test.mjs 의 임시폴더 import. */
const { clampStarInner, clampStarGap, starPoints, starPointsAt, starViewBox } = await (async () => {
  const fs = (await import('node:fs')).default;
  const os = (await import('node:os')).default;
  const { pathToFileURL } = await import('node:url');
  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'gd-star-ig-'));
  fs.writeFileSync(path.join(tmp, 'package.json'), '{"type":"module"}');
  fs.copyFileSync(path.join(ROOT, 'js/shape-star.js'), path.join(tmp, 'm.js'));
  const m = await import(pathToFileURL(path.join(tmp, 'm.js')).href);
  fs.rmSync(tmp, { recursive: true, force: true });
  return m;
})();
const RAW = readSrc(ROOT, 'js', 'shape-star.js');
const SRC = stripComments(RAW);
const PANEL = stripComments(readSrc(ROOT, 'js', 'props', 'prop-shape.js'));

/** 상수를 ★소스에서 뽑는다 — ⛔수를 손으로 베끼지 않는다. */
const num = (name, src = SRC) => {
  const m = src.match(new RegExp(`${name}\\s*=\\s*(-?\\d+)`));
  assert.ok(m, `★${name} 를 소스에서 못 뽑았다`);
  return Number(m[1]);
};

/* ─────────────────────────────────────────────
   T0 ★입력이 살아 있다
   ───────────────────────────────────────────── */
test('T0 ★입력이 살아 있다 — 소스·거르개·형제 토큰', () => {
  assert.ok(SRC.trim().length > 800, `주석을 턴 뒤 ${SRC.trim().length}자 — 거르개가 코드를 먹었다`);
  assert.ok((SRC.match(/OLD_POINTS/g) || []).length >= 2,
    '★형제 토큰 OLD_POINTS 가 2곳 미만 — 거르개가 코드를 먹었다');
  const probe = "const a=1;\n/* STAR_GAP_MIN = -999 */\nexport const STAR_GAP_MIN = -150;\n";
  assert.strictEqual(stripComments(probe).match(/STAR_GAP_MIN\s*=\s*(-?\d+)/)[1], '-150',
    '★거르개가 주석 속 수를 남겼다 — 아래 수 뽑기가 ★주석에 속는다');
});

/* ─────────────────────────────────────────────
   ⒜ ★Q3 하한 = ★절대 하한보다 ★안쪽이다 · ★그 절대 하한이 ★n 무관이다
   ★★Q1 에서 ★못 세운 단언이다 — ★여기선 ★고정 하한이 ★존재하므로 ★세울 수 있다.
   ⇐ 되돌리면 빨강: 하한을 −200 이하로 내리면(경계에 앉히면) 터진다.
   ───────────────────────────────────────────── */
test('⒜ ★간격 하한 −150 은 ★절대 하한(−200)보다 ★안쪽이다 · ★−200 은 ★n 무관', () => {
  const W   = num('STAR_VB_W');
  const gLo = num('STAR_GAP_MIN');
  const gHi = num('STAR_GAP_MAX');
  const nLo = num('STAR_MIN'), nHi = num('STAR_MAX');
  assert.strictEqual(gLo, -150, `★간격 하한이 ${gLo} 다 — 지디 결정(2026-10-07)은 ★−150 이다`);

  /* ★★절대 하한 = ★dx ≤ 0 이 되는 g — ★dx = (W + g)·i 이므로 ★g ≤ −W. ★i·n 과 ★무관하다. */
  const ABS = -W;
  assert.strictEqual(ABS, -200, `★절대 하한이 ${ABS} 다 — W(${W}) 가 바뀌면 이 수도 바뀐다`);
  assert.ok(gLo > ABS,
    `★하한 ${gLo} 이 ★절대 하한 ${ABS} 보다 ★안쪽이 아니다 — 완전히 가려진다`);
  /* ★그리고 ★경계에 ★앉히지 않았다 — 「★꺾이는 점의 ★직전에 앉히지 마라」(2026-10-07 규율) */
  assert.ok(gLo - ABS >= 25,
    `★하한 ${gLo} 이 ★절대 하한 ${ABS} 에 너무 가깝다(차 ${gLo - ABS}) — 경계에 앉혔다`);

  /* ★★★「n 무관」을 ★전수로 — ★dx ≤ 0 이 ★g = −W 에서만, ★모든 n 에서 ★같이 참인가 */
  const dx = (g, i) => (W + g) * i;
  for (let n = nLo; n <= nHi; n++) {
    for (let i = 1; i <= 9; i++) {
      assert.ok(dx(gLo, i) > 0, `★하한 ${gLo} · n=${n} · i=${i} 에서 ★dx=${dx(gLo, i)} ≤ 0 — 완전히 가려진다`);
      assert.ok(dx(ABS, i) <= 0, `★절대 하한 ${ABS} · i=${i} 에서 ★dx=${dx(ABS, i)} > 0 — 그 수가 절대 하한이 아니다`);
    }
  }
  /* ★음성대조 — 「n 무관」이 ★참이라면 ★dx 식에 ★n 이 ★안 들어간다 */
  assert.doesNotMatch(SRC, /const dx = [^;]*\bn\b/,
    '★dx 식이 n 을 쓴다 — 「절대 하한이 n 무관」이 깨진다');
  assert.ok(gHi > 0, `★상한이 ${gHi} — 양수여야 한다(벌리는 쪽)`);
});

/* ─────────────────────────────────────────────
   ⒝ ★하한에서 ★겹치는 조합이 ★실재한다 — ★겹침은 ★이 기능의 ★뜻이다
   (★Q1 의 ⒟ 와 ★같은 꼴 — 검사가 스스로 그 뜻을 말한다)
   ⇐ 되돌리면 빨강: 하한을 0 이상으로 올리면(겹침을 금지하면) 터진다.
   ───────────────────────────────────────────── */
test('⒝ ★하한에서 ★겹치는 조합이 ★실재한다 (★겹침은 ★요청의 뜻이다)', () => {
  const W = num('STAR_VB_W'), gLo = num('STAR_GAP_MIN');
  const nLo = num('STAR_MIN'), nHi = num('STAR_MAX');
  const CX = Number(RAW.match(/const CX = ([\d.]+)/)[1]);
  const CY = Number(RAW.match(/, CY = ([\d.]+)/)[1]);
  const RO = Number(RAW.match(/R_OUT = ([\d.]+)/)[1]);
  const RI = Number(RAW.match(/R_IN = ([\d.]+)/)[1]);
  const r2 = (v) => Math.round(v * 100) / 100;
  const widthOf = (n) => {
    const xs = [];
    for (let i = 0; i < n * 2; i++) xs.push(r2(CX + (i % 2 === 0 ? RO : RI) * Math.cos(-Math.PI / 2 + i * Math.PI / n)));
    return r2(Math.max(...xs) - Math.min(...xs));
  };
  const overlapping = [], apart = [];
  for (let n = nLo; n <= nHi; n++) {
    const dx = W + gLo;                       // 이웃 별 사이 거리
    (dx < widthOf(n) ? overlapping : apart).push(n);
  }
  assert.ok(overlapping.length > 0,
    `★하한 ${gLo} 에서 ★겹치는 n 이 ★0개다 — 겹침이 사라졌다면 ★하한이 올라간 것이다`);
  /* ★음성대조 — ★간격 0(옛 동작)에서는 ★아무도 ★안 겹친다(그 자가 산다는 증인) */
  const none = [];
  for (let n = nLo; n <= nHi; n++) if (W + 0 < widthOf(n)) none.push(n);
  assert.deepStrictEqual(none, [],
    `★간격 0 인데 ★겹치는 n 이 ${none.length}개다 — 이 자가 ★늘 참이라 아무것도 안 가른다`);
  console.log(`  ⒝ ★실측 — 하한 ${gLo} 에서 겹치는 n = ★${overlapping.length}/${nHi - nLo + 1}개 (떨어진 n ${apart.length}개)`);
});

/* ─────────────────────────────────────────────
   ⒞ ★Q2 ★«미설정 = 옛 별» — ★이 레포의 선례와 ★같은 꼴
   ⇐ 되돌리면 빨강: 기본값을 숫자로 두면(미설정 특례를 없애면) 터진다.
   ───────────────────────────────────────────── */
test('⒞ ★통통함은 ★«미설정 = 옛 별»이다 · 범위 15~95', () => {
  assert.strictEqual(num('STAR_INNER_MIN'), 15, '★통통함 하한이 15 가 아니다');
  assert.strictEqual(num('STAR_INNER_MAX'), 95, '★통통함 상한이 95 가 아니다');
  assert.strictEqual(num('STAR_INNER_DISPLAY'), 40, '★슬라이더 초기 표시가 40 이 아니다');

  /* ★★미설정이 ★null 로 떨어진다 — ★★«불러서» 잰다(⛔소스 정규식은 둘째 return null 에 속는다) */
  for (const v of [undefined, null, '']) {
    assert.strictEqual(clampStarInner(v), null,
      `★clampStarInner(${JSON.stringify(v)}) 가 ${JSON.stringify(clampStarInner(v))} 다 — ★미설정은 ★null 이어야 한다(「미설정 = 옛 별」)`);
  }
  /* ★음성대조 — ★설정된 값은 ★숫자로 온다(이 자가 ★늘 null 을 보는 게 아니다) */
  assert.strictEqual(clampStarInner(40), 40, '★설정값 40 이 40 으로 안 온다 — 이 자가 죽었다');
  assert.strictEqual(clampStarInner(1), 15, '★하한 클램프가 안 산다');
  assert.strictEqual(clampStarInner(999), 95, '★상한 클램프가 안 산다');

  /* ★★그리고 ★그 null 이 ★«옛 별»을 ★실제로 낸다 — ★행위로 */
  const OLD = RAW.match(/const OLD_POINTS = '([^']+)'/)[1];
  assert.strictEqual(starPoints(5), OLD, '★미설정 ＋ n=5 가 ★옛 문자열이 아니다');
  assert.strictEqual(starPoints(5, undefined), OLD, '★inner=undefined 가 ★옛 문자열이 아니다');
  assert.notStrictEqual(starPoints(5, 40), OLD,
    '★inner=40 인데도 ★옛 문자열이 나온다 — ★설정값이 ★안 먹는다(조용한 반쪽 동작)');
  /* ★★그 null 이 ★옛 특례로 간다 */
  assert.match(SRC, /if \(ip === null && k === 5\) return OLD_POINTS;/,
    '★미설정 ＋ n=5 에서 OLD_POINTS 를 안 돌려준다 — 옛 별이 깨진다');
  assert.match(SRC, /if \(ip === null && k === 5\) return OLD_CLIP;/,
    '★clipPath 쪽 옛 특례가 없다 — 이미지 채우기 모양이 옛 별과 갈린다');
  /* ★DISPLAY 가 ★dataset 기본값으로 ★새지 않았나 — ⛔그러면 미설정이 사라진다 */
  assert.doesNotMatch(SRC, /dataset\.starInner\s*\|\|\s*STAR_INNER_DISPLAY/,
    '★STAR_INNER_DISPLAY 가 dataset 기본값으로 쓰였다 — 「미설정 = 옛 별」이 깨진다');

  /* ★★간격도 ★행위로 — ★count=1 이면 ★gap 과 ★무관하다(옛 바이트 규율) */
  assert.strictEqual(starPointsAt(5, 0, -150), starPoints(5),
    '★i=0 인데 ★간격이 좌표를 옮겼다 — 첫 별은 늘 제자리여야 한다');
  assert.strictEqual(starViewBox(1, -150), starViewBox(1),
    '★count=1 인데 ★간격이 viewBox 를 바꿨다 — 옛 저장본과 ★바이트가 갈린다');
  assert.notStrictEqual(starViewBox(2, -150), starViewBox(2),
    '★count=2 인데 ★간격이 viewBox 를 ★안 바꿨다 — 간격이 ★조용히 안 먹는다');

  /* ★0.26px 의 까닭이 ★머리말에 ★적혀 있나 — ★미설정/설정 경계를 설명하는 자리다 */
  assert.match(RAW, /0\.26px/,
    '★「40 으로 움직이면 0.26px 달라진다」가 머리말에서 사라졌다 — 그 경계를 설명할 자리가 없다');
});

/* ─────────────────────────────────────────────
   ⒟ ★패널 — 두 슬라이더 · ★간격은 ★갯수>1 일 때만
   ⇐ 되돌리면 빨강: 슬라이더를 빼거나, 간격을 갯수 1 에서도 그리면 터진다.
   ───────────────────────────────────────────── */
test('⒟ ★패널에 두 슬라이더 · ★간격은 ★갯수>1 일 때만 (⛔조용히 아무 일 없음을 안 만든다)', () => {
  assert.match(PANEL, /id="shape-star-inner-slider"[^>]*min="\$\{STAR_INNER_MIN\}" max="\$\{STAR_INNER_MAX\}"/,
    '★통통함 슬라이더가 없거나 min/max 가 정본에서 안 온다');
  assert.match(PANEL, /id="shape-star-gap-slider"[^>]*min="\$\{STAR_GAP_MIN\}" max="\$\{STAR_GAP_MAX\}"/,
    '★간격 슬라이더가 없거나 min/max 가 정본에서 안 온다');

  /* ★★간격 줄이 ★starCount > 1 조건 ★안에 있나 — ★갯수 1 이면 dx=0 이라 ★조용히 아무 일도 안 난다 */
  const gi = PANEL.indexOf('id="shape-star-gap-slider"');
  const cond = PANEL.lastIndexOf('${starCount > 1 ?', gi);
  assert.ok(cond > 0 && gi - cond < 700,
    '★간격 줄이 starCount > 1 조건 안에 없다 — 갯수 1 에서 ★조용히 아무 일 없음이 된다');

  /* ★★_applyStarGeom 이 ★서명을 ★안 늘렸다 — ★오늘 배운 함정을 피한 자리다 */
  assert.match(PANEL, /const _applyStarGeom = \(\) =>/,
    '★_applyStarGeom 이 인자를 받는다 — 서명을 늘리면 그걸 닻으로 쓰는 검사가 ★조용히 눈이 먼다');
  /* ★그리고 ★dataset 에서 ★넷을 읽는다 */
  for (const k of ['starPoints', 'starCount', 'starGap', 'starInner']) {
    assert.match(PANEL, new RegExp(`block\\.dataset\\.${k}`),
      `★_applyStarGeom 이 dataset.${k} 를 안 읽는다`);
  }
});
