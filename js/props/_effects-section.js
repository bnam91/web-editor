/* _effects-section.js — 표준 Effects 절 «효과 한 줄» 부품(시트 0.9.14 224 DS-EFFECTS-STD-REST-01 · 탑 OK 261125)
 *
 * 꼴 = FigCraft 효과 줄(~/ref/figcraft/crates/ui-egui/src/panels/right/effects.rs:38-59): [⚙ 펼침][이름] … [끝 칸] + 펼친 몸(:84 effect_settings)
 *   · 몸 = 값 칸 그대로(:171~) — 손짠 패널의 3단 «없음/부드럽게/강하게»·슬라이더·select 는 몸 안에 «바이트 그대로»
 *   · 이름 자리에 head(예: 켬/끔 checkHTML)를 주면 그것이 이름이다(체크 마크업·id 무변)
 * 다음 물결(탑 261125): ＋ = 바로 Drop shadow 추가(:15-18) · 줄 종류 드롭다운(:44-50) · 눈/−(:57-58) · 줄 끌기/복사(:73-95) — 저장 키가 없어 지금은 안 그린다.
 * ⛔저장 키·칸 id 무변 — 부품은 껍데기만 그린다. 펼침은 패널 상태(직렬화 안 탐) · document 위임 한 벌(패널마다 배선 0).
 */
const _open = new Map();   // 줄 id → 펼침(기본 펼침 — 옛 패널은 늘 펼쳐 보였다)
const FX_ROW_ICON = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2" stroke-linecap="round" aria-hidden="true"><circle cx="6" cy="6" r="1.6"/><path d="M6 1.5v1.5M6 9v1.5M1.5 6H3M9 6h1.5M2.8 2.8l1 1M8.2 8.2l1 1M2.8 9.2l1-1M8.2 3.8l1-1"/></svg>';

export const fxRowOpen = (id) => _open.get(id) !== false;

/**
 * @param {object} o
 * @param {string} o.id     줄 id(새 id · 펼침 단추 = `${id}-open` · 몸 = `${id}-body`)
 * @param {string} [o.label] 줄 이름(head 가 없을 때)
 * @param {string} [o.head]  이름 자리 마크업(켬/끔 체크 등 — 그대로 넣는다)
 * @param {string} [o.end]   끝 칸 마크업(없으면 빈칸)
 * @param {string} o.body    몸 — 옛 칸 마크업 그대로
 */
export function effectRowHTML({ id, label = '', head = '', end = '', body }) {
  const open = fxRowOpen(id);
  return `
      <div class="ui-fx-row" data-part="effect-row" id="${id}">
        <div class="prop-row ui-fx-row-head">
          <button type="button" class="prop-chain-btn" id="${id}-open" data-part="fx-open" aria-expanded="${open}" aria-controls="${id}-body" title="Effect settings" aria-label="Effect settings">${FX_ROW_ICON}</button>
          ${head || `<span class="ui-fx-row-label" style="flex:1;min-width:0;">${label}</span>`}${end}
        </div>
        <div class="ui-fx-row-body" id="${id}-body"${open ? '' : ' hidden'}>${body}
        </div>
      </div>`;
}

if (typeof document !== 'undefined' && !globalThis.__fxRowWired) {
  globalThis.__fxRowWired = true;
  document.addEventListener('click', (e) => {
    const b = e.target?.closest?.('[data-part="fx-open"]');
    if (!b) return;
    const row = b.closest('[data-part="effect-row"]');
    const body = row && document.getElementById(`${row.id}-body`);
    if (!body) return;
    const open = body.hidden;   // 닫혀 있었으면 연다
    body.hidden = !open;
    b.setAttribute('aria-expanded', String(open));
    _open.set(row.id, open);
  });
}
