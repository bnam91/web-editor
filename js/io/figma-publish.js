import { canvasEl, state } from '../globals.js';
import './import-figma-json.js';

/* ── Publish Dropdown ── */
function togglePublishDropdown(e) {
  e.stopPropagation();
  document.getElementById('publish-dropdown-wrap').classList.toggle('open');
}
function closePublishDropdown() {
  document.getElementById('publish-dropdown-wrap').classList.remove('open');
}
function doPublish() {
  closePublishDropdown();
  alert('Publish 기능은 준비 중입니다.');
}
document.addEventListener('click', e => {
  if (!e.target.closest('#publish-dropdown-wrap')) closePublishDropdown();
});

/* 레이어 패널 — 섹션 순서 변경 */
const layerPanelBody = document.getElementById('layer-panel-body');
// rAF throttle: getLayerSectionDragAfterEl 내 getBoundingClientRect 호출 최적화 (DBG-11)
let _layerSecDragRafId = null;
layerPanelBody.addEventListener('dragover', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  if (_layerSecDragRafId) return;
  const clientY = e.clientY;
  _layerSecDragRafId = requestAnimationFrame(() => {
    _layerSecDragRafId = null;
    window.clearLayerSectionIndicators();
    const after = window.getLayerSectionDragAfterEl(layerPanelBody, clientY);
    const indicator = document.createElement('div');
    indicator.className = 'layer-section-drop-indicator';
    if (after) layerPanelBody.insertBefore(indicator, after);
    else layerPanelBody.appendChild(indicator);
  });
});
layerPanelBody.addEventListener('dragleave', e => {
  if (!layerSectionDragSrc) return;
  if (!layerPanelBody.contains(e.relatedTarget)) window.clearLayerSectionIndicators();
});
layerPanelBody.addEventListener('drop', e => {
  if (!layerSectionDragSrc) return;
  e.preventDefault();
  window.pushHistory(); // FIX-SD-03: 레이어 패널 섹션 드롭에서 undo 지원
  const { sec } = layerSectionDragSrc;
  const indicator = layerPanelBody.querySelector('.layer-section-drop-indicator');
  if (indicator) {
    const nextLayerSec = indicator.nextElementSibling;
    if (nextLayerSec && nextLayerSec._canvasSec) {
      canvasEl.insertBefore(sec, nextLayerSec._canvasSec);
    } else {
      canvasEl.appendChild(sec);
    }
  }
  window.clearLayerSectionIndicators();
  window.buildLayerPanel();
  layerSectionDragSrc = null;
  window.scheduleAutoSave?.(); // FIX-SD-03: 레이어 패널 드롭 후 저장 보장
});

/* ── Figma 업로드 ── */

/**
 * 모달 열기 — 섹션 목록 체크박스 렌더링 + node_map 로드
 */
async function openFigmaUploadModal() {
  closePublishDropdown();
  document.getElementById('figma-upload-modal').style.display = 'flex';
  const input = document.getElementById('figma-channel-input');
  input.value = localStorage.getItem('figma-last-channel') || 'hyfppeyj';

  // 섹션 목록 빌드
  await _buildFigmaSectionList();
  input.focus();
}

/**
 * 모든 페이지의 섹션 목록을 구해서 체크박스 리스트 렌더링
 * node_map 로드 후 이미 업로드된 섹션엔 "업데이트" 배지 표시
 */
async function _buildFigmaSectionList() {
  window.flushCurrentPage();

  const nodeMap = (window.electronAPI?.readNodeMap)
    ? (await window.electronAPI.readNodeMap() || {})
    : {};

  const listEl = document.getElementById('figma-section-list');
  listEl.innerHTML = '';

  const parser = new DOMParser();
  state.pages.forEach((pg, pgIdx) => {
    const doc = parser.parseFromString(`<div id="c">${pg.canvas || ''}</div>`, 'text/html');
    doc.querySelectorAll('#c > .section-block').forEach((sec, secIdx) => {
      const id   = sec.id || '';
      const name = sec.dataset.name
        || sec.querySelector('.section-label')?.textContent?.trim()
        || `Section ${secIdx + 1}`;
      const isSynced = !!nodeMap[id]?.figmaId;
      const pageLabel = state.pages.length > 1 ? ` <span style="color:#555;">[${pg.name || `P${pgIdx + 1}`}]</span>` : '';

      const row = document.createElement('label');
      row.className = 'figma-sec-row';
      row.innerHTML = `
        <input type="checkbox" class="figma-sec-cb" data-sec-id="${id}" checked
          style="accent-color:#2563eb; cursor:pointer; flex-shrink:0;" />
        <span style="font-size:11px; color:#ccc; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;"
          title="${name}">${name}${pageLabel}</span>
        <span class="figma-sec-badge ${isSynced ? 'synced' : 'new'}">${isSynced ? '✓ 업데이트' : '새 업로드'}</span>
      `;
      listEl.appendChild(row);
    });
  });

  // 전체 선택 체크박스 상태 동기화
  document.getElementById('figma-select-all').checked = true;

  // 개별 체크박스 변경 시 전체 선택 상태 업데이트
  listEl.querySelectorAll('.figma-sec-cb').forEach(cb => {
    cb.addEventListener('change', _syncFigmaSelectAll);
  });
}

function _syncFigmaSelectAll() {
  const all  = [...document.querySelectorAll('.figma-sec-cb')];
  const checked = all.filter(c => c.checked);
  const selectAll = document.getElementById('figma-select-all');
  selectAll.indeterminate = checked.length > 0 && checked.length < all.length;
  selectAll.checked = checked.length === all.length;
}

function toggleFigmaSelectAll(checked) {
  document.querySelectorAll('.figma-sec-cb').forEach(cb => { cb.checked = checked; });
  const selectAll = document.getElementById('figma-select-all');
  selectAll.indeterminate = false;
  selectAll.checked = checked;
}

function closeFigmaUploadModal() {
  document.getElementById('figma-upload-modal').style.display = 'none';
  document.getElementById('figma-upload-log').style.display     = 'none';
  document.getElementById('figma-upload-spinner').style.display = 'none';
  const btn       = document.getElementById('figma-upload-btn');
  const cancelBtn = document.getElementById('figma-cancel-btn');
  btn.style.display      = '';
  btn.disabled           = false;
  cancelBtn.disabled     = false;
  cancelBtn.textContent  = '취소';
  cancelBtn.style.color  = '';
}

async function doFigmaUpload() {
  const raw = document.getElementById('figma-channel-input').value.trim();
  if (!raw) { alert('채널 ID를 입력해주세요.'); return; }
  // "Connect to Figma, channel abc123" 형태도 허용 — 마지막 단어만 추출
  const channelMatch = raw.match(/channel\s+(\S+)/i);
  const channel = channelMatch ? channelMatch[1] : raw;
  localStorage.setItem('figma-last-channel', channel);

  // 선택된 섹션 ID 수집
  const selectedIds = [...document.querySelectorAll('.figma-sec-cb:checked')].map(cb => cb.dataset.secId);
  if (selectedIds.length === 0) { alert('업로드할 섹션을 선택해주세요.'); return; }

  const logEl     = document.getElementById('figma-upload-log');
  const spinnerEl = document.getElementById('figma-upload-spinner');
  const btn       = document.getElementById('figma-upload-btn');
  const cancelBtn = document.getElementById('figma-cancel-btn');

  logEl.style.display     = 'none';
  spinnerEl.style.display = 'flex';
  btn.disabled    = true;
  cancelBtn.disabled = false;
  cancelBtn.textContent = '취소';
  cancelBtn.onclick = async () => {
    await window.electronAPI?.figmaCancelUpload?.();
    showDone(false, '⛔ 업로드가 취소됐습니다.');
  };

  // node_map 로드 → 선택 섹션에 figmaId / figmaY 주입
  const nodeMap = (window.electronAPI?.readNodeMap)
    ? (await window.electronAPI.readNodeMap() || {})
    : {};

  window.flushCurrentPage();
  const designJSON = window.buildFigmaExportJSON(selectedIds, nodeMap);

  function showDone(success, text) {
    spinnerEl.style.display = 'none';
    logEl.style.display     = 'block';
    logEl.textContent = text;
    logEl.style.color = success ? '#4ade80' : '#f87171';
    btn.style.display    = 'none';
    cancelBtn.disabled   = false;
    cancelBtn.textContent = '닫기';
    cancelBtn.style.color = '#e0e0e0';
    cancelBtn.onclick = () => window.closeFigmaUploadModal();

    // 실패 시 재시도 버튼 표시
    let retryBtn = document.getElementById('figma-retry-btn');
    if (!success) {
      if (!retryBtn) {
        retryBtn = document.createElement('button');
        retryBtn.id = 'figma-retry-btn';
        retryBtn.className = 'figma-upload-btn-primary';
        retryBtn.style.cssText = 'margin-top:8px;width:100%;background:#2563eb;border:none;border-radius:6px;color:#fff;padding:6px 14px;font-size:11px;cursor:pointer;font-weight:600;';
        cancelBtn.parentElement.insertBefore(retryBtn, cancelBtn);
      }
      retryBtn.textContent = '↺ 재시도';
      retryBtn.style.display = '';
      retryBtn.onclick = () => {
        retryBtn.style.display = 'none';
        logEl.style.display = 'none';
        btn.style.display = '';
        doFigmaUpload();
      };
    } else if (retryBtn) {
      retryBtn.style.display = 'none';
    }
  }

  try {
    const result = await window.electronAPI.figmaUpload(channel, designJSON);

    // SECTION_MAP 라인 파싱 → node_map 갱신
    if (result.success && result.logs) {
      const updatedMap = { ...nodeMap };
      for (const line of result.logs.split('\n')) {
        if (!line.startsWith('SECTION_MAP:')) continue;
        try {
          const entry = JSON.parse(line.slice('SECTION_MAP:'.length));
          if (entry.id) {
            updatedMap[entry.id] = { figmaId: entry.figmaId, y: entry.y, height: entry.height, name: entry.name, updatedAt: new Date().toISOString().split('T')[0] };
          }
        } catch {}
      }
      if (window.electronAPI?.writeNodeMap) {
        await window.electronAPI.writeNodeMap(updatedMap);
      }
    }

    showDone(result.success, result.logs || (result.success ? '✅ 완료!' : '❌ 실패'));
  } catch (e) {
    showDone(false, '❌ 오류: ' + e.message);
  }
}

/**
 * @param {string[]|null} selectedIds  업로드할 섹션 DOM ID 배열. null 이면 전체
 * @param {Object}        nodeMap      섹션ID → { figmaId, y } 매핑 (업데이트 모드용)
 */
// contenteditable 줄바꿈 보존 — DOM 트리 직접 순회
// <br> → \n, 블록요소(<div>/<p>)는 이전 형제가 있을 때만 앞에 \n 삽입

/* ── Figma Bridge (WebSocket 서버 ON/OFF) ── */
async function initFigmaBridge() {
  if (!window.electronAPI?.figmaBridgeStatus) return;
  const on = await window.electronAPI.figmaBridgeStatus();
  const badge = document.getElementById('figma-bridge-badge');
  if (badge) {
    badge.textContent = on ? '● ON' : '● OFF';
    badge.style.background = on ? '#1a3a1a' : '#333';
    badge.style.color = on ? '#4ade80' : '#666';
  }
}

async function toggleFigmaBridge(e) {
  e.stopPropagation();
  if (!window.electronAPI) return;
  const on = await window.electronAPI.figmaBridgeStatus();
  if (on) {
    await window.electronAPI.figmaBridgeStop();
  } else {
    await window.electronAPI.figmaBridgeStart();
  }
  await initFigmaBridge();
}

// 드롭다운 열릴 때마다 상태 갱신
const _origTogglePublishDropdown = togglePublishDropdown;
togglePublishDropdown = function(e) {
  _origTogglePublishDropdown(e);
  initFigmaBridge();
};

window.togglePublishDropdown  = togglePublishDropdown;
window.closePublishDropdown   = closePublishDropdown;
window.doPublish              = doPublish;
window.openFigmaUploadModal   = openFigmaUploadModal;
window._buildFigmaSectionList = _buildFigmaSectionList;
window._syncFigmaSelectAll    = _syncFigmaSelectAll;
window.toggleFigmaSelectAll   = toggleFigmaSelectAll;
window.closeFigmaUploadModal  = closeFigmaUploadModal;
window.doFigmaUpload          = doFigmaUpload;
window.initFigmaBridge        = initFigmaBridge;
window.toggleFigmaBridge      = toggleFigmaBridge;
