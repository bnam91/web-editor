/* ══════════════════════════════════════════════════════════════════════
   removeBG 플러그인 — 스크래치패드 / 이미지블록의 배경 제거
   ──────────────────────────────────────────────────────────────────────
   ★모델은 «고른다»: 기존 AI 누끼(gemini·openai) 와 remove.bg 전용 API 둘 다.
     기본값은 AI 누끼 그대로다 — 기본값을 바꾸면 기존 사용자의 결과물이 «말없이» 달라지고,
     remove.bg 는 키가 있어야 도는데 그게 기본이면 첫 클릭이 실패로 시작한다.

   ⛔이 파일이 지키는 것 셋
     ⑴ 조용히 실패하지 않는다 — 키가 없으면 «보이게» 말하고 «설정으로 가는 길»을 준다.
     ⑵ 모르고 «외부로 보내지» 않는다 — 모델 고르기에서 remove.bg 줄에 「외부 전송」을 적어 둔다.
        (막는 고지는 두지 않는다 — 이 앱의 AI 누끼도 외부로 보내는데 거기엔 고지가 없다.)
     ⑷ ★#aig-model-select 를 «읽지도 쓰지도» 않는다 — 그건 AI 생성 패널의 공용 select 다.
     ⑶ native alert/confirm 을 쓰지 않는다 — 렌더러를 막는다(template-system.js:156 이 그 사고 자리).
   ══════════════════════════════════════════════════════════════════════ */
(function () {
  'use strict';

  const MODEL_REMOVEBG = 'removebg';
  const MODEL_AI       = 'ai';

  /* ── 대상: 스크래치 아이템 / 이미지블록 ─────────────────────────────
     ★두 대상 모두 ai-image-gen 이 «이미» 수집하는 것과 같은 술어를 쓴다.
       술어가 갈리면 「AI 누끼는 되는데 remove.bg 는 안 되는」 자리가 생긴다. */
  function _pickTarget() {
    // ⑴ 이미지블록이 선택돼 있으면 그것부터 (사용자가 방금 고른 것이 우선)
    const selBlock = document.querySelector('.asset-block.selected, .asset-block.editing');
    if (selBlock) {
      const img = selBlock.querySelector('.asset-img');
      const src = img?.src || selBlock.dataset?.imgSrc;
      if (src) return { kind: 'asset', id: selBlock.id, el: selBlock, img, src };
    }
    // ⑵ 스크래치에서 «선택된» 것
    const selScratch = document.querySelector('.scratch-item.selected');
    if (selScratch?.id) {
      const it = window._scratchGetItemById?.(selScratch.id);
      if (it?.src) return { kind: 'scratch', id: it.id, el: selScratch, src: it.src };
    }
    return null;
  }

  /* ── 이미지 → {b64, mime} ────────────────────────────────────────────
     goya-asset:// 는 그대로 fetch 가 안 되므로 캔버스로 굽는다.
     ⚠️_toDrawableSrc 는 scratch-pad.js 모듈 지역이라 여기선 쓸 수 없다 —
       대신 <img> 로 그려 PNG 로 뽑는다(표시되고 있는 것이 곧 원본이다). */
  function _toB64(src) {
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = () => {
        try {
          const c = document.createElement('canvas');
          c.width = img.naturalWidth; c.height = img.naturalHeight;
          c.getContext('2d').drawImage(img, 0, 0);
          const url = c.toDataURL('image/png');
          resolve({ b64: url.split(',')[1] || '', mime: 'image/png' });
        } catch (e) { reject(e); }
      };
      img.onerror = () => reject(new Error('이미지를 읽지 못했습니다'));
      img.src = src;
    });
  }

  /* ── 패널 껍데기 — ⛔native alert/confirm 금지(렌더러가 멈춘다) ──────
     버튼이 필요한 안내는 토스트로 안 된다(토스트엔 «다음 행동»을 못 넣는다). 작은 패널을 띄운다. */
  function _shell({ title, body }) {
    document.getElementById('rb-notice')?.remove();
    const wrap = document.createElement('div');
    wrap.id = 'rb-notice';
    wrap.style.cssText = 'position:fixed;inset:0;z-index:99999;display:flex;align-items:center;'
      + 'justify-content:center;background:rgba(0,0,0,.5);';
    const box = document.createElement('div');
    box.style.cssText = 'max-width:380px;padding:18px 20px;border-radius:10px;'
      + 'background:var(--ui-bg-elevated,#242424);border:1px solid var(--ui-border,#3a3a3a);'
      + 'color:var(--ui-text,#ddd);font-size:13px;line-height:1.6;box-shadow:0 8px 28px rgba(0,0,0,.5);';
    const h = document.createElement('div');
    h.style.cssText = 'font-weight:700;margin-bottom:8px;font-size:14px;';
    h.textContent = title;
    const p = document.createElement('div');
    p.style.cssText = 'margin-bottom:16px;white-space:pre-line;';
    p.textContent = body;
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;gap:8px;justify-content:flex-end;';
    box.append(h, p, row); wrap.appendChild(box);
    document.body.appendChild(wrap);
    return { wrap, box, row, close: () => wrap.remove() };
  }

  const _BTN_PLAIN = 'padding:6px 12px;border-radius:6px;cursor:pointer;'
    + 'background:var(--ui-bg-input,#2e2e2e);color:inherit;border:1px solid var(--ui-border,#3a3a3a);';
  const _BTN_PRIMARY = 'padding:6px 12px;border-radius:6px;cursor:pointer;border:0;'
    + 'background:var(--ui-accent-primary,#3b82f6);color:var(--ui-accent-text,#fff);';

  function _notice({ title, body, okLabel, onOk, cancelLabel }) {
    const { wrap, row, close } = _shell({ title, body });
    if (cancelLabel) {
      const c = document.createElement('button');
      c.textContent = cancelLabel;
      c.style.cssText = _BTN_PLAIN;
      c.addEventListener('click', close);
      row.appendChild(c);
    }
    const ok = document.createElement('button');
    ok.textContent = okLabel;
    ok.style.cssText = _BTN_PRIMARY;
    ok.addEventListener('click', () => { close(); try { onOk?.(); } catch (_) {} });
    row.appendChild(ok);
    wrap.addEventListener('click', e => { if (e.target === wrap) close(); });
  }

  /* ── 모델 고르기 — ★이 플러그인 «자기» 선택이다 ─────────────────────
     ⛔#aig-model-select 를 읽지도 쓰지도 않는다. 그건 ai-image-gen 이 생성 payload 에
       «그대로» 실어 보내는 공용 select 라, 거기에 removebg 를 끼워 넣으면
       모르는 모델명이 gemini 경로로 흘러간다(내가 실제로 그렇게 만들었다가 걷어냈다).
     ★기본은 «AI 누끼» — 지금 동작과 같게 둔다. ⛔저장하지 않는다(고를 때마다 기본이 AI 누끼다). */
  function _chooseModel() {
    return new Promise(resolve => {
      const { wrap, box, row, close } = _shell({
        title: '배경 제거 모델',
        body: '어떤 방식으로 배경을 지울지 고르세요.',
      });
      let done = false;
      const finish = (v) => { if (done) return; done = true; close(); resolve(v); };
      const list = document.createElement('div');
      list.style.cssText = 'display:flex;flex-direction:column;gap:8px;margin:-8px 0 16px;';
      const mk = (value, label, desc, primary) => {
        const b = document.createElement('button');
        b.dataset.rbModel = value;
        b.style.cssText = 'text-align:left;padding:10px 12px;border-radius:8px;cursor:pointer;'
          + 'background:var(--ui-bg-input,#2e2e2e);color:inherit;font:inherit;border:1px solid '
          + (primary ? 'var(--ui-accent-primary,#3b82f6)' : 'var(--ui-border,#3a3a3a)') + ';';
        const t = document.createElement('div');
        t.style.cssText = 'font-weight:600;margin-bottom:2px;';
        t.textContent = label;
        const d = document.createElement('div');
        d.style.cssText = 'font-size:12px;opacity:.7;';
        d.textContent = desc;
        b.append(t, d);
        b.addEventListener('click', () => finish(value));
        return b;
      };
      list.append(
        mk(MODEL_AI, 'AI 누끼 (기본)', '이미지 생성 패널의 «누끼따기»로 처리합니다.', true),
        mk(MODEL_REMOVEBG, 'remove.bg · 정밀 누끼', '키 필요 · 외부 전송 (이미지가 remove.bg 로 갑니다)', false),
      );
      box.insertBefore(list, row);
      const c = document.createElement('button');
      c.textContent = '취소';
      c.style.cssText = _BTN_PLAIN;
      c.addEventListener('click', () => finish(null));
      row.appendChild(c);
      wrap.addEventListener('click', e => { if (e.target === wrap) finish(null); });
    });
  }

  /* ── 키 없음 — ★조용히 넘어가지 않는다. 「설정 열기」까지 준다 ────── */
  async function _ensureKey() {
    const has = await window.electronAPI?.hasApiKey?.('removebg');
    if (has) return true;
    _notice({
      title: 'remove.bg 키가 없습니다',
      body: 'remove.bg 모델을 쓰려면 본인 API 키가 필요합니다.\n설정 → API 토큰에서 키를 넣어주세요.',
      okLabel: '설정 열기',
      cancelLabel: '닫기',
      onOk: () => window.openSettingsModal?.(),
    });
    return false;
  }

  /* ── 결과를 «되돌려 넣는다» + undo ───────────────────────────────────
     ★규율은 scratch-pad.js 의 _sliceItem 과 «같다» — 원본 id 를 유지해야
       이동·리사이즈 history 스냅샷이 아이템을 찾는다(id 가 바뀌면 undo 체인이 끊긴다). */
  async function _applyScratch(target, newSrc) {
    const before = { src: target.src, id: target.id };
    const it = window._scratchItemById?.(target.id);
    const x = it?.x, y = it?.y, w = it?.w;
    await window._scratchRemoveById?.(target.id);
    await window._scratchAddAndSave?.(newSrc, x, y, w, undefined, target.id);   // ★같은 id
    window.pushHistory?.('배경 제거', {
      onUndo: async () => {
        await window._scratchRemoveById?.(before.id);
        await window._scratchAddAndSave?.(before.src, x, y, w, undefined, before.id);
      },
      onRedo: async () => {
        await window._scratchRemoveById?.(before.id);
        await window._scratchAddAndSave?.(newSrc, x, y, w, undefined, before.id);
      },
    });
  }

  function _applyAsset(target, newSrc) {
    const before = target.img?.src || target.el?.dataset?.imgSrc || '';
    const set = (src) => {
      if (target.img) target.img.src = src;
      if (target.el?.dataset) target.el.dataset.imgSrc = src;
    };
    set(newSrc);
    window.scheduleAutoSave?.();
    window.pushHistory?.('배경 제거', {
      onUndo: () => { set(before); window.scheduleAutoSave?.(); },
      onRedo: () => { set(newSrc); window.scheduleAutoSave?.(); },
    });
  }

  /* ── 본체 ──────────────────────────────────────────────────────────── */
  async function runRemoveBg() {
    const target = _pickTarget();
    if (!target) {
      window.showToast?.('❌ 배경을 지울 이미지를 먼저 선택하세요 (스크래치 항목 또는 이미지 블록)');
      return;
    }
    const model = await _chooseModel();
    if (!model) return;                            // 취소 — 아무것도 하지 않는다

    // ★AI 누끼면 기존 경로로 넘긴다 — 여기서 새 구현을 만들지 않는다
    if (model !== MODEL_REMOVEBG) {
      window.showToast?.('✂️ AI 누끼는 이미지 생성 패널에서 «누끼따기»를 켜고 실행하세요');
      window.openImageGenModal?.();
      return;
    }
    if (!(await _ensureKey())) return;             // 키 없음 → 안내 + 설정 열기
    /* ★외부 전송 «막는» 고지는 두지 않는다(현빈 판단) — 이 앱은 AI 누끼(gemini/openai)도
       이미지를 외부로 보내는데 거기엔 고지가 없다. remove.bg 만 막아세우면 일관성이 없다.
       대신 모델 이름에 「외부 전송」을 적어 «고르는 순간» 알 수 있게 한다. */

    window.showToast?.('✂️ 배경 제거 중…');
    let payload;
    try { payload = await _toB64(target.src); }
    catch (e) { window.showToast?.('❌ 이미지를 읽지 못했습니다: ' + (e?.message || '')); return; }

    const res = await window.electronAPI?.removebgCutout?.(payload);
    if (!res?.ok) {
      // ★사유를 그대로 보여준다 — main 이 이미 «다음 행동»을 담아 보냈다
      window.showToast?.('❌ ' + (res?.message || '배경 제거에 실패했습니다'));
      return;
    }

    // 저장은 기존 규약을 쓴다 — ⛔새 저장 경로를 만들지 않는다
    const projectId = window.state?.id || window.currentProjectId || null;
    let newSrc = `data:${res.mime};base64,${res.b64}`;
    if (projectId && window.electronAPI?.aiSaveImage) {
      const saved = await window.electronAPI.aiSaveImage({ projectId, b64: res.b64, mime: res.mime });
      if (saved?.ok && saved.blobPath) newSrc = saved.blobPath;
    }

    if (target.kind === 'scratch') await _applyScratch(target, newSrc);
    else _applyAsset(target, newSrc);
    window.showToast?.('✂️ 배경 제거 완료');
  }

  /* 플러그인 항목 진입 */
  function openRemoveBgPlugin() {
    document.getElementById('fp-plugin-panel')?.style && (document.getElementById('fp-plugin-panel').style.display = 'none');
    runRemoveBg();
  }


  window.openRemoveBgPlugin = openRemoveBgPlugin;
  window.runRemoveBg        = runRemoveBg;
})();
