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
let _selectedIcon = null;  // { name: 'mdi:home' } (검색) 또는 { name, svg, iconColor, size } (즐겨찾기)
let _onPick = null;        // 콜백 모드: 설정되면 블록 삽입 대신 onPick({name, svg, size, iconColor}) 호출
let _favEnabled = false;   // Favorite 탭 노출 여부 — iconColor를 소비하는 호출자만 {favorites:true}로 오픈
                           //   (addIconifyBlock/card 경로는 iconColor를 버려 미리보기≠삽입결과 불일치가 생기므로 숨김)
let _searchTimer = null;
let _currentQuery = '';
let _currentPrefix = '';

function _escAttr(s) {
  return String(s ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function _createModal() {
  const el = document.createElement('div');
  el.id = 'iconify-modal';
  el.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;';
  el.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:12px;width:520px;max-width:95vw;max-height:90vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <!-- Sub-panel tabs -->
      <div style="display:flex;align-items:center;gap:10px;padding:14px 16px 0;">
        <div id="iconify-subpanel-tabs" style="display:flex;gap:6px;flex:1;">
          <button class="panel-tile iconify-subtab active" data-subtab="iconify"
            style="font-size:11px;padding:4px 12px;white-space:nowrap;">Iconify</button>
          <button class="panel-tile iconify-subtab" data-subtab="favorite"
            style="font-size:11px;padding:4px 12px;white-space:nowrap;">★ Favorite</button>
        </div>
        <button id="iconify-close-btn" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:4px;line-height:1;">✕</button>
      </div>

      <!-- [subpanel: iconify] Search row -->
      <div data-subview="iconify" data-display="flex" style="display:flex;align-items:center;gap:10px;padding:10px 16px 0;">
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#888" stroke-width="1.5" style="flex-shrink:0;"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
        <input id="iconify-search-input" type="text" placeholder="아이콘 검색... (예: home, arrow, star)"
          style="flex:1;background:#0e0e0e;border:1px solid #333;border-radius:6px;color:#ddd;font-size:13px;padding:7px 10px;outline:none;font-family:Pretendard,-apple-system,sans-serif;">
      </div>

      <!-- [subpanel: iconify] Collection filter -->
      <div data-subview="iconify" data-display="flex" style="padding:10px 16px 0;display:flex;gap:6px;flex-wrap:wrap;" id="iconify-collection-filter">
        ${COLLECTIONS.map(c => `
          <button class="panel-tile iconify-col-btn${c.id === '' ? ' active' : ''}" data-prefix="${c.id}"
            style="font-size:10px;padding:3px 8px;white-space:nowrap;">
            ${c.label}
          </button>`).join('')}
      </div>

      <!-- [subpanel: iconify] Icon grid -->
      <div id="iconify-grid" data-subview="iconify" data-display="grid" style="flex:1;overflow-y:auto;padding:12px 16px;display:grid;grid-template-columns:repeat(8,1fr);gap:6px;min-height:200px;max-height:360px;">
        <div style="grid-column:1/-1;text-align:center;color:#555;font-size:12px;padding:40px 0;font-family:Pretendard,-apple-system,sans-serif;">
          위에서 아이콘을 검색해보세요
        </div>
      </div>

      <!-- [subpanel: favorite] Favorite grid -->
      <div id="iconify-fav-grid" data-subview="favorite" data-display="grid" style="flex:1;overflow-y:auto;padding:12px 16px;display:none;grid-template-columns:repeat(8,1fr);gap:6px;min-height:200px;max-height:360px;"></div>

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
          style="background:var(--ui-accent-primary);border:none;border-radius:6px;color:#fff;font-size:12px;padding:7px 18px;cursor:pointer;font-weight:600;font-family:Pretendard,-apple-system,sans-serif;opacity:0.4;" disabled>
          삽입
        </button>
      </div>
    </div>
  `;
  document.body.appendChild(el);
  return el;
}

function openIconifyModal(onPick, options = {}) {
  if (!_modal) {
    _modal = _createModal();
    _bindModalEvents();
  }
  _onPick = typeof onPick === 'function' ? onPick : null;
  _favEnabled = options?.favorites === true;
  const favTab = _modal.querySelector('.iconify-subtab[data-subtab="favorite"]');
  if (favTab) favTab.style.display = _favEnabled ? '' : 'none';
  _selectedIcon = null;
  _updateSelectedPreview(null);
  _setSubTab('iconify');                 // 기본 탭 = Iconify
  if (_favEnabled) _renderFavGrid();     // 프로퍼티 패널에서 추가된 최신 즐겨찾기 반영
  _modal.style.display = 'flex';
  setTimeout(() => document.getElementById('iconify-search-input')?.focus(), 50);
}
window.openIconifyModal = openIconifyModal;

function closeIconifyModal() {
  if (_modal) _modal.style.display = 'none';
  _onPick = null;
}
window.closeIconifyModal = closeIconifyModal;

// ── 서브패널(탭) 전환 — display 토글만 수행, 푸터는 공용 ──────────────────────
function _setSubTab(tab) {
  if (!_modal) return;
  if (tab === 'favorite' && !_favEnabled) tab = 'iconify'; // 비활성 오픈 모드에선 Favorite 진입 차단
  _modal.querySelectorAll('#iconify-subpanel-tabs .iconify-subtab').forEach(b => {
    b.classList.toggle('active', b.dataset.subtab === tab);
  });
  _modal.querySelectorAll('[data-subview]').forEach(el => {
    el.style.display = (el.dataset.subview === tab) ? (el.dataset.display || 'block') : 'none';
  });
  if (tab === 'favorite') _renderFavGrid();
}

// ── Favorite 서브패널 — 우측 프로퍼티 패널의 스티커 즐겨찾기(icon shape)와 동일 원천 ──
function _renderFavGrid() {
  const grid = document.getElementById('iconify-fav-grid');
  if (!grid) return;
  // ★원본 인덱스 i 보존 — removeStickerFavorite는 전체 배열 인덱스를 받으므로
  //   icon shape 필터 후 배열 인덱스를 그대로 쓰면 다른 shape 즐겨찾기가 잘못 삭제됨.
  const favs = (window.listStickerFavorites?.() || [])
    .map((p, i) => ({ p, i }))
    .filter(({ p }) => p && p.shape === 'icon' && p.iconSvg);
  if (!favs.length) {
    grid.innerHTML = `<div style="grid-column:1/-1;text-align:center;color:#555;font-size:12px;padding:40px 0;font-family:Pretendard,-apple-system,sans-serif;">즐겨찾기가 없습니다.<br>아이콘 스티커 선택 후 우측 패널 ★ 추가로 저장하세요.</div>`;
    return;
  }
  grid.innerHTML = favs.map(({ p, i }) => `
    <div class="iconify-icon-cell iconify-fav-cell" data-fav-idx="${i}" data-icon-name="${_escAttr(p.iconName || '')}"
      style="aspect-ratio:1;background:#111;border:1px solid #222;border-radius:6px;display:flex;align-items:center;justify-content:center;cursor:pointer;transition:border-color 0.1s,background 0.1s;position:relative;overflow:visible;"
      title="${_escAttr(p.iconName || '')}">
      <span class="iconify-fav-svg" style="width:24px;height:24px;display:flex;align-items:center;justify-content:center;color:${_escAttr(p.iconColor || '#ddd')};pointer-events:none;"></span>
      <button class="iconify-fav-del" data-fav-del="${i}" type="button" title="즐겨찾기에서 삭제">×</button>
    </div>`).join('');
  // 저장된 iconSvg 인라인 주입 (innerHTML 문자열 조립로 넣지 않음 — 따옴표 escape 회피, prop-sticker 패턴)
  grid.querySelectorAll('.iconify-fav-cell').forEach((cell, k) => {
    const { p } = favs[k];
    const holder = cell.querySelector('.iconify-fav-svg');
    if (holder && p.iconSvg) {
      holder.innerHTML = p.iconSvg;
      const svg = holder.querySelector('svg');
      if (svg) { svg.setAttribute('width', 24); svg.setAttribute('height', 24); svg.style.pointerEvents = 'none'; }
    }
    // 선택 유지 — 다른 즐겨찾기 삭제로 인한 재렌더 후 현재 선택 셀의 .sel 하이라이트 복원
    if (_selectedIcon?.svg && p.iconSvg === _selectedIcon.svg && (p.iconName || '') === (_selectedIcon.name || '')) {
      cell.classList.add('sel');
    }
  });
}

// fav 셀 → 선택 상태 반영 (저장된 svg/색/크기를 푸터에 연동)
function _selectFavCell(cell) {
  const idx = parseInt(cell.dataset.favIdx);
  const p = (window.listStickerFavorites?.() || [])[idx];
  if (!p || p.shape !== 'icon' || !p.iconSvg) return false;
  _selectedIcon = {
    name: p.iconName || '',
    svg: p.iconSvg,
    iconColor: p.iconColor || undefined,
    size: p.size ? parseInt(p.size) : undefined,
  };
  const sizeInput = document.getElementById('iconify-size-input');
  if (sizeInput) {
    sizeInput.max = 600;                       // 즐겨찾기(스티커) 픽=상한 600 (검색 선택 시 512로 되돌림)
    if (_selectedIcon.size) sizeInput.value = _selectedIcon.size;
  }
  _updateSelectedPreview(_selectedIcon);
  return true;
}

function _bindModalEvents() {
  // 닫기
  document.getElementById('iconify-close-btn').addEventListener('click', closeIconifyModal);
  _modal.addEventListener('click', e => { if (e.target === _modal) closeIconifyModal(); });

  // 서브패널 탭 전환
  document.getElementById('iconify-subpanel-tabs').addEventListener('click', e => {
    const btn = e.target.closest('.iconify-subtab');
    if (!btn) return;
    _setSubTab(btn.dataset.subtab);
  });

  // Favorite 그리드 — 선택 / 삭제 (delegation)
  const favGrid = document.getElementById('iconify-fav-grid');
  favGrid.addEventListener('click', e => {
    const del = e.target.closest('.iconify-fav-del');
    if (del) {
      const idx = parseInt(del.dataset.favDel);
      const p = (window.listStickerFavorites?.() || [])[idx];
      // 선택 중인 즐겨찾기를 삭제하면 푸터 선택 상태도 해제 — 삭제된 프리셋이 삽입되는 것 방지
      if (p && _selectedIcon?.svg && _selectedIcon.svg === p.iconSvg && _selectedIcon.name === (p.iconName || '')) {
        _selectedIcon = null;
        _updateSelectedPreview(null);
      }
      window.removeStickerFavorite?.(idx);
      _renderFavGrid();
      return;
    }
    const cell = e.target.closest('.iconify-fav-cell');
    if (!cell) return;
    document.querySelectorAll('#iconify-modal .iconify-icon-cell.sel').forEach(c => c.classList.remove('sel'));
    if (_selectFavCell(cell)) cell.classList.add('sel');
  });

  // Favorite 그리드 더블클릭 → 바로 삽입 (검색 그리드와 동일 UX)
  favGrid.addEventListener('dblclick', e => {
    if (e.target.closest('.iconify-fav-del')) return;
    const cell = e.target.closest('.iconify-fav-cell');
    if (!cell) return;
    if (_selectFavCell(cell)) _doInsert();
  });

  // 검색 입력 (debounce 400ms)
  const searchInput = document.getElementById('iconify-search-input');
  searchInput.addEventListener('input', () => {
    clearTimeout(_searchTimer);
    _currentQuery = searchInput.value.trim();
    if (!_currentQuery) { _setGridMessage('위에서 아이콘을 검색해보세요'); return; }
    _setGridMessage('검색 중...');
    _searchTimer = setTimeout(() => _doSearch(_currentQuery, _currentPrefix), 400);
  });
  // ESC 닫기 — 모달 레벨(표시 중 가드). Favorite 탭엔 포커스 인풋이 없어 검색인풋 바인딩만으론 닫히지 않음.
  document.addEventListener('keydown', e => {
    if (e.key === 'Escape' && _modal && _modal.style.display !== 'none') closeIconifyModal();
  });

  // 데이터 레이어 변경 통지 구독 — 우측 패널에서 즐겨찾기 삭제/추가 시 모달 fav 그리드 동기화
  window.addEventListener('sticker-favorites-changed', () => {
    if (_modal && _modal.style.display !== 'none' && _favEnabled) _renderFavGrid();
  });

  // 컬렉션 필터
  document.getElementById('iconify-collection-filter').addEventListener('click', e => {
    const btn = e.target.closest('.iconify-col-btn');
    if (!btn) return;
    _currentPrefix = btn.dataset.prefix;
    document.querySelectorAll('.iconify-col-btn').forEach(b => {
      b.classList.toggle('active', b === btn);
    });
    if (_currentQuery) _doSearch(_currentQuery, _currentPrefix);
  });

  // 아이콘 그리드 클릭
  document.getElementById('iconify-grid').addEventListener('click', e => {
    const cell = e.target.closest('.iconify-icon-cell');
    if (!cell) return;
    document.querySelectorAll('#iconify-modal .iconify-icon-cell.sel').forEach(c => c.classList.remove('sel'));
    cell.classList.add('sel');
    _selectedIcon = { name: cell.dataset.iconName };
    const sizeInput = document.getElementById('iconify-size-input');
    if (sizeInput) sizeInput.max = 512;        // 검색(iconify 블록) 경로=상한 512로 복원
    _updateSelectedPreview(_selectedIcon);
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

function _updateSelectedPreview(sel) {
  if (typeof sel === 'string') sel = { name: sel };
  const preview  = document.getElementById('iconify-selected-preview');
  const nameEl   = document.getElementById('iconify-selected-name');
  const insertBtn = document.getElementById('iconify-insert-btn');

  if (!sel || !sel.name) {
    preview.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#444" stroke-width="1.5"><rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><polyline points="21 15 16 10 5 21"/></svg>`;
    nameEl.textContent = '선택된 아이콘 없음';
    insertBtn.disabled = true;
    insertBtn.style.opacity = '0.4';
    return;
  }

  if (sel.svg) {
    // 즐겨찾기 — 저장된 svg 인라인 렌더 (네트워크 불필요, 오프라인 동작)
    preview.innerHTML = `<span style="width:22px;height:22px;display:flex;align-items:center;justify-content:center;color:${_escAttr(sel.iconColor || '#ddd')};"></span>`;
    const holder = preview.firstElementChild;
    holder.innerHTML = sel.svg;
    const svg = holder.querySelector('svg');
    if (svg) { svg.setAttribute('width', 22); svg.setAttribute('height', 22); svg.style.pointerEvents = 'none'; }
  } else {
    const [prefix, name] = sel.name.split(':');
    const svgUrl = `${ICONIFY_API}/${prefix}/${name}.svg`;
    preview.innerHTML = `<img src="${svgUrl}" width="22" height="22" style="filter:invert(0.8);">`;
  }
  nameEl.textContent = sel.name;
  nameEl.style.color = '#ccc';
  insertBtn.disabled = false;
  insertBtn.style.opacity = '1';
}

async function _doInsert() {
  if (!_selectedIcon) return;
  // 즐겨찾기(스티커) 픽 경로는 패널 범위(16~600)에 맞춰 상한 600 유지, 검색(iconify 블록) 경로는 512.
  const maxSize = _selectedIcon.svg ? 600 : 512;
  const size = Math.min(maxSize, Math.max(16, parseInt(document.getElementById('iconify-size-input').value) || 64));
  const name = _selectedIcon.name;
  const iconColor = _selectedIcon.iconColor; // 검색 경로는 undefined → 기존 동작 불변
  const pick = _onPick; // closeIconifyModal이 _onPick을 비우므로 먼저 캡처

  let svgText;
  if (_selectedIcon.svg) {
    // 즐겨찾기 — 저장된 svg 그대로 사용 (fetch 생략)
    svgText = _selectedIcon.svg;
  } else {
    const [prefix, iconName] = name.split(':');
    try {
      // SVG 콘텐츠 fetch (인라인 삽입)
      const res = await fetch(`${ICONIFY_API}/${prefix}/${iconName}.svg`);
      svgText = await res.text();
    } catch {
      // fetch 실패 시 img fallback
      svgText = `<img src="${ICONIFY_API}/${prefix}/${iconName}.svg" width="${size}" height="${size}" style="display:block;">`;
    }
  }
  closeIconifyModal();
  if (pick) pick({ name, svg: svgText, size, iconColor });
  else window.addIconifyBlock(name, svgText, size);
}

// 그리드 셀 hover CSS (style tag 주입)
const _style = document.createElement('style');
_style.textContent = `
  .iconify-icon-cell:hover { background:#1e1e1e !important; border-color:#444 !important; }
  .iconify-icon-cell.sel   { background:#1a2a4a !important; border-color:var(--ui-accent-primary) !important; }
  /* Favorite 셀 삭제 버튼 — 우측 패널 .stk-fav-del 토큰 재사용 */
  .iconify-fav-cell .iconify-fav-del {
    position: absolute; top: -5px; right: -5px;
    width: 14px; height: 14px; border-radius: 50%;
    background: #c0392b; color: #fff; border: none;
    font-size: 10px; line-height: 14px; text-align: center;
    cursor: pointer; padding: 0; display: none; z-index: 1;
  }
  .iconify-fav-cell:hover .iconify-fav-del { display: block; }
`;
document.head.appendChild(_style);
