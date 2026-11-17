/* 앱 동봉 에셋 경로 가드 (1013t2A4) — IPC assets:readBundled 가 쓴다.
 * 에셋 트리 노드의 `bundled`(앱 루트 상대 경로, 예: 'assets/textures/paper/paper-01.jpg')를
 * 앱 폴더 안의 실제 파일 경로로 바꾼다. ★assets/textures/·assets/library/(0.9.13 내장 라이브러리) 밖·이미지 아닌 확장자는 거절한다
 * (렌더러가 보낸 문자열로 앱 폴더의 아무 파일이나 읽히지 않게).
 * 순수 함수 — electron 을 안 쓴다(유닛 검사: tests/unit/texture-paper-seed.test.mjs). */
'use strict';
const path = require('path');

const BUNDLED_MIME = {
  jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp',
  gif: 'image/gif', svg: 'image/svg+xml',
};

const SAFE_DIRS = ['textures', 'library'];   // assets/ 아래 읽어도 되는 폴더(앱 동봉 그림만)

function resolveBundledAsset(appRoot, rel) {
  if (!appRoot || typeof rel !== 'string' || !rel) return { ok: false, error: 'bundled 필수' };
  if (path.isAbsolute(rel) || rel.includes('\0')) return { ok: false, error: 'path traversal' };
  const full = path.join(appRoot, rel);
  if (!SAFE_DIRS.some((d) => full.startsWith(path.join(appRoot, 'assets', d) + path.sep))) return { ok: false, error: 'path traversal' };
  const ext = path.extname(full).slice(1).toLowerCase();
  const mime = BUNDLED_MIME[ext];
  if (!mime) return { ok: false, error: 'not_image' };
  return { ok: true, full, mime };
}

module.exports = { resolveBundledAsset, BUNDLED_MIME };
