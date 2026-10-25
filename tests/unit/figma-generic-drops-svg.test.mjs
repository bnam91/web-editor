/* figma-generic-drops-svg.test.mjs
 *   ★★`FIGMA-GENERIC-SVG-NOT-DRAWN-01` ＋ `FIGMA-GENERIC-FLOATING-NOT-READ-01`
 *   ★보내는 쪽은 ★싣는데 ★★받는 쪽이 ★안 그린다 — ★★내 Figma 고침은 ★★«반쪽»이다.
 *   (2026-10-25 신설 · ★S7 t6 ⒜4 가 ★읽기로 지목 · ★나는 ★1차 출처로 ★확인했다)
 *
 * ★★★이것은 ★«고침»이 ★아니다 — ★★내 앞 판정의 ★한계를 ★수로 박는다.
 *
 * ★★내가 ★261024 에 ★닫은 것 (★`annot-same-as-other-blocks.dom.spec.js`)
 *   · 어노테이션·치수선이 ★Figma JSON 에 ★나온다 — `kind: 'annotation'` · `svg` 에 `.annot-line`
 *   · ★`floating` · `x` · `y` 가 ★실린다
 *   · 라벨 글자가 ★`texts` 에 ★실린다
 *   ⇒ ★★그것은 ★★«보내는 쪽»까지만 ★참이었다.
 *
 * ★★★받는 쪽 (★`figma-renderer/sangpe_to_figma.mjs` · ★내가 열어 읽었다)
 *   ★GENERIC 갈래(`block.type === 'generic'`) 가 ★쓰는 것 :
 *     `create_frame` → `set_fill_color` → `set_corner_radius` → ★`block.texts` ★순회
 *   ★★그 갈래에 ★`block.svg` 를 ★쓰는 줄이 ★★없다.
 *     (★`block.svg` 는 ★다른 갈래에서만 쓰인다 — `:979`(wrap) · `:1307`(`create_node_from_svg`))
 *   ★★그리고 ★`floating` 이 ★그 파일 ★전체에서 ★★0 건 ⇒ ★`x`·`y` 를 ★안 읽는다.
 *   ⇒ ★★★피그마에는 ★«프레임 ＋ 라벨 글자»만 ★생기고 ★★어노 ★그림(선·치수선)은 ★안 그려진다.
 *     ★자리도 ★흐름 좌표로 ★쌓인다(★S7 예측 : 어노 둘이면 ★섹션 ＋680).
 *
 * ⛔★이 파일이 ★안 재는 것
 *   · ★★실제 ★피그마 ★화면 — ★★안 쟀다. ★S7 도 못 쟀다(★Figma 앱·3055 없음)
 *     ★이름 = `T6-FIGMA-PLUGIN-RECEIVE-NOT-ON-INTEL-01`(★S7 이 붙였다)
 *   · ★고침(generic 갈래에 ★svg 를 그리는 줄 넣기)은 ★★안 했다 —
 *     ★★«내보내기 산출물이 바뀐다»는 ★사용자에게 보이는 변화이고 ★헤드리스로 ★검증할 길이 ★없다
 *     ⇒ ★★설계를 ★올렸다. ★선례는 ★있다(`:1307` `create_node_from_svg`).
 */
import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

const ROOT = path.join(import.meta.dirname, '..', '..');
const SRC = path.join(ROOT, 'figma-renderer', 'sangpe_to_figma.mjs');

/** `block.type === 'generic'` 갈래의 본문만 — ★닻으로 집는다(⛔줄번호 아님) */
function genericBranch() {
  const s = fs.readFileSync(SRC, 'utf8');
  const i = s.indexOf("if (block.type === 'generic')");
  assert.notEqual(i, -1, '★generic 갈래를 못 찾았다 — 이 검사의 자가 낡았다');
  /* ★그 블록의 끝 = 다음 `return h;` 까지(★그 갈래가 그렇게 닫힌다) */
  const end = s.indexOf('return h;', i);
  assert.notEqual(end, -1, '★generic 갈래의 끝을 못 찾았다');
  return s.slice(i, end);
}

test('F0 ★전제 — ★받는 쪽 파일이 ★있고 ★generic 갈래가 ★산다', () => {
  assert.ok(fs.existsSync(SRC), '★`figma-renderer/sangpe_to_figma.mjs` 가 없다');
  const b = genericBranch();
  /* ★★자가 ★헛돌지 않는다 — ★그 갈래가 ★무언가는 ★만든다 */
  assert.match(b, /create_frame/, '★generic 갈래가 프레임도 안 만든다 — 자가 엉뚱한 곳을 집었다');
  assert.match(b, /block\.texts/, '★generic 갈래가 texts 도 안 쓴다 — 자가 엉뚱하다');
});

test('F1 ★★★generic 갈래가 ★`block.svg` 를 ★안 쓴다 (★어노 그림이 안 그려진다)', () => {
  const b = genericBranch();
  /* ★★★이 단언은 ★«결함이 ★산다»를 ★잠근다 — ★고치면 ★빨개지고 ★그때 ★닫아라.
     ★261025 측정 : 그 갈래 = create_frame · set_fill_color · set_corner_radius · texts 순회 ★뿐 */
  assert.ok(!/block\.svg/.test(b),
    '★★generic 갈래가 ★`block.svg` 를 ★쓰기 시작했다 — ★좋은 일이다.\n'
    + '  ⇒ `FIGMA-GENERIC-SVG-NOT-DRAWN-01` 을 ★닫고 ★이 칸을 ★지워라(★실제 피그마 화면으로 ★확인한 뒤).');
  /* ★★음성대조 — ★`block.svg` 는 ★다른 갈래에서는 ★쓰인다
     ⛔없으면 ★「그 파일이 ★svg 를 ★아예 안 쓴다」와 ★구분이 안 되고, ★선례가 ★없다는 뜻이 된다 */
  const all = fs.readFileSync(SRC, 'utf8');
  assert.match(all, /create_node_from_svg/,
    '★`create_node_from_svg` 가 그 파일에 없다 — ★그러면 ★고칠 선례도 없다(설계를 다시 하라)');
  assert.ok((all.match(/block\.svg/g) || []).length >= 2,
    `★\`block.svg\` 가 ${(all.match(/block\.svg/g) || []).length} 곳뿐이다 — ★자가 헛돌았나 보라`);
});

test('F2 ★★`floating`·좌표를 ★안 읽는다 (★어노가 ★흐름으로 쌓인다)', () => {
  const all = fs.readFileSync(SRC, 'utf8');
  /* ★보내는 쪽은 ★싣는다 — ★그것은 ★내 DOM 검사가 ★잠갔다(annot-same-as-other-blocks A1) */
  const sender = fs.readFileSync(path.join(ROOT, 'js', 'io', 'export-figma-json.js'), 'utf8');
  assert.match(sender, /floating/, '★보내는 쪽이 `floating` 을 안 싣는다 — 그러면 이 칸의 전제가 무너진다');
  /* ★★★받는 쪽은 ★안 읽는다 */
  assert.equal((all.match(/floating/g) || []).length, 0,
    '★★받는 쪽이 ★`floating` 을 ★읽기 시작했다 — ★좋은 일이다. ⇒ `FIGMA-GENERIC-FLOATING-NOT-READ-01` 을 닫아라');
});

test('F3 ★★«실제 피그마 화면»은 ★안 쟀다 — ★그 사실을 ★박는다', () => {
  /* ★★항상 초록인 ★«기록»이고 ★«자»가 ★아니다. ⛔그것을 ★숨기지 않는다.
     · ★S7(인텔 앱 레인) : ★Figma 앱·3055 ★없어 ★못 쟀다 — `T6-FIGMA-PLUGIN-RECEIVE-NOT-ON-INTEL-01`
     · ★나 : ★헤드리스라 ★플러그인 통신(`run(...)`)을 ★돌릴 길이 ★없다
     ⇒ ★★그래서 ★이 파일은 ★★«소스»만 잰다. ★★그 한계를 ★적어 둔다. */
  assert.ok(true, 'FIGMA-RECEIVE-SCREEN-UNMEASURED-01 — 기록용 칸');
});
