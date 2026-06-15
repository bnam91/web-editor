/* ══════════════════════════════════════
   AI Image Gen — 모달 UI · 생성 호출 라우터
   - 모드 탭 (텍스트 | 이미지) — 마지막 선택은 localStorage.aiModalLastMode
   - 이미지 모드: 모델 select, picker, 매수, 비용 표시, 생성 → 갤러리 push
   - 공개 API: window.openImageGenModal, closeImageGenModal, generateAIImage
══════════════════════════════════════ */

(function () {
  const KRW_PER_IMAGE = { 'gemini-2.5-flash-image': 54, 'gpt-image-1': 56, 'prompt-only': 0 };
  const ACTION_PROMPTS = {
    outpaint: '주변을 자연스럽게 확장해줘. 원본 영역은 그대로 보존하고, 비어 있는 영역을 자연스럽게 채워줘. 원본의 톤·조명·스타일을 그대로 이어가.',
    cutout:   '이 이미지의 배경을 제거해줘. 누끼따기 — 주요 피사체(인물/제품/오브젝트)만 남기고 배경은 완전히 투명하게 만들어줘. 가장자리는 깔끔하게 정리.',
  };

  // 모달 내부 picker chip 상태: [{ type: 'scratch'|'asset'|'ref', id, src, label }]
  let _pickerChips = [];
  const MAX_CHIPS = 8;
  let _selectedCount = 1;

  function _getProjectId() {
    return new URLSearchParams(window.location.search).get('project') || null;
  }

  function _getModalEls() {
    return {
      overlay:      document.getElementById('ai-prompt-overlay'),
      textPanel:    document.getElementById('aig-text-panel'),
      imagePanel:   document.getElementById('aig-image-panel'),
      modeTabs:     document.querySelectorAll('#aig-mode-tabs .aig-mode-tab'),
      modelSel:     document.getElementById('aig-model-select'),
      imgPrompt:    document.getElementById('aig-image-prompt'),
      pickerChips:  document.getElementById('aig-picker-chips'),
      pickScratch:  document.getElementById('aig-pick-scratch-btn'),
      pickAsset:    document.getElementById('aig-pick-asset-btn'),
      pickRef:      document.getElementById('aig-pick-ref-btn'),
      refInput:     document.getElementById('aig-ref-file-input'),
      countSeg:     document.getElementById('aig-count-seg'),
      costEl:       document.getElementById('aig-cost'),
      preview:      document.getElementById('aig-preview'),
      submitBtn:    document.getElementById('ai-prompt-submit-btn'),
      title:        document.querySelector('#ai-prompt-panel .ai-panel-title'),
      outpaintTgl:  document.getElementById('aig-outpaint-toggle'),
    };
  }

  function _onActionToggle(kind) {
    const outTgl = document.getElementById('aig-outpaint-toggle');
    const cutTgl = document.getElementById('aig-cutout-toggle');
    const promptEl = document.getElementById('aig-image-prompt');
    // mutual exclusive — 켜진 쪽이 아닌 다른 쪽 해제
    if (kind === 'outpaint' && outTgl?.checked && cutTgl) cutTgl.checked = false;
    if (kind === 'cutout'   && cutTgl?.checked && outTgl) outTgl.checked = false;
    // 프롬프트 자동 입력 — 토글 ON일 때만, textarea가 비어있거나 이전 ACTION_PROMPTS 중 하나면 덮어쓰기
    const currentText = (promptEl?.value || '').trim();
    const isStockPrompt = Object.values(ACTION_PROMPTS).some(p => currentText === p);
    if (kind === 'outpaint' && outTgl?.checked) {
      if (!currentText || isStockPrompt) promptEl.value = ACTION_PROMPTS.outpaint;
    }
    if (kind === 'cutout' && cutTgl?.checked) {
      if (!currentText || isStockPrompt) promptEl.value = ACTION_PROMPTS.cutout;
    }
    _syncOutpaint();
  }

  function _syncOutpaint() {
    const els = _getModalEls();
    const on = !!els.outpaintTgl?.checked;
    const exportBtn = document.getElementById('aig-outpaint-export-btn');
    if (!on) {
      window._outpaintHide?.();
      if (exportBtn) exportBtn.style.display = 'none';
      return;
    }
    const scratchChip = _pickerChips.find(c => c.type === 'scratch');
    if (scratchChip) {
      window._outpaintShow?.(scratchChip.id);
      if (exportBtn) exportBtn.style.display = 'inline-block';
    } else {
      window._outpaintHide?.();
      if (exportBtn) exportBtn.style.display = 'none';
      window.showToast?.('⚠️ 확장 모드는 스크래치 1장이 picker에 있어야 작동');
    }
  }

  // 확장 영역을 흰색 불투명으로 합성한 PNG를 다운로드 — 외부 도구(GPT/Photoshop 등)용
  async function _exportOutpaintPng() {
    const box = window._outpaintGetBox?.();
    if (!box?.src) { window.showToast?.('⚠️ 스크래치 이미지 없음'); return; }
    const sumPad = box.padTop + box.padRight + box.padBottom + box.padLeft;
    if (sumPad === 0) { window.showToast?.('⚠️ 확장 영역 0 — 핸들로 늘려주세요'); return; }
    const img = await new Promise((res, rej) => { const i = new Image(); i.onload = () => res(i); i.onerror = rej; i.src = box.src; });
    const ow = img.naturalWidth, oh = img.naturalHeight;
    const scale = box.origW > 0 ? ow / box.origW : 1;
    const pt = Math.round(box.padTop    * scale);
    const pr = Math.round(box.padRight  * scale);
    const pb = Math.round(box.padBottom * scale);
    const pl = Math.round(box.padLeft   * scale);
    const w = ow + pl + pr, h = oh + pt + pb;
    const cv = document.createElement('canvas');
    cv.width = w; cv.height = h;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#fff';
    ctx.fillRect(0, 0, w, h);
    ctx.drawImage(img, pl, pt);
    cv.toBlob(blob => {
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outpaint_${box.spId}_${w}x${h}.png`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      window.showToast?.(`⬇ ${w}×${h} 확장 PNG 저장됨 (확장 영역 흰색)`);
    }, 'image/png');
  }
  window._aigExportOutpaintPng = _exportOutpaintPng;

  function _currentMode() {
    const active = document.querySelector('#aig-mode-tabs .aig-mode-tab.active');
    return active?.dataset.modeTab || 'text';
  }

  function _setMode(mode) {
    const els = _getModalEls();
    els.modeTabs.forEach(t => t.classList.toggle('active', t.dataset.modeTab === mode));
    if (els.textPanel)  els.textPanel.style.display  = mode === 'text'  ? '' : 'none';
    if (els.imagePanel) els.imagePanel.style.display = mode === 'image' ? '' : 'none';
    try { localStorage.setItem('aiModalLastMode', mode); } catch (_) {}
    _updateCost();
  }

  function _updateCost() {
    const els = _getModalEls();
    if (!els.costEl) return;
    const model = els.modelSel?.value || 'gemini-2.5-flash-image';
    const apiMode = document.querySelector('input[name="aig-api-mode"]:checked')?.value || 'direct';
    if (apiMode === 'promptOnly' || model === 'prompt-only') {
      els.costEl.textContent = '예상 비용: ₩0 (프롬프트만 복사)';
      return;
    }
    const unit = KRW_PER_IMAGE[model] ?? 0;
    els.costEl.textContent = `예상 비용: ~₩${unit} × ${_selectedCount}장 = ₩${unit * _selectedCount}`;
  }

  function _renderChips() {
    const els = _getModalEls();
    if (!els.pickerChips) return;
    els.pickerChips.innerHTML = '';
    if (_pickerChips.length === 0) {
      const hint = document.createElement('div');
      hint.style.cssText = 'font-size:11px;color:var(--ui-text-sub,#888);padding:4px;';
      hint.textContent = '(참고 이미지 없음 — 텍스트만으로 생성)';
      els.pickerChips.appendChild(hint);
      return;
    }
    _pickerChips.forEach((chip, idx) => {
      const el = document.createElement('div');
      el.className = 'aig-chip';
      if (chip.type === 'scratch') el.dataset.spId = chip.id;
      else if (chip.type === 'asset') el.dataset.abId = chip.id;
      else if (chip.type === 'ref') el.dataset.refId = chip.id;
      if (chip.src) {
        el.style.backgroundImage = `url("${chip.src}")`;
      } else {
        el.textContent = chip.label || chip.id;
      }
      const lbl = document.createElement('span');
      lbl.className = 'aig-chip-label';
      lbl.textContent = chip.type === 'scratch' ? 'sp' : chip.type === 'asset' ? 'ab' : 'ref';
      el.appendChild(lbl);
      const x = document.createElement('button');
      x.className = 'aig-chip-x';
      x.textContent = '×';
      x.type = 'button';
      x.addEventListener('click', e => {
        e.stopPropagation();
        _pickerChips.splice(idx, 1);
        _renderChips();
      });
      el.appendChild(x);
      els.pickerChips.appendChild(el);
    });
    // outpaint mode가 켜져있으면 chip 변경에 맞춰 overlay 동기화
    if (document.getElementById('aig-outpaint-toggle')?.checked) _syncOutpaint();
  }

  function _openScratchPopover(anchorBtn) {
    // 기존 popover 제거
    document.querySelectorAll('.aig-popover').forEach(p => p.remove());
    const pop = document.createElement('div');
    pop.className = 'aig-popover';
    const rect = anchorBtn.getBoundingClientRect();
    pop.style.left = `${rect.left}px`;
    pop.style.top  = `${rect.bottom + 4}px`;
    const title = document.createElement('div');
    title.className = 'aig-popover-title';
    title.textContent = '스크래치에서 선택';
    pop.appendChild(title);
    // 현재 스크래치 항목 — _scratchGetItemById는 단건 조회만 노출, 직접 DOM scan
    const items = [...document.querySelectorAll('.scratch-item')].map(el => {
      const img = el.querySelector('img');
      const idChip = el.querySelector('.scratch-id-chip');
      // ID 추출 — chip 텍스트의 '#sp_xxx' 또는 데이터 속성
      const idText = (idChip?.textContent || '').trim().replace(/^#/, '');
      let id = idText;
      // 백업: window._scratchGetItemById 활용 안 함 — 직접 src/id 매핑
      return { id, src: img?.src || '' };
    }).filter(it => it.id && it.src);
    if (items.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'aig-popover-empty';
      empty.textContent = '스크래치 패드가 비어있습니다.';
      pop.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'aig-popover-grid';
      items.forEach(it => {
        const cell = document.createElement('div');
        cell.className = 'aig-popover-cell';
        cell.style.backgroundImage = `url("${it.src}")`;
        cell.title = it.id;
        cell.addEventListener('click', () => {
          if (_pickerChips.length >= MAX_CHIPS) { window.showToast?.(`⚠️ 최대 ${MAX_CHIPS}개까지`); return; }
          if (_pickerChips.some(c => c.type === 'scratch' && c.id === it.id)) { window.showToast?.('이미 추가됨'); return; }
          _pickerChips.push({ type: 'scratch', id: it.id, src: it.src, label: it.id });
          _renderChips();
          pop.remove();
        });
        grid.appendChild(cell);
      });
      pop.appendChild(grid);
    }
    document.body.appendChild(pop);
    // 바깥 클릭 시 닫기
    setTimeout(() => {
      const close = (ev) => {
        if (!pop.contains(ev.target) && ev.target !== anchorBtn) {
          pop.remove();
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 50);
  }

  function _openAssetPopover(anchorBtn) {
    document.querySelectorAll('.aig-popover').forEach(p => p.remove());
    const pop = document.createElement('div');
    pop.className = 'aig-popover';
    const rect = anchorBtn.getBoundingClientRect();
    pop.style.left = `${rect.left}px`;
    pop.style.top  = `${rect.bottom + 4}px`;
    const title = document.createElement('div');
    title.className = 'aig-popover-title';
    title.textContent = '캔버스 에셋 블록에서 선택';
    pop.appendChild(title);
    const blocks = [...document.querySelectorAll('.asset-block')].map(el => {
      const img = el.querySelector('.asset-img');
      return { id: el.id, src: img?.src || el.dataset.imgSrc || '', el };
    }).filter(it => it.id && it.src);
    if (blocks.length === 0) {
      const empty = document.createElement('div');
      empty.className = 'aig-popover-empty';
      empty.textContent = '캔버스에 이미지가 들어간 에셋 블록이 없습니다.';
      pop.appendChild(empty);
    } else {
      const grid = document.createElement('div');
      grid.className = 'aig-popover-grid';
      blocks.forEach(it => {
        const cell = document.createElement('div');
        cell.className = 'aig-popover-cell';
        cell.style.backgroundImage = `url("${it.src}")`;
        cell.title = it.id;
        cell.addEventListener('click', () => {
          if (_pickerChips.length >= MAX_CHIPS) { window.showToast?.(`⚠️ 최대 ${MAX_CHIPS}개까지`); return; }
          if (_pickerChips.some(c => c.type === 'asset' && c.id === it.id)) { window.showToast?.('이미 추가됨'); return; }
          _pickerChips.push({ type: 'asset', id: it.id, src: it.src, label: it.id });
          _renderChips();
          pop.remove();
        });
        grid.appendChild(cell);
      });
      pop.appendChild(grid);
    }
    document.body.appendChild(pop);
    setTimeout(() => {
      const close = (ev) => {
        if (!pop.contains(ev.target) && ev.target !== anchorBtn) {
          pop.remove();
          document.removeEventListener('mousedown', close);
        }
      };
      document.addEventListener('mousedown', close);
    }, 50);
  }

  function _addReferenceFiles(fileList) {
    const files = [...(fileList || [])].filter(f => f.type.startsWith('image/'));
    if (files.length === 0) return;
    let added = 0;
    files.forEach(file => {
      if (_pickerChips.length >= MAX_CHIPS) {
        window.showToast?.(`⚠️ 최대 ${MAX_CHIPS}개까지`);
        return;
      }
      const reader = new FileReader();
      reader.onload = (ev) => {
        const id = 'ref_' + Math.random().toString(36).slice(2, 8);
        _pickerChips.push({ type: 'ref', id, src: ev.target.result, label: file.name });
        _renderChips();
      };
      reader.readAsDataURL(file);
      added++;
    });
    if (added > 0) window.showToast?.(`📎 레퍼런스 ${added}장 추가`);
  }

  function _resetImageModalState() {
    _pickerChips = [];
    _selectedCount = 1;
    const els = _getModalEls();
    if (els.imgPrompt) els.imgPrompt.value = '';
    if (els.preview) { els.preview.innerHTML = ''; els.preview.style.display = 'none'; }
    _refreshCountUI();
    _renderChips();
    _updateCost();
  }

  function _refreshCountUI() {
    const num = document.getElementById('aig-count-num');
    if (num) num.textContent = String(_selectedCount);
    document.querySelectorAll('.aig-count-step').forEach(b => {
      if (b.dataset.action === 'dec') b.disabled = _selectedCount <= 1;
      if (b.dataset.action === 'inc') b.disabled = _selectedCount >= 4;
    });
  }

  function _renderChipsAndSync() {
    _renderChips();
    _syncOutpaint();
  }

  function _bindModalOnce() {
    const els = _getModalEls();
    if (!els.overlay || els.overlay.dataset.aigBound) return;
    els.overlay.dataset.aigBound = '1';

    els.modeTabs.forEach(t => t.addEventListener('click', () => _setMode(t.dataset.modeTab)));
    els.modelSel?.addEventListener('change', () => {
      try { localStorage.setItem('aiImageModel', els.modelSel.value); } catch (_) {}
      _updateCost();
    });
    // model select localStorage 복원
    try {
      const saved = localStorage.getItem('aiImageModel');
      if (saved && [...els.modelSel.options].some(o => o.value === saved)) els.modelSel.value = saved;
    } catch (_) {}

    document.querySelectorAll('input[name="aig-api-mode"]').forEach(r => {
      r.addEventListener('change', _updateCost);
    });

    els.pickScratch?.addEventListener('click', e => {
      e.stopPropagation();
      _openScratchPopover(els.pickScratch);
    });
    els.pickAsset?.addEventListener('click', e => {
      e.stopPropagation();
      _openAssetPopover(els.pickAsset);
    });
    els.pickRef?.addEventListener('click', () => els.refInput?.click());
    els.refInput?.addEventListener('change', e => _addReferenceFiles(e.target.files));

    // Drag & drop on chips area
    if (els.pickerChips) {
      els.pickerChips.addEventListener('dragover', e => {
        if (e.dataTransfer?.types?.includes('Files')) {
          e.preventDefault();
          els.pickerChips.classList.add('aig-dropzone-hover');
        }
      });
      els.pickerChips.addEventListener('dragleave', () => {
        els.pickerChips.classList.remove('aig-dropzone-hover');
      });
      els.pickerChips.addEventListener('drop', e => {
        e.preventDefault();
        els.pickerChips.classList.remove('aig-dropzone-hover');
        if (e.dataTransfer?.files?.length) _addReferenceFiles(e.dataTransfer.files);
      });
    }

    els.countSeg?.addEventListener('click', e => {
      const step = e.target.closest('.aig-count-step');
      if (!step) return;
      const delta = step.dataset.action === 'inc' ? 1 : -1;
      _selectedCount = Math.min(4, Math.max(1, _selectedCount + delta));
      _refreshCountUI();
      _updateCost();
    });

    els.outpaintTgl?.addEventListener('change', () => _onActionToggle('outpaint'));
    document.getElementById('aig-cutout-toggle')?.addEventListener('change', () => _onActionToggle('cutout'));

    // 프롬프트 복사 버튼
    document.getElementById('aig-prompt-copy-btn')?.addEventListener('click', async () => {
      const text = document.getElementById('aig-image-prompt')?.value || '';
      if (!text.trim()) { window.showToast?.('⚠️ 복사할 프롬프트 없음'); return; }
      try {
        if (window.electronAPI?.clipboardWriteText) {
          const r = await window.electronAPI.clipboardWriteText(text);
          if (!r?.ok) throw new Error(r?.error || 'IPC 실패');
        } else if (navigator.clipboard?.writeText) {
          await navigator.clipboard.writeText(text);
        } else {
          throw new Error('클립보드 API 없음');
        }
        window.showToast?.('📋 프롬프트 복사됨');
      } catch (err) {
        window.showToast?.('❌ 복사 실패: ' + err.message);
      }
    });

    _renderChips();
  }

  function openImageGenModal(opts = {}) {
    const els = _getModalEls();
    _bindModalOnce();
    if (els.overlay) els.overlay.style.display = 'flex';
    window._restoreAiPanelPos?.();
    // mode 결정 — opts > localStorage > 'text'
    let mode = opts.mode || null;
    if (!mode) {
      try { mode = localStorage.getItem('aiModalLastMode') || 'text'; } catch (_) { mode = 'text'; }
    }
    _setMode(mode);
    if (opts.prefillPrompt) {
      if (mode === 'image' && els.imgPrompt) els.imgPrompt.value = opts.prefillPrompt;
      else if (els.overlay.querySelector('#ai-prompt-textarea')) {
        els.overlay.querySelector('#ai-prompt-textarea').value = opts.prefillPrompt;
      }
    }
    setTimeout(() => {
      if (mode === 'image') els.imgPrompt?.focus();
      else document.getElementById('ai-prompt-textarea')?.focus();
    }, 50);
  }

  function closeImageGenModal() {
    const els = _getModalEls();
    if (els.overlay) els.overlay.style.display = 'none';
    _resetImageModalState();
    document.querySelectorAll('.aig-popover').forEach(p => p.remove());
    window._outpaintHide?.();
    if (els.outpaintTgl) els.outpaintTgl.checked = false;
    const cutTgl = document.getElementById('aig-cutout-toggle');
    if (cutTgl) cutTgl.checked = false;
    // 텍스트 모드 textarea 클리어는 closeAiPrompt가 처리
  }

  async function generateAIImage(payload) {
    const projectId = _getProjectId();
    const apiMode = payload?.apiMode || 'direct';
    const model = payload?.model || 'gemini-2.5-flash-image';
    const count = Math.max(1, Math.min(4, parseInt(payload?.count) || 1));
    const prompt = String(payload?.prompt || '').trim();
    const inputs = payload?.inputs || { scratchIds: [], assetBlockIds: [], refDataUrls: [] };

    // ref 이미지 src 수집
    const refs = [];
    for (const sid of (inputs.scratchIds || [])) {
      const it = window._scratchGetItemById?.(sid);
      if (it?.src) refs.push({ src: it.src, label: sid });
    }
    for (const aid of (inputs.assetBlockIds || [])) {
      const el = document.getElementById(aid);
      const src = el?.querySelector('.asset-img')?.src || el?.dataset?.imgSrc;
      if (src) refs.push({ src, label: aid });
    }
    for (const r of (inputs.refDataUrls || [])) {
      if (r?.src) refs.push({ src: r.src, label: r.label || 'ref' });
    }

    if (!window.electronAPI?.aiGenerateImage) {
      return { ok: false, error: 'electronAPI 미연결' };
    }
    const res = await window.electronAPI.aiGenerateImage({
      apiMode, model, count, prompt, refs,
      outpaint: payload?.outpaint || null,
    });

    // prompt-only: 클립보드에 결합 프롬프트 복사 + 토스트
    if (apiMode === 'promptOnly' || model === 'prompt-only') {
      if (res?.ok && res.promptCombined && window.electronAPI?.clipboardWriteText) {
        try { await window.electronAPI.clipboardWriteText(res.promptCombined); } catch (_) {}
        window.showToast?.('📋 프롬프트가 클립보드에 복사됨');
      }
      return { ok: true, items: [], cost: { tokens: 0, krwApprox: 0 } };
    }

    if (!res?.ok) {
      window.showToast?.('❌ ' + (res?.error || '생성 실패'));
      return { ok: false, error: res?.error || '생성 실패' };
    }

    // 디스크 저장 + state.imageGallery push
    if (!projectId) {
      window.showToast?.('❌ projectId 없음 — 저장 불가');
      return { ok: false, error: 'projectId 없음' };
    }
    // H7/STATE-02: 생성(await) 동안 사용자가 다른 프로젝트로 전환했는지 감지.
    // blob은 캡처된 projectId로 저장되지만, 아래 갤러리 push가 라이브 window.state(=전환된 B)에
    // 들어가면 B 갤러리가 오염되고 캡처 A는 blob만 남아 갤러리 엔트리가 유실된다.
    const switchedAway = _getProjectId() !== projectId;
    const capturedItems = [];
    const items = [];
    const now = new Date().toISOString();
    const referenceMode = refs.length >= 2 ? 'composite' : 'single';
    for (const img of (res.items || [])) {
      const saveRes = await window.electronAPI.aiSaveImage({ projectId, b64: img.b64, mime: img.mime });
      if (!saveRes?.ok) continue;
      const dataUrl = `data:${img.mime};base64,${img.b64}`;
      window._aiImgCache?.set(saveRes.id, dataUrl);
      const galleryItem = {
        id: saveRes.id,
        createdAt: now,
        prompt,
        negativePrompt: null,
        model,
        size: { w: 1024, h: 1024 },
        count,
        sourceInputs: {
          scratchIds: inputs.scratchIds || [],
          assetBlockIds: inputs.assetBlockIds || [],
          refCount: (inputs.refDataUrls || []).length,
          referenceMode,
        },
        blobPath: saveRes.blobPath,
        mime: saveRes.mime || 'image/png',
        cost: {
          tokens: Math.round((res.cost?.tokens || 0) / Math.max(1, res.items.length)),
          krwApprox: Math.round((res.cost?.krwApprox || 0) / Math.max(1, res.items.length)),
        },
        favorite: false,
      };
      if (switchedAway) {
        // 캡처된 A 파일에 직접 적재 (라이브 B state 미접촉)
        capturedItems.push(galleryItem);
      } else {
        window.state.imageGallery = window.state.imageGallery || [];
        window.state.imageGallery.push(galleryItem);
      }
      items.push({ id: saveRes.id, dataUrl, blobPath: saveRes.blobPath });
    }
    if (switchedAway) {
      // 전환 감지: 캡처 프로젝트 파일에 갤러리 엔트리를 직접 병합 (라이브 화면/저장 미오염)
      await _appendGalleryToProject(projectId, capturedItems);
      window.showToast?.(`✨ ${items.length}장 생성 — 생성 시작한 프로젝트에 저장됨 (다른 프로젝트로 전환되어 현재 화면엔 미표시)`);
      return { ok: true, items, cost: res.cost };
    }
    window.buildAIImageGallery?.();
    window.triggerAutoSave?.();
    window.showToast?.(`✨ ${items.length}장 생성 완료 (₩${res.cost?.krwApprox || 0})`);
    return { ok: true, items, cost: res.cost };
  }

  // H7: 생성 중 프로젝트 전환 시, 캡처된 원래 프로젝트의 파일에 갤러리 엔트리를 직접 병합한다.
  // 라이브 window.state(전환된 다른 프로젝트)를 건드리지 않아 오염을 막는다.
  async function _appendGalleryToProject(pid, newItems) {
    if (!pid || !newItems?.length) return;
    try {
      const existing = await window.electronAPI.loadProject(pid);
      if (!existing) return;
      existing.imageGallery = Array.isArray(existing.imageGallery) ? existing.imageGallery : [];
      existing.imageGallery.push(...newItems);
      await window.electronAPI.saveProject(existing);
    } catch (e) {
      console.warn('[ai-image-gen] H7 캡처 프로젝트 갤러리 적재 실패:', e);
    }
  }

  // 모달 내부 submit 라우터를 위한 헬퍼 — ai-prompt.js에서 호출
  async function _composeOutpaintPayload(box) {
    if (!box?.src) return null;
    const { src, padTop, padRight, padBottom, padLeft } = box;
    // origW/H는 box의 값이 아니라 현재 자연 이미지 크기 사용 — 합성 정확도
    const img = await new Promise((resolve, reject) => {
      const i = new Image();
      i.onload = () => resolve(i);
      i.onerror = reject;
      i.src = src;
    });
    const ow = img.naturalWidth;
    const oh = img.naturalHeight;
    // 화면 픽셀(offset)과 자연 픽셀 비율 보정
    const scale = box.origW > 0 ? ow / box.origW : 1;
    const pt = Math.round(padTop * scale);
    const pr = Math.round(padRight * scale);
    const pb = Math.round(padBottom * scale);
    const pl = Math.round(padLeft * scale);
    const w = ow + pl + pr;
    const h = oh + pt + pb;
    // 1) 확장 캔버스 — 원본은 (pl, pt) 위치, 나머지 투명
    const cv1 = document.createElement('canvas');
    cv1.width = w; cv1.height = h;
    const ctx1 = cv1.getContext('2d');
    ctx1.drawImage(img, pl, pt);
    const imageDataUrl = cv1.toDataURL('image/png');
    // 2) mask — 원본 영역 검정 불투명, 나머지 투명 (OpenAI: alpha=0 → 생성, alpha>0 → 보존)
    const cv2 = document.createElement('canvas');
    cv2.width = w; cv2.height = h;
    const ctx2 = cv2.getContext('2d');
    ctx2.fillStyle = '#000';
    ctx2.fillRect(pl, pt, ow, oh);
    const maskDataUrl = cv2.toDataURL('image/png');
    return { imageDataUrl, maskDataUrl, w, h };
  }

  async function handleImageSubmit() {
    const els = _getModalEls();
    let model = els.modelSel?.value || 'gemini-2.5-flash-image';
    const apiMode = document.querySelector('input[name="aig-api-mode"]:checked')?.value || 'direct';
    const isOutpaint = !!els.outpaintTgl?.checked;
    let prompt = els.imgPrompt?.value.trim() || '';
    if (isOutpaint && !prompt) prompt = '주변을 자연스럽게 확장해줘. 원본 영역은 그대로 보존.';
    if (!prompt && _pickerChips.length === 0) {
      window.showToast?.('⚠️ 프롬프트나 참고 이미지를 입력하세요.');
      return;
    }
    // outpaint이면 모델 그대로 사용 (Gemini는 합성 이미지+프롬프트로 시도)
    let outpaint = null;
    if (isOutpaint) {
      const box = window._outpaintGetBox?.();
      if (!box) { window.showToast?.('⚠️ 확장 박스 없음'); return; }
      const sumPad = box.padTop + box.padRight + box.padBottom + box.padLeft;
      if (sumPad === 0) { window.showToast?.('⚠️ 확장 영역이 0 — 핸들로 늘려주세요'); return; }
      outpaint = await _composeOutpaintPayload(box);
      if (!outpaint) { window.showToast?.('⚠️ outpaint 합성 실패'); return; }
    }

    const scratchIds = _pickerChips.filter(c => c.type === 'scratch').map(c => c.id);
    const assetBlockIds = _pickerChips.filter(c => c.type === 'asset').map(c => c.id);
    const refDataUrls = _pickerChips.filter(c => c.type === 'ref').map(c => ({ src: c.src, label: c.label }));

    els.submitBtn.disabled = true;
    const originalLabel = els.submitBtn.innerHTML;
    els.submitBtn.innerHTML = '<span class="ai-spinner"></span> 생성 중...';
    try {
      const res = await generateAIImage({
        inputs: { scratchIds, assetBlockIds, refDataUrls },
        prompt, model, count: _selectedCount, apiMode,
        outpaint,
      });
      if (res?.ok && (res.items?.length || 0) > 0) {
        // preview row 표시
        if (els.preview) {
          els.preview.innerHTML = '';
          els.preview.style.display = 'flex';
          res.items.forEach(it => {
            const cell = document.createElement('div');
            cell.className = 'aig-preview-cell';
            cell.style.backgroundImage = `url("${it.dataUrl}")`;
            els.preview.appendChild(cell);
          });
        }
      }
    } finally {
      els.submitBtn.disabled = false;
      els.submitBtn.innerHTML = originalLabel;
    }
  }

  window.openImageGenModal  = openImageGenModal;
  window.closeImageGenModal = closeImageGenModal;
  window.generateAIImage    = generateAIImage;
  window._aigPrePickScratch = (id, src, opts = {}) => {
    if (!id || !src) return;
    if (_pickerChips.length >= MAX_CHIPS) { window.showToast?.(`⚠️ 최대 ${MAX_CHIPS}개까지`); return; }
    const exists = _pickerChips.some(c => c.type === 'scratch' && c.id === id);
    if (!exists) _pickerChips.push({ type: 'scratch', id, src, label: id });
    _renderChips();
    if (opts.autoOutpaint !== false) {
      const tgl = document.getElementById('aig-outpaint-toggle');
      if (tgl) { tgl.checked = true; _syncOutpaint(); }
    }
  };
  window._aigHandleImageSubmit = handleImageSubmit;
  window._aigCurrentMode = _currentMode;
})();
