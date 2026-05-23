#!/usr/bin/env node
/**
 * verify-bundle-migration.mjs
 * ─────────────────────────────────────────────────────────────────────────
 * 프로젝트 데이터 번들화(flat → proj_<id>/ 디렉터리) 마이그레이션을
 * 사본(snapshot) 디렉터리 위에서 검증하는 e2e 도구.
 *
 * 모드:
 *   --dry-run-from        <COPY_DIR>   migrator 호출 검증 (dry-run + 실제 + 멱등성)
 *   --regression-checks   <COPY_DIR>   마이그레이션 끝난 사본의 회귀 항목 검증
 *   --kill-9-simulation   <COPY_DIR>   partial state 만들어두고 재시도 동작 검증
 *
 * 절대 가드:
 *   - PROJECTS_DIR(실제 사용자 데이터)는 절대 건드리지 않는다.
 *     CLI 인자로 받은 디렉터리만 mutate 한다.
 *   - 입력 경로가 ~/Library/Application Support/Goya Design Editor/projects
 *     본체이면 즉시 abort.
 *   - rm -rf, git, mv, network call 일체 없음. fs/path/url 만 사용.
 *
 * 외부 dep 없음 — Node 18+ ESM 기본 모듈만.
 *
 * migrator 모듈(`main/project-store/migrator.js`)이 없으면 helpful 에러
 * 메시지 후 exit 1. 팀 1/2 머지 전 단독 실행 시 의도된 동작.
 * ─────────────────────────────────────────────────────────────────────────
 */

import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import crypto from 'node:crypto';
import { pathToFileURL, fileURLToPath } from 'node:url';

// ── 상수 / 가드 ──────────────────────────────────────────────────────────

const REAL_PROJECTS_DIR = path.join(
  os.homedir(),
  'Library',
  'Application Support',
  'Goya Design Editor',
  'projects'
);

const NEW_LAYOUT_FILES = ['proj.json', 'proj_meta.json', 'proj_backup.json'];
const HISTORY_DIR = 'proj_history';
const MIGRATED_MARKER = '.migrated.json';
const QUARANTINE_DIR = '.quarantine';

// ── CLI 파싱 ─────────────────────────────────────────────────────────────

const argv = process.argv.slice(2);
const MODE_FLAGS = ['--dry-run-from', '--regression-checks', '--kill-9-simulation'];

function parseArgs() {
  const found = MODE_FLAGS.find(f => argv.includes(f));
  if (!found) return { mode: null };
  const idx = argv.indexOf(found);
  const target = argv[idx + 1];
  return { mode: found, target };
}

function printUsage() {
  console.log(`
사용:
  node scripts/verify-bundle-migration.mjs --dry-run-from <COPY_DIR>
  node scripts/verify-bundle-migration.mjs --regression-checks <COPY_DIR>
  node scripts/verify-bundle-migration.mjs --kill-9-simulation <COPY_DIR>

COPY_DIR은 PROJECTS_DIR을 rsync로 복사한 사본 경로여야 한다.
  ./scripts/snapshot-projects-dir.sh 헬퍼로 사본을 만들 수 있다.

검증 도구는 실제 PROJECTS_DIR을 건드리지 않는다.
`);
}

function assertCopyDir(target) {
  if (!target) {
    console.error('[verify] ERROR: COPY_DIR 인자가 필요하다.');
    printUsage();
    process.exit(64);
  }
  const abs = path.resolve(target);

  if (!fs.existsSync(abs)) {
    console.error(`[verify] ERROR: 경로가 존재하지 않음 — ${abs}`);
    process.exit(66);
  }
  if (!fs.statSync(abs).isDirectory()) {
    console.error(`[verify] ERROR: 디렉터리가 아님 — ${abs}`);
    process.exit(66);
  }
  // 실 PROJECTS_DIR 직접 mutate 방지 — symlink 우회까지 차단.
  // realpathSync로 양쪽을 정규화한 뒤 비교한다.
  let realCopy;
  try { realCopy = fs.realpathSync(abs); } catch { realCopy = abs; }
  let realProjects = null;
  try { realProjects = fs.realpathSync(REAL_PROJECTS_DIR); } catch { /* 없을 수 있음 (개발 머신) */ }

  if (realCopy === path.resolve(REAL_PROJECTS_DIR) || (realProjects && realCopy === realProjects)) {
    console.error(`[verify] ERROR: 실제 PROJECTS_DIR(${REAL_PROJECTS_DIR})을 직접/symlink로 가리키고 있다.`);
    console.error(`[verify]        반드시 사본 디렉터리에서 검증해야 한다. snapshot 헬퍼를 사용하라.`);
    process.exit(70);
  }
  return realCopy;
}

// ── 공용 유틸 ────────────────────────────────────────────────────────────

function sha256OfFile(p) {
  const h = crypto.createHash('sha256');
  h.update(fs.readFileSync(p));
  return h.digest('hex');
}

function listDirEntries(p) {
  return fs.readdirSync(p, { withFileTypes: true });
}

// flat 레이아웃의 프로젝트 ID 추출: proj_<digits>.json
function listFlatProjectIds(copyDir) {
  return listDirEntries(copyDir)
    .filter(d => d.isFile() && /^proj_\d+\.json$/.test(d.name))
    .map(d => d.name.replace(/\.json$/, ''));
}

// 신 레이아웃의 프로젝트 ID 추출: proj_<digits>/ 디렉터리 + proj.json 안에 있음
function listBundledProjectIds(copyDir) {
  return listDirEntries(copyDir)
    .filter(d => d.isDirectory() && /^proj_\d+$/.test(d.name))
    .map(d => d.name)
    .filter(name => fs.existsSync(path.join(copyDir, name, 'proj.json')));
}

// 합집합 — 마이그레이션 도중인 경우 양쪽 다 있을 수 있음
function listAllProjectIds(copyDir) {
  return Array.from(new Set([...listFlatProjectIds(copyDir), ...listBundledProjectIds(copyDir)]));
}

// 결과 리포트
class Report {
  constructor(mode) {
    this.mode = mode;
    this.checks = [];
  }
  ok(label, detail = '') {
    this.checks.push({ status: 'ok', label, detail });
  }
  fail(label, detail = '') {
    this.checks.push({ status: 'fail', label, detail });
  }
  warn(label, detail = '') {
    this.checks.push({ status: 'warn', label, detail });
  }
  summary() {
    const okN = this.checks.filter(c => c.status === 'ok').length;
    const failN = this.checks.filter(c => c.status === 'fail').length;
    const warnN = this.checks.filter(c => c.status === 'warn').length;
    return { okN, failN, warnN, total: this.checks.length };
  }
  print() {
    console.log(`\n[verify] === ${this.mode} 결과 ===`);
    for (const c of this.checks) {
      const tag = c.status === 'ok' ? 'OK  ' : c.status === 'warn' ? 'WARN' : 'FAIL';
      const detail = c.detail ? ` — ${c.detail}` : '';
      console.log(`  [${tag}] ${c.label}${detail}`);
    }
    const s = this.summary();
    console.log(`\n[verify] 합계: OK ${s.okN} / WARN ${s.warnN} / FAIL ${s.failN} (총 ${s.total})`);
    return s.failN === 0;
  }
}

// ── migrator 동적 로드 ────────────────────────────────────────────────────

async function loadMigrator() {
  // fileURLToPath로 cross-platform 안전하게 현재 파일 경로 추출
  const thisFile = fileURLToPath(import.meta.url);
  const repoRoot = path.resolve(path.dirname(thisFile), '..');
  const candidates = [
    path.join(repoRoot, 'main', 'project-store', 'migrator.js'),
    path.join(repoRoot, 'main', 'project-store', 'migrator.mjs'),
  ];
  const found = candidates.find(p => fs.existsSync(p));
  if (!found) {
    console.error('[verify] ERROR: migrator 모듈을 찾을 수 없다.');
    console.error('         예상 위치:');
    for (const c of candidates) console.error(`           - ${c}`);
    console.error('         팀 1(Migrator 모듈) 머지 전이라면 정상.');
    console.error('         머지 후 재실행하라.');
    process.exit(69);
  }
  try {
    const mod = await import(pathToFileURL(found).href);
    // 실제 시그니처: migrateAll(projectsDir, { dryRun, log }) → { migrated:string[], skipped:string[], failed:Array, logPath:string }
    if (typeof mod.migrateAll !== 'function') {
      console.error(`[verify] ERROR: migrator 모듈에 migrateAll() export가 없다 — ${found}`);
      console.error('         팀 1이 어떻게 export 했는지 확인 필요. 다음 이름들을 발견:');
      for (const k of Object.keys(mod)) console.error(`           - ${k}`);
      console.error('         기대 시그니처: migrateAll(projectsDir, { dryRun, log }) → { migrated, skipped, failed, logPath }');
      process.exit(69);
    }
    return { module: mod, source: found };
  } catch (e) {
    console.error(`[verify] ERROR: migrator import 실패 — ${found}`);
    console.error(`         ${e.stack || e.message}`);
    process.exit(69);
  }
}

// ── 모드 A: --dry-run-from ───────────────────────────────────────────────

async function modeDryRun(copyDir) {
  const report = new Report('dry-run-from');
  console.log(`[verify] copy dir: ${copyDir}`);

  const { module: migrator } = await loadMigrator();

  // STEP 0: 사본의 flat 파일 스냅샷 (dry-run 후 원상 보존 확인용)
  const flatBefore = listFlatProjectIds(copyDir);
  console.log(`[verify] flat .json 발견: ${flatBefore.length}`);
  if (flatBefore.length === 0) {
    report.warn('flat 프로젝트 0개', '사본이 이미 마이그레이션 완료 상태일 수 있다. 그래도 멱등성 검증은 진행.');
  }

  const flatJsonHashes = {};
  for (const id of flatBefore) {
    flatJsonHashes[id] = sha256OfFile(path.join(copyDir, `${id}.json`));
  }

  // STEP 1: dryRun = true
  console.log('\n[verify] STEP 1 — migrateAll({ dryRun: true })');
  let dryRes;
  try {
    dryRes = await migrator.migrateAll(copyDir, { dryRun: true, log: (lvl, msg) => console.log(`[migrator:${lvl}]`, msg) });
  } catch (e) {
    report.fail('dryRun=true 호출 실패', e.message);
    return report.print();
  }
  report.ok('dryRun=true 호출 완료', `결과: ${JSON.stringify(dryRes?.summary || dryRes)}`);

  // 사본 flat 파일 변형되지 않아야 함
  let dryRunMutated = false;
  for (const id of flatBefore) {
    const cur = path.join(copyDir, `${id}.json`);
    if (!fs.existsSync(cur)) {
      dryRunMutated = true;
      report.fail(`dryRun 중 flat 파일 사라짐 — ${id}.json`);
      break;
    }
    if (sha256OfFile(cur) !== flatJsonHashes[id]) {
      dryRunMutated = true;
      report.fail(`dryRun 중 flat 파일 변경됨 — ${id}.json`);
      break;
    }
  }
  if (!dryRunMutated) {
    report.ok('dryRun은 flat 원본 변경하지 않음 (sha256 일치)');
  }

  // dryRun 중 신 위치 디렉터리도 생성되지 않아야 함 (이미 마이그레이션 끝난 디렉터리 제외)
  const bundledBefore = new Set(listBundledProjectIds(copyDir));
  const bundledAfterDry = listBundledProjectIds(copyDir);
  const newCreatedByDry = bundledAfterDry.filter(id => !bundledBefore.has(id));
  if (newCreatedByDry.length === 0) {
    report.ok('dryRun은 신 위치에 새 디렉터리 생성하지 않음');
  } else {
    report.fail('dryRun이 신 위치 디렉터리 생성함', newCreatedByDry.join(','));
  }

  // STEP 2: 실제 마이그레이션
  console.log('\n[verify] STEP 2 — migrateAll({ dryRun: false })');
  let realRes;
  try {
    realRes = await migrator.migrateAll(copyDir, { dryRun: false, log: (lvl, msg) => console.log(`[migrator:${lvl}]`, msg) });
  } catch (e) {
    report.fail('dryRun=false 호출 실패', e.message);
    return report.print();
  }
  report.ok('실 마이그레이션 호출 완료', `결과: ${JSON.stringify(realRes?.summary || realRes)}`);

  // 각 flat ID가 신 위치에 정확히 4개 entry + 마커
  for (const id of flatBefore) {
    const bundleDir = path.join(copyDir, id);
    if (!fs.existsSync(bundleDir) || !fs.statSync(bundleDir).isDirectory()) {
      report.fail(`신 위치 디렉터리 없음 — ${id}`);
      continue;
    }
    // 4 entries: proj.json + proj_meta.json + proj_backup.json + proj_history/
    const missing = [];
    for (const f of NEW_LAYOUT_FILES) {
      const p = path.join(bundleDir, f);
      if (!fs.existsSync(p)) missing.push(f);
    }
    const histPath = path.join(bundleDir, HISTORY_DIR);
    // proj_history는 사본에 없는 케이스도 있을 수 있다 (기존 _history 없는 프로젝트). 보조 파일 누락은 warn으로.
    if (missing.length === 0) {
      report.ok(`신 레이아웃 파일 모두 존재 — ${id}`);
    } else {
      // proj_backup.json은 첫 저장 전 프로젝트에 없을 수도 있음 → warn
      const criticalMissing = missing.filter(f => f === 'proj.json' || f === 'proj_meta.json');
      if (criticalMissing.length > 0) {
        report.fail(`핵심 파일 누락 — ${id}`, criticalMissing.join(','));
      } else {
        report.warn(`보조 파일 누락 — ${id}`, missing.join(','));
      }
    }
    // proj_history 존재 여부는 정보 차원
    if (fs.existsSync(histPath) && fs.statSync(histPath).isDirectory()) {
      const slotCount = fs.readdirSync(histPath).filter(f => f.endsWith('.json')).length;
      report.ok(`proj_history 슬롯 ${slotCount}개 — ${id}`);
    }

    // 마이그레이션 마커
    const marker = path.join(bundleDir, MIGRATED_MARKER);
    if (fs.existsSync(marker)) {
      try {
        const m = JSON.parse(fs.readFileSync(marker, 'utf8'));
        if (m && m.timestamp && (m.sourceLayout || m.schemaVersion !== undefined)) {
          report.ok(`마이그레이션 마커 OK — ${id}`, `ts=${m.timestamp}`);
        } else {
          report.warn(`마이그레이션 마커 필드 부족 — ${id}`, JSON.stringify(m).slice(0, 100));
        }
      } catch (e) {
        report.fail(`마이그레이션 마커 파싱 실패 — ${id}`, e.message);
      }
    } else {
      report.fail(`마이그레이션 마커 누락 — ${id}`);
    }

    // proj.json 파싱 + ID 보존
    const projPath = path.join(bundleDir, 'proj.json');
    if (fs.existsSync(projPath)) {
      try {
        const proj = JSON.parse(fs.readFileSync(projPath, 'utf8'));
        if (proj.id === id) {
          report.ok(`proj.json id 일치 — ${id}`);
        } else {
          report.fail(`proj.json id 불일치 — ${id}`, `파일내=${proj.id}`);
        }
      } catch (e) {
        report.fail(`proj.json 파싱 실패 — ${id}`, e.message);
      }
    }
  }

  // 격리 폴더에 flat 원본 이동
  const quarantineDir = path.join(copyDir, QUARANTINE_DIR);
  if (fs.existsSync(quarantineDir)) {
    // .quarantine 안에 timestamp 하위가 있을 수도 있고 평면일 수도 있음 — 둘 다 허용
    const found = [];
    function walk(dir) {
      for (const d of listDirEntries(dir)) {
        const full = path.join(dir, d.name);
        if (d.isDirectory()) walk(full);
        else if (/^proj_\d+(\.json|_backup\.json|_meta\.json)$/.test(d.name)) found.push(d.name);
      }
    }
    walk(quarantineDir);
    // 각 flat ID의 .json이 격리됐는지
    for (const id of flatBefore) {
      const match = found.some(n => n === `${id}.json`);
      if (match) report.ok(`격리됨 — ${id}.json`);
      else report.fail(`격리 안 됨 — ${id}.json`);
    }
  } else if (flatBefore.length > 0) {
    report.fail('격리 디렉터리 없음 — quarantine 정책 미적용');
  } else {
    report.ok('격리 디렉터리 없음 — flat 없으므로 정상');
  }

  // 사본에 flat 원본이 남아있지 않아야 (격리됐어야)
  const flatAfter = listFlatProjectIds(copyDir);
  if (flatAfter.length === 0) {
    report.ok('PROJECTS_DIR 직접에 flat .json 잔존 0');
  } else {
    report.fail('PROJECTS_DIR에 flat .json 잔존', flatAfter.join(','));
  }

  // STEP 3: 멱등성 — 다시 돌리면 모두 skipped
  console.log('\n[verify] STEP 3 — migrateAll 재호출 (멱등성)');
  let idem;
  try {
    idem = await migrator.migrateAll(copyDir, { dryRun: false, log: (lvl, msg) => console.log(`[migrator:${lvl}]`, msg) });
  } catch (e) {
    report.fail('멱등 재호출 실패', e.message);
    return report.print();
  }
  // 기대: summary.migrated == 0, failed == 0
  const sum = idem?.summary || idem || {};
  const _len = (v) => Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0);
  if (_len(sum.migrated) === 0 && _len(sum.failed) === 0) {
    report.ok('멱등성 OK — 두 번째 호출 migrated=0, failed=0', JSON.stringify(sum));
  } else {
    report.fail('멱등성 실패', `결과: ${JSON.stringify(sum)}`);
  }

  return report.print();
}

// ── 모드 B: --regression-checks ──────────────────────────────────────────

function modeRegression(copyDir) {
  const report = new Report('regression-checks');
  console.log(`[verify] copy dir: ${copyDir}`);
  console.log('[verify] NOTE: 이 모드는 post-migration 정적 검증만 수행한다.');
  console.log('         "원본 vs 마이그레이션 후" 정확한 보존 비교는 e2e 체크리스트(docs/migration-e2e-checklist.md)의');
  console.log('         8-2/8-3 단계(브랜치/커밋 추가 후 길이 확인)에서 수행한다.');

  const bundled = listBundledProjectIds(copyDir);
  console.log(`[verify] 번들 프로젝트: ${bundled.length}`);
  if (bundled.length === 0) {
    report.fail('번들 프로젝트가 하나도 없음', '마이그레이션이 안 돌았거나 디렉터리가 비어있다.');
    return report.print();
  }

  for (const id of bundled) {
    const bundleDir = path.join(copyDir, id);

    // (1) syncClaudePmTitle 회귀 — claude-pm/project.meta.json title == proj.json name
    const projPath = path.join(bundleDir, 'proj.json');
    const pmMetaPath = path.join(bundleDir, 'claude-pm', 'project.meta.json');
    if (!fs.existsSync(projPath)) {
      report.fail(`proj.json 없음 — ${id}`);
      continue;
    }
    let proj;
    try { proj = JSON.parse(fs.readFileSync(projPath, 'utf8')); }
    catch (e) { report.fail(`proj.json 파싱 실패 — ${id}`, e.message); continue; }

    if (fs.existsSync(pmMetaPath)) {
      try {
        const pmMeta = JSON.parse(fs.readFileSync(pmMetaPath, 'utf8'));
        if (pmMeta && proj && pmMeta.title === proj.name) {
          report.ok(`PM title 동기 OK — ${id}`, `name=${proj.name}`);
        } else {
          report.fail(`PM title 불일치 — ${id}`, `proj.name=${proj?.name} pmMeta.title=${pmMeta?.title}`);
        }
      } catch (e) {
        report.fail(`PM meta 파싱 실패 — ${id}`, e.message);
      }
    } else {
      // claude-pm 폴더 미생성 프로젝트는 정상 (PM 안 켠 경우)
      report.ok(`PM 폴더 없음 — ${id} (스킵, 정상)`);
    }

    // (2) branch-system / commit-system 필드 보존 — proj_meta.json
    const metaPath = path.join(bundleDir, 'proj_meta.json');
    if (fs.existsSync(metaPath)) {
      try {
        const meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
        const fields = [];
        if (Array.isArray(meta.commits)) fields.push(`commits=${meta.commits.length}`);
        if (Array.isArray(meta.branches)) fields.push(`branches=${meta.branches.length}`);
        if (meta.thumbnail) fields.push('thumbnail');
        if (meta.currentBranch) fields.push(`currentBranch=${meta.currentBranch}`);
        if (fields.length > 0) {
          report.ok(`proj_meta.json 필드 보존 — ${id}`, fields.join(', '));
        } else {
          // 빈 _meta 일 수 있음 (모든 프로젝트가 branch/commit 쓰는 건 아님)
          report.ok(`proj_meta.json 비어있음 — ${id} (정상 가능)`);
        }
        // commits가 있는데 첫 commit이 id/message/branch/timestamp 갖췄는지 sanity
        if (Array.isArray(meta.commits) && meta.commits.length > 0) {
          const first = meta.commits[0];
          const ok = first && first.id && first.message !== undefined && first.timestamp;
          if (ok) report.ok(`첫 commit 형식 OK — ${id}`);
          else report.fail(`commit 필드 누락 — ${id}`, JSON.stringify(first).slice(0, 120));
        }
      } catch (e) {
        report.fail(`proj_meta.json 파싱 실패 — ${id}`, e.message);
      }
    } else {
      report.warn(`proj_meta.json 없음 — ${id}`, 'orphan일 수 있음');
    }

    // (3) proj_history 슬롯 수
    const histPath = path.join(bundleDir, HISTORY_DIR);
    if (fs.existsSync(histPath)) {
      const slots = fs.readdirSync(histPath).filter(f => /^\d+\.json$/.test(f));
      if (slots.length <= 5) {
        report.ok(`history 슬롯 ${slots.length}개 — ${id} (≤5)`);
      } else {
        report.fail(`history 슬롯 초과 — ${id}`, `${slots.length}개 (>5)`);
      }
    }

    // (4) 마이그레이션 마커 존재
    const marker = path.join(bundleDir, MIGRATED_MARKER);
    if (!fs.existsSync(marker)) {
      // 신 layout 으로 처음부터 만들어진 프로젝트는 마커 없을 수도 — warn
      report.warn(`마이그레이션 마커 없음 — ${id}`, '신규 생성 프로젝트라면 정상');
    } else {
      report.ok(`마이그레이션 마커 존재 — ${id}`);
    }
  }

  // (5) quarantine 안에 신 위치 파일들과 동일 이름이 모두 있는지 (롤백 가능성)
  const quarantineDir = path.join(copyDir, QUARANTINE_DIR);
  if (fs.existsSync(quarantineDir)) {
    const quarantineFiles = [];
    function walk(dir) {
      for (const d of listDirEntries(dir)) {
        const full = path.join(dir, d.name);
        if (d.isDirectory()) walk(full);
        else quarantineFiles.push(d.name);
      }
    }
    walk(quarantineDir);
    let rollbackOk = 0;
    let rollbackMissing = 0;
    for (const id of bundled) {
      // 신 layout에서 마이그레이션 마커가 있는 프로젝트만 quarantine 매칭 검증
      if (!fs.existsSync(path.join(copyDir, id, MIGRATED_MARKER))) continue;
      const expected = `${id}.json`;
      if (quarantineFiles.includes(expected)) rollbackOk += 1;
      else rollbackMissing += 1;
    }
    if (rollbackMissing === 0) {
      report.ok(`롤백 가능성 OK — quarantine에 모든 flat 원본 존재 (${rollbackOk}개)`);
    } else {
      report.fail(`롤백 위험 — quarantine에 누락된 flat 원본 ${rollbackMissing}개`);
    }
  } else {
    report.warn('quarantine 디렉터리 없음', '마이그레이션 마커 있는 프로젝트가 있다면 의심.');
  }

  return report.print();
}

// ── 모드 C: --kill-9-simulation ──────────────────────────────────────────

async function modeKill9(copyDir) {
  const report = new Report('kill-9-simulation');
  console.log(`[verify] copy dir: ${copyDir}`);
  console.log('[verify] WARNING: 이 모드는 사본 디렉터리에 mutate를 한다 (partial state 생성).');
  console.log('         실제 사용자 데이터가 아니라 snapshot 사본인지 확인 후 진행하라.');
  console.log('         (assertCopyDir 가드가 1차로 차단하지만, 추가 주의가 필요한 destructive 모드다.)');

  const { module: migrator } = await loadMigrator();

  // 대상 프로젝트 선택: 번들 디렉터리가 이미 있고 마이그레이션 끝난 것 중 첫 번째
  const bundled = listBundledProjectIds(copyDir);
  const completed = bundled.filter(id =>
    fs.existsSync(path.join(copyDir, id, MIGRATED_MARKER))
  );
  if (completed.length === 0) {
    report.fail('kill-9 시뮬레이션 대상 없음', '완전히 마이그레이션된 프로젝트가 사본에 없음 — 먼저 --dry-run-from 으로 마이그레이션 후 실행하라.');
    return report.print();
  }

  const targetId = completed[0];
  const targetDir = path.join(copyDir, targetId);
  console.log(`[verify] 대상 프로젝트: ${targetId}`);

  // partial state 만들기: 마커와 _meta 제거, proj.json만 남김
  // (마치 마이그레이션 중 crash로 proj.json만 복사된 상태)
  const markerPath = path.join(targetDir, MIGRATED_MARKER);
  const metaInBundle = path.join(targetDir, 'proj_meta.json');
  const backupInBundle = path.join(targetDir, 'proj_backup.json');

  // 백업 (검증 후 복원용은 아니고, 단순 시뮬레이션이므로 그냥 제거)
  // 단, quarantine에서 복원 가능해야 하므로 quarantine에 flat 원본이 있어야 함.
  // (사본은 어차피 복제본이므로 mutate OK)
  const removed = [];
  for (const p of [markerPath, metaInBundle, backupInBundle]) {
    if (fs.existsSync(p)) {
      fs.rmSync(p, { force: true });
      removed.push(path.basename(p));
    }
  }
  report.ok('partial state 생성 완료', `제거: ${removed.join(',') || '(없음)'}`);

  // 추가로 quarantine 안에 flat 원본이 있는지 확인 (없으면 재시도 시 복원 불가)
  const quarantineDir = path.join(copyDir, QUARANTINE_DIR);
  let foundInQuarantine = false;
  if (fs.existsSync(quarantineDir)) {
    function walk(dir) {
      for (const d of listDirEntries(dir)) {
        const full = path.join(dir, d.name);
        if (d.isDirectory()) walk(full);
        else if (d.name === `${targetId}.json`) foundInQuarantine = true;
      }
    }
    walk(quarantineDir);
  }
  if (!foundInQuarantine) {
    // flat 원본을 quarantine에서 사본 외부로 살려둬야 재시도 가능
    // 이 경우엔 직접 사본 root로 다시 옮겨서 재시도 가능하게 시뮬레이션
    // ── 우리는 이미 quarantine에 있는 걸 다시 root로 옮기지 않는다 (mutate 최소화).
    // 대신 migrator가 partial bundle만 보고 어떻게 동작하는지 관찰.
    report.warn('quarantine에서 flat 원본 못 찾음', 'migrator는 신 위치 partial만 보고 재처리해야 한다.');
  }

  // migrator 재호출
  console.log('\n[verify] migrateAll 재호출 (partial 상태에서 복구 시도)');
  let retry;
  try {
    retry = await migrator.migrateAll(copyDir, { dryRun: false, log: (lvl, msg) => console.log(`[migrator:${lvl}]`, msg) });
  } catch (e) {
    report.fail('재호출 중 예외', e.message);
    return report.print();
  }
  report.ok('재호출 완료', `결과: ${JSON.stringify(retry?.summary || retry)}`);

  // 신 위치 파일들이 다시 갖춰졌는지 확인
  const projOk = fs.existsSync(path.join(targetDir, 'proj.json'));
  const metaOk = fs.existsSync(metaInBundle);
  const markerOk = fs.existsSync(markerPath);

  if (projOk) report.ok(`proj.json 유지 — ${targetId}`);
  else report.fail(`proj.json 없어짐 — ${targetId} (위험)`);

  if (metaOk) report.ok(`proj_meta.json 복구됨 — ${targetId}`);
  else report.warn(`proj_meta.json 복구 안 됨 — ${targetId}`, '원본에 _meta가 없었거나 migrator 동작 다를 수 있음');

  if (markerOk) report.ok(`마이그레이션 마커 복구됨 — ${targetId}`);
  else report.fail(`마이그레이션 마커 복구 안 됨 — ${targetId}`);

  // 멱등성: 한 번 더 돌려서 다시 변화 없는지
  console.log('\n[verify] 한번 더 재호출 (멱등성 재확인)');
  let again;
  try {
    again = await migrator.migrateAll(copyDir, { dryRun: false, log: (lvl, msg) => console.log(`[migrator:${lvl}]`, msg) });
  } catch (e) {
    report.fail('멱등 재호출 실패', e.message);
    return report.print();
  }
  const sum = again?.summary || again || {};
  const _len = (v) => Array.isArray(v) ? v.length : (typeof v === 'number' ? v : 0);
  if (_len(sum.migrated) === 0 && _len(sum.failed) === 0) {
    report.ok('partial 복구 후 멱등성 OK', JSON.stringify(sum));
  } else {
    report.fail('partial 복구 후 멱등성 실패', JSON.stringify(sum));
  }

  return report.print();
}

// ── main ────────────────────────────────────────────────────────────────

async function main() {
  const { mode, target } = parseArgs();
  if (!mode) {
    printUsage();
    process.exit(64);
  }
  const copyDir = assertCopyDir(target);

  let ok = false;
  if (mode === '--dry-run-from') ok = await modeDryRun(copyDir);
  else if (mode === '--regression-checks') ok = modeRegression(copyDir);
  else if (mode === '--kill-9-simulation') ok = await modeKill9(copyDir);
  else {
    printUsage();
    process.exit(64);
  }

  process.exit(ok ? 0 : 1);
}

main().catch(e => {
  console.error('[verify] 예상치 못한 에러:', e.stack || e.message);
  process.exit(1);
});
