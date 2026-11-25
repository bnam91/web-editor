import { propPanel } from '../globals.js';
import { blockHeaderHTML } from './_helpers.js';
import { renderPanel, sec } from './_panel-frame.js';
import { positionSectionHTML, positionHeadToolsHTML } from './_position-section.js';   // 표준 Position 절(시트 222 DS-POSITION-STD-REST-01)

export function showJokerProperties(jb) {
  const isAbsolute = jb.style.position === 'absolute';
  const currentX = isAbsolute
    ? parseInt(jb.style.left || jb.dataset.offsetX || '0')
    : parseInt(jb.dataset.offsetX || '0');
  const currentY = isAbsolute
    ? parseInt(jb.style.top || jb.dataset.offsetY || '0')
    : parseInt(jb.dataset.offsetY || '0');
  const label = jb.dataset.label || 'Joker';

  renderPanel(jb, {
    header: blockHeaderHTML({
      icon: `          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <circle cx="6" cy="6" r="4.5"/>
            <text x="6" y="9" font-size="7" text-anchor="middle" fill="#888" stroke="none">♠</text>
          </svg>`,
      name: jb.dataset.layerName,
      defaultName: label,
      crumb: window.getBlockBreadcrumb?.(jb) || '',
      id: jb.id,
    }),
    /* 표준 Position — 조커는 흐름 안에서도 X/Y «씀»(옛 그대로 translate · 떠 있으면 left/top) = 부품 liveXY · 옛 X/Y 슬라이더 걷음(숫자 칸 id·범위 clamp·키 offsetX/Y 무변) · 회전 없음 */
    sections: [sec('position', positionSectionHTML({ prefix: 'joker', posEl: null, xy: false, liveXY: { xId: 'joker-x-number', yId: 'joker-y-number', x: currentX, y: currentY } }), { headTools: positionHeadToolsHTML({ prefix: 'joker', rotCan: false }) })],
  });

  if (window.setRpIdBadge) window.setRpIdBadge(jb.id || null);

  const xNumber = document.getElementById('joker-x-number');
  const yNumber = document.getElementById('joker-y-number');

  function applyX(v) {
    jb.dataset.offsetX = String(v);
    if (isAbsolute) {
      jb.style.left = `${v}px`;
    } else {
      const y = parseInt(jb.dataset.offsetY || '0');
      jb.style.transform = `translate(${v}px, ${y}px)`;
    }
    window.scheduleAutoSave?.();
  }

  function applyY(v) {
    jb.dataset.offsetY = String(v);
    if (isAbsolute) {
      jb.style.top = `${v}px`;
    } else {
      const x = parseInt(jb.dataset.offsetX || '0');
      jb.style.transform = `translate(${x}px, ${v}px)`;
    }
    window.scheduleAutoSave?.();
  }

  xNumber.addEventListener('input', () => {
    const v = Math.min(860, Math.max(0, parseInt(xNumber.value) || 0));
    applyX(v);
  });
  xNumber.addEventListener('change', () => { window.pushHistory?.(); });

  yNumber.addEventListener('input', () => {
    const v = Math.min(500, Math.max(-500, parseInt(yNumber.value) || 0));
    applyY(v);
  });
  yNumber.addEventListener('change', () => { window.pushHistory?.(); });
}

window.showJokerProperties = showJokerProperties;
