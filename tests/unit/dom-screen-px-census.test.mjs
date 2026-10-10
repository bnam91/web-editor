/* ★★★«화면 px 를 ★숫자와 ★견주는 자리»가 ★늘지 않는다 — ★DOM spec 의 ★★래칫 자
 *   (지디 판정 2026-10-11 · ★기준선 = ★★«참 위험 10」이 아니라 ★★«어림이 ★잡은 25」다 — ★까닭은 ⑶)
 *
 * ★★왜 ★생겼나 (★실측 · ★머지 r14 빨강 2칸):
 *   ★`error-context.md:112` 에 ★★«40%» — ★`js/editor.js:368` 이 ★`scale(currentZoom/100)` 을 ★건다
 *   ⇒ ★★`getBoundingClientRect()` 는 ★★화면 px ⇒ ★★배율을 ★먹는다
 *   ⇒ ★★내 전제가 ★`>300`(★화면 px)이었다 ⇒ ★★배율 40% 에서 ★★★영영 ★안 섰다(⛔부하가 ★아니다)
 *   ⇒ ★★참 처방 = ★`offsetWidth`(★레이아웃 px · ★transform ★무관)
 *   ★★★그리고 ★★나는 ★그 교훈을 ★★한 시간 전에 ★적재하고도 ★★같은 커밋에서 ★어겼다
 *     ⇒ ★★★그래서 ★★«적재»를 ★★«자»로 ★바꾼다 — ★★이 파일이 ★그것이다
 *
 * ★★★⑴ ★판정 = ★★«늘지 ★않는다»만 (⛔«줄여라»가 ★아니다)
 *   ★까닭: ★그 자리들은 ★★거의 ★전부 ★★남의 레인 spec 이다(★내 것 ★0곳)
 *   ⇒ ★★내가 ★남의 것을 ★안 고치고도 ★★다음 사람이 ★★안 늘린다
 *
 * ★★★⑵ ★명부는 ★★«이름»이다 — ⛔수만 두면 ★★★triage 가 ★사라진다
 *
 * ★★★⑶ ★★★기준선이 ★★«25」인 ★까닭 — ★★★이게 ★가장 ★중요하다
 *   ★이 자의 ★가름(★3줄 창에서 ★숫자 리터럴)은 ★★★어림이다
 *   ★실측 ★triage(★2026-10-11 · ★사람이 ★눈으로): ★★25 = ★★참 위험 ★10 ＋ ★루프 경계 ★3
 *     ＋ ★차이·좌표 ★11 ＋ ★★기준계 민감 ★오프셋 ★1
 *   ⇒ ★★★즉 ★★«25」를 ★«위험」이라 ★읽으면 ★★★4배 ★부풀린다
 *   ⇒ ★★★그런데 ★★자는 ★★그 ★triage 를 ★★재현할 수 ★없다(★사람이 ★한 것이다)
 *   ⇒ ★★★그래서 ★★★기준선은 ★★«어림이 ★잡는 ★25」로 ★두고, ★★★판정을 ★★이름별로 ★적어 ★둔다
 *     ⇒ ★★새 ★자리가 ★생기면 ★★★명부 ★밖이 ★되어 ★★빨개진다 ⇒ ★★사람이 ★★그때 ★triage 한다
 *     ⇒ ★★그게 ★★★«어림인 자»를 ★★정직하게 ★쓰는 ★꼴이다
 *
 * ★★★⑷ ★★«기준계 민감 ★오프셋»은 ★★★따로 ★센다(★지디 ⒧)
 *   ★`rect.top + 80` 을 ★마우스 ★목표로 ★쓰는 꼴 — ★★좌표는 ★화면 px 가 ★맞다
 *   ⇒ ★★그런데 ★★★«＋80» 의 ★뜻이 ★배율에 ★따라 ★바뀐다(★40% 면 ★레이아웃 ★200px)
 *   ⇒ ★★★즉 ★«문턱»이 ★아니라 ★★«거리의 ★뜻»이다 ⇒ ★★처방이 ★다르다 ⇒ ★★섞지 ★않는다
 *
 * ★★자 — ★`tests/dom/*.spec.js` · ★★주석 ★뗀 뒤 · ★3줄 ★창
 *   ★화면 px: `getBoundingClientRect` · `boundingBox(` · `elementFromPoint`
 *   ★문턱: ★두 자리 이상 ★숫자와의 ★비교(`> 300` · `toBe(155)` · `toBeGreaterThan(300)` …)
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
const { stripComments } = createRequire(import.meta.url)('./_strip-comments.js');

const ROOT = path.join(import.meta.dirname, '..', '..');
const DOM = path.join(ROOT, 'tests', 'dom');
const SELF = fileURLToPath(import.meta.url);

const SCREEN = () => /getBoundingClientRect|boundingBox\s*\(|elementFromPoint/;
const THRESH = () => /(>|<|>=|<=|===|!==)\s*-?\d{2,}|toBe\s*\(\s*-?\d{2,}|toBeGreaterThan\s*\(\s*-?\d{2,}|toBeLessThan\s*\(\s*-?\d{2,}|toBeCloseTo\s*\(\s*-?\d{2,}/;

/** ★그 뿌리의 spec 을 ★한 벌씩 ★재서 ★«화면 px ＋ 문턱» 자리를 ★돌려준다. ★★`read` 를 ★같이. */
function census(dir) {
  const out = { read: 0, hits: [] };
  if (!fs.existsSync(dir)) return out;
  for (const f of fs.readdirSync(dir).sort()) {
    if (!f.endsWith('.spec.js')) continue;
    out.read += 1;
    const L = stripComments(fs.readFileSync(path.join(dir, f), 'utf8')).split('\n');
    L.forEach((line, i) => {
      if (!SCREEN().test(line)) return;
      if (THRESH().test(L.slice(i, i + 3).join(' '))) out.hits.push(`${f}:${i + 1}`);
    });
  }
  return out;
}

/** ★★어림이 ★잡은 ★자리 ⇒ ★★사람의 ★판정(2026-10-11 · t1bstar).
 *  ★`risky`  = ★★참 위험 — ★화면 px 를 ★숫자와 ★견준다(★배율이 ★바뀌면 ★거짓 빨강·초록)
 *  ★`loop`   = ★★루프 경계 — ★`for (k < 40)` 이 ★문턱으로 ★보였다(★★거짓양성)
 *  ★`safe`   = ★차이·마우스 좌표·히트 테스트 — ★배율이 ★상쇄된다
 *  ★`offset` = ★★기준계 민감 ★오프셋 — ★★따로 센다(★위 머리말 ⑷) */
/* ══ ★★★이 ★명부의 ★★«장부» — ★★지디 조건(2026-10-11) ════════════════════════════
 *   ★★「어느 판에서 ★어느 식으로 ★센 수인가」가 ★없으면, ★다음 사람이 ★★다른 자로 센
 *     ★26 을 ★「늘었다」로, ★24 를 ★「줄었다」로 ★읽는다.
 *   ★★`ROSTER_AT` 은 ★★`git log` 에서 ★뽑았다 — ⛔손으로 ★적지 ★않았다. */
const ROSTER_AT = '05a6099f';   // ★이 명부를 ★들인 커밋(dev 28782596 위)
const ROSTER_HOW = [
  '★뿌리 = tests/dom (★그때 ★397벌 — ★`Z2` 가 ★분모를 ★매회 ★찍는다)',
  '★어림 = ★`SCREEN()`(getBoundingClientRect·boundingBox·elementFromPoint) ＋ ★`THRESH()`(★두 자리 이상 ★상수 비교)가 ★★3줄 ★창 안에 ★같이 있는 자리',
  '★주석은 ★떼고 ★센다(stripComments)',
  '★★그래서 ★★거짓양성·거짓음성이 ★★둘 다 ★온다 ⇒ ★★수가 ★아니라 ★★«이름＋사람 판정»으로 ★둔다',
].join(' · ');

const ROSTER = {
  'coupon-presets.dom.spec.js:157': 'risky',
  'graph-gr1-gradient.dom.spec.js:93': 'risky',
  'graph-u26-u27.dom.spec.js:80': 'risky',
  'graph-u26-u27.dom.spec.js:85': 'risky',
  'grid-plus-g15.dom.spec.js:301': 'risky',
  'k2-grid-sel-box.dom.spec.js:47': 'risky',
  'k2-grid-sel-box.dom.spec.js:48': 'risky',
  'k5-grid-8x8.dom.spec.js:41': 'risky',
  'text-selection-panel.dom.spec.js:360': 'risky',
  'text-selection-panel.dom.spec.js:394': 'risky',
  'graph-colorfield.dom.spec.js:30': 'loop',
  'graph-e152-escape.dom.spec.js:47': 'loop',
  'graph-panel-defaults.dom.spec.js:24': 'loop',
  'asset-to-scratch-move.dom.spec.js:50': 'safe',
  'asset-to-scratch-move.dom.spec.js:102': 'safe',
  'drag-move-autosave.dom.spec.js:82': 'safe',
  'e130-float-cross-section-row.dom.spec.js:53': 'safe',
  'free-frame-fullwidth-drag.dom.spec.js:185': 'safe',
  'free-frame-grid-width-roundtrip.dom.spec.js:58': 'safe',
  'gradient-canvas-bar.dom.spec.js:534': 'safe',
  'grid-plus-g15.dom.spec.js:300': 'safe',
  'modal-resize.dom.spec.js:282': 'safe',
  'overlay-drag-rotation.dom.spec.js:224': 'safe',
  'scratch-drop-grid-image.dom.spec.js:57': 'safe',
  'e130-float-cross-section-row.dom.spec.js:80': 'offset',
};

test('Z1 ★★자가 ★살아있다 — ★합성 표본으로 ★양성·음성 ★셋 (⛔이게 없으면 아래 수는 «안 쟀다»다)', () => {
  /* ⛔★표본 글자는 ★★조립한다 — ★★이 파일이 ★★제 자의 ★입력이 ★되면 ★★수가 ★거짓이 된다 */
  const GBCR = 'getBounding' + 'ClientRect';
  const POS = `const w = el.${GBCR}().width; if (w > 300) {}`;
  const NEG = `const a = el.${GBCR}(); const b = el2.${GBCR}(); if (a.left === b.left) {}`;
  const LAY = 'if (el.offsetWidth > 300) {}';
  const cls = (s) => (!SCREEN().test(s) ? 'none' : (THRESH().test(s) ? 'hit' : 'safe'));
  assert.equal(cls(POS), 'hit', '★양성대조 실패 — ★문턱 비교를 ★못 잡는다 ⇒ ★★아래 수는 ★«안 쟀다»다');
  assert.equal(cls(NEG), 'safe', '★음성대조 실패 — ★두 측정 비교를 ★위반으로 센다');
  assert.equal(cls(LAY), 'none', '★음성대조 실패 — ★★레이아웃 px(`offsetWidth`)를 ★화면 px 로 센다');
});

test('Z2 ★전제 — ★진짜 뿌리를 ★참으로 ★걸었나 ＋ ★세 수를 ★찍는다', () => {
  const c = census(DOM);
  assert.ok(c.read > 0, '★★`tests/dom` 에서 ★읽은 spec 이 ★0벌이다 ⇒ ★★아래 수는 ★★«안 쟀다»다');
  const seen = c.hits.length;
  const byVerdict = {};
  for (const k of Object.keys(ROSTER)) byVerdict[ROSTER[k]] = (byVerdict[ROSTER[k]] || 0) + 1;
  console.log(`    ★읽은 spec ${c.read}벌 · ★★어림이 ★잡은 자리 ${seen} (★명부 ${Object.keys(ROSTER).length})`);
  console.log(`      ★★사람 판정: ★참 위험 ${byVerdict.risky || 0} · ★루프 ${byVerdict.loop || 0}`
    + ` · ★안전 ${byVerdict.safe || 0} · ★★기준계 오프셋 ${byVerdict.offset || 0}`);
  console.log('      ⚠️★이 가름은 ★★어림이다 — ★3줄 창 ⇒ ★★거짓양성·거짓음성이 ★★둘 다 ★온다');
  /* ★★★장부를 ★★매회 ★찍는다 — ★★«파일 안에 ★적어라»의 ★절반은 ★★«읽히게 ★두어라»다.
     ★★내 교훈: ★★«세워둔 것»이 ★아니라 ★★«발동한 것»으로 ★재라 ⇒ ★★안 찍히는 ★장부는 ★장식이다. */
  console.log(`      ★★장부: ★판 ${ROSTER_AT} · ${ROSTER_HOW}`);
});

test('Z3 ★★★«늘지 않는다» — ★명부 ⊇ 실측 ＋ ★★명부 밖 ★0건 (⛔등호로 닫지 않는다)', () => {
  const c = census(DOM);
  assert.ok(c.read > 0, '★전제 미달 — ★읽은 spec 0벌');
  const outside = c.hits.filter((h) => !(h in ROSTER)).sort();
  assert.deepEqual(outside, [],
    `★★★«화면 px 를 ★숫자와 ★견주는» 자리가 ★★명부 ★밖에 ★${outside.length}곳 ★생겼다:\n  `
    + outside.map((h) => `· ${h}`).join('\n  ')
    + '\n  ⇒ ★★★배율이 ★바뀌면 ★★거짓 빨강·초록이 ★난다(★실측: ★머지 r14 에서 ★★배율 ★40%)'
    + '\n  ⇒ ★★처방: ★★`offsetWidth`·`clientWidth`(★레이아웃 px) 로 ★재거나, ★★두 측정을 ★서로 ★견주어라'
    + '\n  ⇒ ⛔★그리고 ★★이 자는 ★★어림이다 — ★★새 자리를 ★★사람이 ★triage 해서 ★★이 명부에 ★판정과 함께 ★올려라'
    + `\n  ★이 명부의 ★장부: ★판 ${ROSTER_AT} · ★식 ${ROSTER_HOW}`);
  /* ★★★명부가 ★낡았나 — ⛔★이것을 ★★FAIL 로 ★두지 ★않는다(★지디 조건 2026-10-11).
   *   ★까닭: ★★여기 걸리는 사람은 ★★«그 자리를 ★고친 사람»이다 ⇒ ★★고침에 ★벌을 ★매기게 된다.
   *     (★이 파일의 ★첫 판은 ★`assert.deepEqual(stale, [])` 였다 — ★내 흠이다)
   *   ⇒ ★★찍기만 ★한다. ★★«줄었다»가 ★★«자가 ★죽었다»인 ★갈림은 ★★`Z1`(합성 표본)·★`Z2`(전제)가 ★잡는다. */
  const stale = Object.keys(ROSTER).filter((k) => !c.hits.includes(k)).sort();
  if (stale.length) {
    console.log(`    ★★명부에 ★«이제 ★없는» 자리 ★${stale.length}곳 — ${stale.join(' ')}`);
    console.log('      ⇒ ★고친 것이면 ★명부에서 ★빼라 · ★줄이 ★움직인 것이면 ★줄 번호를 ★고쳐라 (⛔FAIL 은 ★아니다)');
  }
});

test('Z4 ★★이 파일이 ★제 자의 ★입력이 ★아니다 — ★★«뿌리 밖»에 산다 (★T7 과 ★같은 병)', () => {
  /* ⛔★★«본문에 ★그 낱말이 ★0건»으로는 ★걸 수 ★없다 —
   *   ★★★이 파일의 ★★정규식 ★정의가 ★그 낱말을 ★★품는다(★`SCREEN()` 의 ★리터럴)
   *   ⇒ ★★그걸 ★단언했더니 ★★★곧바로 ★빨개졌다(★2026-10-11 · ★내가 ★한 번 ★틀렸다)
   * ★★★참 ★보호 = ★★«이 파일이 ★`tests/dom` ★밖에 ★산다» ⇒ ★★census 가 ★★애초에 ★못 읽는다 */
  const rel = path.relative(DOM, SELF);
  assert.ok(rel.startsWith('..'),
    `★★이 파일이 ★뿌리 안에 있다(${rel}) — ★★그러면 ★제 자가 ★자기를 ★센다`);
  const c = census(DOM);
  const self = path.basename(SELF);
  const mine = c.hits.filter((h) => h.startsWith(self));
  assert.deepEqual(mine, [],
    `★★census 결과에 ★이 파일이 ★들었다: ${JSON.stringify(mine)} — ★★자가 ★자기를 ★센다`);
  /* ★★그리고 ★★명부의 ★이름이 ★★전부 ★`.dom.spec.js` 인가 — ⛔유닛이 ★섞이면 ★뿌리가 ★틀렸다 */
  const bad = Object.keys(ROSTER).filter((k) => !/\.dom\.spec\.js:\d+$/.test(k));
  assert.deepEqual(bad, [], `★명부에 ★spec 이 ★아닌 이름이 ★있다: ${bad.join(' ')}`);
});
