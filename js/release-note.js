/* ══════════════════════════════════════════════════════════════════════════
   release-note.js — 업데이트 후 «무엇이 달라졌는지» 한 번 알린다 (A4)
   ★새 룩을 만들지 않는다(현빈 상시 지시, notice.css 와 같은 규약):
     껍데기는 .settings-modal-overlay / -shell / -header / -footer 를 그대로 쓴다.
     여기서 더하는 건 «목록 한 칸»(.relnote-list) 뿐이다.
   ★간결형 확정(현빈 2026-09-04) — 제목만 훑게 하고 설명은 붙이지 않는다.
   언제 뜨나: 저장된 「마지막으로 본 버전」과 지금 버전이 «다를 때» 1회.
     · 같은 버전 재실행 → 안 뜬다
     · 신규 설치(저장값 없음) → 안 뜬다(비교할 이전 버전이 없다)
     · 「일주일간 안 보기」 → 이후 버전에서도 안 뜬다
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  const KEY_SEEN = 'goditor.relnote.lastSeen';
  const KEY_OFF  = 'goditor.relnote.off';

  /* 릴리스마다 «사람이» 5줄 쓴다 — 커밋에서 자동으로 뽑지 않는다.
     커밋 메시지를 그대로 옮기면 사용자 말이 안 나오고 내부 작업이 섞여 나간다. */
  const NOTES = {
    '0.9.1': {
      date: '2026-09-04',
      items: [
        { k: 'new', t: '두 칸 블록 좌우 비율 조절',
          d: '속성 패널 「비율」 슬라이더 · 캔버스에 즉시 반영' },
        { k: 'new', t: '상단바에 현재 버전 표시',
          d: '문의 시 함께 알려주시면 확인이 빠릅니다' },
        { k: 'fix', t: '여러 블록 복사 시 순서가 뒤섞이던 문제',
          d: '고른 순서 그대로 붙여넣기 · 개수 제한 없음' },
        { k: 'fix', t: '스크래치 그룹 해제 후에도 섹션을 따라다니던 문제',
          d: '그룹 해제 시 섹션 연결도 함께 끊김' },
        { k: 'imp', t: '업데이트 후 남던 설치 파일 자동 정리',
          d: '맥 약 353MB · 윈도우 약 337MB 확보' },
      ],
    },
  };

  const GROUP = { new: '새로 생긴 것', fix: '고친 것', imp: '나아진 것' };


  function open(version, note) {
    const items = note.items || note;
    if (document.getElementById('relnote-modal')) return;   // 겹쳐 띄우지 않는다
    const overlay = document.createElement('div');
    overlay.id = 'relnote-modal';
    overlay.className = 'settings-modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="settings-modal-shell relnote-shell" role="dialog" aria-modal="true" aria-label="업데이트 내역">
        <div class="relnote-hero">
          <span class="tb-badge tb-badge--pill tb-badge--accent relnote-ver"></span>
          <div class="relnote-titlerow"><span class="relnote-h">릴리스 노트</span><span class="relnote-date"></span></div>
          <button class="settings-modal-close relnote-close" data-act="close" title="닫기 (Esc)">×</button>
        </div>
        <div class="relnote-list"></div>
        <div class="settings-modal-footer">
          <label class="relnote-off"><input type="checkbox" data-act="off"> 일주일간 안 보기</label>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-primary" data-act="ok">확인</button>
        </div>
      </div>`;
    overlay.querySelector('.relnote-ver').textContent = `버전 ${version}`;
    /* ★제목은 «항상 고정» — 릴리스노트지 카피라이팅이 아니다. 날짜는 제목과 같은 줄에. */
    overlay.querySelector('.relnote-date').textContent =
      'v' + version + (note.date ? ' · ' + note.date : '');
    overlay.querySelector('.relnote-shell').style.position = 'relative';

    /* ★textContent 로만 넣는다 — 노트가 HTML 로 실행될 이유가 없다(notice.js 와 같은 규약). */
    const list = overlay.querySelector('.relnote-list');
    let lastKind = null;
    items.forEach(it => {
      if (it.k !== lastKind) {                       // 종류가 바뀌면 그룹 제목을 세운다
        const g = document.createElement('div');
        g.className = 'relnote-group relnote-group--' + it.k;
        g.textContent = GROUP[it.k] || '';
        list.appendChild(g);
        lastKind = it.k;
      }
      const row = document.createElement('div');
      row.className = 'relnote-item';
      const b = document.createElement('b');
      /* ★불릿은 «실제 요소»다 — ::before 는 렌더된 자리를 잴 수 없어 공식에 기대게 되고 세 번 틀렸다.
         제목 <b> 안에 두면 그 줄의 행간을 그대로 타고, 재서 맞출 수도 있다. */
      const bullet = document.createElement('i'); bullet.className = 'relnote-bullet';
      b.append(bullet, document.createTextNode(it.t));
      row.appendChild(b);
      if (it.d) { const s2 = document.createElement('span'); s2.textContent = it.d; row.appendChild(s2); }
      list.appendChild(row);
    });

    document.body.appendChild(overlay);

    const finish = () => {
      /* ★「일주일간 안 보기」 — 영구 해제가 아니라 «기한»이다. 지나면 다시 뜬다. */
      if (overlay.querySelector('[data-act=off]')?.checked) {
        try { localStorage.setItem(KEY_OFF, String(Date.now() + 7 * 86400000)); } catch (_) {}
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
    if (off && Number(off) > Date.now()) return;          // 기한 안이면 안 뜬다
    if (off) { try { localStorage.removeItem(KEY_OFF); } catch (_) {} }   // 지났으면 해제
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
