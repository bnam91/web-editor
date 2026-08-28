#!/usr/bin/env node
/* SCHEMA 2→3 강제 재빌드 실측 — 「시연에서 첫 열람이 몇 초 멈추나」에 답한다.
 * 사용: node tools/schema3-rebuild-probe.js [총MB] [슬롯수]
 * ★시간 단언을 테스트에 넣지 않는다(기계마다 다르고 조용히 무력해진다). 이건 «판단 재료»다.
 */
'use strict';
const fs = require('fs'), os = require('os'), path = require('path');
const SS = require('../main/project-store/snapshot-store');

const TOTAL_MB = Number(process.argv[2] || 283);
const SLOTS = Number(process.argv[3] || 5);
const root = fs.mkdtempSync(path.join(os.tmpdir(), 'goya-s3probe-'));
process.on('exit', () => { try { fs.rmSync(root, { recursive: true, force: true }); } catch (_) {} });

const PNG = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==';
const id = 'proj_safebon';
const hd = path.join(root, id, 'proj_history');
fs.mkdirSync(hd, { recursive: true });

/** 레거시 슬롯 1개 — 인라인 base64 이미지가 들어간 «옛 형식»(canon=0). */
function legacyCanvas(targetBytes, tag) {
  const parts = [];
  let n = 0;
  const bigB64 = PNG.repeat(900);            // ≈ 90KB/장
  while (parts.join('').length < targetBytes) {
    parts.push(`<div class="section-block" id="sec_${tag}_${n}" data-name="섹션 ${n}">`
      + `<img src="data:image/png;base64,${bigB64}">`
      + `<p>${'상세 설명 문구 '.repeat(60)}</p></div>`);
    n++;
  }
  return { html: parts.join(''), sections: n };
}
const perSlot = Math.floor((TOTAL_MB * 1024 * 1024) / SLOTS);
let sections = 0;
const t0 = Date.now();
for (let i = 0; i < SLOTS; i++) {
  const c = legacyCanvas(perSlot, i);
  sections = c.sections;
  fs.writeFileSync(path.join(hd, `${1787000000000 + i * 86400000}.json`), JSON.stringify({
    id, name: '세이프본 카피', version: 2, currentPageId: 'page_1',
    pages: [{ id: 'page_1', name: 'Page 1', canvas: c.html }],
  }));
}
const cur = legacyCanvas(Math.floor(perSlot * 0.9), 'cur');
fs.writeFileSync(path.join(root, id, 'proj.json'), JSON.stringify({
  id, name: '세이프본 카피', version: 2, currentPageId: 'page_1',
  pages: [{ id: 'page_1', name: 'Page 1', canvas: cur.html }],
}));
const bytes = fs.readdirSync(hd).reduce((s, f) => s + fs.statSync(path.join(hd, f)).size, 0)
            + fs.statSync(path.join(root, id, 'proj.json')).size;
console.log(`픽스처 준비  슬롯 ${SLOTS}개 · 섹션 ${sections}/슬롯 · 합계 ${(bytes / 1048576).toFixed(0)}MB · ${Date.now() - t0}ms`);
console.log(`예산: REBUILD_BYTE_BUDGET=120MB · LEGACY_RAW_MAX=8MB`);

// ── ① SCHEMA 2 인덱스가 «이미 있는» 상태를 만든다(현빈 실데이터가 그 상태다) ──
const idx2 = { v: 2, projectId: id, entries: fs.readdirSync(hd).filter(f => /^\d+\.json$/.test(f)).map(f => ({
  ts: parseInt(f), file: f, reason: 'auto', pinned: false, canon: 0,
  bytes: fs.statSync(path.join(hd, f)).size, name: '세이프본 카피', counts: null, secs: [], assets: [],
})), current: null };
fs.writeFileSync(path.join(hd, 'index.json'), JSON.stringify(idx2));

function measure(label) {
  const t = process.hrtime.bigint();
  const r = SS.listVersions(root, id);
  const ms = Number(process.hrtime.bigint() - t) / 1e6;
  const pend = r.entries.filter(e => e.pending).length;
  console.log(`${label.padEnd(26)} ${ms.toFixed(0).padStart(6)}ms  버전 ${r.entries.length}개 · 미분석 ${pend} · current ${r.current ? '있음' : '없음'}`);
  return { ms, r };
}
console.log('');
const a = measure('① 첫 열람(SCHEMA 재빌드)');
const b = measure('② 두 번째 열람');
const c = measure('③ 세 번째 열람');
console.log('');
console.log(`★시연 판단: 첫 열람 ${a.ms.toFixed(0)}ms · 이후 ${Math.max(b.ms, c.ms).toFixed(0)}ms`);
if (a.r.entries.some(e => e.pending)) {
  console.log('  ⚠️예산 초과분이 «미분석»으로 남는다 — 목록엔 뜨지만 손실 비교는 그 행에서 「아직 분석 안 함」이다.');
  console.log('     열 때마다 예산만큼 더 채워지는 설계([F7])라 ②③ 이 계속 비용을 낸다 — 위 숫자로 확인하라.');
}
