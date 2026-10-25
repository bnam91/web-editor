/* sel-outline-not-one-token.test.mjs
 *   ★★`SEL-OUTLINE-NOT-ONE-TOKEN-01` — ★선택 테두리 굵기는 ★«토큰 하나»가 ★아니다.
 *   ★규칙 문서는 ★「통일」이라 ★적었는데 ★제품엔 ★분기가 ★산다. (2026-10-24 신설 · ★적대적 ⒠ ★C7)
 *
 * ★★★이 파일은 ★«고침»이 ★아니다 — ★★«문서와 제품이 갈렸다»를 ★수로 박아 ★명부에 올린다.
 *   ⛔★`.claude/rules/css-blocks.md` 는 ★★내 금지선이다(`.claude/**` 수정 금지)
 *     ⇒ ★문서를 ★고칠 수 ★없다. ★★판정은 ★사람 자리다 — ★올렸다.
 *   ★두 길 중 ★하나를 ★골라야 ★한다 :
 *     ㉠ ★제품을 ★문서에 맞춘다(★분기를 ★없앤다) — ★그러면 ★이 칸이 ★빨개진다
 *     ㉡ ★문서를 ★제품에 맞춘다(★「분기가 ★있다」로) — ★그러면 ★아래 ★닻이 ★안 잡혀 ★빨개진다
 *   ⇒ ★★어느 쪽이든 ★이 칸이 ★빨개져 ★다시 ★판정하게 ★된다.
 *
 * ★★찾은 이 = 적대적 검수 ⒠(수지맥) ★C7. ★그 보고는 ★「★화면으로는 ★못 쟀다」로 남겼다.
 *   ★★★나도 ★화면으로는 ★★못 쟀다 — ★261024 에 ★시도했고 ★내 자가 ★★네 곳에서 ★헛돌았다 :
 *     ⒜ 오버레이 SVG 선택자가 ★0건(`#sel-overlay` 등 넷 다 ★못 찾았다)
 *     ⒝ `.text-block.editing` 을 ★손으로 붙였는데 ★outline 이 ★안 바뀌었다(★규칙이 ★안 먹었다)
 *     ⒞ `feature-flags.js` 의 ★`SEL_OVERLAY_ENABLED` 가 ★`null`(★export 이름이 ★다르다)
 *     ⒟ 배율 40 에서 `--sel-outline-w` 가 `calc(1px*2.5)` 인데 ★computed 가 ★`2px` 였다(★까닭 미확정)
 *   ⇒ ★★화면 축은 ★★「안 쟀다」로 ★남긴다 — ★앱 맥(태양 ⒜) 몫이다.
 *     ⛔★계산식으로 ★「0.8 · 0.6 · 1.5」를 ★적지 ★않는다 — ★그건 ★보고의 ★소스 ★추론이고 ★내 실측이 ★아니다.
 *
 * ★★이 파일이 ★잠그는 것 = ★★«소스상 ★분기가 ★산다»
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const read = (p) => fs.readFileSync(path.join(ROOT, p), 'utf8');

test('W0 ★전제 — ★규칙 문서가 ★「통일」이라 ★적었다 (★이 칸의 ★닻)', () => {
  const doc = read('.claude/rules/css-blocks.md');
  /* ★닻은 ★그 문서의 ★글자다 — ⛔내가 지어내지 않았다 */
  assert.match(doc, /--sel-outline-w.{0,20}토큰으로 통일/,
    '★규칙 문서의 「토큰으로 통일」 문장이 사라졌다 — ★문서를 고쳤다면 이 파일을 다시 판정해라');
  assert.match(doc, /두께 분기는 폐기/,
    '★「두께 분기는 폐기됨」 문장이 사라졌다 — ★문서를 고쳤다면 이 파일을 다시 판정해라');
});

test('W1 ★★제품엔 ★두께 분기가 ★산다 — `STROKE_W` 에 ★서로 다른 값이 ★둘 이상', () => {
  const src = read('js/selection-overlay.js');
  const m = src.match(/export const STROKE_W\s*=\s*\{([^}]*)\}/);
  assert.ok(m, '★`STROKE_W` 를 못 찾았다 — 이 검사의 자가 낡았다(이름이 바뀌었나)');
  const vals = [...m[1].matchAll(/:\s*([0-9.]+)/g)].map((x) => Number(x[1]));
  assert.ok(vals.length >= 2, `★`+'`STROKE_W`'+` 항목이 ${vals.length} 개다 — 자가 헛돈다 (${m[1].trim()})`);
  const uniq = [...new Set(vals)];
  /* ★★★본 단언 — ★값이 ★하나가 ★아니다 = ★분기가 ★산다 = ★문서와 ★갈렸다.
     ★261024 실측 : `{ '': 1, overlay: 1.5, sticker: 1 }` ⇒ ★서로 다른 값 ★둘(1 · 1.5) */
  assert.ok(uniq.length >= 2,
    `★`+'`STROKE_W`'+` 가 ★한 값으로 ★통일됐다 (${JSON.stringify(uniq)}) — ★★그러면 문서와 맞는다.\n`
    + '  ⇒ ★`SEL-OUTLINE-NOT-ONE-TOKEN-01` 을 ★닫고 ★이 파일을 ★지워라.');
});

test('W2 ★★섹션·col 은 ★오버레이를 ★건너뛴다 — ★«다른 길»이 하나 더 있다', () => {
  const src = read('js/selection-overlay.js');
  const m = src.match(/export const SKIP_SELECTOR\s*=\s*'([^']*)'/);
  assert.ok(m, '★`SKIP_SELECTOR` 를 못 찾았다 — 자가 낡았다');
  assert.ok(m[1].trim().length > 0,
    '★`SKIP_SELECTOR` 가 ★비었다 — ★모두 오버레이로 갔다면 ★길이 하나로 줄었다. 다시 판정해라');
  /* ★261024 실측 = `.section-block, .col` */
  assert.match(m[1], /section-block/, '★섹션이 건너뛰기 명부에서 빠졌다 — 다시 판정해라');
});

test('W3 ★★줌 보정 ★없는 고정 px 가 ★있다 — `.text-block.editing`', () => {
  const css = read('css/editor-layout.css');
  const line = css.split('\n').find((l) => l.includes('.text-block.editing') && /outline:/.test(l));
  assert.ok(line, '★`.text-block.editing` 의 outline 줄을 못 찾았다 — 자가 낡았다');
  /* ★★본 단언 — ★그 줄에 ★`--inv-zoom` 이 ★없다 = ★배율을 ★안 따른다 */
  assert.ok(!/--inv-zoom/.test(line),
    `★\`.text-block.editing\` 이 ★줌 보정을 ★얻었다 — ★좋은 일이다. ★이 칸을 ★닫아라.\n  줄: ${line.trim()}`);
  assert.match(line, /outline:\s*[0-9.]+px/, `★고정 px 가 아니다 — 꼴이 바뀌었다: ${line.trim()}`);
});

test('W4 ★★음성대조 — ★`--sel-outline-w` 는 ★줌 보정이 ★있다 (★자가 헛돌지 않는다)', () => {
  const css = read('css/editor-base.css');
  const line = css.split('\n').find((l) => l.includes('--sel-outline-w:'));
  assert.ok(line, '★`--sel-outline-w` 정의를 못 찾았다 — 자가 낡았다');
  /* ⛔이 칸이 ★없으면 ★W3 의 「★--inv-zoom 이 없다」가 ★「아무 줄에도 없다」와 ★구분이 안 된다 */
  assert.match(line, /--inv-zoom/,
    `★토큰 쪽에도 ★줌 보정이 ★없다 — ★그러면 ★W3 의 자가 ★헛돈 것이다: ${line.trim()}`);
});

test('W5 ★★★«화면 px» 은 ★안 쟀다 — ★그 사실을 ★여기 박는다', () => {
  /* ★★이 칸은 ★«미측정»을 ★기록한다 — ⛔「문제 없다」로 ★뭉개지 않게.
     ★배율 40·100·200 에서 ★네 꼴(일반 블럭 · 표 칸 · 글상자 편집 · 에셋 오버레이 안)의
     ★★실제 ★화면 px 은 ★★★아직 ★아무도 ★안 쟀다 :
       · ★적대적 ⒠ : 「★화면으로는 ★못 쟀다」(★소스 ★계산식만)
       · ★나(261024) : ★헤드리스로 ★시도 → ★내 자가 ★네 곳에서 ★헛돌았다(이 파일 머리말 참조)
     ⇒ ★앱 맥(★태양 ⒜) 몫이다. ★이름 = `SEL-OUTLINE-SCREEN-PX-UNMEASURED-01`
     ★이 칸은 ★★항상 ★초록이다 — ★«기록»이고 ★«자»가 ★아니다. ⛔그것을 ★숨기지 않는다. */
  const names = ['일반 블럭', '표 칸', '글상자 편집', '에셋 오버레이 안'];
  assert.equal(names.length, 4, '★미측 꼴 수를 바꿀 때는 ★왜를 같이 적어라');
  assert.ok(true, 'SEL-OUTLINE-SCREEN-PX-UNMEASURED-01 — 기록용 칸');
});
