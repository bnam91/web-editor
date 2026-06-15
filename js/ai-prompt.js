// ai-prompt.js — AI 프롬프트 입력 UI (중앙 플로팅 패널)
// 실제 AI 연동은 T34 이후. 현재는 UI 뼈대만.

const QUICK_PROMPTS = [
  { label: '리뷰 섹션',  text: '고객 리뷰 3개를 카드 형태로 보여주는 섹션을 만들어줘' },
  { label: '혜택 섹션',  text: '제품의 핵심 혜택 3가지를 아이콘과 함께 나열하는 섹션' },
  { label: 'CTA 섹션',   text: '구매를 유도하는 강력한 CTA 버튼이 포함된 섹션' },
];

function openAiPrompt() {
  // 모달 마운트는 ai-image-gen.js의 openImageGenModal이 담당 (모드 탭/picker 초기화 포함)
  if (window.openImageGenModal) {
    window.openImageGenModal();
    return;
  }
  document.getElementById('ai-prompt-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('ai-prompt-textarea').focus(), 50);
}

function closeAiPrompt() {
  // 이미지 모드 picker 등 상태 리셋도 함께 — closeImageGenModal가 처리
  if (window.closeImageGenModal) {
    window.closeImageGenModal();
  } else {
    document.getElementById('ai-prompt-overlay').style.display = 'none';
  }
  const ta = document.getElementById('ai-prompt-textarea');
  if (ta) ta.value = '';
  _setLoading(false);
}

function _setLoading(on) {
  const btn = document.getElementById('ai-prompt-submit-btn');
  if (on) {
    btn.disabled = true;
    btn.innerHTML = '<span class="ai-spinner"></span> 생성 중...';
  } else {
    btn.disabled = false;
    btn.innerHTML = '✨ 생성하기';
  }
}

function submitAiPrompt() {
  // 이미지 모드 분기 — 모달 탭에 따라 ai-image-gen.js로 위임
  const currentMode = window._aigCurrentMode?.() || 'text';
  if (currentMode === 'image' && window._aigHandleImageSubmit) {
    window._aigHandleImageSubmit();
    return;
  }
  const textarea = document.getElementById('ai-prompt-textarea');
  const promptText = textarea?.value.trim() || '';
  if (!promptText) {
    textarea?.focus();
    return;
  }
  _setLoading(true);
  // TODO(T34~): 실제 AI 연동
  setTimeout(() => {
    console.log('AI prompt:', promptText);
    _setLoading(false);
    closeAiPrompt();
  }, 1200);
}

// 퀵 프롬프트 버튼 렌더링
document.addEventListener('DOMContentLoaded', () => {
  const wrap = document.getElementById('ai-quick-prompts');
  if (!wrap) return;
  QUICK_PROMPTS.forEach(({ label, text }) => {
    const btn = document.createElement('button');
    btn.className = 'ai-quick-btn';
    btn.textContent = label;
    btn.addEventListener('click', () => {
      document.getElementById('ai-prompt-textarea').value = text;
      document.getElementById('ai-prompt-textarea').focus();
    });
    wrap.appendChild(btn);
  });

  // 오버레이 바깥 클릭 닫기
  document.getElementById('ai-prompt-overlay').addEventListener('click', e => {
    if (e.target === document.getElementById('ai-prompt-overlay')) closeAiPrompt();
  });

  // textarea Cmd+Enter 제출, Escape 닫기 (텍스트·이미지 모드 모두)
  const _bindKeys = (el) => {
    if (!el) return;
    el.addEventListener('keydown', e => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitAiPrompt(); }
      if (e.key === 'Escape') { e.stopPropagation(); closeAiPrompt(); }
    });
  };
  _bindKeys(document.getElementById('ai-prompt-textarea'));
  _bindKeys(document.getElementById('aig-image-prompt'));

  _setupAiPanelDrag();
});

// 저장된 위치 복원 — 모달 오픈 직후 호출 (ai-image-gen.js의 openImageGenModal에서도 hookable)
function _restoreAiPanelPos() {
  const ov = document.getElementById('ai-prompt-overlay');
  if (!ov) return;
  let saved = null;
  try { saved = JSON.parse(localStorage.getItem('aiPanelPos') || 'null'); } catch {}
  if (!saved) return;
  const panel = document.getElementById('ai-prompt-panel');
  const w = panel?.offsetWidth || 480;
  const h = panel?.offsetHeight || 300;
  const x = Math.min(Math.max(0, saved.x), Math.max(0, window.innerWidth - w));
  const y = Math.min(Math.max(0, saved.y), Math.max(0, window.innerHeight - 40));
  ov.style.left = x + 'px';
  ov.style.top  = y + 'px';
  ov.style.right = 'auto';
}

function _setupAiPanelDrag() {
  const header = document.querySelector('#ai-prompt-panel .ai-panel-header');
  const ov = document.getElementById('ai-prompt-overlay');
  if (!header || !ov) return;
  header.style.cursor = 'move';
  header.style.userSelect = 'none';

  let dragging = false;
  let startX = 0, startY = 0, origX = 0, origY = 0;

  header.addEventListener('mousedown', e => {
    if (e.target.closest('.ai-close-btn')) return;
    const r = ov.getBoundingClientRect();
    origX = r.left; origY = r.top;
    startX = e.clientX; startY = e.clientY;
    dragging = true;
    ov.style.right = 'auto';
    ov.style.left = origX + 'px';
    ov.style.top  = origY + 'px';
    e.preventDefault();
  });
  window.addEventListener('mousemove', e => {
    if (!dragging) return;
    const panel = document.getElementById('ai-prompt-panel');
    const w = panel?.offsetWidth || 480;
    let nx = origX + (e.clientX - startX);
    let ny = origY + (e.clientY - startY);
    nx = Math.min(Math.max(0, nx), Math.max(0, window.innerWidth - w));
    ny = Math.min(Math.max(0, ny), Math.max(0, window.innerHeight - 40));
    ov.style.left = nx + 'px';
    ov.style.top  = ny + 'px';
  });
  window.addEventListener('mouseup', () => {
    if (!dragging) return;
    dragging = false;
    const r = ov.getBoundingClientRect();
    localStorage.setItem('aiPanelPos', JSON.stringify({ x: r.left, y: r.top }));
  });
}

window._restoreAiPanelPos = _restoreAiPanelPos;

// 전역 노출 (index.html onclick에서 사용)
window.openAiPrompt   = openAiPrompt;
window.closeAiPrompt  = closeAiPrompt;
window.submitAiPrompt = submitAiPrompt;
