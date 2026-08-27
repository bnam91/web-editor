/* ═══════════════════════════════════════════════════════════════════════════
   project-store/snapshot-store.js — 프로젝트 «버전/백업 히스토리»의 저장소 계층.
   설계: _context/DESIGN-version-history.md
   ───────────────────────────────────────────────────────────────────────────
   ★U0 단계에서는 «무동작 추출»만 한다.
     main.js 의 히스토리 슬롯 정책(10분 게이트·5슬롯 롤링)과 손상 폴백 후보 순서를 «한 줄도 바꾸지 않고»
     이리로 옮겨 특성화 테스트(tests/unit/snapshot-store.baseline.test.js)로 고정한다.
     그래야 U1 이 정책을 바꿀 때 «무엇이 바뀌었나»가 테스트 diff 로 눈에 보인다.
     — 이 팀 08-25 교훈: 「검증 방식이 버그를 가렸다」. 기준선 없이 낸 초록은 가짜다.

   ★에셋 GC 를 만들려는 사람에게 (읽고 가라)
     스냅샷은 이미지를 «참조»(goya-asset://)로 가진다. assets/ 를 정리하는 코드는 **반드시**
     listReferencedAssets() 의 결과를 제외해야 한다. 안 그러면 과거 버전이 «조용히» 깨진다
     (로드는 되고 그림만 빈다 — 사용자가 알아채는 건 몇 주 뒤다).
     계약은 tests/unit/snapshot-store.gc-contract.test.js 가 지킨다.
═══════════════════════════════════════════════════════════════════════════ */
'use strict';

const fs = require('fs');
const path = require('path');

/* 현행 정책 상수 — main.js 에서 그대로 옮겨왔다(값 무변경). U1 이 여기를 바꾼다. */
const MIN_GAP_MS  = 10 * 60 * 1000; // 직전 슬롯과 이 간격 미만이면 새 스냅샷을 안 만든다
const MAX_SLOTS   = 5;              // 초과분은 가장 오래된 것부터 제거

/* ── 소품 ────────────────────────────────────────────────────────────────── */
function safeSeg(s) {
  const v = String(s || '').replace(/[^\w.-]/g, '_');
  return (v === '' || /^\.+$/.test(v)) ? '_' : v;
}
/** 히스토리 슬롯 파일명 목록(정렬 전 raw). 디렉터리가 없으면 []. */
function readSlotNames(histDir) {
  try {
    if (!fs.existsSync(histDir)) return [];
    return fs.readdirSync(histDir).filter(f => f.endsWith('.json'));
  } catch (_) { return []; }
}

/**
 * 히스토리 슬롯 «계획» — 파일을 건드리지 않고 무엇을 만들고 무엇을 지울지만 결정한다.
 * ★main.js 의 기존 로직을 «의미 무변경»으로 옮긴 것:
 *   - 정렬은 문자열 sort (기존 `slots.sort()` 그대로). epoch 자릿수가 같아 사전순=시간순이다.
 *   - 직전 슬롯 ts 는 마지막 원소의 파일명 parseInt (기존과 동일, 실패 시 0).
 *   - now - lastSlotTs > MIN_GAP_MS 일 때만 생성 (★ > 이지 >= 가 아니다 — 경계를 그대로 보존).
 *   - 생성 «후» 목록이 MAX_SLOTS 를 초과하면 가장 오래된 것부터 제거.
 * @returns {{create:boolean, newName:string|null, deletions:string[], lastSlotTs:number}}
 */
function planLegacySlots(histDir, now, opts = {}) {
  const minGap   = opts.minGapMs != null ? opts.minGapMs : MIN_GAP_MS;
  const maxSlots = opts.maxSlots != null ? opts.maxSlots : MAX_SLOTS;
  const slots = readSlotNames(histDir).sort();
  const lastSlotTs = slots.length > 0 ? (parseInt(slots[slots.length - 1].replace('.json', '')) || 0) : 0;
  if (!(now - lastSlotTs > minGap)) return { create: false, newName: null, deletions: [], lastSlotTs };

  const newName = `${now}.json`;
  // 생성 후 상태를 기준으로 초과분을 센다(기존 코드가 파일을 만든 뒤 readdir 를 다시 하던 것과 동일).
  const after = [...slots, newName].sort();
  const deletions = [];
  while (after.length > maxSlots) deletions.push(after.shift());
  return { create: true, newName, deletions, lastSlotTs };
}

/**
 * 손상 폴백 «후보 순서» — projects:load 가 proj.json 을 못 읽었을 때 훑는 순서.
 * ★main.js 의 GAP-004 체인을 의미 무변경으로 옮긴 것. 순서 자체가 계약이다:
 *   backup → history(신 레이아웃, 최신→오래된) → history(구 flat 레이아웃) → pre-externalize(★맨 끝)
 *   pre-externalize 가 맨 끝인 이유: 변환 시점에 «고정»돼 늙는다. 앞에 두면 한 달 늙은 원본이
 *   최신 백업/히스토리를 이겨 덮어쓰는 데이터손실(F1)이 난다.
 * @param {(id:string)=>string|null} resolveBackupPath  main 의 _resolveBackupJsonPath 주입
 * @returns {{path:string, from:'backup'|'history'|'pre-externalize'}[]}
 */
function loadFallbackCandidates(projectsDir, id, resolveBackupPath) {
  const candidates = [];
  const backupPath = typeof resolveBackupPath === 'function' ? resolveBackupPath(id) : null;
  if (backupPath) candidates.push({ path: backupPath, from: 'backup' });
  for (const histDir of [path.join(projectsDir, id, 'proj_history'), path.join(projectsDir, `${id}_history`)]) {
    try {
      if (fs.existsSync(histDir)) {
        const slots = fs.readdirSync(histDir).filter(f => f.endsWith('.json'))
          .sort((a, b) => (parseInt(b) || 0) - (parseInt(a) || 0)); // 최신 우선
        for (const s of slots) candidates.push({ path: path.join(histDir, s), from: 'history' });
      }
    } catch (_) {}
  }
  try {
    const preExt = path.join(projectsDir, safeSeg(id), 'proj_pre-externalize.json');
    if (fs.existsSync(preExt)) candidates.push({ path: preExt, from: 'pre-externalize' });
  } catch (_) {}
  return candidates;
}

module.exports = {
  MIN_GAP_MS, MAX_SLOTS,
  planLegacySlots, loadFallbackCandidates,
  _internal: { safeSeg, readSlotNames },
};
