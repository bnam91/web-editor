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

  const STYLES = ['h1', 'h2', 'h3', 'body', 'caption', 'label'];   // addTextBlock 이 받는 유형(js/ai-section-fill.js VALID_STYLES 와 같다)
  const COPY_SVG = '<svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.2"><rect x="4" y="4" width="6.5" height="6.5" rx="1"/><path d="M8 4V2.5a1 1 0 0 0-1-1H2.5a1 1 0 0 0-1 1V7a1 1 0 0 0 1 1H4"/></svg>';
  // 유형이 없는 옛 기록(text 만)은 줄마다 body 로 읽는다
  const _lines = r => (Array.isArray(r.lines) ? r.lines : (r.text || '').split('\n').map(t => t.trim()).filter(Boolean).map(t => ({ style: 'body', text: t })));
  // 렌더러의 navigator.clipboard 는 main.js 가 거절한다 — 앱의 다리(clipboardWriteText)를 쓴다(ai-image-gen.js 와 같은 꼴)
  async function _copy(t) {
    try {
      const r = await window.electronAPI?.clipboardWriteText?.(t);
      if (!r?.ok) throw new Error(r?.error || 'IPC 실패');
      window.showToast?.('📋 복사했습니다');
    } catch (_) { window.showToast?.('❌ 복사 실패'); }
  }

  // 모델이 준 줄 목록을 믿을 수 있는 꼴로만 받는다 — 아니면 undefined(그러면 text 를 body 줄로 읽는다)
  function _cleanLines(v) {
    if (!Array.isArray(v)) return undefined;
    const out = v.filter(l => l && typeof l.text === 'string' && l.text.trim())
      .map(l => ({ style: STYLES.includes(l.style) ? l.style : 'body', text: l.text.trim() }));
    return out.length ? out : undefined;
  }

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
    // 줄마다 [유형 | 글 | 복사] — 유형은 OCR 이 고른 것, 눌러서 바꾼다. 글은 그 자리에서 고친다.
    const rows = document.createElement('div');
    rows.className = 'ocr-lines';
    const lines = _lines(r);
    const sync = () => { r.lines = lines; r.text = lines.map(l => l.text).join('\n'); title.textContent = _title(r); _saved(item); };
    lines.forEach(l => {
      const row = document.createElement('div');
      row.className = 'ai-fill-panel-preview-row ocr-line';
      const st = document.createElement('button');
      st.type = 'button'; st.className = 'ai-fill-panel-preview-style ocr-line-style'; st.textContent = l.style; st.title = '눌러서 유형 바꾸기';
      st.addEventListener('click', () => { l.style = STYLES[(STYLES.indexOf(l.style) + 1) % STYLES.length]; st.textContent = l.style; sync(); });
      const tx = document.createElement('div');
      tx.className = 'ai-fill-panel-preview-text ocr-line-text';
      tx.contentEditable = 'plaintext-only';
      tx.textContent = l.text;
      tx.addEventListener('keydown', e => e.stopPropagation());   // 에디터 단축키(Delete 등)가 글 고치기를 가로채지 않게
      tx.addEventListener('input', () => { l.text = tx.innerText.trim(); sync(); });
      const cp = document.createElement('button');
      cp.type = 'button'; cp.className = 'ocr-line-copy'; cp.title = '이 줄 복사';
      cp.innerHTML = COPY_SVG;
      cp.addEventListener('click', () => _copy(l.text));
      row.append(st, tx, cp);
      rows.appendChild(row);
    });

    const btns = document.createElement('div');
    btns.className = 'ocr-rec-btns';
    const mk = (label, fn) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'ocr-mini-btn'; b.textContent = label; b.addEventListener('click', fn); btns.appendChild(b); };
    mk('전체 복사', () => _copy(lines.map(l => l.text).join('\n')));
    mk('섹션으로', () => _insertLines(lines));
    const linkedSec = window.SPLink?.sectionIdOf?.(item.id);
    if (linkedSec) mk('연결 섹션으로', () => {
      const sec = document.getElementById(linkedSec);
      if (!sec) { window.showToast?.('⚠️ 연결된 섹션을 찾지 못했습니다'); return; }
      window.selectSection?.(sec);
      _insertLines(lines);
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

    body.append(rows, btns, meta);
    wrap.append(head, body);
    return wrap;
  }

  // 줄 하나 = 그 유형의 블록 하나. ⌘Z 한 번에 다 빠지게 앞뒤 표본만 찍는다.
  function _insertLines(all) {
    if (typeof window.addTextBlock !== 'function') { window.showToast?.('❌ 텍스트 블록을 넣을 수 없습니다'); return; }
    const lines = all.filter(l => l.text);
    if (!lines.length) return;
    const count = () => document.querySelectorAll('.text-block').length;
    const c0 = count();
    window.pushHistory?.();
    const origPush = window.pushHistory;
    window.pushHistory = () => {};
    try { lines.forEach(l => window.addTextBlock(l.style, { content: l.text })); }
    finally { window.pushHistory = origPush; }
    const added = count() - c0;   // 섹션을 안 골랐으면 addTextBlock 이 안내만 띄우고 안 넣는다
    if (!added) return;
    window.pushHistory?.();
    window.showToast?.(`✅ 텍스트 블록 ${added}개를 넣었습니다`);
  }

  function render() {
    const item = _item();
    const idTxt = _targetId ? '#' + _targetId : '';
    $('ocr-target-id').textContent = !_targetId ? '스크래치 이미지를 고르세요' : item ? idTxt : idTxt + ' (지워진 이미지)';
    $('ocr-log-id').textContent = idTxt;
    $('aig-ocr-panel').classList.toggle('ocr-empty', !_targetId);   // 대상 없음 — 썸네일·안내·기록 머리를 숨긴다(CSS)
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
    if (!_targetId) {
      log.textContent = '';
    } else if (!item) {
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
      const rec = { id: 'o' + Date.now().toString(36) + Math.random().toString(36).slice(2, 5), n, text: res.text, lines: _cleanLines(res.lines), at: Date.now(), model: res.model || model, mode };
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
    if (!_isShown()) return;
    if (id && id !== _targetId && window._scratchItemById?.(id)) { _targetId = id; _open.clear(); }
    render();
  };
  // 툴바 ✨ 등에서 OCR 탭을 눌러 들어올 때 — 대상이 없으면 지금 골라 둔 스크래치 이미지(하나)를 쓴다
  window._scratchOcrEnter = () => {
    if (!_targetId) {
      const sel = [...document.querySelectorAll('.scratch-item.scratch-selected')];
      _targetId = sel.length === 1 ? sel[0].dataset.scratchId : null;
    }
    render();
  };
  window._scratchOcrReset = () => { _targetId = null; _open.clear(); _lockTabs(false); };

  // 대상 넣기 — 스크래치 ID 면 그 이미지로, 아니면 그 이미지를 스크래치에 «새로 올려» 대상으로(기록은 스크래치 이미지에 붙는다)
  function _target(id) { _targetId = id; _open.clear(); render(); }
  async function _addImage(dataUrl) {
    const r = await window._scratchAddForMcp?.(dataUrl, { width: 400 });
    if (!r?.ok) { window.showToast?.('❌ 스크래치에 올리지 못했습니다' + (r?.message ? ': ' + r.message : '')); return; }
    _target(r.scratchId);
    window.showToast?.(`✅ 스크래치에 올렸습니다 (#${r.scratchId})`);
  }
  const _readFile = f => new Promise((res, rej) => { const fr = new FileReader(); fr.onload = () => res(fr.result); fr.onerror = () => rej(fr.error); fr.readAsDataURL(f); });
  async function _addFiles(files) {
    const f = [...(files || [])].find(x => x.type.startsWith('image/'));
    if (!f) return false;
    if (f.size > 20 * 1024 * 1024) { window.showToast?.('⚠️ 20MB 이하 이미지만 됩니다'); return true; }
    await _addImage(await _readFile(f));
    return true;
  }
  async function _fromText(raw) {
    const t = raw.trim().replace(/^#/, '');
    if (!t) return;
    if (/^sp_[a-z0-9]+$/i.test(t)) {
      if (window._scratchItemById?.(t)) _target(t); else window.showToast?.(`⚠️ 스크래치에 #${t} 가 없습니다`);
      return;
    }
    const r = await window.electronAPI?.aiReadLocalImage?.(t.replace(/^file:\/\//, ''));
    if (!r?.ok) { window.showToast?.('❌ ' + (r?.error || '이미지를 읽지 못했습니다')); return; }
    await _addImage(r.dataUrl);
  }

  document.addEventListener('DOMContentLoaded', () => {
    const inp = $('ocr-src-input'), panel = $('aig-ocr-panel');
    inp?.addEventListener('keydown', e => {
      e.stopPropagation();   // 에디터 단축키가 입력을 가로채지 않게
      if (e.key === 'Enter') { e.preventDefault(); _fromText(inp.value).then(() => { inp.value = ''; }); }
    });
    inp?.addEventListener('paste', async e => {
      if (await _addFiles(e.clipboardData?.files)) e.preventDefault();   // 글이면 그대로 입력란에 붙는다
    });
    panel?.addEventListener('dragover', e => { if ([...(e.dataTransfer?.types || [])].includes('Files')) { e.preventDefault(); panel.classList.add('ocr-drop'); } });
    panel?.addEventListener('dragleave', e => { if (!panel.contains(e.relatedTarget)) panel.classList.remove('ocr-drop'); });
    panel?.addEventListener('drop', async e => {
      panel.classList.remove('ocr-drop');
      if (!e.dataTransfer?.files?.length) return;
      e.preventDefault(); e.stopPropagation();
      if (!(await _addFiles(e.dataTransfer.files))) window.showToast?.('⚠️ 이미지 파일만 됩니다');
    });
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
    if (e.key !== 'Escape' || !_isShown() || e.target.closest?.('.ocr-line-text')) return;
    e.stopPropagation();
    window.closeAiPrompt?.();
  }, true);
})();
