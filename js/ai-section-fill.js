/* ══════════════════════════════════════
   AI Section Fill — 섹션 안 text-block 일괄 채우기
   - 버튼 클릭 → 프롬프트 UI 오픈 → Gemini 호출 → 미리보기 → 적용
   - UI 구현체는 _openAIFillUI_impl() 한 함수에 모여있어 브랜치별로 교체 가능.
══════════════════════════════════════ */

/** 섹션 안 모든 text-block 수집 (DOM 순서 보존) */
function collectSectionTextBlocks(sec) {
  if (!sec) return [];
  const tbs = Array.from(sec.querySelectorAll('.text-block'));
  return tbs.map(tb => {
    // 실제 텍스트 컨테이너(tb-h1/h2/body/caption/label)
    const tbInner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
    const styleClass = tbInner.classList && Array.from(tbInner.classList)
      .find(c => c.startsWith('tb-')) || 'tb-body';
    return {
      id: tb.id,
      style: styleClass,        // tb-h1 / tb-h2 / tb-body / tb-label / tb-caption
      current: (tbInner.textContent || '').trim(),
      _tbInner: tbInner,        // 적용 단계에서 직접 textContent 갈아끼움
    };
  });
}

/** Gemini 결과를 섹션에 적용 — 1:1 ID 매칭 */
function applyAIReplacements(sec, replacements) {
  if (!sec || !Array.isArray(replacements)) return 0;
  let applied = 0;
  replacements.forEach(rep => {
    if (!rep?.id || typeof rep.text !== 'string') return;
    const tb = sec.querySelector(`#${CSS.escape(rep.id)}`);
    if (!tb) return;
    const tbInner = tb.querySelector('.tb-h1, .tb-h2, .tb-h3, .tb-body, .tb-caption, .tb-label') || tb;
    tbInner.textContent = rep.text;
    applied += 1;
  });
  if (applied > 0) window.scheduleAutoSave?.();
  return applied;
}

/** Gemini 호출 (preload IPC) — 결과 { ok, replacements?, error? } */
async function callGeminiFill(payload) {
  if (!window.electronAPI?.aiFillSectionTexts) {
    return { ok: false, error: 'electronAPI.aiFillSectionTexts 가 없습니다 (preload).' };
  }
  return window.electronAPI.aiFillSectionTexts(payload);
}

/* ── UI 구현 (브랜치별 교체 지점) ────────────────────────────
   기본 구현은 native prompt() — 동작 가능한 baseline.
   feat/ai-fill-ui-a / feat/ai-fill-ui-b 브랜치에서 이 함수만 교체. */
async function _openAIFillUI_impl(secEl) {
  const blocks = collectSectionTextBlocks(secEl);
  if (blocks.length === 0) {
    window.showToast?.('⚠️ 이 섹션에는 텍스트 블록이 없습니다.');
    return;
  }
  const userPrompt = window.prompt(
    `이 섹션의 텍스트 블록 ${blocks.length}개를 어떤 내용으로 채울까요?\n` +
    `(예: "헬스보충제 주제로 라벨/제목/캡션 채워줘")`,
    ''
  );
  if (userPrompt === null) return; // 취소
  await runAIFill(secEl, { prompt: userPrompt, tone: '', mode: 'replaceAll' });
}

/** UI에서 호출하는 공용 실행기 — payload 받아 호출/적용/토스트 */
async function runAIFill(secEl, { prompt, tone, mode, imagePath }) {
  const blocks = collectSectionTextBlocks(secEl);
  if (blocks.length === 0) {
    window.showToast?.('⚠️ 텍스트 블록 없음');
    return { ok: false };
  }
  window.showToast?.('✨ AI가 작성 중…');
  const payload = {
    blocks: blocks.map(b => ({ id: b.id, style: b.style, current: b.current })),
    prompt: prompt || '',
    tone:   tone   || '',
    mode:   mode   || 'replaceAll',
    imagePath: imagePath || null,
  };
  const res = await callGeminiFill(payload);
  if (!res?.ok) {
    window.showToast?.(`❌ ${res?.error || '알 수 없는 오류'}`);
    return res;
  }
  window.pushHistory?.();
  const n = applyAIReplacements(secEl, res.replacements || []);
  window.showToast?.(`✅ ${n}개 블록 적용됨`);
  return res;
}

/** 외부에서 호출하는 진입점 — 섹션 toolbar 버튼이 사용 */
function openAIFillUI(btnEl) {
  const sec = btnEl.closest('.section-block');
  if (!sec) return;
  _openAIFillUI_impl(sec);
}

window.openAIFillUI            = openAIFillUI;
window.runAIFill               = runAIFill;
window.collectSectionTextBlocks = collectSectionTextBlocks;
window.applyAIReplacements     = applyAIReplacements;
