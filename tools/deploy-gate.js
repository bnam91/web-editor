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
