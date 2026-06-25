import { canvasEl, state } from '../globals.js';

const CANVAS_W = 860;

/* ── goya-asset:// → base64 data URI 재인라인 ──────────────────────────
 * 이미지 외부화 이후 라이브 DOM의 이미지는 `goya-asset://<id>/<hash>.<ext>`
 * 커스텀 프로토콜 참조다. 이 프로토콜은 앱(Electron) 안에서만 해석되므로,
 * 내보낸 단독 HTML을 일반 브라우저에서 열면 이미지가 깨진다.
 * → export 전에 clone을 순회하며 모든 goya-asset:// 참조(style background-image,
 *   <img src>, data-* 속성)를 fetch해 base64 data: URI로 되돌려 파일을 portable하게 만든다.
 *   (goya-asset 프로토콜은 supportFetchAPI:true 이므로 렌더러 fetch가 동작)
 *   기존 data:image 는 그대로 둔다. fetch 실패 시 해당 URL은 건드리지 않고 넘어간다(견고성).
 * ───────────────────────────────────────────────────────────────────── */
function _isGoyaAsset(url) {
  return typeof url === 'string' && url.indexOf('goya-asset://') !== -1;
}

function _extractUrl(cssOrUrl) {
  // url("...") 형태와 raw URL 둘 다 처리
  const m = (cssOrUrl || '').match(/url\(["']?([^"')]+)["']?\)/);
  return m ? m[1] : cssOrUrl;
}

async function _goyaAssetToDataUri(url) {
  const res = await fetch(url);
  if (!res.ok) throw new Error('asset fetch failed: ' + res.status);
  const blob = await res.blob();
  return await new Promise((resolve, reject) => {
    const fr = new FileReader();
    fr.onload  = () => resolve(fr.result); // data:<mime>;base64,....
    fr.onerror = reject;
    fr.readAsDataURL(blob);
  });
}

// clone 내 모든 goya-asset:// 참조를 base64 data URI로 변환 (중복 URL은 1회만 fetch)
async function inlineGoyaAssets(root) {
  const cache = new Map(); // url → dataURI (실패 시 null)
  const resolve = async (url) => {
    if (cache.has(url)) return cache.get(url);
    let data = null;
    try { data = await _goyaAssetToDataUri(url); }
    catch (err) { console.warn('[export-html] asset 인라인 실패, URL 유지:', url, err); }
    cache.set(url, data);
    return data;
  };

  // 1) style background-image
  for (const el of root.querySelectorAll('[style*="background-image"]')) {
    const raw = _extractUrl(el.style.backgroundImage);
    if (!_isGoyaAsset(raw)) continue;
    const data = await resolve(raw);
    if (data) el.style.backgroundImage = `url("${data}")`;
  }

  // 2) <img src>
  for (const im of root.querySelectorAll('img')) {
    const src = im.getAttribute('src') || '';
    if (!_isGoyaAsset(src)) continue;
    const data = await resolve(src);
    if (data) im.setAttribute('src', data);
  }

  // 3) data-bg-img / data-img-src 등 goya-asset URL을 담은 모든 data-* 속성
  for (const el of root.querySelectorAll('[data-bg-img], [data-img-src]')) {
    for (const attr of ['data-bg-img', 'data-img-src']) {
      const v = el.getAttribute(attr);
      if (!_isGoyaAsset(v)) continue;
      const data = await resolve(v);
      if (data) el.setAttribute(attr, data);
    }
  }
}

async function exportHTMLFile() {
  // 이미지 외부화 이후: lazy 언로드 섹션이 빈 상태로 직렬화되지 않도록 복원
  if (window.materializeAllSections) window.materializeAllSections();

  // canvas clone — 에디터 UI 요소 제거
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.section-label, .section-toolbar, .col-placeholder, .col-add-btn, .col-add-menu, .row-col-add-btn, .row-drop-indicator, .layer-section-drop-indicator').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

  // goya-asset:// 참조를 base64로 재인라인 → 내보낸 HTML이 일반 브라우저에서도 portable
  await inlineGoyaAssets(clone);

  const fontLink = `<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700&family=Noto+Serif+KR:wght@400;600;700&family=Inter:wght@400;600;700&family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@400;600;700&display=swap" rel="stylesheet">`;

  const bg = state.pageSettings.bg || '#ffffff';
  const css = `
*{box-sizing:border-box;margin:0;padding:0;}
body{background:${bg};font-family:'Noto Sans KR',sans-serif;}
#canvas{width:${CANVAS_W}px;margin:0 auto;}
/* layout */
.section-block{position:relative;width:100%;}
.section-inner{display:flex;flex-direction:column;}
.row{position:relative;display:flex;width:100%;}
.row[data-layout="stack"]{flex-direction:column;}
.row[data-layout="flex"]{flex-direction:row;gap:8px;align-items:stretch;}
.row[data-layout="grid"]{display:grid;gap:8px;}
.col{position:relative;min-width:0;display:flex;flex-direction:column;}
.col[data-width="100"]{flex:100;}
.col[data-width="75"]{flex:75;}
.col[data-width="66"]{flex:66;}
.col[data-width="50"]{flex:50;}
.col[data-width="33"]{flex:33;}
.col[data-width="25"]{flex:25;}
/* gap */
.gap-block{display:block;width:100%;}
/* text */
.text-block{width:100%;}
.tb-h1{font-size:104px;font-weight:700;color:#111;line-height:1.1;letter-spacing:-0.02em;}
.tb-h2{font-size:72px;font-weight:600;color:#1a1a1a;line-height:1.15;}
.tb-body{font-size:36px;color:#555;line-height:1.6;}
.tb-caption{font-size:26px;color:#999;line-height:1.6;letter-spacing:0.01em;}
.tb-label{display:inline-block;background:#111;color:#fff;font-size:22px;font-weight:600;padding:6px 18px;border-radius:4px;}
/* speech bubble */
.speech-bubble-block{position:relative;display:block;max-width:80%;}
.speech-bubble-block[data-tail="right"]{margin-left:auto;}
.tb-bubble{background:#e5e5ea;color:#1c1c1e;border-radius:20px;padding:10px 16px;font-size:16px;line-height:1.5;position:relative;display:inline-block;min-width:60px;word-break:break-word;}
.speech-bubble-block .tb-bubble::before{content:'';position:absolute;bottom:0;width:20px;height:16px;}
.speech-bubble-block[data-tail="left"] .tb-bubble::before{left:-8px;background:var(--bubble-bg,#e5e5ea);clip-path:polygon(100% 0,100% 100%,0 100%);}
.speech-bubble-block[data-tail="right"] .tb-bubble::before{right:-8px;background:var(--bubble-bg,#e5e5ea);clip-path:polygon(0 0,0 100%,100% 100%);}
/* asset */
.asset-block{width:100%;display:flex;flex-direction:column;align-items:center;justify-content:center;overflow:hidden;position:relative;}
.asset-block .asset-icon,.asset-block .asset-label{display:none;}
.asset-block.has-image{overflow:hidden;}
.asset-block.has-image img{display:block;max-width:100%;height:auto;}
/* group */
.group-block{width:100%;}
.group-inner{display:flex;flex-direction:column;}
/* graph */
.graph-block{width:100%;overflow:hidden;}
.grb-inner{display:flex;flex-direction:column;height:100%;}
.grb-bars{display:flex;align-items:flex-end;gap:8px;flex:1;padding:16px;}
.grb-bar-col{display:flex;flex-direction:column;align-items:center;flex:1;}
.grb-bar-wrap{flex:1;display:flex;align-items:flex-end;width:100%;}
.grb-bar-fill{width:100%;background:#2d6fe8;}
.grb-bar-label{font-size:20px;color:#555;margin-top:4px;text-align:center;}
.grb-bar-val-label{font-size:18px;font-weight:600;color:#2d6fe8;margin-bottom:2px;}
/* label-group */
.label-group-block{width:100%;display:flex;flex-wrap:wrap;gap:10px;padding:16px;}
.label-item{display:inline-flex;align-items:center;padding:8px 20px;border-radius:40px;font-size:24px;}
/* table */
.table-block{width:100%;overflow:hidden;}
.tb-table{width:100%;border-collapse:collapse;font-size:28px;}
.tb-table th,.tb-table td{padding:10px 16px;border:1px solid #e0e0e0;text-align:center;}
.tb-table thead th{background:#f5f5f5;font-weight:600;}
`;

  const html = `<!DOCTYPE html>
<html lang="ko">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Export</title>
${fontLink}
<style>${css}</style>
</head>
<body>
<div id="canvas">
${clone.innerHTML}
</div>
</body>
</html>`;

  const blob = new Blob([html], { type: 'text/html' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = 'export.html';
  a.click();
  URL.revokeObjectURL(a.href);
}

/* ── Publish Dropdown ── */

window.exportHTMLFile = exportHTMLFile;
