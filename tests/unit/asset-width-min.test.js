/* U-ASSETWIDTHMIN — 에셋(이미지) 블럭 «폭 하한»은 «한 자리»에서 오고 그 값은 60 인가.
 *   (현빈 결정 2026-09-20 ㉠ = T-075 / 구현 카드 T-078:
 *    「이미지 블럭 폭 하한을 패널에서도 60 으로 낮춘다」)
 *   실행: node --test "tests/unit/*.test.mjs" "tests/unit/*.test.js"
 *
 * ★무엇이 결함이었나 (dev@20e50e3 → e3c2638, 헤드리스 크로미움 실측)
 *   스크래치패드는 아이템을 60px 까지 줄인다(scratch-pad.js 의 fMin). 그 크기 그대로 섹션에
 *   들어온 60px 블럭을 우측패널에서 고르면 —
 *     · 슬라이더는 «100» 을, 숫자칸은 «60» 을 보여 준다(range 인풋이 min 밑의 value 를 끌어올린다)
 *     · 그 상태에서 폭에 손을 대면(슬라이더를 튕기거나 숫자칸을 커밋하거나) 100 으로 올라앉는다
 *     · 모서리 핸들을 «1px» 만 움직여도 100 이 된다 (overlay-handles 의 클램프도 100 이었다)
 *   ⇒ 하한이 «세 자리»(슬라이더 min · 숫자칸 min+커밋 clamp · 핸들 clamp)에 흩어져 있었다.
 *
 * ★이 파일이 막는 변이
 *   ⑴ 하한을 리터럴로 «되돌려» 적는 것 (S-1·S-2·S-4)
 *   ⑵ 세 자리 중 «한 자리만» 고치는 것 — 특히 핸들을 빼먹는 것 (S-4) ← 신고가 다시 사는 길
 *   ⑶ 값을 60 이 아닌 다른 수로 바꾸는 것 (S-1)
 *   ⑷ `parseInt(v) || 860` 이 «0 과 빈 칸을 같은 것으로» 보는 것 (S-3)
 *      — 둘 다 falsy 라 폴백 860 으로 떨어진다. 0 은 「가장 작게」, 빈 칸은 「값 없음」이다.
 *   ⑸ ★가드 — 목업·캔버스 블럭의 하한 100 까지 같이 끌어내리는 것 (S-5, 현빈: 「목업은 별개」)
 *
 * ⚠️여기는 «소스 대조»까지다. 진짜 폭 px 는 tests/dom/asset-width-min.dom.spec.js 가
 *   크로미움에서 잰다. 그 파일은 `npm test` 스위트에 «안» 들어가므로 변이를 빨갛게 만드는
 *   책임은 이 파일이 진다(같은 규약: scratch-drop-size.test.js 머리말).
 */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readSrc } = require('./_srcread.js');
const { stripComments } = require('./_strip-comments.js');
/* ⛔구간의 «끝»을 꼬리 문자열(`\n}` 따위)로 찾지 않는다 — 셈으로 찾는 공용 부품을 쓴다.
   (레포 가드 slice-block-shared.test.js SB-16 이 이걸 «검사로» 강제한다 — 실제로 내 초판이 걸렸다.) */
const { sliceBlock, sliceCall } = require('./_slice-block.js');

const ROOT = path.join(__dirname, '..', '..');
const LIMITS_REL = ['js', 'blocks', 'asset-width-limits.js'];

/* ⚠️파일이 «없어도» 모듈 로드에서 던지지 않는다 — 던지면 5건이 「파일 1건 실패」로 뭉쳐
     어느 자리가 빠졌는지 안 보인다(음성대조를 읽을 수 없게 된다). 없으면 S-1 이 말한다. */
const safeRead = (...segs) => (fs.existsSync(path.join(ROOT, ...segs)) ? readSrc(ROOT, ...segs) : '');

const RAW = {
  limits:  safeRead(...LIMITS_REL),
  asset:   readSrc(ROOT, 'js', 'props', 'prop-asset.js'),
  handles: readSrc(ROOT, 'js', 'overlay-handles.js'),
  mockupP: readSrc(ROOT, 'js', 'props', 'prop-mockup.js'),
};
const SRC = Object.fromEntries(Object.entries(RAW).map(([k, v]) => [k, stripComments(v)]));

const fnBody = (src, name) => sliceBlock(src, 'function ' + name + '(');
const count = (hay, needle) => hay.split(needle).length - 1;

/* ─────────────────────────────────────────────────────────────────────────── */

test('S-1 하한은 asset-width-limits.js 한 파일에서만 «선언»되고 값은 60 이다', () => {
  assert.ok(fs.existsSync(path.join(ROOT, ...LIMITS_REL)),
    '★js/blocks/asset-width-limits.js 가 없다 — 하한의 «단 하나의 자리»가 사라졌다');

  const m = SRC.limits.match(/export\s+const\s+ASSET_W_MIN\s*=\s*(\d+)\s*;/);
  assert.ok(m, '★asset-width-limits.js 가 ASSET_W_MIN 을 export 하지 않는다');
  assert.strictEqual(m[1], '60',
    `★현빈 결정 ㉠ 은 60 이다(실제 ${m[1]}). 바꾸려면 결정부터 바꿔라`);

  // ⛔중복 선언 금지 — 다른 파일이 같은 이름으로 자기 값을 갖는 순간 두 개의 하한이 생긴다.
  const decl = [];
  for (const dir of ['js', path.join('js', 'blocks'), path.join('js', 'props'), path.join('js', 'panels')]) {
    for (const f of fs.readdirSync(path.join(ROOT, dir))) {
      if (!f.endsWith('.js')) continue;
      const rel = path.join(dir, f);
      if (rel === path.join(...LIMITS_REL)) continue;
      const code = stripComments(readSrc(ROOT, rel));
      if (/(?:const|let|var)\s+ASSET_W_MIN\s*=/.test(code)) decl.push(rel);
    }
  }
  assert.deepStrictEqual(decl, [],
    `★ASSET_W_MIN 을 다시 «선언»한 파일이 있다: ${decl.join(', ')} — 하한은 한 자리다`);
});

test('S-2 패널 폭 슬라이더·숫자칸의 min 이 «리터럴이 아니다»', () => {
  assert.match(SRC.asset, /import\s*\{\s*ASSET_W_MIN\s*\}\s*from\s*'\.\.\/blocks\/asset-width-limits\.js'/,
    '★prop-asset.js 가 ASSET_W_MIN 을 안 가져온다');

  for (const id of ['asset-w-slider', 'asset-w-number']) {
    const row = SRC.asset.split('\n').find(l => l.includes(`id="${id}"`));
    assert.ok(row, `★${id} 를 못 찾았다`);
    assert.ok(row.includes('min="${ASSET_W_MIN}"'),
      `★${id} 의 min 이 상수가 아니다 — 지금 줄: ${row.trim()}`);
  }
  /* 높이(200)·모서리(0)·그레인(0) 은 이 카드의 범위가 «아니다» — 건드렸으면 여기서 걸린다.
     ★2026-09-20 통합(int/0920b) — 검사 «모양»만 고쳤다(뜻은 그대로).
       이 줄은 원래 `min="200"` 리터럴을 찾았다. 같은 날 다른 유닛(T-075 스크래치 드롭)이
       높이 눈금을 적응형으로 바꿨다 — `H_MIN = Math.min(200, currentH)`.
       그건 «하한을 낮춘 것»이 아니라 «이미 200 보다 낮은 블록에서만 눈금을 넓힌 것»이라
       이 가드가 지키려던 뜻(「높이 하한 200 을 건드리지 마라」)은 그대로다.
       ⇒ 리터럴 대신 «하한 200 이 H_MIN 선언에 살아 있는가»를 본다 — 더 좁은 검사다:
         `Math.min(200, …)` 의 200 을 바꾸면(예: 100) 여기서 걸린다. */
  const h = SRC.asset.split('\n').find(l => l.includes('id="asset-h-slider"'));
  assert.ok(/min="\$\{(?:200|H_MIN)\}"|min="200"/.test(h),
    `★높이 슬라이더 min 이 200 도 H_MIN 도 아니다 — 지금 줄: ${h.trim()}`);
  assert.match(SRC.asset, /const\s+H_MIN\s*=\s*Math\.min\(\s*200\s*,/,
    '★높이 하한 200 이 사라졌다 — 이 카드의 범위가 아니다(그대로 둬라)');
  /* ＋«폭»에는 적응형 하한이 다시 생기면 안 된다 — 현빈 결정 ㉠ 은 «상수 60» 이다.
     (통합 전 scratch-modal 쪽에 있던 `W_MIN = Math.min(100, currentW)` 가 그 꼴이었다.) */
  assert.ok(!/const\s+W_MIN\s*=/.test(SRC.asset),
    '★폭에 적응형 하한(W_MIN)이 돌아왔다 — 하한은 ASSET_W_MIN «한 자리»다');
});

test('S-3 숫자칸 커밋 — 하한은 상수 · «0»과 «빈 칸»을 갈라서 다룬다', () => {
  // ★여는 `{` 가 괄호 «안»에 있는 자리 = sliceCall (머리부터 열린 괄호가 전부 닫힐 때까지)
  const stanza = sliceCall(SRC.asset, "wNumber.addEventListener('change'");

  assert.ok(stanza.includes('Math.max(ASSET_W_MIN,'),
    `★폭 커밋 clamp 의 하한이 상수가 아니다 — 지금: ${stanza.trim()}`);
  assert.ok(!/Math\.max\(\s*100\s*,/.test(stanza),
    '★폭 커밋 clamp 에 100 리터럴이 남아 있다');

  /* ★하한 숫자만 60 으로 바꿔서는 «안» 닫히는 문 —
       `parseInt(v) || 860` 은 0 과 빈 칸을 둘 다 falsy 로 흘려 폴백 860(꽉참)으로 보낸다.
       0 = 「가장 작게」(하한으로 막을 것) · 빈 칸 = 「값 없음」(커밋하지 말 것)로 갈라야 한다. */
  assert.ok(!/parseInt\(\s*wNumber\.value[^)]*\)\s*\|\|/.test(stanza),
    '★`parseInt(...) || 860` 이 돌아왔다 — 0 과 빈 칸이 둘 다 풀블리드로 날아간다');
  assert.ok(stanza.includes('Number.isFinite('),
    '★숫자와 «값 없음»을 가르는 판정(Number.isFinite)이 없다');
  assert.match(stanza, /if\s*\(\s*!Number\.isFinite\([^)]*\)\s*\)[\s\S]*?return;/,
    '★빈 칸에서 «커밋하지 않고 빠져나가는» 길이 없다 — 지우다 만 칸이 폭을 바꾸면 안 된다');

  // 빠져나가는 길에 pushHistory 가 있으면 «안 한 일»이 ⌘Z 한 칸을 먹는다.
  const bail = stanza.slice(stanza.indexOf('!Number.isFinite'), stanza.indexOf('return;'));
  assert.ok(!bail.includes('pushHistory'),
    '★빈 칸 경로에서 pushHistory 를 부른다 — 아무 일도 없었는데 히스토리가 쌓인다');

  // 되돌릴 값은 패널이 열릴 때 쓴 «같은 셈»이어야 한다(두 벌로 갈라지면 값이 어긋난다).
  assert.ok(stanza.includes('readW()'), '★빈 칸에서 되돌릴 폭을 readW() 로 읽지 않는다');
  assert.strictEqual(SRC.asset.split('const readW = ').length - 1, 1,
    '★readW 가 한 곳에서만 «정의»돼야 한다');
});

test('S-4 ★모서리 핸들도 «같은 상수»를 본다 (패널만 고치면 이 문으로 100 이 돌아온다)', () => {
  assert.match(SRC.handles, /import\s*\{\s*ASSET_W_MIN\s*\}\s*from\s*'\.\/blocks\/asset-width-limits\.js'/,
    '★overlay-handles.js 가 ASSET_W_MIN 을 안 가져온다');

  const body = fnBody(SRC.handles, '_onAssetResizeHandleMouseDown');
  assert.strictEqual(count(body, 'Math.max(100,'), 0,
    '★에셋 리사이즈 핸들에 하한 100 이 남아 있다 — 60px 블럭을 1px 만 끌어도 100 이 된다');
  assert.ok(count(body, 'Math.max(ASSET_W_MIN,') >= 4,
    `★에셋 핸들의 폭 clamp 가 상수를 안 본다(발견 ${count(body, 'Math.max(ASSET_W_MIN,')}곳, 기대 4곳 이상)`);
});

test('S-5 ★가드 — 목업·캔버스 블럭의 하한 100 은 그대로다 (현빈: 「목업은 별개」)', () => {
  const mockupBody = fnBody(SRC.handles, '_onMockupHandleMouseDown');
  assert.ok(mockupBody.includes('Math.max(100,'),
    '★목업 핸들의 하한 100 이 사라졌다 — 현빈은 목업을 «건드리지 말라»고 했다');
  assert.ok(!mockupBody.includes('ASSET_W_MIN'),
    '★목업 핸들이 에셋 상수를 본다 — 두 블럭의 하한이 한 수에 묶였다');

  const canvasBody = fnBody(SRC.handles, '_onCanvasResizeHandleMouseDown');
  assert.ok(canvasBody.includes('Math.max(100,'),
    '★캔버스 블럭 핸들의 하한 100 이 사라졌다 — 이 카드의 범위가 아니다');

  assert.ok(/Math\.max\(\s*100\s*,/.test(SRC.mockupP),
    '★prop-mockup.js 의 하한 100 이 사라졌다 — 목업 패널은 이 카드의 범위가 아니다');
});
