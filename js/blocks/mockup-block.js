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

// ── 가로 중앙정렬 (대칭 블리드) ─────────────────────────────────────────────
// 버그: `margin:0 auto`는 블럭 width가 부모(콘텐츠칸) 폭보다 넓으면 가운데정렬을
//   못 하고(CSS 스펙상 margin-left=0으로 해소) 왼쪽에 붙어 오른쪽으로 넘침.
// 해결: 부모 콘텐츠 폭(avail)을 실측해
//   - width <= avail  → 기존처럼 margin:0 auto (콘텐츠칸 안 중앙)
//   - width >  avail  → 좌우 동일 음수마진 (avail-width)/2 로 대칭 블리드 → 섹션 중앙
//   에셋블럭의 풀블리드(margin 음수 + width calc) 패턴과 동일 원리.
// 호출 타이밍: 블럭이 DOM에 붙은 뒤(make 직후가 아니라 insert/render/load/update 후).
//   DOM 미부착 시 부모 폭 측정 불가 → margin:0 auto 폴백만 남기고 그냥 반환.
function centerMockupBlock(block) {
  if (!block) return;
  // 자유배치 프레임(absolute) 안의 목업은 절대좌표로 배치 — margin 정렬 미적용.
  if (block.style.position === 'absolute') return;
  const width = parseInt(block.dataset.width) || parseInt(block.style.width) || 0;
  const parent = block.parentElement;
  // 부모 콘텐츠 폭(= 블럭의 containing block 가용폭). 미부착이면 측정 불가.
  const avail = parent ? parent.clientWidth : 0;
  if (!avail) {
    // DOM 미부착 — 기본 중앙정렬만(폴백). 부착 후 다시 호출됨.
    block.style.margin = '0 auto';
    block.style.marginLeft = 'auto';
    block.style.marginRight = 'auto';
    return;
  }
  if (width > avail) {
    // 콘텐츠폭 초과 → 좌우 대칭 음수마진으로 부모(=섹션 중앙선) 기준 중앙 유지.
    const m = Math.round((avail - width) / 2); // 음수
    block.style.marginLeft = m + 'px';
    block.style.marginRight = m + 'px';
  } else {
    // 콘텐츠폭 이하 → 기존 auto 중앙(콘텐츠칸 안).
    block.style.marginLeft = 'auto';
    block.style.marginRight = 'auto';
  }
}

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

  // 가로 중앙정렬 재계산 (width 변경/디바이스 변경 후 부모 폭 대비 재정렬)
  centerMockupBlock(block);
}

function addDeviceMockupBlock(deviceKey, width) {
  // I5-F1: 다른 블록처럼 _insertToFlowFrame 무조건 우선 호출.
  //   내부에서 freeLayout(B)·fullWidth(A) 분기를 모두 처리(+buildLayerPanel 호출)하고,
  //   해당 없으면 false 반환 → 아래 섹션 레벨 flow 삽입으로 폴백.
  //   (기존엔 freeLayout 사전조건 분기라 mockup이 프레임 안에서 드래그 이동 안 됐음)
  if (window._insertToFlowFrame?.(() => makeDeviceMockupBlock(deviceKey, width))) {
    return;
  }
  const sec = window.getSelectedSection();
  if (!sec) { showNoSelectionHint(); return; }
  const result = makeDeviceMockupBlock(deviceKey, width);
  if (!result) return;
  window.pushHistory();
  const { row, block } = result;
  insertAfterSelected(sec, row);
  bindBlock(block);
  centerMockupBlock(block); // DOM 부착 후 부모 폭 기준 중앙정렬
  window.buildLayerPanel();
  window.selectSection(sec);
}

// ── MCP-friendly helpers (PM-C) ─────────────────────────────────────────────
// asset-block과 동일한 체커보드 패턴 (prop-mockup.js와 일치)
const _MKP_CHECKER_BG = 'repeating-conic-gradient(#d8d8d8 0% 25%, #f0f0f0 0% 50%) 0 0 / 72px 72px';

// 화면 이미지를 mkp-screen에 적용 (placeholder innerHTML 비움 + background로 설정).
// prop-mockup.js _applyScreenImage와 동작 일치.
// Codex #1: CSS url() injection 방어 — 백슬래시·작은따옴표 escape.
function _cssEscapeUrl(src) {
  return String(src).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}
function applyMockupScreenImage(block, src) {
  if (!block) return;
  const screen = block.querySelector('.mkp-screen');
  if (!screen) return;
  if (!src) {
    // 비우기 — placeholder 복원은 안 함 (디자인 결정: 빈 src = 단색 #111)
    screen.style.background = '#111';
    screen.style.backgroundImage = '';
    screen.innerHTML = '';
    return;
  }
  const safe = _cssEscapeUrl(src);
  screen.style.backgroundImage    = `url('${safe}')`;
  screen.style.backgroundSize     = '100% auto';
  screen.style.backgroundPosition = 'top center';
  screen.style.backgroundRepeat   = 'no-repeat';
  screen.style.background         = `url('${safe}') top center / 100% auto no-repeat, ${_MKP_CHECKER_BG}`;
  screen.innerHTML = '';
}

// shadow 적용 (none/soft/strong) — prop-mockup.js _applyShadow와 일치.
function applyMockupShadow(block, val) {
  if (!block) return;
  const shadows = {
    none:   'none',
    soft:   '0 20px 60px rgba(0,0,0,0.25)',
    strong: '0 30px 80px rgba(0,0,0,0.55)',
  };
  const v = shadows[val] !== undefined ? val : 'soft';
  block.style.filter = v === 'none' ? '' : `drop-shadow(${shadows[v]})`;
  block.dataset.shadow = v;
}

// 옵션 기반 add — MCP add_mockup_block의 단일 진입점.
// opts: { deviceKey, width, sectionId, imgSrc, shadow }
//   - deviceKey 필수 (window.MOCKUP_DEVICES에 등록된 키)
//   - width 안 주면 dev.defaultWidth
//   - sectionId 안 주면 현재 선택 섹션
//   - imgSrc 주면 화면에 적용
//   - shadow 안 주면 'soft' 유지
// return: { ok, blockId, deviceKey, width, hasImage } 또는 { ok:false, code, message }
function addMockupBlock(opts = {}) {
  const devices = window.MOCKUP_DEVICES || {};
  const deviceKey = opts.deviceKey || 'iphone';
  const dev = devices[deviceKey];
  if (!dev) return { ok: false, code: 'INVALID_DEVICE', message: `unknown device: ${deviceKey}` };

  // width: clamp 100~860, 기본은 dev.defaultWidth
  let width = parseInt(opts.width);
  if (!Number.isFinite(width)) width = dev.defaultWidth || 360;
  width = Math.min(860, Math.max(100, width));

  // 섹션 결정 — sectionId 지정 → 우선, 아니면 현재 선택.
  let sec = null;
  if (opts.sectionId) {
    sec = document.getElementById(opts.sectionId);
    if (!sec || !sec.classList.contains('section-block')) {
      return { ok: false, code: 'NOT_FOUND', message: `section not found: ${opts.sectionId}` };
    }
    if (typeof window.selectSection === 'function') {
      try { window.selectSection(sec); } catch (_) {}
    }
  } else {
    sec = window.getSelectedSection?.();
    if (!sec) {
      // 첫 섹션 자동 선택 (다른 MCP 도구와 동일 폴백)
      const first = document.querySelector('[id^="sec_"]');
      if (first && typeof window.selectSection === 'function') {
        try { window.selectSection(first); sec = first; } catch (_) {}
      }
    }
    if (!sec) return { ok: false, code: 'NO_SECTION', message: '활성 섹션이 없습니다.' };
  }

  // imgSrc / shadow 옵션을 적용한 블록을 생성하는 공통 팩토리.
  // (DOM 삽입 전에 dataset/배경 세팅 → 저장 직렬화 안전성)
  let createdBlock = null;
  const makeWithOpts = () => {
    const r = makeDeviceMockupBlock(deviceKey, width);
    if (!r) return null;
    const { block } = r;
    if (typeof opts.imgSrc === 'string' && opts.imgSrc) {
      block.dataset.imgSrc = opts.imgSrc;
      applyMockupScreenImage(block, opts.imgSrc);
    }
    if (opts.shadow !== undefined && opts.shadow !== null) {
      applyMockupShadow(block, String(opts.shadow));
    }
    createdBlock = block;
    return r;
  };

  // I5-F1: 다른 블록처럼 _insertToFlowFrame 무조건 우선 호출.
  //   내부에서 freeLayout(B)·fullWidth(A) 분기를 모두 처리하고, 해당 없으면 false 반환 → 섹션 삽입 폴백.
  //   (freeLayout 프레임에서 mockup이 절대좌표로 들어가 드래그 이동 가능해지는 게 목표.)
  //   _insertToFlowFrame이 내부에서 buildLayerPanel을 호출하므로 여기선 중복 호출 안 함.
  if (window._insertToFlowFrame?.(makeWithOpts)) {
    if (!createdBlock) {
      return { ok: false, code: 'CREATE_FAILED', message: 'makeDeviceMockupBlock returned null' };
    }
    return {
      ok: true,
      blockId: createdBlock.id,
      deviceKey,
      width,
      shadow: createdBlock.dataset.shadow || 'soft',
      hasImage: !!createdBlock.dataset.imgSrc,
    };
  }

  const result = makeWithOpts();
  if (!result) return { ok: false, code: 'CREATE_FAILED', message: 'makeDeviceMockupBlock returned null' };

  const { row, block } = result;

  window.pushHistory?.();
  insertAfterSelected(sec, row);
  bindBlock(block);
  centerMockupBlock(block); // DOM 부착 후 부모 폭 기준 중앙정렬
  window.buildLayerPanel?.();
  window.selectSection?.(sec);

  return {
    ok: true,
    blockId: block.id,
    deviceKey,
    width,
    shadow: block.dataset.shadow || 'soft',
    hasImage: !!block.dataset.imgSrc,
  };
}

// 옵션 기반 update — MCP update_mockup_block의 단일 진입점.
// opts: { deviceKey, width, imgSrc, shadow } — 최소 1개 필드.
// imgSrc === '' (빈 문자열) = 이미지 제거.
function updateMockupBlock(blockId, opts = {}) {
  if (!blockId || typeof blockId !== 'string') {
    return { ok: false, code: 'INVALID_ID', message: 'blockId required' };
  }
  const block = document.getElementById(blockId);
  if (!block || !block.classList.contains('mockup-block')) {
    return { ok: false, code: 'NOT_FOUND', message: `mockup-block not found: ${blockId}` };
  }

  const devices = window.MOCKUP_DEVICES || {};
  let changed = false;

  // deviceKey 변경 — renderMockupBlock가 SVG/screen 위치를 다시 그림
  if (opts.deviceKey !== undefined && opts.deviceKey !== null) {
    const next = String(opts.deviceKey);
    if (!devices[next]) {
      return { ok: false, code: 'INVALID_DEVICE', message: `unknown device: ${next}` };
    }
    if (block.dataset.device !== next) {
      block.dataset.device = next;
      // 디바이스 변경 시 기존 width 유지하되 새 디바이스 viewW/H 비율로 리렌더.
      changed = true;
    }
  }

  // width 변경
  if (opts.width !== undefined && opts.width !== null) {
    let w = parseInt(opts.width);
    if (!Number.isFinite(w)) {
      return { ok: false, code: 'INVALID_WIDTH', message: `width must be number, got ${opts.width}` };
    }
    w = Math.min(860, Math.max(100, w));
    block.dataset.width = String(w);
    block.style.width = w + 'px';
    changed = true;
  }

  // shadow 변경 (none/soft/strong 화이트리스트는 mcp-server에서 검증)
  if (opts.shadow !== undefined && opts.shadow !== null) {
    applyMockupShadow(block, String(opts.shadow));
    changed = true;
  }

  // imgSrc 변경 — '' 빈 문자열 = clear
  if (opts.imgSrc !== undefined && opts.imgSrc !== null) {
    const src = String(opts.imgSrc);
    if (src === '') {
      block.dataset.imgSrc = '';
      // sourceSec 도 초기화 — 캡처 출처 연결 해제
      block.dataset.sourceSec = '';
      applyMockupScreenImage(block, '');
    } else {
      block.dataset.imgSrc = src;
      // 직접 imgSrc로 수정 시 캡처 출처 연결 해제 (prop-mockup의 업로드 분기와 동일)
      block.dataset.sourceSec = '';
      applyMockupScreenImage(block, src);
    }
    changed = true;
  }

  if (!changed) {
    return { ok: false, code: 'NO_OP', message: 'no fields provided to update' };
  }

  // 디바이스/너비 변경은 SVG 프레임 + screen overlay 재계산 필요
  if (opts.deviceKey !== undefined || opts.width !== undefined) {
    renderMockupBlock(block);
    // 디바이스 교체 후 이미지가 있으면 다시 적용 (renderMockupBlock가 screen.innerHTML 안 건드림 — 안전하지만 명시적 재적용)
    if (block.dataset.imgSrc) {
      applyMockupScreenImage(block, block.dataset.imgSrc);
    }
  }

  window.pushHistory?.();

  return {
    ok: true,
    blockId,
    deviceKey: block.dataset.device,
    width: parseInt(block.dataset.width) || parseInt(block.style.width) || 0,
    shadow: block.dataset.shadow || 'soft',
    hasImage: !!block.dataset.imgSrc,
  };
}

// ── window 노출 ────────────────────────────────────────────────────────────
window.makeDeviceMockupBlock = makeDeviceMockupBlock;
window.addDeviceMockupBlock  = addDeviceMockupBlock;
window.renderMockupBlock     = renderMockupBlock;
window.addMockupBlock        = addMockupBlock;
window.updateMockupBlock     = updateMockupBlock;
window.applyMockupScreenImage = applyMockupScreenImage;
window.applyMockupShadow     = applyMockupShadow;
window.centerMockupBlock     = centerMockupBlock;

export {
  makeDeviceMockupBlock,
  addDeviceMockupBlock,
  renderMockupBlock,
  addMockupBlock,
  updateMockupBlock,
  applyMockupScreenImage,
  applyMockupShadow,
  centerMockupBlock,
};
