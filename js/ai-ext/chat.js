/* ══════════════════════════════════════
   AI fill 확장 — chat-block 메시지 수 자동 확장
   payload:
     { id: "chb_xxx", messages: [{text, align: "left"|"right"}, ...] }
   동작:
     - chat-block.dataset.messages = JSON.stringify(payload.messages)
     - window.renderChatBlock(chb) 호출
══════════════════════════════════════ */
(function () {
  function _aiApplyExt_chat(sec, ext) {
    if (!sec || !ext || !ext.id) return false;
    const chb = sec.querySelector(`#${CSS.escape(ext.id)}`);
    if (!chb || !chb.classList.contains('chat-block')) return false;
    if (!Array.isArray(ext.messages)) return false;
    /* ★BT2 D4 — 줄이 있는 메시지가 하나라도 있으면 «통째 교체»를 거절한다(교체하면 줄이 사라진다). */
    try {
      if ((JSON.parse(chb.dataset.messages || '[]') || []).some(m => Array.isArray(m && m.lines) && m.lines.length)) {
        console.warn('[ai-ext/chat] 줄이 있는 메시지가 있어 AI 교체를 건너뜁니다:', ext.id);
        return false;
      }
    } catch (_) {}
    const normalized = ext.messages.map(function (m) {
      const align = (m && (m.align === 'left' || m.align === 'right')) ? m.align : 'left';
      return { text: (m && typeof m.text === 'string') ? m.text : '', align: align };
    });
    chb.dataset.messages = JSON.stringify(normalized);
    if (typeof window.renderChatBlock === 'function') {
      window.renderChatBlock(chb);
    }
    return true;
  }
  if (typeof window !== 'undefined') window._aiApplyExt_chat = _aiApplyExt_chat;
})();
