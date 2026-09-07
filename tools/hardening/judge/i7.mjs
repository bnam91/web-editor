/* ═══════════════════════════════════════════════════════════════════════════
   judge/i7.mjs — 불변식 I7: «디스크에 남은 프로젝트 JSON 은 전부 유효하다».
   ───────────────────────────────────────────────────────────────────────────
   ★kill -9 를 저장 «도중»에 맞아도 원자쓰기(tmp→rename, main.js:912)가 성립하면
     proj.json 은 «옛 것이거나 새 것»이지 «반쪽»이 아니다. 그걸 재는 자다.
   ★판정 기준을 제품에서 가져온다 — isProjectShaped 를 «제품 모듈에서 require» 한다.
     하네스가 자기 기준을 따로 들면 제품이 바뀔 때 조용히 갈라진다.
   ⚠️ *.tmp 는 «반쪽이어도 정상»이다(rename 전에 죽은 흔적). 대신 «잔재»로 따로 센다
     — A3-8(ENOSPC 때 proj.json.tmp 잔재)이 그 자리다.
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';

function walk(dir, out = []) {
  let ents; try { ents = fs.readdirSync(dir, { withFileTypes: true }); } catch (e) { return out; }
  for (const e of ents) {
    const p = path.join(dir, e.name);
    if (e.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

/**
 * @param projectsDir  «내» ud 의 projects 폴더
 * @param checkoutDir  isProjectShaped 를 가져올 체크아웃(제품 기준을 쓰기 위해)
 */
export function judgeI7(projectsDir, { checkoutDir = null, requireShaped = true, denied = [] } = {}) {
  let isProjectShaped = null, shapedSource = 'none';
  if (checkoutDir) {
    try {
      const req = createRequire(path.join(checkoutDir, 'package.json'));
      isProjectShaped = req('./main/project-store/snapshot-store').isProjectShaped;
      shapedSource = 'product:snapshot-store';
    } catch (e) { shapedSource = `unavailable(${e.message})`; }
  }
  const res = {
    judge: 'I7', projectsDir, shapedSource,
    scanned: 0, valid: 0, invalid: [], tmpResidue: [], notShaped: [], zeroByte: [],
    notMeasured: null,
  };

  /* ★★「못 쟀다」를 「깨끗하다」로 읽지 마라 — 자체 실기에서 실제로 나를 잡은 자리다.
     deny-write 시나리오는 projects 폴더를 chmod 000 한다. 그 상태에서 초판은
     «스캔 0 · 깨짐 0 → I7 PASS» 를 냈다. 아무것도 «못 열어본» 실행이 초록이었다.
     ⇒ ⑴호출자가 막은 경로를 «선언»하면 겹치는 순간 NOT_MEASURED.
       ⑵선언이 없어도 «읽어 보고» EACCES 면 NOT_MEASURED.
       ⑶폴더는 읽히는데 «파일이 0개»면 그것도 판정이 아니다(잴 게 없다). */
  const deniedHit = denied.map(d => path.resolve(d))
    .find(d => projectsDir.startsWith(d) || d.startsWith(path.resolve(projectsDir)));
  let readErr = null;
  try { fs.readdirSync(projectsDir); } catch (e) { readErr = e.code; }
  if (deniedHit || readErr) {
    res.notMeasured = `projects 폴더를 못 읽는다(${deniedHit ? '선언된 deny: ' + deniedHit : readErr}) — ` +
      'JSON 유효성을 판정할 수 없다';
    res.verdict = 'NOT_MEASURED'; res.pass = null;
    res.summary = `I7 NOT_MEASURED — ${res.notMeasured}`;
    return res;
  }

  const files = walk(projectsDir);
  for (const f of files) {
    const base = path.basename(f);
    if (base.endsWith('.tmp')) { res.tmpResidue.push({ file: f, bytes: safeSize(f) }); continue; }
    if (!base.endsWith('.json')) continue;
    res.scanned++;
    const sz = safeSize(f);
    if (sz === 0) { res.zeroByte.push(f); res.invalid.push({ file: f, reason: 'zero-byte' }); continue; }
    let obj;
    try { obj = JSON.parse(fs.readFileSync(f, 'utf8')); }
    catch (e) { res.invalid.push({ file: f, bytes: sz, reason: e.message.slice(0, 120) }); continue; }
    res.valid++;
    // proj.json / proj_backup.json 은 «프로젝트 모양»이어야 한다(A2 치명: 사이드카가 채택된 사고).
    if (requireShaped && isProjectShaped && /^proj(_backup)?\.json$/.test(base) && !isProjectShaped(obj)) {
      res.notShaped.push(f);
    }
  }
  if (res.scanned === 0) {
    res.notMeasured = '검사할 JSON 이 «한 개도 없다» — 유효성을 말할 대상이 없다';
    res.verdict = 'NOT_MEASURED'; res.pass = null;
  } else {
    res.pass = res.invalid.length === 0 && res.notShaped.length === 0;
    res.verdict = res.pass ? 'PASS' : 'FAIL';
  }
  res.summary = `I7 ${res.verdict} — 스캔 ${res.scanned} · 유효 ${res.valid} · ` +
    `깨짐 ${res.invalid.length} · 모양아님 ${res.notShaped.length} · tmp잔재 ${res.tmpResidue.length}` +
    (res.notMeasured ? ` · ⚠️${res.notMeasured}` : '');
  return res;
}

function safeSize(f) { try { return fs.statSync(f).size; } catch (_) { return -1; } }
