/* library-panel.js — 내장 라이브러리 모달(중앙 하단 Plugins 패널 → «내장 라이브러리») · 0.9.13 현빈 결정 261117
 *   명부 = js/data/builtin-library.js · 칸 하나 누르면 그 그림을 에셋 블럭으로 넣는다(addAssetBlock — 섹션 고름·프레임 안 처리 그대로).
 *   틀은 mockup-panel.js 모달과 같은 꼴(어두운 덮개 + 상자 · 칸 = 공용 .panel-tile).
 */
import { LIBRARY, LIBRARY_ROOT } from '../data/builtin-library.js';
import { escHtml } from '../props/_helpers.js';

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
const FONT = 'font-family:Pretendard,-apple-system,sans-serif;';
let _modal = null;

/** 보일 묶음 — only 를 주면 그 묶음 하나(따로 단추로 여는 묶음). */
export function libraryCollections(only) {
  return LIBRARY.filter((c) => (only ? c.id === only : !c.plugin));
}

/** 동봉 그림 → data URL. 데스크톱 = IPC(asar 안도 읽음) · 브라우저 판(electronAPI 없음·null) = fetch.
 *  MIME 은 확장자로 정한다(서버가 주는 Content-Type 을 믿지 않는다). */
export async function libraryDataUrl(rel) {
  const r = await Promise.resolve(window.electronAPI?.assetsReadBundled?.({ bundled: rel })).catch(() => null);
  if (r && r.ok && r.dataUrl) return r.dataUrl;
  const res = await fetch(rel);
  if (!res.ok) throw new Error(`${rel} ${res.status}`);
  const buf = new Uint8Array(await res.arrayBuffer());
  let s = '';
  for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000));
  return `data:${MIME[rel.split('.').pop().toLowerCase()] || 'application/octet-stream'};base64,${btoa(s)}`;
}

function _innerWidth() {   // 넣을 자리 폭 상한 — 고른 섹션 안쪽(패딩 뺌) · 모르면 860
  const inner = window.getSelectedSection?.()?.querySelector('.section-inner');
  if (!inner) return 860;
  const cs = getComputedStyle(inner);
  return Math.max(40, inner.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
}

async function _insert(col, it, img) {
  try {
    const src = await libraryDataUrl(`${LIBRARY_ROOT}/${col.dir}/${it.file}`);
    const nw = img.naturalWidth || 400, nh = img.naturalHeight || 400;
    const w = Math.round(Math.min(_innerWidth(), it.w || col.w || nw));
    closeLibraryModal();
    window.addAssetBlock?.(null, { imgSrc: src, width: w, height: Math.round((w * nh) / nw) });
    window.triggerAutoSave?.();
  } catch (e) {
    console.warn('[library] 그림 읽기 실패:', e);
    window.showToast?.('❌ 라이브러리 그림을 못 읽었어요');
  }
}

function _renderGrid(col) {
  const grid = _modal.querySelector('#lib-grid');
  grid.innerHTML = col.items.map((it, i) => `
    <div class="panel-tile lib-item" data-i="${i}" title="${escHtml(it.name)}"
      style="border-radius:8px;padding:8px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;">
      <img src="${escHtml(`${LIBRARY_ROOT}/${col.dir}/${it.file}`)}" alt="${escHtml(it.name)}" draggable="false"
        style="width:100%;height:72px;object-fit:contain;">
      <span style="font-size:10px;color:#888;${FONT}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escHtml(it.name)}</span>
    </div>`).join('');
  grid.querySelectorAll('.lib-item').forEach((el) => {
    el.addEventListener('click', () => _insert(col, col.items[+el.dataset.i], el.querySelector('img')));
  });
  _modal.querySelector('#lib-credit').textContent = `${col.source} · 라이선스: ${col.license}${col.note ? ` · ${col.note}` : ''}`;
  _modal.querySelectorAll('.lib-tab').forEach((t) => t.classList.toggle('active', t.dataset.col === col.id));
}

/** 모달 열기 — only = 묶음 id 하나만(예: 'fluent-emoji'), 없으면 따로 단추가 없는 묶음 전부. */
export function openLibraryModal(only) {
  const cols = libraryCollections(only);
  if (!cols.length) return;
  if (!_modal) {
    _modal = document.createElement('div');
    _modal.id = 'lib-modal';
    _modal.style.cssText = 'display:none;position:fixed;inset:0;background:rgba(0,0,0,0.65);z-index:9999;align-items:center;justify-content:center;';
    _modal.addEventListener('click', (e) => { if (e.target === _modal) closeLibraryModal(); });
    document.body.appendChild(_modal);
  }
  _modal.innerHTML = `
    <div style="background:#1a1a1a;border:1px solid #2e2e2e;border-radius:12px;width:600px;max-width:95vw;max-height:85vh;display:flex;flex-direction:column;box-shadow:0 24px 64px rgba(0,0,0,0.7);">
      <div style="display:flex;align-items:center;justify-content:space-between;padding:16px 18px 0;">
        <span style="color:#ddd;font-size:13px;font-weight:600;${FONT}">${escHtml(only ? cols[0].name : '내장 라이브러리')}</span>
        <button id="lib-modal-close" style="background:none;border:none;color:#666;font-size:18px;cursor:pointer;padding:4px;line-height:1;">✕</button>
      </div>
      <div id="lib-tabs" style="display:${cols.length > 1 ? 'flex' : 'none'};flex-wrap:wrap;gap:6px;padding:12px 18px 0;">
        ${cols.map((c) => `<button class="panel-tile lib-tab" data-col="${escHtml(c.id)}" style="height:24px;padding:0 10px;border-radius:6px;font-size:11px;">${escHtml(c.name)}</button>`).join('')}
      </div>
      <div id="lib-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(96px,1fr));gap:8px;padding:12px 18px;overflow:auto;"></div>
      <div id="lib-credit" style="padding:0 18px 14px;font-size:10px;color:#666;${FONT}overflow-wrap:anywhere;"></div>
    </div>`;
  _modal.querySelector('#lib-modal-close').addEventListener('click', closeLibraryModal);
  _modal.querySelectorAll('.lib-tab').forEach((t) => t.addEventListener('click', () => _renderGrid(cols.find((c) => c.id === t.dataset.col))));
  _renderGrid(cols[0]);
  _modal.style.display = 'flex';
}

export function closeLibraryModal() {
  if (_modal) _modal.style.display = 'none';
}

window.openLibraryModal = openLibraryModal;
window.closeLibraryModal = closeLibraryModal;
