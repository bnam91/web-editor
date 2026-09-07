/* ══════════════════════════════════════════════════════════════════════════
   main/crash/scrub.js — 기록에 «남길 문자열»을 씻는다. (H2, 2026-09-06)
   ──────────────────────────────────────────────────────────────────────────
   ★왜 «메인»에도 세척기가 필요한가
     크래시 기록에 들어가는 문장 절반은 «메인 프로세스»가 만든다 — uncaughtException
     스택에는 /Users/<실명>/... 이 그대로 있다. 렌더러 링버퍼(js/report-buffer.js)는
     자기 것만 씻는다. 메인이 안 씻으면 logs/ 에 홈 경로가 그대로 떨어지고,
     tools/hardening/judge/pii.mjs 가 «축 ⑴ 홈 경로»에서 그걸 잡는다(FAIL).

   ★★복사하지 않는다 — «원본을 실행해서» 가져온다
     세척 규칙은 js/report-buffer.js 의 scrubPaths 가 정본이다(공백 든 이름·윈도우
     경로·URL 예외까지 실측으로 다듬은 물건이다). 여기서 규칙을 다시 쓰면 반드시
     갈라지고, 갈라진 쪽이 «메인»이면 아무도 안 본다. 그래서 그 파일을 읽어
     new Function 으로 돌려 scrubPaths 함수 하나만 꺼내 쓴다.
     ⇒ 두 구현이 «같은지»는 tests/unit/crash-record.test.mjs 가 표본으로 고정한다.

   ⛔못 불러오면 «조용히 원문»이 되면 안 된다 (fail-closed)
     패키징 누락·파일 이동으로 로드가 실패할 수 있다. 그때는 훨씬 «둔한» 대체
     세척기로 내려간다 — 둔한 쪽은 파일명까지 통째로 버린다(진단은 손해, 유출은 0).
     그리고 어느 쪽을 썼는지 source 로 «말한다». 말 없는 폴백은 폴백이 아니다.
══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

/** 렌더러 정본 세척기가 사는 곳. 옮기면 여기도 같이 옮겨야 한다(테스트가 잡는다). */
const CANON = path.join(__dirname, '..', '..', 'js', 'report-buffer.js');

let _scrub = null;
let _source = null;
let _loadError = null;

/* ── 대체 세척기 — «둔하게» 자른다. 정본의 복사본이 아니다. ────────────────
   정본은 「파일명은 남기고 경로만 지운다」(재현에 파일명이 쓸모 있으니까).
   여기선 그 판단을 안 한다 — 경로처럼 생긴 건 파일명까지 통째로 «…» 로 바꾼다.
   이 함수가 도는 상황은 이미 「정본을 못 읽었다」이고, 그때 우리가 지켜야 할 건
   진단 품질이 아니라 «유출 0» 이다. */
function bluntScrub(s) {
  let out = String(s);
  out = out.replace(/\bfile:\/\/\/?/g, '/');
  out = out.replace(/[A-Za-z]:\\(?:[^\\\s'"`)\];:,]+\\?)+/g, '…');      // 윈도우 절대경로
  out = out.replace(/(?:\/[^\s'"`)\];:,/]+){2,}\/?/g, (m, off, full) => {
    const prev = off > 0 ? full.charAt(off - 1) : '';
    if (prev === '/' || prev === ':') return m;                          // URL 은 아래 규칙이 본다
    return '…';
  });
  return out;
}

/** 정본을 «실행»해서 scrubPaths 를 꺼낸다. 브라우저 전용 API 는 최소 스텁으로 채운다. */
function loadCanonical() {
  const src = fs.readFileSync(CANON, 'utf8');
  /* report-buffer.js 는 (function(w){…})(window) 꼴이다. window 를 인자로 넘겨 준다.
     · addEventListener  — 후킹 세 개가 부른다. 메인엔 이벤트가 없으니 빈 함수.
     · console           — error 가 «없으면» console 후킹을 건너뛴다(원본 코드가 그렇게 짜여 있다).
                           ⇒ 메인의 console.error 를 이 로드가 갈아끼우는 일은 «일어나지 않는다».
     · crypto 없음       — 소금이 Math.random 으로 떨어진다. 여기선 해시를 안 쓴다. */
  const w = { addEventListener() {}, console: {} };
  new Function('window', src)(w);
  const f = w.ReportBuffer && w.ReportBuffer.scrubPaths;
  if (typeof f !== 'function') throw new Error('scrubPaths 를 못 찾음');
  // 실제로 도는지 한 번 «써 보고» 채택한다 — 존재만 확인하면 빈 함수도 통과한다.
  if (f('/Users/probe/x/y.txt') === '/Users/probe/x/y.txt') throw new Error('scrubPaths 가 아무것도 안 씻는다');
  return f;
}

function ensure() {
  if (_scrub) return;
  try {
    _scrub = loadCanonical();
    _source = 'report-buffer';
  } catch (e) {
    _scrub = bluntScrub;
    _source = 'blunt-fallback';
    _loadError = (e && e.message) || String(e);
  }
}

/* ── 정본이 «일부러» 안 건드리는 것 두 가지를 여기서 더 자른다 ──────────────
   ⑴ goya-asset://<projectId>/<파일명>  — judge/pii.mjs 축 ⑶ 이 «파일명»을 표본으로 잡는다.
      정본 scrubPaths 는 URL 을 비껴간다(그건 그쪽 설계가 맞다 — 링버퍼는 describeResUrl 로
      따로 줄인다). 메인 기록엔 describeResUrl 이 없으니 여기서 스킴만 남긴다.
   ⑵ data: 페이로드 — 「파일명」이 아니라 «내용»이다. 길이가 길면 통째로 버린다. */
function redactUrls(s) {
  return String(s)
    .replace(/\bgoya-asset:\/\/[^\s'"`)\]]+/gi, 'goya-asset://…')
    .replace(/\bdata:[a-z0-9.+-]*\/?[a-z0-9.+-]*;?[^\s'"`)\]]{40,}/gi, 'data:…');
}

/** 한 줄 세척. 어떤 입력이 와도 «던지지 않는다» — 못 씻으면 지운다. */
function scrub(s) {
  ensure();
  try {
    return redactUrls(_scrub(String(s == null ? '' : s)));
  } catch (_) {
    return '[scrub-failed]';
  }
}

/** 어느 세척기를 쓰고 있나. 기록에 같이 실린다 — 폴백으로 내려간 걸 «말하기» 위해서다. */
function source() { ensure(); return { source: _source, error: _loadError, canon: CANON }; }

module.exports = { scrub, source, _bluntScrub: bluntScrub, _CANON: CANON };
