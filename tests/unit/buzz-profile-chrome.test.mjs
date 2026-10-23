/* buzz-profile-chrome — 프로필의 «에디터 크롬» 쪽 계약(1017t1l2 · 현빈 1018t1-l2b/l2c).
 *
 * ★왜 소스를 재나 — × 단추의 «보임/안 보임»은 CSS 가 쥐고 있고, 그것을 행동으로 재는 자(DOM 검사)는
 *   이 맥에서 못 돌린다(메모리 바닥). ⇒ 「그 규칙이 ★있나 · ★어느 범위에 걸렸나」까지만 소스에서 잰다.
 *   ⚠️그래서 이 파일은 ★«그려진 결과»를 안 잰다 — 그 칸은 ⛔아직 비어 있다(보고서에 적었다).
 *
 * ★무엇을 잠그나
 *   C0 전제   — 자(주석 거르개)가 실제로 주석을 걷는다. ⛔주석에 적힌 이름이 «진짜 규칙»으로 읽히면
 *               이 파일의 모든 수가 거짓이 된다(css/editor-blocks.css 가 그 사고를 두 번 적어 뒀다).
 *   C1 기본 규칙에 ★범위가 없다 — 캔버스 밖(PNG 캡처 클론 · 내보낸 HTML)에서도 ★안 보여야 한다.
 *   C2 보이게 하는 규칙은 ★캔버스 범위다(현빈 l2b 「호버시 나타나게」).
 *   C3 모달에 overflow 규칙이 ★0건 — 현빈 l2c 「배경을 벗어나서 오버레이」의 근거다.
 *       ＋★양성대조: 같은 자로 프레임을 재면 ★≥1 건이 잡힌다(= 이 자가 overflow 를 볼 줄 안다).
 *   C4 ★세 자리 쌍 계약 — 저장(NON_CONTENT_UI_SELECTOR) · 직렬화 세척 · 내보내기 셋 다에 올라 있다.
 *   C5 패널은 «제 수»를 안 갖는다 — 경계(24/400)를 리터럴로 안 쓰고 모달 한 표를 벌린다.
 *   C6 버즈 패널은 낱개 dataset 에 직접 쓰지 않는다 — 묶음 창구(setBuzzProfile) 한 자리로 간다.
 *   C7 ★「뜨는 칸」과 「배선」이 짝이다 — 마크업에 난 id 가 배선 쪽에도 나온다(「뜨는 것」≠「도는 것」).
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const { readSrc } = require('./_srcread.js');
const { makeStripper } = require('./_strip-comments.js');
const REPO = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');

const CSS_REL = 'css/editor-blocks.css';
const X_CLASS = '.mdl-profile-x';

/** 파일 하나를 «주석 걷은 코드 줄»의 배열로. */
function codeLines(rel, opts) {
  const strip = makeStripper(opts);
  return readSrc(REPO, rel).split('\n').map((ln) => strip(ln));
}
/** 그 선택자가 «규칙 머리»로 쓰인 줄들(주석 제외). */
const headsFor = (lines, needle) =>
  lines.filter((ln) => ln.includes(needle) && ln.includes('{'));

test('C0 전제 — 거르개가 실제로 주석을 걷는다(안 그러면 아래 수가 전부 거짓)', () => {
  const strip = makeStripper();
  assert.equal(strip('/* .mdl-profile-x { opacity: 1 } */').trim(), '',
    '주석 한 줄이 그대로 남았다 — 주석에 적은 이름이 «진짜 규칙»으로 읽힌다');
  assert.equal(strip('.mdl-profile-x { opacity: 0; } /* 꼬리 주석 */').trim(), '.mdl-profile-x { opacity: 0; }');
});

test('C1 기본 규칙에 범위가 없다 — 캔버스 밖에서도 «안 보인다»가 기본이어야 한다', () => {
  const lines = codeLines(CSS_REL);
  const heads = headsFor(lines, X_CLASS);
  assert.ok(heads.length >= 1, `${X_CLASS} 규칙이 ${CSS_REL} 에 없다`);
  const bare = heads.filter((ln) => !ln.includes('#canvas'));
  assert.equal(bare.length, 1, `범위 없는 기본 규칙이 ${bare.length}개 — 정확히 하나여야 한다:\n${heads.join('\n')}`);

  /* 그 규칙의 본문에 «안 보인다»의 두 칸이 실제로 들어 있나. */
  const src = readSrc(REPO, CSS_REL);
  const at = src.indexOf(bare[0].trim());
  const body = src.slice(at, src.indexOf('}', at));
  assert.match(body, /opacity:\s*0\s*;/, '기본이 opacity 0 이 아니면 내보낸 쪽에서 단추가 보인다');
  assert.match(body, /pointer-events:\s*none\s*;/, '기본이 pointer-events none 이 아니면 안 보이는 단추가 클릭을 먹는다');
});

test('C2 보이게 하는 규칙은 «캔버스 범위»다(현빈 l2b 「호버시 나타나게」)', () => {
  const lines = codeLines(CSS_REL);
  const reveal = headsFor(lines, X_CLASS).filter((ln) => ln.includes(':hover'));
  assert.equal(reveal.length, 1, `호버 규칙이 ${reveal.length}개 — 정확히 하나여야 한다`);
  assert.ok(reveal[0].includes('#canvas'),
    '호버 규칙에 캔버스 범위가 없다 — 내보낸 HTML 에서도 마우스를 올리면 단추가 뜬다');
  assert.ok(reveal[0].includes('.mdl-profile:hover'),
    '호버의 주어가 «프로필»이 아니다 — 현빈은 「프로필에 마우스 올릴 때」를 고르셨다(시안 ⑶)');
});

test('C3 모달에 overflow 규칙 0건 ＋ ★양성대조(같은 자로 프레임은 ≥1건)', () => {
  const lines = codeLines(CSS_REL);
  /* 규칙 머리 → 그 블록 안의 선언을 줄 단위로 훑는다(중괄호 깊이로). */
  function overflowCountFor(selNeedle) {
    let depth = 0, inTarget = false, hits = 0;
    for (const ln of lines) {
      if (depth === 0 && ln.includes('{')) inTarget = ln.includes(selNeedle);
      depth += (ln.match(/\{/g) || []).length;
      if (depth > 0 && inTarget && /(^|[\s;])overflow\s*:/.test(ln)) hits++;
      depth -= (ln.match(/\}/g) || []).length;
      if (depth <= 0) { depth = 0; inTarget = false; }
    }
    return hits;
  }
  const frame = overflowCountFor('.frame-block');
  assert.ok(frame >= 1,
    `★양성대조 실패 — 프레임에서 overflow 선언을 ${frame}건 잡았다. 이 자가 overflow 를 못 보고 있다(아래 0건은 「없다」가 아니라 「안 봤다」)`);
  const modal = overflowCountFor('.modal-block');
  assert.equal(modal, 0,
    `모달에 overflow 규칙이 ${modal}건 생겼다 — 커진 프로필이 카드 배경 밖으로 못 나간다(현빈 l2c 가 깨진다)`);
});

test('C4 세 자리 쌍 계약 — ★저장 명부 · ★직렬화 세척에 ★이름이 있고, ★내보내기는 ★«그 상수에 닿는 길»이 섰다(261023)', () => {
  /* ★★261023 — ★첫 자리가 ★`js/io/save-load.js` → ★★`js/io/editor-ui-roster.js` 로 ★움직였다.
     ★까닭 = ★R1 처방(캡처 겹도 ★같은 상수를 봐야 하는데 ★거꾸로 import 하면 ★순환) ⇒ ★잎 모듈로 뺐다.
     ★★이 칸이 ★빨개져서 ★그 이사를 ★알려 줬다 — ⛔「경로가 바뀌었다」로 ★끄지 말고 ★자리를 ★옮긴다.
     ⚠️★캡처 겹은 ★여기 ★넣지 않는다 — ★이제 ★★그 상수를 ★읽어서 ★«이름이 적혀 있지» 않다.
        ★그 자리를 재는 자 = ★pan-native-scroll.test.js ★P-A1″ 의 ★마지막 단언. */
  /* ★★★261023 (둘째 고침) — ★셋째 자리가 ★★«이름»에서 ★★«길»로 ★바뀌었다.
     ★무슨 일 : `js/io/export-html.js:130` 이 ★`.mdl-profile-x` 를 ★손으로 지우고 있었는데,
       ★★그 줄이 ★★★죽었다 — ★:112 의 `stripEditorOnlyForCapture` 가 ★★`NON_CONTENT_UI_SELECTOR` 를
       ★읽고(R1 ★8993db73), ★그 상수에 ★`.mdl-profile-x` 가 ★★이미 ★있다.
       ⇒ ★★죽은 줄을 ★걷었다(★비석은 그 자리에). ⇒ ★★이 칸이 ★빨개져서 ★알려 줬다 — ★★제 일을 했다.
     ★★★그래서 ★★«이름이 세 곳에 적혀 있나»로는 ★더 못 잰다 —
       ★내보내기는 ★이제 ★★«상수를 ★경유»하므로 ★그 파일에 ★★이름이 ★없는 게 ★★맞다.
     ⇒ ★★★셋째 칸을 ★★«길이 ★이어져 ★있나»로 ★바꾼다. ★★그게 ★이름보다 ★★센 단언이다 —
       ★이름 ★하나가 아니라 ★★그 상수의 ★★전부를 ★잠근다.
     ⛔「경로가 바뀌었다」로 ★끄지 ★마라 · ⛔다시 ★이름을 ★베껴 넣지 ★마라(★그러면 ★또 ★둘째 명부다). */
  const places = [
    ['js/io/editor-ui-roster.js', 'NON_CONTENT_UI_SELECTOR'],
    ['js/io/section-serialize.js', 'serializeCleanRoot 의 remove 줄'],
  ];
  const missing = [];
  for (const [rel, what] of places) {
    const lines = codeLines(rel, { templateAware: true });
    /* ⛔주석에 적은 이름은 안 센다 — 그래서 거르개를 통과한 줄만 본다(C0 이 그 자를 잰다). */
    if (!lines.some((ln) => ln.includes(X_CLASS))) missing.push(`${rel}(${what})`);
  }
  assert.deepEqual(missing, [],
    `${X_CLASS} 가 빠진 자리: ${missing.join(' · ')} — 빠진 쪽에서 에디터 단추가 저장본·내보낸 파일에 실린다`);
  /* ★★셋째 자리 — ★★«내보내기가 ★그 상수에 ★닿나». ★이름이 아니라 ★길을 잰다. */
  const EH = codeLines('js/io/export-html.js', { templateAware: true }).join('\n');
  assert.ok(/stripEditorOnlyForCapture\s*\(\s*clone\s*\)/.test(EH),
    '★내보내기(exportHTMLFile)가 ★캡처 공용 겹을 ★안 부른다 — ★그러면 ' + X_CLASS + ' 가 ★내보낸 파일에 ★실린다');
  const CS = codeLines('js/io/capture-safety.js', { templateAware: true }).join('\n');
  assert.ok(/querySelectorAll\?\.\(NON_CONTENT_UI_SELECTOR\)/.test(CS),
    '★캡처 공용 겹이 ★NON_CONTENT_UI_SELECTOR 를 ★안 읽는다 — ★길이 ★끊겼다(R1 8993db73 이 ★되돌려졌나)');
  /* ★★★양성대조 — ★이 자가 ★★죽지 않았나. ⛔없으면 ★위 둘이 ★항상 참일 수 있다. */
  assert.ok(!/querySelectorAll\?\.\(ZZ_NO_SUCH_CONST\)/.test(CS), '★양성대조 — 이 자가 ★아무 글자나 참이라 한다');
  assert.ok(EH.length > 500 && CS.length > 500,
    `★양성대조 — 소스를 ★못 읽었다(EH ${EH.length} · CS ${CS.length}) ⇒ ★위 둘이 ★«안 쟀다»다`);
});

/* ── 패널 쪽(1017t1l2) ─────────────────────────────────
   ⚠이 절도 ★소스만 잰다 — 패널을 돌리려면 진짜 DOM 이 필요하고 그 자(DOM 검사)는 이 맥에서 못 돌린다.
   ⇒ 「단추가 눈에 뜨는가」는 ★여전히 안 재고 있다(보고에 적었다). 여기서 재는 것은 «짝이 맞나»까지다. */
const MDL_PANEL = 'js/props/prop-modal.js';
const BZF_PANEL = 'js/props/prop-frame-buzz.js';

test('C5 패널은 «제 수»를 안 갖는다 — 경계는 모달 한 표에서 온다', () => {
  for (const rel of [MDL_PANEL, BZF_PANEL]) {
    const code = codeLines(rel, { templateAware: true }).join('\n');
    assert.ok(/MODAL_PROFILE_SIZE_LIMIT/.test(code), rel + ' 가 경계 표를 안 벌린다');
    for (const lit of ['min="24"', 'max="400"']) {
      assert.ok(!code.includes(lit),
        rel + ' 에 리터럴 ' + lit + ' 이 있다 — 모달 표를 고쳐도 패널이 안 따라온다');
    }
  }
});

test('C6 버즈 패널은 낱개 dataset 에 직접 쓰지 않는다 — 묶음 창구 한 자리로', () => {
  const code = codeLines(BZF_PANEL, { templateAware: true }).join('\n');
  assert.ok(/setBuzzProfile\(/.test(code), '묶음 창구를 안 쓴다');
  const writes = code.match(/dataset\.profile[A-Za-z]*\s*=/g) || [];
  assert.deepEqual(writes, [],
    '버즈 패널이 낱개 dataset 에 직접 ' + writes.length
    + '건 쓴다 — 쓰는 자리가 두 벌이 된다(사진↔이모지 반대칸 지우기가 한쪽에만 생긴다)');
});

test('C7 「뜨는 칸」과 「배선」이 짝이다 — 마크업 id 가 배선 쪽에도 나온다', () => {
  function idCounts(rel, prefixes) {
    const code = codeLines(rel, { templateAware: true }).join('\n');
    const ids = new Set();
    for (const m of code.matchAll(/id="([a-z0-9-]+)"/g)) {
      if (prefixes.some((pre) => m[1].startsWith(pre))) ids.add(m[1]);
    }
    return [...ids].sort().map((id) => [id, (code.split(id).length - 1)]);
  }
  const rows = [...idCounts(MDL_PANEL, ['mdl-pf-']), ...idCounts(BZF_PANEL, ['bzf-pf'])];
  assert.ok(rows.length >= 8,
    '프로필 칸을 ' + rows.length + '개만 찾았다 — ★전제가 깨졌다(둘 다 셌는지 보라)');
  const dead = rows.filter((r) => r[1] < 2).map((r) => r[0]);
  assert.deepEqual(dead, [],
    '마크업에만 있고 배선이 없는 칸: ' + dead.join(' · ')
    + ' — 「뜨는 것」은 「도는 것」이 아니다');
});
