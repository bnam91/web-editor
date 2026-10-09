/* frame-clips-predicate — ★★「자르나」와 ★「놓을 때 죄나」 ★★두 술어를 ★CSS·소스와 ★한 쌍으로 잠근다.
 *
 * ★★2026-10-10 — ★★술어가 ★★«하나»에서 ★★«둘»로 갈라졌다. ★이 파일도 ★같이 갈랐다.
 *   ★★왜 갈랐나 — ★예전엔 ★`frameClipsChildren` ★한 함수가 ★★«자르나(그림)»와 ★★«죄나(끌기)»를 ★겸했고,
 *     ★★그 겸직이 ★★세 날짜가 ★서로를 ★깨 온 ★뿌리였다:
 *       ★09-28 현빈 「밑변 너머로 나가면 ★사라진다」      → ★자르기를 껐다(＋죔도 같이 꺼졌다)
 *       ★10-09 현빈 「★안 잘려 보인다 — 잘려야 하는데」   → ★죔을 조건부로(＋자르기는 안 켰다)
 *       ★10-10 현빈 「프레임 밖은 ★안 보여야」            → ★자르기를 켠다(＋죔을 켜면 10-09 부활)
 *     ⇒ ★★«자르기 상시 ＋ 끌 때 죔 없음 ＋ ★놓을 때 되돌림»이 ★셋을 ★동시에 ★세우는 ★유일한 조합이다.
 *
 * ★★이 파일이 ★잠그는 것 ★넷:
 *   ⒜ ★`frameClipsPaint` ≡ ★CSS (★기본이 ★hidden 이고 ★푸는 자리가 ★명부와 ★같다)
 *   ⒝ ★★`frameClampsDrag(el, phase)` — ★★`'move'` 면 ★언제나 ★거짓(★10-09 의 ★지키는 자)
 *   ⒞ ★★표식 ★한 쌍 — ★onMove 에서 ★달고 ★onUp 에서 ★★뗀다(★안 떼면 ★영구 visible = ★조용한 무효화)
 *   ⒟ ★판정의 ★임자는 ★하나다 — ★소비자가 ★제 벌로 ★다시 세지 ★않는다
 *
 * ⛔사본을 적지 않는다 — ★소스에서 ★진짜 함수를 ★떼어 싣는다.
 * 실행: node --test tests/unit/frame-clips-predicate.test.mjs
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

/** 소스에서 ★진짜 함수를 떼어 싣는다 — ⛔사본을 적지 않는다. */
function loadFn(name) {
  const src = strip(readSrc(ROOT, 'js/frame-geometry.js'));
  const i = src.indexOf(`export function ${name}(`);
  assert.ok(i >= 0, `★${name} 가 js/frame-geometry.js 에 없다 — 이름이 바뀌었으면 이 검사도 옮겨라`);
  let j = src.indexOf('{', i), depth = 0;
  for (let k = j; k < src.length; k++) {
    if (src[k] === '{') depth++;
    else if (src[k] === '}') { depth--; if (!depth) { j = k + 1; break; } }
  }
  const ctx = vm.createContext({});
  /* ★★이 자는 ★«함수 본문»만 떠낸다 ⇒ ★그 함수가 ★★모듈 최상위 상수를 ★쓰면 ★`ReferenceError` 가 난다.
     ★실측(2026-10-10): `frameClampsDrag` 가 ★`FRAME_DRAG_PHASES` 를 쓰는데 ★안 실려 ★D1 셋이 ★빨개졌다.
     ⇒ ★★필요한 최상위 상수를 ★★같은 소스에서 ★먼저 싣는다. ⛔사본을 적지 않는다(여기서도 ★소스가 정본). */
  for (const cm of src.matchAll(/^export\s+const\s+[A-Z_][A-Z0-9_]*\s*=[^;]+;/gm)) {
    vm.runInContext(cm[0].replace(/^export\s+/, ''), ctx);
  }
  vm.runInContext(src.slice(i, j).replace(/^export\s+/, ''), ctx);
  return ctx[name];
}
const el = (dataset) => ({ dataset });

/* ══ ⒜-1 ★`frameClipsPaint` 의 ★진리표 ════════════════════════════════════ */

test('P1 ★기본은 ★자른다 — ★속성이 ★없어도 ★참이다 (★2026-10-10 에 ★뒤집힌 ★바로 그 칸)', () => {
  const f = loadFn('frameClipsPaint');
  assert.equal(f(el({})), true, '★★빈 프레임이 ★안 자른다고 한다 — ★10-10 부터 ★기본은 ★자름이다');
  assert.equal(f(el({ clipContent: 'true' })), true, '★명시로 켠 것도 ★자른다');
  assert.equal(f(el({ radius: '8' })), true, '★둥근 모서리도 ★자른다(기본이 자름이니 ★당연히)');
});

test('P2 ★★푸는 길은 ★하나다 — ★사람이 ★★명시로 ★끈 것(`data-clip-content="false"`)', () => {
  const f = loadFn('frameClipsPaint');
  assert.equal(f(el({ clipContent: 'false' })), false, '★명시로 끈 프레임은 ★안 자른다');
  /* ★★음성대조 — ★★«속성 없음»을 ★끔으로 ★읽으면 ★안 된다.
     ★예전엔 ★기본이 visible 이라 ★«끔 = 속성 삭제»였다 ⇒ ★그 꼴을 그대로 두고 ★기본만 바꾸면
     ★★토글을 ★끄는 것이 ★아무 일도 안 한다 = ★★조용한 무효화. */
  assert.equal(f(el({})), true, '★★«속성 없음»은 ★끔이 ★아니다');
  assert.equal(f(el({ clipContent: '' })), true, '★빈 값도 ★끔이 아니다');
  assert.equal(f(el({ clipContent: 'FALSE' })), true, '★대문자는 ★끔이 아니다(값은 정확히 `false`)');
  for (const bad of [null, undefined, 0, '']) {
    assert.equal(loadFn('frameClipsPaint')(bad), false, `★${String(bad)} 에서 ★던지지 말고 거짓`);
  }
});

/* ══ ⒜-2 ★★술어 ≡ CSS — ★이 쌍이 ★이 파일의 ★본론이다 ═══════════════════════ */

/** css 글자에서 ★「선택자에 frame-block ＋ 본문이 overflow 를 정하는」 규칙 전수.
 *  ⛔주석을 ★먼저 뗀다 — ★주석 속 ★예시가 ★측정값이 되지 않게(2026-09-28 에 실제로 그랬다). */
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

test('C3 ★★CSS 의 ★기본이 ★hidden 이고 ★«푸는 자리»가 ★술어와 ★같다 — ★CSS 가 바뀌면 ★여기가 빨개진다', () => {
  const css = readSrc(ROOT, 'css/editor-blocks.css');
  const rules = overflowRules(css);
  assert.ok(rules.length > 2, `★frame-block 의 overflow 규칙이 ${rules.length}건이다 — ★자가 죽었다`);

  /* ★★전제 — ★★기본이 ★hidden 이다(★2026-10-10 · 현빈 「프레임 밖은 안 보여야」).
     ⚠️★이 줄은 ★★네 번 뒤집혔다: 729479af(04-05 열림) · f98a2136(04-07 ★이틀 만에 닫힘) ·
       225053c3(09-29 ★다시 열림) · ★이번(10-10 ★다시 닫힘).
     ★★다섯 번째로 ★뒤집기 전에 ★위 머리말의 ★세 날짜를 ★읽어라 — ★★한 조치에 ★까닭이 ★둘 적혀 있었다
       (★커밋 제목은 ★「겹침·이동 불가」, ★CSS 주석은 ★「밑변 너머로 나가면 사라진다」). */
  const base = rules.find((r) => /^(@charset[^.]*)?\.frame-block$/.test(r.sel.replace(/^@charset\s+"[^"]*";\s*/, '')));
  assert.ok(base, `★'.frame-block' 민 규칙을 ★못 찾았다 (본 것: ${rules.map((r) => r.sel).join(' | ')})`);
  assert.equal(base.ov, 'hidden',
    '★★`.frame-block` 의 기본이 ★hidden 이 ★아니다 — ★현빈 10-10 이 ★조용히 ★되돌아갔다');

  /* ★★«푸는» 자리 전수 — ★딱 ★둘이어야 한다. ⛔셋째가 생기면 ★여기가 잡는다.
     ⚠️아래 다섯(도형선택·회전자식·그라데이션바·말풍선·텍스트선택)은 ★★이 명부 ★밖이다 —
       ★그들은 ★`.frame-block` «민» 선택자가 아니라 ★상태·자손 조건이 붙은 ★별건이고,
       ★이 검사가 ★잠그는 것은 ★★«기본과 ★토글» ★두 칸이다. ⇒ ★선택자 꼴로 ★추려 센다. */
  const released = rules.filter((r) => r.ov === 'visible'
      && /data-clip-content|frame-child-dragging/.test(r.sel)).map((r) => r.sel).sort();
  assert.deepEqual(released, [
    '.frame-block:has(> .frame-child-dragging)',
    '.frame-block[data-clip-content="false"]',
  ].sort(), `★★CSS 가 ★«푸는» 자리가 ★바뀌었다 — ★술어(frameClipsPaint)도 ★같이 고쳐라\n  본 것: ${released.join(' | ')}`);

  /* ★★그리고 ★그 둘을 ★술어가 ★같은 답으로 ★왕복한다 */
  const f = loadFn('frameClipsPaint');
  assert.equal(f(el({})), true, '★기본 = CSS 기본 hidden 과 같다');
  assert.equal(f(el({ clipContent: 'false' })), false, '★토글 끔 = CSS 가 푸는 자리와 같다');
});

test('C3b ★★양성대조 — ★CSS 에 ★셋째 «푸는» 자리가 생기면 ★위 자가 ★잡는다', () => {
  /* ⛔없으면 ★C3 의 「같다」가 ★★«자가 죽어도 같다»와 ★구분이 ★안 된다 */
  const fake = '.frame-block { overflow: hidden; }\n'
             + '.frame-block[data-clip-content="false"] { overflow: visible; }\n'
             + '.frame-block:has(> .frame-child-dragging) { overflow: visible; }\n'
             + '.frame-block[data-clip-content="maybe"] { overflow: visible; }\n'   /* ← 지어낸 셋째 */
             + '/* .frame-block[data-clip-content="주석"] { overflow: visible } */\n'; /* ← 주석은 안 세야 */
  const released = overflowRules(fake).filter((r) => r.ov === 'visible'
      && /data-clip-content|frame-child-dragging/.test(r.sel)).map((r) => r.sel).sort();
  assert.deepEqual(released, [
    '.frame-block:has(> .frame-child-dragging)',
    '.frame-block[data-clip-content="false"]',
    '.frame-block[data-clip-content="maybe"]',
  ].sort(), `★★양성대조가 ★안 선다 — ★자가 ★셋째를 ★못 잡거나 ★주석을 ★세고 있다 (본 것: ${released.join(' | ')})`);
});

/* ══ ⒝ ★★«끌는 동안에는 ★죄지 않는다» — ★10-09 의 ★지키는 자 ═══════════════ */

test("D1 ★`frameClampsDrag(el, phase)` 의 ★진리표 — ★`'move'` 는 ★언제나 ★거짓", () => {
  const f = loadFn('frameClampsDrag');
  /* ★★이 한 줄이 ★★현빈 10-09 의 ★지키는 자다 — ★끌는 동안 ★죄면 ★「170px 끌어도 378 에 물린다」가 ★부활한다 */
  assert.equal(f(el({}), 'move'), false, "★★'move' 에서 ★죄면 ★10-09 가 ★부활한다");
  assert.equal(f(el({ clipContent: 'true' }), 'move'), false, "★★켠 프레임도 ★'move' 에서는 ★안 죈다");
  assert.equal(f(el({}), 'drop'), true, "★기본 프레임은 ★'drop' 에서 ★안으로 되돌린다(T-088·09-28)");
  assert.equal(f(el({ clipContent: 'false' }), 'drop'), false,
    '★★자르지 ★않는 프레임은 ★밖이 ★보인다 ⇒ ★★되돌릴 ★까닭이 ★없다(멀쩡한 것을 움직이면 사고)');
  assert.equal(f(null, 'drop'), false, '★없는 것에서 던지지 말고 거짓');
});

test('D1b ★★모르는 phase 는 ★★던진다 — ⛔조용히 ★거짓을 주지 ★않는다 (지디 2026-10-10)', () => {
  const f = loadFn('frameClampsDrag');
  /* ★★«영은 ★답이 아니다» — ★새 호출자가 ★phase 를 ★빼먹으면 ★죔이 ★안 걸린 것을 ★아무도 ★모른다 */
  for (const bad of [undefined, null, '', 'move ', 'Drop', 'up', 0]) {
    assert.throws(() => f(el({}), bad), /모르는 phase/,
      `★phase=${JSON.stringify(bad)} 에서 ★던지지 ★않는다 — ★조용한 거짓이 ★샌다`);
  }
  /* ★★음성대조 — ★맞는 둘은 ★던지지 ★않아야 한다(★안 그러면 위 단언이 ★항등식이 된다) */
  assert.doesNotThrow(() => f(el({}), 'move'));
  assert.doesNotThrow(() => f(el({}), 'drop'));
});

test("D1c ★★「내용 자르기」 ★켠 프레임 — ★★«안 보이지만 ★움직인다» (★이 예외의 ★정의 · 지디 2026-10-10)", () => {
  /* ★현빈이 ★09-30 에 ★스스로 만들라 하고 ★스스로 ★켠 토글이다 ⇒ ★★«켠 사람이 ★고른 것».
     ★그 프레임은 ★`!important` 라 ★★끌 때도 ★안 풀린다(= ★안 보인다).
     ★★그래도 ★★죔은 ★'move' 에서 ★거짓이라 ★★움직이기는 ★한다 — ★그 둘을 ★같이 박는다.
     ⛔이 칸이 ★없으면 ★다음 사람이 ★「켠 프레임이 ★끌 때 ★안 보인다」를 ★결함으로 읽고 ★뒤집는다. */
  const f = loadFn('frameClampsDrag');
  assert.equal(f(el({ clipContent: 'true' }), 'move'), false, '★★켠 프레임도 ★끌 때 ★안 물린다(움직인다)');
  assert.equal(f(el({ clipContent: 'true' }), 'drop'), true, '★놓으면 ★안으로 되돌린다');
  const css = readSrc(ROOT, 'css/editor-blocks.css').replace(/\/\*[\s\S]*?\*\//g, '');
  assert.ok(/\.frame-block\[data-clip-content="true"\]\s*\{[^}]*overflow:\s*hidden\s*!important/.test(css),
    '★★켠 프레임의 ★`!important` 가 ★사라졌다 — ★그러면 ★끌 때 ★풀려서 ★«켠 사람의 선택»이 ★깨진다');
});

test('D2 ★★«끌는 ★동안» 죔이 ★★0건이다 — ★onMove 안에 ★죔이 ★없다 (★현빈 10-09)', () => {
  /* ★★실측(2026-10-09 · 앱 9430 · 진짜 마우스): ★오른쪽 170px 끌어도 `style.left` 가 ★378px 에 ★물렸다.
     ★그 까닭이 ★onMove 의 ★죔이었다. ⇒ ★★그 자리에 ★죔이 ★다시 들어오면 ★이 칸이 ★빨개진다.
     ⛔주석을 ★벗기고 센다 — ★주석에 적은 ★옛 코드 꼴이 ★측정값이 되지 않게. */
  const src = strip(readSrc(ROOT, 'js/block-drag.js'));
  const moves = [...src.matchAll(/function onMove\s*\(|const onMove\s*=/g)].map((m) => m.index);
  assert.ok(moves.length >= 2, `★onMove 가 ${moves.length}건이다 — ★끌기 경로가 ★둘(일반 블록 · 셀 프레임)이어야 한다`);
  for (const start of moves) {
    /* 그 onMove 의 몸통만 — 다음 `function onUp`/`const onUp` 까지 */
    const upAt = src.indexOf('onUp', start);
    const body = src.slice(start, upAt > start ? upAt : start + 4000);
    assert.ok(!/clampChildIntoFrame\s*\(/.test(body),
      '★★onMove 안에 ★`clampChildIntoFrame` 이 있다 — ★끌는 동안 ★죄면 ★10-09 가 ★부활한다');
    assert.ok(!/Math\.min\s*\(\s*_?max[LT]/.test(body),
      '★★onMove 안에 ★손으로 쓴 ★죔이 있다 — ★제 벌 명부다(★2026-10-10 에 ★걷은 그 꼴)');
  }
});

test('D3 ★★죔은 ★«놓는 순간»에만 — ★두 경로 ★모두 ★onUp 에서 ★공용 함수를 ★부른다', () => {
  const src = strip(readSrc(ROOT, 'js/block-drag.js'));
  assert.equal((src.match(/frameClampsDrag\s*\(/g) || []).length, 2,
    '★★`frameClampsDrag` 호출이 ★2 가 아니다 — ★끌기 경로가 ★둘이고 ★둘 다 ★되돌려야 한다');
  /* ★★phase 를 ★호출 자리에 ★드러내라(지디) — ★둘 다 ★`'drop'` 이어야 한다 */
  assert.equal((src.match(/frameClampsDrag\([^)]*,\s*'drop'\s*\)/g) || []).length, 2,
    "★★호출이 ★`'drop'` 을 ★명시하지 ★않는다 — ★«언제 죄나»가 ★호출 자리에 ★드러나야 한다");
  assert.equal((src.match(/clampChildIntoFrame\s*\(/g) || []).length, 2,
    '★★`clampChildIntoFrame` 호출이 ★2 가 아니다 — ★한 경로가 ★제 벌로 ★다시 세고 있을 수 있다');
});

/* ══ ⒞ ★★표식 ★한 쌍 — ★달고 ★★뗀다 ═════════════════════════════════════ */

test('E1 ★★끌기 표식은 ★달리고 ★★반드시 ★뗀다 — ★안 떼면 ★영구 visible = ★고치기 전과 같다', () => {
  const src = strip(readSrc(ROOT, 'js/block-drag.js'));
  assert.ok(/classList\.add\(\s*'frame-child-dragging'\s*\)/.test(src),
    '★표식을 ★다는 자리가 ★없다 — ★CSS 가 ★끌는 동안을 ★알 길이 없다');
  assert.ok(/classList\.remove\(\s*'frame-child-dragging'\s*\)/.test(src),
    '★★표식을 ★떼는 자리가 ★없다 — ★그러면 ★그 프레임은 ★영구히 ★안 자른다(★현빈 10-10 이 조용히 되돌아간다)');
  /* ★이름이 ★흔한 전역 낱말이 ★아니어야 한다(★전역 이름 충돌 교훈 2026-10-06) */
  assert.ok(!/classList\.add\(\s*'dragging'\s*\)[\s\S]{0,200}frame-block/.test(src),
    '★표식 이름이 ★너무 흔하다 — ★`frame-child-dragging` 처럼 ★좁혀라');
});

/* ══ ⒟ ★부르는 자리 전수 — ⛔사본이 ★다시 생기면 빨개진다 ═══════════════════ */

test('C4 ★★판정의 ★임자는 ★하나다 — ★소비자가 ★제 벌로 ★다시 세지 않는다', () => {
  const geom = strip(readSrc(ROOT, 'js/frame-geometry.js'));
  for (const n of ['frameClipsPaint', 'frameClampsDrag']) {
    assert.equal((geom.match(new RegExp(`function ${n}\\s*\\(`, 'g')) || []).length, 1,
      `★${n} 정의가 ★하나가 아니다`);
  }
  /* ★★둘이 ★같은 몸통이면 ★겸직이 ★돌아온 것이다 — ⛔한 쪽을 다른 쪽에서 ★파생시키지 마라(지디 2026-10-10) */
  assert.ok(!/function frameClampsDrag[\s\S]{0,400}frameClipsPaint\s*\(/.test(geom),
    '★★`frameClampsDrag` 이 ★`frameClipsPaint` 를 ★불러 ★파생된다 — ★그게 ★겸직의 ★재발이다');

  /* ★소비자 전수 — ★뜻에 맞는 술어를 ★쓰나 */
  const byFile = {
    'js/drag-utils.js': 'frameClipsPaint',     /* full-bleed 가 잘리나 = ★그림 쪽 */
    'js/block-drag.js': 'frameClampsDrag',     /* 언제 죄나 = ★끌기 쪽 */
  };
  for (const [f, want] of Object.entries(byFile)) {
    const src = strip(readSrc(ROOT, f));
    assert.ok(!/dataset\??\.\s*radius[\s\S]{0,120}!==\s*'0'/.test(src)
           && !/String\(\s*_?r\s*\)\s*!==\s*'0'/.test(src),
      `★${f} 가 ★「자르나」를 ★제 벌로 ★다시 센다 — ★공용 술어를 ★불러라`);
    assert.ok(new RegExp(`\\b${want}\\b`).test(src), `★${f} 가 ★공용 술어 ★${want} 를 ★안 쓴다`);
  }
});
