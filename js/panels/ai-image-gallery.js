/* ══════════════════════════════════════
   AI Image Gallery — File 패널 좌측 "AI Images" 섹션
   - state.imageGallery 기반 렌더링
   - 썸네일은 ai:readImage IPC로 dataUrl 가져와 window._aiImgCache에 캐시
   - 액션: 캔버스 삽입 / 스크래치 복사 / 삭제 (모두 공개 API + triggerAutoSave)
══════════════════════════════════════ */

// 메모리 캐시: id → dataUrl (페이지 reload 후에는 비어있다가 lazy load)
window._aiImgCache = window._aiImgCache || new Map();

function _getProjectId() {
  return new URLSearchParams(window.location.search).get('project') || null;
}

function _safe(s) {
  return String(s || '').replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function _modelBadge(model) {
  if (!model) return '';
  if (model.startsWith('gemini-')) return 'NB';
  if (model.startsWith('gpt-')) return 'GPT';
  if (model === 'prompt-only') return 'P';
  return '?';
}

function _tooltip(item) {
  const prompt = (item.prompt || '').slice(0, 60);
  const krw = item.cost?.krwApprox ?? 0;
  const date = (item.createdAt || '').slice(0, 10);
  return `${prompt}\n모델: ${item.model || '?'}\n비용: ₩${krw}\n${date}`;
}

async function _ensureDataUrl(item) {
  if (window._aiImgCache.has(item.id)) return window._aiImgCache.get(item.id);
  const projectId = _getProjectId();
  if (!projectId || !item.blobPath || !window.electronAPI?.aiReadImage) return null;
  try {
    const res = await window.electronAPI.aiReadImage({ projectId, blobPath: item.blobPath });
    if (res?.ok && res.dataUrl) {
      window._aiImgCache.set(item.id, res.dataUrl);
      return res.dataUrl;
    }
  } catch (_) {}
  return null;
}

function buildAIImageGallery() {
  const gallery = Array.isArray(window.state?.imageGallery) ? window.state.imageGallery : [];
  const grid = document.getElementById('ai-images-grid');
  const countEl = document.getElementById('ai-img-count');
  if (countEl) countEl.textContent = gallery.length;
  if (!grid) return;
  grid.innerHTML = '';
  if (gallery.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'ai-img-grid-empty';
    empty.textContent = '생성된 이미지가 없습니다.';
    grid.appendChild(empty);
    return;
  }
  // createdAt desc — 최신이 좌상단
  const sorted = [...gallery].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
  sorted.forEach(item => {
    const cell = document.createElement('div');
    cell.className = 'ai-img-cell ai-img-cell-loading';
    cell.dataset.imgId = item.id;
    cell.title = _tooltip(item);

    const badge = document.createElement('span');
    badge.className = 'ai-img-cell-badge';
    badge.textContent = _modelBadge(item.model);
    cell.appendChild(badge);

    const actions = document.createElement('div');
    actions.className = 'ai-img-cell-actions';
    actions.innerHTML = `
      <button data-act="canvas" title="캔버스에 삽입">＋</button>
      <button data-act="scratch" title="스크래치 패드에 복사">📋</button>
      <button data-act="delete" title="삭제">🗑</button>
    `;
    actions.addEventListener('click', e => {
      const btn = e.target.closest('button[data-act]');
      if (!btn) return;
      e.stopPropagation();
      const act = btn.dataset.act;
      if (act === 'canvas') window.galleryInsertToCanvas(item.id);
      else if (act === 'scratch') window.galleryCopyToScratch(item.id);
      else if (act === 'delete') window.galleryDeleteImage(item.id);
    });
    cell.appendChild(actions);
    grid.appendChild(cell);

    // 비동기 dataUrl 로드 → 배경 설정
    _ensureDataUrl(item).then(dataUrl => {
      if (!dataUrl) {
        cell.classList.remove('ai-img-cell-loading');
        cell.style.background = '#3a1c1c';
        cell.title = (cell.title || '') + '\n⚠️ 이미지 로드 실패';
        return;
      }
      cell.style.backgroundImage = `url("${dataUrl}")`;
      cell.classList.remove('ai-img-cell-loading');
    });
  });
}

async function addToImageGallery(item) {
  if (!window.state) return;
  if (!Array.isArray(window.state.imageGallery)) window.state.imageGallery = [];
  window.state.imageGallery.push(item);
  buildAIImageGallery();
  window.triggerAutoSave?.();
}

async function galleryInsertToCanvas(id) {
  const item = window.state?.imageGallery?.find(it => it.id === id);
  if (!item) return;
  // 선택된 섹션이 없으면 토스트
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showToast?.('⚠️ 캔버스에서 섹션을 먼저 선택해주세요.'); return; }
  const dataUrl = await _ensureDataUrl(item);
  if (!dataUrl) { window.showToast?.('❌ 이미지 로드 실패'); return; }
  // addAssetBlock — 선택 섹션 끝에 삽입 (공개 API만 사용)
  window.addAssetBlock?.();
  // 방금 추가된 마지막 asset-block 찾기
  const blocks = sec.querySelectorAll('.asset-block');
  const ab = blocks[blocks.length - 1];
  if (!ab) { window.showToast?.('❌ 에셋 블록 생성 실패'); return; }
  window.setAssetImageFromSrc?.(ab, dataUrl);
  window.triggerAutoSave?.();
  window.showToast?.('✨ 캔버스에 삽입됨');
}

async function galleryCopyToScratch(id) {
  const item = window.state?.imageGallery?.find(it => it.id === id);
  if (!item) return;
  const dataUrl = await _ensureDataUrl(item);
  if (!dataUrl) { window.showToast?.('❌ 이미지 로드 실패'); return; }
  if (!window._scratchAddAndSave) { window.showToast?.('⚠️ 스크래치 패드를 사용할 수 없습니다.'); return; }
  // 스크래치 패드 기본 위치 (0,0) + 너비 200px
  try {
    await window._scratchAddAndSave(dataUrl, 0, 0, 200);
    window.showToast?.('📋 스크래치 패드에 복사됨');
  } catch (e) {
    window.showToast?.('❌ 스크래치 복사 실패: ' + e.message);
  }
}

async function galleryDeleteImage(id) {
  const item = window.state?.imageGallery?.find(it => it.id === id);
  if (!item) return;
  const promptPreview = (item.prompt || '(빈 프롬프트)').slice(0, 30);
  if (!window.confirm(`이 이미지를 영구 삭제할까요?\n\n${promptPreview}`)) return;
  const projectId = _getProjectId();
  if (projectId && item.blobPath && window.electronAPI?.aiDeleteImage) {
    try {
      await window.electronAPI.aiDeleteImage({ projectId, blobPath: item.blobPath });
    } catch (_) {}
  }
  window._aiImgCache?.delete(id);
  window.state.imageGallery = window.state.imageGallery.filter(it => it.id !== id);
  buildAIImageGallery();
  window.triggerAutoSave?.();
  window.showToast?.('🗑 삭제됨');
}

window.buildAIImageGallery   = buildAIImageGallery;
window.addToImageGallery     = addToImageGallery;
window.galleryInsertToCanvas = galleryInsertToCanvas;
window.galleryCopyToScratch  = galleryCopyToScratch;
window.galleryDeleteImage    = galleryDeleteImage;

// 섹션 헤더 토글 (다른 file-panel-section과 동일 패턴)
document.addEventListener('DOMContentLoaded', () => {
  const header = document.getElementById('ai-images-section-header');
  if (header) {
    header.addEventListener('click', e => {
      // + 버튼 클릭은 토글 제외
      if (e.target.closest('.panel-tab-action')) return;
      const section = header.closest('.file-panel-section');
      section?.classList.toggle('collapsed');
    });
  }
  // 초기 렌더 (state.imageGallery는 globals.js에서 [] 초기화됨)
  buildAIImageGallery();
});
