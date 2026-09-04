/* ══════════════════════════════════════════════════════════════════════════
   release-note.js — 업데이트 후 «무엇이 달라졌는지» 한 번 알린다 (A4)
   ★새 룩을 만들지 않는다(현빈 상시 지시, notice.css 와 같은 규약):
     껍데기는 .settings-modal-overlay / -shell / -header / -footer 를 그대로 쓴다.
     여기서 더하는 건 «목록 한 칸»(.relnote-list) 뿐이다.
   ★간결형 확정(현빈 2026-09-04) — 제목만 훑게 하고 설명은 붙이지 않는다.
   언제 뜨나: 저장된 「마지막으로 본 버전」과 지금 버전이 «다를 때» 1회.
     · 같은 버전 재실행 → 안 뜬다
     · 신규 설치(저장값 없음) → 안 뜬다(비교할 이전 버전이 없다)
     · 「다음부터 안 보기」 → 이후 버전에서도 안 뜬다
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const KEY_SEEN = 'goditor.relnote.lastSeen';
  const KEY_OFF  = 'goditor.relnote.off';

  /* 릴리스마다 «사람이» 5줄 쓴다 — 커밋에서 자동으로 뽑지 않는다.
     커밋 메시지를 그대로 옮기면 사용자 말이 안 나오고 내부 작업이 섞여 나간다. */
  const NOTES = {
    '0.9.1': {
      headline: '두 칸 블록을 원하는 비율로 나눌 수 있게 됐어요',
      items: [
        { k: 'new', t: '두 칸 블록의 좌우 비율을 자유롭게 조절할 수 있습니다.',
          d: '지금까지는 두 칸이 항상 반반이었는데, 이제 속성 패널의 「비율」 슬라이더를 움직이면 70:30처럼 원하는 대로 나눌 수 있어요. 밀자마자 캔버스에 바로 반영됩니다.' },
        { k: 'new', t: '상단바에서 지금 쓰고 있는 버전을 볼 수 있습니다.',
          d: '앱 위쪽에 버전이 항상 떠 있어요. 문의를 주실 때 이 번호를 함께 알려주시면 확인이 훨씬 빠릅니다.' },
        { k: 'fix', t: '여러 블록을 한꺼번에 복사하면 순서가 뒤섞이던 문제를 고쳤습니다.',
          d: '이미지와 스텝을 함께 골라 복사하면 이미지 둘, 스텝 둘로 뭉쳐 붙던 문제였어요. 이제는 고르신 순서 그대로, 열 개를 골라도 그대로 붙습니다.' },
        { k: 'fix', t: '스크래치 그룹을 풀어도 이미지가 섹션을 계속 따라다니던 문제를 고쳤습니다.',
          d: '그룹만 풀리고 섹션 연결은 남아 있어서, 섹션을 옮기면 빼놓은 이미지까지 같이 움직였어요. 이제 그룹을 풀면 연결도 함께 끊깁니다.' },
        { k: 'imp', t: '업데이트가 끝난 뒤 남아 있던 설치 파일을 자동으로 정리합니다.',
          d: '새 버전을 받을 때마다 설치 파일이 그대로 쌓여 있었어요. 이제 다음 실행 때 알아서 지웁니다. 맥은 약 353MB, 윈도우는 약 337MB를 되찾습니다.' },
      ],
    },
  };

  const GROUP = { new: '새로 생긴 것', fix: '고친 것', imp: '나아진 것' };

  function summarize(items) {
    const c = { new: 0, fix: 0, imp: 0 };
    items.forEach(i => { if (c[i.k] != null) c[i.k]++; });
    const L = { new: '새기능', fix: '고침', imp: '개선' };
    return Object.keys(c).filter(k => c[k]).map(k => `${L[k]} ${c[k]}`).join(' · ');
  }

  function open(version, note) {
    const items = note.items || note;
    if (document.getElementById('relnote-modal')) return;   // 겹쳐 띄우지 않는다
    const overlay = document.createElement('div');
    overlay.id = 'relnote-modal';
    overlay.className = 'settings-modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="settings-modal-shell relnote-shell" role="dialog" aria-modal="true" aria-label="업데이트 내역">
        <button class="settings-modal-close" data-act="close" title="닫기 (Esc)"
                style="position:absolute;top:14px;right:14px;z-index:2">×</button>
        <div class="relnote-hero">
          <span class="relnote-ver">UPDATED</span>
          <div class="relnote-h"></div>
          <div class="relnote-sub"></div>
        </div>
        <div class="relnote-list"></div>
        <div class="settings-modal-footer">
          <label class="relnote-off"><input type="checkbox" data-act="off"> 다음부터 안 보기</label>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-primary" data-act="ok">확인</button>
        </div>
      </div>`;
    overlay.querySelector('.relnote-ver').textContent = `버전 ${version}`;
    overlay.querySelector('.relnote-h').textContent = note.headline || '새 버전이 준비됐어요';
    overlay.querySelector('.relnote-sub').textContent = summarize(items);
    overlay.querySelector('.relnote-shell').style.position = 'relative';

    /* ★textContent 로만 넣는다 — 노트가 HTML 로 실행될 이유가 없다(notice.js 와 같은 규약). */
    const list = overlay.querySelector('.relnote-list');
    let lastKind = null;
    items.forEach(it => {
      if (it.k !== lastKind) {                       // 종류가 바뀌면 그룹 제목을 세운다
        const g = document.createElement('div');
        g.className = 'relnote-group';
        g.textContent = GROUP[it.k] || '';
        list.appendChild(g);
        lastKind = it.k;
      }
      const row = document.createElement('div');
      row.className = 'relnote-item';
      const ic = document.createElement('span');
      ic.className = 'relnote-dot' + (it.k === 'new' ? ' new' : '');
      const box = document.createElement('div');
      const b = document.createElement('b'); b.textContent = it.t;
      box.appendChild(b);
      if (it.d) { const s2 = document.createElement('span'); s2.textContent = it.d; box.appendChild(s2); }
      row.append(ic, box);
      list.appendChild(row);
    });

    document.body.appendChild(overlay);

    const finish = () => {
      if (overlay.querySelector('[data-act=off]')?.checked) {
        try { localStorage.setItem(KEY_OFF, '1'); } catch (_) {}
      }
      try { localStorage.setItem(KEY_SEEN, version); } catch (_) {}
      document.removeEventListener('keydown', onKey, true);
      overlay.remove();
    };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); finish(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', e => {
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ok' || act === 'close') finish();
      else if (e.target === overlay) finish();          // 바깥 클릭 = 닫기(긴급 공지가 아니다)
    });
  }

  async function boot() {
    let off = null, seen = null;
    try { off = localStorage.getItem(KEY_OFF); seen = localStorage.getItem(KEY_SEEN); } catch (_) {}
    if (off) return;
    const v = await (window.electronAPI?.getVersion?.() || Promise.resolve(null));
    if (!v) return;                                    // 버전을 모르면 아무것도 안 한다
    if (!seen) {                                       // 신규 설치 — 비교 대상이 없다
      try { localStorage.setItem(KEY_SEEN, v); } catch (_) {}
      return;
    }
    if (seen === v) return;                            // 같은 버전 재실행
    const items = NOTES[v];
    if (!items) {                     // 노트를 안 쓴 버전은 조용히 넘어간다
      try { localStorage.setItem(KEY_SEEN, v); } catch (_) {}
      return;
    }
    open(v, items);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', () => setTimeout(boot, 600));
  else setTimeout(boot, 600);

  window._relnoteOpen = (v) => open(v || '0.9.1', NOTES[v || '0.9.1'] || NOTES['0.9.1']);  // 미리보기용
})();
