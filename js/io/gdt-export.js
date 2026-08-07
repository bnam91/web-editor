/* gdt-export.js — 「파일 → 프로젝트 내보내기」 렌더러 측 (GDT-SPEC §8)
 *
 * 흐름: 메뉴 클릭 → ★현재 편집분을 «먼저 디스크로 내림»(기존 저장 chokepoint 재사용)
 *       → main의 gdt:export 호출 → 진행률 표시 → 왕복 검증까지 끝난 결과 보고.
 *
 * ★저장을 먼저 하는 이유: 내보내기는 «디스크의 proj.json»을 읽는다. 렌더러 메모리의
 *   미저장 편집분은 파일에 없다. 안 내리면 「방금 한 작업이 빠진 .gdt」가 나온다.
 *
 * 진행률 UI는 기존 프로젝트 로딩 오버레이(#proj-loading-overlay)를 재사용한다 —
 * 룩어라이크 CSS를 새로 만들지 않는다(디자인 일관성 게이트).
 */

const API = () => (typeof window !== 'undefined' ? window.electronAPI : null);

function _setOverlayText(msg) {
  const el = document.querySelector('#proj-loading-overlay .proj-loading-text');
  if (el) el.textContent = msg;
}

function _fmtMB(bytes) {
  return (bytes / 1048576).toFixed(1) + 'MB';
}

let _busy = false;

async function exportCurrentProjectToGdt() {
  const api = API();
  if (!api?.gdtExport) { window.showToast?.('⚠️ 내보내기는 데스크톱 앱에서만 됩니다'); return; }
  if (_busy) { window.showToast?.('⏳ 내보내기가 이미 진행 중입니다'); return; }

  const projectId = window.activeProjectId;
  if (!projectId) { window.showToast?.('⚠️ 열린 프로젝트가 없습니다'); return; }

  _busy = true;
  try {
    // 1) 미저장 편집분 flush — 기존 저장 경로를 그대로 쓴다(중복 구현 금지)
    window.showProjectLoadingOverlay?.();
    _setOverlayText('저장 중…');
    try {
      if (typeof window.saveProjectToFile === 'function' && typeof window.serializeProject === 'function') {
        await window.saveProjectToFile(window.serializeProject(), { skipThumbnail: true, projectId });
      }
    } catch (e) {
      console.warn('[gdt] 내보내기 전 저장 실패 — 디스크 최신본으로 진행:', e);
    }

    // 2) 내보내기 (저장 대화상자는 main이 띄운다)
    _setOverlayText('내보내는 중…');
    const projectName = document.getElementById('project-name')?.textContent?.trim() || projectId;
    const result = await api.gdtExport({ projectId, projectName });

    // ★§8 완료 훅 — 외부 자동화(CDP)가 sleep 추측 없이 완료를 알 수 있게 남긴다.
    //   (파일 자체도 검증 통과 후에만 최종 이름이 되므로 «존재 = 완료»가 성립한다.)
    window.__gdtLastResult = result;

    if (result?.canceled) return;
    if (!result?.ok) {
      window.showToast?.(`⚠️ 내보내기 실패: ${result?.error || '알 수 없는 오류'}`);
      return;
    }
    const warn = result.fonts?.length ? ` · 폰트 ${result.fonts.join(', ')}` : '';
    window.showToast?.(
      `✅ 내보냄 — ${_fmtMB(result.bytes)} · 이미지 ${result.images}장 · ${(result.elapsedMs / 1000).toFixed(1)}초${warn}`
    );
  } finally {
    _busy = false;
    window.hideProjectLoadingOverlay?.();
  }
}

/* ── 배선 ── */
(function wire() {
  const api = API();
  if (!api) return;
  api.onGdtMenuExport?.(() => { exportCurrentProjectToGdt(); });
  api.onGdtProgress?.((p) => {
    if (p.phase === 'scan' && p.bytesTotal) {
      _setOverlayText(`내보내는 중… ${Math.floor((p.bytesDone / p.bytesTotal) * 100)}%`);
    } else if (p.phase === 'zip') {
      _setOverlayText(`압축 중… ${p.entriesDone}/${p.entriesTotal}`);
    } else if (p.phase === 'verify') {
      _setOverlayText('검증 중…');   // 「저장했다」와 「열린다」는 다르다 — 여기서 다시 연다
    }
  });
})();

window.exportCurrentProjectToGdt = exportCurrentProjectToGdt;

export { exportCurrentProjectToGdt };
