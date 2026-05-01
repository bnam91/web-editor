import { canvasEl, state } from '../globals.js';

const CANVAS_W = 860;

function exportHTMLFile() {
  // canvas clone — 에디터 UI 요소 제거
  const clone = canvasEl.cloneNode(true);
  clone.querySelectorAll('.section-label, .section-toolbar, .col-placeholder, .col-add-btn, .col-add-menu, .row-col-add-btn, .row-drop-indicator, .layer-section-drop-indicator').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable]').forEach(el => el.removeAttribute('contenteditable'));
  clone.querySelectorAll('.selected').forEach(el => el.classList.remove('selected'));
  clone.querySelectorAll('.dragging').forEach(el => el.classList.remove('dragging'));

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
/* card */
.card-block{width:100%;overflow:hidden;display:flex;flex-direction:column;}
.cdb-image{width:100%;overflow:hidden;flex:1;}
.cdb-image img{display:block;width:100%;height:100%;object-fit:cover;}
.cdb-body{padding:16px;}
.cdb-title{font-size:32px;font-weight:600;color:#111;}
.cdb-desc{font-size:24px;color:#555;margin-top:6px;}
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
