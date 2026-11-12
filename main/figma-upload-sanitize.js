/* figma-upload-sanitize — figma:upload 가 변환기(별 node 프로세스)에 넘길 designJSON 에서 file:// 를 main 이 «먼저» 거른다
 *   (SEC-FIGMA-UPLOAD-FILE-READ-01 · Codex 감사 ④ 261112)
 *   ★변환기는 file:// 를 받으면 그 경로를 그대로 읽어 base64 로 WS 에 실었다(auth.json 도).
 *   ⇒ main 이 JSON 의 «모든» 문자열을 훑어 file:// 를:
 *       허용 루트(앱 폴더 — 목업 기기 프레임 PNG 가 여기서 온다) 안 · 이미지 확장자 · realpath 도 안쪽 → main 이 읽어 data: 로 바꿔 넘김
 *       그 밖 → '' (변환기는 빈 칸을 «그림 없음»으로 그린다)
 *   변환기 쪽도 file:// 를 더는 읽지 않는다(이중 벽 · figma-renderer/sangpe_to_figma.mjs). */
const fs = require('fs');
const path = require('path');
const { fileURLToPath } = require('url');

const MIME = { '.png': 'image/png', '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.webp': 'image/webp', '.gif': 'image/gif', '.svg': 'image/svg+xml' };
const MAX = 20 * 1024 * 1024;

function _inside(p, root) {
  const rel = path.relative(root, p);
  return !!rel && !rel.startsWith('..') && !path.isAbsolute(rel);
}

/** file:// 하나 → data: 또는 ''. */
function fileUrlToDataUri(src, roots) {
  try {
    const p = fileURLToPath(new URL(src));
    const mime = MIME[path.extname(p).toLowerCase()];
    if (!mime) return '';
    const rp = fs.realpathSync(p);
    if (!roots.some((r) => { try { return _inside(rp, fs.realpathSync(r)); } catch (_) { return false; } })) return '';
    const st = fs.statSync(rp);
    if (!st.isFile() || st.size > MAX) return '';
    return `data:${mime};base64,${fs.readFileSync(rp).toString('base64')}`;
  } catch (_) { return ''; }
}

/** designJSON 을 제자리에서 고친다. 반환 = { converted, dropped } 수. */
function sanitizeFigmaDesign(json, roots) {
  const n = { converted: 0, dropped: 0 };
  const walk = (o) => {
    if (!o || typeof o !== 'object') return;
    for (const k of Object.keys(o)) {
      const v = o[k];
      if (typeof v === 'string' && /^\s*file:/i.test(v)) {
        const d = fileUrlToDataUri(v.trim(), roots);
        o[k] = d;
        n[d ? 'converted' : 'dropped']++;
      } else if (v && typeof v === 'object') walk(v);
    }
  };
  walk(json);
  return n;
}

module.exports = { sanitizeFigmaDesign, fileUrlToDataUri };
