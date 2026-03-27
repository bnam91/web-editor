/* ── planning.js — 아웃라인 편집기 로직 ── */

// ── 볼륨 레벨별 블록 정의 ──────────────────────────────────────────────
const BLOCK_DEFS = [
  // section, role, layout, minVolume(0=outline,1=develop1,2=develop2,3=develop3), hint
  { section: 'HOOK', role: 'hook',                layout: 'gif',          vol: 0, hint: '동적 GIF — 후킹 메시지 (Pattern Interrupt)' },
  { section: 'HEAD', role: 'delivery',            layout: 'text_image',   vol: 0, hint: '배송 보장 (즉각적 안심)' },
  { section: 'HEAD', role: 'banner',              layout: 'text_image',   vol: 0, hint: 'AS보증/환불/반품 띠배너 (리스크 제거)' },
  { section: 'HEAD', role: 'event',               layout: 'text_image',   vol: 1, hint: '사은품/혜택 (구매 욕구 자극)' },
  { section: 'HEAD', role: 'social_proof',        layout: 'text_image',   vol: 1, hint: '리뷰 수/별점 (수치 신뢰)' },
  { section: 'HEAD', role: 'review',              layout: 'text_image',   vol: 1, hint: '실제 구매자 후기 (공감 유도)' },
  { section: 'HEAD', role: 'award',               layout: 'text_image',   vol: 2, hint: '수상/공식 인증 (권위 부여)' },
  { section: 'HEAD', role: 'press',               layout: 'text_image',   vol: 2, hint: '언론 보도 (사회적 증거)' },
  { section: 'HEAD', role: 'sales',               layout: 'text_image',   vol: 2, hint: '누적 판매량 (대중성 증명)' },
  { section: 'HEAD', role: 'authenticity',        layout: 'text_image',   vol: 2, hint: '정품 단독 판매 (브랜드 신뢰)' },
  { section: 'HERO', role: 'hero',                layout: 'text_image',   vol: 0, hint: '핵심 비포→애프터 (Transformation Promise)' },
  { section: 'HERO', role: 'brand_hook',          layout: 'text_image',   vol: 1, hint: '브랜드 전환 선언 (Liking)' },
  { section: 'HERO', role: 'hero_2',              layout: 'text_image',   vol: 1, hint: '브랜드 스토리 (Parasocial)' },
  { section: 'HERO', role: 'effort_stats',        layout: 'text_image',   vol: 2, hint: '개발 노력 수치 (Effort Heuristic)' },
  { section: 'BODY', role: 'testimonial',         layout: 'text_grid',    vol: 2, hint: '구매자 증언 선제 (Social Proof)' },
  { section: 'BODY', role: 'problem',             layout: 'text_image',   vol: 0, hint: '불만 리뷰 기반 문제 제시 (Loss Aversion)' },
  { section: 'BODY', role: 'problem_empathy',     layout: 'text_image',   vol: 1, hint: '"같은 고민 중이셨죠?" (Mirror Neurons)' },
  { section: 'BODY', role: 'psychology',          layout: 'text_image',   vol: 0, hint: '"안 사셔도 됩니다" (Psychological Reactance)' },
  { section: 'BODY', role: 'psychology_2',        layout: 'text_image',   vol: 2, hint: '저항 제거 2번째 (Curiosity Gap)' },
  { section: 'BODY', role: 'psychology_reason',   layout: 'text_image',   vol: 2, hint: '소비자가 모르는 사실 (Information Privilege)' },
  { section: 'BODY', role: 'effort',              layout: 'text_image',   vol: 0, hint: '짧고 강한 해결 선언' },
  { section: 'BODY', role: 'solution',            layout: 'text_image',   vol: 0, hint: '솔루션 + GIF 공개 (카타르시스)' },
  { section: 'BODY', role: 'solution_2',          layout: 'gif',          vol: 2, hint: '솔루션 2번째 시연' },
  { section: 'BODY', role: 'reason_toc',          layout: 'text_image',   vol: 3, hint: '이유 목차 (ELM)' },
  { section: 'BODY', role: 'reason01',            layout: 'text_image',   vol: 0, hint: '이유 01 — 유형 A(사실형) 권장' },
  { section: 'BODY', role: 'reason02',            layout: 'text_image',   vol: 2, hint: '이유 02 — 유형 B(질문형) 권장' },
  { section: 'BODY', role: 'reason03',            layout: 'text_image',   vol: 2, hint: '이유 03 — 유형 C(스토리형) 권장' },
  { section: 'BODY', role: 'reason04',            layout: 'text_image',   vol: 3, hint: '이유 04 — 유형 D(복합형) 권장' },
  { section: 'BODY', role: 'reason05',            layout: 'text_image',   vol: 3, hint: '이유 05 — 유형 E(기능나열형) 권장' },
  { section: 'BODY', role: 'closing_criteria',    layout: 'text_table',   vol: 0, hint: '선택 기준 (Decision Simplification)' },
  { section: 'BODY', role: 'closing_comparison',  layout: 'text_table',   vol: 0, hint: '경쟁사 비교표 (Comparison Framing)' },
  { section: 'BODY', role: 'closing_spec',        layout: 'text_image',   vol: 1, hint: '제품 스펙' },
  { section: 'BODY', role: 'closing_notice',      layout: 'text_image',   vol: 1, hint: '안내사항' },
  { section: 'BODY', role: 'closing',             layout: 'text_image',   vol: 1, hint: '맺음말 (Scarcity/Urgency)' },
];

const VOLUME_LEVELS = ['outline', 'develop1', 'develop2', 'develop3'];
const VOLUME_LABELS = { outline: '뼈대', develop1: '기본', develop2: '중간', develop3: '풀버전' };
const LAYOUT_OPTIONS = ['gif', 'text_image', 'image_text', 'text_table', 'text_grid', 'video_overlay'];

// ── State ─────────────────────────────────────────────────────────────
let state = {
  product_name: '',
  brand_name: '',
  volume: 'develop2',
  positioning: '',
  swot: { strengths: '', weaknesses: '', opportunities: '', threats: '' },
  blocks: [],   // [{...def, enabled, layout (overridable)}]
  selectedIdx: null,
};

function blocksForVolume(vol) {
  const idx = VOLUME_LEVELS.indexOf(vol);
  if (idx < 0) return []; // 알 수 없는 볼륨값 방어
  return BLOCK_DEFS
    .filter(d => d.vol <= idx)
    .map(d => ({ ...d, enabled: true, layout: d.layout }));
}

function applyVolume(vol) {
  const prevSelected = state.selectedIdx !== null ? state.blocks[state.selectedIdx] : null;
  const newBlocks = blocksForVolume(vol);
  // 기존 블록의 enabled/layout override 유지
  state.blocks = newBlocks.map(nb => {
    const old = state.blocks.find(ob => ob.section === nb.section && ob.role === nb.role);
    return old ? { ...nb, enabled: old.enabled, layout: old.layout } : nb;
  });
  // 이전 선택 블록이 새 목록에 있으면 선택 유지
  if (prevSelected) {
    const newIdx = state.blocks.findIndex(b => b.section === prevSelected.section && b.role === prevSelected.role);
    state.selectedIdx = newIdx >= 0 ? newIdx : null;
  }
}

// ── DOM helpers ───────────────────────────────────────────────────────
const $ = id => document.getElementById(id);
const el = (tag, cls, text) => {
  const e = document.createElement(tag);
  if (cls) e.className = cls;
  if (text !== undefined) e.textContent = text;
  return e;
};

const SECTION_COLORS = { HOOK: '#e8643a', HEAD: '#4a9ede', HERO: '#9b6cd8', BODY: '#3ab87a' };

function renderOutline() {
  const container = $('outline-list');
  container.innerHTML = '';
  const grouped = {};
  state.blocks.forEach((b, i) => {
    if (!grouped[b.section]) grouped[b.section] = [];
    grouped[b.section].push({ ...b, _idx: i });
  });

  ['HOOK', 'HEAD', 'HERO', 'BODY'].forEach(sec => {
    if (!grouped[sec]) return;
    const secEl = el('div', 'outline-section');
    const header = el('div', 'outline-section-header');
    const badge = el('span', 'sec-badge');
    badge.textContent = sec;
    badge.style.background = SECTION_COLORS[sec] + '22';
    badge.style.color = SECTION_COLORS[sec];
    badge.style.borderColor = SECTION_COLORS[sec] + '55';
    header.appendChild(badge);
    secEl.appendChild(header);

    grouped[sec].forEach(b => {
      const row = el('div', 'outline-block' + (b._idx === state.selectedIdx ? ' selected' : '') + (!b.enabled ? ' disabled' : ''));
      row.dataset.idx = b._idx;
      row.draggable = true;
      row.tabIndex = 0;
      row.setAttribute('role', 'button');
      row.setAttribute('aria-label', `${b.section} ${b.role} 블록${b.enabled ? '' : ' (비활성)'}`);

      const grip = el('span', 'grip', '⠿');
      grip.setAttribute('aria-hidden', 'true');
      grip.title = '드래그하여 순서 변경';
      const toggle = el('button', 'block-toggle', b.enabled ? '●' : '○');
      toggle.title = b.enabled ? '비활성화' : '활성화';
      toggle.setAttribute('aria-label', b.enabled ? `${b.role} 비활성화` : `${b.role} 활성화`);
      toggle.style.color = b.enabled ? SECTION_COLORS[sec] : '#555';
      const roleEl = el('span', 'block-role', b.role);
      const layoutEl = el('span', 'block-layout', b.layout);
      const hintEl = el('span', 'block-hint', b.hint);

      row.appendChild(grip);
      row.appendChild(toggle);
      row.appendChild(roleEl);
      row.appendChild(layoutEl);
      row.appendChild(hintEl);
      secEl.appendChild(row);

      toggle.addEventListener('click', e => {
        e.stopPropagation();
        state.blocks[b._idx].enabled = !state.blocks[b._idx].enabled;
        renderOutline();
        if (state.selectedIdx === b._idx) renderInspector();
      });

      row.addEventListener('click', () => {
        state.selectedIdx = b._idx;
        renderOutline();
        renderInspector();
      });
      row.addEventListener('keydown', e => {
        if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); row.click(); }
      });

      row.addEventListener('dragstart', e => {
        e.dataTransfer.setData('text/plain', b._idx);
        row.classList.add('dragging');
      });
      row.addEventListener('dragend', () => row.classList.remove('dragging'));
      row.addEventListener('dragover', e => { e.preventDefault(); row.classList.add('drag-over'); });
      row.addEventListener('dragleave', () => row.classList.remove('drag-over'));
      row.addEventListener('drop', e => {
        e.preventDefault();
        row.classList.remove('drag-over');
        const fromIdx = parseInt(e.dataTransfer.getData('text/plain'));
        const toIdx = b._idx;
        if (fromIdx !== toIdx) {
          const moved = state.blocks.splice(fromIdx, 1)[0];
          // fromIdx < toIdx면 splice로 배열이 당겨지므로 1 보정
          const insertIdx = fromIdx < toIdx ? toIdx - 1 : toIdx;
          state.blocks.splice(insertIdx, 0, moved);
          state.selectedIdx = insertIdx;
          renderOutline();
        }
      });
    });

    container.appendChild(secEl);
  });
}

function renderInspector() {
  const panel = $('inspector-panel');
  if (state.selectedIdx === null || !state.blocks[state.selectedIdx]) {
    panel.innerHTML = '<p class="insp-empty">블록을 선택하면<br>상세 정보가 표시됩니다</p>';
    return;
  }
  const b = state.blocks[state.selectedIdx];
  panel.innerHTML = `
    <div class="insp-title">${b.section} / ${b.role}</div>
    <div class="insp-hint">${b.hint}</div>
    <div class="insp-row">
      <label>활성화</label>
      <button id="insp-toggle" class="toggle-btn ${b.enabled ? 'on' : ''}">${b.enabled ? 'ON' : 'OFF'}</button>
    </div>
    <div class="insp-row">
      <label>레이아웃</label>
      <select id="insp-layout">
        ${LAYOUT_OPTIONS.map(l => `<option value="${l}"${l === b.layout ? ' selected' : ''}>${l}</option>`).join('')}
      </select>
    </div>
  `;

  $('insp-toggle').addEventListener('click', () => {
    const b = state.blocks[state.selectedIdx];
    if (!b) return;
    b.enabled = !b.enabled;
    renderOutline();
    renderInspector();
  });

  $('insp-layout').addEventListener('change', e => {
    const b = state.blocks[state.selectedIdx];
    if (!b) return;
    b.layout = e.target.value;
    renderOutline();
  });
}

// ── 저장 ──────────────────────────────────────────────────────────────
let saveStatusTimer = null;
function showSaveStatus(msg, color, autoClear = true) {
  const el = $('save-status');
  el.textContent = msg;
  el.style.color = color;
  if (saveStatusTimer) clearTimeout(saveStatusTimer);
  if (autoClear) saveStatusTimer = setTimeout(() => { el.textContent = ''; }, 4000);
}

async function saveIntake() {
  if (!state.product_name.trim()) {
    showSaveStatus('제품명을 입력해주세요', 'var(--ui-danger, #e06c6c)', true);
    $('inp-product').focus();
    return;
  }

  const btn = $('btn-save');
  btn.textContent = '저장 중...';
  btn.disabled = true;

  const data = {
    product_name: state.product_name.trim(),
    brand_name: state.brand_name,
    volume: state.volume,
    positioning: state.positioning,
    swot: { ...state.swot },
    outline_blocks: state.blocks.map(({ section, role, layout, enabled }) => ({ section, role, layout, enabled })),
  };

  try {
    const result = window.electronAPI
      ? await window.electronAPI.saveIntakeFile(data)
      : (() => { // 브라우저 fallback (개발용)
          const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
          const a = document.createElement('a');
          const url = URL.createObjectURL(blob);
          a.href = url;
          a.download = `intake_${data.product_name || 'unknown'}.json`;
          a.click();
          setTimeout(() => URL.revokeObjectURL(url), 1000); // 메모리 누수 방지
          return { ok: true, filename: a.download };
        })();
    showSaveStatus(`저장됨: ${result.filename}`, 'var(--ui-success, #7fc87f)');
  } catch (e) {
    showSaveStatus(`저장 실패: ${e.message || '알 수 없는 오류'}`, 'var(--ui-danger, #e06c6c)', false);
  } finally {
    btn.textContent = '저장';
    btn.disabled = false;
  }
}

// ── 초기화 ────────────────────────────────────────────────────────────
function init() {
  applyVolume(state.volume);
  renderOutline();
  renderInspector();

  // 첫 포커스
  setTimeout(() => $('inp-product').focus(), 50);

  // 볼륨 셀렉터
  $('vol-select').value = state.volume;
  $('vol-select').addEventListener('change', e => {
    state.volume = e.target.value;
    applyVolume(state.volume);
    state.selectedIdx = null;
    renderOutline();
    renderInspector();
  });

  // Intake 폼
  $('inp-product').addEventListener('input', e => state.product_name = e.target.value);
  $('inp-brand').addEventListener('input', e => state.brand_name = e.target.value);
  $('inp-positioning').addEventListener('input', e => state.positioning = e.target.value);
  $('inp-strengths').addEventListener('input', e => state.swot.strengths = e.target.value);
  $('inp-weaknesses').addEventListener('input', e => state.swot.weaknesses = e.target.value);
  $('inp-opportunities').addEventListener('input', e => state.swot.opportunities = e.target.value);
  $('inp-threats').addEventListener('input', e => state.swot.threats = e.target.value);

  // 저장 버튼
  $('btn-save').addEventListener('click', saveIntake);
}

document.addEventListener('DOMContentLoaded', init);
