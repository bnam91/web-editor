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

  // % 값은 건드리지 않음 (parseFloat("100%") = 100으로 잘못 변환되는 버그 방지)
  const scalePx = (style, props) => props.forEach(p => {
    if (!style[p] || style[p].includes('%')) return;
    const v = parseFloat(style[p]);
    if (!isNaN(v)) style[p] = (v * s) + 'px';
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
  // forEach 대신 for...of 사용 (내부에서 await 필요)
  for (const cb of clone.querySelectorAll('.canvas-block[data-card-mode]')) {
    if (window.renderCanvas) {
      window.renderCanvas(cb);
      if (cb._cvbRO) { cb._cvbRO.disconnect(); cb._cvbRO = null; }
    }
    flattenCvbTransform(cb);

    // html2canvas는 transform:scale() 내부의 background-image를 렌더링 못 함
    // background-image div → <canvas>로 직접 drawImage (html2canvas가 canvas 태그는 완벽 지원)
    const inner = cb.querySelector('.cvb-inner');
    if (inner) {
      // 에디터 UI 오버레이 제거 (선택 표시 등 pointer-events:none + z-index 요소)
      // html2canvas가 inset:0 CSS shorthand를 잘못 처리하여 오버레이가 이미지를 가림
      inner.querySelectorAll('[style*="pointer-events: none"]').forEach(el => el.remove());

      const bgDivs = [...inner.querySelectorAll('[style*="background-image"]')];
      for (const div of bgDivs) {
        const bg = div.style.backgroundImage;
        const match = bg.match(/url\(["']?([^"')]+)["']?\)/);
        if (!match) continue;

        const divW = div.offsetWidth  || 400;
        const divH = div.offsetHeight || 300;

        // <canvas>로 직접 drawImage → html2canvas가 canvas 태그는 완벽 지원
        const cvs = document.createElement('canvas');
        cvs.width  = divW;
        cvs.height = divH;
        const ctx2 = cvs.getContext('2d');

        const imgObj = new Image();
        imgObj.src = match[1];
        await new Promise(res => { imgObj.onload = imgObj.onerror = res; });

        // background-size:cover 수동 계산
        const scale = Math.max(divW / imgObj.naturalWidth, divH / imgObj.naturalHeight);
        const sw = imgObj.naturalWidth  * scale;
        const sh = imgObj.naturalHeight * scale;
        // background-position을 % → px offset으로 변환
        const px = parseFloat(div.style.backgroundPositionX) || 50;
        const py = parseFloat(div.style.backgroundPositionY) || 50;
        const ox = -((sw - divW) * px / 100);
        const oy = -((sh - divH) * py / 100);
        ctx2.drawImage(imgObj, ox, oy, sw, sh);

        cvs.style.cssText = 'display:block;';
        div.style.backgroundImage = '';
        // div 내용을 canvas로 교체
        div.innerHTML = '';
        div.appendChild(cvs);
      }
    }
  }

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
