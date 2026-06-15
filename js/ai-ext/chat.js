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
