/* ═══════════════════════════════════
   FILE PANEL — PAGE SECTION
   (extracted from save-load.js)
═══════════════════════════════════ */
import { state, PAGE_LABELS } from './globals.js';

function buildFilePageSection() {
  const container = document.getElementById('page-props-in-file');
  if (!container) return;
  container.innerHTML = '';

  state.pages.forEach(page => {
    const isActive = page.id === state.currentPageId;

    const bg = (isActive ? state.pageSettings.bg : page.pageSettings?.bg) || '#969696';

    const item = document.createElement('div');
    item.className = 'file-page-item' + (isActive ? ' active' : '');
    item.dataset.pageId = page.id;

    // Label badge (left side)
    const labelBadge = document.createElement('select');
    labelBadge.className = 'file-page-label' + (page.label ? ' has-label' : '');
    labelBadge.dataset.label = page.label || '';
    PAGE_LABELS.forEach(l => {
      const opt = document.createElement('option');
      opt.value = l;
      opt.textContent = l || '—';
      opt.selected = (l === (page.label || ''));
      labelBadge.appendChild(opt);
    });
    labelBadge.addEventListener('click', e => e.stopPropagation());
    labelBadge.addEventListener('change', e => {
      e.stopPropagation();
      page.label = labelBadge.value;
      labelBadge.dataset.label = page.label;
      labelBadge.className = 'file-page-label' + (page.label ? ' has-label' : '');
      window.scheduleAutoSave();
    });

    // Info
    const info = document.createElement('div');
    info.className = 'file-page-info';

    const name = document.createElement('div');
    name.className = 'file-page-name';
    name.textContent = page.name;
    name.title = '더블클릭으로 이름 변경';
    name.addEventListener('dblclick', e => {
      e.stopPropagation();
      name.contentEditable = 'true';
      name.classList.add('editing');
      name.focus();
      document.execCommand('selectAll', false, null);
      name.addEventListener('blur', function commit() {
        name.contentEditable = 'false';
        name.classList.remove('editing');
        const newName = name.textContent.trim() || page.name;
        name.textContent = newName;
        page.name = newName;
        window.scheduleAutoSave();
        name.removeEventListener('blur', commit);
      }, { once: true });
      name.addEventListener('keydown', function onKey(e2) {
        if (e2.key === 'Enter') { e2.preventDefault(); name.blur(); }
        if (e2.key === 'Escape') { name.textContent = page.name; name.blur(); }
        name.removeEventListener('keydown', onKey);
      });
    });

    info.appendChild(name);

    // Copy button
    const copyBtn = document.createElement('button');
    copyBtn.className = 'file-page-copy';
    copyBtn.innerHTML = '⧉';
    copyBtn.title = '페이지 복사';
    copyBtn.addEventListener('click', e => {
      e.stopPropagation();
      window.flushCurrentPage();
      const srcPage = state.pages.find(p => p.id === page.id);
      if (!srcPage) return;
      const newId = 'page_' + Date.now();
      const copy = JSON.parse(JSON.stringify(srcPage)); // deep copy
      copy.id = newId;
      copy.name = srcPage.name + ' 사본';
      const srcIdx = state.pages.findIndex(p => p.id === page.id);
      state.pages.splice(srcIdx + 1, 0, copy);
      buildFilePageSection();
      window.scheduleAutoSave();
    });

    // Delete button
    const delBtn = document.createElement('button');
    delBtn.className = 'file-page-del';
    delBtn.innerHTML = '✕';
    delBtn.title = '페이지 삭제';
    delBtn.addEventListener('click', e => { e.stopPropagation(); window.deletePage(page.id); });

    item.appendChild(labelBadge);
    item.appendChild(info);
    item.appendChild(copyBtn);
    item.appendChild(delBtn);
    item.addEventListener('click', () => window.switchPage(page.id));

    // Drag-and-drop reorder
    item.setAttribute('draggable', 'true');
    item.addEventListener('dragstart', e => {
      e.dataTransfer.effectAllowed = 'move';
      e.dataTransfer.setData('text/plain', page.id);
      setTimeout(() => item.classList.add('page-dragging'), 0);
    });
    item.addEventListener('dragend', () => {
      item.classList.remove('page-dragging');
      container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
    });
    item.addEventListener('dragover', e => {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const indicator = document.createElement('div');
      indicator.className = 'page-drop-indicator';
      if (after) item.after(indicator);
      else item.before(indicator);
    });
    item.addEventListener('drop', e => {
      e.preventDefault();
      container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
      const srcId = e.dataTransfer.getData('text/plain');
      if (srcId === page.id) return;
      const srcIdx = state.pages.findIndex(p => p.id === srcId);
      const tgtIdx = state.pages.findIndex(p => p.id === page.id);
      if (srcIdx === -1 || tgtIdx === -1) return;
      const rect = item.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      const [moved] = state.pages.splice(srcIdx, 1);
      const insertAt = state.pages.findIndex(p => p.id === page.id) + (after ? 1 : 0);
      state.pages.splice(insertAt, 0, moved);
      buildFilePageSection();
      window.scheduleAutoSave();
    });

    container.appendChild(item);
  });

  const addBtn = document.createElement('button');
  addBtn.className = 'file-page-add';
  addBtn.textContent = '+ 페이지 추가';
  addBtn.addEventListener('click', window.addPage);
  addBtn.addEventListener('dragover', e => {
    e.preventDefault();
    container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
    const indicator = document.createElement('div');
    indicator.className = 'page-drop-indicator';
    addBtn.before(indicator);
  });
  addBtn.addEventListener('drop', e => {
    e.preventDefault();
    container.querySelectorAll('.page-drop-indicator').forEach(el => el.remove());
    const srcId = e.dataTransfer.getData('text/plain');
    const srcIdx = state.pages.findIndex(p => p.id === srcId);
    if (srcIdx === -1) return;
    const [moved] = state.pages.splice(srcIdx, 1);
    state.pages.push(moved);
    buildFilePageSection();
    window.scheduleAutoSave();
  });
  container.appendChild(addBtn);
}

export { buildFilePageSection };

window.buildFilePageSection = buildFilePageSection;
