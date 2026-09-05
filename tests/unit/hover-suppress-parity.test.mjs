/* 단위 하네스 — 「미선택 프레임 안 hover 억제」 목록이 «틴트를 가진 블록»을 다 덮는가.
 *
 * ★왜 생겼나 (L1, 2026-09-05)
 * 미선택 프레임 안에서 hover 틴트를 억제하는 목록에 `.asset-block` 이 빠져 있었다 — 그런데 재보니
 * 하나가 아니라 **10종**이 빠져 있었다. 「같은 판정이 여러 곳에 흩어지면 한 곳이 반드시 뒤처진다」의
 * 전형이고, 이 레포는 위임목록·클램프·거터·피커 축에서 이미 반복해 당했다.
 *
 * ⚠️그런데 이 회귀를 «동작 테스트»로는 못 막는다 — 이 레포 단위테스트는 CSS 캐스케이드를 못 잰다
 *   (구현자 보고). 그래서 «소스 문자열»로 두 목록을 대조한다. 완벽하진 않지만 «빠짐»은 잡는다.
 *   선례: duo-grid-p1.test.js 의 import 존재 단언, grid-callsite-ssot.test.mjs 의 호출부 인자 단언.
 *
 * ⛔의도적 예외(text-block 계열)는 «허용목록»으로 명시한다 — 예외를 «조용히» 두면 다음 사람이
 *   빠짐인지 의도인지 구분 못 한다. 예외를 늘리려면 이 목록에 «이유와 함께» 적어야 한다.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '../..');
/* ⚠️한 파일만 보면 «검사 범위»가 곧 «결론 범위»가 된다 — 실제로 `.text-block` 의 틴트는
 * editor-layout.css 에 있어서, editor-blocks.css 만 읽었을 때 「틴트를 안 가진다」로 잘못 나왔다.
 * 이 레포가 반복해 당한 병이라(저장본 duo 를 proj.json 만 세어 0건→196회) 파일을 «다» 읽는다. */
const CSS_FILES = ['css/editor-blocks.css', 'css/editor-layout.css', 'css/editor-base.css', 'css/editor-extra.css'];
const CSS = CSS_FILES
  .filter(f => fs.existsSync(path.join(ROOT, f)))
  .map(f => fs.readFileSync(path.join(ROOT, f), 'utf8'))
  .join('\n')
  .replace(/\/\*[\s\S]*?\*\//g, '');   // 주석은 걷는다 — 설명문 속 셀렉터를 세면 오탐이다

/* ⛔여기 있는 것만 «빠져도 되는» 것이다. 이유 없이 늘리지 마라. */
const ALLOWED_MISSING = new Map([
  ['text-block',
   'text/speech-bubble/liner 셋이 .text-block 한 줄로 묶여 있고, text-frame 은 「항상 .selected 없는 ' +
   '투명 래퍼」라 여기 넣으면 «모든» 텍스트 프레임에서 텍스트 hover 가 죽는다. 별건으로 뺐다(2026-09-05).'],
]);

/** `.foo-block:hover::after { … }` 로 틴트를 «가진» «캔버스 블록» 클래스.
 *  ⛔`-block` 으로 끝나는 것만 센다 — 그러지 않으면 `tpl-preview-resize-handle`(템플릿 미리보기 UI)
 *    처럼 «프레임 안에 들어갈 일이 없는» 것까지 잡혀 오탐이 된다(실측으로 걸렀다).
 *    이 검사가 지키려는 것은 「프레임 «안 블록»의 hover」이지 앱 크롬이 아니다. */
function tintOwners(css) {
  const out = new Set();
  for (const m of css.matchAll(/^\s*\.([a-z0-9-]+):hover::after\s*\{/gm)) {
    if (m[1].endsWith('-block')) out.add(m[1]);
  }
  return out;
}
/** `.frame-block:not(.selected) .foo-block:hover::after` 로 «억제되는» 클래스 */
function suppressed(css) {
  const out = new Set();
  for (const m of css.matchAll(/\.frame-block:not\(\.selected\)\s+\.([a-z0-9-]+):hover::after/g)) out.add(m[1]);
  return out;
}

test('★틴트를 가진 블록은 «전부» 미선택 프레임 안에서 억제된다 (허용목록 제외)', () => {
  const owners = tintOwners(CSS);
  const supp   = suppressed(CSS);
  assert.ok(owners.size >= 10, `틴트 보유 클래스를 ${owners.size}개밖에 못 찾았다 — 패턴이 낡았나?`);
  assert.ok(supp.size   >= 10, `억제 목록을 ${supp.size}개밖에 못 찾았다 — 패턴이 낡았나?`);

  const missing = [...owners].filter(c => !supp.has(c) && !ALLOWED_MISSING.has(c)).sort();
  assert.deepEqual(missing, [],
    `억제 목록에서 빠진 클래스: ${missing.join(', ')}\n` +
    `— 「미선택 프레임 안 hover 억제」는 판정이 «하나»인데 목록이 반쪽이면 블록마다 다르게 군다.\n` +
    `— 의도적 예외라면 ALLOWED_MISSING 에 «이유와 함께» 적어라.`);
});

test('허용목록의 예외는 «실제로» 틴트를 가진 클래스여야 한다(죽은 예외 방지)', () => {
  const owners = tintOwners(CSS);
  for (const [cls, why] of ALLOWED_MISSING) {
    assert.ok(owners.has(cls),
      `허용목록의 '${cls}' 가 틴트를 안 가진다 — 예외가 낡았다(사유: ${why})`);
  }
});
