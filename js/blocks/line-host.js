/* ═══════════════════════════════════════════════════════════════════════════
   LINE HOST — 버블·챗의 «줄» (BT2, 2026-10-04 태양 lane-bt2-lines)
   ───────────────────────────────────────────────────────────────────────────
   현빈 2026-10-04: 「버블블럭이 모인게 결국 챗블럭인데 버블블럭에 기능 추가했으니, 챗블럭에서도 같은 기능이 구현되어있어야된다」
   원문(CHECKLIST-20261003:455): 「버블텍스트에 별도 줄(블럭) 추가 — 그리드 줄 추가하듯. 다른 스타일 텍스트가 들어간다」

   ★줄 = «그리드 줄 데이터» 그대로다(설계 D1·D8, 지디 «안 1»).
     · 저장: 버블 = block.dataset.lines (JSON) · 챗 = dataset.messages[i].lines (선택 필드). 둘 다 «없으면 지금 그대로».
     · 그리기: grid-block.js 의 gridLineHtml «2-인자»(innercard 와 같은 길 — data-r/c/line 을 «안» 찍는다).
       주소는 감싸개 `.ln-row[data-ln][data-ln-m]` 가 갖는다.
       ⛔그리드 주소 속성(data-r/c/line)을 쓰지 마라 — G19 로 그리드 «밑»(.grd-children)에 버블·챗이 들어갈 수 있고,
         그리드 인라인 편집 술어(block-drag.js _gridEditable)가 closest('[data-line]') → closest('.grid-block') 로 풀어
         «그리드 (0,0) 칸의 줄»로 읽는다. (시험 T7)
     · 패널: 줄바·줄 꾸미기·Typography 는 prop-grid.js 의 «같은 함수»를 주인(host)과 함께 빌린다(grdLineUi). 복사본 없음.
   ★결정(태양 · 지디 승인 2026-10-04): D1 갈음(줄이 있으면 본문 대신 줄만) · D2 첫 전환 때 지금 계산 스타일을 첫 줄에 박는다 ·
     D3 챗 msg.text 를 «줄 글자 거울»로 유지 · D4 줄이 있을 때 MCP/AI 글자 쓰기는 «분명한 오류로 거절» ·
     D5 줄 종류 = 글자 역할 + 여백(⛔그림·구분선 없음) · D6 줄 Typography · D7 정렬 = 지금 그리드 줄 정렬 그대로 ·
     D10 ⌫·T·G·Esc 는 «줄»에 먹는다 · D11 역할 크기는 절대값(챗 fontSize 를 안 따른다).
   ⛔옛 버블·챗(줄 없음)은 이 파일의 어떤 코드도 «그리지» 않는다 — 렌더 문은 전부 lnHasLines 로 막혀 있다(T1·T1b).
═══════════════════════════════════════════════════════════════════════════ */
import { gridLineHtml, GRID_ROLES, MAX_CELL_LINES, gridMergeLine, gridValidateLines, gridLineHasText } from './grid-block.js';
import { grdLineUi, grdSetActiveLine, grdGetActiveLine, grdIsSoleSelected } from '../props/prop-grid.js';
import { escHtml } from '../props/_helpers.js';   // ⛔이스케이프 사본 금지(tests/unit/name-axes-to-markup X6·X9) — 정본을 쓴다

/** D5 — 버블·챗이 내놓는 줄 종류. ★GRID_ROLES 에서 뜬다(손으로 안 적는다) + 여백. */
export const LN_KINDS = Object.freeze([...Object.keys(GRID_ROLES), 'gap']);
export const LN_ROW_CLASS = 'ln-row';
/** 줄 선택 표시 — `-line-selected` 로 끝나 저장 직렬화가 «알아서» 벗긴다(section-serialize.js RUNTIME_MARKER_RE). */
export const LN_MARK_CLASS = 'ln-line-selected';
const HOST_SEL = '.speech-bubble-block, .chat-block';

export function lnHasLines(v) { return Array.isArray(v) && v.length > 0; }


/** 줄 배열 검사 — 그리드 잣대(gridValidateLines) ＋ D5 종류 제한. null = 통과. */
export function lnValidateLines(lines, where = 'lines') {
  const r = gridValidateLines(lines, where);
  if (r) return r;
  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].type === undefined ? 'body' : lines[i].type;
    if (!LN_KINDS.includes(t)) {
      return { ok: false, code: 'INVALID',
        message: `${where}[${i}].type '${t}' is not allowed in a speech bubble / chat line — allowed: ${LN_KINDS.join('|')}` };
    }
  }
  return null;
}

/** 줄 글자만 이은 평문(\n). D3 거울·Figma 글자·AI 읽기에 쓴다. */
export function lnPlainText(lines) {
  return (Array.isArray(lines) ? lines : []).filter(gridLineHasText).map(l => String(l.text ?? '')).join('\n');
}
/** 챗 msg.text 거울 — 챗 렌더러는 msg.text 를 «HTML 로» 싣는다(chat-block.js) ⇒ 이스케이프한다. */
export function lnTextMirrorHtml(lines) { return escHtml(lnPlainText(lines)); }

/** 줄 HTML — 감싸개 하나에 줄 하나. m = 챗 메시지 번호(버블은 null). */
export function lnLinesHtml(lines, m = null) {
  const mAttr = (m === null || m === undefined) ? '' : ` data-ln-m="${m}"`;
  return (Array.isArray(lines) ? lines : [])
    .map((l, i) => `<div class="${LN_ROW_CLASS}" data-ln="${i}"${mAttr}>${gridLineHtml(l, 'left')}</div>`).join('');
}

/* ══ 버블 ══════════════════════════════════════════════════════════════════ */
export function lnBubbleLines(block) {
  const raw = block && block.dataset ? block.dataset.lines : undefined;
  if (raw === undefined || raw === '') return null;
  try { const a = JSON.parse(raw); return lnHasLines(a) ? a : null; } catch (_) { return null; }
}

/** 버블 줄 그리기 — ★줄이 없으면 «아무것도 안 한다»(옛 버블 무접촉, T1b). */
export function lnRenderBubble(block) {
  const lines = lnBubbleLines(block);
  if (!lines) return false;
  const tb = block.querySelector('.tb-bubble');
  if (!tb) return false;
  tb.innerHTML = lnLinesHtml(lines, null);
  delete tb.dataset.isPlaceholder;
  if (!tb.hasAttribute('contenteditable')) tb.setAttribute('contenteditable', 'false');   // 12곳의 [contenteditable] 가 본체를 집게(설계 §2-3)
  lnRemark(block);
  return true;
}

/** D2 — 지금 본문을 «첫 줄»로 굽는다(계산 스타일을 줄에 박아 겉모습 유지). 서식(굵게 span 등)은 평문이 된다. */
function _bakeFrom(el, textEl) {
  const cs = getComputedStyle(el);
  const fs = Math.round(parseFloat(cs.fontSize) || 0);
  const line = { type: 'body', text: '' };
  const src = textEl || el;
  const isPh = src.dataset && src.dataset.isPlaceholder === 'true';
  line.text = isPh ? '' : String(src.innerText || '').replace(/\r\n?/g, '\n').replace(/​/g, '').replace(/\n+$/, '');
  if (fs > 0) line.fontSize = fs;
  const w = String(cs.fontWeight || '');
  if (/^\d+$/.test(w)) line.weight = w;
  const lhPx = parseFloat(cs.lineHeight);
  if (fs > 0 && Number.isFinite(lhPx)) line.lineHeight = Math.round((lhPx / fs) * 100) / 100;
  const ls = parseFloat(cs.letterSpacing);
  if (Number.isFinite(ls) && ls !== 0) line.letterSpacing = Math.round(ls * 100) / 100;
  if (cs.textAlign === 'center' || cs.textAlign === 'right') line.align = cs.textAlign;
  if (cs.fontStyle === 'italic') line.italic = '1';
  return line;
}
export function lnBakeBubble(block) {
  const tb = block.querySelector('.tb-bubble');
  return tb ? _bakeFrom(tb) : { type: 'body', text: '' };
}

/* ══ 챗 ════════════════════════════════════════════════════════════════════ */
function _chatMsgs(block) {
  try { const a = JSON.parse(block.dataset.messages || '[]'); return Array.isArray(a) ? a : []; } catch (_) { return []; }
}
export function lnChatLines(block, m) {
  const msg = _chatMsgs(block)[m];
  return msg && lnHasLines(msg.lines) ? msg.lines : null;
}
export function lnBakeChat(block, m) {
  const t = block.querySelector(`.chb-btext[data-msg-idx="${m}"]`);
  return t ? _bakeFrom(t, t) : { type: 'body', text: '' };
}

/* ══ 주인(host) — prop-grid.js 의 줄바·줄 꾸미기·Typography 가 «이 블럭의 줄»을 고치게 한다 ══
 * 주소 = {r, c, li} 그대로(그리드 꼴): 버블 r=0, 챗 r=메시지 번호, c=0 고정.
 * ★commitLines 는 «모델 문»(updateSpeechBubbleBlock / updateChatBlock)으로만 쓴다 — 패널과 MCP 가 «같은 길»이고,
 *   그 문이 push-before ＋ model-update-history 끝 표본을 진다(⌘Z 한 걸음, T4).
 * ★처음 줄을 더하면(줄 없음 → 있음) 지금 본문을 첫 줄로 굽는다(D2). 그때 grdAddLine 이 미리 세운 활성줄은 한 칸 민다. */
function _baseHost(block, o) {
  const host = {
    kind: o.kind, kinds: LN_KINDS, maxLines: MAX_CELL_LINES, limitLabel: o.limitLabel, noHitHint: o.noHitHint,
    head: o.head,
    getLines: (r) => o.getLines(r) || [],
    commitLines: (r, c, lines, opts) => {
      let next = Array.isArray(lines) ? lines.slice() : lines;
      if (Array.isArray(next) && next.length && !o.getLines(r)) {
        next = [o.bake(r), ...next];                       // D2 — 첫 전환
        const act = grdGetActiveLine(block);
        if (act && act.r === r && Number.isInteger(act.li)) grdSetActiveLine(block, { ...act, li: act.li + 1 });
      }
      return o.commit(r, next, opts);
    },
    patchLine: (r, c, li, fields) => {
      const merged = gridMergeLine(o.getLines(r) || [], li, fields);
      if (!merged) return { ok: false, code: 'NOT_FOUND', message: `line ${li} not found` };
      return o.commit(r, merged);
    },
    previewLine: (r, c, li, fields) => {
      const merged = gridMergeLine(o.getLines(r) || [], li, fields);
      if (!merged) return false;
      o.write(r, merged);                                   // ⛔히스토리·패널 재생성 없음 — 제스처 정책은 부르는 쪽(prop-grid)
      return true;
    },
    show: (addr) => { if (addr !== undefined) grdSetActiveLine(block, addr); o.show(); },
    mark: (addr) => lnMark(block, addr),
    line: (addr) => { const h = host.resolveAny(addr); return h && h.line && gridLineHasText(h.line) ? h.line : null; },
    resolveAny: (addr) => {
      if (!addr || addr.np) return null;
      const r = Number(addr.r);
      if (!Number.isInteger(r) || !o.rowOk(r)) return null;
      if (addr.li === null) return { r, c: 0, li: null, line: null };
      const li = Number(addr.li);
      const lines = o.getLines(r);
      const line = Array.isArray(lines) ? lines[li] : undefined;
      if (!Number.isInteger(li) || !line || typeof line !== 'object') return null;
      return { r, c: 0, li, line };
    },
    refreshSummary: (addr) => {
      const el = document.getElementById('grd-line-summary');
      const line = host.line(addr);
      if (!el || !line) return;
      const s = grdLineUi.summaryText(addr.r, addr.c, addr.li, line, host);
      el.textContent = s; el.title = s;
    },

    /* ══ ★줄 «옮기기» 다섯 칸 (BT3, 2026-10-06 ⑵-B② · 현빈 「그리드블럭에 줄추가하는 것 처럼 핸들이 있어서
     *    드래그로 옮길 수도 있고 그런데 이게 똑같지 않니 구조가?」) ══════════════════════════════
     * ★계약은 그리드 주인(prop-grid.js `_grdGridHost`)과 ★같다 — 끄는 손잡이(overlay-handles.js)가
     *   ★이 다섯 칸으로만 묻는다(⑵-B① 에서 그렇게 바꿨다). ⛔손잡이를 복사해 새로 만들지 않았다.
     * ★「행」이 블럭마다 다른 것이 이 계약의 전부다 — 그리드 = 칸{r,c} · 버블 = 하나{r:0} · 챗 = 메시지{r:idx}.
     * ★버블·챗 줄은 그리드 주소(data-r/c/line)를 ★고의로 안 찍는다(이 파일 머리말 · 시험 T7) ⇒ `.ln-row` 로 찾는다. */
    rowEl: (addr) => {
      if (!addr || addr.li === null || addr.li === undefined || addr.np) return null;
      return block.querySelector(o.rowSel(addr.r, addr.li));
    },
    linesBox: (r) => o.boxOf(r),
    /** 그 그릇의 줄들 — 직속 `.ln-row` 만. ★그리드의 `:scope > [data-line]` 과 같은 뜻이다. */
    rowsIn: (boxEl) => (boxEl ? [...boxEl.querySelectorAll(`:scope > .${LN_ROW_CLASS}`)] : []),
    rowAt: (el) => o.rowAt(el),
    /** 옮기기 — ★같은 행만. 다른 행은 ⛔아직 못 한다(까닭은 아래). */
    moveLine: (from, fromLi, to, toLi) => {
      /* ══ ★«다른 행»으로 (⑵-B③, 2026-10-06) — 챗의 ★옆 메시지로 줄을 옮긴다 ════════════════════
       * ★버블은 ★여기 안 온다 — 행이 하나라 아래 `o.rowOk(to.r)` 가 거짓이 된다 ⇒ INVALID(⛔SKIP 이지 FAIL 아니다).
       * ★★이력 꼴은 ★㉣ 다 — `prop-grid.js grdMoveLineToCell` 과 ★같은 꼴로 맞췄다(⛔새 설계 금지):
       *     문1 = ★Raw(래퍼 밖) · `noHistory` ★안 줌  ⇒ 그 push-before 가 ★이 제스처의 «변경 전» 칸이다
       *     문2 = ★래퍼를 타고 ＋ `noHistory`         ⇒ 그 ★끝 표본이 ★«마지막 문»의 칸이다
       *   ⇒ 스택 ★＋1 · ⌘Z 한 번에 둘 다. ⛔문1 을 일반 입구로 보내면 래퍼 끝 표본이 ★«반쪽» 칸을 남긴다
       *     (실측 2026-10-06: 그 꼴로 ⌘Z① 이 「출발 행에서만 뺀」 상태로 갔다 — tests/dom/ln-nohistory N2 가 잠근다).
       *   ⛔「호출자가 pushHistory 1칸 ＋ 둘 다 Raw」 꼴도 ★틀렸다 — 그 한 칸이 ★무변화 차단에 먹혀 스택 ＋0 이 된다(실측).
       * ★상한을 ★«먼저» 본다 — 거절되는 순간 줄이 ★어느 행에도 없어서는 안 된다(grdMoveLineToCell 의 그 순서 규약).
       * ★줄 «객체를 그대로» 옮긴다 — 꾸밈은 그 객체에 산다. ⛔필드를 골라 베끼지 마라. */
      if (to.r !== from.r) {
        if (!o.rowOk(to.r)) return { ok: false, code: 'INVALID' };   // 버블(행 하나)·없는 메시지
        const src = o.getLines(from.r);
        const dst = o.getLines(to.r) || [];
        if (!Array.isArray(src)) return { ok: false, code: 'INVALID' };
        const f2 = Number(fromLi);
        if (!Number.isInteger(f2) || f2 < 0 || f2 >= src.length) return { ok: false, code: 'INVALID' };
        if (dst.length >= MAX_CELL_LINES) {
          window.showToast?.(`⚠️ 줄 옮기기 실패: ${o.limitLabel} 최대 ${MAX_CELL_LINES}줄`);
          return { ok: false, code: 'LIMIT' };
        }
        const at = (toLi === null || toLi === undefined)
          ? dst.length
          : Math.max(0, Math.min(dst.length, Math.trunc(Number(toLi)) || 0));
        const moved = src[f2];
        const nextSrc = src.slice(); nextSrc.splice(f2, 1);
        const nextDst = dst.slice(); nextDst.splice(at, 0, moved);
        const prev2 = grdGetActiveLine(block);
        /* ★문1 «전»에 활성 줄을 비운다 — 커밋이 패널을 다시 그리므로, 그대로 두면 그 한 번이
           «방금 사라진 li»를 가리킨다(grdMoveLineToCell 의 같은 자리·같은 까닭). */
        grdSetActiveLine(block, null);
        const r1 = o.commitRaw(from.r, nextSrc);
        if (r1 && r1.ok === false) {
          grdSetActiveLine(block, prev2);
          return { ok: false, code: r1.code, message: r1.message };
        }
        grdSetActiveLine(block, { r: to.r, c: 0, li: at });
        const r2 = o.commit(to.r, nextDst, { noHistory: true });
        if (r2 && r2.ok === false) {
          /* ★되돌린다 — 안 되돌리면 줄이 ★어느 행에도 없다. 되돌림도 Raw·noHistory 다
             (⌘Z 가 「되돌림을 되돌리는」 칸을 만나면 사람이 두 번 눌러야 한다).
             ⛔반환을 «받는다» — 되돌림이 «또» 실패하면 줄이 정말 사라졌고 그때는 말해야 한다. */
          const back = o.commitRaw(from.r, src, { noHistory: true });
          if (back && back.ok === false) {
            window.showToast?.('⚠️ 줄 옮기기가 실패하고 되돌리지도 못했습니다 — ⌘Z 를 눌러 주세요');
          }
          grdSetActiveLine(block, prev2);
          return { ok: false, code: r2.code, message: r2.message };
        }
        return r2 || { ok: true };
      }
      const lines = o.getLines(from.r);
      if (!Array.isArray(lines)) return { ok: false, code: 'INVALID' };
      const f = Number(fromLi), t = Number(toLi);
      if (!Number.isInteger(f) || f < 0 || f >= lines.length) return { ok: false, code: 'INVALID' };
      if (!Number.isInteger(t) || t < 0 || t >= lines.length) return { ok: false, code: 'INVALID' };
      if (f === t) return { ok: false, code: 'SAME_SPOT' };   // ★끌다 되돌리는 것은 흔한 일이다(그리드 D6 와 같은 뜻)
      /* ★줄 «객체를 그대로» 옮긴다 — 꾸밈은 그 객체에 살아 있으므로 자동으로 따라온다.
         ⛔필드를 골라 베끼지 마라(grdMoveLineToCell 이 같은 말을 적어 뒀다). */
      const next = lines.slice();
      next.splice(t, 0, next.splice(f, 1)[0]);
      /* ★활성 줄을 «도착 자리»로 먼저 옮긴다 — commitLines 가 패널을 다시 그리므로, 안 옮기면
         그 한 번이 «옛 자리»를 가리킨다(grdMoveLineToCell 의 그 순서 규약). */
      const prev = grdGetActiveLine(block);
      grdSetActiveLine(block, { r: from.r, c: 0, li: t });
      const res = host.commitLines(from.r, 0, next);
      if (res && res.ok === false) {
        grdSetActiveLine(block, prev);
        window.showToast?.('⚠️ 줄 옮기기 실패 — ' + (res.message || res.code));
      }
      return res;
    },
  };
  return host;
}

export function lnBubbleHost(block) {
  return _baseHost(block, {
    kind: 'bubble', limitLabel: '말풍선 한 개에',
    noHitHint: '줄을 한 번 더 누르면 줄 편집 · 두 번 누르면 글자 편집',
    head: (r, c, li) => (li === null ? '줄 없음 — 줄을 더하면 지금 글이 첫 줄이 된다' : `${li + 1}번째 줄`),
    getLines: () => lnBubbleLines(block),
    rowOk: (r) => r === 0,
    bake: () => lnBakeBubble(block),
    commit: (r, lines, opts) => window.updateSpeechBubbleBlock?.(block.id, { lines }, opts),
    /* ★Raw = 끝 표본 래퍼 밖(까닭은 block-factory.js 의 그 등록 주석). ★버블은 행이 하나라 쓸 일이 없지만
       ⛔계약을 반쪽으로 두지 않는다 — 두 주인이 ★같은 칸을 갖는다(한쪽만 있으면 다음 사람이 그 차이를 함정으로 밟는다). */
    commitRaw: (r, lines, opts) => window.updateSpeechBubbleBlockRaw?.(block.id, { lines }, opts),
    write: (r, lines) => { block.dataset.lines = JSON.stringify(lines); lnRenderBubble(block); },
    show: () => window.showTextProperties?.(block),
    /* ★버블은 «행이 하나»다(r=0) ⇒ 「다른 행으로」가 ★해당 없다(⌘←/→ 는 SKIP — ⛔FAIL 이 아니다). */
    rowSel: (r, li) => `.${LN_ROW_CLASS}[data-ln="${li}"]`,
    boxOf: () => block.querySelector('.tb-bubble'),
    rowAt: (el) => {
      if (!el || !el.closest || !block.contains(el)) return null;
      const box = block.querySelector('.tb-bubble');
      return box ? { r: 0, c: 0, box } : null;
    },
  });
}

export function lnChatHost(block) {
  return _baseHost(block, {
    kind: 'chat', limitLabel: '메시지 한 개에',
    noHitHint: '메시지를 한 번 더 누르면 줄 편집 · 줄을 두 번 누르면 글자 편집',
    head: (r, c, li) => (li === null ? `메시지 ${r + 1} · 줄 없음 — 줄을 더하면 지금 글이 첫 줄이 된다` : `메시지 ${r + 1} · ${li + 1}번째 줄`),
    getLines: (r) => lnChatLines(block, r),
    rowOk: (r) => r >= 0 && r < _chatMsgs(block).length,
    bake: (r) => lnBakeChat(block, r),
    commit: (r, lines, opts) => window.updateChatBlock?.(block.id, { editMessage: { index: r, lines: lines.length ? lines : null } }, opts),
    /* ★Raw = 끝 표본 래퍼 밖 — ⑵-B③ 의 ★문1 이 이 길로 간다(㉣ 꼴 · 까닭은 moveLine 머리말). */
    commitRaw: (r, lines, opts) => window.updateChatBlockRaw?.(block.id, { editMessage: { index: r, lines: lines.length ? lines : null } }, opts),
    write: (r, lines) => {
      const msgs = _chatMsgs(block);
      if (!msgs[r]) return;
      msgs[r].lines = lines;
      msgs[r].text = lnTextMirrorHtml(lines);               // D3 거울
      block.dataset.messages = JSON.stringify(msgs);
      window.renderChatBlock?.(block);
    },
    show: () => window.showChatProperties?.(block),
    /* ★챗은 «행 = 메시지»다. 줄 감싸개가 `data-ln-m` 으로 메시지 번호를 든다(lnLinesHtml). */
    rowSel: (r, li) => `.${LN_ROW_CLASS}[data-ln-m="${r}"][data-ln="${li}"]`,
    boxOf: (r) => {
      /* 그 메시지의 말풍선 상자 — 줄들이 그 ★직속 자식이다(chat-block.js wrapHtml). */
      const row = block.querySelector(`.${LN_ROW_CLASS}[data-ln-m="${r}"]`);
      return row ? row.parentElement : null;
    },
    rowAt: (el) => {
      if (!el || !el.closest || !block.contains(el)) return null;
      /* ★줄 위면 그 줄의 감싸개에서 메시지 번호를 읽는다 — ⛔.chb-msg 의 순서로 세지 마라
         (프로필·이름이 끼면 자식 index 와 메시지 index 가 갈린다). */
      const row = el.closest('.' + LN_ROW_CLASS);
      if (row && row.dataset.lnM !== undefined) {
        const r = Number(row.dataset.lnM);
        return Number.isInteger(r) ? { r, c: 0, box: row.parentElement } : null;
      }
      /* ★줄이 아직 없는 메시지 위면 그 본문에서 번호를 읽는다(lnClickAddr 와 ★같은 길). */
      const msg = el.closest('.chb-msg');
      const bt = msg && msg.querySelector('.chb-btext[data-msg-idx]');
      if (bt && block.contains(bt)) {
        const r = Number(bt.dataset.msgIdx);
        return Number.isInteger(r) ? { r, c: 0, box: bt.parentElement } : null;
      }
      return null;
    },
  });
}

export function lnHostFor(block) {
  if (!block || !block.classList) return null;
  if (block.classList.contains('speech-bubble-block')) return lnBubbleHost(block);
  if (block.classList.contains('chat-block')) return lnChatHost(block);
  return null;
}

/* ══ 줄 표시 ═══════════════════════════════════════════════════════════════ */
export function lnMark(block, addr) {
  if (!block) return;
  block.querySelectorAll('.' + LN_MARK_CLASS).forEach(el => el.classList.remove(LN_MARK_CLASS));
  if (!addr || addr.li === null || addr.li === undefined) return;
  const isChat = block.classList.contains('chat-block');
  const sel = isChat ? `.${LN_ROW_CLASS}[data-ln-m="${addr.r}"][data-ln="${addr.li}"]` : `.${LN_ROW_CLASS}[data-ln="${addr.li}"]`;
  block.querySelector(sel)?.classList.add(LN_MARK_CLASS);
}
/** 다시 그린 뒤 표시를 되붙인다(렌더가 innerHTML 을 갈아 표시를 지운다). 선택된 블럭만. */
export function lnRemark(block) {
  if (!block || !block.classList.contains('selected')) return;
  lnMark(block, grdGetActiveLine(block));
}
/** 블럭을 떠나면 줄 선택도 해제(editor.js clearSelectionMarks — 그리드 grdClearAllActiveLines 의 짝). */
export function lnClearAllActive(root) {
  const scope = root || document;
  scope.querySelectorAll(HOST_SEL).forEach(b => { if (grdGetActiveLine(b)) grdSetActiveLine(b, null); });
  scope.querySelectorAll('.' + LN_MARK_CLASS).forEach(el => el.classList.remove(LN_MARK_CLASS));
}

/** 캔버스 클릭 한 번이 «어느 줄»인가 — wasSole = 클릭 «직전» 이 블럭 하나만 선택돼 있었나(그리드 2단 선택과 같은 규칙). */
export function lnClickAddr(block, target, wasSole) {
  if (!wasSole || !block || !target || !target.closest) return null;
  const row = target.closest('.' + LN_ROW_CLASS);
  if (row && block.contains(row)) {
    const li = Number(row.dataset.ln);
    const r = row.dataset.lnM !== undefined ? Number(row.dataset.lnM) : 0;
    return Number.isInteger(li) && Number.isInteger(r) ? { r, c: 0, li } : null;
  }
  if (block.classList.contains('chat-block')) {               // 챗: 줄 없는 메시지 = 메시지 선택(li:null)
    const msg = target.closest('.chb-msg');
    const bt = msg && msg.querySelector('.chb-btext[data-msg-idx]');
    if (bt && block.contains(bt)) { const r = Number(bt.dataset.msgIdx); return Number.isInteger(r) ? { r, c: 0, li: null } : null; }
  }
  return null;
}

/* ══ 패널 — 텍스트 패널(버블)·챗 패널에 «같은» 줄 절을 얹는다 ═══════════════════ */
function _insertAfterHeader(html) {
  const panel = document.querySelector('#panel-right .panel-body');
  const head = panel && panel.querySelector('.prop-section');
  if (!head) return null;
  const tmp = document.createElement('div');
  tmp.innerHTML = html;
  const box = document.createElement('div');
  box.id = 'ln-line-panel';
  while (tmp.firstChild) box.appendChild(tmp.firstChild);
  head.after(box);
  return box;
}
function _mountLineUi(block, host, addr, { synthetic = false } = {}) {
  const anyHit = host.resolveAny(addr);
  const hit = anyHit && anyHit.line && gridLineHasText(anyHit.line) ? anyHit : null;
  const cur = anyHit ? { r: anyHit.r, c: 0, li: anyHit.li } : null;
  if (!synthetic) grdSetActiveLine(block, cur);
  const html = grdLineUi.lineBarHtml(anyHit, block, host)
    + (anyHit && anyHit.li !== null ? grdLineUi.lineSectionHtml(anyHit, block, host) : '')
    + (hit ? grdLineUi.typoSectionsHtml(hit, block) : '');
  if (!_insertAfterHeader(html)) return;
  if (cur) grdLineUi.wireLineBar(block, cur, host);
  if (cur && cur.li !== null) grdLineUi.wireLineSection(block, cur, host);
  if (hit) grdLineUi.wireTypo(block, cur, host);
  if (!synthetic) lnMark(block, cur);
  /* ★⑵-B② — 줄을 고르면 ★끄는 손잡이도 같이 뜬다(그리드는 prop-grid.js 가 같은 자리에서 부른다).
     ⛔synthetic(패널이 세운 기본 주소)에는 ★안 띄운다 — 사람이 고른 줄이 아니다(⑵-A 의 그 가름).
     ★걷는 자리는 ★이미 범용이다 — editor.js deselectAll 의 hideGridLineGrip. */
  if (!synthetic && cur && cur.li !== null) window.showGridLineGrip?.(block);
}

/** D6 — 줄 모드 버블은 블럭 단위 글자 절(Type·Typography·Fill·정렬)을 숨긴다: 줄마다 인라인 값을 찍어 «안 먹는다».
 *  ⛔지우지 않고 숨긴다 — 배선(wireFontSection 등)이 요소를 찾다 죽지 않게. */
function _hideBlockTypo() {
  const panel = document.querySelector('#panel-right .panel-body');
  if (!panel) return;
  const hide = (el) => { if (el) el.style.display = 'none'; };
  hide(panel.querySelector('#type-section'));
  hide(panel.querySelector('#txt-font-picker')?.closest('.prop-section'));
  hide(panel.querySelector('#txt-color')?.closest('.prop-section'));
  const pos = panel.querySelector('#txt-x-number')?.closest('.prop-section');
  if (pos) {
    const grp = pos.querySelector('.prop-align-group');
    hide(grp); hide(grp?.previousElementSibling?.classList.contains('prop-field-label') ? grp.previousElementSibling : null);
  }
}

export function lnAugmentBubblePanel(tb) {
  const host = lnBubbleHost(tb);
  if (!lnBubbleLines(tb)) { _mountLineUi(tb, host, { r: 0, c: 0, li: null }); return; }
  _hideBlockTypo();
  _mountLineUi(tb, host, grdGetActiveLine(tb));
}
export function lnAugmentChatPanel(block) {
  const act = grdGetActiveLine(block);
  if (act) { _mountLineUi(block, lnChatHost(block), act); return; }
  if (_chatMsgs(block).length === 1) { _mountLineUi(block, lnChatHost(block), { r: 0, c: 0, li: null }, { synthetic: true }); return; }
  _mountLineUi(block, lnChatHost(block), null);
}

/* ══ 줄 «글자» 편집 — 더블클릭 (그리드 인라인 편집과 같은 손짓) ═════════════════
 * ★capture 로 블럭에 건다(BT1 이름표 선례, block-drag.js) — 일반 텍스트 더블클릭(=[contenteditable] 전부 켜기)과
 *   챗 본문 더블클릭보다 «먼저» 잡는다. ⛔.tb-bubble 을 통째로 켜면 줄 경계가 깨진다(설계 §2-2).
 * ★pushHistory 는 «시작할 때» 한 번(push-before — 일반 텍스트 편집과 같다). 끝날 때는 dataset 만 쓴다 ⇒ ⌘Z 한 걸음. */
function _lineTextEl(row) {
  const first = row && row.firstElementChild;
  if (!first) return null;
  if (first.classList.contains('grd-line')) return first;
  return first.querySelector(':scope > .grd-badge');
}
export function lnBeginEdit(block, addr) {
  const host = lnHostFor(block);
  const hit = host && host.resolveAny(addr);
  if (!hit || hit.li === null || !gridLineHasText(hit.line)) return false;
  const isChat = block.classList.contains('chat-block');
  const row = block.querySelector(isChat ? `.${LN_ROW_CLASS}[data-ln-m="${hit.r}"][data-ln="${hit.li}"]` : `.${LN_ROW_CLASS}[data-ln="${hit.li}"]`);
  const el = _lineTextEl(row);
  if (!el) return false;
  window.pushHistory?.('줄 글자 편집');
  block.classList.add('editing');
  el.setAttribute('contenteditable', 'true');
  el.style.userSelect = 'text'; el.style.cursor = 'text';
  el.focus();
  try { const s = window.getSelection(); s.selectAllChildren(el); s.collapseToEnd(); } catch (_) {}
  const onKey = (ev) => { if (ev.key === 'Escape') { ev.preventDefault(); ev.stopPropagation(); el.blur(); } };
  const onPaste = (ev) => { ev.preventDefault(); const t = ev.clipboardData?.getData('text/plain') || ''; if (t) document.execCommand('insertText', false, t); };
  const finish = () => {
    el.removeEventListener('keydown', onKey); el.removeEventListener('paste', onPaste); el.removeEventListener('blur', finish);
    el.removeAttribute('contenteditable'); el.style.userSelect = ''; el.style.cursor = '';
    block.classList.remove('editing');
    const text = String(el.innerText || '').replace(/\r\n?/g, '\n').replace(/​/g, '').replace(/\n+$/, '');
    if (text !== String(hit.line.text ?? '')) {
      host.previewLine(hit.r, 0, hit.li, { text });
      window.scheduleAutoSave?.();
    } else if (isChat) window.renderChatBlock?.(block); else lnRenderBubble(block);
    if (block.classList.contains('selected')) host.show({ r: hit.r, c: 0, li: hit.li });
  };
  el.addEventListener('keydown', onKey); el.addEventListener('paste', onPaste); el.addEventListener('blur', finish);
  return true;
}

export function lnBindLineEdit(block) {
  if (!block || block._lnEditBound) return;
  block._lnEditBound = true;
  block.addEventListener('dblclick', (e) => {
    const isBubble = block.classList.contains('speech-bubble-block');
    const row = e.target.closest?.('.' + LN_ROW_CLASS);
    if (row && block.contains(row)) {
      e.stopPropagation(); e.preventDefault();
      const li = Number(row.dataset.ln);
      const r = row.dataset.lnM !== undefined ? Number(row.dataset.lnM) : 0;
      if (_lineTextEl(row)?.getAttribute('contenteditable') === 'true') return;
      lnBeginEdit(block, { r, c: 0, li });
      return;
    }
    /* ★줄 모드 버블의 «줄 밖»(본체 패딩) 더블클릭도 여기서 막는다 — 안 막으면 일반 핸들러가 .tb-bubble 을 통째로 켠다. */
    if (isBubble && lnBubbleLines(block) && e.target.closest?.('.tb-bubble')) { e.stopPropagation(); e.preventDefault(); }
  }, true);
}

/** Enter 로 편집 들어가기(block-drag.js _enterTextEditMode 의 줄 모드 갈래) — 활성 줄, 없으면 첫 글자 줄. */
export function lnEnterEdit(block) {
  const lines = lnBubbleLines(block);
  if (!lines) return false;
  const act = grdGetActiveLine(block);
  let li = act && Number.isInteger(act.li) && gridLineHasText(lines[act.li]) ? act.li : lines.findIndex(l => gridLineHasText(l));
  if (li < 0) return true;                                    // 글자 줄이 없다 — 통째 편집으로 새지 않게 «먹는다»
  lnBeginEdit(block, { r: 0, c: 0, li });
  return true;
}

/* ══ 단축키 (D10) — 그리드의 줄 단축키와 «같은 뜻» ════════════════════════════ */
function _soleSelectedHost() {
  const sel = [...document.querySelectorAll('.speech-bubble-block.selected, .chat-block.selected')];
  if (sel.length !== 1 || !grdIsSoleSelected(sel[0])) return null;
  return sel[0];
}

/* 단축키가 쓸 «활성 줄» — ★사람이 실제로 고른 것만. (현빈 2026-10-06 「말풍선 블럭 선택후 g 누르면
 * 풍선안에 g 가 추가되는 문제 / 진입 후 g 눌려야 되지않겠니?」)
 *
 * ★무엇이 문제였나(실측 2026-10-06, e7444dd3): 말풍선을 «한 번 클릭»한 것만으로 — editing 없음,
 *   .tb-bubble contenteditable="false", document.activeElement=BODY — grdGetActiveLine 이
 *   {r:0,c:0,li:null} 을 돌려줬다. 그래서 아래 lnAddLineToSelected 의 `if (!addr) return false` 가
 *   ★참이 안 되고 g 가 소진돼, 말풍선이 줄 모드로 바뀌며 여백 줄이 들어가고 안내문구
 *   (data-is-placeholder)가 사라졌다. 전역 갭 블록은 «안» 생겼다(g 갭추가 0).
 *   ★같은 조건에서 다른 블럭 6종(text·chat·table·grid·step·asset)은 모두 갭 +1 로 정상 ⇒ 말풍선 한 자리.
 *
 * ★범인은 contenteditable·포커스·클래스가 아니다(셋 다 「고른 상태」와 「편집 중」을 정확히 가른다).
 *   «활성 줄»이라는 ★넷째 상태였다 — lnAugmentBubblePanel(아래)이 «줄이 없는 말풍선»의 패널에
 *   「＋ 줄 추가」를 띄우려고 그 기본 주소를 세운다. ⛔그 줄을 지우면 버블의 줄 추가가 죽는다.
 *   ⇒ 두 쓰임을 «가른다»: ㉠패널이 그리는 기본 주소(그대로 둔다) ㉡단축키가 쓸 활성 줄(여기).
 *
 * ★둘째 명부를 만들지 «않는다» — 표식을 어딘가 세우고 지우는 대신 DOM 상태에서 ★파생시킨다
 *   (세우는 자리와 지우는 자리가 둘이면 한쪽이 조용히 늙는다).
 *   판정: 말풍선인데 ★줄이 아직 없고 주소가 li:null 이면 = 패널이 세운 기본값 ⇒ «없음».
 * ⚠️챗은 이 갈래에 안 들어간다 — lnAugmentChatPanel 은 기본 주소를 안 세우므로(grdGetActiveLine 그대로)
 *   챗의 「메시지만 고른 상태(li:null)에서 줄 추가」는 ★사람이 고른 것이고 그대로 살아 있어야 한다. */
function _lnPickedLine(block) {
  const addr = grdGetActiveLine(block);
  if (!addr) return null;
  if (block.classList.contains('speech-bubble-block') && !lnBubbleLines(block) && addr.li === null) return null;
  return addr;
}

/** ⌫ — 고른 줄 하나를 지운다. 먹었으면 true. */
export function lnDeleteActiveLine() {
  const block = _soleSelectedHost();
  if (!block) return false;
  const addr = _lnPickedLine(block);
  if (!addr || addr.li === null || addr.li === undefined) return false;
  const host = lnHostFor(block);
  const lines = host.getLines(addr.r);
  const li = Number(addr.li);
  if (!Number.isInteger(li) || li < 0 || li >= lines.length) return true;   // 주소가 낡았다 — 블럭 삭제로 새지 않는다
  const next = lines.filter((_, i) => i !== li);
  const prev = addr;
  grdSetActiveLine(block, next.length ? { r: addr.r, c: 0, li: Math.min(li, next.length - 1) } : null);
  const res = host.commitLines(addr.r, 0, next);
  if (res && res.ok === false) { grdSetActiveLine(block, prev); window.showToast?.('⚠️ 줄 삭제 실패 — ' + (res.message || res.code)); }
  return true;
}
/** T / G — 고른 줄 «다음»에 본문/여백 줄. 챗에서 메시지만 고른 상태(li:null)면 그 메시지 끝에. 먹었으면 true. */
export function lnAddLineToSelected(type) {
  const block = _soleSelectedHost();
  if (!block) return false;
  const addr = _lnPickedLine(block);   // ★«사람이 고른 줄»만 — 줄 없는 말풍선의 기본 주소는 «없음»(위 주석)
  if (!addr) return false;
  const host = lnHostFor(block);
  const spec = type === 'gap' ? { type: 'gap', height: 16 } : { type: 'body', text: '' };
  const res = window.grdAddLine?.(block, { r: addr.r, c: 0 }, addr.li === null ? null : addr.li, spec, {}, host);
  if (res && res.ok) host.show(grdGetActiveLine(block));
  return !!(res && res.ok);
}
/** Esc — 줄 선택만 풀고 블럭은 남긴다(그리드 «상위 선택»과 같은 규칙). 먹었으면 true. */
export function lnEscLine() {
  const block = _soleSelectedHost();
  /* ★_lnPickedLine — 옛 판은 grdGetActiveLine 을 봐서, «줄만 고른 적 없는» 말풍선에서도 Esc 가
     여기서 소진됐다(블럭 선택 해제 대신 「줄 선택 풀기」로 샜다 — 2026-10-06 독해). */
  if (!block || !_lnPickedLine(block)) return false;
  lnHostFor(block).show(null);
  return true;
}

if (typeof window !== 'undefined') {
  Object.assign(window, {
    lnHasLines, lnLinesHtml, lnValidateLines, lnPlainText, lnTextMirrorHtml,
    lnRenderBubble, lnBubbleLines, lnHostFor, lnMark, lnRemark, lnClearAllActive, lnClickAddr,
    lnAugmentBubblePanel, lnAugmentChatPanel, lnBindLineEdit, lnBeginEdit, lnEnterEdit,
    lnDeleteActiveLine, lnAddLineToSelected, lnEscLine,
  });
}
