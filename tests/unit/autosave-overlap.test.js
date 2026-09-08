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

/* ═══ 전수 — 「해제가 «가려진 창에서 안 도는 것»에 얹혀 있는데 안전망이 없다」 ═════════
   ⛔지디의 ⑤ 초판은 「rAF 를 푸는데 setTimeout 짝이 없는 것이 0건인가」였다. 그는 곧
     스스로 정정했다 — 「갈래가 넷인데 하나만 세라고 했다」. 맞다. 그리고 «축이 하나 더» 있다:

     축① 스케줄러 — rAF 말고도 ResizeObserver·IntersectionObserver·requestIdleCallback 이
        전부 «렌더링 갱신 단계»에 얹혀 있어 가려진 창에서 안 돈다(그쪽 실측: RO 는 초기 관측조차 0건).
     축② ★플래그 — 억제류 플래그가 `_suppressAutoSave` «하나가 아니다». `_lazyRenderPass` 도
        자동저장을 거른다. 이름을 손으로 박은 술어는 그 자리를 영영 못 본다.
     축③ ★「안전망이 있다」의 뜻 — `else setTimeout(...)` 은 «폴백»이지 «안전망»이 아니다.
        rAF 가 «없을 때»만 타므로, rAF 가 «있는데 안 도는» 가려진 창에선 영영 안 탄다.
        (이게 2026-09-09 사고의 정체 그 자체다. 이 구분이 없으면 병든 자리가 초록으로 통과한다.)

   ⇒ 셋 다 «성질»로 적는다. 아래 명부는 그 성질의 «오늘 목록»일 뿐이다 —
     새 스케줄러가 생기면 RENDER_STAGE 에, 새 억제 플래그가 생기면 «도출»이 알아서 잡는다.
   ⇒ 그리고 그 수에 «양성대조»를 붙인다(C1~C6). 안 그러면 「5건」이 「못 재고 있다」와 구분이 안 된다. */

/** 가려진 창(visibilityState:'hidden')에서 «안 도는» 예약 수단들.
 *  ★공통 성질 = 렌더링 갱신 단계(rendering update steps)에 얹혀 있다.
 *  ⚠️이건 «오늘 아는 목록»이다. 같은 성질의 새 API 가 생기면 여기 늘어야 한다. */
const RENDER_STAGE = /(requestAnimationFrame|requestIdleCallback|new\s+IntersectionObserver|new\s+ResizeObserver)\s*\(/;

/** 그 인덱스를 감싸는 «가장 안쪽» 블록의 여는 `{`. 없으면 -1. */
function enclosingBrace(src, at) {
  let d = 0;
  for (let i = at; i >= 0; i--) {
    const c = src[i];
    if (c === '}') d++;
    else if (c === '{') { if (d === 0) return i; d--; }
  }
  return -1;
}
function callbackHead(src, brace) { return brace < 0 ? '' : src.slice(Math.max(0, brace - 120), brace); }

/** 그 `{` 가 «콜백의 몸통»인가 — 바로 앞이 `=>` 나 `function(...)` 이어야 한다.
 *  ⛔이 검사가 없으면 `} else {` 가 «윗줄의 rAF»를 자기 것으로 읽어 오탐한다(실측). */
function isCallbackBody(head) { return /(?:=>|function\s*\**\s*\w*\s*\([^)]*\))\s*$/.test(head); }

/** 이 해제가 «가려진 창에서 안 도는 것»에 얹혀 있고 타이머 안전망이 없는가.
 *  반환: 'inline'(콜백을 그 자리에서 넘김) · 'named'(이름으로 넘김) · null(안전) */
function unnettedRelease(src, at) {
  const head = callbackHead(src, enclosingBrace(src, at));
  if (!isCallbackBody(head)) return null;                      // 동기 해제 — 고착하지 않는다
  if (RENDER_STAGE.test(head)) return /setTimeout\(|endNextFrame/.test(head) ? null : 'inline';
  /* 이름으로 넘기는 꼴 — `const restore = () => {…}` 을 rAF 가 «따로» 부른다 */
  const named = head.match(/(?:const|let|var|function)\s+(\w+)\s*=?\s*(?:\([^)]*\)\s*=>|function)?\s*$/);
  if (!named) return null;
  const n = named[1];
  const byRender = new RegExp(`(requestAnimationFrame|requestIdleCallback)\\(\\s*${n}\\s*[,)]`).test(src);
  /* ⛔`else setTimeout(...)` 은 안전망이 아니다(축③) — 그건 rAF 가 «없을 때» 폴백이다. */
  const byTimer = new RegExp(`(?<!else\\s{0,8})setTimeout\\(\\s*${n}\\s*[,)]`).test(src);
  return (byRender && !byTimer) ? 'named' : null;
}

/** ★억제류 플래그를 «도출»한다 — 손으로 적지 않는다(축②).
 *  성질 = 「save-load.js 에서 이 플래그를 보고 자동저장을 «거른다»」. */
function deriveSuppressFlags(saveLoadSrc) {
  const out = new Set();
  const re = /if\s*\(([^)]*state\._[A-Za-z]\w*[^)]*)\)[^;{]*\{?\s*(?:return|continue)\b/g;
  let m;
  while ((m = re.exec(saveLoadSrc))) {
    for (const f of m[1].matchAll(/state\._([A-Za-z]\w*)/g)) out.add('_' + f[1]);
  }
  return [...out].sort();
}

function allJsFiles(dir = path.join(ROOT, 'js'), out = []) {
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) allJsFiles(p, out);
    else if (e.name.endsWith('.js')) out.push(p);
  }
  return out.sort();
}
function scanTargets() {
  return allJsFiles()
    .map(p => ({ rel: toPosix(path.relative(ROOT, p)), src: readSrc(p) }))
    /* 정본 자신은 «대상»이 아니라 «처방»이다 — 여기 writeFlag 는 깊이 0 에서만 돈다. */
    .filter(f => f.rel !== 'js/autosave-suppress.js');
}

/** 「안전망 없는 해제」 전수. flags 는 도출해서 넘긴다. */
function unnettedReleases(files, flags) {
  const alt = `(?:${flags.join('|')})`;
  const hits = [];
  for (const { rel, src } of files) {
    const re = new RegExp(`\\w+\\.${alt}\\s*=\\s*(?:false|\\w*[Pp]rev\\w*)`, 'g');
    let m;
    while ((m = re.exec(src))) {
      const kind = unnettedRelease(src, m.index);
      if (kind) hits.push({ rel, line: src.slice(0, m.index).split('\n').length, kind });
    }
  }
  return hits;
}

/* ★백로그 명부 = 티켓 정본 `_context/BACKLOG-autosave-raf-only.md`.
   ⛔「고칠 수 있는데 안 고쳤다」가 아니라 「이 브랜치 «범위 밖»이다」인 자리만 여기 있다(지디 조건 ④).
   ★아래 둘은 검사를 넓히다 «새로 찾은» 것이다 — 이번에 고친 것과 갈라 적는다. */
const UNNETTED_BACKLOG = {
  'js/collab/sync.js':          [418],
  'js/history.js':              [105, 230],
  'js/io/lazy-sections.js':     [59],    // ★신규 — `_lazyRenderPass` (플래그 축을 넓혀서 보였다)
  'js/version-history-ui.js':   [407],   // ★신규 — `else setTimeout` 이 안전망이 아님을 알고 보였다
};

test('N6 ★도출 — 억제류 플래그를 «손으로 적지 않고» 뽑는다', () => {
  const flags = deriveSuppressFlags(readSrc(ROOT, 'js', 'io', 'save-load.js'));
  assert.ok(flags.includes('_suppressAutoSave'),
    '★도출이 «아는 것»조차 못 뽑았다 — 술어가 깨졌고, 아래 전수는 전부 「0건」으로 거짓 초록이 된다');
  assert.ok(flags.length >= 2,
    `★플래그가 ${flags.length}개뿐이다(${flags}) — _lazyRenderPass 가 빠졌다면 lazy 경로를 통째로 못 본다`);
});

test('N6b ★양성대조 — 새 억제 플래그가 «생기면» 도출이 잡는가', () => {
  const src = readSrc(ROOT, 'js', 'io', 'save-load.js')
    + '\nfunction __fake(){ if (state._brandNewGate) return; }\n';
  assert.ok(deriveSuppressFlags(src).includes('_brandNewGate'),
    '★새 게이트를 «못 뽑는다» — N6 의 초록은 「목록이 늘 그대로」라는 뜻일 뿐이다');
});

test('N7 ★전수 — 안전망 없는 해제가 백로그 «그대로»인가', () => {
  const flags = deriveSuppressFlags(readSrc(ROOT, 'js', 'io', 'save-load.js'));
  const hits = unnettedReleases(scanTargets(), flags);
  const byFile = {};
  for (const h of hits) (byFile[h.rel] ||= []).push(h.line);
  for (const k of Object.keys(byFile)) byFile[k].sort((a, b) => a - b);

  assert.deepEqual(byFile, UNNETTED_BACKLOG,
    '★안전망 없는 해제 명부가 어긋났다.\n  잰 것 : ' + JSON.stringify(byFile) +
    '\n  적힌 것: ' + JSON.stringify(UNNETTED_BACKLOG) +
    '\n  ⇒ 늘었으면 새 사고 자리다. 줄었으면 «이 명부 + _context/BACKLOG-autosave-raf-only.md +' +
    ' autosave-suppress.js 주석»을 같이 고쳐라(셋이 따로 낡는 게 이 계열의 다음 사고다).');
});

/* ═══ 술어의 양성·음성대조 — 「5건」이 「못 재고 있다」와 구분되게 ═══════════════ */
const F = ['_suppressAutoSave'];
const one = (src) => unnettedReleases([{ rel: 'js/__probe__.js', src }], F);

test('C1 ★양성대조 — 네 스케줄러 «전부» 잡는가 (rAF 만 세면 나머지 셋이 새어 나간다)', () => {
  const cases = {
    rAF: 'requestAnimationFrame(() => { state._suppressAutoSave = false; });',
    rIC: 'requestIdleCallback(() => { state._suppressAutoSave = false; });',
    IO:  'new IntersectionObserver(() => { state._suppressAutoSave = false; }).observe(el);',
    RO:  'new ResizeObserver(() => { state._suppressAutoSave = false; }).observe(el);',
  };
  for (const [name, src] of Object.entries(cases)) {
    assert.equal(one(src).length, 1,
      `★${name} 로 푸는 자리를 «못 잡는다» — 가려진 창에서 ${name} 도 안 돈다(그쪽 실측: RO 는 초기 관측조차 0건)`);
  }
});

test('C2 ★양성대조 — `else setTimeout` 은 안전망이 «아니다» (폴백과 안전망의 구분)', () => {
  const src = 'const r = () => { state._suppressAutoSave = false; };\n'
            + "if (typeof requestAnimationFrame === 'function') requestAnimationFrame(r); else setTimeout(r, 0);";
  assert.equal(one(src).length, 1,
    '★else 폴백을 «안전망»으로 셌다 — rAF 가 «있는데 안 도는» 가려진 창에선 else 가 영영 안 탄다. ' +
    '이게 2026-09-09 사고의 정체 그 자체라 이 구분이 무너지면 검사가 병든 자리를 초록으로 통과시킨다');
});

test('C3 ★음성대조 — rAF 와 타이머를 «둘 다» 걸면 세지 않는다', () => {
  const src = 'const r = () => { state._suppressAutoSave = false; };\n'
            + 'requestAnimationFrame(r);\nsetTimeout(r, 250);';
  assert.equal(one(src).length, 0,
    '★고쳐 놓은 자리를 «아직 결함»으로 센다 — 그러면 명부가 영영 못 줄고 아무도 안 본다');
});

test('C4 ★음성대조 — «동기» 해제는 결함이 아니다 (else 가지의 즉시 해제)', () => {
  const src = "if (typeof requestAnimationFrame === 'function') {\n"
            + '  requestAnimationFrame(() => { state._suppressAutoSave = false; });\n'
            + '} else {\n  state._suppressAutoSave = false;\n}';
  assert.equal(one(src).length, 1,
    '★한 건(rAF 안쪽)만 나와야 한다 — else 의 «즉시» 해제는 고착하지 않는다');
  assert.equal(one(src)[0].line, 2, '★잡긴 했는데 «else 쪽»을 세었다(윗줄 rAF 를 자기 것으로 읽는 오탐)');
});

test('C5 ★음성대조 — 정본(endNextFrame) 경유는 세지 않는다', () => {
  assert.equal(one('AS.endNextFrame(tok); const x = () => { state._suppressAutoSave = false; };').length, 0,
    '★정본을 쓰는 자리를 결함으로 센다');
});

test('C6 ★변이 — 스케줄러 명부에서 하나를 빼면 그 자리를 «놓친다» (명부가 실제로 쓰이는가)', () => {
  /* 이 검사는 RENDER_STAGE 를 직접 재현하지 않는다 — 「좁히면 새어 나간다」를 «보여» 준다.
     지디의 초판 기준(rAF 만)이 왜 좁았는지가 이 한 줄로 남는다. */
  const narrow = /requestAnimationFrame\s*\(/;
  const io = 'new IntersectionObserver(() => { state._suppressAutoSave = false; }).observe(el);';
  assert.ok(!narrow.test(io), '★전제가 깨졌다 — 이 변이는 아무것도 안 보여 준다');
  assert.equal(one(io).length, 1, '★넓힌 명부로도 못 잡는다 — C1 과 모순이다');
});
