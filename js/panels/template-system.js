/* ═══════════════════════════════════
   TEMPLATE SYSTEM
═══════════════════════════════════ */
import { canvasEl } from '../globals.js';

const TEMPLATE_KEY = 'sangpe-templates'; // localStorage fallback key
/* ★1회성 이관 마커 — 「이미 옮겼나」를 «캐시 건수»가 아니라 이걸로 판정한다.
   건수로 물으면 공용 템플릿이 몇 건이냐에 따라 판정이 흔들린다(그래서 실제로 안 옮겨졌다). */
const TEMPLATE_MIGRATED_KEY = 'sangpe-templates-migrated';

let _templatesCache = null;  // 메타데이터 전용 (canvas 없음)
let _lsFullCache    = [];    // 비-Electron 전용: canvas 포함 전체 데이터

/* ══ 템플릿 «내부» 경로 ID ═══════════════════════════════════════════════════
   현빈 지시: 템플릿에 저장된 섹션·블록에 가리키기용 이름표를 붙인다.
   ★「템플릿 안에 있을 때만」 쓰는 것이다 — 캔버스에 들어가면 떼어낸다(_stripTplPath).
     런타임 정체성은 genId 가 따로 준다. 둘은 수명이 다르다.

   문법   <템플릿id>#<경로>        예) tpl_1775018641878#row2/text1
   경로   <종류><n> 을 «/» 로 잇는다 · 루트는 «#» 뒤 빈 문자열
   번호   ★같은 부모·같은 종류 안에서 1-based

   ⛔`id` 속성을 쓰지 않는 이유: insertTemplate 이 [id] 를 전부 새 값으로 덮어쓰고,
     `el.id.split('_')[0]` 로 접두사를 재사용하는 로직이 깨진다. 별도 속성이어야 한다.

   ★래퍼(section-inner·col·frame-inner)는 «건너뛴다».
     읽기에 방해이기도 하지만 본론은 따로다 — migrateColsFromDOM 이 stack row 의 col 을
     «언랩»하므로, col 을 세면 저장본과 런타임의 경로가 갈린다.
     건너뛰면 col 이 있든 없든 «같은 경로»가 나온다. (실측: 템플릿에 col 88개)

   ★레거시 클래스는 «현행 이름»으로 접는다. 정본 = save-load.js:636 의 리네임
     (sub-section-block → frame-block). 실측: 템플릿 3파일에 «살아있다».
     안 접으면 같은 노드가 저장본에선 sub-section1, 런타임에선 frame1 이 된다.
   ⛔그리드 쪽 옛 이름은 «별칭에 넣지 않았다» — 실측 0건이라 없는 데이터를 위한 보험이고,
     그 토큰을 코드에 두면 개명 잔존 가드(tests/unit/grid-rename-residue.test.mjs)가 빨강이 된다.
     그 검사는 「ALLOW 를 늘려 빨강을 끄지 마라」고 못박고 있다. 필요해지면 그때 정본 상수를 import 해라. */
const _TPL_PATH_ATTR  = 'data-tpl-path';
const _TPL_KIND_ALIAS = { 'sub-section': 'frame' };

/* 이 엘리먼트가 «경로 한 칸»을 차지하는가 — 아니면 null(투명) */
function _tplKindOf(el) {
  const cl = el && el.classList;
  if (!cl || !cl.length) return null;
  if (cl.contains('row')) return 'row';
  for (const c of cl) {
    const m = /^([a-z][a-z0-9-]*)-block$/.exec(c);
    if (m) return _TPL_KIND_ALIAS[m[1]] || m[1];
  }
  return null;   // col·section-inner·frame-inner·내부 마크업 — 투명하게 뚫고 지나간다
}

/* 이 범위에 «속하는» 노드들 — 투명한 것은 뚫고 내려가 «같은 범위»로 모은다.
   ★한 범위의 번호가 여기서 정해진다. col 마다 따로 세면 row1/text1 이 둘 생긴다. */
function _tplScopeChildren(el) {
  const out = [];
  const visit = (node) => {
    for (const child of node.children) {
      if (_tplKindOf(child)) out.push(child);
      else visit(child);
    }
  };
  visit(el);
  return out;
}

/* ★파생이 «정본»이다 — 저장·조회가 이 함수 하나를 공유하므로 두 값이 갈릴 수 없다.
   그리고 조회를 계산으로 하니 «경로가 저장 안 된 구 템플릿»도 마이그레이션 없이 즉시 동작한다. */
function _tplPathOf(root) {
  const map = new Map();
  if (!root || !root.children) return map;
  const walk = (el, base) => {
    const counts = Object.create(null);
    for (const child of _tplScopeChildren(el)) {
      const kind = _tplKindOf(child);
      counts[kind] = (counts[kind] || 0) + 1;
      const path = (base ? base + '/' : '') + kind + counts[kind];
      map.set(child, path);
      walk(child, path);
    }
  };
  walk(root, '');
  return map;
}

/* 저장본에 «사본»을 심는다(파일만 봐도 읽히게). 정본은 위 파생이다. */
function _tplStampPath(root) {
  const map = _tplPathOf(root);
  map.forEach((path, el) => el.setAttribute(_TPL_PATH_ATTR, path));
  return map.size;
}

/* ★캔버스로 새어 들어가지 않게 떼어낸다.
   ⛔serializeCleanRoot 는 범용 data-* 를 «안» 지운다(data-lazy-bg 하나뿐) —
     즉 삽입 시점의 이 호출이 «유일한 방벽»이다. 세 분기 중 하나만 빠뜨리면 그 분기만 샌다. */
function _tplStripPath(root) {
  if (!root || !root.removeAttribute) return 0;
  let n = 0;
  if (root.hasAttribute(_TPL_PATH_ATTR)) { root.removeAttribute(_TPL_PATH_ATTR); n++; }
  root.querySelectorAll('[' + _TPL_PATH_ATTR + ']').forEach(el => { el.removeAttribute(_TPL_PATH_ATTR); n++; });
  return n;
}

// 앱 시작 시 1회 호출
async function initTemplates() {
  if (window.electronAPI?.loadTemplateIndex) {
    _templatesCache = await window.electronAPI.loadTemplateIndex();
    /* localStorage 기존 데이터 → 파일로 마이그레이션.
       ⛔판정을 「캐시가 비었나」로 하면 안 된다 — 계정 격리 후 loadTemplateIndex 는 «공용 ∪ 개인»을
         돌려주므로 공용이 한 건이라도 있으면 그 조건이 «항상 거짓»이 되어 구 데이터가 영영 안 옮겨진다.
         물어야 할 것은 「이 사용자 것을 «이미 옮겼나»」다. */
    const lsRaw = localStorage.getItem(TEMPLATE_KEY);
    if (lsRaw && !localStorage.getItem(TEMPLATE_MIGRATED_KEY)) {
      try {
        const old = JSON.parse(lsRaw) || [];
        const migrated = [];
        let failed = 0;
        for (const tpl of old) {
          const { canvas, ...meta } = tpl;
          if (canvas) {
            try {
              await window.electronAPI.saveTemplateCanvas(tpl.id, canvas);
              migrated.push(meta); // canvas 저장 성공한 항목만 index에 추가
            } catch (e) {
              failed++;
              console.warn('[template] canvas 저장 실패 — index에서 제외:', tpl.id, e);
            }
          } else {
            migrated.push(meta); // canvas 없는 메타 전용 항목은 그대로 추가
          }
        }
        /* ★«덮어쓰기»가 아니라 «합치기»다. saveTemplateIndex 는 개인 index 를 통째로 «교체»하므로,
           옛 조건(length===0)이 사라진 지금 그대로 넘기면 기존 개인 템플릿이 사라진다.
           id 가 겹치면 «기존 것»이 이긴다 — 사용자가 최근까지 쓰던 쪽이다.
           ⛔공용(_scope==='shared')은 개인으로 넘기지 않는다(main 도 걸러내지만 여기서도 안 넘긴다). */
        const shared   = _templatesCache.filter(t => t && t._scope === 'shared');
        const personal = _templatesCache.filter(t => !t || t._scope !== 'shared');
        const seen     = new Set(personal.map(t => t && t.id).filter(Boolean));
        const added    = migrated.filter(m => m && m.id && !seen.has(m.id))
                                 .map(m => Object.assign({}, m, { _scope: 'personal' }));
        const personalMerged = personal.concat(added);
        const ok = await window.electronAPI.saveTemplateIndex(personalMerged);
        _templatesCache = personalMerged.concat(shared); // main 의 load-index 와 «같은» 순서(개인 먼저)
        /* ★원본 삭제와 마커는 «완전 성공»에만. 부분 실패(canvas 저장 실패)나 저장 거부
           (비로그인이라 개인 뿌리가 없을 때 main 이 false 를 준다)면 둘 다 안 하고 다음 기동에 재시도한다 —
           원본을 지웠다가는 «못 옮긴 것»이 그대로 유실된다. */
        if (ok !== false && failed === 0) {
          localStorage.removeItem(TEMPLATE_KEY);
          localStorage.setItem(TEMPLATE_MIGRATED_KEY, new Date().toISOString());
        } else {
          console.warn(`[template] 마이그레이션 보류 — 실패 ${failed}건 / 저장결과 ${ok}. 다음 기동에 재시도한다.`);
        }
      } catch (e) { console.warn('[template] 마이그레이션 실패:', e); }
    }
  } else {
    // 비-Electron fallback — localStorage에서 canvas 포함 전체 로드
    try { _lsFullCache = JSON.parse(localStorage.getItem(TEMPLATE_KEY)) || []; } catch (e) { console.warn('[template] localStorage 로드 실패:', e); }
    _templatesCache = _lsFullCache.map(({ canvas, ...meta }) => meta);
  }
}

function loadTemplates() {
  return _templatesCache || [];
}

function saveTemplates(arr) {
  _templatesCache = arr;
  if (window.electronAPI?.saveTemplateIndex) {
    /* ★공용(_scope==='shared')은 «개인 index» 에 쓰지 않는다. 메인이 한 번 더 거르지만 여기서도 턴다.
       ⛔한쪽만 두면 나중에 다른 저장 경로가 생겼을 때 공용이 개인으로 조용히 복제된다. */
    window.electronAPI.saveTemplateIndex(
      arr.filter(t => t && t._scope !== 'shared').map(({ _scope, ...meta }) => meta)
    );
  } else {
    // localStorage: 메타 업데이트하되 canvas 데이터 유지
    _lsFullCache = arr.map(meta => {
      const existing = _lsFullCache.find(t => t.id === meta.id);
      return existing ? { ...meta, canvas: existing.canvas } : meta;
    });
    localStorage.setItem(TEMPLATE_KEY, JSON.stringify(_lsFullCache));
  }
}

// canvas HTML 로드 (파일 or localStorage fallback)
async function _loadCanvas(id) {
  if (window.electronAPI?.loadTemplateCanvas) {
    try {
      return await window.electronAPI.loadTemplateCanvas(id);
    } catch (e) {
      console.warn('[template] canvas 파일 로드 실패:', id, e);
      return null;
    }
  }
  const full = _lsFullCache.find(t => t.id === id);
  if (!full) console.warn('[template] canvas 캐시 미발견:', id);
  return full ? full.canvas : null;
}

/* 저장이 «격리 폴더»로 갔으면 그 순간에 말한다.
   ★안내문(README)은 «사후 구제»다 — 「사라졌다」고 겪은 사람은 그 파일을 영영 안 본다.
     그래서 사전 고지가 본론이다. 장치가 있어도 «닿는 길»이 없으면 없는 것이다.
   ⛔저장을 «막지» 않는다 — 저장이 끝난 뒤에만 부르고, 여기서 무슨 일이 나도 삼킨다.
     막으면 사용자는 방금 만든 작업을 잃는다. 우리가 할 일은 «알리»는 것뿐이다.
   ⛔showToast 단독으로 쓴다. 뒤에 네이티브 alert 폴백을 «붙이지 마라» — showToast 는 return 이 없어
     undefined 를 주고, 그러면 ?? 가 통과해 토스트+네이티브 alert 이 «둘 다» 뜨며 렌더러가 얼어붙는다. */
async function _noticeIfIsolatedRoot() {
  try {
    const st = await window.electronAPI?.getTemplateRootState?.();
    if (!st || st.account) return false;   // 정상 계정 뿌리 — 할 말 없다
    window.showToast?.(st.landed === 'unresolved'
      ? '⚠️ 로그인 정보를 읽지 못해 임시 공간에 저장됐습니다. 로그인한 뒤 다시 저장해 주세요.'
      : '⚠️ 로그인하지 않아 임시 공간에 저장됐습니다. 로그인한 뒤 다시 저장해 주세요.');
    return true;
  } catch (_) { return false; }   // 고지가 실패해도 저장은 이미 끝났다
}

async function saveAsTemplate(el, name, folder, category, tags, type = 'section') {
  const clone = el.cloneNode(true);
  clone.classList.remove('selected', 'sec-bg-editing');
  clone.querySelectorAll('.sec-bg-editing').forEach(el => el.classList.remove('sec-bg-editing'));
  clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
  clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .sec-bg-proxy').forEach(el => el.remove());
  /* ★순서가 중요하다 — «먼저 지우고 그다음 심는다».
     안 그러면 「삽입됐던 것을 다시 저장」할 때 남의 템플릿 경로가 눌어붙는다.
     (삽입 시 strip 하지만, 캔버스를 거쳐 온 것에 옛 값이 남아 있을 수 있다) */
  _tplStripPath(clone);
  _tplStampPath(clone);

  const id  = 'tpl_' + Date.now();
  const html = clone.outerHTML;
  const tagsArr = Array.isArray(tags) ? tags : [];

  if (window.electronAPI?.saveTemplateCanvas) {
    await window.electronAPI.saveTemplateCanvas(id, html);
  } else {
    _lsFullCache.unshift({ id, name, folder: folder || '기타', category, tags: tagsArr, createdAt: new Date().toISOString(), thumbnail: null, type: type || 'section', canvas: html });
  }

  const templates = loadTemplates();
  templates.unshift({ id, name, folder: folder || '기타', category, tags: tagsArr, createdAt: new Date().toISOString(), thumbnail: null, type: type || 'section' });
  saveTemplates(templates);
  renderTemplatePanel();
  await _noticeIfIsolatedRoot();   // ★저장이 «끝난 뒤»에만 — 알리기만 하고 막지 않는다
}

/* 공용 템플릿인가 — 「막는 이유」가 셋 다 같아서 한 곳에서 판정한다. */
function _isSharedTemplate(id) {
  const t = loadTemplates().find(x => x.id === id);
  return { shared: !!(t && t._scope === 'shared'), name: (t && t.name) || '이 템플릿' };
}

async function deleteTemplate(id) {
  /* ⛔공용을 지우면 이 계정 하나가 아니라 ★모든 계정의 것이 같이 사라진다. 되돌릴 수도 없다. */
  const g = _isSharedTemplate(id);
  if (g.shared) {
    window.showToast?.(`🔒 '${g.name}' 은(는) 모든 계정이 함께 쓰는 공용 템플릿이라 지울 수 없습니다.`);
    return;
  }
  if (window.electronAPI?.deleteTemplateCanvas) {
    await window.electronAPI.deleteTemplateCanvas(id);
  } else {
    _lsFullCache = _lsFullCache.filter(t => t.id !== id);
  }
  saveTemplates(loadTemplates().filter(t => t.id !== id));
  renderTemplatePanel();
}

async function insertTemplate(tpl) {
  const canvas = await _loadCanvas(tpl.id);
  if (!canvas) {
    window.showToast?.('❌ 템플릿 불러오기 실패: 파일이 없거나 손상됐습니다.');
    return;
  }
  // 실패를 «말할» 때 어느 템플릿인지 알려야 다음 행동이 된다(카드가 여러 장이다)
  const tplName = tpl.name || '이름 없는 템플릿';

  // block 타입: 선택된 섹션의 col에 삽입
  if (tpl.type === 'block') {
    const sec = window.getSelectedSection?.() || document.querySelector('.section-block');
    if (!sec) { window.showToast?.('섹션을 먼저 선택하세요'); return; }

    const wrapper = document.createElement('div');
    wrapper.innerHTML = canvas;
    const blockEl = wrapper.firstElementChild;
    if (!blockEl) {
      window.showToast?.(`❌ '${tplName}' 템플릿이 비었거나 손상됐습니다.`);
      return;
    }
    _tplStripPath(blockEl);   // ★템플릿 안에서만 쓰는 이름표 — 캔버스로 들고 들어가지 않는다

    // row로 감싸서 insertAfterSelected로 삽입 (섹션 패딩/레이아웃 정상 적용)
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'row_' + Math.random().toString(36).slice(2, 8);
    row.dataset.layout = 'stack';
    row.appendChild(blockEl);

    window.insertAfterSelected?.(sec, row);
    /* ★rebindAll 비경유 문(2026-09-05 개명) — «옛 빌드가 저장한 블록 템플릿»이 여기로 들어온다.
       ⛔이 자리는 설계 문서의 문 목록(subsection:182 / section:277)에 «없었다» — 구현 중 발견.
       승격을 안 하면 bindBlock 안전망이 뒤늦게 잡아 warn 을 남긴다(= 문을 놓쳤다는 신호). */
    window.migrateGridIdentity?.(blockEl);
    window.bindBlock?.(blockEl);
    // ★이 문도 렌더러를 안 부른다 — 스냅샷(grd-*)과 CSS 가 어긋나지 않게 다시 그린다.
    if (blockEl.classList.contains('grid-block')) window.renderGridBlock?.(blockEl);
    window.buildLayerPanel?.();
    window.pushHistory?.();
    window.scheduleAutoSave?.();
    window.showToast?.('블록 템플릿 삽입됨');
    return;
  }

  // subsection 타입: 선택된 섹션 안에 삽입
  if (tpl.type === 'subsection') {
    const targetSec = window.getSelectedSection?.();
    if (!targetSec) {
      /* ★`?? alert(...)` 를 «뺐다» (2026-09-07 툴매니저가 실물로 잡음)
       *   showToast(js/drag-utils.js:192)는 «return 이 없어» 항상 undefined 를 돌려준다.
       *   ⇒ `??` 가 «언제나» 통과해 토스트 + 네이티브 alert 이 «둘 다» 뜬다.
       *   ⇒ 그리고 그 alert 이 렌더러를 «막는다» — 사용자는 모달을 눌러 없앨 때까지
       *     아무것도 못 한다. 실물 포착: CDP 로 {"type":"alert","message":"섹션을 먼저 선택하세요"}.
       *   ⛔fallback 이 필요해 보이면 `??` 가 아니라 «존재 여부»로 갈라라 — 반환값으로 갈리면 안 된다.
       *     여기서는 showToast 가 항상 로드되므로(index.html 이 drag-utils.js 를 무조건 싣는다)
       *     옵셔널 호출 하나로 충분하다. */
      window.showToast?.('섹션을 먼저 선택하세요');
      return;
    }
    const tmp = document.createElement('div');
    tmp.innerHTML = canvas;
    const ss = tmp.firstElementChild;
    if (!ss) {
      window.showToast?.(`❌ '${tplName}' 템플릿이 비었거나 손상됐습니다.`);
      return;
    }
    if (!ss.classList.contains('frame-block')) {
      window.showToast?.(`❌ '${tplName}' 은(는) 컴포넌트 템플릿이 아닙니다. 템플릿을 열어 다시 저장해 주세요.`);
      return;
    }

    _tplStripPath(ss);        // ★템플릿 전용 이름표 제거(형제 셋 공통)
    // ID 재생성 (중복 방지)
    ss.id = 'ss_' + Math.random().toString(36).slice(2, 9);
    ss._subSecBound = false;

    // frame-block은 row 안에 있어야 함
    const row = document.createElement('div');
    row.className = 'row';
    row.id = 'row_' + Math.random().toString(36).slice(2, 9);
    row.dataset.layout = 'stack';
    const col = document.createElement('div');
    col.className = 'col';
    col.dataset.width = '100';
    col.appendChild(ss);
    row.appendChild(col);

    // 선택된 섹션의 콘텐츠 영역(section-inner 또는 직접)에 append
    const inner = targetSec.querySelector('.section-inner') || targetSec;
    inner.appendChild(row);

    // 이벤트 재바인딩
    window.bindFrameDropZone?.(ss);
    // 내부 블록 이벤트 핸들러 재등록 (Section 삽입과 동일 수준)
    // ★rebindAll 비경유 문 — 승격을 직접 한다(2026-09-05 개명).
    window.migrateGridIdentity?.(ss);
    ss.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .bridge-block, .grid-block, .infocard-block, .innercard-block, .modal-block, .icon-text-block, .shape-block, .joker-block').forEach(b => window.bindBlock?.(b));
    ss.querySelectorAll('.group-block').forEach(g => window.bindGroupDrag?.(g));
    if (ss.dataset.bg) ss.style.backgroundColor = ss.dataset.bg;
    if (ss.dataset.bgImg && !ss.style.backgroundImage) {
      ss.style.backgroundImage = `url(${ss.dataset.bgImg})`;
      ss.style.backgroundSize = 'cover';
      ss.style.backgroundPosition = ss.dataset.bgPos || 'center';
    }
    if (ss.dataset.radius) ss.style.borderRadius = ss.dataset.radius + 'px';
    const bw = parseInt(ss.dataset.borderWidth) || 0;
    if (bw > 0) ss.style.border = `${bw}px ${ss.dataset.borderStyle || 'solid'} ${ss.dataset.borderColor || '#888'}`;

    window.pushHistory?.();
    window.buildLayerPanel?.();
    window.scheduleAutoSave?.();
    return;
  }

  // 기존 section 타입 삽입 로직
  const tmp = document.createElement('div');
  tmp.innerHTML = canvas;
  const sec = tmp.firstElementChild;
  if (!sec) {
    window.showToast?.(`❌ '${tplName}' 템플릿이 비었거나 손상됐습니다.`);
    return;
  }
  if (!sec.classList.contains('section-block')) {
    window.showToast?.(`❌ '${tplName}' 은(는) 섹션 템플릿이 아닙니다. 템플릿을 열어 다시 저장해 주세요.`);
    return;
  }

  // 모든 ID 재생성 (동일 템플릿 2회 삽입 시 중복 ID 방지)
  // ★자체 생성기를 두지 마라 — actorId 조각이 빠져 협업에서 출처를 못 가린다. 전역을 쓴다.
  const genId = (prefix) => (typeof window.genId === 'function'
    ? window.genId(prefix)
    : prefix + '_' + Math.random().toString(36).slice(2, 9));
  _tplStripPath(sec);         // ★템플릿 전용 이름표 제거(형제 셋 공통)
  sec.id = genId('sec');
  sec.querySelectorAll('[id]').forEach(el => {
    const prefix = el.id.split('_')[0] || 'el';
    el.id = genId(prefix);
  });

  // 섹션 번호 갱신
  const secList = canvasEl.querySelectorAll('.section-block');
  const newIdx  = secList.length + 1;
  sec.dataset.section = newIdx;
  // 섹션 이름을 템플릿 이름으로 설정
  sec.dataset.name = tpl.name;
  // 템플릿 태그를 섹션에 스탬프 (data-tags로 직렬화 → 저장/로드 왕복 보존, 칩 렌더 소스)
  if (Array.isArray(tpl.tags) && tpl.tags.length) sec.dataset.tags = tpl.tags.join(',');
  const labelEl = sec.querySelector('.section-label');
  if (labelEl) {
    labelEl.textContent = tpl.name;
    if (!labelEl.closest('.section-hitzone')) {
      const hz = document.createElement('div');
      hz.className = 'section-hitzone';
      labelEl.parentElement.insertBefore(hz, labelEl);
      hz.appendChild(labelEl);
    }
  }

  // 선택 상태 초기화
  sec.classList.remove('selected');

  // 프리뷰에서 적용된 인라인 스타일 제거 (scale, position, pointer-events 등)
  sec.style.transform     = '';
  sec.style.transformOrigin = '';
  sec.style.position      = '';
  sec.style.left          = '';
  sec.style.pointerEvents = '';
  sec.style.userSelect    = '';

  // 삽입 위치 결정: 선택된 섹션/프레임/블럭이 있으면 해당 섹션 바로 아래에 삽입, 없으면 맨 밑
  const anchorSec = window.getSelectedSection?.();
  if (anchorSec && anchorSec.parentElement === canvasEl) {
    anchorSec.after(sec);
  } else {
    canvasEl.appendChild(sec);
  }

  // 중간 삽입 시 섹션 번호 재정렬 (data-section만 갱신, 라벨은 템플릿명 유지)
  canvasEl.querySelectorAll('.section-block').forEach((s, i) => {
    s.dataset.section = i + 1;
  });

  // 이벤트 바인딩
  if (sec.dataset.bgImg && !sec.style.backgroundImage) {
    sec.style.backgroundImage = `url(${sec.dataset.bgImg})`;
    sec.style.backgroundSize  = sec.dataset.bgSize || 'cover';
    sec.style.backgroundPosition = 'center';
    sec.style.backgroundRepeat   = 'no-repeat';
  }
  sec.addEventListener('click', e => { e.stopPropagation(); selectSection(sec); });
  bindSectionDelete(sec);
  bindSectionOrder(sec);
  if (window.bindSectionHitzone) window.bindSectionHitzone(sec);
  renderSectionTags(sec);   // 태그 칩 렌더 (bindSectionHitzone 래퍼가 로드 시 재생성하나, 삽입 즉시 표시 보장)
  bindSectionDrag(sec);
  bindSectionDropZone(sec);
  // ★rebindAll 비경유 문 — 승격을 직접 한다(2026-09-05 개명).
  window.migrateGridIdentity?.(sec);
  sec.querySelectorAll('.text-block, .asset-block, .gap-block, .icon-circle-block, .table-block, .label-group-block, .graph-block, .divider-block, .grid-block, .infocard-block, .innercard-block, .modal-block, .icon-text-block').forEach(b => {
    bindBlock(b);
    // ★이 문은 «유일하게» 렌더러를 안 부르던 문이다 — 개명으로 스냅샷(grd-*)과 CSS 가
    //   어긋나면 P1.5 「빈 줄이 손에 안 닿음」이 여기서만 재현된다. save-load.js:979 와 같은 줄.
    if (b.classList.contains('grid-block')) window.renderGridBlock?.(b);
  });
  sec.querySelectorAll('.group-block').forEach(g => {
    if (!g.querySelector(':scope > .group-block-label')) {
      const lbl = document.createElement('span');
      lbl.className = 'group-block-label';
      lbl.textContent = g.dataset.name || 'Group';
      g.prepend(lbl);
    }
    bindGroupDrag(g);
  });
  applyPageSettings();
  pushHistory();
  buildLayerPanel();
  selectSection(sec, true);
}

function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/**
 * 섹션 태그 칩 렌더 — sec.dataset.tags(쉼표 구분)를 읽어 .section-hitzone 안(섹션 라벨 옆)에
 * .section-tags 칩 그룹을 그린다. 멱등(기존 칩 제거 후 재생성)이라 로드 시 재호출해도 안전.
 * 태그가 없으면 칩을 그리지 않는다. data-tags가 소스이며 칩 DOM은 파생 뷰.
 */
function renderSectionTags(sec) {
  if (!sec || !sec.classList?.contains('section-block')) return;
  const hz = sec.querySelector('.section-hitzone');
  if (!hz) return;                                       // hitzone 없으면 렌더 위치 없음
  // 기존 칩 그룹 제거 (멱등 — 직렬화되어 되살아난 칩/이전 렌더 정리)
  hz.querySelectorAll(':scope > .section-tags').forEach(el => el.remove());
  const tags = (sec.dataset.tags || '').split(',').map(t => t.trim()).filter(Boolean);
  if (!tags.length) return;
  const group = document.createElement('span');
  group.className = 'section-tags';
  group.innerHTML = tags.map(t => `<span class="section-tag-chip">${escHtml(t)}</span>`).join('');
  const label = hz.querySelector(':scope > .section-label');
  if (label && label.nextSibling) hz.insertBefore(group, label.nextSibling);
  else                            hz.appendChild(group);
}

/**
 * bindSectionHitzone(editor.js) 래핑 — 섹션 hitzone 바인딩 직후 태그 칩을 재생성한다.
 * rebindAll(save-load.js)이 로드/undo·redo/협업 수신 때마다 bindSectionHitzone을 호출하므로
 * 이 래퍼 하나로 «로드 왕복 후 칩 복원»이 자동 처리된다. editor.js는 template-system.js보다
 * 나중에 로드되므로(window.bindSectionHitzone 미정의 시점) DOMContentLoaded 이후 설치한다.
 */
function _installSectionTagHook() {
  if (window.__sectionTagHookInstalled) return true;
  const orig = window.bindSectionHitzone;
  if (typeof orig !== 'function') return false;
  window.bindSectionHitzone = function (sec) {
    const r = orig.apply(this, arguments);
    try { renderSectionTags(sec); } catch (_) {}
    return r;
  };
  window.__sectionTagHookInstalled = true;
  return true;
}
if (!_installSectionTagHook()) {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', _installSectionTagHook, { once: true });
  } else {
    _installSectionTagHook();
  }
}

const TPL_FOLDER_KEY = 'tpl-folder-state';
let _activeFolderFilter = '전체';
let _activeSearchQuery  = '';

function loadFolderState() {
  try { return JSON.parse(localStorage.getItem(TPL_FOLDER_KEY)) || {}; } catch { return {}; }
}
function saveFolderState(state) {
  localStorage.setItem(TPL_FOLDER_KEY, JSON.stringify(state));
}

async function showTemplatePreview(id) {
  const tpl = loadTemplates().find(t => t.id === id);
  if (!tpl) return;
  const canvas = await _loadCanvas(id);
  if (!canvas) return;

  // 기존 미리보기 제거
  document.querySelectorAll('.tpl-preview-backdrop').forEach(el => el.remove());

  const backdrop = document.createElement('div');
  backdrop.className = 'tpl-preview-backdrop';
  backdrop.innerHTML = `
    <div class="tpl-preview-modal" role="dialog">
      <div class="tpl-preview-header">
        <div class="tpl-preview-header-info">
          <span class="tpl-preview-title">${escHtml(tpl.name)}</span>
          <span class="tpl-preview-cat">${escHtml(tpl.category || '')}</span>
          ${tpl.folder ? `<span class="tpl-preview-folder">${escHtml(tpl.folder)}</span>` : ''}
        </div>
        <button class="tpl-preview-close" title="닫기">
          <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
            <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
          </svg>
        </button>
      </div>
      <div class="tpl-preview-canvas">${canvas}</div>
      <div class="tpl-preview-footer">
        <button class="tpl-preview-insert-btn" data-tpl-id="${escHtml(tpl.id)}">${tpl.type === 'subsection' ? '+ 컴포넌트 삽입' : tpl.type === 'block' ? '+ 블록 삽입' : '+ 섹션 추가'}</button>
      </div>
    </div>`;

  document.body.appendChild(backdrop);

  // Scale section to fit preview viewport
  const previewCanvas = backdrop.querySelector('.tpl-preview-canvas');
  const section = previewCanvas.querySelector('.section-block') || previewCanvas.querySelector('.frame-block');
  if (section) {
    const CANVAS_WIDTH = 860;
    section.style.width = CANVAS_WIDTH + 'px';
    const sectionH = section.scrollHeight;
    const viewportW = previewCanvas.clientWidth;
    const viewportH = previewCanvas.clientHeight;
    const scaleX = viewportW / CANVAS_WIDTH;
    const scaleY = viewportH / sectionH;
    const scale = Math.min(scaleX, scaleY);
    section.style.transform = `scale(${scale})`;
    section.style.transformOrigin = 'top left';
  }

  backdrop.addEventListener('click', e => {
    if (e.target === backdrop) backdrop.remove();
  });

  backdrop.querySelector('.tpl-preview-close').addEventListener('click', e => {
    e.stopPropagation();
    backdrop.remove();
  });

  backdrop.querySelector('.tpl-preview-insert-btn').addEventListener('click', async e => {
    e.stopPropagation();
    const t = loadTemplates().find(x => x.id === e.currentTarget.dataset.tplId);
    if (t) { backdrop.remove(); await insertTemplate(t); }
  });
}

function startEditTemplate(id) {
  const tpl = loadTemplates().find(t => t.id === id);
  if (!tpl) return;

  // 기존 인라인 편집 닫기
  document.querySelectorAll('.tpl-edit-form').forEach(el => el.remove());
  document.querySelectorAll('.tpl-card.editing-mode').forEach(el => el.classList.remove('editing-mode'));

  const card = document.querySelector(`.tpl-card[data-tpl-id="${CSS.escape(id)}"]`);
  if (!card) return;
  card.classList.add('editing-mode');

  const allTemplates = loadTemplates();
  const existingFolders = [...new Set(allTemplates.map(t => t.folder || '기타'))];
  const currentFolder = tpl.folder || '기타';
  const folderOptions = existingFolders.map(f =>
    `<option value="${escHtml(f)}" ${f === currentFolder ? 'selected' : ''}>${escHtml(f)}</option>`
  ).join('');
  const catOptions = ['Hero','Main','Feature','Detail','CTA','Event','기타'].map(c =>
    `<option value="${escHtml(c)}" ${c === (tpl.category || '기타') ? 'selected' : ''}>${escHtml(c)}</option>`
  ).join('');

  const currentTags = (tpl.tags || []).join(', ');

  const form = document.createElement('div');
  form.className = 'tpl-edit-form';
  form.innerHTML = `
    <input class="tpl-edit-name" type="text" value="${escHtml(tpl.name)}" placeholder="템플릿 이름" />
    <select class="tpl-edit-folder">${folderOptions}<option value="__new__">새 폴더...</option></select>
    <input class="tpl-edit-folder-new" type="text" placeholder="새 폴더 이름" style="display:none;" />
    <select class="tpl-edit-cat">${catOptions}</select>
    <input class="tpl-edit-tags" type="text" value="${escHtml(currentTags)}" placeholder="태그 (쉼표 구분)" />
    <div class="tpl-edit-actions">
      <button class="tpl-edit-save">저장</button>
      <button class="tpl-edit-cancel">취소</button>
      <button class="tpl-edit-overwrite" title="현재 선택된 섹션으로 덮어쓰기">덮어쓰기</button>
    </div>`;

  card.insertAdjacentElement('afterend', form);

  const folderSel = form.querySelector('.tpl-edit-folder');
  const folderNewInput = form.querySelector('.tpl-edit-folder-new');
  folderSel.addEventListener('change', () => {
    folderNewInput.style.display = folderSel.value === '__new__' ? 'block' : 'none';
  });

  form.querySelector('.tpl-edit-cancel').addEventListener('click', () => {
    form.remove(); card.classList.remove('editing-mode');
  });

  form.querySelector('.tpl-edit-save').addEventListener('click', () => {
    const newName = form.querySelector('.tpl-edit-name').value.trim();
    const newCat  = form.querySelector('.tpl-edit-cat').value;
    let newFolder = folderSel.value === '__new__'
      ? (folderNewInput.value.trim() || '기타')
      : folderSel.value;
    const newTagsRaw = form.querySelector('.tpl-edit-tags')?.value || '';
    const newTags = newTagsRaw.split(',').map(t => t.trim()).filter(Boolean);
    if (!newName) return;
    const gEdit = _isSharedTemplate(id);
    if (gEdit.shared) {
      window.showToast?.(`🔒 '${gEdit.name}' 은(는) 공용 템플릿이라 수정할 수 없습니다. 캔버스에 넣은 뒤 «템플릿으로 저장»하면 내 것으로 만들 수 있습니다.`);
      form.remove();
      return;
    }
    const templates = loadTemplates();
    const idx = templates.findIndex(t => t.id === id);
    if (idx !== -1) {
      templates[idx].name = newName;
      templates[idx].folder = newFolder;
      templates[idx].category = newCat;
      templates[idx].tags = newTags;
      saveTemplates(templates);
    }
    form.remove();
    renderTemplatePanel();
  });

  form.querySelector('.tpl-edit-overwrite').addEventListener('click', async () => {
    const gOw = _isSharedTemplate(id);
    if (gOw.shared) {
      window.showToast?.(`🔒 '${gOw.name}' 은(는) 공용 템플릿이라 덮어쓸 수 없습니다. 캔버스에 넣은 뒤 «템플릿으로 저장»하면 내 것으로 만들 수 있습니다.`);
      form.remove();
      return;
    }
    const sec = canvasEl.querySelector('.section-block.selected');
    if (!sec) { alert('덮어쓸 섹션을 먼저 선택하세요.'); return; }
    const clone = sec.cloneNode(true);
    clone.classList.remove('selected', 'sec-bg-editing');
    clone.querySelectorAll('.sec-bg-editing').forEach(el => el.classList.remove('sec-bg-editing'));
    clone.querySelectorAll('.selected, .editing').forEach(el => el.classList.remove('selected', 'editing'));
    clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
    clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .sec-bg-proxy').forEach(el => el.remove());
    if (window.electronAPI?.saveTemplateCanvas) {
      await window.electronAPI.saveTemplateCanvas(id, clone.outerHTML);
    } else {
      const fi = _lsFullCache.findIndex(t => t.id === id);
      if (fi !== -1) { _lsFullCache[fi].canvas = clone.outerHTML; localStorage.setItem(TEMPLATE_KEY, JSON.stringify(_lsFullCache)); }
    }
    form.remove();
    renderTemplatePanel();
  });

  form.querySelector('.tpl-edit-name').focus();
}

function renderTemplatePanel() {
  const body = document.getElementById('template-panel-body');
  if (!body) return;
  const templates = loadTemplates();

  // 전체 폴더 목록 (기존 데이터 호환: folder 없으면 "기타")
  const allFolders = [...new Set(templates.map(t => t.folder || '기타'))];

  // 폴더 필터가 더 이상 유효하지 않으면 "전체"로 리셋
  if (_activeFolderFilter !== '전체' && !allFolders.includes(_activeFolderFilter)) {
    _activeFolderFilter = '전체';
  }

  // 검색 + 폴더 필터 HTML
  const folderDropdown = `
    <div class="tpl-search-bar">
      <input class="tpl-search-input" type="text" placeholder="이름·태그 검색..." value="${escHtml(_activeSearchQuery)}" />
    </div>
    <div class="tpl-folder-filter">
      <select class="tpl-folder-select">
        <option value="전체" ${_activeFolderFilter === '전체' ? 'selected' : ''}>전체 보기</option>
        ${allFolders.map(f => `<option value="${escHtml(f)}" ${f === _activeFolderFilter ? 'selected' : ''}>${escHtml(f)}</option>`).join('')}
      </select>
    </div>`;

  if (!templates.length) {
    body.innerHTML = folderDropdown + '<div class="tpl-empty">저장된 템플릿이 없습니다</div>';
    _bindFolderDropdown(body);
    _bindSearchInput(body);
    return;
  }

  // 폴더 필터 적용
  let filtered = _activeFolderFilter === '전체'
    ? templates
    : templates.filter(t => (t.folder || '기타') === _activeFolderFilter);

  // 검색 필터 적용 (이름 OR 태그)
  if (_activeSearchQuery.trim()) {
    const q = _activeSearchQuery.trim().toLowerCase();
    filtered = filtered.filter(t => {
      const nameMatch = t.name.toLowerCase().includes(q);
      const tagMatch  = (t.tags || []).some(tag => tag.toLowerCase().includes(q));
      return nameMatch || tagMatch;
    });
  }

  // 카테고리별 그룹핑
  const groups = {};
  filtered.forEach(tpl => {
    const cat = tpl.category || '기타';
    if (!groups[cat]) groups[cat] = [];
    groups[cat].push(tpl);
  });

  const folderState = loadFolderState();

  const listHtml = Object.entries(groups).map(([cat, tpls]) => {
    const isOpen = folderState[cat] === true;
    return `
      <div class="tpl-folder" data-folder-cat="${escHtml(cat)}">
        <div class="tpl-folder-header ${isOpen ? 'open' : ''}">
          <svg class="tpl-folder-arrow" width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
            <polyline points="2,2 6,4 2,6"/>
          </svg>
          <span class="tpl-folder-cat-name">${escHtml(cat)}</span>
          <span class="tpl-folder-count">${tpls.length}</span>
        </div>
        <div class="tpl-folder-body" style="display:${isOpen ? 'block' : 'none'}">
          ${tpls.map(tpl => {
            const date = tpl.createdAt ? tpl.createdAt.slice(0, 10) : '';
            const tagBadges = (tpl.tags || []).length
              ? `<div class="tpl-card-tags">${(tpl.tags).map(tag => `<span class="tpl-tag-badge" data-tag="${escHtml(tag)}">${escHtml(tag)}</span>`).join('')}</div>`
              : '';
            const typeBadge = tpl.type === 'subsection'
              ? `<span class="tpl-type-badge" style="font-size:9px;background:#2a3a5a;color:#6a9fdf;padding:1px 5px;border-radius:3px;margin-left:4px;">컴포넌트</span>`
              : tpl.type === 'block'
              ? `<span class="tpl-type-badge" style="font-size:9px;background:#2a4a2a;color:#6abf6a;padding:1px 5px;border-radius:3px;margin-left:4px;">블록</span>`
              : '';
            return `
              <div class="tpl-card" data-tpl-id="${escHtml(tpl.id)}">
                <div class="tpl-card-main">
                  <span class="tpl-card-name">${escHtml(tpl.name)}</span>${typeBadge}
                </div>
                ${tagBadges}
                <div class="tpl-card-meta">${escHtml(date)}</div>
                <div class="tpl-card-actions">
                  <button class="tpl-edit-btn" data-tpl-id="${escHtml(tpl.id)}" title="수정">
                    <svg width="8" height="8" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6">
                      <path d="M1 9 L2.5 5.5 L7.5 0.5 L9.5 2.5 L4.5 7.5 Z"/><line x1="6" y1="2" x2="8" y2="4"/>
                    </svg>
                  </button>
                  <button class="tpl-delete-btn" data-tpl-id="${escHtml(tpl.id)}" title="삭제">
                    <svg width="8" height="8" viewBox="0 0 8 8" fill="none" stroke="currentColor" stroke-width="1.8">
                      <line x1="1" y1="1" x2="7" y2="7"/><line x1="7" y1="1" x2="1" y2="7"/>
                    </svg>
                  </button>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>`;
  }).join('');

  const emptyMsg = _activeSearchQuery.trim()
    ? '<div class="tpl-empty">검색 결과가 없습니다</div>'
    : '<div class="tpl-empty">이 폴더에 템플릿이 없습니다</div>';

  body.innerHTML = folderDropdown + (listHtml || emptyMsg);

  _bindFolderDropdown(body);
  _bindSearchInput(body);

  // 카테고리 토글
  body.querySelectorAll('.tpl-folder-header').forEach(header => {
    header.addEventListener('click', () => {
      const folder = header.closest('.tpl-folder');
      const cat = folder.dataset.folderCat;
      const folderBody = folder.querySelector('.tpl-folder-body');
      const isOpen = header.classList.toggle('open');
      folderBody.style.display = isOpen ? 'block' : 'none';
      const state = loadFolderState();
      state[cat] = isOpen;
      saveFolderState(state);
    });
  });

  // 태그 뱃지 클릭 → 태그 검색 필터
  body.querySelectorAll('.tpl-tag-badge').forEach(badge => {
    badge.addEventListener('click', e => {
      e.stopPropagation();
      _activeSearchQuery = badge.dataset.tag || '';
      renderTemplatePanel();
    });
  });

  // 카드 클릭 → 미리보기
  body.querySelectorAll('.tpl-card').forEach(card => {
    card.addEventListener('click', e => {
      if (e.target.closest('.tpl-delete-btn') || e.target.closest('.tpl-edit-btn') || e.target.closest('.tpl-tag-badge')) return;
      showTemplatePreview(card.dataset.tplId);
    });
  });

  // 수정 버튼
  body.querySelectorAll('.tpl-edit-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      startEditTemplate(btn.dataset.tplId);
    });
  });

  // 삭제 버튼
  body.querySelectorAll('.tpl-delete-btn').forEach(btn => {
    btn.addEventListener('click', e => {
      e.stopPropagation();
      deleteTemplate(btn.dataset.tplId);
    });
  });
}

function _bindFolderDropdown(body) {
  const sel = body.querySelector('.tpl-folder-select');
  if (!sel) return;
  sel.addEventListener('change', () => {
    _activeFolderFilter = sel.value;
    renderTemplatePanel();
  });
}

function _bindSearchInput(body) {
  const input = body.querySelector('.tpl-search-input');
  if (!input) return;
  input.addEventListener('input', () => {
    _activeSearchQuery = input.value;
    renderTemplatePanel();
  });
  // 포커스 유지 (리렌더 후 커서 유지)
  if (_activeSearchQuery) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

export async function saveBlockAsTemplate(block, name, folder = '블록', tagsStr = '') {
  if (!block || !name) return;

  // tags 파싱
  const tags = tagsStr ? tagsStr.split(',').map(t => t.trim()).filter(Boolean) : [];
  const resolvedFolder = folder || '블록';

  // 저장용 클론 (핸들/편집모드 제거)
  const clone = block.cloneNode(true);
  clone.classList.remove('selected', 'hovered');
  clone.querySelectorAll('.block-resize-handle, .img-corner-handle, .img-edge-handle, .img-edit-hint, .img-boundary, .sec-bg-proxy, .block-toolbar').forEach(el => el.remove());
  clone.querySelectorAll('[contenteditable="true"]').forEach(el => el.setAttribute('contenteditable', 'false'));
  /* 블록 저장도 «같은 형제»다 — 현빈 지시가 「섹션이나 블럭들도 모두」였다. 순서는 위와 같다. */
  _tplStripPath(clone);
  _tplStampPath(clone);
  const html = clone.outerHTML;

  const id = 'btpl_' + Date.now() + '_' + Math.random().toString(36).slice(2, 6);
  const blockType = block.dataset.type || block.className.split(' ')[0];

  // canvas 저장
  if (window.electronAPI?.saveTemplateCanvas) {
    await window.electronAPI.saveTemplateCanvas(id, html);
  } else {
    // localStorage fallback
    _lsFullCache.unshift({ id, name, folder: resolvedFolder, category: blockType, tags, createdAt: new Date().toISOString(), thumbnail: null, type: 'block', blockType, canvas: html });
  }

  // 메타 저장
  const templates = loadTemplates();
  templates.unshift({
    id,
    name,
    folder: resolvedFolder,
    category: blockType,
    tags,
    createdAt: new Date().toISOString(),
    thumbnail: null,
    type: 'block',
    blockType
  });
  saveTemplates(templates);
  renderTemplatePanel();

  /* 토스트 — 격리 폴더로 갔으면 «그쪽 경고»가 우선이다.
     토스트는 자리가 하나라, 「저장됨」을 먼저 띄우면 경고가 그걸 덮어 두 번 깜빡인다. 하나만 띄운다. */
  if (!(await _noticeIfIsolatedRoot())) window.showToast?.('블록 템플릿 저장됨: ' + name);
}

// 크로스 모듈 접근용 window 노출
/* ══ 템플릿 «가리키기» API ══════════════════════════════════════════════════
   현빈 목적: MCP·클로드코드에서 「~아이디의 템플릿 추가해줘」처럼 «가리킬» 수 있게.
   ★캔버스를 건드리지 않는다 — 분리된 DOM 에서 계산만 한다.
   ⛔MCP 도구 «등록»은 여기서 하지 않는다. mcp-server.js·mcp-block-tools.js 는
     형제 스킬(goditor-manager-mcp) 소관이라, 그쪽이 이 둘을 부르면 된다. */
async function _tplRootOf(tplId) {
  const html = await _loadCanvas(tplId);
  if (!html) return null;
  const host = document.createElement('div');
  host.innerHTML = html;
  return host.firstElementChild;
}

function _tplNodeInfo(el, path) {
  return {
    path,
    kind: _tplKindOf(el) || 'root',
    text: (el.textContent || '').replace(/\s+/g, ' ').trim().slice(0, 80),
  };
}

/* 이 템플릿에 무엇이 있나 — 경로 목록. ★경로가 저장 안 된 «구 템플릿»도 파생이라 그대로 나온다. */
async function listTemplateNodes(tplId) {
  const root = await _tplRootOf(tplId);
  if (!root) return [];
  /* ★루트를 «목록에 넣는다»(경로 = 빈 문자열).
     넣지 않으면 block 템플릿(루트가 블록 자신이라 하위 노드가 0개)이 «빈 목록»으로 나와
     「가리킬 것이 없다」로 읽힌다 — 실제로는 findTemplateNode(id,'') 로 찾아지는데도.
     목록과 조회가 어긋나면 목록 쪽을 믿는 호출자가 헛다리를 짚는다. */
  const out = [_tplNodeInfo(root, '')];
  _tplPathOf(root).forEach((path, el) => out.push(_tplNodeInfo(el, path)));
  return out;
}

/* 그 경로가 무엇인가. 경로가 비면 «템플릿 루트» 자체. 못 찾으면 null. */
async function findTemplateNode(tplId, path) {
  const root = await _tplRootOf(tplId);
  if (!root) return null;
  const want = String(path == null ? '' : path).replace(/^#/, '').trim();
  if (!want) return Object.assign(_tplNodeInfo(root, ''), { html: root.outerHTML });
  for (const [el, p] of _tplPathOf(root)) {
    if (p === want) return Object.assign(_tplNodeInfo(el, p), { html: el.outerHTML });
  }
  return null;
}

window.loadTemplates        = loadTemplates;
window.loadTemplatesPublic  = loadTemplates;
window.saveTemplatesPublic  = saveTemplates;
window.saveAsTemplate       = saveAsTemplate;
window.saveBlockAsTemplate  = saveBlockAsTemplate;
window.deleteTemplate       = deleteTemplate;
window.insertTemplate       = insertTemplate;
window.renderSectionTags    = renderSectionTags;
window.renderTemplatePanel  = renderTemplatePanel;
window.initTemplates        = initTemplates;
window._loadCanvas          = _loadCanvas;
window.listTemplateNodes    = listTemplateNodes;
window.findTemplateNode     = findTemplateNode;
window.showTemplatePreview  = showTemplatePreview;

/* ── 떼어낸 템플릿 창에서 오는 명령 ──
   ★삽입은 «편집기»에서 일어나야 한다 — 「어느 섹션에 넣나」의 주인이 여기이기 때문이다.
     팝아웃 창은 선택 상태를 모르므로 id 만 보내고, 실제 삽입은 이 창이 자기 insertTemplate 으로 한다.
   ⛔찾지 못한 id 를 «조용히» 흘리지 마라 — 그러면 「눌렀는데 아무 말이 없다」가 다시 생긴다. */
/* ★팝아웃 창이 부르는 «편집기 쪽 입구». main 이 executeJavaScript 로 부르고 «반환값»을 받아간다
     (이 앱의 기존 관례 — _invokeRendererUpdateIconifyBlock 과 같은 방식).
   ⛔예전엔 webContents.send 로 «보내기만» 했다. 그래서 팝아웃은 「보냈다」를 「넣었다」로 말했고,
     실제로는 안 들어갔는데 앞 창이 성공을 띄웠다(거짓 성공). 결과를 받아야 사실대로 말할 수 있다.
   ⛔insertTemplate 의 시그니처는 «건드리지 않는다» — 편집기 내부 호출처가 여럿이다.
     대신 ⑴삽입 «전후»를 세고 ⑵편집기가 스스로 띄운 토스트를 사유로 가로챈다. */
window.__tplEditorCommand = async (p) => {
  try {
    if (!p || !p.action) return { ok: false, reason: '알 수 없는 명령입니다.' };
    if (p.action === 'open-panel') { window.openTemplateBrowser?.(); return { ok: true }; }
    if (p.action !== 'insert') return { ok: false, reason: '알 수 없는 명령입니다.' };

    const tpl = loadTemplates().find(t => t.id === p.id);
    if (!tpl) return { ok: false, reason: '템플릿을 찾지 못했습니다. 목록을 새로 고쳐 주세요.' };

    // ★«무엇이 늘어야 하나»는 insertTemplate 의 분기와 같아야 한다(block=row / subsection=frame / else=section)
    const snap = () => ({
      sec:   canvasEl.querySelectorAll('.section-block').length,
      frame: canvasEl.querySelectorAll('.frame-block').length,
      row:   canvasEl.querySelectorAll('.row').length,
      total: canvasEl.querySelectorAll('*').length,
    });

    /* 편집기가 «스스로 아는 사유»를 그대로 쓴다 — 여기서 사유를 새로 지어내면 두 곳이 갈린다.
       ⛔원본 토스트는 그대로 부른다(편집기 사용자에게 보이는 동작을 바꾸지 않는다). */
    let lastMsg = '';
    const origToast = window.showToast;
    window.showToast = function (m) { lastMsg = String(m == null ? '' : m); return origToast?.apply(this, arguments); };

    const before = snap();
    try { await insertTemplate(tpl); }
    finally { window.showToast = origToast; }
    const after = snap();

    const grew = (k) => after[k] > before[k];
    const ok = tpl.type === 'block'      ? (grew('row')   || grew('total'))
             : tpl.type === 'subsection' ? (grew('frame') || grew('total'))
             :                             grew('sec');
    if (ok) return { ok: true };
    // 사유는 편집기가 방금 띄운 문구에서 «❌/⚠️» 장식만 떼어 넘긴다
    const reason = lastMsg.replace(/^[❌⚠️🔒\s]+/, '').trim();
    return { ok: false, reason: reason || '편집기가 삽입하지 못했습니다.' };
  } catch (e) {
    return { ok: false, reason: (e && e.message) || '알 수 없는 오류' };
  }
};
