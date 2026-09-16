/* ── Grid(다단) 블록 프로퍼티 패널 ──
   구조(컬럼/라인 추가·삭제)는 CDP/updateGridBlock 영역 — 패널은 간격·정렬·행 높이만 다룬다(P1.5: 글자는 캔버스 인라인 편집 — js/block-drag.js). */
import { propPanel } from '../globals.js';
import { parseRatio, buildGridPicker, alignBtn, bindSlider } from './_helpers.js';
import { ROW_H_MAX } from '../grid-cell-resize.js';   // ★상한은 한 곳에서만 온다
import { gridRows, getGridModel, gridPreviewLine, gridLineHasText, GRID_ROLES, GRID_COLOR_RE,
         MIN_COLS, MAX_COLS, MIN_ROWS, MAX_ROWS, GRID_CELL_DEFAULT_TEXT, MAX_CELL_LINES,
         gridGaps, GRID_GAP_MAX } from '../blocks/grid-block.js';
import { showGridGutters, hideGridGutters } from '../overlay-handles.js';
import { buildTypographySectionHtml, buildFillSectionHtml } from './_typo-section.js';
import { wireFontPicker } from './_font-picker.js';
import { wireColorVarChips, parseColorVarName } from './color-var-chips.js';
import { parseAlphaFromColor, swatchHex } from './color-picker.js';

/* ══ 줄(line) 선택 — 「지금 우측 패널이 보고 있는 줄」 ═══════════════════════
 * ★블록별로 «주소»(r,c,li)를 기억한다. prop-banner02.js 의 _bn2ActiveLine 선례(어휘까지 빌린다).
 * ⛔DOM 노드 참조로 들지 마라 — renderGridBlock 이 innerHTML 을 통째로 갈아끼워 매 조작마다 죽는다.
 *   그래서 «주소»를 들고, 렌더 뒤에 _grdSyncLineMark 로 «다시» 붙인다. */
const _grdActiveLine = new WeakMap();
export function grdSetActiveLine(block, addr) { _grdActiveLine.set(block, addr || null); }
export function grdGetActiveLine(block) { return _grdActiveLine.get(block) || null; }
if (typeof window !== 'undefined') {
  window.grdSetActiveLine = grdSetActiveLine;
  window.grdGetActiveLine = grdGetActiveLine;
}

/* 캔버스에서 선택된 줄에 마커. ⛔`.selected` 재활용 금지 — editor.js 의
   querySelectorAll('.selected') 범용 조회가 그걸 보고 ⌘M 섹션 합치기가 조용히 죽는다. */
function _grdSyncLineMark(block, addr) {
  document.querySelectorAll('.grd-line-selected').forEach(el => el.classList.remove('grd-line-selected'));
  document.querySelectorAll('.grd-cell-selected').forEach(el => el.classList.remove('grd-cell-selected'));
  if (!addr || !block) return;
  // ★addr.li===null — 「빈 칸」 셀 모드(T-A). 줄이 아니라 «칸 자체」에 마커를 붙인다.
  if (addr.li === null) {
    block.querySelector(`.grd-cell[data-r="${addr.r}"][data-c="${addr.c}"]`)?.classList.add('grd-cell-selected');
    return;
  }
  block.querySelector(`[data-r="${addr.r}"][data-c="${addr.c}"][data-line="${addr.li}"]`)
    ?.classList.add('grd-line-selected');
}
if (typeof window !== 'undefined') window._grdSyncLineMark = _grdSyncLineMark;

/** 주소가 «지금도 유효한 글자 줄»인지 확인해 {r,c,li,line} 으로 돌려준다. 아니면 null.
 *  ⛔DOM 순서 역산 금지 — data-r/data-c/data-line 이 정본이다(grid-block.js 의 addr 규약). */
function _grdResolveAddr(block, addr) {
  if (!addr || !block) return null;
  // ★addr.li===null 은 「빈 셀」(셀 모드, T-A) 표식이다 — Number(null)===0 이라 그냥 두면
  //   li:0 처럼 통과해 버릴 수 있다(그 사이 다른 경로가 그 칸에 줄을 채워 넣은 드문 동시성
  //   케이스). 글자 줄 전용 판정이니 셀 모드는 여기서 명시적으로 걸러낸다.
  if (addr.li === null) return null;
  const r = Number(addr.r), c = Number(addr.c), li = Number(addr.li);
  if (![r, c, li].every(Number.isInteger)) return null;
  let cells;
  try { cells = getGridModel(block).cells; } catch (_) { return null; }
  const line = cells?.[r]?.[c]?.lines?.[li];
  if (!line || typeof line !== 'object') return null;
  // ⛔「글자를 담는 줄인가」를 여기서 «다시 판정하지» 않는다 — grid-block.js 가 렌더러로 답한다.
  if (!gridLineHasText(line)) return null;
  return { r, c, li, line };
}

/** 지금 그 줄의 «살아 있는» 데이터(재렌더 뒤에도 최신). */
function _grdLine(block, addr) {
  const hit = _grdResolveAddr(block, addr);
  return hit ? hit.line : null;
}

/** «어떤 줄이든» 유효한 주소인지 확인한다 — 글자 줄만 인정하는 _grdResolveAddr 과 다르다.
 *  이미지/갭 줄도, 아직 줄이 하나도 없는 «빈 셀»(li:null, 셀 모드)도 여기서 받는다.
 *  ⛔_grdResolveAddr 은 «한 글자도 바꾸지 않는다» — Typography/Fill 절 전용 판정이고
 *    tests/dom/grid-typo.dom.spec.js D1-b 가 그 판정식을 직접 단언한다.
 *  addr.li === null → 셀 모드(빈 셀 클릭 포함). 정수 li → 그 줄이 실제로 있어야 한다. */
function _grdResolveAnyAddr(block, addr) {
  if (!addr || !block) return null;
  const r = Number(addr.r), c = Number(addr.c);
  if (!Number.isInteger(r) || !Number.isInteger(c)) return null;
  let model;
  try { model = getGridModel(block); } catch (_) { return null; }
  if (r < 0 || r >= model.rows.length || c < 0 || c >= model.cols.length) return null;
  if (addr.li === null) return { r, c, li: null, line: null };
  const li = Number(addr.li);
  if (!Number.isInteger(li)) return null;
  const lines = model.cells?.[r]?.[c]?.lines;
  const line = Array.isArray(lines) ? lines[li] : undefined;
  if (!line || typeof line !== 'object') return null;
  return { r, c, li, line };
}

const _grdRoleOf = (line) => GRID_ROLES[line && line.type] || GRID_ROLES.body;

/* ⚠️자간 «단위 불일치» — 역할값은 em 문자열('0.04em'), 패널의 ${p}-ls-number 는 px 숫자다.
   읽을 땐 px = em × size 로 환산(실측 대조: label 16 × 0.04 = 0.64px · h1 64 × −0.02 = −1.28px),
   쓸 땐 px 를 그대로 저장한다. ⇒ 안 건드린 줄은 계속 em 이라 크기를 바꾸면 자간이 따라오고,
   «직접 정한» 줄만 px 로 고정된다 — 의도된 비대칭(U1-b 가 못박는다). */
function _grdRoleLsPx(role, size) {
  const m = String(role.ls ?? '0').trim().match(/^(-?[\d.]+)em$/);
  if (m) return +(Number(m[1]) * size).toFixed(2);
  const n = Number(role.ls);
  return Number.isFinite(n) ? n : 0;
}

/* 이 줄이 «직접 지정»할 수 있는 타이포 필드 전부 — 요약 한 줄과 [↺ 기본값으로] 가 같은 목록을 쓴다. */
const _GRD_TYPO_FIELDS = ['fontSize', 'weight', 'color', 'lineHeight', 'letterSpacing', 'fontFamily', 'italic', 'strike'];
const _grdHas = (line, k) => line[k] !== undefined && line[k] !== null && line[k] !== '';

/* ══ 셀에 «줄 추가» — 공용 함수 ══════════════════════════════════════════════
 * ★T-A(빈 셀 선택+단축키)·T-B(이미지 새 줄) 둘 다 이 함수 하나로 모인다 — 우클릭 이미지
 *   추가(block-factory.js)·패널 [+ 줄 추가]·빈 셀 3버튼·T/G/K 단축키가 전부 이걸 부른다.
 *   ⛔각자 splice 로직을 복붙하지 않는다(우클릭 이미지 추가 vs 패널 [+ 줄 추가]가 그렇게
 *   두 벌이었다 — 2026-09-16 통합).
 * @param {HTMLElement} block
 * @param {{r:number,c:number}} pos
 * @param {number|null} afterLi  null → 셀 끝에 append(빈 셀 채우기 포함) · 정수 → 그 줄 다음에 삽입
 * @param {object} lineSpec      새로 넣을 줄 데이터(예: {type:'body',text:''})
 * @returns {{ok:true, li:number}|{ok:false, code:'LIMIT'}} */
export function grdAddLine(block, pos, afterLi, lineSpec = { type: 'body', text: '' }) {
  const { r, c } = pos;
  let curLines;
  try { curLines = getGridModel(block).cells?.[r]?.[c]?.lines || []; } catch (_) { curLines = []; }
  // ★상한을 먼저 확인한다 — 실패가 확실한 호출 앞에서 grdSetActiveLine 을 먼저 부르면
  //   존재하지 않는 li 를 가리키게 된다(prop-grid.js 옛 주석의 순서 규약, 그대로 계승).
  if (curLines.length >= MAX_CELL_LINES) {
    window.showToast?.(`⚠️ 줄 추가 실패: 셀당 최대 ${MAX_CELL_LINES}줄`);
    return { ok: false, code: 'LIMIT' };
  }
  const insertAt = (afterLi === null || afterLi === undefined) ? curLines.length : afterLi + 1;
  const newLines = curLines.slice();
  newLines.splice(insertAt, 0, lineSpec);
  grdSetActiveLine(block, { r, c, li: insertAt });
  // updateGridBlock 이 pushHistory + 재렌더 + 패널 재표시를 스스로 한다(줄 삭제·비율 입력과 같은 원칙).
  window.updateGridBlock?.(block.id, { patchCell: { r, c, lines: newLines } });
  return { ok: true, li: insertAt };
}
if (typeof window !== 'undefined') window.grdAddLine = grdAddLine;

/* SVG 마크업 → data URI. 아이콘 새 줄은 기존 image 라인 타입을 그대로 쓴다(현빈 확정:
 * 재착색 불필요 → 새 icon 타입·새 새니타이저 불필요, GRID_LINE_FIELDS 변경 없음). */
function _grdSvgToDataUri(svg) {
  return 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(String(svg || ''))));
}

/* ══ 전역 T/G/K 단축키 → 그리드 우선처리 ═══════════════════════════════════
 * editor.js 의 addText/addGap 분기, 그리고 하드코딩된 K 분기가 «먼저» 이걸 부른다.
 * 정확히 하나의 그리드 블록이 selected 이고 그 블록에 «기억된 주소»가 유효할 때만 처리해
 * true 를 돌려준다 — false 면 호출부가 기존 전역 동작(텍스트/갭 블록 추가)으로 흘려보낸다. */
export function grdAddLineToSelectedCell(type) {
  const blocks = document.querySelectorAll('.grid-block.selected');
  if (blocks.length !== 1) return false;
  const block = blocks[0];
  const hit = _grdResolveAnyAddr(block, grdGetActiveLine(block));
  if (!hit) return false;
  const lineSpec = type === 'gap' ? { type: 'gap', height: 16 } : { type: 'body', text: '' };
  const res = grdAddLine(block, { r: hit.r, c: hit.c }, hit.li, lineSpec);
  return !!(res && res.ok);
}
if (typeof window !== 'undefined') window.grdAddLineToSelectedCell = grdAddLineToSelectedCell;

/* K 단축키(아이콘) — 위와 같은 게이트이지만 피커가 비동기다. 반환은 「게이트를 통과해
 * 피커를 열었나」다(삽입 성공 여부가 아니다) — 호출부는 이 값으로 전역 흐름 여부만 정한다. */
export function grdAddIconToSelectedCell() {
  const blocks = document.querySelectorAll('.grid-block.selected');
  if (blocks.length !== 1) return false;
  const block = blocks[0];
  const hit = _grdResolveAnyAddr(block, grdGetActiveLine(block));
  if (!hit) return false;
  window.openIconifyModal?.((picked) => {
    const imgSrc = _grdSvgToDataUri(picked.svg);
    grdAddLine(block, { r: hit.r, c: hit.c }, hit.li, { type: 'image', imgSrc, height: picked.size || 64 });
  });
  return true;
}
if (typeof window !== 'undefined') window.grdAddIconToSelectedCell = grdAddIconToSelectedCell;

/* ══ 줄바(line bar) — 요약 + [+ 줄 추가]/[줄 삭제]/[↺ 기본값으로], 빈 셀은 T/G/K 3버튼 ══
 * ★Typography 절에서 분리됐다(2026-09-16) — 이전엔 «글자 줄»에서만 떴다(_grdResolveAddr 이
 *   텍스트 줄만 인정해서, prop-grid.js 옛 _grdTypoSectionsHtml 안에 같이 있었다). 이미지·갭
 *   줄, «빈 셀»도 줄을 추가/삭제할 수 있어야 하므로 _grdResolveAnyAddr 로 판정한 anyHit 을 받는다.
 * ⛔[↺ 기본값으로]만 텍스트 줄 전용이다 — 이미지·갭엔 타이포 필드가 없다. */
function _grdLineBarHtml(anyHit, block) {
  if (!anyHit) {
    return `
    <div class="prop-section">
      <div class="prop-hint">캔버스에서 «칸이나 줄을 클릭»하면 여기서 줄을 추가·삭제할 수 있다.</div>
    </div>`;
  }
  const { r, c, li, line } = anyHit;
  if (li === null) {
    // 빈 셀 — 아직 줄이 하나도 없다. 텍스트/갭/아이콘 중 하나로 첫 줄을 만든다.
    return `
    <div class="prop-section" style="padding-bottom:4px;">
      <div class="prop-row" style="align-items:center;gap:6px;">
        <span class="prop-hint" style="flex:1;min-width:0;">${r + 1}행 ${c + 1}열 · 빈 칸</span>
      </div>
      <div class="prop-row" style="gap:6px;flex-wrap:wrap;">
        <button id="grd-cell-add-text-btn" class="prop-btn-sm" title="텍스트 줄 추가 (단축키 T)">+ 텍스트 (T)</button>
        <button id="grd-cell-add-gap-btn" class="prop-btn-sm" title="갭 줄 추가 (단축키 G)">+ 갭 (G)</button>
        <button id="grd-cell-add-icon-btn" class="prop-btn-sm" title="아이콘 줄 추가 (단축키 K)">+ 아이콘 (K)</button>
      </div>
    </div>`;
  }
  const isTextLine = gridLineHasText(line);
  const nSet = _GRD_TYPO_FIELDS.filter(k => _grdHas(line, k)).length;
  const summary = `${r + 1}행 ${c + 1}열 · ${li + 1}번째 줄 (${line.type || 'body'}) — `
    + `직접 지정 ${nSet} · 역할 기본 ${_GRD_TYPO_FIELDS.length - nSet}`;
  let cellLineCount = 1;
  try { cellLineCount = (getGridModel(block).cells?.[r]?.[c]?.lines || []).length || 1; } catch (_) {}
  const canDeleteLine = cellLineCount > 1;
  return `
    <div class="prop-section" style="padding-bottom:4px;">
      <div class="prop-row" style="align-items:center;gap:6px;flex-wrap:wrap;">
        <span class="prop-hint" id="grd-line-summary" style="flex:1 1 100%;min-width:0;">${summary}</span>
        <button id="grd-line-add-btn" class="prop-btn-sm" title="이 줄 다음에 새 줄을 추가합니다">+ 줄 추가</button>
        <button id="grd-line-del-btn" class="prop-btn-sm" ${canDeleteLine ? '' : 'disabled'}
                title="${canDeleteLine ? '이 줄을 삭제합니다' : '칸에 남은 마지막 줄은 지울 수 없습니다'}">줄 삭제</button>
        <button id="grd-line-reset" class="prop-btn-sm" ${isTextLine ? '' : 'disabled'}
                title="${isTextLine ? '이 줄에 «손으로 준 값»을 전부 지우고 기본값으로 되돌립니다 (⌘Z 로 복원)' : '이미지·갭 줄엔 타이포 필드가 없습니다'}">↺ 기본값으로</button>
      </div>
    </div>`;
}

/* 줄바 배선 — [+ 줄 추가]/[줄 삭제]/[↺ 기본값으로] + 빈 셀 3버튼(T/G/K). */
function _grdWireLineBar(block, addr) {
  const hit = _grdResolveAnyAddr(block, addr);
  if (!hit) return;
  const { r, c, li, line } = hit;

  if (li === null) {
    document.getElementById('grd-cell-add-text-btn')?.addEventListener('click', () => {
      grdAddLine(block, { r, c }, null, { type: 'body', text: '' });
    });
    document.getElementById('grd-cell-add-gap-btn')?.addEventListener('click', () => {
      grdAddLine(block, { r, c }, null, { type: 'gap', height: 16 });
    });
    document.getElementById('grd-cell-add-icon-btn')?.addEventListener('click', () => {
      window.openIconifyModal?.((picked) => {
        const imgSrc = _grdSvgToDataUri(picked.svg);
        grdAddLine(block, { r, c }, null, { type: 'image', imgSrc, height: picked.size || 64 });
      });
    });
    return;
  }

  document.getElementById('grd-line-add-btn')?.addEventListener('click', () => {
    grdAddLine(block, { r, c }, li, { type: 'body', text: '' });
  });
  document.getElementById('grd-line-del-btn')?.addEventListener('click', (e) => {
    if (e.currentTarget.disabled) return;
    let curLines;
    try { curLines = getGridModel(block).cells?.[r]?.[c]?.lines || []; } catch (_) { curLines = []; }
    if (curLines.length <= 1) return;   // 마지막 한 줄은 지우지 않는다(버튼도 disabled)
    const newLines = curLines.filter((_, i) => i !== li);
    const newLi = Math.min(li, newLines.length - 1);
    grdSetActiveLine(block, newLines.length ? { r, c, li: newLi } : null);
    window.updateGridBlock?.(block.id, { patchCell: { r, c, lines: newLines } });
  });
  if (gridLineHasText(line)) {
    document.getElementById('grd-line-reset')?.addEventListener('click', () => {
      const cleared = {};
      _GRD_TYPO_FIELDS.forEach(k => { cleared[k] = undefined; });
      window.pushHistory?.();
      gridPreviewLine(block, r, c, li, cleared);
      window.scheduleAutoSave?.();
      showGridProperties(block, { r, c, li });
    });
  }
}

/* ══ 이미지 절 — anyHit.line.type === 'image' 일 때만 뜬다 ══════════════════
 * ★다른 블록의 「이미지 선택…」과 같은 방식(FileReader→dataURL)을 재사용한다
 *   (prop-simple-card.js cvb-card-img-btn · prop-zoom.js 선례). goya-asset:// 외부화는
 *   여기서 하지 않는다(그 둘도 안 한다 — 외부화는 저장 시점의 별도 관심사). */
function _grdImageSectionHtml(anyHit, block) {
  if (!anyHit || anyHit.li === null || !anyHit.line || anyHit.line.type !== 'image') return '';
  const { r, c, line } = anyHit;
  const h = Number(line.height) || '';
  const rad = Number(line.radius) || '';
  /* ★「이미지 제거」= «줄 삭제»와 같은 동작(줄 자체를 지운다, imgSrc만 비우지 않는다) —
   *   T-009 버그A: imgSrc만 비우면 line.type==='image'가 그대로 남아 렌더러가 빈 이미지
   *   placeholder(회색 배경, grid-block.js:385)를 영구히 그린다. 「제거」가 곧 「줄 삭제」이므로
   *   마지막 한 줄 보호도 줄바(_grdLineBarHtml)의 canDeleteLine과 «같은 조건»을 쓴다. */
  let cellLineCount = 1;
  try { cellLineCount = (getGridModel(block).cells?.[r]?.[c]?.lines || []).length || 1; } catch (_) {}
  const canRemove = !!line.imgSrc && cellLineCount > 1;
  return `
    <div class="prop-section">
      <div class="prop-section-title">Image</div>
      <div class="prop-row">
        <button id="grd-img-pick-btn" class="prop-btn-full">${line.imgSrc ? '이미지 교체…' : '이미지 선택…'}</button>
      </div>
      <div class="prop-row">
        <span class="prop-label">높이(px)</span>
        <input type="number" class="prop-number" id="grd-img-height" min="0" placeholder="auto" value="${h}">
      </div>
      <div class="prop-row">
        <span class="prop-label">모서리 반경(px)</span>
        <input type="number" class="prop-number" id="grd-img-radius" min="0" placeholder="0" value="${rad}">
      </div>
      <div class="prop-row">
        <button id="grd-img-remove-btn" class="prop-btn-full prop-btn-danger" ${canRemove ? '' : 'disabled'}
                title="${cellLineCount > 1 ? '이 이미지 줄을 삭제합니다' : '칸에 남은 마지막 줄은 지울 수 없습니다'}">이미지 제거</button>
      </div>
    </div>`;
}

function _grdWireImageSection(block, addr) {
  const hit = _grdResolveAnyAddr(block, addr);
  if (!hit || hit.li === null || !hit.line || hit.line.type !== 'image') return;
  const { r, c, li } = hit;

  document.getElementById('grd-img-pick-btn')?.addEventListener('click', () => {
    const input = document.createElement('input');
    input.type = 'file';
    input.accept = 'image/*';
    input.onchange = () => {
      const file = input.files[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = ev => {
        const res = window.updateGridBlock?.(block.id, { patchCell: { r, c, lineIndex: li, imgSrc: ev.target.result } });
        if (res && res.ok === false) {
          const msg = res.code === 'TOO_LARGE'
            ? '⚠️ 이미지가 너무 큽니다 — 더 작은 파일로 다시 시도해 주세요'
            : '❌ 이미지 추가 실패: ' + res.message;
          window.showToast?.(msg);
        }
      };
      reader.readAsDataURL(file);
    };
    input.click();
  });

  const numWire = (id, field) => {
    document.getElementById(id)?.addEventListener('change', (e) => {
      const raw = String(e.target.value).trim();
      const v = raw === '' ? undefined : Math.max(0, parseInt(raw, 10) || 0);
      window.pushHistory?.();
      gridPreviewLine(block, r, c, li, { [field]: v });
      _grdSyncLineMark(block, { r, c, li });   // 재렌더가 마커를 지웠다 — 다시 붙인다
      window.scheduleAutoSave?.();
    });
  };
  numWire('grd-img-height', 'height');
  numWire('grd-img-radius', 'radius');

  document.getElementById('grd-img-remove-btn')?.addEventListener('click', (e) => {
    if (e.currentTarget.disabled) return;
    // ★줄 삭제(_grdWireLineBar의 grd-line-del-btn)와 «같은 경로» — imgSrc만 비우면
    //   type:'image' 줄이 그대로 남아 빈 이미지 placeholder(회색 배경)가 영구히 남는다(T-009 버그A).
    let curLines;
    try { curLines = getGridModel(block).cells?.[r]?.[c]?.lines || []; } catch (_) { curLines = []; }
    if (curLines.length <= 1) return;   // 마지막 한 줄은 지우지 않는다(버튼도 disabled)
    const newLines = curLines.filter((_, i) => i !== li);
    const newLi = Math.min(li, newLines.length - 1);
    grdSetActiveLine(block, newLines.length ? { r, c, li: newLi } : null);
    const res = window.updateGridBlock?.(block.id, { patchCell: { r, c, lines: newLines } });
    if (res && res.ok === false) window.showToast?.('❌ 이미지 제거 실패: ' + res.message);
  });
}

/* ── 컬럼 «비율» UI ────────────────────────────────────────────────────────
 * 렌더러(grid-block.js)는 이미 임의 비율을 지원한다 — 각 컬럼에 flex:(w/총합*100).
 * ★2026-09-04 P0: 슬라이더(2열 20~80 클램프 / 3열 칸별 슬라이더) → 테이블식 `1:1:1` 텍스트
 *   + 「균등」 버튼으로 교체(현빈 지시). 파서는 prop-table.js `_applyColRatio`에서 뽑아온
 *   parseRatio(_helpers.js)를 공용으로 쓴다(복붙 금지) — 부족 1 패딩·초과 자름 규칙 동일.
 * ⛔px width 를 직접 쓰지 말 것 — flex 가중치를 유지해야 폭 계산 함정에 새로 노출되지 않는다.
 * ⛔20~80 클램프도 제거됐다 — 텍스트 입력은 `9:1`도 허용한다(테이블도 그렇다). */
function _ratioRowHtml(cols) {
  if (cols.length < 2) return '';
  /* ★소수 비율(예: 0.5:1.5)을 «있는 그대로» 보여준다.
   * 이전엔 Math.max(1, …) 라 0.5 가 1 로 뭉개져, 패널을 다시 열면 1:1 로 «거짓 표시»됐다.
   * 값은 살아 있는데 화면만 틀리는 종류라 사용자가 「안 먹었다」고 읽는다.
   * 표시는 소수 2자리까지, 정수면 정수로(1.00 이 아니라 1). */
  const curRatioStr = cols.map(c => {
    const n = Number(c.width);
    const v = Number.isFinite(n) && n > 0 ? n : 1;
    return Number.isInteger(v) ? String(v) : String(+v.toFixed(2));
  }).join(':');
  return `
      <div class="prop-row">
        <span class="prop-label">비율</span>
        <input type="text" class="prop-input" id="grd-col-ratio" placeholder="1:1:1" value="${curRatioStr}" style="flex:1 1 0;min-width:0;font-size:11px;height:24px;background:#1a1a1a;color:#e5e5e5;border:1px solid #333;border-radius:4px;padding:0 8px;">
        <button id="grd-col-ratio-reset" style="height:24px;flex:0 0 auto;padding:0 10px;font-size:11px;white-space:nowrap;background:#262626;color:#e5e5e5;border:1px solid #333;border-radius:4px;cursor:pointer;line-height:1;box-sizing:border-box;">균등</button>
      </div>
      <div class="prop-hint">예: 1:1:2 → 25/25/50%</div>`;
}

/* ── 행 «높이» UI ──────────────────────────────────────────────────────────
 * ★2026-09-04 P1: 열은 «비율»(가중치)이지만 행은 «px 최소높이»다(PLAN §3-A, 테이블
 *   U5a 와 같은 의미론) — 그래서 열처럼 `1:1:1` 합성 비율 입력을 쓰지 않고, 테이블의
 *   행별 높이 입력(prop-table.js `.tbl-rowh-item-row`)과 같은 마크업으로 «행마다 하나씩» 받는다.
 * rows 가 1개(옛 파일과 동일 상태)면 아예 렌더하지 않는다 — 「비율은 있는데 높이는 없다」는
 *   행 개념이 아직 없다는 뜻이라 보여줄 게 없다(PLAN §4 "행이 생기면 …rows>1일 때만 노출"). */
function _rowHeightHtml(rows) {
  if (rows.length < 2) return '';
  const items = rows.map((r, ri) => `
      <div class="grd-rowh-item-row" style="display:flex;align-items:center;gap:6px;">
        <span class="prop-sublabel" style="width:40px;font-size:11px;color:#888;">행 ${ri + 1}</span>
        <input type="number" class="prop-number grd-row-h-item" data-ri="${ri}" min="0" max="${ROW_H_MAX}"
               placeholder="auto" value="${r.height === 'auto' ? '' : r.height}" title="이 행 높이(px). 비우면 자동" style="width:70px;">
      </div>`).join('');
  return `
      <div class="prop-row" style="align-items:flex-start;">
        <span class="prop-label" style="padding-top:4px;">행 높이</span>
        <div class="grd-rowh-list" style="display:flex;flex-direction:column;gap:4px;flex:1;">${items}</div>
      </div>
      <div class="prop-hint">비우면 자동(내용 높이) · 값은 «최소» 높이(내용이 더 크면 늘어난다)</div>`;
}

/* ── 열/행 「간격」 UI ───────────────────────────────────────────────────────
 * ★2026-09-16(T-D): 09-05 에 지운 「간격」(양축 동시) 슬라이더의 재도입이 아니다 — 그건
 *   재도입하지 않는다(현빈 지시). 이번엔 열 간격/행 간격을 따로 조작한다(월계수 블록의
 *   "셀 가로/세로 간격" 2슬라이더 선례와 같은 형태, 라벨/필드명은 그리드 고유 어휘로 확정).
 * ★1열/1행에서는 그 축 갭이 화면에 효과가 없어 죽은 컨트롤이 된다 — cols.length>=2 /
 *   rows.length>=2 일 때만 각각 노출한다(_ratioRowHtml/_rowHeightHtml 과 같은 술어). */
function _gapRowHtml(cols, rows, colGap, rowGap) {
  let html = '';
  if (cols.length >= 2) {
    html += `
      <div class="prop-row">
        <span class="prop-label">열 간격</span>
        <input type="range" class="prop-slider" id="grd-col-gap-slider" min="0" max="${GRID_GAP_MAX}" step="2" value="${colGap}">
        <input type="number" class="prop-number" id="grd-col-gap-number" min="0" max="${GRID_GAP_MAX}" value="${colGap}">
      </div>`;
  }
  if (rows.length >= 2) {
    html += `
      <div class="prop-row">
        <span class="prop-label">행 간격</span>
        <input type="range" class="prop-slider" id="grd-row-gap-slider" min="0" max="${GRID_GAP_MAX}" step="2" value="${rowGap}">
        <input type="number" class="prop-number" id="grd-row-gap-number" min="0" max="${GRID_GAP_MAX}" value="${rowGap}">
      </div>`;
  }
  if (!html) return '';
  return html + `<div class="prop-hint">행/열 사이 간격(px)</div>`;
}

/* ══ Typography·Fill 절 — 마크업은 «부품»이 낸다 ═══════════════════════════
 * ⛔여기에 절 마크업을 «베끼지» 마라 — _typo-section.js 한 곳에서만 온다.
 *   tests/unit/typo-section-ssot.test.mjs T2·T2-b 가 이 파일도 같은 루프로 검사한다.
 *
 * ★value(명시) vs placeholder(역할 기본값)를 «구분»한다.
 *   이 레포가 이미 쓰는 말이다 — 위 _rowHeightHtml 의 행 높이가 `placeholder="auto" value=""`
 *   («비우면 자동»)이고, prop-banner02 의 Size 절도 같다. 새 관용구를 만들지 않는다.
 *   ⛔구분을 안 하면: 값을 채워 두면 사용자가 「이 줄은 16px 로 정해뒀다」고 착각하고,
 *     더 나쁘게는 «아무것도 안 만졌는데» change 가 한 번 튀기만 해도 역할 폴백이
 *     데이터에 «굳어버린다»(line.fontSize:16 이 박혀 이후 역할 변경에 영영 안 따라온다).
 *   ★스와치는 «진실»(지금 무슨 색인가)을, hex 칸은 «누가 정했나»를 말한다 — 층이 다르다.
 *
 * ★실패 판정식(계획서 §4-B): `칸.value || 칸.placeholder` 가 빈 문자열이면 실패.
 *   회색 22 는 「빈 채로 떴다」가 아니다. D1-b 가 이 식을 그대로 단언한다. */
function _grdTypoSectionsHtml(hit, block) {
  if (!hit) {
    return `
    <div class="prop-section">
      <div class="prop-section-title">Typography</div>
      <div class="prop-hint">캔버스에서 «글자 줄을 클릭»하면 그 줄의 Typography·Fill 이 여기 뜬다.</div>
    </div>`;
  }
  const { line } = hit;
  const role = _grdRoleOf(line);
  const size = Number(line.fontSize) || role.size;
  const weight = String(line.weight ?? role.weight);
  const roleLsPx = _grdRoleLsPx(role, size);

  const colorRaw = (_grdHas(line, 'color') && GRID_COLOR_RE.test(String(line.color).trim()))
    ? String(line.color).trim() : '';
  const swatch = colorRaw ? swatchHex(colorRaw, role.color) : role.color;

  return `
    ${buildTypographySectionHtml({
      p: 'grd-typo',
      font: _grdHas(line, 'fontFamily') ? String(line.fontFamily) : '',
      weight,
      size: _grdHas(line, 'fontSize') ? size : '',
      sizePh: String(role.size),
      isBold: Number(weight) >= 700,
      isItalic: line.italic === '1',
      isStrike: line.strike === '1',
      lh: _grdHas(line, 'lineHeight') ? Number(line.lineHeight) : '',
      lhPh: String(role.lh),
      ls: _grdHas(line, 'letterSpacing') ? Number(line.letterSpacing) : '',
      lsPh: String(roleLsPx),
      /* ★그리드 h1 은 64px 다 — 모달의 10~60 을 그대로 쓰면 «기본값이 상한 밖»이 된다. */
      sizeMin: 8, sizeMax: 800,
      /* ⛔showHighlight:false — 「빠뜨린 것」이 아니다. 그리드 줄에서 «글자 배경»은 line.bg 이고,
         line.bg 가 있으면 렌더러가 «뱃지» 분기(grid-block.js 의 `if (bg)`)로 갈아탄다 —
         inline-block + padding + border-radius:999px, 즉 형광펜이 «알약»이 된다.
         형광펜을 원하면 line.bg 를 넓히는 별건 발주다. 다음 사람이 「빠졌네」 하고
         true 로 되돌리면 tests/unit/grid-line-typo.test.js U1-c 가 빨강을 낸다. */
      showHighlight: false,
    })}
    ${buildFillSectionHtml({
      p: 'grd-typo',
      colorHex: swatch,                                    // 스와치·피커 = «진실»
      alpha: colorRaw ? parseAlphaFromColor(colorRaw) : 100,
      colorHexVal: colorRaw ? swatch.replace('#', '').toUpperCase() : '',   // «누가 정했나»
      colorHexPh: String(role.color).replace('#', '').toUpperCase(),
    })}`;
}

/* ══ Typography·Fill 배선 ══════════════════════════════════════════════════
 * ★어휘는 prop-modal(setDs/commit), «기법»은 prop-grid.
 *   ⛔prop-modal 의 commit 은 슬라이더 change 에서 pushHistory 를 «나중»에 부른다.
 *     뒤에 부르면 스냅샷이 «이미 바뀐 상태»라 undo 가 두 단계를 한꺼번에 되돌린다 —
 *     이 레포엔 moveSection 에 그 버그가 실재한다. ⇒ 제스처의 «첫 적용 전»에 1회.
 * ★진실은 dataset 이다(모달 계보). ⛔DOM 인라인 스타일에 쓰지 마라 — renderGridBlock 이
 *   innerHTML 을 통째로 새로 만들어 «첫 측정을 통과하고 조용히 죽는다»(D1-c 가 2차 측정을 한다). */
function _grdWireTypo(block, addr) {
  let _gesture = false;
  const begin = () => { if (_gesture) return; _gesture = true; window.pushHistory?.(); };   // ★적용 «전»
  const end   = () => { _gesture = false; window.scheduleAutoSave?.(); };

  /* 줄 하나에 필드를 얹는다 — 되쓰기는 grid-block.js 의 gridPreviewLine «한 곳»이고,
     그것은 updateGridBlock 과 «같은» _gridMergeLine/_gridCellPatchDataset 을 쓴다.
     ⛔updateGridBlock 을 직접 부르지 않는 이유: 그건 스스로 pushHistory 를 쌓고 패널을 통째로
       다시 그린다 — 색 피커를 드래그하는 동안 그러면 히스토리가 폭주하고 포커스가 끊긴다. */
  const setLine = (fields) => {
    gridPreviewLine(block, addr.r, addr.c, addr.li, fields);
    _grdSyncLineMark(block, addr);       // 재렌더가 마커를 지웠다 — 다시 붙인다
    _grdRefreshSummary(block, addr);
  };
  const commit = (fields) => { begin(); setLine(fields); end(); };

  // ── 폰트 — 위젯은 «한 벌»(_font-picker.js). 우리는 «적용»만 준다(prop-modal :264 선례).
  wireFontPicker({
    root: propPanel, p: 'grd-typo',
    getCurrent: () => _grdLine(block, addr)?.fontFamily || '',
    onPick: (rawVal) => commit({ fontFamily: rawVal || undefined }),
  });

  // ── 굵기 select — 명시값이 없으면 «역할 기본값» option 이 선택돼 있다(select 엔 placeholder 가 없다).
  const wSel = document.getElementById('grd-typo-font-weight');
  if (wSel && !_grdHas(_grdLine(block, addr) || {}, 'weight')) wSel.title = '역할 기본값';
  wSel?.addEventListener('change', () => commit({ weight: wSel.value }));

  /* ── 숫자 칸 — change(blur·Enter)에서만 커밋한다(비율·행높이 입력과 동일 원칙).
       ★비우면 undefined 를 써서 «역할 기본»으로 되돌린다 — 회색 placeholder 가 다시 뜬다. */
  const numWire = (id, field, min, max, parse) => {
    const el = document.getElementById(id);
    el?.addEventListener('change', () => {
      const raw = String(el.value).trim();
      if (raw === '') { commit({ [field]: undefined }); el.value = ''; return; }
      const x = Math.min(max, Math.max(min, parse(raw)));
      el.value = x;
      commit({ [field]: x });
    });
  };
  numWire('grd-typo-size-number', 'fontSize', 8, 800, v => parseInt(v, 10) || 0);
  numWire('grd-typo-lh-number', 'lineHeight', 1, 3, v => parseFloat(v) || 1);
  numWire('grd-typo-ls-number', 'letterSpacing', -10, 40, v => parseFloat(v) || 0);

  /* ── B / I / S — H 는 «없다»(showHighlight:false, 위 주석 참조).
       B 는 별개다: 그리드 줄엔 bold 플래그가 없고 weight 가 진실이다 ⇒ 700 ↔ 400 토글. */
  const boldBtn = document.getElementById('grd-typo-bold-btn');
  boldBtn?.addEventListener('click', () => {
    const line = _grdLine(block, addr) || {};
    const next = Number(line.weight ?? _grdRoleOf(line).weight) >= 700 ? 400 : 700;
    boldBtn.classList.toggle('active', next >= 700);
    if (wSel) wSel.value = String(next);
    commit({ weight: next });
  });
  for (const [id, key] of [['grd-typo-italic-btn', 'italic'], ['grd-typo-strike-btn', 'strike']]) {
    const btn = document.getElementById(id);
    btn?.addEventListener('click', () => {
      const on = (_grdLine(block, addr) || {})[key] === '1';
      btn.classList.toggle('active', !on);
      commit({ [key]: on ? undefined : '1' });
    });
  }

  /* ── 글자색 (Fill 절) ──
     ⛔wireColorField 를 못 쓴다 — 그건 `<prefix>-hex` 를 보는데 이 절의 id 는 텍스트·모달과
       «같은» `<prefix>-color-hex` 다. 절을 공유한 대가로 배선은 여기서 짠다(prop-modal 과 같은 처지). */
  const cPick   = document.getElementById('grd-typo-color');
  const cHex    = document.getElementById('grd-typo-color-hex');
  const cAlpha  = document.getElementById('grd-typo-color-alpha');
  const cSwatch = cPick?.closest('.prop-color-swatch');
  const raw0 = String((_grdLine(block, addr) || {}).color || '');
  // 스와치 «배경»만은 raw 로 — var() 바인딩이면 변수의 실제 색이 보여야 한다.
  if (cSwatch && raw0) cSwatch.style.background = raw0;
  let _alpha = raw0 ? parseAlphaFromColor(raw0) : 100;
  const buildColor = () => {
    const h = (cPick?.value || '#000000').replace('#', '');
    const r = parseInt(h.slice(0, 2), 16), g = parseInt(h.slice(2, 4), 16), b = parseInt(h.slice(4, 6), 16);
    const a = Math.max(0, Math.min(1, _alpha / 100));
    return a >= 1 ? (cPick?.value || '#000000') : `rgba(${r},${g},${b},${a})`;
  };
  const applyColor = () => {
    const cc = buildColor();
    if (cSwatch) cSwatch.style.background = cc;
    begin();                       // ★연속 input 의 «첫» 한 번만 히스토리를 찍는다
    setLine({ color: cc });
  };
  cPick?.addEventListener('input', () => {
    // alpha 0 이면 색을 바꿔도 안 보인다 — 사용자가 alpha 를 안 건드렸으면 되살린다.
    if (_alpha === 0) { _alpha = 100; if (cAlpha) cAlpha.value = '100'; }
    if (cHex) cHex.value = cPick.value.replace('#', '').toUpperCase();
    applyColor();
  });
  cPick?.addEventListener('change', end);
  cHex?.addEventListener('input', () => {
    const v = cHex.value.trim().replace(/^#/, '');
    if (!/^[0-9a-f]{6}$/i.test(v)) return;
    if (cPick) cPick.value = '#' + v.toLowerCase();
    if (_alpha === 0) { _alpha = 100; if (cAlpha) cAlpha.value = '100'; }
    applyColor();
  });
  cHex?.addEventListener('change', end);
  cAlpha?.addEventListener('change', () => {
    _alpha = Math.min(100, Math.max(0, parseInt(cAlpha.value, 10) || 0));
    cAlpha.value = String(_alpha);
    applyColor(); end();
  });

  /* 컬러 변수 칩 — 정적 hex 복사가 아니라 var(--color-<name>, #hex) «바인딩»이다.
     ★_GRID_COLOR_RE 를 var() 까지 넓혔다 — 안 그러면 칩이 「눌리는데 안 먹는」 상태가 된다
       (modal-block.js 가 2026-09-08 같은 것에 물렸다). tests/unit/grid-color-re.test.mjs 가 지킨다. */
  const chipBox = document.getElementById('grd-typo-color-chips');
  if (chipBox) {
    wireColorVarChips({
      container: chipBox,
      getActiveName: () => parseColorVarName((_grdLine(block, addr) || {}).color || ''),
      getFallbackHex: (name, hex) => hex,
      onPick: (cssRef) => {
        commit({ color: cssRef });
        const fb = (String(cssRef).match(/#[0-9a-fA-F]{6}/) || [])[0];
        if (fb && cPick) { cPick.value = fb; if (cHex) cHex.value = fb.replace('#', '').toUpperCase(); }
        _alpha = 100; if (cAlpha) cAlpha.value = '100';
        if (cSwatch) cSwatch.style.background = cssRef;
      },
    });
  }

  /* ── [+ 줄 추가]/[줄 삭제]/[↺ 기본값으로] — «줄바»로 분리됐다(2026-09-16, _grdWireLineBar).
       이미지·갭 줄도 줄바가 뜨므로 여기(텍스트 줄 전용 배선)에 두면 두 벌이 된다. */
}

/** 요약 한 줄의 «직접 지정 N» 만 제자리에서 고친다 — 패널을 다시 그리지 않는다(포커스 보존). */
function _grdRefreshSummary(block, addr) {
  const el = document.getElementById('grd-line-summary');
  const line = _grdLine(block, addr);
  if (!el || !line) return;
  const n = _GRD_TYPO_FIELDS.filter(k => _grdHas(line, k)).length;
  el.textContent = `${addr.r + 1}행 ${addr.c + 1}열 · ${addr.li + 1}번째 줄 (${line.type || 'body'}) — `
    + `직접 지정 ${n} · 역할 기본 ${_GRD_TYPO_FIELDS.length - n}`;
}

/**
 * @param {HTMLElement} block
 * @param {{r:number,c:number,li:number}|null} [addrArg] 선택된 «줄» 주소.
 *   ⛔반드시 «선택적»이어야 한다 — tools/duo-align-probe/run.cjs 가 4곳에서 1-인자로 부르고,
 *     updateGridBlock 도 1-인자로 되부른다. 안 주면 «기억하고 있던» 줄을 그대로 쓴다.
 *   null 을 «명시»하면 선택 해제다(undefined 와 다르다).
 */
export function showGridProperties(block, addrArg) {
  /* ★_grdResolveAnyAddr — 어떤 줄(글자/이미지/갭)이든, «빈 셀»(li:null)까지 받는다.
   *   _curAddr(=기억할 주소)·줄바는 이 «넓은» 판정을 쓴다.
   *   Typography/Fill 절(_hit)만 «좁은» _grdResolveAddr(글자 줄 전용)을 그대로 쓴다 —
   *   D1-b 가 그 판정식을 직접 단언하므로 한 글자도 안 바꾼다. */
  const _addrIn = addrArg === undefined ? grdGetActiveLine(block) : addrArg;
  const _anyHit = _grdResolveAnyAddr(block, _addrIn);
  const _curAddr = _anyHit ? { r: _anyHit.r, c: _anyHit.c, li: _anyHit.li } : null;
  const _hit = _grdResolveAddr(block, _curAddr);
  grdSetActiveLine(block, _curAddr);
  let cols = [];
  try { cols = JSON.parse(block.dataset.cols || '[]'); } catch (_) {}
  const rows = gridRows(block);   // 없으면(옛 파일) [{height:'auto'}] 1행 — grid-block.js 승격 로직과 공유
  /* ★2026-09-05 현빈 지시로 「간격」(양축 동시) 슬라이더를 패널에서 걷어냈다 — «그» 편의 슬라이더는
   * 재도입하지 않는다. 2026-09-16(T-D) 부터는 열 간격/행 간격을 «따로» 조작하는 슬라이더 2개가 있다
   * (아래 _gapRowHtml). ⛔데이터와 렌더러는 그대로다 — `block.dataset.gap` 은 레거시 기준값 겸
   * 단축값으로 계속 산다(옛 프로젝트 호환), rowGap/colGap 없는 블록은 이 값으로 폴백한다. */
  const { row: _rowGap, col: _colGap } = gridGaps(block);
  const valign = block.dataset.valign || 'top';
  // 가로 정렬은 컬럼 모델(col.align)에 산다. 컬럼마다 다르면(혼합) 어느 버튼도 active 로 켜지 않는다.
  const _aligns = cols.map(c => c.align || 'left');
  const halign = (_aligns.length && _aligns.every(a => a === _aligns[0])) ? _aligns[0] : '';

  propPanel.innerHTML = `
    <div class="prop-section">
      <div class="prop-block-label">
        <div class="prop-block-icon">
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="#888" stroke-width="1.3">
            <rect x="1" y="2" width="4.5" height="8" rx="1"/><rect x="6.5" y="2" width="4.5" height="8" rx="1"/>
          </svg>
        </div>
        <div class="prop-block-info">
          <span class="prop-block-name">${block.dataset.layerName || 'Grid Block'}</span>
          <span class="prop-breadcrumb">${window.getBlockBreadcrumb ? window.getBlockBreadcrumb(block) : ''}</span>
        </div>
        ${block.id ? `<span class="prop-block-id" title="클릭하여 복사" onclick="_copyToClipboard('${block.id}')">${block.id}</span>` : ''}
      </div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Grid (${cols.length}×${rows.length})</div>
      <div class="grid-picker" id="grd-grid-picker"></div>
      <div class="grid-picker-label" id="grd-grid-picker-label">—</div>
      <div class="prop-hint" style="margin-top:2px;">가로×세로 칸 수를 고른다</div>
      <!-- ★적대검수 Q3: 「줄이면 보존」으로 동작을 바꾸는 대신 «사실을 적는다».
           API 경로(grid-block.js)가 이미 «자르고 undo» 정책이라, 피커만 보존하면 정책이 둘로 갈라진다. -->
      <div class="prop-hint" style="margin-top:2px;">줄이면 잘린 칸 내용은 사라진다 (⌘Z 복원)</div>
    </div>
    <div class="prop-section">
      <div class="prop-section-title">Layout</div>
      ${_ratioRowHtml(cols)}
      ${_rowHeightHtml(rows)}
      ${_gapRowHtml(cols, rows, _colGap, _rowGap)}
      <div class="prop-row">
        <span class="prop-label">가로 정렬</span>
        <div class="prop-align-group" id="grd-halign-group">
          ${alignBtn('object-h', 'left', { label: '왼쪽 정렬', title: '왼쪽 정렬', active: halign === 'left', attrs: { 'data-ha': 'left' } })}
          ${alignBtn('object-h', 'center', { label: '가운데 정렬 (수평)', title: '가운데 정렬 (수평)', active: halign === 'center', attrs: { 'data-ha': 'center' } })}
          ${alignBtn('object-h', 'right', { label: '오른쪽 정렬', title: '오른쪽 정렬', active: halign === 'right', attrs: { 'data-ha': 'right' } })}
        </div>
      </div>
      <div class="prop-row">
        <span class="prop-label">세로 정렬</span>
        <div class="prop-align-group" id="grd-valign-group">
          ${alignBtn('object-v', 'top', { label: '위쪽 정렬', title: '위쪽 정렬', active: valign === 'top', attrs: { 'data-va': 'top' } })}
          ${alignBtn('object-v', 'middle', { label: '가운데 정렬 (수직)', title: '가운데 정렬 (수직)', active: valign === 'middle', attrs: { 'data-va': 'middle' } })}
          ${alignBtn('object-v', 'bottom', { label: '아래쪽 정렬', title: '아래쪽 정렬', active: valign === 'bottom', attrs: { 'data-va': 'bottom' } })}
        </div>
      </div>
      <div class="prop-hint" style="margin-top:2px;">세로 정렬은 컬럼 높이가 서로 다를 때만 움직인다</div>
    </div>
    ${_grdLineBarHtml(_anyHit, block)}
    ${_grdImageSectionHtml(_anyHit, block)}
    ${_grdTypoSectionsHtml(_hit, block)}
    <div class="prop-section">
      <div class="prop-row"><span class="prop-label" style="opacity:.6">글자는 «캔버스에서 줄을 더블클릭»해 고친다</span></div>
    </div>`;

  if (window.setRpIdBadge) window.setRpIdBadge(block.id || null);

  /* ── 비율 배선 — «change» 시점에만 커밋(blur/Enter) ── */
  /* ⚠️updateGridBlock 을 매 입력마다 부르지 않는다 — 성공하면 showGridProperties 를 다시 불러
   *   패널을 통째로 새로 그린다. 입력 중(각 keystroke)에 재호출하면 포커스가 든 input DOM 이
   *   교체돼 타이핑이 끊긴다. (전에 있던 gap 슬라이더도 같은 이유로 dataset 직접 쓰기를 택했었다 —
   *   그 슬라이더는 2026-09-05 에 제거됐다.) 여기서도 «change»(blur/Enter) 시점에만 dataset 을
   *   커밋하고 패널은 다시 그리지 않는다.
   *   (검증은 여기서 한다 — 컬럼 2~4개, width 는 양수) */
  const _commitCols = (next) => {
    /* ★상한은 grid-block.js 의 클램프와 «같은 값»이어야 한다 — MIN_COLS/MAX_COLS 상수를 import 해서
     * «같은 값»을 강제한다(하드코딩 2건 반복 금지). P0 에서 grid-block.js 세 자리(렌더/생성/검증)를
     * 4로 올리면서 «여기 하나»를 놓쳐 4열 그리드 비율 입력이 조용히 무시됐던 사고(2026-09-04
     * fix(grid-p0) 1abfea2)가 있었다 — 이 레포의 고질(열거 자리가 흩어져 있어 한 곳만 고치면
     * «절반만» 고쳐진다)이라 P1에서 아예 상수 import 로 재발을 막는다. */
    if (!Array.isArray(next) || next.length < MIN_COLS || next.length > MAX_COLS) return false;
    next.forEach(c => { const n = Number(c.width); c.width = Number.isFinite(n) && n > 0 ? n : 1; });
    block.dataset.cols = JSON.stringify(next);
    window.renderGridBlock?.(block);
    return true;
  };
  /* ── 4×4 그리드 피커 — 가로×세로 칸 수 변경 (현빈 발주 ①) ─────────────────
   * ★2026-09-04 P1: maxRows 해제 — 이제 진짜 4×4(행 축이 생겼다).
   * 줄일 때 잘린 칸/행의 내용은 pushHistory 로 undo 복원(패널 힌트에도 적어뒀다).
   *
   * ⚠️2026-09-05 정정: 여기 「카드블럭과 «같은» UI 를 쓴다(공용 buildGridPicker)」라고 적혀
   *   있었는데 «거짓» 이었다(적대검수). `_helpers.js` 의 buildGridPicker 를 부르는 곳은
   *   이 파일 «하나» 뿐이고, 카드·월계수·캔버스(prop-simple-card.js · prop-laurel.js ·
   *   prop-canvas.js)는 피커를 통째로 복붙해 각자 갖고 있다.
   *   ⇒ 여기 고친 것이 그쪽에 «안 간다». 피커 동작을 바꿀 땐 그 세 곳을 따로 봐야 한다.
   *   (공용화는 별건 — 지금 묶으면 세 블록의 UX 를 동시에 바꾸는 셈이라 발주가 필요하다.) */
  buildGridPicker(
    document.getElementById('grd-grid-picker'),
    document.getElementById('grd-grid-picker-label'),
    (nCols, nRows) => {
      const curCols = JSON.parse(block.dataset.cols || '[]');
      const curRows = gridRows(block);
      if (nCols === curCols.length && nRows === curRows.length) return;
      window.pushHistory?.();                     // ★변경 «전»에

      const nextCols = [];
      for (let i = 0; i < nCols; i++) {
        /* ★[M41] 열을 늘릴 때의 기본값도 «정본 한 줄»을 쓴다 — 여긴 h2:'제목' 을 얹고 있어서
         * 블록 생성(grid-block.js)·열 추가(여기)·행 추가(아래)가 서로 «다른» 기본값이었다. */
        nextCols.push(curCols[i] || { width: 1, lines: [{ type: 'body', text: GRID_CELL_DEFAULT_TEXT }] });
      }
      // ⛔줄일 때 잘린 칸의 내용은 «버려진다» — undo 로 되돌아온다(pushHistory 를 먼저 부른 이유).
      block.dataset.cols = JSON.stringify(nextCols);

      if (nRows <= 1) {
        // 1행으로 돌아가면 옛 duo 파일과 «완전히 같은» 모양으로 되돌린다(dataset.rows/cells 제거).
        delete block.dataset.rows;
        delete block.dataset.cells;
      } else {
        const nextRows = [];
        for (let i = 0; i < nRows; i++) nextRows.push(curRows[i] || { height: 'auto' });
        block.dataset.rows = JSON.stringify(nextRows);

        /* ★새로 생긴 행에 «기본 내용»을 넣는다.
         * 안 넣으면 셀이 빈 채로 높이 0 이 되어, 2x2 를 눌러도 «아무 일도 안 일어난 것»처럼 보인다
         * (실측: rows=2 이고 grd-cell 4개가 생겼는데 2행 두 칸 높이가 0px).
         * 1행이 기본 텍스트를 갖는 것과 «같은 대우»여야 사용자가 무엇이 생겼는지 안다.
         * ⚠️정정(적대검수 지적, 2026-09-04): 이 코드는 «옛 내용을 보존하지 않는다».
         *   nextCells 를 새로 만들어 덮으므로 «잘린 행/열의 내용은 사라진다».
         *   내가 앞서 커밋 메시지에 「줄였다 늘려도 옛 내용이 살아 있다」고 썼는데 «거짓»이었다 —
         *   P1 의 「cells 를 그대로 둔다」 설계를 병합에서 모르고 뒤집었다.
         *   복원은 undo 로만 된다(그래서 pushHistory 를 변경 전에 부른다). */
        let curCells = [];
        try { curCells = JSON.parse(block.dataset.cells || '[]'); } catch (_) { curCells = []; }
        const nextCells = [];
        for (let r = 1; r < nRows; r++) {          // index 0 = 1행은 cols[].lines 가 갖는다
          const row = Array.isArray(curCells[r - 1]) ? curCells[r - 1] : [];
          const outRow = [];
          for (let c = 0; c < nCols; c++) {
            outRow.push(row[c] || { lines: [{ type: 'body', text: GRID_CELL_DEFAULT_TEXT }] });
          }
          nextCells.push(outRow);
        }
        if (nextCells.length) block.dataset.cells = JSON.stringify(nextCells);
        else delete block.dataset.cells;
      }
      window.renderGridBlock?.(block);
      window.scheduleAutoSave?.();
      /* ★거터를 «명시적으로» 걷고 다시 세운다.
       * showGridProperties 끝에도 showGridGutters 가 있지만 피커 경로에서는 그것만으로 안 따라온다 —
       * 실측: 2x1 → 3x3 으로 바꿔도 거터가 col 1개 그대로였다(2초 뒤에도).
       * 격자 «수»가 바뀌는 건 이 경로뿐이라 여기서 한 번 정리한다. */
      hideGridGutters();
      /* ★자기재귀 — 현재 «줄 주소»를 같이 넘긴다. 안 넘기면 조작마다 선택이 첫 줄로 튄다
         (손으로 눌러 보기 전엔 안 보이는 자리 — tests/dom/grid-typo.dom.spec.js D5 가 검사). */
      showGridProperties(block, _curAddr);
      showGridGutters(block);                   // 패널 재생성(칸/행 수가 바뀌면 섹션도 바뀐다)
    },
    { max: MAX_COLS, maxRows: MAX_ROWS, minCols: MIN_COLS, minRows: MIN_ROWS }
  );

  const ratioInput = document.getElementById('grd-col-ratio');
  const _applyRatioInput = (raw) => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    if (!cur.length) return;
    const parts = parseRatio(raw, cur.length);   // prop-table.js 와 공유 — 부족 1 패딩·초과 자름
    parts.forEach((w, i) => { if (cur[i]) cur[i].width = w; });
    _commitCols(cur);
    if (ratioInput) ratioInput.value = parts.join(':');   // 정규화 결과로 되씀(테이블과 동일 패턴)
  };
  ratioInput?.addEventListener('change', e => {
    /* ★pushHistory 는 변경 «전»에. 뒤에 부르면 스냅샷이 «이미 바뀐 상태»라
     * 피커→비율 순서에서 undo 가 두 단계를 한꺼번에 되돌린다(적대검수 지적).
     * 이 레포엔 moveSection 에 같은 버그가 실재한다 — 새 코드에서 복제하지 않는다. */
    window.pushHistory?.();
    _applyRatioInput(e.target.value);
    window.scheduleAutoSave?.();
  });
  document.getElementById('grd-col-ratio-reset')?.addEventListener('click', () => {
    const cur = JSON.parse(block.dataset.cols || '[]');
    const equal = Array(cur.length).fill(1).join(':');
    window.pushHistory?.();                     // ★변경 «전»에(위와 같은 이유)
    _applyRatioInput(equal);
    window.scheduleAutoSave?.();
  });

  /* ── 열 간격 / 행 간격 슬라이더 — 공용 bindSlider(_helpers.js) 재사용(prop-frame.js:512 선례).
   * ⛔showGridProperties 를 재호출하지 않는다 — 그러면 매 드래그 프레임마다 패널을 통째로
   *   다시 그려 포커스가 든 input 이 교체되고 타이핑/드래그가 끊긴다(색 피커·비율 입력과 같은 함정).
   * ★dataset.gap(레거시 균일값)은 여기서 손대지 않는다 — 패널 슬라이더 조작은 rowGap/colGap 만
   *   갱신한다(현빈 확정 정책: API 의 gap 호출만 양축 동시 갱신, 패널은 축별). */
  const colGapSlider = document.getElementById('grd-col-gap-slider');
  const colGapNumber = document.getElementById('grd-col-gap-number');
  if (colGapSlider && colGapNumber) {
    bindSlider(colGapSlider, colGapNumber, (v) => {
      block.dataset.colGap = String(v);
      window.renderGridBlock?.(block);
      window._grdSyncLineMark?.(block, grdGetActiveLine(block));
    }, { min: 0, max: GRID_GAP_MAX });
  }
  const rowGapSlider = document.getElementById('grd-row-gap-slider');
  const rowGapNumber = document.getElementById('grd-row-gap-number');
  if (rowGapSlider && rowGapNumber) {
    bindSlider(rowGapSlider, rowGapNumber, (v) => {
      block.dataset.rowGap = String(v);
      window.renderGridBlock?.(block);
      window._grdSyncLineMark?.(block, grdGetActiveLine(block));
    }, { min: 0, max: GRID_GAP_MAX });
  }

  propPanel.querySelectorAll('[data-va]').forEach(btn => btn.addEventListener('click', () => {
    block.dataset.valign = btn.dataset.va;
    window.renderGridBlock?.(block);
    window.pushHistory?.(); window.scheduleAutoSave?.();
    showGridProperties(block, _curAddr);        // ★줄 선택 유지 (D5)
  }));

  // 가로 정렬 — 컬럼 단위(col.align)로 일괄 적용.
  // ★라인의 line.align 은 렌더러에서 col.align 을 «가린다»(_gridLineHtml: line.align || colAlign).
  //   실제 저장본 실측(147줄 중 17줄)에서 그 라인들만 안 움직여 «절반만 먹는» 정렬이 된다 →
  //   컬럼 레벨 일괄 지시일 때는 라인 오버라이드를 걷어내 컬럼을 단일 진실원으로 만든다(undo 가능).
  propPanel.querySelectorAll('[data-ha]').forEach(btn => btn.addEventListener('click', () => {
    try {
      const c = JSON.parse(block.dataset.cols || '[]');
      if (!Array.isArray(c) || !c.length) return;
      c.forEach(col => {
        col.align = btn.dataset.ha;
        if (Array.isArray(col.lines)) col.lines.forEach(l => { if (l && typeof l === 'object') delete l.align; });
      });
      block.dataset.cols = JSON.stringify(c);
      window.renderGridBlock?.(block);
      window.pushHistory?.(); window.scheduleAutoSave?.();
      showGridProperties(block, _curAddr);      // ★줄 선택 유지 (D5)
    } catch (_) {}
  }));

  /* ── 행 높이 — change(blur/Enter)에서만 커밋(비율 입력과 동일 원칙) ──────── */
  propPanel.querySelectorAll('.grd-row-h-item').forEach(inp => {
    inp.addEventListener('change', () => {
      const ri = parseInt(inp.dataset.ri);
      const curRows = gridRows(block);
      if (!curRows[ri]) return;
      const raw = inp.value.trim();
      const v = raw === '' ? 'auto' : Math.max(0, Math.min(ROW_H_MAX, parseInt(raw) || 0));
      curRows[ri] = { height: v };
      window.pushHistory?.();
      block.dataset.rows = JSON.stringify(curRows);
      window.renderGridBlock?.(block);
      window.scheduleAutoSave?.();
      inp.value = v === 'auto' ? '' : v;   // 정규화 결과로 되씀(비율 입력과 동일 패턴)
    });
  });

  // ★2026-09-04 P2: 캔버스 셀 경계 드래그 거터(overlay-handles.js) — 패널이 뜨는 자리마다
  //   같이 띄운다(클릭 선택·레이어패널 선택·updateGridBlock 후 재선택 모두 이 함수를 거친다,
  //   PLAN-gridblock.md §5). 해제는 editor.js deselectAll()의 hideGridGutters 로 일괄.
  _grdWireLineBar(block, _curAddr);
  _grdWireImageSection(block, _curAddr);
  if (_hit) _grdWireTypo(block, _curAddr);

  showGridGutters(block);
  // ★이미지 줄 코너 리사이즈 핸들(T-C) — 「지금 선택된 이미지 줄」에만 뜬다. 다른 줄이면
  //   내부에서 스스로 hideGridImageResizeHandle() 로 정리한다(showHandlesFor 맵에 없는 이유는
  //   블록 전체가 아니라 «줄 주소» 단위 상태라 그리드 전용 경로에서만 결정할 수 있어서다).
  window.showGridImageResizeHandle?.(block);
  /* ★마커는 «맨 끝»에 다시 붙인다 — 이 함수가 불리는 모든 경로(클릭·레이어패널·MCP·
     updateGridBlock 후 재표시)에서 재렌더가 innerHTML 을 갈아끼웠을 수 있다(bn2 :22~26 과 동형). */
  _grdSyncLineMark(block, _curAddr);
}

window.showGridProperties = showGridProperties;
// ★deprecated 별칭 — 2026-09-05 개명 이전 이름(tools/duo-align-probe·외부 CDP 스크립트 호환).
//   제거는 P1. grid-block.js 의 window.*Duo* 별칭 4개와 동반한다.
window.showDuoProperties = showGridProperties;
