/* 앱 밖에서 폴더가 없어진 프로젝트의 남은 LS 본(MISSING-PROJECT-TAB-NO-NOTICE-01) — 편집기와 갤러리가 같이 쓴다.
   폴더가 있으면 null. 본은 missing 일 때만 준다: 앱 휴지통의 것은 되살리지 않고, 못 읽은 것(unknown)은 없어졌다고 말할 근거가 없다. */
(function (w) {
  const KEY = (id) => 'web-editor-autosave__' + id;
  w.projectGoneCopy = async (id) => {
    const state = await w.electronAPI?.projectFolderState?.(id);
    if (state !== 'missing' && state !== 'trashed' && state !== 'unknown') return null;
    let data = null;
    if (state === 'missing') { try { const d = JSON.parse(localStorage.getItem(KEY(id))); if (Array.isArray(d?.pages) && d.pages.length) data = d; } catch {} }
    return { state, data };
  };
})(window);
