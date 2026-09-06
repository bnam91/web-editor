#!/usr/bin/env node
/*
 * 배포 하드 게이트 — release:mac / release:win 앞에서 실행된다(package.json).
 * 레포 루트에 DEPLOY-BLOCK.md 가 존재하면 배포를 «중단»한다.
 * 「읽어야 아는 규칙」이 아니라 「안 지키면 배포가 실패하는 구조」로 막는 것이 목적.
 * 해제: DEPLOY-BLOCK.md 의 해제조건을 충족한 뒤 그 파일을 삭제한다.
 */
const fs = require('fs');
const path = require('path');

const block = path.join(__dirname, '..', 'DEPLOY-BLOCK.md');
if (fs.existsSync(block)) {
  process.stderr.write('\n⛔  배포 차단 — DEPLOY-BLOCK.md 가 존재합니다. release/publish 를 중단합니다.\n\n');
  try { process.stderr.write(fs.readFileSync(block, 'utf8') + '\n'); } catch (_) {}
  process.stderr.write('\n해제: 위 해제조건을 충족한 뒤 DEPLOY-BLOCK.md 를 삭제하세요.\n\n');
  process.exit(1);
}

/* ── 자격증명 서명 릴리스 게이트 (2026-09-06 신설) ──────────────────────────
 * 왜 여기냐: 이 두 상수는 «개발 중엔 틀려도 되고, 배포되면 안 되는» 값이다.
 *   단위검사에 걸면 개발이 매일 빨강이 되고, 주석으로 두면 아무것도 안 막는다.
 *   실제로 entitlement.test.mjs ⓡ 는 `typeof KEY_PROVENANCE === 'string'` 이라
 *   'unverified-…' 를 «그대로 통과»시키고 있었다 — 검사처럼 생긴 문장이었다.
 * ⛔이 게이트는 «우리 릴리스»만 막는다. 사용자 쪽은 아무것도 안 잠근다.
 */
try {
  const E = require('../services/entitlement.js');
  const fails = [];

  /* ⑴ 공개키 출처 — 앱에 박은 키가 «라이브 서버의 그 키»인지 대조됐는가.
   *   안 맞으면 모든 서명이 실패한다 = 전 사용자가 재검증 화면으로 간다.
   *   방향이 최악인 실수라 배포 전에 «사람이 한 번 대조»했다는 표식을 요구한다. */
  const prov = String(E.KEY_PROVENANCE || '');
  if (!/^verified-\d{4}-\d{2}-\d{2}$/.test(prov)) {
    fails.push(
      `공개키 출처가 대조 안 됨 — KEY_PROVENANCE = "${prov}"\n` +
      '     라이브 서버(EC2 /etc/goditor-api/env)에서 publicKeyPem() 을 1회 뽑아\n' +
      '     services/entitlement.js 의 PUBLIC_KEYS.k1 과 «바이트 대조»한 뒤\n' +
      "     KEY_PROVENANCE 를 'verified-YYYY-MM-DD' 로 바꾸세요.\n" +
      '     ★대조 전에 배포하면 키가 어긋났을 때 전 사용자가 잠깁니다.');
  }

  /* ⑵ 서명 없는 옛 auth.json 유예 마감 — 「릴리스일 + GRACE_DAYS」여야 한다.
   *   이 값이 이미 지났거나 코앞이면, 업그레이드해 온 옛 사용자가 받기로 한
   *   유예를 «못 받는다». 상수는 안 늙는데 날짜는 늙는다. */
  const deadline = Date.parse(E.CONSTANTS.SIGLESS_GRACE_UNTIL);
  const graceMs = E.CONSTANTS.GRACE_DAYS * 24 * 60 * 60 * 1000;
  const left = deadline - Date.now();
  if (!Number.isFinite(deadline)) {
    fails.push(`SIGLESS_GRACE_UNTIL 이 ISO 날짜가 아님 — "${E.CONSTANTS.SIGLESS_GRACE_UNTIL}"`);
  } else if (left < graceMs) {
    const days = Math.floor(left / 86400000);
    fails.push(
      `서명없음 유예 마감이 너무 가까움 — SIGLESS_GRACE_UNTIL 까지 ${days}일 ` +
      `(GRACE_DAYS=${E.CONSTANTS.GRACE_DAYS}일 이상이어야 함)\n` +
      '     옛 auth.json 사용자가 받기로 한 유예를 못 받습니다.\n' +
      '     릴리스일 + GRACE_DAYS 로 갱신하세요.');
  }

  if (fails.length) {
    process.stderr.write('\n⛔  배포 차단 — 자격증명 서명 게이트\n\n');
    fails.forEach((f, i) => process.stderr.write(`  ${i + 1}) ${f}\n\n`));
    process.exit(1);
  }
} catch (err) {
  /* ★검사 자체가 못 돌았다 = 「통과」가 아니다. 막는다. */
  process.stderr.write('\n⛔  배포 차단 — 자격증명 게이트를 «실행하지 못했습니다»\n');
  process.stderr.write(`     ${err && err.message}\n`);
  process.stderr.write('     검사가 못 돈 것은 통과가 아닙니다. 원인을 고친 뒤 다시 시도하세요.\n\n');
  process.exit(1);
}
