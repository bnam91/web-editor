/* frame-clips-predicate — 「★이 프레임이 ★정말 자르나」의 ★술어와 ★CSS 를 ★한 쌍으로 잠근다.
 *
 * ★★왜 — 2026-10-09 현빈: 「프레임 블럭 안에 텍스트 블럭들 넣고 ★이동하면 ★프레임 안에서만 있고
 *   ★★안 잘려 보인다(★잘려야 하는데)」.
 *   ★실측으로 가른 것(앱 9430 · 배율 100% · 진짜 마우스):
 *     ★토글(`#ss-clip-toggle`)은 ★★멀쩡했다 — 넘친 자식을 만들어 재니 ★끔에서 프레임 밖 ★글자 픽셀 ★426,
 *       ★켬에서 ★★0 (같은 띠를 서로 견준 차이 439px).
 *     ★막은 것은 ★★드래그 죔(T-088 `clampChildIntoFrame`)이었다 — ★자식이 ★넘친 채로 ★남는 상태가 ★없어
 *       ★잘릴 것이 ★애초에 ★없었다. ★오른쪽 170px 끌어도 `style.left` 가 ★378 에 물렸고,
 *       ★음성대조로 ★왼쪽 150px 은 ★378→228 로 ★정확히 움직였다(= 끌기는 살아 있다).
 *   ⇒ ★처방 = ★죔을 ★★«정말 자르는 프레임»일 때만. ★그 판정이 ★`frameClipsChildren` 다.
 *
 * ★★이 파일이 ★잠그는 것 = ★★«술어 ≡ CSS». ⛔술어만 재면 ★CSS 가 ★먼저 바뀌는 날 ★조용히 갈린다 —
 *   ★그게 ★이 레포가 ★이미 ★두 번 겪은 병이다(`js/drag-utils.js`·`js/props/prop-page.js` 의 그 주석 둘).
 *
 * ★★안 재는 것: ★죔이 ★정말 안 걸리나(행위) ⇒ ★`tests/dom/frame-clip-drag.dom.spec.js`.
 */
import test from 'node:test';
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

/** 소스에서 ★진짜 함수를 떼어 싣는다 — ⛔사본을 적지 않는다. */
function loadPredicate() {
  const src = strip(readSrc(ROOT, 'js/frame-geometry.js'));
  const i = src.indexOf('export function frameClipsChildren(');
  assert.ok(i >= 0, '★frameClipsChildren 가 js/frame-geometry.js 에 없다 — 이름이 바뀌었으면 이 검사도 옮겨라');
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  const ctx = vm.createContext({});
  vm.runInContext(src.slice(i, j).replace(/^export\s+/, ''), ctx);
  return ctx.frameClipsChildren;
}
const el = (dataset) => ({ dataset });

/* ══ ⑴ 술어의 ★진리표 ════════════════════════════════════════════════════ */

test('C1 ★자르는 꼴 — 「내용 자르기」 켬 · 둥근 모서리', () => {
  const f = loadPredicate();
  assert.equal(f(el({ clipContent: 'true' })), true, '★내용 자르기를 켰는데 ★안 자른다고 한다');
  assert.equal(f(el({ radius: '8' })), true, '★둥근 모서리인데 ★안 자른다고 한다');
  assert.equal(f(el({ radius: '0.5' })), true, '★0 이 아닌 radius 인데 ★안 자른다고 한다');
  assert.equal(f(el({ clipContent: 'true', radius: '0' })), true, '★토글만 켜도 ★자른다');
});

test('C2 ★★안 자르는 꼴 — ★기본이 ★«안 자름»이다 (2026-09-28 현빈 지시)', () => {
  const f = loadPredicate();
  assert.equal(f(el({})), false, '★★빈 프레임이 ★자른다고 한다 — ★기본은 ★안 자름이다');
  assert.equal(f(el({ radius: '0' })), false, '★radius 0 은 ★둥글지 않다');
  assert.equal(f(el({ radius: '' })), false, '★빈 radius 는 ★둥글지 않다');
  assert.equal(f(el({ clipContent: 'false' })), false, "★clipContent 가 'false' 인데 ★자른다고 한다");
  assert.equal(f(el({ clipContent: '' })), false, '★빈 clipContent 가 ★자른다고 한다');
  /* ⛔못 읽는 입력에서 ★터지지 않는다 — ★터지면 ★드래그가 ★통째로 죽는다 */
  for (const bad of [null, undefined, {}, 0, '']) {
    assert.equal(f(bad), false, `★${String(bad)} 에서 ★자른다고 한다`);
  }
});

/* ══ ⑵ ★★술어 ≡ CSS — ★이 쌍이 ★이 파일의 ★본론이다 ═══════════════════════ */

/** css 글자에서 ★「선택자에 frame-block ＋ 본문이 overflow 를 정하는」 규칙 전수.
 *  ⛔주석을 ★먼저 뗀다 — ★주석 속 ★예시가 ★측정값이 되지 않게. */
function overflowRules(css) {
  const nocom = css.replace(/\/\*[\s\S]*?\*\//g, '');
  const out = [];
  for (const m of nocom.matchAll(/([^{}]+)\{([^{}]*)\}/g)) {
    const sel = m[1].trim().replace(/\s+/g, ' ');
    const ov = (m[2].match(/overflow\s*:\s*([a-z]+)/) || [])[1];
    if (ov && /\.frame-block/.test(sel)) out.push({ sel, ov });
  }
  return out;
}

test('C3 ★★CSS 가 ★«hidden 으로 두는» 자리와 ★술어가 ★같다 — ★CSS 가 바뀌면 ★여기가 빨개진다', () => {
  const css = readSrc(ROOT, 'css/editor-blocks.css');
  const rules = overflowRules(css);
  assert.ok(rules.length > 2, `★frame-block 의 overflow 규칙이 ${rules.length}건이다 — ★자가 죽었다`);

  /* ★★전제 — ★기본이 ★visible 이다. ⛔이게 뒤집히면 ★이 건의 ★처방 전체가 ★다시 서야 한다 */
  const base = rules.find((r) => /^(@charset[^.]*)?\.frame-block$/.test(r.sel.replace(/^@charset\s+"[^"]*";\s*/, '')));
  assert.ok(base, `★'.frame-block' 민 규칙을 ★못 찾았다 (본 것: ${rules.map((r) => r.sel).join(' | ')})`);
  assert.equal(base.ov, 'visible',
    '★★`.frame-block` 의 기본이 ★visible 이 ★아니다 — ★죔을 ★조건부로 둔 ★까닭이 ★사라진다');

  /* ★★hidden 으로 두는 자리 전수 — ★술어가 ★그 둘을 ★«그대로» 옮긴 것이어야 한다 */
  const hidden = rules.filter((r) => r.ov === 'hidden').map((r) => r.sel).sort();
  assert.deepEqual(hidden, [
    '.frame-block[data-clip-content="true"]',
    '.frame-block[data-radius]:not([data-radius="0"])',
  ].sort(), `★★CSS 가 ★자르는 자리가 ★바뀌었다 — ★술어(frameClipsChildren)도 ★같이 고쳐라\n  본 것: ${hidden.join(' | ')}`);

  /* ★★그리고 ★그 둘을 ★술어가 ★참으로 답한다(★같은 자로 ★왕복) */
  const f = loadPredicate();
  assert.equal(f(el({ clipContent: 'true' })), true);
  assert.equal(f(el({ radius: '8' })), true);
  assert.equal(f(el({ radius: '0' })), false);
});

test('C3b ★★양성대조 — ★CSS 에 ★셋째 hidden 자리가 생기면 ★위 자가 ★잡는다', () => {
  /* ⛔없으면 ★C3 의 「같다」가 ★★«자가 죽어도 같다»와 ★구분이 ★안 된다 */
  const fake = '.frame-block { overflow: visible; }\n'
             + '.frame-block[data-clip-content="true"] { overflow: hidden !important; }\n'
             + '.frame-block[data-radius]:not([data-radius="0"]) { overflow: hidden; }\n'
             + '.frame-block[data-mask="on"] { overflow: hidden; }\n'          /* ← 지어낸 셋째 */
             + '/* .frame-block[data-주석] { overflow: hidden } */\n';          /* ← 주석은 안 세야 한다 */
  const hidden = overflowRules(fake).filter((r) => r.ov === 'hidden').map((r) => r.sel).sort();
  assert.deepEqual(hidden, [
    '.frame-block[data-clip-content="true"]',
    '.frame-block[data-mask="on"]',
    '.frame-block[data-radius]:not([data-radius="0"])',
  ], `★★양성대조가 ★안 선다 — ★자가 ★셋째를 ★못 잡거나 ★주석을 ★세고 있다 (본 것: ${hidden.join(' | ')})`);
});

/* ══ ⑶ ★부르는 자리 전수 — ⛔사본이 ★다시 생기면 빨개진다 ═══════════════════ */

test('C4 ★★판정의 ★임자는 ★하나다 — ★소비자가 ★제 벌로 ★다시 세지 않는다', () => {
  const geom = strip(readSrc(ROOT, 'js/frame-geometry.js'));
  assert.equal((geom.match(/function frameClipsChildren\s*\(/g) || []).length, 1,
    '★frameClipsChildren 정의가 ★하나가 아니다');

  /* ★소비자 전수 — ★`data-radius`·`clipContent` 를 ★제 손으로 ★「자르나」로 ★읽는 자리가 ★있나.
     ★덮는 자: 「`radius` 를 읽어 ★0 과 ★견주는」 꼴 — ★그게 ★옛 사본의 ★모양이었다. */
  for (const f of ['js/drag-utils.js', 'js/block-drag.js']) {
    const src = strip(readSrc(ROOT, f));
    assert.ok(!/dataset\??\.\s*radius[\s\S]{0,120}!==\s*'0'/.test(src)
           && !/String\(\s*_?r\s*\)\s*!==\s*'0'/.test(src),
      `★${f} 가 ★「자르나」를 ★제 벌로 ★다시 센다 — ★frameClipsChildren 를 ★불러라`);
    assert.ok(/\bframeClipsChildren\b/.test(src),
      `★${f} 가 ★공용 술어를 ★안 쓴다`);
  }
});
