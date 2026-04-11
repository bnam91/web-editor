// Iconify Panel — 아이콘 검색 모달 + 삽입

const ICONIFY_API = 'https://api.iconify.design';

const COLLECTIONS = [
  { id: '',                  label: 'All' },
  { id: 'mdi',               label: 'Material Design' },
  { id: 'material-symbols',  label: 'Material Symbols' },
  { id: 'heroicons',         label: 'Heroicons' },
  { id: 'lucide',            label: 'Lucide' },
  { id: 'ph',                label: 'Phosphor' },
  { id: 'tabler',            label: 'Tabler' },
  { id: 'bi',                label: 'Bootstrap' },
  { id: 'feather',           label: 'Feather' },
  { id: 'ion',               label: 'Ionicons' },
  { id: 'ri',                label: 'Remix Icons' },
];

let _modal = null;
let _selectedIcon = null;  // { name: 'mdi:home', svgUrl: '...' }
let _searchTimer = null;
let _currentQuery = '';
let _currentPrefix = '';

function _createModal() {
  const el = document.createElement('div');
  el.id = 'iconify-modal';
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:12px;width:520px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <!-- Header -->
      <div style="display:flex;align-items:center;gap:10px;padding:14px 16px 0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5" style="flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="iconify-search-input" type="text" placeholder="아이콘 검색... (예: home, arrow, star)"
          style="flex:1;background:#0e0e0e;border:1px solid #333;border-radius:6px;color:#ddd;font-size:13px;padding:7px 10px;outline:none;font-family:Pretendard,-apple-system,sans-serif;">
        <button id="iconify-close-btn" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:4px;line-height:1;">✕</button>
      </div>

      <!-- Collection filter -->
      <div style="padding:10px 16px 0;display:flex;gap:6px;flex-wrap:wrap;" id="iconify-collection-filter">
        ${COLLECTIONS.map(c => `
          <button class="iconify-col-btn${c.id === '' ? ' active' : ''}" data-prefix="${c.id}"
            style="background:${c.id===''?'#2563eb':'#222'};border:1px solid ${c.id===''?'#2563eb':'#333'};color:${c.id===''?'#fff':'#aaa'};border-radius:4px;font-size:10px;padding:3px 8px;cursor:pointer;font-family:Pretendard,-apple-system,sans-serif;white-space:nowrap;">
            ${c.label}
          </button>`).join('')}
      </div>

      <!-- Icon grid -->
      <div id="iconify-grid" style="flex:1;overflow-y:auto;padding:12px 16px;display:grid;grid-template-columns:repeat(8,1fr);gap:6px;min-height:200px;max-height:360px;">
        <div style="grid-column:1/-1;text-align:center;color:#555;font-size:12px;padding:40px 0;font-family:Pretendard,-apple-system,sans-serif;">
          위에서 아이콘을 검색해보세요
        </div>
      </div>

      <!-- Footer -->
      <div style="padding:12px 16px;border-top:1px solid #222;display:flex;align-items:center;gap:10px;">
        <div id="iconify-selected-preview" style="width:36px;height:36px;background:#111;border:1px solid #333;border-radius:6px;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>
        </div>
        <span id="iconify-selected-name" style="flex:1;font-size:11px;color:#666;font-family:Pretendard,-apple-system,sans-serif;">선택된 아이콘 없음</span>
        <label style="font-size:11px;color:#888;font-family:Pretendard,-apple-system,sans-serif;">크기</label>
        <input id="iconify-size-input" type="number" value="64" min="16" max="512" step="8"
          style="width:56px;background:#111;border:1px solid #333;border-radius:4px;color:#ddd;font-size:12px;padding:5px 7px;text-align:center;font-family:Pretendard,-apple-system,sans-serif;">
        <span style="font-size:11px;color:#666;font-family:Pretendard,-apple-system,sans-serif;">px</span>
        <button id="iconify-insert-btn"
          style="background:#2563eb;border:none;border-radius:6px;color:#fff;font-size:12px;padding:7px 18px;cursor:pointer;font-weight:600;font-family:Pretendard,-apple-system,sans-serif;opacity:0.4;" disabled>
          삽입
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

function openIconifyModal() {
  if (!_modal) {
    _modal = _createModal();
    _bindModalEvents();
  }
  _selectedIcon = null;
  _updateSelectedPreview(null);
  _modal.style.display = 'flex';
  setTimeout(() => document.getElementById('iconify-search-input')?.focus(), 50);
}
window.openIconifyModal = openIconifyModal;

function closeIconifyModal() {
  if (_modal) _modal.style.display = 'none';
}
window.closeIconifyModal = closeIconifyModal;

function _bindModalEvents() {
  // 닫기
  document.getElementById('iconify-close-btn').addEventListener('click', closeIconifyModal);
  _modal.addEventListener('click', e => { if (e.target === _modal) closeIconifyModal(); });

  // 검색 입력 (debounce 400ms)
  const searchInput = document.getElementById('iconify-search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _currentQuery = searchInput.value.trim();
    if (!_currentQuery) { _setGridMessage('위에서 아이콘을 검색해보세요'); return; }
    _setGridMessage('검색 중...');
    _searchTimer = setTimeout(() => _doSearch(_currentQuery, _currentPrefix), 400);
  });
  searchInput.addEventListener('keydown', e => { if (e.key === 'Escape') closeIconifyModal(); });

  // 컬렉션 필터
  document.getElementById('iconify-collection-filter').addEventListener('click', e => {
    const btn = e.target.closest('.iconify-col-btn');
    if (!btn) return;
    _currentPrefix = btn.dataset.prefix;
    document.querySelectorAll('.iconify-col-btn').forEach(b => {
      const active = b === btn;
      b.style.background   = active ? '#2563eb' : '#222';
      b.style.borderColor  = active ? '#2563eb' : '#333';
      b.style.color        = active ? '#fff'    : '#aaa';
    });
    if (_currentQuery) _doSearch(_currentQuery, _currentPrefix);
  });

  // 아이콘 그리드 클릭
  document.getElementById('iconify-grid').addEventListener('click', e => {
    const cell = e.target.closest('.iconify-icon-cell');
    if (!cell) return;
    document.querySelectorAll('.iconify-icon-cell.sel').forEach(c => c.classList.remove('sel'));
    cell.classList.add('sel');
    _selectedIcon = { name: cell.dataset.iconName };
    _updateSelectedPreview(cell.dataset.iconName);
  });

  // 삽입
  document.getElementById('iconify-insert-btn').addEventListener('click', _doInsert);

  // 그리드 더블클릭 → 바로 삽입
  document.getElementById('iconify-grid').addEventListener('dblclick', e => {
    const cell = e.target.closest('.iconify-icon-cell');
    if (!cell) return;
    _selectedIcon = { name: cell.dataset.iconName };
    _doInsert();
  });
}

async function _doSearch(query, prefix) {
  try {
    const url = `${ICONIFY_API}/search?query=${encodeURIComponent(query)}&limit=80${prefix ? `&prefix=${prefix}` : ''}`;
    const res  = await fetch(url);
    const data = await res.json();
    _renderGrid(data.icons || []);
  } catch {
    _setGridMessage('검색 실패. 네트워크를 확인해주세요.');
  }
}

function _renderGrid(icons) {
  const grid = document.getElementById('iconify-grid');
  if (!icons.length) { _setGridMessage('검색 결과가 없습니다.'); return; }

  grid.innerHTML = icons.map(name => {
    const [prefix, iconName] = name.split(':');
    const svgUrl = `${ICONIFY_API}/${prefix}/${iconName}.svg`;
    return `
      <div class="iconify-icon-cell" data-icon-name="${name}"
        style="aspect-ratio:1;background:#111;border:1px solid #222;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color 0.1s,background 0.1s;"
        title="${name}">
        <img src="${svgUrl}" width="24" height="24" style="filter:invert(0.75);pointer-events:none;" loading="lazy" alt="${name}">
      </div>
    `;
  }).join('');
}

function _setGridMessage(msg) {
  const grid = document.getElementById('iconify-grid');
  grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#555;font-size:12px;padding:40px 0;font-family:Pretendard,-apple-system,sans-serif;">${msg}</div>`;
}

function _updateSelectedPreview(iconName) {
  const preview  = document.getElementById('iconify-selected-preview');
  const nameEl   = document.getElementById('iconify-selected-name');
  const insertBtn = document.getElementById('iconify-insert-btn');

  if (!iconName) {
    preview.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    nameEl.textContent = '선택된 아이콘 없음';
    insertBtn.disabled = true;
    insertBtn.style.opacity = '0.4';
    return;
  }

  const [prefix, name] = iconName.split(':');
  const svgUrl = `${ICONIFY_API}/${prefix}/${name}.svg`;
  preview.innerHTML = `<img src="${svgUrl}" width="22" height="22" style="filter:invert(0.8);">`;
  nameEl.textContent = iconName;
  nameEl.style.color = '#ccc';
  insertBtn.disabled = false;
  insertBtn.style.opacity = '1';
}

async function _doInsert() {
  if (!_selectedIcon) return;
  const size = Math.min(512, Math.max(16, parseInt(document.getElementById('iconify-size-input').value) || 64));
  const name = _selectedIcon.name;
  const [prefix, iconName] = name.split(':');

  try {
    // SVG 콘텐츠 fetch (인라인 삽입)
    const res = await fetch(`${ICONIFY_API}/${prefix}/${iconName}.svg`);
    const svgText = await res.text();
    closeIconifyModal();
    window.addIconifyBlock(name, svgText, size);
  } catch {
    // fetch 실패 시 img fallback
    const svgText = `<img src="${ICONIFY_API}/${prefix}/${iconName}.svg" width="${size}" height="${size}" style="display:block;">`;
    closeIconifyModal();
    window.addIconifyBlock(name, svgText, size);
  }
}

// 그리드 셀 hover CSS (style tag 주입)
const _style = document.createElement('style');
_style.textContent = `
  .iconify-icon-cell:hover { background:#1e1e1e !important; border-color:#444 !important; }
  .iconify-icon-cell.sel   { background:#1a2a4a !important; border-color:#2563eb !important; }
`;
document.head.appendChild(_style);
