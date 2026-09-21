/* ══════════════════════════════════════════════════════════════════════════
   history-chrome-noise — 「섹션 툴바는 콘텐츠가 아니다」를 잠근다
   ──────────────────────────────────────────────────────────────────────────
   무슨 일이 있었나 (2026-09-21 실앱 실측, 커밋 fd8f85d):
     ⑴ 페이지 A 삽입 → B 로 갔다가 A 로 «복귀» → ⌘Z 를 눌렀는데 **화면이 안 바뀌었다.**
        꼭대기와 라이브가 어긋나 있었는데, 길이는 둘 다 1895 로 «같고» 내용만 달랐다.
        첫 차이는 255번째 글자, `.section-toolbar` 안의 **버튼 순서와 onclick** 이었다.
     ⑵ 같은 병이 전환 «없이» undo→redo 뒤에도 났다(top 3819 / live 3790, 차이는 역시 툴바뿐).
     ⇒ 복귀·복원 때 rebindAll·옵저버가 툴바를 다시 쓰는데, 비교자가 그걸 «편집»으로 읽어
       ensureHistoryCheckpoint 가 칸을 하나 더 만든다 = 「먹통 한 칸」.

   고친 모양 — 비교에서 `.section-toolbar` 를 통째로 벗긴다(`_stripNonEdit`).
   ⛔저장되는 문자열은 «안» 바뀐다. 벗기는 건 «비교할 때»뿐이다.
   ★이 레포는 이미 툴바를 «내용 아님»으로 다룬다 — market-merge.js · version-diff.js ·
     export-html.js 가 같은 일을 한다. 히스토리만 «혼자» 내용으로 보고 있었다.
═══════════════════════════════════════════════════════════════════════════ */
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const read = (...p) => fs.readFileSync(path.join(ROOT, ...p), 'utf8');
const HISTORY = read('js', 'history.js');

/** history.js 의 두 정규식을 «소스에서 그대로» 꺼내 쓴다 — 베껴 적으면 늙는다. */
function comparator() {
  const a = HISTORY.match(/const _NON_EDIT_ATTR_RE = \/(.*)\/g;/);
  const b = HISTORY.match(/const _CHROME_RE = \/(.*)\/g;/);
  assert.ok(a, '★_NON_EDIT_ATTR_RE 를 못 찾았다 — 이 검사가 «안 돈» 것이지 통과가 아니다');
  assert.ok(b, '★_CHROME_RE 를 못 찾았다 — 섹션 툴바 벗기기가 사라졌다');
  const re1 = new RegExp(a[1], 'g'), re2 = new RegExp(b[1], 'g');
  return (s) => s.replace(re1, '').replace(re2, '');
}

/** 실앱에서 본 그 모양 — 툴바 버튼 순서·onclick 만 다르고 «내용»은 같다. */
const TOOLBAR_A =
  '<div class="section-toolbar">' +
  '<button class="st-btn st-ab-btn" title="A/B 베리에이션 생성">x</button>' +
  '<button class="st-btn st-memo-btn" title="섹션 메모">y</button>' +
  '</div>';
const TOOLBAR_B =
  '<div class="section-toolbar">' +
  '<button class="st-btn st-memo-btn" onclick="window.toggleSectionMemoPopover(this)" title="섹션 메모">y</button>' +
  '<button class="st-btn st-ab-btn" title="A/B 베리에이션 생성">x</button>' +
  '</div>';
const BODY = '<div class="section-inner"><div class="text-block" id="tb_1">글자</div></div>';
const wrap = (tb, body) => `<div class="section-block" id="sec_1">${tb}${body}</div>`;

test('CN-1 툴바만 다른 두 스냅샷은 «같은 편집»이다', () => {
  /* ★먼저 «쓰이는지»부터 본다 — 정규식만 있고 안 쓰면 이 검사는 «검사처럼 생긴 문장»이 된다.
     (실제로 처음엔 그랬다: 벗기기 호출을 지워도 이 파일이 초록이었다) */
  assert.match(HISTORY, /function _stripNonEdit\([\s\S]{0,240}?replace\(_CHROME_RE/,
    '★_CHROME_RE 가 «선언만» 돼 있고 _stripNonEdit 이 안 쓴다 — 벗기기가 실제로 안 돈다');
  assert.match(HISTORY, /_stripNonEdit\(a\)\s*===\s*_stripNonEdit\(b\)/,
    '★_sameEdit 이 _stripNonEdit 를 안 지나간다 — 비교자에 안 걸린 벗기기는 아무 일도 안 한다');
  const strip = comparator();
  assert.equal(strip(wrap(TOOLBAR_A, BODY)), strip(wrap(TOOLBAR_B, BODY)),
    '★툴바 버튼 순서·onclick 차이가 «편집»으로 읽힌다 — 페이지 복귀·undo/redo 뒤 ⌘Z 가 먹통 한 칸이 된다');
});

test('CN-2 ★음성대조 — 진짜 편집까지 같다고 하면 안 된다', () => {
  const strip = comparator();
  const other = '<div class="section-inner"><div class="text-block" id="tb_1">다른 글자</div></div>';
  assert.notEqual(strip(wrap(TOOLBAR_A, BODY)), strip(wrap(TOOLBAR_A, other)),
    '★본문이 다른데 «같다»고 한다 — 너무 많이 벗긴다(그만큼 undo 한 칸이 사라진다)');
  /* 벗기기가 «툴바 밖»까지 먹지 않는지 — 같은 이름의 클래스가 본문에 있어도 본문은 남아야 한다 */
  assert.ok(strip(wrap(TOOLBAR_A, BODY)).includes('글자'),
    '★본문까지 지워졌다 — 정규식이 첫 </div> 를 넘어 먹고 있다');
});

test('CN-3 ★툴바 안에 <div> 가 생기면 이 방식이 깨진다 — 지금은 안 그런지 본다', () => {
  /* _CHROME_RE 는 «첫 </div>» 에서 끊는 비탐욕 매칭이다. 툴바가 버튼만 담는 한 안전하다.
     block-factory 가 툴바를 만드는 자리에 <div> 가 들어오면 그날 빨강이 되어야 한다. */
  const FAC = read('js', 'block-factory.js');
  const re = /<div class="section-toolbar">([\s\S]*?)<\/div>/g;
  const bodies = [...FAC.matchAll(re)].map(m => m[1]);
  assert.ok(bodies.length > 0,
    '★block-factory 에서 툴바 마크업을 «하나도» 못 찾았다 — 명부 grep 이 죽었다(0건을 통과로 읽지 마라)');
  for (const b of bodies) {
    assert.doesNotMatch(b, /<div\b/,
      '★툴바 안에 <div> 가 생겼다 — js/history.js 의 _CHROME_RE 가 첫 </div> 에서 끊겨 ' +
      '툴바 절반만 벗긴다. 그 정규식(또는 벗기는 방식)을 같이 고쳐라');
  }
});

test('CN-4 ★이 레포가 이미 툴바를 «내용 아님»으로 다룬다는 전제가 살아 있나', () => {
  /* 이 고침의 근거가 「다른 셋이 이미 같은 일을 한다」이다. 그 셋이 사라지면 근거가 사라진다. */
  const sites = [
    ['js', 'market-merge.js'],
    ['js', 'version-diff.js'],
  ];
  for (const s of sites) {
    assert.match(read(...s), /section-toolbar/,
      `★${s.join('/')} 가 더는 툴바를 안 벗긴다 — 이 고침의 근거(「셋이 이미 그렇게 한다」)가 늙었다`);
  }
});
