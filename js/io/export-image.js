import { canvasEl, state } from '../globals.js';

const CANVAS_W = 860;

async function exportSection(sec, format, width) {
  const fmt = format || 'png';
  const w   = width  || CANVAS_W;

  // 클론을 transform 밖(body)에 배치해서 html2canvas가 부모 scale 영향 안 받게 함
  const clone = sec.cloneNode(true);
  const cloneLabel   = clone.querySelector('.section-label');
  const cloneToolbar = clone.querySelector('.section-toolbar');
  if (cloneLabel)   cloneLabel.remove();
  if (cloneToolbar) cloneToolbar.remove();
  clone.querySelectorAll('.variation-badge').forEach(el => el.remove());
  clone.classList.remove('selected');
  clone.style.cssText += ';position:fixed;top:-99999px;left:0;width:' + w + 'px;margin:0;outline:none;';

  document.body.appendChild(clone);

  // cvb(canvas-block) 재렌더링 — clone이 860px 컨테이너에 붙은 후
  // applyScale()이 block.offsetWidth 기준으로 재계산되어야 올바른 scale 적용
  clone.querySelectorAll('.canvas-block[data-card-mode]').forEach(cb => {
    if (window.renderCanvas) {
      window.renderCanvas(cb);
      // 정적 export용 clone이므로 ResizeObserver는 즉시 해제
      if (cb._cvbRO) { cb._cvbRO.disconnect(); cb._cvbRO = null; }
    }
  });
  // scale 스타일 적용을 위해 레이아웃 플러시
  clone.getBoundingClientRect();

  const secBg   = sec.style.background || sec.style.backgroundColor || '';
  const bgColor = (secBg && secBg !== 'transparent') ? secBg : (state.pageSettings.bg || '#ffffff');

  try {
    const canvas = await html2canvas(clone, {
      scale: 1,
      useCORS: true,
      backgroundColor: bgColor,
      logging: false,
    });

    const secList = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
    const idx     = secList.indexOf(sec) + 1;
    const name    = (sec._name || `section-${String(idx).padStart(2,'0')}`).replace(/\s+/g, '-');

    canvas.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a   = document.createElement('a');
      a.href = url;
      a.download = `${name}.${fmt}`;
      a.click();
      URL.revokeObjectURL(url);
    }, fmt === 'jpg' ? 'image/jpeg' : 'image/png', 0.95);

  } finally {
    document.body.removeChild(clone);
  }
}

async function exportAllSections(format, width) {
  const sections = [...canvasEl.querySelectorAll('.section-block:not([data-ghost])')];
  for (const sec of sections) {
    await exportSection(sec, format, width);
    await new Promise(r => setTimeout(r, 300));
  }
}

window.exportSection     = exportSection;
window.exportAllSections = exportAllSections;
