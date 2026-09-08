/* autosave-overlap.test.js — «겹친 로드»에서 앞엣것의 뒤늦은 타이머가 뒤엣것을 푸는가. (지디 조건 ③)
 * 실행: node --test tests/unit/autosave-overlap.test.js
 *
 * ★왜 이 검사가 필요한가
 *   9월 9일에 applyProjectData 의 해제를 「rAF 단독」에서 「rAF + 250ms 타이머」로 바꿨다.
 *   그러자 «새 구멍»이 생길 수 있다: A 로드가 타이머를 예약한 뒤, 그 타이머가 터지기 «전»에
 *   B 로드가 시작되면 — A 의 늦은 타이머가 B 의 억제를 풀어 버린다.
 *   그러면 B 가 innerHTML 을 갈아 끼우는 «도중»에 자동저장이 예약돼 «반쪽 문서»가 디스크에 남는다.
 *   고착(안 풀림)을 고치다 그 반대(너무 일찍 풀림)를 만드는 자리다.
 *
 * ★해답은 «새 기계»가 아니었다 — 정본 autosave-suppress.js 가 이미 둘을 갖고 있다.
 *   ⑴ 깊이 세기: 마지막으로 나가는 자만 끈다 (A 가 나가도 B 가 남았으면 안 꺼진다)
 *   ⑵ 토큰 빗장(`tok.released`): rAF 와 타이머 «둘 다» 걸려도 깊이는 한 번만 깎인다
 *   ⇒ save-load.js 는 손으로 빗장을 또 짓지 말고 정본을 «쓴다». N5 가 그 배선을 지킨다.
 *
 * ⛔이 파일의 규율: 초록을 믿기 전에 «빨강을 한 번 봐야» 한다.
 *   N3 = 양성대조(깊이 세기가 «없으면» 실제로 풀린다) · N4 = 변이시험(빗장을 떼면 빨강)
 *   N7 = 전수 술어의 양성대조(새 자리가 생기면 실제로 잡히는가)
 */
'use strict';
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('fs');
const path = require('path');
const { readSrc, toPosix } = require('./_srcread.js');   // ⛔CRLF — win-portability ①-3

const ROOT = path.join(__dirname, '..', '..');
const SUPPRESS_SRC = readSrc(ROOT, 'js', 'autosave-suppress.js');

const sleep = (ms) => new Promise(r => setTimeout(r, ms));

/** 억제 모듈을 DOM 없이 얹는다. rAF 는 «손으로» 돌린다 — 가려진 창을 흉내 내려면 안 돌려야 하므로.
 *  ⚠️타이머는 «진짜»다: 모듈이 `w.setTimeout` 이 아니라 맨 `setTimeout` 을 부르기 때문에
 *    가짜로 못 갈아 끼운다. 그래서 이 파일은 실제로 250ms 를 기다린다. */
function loadSuppress(src = SUPPRESS_SRC) {
  const w = { state: { _suppressAutoSave: false } };
  const rafQ = [];
  w.requestAnimationFrame = (fn) => { rafQ.push(fn); return rafQ.length; };
  new Function('window', 'globalThis', src)(w, w);
  return { w, A: w.AutoSaveSuppress, flushRaf: () => rafQ.splice(0).forEach(fn => fn()) };
}

/** 실물이 겪는 모양 그대로: A 가 endNextFrame 으로 «닫는 중»일 때 B 가 연다. */
async function overlappedLoad(src) {
  const { w, A, flushRaf } = loadSuppress(src);
  const a = A.begin('loadA');
  A.endNextFrame(a);          // A 의 rAF + 250ms 타이머가 «둘 다» 예약된다
  const b = A.begin('loadB');  // B 가 끼어든다 — A 의 타이머는 아직 안 터졌다
  flushRaf();
  const afterRaf = w.state._suppressAutoSave;
  await sleep(NEXT_FRAME_MS() + 120);       // A 의 타이머가 확실히 지나갈 때까지
  const afterTimer = w.state._suppressAutoSave;
  A.end(b);
  return { afterRaf, afterTimer, afterBEnd: w.state._suppressAutoSave };
}

function NEXT_FRAME_MS() {
  const m = SUPPRESS_SRC.match(/NEXT_FRAME_FALLBACK_MS\s*=\s*(\d+)/);
  assert.ok(m, '★안전망 상수가 사라졌다 — 이 검사가 겨누는 대상이 없다');
  return Number(m[1]);
}

/* ═══ 본 단언 ═══════════════════════════════════════════════════════════ */

test('N1 ★겹친 로드 — A 의 뒤늦은 타이머가 B 의 억제를 «못» 푼다', async () => {
  const r = await overlappedLoad();
  assert.equal(r.afterRaf, true,
    '★A 의 rAF 가 B 의 억제를 풀었다 — B 가 문서를 갈아 끼우는 도중에 자동저장이 예약된다');
  assert.equal(r.afterTimer, true,
    `★A 의 ${NEXT_FRAME_MS()}ms 안전망이 B 의 억제를 풀었다 — 고착을 고치다 «반쪽 저장»을 만든 것이다`);
  assert.equal(r.afterBEnd, false,
    '★B 까지 닫았는데 억제가 «안» 꺼진다 — 이번엔 진짜 고착이다(A 의 타이머가 깊이를 두 번 깎았거나)');
});

test('N2 ★음성대조 — 겹치지 «않으면» 정상적으로 풀린다 (검사가 늘 초록이 아님을 보인다)', async () => {
  const { w, A, flushRaf } = loadSuppress();
  const a = A.begin('loadA');
  A.endNextFrame(a);
  flushRaf();
  assert.equal(w.state._suppressAutoSave, false,
    '★혼자 열고 닫았는데 안 풀린다 — N1 의 초록은 「아무것도 안 풀린다」는 뜻이었을 뿐이다');
});

test('N3 ★양성대조 — 깊이 세기 «없이» 맨손으로 같은 모양을 만들면 실제로 풀린다', async () => {
  /* 정본을 안 쓰고 각자 빗장을 짓던 옛 모양. 빗장은 «호출마다» 새로 생기는데
     억제 플래그는 «하나»라 A 의 빗장이 B 를 못 막는다 — 지디가 지목한 그 구멍. */
  const st = { _suppressAutoSave: false };
  st._suppressAutoSave = true;                                   // A 가 연다
  let aReleased = false;
  const aRelease = () => { if (aReleased) return; aReleased = true; st._suppressAutoSave = false; };
  setTimeout(aRelease, 30);                                      // A 의 안전망
  st._suppressAutoSave = true;                                   // B 가 연다
  await sleep(120);
  assert.equal(st._suppressAutoSave, false,
    '★양성대조가 «안» 터졌다 — 이 검사는 구멍을 못 잰다. N1 의 초록도 못 믿는다');
});

test('N4 ★변이시험 — 깊이 세기를 떼면 N1 이 «빨강»이 된다', async () => {
  /* 「마지막으로 나가는 자만 끈다」를 「나가면 무조건 끈다」로 바꾼다. */
  const mutated = SUPPRESS_SRC.replace(
    'if (depth === 0) writeFlag(outerPrev);',
    'writeFlag(outerPrev);   /* MUTANT */');
  assert.notEqual(mutated, SUPPRESS_SRC, '★변이가 «주입되지 않았다» — 이 변이시험은 아무것도 안 쟀다');
  const r = await overlappedLoad(mutated);
  assert.equal(r.afterRaf, false,
    '★깊이 세기를 뗐는데도 B 가 버틴다 — N1 이 재는 것은 깊이 세기가 «아니다»');
});

test('N5 ★배선 — applyProjectData 가 «자기» 빗장을 또 짓지 않고 정본을 쓴다', () => {
  const SL = readSrc(ROOT, 'js', 'io', 'save-load.js');
  /* ⛔assert.match 를 쓰지 마라 — 실패하면 90KB 짜리 파일 전문을 토해 실패 이유가 안 보인다. */
  const has = (re, msg) => assert.ok(re.test(SL), msg);
  has(/\.begin\('applyProjectData'\)/,
    '★정본으로 «열지» 않는다 — 토큰이 없으면 아래 endNextFrame 이 깊이를 못 맞춘다');
  has(/window\.AutoSaveSuppress/,
    '★정본을 «찾지» 않는다 — 이 파일은 모듈이라 window 경유가 유일한 통로다');
  has(/\.endNextFrame\(_suppressTok\)/,
    '★정본으로 «닫지» 않는다 — 손으로 지은 빗장은 겹친 로드에서 남의 창을 푼다(N3 이 그 모양)');
  /* ⛔정본이 없을 때(고전 스크립트 로드 실패) 떨어질 자리는 «남겨 둔다» —
     그 폴백의 rAF+타이머+빗장은 autosave-unsuppress.test.js 의 A1~A3 이 지킨다. */
});

/* ═══ 전수 — 「rAF 단독 해제가 몇 건인가」 ═══════════════════════════════
   ⛔지디의 ⑤: 「네 곳 다 고쳤나」로 세지 마라 — 손 명부는 다섯 번째가 생기는 날 조용히 통과한다.
   ⇒ «술어»로 센다: `_suppressAutoSave = false` 를 하는 자리 중 타이머 안전망이 없는 것.
   ★그 수는 «0 이 아니다» — 지디가 ④ 로 백로그로 미룬 셋이 그대로 있다(이 브랜치 범위 밖).
     그래서 「0 건」이 아니라 「정확히 이 셋」으로 잠근다. 넷째가 생기면 빨강, 셋 중 하나를
     고쳐도 빨강(그때 이 목록을 줄이라는 뜻이다). ⇒ 어느 방향으로 움직여도 사람이 본다. */

const RAF_ONLY_BACKLOG = {
  'js/collab/sync.js': '원격 패치 적용. 고전 스크립트라 import 불가 — endNextFrame 을 window 경유로 부르게 바꿔야 한다',
  'js/history.js': 'restoreSnapshot·restoreSnapshotScoped 둘. 되돌리기는 «보이는 창»에서만 나므로 급하지 않다',
};

function allJsFiles(dir = path.join(ROOT, 'js'), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allJsFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}

/** 「억제를 «푸는» 자리 중 타이머 안전망이 없는 것」 — 술어를 코드로 박는다.
 *  보호로 치는 것: 같은 사정거리 안의 `setTimeout(` 또는 `endNextFrame`(정본 경유). */
function rafOnlyReleases(files) {
  const hits = [];
  for (const { rel, src } of files) {
    const re = /_suppressAutoSave\s*=\s*false/g;
    let m;
    while ((m = re.exec(src))) {
      const scope = src.slice(Math.max(0, m.index - 400), m.index + 200);
      if (/setTimeout\(/.test(scope) || /endNextFrame/.test(scope)) continue;
      hits.push({ rel, line: src.slice(0, m.index).split('\n').length });
    }
  }
  return hits;
}

function scanTargets() {
  return allJsFiles()
    .map(p => ({ rel: toPosix(path.relative(ROOT, p)), src: readSrc(p) }))
    /* 정본 자신은 «대상»이 아니라 «처방»이다 — 여기 writeFlag 는 깊이 0 에서만 돈다. */
    .filter(f => f.rel !== 'js/autosave-suppress.js');
}

test('N6 ★전수 — 「타이머 안전망 없는 해제」가 백로그 셋 «그대로»인가', () => {
  const hits = rafOnlyReleases(scanTargets());
  const byFile = {};
  for (const h of hits) (byFile[h.rel] ||= []).push(h.line);

  const found = Object.keys(byFile).sort();
  const declared = Object.keys(RAF_ONLY_BACKLOG).sort();
  assert.deepEqual(found, declared,
    `★rAF 단독 해제 명부가 어긋났다.\n  잰 것: ${JSON.stringify(byFile)}\n  적힌 것: ${declared.join(', ')}\n` +
    '  ⇒ 늘었으면 새 사고 자리다. 줄었으면 «이 목록과 autosave-suppress.js 의 백로그 주석»을 같이 고쳐라.');
  assert.equal(hits.length, 3,
    `★건수가 ${hits.length} 다 — 같은 파일 «안»에서 늘었다(파일 명부만으로는 안 잡힌다): ${JSON.stringify(byFile)}`);
});

test('N7 ★양성대조 — 새 자리가 «하나» 생기면 술어가 실제로 잡는가', () => {
  const base = rafOnlyReleases(scanTargets()).length;
  const fake = 'function foo(){ requestAnimationFrame(() => { state._suppressAutoSave = false; }); }';
  const withNew = rafOnlyReleases([...scanTargets(), { rel: 'js/__fake__.js', src: fake }]);
  assert.equal(withNew.length, base + 1,
    '★새 rAF 단독 해제를 «못 잡는다» — N6 의 「셋 그대로」는 「못 재고 있다」는 뜻일 수 있다');
  assert.ok(withNew.some(h => h.rel === 'js/__fake__.js'), '★잡긴 했는데 «다른 것»을 세었다');
});

test('N8 ★음성대조 — 안전망이 «있는» 자리는 세지 않는다', () => {
  const safe = 'let r=false; const f=()=>{ if(r)return; r=true; state._suppressAutoSave = false; };'
             + ' requestAnimationFrame(f); setTimeout(f, 250);';
  const hits = rafOnlyReleases([{ rel: 'js/__safe__.js', src: safe }]);
  assert.equal(hits.length, 0,
    '★고쳐 놓은 자리를 «아직 결함»으로 센다 — 그러면 명부가 영영 못 줄고 아무도 안 본다');
});
