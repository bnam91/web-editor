/* ══════════════════════════════════════════════════════════════════════════
   export-report.js — 내보내기 «실패»를 «재현 가능한 형태»로 남긴다.
   현빈 발주(2026-09-05): 「내보내기 실패 건 있으면 버그로 보고가 될 수 있도록.
     로컬 클라이언트가 쓰는 걸 내가 받아 봐서 «어떤 경우의 수»에서 나오는지 확인하려고.」

   ⇒ 이 파일의 독자는 «사용자»가 아니라 «현빈»이다. 판정 한 줄:
      「이 기록만 보고 재현할 수 있는가」. 재현에 안 쓰이는 값은 넣지 않는다.

   ★어디로 가나 (실측 경로 — IMPL-export-report.md ⑤)
      ReportBuffer.note() → 링버퍼 → 신고 창이 «열릴 때» state.errors 로 스냅샷
      → report:submit payload.errors → 서버 → admin:report-list
      → settings-admin.js renderDetail 「앱이 붙인 직전 오류 N건」
      ⇒ 사용자가 «신고 버튼을 눌러야» 간다(ⓐ안). 자동 전송(ⓑ)은 현빈 게이트라 여기 없다.

   ★★링버퍼는 20칸뿐이다 — 우리가 채우면 «남의 오류»가 밀려난다
      담기 전 a96c35a 의 export-gate.js 는 tier 와 무관하게 «내보낼 때마다» note 했다.
      22섹션을 내보내면 그것만으로 20칸이 다 찬다 — 정작 3번 섹션의 실패 줄도,
      그 앞의 console.error 도 전부 밀려난다(「남겼는데 아무도 못 본다」).
      ⇒ ⑴«실패»에서만 담고 ⑵한 판(run)에 최대 MAX_PER_RUN 줄 + 요약 1줄로 막는다.
        생략된 건수는 요약 줄이 숫자로 말한다 — 조용히 버리지 않는다.

   ⛔절대 담지 않는 것 (이건 클라이언트의 «상업용 상세페이지»다)
      · 사용자가 쓴 글자 · 섹션 «이름»(sec._name 은 사람이 지은 말이다)
      · 이미지 데이터/경로/파일명 · 프로젝트 이름·id · 계정 · 파일 경로
      · 섹션 id — `sec_<actorId>_xxxxx` 라 «설치 고정 식별자»(actorId)가 들어간다.
        순번(n)이면 현빈이 알아야 할 「몇 번째 섹션」이 되고, id 는 그가 열어볼 수도 없다.
        ⇒ 재현에 안 쓰이면서 식별자만 늘리므로 «뺀다».

   ★ReportBuffer.scrubPaths 만으로는 «부족하다»
      그 세척기는 `/Users/김민재/작업/여름세일_메인.png` 를 `~/…/여름세일_메인.png` 로 만든다 —
      «사용자 이름»은 지우지만 «파일 이름»은 남긴다. 상품명·클라이언트명이 파일명에 있다.
      ⇒ scrubErr() 로 한 겹 더 씻는다. 규약은 그대로다 — 씻는 자리는 여전히 «담을 때»다.
   ══════════════════════════════════════════════════════════════════════════ */

/** 한 판에 담을 최대 «실패 줄» 수. +요약 1줄. 링버퍼 20칸 중 6칸을 넘지 않는다. */
export const MAX_PER_RUN = 5;

/* ── ⑴ 무엇을 «실패»로 보는가 ────────────────────────────────────────────
   ★근거는 IMPL-export-report.md ① 에. 요약:
     fail     파일이 아예 안 나왔다(예외). 논쟁의 여지가 없다.
     mismatch 검사가 「다르다」고 봤다. a96c35a 실측 = 음성 82행 오탐 0 · 양성 M4 8/8,
              게다가 mismatch 경로만 재검사(truth 2회)를 거쳐 흔들리면 unmeasured 로 빠진다.
              ⇒ 표본이 느는 만큼의 잡음이 «측정된 0» 이라 넣는다.
     gateerr  검사기가 예외로 죽었다 = «우리 코드의 버그». 구조상 드물고 값어치가 크다.
     imgto    이미지 대기 8초 초과 — 그 파일은 이미지가 빠진 채 나갔을 수 있다.
     unstable 같은 입력에 truth 가 두 번 다르게 찍혔다 — 캡처 계층이 흔들린다는 신호.
   ⛔안 담는 것: same · minor(미세 픽셀차는 P0 가 «문제»라 말하지 않는 축이다) ·
     gif/gif-anim(팔레트 양자화라 애초에 이 판정기의 축이 아니다) ·
     notNative(웹 빌드엔 검사가 없다 — 「실패」가 아니라 「기능 없음」) ·
     noInk(잴 내용이 없다). 이것들은 «설계상 그런 것»이지 사례가 아니다. */
const BENIGN = new Set(['gif', 'notNative', 'noInk']);

/**
 * 순수 판정 — DOM·window 없음.
 * @param {{error?:any, gate?:{tier:string,reasons:string[]}|null}} o
 * @returns {{kind:string, why:string[]}|null}  null = 담지 않는다
 */
export function classifyExportOutcome(o) {
  const t = o || {};
  if (t.error) return { kind: 'fail', why: [] };
  const g = t.gate;
  if (!g || !g.tier) return null;              // 검사를 «안 건» 경로(returnDataUrl·웹 빌드)
  if (g.tier === 'same' || g.tier === 'minor') return null;
  const why = (g.reasons || []).slice(0, 4);
  if (g.tier === 'mismatch') return { kind: 'mismatch', why };
  if (g.tier !== 'unmeasured') return null;
  if (why.some(r => BENIGN.has(r))) return null;
  if (why.includes('imgTimeout')) return { kind: 'imgto', why };
  if (why.includes('unstable'))   return { kind: 'unstable', why };
  // captureError · noMetrics · «앞으로 생길 모르는 사유» — 조용히 버리지 않는다.
  // 모르는 사유는 why 에 코드 그대로 실려 나가므로 현빈이 「이건 뭐지」를 볼 수 있다.
  return { kind: 'gateerr', why };
}

/* ── ⑵ 한 겹 더 씻기 ──────────────────────────────────────────────────────
   ⚠️여기 「①~④ 는 순서가 중요하다」고 적혀 있었는데 **거짓이었다**(적대검수 X4·X5 실측).
     ①↔② 도 ③↔④ 도 뒤집어 보면 결과가 «같다» — scrubPaths 가 URL 을 «건드리지 않기» 때문이다
     (그 ③ 규칙이 앞 글자 '/'·':' 를 보고 비껴간다). https://host/Users/x/y.png 도 같았다.
   ★순서가 결과를 바꾸는 곳은 fmtError 의 ⑤(«씻은 뒤» 자르기) «하나»고 거기만 핀이 있다(M11/S8).
     안 그런 것을 「순서 의존」이라 적어 두면 다음 사람이 못 건드릴 것을 못 건드린다고 읽는다. */
const SRC_FILE = /\.(m?js|cjs|html|json)(:\d+)?(:\d+)?$/i;
const MEDIA    = /[^\s'"()/\\]+\.(png|jpe?g|gif|webp|svg|bmp|avif|heic|tiff?|mp4|webm|mov|psd|ai|pdf|zip|ttf|otf|woff2?)\b/gi;

/** @param {string} s @param {(x:string)=>string} [scrubPaths] ReportBuffer.scrubPaths (없으면 건너뜀) */
export function scrubErr(s, scrubPaths) {
  let out = String(s == null ? '' : s);
  // ① URL·데이터 URI → «스킴만». 어디서 왔는지(로컬/원격/에셋)는 남고 «무엇인지»는 지운다.
  out = out.replace(/\bdata:[^\s'"()]*/gi, 'data:…');
  out = out.replace(/\bblob:[^\s'"()]*/gi, 'blob:…');
  out = out.replace(/\bgoya-asset:\/\/[^\s'"()]*/gi, 'goya-asset:…');
  out = out.replace(/\bhttps?:\/\/[^\s'"()]*/gi, 'http:…');
  /* ★file:// 는 «스킴만 벗긴다» — 통째로 뭉개면 안 된다.
     [실측 2026-09-05] 렌더러/ESM 스택 프레임이 바로 file:// URL 이다:
       `at Module.boom (file:///Users/kim%20minjae/%EC%9E%91%EC%97%85/boom.mjs:1:31)`
     통째로 'file:…' 로 바꾸면 «우리 소스 파일명·줄번호»가 같이 죽어 재현이 불가능해진다.
     ⇒ 스킴만 떼고 아래 경로 세척(②③)에 넘긴다 — 거기서 사람 이름·폴더는 지우고
       .js/.mjs 만 남긴다. report-buffer.js 의 scrubPaths 도 «같은 이유»로 같은 첫 줄을 쓴다.
     ⚠️퍼센트 인코딩(%20·%EC%97%AC…)이라 «공백/한글로는 안 보인다» — 그래도 구분자는
       여전히 '/' 라 경로 규칙이 그대로 닿는다(위 실측 스택으로 확인). */
  out = out.replace(/\bfile:\/\/\/?/gi, '/');
  // ② 링버퍼의 세척기(홈 경로 → ~, 절대경로 → …/파일명). 정본은 그쪽이다 — 여기서 베끼지 않는다.
  if (typeof scrubPaths === 'function') { try { out = scrubPaths(out); } catch (_) {} }
  // ③ ②가 남긴 파일명 — «우리 소스»(.js:줄)만 살린다. 스택 프레임이 재현의 핵심이라서다.
  out = out.replace(/(~\/…\/|…\/)([^\s'"()\]]+)/g, (m, p, base) => (SRC_FILE.test(base) ? p + base : p + '«f»'));
  // ④ 경로에 안 붙은 맨 파일명(「메인배너.png 로드 실패」 꼴)
  out = out.replace(MEDIA, '«f»');
  return out;
}

/** Error → 한 줄. 스택은 «앞 4프레임»까지 — 링버퍼 MAX_LEN 1000자 안에서 그게 한계다.
 *  ★4로 잡은 이유: 아래 export-image.js 의 중복 console.error 를 걷어냈으므로(warn 강등)
 *    이제 이 «한 줄»이 스택을 가진 유일한 기록이다. 실측 표본에서 4프레임이면
 *    materializeAllSections → _exportSectionInner → exportSection → exportAllSections 가 다 들어온다. */
/* ★던져지는 게 «항상 Error 는 아니다» — 실기 실측(2026-09-05, 9391)
     · canvas.toBlob 실패 → **DOMException** : name·message 는 있는데 **stack 이 없다**
     · 이미지 onerror → rej(ev) → **Event** : stack 도 message 도 없고 String(e) = **`[object Event]`**
       (captureCloneToCanvas 의 `ci.onerror = rej` 가 바로 이 자리다 — 실재하는 실패 경로다)
   그냥 두면 기록이 `err=Error: [object Event]` 가 된다. **한 줄을 남겨 놓고 아무 말도 안 하는 것**이라
   재현이 0 이다. ⇒ Error 가 아닌 것에서도 «말할 수 있는 것»을 꺼낸다.
   ⛔단 target 의 src 는 «스킴만» — 거기 고객 이미지 URL 이 들어 있다. */
function _nonErrorInfo(err) {
  try {
    if (typeof Event !== 'undefined' && err instanceof Event) {
      const t = err.target || {};
      const tag = t.tagName ? String(t.tagName).toLowerCase() : '?';
      let scheme = '';
      const raw = String(t.currentSrc || t.src || '');
      /* ★스킴이 «있을 때만» 스킴을 쓴다. 그냥 split(':')[0] 하면 스킴 없는 상대경로에서
         파일명 전체가 «스킴 자리»에 들어가고, 하류 세척이 그걸 지워 `src=«f»:` 라는
         뜻 없는 글자가 남는다(2026-09-05 실측). 유출은 아니지만 «읽을 수 없는 기록»이다.
         ⛔여기서 스킴만 뽑는 것은 «다중 방어»다 — 유일한 방벽이 아니다(scrubErr 이 URL 을 또 덮는다). */
      const m = raw.match(/^([a-z][a-z0-9+.\-]{0,11}):/i);
      if (m) scheme = m[1] + ':';
      else if (raw) scheme = 'rel';                                     // 상대경로·파일명 — «있었다»는 것만
      const nat = (typeof t.naturalWidth === 'number') ? (' nat=' + t.naturalWidth + 'x' + t.naturalHeight) : '';
      return 'Event(' + (err.type || '?') + ') on ' + tag + (scheme ? ' src=' + scheme : '') + nat;
    }
  } catch (_) {}
  return null;
}

/* ★스택에서 «몇 프레임»을 남길 것인가 — 세지 말고 «불변 꼬리»를 버린다.
 *
 * [실측 2026-09-05, 실기 9391 스택 3종]  정보 프레임 수 = S-A 2 · S-B 2 · S-C 3
 *   N=2 : 97~104자   S-C 를 «놓친다»(renderComponentsInClone:317 이 잘려 어디서 깨졌는지 사라짐)
 *   N=3 : 148~150자  표본 3종을 «전부» 덮는다   ← 측정된 최소
 *   N=4 : 178~200자  덮는 것이 «더 없다» (+43자)
 *   N=5 : 178~234자  〃
 *   ⇒ 전체 줄 최대 403자(N=4)로 링버퍼 상한 1000자에 한참 못 미친다 — 길이는 «제약이 아니다».
 *
 * ⇒ 그래서 고정 N 을 버렸다. 어느 실패든 «똑같이» 나오는 꼬리(exportSection 래퍼 → exportAllSections
 *   루프)는 정보량이 0 이고, 그 «앞»이 전부 정보다. 깊이는 실패마다 다르다(2~3, 그리고 GIF·cvb
 *   경로는 더 깊을 것이다 — 미표집).  ⇒ 꼬리를 만나면 멈춘다. 상한은 폭주 방지용이다.
 *   ★이러면 얕은 실패는 «더 짧아지고»(178→104자) 깊은 실패는 «안 잘린다». */
const FRAME_TAIL = /\bat (?:async )?(?:exportSection|exportAllSections)\b/;
const FRAME_MAX  = 6;

export function pickFrames(stack) {
  const lines = String(stack || '').split('\n').slice(1);
  const out = [];
  for (const f of lines) {
    if (FRAME_TAIL.test(f)) break;
    out.push(f.trim());
    if (out.length >= FRAME_MAX) break;
  }
  // ★꼬리가 «첫 줄»이면(래퍼 자신이 던진 경우) 0개가 된다 — 그럴 땐 한 줄은 남긴다.
  if (!out.length && lines.length) out.push(lines[0].trim());
  return out;
}

export function fmtError(err, scrubPaths) {
  if (!err) return '';
  const name = (err && err.name) || 'Error';
  let msg = String((err && err.message) || '');
  if (!msg) msg = _nonErrorInfo(err) || String(err);
  let frames = '';
  const st = err && err.stack;
  if (typeof st === 'string') frames = pickFrames(st).join(' | ');
  /* ★자르는 건 «씻은 뒤»다 (2026-09-05 실기에서 잡은 결함).
     씻기 전에 320자로 자르니 4번째 프레임이 `…/export-im` 처럼 «파일명 한가운데»에서 끊겼고,
     그러면 ③ 규칙이 확장자를 못 봐 우리 소스 프레임까지 «f» 로 지워 버렸다
     — 재현에 제일 필요한 줄이 «개인정보 세척»에 잘못 걸린 꼴이다.
     씻고 나면 경로가 `…/` 로 줄어 대개 자를 일도 없다. 그래도 넘치면 «프레임 경계»에서 끊는다. */
  const outMsg = scrubErr(name + ': ' + msg, scrubPaths).slice(0, 200);
  let outFr = frames ? scrubErr(frames, scrubPaths) : '';
  if (outFr.length > 320) {
    const cut = outFr.lastIndexOf(' | ', 320);
    outFr = (cut > 0 ? outFr.slice(0, cut) : outFr.slice(0, 320)) + ' …';
  }
  /* ★스택이 «없다»는 것도 정보다 — 「기록이 잘렸나」와 「원래 없나」를 가른다.
     실측상 DOMException·Event 계열이 여기 온다. */
  return outMsg + (outFr ? ' @ ' + outFr : ' @nostack');
}

/* ── ⑶ 한 줄 만들기 ─────────────────────────────────────────────────────
   key=value 로 «짧게». 링버퍼 MAX_LEN 은 1000자고, 넘으면 조용히 잘린다 —
   잘리면 제일 뒤에 있는 err= 가 먼저 죽으므로 수치를 앞에, 예외를 뒤에 둔다.
   @param {object} f  이미 «추출된 원시값»만 받는다(DOM 안 봄) — 그래야 단위테스트가 된다 */
export function buildFailureLine(f) {
  const p = [];
  const put = (k, v) => { if (v !== null && v !== undefined && v !== '') p.push(k + '=' + v); };
  put('k', f.kind);
  /* ★순번을 «못 쟀으면» 0 이 아니라 `?` 다. 순번은 1부터라 0 은 불가능한 값이지만,
     읽는 쪽(settings-admin renderDetail)은 이 줄을 «문자 그대로» <pre> 에 붓는다 — 파싱이 없다.
     「0 = 못 쟀다」를 사람이 문서에서 기억해야 하는 규약은 규약이 아니다(적대검수 B6). */
  put('n', (f.idx > 0 ? f.idx : '?') + '/' + (f.total > 0 ? f.total : '?'));
  put('fmt', f.format);
  put('w', f.width);
  put('h', f.secH);                                 // 캔버스 쪽 섹션 높이(CSS px)
  if (f.expSize && f.truthSize) put('sz', f.expSize.join('x') + '>' + f.truthSize.join('x'));
  put('blk', f.blocks);                             // 블록 «타입 구성» — 개수만
  put('img', f.imgs);
  put('ms', f.ms);
  put('gms', f.gateMs);
  put('total', f.total_);
  put('cell', f.maxCell);
  put('blob', f.blobPx);
  put('band', f.bandCount == null ? null : f.bandCount + '/' + f.truthBandCount);
  put('repro', f.reproDiff);
  if (f.why && f.why.length) put('why', f.why.join(','));
  if (f.err) put('err', f.err);
  return '[export-fail] ' + p.join(' ');
}

/** 요약 한 줄 — «한 판»의 모양. 생략된 건수를 여기서 숫자로 말한다. */
export function buildRunLine(r) {
  const kinds = Object.keys(r.kinds || {}).sort().map(k => k + '=' + r.kinds[k]).join(',');
  /* ★`ran=` 이지 `sec=` 이 아니다 — 이 판이 «몇 개를 돌렸나»다.
     실패 줄의 `n=2/3` 은 «문서 안에서 몇 번째 섹션인가»라 분모가 다르다
     (단일 섹션 내보내기는 ran=1 인데 n=2/3 이 정상이다). 같은 이름을 쓰면 현빈이 둘을 대조하다 헷갈린다. */
  const p = ['run', 'fmt=' + r.format, 'w=' + r.width, 'ran=' + r.total,
             'bad=' + r.bad, kinds ? 'kind=' + kinds : ''];
  if (r.skipped > 0) p.push('omitted=' + r.skipped);   // 링버퍼 보호로 «안 담은» 줄 수
  return '[export-fail] ' + p.filter(Boolean).join(' ');
}

/* ── ⑷ 섹션의 «모양» — 내용은 안 보고 «구성»만 센다 ─────────────────────
   블록 타입별 개수 + 이미지 개수. 현빈이 재현할 때 「무슨 블록이 몇 개 있는 섹션」이
   유일하게 쓸 수 있는 단서다(이름도 글자도 못 주니까). */
export function sectionShape(sec) {
  const out = { blocks: '', imgs: 0, secH: 0 };
  if (!sec || !sec.querySelectorAll) return out;
  try {
    const cnt = Object.create(null);
    sec.querySelectorAll('[class]').forEach(el => {
      const list = el.classList;
      for (let i = 0; i < list.length; i++) {
        const c = list[i];
        if (c === 'section-block' || !/^[a-z0-9]+-block$/.test(c)) continue;
        const k = c.slice(0, -6);                   // '-block' 떼기
        cnt[k] = (cnt[k] || 0) + 1;
      }
    });
    out.blocks = Object.keys(cnt).sort((a, b) => cnt[b] - cnt[a] || (a < b ? -1 : 1))
      .slice(0, 8).map(k => k + ':' + cnt[k]).join(',');
    out.imgs = sec.querySelectorAll('img[src]').length;
    out.secH = Math.round(sec.offsetHeight || 0);
  } catch (_) { /* 모양을 못 재도 실패 기록 자체는 남아야 한다 */ }
  return out;
}

/* ── ⑸ 한 «판»(run) ──────────────────────────────────────────────────────
   전체 내보내기는 exportAllSections 가 판을 열고 닫는다. 단일 섹션 내보내기는
   판이 «없을 때» 스스로 1칸짜리 판을 열고 닫는다 ⇒ 배선이 한 곳으로 모인다. */
let _run = null;

export function beginRun(total, format, width) {
  _run = { total: total || 0, format: format || '', width: width || 0,
           bad: 0, noted: 0, skipped: 0, kinds: Object.create(null) };
  return _run;
}
export function isRunOpen() { return !!_run; }

export function endRun() {
  const r = _run;
  _run = null;
  if (!r || r.bad === 0) return null;              // 실패가 0이면 «아무것도 안 남긴다»
  const line = buildRunLine(r);
  _note(line);
  return line;
}

function _note(msg) {
  try { (typeof window !== 'undefined' ? window : {}).ReportBuffer?.note?.(msg); } catch (_) {}
}

/**
 * 실패 한 건 기록. 담을 게 아니면 조용히 null.
 * @param {Element} sec  라이브 섹션(«모양»만 읽는다)
 * @param {object} o { format, width, idx, total, ms, error, gate }
 */
export function noteExportOutcome(sec, o) {
  const v = classifyExportOutcome(o);
  if (!v) return null;
  if (!_run) beginRun(o.total || 1, o.format, o.width);   // 판 없이 부르면 1칸짜리 판
  _run.bad++;
  _run.kinds[v.kind] = (_run.kinds[v.kind] || 0) + 1;
  if (_run.noted >= MAX_PER_RUN) { _run.skipped++; return null; }
  _run.noted++;

  const g = o.gate || {};
  const m = g.metrics || null;
  const sh = sectionShape(sec);
  const scrub = (typeof window !== 'undefined' && window.ReportBuffer && window.ReportBuffer.scrubPaths) || null;
  const line = buildFailureLine({
    kind: v.kind, why: v.why,
    idx: o.idx || 0, total: o.total || (_run ? _run.total : 0),
    format: o.format, width: o.width,
    secH: sh.secH, blocks: sh.blocks, imgs: sh.imgs,
    ms: o.ms == null ? null : Math.round(o.ms),
    gateMs: g.ms == null ? null : Math.round(g.ms),
    expSize: m && m.sizeMismatch ? m.expSize : null,
    truthSize: m && m.sizeMismatch ? m.truthSize : null,
    total_: m ? m.total : null,
    maxCell: m ? m.maxCell : null,
    blobPx: m ? m.blobPx : null,
    // ★크기 불일치면 bandCount 는 -1 «센티널»이다(구조 층을 못 잰다는 뜻) — 숫자로 실으면
    //   「밴드가 -1개」로 읽힌다. 못 잰 값은 아예 «안 싣는다»(sz= 가 이미 사유를 말한다).
    bandCount: m && m.bandCount >= 0 ? m.bandCount : null,
    truthBandCount: m && m.bandCount >= 0 ? m.truthBandCount : null,
    reproDiff: m && m.reproDiff !== undefined ? m.reproDiff : null,
    /* ★예외는 «두 곳»에서 온다 — 내보내기가 던진 것(o.error)과 게이트가 «삼킨» 것(gate.error).
       gateerr 갈래는 후자뿐이라 이걸 안 실으면 `why=captureError` 한 마디만 남는다(적대검수 B1). */
    err: fmtError(o.error || g.error || null, scrub) || null,
  });
  _note(line);
  return line;
}

/* QA·검증 창구(사용자 화면엔 안 보인다). ★양성대조를 «앱 안에서» 재는 자리. */
if (typeof window !== 'undefined') {
  window.__exportReport = { classifyExportOutcome, scrubErr, fmtError, buildFailureLine,
                            buildRunLine, sectionShape, beginRun, endRun, noteExportOutcome,
                            isRunOpen, MAX_PER_RUN };
}
