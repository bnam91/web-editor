/* _history-step — DEF-01 대응 공용 헬퍼: 「한 조작 = ⌘Z 한 걸음」을 «히스토리를 직접» 단언한다 (지디 판정: 꼴 ③).
 *
 * ★왜 필요한가(DEF-01): js/history.js undo() 첫 줄이 늘 ensureHistoryCheckpoint('현재 상태') 를 찍는다.
 *   조작이 «끝 표본»을 빼먹어도 ⌘Z 가 라이브를 새 칸으로 «구제»해 쌓고 한 칸 내려가므로,
 *   「조작 → ⌘Z → 화면이 돌아왔나」만 재는 대조는 그 결함을 «못 본다»(공회전 — DEF01-AUDIT §0).
 *
 * ★재는 것 — 출처 «둘»을 맞댄다(한 출처면 그 단언은 값을 못 잠근다):
 *   출처 ㉠ 히스토리 내부 수: window.getHistoryTip() 의 pos·len·seq(스택 자체 — js/history.js getHistoryTip)
 *   출처 ㉡ 화면 바이트: window.getSerializedCanvas()(라이브 DOM 직렬화)
 *   단언 넷:
 *     A0 전제 — 조작이 화면을 바꿨다(㉡: 조작 전 ≠ 조작 뒤)
 *     A1 끝 표본 — 조작 «직후»(⌘Z 누르기 전) 꼭대기가 새 칸이다(㉠: pos 가 늘고 seq 가 바뀜)
 *     A2 ★구제 없음 — ⌘Z 한 번이 칸을 «새로 만들지 않고»(㉠: len 불변) 정확히 한 칸 내려간다(pos −1)
 *        ← 끝 표본이 빠졌으면 undo 첫머리 체크포인트가 len 을 +1 하고 pos 는 제자리 — 바로 여기서 빨개진다.
 *     A3 되돌림 — ⌘Z 한 번 뒤 화면 = 조작 전(㉡ 바이트 · 비교 잣대는 history.js _sameEdit 와 같은 «편집 아닌 것» 벗기기)
 *   ⇒ A1·A2 는 스택(㉠)을, A0·A3 는 DOM(㉡)을 본다. 둘이 맞아야 초록.
 *   ⚠️㉡ 은 스냅샷과 «같은 직렬화기»(getSerializedCanvas)를 쓴다 — 직렬화기가 빠뜨리는 것은 양쪽이 같이 못 본다(이 헬퍼의 사각).
 *
 * ★Δpos 는 «1 이상»을 받는다(정확히 1 을 요구하지 않는다): 앞+끝 표본을 «둘 다» 찍는 조작은 조작 전 라이브가
 *   꼭대기와 다를 때(날 변화가 앞에 있을 때) 앞 표본이 그 상태를 쌓아 Δpos=2 가 된다 — 그래도 ⌘Z «한 번»이
 *   조작 전으로 돌아오면(A2·A3) 사용자에겐 한 걸음이다. 반환값 dPos 로 수를 남긴다(지디 ⒟).
 *
 * 쓰는 법: const r = await expectOneUndoStep(page, async () => { await page.keyboard.press('Delete'); }, '블럭 삭제');
 *   ⛔조작 «전»의 준비(블럭 고르기 등)는 action «밖»에서 끝내라 — 선택 같은 준비가 action 안에 들면 조작 전 바이트가 흔들린다. */
const { expect } = require('@playwright/test');
const { structCmp } = require('./_struct-cmp.js');

/* history.js _NON_EDIT_ATTR_RE · _CHROME_RE 와 «같은» 벗기기(비교만 — 그 파일과 다르면 이 헬퍼가 거짓 빨강/초록을 낸다). */
const NON_EDIT = / draggable="(?:true|false)"|\s*--sec-clip:\s*[^;"]*;?/g;
const CHROME = /<div class="section-toolbar">[\s\S]*?<\/div>/g;
const strip = (s) => String(s || '').replace(NON_EDIT, '').replace(CHROME, '');

async function readHistory(page) {
  return page.evaluate(() => ({ tip: window.getHistoryTip(), canvas: window.getSerializedCanvas() }));
}

/** @returns {{label, dPos, dLen, seqNew, undoDPos, undoDLen, changed, restored, restoredRaw, topAction}} */
/* ★beforeOnly — «앞 표본만» 찍는 조작(글자 편집 진입·슬라이더 mousedown·G15 ＋ 등 · 설계상 끝 표본이 없다).
 *   이 조작의 «끝 표본»은 설계상 undo 첫머리 체크포인트(DEF-01)다 — 그래서 A2 를 «구제가 정확히 한 번 일어난다»로 바꿔 단언한다:
 *     undoDLen === 1 · undoDPos === 0(구제 칸을 쌓고 한 칸 내려옴). 앞 표본 자체는 A3 가 잰다 — 부르는 쪽이 조작 «앞»에
 *     날 변화(표본 없는 변화)를 두면 앞 표본이 그 상태를 쌓아야만 ⌘Z 가 거기서 멈춘다(빠지면 날 변화 전까지 간다 = A3 빨강). */
async function expectOneUndoStep(page, action, label, { settleMs = 300, soft = false, beforeOnly = false } = {}) {
  const s0 = await readHistory(page);
  await action();
  await page.waitForTimeout(settleMs);
  const s1 = await readHistory(page);
  await page.evaluate(() => document.activeElement?.blur?.());
  await page.keyboard.press('Meta+z');
  await page.waitForTimeout(settleMs);
  const s2 = await readHistory(page);
  const r = {
    label,
    dPos: s1.tip.pos - s0.tip.pos, dLen: s1.tip.len - s0.tip.len, seqNew: s1.tip.seq !== s0.tip.seq, topAction: s1.tip.action,
    undoDPos: s2.tip.pos - s1.tip.pos, undoDLen: s2.tip.len - s1.tip.len,
    changed: strip(s1.canvas) !== strip(s0.canvas), restoredRaw: strip(s2.canvas) === strip(s0.canvas),
  };
  /* ★A3 = «내용» 비교(2026-10-04 지디 승인 · E80 덤 실측): 렌더가 style 을 rgb·띄어쓰기로 다시 써서
     «같은 내용인데 날 바이트가 다름»이 난다(현빈 사본 블록 삭제 → ⌘Z: 날 다름 · 구조 차이 0 · style 정규화 18).
     날 비교(restoredRaw)는 기록으로 남기고, 다르면 _struct-cmp 로 내용을 잰다.
     「의도됨」 — 이 A3 가 «안 잡기로» 한 것: style 표현 차이(rgb↔hex · 띄어쓰기 · 선언 순서 — cssText 정규화가 같게 만드는 것)와
       공백만인 글자 노드. ⚠️그래서 가려지는 것: 색·크기를 «같은 값의 다른 표기»로 되돌리는 결함, 공백 노드만 늘거나 주는 결함은 이 A3 가 못 본다
       (그런 결함을 재려면 restoredRaw 를 따로 단언하라). */
  r.restored = r.restoredRaw;
  if (!r.restoredRaw) {   // 어디서 갈렸나 — 첫 차이 둘레를 남긴다(다시 쫓지 않게)
    const a = strip(s0.canvas), b = strip(s2.canvas); let i = 0; while (i < a.length && a[i] === b[i]) i++;
    r.firstDiff = { at: i, lenA: a.length, lenB: b.length, before: a.slice(Math.max(0, i - 80), i + 80), after: b.slice(Math.max(0, i - 80), i + 80) };
    const sc = await structCmp(page, a, b);
    r.structDiffs = sc.diffs.slice(0, 3); r.styleOnly = sc.styleOnly;
    r.restored = sc.diffs.length === 0;
  }
  console.log(`[HSTEP] ${label} ${JSON.stringify(r)}`);
  if (soft) return r;
  expect(r.changed, `A0 ${label}: 조작이 화면을 바꿨다(전제)`).toBe(true);
  expect(r.dPos >= 1 && r.seqNew, `A1 ${label}: 조작 직후 꼭대기가 새 칸(끝 표본) — Δpos=${r.dPos} seqNew=${r.seqNew} top=${r.topAction}`).toBe(true);
  if (beforeOnly) {
    expect([r.undoDLen, r.undoDPos], `A2' ${label}: 앞 표본만 찍는 조작 — ⌘Z 가 구제를 «정확히 한 번»(len +1 · pos 제자리)`).toEqual([1, 0]);
  } else {
    expect(r.undoDLen, `A2 ${label}: ⌘Z 가 구제 칸을 만들지 않았다(len 변화 ${r.undoDLen} — +1 이면 끝 표본이 빠진 것)`).toBe(0);
    expect(r.undoDPos, `A2 ${label}: ⌘Z 한 번 = 정확히 한 칸 아래(pos 변화 ${r.undoDPos})`).toBe(-1);
  }
  expect(r.restored, `A3 ${label}: ⌘Z 한 번 뒤 화면 = 조작 전 «내용»(구조 비교 · 날 같음=${r.restoredRaw})`).toBe(true);
  return r;
}

module.exports = { expectOneUndoStep, readHistory, stripNonEdit: strip };
