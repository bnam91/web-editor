// ai-prompt.js — AI 프롬프트 입력 UI (중앙 플로팅 패널)
// 실제 AI 연동은 T34 이후. 현재는 UI 뼈대만.

const QUICK_PROMPTS = [
  { label: '리뷰 섹션',  text: '고객 리뷰 3개를 카드 형태로 보여주는 섹션을 만들어줘' },
  { label: '혜택 섹션',  text: '제품의 핵심 혜택 3가지를 아이콘과 함께 나열하는 섹션' },
  { label: 'CTA 섹션',   text: '구매를 유도하는 강력한 CTA 버튼이 포함된 섹션' },
];

function openAiPrompt() {
  document.getElementById('ai-prompt-overlay').style.display = 'flex';
  setTimeout(() => document.getElementById('ai-prompt-textarea').focus(), 50);
}

function closeAiPrompt() {
  document.getElementById('ai-prompt-overlay').style.display = 'none';
  document.getElementById('ai-prompt-textarea').value = '';
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
  const textarea = document.getElementById('ai-prompt-textarea');
  const promptText = textarea.value.trim();
  if (!promptText) {
    textarea.focus();
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

  // textarea Cmd+Enter 제출, Escape 닫기
  document.getElementById('ai-prompt-textarea').addEventListener('keydown', e => {
    if ((e.metaKey || e.ctrlKey) && e.key === 'Enter') { e.preventDefault(); submitAiPrompt(); }
    if (e.key === 'Escape') { e.stopPropagation(); closeAiPrompt(); }
  });
});

// 전역 노출 (index.html onclick에서 사용)
window.openAiPrompt   = openAiPrompt;
window.closeAiPrompt  = closeAiPrompt;
window.submitAiPrompt = submitAiPrompt;
