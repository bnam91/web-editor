/* ══════════════════════════════════════
   Assets Panel — 좌측 사이드바 "Assets" 탭
   - state.assetsTree 기반 폴더/이미지/URL 트리
   - 이미지는 IPC(assets:saveFile)로 디스크 분리 저장 (projects/<id>/assets/)
   - DnD: 외부 파일 드롭, 캔버스로 mousedown 드래그, 트리 내부 폴더 간 이동
   - 모든 변경 후 buildAssetsPanel() + window.triggerAutoSave() 호출
═══════════════════════════════════════ */

// 메모리 캐시: id → dataUrl (페이지 reload 후 lazy load)
window._assetsImgCache = window._assetsImgCache || new Map();

/* ════════════════════════════════════════════════════════════════════════
   Selection — 에셋 항목 선택 (단일/⌘다중/Shift범위) + Backspace 삭제
   ════════════════════════════════════════════════════════════════════════ */
const _assetsSelectedIds = new Set();
let _assetsLastClickedId = null;

function _assetsClearSelection() {
  _assetsSelectedIds.clear();
  document.querySelectorAll('.assets-row--selected, .assets-grid-card--selected').forEach(el => {
    el.classList.remove('assets-row--selected', 'assets-grid-card--selected');
  });
}
function _assetsSetSelectedClass(id, on) {
  document.querySelectorAll(`[data-asset-id="${id}"]`).forEach(el => {
    if (el.classList.contains('assets-row')) {
      el.classList.toggle('assets-row--selected', on);
    } else if (el.classList.contains('assets-grid-card')) {
      el.classList.toggle('assets-grid-card--selected', on);
    }
  });
}
function _assetsSetSelected(id, on) {
  if (on) _assetsSelectedIds.add(id);
  else _assetsSelectedIds.delete(id);
  _assetsSetSelectedClass(id, on);
}
function _assetsGetVisibleOrder() {
  const out = [];
  const walk = (arr) => {
    if (!arr) return;
    for (const n of arr) {
      out.push(n.id);
      if (n.type === 'folder' && !n.collapsed && n.children) walk(n.children);
    }
  };
  walk(_assetsTreeRef());
  return out;
}
function _assetsSelectRange(fromId, toId) {
  const order = _assetsGetVisibleOrder();
  const a = order.indexOf(fromId), b = order.indexOf(toId);
  if (a < 0 || b < 0) return;
  const [lo, hi] = a < b ? [a, b] : [b, a];
  for (let i = lo; i <= hi; i++) _assetsSetSelected(order[i], true);
}
function _assetsHandleSelectClick(id, e) {
  if (e.shiftKey && _assetsLastClickedId) {
    if (!(e.metaKey || e.ctrlKey)) _assetsClearSelection();
    _assetsSelectRange(_assetsLastClickedId, id);
    _assetsSetSelected(id, true);
  } else if (e.metaKey || e.ctrlKey) {
    _assetsSetSelected(id, !_assetsSelectedIds.has(id));
    _assetsLastClickedId = id;
  } else {
    _assetsClearSelection();
    _assetsSetSelected(id, true);
    _assetsLastClickedId = id;
  }
}
function _assetsReapplySelectionClasses() {
  // buildAssetsPanel rebuild 후 클래스 재적용
  for (const id of _assetsSelectedIds) _assetsSetSelectedClass(id, true);
}
function _assetsBindGlobalKeydown() {
  if (window._assetsKeydownBound) return;
  window._assetsKeydownBound = true;
  document.addEventListener('keydown', async e => {
    if (e.key !== 'Backspace' && e.key !== 'Delete' && e.key !== 'Escape') return;
    if (_assetsSelectedIds.size === 0) return;
    // input/textarea/contenteditable focused 시 무시 (rename 등)
    const ae = document.activeElement;
    if (ae) {
      const tag = (ae.tagName || '').toLowerCase();
      if (tag === 'input' || tag === 'textarea' || ae.isContentEditable) return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      _assetsClearSelection();
      return;
    }
    e.preventDefault();
    const ids = [..._assetsSelectedIds];
    const msg = ids.length === 1 ? '선택한 자산 1개를 삭제할까요? (폴더면 하위 포함)' : `선택한 자산 ${ids.length}개를 삭제할까요? (폴더면 하위 포함)`;
    if (!window.confirm(msg)) return;
    for (const id of ids) {
      try { await assetsDeleteNode(id); } catch (_) {}
    }
    _assetsSelectedIds.clear();
    _assetsLastClickedId = null;
  });
}

const ASSETS_ACCEPT_MIME = ['image/png', 'image/jpeg', 'image/jpg', 'image/svg+xml', 'image/webp', 'image/gif'];
const ASSETS_ACCEPT_ATTR = 'image/png,image/jpeg,image/svg+xml,image/webp,image/gif';

// dataURL → Blob 직접 파싱 (Codex #7 — fetch round-trip 회피)
function _dataUrlToBlobInline(dataUrl) {
  if (typeof dataUrl !== 'string' || !dataUrl.startsWith('data:')) return null;
  const head = dataUrl.indexOf(',');
  if (head < 0) return null;
  const meta = dataUrl.slice(5, head);
  const data = dataUrl.slice(head + 1);
  const parts = meta.split(';');
  const mime = parts[0] || 'application/octet-stream';
  const isBase64 = parts.slice(1).some(p => p.trim().toLowerCase() === 'base64');
  let bytes;
  try {
    if (isBase64) {
      const bin = atob(data);
      bytes = new Uint8Array(bin.length);
      for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);
    } else {
      bytes = new TextEncoder().encode(decodeURIComponent(data));
    }
  } catch (_) { return null; }
  return new Blob([bytes], { type: mime });
}

/* ── 유틸 ── */
function _assetsProjectId() {
  return new URLSearchParams(window.location.search).get('project') || null;
}

function _assetsSafe(s) {
  return String(s == null ? '' : s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
}

function _assetsGenId() {
  // 충돌 시 1회 재시도
  for (let attempt = 0; attempt < 2; attempt++) {
    const id = 'ast_' + Math.random().toString(36).slice(2, 8);
    if (!_assetsFindNodeById(id)) return id;
  }
  return 'ast_' + Math.random().toString(36).slice(2, 10);
}

function _assetsTreeRef() {
  if (!window.state) return [];
  if (!Array.isArray(window.state.assetsTree)) window.state.assetsTree = [];
  return window.state.assetsTree;
}

/* ── 트리 조작 ── */
function assetsFindNode(id, tree, parent = null) {
  if (!tree) tree = _assetsTreeRef();
  for (let i = 0; i < tree.length; i++) {
    const n = tree[i];
    if (n.id === id) return { node: n, parent, parentArr: tree, index: i, depth: _assetsDepthOf(parent, 0) };
    if (n.type === 'folder' && Array.isArray(n.children)) {
      const r = assetsFindNode(id, n.children, n);
      if (r) return r;
    }
  }
  return null;
}

function _assetsDepthOf(parent, base) {
  if (!parent) return base;
  // parent 노드의 위치를 다시 찾아 depth 계산
  const found = assetsFindNode(parent.id);
  return found ? found.depth + 1 : base + 1;
}

function _assetsFindNodeById(id) {
  return assetsFindNode(id);
}

function _assetsParentArrOf(parentId) {
  if (!parentId) return _assetsTreeRef();
  const f = assetsFindNode(parentId);
  if (!f || f.node.type !== 'folder') return _assetsTreeRef();
  if (!Array.isArray(f.node.children)) f.node.children = [];
  return f.node.children;
}

function assetsAddNode(parentId, node) {
  const arr = _assetsParentArrOf(parentId);
  arr.push(node);
}

function _assetsIsDescendant(ancestorId, candidateId) {
  // ancestorId가 candidateId의 조상이면 true
  const anc = assetsFindNode(ancestorId);
  if (!anc || anc.node.type !== 'folder') return false;
  function walk(arr) {
    for (const n of arr) {
      if (n.id === candidateId) return true;
      if (n.type === 'folder' && Array.isArray(n.children)) {
        if (walk(n.children)) return true;
      }
    }
    return false;
  }
  return walk(anc.node.children || []);
}

function assetsMoveNode(id, newParentId, beforeId = null) {
  if (id === newParentId) return; // 자기 자신으로 이동 X
  if (newParentId && _assetsIsDescendant(id, newParentId)) return; // 사이클 가드
  const src = assetsFindNode(id);
  if (!src) return;
  // 원위치에서 제거
  src.parentArr.splice(src.index, 1);
  const dst = _assetsParentArrOf(newParentId);
  let idx = dst.length;
  if (beforeId) {
    const b = dst.findIndex(n => n.id === beforeId);
    if (b >= 0) idx = b;
  }
  dst.splice(idx, 0, src.node);
}

function assetsRenameNode(id, newName) {
  const f = assetsFindNode(id);
  if (!f) return;
  const trimmed = String(newName || '').trim();
  if (!trimmed) return;
  if (f.node.type === 'url') f.node.title = trimmed;
  else f.node.name = trimmed;
}

async function _assetsRemoveNodeRecursive(node) {
  if (node.type === 'image' && node.blobPath) {
    const projectId = _assetsProjectId();
    if (projectId && window.electronAPI?.assetsDeleteFile) {
      try { await window.electronAPI.assetsDeleteFile({ projectId, blobPath: node.blobPath }); } catch (_) {}
    }
    window._assetsImgCache?.delete(node.id);
  } else if (node.type === 'folder' && Array.isArray(node.children)) {
    for (const c of node.children) await _assetsRemoveNodeRecursive(c);
  }
}

async function assetsRemoveNode(id) {
  const f = assetsFindNode(id);
  if (!f) return;
  await _assetsRemoveNodeRecursive(f.node);
  f.parentArr.splice(f.index, 1);
}

/* ── IPC 래퍼 ── */
async function _assetsSaveFile(b64, mime, originalName) {
  const projectId = _assetsProjectId();
  if (!projectId || !window.electronAPI?.assetsSaveFile) return null;
  try {
    const res = await window.electronAPI.assetsSaveFile({ projectId, b64, mime, originalName });
    if (res?.ok) return res;
  } catch (_) {}
  return null;
}

async function _assetsReadFile(blobPath) {
  const projectId = _assetsProjectId();
  if (!projectId || !blobPath || !window.electronAPI?.assetsReadFile) return null;
  try {
    const res = await window.electronAPI.assetsReadFile({ projectId, blobPath });
    if (res?.ok && res.dataUrl) return res.dataUrl;
  } catch (_) {}
  return null;
}

/* dataUrl 캐시 우선 조회 */
async function assetsGetDataUrl(id) {
  if (window._assetsImgCache.has(id)) return window._assetsImgCache.get(id);
  const f = assetsFindNode(id);
  if (!f || f.node.type !== 'image' || !f.node.blobPath) return null;
  const dataUrl = await _assetsReadFile(f.node.blobPath);
  if (dataUrl) window._assetsImgCache.set(id, dataUrl);
  return dataUrl;
}

/* ── File → b64 ── */
function _fileToB64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result || '';
      const idx = String(result).indexOf(',');
      if (idx < 0) return reject(new Error('invalid dataUrl'));
      resolve(String(result).slice(idx + 1));
    };
    reader.onerror = () => reject(reader.error);
    reader.readAsDataURL(file);
  });
}

function _imageNaturalSize(dataUrl) {
  return new Promise(resolve => {
    if (!dataUrl) return resolve({ w: 0, h: 0 });
    const img = new Image();
    img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
    img.onerror = () => resolve({ w: 0, h: 0 });
    img.src = dataUrl;
  });
}

/* ── 공개 API: 폴더/이미지/URL 추가 ── */
function assetsCreateFolder(parentId = null) {
  const id = _assetsGenId();
  const node = { id, type: 'folder', name: '새 폴더', children: [], collapsed: false };
  assetsAddNode(parentId, node);
  buildAssetsPanel();
  window.triggerAutoSave?.();
  // 새 폴더 즉시 이름 편집
  setTimeout(() => {
    const row = document.querySelector(`.assets-row[data-asset-id="${id}"] .assets-row-name`);
    if (row) _assetsBeginInlineRename(row, id);
  }, 0);
  return id;
}

async function assetsAddImageFiles(fileList, parentId = null) {
  const files = Array.from(fileList || []).filter(f => ASSETS_ACCEPT_MIME.includes(f.type) || /\.svg$/i.test(f.name));
  if (files.length === 0) return [];
  const ids = [];
  for (const file of files) {
    try {
      const b64 = await _fileToB64(file);
      const mime = file.type || (/\.svg$/i.test(file.name) ? 'image/svg+xml' : 'image/png');
      const saved = await _assetsSaveFile(b64, mime, file.name);
      if (!saved) continue;
      const node = {
        id: saved.id,
        type: 'image',
        name: file.name,
        originalName: file.name,
        blobPath: saved.blobPath,
        mime: saved.mime || mime,
        addedAt: new Date().toISOString(),
      };
      assetsAddNode(parentId, node);
      ids.push(saved.id);
    } catch (e) {
      console.warn('[assets-panel] file 저장 실패:', file.name, e);
    }
  }
  if (ids.length > 0) {
    buildAssetsPanel();
    window.triggerAutoSave?.();
  }
  return ids;
}

function assetsAddUrl({ title, url, note }, parentId = null) {
  const t = String(title || '').trim();
  const u = String(url || '').trim();
  if (!t || !u) return null;
  const id = _assetsGenId();
  const node = {
    id, type: 'url',
    title: t, url: u, note: String(note || ''),
    addedAt: new Date().toISOString(),
  };
  assetsAddNode(parentId, node);
  buildAssetsPanel();
  window.triggerAutoSave?.();
  return id;
}

async function assetsDeleteNode(id) {
  const f = assetsFindNode(id);
  if (!f) return false;
  const label = f.node.type === 'folder' ? `'${f.node.name}' 폴더와 그 안의 모든 자산을` : `'${f.node.name || f.node.title || ''}' 항목을`;
  if (!window.confirm(`${label} 삭제할까요?`)) return false;
  await assetsRemoveNode(id);
  buildAssetsPanel();
  window.triggerAutoSave?.();
  return true;
}

/* ── 갤러리 import ── */
async function assetsImportFromGallery(galleryIds, parentId = null) {
  const ids = [];
  const gallery = Array.isArray(window.state?.imageGallery) ? window.state.imageGallery : [];
  for (const gid of (galleryIds || [])) {
    const item = gallery.find(g => g.id === gid);
    if (!item || !item.blobPath) continue;
    try {
      // 원본 갤러리 파일을 dataUrl로 읽어 새 파일로 복사 저장
      const projectId = _assetsProjectId();
      if (!projectId || !window.electronAPI?.aiReadImage) continue;
      const r = await window.electronAPI.aiReadImage({ projectId, blobPath: item.blobPath });
      if (!r?.ok || !r.dataUrl) continue;
      const m = String(r.dataUrl).match(/^data:([^;]+);base64,(.*)$/);
      if (!m) continue;
      const mime = m[1], b64 = m[2];
      const saved = await _assetsSaveFile(b64, mime, item.id + (mime === 'image/jpeg' ? '.jpg' : '.png'));
      if (!saved) continue;
      const node = {
        id: saved.id,
        type: 'image',
        name: (item.prompt || item.id || 'image').slice(0, 40) || 'image',
        originalName: item.id,
        blobPath: saved.blobPath,
        mime: saved.mime || mime,
        addedAt: new Date().toISOString(),
      };
      assetsAddNode(parentId, node);
      ids.push(saved.id);
    } catch (e) {
      console.warn('[assets-panel] gallery import 실패:', gid, e);
    }
  }
  if (ids.length > 0) {
    buildAssetsPanel();
    window.triggerAutoSave?.();
  }
  return ids;
}

/* ── 캔버스로 보내기 (선택 섹션 끝에) ── */
async function assetsSendToCanvas(id) {
  const f = assetsFindNode(id);
  if (!f || f.node.type !== 'image') {
    window.showToast?.('⚠️ 이미지 노드만 캔버스로 보낼 수 있습니다.');
    return false;
  }
  const sec = window.getSelectedSection?.();
  if (!sec) { window.showToast?.('⚠️ 캔버스에서 섹션을 먼저 선택해주세요.'); return false; }
  const dataUrl = await assetsGetDataUrl(id);
  if (!dataUrl) { window.showToast?.('❌ 이미지 로드 실패'); return false; }
  window.addAssetBlock?.();
  const blocks = sec.querySelectorAll('.asset-block');
  const ab = blocks[blocks.length - 1];
  if (!ab) { window.showToast?.('❌ 에셋 블록 생성 실패'); return false; }
  window.setAssetImageFromSrc?.(ab, dataUrl);
  window.triggerAutoSave?.();
  window.showToast?.('✨ 캔버스에 삽입됨');
  return true;
}

/* ══════════════════════════════════════
   렌더링
══════════════════════════════════════ */

function _folderIcon() {
  return `<span class="assets-row-thumb-icon" aria-hidden="true">
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round">
      <path d="M1.5 3.5 L5.5 3.5 L6.5 5 L12.5 5 L12.5 11.5 L1.5 11.5 Z"/>
    </svg>
  </span>`;
}

function _urlIcon() {
  return `<span class="assets-row-thumb-icon" aria-hidden="true">
    <svg width="13" height="13" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round">
      <path d="M6 8 L8 6 M5 6 a2 2 0 0 1 0 -3 l1 -1 a2 2 0 0 1 3 0 a2 2 0 0 1 0 3 l-1 1"/>
      <path d="M8 6 a2 2 0 0 1 0 3 l-1 1 a2 2 0 0 1 -3 0 a2 2 0 0 1 0 -3 l1 -1"/>
    </svg>
  </span>`;
}

function _renderTreeNode(node, depth, parentEl) {
  const row = document.createElement('div');
  row.className = 'assets-row assets-row--' + node.type;
  row.dataset.assetId = node.id;
  row.dataset.depth = String(depth);
  row.style.paddingLeft = `calc(8px + ${depth} * 14px)`;

  // chevron 자리
  if (node.type === 'folder') {
    const chev = document.createElement('span');
    chev.className = 'assets-chevron' + (node.collapsed ? ' collapsed' : '');
    chev.innerHTML = '▼';
    chev.title = node.collapsed ? '펼치기' : '접기';
    chev.addEventListener('click', e => {
      e.stopPropagation();
      node.collapsed = !node.collapsed;
      buildAssetsPanel();
      window.triggerAutoSave?.();
    });
    row.appendChild(chev);
  } else {
    const sp = document.createElement('span');
    sp.className = 'assets-chevron-spacer';
    row.appendChild(sp);
  }

  // 썸네일
  if (node.type === 'folder') {
    row.insertAdjacentHTML('beforeend', _folderIcon());
  } else if (node.type === 'url') {
    row.insertAdjacentHTML('beforeend', _urlIcon());
  } else if (node.type === 'image') {
    const thumb = document.createElement('img');
    thumb.className = 'assets-row-thumb';
    thumb.alt = '';
    thumb.draggable = false;
    row.appendChild(thumb);
    // dataUrl 비동기 로드
    assetsGetDataUrl(node.id).then(d => {
      if (d) thumb.src = d;
    });
  }

  // 이름
  const nameEl = document.createElement('span');
  nameEl.className = 'assets-row-name';
  nameEl.textContent = (node.type === 'url' ? node.title : node.name) || '';
  if (node.type === 'url' && node.url) nameEl.title = node.url + (node.note ? '\n' + node.note : '');
  nameEl.addEventListener('dblclick', e => {
    e.stopPropagation();
    _assetsBeginInlineRename(nameEl, node.id);
  });
  row.appendChild(nameEl);

  // 액션
  const actions = document.createElement('div');
  actions.className = 'assets-row-actions';
  const btnRename = `<button data-act="rename" title="이름변경">✎</button>`;
  const btnSend = node.type === 'image' ? `<button data-act="send" title="캔버스로 보내기">↗</button>` : '';
  const btnOpen = node.type === 'url' ? `<button data-act="open" title="링크 열기">↗</button>` : '';
  const btnDel = `<button data-act="delete" title="삭제">🗑</button>`;
  // 폴더 전용 — 리스트/그리드 인라인 토글 (SVG)
  let btnView = '';
  if (node.type === 'folder') {
    const isGrid = node.viewMode === 'grid';
    btnView = isGrid
      ? `<button data-act="view-toggle" title="리스트로" class="assets-view-icon active"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3"><rect x="1" y="1" width="4" height="4"/><rect x="7" y="1" width="4" height="4"/><rect x="1" y="7" width="4" height="4"/><rect x="7" y="7" width="4" height="4"/></svg></button>`
      : `<button data-act="view-toggle" title="그리드로" class="assets-view-icon"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linecap="round"><line x1="2" y1="3" x2="10" y2="3"/><line x1="2" y1="6" x2="10" y2="6"/><line x1="2" y1="9" x2="10" y2="9"/></svg></button>`;
  }
  actions.innerHTML = btnView + btnRename + btnSend + btnOpen + btnDel;
  actions.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    e.stopPropagation();
    const act = btn.dataset.act;
    if (act === 'rename') _assetsBeginInlineRename(nameEl, node.id);
    else if (act === 'send') assetsSendToCanvas(node.id);
    else if (act === 'open' && node.type === 'url') {
      try { window.open(node.url, '_blank'); } catch (_) {}
    } else if (act === 'delete') assetsDeleteNode(node.id);
    else if (act === 'view-toggle' && node.type === 'folder') {
      node.viewMode = (node.viewMode === 'grid') ? 'list' : 'grid';
      if (node.viewMode === 'grid') {
        if (!node.cardSize) node.cardSize = 56;
        if (node.collapsed) node.collapsed = false; // 그리드 켜면 자동 펼침
      }
      buildAssetsPanel();
      window.triggerAutoSave?.();
    }
  });
  row.appendChild(actions);

  // mousedown — 캔버스 드래그(이미지) + 트리 내부 이동(폴더 포함)
  row.addEventListener('mousedown', e => {
    if (e.button !== 0) return;
    // 액션/체브론 클릭은 제외
    if (e.target.closest('.assets-row-actions, .assets-chevron')) return;
    if (e.target.closest('.assets-row-name[contenteditable="true"]')) return;
    _assetsBeginRowDrag(node.id, e);
  });

  // HTML5 native drag — 다른 폴더 이동 + 캔버스(scratch) cross-element drop
  if (node.type === 'image' || node.type === 'folder') {
    row.draggable = true;
    row.addEventListener('dragstart', e => {
      // 액션/체브론/rename 영역에서 시작하면 native drag 막음 (오동작 방지)
      if (e.target.closest && (
        e.target.closest('.assets-row-actions') ||
        e.target.closest('.assets-chevron') ||
        e.target.closest('.assets-row-name[contenteditable="true"]')
      )) {
        e.preventDefault();
        return;
      }
      e.dataTransfer.setData('application/x-goditor-asset', JSON.stringify({ assetId: node.id, kind: node.type }));
      e.dataTransfer.effectAllowed = 'copyMove';
      if (node.type === 'image') {
        const thumb = row.querySelector('.assets-row-thumb');
        try { if (thumb) e.dataTransfer.setDragImage(thumb, 16, 16); } catch (_) {}
      }
    });
  }

  // click — 선택 (chevron/actions/rename input 영역 제외)
  row.addEventListener('click', e => {
    if (e.target.closest('.assets-row-actions, .assets-chevron')) return;
    if (e.target.closest('.assets-row-name[contenteditable="true"]')) return;
    _assetsHandleSelectClick(node.id, e);
  });

  parentEl.appendChild(row);

  // 자식
  if (node.type === 'folder' && !node.collapsed && Array.isArray(node.children) && node.children.length > 0) {
    if (node.viewMode === 'grid') {
      // 인라인 그리드 + slider strip
      const wrap = document.createElement('div');
      wrap.className = 'assets-inline-grid-wrap';
      wrap.style.paddingLeft = `calc(20px + ${depth} * 14px)`;

      const cardSize = node.cardSize || 56;

      const strip = document.createElement('div');
      strip.className = 'assets-inline-grid-strip';
      strip.innerHTML = `<input type="range" min="40" max="160" step="8" value="${cardSize}" class="assets-card-size" title="카드 크기 ${cardSize}px"><span class="assets-card-size-val">${cardSize}px</span>`;
      const slider = strip.querySelector('input');
      const sizeLabel = strip.querySelector('.assets-card-size-val');
      slider.addEventListener('input', e => {
        const v = parseInt(e.target.value, 10);
        node.cardSize = v;
        const grid = wrap.querySelector('.assets-grid');
        if (grid) grid.style.setProperty('--assets-card-size', v + 'px');
        if (sizeLabel) sizeLabel.textContent = v + 'px';
        slider.title = '카드 크기 ' + v + 'px';
        window.triggerAutoSave?.();
      });
      wrap.appendChild(strip);

      const grid = document.createElement('div');
      grid.className = 'assets-grid';
      grid.style.setProperty('--assets-card-size', cardSize + 'px');
      node.children.forEach(c => grid.appendChild(_buildGridCard(c)));
      wrap.appendChild(grid);

      parentEl.appendChild(wrap);
    } else {
      node.children.forEach(c => _renderTreeNode(c, depth + 1, parentEl));
    }
  }
}

function _assetsBeginInlineRename(nameEl, id) {
  const f = assetsFindNode(id);
  if (!f) return;
  const cur = f.node.type === 'url' ? f.node.title : f.node.name;
  nameEl.setAttribute('contenteditable', 'true');
  nameEl.textContent = cur || '';
  nameEl.focus();
  const range = document.createRange();
  range.selectNodeContents(nameEl);
  const sel = window.getSelection();
  sel.removeAllRanges();
  sel.addRange(range);

  let done = false;
  const finish = (commit) => {
    if (done) return;
    done = true;
    nameEl.removeAttribute('contenteditable');
    if (commit) {
      const next = String(nameEl.textContent || '').trim();
      if (next && next !== cur) {
        assetsRenameNode(id, next);
        window.triggerAutoSave?.();
      } else {
        nameEl.textContent = cur || '';
      }
    } else {
      nameEl.textContent = cur || '';
    }
    nameEl.removeEventListener('keydown', onKey);
    nameEl.removeEventListener('blur', onBlur);
  };
  function onKey(ev) {
    if (ev.key === 'Enter') { ev.preventDefault(); finish(true); }
    else if (ev.key === 'Escape') { ev.preventDefault(); finish(false); }
  }
  function onBlur() { finish(true); }
  nameEl.addEventListener('keydown', onKey);
  nameEl.addEventListener('blur', onBlur);
}

/* ══════════════════════════════════════
   액션바 + 패널 빌드
══════════════════════════════════════ */

function buildAssetsPanel() {
  const host = document.getElementById('assets-panel-body');
  if (!host) return;

  const tree = _assetsTreeRef();

  // 기존 컨텐츠 제거 (innerHTML — 좌측 패널 내부에만 한정, 캔버스 아님)
  host.innerHTML = '';

  // 액션바
  const bar = document.createElement('div');
  bar.className = 'assets-actionbar';
  bar.innerHTML = `
    <button class="assets-action-btn" data-act="new-folder" title="새 폴더">+ 폴더</button>
    <button class="assets-action-btn" data-act="new-file"   title="파일 추가">+ 파일</button>
    <button class="assets-action-btn" data-act="new-url"    title="URL 추가">+ URL</button>
  `;
  host.appendChild(bar);

  // hidden file input
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.multiple = true;
  fileInput.accept = ASSETS_ACCEPT_ATTR;
  fileInput.style.display = 'none';
  fileInput.addEventListener('change', async () => {
    const files = Array.from(fileInput.files || []);
    if (files.length > 0) await assetsAddImageFiles(files, null);
    fileInput.value = '';
  });
  host.appendChild(fileInput);

  bar.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;
    if (act === 'new-folder') assetsCreateFolder(null);
    else if (act === 'new-file') fileInput.click();
    else if (act === 'new-url') _assetsShowUrlPopover(bar);
    else if (act === 'import') _assetsShowImportModal();
  });

  // 트리 컨테이너
  const treeEl = document.createElement('div');
  treeEl.className = 'assets-tree';
  treeEl.id = 'assets-tree-root';
  host.appendChild(treeEl);

  if (tree.length === 0) {
    const empty = document.createElement('div');
    empty.className = 'assets-tree-empty';
    empty.innerHTML = '아직 자산이 없습니다.<br>+ 폴더 / + 파일 / + URL 로 추가하거나<br>Finder에서 파일을 끌어다 놓으세요.';
    treeEl.appendChild(empty);
  } else {
    tree.forEach(n => _renderTreeNode(n, 0, treeEl));
  }

  // 외부 파일 드롭 — Files 타입만 수신
  _bindExternalFileDrop(treeEl);
  // 선택 클래스 재적용 (rebuild 후 visual state 유지)
  _assetsReapplySelectionClasses();
}

/* ── 외부 파일(Finder) 드래그 + scratch → asset 폴더 드롭 ── */
function _bindExternalFileDrop(treeEl, defaultParentId = null) {
  let overTimer = null;
  const _isExternalFile = dt => dt && Array.from(dt.types || []).includes('Files');
  const _isScratchDrag = dt => dt && Array.from(dt.types || []).includes('application/x-goditor-scratch');
  const _isAssetDrag = dt => dt && Array.from(dt.types || []).includes('application/x-goditor-asset');
  const _resolveDropParent = (e) => {
    const row = e.target.closest && e.target.closest('.assets-row--folder');
    if (row) return row.dataset.assetId;
    const gridFolder = e.target.closest && e.target.closest('.assets-grid-card--folder');
    if (gridFolder) return gridFolder.dataset.assetId;
    const wrap = e.target.closest && e.target.closest('.assets-inline-grid-wrap');
    if (wrap) {
      const sibling = wrap.previousElementSibling;
      if (sibling && sibling.classList.contains('assets-row--folder')) return sibling.dataset.assetId;
    }
    return defaultParentId;
  };

  const onOver = e => {
    if (!_isExternalFile(e.dataTransfer) && !_isScratchDrag(e.dataTransfer) && !_isAssetDrag(e.dataTransfer)) return;
    e.preventDefault();
    e.dataTransfer.dropEffect = _isAssetDrag(e.dataTransfer) ? 'move' : 'copy';
    treeEl.classList.add('assets-drop-target');
    const row = (e.target.closest && e.target.closest('.assets-row--folder'))
      || (e.target.closest && e.target.closest('.assets-grid-card--folder'));
    treeEl.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
    if (row) row.classList.add('assets-row--drop-into');
    clearTimeout(overTimer);
    overTimer = setTimeout(() => treeEl.classList.remove('assets-drop-target'), 200);
  };
  const onLeave = () => {
    treeEl.classList.remove('assets-drop-target');
    treeEl.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
  };
  const onDrop = async e => {
    // 0) asset → asset 폴더 (트리 내 노드 이동)
    if (_isAssetDrag(e.dataTransfer)) {
      e.preventDefault();
      treeEl.classList.remove('assets-drop-target');
      treeEl.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData('application/x-goditor-asset') || '{}'); } catch (_) { payload = null; }
      if (!payload?.assetId) return;
      const newParentId = _resolveDropParent(e);
      // 자기 자신으로 이동, 자기 자손으로 이동, 동일 부모면 noop
      if (newParentId === payload.assetId) return;
      const found = _assetsFindNodeById(payload.assetId);
      if (!found) return;
      const currentParentId = found.parent ? found.parent.id : null;
      if (currentParentId === newParentId) return; // 같은 부모면 무동작
      if (newParentId && _assetsIsDescendant(payload.assetId, newParentId)) return; // 사이클 가드
      assetsMoveNode(payload.assetId, newParentId, null);
      buildAssetsPanel();
      window.triggerAutoSave?.();
      return;
    }
    // 1) scratch 카드 → asset 폴더
    if (_isScratchDrag(e.dataTransfer)) {
      e.preventDefault();
      treeEl.classList.remove('assets-drop-target');
      treeEl.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
      let payload;
      try { payload = JSON.parse(e.dataTransfer.getData('application/x-goditor-scratch') || '{}'); } catch (_) { payload = null; }
      if (!payload?.src) return;
      const parentId = _resolveDropParent(e);
      try {
        // dataURL 직접 파싱 — fetch round-trip 회피 (Codex #7)
        const blob = _dataUrlToBlobInline(payload.src) || await (await fetch(payload.src)).blob();
        const mime = blob.type || 'image/png';
        const ext = mime.includes('svg') ? 'svg' : (mime.includes('png') ? 'png' : (mime.includes('jpeg') ? 'jpg' : 'img'));
        const name = 'scratch_' + (payload.scratchId || Date.now()) + '.' + ext;
        const file = new File([blob], name, { type: mime });
        await assetsAddImageFiles([file], parentId);
      } catch (err) {
        console.warn('[assets] scratch drop 실패:', err);
      }
      return;
    }
    // 2) 외부 파일 (기존)
    if (!_isExternalFile(e.dataTransfer)) return;
    e.preventDefault();
    treeEl.classList.remove('assets-drop-target');
    treeEl.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
    const parentId = _resolveDropParent(e);
    await assetsAddImageFiles(e.dataTransfer.files, parentId);
  };
  treeEl.addEventListener('dragover', onOver);
  treeEl.addEventListener('dragleave', onLeave);
  treeEl.addEventListener('drop', onDrop);
}

/* ══════════════════════════════════════
   URL 추가 popover
══════════════════════════════════════ */
function _assetsShowUrlPopover(anchorBar) {
  // 기존 popover 제거
  document.querySelectorAll('.assets-url-popover').forEach(p => p.remove());
  const host = document.getElementById('assets-panel-body');
  if (!host) return;
  // 호스트 컨테이너에 절대 위치로 부착
  host.style.position = host.style.position || 'relative';
  const pop = document.createElement('div');
  pop.className = 'assets-url-popover';
  pop.innerHTML = `
    <input type="text" data-fld="title" placeholder="제목" />
    <input type="text" data-fld="url" placeholder="https://example.com" />
    <textarea data-fld="note" placeholder="메모 (선택)"></textarea>
    <div class="assets-url-popover-actions">
      <button data-act="cancel">취소</button>
      <button class="assets-url-popover-ok" data-act="ok">추가</button>
    </div>
  `;
  host.appendChild(pop);
  const inputs = {
    title: pop.querySelector('[data-fld="title"]'),
    url:   pop.querySelector('[data-fld="url"]'),
    note:  pop.querySelector('[data-fld="note"]'),
  };
  inputs.title.focus();
  const close = () => { pop.remove(); document.removeEventListener('mousedown', onOutside, true); };
  function onOutside(ev) {
    if (!pop.contains(ev.target) && !anchorBar.contains(ev.target)) close();
  }
  setTimeout(() => document.addEventListener('mousedown', onOutside, true), 0);
  pop.addEventListener('click', e => {
    const btn = e.target.closest('button[data-act]');
    if (!btn) return;
    if (btn.dataset.act === 'cancel') return close();
    if (btn.dataset.act === 'ok') {
      const t = inputs.title.value.trim();
      const u = inputs.url.value.trim();
      if (!t || !u) { window.showToast?.('⚠️ 제목과 URL은 필수입니다.'); return; }
      assetsAddUrl({ title: t, url: u, note: inputs.note.value }, null);
      close();
    }
  });
  pop.addEventListener('keydown', e => {
    if (e.key === 'Escape') close();
    else if (e.key === 'Enter' && (e.target.tagName === 'INPUT')) {
      e.preventDefault();
      pop.querySelector('[data-act="ok"]').click();
    }
  });
}

/* ══════════════════════════════════════
   AI Images Import 모달
══════════════════════════════════════ */
async function _assetsShowImportModal() {
  document.querySelectorAll('.assets-import-modal-backdrop').forEach(b => b.remove());
  const back = document.createElement('div');
  back.className = 'assets-import-modal-backdrop';
  const modal = document.createElement('div');
  modal.className = 'assets-import-modal';
  modal.innerHTML = `
    <div class="assets-import-header">
      <span>AI Images에서 가져오기</span>
      <button class="assets-import-close" title="닫기">×</button>
    </div>
    <div class="assets-import-body"></div>
    <div class="assets-import-footer">
      <span class="assets-import-count">선택: 0</span>
      <div class="assets-import-footer-actions">
        <button data-act="import" disabled>가져오기</button>
      </div>
    </div>
  `;
  back.appendChild(modal);
  document.body.appendChild(back);

  const body = modal.querySelector('.assets-import-body');
  const countEl = modal.querySelector('.assets-import-count');
  const importBtn = modal.querySelector('button[data-act="import"]');
  const closeBtn  = modal.querySelector('.assets-import-close');

  const gallery = Array.isArray(window.state?.imageGallery) ? window.state.imageGallery : [];
  const projectId = _assetsProjectId();
  const selected = new Set();

  const close = () => back.remove();
  back.addEventListener('mousedown', e => { if (e.target === back) close(); });
  closeBtn.addEventListener('click', close);

  if (gallery.length === 0) {
    body.innerHTML = `<div class="assets-import-empty">AI Images 갤러리에 이미지가 없습니다.</div>`;
  } else {
    const sorted = [...gallery].sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')));
    sorted.forEach(item => {
      const cell = document.createElement('div');
      cell.className = 'assets-import-cell';
      cell.dataset.imgId = item.id;
      cell.title = (item.prompt || '').slice(0, 60);
      body.appendChild(cell);
      // 썸네일 로드 — 캐시 활용
      const cached = window._aiImgCache?.get(item.id);
      if (cached) cell.style.backgroundImage = `url("${cached}")`;
      else if (projectId && item.blobPath && window.electronAPI?.aiReadImage) {
        window.electronAPI.aiReadImage({ projectId, blobPath: item.blobPath }).then(r => {
          if (r?.ok && r.dataUrl) {
            window._aiImgCache?.set(item.id, r.dataUrl);
            cell.style.backgroundImage = `url("${r.dataUrl}")`;
          }
        }).catch(() => {});
      }
      cell.addEventListener('click', () => {
        if (selected.has(item.id)) { selected.delete(item.id); cell.classList.remove('is-selected'); }
        else { selected.add(item.id); cell.classList.add('is-selected'); }
        countEl.textContent = '선택: ' + selected.size;
        importBtn.disabled = selected.size === 0;
      });
    });
  }

  importBtn.addEventListener('click', async () => {
    if (selected.size === 0) return;
    importBtn.disabled = true;
    importBtn.textContent = '가져오는 중...';
    try {
      const ids = await assetsImportFromGallery([...selected], null);
      window.showToast?.(`📥 ${ids.length}장 가져옴`);
    } finally {
      close();
    }
  });
}

/* ══════════════════════════════════════
   캔버스 / 트리 드래그 (mousedown 패턴)
══════════════════════════════════════ */
function _assetsBeginRowDrag(id, mouseEvent) {
  const f = assetsFindNode(id);
  if (!f) return;
  const startX = mouseEvent.clientX;
  const startY = mouseEvent.clientY;
  const THRESHOLD = 6;

  let started = false;
  let mode = null; // 'canvas' or 'tree'
  let ghostEl = null;
  let dataUrl = null;
  let natW = 0, natH = 0;
  let dropOk = false;

  // 사전 fetch (이미지 노드만)
  let dataUrlPromise = null;
  if (f.node.type === 'image') {
    dataUrlPromise = assetsGetDataUrl(id).then(d => { dataUrl = d; });
  }

  // 트리 드롭 하이라이트
  const treeEl = document.getElementById('assets-tree-root');

  const onMove = async (ev) => {
    const dx = Math.abs(ev.clientX - startX);
    const dy = Math.abs(ev.clientY - startY);
    if (!started && Math.max(dx, dy) < THRESHOLD) return;
    if (!started) {
      started = true;
      // 모드 판정: 첫 movement의 elementFromPoint이 트리 안이면 트리 이동, 아니면 캔버스(이미지일 때만)
      const hitNow = document.elementFromPoint(ev.clientX, ev.clientY);
      const overTree = hitNow && hitNow.closest && hitNow.closest('#assets-tree-root');
      const overCanvas = hitNow && hitNow.closest && hitNow.closest('#canvas-scaler');
      if (overTree && !overCanvas) {
        mode = 'tree';
      } else if (f.node.type === 'image') {
        mode = 'canvas';
      } else {
        // 폴더/URL은 트리 모드만
        mode = 'tree';
      }
      if (mode === 'canvas') {
        // dataUrl 준비 대기
        if (dataUrlPromise) await dataUrlPromise;
        ghostEl = document.createElement('div');
        ghostEl.className = 'assets-drag-ghost';
        if (dataUrl) ghostEl.style.backgroundImage = `url("${dataUrl}")`;
        document.body.appendChild(ghostEl);
        // 이미지 자연 크기 측정
        if (dataUrl) {
          const sz = await _imageNaturalSize(dataUrl);
          natW = sz.w; natH = sz.h;
        }
      }
    }
    if (mode === 'canvas') {
      if (ghostEl) {
        ghostEl.style.left = ev.clientX + 'px';
        ghostEl.style.top  = ev.clientY + 'px';
      }
      try { window.previewScratchDropAt?.(ev.clientX, ev.clientY); } catch (_) {}
    } else if (mode === 'tree') {
      // 트리 내부 이동 — 폴더 행 위 하이라이트
      treeEl?.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
      const row = ev.target.closest && ev.target.closest('.assets-row');
      if (row && row.dataset.assetId !== id) {
        if (row.classList.contains('assets-row--folder')) row.classList.add('assets-row--drop-into');
      }
    }
  };

  const onUp = async (ev) => {
    document.removeEventListener('mousemove', onMove);
    document.removeEventListener('mouseup', onUp);

    if (!started) return; // 클릭 — 아무 동작 안 함

    if (mode === 'canvas') {
      if (ghostEl) ghostEl.remove();
      try {
        // 1) 기존 섹션/블록 위면 commitScratchDropAt이 처리
        const ok = window.commitScratchDropAt?.(ev.clientX, ev.clientY, dataUrl, { naturalWidth: natW, naturalHeight: natH });
        if (ok) {
          dropOk = true;
          window.showToast?.('✨ 캔버스에 삽입됨');
        } else {
          // 2) 빈 캔버스 영역인지 확인 — #canvas-scaler 안인지 검사
          const hit = document.elementFromPoint(ev.clientX, ev.clientY);
          const inScaler = hit && hit.closest && hit.closest('#canvas-scaler');
          if (inScaler && dataUrl) {
            // 새 섹션 생성 + 그 안에 asset-block + 이미지 src
            const beforeCount = document.querySelectorAll('#canvas .section-block').length;
            window.addSection?.({ skipDefaultBlock: true });
            const sections = document.querySelectorAll('#canvas .section-block');
            const sec = sections[sections.length - 1];
            if (sec) {
              window.selectSection?.(sec);
              window.addAssetBlock?.();
              const blocks = sec.querySelectorAll('.asset-block');
              const ab = blocks[blocks.length - 1];
              if (ab) {
                window.setAssetImageFromSrc?.(ab, dataUrl);
                dropOk = true;
                window.showToast?.('✨ 새 섹션에 삽입됨');
              }
            }
            window.triggerAutoSave?.();
          }
        }
      } catch (e) {
        console.warn('[assets-panel] canvas drop 실패:', e);
      }
      try { window.clearScratchDropGuides?.(); } catch (_) {}
    } else if (mode === 'tree') {
      treeEl?.querySelectorAll('.assets-row--drop-into').forEach(r => r.classList.remove('assets-row--drop-into'));
      const hit = document.elementFromPoint(ev.clientX, ev.clientY);
      const overTree = hit && hit.closest && hit.closest('#assets-tree-root');
      if (!overTree) return;
      const targetRow = hit.closest('.assets-row');
      if (!targetRow) {
        // 트리 빈 영역 → 루트로 이동
        assetsMoveNode(id, null, null);
      } else if (targetRow.dataset.assetId !== id) {
        if (targetRow.classList.contains('assets-row--folder')) {
          // 폴더 위로 → 그 폴더 children 끝에
          assetsMoveNode(id, targetRow.dataset.assetId, null);
        } else {
          // 같은 형제 위치로
          const targetId = targetRow.dataset.assetId;
          const tInfo = assetsFindNode(targetId);
          if (tInfo) {
            const newParentId = tInfo.parent ? tInfo.parent.id : null;
            assetsMoveNode(id, newParentId, targetId);
          }
        }
      }
      buildAssetsPanel();
      window.triggerAutoSave?.();
    }
  };

  document.addEventListener('mousemove', onMove);
  document.addEventListener('mouseup', onUp);
}

function _buildGridCard(node) {
  const card = document.createElement('div');
  card.className = 'assets-grid-card assets-grid-card--' + node.type;
  card.dataset.assetId = node.id;
  card.title = (node.type === 'url' ? (node.title || node.url || '') : (node.name || '')) || '';

  const thumbBox = document.createElement('div');
  thumbBox.className = 'assets-grid-thumb';
  if (node.type === 'folder') {
    thumbBox.innerHTML = _folderIconLarge();
  } else if (node.type === 'url') {
    thumbBox.innerHTML = _urlIconLarge();
  } else if (node.type === 'image') {
    const img = document.createElement('img');
    img.alt = '';
    img.draggable = false;
    thumbBox.appendChild(img);
    assetsGetDataUrl(node.id).then(d => { if (d) img.src = d; });
  }
  card.appendChild(thumbBox);

  const name = document.createElement('div');
  name.className = 'assets-grid-name';
  name.textContent = (node.type === 'url' ? node.title : node.name) || '';
  card.appendChild(name);

  // 단일 클릭 = 선택 (다중: ⌘+클릭 / Shift+범위)
  card.addEventListener('click', e => {
    _assetsHandleSelectClick(node.id, e);
  });

  if (node.type === 'folder') {
    // 폴더도 grid 카드 자체 draggable — 다른 폴더 위로 끌어 이동 가능 (assetsMoveNode)
    card.draggable = true;
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/x-goditor-asset', JSON.stringify({ assetId: node.id, kind: 'folder' }));
      e.dataTransfer.effectAllowed = 'copyMove';
    });
  } else if (node.type === 'image') {
    card.addEventListener('dblclick', () => assetsSendToCanvas(node.id));
    // Assets → Scratch (canvas) + Assets → 다른 폴더(이동) 둘 다 같은 MIME
    card.draggable = true;
    card.addEventListener('dragstart', e => {
      e.dataTransfer.setData('application/x-goditor-asset', JSON.stringify({ assetId: node.id, kind: 'image' }));
      e.dataTransfer.effectAllowed = 'copyMove';
      const imgEl = card.querySelector('img');
      try { if (imgEl) e.dataTransfer.setDragImage(imgEl, 20, 20); } catch (_) {}
    });
  } else if (node.type === 'url') {
    card.addEventListener('dblclick', () => { try { window.open(node.url, '_blank'); } catch(_){} });
  }
  return card;
}

function _folderIconLarge() {
  return `<svg viewBox="0 0 100 80" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
    <path d="M8 24 L8 70 Q8 76 14 76 L86 76 Q92 76 92 70 L92 30 Q92 24 86 24 L48 24 L40 14 Q38 12 36 12 L14 12 Q8 12 8 18 Z" fill="#f4c450" stroke="#c89a25" stroke-width="1"/>
    <path d="M8 28 L8 18 Q8 12 14 12 L36 12 Q38 12 40 14 L48 24 L86 24 Q92 24 92 30 L92 32 L8 32 Z" fill="#e8b03f" opacity="0.55"/>
  </svg>`;
}

function _urlIconLarge() {
  return `<svg viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true">
    <path d="M10 14a3.5 3.5 0 0 0 5 0l3-3a3.5 3.5 0 0 0-5-5l-1.5 1.5"/>
    <path d="M14 10a3.5 3.5 0 0 0-5 0l-3 3a3.5 3.5 0 0 0 5 5l1.5-1.5"/>
  </svg>`;
}

/* ══════════════════════════════════════
   공개 노출
══════════════════════════════════════ */
window.buildAssetsPanel        = buildAssetsPanel;
window.assetsCreateFolder      = assetsCreateFolder;
window.assetsAddImageFiles     = assetsAddImageFiles;
window.assetsAddUrl            = assetsAddUrl;
window.assetsRenameNode        = assetsRenameNode;
window.assetsDeleteNode        = assetsDeleteNode;
window.assetsMoveNode          = assetsMoveNode;
window.assetsImportFromGallery = assetsImportFromGallery;
window.assetsSendToCanvas      = assetsSendToCanvas;
window.assetsGetDataUrl        = assetsGetDataUrl;
window.assetsFindNode          = assetsFindNode;
window.assetsAddNode           = assetsAddNode;
window.assetsRemoveNode        = assetsRemoveNode;

// 트리 전체 폴더 목록 (scratch 우클릭 메뉴 등에서 사용)
window.assetsGetAllFolders = function () {
  const out = [];
  const walk = (arr, depth) => {
    if (!arr) return;
    for (const n of arr) {
      if (n.type === 'folder') {
        out.push({ id: n.id, name: n.name || '', depth });
        if (Array.isArray(n.children)) walk(n.children, depth + 1);
      }
    }
  };
  walk(_assetsTreeRef(), 0);
  return out;
};

// 초기 렌더 (state.assetsTree는 globals.js에서 [] 초기화됨)
document.addEventListener('DOMContentLoaded', () => {
  buildAssetsPanel();
  _assetsBindGlobalKeydown();
});
