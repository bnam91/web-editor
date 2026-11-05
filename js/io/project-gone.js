/* 앱 밖에서 폴더가 없어진 프로젝트의 남은 LS 본(MISSING-PROJECT-TAB-NO-NOTICE-01) — 편집기와 갤러리가 같이 쓴다.
   폴더가 있으면 null. 본은 missing 일 때만 준다: 앱 휴지통의 것은 되살리지 않고, 못 읽은 것(unknown)은 없어졌다고 말할 근거가 없다. */
(function (w) {
  const KEY = (id) => 'web-editor-autosave__' + id;
  /* LS 와 탭 목록은 계정별이 아니다 — 열 때 그 본이 어느 뿌리의 것인지 적어 두고, 다른 뿌리의 본은 주지 않는다(주면 B 화면에 A 내용이 뜨고 저장이 B 뿌리에 폴더를 만든다 · 앱 재현). */
  const MARK = (id) => 'web-editor-ls-root__' + id;
  const AWAY = 'web-editor-open-tabs-away';
  w.markLsRoot = async (id) => { const root = await w.electronAPI?.projectsRootKey?.(); if (root) localStorage.setItem(MARK(id), root); };
  w.lsCopyOwner = (id) => localStorage.getItem(MARK(id));
  /* 지금 뿌리가 아닌 본의 id — 고아 정리가 지우면 그 계정으로 돌아왔을 때 없다. */
  w.foreignLsIds = (root) => Object.keys(localStorage).filter((k) => k.startsWith('web-editor-ls-root__') && localStorage.getItem(k) !== root).map((k) => k.slice('web-editor-ls-root__'.length));
  /* 다른 계정의 탭은 여기 맡겼다가 그 계정이 다시 부팅하면 돌려준다. */
  w.awayTabs = () => { try { return JSON.parse(localStorage.getItem(AWAY)) || []; } catch { return []; } };
  w.setAwayTabs = (tabs) => { if (tabs.length) localStorage.setItem(AWAY, JSON.stringify(tabs)); else localStorage.removeItem(AWAY); };
  w.projectGoneCopy = async (id) => {
    const state = await w.electronAPI?.projectFolderState?.(id);
    if (state !== 'missing' && state !== 'trashed' && state !== 'unknown') return null;
    let data = null;
    if (state === 'missing') {
      const owner = w.lsCopyOwner(id), root = await w.electronAPI?.projectsRootKey?.();
      if (owner && owner !== root) return { state: 'foreign', data: null };
      if (!owner) return { state, data: null };   // 어느 계정 것인지 모르는 본은 안 준다
    }
    if (state === 'missing') { try { const d = JSON.parse(localStorage.getItem(KEY(id))); if (Array.isArray(d?.pages) && d.pages.length) data = d; } catch {} }
    return { state, data };
  };
})(window);
