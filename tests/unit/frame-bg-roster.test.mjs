/* frame-bg-roster — ★프레임 배경에 ★«값을 넣는 자»가 ★★하나임을 ★잠근다. (2026-10-10 · 현빈 1009t3-③)
 *
 * ★★왜 — ★같은 일을 하는 ★빌더가 ★★세 벌이었고 ★★그 셋이 ★전부 ★«크기»를 ★안 보냈다:
 *     `js/props/prop-frame.js` `_syncFrameBgVars` · `js/block-factory.js` `_syncBgVars`
 *     · `js/io/save-load.js` `rebindAll` 안       ⇒ ★합 ★19 호출 · ★size 보내는 것 ★★0
 *   ⇒ ★프레임 배경은 ★★크기를 ★손댈 ★수단이 ★없었다(★현빈 ③ 의 그 증상).
 *   ★★그리고 ★block-factory 의 ★옛 주석이 ★스스로 ★「prop-frame ★미러」라 ★적고 있었다 —
 *     ★★«미러»라는 ★말이 ★곧 ★★«명부가 둘»이라는 ★자백이었다. ★주석으로는 ★안 막힌다 ⇒ ★파생으로 ★막는다.
 *
 * ★★결정적 대조 — ★★섹션은 ★기억하고 ★프레임은 ★상수였다(★지디가 찾았다):
 *     `js/io/save-load.js` ★섹션 : `sec.style.backgroundSize = sec.dataset.bgSize || 'cover'`  ← ★읽는다
 *     같은 파일     ★프레임: `ss.style.backgroundSize  = 'cover'`                       ← ★★상수
 *
 * ★이 파일이 ★잠그는 것 ★넷
 *   ⒜ ★공용 술어가 ★하나다(정의 1 · 소비자가 ★제 벌로 ★다시 세지 ★않는다)
 *   ⒝ ★`frameBgSize` 의 ★진리표(기본 `cover` · dataset 이 정본) ＋ ★★음성대조
 *   ⒞ ★CSS 가 ★그 변수를 ★★읽는다(⛔하드코딩 `cover` 로 ★돌아가면 ★빨강)
 *   ⒟ ★프레임 대상 ★`'cover'` ★상수가 ★0건
 * ⛔사본을 적지 않는다 — ★소스에서 ★진짜 함수를 ★떼어 싣는다.
 * 실행: node --test tests/unit/frame-bg-roster.test.mjs
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
const _req = createRequire(import.meta.url);
const { readSrc } = _req('./_srcread.js');
const { makeStripper } = _req('./_strip-comments.js');
const strip = (src) => { const s = makeStripper(); return src.split('\n').map(s).join('\n'); };

const SHARED = 'js/frame-bg.js';
/* ★소비자 명부 — ⛔손으로 늘려 ★빨강을 끄지 ★마라. ★늘리려면 ★그 자리가 ★무엇을 하는지 ★보고 넣어라 */
const CONSUMERS = ['js/props/prop-frame.js', 'js/block-factory.js', 'js/io/save-load.js'];

function loadFn(name) {
  const src = strip(readSrc(ROOT, SHARED));
  const i = src.indexOf(`export function ${name}(`);
  assert.ok(i >= 0, `★${name} 가 ${SHARED} 에 없다 — 이름이 바뀌었으면 이 검사도 옮겨라`);
  let j = src.indexOf('{', i), d = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') d++;
    else if (src[k] === '}') { d--; if (!d) { j = k + 1; break; } }
  }
  const ctx = vm.createContext({});
  for (const cm of src.matchAll(/^export\s+const\s+[A-Z_][A-Z0-9_]*\s*=[^;]+;/gm)) {
    vm.runInContext(cm[0].replace(/^export\s+/, ''), ctx);
  }
  vm.runInContext(src.slice(i, j).replace(/^export\s+/, ''), ctx);
  return ctx[name];
}
const el = (dataset) => ({ dataset });

/* ══ ⒝ 진리표 ═══════════════════════════════════════════════════════════ */

test('B1 ★`frameBgSize` — ★dataset 이 ★정본이고 ★없으면 ★`cover`', () => {
  const f = loadFn('frameBgSize');
  assert.equal(f(el({})), 'cover', '★없으면 기본 cover');
  assert.equal(f(el({ bgSize: 'contain' })), 'contain');
  assert.equal(f(el({ bgSize: '320px 180px' })), '320px 180px', '★위치편집 결과(px 쌍)도 그대로');
  /* ★★음성대조 — ★빈 값·없는 것을 ★«값»으로 ★읽으면 ★안 된다(★그러면 CSS 가 ★빈 size 를 받는다) */
  assert.equal(f(el({ bgSize: '' })), 'cover', '★빈 값은 ★기본으로 떨어진다');
  assert.equal(f(el({})), 'cover');
  assert.equal(f(null), 'cover', '★없는 것에서 던지지 말고 기본');
});

test('B2 ★`frameBgPos` — ★크기와 ★한 쌍이다(★두 벌로 갈리면 한쪽만 고쳐진다)', () => {
  const f = loadFn('frameBgPos');
  assert.equal(f(el({})), 'center');
  assert.equal(f(el({ bgPos: '10% 90%' })), '10% 90%');
  assert.equal(f(el({ bgPos: '' })), 'center');
});

/* ══ ⒞ CSS ≡ 공용 ══════════════════════════════════════════════════════ */

test('C1 ★★CSS 가 ★그 변수를 ★읽는다 — ⛔하드코딩 `cover` 로 돌아가면 ★여기가 빨개진다', () => {
  const css = readSrc(ROOT, 'css/editor-blocks.css').replace(/\/\*[\s\S]*?\*\//g, '');
  const m = css.match(/\.frame-block\.has-bg-opacity::before\s*\{([^}]*)\}/);
  assert.ok(m, '★`.frame-block.has-bg-opacity::before` 규칙을 못 찾았다 — 그리는 자가 바뀌었다');
  const body = m[1];
  assert.match(body, /background-size:\s*var\(--frame-bg-size/,
    '★★`background-size` 가 ★변수를 ★안 읽는다 — ★프레임 배경 크기가 ★다시 ★상수가 됐다');
  /* ★★같은 규칙의 ★나머지도 ★변수여야 한다(★하나만 상수면 ★그 하나가 ★또 구멍이 된다) */
  for (const prop of ['background-color', 'background-image', 'background-position']) {
    assert.match(body, new RegExp(`${prop}:\\s*var\\(--frame-bg`), `★${prop} 가 변수가 아니다`);
  }
});

test('C2 ★★공용 빌더가 ★그 변수를 ★★«보낸다» — ⛔이 칸이 없으면 ★C1 은 ★받는 쪽만 재고 ★★보내는 쪽은 ★안 잰다', () => {
  /* ★★내가 ★C1 을 세운 뒤 ★스스로 찾은 ★구멍이다: ★CSS 가 ★`var(--frame-bg-size)` 를 ★읽어도
     ★★공용 빌더가 ★그 변수를 ★안 보내면 ★★언제나 ★폴백(`cover`)이 쓰인다 ⇒ ★증상이 ★그대로다.
     ★★«받는 쪽»과 ★«보내는 쪽»은 ★다른 양이다 — ★둘 다 걸어야 ★한 쌍이 된다. */
  const shared = strip(readSrc(ROOT, SHARED));
  const i = shared.indexOf('export function syncFrameBgVars(');
  assert.ok(i >= 0, '★공용 빌더가 없다');
  let j = shared.indexOf('{', i), d = 0;
  for (let k = j; k < shared.length; k++) {
    if (shared[k] === '{') d++;
    else if (shared[k] === '}') { d--; if (!d) { j = k + 1; break; } }
  }
  const body = shared.slice(i, j);
  assert.match(body, /setProperty\(\s*'--frame-bg-size'\s*,\s*frameBgSize\(/,
    '★★공용 빌더가 ★`--frame-bg-size` 를 ★★안 보낸다 — ★CSS 가 읽어도 ★폴백만 쓰인다');
  /* ★★＋ ★네 칸 ★전부를 ★보내나(★하나 빠지면 ★그 하나가 ★또 구멍이 된다) */
  for (const v of ['--frame-bg', '--frame-bg-img', '--frame-bg-pos', '--frame-bg-size']) {
    assert.ok(body.includes(`'${v}'`), `★공용 빌더가 ★${v} 를 ★안 보낸다`);
  }
});

/* ══ ⒜ 임자는 하나 ＋ ⒟ 상수 0건 ═══════════════════════════════════════ */

test('A1 ★★«값을 넣는 자»는 ★하나다 — ★소비자가 ★제 벌로 ★다시 세지 않는다', () => {
  const shared = strip(readSrc(ROOT, SHARED));
  for (const n of ['frameBgSize', 'frameBgPos', 'syncFrameBgVars']) {
    assert.equal((shared.match(new RegExp(`function ${n}\\s*\\(`, 'g')) || []).length, 1,
      `★${n} 정의가 하나가 아니다`);
  }
  /* ★★소비자가 ★`--frame-bg*` 를 ★제 손으로 ★쓰나 — ★★`--frame-bg-opacity` 는 ★별 칸이다
     (★그건 ★배경 «값»이 아니라 ★층의 ★투명도이고, ★클래스 토글과 ★한 쌍으로 ★그 자리에 산다). */
  for (const f of CONSUMERS) {
    const src = strip(readSrc(ROOT, f));
    const own = [...src.matchAll(/setProperty\(\s*'(--frame-bg[a-z-]*)'/g)].map((m) => m[1])
      .filter((k) => k !== '--frame-bg-opacity');
    assert.deepEqual(own, [],
      `★${f} 가 ★배경 변수를 ★제 손으로 쓴다(${own.join(' · ')}) — ★공용 한 자리에 ★위임하라`);
    assert.match(src, /from '\.\.?\/?.*frame-bg\.js'/,
      `★${f} 가 ★공용 자리를 ★안 쓴다`);
  }
});

test('D1 ★★프레임 대상 ★`backgroundSize = \'cover\'` ★상수가 ★0건이다', () => {
  /* ★★이 다섯 자리가 ★★현빈 ③ 의 ★참된 자리였다 — ★«정의 자리»(배경을 그리는 CSS)에서 ★세어 찾았다.
     ⛔제외한 것도 ★이름으로 적는다(★안 적으면 ★다음 사람이 ★다시 센다):
       `sec.`(섹션 3) · `circle.`(icon-circle 2) · `img.`(banner02 안 img 1)
       · ★`banner-block.js` 의 그 줄 = ★★`makeAssetBlock()` 이 준 ★에셋블럭 (⛔배너가 프레임이 아니어서가 ★아니다 —
         ★배너는 ★프레임 변형이다. ★★받는 변수가 ★에셋이라서다)
       · `modal-frameify.js` = frame-block 언급 5건이나 `backgroundSize` 0건 */
  for (const f of CONSUMERS) {
    const src = strip(readSrc(ROOT, f));
    const bad = [...src.matchAll(/(\w+)\.style\.backgroundSize\s*=\s*'cover'/g)].map((m) => m[1]);
    const frameish = bad.filter((v) => v === 'ss' || v === 'block');
    assert.deepEqual(frameish, [],
      `★${f} 에 ★프레임 배경 크기를 ★상수로 박는 자리가 ★남았다(${frameish.join(' · ')})`);
  }
});
