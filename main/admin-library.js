/* 관리자 로컬 라이브러리 폴더 가드 (LIB-FIGMA · 261118) — IPC adminLibrary:list / adminLibrary:read 가 쓴다.
 * 자리 = <userData>/admin-library/<dir>/[<묶음>/]<file> — asar·레포 밖이라 배포본엔 없고, 앱 업데이트에도 남으며, 관리자 맥에만 복사된다.
 * 읽어도 되는 것 = 명부(DIRS)의 dir 안 · 그 dir 이 정한 확장자만 · 심링크로 밖에 나가면 거절(realpath).
 * 순수 함수 — electron 을 안 쓴다(유닛 검사: tests/unit/admin-library.test.mjs). 관리자 판정은 main.js 문지기 몫.
 */
'use strict';
const fs = require('fs');
const path = require('path');

/* dir → 읽을 확장자 · 묶음(하위 폴더 한 층) 허용 여부. js/data/builtin-library.js ADMIN_LOCAL 과 같은 dir 이어야 한다(유닛 A6). */
const DIRS = {
  'doodle-figma-191-38': { ext: ['svg'], nested: false },
  'arrow-figma-191-2': { ext: ['svg'], nested: false },
  'memoji-inclusive-192-2': { ext: ['webp'], nested: true },   // PNG 원본은 admin-library-prep.cjs 로 webp 를 옆에 만든 뒤 webp 만
};
const MIME = { svg: 'image/svg+xml', webp: 'image/webp' };
const SEG = /^[\w.-]+$/;   // 폴더·파일 이름 한 마디 — 경로 문자·공백·`..` 는 아래서 따로 막는다

const _ext = (f) => path.extname(f).slice(1).toLowerCase();
const _real = (p) => { try { return fs.realpathSync(p); } catch { return null; } };
const _inside = (child, parent) => child === parent || child.startsWith(parent + path.sep);

/** 명부 dir 마다 파일 목록 { dirs: { <dir>: ['a.svg' | 'Frame_1/x.webp', …] } } · 폴더 없으면 dirs = {} (탭 0). */
function listAdminLibrary(root) {
  const out = { dirs: {} };
  const rootReal = root && _real(root);
  if (!rootReal) return out;
  for (const [dir, rule] of Object.entries(DIRS)) {
    const base = _real(path.join(rootReal, dir));
    if (!base || !_inside(base, rootReal) || !fs.statSync(base).isDirectory()) continue;
    const files = [];
    for (const e of fs.readdirSync(base, { withFileTypes: true })) {
      if (e.isFile() && rule.ext.includes(_ext(e.name)) && SEG.test(e.name)) files.push(e.name);
      else if (e.isDirectory() && rule.nested && SEG.test(e.name)) {
        for (const f of fs.readdirSync(path.join(base, e.name), { withFileTypes: true })) {
          if (f.isFile() && rule.ext.includes(_ext(f.name)) && SEG.test(f.name)) files.push(`${e.name}/${f.name}`);
        }
      }
    }
    if (files.length) out.dirs[dir] = files.sort((a, b) => a.localeCompare(b, 'en', { numeric: true }));
  }
  return out;
}

/** (root, dir, file) → { ok, full, mime, ext } | { ok:false, error } — file 은 'x.svg' 또는 (nested 면) '묶음/x.webp'. */
function resolveAdminLibraryFile(root, dir, file) {
  const rule = Object.prototype.hasOwnProperty.call(DIRS, dir) ? DIRS[dir] : null;
  if (!root || !rule) return { ok: false, error: 'unknown_dir' };
  if (typeof file !== 'string' || !file || file.includes('\0')) return { ok: false, error: 'path traversal' };
  const parts = file.split('/');
  if (parts.length > (rule.nested ? 2 : 1) || parts.some((s) => !SEG.test(s) || s === '.' || s === '..')) return { ok: false, error: 'path traversal' };
  const ext = _ext(file);
  if (!rule.ext.includes(ext)) return { ok: false, error: 'not_image' };
  const rootReal = _real(root);
  const full = rootReal && _real(path.join(rootReal, dir, ...parts));
  if (!full) return { ok: false, error: 'not_found' };
  const baseReal = _real(path.join(rootReal, dir));
  if (!baseReal || !_inside(baseReal, rootReal) || !_inside(full, baseReal)) return { ok: false, error: 'path traversal' };   // 심링크로 밖
  return { ok: true, full, mime: MIME[ext], ext };
}

module.exports = { DIRS, listAdminLibrary, resolveAdminLibraryFile };
