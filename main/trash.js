/* main/trash.js — 프로젝트 «앱 안 휴지통» (2026-09-08, 현빈 지시)
 *
 * ★왜 OS 휴지통이 아니라 «우리 휴지통»인가
 *   OS 휴지통으로 보내면 되살릴 때 «파일이 우리 영역 밖»으로 나갔다 돌아온다.
 *   그러면 id 를 그대로 쓸 수 있다는 보장이 없어서 복원이 «새 프로젝트 가져오기»가 된다
 *   (.gdt 임포트가 정확히 그 이유로 §7-4 에서 새 id 를 강제한다).
 *   ⇒ 폴더를 «우리 안»에 두면 id 도 내용도 그대로다 — 복원이 «이름 되돌리기» 한 번이다.
 *
 * 배치
 *   <projectsDir>/.trash/<projectId>/bundle/      ← proj_<id> 폴더 통째로
 *   <projectsDir>/.trash/<projectId>/legacy/<이름> ← 구 flat 잔재(<id>.json, <id>_history …)
 *   <projectsDir>/.trash/<projectId>.json          ← 메타(무엇을 어디서 옮겼나·언제)
 *   ★메타를 «프로젝트 폴더 안»에 두지 않는다 — 복원한 프로젝트에 남의 파일이 남는다.
 *   ★`.trash` 는 점으로 시작해 `_listProjectsImpl` 의 /^proj_\d+$/ 필터에 «자동으로» 안 걸린다.
 *
 * ⛔여기서 «영구 삭제»를 하지 않는다. 만료분도 OS 휴지통으로 넘긴다(trashItem 주입).
 *   마지막 그물을 우리가 끊으면 되돌릴 길이 없어진다.
 */
'use strict';
const fs = require('fs');
const path = require('path');

const TRASH_DIRNAME = '.trash';
const RETENTION_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;
/* 구 flat 레이아웃 잔재 — 이것들도 «복구 재료»라 같이 옮긴다(안 옮기면 좀비가 된다). */
const LEGACY_SUFFIXES = ['.json', '_meta.json', '_backup.json', '_history'];

const trashDir  = (projectsDir) => path.join(projectsDir, TRASH_DIRNAME);
const entryDir  = (projectsDir, id) => path.join(trashDir(projectsDir), id);
const metaPath  = (projectsDir, id) => path.join(trashDir(projectsDir), `${id}.json`);
const isProjId  = (id) => typeof id === 'string' && /^proj_[A-Za-z0-9_-]+$/.test(id);

/* ★★«비었을 때만» 지운다 (2026-09-08 지디 지적).
     rmSync(recursive, force) 는 «영구 삭제»라, 안에 무엇이 남아 있으면 그걸 그대로 없앤다.
     ⛔이 파일 머리글의 약속을 스스로 어기는 자리였다 — 「여기서 영구 삭제를 하지 않는다」.
     특히 롤백이 «일부 실패»하면 그 파일들은 아직 여기 있는데, 조건 없는 rmSync 가 지웠다.
     반환값은 「사람이 봐야 한다」인데 사람이 볼 때는 이미 없었다.
   ⇒ rmdirSync 는 «안 비었으면 던진다». 그게 안전판이다. 안 비었으면 «남긴다» —
     .trash 안이고 메타도 없으니 목록엔 안 뜨지만 사람은 찾을 수 있다. 못 찾는 것보다 낫다. */
function _rmdirIfEmpty(dir) {
  /* ★«빈 껍데기»는 먼저 치운다 — mkdir 해 둔 legacy/ 가 비어 있는데 그것 때문에
     「무언가 남았다」고 말하면 거짓 경보가 된다. 파일이 남을 때만 남긴다. */
  try {
    for (const c of fs.readdirSync(dir, { withFileTypes: true })) {
      if (c.isDirectory()) { try { fs.rmdirSync(path.join(dir, c.name)); } catch (_) {} }
    }
  } catch (_) {}
  try { fs.rmdirSync(dir); return { removed: true }; }
  catch (e) {
    if (e && e.code === 'ENOENT') return { removed: true };
    let left = [];
    try { left = fs.readdirSync(dir); } catch (_) {}
    return { removed: false, left, reason: e && e.code };
  }
}

/** 옮긴 것들을 «되돌린다». 실패 중간에 부른다 — 여기서 또 실패하면 그건 «보고»한다. */
function _rollback(moves) {
  const stuck = [];
  for (const [from, to] of moves.slice().reverse()) {
    try { if (fs.existsSync(to)) fs.renameSync(to, from); }
    catch (e) { stuck.push({ path: to, error: e.message }); }
  }
  return stuck;
}

/** 프로젝트를 앱 휴지통으로 옮긴다. 되돌릴 수 있는 상태로만 끝난다. */
function moveToTrash({ projectsDir, projectId, name = null, now = Date.now() } = {}) {
  if (!isProjId(projectId)) return { ok: false, code: 'invalid_id', error: `invalid projectId: ${projectId}` };
  const src = path.join(projectsDir, projectId);
  const legacy = LEGACY_SUFFIXES
    .map(s => ({ name: projectId + s, full: path.join(projectsDir, projectId + s) }))
    .filter(x => fs.existsSync(x.full));
  const hasBundle = fs.existsSync(src);
  if (!hasBundle && !legacy.length) return { ok: false, code: 'not_found', error: `project not found: ${projectId}` };

  const dst = entryDir(projectsDir, projectId);
  /* ⛔이미 휴지통에 같은 id 가 있으면 «덮지 않는다» — 덮으면 먼저 버린 것이 소리 없이 사라진다. */
  if (fs.existsSync(dst) || fs.existsSync(metaPath(projectsDir, projectId)))
    return { ok: false, code: 'already_in_trash', error: `${projectId} 이(가) 이미 휴지통에 있다` };

  /* ★이름은 «갤러리가 보여주는 것»과 같아야 한다 — 다르면 사용자가 휴지통에서 자기 걸 못 고른다.
       갤러리(_listItemFor)는 proj_meta.json 의 목록 캐시(listMetaV+name)를 «먼저» 본다
       (ipc `projects:save-meta` 로 이름만 바꾸면 proj.json 은 옛 이름 그대로다 — 실제로 어긋났다). */
  let projName = name;
  if (projName == null) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(src, 'proj_meta.json'), 'utf8'));
      if (m && m.name != null) projName = m.name;
    } catch (_) {}
  }
  if (projName == null) {
    try { projName = JSON.parse(fs.readFileSync(path.join(src, 'proj.json'), 'utf8')).name; } catch (_) {}
  }

  const moves = [];
  try {
    fs.mkdirSync(dst, { recursive: true });
    /* ★★순서 — «잔재 먼저, 번들 나중». 반대로 하면 중간에 실패했을 때
         「본체는 휴지통인데 <id>_history 는 남는」 상태가 되고, 목록의 낡은 카드를 누르면
         projects:load 폴백이 그 잔재로 «옛 내용의 좀비»를 되살린다(검사 U7-12 가 이 자리를 지킨다).
       잔재 먼저면 최악이 「본체는 멀쩡한데 낡은 잔재만 옮겼다」라 무해하다.
       ⛔롤백이 있으니 순서는 상관없다고 «생각하지 마라» — 롤백도 실패할 수 있다(rollbackStuck). */
    if (legacy.length) {
      fs.mkdirSync(path.join(dst, 'legacy'), { recursive: true });
      for (const l of legacy) {
        const to = path.join(dst, 'legacy', l.name);
        fs.renameSync(l.full, to); moves.push([l.full, to]);
      }
    }
    if (hasBundle) {
      const to = path.join(dst, 'bundle');
      fs.renameSync(src, to); moves.push([src, to]);
    }
    const meta = {
      projectId, name: projName || projectId,
      deletedAt: new Date(now).toISOString(),
      hasBundle, legacy: legacy.map(l => l.name),
      note: '고디터 앱 휴지통. 되살리려면 앱의 휴지통 탭에서 «되살리기».',
    };
    fs.writeFileSync(metaPath(projectsDir, projectId), JSON.stringify(meta, null, 2));
    return { ok: true, projectId, name: meta.name, deletedAt: meta.deletedAt,
             movedBundle: hasBundle, movedLegacy: legacy.length };
  } catch (e) {
    /* ★반쯤 옮긴 채로 끝내지 않는다 — 그 상태가 제일 나쁘다(목록엔 없는데 휴지통에도 없다). */
    const stuck = _rollback(moves);
    /* ⛔«비었을 때만» 지운다 — 롤백이 못 되돌린 파일이 여기 남아 있을 수 있다(지디 지적 F1) */
    const rm = _rmdirIfEmpty(dst);
    /* 봉투가 비지 않았으면 메타는 «안» 쓴 상태 그대로 두고, 어디에 무엇이 남았는지 말한다.
       ⛔말없이 남기면 사용자는 「그냥 실패했다」로 읽고 그 파일들을 영영 모른다. */
    return { ok: false, code: 'io', error: e.message,
             ...(stuck.length ? { rollbackStuck: stuck } : {}),
             ...(rm.removed ? {} : { leftInTrash: { dir: dst, entries: rm.left } }),
             hint: stuck.length
               ? `되돌리기도 일부 실패했다 — 못 되돌린 것은 «지우지 않고» ${dst} 에 남겼다. 사람이 봐야 한다`
               : '원래 자리로 되돌렸다' };
  }
}

/** 휴지통 목록. 남은 날짜를 «같이» 준다 — 안 주면 조용히 사라진 걸로 보인다. */
function listTrash({ projectsDir, retentionDays = RETENTION_DAYS, now = Date.now() } = {}) {
  const dir = trashDir(projectsDir);
  let names = [];
  try { names = fs.readdirSync(dir).filter(n => n.endsWith('.json')); } catch (_) { return { ok: true, items: [] }; }
  const items = [];
  for (const n of names) {
    try {
      const m = JSON.parse(fs.readFileSync(path.join(dir, n), 'utf8'));
      if (!isProjId(m.projectId)) continue;
      const t = Date.parse(m.deletedAt);
      const ageDays = Number.isFinite(t) ? (now - t) / DAY_MS : 0;
      const daysLeft = Math.max(0, Math.ceil(retentionDays - ageDays));
      items.push({ projectId: m.projectId, name: m.name || m.projectId,
                   deletedAt: m.deletedAt, daysLeft, expired: ageDays >= retentionDays });
    } catch (_) { /* 깨진 메타 하나가 목록 전체를 죽이면 안 된다 */ }
  }
  items.sort((a, b) => String(b.deletedAt).localeCompare(String(a.deletedAt)));
  return { ok: true, items, retentionDays };
}

/** 되살린다 — id 그대로. ⛔자리가 차 있으면 «덮지 않고» 거절한다. */
function restoreFromTrash({ projectsDir, projectId } = {}) {
  if (!isProjId(projectId)) return { ok: false, code: 'invalid_id', error: `invalid projectId: ${projectId}` };
  const dst = entryDir(projectsDir, projectId);
  const mp = metaPath(projectsDir, projectId);
  if (!fs.existsSync(mp)) return { ok: false, code: 'not_found', error: `휴지통에 없다: ${projectId}` };
  let meta; try { meta = JSON.parse(fs.readFileSync(mp, 'utf8')); }
  catch (e) { return { ok: false, code: 'meta_broken', error: e.message }; }

  const back = path.join(projectsDir, projectId);
  if (fs.existsSync(back))
    return { ok: false, code: 'id_taken',
             error: `${projectId} 자리에 이미 무언가 있다 — 덮어쓰지 않는다`,
             hint: '먼저 그 프로젝트를 옮기거나 이름을 바꿔라' };

  const moves = [];
  try {
    if (meta.hasBundle) {
      const from = path.join(dst, 'bundle');
      if (!fs.existsSync(from)) return { ok: false, code: 'bundle_missing', error: '휴지통 안 bundle 이 없다' };
      fs.renameSync(from, back); moves.push([from, back]);
    }
    for (const nm of meta.legacy || []) {
      const from = path.join(dst, 'legacy', nm);
      const to = path.join(projectsDir, nm);
      if (!fs.existsSync(from)) continue;
      if (fs.existsSync(to)) throw new Error(`복원 자리가 차 있다: ${nm}`);
      fs.renameSync(from, to); moves.push([from, to]);
    }
    _rmdirIfEmpty(path.join(dst, 'legacy'));   // ★빈 껍데기만 치운다(안 비었으면 안 지운다)
    fs.rmSync(mp, { force: true });
    /* ⛔«비었을 때만». 메타에 안 적힌 파일이 있으면 그건 «우리가 모르는 것»이라 지울 자격이 없다
       (지디 지적 F2 — 가능성은 낮지만 「없다」로 적지 않는다). 남기고 «말한다». */
    const rm = _rmdirIfEmpty(dst);
    return { ok: true, projectId, name: meta.name || projectId,
             ...(rm.removed ? {} : { leftBehind: rm.left, leftBehindDir: dst,
                                     hint: '휴지통 항목에 «메타가 모르는» 파일이 있어 지우지 않고 남겼다' }) };
  } catch (e) {
    const stuck = _rollback(moves);
    return { ok: false, code: 'io', error: e.message,
             ...(stuck.length ? { rollbackStuck: stuck } : {}) };
  }
}

/** 휴지통에서 «내보낸다» — 영구삭제가 아니라 OS 휴지통으로. trashItem 은 주입받는다. */
async function purgeFromTrash({ projectsDir, projectId, trashItem } = {}) {
  if (!isProjId(projectId)) return { ok: false, code: 'invalid_id' };
  if (typeof trashItem !== 'function') return { ok: false, code: 'no_trash_fn', error: 'trashItem 이 필요하다' };
  const dst = entryDir(projectsDir, projectId);
  const mp = metaPath(projectsDir, projectId);
  if (!fs.existsSync(mp) && !fs.existsSync(dst)) return { ok: false, code: 'not_found' };
  try {
    if (fs.existsSync(dst)) await trashItem(dst);
    /* ★효과로 판정한다 — 「불렀다」가 아니라 «없어졌나». 남아 있으면 메타를 «안» 지운다
       (메타를 먼저 지우면 목록에서 사라진 채 디스크에만 남는 «유령»이 된다). */
    if (fs.existsSync(dst)) return { ok: false, code: 'trash_noeffect', error: 'OS 휴지통 호출은 됐는데 폴더가 그대로다' };
    fs.rmSync(mp, { force: true });
    return { ok: true, projectId };
  } catch (e) { return { ok: false, code: 'trash_failed', error: e.message }; }
}

/** 만료분 쓸어내기 — 앱을 켤 때 «지난 날짜를 몰아서» 처리한다(안 켜는 동안 시간이 멈추면 놀란다). */
async function sweepTrash({ projectsDir, retentionDays = RETENTION_DAYS, trashItem, now = Date.now() } = {}) {
  const { items } = listTrash({ projectsDir, retentionDays, now });
  const swept = [], failed = [];
  for (const it of items) {
    if (!it.expired) continue;
    const r = await purgeFromTrash({ projectsDir, projectId: it.projectId, trashItem });
    (r.ok ? swept : failed).push(r.ok ? it.projectId : { projectId: it.projectId, ...r });
  }
  return { ok: true, swept, failed, checked: items.length };
}

module.exports = { moveToTrash, listTrash, restoreFromTrash, purgeFromTrash, sweepTrash,
                   TRASH_DIRNAME, RETENTION_DAYS, LEGACY_SUFFIXES };
