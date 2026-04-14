import { canvasEl, state } from '../globals.js';

const CANVAS_W = 860;

// cvb(canvas-block)의 CSS transform:scale()을 실제 px 값으로 평탄화
// html2canvas는 transform:scale() 안쪽 background-image를 잘못 렌더링함
function flattenCvbTransform(cvbEl) {
  const inner = cvbEl.querySelector('.cvb-inner');
  if (!inner) return;
  const match = (inner.style.transform || '').match(/scale\(([^)]+)\)/);
  if (!match) return;
  const s = parseFloat(match[1]);
  if (!s || s === 1) return;

  const scalePx = (style, props) => props.forEach(p => {
    const v = parseFloat(style[p]);
    if (!isNaN(v) && style[p]) style[p] = (v * s) + 'px';
  });

  Array.from(inner.children).forEach(cell => {
    scalePx(cell.style, ['left', 'top', 'width', 'height', 'borderRadius']);
    Array.from(cell.children).forEach(child => {
      scalePx(child.style, ['left', 'top', 'width', 'height',
        'paddingTop', 'paddingRight', 'paddingBottom', 'paddingLeft',
        'gap', 'borderRadius', 'fontSize']);
      child.querySelectorAll('[style]').forEach(el =>
        scalePx(el.style, ['fontSize', 'left', 'top', 'width', 'height', 'lineHeight', 'gap', 'borderRadius'])
      );
    });
  });

  inner.style.width     = (parseFloat(inner.style.width)  * s) + 'px';
  inner.style.height    = (parseFloat(inner.style.height) * s) + 'px';
  inner.style.transform = 'none';
  cvbEl.style.height    = inner.style.height;
}

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

  // cvb(canvas-block): renderCanvas로 scale 재계산 후 transform 평탄화
  // html2canvas가 transform:scale() 내부 background-image를 잘못 렌더링하므로
  // 실제 px 값으로 변환하여 transform 제거
  clone.querySelectorAll('.canvas-block[data-card-mode]').forEach(cb => {
    if (window.renderCanvas) {
      window.renderCanvas(cb);
      if (cb._cvbRO) { cb._cvbRO.disconnect(); cb._cvbRO = null; }
    }
    flattenCvbTransform(cb);

    // html2canvas는 transform:scale() 내부의 background-image를 렌더링 못 함
    // background-image div → <img> 태그로 변환하여 정상 렌더링
    const inner = cb.querySelector('.cvb-inner');
    if (inner) {
      inner.querySelectorAll('[style*="background-image"]').forEach(div => {
        const bg = div.style.backgroundImage;
        const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!match) return;
        const posX = div.style.backgroundPositionX || '50%';
        const posY = div.style.backgroundPositionY || '50%';
        div.style.backgroundImage = '';
        div.style.position = div.style.position || 'relative';
        div.style.overflow = 'hidden';
        const imgEl = document.createElement('img');
        imgEl.src = match[1];
        imgEl.style.cssText = `position:absolute;inset:0;width:100%;height:100%;object-fit:cover;object-position:${posX} ${posY};display:block;`;
        div.appendChild(imgEl);
      });
    }
  });
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
