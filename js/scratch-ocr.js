/* ══════════════════════════════════════
   Scratch OCR — 스크래치 ✨ → AI 패널 「글자 추출 (OCR)」 (시트 33 1020t2a1 · 시안 v3 sian-14)
   - ✨ 로 열면 「글자 추출」 탭만 켜지고 텍스트 생성·이미지 생성은 «기능 대기»(disabled)
   - 기록은 그 이미지 항목의 `ocr` 칸(js/scratch-pad.js SCRATCH_ITEM_KEYS)에 붙는다
     ⇒ 이미지를 바꿔 고르면 그 이미지의 기록만 · 이미지를 지우면 기록도 같이 사라진다(현빈 Q9 261027)
   - 기록 한 건: { id, n, text, at, model, mode } — 그 자리에서 고칠 수 있다
   - 아직 안 정한 것(현빈 Q2·Q4·Q6·Q8)은 시안 기본값: 새 기록만 펴기 · 새것이 위 · 접힘은 저장 안 함 · 지우기는 ⌘Z 없음
   - 공개: window._scratchOcrOpen(id) · _scratchOcrRetarget(id?) · _scratchOcrReset()
══════════════════════════════════════ */
(function () {
  let _targetId = null;
  const _open = new Set();   // 펴 둔 기록 id(런타임만 — Q4 미정)

  const $ = id => document.getElementById(id);
  const _item = () => (_targetId ? window._scratchItemById?.(_targetId) : null);
  const _isShown = () => $('aig-ocr-panel')?.style.display !== 'none' && $('ai-prompt-overlay')?.style.display !== 'none';
  const _modeLabel = m => (m === 'layout' ? '줄·표까지' : '글자만');
  const _hhmm = t => { const d = new Date(t); return String(d.getHours()).padStart(2, '0') + ':' + String(d.getMinutes()).padStart(2, '0'); };
  const _title = r => '#' + r.n + ' · ' + ((r.text || '').split('\n').find(l => l.trim()) || '(빈 글)').slice(0, 40);

  function _saved(item) {
    window._scratchOcrBadge?.(item.id);
    window._scratchSaveSoon?.();
  }

  function _lockTabs(on) {
    const tabs = $('aig-mode-tabs');
    if (!tabs) return;
    tabs.classList.toggle('ocr-only', on);
    tabs.querySelectorAll('.aig-mode-tab').forEach(t => {
      const isOcr = t.dataset.modeTab === 'ocr';
      t.disabled = on && !isOcr;
      if (isOcr) t.style.display = on ? '' : 'none';
    });
  }

  function _recEl(item, r) {
    const wrap = document.createElement('div');
    wrap.className = 'ocr-rec' + (_open.has(r.id) ? ' open' : '');
    wrap.dataset.ocrId = r.id;

    const head = document.createElement('button');
    head.type = 'button';
    head.className = 'ocr-rec-head';
    const caret = document.createElement('span'); caret.className = 'ocr-caret'; caret.textContent = _open.has(r.id) ? '▼' : '▶';
    const title = document.createElement('span'); title.className = 'ocr-rec-title'; title.textContent = _title(r);
    const time = document.createElement('span'); time.className = 'ocr-rec-time'; time.textContent = _hhmm(r.at);
    head.append(caret, title, time);
    head.addEventListener('click', () => { _open.has(r.id) ? _open.delete(r.id) : _open.add(r.id); render(); });

    const body = document.createElement('div');
    body.className = 'ocr-rec-body';
    const text = document.createElement('div');
    text.className = 'ocr-rec-text';
    text.contentEditable = 'plaintext-only';
    text.textContent = r.text || '';
    text.addEventListener('keydown', e => e.stopPropagation());   // 에디터 단축키(Delete 등)가 글 고치기를 가로채지 않게
    text.addEventListener('input', () => { r.text = text.innerText; title.textContent = _title(r); _saved(item); });

    const btns = document.createElement('div');
    btns.className = 'ocr-rec-btns';
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ocr-mini-btn'; b.textContent = label; b.addEventListener('click', fn); btns.appendChild(b); };
    mk('복사', async () => {
      try { await navigator.clipboard.writeText(r.text || ''); window.showToast?.('📋 복사했습니다'); }
      catch (_) { window.showToast?.('❌ 복사 실패'); }
    });
    mk('섹션으로', () => {
      if (typeof window.addTextBlock !== 'function') { window.showToast?.('❌ 텍스트 블록을 넣을 수 없습니다'); return; }
      // 한 줄 = 블록 하나(글자만 모드는 덩어리마다 줄을 바꾼다). ⌘Z 한 번에 다 빠지게 앞뒤 표본만 찍는다.
      const lines = (r.text || '').split('\n').map(s => s.trim()).filter(Boolean);
      if (!lines.length) return;
      const count = () => document.querySelectorAll('.text-block').length;
      const c0 = count();
      window.pushHistory?.();
      const origPush = window.pushHistory;
      window.pushHistory = () => {};
      try { lines.forEach(line => window.addTextBlock('body', { content: line })); }
      finally { window.pushHistory = origPush; }
      const added = count() - c0;   // 섹션을 안 골랐으면 addTextBlock 이 안내만 띄우고 안 넣는다
      if (!added) return;
      window.pushHistory?.();
      window.showToast?.(`✅ 텍스트 블록 ${added}개를 넣었습니다`);
    });
    mk('지우기', () => {
      // 전제: 지금 보는 이미지의 기록 목록 안에 «그 한 건»이 있을 때만 지운다
      const list = item.ocr;
      const i = Array.isArray(list) ? list.indexOf(r) : -1;
      if (i < 0 || item !== _item()) { window.showToast?.('⚠️ 기록을 찾지 못해 지우지 않았습니다'); return; }
      list.splice(i, 1);
      if (!list.length) item.ocr = undefined;   // 빈 칸은 저장본에 안 남긴다(옛 항목과 같은 바이트)
      _open.delete(r.id);
      _saved(item);
      render();
    });

    const meta = document.createElement('div');
    meta.className = 'ocr-rec-meta';
    meta.textContent = (r.model || '') + ' · ' + _modeLabel(r.mode);

    body.append(text, btns, meta);
    wrap.append(head, body);
    return wrap;
  }

  function render() {
    const item = _item();
    const idTxt = _targetId ? '#' + _targetId : '';
    $('ocr-target-id').textContent = item ? idTxt : idTxt + ' (지워진 이미지)';
    $('ocr-log-id').textContent = idTxt;
    const thumb = $('ocr-target-thumb');
    if (item) thumb.src = item.src; else thumb.removeAttribute('src');
    $('ocr-run-btn').disabled = !item;
    const recs = (item && Array.isArray(item.ocr)) ? item.ocr : [];
    $('ocr-log-count').textContent = String(recs.length);
    const fold = $('ocr-collapse-all');
    const anyOpen = recs.some(r => _open.has(r.id));
    fold.style.display = recs.length ? '' : 'none';
    fold.classList.toggle('is-folded', !anyOpen);
    fold.title = anyOpen ? '전부 접기' : '전부 펴기';
    const log = $('ocr-log');
    log.innerHTML = '';
    if (!item) {
      log.textContent = '이미지가 지워져 그 기록도 같이 사라졌습니다.';
    } else if (!recs.length) {
      log.textContent = '추출한 글이 없습니다.';
    } else {
      [...recs].reverse().forEach(r => log.appendChild(_recEl(item, r)));   // 새것이 위(Q8 기본)
    }
  }

  async function _run() {
    const item = _item();
    if (!item) return;
    if (!window.electronAPI?.aiOcrImage) { window.showToast?.('❌ OCR 을 부를 수 없습니다 (preload)'); return; }
    const btn = $('ocr-run-btn');
    const model = $('ocr-model-select')?.value || 'gemini-2.5-flash';
    const mode = document.querySelector('input[name="ocr-mode"]:checked')?.value || 'text';
    btn.disabled = true;
    btn.textContent = '읽는 중…';
    try {
      const imageDataUrl = await window._scratchPngDataUrlById(item.id);
      const res = await window.electronAPI.aiOcrImage({ imageDataUrl, mode, model });
      if (!res?.ok) { window.showToast?.('❌ 글자 추출 실패: ' + (res?.error || '알 수 없음')); return; }
      if (!res.text) { window.showToast?.('이 이미지에서 글자를 찾지 못했습니다'); return; }
      if (!window._scratchItemById?.(item.id)) return;   // 읽는 사이 이미지가 지워졌다 — 붙일 자리가 없다
      const list = Array.isArray(item.ocr) ? item.ocr : (item.ocr = []);
      const n = list.reduce((m, r) => Math.max(m, r.n || 0), 0) + 1;
      const rec = { id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n, text: res.text, at: Date.now(), model: res.model || model, mode };
      list.push(rec);
      _open.clear(); _open.add(rec.id);   // 새 기록만 펴고 나머지는 접는다(Q2 기본)
      _saved(item);
    } catch (e) {
      window.showToast?.('❌ 글자 추출 실패: ' + e.message);
    } finally {
      btn.textContent = '글자 추출';
      if (_targetId === item.id) render(); else btn.disabled = !_item();
    }
  }

  window._scratchOcrOpen = (id) => {
    if (!id || !window._scratchItemById?.(id)) return;
    _targetId = id;
    _open.clear();
    window.openImageGenModal?.({ mode: 'ocr' });
    _lockTabs(true);
    render();
  };
  // 다른 이미지를 고르면 그 이미지의 기록으로 · 인자 없이 부르면 다시 그리기(지운 뒤)
  window._scratchOcrRetarget = (id) => {
    if (!_targetId || !_isShown()) return;
    if (id && id !== _targetId) { _targetId = id; _open.clear(); }
    render();
  };
  window._scratchOcrReset = () => { _targetId = null; _open.clear(); _lockTabs(false); };

  document.addEventListener('DOMContentLoaded', () => {
    $('ocr-run-btn')?.addEventListener('click', _run);
    $('ocr-collapse-all')?.addEventListener('click', () => {
      const recs = _item()?.ocr || [];
      if (recs.some(r => _open.has(r.id))) _open.clear(); else recs.forEach(r => _open.add(r.id));
      render();
    });
  });
  // Esc = 닫기. ai-prompt.js 의 Esc 는 textarea 안에서만 듣는데 OCR 패널엔 textarea 가 없다.
  // capture 라 editor.js 의 Esc(선택 풀기)보다 먼저 받고 소진한다. 기록 글 고치는 중엔 안 닫는다.
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape' || !_targetId || !_isShown() || e.target.closest?.('.ocr-rec-text')) return;
    e.stopPropagation();
    window.closeAiPrompt?.();
  }, true);
})();
