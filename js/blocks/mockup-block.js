// ── Device Mockup Block ───────────────────────────────────────────────────────
// 모바일/태블릿/데스크탑 디바이스 프레임 + 화면 스크린샷 합성 블록.
// 디바이스 정의는 window.MOCKUP_DEVICES (별도 파일) 에서 주입.
//
// 의존성:
//   - genId, showNoSelectionHint, insertAfterSelected (drag-utils.js)
//   - bindBlock (drag-drop.js)
//   - window.MOCKUP_DEVICES (mockup-devices.js 또는 동등 정의)

import { genId, showNoSelectionHint, insertAfterSelected } from '../drag-utils.js';
import { bindBlock } from '../drag-drop.js';

function makeDeviceMockupBlock(deviceKey, width) {
  const devices = window.MOCKUP_DEVICES || {};
  const dev = devices[deviceKey];
  if (!dev) { console.warn('Unknown device:', deviceKey); return null; }

  const uid = genId('mkp').replace('mkp_', '');
  const row = document.createElement('div');
  row.className = 'row'; row.id = genId('row'); row.dataset.layout = 'stack';

  const block = document.createElement('div');
  block.className    = 'mockup-block';
  block.dataset.type = 'mockup';
  block.id           = genId('mkp');
  block.dataset.device    = deviceKey;
  block.dataset.shadow    = 'soft';
  block.dataset.imgSrc    = '';
  block.dataset.sourceSec = '';
  block.dataset.width     = String(width);
  block.dataset.uid       = uid;

  block.style.cssText = `position:relative;display:block;width:${width}px;margin:0 auto;cursor:pointer;`;

  // 화면 overlay (z-index:1 — SVG 프레임 뒤에)
  const screen = document.createElement('div');
  screen.className = 'mkp-screen';
  const s = dev.screen;
  screen.style.cssText = [
    'position:absolute',
    `left:${s.l}%`,
    `top:${s.t}%`,
    `width:${s.w}%`,
    `height:${s.h}%`,
    'overflow:hidden',
    `border-radius:${dev.screenRadius || '0'}`,
    'z-index:1',
    'background:#111',
  ].join(';');

  // 화면 placeholder
  screen.innerHTML = `
    <div style="width:100%;height:100%;display:flex;align-items:center;justify-content:center;background:#111;color:#333;font-size:11px;font-family:Pretendard,-apple-system,sans-serif;flex-direction:column;gap:8px;">
      <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
      <span>화면 영역</span>
    </div>`;

  // 디바이스 SVG 프레임 (z-index:2 — 화면 위)
  const frame = document.createElement('div');
  frame.className = 'mkp-frame';
  frame.style.cssText = 'position:absolute;inset:0;z-index:2;pointer-events:none;line-height:0;';
  frame.innerHTML = dev.getSvg(uid);

  // 높이 고정: viewBox 비율 기준
  const aspectH = Math.round(width * dev.viewH / dev.viewW);
  block.style.height = aspectH + 'px';

  block.appendChild(screen);
  block.appendChild(frame);

  // 기본 그림자
  block.style.filter = 'drop-shadow(0 20px 60px rgba(0,0,0,0.25))';

  row.appendChild(block);
  return { row, block };
}

function renderMockupBlock(block) {
  const deviceKey = block.dataset.device;
  const width     = parseInt(block.dataset.width) || parseInt(block.style.width) || 360;
  const devices   = window.MOCKUP_DEVICES || {};
  const dev       = devices[deviceKey];
  if (!dev) return;

  const uid = block.dataset.uid || (block.id || '').replace('mkp_', '');

  // 크기 업데이트
  block.style.width  = width + 'px';
  block.style.height = Math.round(width * dev.viewH / dev.viewW) + 'px';

  // 화면 overlay 위치 업데이트
  const screen = block.querySelector('.mkp-screen');
  if (screen) {
    const s = dev.screen;
    screen.style.left   = s.l + '%';
    screen.style.top    = s.t + '%';
    screen.style.width  = s.w + '%';
    screen.style.height = s.h + '%';
    screen.style.borderRadius = dev.screenRadius || '0';
  }

  // SVG 프레임 재생성 (디바이스 변경 시)
  const frame = block.querySelector('.mkp-frame');
  if (frame) frame.innerHTML = dev.getSvg(uid);
}

function addDeviceMockupBlock(deviceKey, width) {
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  const result = makeDeviceMockupBlock(deviceKey, width);
  if (!result) return;
  window.pushHistory();
  const { row, block } = result;
  insertAfterSelected(sec, row);
  bindBlock(block);
  window.buildLayerPanel();
  window.selectSection(sec);
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeDeviceMockupBlock = makeDeviceMockupBlock;
window.addDeviceMockupBlock  = addDeviceMockupBlock;
window.renderMockupBlock     = renderMockupBlock;

export { makeDeviceMockupBlock, addDeviceMockupBlock, renderMockupBlock };
