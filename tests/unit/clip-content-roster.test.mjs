/* clip-content-roster — 「★내용 자르기」의 ★★★술어·표가 ★★한 자리인가를 ★재는 자 (2026-10-10 · 현빈 1010t1c2)
 *
 * ★★왜 있나 — ★이 레포에서 ★★«자름»을 ★★같은 물음으로 ★세 번 물었고 ★★세 번 ★다른 답을 얻었다:
 *   ⑴ ★CSS 전수   ⇒ 「★그리드는 ★자름이 ★없다」            ← ★틀렸다(★렌더러 ★인라인을 ★안 봤다)
 *   ⑵ ★인라인 보고 ⇒ 「★★이미 ★자른다」                    ← ★틀렸다(★★«원형» 갈래만이었다)
 *   ★★⑶ ★★computed 로 ★재서 ⇒ 「★★꼴마다 ★다르다」          ← ★★맞았다(★소스 주석과 ★일치)
 * ⇒ ★★★처방: ★★«자르는 자가 ★없다»를 ★★CSS 전수로 ★말하지 ★마라. ★자름은 ★★세 자리에 산다:
 *     ⑴ CSS 규칙 ⑵ ★★렌더러가 ★박는 ★인라인 ⑶ ★앱이 ★나중에 ★쓰는 ★인라인
 *   ⇒ ★★«없다»는 ★★computed(★행위)로 ★재라 ＋ ★★«인라인이 ★비었나»를 ★★전제로 ★단언하라
 *   ⇒ ★★그리고 ★★«한 블럭에 ★꼴이 ★여럿이면 ★«전수»는 ★★꼴별로 ★세라»
 *
 * ★★안 재는 것(⛔「닫았다」로 적지 않는다)
 *   · ★★실제로 ★잘리나 — ★그건 ★DOM 이 ★행위로 잰다(★`asset-clip-toggle` 칸)
 *   · ★★그리드 ★평형의 ★토글 — ★★★범위 ★밖이다(★flex `min-height:auto` 0 붕괴 · ★별건으로 기록됨)
 *
 * ★★★표 ⑵ — ★★«칠(paint) 술어의 ★명부» (2026-10-10 ㈄ · ★합치기 ★전에 ★쟀다)
 *   ★제품 호출                  ★1건  ★`js/drag-utils.js`(effectiveSectionPadX 안)
 *   ★그 함수를 ★부르는 자리       ★5곳  drag-utils · prop-page(window) · prop-banner02 · prop-frame · template-system(window)
 *   ★이름으로 ★소스를 ★자르는 자리 ★1건  ★`tests/unit/block-full-bleed.test.mjs` 하네스
 *   ★★그 이름을 ★칸 본문에서 ★쓰는 칸 ★★7칸 (★핀 판 667f2105 기준)
 *       P1d · P1d-2 · P1d-3 (block-full-bleed) · P1 · P2 · C3 · C4 (frame-clips-predicate)
 *   ★그 줄에 ★닿지만 ★술어가 ★★안 불리는 칸 ★2칸  P1b · P1e (★단축평가)
 *   ★★하네스가 ★싣는 ★조각 = ★★1 → ★★3 (★이 파일의 술어는 ★계열 판정 ＋ ★기본값 표와 ★한 벌이다)
 *
 * ★★★⚠️그 ★7 은 ★★세 번 ★틀렸다가 ★★세 번째에 ★선 수다 — ★★그 과정을 ★남긴다:
 *   ★9(하한) → ★8 → ★★★7
 *   ㉠ ★「★다음 test( 까지」로 ★칸을 ★자르면 ★★칸 ★사이 ★주석이 ★앞 칸 몫이 된다 ⇒ ★거짓 양성
 *   ㉡ ★「괄호 균형」으로 ★자르면 ★★정규식 리터럴의 ★여는 괄호를 ★세서 ★★칸이 ★뒤를 ★다 먹는다 ⇒ ★거짓 양성
 *   ⇒ ★★그래서 ★자를 ★★둘(★줄 규약 ＋ ★중괄호 균형) 돌려 ★★어긋나면 ★판정하지 ★않는다
 *      ★자 = ★`~/.gd-work/t3frame/count-cells.py`
 *   ★★★교훈: ★「★N(하한)」이라 ★적었는데 ★참값이 ★더 작으면 ★★그건 ★하한이 ★아니라 ★★그냥 ★틀린 수다
 *
 * ★★★⚠️표가 ★★둘이다 — ⛔섞으면 ★분모가 ★틀린다
 *   ★★위 표 ⑵ = ★「★어느 칸이 ★그 ★술어를 ★지나나」
 *   ★★표 ⑴   = ★「★★무엇을 ★재나(죔/그림/혼합)」 ⇒ ★★`tests/dom/frame-clip-drag.dom.spec.js` ★머리말
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import { createRequire } from 'node:module';
const { stripCommentsTA, templateBalanced } = createRequire(import.meta.url)('./_strip-comments.js');
const R = new URL('../../', import.meta.url);
const read = (p) => readFileSync(new URL(p, R), 'utf8');
const code = (p) => {
  const src = read(p);
  assert.equal(templateBalanced(src), true, `★전제: ${p} 의 템플릿이 ★안 닫혔다 — ★그 뒤를 ★«안 본» 것이다`);
  return stripCommentsTA(src);
};

/** ★그 모듈을 ★«함수로» 불러 ★값을 ★잰다 — ⛔글자 단언만으론 ★표가 ★맞는지 ★못 잰다 */
function load() {
  const src = code('js/clip-content.js');
  const body = src.replace(/^\s*export\s+/gm, '').replace(/^if \(typeof window[\s\S]*$/m, '');
  return new Function(body + '\nreturn { clipsContent, clipFamily, CLIP_DEFAULTS };')();
}
const el = (cls, ds) => ({ classList: { contains: (c) => cls.includes(c) }, dataset: ds || {} });

test('A1 ★★계열 표가 ★★이 파일 ★하나에 있다 — ★★기본값 ★넷', () => {
  const { CLIP_DEFAULTS } = load();
  assert.deepEqual(Object.keys(CLIP_DEFAULTS).sort(), ['asset', 'frame', 'gridCircle', 'gridPlain']);
  /* ★★★행위로 ★잰 값 ★그대로 — ⛔여기 수를 ★바꾸려면 ★★다시 재라 */
  assert.equal(CLIP_DEFAULTS.frame, true, '★프레임 기본 = 자름(2026-10-10 ②)');
  assert.equal(CLIP_DEFAULTS.asset, true, '★에셋 기본 = 자름(`.asset-img-clip` · ★행위로 쟀다)');
  assert.equal(CLIP_DEFAULTS.gridCircle, true, '★그리드 ★원형 = 자름(렌더러 인라인)');
  assert.equal(CLIP_DEFAULTS.gridPlain, false,
    '★★그리드 ★평형 = ★★안 자름 — ★★★일부러다(★flex min-height:auto 0 붕괴 · grid-block.js ㈐)');
});

test('A2 ★★★«속성이 ★있을 때만» 이긴다 — ★★기본값을 ★안 바꾼다 (★옛 바이트 보존)', () => {
  const { clipsContent } = load();
  for (const [cls, dflt] of [[['frame-block'], true], [['asset-block'], true],
                             [['grd-img-frame', 'grd-img-circle'], true], [['grd-img-frame'], false]]) {
    assert.equal(clipsContent(el(cls, {})), dflt, `★[${cls.join('.')}] ★속성 ★없으면 ★계열 기본값`);
    assert.equal(clipsContent(el(cls, { clipContent: 'true' })), true, `★[${cls.join('.')}] 'true' ⇒ 자름`);
    assert.equal(clipsContent(el(cls, { clipContent: 'false' })), false, `★[${cls.join('.')}] 'false' ⇒ 안 자름`);
  }
  /* ★★계열을 ★모르면 ★★`null` — ⛔`false` 가 ★아니다(★「영은 ★답이 ★아니다」) */
  assert.equal(clipsContent(el(['text-block'], {})), null, '★모르는 계열은 ★null — ⛔false 로 ★때우지 않는다');
  assert.equal(clipsContent(null), null, '★없는 것도 ★null');

  /* ⚰️★★★2026-10-10 ㈄ — ★`tests/unit/frame-clips-predicate.test.mjs` 의 ★`P1`·`P2` 에서 ★★옮겨 왔다.
       ★까닭: ★그 둘은 ★★`frameClipsPaint` 의 진리표였고, ★★그 술어가 ★★이 파일의 ★`clipsContent` 로
         ★합쳐졌다 ⇒ ★★거기 두면 ★★명부가 ★★둘이 된다(★같은 물음을 ★두 자리에서 ★센다).
       ⇒ ★★그래서 ★★«지우고 ★옮긴» 것이고 ⛔«지운» 것이 ★아니다. ★아래 넷이 ★그 고유 다리다. */
  /* ⑴ ★★«정확히 `'false'`» 만 ★끔이다 — ★그 밖의 값은 ★★계열 기본값으로 ★돌아간다 */
  assert.equal(clipsContent(el(['frame-block'], { clipContent: '' })), true,
    '★빈 값도 ★끔이 ★아니다 (★옛 P2 — ★예전엔 ★«끔 = 속성 삭제»였고 ★그 꼴이 ★남으면 ★토글이 ★먹통이 된다)');
  assert.equal(clipsContent(el(['frame-block'], { clipContent: 'FALSE' })), true,
    '★대문자는 ★끔이 ★아니다 (★값은 ★정확히 `false` · ★옛 P2)');
  /* ⑵ ★★`radius` 는 ★이 판정과 ★★무관하다 — ★★2026-10-10 부터 ★기준이 ★아니다 (★옛 P1) */
  assert.equal(clipsContent(el(['frame-block'], { radius: '8' })), true,
    '★둥근 모서리가 ★판정을 ★바꿨다 — ★기본이 ★자름이라 ★radius 는 ★무관해야 한다');
  assert.equal(clipsContent(el(['frame-block'], { radius: '0', clipContent: 'false' })), false,
    '★radius 0 ＋ ★명시 끔 ⇒ ★끔이 ★이긴다');
  /* ⑶ ★★나쁜 입력 — ⛔던지지 ★않는다. ★★★단 ★뜻이 ★갈렸다:
       ★옛 `frameClipsPaint(bad)` ⇒ ★★`false` · ★새 `clipsContent(bad)` ⇒ ★★`null`
       ⇒ ★★그 차이를 ★★여기 ★박아 둔다(★다음 사람이 ★`false` 를 ★기대하면 ★이 줄이 ★말해 준다) */
  for (const bad of [null, undefined, 0, '', 'frame-block']) {
    assert.equal(clipsContent(bad), null,
      `★${String(bad)} 에서 ★던지지 ★말고 ★★null (⛔`+"`false`"+` 가 ★아니다 — ★옛 술어와 ★갈리는 ★그 자리)`);
  }
});

test('A3 ★★소비자가 ★제 벌로 ★다시 세지 ★않는다 — ★★명부 ★하나 (지디 조건 ㉠)', () => {
  /* ★`data-clip-content` / `clipContent` 를 ★★읽는 자리 ★전수 — ★그 ★표를 ★안 거치면 ★명부가 ★둘이다 */
  const files = [];
  const walk = (d) => {
    for (const e of readdirSync(new URL(d + '/', R), { withFileTypes: true })) {
      if (e.isDirectory()) walk(d + '/' + e.name);
      else if (/\.js$/.test(e.name)) files.push(d + '/' + e.name);
    }
  };
  walk('js');
  const ALLOW = new Set([
    'js/clip-content.js',        /* ★표와 술어의 ★임자 */
    'js/frame-geometry.js',      /* ⚰️★2026-10-10 ㈄ 로 ★선행 술어를 ★★여기(clip-content.js)로 ★합쳤다.
                                    ★그래도 ★명부에 ★남긴다 — ★죔이 ★★그 파일에 ★살아 있고, ★거기서 ★판정이 ★되살아나면 ★잡아야 한다.
                                    ⚠️★옛 주석의 ★「11칸이 잠근다」는 ★★틀렸다 — ★★11칸은 ★죔 쪽이고, ★칠 술어는 ★★7칸이었다(★위 표 ⑵) */
  ]);
  const hits = [];
  for (const f of files) {
    if (ALLOW.has(f)) continue;
    code(f).split('\n').forEach((l, i) => {
      /* ⚠️★★1차 자는 ★★«쓰기»까지 ★셌다(5건) — ★★그중 ★4 는 ★`= 'true'` 꼴의 ★★대입이었다.
         ⇒ ★★★«제 벌로 ★판정한다»는 ★★★비교다. ⛔대입은 ★판정이 ★아니다 ⇒ ★자를 ★좁힌다.
         ★★그리고 ★★좁힌 뒤 ★★양성이 ★서나를 ★★A5 가 ★잰다(★좁히기가 ★눈을 ★감기지 ★않게) */
      if (/clipContent\s*(?:===|!==|==|!=)|data-clip-content="(?:true|false)"\]/.test(l)) {
        hits.push(`${f}:${i + 1} ${l.trim().slice(0, 80)}`);
      }
    });
  }
  console.log(`A3 ★표 밖에서 ★제 벌로 ★세는 자리 ${hits.length}건`);
  assert.deepEqual(hits, [],
    '★★`clipContent` 를 ★★표 ★밖에서 ★★제 벌로 ★판정하는 자리가 ★있다 — ★★명부가 ★둘이 된다'
    + ' ⇒ ★`js/clip-content.js` 의 ★`clipsContent()` 를 ★부르게 고쳐라');
});

test('A5 ★★★양성대조 — ★좁힌 자가 ★★«판정»을 ★정말 ★잡나 (＋대입은 ★안 잡나)', () => {
  /* ⛔없으면 ★★A3 의 ★0건이 ★★«자를 ★너무 좁혀 ★아무것도 ★못 본다»와 ★구분이 ★안 된다 */
  const RE = /clipContent\s*(?:===|!==|==|!=)|data-clip-content="(?:true|false)"\]/;
  assert.equal(RE.test("if (ss.dataset.clipContent !== 'false') {"), true, '★★판정을 ★못 잡는다 — ★자가 ★죽었다');
  assert.equal(RE.test("const on = d.clipContent === 'true';"), true, '★★판정을 ★못 잡는다');
  assert.equal(RE.test('css.includes(\'[data-clip-content="true"]\')'), true, '★CSS 선택자 꼴도 ★잡아야');
  assert.equal(RE.test("ab.dataset.clipContent = 'true';"), false, '⛔대입을 ★판정으로 ★센다');
  assert.equal(RE.test('delete ab.dataset.clipContent;'), false, '⛔삭제를 ★판정으로 ★센다');
});

test('A4 ★★에셋의 ★자름을 ★★«렌더러»가 ★먹인다 — ⛔`!important` 로 ★CSS 가 ★이기게 ★하지 ★않는다', () => {
  const mod = code('js/clip-content.js');
  assert.match(mod, /removeProperty\('overflow'\)/,
    '★★켬이면 ★★인라인을 ★★지워야 한다 — ★그게 ★★옛 바이트 ★보존이다(★CSS 가 ★그대로 ★자른다)');
  assert.ok(!/!important/.test(mod), '⛔`!important` 가 ★들어왔다 — ★지디 판정(2026-10-10)과 ★어긋난다');
  const ih = code('js/image-handling.js');
  assert.equal((ih.match(/applyAssetClip\(ab\)/g) || []).length, 2,
    '★★렌더 갈래가 ★둘(★영상·★그림)이고 ★★둘 다 ★먹여야 한다 — ★한쪽만이면 ★★«꼴마다 다름»이 ★또 생긴다');
  const pa = code('js/props/prop-asset.js');
  assert.match(pa, /asset-clip-toggle/, '★패널 토글이 ★없다');
  assert.match(pa, /delete ab\.dataset\.clipContent/,
    '★★★기본값과 ★같아지면 ★★속성을 ★지워야 한다 — ⛔늘 쓰면 ★★기존 문서의 ★저장 바이트가 ★달라진다');
});
