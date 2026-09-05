/* ══════════════════════════════════════════════════════════════════════════
   export-result-modal.js — 내보내기 «결과»를 한 번 알린다 (P0 · B안)
   ★새 룩을 만들지 않는다(현빈 상시 지시, release-note.js 와 같은 규약):
     껍데기는 .settings-modal-overlay / -shell / -footer / .tb-badge 공용 정의를 그대로 쓴다.
     여기서 더하는 건 «목록 한 칸»(.exres-list) 뿐이다.
   ★문구 규칙(PLAN §7): 앱 실물의 존댓말. 「실패」는 «파일이 안 나온 경우»에만 쓴다.
     픽셀차는 「확인이 필요합니다」 — 우리가 아는 건 «그림이 다르다»이지 «무엇이 잘못됐다»가
     아니라서 단정하지 않는다.
   ★정상 섹션은 «나열하지 않는다»(숫자만) — 22줄 목록은 읽을 것이 아니라 무서운 것이다.
   ══════════════════════════════════════════════════════════════════════════ */
(function () {
  /* 사유 코드 → 사용자 말. ★판정은 export-gate-core.js 의 술어 하나가 한다.
     여기는 그 코드를 «읽어서 번역만» 한다 — 임계값도 조건도 여기 다시 적지 않는다. */
  /* ⚠️여기 없는 사유는 P0 가 «말하지 않는» 것이다 — 줄 밴드 개수(bandCount)는 오탐이 실측돼
     판정에서 빠졌고(export-gate-core.js ⑵), 그래서 문구도 두지 않는다. 쓰지 않는 문구를 남겨 두면
     다음 사람이 「이것도 잡아준다」고 읽는다. */
  const REASON = {
    sizeMismatch: '내보낸 이미지의 높이가 캔버스와 다릅니다. 잘렸거나 여백이 생겼을 수 있습니다.',
    blob:         '캔버스와 다르게 그려진 부분이 있습니다.',
    imgTimeout:   '이미지를 불러오는 데 시간이 오래 걸려 검사하지 못했습니다. 다시 내보내면 대개 해결됩니다.',
    unstable:     '검사 결과가 일정하지 않아 판단하지 않았습니다.',
    gif:          'GIF는 검사하지 않습니다.',
    notNative:    '검사는 데스크톱 앱에서만 할 수 있습니다.',
    captureError: '검사에 필요한 화면을 얻지 못했습니다.',
    noMetrics:    '검사에 필요한 화면을 얻지 못했습니다.',
    noInk:        '비교할 내용이 없어 판단하지 않았습니다.',
  };
  const FMT = { png: 'PNG', jpg: 'JPG', gif: 'GIF', 'gif-anim': 'GIF' };

  function reasonText(reasons) {
    for (const r of (reasons || [])) if (REASON[r]) return REASON[r];
    return '확인이 필요합니다.';
  }

  function open(res, meta) {
    const rows = (res && res.results) || [];
    const M = meta || {};
    /* 겹침 가드 — 다른 모달이 열려 있으면 그 위에 또 띄우지 않는다(relnote 와 같은 규약).
       ★그래도 결과를 «삼키지» 않는다 — 토스트로 한 줄 남긴다. */
    if (document.getElementById('exres-modal')) return;
    const other = document.querySelector('.settings-modal-overlay[style*="flex"]');
    const bad  = rows.filter(r => r && !r.failed && r.gate && r.gate.tier === 'mismatch');
    const unk  = rows.filter(r => r && !r.failed && (!r.gate || r.gate.tier === 'unmeasured'));
    const fail = rows.filter(r => r && r.failed);
    const okN  = rows.length - bad.length - unk.length - fail.length;

    if (other) {
      window.showToast?.(fail.length || bad.length
        ? `내보내기 결과 — 확인이 필요한 섹션 ${bad.length + fail.length}개`
        : '내보내기를 마쳤습니다. 다운로드 폴더를 확인하세요');
      return;
    }

    const overlay = document.createElement('div');
    overlay.id = 'exres-modal';
    overlay.className = 'settings-modal-overlay';
    overlay.style.display = 'flex';
    overlay.innerHTML = `
      <div class="settings-modal-shell exres-shell" role="dialog" aria-modal="true" aria-label="내보내기 결과">
        <div class="settings-modal-header exres-hero">
          <span class="settings-modal-title exres-h">내보내기 결과</span>
          <span class="tb-badge tb-badge--pill exres-badge"></span>
          <button class="settings-modal-close exres-close" data-act="close" title="닫기 (Esc)">×</button>
        </div>
        <div class="exres-list"></div>
        <div class="settings-modal-footer">
          <span class="exres-foot"></span>
          <div style="flex:1"></div>
          <button class="settings-btn settings-btn-primary" data-act="ok">확인</button>
        </div>
      </div>`;

    const badge = overlay.querySelector('.exres-badge');
    badge.textContent = `${FMT[M.format] || String(M.format || '').toUpperCase()} · ${M.width || 860}px`;
    badge.classList.add(bad.length || fail.length ? 'tb-badge--warn'
                      : unk.length ? 'tb-badge--muted' : 'tb-badge--accent');

    const list = overlay.querySelector('.exres-list');
    const total = rows.length || (res && res.total) || 0;

    /* 요약 한 줄 — 다른 게 없으면 «이 줄이 전부»다. */
    const sum = document.createElement('p');
    sum.className = 'exres-sum';
    let t = okN === total
      ? `${total}개 섹션을 캔버스와 같게 내보냈습니다.`
      : `${total}개 중 ${okN}개는 캔버스와 같게 내보냈습니다.`;
    if (unk.length) t += ` 그중 ${unk.length}개는 검사하지 못했습니다.`;
    sum.textContent = t;
    list.appendChild(sum);

    const group = (title, arr, kind) => {
      if (!arr.length) return;                       // 0 이면 그룹 자체를 안 그린다
      const g = document.createElement('div');
      g.className = 'exres-group';
      g.textContent = `${title} ${arr.length}`;
      list.appendChild(g);
      arr.forEach(r => {
        const row = document.createElement('div');
        row.className = 'exres-row';
        const nm = document.createElement('b');
        nm.textContent = `${String(r.idx ?? '').padStart(2, '0')} · ${r.name || r.sectionId || ''}`;
        const why = document.createElement('span');
        why.className = 'exres-reason';
        why.textContent = kind === 'failed'
          ? `내보내지 못했습니다: ${r.error || '알 수 없는 오류'}`
          : reasonText(r.gate && r.gate.reasons);
        row.append(nm, why);
        if (kind !== 'failed') {
          const btn = document.createElement('button');
          btn.className = 'settings-btn exres-retry';
          btn.textContent = '다시 내보내기';
          btn.dataset.sid = r.sectionId || '';
          row.appendChild(btn);
        }
        list.appendChild(row);
      });
    };
    group('확인이 필요한 섹션', bad, 'mismatch');
    group('검사하지 못한 섹션', unk, 'unmeasured');
    group('내보내지 못한 섹션', fail, 'failed');

    /* 접힌 설명 — «이 검사가 무엇을 보고 무엇을 안 보는지». 안 보는 것을 같이 적는다. */
    const det = document.createElement('details');
    det.className = 'exres-about';
    const smy = document.createElement('summary');
    smy.textContent = '이 검사는 무엇을 보나';
    const p = document.createElement('p');
    /* ★「무엇을 보나」에 «못 보는 것»을 같이 적는다. 안심을 주는 문장은 경고 부재보다 나쁘다.
       지금 P0 가 사용자에게 말하는 축은 «크기 불일치» 하나다 — 그 이상을 약속하지 않는다. */
    p.textContent = '내보낸 이미지를 캔버스 렌더와 픽셀 단위로 비교해, 잘렸거나 여백이 생긴 것을 찾습니다. 글자 굵기·자간의 미세한 어긋남과 색감·밝기 차이는 아직 검사 대상이 아닙니다.';
    det.append(smy, p);
    list.appendChild(det);

    overlay.querySelector('.exres-foot').textContent = '다운로드 폴더에 저장했습니다';
    document.body.appendChild(overlay);

    const finish = () => { document.removeEventListener('keydown', onKey, true); overlay.remove(); };
    const onKey = e => { if (e.key === 'Escape') { e.stopPropagation(); finish(); } };
    document.addEventListener('keydown', onKey, true);
    overlay.addEventListener('click', async e => {
      const retry = e.target.closest('.exres-retry');
      if (retry) {
        const sec = document.getElementById(retry.dataset.sid);
        if (!sec) { window.showToast?.('그 섹션을 찾지 못했습니다.'); return; }
        retry.disabled = true; retry.textContent = '내보내는 중...';
        try {
          const r = await window.exportSection(sec, M.format || 'png', M.width || 860);
          const row = retry.closest('.exres-row');
          const why = row.querySelector('.exres-reason');
          const tier = r && r.gate && r.gate.tier;
          why.textContent = tier === 'same' || tier === 'minor'
            ? '다시 내보냈습니다. 이번에는 캔버스와 같습니다.'
            : reasonText(r && r.gate && r.gate.reasons);
          row.classList.toggle('exres-row--ok', tier === 'same' || tier === 'minor');
        } catch (err) {
          retry.closest('.exres-row').querySelector('.exres-reason').textContent =
            `내보내지 못했습니다: ${(err && err.message) || err}`;
        } finally { retry.disabled = false; retry.textContent = '다시 내보내기'; }
        return;
      }
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'ok' || act === 'close') finish();
      else if (e.target === overlay) finish();
    });
  }

  /* 단일 섹션 — «같으면» 토스트 한 줄, 그 외엔 같은 모달. */
  function openOne(r, meta) {
    const tier = r && r.gate && r.gate.tier;
    if (!r || r.failed) { open({ results: [r], total: 1 }, meta); return; }
    if (tier === 'same' || tier === 'minor') {
      window.showToast?.('내보냈습니다 · 캔버스와 같습니다');
      return;
    }
    if (!r.gate) { window.showToast?.('내보냈습니다. 다운로드 폴더를 확인하세요'); return; }
    open({ results: [r], total: 1 }, meta);
  }

  window.showExportResultModal = open;
  window.showExportResultOne   = openOne;
})();
