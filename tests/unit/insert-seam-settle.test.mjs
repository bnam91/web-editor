/* ══════════════════════════════════════════════════════════════════════════
   insert-seam-settle — T-131 ⒜ 「삽입 뒤 «정착»이 ⌘Z 한 칸을 늘리던 자리」 잠금
   ──────────────────────────────────────────────────────────────────────────
   무슨 일이 있었나 (2026-09-21 화면 실측, 포트 9581 = 고친 브랜치 8f3cc6c):
     블럭을 «섹션 경계를 넘게» 삽입하면 ⌘Z 가 «두 번»이 됐다(대조: 섹션 «안쪽» 삽입은 한 번).
       확대 2 · 목업 2  ↔  대조(안쪽) 전부 1
     까닭은 삽입 «직후»에 찍은 끝 표본과 «정착 뒤» 라이브 문자열이 어긋나서,
     undo 첫 스텝의 ensureHistoryCheckpoint 가 「현재 상태」 한 칸을 더 만든 것.

   ★어긋나는 «뿌리»가 둘이고 약도 둘이다 — 하나로 둘 다 닫지 마라.
     ⑵ 목업 = 「값(--sec-clip)이 rAF 로 «늦게» 박힌다」      → 약 ㉡ (비교자가 그 값을 벗긴다)
     ⑶ 확대 = 「값은 같은데 «표기»가 다시 쓰인다」            → 약 ㉰ (만든 직후 CSSOM 으로 재운다)
       앞: style="left:-14.00px;top:-14.00px;..."   뒤: style="left: -14px; top: -14px; ..."
       ⛔값을 "-14px" 로 고쳐 써도 «띄어쓰기»가 달라진다 — 그래서 ㉮(값 정규화)는 기각됐다.

   이 파일은 그 둘이 «되돌아오면 빨강»이 되게 한다. 행동(⌘Z 횟수)은 앱이 필요해 여기서 못 잰다 —
   여기서는 «약이 제자리에 있는가»만 소스로 잠근다. 행동 실측은 화면 검수에 남는다.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');

const HISTORY = read('js', 'history.js');
const ZOOMBLK = read('js', 'blocks', 'zoom-block.js');
const ZOOMGEO = read('js', 'blocks', 'zoom-geometry.js');

/* ── 약 ㉡ — 비교자 ────────────────────────────────────────────────────── */

test('SEAM-1 _NON_EDIT_ATTR_RE 가 --sec-clip 을 «같이» 벗긴다', () => {
  const m = HISTORY.match(/const _NON_EDIT_ATTR_RE = (\/.*\/g);/);
  assert.ok(m, '★_NON_EDIT_ATTR_RE 를 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  assert.match(m[1], /--sec-clip/,
    '★--sec-clip 이 비교자에서 빠졌다 — 목업을 섹션 경계 넘게 삽입하면 ⌘Z 가 두 번이 된다(T-131 ⒜⑵)');
});

test('SEAM-2 ★그 정규식이 «실제로» --sec-clip 선언만 지운다 (문장이 아니라 동작을 잰다)', () => {
  const m = HISTORY.match(/const _NON_EDIT_ATTR_RE = \/(.*)\/g;/);
  const re = new RegExp(m[1], 'g');
  const a = '<div style="left: 4px; --sec-clip: inset(1px 0px 0px 2px); top: 3px"></div>';
  const b = '<div style="left: 4px; top: 3px"></div>';
  assert.equal(a.replace(re, ''), b.replace(re, ''),
    '★선언을 벗겨도 두 문자열이 같아지지 않는다 — 정규식이 그 꼴을 못 잡는다');
  /* ★음성대조 — «값이 진짜 다른» 편집까지 같다고 말하면 안 된다 */
  const c = '<div style="left: 9px; top: 3px"></div>';
  assert.notEqual(b.replace(re, ''), c.replace(re, ''),
    '★left 가 다른데 «같다»고 한다 — 너무 많이 벗긴다(그 값만 다른 편집의 undo 한 칸이 사라진다)');
});

test('SEAM-3 ensureHistoryCheckpoint 가 pushHistory 와 «같은 잣대»를 쓴다', () => {
  const i = HISTORY.indexOf('function ensureHistoryCheckpoint');
  assert.ok(i > 0, '★ensureHistoryCheckpoint 를 못 찾았다 — 검사가 안 돈 것이다');
  const body = HISTORY.slice(i, i + 2200);
  assert.match(body, /_sameEdit\(\s*historyStack\[historyPos\]\?\.canvas\s*,\s*current\s*\)/,
    '★생문자열 !== 로 돌아갔다 — 두 차단의 엄격함 방향이 다시 반대가 되고 ⌘Z 한 칸이 되살아난다');
  assert.doesNotMatch(body, /historyStack\[historyPos\]\?\.canvas !== current/,
    '★옛 비교가 남아 있다');
});

/* ── 약 ㉰ — 표기 정규화 ──────────────────────────────────────────────── */

test('SEAM-4 renderZoomBlock 이 innerHTML «바로 뒤»에 표기를 재운다', () => {
  const i = ZOOMBLK.indexOf('block.innerHTML = buildZoomInner(');
  assert.ok(i > 0, '★innerHTML 대입을 못 찾았다 — 검사가 안 돈 것이다');
  const after = ZOOMBLK.slice(i, i + 260);
  assert.match(after, /_normalizeInlineStyles\(block\)/,
    '★정규화 호출이 사라졌다 — 확대 블럭을 섹션 경계 넘게 삽입하면 ⌘Z 가 두 번이 된다(T-131 ⒜⑶)');
  assert.match(ZOOMBLK, /el\.style\.cssText = el\.style\.cssText/,
    '★«읽어서 되쓰기»가 사라졌다 — 값을 바꾸지 않고 표기만 재우는 것이 이 약의 전부다');
});

/* ★짝 검사 — 우회로가 새 사각지대를 만들면 그 자리도 같이 잰다.
   ㉰ 는 「buildZoomInner 가 «생 문자열 style» 로 만드는 자리」만 덮는다. 그 자리가 늘면
   정규화 목록도 같이 늘어야 한다. 늘지 않으면 «덮인 줄 알고» 지나간다. */
test('SEAM-5 ★생 문자열 style= 을 만드는 자리가 늘면 정규화 목록도 같이 는다', () => {
  const cls = new Set();
  const re = /<div class="([a-z0-9-]+)" style="/g;
  let m;
  while ((m = re.exec(ZOOMGEO))) cls.add(m[1]);
  assert.ok(cls.size > 0,
    '★생 문자열 style= 을 «하나도» 못 찾았다 — 명부 grep 이 죽었다(0건을 통과로 읽지 마라)');
  assert.deepEqual([...cls].sort(), ['zoom-bg', 'zoom-clip'],
    '★zoom-geometry.js 의 «생 문자열 style» 자리가 바뀌었다 — ' +
    'js/blocks/zoom-block.js 의 _normalizeInlineStyles 선택자도 같이 고쳐라');
  const sel = ZOOMBLK.match(/querySelectorAll\('([^']*)'\)/);
  assert.ok(sel, '★정규화 선택자를 못 찾았다');
  for (const c of cls) {
    assert.ok(sel[1].includes('.' + c),
      `★.${c} 가 정규화 선택자에 없다 — 그 층은 표기가 계속 다시 쓰인다`);
  }
});

test('SEAM-6 ★SVG 속성은 이 병이 «아니다» — 여기까지 넓히지 않았는지 본다', () => {
  /* CSSOM 은 SVG presentation 속성(width=·viewBox= 등)을 다시 쓰지 않는다.
     정규화 대상이 .zoom-svg 같은 SVG 층까지 넓어지면 «고치는 범위»를 잘못 읽은 것이다. */
  const sel = ZOOMBLK.match(/querySelectorAll\('([^']*)'\)/)[1];
  assert.doesNotMatch(sel, /svg/i,
    '★정규화 대상이 SVG 층까지 넓어졌다 — 이 병은 style 속성의 «재직렬화»이지 SVG 속성이 아니다');
});
