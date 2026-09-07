/* ═══════════════════════════════════════════════════════════════════════════
   judge/lost-window.mjs — «손실 창»: 죽는 순간 몇 초분의 편집이 사라졌나.
   ───────────────────────────────────────────────────────────────────────────
   ★「데이터가 안 깨졌다」(I7)와 「데이터를 안 잃었다」는 «다른 것»이다.
     원자쓰기는 앞엣것만 보장한다. 뒤엣것은 «마지막 저장 이후 시간»이고, 그건 재야 안다.
   ★재는 법: 편집마다 캔버스에 «마커»를 박고 시각을 장부에 적는다. 죽인 뒤 디스크의
     proj.json 에서 «가장 큰 마커»를 찾는다. 손실 창 = 죽인 시각 − 그 마커를 박은 시각.
   ⚠️마커는 직렬화 세척(js/io/section-serialize.js)에 «안 지워지는» 모양이어야 한다.
     그래서 NON_CONTENT_UI_SELECTOR·상태클래스에 걸리지 않는 평범한 div 를 쓴다.
   ⚠️39MB 를 JSON.parse 하지 않는다 — 마커는 문자열이므로 스트림으로 훑는다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { evalJs } from '../lib/cdp.mjs';
import { openSource } from '../lib/loadcheck.mjs';
import { HarnessError } from '../lib/deadline.mjs';

export const MARKER = n => `H7-EDIT-${n}`;
const MARKER_RE = /H7-EDIT-(\d+)/g;

/** 편집 장부. 시각은 «벽시계»(디스크 mtime 과 같은 축이라야 뺄 수 있다). */
export function newLedger() { return { edits: [], startedAt: Date.now() }; }

/**
 * 진짜 편집 한 번 — 캔버스에 마커를 박고 앱의 자동저장 경로를 «그대로» 깨운다.
 * ⛔여기서 저장 완료를 «기다리지 않는다». 기다리면 손실 창이 인위적으로 0 이 된다.
 */
export async function makeEdit(conn, ledger, { trigger = true } = {}) {
  const n = ledger.edits.length + 1;
  const m = MARKER(n);
  const applied = await evalJs(conn, `(function(){
    var c = document.getElementById('canvas');
    if (!c) return 'no-canvas';
    var d = document.createElement('div');
    d.className = 'h7-edit-marker';
    d.setAttribute('data-h7-edit', '${n}');
    d.textContent = '${m}';
    (c.querySelector('.section-block') || c).appendChild(d);
    ${trigger ? 'if (typeof window.triggerAutoSave === "function") window.triggerAutoSave();' : ''}
    return 'ok';
  })()`);
  if (applied !== 'ok') throw new HarnessError(`편집 주입 실패: ${applied} — 캔버스가 없다면 프로젝트가 안 열린 것`);
  ledger.edits.push({ n, marker: m, at: Date.now() });
  return ledger.edits[ledger.edits.length - 1];
}

/** 디스크 파일에서 «가장 큰» 마커 번호. 없으면 0. 대용량 안전(스트림). */
export function diskMaxMarker(file) {
  let fd; try { fd = fs.openSync(file, 'r'); } catch (_) { return { max: 0, exists: false }; }
  try {
    const size = fs.fstatSync(fd).size;
    const CH = 4 * 1024 * 1024, OVERLAP = 64;
    const buf = Buffer.alloc(Math.min(CH, size) + OVERLAP);
    let pos = 0, max = 0, count = 0;
    while (pos < size) {
      const n = fs.readSync(fd, buf, 0, Math.min(buf.length, size - pos), pos);
      if (n <= 0) break;
      const s = buf.toString('utf8', 0, n);
      MARKER_RE.lastIndex = 0;
      for (const m of s.matchAll(MARKER_RE)) { count++; const v = Number(m[1]); if (v > max) max = v; }
      pos += Math.max(1, n - OVERLAP);
    }
    return { max, count, exists: true, bytes: size };
  } finally { fs.closeSync(fd); }
}

/**
 * @param killAt  죽인(또는 사고가 난) 벽시계 시각
 * 손실 창 = killAt − «디스크에 도달한 마지막 편집»의 시각.
 */
export function judgeLostWindow(ledger, projFile, killAt, { budgetMs = null } = {}) {
  const d = diskMaxMarker(projFile);
  const total = ledger.edits.length;
  const landed = d.max;
  const lastLanded = ledger.edits.find(e => e.n === landed) || null;
  const lost = Math.max(0, total - landed);
  /* ★두 숫자를 «가른다» — 초판은 하나로 섞어 「유실 0건인데 손실 창 1.94s」라는
     읽는 사람을 혼란시키는 문장을 냈다(자체 실기에서 실제로 나왔다).
       lossWindowMs — «잃은» 시간. 유실이 0 이면 정의상 0 이다.
       diskLagMs    — 디스크 사본이 «얼마나 뒤처져 있었나». 유실이 0 이어도 0 이 아니다.
                      (다음 편집이 있었다면 그만큼이 날아갔을 «위험 폭»이다) */
  const diskLagMs = lastLanded ? (killAt - lastLanded.at) : (total ? killAt - ledger.edits[0].at : 0);
  const lossWindowMs = lost > 0 ? diskLagMs : 0;
  const res = {
    judge: 'LOSTWINDOW', projFile, diskExists: d.exists, diskBytes: d.bytes,
    editsMade: total, editsLanded: landed, editsLost: lost,
    lastLandedAt: lastLanded ? lastLanded.at : null, killAt,
    lossWindowMs, lossWindowSec: +(lossWindowMs / 1000).toFixed(2),
    diskLagMs, diskLagSec: +(diskLagMs / 1000).toFixed(2),
    budgetMs, measured: 'rendered',   // 「쟀다」 — 추정 아님
  };
  if (total === 0) {
    res.verdict = 'NOT_MEASURED'; res.pass = null;
    res.notMeasured = '편집을 «한 번도» 안 했다 — 손실 창을 잴 재료가 없다';
  } else if (!d.exists) {
    res.verdict = 'FAIL'; res.pass = false;   // 파일 자체가 사라졌다 = 전부 유실
  } else if (budgetMs == null) {
    res.verdict = 'MEASURED'; res.pass = lost === 0 ? true : null;
  } else {
    res.verdict = lossWindowMs <= budgetMs ? 'PASS' : 'FAIL';
    res.pass = lossWindowMs <= budgetMs;
  }
  res.summary = `LOSTWINDOW ${res.verdict} — 편집 ${total}건 중 디스크 도달 ${landed}건 · 유실 ${lost}건 · ` +
    `손실 창 ${res.lossWindowSec}s · 디스크 지연 ${res.diskLagSec}s` +
    (budgetMs != null ? ` (예산 ${budgetMs}ms)` : '');
  return res;
}

/* ── ★«빈 캔버스 보호 스킵»을 «저장 실패»로 오인하지 않기 위한 자 ─────────────
   H4 의 양성대조가 정확히 이걸 요구한다(골 C4: 「빈 캔버스 skip 은 다이얼로그 안 뜬다」).
   판정 기준을 하네스가 «자기 말»로 다시 쓰면 제품이 바뀔 때 조용히 갈라지므로,
   제품 소스(js/io/save-load.js)의 _isAllCanvasEmpty 를 «원문 그대로» 잘라 돌린다.
   ⛔잘라 쓰면 «부르는 선언을 다 실었는지» 기계로 세야 한다 → loadcheck(U-GLOGIN-0 본보기).
   ────────────────────────────────────────────────────────────────────────── */
export const EMPTY_HEAD = 'function _isAllCanvasEmpty(data) {';

export function loadIsAllCanvasEmpty(checkoutDir) {
  const S = openSource(path.join(checkoutDir, 'js/io/save-load.js'));
  const body = S.slice(EMPTY_HEAD);
  const provided = ['_isAllCanvasEmpty', 'Array', 'isArray', 'String', 'Number', 'Boolean', 'JSON', 'Object'];
  const missing = S.missing(body, provided);
  if (missing.length) {
    throw new HarnessError(
      `★하네스가 «안 실은» 선언: ${missing.join(', ')} — 이대로 돌리면 «무한 대기»나 오판이 난다`,
      { missing, head: EMPTY_HEAD });
  }
  const fn = new Function(`${body}\nreturn _isAllCanvasEmpty;`)();
  return { fn, missing, body };
}

export function judgeEmptyCanvasSkip(checkoutDir, projObj) {
  const { fn } = loadIsAllCanvasEmpty(checkoutDir);
  const empty = !!fn(projObj);
  return { judge: 'EMPTYSKIP', empty, source: 'product:js/io/save-load.js#_isAllCanvasEmpty',
    summary: `EMPTYSKIP — 이 스냅샷은 ${empty ? '«빈 캔버스»(저장이 정당하게 건너뛰어진다)' : '내용이 있다(스킵 대상 아님)'}` };
}
