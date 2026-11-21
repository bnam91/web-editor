/* library-panel.js — 내장 라이브러리 모달(중앙 하단 Plugins 패널 → «내장 라이브러리») · 0.9.13 현빈 결정 261117
 *   명부 = js/data/builtin-library.js · 칸 하나 누르면 그 그림을 에셋 블럭으로 넣는다(addAssetBlock — 섹션 고름·프레임 안 처리 그대로).
 *   틀은 mockup-panel.js 모달과 같은 꼴(어두운 덮개 + 상자 · 칸 = 공용 .panel-tile).
 */
import { LIBRARY, LIBRARY_ROOT, ADMIN_LOCAL } from '../data/builtin-library.js';
import { escHtml } from '../props/_helpers.js';
import { sanitizeSvgString, SVG_MAX_LEN_CEIL } from '../util/sanitize-svg.js';
import { normalizeMonoSvg } from '../util/mono-svg.js';
import { svgImportSize } from '../util/svg-import-size.js';
import { posElOf, enterFloat, _applyOverlayPos } from '../overlay-float.js';   // 선택 없음 넣기 = 섹션 밖 SVG 드롭과 같은 오버레이(새 층 0)

/* LIB-INSERT-NOSEL-OVERLAY-01 · LIB-MODAL-STAY-OPEN-01(현빈 261118)
   · 넣을 자리 = 모달을 «열 때» 정한다: 섹션을 골라 뒀으면 흐름(종전) · 아니면 «오버레이» — 화면 가운데에 가장 가까운 섹션 · 화면 가운데 자리(섹션 상자 안으로 조임).
     ⛔칸마다 다시 정하지 않는다 — 첫 오버레이 넣기가 그 섹션을 골라 두므로, 다시 정하면 둘째부터 흐름으로 바뀐다.
   · 넣어도 모달은 열린 채(닫기 = ✕ · Esc · 바깥) · 넣을 때마다 짧은 알림 · 연달아 넣으면 오버레이는 24px 씩 비켜 놓는다 · ⌘Z 한 번 = 하나. */
let _sess = null;   // { overlay, n }
const _BURST = 24;
/** 화면(#canvas-wrap) 가운데 · 가장 가까운 섹션(놓인 높이 기준 — vector-block 섹션 밖 드롭 _nearestSection 과 같은 shortcut: 가로는 안 따짐) */
function _centerPlace() {
  const wr = document.getElementById('canvas-wrap')?.getBoundingClientRect();
  if (!wr) return null;
  const x = wr.left + wr.width / 2, y = wr.top + wr.height / 2;
  let sec = null, bd = Infinity;
  for (const s of document.querySelectorAll('#canvas .section-block')) {
    const r = s.getBoundingClientRect(), d = y < r.top ? r.top - y : y > r.bottom ? y - r.bottom : 0;
    if (d < bd) { bd = d; sec = s; }
  }
  return sec ? { sec, clientX: x, clientY: y } : null;
}
/** 이번 넣기 자리 — { sec, place:null }(흐름) | { sec, place }(오버레이) | null(섹션 0 · 알림) */
function _target() {
  const sel = window.getSelectedSection?.();
  if (sel && !_sess?.overlay) return { sec: sel, place: null };
  const c = _centerPlace();
  if (!c) { window.showNoSelectionHint?.(); return null; }
  const k = (_sess?.n || 0) * _BURST;
  return { sec: c.sec, place: { sec: c.sec, clientX: c.clientX + k, clientY: c.clientY + k } };
}
/** 에셋 오버레이 — 그 섹션 위로 띄우고 place 가운데에(섹션 상자 안으로 조임 · addVectorFromSvgText place 갈래와 같은 셈) */
function _floatAt(block, place, w, h) {
  const pe = posElOf(block);
  if (!pe || !enterFloat(pe)) return;
  const z = (window.currentZoom || 40) / 100, r = place.sec.getBoundingClientRect();
  const cl = (v, max) => Math.max(0, Math.min(Math.max(0, max), v));
  _applyOverlayPos(pe, cl((place.clientX - r.left) / z - w / 2, place.sec.offsetWidth - w), cl((place.clientY - r.top) / z - h / 2, place.sec.offsetHeight - h));
}
const _done = (it) => { if (_sess) _sess.n++; window.showToast?.(`넣었어요 · ${it.name}`); window.triggerAutoSave?.(); };

const MIME = { png: 'image/png', jpg: 'image/jpeg', jpeg: 'image/jpeg', svg: 'image/svg+xml' };
const FONT = 'font-family:Pretendard,-apple-system,sans-serif;';
let _modal = null;

/* 관리자 판정 = feature-flags.js animGifVisible 한 자리(ADMIN 배지와 같은 앱 관리자 ∨ 서버 role · 모르면 «아님»).
   ⛔여기서 따로 판정하지 않는다(둘째 명부). 이름은 GIF 지만 깃발 자리에 true 를 주면 «관리자인가» 그 자체다. */
const _isAdmin = () => (window.animGifVisible ? window.animGifVisible(true, window.__admin?.state?.() ?? null) : false);

/** 보일 묶음 — only 를 주면 그 묶음 하나(따로 단추로 여는 묶음) · admin 묶음은 관리자에게만(공개 범위 · 접근통제 아님). */
export function libraryCollections(only) {
  const admin = _isAdmin();
  return LIBRARY.filter((c) => (only ? c.id === only : !c.plugin) && (!c.admin || admin));
}

/* ── 관리자 로컬 폴더(LIB-FIGMA 261118) ── 명부 ADMIN_LOCAL · 파일은 <userData>/admin-library/<dir>/ (main 이 관리자 판정·경로 가드).
   칸 it.loc = dir · it.file = 'x.svg' | 'Frame_1/x.webp'. */
const _stem = (f) => f.split('/').pop().replace(/\.[^.]+$/, '');
const _nodeNo = (f) => { const m = /_(\d+)-(\d+)$/.exec(_stem(f)); return m ? +m[1] * 1e6 + +m[2] : 0; };   // 포즈 순서 = 노드 id

/** 'folder/file' 칸 → [[folder, 칸들]…] (폴더 이름 숫자 순) */
function _groupByFolder(items) {
  const by = new Map();
  for (const it of items) { const g = it.file.split('/')[0]; if (!by.has(g)) by.set(g, []); by.get(g).push(it); }
  return [...by.entries()].sort((x, y) => x[0].localeCompare(y[0], 'ko', { numeric: true }));
}

/** 관리자 ∧ 폴더 있음 → [새 묶음…] + 덧붙일 칸 { arrow: [...] } · 아니면 빈 것(비관리자는 IPC 호출 0). */
async function _adminLocal() {
  const none = { cols: [], merge: {} };
  if (!_isAdmin() || !window.electronAPI?.adminLibraryList) return none;
  const r = await Promise.resolve(window.electronAPI.adminLibraryList()).catch(() => null);
  if (!r || !r.ok || !r.dirs) return none;
  const out = { cols: [], merge: {} };
  for (const a of ADMIN_LOCAL) {
    const files = r.dirs[a.dir];
    if (!Array.isArray(files) || !files.length) continue;
    const items = files.map((file) => ({ file, loc: a.dir, name: _stem(file).replace(/_/g, ' ') }));
    if (a.mergeInto) {
      const tgt = out.cols.find((c) => c.id === a.mergeInto);   // 로컬 탭에 덧붙임 = 묶음으로(기존 칸은 a.baseGroup 묶음)
      // shortcut: 대상 로컬 폴더(doodle-figma-191-38)가 없으면 이 묶음도 안 보인다 — 따로 보여야 하면 그때 새 탭으로
      if (tgt) {
        if (!tgt.groups) tgt.groups = [{ name: a.baseGroup || '기본', items: tgt.items }];
        tgt.groups.push(..._groupByFolder(items).map(([g, its]) => ({ name: g, items: its })));
        tgt.source = `${tgt.source} · ${a.source}`;
        continue;
      }
      (out.merge[a.mergeInto] = out.merge[a.mergeInto] || []).push(...items); out.merge[a.mergeInto].src = a; continue; }
    const col = { ...a, items };
    if (a.groups) {   // 하위 폴더 = 캐릭터 묶음(이름 없음 → «캐릭터 N» = Frame 번호 그대로)
      col.groups = _groupByFolder(items)
        .map(([g, its]) => ({ name: `캐릭터 ${g.replace(/^Frame_/, '')}`, items: its.sort((x, y) => _nodeNo(x.file) - _nodeNo(y.file)).map((it, i) => ({ ...it, name: `포즈 ${i + 1}` })) }));
      col.items = col.groups[0].items;
    }
    out.cols.push(col);
  }
  return out;
}

const _localRead = (it) => Promise.resolve(window.electronAPI?.adminLibraryRead?.({ dir: it.loc, file: it.file })).catch(() => null);

/** 로컬 SVG → 거름(우회 0) → 단색이면 currentColor. 실패 = null. */
async function _localSvg(it) {
  const r = await _localRead(it);
  const clean = r && r.ok && r.svg ? sanitizeSvgString(r.svg, { maxLen: SVG_MAX_LEN_CEIL }) : '';
  return clean ? normalizeMonoSvg(clean) : null;
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

function _innerWidth(sec) {   // 넣을 자리 폭 상한 — 그 섹션(없으면 고른 섹션) 안쪽(패딩 뺌) · 모르면 860
  const inner = (sec || window.getSelectedSection?.())?.querySelector('.section-inner');
  if (!inner) return 860;
  const cs = getComputedStyle(inner);
  return Math.max(40, inner.clientWidth - parseFloat(cs.paddingLeft || 0) - parseFloat(cs.paddingRight || 0));
}

async function _insertLocalSvg(col, it) {
  const m = await _localSvg(it);
  if (!m) { window.showToast?.('❌ SVG 를 읽을 수 없어요(안전하지 않거나 그림이 아님)'); return; }
  _insertSvgVector(col, it, m);
}
/** 거른 SVG(m = normalizeMonoSvg 결과)를 벡터 블럭으로 — 관리자 로컬 SVG · 내장 단색 SVG(두들·화살표) 공용 한 벌. 단색이면 libMono(색 칸이 stroke·fill 을 바꾼다). */
function _insertSvgVector(col, it, m) {
  const t = _target();
  if (!t) return;
  const { w: sw, h: sh } = svgImportSize(m.svg);
  const w = Math.round(Math.min(_innerWidth(t.sec), col.w || sw));
  const opts = { color: m.color || '#000000', w, h: Math.max(1, Math.round((w * sh) / sw)), label: it.name, libMono: !!m.color };
  const b = t.place ? window.addVectorFromSvgText?.(m.svg, it.name, t.place, opts) : window.addVectorBlock?.(m.svg, opts);
  if (b) _done(it);
}

/** 그림(data URL) 하나를 에셋 블럭으로 — 폭 = 원하는 폭(없으면 원본) ∧ 섹션 안쪽 폭. 내장 라이브러리·무료 이미지(t13A-06) 공용 한 벌.
 *  t = _target() 결과({ sec, place }) — 주면 그 섹션 · place 면 «선택 없음 = 오버레이» 띄우기(LIB-INSERT-NOSEL-OVERLAY-01) · 안 주면 고른 섹션(무료 이미지 길 · 옛 뜻 그대로).
 *  새 블럭은 usePadx 미설정 = 전역 «패딩 제외»(기본 켜짐)를 따라가 addAssetBlock 의 applyExcludePadX 가 폭을 calc(100% + 2·padX) 로
 *  덮고, 뒤의 applyPadXToSection 도 다시 덮는다(아이맥 D2·D5 실측). ⇒ 스크래치 드롭(over 0)과 같은 꼴: usePadx='false' + 폭·마진 세트(applyAssetWidth). 만든 블럭을 돌려준다.
 *  (cand16 합침: free-image 7094a578c 의 공용 함수 꼴 + dev b18b10604 의 _target·오버레이·모달 열린 채) */
export function insertImageAsAsset(src, nw, nh, wantW, t = null) {
  nw = nw || 400; nh = nh || 400;
  const w = Math.round(Math.min(_innerWidth(t?.sec), wantW || nw)), h = Math.round((w * nh) / nw);
  if (t?.place) { window.deselectAll?.(); window.selectSection?.(t.sec); }   // 오버레이 = 그 섹션에 넣고 띄운다(SVG 섹션 밖 드롭과 같은 순서)
  const had = new Set(document.querySelectorAll('.asset-block'));
  window.addAssetBlock?.(null, { imgSrc: src, width: w, height: h });
  const ab = [...document.querySelectorAll('.asset-block')].find((b) => !had.has(b));
  if (ab) {
    ab.dataset.usePadx = 'false';
    window.applyAssetWidth?.(ab, w);   // prop-page.js — 폭 px + 풀블리드 음수마진 걷기 한 벌
    ab.style.alignSelf = 'center';
    if (t?.place) _floatAt(ab, t.place, w, h);
    window.showAssetProperties?.(ab);   // 우측 패널은 setAssetImageFromSrc 가 폭 고치기 «전»에 그렸다 — 낡은 860·패딩제외 켬을 지금 값으로(9500 실앱 r3)
    const tip = window.getHistoryTip?.();   // 같은 틱 고침(폭·띄우기)을 이력 꼭대기에 — ⌘Z 한 번 = 넣기 전(addAssetBlock 의 data: 갈래와 같은 관용구)
    if (tip) window.restampHistoryTop?.(tip.seq);
  }
  window.triggerAutoSave?.();
  return ab || null;
}

/* dev 9a724fb78 채점 ②(현빈 «라이브러리 두들 넣기 → 색 바꾸기») — 내장 SVG 가 «단색»이면 벡터 블럭(libMono)으로: 관리자 로컬 SVG(LIB-FIGMA)와 같은 길 · 색 칸이 바로 먹는다.
   다색·PNG·JPEG 는 옛 그대로 에셋. 동봉 두들은 모두 clip0 id 를 써서 벡터로 여럿 넣으면 url(#clip0) 이 첫 블럭 것을 가리킨다 ⇒ 넣을 때마다 id 접두사(sanitize idPrefix · 저장 글자에 그대로 남음). */
let _libIdSeq = 0;
function _bundledMonoSvg(dataUrl) {
  const m = /^data:image\/svg\+xml;base64,([A-Za-z0-9+/=]+)$/.exec(dataUrl || '');
  if (!m) return null;
  let txt; try { txt = new TextDecoder().decode(Uint8Array.from(atob(m[1]), (c) => c.charCodeAt(0))); } catch { return null; }
  const clean = sanitizeSvgString(txt, { maxLen: SVG_MAX_LEN_CEIL, idPrefix: `lib${Date.now().toString(36)}${++_libIdSeq}-` });
  const r = clean ? normalizeMonoSvg(clean) : null;
  return r && r.color ? r : null;
}

async function _insert(col, it, img) {
  try {
    if (it.loc && /\.svg$/i.test(it.file)) { await _insertLocalSvg(col, it); return; }
    const src = it.loc ? (await _localRead(it))?.dataUrl : await libraryDataUrl(`${LIBRARY_ROOT}/${col.dir}/${it.file}`);
    if (!src) throw new Error(`${it.loc}/${it.file} 읽기 실패`);
    const mono = !it.loc && /\.svg$/i.test(it.file) ? _bundledMonoSvg(src) : null;
    if (mono) { _insertSvgVector(col, it, mono); return; }
    const t = _target();
    if (!t) return;
    /* 모달은 열린 채(LIB-MODAL-STAY-OPEN-01 · dev b18b10604 — free-image 쪽 closeLibraryModal 은 옛 dev 바탕의 줄이라 안 살림) · 넣기 = 공용 insertImageAsAsset(free-image 7094a578c) 에 target */
    const ab = insertImageAsAsset(src, img?.naturalWidth, img?.naturalHeight, it.w || col.w, t);
    if (ab) _done(it);
  } catch (e) {
    console.warn('[library] 그림 읽기 실패:', e);
    window.showToast?.('❌ 라이브러리 그림을 못 읽었어요');
  }
}

let _io = null;   // 로컬 칸 지연 로드(보일 때만 IPC · 미모지 1,785 대비)
async function _loadLocalThumb(el, it) {
  const box = el.querySelector('.lib-thumb');
  if (/\.svg$/i.test(it.file)) {
    const m = await _localSvg(it);
    if (!m) { box.textContent = '읽기 실패'; return; }
    box.innerHTML = m.svg;   // 거른 글자(_localSvg) 만
    const svg = box.querySelector('svg');
    if (svg) { svg.setAttribute('width', '100%'); svg.setAttribute('height', '100%'); svg.style.color = m.color || '#000'; }
    if (m.multi) el.querySelector('.lib-name').textContent += ' ·다색';
  } else {
    const r = await _localRead(it);
    if (!r || !r.ok || !r.dataUrl) { box.textContent = '읽기 실패'; return; }
    box.innerHTML = `<img alt="${escHtml(it.name)}" draggable="false" style="width:100%;height:100%;object-fit:contain;">`;
    box.firstChild.src = r.dataUrl;
  }
  el.dataset.loaded = '1';
}

function _renderGrid(col, gi = 0) {
  const grid = _modal.querySelector('#lib-grid');
  const groups = _modal.querySelector('#lib-groups');
  const items = col.groups ? col.groups[gi].items : col.items;
  groups.style.display = col.groups ? 'flex' : 'none';
  groups.innerHTML = col.groups ? col.groups.map((g, k) => `<button class="panel-tile lib-group${k === gi ? ' active' : ''}" data-g="${k}" style="height:22px;padding:0 8px;border-radius:6px;font-size:10px;">${escHtml(g.name)}</button>`).join('') : '';
  groups.querySelectorAll('.lib-group').forEach((b) => b.addEventListener('click', () => _renderGrid(col, +b.dataset.g)));
  grid.innerHTML = items.map((it, i) => `
    <div class="panel-tile lib-item" data-i="${i}"${it.loc ? ` data-loc="${escHtml(it.loc)}"` : ''} title="${escHtml(it.name)}"
      style="border-radius:8px;padding:8px 4px 6px;display:flex;flex-direction:column;align-items:center;gap:4px;">
      ${it.loc ? '<div class="lib-thumb" style="width:100%;height:72px;display:flex;align-items:center;justify-content:center;font-size:10px;color:#666;"></div>'
    : `<img src="${escHtml(`${LIBRARY_ROOT}/${col.dir}/${it.file}`)}" alt="${escHtml(it.name)}" draggable="false"
        style="width:100%;height:72px;object-fit:contain;">`}
      <span class="lib-name" style="font-size:10px;color:#888;${FONT}white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%;">${escHtml(it.name)}</span>
    </div>`).join('');
  _io?.disconnect();
  _io = new IntersectionObserver((ents) => ents.forEach((e) => {
    if (!e.isIntersecting) return;
    _io.unobserve(e.target);
    _loadLocalThumb(e.target, items[+e.target.dataset.i]);
  }), { root: grid, rootMargin: '200px' });
  grid.querySelectorAll('.lib-item').forEach((el) => {
    el.addEventListener('click', () => _insert(col, items[+el.dataset.i], el.querySelector('img')));
    if (el.dataset.loc) _io.observe(el);
  });
  const extra = col.localSrc ? ` · 관리자 로컬 ${col.localSrc.source} · ${col.localSrc.license}` : '';
  _modal.querySelector('#lib-credit').textContent = `${col.source} · 라이선스: ${col.license}${col.note ? ` · ${col.note}` : ''}${extra}`;
  _modal.querySelectorAll('.lib-tab').forEach((t) => t.classList.toggle('active', t.dataset.col === col.id));
}

/** 모달 열기 — only = 묶음 id 하나만(예: 'fluent-emoji'), 없으면 따로 단추가 없는 묶음 전부. */
export async function openLibraryModal(only) {
  let cols = libraryCollections(only);
  if (!only) {   // 관리자 로컬 폴더 묶음(LIB-FIGMA) — 비관리자·폴더 없음이면 그대로
    const loc = await _adminLocal();
    cols = cols.map((c) => (loc.merge[c.id] ? { ...c, items: [...c.items, ...loc.merge[c.id]], localSrc: loc.merge[c.id].src } : c)).concat(loc.cols);
  }
  if (!cols.length) return;
  _sess = { overlay: !window.getSelectedSection?.(), n: 0 };   // 넣을 자리 = 열 때 한 번(위 머리말)
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
      <div id="lib-groups" style="display:none;flex-wrap:wrap;gap:4px;padding:10px 18px 0;"></div>
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
  _sess = null;
}
/* Esc = 닫기(열려 있을 때만 · 캡처라 편집기 Esc 처리로 안 샘) */
document.addEventListener('keydown', (e) => {
  if (e.key !== 'Escape' || !_modal || _modal.style.display === 'none') return;
  e.preventDefault(); e.stopPropagation();
  closeLibraryModal();
}, true);

window.openLibraryModal = openLibraryModal;
window.closeLibraryModal = closeLibraryModal;
