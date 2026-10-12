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
import { readdirSync } from 'node:fs';   /* ㈄ 2026-10-10 — ★js/ 전수로 ★부활을 ★재려고 */
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
/** ★`js/` 아래 ★`.js` ★전부 — ★★«치운 것이 ★다른 파일에 ★부활했나»를 ★전수로 재기 위해. */
function walkJs(rel) {
  const out = [];
  const walk = (d) => {
    for (const e of readdirSync(path.join(ROOT, d), { withFileTypes: true })) {
      if (e.name.startsWith('.')) continue;
      if (e.isDirectory()) walk(`${d}/${e.name}`);
      else if (e.name.endsWith('.js')) out.push(`${d}/${e.name}`);
    }
  };
  walk(rel);
  assert.ok(out.length > 20, `★전제: ${rel} 아래 .js 가 ${out.length}개다 — ★걷는 자가 ★죽었다`);
  return out;
}
const el = (dataset) => ({ dataset });

/** ★★공용 술어를 ★★그 파일에서 ★불러 싣는다 (㈄ 2026-10-10) — ⛔사본을 ★적지 않는다.
 *  ★`js/clip-content.js` 는 ★★import 가 ★0 이라(★실측) ★모듈 ★통째로 ★실린다.
 *  ★★`vm` 에서 ★최상위 ★`const` 는 ★전역 ★«속성»이 ★안 되므로 ★`var` 로 ★바꿔 ★내보낸다
 *    (★★같은 함정을 ★block-full-bleed 하네스에서 ★실측으로 ★먼저 ★밟았다). */
function loadClip() {
  const src = strip(readSrc(ROOT, 'js/clip-content.js'))
    .replace(/^\s*export\s+/gm, '')
    .replace(/^if \(typeof window[\s\S]*$/m, '')
    .replace(/^const /gm, 'var ');
  const ctx = vm.createContext({});
  vm.runInContext(src, ctx);
  assert.equal(typeof ctx.clipsContent, 'function', '★전제: `clipsContent` 가 ★안 실렸다');
  assert.equal(typeof ctx.clipFamily, 'function', '★전제: `clipFamily` 가 ★안 실렸다');
  assert.equal(typeof ctx.CLIP_DEFAULTS, 'object', '★전제: `CLIP_DEFAULTS` 표가 ★안 실렸다');
  return ctx;
}
/** ★프레임 계열로 ★보이는 ★가짜 요소 — ★공용 술어는 ★★계열을 ★본다(⛔`el()` 로는 ★`null` 이 나온다) */
const fel = (dataset) => ({ classList: { contains: (c) => c === 'frame-block' }, dataset: dataset || {} });

/* ══ ⒜-1 ★`frameClipsPaint` 의 ★진리표 ════════════════════════════════════ */

/* ⚰️★★★2026-10-10 ㈄ — ★`P1`·`P2`(★`frameClipsPaint` 의 ★진리표)를 ★★여기서 ★★치웠다.
     ★★어디로 — ★`tests/unit/clip-content-roster.test.mjs` ★`A2` 안이다(★⚰️ 표시로 ★찾을 수 있다).
     ★★왜 — ★그 술어가 ★★`js/clip-content.js` ★`clipsContent` 로 ★합쳐졌다.
       ★★여기 두면 ★★같은 물음을 ★★두 자리에서 ★센다 ⇒ ★★명부가 ★둘이다.
     ★★★⛔«지웠다»가 ★아니라 ★«옮겼다» — ★옮긴 ★고유 다리를 ★세어 둔다(★덮개를 ★잃지 ★않았다):
       ⑴ ★빈 값(`''`)도 ★끔이 ★아니다            ← ★옛 P2
       ⑵ ★대문자(`'FALSE'`)도 ★끔이 ★아니다       ← ★옛 P2
       ⑶ ★`radius` 는 ★판정과 ★무관하다           ← ★옛 P1
       ⑷ ★나쁜 입력에 ★던지지 ★않는다             ← ★옛 P2
          ★★★단 ★값이 ★갈렸다: ★옛 `false` → ★새 ★`null`(★「영은 ★답이 ★아니다」)
            ⇒ ★그 차이를 ★★A2 에 ★박아 뒀다
       ★★＋ ★겹치던 셋(★속성 없음 ⇒ 기본 · `'true'` ⇒ 참 · `'false'` ⇒ 거짓)은 ★★A2 에 ★이미 있었다
     ★★이 파일에 ★남은 것 = ★★죔(`D*`) ＋ ★★술어 ≡ CSS(`C*`) — ★★그 둘이 ★이 파일의 ★본론이다. */

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
  /* ⚠️★★2026-10-10 2차 — ★끌는 중 해제 선택자가 ★★좁아졌다. ★수는 ★그대로 ★둘이다.
       ★★`:not([data-clip-content="true"])` 를 ★★더한 까닭 = ★★현빈 ★09-30 결정을 ★보존한다:
         「★켠 것은 ★풀어 주는 ★예외들보다 ★이겨야 한다」(그래서 ★그 규칙이 ★`!important`).
       ★★실측(탐침 D · 2026-10-10): ★기본 ⇒ hidden→★visible · ★★켬 ⇒ hidden→★★hidden.
       ⇒ ★★어차피 ★★켬에서는 ★안 풀렸다 ⇒ ★★그 ★«안 풀림»을 ★선택자에 ★★보이게 ★적은 것이다
         (⛔명시도로만 ★지고 있으면 ★읽는 사람이 ★«풀린다»로 ★읽는다).
       ★★그 결정이 ★뒤집히면(★현빈 판정) ★이 `:not` 을 ★떼고 ★`!important` 를 ★주면 된다 —
         ★그때 ★이 칸과 ★`K2-move` ＋ ★`frame-bg-edit-wiring` 의 ★B10 이 ★★같이 ★빨개진다. */
  assert.deepEqual(released, [
    '.frame-block:has(> .frame-child-dragging):not([data-clip-content="true"])',
    '.frame-block[data-clip-content="false"]',
  ].sort(), '★★CSS 가 ★«푸는» 자리가 ★바뀌었다 — ★★무엇이 ★바뀌었나를 ★갈라 적어라:\n'
    + '  ⑴ ★명부(★어느 선택자가 ★푸나) 가 ★바뀌었나 ⇒ ★이 배열을 ★고치고 ★★까닭을 ★위 주석에 ★남겨라\n'
    + '  ⑵ ★★술어(frameClipsPaint)가 ★답해야 할 것이 ★바뀌었나 ⇒ ★★그 함수를 ★고쳐라\n'
    + `  ⛔둘을 ★섞어 ★고치지 ★마라. 본 것: ${released.join(' | ')}`);

  /* ★★그리고 ★그 둘을 ★술어가 ★같은 답으로 ★왕복한다 */
  /* ★★㈄ 2026-10-10 — ★술어가 ★`js/clip-content.js` 로 ★합쳐졌다. ★★묻는 것은 ★그대로다:
     ★★«CSS 가 ★기본으로 ★자르고, ★푸는 자리가 ★하나»인지를 ★★술어 쪽에서도 ★같이 ★확인한다. */
  const { clipsContent: f } = loadClip();
  assert.equal(f(fel({})), true, '★기본 = CSS 기본 hidden 과 같다');
  assert.equal(f(fel({ clipContent: 'false' })), false, '★토글 끔 = CSS 가 푸는 자리와 같다');
  /* ★★음성대조 — ★★계열을 ★안 보면 ★이 쌍은 ★아무 요소에나 ★참이 된다(★옛 술어가 ★그랬다) */
  assert.equal(f(el({})), null, '★★계열이 ★없는 요소에 ★답을 준다 — ★술어가 ★계열을 ★안 본다');
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

test("D1 ★`frameClampsDrag(el, phase)` 의 ★진리표 — ★★«어느 phase 에서도 ★안 죈다» (현빈 1010t1c1)", () => {
  /* ⚰️★2026-10-10 2차까지의 진리표: ★`'move'` ⇒ 거짓 · ★`'drop'` ⇒ ★`clipContent !== 'false'`
       ⇒ ★★속성 ★없거나 ★`'true'` 면 ★★죄었다.
     ★★★현빈 1010t1c1 이 ★그것을 ★★«문제»라 ★부르셨다 — 「★내용자르기 ★켜면 ★★이동이 ★안 된다 ·
       ★제자리로 ★돌아온다 · ★오프시키면 ★제대로 된다」 ⇒ ★★지디 판정으로 ★★죔을 ★★껐다(후보 ㉮).
     ★★그리고 ★★«제자리»가 ★★`left: 0` 임을 ★쟀다(그 자식의 감싸는 프레임이 ★offset-x 0).
     ★★★부딪치는 결정이 ★없음도 ★쟀다 — ★09-30 커밋은 ★이 파일을 ★★0 줄 건드렸다.
     ⇒ ★★이제 ★★★이 술어는 ★★«항상 거짓»이다. ⛔그래도 ★★지우지 ★않는다:
        ⑴ ★phase 검증이 ★여기 산다(★D1b) ⑵ ★★되돌릴 자리가 ★★한 곳으로 ★남는다 */
  const f = loadFn('frameClampsDrag');
  for (const [ds, label] of [[{}, '기본(속성 없음)'], [{ clipContent: 'true' }, '켬'],
                             [{ clipContent: 'false' }, '끔'], [{ radius: '36' }, '둥근']]) {
    for (const ph of ['move', 'drop']) {
      assert.equal(f(el(ds), ph), false,
        `★★[${label}] ★'${ph}' 에서 ★죈다 — ★★현빈 1010t1c1 의 ★「이동이 ★안 된다」가 ★부활한다`);
    }
  }
  assert.equal(f(null, 'drop'), false, '★없는 것에서 던지지 말고 거짓');
  /* ★★★그리고 ★★«이 술어가 ★★«자르나»를 ★읽지 ★않는다»를 ★★소스로 ★잠근다 —
     ⛔값 단언만으론 ★★«읽고도 ★우연히 ★false» 를 ★구분 ★못 한다(★지금은 ★항상 거짓이라 ★더욱)
     ★★★2026-10-10 ㈄ — ★★금지 자를 ★★넓혔다. ★까닭을 ★적는다:
       ★옛 자 ★`/clipContent/` 는 ★★공용 술어 이름 ★`clipsContent` 를 ★★★`s` ★한 글자 때문에
       ★★못 잡았다(★node 로 ★눌러 쟀다: ★`/clipContent/.test('clipsContent')` ⇒ ★★false).
       ⇒ ★★누가 ★죔 본문에 ★`clipsContent(el)` 을 ★써 넣으면 ★★이 칸이 ★★초록이었다
       ⇒ ★★★현빈 1010t1c1(「켜면 ★이동이 ★안 된다」)이 ★★조용히 ★부활할 ★문이 ★열려 있었다.
       ★★㈄ 가 ★그 이름을 ★«집에서 ★유일한 술어»로 ★만들기 ★★전에 ★막는다. */
  const geom = readSrc(ROOT, 'js/frame-geometry.js');
  const iA = geom.indexOf('export function frameClampsDrag');
  const iB = geom.indexOf('export function clampChildIntoFrame');
  /* ★★전제 — ★`slice` 가 ★`-1` 을 받으면 ★몸통이 ★조용히 ★엉뚱해지고 ★아래 단언이 ★★항등식이 된다 */
  assert.ok(iA >= 0, '★전제: `frameClampsDrag` 정의를 ★못 찾았다 — ★이름이 ★바뀠다');
  assert.ok(iB > iA, `★전제: 다음 함수(clampChildIntoFrame)가 ★뒤에 ★없다 (iA ${iA} · iB ${iB})`);
  const body = geom.slice(iA, iB);
  /* ⛔`//` 줄 주석도 ★뗀다 — ★안 떼면 ★주석에 적은 ★이름이 ★★측정값이 된다(★그 교훈의 ★그 자리) */
  const code = body.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*/g, '');
  assert.ok(code.length > 0, '★전제: ★주석을 떼니 ★본문이 ★비었다 — ★자가 ★아무것도 ★안 잰다');
  /* ★★★2026-10-10 ㈄ ⒟ (지디 조건) — ★★★이름 ★셋을 ★«열거»하지 ★않는다. ★★계열 ★전체를 ★금지한다.
     ★★까닭 ⑴ — ★열거는 ★★«넷째 이름»이 ★생기는 날 ★또 ★통과한다. ★그게 ★오늘 ★이 자가 ★진 ★방식이다
       (★옛 자 `/clipContent/` 가 ★★`clipsContent` 를 ★★`s` ★한 글자로 ★놓쳤다).
     ★★까닭 ⑵ — ★★실측: ★`clip`·`CLIP` 으로 ★시작하는 ★★«구별되는 식별자»가 ★이 레포에 ★★33개다
       (★js ＋ css ＋ tests ＋ tools · 2026-10-10). ⛔그러니 ★★«이 셋이 ★전부»라 ★적을 수 ★없다.
       ⇒ ★★그 ★33 이 ★★다음 사람의 ★분모다. ⛔등호(==)로 ★명부를 ★닫지 ★마라.
     ★★그리고 ★★죔 본문에는 ★그 계열이 ★★0개다(★실측) ⇒ ★★계열 ★전체 금지가 ★★지금 ★선다.
       ★★`clamp*`·`frame*`·`FRAME_DRAG_PHASES` 는 ★★안 걸린다(★아래 음성대조가 ★그것을 ★잰다) */
  const FORBIDDEN = /\b(?:clip|CLIP)[A-Za-z0-9_]*/;
  /* ★★★반례 단언 — ★`!regex` 는 ★★항등식이 ★될 수 있다. ★★자가 ★사는지 ★먼저 ★증명한다 */
  assert.ok(FORBIDDEN.test('clipsContent(el)'), '★★자가 ★죽었다 — ★공용 술어 이름을 ★못 잡는다');
  assert.ok(FORBIDDEN.test('d.clipContent'), '★★자가 ★죽었다 — ★옛 속성 이름을 ★못 잡는다');
  assert.ok(FORBIDDEN.test('CLIP_DEFAULTS.frame'), '★★자가 ★죽었다 — ★기본값 표를 ★못 잡는다');
  assert.ok(FORBIDDEN.test('clipFamily(el)'), '★★자가 ★죽었다 — ★계열 판정을 ★못 잡는다');
  /* ★★★이 한 줄이 ★★«열거가 ★아님»을 ★증명한다 — ★★아직 ★없는 이름도 ★잡아야 한다 */
  assert.ok(FORBIDDEN.test('clipWhateverNew(el)'),
    '★★★자가 ★★«열거»다 — ★★넷째 이름이 ★생기는 날 ★또 ★통과한다');
  /* ★★음성대조 ★셋 — ★자가 ★★너무 ★넓으면 ★죔 본문이 ★★영구 빨강이 된다 */
  assert.ok(!FORBIDDEN.test('framePadding(frameEl)'), '★★자가 ★너무 ★넓다 — ★멀쩡한 이름을 ★잡는다');
  assert.ok(!FORBIDDEN.test('clampChildIntoFrame(l, t)'), '★★자가 ★`clamp` 를 ★`clip` 으로 ★읽는다');
  assert.ok(!FORBIDDEN.test('FRAME_DRAG_PHASES'), '★★자가 ★phase 명부를 ★잡는다');
  assert.ok(!FORBIDDEN.test(code),
    `★★★죔 술어가 ★다시 ★★«자르나»를 ★읽는다 — ★★그것이 ★현빈 1010t1c1 의 ★그 자리다 (본문 ${code.length}자)`);
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

test("D1c ★★「내용 자르기」 ★켠 프레임 — ★★«안 보이지만 ★움직이고 ★★그 자리에 ★남는다» (현빈 1010t1c1)", () => {
  /* ★현빈이 ★09-30 에 ★스스로 만들라 하고 ★스스로 ★켠 토글이다 ⇒ ★★«켠 사람이 ★고른 것».
     ★그 프레임은 ★`!important` 라 ★★끌 때도 ★안 풀린다(= ★안 보인다).
     ★★그래도 ★★죔은 ★'move' 에서 ★거짓이라 ★★움직이기는 ★한다 — ★그 둘을 ★같이 박는다.
     ⛔이 칸이 ★없으면 ★다음 사람이 ★「켠 프레임이 ★끌 때 ★안 보인다」를 ★결함으로 읽고 ★뒤집는다. */
  const f = loadFn('frameClampsDrag');
  assert.equal(f(el({ clipContent: 'true' }), 'move'), false, '★★켠 프레임도 ★끌 때 ★안 물린다(움직인다)');
  /* ⚰️★2026-10-10 2차: 「★놓으면 ★안으로 되돌린다」 ⇒ ★`true` 였다.
     ★★★현빈 1010t1c1 로 ★뒤집혔다 — ★★놓은 뒤에도 ★★그 자리에 ★있다(★걸친 부분은 ★안 보인다). */
  assert.equal(f(el({ clipContent: 'true' }), 'drop'), false,
    '★★놓으면 ★되돌린다 — ★★현빈 1010t1c1 의 ★「제자리로 ★돌아온다」가 ★부활한다');
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
  assert.equal((geom.match(/function frameClampsDrag\s*\(/g) || []).length, 1,
    '★frameClampsDrag 정의가 ★하나가 아니다');
  /* ★★★㈄ 2026-10-10 — ★`frameClipsPaint` 는 ★★치웠다. ★★«치운 것이 ★다시 안 생기나»를 ★잰다.
     ★★전수로 ★본다(★한 파일이 ★아니라 ★`js/` ★전체) — ★다른 파일에 ★부활하면 ★거기가 ★둘째 명부다. */
  const resurrected = [];
  for (const f of walkJs('js')) {
    if (/function frameClipsPaint\s*\(/.test(strip(readSrc(ROOT, f)))) resurrected.push(f);
  }
  assert.deepEqual(resurrected, [],
    '★★`frameClipsPaint` 가 ★되살아났다 — ★정본은 ★`js/clip-content.js` ★`clipsContent` 다(㈄ 2026-10-10)');
  /* ★★양성대조 — ★위 자가 ★★«아무것도 ★못 찾는 자»가 ★아님을 ★증명한다 */
  const alive = [];
  for (const f of walkJs('js')) {
    if (/function clipsContent\s*\(/.test(strip(readSrc(ROOT, f)))) alive.push(f);
  }
  assert.deepEqual(alive, ['js/clip-content.js'],
    `★공용 술어 정의가 ★한 자리가 ★아니다 (본 것: ${alive.join(' | ')})`);
  /* ★★둘이 ★같은 몸통이면 ★겸직이 ★돌아온 것이다 — ⛔한 쪽을 다른 쪽에서 ★파생시키지 마라(지디 2026-10-10)
     ★★★자를 ★넓혔다: ★옛 자는 ★`frameClipsPaint` 만 ★봤고 ★★공용 이름 ★`clipsContent` 를 ★★놓쳤다 */
  /* ★★㈄ ⒟ — ★여기도 ★★계열 ★전체다(⛔열거 금지 · ★위 D1 과 ★같은 까닭 · ★구별되는 이름 ★33개) */
  assert.ok(!/function frameClampsDrag[\s\S]{0,400}\b(?:clip|CLIP)[A-Za-z0-9_]*\s*[\(.]/.test(geom),
    '★★`frameClampsDrag` 이 ★★«자르나»를 ★불러 ★파생된다 — ★그게 ★겸직의 ★재발이다');

  /* ★소비자 전수 — ★뜻에 맞는 술어를 ★쓰나 */
  const byFile = {
    'js/drag-utils.js': 'clipsContent',        /* full-bleed 가 잘리나 = ★그림 쪽 (㈄ 2026-10-10 에 ★공용으로) */
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
