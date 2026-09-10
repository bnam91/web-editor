/* P — 「섹션 밖으로 나가는 블록」이 «전부» 크롭을 받는가.
 *
 * ★이 검사가 지키는 한 줄
 *   내보낸 PNG 는 «섹션 상자 크기»로 고정이다(현빈 확정 · UI 문구에도 적혀 있다:
 *   js/props/prop-section.js 「내보내기 PNG는 항상 섹션 크기로 잘림」).
 *   그래서 캔버스도 «같은 선»에서 잘라야 둘이 어긋나지 않는다 — 그 크롭이 --sec-clip 이다.
 *   ⇒ 「플로팅 블록인데 크롭이 없다」가 생기는 순간, 캔버스는 보여 주고 PNG 는 못 담는다.
 *
 * ★★왜 픽셀 게이트(js/io/export-gate.js)가 이걸 «못 잡는가»
 *   게이트는 export 그림과 truth 그림을 견준다. 그런데 «둘 다» 같은 섹션 높이로 잘린다.
 *   ⇒ 크롭이 빠진 블록이 새로 생겨도 diff 0 ⇒ PASS. 게이트를 믿고 넘어가면 그대로 나간다.
 *   이 검사는 그림을 안 본다 — «명부와 성질이 맞는가»를 소스에서 잰다. 다른 자다.
 *
 * ★분모를 «기계»가 정한다 (⛔손으로 적은 명부 금지)
 *   플로팅은 «성질»이다: 블록 팩토리가 dataset.x / dataset.y 에 좌표를 쓴다
 *   (js/blocks/zoom-block.js 「스티커와 «같은 규약»(dataset.x/y + style.left/top)」).
 *   ⇒ 오늘의 셋(sticker·zoom·gradient)을 «세지 않는다». js/blocks/ 를 훑어 성질로 뽑는다.
 *     네 번째 플로팅 블록이 생기는 날, 분모가 «스스로» 늘어 이 검사가 빨개진다.
 *
 * 실측(2026-09-09 · HEAD 3a1d8a8 · 앱 9368 · 네이티브 CDP · 라이브 A/B 픽셀차):
 *   섹션 283px 에 A4 줌블럭(260×368 · y=40 ⇒ 아래로 125px 초과)을 놓았을 때
 *     라이브 캔버스 잉크 행 40..282 · PNG(860×283) 잉크 행 40..282  ⇒ ★잃은 행 0
 *   스티커(60×60 · y=263 ⇒ 40px 초과): 캔버스 잉크 860px · PNG 잉크 860px ⇒ ★비 1.0000
 *   ⇒ 크롭이 «걸려 있는 한» 캔버스와 PNG 는 같은 선에서 끝난다. 이 검사는 그 «걸려 있음»을 지킨다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const BLOCKDIR = path.join(ROOT, 'js/blocks');

/** 주석을 걷어낸 «코드»만 본다 — 주석에 적힌 `dataset.x` 를 «좌표를 쓴다»로 세면 안 된다.
 *  (export-channel-roster 와 같은 규율. 여기선 블록/라인 주석만 걷으면 충분하다.) */
function codeOf(rel) {
  return readSrc(ROOT, rel)
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .split('\n').map(l => l.replace(/\/\/.*$/, '')).join('\n');
}

/** 파일이 정의하는 블록의 CSS 클래스 — `className = 'xxx-block'` 에서 뽑는다. */
function blockClassOf(code) {
  const m = /className\s*=\s*['"]([a-z0-9-]*-block)['"]/i.exec(code);
  return m ? m[1] : null;
}

/* ── 분모: «플로팅 블록 전수» — 성질(dataset.x/y 에 좌표를 쓴다)로 뽑는다 ───────────── */
const FLOATING = [];
for (const f of fs.readdirSync(BLOCKDIR).filter(n => n.endsWith('.js')).sort()) {
  const rel = 'js/blocks/' + f;
  const code = codeOf(rel);
  // 「좌표를 «쓴다»」 — 읽기(parseInt(d.x))가 아니라 대입이 있어야 팩토리다.
  const writesX = /\.dataset\.x\s*=/.test(code);
  const writesY = /\.dataset\.y\s*=/.test(code);
  if (writesX && writesY) FLOATING.push({ file: rel, cls: blockClassOf(code), code });
}

/* ── 명부①: CSS 의 --sec-clip 규칙이 «누구에게» 걸려 있나 ───────────────────────── */
const CSSFILE = 'css/editor-blocks.css';
const cssSrc = readSrc(ROOT, CSSFILE).replace(/\/\*[\s\S]*?\*\//g, '');
function secClipSelectors(src) {
  const out = [];
  const re = /([^{}]+)\{[^{}]*clip-path:\s*var\(\s*--sec-clip[^{}]*\}/g;
  let m;
  while ((m = re.exec(src))) for (const s of m[1].split(',')) { const t = s.trim(); if (t) out.push(t); }
  return out;
}
const SEC_CLIP_SELECTORS = secClipSelectors(cssSrc);

/** 이 블록 클래스가 크롭을 받나 — 두 갈래 중 «하나라도» 있으면 받는다.
 *    ㉠ CSS 의 --sec-clip 규칙 셀렉터에 그 클래스가 들어 있다(sticker·mockup·zoom)
 *    ㉡ 블록이 «스스로» 섹션 상자에 맞춰 clipPath 를 계산한다(gradient)
 *  ⚠️둘을 «하나로 합치라»는 뜻이 아니다 — 지금 실제로 둘인 것을 있는 그대로 센다.
 *    합치는 건 별개 작업이고, 그때 이 함수가 같이 바뀌면 된다. */
function cropOf(entry, selectors) {
  if (entry.cls && selectors.some(s => s.includes('.' + entry.cls))) return 'css:--sec-clip';
  // 섹션 상자(secW/secH 또는 clientWidth/clientHeight)를 기준으로 clipPath 를 짜는가
  if (/clipPath/.test(entry.code) && /(offsetWidth|offsetHeight|clientWidth|clientHeight)/.test(entry.code)
      && /closest\(\s*['"]\.section-block['"]\s*\)/.test(entry.code)) return 'js:clipPath';
  return null;
}

/* ══════════════════════════════════════════════════════════════════════════ */

test('P4 「입력이 살아 있다」 — 분모도 명부도 «실제로» 뽑혔다', () => {
  // ★이게 없으면 정규식이 아무것도 못 뽑았을 때 P1·P2 가 «공집합으로» 통과한다.
  assert.ok(FLOATING.length >= 3,
    `플로팅 블록을 ${FLOATING.length}개밖에 못 뽑았다 — 성질 탐지(dataset.x/y 대입)가 죽었다`);
  for (const e of FLOATING) {
    assert.ok(e.cls, `${e.file}: 블록 CSS 클래스를 못 뽑았다 — className 대입 형태가 바뀌었나`);
  }
  assert.ok(SEC_CLIP_SELECTORS.length >= 1,
    `${CSSFILE} 에서 --sec-clip 규칙을 하나도 못 찾았다 — 크롭 명부 파싱이 죽었다`);
});

test('P1 ★플로팅 블록은 «전부» 섹션 크롭을 받는다 (캔버스와 PNG 가 같은 선에서 끝난다)', () => {
  const missing = FLOATING.filter(e => !cropOf(e, SEC_CLIP_SELECTORS));
  assert.deepEqual(missing.map(e => e.file), [],
    '섹션 크롭이 «없는» 플로팅 블록이 있다. 이 블록은 캔버스엔 섹션 밖까지 그려지는데 ' +
    'PNG 는 섹션 상자 크기라 그만큼 «조용히» 사라진다(픽셀 게이트는 못 잡는다 — 둘 다 같이 잘리니 diff 0). ' +
    `⇒ css/editor-blocks.css 의 --sec-clip 규칙에 셀렉터를 넣거나, 블록이 스스로 clipPath 를 계산해야 한다. ` +
    `전수 ${FLOATING.length}개 중 빠진 것: ` + missing.map(e => e.cls || e.file).join(', '));
});

test('P2 [양성대조] 명부에서 «하나만» 빼면 이 검사는 실제로 빨개진다', () => {
  // ★검사가 「빨개질 수 있는가」를 검사가 스스로 증명한다.
  //   빼는 대상은 «CSS 명부로 덮인» 블록 하나 — JS 자체 클립을 가진 블록을 빼면 안 변한다.
  const viaCss = FLOATING.filter(e => cropOf(e, SEC_CLIP_SELECTORS) === 'css:--sec-clip');
  assert.ok(viaCss.length >= 1, 'CSS 명부로 덮인 플로팅 블록이 하나도 없다 — 양성대조를 걸 자리가 없다');

  const victim = viaCss[0];
  const mutated = SEC_CLIP_SELECTORS.filter(s => !s.includes('.' + victim.cls));
  assert.notDeepEqual(mutated, SEC_CLIP_SELECTORS, '변이가 실제로 명부를 줄이지 못했다');

  const missing = FLOATING.filter(e => !cropOf(e, mutated));
  assert.ok(missing.some(e => e.cls === victim.cls),
    `.${victim.cls} 를 명부에서 뺐는데도 «빠졌다»고 말하지 않는다 — P1 은 통과만 하는 검사다`);
});

test('P3 ★크롭이 걸리는 «자리»가 그려지는 층이다 — 줌블럭은 블록이 아니라 .zoom-clip 이다', () => {
  /* 확대블럭은 블록 상자가 «도형»이라 거기 클립을 걸면 ①평상시 값이 0 이라 안 잘리고
     ②잘리는 순간 그림자가 도형 경계에서 끊긴다(js/blocks/zoom-geometry.js buildZoomInner 주석).
     ⇒ 그리는 층(.zoom-clip)에 걸어야 한다. 이 줄이 «블록»으로 되돌아가면 조용히 안 잘린다. */
  const zoomSel = SEC_CLIP_SELECTORS.filter(s => s.includes('.zoom-block'));
  assert.ok(zoomSel.length >= 1, '--sec-clip 명부에 확대블럭이 없다');
  for (const s of zoomSel) {
    assert.match(s, /\.zoom-block\s*>\s*\.zoom-clip/,
      `확대블럭의 크롭이 «그리는 층»이 아니라 블록 상자에 걸렸다: ${s}`);
  }
});

test('P5 「PNG 는 섹션 상자 크기」라는 결정이 UI 문구와 «같이» 산다', () => {
  /* ★이건 코드 규율이 아니라 «약속»의 못이다. 내보내기 높이를 섹션 밖까지 늘리는 변경은
     이 문구를 «같이» 고쳐야 한다 — 안 그러면 앱이 사용자에게 거짓말을 한다.
     (2026-09-09: 「PNG 가 넘친 만큼 담게 하라」는 요청이 실제로 들어왔고, 실측 결과
      캔버스가 이미 같은 선에서 자르고 있어 «담을 것이 없었다» — 그 판정의 근거가 이 문구다.) */
  const props = readSrc(ROOT, 'js/props/prop-section.js');
  assert.match(props, /내보내기 PNG는 항상 섹션 크기로 잘림/,
    '섹션 속성 패널의 「내보내기 PNG는 항상 섹션 크기로 잘림」 문구가 사라졌다 — ' +
    '문구를 지웠다면 내보내기 높이 규칙도 같이 바뀐 것인지 확인해라(둘은 한 약속이다)');
});
