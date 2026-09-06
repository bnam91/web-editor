/* ═══════════════════════════════════════════════════════════════════════════
   break/corrupt.mjs — 프로젝트 파일을 «망가뜨린다».
   ───────────────────────────────────────────────────────────────────────────
   대상: proj.json · proj_backup.json · proj_history/*.json
   모드:
     half    proj.json «만» 반쪽 → 기존 폴백 체인이 살아나야 한다(양성대조 쪽)
     all     셋 «전부» 반쪽 → 폴백이 죽고 빈 캔버스로 조용히 열린다(A1-2 · H5 의 표적)
     sidecar history 에 «프로젝트 모양이 아닌» 사이드카만 남긴다(A2 치명 재발 감시)
     zero    proj.json 을 0바이트로(전원 차단 흉내 — A3-2)
   ⛔되돌리기 함수를 «두지 않는다». 원본을 망가뜨렸다 되돌리는 방식은 중간에 죽으면
     망가진 채로 남는다(2026-09-06 실제). 리셋은 «사본을 새로 뜨는 것» 뿐이다.
   ★sanity: 「정말 때렸나」를 바이트 전/후로 증명해 결과에 싣는다(하네스가 헛돌면 가짜 초록).
═══════════════════════════════════════════════════════════════════════════ */
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { assertWritableTarget } from '../lib/fixture.mjs';
import { HarnessError } from '../lib/deadline.mjs';

const sha8 = f => { try { return crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex').slice(0, 8); } catch (_) { return null; } };
const size = f => { try { return fs.statSync(f).size; } catch (_) { return -1; } };

function truncateHalf(f) {
  const before = { bytes: size(f), sha8: sha8(f) };
  if (before.bytes <= 2) throw new HarnessError(`반쪽으로 자를 게 없다: ${f} (${before.bytes}B)`);
  const fd = fs.openSync(f, 'r+');
  try { fs.ftruncateSync(fd, Math.floor(before.bytes / 2)); } finally { fs.closeSync(fd); }
  return { file: f, before, after: { bytes: size(f), sha8: sha8(f) } };
}

export function corrupt(projDir, mode = 'all') {
  const dir = assertWritableTarget(projDir);
  const proj = path.join(dir, 'proj.json');
  const backup = path.join(dir, 'proj_backup.json');
  const histDir = path.join(dir, 'proj_history');
  const hits = [];
  const res = { breaker: 'corrupt', mode, projDir: dir, hits, sanity: null };

  if (mode === 'zero') {
    const before = { bytes: size(proj), sha8: sha8(proj) };
    fs.writeFileSync(proj, '');
    hits.push({ file: proj, before, after: { bytes: size(proj), sha8: sha8(proj) } });
  } else if (mode === 'half') {
    hits.push(truncateHalf(proj));
  } else if (mode === 'all') {
    hits.push(truncateHalf(proj));
    if (fs.existsSync(backup)) hits.push(truncateHalf(backup));
    if (fs.existsSync(histDir)) {
      for (const n of fs.readdirSync(histDir)) {
        if (!n.endsWith('.json')) continue;
        try { hits.push(truncateHalf(path.join(histDir, n))); } catch (_) {}
      }
    }
    // pre-externalize 후보(폴백 체인 맨 끝)도 있으면 같이 — 「전부」라고 말하려면 전부여야 한다
    for (const n of fs.readdirSync(dir)) {
      if (/pre-?externalize/i.test(n) && n.endsWith('.json')) {
        try { hits.push(truncateHalf(path.join(dir, n))); } catch (_) {}
      }
    }
  } else if (mode === 'sidecar') {
    // history 를 «프로젝트 모양이 아닌» 것만 남긴다 — A2 치명(사이드카가 프로젝트로 채택)의 재발 감시
    fs.mkdirSync(histDir, { recursive: true });
    for (const n of fs.readdirSync(histDir)) fs.rmSync(path.join(histDir, n), { force: true, recursive: true });
    const side = path.join(histDir, 'pins.json');
    fs.writeFileSync(side, JSON.stringify({ pins: [], note: 'h7 sidecar (not a project)' }, null, 2));
    hits.push(truncateHalf(proj));
    if (fs.existsSync(backup)) hits.push(truncateHalf(backup));
    res.sidecar = side;
  } else {
    throw new HarnessError(`알 수 없는 corrupt 모드: ${mode}`);
  }

  // ★sanity — «대상 경로를 실제로 때렸다»는 증거(harness.md §2). 미달이면 HARNESS_ERROR.
  const changed = hits.filter(h => h.before.sha8 !== h.after.sha8);
  if (!hits.length || changed.length !== hits.length) {
    throw new HarnessError(`corrupt sanity 미달 — 때린 파일 ${hits.length}개 중 실제로 바뀐 건 ${changed.length}개`,
      { hits });
  }
  res.sanity = `때린 파일 ${hits.length}개, 전부 sha 변화 확인`;
  res.summary = `corrupt(${mode}) — ${hits.map(h => `${path.basename(h.file)} ${h.before.bytes}→${h.after.bytes}B`).join(' · ')}`;
  return res;
}

/** 「파일이 안 바뀌었다」를 증명하는 자 — C5 의 «sha 전후 동일». */
export function snapshotDir(dir) {
  const out = {};
  const walk = d => {
    let ents; try { ents = fs.readdirSync(d, { withFileTypes: true }); } catch (_) { return; }
    for (const e of ents) {
      const p = path.join(d, e.name);
      if (e.isDirectory()) walk(p); else out[p] = { bytes: size(p), sha8: sha8(p) };
    }
  };
  walk(dir);
  return out;
}

export function diffSnapshots(before, after) {
  const changed = [], added = [], removed = [];
  for (const k of Object.keys(before)) {
    if (!(k in after)) removed.push(k);
    else if (before[k].sha8 !== after[k].sha8) changed.push({ file: k, before: before[k], after: after[k] });
  }
  for (const k of Object.keys(after)) if (!(k in before)) added.push(k);
  return { changed, added, removed, identical: !changed.length && !added.length && !removed.length };
}
