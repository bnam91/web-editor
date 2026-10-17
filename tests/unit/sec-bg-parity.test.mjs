/* sec-bg-parity.test.mjs — 1017t1k1·k2 「배경이미지 편집을 에셋블럭과 동등하게」의 ★배선을 ★재는 자.
 *
 * ★현빈 원문(1017t1) — 「에셋블럭의 이미지 편집하는 것과 ★기능이 같아야 사람들이 헷갈리지 않을 것」
 *   ⇒ k1 회전존, k2 색보정 패널이 배경이미지 편집에도 떠야 한다.
 *
 * ★★이 파일이 ★잠그는 것(⛔「고쳤다」가 아니라 ★어긋나면 빨개질 자리):
 *   P1 ★배경 편집은 noRotate·noColorAdjust 를 ★안 넘긴다(★음성대조 — 그리드 크롭은 ★여전히 넘긴다)
 *   P2 ★ADJ_TARGET_SEL 정의가 ★한 곳이고 `.sec-bg-img` 를 ★포함 ·  손으로 베낀 리터럴 ★0건
 *   P3 ★`needsBgLayer` 판정이 ★한 자리(정의 1) · 호출자 수(★실측)
 *   P4 ★`.sec-bg-img`/`.sec-bg-clip` 이 EDITOR_ONLY_SEL(배송본 제거 대상) ★어디에도 안 걸린다
 *
 * ★★안 재는 것 — ★레이어가 ★실제로 회전·필터를 ★그리나(★그건 DOM 의 몫. tests/dom/sec-bg-parity.dom.spec.js)
 *
 * 실행: node --test tests/unit/sec-bg-parity.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
const req = createRequire(import.meta.url);
const { readSrc } = req('./_srcread.js');
const { stripCommentsTA, templateBalanced } = req('./_strip-comments.js');
import path from 'node:path';
import { readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const code = (p) => {
  const src = readSrc(ROOT, p);
  assert.equal(templateBalanced(src), true, `★전제: ${p} 의 템플릿이 ★안 닫혔다`);
  return stripCommentsTA(src);
};

/** 소스 문자열에서 `needle(` 로 시작하는 함수 선언의 본문 { … } 을 균형 괄호로 잘라낸다. */
function sliceFnBody(src, needle) {
  const i = src.indexOf(needle);
  assert.ok(i >= 0, `★${needle} 을 못 찾았다`);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k + 1; break; } }
  }
  return src.slice(i, j);
}

const IH  = 'js/image-handling.js';
const ICA = 'js/image-color-adjust.js';
const BGL = 'js/bg-layer.js';
const CSC = 'js/io/export-css-collect.js';

/* ══ P1 ══════════════════════════════════════════════════════════════════ */

test('P1 ★배경이미지 편집(_enterBgEditMode)은 noRotate·noColorAdjust 를 ★0건 넘긴다', () => {
  const c = code(IH);
  const bgBody = sliceFnBody(c, 'function _enterBgEditMode(');
  assert.equal((bgBody.match(/noRotate\s*:/g) || []).length, 0, '★배경 편집에 noRotate 가 남아 있다');
  assert.equal((bgBody.match(/noColorAdjust\s*:/g) || []).length, 0, '★배경 편집에 noColorAdjust 가 남아 있다');
  /* ★음성대조 — 같은 파일 ★그리드 칸 크롭(enterGridImageEditMode)에는 ★여전히 1건씩 남아 있다.
     ⛔음성 없이 양성만 두면 ★전역 삭제(크롭 쪽까지 지움)가 ★초록으로 통과한다. */
  const gridBody = sliceFnBody(c, 'function enterGridImageEditMode(');
  assert.equal((gridBody.match(/noRotate\s*:/g) || []).length, 1, '★그리드 크롭의 noRotate 가 사라졌다(별건 — 지우면 안 된다)');
  assert.equal((gridBody.match(/noColorAdjust\s*:/g) || []).length, 1, '★그리드 크롭의 noColorAdjust 가 사라졌다(별건 — 지우면 안 된다)');
  /* ⇒ 「둘 다 지웠다」가 아니라 «배경 쪽만 켰다»를 — 파일 전체로도 각 리터럴이 정확히 1건(그리드 크롭분)뿐이다 */
  assert.equal((c.match(/noRotate\s*:\s*true/g) || []).length, 1, '★파일 전체에서 noRotate:true 가 1건이 아니다');
  assert.equal((c.match(/noColorAdjust\s*:\s*true/g) || []).length, 1, '★파일 전체에서 noColorAdjust:true 가 1건이 아니다');
});

/* ══ P2 ══════════════════════════════════════════════════════════════════ */

test('P2 ★ADJ_TARGET_SEL — 정의 1개 · `.sec-bg-img` 포함 · 손으로 베낀 리터럴 0건', () => {
  const c = code(ICA);
  const defs = [...c.matchAll(/const\s+ADJ_TARGET_SEL\s*=\s*'([^']+)'/g)];
  assert.equal(defs.length, 1, '★ADJ_TARGET_SEL 정의가 1개가 아니다');
  const sel = defs[0][1];
  assert.match(sel, /\.sec-bg-img\b/, '★ADJ_TARGET_SEL 에 `.sec-bg-img` 가 없다');
  /* ★음성대조 — ★더하면서 ★기존 대상을 ★떨어뜨리지 않았나 */
  assert.match(sel, /\.cvb-card-img\b/, '★카드 배경이미지 div 를 ★떨어뜨렸다');
  assert.match(sel, /\.comparison-block\s+\.cmp-img\b/, '★비교 칸 이미지 div 를 ★떨어뜨렸다');
  assert.match(sel, /\.asset-img\b/, '★에셋 이미지를 ★떨어뜨렸다');
  /* ★★손으로 베낀 리터럴 — ★이 술어를 ★그대로 ★다시 적은 자리가 ★js/ 전수에 있으면 ★다음에
     대상이 늘 때 ★한쪽만 안 따라온다(머리말의 그 사고). */
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.isDirectory()) walk(d + '/' + e.name);
      else if (e.name.endsWith('.js')) files.push(d + '/' + e.name);
    }
  };
  walk('js');
  const copies = files.filter((f) => readSrc(ROOT, f).includes(`'${sel}'`));
  assert.deepEqual(copies, ['js/image-color-adjust.js'], `★ADJ_TARGET_SEL 리터럴이 ★손으로 베껴진 자리가 있다: ${copies.join(', ')}`);
});

/* ══ P3 ══════════════════════════════════════════════════════════════════ */

test('P3 ★needsBgLayer — 정의 1개(js/bg-layer.js) · 호출자 수(실측)', () => {
  const bgl = code(BGL);
  assert.equal((bgl.match(/export function needsBgLayer\(/g) || []).length, 1,
    '★needsBgLayer 정의가 js/bg-layer.js 에 1개가 아니다 — ★판정이 ★한 자리가 아니게 됐다');
  /* ★다른 파일에 ★제 벌 정의가 ★없다(판정이 ★★진짜 한 자리인지) */
  for (const f of ['js/image-handling.js', 'js/props/prop-section.js', 'js/frame-bg.js']) {
    const s = code(f);
    assert.equal((s.match(/function needsBgLayer\(/g) || []).length, 0,
      `★${f} 에 needsBgLayer 가 ★제 벌로 또 정의돼 있다`);
  }
  /* ★호출자 수 — ★정의 자리(이 파일들)에서 ★직접 센다. ⛔맨숫자로 적지 않는다 —
     2026-10-17 실측: js/frame-bg.js 2 · js/image-handling.js 1 · js/props/prop-section.js 1 = ★4. */
  const CONSUMERS = ['js/frame-bg.js', 'js/image-handling.js', 'js/props/prop-section.js'];
  let total = 0;
  const perFile = {};
  for (const f of CONSUMERS) {
    const n = (code(f).match(/\bneedsBgLayer\(/g) || []).length;
    perFile[f] = n;
    total += n;
  }
  assert.equal(total, 4, `★needsBgLayer 호출자 수가 ★실측 4와 다르다(지금: ${JSON.stringify(perFile)})`);
});

/* ══ P4 ══════════════════════════════════════════════════════════════════ */

test('P4 ★.sec-bg-img/.sec-bg-clip 이 EDITOR_ONLY_SEL(배송본 제거 대상) 어디에도 안 걸린다', () => {
  const c = code(CSC);
  const m = c.match(/const\s+EDITOR_ONLY_SEL\s*=\s*new\s+RegExp\(\s*\[([\s\S]*?)\]/);
  assert.ok(m, '★EDITOR_ONLY_SEL 정의를 못 찾았다');
  // ★raw 소스의 `\\`(두 글자)는 JS 문자열 리터럴에서 «이스케이프된 한 글자 백슬래시」다 —
  //   그대로 RegExp 에 넘기면 두 배로 읽혀 `\\.` 가 "리터럴 \ + 와일드카드" 로 깨진다(★실측으로 잡음).
  const pieces = [...m[1].matchAll(/'((?:[^'\\]|\\.)*)'/g)].map(x => x[1].replace(/\\\\/g, '\\'));
  assert.ok(pieces.length > 0, '★EDITOR_ONLY_SEL 조각을 하나도 못 읽었다');
  const re = new RegExp(pieces.join('|'));
  assert.equal(re.test('.sec-bg-img'), false, '★.sec-bg-img 가 EDITOR_ONLY_SEL 에 걸린다 — 배송본에서 배경이 빠진다');
  assert.equal(re.test('.sec-bg-clip'), false, '★.sec-bg-clip 이 EDITOR_ONLY_SEL 에 걸린다 — 배송본에서 배경이 빠진다');
  /* ★음성대조 — 같은 자로 .sec-bg-proxy 를 재면 ★걸린다(= 자가 살아 있다 · 거짓양성 방지) */
  assert.equal(re.test('.sec-bg-proxy'), true, '★전제 — .sec-bg-proxy 가 안 걸리면 이 자 자체가 무력화된 것이다');
});
